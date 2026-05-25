#!/bin/zsh

# Local Run / Recover / Prove promise flow.
#
# Main path:
#   1. Runs the existing Action Task V1 live proof demo. That demo starts
#      Overture, starts a local Rust runtime, registers the runtime Ed25519 key,
#      submits a deterministic read-only/local action_task, verifies receipts,
#      and prints task/run/proof URLs.
#   2. Runs strict signed runtime callback tests. These exercise the coordinator
#      callback trust boundary without enabling unsigned compatibility mode.
#   3. Runs irreversible recovery-blocking and proof tamper tests.
#   4. Writes a redacted summary JSON. It intentionally excludes private keys,
#      raw API keys, session tokens, callback bodies, and raw environment values.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/igris-run-recover-prove-local.XXXXXX")
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"

CONSOLE_BASE_URL="${CONSOLE_URL:-http://127.0.0.1:3000}"
SKIP_LIVE="${IGRIS_LOCAL_PROMISE_SKIP_LIVE:-false}"
MIGRATIONS_DIR="$ROOT_DIR/igris-overture/database/migrations"
LOCAL_ENV_FILE="$ROOT_DIR/.env.run-recover-prove-local"
MODE="run"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --doctor|--preflight)
      MODE="doctor"
      shift
      ;;
    --migrate)
      MODE="migrate"
      shift
      ;;
    --console-base-url)
      CONSOLE_BASE_URL="${2:-}"
      shift 2
      ;;
    --console-base-url=*)
      CONSOLE_BASE_URL="${1#*=}"
      shift
      ;;
    --skip-live)
      SKIP_LIVE=true
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      echo "usage: $0 [--doctor|--preflight|--migrate] [--console-base-url <url>] [--skip-live]" >&2
      exit 2
      ;;
  esac
done
while [[ "$CONSOLE_BASE_URL" == */ ]]; do
  CONSOLE_BASE_URL="${CONSOLE_BASE_URL%/}"
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    case "$1" in
      psql) echo "fix: install the PostgreSQL client (macOS: brew install libpq && brew link --force libpq, or brew install postgresql@16)" >&2 ;;
      go) echo "fix: install Go and ensure go is on PATH" >&2 ;;
      cargo) echo "fix: install Rust with rustup and ensure cargo is on PATH" >&2 ;;
      node) echo "fix: install Node 20+ and ensure node is on PATH" >&2 ;;
      curl) echo "fix: install curl and ensure curl is on PATH" >&2 ;;
      lsof) echo "fix: install lsof or run on a system that provides it" >&2 ;;
    esac
    exit 1
  }
}

redact_file_tail() {
  local file="$1"
  if [[ -s "$file" ]]; then
    tail -n 40 "$file" | sed -E \
      -e 's#(postgres(ql)?://)[^/@[:space:]]+@#\1***REDACTED***@#g' \
      -e 's#(password=)[^[:space:]]+#\1***REDACTED***#g' \
      -e 's#(://[^:/[:space:]]+:)[^@[:space:]]+@#\1***REDACTED***@#g' >&2 || true
  fi
}

load_env_file_if_needed() {
  if [[ -z "${DATABASE_URL:-${POSTGRES_URL:-}}" && -f "$LOCAL_ENV_FILE" ]]; then
    set -a
    source "$LOCAL_ENV_FILE" >/dev/null 2>&1 || true
    set +a
  fi
  if [[ -z "${DATABASE_URL:-${POSTGRES_URL:-}}" && -f "$ROOT_DIR/.env" ]]; then
    set -a
    source "$ROOT_DIR/.env" >/dev/null 2>&1 || true
    set +a
  fi
}

db_url_or_fail() {
  load_env_file_if_needed
  if [[ -z "${DATABASE_URL:-${POSTGRES_URL:-}}" ]]; then
    echo "requirement failed: DATABASE_URL or POSTGRES_URL is not configured for the full live demo." >&2
    echo "fix: start local Postgres, create an empty database, then export a DSN, for example:" >&2
    echo "     export DATABASE_URL='postgres://<user>@localhost:5432/igris_overture?sslmode=disable'" >&2
    echo "     scripts/run-recover-prove-local.sh --migrate" >&2
    echo "smoke only: make run-recover-prove-local-smoke" >&2
    exit 1
  fi
  DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
}

