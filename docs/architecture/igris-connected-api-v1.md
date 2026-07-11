# Igris Connected API v1 — Specification

Status (updated 2026-07-11): **§1 (contract synchronization) and §2 (contract
lookup) are IMPLEMENTED** on branch `feature/igris-connected-contract-sync`
(`igris-overture/api/routes_contracts.go`, registered via
`RegisterContractRoutes`, present in the route manifest and route-surface
inventory; storage per migration `067_action_contract_versions.sql`, created
and not applied). Implementation notes and deviations:
`igris-connected-first-slice.md`.

**§3 (evidence ingestion) and §4 (evidence status) remain DESIGN ONLY.**
Those endpoints do not exist, are not registered, and accept nothing.

Implemented behavior notes for §1 (see the endpoint's tests for the
authority): the optional `Idempotency-Key` header IS implemented, bound to
`(tenant, operation, action_name)` with the server-recomputed fingerprint;
strict field validation rejects unknown contract fields and unknown
top-level request fields (including any caller-supplied `tenant_id`);
responses additionally include `action.id` and `version.id` (UUIDs) alongside
the documented fields; auto-created logical actions carry
`target_type=embedded_sdk`, which the action gateway refuses to execute.

Conventions inherited from the existing API (verified in
`igris-overture/api/routes_actions.go`, `route_manifest.go`):
`RegisterXRoutes(app, db, ...)` per file; route groups under `/v1/...`;
`middleware.BetterAuth(db)` with tenant = authenticated user id; errors as
`{"error": "<snake_case_code>", ...}` with precise HTTP status; body
`tenant_id` never trusted.

Authentication for every endpoint below: BetterAuth session **or**
tenant-scoped API key. Authorization: the derived tenant must own the
resource; there is no cross-tenant read or write. All limits return
`413 payload_too_large` or `422 validation_failed` with a `detail` field.

---

## 1. Contract synchronization

```
POST /v1/contracts/sync
```

Registers (or re-registers, idempotently) a code-declared ActionContract as an
immutable version of a tenant-owned logical action. **Grants no execution
permission.**

### Request

Headers: `Content-Type: application/json`; optional `Idempotency-Key`
(1–128 chars, `[A-Za-z0-9._:-]`).

```json
{
  "contract": { ...ActionContract v1 verbatim, as the SDK emits it... },
  "client": {
    "sdk": "igris-python",
    "sdk_version": "0.1.0",
    "key_id": "ed25519:5b3f9c2a17d4e8f0"
  }
}
```

- `contract` is the complete ActionContract v1 object
  (`docs/architecture/igris-progressive-contract-v1.md` §4; fixture:
  `testdata/igris-contract-v1/action_contract.json`).
- `client.key_id` is optional advisory context (which local identity is
  syncing); it is **not** authentication.

### Validation (in order; first failure wins)

1. Body ≤ 64 KiB; `contract` present and an object.
2. `contract.schema_version` ∈ {"1"} else `422 unsupported_schema_version`.
3. `contract.action_name` matches the SDK rule (letter start, `[A-Za-z0-9._:-]`,
   ≤128) else `422 invalid_action_name`.
4. `contract.risk` ∈ {low, medium, high, critical};
   `contract.approval_mode` ∈ {required, never};
   `contract.execution_mode` ∈ {embedded} (v1 accepts only what the SDK
   emits) else `422 validation_failed`.
5. `parameter_descriptors` ≤ 128 entries; each string field ≤ 512 chars.
6. **Fingerprint check**: server recomputes SHA-256 over the canonical JSON
   (sorted keys, compact separators, `ensure_ascii=false`, UTF-8) of the
   contract minus `contract_hash`. Mismatch → `422 contract_hash_mismatch`.
   The recomputed value — never the client's — is used everywhere after this
   point. This is the request fingerprint for idempotency.

### Semantics

- Look up logical action `(tenant, action_name)`; create it if absent
  (`origin = "sdk_sync"`). Existing manual action with the same name: attach
  the version to it and set `origin_divergence: true` in the response.
