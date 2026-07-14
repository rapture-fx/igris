#!/usr/bin/env bash
# Connected staging validation.
#
# Default mode is non-destructive preflight for an explicitly supplied DSN.
# Destructive disposable smoke is allowed only when pg16_local_validate.sh has
# created and positively identified the cluster with a run-specific marker.
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

error() { printf 'error: %s\n' "$*" >&2; }

MODE="${IGRIS_CONNECTED_SMOKE_MODE:-preflight}"
ADMIN_DSN="${IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN:-${DATABASE_URL_MIGRATION:-}}"
PSQL_BIN="${IGRIS_PSQL_BIN:-}"

if [[ -z "$ADMIN_DSN" ]]; then
  error "set IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN for non-destructive preflight"
  exit 2
fi

if [[ "$MODE" == "preflight" ]]; then
  echo "mode=external_non_destructive_preflight"
  go run ./cmd/igris-db-staging-preflight --database-url="$ADMIN_DSN"
  exit $?
fi
if [[ "$MODE" != "disposable" ]]; then
  error "IGRIS_CONNECTED_SMOKE_MODE must be preflight or disposable"
  exit 2
fi

RUN_ID="${IGRIS_CONNECTED_RUN_ID:-}"
EXPECTED_DATA_DIR="${IGRIS_CONNECTED_EXPECTED_DATA_DIR:-}"
EXPECTED_SOCKET_DIR="${IGRIS_CONNECTED_EXPECTED_SOCKET_DIR:-}"
EXPECTED_PORT="${IGRIS_CONNECTED_EXPECTED_PORT:-}"
MIGRATION_OWNER="${IGRIS_DB_ROLE_MIGRATION_OWNER:-}"
APP_RUNTIME="${IGRIS_DB_ROLE_APP_RUNTIME:-}"
READ_ONLY="${IGRIS_DB_ROLE_READ_ONLY_OPERATOR:-}"
BACKUP_ROLE="${IGRIS_DB_ROLE_BACKUP_RESTORE:-}"

if [[ ! "$RUN_ID" =~ ^[a-f0-9]{32}$ || ! "$EXPECTED_PORT" =~ ^[0-9]{4,5}$ ]]; then
  error "missing or invalid run-specific cluster identity"
  exit 2
fi
if [[ -z "$EXPECTED_DATA_DIR" || -z "$EXPECTED_SOCKET_DIR" ]]; then
  error "missing expected cluster data/socket identity"
  exit 2
fi
if [[ -z "$PSQL_BIN" || ! -f "$PSQL_BIN" || ! -x "$PSQL_BIN" || -L "$PSQL_BIN" ]]; then
  error "IGRIS_PSQL_BIN must be a verified non-symlink regular executable"
  exit 2
fi
for role in "$MIGRATION_OWNER" "$APP_RUNTIME" "$READ_ONLY" "$BACKUP_ROLE"; do
  if [[ ! "$role" =~ ^[a-z][a-z0-9_]{0,62}$ ]]; then
    error "invalid run-scoped role identifier"
    exit 2
  fi
done

RUN_SUFFIX="${RUN_ID:0:12}"
DB_NAME="igris_smoke_${RUN_SUFFIX}"
DB_CREATED=0
ROLES_CREATED=0
CLEANUP_COMPLETE=0

verify_identity() {
  local result
  result="$("$PSQL_BIN" "$ADMIN_DSN" -X -v ON_ERROR_STOP=1 -At \
    -v run_id="$RUN_ID" -v data_dir="$EXPECTED_DATA_DIR" \
    -v socket_dir="$EXPECTED_SOCKET_DIR" -v port="$EXPECTED_PORT" <<'SQL'
SELECT CASE WHEN EXISTS (
  SELECT 1
  FROM public.igris_local_validation_identity i
  WHERE i.run_id = :'run_id'
    AND i.data_directory = :'data_dir'
    AND i.socket_directory = :'socket_dir'
    AND i.port = :'port'::integer
    AND current_setting('data_directory') = i.data_directory
    AND current_setting('unix_socket_directories') = i.socket_directory
    AND current_setting('port') = i.port::text
    AND inet_server_addr() IS NULL
) THEN 'identity_ok' ELSE 'identity_mismatch' END;
SQL
)"
  [[ "$result" == "identity_ok" ]]
}

