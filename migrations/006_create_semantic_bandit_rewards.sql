-- Migration: 006_create_semantic_bandit_rewards
-- Description: Semantic Classification & Thompson Sampling State Management
-- Purpose: Enable semantic routing with cached classifications and adaptive learning
-- Author: Schlep-Engine Team
-- Date: 2025-11-09
-- Phase: 3 (Semantic Routing + Adaptive Learning)

-- ============================================================================
-- 1. SEMANTIC CLASSIFICATION CACHE TABLE
-- ============================================================================
-- Caches prompt classifications to avoid re-classification (5 min TTL in Redis, permanent in DB)
CREATE TABLE IF NOT EXISTS semantic_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Input
    prompt_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 of prompt text
    prompt_preview TEXT,                      -- First 200 chars for debugging

    -- Classification Result
    semantic_class VARCHAR(50) NOT NULL,      -- e.g., "code_generation", "qa", "translation", "summarization"
    confidence_score DECIMAL(5, 4) NOT NULL,  -- 0.0000 to 1.0000
    classifier_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',

    -- Metadata
    classification_latency_ms INTEGER,
    cache_hit BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,

    -- Constraints
    CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT valid_latency CHECK (classification_latency_ms IS NULL OR classification_latency_ms >= 0)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_semantic_class_hash
    ON semantic_classifications(prompt_hash);

CREATE INDEX IF NOT EXISTS idx_semantic_class_class
    ON semantic_classifications(semantic_class, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_class_created
    ON semantic_classifications(created_at DESC);

-- ============================================================================
-- 2. BANDIT ARMS STATE TABLE (Thompson Sampling Priors)
-- ============================================================================
-- Maintains Beta distribution parameters (α, β) for each provider per semantic class
CREATE TABLE IF NOT EXISTS bandit_arms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identification
    provider_id UUID NOT NULL REFERENCES provider_registry(id) ON DELETE CASCADE,
    semantic_class VARCHAR(50) NOT NULL,

    -- Beta Distribution Parameters
    alpha DECIMAL(12, 4) NOT NULL DEFAULT 1.0,  -- Successes + 1 (Bayesian prior)
    beta DECIMAL(12, 4) NOT NULL DEFAULT 1.0,   -- Failures + 1 (Bayesian prior)

    -- Composite Reward Tracking
    total_selections INTEGER NOT NULL DEFAULT 0,
    total_successes INTEGER NOT NULL DEFAULT 0,
    total_failures INTEGER NOT NULL DEFAULT 0,

    -- Reward Components (weighted sum = α·latency + β·cost + γ·success)
    avg_latency_score DECIMAL(8, 6) DEFAULT 0.0,    -- Normalized 0-1 (lower latency = higher score)
    avg_cost_efficiency DECIMAL(8, 6) DEFAULT 0.0,  -- Normalized 0-1 (lower cost = higher score)
    avg_success_rate DECIMAL(8, 6) DEFAULT 0.0,     -- Normalized 0-1

    -- Composite Reward (calculated field)
    composite_reward DECIMAL(8, 6) DEFAULT 0.0,

    -- Weight Parameters (α, β, γ for composite reward)
    weight_latency DECIMAL(4, 3) DEFAULT 0.33,      -- α
    weight_cost DECIMAL(4, 3) DEFAULT 0.33,         -- β
    weight_success DECIMAL(4, 3) DEFAULT 0.34,      -- γ

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_reward_update_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT unique_provider_class UNIQUE (provider_id, semantic_class),
    CONSTRAINT valid_alpha CHECK (alpha >= 0),
    CONSTRAINT valid_beta CHECK (beta >= 0),
    CONSTRAINT valid_weights CHECK (
        weight_latency >= 0 AND weight_latency <= 1 AND
        weight_cost >= 0 AND weight_cost <= 1 AND
        weight_success >= 0 AND weight_success <= 1 AND
        ABS((weight_latency + weight_cost + weight_success) - 1.0) < 0.01
    ),
    CONSTRAINT valid_scores CHECK (
        avg_latency_score >= 0 AND avg_latency_score <= 1 AND
        avg_cost_efficiency >= 0 AND avg_cost_efficiency <= 1 AND
        avg_success_rate >= 0 AND avg_success_rate <= 1
    )
);

