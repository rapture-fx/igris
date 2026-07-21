#!/usr/bin/env bash
# Clock 3F — Integrated Product Reality Gate (disposable validation harness)
#
# Brings up a disposable Overture + two Runtimes + deploy.staging_release
# adapter against DATABASE_URL, then runs clean-room SDK scenarios A/B/C,
# security negatives, and records friction measurements.
#
# Does NOT touch production. Does NOT merge to main.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
ARTIFACT_DIR="${CLOCK3F_ARTIFACT_DIR:-/tmp/clock3f-validation}"
LOG_DIR="$ARTIFACT_DIR/logs"
TMP_DIR="$ARTIFACT_DIR/runtime"
HELPER="$ROOT_DIR/scripts/unified_execution_demo_helper.js"
ACTION_HELPER="$ROOT_DIR/scripts/action_task_v1_proof_helper.js"
CLEANROOM_PY="${CLOCK3F_CLEANROOM_PY:-$ARTIFACT_DIR/cleanroom/venv/bin/python}"
OVERTURE_BIN="${CLOCK3F_OVERTURE_BIN:-$ARTIFACT_DIR/bin/igris-overture}"
RUNTIME_BIN="${CLOCK3F_RUNTIME_BIN:-$ROOT_DIR/igris-runtime/target/debug/igris-runtime}"
ADAPTER_PORT="${CLOCK3F_ADAPTER_PORT:-18100}"
OVERTURE_PORT="${CLOCK3F_OVERTURE_PORT:-8081}"
RUNTIME_PORT="${CLOCK3F_RUNTIME_PORT:-8080}"
ACTION_TARGET_PORT="${CLOCK3F_ACTION_TARGET_PORT:-18091}"

mkdir -p "$LOG_DIR" "$TMP_DIR" "$ARTIFACT_DIR/report"
REPORT="$ARTIFACT_DIR/report/clock3f-results.json"
FRICTION="$ARTIFACT_DIR/report/friction.json"

if [[ -z "${DATABASE_URL:-}" && -f "$ARTIFACT_DIR/database_url.txt" ]]; then
  DATABASE_URL=$(cat "$ARTIFACT_DIR/database_url.txt")
  export DATABASE_URL
fi
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "DATABASE_URL required" >&2
  exit 1
fi

require_cmd() { command -v "$1" >/dev/null || { echo "missing $1" >&2; exit 1; }; }
require_cmd node
require_cmd psql
require_cmd curl
require_cmd python3

if [[ ! -x "$OVERTURE_BIN" ]]; then
  echo "missing overture binary: $OVERTURE_BIN" >&2
  exit 1
fi
if [[ ! -x "$RUNTIME_BIN" ]]; then
  echo "missing runtime binary: $RUNTIME_BIN (wait for cargo build)" >&2
  exit 1
fi
if [[ ! -x "$CLEANROOM_PY" ]]; then
  echo "missing clean-room python: $CLEANROOM_PY" >&2
  exit 1
fi

PIDS=()
cleanup() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  # Free ports if lingering
  for port in "$OVERTURE_PORT" "$RUNTIME_PORT" "$ADAPTER_PORT" "$ACTION_TARGET_PORT"; do
    local listener
    listener=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "$listener" ]]; then
      kill "$listener" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT

check_port_free() {
  local port="$1"
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $port in use" >&2
    exit 1
  fi
}

wait_for_http() {
  local url="$1" name="$2" attempts="${3:-60}"
  local i
  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "    $name ready"
      return 0
    fi
    sleep 0.5
  done
  echo "$name did not become ready at $url" >&2
  return 1
}

json_set() {
  # json_set file key value — shallow merge via node
  node -e '
const fs=require("fs");
const [p,k,v]=process.argv.slice(1);
let o={}; try{o=JSON.parse(fs.readFileSync(p,"utf8"))}catch{}
let parsed=v; try{parsed=JSON.parse(v)}catch{}
o[k]=parsed;
fs.writeFileSync(p, JSON.stringify(o,null,2)+"\n");
' "$1" "$2" "$3"
}

echo "[clock3f] artifact dir: $ARTIFACT_DIR"
echo "{}" > "$REPORT"
echo '{"started_unix":'$(date +%s)'}' > "$FRICTION"

# ---------------------------------------------------------------------------
# Access material + tenant seed
# ---------------------------------------------------------------------------
echo "[clock3f] preparing access material"
node "$HELPER" proof-access-material > "$TMP_DIR/proof-access.json"
PROOF_TENANT_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenant_id)' "$TMP_DIR/proof-access.json")
PROOF_USER_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).user_id)' "$TMP_DIR/proof-access.json")
PROOF_USER_EMAIL=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).user_email)' "$TMP_DIR/proof-access.json")
PROOF_SESSION_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).session_id)' "$TMP_DIR/proof-access.json")
PROOF_SESSION_TOKEN=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).session_token)' "$TMP_DIR/proof-access.json")
PROOF_RAW_API_KEY=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).raw_api_key)' "$TMP_DIR/proof-access.json")
PROOF_API_KEY_HASH=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).api_key_hash)' "$TMP_DIR/proof-access.json")
PROOF_API_KEY_PREFIX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).api_key_prefix)' "$TMP_DIR/proof-access.json")

# Operator session must use the same tenant_id as API-key runs. Better Auth
# maps session user id → tenant id, and proof-access-material sets them equal.
# Promote the proof user to admin for reconciliation; API keys remain non-admin.
ADMIN_SESSION_TOKEN="$PROOF_SESSION_TOKEN"

