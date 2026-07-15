#!/usr/bin/env bash
# Security-critical local PostgreSQL 16 validation harness for Connected staging.
#
# The helper always creates its own socket-only cluster from an explicitly
# selected and verified IGRIS_PG16_PREFIX. Externally supplied admin DSNs are
# refused because they cannot prove that destructive database/role operations
# are scoped to a cluster created by this run.
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

log() { printf '%s\n' "$*"; }
error() { printf 'error: %s\n' "$*" >&2; }

RUN_STATE_DIR=""
STATE_FILE=""
PGDATA=""
SOCKET_DIR=""
PGPORT=""
POSTMASTER_PID=""
CLUSTER_MAY_BE_RUNNING=0
CLEANUP_COMPLETE=0
PG16_PREFIX=""
INITDB_BIN=""
PG_CTL_BIN=""
POSTGRES_BIN=""
PSQL_BIN=""

test_hook_status() {
  local stage="$1"
  if [[ "${IGRIS_PG16_ENABLE_TEST_HOOKS:-0}" != "1" ]]; then
    return 0
  fi
  case "${IGRIS_PG16_TEST_FAIL_STAGE:-}:$stage" in
    bootstrap:bootstrap) printf '41' ;;
    roles:roles) printf '42' ;;
    runtime:runtime) printf '43' ;;
    contract:contract) printf '44' ;;
    e2e:e2e) printf '45' ;;
    coordinator:coordinator) printf '46' ;;
    preflight:preflight) printf '47' ;;
    smoke:smoke) printf '49' ;;
    *) return 0 ;;
  esac
}

run_stage() {
  local stage="$1"
  shift
  local injected
  if [[ "${IGRIS_PG16_ENABLE_TEST_HOOKS:-0}" == "1" && "${IGRIS_PG16_TEST_PAUSE_STAGE:-}" == "$stage" ]]; then
    log "test-only pause stage=${stage}"
    # Stay in the shell process so signal tests exercise this helper's traps
    # without having to signal an unrelated child process.
    while :; do
      read -r -t 1 _unused || true
    done
  fi
  injected="$(test_hook_status "$stage")"
  if [[ -n "$injected" ]]; then
    error "test-only failure injection stage=${stage} status=${injected}"
    return "$injected"
  fi
  if [[ "${IGRIS_PG16_ENABLE_TEST_HOOKS:-0}" == "1" && "${IGRIS_PG16_TEST_SKIP_NON_TARGET_STAGES:-0}" == "1" ]]; then
    if [[ "$stage" != "smoke" || ! "${IGRIS_PG16_TEST_FAIL_STAGE:-}" =~ ^(identity|preflight)$ ]]; then
      log "test-only skipped stage=${stage}"
      return 0
    fi
  fi
  "$@"
}

validate_prefix() {
  local requested="$1"
  python3 - "$requested" <<'PY'
import os
import stat
import sys

requested = sys.argv[1]
if not requested:
    raise SystemExit("IGRIS_PG16_PREFIX is required")
if ".." in requested.split(os.sep):
    raise SystemExit("PostgreSQL prefix must not contain path traversal")
try:
    prefix_stat = os.lstat(requested)
except OSError as exc:
    raise SystemExit(f"cannot inspect PostgreSQL prefix: {exc.strerror}") from None
if stat.S_ISLNK(prefix_stat.st_mode) or not stat.S_ISDIR(prefix_stat.st_mode):
    raise SystemExit("PostgreSQL prefix must be a non-symlink directory")
prefix = os.path.realpath(requested)
allowed_owners = {0, os.getuid()}
candidate = os.path.join(prefix, "bin")
while True:
    info = os.stat(candidate)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid not in allowed_owners:
        raise SystemExit("PostgreSQL prefix has an untrusted directory")
    if info.st_mode & 0o022 and not (
        info.st_uid == 0 and info.st_mode & stat.S_ISVTX
    ):
        raise SystemExit("PostgreSQL prefix has a writable directory")
    parent = os.path.dirname(candidate)
    if parent == candidate:
        break
    candidate = parent
for name in ("initdb", "pg_ctl", "postgres", "psql"):
    path = os.path.join(prefix, "bin", name)
    try:
        info = os.lstat(path)
    except OSError as exc:
        raise SystemExit(f"cannot inspect {name}: {exc.strerror}") from None
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise SystemExit(f"{name} must be a non-symlink regular file")
    if not os.access(path, os.X_OK):
        raise SystemExit(f"{name} is not executable")
    if info.st_uid not in allowed_owners:
        raise SystemExit(f"{name} has an untrusted owner")
    if info.st_mode & 0o022:
        raise SystemExit(f"{name} is group/world writable")
    if os.path.commonpath((prefix, os.path.realpath(path))) != prefix:
        raise SystemExit(f"{name} resolves outside the selected prefix")
print(prefix)
PY
}

