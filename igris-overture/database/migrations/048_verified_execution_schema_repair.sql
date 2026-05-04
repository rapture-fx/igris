-- Migration 048: Repair additive verified-execution schema drift on older databases.
--
-- The active verified-execution APIs and persistence path expect a newer
-- execution_lineage shape than some long-lived local databases currently have.
-- This migration only adds missing columns/indexes required by the current
-- Runtime -> Overture -> execution_lineage / execution_context proof flow.

ALTER TABLE execution_lineage
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS pause_reason TEXT,
    ADD COLUMN IF NOT EXISTS approved_by TEXT,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS shadow_run_id TEXT,
    ADD COLUMN IF NOT EXISTS prompt_preview TEXT,
    ADD COLUMN IF NOT EXISTS violation_details JSONB,
    ADD COLUMN IF NOT EXISTS alert_escalated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_execution_lineage_paused
    ON execution_lineage (tenant_id, status)
    WHERE status = 'PAUSED';

CREATE INDEX IF NOT EXISTS idx_execution_lineage_shadow_run
    ON execution_lineage (shadow_run_id)
    WHERE shadow_run_id IS NOT NULL;