# Cross-tenant materials (distinct user/tenant id)
OTHER_TENANT_ID="proof-other-$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')"
OTHER_RAW_API_KEY="igris_$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')"
OTHER_API_KEY_HASH=$(node -e 'const c=require("crypto"); process.stdout.write(c.createHash("sha256").update(process.argv[1]).digest("hex"))' "$OTHER_RAW_API_KEY")

psql "$DB_URL" <<SQL >/dev/null
CREATE TABLE IF NOT EXISTS action_task_contract_bound_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text,
  status text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$PROOF_USER_ID','Clock3F Operator','$PROOF_USER_EMAIL',TRUE,NOW(),NOW(),'user,admin',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE, role='user,admin';

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$PROOF_SESSION_ID',NOW()+INTERVAL '4 hours','$PROOF_SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','clock3f-operator','$PROOF_USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userId"=EXCLUDED."userId";

INSERT INTO tenants (tenant_id, tenant_name, tenant_email, status, tier, api_key_hash, api_key_prefix, runtime_limit, capabilities_policy, created_at, updated_at)
VALUES ('$PROOF_TENANT_ID','Clock3F Validation','$PROOF_USER_EMAIL','active','seed','$PROOF_API_KEY_HASH','$PROOF_API_KEY_PREFIX',5,'{"allowed_capabilities":["tools.*"]}'::jsonb,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, updated_at=NOW();

INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$OTHER_TENANT_ID','Clock3F Other','other+$OTHER_TENANT_ID@igris.local',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET "updatedAt"=NOW(), banned=FALSE;

INSERT INTO tenants (tenant_id, tenant_name, tenant_email, status, tier, api_key_hash, api_key_prefix, runtime_limit, capabilities_policy, created_at, updated_at)
VALUES ('$OTHER_TENANT_ID','Clock3F Other','other+$OTHER_TENANT_ID@igris.local','active','seed','$OTHER_API_KEY_HASH','igris_ot',2,'{"allowed_capabilities":["tools.*"]}'::jsonb,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET api_key_hash=EXCLUDED.api_key_hash, updated_at=NOW();
SQL

export IGRIS_API_KEY="$PROOF_RAW_API_KEY"
export IGRIS_API_URL="http://127.0.0.1:$OVERTURE_PORT"
export IGRIS_CLOCK3F_ADAPTER_TOKEN
IGRIS_CLOCK3F_ADAPTER_TOKEN=$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')
export IGRIS_EXECUTION_INPUT_REF_KEYS="${IGRIS_EXECUTION_INPUT_REF_KEYS:-v1:$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')}"
export IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION="${IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION:-v1}"

echo "$PROOF_RAW_API_KEY" > "$ARTIFACT_DIR/api_key.txt"
echo "$ADMIN_SESSION_TOKEN" > "$ARTIFACT_DIR/admin_session.txt"
echo "$OTHER_RAW_API_KEY" > "$ARTIFACT_DIR/other_api_key.txt"

# ---------------------------------------------------------------------------
# Prepare runtime / overture keys
# ---------------------------------------------------------------------------
echo "[clock3f] preparing runtime artifacts"
node "$HELPER" prepare-checkpoint "$TMP_DIR" > "$TMP_DIR/prepare.json"
OVERTURE_PUBLIC_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).overture_public_key_hex)' "$TMP_DIR/meta.json")
OVERTURE_PRIVATE_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).overture_private_key_hex)' "$TMP_DIR/meta.json")
LICENSE_PUBLIC_KEY_HEX=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).license_public_key_hex)' "$TMP_DIR/meta.json")
RUNTIME_SECRET=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_secret)' "$TMP_DIR/meta.json")
DEVICE_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).device_id)' "$TMP_DIR/meta.json")
RUNTIME_PUBLIC_KEY_HEX=$(node "$HELPER" runtime-public-key "$ROOT_DIR/.igris/runtime-signing-key.ed25519")

RUNTIME_1_DB="$TMP_DIR/runtime-1.db"
RUNTIME_2_DB="$TMP_DIR/runtime-2.db"
RUNTIME_1_PEER_ID="clock3f-runtime-1"
RUNTIME_2_PEER_ID="clock3f-runtime-2"
RUNTIME_1_MACHINE_ID="$DEVICE_ID"
RUNTIME_2_MACHINE_ID="${DEVICE_ID}-recovery"
RUNTIME_1_CONFIG="$TMP_DIR/runtime-1-config.json5"
RUNTIME_2_CONFIG="$TMP_DIR/runtime-2-config.json5"
DB_WRITE_GATEWAY_URL="http://127.0.0.1:$ACTION_TARGET_PORT/db-write"
INPUT_FILE="$TMP_DIR/input.txt"
printf 'clock3f\n' > "$INPUT_FILE"

# Clone base runtime config to two independent WAL stores (clean-host style).
node - <<'NODE' "$TMP_DIR/runtime-config.json5" "$RUNTIME_1_DB" "$RUNTIME_2_DB" "$RUNTIME_1_CONFIG" "$RUNTIME_2_CONFIG"
const fs = require("fs");
const [basePath, storage1, storage2, out1, out2] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
function clone(storage) {
  const next = JSON.parse(JSON.stringify(base));
  next.storage = Object.assign({}, next.storage || {}, { path: storage });
  next.server = Object.assign({}, next.server || {}, { host: "127.0.0.1", port: 8080 });
  return `${JSON.stringify(next, null, 2)}\n`;
}
fs.writeFileSync(out1, clone(storage1));
fs.writeFileSync(out2, clone(storage2));
NODE