validate_tmp_root() {
  python3 - "${1}" <<'PY'
import os
import stat
import sys

root = os.path.realpath(sys.argv[1])
info = os.stat(root)
if not stat.S_ISDIR(info.st_mode) or info.st_uid not in (0, os.getuid()):
    raise SystemExit("temporary root is not a trusted directory")
if info.st_mode & 0o022 and not (info.st_uid == 0 and info.st_mode & stat.S_ISVTX):
    raise SystemExit("temporary root is writable without root-owned sticky protection")
print(root)
PY
}

validate_private_state() {
  python3 - "$RUN_STATE_DIR" "$STATE_FILE" <<'PY'
import os
import stat
import sys

directory, state_file = sys.argv[1:]
ds = os.lstat(directory)
fs = os.lstat(state_file)
if not stat.S_ISDIR(ds.st_mode) or stat.S_ISLNK(ds.st_mode):
    raise SystemExit("run state directory is not a private directory")
if stat.S_IMODE(ds.st_mode) != 0o700 or ds.st_uid != os.getuid():
    raise SystemExit("run state directory ownership or mode is unsafe")
if not stat.S_ISREG(fs.st_mode) or stat.S_ISLNK(fs.st_mode):
    raise SystemExit("run state file is not a regular file")
if stat.S_IMODE(fs.st_mode) != 0o600 or fs.st_uid != os.getuid() or fs.st_nlink != 1:
    raise SystemExit("run state file ownership, mode, or link count is unsafe")
PY
}

pid_is_alive() {
  local pid="$1"
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

cleanup_resources() {
  if [[ "$CLEANUP_COMPLETE" -eq 1 ]]; then
    return 0
  fi

  local cleanup_failed=0
  if [[ "$CLUSTER_MAY_BE_RUNNING" -eq 1 ]]; then
    if [[ "${IGRIS_PG16_ENABLE_TEST_HOOKS:-0}" == "1" && \
      ( "${IGRIS_PG16_TEST_FAIL_STAGE:-}" == "cleanup" || "${IGRIS_PG16_TEST_FAIL_CLEANUP:-0}" == "1" ) ]]; then
      error "test-only cleanup failure injection status=77"
      cleanup_failed=77
    elif ! "$PG_CTL_BIN" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1; then
      error "PostgreSQL stop failed"
      cleanup_failed=70
    fi

    if [[ "$cleanup_failed" -eq 0 ]] && pid_is_alive "$POSTMASTER_PID"; then
      error "PostgreSQL process ${POSTMASTER_PID} is still alive after stop"
      cleanup_failed=71
    fi

    if [[ "$cleanup_failed" -ne 0 ]]; then
      error "cleanup incomplete; retained_state_dir=${RUN_STATE_DIR}"
      return "$cleanup_failed"
    fi
  fi

  if [[ -n "$RUN_STATE_DIR" && -d "$RUN_STATE_DIR" ]]; then
    if ! rm -rf -- "$RUN_STATE_DIR"; then
      error "failed to remove private run state: ${RUN_STATE_DIR}"
      return 74
    fi
  fi
  CLEANUP_COMPLETE=1
  CLUSTER_MAY_BE_RUNNING=0
  return 0
}

on_exit() {
  local primary_status=$?
  trap - EXIT ERR INT TERM
  set +e
  cleanup_resources
  local cleanup_status=$?
  if [[ "$cleanup_status" -ne 0 ]]; then
    error "primary_status=${primary_status} cleanup_status=${cleanup_status}"
    if [[ "$primary_status" -ne 0 ]]; then
      exit "$primary_status"
    fi
    exit "$cleanup_status"
  fi
  exit "$primary_status"
}

on_error() {
  local status=$?
  local line="$1"
  error "validation stage failed at line=${line} status=${status}"
  return "$status"
}

trap on_exit EXIT
trap 'on_error "$LINENO"' ERR
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -n "${IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN:-}" || -n "${DATABASE_URL_MIGRATION:-}" ]]; then
  error "external admin DSN mode is non-destructive only and is not supported by this release helper"
  exit 2
fi

# The helper passes every connection target explicitly. Inherited libpq state
# must not add a service, host, credential, TLS, session, or query override.
unset DATABASE_URL DATABASE_URL_DIRECT DATABASE_URL_RUNTIME DATABASE_URL_MIGRATION POSTGRES_URL POSTGRES_TEST_DSN
unset PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGPASSWORD PGPASSFILE
unset PGSERVICE PGSERVICEFILE PGOPTIONS PGAPPNAME PGCONNECT_TIMEOUT PGCLIENTENCODING
unset PGSSLMODE PGREQUIRESSL PGSSLCERT PGSSLKEY PGSSLROOTCERT PGSSLCRL PGSSLCRLDIR
unset PGTARGETSESSIONATTRS PGCHANNELBINDING

