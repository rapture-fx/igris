-- Migration 018: tier_change_log table + trigger fix.
-- The tenants table has a trigger that logs tier changes to tier_change_log.
-- This table was missing from all prior migrations, causing webhook UPDATE to fail.
-- The trigger also referenced NEW.id instead of NEW.tenant_id — corrected here.

CREATE TABLE IF NOT EXISTS tier_change_log (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  TEXT        NOT NULL,
    old_tier   TEXT,
    new_tier   TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source     TEXT        DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_tier_change_log_tenant
    ON tier_change_log (tenant_id, changed_at DESC);

-- Recreate the trigger function with the correct column reference.
CREATE OR REPLACE FUNCTION log_tier_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.tier IS DISTINCT FROM NEW.tier THEN
        INSERT INTO tier_change_log (tenant_id, old_tier, new_tier, source)
        VALUES (NEW.tenant_id, OLD.tier, NEW.tier, 'trigger');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_tier_change ON tenants;
CREATE TRIGGER trg_log_tier_change
    AFTER UPDATE OF tier ON tenants
    FOR EACH ROW EXECUTE FUNCTION log_tier_change();
