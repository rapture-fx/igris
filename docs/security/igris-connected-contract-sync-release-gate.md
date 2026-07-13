# Release Gate — Connected ActionContract Synchronization

**Gate decision:** **CONDITIONAL GO** for merging commit `2998a12bf`  
**Reviewed commit:** `2998a12bf8165e129c122b9e619870a4c754d527` (`feature/igris-connected-contract-sync`)  
**Base commit:** `59af52ac05790bce0f9796cd6107b1a5af96ded2` (`feature/igris-progressive-contract-reconciliation`)  
**Diff under review:** `59af52ac0..2998a12bf` (32 files, +4265 / −52)  
**Review branch:** `feature/igris-connected-sync-security-gate` (documents only)  
**Review date:** 2026-07-11  
**Companion threat model:** `docs/security/igris-connected-contract-sync-threat-model.md`

---

## 1. Executive summary

Agent C’s first Connected slice implements tenant-authenticated, content-keyed, fail-closed **ActionContract synchronization and lookup** with a production Go canonicalizer pinned to Python fixtures, append-only version storage, non-executable `target_type=embedded_sdk` logical actions, and an explicit dual-env SDK opt-in (`IGRIS_API_URL` + `IGRIS_API_KEY`).

Independent read-only inspection of the exact diff, existing auth/dispatch surfaces, and focused test execution (including disposable real Postgres and Python→HTTP→Postgres e2e) found **no release-blocking multi-tenant isolation failure, authentication bypass, execution grant via sync, evidence upload path, or silent Connected→Embedded fallback**.

**CONDITIONAL GO** means: merge of `2998a12bf` is acceptable **if and only if** the conditions in §2 are met and the residual risks in §8 are explicitly accepted for this slice. There are **no Critical open defects** that require code change before merge; remaining items are production-enablement prerequisites and hardening recommendations.

This slice **does not** implement evidence ingestion, remote approval, policy, Managed execution, runtime, containment, or console product features.

---

## 2. Conditions for GO (must hold)

| # | Condition | Status |
| --- | --- | --- |
| C1 | Merge does **not** auto-apply migration `067`; production apply remains manual runbook | **Met** in shipped tree (file comment + data-impact docs) |
| C2 | Residual risks R1–R10 in threat model are **explicitly accepted** for this contract-only slice | Required of merge approver |
| C3 | No claim that Connected mode includes evidence, Managed execution, or fine-grained API-key scopes | Met in architecture docs; avoid RELEASE.md “no network” overclaim on later SDK packaging docs |
| C4 | Agent C production code paths are not rewritten by this security review; Agent D’s legacy `igris-python-sdk` repo is out of scope and untouched | Met — review edits docs only on security-gate branch |
| C5 | Pre-production enablement re-runs Postgres + e2e gates on the target environment after 067 apply | Operational — not a code blocker |

If C1–C2 are rejected → treat as **NO-GO** until resolved.

---

## 3. Required control verification matrix

Legend: **Verified** = code + test evidence this review; **Partially verified** = code present, incomplete test/coverage or residual race; **Unverified** = not exercised here; **Failed** = broken control.

