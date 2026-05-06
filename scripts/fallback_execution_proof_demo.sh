#!/bin/zsh

# Fallback Execution Proof Demo
#
# Proves that when the configured primary provider fails (connection refused),
# the Runtime's speculative router transparently falls back to a secondary
# provider and still produces a verifiable execution receipt.
#
# Two mock providers are configured:
#   mock-primary-fail  → port 19090 (nothing listening → connection refused)
#   mock-fallback      → port 18090 (live mock server  → success)
#
# The Runtime races both via its speculative router.  The primary fails
# immediately; the fallback wins.  The signed execution_envelope carries
# routing_decision="mock-fallback" as tamper-evident proof.
#
# Usage:
#   ./scripts/fallback_execution_proof_demo.sh
#
# Optional env vars (same as unified demo):
#   DATABASE_URL / POSTGRES_URL  — enables DB-backed API visibility proof
#   ENABLE_PERSISTENCE=true      — required alongside DB_URL for persistence

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
HELPER="$SCRIPT_DIR/unified_execution_demo_helper.js"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-fallback-proof.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"
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
    echo "port $port is already in use; free it before running the fallback proof demo" >&2
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

if [[ -n "$DB_URL" && "${ENABLE_PERSISTENCE:-}" == "true" ]]; then
  DB_PROOF_ENABLED=true
  require_cmd psql
fi

if [[ "$DB_PROOF_ENABLED" == "true" ]]; then
  EXECUTION_CONTEXT_TABLE=$(psql "$DB_URL" -tAc "SELECT to_regclass('public.execution_context')" 2>/dev/null | tr -d '[:space:]')
  if [[ -z "$EXECUTION_CONTEXT_TABLE" || "$EXECUTION_CONTEXT_TABLE" == "null" ]]; then
    echo "database persistence is enabled, but table execution_context is missing; API visibility cannot be proven until migration 047 is applied" >&2
    exit 1
  fi
fi

# Port 19090 must be free (and will stay free — that IS the primary failure)
# Port 18090 is the live fallback mock
# Ports 8080/8081 are Runtime/Overture
check_port_free 8080
check_port_free 8081
check_port_free 18090
check_port_free 19090

echo "[1/7] Preparing fallback proof artifacts in $TMP_DIR"
node "$HELPER" prepare-fallback "$TMP_DIR" > "$TMP_DIR/prepare.json"

PRIMARY_PROVIDER_ID=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.primary_provider_id);' "$TMP_DIR/meta.json")
FALLBACK_PROVIDER_ID=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.fallback_provider_id);' "$TMP_DIR/meta.json")

echo "    primary (will fail): $PRIMARY_PROVIDER_ID → http://127.0.0.1:19090/v1"
echo "    fallback (will win): $FALLBACK_PROVIDER_ID → http://127.0.0.1:18090/v1"

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

# Start ONLY the fallback mock (port 18090). Port 19090 intentionally left dead.
echo "[4/7] Starting fallback mock provider on port 18090 (primary port 19090 left dead)"
node "$HELPER" serve-mock-provider 18090 > "$LOG_DIR/mock-provider.log" 2>&1 &
MOCK_PID=$!
wait_for_http "http://127.0.0.1:18090/health" "fallback mock provider"

echo "    Confirmed: port 19090 is NOT listening (primary will fail)"
if lsof -iTCP:19090 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "    WARNING: something is now on port 19090 — primary failure may not trigger" >&2
fi

LICENSE_PUBLIC_KEY_HEX=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.license_public_key_hex);' "$TMP_DIR/meta.json")
OVERTURE_PUBLIC_KEY_HEX=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.overture_public_key_hex);' "$TMP_DIR/meta.json")
OVERTURE_PRIVATE_KEY_HEX=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.overture_private_key_hex);' "$TMP_DIR/meta.json")
DEVICE_ID=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.device_id);' "$TMP_DIR/meta.json")
RUNTIME_SECRET=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.runtime_secret);' "$TMP_DIR/meta.json")

