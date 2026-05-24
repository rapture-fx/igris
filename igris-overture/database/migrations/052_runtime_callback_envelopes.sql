-- Migration 052: Signed runtime callback replay protection.
--
-- Runtime-to-coordinator callbacks for checkpoints, completion, and failure are
-- signed first-class control-plane messages. This table stores only safe replay
-- protection metadata: no callback bodies, secrets, or raw private material.

CREATE TABLE IF NOT EXISTS runtime_callback_nonces (
    callback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID NOT NULL,
    runtime_id TEXT NOT NULL,
    callback_type TEXT NOT NULL CHECK (callback_type IN ('checkpoint','complete','failed')),
    nonce TEXT NOT NULL,
    body_digest TEXT NOT NULL,
    timestamp_unix_ms BIGINT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, runtime_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_runtime_callback_nonces_task
    ON runtime_callback_nonces (tenant_id, task_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_callback_nonces_retention
    ON runtime_callback_nonces (accepted_at);

COMMENT ON TABLE runtime_callback_nonces IS 'Accepted runtime callback nonce metadata for replay protection. Cleanup retains entries for at least the callback freshness window; default application retention is 24 hours.';