print_db_summary() {
  DB_URL="$DB_URL" node - <<'NODE'
const raw = process.env.DB_URL || "";
try {
  const u = new URL(raw);
  const database = (u.pathname || "").replace(/^\//, "") || null;
  console.log(`  database:        ${u.protocol.replace(":", "")}://${u.hostname || "localhost"}:${u.port || "default"}/${database || ""}`);
  console.log(`  db auth:         user=${u.username ? "set" : "unset"}, password=${u.password ? "set" : "unset"}, sslmode=${u.searchParams.get("sslmode") || "default"}`);
} catch (_) {
  console.log("  database:        invalid URL syntax");
}
NODE
}

query_scalar() {
  local sql="$1"
  psql "$DB_URL" -X -tAqc "$sql"
}

psql_preflight() {
  local err_file="$LOG_DIR/db-preflight.err"
  if ! psql "$DB_URL" -X -v ON_ERROR_STOP=1 -qtAc "SELECT 1" >/dev/null 2>"$err_file"; then
    echo "requirement failed: cannot connect to local Postgres with DATABASE_URL/POSTGRES_URL." >&2
    print_db_summary >&2
    echo "fix: verify Postgres is running and the configured database exists." >&2
    echo "     macOS/Homebrew: brew services start postgresql@16" >&2
    echo "     Docker: docker compose -f docker-compose.minimal.yml up -d postgres" >&2
    echo "     then run: scripts/run-recover-prove-local.sh --doctor" >&2
    echo "sanitized psql diagnostic:" >&2
    redact_file_tail "$err_file"
    return 1
  fi
}

require_port_free() {
  local port="$1"
  local label="$2"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "requirement failed: port $port is already in use ($label)." >&2
    echo "fix: stop the process using port $port, then rerun --doctor." >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN | awk 'NR==1 || NR<=6 {print "  " $0}' >&2 || true
    return 1
  fi
}

ensure_schema_migrations() {
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
SQL
}

apply_migration_if_needed() {
  local migration_name="$1"
  local migration_file="$MIGRATIONS_DIR/$migration_name.sql"
  if [[ ! -f "$migration_file" ]]; then
    echo "requirement failed: missing migration file $migration_file" >&2
    exit 1
  fi
  local applied
  applied=$(query_scalar "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '$migration_name');")
  if [[ "$applied" == "t" ]]; then
    echo "[db] $migration_name already recorded"
    return 0
  fi
  echo "[db] applying $migration_name"
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q -f "$migration_file"
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name') ON CONFLICT (migration_name) DO NOTHING;"
}

apply_local_migrations() {
  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    echo "requirement failed: Overture migrations directory is missing: $MIGRATIONS_DIR" >&2
    exit 1
  fi
  psql_preflight
  ensure_schema_migrations

  local required_migrations=(
    "005_runtime_instances"
    "006_execution_lineage"
    "015_better_auth"
    "016_schema_gaps"
    "031_task_records"
    "032_task_record_artifacts"
    "033_task_proof_state"
    "034_task_cancellation"
    "035_task_failure_details"
    "043_ai_capability_governance_audit"
    "047_execution_context"
    "048_verified_execution_schema_repair"
    "049_task_proof_verification_summary"
    "050_tenant_email_alignment"
    "051_execution_governance_recovery"
    "052_runtime_callback_envelopes"
    "053_tenant_local_proof_columns"
  )

  local has_task_records
  has_task_records=$(query_scalar "SELECT to_regclass('public.task_records') IS NOT NULL;")
  if [[ "$has_task_records" != "t" ]]; then
    echo "[db] clean schema detected; applying live-demo required migrations"
    local migration_name
    for migration_name in "${required_migrations[@]}"; do
      apply_migration_if_needed "$migration_name"
    done
  else
    echo "[db] existing schema detected; applying live-demo required additive migrations"
    local migration_name
    for migration_name in "${required_migrations[@]}"; do
      apply_migration_if_needed "$migration_name"
    done
  fi
}

require_relation() {
  local relation="$1"
  local found
  found=$(query_scalar "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$relation');")
  if [[ "$found" != "t" ]]; then
    echo "schema missing table: $relation" >&2
    return 1
  fi
}

require_column() {
  local relation="$1"
  local column="$2"
  local found
  found=$(query_scalar "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$relation' AND column_name = '$column');")
  if [[ "$found" != "t" ]]; then
    echo "schema missing column: $relation.$column" >&2
    return 1
  fi
}

preflight_live_requirements() {
  require_cmd node
  require_cmd go
  require_cmd cargo
  require_cmd curl
  require_cmd lsof
  require_cmd psql
  db_url_or_fail

  echo "[doctor] Checking local Postgres connection"
  print_db_summary
  psql_preflight

  echo "[doctor] Checking required ports"
  require_port_free 8080 "runtime" || return 1
  require_port_free 8081 "Overture API" || return 1
  require_port_free 18090 "mock provider" || return 1
  require_port_free 18091 "action target" || return 1

  echo "[doctor] Checking live-demo schema"
  local failed=false
  local relations=(
    "task_records"
    "wal_checkpoints"
    "execution_context"
    "execution_lineage"
    "runtime_instances"
    "tenants"
    "user"
    "session"
    "action_policy_decisions"
    "task_recovery_events"
    "execution_boundaries"
    "boundary_violations"
    "runtime_callback_nonces"
  )
  local relation
  for relation in "${relations[@]}"; do
    require_relation "$relation" || failed=true
  done
  local columns=(
    "task_records:last_checkpoint"
    "task_records:proof_verified"
    "task_records:proof_hash_valid"
    "task_records:proof_signature_matches"
    "task_records:proof_runtime_key_found"
    "task_records:proof_chain_link_valid"
    "task_records:proof_verified_at"
    "task_records:latest_policy_decision_id"
    "task_records:recovery_policy"
    "wal_checkpoints:wal_entries"
    "wal_checkpoints:policy_decision_id"
    "execution_context:task_id"
    "execution_lineage:receipt_hash"
    "execution_lineage:signature"
    "execution_lineage:previous_hash"
    "runtime_instances:public_key_ed25519"
    "runtime_instances:tenant_id"
    "runtime_instances:status"
  )
  local pair table column
  for pair in "${columns[@]}"; do
    table="${pair%%:*}"
    column="${pair#*:}"
    require_column "$table" "$column" || failed=true
  done
  if [[ "$failed" == "true" ]]; then
    echo "fix: run scripts/run-recover-prove-local.sh --migrate, then rerun --doctor." >&2
    return 1
  fi
  echo "[doctor] Live local prerequisites are ready"
}

run_and_capture() {
  local label="$1"
  local log_file="$2"
  shift 2
  echo "[$label] $*"
  "$@" > "$log_file" 2>&1 || {
    local exit_code=$?
    echo "[$label] failed with status $exit_code" >&2
    echo "----- $log_file -----" >&2
    tail -n 120 "$log_file" >&2 || true
    exit "$exit_code"
  }
}

extract_field_from_live_log() {
  local label="$1"
  local log_file="$2"
  awk -F': +' -v key="$label" '
    {
      line=$0
      sub(/^[ \t]+/, "", line)
      if (index(line, key ":") == 1) { value=$2 }
    }
    END { gsub(/^[ \t]+|[ \t]+$/, "", value); print value }
  ' "$log_file"
}

if [[ "$MODE" == "migrate" ]]; then
  require_cmd node
  require_cmd psql
  db_url_or_fail
  echo "Run / Recover / Prove local migration preflight"
  echo "  artifacts: $TMP_DIR"
  print_db_summary
  apply_local_migrations
  preflight_live_requirements
  exit 0
fi

if [[ "$MODE" == "doctor" ]]; then
  echo "Run / Recover / Prove local doctor"
  echo "  artifacts: $TMP_DIR"
  preflight_live_requirements
  exit 0
fi

require_cmd node
require_cmd go
require_cmd cargo
require_cmd curl
require_cmd lsof
require_cmd psql

if [[ "${IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS:-}" == "true" || "${IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS:-}" == "1" || "${IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS:-}" == "yes" ]]; then
  echo "IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS must be disabled for the local promise flow" >&2
  exit 1
fi
export IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS=false

echo "Run / Recover / Prove local flow"
echo "  artifacts:        $TMP_DIR"
echo "  console base URL: $CONSOLE_BASE_URL"
echo "  strict callbacks: enabled"

LIVE_LOG="$LOG_DIR/action-task-live-proof.log"
TASK_ID=""
RUNTIME_ID=""
EXECUTION_ID=""
RECEIPT_VERIFY_STATUS=""
TASK_VERIFY_STATUS=""
LIVE_MODE="real"
CALLBACK_MODE="fallback-test-backed"
CALLBACK_EVIDENCE=""
FAILURE_TASK_ID=""
FAILURE_RECOVERY_EVENT_URL=""
FAILURE_TASK_API=""
FAILURE_CONSOLE_TASK=""
FAILURE_RECOVERY_MODE="fallback-test-backed"

if [[ "$SKIP_LIVE" == "true" ]]; then
  LIVE_MODE="skipped"
  echo "[live-proof] skipped by --skip-live / IGRIS_LOCAL_PROMISE_SKIP_LIVE=true"
  echo "[live-proof] this is not a full local product demonstration"
else
  preflight_live_requirements

  echo "[live-proof] starting Overture/runtime, registering runtime key, submitting action_task, and verifying proof"
  "$SCRIPT_DIR/action_task_v1_proof_demo.sh" --console-base-url "$CONSOLE_BASE_URL" --include-failure-recovery 2>&1 | tee "$LIVE_LOG"

  TASK_ID=$(extract_field_from_live_log "task_id" "$LIVE_LOG")
  RUNTIME_ID=$(extract_field_from_live_log "runtime_id" "$LIVE_LOG")
  EXECUTION_ID=$(extract_field_from_live_log "execution_id" "$LIVE_LOG")
  RECEIPT_VERIFY_STATUS=$(extract_field_from_live_log "receipt verify HTTP status" "$LIVE_LOG")
  TASK_VERIFY_STATUS=$(extract_field_from_live_log "task verify HTTP status" "$LIVE_LOG")
  CALLBACK_EVIDENCE=$(extract_field_from_live_log "callback evidence" "$LIVE_LOG")
  FAILURE_TASK_ID=$(extract_field_from_live_log "failure task_id" "$LIVE_LOG")
  FAILURE_RECOVERY_EVENT_URL=$(extract_field_from_live_log "recovery event URL" "$LIVE_LOG")
  FAILURE_TASK_API=$(extract_field_from_live_log "failure task API" "$LIVE_LOG")
  FAILURE_CONSOLE_TASK=$(extract_field_from_live_log "Failure Task Inspector" "$LIVE_LOG")

  if [[ -z "$TASK_ID" || -z "$RUNTIME_ID" || -z "$EXECUTION_ID" ]]; then
    echo "live proof completed but did not print task_id/runtime_id/execution_id; refusing to claim local proof" >&2
    exit 1
  fi
  if [[ "$RECEIPT_VERIFY_STATUS" != "200" || "$TASK_VERIFY_STATUS" != "200" ]]; then
    echo "proof verification did not return HTTP 200 (receipt=$RECEIPT_VERIFY_STATUS task=$TASK_VERIFY_STATUS)" >&2
    exit 1
  fi
  if [[ -z "$CALLBACK_EVIDENCE" || ! -s "$CALLBACK_EVIDENCE" ]]; then
    echo "live proof completed but did not produce accepted signed callback evidence" >&2
    exit 1
  fi
  CALLBACK_MODE="live-server-backed"
  if [[ -z "$FAILURE_TASK_ID" || -z "$FAILURE_RECOVERY_EVENT_URL" ]]; then
    echo "live proof completed but did not produce failure/recovery-blocking evidence" >&2
    exit 1
  fi
  FAILURE_RECOVERY_MODE="live-server-backed"
fi

CALLBACK_LOG="$LOG_DIR/runtime-callback-tests.log"
run_and_capture "signed-callbacks" "$CALLBACK_LOG" \
  env GOCACHE=/tmp/igris-gocache-local-promise \
  go test ./igris-overture/api \
  -run 'TestHandleTask(Checkpoint|Complete|Failed)|TestRuntimeCallbackEnvelope' \
  -count=1 -timeout=120s

RUNTIME_SIGNER_LOG="$LOG_DIR/runtime-callback-signer-tests.log"
run_and_capture "runtime-callback-signer" "$RUNTIME_SIGNER_LOG" \
  cargo test --manifest-path "$ROOT_DIR/igris-runtime/crates/igris-server/Cargo.toml" runtime_callback --features agent-platform

RECOVERY_LOG="$LOG_DIR/recovery-blocking-tests.log"
run_and_capture "recovery-blocking" "$RECOVERY_LOG" \
  env GOCACHE=/tmp/igris-gocache-local-promise \
  go test ./igris-overture/coordinator \
  -run 'TestEvaluateActionPolicyBlocksIrreversibleRecoveryReplay|TestRecoveryHandoffBlocksSameRuntimeOnlyMigration' \
  -count=1 -timeout=120s

PROOF_TAMPER_LOG="$LOG_DIR/proof-tamper-tests.log"
run_and_capture "proof-tamper" "$PROOF_TAMPER_LOG" \
  env GOCACHE=/tmp/igris-gocache-local-promise \
  go test ./igris-overture/api \
  -run 'TestVerifyReceipt(StoredValuesAloneCannotMarkVerifiedTrue|ReturnsCleanlyWithoutRuntimeIdentity|ChainLinkRejectsTamperedPriorReceipt)' \
  -count=1 -timeout=120s

SUMMARY_JSON="$TMP_DIR/redacted-evidence-summary.json"
node - <<'NODE' "$SUMMARY_JSON" "$LIVE_MODE" "$TASK_ID" "$RUNTIME_ID" "$EXECUTION_ID" "$RECEIPT_VERIFY_STATUS" "$TASK_VERIFY_STATUS" "$CONSOLE_BASE_URL" "$CALLBACK_MODE" "$CALLBACK_EVIDENCE" "$FAILURE_RECOVERY_MODE" "$FAILURE_TASK_ID" "$FAILURE_RECOVERY_EVENT_URL" "$FAILURE_TASK_API" "$FAILURE_CONSOLE_TASK"
const fs = require("fs");
const [
  outPath,
  liveMode,
  taskId,
  runtimeId,
  executionId,
  receiptVerifyStatus,
  taskVerifyStatus,
  consoleBaseUrl,
  callbackMode,
  callbackEvidence,
  failureRecoveryMode,
  failureTaskId,
  failureRecoveryEventUrl,
  failureTaskApi,
  failureConsoleTask,
] = process.argv.slice(2);
const apiBase = "http://127.0.0.1:8081";
const summary = {
  generated_at: new Date().toISOString(),
  live_mode: liveMode,
  strict_signed_callbacks: true,
  unsigned_callback_compatibility: "disabled",
  callback_mode: callbackMode || "fallback-test-backed",
  task_id: taskId || null,
  runtime_id: runtimeId || null,
  execution_id: executionId || null,
  proof: {
    receipt_verify_http_status: receiptVerifyStatus || null,
    task_verify_http_status: taskVerifyStatus || null,
    status: liveMode === "real" ? "verified_when_status_200" : "not_run",
  },
  callback_evidence: {
    mode: callbackMode || "fallback-test-backed",
    evidence_path: callbackEvidence || null,
  },
  failure_recovery_evidence: {
    mode: failureRecoveryMode || "fallback-test-backed",
    task_id: failureTaskId || null,
    failed_callback_evidence_path: callbackEvidence || null,
    recovery_event_url: failureRecoveryEventUrl || null,
    task_api: failureTaskApi || null,
    console_task: failureConsoleTask || null,
    expected_block_reason: failureTaskId ? "irreversible action cannot be automatically replayed during recovery" : null,
  },
  urls: {
    task_api: taskId ? `${apiBase}/v1/tasks/${taskId}` : null,
    steps_api: taskId ? `${apiBase}/v1/tasks/${taskId}/steps` : null,
    task_verify_api: taskId ? `${apiBase}/v1/tasks/${taskId}/proof/verify` : null,
    execution_run_api: executionId ? `${apiBase}/v1/execution/runs/${executionId}` : null,
    receipts_api: `${apiBase}/proof/receipts`,
    violations_api: `${apiBase}/v1/execution/governance/boundary-violations`,
    console_task: taskId && consoleBaseUrl ? `${consoleBaseUrl}/execution/tasks/${taskId}` : null,
    console_failure_task: failureConsoleTask || null,
    console_proof: consoleBaseUrl ? `${consoleBaseUrl}/proof/receipts` : null,
    console_violations: consoleBaseUrl ? `${consoleBaseUrl}/proof/violations` : null,
  },
  scenarios: {
    read_only_action_execution: liveMode === "real" ? "covered_live" : "skipped",
    signed_callback_rejection: "covered_by_strict_go_route_tests",
    signed_failed_callback: failureTaskId ? "covered_live" : "covered_by_strict_go_route_tests",
    irreversible_recovery_blocking: failureTaskId ? "covered_live" : "covered_by_coordinator_tests",
    proof_verification: liveMode === "real" ? "covered_live_and_tamper_tests" : "covered_by_tamper_tests_only",
  },
  redaction: {
    excludes_private_keys: true,
    excludes_raw_tokens: true,
    excludes_raw_callback_bodies: true,
    excludes_credentials: true,
  },
};
fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
NODE

echo ""
echo "Local Run / Recover / Prove result"
echo "  live action path:              $LIVE_MODE"
echo "  task_id:                       ${TASK_ID:-n/a}"
echo "  runtime_id:                    ${RUNTIME_ID:-n/a}"
echo "  execution_id:                  ${EXECUTION_ID:-n/a}"
echo "  signed callback mode:          $CALLBACK_MODE"
echo "  callback evidence:             ${CALLBACK_EVIDENCE:-n/a}"
echo "  failure/recovery mode:         $FAILURE_RECOVERY_MODE"
echo "  failure task_id:               ${FAILURE_TASK_ID:-n/a}"
echo "  failed callback evidence:      ${CALLBACK_EVIDENCE:-n/a}"
echo "  recovery event URL:            ${FAILURE_RECOVERY_EVENT_URL:-n/a}"
echo "  receipt verify HTTP status:    ${RECEIPT_VERIFY_STATUS:-n/a}"
echo "  task verify HTTP status:       ${TASK_VERIFY_STATUS:-n/a}"
echo "  task API:                      ${TASK_ID:+http://127.0.0.1:8081/v1/tasks/$TASK_ID}"
echo "  run API:                       ${EXECUTION_ID:+http://127.0.0.1:8081/v1/execution/runs/$EXECUTION_ID}"
echo "  receipts API:                  http://127.0.0.1:8081/proof/receipts"
echo "  violations API:                http://127.0.0.1:8081/v1/execution/governance/boundary-violations"
if [[ -n "$CONSOLE_BASE_URL" && -n "$TASK_ID" ]]; then
  echo "  console task:                  $CONSOLE_BASE_URL/execution/tasks/$TASK_ID"
  if [[ -n "$FAILURE_TASK_ID" ]]; then
    echo "  console failure task:          ${FAILURE_CONSOLE_TASK:-$CONSOLE_BASE_URL/execution/tasks/$FAILURE_TASK_ID}"
  fi
  echo "  console proof:                 $CONSOLE_BASE_URL/proof/receipts"
  echo "  console violations:            $CONSOLE_BASE_URL/proof/violations"
fi
echo "  redacted evidence summary:     $SUMMARY_JSON"
echo "  logs:                          $LOG_DIR"
