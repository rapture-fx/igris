-- Migration 022: BT live-streaming state + ROS2 topic discovery columns
-- Applied: 2026-03-26
--
-- Adds:
--   runtime_instances.bt_state            JSONB  -- per-tick BT snapshot from executor
--   runtime_instances.bt_state_updated_at TIMESTAMPTZ -- when bt_state was last written
--   runtime_instances.ros_topics          JSONB  -- dynamic topic list from ROS2 node

ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS bt_state            JSONB        DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bt_state_updated_at TIMESTAMPTZ  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ros_topics          JSONB        DEFAULT '[]'::jsonb;

-- Index for fast SSE polling — ordered by update time per (tenant, machine).
CREATE INDEX IF NOT EXISTS idx_runtime_instances_bt_state_updated
    ON runtime_instances (tenant_id, machine_id, bt_state_updated_at DESC NULLS LAST);

COMMENT ON COLUMN runtime_instances.bt_state IS
    'Latest BT tick snapshot: {"tick":N,"status":"Running"|"Success"|"Failure","tree":{...}}. Written by runtime heartbeat during active execution.';

COMMENT ON COLUMN runtime_instances.bt_state_updated_at IS
    'Timestamp of most recent bt_state write. Used by SSE endpoint to detect changes.';

COMMENT ON COLUMN runtime_instances.ros_topics IS
    'Dynamic list of ROS2 topics/services discovered by this runtime instance. Merged with ros_topic_mappings in GET /v1/ros/discovery.';
