-- Migration 058: Enforce tenant-bound execution lineage (proof) records.
--
-- execution_lineage is the append-only receipt/proof ledger and a core
-- multi-tenant trust object. Historically tenant_id was nullable (migration
-- 006), and several read paths accepted `tenant_id IS NULL`, creating a
-- tenant-boundary exception where a tenant-null proof row could surface across
-- tenants. The application layer now (a) refuses to persist tenant-null lineage
-- (coordinator.saveExecutionLineage → ErrExecutionLineageMissingTenant) and
-- (b) only returns lineage that matches the authenticated tenant (no normal
-- read path uses `OR tenant_id IS NULL` anymore).
--
-- This migration aligns the schema with that behavior:
--   1. Deterministically backfill tenant_id for legacy tenant-null rows from a
--      single unambiguous tenant-bound source (task_records.proof_execution_id,
--      then execution_context.execution_id). Backfill only when the execution
--      maps to exactly one distinct tenant, so a tenant is never guessed.
--   2. Apply NOT NULL (and a non-empty CHECK) only if no tenant-null/empty rows
--      remain after backfill. If any remain, the constraint is intentionally
--      NOT applied and a warning is raised — application-level fail-closed
--      enforcement stays the guard and those rows remain invisible to normal
--      tenant-scoped reads.
--
-- Forward-only. Safe to re-run.

-- ── 1a. Backfill from task_records (durable task → receipt link) ─────────────
UPDATE execution_lineage el
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
WHERE (el.tenant_id IS NULL OR el.tenant_id = '')
  AND el.execution_id = src.execution_id;

-- ── 1b. Backfill any still-null rows from execution_context (if present) ─────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'execution_context'
    ) THEN
        UPDATE execution_lineage el
        SET tenant_id = src.tenant_id
        FROM (
            SELECT execution_id, MIN(tenant_id) AS tenant_id
            FROM execution_context
            WHERE execution_id IS NOT NULL
              AND execution_id <> ''
              AND tenant_id IS NOT NULL
              AND tenant_id <> ''
            GROUP BY execution_id
            HAVING COUNT(DISTINCT tenant_id) = 1
        ) src
        WHERE (el.tenant_id IS NULL OR el.tenant_id = '')
          AND el.execution_id = src.execution_id;
    END IF;
END $$;

-- ── 2. Constrain tenant_id only when safe ───────────────────────────────────
DO $$
DECLARE
    remaining BIGINT;
BEGIN
    SELECT COUNT(*) INTO remaining
    FROM execution_lineage
    WHERE tenant_id IS NULL OR tenant_id = '';

    IF remaining = 0 THEN
        ALTER TABLE execution_lineage ALTER COLUMN tenant_id SET NOT NULL;
        -- An empty-string tenant is as unreachable as NULL for equality reads;
        -- forbid it too so the trust object is always genuinely tenant-bound.
        ALTER TABLE execution_lineage DROP CONSTRAINT IF EXISTS execution_lineage_tenant_id_not_empty;
        ALTER TABLE execution_lineage ADD CONSTRAINT execution_lineage_tenant_id_not_empty CHECK (tenant_id <> '');
        RAISE NOTICE 'execution_lineage.tenant_id constrained tenant-bound (no tenant-null rows remained).';
    ELSE
        RAISE WARNING 'execution_lineage still has % tenant-null/empty row(s) after backfill; NOT NULL/CHECK not applied. Application-level fail-closed enforcement remains the guard and these rows are excluded from tenant-scoped reads.', remaining;
    END IF;
END $$;

-- ── 3. Tenant-scoped index for receipt-hash chain traversal ─────────────────
-- fetchReceiptForChain filters WHERE receipt_hash = $1 AND tenant_id = $2.
CREATE INDEX IF NOT EXISTS idx_execution_lineage_tenant_receipt_hash
    ON execution_lineage (tenant_id, receipt_hash);
