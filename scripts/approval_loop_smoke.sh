#!/bin/zsh

# Approval Loop Smoke
#
# Proves the durable human-approval loop end to end against a fully local
# stack, using only the supported product surfaces:
#
#   1. Starter Action Pack installs and registers `demo.needs_approval`.
#   2. An agent triggers it through the real MCP gateway (POST /v1/mcp,
#      `call_action`) and the run pauses in `approval_required`.
#   3. GET /v1/tasks/:id exposes ONLY safe review fields (approval_reason,
#      required_capabilities, action_target_type, policy_preset) and never
#      echoes the raw action input.
#   4. Rejection (POST /v1/actions/runs/:id/reject) closes the run without
#      dispatching it.
#   5. Approval (POST /v1/actions/runs/:id/approve) dispatches the run through
#      the durable coordinator/runtime path and it completes.
#   6. A second approve cannot double-dispatch (409 not_awaiting_approval).
#   7. Proof material for the approved run is inspectable (task proof state
#      and the signed receipt list).
#   8. Optionally (--with-console) the Rails console renders the approval
#      panel for a waiting run in real data mode.
#
# Prerequisites: `make igris-local-up` has provisioned local Postgres and
# applied migrations (this script sources .env.run-recover-prove-local).
#
# Usage:
#   ./scripts/approval_loop_smoke.sh [--with-console]

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
UNIFIED_HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
ACTION_HELPER="$SCRIPT_DIR/action_task_v1_proof_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-approval-loop-smoke.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"

WITH_CONSOLE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-console) WITH_CONSOLE=true; shift ;;
    *)
      echo "unknown argument: $1" >&2
      echo "usage: $0 [--with-console]" >&2
      exit 2
      ;;
  esac
done

API_BASE="http://127.0.0.1:8081"
CONSOLE_PORT="${IGRIS_SMOKE_CONSOLE_PORT:-3100}"
ACTION_TARGET_PORT=18091
STARTED_AT=$(date +%s)

if [[ -z "${DATABASE_URL:-}" && -f "$ROOT_DIR/.env.run-recover-prove-local" ]]; then
  set -a
  source "$ROOT_DIR/.env.run-recover-prove-local" >/dev/null 2>&1 || true
  set +a
fi
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

MOCK_PID=""
TARGET_PID=""
RUNTIME_PID=""
OVERTURE_PID=""
CONSOLE_PID=""

