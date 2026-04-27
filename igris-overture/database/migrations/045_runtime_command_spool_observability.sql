-- Migration 045: runtime local command spool observability
-- Mirrors runtime-local command spool state into the control plane so operator
-- surfaces report real queued work after command ownership handoff.

ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS local_command_spool_depth BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS local_command_clear_generation BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN runtime_instances.local_command_spool_depth IS
    'Runtime-reported depth of the locally persisted control-plane command spool after ownership handoff.';

COMMENT ON COLUMN runtime_instances.local_command_clear_generation IS
    'Runtime-reported clear generation applied to the local command spool.';
