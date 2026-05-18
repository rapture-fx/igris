#!/bin/zsh

# Igris CLI + MCP local smoke harness.
#
# Stands up a sustained Overture + Runtime + mock provider + action target
# locally (against the .env Postgres), provisions a dev-only test tenant with
# an `igris_` API key, then exercises the CLI and MCP server end-to-end.
#
# This is intentionally separate from scripts/action_task_v1_proof_demo.sh
# (which proves the *server-side* receipt + chain semantics) — we exercise the
# *client-side* CLI and MCP code paths against the same proven backend.
#
# Local/dev only. Never targets api.igrisinertial.com. No secrets are printed.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
UNIFIED_HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
ACTION_HELPER="$SCRIPT_DIR/action_task_v1_proof_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-cli-mcp-smoke.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"

if [[ -z "${DATABASE_URL:-}" && -z "${POSTGRES_URL:-}" && -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env" >/dev/null 2>&1 || true
  set +a
fi
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

OVERTURE_PORT=8081
RUNTIME_PORT=8080
MOCK_PORT=18090
ACTION_TARGET_PORT=18091
ACTION_TABLE="action_task_events"
DB_WRITE_GATEWAY_URL="http://127.0.0.1:$ACTION_TARGET_PORT/db-write"
PROCESS_URL="http://127.0.0.1:$ACTION_TARGET_PORT/process"

MOCK_PID=""
TARGET_PID=""
RUNTIME_PID=""
OVERTURE_PID=""

# Hardened cleanup: SIGTERM first, then SIGKILL after a short grace period.
# The original proof script's cleanup() only does SIGTERM + wait, which on
# macOS occasionally leaves Overture/Runtime alive (observed). We escalate.
cleanup() {
  # Disable set -e inside the trap so a single failed kill doesn't abort the
  # rest of the cleanup. This was the bug in the previous version: on macOS,
  # spawned binaries can briefly re-parent to init mid-shutdown, making
  # `kill -0 $pid` return non-zero unexpectedly, which under set -e would
  # short-circuit the remainder of cleanup and leave Overture/Runtime alive.
  set +e

  local pids=("$OVERTURE_PID" "$RUNTIME_PID" "$TARGET_PID" "$MOCK_PID")
  for pid in "${pids[@]}"; do
    [[ -z "$pid" ]] && continue
    kill -TERM "$pid" >/dev/null 2>&1
  done

  # Short grace period for graceful shutdown.
  local deadline=$((SECONDS + 3))
  while (( SECONDS < deadline )); do
    local any_alive=0
    for pid in "${pids[@]}"; do
      [[ -z "$pid" ]] && continue
      kill -0 "$pid" >/dev/null 2>&1 && any_alive=1
    done
    (( any_alive == 0 )) && break
    sleep 0.5
  done

  # Force-kill any remaining PIDs.
  for pid in "${pids[@]}"; do
    [[ -z "$pid" ]] && continue
    kill -KILL "$pid" >/dev/null 2>&1
  done

  # Port-based fallback: catch anything that re-parented to init or was
  # spawned by a subshell we don't track. Restricted to the four ports this
  # script binds — never touches anything outside.
  local ports=(8081 8080 18090 18091)
  for port in "${ports[@]}"; do
    local plist
    plist=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [[ -n "$plist" ]]; then
      echo "$plist" | xargs -I{} kill -KILL {} >/dev/null 2>&1
    fi
  done

  # Belt-and-suspenders: any direct children still around.
  pkill -P $$ >/dev/null 2>&1
}
trap cleanup EXIT INT TERM

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing required command: $1" >&2; exit 1; }
}
require_cmd node
require_cmd cargo
require_cmd go
require_cmd curl
require_cmd lsof
require_cmd psql

check_port_free() {
  local port="$1"
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $port is already in use; free it before running the CLI/MCP smoke" >&2
    exit 1
  fi
}
check_port_free "$OVERTURE_PORT"
check_port_free "$RUNTIME_PORT"
check_port_free "$MOCK_PORT"
check_port_free "$ACTION_TARGET_PORT"

if [[ -z "$DB_URL" ]]; then
  echo "DATABASE_URL not set and .env doesn't provide it" >&2
  exit 1
fi

wait_for_http() {
  local url="$1"
  local label="$2"
  for _ in {1..50}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  echo "$label did not become ready: $url" >&2
  exit 1
}

# ── Stage 1: prepare keys, tenant, input file ───────────────────────────────

echo "[1/8] Preparing smoke artifacts in $TMP_DIR"
node "$UNIFIED_HELPER" prepare-checkpoint "$TMP_DIR" > "$TMP_DIR/prepare.json"
node "$UNIFIED_HELPER" proof-access-material > "$TMP_DIR/proof-access.json"

DEVICE_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).device_id)' "$TMP_DIR/meta.json")
RUNTIME_SECRET=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_secret)' "$TMP_DIR/meta.json")
LICENSE_PUBLIC_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).license_public_key_hex)' "$TMP_DIR/meta.json")
OVERTURE_PUBLIC_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).overture_public_key_hex)' "$TMP_DIR/meta.json")
OVERTURE_PRIVATE_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).overture_private_key_hex)' "$TMP_DIR/meta.json")
RUNTIME_PUBLIC_KEY_HEX=$(node "$UNIFIED_HELPER" runtime-public-key "$ROOT_DIR/.igris/runtime-signing-key.ed25519")

