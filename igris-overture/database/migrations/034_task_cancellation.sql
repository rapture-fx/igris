-- Migration 034: Durable task cancellation state.
-- Adds a terminal canceled status so task cancellation is explicit and
-- enforced across recovery, checkpoint, complete, and failed paths.

ALTER TABLE task_records
    DROP CONSTRAINT IF EXISTS task_records_status_check;

ALTER TABLE task_records
    ADD CONSTRAINT task_records_status_check
    CHECK (status IN ('pending','dispatched','checkpointed','completed','failed','recovering','canceled'));

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
