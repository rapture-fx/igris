#!/bin/zsh

# Checkpoint and Recovery Proof Demo
#
# Proves a narrow, evidence-backed checkpoint/recovery path using the existing
# Overture durable-task flow and the Runtime WAL:
#
# 1. Submit a durable task through Overture.
# 2. Runtime 1 hits a 1ms budget and returns a real checkpoint.
# 3. Overture persists that checkpoint in task_records + wal_checkpoints.
# 4. Runtime 1 is interrupted.
# 5. Runtime 2 starts on the same host, reusing the persisted Runtime WAL store.
# 6. Overture's failed-runtime recovery loop redispatches the task with the
#    persisted checkpoint.
# 7. Runtime 2 resumes from the next step and completes.
#
# This demonstrates process-interruption recovery with persisted evidence. It
# does NOT claim clean-host failover with an empty WAL store.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-checkpoint-proof.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"

if [[ -z "${DATABASE_URL:-}" && -z "${POSTGRES_URL:-}" && -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env" >/dev/null 2>&1 || true
  set +a
fi
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

MOCK_PID=""
RUNTIME_PID=""
OVERTURE_PID=""

cleanup() {
  for pid in "$OVERTURE_PID" "$RUNTIME_PID" "$MOCK_PID"; do
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
    echo "port $port is already in use; free it before running the checkpoint proof demo" >&2
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

poll_task_status() {
  local task_id="$1"
  curl -sS \
    "${AUTH_ARGS[@]}" \
    "http://127.0.0.1:8081/v1/tasks/$task_id"
}

wait_for_task_status() {
  local task_id="$1"
  local wanted="$2"
  local out_path="$3"
  local history_path="$4"
  local attempts="${5:-90}"
  local sleep_s="${6:-1}"

  : > "$history_path"
  for _ in $(seq 1 "$attempts"); do
    poll_task_status "$task_id" > "$out_path"
    local task_state
    task_state=$(node -e 'const fs=require("fs"); const body=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(body.status||""));' "$out_path")
    printf '%s\n' "$task_state" >> "$history_path"
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

query_json() {
  local sql="$1"
  local out_path="$2"
  psql "$DB_URL" -X -tAqc "$sql" > "$out_path"
}

require_cmd node
require_cmd cargo
require_cmd go
require_cmd curl
require_cmd lsof
require_cmd psql

if [[ -z "$DB_URL" ]]; then
  echo "DATABASE_URL or POSTGRES_URL is required for the checkpoint persistence proof" >&2
  exit 1
fi

TASK_RECORDS_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.task_records')" 2>/dev/null | tr -d '[:space:]')
WAL_CHECKPOINTS_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.wal_checkpoints')" 2>/dev/null | tr -d '[:space:]')
EXECUTION_CONTEXT_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.execution_context')" 2>/dev/null | tr -d '[:space:]')
if [[ "$TASK_RECORDS_TABLE" != "task_records" || "$WAL_CHECKPOINTS_TABLE" != "wal_checkpoints" || "$EXECUTION_CONTEXT_TABLE" != "execution_context" ]]; then
  echo "required tables (task_records, wal_checkpoints, execution_context) are not all present; apply durable-task + execution-context migrations first" >&2
  exit 1
fi

check_port_free 8080
check_port_free 8081
check_port_free 18090

echo "[1/10] Preparing checkpoint proof artifacts in $TMP_DIR"
node "$HELPER" prepare-checkpoint "$TMP_DIR" > "$TMP_DIR/prepare.json"
node "$HELPER" proof-access-material > "$TMP_DIR/proof-access.json"

TASK_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).task_id)' "$TMP_DIR/prepare.json")
DEVICE_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).device_id)' "$TMP_DIR/meta.json")
RUNTIME_SECRET=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_secret)' "$TMP_DIR/meta.json")
LICENSE_PUBLIC_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).license_public_key_hex)' "$TMP_DIR/meta.json")
OVERTURE_PUBLIC_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).overture_public_key_hex)' "$TMP_DIR/meta.json")
OVERTURE_PRIVATE_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).overture_private_key_hex)' "$TMP_DIR/meta.json")

