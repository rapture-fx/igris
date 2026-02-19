-- Migration 005: Runtime instance registry
-- Stores registered igris-runtime instances (cloud and edge) so Overture
-- can select a healthy target when forwarding inference requests.

CREATE TABLE IF NOT EXISTS runtime_instances (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    runtime_id          TEXT        NOT NULL UNIQUE,
    public_key_ed25519  TEXT        NOT NULL,
    endpoint            TEXT        NOT NULL,
    capabilities        JSONB       NOT NULL DEFAULT '[]',
    platform            TEXT,
    version             TEXT,
    is_edge             BOOLEAN     NOT NULL DEFAULT TRUE,
    is_healthy          BOOLEAN     NOT NULL DEFAULT TRUE,
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_instances_healthy
    ON runtime_instances (is_healthy, last_seen_at DESC);

COMMENT ON TABLE runtime_instances IS
    'Registry of active igris-runtime instances forwarded to by Overture. '
    'Overture is the control plane; runtimes are the sole execution authority.';
