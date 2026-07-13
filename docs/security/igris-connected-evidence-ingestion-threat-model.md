# Threat Model — Connected Embedded Evidence Ingestion

**Status:** **EVIDENCE-BASED RELEASE REVIEW (COMPLETED)**  
**Prior prospective commit:** `d45c457ff40867a62a3a19babe8dbc7b5ee1547f`  
**This review supersedes the prospective pass.**

| Field | Value |
| --- | --- |
| **Base (stable)** | `2998a12bf8165e129c122b9e619870a4c754d527` |
| **Reviewed commit (Agent C final)** | `b30767da1f96569b25a479414c1d5ed6ef10320e` |
| **Exact diff** | `2998a12bf..b30767da1` (23 files, +4370 / −9) |
| **Review branch** | `feature/igris-connected-evidence-security-gate` |
| **Review date** | 2026-07-11 |
| **Decision** | See release gate: **CONDITIONAL GO** |

**Scope:** Explicit upload of Embedded SDK journal evidence for central cryptographic verification and tenant-scoped storage. This is **Embedded centrally verified evidence**, not Managed execution.

**Ownership:** Agent C implements evidence ingestion. Agent D owns only the separate legacy `igris-python-sdk` repository (out of scope). Agents G/H integration/alpha branches were not modified.

---

## 1. Assets (confirmed)

| Asset | Location at `b30767da1` |
| --- | --- |
| Tenant identity | BetterAuth → `GetClerkUserID`; never body |
| Tenant API keys | Bearer/`X-API-Key`; hashed lookup |
| SDK private key | `IGRIS_HOME/signing_key.pem` only — never on wire |
| SDK public key + fingerprint | `sdk_signing_keys` (PEM + `fingerprint_sha256`) |
| Journal events | Client local; server `sdk_evidence_events` (verified only) |
| Batch identity `content_hash` | SHA-256 of actual submitted canonical event bytes + key_id |
| Chain head per `(tenant, key_id)` | Verified batches + partial unique chain-slot index |
| `execution_provenance` | CHECK `= 'embedded'` on batches and events |
| `evidence_state` | `verified` \| `rejected` (sync path; no persistent `received` polling) |
| Managed task stores | **Not written** by this path |

---

## 2. Trust boundaries (implemented)

```
[ IGRIS_HOME private key + journal ]
        |  igris evidence sync ONLY (explicit CLI)
        |  local verify_journal BEFORE network
        |  public PEM + events only; redirects refused
        v
[ HTTPS + Bearer ] ---- T1
        v
[ BetterAuth + 20/min rate limit + RegisterEvidenceRoutes ]
        |  tenant from auth; key_id bound to server-derived fingerprint
        |  recompute hashes; Ed25519; chain; transitions
        |  stamp embedded; state verified|rejected synchronously
        v
[ sdk_signing_keys | sdk_evidence_batches | sdk_evidence_events
  | evidence_ingest_idempotency ] ---- T2
        |
        +-- NO task_records / Managed receipts / TaskCoordinator

[ Runtime callback path ] ---- T3 (unchanged; sole managed provenance)
```

---

## 3. Entry points (verified registered)

| Entry | File | Auth / limit |
| --- | --- | --- |
| `POST /v1/evidence/batches` | `routes_evidence.go` | BetterAuth; 20/min |
| `GET /v1/evidence/batches/:id` | `routes_evidence.go` | BetterAuth; 20/min |
| Implicit first-use public key registration | on **verified** batch only | Tenant-scoped PK |
| `igris evidence sync` / `status` | `evidence_sync.py`, `cli.py` | Explicit only |
| `@igris.guard` | **no import** of evidence_sync | Zero evidence network |

Wiring: `cmd/igris-overture/main.go` `RegisterEvidenceRoutes`; manifest `/v1/evidence/*`.

---

## 4. Required invariants — final classification

| ID | Invariant | Classification | Evidence |
| --- | --- | --- | --- |
| I1 | Explicit upload only; guard does not import/call evidence sync | **VERIFIED** | `test_guard_module_does_not_reference_evidence_sync`; source audit `guard.py` |
| I2 | Embedded zero-network by default | **VERIFIED** | `test_no_network.py`; guard construction no evidence client |
| I3 | Local journal verification before network | **VERIFIED** | `TestLocalValidationBeforeNetwork`; `sync_journal` order |
| I4 | Journals never rewritten | **VERIFIED** | `test_journal_is_never_modified_by_sync`; e2e byte-identity |
| I5 | Private key never leaves IGRIS_HOME | **VERIFIED** | Client reads only `verify_key.pem`; private PEM refused server-side |
| I6 | Only public keys accepted/stored | **VERIFIED** | `parseSDKPublicKey` PUBLIC KEY PEM only; lifecycle asserts no PRIVATE |
| I7 | Private-key PEM rejected | **VERIFIED** | `TestEvidenceSubmitValidationRejections/private key PEM is refused` |
| I8 | `key_id` server-derived/verified | **VERIFIED** | `derivedKeyID != submission.KeyID` → 422 |
| I9 | Tenant only from auth | **VERIFIED** | `TestEvidenceTenantComesFromAuthContext`; body tenant rejected |
| I10 | Body `tenant_id` / `execution_provenance` rejected (top + events) | **VERIFIED** | `TestEvidenceSubmitBodyTenantAndProvenanceFieldsRejected` |
| I11 | Structural `execution_provenance=embedded` | **VERIFIED** | CHECK constraints; app never binds provenance; Postgres managed-impossible test |
| I12 | No `task_records` / Managed store writes | **VERIFIED** | `TestEvidenceSourceNeverTouchesManagedReceiptStorage` |
| I13 | Managed provenance only via runtime callbacks | **VERIFIED** (by isolation + pre-existing runtime path) | Separate tables; CHECK forbids managed |
| I14 | Verification changes evidence_state only | **VERIFIED** | Sync path sets verified/rejected; provenance constant |
| I15 | No overclaim of timestamps/hosts/exactly-once/side effects | **VERIFIED** (docs + comments + API dual fields) | Slice doc + verifier package comment |
| I16 | Upload grants no execution | **VERIFIED** | No dispatch; route notes; response has no grant |
| I17 | Migration 068 not auto-applied | **VERIFIED** | Header NOTE; disposable-schema tests only |

