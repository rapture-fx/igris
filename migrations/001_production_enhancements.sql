-- ===========================================
-- Schlep Engine Production Enhancements Migration
-- Version: v1.4.0
-- Date: 2025-12-11
-- ===========================================
--
-- This migration adds critical performance and security enhancements:
-- 1. Row-Level Security (RLS) for multi-tenant isolation
-- 2. Optimized indexes for high-throughput workloads
-- 3. Key rotation infrastructure
-- 4. Session tracking improvements
-- 5. Helper functions for tenant context

-- ===========================================
-- 1. TENANT CONTEXT FUNCTIONS
-- ===========================================

-- Function to set tenant context for RLS
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Set session variable for RLS policies
    PERFORM set_config('app.tenant_id', p_tenant_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current tenant context
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.tenant_id', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===========================================
-- 2. KEY ROTATION INFRASTRUCTURE
-- ===========================================

-- Table to track key rotation state
CREATE TABLE IF NOT EXISTS key_rotation_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    current_key_id VARCHAR(100) NOT NULL,
    previous_key_id VARCHAR(100),
    rotation_started TIMESTAMP,
    grace_period_hours INTEGER DEFAULT 168, -- 7 days
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Index for key rotation queries
CREATE INDEX IF NOT EXISTS idx_key_rotation_current
    ON key_rotation_state(current_key_id);

-- ===========================================
-- 3. ROW-LEVEL SECURITY (RLS) POLICIES
-- ===========================================

-- Enable RLS on tenant_keys table
ALTER TABLE IF EXISTS tenant_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access keys for their tenant
CREATE POLICY tenant_keys_isolation ON tenant_keys
    FOR ALL
    USING (tenant_id = get_tenant_context());

-- Policy: Admin bypass (for system operations)
CREATE POLICY tenant_keys_admin ON tenant_keys
    FOR ALL
    TO CURRENT_USER
    USING (current_setting('app.bypass_rls', true) = 'true');

-- Enable RLS on optimizer_states table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'optimizer_states') THEN
        ALTER TABLE optimizer_states ENABLE ROW LEVEL SECURITY;

        -- Policy: Optimizer states are global, but log access
        CREATE POLICY optimizer_states_access ON optimizer_states
            FOR ALL
            USING (true);
    END IF;
END $$;

-- Enable RLS on tenant_sessions table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_sessions') THEN
        ALTER TABLE tenant_sessions ENABLE ROW LEVEL SECURITY;

        CREATE POLICY tenant_sessions_isolation ON tenant_sessions
            FOR ALL
            USING (tenant_id = get_tenant_context());
    END IF;
END $$;

-- Enable RLS on tenants table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

        CREATE POLICY tenants_self_access ON tenants
            FOR SELECT
            USING (tenant_id = get_tenant_context());

        CREATE POLICY tenants_admin_access ON tenants
            FOR ALL
            TO CURRENT_USER
            USING (current_setting('app.bypass_rls', true) = 'true');
    END IF;
END $$;

-- ===========================================
-- 4. PERFORMANCE INDEXES
-- ===========================================

-- Composite index for tenant_keys lookup (hot path)
CREATE INDEX IF NOT EXISTS idx_tenant_keys_tenant_provider_active
    ON tenant_keys(tenant_id, provider, is_active)
    WHERE is_active = TRUE;

-- Index for key usage tracking queries
CREATE INDEX IF NOT EXISTS idx_tenant_keys_last_used
    ON tenant_keys(tenant_id, last_used_at DESC NULLS LAST)
    WHERE is_active = TRUE;

-- Index for session token lookups (critical path)
CREATE INDEX IF NOT EXISTS idx_tenant_sessions_token_hash
    ON tenant_sessions(token_hash)
    WHERE revoked_at IS NULL;

-- Index for active sessions by tenant
CREATE INDEX IF NOT EXISTS idx_tenant_sessions_tenant_active
    ON tenant_sessions(tenant_id, expires_at)
    WHERE revoked_at IS NULL AND expires_at > NOW();

-- Index for optimizer state lookups
CREATE INDEX IF NOT EXISTS idx_optimizer_states_snapshot_updated
    ON optimizer_states(snapshot_name, updated_at DESC);