# ---------------------------------------------------------------------------
# Start services
# ---------------------------------------------------------------------------
check_port_free "$OVERTURE_PORT"
check_port_free "$RUNTIME_PORT"
check_port_free "$ADAPTER_PORT"
check_port_free "$ACTION_TARGET_PORT"

echo "[clock3f] starting action-target / db-write gateway"
node "$ACTION_HELPER" serve-action-target "$ACTION_TARGET_PORT" "$DB_URL" > "$LOG_DIR/action-target.log" 2>&1 &
PIDS+=($!)
wait_for_http "http://127.0.0.1:$ACTION_TARGET_PORT/health" "action target"

echo "[clock3f] starting Overture on :$OVERTURE_PORT"
(
  cd "$ROOT_DIR"
  exec env \
    PORT="$OVERTURE_PORT" \
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
    IGRIS_RUNTIME_URL="http://127.0.0.1:$RUNTIME_PORT" \
    IGRIS_RUNTIME_TIMEOUT=10s \
    IGRIS_RUNTIME_SECRET="$RUNTIME_SECRET" \
    IGRIS_OVERTURE_SIGNING_KEY="$OVERTURE_PRIVATE_KEY_HEX" \
    IGRIS_RUNTIME_PUBLIC_KEY="$RUNTIME_PUBLIC_KEY_HEX" \
    IGRIS_RUNTIME_CALLBACK_BASE_URL="http://127.0.0.1:$OVERTURE_PORT" \
    IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_NAME="Cookie" \
    IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_VALUE="better-auth.session_token=$PROOF_SESSION_TOKEN" \
    IGRIS_CLOCK3F_ADAPTER_TOKEN="$IGRIS_CLOCK3F_ADAPTER_TOKEN" \
    IGRIS_EXECUTION_INPUT_REF_KEYS="$IGRIS_EXECUTION_INPUT_REF_KEYS" \
    IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION="$IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION" \
    "$OVERTURE_BIN"
) > "$LOG_DIR/overture.log" 2>&1 &
PIDS+=($!)
wait_for_http "http://127.0.0.1:$OVERTURE_PORT/healthz" "overture"

echo "[clock3f] starting staging adapter (inject=none)"
HOLD_FILE="$TMP_DIR/adapter-hold"
rm -f "$HOLD_FILE"
ADAPTER_LEDGER="$TMP_DIR/adapter-ledger.json"
ADAPTER_JOURNAL="$TMP_DIR/adapter-journal.jsonl"
(
  export IGRIS_HOME="$TMP_DIR/adapter-igris-home"
  export IGRIS_CLOCK3F_ADAPTER_TOKEN
  exec "$CLEANROOM_PY" "$ROOT_DIR/examples/clock_3f_staging_release_adapter.py" \
    --port "$ADAPTER_PORT" \
    --ledger "$ADAPTER_LEDGER" \
    --journal "$ADAPTER_JOURNAL" \
    --inject none
) > "$LOG_DIR/adapter.log" 2>&1 &
PIDS+=($!)
wait_for_http "http://127.0.0.1:$ADAPTER_PORT/health" "staging adapter"

echo "[clock3f] registering + starting Runtime 1"
node "$HELPER" runtime-register-request \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
  "$RUNTIME_1_MACHINE_ID" \
  "$RUNTIME_1_PEER_ID" \
  "darwin" \
  "1.6.0" \
  "http://127.0.0.1:$RUNTIME_PORT" > "$TMP_DIR/runtime-1-register.json"
curl -sS -f \
  -H "X-API-Key: $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMP_DIR/runtime-1-register.json" \
  "http://127.0.0.1:$OVERTURE_PORT/api/v1/runtime/register" > "$TMP_DIR/runtime-1-register-response.json"
RUNTIME_1_REGISTRY_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id || "")' "$TMP_DIR/runtime-1-register-response.json")
if [[ -z "$RUNTIME_1_REGISTRY_ID" ]]; then
  echo "runtime 1 registration failed" >&2
  cat "$TMP_DIR/runtime-1-register-response.json" >&2
  exit 1
fi
node "$ACTION_HELPER" inject-tools-config \
  "$RUNTIME_1_CONFIG" \
  "$INPUT_FILE" \
  "127.0.0.1" \
  "$DB_WRITE_GATEWAY_URL" \
  "$RUNTIME_1_REGISTRY_ID" >/dev/null

(
  cd "$ROOT_DIR"
  exec env \
    RUNTIME_MOCK_KEY=dummy \
    IGRIS_ALLOW_INSECURE_DEV_MODE=true \
    IGRIS_CONFIG="$RUNTIME_1_CONFIG" \
    IGRIS_DEVICE_ID="$RUNTIME_1_MACHINE_ID" \
    IGRIS_OFFLINE_LICENSE_PATH="$TMP_DIR/offline-license.json" \
    IGRIS_LICENSE_OFFLINE_PUBLIC_KEY="$LICENSE_PUBLIC_KEY_HEX" \
    IGRIS_OVERTURE_PUBLIC_KEY="$OVERTURE_PUBLIC_KEY_HEX" \
    IGRIS_RECEIPT_LOG="$TMP_DIR/receipts.jsonl" \
    IGRIS_DB_WRITE_GATEWAY_URL="$DB_WRITE_GATEWAY_URL" \
    IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES="action_task_" \
    IGRIS_CLOCK3F_ADAPTER_TOKEN="$IGRIS_CLOCK3F_ADAPTER_TOKEN" \
    RUST_LOG=warn \
    "$RUNTIME_BIN" serve
) > "$LOG_DIR/runtime-1.log" 2>&1 &
RUNTIME_1_PID=$!
PIDS+=($RUNTIME_1_PID)
wait_for_http "http://127.0.0.1:$RUNTIME_PORT/v1/health" "runtime 1"

