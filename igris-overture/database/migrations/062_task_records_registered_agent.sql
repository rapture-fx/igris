-- Migration 062: Persist registered agent attribution on durable task runs.

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS registered_agent_id UUID,
    ADD COLUMN IF NOT EXISTS registered_agent_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS task_records_registered_agent_idx
    ON task_records (tenant_id, registered_agent_id, created_at DESC)
    WHERE registered_agent_id IS NOT NULL;