-- Migration 025: ROS topic activity tracking, containment, replay jobs,
-- and tenant policy limits table.

-- ROS topic activity: per-device live message tracking
CREATE TABLE IF NOT EXISTS ros_topic_activity (
    id              BIGSERIAL    PRIMARY KEY,
    device_id       TEXT         NOT NULL,
    topic_name      TEXT         NOT NULL,
    last_message_preview TEXT,
    last_seen_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    within_envelope BOOLEAN      NOT NULL DEFAULT true,
    UNIQUE (device_id, topic_name)
);

CREATE INDEX IF NOT EXISTS idx_ros_topic_activity_device
    ON ros_topic_activity (device_id);

-- ROS lifecycle states: per-device node state tracking
CREATE TABLE IF NOT EXISTS ros_lifecycle_states (
    id              BIGSERIAL    PRIMARY KEY,
    runtime_id      TEXT         NOT NULL UNIQUE,
    node_name       TEXT         NOT NULL DEFAULT 'igris_node',
    namespace       TEXT         NOT NULL DEFAULT '/',
    lifecycle_state TEXT         NOT NULL DEFAULT 'Unconfigured',
    air_gapped      BOOLEAN      NOT NULL DEFAULT false,
    last_trace_at   TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ros_lifecycle_runtime
    ON ros_lifecycle_states (runtime_id);

-- Device containment: safety containment config per device
CREATE TABLE IF NOT EXISTS device_containment (
    id              BIGSERIAL    PRIMARY KEY,
    device_id       TEXT         NOT NULL UNIQUE,
    enabled         BOOLEAN      NOT NULL DEFAULT true,
    mode            TEXT         NOT NULL DEFAULT 'cgroup',
    violation_count BIGINT       NOT NULL DEFAULT 0,
    cpu_quota       TEXT,
    memory_limit    TEXT,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ROS replay jobs
CREATE TABLE IF NOT EXISTS ros_replay_jobs (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       TEXT         NOT NULL,
    tenant_id       TEXT         NOT NULL,
    bag_filename    TEXT,
    status          TEXT         NOT NULL DEFAULT 'queued',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ros_replay_jobs_device
    ON ros_replay_jobs (device_id, status);

-- Tenant policy limits: BT envelope validation
CREATE TABLE IF NOT EXISTS tenant_policies (
    id                BIGSERIAL    PRIMARY KEY,
    tenant_id         TEXT         NOT NULL,
    max_action_nodes  INTEGER,
    max_depth         INTEGER,
    max_tool_calls    INTEGER,
    max_duration_secs INTEGER,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_policies_tenant
    ON tenant_policies (tenant_id);

-- Circuit breaker state: per-tenant, per-provider
CREATE TABLE IF NOT EXISTS circuit_breaker_states (
    id               BIGSERIAL    PRIMARY KEY,
    tenant_id        TEXT         NOT NULL,
    provider         TEXT         NOT NULL,
    state            TEXT         NOT NULL DEFAULT 'closed',  -- closed | open | half-open
    trip_count       INTEGER      NOT NULL DEFAULT 0,
    failure_count    INTEGER      NOT NULL DEFAULT 0,
    last_tripped_at  TIMESTAMPTZ,
    last_success_at  TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_tenant
    ON circuit_breaker_states (tenant_id);
