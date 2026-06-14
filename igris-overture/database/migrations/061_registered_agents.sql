-- Migration 061: Tenant-scoped Agent Registry for identity and attribution.
-- Registers agents for run attribution only — no deploy, secrets, or prompts.

CREATE TABLE IF NOT EXISTS registered_agents (
    agent_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      TEXT NOT NULL,
    name           TEXT NOT NULL,
    display_name   TEXT NOT NULL DEFAULT '',
    agent_type     TEXT NOT NULL,
    template_name  TEXT NOT NULL DEFAULT '',
    version        TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS registered_agents_tenant_name_active_idx
    ON registered_agents (tenant_id, name)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS registered_agents_tenant_updated_idx
    ON registered_agents (tenant_id, updated_at DESC)
    WHERE archived_at IS NULL;