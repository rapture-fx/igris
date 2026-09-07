#!/bin/zsh

# Dogfood Staging Migration Smoke
#
# Proves the internal dogfood workflow from docs/archive/dogfood-2026-07/DOGFOOD_STAGING_MIGRATION_2026-07-03.md
# end to end against a fully local stack, using only supported product surfaces:
#
#   1. The staging-only migration gateway starts against the LOCAL database
#      (it refuses non-loopback DSNs) with a temp migrations dir containing
#      generated, uniquely-named smoke migrations.
#   2. The `dogfood.apply_staging_migration` action is registered through the
#      public API (webhook target pinned to the gateway, Human-gated,
#      irreversible, non_retryable).
#   3. A migration plan is recorded (POST gateway /plan -> plan_id + sha256).
#   4. An agent requests the apply through the real MCP gateway (call_action)
#      and the run pauses in `approval_required`.
#   5. GET /v1/tasks/:id exposes only safe review fields; the raw input
#      (plan_id + reason sentinel) never leaks through Igris.
#   6. Reject closes a run without dispatching; the migration is NOT applied.
#   7. Approve dispatches exactly once (double-approve -> 409); the gateway
#      applies the migration, the audit row flips to `applied`, and the
#      migration's schema effect is present.
#   8. Tamper guard: a migration edited after its plan was recorded is REFUSED
#      at apply time (audit row `checksum_mismatch`, no schema effect), and the
#      approved-but-refused run ends in a top-level `failed` status with a safe
#      failure reason — the smoke FAILS if a refused action reads as completed.
#   9. Proof material is inspectable: task proof state + signed receipt list,
#      and no DSN/credentials appear in any Igris response.
#  10. Optionally (--with-console) the Rails console renders the approval
#      panel for a waiting run in real data mode.
#
# Prerequisites: `make igris-local-up` (local Postgres + migrations).
#
# Usage:
#   ./scripts/dogfood_migration_approval_smoke.sh [--with-console]

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
UNIFIED_HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
GATEWAY_HELPER="$SCRIPT_DIR/dogfood_staging_migration_gateway.js"
ACTION_HELPER="$SCRIPT_DIR/action_task_v1_proof_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-dogfood-migration-smoke.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
MIGRATIONS_DIR="$TMP_DIR/migrations"
mkdir -p "$LOG_DIR" "$MIGRATIONS_DIR"

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
GATEWAY_PORT=18095
GATEWAY_BASE="http://127.0.0.1:$GATEWAY_PORT"
STARTED_AT=$(date +%s)

if [[ -z "${DATABASE_URL:-}" && -f "$ROOT_DIR/.env.run-recover-prove-local" ]]; then
  set -a
  source "$ROOT_DIR/.env.run-recover-prove-local" >/dev/null 2>&1 || true
  set +a
fi
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

MOCK_PID=""
GATEWAY_PID=""
RUNTIME_PID=""
OVERTURE_PID=""
CONSOLE_PID=""

