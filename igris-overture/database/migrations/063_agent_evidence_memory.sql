-- Migration 063: Agent Evidence Memory.
--
-- Summary-only operator memory attached to runs and registered agents. This is
-- intentionally separate from prompts, checkpoints, receipts, and registry
-- metadata: it stores bounded summaries and evidence labels only.

CREATE TABLE IF NOT EXISTS agent_evidence_memory (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID,
    execution_id TEXT NOT NULL DEFAULT '',
    registered_agent_id UUID,
    registered_agent_name TEXT NOT NULL DEFAULT '',
    goal_summary TEXT NOT NULL,
    decision_summary TEXT NOT NULL,
    evidence_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    outcome_summary TEXT NOT NULL,
    redaction_status TEXT NOT NULL DEFAULT 'redacted',
    retention_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT agent_evidence_memory_redaction_status_check
        CHECK (redaction_status IN ('redacted','rejected','manual_review')),
    CONSTRAINT agent_evidence_memory_attachment_check
        CHECK (task_id IS NOT NULL OR execution_id <> '' OR registered_agent_id IS NOT NULL OR registered_agent_name <> ''),
    CONSTRAINT agent_evidence_memory_evidence_summary_array_check
        CHECK (jsonb_typeof(evidence_summary) = 'array')
);

DO $$
BEGIN
    IF to_regclass('public.agent_evidence_memory') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conrelid = 'agent_evidence_memory'::regclass
             AND conname = 'agent_evidence_memory_redaction_status_check'
       ) THEN
        ALTER TABLE agent_evidence_memory
            ADD CONSTRAINT agent_evidence_memory_redaction_status_check
            CHECK (redaction_status IN ('redacted','rejected','manual_review'));
    END IF;

    IF to_regclass('public.agent_evidence_memory') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conrelid = 'agent_evidence_memory'::regclass
             AND conname = 'agent_evidence_memory_attachment_check'
       ) THEN
        ALTER TABLE agent_evidence_memory
            ADD CONSTRAINT agent_evidence_memory_attachment_check
            CHECK (task_id IS NOT NULL OR execution_id <> '' OR registered_agent_id IS NOT NULL OR registered_agent_name <> '');
    END IF;

    IF to_regclass('public.agent_evidence_memory') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conrelid = 'agent_evidence_memory'::regclass
             AND conname = 'agent_evidence_memory_evidence_summary_array_check'
       ) THEN
        ALTER TABLE agent_evidence_memory
            ADD CONSTRAINT agent_evidence_memory_evidence_summary_array_check
            CHECK (jsonb_typeof(evidence_summary) = 'array');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_evidence_memory_task_idx
    ON agent_evidence_memory (tenant_id, task_id, created_at DESC)
    WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_evidence_memory_execution_idx
    ON agent_evidence_memory (tenant_id, execution_id, created_at DESC)
    WHERE execution_id <> '';

CREATE INDEX IF NOT EXISTS agent_evidence_memory_agent_idx
    ON agent_evidence_memory (tenant_id, registered_agent_id, created_at DESC)
    WHERE registered_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_evidence_memory_retention_idx
    ON agent_evidence_memory (tenant_id, retention_expires_at)
    WHERE retention_expires_at IS NOT NULL;
