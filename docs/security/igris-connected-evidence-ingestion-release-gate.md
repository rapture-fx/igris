# Release Gate — Connected Embedded Evidence Ingestion (PROSPECTIVE CHECKLIST)

**Status:** **PROSPECTIVE / PRE-IMPLEMENTATION**  
**FINAL RELEASE REVIEW PENDING AGENT C FINAL COMMIT**

| Field | Value |
| --- | --- |
| **Stable base** | `2998a12bf8165e129c122b9e619870a4c754d527` (`feature/igris-connected-contract-sync`) |
| **Agent C evidence commit under review** | *Not available — implementation unfinished / session paused* |
| **Review branch** | `feature/igris-connected-evidence-security-gate` |
| **Companion threat model** | `docs/security/igris-connected-evidence-ingestion-threat-model.md` |
| **Date** | 2026-07-11 |
| **Final merge recommendation** | **WITHHELD** |

---

## 0. Decision policy for this pass

This document defines the **mandatory release checklist** and verification
matrix for Agent C’s eventual evidence-ingestion implementation. It does
**not** issue GO, CONDITIONAL GO, or NO-GO.

When Agent C reports a **final commit**:

1. Diff base `2998a12bf` → final commit (exact).
2. Re-score every row in §4 as `verified` / `partially verified` / `unverified` / `failed` with paths, tests, commands, results.
3. Re-score inherited residuals (§5).
4. Issue **unambiguous GO | CONDITIONAL GO | NO-GO** in an updated revision of this file (second review pass).

Until then, treat the banner as authoritative:

```
FINAL RELEASE REVIEW PENDING AGENT C FINAL COMMIT
```

---

## 1. Scope fence (must hold for any future GO)

In scope:

- `POST /v1/evidence/batches`
- `GET /v1/evidence/batches/:id`
- Tenant-scoped SDK verification **public** key registration
- Explicit evidence upload CLI / client (not automatic guard upload)
- Storage: `sdk_verification_keys`, `sdk_evidence_batches`, `sdk_evidence_events` (or equivalent meeting invariants)
- Server-side hash recompute, Ed25519 verify, chain continuity, evidence_state lifecycle
- `execution_provenance=embedded` structural enforcement

Out of scope / forbidden claims for this slice:

- Managed execution, runtime dispatch, containment
- Assigning or accepting `execution_provenance=managed` on client paths
- Writing SDK journals into `task_records` / Managed receipt stores
- Remote approval / policy enforcement from evidence
- Automatic `@igris.guard` evidence network calls
- Private key upload
- Proof of real-world side-effect correctness from `verified` alone

---

## 2. Ownership (corrected)

| Party | Owns | Must not |
| --- | --- | --- |
| **Agent C** | `feature/igris-connected-evidence-ingestion` implementation | Be treated as final while unfinished/dirty |
| **Agent D** | Legacy `igris-python-sdk` repository only | Be confused with evidence-ingestion worktrees |
| **This review** | Security docs on `feature/igris-connected-evidence-security-gate` only | Modify Agent C/D code, migrations, sdk/python, architecture docs |

Prior contract-sync security docs incorrectly associated Agent D with the
`feature/igris-connected-evidence-ingestion` worktree; that wording was
corrected on `feature/igris-connected-sync-security-gate`.

---

## 3. Required invariants (acceptance criteria)

| ID | Invariant | Verification approach | Status now |
| --- | --- | --- | --- |
| I1 | Explicit upload only; guard has no evidence network I/O | Guard regression + socket guard with evidence env unset/set; code path audit | **UNVERIFIED** (impl) |
| I2 | Zero-network Embedded when evidence not explicitly invoked | `test_no_network` + guard tests | Base Embedded **verified** at `2998a12bf`; evidence must not regress → **UNVERIFIED** for new code |
| I3 | Local verify before upload | CLI/unit tests fail closed on bad journal | **UNVERIFIED** |
| I4 | Private key never leaves `IGRIS_HOME` | Client source audit + negative tests; server rejects private PEM | **UNVERIFIED** |
| I5 | Tenant from auth only | Body `tenant_id` rejected; SQL tenant predicates | **UNVERIFIED** |
| I6 | Structural `execution_provenance=embedded` | No request field; DB CHECK; response always embedded | **UNVERIFIED** |
| I7 | Managed provenance only via runtime callback | No evidence path writes managed; adjacency audit | **UNVERIFIED** for new code; runtime path pre-exists |
| I8 | Verification changes evidence_state only | State machine tests | **UNVERIFIED** |
| I9 | Verified ≠ side-effect / timestamp / host honesty | Docs + API fields dual-carried; no overclaim tests/docs | Design **stated**; impl **UNVERIFIED** |
| I10 | Upload grants no execution | No dispatch/task submit from evidence routes | **UNVERIFIED** |
| I11 | Server recomputes hashes + verifies signatures | Fixture + tamper tests | **UNVERIFIED** |
| I12 | Chain head + internal linkage | Gap/fork/wrong-genesis tests | **UNVERIFIED** |
| I13 | Rejected stays embedded; no in-place re-promote to managed | State tests | **UNVERIFIED** |
| I14 | No Managed-store writes | Grep/tests for task_records from evidence store | **UNVERIFIED** |
| I15 | Cross-tenant isolation | Dual-tenant Postgres tests | **UNVERIFIED** |

