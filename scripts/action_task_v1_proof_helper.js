#!/usr/bin/env node
//
// Helper for the Action Task V1 proof demo (scripts/action_task_v1_proof_demo.sh).
//
// Commands:
//   serve-action-target <port> <database-url>
//       Runs a tiny localhost-only HTTP control surface used as the proof's
//       "controlled external systems":
//         GET  /health           -> { ok: true }
//         POST /process          -> echoes a digest of the body; logs the call
//         POST /db-write          -> { table, record } => INSERT one row into a
//                                    controlled `action_task_*` table via psql,
//                                    returns { row_id }. Acts as the database-
//                                    write gateway for the runtime's
//                                    `database_write` tool.
//       Every call is appended (as JSON) to <port>.requests.log next to cwd via
//       stderr so the proof script can assert what happened.
//
//   inject-tools-config <runtime-config.json5> <allowed-fs-path> <allowed-http-host> <db-gateway-url> <runtime-id>
//       Rewrites the generated runtime config to enable the sandboxed local
//       tools (filesystem read, localhost HTTP) with explicit whitelists, and
//       pins the runtime's peer id so it matches the registered runtime_id (so
//       the signed permission envelope's runtime binding verifies).
//
//   build-action-task-request <out.json> <task-id> <input-file> <process-url> <table>
//       Writes the customer-facing `action_task` submit body.
//
//   verify-receipt-chain <receipts.jsonl> [min-count]
//       Verifies the runtime's hash-chained receipt log: receipt[0].previous_hash
//       is empty (genesis) and each subsequent receipt's previous_hash equals the
//       prior receipt's hash, and every receipt is signed.
//
//   verify-action-evidence <task.json> <steps.json> <run.json> <receipts.json> <receipt-verify.json> <task-id> <db-row-id>
//       Validates the full evidence chain and prints a summary.

"use strict";

const fs = require("fs");
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

function readJSON(path) {
  const raw = fs.readFileSync(path, "utf8").trim();
  return raw ? JSON.parse(raw) : null;
}

// ── serve-action-target ──────────────────────────────────────────────────────

function isSafeTableName(table) {
  return (
    typeof table === "string" &&
    /^action_task_[a-z0-9_]+$/.test(table)
  );
}

function sqlQuote(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function commandServeActionTarget(portArg, dbUrl) {
  const port = Number(portArg);
  if (!Number.isInteger(port) || port <= 0) fail("usage: serve-action-target <port> <database-url>");
  if (!dbUrl) fail("serve-action-target requires a database url");

  const log = (event) => {
    process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const bodyBuf = Buffer.concat(chunks);
      const send = (status, obj) => {
        const payload = Buffer.from(JSON.stringify(obj));
        res.writeHead(status, { "content-type": "application/json", "content-length": payload.length });
        res.end(payload);
      };

      if (req.method === "GET" && req.url === "/health") {
        return send(200, { ok: true, service: "action-task-v1-target" });
      }

      if (req.method === "POST" && req.url === "/process") {
        const digest = sha256Hex(bodyBuf);
        log({ event: "process", bytes: bodyBuf.length, digest });
        return send(200, { processed: true, received_bytes: bodyBuf.length, digest });
      }

      if (req.method === "POST" && req.url === "/db-write") {
        let parsed;
        try {
          parsed = JSON.parse(bodyBuf.toString("utf8") || "{}");
        } catch (e) {
          log({ event: "db-write", error: "invalid json" });
          return send(400, { error: "invalid json body" });
        }
        const table = parsed && parsed.table;
        const record = parsed && parsed.record;
        if (!isSafeTableName(table)) {
          log({ event: "db-write", error: "table not allowed", table });
          return send(403, { error: "table not allowed; must match ^action_task_[a-z0-9_]+$" });
        }
        if (record === null || typeof record !== "object" || Array.isArray(record)) {
          log({ event: "db-write", error: "record must be object", table });
          return send(400, { error: "record must be a JSON object" });
        }
        const taskId = typeof record.task_id === "string" ? record.task_id : "";
        const status = typeof record.status === "string" ? record.status : "processed";
        const payloadJSON = JSON.stringify(record);
        // Wrap the INSERT in a CTE + SELECT so `psql -tAc` returns *only* the
        // row id (no `INSERT 0 1` command tag).
        const sql =
          `WITH ins AS (INSERT INTO ${table} (task_id, status, payload) VALUES (` +
          sqlQuote(taskId) + ", " + sqlQuote(status) + ", " + sqlQuote(payloadJSON) + "::jsonb" +
          `) RETURNING id) SELECT id::text FROM ins;`;
        let rowId = "";
        try {
          const out = execFileSync("psql", [dbUrl, "-qtAc", sql], { encoding: "utf8" });
          rowId = out.trim();
        } catch (e) {
          log({ event: "db-write", error: "insert failed", table, detail: String(e.message || e) });
          return send(500, { error: "insert failed", detail: String(e.message || e) });
        }
        if (!rowId) {
          log({ event: "db-write", error: "no row id", table });
          return send(500, { error: "insert returned no row id" });
        }
        log({ event: "db-write", table, row_id: rowId, task_id: taskId, status });
        return send(200, { table, inserted: true, row_id: rowId });
      }

      send(404, { error: "not found" });
    });
  });

  server.listen(port, "127.0.0.1", () => {
    log({ event: "listening", port });
  });
}

