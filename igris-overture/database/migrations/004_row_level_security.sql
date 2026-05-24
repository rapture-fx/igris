-- Migration 004: Row-Level Security (RLS) for tenant isolation
-- This creates the set_tenant_context function and RLS policies
-- that the tenant_auth middleware depends on.

-- Create the set_tenant_context function
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant', p_tenant_id, true);
END;
$$ LANGUAGE plpgsql;

-- Helper function to get current tenant
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_tenant', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Enable RLS on tenant-scoped tables
-- ============================================================================

-- Licenses table
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses FORCE ROW LEVEL SECURITY;

CREATE POLICY licenses_tenant_isolation ON licenses
    USING (customer_id::text = current_tenant_id());

CREATE POLICY licenses_tenant_insert ON licenses
    FOR INSERT WITH CHECK (customer_id::text = current_tenant_id());

-- Tenant keys table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_keys') THEN
        EXECUTE 'ALTER TABLE tenant_keys ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE tenant_keys FORCE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY tenant_keys_isolation ON tenant_keys USING (tenant_id::text = current_tenant_id())';
        EXECUTE 'CREATE POLICY tenant_keys_insert ON tenant_keys FOR INSERT WITH CHECK (tenant_id::text = current_tenant_id())';
    END IF;
END $$;

-- Usage logs table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_logs') THEN
        EXECUTE 'ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE usage_logs FORCE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY usage_logs_isolation ON usage_logs USING (license_key IN (SELECT license_key FROM licenses WHERE customer_id = current_tenant_id()))';
    END IF;
END $$;

-- Decision audit trail (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'decision_audit') THEN
        EXECUTE 'ALTER TABLE decision_audit ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE decision_audit FORCE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY decision_audit_isolation ON decision_audit USING (tenant_id::text = current_tenant_id())';
    END IF;
END $$;

-- ============================================================================
-- Bypass policy for admin/service role
-- ============================================================================
-- The application connects as a service user that should bypass RLS for admin operations.
-- RLS is enforced only after set_tenant_context() is called in the middleware.
-- When app.current_tenant is empty/null, no rows are returned (secure by default).
