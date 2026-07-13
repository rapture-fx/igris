# Final Security Delta Review — Private-Alpha Integration

**Status:** **FINAL READ-ONLY DELTA REVIEW**  
**Date:** 2026-07-12  
**Reviewer role:** Principal application-security / Python SDK / Go API / PostgreSQL / cryptographic-protocol / multi-tenant SaaS / release-security  

| Field | Value |
| --- | --- |
| **Previously reviewed evidence base** | `b30767da1f96569b25a479414c1d5ed6ef10320e` |
| **Integration tip under review** | `c71bd8e609bbb2568ebf8280e48e0d6eae9b5d96` |
| **Exact delta** | `b30767da1..c71bd8e60` |
| **Agent G branch** | `feature/igris-private-alpha-integration` (read-only) |
| **This review branch** | `feature/igris-connected-evidence-security-gate` |
| **Prior gates** | Contract sync CONDITIONAL GO; evidence ingestion CONDITIONAL GO at `b30767da1` |

## Recommendation

### **CONDITIONAL GO** for accepting `c71bd8e609` as the private-alpha integration tip

**No merge blockers** and **no private-alpha blockers** remain from the previously open Critical residuals (contract redirect credential-forwarding; concurrent contract idempotency TOCTOU; direct-SQL mutability of accepted Connected records). Those three were remediated in this delta with disposable-Postgres and live redirect exploit proofs.

**Conditions:**

1. Accept §6 alpha residuals (ordinary-argument evidence exposure; process-local rate limits; coarse keys; no rotation/quotas).  
2. Migration 067→068→069 remain **manual runbook only** — never auto-applied by merge.  
3. Treat historical full-repo migration bootstrap failure as a **production deployment prerequisite**, not an alpha dogfood blocker when disposable/Overture Connected paths are used as tested.  
4. Mark `docs/alpha/private-alpha-defects.md` PA-001 (and PA-002 as applicable) **resolved at `c71bd8e60`** in a follow-up docs commit (staleness is documentation-only).  

**Not a public production GO.** Production-enablement blockers remain in §5.

**Agent G may keep `c71bd8e60` as the integration freeze for private-alpha dogfood.**

---

## 1. Scope of this delta review

Security-relevant changes in `b30767da1..c71bd8e60`:

| Area | Paths |
| --- | --- |
| Contract redirect refusal | `sdk/python/src/igris/connected.py`, `sdk/python/tests/test_connected.py`, `igris-overture/api/contract_redirect_e2e_test.go` |
| Atomic contract idempotency | `igris-overture/api/contract_store.go`, `routes_contracts.go`, postgres/unit tests |
| DB immutability | `069_connected_immutable_records.sql`, `connected_immutability_postgres_test.go` |
| Cross-slice e2e | `private_alpha_integration_e2e_test.go` |
| Release / readiness | `sdk/python/RELEASE.md`, `docs/releases/private-alpha-readiness.md` |
| Imported Agent H alpha kit | `docs/alpha/*`, `examples/private-alpha/*`, `scripts/private-alpha/*` |
| Imported Agent F security docs | `docs/security/igris-connected-*-{threat-model,release-gate}.md` |

Non-goals: re-auditing the entire evidence/contract implementations beyond delta impact; implementing fixes; applying migrations to shared systems.

---

## 2. Critical remediations verified

### 2.1 Contract-sync redirects (closes CS-R4 for contract client)

**Implementation:** `HttpContractSyncClient` uses `build_opener(_NoRedirectHandler)` (returns `None` from `redirect_request`); 3xx responses map to `ContractSyncError` with `error_code=redirect_refused`, `execution_occurred=false`, `retry_safe=false`, credential-free messages.

**Verification:**

| Proof | Result |
| --- | --- |
| Unit: 301/302/303/307/308 typed refusal | **VERIFIED** — `test_redirect_status_is_typed_and_never_followed` |
| Unit: handler creates no follow-on request | **VERIFIED** — `test_redirect_handler_creates_no_target_request_or_authorization` (http downgrade + cross-origin targets) |
| Unit: guard does not execute; journal empty | **VERIFIED** — `test_redirect_failure_prevents_execution_and_journal_write` |
| Live e2e: real servers, SDK subprocess, each status | **VERIFIED** — `TestContractSyncRedirectsAreNeverFollowedEndToEnd` PASS for 301–308; `targetCalls==0`; target Authorization empty; origin receives Bearer; no journal |

Evidence client already refused redirects at `b30767da1`; contract client now matches.

### 2.2 Atomic contract Idempotency-Key claim (closes CS-R3 for contract path)

