-- Migration 049: Persist the safe proof-verification summary on task_records.
--
-- /v1/tasks/:id/proof/verify already computes the cryptographic + chain-link
-- outcome (hash_valid, signature_matches, runtime_key_found, chain_link_valid)
-- but only returned it in the response. These columns let the task detail GET
-- path surface "Receipt verified" / "Chain intact" without re-running an
-- expensive verification. They store only booleans + a short reason string +
-- a timestamp — never receipt contents, payloads, or secrets.

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS proof_verified BOOLEAN,
    ADD COLUMN IF NOT EXISTS proof_hash_valid BOOLEAN,
    ADD COLUMN IF NOT EXISTS proof_signature_matches BOOLEAN,
    ADD COLUMN IF NOT EXISTS proof_runtime_key_found BOOLEAN,
    ADD COLUMN IF NOT EXISTS proof_chain_link_valid BOOLEAN,
    ADD COLUMN IF NOT EXISTS proof_verification_reason TEXT,
    ADD COLUMN IF NOT EXISTS proof_verified_at TIMESTAMPTZ;