PROOF_TENANT_UUID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenant_uuid)' "$TMP_DIR/proof-access.json")
PROOF_TENANT_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenant_id)' "$TMP_DIR/proof-access.json")
PROOF_USER_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).user_id)' "$TMP_DIR/proof-access.json")
PROOF_USER_EMAIL=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).user_email)' "$TMP_DIR/proof-access.json")
PROOF_SESSION_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).session_id)' "$TMP_DIR/proof-access.json")
PROOF_SESSION_TOKEN=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).session_token)' "$TMP_DIR/proof-access.json")
PROOF_RAW_API_KEY=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).raw_api_key)' "$TMP_DIR/proof-access.json")
PROOF_API_KEY_HASH=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).api_key_hash)' "$TMP_DIR/proof-access.json")
PROOF_API_KEY_PREFIX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).api_key_prefix)' "$TMP_DIR/proof-access.json")

RUNTIME_1_MACHINE_ID="$DEVICE_ID"
RUNTIME_2_MACHINE_ID="${DEVICE_ID}-recovery"
RUNTIME_1_PEER_ID="checkpoint-runtime-1"
RUNTIME_2_PEER_ID="checkpoint-runtime-2"
RUNTIME_SHARED_DB="$TMP_DIR/runtime-shared.db"
RUNTIME_1_CONFIG="$TMP_DIR/runtime-1-config.json5"
RUNTIME_2_CONFIG="$TMP_DIR/runtime-2-config.json5"
AUTH_ARGS=(-H "Cookie: better-auth.session_token=$PROOF_SESSION_TOKEN")

node - <<'NODE' "$TMP_DIR/runtime-config.json5" "$RUNTIME_SHARED_DB" "$RUNTIME_1_CONFIG" "$RUNTIME_2_CONFIG" "$RUNTIME_1_PEER_ID" "$RUNTIME_2_PEER_ID"
const fs = require("fs");
const [basePath, storagePath, out1, out2, peer1, peer2] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));

function build(peerId) {
  const next = JSON.parse(JSON.stringify(base));
  next.storage.path = storagePath;
  next.mcp = next.mcp || {};
  next.mcp.peer_id = peerId;
  return `${JSON.stringify(next, null, 2)}\n`;
}

fs.writeFileSync(out1, build(peer1));
fs.writeFileSync(out2, build(peer2));
NODE

node - <<'NODE' "$TMP_DIR/prepare.json" "$TMP_DIR/overture-task-request.json"
const fs = require("fs");
const prep = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const runtimeReq = JSON.parse(fs.readFileSync(prep.checkpoint_request_path, "utf8"));
const taskReq = {
  task_id: runtimeReq.task_id,
  task_type: "agent_workflow",
  task_definition: { steps: runtimeReq.task_type.steps },
  idempotency_key: runtimeReq.idempotency_key,
  deadline_at: new Date(1).toISOString(),
};
fs.writeFileSync(process.argv[3], JSON.stringify(taskReq, null, 2));
NODE

echo "    task_id: $TASK_ID"
echo "    tenant_id: $PROOF_TENANT_ID"
echo "    runtime 1 peer_id: $RUNTIME_1_PEER_ID"
echo "    runtime 2 peer_id: $RUNTIME_2_PEER_ID"
echo "    recovery mode: same-host shared WAL store + Overture redispatch"

echo "[2/10] Building Runtime binary"
RUNTIME_BIN="$ROOT_DIR/igris-runtime/target/debug/igris-runtime"
if [[ ! -x "$RUNTIME_BIN" ]]; then
  cargo build --manifest-path "$ROOT_DIR/igris-runtime/Cargo.toml" -p igris-server --bin igris-runtime
else
  echo "    Reusing existing Runtime binary"
fi

echo "[3/10] Building Overture binary"
GOCACHE="$TMP_DIR/go-cache" GOPROXY=off GOSUMDB=off GOFLAGS="-mod=readonly -buildvcs=false" \
  go build -o "$TMP_DIR/igris-overture" ./cmd/igris-overture

echo "[4/10] Seeding temporary tenant, session, and API key"
psql "$DB_URL" <<SQL >/dev/null
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$PROOF_USER_ID','Checkpoint Proof Demo','$PROOF_USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$PROOF_SESSION_ID',NOW()+INTERVAL '2 hours','$PROOF_SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','checkpoint-proof-demo','$PROOF_USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userAgent"=EXCLUDED."userAgent", "userId"=EXCLUDED."userId";

