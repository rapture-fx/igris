# Igris private-alpha readiness

Status date: 2026-07-12
Release decision: **CONDITIONAL — ready for final security delta review, not public production readiness**

No package was published, no shared migration was applied, and no system was deployed during this integration.

## Product scope

Igris is a drop-in action layer for consequential AI-agent functions. The Python SDK is the adoption surface. Embedded mode performs local guarding, local approval, local execution observation, signed local evidence, and offline verification. Connected mode is optional infrastructure for explicit ActionContract and evidence aggregation while execution remains local.

This release is a feature-freeze integration of the completed Embedded, contract-sync, and evidence-ingestion slices. It does not add a new execution capability.

## Implemented Embedded capabilities

- `@igris.guard` for synchronous functions.
- Local approval with fail-closed pre-execution behavior.
- Signed decision and outcome events in a hash-chained JSONL journal.
- Offline journal verification and local Ed25519 signing identity.
- Redaction before hashing, approval presentation, and journaling.
- `ExecutionCompletedEvidenceError` with `execution_occurred=true` and `retry_safe=false` when execution completes but outcome evidence cannot be persisted.
- Zero network activity when Connected configuration is absent.

## Implemented Connected capabilities

- Explicit ActionContract v1 synchronization before local execution only when both `IGRIS_API_URL` and `IGRIS_API_KEY` are configured.
- Immutable, tenant-scoped ActionContract version storage with server-side canonical hash recomputation.
- Explicit `igris evidence sync` upload after local verification; guard execution never uploads evidence.
- `igris evidence status` for tenant-scoped batch inspection.
- Server-side evidence hash, signature, chain, provenance, and tenant verification.
- Public-key-only registration; private signing keys stay in `IGRIS_HOME`.
- Natural and explicit idempotency for contract and evidence synchronization.
- Contract-sync redirect refusal for all 3xx responses.

## Explicitly deferred capabilities

- Automatic evidence upload and durable background outbox.
- Remote approval and central policy.
- Managed execution, runtime, or coordinator expansion.
- Key rotation and revocation.
- Fine-grained API-key scopes.
- Distributed rate limiting and storage quotas.
- Billing, console redesign, Azure deployment, and public package publication.

## Migrations 067, 068, and 069 status

- 067 defines immutable ActionContract versions and contract-sync replay records.
- 068 defines Embedded SDK signing keys, evidence batches/events, and evidence replay records.
- 069 adds database triggers that reject direct SQL UPDATE and DELETE for `action_contract_versions`, `sdk_signing_keys`, `sdk_evidence_batches`, and `sdk_evidence_events`.
- 067 through 069 apply and pass lifecycle/immutability tests in disposable PostgreSQL schemas.
- No migration was applied to a shared, staging, or production database.
- A clean replay of every historical migration is not currently valid: the legacy root migration chain fails before Connected migrations because `migrations/001_production_enhancements.sql` references `tenant_keys` before `004_use_tenant_keys.sql`, and an Overture-only clean replay reaches `010_provider_key_reference.sql` before `provider_registry` exists. Repairing or replacing that historical bootstrap path is a deployment prerequisite.

Disaster-recovery mutation of protected records requires the table owner or PostgreSQL superuser to disable the named migration-069 triggers during an audited offline restore, then re-enable them before service resumes. Application roles must not own these tables or manage triggers.

## Python-version support evidence

| Python | Local full-suite result |
| --- | --- |
| 3.10.19 | 179 passed |
| 3.11.6 | 179 passed; Ruff lint/format and wheel/sdist build passed |
| 3.12.12 | 179 passed |
| 3.13.3 | 179 passed |

The release workflow must still run its remote matrix before any publication decision.

## Local and Connected failure semantics

- Embedded pre-execution validation, signing, journal, or approval failure prevents the function from running.
- A post-execution evidence persistence failure reports that execution occurred and is not retry-safe.
- Partial or invalid Connected configuration fails before approval, journal creation, or function execution.
- Contract-sync transport, authentication, validation, redirect, or server failure prevents execution; no silent Embedded fallback occurs.
- Every contract-sync 3xx returns typed `ContractSyncError` with `execution_occurred=false`, `error_code=redirect_refused`, and no credential text.
- Evidence sync is a separate CLI flow and never executes or retries a guarded function. Failure does not mutate the local journal.

