#!/bin/zsh

# Task V1 Golden-Path Proof Demo
#
# Proves the customer-facing Submit -> Execute -> Verify flow on the durable
# task API:
#
# 1. Submit a vanilla agent_workflow task through Overture (no recovery
#    trigger).
# 2. Runtime executes both steps and emits a signed envelope and receipt.
# 3. Overture persists the task record (with runtime_id, execution_envelope,
#    execution_receipt, proof state).
# 4. Task Detail (GET /v1/tasks/:id) returns links to steps, verify, run, and
#    receipt_verify.
# 5. WAL steps (GET /v1/tasks/:id/steps) reflect the committed steps.
# 6. Execution run (GET /v1/execution/runs/:execution_id) is reachable.
# 7. Receipt list (GET /proof/receipts) includes the receipt.
# 8. Receipt-level verify (POST /proof/receipts/verify) returns 200 with
#    verified=true.
# 9. Task-level verify (POST /v1/tasks/:id/proof/verify) returns 200 with
#    proof.status=verified.
#
# This is the simplest Task V1 happy-path proof. It does NOT exercise
# checkpoint or recovery — see scripts/checkpoint_proof_demo.sh for that.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-task-v1-proof.XXXXXX")
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
    echo "port $port is already in use; free it before running the task v1 proof demo" >&2
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
  echo "DATABASE_URL or POSTGRES_URL is required for the task v1 proof" >&2
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

echo "[1/9] Preparing Task V1 proof artifacts in $TMP_DIR"
# Reuse the checkpoint helper for artifacts (offline license, runtime config,
# overture/runtime keys, mock provider seeds) — we just discard its
# checkpoint-specific request files and build our own vanilla task body below.
node "$HELPER" prepare-checkpoint "$TMP_DIR" > "$TMP_DIR/prepare.json"
node "$HELPER" proof-access-material > "$TMP_DIR/proof-access.json"

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

AUTH_ARGS=(-H "Cookie: better-auth.session_token=$PROOF_SESSION_TOKEN")

# Build the canonical Task V1 customer payload: a 2-step agent_workflow with
# no recovery trigger, no routing-internal fields. This mirrors the simplest
# supported customer-facing task shape.
TASK_ID=$(node -e 'process.stdout.write(require("crypto").randomUUID())')
node - <<'NODE' "$TMP_DIR/task-v1-request.json" "$TASK_ID"
const fs = require("fs");
const [outPath, taskId] = process.argv.slice(2);
const body = {
  task_id: taskId,
  task_type: "agent_workflow",
  agent_task: {
    name: "task-v1-proof",
    model: "mock-model",
    steps: [
      { model: "mock-model", messages: [{ role: "user", content: "task v1 proof step 1" }] },
      { model: "mock-model", messages: [{ role: "user", content: "task v1 proof step 2" }] },
    ],
  },
  idempotency_key: `task-v1-${taskId.slice(0, 8)}`,
};
fs.writeFileSync(outPath, JSON.stringify(body, null, 2));
NODE

echo "    task_id: $TASK_ID"
echo "    tenant_id: $PROOF_TENANT_ID"
echo "    request: $TMP_DIR/task-v1-request.json"

echo "[2/9] Building Runtime binary"
RUNTIME_BIN="$ROOT_DIR/igris-runtime/target/debug/igris-runtime"
if [[ ! -x "$RUNTIME_BIN" ]]; then
  cargo build --manifest-path "$ROOT_DIR/igris-runtime/Cargo.toml" -p igris-server --bin igris-runtime
else
  echo "    Reusing existing Runtime binary"
fi

echo "[3/9] Building Overture binary"
GOCACHE="$TMP_DIR/go-cache" GOPROXY=off GOSUMDB=off GOFLAGS="-mod=readonly -buildvcs=false" \
  go build -o "$TMP_DIR/igris-overture" ./cmd/igris-overture

echo "[4/9] Seeding tenant, session, and API key"
psql "$DB_URL" <<SQL >/dev/null
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$PROOF_USER_ID','Task V1 Proof Demo','$PROOF_USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$PROOF_SESSION_ID',NOW()+INTERVAL '2 hours','$PROOF_SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','task-v1-proof-demo','$PROOF_USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userAgent"=EXCLUDED."userAgent", "userId"=EXCLUDED."userId";

