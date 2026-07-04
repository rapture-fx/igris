#!/bin/zsh

# Dogfood Igris-routed development smoke.
#
# Prerequisites: `make igris-local-up` (local Postgres + migrations).
#
# Usage:
#   ./scripts/dogfood_routed_dev_smoke.sh [--with-console]

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
UNIFIED_HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
ACTION_HELPER="$SCRIPT_DIR/action_task_v1_proof_helper.js"
GATEWAY_HELPER="$SCRIPT_DIR/dogfood_routed_dev_gateway.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-routed-dev-smoke.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
DIRTY_SENTINEL_FILE="$ROOT_DIR/.igris-routed-dev-smoke-dirty"
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
GATEWAY_PORT=18096
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
  rm -f "$DIRTY_SENTINEL_FILE" >/dev/null 2>&1 || true
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
    fail "port $port is already in use; free it before running the routed-dev smoke"
  fi
}

wait_for_http() {
  local url="$1"
  local label="$2"
  for _ in {1..90}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  fail "$label did not become ready: $url"
}

json_field() {
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
  fail "DATABASE_URL is required" "fix: run 'make igris-local-up' first"
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
GATEWAY_SECRET=$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')
AUTH_HEADER=(-H "X-Igris-Dogfood-Secret: $GATEWAY_SECRET")
SENTINEL="sentinel-secret-$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')"

echo "[1/12] Preparing local proof artifacts in $TMP_DIR"
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
INPUT_REF_KEY=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')

echo "[2/12] Building Overture and preparing Runtime"
RUNTIME_BIN="$ROOT_DIR/igris-runtime/target/debug/igris-runtime"
if [[ ! -x "$RUNTIME_BIN" ]]; then
  require_cmd cargo
  cargo build --manifest-path "$ROOT_DIR/igris-runtime/Cargo.toml" -p igris-server --bin igris-runtime
fi
GOCACHE="${GOCACHE:-$TMP_DIR/go-cache}" GOFLAGS="-buildvcs=false" \
  go build -o "$TMP_DIR/igris-overture" ./cmd/igris-overture

echo "[3/12] Seeding local tenant and session"
psql "$DB_URL" <<SQL >/dev/null
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$USER_ID','Routed Dev Smoke','$USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$SESSION_ID',NOW()+INTERVAL '2 hours','$SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','routed-dev-smoke','$USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userAgent"=EXCLUDED."userAgent", "userId"=EXCLUDED."userId";

INSERT INTO tenants (tenant_id, tenant_name, tenant_email, status, tier, api_key_hash, api_key_prefix, runtime_limit, capabilities_policy, created_at, updated_at)
VALUES ('$TENANT_ID','Routed Dev Smoke','$USER_EMAIL','active','seed','$API_KEY_HASH','$API_KEY_PREFIX',3,'{"allowed_capabilities":["tools.*"]}'::jsonb,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, tenant_email=EXCLUDED.tenant_email, status='active', tier='seed', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=3, capabilities_policy='{"allowed_capabilities":["tools.*"]}'::jsonb, updated_at=NOW();

UPDATE action_definitions
SET archived_at = NOW(), updated_at = NOW()
WHERE tenant_id = '$TENANT_ID'
  AND name IN ('repo.run_tests','repo.push_branch','repo.open_pr')
  AND archived_at IS NULL;
SQL

echo "[4/12] Starting local services"
node "$UNIFIED_HELPER" serve-mock-provider 18090 > "$LOG_DIR/mock-provider.log" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:18090/health" "mock provider"

IGRIS_DOGFOOD_DEV_GATEWAY_SECRET="$GATEWAY_SECRET" \
  node "$GATEWAY_HELPER" serve "$GATEWAY_PORT" "$ROOT_DIR" > "$LOG_DIR/gateway.log" 2>&1 &
GATEWAY_PID=$!
wait_for_http "$GATEWAY_BASE/health" "routed dev gateway"

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
    IGRIS_DOGFOOD_DEV_GATEWAY_SECRET="$GATEWAY_SECRET" \
    "$TMP_DIR/igris-overture"
) > "$LOG_DIR/overture.log" 2>&1 &
OVERTURE_PID=$!
wait_for_http "$API_BASE/healthz" "overture"

echo "[5/12] Registering and starting Runtime"
node "$UNIFIED_HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$DEVICE_ID" \
  "routed-dev-smoke-runtime" \
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

register_action() {
  local name="$1"
  local display="$2"
  local url="$3"
  local policy="$4"
  local replay="$5"
  local approval="$6"
  local irreversible="$7"
  node -e '
    const [name, display, url, policy, replay, approval, irreversible] = process.argv.slice(1);
    process.stdout.write(JSON.stringify({
      name,
      display_name: display,
      description: `${display} through the local Igris-routed development gateway.`,
      target_type: "webhook",
      target_url: url,
      method: "POST",
      policy_preset: policy,
      replay_class: replay,
      approval_required: approval === "true",
      irreversible: irreversible === "true",
      target_metadata: {
        local_auth_header_name: "X-Igris-Dogfood-Secret",
        local_auth_secret_env: "IGRIS_DOGFOOD_DEV_GATEWAY_SECRET",
        dogfood_gateway: "routed_development"
      }
    }));
  ' "$name" "$display" "$url" "$policy" "$replay" "$approval" "$irreversible" > "$TMP_DIR/action-$name.json"
  curl -sS "${KEY_ARGS[@]}" -H "Content-Type: application/json" \
    -d @"$TMP_DIR/action-$name.json" \
    "$API_BASE/v1/actions" > "$TMP_DIR/action-$name-response.json"
  local action_id
  action_id=$(json_field "$TMP_DIR/action-$name-response.json" 'body.id || (body.action && body.action.id)')
  [[ -n "$action_id" ]] || fail "action registration failed for $name" "$(cat "$TMP_DIR/action-$name-response.json")"
}

echo "[6/12] Registering routed-development actions"
register_action "repo.run_tests" "Run fixed repo tests" "$GATEWAY_BASE/repo/run-tests" "Safe automation" "read_only" "false" "false"
register_action "repo.push_branch" "Push current branch" "$GATEWAY_BASE/repo/push-branch" "Human-gated" "non_retryable" "true" "true"
register_action "repo.open_pr" "Open pull request" "$GATEWAY_BASE/repo/open-pr" "Human-gated" "non_retryable" "true" "true"

mcp_call_action() {
  # mcp_call_action <out-file> <label> <action-name> <input-json> <request-summary>
  SENTINEL_SECRET="$SENTINEL" node -e '
    const [id, actionName, inputRaw, summary, suffix] = process.argv.slice(1);
    const input = JSON.parse(inputRaw);
    input.sentinel_secret = process.env.SENTINEL_SECRET;
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "call_action",
      params: {
        action_name: actionName,
        input,
        metadata: { request_summary: summary },
        idempotency_key: `${actionName}-${suffix}`
      }
    }));
  ' "routed-$2" "$3" "$4" "$5" "$2-$RUN_SUFFIX" > "$TMP_DIR/mcp-$2-request.json"
  curl -sS "${KEY_ARGS[@]}" -H "Content-Type: application/json" \
    -d @"$TMP_DIR/mcp-$2-request.json" \
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

