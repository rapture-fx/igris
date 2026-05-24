#!/bin/zsh

# Action Task V1 Recovery Proof Demo
#
# Proves a real recovery path for a multi-step action task:
#   read_file -> http_call -> db_write
#
# Runtime 1 commits read_file + http_call, returns a real
# checkpoint_after_steps checkpoint, and is interrupted. By default Runtime 2
# starts with the same WAL store. Set ACTION_TASK_CLEAN_HOST_RECOVERY=true to
# require a distinct empty Runtime 2 WAL store and resume only from Overture's
# persisted checkpoint payload. The script asserts HTTP and DB side effects are
# not duplicated, WAL step indexes are unique, and receipts remain verifiable.

set -euo pipefail
setopt TYPESET_SILENT

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
UNIFIED_HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
ACTION_HELPER="$SCRIPT_DIR/action_task_v1_proof_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-action-v1-recovery-proof.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"
CLEAN_HOST_MODE="${ACTION_TASK_CLEAN_HOST_RECOVERY:-false}"
CUMULATIVE_CLEAN_HOST_MODE="${ACTION_TASK_CUMULATIVE_CLEAN_HOST_RECOVERY:-false}"

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
    echo "port $port is already in use; free it before running the action recovery proof" >&2
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
    curl -sS "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/tasks/$task_id" > "$out_path"
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

wait_for_task_checkpoint_step() {
  local task_id="$1"
  local wanted_step="$2"
  local out_path="$3"
  local attempts="${4:-90}"
  local sleep_s="${5:-1}"

  for _ in $(seq 1 "$attempts"); do
    curl -sS "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/tasks/$task_id" > "$out_path"
    local result
    result=$(node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const status = String(body.status || "");
const step = Number(body.last_step ?? (body.checkpoint_summary || {}).last_committed_step ?? -1);
process.stdout.write(JSON.stringify({ status, step }));
' "$out_path")
    local task_state
    task_state=$(node -e 'const body=JSON.parse(process.argv[1]); process.stdout.write(body.status);' "$result")
    local step
    step=$(node -e 'const body=JSON.parse(process.argv[1]); process.stdout.write(String(body.step));' "$result")
    if [[ "$task_state" == "failed" ]]; then
      echo "task $task_id failed while waiting for checkpoint step=$wanted_step" >&2
      cat "$out_path" >&2
      exit 1
    fi
    if [[ "$step" == "$wanted_step" ]]; then
      return 0
    fi
    sleep "$sleep_s"
  done

  echo "task $task_id did not reach checkpoint step=$wanted_step in time" >&2
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
  echo "DATABASE_URL or POSTGRES_URL is required for the action recovery proof" >&2
  exit 1
fi

TASK_RECORDS_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.task_records')" 2>/dev/null | tr -d '[:space:]' || true)
WAL_CHECKPOINTS_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.wal_checkpoints')" 2>/dev/null | tr -d '[:space:]' || true)
EXECUTION_CONTEXT_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.execution_context')" 2>/dev/null | tr -d '[:space:]' || true)
EXECUTION_LINEAGE_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.execution_lineage')" 2>/dev/null | tr -d '[:space:]' || true)
if [[ "$TASK_RECORDS_TABLE" != "task_records" || "$WAL_CHECKPOINTS_TABLE" != "wal_checkpoints" || "$EXECUTION_CONTEXT_TABLE" != "execution_context" || "$EXECUTION_LINEAGE_TABLE" != "execution_lineage" ]]; then
  echo "required tables (task_records, wal_checkpoints, execution_context, execution_lineage) are not all present; apply durable-task + execution-context migrations first" >&2
  exit 1
fi

check_port_free 8080
check_port_free 8081
check_port_free 18090
check_port_free "$ACTION_TARGET_PORT"

echo "[1/11] Preparing Action Task V1 recovery proof artifacts in $TMP_DIR"
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
TASK_ID=$(node -e 'process.stdout.write(require("crypto").randomUUID())')
if [[ "$CLEAN_HOST_MODE" == "true" ]]; then
  RUNTIME_1_DB="$TMP_DIR/runtime-1-clean-host.db"
  RUNTIME_2_DB="$TMP_DIR/runtime-2-clean-host.db"
else
  RUNTIME_1_DB="$TMP_DIR/runtime-shared.db"
  RUNTIME_2_DB="$RUNTIME_1_DB"
fi
RUNTIME_1_PEER_ID="action-recovery-runtime-1"
RUNTIME_1B_PEER_ID="action-recovery-runtime-1b"
RUNTIME_2_PEER_ID="action-recovery-runtime-2"
RUNTIME_1_MACHINE_ID="$DEVICE_ID"
RUNTIME_1B_MACHINE_ID="${DEVICE_ID}-checkpoint-2"
RUNTIME_2_MACHINE_ID="${DEVICE_ID}-recovery"
RUNTIME_1_CONFIG="$TMP_DIR/runtime-1-config.json5"
RUNTIME_2_CONFIG="$TMP_DIR/runtime-2-config.json5"
INPUT_FILE="$TMP_DIR/igris-action-input.txt"
printf 'igris action task recovery proof input payload-token=%s\n' "$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')" > "$INPUT_FILE"

node - <<'NODE' "$TMP_DIR/runtime-config.json5" "$RUNTIME_1_DB" "$RUNTIME_2_DB" "$RUNTIME_1_CONFIG" "$RUNTIME_2_CONFIG" "$RUNTIME_1_PEER_ID" "$RUNTIME_2_PEER_ID" "$TMP_DIR" "$DB_WRITE_GATEWAY_URL" > "$TMP_DIR/runtime-config-paths.json"
const fs = require("fs");
const [basePath, storage1, storage2, out1, out2, peer1, peer2, allowedFsPath, dbGatewayUrl] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));