# ---------------------------------------------------------------------------
# Clean-room Scenario A + shared bootstrap via SDK
# ---------------------------------------------------------------------------
echo "[clock3f] Scenario A — clean-room durable journey"
SCENARIO_A_START=$(date +%s)
export IGRIS_HOME="$ARTIFACT_DIR/cleanroom/igris-home"
mkdir -p "$IGRIS_HOME"

"$CLEANROOM_PY" - <<'PY' "$ARTIFACT_DIR" "$ADAPTER_PORT" "$OVERTURE_PORT" "$PROOF_RAW_API_KEY" "$IGRIS_CLOCK3F_ADAPTER_TOKEN" "$REPORT" "$FRICTION" "$SCENARIO_A_START"
import json, os, sys, time, urllib.request
from pathlib import Path

artifact, adapter_port, overture_port, api_key, adapter_token, report_path, friction_path, start = sys.argv[1:]
start = int(start)
endpoint = f"http://127.0.0.1:{overture_port}"
os.environ["IGRIS_API_URL"] = endpoint
os.environ["IGRIS_API_KEY"] = api_key
os.environ["IGRIS_CLOCK3F_ADAPTER_TOKEN"] = adapter_token

# Prove no repo imports: only installed igris
import igris
from igris import IgrisDurableClient, wrap_tool
from igris.approval import ApprovalDecision

class AlwaysAllow:
    def decide(self, request):
        return ApprovalDecision("allowed", "clock3f")

commit = "a" * 40
service = "demo-api"
environment = "disposable-staging"

def deploy_staging_release(service: str, environment: str, commit_sha: str) -> dict:
    # Local Embedded gate only — durable path does not upload this function.
    return {"service": service, "environment": environment, "commit_sha": commit_sha, "ok": True}

tool = wrap_tool(
    deploy_staging_release,
    action="deploy.staging_release",
    risk="critical",
    approval="never",
    approval_provider=AlwaysAllow(),
)
contract = tool.__igris_contract__
client = IgrisDurableClient(endpoint=endpoint, api_key=api_key)

sync = client.sync_contract(tool)
assert sync.contract_hash == contract.contract_hash

target = client.create_action_target(
    name="clock3f_staging_adapter",
    target_url=f"http://127.0.0.1:{adapter_port}/v1/deploy/staging-release",
    target_type="webhook",
    method="POST",
    replay_class="retryable",
    approval_required=False,
    secret_refs=["env:IGRIS_CLOCK3F_ADAPTER_TOKEN"],
    target_metadata={
        "local_auth_header_name": "X-Igris-Adapter-Token",
        "local_auth_secret_env": "IGRIS_CLOCK3F_ADAPTER_TOKEN",
    },
)

binding = client.ensure_binding(
    action_name=contract.action_name,
    contract_hash=contract.contract_hash,
    target_action_id=target.id,
    input_mapping={
        "service": "service",
        "environment": "environment",
        "commit_sha": "commit_sha",
    },
)

idem = f"deploy:{service}:{environment}:{commit}"
run = client.run(
    contract.action_name,
    input={"service": service, "environment": environment, "commit_sha": commit},
    idempotency_key=idem,
    contract_hash=contract.contract_hash,
)
# Bound actions pause at checkpoint_after_steps=1 after the HTTP effect.
deadline = time.time() + 45
last = None
while time.time() < deadline:
    last = run.status()
    if last.status in {"checkpointed", "completed", "failed", "reconciliation_required"}:
        break
    time.sleep(0.4)
assert last is not None and last.status in {"checkpointed", "completed"}, last
out = {
    "bootstrap": {
        "contract_hash": contract.contract_hash,
        "target_id": target.id,
        "binding_id": binding.id,
        "action_name": contract.action_name,
        "idempotency_key": idem,
        "commit_sha": commit,
        "service": service,
        "environment": environment,
    },
    "scenario_a_mid": {
        "run_id": run.run_id,
        "status": last.status,
        "needs_resume": last.status == "checkpointed",
    },
}
Path(report_path).write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps(out["scenario_a_mid"], indent=2))
PY

CONTRACT_HASH=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).bootstrap.contract_hash)' "$REPORT")
TARGET_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).bootstrap.target_id)' "$REPORT")
RUN_A=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).scenario_a_mid.run_id)' "$REPORT")
NEEDS_RESUME=$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).scenario_a_mid.needs_resume))' "$REPORT")