---

## 5. Cryptographic & chain controls

| Control | Classification | Paths / tests |
| --- | --- | --- |
| Python↔Go canonical bytes | **VERIFIED** | `internal/canonicaljson`; `conformance/contractv1`; fixture journal verifies |
| SHA-256 event-hash recompute | **VERIFIED** | `evidence_verify.go`; tamper tests |
| Ed25519 over **recomputed** digest | **VERIFIED** | `ed25519.Verify(pub, digest[:], rawSig)` |
| Null genesis + ordered linkage | **VERIFIED** | verify + lifecycle continuation |
| Cross-batch decision references | **VERIFIED** | `getStoredDecision` + outcome rules |
| Gap / fork rejection | **VERIFIED** | Postgres lifecycle gap 409; chain-slot unique index; fork path |
| Decision-before-outcome / denied terminal / one outcome | **VERIFIED** | `TestEvidenceVerifyTamperAndTransitionRejections` |
| Duplicate consistency | **VERIFIED** | Event PK ON CONFLICT DO NOTHING; natural content hash |
| Actual-submitted-byte batch identity | **VERIFIED** | `evidenceContentHash`; mirrors Python `batch_content_hash` |
| Unicode / specialchars | **VERIFIED** | Fixture journal through verify + e2e |
| Rejected batch: no events, no key reg, bounded issues | **VERIFIED** | Postgres tampered test; max 20 issues `{index,code}` |

---

## 6. AuthZ, keys, limits, DoS

| Control | Classification | Evidence |
| --- | --- | --- |
| Cross-tenant GET 404 | **VERIFIED** | Postgres lifecycle + e2e |
| Cross-tenant key isolation (same pubkey → independent rows) | **VERIFIED** | Lifecycle tenant-b independent batch |
| Same key_id different fingerprint → 409 | **VERIFIED** | Handler conflict; in-tx re-read race |
| Malformed / oversized PEM | **VERIFIED** | 4096 cap; parse failures |
| Body 1 MiB / 500 events / 64 KiB event / depth 64 | **VERIFIED** | `TestEvidenceSubmitOversizedInputsRejected` |
| Separate evidence rate limit 20/min | **VERIFIED** (wired) | `NewRateLimiter(20, time.Minute)` on `/v1/evidence` |
| Process-local multi-instance rate limit | **PARTIALLY VERIFIED** | Same middleware class as contract-sync (CS-R6) |
| Invalid-signature CPU work | **PARTIALLY VERIFIED** | Bounded by rate limit + event cap + early key parse; no separate async queue |
| Storage flooding / quotas | **DEFERRED** | Rate limit only; no per-tenant storage quota |
| Idempotency sequential 409 | **VERIFIED** | Postgres idempotency test |
| Idempotency concurrent TOCTOU | **PARTIALLY VERIFIED** | Same post-commit insert pattern as contract-sync (CS-R3) |
| 10-way concurrent identical submit | **VERIFIED** | `TestEvidenceIngestPostgresConcurrentIdenticalSubmissions` → 1 batch |
| Chain-head race / content replay | **VERIFIED** | Handler re-reads content on mismatch; chain-slot 23505 |
| Transaction atomicity | **VERIFIED** | Single tx for key+batch+events; rejected path batch-only |
| App UPDATE/DELETE absence | **VERIFIED** | Source guard tests |
| DB REVOKE UPDATE/DELETE | **FAILED as DB control** / **DEFERRED hardening** | CHECK yes; no REVOKE/triggers (CS-R1 class) |
| Direct-SQL managed CHECK rejection | **VERIFIED** | `TestEvidenceIngestPostgresManagedProvenanceStructurallyImpossible` |
| Malformed batch ID → 404 no DB | **VERIFIED** | `TestEvidenceBatchGetMalformedIDIndistinguishableFromAbsent` |
| Error redaction | **VERIFIED** (SDK) | Scrubbed auth errors; token not in messages |
| Evidence client no-redirect | **VERIFIED** | `_RefuseRedirects`; `test_redirect_is_refused` |
| Contract client redirect policy | **PARTIALLY VERIFIED** / inherited residual | Still default `urlopen` in `connected.py` |
| HTTPS + localhost exceptions | **VERIFIED** | Shared `load_connected_config` |
| Timeout / retry_safe / one resync | **VERIFIED** | 10s; typed errors; `test_resync_is_bounded_to_one_attempt` |
| No background threads | **VERIFIED** | Explicit CLI only; guard tests |
| Wheel/sdist CLI | **PARTIALLY VERIFIED** | CLI tests + entrypoint present; full wheel inspect not re-run this pass |
| Journal byte-identical after success/replay/fail/tamper | **VERIFIED** | Unit + e2e |

