-- Migration 055: Unified Action execution target vocabulary (Slice 1).
--
-- Adds the schema fields needed for the unified Action execution model:
--   - action_definitions.fallback_policy : explicit fallback config (default disabled)
--   - task_records.executed_target       : which execution target actually ran a task
--   - task_records.fallback_reason       : structured reason when a fallback was used
--
-- This slice is additive. No existing rows are rewritten, no defaults are
-- backfilled with synthetic values, and no execution behavior changes from
-- this migration alone. Future slices populate executed_target / fallback_reason.

-- ── Action definitions ────────────────────────────────────────────────────

ALTER TABLE action_definitions
    ADD COLUMN IF NOT EXISTS fallback_policy JSONB NOT NULL DEFAULT '{"enabled": false}'::jsonb;

-- ── Task records: which target actually ran this task ───────────────────

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS executed_target TEXT;

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS fallback_reason TEXT;

-- executed_target is informational; restrict it to the canonical vocabulary
-- so callers cannot stamp arbitrary strings. NULL is allowed for pre-existing
-- rows and for runs where no target has been resolved yet.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'task_records_executed_target_check'
    ) THEN
        ALTER TABLE task_records
            ADD CONSTRAINT task_records_executed_target_check
            CHECK (
                executed_target IS NULL
                OR executed_target IN ('hosted_api', 'webhook', 'local_runtime', 'hybrid_fallback', 'mock_demo')
            );
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS task_records_executed_target_idx
    ON task_records (executed_target)
    WHERE executed_target IS NOT NULL;
