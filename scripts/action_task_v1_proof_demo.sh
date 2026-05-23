#!/bin/zsh

# Action Task V1 Proof Demo
#
# Proves that a durable AI task can touch *real, external systems* under tight
# local sandboxing — and that the work leaves a verifiable evidence trail.
#
# The customer submits a small, auditable `action_task` (understandable in
# under five minutes):
#
#   read_file  -> read a controlled local file (filesystem tool, path-whitelisted)
#   http_call  -> POST to a controlled localhost endpoint (http_request tool, host-whitelisted)
#   db_write   -> insert one row into a clearly-named `action_task_*` test table
#                 (database_write tool -> localhost gateway -> Postgres)
#
# Overture compiles it to a runtime execution graph of those sandboxed tools,
# issues a signed capability/permission envelope, and dispatches it. The runtime
# executes each step, commits WAL entries, and emits a signed execution envelope
# and hash-chained receipt. Overture persists the run.
#
# The script then asserts, end to end:
#   1. The read_file action completed (committed WAL step, filesystem tool).
#   2. The http_call action completed (committed WAL step + the local endpoint
#      received the request).
#   3. The db_write happened (committed WAL step + a real row in Postgres).
#   4. The task completed through Runtime-backed execution.
#   5. A persisted run exists (GET /v1/execution/runs/:execution_id).
#   6. A signed receipt exists and is listed (GET /proof/receipts).
#   7. Fresh cryptographic verification passes (POST /proof/receipts/verify:
#      verified=true, hash_valid=true, signature_matches=true, runtime_key_found=true,
#      chain_valid=true where applicable).
#
# This proof is intentionally separate from scripts/proof_suite.sh — do not add
# it there until it is stable.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
UNIFIED_HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
ACTION_HELPER="$SCRIPT_DIR/action_task_v1_proof_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-action-v1-proof.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"
CALLBACK_EVIDENCE_LOG="$TMP_DIR/runtime-callback-evidence.jsonl"

# Optional: a console base URL so the proof can print a clickable Task Inspector
# link for presenters. Accept --console-base-url <url> or CONSOLE_URL=<url>.
# Never required; omitting it leaves behavior unchanged.
CONSOLE_BASE_URL="${CONSOLE_URL:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --console-base-url)
      CONSOLE_BASE_URL="${2:-}"
      shift 2
      ;;
    --console-base-url=*)
      CONSOLE_BASE_URL="${1#*=}"
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      echo "usage: $0 [--console-base-url <url>]   (or set CONSOLE_URL)" >&2
      exit 2
      ;;
  esac
done
# Normalize: strip trailing slashes so "<base>/execution/tasks/<id>" stays clean.
while [[ "$CONSOLE_BASE_URL" == */ ]]; do
  CONSOLE_BASE_URL="${CONSOLE_BASE_URL%/}"
done

ACTION_TARGET_PORT=18091
ACTION_TABLE="action_task_events"
DB_WRITE_GATEWAY_URL="http://127.0.0.1:$ACTION_TARGET_PORT/db-write"
PROCESS_URL="http://127.0.0.1:$ACTION_TARGET_PORT/process"