cleanup() {
  for pid in "$CONSOLE_PID" "$OVERTURE_PID" "$RUNTIME_PID" "$GATEWAY_PID" "$MOCK_PID"; do
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
    fail "port $port is already in use; free it before running the dogfood migration smoke"
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
check_port_free "$GATEWAY_PORT"
if [[ "$WITH_CONSOLE" == "true" ]]; then
  check_port_free "$CONSOLE_PORT"
fi

RUN_SUFFIX=$(date +%s)
NONCE=$(node -e 'process.stdout.write(require("crypto").randomBytes(6).toString("hex"))')
SMOKE_TABLE_A="dogfood_smoke_a_${NONCE}"
SMOKE_TABLE_C="dogfood_smoke_c_${NONCE}"
MIGRATION_A="9900_dogfood_smoke_a_${NONCE}.sql"
MIGRATION_C="9901_dogfood_smoke_c_${NONCE}.sql"

# Uniquely-named migrations (unique table + nonce comment) keep re-runs of this
# smoke honest: the gateway refuses to re-plan content it already applied.
cat > "$MIGRATIONS_DIR/$MIGRATION_A" <<SQL
-- dogfood smoke migration A (nonce $NONCE)
CREATE TABLE $SMOKE_TABLE_A (
  id serial PRIMARY KEY,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO $SMOKE_TABLE_A (note) VALUES ('applied via dogfood.apply_staging_migration');
SQL

cat > "$MIGRATIONS_DIR/$MIGRATION_C" <<SQL
-- dogfood smoke migration C (nonce $NONCE) — will be tampered after planning
CREATE TABLE $SMOKE_TABLE_C (
  id serial PRIMARY KEY,
  note text NOT NULL
);
SQL

echo "[1/11] Preparing local proof artifacts in $TMP_DIR"
node "$UNIFIED_HELPER" prepare-checkpoint "$TMP_DIR" > "$TMP_DIR/prepare.json"
node "$UNIFIED_HELPER" proof-access-material > "$TMP_DIR/proof-access.json"

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

# Webhook action inputs carry a `body`, which the input-ref layer treats as
# sensitive and encrypts at rest. Without a keyring, submission fails (and is
# masked as runtime_unavailable) — so provision an ephemeral keyring for the
# smoke, matching the supported production configuration.
INPUT_REF_KEY=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')

echo "[2/11] Building Overture (and reusing Runtime binary when present)"
RUNTIME_BIN="$ROOT_DIR/igris-runtime/target/debug/igris-runtime"
if [[ ! -x "$RUNTIME_BIN" ]]; then
  require_cmd cargo
  echo "    building runtime (first build can take a while)"
  cargo build --manifest-path "$ROOT_DIR/igris-runtime/Cargo.toml" -p igris-server --bin igris-runtime
fi
GOCACHE="${GOCACHE:-$TMP_DIR/go-cache}" GOFLAGS="-buildvcs=false" \
  go build -o "$TMP_DIR/igris-overture" ./cmd/igris-overture

echo "[3/11] Seeding local tenant and session"
psql "$DB_URL" <<SQL >/dev/null
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$USER_ID','Dogfood Migration Smoke','$USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$SESSION_ID',NOW()+INTERVAL '2 hours','$SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','dogfood-migration-smoke','$USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userAgent"=EXCLUDED."userAgent", "userId"=EXCLUDED."userId";

INSERT INTO tenants (tenant_id, tenant_name, tenant_email, status, tier, api_key_hash, api_key_prefix, runtime_limit, capabilities_policy, created_at, updated_at)
VALUES ('$TENANT_ID','Dogfood Migration Smoke','$USER_EMAIL','active','seed','$API_KEY_HASH','$API_KEY_PREFIX',3,'{"allowed_capabilities":["tools.*"]}'::jsonb,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, tenant_email=EXCLUDED.tenant_email, status='active', tier='seed', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=3, capabilities_policy='{"allowed_capabilities":["tools.*"]}'::jsonb, updated_at=NOW();
SQL

echo "[4/11] Starting local services (mock provider, migration gateway, Overture)"
node "$UNIFIED_HELPER" serve-mock-provider 18090 > "$LOG_DIR/mock-provider.log" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:18090/health" "mock provider"

node "$GATEWAY_HELPER" serve "$GATEWAY_PORT" "$DB_URL" "$MIGRATIONS_DIR" > "$LOG_DIR/gateway.log" 2>&1 &
GATEWAY_PID=$!
wait_for_http "$GATEWAY_BASE/health" "staging migration gateway"

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
    IGRIS_EXECUTION_INPUT_REF_KEYS="v1:$INPUT_REF_KEY" \
    IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION="v1" \
    IGRIS_RUNTIME_CALLBACK_BASE_URL="$API_BASE" \
    IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_NAME="Cookie" \
    IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_VALUE="better-auth.session_token=$SESSION_TOKEN" \
    "$TMP_DIR/igris-overture"
) > "$LOG_DIR/overture.log" 2>&1 &
OVERTURE_PID=$!
wait_for_http "$API_BASE/healthz" "overture"

echo "[5/11] Registering and starting Runtime"
node "$UNIFIED_HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$DEVICE_ID" \
  "dogfood-migration-smoke-runtime" \
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
  "$GATEWAY_BASE/unused-db-write" \
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
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:8080/v1/health" "runtime"

echo "[6/11] Registering the dogfood action through the public API"
curl -sS "${KEY_ARGS[@]}" -H "Content-Type: application/json" \
  -d '{
    "name": "dogfood.apply_staging_migration",
    "display_name": "Apply staging migration",
    "description": "Apply one reviewed SQL migration to the staging database through the staging-only migration gateway. Requires a recorded plan (gateway /plan) and human approval.",
    "target_type": "webhook",
    "target_url": "'"$GATEWAY_BASE"'/apply-migration",
    "method": "POST",
    "policy_preset": "Human-gated",
    "replay_class": "non_retryable",
    "approval_required": true,
    "irreversible": true
  }' \
  "$API_BASE/v1/actions" > "$TMP_DIR/action-create.json"
ACTION_ID=$(json_field "$TMP_DIR/action-create.json" 'body.id || (body.action && body.action.id)')
[[ -n "$ACTION_ID" ]] || fail "action registration failed" "$(cat "$TMP_DIR/action-create.json")"

echo "[7/11] Recording migration plans in the gateway"
curl -sS -H "Content-Type: application/json" \
  -d '{"filename": "'"$MIGRATION_A"'"}' \
  "$GATEWAY_BASE/plan" > "$TMP_DIR/plan-a.json"
PLAN_A=$(json_field "$TMP_DIR/plan-a.json" 'body.plan_id')
PLAN_A_SHA=$(json_field "$TMP_DIR/plan-a.json" 'body.sha256')
[[ -n "$PLAN_A" && -n "$PLAN_A_SHA" ]] || fail "gateway did not record plan A" "$(cat "$TMP_DIR/plan-a.json")"

curl -sS -H "Content-Type: application/json" \
  -d '{"filename": "'"$MIGRATION_C"'"}' \
  "$GATEWAY_BASE/plan" > "$TMP_DIR/plan-c.json"
PLAN_C=$(json_field "$TMP_DIR/plan-c.json" 'body.plan_id')
[[ -n "$PLAN_C" ]] || fail "gateway did not record plan C" "$(cat "$TMP_DIR/plan-c.json")"

# Path traversal must be refused at plan time.
TRAVERSAL_STATUS=$(curl -sS -o "$TMP_DIR/plan-traversal.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"filename": "../../etc/passwd.sql"}' \
  "$GATEWAY_BASE/plan")
[[ "$TRAVERSAL_STATUS" == "400" ]] || fail "gateway accepted a traversal filename (HTTP $TRAVERSAL_STATUS)"

INPUT_SENTINEL="dogfood-raw-input-$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')"

mcp_call_action() {
  # mcp_call_action <out-file> <label> <plan-id> <request-summary>
  curl -sS "${KEY_ARGS[@]}" -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "id": "dogfood-'"$2"'",
      "method": "call_action",
      "params": {
        "action_name": "dogfood.apply_staging_migration",
        "input": {"plan_id": "'"$3"'", "reason": "'"$INPUT_SENTINEL"'"},
        "metadata": {"request_summary": "'"$4"'"},
        "idempotency_key": "dogfood-migration-'"$2"'-'"$RUN_SUFFIX"'"
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

SUMMARY_A="apply $MIGRATION_A sha256 ${PLAN_A_SHA:0:12} to local staging"

echo "[8/11] Requesting the apply through MCP; every run must pause for approval"
mcp_call_action "$TMP_DIR/mcp-run-a.json" "a" "$PLAN_A" "$SUMMARY_A"
grep -q 'approval_required' "$TMP_DIR/mcp-run-a.json" \
  || fail "MCP call_action did not pause in approval_required" "$(cat "$TMP_DIR/mcp-run-a.json")"
RUN_A=$(extract_run_id "$TMP_DIR/mcp-run-a.json")
[[ -n "$RUN_A" ]] || fail "could not extract run id from MCP response" "$(cat "$TMP_DIR/mcp-run-a.json")"

mcp_call_action "$TMP_DIR/mcp-run-b.json" "b" "$PLAN_A" "$SUMMARY_A"
RUN_B=$(extract_run_id "$TMP_DIR/mcp-run-b.json")
[[ -n "$RUN_B" && "$RUN_B" != "$RUN_A" ]] || fail "second MCP run did not produce a distinct run id"

mcp_call_action "$TMP_DIR/mcp-run-c.json" "c" "$PLAN_C" "apply $MIGRATION_C (tamper check)"
RUN_C=$(extract_run_id "$TMP_DIR/mcp-run-c.json")
[[ -n "$RUN_C" ]] || fail "could not extract run id for the tamper run"

echo "    run A (approve, applies):        $RUN_A"
echo "    run B (reject, never applies):   $RUN_B"
echo "    run C (approve after tampering): $RUN_C"

echo "[9/11] Safe review fields only; then reject B, approve A, tamper-check C"
curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/v1/tasks/$RUN_A" > "$TMP_DIR/task-a-waiting.json"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.status')" == "approval_required" ]] \
  || fail "run A is not approval_required" "$(cat "$TMP_DIR/task-a-waiting.json")"
[[ -n "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.approval_reason')" ]] \
  || fail "approval_reason missing on waiting run"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.policy_preset')" == "Human-gated" ]] \
  || fail "policy_preset is not Human-gated on waiting run"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.action_target_type')" == "webhook" ]] \
  || fail "action_target_type is not webhook on waiting run"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.action_name')" == "dogfood.apply_staging_migration" ]] \
  || fail "action_name is missing on the waiting run (approver cannot see what they are approving)"
