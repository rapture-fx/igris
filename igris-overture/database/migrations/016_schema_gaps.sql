-- Migration 016: Schema gaps — audit_events table, runtime_instances tenant_id type fix,
-- licenses tenant_id column, and tenants table baseline for fresh deploys.

-- ── 1. audit_events ──────────────────────────────────────────────────────────
-- Defined in schema.sql but never included in migrations; required by
-- /policy/history, /policy/capabilities/history, and logPolicyAudit().

CREATE TABLE IF NOT EXISTS audit_events (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        VARCHAR(255) NOT NULL DEFAULT 'default',
    event_type       VARCHAR(50)  NOT NULL,
    event_category   VARCHAR(50)  NOT NULL DEFAULT 'general',
    severity         VARCHAR(20)  NOT NULL DEFAULT 'info',
    provider         VARCHAR(50),
    model            VARCHAR(100),
    action           VARCHAR(50),
    cost_usd         DECIMAL(12, 6),
    tokens_requested INTEGER,
    tokens_allowed   INTEGER,
    request_id       VARCHAR(255),
    trace_id         VARCHAR(255),
    metadata         JSONB,
    error_message    TEXT,
    timestamp        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant
    ON audit_events (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_type
    ON audit_events (event_type, timestamp DESC);

-- ── 2. runtime_instances.tenant_id UUID → TEXT ───────────────────────────────
-- Migration 007 added tenant_id as UUID referencing tenants(id), but the
-- tenants table uses tenant_id TEXT (BetterAuth user IDs) as its primary key —
-- there is no UUID id column. Passing a BetterAuth ID to a UUID column causes
-- "invalid input syntax for type uuid" on every runtime count query.

ALTER TABLE runtime_instances
    DROP CONSTRAINT IF EXISTS runtime_instances_tenant_id_fkey;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'runtime_instances'
          AND column_name = 'tenant_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE runtime_instances
            ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
    END IF;
END $$;

-- ── 3. licenses.tenant_id TEXT ───────────────────────────────────────────────
-- The cost routes join usage_log → licenses → tenants via licenses.customer_id
-- (UUID) → tenants.id (UUID), but tenants has no id UUID column.  Adding
-- tenant_id TEXT to licenses lets cost queries filter directly without the
-- broken tenants join.

ALTER TABLE licenses
    ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id
    ON licenses (tenant_id)
    WHERE tenant_id IS NOT NULL;

-- ── 4. Tenants table baseline ─────────────────────────────────────────────────
-- No migration has ever created the tenants table; it was assumed to exist from
-- the initial VPS setup.  This CREATE IF NOT EXISTS is a no-op on existing
-- deployments but ensures fresh deploys don't fail.

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id            TEXT         PRIMARY KEY,
    tenant_name          TEXT         NOT NULL DEFAULT '',
    tenant_email         TEXT,
    company              TEXT,
    status               TEXT         NOT NULL DEFAULT 'active',
    tier                 TEXT         NOT NULL DEFAULT 'seed',
    api_key_hash         TEXT,
    api_key_prefix       TEXT,
    api_key_created_at   TIMESTAMPTZ,
    is_active            BOOLEAN      NOT NULL DEFAULT true,
    runtime_limit        INTEGER      NOT NULL DEFAULT 1,
    polar_subscription_id TEXT,
    subscription_status  TEXT         NOT NULL DEFAULT 'none',
    trial_active         BOOLEAN      NOT NULL DEFAULT false,
    trial_tier           TEXT,
    trial_started_at     TIMESTAMPTZ,
    trial_ends_at        TIMESTAMPTZ,
    runtime_bounds       JSONB        NOT NULL DEFAULT '{}',
    capabilities_policy  JSONB        NOT NULL DEFAULT '{}',
    environment          TEXT                  DEFAULT 'production',
    timezone             TEXT                  DEFAULT 'UTC',
    log_level            TEXT                  DEFAULT 'info',
    execution_signing    BOOLEAN               DEFAULT true,
    audit_logging        BOOLEAN               DEFAULT true,
    receipt_retention_days INTEGER             DEFAULT 90,
    telemetry_enabled    BOOLEAN               DEFAULT true,
    default_execution_timeout INTEGER          DEFAULT 30000,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_tenant_id
    ON tenants (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenants_api_key_hash
    ON tenants (api_key_hash)
    WHERE api_key_hash IS NOT NULL;