if [[ -z "${DATABASE_URL:-}" && -z "${POSTGRES_URL:-}" && -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env" >/dev/null 2>&1 || true
  set +a
fi
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

MOCK_PID=""
TARGET_PID=""
RUNTIME_PID=""
OVERTURE_PID=""

cleanup() {
  for pid in "$OVERTURE_PID" "$RUNTIME_PID" "$TARGET_PID" "$MOCK_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

check_port_free() {
  local port="$1"
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $port is already in use; free it before running the action task v1 proof demo" >&2
    exit 1
  fi
}

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

wait_for_task_status() {
  local task_id="$1"
  local wanted="$2"
  local out_path="$3"
  local attempts="${4:-90}"
  local sleep_s="${5:-1}"

  for _ in $(seq 1 "$attempts"); do
    curl -sS \
      "${AUTH_ARGS[@]}" \
      "http://127.0.0.1:8081/v1/tasks/$task_id" > "$out_path"
    local task_state
    task_state=$(node -e 'const fs=require("fs"); const body=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(body.status||""));' "$out_path")
    if [[ "$task_state" == "$wanted" ]]; then
      return 0
    fi
    if [[ "$task_state" == "failed" ]]; then
      echo "task $task_id failed while waiting for status=$wanted" >&2
      cat "$out_path" >&2
      exit 1
    fi
    sleep "$sleep_s"
  done

  echo "task $task_id did not reach status=$wanted in time" >&2
  cat "$out_path" >&2
  exit 1
}

require_cmd node
require_cmd cargo
require_cmd go
require_cmd curl
require_cmd lsof
require_cmd psql

if [[ -z "$DB_URL" ]]; then
  echo "DATABASE_URL or POSTGRES_URL is required for the action task v1 proof" >&2
  exit 1
fi

TASK_RECORDS_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.task_records')" 2>/dev/null | tr -d '[:space:]')
EXECUTION_CONTEXT_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.execution_context')" 2>/dev/null | tr -d '[:space:]')
EXECUTION_LINEAGE_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.execution_lineage')" 2>/dev/null | tr -d '[:space:]')
if [[ "$TASK_RECORDS_TABLE" != "task_records" || "$EXECUTION_CONTEXT_TABLE" != "execution_context" || "$EXECUTION_LINEAGE_TABLE" != "execution_lineage" ]]; then
  echo "required tables (task_records, execution_context, execution_lineage) are not all present; apply durable-task + execution-context migrations first" >&2
  exit 1
fi

check_port_free 8080
check_port_free 8081
check_port_free 18090
check_port_free "$ACTION_TARGET_PORT"

echo "[1/11] Preparing Action Task V1 proof artifacts in $TMP_DIR"
# Reuse the checkpoint helper for shared artifacts (offline license, runtime
# config, overture/runtime keys, mock provider seeds). We discard its
# checkpoint-specific request files and build our own action_task body below.
node "$UNIFIED_HELPER" prepare-checkpoint "$TMP_DIR" > "$TMP_DIR/prepare.json"
node "$UNIFIED_HELPER" proof-access-material > "$TMP_DIR/proof-access.json"

DEVICE_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).device_id)' "$TMP_DIR/meta.json")
RUNTIME_SECRET=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_secret)' "$TMP_DIR/meta.json")
LICENSE_PUBLIC_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).license_public_key_hex)' "$TMP_DIR/meta.json")
OVERTURE_PUBLIC_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).overture_public_key_hex)' "$TMP_DIR/meta.json")
OVERTURE_PRIVATE_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).overture_private_key_hex)' "$TMP_DIR/meta.json")
RUNTIME_PUBLIC_KEY_HEX=$(node "$UNIFIED_HELPER" runtime-public-key "$ROOT_DIR/.igris/runtime-signing-key.ed25519")

PROOF_TENANT_UUID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenant_uuid)' "$TMP_DIR/proof-access.json")
PROOF_TENANT_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenant_id)' "$TMP_DIR/proof-access.json")
PROOF_USER_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).user_id)' "$TMP_DIR/proof-access.json")
PROOF_USER_EMAIL=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).user_email)' "$TMP_DIR/proof-access.json")
PROOF_SESSION_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).session_id)' "$TMP_DIR/proof-access.json")
PROOF_SESSION_TOKEN=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).session_token)' "$TMP_DIR/proof-access.json")
PROOF_RAW_API_KEY=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).raw_api_key)' "$TMP_DIR/proof-access.json")
PROOF_API_KEY_HASH=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).api_key_hash)' "$TMP_DIR/proof-access.json")
PROOF_API_KEY_PREFIX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).api_key_prefix)' "$TMP_DIR/proof-access.json")

AUTH_ARGS=(-H "Cookie: better-auth.session_token=$PROOF_SESSION_TOKEN")

# Controlled local input file (small, harmless contents).
INPUT_FILE="$TMP_DIR/igris-action-input.txt"
printf 'igris action task v1 proof input — payload-token=%s\n' "$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')" > "$INPUT_FILE"

echo "[2/11] Building Runtime binary"
RUNTIME_BIN="$ROOT_DIR/igris-runtime/target/debug/igris-runtime"
if [[ ! -x "$RUNTIME_BIN" ]]; then
  cargo build --manifest-path "$ROOT_DIR/igris-runtime/Cargo.toml" -p igris-server --bin igris-runtime