PG16_PREFIX="$(validate_prefix "${IGRIS_PG16_PREFIX:-}")"
INITDB_BIN="$PG16_PREFIX/bin/initdb"
PG_CTL_BIN="$PG16_PREFIX/bin/pg_ctl"
POSTGRES_BIN="$PG16_PREFIX/bin/postgres"
PSQL_BIN="$PG16_PREFIX/bin/psql"

SERVER_BINARY_VERSION="$("$POSTGRES_BIN" --version)"
if [[ ! "$SERVER_BINARY_VERSION" =~ ^postgres\ \(PostgreSQL\)\ 16\. ]]; then
  error "selected prefix is not PostgreSQL 16"
  exit 2
fi
if [[ "${IGRIS_PG16_ENABLE_TEST_HOOKS:-0}" == "1" && "${IGRIS_PG16_TEST_VALIDATE_PREFIX_ONLY:-0}" == "1" ]]; then
  log "result=pg16_prefix_validation_test_ok"
  exit 0
fi

TMP_ROOT="$(validate_tmp_root "${TMPDIR:-/tmp}")"
RUN_STATE_DIR="$(mktemp -d "${TMP_ROOT%/}/igris-pg16-run.XXXXXX")"
RUN_STATE_DIR="$(cd "$RUN_STATE_DIR" && pwd -P)"
chmod 700 "$RUN_STATE_DIR"
PGDATA="$RUN_STATE_DIR/data"
SOCKET_DIR="$RUN_STATE_DIR/socket"
mkdir -m 700 "$PGDATA" "$SOCKET_DIR"
PGPORT="$(python3 -c 'import secrets; print(20000 + secrets.randbelow(40000))')"
RUN_ID="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
RUN_SUFFIX="${RUN_ID:0:12}"
STATE_FILE="$RUN_STATE_DIR/resources.env"
if [[ "${IGRIS_PG16_ENABLE_TEST_HOOKS:-0}" == "1" ]]; then
  case "${IGRIS_PG16_TEST_STATE_ATTACK:-}" in
    symlink) ln -s "$RUN_STATE_DIR/attacker-target" "$STATE_FILE" ;;
    stale) printf 'stale\n' >"$STATE_FILE" ;;
  esac
fi
(
  set -o noclobber
  printf 'run_id=%s\npgdata=%s\nsocket_dir=%s\nport=%s\n' \
    "$RUN_ID" "$PGDATA" "$SOCKET_DIR" "$PGPORT" >"$STATE_FILE"
)
chmod 600 "$STATE_FILE"
validate_private_state

log "pg16_prefix=${PG16_PREFIX}"
log "pg16_port=${PGPORT}"
log "pg16_state_dir=${RUN_STATE_DIR}"
log "run_id=${RUN_ID}"

"$INITDB_BIN" -D "$PGDATA" --auth-local=trust --auth-host=reject \
  --locale=C --encoding=UTF8 --username=postgres --no-instructions >/dev/null
CLUSTER_MAY_BE_RUNNING=1
"$PG_CTL_BIN" -D "$PGDATA" \
  -o "-p ${PGPORT} -k ${SOCKET_DIR} -c listen_addresses=''" -w start >/dev/null

if [[ ! -f "$PGDATA/postmaster.pid" || -L "$PGDATA/postmaster.pid" ]]; then
  error "missing trustworthy postmaster.pid"
  exit 1
fi
POSTMASTER_PID="$(sed -n '1p' "$PGDATA/postmaster.pid")"
if ! pid_is_alive "$POSTMASTER_PID"; then
  error "created PostgreSQL process is not alive"
  exit 1
fi

SOCKET_QUERY="$(python3 - "$SOCKET_DIR" <<'PY'
from urllib.parse import quote
import sys
print(quote(sys.argv[1], safe=""))
PY
)"
ADMIN_DSN="postgresql://postgres@/postgres?host=${SOCKET_QUERY}&port=${PGPORT}&sslmode=disable"

IDENTITY_RESULT="$("$PSQL_BIN" "$ADMIN_DSN" -X -v ON_ERROR_STOP=1 -At \
  -v expected_data_dir="$PGDATA" -v expected_socket_dir="$SOCKET_DIR" -v expected_port="$PGPORT" <<'SQL'
SELECT CASE
  WHEN current_setting('data_directory') = :'expected_data_dir'
   AND current_setting('unix_socket_directories') = :'expected_socket_dir'
   AND current_setting('port') = :'expected_port'
   AND inet_server_addr() IS NULL
  THEN 'identity_ok' ELSE 'identity_mismatch' END;
SQL
)"
if [[ "$IDENTITY_RESULT" != "identity_ok" ]]; then
  error "created cluster identity verification failed"
  exit 1
fi

