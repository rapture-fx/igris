-- Migration: 005_create_slo_audit_events
-- Purpose: Create HMAC-signed audit trail for SLO enforcement actions
-- Phase: SLO Enforcer - Autonomous Remediation Audit
-- Date: 2025-11-20

-- ============================================================================
-- TABLE: slo_audit_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS slo_audit_events (
    -- Primary identifier
    event_id BIGSERIAL PRIMARY KEY,

    -- Event identification
    event_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL, -- "slo.breach", "action.executed", "action.failed"

    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- SLO Information
    slo_type VARCHAR(50), -- "P99Latency", "P95Latency", "ErrorRate", "Availability", "Throughput"
    slo_status VARCHAR(20), -- "Compliant", "Warning", "Critical", "Breached"
    current_value DECIMAL(12, 4),
    threshold_value DECIMAL(12, 4),

    -- Remediation Action
    action_type VARCHAR(200), -- "circuit_breaker:open", "scale:deployment", etc.
    action_target VARCHAR(200), -- "openai", "api_gateway", etc.
    action_reason TEXT,
    action_result VARCHAR(20), -- "success", "failed", "skipped"

    -- Actor
    actor VARCHAR(100) NOT NULL DEFAULT 'slo_enforcer', -- "slo_enforcer", "manual", "system"

    -- HMAC Signature for audit integrity
    hmac_signature VARCHAR(128) NOT NULL, -- SHA-256 HMAC hex (64 chars)

    -- Additional context
    metadata JSONB, -- Additional event-specific data

    -- Checkpointing
    checkpoint_id VARCHAR(255), -- For correlation with system checkpoints

    CONSTRAINT valid_event_type CHECK (
        event_type IN (
            'slo.breach',
            'slo.compliant',
            'action.executed',
            'action.failed',
            'action.skipped',
            'threshold.updated',
            'enforcer.started',
            'enforcer.stopped'
        )
    ),

    CONSTRAINT valid_action_result CHECK (
        action_result IS NULL OR action_result IN ('success', 'failed', 'skipped', 'pending')
    )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast queries by event type
CREATE INDEX idx_slo_audit_events_type
    ON slo_audit_events(event_type, timestamp DESC);

-- Fast queries by SLO type
CREATE INDEX idx_slo_audit_events_slo_type
    ON slo_audit_events(slo_type, timestamp DESC)
    WHERE slo_type IS NOT NULL;

-- Fast queries by timestamp (most recent)
CREATE INDEX idx_slo_audit_events_timestamp
    ON slo_audit_events(timestamp DESC);

-- Fast queries by action result (failures)
CREATE INDEX idx_slo_audit_events_failed_actions
    ON slo_audit_events(action_result, timestamp DESC)
    WHERE action_result = 'failed';

-- Fast UUID lookups
CREATE INDEX idx_slo_audit_events_uuid
    ON slo_audit_events(event_uuid);

-- Fast checkpoint correlation
CREATE INDEX idx_slo_audit_events_checkpoint
    ON slo_audit_events(checkpoint_id)
    WHERE checkpoint_id IS NOT NULL;

-- JSONB metadata queries (GIN index for efficient JSON queries)
CREATE INDEX idx_slo_audit_events_metadata
    ON slo_audit_events USING GIN (metadata);

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Function to compute HMAC signature for audit event
CREATE OR REPLACE FUNCTION compute_audit_event_hmac(
    p_event_uuid UUID,
    p_event_type VARCHAR,
    p_timestamp TIMESTAMP WITH TIME ZONE,
    p_slo_type VARCHAR,
    p_current_value DECIMAL,
    p_action_type VARCHAR,
    p_actor VARCHAR,
    p_hmac_secret TEXT -- Must be passed from application
) RETURNS VARCHAR AS $$
DECLARE
    v_payload TEXT;
    v_hmac VARCHAR;
BEGIN
    -- Build payload string
    v_payload := CONCAT(
        COALESCE(p_event_uuid::TEXT, ''),
        '|',
        COALESCE(p_event_type, ''),
        '|',
        COALESCE(EXTRACT(EPOCH FROM p_timestamp)::TEXT, ''),
        '|',
        COALESCE(p_slo_type, ''),
        '|',
        COALESCE(p_current_value::TEXT, ''),
        '|',
        COALESCE(p_action_type, ''),
        '|',
        COALESCE(p_actor, '')
    );

    -- Compute HMAC-SHA256
    -- Note: This requires pgcrypto extension
    v_hmac := encode(
        hmac(v_payload::bytea, p_hmac_secret::bytea, 'sha256'),
        'hex'
    );

    RETURN v_hmac;
END;
$$ LANGUAGE plpgsql;

-- Function to log SLO audit event with HMAC
CREATE OR REPLACE FUNCTION log_slo_audit_event(
    p_event_type VARCHAR,
    p_slo_type VARCHAR,
    p_slo_status VARCHAR,
    p_current_value DECIMAL,
    p_threshold_value DECIMAL,
    p_action_type VARCHAR,
    p_action_target VARCHAR,
    p_action_reason TEXT,
    p_action_result VARCHAR,
    p_actor VARCHAR,
    p_metadata JSONB,
    p_checkpoint_id VARCHAR,
    p_hmac_secret TEXT
) RETURNS UUID AS $$
DECLARE
    v_event_uuid UUID;
    v_timestamp TIMESTAMP WITH TIME ZONE;
    v_hmac VARCHAR;
BEGIN
    v_event_uuid := gen_random_uuid();
    v_timestamp := NOW();

    -- Compute HMAC signature
    v_hmac := compute_audit_event_hmac(
        v_event_uuid,
        p_event_type,
        v_timestamp,
        p_slo_type,
        p_current_value,
        p_action_type,
        p_actor,
        p_hmac_secret
    );

    -- Insert event
    INSERT INTO slo_audit_events (
        event_uuid,
        event_type,
        timestamp,
        slo_type,
        slo_status,
        current_value,
        threshold_value,
        action_type,
        action_target,
        action_reason,
        action_result,
        actor,
        metadata,
        checkpoint_id,
        hmac_signature
    ) VALUES (
        v_event_uuid,
        p_event_type,
        v_timestamp,
        p_slo_type,
        p_slo_status,
        p_current_value,
        p_threshold_value,
        p_action_type,
        p_action_target,
        p_action_reason,
        p_action_result,
        p_actor,
        p_metadata,
        p_checkpoint_id,
        v_hmac
    );

    RETURN v_event_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENABLE pgcrypto EXTENSION (required for HMAC)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE slo_audit_events IS 'HMAC-signed immutable audit trail for SLO enforcement actions';
COMMENT ON COLUMN slo_audit_events.hmac_signature IS 'HMAC-SHA256 signature for audit integrity verification';
COMMENT ON COLUMN slo_audit_events.event_uuid IS 'Unique event identifier for external correlation';
COMMENT ON COLUMN slo_audit_events.metadata IS 'Additional event-specific data in JSON format';
COMMENT ON COLUMN slo_audit_events.checkpoint_id IS 'Correlation ID for system state checkpoints';

-- ============================================================================
-- PARTITIONING (Optional - for high-volume deployments)
-- ============================================================================
-- For production with millions of events, consider partitioning by timestamp:
-- CREATE TABLE slo_audit_events_2025_11 PARTITION OF slo_audit_events
--     FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
