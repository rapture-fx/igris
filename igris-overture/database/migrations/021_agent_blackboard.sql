-- Migration 021: Agent shared blackboard (per-tenant KV store)
CREATE TABLE IF NOT EXISTS agent_blackboard (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT        NOT NULL,
    key         TEXT        NOT NULL,
    value       JSONB       NOT NULL DEFAULT 'null'::jsonb,
    ttl_seconds INT,        -- NULL means no expiry
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_blackboard_tenant ON agent_blackboard (tenant_id);

-- TTL cleanup: rows where ttl_seconds is set and have expired
-- Run periodically: DELETE FROM agent_blackboard WHERE ttl_seconds IS NOT NULL AND updated_at + (ttl_seconds || ' seconds')::interval < NOW();
