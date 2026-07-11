# Release Gate — Connected Embedded Evidence Ingestion

**Status:** **FINAL EVIDENCE-BASED REVIEW**  
**Supersedes:** prospective checklist at `d45c457ff`

| Field | Value |
| --- | --- |
| **Base commit** | `2998a12bf8165e129c122b9e619870a4c754d527` |
| **Reviewed Agent C commit** | `b30767da1f96569b25a479414c1d5ed6ef10320e` |
| **Diff** | `2998a12bf..b30767da1` |
| **Review branch** | `feature/igris-connected-evidence-security-gate` |
| **Companion threat model** | `docs/security/igris-connected-evidence-ingestion-threat-model.md` |
| **Date** | 2026-07-11 |
| **Recommendation** | **CONDITIONAL GO** |

---

## 0. Unambiguous recommendation

### **CONDITIONAL GO** for merging / integrating `b30767da1`

**Agent G may integrate** `feature/igris-connected-evidence-ingestion` @ `b30767da1` into the private-alpha integration line **provided** the conditions in §1 hold and alpha residuals in §6 are accepted.

This slice is **Embedded centrally verified evidence**, not Managed execution.  
`execution_provenance` is structurally `embedded`; Managed remains only via authenticated runtime callbacks on separate tables.

There are **no Critical merge blockers** (auth bypass, cross-tenant leakage, managed provenance smuggling, private-key acceptance, automatic guard upload, or execution grant). Remaining issues are production-enablement and hardening.

---

## 1. Conditions for CONDITIONAL GO

| # | Condition | Status |
| --- | --- | --- |
| C1 | Migration `068_sdk_evidence_ingestion.sql` remains **manual runbook only** (not auto-applied by merge) | **Met** in tree |
| C2 | Alpha residuals §6 explicitly accepted by integrators | Required of Agent G / release owner |
| C3 | No product claim that `evidence_state=verified` proves side effects, trusted time, uncompromised hosts, human identity, exactly-once, or Managed | **Met** in slice docs; keep in alpha UX copy |
| C4 | Multi-instance production API uses Redis-backed rate limiting (or accepts process-local residual) | Production-enablement |
| C5 | Contract-sync client redirect residual tracked separately (evidence client is fixed) | Noted |

If C1–C3 are rejected → treat as **NO-GO** until resolved.

---

## 2. Production file map (reviewed)

| Component | Path |
| --- | --- |
| Migration | `igris-overture/database/migrations/068_sdk_evidence_ingestion.sql` |
| Store | `igris-overture/api/evidence_store.go` |
| Verify | `igris-overture/api/evidence_verify.go` |
| Routes | `igris-overture/api/routes_evidence.go` |
| Wire-up | `cmd/igris-overture/main.go` |
| Manifest | `igris-overture/api/route_manifest.go`, `testdata/route_manifest.default.json` |
| SDK client | `sdk/python/src/igris/evidence_sync.py` |
| CLI | `sdk/python/src/igris/cli.py` |
| Errors | `sdk/python/src/igris/errors.py` |
| Slice notes | `docs/architecture/igris-connected-evidence-slice.md` |
| Unit tests | `routes_evidence_test.go` |
| Postgres tests | `routes_evidence_postgres_test.go` |
| E2E | `evidence_ingestion_e2e_test.go` |
| SDK tests | `sdk/python/tests/test_evidence_sync.py`, `test_cli.py` |

---

## 3. Control matrix (was UNVERIFIED → final)

