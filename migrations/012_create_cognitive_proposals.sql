-- Migration: 012_create_cognitive_proposals.sql
-- Description: Creates tables for Cognitive Advisor proposals and audit log
-- Version: v1.2.0 - Cognitive Layer (Advisory Mode)

-- Create cognitive_proposals table
CREATE TABLE IF NOT EXISTS cognitive_proposals (
    id BIGSERIAL PRIMARY KEY,
    proposal_id VARCHAR(64) UNIQUE NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    risk_score NUMERIC(5,4) NOT NULL CHECK (risk_score BETWEEN 0 AND 1),
    projected_latency_p95_reduction_pct NUMERIC(6,2),
    projected_cost_saving_usd_monthly NUMERIC(12,2),
    rationale TEXT NOT NULL,
    proposed_changes JSONB NOT NULL,
    shadow_simulation_results JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired')),
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for cognitive_proposals
CREATE INDEX IF NOT EXISTS idx_cognitive_tenant ON cognitive_proposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cognitive_status ON cognitive_proposals(status);
CREATE INDEX IF NOT EXISTS idx_cognitive_generated ON cognitive_proposals(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cognitive_proposal_id ON cognitive_proposals(proposal_id);

-- Create cognitive_audit_log table
CREATE TABLE IF NOT EXISTS cognitive_audit_log (
    id BIGSERIAL PRIMARY KEY,
    proposal_id VARCHAR(64) NOT NULL,
    action VARCHAR(20) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_cognitive_audit_proposal ON cognitive_audit_log(proposal_id);
CREATE INDEX IF NOT EXISTS idx_cognitive_audit_created ON cognitive_audit_log(created_at DESC);

-- Add foreign key constraint
ALTER TABLE cognitive_audit_log
ADD CONSTRAINT fk_cognitive_audit_proposal
FOREIGN KEY (proposal_id)
REFERENCES cognitive_proposals(proposal_id)
ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE cognitive_proposals IS 'Stores AI-generated policy optimization proposals for human review';
COMMENT ON TABLE cognitive_audit_log IS 'Audit trail for all cognitive proposal actions';
COMMENT ON COLUMN cognitive_proposals.confidence IS 'AI confidence score (0-1) for this proposal';
COMMENT ON COLUMN cognitive_proposals.risk_score IS 'Risk assessment score (0-1), lower is safer';
COMMENT ON COLUMN cognitive_proposals.proposed_changes IS 'JSONB array of proposed policy changes';
COMMENT ON COLUMN cognitive_proposals.shadow_simulation_results IS 'Results from shadow traffic simulation';