| Control | Classification | Evidence |
| --- | --- | --- |
| Unauthenticated access rejected | **Verified** | `TestContractSyncUnauthenticatedRejected`, `TestContractSyncRegisteredRoutesRequireBetterAuth`; BetterAuth on group |
| Tenant only from auth context | **Verified** | `TestContractSyncTenantComesFromAuthContext`, `TestContractSyncBodyTenantFieldRejected` |
| Cross-tenant isolation (read/write) | **Verified** | Handler tenant predicates; `TestContractActionLookupTenantScopedAndNotFound`; `TestContractSyncPostgresLifecycle` cross-tenant row counts; e2e scoped inserts |
| Caller-supplied `tenant_id` rejected | **Verified** | Unexpected top-level field → 422; unit test |
| Broad tenant API-key authority / no fine 403 | **Partially verified** | BetterAuth grants any active tenant/`tenant_api_keys` key full group access; **no** contracts-specific ACL — residual R2 accepted |
| Token not in URL; not in `repr`/errors | **Verified** | Bearer header construction; `token` field `repr=False`; tests assert token absent from errors |
| HTTPS enforcement (non-loopback) | **Verified** | `load_connected_config`; `test_http_endpoint_rejected_unless_local` |
| Loopback HTTP allowlist (localhost / 127.0.0.1 / ::1) | **Verified** | Code + unit test; alternate numeric/mapped/trailing-dot forms **rejected** by hostname equality (safe default) |
| Userinfo / redirect / HTTPS→HTTP downgrade | **Partially verified** | No credential-in-URL; **no** custom redirect policy on `urlopen` (R4) |
| SSRF-like endpoint config | **Partially verified** | Operator env only; no link-local blocklist (R5) |
| Zero-network default | **Verified** | `test_no_configuration_means_disabled`, `test_unconfigured_guard_performs_no_sync_and_no_network`, suite socket guard |
| Partial Connected config fail-closed | **Verified** | `ConnectedConfigurationError` tests; empty journal |
| No silent Connected→Embedded fallback | **Verified** | Sync failure tests + e2e failing action creates no logical action |
| Timeout bound | **Verified** | `DEFAULT_TIMEOUT_SECONDS = 10`; client tests |
| Retry storms limited server-side | **Partially verified** | 60/min tenant limiter present; process-local without Redis (R6); tenant-wide shared (R7) |
| Strict JSON / unknown fields | **Verified** | Allowlists; trailing content rejected in `DecodeObjectPreserving`; validation matrix tests |
| Schema downgrade (`schema_version` ≠ `"1"`) | **Verified** | `unsupported_schema_version` |
| Body size limit 64 KiB | **Verified** | `TestContractSyncOversizedBodyRejected` |
| Param count / string length limits | **Verified** | Validation cases (128 descriptors, 512 char fields) |
| Nested depth limit | **Partially verified** | Bounded by 64 KiB body only — acceptable for slice |
| Unicode / non-HTML-escape canonicalization | **Verified** | `TestEncodeDoesNotHTMLEscape`; specialchars fixture through handler |
| Contract-hash spoofing rejected | **Verified** | `TestContractSyncHashMismatchRejectedAndNothingStored`; tampered Python fixture |
| Python/Go canonical byte equivalence | **Verified** | `internal/canonicaljson` fixture tests; `conformance/contractv1`; specialchars; e2e hashes |
| Action-name squatting (cross-tenant) | **Verified** | Per-tenant unique `(tenant_id, name)`; both tenants may own same name |
| Manual-action collision / origin_divergence | **Verified** | Unit + `TestContractSyncPostgresManualActionPreserved` |
| Risk/approval downgrade visibility | **Verified** | `security_sensitive_change` + flags on insert; **not** blocking (R8) |
| `code_fingerprint` over-versioning / flood | **Partially verified** | By design new hash ⇒ new row; rate limit soft-bounds flood (R7/A23) |
| Automatic `sdk_sync` action creation | **Verified** | `ensureContractLogicalAction`; origin `sdk_sync` |
| `embedded_sdk` non-dispatchable (gateway) | **Verified** | `TestSyncedLogicalActionTargetTypeIsNotExecutable`; shared builder used by REST + MCP |
| Sync never grants execution | **Verified** | Response `grants.execution_permission: false`; e2e target_type check |
| No Managed provenance assignment | **Verified** | Absent from handlers/store/SDK wire payload; `execution_mode` must be `embedded` |
| Migration 067 correctness (DDL) | **Verified** | Reviewed; unique index; idempotency PK; additive `origin` default `manual` |
| Migration 067 non-application | **Verified** | Header comment; docs; this review did not apply to prod |
| Version uniqueness / concurrent duplicate | **Verified** | `TestContractSyncPostgresConcurrentDuplicates` → exactly one version row |
| Immutability UPDATE/DELETE app path | **Verified** | `TestContractPersistenceSourceHasNoUpdateOrDelete`; assertAppendOnly in unit tests |
| Immutability DB privileges/triggers | **Failed as DB control** → residual **R1** | Migration has no trigger/REVOKE; rely on app role discipline |
| Tx isolation concurrent sync | **Verified** | Postgres concurrency test |
| Version ordering newest-first | **Verified** | `ORDER BY created_at DESC, id DESC`; lookup test |
| Idempotency fingerprint binding | **Verified** | Sequential replay + conflict unit/Postgres tests |
| Same-key different-request 409 | **Verified** (sequential) / **Partial** (concurrent R3) | |
| Cross-tenant key reuse of idempotency | **Verified** | PK + tenant filter; `TestContractSyncIdempotencyKeyIsTenantScoped` |
| Response replay integrity | **Partially verified** | Sequential snapshot replay OK; concurrent first-writer (R3) |
| Lookup metadata minimization | **Partially verified** | List omits module/QN/fingerprint; version GET returns full contract (intentional same-tenant) |
| Logging/error leakage of secrets | **Verified** (SDK) / **Partial** (server) | SDK scrubs; server logs tenant_id + error only on 500 paths reviewed |
| Route-manifest intentional exposure | **Verified** | Manifest + surface tests PASS |
| No evidence/args/journals/keys upload | **Verified** | Wire payload + `test_only_contract_data_is_sent` + architecture fence |
| Fail-closed pre-exec errors / journal untouched | **Verified** | Multiple SDK tests + e2e |
| tomli Python 3.10 packaging correction | **Verified** | `pyproject.toml` + release metadata tests in full suite |