| Control | Result | Evidence |
| --- | --- | --- |
| Authn BetterAuth | **VERIFIED** | `TestEvidenceSubmitUnauthenticatedRejected`, `TestEvidenceRegisteredRoutesRequireBetterAuth` |
| Unauthenticated 401 | **VERIFIED** | same |
| Body tenant_id / provenance rejection (envelope + events) | **VERIFIED** | `TestEvidenceSubmitBodyTenantAndProvenanceFieldsRejected` |
| Tenant SQL scoping | **VERIFIED** | `TestEvidenceTenantComesFromAuthContext`; Postgres cross-tenant |
| Public key PEM Ed25519 only | **VERIFIED** | `parseSDKPublicKey`; private PEM test |
| key_id matches fingerprint | **VERIFIED** | mismatch → 422 |
| First-use key reg + fingerprint conflict | **VERIFIED** | 409 `signing_key_conflict`; in-tx re-read |
| Cross-tenant key isolation | **VERIFIED** | Postgres lifecycle tenant-b |
| Event hash recompute | **VERIFIED** | `verifyEvidenceEvents`; fixture + tamper |
| Ed25519 over recomputed digest | **VERIFIED** | same |
| Chain genesis / continuity / gap / fork | **VERIFIED** | verify tests + Postgres lifecycle |
| Decision/outcome semantics | **VERIFIED** | denied terminal; one outcome; unknown decision |
| Actual-byte content_hash | **VERIFIED** | `evidenceContentHash` + Python mirror |
| Rejected: no events, bounded issues | **VERIFIED** | Postgres tampered |
| Body/event/depth limits | **VERIFIED** | oversized tests |
| Rate limit 20/min separate | **VERIFIED** | `RegisterEvidenceRoutes` |
| Multi-instance rate limit | **PARTIALLY VERIFIED** | process-local default (CS-R6) |
| Natural + explicit idempotency | **VERIFIED** | unit + Postgres |
| Concurrent same-key different fingerprint atomic 409 | **PARTIALLY VERIFIED** | sequential verified; concurrent TOCTOU residual CS-R3 |
| 10-way concurrent identical | **VERIFIED** | exactly 1 batch / event set / key |
| Tx atomicity | **VERIFIED** | `persistEvidenceBatch` single tx |
| App append-only | **VERIFIED** | `TestEvidencePersistenceSourceHasNoUpdateOrDelete` |
| DB REVOKE UPDATE/DELETE | **DEFERRED** | not in 068 |
| Managed CHECK rejection | **VERIFIED** | direct SQL test |
| GET cross-tenant 404 | **VERIFIED** | lifecycle + e2e |
| Malformed ID 404 | **VERIFIED** | unit test |
| No Managed store writes | **VERIFIED** | source guard |
| Guard no evidence network | **VERIFIED** | import + runtime tests |
| Local verify before upload | **VERIFIED** | SDK tests + CLI invalid journal |
| Journal immutable after sync | **VERIFIED** | unit + e2e |
| Redirects refused (evidence client) | **VERIFIED** | `_RefuseRedirects` + test |
| Redirects (contract client) | **PARTIALLY VERIFIED** | still default `urlopen` |
| HTTPS / localhost | **VERIFIED** | shared config tests |
| Timeout / bounded resync | **VERIFIED** | 10s; one resync |
| No background threads | **VERIFIED** | design + tests |
| CLI availability | **VERIFIED** | `test_evidence_help_available_in_subprocess` + entrypoint |
| Wheel/sdist artifact audit | **PARTIALLY VERIFIED** | CLI path tested; full wheel content audit not re-executed |
| Python→HTTP→BetterAuth→Postgres e2e | **VERIFIED** | `TestEvidenceIngestionEndToEndPythonSDK` PASS |
| Route manifest exposure | **VERIFIED** | manifest + surface tests PASS |
| Sync verification (no received poll) | **VERIFIED** as intentional deviation | 202 + terminal state |

---

## 4. Commands and results (this review)

```text
# Go protocol
go test ./igris-overture/internal/canonicaljson/ -count=1     → ok
go test ./conformance/contractv1/ -count=1                   → ok
go test ./igris-overture/api/ -count=1 -run 'Evidence|RegisterEvidence' → ok
go test ./igris-overture/api/ -count=1 -run 'RouteManifest|RouteSurface' → ok

# Python
cd sdk/python && uv run pytest tests/test_evidence_sync.py \
  tests/test_cli.py tests/test_no_network.py tests/test_guard.py \
  tests/test_connected.py -q
→ 109 passed

# Disposable Postgres (created + DROPPED; not production)
export IGRIS_OVERTURE_POSTGRES_TEST_DSN='host=/tmp dbname=<disposable> sslmode=disable user=wira'
go test ./igris-overture/api/ -count=1 \
  -run 'TestEvidenceIngestPostgres|TestEvidenceIngestionEndToEnd' -v -timeout 180s
→ TestEvidenceIngestionEndToEndPythonSDK PASS (~71s)
→ TestEvidenceIngestPostgresLifecycle PASS
→ TestEvidenceIngestPostgresTamperedBatchRejected PASS
→ TestEvidenceIngestPostgresIdempotencyKey PASS
→ TestEvidenceIngestPostgresConcurrentIdenticalSubmissions PASS
→ TestEvidenceIngestPostgresManagedProvenanceStructurallyImpossible PASS
```