[[ "$(json_field "$TMP_DIR/task-a-waiting.json" 'body.request_summary')" == "$SUMMARY_A" ]] \
  || fail "request_summary is missing on the waiting run (approver cannot see which migration)"
if grep -q "$INPUT_SENTINEL" "$TMP_DIR/task-a-waiting.json"; then
  fail "raw action input leaked into GET /v1/tasks/:id"
fi
if grep -qE 'postgres(ql)?://' "$TMP_DIR/task-a-waiting.json"; then
  fail "a database DSN leaked into GET /v1/tasks/:id"
fi

# Reject B: terminal, never dispatched, migration untouched.
curl -sS "${COOKIE_ARGS[@]}" -H "Content-Type: application/json" \
  -d '{"reason":"dogfood smoke rejection"}' \
  -X POST "$API_BASE/v1/actions/runs/$RUN_B/reject" > "$TMP_DIR/reject-b.json"
[[ "$(json_field "$TMP_DIR/reject-b.json" 'body.decision')" == "rejected" ]] \
  || fail "reject did not record decision=rejected" "$(cat "$TMP_DIR/reject-b.json")"
[[ "$(json_field "$TMP_DIR/reject-b.json" 'body.dispatched')" == "false" ]] \
  || fail "reject response claims dispatched != false"
