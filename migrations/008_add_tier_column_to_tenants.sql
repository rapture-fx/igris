-- Migration: 008_add_tier_column_to_tenants
-- Description: Add tier-based gating support for multi-tenant pricing
-- Purpose: Enable differential feature access and usage limits per tenant tier
-- Author: Schlep-Engine Team
-- Date: 2025-11-10
-- Phase: 5.2 - Tier Gating and Request Enforcement

-- ============================================================================
-- 1. TIER ENUM TYPE
-- ============================================================================
-- Define explicit tier types aligned with /config/tier_config.yaml
DO $$ BEGIN
    CREATE TYPE tenant_tier AS ENUM (
        'developer',  -- Entry-level: 5 providers, 500K req/month
        'growth',     -- Production: 10 providers, 2M req/month
        'scale'       -- Enterprise: 20 providers, unlimited req/month
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. ADD TIER COLUMN TO TENANTS TABLE
-- ============================================================================
-- Add tier column with default value
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS tier tenant_tier DEFAULT 'developer';

-- Add tier metadata and usage tracking columns
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS tier_upgraded_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS tier_downgraded_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS tier_grace_period_ends_at TIMESTAMP WITH TIME ZONE;

-- Usage tracking columns (synced with Redis counters)
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS requests_this_month INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS requests_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS total_requests INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(12, 6) DEFAULT 0.0;

-- Enforcement flags
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS enforce_tier_limits BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS soft_limit_warning_sent BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hard_limit_reached_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================
-- Tier-based queries (for admin dashboards)
CREATE INDEX IF NOT EXISTS idx_tenants_tier
    ON tenants(tier);

-- Find tenants approaching limits (80% threshold)
CREATE INDEX IF NOT EXISTS idx_tenants_requests_this_month
    ON tenants(requests_this_month DESC)
    WHERE enforce_tier_limits = true;

-- Find tenants in grace period
CREATE INDEX IF NOT EXISTS idx_tenants_grace_period
    ON tenants(tier_grace_period_ends_at)
    WHERE tier_grace_period_ends_at IS NOT NULL;

-- Composite index for tier + status queries
CREATE INDEX IF NOT EXISTS idx_tenants_tier_status
    ON tenants(tier, status)
    WHERE status = 'active';

-- ============================================================================
-- 4. BACKFILL EXISTING TENANTS
-- ============================================================================
-- Set default tier for existing tenants
UPDATE tenants
SET tier = 'developer'
WHERE tier IS NULL;

-- Set requests_reset_at to start of current month for existing tenants
UPDATE tenants
SET requests_reset_at = DATE_TRUNC('month', CURRENT_TIMESTAMP)
WHERE requests_reset_at IS NULL OR requests_reset_at < DATE_TRUNC('month', CURRENT_TIMESTAMP);

-- ============================================================================
-- 5. TIER CHANGE AUDIT LOG TABLE
-- ============================================================================
-- Track all tier upgrades/downgrades for billing and compliance
CREATE TABLE IF NOT EXISTS tier_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tier change details
    old_tier tenant_tier NOT NULL,
    new_tier tenant_tier NOT NULL,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('upgrade', 'downgrade', 'manual_override')),

    -- Change metadata
    changed_by VARCHAR(255),  -- User ID or 'system' for automatic changes
    reason TEXT,              -- Reason for tier change
    effective_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Billing impact
    prorated_amount_usd NUMERIC(12, 2),

    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT tier_change_different CHECK (old_tier != new_tier)
);

-- Index for tenant tier history
CREATE INDEX IF NOT EXISTS idx_tier_change_log_tenant_id
    ON tier_change_log(tenant_id, effective_at DESC);

-- Index for change type analysis
CREATE INDEX IF NOT EXISTS idx_tier_change_log_change_type
    ON tier_change_log(change_type, effective_at DESC);

-- ============================================================================
-- 6. FUNCTIONS FOR TIER MANAGEMENT
-- ============================================================================