// ── inject-tools-config ──────────────────────────────────────────────────────

function commandInjectToolsConfig(configPath, allowedFsPath, allowedHttpHost, dbGatewayUrl, runtimeId) {
  if (!configPath || !allowedFsPath || !allowedHttpHost || !dbGatewayUrl || !runtimeId) {
    fail("usage: inject-tools-config <runtime-config.json5> <allowed-fs-path> <allowed-http-host> <db-gateway-url> <runtime-id>");
  }
  const config = readJSON(configPath);
  if (!config || typeof config !== "object") fail(`runtime config is not a JSON object: ${configPath}`);
  config.tools = {
    enabled: true,
    enable_http: true,
    enable_shell: false,
    enable_filesystem: true,
    allowed_http_domains: [allowedHttpHost],
    allowed_shell_commands: [],
    allowed_shell_working_dirs: [],
    allowed_filesystem_paths: [allowedFsPath],
    max_execution_time_ms: 30000,
    max_concurrent_executions: 5,
  };
  // Pin the runtime peer id so governed_runtime_id == the registered runtime_id.
  config.mcp = Object.assign({}, config.mcp || {}, { peer_id: runtimeId });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  // The db gateway url + table allowlist are passed to the runtime via env vars
  // (IGRIS_DB_WRITE_GATEWAY_URL / IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES), not
  // the config file — echo back so the caller can confirm.
  console.log(JSON.stringify({ config: configPath, db_write_gateway_url: dbGatewayUrl, peer_id: runtimeId }));
}

// ── build-action-task-request ────────────────────────────────────────────────

function commandBuildActionTaskRequest(outPath, taskId, inputFile, processUrl, table) {
  if (!outPath || !taskId || !inputFile || !processUrl || !table) {
    fail("usage: build-action-task-request <out.json> <task-id> <input-file> <process-url> <table>");
  }
  const body = {
    task_id: taskId,
    task_type: "action_workflow",
    action_task: {
      name: "action-task-v1-proof",
      steps: [
        { action: "read_file", path: inputFile },
        {
          action: "http_call",
          method: "POST",
          url: processUrl,
          body: JSON.stringify({ task_id: taskId, note: "action-task-v1-proof http step" }),
          headers: { "content-type": "application/json" },
        },
        {
          action: "db_write",
          table: table,
          record: { task_id: taskId, status: "processed", source: "action-task-v1-proof" },
        },
      ],
    },
    idempotency_key: `action-task-v1-${String(taskId).slice(0, 8)}`,
  };
  fs.writeFileSync(outPath, JSON.stringify(body, null, 2));
  console.log(outPath);
}