echo "[5/7] Starting Runtime (two providers configured)"
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
  PROOF_TENANT_UUID=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.tenant_uuid);' "$TMP_DIR/proof-access.json")
  PROOF_TENANT_ID=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.tenant_id);' "$TMP_DIR/proof-access.json")
  PROOF_USER_ID=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.user_id);' "$TMP_DIR/proof-access.json")
  PROOF_USER_EMAIL=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.user_email);' "$TMP_DIR/proof-access.json")
  PROOF_SESSION_ID=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.session_id);' "$TMP_DIR/proof-access.json")
  PROOF_SESSION_TOKEN=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.session_token);' "$TMP_DIR/proof-access.json")
  PROOF_API_KEY_HASH=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.api_key_hash);' "$TMP_DIR/proof-access.json")
  PROOF_API_KEY_PREFIX=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.api_key_prefix);' "$TMP_DIR/proof-access.json")
  PROOF_RUNTIME_REGISTRY_ID=$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.runtime_registry_id);' "$TMP_DIR/proof-access.json")
  AUTH_ARGS=(-H "Cookie: better-auth.session_token=$PROOF_SESSION_TOKEN")

  psql "$DB_URL" <<SQL >/dev/null
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, banned)
VALUES ('$PROOF_USER_ID','Fallback Proof Demo','$PROOF_USER_EMAIL',TRUE,NOW(),NOW(),'user',FALSE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, "updatedAt"=NOW(), banned=FALSE;

INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
VALUES ('$PROOF_SESSION_ID',NOW()+INTERVAL '2 hours','$PROOF_SESSION_TOKEN',NOW(),NOW(),'127.0.0.1','fallback-proof-demo','$PROOF_USER_ID')
ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt", token=EXCLUDED.token, "updatedAt"=NOW(), "userAgent"=EXCLUDED."userAgent", "userId"=EXCLUDED."userId";

INSERT INTO tenants (id, tenant_id, tenant_name, email, status, api_key_hash, api_key_prefix, runtime_limit, created_at, updated_at)
VALUES ('$PROOF_TENANT_UUID'::uuid,'$PROOF_TENANT_ID','Fallback Proof Demo','$PROOF_USER_EMAIL','active','$PROOF_API_KEY_HASH','$PROOF_API_KEY_PREFIX',1,NOW(),NOW())
ON CONFLICT (tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name, email=EXCLUDED.email, status='active', api_key_hash=EXCLUDED.api_key_hash, api_key_prefix=EXCLUDED.api_key_prefix, runtime_limit=1, updated_at=NOW();

INSERT INTO runtime_instances (runtime_id, tenant_id, machine_id, hostname_cached, ip_address, public_key_ed25519, endpoint, capabilities, platform, version, is_edge, is_healthy, status, last_heartbeat, last_seen_at, registered_at)
VALUES ('$PROOF_RUNTIME_REGISTRY_ID','$PROOF_TENANT_UUID'::uuid,'$DEVICE_ID','fallback-proof-runtime','127.0.0.1','$RUNTIME_PUBLIC_KEY_HEX','http://127.0.0.1:8080','["reasoning","coding"]'::jsonb,'darwin','1.6.0',TRUE,TRUE,'active',NOW(),NOW(),NOW())
ON CONFLICT (runtime_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id, machine_id=EXCLUDED.machine_id, hostname_cached=EXCLUDED.hostname_cached, ip_address=EXCLUDED.ip_address, public_key_ed25519=EXCLUDED.public_key_ed25519, endpoint=EXCLUDED.endpoint, capabilities=EXCLUDED.capabilities, platform=EXCLUDED.platform, version=EXCLUDED.version, is_edge=TRUE, is_healthy=TRUE, status='active', last_heartbeat=NOW(), last_seen_at=NOW();
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

echo "[7/7] Submitting inference request through Overture → Runtime"
curl -sS \
  ${AUTH_ARGS:+"${AUTH_ARGS[@]}"} \
  -H "Content-Type: application/json" \
  -d '{"model":"mock-model","messages":[{"role":"user","content":"hello fallback proof"}],"stream":false}' \
  "http://127.0.0.1:8081/v1/infer" > "$TMP_DIR/overture-response.json"

# Overture must NOT have fallen back (Runtime must have accepted the request).
if grep -q "Runtime forward failed, falling back to direct routing" "$LOG_DIR/overture.log"; then
  echo "Overture fell back to direct routing instead of returning Runtime result" >&2
  echo "Inspect overture logs: $LOG_DIR/overture.log" >&2
  exit 1
fi

# Extract primary-failure evidence from Runtime logs.
PRIMARY_FAIL_EVIDENCE=""
if grep -q "$PRIMARY_PROVIDER_ID\|19090\|connection refused\|failed to start stream\|Provider.*failed" "$LOG_DIR/runtime.log" 2>/dev/null; then
  PRIMARY_FAIL_EVIDENCE=$(grep -m3 "$PRIMARY_PROVIDER_ID\|19090\|connection refused\|failed to start stream\|Provider.*failed" "$LOG_DIR/runtime.log" 2>/dev/null | head -3 || true)
fi

echo "    Primary failure evidence in Runtime logs:"
if [[ -n "$PRIMARY_FAIL_EVIDENCE" ]]; then
  echo "$PRIMARY_FAIL_EVIDENCE" | sed 's/^/      /'
else
  echo "      (no explicit log line — connection refused may be silent in speculative router)"
fi

# Verify envelope and receipt signatures.
node "$HELPER" verify-fallback \
  "$TMP_DIR/overture-response.json" \
  "$TMP_DIR/receipts.jsonl" \
  "$ROOT_DIR/.igris/runtime-signing-key.ed25519" > "$TMP_DIR/fallback-verification.json"

# DB-backed API visibility proof (optional).
if [[ "$DB_PROOF_ENABLED" == "true" ]]; then
  EXECUTION_ID=$(node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(r.execution_receipt.execution_id);' "$TMP_DIR/overture-response.json")
  VERIFY_REQUEST_JSON=$(node "$HELPER" build-verify-request "$TMP_DIR/overture-response.json")

  curl -sS ${AUTH_ARGS:+"${AUTH_ARGS[@]}"} \
    "http://127.0.0.1:8081/v1/execution/runs?limit=20&sort=timestamp_utc:desc" > "$TMP_DIR/runs.json"

  for _ in {1..40}; do
    if curl -fsS ${AUTH_ARGS:+"${AUTH_ARGS[@]}"} \
      "http://127.0.0.1:8081/v1/execution/runs/$EXECUTION_ID" > "$TMP_DIR/run-detail.json"; then
      break
    fi
    sleep 0.25
  done

  curl -sS ${AUTH_ARGS:+"${AUTH_ARGS[@]}"} \
    "http://127.0.0.1:8081/proof/receipts?limit=50&sort=timestamp:desc" > "$TMP_DIR/proof-receipts.json"

  curl -sS ${AUTH_ARGS:+"${AUTH_ARGS[@]}"} \
    -H "Content-Type: application/json" \
    -d "$VERIFY_REQUEST_JSON" \
    "http://127.0.0.1:8081/proof/receipts/verify" > "$TMP_DIR/proof-verify.json"

  node "$HELPER" verify-fallback-persistence \
    "$TMP_DIR/overture-response.json" \
    "$TMP_DIR/runs.json" \
    "$TMP_DIR/run-detail.json" \
    "$TMP_DIR/proof-receipts.json" \
    "$TMP_DIR/proof-verify.json" > "$TMP_DIR/api-visibility.json"
fi

# Final verdict.
node -e '
const fs = require("fs");
const response = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const verification = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const tmpDir = process.argv[3];

if (verification.metadata_route_decision !== "forwarded_to_runtime_task") {
  throw new Error("request was not forwarded to Runtime: " + verification.metadata_route_decision);
}
if (!verification.primary_did_not_win) {
  throw new Error("primary provider unexpectedly won — fallback was not proven");
}
if (!verification.fallback_won) {
  throw new Error("fallback provider did not win — routing_decision=" + verification.envelope_routing_decision);
}
if (!verification.execution_envelope_verified) {
  throw new Error("execution envelope verification failed");
}
const rv = verification.execution_receipt_verified;
if (!rv || !rv.signature_valid || !rv.hash_matches) {
  throw new Error("execution receipt verification failed");
}
if (!verification.receipt_log_entry_found || !verification.receipt_chain_link_valid) {
  throw new Error("receipt log linkage failed");
}

console.log("Fallback execution proof succeeded.");
console.log("");
console.log("Fallback type: cloud-to-cloud (speculative router, ranked mode)");
console.log("Primary provider (failed): " + verification.primary_provider_id);
console.log("Fallback provider (won):   " + verification.fallback_provider_id);
console.log("Envelope routing_decision: " + verification.envelope_routing_decision);
console.log("Route decision (Overture): " + verification.metadata_route_decision);
console.log("Content: " + verification.response_content);

const receipt = response.execution_receipt || {};
console.log("Receipt execution_id: " + receipt.execution_id);
console.log("Receipt hash:         " + receipt.hash);
console.log("Envelope verified:    " + verification.execution_envelope_verified);
console.log("Receipt verified:     " + (rv.signature_valid && rv.hash_matches));

const apiVisibilityPath = tmpDir + "/api-visibility.json";
if (fs.existsSync(apiVisibilityPath)) {
  const av = JSON.parse(fs.readFileSync(apiVisibilityPath, "utf8"));
  console.log("");
  console.log("API visibility:");
  console.log("  Runtime ID: " + av.runtime_id);
  console.log("  Runs list match:   " + av.runs_list_match);
  console.log("  Run detail match:  " + av.run_detail_match);
  console.log("  Receipts match:    " + av.receipts_match);
  console.log("  Receipt verified:  " + av.receipt_verification);
}

console.log("");
console.log("Artifacts: " + tmpDir);
' "$TMP_DIR/overture-response.json" "$TMP_DIR/fallback-verification.json" "$TMP_DIR"
