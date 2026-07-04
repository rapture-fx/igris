-- Migration 050: align tenants.tenant_email across all environments.
--
-- Background
--   Migration 016_schema_gaps.sql declared `tenant_email TEXT` in a
--   `CREATE TABLE IF NOT EXISTS tenants (...)` block. On dev/staging/prod
--   databases whose `tenants` table was created before migration 016
--   (i.e. nearly all of them), that statement is a no-op and the older
--   column name `email` persists.
--
--   Application code — `igris-overture/middleware/session_auth.go`,
--   `igris-overture/api/routes_frontend.go`, and
--   `igris-overture/billing/webhook_handler.go` — queries `tenant_email`.
--   Without this column, the BetterAuth API-key branch (used by the CLI
--   and MCP server) silently returns 401 INVALID_API_KEY because the SQL
--   fails on a missing column and any DB error in that path maps to 401.
--
--   This was caught by the live CLI/MCP smoke harness; sqlmock-style unit
--   tests didn't catch it because the mock driver returns whatever
--   columns the test asks for, without validating SQL against a real
--   schema.
--
-- Behavior
--   - Adds `tenant_email TEXT` if the column is missing.
--   - Backfills `tenant_email` from the legacy `email` column for rows
--     where `tenant_email` is NULL.
--   - Does NOT drop `email`. Keeping it is a deliberate non-decision:
--     two other paths (`routes_frontend.go` schema-detection,
--     `webhook_handler.go`) still read `email`, and a rename / drop
--     belongs in a separate, coordinated change.
--
-- Idempotent. Safe to re-run.

BEGIN;

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS tenant_email TEXT;

DO $$
BEGIN
    -- Resolve `tenants` through the current search_path (to_regclass) instead
    -- of assuming table_schema = 'public', so the guard inspects the same
    -- table the ALTER TABLE above just modified. In production `tenants`
    -- lives in `public` and this is equivalent; in schema-isolated test
    -- databases the old hardcoded check missed the table and skipped the
    -- backfill entirely.
    IF EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = to_regclass('tenants')
          AND attname = 'email'
          AND attnum > 0
          AND NOT attisdropped
    ) THEN
        UPDATE tenants
            SET tenant_email = email
            WHERE tenant_email IS NULL
              AND email IS NOT NULL;
    END IF;
END $$;

COMMIT;