resume_with_runtime2() {
  local label="$1"
  echo "[clock3f] $label — interrupting Runtime 1 and resuming on Runtime 2"
  if [[ -n "${RUNTIME_1_PID:-}" ]]; then
    kill "$RUNTIME_1_PID" 2>/dev/null || true
    wait "$RUNTIME_1_PID" 2>/dev/null || true
    RUNTIME_1_PID=""
  fi
  # Ensure port free
  local listener
  listener=$(lsof -tiTCP:"$RUNTIME_PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$listener" ]]; then kill "$listener" 2>/dev/null || true; sleep 0.5; fi

  node "$HELPER" runtime-register-request \
    "$ROOT_DIR/.igris/runtime-signing-key.ed25519" \
    "$RUNTIME_2_MACHINE_ID" \
    "$RUNTIME_2_PEER_ID" \
    "darwin" \
    "1.6.0" \
    "http://127.0.0.1:$RUNTIME_PORT" > "$TMP_DIR/runtime-2-register.json"
  curl -sS -f \
    -H "X-API-Key: $PROOF_RAW_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$TMP_DIR/runtime-2-register.json" \
    "http://127.0.0.1:$OVERTURE_PORT/api/v1/runtime/register" > "$TMP_DIR/runtime-2-register-response.json"
  RUNTIME_2_REGISTRY_ID=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).runtime_id || "")' "$TMP_DIR/runtime-2-register-response.json")
  [[ -n "$RUNTIME_2_REGISTRY_ID" ]] || { cat "$TMP_DIR/runtime-2-register-response.json" >&2; exit 1; }
  node "$ACTION_HELPER" inject-tools-config \
    "$RUNTIME_2_CONFIG" \
    "$INPUT_FILE" \
    "127.0.0.1" \
    "$DB_WRITE_GATEWAY_URL" \
    "$RUNTIME_2_REGISTRY_ID" >/dev/null

  (
    cd "$ROOT_DIR"
    exec env \
      RUNTIME_MOCK_KEY=dummy \
      IGRIS_ALLOW_INSECURE_DEV_MODE=true \
      IGRIS_CONFIG="$RUNTIME_2_CONFIG" \
      IGRIS_DEVICE_ID="$DEVICE_ID" \
      IGRIS_OFFLINE_LICENSE_PATH="$TMP_DIR/offline-license.json" \
      IGRIS_LICENSE_OFFLINE_PUBLIC_KEY="$LICENSE_PUBLIC_KEY_HEX" \
      IGRIS_OVERTURE_PUBLIC_KEY="$OVERTURE_PUBLIC_KEY_HEX" \
      IGRIS_RECEIPT_LOG="$TMP_DIR/receipts.jsonl" \
      IGRIS_DB_WRITE_GATEWAY_URL="$DB_WRITE_GATEWAY_URL" \
      IGRIS_DB_WRITE_ALLOWED_TABLE_PREFIXES="action_task_" \
      IGRIS_CLOCK3F_ADAPTER_TOKEN="$IGRIS_CLOCK3F_ADAPTER_TOKEN" \
      RUST_LOG=warn \
      "$RUNTIME_BIN" serve
  ) > "$LOG_DIR/runtime-2.log" 2>&1 &
  RUNTIME_2_PID=$!
  PIDS+=($RUNTIME_2_PID)
  wait_for_http "http://127.0.0.1:$RUNTIME_PORT/v1/health" "runtime 2"

  psql "$DB_URL" -X -q <<SQL >/dev/null
UPDATE runtime_instances
SET last_heartbeat = NOW() - INTERVAL '120 seconds', is_healthy = true, status = 'active'
WHERE tenant_id = '$PROOF_TENANT_ID'
  AND machine_id = '$RUNTIME_1_MACHINE_ID';
SQL
}

if [[ "$NEEDS_RESUME" == "true" ]]; then
  resume_with_runtime2 "Scenario A resume"
fi

"$CLEANROOM_PY" - <<'PY' "$OVERTURE_PORT" "$PROOF_RAW_API_KEY" "$RUN_A" "$ADAPTER_PORT" "$IGRIS_CLOCK3F_ADAPTER_TOKEN" "$REPORT" "$FRICTION" "$SCENARIO_A_START"
import json, sys, time, urllib.request
from pathlib import Path
from igris.durable import IgrisDurableClient, DurableRun
endpoint=f"http://127.0.0.1:{sys.argv[1]}"
client=IgrisDurableClient(endpoint=endpoint, api_key=sys.argv[2])
run=DurableRun(client, run_id=sys.argv[3])
status=run.wait(timeout=90)
assert status.status=="completed", status
proof=run.proof()
assert proof.schema=="igris_run_proof.v1"
boundary=proof.claim_boundary
boundary_keys=[]
if boundary is not None:
    import dataclasses as _dc
    if _dc.is_dataclass(boundary):
        boundary_keys=[f.name for f in _dc.fields(boundary)]
