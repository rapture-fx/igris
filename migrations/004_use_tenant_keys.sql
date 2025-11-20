-- Migration: 004_use_tenant_keys
-- Purpose: Replace tenant_api_keys with superior tenant_keys schema (IV/tag/version separated)
-- Phase: BYOK Enhancement - Full encryption metadata support
-- Date: 2025-11-20

-- ============================================================================
-- DROP OLD TABLE (after migration - see cmd/migrate-byok)
-- ============================================================================
-- Note: DO NOT drop tenant_api_keys yet - migration binary needs to read from it
-- After successful migration run: DROP TABLE IF EXISTS tenant_api_keys CASCADE;

-- ============================================================================
-- CREATE SUPERIOR tenant_keys TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_keys (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant isolation
    tenant_id VARCHAR(255) NOT NULL,

    -- Provider information
    provider VARCHAR(100) NOT NULL,  -- "openai", "anthropic", "google", "cohere", "azure"
    key_name VARCHAR(255) NOT NULL,  -- "default", "production", "backup"

    -- AES-256-GCM encrypted key with separated components
    encrypted_key TEXT NOT NULL,     -- Base64-encoded ciphertext ONLY
    encryption_iv TEXT NOT NULL,     -- Base64-encoded initialization vector
    encryption_tag TEXT NOT NULL,    -- Base64-encoded authentication tag
    key_version INT NOT NULL DEFAULT 1,  -- For key rotation support

    -- Key status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_valid BOOLEAN,                -- NULL = not validated, true/false = validated

    -- Validation tracking
    last_validated_at TIMESTAMP WITH TIME ZONE,
    validation_error TEXT,           -- Error message if validation failed
    validation_attempts INT NOT NULL DEFAULT 0,

    -- Usage tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count BIGINT NOT NULL DEFAULT 0,

    -- Expiration support
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,  -- User ID or "migration" or "system"
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255),

    -- Rotation tracking
    rotated_from_key_id UUID,        -- Previous key ID if this is a rotation
    rotated_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_provider CHECK (provider IN ('openai', 'anthropic', 'google', 'cohere', 'azure', 'benchmark')),
    CONSTRAINT valid_key_version CHECK (key_version > 0),
    CONSTRAINT valid_usage_count CHECK (usage_count >= 0),
    CONSTRAINT valid_validation_attempts CHECK (validation_attempts >= 0),

    -- Unique constraint: one active key per tenant+provider+name
    UNIQUE(tenant_id, provider, key_name, is_active)
        WHERE is_active = true
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenant_keys_tenant
    ON tenant_keys(tenant_id);

-- Fast provider filtering
CREATE INDEX IF NOT EXISTS idx_tenant_keys_provider
    ON tenant_keys(provider);

-- Active key queries (most common)
CREATE INDEX IF NOT EXISTS idx_tenant_keys_active
    ON tenant_keys(tenant_id, provider, key_name)
    WHERE is_active = true;

-- Invalid key detection for automated validation
CREATE INDEX IF NOT EXISTS idx_tenant_keys_invalid
    ON tenant_keys(tenant_id, provider)
    WHERE is_valid = false;

-- Expiring keys for background cleanup
CREATE INDEX IF NOT EXISTS idx_tenant_keys_expiring
    ON tenant_keys(expires_at)
    WHERE expires_at IS NOT NULL AND is_active = true;

-- Key rotation lookups
CREATE INDEX IF NOT EXISTS idx_tenant_keys_rotation
    ON tenant_keys(rotated_from_key_id)
    WHERE rotated_from_key_id IS NOT NULL;