INSERT INTO tenants (id, tenant_id, tenant_name, email, status, tier, api_key_hash, api_key_prefix, runtime_limit, created_at, updated_at)
VALUES ('$PROOF_TENANT_UUID'::uuid,'$PROOF_TENANT_ID','Checkpoint Proof Demo','$PROOF_USER_EMAIL','active','seed','$PROOF_API_KEY_HASH','$PROOF_API_KEY_PREFIX',3,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, email=EXCLUDED.email, status='active', tier='seed', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=3, updated_at=NOW();
SQL

echo "[5/10] Starting mock provider, Runtime 1, and Overture"
node "$HELPER" serve-mock-provider 18090 > "$LOG_DIR/mock-provider.log" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:18090/health" "mock provider"

(
  cd "$ROOT_DIR"
  env \
    RUNTIME_MOCK_KEY=dummy \
    IGRIS_ALLOW_INSECURE_DEV_MODE=true \
    IGRIS_CONFIG="$RUNTIME_1_CONFIG" \
    IGRIS_DEVICE_ID="$RUNTIME_1_MACHINE_ID" \
    IGRIS_OFFLINE_LICENSE_PATH="$TMP_DIR/offline-license.json" \
    IGRIS_LICENSE_OFFLINE_PUBLIC_KEY="$LICENSE_PUBLIC_KEY_HEX" \
    IGRIS_OVERTURE_PUBLIC_KEY="$OVERTURE_PUBLIC_KEY_HEX" \
    IGRIS_RECEIPT_LOG="$TMP_DIR/runtime-1-receipts.jsonl" \
    RUST_LOG="warn" \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime-1.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:8080/v1/health" "runtime 1"

RUNTIME_PUBLIC_KEY_HEX=$(node "$HELPER" runtime-public-key "$ROOT_DIR/.igris/runtime-signing-key.ed25519")

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
    "$TMP_DIR/igris-overture"
) > "$LOG_DIR/overture.log" 2>&1 &
OVERTURE_PID=$!
wait_for_http "http://127.0.0.1:8081/healthz" "overture"

echo "[6/10] Registering Runtime 1 and submitting the durable task through Overture"
node "$HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$RUNTIME_1_MACHINE_ID" \
  "checkpoint-runtime-1" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:8080" > "$TMP_DIR/runtime-1-register.json"

curl -sS -f \
  -H "X-API-Key: $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-1-register.json" \
  "http://127.0.0.1:8081/api/v1/runtime/register" > "$TMP_DIR/runtime-1-register-response.json"

RUNTIME_1_REGISTRY_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id)' "$TMP_DIR/runtime-1-register-response.json")

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/overture-task-request.json" \
  "http://127.0.0.1:8081/v1/tasks/submit" > "$TMP_DIR/task-accepted.json"

wait_for_task_status \
  "$TASK_ID" \
  "checkpointed" \
  "$TMP_DIR/task-after-checkpoint.json" \
  "$TMP_DIR/task-status-history-before-recovery.txt" \
  90 \
  1

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/v1/tasks/$TASK_ID/steps" > "$TMP_DIR/task-steps-after-checkpoint.json"

query_json "SELECT row_to_json(t) FROM (
  SELECT
    status,
    COALESCE(runtime_id, '') AS runtime_id,
    COALESCE(last_checkpoint->'resume_token'->>'last_committed_step', '') AS last_committed_step,
    COALESCE(last_checkpoint->'resume_token'->>'runtime_id', '') AS checkpoint_runtime_id,
    COALESCE(last_checkpoint->'resume_token'->>'checkpoint_digest', '') AS checkpoint_digest,
    proof_execution_id,
    proof_expected_hash,
    COALESCE(proof_status, '') AS proof_status,
    execution_envelope IS NOT NULL AS execution_envelope_present,
    execution_receipt IS NOT NULL AS execution_receipt_present
  FROM task_records
  WHERE task_id = '$TASK_ID'::uuid
    AND tenant_id = '$PROOF_TENANT_ID'
) t;" "$TMP_DIR/db-task-after-checkpoint.json"