wait_run_terminal() {
  # wait_run_terminal <run-id> <out-file>
  local run_id="$1"
  local out="$2"
  local run_status=""
  for _ in {1..90}; do
    curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/v1/tasks/$run_id" > "$out"
    run_status=$(json_field "$out" 'body.status')
    [[ "$run_status" == "completed" || "$run_status" == "failed" ]] && return 0
    sleep 1
  done
  fail "run $run_id did not reach a terminal state" "last status=$run_status"
}

event_count() {
  curl -sS "${AUTH_HEADER[@]}" "$GATEWAY_BASE/events" > "$TMP_DIR/events.json"
  node -e '
    const fs = require("fs");
    const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String((body.counts || {})[process.argv[2]] || 0));
  ' "$TMP_DIR/events.json" "$1"
}

echo "[7/12] Requesting repo.run_tests through MCP"
mcp_call_action "$TMP_DIR/mcp-run-tests.json" "run-tests" "repo.run_tests" '{"action_name":"repo.run_tests"}' "run fixed routed-dev gateway self-test"
RUN_TESTS_ID=$(extract_run_id "$TMP_DIR/mcp-run-tests.json")
[[ -n "$RUN_TESTS_ID" ]] || fail "could not extract repo.run_tests run id" "$(cat "$TMP_DIR/mcp-run-tests.json")"
wait_run_terminal "$RUN_TESTS_ID" "$TMP_DIR/task-run-tests-final.json"
[[ "$(json_field "$TMP_DIR/task-run-tests-final.json" 'body.status')" == "completed" ]] \
  || fail "repo.run_tests did not complete" "$(cat "$TMP_DIR/task-run-tests-final.json")"
