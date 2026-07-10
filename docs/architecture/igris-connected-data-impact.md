# Igris Connected — Database Impact Analysis (NO MIGRATION CREATED)

Status: analysis only. This branch creates and applies **no** migration. The
DDL sketches below are illustrations for the future migration author, not
migration files. Migration numbering at time of writing: latest committed is
`066_trust_recommendation_states.sql`; note memory/records indicate 064–066
were applied to prod 2026-06-23 — the future author must re-verify the next
free number and prod state.

## 1. Current schema, as verified on this branch

### Registered actions — `action_definitions` (migration 054, 055)

```
id UUID PK, tenant_id TEXT, name TEXT, display_name, description,
target_type TEXT, target_url, method, policy_preset, replay_class,
approval_required BOOL, irreversible BOOL, secret_refs JSONB,
target_metadata JSONB, created_at, updated_at, archived_at
UNIQUE (tenant_id, name) WHERE archived_at IS NULL
INDEX (tenant_id, updated_at DESC) WHERE archived_at IS NULL
```

Properties that matter here: tenant-owned names (matches the ADR identity
model exactly); rows are **mutable** (PATCH updates in place; archive is
soft-delete); no contract fingerprint, no version history, no origin marker.

### Evidence and receipts — columns on `task_records`

- `execution_receipt JSONB` (032), `proof_execution_id/expected_hash/
  stored_hash/signature/status/checked_at` (033), `proof_verified` (049),
  callback envelope audit (052), lineage tenant-bound (058).