SMOKE_TENANT_UUID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenant_uuid)' "$TMP_DIR/proof-access.json")
SMOKE_TENANT_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenant_id)' "$TMP_DIR/proof-access.json")
SMOKE_USER_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).user_id)' "$TMP_DIR/proof-access.json")
SMOKE_USER_EMAIL=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).user_email)' "$TMP_DIR/proof-access.json")
# CRITICAL: the raw API key is held only in this shell variable. We never
# print it, never log it, and the trap-on-exit removes $TMP_DIR contents that
# might contain it. The hash is what lands in Postgres.
SMOKE_RAW_API_KEY=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).raw_api_key)' "$TMP_DIR/proof-access.json")
SMOKE_API_KEY_HASH=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).api_key_hash)' "$TMP_DIR/proof-access.json")
SMOKE_API_KEY_PREFIX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).api_key_prefix)' "$TMP_DIR/proof-access.json")

# Controlled input file under $TMP_DIR (which we whitelist in the runtime
# config). The example file at examples/input/order-batch.json is not used
# directly because the runtime's filesystem tool would have to whitelist the
# repo's examples/ dir — we keep all whitelisted paths inside $TMP_DIR.
INPUT_FILE="$TMP_DIR/smoke-input.json"
cat > "$INPUT_FILE" <<EOF
{ "batch_id": "smoke-batch", "note": "synthetic smoke input — no real data" }
EOF

echo "    tenant_id:        $SMOKE_TENANT_ID"
echo "    api_key_prefix:   $SMOKE_API_KEY_PREFIX (raw key is held in env only, never printed)"
echo "    input_file:       $INPUT_FILE"

# ── Stage 2: build binaries ─────────────────────────────────────────────────

echo "[2/8] Building Runtime binary"
RUNTIME_BIN="$ROOT_DIR/igris-runtime/target/debug/igris-runtime"
if [[ ! -x "$RUNTIME_BIN" ]]; then
  cargo build --manifest-path "$ROOT_DIR/igris-runtime/Cargo.toml" -p igris-server --bin igris-runtime
else
  echo "    Reusing existing Runtime binary"
fi

echo "[3/8] Building Overture binary"
GOCACHE="$TMP_DIR/go-cache" GOPROXY=off GOSUMDB=off GOFLAGS="-mod=readonly -buildvcs=false" \
  go build -o "$TMP_DIR/igris-overture" ./cmd/igris-overture

# ── Stage 3: seed tenant + key into Postgres ────────────────────────────────

echo "[4/8] Applying migration 050 and seeding test tenant + API key"
# Apply the canonical alignment migration. This is idempotent and additive —
# it only adds `tenant_email` (which `session_auth.go` reads) if missing and
# backfills from the legacy `email` column. The smoke harness cannot assume
# the migration has already been applied to the operator's dev DB, so we
# apply it explicitly here.
TENANT_EMAIL_MIGRATION="$ROOT_DIR/igris-overture/database/migrations/050_tenant_email_alignment.sql"
if [[ ! -f "$TENANT_EMAIL_MIGRATION" ]]; then
  echo "missing required migration: $TENANT_EMAIL_MIGRATION" >&2
  exit 1
fi
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$TENANT_EMAIL_MIGRATION" >/dev/null

