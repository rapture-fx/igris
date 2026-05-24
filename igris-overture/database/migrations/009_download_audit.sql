-- Migration 009: Runtime binary download audit log
-- Records every authenticated binary download for security auditing
-- and per-tenant rate limiting.

CREATE TABLE IF NOT EXISTS runtime_downloads (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT        NOT NULL,
    ip_address       TEXT        NOT NULL,
    runtime_version  TEXT        NOT NULL DEFAULT 'latest',
    platform         TEXT        NOT NULL,
    user_agent       TEXT,
    download_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_downloads_tenant
    ON runtime_downloads (tenant_id, download_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_downloads_tenant_hour
    ON runtime_downloads (tenant_id, date_trunc('hour', download_at AT TIME ZONE 'UTC'));

COMMENT ON TABLE runtime_downloads IS
    'Audit log of every authenticated runtime binary download. '
    'Used for security review and per-tenant rate limiting.';
