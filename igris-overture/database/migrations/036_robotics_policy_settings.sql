-- Migration 036: DB-backed robotics policy decisions for governed ROS2 actions.
--
-- Overture evaluates this active tenant policy before signing a
-- governed_policy_decision.v1 payload for Runtime robotics dispatch.

CREATE TABLE IF NOT EXISTS robotics_policy_settings (
    tenant_id TEXT NOT NULL,
    policy_version TEXT NOT NULL DEFAULT 'robotics-policy.v1',
    status TEXT NOT NULL DEFAULT 'draft',
    permit BOOLEAN NOT NULL DEFAULT false,
    runtime_permitted BOOLEAN NOT NULL DEFAULT false,
    robot_mode TEXT NOT NULL DEFAULT 'disabled',
    allowed_runtimes JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by TEXT,
    updated_by TEXT,
    revoked_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_settings_active
    ON robotics_policy_settings (tenant_id, active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_settings_status
    ON robotics_policy_settings (tenant_id, status, updated_at DESC);
