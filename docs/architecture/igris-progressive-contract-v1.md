# ADR: Igris Progressive Contract v1

Status: Accepted (design authority for Connected work; Connected is NOT implemented)
Date: 2026-07-10
Base: `origin/main` @ `c10cf9087` (includes Embedded SDK f1d4ba7df/4ae8d6f40/c10cf9087) + cherry-picked core readiness `a4492d3c4`
Sources of truth: `sdk/python/src/igris/` (implemented), `igris-overture/` (implemented), `docs/architecture/igris-core-reuse-map.md` (verified characterization), `testdata/igris-contract-v1/` (fixtures generated from the real SDK).

Everything marked **[implemented]** exists and is tested on this branch.
Everything marked **[design]** is specified here and does not exist yet.

## 1. Product direction

Igris is a drop-in action layer for AI agents. A developer installs Igris,
adds `@igris.guard` around a consequential function, and keeps their existing
agent environment. The code declaration is the action registration; manual
registration is not part of the primary developer experience. One product, one
action contract, three assurance levels.

## 2. Assurance-level boundaries

| Level | Claim | Status |
| --- | --- | --- |
| Embedded | Igris **observes** local execution: local approval, signed local decision/outcome evidence, offline verification. Zero network. | [implemented] `sdk/python` |
| Connected | Igris **coordinates**: explicit opt-in synchronization of code-declared contracts, shared policy, durable team approval, central evidence. | [design] this ADR + `igris-connected-api-v1.md` |
| Managed | Igris **controls** execution: authenticated runtime, dispatch, anti-replay, checkpoints, containment, safe-forward recovery, runtime receipts. | [implemented in core for registered actions; no SDK adapter] |

Non-negotiable: containment, anti-replay, checkpoints, recovery, and
exactly-once-style protections are Managed-execution claims only. Local
evidence is never presented as runtime-verified evidence.

## 3. Action identity

- **A tenant owns a logical action name.** [implemented in core for manual
  actions: unique `(tenant_id, name)` on `action_definitions` (migration 054);
  adopted unchanged for SDK-declared actions.]
- The SDK's `action_name` is the logical identity: caller-supplied
  (`@igris.guard(action="customer.refund")`) or derived as
  `module.qualified_name`. Validation (implemented in
  `contracts.validate_action_name`): starts with a letter, then letters,
  digits, `._:-`, max 128 chars. [implemented]
- The SDK's `action_id` (`module.qualified_name`) is a **code-location hint**,
  not the logical identity. Two code locations may deliberately share one
  logical action name over time (refactors); the backend keys on
  `(tenant_id, action_name)`. [design decision]
- Absolute filesystem paths, timestamps, memory addresses, and other unstable
  values never participate in identity — enforced by SDK tests
  (`test_contracts.py::TestContractHash::test_hash_excludes_unstable_values`).
  [implemented]
- Derived default names can collide across codebases (`__main__.refund` in two
  repos). Connected mode treats the tenant + logical name as the namespace and
  surfaces the module/qualified-name descriptor for disambiguation; developers
  shipping to Connected are steered (docs, not enforcement) toward explicit
  `action=` names. [design]

## 4. ActionContract v1 [implemented]

Exactly as emitted by `igris.contracts.build_contract` (fixture:
`testdata/igris-contract-v1/action_contract.json`):

```json
{
  "schema_version": "1",
  "action_name": "fixtures.customer.refund",
  "module": "__main__",
  "qualified_name": "refund_customer",
  "risk": "critical",                    // low | medium | high | critical
  "approval_mode": "required",           // required | never
  "execution_mode": "embedded",          // only value emitted today
  "parameter_descriptors": [
    {"name": "customer_id", "kind": "POSITIONAL_OR_KEYWORD",
     "has_default": false, "annotation": "str"}
  ],
  "code_fingerprint": "<sha256 hex of dedented source, or null>",
  "contract_hash": "<sha256 hex>"
}
```