PLAN_A_STATUS=$(psql "$DB_URL" -tAc "SELECT status FROM dogfood_migration_audit WHERE plan_id='$PLAN_A'" | tr -d '[:space:]')
[[ "$PLAN_A_STATUS" == "planned" ]] \
  || fail "plan A should still be 'planned' after the reject, got '$PLAN_A_STATUS'"

# Approve A: dispatches exactly once; second approve is blocked.
APPROVE_STATUS=$(curl -sS -o "$TMP_DIR/approve-a.json" -w "%{http_code}" \
  "${COOKIE_ARGS[@]}" -X POST "$API_BASE/v1/actions/runs/$RUN_A/approve")
[[ "$APPROVE_STATUS" == "202" ]] \
  || fail "approve returned HTTP $APPROVE_STATUS, expected 202" "$(cat "$TMP_DIR/approve-a.json")"
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

# The staging database must carry the migration's effect AND the audit trail.
PLAN_A_STATUS=$(psql "$DB_URL" -tAc "SELECT status FROM dogfood_migration_audit WHERE plan_id='$PLAN_A'" | tr -d '[:space:]')
[[ "$PLAN_A_STATUS" == "applied" ]] \
  || fail "audit row for plan A is not 'applied', got '$PLAN_A_STATUS'"
SMOKE_ROWS=$(psql "$DB_URL" -tAc "SELECT count(*) FROM $SMOKE_TABLE_A" | tr -d '[:space:]')
[[ "$SMOKE_ROWS" == "1" ]] \
  || fail "migration A's schema effect is missing (expected 1 row in $SMOKE_TABLE_A, got '$SMOKE_ROWS')"

# Tamper guard: edit migration C after its plan was recorded, then approve.
# The gateway must refuse at apply time (409 checksum_mismatch) and the run
# MUST end in a top-level `failed` status — a refused action that reads as
# "completed" is the product lying. This section fails the smoke if the
# status lies.
cat >> "$MIGRATIONS_DIR/$MIGRATION_C" <<SQL
INSERT INTO $SMOKE_TABLE_C (note) VALUES ('tampered after plan');
SQL
curl -sS "${COOKIE_ARGS[@]}" -X POST "$API_BASE/v1/actions/runs/$RUN_C/approve" > "$TMP_DIR/approve-c.json"
for _ in {1..60}; do
  curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/v1/tasks/$RUN_C" > "$TMP_DIR/task-c-final.json"
  RUN_C_STATUS=$(json_field "$TMP_DIR/task-c-final.json" 'body.status')
  [[ "$RUN_C_STATUS" == "completed" || "$RUN_C_STATUS" == "failed" ]] && break
  sleep 1
