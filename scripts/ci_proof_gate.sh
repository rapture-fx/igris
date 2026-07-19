#!/usr/bin/env bash

# CI proof gate for durable task recovery.
#
# Usage:
#   scripts/ci_proof_gate.sh fast
#   scripts/ci_proof_gate.sh heavy
#
# The fast tier applies/checks the durable-task schema and runs focused
# backend tests. The heavy tier additionally runs the live Action Task V1 proof
# scripts, including cumulative clean-host recovery.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
MIGRATIONS_DIR="$ROOT_DIR/igris-overture/database/migrations"
TIER="${1:-fast}"

if [[ "$TIER" != "fast" && "$TIER" != "heavy" ]]; then
  echo "usage: scripts/ci_proof_gate.sh [fast|heavy]" >&2
  exit 2
fi

if [[ -z "${DATABASE_URL:-}" && -z "${POSTGRES_URL:-}" && -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env" >/dev/null 2>&1 || true
  set +a
fi
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"

# The proof scripts sign runtime artifacts with a LOCAL TEST key at
# .igris/runtime-signing-key.ed25519 (a 32-byte hex seed). Dev machines have
# one from earlier runs; clean CI runners do not, and the older proof scripts
# assume it exists. Generate an ephemeral throwaway seed when missing — this
# is proof/test infrastructure only, never production keying, and the path is
# gitignored. (The newer dogfood smokes already self-provision the same way.)
RUNTIME_KEY_FILE="$ROOT_DIR/.igris/runtime-signing-key.ed25519"
if [[ ! -f "$RUNTIME_KEY_FILE" ]]; then
  mkdir -p "$ROOT_DIR/.igris"
  umask 077
  node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex") + "\n")' > "$RUNTIME_KEY_FILE"
  echo "[proof-gate] generated ephemeral test signing key at .igris/runtime-signing-key.ed25519"
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

query_scalar() {
  local sql="$1"
  psql "$DB_URL" -X -tAqc "$sql"
}

apply_required_overture_migrations() {
  if [[ -z "$DB_URL" ]]; then
    echo "DATABASE_URL or POSTGRES_URL is required for the CI proof gate" >&2
    exit 1
  fi
  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    echo "missing migrations directory: $MIGRATIONS_DIR" >&2
    exit 1
  fi

  echo "[db] Checking PostgreSQL connectivity"
  psql "$DB_URL" -X -q -c "SELECT 1;" >/dev/null

  echo "[db] Ensuring schema_migrations exists"
  psql "$DB_URL" -X -q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
SQL

  echo "[db] Applying existing durable-task proof migrations"
  local required_migrations=(
    # runtime_instances and its tenant-scoped columns must exist before the
    # proof scripts register runtimes. POST /api/v1/runtime/register inserts
    # (runtime_id, tenant_id, machine_id, hostname_cached, ip_address, status,
    # last_heartbeat, ...): 005 creates the base table, 007 adds tenant_id and
    # creates the tenants table the proof-tenant setup needs, 008 adds
    # machine_id/hostname_cached/ip_address/last_heartbeat/status. Without all
    # three a fresh proof DB made registration 500 on clean CI runners. All are
    # CREATE/ALTER ... IF NOT EXISTS, so already-provisioned DBs are unaffected.
    "005_runtime_instances"
    "006_execution_lineage"
    "007_pricing_model_refactor"
    "008_runtime_registry"
    # BetterAuth session-based auth tables (user/session/account/verification).
    # After registration passes, the proof performs a session lookup that hits
    # `relation "session" does not exist` on a fresh proof DB. 015 creates them;
    # all CREATE TABLE ... IF NOT EXISTS, so already-provisioned DBs are unaffected.
    "015_better_auth"
    "031_task_records"
    "032_task_record_artifacts"
    "033_task_proof_state"
    "034_task_cancellation"
    "035_task_failure_details"
    "043_ai_capability_governance_audit"
    "047_execution_context"
    "048_verified_execution_schema_repair"
    "049_task_proof_verification_summary"
    # task submission of an action_task with sensitive input (http_call headers)
    # runs CheckpointStore.CreateTaskWithExecutionInputRefs — one transaction that
    # writes task_records AND execution_input_refs/execution_input_ref_audit. On a
    # fresh proof DB each missing piece 503s ("dispatch_failed") in turn:
    #   056 — creates execution_input_refs + execution_input_ref_audit (the encrypted
    #         sensitive-input rows the submit transaction stores)
    #   057 — replaces 031's GLOBAL idempotency unique index with the composite
    #         (tenant_id, idempotency_key) index the INSERT's ON CONFLICT target needs
    #   062 — adds registered_agent_id/registered_agent_name columns
    # All are CREATE/ALTER/INDEX ... IF NOT EXISTS (057 also DROP INDEX IF EXISTS),
    # so already-provisioned DBs are unaffected.
    #
    # For an action_task the submit also persists an action policy decision
    # (SaveActionPolicyDecision) before dispatch: 051 creates action_policy_decisions
    # (+ the boundary/approval/verification tables the best-effort follow-ups touch).
    # Without it submit 503s ("persist action policy decision: ... action_policy_decisions
    # does not exist"). ai_task_permission_audit (SaveTaskPermissionEnvelope) and the
    # MarkDispatched columns are already covered by 043 and 031. 051's FKs are all
    # internal to itself (+ task_records, already present).
    "051_execution_governance_recovery"
    # After submit returns 202 the proof polls GET /v1/tasks/:id, whose task-detail
    # SELECT reads task_records.executed_target/fallback_reason. Those columns are
    # added by 055; without them the read 500s ("column executed_target does not
    # exist"). 055 also ALTERs action_definitions (fallback_policy), so it requires
    # that table — created by 054. Add both in order (054 -> 055). 054 is a
    # standalone CREATE TABLE IF NOT EXISTS; 055 is ALTER/INDEX ... IF NOT EXISTS
    # (its CHECK constraint is guarded by a pg_constraint existence probe), so
    # already-provisioned DBs are unaffected.
    "054_action_definitions"
    "055_action_execution_targets"
    "056_execution_input_refs"
    "057_task_records_tenant_scoped_idempotency"
    # Once a resumable action_task runs, the runtime posts a signed checkpoint to
    # POST /v1/tasks/:id/checkpoint. validateRuntimeCallback verifies the signed
    # envelope and then calls reserveRuntimeCallbackNonce, which INSERTs into
    # runtime_callback_nonces for replay protection. On a fresh proof DB that
    # table is absent, so the INSERT errors, the callback fails closed with the
    # default 403 status ("runtime callback replay store failed: ... relation
    # \"runtime_callback_nonces\" does not exist"), and the coordinator then marks
    # the runtime failed and reports "no runtime available for recovery". 052
    # creates runtime_callback_nonces (a standalone CREATE TABLE ... IF NOT EXISTS
    # with no external FKs), so already-provisioned DBs are unaffected. This does
    # not weaken callback auth: signature/identity/timestamp/replay checks all
    # still run — it only provisions the replay-protection table they require.
    "052_runtime_callback_envelopes"
    "062_task_records_registered_agent"
    # Contract-bound durable Action proof: 067 records immutable SDK contract
    # versions, 068 stores separately verified Embedded evidence, 069 enforces
    # database immutability, and 070 adds explicit contract-to-target bindings
    # plus immutable durable-run/evidence links.
    "067_action_contract_versions"
    "068_sdk_evidence_ingestion"
    "069_connected_immutable_records"
    "070_contract_execution_bindings"
  )
  local migration_file
  local migration_name
  for migration_name in "${required_migrations[@]}"; do
    migration_file="$MIGRATIONS_DIR/$migration_name.sql"
    if [[ ! -f "$migration_file" ]]; then
      echo "required migration missing: $migration_file" >&2
      exit 1
    fi
    local applied
    applied=$(query_scalar "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '$migration_name');")
    if [[ "$applied" == "t" ]]; then
      echo "[db] $migration_name already applied"
      continue
    fi
    echo "[db] applying $migration_name"
    psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q -f "$migration_file"
    psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name') ON CONFLICT (migration_name) DO NOTHING;"
  done
}

require_relation() {
  local relation="$1"
  local found
  found=$(query_scalar "SELECT to_regclass('public.$relation');")
  if [[ "$found" != "$relation" ]]; then
    echo "required table missing after migrations: $relation" >&2
    exit 1
  fi
}

require_column() {
  local relation="$1"
  local column="$2"
  local found
  found=$(query_scalar "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$relation' AND column_name = '$column');")
  if [[ "$found" != "t" ]]; then
    echo "required column missing after migrations: $relation.$column" >&2
    exit 1
  fi
}

preflight_durable_task_schema() {
  echo "[db] Preflighting durable-task proof schema"
  require_relation "task_records"
  require_relation "wal_checkpoints"
  require_relation "execution_context"
  require_relation "execution_lineage"
  # Signed runtime checkpoint callbacks reserve a replay nonce here; without the
  # table the callback fails closed (403) and recovery reports no runtime.
  require_relation "runtime_callback_nonces"
  require_relation "action_contract_execution_bindings"
  require_relation "contract_bound_action_runs"
  require_relation "contract_bound_action_evidence_links"

  require_column "task_records" "last_checkpoint"
  require_column "task_records" "proof_verified"
  require_column "task_records" "proof_hash_valid"
  require_column "task_records" "proof_signature_matches"
  require_column "task_records" "proof_runtime_key_found"
  require_column "task_records" "proof_chain_link_valid"
  require_column "task_records" "proof_verified_at"
  require_column "wal_checkpoints" "wal_entries"
  require_column "wal_checkpoints" "step_index"
  require_column "execution_context" "task_id"
  require_column "execution_lineage" "receipt_hash"
  echo "[db] Durable-task proof schema is ready"
}

run_fast_gate() {
  echo "[fast] Running focused backend tests"
  PROVIDER_MODE=mock \
    ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION=true \
    PROVIDER_TEST_MODE=true \
    VALIDATE_KEYS_ON_STARTUP=false \
    go test ./igris-overture/api ./igris-overture/coordinator ./cmd/igris-overture/handlers ./igris-overture/internal -count=1 -timeout=180s
}

# Honest cgroup-containment capability probe for the Tier A / Tier B split.
#
# The runtime's igris-safety supervisor fails CLOSED on Linux when it cannot
# attach the worker to a CPU cgroup (agent-inference execution refuses to run
# uncontained). GitHub-hosted runners deny cgroup creation to the unprivileged
# job user, so the agent-inference proofs there report a (correct) containment
# violation. This probe detects that environment so the gate can SKIP those
# proofs with a visible UNSUPPORTED reason instead of reporting a false failure
# — and, crucially, never reports skipped containment as passed.
#
# On non-Linux hosts cgroup attach is a documented no-op, so the proofs can run.
containment_unsupported_reason() {
  if [[ "$(uname -s)" == "Linux" ]]; then
    echo "cannot create a cgroup under /sys/fs/cgroup — no cgroup-v2 delegation (typical of GitHub-hosted runners)"
  else
    echo "non-Linux host (cgroup attach is a documented no-op)"
  fi
}

containment_capable() {
  # Explicit override to exercise the Tier A skip path in testing.
  [[ "${IGRIS_FORCE_CONTAINMENT_UNSUPPORTED:-}" == "1" ]] && return 1
  # Non-Linux: supervisor cgroup attach is a no-op; agent proofs run fine.
  [[ "$(uname -s)" != "Linux" ]] && return 0
  # Linux: only claim capable if a cgroup can actually be created (cgroup v2, then v1 cpu).
  local probe="igris_containment_probe.$$"
  if mkdir "/sys/fs/cgroup/$probe" 2>/dev/null; then
    rmdir "/sys/fs/cgroup/$probe" 2>/dev/null || true
    return 0
  fi
  if mkdir "/sys/fs/cgroup/cpu/$probe" 2>/dev/null; then
    rmdir "/sys/fs/cgroup/cpu/$probe" 2>/dev/null || true
    return 0
  fi
  return 1
}

# Run the containment-dependent core proof suite, or honestly skip it as
# UNSUPPORTED when this runner cannot enforce containment. Tier B sets
# IGRIS_REQUIRE_CONTAINMENT=1 so an incapable runner FAILS RED rather than
# silently skipping (a Tier B runner that cannot contain is a real defect).
run_core_proof_suite_containment_aware() {
  if containment_capable; then
    echo "[heavy] containment enforcement available — running core proof suite (agent-inference execution proofs)"
    "$SCRIPT_DIR/proof_suite.sh"
    return
  fi

  local reason
  reason="$(containment_unsupported_reason)"

  if [[ "${IGRIS_REQUIRE_CONTAINMENT:-}" == "1" ]]; then
    echo "ERROR: IGRIS_REQUIRE_CONTAINMENT=1 but containment is unavailable ($reason)." >&2
    echo "This runner is designated containment-capable (Tier B) yet cannot create a cgroup — failing red." >&2
    exit 1
  fi

  echo "::warning title=Containment execution proofs UNSUPPORTED on this runner::cgroup containment cannot be established ($reason). The core proof suite (agent-inference execution under the containment supervisor) was NOT exercised and is NOT marked passed. Prove it on a containment-capable runner (Tier B)."
  echo "[heavy] CONTAINMENT-DEPENDENT PROOFS: UNSUPPORTED / SKIPPED on this runner ($reason)."
  echo "[heavy] These are NOT passed here — they are proven on a containment-capable Tier B runner."
  {
    echo "### ⚠️ Containment execution proofs: UNSUPPORTED on this runner"
    echo ""
    echo "cgroup containment could not be established: _${reason}_."
    echo ""
    echo "The core proof suite (\`proof_suite.sh\`) was **skipped — not passed**. The"
    echo "containment guarantee is proven on a containment-capable runner (Tier B)."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}" 2>/dev/null || true
}

run_heavy_gate() {
  # The Action Task recovery proofs submit an action_task whose http_call steps
  # carry `headers` — a sensitive input key. At submit, Overture encrypts
  # sensitive inputs with the execution input-ref keyring; with no key configured
  # the submit fails closed (ErrExecutionInputProtectionUnavailable) and
  # /v1/tasks/submit returns 503. Dev machines set this in .env; clean CI runners
  # do not. Provision an ephemeral throwaway 32-byte AES key (base64) so the proof
  # exercises the REAL encryption path — proof/test keying only, never production.
  # Exported here (AFTER run_fast_gate) so the demo scripts and the Overture they
  # start via bare `env` inherit it, without disturbing the coordinator go tests,
  # which manage their own keyring env. Respect an operator-supplied key if set.
  if [[ -z "${IGRIS_EXECUTION_INPUT_REF_KEYS:-}" && -z "${IGRIS_EXECUTION_INPUT_REF_KEY:-}" ]]; then
    export IGRIS_EXECUTION_INPUT_REF_KEYS="v1:$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')"
    export IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION="v1"
    echo "[heavy] generated ephemeral test execution input-ref keyring (version v1)"
  fi

  echo "[heavy] Running cumulative clean-host recovery proof"
  "$SCRIPT_DIR/action_task_v1_cumulative_clean_host_recovery_proof_demo.sh"

  echo "[heavy] Running existing Action Task V1 clean-host recovery proof"
  "$SCRIPT_DIR/action_task_v1_clean_host_recovery_proof_demo.sh"

  echo "[heavy] Running existing Action Task V1 same-host recovery proof"
  "$SCRIPT_DIR/action_task_v1_recovery_proof_demo.sh"

  echo "[heavy] Running existing Action Task V1 proof"
  "$SCRIPT_DIR/action_task_v1_proof_demo.sh"

  echo "[heavy] Running Clock 3B contract-bound durable Action proof"
  "$SCRIPT_DIR/clock_3b_contract_bound_durable_action_proof.sh"

  echo "[heavy] Running core proof suite"
  run_core_proof_suite_containment_aware
}

require_cmd psql
require_cmd go

apply_required_overture_migrations
preflight_durable_task_schema
run_fast_gate

if [[ "$TIER" == "heavy" ]]; then
  require_cmd node
  require_cmd cargo
  require_cmd curl
  require_cmd lsof
  run_heavy_gate
fi

echo "CI proof gate ($TIER) passed."