-- Indexes for Thompson Sampling queries
CREATE INDEX IF NOT EXISTS idx_bandit_arms_provider_class
    ON bandit_arms(provider_id, semantic_class);

CREATE INDEX IF NOT EXISTS idx_bandit_arms_class
    ON bandit_arms(semantic_class, composite_reward DESC);

CREATE INDEX IF NOT EXISTS idx_bandit_arms_updated
    ON bandit_arms(updated_at DESC);

-- ============================================================================
-- 3. FEEDBACK EVENTS TABLE
-- ============================================================================
-- Stores feedback events that update posterior parameters asynchronously
CREATE TABLE IF NOT EXISTS feedback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Request Context
    request_id UUID NOT NULL,                  -- Links to routing_telemetry.trace_id
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES provider_registry(id) ON DELETE CASCADE,
    semantic_class VARCHAR(50),

    -- Feedback Data
    rating DECIMAL(3, 2),                      -- 0.00 to 5.00 (user rating)
    latency_ms INTEGER NOT NULL,
    cost_usd DECIMAL(10, 6),
    success BOOLEAN NOT NULL,

    -- Computed Reward
    latency_score DECIMAL(8, 6),               -- Normalized latency score
    cost_efficiency DECIMAL(8, 6),             -- Normalized cost efficiency
    success_rate DECIMAL(8, 6),                -- 1.0 if success, 0.0 if failure
    composite_reward DECIMAL(8, 6),            -- Final computed reward

    -- Processing Status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_latency_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_rating CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
    CONSTRAINT valid_latency CHECK (latency_ms >= 0),
    CONSTRAINT valid_cost CHECK (cost_usd IS NULL OR cost_usd >= 0),
    CONSTRAINT valid_processing_latency CHECK (processing_latency_ms IS NULL OR processing_latency_ms >= 0)
);

-- Indexes for feedback processing
CREATE INDEX IF NOT EXISTS idx_feedback_events_request_id
    ON feedback_events(request_id);

CREATE INDEX IF NOT EXISTS idx_feedback_events_provider_class
    ON feedback_events(provider_id, semantic_class);

CREATE INDEX IF NOT EXISTS idx_feedback_events_unprocessed
    ON feedback_events(created_at ASC)
    WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_feedback_events_created
    ON feedback_events(created_at DESC);

-- ============================================================================
-- 4. SEMANTIC CLASS METADATA TABLE
-- ============================================================================
-- Configuration and statistics for each semantic class
CREATE TABLE IF NOT EXISTS semantic_class_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Class Definition
    class_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Classification Keywords/Patterns (for rule-based fallback)
    keywords JSONB,                            -- Array of keywords
    patterns JSONB,                            -- Array of regex patterns

    -- Statistics
    total_classifications INTEGER DEFAULT 0,
    avg_confidence DECIMAL(5, 4) DEFAULT 0.0,

    -- Routing Configuration
    default_provider_preference JSONB,         -- Array of preferred provider IDs
    min_confidence_threshold DECIMAL(5, 4) DEFAULT 0.7,

    -- SLA Targets (optional per-class SLAs)
    target_latency_ms INTEGER,
    target_cost_usd DECIMAL(10, 6),
    target_success_rate DECIMAL(5, 4),

    -- Metadata
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_semantic_class_meta_enabled
    ON semantic_class_metadata(enabled, class_name);

-- ============================================================================
-- 5. STORED PROCEDURES
-- ============================================================================

