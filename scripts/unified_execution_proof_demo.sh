#!/bin/zsh

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-unified-proof.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"
MODE="${IGRIS_UNIFIED_PROVIDER_MODE:-mock}"
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
DB_PROOF_ENABLED=false

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
    echo "port $port is already in use; free it before running the unified proof demo" >&2
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

require_cmd node
require_cmd cargo
require_cmd go
require_cmd curl
require_cmd lsof
require_cmd psql

if [[ "$MODE" != "mock" && "$MODE" != "real" ]]; then
  echo "unsupported IGRIS_UNIFIED_PROVIDER_MODE=$MODE; expected mock or real" >&2
  exit 1
fi

if [[ -n "$DB_URL" && "${ENABLE_PERSISTENCE:-}" == "true" ]]; then
  DB_PROOF_ENABLED=true
fi

if [[ "$DB_PROOF_ENABLED" == "true" ]]; then
  EXECUTION_CONTEXT_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.execution_context')" 2>/dev/null | tr -d '[:space:]')
  if [[ -z "$EXECUTION_CONTEXT_TABLE" || "$EXECUTION_CONTEXT_TABLE" == "null" ]]; then
    echo "database persistence is enabled, but table execution_context is missing; runs/proof API visibility cannot be proven until migration 047 is applied" >&2
    exit 1
  fi
fi

check_port_free 8080
check_port_free 8081
if [[ "$MODE" == "mock" ]]; then
  check_port_free 18090
fi

echo "[1/7] Preparing $MODE proof artifacts in $TMP_DIR"
node "$HELPER" prepare "$TMP_DIR" "$MODE" > "$TMP_DIR/prepare.json"

RUNTIME_BIN="$ROOT_DIR/igris-runtime/target/debug/igris-runtime"
if [[ ! -x "$RUNTIME_BIN" ]]; then
  echo "[2/7] Building Runtime binary"
  cargo build --manifest-path "$ROOT_DIR/igris-runtime/Cargo.toml" -p igris-server --bin igris-runtime
else
  echo "[2/7] Reusing existing Runtime binary"
fi

echo "[3/7] Building Overture binary"
GOCACHE="$TMP_DIR/go-cache" GOPROXY=off GOSUMDB=off GOFLAGS="-mod=readonly -buildvcs=false" \
  go build -o "$TMP_DIR/igris-overture" ./cmd/igris-overture

EXPECTED_PROVIDER_ID=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.expected_provider_id);' "$TMP_DIR/meta.json")
EXPECTED_PROVIDER_MODEL=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.expected_provider_model);' "$TMP_DIR/meta.json")
EXPECTED_PROVIDER_API_KEY_ENV=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.expected_provider_api_key_env);' "$TMP_DIR/meta.json")

if [[ "$MODE" == "mock" ]]; then
  echo "[4/7] Starting mock upstream provider"
  node "$HELPER" serve-mock-provider 18090 > "$LOG_DIR/mock-provider.log" 2>&1 &
  MOCK_PID=$!
  wait_for_http "http://127.0.0.1:18090/health" "mock provider"
else
  echo "[4/7] Real provider mode enabled via $EXPECTED_PROVIDER_API_KEY_ENV"
fi

LICENSE_PUBLIC_KEY_HEX=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.license_public_key_hex);' "$TMP_DIR/meta.json")
OVERTURE_PUBLIC_KEY_HEX=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.overture_public_key_hex);' "$TMP_DIR/meta.json")
OVERTURE_PRIVATE_KEY_HEX=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.overture_private_key_hex);' "$TMP_DIR/meta.json")
DEVICE_ID=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.device_id);' "$TMP_DIR/meta.json")
RUNTIME_SECRET=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.runtime_secret);' "$TMP_DIR/meta.json")

echo "[5/7] Starting Runtime"
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

RUNTIME_PUBLIC_KEY_HEX=$(node "$HELPER" runtime-public-key "$ROOT_DIR/.igris/runtime-signing-key.ed25519")

