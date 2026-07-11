# Threat Model — Connected Embedded Evidence Ingestion (PROSPECTIVE)

**Status:** **PROSPECTIVE / PRE-IMPLEMENTATION GATE**  
**FINAL RELEASE REVIEW PENDING AGENT C FINAL COMMIT**

| Field | Value |
| --- | --- |
| **Base (stable)** | `feature/igris-connected-contract-sync` @ `2998a12bf8165e129c122b9e619870a4c754d527` |
| **Reviewed Agent C evidence commit** | *None yet — implementation unfinished; no final commit* |
| **Review branch** | `feature/igris-connected-evidence-security-gate` |
| **Review date** | 2026-07-11 |
| **Decision** | **Not issued** — see release gate §0 |

This document is an **implementation-independent but testable** threat model for
the second Connected slice: explicit upload of Embedded SDK journal evidence for
central storage and cryptographic verification. It is derived from:

1. Stable shipped base `2998a12bf` (contract sync + production canonicalizer + BetterAuth transport patterns).
2. Authoritative design: `docs/architecture/igris-connected-api-v1.md` §3–4, `igris-connected-data-impact.md` (evidence tables), `igris-progressive-contract-v1.md` §7–11 / §12–15.
3. Implemented Embedded protocol: `sdk/python` journal/identity/verification, `testdata/igris-contract-v1`, `conformance/contractv1`.

**It does not invent code facts about Agent C’s unfinished implementation.**  
Any observation of dirty worktrees or untracked provisional files is labeled
**provisional** and is **not** shipped behavior.

Ownership:

- **Agent C** owns `feature/igris-connected-evidence-ingestion` (in progress; paused mid-session).
- **Agent D** owns only the separate legacy `igris-python-sdk` repository (out of scope here).
- This security-gate branch changes **only** the two evidence security documents under `docs/security/`.

---

## 0. Non-goals of this review pass

- No final GO / CONDITIONAL GO / NO-GO.
- No verification of Agent C handlers, migrations, or SDK CLI beyond what is already on `2998a12bf`.
- No reading of uncommitted Agent C sources as authority (filenames may be noted as provisional only).
- No production credentials, migration apply, deploy, or implementation of fixes/tests.

---

## 1. Assets

| Asset | Sensitivity | Design location / authority |
| --- | --- | --- |
| Tenant identity | Critical | BetterAuth → auth context only (`GetClerkUserID`); never body |
| Tenant API keys (`igris_…`) | Critical | Existing BetterAuth hash lookup; Bearer transport |
| SDK Ed25519 **private** key | Critical | `IGRIS_HOME/signing_key.pem` only — must never leave host / never appear on wire |
| SDK Ed25519 **public** key + `key_id` | High | Registered centrally per `(tenant_id, key_id)`; design table `sdk_verification_keys` |
| Journal events (decision/outcome v1) | High | Local `journal.jsonl`; upload as `journal_segment.events` |
| Event hashes + signatures | High | Protocol: SHA-256(canonical unsigned) + Ed25519 over digest |
| Hash chain head per `(tenant, key_id)` | High | Server-stored continuity anchor; `first_previous_event_hash` |
| Batch records + `content_hash` | Medium–High | `sdk_evidence_batches`; idempotency fingerprint |
| Per-event stored JSON | High | `sdk_evidence_events`; may contain redacted summaries — must not contain raw secrets |
| `execution_provenance` write-once value | Critical integrity | Must be structural `embedded` on this path only |
| `evidence_state` lifecycle | High | `received` → `verified` \| `rejected` only |
| Managed task receipts / `task_records` | Critical (adjacent) | **Must not** receive SDK journal blobs |
| Route surface / rate limits | Medium | Manifest + ≤20 batches/min/tenant (design) |

---

## 2. Actors

| Actor | Goals |
| --- | --- |
| Legitimate developer | Register public key; explicitly upload verified local journals |
| Malicious tenant principal | Flood storage/CPU; confuse operators; claim stronger provenance |
| Cross-tenant attacker | Read/write other tenants’ evidence or keys |
| Compromised SDK host | Produce “valid” signatures over false events (inherent Embedded limit) |
| Network attacker | Steal API key; MITM; redirect/downgrade |
| Hostile configured endpoint | SSRF-like / credential capture if env compromised |
| DB privileged insider | Mutate “immutable” evidence rows |
| Future Managed path operator | Must not collide with Embedded evidence semantics |

