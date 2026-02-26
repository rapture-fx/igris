-- Migration 006: Execution lineage table
-- Persists verified ExecutionReceipts forwarded from Runtime instances.
-- Provides an append-only audit trail of resource-accountable executions,
-- linking each receipt to its bounding ExecutionTransaction via transaction_id.
--
-- Overture is the control plane; records are written here only after the
-- Runtime's Ed25519 receipt signature has been verified.

CREATE TABLE IF NOT EXISTS execution_lineage (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity fields (from ExecutionReceipt)
    execution_id        TEXT        NOT NULL,          -- UUIDv7 from Runtime
    transaction_id      TEXT        NOT NULL DEFAULT '',  -- UUIDv7 of bounding transaction
    transaction_hash    TEXT        NOT NULL DEFAULT '',  -- SHA-256 of sealed transaction
    agent_id            TEXT        NOT NULL,

    -- Resource accounting
    cpu_time_ms         BIGINT      NOT NULL DEFAULT 0,
    wall_time_ms        BIGINT      NOT NULL DEFAULT 0,
    memory_peak_mb      BIGINT      NOT NULL DEFAULT 0,
    fs_bytes_written    BIGINT      NOT NULL DEFAULT 0,
    tool_calls          INTEGER     NOT NULL DEFAULT 0,
    violation_occurred  BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Lineage chain fields
    receipt_hash        TEXT        NOT NULL,          -- SHA-256 of this receipt
    previous_hash       TEXT        NOT NULL DEFAULT '',
    signature           TEXT        NOT NULL,          -- Base64 Ed25519

    -- Overture provenance
    runtime_id          TEXT,                          -- Which runtime instance
    tenant_id           TEXT,                          -- Tenant that triggered execution

    -- Timestamps
    timestamp_utc       TIMESTAMPTZ NOT NULL,          -- From receipt
    persisted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on execution_id: one receipt per execution.
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_lineage_execution_id
    ON execution_lineage (execution_id);

-- Query pattern: recent executions per tenant.
CREATE INDEX IF NOT EXISTS idx_execution_lineage_tenant_persisted
    ON execution_lineage (tenant_id, persisted_at DESC);

-- Query pattern: executions with violations.
CREATE INDEX IF NOT EXISTS idx_execution_lineage_violations
    ON execution_lineage (violation_occurred, persisted_at DESC)
    WHERE violation_occurred = TRUE;

-- Query pattern: chain traversal by receipt hash.
CREATE INDEX IF NOT EXISTS idx_execution_lineage_previous_hash
    ON execution_lineage (previous_hash);

COMMENT ON TABLE execution_lineage IS
    'Append-only, cryptographically-verified execution receipts forwarded from '
    'igris-runtime instances. Records are written only after Ed25519 signature '
    'verification. Provides the audit trail linking SDK requests to runtime '
    'resource consumption via transaction_id → ExecutionTransaction.';
