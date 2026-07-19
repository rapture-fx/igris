#!/usr/bin/env bash

# Clock 3B — Contract-Bound Durable Igris Action Proof
#
# Applies the explicit manual Connected/Clock 3B migrations required for this
# disposable proof database, then runs the clean-host recovery demo in
# CLOCK3B_CONTRACT_BOUND_MODE. Application startup never applies these
# migrations; this script is the operator/CI runbook entrypoint.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
MIGRATIONS_DIR="$ROOT_DIR/igris-overture/database/migrations"

if [[ -z "${DATABASE_URL:-}" && -z "${POSTGRES_URL:-}" && -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env" >/dev/null 2>&1 || true
  set +a
fi
DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "DATABASE_URL or POSTGRES_URL is required for the Clock 3B proof" >&2
  exit 1
fi

psql "$DB_URL" -X -q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

# Same durable-action prerequisites as scripts/ci_proof_gate.sh, plus the
# Clock 3B Connected binding migrations. IF NOT EXISTS keeps this safe on
# already-provisioned proof databases.
required_migrations=(
  "051_execution_governance_recovery"
  "052_runtime_callback_envelopes"
  "054_action_definitions"
  "055_action_execution_targets"
  "056_execution_input_refs"
  "057_task_records_tenant_scoped_idempotency"
  "062_task_records_registered_agent"
  "067_action_contract_versions"
  "068_sdk_evidence_ingestion"
  "069_connected_immutable_records"
  "070_contract_execution_bindings"
  "071_run_scoped_evidence_link_exclusivity"
)

for migration_name in "${required_migrations[@]}"; do
  migration_file="$MIGRATIONS_DIR/$migration_name.sql"
  if [[ ! -f "$migration_file" ]]; then
    echo "required migration missing: $migration_file" >&2
    exit 1
  fi
  applied=$(psql "$DB_URL" -X -tAqc "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '$migration_name');")
  if [[ "$applied" == "t" ]]; then
    echo "[clock3b] $migration_name already applied"
    continue
  fi
  echo "[clock3b] applying $migration_name"
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q -f "$migration_file"
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name') ON CONFLICT (migration_name) DO NOTHING;"
done

for relation in action_definitions action_contract_versions action_contract_execution_bindings contract_bound_action_runs; do
  found=$(psql "$DB_URL" -X -tAqc "SELECT to_regclass('public.$relation');")
  if [[ "$found" != "$relation" ]]; then
    echo "required Clock 3B relation missing after migrations: $relation" >&2
    exit 1
  fi
done

# Bound HTTP adapter auth headers are protected as encrypted input refs.
# Generate an ephemeral proof keyring unless the operator already supplied one.
if [[ -z "${IGRIS_EXECUTION_INPUT_REF_KEYS:-}" && -z "${IGRIS_EXECUTION_INPUT_REF_KEY:-}" ]]; then
  export IGRIS_EXECUTION_INPUT_REF_KEYS="v1:$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')"
  export IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION="v1"
  echo "[clock3b] generated ephemeral execution input-ref keyring (version v1)"
fi

CLOCK3B_CONTRACT_BOUND_MODE=true \
ACTION_TASK_CLEAN_HOST_RECOVERY=true \
ACTION_TASK_CUMULATIVE_CLEAN_HOST_RECOVERY=false \
  "$SCRIPT_DIR/action_task_v1_recovery_proof_demo.sh"