query_json "SELECT json_build_object(
  'count', COUNT(*),
  'rows', COALESCE(json_agg(json_build_object(
    'step_index', step_index,
    'resume_last_step', wal_entries->'resume_token'->>'last_committed_step',
    'resume_runtime_id', wal_entries->'resume_token'->>'runtime_id',
    'wal_entry_count', jsonb_array_length(wal_entries->'wal_entries')
  ) ORDER BY step_index), '[]'::json)
) FROM wal_checkpoints
WHERE task_id = '$TASK_ID'::uuid;" "$TMP_DIR/db-wal-checkpoints-after-checkpoint.json"

echo "    Checkpoint persisted for task $TASK_ID"

echo "[7/10] Interrupting Runtime 1, starting Runtime 2 on the same WAL store, and triggering coordinator recovery"
kill "$RUNTIME_PID" >/dev/null 2>&1 || true
wait "$RUNTIME_PID" >/dev/null 2>&1 || true
RUNTIME_PID=""
sleep 1

(
  cd "$ROOT_DIR"
  env \
    RUNTIME_MOCK_KEY=dummy \
    IGRIS_ALLOW_INSECURE_DEV_MODE=true \
    IGRIS_CONFIG="$RUNTIME_2_CONFIG" \
    IGRIS_DEVICE_ID="$RUNTIME_2_MACHINE_ID" \
    IGRIS_OFFLINE_LICENSE_PATH="$TMP_DIR/offline-license.json" \
    IGRIS_LICENSE_OFFLINE_PUBLIC_KEY="$LICENSE_PUBLIC_KEY_HEX" \
    IGRIS_OVERTURE_PUBLIC_KEY="$OVERTURE_PUBLIC_KEY_HEX" \
    IGRIS_RECEIPT_LOG="$TMP_DIR/runtime-2-receipts.jsonl" \
    RUST_LOG="warn" \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime-2.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:8080/v1/health" "runtime 2"

node "$HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$RUNTIME_2_MACHINE_ID" \
  "checkpoint-runtime-2" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:8080" > "$TMP_DIR/runtime-2-register.json"

curl -sS -f \
  -H "X-API-Key: $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-2-register.json" \
  "http://127.0.0.1:8081/api/v1/runtime/register" > "$TMP_DIR/runtime-2-register-response.json"

RUNTIME_2_REGISTRY_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id)' "$TMP_DIR/runtime-2-register-response.json")

psql "$DB_URL" -X -q <<SQL >/dev/null
UPDATE runtime_instances
SET last_heartbeat = NOW() - INTERVAL '120 seconds'
WHERE tenant_id = '$PROOF_TENANT_ID'
  AND machine_id = '$RUNTIME_1_MACHINE_ID';
SQL

wait_for_task_status \
  "$TASK_ID" \
  "completed" \
  "$TMP_DIR/task-after-recovery.json" \
  "$TMP_DIR/task-status-history-after-recovery.txt" \
  90 \
  1

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/v1/tasks/$TASK_ID/steps" > "$TMP_DIR/task-steps-after-recovery.json"

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/v1/tasks" > "$TMP_DIR/task-list.json"

node "$HELPER" build-verify-request "$TMP_DIR/task-after-recovery.json" > "$TMP_DIR/task-proof-verify-request.json"

VERIFY_HTTP_STATUS=$(curl -sS \
  -o "$TMP_DIR/proof-receipt-verify-response.json" \
  -w "%{http_code}" \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/task-proof-verify-request.json" \
  "http://127.0.0.1:8081/proof/receipts/verify")

curl -sS \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/proof/receipts?limit=50" > "$TMP_DIR/proof-receipts.json"

curl -sS \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/v1/execution/runs?limit=50" > "$TMP_DIR/execution-runs.json"

TASK_PROOF_HTTP_STATUS=$(curl -sS \
  -o "$TMP_DIR/task-proof-response.json" \
  -w "%{http_code}" \
  "${AUTH_ARGS[@]}" \
  -X POST \
  "http://127.0.0.1:8081/v1/tasks/$TASK_ID/proof/verify")

FINAL_EXECUTION_ID=$(node -e 'const fs=require("fs"); const body=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String((body.execution_receipt||{}).execution_id||""));' "$TMP_DIR/task-after-recovery.json")

query_json "SELECT row_to_json(t) FROM (
  SELECT
    status,
    COALESCE(runtime_id, '') AS runtime_id,
    COALESCE(last_checkpoint->'resume_token'->>'last_committed_step', '') AS last_committed_step,
    COALESCE(last_checkpoint->'resume_token'->>'runtime_id', '') AS checkpoint_runtime_id,
    COALESCE(last_checkpoint->'resume_token'->>'checkpoint_digest', '') AS checkpoint_digest,
    proof_execution_id,
    proof_expected_hash,
    COALESCE(proof_status, '') AS proof_status,
    execution_envelope IS NOT NULL AS execution_envelope_present,
    execution_receipt IS NOT NULL AS execution_receipt_present
  FROM task_records
  WHERE task_id = '$TASK_ID'::uuid
    AND tenant_id = '$PROOF_TENANT_ID'
) t;" "$TMP_DIR/db-task-after-recovery.json"

