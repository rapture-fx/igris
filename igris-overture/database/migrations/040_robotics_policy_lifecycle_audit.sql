-- Migration 040: Immutable robotics policy lifecycle audit.
--
-- Policy lifecycle changes are security-sensitive because they can authorize
-- robot execution. This append-only table records who changed a policy, which
-- identity signed/approved the change, and the returned policy snapshot.

CREATE TABLE IF NOT EXISTS robotics_policy_lifecycle_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('draft','update','allow_list','activate','expire','revoke')),
    actor_id TEXT NOT NULL,
    actor_email TEXT,
    signer_identity TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    policy_snapshot JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_lifecycle_audit_policy
    ON robotics_policy_lifecycle_audit (tenant_id, policy_version, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_lifecycle_audit_actor
    ON robotics_policy_lifecycle_audit (tenant_id, actor_id, occurred_at DESC);