orp=proof.raw.get("operator_reconciliation") if isinstance(proof.raw.get("operator_reconciliation"), dict) else None
# Idempotent replay
boot=json.loads(Path(sys.argv[6]).read_text())["bootstrap"]
run2=client.run(
    boot["action_name"],
    input={"service":boot["service"],"environment":boot["environment"],"commit_sha":boot["commit_sha"]},
    idempotency_key=boot["idempotency_key"],
    contract_hash=boot["contract_hash"],
)
assert run2.run_id==run.run_id
req=urllib.request.Request(
    f"http://127.0.0.1:{sys.argv[4]}/v1/deploy/staging-release/ledger",
    headers={"X-Igris-Adapter-Token": sys.argv[5]},
)
ledger=json.loads(urllib.request.urlopen(req).read())
assert ledger.get("effect_journal_count")==1, ledger
elapsed=int(time.time())-int(sys.argv[8])
out=json.loads(Path(sys.argv[6]).read_text())
out["scenario_a"]={
    "ok": True,
    "run_id": run.run_id,
    "contract_hash": boot["contract_hash"],
    "binding_id": boot["binding_id"],
    "target_id": boot["target_id"],
    "status": status.status,
    "proof_schema": proof.schema,
    "effect_count": ledger.get("effect_count"),
    "effect_journal_count": ledger.get("effect_journal_count"),
    "idempotent_replay_run_id": run2.run_id,
    "claim_boundary_keys": boundary_keys,
    "operator_reconciliation": orp,
    "runtime_proof_present": proof.runtime_proof is not None,
    "action_protocol_evidence_present": proof.action_protocol_evidence is not None,
    "seconds": elapsed,
    "completed_via_runtime_resume": True,
}
Path(sys.argv[6]).write_text(json.dumps(out, indent=2)+"\n")
friction=json.loads(Path(sys.argv[7]).read_text())
friction["scenario_a_seconds"]=elapsed
friction["time_to_first_durable_run_seconds"]=elapsed
friction["raw_http_calls_in_sdk_journey"]=0
friction["configuration_values"]=["endpoint","api_key","adapter_url","adapter_token_env","idempotency_key","service","environment","commit_sha"]
friction["product_concepts"]=["ActionContract","wrap_tool","IgrisDurableClient","action_target","exact_contract_hash_binding","business_idempotency_key","DurableRun","Igris_Run_Proof","Runtime_receipt","Action_Protocol_Evidence","checkpoint_resume"]
friction["p0_friction"]=[{
    "id":"checkpoint_resume_required",
    "severity":"P0",
    "summary":"Contract-bound runs pause at checkpoint_after_steps=1; completion requires Runtime recovery/resume. Clean-room DurableRun.wait alone will time out unless infrastructure resumes.",
}]
Path(sys.argv[7]).write_text(json.dumps(friction, indent=2)+"\n")
print(json.dumps(out["scenario_a"], indent=2))
PY
json_set "$REPORT" "scenario_a_exit" "0"
echo "[clock3f] Scenario A PASSED"

# ---------------------------------------------------------------------------
# Scenario B — two-Runtime recovery lineage (exercised by Scenario A resume).
# Contract-bound graphs checkpoint after the HTTP effect; Runtime 2 completes
# the deterministic DB write without replaying the adapter effect.
# ---------------------------------------------------------------------------
echo "[clock3f] Scenario B — verify recovery lineage from Scenario A resume"
"$CLEANROOM_PY" - <<'PY' "$OVERTURE_PORT" "$PROOF_RAW_API_KEY" "$RUN_A" "$ADAPTER_PORT" "$IGRIS_CLOCK3F_ADAPTER_TOKEN" "$REPORT"
import json, sys, urllib.request
from pathlib import Path
from igris.durable import IgrisDurableClient, DurableRun
client=IgrisDurableClient(endpoint=f"http://127.0.0.1:{sys.argv[1]}", api_key=sys.argv[2])
run=DurableRun(client, run_id=sys.argv[3])
status=run.status()
proof=run.proof()
assert status.status=="completed", status
assert len(proof.recovery_lineage or []) >= 1, proof.recovery_lineage
req=urllib.request.Request(
    f"http://127.0.0.1:{sys.argv[4]}/v1/deploy/staging-release/ledger",
    headers={"X-Igris-Adapter-Token": sys.argv[5]},
)
ledger=json.loads(urllib.request.urlopen(req).read())
assert ledger.get("effect_journal_count")==1, ledger
out=json.loads(Path(sys.argv[6]).read_text())
out["scenario_b"]={
    "ok": True,
    "run_id": run.run_id,
    "status": status.status,
    "recovery_status": getattr(status, "recovery_status", None),
    "proof_schema": proof.schema,
    "recovery_lineage_len": len(proof.recovery_lineage or []),
    "recovery_lineage": proof.recovery_lineage,
    "effect_journal_count": ledger.get("effect_journal_count"),
    "raw_task_endpoints_used": False,
    "note": "Scenario A completed via Runtime 1 interrupt + Runtime 2 resume after HTTP effect checkpoint; adapter effect count remained 1",
}
Path(sys.argv[6]).write_text(json.dumps(out, indent=2)+"\n")
print(json.dumps({"ok":True,"recovery_lineage_len":len(proof.recovery_lineage or []),"effects":ledger.get("effect_journal_count")}, indent=2))
PY
echo "[clock3f] Scenario B PASSED"

# ---------------------------------------------------------------------------
# Scenario C — uncertain effect after deploy, operator reconciliation
# ---------------------------------------------------------------------------
echo "[clock3f] Scenario C — uncertain effect + operator reconciliation"

# Restart adapter with fail_after_effect
for pid in "${PIDS[@]:-}"; do
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    # Identify adapter by port
    :
  fi
done
ADAPTER_LISTENER=$(lsof -tiTCP:"$ADAPTER_PORT" -sTCP:LISTEN 2>/dev/null || true)
if [[ -n "$ADAPTER_LISTENER" ]]; then
  kill "$ADAPTER_LISTENER" 2>/dev/null || true
  sleep 0.5
