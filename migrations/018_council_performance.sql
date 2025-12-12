-- Migration: Council Mode Performance Tracking for Dynamic Chairman Selection
-- Purpose: Enable tracking of council mode performance metrics for weighted voting and dynamic chairman selection
-- Related Feature: Council Mode Enhancements (Priority 3 - included for completeness)

-- ============================================================================
-- Table: council_performance
-- Description: Tracks historical performance of providers in council mode
-- ============================================================================

CREATE TABLE IF NOT EXISTS council_performance (
    id BIGSERIAL PRIMARY KEY,
    provider_id VARCHAR(255) NOT NULL,
    semantic_class VARCHAR(255) NOT NULL,

    -- Council participation metrics
    total_councils INT DEFAULT 0 CHECK (total_councils >= 0),
    chairman_count INT DEFAULT 0 CHECK (chairman_count >= 0 AND chairman_count <= total_councils),
    voter_count INT DEFAULT 0 CHECK (voter_count >= 0 AND voter_count <= total_councils),
    response_count INT DEFAULT 0 CHECK (response_count >= 0 AND response_count <= total_councils),

    -- Quality metrics
    avg_synthesis_quality FLOAT DEFAULT 0.0 CHECK (avg_synthesis_quality >= 0 AND avg_synthesis_quality <= 1),
    avg_ranking_accuracy FLOAT DEFAULT 0.0 CHECK (avg_ranking_accuracy >= 0 AND avg_ranking_accuracy <= 1),
    avg_response_rank FLOAT DEFAULT 0.0,  -- Average rank when provider's response was ranked (1 = best)

    -- Latency metrics (milliseconds)
    avg_latency_ms INT DEFAULT 0 CHECK (avg_latency_ms >= 0),
    p95_latency_ms INT,
    p99_latency_ms INT,

    -- Cost metrics
    avg_cost_usd DECIMAL(10,6) DEFAULT 0.0,
    total_cost_usd DECIMAL(12,6) DEFAULT 0.0,

    -- Success metrics
    success_rate FLOAT DEFAULT 1.0 CHECK (success_rate >= 0 AND success_rate <= 1),
    error_count INT DEFAULT 0 CHECK (error_count >= 0),

    -- Voting weight (calculated from quality metrics)
    voter_weight FLOAT DEFAULT 0.5 CHECK (voter_weight >= 0 AND voter_weight <= 1),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW(),
    last_council_at TIMESTAMP,

    -- Composite unique constraint
    UNIQUE (provider_id, semantic_class)
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- Index for finding best chairman candidates
CREATE INDEX idx_council_perf_chairman
ON council_performance(semantic_class, avg_synthesis_quality DESC, avg_latency_ms ASC)
WHERE chairman_count > 0;

-- Index for semantic class + provider lookups
CREATE INDEX idx_council_perf_semantic_provider
ON council_performance(semantic_class, provider_id);

-- Index for recently active providers
CREATE INDEX idx_council_perf_recent
ON council_performance(last_council_at DESC)
WHERE last_council_at IS NOT NULL;

-- Index for high-quality voters
CREATE INDEX idx_council_perf_voters
ON council_performance(semantic_class, voter_weight DESC)
WHERE voter_count > 10;

-- ============================================================================
-- Table: council_executions
-- Description: Detailed log of each council mode execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS council_executions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    trace_id VARCHAR(255) NOT NULL,

    -- Council configuration
    semantic_class VARCHAR(255),
    council_size INT CHECK (council_size >= 2 AND council_size <= 10),
    providers_used TEXT[], -- Array of provider IDs

    -- Chairman details
    chairman_provider VARCHAR(255),
    chairman_selection_reason VARCHAR(100), -- 'historical_quality', 'default', 'random'

    -- Phase timing (milliseconds)
    selection_latency_ms INT,
    parallel_inference_latency_ms INT,
    ranking_latency_ms INT,
    synthesis_latency_ms INT,
    total_latency_ms INT,

    -- Results
    winner_provider VARCHAR(255),
    winner_rank INT,
    final_response_length INT,

    -- Quality metrics
    synthesis_quality_score FLOAT CHECK (synthesis_quality_score IS NULL OR (synthesis_quality_score >= 0 AND synthesis_quality_score <= 1)),
    consensus_level FLOAT CHECK (consensus_level IS NULL OR (consensus_level >= 0 AND consensus_level <= 1)), -- How much agreement in rankings

    -- Cost
    total_cost_usd DECIMAL(10,6),
    cost_per_provider DECIMAL(10,6),

    -- Success
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    -- Timestamps
    timestamp TIMESTAMP DEFAULT NOW(),

    CONSTRAINT council_executions_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for council_executions
-- ============================================================================

CREATE INDEX idx_council_exec_tenant_time
ON council_executions(tenant_id, timestamp DESC);

CREATE INDEX idx_council_exec_trace
ON council_executions(trace_id);

CREATE INDEX idx_council_exec_semantic
ON council_executions(semantic_class, timestamp DESC);

CREATE INDEX idx_council_exec_chairman
ON council_executions(chairman_provider, timestamp DESC);

-- Index for finding failed executions
CREATE INDEX idx_council_exec_failures
ON council_executions(timestamp DESC)
WHERE success = FALSE;

-- ============================================================================
-- Table: council_rankings
-- Description: Individual ranking data from peer evaluations
-- ============================================================================

CREATE TABLE IF NOT EXISTS council_rankings (
    id BIGSERIAL PRIMARY KEY,
    council_execution_id BIGINT NOT NULL,

    -- Voter and votee
    voter_provider VARCHAR(255) NOT NULL,
    response_provider VARCHAR(255) NOT NULL,
    rank INT NOT NULL CHECK (rank > 0),

    -- Metadata
    voter_weight FLOAT DEFAULT 0.5 CHECK (voter_weight >= 0 AND voter_weight <= 1),
    ranking_latency_ms INT,

    -- Timestamp
    timestamp TIMESTAMP DEFAULT NOW(),

    CONSTRAINT council_rankings_execution_id_fkey FOREIGN KEY (council_execution_id)
        REFERENCES council_executions(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for council_rankings
-- ============================================================================

CREATE INDEX idx_council_rankings_execution
ON council_rankings(council_execution_id);

CREATE INDEX idx_council_rankings_voter
ON council_rankings(voter_provider, timestamp DESC);

CREATE INDEX idx_council_rankings_response
ON council_rankings(response_provider, rank);

-- ============================================================================
-- Materialized View: council_chairman_candidates
-- Description: Pre-computed view of best chairman candidates per semantic class
-- ============================================================================

CREATE MATERIALIZED VIEW council_chairman_candidates AS
SELECT
    semantic_class,
    provider_id,
    avg_synthesis_quality,
    avg_latency_ms,
    chairman_count,
    total_councils,

    -- Composite chairman score: 60% quality + 30% speed + 10% experience
    (0.6 * avg_synthesis_quality +
     0.3 * (1.0 - LEAST(avg_latency_ms::FLOAT / 5000.0, 1.0)) +
     0.1 * LEAST(chairman_count::FLOAT / 100.0, 1.0)) as chairman_score,

    last_updated

FROM council_performance
WHERE chairman_count >= 3  -- Minimum experience
  AND avg_synthesis_quality >= 0.7  -- Minimum quality
  AND success_rate >= 0.95  -- Minimum reliability
ORDER BY semantic_class, chairman_score DESC;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX idx_council_chairman_candidates_pk
ON council_chairman_candidates(semantic_class, provider_id);

-- Index for fast chairman selection
CREATE INDEX idx_council_chairman_score
ON council_chairman_candidates(semantic_class, chairman_score DESC);

-- ============================================================================
-- Helper function: Update provider council performance
-- ============================================================================

CREATE OR REPLACE FUNCTION update_council_performance(
    p_provider_id VARCHAR(255),
    p_semantic_class VARCHAR(255),
    p_role VARCHAR(50),  -- 'chairman', 'voter', 'responder'
    p_latency_ms INT,
    p_cost_usd DECIMAL(10,6),
    p_quality_score FLOAT DEFAULT NULL,
    p_rank INT DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE
) RETURNS VOID AS $$
DECLARE
    v_current RECORD;
    v_new_total INT;
    v_new_avg_quality FLOAT;
    v_new_avg_latency FLOAT;
    v_new_avg_rank FLOAT;
    v_new_voter_weight FLOAT;
BEGIN
    -- Get current record
    SELECT * INTO v_current
    FROM council_performance
    WHERE provider_id = p_provider_id AND semantic_class = p_semantic_class;

    IF NOT FOUND THEN
        -- Insert new record
        INSERT INTO council_performance (
            provider_id, semantic_class, total_councils,
            chairman_count, voter_count, response_count,
            avg_synthesis_quality, avg_latency_ms,
            avg_cost_usd, total_cost_usd,
            success_rate, error_count,
            voter_weight, last_council_at
        ) VALUES (
            p_provider_id, p_semantic_class, 1,
            CASE WHEN p_role = 'chairman' THEN 1 ELSE 0 END,
            CASE WHEN p_role = 'voter' THEN 1 ELSE 0 END,
            CASE WHEN p_role = 'responder' THEN 1 ELSE 0 END,
            COALESCE(p_quality_score, 0.5),
            p_latency_ms,
            p_cost_usd, p_cost_usd,
            CASE WHEN p_success THEN 1.0 ELSE 0.0 END,
            CASE WHEN p_success THEN 0 ELSE 1 END,
            0.5,
            NOW()
        );
    ELSE
        -- Calculate new metrics using exponential moving average
        v_new_total := v_current.total_councils + 1;

        -- EMA with α=0.2 for quality metrics
        v_new_avg_quality := CASE
            WHEN p_quality_score IS NOT NULL THEN
                0.8 * v_current.avg_synthesis_quality + 0.2 * p_quality_score
            ELSE
                v_current.avg_synthesis_quality
        END;

        -- EMA with α=0.2 for latency
        v_new_avg_latency := 0.8 * v_current.avg_latency_ms + 0.2 * p_latency_ms;

        -- Update average rank if provided
        v_new_avg_rank := CASE
            WHEN p_rank IS NOT NULL AND v_current.response_count > 0 THEN
                (v_current.avg_response_rank * v_current.response_count + p_rank)::FLOAT / (v_current.response_count + 1)
            WHEN p_rank IS NOT NULL THEN
                p_rank::FLOAT
            ELSE
                v_current.avg_response_rank
        END;

        -- Calculate new voter weight (based on quality)
        v_new_voter_weight := LEAST(1.0, v_new_avg_quality);

        -- Update record
        UPDATE council_performance SET
            total_councils = v_new_total,
            chairman_count = chairman_count + CASE WHEN p_role = 'chairman' THEN 1 ELSE 0 END,
            voter_count = voter_count + CASE WHEN p_role = 'voter' THEN 1 ELSE 0 END,
            response_count = response_count + CASE WHEN p_role = 'responder' THEN 1 ELSE 0 END,
            avg_synthesis_quality = v_new_avg_quality,
            avg_latency_ms = v_new_avg_latency::INT,
            avg_response_rank = v_new_avg_rank,
            avg_cost_usd = (total_cost_usd + p_cost_usd) / v_new_total,
            total_cost_usd = total_cost_usd + p_cost_usd,
            success_rate = (success_rate * v_current.total_councils + CASE WHEN p_success THEN 1 ELSE 0 END)::FLOAT / v_new_total,
            error_count = error_count + CASE WHEN p_success THEN 0 ELSE 1 END,
            voter_weight = v_new_voter_weight,
            last_updated = NOW(),
            last_council_at = NOW()
        WHERE provider_id = p_provider_id AND semantic_class = p_semantic_class;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper function: Select best chairman for semantic class
-- ============================================================================

CREATE OR REPLACE FUNCTION select_best_chairman(
    p_semantic_class VARCHAR(255),
    p_candidate_providers TEXT[]
) RETURNS VARCHAR(255) AS $$
DECLARE
    v_best_provider VARCHAR(255);
BEGIN
    -- Try to select from pre-computed candidates
    SELECT provider_id INTO v_best_provider
    FROM council_chairman_candidates
    WHERE semantic_class = p_semantic_class
      AND provider_id = ANY(p_candidate_providers)
    ORDER BY chairman_score DESC
    LIMIT 1;

    -- Fallback to first candidate if no historical data
    IF v_best_provider IS NULL AND array_length(p_candidate_providers, 1) > 0 THEN
        v_best_provider := p_candidate_providers[1];
    END IF;

    RETURN v_best_provider;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper function: Get voter weights for council members
-- ============================================================================

CREATE OR REPLACE FUNCTION get_voter_weights(
    p_semantic_class VARCHAR(255),
    p_providers TEXT[]
) RETURNS TABLE(provider_id VARCHAR(255), weight FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        unnest(p_providers) as provider_id,
        COALESCE(cp.voter_weight, 0.5) as weight
    FROM unnest(p_providers) as pid
    LEFT JOIN council_performance cp
        ON cp.provider_id = pid AND cp.semantic_class = p_semantic_class;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row-Level Security (RLS)
-- ============================================================================

-- Note: council_performance is global (not tenant-specific), so no RLS needed
-- council_executions and council_rankings are tenant-specific

ALTER TABLE council_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY council_executions_isolation_policy
ON council_executions FOR ALL
USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- ============================================================================
-- Scheduled refresh of materialized view
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_council_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY council_chairman_candidates;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Auto-update timestamp on council_performance
-- ============================================================================

CREATE OR REPLACE FUNCTION update_council_performance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_council_performance_timestamp
BEFORE UPDATE ON council_performance
FOR EACH ROW
EXECUTE FUNCTION update_council_performance_timestamp();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE council_performance IS
'Tracks historical performance metrics of providers in council mode for dynamic chairman selection and weighted voting. Part of Council Mode enhancements (v1.4).';

COMMENT ON TABLE council_executions IS
'Detailed log of each council mode execution including timing, costs, and quality metrics.';

COMMENT ON TABLE council_rankings IS
'Individual ranking data from peer evaluations in council mode, used to calculate voter weights.';

COMMENT ON MATERIALIZED VIEW council_chairman_candidates IS
'Pre-computed view of best chairman candidates per semantic class based on composite scoring (quality + speed + experience).';

COMMENT ON FUNCTION update_council_performance IS
'Updates council performance metrics using exponential moving average for smooth convergence.';

COMMENT ON FUNCTION select_best_chairman IS
'Selects the best chairman provider for a given semantic class based on historical performance.';

-- ============================================================================
-- Migration complete
-- ============================================================================
