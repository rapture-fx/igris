-- 046_runtime_command_statuses.sql
-- Persist operator-visible runtime-local command lifecycle states reported by heartbeats.

ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS local_command_statuses JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN runtime_instances.local_command_statuses IS
    'Latest runtime-reported command lifecycle states for queued/owned/executing/revoked/cancelled local spool entries.';