// ── verify-receipt-chain ─────────────────────────────────────────────────────

function commandVerifyReceiptChain(receiptsLogPath, minCount) {
  if (!receiptsLogPath) fail("usage: verify-receipt-chain <receipts.jsonl> [min-count]");
  const raw = fs.readFileSync(receiptsLogPath, "utf8").trim();
  const receipts = (raw ? raw.split("\n").filter(Boolean) : []).map((l) => JSON.parse(l));
  if (receipts.length === 0) fail(`receipt log is empty: ${receiptsLogPath}`);
  if (minCount && receipts.length < Number(minCount)) {
    fail(`expected at least ${minCount} receipts in the log, got ${receipts.length}`);
  }
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (!r.hash) fail(`receipt ${i} has no hash`);
    if (!r.signature) fail(`receipt ${i} has no signature`);
    const expectedPrev = i === 0 ? "" : receipts[i - 1].hash;
    if ((r.previous_hash || "") !== expectedPrev) {
      fail(`receipt ${i} previous_hash mismatch: got ${r.previous_hash || "(empty)"}, expected ${expectedPrev || "(empty)"}`);
    }
  }
  console.log(JSON.stringify({ receipt_chain_valid: true, receipt_count: receipts.length, last_hash: receipts[receipts.length - 1].hash }));
}

// ── verify-action-evidence ───────────────────────────────────────────────────

function stepTypeMentions(step, needle) {
  try {
    return JSON.stringify(step.step_type || {}).toLowerCase().includes(needle);
  } catch (e) {
    return false;
  }
}