done
[[ "$RUN_C_STATUS" == "failed" ]] \
  || fail "REFUSED action shows status '$RUN_C_STATUS' — a refused apply must be a failed run" "$(cat "$TMP_DIR/task-c-final.json")"
RUN_C_REASON=$(json_field "$TMP_DIR/task-c-final.json" 'body.failure_reason')
echo "$RUN_C_REASON" | grep -q 'http_status_409' \
  || fail "refused run's failure_reason does not carry the safe gateway status" "$RUN_C_REASON"
if grep -qE 'postgres(ql)?://' "$TMP_DIR/task-c-final.json"; then
  fail "a database DSN leaked into the refused run's task detail"
fi
if grep -q "$INPUT_SENTINEL" "$TMP_DIR/task-c-final.json"; then
  fail "raw action input leaked into the refused run's task detail"
fi
# The refusal is still PROVEN: the failed run carries a signed receipt.
[[ -n "$(json_field "$TMP_DIR/task-c-final.json" 'body.receipt && body.receipt.receipt_hash')" ]] \
  || fail "refused run has no receipt hash — failures must stay provable"
[[ "$(json_field "$TMP_DIR/task-c-final.json" 'body.receipt && body.receipt.signature_present')" == "true" ]] \
  || fail "refused run's receipt is not signed"

PLAN_C_STATUS=$(psql "$DB_URL" -tAc "SELECT status FROM dogfood_migration_audit WHERE plan_id='$PLAN_C'" | tr -d '[:space:]')
[[ "$PLAN_C_STATUS" == "checksum_mismatch" ]] \
  || fail "tampered plan C should be 'checksum_mismatch', got '$PLAN_C_STATUS'" "$(cat "$TMP_DIR/task-c-final.json")"
TAMPER_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.$SMOKE_TABLE_C')" | tr -d '[:space:]')
[[ -z "$TAMPER_TABLE" ]] \
  || fail "tampered migration C was applied despite the checksum mismatch"