# Guardrail: fail loudly if the column still doesn't exist after the
# migration ran. This catches the case where a future schema change drops
# the column or the migration silently no-ops on an unexpected schema.
COL_EXISTS=$(psql "$DB_URL" -tAc "SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='tenant_email'" | tr -d '[:space:]')
if [[ "$COL_EXISTS" != "1" ]]; then
  echo "tenants.tenant_email column missing after migration 050 — auth will fail" >&2
  exit 1
fi

psql "$DB_URL" >/dev/null <<SQL
CREATE TABLE IF NOT EXISTS action_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text,
  status text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$SMOKE_USER_ID','Igris CLI/MCP Smoke','$SMOKE_USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO tenants (id, tenant_id, tenant_name, email, tenant_email, status, tier, api_key_hash, api_key_prefix, runtime_limit, capabilities_policy, created_at, updated_at)
VALUES ('$SMOKE_TENANT_UUID'::uuid,'$SMOKE_TENANT_ID','Igris CLI/MCP Smoke','$SMOKE_USER_EMAIL','$SMOKE_USER_EMAIL','active','seed','$SMOKE_API_KEY_HASH','$SMOKE_API_KEY_PREFIX',3,'{"allowed_capabilities":["tools.*"]}'::jsonb,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, email=EXCLUDED.email, tenant_email=EXCLUDED.tenant_email, status='active', tier='seed', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=3, capabilities_policy='{"allowed_capabilities":["tools.*"]}'::jsonb, updated_at=NOW();
SQL

# ── Stage 4: start mock provider + action target ───────────────────────────

echo "[5/8] Starting mock provider and action target"
node "$UNIFIED_HELPER" serve-mock-provider "$MOCK_PORT" > "$LOG_DIR/mock-provider.log" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:$MOCK_PORT/health" "mock provider"

node "$ACTION_HELPER" serve-action-target "$ACTION_TARGET_PORT" "$DB_URL" > "$LOG_DIR/action-target.log" 2>&1 &
TARGET_PID=$!
wait_for_http "http://127.0.0.1:$ACTION_TARGET_PORT/health" "action target server"

# ── Stage 5: start Overture (port 8081) ────────────────────────────────────

echo "[6/8] Starting Overture on :$OVERTURE_PORT"
(
  cd "$ROOT_DIR"
  env \
    PORT=$OVERTURE_PORT \
    PROVIDER_MODE=mock \
    ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION=true \
    ENABLE_MULTI_TENANCY=true \
    REQUIRE_AUTH_FOR_INFERENCE=true \
    ALLOW_INSECURE_DEFAULTS=true \
    JWT_SECRET="$OVERTURE_PRIVATE_KEY_HEX" \
    BETTER_AUTH_SECRET="$OVERTURE_PRIVATE_KEY_HEX" \
    VAULT_MASTER_KEY="${OVERTURE_PRIVATE_KEY_HEX:0:64}" \
    IGRIS_RUNTIME_URL="http://127.0.0.1:$RUNTIME_PORT" \
    IGRIS_RUNTIME_TIMEOUT=10s \
    IGRIS_RUNTIME_SECRET="$RUNTIME_SECRET" \
    IGRIS_OVERTURE_SIGNING_KEY="$OVERTURE_PRIVATE_KEY_HEX" \
    IGRIS_RUNTIME_PUBLIC_KEY="$RUNTIME_PUBLIC_KEY_HEX" \
    "$TMP_DIR/igris-overture"
) > "$LOG_DIR/overture.log" 2>&1 &
OVERTURE_PID=$!
wait_for_http "http://127.0.0.1:$OVERTURE_PORT/healthz" "overture"

# Register runtime + inject tools config with filesystem path whitelisted to
# $TMP_DIR (which contains our input file).
node "$UNIFIED_HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$DEVICE_ID" \
  "cli-mcp-smoke-runtime" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:$RUNTIME_PORT" > "$TMP_DIR/runtime-register.json"

curl -sS -f \
  -H "X-API-Key: $SMOKE_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-register.json" \
  "http://127.0.0.1:$OVERTURE_PORT/api/v1/runtime/register" > "$TMP_DIR/runtime-register-response.json"
RUNTIME_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id || "")' "$TMP_DIR/runtime-register-response.json")
if [[ -z "$RUNTIME_ID" ]]; then
  echo "runtime registration did not return a runtime_id" >&2
  exit 1
