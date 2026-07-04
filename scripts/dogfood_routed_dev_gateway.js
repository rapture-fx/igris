#!/usr/bin/env node
//
// Local Igris-routed development gateway.
//
// This is the localhost-only execution target for:
//   - repo.run_tests
//   - repo.push_branch
//   - repo.open_pr
//
// It deliberately does not expose arbitrary shell execution. Each endpoint maps
// to fixed code below, returns only safe metadata, and defaults externally
// visible operations to dry-run.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const DEFAULT_AUTH_HEADER = "x-igris-dogfood-secret";
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_DURATION_MS = 120_000;

const ACTIONS = {
  "/repo/run-tests": "repo.run_tests",
  "/repo/push-branch": "repo.push_branch",
  "/repo/open-pr": "repo.open_pr",
};
const actionEvents = [];
const actionCounts = {};

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeBool(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return defaultValue;
}

function safeRemoteName(value) {
  const name = String(value || "origin").trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(name)) {
    throw Object.assign(new Error("remote_name must be a simple git remote name"), { statusCode: 400 });
  }
  return name;
}

function parseBody(raw) {
  let parsed = JSON.parse(raw || "{}");
  if (typeof parsed === "string") {
    parsed = JSON.parse(parsed || "{}");
  }
  return parsed && typeof parsed === "object" ? parsed : {};
}

