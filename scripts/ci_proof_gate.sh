#!/bin/zsh

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
setopt TYPESET_SILENT

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
    "006_execution_lineage"
    "031_task_records"
    "032_task_record_artifacts"
    "033_task_proof_state"
    "034_task_cancellation"
    "035_task_failure_details"
    "043_ai_capability_governance_audit"
    "047_execution_context"
    "048_verified_execution_schema_repair"
    "049_task_proof_verification_summary"
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
  go test ./igris-overture/api ./igris-overture/coordinator ./cmd/igris-overture/handlers ./igris-overture/internal -count=1 -timeout=180s
}

run_heavy_gate() {
  echo "[heavy] Running cumulative clean-host recovery proof"
  "$SCRIPT_DIR/action_task_v1_cumulative_clean_host_recovery_proof_demo.sh"

  echo "[heavy] Running existing Action Task V1 clean-host recovery proof"
  "$SCRIPT_DIR/action_task_v1_clean_host_recovery_proof_demo.sh"

  echo "[heavy] Running existing Action Task V1 same-host recovery proof"
  "$SCRIPT_DIR/action_task_v1_recovery_proof_demo.sh"

  echo "[heavy] Running existing Action Task V1 proof"
  "$SCRIPT_DIR/action_task_v1_proof_demo.sh"

  echo "[heavy] Running core proof suite"
  "$SCRIPT_DIR/proof_suite.sh"
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
