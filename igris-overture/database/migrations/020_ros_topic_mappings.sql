-- Migration 020: ROS 2 topic mappings
CREATE TABLE IF NOT EXISTS ros_topic_mappings (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT    NOT NULL,
    bt_action       TEXT    NOT NULL,
    topic_name      TEXT    NOT NULL,
    message_type    TEXT    NOT NULL DEFAULT 'std_msgs/String',
    direction       TEXT    NOT NULL DEFAULT 'publish' CHECK (direction IN ('publish','subscribe')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ros_topic_mappings_tenant ON ros_topic_mappings (tenant_id);