---

## 5. Blocking findings

### Merge blockers

**None.**

### Production-enablement blockers (alpha OK; harden before broad multi-tenant prod)

| ID | Issue | Remediation | Retest |
| --- | --- | --- | --- |
| P1 | Process-local rate limit on multi-instance API | Wire `NewRateLimiterWithRedis` (or distributed limiter) for `/v1/evidence` | Burst across 2 instances → shared 20/min |
| P2 | Concurrent Idempotency-Key + different fingerprint TOCTOU | Insert fingerprint conflict inside same tx / unique constraint on conflict | Concurrent same key different body → one 409 |
| P3 | No storage quota / retention for rejected + verified volume | Quotas + TTL sweep for idempotency + rejected batch policy | Flood test bounded |
| P4 | Key rotation/revocation absent | Design + implement status/revoke (deferred product) | Revoked key rejects new batches |

### Non-blocking recommendations

1. Port `_RefuseRedirects` to contract-sync HTTP client (`connected.py`).  
2. DB `REVOKE UPDATE, DELETE` on evidence tables for app role.  
3. Fine-grained API-key scopes (contracts vs evidence).  
4. Explicit CPU budget / early exit metrics for verify path under attack.  
5. Keep alpha docs language: “locally observed, centrally verified” — never “Managed”.  
6. Optional full wheel/sdist content audit before public packaging.

---

## 6. Accepted alpha residuals

1. Embedded compromised-host honesty bound.  
2. Untrusted client timestamps.  
3. `verified` ≠ side-effect / exactly-once / containment / named human.  
4. One evidence stream per `(tenant, key_id)`.  
5. Coarse tenant API keys.  
6. App-level immutability (CHECK helps provenance; not full DDL immutability).  
7. Implicit first-use key registration without rotation.  
8. Tenant-shared rate budgets.  
9. Synchronous verify under request latency (acceptable for ≤500 events / 1 MiB).

---

## 7. Deferred (out of slice)

- Automatic/background evidence upload  
- Key rotation & revocation UX  
- Remote approval / central policy  
- Managed execution / runtime dispatch  
- Console search UI  
- Public PyPI release  
- Applying migration 068 outside runbook  

---

## 8. Design deviations (final stance)

| Deviation | Stance |
| --- | --- |
| Sync verify vs async received | **Acceptable** |
| Implicit first-use public key | **Acceptable** for alpha; rotation deferred |
| Actual-byte batch identity | **Acceptable (positive)** |
| One journal per key | **Acceptable residual** |
| Chain-head continuation | **Acceptable** |
| 202 verified or rejected | **Acceptable** |
| Additive response fields | **Acceptable** |
| No events on rejected | **Acceptable (positive)** |

---

## 9. Agent G integration statement

**Yes — Agent G may integrate `b30767da1`** for private-alpha Connected evidence ingestion, with:

- Manual migration 068 via runbook when enabling the feature in an environment  
- Explicit acceptance of §6 residuals  
- Clear product language that this path is **Embedded verified**, not Managed  
- No expectation of key rotation, auto-upload, or multi-instance rate fairness until P1–P4 addressed for broader production  

Agent H alpha-experience and Agent G integration branches were **not modified** by this review.

---

## 10. Hygiene confirmation

| Subject | Status |
| --- | --- |
| Agent C branch | Untouched (read-only at `b30767da1`) |
| Agents G / H | Untouched |
| Legacy `igris-python-sdk` | Untouched |
| Production systems / credentials | Untouched |
| Migrations applied outside disposable test DBs | **None** |
| This branch edits | Only the two evidence security documents |

---

## 11. Document control

| Field | Value |
| --- | --- |
| Base | `2998a12bf8165e129c122b9e619870a4c754d527` |
| Reviewed | `b30767da1f96569b25a479414c1d5ed6ef10320e` |
| Decision | **CONDITIONAL GO** |
| Integrator note | Agent G **may integrate** under §1 and §9 |