- Look up version `(tenant, action_name, contract_hash)`:
  - absent → insert immutable version; compute security-sensitive delta vs the
    latest prior version (risk lowered, `approval_mode` `required→never`,
    `execution_mode` changed); respond `201`.
  - present → respond `200` with the existing version (`created: false`).
    Version rows are never updated.
- `Idempotency-Key` handling (before the above): if
  `(tenant, "contract_sync", action_name, key)` exists —
  stored fingerprint == recomputed fingerprint → replay stored response
  (status + body, plus `Idempotency-Replayed: true` header); differs →
  `409 idempotency_key_conflict`. If absent, record it with the fingerprint
  and a response snapshot after success.

### Response `201` (new version) / `200` (existing)

```json
{
  "action": {
    "tenant_owned": true,
    "action_name": "customer.refund",
    "origin": "sdk_sync",
    "origin_divergence": false
  },
  "version": {
    "contract_hash": "123a1daf6d1e6123...",
    "schema_version": "1",
    "created": true,
    "created_at": "2026-07-10T15:04:05.123456Z",
    "security_sensitive_change": false,
    "policy_flags": []
  },
  "grants": {
    "execution_permission": false,
    "note": "synchronization records a declaration; it authorizes nothing"
  }
}
```

`policy_flags` examples: `["risk_lowered:critical->medium"]`,
`["approval_weakened:required->never"]`.

### Errors

| Status | `error` | Retry-safe |
| --- | --- | --- |
| 401 | `unauthenticated` | after fixing credentials |
| 400 | `invalid_body` | no (fix request) |
| 413 | `payload_too_large` | no |
| 422 | `unsupported_schema_version` \| `invalid_action_name` \| `contract_hash_mismatch` \| `validation_failed` | no |
| 409 | `idempotency_key_conflict` | no (new key or drop header) |
| 429 | `rate_limited` | yes, honor `Retry-After` |
| 500 | `db_error` | yes (operation is content-keyed upsert; retry cannot double-create) |

---

## 2. Contract lookup

```
GET /v1/contracts/actions/:name            → logical action + version summaries
GET /v1/contracts/actions/:name/versions/:contract_hash → one full version
```

Tenant-scoped reads. `:name` is the logical action name (URL-encoded);
`:contract_hash` is 64 lowercase hex chars else `400 invalid_contract_hash`.

`GET /v1/contracts/actions/:name` response `200`:

```json
{
  "action_name": "customer.refund",
  "origin": "sdk_sync",
  "created_at": "...",
  "versions": [
    {
      "contract_hash": "123a1daf...",
      "created_at": "...",
      "risk": "critical",
      "approval_mode": "required",
      "execution_mode": "embedded",
      "security_sensitive_change": false
    }
  ]
}
```

Ordered newest-first; paginate with `?limit=` (default 50, max 200) and
`?before=<created_at>`. The version-detail route returns the verbatim stored
contract body plus the summary fields. `404 action_not_found` /
`404 contract_version_not_found` for absent (or other-tenant — indistinguishable
by design) resources.

---

## 3. Evidence ingestion

```
POST /v1/evidence/batches
```

Accepts a contiguous segment of a local SDK journal for central storage and
verification. **Prerequisite** (separate, explicit step — out of scope for
slice 1): the tenant has registered the SDK verification public key so the
server can resolve `key_id → public key` by `(tenant_id, key_id)`, mirroring
tenant-scoped runtime callback key lookup.

### Request

Headers: optional `Idempotency-Key` (same rules as sync; fingerprint = batch
content hash, computed server-side over the concatenated event bytes).

```json
{
  "key_id": "ed25519:5b3f9c2a17d4e8f0",
  "journal_segment": {
    "first_previous_event_hash": null,
    "events": [ { ...event v1 verbatim... }, ... ]
  }
}
```

Limits: ≤ 500 events per batch; ≤ 1 MiB body; events must be in journal order
and internally chain-linked (`events[i].previous_event_hash ==
events[i-1].event_hash`); `first_previous_event_hash` must equal the stored
chain head for this `(tenant, key_id)` (or `null` for a first batch), else
`409 chain_head_mismatch` (the client must resync from the server's reported
head, returned in the error body as `expected_head`).

