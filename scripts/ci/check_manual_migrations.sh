#!/usr/bin/env bash
# CI guard: Connected migrations are explicit operator operations. Dedicated
# bootstrap code may consume immutable migration assets; application runtime
# code must not import, link, discover, or execute them.
#
# The guard reads files and Go dependency metadata only. It never touches a
# database and never modifies migrations.
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"

MIGRATIONS=(
  067_action_contract_versions.sql
  068_sdk_evidence_ingestion.sql
  069_connected_immutable_records.sql
)

EXPECTED_SHA256=(
  c5eea0ec499c758d13ea67310290634b54671a53ffb71e31ac76b0cc7a13a5f9
  87b2401eacb7440d35efa28d10c4d848b7274bb06dcba74514a0b4fd3c424e48
  5c0b57dacd7cba2cdf8bc12fec2b3a9a4a066a73b6bb82fba8af29202452fc4d
)

fail=0

for i in "${!MIGRATIONS[@]}"; do
  name="${MIGRATIONS[$i]}"
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
  actual=$(shasum -a 256 "$file" | awk '{print $1}')
  if [[ "$actual" != "${EXPECTED_SHA256[$i]}" ]]; then
    echo "FAIL: $file changed: got sha256=$actual want sha256=${EXPECTED_SHA256[$i]}"
    fail=1
  fi
done

# Exact migration names are allowed in the executor and read-only schema-state
# metadata. They remain allowed in tests, docs, immutable SQL, and this guard.
pattern='067_action_contract_versions|068_sdk_evidence_ingestion|069_connected_immutable_records'
offenders=$(grep -rlE "$pattern" \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=docs \
  --exclude-dir=migrations \
  .github cmd igris-overture scripts Makefile 2>/dev/null \
  | grep -v '_test\.go$' \
  | grep -v '^scripts/ci/check_manual_migrations\.sh$' \
  | grep -v '^igris-overture/database/bootstrap/bootstrap\.go$' \
  | grep -v '^igris-overture/database/schemastate/state\.go$' \
  || true)
if [[ -n "$offenders" ]]; then
  echo "FAIL: Connected migrations are referenced outside the approved operator/read-only boundary:"
  echo "$offenders"
  fail=1
fi

# Only the dedicated executor may import immutable migration assets.
asset_importers=$(grep -rl 'Igris-inertial/system/igris-overture/database/migrations' cmd igris-overture \
  --include='*.go' 2>/dev/null | grep -v '_test\.go$' \
  | grep -v '^igris-overture/database/bootstrap/bootstrap\.go$' || true)
if [[ -n "$asset_importers" ]]; then
  echo "FAIL: production code outside the bootstrap executor imports migration assets:"
  echo "$asset_importers"
  fail=1
fi

# Only the explicit operator command may import the executor in production.
executor_importers=$(grep -rl 'Igris-inertial/system/igris-overture/database/bootstrap' cmd igris-overture \
  --include='*.go' 2>/dev/null | grep -v '_test\.go$' \
  | grep -v '^cmd/igris-db-bootstrap/main\.go$' || true)
if [[ -n "$executor_importers" ]]; then
  echo "FAIL: production code outside igris-db-bootstrap imports the migration executor:"
  echo "$executor_importers"
  fail=1
fi

# Runtime packages must not link the executor or migration assets through a
# transitive dependency.
for pkg in ./cmd/igris-overture ./igris-overture/api ./igris-overture/coordinator ./igris-overture/database; do
  deps=$(go list -deps "$pkg")
  forbidden=$(printf '%s\n' "$deps" | grep -E '/database/(bootstrap|migrations)$' || true)
  if [[ -n "$forbidden" ]]; then
    echo "FAIL: runtime package $pkg links forbidden migration code:"
    echo "$forbidden"
    fail=1
  fi
done

# Runtime/request/SDK source must not invoke operator migration symbols even if
# a future refactor obscures an import from the simple checks above.
runtime_invocations=$(grep -rlE 'NewOperatorRunner|ModeApply|ModeAdoptV066|migrations\.Files|igris-db-bootstrap' \
  cmd/igris-overture igris-overture/api igris-overture/coordinator sdk \
  --include='*.go' --include='*.py' 2>/dev/null | grep -v '_test\.go$' || true)
if [[ -n "$runtime_invocations" ]]; then
  echo "FAIL: runtime/request/SDK source references migration execution:"
  echo "$runtime_invocations"
  fail=1
fi

# The operator CLI must not fall back to generic runtime connection variables.
cli_fallbacks=$(grep -E 'DATABASE_URL_DIRECT|"DATABASE_URL"|POSTGRES_URL|DATABASE_URL_RUNTIME' \
  cmd/igris-db-bootstrap/main.go || true)
if [[ -n "$cli_fallbacks" ]]; then
  echo "FAIL: igris-db-bootstrap contains a runtime/generic DSN fallback"
  echo "$cli_fallbacks"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "migration guard: FAIL"
  exit 1
fi

echo "migration guard: OK (operator-only assets; runtime dependency graph migration-free)"