query_json "SELECT json_build_object(
  'count', COUNT(*),
  'rows', COALESCE(json_agg(json_build_object(
    'step_index', step_index,
    'resume_last_step', wal_entries->'resume_token'->>'last_committed_step',
    'resume_runtime_id', wal_entries->'resume_token'->>'runtime_id',
    'wal_entry_count', jsonb_array_length(wal_entries->'wal_entries')
  ) ORDER BY step_index), '[]'::json)
) FROM wal_checkpoints
WHERE task_id = '$TASK_ID'::uuid;" "$TMP_DIR/db-wal-checkpoints-after-recovery.json"

query_json "SELECT row_to_json(t) FROM (
  SELECT
    execution_id,
    COALESCE(runtime_id, '') AS runtime_id,
    COALESCE(runtime_label, '') AS runtime_label,
    COALESCE(route_decision, '') AS route_decision,
    COALESCE(verification_status, '') AS verification_status,
    COALESCE(receipt_hash, '') AS receipt_hash
  FROM execution_context
  WHERE task_id = '$TASK_ID'::uuid
  ORDER BY updated_at DESC
  LIMIT 1
) t;" "$TMP_DIR/db-execution-context.json"

query_json "SELECT COALESCE(json_build_object('count', COUNT(*)), '{\"count\":0}'::json)::text
FROM execution_lineage
WHERE execution_id = '$FINAL_EXECUTION_ID';" "$TMP_DIR/db-execution-lineage-count.json"

echo "[8/10] Validating persisted checkpoint/recovery evidence"
node - <<'NODE' \
  "$TMP_DIR/task-after-checkpoint.json" \
  "$TMP_DIR/task-after-recovery.json" \
  "$TMP_DIR/task-steps-after-checkpoint.json" \
  "$TMP_DIR/task-steps-after-recovery.json" \
  "$TMP_DIR/db-task-after-checkpoint.json" \
  "$TMP_DIR/db-task-after-recovery.json" \
  "$TMP_DIR/db-wal-checkpoints-after-checkpoint.json" \
  "$TMP_DIR/db-wal-checkpoints-after-recovery.json" \
  "$RUNTIME_1_PEER_ID" \
  "$RUNTIME_2_PEER_ID" \
  "$RUNTIME_2_REGISTRY_ID"
const fs = require("fs");
const [
  checkpointTaskPath,
  finalTaskPath,
  checkpointStepsPath,
  finalStepsPath,
  dbCheckpointPath,
  dbFinalPath,
  dbCheckpointWalPath,
  dbFinalWalPath,
  runtime1PeerId,
  runtime2PeerId,
  runtime2RegistryId,
] = process.argv.slice(2);

function read(path) {
  const raw = fs.readFileSync(path, "utf8").trim();
  return raw ? JSON.parse(raw) : null;
}

function fail(msg) {
  throw new Error(msg);
}

const checkpointTask = read(checkpointTaskPath);
const finalTask = read(finalTaskPath);
const checkpointSteps = read(checkpointStepsPath);
const finalSteps = read(finalStepsPath);
const dbCheckpoint = read(dbCheckpointPath);
const dbFinal = read(dbFinalPath);
const dbCheckpointWal = read(dbCheckpointWalPath);
const dbFinalWal = read(dbFinalWalPath);

