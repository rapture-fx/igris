-- Migration: 002_multi_tenancy
-- Description: Add multi-tenancy and BYOK vault support (Phase 14)
-- Author: Schlep-engine Team
-- Date: 2025-10-20

BEGIN;

-- ============================================================================
-- TABLE: tenants
-- Purpose: Store tenant information and configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) UNIQUE NOT NULL,  -- Human-readable ID (e.g., "acme-corp")
    tenant_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, suspended, deleted

    -- API key authentication
    api_key_hash VARCHAR(255) NOT NULL,  -- Hashed API key for authentication
    api_key_prefix VARCHAR(10) NOT NULL, -- First few chars for identification

    -- Contact and billing
    email VARCHAR(255),
    company VARCHAR(255),

    -- Settings
    settings JSONB DEFAULT '{}',  -- Flexible settings storage

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    last_login_at TIMESTAMP,

    -- Ensure unique tenant_id
    CONSTRAINT tenant_id_format CHECK (tenant_id ~ '^[a-z0-9-]+$')
);

-- Index for tenant lookups by API key prefix
CREATE INDEX IF NOT EXISTS idx_tenants_api_key_prefix
    ON tenants(api_key_prefix);

-- Index for tenant status filtering
CREATE INDEX IF NOT EXISTS idx_tenants_status
    ON tenants(status) WHERE status = 'active';

-- ============================================================================
-- TABLE: tenant_keys (BYOK Vault)
-- Purpose: Store encrypted provider API keys per tenant
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,  -- "openai", "anthropic", "benchmark"
    key_name VARCHAR(100) NOT NULL,  -- User-friendly name

    -- Encrypted key storage (AES-256-GCM)
    encrypted_key TEXT NOT NULL,  -- Base64-encoded encrypted key
    encryption_iv TEXT NOT NULL,   -- Initialization vector
    encryption_tag TEXT NOT NULL,  -- Authentication tag
    key_version INTEGER DEFAULT 1,  -- For key rotation

    -- Key metadata
    is_active BOOLEAN DEFAULT TRUE,
    is_valid BOOLEAN DEFAULT NULL,  -- NULL = not validated, TRUE = valid, FALSE = invalid
    last_validated_at TIMESTAMP,
    validation_error TEXT,

    -- Usage tracking
    last_used_at TIMESTAMP,
    usage_count BIGINT DEFAULT 0,

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),

    -- Ensure unique key per tenant per provider
    UNIQUE(tenant_id, provider, key_name)
);

-- Index for active key lookups
CREATE INDEX IF NOT EXISTS idx_tenant_keys_active
    ON tenant_keys(tenant_id, provider, is_active)
    WHERE is_active = TRUE;

-- Index for key validation status
CREATE INDEX IF NOT EXISTS idx_tenant_keys_validation
    ON tenant_keys(is_valid, last_validated_at);

-- ============================================================================
-- TABLE: tenant_sessions (JWT Token Management)
-- Purpose: Track active JWT sessions for revocation and monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,  -- SHA256 hash of JWT

    -- Session metadata
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,

    -- Request context
    ip_address INET,
    user_agent TEXT,

    -- Usage tracking
    last_used_at TIMESTAMP DEFAULT NOW(),
    request_count BIGINT DEFAULT 0
);

-- Index for active session lookups
CREATE INDEX IF NOT EXISTS idx_tenant_sessions_active
    ON tenant_sessions(tenant_id, token_hash)
    WHERE revoked_at IS NULL AND expires_at > NOW();

-- Index for session expiry cleanup
CREATE INDEX IF NOT EXISTS idx_tenant_sessions_expired
    ON tenant_sessions(expires_at)
    WHERE revoked_at IS NULL AND expires_at <= NOW();

-- ============================================================================
-- TABLE: tenant_policies (Per-Tenant Policy Overrides)
-- Purpose: Store tenant-specific policy overrides
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Budget policies (override global defaults)
    max_monthly_cost_usd DECIMAL(12, 4),
    enable_budget_limit BOOLEAN DEFAULT TRUE,
    fallback_on_budget_breach BOOLEAN DEFAULT TRUE,

    -- Token policies
    max_tokens_per_request INTEGER,
    enable_token_limit BOOLEAN DEFAULT TRUE,

    -- Benchmark fallback policies
    enable_benchmark_fallback BOOLEAN DEFAULT TRUE,

    -- Rate limiting (Phase 14 new)
    max_requests_per_minute INTEGER,
    max_requests_per_hour INTEGER,
    max_requests_per_day INTEGER,
    enable_rate_limiting BOOLEAN DEFAULT FALSE,

    -- Alert settings (Phase 14 new)
    alert_webhook_url TEXT,
    alert_on_budget_80_percent BOOLEAN DEFAULT TRUE,
    alert_on_budget_100_percent BOOLEAN DEFAULT TRUE,
    alert_on_key_validation_failure BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    -- Ensure one policy per tenant
    UNIQUE(tenant_id)
);

