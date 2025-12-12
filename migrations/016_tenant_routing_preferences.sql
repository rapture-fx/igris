-- Migration: Enhanced Tenant Routing Preferences for Adaptive Reward Weighting
-- Purpose: Enable per-tenant learned preferences and adaptive reward weight optimization
-- Related Feature: Intelligent Quality Routing (Priority 1)

-- ============================================================================
-- Table: tenant_routing_preferences
-- Description: Stores learned reward weights and exploration rates per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_routing_preferences (
    tenant_id VARCHAR(255) PRIMARY KEY,

    -- Learned reward weights (JSONB for flexibility)
    reward_weights JSONB NOT NULL DEFAULT '{
        "latency": 0.4,
        "success": 0.3,
        "cost": 0.15,
        "cache": 0.1,
        "quality": 0.05
    }'::jsonb,

    -- Per-tenant exploration rate (epsilon for Thompson Sampling)
    exploration_rate FLOAT NOT NULL DEFAULT 0.1 CHECK (exploration_rate >= 0 AND exploration_rate <= 1),

    -- Metadata for learning algorithm
    sample_count INT NOT NULL DEFAULT 0,
    confidence_score FLOAT DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Learning state
    learning_enabled BOOLEAN DEFAULT TRUE,
    learning_rate FLOAT DEFAULT 0.05 CHECK (learning_rate > 0 AND learning_rate <= 1),
    update_frequency INT DEFAULT 500 CHECK (update_frequency > 0),

    -- Per-semantic-class overrides (optional)
    semantic_class_weights JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW(),
    last_learning_update TIMESTAMP DEFAULT NOW(),

    -- Audit fields
    updated_by VARCHAR(255),
    update_source VARCHAR(50) DEFAULT 'auto_learning'  -- 'auto_learning', 'manual', 'admin'
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- Index for efficient tenant lookups with timestamp ordering
CREATE INDEX idx_tenant_preferences_updated
ON tenant_routing_preferences(last_updated DESC);

-- Index for finding tenants with recent learning updates
CREATE INDEX idx_tenant_preferences_learning
ON tenant_routing_preferences(last_learning_update DESC)
WHERE learning_enabled = TRUE;

-- Index for filtering by confidence score
CREATE INDEX idx_tenant_preferences_confidence
ON tenant_routing_preferences(confidence_score DESC)
WHERE confidence_score > 0.5;

-- ============================================================================
-- Helper function: Update tenant preference weights
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tenant_preference_weights(
    p_tenant_id VARCHAR(255),
    p_new_weights JSONB,
    p_sample_count INT,
    p_confidence FLOAT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO tenant_routing_preferences (
        tenant_id,
        reward_weights,
        sample_count,
        confidence_score,
        last_updated,
        last_learning_update
    ) VALUES (
        p_tenant_id,
        p_new_weights,
        p_sample_count,
        p_confidence,
        NOW(),
        NOW()
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        reward_weights = p_new_weights,
        sample_count = tenant_routing_preferences.sample_count + p_sample_count,
        confidence_score = p_confidence,
        last_updated = NOW(),
        last_learning_update = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper function: Get tenant weights (with fallback to defaults)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tenant_reward_weights(
    p_tenant_id VARCHAR(255)
) RETURNS JSONB AS $$
DECLARE
    v_weights JSONB;
BEGIN
    SELECT reward_weights INTO v_weights
    FROM tenant_routing_preferences
    WHERE tenant_id = p_tenant_id;

    -- Return default weights if tenant not found
    IF v_weights IS NULL THEN
        RETURN '{
            "latency": 0.4,
            "success": 0.3,
            "cost": 0.15,
            "cache": 0.1,
            "quality": 0.05
        }'::jsonb;
    END IF;

    RETURN v_weights;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Auto-update last_updated timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tenant_preference_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenant_preference_timestamp
BEFORE UPDATE ON tenant_routing_preferences
FOR EACH ROW
EXECUTE FUNCTION update_tenant_preference_timestamp();

-- ============================================================================
-- Row-Level Security (RLS) for tenant isolation
-- ============================================================================

ALTER TABLE tenant_routing_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can only access their own preferences
CREATE POLICY tenant_preferences_isolation_policy
ON tenant_routing_preferences
FOR ALL
USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- ============================================================================
-- Initial data: Seed default preferences for existing tenants
-- ============================================================================

-- Insert default preferences for tenants that don't have them yet
-- This ensures backward compatibility
INSERT INTO tenant_routing_preferences (tenant_id, reward_weights, sample_count)
SELECT DISTINCT tenant_id,
       '{
           "latency": 0.4,
           "success": 0.3,
           "cost": 0.15,
           "cache": 0.1,
           "quality": 0.05
       }'::jsonb,
       0
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_routing_preferences trp
    WHERE trp.tenant_id = tenants.tenant_id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- Cleanup function for stale preferences (optional maintenance)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_stale_preferences(days INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM tenant_routing_preferences
    WHERE learning_enabled = FALSE
      AND last_updated < NOW() - (days || ' days')::INTERVAL
      AND sample_count = 0;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE tenant_routing_preferences IS
'Stores learned routing preferences per tenant for adaptive reward weight optimization. Part of Intelligent Quality Routing enhancement (v1.4).';

COMMENT ON COLUMN tenant_routing_preferences.reward_weights IS
'JSONB object containing learned weights for latency, success, cost, cache, and quality components. Updated via gradient descent learning.';

COMMENT ON COLUMN tenant_routing_preferences.exploration_rate IS
'Per-tenant epsilon value for Thompson Sampling exploration-exploitation trade-off. Range: [0, 1].';

COMMENT ON COLUMN tenant_routing_preferences.confidence_score IS
'Confidence in learned weights based on sample size and variance. Range: [0, 1]. Higher is more confident.';

COMMENT ON COLUMN tenant_routing_preferences.semantic_class_weights IS
'Optional overrides for specific semantic classes (e.g., {"translation": {"latency": 0.6, "quality": 0.3}}).';

-- ============================================================================
-- Migration complete
-- ============================================================================
