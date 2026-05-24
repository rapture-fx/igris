-- Migration 007: Pricing model refactor
-- Introduces canonical tier IDs (seed, horizon, infinite) and runtime_limit
-- enforcement. Removes legacy tier names from default values.

-- Fresh local databases do not have the tenant baseline until migration 016.
-- Create the current repaired shape here so this migration can run cleanly.
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id             TEXT        PRIMARY KEY,
    tenant_name           TEXT        NOT NULL DEFAULT '',
    tenant_email          TEXT,
    company               TEXT,
    status                TEXT        NOT NULL DEFAULT 'active',
    tier                  TEXT        NOT NULL DEFAULT 'seed',
    api_key_hash          TEXT,
    api_key_prefix        TEXT,
    api_key_created_at    TIMESTAMPTZ,
    is_active             BOOLEAN     NOT NULL DEFAULT true,
    runtime_limit         INTEGER     NOT NULL DEFAULT 1,
    capabilities_policy   JSONB       NOT NULL DEFAULT '{}',
    polar_subscription_id TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add runtime_limit to tenants so enforcement can read it without joining
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS runtime_limit        INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;

-- Normalise existing tier values to the new canonical names
UPDATE tenants SET tier = 'seed'     WHERE tier IN ('trial', 'develop', 'developer');
UPDATE tenants SET tier = 'horizon'  WHERE tier = 'growth';
UPDATE tenants SET tier = 'infinite' WHERE tier = 'scale';

-- Backfill runtime_limit from tier
UPDATE tenants SET runtime_limit = CASE
    WHEN tier = 'infinite' THEN 500
    WHEN tier = 'horizon'  THEN 50
    ELSE 1
END;

-- Link runtime_instances to the owning tenant so we can count per-tenant.
-- The repaired tenant key is tenants.tenant_id TEXT; migration 016 converts
-- any older UUID column to this shape on existing databases.
ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_runtime_instances_tenant
    ON runtime_instances (tenant_id);

COMMENT ON COLUMN tenants.runtime_limit IS
    'Maximum number of igris-runtime instances the tenant may register. '
    'Derived from their active subscription tier: seed=1, horizon=50, infinite=500.';

COMMENT ON COLUMN tenants.polar_subscription_id IS
    'Polar.sh subscription ID for this tenant, populated via webhook.';