[[ -n "$(json_field "$TMP_DIR/task-run-tests-final.json" 'body.receipt && body.receipt.receipt_hash')" ]] \
  || fail "repo.run_tests has no receipt hash"

echo "[8/12] Proving dirty-tree push refusal at the gateway"
printf 'temporary dirty file for routed-dev smoke\n' > "$DIRTY_SENTINEL_FILE"
DIRTY_STATUS=$(curl -sS -o "$TMP_DIR/direct-push-dirty.json" -w "%{http_code}" \
  "${AUTH_HEADER[@]}" -H "Content-Type: application/json" \
  -d '{"action_name":"repo.push_branch","dry_run":true,"remote_name":"origin"}' \
  "$GATEWAY_BASE/repo/push-branch")
[[ "$DIRTY_STATUS" == "409" ]] || fail "gateway did not refuse dirty push dry-run without explicit allowance (HTTP $DIRTY_STATUS)"
rm -f "$DIRTY_SENTINEL_FILE"

echo "[9/12] Requesting repo.push_branch; reject prevents dispatch, approve dispatches dry-run once"
mcp_call_action "$TMP_DIR/mcp-push-reject.json" "push-reject" "repo.push_branch" '{"action_name":"repo.push_branch","dry_run":true,"allow_dirty_dry_run":true,"remote_name":"origin"}' "dry-run push current branch to origin"
PUSH_REJECT_ID=$(extract_run_id "$TMP_DIR/mcp-push-reject.json")
curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/v1/tasks/$PUSH_REJECT_ID" > "$TMP_DIR/task-push-waiting.json"
[[ "$(json_field "$TMP_DIR/task-push-waiting.json" 'body.status')" == "approval_required" ]] || fail "repo.push_branch did not pause for approval"
[[ "$(json_field "$TMP_DIR/task-push-waiting.json" 'body.action_name')" == "repo.push_branch" ]] || fail "push approval context missing action name"
[[ "$(json_field "$TMP_DIR/task-push-waiting.json" 'body.request_summary')" == "dry-run push current branch to origin" ]] || fail "push approval context missing request summary"
if grep -q "$SENTINEL" "$TMP_DIR/task-push-waiting.json"; then
  fail "raw push input sentinel leaked into task detail"
fi
PUSH_COUNT_BEFORE=$(event_count "repo.push_branch")
curl -sS "${COOKIE_ARGS[@]}" -H "Content-Type: application/json" \
  -d '{"reason":"smoke reject proves no dispatch"}' \
  -X POST "$API_BASE/v1/actions/runs/$PUSH_REJECT_ID/reject" > "$TMP_DIR/reject-push.json"
[[ "$(json_field "$TMP_DIR/reject-push.json" 'body.dispatched')" == "false" ]] || fail "push reject response did not state dispatched=false"
PUSH_COUNT_AFTER_REJECT=$(event_count "repo.push_branch")
[[ "$PUSH_COUNT_AFTER_REJECT" == "$PUSH_COUNT_BEFORE" ]] || fail "rejected push reached gateway"

