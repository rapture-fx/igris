-- Migration 047: Persist execution context for verified run-detail views.
--
-- execution_lineage remains the append-only receipt ledger. This table stores
-- the execution route, policy/capability context, and task lifecycle events
-- associated with a verified execution_id so the console can render a credible
-- run detail page without fabricating metadata.

CREATE TABLE IF NOT EXISTS execution_context (
    execution_id TEXT PRIMARY KEY,
    tenant_id TEXT,
    task_id UUID REFERENCES task_records(task_id) ON DELETE SET NULL,
    runtime_id TEXT,
    runtime_label TEXT,
    provider TEXT,
    route_decision TEXT,
    execution_path TEXT,
    fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
    fallback_reason TEXT,
    policy_snapshot JSONB,
    capability_snapshot JSONB,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    verification_status TEXT,
    receipt_id TEXT,
    receipt_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_context_tenant_updated_idx
    ON execution_context (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS execution_context_task_idx
    ON execution_context (task_id, updated_at DESC)
    WHERE task_id IS NOT NULL;

COMMENT ON TABLE execution_context IS
    'Verified execution context linked to execution_lineage rows. Stores route, '
    'provider, policy/capability snapshots, and lifecycle events for console run '
    'detail views without altering the receipt ledger.';