-- Function to get tier limits from config (returns JSONB)
-- NOTE: This is a placeholder - actual limits come from tier_config.yaml in Go middleware
CREATE OR REPLACE FUNCTION get_tier_limits(tier_name tenant_tier)
RETURNS JSONB AS $$
BEGIN
    RETURN CASE tier_name
        WHEN 'developer' THEN '{"max_requests_per_month": 500000, "max_providers": 5, "max_tenants": 1}'::jsonb
        WHEN 'growth' THEN '{"max_requests_per_month": 2000000, "max_providers": 10, "max_tenants": 5}'::jsonb
        WHEN 'scale' THEN '{"max_requests_per_month": -1, "max_providers": 20, "max_tenants": -1}'::jsonb
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if tenant is within tier limits
CREATE OR REPLACE FUNCTION check_tier_limits(tenant_uuid UUID)
RETURNS TABLE(
    within_limits BOOLEAN,
    requests_used INTEGER,
    requests_limit INTEGER,
    requests_percent NUMERIC,
    providers_count INTEGER,
    providers_limit INTEGER,
    warnings TEXT[]
) AS $$
DECLARE
    tenant_tier tenant_tier;
    tier_limits JSONB;
    provider_count INTEGER;
BEGIN
    -- Get tenant tier
    SELECT tier INTO tenant_tier FROM tenants WHERE id = tenant_uuid;

    -- Get tier limits
    tier_limits := get_tier_limits(tenant_tier);

    -- Count providers for this tenant
    SELECT COUNT(*) INTO provider_count
    FROM provider_registry
    WHERE tenant_id = tenant_uuid AND status = 'active';

    -- Get request count
    SELECT requests_this_month INTO requests_used FROM tenants WHERE id = tenant_uuid;

    requests_limit := (tier_limits->>'max_requests_per_month')::INTEGER;
    providers_limit := (tier_limits->>'max_providers')::INTEGER;

    -- Calculate percentage (handle unlimited)
    IF requests_limit = -1 THEN
        requests_percent := 0;
    ELSE
        requests_percent := (requests_used::NUMERIC / requests_limit::NUMERIC) * 100;
    END IF;

    -- Build warnings array
    warnings := ARRAY[]::TEXT[];

    IF requests_limit != -1 AND requests_percent >= 80 THEN
        warnings := array_append(warnings, 'Approaching request limit');
    END IF;

    IF provider_count >= providers_limit * 0.8 THEN
        warnings := array_append(warnings, 'Approaching provider limit');
    END IF;

    -- Determine if within limits
    within_limits := (
        (requests_limit = -1 OR requests_used < requests_limit) AND
        (providers_limit = -1 OR provider_count < providers_limit)
    );

    RETURN QUERY SELECT
        within_limits,
        requests_used,
        requests_limit,
        requests_percent,
        provider_count,
        providers_limit,
        warnings;
END;
$$ LANGUAGE plpgsql;

-- Function to log tier changes
CREATE OR REPLACE FUNCTION log_tier_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if tier actually changed
    IF OLD.tier != NEW.tier THEN
        INSERT INTO tier_change_log (
            tenant_id,
            old_tier,
            new_tier,
            change_type,
            changed_by,
            reason
        ) VALUES (
            NEW.id,
            OLD.tier,
            NEW.tier,
            CASE
                WHEN NEW.tier::TEXT > OLD.tier::TEXT THEN 'upgrade'
                ELSE 'downgrade'
            END,
            current_user,
            'Tier change via UPDATE statement'
        );

        -- Update tier change timestamps
        IF NEW.tier::TEXT > OLD.tier::TEXT THEN
            NEW.tier_upgraded_at := CURRENT_TIMESTAMP;
        ELSE
            NEW.tier_downgraded_at := CURRENT_TIMESTAMP;
            -- Set grace period (30 days for downgrades)
            NEW.tier_grace_period_ends_at := CURRENT_TIMESTAMP + INTERVAL '30 days';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log tier changes
CREATE TRIGGER tier_change_audit_trigger
    BEFORE UPDATE OF tier ON tenants
    FOR EACH ROW
    WHEN (OLD.tier IS DISTINCT FROM NEW.tier)
    EXECUTE FUNCTION log_tier_change();