mcp_call_action "$TMP_DIR/mcp-push-approve.json" "push-approve" "repo.push_branch" '{"action_name":"repo.push_branch","dry_run":true,"allow_dirty_dry_run":true,"remote_name":"origin"}' "dry-run approved push current branch to origin"
PUSH_APPROVE_ID=$(extract_run_id "$TMP_DIR/mcp-push-approve.json")
curl -sS "${COOKIE_ARGS[@]}" -X POST "$API_BASE/v1/actions/runs/$PUSH_APPROVE_ID/approve" > "$TMP_DIR/approve-push.json"
REAPPROVE_PUSH_STATUS=$(curl -sS -o "$TMP_DIR/approve-push-again.json" -w "%{http_code}" \
  "${COOKIE_ARGS[@]}" -X POST "$API_BASE/v1/actions/runs/$PUSH_APPROVE_ID/approve")
[[ "$REAPPROVE_PUSH_STATUS" == "409" ]] || fail "second push approve returned HTTP $REAPPROVE_PUSH_STATUS, expected 409"
wait_run_terminal "$PUSH_APPROVE_ID" "$TMP_DIR/task-push-final.json"
[[ "$(json_field "$TMP_DIR/task-push-final.json" 'body.status')" == "completed" ]] || fail "approved dry-run push did not complete"
PUSH_COUNT_AFTER_APPROVE=$(event_count "repo.push_branch")
[[ "$PUSH_COUNT_AFTER_APPROVE" == "$((PUSH_COUNT_BEFORE + 1))" ]] || fail "approved push did not dispatch exactly once"

echo "[10/12] Requesting repo.open_pr; reject prevents dispatch, approve dry-runs"
mcp_call_action "$TMP_DIR/mcp-pr-reject.json" "pr-reject" "repo.open_pr" '{"action_name":"repo.open_pr","dry_run":true,"base_branch":"main"}' "dry-run open PR from current branch to main"
PR_REJECT_ID=$(extract_run_id "$TMP_DIR/mcp-pr-reject.json")
curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/v1/tasks/$PR_REJECT_ID" > "$TMP_DIR/task-pr-waiting.json"
[[ "$(json_field "$TMP_DIR/task-pr-waiting.json" 'body.status')" == "approval_required" ]] || fail "repo.open_pr did not pause for approval"
[[ "$(json_field "$TMP_DIR/task-pr-waiting.json" 'body.request_summary')" == "dry-run open PR from current branch to main" ]] || fail "PR approval context missing request summary"
PR_COUNT_BEFORE=$(event_count "repo.open_pr")
curl -sS "${COOKIE_ARGS[@]}" -H "Content-Type: application/json" \
  -d '{"reason":"smoke reject proves no PR dispatch"}' \
  -X POST "$API_BASE/v1/actions/runs/$PR_REJECT_ID/reject" > "$TMP_DIR/reject-pr.json"
PR_COUNT_AFTER_REJECT=$(event_count "repo.open_pr")
[[ "$PR_COUNT_AFTER_REJECT" == "$PR_COUNT_BEFORE" ]] || fail "rejected PR reached gateway"

mcp_call_action "$TMP_DIR/mcp-pr-approve.json" "pr-approve" "repo.open_pr" '{"action_name":"repo.open_pr","dry_run":true,"base_branch":"main"}' "dry-run approved open PR from current branch to main"
PR_APPROVE_ID=$(extract_run_id "$TMP_DIR/mcp-pr-approve.json")
curl -sS "${COOKIE_ARGS[@]}" -X POST "$API_BASE/v1/actions/runs/$PR_APPROVE_ID/approve" > "$TMP_DIR/approve-pr.json"
wait_run_terminal "$PR_APPROVE_ID" "$TMP_DIR/task-pr-final.json"
[[ "$(json_field "$TMP_DIR/task-pr-final.json" 'body.status')" == "completed" ]] || fail "approved dry-run PR did not complete"
PR_COUNT_AFTER_APPROVE=$(event_count "repo.open_pr")
[[ "$PR_COUNT_AFTER_APPROVE" == "$((PR_COUNT_BEFORE + 1))" ]] || fail "approved PR did not dispatch exactly once"

