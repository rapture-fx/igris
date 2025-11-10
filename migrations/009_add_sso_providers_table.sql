-- Migration: 009_add_sso_providers_table
-- Description: Add SSO (OAuth2 + SAML) authentication support for Growth and Scale tiers
-- Purpose: Enable enterprise SSO integration with configurable providers per tenant
-- Author: Schlep-Engine Team
-- Date: 2025-11-10
-- Phase: 5.3 - Feature Gap Closure
-- Dependencies: 008_add_tier_column_to_tenants.sql

-- ============================================================================
-- 1. SSO PROVIDER TYPE ENUM
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE sso_provider_type AS ENUM (
        'oauth2',     -- Generic OAuth2 provider
        'oidc',       -- OpenID Connect (superset of OAuth2)
        'saml'        -- SAML 2.0 provider
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. SSO PROVIDERS TABLE
-- ============================================================================
-- Stores SSO provider configurations per tenant
CREATE TABLE IF NOT EXISTS sso_providers (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(255) NOT NULL,           -- Custom ID for this provider config
    provider_name VARCHAR(255) NOT NULL,         -- Display name (e.g., "Company Okta")
    provider_type sso_provider_type NOT NULL,    -- oauth2, oidc, saml
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- OAuth2/OIDC Configuration
    client_id VARCHAR(512),                       -- OAuth2 client ID
    client_secret TEXT,                           -- OAuth2 client secret (encrypted in production)
    auth_url VARCHAR(1024),                       -- Authorization endpoint URL
    token_url VARCHAR(1024),                      -- Token endpoint URL
    user_info_url VARCHAR(1024),                  -- UserInfo endpoint URL
    scopes JSONB DEFAULT '["openid", "profile", "email"]'::jsonb, -- OAuth2 scopes
    redirect_uri VARCHAR(1024),                   -- Callback URL

    -- SAML Configuration
    saml_metadata_url VARCHAR(1024),              -- SAML IdP metadata URL
    saml_entity_id VARCHAR(512),                  -- SAML entity ID (SP)
    saml_sso_url VARCHAR(1024),                   -- SAML SSO URL
    saml_certificate TEXT,                        -- SAML signing certificate (PEM)
    saml_private_key TEXT,                        -- SAML signing private key (encrypted)
    saml_assertion_url VARCHAR(1024),             -- SAML assertion consumer URL

    -- Provider Settings
    enabled BOOLEAN DEFAULT true,                 -- Enable/disable provider
    allow_auto_provision BOOLEAN DEFAULT true,    -- Auto-create users on first SSO login
    default_roles JSONB,                          -- Default roles for new users (array)
    attribute_mapping JSONB,                      -- Custom attribute mapping (object)

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),                      -- User ID who created this config
    last_used_at TIMESTAMP WITH TIME ZONE,        -- Last successful SSO login

    -- Constraints
    CONSTRAINT sso_providers_unique_provider_per_tenant
        UNIQUE (tenant_id, provider_id),
    CONSTRAINT sso_providers_valid_oauth2_config
        CHECK (
            provider_type != 'oauth2' OR
            (client_id IS NOT NULL AND client_secret IS NOT NULL AND
             auth_url IS NOT NULL AND token_url IS NOT NULL)
        ),
    CONSTRAINT sso_providers_valid_saml_config
        CHECK (
            provider_type != 'saml' OR
            (saml_entity_id IS NOT NULL AND saml_sso_url IS NOT NULL)
        )
);

-- ============================================================================
-- 3. SSO USER LINKS TABLE
-- ============================================================================
-- Links local users to their SSO provider identities
CREATE TABLE IF NOT EXISTS sso_user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User linkage
    user_id UUID NOT NULL,                        -- Local user ID (references users table)
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id VARCHAR(255) NOT NULL,            -- SSO provider ID
    external_id VARCHAR(512) NOT NULL,            -- Provider's unique user ID (sub, NameID, etc.)

    -- User information from provider
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    username VARCHAR(255),

    -- Authentication metadata
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    refresh_token TEXT,                           -- OAuth2 refresh token (encrypted)
    token_expires_at TIMESTAMP WITH TIME ZONE,

    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT sso_user_links_unique_external_id
        UNIQUE (tenant_id, provider_id, external_id),
    CONSTRAINT sso_user_links_unique_user_provider
        UNIQUE (user_id, provider_id)
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Provider lookups by tenant
CREATE INDEX IF NOT EXISTS idx_sso_providers_tenant_id
    ON sso_providers(tenant_id)
    WHERE enabled = true;