---

## 3. Attacker capabilities (assumed)

1. Arbitrary HTTP JSON to public API with valid or invalid tenant credentials.
2. Possession of one tenant API key ⇒ coarse full-tenant authority (inherited from contract-sync residual R2).
3. Ability to craft events with arbitrary hashes/signatures/fields/order.
4. Ability to register or attempt to register public keys (subject to design of key registration endpoint — **UNVERIFIED** until implemented).
5. Concurrent uploads with same/different idempotency keys and content hashes.
6. Local control of SDK env (`IGRIS_API_URL`, `IGRIS_API_KEY`, `IGRIS_HOME`) if host compromised.
7. No ability to forge Ed25519 without private key — unless private key stolen (compromised-host model).

---

## 4. Trust boundaries

```
[ IGRIS_HOME: private key + journal.jsonl ]
        |  private key NEVER crosses this boundary
        |  optional: igris evidence-upload CLI (explicit; not @igris.guard)
        |  local verify_journal BEFORE upload (required control)
        v
[ HTTPS + Bearer API key ]  ---- T1 transport
        v
[ BetterAuth + rate limit + evidence routes ]
        |  tenant_id from auth only
        |  key_id → public key lookup tenant-scoped
        |  recompute hashes; verify signatures; chain rules
        |  stamp execution_provenance=embedded write-once
        |  evidence_state lifecycle only
        v
[ PostgreSQL: sdk_verification_keys, sdk_evidence_batches,
  sdk_evidence_events ]  ---- T2 data plane
        |
        +-- MUST NOT write task_records / Managed receipt stores
        +-- MUST NOT call TaskCoordinator / dispatch

[ Authenticated runtime callback path ]  ---- T3 separate
        |  only path that may establish execution_provenance=managed
        v
[ task_records / runtime receipts ]
```

---

## 5. Required product / security invariants

These are **release requirements**. Implementation status for the evidence slice is **UNVERIFIED** until Agent C’s final commit is reviewed.

| ID | Invariant |
| --- | --- |
| I1 | Evidence upload is **explicit** (CLI or explicit client call). `@igris.guard` performs **no** automatic evidence network I/O. |
| I2 | Unset Connected config preserves **zero-network** Embedded behavior (contract sync already dual-env; evidence must not phone home). |
| I3 | Local journal verification (hash + signature + chain) occurs **before** upload on the client path. |
| I4 | Private key never leaves `IGRIS_HOME`; never in request body, headers (except unrelated API key), logs, or errors. |
| I5 | Tenant identity derived **only** from authenticated server context. |
| I6 | All client-ingested evidence is structurally `execution_provenance=embedded`; **no** request field may set provenance. |
| I7 | Only authenticated runtime-callback paths can establish `managed` provenance (existing product path; unchanged by this slice). |
| I8 | Central verification updates **only** `evidence_state` (+ verification metadata), never `execution_provenance`. |
| I9 | `evidence_state=verified` proves integrity + chain continuity vs registered key — **not** truthful timestamps, uncompromised hosts, exactly-once execution, containment, human identity, or external side-effect correctness. |
| I10 | Evidence upload grants **no** execution permission. |
| I11 | Server recomputes every `event_hash` and verifies every Ed25519 signature; client-supplied integrity fields are untrusted. |
| I12 | Chain continuity: ordered events; internal links; `first_previous_event_hash` matches server chain head for `(tenant, key_id)` (or null genesis). |
| I13 | Rejected batches retain `embedded` provenance; never re-promoted in place to verified-as-managed. |
| I14 | SDK evidence tables are isolated from Managed task stores (no write path into `task_records` / execution receipts for this API). |
| I15 | Cross-tenant isolation on keys, batches, events, and GET by id (404 equivalence). |

---

## 6. Entry points (design)