function build(peerId, storagePath) {
  const next = JSON.parse(JSON.stringify(base));
  next.storage.path = storagePath;
  next.mcp = Object.assign({}, next.mcp || {}, { peer_id: peerId });
  next.tools = {
    enabled: true,
    enable_http: true,
    enable_shell: false,
    enable_filesystem: true,
    allowed_http_domains: ["127.0.0.1"],
    allowed_shell_commands: [],
    allowed_shell_working_dirs: [],
    allowed_filesystem_paths: [allowedFsPath],
    max_execution_time_ms: 30000,
    max_concurrent_executions: 5,
  };
  return `${JSON.stringify(next, null, 2)}\n`;
}

fs.writeFileSync(out1, build(peer1, storage1));
fs.writeFileSync(out2, build(peer2, storage2));
console.log(JSON.stringify({ runtime_1_storage_path: storage1, runtime_2_storage_path: storage2, db_write_gateway_url: dbGatewayUrl }));
NODE

if [[ "$CUMULATIVE_CLEAN_HOST_MODE" == "true" ]]; then
  node - <<'NODE' "$TMP_DIR/action-task-request.json" "$TASK_ID" "$INPUT_FILE" "$PROCESS_URL" "$ACTION_TABLE"
const fs = require("fs");
const [outPath, taskId, inputFile, processUrl, table] = process.argv.slice(2);
const body = {
  task_id: taskId,
  task_type: "action_workflow",
  action_task: {
    name: "action-task-v1-cumulative-proof",
    checkpoint_after_steps: 2,
    steps: [
      { action: "read_file", path: inputFile },
      {
        action: "http_call",
        method: "POST",
        url: processUrl,
        body: JSON.stringify({ task_id: taskId, phase: "first-http" }),
        headers: { "content-type": "application/json" },
      },
      { action: "read_file", path: inputFile },
      {
        action: "http_call",
        method: "POST",
        url: processUrl,
        body: JSON.stringify({ task_id: taskId, phase: "second-http" }),
        headers: { "content-type": "application/json" },
      },
      {
        action: "db_write",
        table,
        record: { task_id: taskId, status: "processed", source: "action-task-v1-cumulative-proof" },
      },
    ],
  },
  idempotency_key: `action-task-v1-cumulative-${String(taskId).slice(0, 8)}`,
};
fs.writeFileSync(outPath, JSON.stringify(body, null, 2));
NODE
else
  node "$ACTION_HELPER" build-action-task-request \
    "$TMP_DIR/action-task-request.json" \
    "$TASK_ID" \
    "$INPUT_FILE" \
    "$PROCESS_URL" \
    "$ACTION_TABLE" \
    2 > /dev/null
fi

echo "    task_id: $TASK_ID"
echo "    tenant_id: $PROOF_TENANT_ID"
echo "    checkpoint_after_steps: 2"
if [[ "$CUMULATIVE_CLEAN_HOST_MODE" == "true" ]]; then
  echo "    cumulative clean-host: true"
  echo "    action steps: 5"
