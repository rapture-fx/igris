-- Migration 030: Routing configuration persistence
-- Stores per-tenant routing settings saved from the console routing page.

CREATE TABLE IF NOT EXISTS routing_config (
    id          BIGSERIAL    PRIMARY KEY,
    tenant_id   TEXT         NOT NULL,
    config_key  TEXT         NOT NULL,
    config_json JSONB        NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_routing_config_tenant
    ON routing_config (tenant_id, config_key);