`contract_hash` = SHA-256 hex of the canonical JSON (sorted keys, compact
separators, `ensure_ascii=false`, UTF-8) of every field above **except**
`contract_hash` itself. This makes the hash server-recomputable from the
contract body — Connected mode uses that as the request fingerprint (§16).

## 5. Contract versioning [design]

- A **contract version** is the immutable pair
  `(tenant_id, action_name, contract_hash)` plus the verbatim contract body.
- A logical action has an append-only history of versions. Historical versions
  are never overwritten, updated, or deleted (no UPDATE path in the store).
- A new `contract_hash` for an existing logical action **creates a new
  version**; it never silently replaces the prior version.
- Version ordering is by server receipt time (`created_at`), not by any
  client-supplied value. The SDK contract carries no version number — the hash
  is the version identity; ordering is a server-side observation.
- `code_fingerprint` may change while `contract_hash` changes with it; a
  changed fingerprint with an identical remaining contract still produces a
  new hash (fingerprint is inside the hash) — this is intentional: "same
  declaration, different code" is a policy-relevant fact.

## 6. Automatic registration semantics [design]

- First synchronization of `(tenant, action_name, contract_hash)` creates the
  logical action (if new) and its first immutable version. **No console step,
  no manual `POST /v1/actions` requirement.**
- Re-synchronization of the same triple is idempotent (§16).
- Automatic synchronization **never grants permission to execute** anything:
  it records a declaration. Managed execution eligibility, policy bindings,
  and approvals are separate, later, explicit steps.
- Security-sensitive deltas between the latest prior version and a new version
  — `risk` lowered, `approval_mode` moving `required → never`, or
  `execution_mode` changes — are computed server-side, stored on the version
  row, and returned in the response so policy can gate on them. They are
  visible, never silent.
- Manual registration (`/v1/actions`) continues to work unchanged for the
  transition period; a name collision between a manual action and an SDK sync
  attaches the version history to the existing logical action and flags
  `origin` divergence rather than duplicating the name (unique index forbids
  duplication anyway).

## 7–9. Provenance

Provenance is an explicit, immutable classification assigned by the backend at
write time. It is never inferred from payload shape, and **never** from the
mere existence of a receipt-like document.

| Provenance | Meaning | Assigned when |
| --- | --- | --- |
| `embedded` | Locally observed by the SDK. The claim is "a holder of this SDK key recorded this"; Igris did not control execution. | [design] Evidence arrives via the future evidence-ingestion API, verified against a tenant-registered SDK key. |
| `connected` | Locally observed AND centrally stored/verified: an `embedded` event batch whose signatures and chain the backend has verified against the registered key. | [design] Server-side verification succeeds; `connected` is a strengthened `embedded`, not a different origin. |
| `managed` | Execution occurred through an authenticated Igris runtime: signed runtime callback envelope, tenant+runtime-scoped key lookup, nonce anti-replay, body digest. | [implemented] Existing callback path (`runtime_callback_signature.go`; verified by `TestRuntimeCallbackPublicKeyLookupIsTenantScoped`). |

Rules:
- The provenance field is write-once. Reclassification is forbidden; a new
  record must be written instead (and would itself need a truthful basis).
- Managed provenance requires the authenticated runtime callback path. A
  receipt-shaped JSONB blob in a request body is not managed evidence.
- Read APIs must carry provenance through to operators verbatim; UI language
  for `embedded`/`connected` evidence must say "locally observed".

## 10. Decision and outcome event semantics [implemented]

As emitted by the SDK (fixtures: `testdata/igris-contract-v1/journal.jsonl`):

Shared fields: `schema_version` ("1"), `event_type` (`decision`|`outcome`),
`event_id` (UUIDv4), `action_id`, `action_name`, `contract_hash`,
`timestamp_utc` (RFC3339, `Z`, microseconds), `key_id`
(`ed25519:<first-16-hex-of-sha256(pubkey)>`), `previous_event_hash`
(JSON `null` genesis), `event_hash`, `signature`.