cleanup() {
  for pid in "$CONSOLE_PID" "$OVERTURE_PID" "$RUNTIME_PID" "$TARGET_PID" "$MOCK_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT

fail() {
  echo "SMOKE FAILED: $1" >&2
  shift || true
  for extra in "$@"; do
    echo "  $extra" >&2
  done
  echo "  logs: $LOG_DIR" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

check_port_free() {
  local port="$1"
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "port $port is already in use; free it before running the approval loop smoke"
  fi
}

wait_for_http() {
  local url="$1"
  local label="$2"
  for _ in {1..60}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  fail "$label did not become ready: $url"
}

json_field() {
  # json_field <file> <node-expression over `body`>
  node -e '
    const fs = require("fs");
    const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const value = eval(process.argv[2]);
    process.stdout.write(value === undefined || value === null ? "" : String(value));
  ' "$1" "$2"
}

require_cmd node
require_cmd go
require_cmd curl
require_cmd lsof
require_cmd psql

if [[ -z "$DB_URL" ]]; then
  fail "DATABASE_URL is required" "fix: run 'make igris-local-up' first (it writes .env.run-recover-prove-local)"
fi

for table in task_records execution_context execution_lineage action_definitions; do
  present=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.$table')" 2>/dev/null | tr -d '[:space:]')
  [[ "$present" == "$table" ]] || fail "required table $table is missing" "fix: run 'make igris-local-up' to apply migrations"
done

check_port_free 8080
check_port_free 8081
check_port_free 18090
check_port_free "$ACTION_TARGET_PORT"
if [[ "$WITH_CONSOLE" == "true" ]]; then
  check_port_free "$CONSOLE_PORT"
fi

echo "[1/10] Preparing local proof artifacts in $TMP_DIR"
node "$UNIFIED_HELPER" prepare-checkpoint "$TMP_DIR" > "$TMP_DIR/prepare.json"
node "$UNIFIED_HELPER" proof-access-material > "$TMP_DIR/proof-access.json"

# The runtime generates this identity on first `serve`, but registration needs
# the public key before the runtime starts. Create the seed up front on a cold
# checkout, in the same format the runtime itself writes.
RUNTIME_KEY_FILE="$ROOT_DIR/.igris/runtime-signing-key.ed25519"
if [[ ! -f "$RUNTIME_KEY_FILE" ]]; then
  mkdir -p "$ROOT_DIR/.igris"
  umask 077
  node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex") + "\n")' > "$RUNTIME_KEY_FILE"
fi

DEVICE_ID=$(json_field "$TMP_DIR/meta.json" 'body.device_id')
RUNTIME_SECRET=$(json_field "$TMP_DIR/meta.json" 'body.runtime_secret')
LICENSE_PUBLIC_KEY_HEX=$(json_field "$TMP_DIR/meta.json" 'body.license_public_key_hex')
OVERTURE_PUBLIC_KEY_HEX=$(json_field "$TMP_DIR/meta.json" 'body.overture_public_key_hex')
OVERTURE_PRIVATE_KEY_HEX=$(json_field "$TMP_DIR/meta.json" 'body.overture_private_key_hex')
RUNTIME_PUBLIC_KEY_HEX=$(node "$UNIFIED_HELPER" runtime-public-key "$ROOT_DIR/.igris/runtime-signing-key.ed25519")

TENANT_ID=$(json_field "$TMP_DIR/proof-access.json" 'body.tenant_id')
USER_ID=$(json_field "$TMP_DIR/proof-access.json" 'body.user_id')
USER_EMAIL=$(json_field "$TMP_DIR/proof-access.json" 'body.user_email')
SESSION_ID=$(json_field "$TMP_DIR/proof-access.json" 'body.session_id')
SESSION_TOKEN=$(json_field "$TMP_DIR/proof-access.json" 'body.session_token')
RAW_API_KEY=$(json_field "$TMP_DIR/proof-access.json" 'body.raw_api_key')
API_KEY_HASH=$(json_field "$TMP_DIR/proof-access.json" 'body.api_key_hash')
API_KEY_PREFIX=$(json_field "$TMP_DIR/proof-access.json" 'body.api_key_prefix')

COOKIE_ARGS=(-H "Cookie: better-auth.session_token=$SESSION_TOKEN")
KEY_ARGS=(-H "Authorization: Bearer $RAW_API_KEY")

echo "[2/10] Building Overture (and reusing Runtime binary when present)"
RUNTIME_BIN="$ROOT_DIR/igris-runtime/target/debug/igris-runtime"
if [[ ! -x "$RUNTIME_BIN" ]]; then
  require_cmd cargo
  echo "    building runtime (first build can take a while)"
  cargo build --manifest-path "$ROOT_DIR/igris-runtime/Cargo.toml" -p igris-server --bin igris-runtime
fi
GOCACHE="${GOCACHE:-$TMP_DIR/go-cache}" GOFLAGS="-buildvcs=false" \
  go build -o "$TMP_DIR/igris-overture" ./cmd/igris-overture

echo "[3/10] Seeding local tenant, session, and demo table"
psql "$DB_URL" <<SQL >/dev/null
CREATE TABLE IF NOT EXISTS action_task_mock_demo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text,
  status text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$USER_ID','Approval Loop Smoke','$USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$SESSION_ID',NOW()+INTERVAL '2 hours','$SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','approval-loop-smoke','$USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userAgent"=EXCLUDED."userAgent", "userId"=EXCLUDED."userId";

INSERT INTO tenants (tenant_id, tenant_name, tenant_email, status, tier, api_key_hash, api_key_prefix, runtime_limit, capabilities_policy, created_at, updated_at)
VALUES ('$TENANT_ID','Approval Loop Smoke','$USER_EMAIL','active','seed','$API_KEY_HASH','$API_KEY_PREFIX',3,'{"allowed_capabilities":["tools.*"]}'::jsonb,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, tenant_email=EXCLUDED.tenant_email, status='active', tier='seed', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=3, capabilities_policy='{"allowed_capabilities":["tools.*"]}'::jsonb, updated_at=NOW();
SQL

echo "[4/10] Starting local services (mock provider, action target, Overture)"
node "$UNIFIED_HELPER" serve-mock-provider 18090 > "$LOG_DIR/mock-provider.log" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:18090/health" "mock provider"

node "$ACTION_HELPER" serve-action-target "$ACTION_TARGET_PORT" "$DB_URL" > "$LOG_DIR/action-target.log" 2>&1 &
TARGET_PID=$!
wait_for_http "http://127.0.0.1:$ACTION_TARGET_PORT/health" "action target server"

(
  cd "$ROOT_DIR"
  env \
    PORT=8081 \
    DATABASE_URL="$DB_URL" \
    POSTGRES_URL="$DB_URL" \
    ENABLE_PERSISTENCE=true \
    PROVIDER_MODE=mock \
    ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION=true \
    ENABLE_MULTI_TENANCY=true \
    REQUIRE_AUTH_FOR_INFERENCE=true \
    ALLOW_INSECURE_DEFAULTS=true \
    JWT_SECRET="$OVERTURE_PRIVATE_KEY_HEX" \
    BETTER_AUTH_SECRET="$OVERTURE_PRIVATE_KEY_HEX" \
    VAULT_MASTER_KEY="${OVERTURE_PRIVATE_KEY_HEX:0:64}" \
    IGRIS_RUNTIME_URL="http://127.0.0.1:8080" \
    IGRIS_RUNTIME_TIMEOUT=10s \
    IGRIS_RUNTIME_SECRET="$RUNTIME_SECRET" \
    IGRIS_OVERTURE_SIGNING_KEY="$OVERTURE_PRIVATE_KEY_HEX" \
    IGRIS_RUNTIME_PUBLIC_KEY="$RUNTIME_PUBLIC_KEY_HEX" \
    IGRIS_RUNTIME_CALLBACK_BASE_URL="$API_BASE" \
    IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_NAME="Cookie" \
    IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_VALUE="better-auth.session_token=$SESSION_TOKEN" \
    "$TMP_DIR/igris-overture"
) > "$LOG_DIR/overture.log" 2>&1 &
OVERTURE_PID=$!
wait_for_http "$API_BASE/healthz" "overture"

echo "[5/10] Registering and starting Runtime"
node "$UNIFIED_HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$DEVICE_ID" \
  "approval-loop-smoke-runtime" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:8080" > "$TMP_DIR/runtime-register.json"

curl -sS -f \
  -H "X-API-Key: $RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-register.json" \
  "$API_BASE/api/v1/runtime/register" > "$TMP_DIR/runtime-register-response.json"
RUNTIME_ID=$(json_field "$TMP_DIR/runtime-register-response.json" 'body.runtime_id')
[[ -n "$RUNTIME_ID" ]] || fail "runtime registration did not return a runtime_id"

node "$ACTION_HELPER" inject-tools-config \
  "$TMP_DIR/runtime-config.json5" \
  "$TMP_DIR" \
  "127.0.0.1" \
  "http://127.0.0.1:$ACTION_TARGET_PORT/db-write" \
  "$RUNTIME_ID" > "$TMP_DIR/tools-config.json"

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
    IGRIS_DB_WRITE_GATEWAY_URL="http://127.0.0.1:$ACTION_TARGET_PORT/db-write" \
    IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES="action_task_" \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:8080/v1/health" "runtime"

echo "[6/10] Installing starter Action Pack"
curl -sS "${KEY_ARGS[@]}" -X POST "$API_BASE/v1/action-packs/starter/install" \
  > "$TMP_DIR/pack-install.json"
curl -sS "${KEY_ARGS[@]}" "$API_BASE/v1/actions" > "$TMP_DIR/actions.json"
grep -q 'demo.needs_approval' "$TMP_DIR/actions.json" \
  || fail "starter pack install did not register demo.needs_approval" "$(cat "$TMP_DIR/pack-install.json")"

mcp_call_action() {
  # mcp_call_action <out-file> <idempotency-suffix>
  curl -sS "${KEY_ARGS[@]}" -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "id": "smoke-'"$2"'",
      "method": "call_action",
      "params": {
        "action_name": "demo.needs_approval",
        "input": {"message": "'"$INPUT_SENTINEL"'"},
        "idempotency_key": "approval-smoke-'"$2"'-'"$RUN_SUFFIX"'"
      }
    }' \
    "$API_BASE/v1/mcp" > "$1"
}

extract_run_id() {
  node -e '
    const fs = require("fs");
    const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const layer = body.result || body.error?.data || body;
    process.stdout.write(String(layer.run_id || layer.task_id || ""));
  ' "$1"
}

RUN_SUFFIX=$(date +%s)
INPUT_SENTINEL="smoke-raw-input-$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')"

echo "[7/10] Triggering demo.needs_approval through MCP (approve path + reject path)"
mcp_call_action "$TMP_DIR/mcp-run-a.json" "a"
grep -q 'approval_required' "$TMP_DIR/mcp-run-a.json" \
  || fail "MCP call_action did not pause in approval_required" "$(cat "$TMP_DIR/mcp-run-a.json")"
RUN_A=$(extract_run_id "$TMP_DIR/mcp-run-a.json")
[[ -n "$RUN_A" ]] || fail "could not extract run id from MCP response" "$(cat "$TMP_DIR/mcp-run-a.json")"

mcp_call_action "$TMP_DIR/mcp-run-b.json" "b"
RUN_B=$(extract_run_id "$TMP_DIR/mcp-run-b.json")
[[ -n "$RUN_B" && "$RUN_B" != "$RUN_A" ]] || fail "second MCP run did not produce a distinct run id"

echo "    run A (to approve): $RUN_A"
echo "    run B (to reject):  $RUN_B"

echo "[8/10] Verifying safe review fields on GET /v1/tasks/:id"
curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/v1/tasks/$RUN_A" > "$TMP_DIR/task-a-waiting.json"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.status')" == "approval_required" ]] \
  || fail "run A is not approval_required" "$(cat "$TMP_DIR/task-a-waiting.json")"