- Everything is **task-bound**: a receipt exists only as an attribute of a
  durable dispatched task, produced via the authenticated runtime callback
  path. Execution provenance is implicit ("it's on a task ⇒ it came from a
  runtime") — i.e. `task_records` receipts are the `managed` side of the
  structural separation.

### Idempotency — `task_records` (057)

`UNIQUE (tenant_id, idempotency_key)`. No payload fingerprint column;
same-key different-payload is not detected (documented in the core reuse map
and the reason the Connected API defines its own idempotency binding).

## 2. Fit assessment

### Can immutable contract versions fit existing tables? **No.**

- `action_definitions` rows are mutable by design (PATCH) and uniquely keyed
  by `(tenant, name)` — one row per action, not per version. Storing versions
  there would either overwrite history (forbidden by the ADR) or break the
  unique index. A version-history table is required.
- The logical-action row itself, however, fits `action_definitions` well:
  tenant ownership, name uniqueness, archive semantics, and sanitized
  metadata handling are exactly what the ADR needs.

### Can Embedded provenance fit existing evidence records? **No — misclassification risk.**

- `task_records.execution_receipt` semantically means "authenticated runtime
  callback attached this to a dispatched task". SDK decision/outcome events
  have no task, no runtime, no dispatch, and a different schema. Storing them
  on `task_records` (or as `ExecutionReceipt` rows) would make locally
  observed evidence indistinguishable from runtime-verified evidence — the
  exact misclassification the provenance model forbids.
- SDK evidence therefore needs its own table(s) carrying two explicit
  fields: write-once `execution_provenance` (structurally restricted to
  `embedded` on this path) and `evidence_state` (lifecycle:
  received/verified/rejected). Central verification changes the lifecycle
  state, never the execution provenance.

## 3. Likely schema additions (exact, but NOT created here)

### Required for slice 1 (contract synchronization)

**New table `action_contract_versions`** — immutable, append-only:

```sql
CREATE TABLE action_contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    action_name TEXT NOT NULL,
    contract_hash TEXT NOT NULL,          -- 64 hex, server-recomputed
    schema_version TEXT NOT NULL,
    contract JSONB NOT NULL,              -- verbatim ActionContract v1
    risk TEXT NOT NULL,
    approval_mode TEXT NOT NULL,
    execution_mode TEXT NOT NULL,
    code_fingerprint TEXT,                -- nullable, as in the SDK
    security_sensitive_change BOOLEAN NOT NULL DEFAULT false,
    policy_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    source TEXT NOT NULL DEFAULT 'sdk_sync',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX action_contract_versions_identity_idx
    ON action_contract_versions (tenant_id, action_name, contract_hash);
CREATE INDEX action_contract_versions_history_idx
    ON action_contract_versions (tenant_id, action_name, created_at DESC);
```

Tenant isolation: every query predicate includes `tenant_id`; the unique
index makes cross-tenant hash collisions irrelevant (identity is per-tenant).
Immutability: application layer exposes INSERT and SELECT only (same
discipline as receipt rows); optionally enforce with a `BEFORE UPDATE` raise
trigger — the future migration author decides.

**Additive columns on `action_definitions`** (backward-compatible; defaults
preserve existing rows and PATCH behavior):

```sql
ALTER TABLE action_definitions
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual',       -- 'manual' | 'sdk_sync'
    ADD COLUMN IF NOT EXISTS latest_contract_hash TEXT;                    -- convenience pointer, nullable
```

**Idempotency-key table for sync** (required only if the optional
`Idempotency-Key` header is implemented in slice 1 — see "optional" below):

```sql
CREATE TABLE contract_sync_idempotency (
    tenant_id TEXT NOT NULL,
    operation TEXT NOT NULL DEFAULT 'contract_sync',
    action_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,    -- the recomputed contract_hash
    response_status INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, operation, action_name, idempotency_key)
);
```

Needs a TTL/cleanup policy (e.g. 24h sweep) — idempotency records are not
audit records.

### Required later (evidence ingestion, NOT slice 1)

```sql
CREATE TABLE sdk_verification_keys (
    tenant_id TEXT NOT NULL,
    key_id TEXT NOT NULL,                 -- 'ed25519:<16 hex>'
    public_key_pem TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, key_id)       -- mirrors (tenant_id, runtime_id) callback lookup
);

CREATE TABLE sdk_evidence_batches (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    -- Evidence LIFECYCLE, not execution provenance:
    evidence_state TEXT NOT NULL
        CHECK (evidence_state IN ('received', 'verified', 'rejected')),
    content_hash TEXT NOT NULL,           -- batch idempotency fingerprint
    events_accepted INT NOT NULL,
    events_verified INT NOT NULL DEFAULT 0,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verification_key_id TEXT,
    verification_error_code TEXT,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (tenant_id, key_id, content_hash)
);

CREATE TABLE sdk_evidence_events (
    tenant_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    event_hash TEXT NOT NULL,
    batch_id UUID NOT NULL REFERENCES sdk_evidence_batches(id),
    event JSONB NOT NULL,                 -- verbatim SDK event
    event_type TEXT NOT NULL,             -- decision | outcome
    action_name TEXT NOT NULL,
    contract_hash TEXT NOT NULL,
    -- Execution provenance: who executed. This table stores locally observed
    -- execution ONLY; the CHECK admits exactly one value, so 'managed' (or
    -- any future value) is structurally impossible to insert here. Managed
    -- evidence lives on task_records via the authenticated runtime-callback
    -- path — a different table, which is itself the second structural
    -- separation. Write-once: no UPDATE path in the store.
    execution_provenance TEXT NOT NULL DEFAULT 'embedded'
        CHECK (execution_provenance = 'embedded'),
    previous_event_hash TEXT,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant_id, key_id, event_hash)
);
CREATE INDEX sdk_evidence_events_action_idx
    ON sdk_evidence_events (tenant_id, action_name, timestamp_utc DESC);
```

Two orthogonal fields, per the corrected ADR (§7–9): `execution_provenance`
(embedded | managed — and only `embedded` can exist in SDK evidence tables)
answers *who executed*; `evidence_state` (received | verified | rejected;
`local_only` exists only as the absence of a central record) answers *where
the evidence is in its lifecycle*. Verification success updates
`evidence_state`, never `execution_provenance`. `rejected` rows keep their
`embedded` provenance and are never promoted.

## 4. Required vs optional vs no-migration

| Item | Classification |
| --- | --- |
| `action_contract_versions` table | **Required** for slice 1 — no existing table can hold immutable versions. |
| `action_definitions.origin` column | Required for slice 1 (distinguishes manual vs sdk_sync logical actions; the reuse map flags this separation). |
| `action_definitions.latest_contract_hash` | Optional — derivable by query; add only if list views need it. |
| `contract_sync_idempotency` table | Optional for slice 1 — natural content idempotency already makes sync retry-safe; the header adds replay-of-response and explicit key conflict. Slice 1 may ship natural idempotency only and defer the header (documented in the first-slice plan). |
| Evidence tables + key table | Required **later**, not slice 1. Specified now so slice 1 makes no conflicting choice. |
| Reusing `task_records` / `execution_receipt` for SDK evidence | **Rejected** — misclassification (see §2). |
| Reusing task idempotency for sync | **Rejected** — no payload fingerprint (057; reuse map). |
| No-migration alternative for slice 1 | Storing versions inside `action_definitions.target_metadata` JSONB. Rejected: mutable row, no uniqueness on (name, hash), no indexed history, silently breaks the immutability guarantee. There is **no acceptable no-migration path** for slice 1. |

## 5. Indexing, uniqueness, tenant-isolation summary

- Every new table carries `tenant_id` in its primary key or a tenant-leading
  unique index; every read path filters by tenant with no tenant-null
  fallback (same discipline `routes_proof_tenant_scope_test.go` enforces for
  receipts).
- Uniqueness: `(tenant, action_name, contract_hash)` for versions;
  `(tenant, key_id)` for keys; `(tenant, key_id, event_hash)` for events;
  `(tenant, key_id, content_hash)` for batches.
- Growth: versions are small and bounded by deploys; evidence events are the
  volume risk — the event PK doubles as dedup, and batch-level `content_hash`
  keeps re-uploads cheap. Partitioning by tenant or month is a later concern;
  nothing above precludes it.