fi
ADAPTER_LEDGER_C="$TMP_DIR/adapter-ledger-c.json"
ADAPTER_JOURNAL_C="$TMP_DIR/adapter-journal-c.jsonl"
(
  export IGRIS_HOME="$TMP_DIR/adapter-igris-home-c"
  export IGRIS_CLOCK3F_ADAPTER_TOKEN
  exec "$CLEANROOM_PY" "$ROOT_DIR/examples/clock_3f_staging_release_adapter.py" \
    --port "$ADAPTER_PORT" \
    --ledger "$ADAPTER_LEDGER_C" \
    --journal "$ADAPTER_JOURNAL_C" \
    --inject fail_after_effect
) > "$LOG_DIR/adapter-c.log" 2>&1 &
PIDS+=($!)
wait_for_http "http://127.0.0.1:$ADAPTER_PORT/health" "staging adapter (fail_after_effect)"

# New target pointing still to same URL (already bound). Reuse binding.
COMMIT_C=$(node -e 'process.stdout.write(require("crypto").createHash("sha1").update("clock3f-c").digest("hex"))')
IDEMP_C="deploy:demo-web:disposable-staging:$COMMIT_C"

"$CLEANROOM_PY" - <<'PY' "$OVERTURE_PORT" "$PROOF_RAW_API_KEY" "$CONTRACT_HASH" "$COMMIT_C" "$IDEMP_C" "$TMP_DIR/scenario_c_run.json" "$ADAPTER_PORT" "$IGRIS_CLOCK3F_ADAPTER_TOKEN"
import json, sys, time
from igris import IgrisDurableClient
from igris.errors import ReconciliationRequiredError
endpoint=f"http://127.0.0.1:{sys.argv[1]}"
client=IgrisDurableClient(endpoint=endpoint, api_key=sys.argv[2])
run=client.run(
    "deploy.staging_release",
    input={"service":"demo-web","environment":"disposable-staging","commit_sha":sys.argv[4]},
    idempotency_key=sys.argv[5],
    contract_hash=sys.argv[3],
)
caught=False
try:
    run.wait(timeout=90)
except ReconciliationRequiredError as exc:
    caught=True
    err=str(exc)
status=run.status()
import urllib.request
req=urllib.request.Request(
    f"http://127.0.0.1:{sys.argv[7]}/v1/deploy/staging-release/ledger",
    headers={"X-Igris-Adapter-Token": sys.argv[8]},
)
ledger=json.loads(urllib.request.urlopen(req).read())
# External effect happened exactly once; auto-replay refused
assert ledger.get("effect_journal_count") == 1, ledger
# Second SDK wait/status must not create another effect
try:
    run.wait(timeout=5)
except Exception:
    pass
ledger2=json.loads(urllib.request.urlopen(req).read())
assert ledger2.get("effect_journal_count") == 1, ledger2
open(sys.argv[6],"w").write(json.dumps({
    "run_id": run.run_id,
    "status": status.status,
    "requires_reconciliation": getattr(status, "requires_reconciliation", None),
    "caught_reconciliation_error": caught,
    "effect_journal_count": ledger2.get("effect_journal_count"),
}, indent=2))
print(open(sys.argv[6]).read())
PY

RUN_C=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).run_id)' "$TMP_DIR/scenario_c_run.json")