-- Function to update bandit arm state after feedback
CREATE OR REPLACE FUNCTION update_bandit_arm_from_feedback(
    p_provider_id UUID,
    p_semantic_class VARCHAR,
    p_success BOOLEAN,
    p_latency_score DECIMAL,
    p_cost_efficiency DECIMAL,
    p_success_rate DECIMAL,
    p_weight_latency DECIMAL DEFAULT 0.33,
    p_weight_cost DECIMAL DEFAULT 0.33,
    p_weight_success DECIMAL DEFAULT 0.34
) RETURNS UUID AS $$
DECLARE
    v_arm_id UUID;
    v_new_alpha DECIMAL;
    v_new_beta DECIMAL;
    v_new_composite DECIMAL;
BEGIN
    -- Upsert bandit arm
    INSERT INTO bandit_arms (
        provider_id, semantic_class, alpha, beta,
        total_selections, total_successes, total_failures,
        weight_latency, weight_cost, weight_success
    ) VALUES (
        p_provider_id, p_semantic_class, 1.0, 1.0,
        1, CASE WHEN p_success THEN 1 ELSE 0 END, CASE WHEN p_success THEN 0 ELSE 1 END,
        p_weight_latency, p_weight_cost, p_weight_success
    )
    ON CONFLICT (provider_id, semantic_class) DO UPDATE SET
        total_selections = bandit_arms.total_selections + 1,
        total_successes = bandit_arms.total_successes + CASE WHEN p_success THEN 1 ELSE 0 END,
        total_failures = bandit_arms.total_failures + CASE WHEN p_success THEN 0 ELSE 1 END,
        updated_at = CURRENT_TIMESTAMP,
        last_reward_update_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_arm_id;

    -- Calculate new Beta parameters with exponential moving average
    -- α = α_old * 0.9 + (1 + composite_reward) * 10
    -- β = β_old * 0.9 + (1 - composite_reward) * 10

    v_new_composite := (p_weight_latency * p_latency_score) +
                       (p_weight_cost * p_cost_efficiency) +
                       (p_weight_success * p_success_rate);

    UPDATE bandit_arms SET
        alpha = alpha * 0.9 + (1.0 + v_new_composite) * 10.0,
        beta = beta * 0.9 + (1.0 - v_new_composite) * 10.0,
        avg_latency_score = (avg_latency_score * 0.8) + (p_latency_score * 0.2),
        avg_cost_efficiency = (avg_cost_efficiency * 0.8) + (p_cost_efficiency * 0.2),
        avg_success_rate = (avg_success_rate * 0.8) + (p_success_rate * 0.2),
        composite_reward = v_new_composite,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_arm_id;

    RETURN v_arm_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record semantic classification
