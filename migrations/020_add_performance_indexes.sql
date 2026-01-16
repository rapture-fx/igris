-- Migration: 020_add_performance_indexes.sql
-- Purpose: Add composite indexes for common query patterns to optimize performance
-- Phase: RECOMMENDED - Performance Enhancement
-- Date: 2025-01-16
--
-- These indexes optimize the most common query patterns identified in the codebase:
-- - Tenant + timestamp queries for spending logs and audit events
-- - Tenant + semantic class queries for bandit arms
-- - Provider + semantic class for Thompson Sampling lookups
-- - Request tracking and budget queries

-- ============================================================================
-- SPENDING_LOG TABLE INDEXES
-- ============================================================================

-- Index for tenant spending queries by time (budget dashboard, billing reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spending_log_tenant_timestamp
ON spending_log (tenant_id, timestamp DESC);

-- Index for provider cost analysis per tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spending_log_tenant_provider
ON spending_log (tenant_id, provider);

-- Index for model usage tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spending_log_tenant_model
ON spending_log (tenant_id, model);

-- ============================================================================
-- AUDIT_EVENTS TABLE INDEXES
-- ============================================================================

-- Index for tenant audit trail queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_tenant_timestamp
ON audit_events (tenant_id, timestamp DESC);

-- Index for event type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_tenant_event_type
ON audit_events (tenant_id, event_type, timestamp DESC);

-- Index for severity-based queries (alerts, errors)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_tenant_severity
ON audit_events (tenant_id, severity, timestamp DESC);

-- ============================================================================
-- BANDIT_ARMS TABLE INDEXES (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bandit_arms') THEN
        -- Index for Thompson Sampling lookups by semantic class
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bandit_arms_semantic_class
        ON bandit_arms (semantic_class);

        -- Index for provider + class combination (unique already but add for scans)
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bandit_arms_provider_class
        ON bandit_arms (provider_id, semantic_class);

        -- Index for composite reward sorting (arm selection)
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bandit_arms_class_reward
        ON bandit_arms (semantic_class, composite_reward DESC);

        RAISE NOTICE 'Indexes created on bandit_arms table';
    END IF;
END$$;

-- ============================================================================
-- FEEDBACK_EVENTS TABLE INDEXES (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback_events') THEN
        -- Index for tenant feedback queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_events_tenant_timestamp
        ON feedback_events (tenant_id, created_at DESC);

        -- Index for arm feedback aggregation
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_events_arm_timestamp
        ON feedback_events (arm_id, created_at DESC);

        RAISE NOTICE 'Indexes created on feedback_events table';
    END IF;
END$$;

-- ============================================================================
-- COGNITIVE_PROPOSALS TABLE INDEXES (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cognitive_proposals') THEN
        -- Index for tenant proposals by status
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cognitive_proposals_tenant_status
        ON cognitive_proposals (tenant_id, status, created_at DESC);

        -- Index for approved proposals lookup
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cognitive_proposals_tenant_approved
        ON cognitive_proposals (tenant_id, approved_at DESC) WHERE approved_at IS NOT NULL;

        RAISE NOTICE 'Indexes created on cognitive_proposals table';
    END IF;
END$$;

-- ============================================================================
-- BUDGETS TABLE INDEXES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets') THEN
        -- Index for current month budget lookups
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_tenant_yearmonth
        ON budgets (tenant_id, year_month DESC);

        -- Index for breached budget alerts
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_breached
        ON budgets (breached, tenant_id) WHERE breached = true;

        RAISE NOTICE 'Indexes created on budgets table';
    END IF;
END$$;

-- ============================================================================
-- POLICY_SETTINGS TABLE INDEXES
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'policy_settings') THEN
        -- Index for tenant policy lookups
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_policy_settings_tenant
        ON policy_settings (tenant_id);

        RAISE NOTICE 'Index created on policy_settings table';
    END IF;
END$$;

-- ============================================================================
-- TENANTS TABLE INDEXES (for tier enforcement)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        -- Index for tier-based queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_tier
        ON tenants (tier);

        -- Index for active trial lookups
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_trial_active
        ON tenants (trial_ends_at) WHERE trial_active = true;

        RAISE NOTICE 'Indexes created on tenants table';
    END IF;
END$$;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

-- Update table statistics for query planner after adding indexes
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN (
            'spending_log', 'audit_events', 'bandit_arms', 'feedback_events',
            'cognitive_proposals', 'budgets', 'policy_settings', 'tenants'
        )
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(table_record.table_name);
        RAISE NOTICE 'Analyzed table: %', table_record.table_name;
    END LOOP;
END$$;

-- ============================================================================
-- VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_performance_indexes()
RETURNS TABLE(
    table_name TEXT,
    index_name TEXT,
    index_columns TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.relname::TEXT AS table_name,
        i.relname::TEXT AS index_name,
        pg_get_indexdef(i.oid)::TEXT AS index_columns
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE t.relkind = 'r'
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND i.relname LIKE 'idx_%'
    ORDER BY t.relname, i.relname;
END;
$$ LANGUAGE plpgsql;

-- Run verification
SELECT * FROM verify_performance_indexes();

-- ============================================================================
-- DEPLOYMENT NOTES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Performance Indexes Migration 020 Complete';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Indexes added for:';
    RAISE NOTICE '  - spending_log: tenant_timestamp, tenant_provider, tenant_model';
    RAISE NOTICE '  - audit_events: tenant_timestamp, tenant_event_type, tenant_severity';
    RAISE NOTICE '  - bandit_arms: semantic_class, provider_class, class_reward';
    RAISE NOTICE '  - feedback_events: tenant_timestamp, arm_timestamp';
    RAISE NOTICE '  - cognitive_proposals: tenant_status, tenant_approved';
    RAISE NOTICE '  - budgets: tenant_yearmonth, breached';
    RAISE NOTICE '  - tenants: tier, trial_active';
    RAISE NOTICE '';
    RAISE NOTICE 'All CONCURRENTLY - no table locks required.';
    RAISE NOTICE 'Run verify_performance_indexes() to confirm.';
    RAISE NOTICE '=====================================================';
END$$;