---

## 4. Control matrix (implementation-dependent → UNVERIFIED)

Legend for **post-final-commit** scoring only:

- **verified** — code + passing test observed  
- **partially verified** — code present, incomplete proof  
- **unverified** — not shown  
- **failed** — broken control  

| Control | Prospective requirement | Status (this pass) |
| --- | --- | --- |
| Authn on evidence routes | BetterAuth group | **UNVERIFIED** |
| Unauthenticated → 401 | Unit/e2e | **UNVERIFIED** |
| Body tenant_id / provenance rejection | 422 + no store | **UNVERIFIED** |
| Unknown key_id → 404 for tenant | Tenant-scoped lookup | **UNVERIFIED** |
| Public key PEM validation | Ed25519 only; size/encoding caps; no private key | **UNVERIFIED** |
| Key registration tenant isolation | Cross-tenant key_id collision harmless | **UNVERIFIED** |
| First-use no silent key replace | Unique (tenant, key_id); conflict if PEM differs | **UNVERIFIED** |
| Event hash recompute | Matches Python fixtures byte-level | **UNVERIFIED** |
| Ed25519 verify | Fixture journal verifies centrally | **UNVERIFIED** |
| Bad signature / tampered hash | Batch rejected or issues; state rejected | **UNVERIFIED** |
| Chain break / reorder | Detected | **UNVERIFIED** |
| Chain fork policy | Documented + tested | **UNVERIFIED** |
| Wrong null genesis | 409 chain_head_mismatch + expected_head | **UNVERIFIED** |
| Duplicate event_hash | Stored once | **UNVERIFIED** |
| Outcome-without-decision / denied+outcome | Semantic reject or issues | **UNVERIFIED** |
| Unsupported schema/type | rejected / 422 | **UNVERIFIED** |
| Unicode / specialchars / HTML-escape | Fixture interop | **UNVERIFIED** |
| Body ≤ 1 MiB; ≤ 500 events | 413/422 | **UNVERIFIED** |
| Nesting / parser bomb resistance | Limits | **UNVERIFIED** |
| Rate limit ≤ 20 batches/min/tenant | Middleware | **UNVERIFIED** |
| Multi-instance rate limit | Redis or equivalent | **UNVERIFIED** (inherit CS-R6) |
| Idempotency content_hash | Natural + header | **UNVERIFIED** |
| Same key different payload → 409 | Sequential + concurrent | **UNVERIFIED** (inherit CS-R3) |
| Concurrent duplicate upload | One batch row | **UNVERIFIED** |
| Transaction atomicity batch+events | No orphans | **UNVERIFIED** |
| Append-only evidence rows | No UPDATE/DELETE in store | **UNVERIFIED** |
| DB privileges against UPDATE/DELETE | REVOKE/trigger | **UNVERIFIED** (inherit CS-R1) |
| GET cross-tenant 404 | Isolation | **UNVERIFIED** |
| Error / log non-leakage | No PEM/private/API key | **UNVERIFIED** |
| Route manifest registration | Evidence routes classified | **UNVERIFIED** |
| No task_records / receipt writes | Store audit | **UNVERIFIED** |
| Guard no auto evidence upload | Regression | **UNVERIFIED** |
| Explicit CLI in wheel/sdist | Packaging | **UNVERIFIED** |
| Local journal byte-identical after upload | Client does not rewrite journal | **UNVERIFIED** |
| Redirect-safe HTTPS client | Anti-downgrade | **UNVERIFIED** (inherit CS-R4) |
| CPU DoS admission control | Rate + caps + early unknown_key | **UNVERIFIED** |
| Storage quota / retention | Ops policy | **UNVERIFIED** (deferred hardening class) |
| Post-exec retry safety unchanged | `ExecutionCompletedEvidenceError.retry_safe=False` preserved | Base verified; evidence CLI must not encourage side-effect retry → **UNVERIFIED** for new UX |