---

## 7. Agent C design deviations — classification

| Deviation | Classification | Rationale |
| --- | --- | --- |
| Synchronous verification (no durable `received` polling) | **Acceptable** | Stronger fail-closed UX; `202` still used for new batches; state is terminal verified/rejected |
| Implicit first-use public-key registration | **Acceptable (conditional ops)** | Public-only; fingerprint bind; conflict on mismatch; **rotation/revocation still deferred** |
| Actual-canonical-byte batch identity (not claimed-hash) | **Acceptable — security-positive** | Tampered rejected batch cannot block honest resubmit |
| One journal per signing identity | **Acceptable residual** | Documented limitation; fork/index enforces single stream |
| Chain-head continuation + expected_head resync | **Acceptable** | Bounded one resync client-side |
| `202` for new verified **or** rejected | **Acceptable** | Rejected is itself evidence metadata; no event store pollution |
| Response additions (`created`, `key_fingerprint_sha256`, chain fields) | **Acceptable** | Additive; same-tenant |
| No stored events for rejected batches | **Acceptable — security-positive** | Bounds storage and secret surface |

---

## 8. Inherited residuals (severity after evidence)

| Residual | Severity change | Final class |
| --- | --- | --- |
| CS-R1 DB immutability without REVOKE | Unchanged; evidence also app-append-only (+ CHECK provenance) | Deferred hardening; alpha accept |
| CS-R3 Idempotency concurrent TOCTOU | Unchanged pattern on evidence path | Production-enablement if concurrent conflicting keys expected |
| CS-R4 Redirect handling | **Improved for evidence** (`_RefuseRedirects`); **contract client still open** | Evidence: verified; contract: residual |
| CS-R2 Coarse API keys | Unchanged | Deferred / operational |
| CS-R6 Process-local rate limit | Unchanged; evidence has **separate** 20/min bucket | Prod multi-instance blocker class |
| CS-R7 Tenant-wide shared budget | Unchanged (by design) | Accept for alpha |
| Storage quotas / idempotency TTL | Volume risk higher for evidence than contracts | Deferred + monitoring |
| Key rotation/revocation | New deferred surface (implicit first-use) | Deferred |

---

## 9. Abuse-case residual risks (accepted for alpha)

1. Compromised host signs false events under registered key (Embedded honesty bound).  
2. Client timestamps untrusted (stored as reported; server `received_at`/`verified_at` for receipt time).  
3. `verified` ≠ side-effect / containment / human identity / exactly-once.  
4. One stream per `(tenant, key_id)` — multi-journal same key diverges by design.  
5. Coarse tenant API key can upload any evidence for tenant.  
6. Rejected-batch metadata retained (bounded codes only).  

---

## 10. Test execution (this review)

Read-only against Agent C worktree at `b30767da1`. Disposable Postgres created and **dropped**. No production credentials; migration 068 applied only inside test disposable schemas.

| Suite | Command | Result |
| --- | --- | --- |
| Canonicalizer | `go test ./igris-overture/internal/canonicaljson/ -count=1` | **ok** |
| Conformance | `go test ./conformance/contractv1/ -count=1` | **ok** |
| Evidence API unit | `go test ./igris-overture/api/ -count=1 -run 'Evidence\|RegisterEvidence'` | **ok** |
| Route manifest/surface | `go test ./igris-overture/api/ -count=1 -run 'RouteManifest\|RouteSurface'` | **ok** |
| Python focused | `uv run pytest tests/test_evidence_sync.py tests/test_cli.py tests/test_no_network.py tests/test_guard.py tests/test_connected.py -q` | **109 passed** |
| Disposable PG + e2e | `TestEvidenceIngestPostgres*` + `TestEvidenceIngestionEndToEndPythonSDK` | **6/6 PASS** (e2e ~71s) |

---

## 11. Review hygiene

- Agent C branch: read-only (no merge/rebase/commit/stash/reset).  
- Agents G/H worktrees, legacy SDK, production systems: **untouched**.  
- This branch changes **only** the two evidence security documents.  

---

## 12. Scope statement

Connected evidence ingestion at `b30767da1` implements **explicit, tenant-scoped, server-verified Embedded journal storage**. It does **not** implement Managed execution, remote approval, policy, runtime dispatch, containment, automatic guard upload, or private-key transmission.