Decision adds: `decision` (`allowed`|`denied`), `risk`, `approval_mode`,
`redacted_input_summary` (bounded), `input_hash` (SHA-256 over the **redacted**
canonical input), optional `metadata` (redacted, canonical).

Outcome adds: `status` (`succeeded`|`failed`), `decision_event_id`,
`observed_result_type` (`null` on failure), optional `redacted_output_hash`;
on failure `exception_type` and `sanitized_error_summary` (secret-scrubbed,
bounded).

Semantic invariants (tested in `sdk/python/tests/`): decision precedes
execution; a denial is terminal (no outcome follows); a decision with no
following outcome means the process died or was interrupted mid-execution;
raw secrets appear in no persisted byte.

## 11. Managed receipt semantics [implemented, unchanged]

Runtime `ExecutionReceipt` (Rust `igris-server/src/receipt.rs`): resource
observations (cpu/wall/memory/fs/tool calls/violations) under containment,
hash-chained, Ed25519-signed by the registered runtime key, persisted onto
`task_records.execution_receipt` + `proof_*` columns, tenant-scoped reads.
**Embedded outcome events and managed receipts are different claims with
different strength and remain distinct record types.** No unification schema.

## 12. Shared cryptographic primitives [implemented]

Both SDK events and runtime receipts use: canonical JSON with sorted keys and
compact separators; SHA-256 over canonical bytes as the record hash; Ed25519
signature over the raw 32-byte SHA-256 digest, base64-encoded; append-only
hash-chained JSONL. A future Connected verifier reuses one verification core
for both, parameterized by schema.

## 13. Intentional schema differences [implemented]

| Aspect | SDK events | Runtime receipts |
| --- | --- | --- |
| Genesis link | `previous_event_hash: null` | `previous_hash: ""` |
| Non-ASCII | `ensure_ascii=false` (raw UTF-8) | Rust/Go serializers emit UTF-8 (equivalent), legacy Python client helper assumed ASCII |
| Versioning | explicit `schema_version` | none (implicit) |
| Identity | `key_id` fingerprint | registered runtime public key |
| Content | policy decision + observed outcome | measured resource usage under containment |

Connected ingestion must treat SDK events as their own versioned type; do not
coerce them into `ExecutionReceipt` (see reuse map, "must not be reused").

## 14. Tenant ownership [implemented pattern, adopted]

Tenant identity comes from authentication (BetterAuth session → tenant =
authenticated user id via `middleware.GetClerkUserID`, or tenant-scoped API
key), **never from a request body**. Body-supplied `tenant_id` is ignored or
rejected — the existing routes already behave this way and Connected endpoints
inherit the rule. All uniqueness, lookups, idempotency, and reads are
tenant-scoped. Cross-tenant synchronization is structurally impossible because
the tenant key is derived server-side.

## 15. Authentication boundaries

- Contract sync + contract lookup [design]: BetterAuth session **or**
  tenant-scoped API key (developer machines and CI will use API keys; the
  existing `/api/v1/*` API-key middleware pattern is the reference).
- Evidence ingestion [design]: same, plus the batch must reference a
  tenant-registered SDK verification key (`key_id`); key registration is a
  prerequisite step, mirroring how runtime callback keys are looked up by
  `(tenant_id, runtime_id)` today.
- Managed callbacks [implemented]: unchanged — signed runtime envelope only.
- Embedded mode performs no network activity, so it has no authentication
  surface at all; every Connected call is issued by an explicit, user-invoked
  connect/sync flow, never by `@igris.guard` itself.

## 16. Idempotency and conflict handling [design]

Task idempotency (`(tenant_id, idempotency_key)` unique on `task_records`,
migration 057) is **not sufficient** for contract sync: it has no payload
identity, so a reused key silently returns a task created from a different
payload. Contract sync therefore binds idempotency to a request fingerprint:

- **Request fingerprint** = `contract_hash`, server-recomputed from the
  submitted contract body (§4). A client-supplied `contract_hash` that does
  not match the server recomputation is rejected (`422 contract_hash_mismatch`)
  — the fingerprint cannot be spoofed independently of content.
