-- Migration 069: Database-enforced immutability for accepted Connected data.
--
-- Migrations 067 and 068 deliberately made ActionContract versions and SDK
-- evidence append-only at the application layer. This migration closes the
-- direct-SQL gap: UPDATE and DELETE are rejected even if an application bug
-- or overly broad table grant reaches these tables.
--
-- Current evidence ingestion inserts batches directly in their terminal
-- verified/rejected state. There is no supported post-insert batch lifecycle
-- transition, signing-key rotation, or revocation in the private alpha, so
-- the entire signing-key and batch rows are immutable as well.
--
-- Disaster recovery bypass is intentionally administrative and explicit:
-- the table owner or a PostgreSQL superuser may temporarily DISABLE these
-- named triggers during an audited restore, then re-enable them before the
-- database is returned to service. Application roles must never own these
-- tables or receive trigger-management privileges.
--
-- NOTE: this migration is committed for the normal manual migration runbook.
-- It is NOT applied to any shared, staging, or production database here.

CREATE OR REPLACE FUNCTION reject_connected_immutable_record_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'immutable Connected record: % on % is not permitted', TG_OP, TG_TABLE_NAME
        USING ERRCODE = '55000'; -- object_not_in_prerequisite_state
END;
$$;

DROP TRIGGER IF EXISTS action_contract_versions_immutable ON action_contract_versions;
CREATE TRIGGER action_contract_versions_immutable
    BEFORE UPDATE OR DELETE ON action_contract_versions
    FOR EACH ROW EXECUTE FUNCTION reject_connected_immutable_record_mutation();

DROP TRIGGER IF EXISTS sdk_signing_keys_immutable ON sdk_signing_keys;
CREATE TRIGGER sdk_signing_keys_immutable
    BEFORE UPDATE OR DELETE ON sdk_signing_keys
    FOR EACH ROW EXECUTE FUNCTION reject_connected_immutable_record_mutation();

DROP TRIGGER IF EXISTS sdk_evidence_batches_immutable ON sdk_evidence_batches;
CREATE TRIGGER sdk_evidence_batches_immutable
    BEFORE UPDATE OR DELETE ON sdk_evidence_batches
    FOR EACH ROW EXECUTE FUNCTION reject_connected_immutable_record_mutation();

DROP TRIGGER IF EXISTS sdk_evidence_events_immutable ON sdk_evidence_events;
CREATE TRIGGER sdk_evidence_events_immutable
    BEFORE UPDATE OR DELETE ON sdk_evidence_events
    FOR EACH ROW EXECUTE FUNCTION reject_connected_immutable_record_mutation();