fi

node "$ACTION_HELPER" inject-tools-config \
  "$TMP_DIR/runtime-config.json5" \
  "$TMP_DIR" \
  "127.0.0.1" \
  "$DB_WRITE_GATEWAY_URL" \
  "$RUNTIME_ID" > "$TMP_DIR/tools-config.json"

# ── Stage 6: start Runtime (port 8080) ─────────────────────────────────────

echo "[7/8] Starting Runtime on :$RUNTIME_PORT"
(
  cd "$ROOT_DIR"
  env \
    RUNTIME_MOCK_KEY=dummy \
    IGRIS_ALLOW_INSECURE_DEV_MODE=true \
    IGRIS_CONFIG="$TMP_DIR/runtime-config.json5" \
    IGRIS_DEVICE_ID="$DEVICE_ID" \
    IGRIS_OFFLINE_LICENSE_PATH="$TMP_DIR/offline-license.json" \
    IGRIS_LICENSE_OFFLINE_PUBLIC_KEY="$LICENSE_PUBLIC_KEY_HEX" \
    IGRIS_OVERTURE_PUBLIC_KEY="$OVERTURE_PUBLIC_KEY_HEX" \
    IGRIS_RECEIPT_LOG="$TMP_DIR/receipts.jsonl" \
    IGRIS_DB_WRITE_GATEWAY_URL="$DB_WRITE_GATEWAY_URL" \
    IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES="action_task_" \
    RUST_LOG="warn" \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:$RUNTIME_PORT/v1/health" "runtime"

# ── Stage 7: build a runnable task body + run CLI flow ─────────────────────

echo "[8/8] Running CLI + MCP smoke flow"

# Synthesize a task body that points at the whitelisted input file. We do NOT
# use examples/action-task-demo.json directly because its `read_file` path is
# outside $TMP_DIR — runtime's filesystem tool would reject it.
SMOKE_TASK_ID=$(node -e 'process.stdout.write(require("crypto").randomUUID())')
cat > "$TMP_DIR/smoke-task.json" <<EOF
{
  "task_id": "$SMOKE_TASK_ID",
  "task_type": "action_workflow",
  "idempotency_key": "cli-mcp-smoke-$(date +%s)",
  "action_task": {
    "name": "cli-mcp-smoke",
    "steps": [
      { "action": "read_file", "path": "$INPUT_FILE" },
      {
        "action": "http_call",
        "method": "POST",
        "url": "$PROCESS_URL",
        "headers": { "content-type": "application/json" },
        "body": "{\"task_id\":\"$SMOKE_TASK_ID\",\"note\":\"cli-mcp-smoke\"}"
      },
      {
        "action": "db_write",
        "table": "$ACTION_TABLE",
        "record": { "task_id": "$SMOKE_TASK_ID", "status": "processed", "source": "cli-mcp-smoke" }
      }
    ]
  }
}
EOF

# CLI exports — process-local only.
export IGRIS_API_KEY="$SMOKE_RAW_API_KEY"
export IGRIS_API_URL="http://127.0.0.1:$OVERTURE_PORT"

echo ""
echo "    >>> CLI: tasks submit (--watch --verify)"
"$RUNTIME_BIN" tasks submit "$TMP_DIR/smoke-task.json" --watch --verify > "$TMP_DIR/cli-submit.out" 2>&1
cat "$TMP_DIR/cli-submit.out"

# Extract task_id from CLI output for inspect/verify.
CLI_TASK_ID=$(grep -E "^Task accepted: " "$TMP_DIR/cli-submit.out" | head -1 | awk '{print $3}')
if [[ -z "$CLI_TASK_ID" ]]; then
  echo "CLI submit did not print a Task accepted line" >&2
  exit 1
fi

echo ""
echo "    >>> CLI: tasks inspect $CLI_TASK_ID"
"$RUNTIME_BIN" tasks inspect "$CLI_TASK_ID" > "$TMP_DIR/cli-inspect.out" 2>&1
cat "$TMP_DIR/cli-inspect.out"

echo ""
echo "    >>> CLI: tasks verify $CLI_TASK_ID"
"$RUNTIME_BIN" tasks verify "$CLI_TASK_ID" > "$TMP_DIR/cli-verify.out" 2>&1
cat "$TMP_DIR/cli-verify.out"

# ── Assertions on CLI output ───────────────────────────────────────────────

assert_contains() {
  local file="$1" needle="$2" label="$3"
  if ! grep -qF "$needle" "$file"; then
    echo "FAIL: $label — expected to find '$needle' in $file" >&2
    exit 1
  fi
}

assert_contains "$TMP_DIR/cli-submit.out" "Task accepted:" "CLI submit prints task id"
assert_contains "$TMP_DIR/cli-submit.out" "Action committed: read file" "CLI watch reports read_file"
assert_contains "$TMP_DIR/cli-submit.out" "Action committed: call API"  "CLI watch reports http_call"
assert_contains "$TMP_DIR/cli-submit.out" "Action committed: write record" "CLI watch reports db_write"
assert_contains "$TMP_DIR/cli-submit.out" "Receipt signed" "CLI verify reports receipt signed"
assert_contains "$TMP_DIR/cli-submit.out" "Chain valid" "CLI verify reports chain valid"
# Inspect uses friendly action names ("read file", "call API", "write record")
# and emits safe summary fields per action type. Assert on the summary fields
# so we lock in the actual data flow, not the cosmetic names.
assert_contains "$TMP_DIR/cli-inspect.out" "read file" "CLI inspect shows read_file evidence (friendly name)"
assert_contains "$TMP_DIR/cli-inspect.out" "call API"  "CLI inspect shows http_call evidence (friendly name)"
assert_contains "$TMP_DIR/cli-inspect.out" "write record" "CLI inspect shows db_write evidence (friendly name)"
assert_contains "$TMP_DIR/cli-inspect.out" "bytes_read" "CLI inspect shows read_file safe summary"
assert_contains "$TMP_DIR/cli-inspect.out" "status_code" "CLI inspect shows http_call safe summary"
assert_contains "$TMP_DIR/cli-inspect.out" "action_task_events" "CLI inspect shows db_write safe summary"
assert_contains "$TMP_DIR/cli-verify.out" "Receipt signed" "CLI verify shows verified"
assert_contains "$TMP_DIR/cli-verify.out" "Chain valid" "CLI verify shows chain"

# ── MCP smoke ──────────────────────────────────────────────────────────────

echo ""
echo "    >>> MCP: piping JSON-RPC sequence through mcp serve"

# Build a second task body for the MCP path so we don't reuse the CLI task_id.
MCP_TASK_BODY=$(cat <<EOF
{"task_type":"action_workflow","idempotency_key":"cli-mcp-smoke-mcp-$(date +%s)","action_task":{"name":"cli-mcp-smoke-mcp","steps":[{"action":"read_file","path":"$INPUT_FILE"},{"action":"http_call","method":"POST","url":"$PROCESS_URL","headers":{"content-type":"application/json"},"body":"{\"note\":\"mcp\"}"},{"action":"db_write","table":"$ACTION_TABLE","record":{"status":"processed","source":"mcp-smoke"}}]}}
EOF
)

# 1) initialize, 2) tools/list, 3) submit
cat > "$TMP_DIR/mcp-init.jsonl" <<EOF
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"igris_submit_task","arguments":{"task_definition":$MCP_TASK_BODY}}}
EOF

