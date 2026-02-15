-- Migration: 019_add_comprehensive_rls_policies.sql
-- Purpose: Enable Row-Level Security (RLS) on ALL remaining tenant tables
-- Phase: P0-1 MUST FIX - Security Critical
-- Date: 2025-01-16
--
-- CRITICAL: This migration adds RLS policies to ALL multi-tenant tables not covered
-- by migration 013. Without this, a malicious tenant could read/modify other tenants' data.
--
-- Tables covered by this migration:
-- - budgets (from schema.sql)
-- - spending_log (from schema.sql)
-- - policy_settings (from schema.sql)
-- - audit_events (from schema.sql)
-- - feedback_events (from migration 006)
-- - cognitive_proposals (from migration 012)
-- - policy_versions (from migration 007)
-- - sla_configurations (from migration 007)
-- - sla_violations (from migration 007)
-- - self_tuning_history (from migration 007)

-- ============================================================================
-- CREATE SERVICE ROLE IF NOT EXISTS (for bypass)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'igris_service') THEN
        CREATE ROLE igris_service;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO igris_service;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO igris_service;
    END IF;
END$$;

-- ============================================================================
-- 1. BUDGETS TABLE (schema.sql) - uses VARCHAR tenant_id
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets') THEN
        ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

        -- Drop existing policies if they exist (idempotent)
        DROP POLICY IF EXISTS budgets_tenant_isolation_policy ON budgets;
        DROP POLICY IF EXISTS budgets_service_policy ON budgets;

        -- Tenant isolation policy
        CREATE POLICY budgets_tenant_isolation_policy ON budgets
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id', TRUE)::TEXT);

        -- Service role bypass
        CREATE POLICY budgets_service_policy ON budgets
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on budgets table';
    END IF;
END$$;

-- ============================================================================
-- 2. SPENDING_LOG TABLE (schema.sql) - uses VARCHAR tenant_id
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spending_log') THEN
        ALTER TABLE spending_log ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS spending_log_tenant_isolation_policy ON spending_log;
        DROP POLICY IF EXISTS spending_log_service_policy ON spending_log;

        CREATE POLICY spending_log_tenant_isolation_policy ON spending_log
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id', TRUE)::TEXT);

        CREATE POLICY spending_log_service_policy ON spending_log
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on spending_log table';
    END IF;
END$$;

-- ============================================================================
-- 3. POLICY_SETTINGS TABLE (schema.sql) - uses VARCHAR tenant_id
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'policy_settings') THEN
        ALTER TABLE policy_settings ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS policy_settings_tenant_isolation_policy ON policy_settings;
        DROP POLICY IF EXISTS policy_settings_service_policy ON policy_settings;

        CREATE POLICY policy_settings_tenant_isolation_policy ON policy_settings
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id', TRUE)::TEXT);

        CREATE POLICY policy_settings_service_policy ON policy_settings
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on policy_settings table';
    END IF;
END$$;

-- ============================================================================
-- 4. AUDIT_EVENTS TABLE (schema.sql) - uses VARCHAR tenant_id
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_events') THEN
        ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS audit_events_tenant_isolation_policy ON audit_events;
        DROP POLICY IF EXISTS audit_events_service_policy ON audit_events;

        CREATE POLICY audit_events_tenant_isolation_policy ON audit_events
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id', TRUE)::TEXT);

        CREATE POLICY audit_events_service_policy ON audit_events
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on audit_events table';
    END IF;
END$$;

-- ============================================================================
-- 5. FEEDBACK_EVENTS TABLE (migration 006) - uses UUID tenant_id FK
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback_events') THEN
        ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS feedback_events_tenant_isolation_policy ON feedback_events;
        DROP POLICY IF EXISTS feedback_events_service_policy ON feedback_events;

        -- For UUID tenant_id, cast current_setting to UUID
        CREATE POLICY feedback_events_tenant_isolation_policy ON feedback_events
            FOR ALL
            USING (tenant_id::TEXT = current_setting('app.tenant_id', TRUE));

        CREATE POLICY feedback_events_service_policy ON feedback_events
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on feedback_events table';
    END IF;
