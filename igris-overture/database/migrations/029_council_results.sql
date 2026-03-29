-- Migration 029: Council Mode results table
-- Stores per-invocation metadata from RouteCouncil() calls for analytics.

CREATE TABLE IF NOT EXISTS council_results (
    id                   BIGSERIAL    PRIMARY KEY,
    tenant_id            TEXT         NOT NULL DEFAULT 'system',
    providers_used       TEXT[]       NOT NULL DEFAULT '{}',
    chairman_provider    TEXT         NOT NULL DEFAULT '',
    winner_provider      TEXT         NOT NULL DEFAULT '',
    response_count       INTEGER      NOT NULL DEFAULT 0,
    total_latency_ms     BIGINT       NOT NULL DEFAULT 0,
    ranking_latency_ms   BIGINT       NOT NULL DEFAULT 0,
    synthesis_latency_ms BIGINT       NOT NULL DEFAULT 0,
    council_cost_usd     FLOAT        NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_council_results_tenant_created
    ON council_results (tenant_id, created_at DESC);
