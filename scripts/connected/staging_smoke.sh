#!/usr/bin/env bash
# Connected staging smoke: disposable PostgreSQL only.
# Never targets shared, staging-shared, or production databases.
#
# Steps:
#   1. Create disposable database
#   2. Bootstrap actions-first schema through v069
#   3. Provision least-privilege roles
#   4. Staging preflight
#   5. Synthetic contract sync + evidence probe as runtime role
#   6. Verify read-only can inspect but not mutate
#   7. Drop disposable database
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ADMIN_DSN="${IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN:-${DATABASE_URL_MIGRATION:-}}"
if [[ -z "${ADMIN_DSN}" ]]; then
  echo "error: set IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN or DATABASE_URL_MIGRATION to a local admin DSN" >&2
  exit 2
fi

# Refuse obviously shared hosts.
if echo "${ADMIN_DSN}" | grep -Eiq 'neon\.tech|azure|amazonaws|supabase|prod|shared'; then
  echo "error: refusing non-local/shared-looking database URL (disposable local only)" >&2
  exit 2
fi

DB_NAME="igris_connected_smoke_$(openssl rand -hex 4)"
echo "smoke_database=${DB_NAME}"

cleanup() {
  local code=$?
  psql "${ADMIN_DSN}" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
  psql "${ADMIN_DSN}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};" >/dev/null 2>&1 || true
  # Best-effort cluster role cleanup for default names used only in this smoke.
  for role in igris_app_runtime igris_read_only_operator igris_backup_restore igris_migration_owner; do
    psql "${ADMIN_DSN}" -c "DROP OWNED BY ${role} CASCADE;" >/dev/null 2>&1 || true
    psql "${ADMIN_DSN}" -c "DROP ROLE IF EXISTS ${role};" >/dev/null 2>&1 || true
  done
  exit "${code}"
}
trap cleanup EXIT

psql "${ADMIN_DSN}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};" >/dev/null

# Derive DB-specific URL without printing secrets.
export ADMIN_DSN
SMOKE_URL="$(DB_NAME="${DB_NAME}" python3 - <<'PY'
from urllib.parse import urlparse, urlunparse
import os
u = urlparse(os.environ["ADMIN_DSN"])
print(urlunparse((u.scheme, u.netloc, "/" + os.environ["DB_NAME"], "", u.query, "")))
PY
)"
export DATABASE_URL_MIGRATION="${SMOKE_URL}"

echo "== bootstrap =="
go run ./cmd/igris-db-bootstrap --mode=apply --database-url="${SMOKE_URL}"

echo "== role provision =="
go run ./cmd/igris-db-roles --mode=apply --database-url="${SMOKE_URL}"

echo "== staging preflight =="
go run ./cmd/igris-db-staging-preflight --database-url="${SMOKE_URL}"

echo "== synthetic contract + evidence as runtime =="
psql "${SMOKE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE igris_app_runtime;
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

-- Explicitly fully-redacted evidence event body (no secrets).
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

-- Immutable mutation must fail.
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
psql "${SMOKE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE igris_read_only_operator;
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

echo "result=connected_staging_smoke_ok"