[[ -n "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.approval_reason')" ]] \
  || fail "approval_reason missing on waiting run"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.required_capabilities && body.required_capabilities.length')" -ge 1 ]] \
  || fail "required_capabilities missing on waiting run"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.policy_preset')" == "Human-gated" ]] \
  || fail "policy_preset is not Human-gated on waiting run"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.action_target_type')" == "mock_demo" ]] \
  || fail "action_target_type is not mock_demo on waiting run"
if grep -q "$INPUT_SENTINEL" "$TMP_DIR/task-a-waiting.json"; then
  fail "raw action input leaked into GET /v1/tasks/:id"
fi

echo "[9/10] Reject stops run B; approve dispatches run A exactly once"
curl -sS "${COOKIE_ARGS[@]}" -H "Content-Type: application/json" \
  -d '{"reason":"approval loop smoke rejection"}' \
  -X POST "$API_BASE/v1/actions/runs/$RUN_B/reject" > "$TMP_DIR/reject-b.json"
[[ "$(json_field "$TMP_DIR/reject-b.json" 'body.decision')" == "rejected" ]] \
  || fail "reject did not record decision=rejected" "$(cat "$TMP_DIR/reject-b.json")"
[[ "$(json_field "$TMP_DIR/reject-b.json" 'body.dispatched')" == "false" ]] \
  || fail "reject response claims dispatched != false"

curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/v1/tasks/$RUN_B" > "$TMP_DIR/task-b-final.json"
[[ "$(json_field "$TMP_DIR/task-b-final.json" 'body.status')" == "failed" ]] \
  || fail "rejected run B is not terminal failed" "$(cat "$TMP_DIR/task-b-final.json")"

APPROVE_STATUS=$(curl -sS -o "$TMP_DIR/approve-a.json" -w "%{http_code}" \
  "${COOKIE_ARGS[@]}" -X POST "$API_BASE/v1/actions/runs/$RUN_A/approve")
[[ "$APPROVE_STATUS" == "202" ]] \
  || fail "approve returned HTTP $APPROVE_STATUS, expected 202" "$(cat "$TMP_DIR/approve-a.json")"
[[ "$(json_field "$TMP_DIR/approve-a.json" 'body.decision')" == "approved" ]] \
  || fail "approve did not record decision=approved"

REAPPROVE_STATUS=$(curl -sS -o "$TMP_DIR/approve-a-again.json" -w "%{http_code}" \
  "${COOKIE_ARGS[@]}" -X POST "$API_BASE/v1/actions/runs/$RUN_A/approve")
[[ "$REAPPROVE_STATUS" == "409" ]] \
  || fail "second approve returned HTTP $REAPPROVE_STATUS, expected 409 not_awaiting_approval"