echo "[10/11] Proof material is inspectable"
curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/proof/receipts" > "$TMP_DIR/receipts.json"
RECEIPT_COUNT=$(node -e '
  const body = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const list = Array.isArray(body) ? body : body.receipts || [];
  process.stdout.write(String(list.length));
' "$TMP_DIR/receipts.json")
[[ "$RECEIPT_COUNT" -ge 1 ]] || fail "no signed receipts listed after the approved apply"
PROOF_STATUS=$(json_field "$TMP_DIR/task-a-final.json" '(body.proof && body.proof.status) || body.proof_status')
if grep -qE 'postgres(ql)?://' "$TMP_DIR/task-a-final.json" "$TMP_DIR/receipts.json"; then
  fail "a database DSN leaked into task detail or receipt list"
fi
if grep -q "$INPUT_SENTINEL" "$TMP_DIR/task-a-final.json"; then
  fail "raw action input leaked into the completed task detail"
fi

if [[ "$WITH_CONSOLE" == "true" ]]; then
  echo "[11/11] Console renders the approval panel for a waiting migration run"
  curl -sS -H "Content-Type: application/json" \
    -d '{"filename": "'"$MIGRATION_A"'"}' \
    "$GATEWAY_BASE/plan" > "$TMP_DIR/plan-d.json" || true
  # Plan A content was already applied, so re-planning it is refused (409);
  # the console run just needs a waiting run, so reuse plan C's id.
  SUMMARY_D="console review of $MIGRATION_C"
  mcp_call_action "$TMP_DIR/mcp-run-d.json" "d" "$PLAN_C" "$SUMMARY_D"
  RUN_D=$(extract_run_id "$TMP_DIR/mcp-run-d.json")
  [[ -n "$RUN_D" ]] || fail "could not create console review run"

  CONSOLE_ADMIN_USER="smoke-admin"
  CONSOLE_ADMIN_PASSWORD=$(node -e 'process.stdout.write(require("crypto").randomBytes(18).toString("base64url"))')
  # The Rails suite needs ruby 3.2 (system ruby 2.6 cannot run it); prefer the
  # rbenv toolchain when the current shell does not already provide it.
  if [[ -d "$HOME/.rbenv/versions" ]] && ! ruby -e 'exit(RUBY_VERSION >= "3.0" ? 0 : 1)' >/dev/null 2>&1; then
    RBENV_RUBY=$(ls "$HOME/.rbenv/versions" | sort -V | tail -1)
    export PATH="$HOME/.rbenv/versions/$RBENV_RUBY/bin:$PATH"
  fi
  (
    cd "$ROOT_DIR/web/apps/rails-console"
    env \
      OVERTURE_API_BASE_URL="$API_BASE" \
      OVERTURE_API_KEY="$RAW_API_KEY" \
      ADMIN_USERNAME="$CONSOLE_ADMIN_USER" \
      ADMIN_PASSWORD="$CONSOLE_ADMIN_PASSWORD" \
      RAILS_ENV=development \
      bundle exec rails server -p "$CONSOLE_PORT" -b 127.0.0.1 -P "$TMP_DIR/console-server.pid"
  ) > "$LOG_DIR/console.log" 2>&1 &
  CONSOLE_PID=$!
  wait_for_http "http://127.0.0.1:$CONSOLE_PORT/up" "rails console"

  curl -sS -u "$CONSOLE_ADMIN_USER:$CONSOLE_ADMIN_PASSWORD" \
    "http://127.0.0.1:$CONSOLE_PORT/runs/$RUN_D" > "$TMP_DIR/console-run-d.html"
  grep -q 'ic-approval' "$TMP_DIR/console-run-d.html" \
    || fail "console run detail did not render the approval panel"
  grep -q 'dogfood.apply_staging_migration' "$TMP_DIR/console-run-d.html" \
    || fail "console approval panel does not name the dogfood action"
  grep -q 'Approve and dispatch' "$TMP_DIR/console-run-d.html" \
    || fail "console approval panel is missing the approve control"
  grep -q 'Reject run' "$TMP_DIR/console-run-d.html" \
    || fail "console approval panel is missing the reject control"
  grep -q "$SUMMARY_D" "$TMP_DIR/console-run-d.html" \
    || fail "console approval panel does not show the request summary"
  if grep -q "$INPUT_SENTINEL" "$TMP_DIR/console-run-d.html"; then
    fail "raw action input leaked into the console run detail page"
  fi
  if grep -qE 'postgres(ql)?://' "$TMP_DIR/console-run-d.html"; then
    fail "a database DSN leaked into the console run detail page"
  fi

  # Console truth for the REFUSED run: the tampered run C must present as
  # Failed, never as Succeeded, and must not leak input or DSN.
  curl -sS -u "$CONSOLE_ADMIN_USER:$CONSOLE_ADMIN_PASSWORD" \
    "http://127.0.0.1:$CONSOLE_PORT/runs/$RUN_C" > "$TMP_DIR/console-run-c.html"
  grep -q 'ic-doc__stat--bad">Failed' "$TMP_DIR/console-run-c.html" \
    || fail "console does not show the refused run as Failed"
  if grep -q 'ic-doc__stat--ok">Succeeded' "$TMP_DIR/console-run-c.html"; then
    fail "console shows the refused run as Succeeded — the status lies"
  fi
  if grep -q "$INPUT_SENTINEL" "$TMP_DIR/console-run-c.html" \
     || grep -qE 'postgres(ql)?://' "$TMP_DIR/console-run-c.html"; then
    fail "refused run's console page leaked raw input or a DSN"
  fi

  curl -sS "${COOKIE_ARGS[@]}" -H "Content-Type: application/json" \
    -d '{"reason":"console smoke cleanup"}' \
    -X POST "$API_BASE/v1/actions/runs/$RUN_D/reject" > /dev/null
else
  echo "[11/11] Console check skipped (pass --with-console to include it)"
fi

ELAPSED=$(( $(date +%s) - STARTED_AT ))
echo ""
echo "DOGFOOD MIGRATION SMOKE PASSED in ${ELAPSED}s"
echo "  action registered via API:        dogfood.apply_staging_migration ($ACTION_ID)"
echo "  plan A applied after approval:    $PLAN_A ($MIGRATION_A, sha256 ${PLAN_A_SHA:0:12}…)"
echo "  run A approved and completed:     $RUN_A (proof_status=${PROOF_STATUS:-unknown})"
echo "  run B rejected, never applied:    $RUN_B (plan stayed 'planned')"
echo "  tampered run C failed honestly:   $RUN_C (status=failed, checksum_mismatch, no schema effect)"
echo "  approver context on waiting run:  action_name + request_summary"
echo "  double-approve blocked:           409 not_awaiting_approval"
echo "  path traversal refused:           400 at /plan"
echo "  signed receipts listed:           $RECEIPT_COUNT"
echo "  no raw input / DSN leaked:        verified via sentinel + DSN grep"
echo "  audit table:                      dogfood_migration_audit (staging DB)"
echo "  artifacts: $TMP_DIR"
