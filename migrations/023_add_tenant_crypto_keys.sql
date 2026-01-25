-- Migration: 023_add_tenant_crypto_keys
-- Description: Add tenant Ed25519 key management for cryptographic decision signing
-- Date: 2026-01-25

-- Create tenant crypto keys table
CREATE TABLE IF NOT EXISTS tenant_crypto_keys (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_version INTEGER NOT NULL DEFAULT 1,
    public_key BYTEA NOT NULL,                    -- Ed25519 public key (32 bytes)
    encrypted_private_key BYTEA NOT NULL,          -- AES-256-GCM encrypted private key
    encryption_nonce BYTEA NOT NULL,               -- GCM nonce (12 bytes)
    key_encryption_key_id TEXT,                    -- Reference to KEK in Vault/HSM
    algorithm TEXT NOT NULL DEFAULT 'Ed25519',
    purpose TEXT NOT NULL DEFAULT 'decision_signing', -- decision_signing, telemetry_verification
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMP WITH TIME ZONE,

    -- Ensure only one active key per tenant per purpose
    CONSTRAINT unique_active_key UNIQUE (tenant_id, purpose, is_active)
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT valid_public_key_length CHECK (length(public_key) = 32),
    CONSTRAINT valid_nonce_length CHECK (length(encryption_nonce) = 12)
);

-- Create index for key lookups
CREATE INDEX idx_tenant_crypto_keys_tenant_active ON tenant_crypto_keys(tenant_id, is_active, purpose)
    WHERE is_active = TRUE;

CREATE INDEX idx_tenant_crypto_keys_version ON tenant_crypto_keys(tenant_id, key_version DESC);

-- Add RLS policies
ALTER TABLE tenant_crypto_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_crypto_keys_tenant_policy ON tenant_crypto_keys
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- Create decision execution audit table for hybrid closed-loop verification
CREATE TABLE IF NOT EXISTS decision_execution_audit (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    decision_id TEXT NOT NULL,
    request_id TEXT NOT NULL,

    -- Signed decision from Overture
    signed_decision JSONB NOT NULL,            -- {decision, timestamp, tenant_id, nonce}
    decision_signature TEXT NOT NULL,          -- Base64-encoded Ed25519 signature
    decision_key_version INTEGER NOT NULL,

    -- Signed execution envelope from Runtime
    execution_envelope JSONB,                  -- {result, decision_hash, timestamp, agent_id}
    execution_signature TEXT,                  -- Base64-encoded signature

    -- Verification status
    decision_verified BOOLEAN NOT NULL DEFAULT FALSE,
    execution_verified BOOLEAN,
    verification_status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, failed, tamper_detected
    verification_error TEXT,

    -- Outcome
    execution_success BOOLEAN,
    latency_ms INTEGER,
    provider_id TEXT,

    -- Timestamps
    decision_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    execution_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT unique_decision_audit UNIQUE (tenant_id, decision_id)
);

-- Indexes for audit queries
CREATE INDEX idx_decision_audit_tenant_time ON decision_execution_audit(tenant_id, created_at DESC);
CREATE INDEX idx_decision_audit_status ON decision_execution_audit(verification_status)
    WHERE verification_status != 'verified';
CREATE INDEX idx_decision_audit_request ON decision_execution_audit(request_id);

-- Add RLS
ALTER TABLE decision_execution_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_execution_audit_tenant_policy ON decision_execution_audit
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', TRUE));

-- Create nonce tracking table for anti-replay
CREATE TABLE IF NOT EXISTS decision_nonces (
    nonce TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    decision_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for cleanup
CREATE INDEX idx_decision_nonces_expires ON decision_nonces(expires_at);

-- Cleanup function for expired nonces
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void AS $$
BEGIN
    DELETE FROM decision_nonces WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE tenant_crypto_keys IS 'Ed25519 keypairs for tenant decision signing in hybrid execution';
COMMENT ON TABLE decision_execution_audit IS 'Immutable audit log of signed routing decisions and execution results';
COMMENT ON TABLE decision_nonces IS 'Nonce tracking for anti-replay protection (±5 minute window)';
COMMENT ON COLUMN tenant_crypto_keys.encrypted_private_key IS 'AES-256-GCM encrypted Ed25519 private key (32 bytes plaintext)';
COMMENT ON COLUMN decision_execution_audit.verification_status IS 'pending=awaiting verification, verified=all signatures valid, failed=verification error, tamper_detected=signature mismatch';
