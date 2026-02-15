-- ============================================================================
-- IGRIS INERTIAL PHASE 13: PERSISTENCE AND MULTI-TENANCY DATABASE SCHEMA
-- ============================================================================
-- Version: 1.0.0
-- Purpose: Enable persistent budget tracking, policy storage, and audit logging
--          for multi-tenant production deployment
-- ============================================================================

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: budgets
-- Purpose: Track monthly spending budgets per tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    year_month VARCHAR(7) NOT NULL,  -- Format: "2025-10"
    total_spend_usd DECIMAL(12, 4) NOT NULL DEFAULT 0.0,
    request_count BIGINT NOT NULL DEFAULT 0,
    budget_limit_usd DECIMAL(12, 4) NOT NULL,
    breached BOOLEAN DEFAULT FALSE,
    breached_at TIMESTAMP,
    first_breach_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Ensure one record per tenant per month
    UNIQUE(tenant_id, year_month)
);

-- Index for fast lookups by tenant and month
CREATE INDEX IF NOT EXISTS idx_budgets_tenant_month
    ON budgets(tenant_id, year_month DESC);

-- Index for finding all active budgets in current month
CREATE INDEX IF NOT EXISTS idx_budgets_current_month
    ON budgets(year_month DESC) WHERE breached = FALSE;

-- ============================================================================
-- TABLE: spending_log
-- Purpose: Detailed cost breakdown by provider and model
-- ============================================================================
CREATE TABLE IF NOT EXISTS spending_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    provider VARCHAR(50) NOT NULL,  -- "openai", "anthropic", "benchmark"
    model VARCHAR(100) NOT NULL,     -- "gpt-4", "claude-3-opus", etc.
    cost_usd DECIMAL(12, 6) NOT NULL,
    tokens_input INTEGER,
    tokens_output INTEGER,
    request_id VARCHAR(255),
    trace_id VARCHAR(255),
    recorded_at TIMESTAMP DEFAULT NOW(),

    -- Foreign key to budget table
    CONSTRAINT fk_budget FOREIGN KEY (budget_id)
        REFERENCES budgets(id) ON DELETE CASCADE
);

-- Index for aggregating costs by provider
CREATE INDEX IF NOT EXISTS idx_spending_log_provider
    ON spending_log(budget_id, provider);

-- Index for aggregating costs by model
CREATE INDEX IF NOT EXISTS idx_spending_log_model
    ON spending_log(budget_id, model);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_spending_log_time
    ON spending_log(recorded_at DESC);

-- Index for trace lookups
CREATE INDEX IF NOT EXISTS idx_spending_log_trace
    ON spending_log(trace_id) WHERE trace_id IS NOT NULL;

-- ============================================================================
-- TABLE: policy_settings
-- Purpose: Store safety policy configuration per tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS policy_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE DEFAULT 'default',

    -- Budget policies
    max_monthly_cost_usd DECIMAL(12, 4) DEFAULT 5.0,
    enable_budget_limit BOOLEAN DEFAULT TRUE,
    fallback_on_budget_breach BOOLEAN DEFAULT TRUE,

    -- Token policies
    max_tokens_per_request INTEGER DEFAULT 1024,
    enable_token_limit BOOLEAN DEFAULT TRUE,

    -- Benchmark fallback policies
    enable_benchmark_fallback BOOLEAN DEFAULT TRUE,

    -- Key validation policies
    validate_keys_on_startup BOOLEAN DEFAULT TRUE,
    fail_fast_on_invalid_key BOOLEAN DEFAULT TRUE,

    -- Test mode (sandbox environment)
    test_mode BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Default policy for backward compatibility
INSERT INTO policy_settings (tenant_id, max_monthly_cost_usd, enable_budget_limit,
                              max_tokens_per_request, enable_token_limit,
                              enable_benchmark_fallback, validate_keys_on_startup,
                              fail_fast_on_invalid_key, test_mode)
VALUES ('default', 5.0, TRUE, 1024, TRUE, TRUE, TRUE, TRUE, FALSE)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- TABLE: audit_events
-- Purpose: Store all safety-related events for compliance and debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    event_type VARCHAR(50) NOT NULL,  -- "budget_check", "budget_breach", "token_limit",
                                       -- "key_validation", "fallback_triggered", etc.
    event_category VARCHAR(50) NOT NULL, -- "budget", "token", "key", "fallback"
    severity VARCHAR(20) NOT NULL,    -- "info", "warning", "error", "critical"

    -- Event details
    provider VARCHAR(50),
    model VARCHAR(100),
    action VARCHAR(50),               -- "allowed", "rejected", "truncated", "fallback"

    -- Cost and token information
    cost_usd DECIMAL(12, 6),
    tokens_requested INTEGER,
    tokens_allowed INTEGER,

    -- Request context
    request_id VARCHAR(255),
    trace_id VARCHAR(255),

    -- Additional metadata as JSON
    metadata JSONB,

    -- Error information
    error_message TEXT,

    -- Timestamp
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Index for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant
    ON audit_events(tenant_id, timestamp DESC);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_audit_events_type
    ON audit_events(event_type, timestamp DESC);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_audit_events_category
    ON audit_events(event_category, timestamp DESC);