"$RUNTIME_BIN" mcp serve --api-url "http://127.0.0.1:$OVERTURE_PORT" < "$TMP_DIR/mcp-init.jsonl" > "$TMP_DIR/mcp-init.out" 2>"$TMP_DIR/mcp-init.err" &
MCP_PID=$!
# The MCP process is short-lived: it consumes stdin EOF and exits. Wait a
# moment then collect output.
wait "$MCP_PID" 2>/dev/null || true

# Extract the MCP-submitted task_id from the tools/call response.
MCP_TASK_ID=$(node -e '
  const lines = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n").filter(Boolean);
  let out = "";
  for (const l of lines) {
    try {
      const r = JSON.parse(l);
      if (r.id === 3 && r.result && Array.isArray(r.result.content)) {
        const text = r.result.content[0].text || "";
        const parsed = JSON.parse(text);
        if (parsed.task_id) { out = parsed.task_id; break; }
      }
    } catch (e) {}
  }
  process.stdout.write(out);
' "$TMP_DIR/mcp-init.out")

if [[ -z "$MCP_TASK_ID" ]]; then
  echo "MCP submit did not return a task_id" >&2
  cat "$TMP_DIR/mcp-init.out" >&2
  exit 1
fi

# 4) wait briefly for task to complete, then status/evidence/verify/export.
# We poll via the CLI's inspect to know when the task is terminal.
for _ in {1..60}; do
  status=$("$RUNTIME_BIN" tasks inspect "$MCP_TASK_ID" 2>/dev/null | awk '/^  status:/ {print $2}')
  if [[ "$status" == "completed" || "$status" == "failed" || "$status" == "canceled" ]]; then
    break
  fi
  sleep 1
done

cat > "$TMP_DIR/mcp-followup.jsonl" <<EOF
{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"igris_get_task_status","arguments":{"task_id":"$MCP_TASK_ID"}}}
{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"igris_get_action_evidence","arguments":{"task_id":"$MCP_TASK_ID"}}}
{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"igris_verify_task","arguments":{"task_id":"$MCP_TASK_ID"}}}
{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"igris_export_evidence","arguments":{"task_id":"$MCP_TASK_ID","format":"markdown"}}}
EOF

