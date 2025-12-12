-- Migration: Shadow Mode Comparison Metrics and Winner Detection
-- Purpose: Enable detailed tracking of shadow vs production optimizer comparisons
-- Related Feature: Zero-Risk Rollouts (Shadow Mode) - Priority 2

-- ============================================================================
-- Table: shadow_comparisons
-- Description: Stores detailed comparison data between Go and Rust optimizers
-- ============================================================================

CREATE TABLE IF NOT EXISTS shadow_comparisons (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    trace_id VARCHAR(255) NOT NULL,

    -- Timing
    timestamp TIMESTAMP DEFAULT NOW(),

    -- Provider decisions
    go_provider VARCHAR(255),
    rust_provider VARCHAR(255),
    agreement BOOLEAN GENERATED ALWAYS AS (go_provider = rust_provider) STORED,

    -- Latency metrics (milliseconds)
    go_latency_ms INT,
    rust_latency_ms INT,
    latency_delta_ms INT GENERATED ALWAYS AS (rust_latency_ms - go_latency_ms) STORED,
    latency_delta_pct FLOAT,

    -- Cost metrics (USD)
    go_cost_usd DECIMAL(10,6),
    rust_cost_usd DECIMAL(10,6),
    cost_delta_usd DECIMAL(10,6) GENERATED ALWAYS AS (rust_cost_usd - go_cost_usd) STORED,
    cost_delta_pct FLOAT,

    -- Quality scores (0.0 - 1.0)
    go_quality_score FLOAT CHECK (go_quality_score IS NULL OR (go_quality_score >= 0 AND go_quality_score <= 1)),
    rust_quality_score FLOAT CHECK (rust_quality_score IS NULL OR (rust_quality_score >= 0 AND rust_quality_score <= 1)),
    quality_delta FLOAT,

    -- Error tracking
    go_error TEXT,
    rust_error TEXT,
    go_success BOOLEAN GENERATED ALWAYS AS (go_error IS NULL) STORED,
    rust_success BOOLEAN GENERATED ALWAYS AS (rust_error IS NULL) STORED,

    -- Thompson Sampling details
    go_thompson_alpha FLOAT,
    go_thompson_beta FLOAT,
    rust_thompson_alpha FLOAT,
    rust_thompson_beta FLOAT,

    -- Metadata
    semantic_class VARCHAR(255),
    prompt_tokens INT,
    completion_tokens INT,

    -- Indexes will be added below
    CONSTRAINT shadow_comparisons_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for efficient querying
-- ============================================================================

-- Composite index for tenant + time range queries (most common)
CREATE INDEX idx_shadow_tenant_time
ON shadow_comparisons(tenant_id, timestamp DESC);

-- Index for agreement rate analysis
CREATE INDEX idx_shadow_agreement
ON shadow_comparisons(agreement, timestamp DESC);

-- Index for finding disagreements (for investigation)
CREATE INDEX idx_shadow_disagreement
ON shadow_comparisons(timestamp DESC)
WHERE agreement = FALSE;

-- Index for error analysis
CREATE INDEX idx_shadow_errors
ON shadow_comparisons(timestamp DESC)
WHERE go_error IS NOT NULL OR rust_error IS NOT NULL;

-- Index for trace_id lookups (for debugging specific requests)
CREATE INDEX idx_shadow_trace_id
ON shadow_comparisons(trace_id);

-- Index for semantic class analysis
CREATE INDEX idx_shadow_semantic_class
ON shadow_comparisons(semantic_class, timestamp DESC);

-- Partial index for successful comparisons only (for winner detection)
CREATE INDEX idx_shadow_successful_comparisons
ON shadow_comparisons(tenant_id, timestamp DESC)
WHERE go_success = TRUE AND rust_success = TRUE;

-- ============================================================================
-- Table: tenant_shadow_config
-- Description: Per-tenant shadow mode configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_shadow_config (
    tenant_id VARCHAR(255) PRIMARY KEY,

    -- Shadow mode state
    enabled BOOLEAN DEFAULT FALSE,
    mode VARCHAR(50) DEFAULT 'shadow' CHECK (mode IN ('disabled', 'shadow', 'go', 'rust')),

    -- Sampling configuration
    sample_rate FLOAT DEFAULT 0.1 CHECK (sample_rate >= 0 AND sample_rate <= 1),
    max_parallel_shadows INT DEFAULT 100 CHECK (max_parallel_shadows > 0),

    -- Rollout state
    rollout_percentage FLOAT DEFAULT 0.0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 1),
    rollout_stage VARCHAR(50) DEFAULT 'none' CHECK (rollout_stage IN ('none', 'shadow', '25pct', '50pct', '100pct')),

    -- Winner detection thresholds
    min_samples INT DEFAULT 1000 CHECK (min_samples > 0),
    min_agreement_rate FLOAT DEFAULT 0.95 CHECK (min_agreement_rate >= 0 AND min_agreement_rate <= 1),
    max_latency_delta_pct FLOAT DEFAULT 0.05 CHECK (max_latency_delta_pct >= 0),
    max_cost_delta_pct FLOAT DEFAULT 0.10 CHECK (max_cost_delta_pct >= 0),
    max_error_rate_delta FLOAT DEFAULT 0.01 CHECK (max_error_rate_delta >= 0),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_rollout_at TIMESTAMP,

    -- Audit
    updated_by VARCHAR(255),

    CONSTRAINT tenant_shadow_config_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Index for active shadow mode tenants
CREATE INDEX idx_shadow_config_active
ON tenant_shadow_config(enabled, sample_rate)
WHERE enabled = TRUE;

-- ============================================================================
-- Table: shadow_rollout_history
-- Description: Track rollout events and rollbacks for audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS shadow_rollout_history (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,

    -- Event details
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('start_shadow', 'promote_25', 'promote_50', 'promote_100', 'rollback', 'pause')),
    from_stage VARCHAR(50),
    to_stage VARCHAR(50),

    -- Decision metrics at time of event
    agreement_rate FLOAT,
    latency_improvement_pct FLOAT,
    cost_savings_pct FLOAT,
    error_rate_delta FLOAT,
    sample_count INT,

    -- Decision metadata
    decision_confidence FLOAT CHECK (decision_confidence IS NULL OR (decision_confidence >= 0 AND decision_confidence <= 1)),
    decision_reason TEXT,
    auto_detected BOOLEAN DEFAULT FALSE,

    -- Timing
    timestamp TIMESTAMP DEFAULT NOW(),
    initiated_by VARCHAR(255),

    CONSTRAINT shadow_rollout_history_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Index for tenant rollout history
CREATE INDEX idx_rollout_history_tenant
ON shadow_rollout_history(tenant_id, timestamp DESC);

-- ============================================================================
-- Materialized View: shadow_metrics_summary
-- Description: Aggregated metrics for winner detection (refreshed periodically)
-- ============================================================================

CREATE MATERIALIZED VIEW shadow_metrics_summary AS
SELECT
    tenant_id,

    -- Aggregate metrics
    COUNT(*) as total_comparisons,
    SUM(CASE WHEN agreement THEN 1 ELSE 0 END) as agreements,
    SUM(CASE WHEN agreement THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0) as agreement_rate,

    -- Latency metrics
    AVG(go_latency_ms) as avg_go_latency_ms,
    AVG(rust_latency_ms) as avg_rust_latency_ms,
    AVG(latency_delta_ms) as avg_latency_delta_ms,
    AVG(latency_delta_pct) as avg_latency_delta_pct,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_delta_ms) as p95_latency_delta_ms,

    -- Cost metrics
    AVG(go_cost_usd) as avg_go_cost_usd,
    AVG(rust_cost_usd) as avg_rust_cost_usd,
    AVG(cost_delta_usd) as avg_cost_delta_usd,
    AVG(cost_delta_pct) as avg_cost_delta_pct,

    -- Error rates
    SUM(CASE WHEN NOT go_success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0) as go_error_rate,
    SUM(CASE WHEN NOT rust_success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0) as rust_error_rate,
    (SUM(CASE WHEN NOT rust_success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0)) -
    (SUM(CASE WHEN NOT go_success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0)) as error_rate_delta,

    -- Quality metrics
    AVG(go_quality_score) as avg_go_quality,
    AVG(rust_quality_score) as avg_rust_quality,
    AVG(quality_delta) as avg_quality_delta,

    -- Statistical significance (p-value approximation)
    -- Using t-test approximation for latency difference
    CASE
        WHEN COUNT(*) >= 30 THEN
            2 * (1 - normal_cdf(ABS(AVG(latency_delta_ms)) / NULLIF(STDDEV(latency_delta_ms) / SQRT(COUNT(*)), 0)))
        ELSE NULL
    END as latency_p_value,

    -- Time window
    MIN(timestamp) as window_start,
    MAX(timestamp) as window_end,
    NOW() as last_refreshed

