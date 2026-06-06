-- Encrypted execution material for sensitive task/action inputs.
-- Normal task, evidence, proof, MCP, and console reads must use only the safe
-- reference metadata. Plaintext is never stored in this schema.

CREATE TABLE IF NOT EXISTS execution_input_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID,
    action_id UUID,
    purpose TEXT NOT NULL,
    ciphertext BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    aad JSONB NOT NULL DEFAULT '{}'::jsonb,
    digest_sha256 TEXT NOT NULL,
    plaintext_bytes INTEGER NOT NULL,
    content_type TEXT,
    redaction_policy_version TEXT NOT NULL,
    key_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_decrypted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS execution_input_refs_tenant_task_idx
    ON execution_input_refs (tenant_id, task_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS execution_input_refs_action_idx
    ON execution_input_refs (tenant_id, action_id, created_at DESC)
    WHERE action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS execution_input_refs_expiry_idx
    ON execution_input_refs (expires_at)
    WHERE expires_at IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS execution_input_refs_revoked_idx
    ON execution_input_refs (tenant_id, revoked_at)
    WHERE revoked_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS execution_input_ref_audit (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID,
    action_id UUID,
    input_ref_id UUID,
    purpose TEXT NOT NULL,
    actor_type TEXT NOT NULL DEFAULT 'system',
    event_type TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    success BOOLEAN NOT NULL DEFAULT false,
    failure_code TEXT NOT NULL DEFAULT '',
    key_version TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_input_ref_audit_tenant_task_idx
    ON execution_input_ref_audit (tenant_id, task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS execution_input_ref_audit_ref_idx
    ON execution_input_ref_audit (input_ref_id, created_at DESC)
    WHERE input_ref_id IS NOT NULL;