-- Index for severity-based alerting
CREATE INDEX IF NOT EXISTS idx_audit_events_severity
    ON audit_events(severity, timestamp DESC)
    WHERE severity IN ('error', 'critical');

-- Index for trace correlation
CREATE INDEX IF NOT EXISTS idx_audit_events_trace
    ON audit_events(trace_id) WHERE trace_id IS NOT NULL;

-- GIN index for JSON metadata queries
CREATE INDEX IF NOT EXISTS idx_audit_events_metadata
    ON audit_events USING GIN (metadata);

-- ============================================================================
-- TABLE: api_keys (Future: Multi-tenant BYOK support)
-- Purpose: Securely store per-tenant API keys for BYOK scenarios
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,   -- "openai", "anthropic"
    key_name VARCHAR(100) NOT NULL,  -- User-friendly name

    -- Encrypted key storage (use application-level encryption)
    encrypted_key_value TEXT NOT NULL,
    encryption_key_id VARCHAR(255) NOT NULL,  -- Reference to KMS key or similar

    -- Key metadata
    is_active BOOLEAN DEFAULT TRUE,
    is_valid BOOLEAN DEFAULT NULL,   -- NULL = not validated, TRUE = valid, FALSE = invalid
    last_validated_at TIMESTAMP,
    validation_error TEXT,

    -- Usage tracking
    last_used_at TIMESTAMP,
    usage_count BIGINT DEFAULT 0,

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),

    -- Ensure unique keys per tenant per provider
    UNIQUE(tenant_id, provider, key_name)
);

-- Index for active key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_provider
    ON api_keys(tenant_id, provider) WHERE is_active = TRUE;

-- ============================================================================
-- VIEWS: Aggregated reporting views
-- ============================================================================

-- View: Current month spending summary by tenant
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

-- View: Cost breakdown by provider (current month)
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

-- View: Cost breakdown by model (current month)
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

-- View: Recent audit events (last 24 hours)
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

-- ============================================================================
-- FUNCTIONS: Helper functions for common operations
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

    -- Try to get existing budget
    SELECT id INTO v_budget_id
    FROM budgets
    WHERE tenant_id = p_tenant_id AND year_month = v_current_month;

    -- Create if doesn't exist
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
    -- Get current budget (creates if needed)
    SELECT id, budget_limit_usd INTO v_budget_id, v_budget_limit
    FROM budgets
    WHERE tenant_id = p_tenant_id
      AND year_month = TO_CHAR(NOW(), 'YYYY-MM');

    IF v_budget_id IS NULL THEN
        RAISE EXCEPTION 'Budget not found for tenant %', p_tenant_id;
    END IF;

    -- Insert spending log entry
    INSERT INTO spending_log (
        budget_id, tenant_id, provider, model, cost_usd,
        tokens_input, tokens_output, request_id, trace_id
    ) VALUES (
        v_budget_id, p_tenant_id, p_provider, p_model, p_cost_usd,
        p_tokens_input, p_tokens_output, p_request_id, p_trace_id
    ) RETURNING id INTO v_spending_id;

    -- Update budget totals
    UPDATE budgets
    SET total_spend_usd = total_spend_usd + p_cost_usd,
        request_count = request_count + 1,
        updated_at = NOW()
    WHERE id = v_budget_id
    RETURNING total_spend_usd INTO v_new_total;

    -- Check for budget breach
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
-- TRIGGERS: Automatic timestamp updates
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
-- COMMENTS: Documentation for database objects
-- ============================================================================

COMMENT ON TABLE budgets IS 'Monthly budget tracking per tenant with breach detection';
COMMENT ON TABLE spending_log IS 'Detailed transaction log of all API costs by provider and model';
COMMENT ON TABLE policy_settings IS 'Safety policy configuration per tenant';
COMMENT ON TABLE audit_events IS 'Comprehensive audit trail for compliance and debugging';
COMMENT ON TABLE api_keys IS 'Encrypted tenant API keys for BYOK support (Phase 14+)';

COMMENT ON FUNCTION get_or_create_budget IS 'Atomic operation to retrieve or create current month budget';
COMMENT ON FUNCTION record_spending IS 'Transactional spending recording with automatic breach detection';
COMMENT ON FUNCTION log_audit_event IS 'Standardized audit event logging with optional metadata';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