function isLoopbackAddress(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function runGit(repoDir, args) {
  return execFileSync("git", args, {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
}

function repoState(repoDir) {
  const branch = runGit(repoDir, ["branch", "--show-current"]).trim();
  const commitSha = runGit(repoDir, ["rev-parse", "HEAD"]).trim();
  const status = runGit(repoDir, ["status", "--porcelain=v1"]);
  const dirty = status.trim() !== "";
  return {
    branch,
    commit_sha: commitSha,
    dirty,
    dirty_status: dirty ? "dirty" : "clean",
    diff_stat_digest: sha256Hex(status),
    diff_stat_bytes: Buffer.byteLength(status),
  };
}

function ensureUsableBranch(state) {
  if (!state.branch) {
    throw Object.assign(new Error("refusing detached HEAD"), { statusCode: 409 });
  }
  if (state.branch === "main" || state.branch === "master") {
    throw Object.assign(new Error("refusing to operate on main/master"), { statusCode: 409 });
  }
}

function safeCommandResult(label, startedAt, exitCode, output) {
  const durationMs = Date.now() - startedAt;
  const text = String(output || "");
  return {
    command_label: label,
    exit_code: exitCode,
    duration_ms: durationMs,
    output_digest: sha256Hex(text),
    output_bytes: Buffer.byteLength(text),
    output_redacted: true,
  };
}

function runTests(repoDir) {
  const startedAt = Date.now();
  const label = "node scripts/dogfood_routed_dev_gateway.js self-test";
  try {
    const output = execFileSync(process.execPath, [__filename, "self-test"], {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: MAX_DURATION_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    });
    return {
      action: "repo.run_tests",
      ok: true,
      ...repoState(repoDir),
      ...safeCommandResult(label, startedAt, 0, output),
    };
  } catch (err) {
    const output = String((err && (err.stdout || err.stderr || err.message)) || "test command failed");
    return {
      action: "repo.run_tests",
      ok: false,
      ...repoState(repoDir),
      ...safeCommandResult(label, startedAt, Number(err.status || 1), output),
    };
  }
}

function pushBranch(repoDir, input) {
  const startedAt = Date.now();
  const dryRun = safeBool(input.dry_run, true);
  const allowDirtyDryRun = safeBool(input.allow_dirty_dry_run, false);
  const force = safeBool(input.force, false);
  const remoteName = safeRemoteName(input.remote_name);
  const state = repoState(repoDir);
  ensureUsableBranch(state);
  if (force) {
    throw Object.assign(new Error("force push is refused"), { statusCode: 409, safe: state });
  }
  if (state.dirty && !(dryRun && allowDirtyDryRun)) {
    throw Object.assign(new Error("dirty working tree is refused"), { statusCode: 409, safe: state });
  }
  try {
    runGit(repoDir, ["remote", "get-url", remoteName]);
  } catch (_) {
    throw Object.assign(new Error("target remote is not configured"), { statusCode: 409, safe: state });
  }
  if (dryRun) {
    return {
      action: "repo.push_branch",
      ok: true,
      dry_run: true,
      would_push: true,
      remote_name: remoteName,
      target_ref: state.branch,
      duration_ms: Date.now() - startedAt,
      ...state,
    };
  }
  if (process.env.IGRIS_DOGFOOD_ALLOW_REAL_PUSH !== "true") {
    throw Object.assign(new Error("real push is disabled; rerun in dry_run mode"), { statusCode: 409, safe: state });
  }
  const output = runGit(repoDir, ["push", remoteName, `HEAD:${state.branch}`]);
  return {
    action: "repo.push_branch",
    ok: true,
    dry_run: false,
    remote_name: remoteName,
    target_ref: state.branch,
    ...state,
    ...safeCommandResult("git push <remote> HEAD:<current-branch>", startedAt, 0, output),
  };
}

function openPR(repoDir, input) {
  const startedAt = Date.now();
  const dryRun = safeBool(input.dry_run, true);
  const baseBranch = String(input.base_branch || "main").trim();
  const state = repoState(repoDir);
  ensureUsableBranch(state);
  if (baseBranch !== "main") {
    throw Object.assign(new Error("base_branch must be main"), { statusCode: 400, safe: state });
  }
  if (!dryRun) {
    throw Object.assign(new Error("real PR creation is not enabled in this gateway; use dry_run=true"), { statusCode: 409, safe: state });
  }
  const title = String(input.title || `Dogfood routed development: ${state.branch}`).slice(0, 160);
  return {
    action: "repo.open_pr",
    ok: true,
    dry_run: true,
    would_open_pr: true,
    base_branch: baseBranch,
    head_branch: state.branch,
    title_digest: sha256Hex(title),
    duration_ms: Date.now() - startedAt,
    ...state,
  };
}

function safeError(err) {
  const safe = err && err.safe && typeof err.safe === "object" ? err.safe : {};
  return {
    ok: false,
    error: String((err && err.message) || "gateway error").replace(/\s+/g, " ").slice(0, 240),
    ...safe,
  };
}

function recordActionEvent(action, result) {
  actionCounts[action] = (actionCounts[action] || 0) + 1;
  actionEvents.push({
    action,
    ok: result.ok === true,
    dry_run: result.dry_run === true,
    branch: result.branch || "",
    commit_sha: result.commit_sha || "",
    dirty_status: result.dirty_status || "",
    status: result.ok === true ? "accepted" : "refused",
    at: new Date().toISOString(),
  });
  if (actionEvents.length > 100) {
    actionEvents.shift();
  }
}

function authorize(req, secret) {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return false;
  }
  const headerName = String(process.env.IGRIS_DOGFOOD_DEV_GATEWAY_AUTH_HEADER || DEFAULT_AUTH_HEADER).toLowerCase();
  const provided = req.headers[headerName];
  if (typeof provided !== "string" || provided.length === 0) {
    return false;
  }
  const providedBuf = Buffer.from(provided);
  const secretBuf = Buffer.from(secret);
  return providedBuf.length === secretBuf.length && crypto.timingSafeEqual(providedBuf, secretBuf);
}

function serve(portArg, repoDirArg) {
  const port = Number(portArg);
  if (!Number.isInteger(port) || port <= 0) {
    fail("usage: serve <port> <repo-dir>");
  }
  const repoDir = path.resolve(repoDirArg || process.cwd());
  if (!fs.existsSync(path.join(repoDir, ".git"))) {
    fail(`repo-dir is not a git checkout: ${repoDir}`);
  }
  const secret = process.env.IGRIS_DOGFOOD_DEV_GATEWAY_SECRET || "";
  if (secret.length < 20) {
    fail("IGRIS_DOGFOOD_DEV_GATEWAY_SECRET must be set to a local random secret (20+ chars)");
  }

  const log = (event) => {
    process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const send = (status, obj) => {
        const payload = Buffer.from(JSON.stringify(obj));
        res.writeHead(status, {
          "content-type": "application/json",
          "content-length": payload.length,
          "x-request-id": crypto.randomUUID(),
        });
        res.end(payload);
      };

      if (req.method === "GET" && req.url === "/health") {
        return send(200, { ok: true, service: "dogfood-routed-dev-gateway" });
      }
      if (req.method === "GET" && req.url === "/events") {
        if (!authorize(req, secret)) {
          return send(401, { ok: false, error: "unauthorized" });
        }
        return send(200, { ok: true, counts: actionCounts, events: actionEvents });
      }
      if (req.method !== "POST" || !Object.prototype.hasOwnProperty.call(ACTIONS, req.url)) {
        return send(404, { ok: false, error: "not found" });
      }
      if (!authorize(req, secret)) {
        log({ event: "auth_refused", path: req.url, remote: req.socket.remoteAddress });
        return send(401, { ok: false, error: "unauthorized" });
      }

      let input = {};
      try {
        input = parseBody(Buffer.concat(chunks).toString("utf8"));
      } catch (_) {
        return send(400, { ok: false, error: "invalid json body" });
      }
      const expectedAction = ACTIONS[req.url];
      const requestedAction = String(input.action_name || input.action || expectedAction);
      if (requestedAction !== expectedAction) {
        return send(400, { ok: false, error: "action name does not match endpoint" });
      }

      try {
        let result;
        if (expectedAction === "repo.run_tests") {
          result = runTests(repoDir);
        } else if (expectedAction === "repo.push_branch") {
          result = pushBranch(repoDir, input);
        } else {
          result = openPR(repoDir, input);
        }
        const status = result.ok ? 200 : 500;
        log({
          event: "action_result",
          action: expectedAction,
          ok: result.ok,
          dry_run: result.dry_run,
          branch: result.branch,
          commit_sha: result.commit_sha,
          dirty_status: result.dirty_status,
          duration_ms: result.duration_ms,
        });
        recordActionEvent(expectedAction, result);
        return send(status, result);
      } catch (err) {
        const status = Number(err.statusCode || 500);
        const body = { action: expectedAction, ...safeError(err) };
        log({
          event: "action_refused",
          action: expectedAction,
          status,
          branch: body.branch,
          commit_sha: body.commit_sha,
          dirty_status: body.dirty_status,
          error: body.error,
        });
        recordActionEvent(expectedAction, body);
        return send(status, body);
      }
    });
  });

  server.listen(port, "127.0.0.1", () => {
    log({ event: "listening", port, repo_dir_label: path.basename(repoDir) });
  });
}