END$$;

-- ============================================================================
-- 6. COGNITIVE_PROPOSALS TABLE (migration 012) - uses VARCHAR tenant_id
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cognitive_proposals') THEN
        ALTER TABLE cognitive_proposals ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS cognitive_proposals_tenant_isolation_policy ON cognitive_proposals;
        DROP POLICY IF EXISTS cognitive_proposals_service_policy ON cognitive_proposals;

        CREATE POLICY cognitive_proposals_tenant_isolation_policy ON cognitive_proposals
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id', TRUE)::TEXT);

        CREATE POLICY cognitive_proposals_service_policy ON cognitive_proposals
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on cognitive_proposals table';
    END IF;
END$$;

-- ============================================================================
-- 7. POLICY_VERSIONS TABLE (migration 007) - uses UUID tenant_id FK
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'policy_versions') THEN
        ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS policy_versions_tenant_isolation_policy ON policy_versions;
        DROP POLICY IF EXISTS policy_versions_service_policy ON policy_versions;

        CREATE POLICY policy_versions_tenant_isolation_policy ON policy_versions
            FOR ALL
            USING (tenant_id::TEXT = current_setting('app.tenant_id', TRUE));

        CREATE POLICY policy_versions_service_policy ON policy_versions
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on policy_versions table';
    END IF;
END$$;

-- ============================================================================
-- 8. SLA_CONFIGURATIONS TABLE (migration 007) - uses UUID tenant_id FK
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sla_configurations') THEN
        ALTER TABLE sla_configurations ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS sla_configurations_tenant_isolation_policy ON sla_configurations;
        DROP POLICY IF EXISTS sla_configurations_service_policy ON sla_configurations;

        CREATE POLICY sla_configurations_tenant_isolation_policy ON sla_configurations
            FOR ALL
            USING (tenant_id::TEXT = current_setting('app.tenant_id', TRUE));

        CREATE POLICY sla_configurations_service_policy ON sla_configurations
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on sla_configurations table';
    END IF;
END$$;

-- ============================================================================
-- 9. SLA_VIOLATIONS TABLE (migration 007) - uses UUID tenant_id FK
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sla_violations') THEN
        ALTER TABLE sla_violations ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS sla_violations_tenant_isolation_policy ON sla_violations;
        DROP POLICY IF EXISTS sla_violations_service_policy ON sla_violations;

        CREATE POLICY sla_violations_tenant_isolation_policy ON sla_violations
            FOR ALL
            USING (tenant_id::TEXT = current_setting('app.tenant_id', TRUE));

        CREATE POLICY sla_violations_service_policy ON sla_violations
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on sla_violations table';
    END IF;
END$$;

-- ============================================================================
-- 10. SELF_TUNING_HISTORY TABLE (migration 007) - uses UUID tenant_id FK (nullable)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'self_tuning_history') THEN
        ALTER TABLE self_tuning_history ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS self_tuning_history_tenant_isolation_policy ON self_tuning_history;
        DROP POLICY IF EXISTS self_tuning_history_service_policy ON self_tuning_history;
        DROP POLICY IF EXISTS self_tuning_history_global_policy ON self_tuning_history;

        -- Allow access to tenant's own records OR global records (where tenant_id IS NULL)
        CREATE POLICY self_tuning_history_tenant_isolation_policy ON self_tuning_history
            FOR ALL
            USING (
                tenant_id IS NULL
                OR tenant_id::TEXT = current_setting('app.tenant_id', TRUE)
            );

        CREATE POLICY self_tuning_history_service_policy ON self_tuning_history
            FOR ALL
            TO igris_service
            USING (TRUE);

        RAISE NOTICE 'RLS enabled on self_tuning_history table';
    END IF;
