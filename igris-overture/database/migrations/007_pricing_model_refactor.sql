-- Migration 007: Pricing model refactor
-- Introduces canonical tier IDs (seed, horizon, infinite) and runtime_limit
-- enforcement. Removes legacy tier names from default values.

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

-- Link runtime_instances to the owning tenant so we can count per-tenant
ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_runtime_instances_tenant
    ON runtime_instances (tenant_id);

COMMENT ON COLUMN tenants.runtime_limit IS
    'Maximum number of igris-runtime instances the tenant may register. '
    'Derived from their active subscription tier: seed=1, horizon=50, infinite=500.';

COMMENT ON COLUMN tenants.polar_subscription_id IS
    'Polar.sh subscription ID for this tenant, populated via webhook.';
