-- Migration: 007_create_policy_audit_log
-- Description: Policy DSL v2 Audit Logging & SLA Management
-- Purpose: Track all routing decisions with policy versioning and enforce SLA compliance
-- Author: Igris Inertial Team
-- Date: 2025-11-09
-- Phase: 4 (Adaptive Governance)

-- ============================================================================
-- 1. POLICY VERSIONS TABLE
-- ============================================================================
-- Stores versioned tenant routing policies with hot-reload support
CREATE TABLE IF NOT EXISTS policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant association
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Versioning
    version VARCHAR(50) NOT NULL,              -- e.g., "v1.2.3", "2025-11-09-001"
    policy_hash VARCHAR(64) NOT NULL,          -- SHA-256 of policy content for integrity

    -- Policy Content (DSL v2 YAML)
    policy_content JSONB NOT NULL,             -- Parsed YAML stored as JSON

    -- Policy Directives (extracted for fast querying)
    retry_chain JSONB,                         -- Array of provider fallback order
    weight_config JSONB,                       -- Weight overrides {latency: 0.4, cost: 0.3, success: 0.3}
    region_constraints JSONB,                  -- Geo constraints {allowed: [], blocked: []}
    time_window_config JSONB,                  -- Time-based rules {peak_hours: {...}, off_peak: {...}}

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, active, deprecated, archived
    is_active BOOLEAN DEFAULT false,
    activated_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,

    -- Change Management
    created_by VARCHAR(255),                   -- User ID or system identifier
    change_notes TEXT,
    parent_version_id UUID REFERENCES policy_versions(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_tenant_version UNIQUE (tenant_id, version),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
    CONSTRAINT single_active_policy UNIQUE (tenant_id, is_active) WHERE is_active = true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_policy_versions_tenant_status
    ON policy_versions(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_versions_active
    ON policy_versions(tenant_id, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_policy_versions_hash
    ON policy_versions(policy_hash);

-- ============================================================================
-- 2. POLICY AUDIT LOG TABLE
-- ============================================================================
-- Records every routing decision with policy context (90-day retention)
CREATE TABLE IF NOT EXISTS policy_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Request Context
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trace_id UUID NOT NULL,                    -- Links to routing_telemetry
    request_id VARCHAR(255),

    -- Policy Context
    policy_version_id UUID REFERENCES policy_versions(id) ON DELETE SET NULL,
    policy_version VARCHAR(50),
    policy_hash VARCHAR(64),

    -- Routing Decision
    semantic_class VARCHAR(50),
    selected_provider_id UUID REFERENCES provider_registry(id) ON DELETE SET NULL,
    selected_provider_name VARCHAR(255) NOT NULL,
    selection_reason TEXT,                     -- Human-readable explanation

    -- Decision Metrics
    available_providers INTEGER,               -- How many providers were available
    fallback_count INTEGER DEFAULT 0,          -- How many fallbacks occurred
    decision_latency_ms INTEGER,               -- Time to make routing decision

    -- Outcome
    inference_success BOOLEAN,
    inference_latency_ms INTEGER,
    inference_cost_usd DECIMAL(10, 6),

    -- Composite Reward Components
    latency_score DECIMAL(8, 6),
    cost_efficiency DECIMAL(8, 6),
    success_rate DECIMAL(8, 6),
    composite_reward DECIMAL(8, 6),

    -- Policy Evaluation Results
    policy_matched BOOLEAN DEFAULT true,       -- Did request match policy criteria?
    policy_override_reason TEXT,               -- Why policy was overridden (if applicable)

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retention_until TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '90 days',

    -- Constraints
    CONSTRAINT valid_providers CHECK (available_providers >= 0),
    CONSTRAINT valid_fallbacks CHECK (fallback_count >= 0),
    CONSTRAINT valid_decision_latency CHECK (decision_latency_ms IS NULL OR decision_latency_ms >= 0)
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_policy_audit_tenant_created
    ON policy_audit_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_audit_trace_id
    ON policy_audit_log(trace_id);

CREATE INDEX IF NOT EXISTS idx_policy_audit_policy_version
    ON policy_audit_log(policy_version_id, created_at DESC)
    WHERE policy_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_policy_audit_retention
    ON policy_audit_log(retention_until)
    WHERE retention_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_policy_audit_semantic_class
    ON policy_audit_log(semantic_class, created_at DESC);

-- ============================================================================
-- 3. SLA CONFIGURATION TABLE
-- ============================================================================
-- Defines SLA targets per tenant with violation tracking
CREATE TABLE IF NOT EXISTS sla_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant association
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- SLA Targets
    target_uptime_percent DECIMAL(5, 2) NOT NULL DEFAULT 99.9,  -- 99.90%
    target_latency_p95_ms INTEGER NOT NULL DEFAULT 2000,        -- 2 seconds
    target_latency_p99_ms INTEGER NOT NULL DEFAULT 5000,        -- 5 seconds
    target_cost_per_1k_requests_usd DECIMAL(10, 6),

    -- Success Rate Targets
    min_success_rate DECIMAL(5, 2) NOT NULL DEFAULT 95.0,       -- 95%
    max_error_rate DECIMAL(5, 2) NOT NULL DEFAULT 5.0,          -- 5%

    -- Violation Thresholds
    violation_threshold_per_day INTEGER DEFAULT 3,              -- Mark degraded after 3 violations/day
    critical_violation_threshold INTEGER DEFAULT 10,            -- Escalate after 10 violations/day

    -- Monitoring Configuration
    measurement_window_minutes INTEGER DEFAULT 10,              -- Rolling window for aggregation
    enabled BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_tenant_sla UNIQUE (tenant_id),
    CONSTRAINT valid_uptime CHECK (target_uptime_percent >= 0 AND target_uptime_percent <= 100),
    CONSTRAINT valid_success_rate CHECK (min_success_rate >= 0 AND min_success_rate <= 100),
    CONSTRAINT valid_error_rate CHECK (max_error_rate >= 0 AND max_error_rate <= 100)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sla_config_tenant
    ON sla_configurations(tenant_id, enabled);

-- ============================================================================
-- 4. SLA VIOLATIONS TABLE
-- ============================================================================
-- Records SLA violations with automatic alerting integration
CREATE TABLE IF NOT EXISTS sla_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Context
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES provider_registry(id) ON DELETE SET NULL,
    sla_config_id UUID NOT NULL REFERENCES sla_configurations(id) ON DELETE CASCADE,

    -- Violation Details
    violation_type VARCHAR(50) NOT NULL,       -- uptime, latency_p95, latency_p99, cost, success_rate
    measured_value DECIMAL(12, 4) NOT NULL,
    target_value DECIMAL(12, 4) NOT NULL,
    deviation_percent DECIMAL(8, 4),           -- (measured - target) / target * 100

    -- Time Window
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Severity
    severity VARCHAR(20) NOT NULL DEFAULT 'warning', -- warning, critical, emergency
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Actions Taken
    degraded_provider BOOLEAN DEFAULT false,   -- Was provider marked degraded?
    alert_sent BOOLEAN DEFAULT false,
    alert_channel VARCHAR(50),                 -- email, slack, pagerduty, webhook

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_violation_type CHECK (violation_type IN (
        'uptime', 'latency_p95', 'latency_p99', 'cost', 'success_rate', 'error_rate'
    )),
    CONSTRAINT valid_severity CHECK (severity IN ('warning', 'critical', 'emergency')),
    CONSTRAINT valid_window CHECK (window_end > window_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sla_violations_tenant_created
    ON sla_violations(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sla_violations_provider
    ON sla_violations(provider_id, created_at DESC)
    WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sla_violations_unresolved
    ON sla_violations(severity, created_at DESC)
    WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_sla_violations_type
    ON sla_violations(violation_type, created_at DESC);

-- ============================================================================
-- 5. SELF-TUNING HISTORY TABLE
-- ============================================================================
-- Records weight optimization history from self-tuning scheduler
CREATE TABLE IF NOT EXISTS self_tuning_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Context
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    semantic_class VARCHAR(50),

    -- Previous Weights
    old_weight_latency DECIMAL(4, 3),
    old_weight_cost DECIMAL(4, 3),
    old_weight_success DECIMAL(4, 3),

    -- New Weights (Optimized)
    new_weight_latency DECIMAL(4, 3) NOT NULL,
    new_weight_cost DECIMAL(4, 3) NOT NULL,
    new_weight_success DECIMAL(4, 3) NOT NULL,

    -- Optimization Metrics
    correlation_matrix JSONB,                  -- Correlation between latency, cost, success
    performance_improvement DECIMAL(8, 6),     -- Expected improvement in composite reward
    sample_size INTEGER,                       -- Number of requests analyzed

    -- Optimization Algorithm
    algorithm VARCHAR(50) DEFAULT 'correlation_analysis',
    confidence_score DECIMAL(5, 4),

    -- Status
    applied BOOLEAN DEFAULT false,
    applied_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_new_weights CHECK (
        new_weight_latency >= 0 AND new_weight_latency <= 1 AND
        new_weight_cost >= 0 AND new_weight_cost <= 1 AND
        new_weight_success >= 0 AND new_weight_success <= 1 AND
        ABS((new_weight_latency + new_weight_cost + new_weight_success) - 1.0) < 0.01
    )
);

-- Index
CREATE INDEX IF NOT EXISTS idx_self_tuning_created
    ON self_tuning_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_self_tuning_class
    ON self_tuning_history(semantic_class, created_at DESC);

-- ============================================================================
-- 6. STORED PROCEDURES
-- ============================================================================

-- Function to activate a policy version
CREATE OR REPLACE FUNCTION activate_policy_version(p_version_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tenant_id UUID;
    v_current_active_id UUID;
BEGIN
    -- Get tenant_id of the new version
    SELECT tenant_id INTO v_tenant_id
    FROM policy_versions
    WHERE id = p_version_id AND status = 'draft';

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Policy version not found or not in draft status';
    END IF;

    -- Deactivate current active version
    UPDATE policy_versions
    SET is_active = false,
        status = 'deprecated',
        deprecated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = v_tenant_id AND is_active = true
    RETURNING id INTO v_current_active_id;

    -- Activate new version
    UPDATE policy_versions
    SET is_active = true,
        status = 'active',
        activated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_version_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to record policy audit entry
CREATE OR REPLACE FUNCTION record_policy_audit(
    p_tenant_id UUID,
    p_trace_id UUID,
    p_policy_version_id UUID,
    p_semantic_class VARCHAR,
    p_provider_id UUID,
    p_provider_name VARCHAR,
    p_selection_reason TEXT,
    p_available_providers INTEGER,
    p_decision_latency_ms INTEGER
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
    v_policy_version VARCHAR;
    v_policy_hash VARCHAR;
BEGIN
    -- Get policy version details
    SELECT version, policy_hash INTO v_policy_version, v_policy_hash
    FROM policy_versions
    WHERE id = p_policy_version_id;

    -- Insert audit log
    INSERT INTO policy_audit_log (
        tenant_id, trace_id, policy_version_id, policy_version, policy_hash,
        semantic_class, selected_provider_id, selected_provider_name,
        selection_reason, available_providers, decision_latency_ms
    ) VALUES (
        p_tenant_id, p_trace_id, p_policy_version_id, v_policy_version, v_policy_hash,
        p_semantic_class, p_provider_id, p_provider_name,
        p_selection_reason, p_available_providers, p_decision_latency_ms
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record SLA violation
CREATE OR REPLACE FUNCTION record_sla_violation(
    p_tenant_id UUID,
    p_provider_id UUID,
    p_violation_type VARCHAR,
    p_measured_value DECIMAL,
    p_target_value DECIMAL,
    p_window_start TIMESTAMP,
    p_window_end TIMESTAMP,
    p_severity VARCHAR DEFAULT 'warning'
) RETURNS UUID AS $$
DECLARE
    v_violation_id UUID;
    v_sla_config_id UUID;
    v_deviation_percent DECIMAL;
    v_violations_today INTEGER;
    v_should_degrade BOOLEAN := false;
BEGIN
    -- Get SLA configuration
    SELECT id INTO v_sla_config_id
    FROM sla_configurations
    WHERE tenant_id = p_tenant_id AND enabled = true
    LIMIT 1;

    IF v_sla_config_id IS NULL THEN
        RAISE EXCEPTION 'No active SLA configuration found for tenant';
    END IF;

    -- Calculate deviation percentage
    IF p_target_value > 0 THEN
        v_deviation_percent := ((p_measured_value - p_target_value) / p_target_value) * 100;
    ELSE
        v_deviation_percent := 0;
    END IF;

    -- Count violations today
    SELECT COUNT(*) INTO v_violations_today
    FROM sla_violations
    WHERE tenant_id = p_tenant_id
      AND provider_id = p_provider_id
      AND created_at > CURRENT_DATE;

    -- Check if provider should be degraded
    SELECT v_violations_today >= violation_threshold_per_day INTO v_should_degrade
    FROM sla_configurations
    WHERE id = v_sla_config_id;

    -- Insert violation record
    INSERT INTO sla_violations (
        tenant_id, provider_id, sla_config_id, violation_type,
        measured_value, target_value, deviation_percent,
        window_start, window_end, severity, degraded_provider
    ) VALUES (
        p_tenant_id, p_provider_id, v_sla_config_id, p_violation_type,
        p_measured_value, p_target_value, v_deviation_percent,
        p_window_start, p_window_end, p_severity, v_should_degrade
    ) RETURNING id INTO v_violation_id;

    -- Mark provider as degraded if threshold exceeded
    IF v_should_degrade AND p_provider_id IS NOT NULL THEN
        UPDATE provider_registry
        SET status = 'degraded',
            health = jsonb_set(health, '{sla_violations_today}', to_jsonb(v_violations_today + 1))
        WHERE id = p_provider_id;
    END IF;

    RETURN v_violation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old audit logs (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM policy_audit_log
    WHERE retention_until < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. INITIAL DATA SEED
-- ============================================================================

-- Create default SLA configuration for system tenant (if exists)
INSERT INTO sla_configurations (
    tenant_id,
    target_uptime_percent,
    target_latency_p95_ms,
    target_latency_p99_ms,
    min_success_rate,
    max_error_rate,
    violation_threshold_per_day,
    measurement_window_minutes
)
SELECT
    id,
    99.9,
    2000,
    5000,
    95.0,
    5.0,
    3,
    10
FROM tenants
WHERE email = 'system@igris.io' OR name = 'System'
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- 8. VIEWS FOR ANALYTICS
-- ============================================================================

-- Materialized view for SLA compliance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS sla_compliance_summary AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    sc.target_uptime_percent,
    sc.target_latency_p95_ms,
    sc.min_success_rate,

    -- Violation counts
    COUNT(sv.id) as total_violations,
    COUNT(sv.id) FILTER (WHERE sv.created_at > CURRENT_DATE) as violations_today,
    COUNT(sv.id) FILTER (WHERE sv.severity = 'critical') as critical_violations,

    -- Compliance status
    CASE
        WHEN COUNT(sv.id) FILTER (WHERE sv.created_at > CURRENT_DATE AND sv.is_resolved = false) = 0
        THEN 'compliant'
        WHEN COUNT(sv.id) FILTER (WHERE sv.created_at > CURRENT_DATE AND sv.severity = 'critical') > 0
        THEN 'critical'
        ELSE 'warning'
    END as compliance_status,

    -- Last violation
    MAX(sv.created_at) as last_violation_at

FROM tenants t
JOIN sla_configurations sc ON sc.tenant_id = t.id
LEFT JOIN sla_violations sv ON sv.tenant_id = t.id
GROUP BY t.id, t.name, sc.target_uptime_percent, sc.target_latency_p95_ms, sc.min_success_rate;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_compliance_tenant
    ON sla_compliance_summary(tenant_id);

-- ============================================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE policy_versions IS
    'Versioned tenant routing policies with DSL v2 YAML content. Supports hot reload and change tracking.';

COMMENT ON TABLE policy_audit_log IS
    'Comprehensive audit trail of all routing decisions with 90-day retention policy. Links policy versions to outcomes.';

COMMENT ON TABLE sla_configurations IS
    'SLA targets per tenant including uptime, latency p95/p99, cost, and success rate thresholds.';

COMMENT ON TABLE sla_violations IS
    'Records SLA violations with automatic provider degradation after threshold violations per day.';

COMMENT ON TABLE self_tuning_history IS
    'Tracks weight optimization history from weekly self-tuning scheduler using correlation analysis.';

COMMENT ON FUNCTION activate_policy_version IS
    'Atomically activates a new policy version and deprecates the current active version.';

COMMENT ON FUNCTION record_policy_audit IS
    'Records a routing decision in the audit log with full policy context and trace linking.';

COMMENT ON FUNCTION record_sla_violation IS
    'Records an SLA violation and automatically degrades provider if violation threshold exceeded.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Success criteria verification:
-- ✓ Policy versioning with hot reload support
-- ✓ Comprehensive audit logging with 90-day retention
-- ✓ SLA configuration and violation tracking
-- ✓ Self-tuning weight optimization history
-- ✓ Stored procedures for atomic operations
-- ✓ Materialized view for SLA compliance dashboard

-- Rollback instructions:
-- DROP MATERIALIZED VIEW IF EXISTS sla_compliance_summary CASCADE;
-- DROP FUNCTION IF EXISTS cleanup_old_audit_logs CASCADE;
-- DROP FUNCTION IF EXISTS record_sla_violation CASCADE;
-- DROP FUNCTION IF EXISTS record_policy_audit CASCADE;
-- DROP FUNCTION IF EXISTS activate_policy_version CASCADE;
-- DROP TABLE IF EXISTS self_tuning_history CASCADE;
-- DROP TABLE IF EXISTS sla_violations CASCADE;
-- DROP TABLE IF EXISTS sla_configurations CASCADE;
-- DROP TABLE IF EXISTS policy_audit_log CASCADE;
-- DROP TABLE IF EXISTS policy_versions CASCADE;
