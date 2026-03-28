-- Migration 024: Extended agent settings and HITL audit columns
-- Adds cognitive_advisor_enabled to agent_settings,
-- pause_reason / approved_by / approved_at to execution_lineage,
-- and shadow_run_id for shadow trace pairing.

-- agent_settings: cognitive advisor flag
ALTER TABLE agent_settings
    ADD COLUMN IF NOT EXISTS cognitive_advisor_enabled BOOLEAN NOT NULL DEFAULT false;

-- execution_lineage: HITL audit trail
ALTER TABLE execution_lineage
    ADD COLUMN IF NOT EXISTS pause_reason  TEXT,
    ADD COLUMN IF NOT EXISTS approved_by   TEXT,
    ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS shadow_run_id TEXT;

-- Index for HITL approvals page: fast lookup of PAUSED runs per tenant
CREATE INDEX IF NOT EXISTS idx_execution_lineage_paused
    ON execution_lineage (tenant_id, status)
    WHERE status = 'PAUSED';

-- Index for shadow trace queries
CREATE INDEX IF NOT EXISTS idx_execution_lineage_shadow_run
    ON execution_lineage (shadow_run_id)
    WHERE shadow_run_id IS NOT NULL;