# API key must NOT reconcile
HTTP_CODE=$(curl -sS -o "$TMP_DIR/recon-api-key.json" -w "%{http_code}" \
  -H "Authorization: Bearer $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"11111111-1111-1111-1111-111111111111","resolution":"confirmed_succeeded","reason":"should fail","external_reference":{"type":"deployment_id","value":"dep_should_fail"}}' \
  "http://127.0.0.1:$OVERTURE_PORT/v1/actions/runs/$RUN_C/reconciliation" || true)
echo "    api-key reconcile HTTP=$HTTP_CODE"
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  echo "API key must not act as operator" >&2
  exit 1
fi

# Admin inspect
curl -sS -f \
  -H "Cookie: better-auth.session_token=$ADMIN_SESSION_TOKEN" \
  "http://127.0.0.1:$OVERTURE_PORT/v1/actions/runs/$RUN_C/reconciliation" > "$TMP_DIR/recon-get.json"

# Secret-shaped reason must be rejected before a valid resolution is appended
CODE=$(curl -sS -o /tmp/clock3f-secret-ref.json -w "%{http_code}" \
  -H "Cookie: better-auth.session_token=$ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"44444444-4444-4444-4444-444444444444","resolution":"confirmed_succeeded","reason":"contains secret=marker","external_reference":{"type":"deployment_id","value":"dep_ok"}}' \
  "http://127.0.0.1:$OVERTURE_PORT/v1/actions/runs/$RUN_C/reconciliation" || true)
[[ "$CODE" != "200" && "$CODE" != "201" ]] || { echo "secret-shaped reason accepted" >&2; cat /tmp/clock3f-secret-ref.json; exit 1; }

# Read deployment_id from adapter effect journal
DEP_ID=$(node -e '
const fs=require("fs");
const lines=fs.readFileSync(process.argv[1],"utf8").trim().split(/\n/).filter(Boolean);
const last=JSON.parse(lines[lines.length-1]);
process.stdout.write(last.deployment_id);
' "$ADAPTER_LEDGER_C.effects.jsonl")

curl -sS -f \
  -H "Cookie: better-auth.session_token=$ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'const id=process.argv[1]; process.stdout.write(JSON.stringify({request_id:"22222222-2222-2222-2222-222222222222",resolution:"confirmed_succeeded",reason:"Independently verified disposable staging deployment",external_reference:{type:"deployment_id",value:id}}))' "$DEP_ID")" \
  "http://127.0.0.1:$OVERTURE_PORT/v1/actions/runs/$RUN_C/reconciliation" > "$TMP_DIR/recon-append.json"

"$CLEANROOM_PY" - <<'PY' "$OVERTURE_PORT" "$PROOF_RAW_API_KEY" "$RUN_C" "$REPORT" "$ADAPTER_PORT" "$IGRIS_CLOCK3F_ADAPTER_TOKEN"
import json, sys, urllib.request
from pathlib import Path
from igris.durable import IgrisDurableClient, DurableRun
client=IgrisDurableClient(endpoint=f"http://127.0.0.1:{sys.argv[1]}", api_key=sys.argv[2])
run=DurableRun(client, run_id=sys.argv[3])
proof=run.proof()
raw=proof.raw
orp=raw.get("operator_reconciliation")
if not isinstance(orp, dict):
    # Also accept nested under linked / claims
    orp = (raw.get("claims") or {}).get("operator_reconciliation") or {}
assert orp.get("cryptographic_proof") is False, orp
req=urllib.request.Request(
    f"http://127.0.0.1:{sys.argv[5]}/v1/deploy/staging-release/ledger",
    headers={"X-Igris-Adapter-Token": sys.argv[6]},
)
ledger=json.loads(urllib.request.urlopen(req).read())
assert ledger.get("effect_journal_count") == 1, ledger
out=json.loads(Path(sys.argv[4]).read_text())
out["scenario_c"]={
    "ok": True,
    "run_id": run.run_id,
    "cryptographic_proof": orp.get("cryptographic_proof"),
    "operator_reconciliation": orp,
    "effect_journal_count": ledger.get("effect_journal_count"),
    "api_key_cannot_reconcile": True,
}
Path(sys.argv[4]).write_text(json.dumps(out, indent=2)+"\n")
print(json.dumps({"ok":True,"cryptographic_proof":orp.get("cryptographic_proof"),"effects":ledger.get("effect_journal_count")}, indent=2))
PY
echo "[clock3f] Scenario C PASSED"

# ---------------------------------------------------------------------------
# Phase 9 — security negatives (subset exercised live; suite covers rest)
# ---------------------------------------------------------------------------
echo "[clock3f] Phase 9 — security negatives"
RUN_A=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).scenario_a.run_id)' "$REPORT")

# Cross-tenant run access
CODE=$(curl -sS -o /tmp/clock3f-xtenant.json -w "%{http_code}" \
  -H "Authorization: Bearer $OTHER_RAW_API_KEY" \
  "http://127.0.0.1:$OVERTURE_PORT/v1/actions/runs/$RUN_A" || true)
[[ "$CODE" != "200" ]] || { echo "cross-tenant run access allowed" >&2; exit 1; }

# Cross-tenant reconciliation
CODE=$(curl -sS -o /tmp/clock3f-xtenant-recon.json -w "%{http_code}" \
  -H "Cookie: better-auth.session_token=$ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"33333333-3333-3333-3333-333333333333","resolution":"confirmed_succeeded","reason":"nope","external_reference":{"type":"deployment_id","value":"dep_x"}}' \
  "http://127.0.0.1:$OVERTURE_PORT/v1/actions/runs/00000000-0000-0000-0000-000000000099/reconciliation" || true)
# Missing run or not authorized — must not 200 create eligibility
[[ "$CODE" != "200" && "$CODE" != "201" ]] || { echo "unexpected recon success" >&2; exit 1; }

# Missing idempotency key
CODE=$(curl -sS -o /tmp/clock3f-no-idem.json -w "%{http_code}" \
  -H "Authorization: Bearer $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"contract_hash\":\"$CONTRACT_HASH\",\"input\":{\"service\":\"demo-api\",\"environment\":\"disposable-staging\",\"commit_sha\":\"$(printf 'b%.0s' {1..40})\"}}" \
  "http://127.0.0.1:$OVERTURE_PORT/v1/actions/deploy.staging_release/run" || true)
[[ "$CODE" != "200" && "$CODE" != "201" && "$CODE" != "202" ]] || { echo "missing idempotency accepted" >&2; exit 1; }

# Wrong contract_hash
CODE=$(curl -sS -o /tmp/clock3f-bad-hash.json -w "%{http_code}" \
  -H "Authorization: Bearer $PROOF_RAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"contract_hash\":\"$(printf 'c%.0s' {1..64})\",\"idempotency_key\":\"deploy:bad\",\"input\":{\"service\":\"demo-api\",\"environment\":\"disposable-staging\",\"commit_sha\":\"$(printf 'd%.0s' {1..40})\"}}" \
  "http://127.0.0.1:$OVERTURE_PORT/v1/actions/deploy.staging_release/run" || true)
[[ "$CODE" != "200" && "$CODE" != "201" && "$CODE" != "202" ]] || { echo "wrong hash accepted" >&2; exit 1; }

json_set "$REPORT" "security_negatives" '{"ok":true,"cross_tenant_run_rejected":true,"api_key_not_operator":true,"missing_idempotency_rejected":true,"wrong_contract_hash_rejected":true,"secret_shaped_ref_rejected":true}'
echo "[clock3f] Phase 9 PASSED"

echo "[clock3f] ALL LIVE SCENARIOS COMPLETE"
echo "    report: $REPORT"
cat "$REPORT"