fi
echo "    runtime 1 peer_id: $RUNTIME_1_PEER_ID"
echo "    runtime 2 peer_id: $RUNTIME_2_PEER_ID"
echo "    recovery mode: ${CLEAN_HOST_MODE}"
echo "    runtime 1 WAL store: $(basename "$RUNTIME_1_DB")"
echo "    runtime 2 WAL store: $(basename "$RUNTIME_2_DB")"
if [[ "$CLEAN_HOST_MODE" == "true" && "$RUNTIME_1_DB" == "$RUNTIME_2_DB" ]]; then
  echo "clean-host proof requires distinct runtime WAL stores" >&2
  exit 1
fi

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

echo "[4/11] Preparing controlled table and proof tenant"
psql "$DB_URL" <<SQL >/dev/null
CREATE TABLE IF NOT EXISTS action_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text,
  status text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$PROOF_USER_ID','Action Task V1 Recovery Proof','$PROOF_USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$PROOF_SESSION_ID',NOW()+INTERVAL '2 hours','$PROOF_SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','action-task-v1-recovery-proof','$PROOF_USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userAgent"=EXCLUDED."userAgent", "userId"=EXCLUDED."userId";

INSERT INTO tenants (tenant_id, tenant_name, tenant_email, status, tier, api_key_hash, api_key_prefix, runtime_limit, capabilities_policy, created_at, updated_at)
VALUES ('$PROOF_TENANT_ID','Action Task V1 Recovery Proof','$PROOF_USER_EMAIL','active','seed','$PROOF_API_KEY_HASH','$PROOF_API_KEY_PREFIX',3,'{"allowed_capabilities":["tools.*"]}'::jsonb,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, tenant_email=EXCLUDED.tenant_email, status='active', tier='seed', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=3, capabilities_policy='{"allowed_capabilities":["tools.*"]}'::jsonb, updated_at=NOW();
SQL

echo "[5/11] Starting mock provider, action target, and Overture"
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

echo "[6/11] Registering Runtime 1 and submitting checkpointing action task"
node "$UNIFIED_HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$RUNTIME_1_MACHINE_ID" \
  "$RUNTIME_1_PEER_ID" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:8080" > "$TMP_DIR/runtime-1-register.json"

curl -sS -f \
  -H "X-API-Key: $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-1-register.json" \
  "http://127.0.0.1:8081/api/v1/runtime/register" > "$TMP_DIR/runtime-1-register-response.json"
RUNTIME_1_REGISTRY_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id || "")' "$TMP_DIR/runtime-1-register-response.json")
if [[ -z "$RUNTIME_1_REGISTRY_ID" ]]; then
  echo "runtime 1 registration did not return runtime_id" >&2
  cat "$TMP_DIR/runtime-1-register-response.json" >&2
  exit 1
fi
node - <<'NODE' "$RUNTIME_1_CONFIG" "$RUNTIME_1_REGISTRY_ID"
const fs = require("fs");
const [path, peerId] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(path, "utf8"));
config.mcp = Object.assign({}, config.mcp || {}, { peer_id: peerId });
fs.writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
NODE

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
    IGRIS_RECEIPT_LOG="$TMP_DIR/recovery-receipts.jsonl" \
    IGRIS_DB_WRITE_GATEWAY_URL="$DB_WRITE_GATEWAY_URL" \
    IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES="action_task_" \
    RUST_LOG="warn" \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime-1.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:8080/v1/health" "runtime 1"

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/action-task-request.json" \
  "http://127.0.0.1:8081/v1/tasks/submit" > "$TMP_DIR/task-accepted.json"

wait_for_task_status "$TASK_ID" "checkpointed" "$TMP_DIR/task-after-checkpoint.json" 90 1
curl -sS -f "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/tasks/$TASK_ID/steps" > "$TMP_DIR/task-steps-after-checkpoint.json"

echo "[7/11] Verifying pre-recovery side effect state"
HTTP_COUNT_BEFORE=$(grep -c '"event":"process"' "$LOG_DIR/action-target.log" || true)
DB_GATEWAY_COUNT_BEFORE=$(grep -c '"event":"db-write"' "$LOG_DIR/action-target.log" || true)
DB_ROW_COUNT_BEFORE=$(psql "$DB_URL" -qtAc "SELECT count(*) FROM action_task_events WHERE task_id = '$TASK_ID'" | tr -d '[:space:]')
if [[ "$HTTP_COUNT_BEFORE" != "1" ]]; then
  echo "expected exactly one HTTP /process call before recovery, got $HTTP_COUNT_BEFORE" >&2
  cat "$LOG_DIR/action-target.log" >&2
  exit 1