---

## 4. Blocking findings

**None that block merge of `2998a12bf` as a contract-only, migration-not-auto-applied slice.**

### Near-blockers reclassified (must not be forgotten)

| ID | Issue | Why not merge-blocking | Remediation if elevated | Retest |
| --- | --- | --- | --- | --- |
| B-prod-1 | Migration 067 required before production traffic | Correctly **not applied** in branch; merge of code is dark-capable | Apply via runbook only after backup/verify free number | Postgres lifecycle + e2e on target |
| B-hard-1 | Idempotency concurrent TOCTOU (R3) | Sequential 409 proven; content uniqueness still correct; exploit needs concurrent conflicting keys | Insert idempotency row in same transaction with fingerprint conflict detection, or use advisory lock | Concurrent same-key different-hash test expecting 409 for loser |
| B-hard-2 | DB-level immutability missing (R1) | App path clean; attacker needs DB write | `REVOKE UPDATE, DELETE` on table from app role + optional deny trigger | Attempt UPDATE as app role → fail |
| B-hard-3 | urllib redirect policy (R4) | Endpoint normally https fixed host; token not in URL | Custom opener: refuse redirects or refuse scheme/host change | Redirect mock tests |

---

## 5. Non-blocking recommendations (hardening)

1. **Redis-backed rate limit** for multi-instance deployments (`NewRateLimiterWithRedis` already exists).
2. **Per-key or per-agent scopes** for contracts write (introduce real 403 state later).
3. **Redirect-safe HTTP client** (no HTTPS→HTTP; no cross-host Authorization replay).
4. **Optional blocklist** for link-local / metadata IPs in `IGRIS_API_URL` parsing.
5. **Reject userinfo** in endpoint URLs even for localhost.
6. **TTL sweep** for `contract_sync_idempotency` (noted in migration comments).
7. **Storage quotas** on versions per action to bound fingerprint flooding.
8. Align **sdk/python/RELEASE.md** “No network behavior” bullet with Connected opt-in reality when packaging Connected for broader release (stale Embedded-only wording still present on Agent C tip).
9. Future Managed/evidence slices must **not** treat `sdk_sync` / contract presence as authorization.

---

## 6. Commands and results (this review)

Working tree used for execution (read-only inspection of Agent C):

`/Users/wira/Desktop/system-worktrees/connected-contract-sync` @ `2998a12bf`

```text
# Canonicalization
go test ./igris-overture/internal/canonicaljson/ -count=1
→ ok

go test ./conformance/contractv1/ -count=1
→ ok

# API contract handlers + registration (fake DB)
go test ./igris-overture/api/ -count=1 -run 'Contract|RegisterContract'
→ ok

# Route manifest / surface
go test ./igris-overture/api/ -count=1 -run 'RouteManifest|RouteSurface'
→ ok

# Python Connected + guard + release metadata
cd sdk/python && uv run pytest tests/test_connected.py tests/test_release_metadata.py tests/test_guard.py -q
→ 65 passed

# Full Embedded+Connected SDK suite
make sdk-python-test
→ 134 passed; ruff clean; format clean

# Disposable Postgres (created, used, DROPPED — not production)
CREATE DATABASE igris_contract_sync_sec_review_<pid>;
export IGRIS_OVERTURE_POSTGRES_TEST_DSN='host=/tmp dbname=… sslmode=disable user=wira'
go test ./igris-overture/api/ -count=1 -run 'TestContractSyncPostgres|TestContractSyncEndToEnd' -v -timeout 120s
→ TestContractSyncEndToEndPythonSDK PASS
→ TestContractSyncPostgresLifecycle PASS
→ TestContractSyncPostgresConcurrentDuplicates PASS
→ TestContractSyncPostgresIdempotencyKey PASS
→ TestContractSyncPostgresManualActionPreserved PASS
DROP DATABASE …
```

