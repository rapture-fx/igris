-- Migration 067: Immutable ActionContract versions for Connected contract sync.
--
-- First Connected slice (docs/architecture/igris-connected-first-slice.md):
-- a code-declared Embedded ActionContract is synchronized as an immutable
-- version of a tenant-owned logical action. Synchronization records a
-- declaration; it NEVER grants execution permission.
--
-- NOTE: this migration is intentionally NOT applied as part of this change.
-- It is committed for the normal manual migration runbook. Never auto-apply.

-- Append-only contract version history. The application layer exposes INSERT
-- and SELECT only — a version row is never updated or deleted. A changed
-- contract_hash always creates a NEW row; history is preserved verbatim.
CREATE TABLE IF NOT EXISTS action_contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    action_name TEXT NOT NULL,
    -- 64 lowercase hex chars, ALWAYS server-recomputed from the canonical
    -- contract body — never trusted from the client.
    contract_hash TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    -- Verbatim ActionContract v1 body (canonical field set; no function
    -- inputs, no local events, no journals, no keys are ever stored here).
    contract JSONB NOT NULL,
    risk TEXT NOT NULL,
    approval_mode TEXT NOT NULL,
    execution_mode TEXT NOT NULL,
    code_fingerprint TEXT,
    -- Security-sensitive delta vs the latest prior version at insert time
    -- (risk lowered, approval required->never, execution_mode changed).
    -- Computed server-side; visible, never silent.
    security_sensitive_change BOOLEAN NOT NULL DEFAULT false,
    policy_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    source TEXT NOT NULL DEFAULT 'sdk_sync',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Version identity is per-tenant: (tenant, logical action, contract hash).
-- This uniqueness is a correctness requirement — concurrent identical syncs
-- must resolve to exactly one row (INSERT ... ON CONFLICT DO NOTHING + read).
CREATE UNIQUE INDEX IF NOT EXISTS action_contract_versions_identity_idx
    ON action_contract_versions (tenant_id, action_name, contract_hash);

CREATE INDEX IF NOT EXISTS action_contract_versions_history_idx
    ON action_contract_versions (tenant_id, action_name, created_at DESC);

-- Distinguish manually registered logical actions from SDK-declared ones.
-- Additive with a default: existing rows and PATCH behavior are unchanged.
ALTER TABLE action_definitions
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

-- Explicit Idempotency-Key replay records for POST /v1/contracts/sync.
-- The key is bound to the tenant, the operation, the logical action, and the
-- server-recomputed request fingerprint (the contract hash): the same key
-- with a different fingerprint is an explicit 409 conflict, never a silent
-- replay of a different payload. Records never cross tenant boundaries (the
-- tenant is the leading primary-key column and every lookup filters on it).
-- These are replay records, not audit records; a periodic TTL sweep (e.g.
-- 24h) is an acceptable future cleanup policy.
CREATE TABLE IF NOT EXISTS contract_sync_idempotency (
    tenant_id TEXT NOT NULL,
    operation TEXT NOT NULL DEFAULT 'contract_sync',
    action_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    response_status INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, operation, action_name, idempotency_key)
);