### Semantics

- The server treats the payload as hostile: it recomputes every `event_hash`,
  verifies every signature against the registered key, and validates schema
  version and event-type fields.
- **Execution provenance**: every record written by this endpoint gets
  `execution_provenance = "embedded"`, unconditionally and write-once. There
  is **no request field for provenance** — a client cannot claim `managed`,
  and nothing on this path can ever produce it; `managed` is assignable only
  by the authenticated runtime-callback path. Verification success does NOT
  change execution provenance (Connected is a participation mode, not an
  execution mechanism).
- **Evidence lifecycle** (`evidence_state`, separate from provenance):
  `received` on durable acceptance (`received_at` set) →
  `verified` (`verified_at`, `verification_key_id` set) or
  `rejected` (`verification_error_code` set). Transitions are
  `received → verified` and `received → rejected` only; `rejected` evidence
  is never re-promoted in place (resubmit a corrected batch instead) and is
  never associated with `managed` provenance.
- Acceptance is asynchronous: `202` with a `batch_id`; verification status is
  read via §4. Re-submission of a byte-identical batch is idempotent
  (`200`, same `batch_id`). Overlapping/duplicate events (same
  `(tenant, key_id, event_hash)`) are stored once.

### Response `202`

```json
{"batch_id": "b_01J...", "events_accepted": 5, "evidence_state": "received"}
```

### Errors

`401 unauthenticated`, `400 invalid_body`, `404 unknown_key_id` (key not
registered for this tenant), `409 chain_head_mismatch` (with
`expected_head`), `409 idempotency_key_conflict`, `413/422` as above,
`429/500` retry-safe. A batch that verifies as internally broken is **not**
an HTTP error — it is accepted and reported as `rejected` with issues via §4,
because "this journal fails verification" is itself evidence worth keeping.

---

## 4. Evidence ingestion status

```
GET /v1/evidence/batches/:batch_id
```

Tenant-scoped. Response `200`:

```json
{
  "batch_id": "b_01J...",
  "evidence_state": "received" | "verified" | "rejected",
  "execution_provenance": "embedded",
  "events_accepted": 5,
  "events_verified": 5,
  "received_at": "2026-07-10T15:04:05Z",
  "verified_at": "2026-07-10T15:04:06Z",
  "verification_key_id": "ed25519:5b3f9c2a17d4e8f0",
  "verification_error_code": null,
  "issues": [
    {"index": 2, "code": "bad_signature", "message": "..."}
  ],
  "chain_head": "d0dfd2fc..."
}
```

`execution_provenance` is always `"embedded"` on this read — it reports who
executed, and this endpoint only ever stores locally observed evidence.
`evidence_state=verified` ⇒ every event's hash, signature, and linkage
checked against the registered key. `evidence_state=rejected` ⇒
`verification_error_code` holds the dominant failure and `issues` the
per-event detail; codes reuse the SDK verifier vocabulary
(`malformed_json`, `unknown_schema`, `missing_fields`, `chain_break`,
`hash_mismatch`, `unknown_key`, `bad_signature`). `404 batch_not_found`
otherwise. (`local_only` never appears here: evidence that was never
submitted has no central record to read.)

---

## Cross-cutting requirements for implementation

- New route files follow the existing pattern (`routes_contracts.go`,
  `routes_evidence.go`) with `RegisterContractRoutes` /
  `RegisterEvidenceRoutes`; entries added to `route_manifest.go` and
  `testdata/route_manifest.default.json`; classified in
  `route_surface_test.go` as core public product API.
- Rate limits: sync ≤ 60/min/tenant (implemented with
  `middleware.NewRateLimiter` on the `/v1/contracts` group); evidence ≤ 20
  batches/min/tenant (initial value, design only).
- Slice 1 implements **only** §1 and §2 (see
  `igris-connected-first-slice.md`); §3 and §4 are specified now so slice 1's
  storage decisions don't paint them into a corner, and remain unregistered.