else
  echo "    Reusing existing Runtime binary"
fi

echo "[3/11] Building Overture binary"
GOCACHE="$TMP_DIR/go-cache" GOPROXY=off GOSUMDB=off GOFLAGS="-mod=readonly -buildvcs=false" \
  go build -o "$TMP_DIR/igris-overture" ./cmd/igris-overture

echo "[4/11] Preparing controlled test table ($ACTION_TABLE) and seeding tenant"
psql "$DB_URL" <<SQL >/dev/null
CREATE TABLE IF NOT EXISTS action_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text,
  status text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$PROOF_USER_ID','Action Task V1 Proof Demo','$PROOF_USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$PROOF_SESSION_ID',NOW()+INTERVAL '2 hours','$PROOF_SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','action-task-v1-proof-demo','$PROOF_USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userAgent"=EXCLUDED."userAgent", "userId"=EXCLUDED."userId";

INSERT INTO tenants (id, tenant_id, tenant_name, email, status, tier, api_key_hash, api_key_prefix, runtime_limit, capabilities_policy, created_at, updated_at)
VALUES ('$PROOF_TENANT_UUID'::uuid,'$PROOF_TENANT_ID','Action Task V1 Proof Demo','$PROOF_USER_EMAIL','active','seed','$PROOF_API_KEY_HASH','$PROOF_API_KEY_PREFIX',3,'{"allowed_capabilities":["tools.*"]}'::jsonb,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, email=EXCLUDED.email, status='active', tier='seed', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=3, capabilities_policy='{"allowed_capabilities":["tools.*"]}'::jsonb, updated_at=NOW();
SQL

echo "[5/11] Starting mock provider and action target server"
node "$UNIFIED_HELPER" serve-mock-provider 18090 > "$LOG_DIR/mock-provider.log" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:18090/health" "mock provider"

node "$ACTION_HELPER" serve-action-target "$ACTION_TARGET_PORT" "$DB_URL" > "$LOG_DIR/action-target.log" 2>&1 &
TARGET_PID=$!
wait_for_http "http://127.0.0.1:$ACTION_TARGET_PORT/health" "action target server"

echo "[6/11] Starting Overture"
(
  cd "$ROOT_DIR"
  env \
    PORT=8081 \
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
    IGRIS_RUNTIME_CALLBACK_BASE_URL="http://127.0.0.1:8081" \
    IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_NAME="Cookie" \
    IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_VALUE="better-auth.session_token=$PROOF_SESSION_TOKEN" \
    "$TMP_DIR/igris-overture"
) > "$LOG_DIR/overture.log" 2>&1 &
OVERTURE_PID=$!
wait_for_http "http://127.0.0.1:8081/healthz" "overture"

echo "[7/11] Registering Runtime instance (assigns runtime_id)"
node "$UNIFIED_HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$DEVICE_ID" \
  "action-task-v1-runtime" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:8080" > "$TMP_DIR/runtime-register.json"

curl -sS -f \
  -H "X-API-Key: $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-register.json" \
  "http://127.0.0.1:8081/api/v1/runtime/register" > "$TMP_DIR/runtime-register-response.json"
RUNTIME_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id || "")' "$TMP_DIR/runtime-register-response.json")
if [[ -z "$RUNTIME_ID" ]]; then
  echo "runtime registration did not return a runtime_id" >&2
  cat "$TMP_DIR/runtime-register-response.json" >&2
  exit 1
fi

# Enable the sandboxed local tools in the generated runtime config and pin the
# runtime's peer id to the registered runtime_id so the signed permission
# envelope's runtime binding verifies on the runtime side.
node "$ACTION_HELPER" inject-tools-config \
  "$TMP_DIR/runtime-config.json5" \
  "$TMP_DIR" \
  "127.0.0.1" \
  "$DB_WRITE_GATEWAY_URL" \
  "$RUNTIME_ID" > "$TMP_DIR/tools-config.json"

echo "    runtime_id:  $RUNTIME_ID"
echo "    tenant_id:   $PROOF_TENANT_ID"
echo "    input_file:  $INPUT_FILE"
echo "    process_url: $PROCESS_URL"
echo "    db gateway:  $DB_WRITE_GATEWAY_URL  (table: $ACTION_TABLE)"