PROOF_TENANT_ID=""
PROOF_TENANT_UUID=""
PROOF_USER_ID=""
PROOF_USER_EMAIL=""
PROOF_SESSION_ID=""
PROOF_SESSION_TOKEN=""
PROOF_API_KEY_HASH=""
PROOF_API_KEY_PREFIX=""
PROOF_RUNTIME_REGISTRY_ID=""
AUTH_ARGS=()
if [[ "$DB_PROOF_ENABLED" == "true" ]]; then
  echo "[5.5/7] Seeding temporary tenant and runtime registry for API visibility proof"
  node "$HELPER" proof-access-material > "$TMP_DIR/proof-access.json"
  PROOF_TENANT_UUID=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.tenant_uuid);' "$TMP_DIR/proof-access.json")
  PROOF_TENANT_ID=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.tenant_id);' "$TMP_DIR/proof-access.json")
  PROOF_USER_ID=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.user_id);' "$TMP_DIR/proof-access.json")
  PROOF_USER_EMAIL=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.user_email);' "$TMP_DIR/proof-access.json")
  PROOF_SESSION_ID=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.session_id);' "$TMP_DIR/proof-access.json")
  PROOF_SESSION_TOKEN=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.session_token);' "$TMP_DIR/proof-access.json")
  PROOF_API_KEY_HASH=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.api_key_hash);' "$TMP_DIR/proof-access.json")
  PROOF_API_KEY_PREFIX=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.api_key_prefix);' "$TMP_DIR/proof-access.json")
  PROOF_RUNTIME_REGISTRY_ID=$(node -e 'const fs=require("fs"); const meta=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(meta.runtime_registry_id);' "$TMP_DIR/proof-access.json")
  AUTH_ARGS=(-H "Cookie: better-auth.session_token=$PROOF_SESSION_TOKEN")

  psql "$DB_URL" <<SQL >/dev/null