| Entry | Auth | Design source | Impl status |
| --- | --- | --- | --- |
| `POST /v1/evidence/batches` | BetterAuth | API v1 §3 | **UNVERIFIED** |
| `GET /v1/evidence/batches/:id` | BetterAuth | API v1 §4 | **UNVERIFIED** |
| Signing-key registration (tenant-scoped public key) | BetterAuth | API v1 §3 prerequisite; data-impact `sdk_verification_keys` | **UNVERIFIED** (endpoint shape TBD in implementation) |
| Explicit evidence-sync / upload CLI | Local + API | Product requirement for explicit upload | **UNVERIFIED** |
| `@igris.guard` | N/A | Must **not** add evidence network | Must remain zero auto-upload (**regression gate**) |
| Contract sync paths | Existing | Must remain non-evidence | Shipped at base |

---

## 7. Data flows (design)

### 7.1 Key registration (prerequisite)

Developer publishes **public** PEM + derived `key_id` → server stores under `(tenant_id, key_id)`.  
First-use registration, rotation, and revocation semantics beyond `status` column are **design gaps** to gate carefully (see abuse A-key-*).

### 7.2 Batch upload

1. Client runs local `verify_journal` (or equivalent) → fail closed if invalid.
2. Client POSTs `key_id` + `journal_segment{first_previous_event_hash, events[]}` (+ optional Idempotency-Key).
3. Server: auth → rate limit → size/count limits → resolve key → content_hash → chain head check → durable accept (`received`) → async or sync verification → `verified` or `rejected` with issues.
4. Events stored verbatim JSONB with forced `execution_provenance=embedded`.

### 7.3 Status read

Tenant-scoped GET; returns lifecycle + always `execution_provenance: embedded`; issues vocabulary aligned with SDK verifier codes.

### 7.4 What must never flow

Private keys; unredacted secrets / raw function arguments; absolute host paths beyond what events already omit; environment dumps; Managed receipt blobs; client-claimed `managed` provenance.

---

## 8. Protocol facts (implemented today — authority for verification design)

These are **verified at base `2998a12bf`** as Embedded protocol, not as server ingestion.

| Topic | Rule | Location |
| --- | --- | --- |
| Canonical JSON | Sorted keys, compact, `ensure_ascii=false`, no HTML-escape of `<>&` | `sdk/python/src/igris/canonical.py`; Go `internal/canonicaljson` |
| Event hash | SHA-256 hex of canonical unsigned payload (exclude `event_hash`, `signature`) | `journal.py` / fixtures |
| Signature | Ed25519 over **raw digest bytes**, base64 | `identity.py` |
| `key_id` | `ed25519:` + first 16 hex of SHA-256(raw 32-byte pubkey) | `identity.py` |
| Chain | `previous_event_hash` null genesis; else prior `event_hash` | `verification.py` |
| Event types | `decision`, `outcome` only | `verification.py` |
| Schema | `schema_version == "1"` | fixtures + verifier |
| Denial semantics | Denied decision is terminal — no outcome | ADR §10; fixtures |
| Tail truncation | Not detectable from journal alone | `verification.py` docstring — central chain head mitigates for Connected |
| Fixtures | `testdata/igris-contract-v1/journal.jsonl` + `verify_key.pem` + canonical bytes | Conformance green at base |

Server ingestion **must** match these byte-level rules or verification will split-brain.

---

## 9. Abuse cases (testable)

Severity / likelihood assume design controls if correctly implemented. **All server controls UNVERIFIED** until final commit.

