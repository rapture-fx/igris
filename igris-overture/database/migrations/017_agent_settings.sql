-- Migration 017: agent_settings table, execution run control columns,
-- and ROS lifecycle pending_commands support.

-- ── 1. agent_settings ────────────────────────────────────────────────────────
-- Stores per-agent shadow_mode flag and assigned policy_hash.
-- Required by PATCH /v1/agents/:id and POST /v1/policies/assign.

CREATE TABLE IF NOT EXISTS agent_settings (
    agent_id    TEXT         NOT NULL,
    tenant_id   TEXT         NOT NULL,
    shadow_mode BOOLEAN      NOT NULL DEFAULT false,
    policy_hash TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_settings_tenant
    ON agent_settings (tenant_id);

-- ── 2. execution_lineage.status ──────────────────────────────────────────────
-- Allows run-control mutations (pause/cancel) to track execution state.

ALTER TABLE execution_lineage
    ADD COLUMN IF NOT EXISTS status TEXT;

-- ── 3. runtime_instances.pending_commands ────────────────────────────────────
-- Queued lifecycle commands delivered to runtimes on next heartbeat.
-- Used by POST /v1/ros/lifecycle.

ALTER TABLE runtime_instances
    ADD COLUMN IF NOT EXISTS pending_commands JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();
