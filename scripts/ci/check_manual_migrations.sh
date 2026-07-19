#!/usr/bin/env bash
# CI guard: the private-alpha Connected / Clock 3B migrations
# (067, 068, 069, 070) are
# manual-runbook-only. This guard fails if:
#   1. any of the three migration files loses its explicit manual-only wording,
#   2. a workflow, application source file, or operational script starts
#      referencing these migrations (the first step toward auto-applying them),
#   3. non-test Go code gains a reference to the migrations directory
#      (application startup must never apply migrations).
#
# The guard reads files only. It never touches a database and never modifies
# the migrations.
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"

MIGRATIONS=(
  067_action_contract_versions.sql
  068_sdk_evidence_ingestion.sql
  069_connected_immutable_records.sql
  070_contract_execution_bindings.sql
)

fail=0

for name in "${MIGRATIONS[@]}"; do
  file="igris-overture/database/migrations/$name"
  if [[ ! -f "$file" ]]; then
    echo "FAIL: $file is missing"
    fail=1
    continue
  fi
  if ! grep -qi "manual migration runbook" "$file"; then
    echo "FAIL: $file no longer states it belongs to the manual migration runbook"
    fail=1
  fi
  if ! grep -qi "NOT applied" "$file"; then
    echo "FAIL: $file no longer states it is NOT applied automatically"
    fail=1
  fi
done

# References to the private-alpha migrations are allowed only in:
#   - the migration files themselves,
#   - Go test files (they apply the DDL inside disposable test schemas),
#   - documentation,
#   - this guard.
pattern='067_action_contract_versions|068_sdk_evidence_ingestion|069_connected_immutable_records|070_contract_execution_bindings'
offenders=$(grep -rlE "$pattern" \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=docs \
  --exclude-dir=migrations \
  .github cmd igris-overture scripts Makefile 2>/dev/null \
  | grep -v '_test\.go$' \
  | grep -v '^scripts/ci/check_manual_migrations\.sh$' \
  || true)
if [[ -n "$offenders" ]]; then
  echo "FAIL: private-alpha migrations are referenced outside tests/docs/migrations:"
  echo "$offenders"
  echo "These migrations are manual-runbook-only and must never be wired into"
  echo "workflows, startup paths, or operational scripts."
  fail=1
fi

# Application startup must not apply migrations: no non-test Go source may
# read the migrations directory.
go_offenders=$(grep -rl "database/migrations" cmd igris-overture --include='*.go' 2>/dev/null \
  | grep -v '_test\.go$' || true)
if [[ -n "$go_offenders" ]]; then
  echo "FAIL: non-test Go code references the migrations directory:"
  echo "$go_offenders"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "migration guard: FAIL"
  exit 1
fi

echo "migration guard: OK (067/068/069/070 remain manual-runbook-only)"
