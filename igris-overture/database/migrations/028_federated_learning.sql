-- Migration 028: Federated Learning tables
-- Creates the three tables used by routes_federated.go handlers.

-- Federated learning global configuration (one row per tenant, latest wins)
CREATE TABLE IF NOT EXISTS federated_config (
    id                  BIGSERIAL    PRIMARY KEY,
    tenant_id           TEXT         NOT NULL DEFAULT 'default',
    enabled             BOOLEAN      NOT NULL DEFAULT true,
    min_participants    INTEGER      NOT NULL DEFAULT 3,
    privacy_budget      FLOAT        NOT NULL DEFAULT 1.0,
    noise_scale         FLOAT        NOT NULL DEFAULT 0.1,
    round_interval_mins INTEGER      NOT NULL DEFAULT 60,
    max_rounds_per_day  INTEGER      NOT NULL DEFAULT 12,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed a default config row so GET /v1/federated/config returns real data immediately
INSERT INTO federated_config (tenant_id, enabled, min_participants, privacy_budget, noise_scale, round_interval_mins, max_rounds_per_day)
VALUES ('default', true, 3, 1.0, 0.1, 60, 12)
ON CONFLICT DO NOTHING;

-- Edge/device participants registered with the federated coordinator
CREATE TABLE IF NOT EXISTS federated_participants (
    id            TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT         NOT NULL DEFAULT 'default',
    device_id     TEXT         NOT NULL,
    hostname      TEXT,
    status        TEXT         NOT NULL DEFAULT 'idle',  -- idle | active | uploading | aggregating
    updates_count INTEGER      NOT NULL DEFAULT 0,
    model_version TEXT         NOT NULL DEFAULT 'v1.0',
    last_seen     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_federated_participants_tenant
    ON federated_participants (tenant_id);

CREATE INDEX IF NOT EXISTS idx_federated_participants_last_seen
    ON federated_participants (last_seen DESC);

-- Aggregation rounds
CREATE TABLE IF NOT EXISTS federated_rounds (
    id                BIGSERIAL    PRIMARY KEY,
    tenant_id         TEXT         NOT NULL DEFAULT 'default',
    started_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    status            TEXT         NOT NULL DEFAULT 'running',  -- running | completed | failed
    participant_count INTEGER      NOT NULL DEFAULT 0,
    updates_received  INTEGER      NOT NULL DEFAULT 0,
    aggregation_loss  FLOAT,
    model_version     TEXT         NOT NULL DEFAULT 'v1.0'
);

CREATE INDEX IF NOT EXISTS idx_federated_rounds_tenant_status
    ON federated_rounds (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_federated_rounds_started_at
    ON federated_rounds (started_at DESC);