echo "[8/11] Starting Runtime"
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
    IGRIS_RUNTIME_CALLBACK_EVIDENCE_LOG="$CALLBACK_EVIDENCE_LOG" \
    IGRIS_DB_WRITE_GATEWAY_URL="$DB_WRITE_GATEWAY_URL" \
    IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES="action_task_" \
    RUST_LOG="warn" \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:8080/v1/health" "runtime"

echo "[9/11] Submitting the Action Task"
TASK_ID=$(node -e 'process.stdout.write(require("crypto").randomUUID())')
node "$ACTION_HELPER" build-action-task-request \
  "$TMP_DIR/action-task-request.json" \
  "$TASK_ID" \
  "$INPUT_FILE" \
  "$PROCESS_URL" \
  "$ACTION_TABLE" > /dev/null
echo "    task_id:     $TASK_ID"
echo "    request:     $TMP_DIR/action-task-request.json"

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/action-task-request.json" \
  "http://127.0.0.1:8081/v1/tasks/submit" > "$TMP_DIR/task-accepted.json"

node - <<'NODE' "$TMP_DIR/task-accepted.json" "$TASK_ID"
const fs = require("fs");
const [acceptedPath, expectedTaskId] = process.argv.slice(2);
const body = JSON.parse(fs.readFileSync(acceptedPath, "utf8"));
function fail(msg) { throw new Error(msg); }
if (String(body.task_id) !== expectedTaskId) fail(`unexpected accepted task_id: ${body.task_id}`);
if (!body.links) fail("submit response missing `links`");
for (const key of ["task", "steps", "verify", "receipt_verify"]) {
  if (!body.links[key]) fail(`submit response links missing ${key}`);
}
NODE

wait_for_task_status "$TASK_ID" "completed" "$TMP_DIR/task-completed.json" 90 1

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/v1/tasks/$TASK_ID/steps" > "$TMP_DIR/task-steps.json"

EXECUTION_ID=$(node -e 'const fs=require("fs"); const body=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String((body.proof||{}).execution_id||""));' "$TMP_DIR/task-completed.json")
if [[ -z "$EXECUTION_ID" ]]; then
  echo "task_completed payload did not expose proof.execution_id" >&2
  cat "$TMP_DIR/task-completed.json" >&2
  exit 1
fi
echo "    execution_id: $EXECUTION_ID"

# Allow execution_lineage / execution_context writeback a moment to land.
for _ in {1..40}; do
  if curl -fsS "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/execution/runs/$EXECUTION_ID" > "$TMP_DIR/run-detail.json"; then
    break
  fi
  sleep 0.25
done

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/proof/receipts?limit=50&sort=timestamp:desc" > "$TMP_DIR/proof-receipts.json"

echo "[10/11] Verifying side effects and calling receipt-verify / task-verify"
# The db_write action committed a real row — confirm it directly in Postgres.
DB_ROW_ID=$(psql "$DB_URL" -qtAc "SELECT id::text FROM action_task_events WHERE task_id = '$TASK_ID' ORDER BY created_at DESC LIMIT 1" | tr -d '[:space:]')
if [[ -z "$DB_ROW_ID" ]]; then
  echo "no action_task_events row was written for task_id=$TASK_ID" >&2
  exit 1
fi
DB_ROW_COUNT=$(psql "$DB_URL" -qtAc "SELECT count(*) FROM action_task_events WHERE task_id = '$TASK_ID'" | tr -d '[:space:]')
if [[ "$DB_ROW_COUNT" != "1" ]]; then
  echo "expected exactly one action_task_events row for task_id=$TASK_ID, got $DB_ROW_COUNT" >&2
  psql "$DB_URL" -c "SELECT id, task_id, status, payload FROM action_task_events WHERE task_id = '$TASK_ID'" >&2
  exit 1
fi
DB_ROW_STATUS=$(psql "$DB_URL" -qtAc "SELECT status FROM action_task_events WHERE id = '$DB_ROW_ID'" | tr -d '[:space:]')
if [[ "$DB_ROW_STATUS" != "processed" ]]; then
  echo "action_task_events row status mismatch: expected processed, got '$DB_ROW_STATUS'" >&2
  exit 1
