-- Migration: 010_add_budget_fields_to_tenants
-- Description: Add cost budget tracking and enforcement fields to tenants table
-- Purpose: Enable real-time cost budget enforcement with soft/hard limits
-- Author: Igris Inertial Team
-- Date: 2025-11-10
-- Phase: 5.3 - Feature Gap Closure
-- Dependencies: 008_add_tier_column_to_tenants.sql

-- ============================================================================
-- 1. ADD BUDGET TRACKING COLUMNS TO TENANTS TABLE
-- ============================================================================

-- Monthly budget configuration
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS monthly_budget_usd NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS enforce_budget BOOLEAN DEFAULT false;

-- Current month spend tracking
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS current_month_spend NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS budget_reset_at TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('month', CURRENT_TIMESTAMP + INTERVAL '1 month');

-- Budget limit tracking
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS soft_limit_warning_sent BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hard_limit_reached_at TIMESTAMP WITH TIME ZONE;

-- Historical tracking
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS lifetime_spend_usd NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS last_billing_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 2. CREATE BUDGET USAGE HISTORY TABLE
-- ============================================================================
-- Track historical budget usage for analytics and billing

CREATE TABLE IF NOT EXISTS budget_usage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Time period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Budget configuration during this period
    monthly_budget_usd NUMERIC(12, 2) NOT NULL,

    -- Actual usage
    total_spend_usd NUMERIC(12, 2) NOT NULL,
    total_requests INTEGER NOT NULL,
    total_tokens BIGINT DEFAULT 0,

    -- Breakdown by category
    inference_cost_usd NUMERIC(12, 2) DEFAULT 0.00,
    embedding_cost_usd NUMERIC(12, 2) DEFAULT 0.00,
    other_cost_usd NUMERIC(12, 2) DEFAULT 0.00,

    -- Provider breakdown (JSON)
    provider_breakdown JSONB,

    -- Budget compliance
    budget_exceeded BOOLEAN DEFAULT false,
    exceeded_at TIMESTAMP WITH TIME ZONE,
    exceeded_by_usd NUMERIC(12, 2) DEFAULT 0.00,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT budget_usage_history_valid_period
        CHECK (period_end > period_start),
    CONSTRAINT budget_usage_history_non_negative_spend
        CHECK (total_spend_usd >= 0),
    CONSTRAINT budget_usage_history_non_negative_budget
        CHECK (monthly_budget_usd >= 0)
);

-- ============================================================================
-- 3. CREATE BUDGET ALERTS TABLE
-- ============================================================================
-- Track budget alerts sent to tenants

CREATE TABLE IF NOT EXISTS budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Alert details
    alert_type VARCHAR(50) NOT NULL, -- 'soft_limit', 'hard_limit', 'exceeded'
    alert_level VARCHAR(20) NOT NULL, -- 'warning', 'critical'

    -- Budget status at time of alert
    current_spend_usd NUMERIC(12, 2) NOT NULL,
    monthly_budget_usd NUMERIC(12, 2) NOT NULL,
    usage_percent NUMERIC(5, 2) NOT NULL,

    -- Alert delivery
    channels TEXT[], -- ['email', 'slack', 'webhook']
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'delivered', 'failed'

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Budget status queries
CREATE INDEX IF NOT EXISTS idx_tenants_budget_enforcement
    ON tenants(enforce_budget, current_month_spend DESC)
    WHERE enforce_budget = true;

-- Find tenants approaching limits
CREATE INDEX IF NOT EXISTS idx_tenants_budget_usage
    ON tenants(current_month_spend DESC, monthly_budget_usd)
    WHERE enforce_budget = true AND monthly_budget_usd > 0;

-- Budget reset queries
CREATE INDEX IF NOT EXISTS idx_tenants_budget_reset
    ON tenants(budget_reset_at)
    WHERE budget_reset_at IS NOT NULL;

-- History queries by tenant and period
CREATE INDEX IF NOT EXISTS idx_budget_usage_history_tenant_period
    ON budget_usage_history(tenant_id, period_start DESC);