cleanup_resources() {
  if [[ "$CLEANUP_COMPLETE" -eq 1 ]]; then
    return 0
  fi
  if ! verify_identity; then
    error "cluster identity mismatch; refusing destructive cleanup"
    return 72
  fi

  local failed=0
  if [[ "$DB_CREATED" -eq 1 ]]; then
    "$PSQL_BIN" "$ADMIN_DSN" -X -v ON_ERROR_STOP=1 -v db_name="$DB_NAME" <<'SQL' >/dev/null || failed=1
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'db_name' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS :"db_name";
SQL
  fi
  if [[ "$ROLES_CREATED" -eq 1 ]]; then
    for role in "$APP_RUNTIME" "$READ_ONLY" "$BACKUP_ROLE" "$MIGRATION_OWNER"; do
      "$PSQL_BIN" "$ADMIN_DSN" -X -v ON_ERROR_STOP=1 -v role_name="$role" \
        >/dev/null <<'SQL' || failed=1
DROP OWNED BY :"role_name" CASCADE;
DROP ROLE IF EXISTS :"role_name";
SQL
    done
  fi
  if [[ "$failed" -ne 0 ]]; then
    error "run-scoped smoke cleanup failed"
    return 73
  fi
  CLEANUP_COMPLETE=1
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

trap on_exit EXIT
trap 'status=$?; error "smoke stage failed line=${LINENO} status=${status}"; return "$status" 2>/dev/null || exit "$status"' ERR
trap 'exit 130' INT
trap 'exit 143' TERM

if ! verify_identity; then
  error "positive cluster identity proof failed; refusing disposable smoke"
  exit 2
fi
if [[ "${IGRIS_PG16_ENABLE_TEST_HOOKS:-0}" == "1" && "${IGRIS_PG16_TEST_FAIL_STAGE:-}" == "preflight" ]]; then
  error "test-only failure injection stage=preflight status=47"
  exit 47
fi

existing_roles="$("$PSQL_BIN" "$ADMIN_DSN" -X -v ON_ERROR_STOP=1 -At \
  -v r1="$MIGRATION_OWNER" -v r2="$APP_RUNTIME" -v r3="$READ_ONLY" -v r4="$BACKUP_ROLE" <<'SQL'
SELECT count(*) FROM pg_roles WHERE rolname IN (:'r1', :'r2', :'r3', :'r4');
SQL
)"
if [[ "$existing_roles" != "0" ]]; then
  error "run-scoped role collision; refusing to alter pre-existing roles"
  exit 2
fi

echo "smoke_database=${DB_NAME}"
"$PSQL_BIN" "$ADMIN_DSN" -X -v ON_ERROR_STOP=1 -v db_name="$DB_NAME" <<'SQL' >/dev/null
CREATE DATABASE :"db_name";
SQL
DB_CREATED=1

export ADMIN_DSN DB_NAME
SMOKE_URL="$(python3 - <<'PY'
from urllib.parse import urlparse, urlunparse
import os

u = urlparse(os.environ["ADMIN_DSN"])
if u.scheme not in ("postgres", "postgresql") or u.fragment:
    raise SystemExit("admin DSN must be a PostgreSQL URL without a fragment")
print(urlunparse((u.scheme, u.netloc, "/" + os.environ["DB_NAME"], "", u.query, "")))
PY
)"
export DATABASE_URL_MIGRATION="$SMOKE_URL"

echo "== bootstrap =="
go run ./cmd/igris-db-bootstrap --mode=apply --database-url="$SMOKE_URL"

echo "== role provision =="
go run ./cmd/igris-db-roles --mode=apply --database-url="$SMOKE_URL"
ROLES_CREATED=1

echo "== staging preflight =="
go run ./cmd/igris-db-staging-preflight --database-url="$SMOKE_URL"

echo "== synthetic contract + evidence as runtime =="
"$PSQL_BIN" "$SMOKE_URL" -X -v ON_ERROR_STOP=1 -v app_runtime="$APP_RUNTIME" <<'SQL'
SET ROLE :"app_runtime";
SET search_path = public, pg_catalog;