END$$;

-- ============================================================================
-- 11. SEMANTIC_CLASSIFICATIONS TABLE (migration 006) - no tenant_id, shared cache
-- ============================================================================
-- NOTE: semantic_classifications is a shared cache (prompt hash -> classification)
-- and does NOT have a tenant_id column. This is by design as classifications
-- are content-based, not tenant-specific. No RLS needed.

-- ============================================================================
-- 12. BANDIT_ARMS TABLE (migration 006) - no tenant_id, per-provider
-- ============================================================================
-- NOTE: bandit_arms is per-provider per-semantic-class, not per-tenant.
-- Thompson Sampling arms are shared across all tenants for the same provider.
-- This is intentional for better learning across the platform. No RLS needed.

-- ============================================================================
-- 13. SEMANTIC_CLASS_METADATA TABLE (migration 006) - no tenant_id, global config
-- ============================================================================
-- NOTE: semantic_class_metadata is global configuration shared across all tenants.
-- No RLS needed.

-- ============================================================================
-- VERIFICATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_comprehensive_rls()
RETURNS TABLE(
    table_name TEXT,
    has_tenant_id BOOLEAN,
    rls_enabled BOOLEAN,
    policy_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.relname::TEXT AS table_name,
        EXISTS (
            SELECT 1 FROM information_schema.columns col
            WHERE col.table_name = c.relname::TEXT AND col.column_name = 'tenant_id'
        ) AS has_tenant_id,
        c.relrowsecurity AS rls_enabled,
        COUNT(p.polname) AS policy_count
    FROM pg_class c
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE c.relkind = 'r'
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND c.relname IN (
          -- From migration 013
          'tenants', 'tenant_budget_usage', 'tenant_request_log',
          'routing_telemetry', 'slo_audit_events', 'api_keys',
          'customer_routing_preferences',
          -- From this migration (019)
          'budgets', 'spending_log', 'policy_settings', 'audit_events',
          'feedback_events', 'cognitive_proposals', 'policy_versions',
          'sla_configurations', 'sla_violations', 'self_tuning_history',
          -- Shared tables (no RLS needed)
          'semantic_classifications', 'bandit_arms', 'semantic_class_metadata'
      )
    GROUP BY c.relname, c.relrowsecurity
    ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql;

-- Run verification
SELECT * FROM verify_comprehensive_rls();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION verify_comprehensive_rls() IS
    'Verification function to check RLS status on all multi-tenant tables. Run after migration to confirm security.';

-- ============================================================================
-- DEPLOYMENT NOTES
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'RLS Migration 019 Complete';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Tables with RLS enabled:';
    RAISE NOTICE '  - budgets, spending_log, policy_settings, audit_events';
    RAISE NOTICE '  - feedback_events, cognitive_proposals';
    RAISE NOTICE '  - policy_versions, sla_configurations, sla_violations';
    RAISE NOTICE '  - self_tuning_history (with NULL tenant support)';
    RAISE NOTICE '';
    RAISE NOTICE 'Shared tables WITHOUT RLS (by design):';
    RAISE NOTICE '  - semantic_classifications (shared cache, no tenant_id)';
    RAISE NOTICE '  - bandit_arms (provider-level, no tenant_id)';
    RAISE NOTICE '  - semantic_class_metadata (global config)';
    RAISE NOTICE '';
    RAISE NOTICE 'CRITICAL: Application must call set_tenant_context()';
    RAISE NOTICE '          after JWT validation on EVERY request.';
    RAISE NOTICE '=====================================================';
END$$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration:
--
-- ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE spending_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE policy_settings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE feedback_events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE cognitive_proposals DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE policy_versions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sla_configurations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sla_violations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE self_tuning_history DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS *_tenant_isolation_policy ON *;
-- DROP POLICY IF EXISTS *_service_policy ON *;
-- DROP FUNCTION IF EXISTS verify_comprehensive_rls();