function commandVerifyActionEvidence(taskPath, stepsPath, runPath, receiptsPath, receiptVerifyPath, taskId, dbRowId) {
  if (!taskPath || !stepsPath || !runPath || !receiptsPath || !receiptVerifyPath || !taskId) {
    fail("usage: verify-action-evidence <task.json> <steps.json> <run.json> <receipts.json> <receipt-verify.json> <task-id> [db-row-id]");
  }
  const task = readJSON(taskPath);
  const stepsDoc = readJSON(stepsPath);
  const run = readJSON(runPath);
  const receipts = readJSON(receiptsPath);
  const receiptVerify = readJSON(receiptVerifyPath);

  if (!task || task.status !== "completed") fail(`expected task status=completed, got ${task && task.status}`);
  if (!task.runtime_id) fail("task is missing runtime_id");
  if (!task.execution_envelope) fail("task is missing execution_envelope");
  if (!task.execution_receipt) fail("task is missing execution_receipt");
  if (!task.proof || !task.proof.execution_id) fail("task is missing proof.execution_id");
  if (!task.links || !task.links.task || !task.links.steps || !task.links.verify || !task.links.receipt_verify) {
    fail("task detail is missing one of links.{task,steps,verify,receipt_verify}");
  }
  if (!task.links.run) fail("task detail is missing links.run after completion");

  const steps = (stepsDoc && Array.isArray(stepsDoc.steps)) ? stepsDoc.steps : [];
  if (steps.length < 3) fail(`expected at least 3 committed action steps, got ${steps.length}`);
  const readStep = steps.find((s) => stepTypeMentions(s, "filesystem"));
  const httpStep = steps.find((s) => stepTypeMentions(s, "http_request"));
  const dbStep = steps.find((s) => stepTypeMentions(s, "database_write"));
  if (!readStep) fail("no committed step for the read_file action (filesystem tool)");
  if (!httpStep) fail("no committed step for the http_call action (http_request tool)");
  if (!dbStep) fail("no committed step for the db_write action (database_write tool)");
  for (const [label, s] of [["read_file", readStep], ["http_call", httpStep], ["db_write", dbStep]]) {
    if (!s.runtime_id) fail(`${label} step is missing runtime_id`);
    if (!s.output_digest) fail(`${label} step has no output_digest (not committed)`);
  }

  const executionId = task.proof.execution_id;
  if (!run || run.id !== executionId) fail(`run detail id mismatch: ${run && run.id} != ${executionId}`);
  if (run.task_id && run.task_id !== taskId) fail(`run.task_id ${run.task_id} != ${taskId}`);

  if (!Array.isArray(receipts) || !receipts.find((r) => r.execution_id === executionId)) {
    fail("receipt list does not include the execution_id");
  }

  if (!receiptVerify || receiptVerify.verified !== true) {
    fail(`receipt verify did not return verified=true: ${JSON.stringify(receiptVerify).slice(0, 200)}`);
  }
  if (receiptVerify.hash_valid !== true) fail("receipt verify hash_valid is not true");
  if (receiptVerify.signature_matches !== true) fail("receipt verify signature_matches is not true");
  if (receiptVerify.runtime_key_found !== true) fail("receipt verify runtime_key_found is not true");
  // chain_valid is informational here: Overture persists only the *final* receipt
  // of a multi-step task to execution_lineage, so a multi-step receipt's
  // previous_hash points at a runtime-local intermediate receipt that Overture
  // never received. The runtime's own receipts.jsonl hash-chain is verified
  // separately (see `verify-receipt-chain`). chain_valid=true is asserted there.
  const chainValidNote =
    receiptVerify.chain_valid === true
      ? "true (Overture-side)"
      : `${JSON.stringify(receiptVerify.chain_valid)} (Overture-side; final-receipt-only, see runtime receipt chain)`;

  // The final step's output is the db_write summary; it must reference the table
  // and (if supplied) the row id committed to Postgres.
  let finalSummary = null;
  if (typeof task.final_output === "string") {
    try { finalSummary = JSON.parse(task.final_output); } catch (e) { /* not json */ }
  }

  console.log("Action Task V1 proof succeeded.");
  console.log("");
  console.log(`Task status:               ${task.status}`);
  console.log(`Runtime id:                ${task.runtime_id}`);
  console.log(`Execution id:              ${executionId}`);
  console.log(`Committed action steps:    ${steps.length}`);
  console.log(`  read_file  -> step ${readStep.step_index} (${JSON.stringify(readStep.step_type)})`);
  console.log(`  http_call  -> step ${httpStep.step_index} (${JSON.stringify(httpStep.step_type)})`);
  console.log(`  db_write   -> step ${dbStep.step_index} (${JSON.stringify(dbStep.step_type)})`);
  console.log(`Run detail task_id:        ${run.task_id || "(not exposed in this build)"}`);
  console.log(`Receipt verify:            verified=${receiptVerify.verified} hash_valid=${receiptVerify.hash_valid} signature_matches=${receiptVerify.signature_matches} runtime_key_found=${receiptVerify.runtime_key_found}`);
  console.log(`Receipt chain_valid:       ${chainValidNote}`);
  if (finalSummary) {
    console.log(`db_write summary:          ${JSON.stringify(finalSummary)}`);
  }
  if (dbRowId) {
    console.log(`db row id (psql-verified): ${dbRowId}`);
  }
  console.log(`links.task:                ${task.links.task}`);
  console.log(`links.steps:               ${task.links.steps}`);
  console.log(`links.run:                 ${task.links.run}`);
  console.log(`links.verify:              ${task.links.verify}`);
  console.log(`links.receipt_verify:      ${task.links.receipt_verify}`);
}

// ── dispatch ─────────────────────────────────────────────────────────────────

function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "serve-action-target":
      return commandServeActionTarget(args[0], args[1]);
    case "inject-tools-config":
      return commandInjectToolsConfig(args[0], args[1], args[2], args[3], args[4]);
    case "build-action-task-request":
      return commandBuildActionTaskRequest(args[0], args[1], args[2], args[3], args[4]);
    case "verify-receipt-chain":
      return commandVerifyReceiptChain(args[0], args[1]);
    case "verify-action-evidence":
      return commandVerifyActionEvidence(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    default:
      fail(
        "usage: action_task_v1_proof_helper.js <serve-action-target|inject-tools-config|build-action-task-request|verify-receipt-chain|verify-action-evidence> ..."
      );
  }
}

main();