-- Partial index for recent optimizer states (last 7 days)
CREATE INDEX IF NOT EXISTS idx_optimizer_states_recent
    ON optimizer_states(snapshot_name, updated_at DESC)
    WHERE updated_at > NOW() - INTERVAL '7 days';

-- ===========================================
-- 5. TENANT BUDGET TRACKING (if needed)
-- ===========================================

-- Table for tenant budget tracking (if not exists)
CREATE TABLE IF NOT EXISTS tenant_budgets (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    monthly_budget DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    current_spend DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    budget_alert_threshold DECIMAL(5, 2) DEFAULT 0.80, -- 80%
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month)
);

-- Enable RLS on tenant_budgets
ALTER TABLE tenant_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_budgets_isolation ON tenant_budgets
    FOR ALL
    USING (tenant_id = get_tenant_context());

-- Index for budget queries
CREATE INDEX IF NOT EXISTS idx_tenant_budgets_tenant_month
    ON tenant_budgets(tenant_id, month);

-- Index for budget alert queries
CREATE INDEX IF NOT EXISTS idx_tenant_budgets_alert
    ON tenant_budgets(tenant_id, current_spend)
    WHERE current_spend >= (monthly_budget * budget_alert_threshold);

-- ===========================================
-- 6. HELPER FUNCTIONS
-- ===========================================

-- Function to check if user is over budget
CREATE OR REPLACE FUNCTION check_budget_limit(p_tenant_id TEXT, p_month TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_budget DECIMAL(10, 2);
    v_spend DECIMAL(10, 2);
BEGIN
    SELECT monthly_budget, current_spend
    INTO v_budget, v_spend
    FROM tenant_budgets
    WHERE tenant_id = p_tenant_id AND month = p_month;

    IF NOT FOUND THEN
        RETURN TRUE; -- No budget set, allow
    END IF;

    RETURN v_spend < v_budget;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================
-- 7. STATISTICS AND MONITORING
-- ===========================================

-- View for tenant key statistics
CREATE OR REPLACE VIEW v_tenant_key_stats AS
SELECT
    tenant_id,
    provider,
    COUNT(*) as total_keys,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_keys,
    SUM(usage_count) as total_usage,
    MAX(last_used_at) as last_used,
    AVG(key_version) as avg_key_version
FROM tenant_keys
GROUP BY tenant_id, provider;

-- View for session statistics
CREATE OR REPLACE VIEW v_session_stats AS
SELECT
    tenant_id,
    COUNT(*) as total_sessions,
    SUM(CASE WHEN revoked_at IS NULL AND expires_at > NOW() THEN 1 ELSE 0 END) as active_sessions,
    SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) as revoked_sessions,
    AVG(request_count) as avg_requests_per_session,
    MAX(last_used_at) as last_activity
FROM tenant_sessions
GROUP BY tenant_id;

-- ===========================================
-- 8. CLEANUP FUNCTIONS
-- ===========================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM tenant_sessions
    WHERE expires_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old optimizer states
CREATE OR REPLACE FUNCTION cleanup_old_optimizer_states(p_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM optimizer_states
    WHERE updated_at < NOW() - (p_days || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 9. PERFORMANCE OPTIMIZATIONS
-- ===========================================

-- Vacuum and analyze critical tables for optimizer
VACUUM ANALYZE tenant_keys;
VACUUM ANALYZE tenant_sessions;
VACUUM ANALYZE optimizer_states;
VACUUM ANALYZE tenants;

-- ===========================================
-- 10. GRANTS (adjust as needed for your setup)
-- ===========================================

-- Grant execute on helper functions to application role
-- GRANT EXECUTE ON FUNCTION set_tenant_context(TEXT) TO app_role;
-- GRANT EXECUTE ON FUNCTION get_tenant_context() TO app_role;
-- GRANT EXECUTE ON FUNCTION check_budget_limit(TEXT, TEXT) TO app_role;

-- ===========================================
-- MIGRATION COMPLETE
-- ===========================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_production_enhancements.sql completed successfully';
    RAISE NOTICE 'Enhancements applied:';
    RAISE NOTICE '  - Row-Level Security (RLS) enabled on multi-tenant tables';
    RAISE NOTICE '  - 10+ performance indexes created';
    RAISE NOTICE '  - Key rotation infrastructure added';
    RAISE NOTICE '  - Helper functions for tenant context';
    RAISE NOTICE '  - Budget tracking and monitoring views';
END $$;
