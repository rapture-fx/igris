-- Migration 039: Persist signed robotics policy decisions for audit replay.
--
-- Receipt audit rows reference policy_decision_id. This table stores the full
-- signed control-plane decision so Overture can later reconstruct who allowed
-- which robot action under which policy and compare it with Runtime receipts.

CREATE TABLE IF NOT EXISTS robotics_policy_decision_audit (
    policy_decision_id TEXT PRIMARY KEY,
    task_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    runtime_id TEXT,
    policy_version TEXT NOT NULL,
    robot_action TEXT NOT NULL,
    robot_node_id TEXT NOT NULL,
    robot_target TEXT,
    permit BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    policy_decision_hash TEXT NOT NULL,
    policy_signature TEXT NOT NULL,
    signed_policy_decision JSONB NOT NULL,
    issued_at_unix_ms BIGINT NOT NULL,
    expires_at_unix_ms BIGINT NOT NULL,
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, policy_decision_id)
);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_decision_audit_task
    ON robotics_policy_decision_audit (tenant_id, task_id, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_decision_audit_policy
    ON robotics_policy_decision_audit (tenant_id, policy_version, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_decision_audit_action
    ON robotics_policy_decision_audit (tenant_id, robot_action, persisted_at DESC);