**Implementation:** single transaction: `claimContractSyncIdempotencyRecord` (INSERT … ON CONFLICT DO NOTHING RETURNING) → `performContractSyncInTx` → `completeContractSyncIdempotencyRecord` (UPDATE response where fingerprint matches) → commit. Loser re-reads winner fingerprint; mismatch → 409 without persisting loser contract.

**Verification:**

| Proof | Result |
| --- | --- |
| Concurrent identical key | **VERIFIED** — `TestContractSyncPostgresConcurrentIdenticalIdempotencyKey`: one version, one idempotency row, one replayed |
| Concurrent same key / different fingerprint | **VERIFIED** — `TestContractSyncPostgresConcurrentConflictingIdempotencyKey`: 1×201 + 1×409; winner fingerprint retained; one version row |
| Rollback leaves no partial state | **VERIFIED** — `TestContractSyncPostgresIdempotencyRollbackLeavesNoPartialState` |
| Tenant isolation of claims | **VERIFIED** — existing tenant-scoped claim tests updated |
| Version tables still no UPDATE/DELETE | **VERIFIED** — `TestContractVersionPersistenceSourceHasNoUpdateOrDelete` (allows idempotency UPDATE only) |

**Note:** Evidence-ingest idempotency still uses the older post-response insert pattern (**PARTIALLY VERIFIED** residual for evidence path only).

### 2.3 Migration 069 immutability triggers (closes CS-R1 for Connected tables)

**DDL:** BEFORE UPDATE OR DELETE triggers on:

- `action_contract_versions`
- `sdk_signing_keys`
- `sdk_evidence_batches`
- `sdk_evidence_events`

Raise `ERRCODE 55000` with message `immutable Connected record`. Documented administrative bypass: table owner/superuser DISABLE trigger for audited restore only. Application roles must not own tables or manage triggers. **Not auto-applied.**

**Verification:** `TestConnectedImmutableRecordsPostgres` — INSERT OK; UPDATE/DELETE rejected on all four tables. Evidence open path applies 068+069 in disposable schema; contract path uses 054+067 (069 exercised via evidence helper / immutability test).

---

## 3. Required invariants (delta impact)

| Invariant | Result | Evidence |
| --- | --- | --- |
| 3xx refused before execution | **VERIFIED** | unit + live redirect e2e |
| Redirect target never receives Authorization/request | **VERIFIED** | e2e counters |
| HTTPS→HTTP / cross-origin cannot run guarded fn | **VERIFIED** | handler unit + e2e (target never hit) |
| Typed credential-free errors; `execution_occurred=false` | **VERIFIED** | unit assertions |
| Journal unchanged on redirect failure | **VERIFIED** | unit + e2e no journal |
| Contract idempotency claim+response atomic | **VERIFIED** | postgres concurrent + rollback |
| Concurrent identical → deterministic replay | **VERIFIED** | postgres |
| Concurrent conflict → one success, one 409, no loser persist | **VERIFIED** | postgres |
| Tenant isolation | **VERIFIED** | contract + evidence + private-alpha e2e |
| 067→068→069 apply in disposable schemas only | **VERIFIED** | test harness; this review used disposable DB then DROP |
| Embedded zero-network without Connected config | **VERIFIED** | `test_no_network` / guard tests (suite) |
| `@igris.guard` never uploads evidence | **VERIFIED** | private-alpha e2e zero batches before explicit sync |
| Evidence sync remains explicit | **VERIFIED** | e2e CLI steps |
| Client cannot assign Managed provenance | **VERIFIED** | CHECK + prior evidence tests still green |
| Integration E2E: contract→local exec→offline verify→evidence sync/status; no secret/key/path store | **VERIFIED** | `TestPrivateAlphaCrossSliceEndToEnd` (with explicit full `redact=[...]`) |
| Agent H alpha files not altered after import | **VERIFIED** | git history: only `A` (add) commits; no subsequent `M` on those paths |
| Agent F security docs trajectory | **VERIFIED** | Import commits only; evidence gate updated once (prospective→audit) then frozen; no post-import rewrite by unrelated commits |

---

## 4. Residual classification (required)

