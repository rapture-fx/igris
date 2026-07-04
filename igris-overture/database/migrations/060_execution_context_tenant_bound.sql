-- Migration 060: Enforce tenant-bound execution context records.
--
-- execution_context enriches tenant-scoped proof, receipt, and run inspection
-- reads. Tenant-null context rows are legacy/invalid for normal product paths:
-- API reads now require execution_context.tenant_id to match execution_lineage,
-- and coordinator writes refuse missing tenants before INSERT.
--
-- This migration aligns the schema when it is safe:
--   1. Deterministically backfill tenant_id from unambiguous tenant-bound
--      sources: task_records.task_id, task_records.proof_execution_id, then
--      execution_lineage.execution_id.
--   2. Apply NOT NULL and non-empty CHECK only if no tenant-null/empty rows
--      remain. If any remain, leave constraints unapplied and rely on
--      application-level fail-closed behavior until an explicit data cleanup
--      can resolve ownership.
--
-- Forward-only. Safe to re-run.

DO $$
BEGIN
    -- Resolve execution_context through the current search_path
    -- (to_regclass) instead of assuming table_schema = 'public', so the
    -- guard matches the same table the statements below operate on. In
    -- production execution_context lives in public and this is equivalent;
    -- schema-isolated test databases were skipped by the old check.
    IF to_regclass('execution_context') IS NOT NULL THEN
        -- Backfill from the direct task_id foreign key when it proves exactly
        -- one tenant for the execution context row.
        UPDATE execution_context ec
        SET tenant_id = src.tenant_id
        FROM (
            SELECT ec2.execution_id, MIN(tr.tenant_id) AS tenant_id
            FROM execution_context ec2
            JOIN task_records tr
              ON tr.task_id = ec2.task_id
            WHERE (ec2.tenant_id IS NULL OR ec2.tenant_id = '')
              AND tr.tenant_id IS NOT NULL
              AND tr.tenant_id <> ''
            GROUP BY ec2.execution_id
            HAVING COUNT(DISTINCT tr.tenant_id) = 1
        ) src
        WHERE (ec.tenant_id IS NULL OR ec.tenant_id = '')
          AND ec.execution_id = src.execution_id;

        -- Backfill from task_records.proof_execution_id when the execution id
        -- maps to exactly one tenant-bound task.
        UPDATE execution_context ec
        SET tenant_id = src.tenant_id
        FROM (
            SELECT proof_execution_id AS execution_id, MIN(tenant_id) AS tenant_id
            FROM task_records
            WHERE proof_execution_id IS NOT NULL
              AND proof_execution_id <> ''
              AND tenant_id IS NOT NULL
              AND tenant_id <> ''
            GROUP BY proof_execution_id
            HAVING COUNT(DISTINCT tenant_id) = 1
        ) src
        WHERE (ec.tenant_id IS NULL OR ec.tenant_id = '')
          AND ec.execution_id = src.execution_id;

        -- Backfill from execution_lineage when the receipt ledger already has
        -- one unambiguous tenant for this execution id.
        UPDATE execution_context ec
        SET tenant_id = src.tenant_id
        FROM (
            SELECT execution_id, MIN(tenant_id) AS tenant_id
            FROM execution_lineage
            WHERE execution_id IS NOT NULL
              AND execution_id <> ''
              AND tenant_id IS NOT NULL
              AND tenant_id <> ''
            GROUP BY execution_id
            HAVING COUNT(DISTINCT tenant_id) = 1
        ) src
        WHERE (ec.tenant_id IS NULL OR ec.tenant_id = '')
          AND ec.execution_id = src.execution_id;
    END IF;
END $$;

DO $$
DECLARE
    remaining BIGINT;
BEGIN
    IF to_regclass('execution_context') IS NULL THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO remaining
    FROM execution_context
    WHERE tenant_id IS NULL OR tenant_id = '';

    IF remaining = 0 THEN
        ALTER TABLE execution_context ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE execution_context DROP CONSTRAINT IF EXISTS execution_context_tenant_id_not_empty;
        ALTER TABLE execution_context ADD CONSTRAINT execution_context_tenant_id_not_empty CHECK (tenant_id <> '');
        RAISE NOTICE 'execution_context.tenant_id constrained tenant-bound (no tenant-null rows remained).';
    ELSE
        RAISE WARNING 'execution_context still has % tenant-null/empty row(s) after deterministic backfill; NOT NULL/CHECK not applied. Application-level fail-closed enforcement remains the guard and these rows are excluded from tenant-scoped reads.', remaining;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS execution_context_tenant_execution_idx
    ON execution_context (tenant_id, execution_id);