-- Time-series queries
CREATE INDEX IF NOT EXISTS idx_tenant_keys_created
    ON tenant_keys(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_keys_last_used
    ON tenant_keys(last_used_at DESC)
    WHERE last_used_at IS NOT NULL;

-- ============================================================================
-- FOREIGN KEY to tenants table (if exists)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        ALTER TABLE tenant_keys
            ADD CONSTRAINT fk_tenant_keys_tenant
            FOREIGN KEY (tenant_id)
            REFERENCES tenants(tenant_id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenant_keys_updated_at
    BEFORE UPDATE ON tenant_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_keys_updated_at();

-- Deactivate old keys on rotation
CREATE OR REPLACE FUNCTION deactivate_old_key_on_rotation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rotated_from_key_id IS NOT NULL THEN
        UPDATE tenant_keys
        SET is_active = false,
            updated_at = NOW(),
            updated_by = NEW.created_by
        WHERE id = NEW.rotated_from_key_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deactivate_old_key_on_rotation
    AFTER INSERT ON tenant_keys
    FOR EACH ROW
    WHEN (NEW.rotated_from_key_id IS NOT NULL)
    EXECUTE FUNCTION deactivate_old_key_on_rotation();

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Store new tenant key with full encryption metadata
CREATE OR REPLACE FUNCTION store_tenant_key(
    p_tenant_id VARCHAR(255),
    p_provider VARCHAR(100),
    p_key_name VARCHAR(255),
    p_encrypted_key TEXT,
    p_encryption_iv TEXT,
    p_encryption_tag TEXT,
    p_created_by VARCHAR(255)
) RETURNS UUID AS $$
DECLARE
    v_key_id UUID;
BEGIN
    -- Deactivate any existing active keys for this tenant+provider+name
    UPDATE tenant_keys
    SET is_active = false,
        updated_at = NOW(),
        updated_by = p_created_by
    WHERE tenant_id = p_tenant_id
      AND provider = p_provider
      AND key_name = p_key_name
      AND is_active = true;

    -- Insert new key
    INSERT INTO tenant_keys (
        tenant_id,
        provider,
        key_name,
        encrypted_key,
        encryption_iv,
        encryption_tag,
        key_version,
        is_active,
        created_by
    ) VALUES (
        p_tenant_id,
        p_provider,
        p_key_name,
        p_encrypted_key,
        p_encryption_iv,
        p_encryption_tag,
        1,
        true,
        p_created_by
    ) RETURNING id INTO v_key_id;

    RETURN v_key_id;
END;
$$ LANGUAGE plpgsql;

-- Rotate key (creates new version, deactivates old)
CREATE OR REPLACE FUNCTION rotate_tenant_key(
    p_tenant_id VARCHAR(255),
    p_provider VARCHAR(100),
    p_key_name VARCHAR(255),
    p_new_encrypted_key TEXT,
    p_new_encryption_iv TEXT,
    p_new_encryption_tag TEXT,
    p_rotated_by VARCHAR(255)
) RETURNS UUID AS $$
DECLARE
    v_old_key_id UUID;
    v_old_version INT;
    v_new_key_id UUID;
BEGIN
    -- Get current active key
    SELECT id, key_version INTO v_old_key_id, v_old_version
    FROM tenant_keys
    WHERE tenant_id = p_tenant_id
      AND provider = p_provider
      AND key_name = p_key_name
      AND is_active = true
    LIMIT 1;

    IF v_old_key_id IS NULL THEN
        RAISE EXCEPTION 'No active key found for rotation: tenant=% provider=% name=%',
            p_tenant_id, p_provider, p_key_name;
    END IF;

    -- Insert new rotated key
    INSERT INTO tenant_keys (
        tenant_id,
        provider,
        key_name,
        encrypted_key,
        encryption_iv,
        encryption_tag,
        key_version,
        is_active,
        created_by,
        rotated_from_key_id,
        rotated_at
    ) VALUES (
        p_tenant_id,
        p_provider,
        p_key_name,
        p_new_encrypted_key,
        p_new_encryption_iv,
        p_new_encryption_tag,
        v_old_version + 1,
        true,
        p_rotated_by,
        v_old_key_id,
        NOW()
    ) RETURNING id INTO v_new_key_id;

    -- Old key deactivated by trigger

    RETURN v_new_key_id;
END;
$$ LANGUAGE plpgsql;

-- Mark key as validated
CREATE OR REPLACE FUNCTION mark_key_validated(
    p_key_id UUID,
    p_is_valid BOOLEAN,
    p_validation_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE tenant_keys
    SET is_valid = p_is_valid,
        last_validated_at = NOW(),
        validation_error = p_validation_error,
        validation_attempts = validation_attempts + 1,
        updated_at = NOW()
    WHERE id = p_key_id;
END;
$$ LANGUAGE plpgsql;

-- Expire key
CREATE OR REPLACE FUNCTION expire_tenant_key(
    p_key_id UUID,
    p_expired_by VARCHAR(255)
) RETURNS VOID AS $$
BEGIN
    UPDATE tenant_keys
    SET is_active = false,
        expires_at = NOW(),
        updated_at = NOW(),
        updated_by = p_expired_by
    WHERE id = p_key_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE tenant_keys IS 'AES-256-GCM encrypted storage for tenant API keys (BYOK) with separated IV/tag/version';
COMMENT ON COLUMN tenant_keys.encrypted_key IS 'Base64-encoded AES-256-GCM ciphertext (without tag)';
COMMENT ON COLUMN tenant_keys.encryption_iv IS 'Base64-encoded initialization vector for AES-256-GCM';
COMMENT ON COLUMN tenant_keys.encryption_tag IS 'Base64-encoded authentication tag for AES-256-GCM (16 bytes)';
COMMENT ON COLUMN tenant_keys.key_version IS 'Incremented on each rotation (1, 2, 3, ...)';
COMMENT ON COLUMN tenant_keys.is_valid IS 'NULL=not validated, true=valid, false=invalid';
COMMENT ON COLUMN tenant_keys.rotated_from_key_id IS 'Previous key ID in rotation chain';

-- ============================================================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_keys TO schlep_api_role;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO schlep_api_role;