-- Provider lookups by type
CREATE INDEX IF NOT EXISTS idx_sso_providers_type
    ON sso_providers(provider_type, enabled);

-- Last used providers (for analytics)
CREATE INDEX IF NOT EXISTS idx_sso_providers_last_used
    ON sso_providers(last_used_at DESC NULLS LAST)
    WHERE enabled = true;

-- User link lookups (fast SSO login)
CREATE INDEX IF NOT EXISTS idx_sso_user_links_external_id
    ON sso_user_links(tenant_id, provider_id, external_id);

-- User link lookups by user ID
CREATE INDEX IF NOT EXISTS idx_sso_user_links_user_id
    ON sso_user_links(user_id);

-- Login analytics
CREATE INDEX IF NOT EXISTS idx_sso_user_links_last_login
    ON sso_user_links(last_login DESC NULLS LAST);

-- ============================================================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sso_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sso_providers
CREATE TRIGGER sso_providers_updated_at_trigger
    BEFORE UPDATE ON sso_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_sso_updated_at();

-- Trigger for sso_user_links
CREATE TRIGGER sso_user_links_updated_at_trigger
    BEFORE UPDATE ON sso_user_links
    FOR EACH ROW
    EXECUTE FUNCTION update_sso_updated_at();

-- ============================================================================
-- 6. FUNCTION: UPDATE LAST LOGIN
-- ============================================================================

-- Function to update last login timestamp and increment count
CREATE OR REPLACE FUNCTION update_sso_last_login(
    p_tenant_id UUID,
    p_provider_id VARCHAR(255),
    p_external_id VARCHAR(512)
)
RETURNS VOID AS $$
BEGIN
    -- Update user link
    UPDATE sso_user_links
    SET
        last_login = CURRENT_TIMESTAMP,
        login_count = login_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE
        tenant_id = p_tenant_id AND
        provider_id = p_provider_id AND
        external_id = p_external_id;

    -- Update provider last used
    UPDATE sso_providers
    SET last_used_at = CURRENT_TIMESTAMP
    WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNCTION: CHECK SSO TIER ACCESS
-- ============================================================================

-- Function to check if tenant has SSO enabled for their tier
CREATE OR REPLACE FUNCTION check_sso_tier_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tenant_tier tenant_tier;
BEGIN
    -- Get tenant tier
    SELECT tier INTO tenant_tier FROM tenants WHERE id = p_tenant_id;

    -- SSO is only available for Growth and Scale tiers (per tier_config.yaml)
    -- Currently marked as NOT IMPLEMENTED in tier_config.yaml
    -- Once feature flag 'enable_sso' is set to true, this will enforce tier access
    RETURN tenant_tier IN ('growth', 'scale');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. VIEWS FOR ANALYTICS
-- ============================================================================

-- View: SSO provider usage statistics
CREATE OR REPLACE VIEW sso_provider_stats AS
SELECT
    sp.tenant_id,
    sp.provider_id,
    sp.provider_name,
    sp.provider_type,
    sp.enabled,
    COUNT(DISTINCT sul.user_id) AS linked_users,
    SUM(sul.login_count) AS total_logins,
    MAX(sul.last_login) AS last_login,
    sp.created_at,
    sp.last_used_at
FROM sso_providers sp
LEFT JOIN sso_user_links sul ON
    sp.tenant_id = sul.tenant_id AND
    sp.provider_id = sul.provider_id
GROUP BY sp.tenant_id, sp.provider_id, sp.provider_name, sp.provider_type,
         sp.enabled, sp.created_at, sp.last_used_at;

-- View: Tenant SSO summary
CREATE OR REPLACE VIEW tenant_sso_summary AS
SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.tier,
    check_sso_tier_access(t.id) AS sso_tier_access,
    COUNT(DISTINCT sp.id) AS provider_count,
    COUNT(DISTINCT sul.user_id) AS sso_users_count,
    SUM(sul.login_count) AS total_sso_logins,
    MAX(sul.last_login) AS last_sso_login
FROM tenants t
LEFT JOIN sso_providers sp ON t.id = sp.tenant_id AND sp.enabled = true
LEFT JOIN sso_user_links sul ON t.id = sul.tenant_id
GROUP BY t.id, t.name, t.tier;

