-- Migration 031: Durable task execution tables
-- Supports fault-tolerant task recovery across runtime failures.
-- Tasks survive crashes via WAL checkpoints stored here.

CREATE TABLE IF NOT EXISTS task_records (
    task_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','dispatched','checkpointed','completed','failed','recovering')),
    runtime_id       TEXT,
    runtime_endpoint TEXT,
    task_definition  JSONB NOT NULL,
    last_checkpoint  JSONB,
    idempotency_key  TEXT NOT NULL,
    failure_reason   TEXT,
    deadline_at      TIMESTAMPTZ,
    dispatched_at    TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS task_records_idempotency_key_idx
    ON task_records (idempotency_key);

CREATE INDEX IF NOT EXISTS task_records_tenant_status_idx
    ON task_records (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS task_records_runtime_status_idx
    ON task_records (runtime_id, status)
    WHERE status IN ('dispatched', 'checkpointed', 'recovering');

-- WAL checkpoints pushed from runtimes.
-- Multiple checkpoints per task; recovery reads the latest by step_index.
CREATE TABLE IF NOT EXISTS wal_checkpoints (
    checkpoint_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id          UUID NOT NULL REFERENCES task_records(task_id) ON DELETE CASCADE,
    step_index       INTEGER NOT NULL,
    checkpoint_digest BYTEA NOT NULL,   -- SHA256 rolling digest over committed outputs
    wal_entries      JSONB NOT NULL,    -- signed WalEntry array from runtime
    received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wal_checkpoints_task_step_idx
    ON wal_checkpoints (task_id, step_index DESC);
