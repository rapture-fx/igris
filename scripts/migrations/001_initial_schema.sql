-- Migration: 001_initial_schema
-- Description: Initial database schema for Phase 13 persistence
-- Author: Schlep-engine Team
-- Date: 2025-10-20

-- This migration creates all tables, indexes, views, functions, and triggers
-- required for Phase 13 persistence and multi-tenancy support.

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- budgets: Track monthly spending budgets per tenant
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    year_month VARCHAR(7) NOT NULL,
    total_spend_usd DECIMAL(12, 4) NOT NULL DEFAULT 0.0,
    request_count BIGINT NOT NULL DEFAULT 0,
    budget_limit_usd DECIMAL(12, 4) NOT NULL,
    breached BOOLEAN DEFAULT FALSE,
    breached_at TIMESTAMP,
    first_breach_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, year_month)
);

-- spending_log: Detailed cost breakdown by provider and model
CREATE TABLE IF NOT EXISTS spending_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    cost_usd DECIMAL(12, 6) NOT NULL,
    tokens_input INTEGER,
    tokens_output INTEGER,
    request_id VARCHAR(255),
    trace_id VARCHAR(255),
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- policy_settings: Store safety policy configuration per tenant
CREATE TABLE IF NOT EXISTS policy_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE DEFAULT 'default',
    max_monthly_cost_usd DECIMAL(12, 4) DEFAULT 5.0,
    enable_budget_limit BOOLEAN DEFAULT TRUE,
    fallback_on_budget_breach BOOLEAN DEFAULT TRUE,
    max_tokens_per_request INTEGER DEFAULT 1024,
    enable_token_limit BOOLEAN DEFAULT TRUE,
    enable_benchmark_fallback BOOLEAN DEFAULT TRUE,
    validate_keys_on_startup BOOLEAN DEFAULT TRUE,
    fail_fast_on_invalid_key BOOLEAN DEFAULT TRUE,
    test_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- audit_events: Store all safety-related events
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    provider VARCHAR(50),
    model VARCHAR(100),
    action VARCHAR(50),
    cost_usd DECIMAL(12, 6),
    tokens_requested INTEGER,
    tokens_allowed INTEGER,
    request_id VARCHAR(255),
    trace_id VARCHAR(255),
    metadata JSONB,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- api_keys: Securely store per-tenant API keys (Future Phase 14+)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    encrypted_key_value TEXT NOT NULL,
    encryption_key_id VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_valid BOOLEAN DEFAULT NULL,
    last_validated_at TIMESTAMP,
    validation_error TEXT,
    last_used_at TIMESTAMP,
    usage_count BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    UNIQUE(tenant_id, provider, key_name)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- budgets indexes