fi
if [[ "$DB_GATEWAY_COUNT_BEFORE" != "0" || "$DB_ROW_COUNT_BEFORE" != "0" ]]; then
  echo "db_write ran before recovery (gateway=$DB_GATEWAY_COUNT_BEFORE rows=$DB_ROW_COUNT_BEFORE); expected 0" >&2
  exit 1
fi

RUNTIME_1_CONTINUATION_REGISTRY_ID="$RUNTIME_1_REGISTRY_ID"
if [[ "$CUMULATIVE_CLEAN_HOST_MODE" == "true" ]]; then
  echo "[7b/11] Forcing a second persisted checkpoint before clean-host replacement"
  kill "$RUNTIME_PID" >/dev/null 2>&1 || true
  wait "$RUNTIME_PID" >/dev/null 2>&1 || true
  RUNTIME_PID=""

  node "$UNIFIED_HELPER" runtime-register-request \
    "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
    "$RUNTIME_1B_MACHINE_ID" \
    "$RUNTIME_1B_PEER_ID" \
    "darwin" \
    "1.6.0" \
    "http://127.0.0.1:8080" > "$TMP_DIR/runtime-1b-register.json"

  curl -sS -f \
    -H "X-API-Key: $PROOF_RAW_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$TMP_DIR/runtime-1b-register.json" \
    "http://127.0.0.1:8081/api/v1/runtime/register" > "$TMP_DIR/runtime-1b-register-response.json"
  RUNTIME_1_CONTINUATION_REGISTRY_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id || "")' "$TMP_DIR/runtime-1b-register-response.json")
  if [[ -z "$RUNTIME_1_CONTINUATION_REGISTRY_ID" ]]; then
    echo "runtime 1 continuation registration did not return runtime_id" >&2
    cat "$TMP_DIR/runtime-1b-register-response.json" >&2
    exit 1
  fi
  node - <<'NODE' "$RUNTIME_1_CONFIG" "$RUNTIME_1_CONTINUATION_REGISTRY_ID"
const fs = require("fs");
const [path, peerId] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(path, "utf8"));
config.mcp = Object.assign({}, config.mcp || {}, { peer_id: peerId });
fs.writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
NODE

  (
    cd "$ROOT_DIR"
    env \
      RUNTIME_MOCK_KEY=dummy \
      IGRIS_ALLOW_INSECURE_DEV_MODE=true \
      IGRIS_CONFIG="$RUNTIME_1_CONFIG" \
      IGRIS_DEVICE_ID="$DEVICE_ID" \
      IGRIS_OFFLINE_LICENSE_PATH="$TMP_DIR/offline-license.json" \
      IGRIS_LICENSE_OFFLINE_PUBLIC_KEY="$LICENSE_PUBLIC_KEY_HEX" \
      IGRIS_OVERTURE_PUBLIC_KEY="$OVERTURE_PUBLIC_KEY_HEX" \
      IGRIS_RECEIPT_LOG="$TMP_DIR/recovery-receipts.jsonl" \
      IGRIS_DB_WRITE_GATEWAY_URL="$DB_WRITE_GATEWAY_URL" \
      IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES="action_task_" \
      RUST_LOG="warn" \
      "$RUNTIME_BIN" serve
  ) > "$LOG_DIR/runtime-1b.log" 2>&1 &
  RUNTIME_PID=$!
  wait_for_http "http://127.0.0.1:8080/v1/health" "runtime 1 continuation"

  psql "$DB_URL" -X -q <<SQL >/dev/null
UPDATE runtime_instances
SET last_heartbeat = NOW() - INTERVAL '120 seconds'
WHERE tenant_id = '$PROOF_TENANT_ID'
  AND machine_id = '$RUNTIME_1_MACHINE_ID';