fi
# Cross-check: the runtime's reported db_write row id (in the persisted task
# evidence) must match the row that actually landed in Postgres.
RESPONSE_ROW_ID=$(node -e '
const fs=require("fs");
const body=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const cm=body.checkpoint_metadata||{};
let rid="";
if (typeof cm.output_preview==="string") { try { rid=(JSON.parse(cm.output_preview)||{}).row_id||""; } catch(e){} }
if (!rid && cm.graph_blackboard && cm.graph_blackboard.nodes) {
  for (const n of Object.values(cm.graph_blackboard.nodes)) {
    if (n && n.tool_name==="database_write" && n.metadata && n.metadata.row_id) { rid=n.metadata.row_id; break; }
  }
}
process.stdout.write(String(rid||""));
' "$TMP_DIR/task-completed.json")
if [[ -n "$RESPONSE_ROW_ID" && "$RESPONSE_ROW_ID" != "$DB_ROW_ID" ]]; then
  echo "runtime-reported db_write row_id ($RESPONSE_ROW_ID) does not match the Postgres row ($DB_ROW_ID)" >&2
  exit 1
fi
echo "    db row id: $DB_ROW_ID  (task_id=$TASK_ID, count=$DB_ROW_COUNT, status=$DB_ROW_STATUS, runtime-reported=${RESPONSE_ROW_ID:-n/a})"

if ! grep -q '"event":"process"' "$LOG_DIR/action-target.log"; then
  echo "the action target server did not record a /process call" >&2
  cat "$LOG_DIR/action-target.log" >&2
  exit 1
fi
if ! grep -q '"event":"db-write"' "$LOG_DIR/action-target.log"; then
  echo "the action target server did not record a /db-write call" >&2
  cat "$LOG_DIR/action-target.log" >&2
  exit 1
fi

# Chain-link verification at the source: the runtime's receipts.jsonl is a
# hash-chained log (genesis previous_hash="", each next == prior.hash). One
# receipt was emitted per committed action step.
node "$ACTION_HELPER" verify-receipt-chain "$TMP_DIR/receipts.jsonl" 3 > "$TMP_DIR/receipt-chain.json"
echo "    runtime receipt chain: $(cat "$TMP_DIR/receipt-chain.json")"
# Tie the persisted, cryptographically-verified receipt to the verified chain:
# it must be the head (last entry) of the runtime's receipt log.
CHAIN_LAST_HASH=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).last_hash || "")' "$TMP_DIR/receipt-chain.json")
RECEIPT_HASH=$(node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(String((b.execution_receipt||{}).hash || (b.receipt||{}).receipt_hash || ""))' "$TMP_DIR/task-completed.json")
if [[ -z "$RECEIPT_HASH" || "$RECEIPT_HASH" != "$CHAIN_LAST_HASH" ]]; then
  echo "persisted receipt hash ($RECEIPT_HASH) is not the head of the runtime receipt chain ($CHAIN_LAST_HASH)" >&2
  exit 1
fi

# Per-step receipts must be persisted in Overture (execution_lineage), one row
# per committed step, no duplicates. The proof tenant is brand new this run.
LINEAGE_TOTAL=$(psql "$DB_URL" -qtAc "SELECT count(*) FROM execution_lineage WHERE tenant_id = '$PROOF_TENANT_ID'" | tr -d '[:space:]')
LINEAGE_DISTINCT=$(psql "$DB_URL" -qtAc "SELECT count(DISTINCT execution_id) FROM execution_lineage WHERE tenant_id = '$PROOF_TENANT_ID'" | tr -d '[:space:]')
if [[ "${LINEAGE_TOTAL:-0}" -lt 3 ]]; then
  echo "expected at least 3 per-step receipts persisted in execution_lineage for tenant $PROOF_TENANT_ID, got ${LINEAGE_TOTAL:-0}" >&2
  psql "$DB_URL" -c "SELECT execution_id, runtime_id, left(receipt_hash,12) AS hash, left(previous_hash,12) AS prev FROM execution_lineage WHERE tenant_id = '$PROOF_TENANT_ID' ORDER BY timestamp_utc" >&2
  exit 1
fi
if [[ "$LINEAGE_TOTAL" != "$LINEAGE_DISTINCT" ]]; then
  echo "execution_lineage has duplicate receipt rows for tenant $PROOF_TENANT_ID ($LINEAGE_TOTAL rows, $LINEAGE_DISTINCT distinct execution_ids)" >&2
  exit 1
fi
echo "    persisted per-step receipts: $LINEAGE_TOTAL (distinct execution_ids: $LINEAGE_DISTINCT)"

node "$UNIFIED_HELPER" build-verify-request "$TMP_DIR/task-completed.json" > "$TMP_DIR/task-verify-request.json"
VERIFY_HTTP_STATUS=$(curl -sS \
  -o "$TMP_DIR/proof-receipt-verify-response.json" \
  -w "%{http_code}" \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/task-verify-request.json" \
  "http://127.0.0.1:8081/proof/receipts/verify")
TASK_PROOF_HTTP_STATUS=$(curl -sS \
  -o "$TMP_DIR/task-proof-response.json" \
  -w "%{http_code}" \
  "${AUTH_ARGS[@]}" \
  -X POST \
  "http://127.0.0.1:8081/v1/tasks/$TASK_ID/proof/verify")

# Re-fetch the task detail *after* verification: the safe proof-verification
# summary (verified / hash_valid / signature_matches / runtime_key_found /
# chain_link_valid) must now be persisted on task.proof — no second verify
# click required.
curl -sS -f \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/v1/tasks/$TASK_ID" > "$TMP_DIR/task-after-verify.json"

echo "[11/11] Validating Action Task V1 evidence"
node "$ACTION_HELPER" verify-action-evidence \
  "$TMP_DIR/task-completed.json" \
  "$TMP_DIR/task-steps.json" \
  "$TMP_DIR/run-detail.json" \
  "$TMP_DIR/proof-receipts.json" \
  "$TMP_DIR/proof-receipt-verify-response.json" \
  "$TASK_ID" \
  "$DB_ROW_ID" \
  "$TMP_DIR/task-after-verify.json"

if [[ ! -s "$CALLBACK_EVIDENCE_LOG" ]]; then
  echo "runtime did not write signed callback evidence" >&2
  exit 1
fi
node - <<'NODE' "$CALLBACK_EVIDENCE_LOG" "$TASK_ID" "$RUNTIME_ID"
const fs = require("fs");
const [path, taskId, runtimeId] = process.argv.slice(2);
const rows = fs.readFileSync(path, "utf8").trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
function fail(msg) { throw new Error(msg); }
if (!rows.length) fail("no callback evidence rows");
for (const row of rows) {
  if (row.task_id !== taskId) fail(`callback task_id mismatch: ${row.task_id}`);
  if (row.runtime_id !== runtimeId) fail(`callback runtime_id mismatch: ${row.runtime_id}`);
  if (!row.accepted || row.status_code < 200 || row.status_code >= 300) fail(`callback not accepted: ${JSON.stringify(row)}`);
  if (!/^[a-f0-9]{64}$/.test(row.body_digest || "")) fail("callback evidence missing sha256 body digest");
}
const types = new Set(rows.map((row) => row.callback_type));
if (!types.has("complete")) fail("complete callback was not accepted");
if (!types.has("checkpoint")) fail("checkpoint callback was not accepted");
console.log(`    signed runtime callbacks: ${rows.length} accepted (${[...types].sort().join(", ")})`);
NODE

echo ""
echo "    task_id:                       $TASK_ID"
echo "    runtime_id:                    $RUNTIME_ID"
echo "    execution_id:                  $EXECUTION_ID"
echo "    db row id:                     $DB_ROW_ID"
echo "    receipt verify HTTP status:    $VERIFY_HTTP_STATUS"
echo "    task verify HTTP status:       $TASK_PROOF_HTTP_STATUS"
echo "    callback evidence:             $CALLBACK_EVIDENCE_LOG"
echo "    artifacts:                     $TMP_DIR"
if [[ -n "$CONSOLE_BASE_URL" ]]; then
  echo "    Console Task Inspector:        $CONSOLE_BASE_URL/execution/tasks/$TASK_ID"
fi
