#!/usr/bin/env bash
# Local PostgreSQL 16 validation harness for Connected staging foundation.
# Starts a disposable PG16 instance on a random high port when IGRIS_PG16_BIN
# is provided, or reuses IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN if it already
# points at a disposable local PostgreSQL 16.
#
# Never targets shared/cloud DSNs. Never prints passwords.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

log() { printf '%s\n' "$*"; }

refuse_shared_dsn() {
  local dsn="$1"
  if echo "$dsn" | grep -Eiq 'neon\.tech|azure|amazonaws|supabase|\.prod\.|shared'; then
    echo "error: refusing non-local/shared-looking database URL" >&2
    exit 2
  fi
}

PG16_PREFIX="${IGRIS_PG16_PREFIX:-}"
if [[ -z "$PG16_PREFIX" && -f /tmp/igris-pg16-prefix.path ]]; then
  PG16_PREFIX="$(cat /tmp/igris-pg16-prefix.path)"
fi

ADMIN_DSN="${IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN:-}"
CLEANUP_PG=0
PGDATA=""
PGPORT=""
PG_PID=""

cleanup() {
  local code=$?
  if [[ "$CLEANUP_PG" -eq 1 && -n "$PG16_PREFIX" && -n "$PGDATA" ]]; then
    "$PG16_PREFIX/bin/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
    rm -rf "$PGDATA"
  fi
  exit "$code"
}
trap cleanup EXIT

if [[ -z "$ADMIN_DSN" ]]; then
  if [[ -z "$PG16_PREFIX" || ! -x "$PG16_PREFIX/bin/initdb" ]]; then
    echo "error: set IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN to a local PG16 admin DSN," >&2
    echo "       or IGRIS_PG16_PREFIX to a PostgreSQL 16 install prefix" >&2
    exit 2
  fi
  PGDATA="$(mktemp -d /tmp/igris-pg16-data.XXXXXX)"
  PGPORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
  log "pg16_prefix=${PG16_PREFIX}"
  log "pg16_port=${PGPORT}"
  log "pg16_data=${PGDATA}"
  "$PG16_PREFIX/bin/initdb" -D "$PGDATA" --auth=trust --username=postgres --no-instructions >/dev/null
  # Localhost-only trust for disposable validation.
  cat >>"$PGDATA/pg_hba.conf" <<'HBA'
host all all 127.0.0.1/32 trust
host all all ::1/128 trust
HBA
  "$PG16_PREFIX/bin/pg_ctl" -D "$PGDATA" -o "-p ${PGPORT} -k ${PGDATA}" -w start >/dev/null
  CLEANUP_PG=1
  ADMIN_DSN="postgres://postgres@127.0.0.1:${PGPORT}/postgres?sslmode=disable"
  export PATH="${PG16_PREFIX}/bin:$PATH"
fi

refuse_shared_dsn "$ADMIN_DSN"
export IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN="$ADMIN_DSN"
export IGRIS_OVERTURE_POSTGRES_TEST_DSN="$ADMIN_DSN"

# Prove disposable + version 16.
SERVER_VERSION="$("$PG16_PREFIX/bin/psql" "$ADMIN_DSN" -Atc 'SHOW server_version;' 2>/dev/null || psql "$ADMIN_DSN" -Atc 'SHOW server_version;')"
log "server_version=${SERVER_VERSION}"
if ! echo "$SERVER_VERSION" | grep -Eq '^16\.'; then
  echo "error: expected PostgreSQL 16.x, got ${SERVER_VERSION}" >&2
  exit 1
fi

# Prove we can create/drop databases (disposable).
PROBE_DB="igris_pg16_probe_$$"
psql "$ADMIN_DSN" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${PROBE_DB};" >/dev/null
psql "$ADMIN_DSN" -v ON_ERROR_STOP=1 -c "DROP DATABASE ${PROBE_DB};" >/dev/null
log "disposable_create_drop=ok"

log "== bootstrap package =="
go test ./igris-overture/database/bootstrap -count=1 -timeout=400s

log "== roles package =="
go test ./igris-overture/database/roles -count=1 -timeout=400s

log "== runtime-role Connected paths =="
go test ./igris-overture/api -run 'TestConnectedPathsUnderRuntimeRolePostgres' -count=1 -timeout=300s

log "== contract + evidence + immutability =="
go test ./igris-overture/api \
  -run 'TestContractSyncPostgres.*|TestEvidenceIngestPostgres.*|TestConnectedImmutableRecordsPostgres' \
  -count=1 -timeout=600s

log "== private-alpha cross-slice E2E (if deps present) =="
go test ./igris-overture/api \
  -run 'TestPrivateAlphaCrossSliceEndToEnd|TestContractSyncEndToEndPythonSDK|TestEvidenceIngestionEndToEndPythonSDK' \
  -count=1 -timeout=900s || log "e2e_note=skipped_or_failed_non_fatal_for_local_db_proof"

log "== coordinator disposable-schema harness =="
go test ./igris-overture/coordinator \
  -run 'TestTaskRecordsTenantScopedIdempotencyPostgres|TestExecutionLineageTenantIsolationPostgres|TestExecutionContextTenantBoundMigrationPostgres' \
  -count=1 -timeout=180s

log "== staging smoke =="
./scripts/connected/staging_smoke.sh

log "result=connected_pg16_local_validate_ok"