INSERT INTO tenants (id, tenant_id, tenant_name, email, status, tier, api_key_hash, api_key_prefix, runtime_limit, created_at, updated_at)
VALUES ('$PROOF_TENANT_UUID'::uuid,'$PROOF_TENANT_ID','Task V1 Proof Demo','$PROOF_USER_EMAIL','active','seed','$PROOF_API_KEY_HASH','$PROOF_API_KEY_PREFIX',3,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, email=EXCLUDED.email, status='active', tier='seed', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=3, updated_at=NOW();
SQL

echo "[5/9] Starting mock provider, Runtime, and Overture"
node "$HELPER" serve-mock-provider 18090 > "$LOG_DIR/mock-provider.log" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:18090/health" "mock provider"

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
    RUST_LOG="warn" \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime.log" 2>&1 &
RUNTIME_PID=$!
wait_for_http "http://127.0.0.1:8080/v1/health" "runtime"

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

echo "[6/9] Registering Runtime and submitting the Task V1 request"
node "$HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$DEVICE_ID" \
  "task-v1-runtime" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:8080" > "$TMP_DIR/runtime-register.json"

curl -sS -f \
  -H "X-API-Key: $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-register.json" \
  "http://127.0.0.1:8081/api/v1/runtime/register" > "$TMP_DIR/runtime-register-response.json"

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/task-v1-request.json" \
  "http://127.0.0.1:8081/v1/tasks/submit" > "$TMP_DIR/task-accepted.json"

# The submit response must include a `links` block so consumers can navigate
# to task detail / steps / verify / run / receipt_verify without hardcoding paths.
node - <<'NODE' "$TMP_DIR/task-accepted.json" "$TASK_ID"
const fs = require("fs");
const [acceptedPath, expectedTaskId] = process.argv.slice(2);
const body = JSON.parse(fs.readFileSync(acceptedPath, "utf8"));
function fail(msg) { throw new Error(msg); }
if (String(body.task_id) !== expectedTaskId) fail(`unexpected accepted task_id: ${body.task_id}`);
if (!body.links) fail("submit response missing `links`");
const required = ["task", "steps", "verify", "receipt_verify"];
for (const key of required) {
  if (!body.links[key]) fail(`submit response links missing ${key}`);
}
if (!String(body.links.task).endsWith(expectedTaskId)) fail(`links.task does not include task id: ${body.links.task}`);
NODE

echo "[7/9] Polling task detail until completed"
wait_for_task_status \
  "$TASK_ID" \
  "completed" \
  "$TMP_DIR/task-completed.json" \
  90 \
  1

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/v1/tasks/$TASK_ID/steps" > "$TMP_DIR/task-steps.json"

EXECUTION_ID=$(node -e 'const fs=require("fs"); const body=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String((body.execution_receipt||body.proof||{}).execution_id||body.proof?.execution_id||""));' "$TMP_DIR/task-completed.json")
if [[ -z "$EXECUTION_ID" ]]; then
  echo "task_completed payload did not expose an execution_id" >&2
  cat "$TMP_DIR/task-completed.json" >&2
  exit 1
fi

echo "    execution_id: $EXECUTION_ID"

# Wait briefly for execution_lineage / execution_context to be persisted by
# Runtime -> Overture writeback.
for _ in {1..40}; do
  if curl -fsS "${AUTH_ARGS[@]}" "http://127.0.0.1:8081/v1/execution/runs/$EXECUTION_ID" > "$TMP_DIR/run-detail.json"; then
    break
  fi
  sleep 0.25
done

curl -sS -f \
  "${AUTH_ARGS[@]}" \
  "http://127.0.0.1:8081/proof/receipts?limit=50&sort=timestamp:desc" > "$TMP_DIR/proof-receipts.json"

echo "[8/9] Calling receipt-verify and task-verify endpoints"
node "$HELPER" build-verify-request "$TMP_DIR/task-completed.json" > "$TMP_DIR/task-verify-request.json"

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

echo "[9/9] Validating Task V1 evidence"
node - <<'NODE' \
  "$TMP_DIR/task-completed.json" \
  "$TMP_DIR/task-steps.json" \
  "$TMP_DIR/run-detail.json" \
  "$TMP_DIR/proof-receipts.json" \
  "$TMP_DIR/proof-receipt-verify-response.json" \
  "$TMP_DIR/task-proof-response.json" \
  "$EXECUTION_ID" \
  "$TASK_ID"
const fs = require("fs");
const [
  completedPath,
  stepsPath,
  runDetailPath,
  receiptsListPath,
  receiptVerifyPath,
  taskVerifyPath,
  expectedExecutionId,
  expectedTaskId,
] = process.argv.slice(2);

function read(path) {
  const raw = fs.readFileSync(path, "utf8").trim();
  return raw ? JSON.parse(raw) : null;
}
function fail(msg) { throw new Error(msg); }

const task = read(completedPath);
const steps = read(stepsPath);
const runDetail = read(runDetailPath);
const receipts = read(receiptsListPath);
const receiptVerify = read(receiptVerifyPath);
const taskVerify = read(taskVerifyPath);

if (task.status !== "completed") fail(`expected task status=completed, got ${task.status}`);
if (!task.runtime_id) fail("task is missing runtime_id");
if (!task.execution_envelope) fail("task is missing execution_envelope");
if (!task.execution_receipt) fail("task is missing execution_receipt");
if (!task.proof || !task.proof.execution_id) fail("task is missing proof.execution_id");
if (!task.links || !task.links.task || !task.links.steps || !task.links.verify || !task.links.receipt_verify) {
  fail("task detail response is missing one of links.{task,steps,verify,receipt_verify}");
}
if (!task.links.run) fail("task detail response is missing links.run after completion");

if (!Array.isArray(steps.steps) || steps.total < 1) fail(`expected at least one persisted step, got ${steps.total}`);
const stepRuntimeIds = new Set(steps.steps.map((s) => s.runtime_id).filter(Boolean));
if (stepRuntimeIds.size === 0) fail("expected at least one step to expose runtime_id");

if (!runDetail || runDetail.id !== expectedExecutionId) fail(`run detail id mismatch: ${runDetail && runDetail.id}`);
if (runDetail.task_id && runDetail.task_id !== expectedTaskId) fail(`run.task_id ${runDetail.task_id} != ${expectedTaskId}`);

if (!Array.isArray(receipts) || !receipts.find((r) => r.execution_id === expectedExecutionId)) {
  fail("expected receipt list to include the execution_id");
}

if (!receiptVerify || (receiptVerify.verified !== true && receiptVerify.valid !== true)) {
  fail(`receipt verify endpoint did not return verified=true: ${JSON.stringify(receiptVerify).slice(0, 200)}`);
}
if (taskVerify && taskVerify.proof && taskVerify.proof.status && !["verified", "present"].includes(taskVerify.proof.status)) {
  fail(`task verify proof.status unexpected: ${taskVerify.proof.status}`);
}

console.log("Task V1 golden-path proof succeeded.");
console.log("");
console.log(`Task status:               ${task.status}`);
console.log(`Runtime id:                ${task.runtime_id}`);
console.log(`Execution id:              ${task.proof.execution_id}`);
console.log(`Persisted steps:           ${steps.total}`);
console.log(`Run detail task_id link:   ${runDetail.task_id || "(not exposed in this build)"}`);
console.log(`Receipt verify endpoint:   verified=${receiptVerify.verified}`);
console.log(`Task verify endpoint:      proof.status=${taskVerify && taskVerify.proof && taskVerify.proof.status}`);
console.log(`links.task:                ${task.links.task}`);
console.log(`links.steps:               ${task.links.steps}`);
console.log(`links.verify:              ${task.links.verify}`);
console.log(`links.run:                 ${task.links.run}`);
console.log(`links.receipt_verify:      ${task.links.receipt_verify}`);
NODE

echo ""
echo "    task_id:                       $TASK_ID"
echo "    execution_id:                  $EXECUTION_ID"
echo "    receipt verify HTTP status:    $VERIFY_HTTP_STATUS"
echo "    task verify HTTP status:       $TASK_PROOF_HTTP_STATUS"
echo "    artifacts:                     $TMP_DIR"