- **Natural idempotency**: re-sync of the same
  `(tenant, action_name, contract_hash)` returns the existing version,
  `created: false`, `200`. No idempotency header needed for safety.
- **Header idempotency** (optional `Idempotency-Key`): bound to
  `(tenant_id, operation="contract_sync", action_name, idempotency_key)`
  with the stored fingerprint.
  - Same key + same fingerprint → replay the stored result.
  - Same key + **different** fingerprint → `409 idempotency_key_conflict`,
    explicit, non-retryable without a new key.
- A new fingerprint for an existing action (no header, or a fresh key) is not
  a conflict: it creates a new immutable version (§5).
- No exactly-once external-effect claim anywhere: sync is retry-safe because
  the operation is a pure upsert-by-content; evidence ingestion (later) is
  retry-safe by content hash of the batch, not by any exactly-once promise.

## 17. Failure semantics

- SDK-side [implemented]: fail closed before execution; `ActionDenied` on
  denial; distinct `EvidencePersistenceError` after execution; original
  exceptions re-raised unchanged.
- Connected sync [design]: retry-safe failures (5xx, timeouts, `429`) — the
  client may retry the identical request safely (§16). Non-retry-safe:
  `409 idempotency_key_conflict` (new key required), `422` validation
  (fix the request), `401/403` (fix credentials). Sync failures must never
  block or delay local guarded execution — Connected sync is out-of-band by
  design; Embedded behavior is unchanged when the backend is unreachable.
- Evidence ingestion [design]: acceptance (`202`) is not verification;
  verification status is a separate read (`igris-connected-api-v1.md`).

## 18. Threat model

Embedded [implemented, from SDK docs]: signatures prove key possession, not
approver legal identity; no trusted time; tail truncation undetectable
locally; compromised host can forge its own journal.

Connected additions [design]: central storage provides an external witness —
batch ingestion timestamps + stored chain heads bound tail-truncation and
backdating windows. The backend must treat SDK-supplied data as hostile:
recompute every hash, verify every signature against the registered key,
enforce size/count limits, and never execute or render unsanitized content.
Contract sync is a declaration channel, so its main risks are namespace
squatting within a tenant (mitigated: tenant-scoped), policy-evasion via
quiet contract weakening (mitigated: security-sensitive deltas are flagged,
§6), and idempotency-key spoofing (mitigated: fingerprint binding, §16).

## 19. Backward-compatibility constraints

- No change to `@igris.guard` semantics, the event schema, or the journal
  format is required for Connected slice 1. Compatibility requirements on the
  SDK (owned by the hardening branch, not edited here): none blocking;
  see "Deferred" for nice-to-haves.
- Manual action registration routes stay functional and unchanged.
- `action_definitions` gains only additive columns (see
  `igris-connected-data-impact.md`); existing rows and PATCH behavior are
  untouched.
- Route manifest and route-surface guard tests must be updated intentionally
  when Connected routes are registered — never bypassed.
- The legacy `igris-inertial` PyPI client is not modified; the `igris`
  top-level import collision is a **release dependency** tracked in §20.

## 20. Deferred decisions

1. PyPI namespace: `igris` (new SDK) vs `igris-inertial` (legacy client) both
   import as `igris` — cannot coexist in one environment. Needs a product
   decision before PyPI release (rename legacy import, deprecate, or gate).
2. SDK key registration UX (explicit `igris connect` device flow vs API-key
   env var) and key rotation semantics.
3. Whether `connected` provenance is stored as a distinct value or as
   `embedded` + `verified_at` (this ADR specifies a distinct value; the data
   doc records the alternative).
4. Team approval mapping (local `ApprovalProvider` → durable backend
   approvals) — explicitly out of slice 1.
5. Managed adapter: how `execution_mode: managed` contracts compile into
   `TaskCoordinator.Submit` requests without SDK↔DB model coupling.
6. Multi-key / multi-machine journals per tenant (fan-in ordering is per-key,
   not global).
