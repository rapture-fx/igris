-- Migration 051: General execution governance, recovery, verification, and
-- runtime handoff audit tables.
--
-- Additive only. These tables are intentionally separate from the immutable
-- execution_lineage receipt ledger so older proof flows keep working.

ALTER TABLE task_records
    DROP CONSTRAINT IF EXISTS task_records_status_check;

ALTER TABLE task_records
    ADD CONSTRAINT task_records_status_check
    CHECK (status IN ('pending','dispatched','checkpointed','completed','failed','recovering','canceled','approval_required'));

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS latest_policy_decision_id UUID,
    ADD COLUMN IF NOT EXISTS recovery_policy TEXT NOT NULL DEFAULT 'automatic_when_safe',
    ADD COLUMN IF NOT EXISTS checkpoint_portability TEXT NOT NULL DEFAULT 'same_runtime_only'
        CHECK (checkpoint_portability IN ('same_runtime_only','compatible_runtime','any_runtime'));

ALTER TABLE wal_checkpoints
    ADD COLUMN IF NOT EXISTS policy_decision_id UUID,
    ADD COLUMN IF NOT EXISTS checkpoint_digest_hex TEXT,
    ADD COLUMN IF NOT EXISTS checkpoint_portability TEXT NOT NULL DEFAULT 'same_runtime_only'
        CHECK (checkpoint_portability IN ('same_runtime_only','compatible_runtime','any_runtime'));

CREATE TABLE IF NOT EXISTS action_policy_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID,
    agent_id TEXT,
    runtime_id TEXT,
    task_type TEXT NOT NULL,
    action_name TEXT NOT NULL,
    environment_label TEXT,
    resource_scope TEXT,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
    decision TEXT NOT NULL CHECK (decision IN ('allowed','denied','approval_required')),
    replay_class TEXT NOT NULL CHECK (replay_class IN ('retryable','non_retryable')),
    irreversible BOOLEAN NOT NULL DEFAULT false,
    human_gated BOOLEAN NOT NULL DEFAULT false,
    policy_version TEXT NOT NULL,
    policy_reason TEXT NOT NULL,
    action_digest TEXT NOT NULL,
    boundary_digest TEXT,
    checkpoint_portability TEXT NOT NULL DEFAULT 'same_runtime_only'
        CHECK (checkpoint_portability IN ('same_runtime_only','compatible_runtime','any_runtime')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_policy_decisions_task
    ON action_policy_decisions (tenant_id, task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_policy_decisions_runtime
    ON action_policy_decisions (tenant_id, runtime_id, created_at DESC)
    WHERE runtime_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_action_policy_decisions_decision
    ON action_policy_decisions (tenant_id, decision, created_at DESC);

CREATE TABLE IF NOT EXISTS approval_requests (
    approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES action_policy_decisions(decision_id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    task_id UUID,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','expired','canceled')),
    requested_reason TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by TEXT,
    decided_at TIMESTAMPTZ,
    decision_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_task
    ON approval_requests (tenant_id, task_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_pending
    ON approval_requests (tenant_id, requested_at DESC)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS task_recovery_events (
    recovery_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    source_runtime_id TEXT,
    target_runtime_id TEXT,
    checkpoint_digest TEXT,
    last_committed_step INTEGER,
    replay_allowed BOOLEAN,
    reason TEXT NOT NULL,
    event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_recovery_events_task
    ON task_recovery_events (tenant_id, task_id, created_at ASC);

CREATE TABLE IF NOT EXISTS runtime_handoff_events (
    handoff_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID NOT NULL,
    source_runtime_id TEXT,
    target_runtime_id TEXT,
    checkpoint_digest TEXT,
    checkpoint_portability TEXT NOT NULL
        CHECK (checkpoint_portability IN ('same_runtime_only','compatible_runtime','any_runtime')),
    decision TEXT NOT NULL CHECK (decision IN ('allowed','denied')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_handoff_events_task
    ON runtime_handoff_events (tenant_id, task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS execution_boundaries (
    boundary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID,
    runtime_id TEXT,
    policy_decision_id UUID REFERENCES action_policy_decisions(decision_id) ON DELETE SET NULL,
    environment_label TEXT,
    allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
    denied_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
    network_scope TEXT NOT NULL DEFAULT 'none',
    filesystem_scope TEXT NOT NULL DEFAULT 'none',
    api_scope TEXT NOT NULL DEFAULT 'none',
    resource_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    runtime_capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    boundary_digest TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_boundaries_task
    ON execution_boundaries (tenant_id, task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS boundary_violations (
    violation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID,
    runtime_id TEXT,
    boundary_id UUID REFERENCES execution_boundaries(boundary_id) ON DELETE SET NULL,
    violation_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info','warning','error','critical')),
    reason TEXT NOT NULL,
    evidence_digest TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boundary_violations_task
    ON boundary_violations (tenant_id, task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS verification_results (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    task_id UUID,
    execution_id TEXT,
    policy_decision_id UUID REFERENCES action_policy_decisions(decision_id) ON DELETE SET NULL,
    checkpoint_digest TEXT,
    action_digest TEXT,
    status TEXT NOT NULL CHECK (status IN ('verified','partially_verified','unverifiable','failed_verification','policy_violation')),
    policy_compliant BOOLEAN,
    evidence_digest TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_results_task
    ON verification_results (tenant_id, task_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'task_records_latest_policy_decision_fkey'
    ) THEN
        ALTER TABLE task_records
            ADD CONSTRAINT task_records_latest_policy_decision_fkey
            FOREIGN KEY (latest_policy_decision_id)
            REFERENCES action_policy_decisions(decision_id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wal_checkpoints_policy_decision_fkey'
    ) THEN
        ALTER TABLE wal_checkpoints
            ADD CONSTRAINT wal_checkpoints_policy_decision_fkey
            FOREIGN KEY (policy_decision_id)
            REFERENCES action_policy_decisions(decision_id)
            ON DELETE SET NULL;
    END IF;
END $$;