INSERT INTO tenants (tenant_id, tenant_name)
VALUES ('smoke-tenant', 'Connected Smoke')
ON CONFLICT DO NOTHING;

INSERT INTO action_definitions (tenant_id, name, display_name, target_type, origin)
VALUES ('smoke-tenant', 'smoke.action', 'Smoke Action', 'http', 'sdk_sync')
ON CONFLICT DO NOTHING;

INSERT INTO action_contract_versions (
  tenant_id, action_name, contract_hash, schema_version, contract,
  risk, approval_mode, execution_mode
) VALUES (
  'smoke-tenant', 'smoke.action', repeat('a', 64), '1',
  '{"schema_version":"1","action_name":"smoke.action"}'::jsonb,
  'low', 'never', 'embedded'
);

INSERT INTO contract_sync_idempotency (
  tenant_id, operation, action_name, idempotency_key,
  request_fingerprint, response_status, response_body
) VALUES (
  'smoke-tenant', 'contract_sync', 'smoke.action', 'smoke-key-1',
  repeat('a', 64), 0, '{}'::jsonb
);
UPDATE contract_sync_idempotency
SET response_status = 200, response_body = '{"created":true}'::jsonb
WHERE tenant_id = 'smoke-tenant' AND idempotency_key = 'smoke-key-1';

INSERT INTO sdk_signing_keys (tenant_id, key_id, public_key_pem, fingerprint_sha256)
VALUES ('smoke-tenant', 'ed25519:smoke', '-----BEGIN PUBLIC KEY-----\nSMOKE\n-----END PUBLIC KEY-----', repeat('b', 64));

INSERT INTO sdk_evidence_batches (
  tenant_id, key_id, evidence_state, content_hash, chain_head,
  events_accepted, events_verified, verified_at
) VALUES (
  'smoke-tenant', 'ed25519:smoke', 'verified', repeat('c', 64), repeat('d', 64),
  1, 1, NOW()
);

INSERT INTO sdk_evidence_events (
  tenant_id, key_id, event_hash, batch_id, event, event_id,
  event_type, action_name, contract_hash, timestamp_utc
)
SELECT
  'smoke-tenant', 'ed25519:smoke', repeat('e', 64), id,
  '{"event_type":"decision","redacted":true}'::jsonb, 'smoke-event-1',
  'decision', 'smoke.action', repeat('a', 64), NOW()
FROM sdk_evidence_batches
WHERE tenant_id = 'smoke-tenant' AND content_hash = repeat('c', 64);

DO $$
BEGIN
  BEGIN
    UPDATE action_contract_versions SET risk = 'high' WHERE tenant_id = 'smoke-tenant';
    RAISE EXCEPTION 'expected immutable update to fail';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%immutable Connected record%' OR SQLSTATE = '42501' THEN
      RAISE NOTICE 'immutable_update_blocked';
    ELSE
      RAISE;
    END IF;
  END;
END $$;
SQL

echo "== read-only operator inspect / no mutate =="
"$PSQL_BIN" "$SMOKE_URL" -X -v ON_ERROR_STOP=1 -v read_only="$READ_ONLY" <<'SQL'
SET ROLE :"read_only";
SET search_path = public, pg_catalog;
SELECT count(*) AS contracts FROM action_contract_versions WHERE tenant_id = 'smoke-tenant';
SELECT count(*) AS events FROM sdk_evidence_events WHERE tenant_id = 'smoke-tenant';
DO $$
BEGIN
  BEGIN
    INSERT INTO action_contract_versions (
      tenant_id, action_name, contract_hash, schema_version, contract,
      risk, approval_mode, execution_mode
    ) VALUES (
      'smoke-tenant', 'should.fail', repeat('f', 64), '1', '{}'::jsonb,
      'low', 'never', 'embedded'
    );
    RAISE EXCEPTION 'read-only insert should have failed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'read_only_insert_blocked';
  END;
END $$;
SQL

trap - ERR INT TERM
set +e
cleanup_resources
cleanup_status=$?
set -e
if [[ "$cleanup_status" -ne 0 ]]; then
  error "cleanup failed after successful smoke status=${cleanup_status}"
  exit "$cleanup_status"
fi
trap - EXIT
echo "result=connected_staging_smoke_ok"
