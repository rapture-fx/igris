#!/usr/bin/env bash
# Local mirror of the private-alpha PR pipeline (.github/workflows/private-alpha-ci.yml).
#
# Usage: private_alpha_ci.sh [stage ...]
#   stages: migrations python go postgres artifacts harness all (default: all)
#
# Notes:
#   - `postgres` creates a DISPOSABLE database on the local PostgreSQL server
#     (or the server named by PA_CI_PG_HOST/PA_CI_PG_PORT/PA_CI_PG_USER) and
#     drops it afterwards. It never touches shared, staging, or production
#     databases, and it never prints connection strings.
#   - `python` runs the full SDK suite once per interpreter in
#     PA_CI_PY_VERSIONS (default: 3.10 3.11 3.12 3.13), explicitly overriding
#     sdk/python/.python-version, and asserts the active interpreter version.
#   - No stage publishes packages, pushes, deploys, or applies migrations
#     outside its disposable test database.
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"

PY_VERSIONS=${PA_CI_PY_VERSIONS:-"3.10 3.11 3.12 3.13"}

banner() { printf '\n=== private-alpha-ci: %s ===\n' "$1"; }

# go test -run with a regex that matches nothing exits 0; treat that as a
# failure so renamed tests cannot silently hollow out a stage.
go_test_matching() {
  local pkg="$1" regex="$2"; shift 2
  local out
  out=$(go test "$pkg" -run "$regex" -count=1 "$@" 2>&1) || { echo "$out"; return 1; }
  echo "$out"
  if echo "$out" | grep -q "no tests to run"; then
    echo "FAIL: regex '$regex' matched no tests in $pkg"
    return 1
  fi
}

stage_migrations() {
  banner "migration guard (067/068/069 manual-only)"
  "$ROOT/scripts/ci/check_manual_migrations.sh"
}

stage_python() {
  banner "python matrix ($PY_VERSIONS)"
  local envroot
  envroot=$(mktemp -d "${TMPDIR:-/tmp}/igris-pa-ci-py-XXXXXX")
  for v in $PY_VERSIONS; do
    echo "--- CPython $v"
    (
      cd sdk/python
      export UV_PROJECT_ENVIRONMENT="$envroot/venv-$v"
      # Explicitly overrides sdk/python/.python-version (pinned to 3.11).
      export UV_PYTHON="$v"
      uv sync --dev --quiet
      uv run --no-sync python -c "
import sys
expected = tuple(int(p) for p in '$v'.split('.'))
assert sys.version_info[:2] == expected, f'expected {expected}, running {sys.version}'
print('interpreter OK:', sys.version.split()[0])
"
      uv run --no-sync pytest -q
      uv run --no-sync ruff check .
      uv run --no-sync ruff format --check .
    )
  done
  rm -rf "$envroot"
}

stage_go() {
  banner "go build + focused vet + release-critical suites (Postgres tests skip without DSN)"
  go build ./...
  go vet ./igris-overture/api ./igris-overture/coordinator \
    ./igris-overture/internal/canonicaljson ./conformance/contractv1 \
    ./cmd/igris-overture
  go test ./conformance/contractv1 ./igris-overture/internal/canonicaljson -count=1 -timeout=120s
  go test ./igris-overture/api -count=1 -timeout=900s
  go test ./igris-overture/coordinator -count=1 -timeout=600s
}

stage_postgres() {
  banner "disposable-Postgres contract + evidence suites"
  command -v createdb >/dev/null || { echo "FAIL: createdb (PostgreSQL client) is required"; exit 1; }
  local host="${PA_CI_PG_HOST:-localhost}" port="${PA_CI_PG_PORT:-5432}" user="${PA_CI_PG_USER:-$USER}"
  local db="igris_pa_ci_$$_$RANDOM"
  createdb -h "$host" -p "$port" -U "$user" "$db"
  echo "created disposable database (dropped on exit)"
  # shellcheck disable=SC2064
  trap "dropdb -h '$host' -p '$port' -U '$user' --if-exists '$db' >/dev/null 2>&1 || true" EXIT
  export IGRIS_OVERTURE_POSTGRES_TEST_DSN="postgres://$user@$host:$port/$db?sslmode=disable"

  go_test_matching ./igris-overture/api \
    'TestContractSyncPostgres.*|TestEvidenceIngestPostgres.*|TestConnectedImmutableRecordsPostgres' \
    -timeout=600s
  go_test_matching ./igris-overture/api \
    'TestContractSyncEndToEndPythonSDK|TestEvidenceIngestionEndToEndPythonSDK|TestPrivateAlphaCrossSliceEndToEnd|TestContractSyncRedirectsAreNeverFollowedEndToEnd' \
    -timeout=900s

  dropdb -h "$host" -p "$port" -U "$user" --if-exists "$db"
  trap - EXIT
  echo "disposable database dropped"
}

stage_artifacts() {
  banner "artifact reproducibility (double build + clean installs + manifest)"
  "$ROOT/scripts/ci/sdk_artifact_check.sh"
}

stage_harness() {
  banner "Embedded private-alpha harness"
  "$ROOT/scripts/ci/run_alpha_harness.sh"
}

stages=("$@")
[[ ${#stages[@]} -eq 0 ]] && stages=(all)

for stage in "${stages[@]}"; do
  case "$stage" in
    migrations) stage_migrations ;;
    python)     stage_python ;;
    go)         stage_go ;;
    postgres)   stage_postgres ;;
    artifacts)  stage_artifacts ;;
    harness)    stage_harness ;;
    all)
      stage_migrations
      stage_python
      stage_go
      stage_postgres
      stage_artifacts
      stage_harness
      ;;
    *) echo "unknown stage: $stage (expected migrations|python|go|postgres|artifacts|harness|all)"; exit 2 ;;
  esac
done

banner "done"
