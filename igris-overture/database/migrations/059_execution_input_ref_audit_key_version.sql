-- Migration 059: record safe key version metadata on input-ref decrypt audits.
--
-- key_version is safe rotation metadata. It must never contain key material,
-- ciphertext, nonce, or plaintext.

ALTER TABLE execution_input_ref_audit
    ADD COLUMN IF NOT EXISTS key_version TEXT NOT NULL DEFAULT '';