SQL

  wait_for_task_checkpoint_step "$TASK_ID" 3 "$TMP_DIR/task-after-second-checkpoint.json" 90 1
  curl -sS -f "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/tasks/$TASK_ID/steps" > "$TMP_DIR/task-steps-after-second-checkpoint.json"

  HTTP_COUNT_SECOND_CHECKPOINT=$(grep -c '"event":"process"' "$LOG_DIR/action-target.log" || true)
  DB_GATEWAY_COUNT_SECOND_CHECKPOINT=$(grep -c '"event":"db-write"' "$LOG_DIR/action-target.log" || true)
  DB_ROW_COUNT_SECOND_CHECKPOINT=$(psql "$DB_URL" -qtAc "SELECT count(*) FROM action_task_events WHERE task_id = '$TASK_ID'" | tr -d '[:space:]')
  CHECKPOINT_ROWS_BEFORE_CLEAN_HOST=$(psql "$DB_URL" -qtAc "SELECT count(*) FROM wal_checkpoints WHERE task_id = '$TASK_ID'::uuid" | tr -d '[:space:]')
  if [[ "$HTTP_COUNT_SECOND_CHECKPOINT" != "2" ]]; then
    echo "expected exactly two HTTP /process calls after second checkpoint, got $HTTP_COUNT_SECOND_CHECKPOINT" >&2
    cat "$LOG_DIR/action-target.log" >&2
    exit 1
  fi
  if [[ "$DB_GATEWAY_COUNT_SECOND_CHECKPOINT" != "0" || "$DB_ROW_COUNT_SECOND_CHECKPOINT" != "0" ]]; then
    echo "db_write ran before clean-host replacement (gateway=$DB_GATEWAY_COUNT_SECOND_CHECKPOINT rows=$DB_ROW_COUNT_SECOND_CHECKPOINT); expected 0" >&2
    exit 1
  fi
  if [[ "$CHECKPOINT_ROWS_BEFORE_CLEAN_HOST" -lt "2" ]]; then
    echo "expected more than one persisted checkpoint row before clean-host resume, got $CHECKPOINT_ROWS_BEFORE_CLEAN_HOST" >&2
    exit 1
  fi
  node - <<'NODE' "$TMP_DIR/task-steps-after-second-checkpoint.json"
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const steps = Array.isArray(body.steps) ? body.steps : [];
const indices = steps.map((s) => s.step_index);
if (body.total !== 4 || JSON.stringify(indices) !== JSON.stringify([0, 1, 2, 3])) {
  throw new Error(`expected committed steps [0,1,2,3] after second checkpoint, got total=${body.total} indices=${JSON.stringify(indices)}`);
}
NODE
fi

echo "[8/11] Interrupting Runtime 1, starting Runtime 2, and triggering recovery"
kill "$RUNTIME_PID" >/dev/null 2>&1 || true
wait "$RUNTIME_PID" >/dev/null 2>&1 || true
RUNTIME_PID=""
sleep 1
if [[ "$CLEAN_HOST_MODE" == "true" ]]; then
  if [[ "$RUNTIME_1_DB" == "$RUNTIME_2_DB" ]]; then
    echo "clean-host proof requires distinct Runtime WAL paths" >&2
    exit 1
  fi
  if [[ ! -e "$RUNTIME_1_DB" ]]; then
    echo "Runtime 1 WAL store was not created before recovery" >&2
    exit 1
  fi
  if [[ -e "$RUNTIME_2_DB" ]]; then
    echo "Runtime 2 WAL store must be empty before clean-host resume" >&2
    exit 1
  fi
  echo "    clean-host WAL stores: runtime1=$(basename "$RUNTIME_1_DB") runtime2=$(basename "$RUNTIME_2_DB")"
  RUNTIME_1_DB_HASH_BEFORE_RUNTIME2=$(shasum -a 256 "$RUNTIME_1_DB" | awk '{print $1}')
fi

node "$UNIFIED_HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$RUNTIME_2_MACHINE_ID" \
  "$RUNTIME_2_PEER_ID" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:8080" > "$TMP_DIR/runtime-2-register.json"

curl -sS -f \
  -H "X-API-Key: $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-2-register.json" \
  "http://127.0.0.1:8081/api/v1/runtime/register" > "$TMP_DIR/runtime-2-register-response.json"
RUNTIME_2_REGISTRY_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id || "")' "$TMP_DIR/runtime-2-register-response.json")
if [[ -z "$RUNTIME_2_REGISTRY_ID" ]]; then
  echo "runtime 2 registration did not return runtime_id" >&2
  cat "$TMP_DIR/runtime-2-register-response.json" >&2
  exit 1
fi
node - <<'NODE' "$RUNTIME_2_CONFIG" "$RUNTIME_2_REGISTRY_ID"
const fs = require("fs");
const [path, peerId] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(path, "utf8"));
config.mcp = Object.assign({}, config.mcp || {}, { peer_id: peerId });
fs.writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
NODE