function selfTest() {
  if (!isLoopbackAddress("127.0.0.1") || !isLoopbackAddress("::1") || isLoopbackAddress("10.0.0.5")) {
    fail("loopback address guard failed");
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "igris-routed-dev-gateway-test."));
  try {
    execFileSync("git", ["init", "-q"], { cwd: tmp });
    execFileSync("git", ["config", "user.email", "dogfood@example.test"], { cwd: tmp });
    execFileSync("git", ["config", "user.name", "Dogfood Smoke"], { cwd: tmp });
    fs.writeFileSync(path.join(tmp, "README.md"), "test\n");
    execFileSync("git", ["add", "README.md"], { cwd: tmp });
    execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: tmp });
    execFileSync("git", ["checkout", "-q", "-b", "dogfood/test"], { cwd: tmp });
    execFileSync("git", ["remote", "add", "origin", "https://example.invalid/repo.git"], { cwd: tmp });
    const clean = pushBranch(tmp, { dry_run: true, remote_name: "origin" });
    if (!clean.dry_run || clean.branch !== "dogfood/test" || clean.dirty) fail("push dry-run clean check failed");
    fs.writeFileSync(path.join(tmp, "dirty.txt"), "dirty\n");
    let refused = false;
    try {
      pushBranch(tmp, { dry_run: true, remote_name: "origin" });
    } catch (err) {
      refused = /dirty working tree/.test(err.message);
    }
    if (!refused) fail("dirty tree refusal failed");
    const allowed = pushBranch(tmp, { dry_run: true, allow_dirty_dry_run: true, remote_name: "origin" });
    if (!allowed.dry_run || !allowed.dirty) fail("explicit dirty dry-run allowance failed");
    fs.rmSync(path.join(tmp, "dirty.txt"), { force: true });
    refused = false;
    try {
      pushBranch(tmp, { dry_run: true, force: true, remote_name: "origin" });
    } catch (err) {
      refused = /force push is refused/.test(err.message);
    }
    if (!refused) fail("force push refusal failed");
    execFileSync("git", ["checkout", "-q", "-B", "main"], { cwd: tmp });
    refused = false;
    try {
      pushBranch(tmp, { dry_run: true, remote_name: "origin" });
    } catch (err) {
      refused = /main\/master/.test(err.message);
    }
    if (!refused) fail("main branch refusal failed");
    execFileSync("git", ["checkout", "-q", "-B", "master"], { cwd: tmp });
    refused = false;
    try {
      pushBranch(tmp, { dry_run: true, remote_name: "origin" });
    } catch (err) {
      refused = /main\/master/.test(err.message);
    }
    if (!refused) fail("master branch refusal failed");
    execFileSync("git", ["checkout", "-q", "-B", "dogfood/test"], { cwd: tmp });
    execFileSync("git", ["checkout", "-q", "--detach"], { cwd: tmp });
    refused = false;
    try {
      pushBranch(tmp, { dry_run: true, remote_name: "origin" });
    } catch (err) {
      refused = /detached HEAD/.test(err.message);
    }
    if (!refused) fail("detached HEAD refusal failed");
    execFileSync("git", ["checkout", "-q", "dogfood/test"], { cwd: tmp });
    const pr = openPR(tmp, { dry_run: true, base_branch: "main" });
    if (!pr.would_open_pr || pr.base_branch !== "main") fail("PR dry-run check failed");
    refused = false;
    try {
      openPR(tmp, { dry_run: false, base_branch: "main" });
    } catch (err) {
      refused = /real PR creation is not enabled/.test(err.message);
    }
    if (!refused) fail("real PR refusal failed");
    process.stdout.write("dogfood routed development gateway self-test passed\n");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "serve":
      return serve(args[0], args[1]);
    case "self-test":
      return selfTest();
    default:
      fail("usage: dogfood_routed_dev_gateway.js serve <port> <repo-dir> | self-test");
  }
}

main();