## Security reviews and residual risks

Imported reviews:

- Contract synchronization threat model and release gate: source commits `e1d5c0e985d170164dc6a0991952559c21d90c88` and `478f67f3578ab83bdd3189992a9211ed69be7eaa`.
- Evidence ingestion final review: source commit `f69590c8a473e0ccd765477ac3b1951fa365d240`, CONDITIONAL GO with no merge blockers.

Closed integration risks:

- Redirect following and credential forwarding: explicit no-redirect transport plus unit and real localhost regression coverage for 301, 302, 303, 307, and 308; target receives no request or Authorization; cross-origin and HTTPS-to-HTTP target construction is refused.
- Contract idempotency TOCTOU: transactional unique-key claim, operation persistence, response completion, and losing-request re-read. Concurrent same-fingerprint calls replay one logical result; different fingerprints produce one success and one deterministic 409 without overwrite.
- Direct SQL mutation of accepted Connected records: migration-069 triggers reject UPDATE and DELETE.

Production-enablement residuals retained from the evidence review are distributed rate limiting, per-tenant storage quotas, key rotation/revocation, and coarse API-key scopes.

## Known limitations

- Evidence v1 stores `redacted_input_summary` in the signed journal. Built-in sensitive names and caller-declared `redact=[...]` parameters are removed, but ordinary argument values are retained and explicitly uploaded with evidence. The cross-slice no-value proof uses explicit all-argument redaction. An unconditional guarantee that no function argument value reaches Connected storage is therefore not available without changing the signed evidence contract.
- The historical clean-database migration bootstrap is broken before migrations 067–069, as described above.
- Repository-wide `go vet ./...` is blocked by inherited unrelated defects: a misplaced import in `igris-overture/providers/key_rotation_test.go` and unreachable code in `igris-overture/security/fleet_crypto.go`. Focused vet for API, coordinator, canonicalization, and conformance passes.
- Hatchling includes the SDK `.gitignore` as sdist build metadata. The artifact contains no tests, journals, keys, caches, databases, credentials, or environment files.
- Contract and evidence replay records do not provide exactly-once networking or execution.

## Package namespace release dependency

The new `igris` distribution and legacy `igris-inertial` distribution both expose top-level `import igris`. A coordinated namespace/migration plan is required before public PyPI publication. The separate legacy SDK repository and history were not modified or imported.

## Deployment prerequisites

- Repair and prove the clean migration bootstrap, then apply 067–069 through the normal reviewed migration runbook in a disposable staging clone before any environment promotion.
- Use HTTPS for every non-local Connected endpoint and tenant-scoped authenticated credentials.
- Keep database ownership/trigger management outside application roles.
- Establish distributed rate limiting, quotas, key lifecycle, and appropriately scoped credentials for production enablement.
- Run the full CI Python matrix, Go checks, PostgreSQL gates, route manifest/surface tests, and private-alpha evaluator against the candidate commit.
- Complete one final security delta review of changes after the imported Agent F review.

## Private-alpha entry criteria

The code is ready for final security delta review when:

- the branch is clean and preserves the completed feature history;
- SDK 3.10–3.13, Go/API/coordinator/canonicalization/conformance, PostgreSQL, route, and cross-slice tests pass;
- wheel and sdist clean-install smoke tests pass;
- no migration, publication, push, merge, or deployment has occurred; and
- alpha operators accept the documented explicit-redaction requirement and use an already-provisioned disposable/staging database until historical bootstrap repair is complete.

## Production blockers

- Public package namespace collision is unresolved.
- Ordinary non-sensitive function argument values may enter explicitly uploaded evidence unless every business parameter is declared for redaction.
- Clean historical database bootstrap is not reproducible from the committed migration ordering.
- Distributed abuse/storage controls, signing-key lifecycle, and fine-grained API-key scopes are not implemented.
- Final security delta review and deployment-specific validation have not occurred.

This branch is not approved for public production, package publication, shared migration application, or deployment.
