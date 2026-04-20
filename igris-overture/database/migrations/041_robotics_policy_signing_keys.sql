-- Migration 041: Robotics policy lifecycle verifier keys.
--
-- Policy lifecycle commands are security-sensitive. This table stores the
-- tenant-scoped Ed25519 public keys that may approve lifecycle mutations.
-- Rotation is represented by key_version plus active/revoked/expired status.

CREATE TABLE IF NOT EXISTS robotics_policy_signing_keys (
    tenant_id TEXT NOT NULL,
    key_version TEXT NOT NULL,
    signer_identity TEXT NOT NULL,
    public_key_ed25519 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','revoked','expired')),
    not_before TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by TEXT,
    revoked_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, key_version)
);

CREATE INDEX IF NOT EXISTS idx_robotics_policy_signing_keys_active
    ON robotics_policy_signing_keys (tenant_id, status, not_before, expires_at);

ALTER TABLE robotics_policy_lifecycle_audit
    ADD COLUMN IF NOT EXISTS signer_key_version TEXT,
    ADD COLUMN IF NOT EXISTS command_signature TEXT;

CREATE INDEX IF NOT EXISTS idx_robotics_policy_lifecycle_audit_signer_key
    ON robotics_policy_lifecycle_audit (tenant_id, signer_key_version, occurred_at DESC);