INSERT INTO "user" (
  id,
  name,
  email,
  "emailVerified",
  "createdAt",
  "updatedAt",
  role,
  banned
) VALUES (
  '$PROOF_USER_ID',
  'Unified Proof Demo',
  '$PROOF_USER_EMAIL',
  TRUE,
  NOW(),
  NOW(),
  'user',
  FALSE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  "updatedAt" = NOW(),
  banned = FALSE;

INSERT INTO session (
  id,
  "expiresAt",
  token,
  "createdAt",
  "updatedAt",
  "ipAddress",
  "userAgent",
  "userId"
) VALUES (
  '$PROOF_SESSION_ID',
  NOW() + INTERVAL '2 hours',
  '$PROOF_SESSION_TOKEN',
  NOW(),
  NOW(),
  '127.0.0.1',
  'unified-proof-demo',
  '$PROOF_USER_ID'
)
ON CONFLICT (id) DO UPDATE SET
  "expiresAt" = EXCLUDED."expiresAt",
  token = EXCLUDED.token,
  "updatedAt" = NOW(),
  "ipAddress" = EXCLUDED."ipAddress",
  "userAgent" = EXCLUDED."userAgent",
  "userId" = EXCLUDED."userId";

INSERT INTO tenants (
  id,
  tenant_id,
  tenant_name,
  email,
  status,
  api_key_hash,
  api_key_prefix,
  runtime_limit,
  created_at,
  updated_at
) VALUES (
  '$PROOF_TENANT_UUID'::uuid,
  '$PROOF_TENANT_ID',
  'Unified Proof Demo',
  '$PROOF_USER_EMAIL',
  'active',
  '$PROOF_API_KEY_HASH',
  '$PROOF_API_KEY_PREFIX',
  1,
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id) DO UPDATE SET
  tenant_name = EXCLUDED.tenant_name,
  email = EXCLUDED.email,
  status = 'active',
  api_key_hash = EXCLUDED.api_key_hash,
  api_key_prefix = EXCLUDED.api_key_prefix,
  runtime_limit = 1,
  updated_at = NOW();

INSERT INTO runtime_instances (
  runtime_id,
  tenant_id,
  machine_id,
  hostname_cached,
  ip_address,
  public_key_ed25519,
  endpoint,
  capabilities,
  platform,
  version,
  is_edge,
  is_healthy,
  status,
  last_heartbeat,
  last_seen_at,
  registered_at
) VALUES (
  '$PROOF_RUNTIME_REGISTRY_ID',
  '$PROOF_TENANT_UUID'::uuid,
  '$DEVICE_ID',
  'unified-proof-runtime',
  '127.0.0.1',
  '$RUNTIME_PUBLIC_KEY_HEX',
  'http://127.0.0.1:8080',
  '["reasoning","coding"]'::jsonb,
  'darwin',
  '1.6.0',
  TRUE,
  TRUE,
  'active',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (runtime_id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  machine_id = EXCLUDED.machine_id,
  hostname_cached = EXCLUDED.hostname_cached,
  ip_address = EXCLUDED.ip_address,
  public_key_ed25519 = EXCLUDED.public_key_ed25519,
  endpoint = EXCLUDED.endpoint,
  capabilities = EXCLUDED.capabilities,
  platform = EXCLUDED.platform,
  version = EXCLUDED.version,
  is_edge = TRUE,
  is_healthy = TRUE,
  status = 'active',
  last_heartbeat = NOW(),
  last_seen_at = NOW();
SQL
fi

echo "[6/7] Starting Overture"
(
  cd "$ROOT_DIR"
  env \
    PORT=8081 \
    PROVIDER_MODE=mock \
    ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION=true \
    ENABLE_MULTI_TENANCY="$([[ "$DB_PROOF_ENABLED" == "true" ]] && echo true || echo false)" \
    REQUIRE_AUTH_FOR_INFERENCE="$([[ "$DB_PROOF_ENABLED" == "true" ]] && echo true || echo false)" \
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

echo "[7/7] Submitting request through Overture"
curl -sS \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$EXPECTED_PROVIDER_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"hello unified product\"}],\"stream\":false}" \
  "http://127.0.0.1:8081/v1/infer" > "$TMP_DIR/overture-response.json"

if grep -q "Runtime forward failed, falling back to direct routing" "$LOG_DIR/overture.log"; then
  echo "Overture fell back instead of returning the Runtime result" >&2
  echo "Inspect logs in $LOG_DIR" >&2
  exit 1
fi

node "$HELPER" verify \
  "$TMP_DIR/overture-response.json" \
  "$TMP_DIR/receipts.jsonl" \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" > "$TMP_DIR/verification.json"

if [[ "$DB_PROOF_ENABLED" == "true" ]]; then
  EXECUTION_ID=$(node -e 'const fs=require("fs"); const response=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(response.execution_receipt.execution_id);' "$TMP_DIR/overture-response.json")
  VERIFY_REQUEST_JSON=$(node "$HELPER" build-verify-request "$TMP_DIR/overture-response.json")

  curl -sS \
    "${AUTH_ARGS[@]}" \
    "http://127.0.0.1:8081/v1/execution/runs?limit=20&sort=timestamp_utc:desc" > "$TMP_DIR/runs.json"

  for _ in {1..40}; do
    if curl -fsS \
      "${AUTH_ARGS[@]}" \
      "http://127.0.0.1:8081/v1/execution/runs/$EXECUTION_ID" > "$TMP_DIR/run-detail.json"; then
      break
    fi
    sleep 0.25
  done

  curl -sS \
    "${AUTH_ARGS[@]}" \
    "http://127.0.0.1:8081/proof/receipts?limit=50&sort=timestamp:desc" > "$TMP_DIR/proof-receipts.json"

  curl -sS \
    "${AUTH_ARGS[@]}" \
    -H "Content-Type: application/json" \
    -d "$VERIFY_REQUEST_JSON" \
    "http://127.0.0.1:8081/proof/receipts/verify" > "$TMP_DIR/proof-verify.json"

  node "$HELPER" verify-persistence \
    "$TMP_DIR/overture-response.json" \
    "$TMP_DIR/runs.json" \
    "$TMP_DIR/run-detail.json" \
    "$TMP_DIR/proof-receipts.json" \
    "$TMP_DIR/proof-verify.json" > "$TMP_DIR/api-visibility.json"
fi

node -e '
const fs=require("fs");
const response=JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const verification=JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expectedProvider=process.argv[4];
if (verification.metadata_route_decision !== "forwarded_to_runtime_task") {
  throw new Error(`unexpected route decision: ${verification.metadata_route_decision}`);
}
if (verification.metadata_provider !== expectedProvider) {
  throw new Error(`unexpected provider: ${verification.metadata_provider}`);
}
if (!verification.execution_envelope_verified) {
  throw new Error("execution envelope verification failed");
}
if (!verification.execution_receipt_verified.signature_valid || !verification.execution_receipt_verified.hash_matches) {
  throw new Error("execution receipt verification failed");
}
if (!verification.receipt_log_entry_found || !verification.receipt_chain_link_valid) {
  throw new Error("receipt log linkage failed");
}
console.log("Unified execution proof succeeded.");
console.log(`Mode: ${process.argv[5]}`);
console.log(`Content: ${verification.response_content}`);
console.log(`Provider: ${verification.metadata_provider}`);
console.log(`Route decision: ${verification.metadata_route_decision}`);
if (process.argv[6] && fs.existsSync(process.argv[6])) {
  const apiVisibility = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
  console.log(`Runtime ID: ${apiVisibility.runtime_id}`);
  console.log(`Receipt API verified: ${apiVisibility.receipt_verification}`);
  console.log(`Runs API visibility: ${apiVisibility.runs_list_match && apiVisibility.run_detail_match}`);
}
console.log(`Receipt execution_id: ${response.execution_receipt.execution_id}`);
console.log(`Receipt hash: ${response.execution_receipt.hash}`);
console.log(`Artifacts: ${process.argv[3]}`);
' "$TMP_DIR/overture-response.json" "$TMP_DIR/verification.json" "$TMP_DIR" "$EXPECTED_PROVIDER_ID" "$MODE" "${TMP_DIR}/api-visibility.json"