| ID | Abuse | Sev | Lik | Required control |
| --- | --- | --- | --- | --- |
| A1 | Forged `event_hash` | Crit | Med | Server recompute; reject → `hash_mismatch` / batch rejected |
| A2 | Invalid Ed25519 signature | Crit | Med | Verify with registered pubkey; `bad_signature` |
| A3 | Malicious public key registration (oversized PEM, non-Ed25519, path injection in PEM text) | High | Med | Strict PEM parse; 32-byte Ed25519 only; size cap; no private key material accepted |
| A4 | Cross-tenant key reuse / IDOR on `key_id` | Crit | Med | Lookup `(tenant_id, key_id)` only; never global key_id |
| A5 | Key substitution after events signed under old key | High | Med | Events bound to `key_id`; batch key must match event key_ids; rotation design deferred carefully |
| A6 | `key_id` fingerprint collision (16-hex prefix) | Med | Low | Document birthday bound; optional full fingerprint storage; collision → reject dual active keys |
| A7 | First-use key registration races | Med | Med | Unique PK `(tenant, key_id)`; no silent replace of different PEM |
| A8 | Missing rotation/revocation | Med | High (gap) | `status` column exists in design; **revocation + grace** deferred — document residual |
| A9 | Journal truncation (tail delete) | High | Med | Server chain head; client must not “verify truncated as complete history” for central truth |
| A10 | Chain gaps / reorder / middle delete | High | Med | Linkage checks + stored-hash chain follow policy like SDK |
| A11 | Chain forks (two children of same head) | High | Med | Reject or deterministic conflict; one head per `(tenant, key_id)` |
| A12 | Duplicate events same hash | Med | Med | PK `(tenant, key_id, event_hash)` store once |
| A13 | Conflicting continuation after accepted head | High | Med | `409 chain_head_mismatch` + `expected_head` |
| A14 | Wrong null genesis when head exists | High | Med | Same as A13 |
| A15 | Outcome without decision / denied then outcome | High | Med | Semantic validation in verifier path (beyond bare chain) — **must specify** |
| A16 | Malformed JSONL / non-object events | Med | Med | Reject or batch `rejected` with `malformed_json` |
| A17 | Schema downgrade / unknown schema | High | Med | `unknown_schema` |
| A18 | Unsupported event types | High | Med | Allowlist decision/outcome |
| A19 | Python/Go canonicalization mismatch | Crit | Med | Shared rules + fixture e2e |
| A20 | Unicode / HTML-escape bugs | High | Med | specialchars + journal Unicode fixtures |
| A21 | Numeric representation traps | Med | Low | UseNumber / no float re-render of hashes |
| A22 | Oversized events / >500 events / >1 MiB | Med | High | Hard limits 413/422 |
| A23 | Deep nesting / parser bombs | Med | Med | Depth limits; no unbounded recursion |
| A24 | Compression bombs if gzip added later | High | Low | Disallow or limit decompression ratio |
| A25 | Request-body logging of events | High | Med | No raw body logs; scrub API keys |
| A26 | API-key leakage | High | Med | Bearer only; errors scrubbed (carry contract-sync patterns) |
| A27 | Private-key transmission | Crit | Low | Client never reads private key for upload; server rejects PKCS8 private PEM |
| A28 | Raw arguments / unredacted secrets in events | Crit | Med | Rely on SDK redaction; server may detect obvious patterns optionally; tests on fixtures |
| A29 | Absolute path / env leakage in events | Med | Med | Field allowlists; strip unknown fields or reject |
| A30 | Client claims `execution_provenance=managed` | Crit | Med | No field; ignore/reject if present; CHECK constraint `= embedded` |
| A31 | Upload receipt-shaped blobs into Managed stores | Crit | Med | Separate tables only; no task_records writes |
| A32 | “Verified” misread as side-effect proof | High | High (UX) | API copy + operator docs; dual fields always returned |
| A33 | Untrusted client timestamps | Med | High | Store but do not trust for authz; server `received_at` authority for receipt time |
| A34 | Compromised-host false history | High | Med | **Inherent residual** of Embedded provenance — document only |
| A35 | Illegal evidence_state transitions | High | Med | Only received→verified/rejected |
| A36 | Rejected-batch retention abuse / privacy | Med | Med | Retention policy; still tenant-scoped |
| A37 | Batch flooding / storage exhaustion | High | High | 20/min rate; quotas (deferred hardening) |
| A38 | Invalid-signature CPU DoS | High | High | Rate limit; cap events; early reject unknown key; consider async verify with admission control |
| A39 | Tenant-wide rate limit exhaustion | Med | High | Inherited R7 pattern |
| A40 | Process-local rate limit multi-instance bypass | Med | Med | Inherited R6 |
| A41 | Idempotency replay / conflict | Med | Med | content_hash bind; sequential 409; concurrent TOCTOU inherited R3 |
| A42 | Concurrent duplicate upload | Med | Med | UNIQUE content_hash + event PK |
| A43 | Non-atomic batch vs events (orphan gaps) | High | Med | Single transaction for durable accept |
| A44 | Evidence row UPDATE/DELETE | High | Low (needs DB) | App append-only + DB privileges (inherited R1 class) |
| A45 | Cross-tenant GET disclosure | Crit | Med | Tenant filter; 404 |
| A46 | Identifier enumeration | Low–Med | Med | Opaque UUIDs; 404 |
| A47 | Error leakage (PEM, key material, paths) | Med | Med | Bounded error codes |
| A48 | Signing-key metadata overexposure | Med | Med | List only key_id/status/created_at — not confuse with private |
| A49 | Redirect / HTTPS downgrade on client | High | Low | Inherited R4 |
| A50 | Localhost HTTP exceptions abuse | Med | Low | Same allowlist discipline as contract sync |
| A51 | Hostile configured endpoints | Med | Low | Inherited R5 |
| A52 | Retry storms | Med | Med | Timeouts + 20/min + retry_safe guidance |
| A53 | Automatic upload from guard | Crit | Med | Explicit-only; regression tests |
| A54 | Unsafe post-execution auto-retry of side effects after evidence upload failure | High | Med | Upload failures must not imply function retry; `retry_safe` semantics for **upload** only |

