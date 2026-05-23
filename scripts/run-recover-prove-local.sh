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
    --skip-live)
      SKIP_LIVE=true
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      echo "usage: $0 [--console-base-url <url>] [--skip-live]" >&2
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
    exit 1
  }
}

run_and_capture() {
  local label="$1"
  local log_file="$2"
  shift 2
  echo "[$label] $*"
  "$@" > "$log_file" 2>&1 || {
    local status=$?
    echo "[$label] failed with status $status" >&2
    echo "----- $log_file -----" >&2
    tail -n 120 "$log_file" >&2 || true
    exit "$status"
  }
}

extract_field_from_live_log() {
  local label="$1"
  local log_file="$2"
  awk -F': +' -v key="$label" '$0 ~ key ":" { value=$2 } END { gsub(/^[ \t]+|[ \t]+$/, "", value); print value }' "$log_file"
}

require_cmd node
require_cmd go
require_cmd cargo
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

if [[ "$SKIP_LIVE" == "true" ]]; then
  LIVE_MODE="skipped"
  echo "[live-proof] skipped by --skip-live / IGRIS_LOCAL_PROMISE_SKIP_LIVE=true"
  echo "[live-proof] this is not a full local product demonstration"
else
  if [[ -z "${DATABASE_URL:-${POSTGRES_URL:-}}" && -f "$ROOT_DIR/.env" ]]; then
    set -a
    source "$ROOT_DIR/.env" >/dev/null 2>&1 || true
    set +a
  fi
  if [[ -z "${DATABASE_URL:-${POSTGRES_URL:-}}" ]]; then
    echo "DATABASE_URL or POSTGRES_URL is required for the live run/recover/prove path." >&2
    echo "Set a local Postgres DSN or run with --skip-live to execute only trust-boundary tests." >&2
    exit 1
  fi
  DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
  DB_PREFLIGHT_ERR="$LOG_DIR/db-preflight.err"
  if ! psql "$DB_URL" -qtAc "SELECT 1" >/dev/null 2>"$DB_PREFLIGHT_ERR"; then
    echo "local Postgres preflight failed; cannot connect with DATABASE_URL/POSTGRES_URL." >&2
    echo "psql error is in $DB_PREFLIGHT_ERR" >&2
    exit 1
  fi
  TASK_RECORDS_TABLE=$(psql "$DB_URL" -qtAc "SELECT to_regclass('public.task_records')" 2>"$DB_PREFLIGHT_ERR" | tr -d '[:space:]')
  EXECUTION_CONTEXT_TABLE=$(psql "$DB_URL" -qtAc "SELECT to_regclass('public.execution_context')" 2>"$DB_PREFLIGHT_ERR" | tr -d '[:space:]')
  EXECUTION_LINEAGE_TABLE=$(psql "$DB_URL" -qtAc "SELECT to_regclass('public.execution_lineage')" 2>"$DB_PREFLIGHT_ERR" | tr -d '[:space:]')
  if [[ "$TASK_RECORDS_TABLE" != "task_records" || "$EXECUTION_CONTEXT_TABLE" != "execution_context" || "$EXECUTION_LINEAGE_TABLE" != "execution_lineage" ]]; then
    echo "local Postgres preflight failed; required Overture tables are missing." >&2
    echo "required: task_records, execution_context, execution_lineage" >&2
    echo "run migrations for the local database, or use --skip-live for trust-boundary tests only." >&2
    exit 1
  fi

  echo "[live-proof] starting Overture/runtime, registering runtime key, submitting action_task, and verifying proof"
  "$SCRIPT_DIR/action_task_v1_proof_demo.sh" --console-base-url "$CONSOLE_BASE_URL" 2>&1 | tee "$LIVE_LOG"

  TASK_ID=$(extract_field_from_live_log "task_id" "$LIVE_LOG")
  RUNTIME_ID=$(extract_field_from_live_log "runtime_id" "$LIVE_LOG")
  EXECUTION_ID=$(extract_field_from_live_log "execution_id" "$LIVE_LOG")
  RECEIPT_VERIFY_STATUS=$(extract_field_from_live_log "receipt verify HTTP status" "$LIVE_LOG")
  TASK_VERIFY_STATUS=$(extract_field_from_live_log "task verify HTTP status" "$LIVE_LOG")

  if [[ -z "$TASK_ID" || -z "$RUNTIME_ID" || -z "$EXECUTION_ID" ]]; then
    echo "live proof completed but did not print task_id/runtime_id/execution_id; refusing to claim local proof" >&2
    exit 1
  fi
  if [[ "$RECEIPT_VERIFY_STATUS" != "200" || "$TASK_VERIFY_STATUS" != "200" ]]; then
    echo "proof verification did not return HTTP 200 (receipt=$RECEIPT_VERIFY_STATUS task=$TASK_VERIFY_STATUS)" >&2
    exit 1
  fi
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
node - <<'NODE' "$SUMMARY_JSON" "$LIVE_MODE" "$TASK_ID" "$RUNTIME_ID" "$EXECUTION_ID" "$RECEIPT_VERIFY_STATUS" "$TASK_VERIFY_STATUS" "$CONSOLE_BASE_URL"
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
] = process.argv.slice(2);
const apiBase = "http://127.0.0.1:8081";
const summary = {
  generated_at: new Date().toISOString(),
  live_mode: liveMode,
  strict_signed_callbacks: true,
  unsigned_callback_compatibility: "disabled",
  task_id: taskId || null,
  runtime_id: runtimeId || null,
  execution_id: executionId || null,
  proof: {
    receipt_verify_http_status: receiptVerifyStatus || null,
    task_verify_http_status: taskVerifyStatus || null,
    status: liveMode === "real" ? "verified_when_status_200" : "not_run",
  },
  urls: {
    task_api: taskId ? `${apiBase}/v1/tasks/${taskId}` : null,
    steps_api: taskId ? `${apiBase}/v1/tasks/${taskId}/steps` : null,
    task_verify_api: taskId ? `${apiBase}/v1/tasks/${taskId}/proof/verify` : null,
    execution_run_api: executionId ? `${apiBase}/v1/execution/runs/${executionId}` : null,
    receipts_api: `${apiBase}/proof/receipts`,
    violations_api: `${apiBase}/v1/execution/governance/boundary-violations`,
    console_task: taskId && consoleBaseUrl ? `${consoleBaseUrl}/execution/tasks/${taskId}` : null,
    console_proof: consoleBaseUrl ? `${consoleBaseUrl}/proof/receipts` : null,
    console_violations: consoleBaseUrl ? `${consoleBaseUrl}/proof/violations` : null,
  },
  scenarios: {
    read_only_action_execution: liveMode === "real" ? "covered_live" : "skipped",
    signed_callback_rejection: "covered_by_strict_go_route_tests",
    irreversible_recovery_blocking: "covered_by_coordinator_tests",
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
echo "  receipt verify HTTP status:    ${RECEIPT_VERIFY_STATUS:-n/a}"
echo "  task verify HTTP status:       ${TASK_VERIFY_STATUS:-n/a}"
echo "  task API:                      ${TASK_ID:+http://127.0.0.1:8081/v1/tasks/$TASK_ID}"
echo "  run API:                       ${EXECUTION_ID:+http://127.0.0.1:8081/v1/execution/runs/$EXECUTION_ID}"
echo "  receipts API:                  http://127.0.0.1:8081/proof/receipts"
echo "  violations API:                http://127.0.0.1:8081/v1/execution/governance/boundary-violations"
if [[ -n "$CONSOLE_BASE_URL" && -n "$TASK_ID" ]]; then
  echo "  console task:                  $CONSOLE_BASE_URL/execution/tasks/$TASK_ID"
  echo "  console proof:                 $CONSOLE_BASE_URL/proof/receipts"
  echo "  console violations:            $CONSOLE_BASE_URL/proof/violations"
fi
echo "  redacted evidence summary:     $SUMMARY_JSON"
echo "  logs:                          $LOG_DIR"