---

## 7. Agent C deviations — gate stance

| Deviation | Gate stance |
| --- | --- |
| Automatic fail-closed sync under explicit env | **Accept** — security improvement over non-blocking CLI-only plan |
| Idempotency-Key in slice 1 | **Accept** with residual concurrent TOCTOU documented |
| `IGRIS_API_URL` / `IGRIS_API_KEY` naming | **Accept** |
| No fine-grained 403 | **Accept** as residual R2 for slice 1 |
| `tomli` for Python &lt; 3.11 dev | **Accept** |
| Additive `action.id` / `version.id` | **Accept** |

---

## 8. Residual risks explicitly accepted for this slice

1. Application-level append-only discipline without DB REVOKE/triggers (R1).  
2. Coarse tenant API keys; no contracts-scoped 403 (R2).  
3. Concurrent idempotency fingerprint conflict TOCTOU (R3).  
4. Default urllib redirect behavior (R4).  
5. Operator-controlled HTTPS endpoint may point at sensitive addresses (R5).  
6. Process-local rate limit without Redis (R6).  
7. Shared tenant 60/min budget (R7).  
8. Security-sensitive flags are advisory only (R8).  
9. Later operator retarget of logical actions via actions API (R9).  
10. Evidence / Managed / approval / policy deferred (R10).

**Future controls deferred** to evidence ingestion or Managed execution tracks: remote evidence authz, Managed provenance assignment rules, remote policy gating on risk flags, finer credential scopes, runtime callback provenance.

---

## 9. Scope confirmation (required statement)

Connected contract synchronization at `2998a12bf`:

- Handles **ActionContract data only**
- Implements **no** evidence upload, remote approval, policy, Managed execution, runtime execution, containment, or console functionality
- Grants **no** execution permission
- Does **not** set `execution_provenance=managed`
- Keeps Embedded local execution and local journals after successful sync

---

## 10. Unambiguous recommendation

### **CONDITIONAL GO** for merging `2998a12bf`

**Rationale:** Core multi-tenant, authentication, canonical-hash, non-execution, fail-closed, and zero-network-default properties are verified with unit, fixture, real-Postgres, and cross-language e2e evidence. No Critical defect requires a code fix before merge. Conditions C1–C2 and residual acceptance (§8) are mandatory.

**Not a blank production GO:** production Connected enablement additionally requires manual migration 067, operational key hygiene, and preferably Redis-backed rate limiting on multi-instance API tiers.

**Would become NO-GO if:** auth bypass, cross-tenant leakage, execution grant via sync, silent fallback, or auto-migration to production were demonstrated — none were.

---

## 11. Assumptions

1. BetterAuth and API-key hashing behavior outside the diff remain as inspected in `session_auth.go` / existing API-key tests.  
2. Disposable local Postgres used for tests is not a production cluster.  
3. MCP and REST action run paths both call `buildActionRunRequestFromDefinition` (verified by code inspection).  
4. Agent C’s later evidence-ingestion worktree (`feature/igris-connected-evidence-ingestion`) was out of scope for the contract-sync gate and was not modified; Agent D works only in the separate legacy `igris-python-sdk` repository (also untouched).  
5. Reviewer did not change `sdk/python`, `igris-overture` production code, migrations, testdata, conformance, or legacy SDK repos.

---

## 12. Hygiene confirmation

| Subject | Confirmation |
| --- | --- |
| Agent C contract-sync branch | Untouched (read-only review at `2998a12bf`) |
| Agent C evidence-ingestion worktree | Untouched (separate later track; not Agent D) |
| Agent D (legacy `igris-python-sdk` only) | Untouched |
| Production systems | Untouched; no prod credentials; migration not applied |
| This branch edits | Only `docs/security/igris-connected-contract-sync-threat-model.md` and `docs/security/igris-connected-contract-sync-release-gate.md` |

---

## 13. Document control

| Field | Value |
| --- | --- |
| Base commit | `59af52ac05790bce0f9796cd6107b1a5af96ded2` |
| Reviewed commit | `2998a12bf8165e129c122b9e619870a4c754d527` |
| Decision | **CONDITIONAL GO** |
| Reviewer role | Principal application-security / multi-tenant SaaS / Python SDK / Go API / PostgreSQL / crypto-protocol / distributed-systems |