-- Alert queries
CREATE INDEX IF NOT EXISTS idx_budget_alerts_tenant_created
    ON budget_alerts(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_alerts_delivery_status
    ON budget_alerts(delivery_status, created_at)
    WHERE delivery_status = 'pending';

-- ============================================================================
-- 5. FUNCTIONS FOR BUDGET MANAGEMENT
-- ============================================================================

-- Function to increment tenant spend atomically
CREATE OR REPLACE FUNCTION increment_tenant_spend(
    p_tenant_id UUID,
    p_cost_usd NUMERIC(12, 2)
)
RETURNS TABLE(
    new_spend NUMERIC(12, 2),
    monthly_budget NUMERIC(12, 2),
    usage_percent NUMERIC(5, 2),
    soft_limit_hit BOOLEAN,
    hard_limit_hit BOOLEAN
) AS $$
DECLARE
    v_new_spend NUMERIC(12, 2);
    v_budget NUMERIC(12, 2);
    v_usage_percent NUMERIC(5, 2);
BEGIN
    -- Atomic increment
    UPDATE tenants
    SET
        current_month_spend = current_month_spend + p_cost_usd,
        lifetime_spend_usd = lifetime_spend_usd + p_cost_usd,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_tenant_id
    RETURNING current_month_spend, monthly_budget_usd
    INTO v_new_spend, v_budget;

    -- Calculate usage percentage
    IF v_budget > 0 THEN
        v_usage_percent := (v_new_spend / v_budget) * 100;
    ELSE
        v_usage_percent := 0;
    END IF;

    -- Return results
    new_spend := v_new_spend;
    monthly_budget := v_budget;
    usage_percent := v_usage_percent;
    soft_limit_hit := v_usage_percent >= 90;
    hard_limit_hit := v_usage_percent >= 100;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant can proceed with request
CREATE OR REPLACE FUNCTION check_budget_preauth(
    p_tenant_id UUID,
    p_estimated_cost NUMERIC(12, 2)
)
RETURNS TABLE(
    can_proceed BOOLEAN,
    warning_level VARCHAR(20),
    current_spend NUMERIC(12, 2),
    projected_spend NUMERIC(12, 2),
    monthly_budget NUMERIC(12, 2),
    usage_percent NUMERIC(5, 2)
) AS $$
DECLARE
    v_current_spend NUMERIC(12, 2);
    v_budget NUMERIC(12, 2);
    v_enforce BOOLEAN;
    v_projected NUMERIC(12, 2);
    v_usage NUMERIC(5, 2);
BEGIN
    -- Get tenant budget info
    SELECT current_month_spend, monthly_budget_usd, enforce_budget
    INTO v_current_spend, v_budget, v_enforce
    FROM tenants
    WHERE id = p_tenant_id;

    -- If budget not enforced or unlimited, allow
    IF NOT v_enforce OR v_budget <= 0 THEN
        can_proceed := true;
        warning_level := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Calculate projected spend
    v_projected := v_current_spend + p_estimated_cost;
    v_usage := (v_projected / v_budget) * 100;

    -- Set return values
    current_spend := v_current_spend;
    projected_spend := v_projected;
    monthly_budget := v_budget;
    usage_percent := v_usage;

    -- Check limits
    IF v_usage >= 100 THEN
        can_proceed := false;
        warning_level := 'critical';
    ELSIF v_usage >= 90 THEN
        can_proceed := true;
        warning_level := 'warning';
    ELSE
        can_proceed := true;
        warning_level := NULL;
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly budgets (run via cron)
CREATE OR REPLACE FUNCTION reset_monthly_budgets()
RETURNS TABLE(
    tenants_reset INTEGER,
    history_entries_created INTEGER
) AS $$
DECLARE
    v_tenants_reset INTEGER;
    v_history_entries INTEGER;
BEGIN
    -- Create history entries for completed periods
    INSERT INTO budget_usage_history (
        tenant_id,
        period_start,
        period_end,
        monthly_budget_usd,
        total_spend_usd,
        total_requests,
        budget_exceeded,
        exceeded_at,
        exceeded_by_usd
    )
    SELECT
        id,
        budget_reset_at - INTERVAL '1 month',
        budget_reset_at,
        monthly_budget_usd,
        current_month_spend,
        requests_this_month,
        current_month_spend > monthly_budget_usd,
        hard_limit_reached_at,
        GREATEST(current_month_spend - monthly_budget_usd, 0)
    FROM tenants
    WHERE budget_reset_at <= CURRENT_TIMESTAMP;

    GET DIAGNOSTICS v_history_entries = ROW_COUNT;

    -- Reset counters
    UPDATE tenants
    SET
        current_month_spend = 0,
        budget_reset_at = DATE_TRUNC('month', CURRENT_TIMESTAMP + INTERVAL '1 month'),
        soft_limit_warning_sent = false,
        hard_limit_reached_at = NULL,
        last_billing_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE budget_reset_at <= CURRENT_TIMESTAMP;

    GET DIAGNOSTICS v_tenants_reset = ROW_COUNT;

    tenants_reset := v_tenants_reset;
    history_entries_created := v_history_entries;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. VIEWS FOR ANALYTICS
-- ============================================================================

-- View: Budget status for all tenants
CREATE OR REPLACE VIEW tenant_budget_status AS
SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.tier,
    t.monthly_budget_usd,
    t.current_month_spend,
    t.monthly_budget_usd - t.current_month_spend AS remaining_budget,
    CASE
        WHEN t.monthly_budget_usd > 0 THEN
            (t.current_month_spend / t.monthly_budget_usd) * 100
        ELSE 0
    END AS usage_percent,
    t.current_month_spend >= t.monthly_budget_usd * 0.90 AS soft_limit_hit,
    t.current_month_spend >= t.monthly_budget_usd AS hard_limit_hit,
    t.budget_reset_at,
    t.enforce_budget,
    t.lifetime_spend_usd,
    t.last_billing_at
FROM tenants t
WHERE t.enforce_budget = true AND t.monthly_budget_usd > 0;

-- View: Tenants approaching budget limits
CREATE OR REPLACE VIEW tenants_approaching_budget_limit AS
SELECT
    tenant_id,
    tenant_name,
    tier,
    monthly_budget_usd,
    current_month_spend,
    remaining_budget,
    usage_percent,
    budget_reset_at
FROM tenant_budget_status
WHERE usage_percent >= 80
ORDER BY usage_percent DESC;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN tenants.monthly_budget_usd IS
    'Maximum monthly spend in USD. 0 or NULL means unlimited.';

COMMENT ON COLUMN tenants.current_month_spend IS
    'Current month accumulated spend in USD. Reset on budget_reset_at.';

COMMENT ON COLUMN tenants.enforce_budget IS
    'When true, requests are blocked at 100% budget. When false, only warnings are sent.';

COMMENT ON TABLE budget_usage_history IS
    'Historical record of monthly budget usage for billing and analytics.';

COMMENT ON TABLE budget_alerts IS
    'Log of budget alerts sent to tenants.';

COMMENT ON FUNCTION increment_tenant_spend IS
    'Atomically increment tenant spend and return budget status.';

COMMENT ON FUNCTION check_budget_preauth IS
    'Pre-authorization check to determine if request should proceed based on budget.';

COMMENT ON FUNCTION reset_monthly_budgets IS
    'Resets monthly budget counters. Run via cron on first day of month.';

-- ============================================================================
-- 8. CONSTRAINTS AND VALIDATION
-- ============================================================================

-- Ensure budget values are non-negative
ALTER TABLE tenants
    ADD CONSTRAINT tenants_monthly_budget_non_negative
    CHECK (monthly_budget_usd >= 0);

ALTER TABLE tenants
    ADD CONSTRAINT tenants_current_spend_non_negative
    CHECK (current_month_spend >= 0);

ALTER TABLE tenants
    ADD CONSTRAINT tenants_lifetime_spend_non_negative
    CHECK (lifetime_spend_usd >= 0);

-- ============================================================================
-- 9. SET DEFAULT BUDGETS FOR EXISTING TENANTS
-- ============================================================================

-- Initialize budget reset dates for existing tenants
UPDATE tenants
SET budget_reset_at = DATE_TRUNC('month', CURRENT_TIMESTAMP + INTERVAL '1 month')
WHERE budget_reset_at IS NULL;

-- Set default budgets based on tier (optional - adjust as needed)
-- Developer tier: No enforcement by default
UPDATE tenants
SET
    monthly_budget_usd = 0,
    enforce_budget = false
WHERE tier = 'developer' AND monthly_budget_usd IS NULL;

-- Growth tier: Example $1000/month soft limit
UPDATE tenants
SET
    monthly_budget_usd = 1000.00,
    enforce_budget = false  -- Warning only, no blocking
WHERE tier = 'growth' AND monthly_budget_usd IS NULL;

-- Scale tier: Unlimited by default
UPDATE tenants
SET
    monthly_budget_usd = 0,
    enforce_budget = false
WHERE tier = 'scale' AND monthly_budget_usd IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
    tenant_count INTEGER;
    history_table_exists BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO tenant_count
    FROM tenants
    WHERE monthly_budget_usd IS NOT NULL;

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'budget_usage_history'
    ) INTO history_table_exists;

    RAISE NOTICE 'Migration 010 completed successfully:';
    RAISE NOTICE '  - Budget columns added to tenants table';
    RAISE NOTICE '  - % tenants have budget configuration', tenant_count;
    RAISE NOTICE '  - Budget usage history table created: %', history_table_exists;
    RAISE NOTICE '  - Budget alerts table created';
    RAISE NOTICE '  - Budget management functions created';
    RAISE NOTICE '  - Analytics views created';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Update tier_config.yaml to enable cost budget enforcement';
    RAISE NOTICE '  Set feature_flags.enable_cost_budget_enforcement: true';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration:
--
-- DROP VIEW IF EXISTS tenants_approaching_budget_limit CASCADE;
-- DROP VIEW IF EXISTS tenant_budget_status CASCADE;
-- DROP FUNCTION IF EXISTS reset_monthly_budgets CASCADE;
-- DROP FUNCTION IF EXISTS check_budget_preauth CASCADE;
-- DROP FUNCTION IF EXISTS increment_tenant_spend CASCADE;
-- DROP TABLE IF EXISTS budget_alerts CASCADE;
-- DROP TABLE IF EXISTS budget_usage_history CASCADE;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS monthly_budget_usd;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS enforce_budget;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS current_month_spend;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS budget_reset_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS soft_limit_warning_sent;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS hard_limit_reached_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS lifetime_spend_usd;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS last_billing_at;