| Item | Classification | Notes |
| --- | --- | --- |
| Ordinary-argument evidence exposure (`redacted_input_summary` retains non-declared params) | **Accepted residual (alpha)** | Documented in readiness + RELEASE; e2e uses full-arg redaction for no-value proof; not a silent secret leak of `api_key` when using built-in redaction, but **business args may upload** unless `redact=[...]` |
| Historical migration bootstrap (`001`/`tenant_keys`, `010`/`provider_registry`) | **Production-enablement blocker** | Clean full-history migrate fails; Overture Connected disposable path (054+067+068+069) works |
| Repository-wide `go vet` defects | **Production-enablement / hygiene** | Not introduced by this delta; do not block alpha dogfood; clean before public release |
| Process-local rate limiting | **Production-enablement blocker** | Multi-instance fairness |
| Storage quotas | **Production-enablement blocker** | Evidence volume |
| Key rotation/revocation | **Deferred / production-enablement** | 069 freezes keys until product design exists |
| Coarse API-key scopes | **Accepted residual (alpha)** / prod-enablement later | Full-tenant keys |
| `.gitignore` sdist/dist patterns | **Documentation / packaging hygiene** | Root and `sdk/python` ignore `dist/`/`sdist/`; no security defect found in this delta |
| Evidence concurrent Idempotency-Key TOCTOU | **Accepted residual (alpha)** / preferred harden before multi-writer prod | Contract path fixed; evidence path not in this delta |
| Stale PA-001 “open” text in `private-alpha-defects.md` | **Documentation issue** | Defect fixed at `c71bd8e60`; tracker still describes `b30767da1` actuals |

### Merge blockers

**None.**

### Private-alpha blockers

**None** (with residual acceptance).

### Production-enablement blockers

1. Distributed rate limiting  
2. Storage quotas / retention  
3. Key rotation & revocation product path  
4. Historical migration bootstrap repair for greenfield full-chain deploys  
5. Prefer atomic evidence idempotency (parity with contract)  
6. Broader `go vet`/CI hygiene  

---

## 5. Commands and results (this review)

Read-only against `/private/tmp/igris-private-alpha-integration` @ `c71bd8e60`. Disposable Postgres created and **dropped**. No production credentials; no shared migration apply.

```text
go test ./igris-overture/internal/canonicaljson/ ./conformance/contractv1/ -count=1
→ ok / ok

cd sdk/python && uv run pytest tests/test_connected.py tests/test_evidence_sync.py \
  tests/test_cli.py tests/test_no_network.py tests/test_guard.py -q
→ 117 passed

# Disposable DB:
go test ./igris-overture/api/ -count=1 -timeout 300s -run \
  'TestContractSyncPostgres|TestConnectedImmutable|TestPrivateAlphaCrossSlice|
   TestContractSyncRedirect|TestEvidenceIngestPostgres|TestEvidenceIngestionEndToEnd|
   TestContractSyncIdempotency|TestContractVersion|TestRegisterContract|
   TestRegisterEvidence|TestContractSyncRedirects' -v
→ ALL PASS, including:
   TestContractSyncRedirectsAreNeverFollowedEndToEnd (301–308)
   TestPrivateAlphaCrossSliceEndToEnd
   TestConnectedImmutableRecordsPostgres
   TestContractSyncPostgresConcurrentIdenticalIdempotencyKey
   TestContractSyncPostgresConcurrentConflictingIdempotencyKey
   TestContractSyncPostgresIdempotencyRollbackLeavesNoPartialState
   Evidence lifecycle / concurrent / managed CHECK / e2e
→ DROP DATABASE
```

---

## 6. Accepted private-alpha residuals (explicit)

1. Non-redacted ordinary function argument values can appear in signed journals and thus in explicit evidence uploads.  
2. Process-local rate limits and shared tenant budgets.  
3. Coarse tenant API keys.  
4. No key rotation/revocation.  
5. Evidence idempotency not yet concurrent-atomic (contract is).  
6. Compromised-host Embedded honesty bound; `verified` ≠ side-effect proof.  
7. One evidence stream per `(tenant, key_id)`.  

---

## 7. Deferred controls

Automatic evidence upload; remote approval/policy; Managed execution; fine-grained scopes; public PyPI; Azure production deploy; full historical migration rewrite.

---

## 8. Hygiene

| Subject | Status |
| --- | --- |
| Agent G branch | **Untouched** (read-only review at `c71bd8e60`) |
| Production systems / credentials | **Untouched** |
| Shared migration apply | **None** |
| Legacy `igris-python-sdk` | **Untouched** |
| This branch changes | This document only (see commit) |

---

## 9. Decision summary

| Question | Answer |
| --- | --- |
| Merge/accept `c71bd8e60` for private-alpha integration line? | **CONDITIONAL GO** |
| Critical redirect exploit remaining? | **No** (proven closed) |
| Critical concurrent idempotency race remaining (contract)? | **No** (proven closed) |
| Direct-SQL mutability of accepted Connected data? | **Blocked by 069 triggers** (when applied) |
| Public production ready? | **No** — production-enablement list §4 |

---

## 10. Document control

| Field | Value |
| --- | --- |
| Evidence base | `b30767da1f96569b25a479414c1d5ed6ef10320e` |
| Reviewed tip | `c71bd8e609bbb2568ebf8280e48e0d6eae9b5d96` |
| Decision | **CONDITIONAL GO** |
| Relation to prior gates | Contract + evidence CONDITIONAL GO remain valid; this delta **closes** their top production-adjacent residuals for the private-alpha freeze |
