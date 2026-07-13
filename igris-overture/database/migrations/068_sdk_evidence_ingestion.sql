-- Migration 068: Embedded SDK evidence ingestion (Connected slice 2).
--
-- Locally signed Embedded evidence (decision/outcome events from the SDK
-- journal) is explicitly uploaded, server-verified, and stored here.
-- These tables are DELIBERATELY separate from task_records / Managed receipt
-- storage: locally observed evidence must never be representable as
-- runtime-verified Managed evidence (docs/architecture/
-- igris-progressive-contract-v1.md §7-9, igris-connected-data-impact.md §2).
--
-- NOTE: this migration is intentionally NOT applied as part of this change.
-- It is committed for the normal manual migration runbook. Never auto-apply.

-- Tenant-scoped SDK signing identities. PUBLIC keys only — a private key or
-- API credential is never accepted, transmitted, or stored. The key proves
-- possession of an SDK signing identity, not the identity of a human, a
-- device, or a secure hardware boundary. Registration is implicit on the
-- first VERIFIED evidence batch for (tenant, key_id). Rotation/revocation
-- are deferred. The same public key used by two tenants produces two
-- independent rows; nothing joins across tenants.
CREATE TABLE IF NOT EXISTS sdk_signing_keys (
    tenant_id TEXT NOT NULL,
    key_id TEXT NOT NULL,                  -- 'ed25519:<first-16-hex-of-sha256(pubkey)>'
    public_key_pem TEXT NOT NULL,
    -- Server-computed SHA-256 hex of the raw 32-byte public key. The key_id
    -- must be its prefix; a same-key_id different-fingerprint submission is
    -- an explicit conflict, never an overwrite.
    fingerprint_sha256 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, key_id)
);

-- One row per submitted evidence batch. Append-only: the application layer
-- exposes INSERT and SELECT only; accepted evidence is never rewritten.
CREATE TABLE IF NOT EXISTS sdk_evidence_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    -- Evidence LIFECYCLE, not execution provenance.
    evidence_state TEXT NOT NULL
        CHECK (evidence_state IN ('received', 'verified', 'rejected')),
    -- Who executed. This ingestion path stores locally observed execution
    -- ONLY; the CHECK admits exactly one value, so a client claim of
    -- 'managed' (or anything else) is structurally impossible here. Managed
    -- evidence lives on task_records via the authenticated runtime-callback
    -- path — a different table.
    execution_provenance TEXT NOT NULL DEFAULT 'embedded'
        CHECK (execution_provenance = 'embedded'),
    -- Deterministic batch identity: SHA-256 over the ordered submitted
    -- event-hash manifest (plus key_id). Natural idempotency: resubmitting
    -- the same evidence resolves to this row instead of a duplicate.
    content_hash TEXT NOT NULL,
    first_previous_event_hash TEXT,        -- NULL = genesis batch
    chain_head TEXT,                       -- terminal event_hash (verified batches)
    events_accepted INT NOT NULL DEFAULT 0,
    events_verified INT NOT NULL DEFAULT 0,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verification_error_code TEXT,
    -- Bounded issue metadata for rejected batches: [{"index": i, "code": c}]
    -- only — never raw event payloads, never signatures, never inputs.
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (tenant_id, key_id, content_hash)
);

-- Fork prevention is structural: at most one VERIFIED batch may extend any
-- given chain position per (tenant, key). COALESCE folds the NULL genesis
-- into a single slot so two concurrent genesis batches cannot both land.
CREATE UNIQUE INDEX IF NOT EXISTS sdk_evidence_batches_chain_slot_idx
    ON sdk_evidence_batches (tenant_id, key_id, COALESCE(first_previous_event_hash, 'genesis'))
    WHERE evidence_state = 'verified';

CREATE INDEX IF NOT EXISTS sdk_evidence_batches_stream_idx
    ON sdk_evidence_batches (tenant_id, key_id, received_at DESC);

-- One row per verified event. Append-only; the primary key doubles as
-- cross-batch deduplication. Only events from VERIFIED batches are stored —
-- rejected submissions keep bounded issue metadata on the batch row only.
CREATE TABLE IF NOT EXISTS sdk_evidence_events (
    tenant_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    event_hash TEXT NOT NULL,              -- server-recomputed, 64 hex
    batch_id UUID NOT NULL REFERENCES sdk_evidence_batches(id),
    event JSONB NOT NULL,                  -- verbatim signed SDK event
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('decision', 'outcome')),
    action_name TEXT NOT NULL,
    contract_hash TEXT NOT NULL,
    -- Same structural rule as the batch: locally observed execution only.
    execution_provenance TEXT NOT NULL DEFAULT 'embedded'
        CHECK (execution_provenance = 'embedded'),
    previous_event_hash TEXT,
    timestamp_utc TIMESTAMPTZ NOT NULL,    -- client-reported; NOT trusted time
    PRIMARY KEY (tenant_id, key_id, event_hash)
);

CREATE INDEX IF NOT EXISTS sdk_evidence_events_action_idx
    ON sdk_evidence_events (tenant_id, action_name, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS sdk_evidence_events_event_id_idx
    ON sdk_evidence_events (tenant_id, key_id, event_id);

-- Explicit Idempotency-Key replay records for POST /v1/evidence/batches,
-- bound to the batch content fingerprint: the same key with a different
-- fingerprint is an explicit 409 conflict. Tenant-scoped by primary key.
-- Replay records, not audit records; a periodic TTL sweep is acceptable.
CREATE TABLE IF NOT EXISTS evidence_ingest_idempotency (
    tenant_id TEXT NOT NULL,
    operation TEXT NOT NULL DEFAULT 'evidence_ingest',
    key_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    response_status INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, operation, key_id, idempotency_key)
);