"$RUNTIME_BIN" mcp serve --api-url "http://127.0.0.1:$OVERTURE_PORT" < "$TMP_DIR/mcp-followup.jsonl" > "$TMP_DIR/mcp-followup.out" 2>>"$TMP_DIR/mcp-init.err" &
MCP_PID=$!
wait "$MCP_PID" 2>/dev/null || true

# ── Assertions on MCP output ───────────────────────────────────────────────

# initialize must return protocolVersion
node -e '
  const lines = require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean);
  const init = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).find(r => r.id === 1);
  if (!init || !init.result || init.result.protocolVersion !== "2024-11-05") {
    console.error("FAIL: MCP initialize did not return protocolVersion 2024-11-05");
    process.exit(1);
  }
' "$TMP_DIR/mcp-init.out"

# tools/list must return 5 tools
node -e '
  const lines = require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean);
  const tl = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).find(r => r.id === 2);
  if (!tl || !tl.result || !Array.isArray(tl.result.tools) || tl.result.tools.length !== 5) {
    console.error("FAIL: MCP tools/list did not return 5 tools");
    process.exit(1);
  }
' "$TMP_DIR/mcp-init.out"

# verify the MCP verify call returned verified=true (chain may be checked)
node -e '
  const lines = require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean);
  const v = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).find(r => r.id === 12);
  if (!v || !v.result || !Array.isArray(v.result.content)) { console.error("FAIL: MCP verify missing"); process.exit(1); }
  const parsed = JSON.parse(v.result.content[0].text);
  if (parsed.verified !== true) {
    console.error("FAIL: MCP verify returned verified=false:", JSON.stringify(parsed));
    process.exit(1);
  }
' "$TMP_DIR/mcp-followup.out"

# export markdown must contain task heading + verified
node -e '
  const lines = require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean);
  const e = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).find(r => r.id === 13);
  if (!e || !e.result || !Array.isArray(e.result.content)) { console.error("FAIL: MCP export missing"); process.exit(1); }
  const md = e.result.content[0].text;
  if (!md.includes("# Task ") || !md.includes("Verified:")) {
    console.error("FAIL: MCP export markdown missing expected markers"); process.exit(1);
  }
' "$TMP_DIR/mcp-followup.out"

# Defense in depth: assert no IGRIS_API_KEY value appears in any captured
# stdout/stderr. The variable holds the raw key; if anything echoes it, this
# fails loud.
if grep -F "$SMOKE_RAW_API_KEY" "$TMP_DIR"/cli-*.out "$TMP_DIR"/mcp-*.out "$TMP_DIR"/mcp-*.err 2>/dev/null; then
  echo "FAIL: raw API key appeared in captured output" >&2
  exit 1
fi
unset SMOKE_RAW_API_KEY IGRIS_API_KEY

echo ""
echo "    >>> All assertions passed"
echo ""
echo "CLI/MCP smoke succeeded."
echo ""
echo "  CLI task_id:        $CLI_TASK_ID"
echo "  MCP task_id:        $MCP_TASK_ID"
echo "  tenant_id:          $SMOKE_TENANT_ID  (test-only, in local Postgres)"
echo "  artifacts:          $TMP_DIR"
echo ""
echo "  (Spawned Overture + Runtime + mock + target will be cleaned up on exit.)"
