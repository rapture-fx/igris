-- Migration 037: Robotics receipt audit index.
--
-- Runtime receipts remain stored as signed JSON on task_records and in
-- execution_lineage. This table indexes governed ROS2 receipts by task,
-- policy decision, and robot action for audit queries.

CREATE TABLE IF NOT EXISTS robotics_receipt_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    runtime_id TEXT,
    execution_id TEXT NOT NULL,
    policy_decision_id TEXT NOT NULL,
    policy_decision_hash TEXT,
    governed_action_hash TEXT,
    robot_action TEXT NOT NULL,
    routing_decision TEXT NOT NULL,
    receipt_hash TEXT,
    receipt_signature TEXT,
    envelope_signature TEXT,
    violation_occurred BOOLEAN NOT NULL DEFAULT false,
    violation TEXT,
    execution_envelope JSONB NOT NULL,
    execution_receipt JSONB NOT NULL,
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, execution_id, policy_decision_id)
);

CREATE INDEX IF NOT EXISTS idx_robotics_receipt_audit_task
    ON robotics_receipt_audit (tenant_id, task_id, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_robotics_receipt_audit_policy
    ON robotics_receipt_audit (tenant_id, policy_decision_id, persisted_at DESC);

CREATE INDEX IF NOT EXISTS idx_robotics_receipt_audit_action
    ON robotics_receipt_audit (tenant_id, robot_action, persisted_at DESC);