### Protocol controls already verified at base (Embedded only)

| Control | Evidence at `2998a12bf` |
| --- | --- |
| Canonical JSON rules | `go test ./igris-overture/internal/canonicaljson/`; `go test ./conformance/contractv1/`; Python `tests/test_canonical.py` |
| Fixture journal verifies offline | `igris verify testdata/igris-contract-v1/journal.jsonl --public-key …` (fixture README) |
| Zero-network Embedded default | `sdk/python/tests/test_no_network.py`, socket guard |
| Contract sync non-evidence | Prior contract-sync gate |

These **do not** substitute for server ingestion verification.

---

## 5. Inherited contract-sync residuals — classification

| Residual | Merge blocker for evidence PR? | Production-enablement blocker? | Deferred hardening? |
| --- | --- | --- | --- |
| Atomic Idempotency-Key conflict (CS-R3) | No (if sequential 409 + content uniqueness proven) | **Yes** if concurrent clients are in the threat model for prod | Preferred fix |
| Anti-redirect / same-origin HTTPS policy (CS-R4) | No if CLI reuses hardened client or documents risk | **Yes** for public Connected clients carrying Bearer tokens | — |
| DB-enforced immutability (CS-R1) | No if app append-only + source guards | Recommended before multi-tenant prod scale | **Yes** acceptable short-term |
| API-key scope limits (CS-R2) | No | Operational acceptance required | **Yes** |
| Multi-instance rate limiting (CS-R6) | No for single-instance dark | **Yes** for multi-instance API | — |
| Storage quotas (volume risk) | No | Soft **Yes** for open prod tenants | **Yes** with monitoring interim |

Evidence implementation **should fix or consciously re-accept** CS-R3/R4/R6 rather than copy weak patterns blindly.

---

## 6. Mandatory release-gate tests (Agent C must supply or CI must run)

### 6.1 Cryptographic / protocol

1. Accept valid Python-generated `testdata/igris-contract-v1/journal.jsonl` with registered fixture public key → eventually `evidence_state=verified`.
2. Tampered `event_hash` → rejected / issues `hash_mismatch`.
3. Bad signature → `bad_signature`.
4. Broken chain / reorder / middle gap → `chain_break`.
5. Fork / conflicting continuation → defined safe behavior (409 or rejected).
6. Wrong null genesis when head exists → `409 chain_head_mismatch` with `expected_head`.
7. Duplicate event_hash → single stored event.
8. Unsupported schema / event type → fail closed.
9. Unicode + specialchars journal / payloads → byte-equal hash path.
10. Canonical Go path matches Python fixture digests (reuse production canonicalizer).

### 6.2 Authorization / tenancy

11. Unauthenticated → 401.  
12. Cross-tenant GET batch → 404.  
13. Cross-tenant cannot verify under other tenant’s key.  
14. Body `tenant_id` rejected.  
15. Body `execution_provenance` rejected/ignored with structural embedded.  
16. Public keys tenant-isolated.

### 6.3 Idempotency / concurrency / durability

17. Natural content_hash idempotency (byte-identical batch).  
18. Explicit Idempotency-Key replay + conflict.  
19. Concurrent duplicate upload → one batch / consistent events.  
20. Transaction: no events without batch; no batch without events if accepted.

### 6.4 Abuse / limits

21. >1 MiB body; >500 events.  
22. Unknown key early reject (cheap).  
23. Rate limit 20/min/tenant observable.  
24. Invalid signature flood does not exhaust process (bounded work).

### 6.5 Product / packaging / non-regression

25. Route manifest includes evidence routes only as intended; no accidental public debug.  
26. No writes to Managed task/receipt stores.  
27. `@igris.guard` without explicit upload: no evidence HTTP (socket guard).  
28. Explicit CLI available from wheel/sdist where packaging claims it.  
29. Local journal bytes unchanged after successful upload.  
30. Real Python SDK → HTTP → BetterAuth → disposable Postgres e2e green.  
31. Post-execution evidence error semantics unchanged (`retry_safe=False`).  
32. Migration committed **not** auto-applied; disposable-schema tests only.

---

## 7. Suggested commands for the second (final) review pass

Run only against disposable local resources; never production:

