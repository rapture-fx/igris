-- Migration: 005_create_routing_telemetry
-- Description: Universal Routing Layer Telemetry
-- Purpose: Track every routed request for cost, performance, and intelligence
-- Author: Schlep-Engine Team
-- Date: 2025-11-05

-- ============================================================================
-- 1. ROUTING TELEMETRY TABLE
-- ============================================================================
-- Captures every routed inference request with detailed metrics
CREATE TABLE IF NOT EXISTS routing_telemetry (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trace_id UUID NOT NULL,

    -- Provider Information
    provider_id UUID REFERENCES provider_registry(id) ON DELETE SET NULL,
    provider_name VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,

    -- Request Metrics
    latency_ms INTEGER NOT NULL,
    tokens_in INTEGER,
    tokens_out INTEGER,
    total_tokens INTEGER,

    -- Outcome
    success BOOLEAN NOT NULL,
    status_code INTEGER,
    error_message TEXT,

    -- Cost Estimation
    cost_usd DECIMAL(10, 6),

    -- Provider Selection Metadata
    fallback_count INTEGER DEFAULT 0,  -- How many providers failed before success
    selection_reason VARCHAR(50),      -- 'health', 'preference', 'fallback', 'random'

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Indexes inline
    CONSTRAINT valid_latency CHECK (latency_ms >= 0),
    CONSTRAINT valid_tokens CHECK (
        (tokens_in IS NULL OR tokens_in >= 0) AND
        (tokens_out IS NULL OR tokens_out >= 0)
    )
);

-- ============================================================================
-- 2. INDEXES FOR QUERY PERFORMANCE
-- ============================================================================

-- Tenant-based queries
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_tenant_id
    ON routing_telemetry(tenant_id, created_at DESC);

-- Provider-based analytics
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_provider_id
    ON routing_telemetry(provider_id, created_at DESC)
    WHERE provider_id IS NOT NULL;

-- Provider name analytics (for when provider is deleted)
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_provider_name
    ON routing_telemetry(provider_name, created_at DESC);

-- Success/failure analysis
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_success
    ON routing_telemetry(provider_id, success, created_at DESC)
    WHERE provider_id IS NOT NULL;

-- Trace ID lookup
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_trace_id
    ON routing_telemetry(trace_id);

-- Time-series analytics (partitioning-friendly)
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_created_at
    ON routing_telemetry(created_at DESC);

-- Model-based queries
CREATE INDEX IF NOT EXISTS idx_routing_telemetry_model
    ON routing_telemetry(model, created_at DESC);

-- ============================================================================
-- 3. PROVIDER PERFORMANCE AGGREGATES TABLE
-- ============================================================================
-- Pre-computed aggregates updated every 10 minutes by background job
CREATE TABLE IF NOT EXISTS provider_performance_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES provider_registry(id) ON DELETE CASCADE,

    -- Time window
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Aggregate Metrics
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    failed_requests INTEGER NOT NULL DEFAULT 0,
    success_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.0,  -- Percentage

    -- Latency Statistics
    avg_latency_ms INTEGER,
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    max_latency_ms INTEGER,

    -- Token Statistics
    total_tokens_in BIGINT DEFAULT 0,
    total_tokens_out BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,

    -- Cost Statistics
    total_cost_usd DECIMAL(12, 6) DEFAULT 0.0,
    avg_cost_per_request_usd DECIMAL(10, 6),

    -- Status
    is_degraded BOOLEAN DEFAULT false,  -- true if success_rate < 80% or avg_latency > 5s

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_window CHECK (window_end > window_start),
    CONSTRAINT valid_success_rate CHECK (success_rate >= 0 AND success_rate <= 100),
    CONSTRAINT unique_provider_window UNIQUE (provider_id, window_start, window_end)
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_provider_perf_agg_provider_window
    ON provider_performance_aggregates(provider_id, window_end DESC);

-- Index for degraded provider detection
CREATE INDEX IF NOT EXISTS idx_provider_perf_agg_degraded
    ON provider_performance_aggregates(is_degraded, window_end DESC)
    WHERE is_degraded = true;

-- ============================================================================
-- 4. ROUTING DECISIONS LOG TABLE (Optional, for debugging)
-- ============================================================================
-- Captures the decision-making process for each route
CREATE TABLE IF NOT EXISTS routing_decisions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Decision Context
    requested_model VARCHAR(255),
    provider_preference JSONB,  -- Array of preferred providers

    -- Available Providers at Decision Time
    available_providers JSONB,  -- Array of {name, health_score, latency_ms}

    -- Selected Provider
    selected_provider_id UUID REFERENCES provider_registry(id) ON DELETE SET NULL,
    selected_provider_name VARCHAR(255),
    selection_reason VARCHAR(50),

    -- Outcome
    final_success BOOLEAN,
    fallback_chain JSONB,  -- Array of providers attempted in order

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for trace-based debugging
CREATE INDEX IF NOT EXISTS idx_routing_decisions_trace_id
    ON routing_decisions_log(trace_id);

-- Index for tenant analytics
CREATE INDEX IF NOT EXISTS idx_routing_decisions_tenant_id
    ON routing_decisions_log(tenant_id, created_at DESC);