FROM shadow_comparisons
WHERE timestamp > NOW() - INTERVAL '7 days'  -- Last 7 days only
  AND go_success = TRUE
  AND rust_success = TRUE
GROUP BY tenant_id;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX idx_shadow_metrics_summary_tenant
ON shadow_metrics_summary(tenant_id);

-- ============================================================================
-- Helper function: normal_cdf approximation for statistical significance
-- ============================================================================

CREATE OR REPLACE FUNCTION normal_cdf(x FLOAT)
RETURNS FLOAT AS $$
BEGIN
    -- Approximation of standard normal CDF using error function
    RETURN 0.5 * (1 + erf(x / SQRT(2)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION erf(x FLOAT)
RETURNS FLOAT AS $$
DECLARE
    -- Constants for approximation
    a1 FLOAT := 0.254829592;
    a2 FLOAT := -0.284496736;
    a3 FLOAT := 1.421413741;
    a4 FLOAT := -1.453152027;
    a5 FLOAT := 1.061405429;
    p FLOAT := 0.3275911;
    t FLOAT;
    y FLOAT;
BEGIN
    t := 1.0 / (1.0 + p * ABS(x));
    y := 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * EXP(-x * x);

    IF x < 0 THEN
        RETURN -y;
    ELSE
        RETURN y;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Helper function: Check if tenant ready for rollout
-- ============================================================================

CREATE OR REPLACE FUNCTION check_shadow_rollout_readiness(p_tenant_id VARCHAR(255))
RETURNS TABLE(
    ready BOOLEAN,
    reason TEXT,
    agreement_rate FLOAT,
    latency_delta_pct FLOAT,
    cost_delta_pct FLOAT,
    error_rate_delta FLOAT,
    sample_count BIGINT
) AS $$
DECLARE
    v_config RECORD;
    v_metrics RECORD;
BEGIN
    -- Get tenant config
    SELECT * INTO v_config FROM tenant_shadow_config WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Shadow mode not configured', NULL::FLOAT, NULL::FLOAT, NULL::FLOAT, NULL::FLOAT, NULL::BIGINT;
        RETURN;
    END IF;

    -- Get metrics
    SELECT * INTO v_metrics FROM shadow_metrics_summary WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'No shadow comparison data available', NULL::FLOAT, NULL::FLOAT, NULL::FLOAT, NULL::FLOAT, NULL::BIGINT;
        RETURN;
    END IF;

    -- Check thresholds
    IF v_metrics.total_comparisons < v_config.min_samples THEN
        RETURN QUERY SELECT
            FALSE,
            format('Insufficient samples: %s < %s', v_metrics.total_comparisons, v_config.min_samples),
            v_metrics.agreement_rate,
            v_metrics.avg_latency_delta_pct,
            v_metrics.avg_cost_delta_pct,
            v_metrics.error_rate_delta,
            v_metrics.total_comparisons;
        RETURN;
    END IF;

    IF v_metrics.agreement_rate < v_config.min_agreement_rate THEN
        RETURN QUERY SELECT
            FALSE,
            format('Low agreement rate: %.2f%% < %.2f%%', v_metrics.agreement_rate * 100, v_config.min_agreement_rate * 100),
            v_metrics.agreement_rate,
            v_metrics.avg_latency_delta_pct,
            v_metrics.avg_cost_delta_pct,
            v_metrics.error_rate_delta,
            v_metrics.total_comparisons;
        RETURN;
    END IF;

    IF ABS(v_metrics.avg_latency_delta_pct) > v_config.max_latency_delta_pct THEN
        RETURN QUERY SELECT
            FALSE,
            format('Latency delta too high: %.2f%% > %.2f%%', ABS(v_metrics.avg_latency_delta_pct) * 100, v_config.max_latency_delta_pct * 100),
            v_metrics.agreement_rate,
            v_metrics.avg_latency_delta_pct,
            v_metrics.avg_cost_delta_pct,
            v_metrics.error_rate_delta,
            v_metrics.total_comparisons;
        RETURN;
    END IF;

    IF ABS(v_metrics.avg_cost_delta_pct) > v_config.max_cost_delta_pct THEN
        RETURN QUERY SELECT
            FALSE,
            format('Cost delta too high: %.2f%% > %.2f%%', ABS(v_metrics.avg_cost_delta_pct) * 100, v_config.max_cost_delta_pct * 100),
            v_metrics.agreement_rate,
            v_metrics.avg_latency_delta_pct,
            v_metrics.avg_cost_delta_pct,
            v_metrics.error_rate_delta,
            v_metrics.total_comparisons;
        RETURN;
    END IF;

    IF v_metrics.error_rate_delta > v_config.max_error_rate_delta THEN
        RETURN QUERY SELECT
            FALSE,
            format('Error rate delta too high: %.2f%% > %.2f%%', v_metrics.error_rate_delta * 100, v_config.max_error_rate_delta * 100),
            v_metrics.agreement_rate,
            v_metrics.avg_latency_delta_pct,
            v_metrics.avg_cost_delta_pct,
            v_metrics.error_rate_delta,
            v_metrics.total_comparisons;
        RETURN;
    END IF;

    -- All checks passed
    RETURN QUERY SELECT
        TRUE,
        'Ready for rollout',
        v_metrics.agreement_rate,
        v_metrics.avg_latency_delta_pct,
        v_metrics.avg_cost_delta_pct,
        v_metrics.error_rate_delta,
        v_metrics.total_comparisons;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row-Level Security (RLS)
-- ============================================================================

ALTER TABLE shadow_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_shadow_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_rollout_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY shadow_comparisons_isolation_policy
ON shadow_comparisons FOR ALL
USING (tenant_id = current_setting('app.current_tenant', TRUE));

CREATE POLICY shadow_config_isolation_policy
ON tenant_shadow_config FOR ALL
USING (tenant_id = current_setting('app.current_tenant', TRUE));

CREATE POLICY shadow_history_isolation_policy
ON shadow_rollout_history FOR ALL
USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- ============================================================================
-- Scheduled refresh of materialized view (requires pg_cron extension)
-- ============================================================================

-- Note: Uncomment if pg_cron is available
-- SELECT cron.schedule('refresh-shadow-metrics', '*/5 * * * *',
--     'REFRESH MATERIALIZED VIEW CONCURRENTLY shadow_metrics_summary');

-- Alternative: Manual refresh function
CREATE OR REPLACE FUNCTION refresh_shadow_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shadow_metrics_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE shadow_comparisons IS
'Detailed comparison data between Go and Rust optimizer decisions for shadow mode analysis. Part of Zero-Risk Rollouts enhancement (v1.4).';

COMMENT ON TABLE tenant_shadow_config IS
'Per-tenant shadow mode configuration including sampling rates and winner detection thresholds.';

COMMENT ON TABLE shadow_rollout_history IS
'Audit trail of shadow mode rollout events (promotions, rollbacks, pauses).';

COMMENT ON MATERIALIZED VIEW shadow_metrics_summary IS
'Aggregated shadow mode metrics for winner detection. Refreshed every 5 minutes.';

-- ============================================================================
-- Migration complete
-- ============================================================================