(
  cd "$ROOT_DIR"
  env \
    RUNTIME_MOCK_KEY=dummy \
    IGRIS_ALLOW_INSECURE_DEV_MODE=true \
    IGRIS_CONFIG="$RUNTIME_2_CONFIG" \
    IGRIS_DEVICE_ID="$DEVICE_ID" \
    IGRIS_OFFLINE_LICENSE_PATH="$TMP_DIR/offline-license.json" \
    IGRIS_LICENSE_OFFLINE_PUBLIC_KEY="$LICENSE_PUBLIC_KEY_HEX" \
    IGRIS_OVERTURE_PUBLIC_KEY="$OVERTURE_PUBLIC_KEY_HEX" \
    IGRIS_RECEIPT_LOG="$TMP_DIR/recovery-receipts.jsonl" \
    IGRIS_DB_WRITE_GATEWAY_URL="$DB_WRITE_GATEWAY_URL" \
    IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES="action_task_" \
    RUST_LOG="warn" \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime-2.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:8080/v1/health" "runtime 2"
if [[ "$CLEAN_HOST_MODE" == "true" ]]; then
  curl -sS -f \
    -H "X-API-Key: $RUNTIME_SECRET" \
    "http://127.0.0.1:8080/v1/runtime/task/$TASK_ID/wal" > "$TMP_DIR/runtime-2-wal-before-resume.json"
  node - <<'NODE' "$TMP_DIR/runtime-2-wal-before-resume.json"
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const entries = Array.isArray(body.entries) ? body.entries : [];
if (entries.length !== 0) {
  throw new Error(`Runtime 2 WAL was not empty before resume: ${entries.length} entries`);
}
NODE
fi

psql "$DB_URL" -X -q <<SQL >/dev/null
UPDATE runtime_instances
SET last_heartbeat = NOW() - INTERVAL '120 seconds'
WHERE tenant_id = '$PROOF_TENANT_ID'
  AND machine_id = '$RUNTIME_1_MACHINE_ID';
SQL

wait_for_task_status "$TASK_ID" "completed" "$TMP_DIR/task-after-recovery.json" 90 1
curl -sS -f "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/tasks/$TASK_ID/steps" > "$TMP_DIR/task-steps-after-recovery.json"

echo "[9/11] Verifying no duplicate side effects"
HTTP_COUNT_AFTER=$(grep -c '"event":"process"' "$LOG_DIR/action-target.log" || true)
DB_GATEWAY_COUNT_AFTER=$(grep -c '"event":"db-write"' "$LOG_DIR/action-target.log" || true)
DB_ROW_COUNT_AFTER=$(psql "$DB_URL" -qtAc "SELECT count(*) FROM action_task_events WHERE task_id = '$TASK_ID'" | tr -d '[:space:]')
DB_ROW_ID=$(psql "$DB_URL" -qtAc "SELECT id::text FROM action_task_events WHERE task_id = '$TASK_ID' ORDER BY created_at DESC LIMIT 1" | tr -d '[:space:]')
EXPECTED_HTTP_AFTER="1"
if [[ "$CUMULATIVE_CLEAN_HOST_MODE" == "true" ]]; then
  EXPECTED_HTTP_AFTER="2"
fi
if [[ "$HTTP_COUNT_AFTER" != "$EXPECTED_HTTP_AFTER" ]]; then
  echo "HTTP side effect duplicated after recovery: expected $EXPECTED_HTTP_AFTER /process calls, got $HTTP_COUNT_AFTER" >&2
  cat "$LOG_DIR/action-target.log" >&2
  exit 1
fi
if [[ "$DB_GATEWAY_COUNT_AFTER" != "1" || "$DB_ROW_COUNT_AFTER" != "1" || -z "$DB_ROW_ID" ]]; then
  echo "DB side effect count mismatch after recovery: gateway=$DB_GATEWAY_COUNT_AFTER rows=$DB_ROW_COUNT_AFTER row_id=${DB_ROW_ID:-missing}" >&2
  exit 1
fi
if [[ "$CLEAN_HOST_MODE" == "true" && -n "${RUNTIME_1_DB_HASH_BEFORE_RUNTIME2:-}" ]]; then
  RUNTIME_1_DB_HASH_AFTER_RUNTIME2=$(shasum -a 256 "$RUNTIME_1_DB" | awk '{print $1}')
  if [[ "$RUNTIME_1_DB_HASH_AFTER_RUNTIME2" != "$RUNTIME_1_DB_HASH_BEFORE_RUNTIME2" ]]; then
    echo "Runtime 1 WAL store changed while Runtime 2 was recovering; clean-host proof requires Runtime 2 to use its own WAL path" >&2
    exit 1
  fi
fi

echo "[10/11] Verifying receipts, WAL uniqueness, and task evidence"
curl -sS -f "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/proof/receipts?limit=50&sort=timestamp:desc" > "$TMP_DIR/proof-receipts.json"
node "$UNIFIED_HELPER" build-verify-request "$TMP_DIR/task-after-recovery.json" > "$TMP_DIR/task-verify-request.json"
curl -sS -f \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/task-verify-request.json" \
  "http://127.0.0.1:8081/proof/receipts/verify" > "$TMP_DIR/proof-receipt-verify-response.json"
node "$ACTION_HELPER" verify-receipt-chain "$TMP_DIR/recovery-receipts.jsonl" 3 > "$TMP_DIR/receipt-chain.json"
curl -sS -f \
  "${AUTH_ARGS[@]}" \
  -X POST \
  "http://127.0.0.1:8081/v1/tasks/$TASK_ID/proof/verify" > "$TMP_DIR/task-proof-response.json"
curl -sS -f "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/tasks/$TASK_ID" > "$TMP_DIR/task-after-verify.json"
EXECUTION_ID=$(node -e 'const fs=require("fs"); const body=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String((body.proof||{}).execution_id||""));' "$TMP_DIR/task-after-verify.json")
if [[ -z "$EXECUTION_ID" ]]; then
  echo "verified task payload did not expose proof.execution_id" >&2
  cat "$TMP_DIR/task-after-verify.json" >&2
  exit 1
fi
curl -sS -f "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/execution/runs/$EXECUTION_ID" > "$TMP_DIR/run-detail.json"

query_json "SELECT json_build_object(
  'count', COUNT(*),
  'rows', COALESCE(json_agg(json_build_object(
    'step_index', step_index,
    'resume_runtime_id', wal_entries->'resume_token'->>'runtime_id',
    'wal_entry_count', jsonb_array_length(wal_entries->'wal_entries'),
    'wal_step_indexes', (
      SELECT COALESCE(jsonb_agg((entry->>'step_index')::int ORDER BY (entry->>'step_index')::int), '[]'::jsonb)
      FROM jsonb_array_elements(wal_entries->'wal_entries') AS entry
    )
  ) ORDER BY step_index), '[]'::json)
) FROM wal_checkpoints
WHERE task_id = '$TASK_ID'::uuid;" "$TMP_DIR/db-wal-checkpoints.json"