---

## 10. Inherited residuals from contract-sync (prerequisites)

| ID | Residual (from contract-sync gate) | Classification for evidence slice |
| --- | --- | --- |
| CS-R3 | Concurrent Idempotency-Key TOCTOU | **Production-enablement blocker** if evidence reuses same pattern without fix; else **deferred hardening** if sequential-only accepted |
| CS-R4 | urllib redirect / no anti-downgrade policy | **Production-enablement blocker** for any new HTTPS client path that carries Bearer tokens |
| CS-R1 | App-only immutability (no DB REVOKE/triggers) | **Deferred hardening** for evidence tables (same class); elevate if multi-role DB |
| CS-R2 | Coarse tenant API keys / no fine 403 | **Deferred hardening** (document operational key hygiene) |
| CS-R6 | Process-local rate limiter | **Production-enablement blocker** for multi-instance API |
| CS-R7 / storage | No storage quotas | **Deferred hardening** — evidence volume is the growth risk |

Evidence design **must not regress** contract-sync verified properties (tenant isolation, no body tenant, zero-network default, non-execution of `embedded_sdk`).

---

## 11. Key rotation and Managed controls (deferred)

| Deferred control | Notes |
| --- | --- |
| Key rotation with overlapping validity | Not specified in API v1; do not invent; first-use + status only in design |
| Revocation propagation / grace for in-flight batches | Design `status` column only |
| Managed provenance assignment | Existing runtime callback only — out of this slice |
| Central checkpoint for tail truncation proofs beyond chain head | Partial mitigation only |
| Evidence → policy enforcement | Out of scope |
| Console UX language “locally observed” | Product follow-up |

---

## 12. Provisional observation (non-authoritative)

As of this review pass, worktree `feature/igris-connected-evidence-ingestion` was at base `2998a12bf` with **untracked** provisional paths only (names observed, contents **not** treated as shipped):

- `igris-overture/api/routes_evidence.go`
- `igris-overture/api/evidence_store.go`
- `igris-overture/api/evidence_verify.go`
- `igris-overture/database/migrations/068_sdk_evidence_ingestion.sql`

**No intermediate Agent C commits** beyond `2998a12bf` were present.  
**Provisional risk:** incomplete mid-implementation surface may lack tests, route-manifest updates, CLI explicitness, or transaction atomicity — all **UNVERIFIED**.

---

## 13. Review hygiene

- Agent C branches not modified, stashed, reset, committed, rebased, or merged into.
- Agent D / legacy `igris-python-sdk` not touched.
- `sdk/python`, igris-overture production code, migrations, testdata, conformance, architecture docs on this branch: **not modified**.
- Only security docs under `docs/security/` for evidence ingestion may change on `feature/igris-connected-evidence-security-gate`.
- Second-pass review will re-open this model against Agent C’s **final commit** and reclassify every control.

---

## 14. Status banner (required)

```
FINAL RELEASE REVIEW PENDING AGENT C FINAL COMMIT
No GO / CONDITIONAL GO / NO-GO is issued in this prospective pass.
```