-- ============================================================================
-- UPDATE EXISTING TABLES: Add tenant_id foreign keys
-- ============================================================================

-- Update budgets table to reference tenants
ALTER TABLE budgets
    DROP CONSTRAINT IF EXISTS budgets_tenant_id_fkey;

ALTER TABLE budgets
    ADD CONSTRAINT budgets_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;

-- Update spending_log table
ALTER TABLE spending_log
    DROP CONSTRAINT IF EXISTS spending_log_tenant_id_fkey;

ALTER TABLE spending_log
    ADD CONSTRAINT spending_log_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;

-- Update audit_events table
ALTER TABLE audit_events
    DROP CONSTRAINT IF EXISTS audit_events_tenant_id_fkey;

ALTER TABLE audit_events
    ADD CONSTRAINT audit_events_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;

-- Update policy_settings table
ALTER TABLE policy_settings
    DROP CONSTRAINT IF EXISTS policy_settings_tenant_id_fkey;

ALTER TABLE policy_settings
    ADD CONSTRAINT policy_settings_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;

-- ============================================================================
-- FUNCTIONS: Tenant management functions
-- ============================================================================

-- Function: Create tenant
CREATE OR REPLACE FUNCTION create_tenant(
    p_tenant_id VARCHAR(255),
    p_tenant_name VARCHAR(255),
    p_api_key_hash VARCHAR(255),
    p_api_key_prefix VARCHAR(10),
    p_email VARCHAR(255) DEFAULT NULL,
    p_created_by VARCHAR(255) DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO tenants (
        tenant_id, tenant_name, api_key_hash, api_key_prefix,
        email, created_by
    ) VALUES (
        p_tenant_id, p_tenant_name, p_api_key_hash, p_api_key_prefix,
        p_email, p_created_by
    ) RETURNING id INTO v_id;

    -- Create default budget for current month
    INSERT INTO budgets (tenant_id, year_month, budget_limit_usd)
    VALUES (p_tenant_id, TO_CHAR(NOW(), 'YYYY-MM'), 5.0);

    -- Create default policy
    INSERT INTO tenant_policies (tenant_id, max_monthly_cost_usd, max_tokens_per_request)
    VALUES (p_tenant_id, 5.0, 1024);

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Store encrypted key
CREATE OR REPLACE FUNCTION store_tenant_key(
    p_tenant_id VARCHAR(255),
    p_provider VARCHAR(50),
    p_key_name VARCHAR(100),
    p_encrypted_key TEXT,
    p_encryption_iv TEXT,
    p_encryption_tag TEXT,
    p_created_by VARCHAR(255) DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
    v_key_id UUID;
BEGIN
    -- Deactivate existing keys for this provider
    UPDATE tenant_keys
    SET is_active = FALSE, updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider = p_provider;

    -- Insert new key
    INSERT INTO tenant_keys (
        tenant_id, provider, key_name, encrypted_key,
        encryption_iv, encryption_tag, created_by
    ) VALUES (
        p_tenant_id, p_provider, p_key_name, p_encrypted_key,
        p_encryption_iv, p_encryption_tag, p_created_by
    ) RETURNING id INTO v_key_id;

    RETURN v_key_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update tenant last login
CREATE OR REPLACE FUNCTION update_tenant_last_login(
    p_tenant_id VARCHAR(255)
) RETURNS VOID AS $$
BEGIN
    UPDATE tenants
    SET last_login_at = NOW()
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Revoke session
CREATE OR REPLACE FUNCTION revoke_session(
    p_token_hash VARCHAR(255),
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_found BOOLEAN;
BEGIN
    UPDATE tenant_sessions
    SET revoked_at = NOW(), revoked_reason = p_reason
    WHERE token_hash = p_token_hash AND revoked_at IS NULL
    RETURNING TRUE INTO v_found;

    RETURN COALESCE(v_found, FALSE);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS: Multi-tenant reporting views
-- ============================================================================

-- View: Active tenants summary
CREATE OR REPLACE VIEW v_active_tenants AS
SELECT
    t.tenant_id,
    t.tenant_name,
    t.status,
    t.email,
    t.created_at,
    t.last_login_at,
    COUNT(DISTINCT tk.id) as key_count,
    COUNT(DISTINCT b.id) as budget_count,
    COALESCE(SUM(b.total_spend_usd), 0) as total_lifetime_spend
FROM tenants t
LEFT JOIN tenant_keys tk ON t.tenant_id = tk.tenant_id AND tk.is_active = TRUE
LEFT JOIN budgets b ON t.tenant_id = b.tenant_id
WHERE t.status = 'active'
GROUP BY t.tenant_id, t.tenant_name, t.status, t.email, t.created_at, t.last_login_at;

-- View: Tenant usage summary
CREATE OR REPLACE VIEW v_tenant_usage_summary AS
SELECT
    t.tenant_id,
    t.tenant_name,
    b.year_month,
    b.total_spend_usd,
    b.budget_limit_usd,
    b.request_count,
    b.breached,
    tp.max_monthly_cost_usd as policy_limit,
    COUNT(DISTINCT sl.provider) as providers_used,
    COUNT(DISTINCT sl.model) as models_used
FROM tenants t
LEFT JOIN budgets b ON t.tenant_id = b.tenant_id
LEFT JOIN tenant_policies tp ON t.tenant_id = tp.tenant_id
LEFT JOIN spending_log sl ON b.id = sl.budget_id
WHERE b.year_month = TO_CHAR(NOW(), 'YYYY-MM')
GROUP BY t.tenant_id, t.tenant_name, b.year_month, b.total_spend_usd,
         b.budget_limit_usd, b.request_count, b.breached, tp.max_monthly_cost_usd;

-- View: Key validation status
CREATE OR REPLACE VIEW v_tenant_keys_status AS
SELECT
    tk.tenant_id,
    t.tenant_name,
    tk.provider,
    tk.key_name,
    tk.is_active,
    tk.is_valid,
    tk.last_validated_at,
    tk.validation_error,
    tk.usage_count,
    tk.last_used_at,
    tk.created_at
FROM tenant_keys tk
JOIN tenants t ON tk.tenant_id = t.tenant_id
WHERE tk.is_active = TRUE
ORDER BY tk.tenant_id, tk.provider;

-- ============================================================================
-- TRIGGERS: Automatic timestamp updates
-- ============================================================================

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_keys_updated_at
    BEFORE UPDATE ON tenant_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_policies_updated_at
    BEFORE UPDATE ON tenant_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Create default tenant for backward compatibility
-- ============================================================================

-- Create default tenant (for backward compatibility with Phase 13)
INSERT INTO tenants (
    tenant_id, tenant_name, api_key_hash, api_key_prefix, status, email
) VALUES (
    'default',
    'Default Tenant',
    'none',  -- No authentication for default tenant
    'none',
    'active',
    'admin@localhost'
) ON CONFLICT (tenant_id) DO NOTHING;

-- Ensure default tenant has policy
INSERT INTO tenant_policies (
    tenant_id, max_monthly_cost_usd, max_tokens_per_request,
    enable_budget_limit, enable_token_limit
) VALUES (
    'default', 5.0, 1024, TRUE, TRUE
) ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- COMMENTS: Documentation for database objects
-- ============================================================================

COMMENT ON TABLE tenants IS 'Multi-tenant customer accounts with authentication';
COMMENT ON TABLE tenant_keys IS 'Encrypted BYOK provider API keys per tenant (AES-256-GCM)';
COMMENT ON TABLE tenant_sessions IS 'JWT session tracking for revocation and monitoring';
COMMENT ON TABLE tenant_policies IS 'Per-tenant policy overrides and rate limits';

COMMENT ON FUNCTION create_tenant IS 'Create new tenant with default budget and policy';
COMMENT ON FUNCTION store_tenant_key IS 'Store encrypted provider API key with key rotation';
COMMENT ON FUNCTION update_tenant_last_login IS 'Update tenant last login timestamp';
COMMENT ON FUNCTION revoke_session IS 'Revoke JWT session token';

COMMIT;