-- Function to reset monthly request counters (run via cron)
CREATE OR REPLACE FUNCTION reset_monthly_request_counters()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    -- Reset counters for tenants where reset_at is in the past
    UPDATE tenants
    SET
        requests_this_month = 0,
        requests_reset_at = DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month',
        soft_limit_warning_sent = false,
        hard_limit_reached_at = NULL
    WHERE requests_reset_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS reset_count = ROW_COUNT;

    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. CONSTRAINTS AND VALIDATION
-- ============================================================================

-- Ensure tier is always set
ALTER TABLE tenants
    ADD CONSTRAINT tenants_tier_not_null CHECK (tier IS NOT NULL);

-- Ensure requests_this_month is never negative
ALTER TABLE tenants
    ADD CONSTRAINT tenants_requests_non_negative CHECK (requests_this_month >= 0);

-- Ensure total_requests is never negative
ALTER TABLE tenants
    ADD CONSTRAINT tenants_total_requests_non_negative CHECK (total_requests >= 0);

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN tenants.tier IS
    'Pricing tier determining feature access and usage limits. Aligned with /config/tier_config.yaml';

COMMENT ON COLUMN tenants.requests_this_month IS
    'Request count for current billing period. Synced with Redis counter for real-time enforcement.';

COMMENT ON COLUMN tenants.requests_reset_at IS
    'Timestamp when monthly request counter will reset (typically first day of next month).';

COMMENT ON COLUMN tenants.enforce_tier_limits IS
    'When false, tier limits are not enforced (useful for testing or VIP accounts).';

COMMENT ON TABLE tier_change_log IS
    'Audit trail for all tier upgrades and downgrades. Critical for billing and compliance.';

COMMENT ON FUNCTION get_tier_limits(tenant_tier) IS
    'Returns tier limits as JSONB. Note: Canonical source is /config/tier_config.yaml in Go middleware.';

COMMENT ON FUNCTION check_tier_limits(UUID) IS
    'Checks if tenant is within tier limits. Returns usage percentages and warnings.';

COMMENT ON FUNCTION reset_monthly_request_counters() IS
    'Resets monthly request counters for all tenants. Run via cron on first day of month.';

-- ============================================================================
-- 9. INITIAL DATA SEEDING (Optional)
-- ============================================================================

-- Example: Set system tenant to 'scale' tier
UPDATE tenants
SET tier = 'scale', enforce_tier_limits = false
WHERE id = '00000000-0000-0000-0000-000000000000';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration success
DO $$
DECLARE
    tenant_count INTEGER;
    tier_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tenant_count FROM tenants WHERE tier IS NOT NULL;
    SELECT COUNT(DISTINCT tier) INTO tier_count FROM tenants;

    RAISE NOTICE 'Migration 008 completed successfully:';
    RAISE NOTICE '  - % tenants have tier assigned', tenant_count;
    RAISE NOTICE '  - % distinct tiers in use', tier_count;
    RAISE NOTICE '  - Tier change audit log table created';
    RAISE NOTICE '  - Tier limit functions created';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration:
-- DROP TRIGGER IF EXISTS tier_change_audit_trigger ON tenants;
-- DROP FUNCTION IF EXISTS log_tier_change CASCADE;
-- DROP FUNCTION IF EXISTS reset_monthly_request_counters CASCADE;
-- DROP FUNCTION IF EXISTS check_tier_limits CASCADE;
-- DROP FUNCTION IF EXISTS get_tier_limits CASCADE;
-- DROP TABLE IF EXISTS tier_change_log CASCADE;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS tier;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS tier_upgraded_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS tier_downgraded_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS tier_grace_period_ends_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS requests_this_month;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS requests_reset_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS total_requests;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS total_cost_usd;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS enforce_tier_limits;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS soft_limit_warning_sent;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS hard_limit_reached_at;
-- DROP TYPE IF EXISTS tenant_tier CASCADE;