-- ============================================================================
-- 5. MATERIALIZED VIEW FOR LIVE PROVIDER LEADERBOARD
-- ============================================================================
-- Fast access to current provider rankings
CREATE MATERIALIZED VIEW IF NOT EXISTS provider_leaderboard AS
SELECT
    pr.id as provider_id,
    pr.name as provider_name,
    pr.tenant_id,
    pr.status,
    pr.is_verified,
    pr.compatibility_class,

    -- Health Metrics (from provider_registry)
    (pr.health->>'latency_ms')::INTEGER as current_latency_ms,
    (pr.health->>'uptime_percent')::DECIMAL(5,2) as uptime_percent,
    (pr.health->>'consecutive_failures')::INTEGER as consecutive_failures,

    -- Recent Performance (last 24 hours)
    COUNT(rt.id) as requests_24h,
    COUNT(rt.id) FILTER (WHERE rt.success = true) as successful_requests_24h,
    ROUND(AVG(rt.latency_ms) FILTER (WHERE rt.success = true)) as avg_latency_24h,
    SUM(rt.cost_usd) as total_cost_24h,

    -- Overall Score (weighted: 40% success rate, 30% latency, 30% uptime)
    ROUND(
        (COUNT(rt.id) FILTER (WHERE rt.success = true)::DECIMAL / NULLIF(COUNT(rt.id), 0) * 40) +
        (CASE
            WHEN AVG(rt.latency_ms) FILTER (WHERE rt.success = true) < 500 THEN 30
            WHEN AVG(rt.latency_ms) FILTER (WHERE rt.success = true) < 1000 THEN 20
            WHEN AVG(rt.latency_ms) FILTER (WHERE rt.success = true) < 2000 THEN 10
            ELSE 0
        END) +
        ((pr.health->>'uptime_percent')::DECIMAL * 0.3)
    , 2) as health_score

FROM provider_registry pr
LEFT JOIN routing_telemetry rt ON rt.provider_id = pr.id
    AND rt.created_at > NOW() - INTERVAL '24 hours'
GROUP BY pr.id, pr.name, pr.tenant_id, pr.status, pr.is_verified,
         pr.compatibility_class, pr.health
ORDER BY health_score DESC;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_leaderboard_provider_id
    ON provider_leaderboard(provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_leaderboard_tenant_health
    ON provider_leaderboard(tenant_id, health_score DESC);

-- ============================================================================
-- 6. FUNCTION TO REFRESH LEADERBOARD
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_provider_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY provider_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNCTION TO RECORD ROUTING TELEMETRY (Stored Procedure)
-- ============================================================================
CREATE OR REPLACE FUNCTION record_routing_telemetry(
    p_tenant_id UUID,
    p_trace_id UUID,
    p_provider_id UUID,
    p_provider_name VARCHAR,
    p_model VARCHAR,
    p_latency_ms INTEGER,
    p_tokens_in INTEGER,
    p_tokens_out INTEGER,
    p_success BOOLEAN,
    p_status_code INTEGER,
    p_error_message TEXT,
    p_cost_usd DECIMAL,
    p_fallback_count INTEGER,
    p_selection_reason VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_telemetry_id UUID;
    v_total_tokens INTEGER;
BEGIN
    -- Calculate total tokens
    v_total_tokens := COALESCE(p_tokens_in, 0) + COALESCE(p_tokens_out, 0);

    -- Insert telemetry record
    INSERT INTO routing_telemetry (
        tenant_id, trace_id, provider_id, provider_name, model,
        latency_ms, tokens_in, tokens_out, total_tokens,
        success, status_code, error_message, cost_usd,
        fallback_count, selection_reason
    ) VALUES (
        p_tenant_id, p_trace_id, p_provider_id, p_provider_name, p_model,
        p_latency_ms, p_tokens_in, p_tokens_out, v_total_tokens,
        p_success, p_status_code, p_error_message, p_cost_usd,
        p_fallback_count, p_selection_reason
    ) RETURNING id INTO v_telemetry_id;

    -- Update provider health if provider_id is present
    IF p_provider_id IS NOT NULL THEN
        -- Update health metrics in provider_registry
        UPDATE provider_registry
        SET health = jsonb_set(
            jsonb_set(
                health,
                '{latency_ms}',
                to_jsonb(p_latency_ms)
            ),
            CASE WHEN p_success
                THEN '{last_success}'
                ELSE '{last_failure}'
            END,
            to_jsonb(NOW())
        )
        WHERE id = p_provider_id;
    END IF;

    RETURN v_telemetry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE routing_telemetry IS
    'Captures every routed inference request with detailed metrics for cost, performance, and intelligence.';

COMMENT ON TABLE provider_performance_aggregates IS
    'Pre-computed provider performance metrics aggregated every 10 minutes by background job.';

COMMENT ON TABLE routing_decisions_log IS
    'Debugging log for routing decision-making process. Useful for understanding why a provider was selected.';

COMMENT ON MATERIALIZED VIEW provider_leaderboard IS
    'Fast access to current provider rankings based on health score, latency, and success rate.';

COMMENT ON FUNCTION record_routing_telemetry IS
    'Stored procedure to efficiently record routing telemetry and update provider health metrics.';

-- ============================================================================
-- 9. INITIAL DATA WARMUP
-- ============================================================================
-- Refresh the leaderboard for the first time
SELECT refresh_provider_leaderboard();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Rollback instructions:
-- DROP MATERIALIZED VIEW IF EXISTS provider_leaderboard CASCADE;
-- DROP TABLE IF EXISTS routing_decisions_log CASCADE;
-- DROP TABLE IF EXISTS provider_performance_aggregates CASCADE;
-- DROP TABLE IF EXISTS routing_telemetry CASCADE;
-- DROP FUNCTION IF EXISTS refresh_provider_leaderboard CASCADE;
-- DROP FUNCTION IF EXISTS record_routing_telemetry CASCADE;
