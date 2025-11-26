-- Migration: 013_add_tenant_row_level_security
-- Purpose: Enable Row-Level Security (RLS) on all tenant tables to enforce tenant isolation
-- Phase: P0-3 Security Fix
-- Date: 2025-11-26
--
-- CRITICAL: This migration adds RLS policies to prevent tenant data leakage.
-- Without this, a malicious tenant can read/modify other tenants' data by manipulating JWT claims.

-- P0-3 FIX: Enable RLS on all tenant tables

-- 1. Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tenant record
CREATE POLICY tenant_isolation_policy ON tenants
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', TRUE)::TEXT);

-- Policy: Allow service role to access all tenants (for admin operations)
CREATE POLICY tenant_service_policy ON tenants
    FOR ALL
    TO schlep_service
    USING (TRUE);

-- 2. Enable RLS on tenant_budget_usage table
ALTER TABLE tenant_budget_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_budget_isolation_policy ON tenant_budget_usage
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', TRUE)::TEXT);

CREATE POLICY tenant_budget_service_policy ON tenant_budget_usage
    FOR ALL
    TO schlep_service
    USING (TRUE);

-- 3. Enable RLS on tenant_request_log table
ALTER TABLE tenant_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_request_log_isolation_policy ON tenant_request_log
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', TRUE)::TEXT);

CREATE POLICY tenant_request_log_service_policy ON tenant_request_log
    FOR ALL
    TO schlep_service
    USING (TRUE);

-- 4. Enable RLS on routing_telemetry table (if it has tenant_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'routing_telemetry' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE routing_telemetry ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY routing_telemetry_isolation_policy ON routing_telemetry
            FOR ALL
            USING (tenant_id = current_setting(''app.tenant_id'', TRUE)::TEXT)';

        EXECUTE 'CREATE POLICY routing_telemetry_service_policy ON routing_telemetry
            FOR ALL
            TO schlep_service
            USING (TRUE)';
    END IF;
END$$;

-- 5. Enable RLS on slo_audit_events table (if it has tenant_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'slo_audit_events' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE slo_audit_events ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY slo_audit_isolation_policy ON slo_audit_events
            FOR ALL
            USING (tenant_id = current_setting(''app.tenant_id'', TRUE)::TEXT)';

        EXECUTE 'CREATE POLICY slo_audit_service_policy ON slo_audit_events
            FOR ALL
            TO schlep_service
            USING (TRUE)';
    END IF;
END$$;

-- 6. Enable RLS on semantic_bandit_rewards table (if it has tenant_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'semantic_bandit_rewards' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE semantic_bandit_rewards ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY semantic_bandit_isolation_policy ON semantic_bandit_rewards
            FOR ALL
            USING (tenant_id = current_setting(''app.tenant_id'', TRUE)::TEXT)';

        EXECUTE 'CREATE POLICY semantic_bandit_service_policy ON semantic_bandit_rewards
            FOR ALL
            TO schlep_service
            USING (TRUE)';
    END IF;
END$$;

-- 7. Enable RLS on policy_audit_log table (if it has tenant_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'policy_audit_log' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE policy_audit_log ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY policy_audit_isolation_policy ON policy_audit_log
            FOR ALL
            USING (tenant_id = current_setting(''app.tenant_id'', TRUE)::TEXT)';

        EXECUTE 'CREATE POLICY policy_audit_service_policy ON policy_audit_log
            FOR ALL
            TO schlep_service
            USING (TRUE)';
    END IF;
END$$;

-- 8. Enable RLS on api_keys table (from migration 003)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'api_keys'
    ) THEN
        ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

        -- Check if api_keys has tenant_id column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'api_keys' AND column_name = 'tenant_id'
        ) THEN
            EXECUTE 'CREATE POLICY api_keys_isolation_policy ON api_keys
                FOR ALL
                USING (tenant_id = current_setting(''app.tenant_id'', TRUE)::TEXT)';

            EXECUTE 'CREATE POLICY api_keys_service_policy ON api_keys
                FOR ALL
                TO schlep_service
                USING (TRUE)';
        END IF;
    END IF;
END$$;

-- 9. Enable RLS on customer_routing_preferences table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'customer_routing_preferences'
    ) THEN
        ALTER TABLE customer_routing_preferences ENABLE ROW LEVEL SECURITY;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'customer_routing_preferences' AND column_name = 'tenant_id'
        ) THEN
            EXECUTE 'CREATE POLICY routing_prefs_isolation_policy ON customer_routing_preferences
                FOR ALL
                USING (tenant_id = current_setting(''app.tenant_id'', TRUE)::TEXT)';

            EXECUTE 'CREATE POLICY routing_prefs_service_policy ON customer_routing_preferences
                FOR ALL
                TO schlep_service
                USING (TRUE)';
        END IF;
    END IF;
END$$;

-- 10. Create service role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schlep_service') THEN
        CREATE ROLE schlep_service;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO schlep_service;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO schlep_service;
    END IF;
END$$;

-- Create helper function to set tenant context
-- This will be called by the application layer after JWT validation
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id TEXT)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on helper function
GRANT EXECUTE ON FUNCTION set_tenant_context(TEXT) TO PUBLIC;

-- Add comments
COMMENT ON FUNCTION set_tenant_context IS 'Sets the current tenant context for Row-Level Security. Call this after JWT validation.';

-- Create function to verify RLS is working
CREATE OR REPLACE FUNCTION verify_rls_enabled()
RETURNS TABLE(
    table_name TEXT,
    rls_enabled BOOLEAN,
    policy_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.relname::TEXT AS table_name,
        c.relrowsecurity AS rls_enabled,
        COUNT(p.polname) AS policy_count
    FROM pg_class c
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE c.relkind = 'r'
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND c.relname IN (
          'tenants',
          'tenant_budget_usage',
          'tenant_request_log',
          'routing_telemetry',
          'slo_audit_events',
          'semantic_bandit_rewards',
          'policy_audit_log',
          'api_keys',
          'customer_routing_preferences'
      )
    GROUP BY c.relname, c.relrowsecurity
    ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql;

-- Verify RLS is enabled (for deployment validation)
SELECT * FROM verify_rls_enabled();

-- Add deployment note
DO $$
BEGIN
    RAISE NOTICE 'Row-Level Security enabled on all tenant tables';
    RAISE NOTICE 'Remember to call set_tenant_context() after JWT validation in your application';
    RAISE NOTICE 'Service role "schlep_service" can bypass RLS for administrative operations';
END$$;