if (checkpointTask.status !== "checkpointed") {
  fail(`expected checkpointed task status, got ${checkpointTask.status}`);
}
if (finalTask.status !== "completed") {
  fail(`expected completed task status, got ${finalTask.status}`);
}
if (String(dbCheckpoint.last_committed_step) !== "0") {
  fail(`expected checkpoint last_committed_step=0, got ${dbCheckpoint.last_committed_step}`);
}
if (dbFinal.runtime_id !== runtime2RegistryId) {
  fail(`expected final task runtime_id=${runtime2RegistryId}, got ${dbFinal.runtime_id}`);
}
if (dbCheckpoint.checkpoint_runtime_id !== runtime1PeerId) {
  fail(`expected checkpoint runtime_id=${runtime1PeerId}, got ${dbCheckpoint.checkpoint_runtime_id}`);
}
if (dbFinal.checkpoint_runtime_id !== runtime2PeerId) {
  fail(`expected final checkpoint runtime_id=${runtime2PeerId}, got ${dbFinal.checkpoint_runtime_id}`);
}
if (!dbFinal.execution_envelope_present || !dbFinal.execution_receipt_present) {
  fail("expected final execution artifacts to be persisted on task_records");
}
if (!Array.isArray(checkpointSteps.steps) || checkpointSteps.total !== 1) {
  fail("expected exactly one persisted step after checkpoint");
}
if (!Array.isArray(finalSteps.steps) || finalSteps.total !== 5) {
  fail(`expected five persisted steps after recovery, got ${finalSteps.total}`);
}
const stepIndices = finalSteps.steps.map((step) => step.step_index);
const stepRuntimeIds = finalSteps.steps.map((step) => String(step.runtime_id || ""));
if (JSON.stringify(stepIndices) !== JSON.stringify([0, 1, 2, 3, 4])) {
  fail(`unexpected step indices after recovery: ${JSON.stringify(stepIndices)}`);
}
if (stepRuntimeIds[0] !== runtime1PeerId) {
  fail(`expected step 0 runtime_id=${runtime1PeerId}, got ${stepRuntimeIds[0]}`);
}
if (!stepRuntimeIds.slice(1).every((value) => value === runtime2PeerId)) {
  fail(`expected recovered steps to use runtime_id=${runtime2PeerId}, got ${JSON.stringify(stepRuntimeIds)}`);
}
if ((dbCheckpointWal && dbCheckpointWal.count) !== 1) {
  fail(`expected 1 wal_checkpoints row after checkpoint, got ${dbCheckpointWal && dbCheckpointWal.count}`);
}
if ((dbFinalWal && dbFinalWal.count) !== 2) {
  fail(`expected 2 wal_checkpoints rows after recovery, got ${dbFinalWal && dbFinalWal.count}`);
}
const walStepIndices = (dbFinalWal.rows || []).map((row) => row.step_index);
if (JSON.stringify(walStepIndices) !== JSON.stringify([0, 4])) {
  fail(`unexpected wal_checkpoints step indices: ${JSON.stringify(walStepIndices)}`);
}

console.log("Checkpoint and recovery proof succeeded.");
console.log("");
console.log(`Checkpointed task status: ${checkpointTask.status}`);
console.log(`Recovered task status:    ${finalTask.status}`);
console.log(`Persisted task steps:     ${finalSteps.total}`);
console.log(`Runtime split by step:    ${JSON.stringify(stepRuntimeIds)}`);
console.log(`wal_checkpoints rows:     ${dbFinalWal.count}`);
console.log(`task_records runtime_id:  ${dbFinal.runtime_id}`);
console.log(`Final checkpoint runtime: ${dbFinal.checkpoint_runtime_id}`);
NODE

echo "[9/10] Capturing recovery logs and API visibility results"
grep -n "Recovering tasks from failed runtime\\|Redispatching recovered task" "$LOG_DIR/overture.log" > "$TMP_DIR/overture-recovery-log-snippets.txt" || true

echo "[10/10] Final artifacts"
echo "    task_id: $TASK_ID"
echo "    runtime 1 registry_id: $RUNTIME_1_REGISTRY_ID"
echo "    runtime 2 registry_id: $RUNTIME_2_REGISTRY_ID"
echo "    proof receipt verify HTTP status: $VERIFY_HTTP_STATUS"
echo "    task proof verify HTTP status: $TASK_PROOF_HTTP_STATUS"
echo "    artifacts: $TMP_DIR"
