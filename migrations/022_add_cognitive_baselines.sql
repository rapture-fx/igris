-- Migration: 022_add_cognitive_baselines
-- Description: Add cognitive baselines table for auto-apply rollback monitoring
-- Date: 2026-01-25

-- Create cognitive baselines table for rollback monitoring
CREATE TABLE IF NOT EXISTS cognitive_baselines (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proposal_id TEXT NOT NULL,
    semantic_class TEXT NOT NULL,
    baseline_p95_latency_ms REAL NOT NULL DEFAULT 0,
    baseline_error_rate REAL NOT NULL DEFAULT 0,
    baseline_avg_cost_usd REAL NOT NULL DEFAULT 0,
    baseline_request_count INTEGER NOT NULL DEFAULT 0,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    rollback_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    rolled_back BOOLEAN NOT NULL DEFAULT FALSE,
    rolled_back_at TIMESTAMP WITH TIME ZONE,
    rollback_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE cognitive_baselines IS 'Baseline metrics for cognitive proposal auto-apply rollback monitoring';
COMMENT ON COLUMN cognitive_baselines.baseline_p95_latency_ms IS 'P95 latency at time of proposal application';
COMMENT ON COLUMN cognitive_baselines.rollback_deadline IS 'Deadline after which monitoring stops';
COMMENT ON COLUMN cognitive_baselines.rolled_back IS 'Whether the proposal was rolled back';

-- Indexes
CREATE INDEX idx_cognitive_baselines_pending ON cognitive_baselines(rollback_deadline)
    WHERE rolled_back = FALSE;

CREATE INDEX idx_cognitive_baselines_tenant ON cognitive_baselines(tenant_id);

CREATE INDEX idx_cognitive_baselines_proposal ON cognitive_baselines(proposal_id);

-- RLS policies
ALTER TABLE cognitive_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY cognitive_baselines_tenant_policy ON cognitive_baselines
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- Add 'rolled_back' status to cognitive_proposals if not exists
DO $$
BEGIN
    -- Update any existing enum or check constraint to include 'rolled_back'
    -- This is a safe no-op if already present
    ALTER TABLE cognitive_proposals DROP CONSTRAINT IF EXISTS cognitive_proposals_status_check;
    ALTER TABLE cognitive_proposals ADD CONSTRAINT cognitive_proposals_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired', 'rolled_back'));
EXCEPTION
    WHEN undefined_column THEN NULL;
END $$;
