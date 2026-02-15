-- Migration: 004_create_provider_registry
-- Description: Universal Provider Registration & Validation Layer (BYOK MVP)
-- Purpose: Enable users to register, validate, and monitor any AI provider
-- Author: Igris Inertial Team
-- Date: 2025-11-05

-- ============================================================================
-- 1. COMPATIBILITY CLASS ENUM
-- ============================================================================
-- Defines explicit compatibility categories to prevent false integrations
DO $$ BEGIN
    CREATE TYPE compatibility_class AS ENUM (
        'openai_compatible',  -- Providers with OpenAI-compatible API
        'custom_adapter',     -- Providers requiring custom transformation
        'unsupported'         -- Providers not yet supported
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. PROVIDER STATUS ENUM
-- ============================================================================
-- Tracks provider lifecycle and health states
DO $$ BEGIN
    CREATE TYPE provider_status AS ENUM (
        'pending',    -- Initial registration, validation pending
        'active',     -- Validated and operational
        'invalid',    -- Failed validation
        'disabled'    -- Disabled due to repeated failures or manual action
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. PROVIDER REGISTRY TABLE
-- ============================================================================
-- Central registry for all AI providers (verified and user-registered)
CREATE TABLE IF NOT EXISTS provider_registry (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,

    -- Connection Configuration
    base_url VARCHAR(512) NOT NULL,
    auth_header_template TEXT NOT NULL,  -- Encrypted in application layer

    -- Provider Metadata
    models JSONB DEFAULT '[]'::jsonb,  -- Array of available model names
    pricing JSONB DEFAULT '{}'::jsonb,  -- Cost per token structure
    compatibility_class compatibility_class NOT NULL DEFAULT 'openai_compatible',
    status provider_status NOT NULL DEFAULT 'pending',

    -- Health Metrics
    health JSONB DEFAULT '{
        "latency_ms": null,
        "last_success": null,
        "last_failure": null,
        "consecutive_failures": 0,
        "uptime_percent": 100.0,
        "total_checks": 0,
        "successful_checks": 0
    }'::jsonb,

    -- Flags
    is_verified BOOLEAN DEFAULT false,  -- True for pre-seeded verified providers
    is_official BOOLEAN DEFAULT false,  -- True for Igris-official providers

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_validated_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT provider_tenant_name_unique UNIQUE (tenant_id, name),
    CONSTRAINT valid_https_url CHECK (base_url ~* '^https://'),
    CONSTRAINT non_empty_name CHECK (char_length(name) > 0),
    CONSTRAINT non_empty_auth_header CHECK (char_length(auth_header_template) > 0)
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================
-- Tenant-based queries
CREATE INDEX IF NOT EXISTS idx_provider_registry_tenant_id
    ON provider_registry(tenant_id);

-- Status-based filtering
CREATE INDEX IF NOT EXISTS idx_provider_registry_status
    ON provider_registry(status)
    WHERE status = 'active';

-- Name lookup
CREATE INDEX IF NOT EXISTS idx_provider_registry_name
    ON provider_registry(name);

-- Compatibility class filtering
CREATE INDEX IF NOT EXISTS idx_provider_registry_compatibility
    ON provider_registry(compatibility_class);

-- Health monitoring queries
CREATE INDEX IF NOT EXISTS idx_provider_registry_last_validated
    ON provider_registry(last_validated_at DESC NULLS LAST);

-- GIN index for JSONB model searches
CREATE INDEX IF NOT EXISTS idx_provider_registry_models_gin
    ON provider_registry USING GIN (models);

-- GIN index for health metrics
CREATE INDEX IF NOT EXISTS idx_provider_registry_health_gin
    ON provider_registry USING GIN (health);

-- ============================================================================
-- 5. AUTOMATIC UPDATED_AT TRIGGER
-- ============================================================================
-- Auto-update the updated_at timestamp on any row modification
CREATE OR REPLACE FUNCTION update_provider_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER provider_registry_updated_at_trigger
    BEFORE UPDATE ON provider_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_registry_updated_at();

-- ============================================================================
-- 6. PROVIDER VALIDATION LOG TABLE
-- ============================================================================
-- Audit trail for all validation attempts
CREATE TABLE IF NOT EXISTS provider_validation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES provider_registry(id) ON DELETE CASCADE,

    -- Validation Result
    success BOOLEAN NOT NULL,
    status_code INTEGER,
    latency_ms INTEGER,
    error_message TEXT,

    -- Models Detected
    models_detected JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trace_id UUID DEFAULT gen_random_uuid()
);

-- Index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_provider_validation_log_provider_id
    ON provider_validation_log(provider_id, validated_at DESC);

-- Index for success/failure analysis
CREATE INDEX IF NOT EXISTS idx_provider_validation_log_success
    ON provider_validation_log(provider_id, success, validated_at DESC);

-- ============================================================================
-- 7. SEED VERIFIED PROVIDERS
-- ============================================================================
-- Pre-seed official verified providers with accurate compatibility classification
-- These are inserted for the system tenant (tenant_id = '00000000-0000-0000-0000-000000000000')
-- Note: Requires system tenant to exist in tenants table

-- First, ensure system tenant exists (idempotent)
INSERT INTO tenants (
    id,
    name,
    display_name,
    email,
    status,
    monthly_budget_usd
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system',
    'System Tenant',
    'system@igris-inertial.io',
    'active',
    999999.99  -- Unlimited budget for system providers
)
ON CONFLICT (id) DO NOTHING;

-- Insert verified providers
INSERT INTO provider_registry (
    tenant_id,
    name,
    base_url,
    auth_header_template,
    compatibility_class,
    status,
    is_verified,
    is_official
) VALUES
    -- OpenAI
    ('00000000-0000-0000-0000-000000000000', 'openai', 'https://api.openai.com/v1',
     'Authorization: Bearer {key}', 'openai_compatible', 'active', true, true),

    -- Anthropic
    ('00000000-0000-0000-0000-000000000000', 'anthropic', 'https://api.anthropic.com/v1',
     'x-api-key: {key}', 'openai_compatible', 'active', true, true),

    -- xAI
    ('00000000-0000-0000-0000-000000000000', 'xai', 'https://api.x.ai/v1',
     'Authorization: Bearer {key}', 'openai_compatible', 'active', true, true),

    -- Kimi (Moonshot)
    ('00000000-0000-0000-0000-000000000000', 'kimi', 'https://api.moonshot.cn/v1',
     'Authorization: Bearer {key}', 'openai_compatible', 'active', true, true),

    -- Qwen (Alibaba)
    ('00000000-0000-0000-0000-000000000000', 'qwen', 'https://dashscope.aliyuncs.com/api/v1',
     'Authorization: Bearer {key}', 'openai_compatible', 'active', true, true),

    -- DeepSeek
    ('00000000-0000-0000-0000-000000000000', 'deepseek', 'https://api.deepseek.com/v1',
     'Authorization: Bearer {key}', 'openai_compatible', 'active', true, true),

    -- Mistral
    ('00000000-0000-0000-0000-000000000000', 'mistral', 'https://api.mistral.ai/v1',
     'Authorization: Bearer {key}', 'openai_compatible', 'active', true, true),

    -- Llama (Meta)
    ('00000000-0000-0000-0000-000000000000', 'llama', 'https://api.meta.ai/v1',
     'Authorization: Bearer {key}', 'openai_compatible', 'active', true, true),

    -- Google Gemini (requires custom adapter)
    ('00000000-0000-0000-0000-000000000000', 'google_gemini', 'https://generativelanguage.googleapis.com/v1',
     'x-goog-api-key: {key}', 'custom_adapter', 'active', true, true),

    -- Z.AI
    ('00000000-0000-0000-0000-000000000000', 'zai', 'https://api.z.ai/v1',
     'Authorization: Bearer {key}', 'openai_compatible', 'active', true, true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE provider_registry IS
    'Universal provider registry for BYOK functionality. Stores both verified and user-registered AI providers.';

COMMENT ON COLUMN provider_registry.compatibility_class IS
    'Explicit compatibility classification to prevent false integrations and maintain routing integrity.';

COMMENT ON COLUMN provider_registry.auth_header_template IS
    'Template for authentication header. Use {key} placeholder for tenant API key. Encrypted at application layer.';

COMMENT ON COLUMN provider_registry.health IS
    'JSONB object containing health metrics: latency_ms, last_success, last_failure, consecutive_failures, uptime_percent, total_checks, successful_checks.';

COMMENT ON COLUMN provider_registry.is_verified IS
    'True for pre-seeded official providers with verified compatibility and security.';

COMMENT ON TABLE provider_validation_log IS
    'Audit trail for all provider validation attempts. Useful for debugging and health analysis.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Rollback instructions:
-- DROP TABLE IF EXISTS provider_validation_log CASCADE;
-- DROP TABLE IF EXISTS provider_registry CASCADE;
-- DROP TYPE IF EXISTS provider_status CASCADE;
-- DROP TYPE IF EXISTS compatibility_class CASCADE;
-- DROP FUNCTION IF EXISTS update_provider_registry_updated_at CASCADE;