CREATE OR REPLACE FUNCTION record_semantic_classification(
    p_prompt_hash VARCHAR,
    p_prompt_preview TEXT,
    p_semantic_class VARCHAR,
    p_confidence_score DECIMAL,
    p_classifier_version VARCHAR,
    p_classification_latency_ms INTEGER,
    p_cache_hit BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
    v_classification_id UUID;
BEGIN
    INSERT INTO semantic_classifications (
        prompt_hash, prompt_preview, semantic_class, confidence_score,
        classifier_version, classification_latency_ms, cache_hit
    ) VALUES (
        p_prompt_hash, p_prompt_preview, p_semantic_class, p_confidence_score,
        p_classifier_version, p_classification_latency_ms, p_cache_hit
    )
    ON CONFLICT (prompt_hash) DO UPDATE SET
        last_accessed_at = CURRENT_TIMESTAMP,
        access_count = semantic_classifications.access_count + 1
    RETURNING id INTO v_classification_id;

    -- Update semantic class statistics
    INSERT INTO semantic_class_metadata (class_name, display_name, total_classifications, avg_confidence)
    VALUES (
        p_semantic_class,
        INITCAP(REPLACE(p_semantic_class, '_', ' ')),
        1,
        p_confidence_score
    )
    ON CONFLICT (class_name) DO UPDATE SET
        total_classifications = semantic_class_metadata.total_classifications + 1,
        avg_confidence = (semantic_class_metadata.avg_confidence * semantic_class_metadata.total_classifications + p_confidence_score)
                        / (semantic_class_metadata.total_classifications + 1),
        updated_at = CURRENT_TIMESTAMP;

    RETURN v_classification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. INITIAL DATA SEED
-- ============================================================================

-- Seed common semantic classes
INSERT INTO semantic_class_metadata (class_name, display_name, description, keywords, min_confidence_threshold)
VALUES
    ('code_generation', 'Code Generation', 'Generate code snippets, functions, or complete programs',
     '["code", "function", "implement", "write", "generate", "program", "script"]'::jsonb, 0.7),
    ('question_answering', 'Question Answering', 'Answer factual or analytical questions',
     '["what", "how", "why", "when", "where", "who", "explain", "tell me"]'::jsonb, 0.6),
    ('translation', 'Translation', 'Translate text between languages',
     '["translate", "translation", "convert to", "in spanish", "in french", "in german"]'::jsonb, 0.8),
    ('summarization', 'Summarization', 'Summarize long-form content into concise form',
     '["summarize", "summary", "tldr", "brief", "condense", "overview"]'::jsonb, 0.7),
    ('creative_writing', 'Creative Writing', 'Generate creative content like stories, poems, or marketing copy',
     '["write", "story", "poem", "creative", "marketing", "blog", "article"]'::jsonb, 0.6),
    ('data_analysis', 'Data Analysis', 'Analyze data, generate insights, or perform calculations',
     '["analyze", "analysis", "calculate", "compute", "statistics", "data", "metrics"]'::jsonb, 0.75),
    ('conversational', 'Conversational', 'General conversational queries and chat',
     '["hello", "hi", "chat", "talk", "discuss", "conversation"]'::jsonb, 0.5),
    ('default', 'Default', 'Fallback for unclassified prompts', '{}'::jsonb, 0.0)
ON CONFLICT (class_name) DO NOTHING;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE semantic_classifications IS
    'Caches prompt classifications with SHA-256 hash to avoid redundant classification. 5-minute TTL in Redis, permanent in DB for analytics.';

COMMENT ON TABLE bandit_arms IS
    'Maintains Thompson Sampling Beta distribution parameters for each provider-semantic_class pair. Updated asynchronously from feedback_events.';

COMMENT ON TABLE feedback_events IS
    'Stores user feedback and system metrics for each inference request. Processed asynchronously to update bandit_arms posterior distributions.';

COMMENT ON TABLE semantic_class_metadata IS
    'Configuration and statistics for semantic classification categories. Defines keywords, SLA targets, and provider preferences per class.';

COMMENT ON FUNCTION update_bandit_arm_from_feedback IS
    'Updates Thompson Sampling Beta parameters using composite reward = α·latency + β·cost + γ·success. Uses exponential moving average for stability.';

COMMENT ON FUNCTION record_semantic_classification IS
    'Records a new semantic classification or updates access count if already cached. Automatically updates semantic_class_metadata statistics.';

-- ============================================================================
-- 8. CLEANUP FUNCTION (Optional - for testing)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_classifications(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM semantic_classifications
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL
      AND access_count < 5;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Success criteria verification:
-- ✓ semantic_classifications table with cache support
-- ✓ bandit_arms table with Beta(α,β) parameters per semantic class
-- ✓ feedback_events table for asynchronous processing
-- ✓ Composite reward calculation (α·latency + β·cost + γ·success)
-- ✓ Stored procedures for atomic updates
-- ✓ Seeded with 8 common semantic classes

-- Rollback instructions:
-- DROP FUNCTION IF EXISTS cleanup_old_classifications CASCADE;
-- DROP FUNCTION IF EXISTS record_semantic_classification CASCADE;
-- DROP FUNCTION IF EXISTS update_bandit_arm_from_feedback CASCADE;
-- DROP TABLE IF EXISTS semantic_class_metadata CASCADE;
-- DROP TABLE IF EXISTS feedback_events CASCADE;
-- DROP TABLE IF EXISTS bandit_arms CASCADE;
-- DROP TABLE IF EXISTS semantic_classifications CASCADE;