echo "[11/12] Proof and leak checks"
curl -sS "${COOKIE_ARGS[@]}" "$API_BASE/proof/receipts" > "$TMP_DIR/receipts.json"
RECEIPT_COUNT=$(node -e '
  const body = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const list = Array.isArray(body) ? body : body.receipts || [];
  process.stdout.write(String(list.length));
' "$TMP_DIR/receipts.json")
[[ "$RECEIPT_COUNT" -ge 1 ]] || fail "no signed receipts listed"
for f in "$TMP_DIR/task-run-tests-final.json" "$TMP_DIR/task-push-final.json" "$TMP_DIR/task-pr-final.json" "$TMP_DIR/receipts.json"; do
  if grep -q "$SENTINEL" "$f"; then
    fail "raw input sentinel leaked into API response"
  fi
  if grep -q "$GATEWAY_SECRET" "$f"; then
    fail "gateway shared secret leaked into API response"
  fi
  if grep -qE 'postgres(ql)?://|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9_]' "$f"; then
    fail "secret-shaped material leaked into API response"
  fi
done

if [[ "$WITH_CONSOLE" == "true" ]]; then
  echo "[12/12] Console renders approval context and terminal proof summary"
  CONSOLE_ADMIN_USER="smoke-admin"
  CONSOLE_ADMIN_PASSWORD=$(node -e 'process.stdout.write(require("crypto").randomBytes(18).toString("base64url"))')
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
    "http://127.0.0.1:$CONSOLE_PORT/runs/$PR_REJECT_ID" > "$TMP_DIR/console-pr-rejected.html"
  grep -q 'repo.open_pr' "$TMP_DIR/console-pr-rejected.html" || fail "console did not show repo.open_pr"
  grep -q 'Failed' "$TMP_DIR/console-pr-rejected.html" || fail "console did not show rejected PR as failed"

  curl -sS -u "$CONSOLE_ADMIN_USER:$CONSOLE_ADMIN_PASSWORD" \
    "http://127.0.0.1:$CONSOLE_PORT/runs/$PUSH_APPROVE_ID" > "$TMP_DIR/console-push-final.html"
  grep -q 'repo.push_branch' "$TMP_DIR/console-push-final.html" || fail "console did not show repo.push_branch"
  grep -q 'Receipt' "$TMP_DIR/console-push-final.html" || fail "console did not show receipt/proof summary"
  if grep -q "$SENTINEL" "$TMP_DIR"/console-*.html || grep -q "$GATEWAY_SECRET" "$TMP_DIR"/console-*.html; then
    fail "console leaked raw input or gateway secret"
  fi
else
  echo "[12/12] Console check skipped (pass --with-console to include it)"
fi

ELAPSED=$(( $(date +%s) - STARTED_AT ))
echo ""
echo "DOGFOOD ROUTED DEV SMOKE PASSED in ${ELAPSED}s"
echo "  worktree:                  $ROOT_DIR"
echo "  actions registered:        repo.run_tests, repo.push_branch, repo.open_pr"
echo "  run_tests:                 completed with signed receipt ($RUN_TESTS_ID)"
echo "  push_branch:               approval required; reject blocked; approved dry-run dispatched once ($PUSH_APPROVE_ID)"
echo "  open_pr:                   approval required; reject blocked; approved dry-run dispatched once ($PR_APPROVE_ID)"
echo "  gateway dirty guard:        refused without explicit dry-run allowance"
echo "  push/PR real mode:          disabled by default"
echo "  signed receipts listed:     $RECEIPT_COUNT"
echo "  secrets/raw input leaked:   no"
echo "  artifacts:                  $TMP_DIR"
