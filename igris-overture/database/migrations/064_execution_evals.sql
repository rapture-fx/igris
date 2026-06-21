-- Migration 064: Deterministic execution evaluations.
--
-- Evaluation definitions are tenant-owned assertions over persisted execution
-- truth. They are not prompt/model evaluations and never store raw request or
-- response bodies.

CREATE TABLE IF NOT EXISTS execution_evals (
    eval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    target_action_name TEXT NOT NULL DEFAULT '',
    target_agent_id TEXT NOT NULL DEFAULT '',
    assertions_json JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    CHECK (jsonb_typeof(assertions_json) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_execution_evals_tenant_active
    ON execution_evals (tenant_id, created_at DESC)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_execution_evals_tenant_action
    ON execution_evals (tenant_id, target_action_name)
    WHERE archived_at IS NULL AND target_action_name <> '';

CREATE TABLE IF NOT EXISTS execution_eval_runs (
    eval_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    eval_id UUID NOT NULL REFERENCES execution_evals(eval_id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    execution_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('passed','failed')),
    passed_count INTEGER NOT NULL DEFAULT 0 CHECK (passed_count >= 0),
    failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    results_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(results_json) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_execution_eval_runs_task
    ON execution_eval_runs (tenant_id, task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_eval_runs_eval
    ON execution_eval_runs (tenant_id, eval_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_eval_runs_status
    ON execution_eval_runs (tenant_id, status, created_at DESC);
