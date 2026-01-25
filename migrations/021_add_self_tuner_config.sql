-- Migration: 021_add_self_tuner_config
-- Description: Add tenant-level self-tuner configuration table for autonomous optimization
-- Date: 2026-01-25

-- Create tenant self-tuner configuration table
CREATE TABLE IF NOT EXISTS tenant_self_tuner_config (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    interval_seconds INTEGER NOT NULL DEFAULT 86400, -- 24 hours (minimum 3600 = 1 hour)
    auto_apply_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- Opt-in for auto-apply
    auto_apply_threshold REAL NOT NULL DEFAULT 0.90, -- Min confidence for auto-apply
    max_risk_score REAL NOT NULL DEFAULT 0.30, -- Max risk score for auto-apply
    rollback_window_seconds INTEGER NOT NULL DEFAULT 3600, -- 1 hour monitoring window
    latency_degradation_threshold REAL NOT NULL DEFAULT 0.10, -- 10% degradation triggers rollback
    error_rate_degradation_threshold REAL NOT NULL DEFAULT 0.05, -- 5% error rate increase
    cost_degradation_threshold REAL NOT NULL DEFAULT 0.10, -- 10% cost increase
    last_run TIMESTAMP WITH TIME ZONE,
    last_auto_apply TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT interval_minimum CHECK (interval_seconds >= 3600),
    CONSTRAINT auto_apply_threshold_range CHECK (auto_apply_threshold >= 0 AND auto_apply_threshold <= 1),
    CONSTRAINT max_risk_score_range CHECK (max_risk_score >= 0 AND max_risk_score <= 1),
    CONSTRAINT rollback_window_minimum CHECK (rollback_window_seconds >= 300) -- Min 5 minutes
);

-- Add comment
COMMENT ON TABLE tenant_self_tuner_config IS 'Tenant-level configuration for the autonomous self-tuning scheduler';

-- Create index on enabled tenants for efficient querying
CREATE INDEX idx_self_tuner_enabled_last_run ON tenant_self_tuner_config(enabled, last_run)
    WHERE enabled = TRUE;

-- Add RLS policies
ALTER TABLE tenant_self_tuner_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_tuner_config_tenant_policy ON tenant_self_tuner_config
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- Create auto-apply baseline metrics table
CREATE TABLE IF NOT EXISTS self_tuner_baselines (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proposal_id TEXT NOT NULL,
    semantic_class TEXT NOT NULL,
    baseline_p95_latency_ms REAL NOT NULL,
    baseline_error_rate REAL NOT NULL,
    baseline_avg_cost_usd REAL NOT NULL,
    baseline_request_count INTEGER NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    rollback_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    rolled_back BOOLEAN NOT NULL DEFAULT FALSE,
    rolled_back_at TIMESTAMP WITH TIME ZONE,
    rollback_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Index for monitoring
    CONSTRAINT unique_active_baseline UNIQUE (tenant_id, semantic_class, rolled_back)
);

-- Index for finding baselines that need monitoring
CREATE INDEX idx_baselines_pending_rollback ON self_tuner_baselines(rollback_deadline)
    WHERE rolled_back = FALSE;

-- Index for tenant lookups
CREATE INDEX idx_baselines_tenant ON self_tuner_baselines(tenant_id);

-- Add RLS for baselines table
ALTER TABLE self_tuner_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY self_tuner_baselines_tenant_policy ON self_tuner_baselines
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_self_tuner_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_self_tuner_config_updated_at
    BEFORE UPDATE ON tenant_self_tuner_config
    FOR EACH ROW
    EXECUTE FUNCTION update_self_tuner_config_updated_at();

-- Backfill existing tenants with default configuration
INSERT INTO tenant_self_tuner_config (tenant_id, enabled, interval_seconds)
SELECT id, TRUE, 86400
FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM tenant_self_tuner_config)
ON CONFLICT (tenant_id) DO NOTHING;
