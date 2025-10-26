-- Migration: 003_create_api_keys_table
-- Purpose: Create encrypted API key storage for tenant BYOK
-- Phase: 2 - Multi-Tenancy Security
-- Date: 2025-10-25

-- Create tenant_api_keys table for encrypted key storage
CREATE TABLE IF NOT EXISTS tenant_api_keys (
    key_id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Provider information
    provider VARCHAR(100) NOT NULL, -- "openai", "anthropic", etc.

    -- Encrypted key storage
    encrypted_key TEXT NOT NULL, -- AES-256 encrypted API key
    key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for validation

    -- Key metadata
    key_name VARCHAR(255), -- Optional user-friendly name
    key_prefix VARCHAR(20), -- e.g., "sk-...", for display only

    -- Validation
    is_valid BOOLEAN NOT NULL DEFAULT false,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    validation_error TEXT,

    -- Usage tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    total_requests BIGINT NOT NULL DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_provider CHECK (provider IN ('openai', 'anthropic', 'google', 'cohere', 'azure')),
    UNIQUE(tenant_id, provider, key_hash) -- Prevent duplicate keys
);

-- Indexes for tenant_api_keys
CREATE INDEX idx_api_keys_tenant ON tenant_api_keys(tenant_id);
CREATE INDEX idx_api_keys_provider ON tenant_api_keys(provider);
CREATE INDEX idx_api_keys_active ON tenant_api_keys(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_api_keys_hash ON tenant_api_keys(key_hash);

-- Add comments
COMMENT ON TABLE tenant_api_keys IS 'Encrypted storage for tenant-provided API keys (BYOK model)';
COMMENT ON COLUMN tenant_api_keys.encrypted_key IS 'API key encrypted with VAULT_MASTER_KEY using AES-256';
COMMENT ON COLUMN tenant_api_keys.key_hash IS 'SHA-256 hash of the key for duplicate detection';
COMMENT ON COLUMN tenant_api_keys.key_prefix IS 'First few characters of the key for UI display (e.g., "sk-...ABC")';

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_keys_updated_at
    BEFORE UPDATE ON tenant_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- Trigger to track last_used_at
CREATE OR REPLACE FUNCTION track_api_key_usage()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_requests = NEW.total_requests + 1;
    NEW.last_used_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