node - <<'NODE' "$TMP_DIR/task-steps-after-checkpoint.json" "$TMP_DIR/task-steps-after-recovery.json" "$TMP_DIR/task-after-verify.json" "$TMP_DIR/proof-receipt-verify-response.json" "$TMP_DIR/db-wal-checkpoints.json" "$RUNTIME_1_REGISTRY_ID" "$RUNTIME_1_CONTINUATION_REGISTRY_ID" "$RUNTIME_2_REGISTRY_ID" "$CUMULATIVE_CLEAN_HOST_MODE"
const fs = require("fs");
const [beforePath, afterPath, taskPath, verifyPath, walPath, runtime1, runtime1b, runtime2, cumulativeMode] = process.argv.slice(2);
const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));
const after = JSON.parse(fs.readFileSync(afterPath, "utf8"));
const task = JSON.parse(fs.readFileSync(taskPath, "utf8"));
const verify = JSON.parse(fs.readFileSync(verifyPath, "utf8"));
const wal = JSON.parse(fs.readFileSync(walPath, "utf8"));
function fail(msg) { throw new Error(msg); }

if (!Array.isArray(before.steps) || before.total !== 2) fail(`expected two committed steps before recovery, got ${before.total}`);
const expectedTotal = cumulativeMode === "true" ? 5 : 3;
if (!Array.isArray(after.steps) || after.total !== expectedTotal) fail(`expected ${expectedTotal} committed steps after recovery, got ${after.total}`);
const indices = after.steps.map((s) => s.step_index);
const expectedIndices = Array.from({ length: expectedTotal }, (_, i) => i);
if (JSON.stringify(indices) !== JSON.stringify(expectedIndices)) fail(`unexpected WAL step indexes: ${JSON.stringify(indices)}`);
if (new Set(indices).size !== indices.length) fail(`duplicate WAL step indexes: ${JSON.stringify(indices)}`);
if (!after.steps.slice(0, 2).every((s) => s.runtime_id === runtime1)) fail(`steps 0-1 did not stay on runtime1: ${JSON.stringify(after.steps.map((s) => s.runtime_id))}`);
if (cumulativeMode === "true") {
  if (!after.steps.slice(2, 4).every((s) => s.runtime_id === runtime1b)) fail(`steps 2-3 did not stay on runtime1 continuation: ${JSON.stringify(after.steps.map((s) => s.runtime_id))}`);
  if (after.steps[4].runtime_id !== runtime2) fail(`step 4 did not run on runtime2: ${after.steps[4].runtime_id}`);
} else if (after.steps[2].runtime_id !== runtime2) {
  fail(`step 2 did not run on runtime2: ${after.steps[2].runtime_id}`);
}
if (!Array.isArray(task.action_evidence) || task.action_evidence.length !== expectedTotal) fail("task action_evidence is missing or incomplete");
const evidenceRuntimes = task.action_evidence.map((row) => row.runtime_id);
if (cumulativeMode === "true") {
  if (evidenceRuntimes[0] !== runtime1 || evidenceRuntimes[1] !== runtime1 || evidenceRuntimes[2] !== runtime1b || evidenceRuntimes[3] !== runtime1b || evidenceRuntimes[4] !== runtime2) {
    fail(`action_evidence does not show cumulative runtime split: ${JSON.stringify(evidenceRuntimes)}`);
  }
} else if (evidenceRuntimes[0] !== runtime1 || evidenceRuntimes[1] !== runtime1 || evidenceRuntimes[2] !== runtime2) {
  fail(`action_evidence does not show runtime split: ${JSON.stringify(evidenceRuntimes)}`);
}
if (verify.verified !== true || verify.hash_valid !== true || verify.signature_matches !== true || verify.runtime_key_found !== true || verify.chain_valid !== true) {
  fail(`receipt verification failed: ${JSON.stringify(verify)}`);
}
if (!wal || Number(wal.count) < 2) fail(`expected at least two wal_checkpoints rows, got ${JSON.stringify(wal)}`);
if (cumulativeMode === "true") {
  const rows = Array.isArray(wal.rows) ? wal.rows : [];
  if (rows.length < 3) fail(`expected at least three checkpoint rows after final recovery, got ${JSON.stringify(wal)}`);
  const beforeCleanHostRows = rows.filter((row) => Number(row.step_index) <= 3);
  if (beforeCleanHostRows.length < 2) fail(`expected multiple checkpoint rows before clean-host resume, got ${JSON.stringify(rows)}`);
  const prior = new Set();
  for (const row of beforeCleanHostRows) {
    for (const step of row.wal_step_indexes || []) prior.add(Number(step));
  }
  const priorSteps = Array.from(prior).sort((a, b) => a - b);
  if (JSON.stringify(priorSteps) !== JSON.stringify([0, 1, 2, 3])) {
    fail(`persisted checkpoint rows did not cover committed prior steps [0,1,2,3]: ${JSON.stringify(rows)}`);
  }
}
NODE