for _ in {1..60}; do
  curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/v1/tasks/$RUN_A" > "$TMP_DIR/task-a-final.json"
  RUN_A_STATUS=$(json_field "$TMP_DIR/task-a-final.json" 'body.status')
  [[ "$RUN_A_STATUS" == "completed" ]] && break
  if [[ "$RUN_A_STATUS" == "failed" ]]; then
    fail "approved run A failed instead of completing" "$(cat "$TMP_DIR/task-a-final.json")"
  fi
  sleep 1
done
[[ "$RUN_A_STATUS" == "completed" ]] \
  || fail "approved run A did not complete in time (status=$RUN_A_STATUS)"

DEMO_ROWS=$(psql "$DB_URL" -tAc "SELECT count(*) FROM action_task_mock_demo" | tr -d '[:space:]')
[[ "$DEMO_ROWS" -ge 1 ]] || fail "approved run did not write the mock demo record"

curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/proof/receipts" > "$TMP_DIR/receipts.json"
RECEIPT_COUNT=$(node -e '
  const body = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const list = Array.isArray(body) ? body : body.receipts || [];
  process.stdout.write(String(list.length));
' "$TMP_DIR/receipts.json")
PROOF_STATUS=$(json_field "$TMP_DIR/task-a-final.json" '(body.proof && body.proof.status) || body.proof_status')

if [[ "$WITH_CONSOLE" == "true" ]]; then
  echo "[10/10] Console renders the approval panel for a waiting run"
  mcp_call_action "$TMP_DIR/mcp-run-c.json" "c"
  RUN_C=$(extract_run_id "$TMP_DIR/mcp-run-c.json")
  [[ -n "$RUN_C" ]] || fail "could not create console review run"

  # Real-data console access fails closed without credentials; use ephemeral
  # HTTP Basic admin credentials, the supported operator path for local review.
  CONSOLE_ADMIN_USER="smoke-admin"
  CONSOLE_ADMIN_PASSWORD=$(node -e 'process.stdout.write(require("crypto").randomBytes(18).toString("base64url"))')
  (
    cd "$ROOT_DIR/web/apps/rails-console"
    env \
      OVERTURE_API_BASE_URL="$API_BASE" \
      OVERTURE_API_KEY="$RAW_API_KEY" \
      ADMIN_USERNAME="$CONSOLE_ADMIN_USER" \
      ADMIN_PASSWORD="$CONSOLE_ADMIN_PASSWORD" \
      RAILS_ENV=development \
      bundle exec rails server -p "$CONSOLE_PORT" -b 127.0.0.1
  ) > "$LOG_DIR/console.log" 2>&1 &
  CONSOLE_PID=$!
  wait_for_http "http://127.0.0.1:$CONSOLE_PORT/up" "rails console"

  curl -sS -u "$CONSOLE_ADMIN_USER:$CONSOLE_ADMIN_PASSWORD" \
    "http://127.0.0.1:$CONSOLE_PORT/runs/$RUN_C" > "$TMP_DIR/console-run-c.html"
  grep -q 'ic-approval' "$TMP_DIR/console-run-c.html" \
    || fail "console run detail did not render the approval panel"
  grep -q 'Approve and dispatch' "$TMP_DIR/console-run-c.html" \
    || fail "console approval panel is missing the approve control"
  grep -q 'Reject run' "$TMP_DIR/console-run-c.html" \
    || fail "console approval panel is missing the reject control"
  if grep -q "$INPUT_SENTINEL" "$TMP_DIR/console-run-c.html"; then
    fail "raw action input leaked into the console run detail page"
  fi

  curl -sS "${COOKIE_ARGS[@]}" -H "Content-Type: application/json" \
    -d '{"reason":"console smoke cleanup"}' \
    -X POST "$API_BASE/v1/actions/runs/$RUN_C/reject" > /dev/null
else
  echo "[10/10] Console check skipped (pass --with-console to include it)"
fi

ELAPSED=$(( $(date +%s) - STARTED_AT ))
echo ""
echo "APPROVAL LOOP SMOKE PASSED in ${ELAPSED}s"
echo "  run A approved and completed:  $RUN_A (proof_status=${PROOF_STATUS:-unknown})"
echo "  run B rejected, not dispatched: $RUN_B"
echo "  double-approve blocked:         409 not_awaiting_approval"
echo "  signed receipts listed:         $RECEIPT_COUNT"
echo "  safe fields verified:           approval_reason, required_capabilities, policy_preset, action_target_type"
echo "  raw input never echoed:         verified via sentinel"
echo "  artifacts: $TMP_DIR"
