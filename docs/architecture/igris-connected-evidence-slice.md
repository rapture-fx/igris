# Igris Connected — Evidence Ingestion Slice (slice 2), implementation notes

Status: IMPLEMENTED on branch `feature/igris-connected-evidence-ingestion`
(base: the completed contract-sync slice). Spec: `igris-connected-api-v1.md`
§3–4 (deviations listed in its status header). Storage:
`igris-overture/database/migrations/068_sdk_evidence_ingestion.sql` —
**created, NOT applied** anywhere; the normal manual migration runbook
applies. Never auto-apply.

## What shipped

One narrow end-to-end path: a Connected developer **explicitly** uploads
locally signed Embedded evidence, and the backend verifies and stores it as
tenant-scoped, centrally verified **Embedded** evidence.

- SDK (`sdk/python`): `igris evidence sync [JOURNAL] [--public-key PATH]`
  and `igris evidence status BATCH_ID` (`igris/evidence_sync.py`), plus the
  typed `EvidenceSync*` error hierarchy (configuration, authentication,
  validation, conflict, transport, server).
- Backend: `POST /v1/evidence/batches` and `GET /v1/evidence/batches/:id`
  (`RegisterEvidenceRoutes`; BetterAuth; 20 req/min separate from contract
  sync; route manifest + route-surface inventory entries).
- Storage: `sdk_signing_keys` (public keys only), `sdk_evidence_batches`,
  `sdk_evidence_events`, `evidence_ingest_idempotency` — all tenant-leading
  keys, INSERT/SELECT only in the application layer.

## Explicit by design

Guarded execution is unchanged: `@igris.guard` performs no evidence upload,
no background thread exists, and `igris.guard` does not import the sync
module (enforced by tests). Uploading only happens when the developer runs
the command. This deliberately avoids introducing a post-execution network
exception path or silent retry semantics before remote-sync semantics are
proven. **Deferred**: automatic/background upload.

## What is uploaded / never uploaded

Uploaded: the signed decision/outcome events verbatim, the PUBLIC
verification key PEM, `key_id`, and `first_previous_event_hash` chain
metadata. Never uploaded: private keys (a private-key PEM is also refused
server-side), API credentials (Authorization header only), redaction-removed
raw values (never in the journal to begin with), environment variables,
local filesystem paths, function source, or any journal other than the
selected one. The SDK locally verifies the journal with the `igris verify`
primitives before any network activity and never rewrites a journal.

## Provenance and trust boundary

- `execution_provenance` is not a request field anywhere; the ingestion
  store fixes it to `embedded` with a single-value CHECK — a client cannot
  claim `managed`, and central verification never upgrades provenance.
  `managed` remains assignable only by the authenticated runtime-callback
  path onto `task_records` (a different table this path never touches).
- The signing key is an **SDK signing identity**: possession of the local
  key directory. It does not prove a named person, a specific device, or a
  secure hardware boundary. Registration is implicit on the first VERIFIED
  batch for (tenant, key_id); the same public key used by two tenants makes
  two independent rows and joins nothing across tenants.
  **Deferred**: key rotation and revocation.
- Verified means: exact canonical-byte hash recomputation, Ed25519
  signatures over the recomputed digests, ordered `previous_event_hash`
  linkage with null-genesis rules, schema `1`, decision/outcome transition
  semantics (denial terminal, one outcome per decision, cross-batch
  decision references resolved). Verified does NOT mean: the external side
  effect occurred, timestamps are trusted, the host was uncompromised,
  execution was contained, exactly-once, or Managed.
- Evidence upload grants no execution permission of any kind.

## Batching, idempotency, and streams

- Stream identity is `(tenant, key_id)` with contiguous chain continuation:
  a batch must extend the stored verified head (or be genesis), else
  `409 chain_head_mismatch` with `expected_head`; the SDK locates that head
  locally and uploads only the remainder (exactly one bounded resync).
  Forks are structurally refused (partial unique index on the verified
  chain slot). **Known limitation**: one journal per signing identity —
  a second journal signed by the same key (e.g. `@igris.guard(journal=...)`
  overrides) cannot sync as an independent stream and will report
  divergence; the event schema has no signed stream-id field and inventing
  an unsigned one was rejected.
- Natural idempotency: batch identity = SHA-256 over key id + the ordered
  manifest of SHA-256 hashes of the ACTUAL submitted canonical event bytes.
  Byte-identical resubmission replays the existing batch. Because identity
  commits to bytes (not claimed event hashes), a rejected tampered batch
  never blocks the honest journal.
- Explicit idempotency: `Idempotency-Key` bound to the server-computed
  fingerprint; same key + same fingerprint replays the original response
  (`Idempotency-Replayed: true`), same key + different fingerprint is
  `409 idempotency_key_conflict`; records are tenant-scoped. The SDK derives
  its key as `"sdk-" + sha256("igris-evidence-sync:v1:<key_id>:<content_hash>")[:48]`.
- None of this claims exactly-once networking; retries are safe because
  ingestion is content-keyed.

## Rejected evidence

A batch that fails server verification is stored (`202`) as
`evidence_state=rejected` with bounded metadata only: a dominant
`verification_error_code` plus `{index, code}` issues — no event rows, no
key registration, no payloads, signatures, or summaries. Rejected batches
are never promoted in place and never become Managed evidence; submit the
corrected journal instead (different byte identity ⇒ new batch).

## Proof

- `igris-overture/api/routes_evidence_test.go` — auth, strict envelope,
  prohibited fields, limits, cross-language fixture verification
  (Python-generated journal incl. unicode/special chars), tamper/transition
  rejections, source-level append-only and Managed-separation guards.
- `igris-overture/api/routes_evidence_postgres_test.go` (DSN-gated) —
  migration-applied lifecycle, continuation/gap/fork, rejected-tamper
  storage, idempotency, tenant isolation, concurrent-identical submissions,
  structural impossibility of `managed`.
- `igris-overture/api/evidence_ingestion_e2e_test.go` (DSN + uv) — real SDK
  journal → real `igris evidence sync` CLI → real BetterAuth API-key auth →
  real Postgres; repeat-sync replay, incremental continuation, up-to-date,
  local + server tamper rejection, cross-tenant isolation, journal
  byte-identity and offline verification after upload.
- `sdk/python/tests/test_evidence_sync.py` + `test_cli.py` — local-first
  validation, upload contents, typed failures, bounded resync, exit codes.

## Deferred (unchanged scope)

Automatic post-execution upload; background workers; key rotation and
revocation (and any revocation UI); remote approval; central policy
evaluation; Managed execution and runtime dispatch; checkpoints/recovery;
console surfaces (evidence search etc.); team/human identity claims;
public PyPI release; applying migration 068.
