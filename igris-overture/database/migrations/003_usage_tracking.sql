-- Migration: 003_usage_tracking.sql
-- Purpose: Track cloud request usage for license quotas
-- Date: 2026-02-05

-- ============================================================================
-- USAGE LOG TABLE
-- ============================================================================

-- Tracks every cloud request for quota enforcement and analytics
CREATE TABLE IF NOT EXISTS usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,

    -- Request metadata
    request_type VARCHAR(50) NOT NULL, -- 'cloud' or 'edge'
    provider VARCHAR(50),               -- 'openai', 'anthropic', 'google', etc.
    model VARCHAR(100),                 -- 'gpt-4', 'claude-3-opus', etc.

    -- Token usage
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,

    -- Cost tracking (optional)
    cost_usd DECIMAL(12,6) DEFAULT 0,

    -- Timestamps
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Additional metadata (JSONB for flexibility)
    metadata JSONB
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Query usage by license and time range (most common query)
CREATE INDEX idx_usage_log_license_time ON usage_log(license_id, timestamp DESC);

-- Monthly aggregation queries
CREATE INDEX idx_usage_log_month ON usage_log(DATE_TRUNC('month', timestamp), license_id);

-- Provider-specific analytics
CREATE INDEX idx_usage_log_provider ON usage_log(provider, timestamp DESC);

-- Request type filtering
CREATE INDEX idx_usage_log_request_type ON usage_log(request_type, license_id);

-- ============================================================================
-- MONTHLY USAGE SUMMARY (Materialized View - Optional)
-- ============================================================================

-- Pre-aggregated monthly usage for faster quota checks
CREATE MATERIALIZED VIEW IF NOT EXISTS usage_monthly AS
SELECT
    license_id,
    DATE_TRUNC('month', timestamp) AS month,
    request_type,
    COUNT(*) AS request_count,
    SUM(tokens_input) AS total_tokens_input,
    SUM(tokens_output) AS total_tokens_output,
    SUM(cost_usd) AS total_cost_usd,
    MAX(timestamp) AS last_request_at
FROM usage_log
GROUP BY license_id, DATE_TRUNC('month', timestamp), request_type;

-- Index on materialized view
CREATE UNIQUE INDEX idx_usage_monthly_license_month ON usage_monthly(license_id, month, request_type);

-- Refresh materialized view function (called periodically)
-- Run this every hour or via cron job
-- REFRESH MATERIALIZED VIEW CONCURRENTLY usage_monthly;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current month cloud request count for a license
CREATE OR REPLACE FUNCTION get_monthly_cloud_requests(p_license_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM usage_log
    WHERE license_id = p_license_id
    AND request_type = 'cloud'
    AND timestamp >= DATE_TRUNC('month', NOW())
    AND timestamp < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
$$ LANGUAGE SQL STABLE;

-- Get current month cloud request count by provider
CREATE OR REPLACE FUNCTION get_monthly_requests_by_provider(p_license_id UUID)
RETURNS TABLE(provider VARCHAR(50), request_count BIGINT) AS $$
    SELECT provider, COUNT(*)
    FROM usage_log
    WHERE license_id = p_license_id
    AND request_type = 'cloud'
    AND timestamp >= DATE_TRUNC('month', NOW())
    AND timestamp < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    GROUP BY provider
    ORDER BY COUNT(*) DESC;
$$ LANGUAGE SQL STABLE;

-- Get usage percentage for license quota enforcement
CREATE OR REPLACE FUNCTION get_quota_usage_percentage(p_license_id UUID, p_quota_limit INTEGER)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    current_usage INTEGER;
    usage_percent DECIMAL(5,2);
BEGIN
    -- Get current month usage
    SELECT get_monthly_cloud_requests(p_license_id) INTO current_usage;

    -- Calculate percentage (handle unlimited quota as -1)
    IF p_quota_limit = -1 THEN
        RETURN 0.0; -- Unlimited
    ELSIF p_quota_limit = 0 THEN
        RETURN 100.0; -- No quota
    ELSE
        usage_percent := (current_usage::DECIMAL / p_quota_limit::DECIMAL) * 100;
        RETURN LEAST(usage_percent, 100.0);
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- CLEANUP / RETENTION POLICY
-- ============================================================================

-- Function to clean up old usage logs (run monthly)
-- Keeps detailed logs for 90 days, then deletes
CREATE OR REPLACE FUNCTION cleanup_old_usage_logs()
RETURNS INTEGER AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM usage_log
    WHERE timestamp < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS rows_deleted = ROW_COUNT;

    RAISE NOTICE 'Deleted % old usage log rows', rows_deleted;
    RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE QUERIES (for reference)
-- ============================================================================

-- Get current month usage for a license
-- SELECT get_monthly_cloud_requests('license-uuid-here');

-- Get usage breakdown by provider
-- SELECT * FROM get_monthly_requests_by_provider('license-uuid-here');

-- Get quota usage percentage
-- SELECT get_quota_usage_percentage('license-uuid-here', 500000);

-- Get daily usage trend for current month
-- SELECT DATE(timestamp) AS day, COUNT(*) AS requests
-- FROM usage_log
-- WHERE license_id = 'license-uuid-here'
-- AND timestamp >= DATE_TRUNC('month', NOW())
-- GROUP BY DATE(timestamp)
-- ORDER BY day;

-- Get top models used
-- SELECT model, COUNT(*) AS usage_count
-- FROM usage_log
-- WHERE license_id = 'license-uuid-here'
-- AND timestamp >= DATE_TRUNC('month', NOW())
-- GROUP BY model
-- ORDER BY usage_count DESC
-- LIMIT 10;

-- ============================================================================
-- NOTES
-- ============================================================================

-- Performance Considerations:
-- - usage_log table will grow quickly (millions of rows per month for busy tenants)
-- - Partitioning by month recommended for production (see migration 004_partitioning.sql)
-- - Materialized view should be refreshed hourly or via trigger
-- - Consider time-series database (TimescaleDB) for long-term analytics

-- Quota Enforcement:
-- - Call get_monthly_cloud_requests() before routing cloud requests
-- - Block request if usage >= quota (unless quota = -1 for unlimited)
-- - Cache result for 1 minute to reduce database load

-- Privacy & Compliance:
-- - usage_log does NOT store request/response content
-- - Only stores metadata: provider, model, token counts
-- - 90-day retention policy complies with most regulations
-- - Adjust retention based on requirements (GDPR, HIPAA, etc.)