CREATE INDEX IF NOT EXISTS idx_budgets_tenant_month
    ON budgets(tenant_id, year_month DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_current_month
    ON budgets(year_month DESC) WHERE breached = FALSE;

-- spending_log indexes
CREATE INDEX IF NOT EXISTS idx_spending_log_provider
    ON spending_log(budget_id, provider);
CREATE INDEX IF NOT EXISTS idx_spending_log_model
    ON spending_log(budget_id, model);
CREATE INDEX IF NOT EXISTS idx_spending_log_time
    ON spending_log(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_spending_log_trace
    ON spending_log(trace_id) WHERE trace_id IS NOT NULL;

-- audit_events indexes
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant
    ON audit_events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_type
    ON audit_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_category
    ON audit_events(event_category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity
    ON audit_events(severity, timestamp DESC)
    WHERE severity IN ('error', 'critical');
CREATE INDEX IF NOT EXISTS idx_audit_events_trace
    ON audit_events(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_metadata
    ON audit_events USING GIN (metadata);

-- api_keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_provider
    ON api_keys(tenant_id, provider) WHERE is_active = TRUE;

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Insert default policy for backward compatibility
INSERT INTO policy_settings (tenant_id, max_monthly_cost_usd, enable_budget_limit,
                              max_tokens_per_request, enable_token_limit,
                              enable_benchmark_fallback, validate_keys_on_startup,
                              fail_fast_on_invalid_key, test_mode)
VALUES ('default', 5.0, TRUE, 1024, TRUE, TRUE, TRUE, TRUE, FALSE)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get or create budget for current month
CREATE OR REPLACE FUNCTION get_or_create_budget(
    p_tenant_id VARCHAR(255),
    p_budget_limit_usd DECIMAL(12, 4)
) RETURNS UUID AS $$
DECLARE
    v_budget_id UUID;
    v_current_month VARCHAR(7);
BEGIN
    v_current_month := TO_CHAR(NOW(), 'YYYY-MM');

    SELECT id INTO v_budget_id
    FROM budgets
    WHERE tenant_id = p_tenant_id AND year_month = v_current_month;

    IF v_budget_id IS NULL THEN
        INSERT INTO budgets (tenant_id, year_month, budget_limit_usd)
        VALUES (p_tenant_id, v_current_month, p_budget_limit_usd)
        RETURNING id INTO v_budget_id;
    END IF;

    RETURN v_budget_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Record spending transaction
CREATE OR REPLACE FUNCTION record_spending(
    p_tenant_id VARCHAR(255),
    p_provider VARCHAR(50),
    p_model VARCHAR(100),
    p_cost_usd DECIMAL(12, 6),
    p_tokens_input INTEGER DEFAULT NULL,
    p_tokens_output INTEGER DEFAULT NULL,
    p_request_id VARCHAR(255) DEFAULT NULL,
    p_trace_id VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_budget_id UUID;
    v_spending_id UUID;
    v_new_total DECIMAL(12, 4);
    v_budget_limit DECIMAL(12, 4);
BEGIN
    SELECT id, budget_limit_usd INTO v_budget_id, v_budget_limit
    FROM budgets
    WHERE tenant_id = p_tenant_id
      AND year_month = TO_CHAR(NOW(), 'YYYY-MM');

    IF v_budget_id IS NULL THEN
        RAISE EXCEPTION 'Budget not found for tenant %', p_tenant_id;
    END IF;

    INSERT INTO spending_log (
        budget_id, tenant_id, provider, model, cost_usd,
        tokens_input, tokens_output, request_id, trace_id
    ) VALUES (
        v_budget_id, p_tenant_id, p_provider, p_model, p_cost_usd,
        p_tokens_input, p_tokens_output, p_request_id, p_trace_id
    ) RETURNING id INTO v_spending_id;

    UPDATE budgets
    SET total_spend_usd = total_spend_usd + p_cost_usd,
        request_count = request_count + 1,
        updated_at = NOW()
    WHERE id = v_budget_id
    RETURNING total_spend_usd INTO v_new_total;

    IF v_new_total >= v_budget_limit THEN
        UPDATE budgets
        SET breached = TRUE,
            breached_at = COALESCE(breached_at, NOW()),
            first_breach_time = COALESCE(first_breach_time, NOW())
        WHERE id = v_budget_id AND breached = FALSE;
    END IF;

    RETURN v_spending_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Log audit event
CREATE OR REPLACE FUNCTION log_audit_event(
    p_tenant_id VARCHAR(255),
    p_event_type VARCHAR(50),
    p_event_category VARCHAR(50),
    p_severity VARCHAR(20),
    p_provider VARCHAR(50) DEFAULT NULL,
    p_model VARCHAR(100) DEFAULT NULL,
    p_action VARCHAR(50) DEFAULT NULL,
    p_cost_usd DECIMAL(12, 6) DEFAULT NULL,
    p_trace_id VARCHAR(255) DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO audit_events (
        tenant_id, event_type, event_category, severity,
        provider, model, action, cost_usd, trace_id,
        metadata, error_message
    ) VALUES (
        p_tenant_id, p_event_type, p_event_category, p_severity,
        p_provider, p_model, p_action, p_cost_usd, p_trace_id,
        p_metadata, p_error_message
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_settings_updated_at
    BEFORE UPDATE ON policy_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_current_month_spending AS
SELECT
    b.tenant_id,
    b.year_month,
    b.total_spend_usd,
    b.budget_limit_usd,
    ROUND((b.total_spend_usd / NULLIF(b.budget_limit_usd, 0)) * 100, 2) AS budget_percentage_used,
    b.request_count,
    b.breached,
    b.breached_at,
    COUNT(DISTINCT sl.provider) AS provider_count,
    COUNT(DISTINCT sl.model) AS model_count
FROM budgets b
LEFT JOIN spending_log sl ON b.id = sl.budget_id
WHERE b.year_month = TO_CHAR(NOW(), 'YYYY-MM')
GROUP BY b.tenant_id, b.year_month, b.total_spend_usd, b.budget_limit_usd,
         b.request_count, b.breached, b.breached_at;

CREATE OR REPLACE VIEW v_cost_by_provider AS
SELECT
    sl.tenant_id,
    b.year_month,
    sl.provider,
    SUM(sl.cost_usd) AS total_cost_usd,
    COUNT(*) AS request_count,
    AVG(sl.cost_usd) AS avg_cost_per_request,
    SUM(sl.tokens_input) AS total_input_tokens,
    SUM(sl.tokens_output) AS total_output_tokens
FROM spending_log sl
JOIN budgets b ON sl.budget_id = b.id
WHERE b.year_month = TO_CHAR(NOW(), 'YYYY-MM')
GROUP BY sl.tenant_id, b.year_month, sl.provider;

CREATE OR REPLACE VIEW v_cost_by_model AS
SELECT
    sl.tenant_id,
    b.year_month,
    sl.model,
    sl.provider,
    SUM(sl.cost_usd) AS total_cost_usd,
    COUNT(*) AS request_count,
    AVG(sl.cost_usd) AS avg_cost_per_request,
    SUM(sl.tokens_input) AS total_input_tokens,
    SUM(sl.tokens_output) AS total_output_tokens
FROM spending_log sl
JOIN budgets b ON sl.budget_id = b.id
WHERE b.year_month = TO_CHAR(NOW(), 'YYYY-MM')
GROUP BY sl.tenant_id, b.year_month, sl.model, sl.provider;

CREATE OR REPLACE VIEW v_recent_audit_events AS
SELECT
    tenant_id,
    event_type,
    event_category,
    severity,
    provider,
    model,
    action,
    cost_usd,
    trace_id,
    timestamp
FROM audit_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

COMMIT;
