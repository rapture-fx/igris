-- Migration 033: Durable task proof state and lineage-triggered sync.
-- Adds cached proof-state columns to task_records and keeps them in sync when
-- verified execution receipts are inserted into execution_lineage.

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS proof_execution_id TEXT,
    ADD COLUMN IF NOT EXISTS proof_expected_hash TEXT,
    ADD COLUMN IF NOT EXISTS proof_stored_hash TEXT,
    ADD COLUMN IF NOT EXISTS proof_signature TEXT,
    ADD COLUMN IF NOT EXISTS proof_status TEXT,
    ADD COLUMN IF NOT EXISTS proof_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS task_records_proof_execution_idx
    ON task_records (tenant_id, proof_execution_id)
    WHERE proof_execution_id IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_task_record_proof_state_from_lineage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.execution_id IS NULL OR NEW.execution_id = '' OR NEW.tenant_id IS NULL OR NEW.tenant_id = '' THEN
        RETURN NEW;
    END IF;

    UPDATE task_records
    SET proof_stored_hash = NEW.receipt_hash,
        proof_signature = NEW.signature,
        proof_status = CASE
            WHEN COALESCE(task_records.proof_expected_hash, '') = '' THEN 'present'
            WHEN task_records.proof_expected_hash = NEW.receipt_hash THEN 'verified'
            ELSE 'mismatch'
        END,
        proof_checked_at = NOW()
    WHERE task_records.tenant_id = NEW.tenant_id
      AND task_records.proof_execution_id = NEW.execution_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_record_proof_state_from_lineage ON execution_lineage;

CREATE TRIGGER task_record_proof_state_from_lineage
AFTER INSERT OR UPDATE OF receipt_hash, signature, tenant_id, execution_id
ON execution_lineage
FOR EACH ROW
EXECUTE FUNCTION sync_task_record_proof_state_from_lineage();