-- ============================================================================
-- 9. SECURITY: ROW-LEVEL SECURITY (Optional)
-- ============================================================================

-- Enable RLS on sso_providers (optional - requires proper user context)
-- ALTER TABLE sso_providers ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY sso_providers_tenant_isolation ON sso_providers
--     FOR ALL
--     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Enable RLS on sso_user_links
-- ALTER TABLE sso_user_links ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY sso_user_links_tenant_isolation ON sso_user_links
--     FOR ALL
--     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE sso_providers IS
    'SSO provider configurations for tenant authentication. Supports OAuth2, OIDC, and SAML.';

COMMENT ON COLUMN sso_providers.client_secret IS
    'OAuth2 client secret. MUST be encrypted at rest in production.';

COMMENT ON COLUMN sso_providers.saml_private_key IS
    'SAML signing private key. MUST be encrypted at rest in production.';

COMMENT ON TABLE sso_user_links IS
    'Links local user accounts to SSO provider identities. Enables SSO login and user provisioning.';

COMMENT ON FUNCTION check_sso_tier_access(UUID) IS
    'Checks if tenant tier includes SSO feature access (Growth and Scale tiers only).';

COMMENT ON FUNCTION update_sso_last_login(UUID, VARCHAR, VARCHAR) IS
    'Updates last login timestamp and increments login count for SSO user.';

-- ============================================================================
-- 11. SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Example: Add Auth0 SSO provider for a tenant (replace with actual values)
-- INSERT INTO sso_providers (
--     provider_id, provider_name, provider_type, tenant_id,
--     client_id, client_secret, auth_url, token_url, user_info_url,
--     scopes, redirect_uri, enabled
-- ) VALUES (
--     'auth0-prod',
--     'Company Auth0',
--     'oauth2',
--     '00000000-0000-0000-0000-000000000001',  -- Replace with real tenant ID
--     'YOUR_CLIENT_ID',
--     'YOUR_CLIENT_SECRET',  -- Encrypt in production!
--     'https://your-domain.auth0.com/authorize',
--     'https://your-domain.auth0.com/oauth/token',
--     'https://your-domain.auth0.com/userinfo',
--     '["openid", "profile", "email"]'::jsonb,
--     'https://your-app.com/auth/callback',
--     true
-- );

-- ============================================================================
-- 12. TIER CONFIGURATION UPDATE
-- ============================================================================

-- NOTE: To enable SSO feature, update config/tier_config.yaml:
--
-- For Growth tier:
--   features:
--     sso: true  # Change from false to true
--
-- For Scale tier:
--   features:
--     sso: true  # Change from false to true
--
-- And update global feature flags:
-- feature_flags:
--   enable_sso: true  # Change from false to true

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
    provider_count INTEGER;
    link_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO provider_count FROM sso_providers;
    SELECT COUNT(*) INTO link_count FROM sso_user_links;

    RAISE NOTICE 'Migration 009 completed successfully:';
    RAISE NOTICE '  - SSO providers table created';
    RAISE NOTICE '  - SSO user links table created';
    RAISE NOTICE '  - % SSO providers configured', provider_count;
    RAISE NOTICE '  - % SSO user links exist', link_count;
    RAISE NOTICE '  - SSO tier access function created';
    RAISE NOTICE '  - Analytics views created';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Update tier_config.yaml to enable SSO feature flag';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration:
--
-- DROP VIEW IF EXISTS tenant_sso_summary CASCADE;
-- DROP VIEW IF EXISTS sso_provider_stats CASCADE;
-- DROP FUNCTION IF EXISTS update_sso_last_login CASCADE;
-- DROP FUNCTION IF EXISTS check_sso_tier_access CASCADE;
-- DROP FUNCTION IF EXISTS update_sso_updated_at CASCADE;
-- DROP TRIGGER IF EXISTS sso_user_links_updated_at_trigger ON sso_user_links;
-- DROP TRIGGER IF EXISTS sso_providers_updated_at_trigger ON sso_providers;
-- DROP TABLE IF EXISTS sso_user_links CASCADE;
-- DROP TABLE IF EXISTS sso_providers CASCADE;
-- DROP TYPE IF EXISTS sso_provider_type CASCADE;
