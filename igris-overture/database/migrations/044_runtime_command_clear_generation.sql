-- Migration 044: runtime command clear generation
-- Tracks explicit operator-driven queue invalidation so runtimes can discard
-- already-spooled commands after a control-plane clear action.

ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS pending_commands_clear_generation BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN runtime_instances.pending_commands_clear_generation IS
    'Monotonic counter incremented when Overture explicitly clears a runtime command queue; runtimes discard locally spooled commands when this generation advances.';
