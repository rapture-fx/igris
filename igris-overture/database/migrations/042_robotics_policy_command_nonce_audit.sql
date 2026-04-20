-- Migration 042: Signed robotics policy command replay protection.
--
-- Lifecycle commands are signed by tenant-scoped policy keys. Nonces make each
-- command single-use, and immutable key audit rows provide a durable key
-- rotation trail independent of policy setting audit rows.

ALTER TABLE robotics_policy_signing_keys
    DROP CONSTRAINT IF EXISTS robotics_policy_signing_keys_status_check;

ALTER TABLE robotics_policy_signing_keys
    ADD CONSTRAINT robotics_policy_signing_keys_status_check
    CHECK (status IN ('draft','active','revoked','expired'));

CREATE TABLE IF NOT EXISTS robotics_policy_command_nonces (
    tenant_id TEXT NOT NULL,
    key_version TEXT NOT NULL,
    action TEXT NOT NULL,
    nonce TEXT NOT NULL,
    command_hash TEXT NOT NULL,
    command_signature TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    signer_identity TEXT NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, key_version, action, nonce)
);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_command_nonces_expiry
    ON robotics_policy_command_nonces (expires_at);

ALTER TABLE robotics_policy_lifecycle_audit
    ADD COLUMN IF NOT EXISTS command_nonce TEXT,
    ADD COLUMN IF NOT EXISTS command_hash TEXT;

CREATE TABLE IF NOT EXISTS robotics_policy_key_lifecycle_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    key_version TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create','activate','revoke','expire')),
    actor_id TEXT NOT NULL,
    actor_email TEXT,
    signer_identity TEXT NOT NULL,
    signer_key_version TEXT,
    command_nonce TEXT,
    command_hash TEXT,
    command_signature TEXT,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    key_snapshot JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_key_lifecycle_audit_key
    ON robotics_policy_key_lifecycle_audit (tenant_id, key_version, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_key_lifecycle_audit_actor
    ON robotics_policy_key_lifecycle_audit (tenant_id, actor_id, occurred_at DESC);