```bash
# Protocol still green at base / tip
go test ./conformance/contractv1/ -count=1
go test ./igris-overture/internal/canonicaljson/ -count=1

# Evidence package tests (names provisional — use Agent C’s actual test names)
go test ./igris-overture/api/ -count=1 -run 'Evidence|RegisterEvidence' -v

# Disposable Postgres
export IGRIS_OVERTURE_POSTGRES_TEST_DSN='host=/tmp dbname=<disposable> sslmode=disable'
go test ./igris-overture/api/ -count=1 -run 'Evidence.*Postgres|Evidence.*E2E|Evidence.*Concurrent' -v

# SDK
cd sdk/python && uv run pytest tests/ -q
# plus any tests/test_evidence*.py Agent C adds

# Offline fixture verify (control)
uv run igris verify ../../testdata/igris-contract-v1/journal.jsonl \
  --public-key ../../testdata/igris-contract-v1/verify_key.pem
```

Record exact exit codes and failing cases in the final gate update.

---

## 8. Blocking vs non-blocking (criteria for final pass)

### Will be merge blockers if failed after final commit

- Auth bypass or cross-tenant read/write  
- Client-assignable `managed` provenance or writes into Managed stores  
- Missing server hash recompute / signature verify  
- Automatic guard evidence upload / zero-network regression  
- Private key accepted or transmitted  
- Execution permission granted by evidence routes  
- Migration auto-applied to production by the change itself  

### Production-enablement blockers (may allow dark merge)

- Multi-instance rate limit absent  
- Redirect-unsafe token client  
- No storage/retention plan under real load  
- Concurrent idempotency TOCTOU unaddressed with concurrent clients  

### Deferred hardening (document residual)

- Fine-grained API key scopes  
- Key rotation/revocation completeness  
- DB REVOKE UPDATE/DELETE  
- Quotas / partitioning  
- Semantic UX that `verified` ≠ side-effect proof (must at least not contradict in API)

---

## 9. Accepted residual risks (pre-declared for Embedded model)

These remain even under a perfect implementation:

1. **Compromised host** can sign false events under a registered key (Embedded honesty limit).  
2. **Timestamps** in events are client-generated.  
3. **`verified`** proves cryptographic integrity + chain continuity only.  
4. **Tail truncation** before first upload is only partially mitigated by central heads.  
5. **Coarse tenant API keys** (until scopes exist).  

---

## 10. Deviations tracking (fill on final pass)

| Item | Plan / design | Agent C final behavior | Security stance |
| --- | --- | --- | --- |
| Async 202 vs sync verify | API v1 allows 202 then GET | *TBD* | Either OK if state machine holds |
| Key registration endpoint shape | Prerequisite, not fully specified | *TBD* | Must be tenant-scoped + public-only |
| Explicit CLI name/flags | Required explicit upload | *TBD* | Must not be implicit guard |
| Semantic decision/outcome rules beyond chain | ADR §10 | *TBD* | Prefer enforce |

---

## 11. Provisional non-authoritative notes

Agent C worktree (read-only status): branch at `2998a12bf`, **untracked** provisional files only — **not** a final commit; **not** reviewed as shipped. No intermediate commits to inspect. Do not use dirty trees as gate evidence.

---

## 12. Final recommendation placeholder

```
FINAL RELEASE REVIEW PENDING AGENT C FINAL COMMIT

GO / CONDITIONAL GO / NO-GO: NOT ISSUED
```

**Next action:** when Agent C publishes a final commit hash, re-run this gate as an evidence-based review (exact diff `2998a12bf..<final>`), update every **UNVERIFIED** row, and issue the merge recommendation with remediation/retest requirements for any blockers.

---

## 13. Hygiene confirmation (this pass)

| Subject | Status |
| --- | --- |
| Agent C code/branches | Untouched |
| Agent D / legacy SDK repo | Untouched |
| Production systems / credentials | Untouched |
| Migrations applied | None |
| This branch changes | `docs/security/igris-connected-evidence-ingestion-threat-model.md`, `docs/security/igris-connected-evidence-ingestion-release-gate.md` only |

---

## 14. Document control

| Field | Value |
| --- | --- |
| Base commit | `2998a12bf8165e129c122b9e619870a4c754d527` |
| Reviewed Agent C evidence commit | *pending* |
| Security-gate commit | *(set at docs commit time)* |
| Decision | **WITHHELD — FINAL RELEASE REVIEW PENDING AGENT C FINAL COMMIT** |