node "$ACTION_HELPER" verify-action-evidence \
  "$TMP_DIR/task-after-recovery.json" \
  "$TMP_DIR/task-steps-after-recovery.json" \
  "$TMP_DIR/run-detail.json" \
  "$TMP_DIR/proof-receipts.json" \
  "$TMP_DIR/proof-receipt-verify-response.json" \
  "$TASK_ID" \
  "$DB_ROW_ID" \
  "$TMP_DIR/task-after-verify.json"

echo "[11/11] Action Task V1 recovery proof succeeded"
echo "    task_id:                  $TASK_ID"
if [[ "$CUMULATIVE_CLEAN_HOST_MODE" == "true" ]]; then
  echo "    runtime split:            steps 0-1=$RUNTIME_1_REGISTRY_ID, steps 2-3=$RUNTIME_1_CONTINUATION_REGISTRY_ID, step 4=$RUNTIME_2_REGISTRY_ID"
  echo "    checkpoint rows:          $CHECKPOINT_ROWS_BEFORE_CLEAN_HOST before clean-host resume"
else
  echo "    runtime split:            steps 0-1=$RUNTIME_1_REGISTRY_ID, step 2=$RUNTIME_2_REGISTRY_ID"
fi
echo "    HTTP /process calls:      $HTTP_COUNT_AFTER"
echo "    DB rows for task:         $DB_ROW_COUNT_AFTER"
echo "    db row id:                $DB_ROW_ID"
echo "    artifacts:                $TMP_DIR"
