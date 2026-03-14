-- Migration 014: Tenant API key management table
-- Allows tenants to have multiple named API keys (shown on the Settings > General page).
-- The raw key is never stored; only a bcrypt/SHA-256 hash and display prefix are kept.

CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    TEXT        NOT NULL,           -- Clerk user ID (tenants.tenant_id)
    name         TEXT        NOT NULL,           -- Human label, e.g. "CI / Deploy"
    key_hash     TEXT        NOT NULL,           -- SHA-256 of the raw key
    key_prefix   TEXT        NOT NULL,           -- First 16 chars for display, e.g. "igk_live_a1b2c3d4"
    status       TEXT        NOT NULL DEFAULT 'active',  -- active | revoked
    last_used_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant
    ON tenant_api_keys (tenant_id, status);

COMMENT ON TABLE tenant_api_keys IS
    'Named API keys issued to tenants. Raw key shown only once at creation time; '
    'only the SHA-256 hash is stored for subsequent verification.';
