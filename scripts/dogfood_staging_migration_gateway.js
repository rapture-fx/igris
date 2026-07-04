#!/usr/bin/env node
//
// Dogfood staging migration gateway (localhost-only, staging-only).
//
// This is the execution target for the `dogfood.apply_staging_migration`
// action (see DOGFOOD_STAGING_MIGRATION_2026-07-03.md). It is the ONLY
// component that holds the staging database DSN — Overture, the runtime, and
// the console never see credentials. Igris controls WHEN an apply may happen
// (policy + human approval + dispatch); this gateway controls WHAT an apply
// may do, independently:
//
//   - refuses to start unless the DSN host is loopback (no override flag);
//   - migrations are basename-only .sql files inside one pinned directory;
//   - an apply requires a previously recorded plan whose SHA-256 still
//     matches the file content at apply time;
//   - a plan applies at most once; re-applying returns the recorded result;
//   - a file content (sha256) that was already applied cannot be re-planned;
//   - every plan and apply outcome is audited in `dogfood_migration_audit`
//     inside the same staging database the migration touches.
//
// Commands:
//   serve <port> <staging-dsn> [migrations-dir]
//       GET  /health          -> { ok: true }
//       GET  /plans           -> safe audit listing (operator pre-approval review)
//       POST /plan            -> { filename } => { plan_id, filename, sha256, ... }
//       POST /apply-migration -> { plan_id } => apply result (Igris-dispatched)
//
// No third-party dependencies; SQL runs through `psql`. The DSN is never
// logged and never included in any HTTP response.

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sqlQuote(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function isLoopbackDsn(dsn) {
  let parsed;
  try {
    parsed = new URL(dsn);
  } catch (e) {
    return false;
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) return false;
  const host = parsed.hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

// Migration filenames must be plain basenames — no directories, no traversal.
function isSafeMigrationFilename(name) {
  return (
    typeof name === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*\.sql$/.test(name) &&
    !name.includes("..") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

function naiveStatementCount(sql) {
  // Rough reviewer aid, not a parser: strip line comments, count `;`.
  const stripped = sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
  return (stripped.match(/;/g) || []).length;
}

function psql(dsn, args, opts) {
  return execFileSync("psql", [dsn, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

// psql error output may include file paths and SQL fragments (repo-owned SQL,
// not secrets) but never the DSN; still, keep it short and single-line.
function safePsqlError(err) {
  const raw = String((err && (err.stderr || err.message)) || "psql failed");
  return raw.replace(/\s+/g, " ").trim().slice(0, 300);
}

const AUDIT_TABLE = "dogfood_migration_audit";

function ensureAuditTable(dsn) {
  psql(dsn, [
    "-qc",
    `CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE} (
       plan_id text PRIMARY KEY,
       filename text NOT NULL,
       sha256 text NOT NULL,
       bytes integer NOT NULL,
       statement_count integer NOT NULL,
       status text NOT NULL,
       error text,
       planned_at timestamptz NOT NULL DEFAULT now(),
       applied_at timestamptz,
       duration_ms integer
     )`,
  ]);
}

function auditRow(dsn, planId) {
  const out = psql(dsn, [
    "-qtAc",
    `SELECT row_to_json(t) FROM (
       SELECT plan_id, filename, sha256, bytes, statement_count, status, error,
              planned_at, applied_at, duration_ms
       FROM ${AUDIT_TABLE} WHERE plan_id = ${sqlQuote(planId)}
     ) t`,
  ]).trim();
  return out ? JSON.parse(out) : null;
}

function commandServe(portArg, dsn, migrationsDirArg) {
  const port = Number(portArg);
  if (!Number.isInteger(port) || port <= 0) {
    fail("usage: serve <port> <staging-dsn> [migrations-dir]");
  }
  if (!dsn) fail("serve requires a staging database DSN");
  if (!isLoopbackDsn(dsn)) {
    fail(
      "refusing to start: the staging DSN host must be loopback " +
        "(127.0.0.1/localhost). This gateway is staging-only by construction; " +
        "there is no override."
    );
  }
  const migrationsDir = path.resolve(
    migrationsDirArg || path.join(__dirname, "..", "igris-overture", "database", "migrations")
  );
  if (!fs.existsSync(migrationsDir) || !fs.statSync(migrationsDir).isDirectory()) {
    fail(`migrations dir does not exist: ${migrationsDir}`);
  }

  try {
    ensureAuditTable(dsn);
  } catch (e) {
    fail(`could not prepare ${AUDIT_TABLE} in the staging database: ${safePsqlError(e)}`);
  }

  const log = (event) => {
    process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const send = (status, obj) => {
        const payload = Buffer.from(JSON.stringify(obj));
        res.writeHead(status, { "content-type": "application/json", "content-length": payload.length });
        res.end(payload);
      };
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch (e) {
        return send(400, { error: "invalid json body" });
      }

      if (req.method === "GET" && req.url === "/health") {
        return send(200, { ok: true, service: "dogfood-staging-migration-gateway" });
      }

      if (req.method === "GET" && req.url === "/plans") {
        try {
          const out = psql(dsn, [
            "-qtAc",
            `SELECT coalesce(json_agg(t ORDER BY t.planned_at DESC), '[]'::json) FROM (
               SELECT plan_id, filename, sha256, bytes, statement_count, status,
                      error, planned_at, applied_at, duration_ms
               FROM ${AUDIT_TABLE}
             ) t`,
          ]).trim();
          return send(200, { plans: JSON.parse(out || "[]") });
        } catch (e) {
          log({ event: "plans", error: safePsqlError(e) });
          return send(500, { error: "could not list plans" });
        }
      }

      if (req.method === "POST" && req.url === "/plan") {
        const filename = body && body.filename;
        if (!isSafeMigrationFilename(filename)) {
          log({ event: "plan", error: "unsafe filename", filename: String(filename).slice(0, 120) });
          return send(400, { error: "filename must be a plain .sql basename inside the migrations dir" });
        }
        const filePath = path.join(migrationsDir, filename);
        if (path.dirname(filePath) !== migrationsDir || !fs.existsSync(filePath)) {
          log({ event: "plan", error: "not found", filename });
          return send(404, { error: "migration file not found in the migrations dir" });
        }
        const content = fs.readFileSync(filePath);
        const sha256 = sha256Hex(content);
        try {
          const applied = psql(dsn, [
            "-qtAc",
            `SELECT count(*) FROM ${AUDIT_TABLE} WHERE sha256 = ${sqlQuote(sha256)} AND status = 'applied'`,
          ]).trim();
          if (Number(applied) > 0) {
            log({ event: "plan", error: "already applied", filename, sha256 });
            return send(409, { error: "this exact migration content was already applied", filename, sha256 });
          }
          const planId = crypto.randomUUID();
          const statementCount = naiveStatementCount(content.toString("utf8"));
          psql(dsn, [
            "-qc",
            `INSERT INTO ${AUDIT_TABLE} (plan_id, filename, sha256, bytes, statement_count, status)
             VALUES (${sqlQuote(planId)}, ${sqlQuote(filename)}, ${sqlQuote(sha256)},
                     ${content.length}, ${statementCount}, 'planned')`,
          ]);
          log({ event: "plan", plan_id: planId, filename, sha256, bytes: content.length });
          return send(200, {
            plan_id: planId,
            filename,
            sha256,
            bytes: content.length,
            statement_count: statementCount,
            status: "planned",
          });
        } catch (e) {
          log({ event: "plan", error: safePsqlError(e), filename });
          return send(500, { error: "could not record the migration plan" });
        }
      }

      if (req.method === "POST" && req.url === "/apply-migration") {
        // The runtime's http_request tool stringifies bodies; accept both a
        // JSON object and a JSON-encoded string body.
        let payload = body;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch (e) {
            payload = {};
          }
        }
        const planId = payload && payload.plan_id;
        if (typeof planId !== "string" || !/^[0-9a-f-]{36}$/.test(planId)) {
          log({ event: "apply", error: "invalid plan_id" });
          return send(400, { error: "plan_id (uuid) is required; record a plan first via POST /plan" });
        }
        let plan;
        try {
          plan = auditRow(dsn, planId);
        } catch (e) {
          return send(500, { error: "could not read the plan" });
        }
        if (!plan) {
          log({ event: "apply", error: "unknown plan", plan_id: planId });
          return send(404, { error: "unknown plan_id; record a plan first via POST /plan" });
        }
        if (plan.status === "applied") {
          // At-most-once: repeat calls (retries, double dispatch) return the
          // recorded outcome instead of re-executing.
          log({ event: "apply", plan_id: planId, already_applied: true });
          return send(200, { ...plan, already_applied: true });
        }
        if (plan.status !== "planned") {
          log({ event: "apply", error: "plan not applicable", plan_id: planId, status: plan.status });
          return send(409, { error: `plan is not applicable (status=${plan.status})`, plan_id: planId });
        }
        const filePath = path.join(migrationsDir, plan.filename);
        if (!fs.existsSync(filePath)) {
          psql(dsn, ["-qc", `UPDATE ${AUDIT_TABLE} SET status='file_missing' WHERE plan_id=${sqlQuote(planId)}`]);
          return send(409, { error: "migration file disappeared between plan and apply", plan_id: planId });
        }
        const currentSha = sha256Hex(fs.readFileSync(filePath));
        if (currentSha !== plan.sha256) {
          // The reviewed content is not what is on disk anymore — refuse.
          try {
            psql(dsn, [
              "-qc",
              `UPDATE ${AUDIT_TABLE} SET status='checksum_mismatch',
                 error='file content changed between plan and apply'
               WHERE plan_id=${sqlQuote(planId)}`,
            ]);
          } catch (e) { /* audit best-effort; refusal below is what matters */ }
          log({ event: "apply", error: "checksum mismatch", plan_id: planId, planned: plan.sha256, current: currentSha });
          return send(409, {
            error: "checksum_mismatch: migration file changed after it was planned; re-plan and re-review",
            plan_id: planId,
            planned_sha256: plan.sha256,
            current_sha256: currentSha,
          });
        }
        const startedAt = Date.now();
        try {
          // -1 wraps the file in a single transaction: an error rolls the
          // whole migration back (concurrent-index migrations are out of scope).
          psql(dsn, ["-q", "-1", "-f", filePath]);
          const durationMs = Date.now() - startedAt;
          psql(dsn, [
            "-qc",
            `UPDATE ${AUDIT_TABLE} SET status='applied', applied_at=now(), duration_ms=${durationMs}
             WHERE plan_id=${sqlQuote(planId)}`,
          ]);
          log({ event: "apply", plan_id: planId, filename: plan.filename, applied: true, duration_ms: durationMs });
          return send(200, {
            applied: true,
            plan_id: planId,
            filename: plan.filename,
            sha256: plan.sha256,
            statement_count: plan.statement_count,
            duration_ms: durationMs,
          });
        } catch (e) {
          const detail = safePsqlError(e);
          try {
            psql(dsn, [
              "-qc",
              `UPDATE ${AUDIT_TABLE} SET status='failed', error=${sqlQuote(detail)} WHERE plan_id=${sqlQuote(planId)}`,
            ]);
          } catch (e2) { /* audit best-effort */ }
          log({ event: "apply", plan_id: planId, filename: plan.filename, applied: false, error: detail });
          return send(500, { applied: false, plan_id: planId, filename: plan.filename, error: detail });
        }
      }

      send(404, { error: "not found" });
    });
  });

  server.listen(port, "127.0.0.1", () => {
    log({ event: "listening", port, migrations_dir: migrationsDir });
  });
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "serve":
      return commandServe(args[0], args[1], args[2]);
    default:
      fail("usage: dogfood_staging_migration_gateway.js serve <port> <staging-dsn> [migrations-dir]");
  }
}

main();