"$PSQL_BIN" "$ADMIN_DSN" -X -v ON_ERROR_STOP=1 \
  -v run_id="$RUN_ID" -v data_dir="$PGDATA" -v socket_dir="$SOCKET_DIR" -v port="$PGPORT" <<'SQL' >/dev/null
CREATE TABLE public.igris_local_validation_identity (
  run_id text PRIMARY KEY,
  data_directory text NOT NULL,
  socket_directory text NOT NULL,
  port integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.igris_local_validation_identity (run_id, data_directory, socket_directory, port)
VALUES (:'run_id', :'data_dir', :'socket_dir', :'port'::integer);
SQL

export PATH="$PG16_PREFIX/bin:$PATH"
export PGPORT
unset IGRIS_API_URL IGRIS_API_KEY IGRIS_HOME
unset IGRIS_DB_ROLE_MIGRATION_OWNER IGRIS_DB_ROLE_APP_RUNTIME
unset IGRIS_DB_ROLE_READ_ONLY_OPERATOR IGRIS_DB_ROLE_BACKUP_RESTORE
export IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN="$ADMIN_DSN"
export IGRIS_OVERTURE_POSTGRES_TEST_DSN="$ADMIN_DSN"
export IGRIS_PSQL_BIN="$PSQL_BIN"
export IGRIS_CONNECTED_SMOKE_MODE=disposable
export IGRIS_CONNECTED_RUN_ID="$RUN_ID"
export IGRIS_CONNECTED_EXPECTED_DATA_DIR="$PGDATA"
export IGRIS_CONNECTED_EXPECTED_SOCKET_DIR="$SOCKET_DIR"
export IGRIS_CONNECTED_EXPECTED_PORT="$PGPORT"
export IGRIS_DB_ROLE_MIGRATION_OWNER="igris_mig_${RUN_SUFFIX}"
export IGRIS_DB_ROLE_APP_RUNTIME="igris_rt_${RUN_SUFFIX}"
export IGRIS_DB_ROLE_READ_ONLY_OPERATOR="igris_ro_${RUN_SUFFIX}"
export IGRIS_DB_ROLE_BACKUP_RESTORE="igris_bk_${RUN_SUFFIX}"

SERVER_VERSION="$("$PSQL_BIN" "$ADMIN_DSN" -X -Atc 'SHOW server_version;')"
log "server_version=${SERVER_VERSION}"
if [[ ! "$SERVER_VERSION" =~ ^16\. ]]; then
  error "expected PostgreSQL 16.x"
  exit 1
fi
log "cluster_identity=verified_socket_only"

log "== bootstrap package =="
run_stage bootstrap go test ./igris-overture/database/bootstrap -count=1 -timeout=400s

log "== runtime startup migration boundary =="
run_stage runtime_startup go test ./igris-overture/database \
  -run 'TestApplicationStartupDoesNotMigrateOutdatedDatabase' -count=1 -timeout=120s

log "== roles package =="
run_stage roles go test ./igris-overture/database/roles -count=1 -timeout=400s

log "== runtime-role Connected paths =="
run_stage runtime go test ./igris-overture/api \
  -run 'TestConnectedPathsUnderRuntimeRolePostgres' -count=1 -timeout=300s

log "== contract + evidence + immutability =="
run_stage contract go test ./igris-overture/api \
  -run 'TestContractSyncPostgres.*|TestEvidenceIngestPostgres.*|TestConnectedImmutableRecordsPostgres' \
  -count=1 -timeout=600s

log "== private-alpha cross-slice E2E =="
run_stage e2e go test ./igris-overture/api \
  -run 'TestPrivateAlphaCrossSliceEndToEnd|TestContractSyncEndToEndPythonSDK|TestEvidenceIngestionEndToEndPythonSDK' \
  -count=1 -timeout=900s

log "== coordinator disposable-schema harness =="
run_stage coordinator go test ./igris-overture/coordinator \
  -run 'TestTaskRecordsTenantScopedIdempotencyPostgres|TestExecutionLineageTenantIsolationPostgres|TestExecutionContextTenantBoundMigrationPostgres' \
  -count=1 -timeout=180s

log "== staging smoke =="
if [[ "${IGRIS_PG16_ENABLE_TEST_HOOKS:-0}" == "1" && "${IGRIS_PG16_TEST_FAIL_STAGE:-}" == "identity" ]]; then
  export IGRIS_CONNECTED_RUN_ID=00000000000000000000000000000000
fi
run_stage smoke ./scripts/connected/staging_smoke.sh

trap - ERR INT TERM
set +e
cleanup_resources
cleanup_status=$?
set -e
if [[ "$cleanup_status" -ne 0 ]]; then
  error "cleanup failed after successful validation status=${cleanup_status}"
  exit "$cleanup_status"
fi
trap - EXIT
log "result=connected_pg16_local_validate_ok"
