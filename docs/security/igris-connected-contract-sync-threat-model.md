# Threat Model — Connected ActionContract Synchronization

**Review type:** evidence-based application-security release review (read-only)  
**Reviewed commit (Agent C):** `2998a12bf8165e129c122b9e619870a4c754d527`  
**Base commit (progressive reconciliation):** `59af52ac05790bce0f9796cd6107b1a5af96ded2`  
**Exact diff:** `59af52ac0..2998a12bf`  
**Review branch (this document only):** `feature/igris-connected-sync-security-gate`  
**Review date:** 2026-07-11  
**Scope fence:** contract declaration sync + lookup only — **no** evidence upload, remote approval, policy, Managed execution, runtime containment, or console product surface.

This document converts the prospective Connected first-slice design into a **post-implementation threat model** grounded in the shipped code and tests. Release classification and GO/NO-GO live in
`docs/security/igris-connected-contract-sync-release-gate.md`.

---

## 1. Assets

| Asset | Why it matters | Where it lives in this slice |
| --- | --- | --- |
| Tenant identity | Multi-tenant isolation root | BetterAuth session / hashed API key → `clerk_user_id` / `TenantContext` |
| Tenant-scoped API keys (`igris_…`) | Full-tenant credential for Connected clients | `tenants.api_key_hash`, `tenant_api_keys.key_hash`; sent only as `Authorization: Bearer` |
| ActionContract v1 declarations | Intellectual property / attack surface metadata (module, qualified name, params, risk, approval) | Request body → `action_contract_versions.contract` (JSONB) |
| Server-recomputed `contract_hash` | Immutable version identity | SHA-256 over canonical UTF-8 bytes; stored as version PK component |
| Immutable version history | Audit integrity of declarations over time | `action_contract_versions` (append-only by convention) |
| Idempotency replay records | Prevent double-create ambiguity; detect key reuse with different payload | `contract_sync_idempotency` |
| Logical action rows created by sync | Name registry; must not become executable by mere registration | `action_definitions` with `origin=sdk_sync`, `target_type=embedded_sdk` |
| Local Embedded evidence (journals, keys) | Must **never** leave the process in this slice | Local SDK only; not on the wire |
| Route surface integrity | Accidental product exposure | `route_manifest` + `RegisterContractRoutes` |

**Explicit non-assets of this slice (out of scope / not handled):** journals, decision/outcome events, signing private keys, function arguments, Managed provenance, approval tickets, policy decisions, runtime callbacks.

---

## 2. Actors

| Actor | Intent | Typical capability |
| --- | --- | --- |
| Legitimate developer (Connected opt-in) | Sync declarations from Embedded SDK | Holds tenant API key; controls `IGRIS_API_URL` / `IGRIS_API_KEY` |
| Malicious tenant principal | Abuse own tenant (squatting, flood, weaken risk labels) | Any active tenant API key or session for that tenant |
| Cross-tenant attacker | Read/write another tenant’s contracts | Stolen key, body-supplied `tenant_id`, hash collision, IDOR on lookup |
| Network attacker (MITM / DNS) | Steal Bearer token, downgrade TLS, redirect | Path to client traffic if HTTPS not enforced or redirects allowed |
| Compromised/misconfigured endpoint operator | Point SDK at SSRF-like or hostile URL | Control of env vars only (not remote config channel in this slice) |
| DB superuser / compromised app role | Mutate “immutable” history | Direct SQL UPDATE/DELETE if privileges allow |
| Insider with console session | Same as tenant principal via BetterAuth cookie | Session cookie for that user/tenant |

---

## 3. Attacker capabilities assumed

1. Can call public HTTPS API with arbitrary JSON bodies and headers (including forged `Idempotency-Key`, forged `contract_hash`, extra fields).
2. May possess **one** valid tenant API key (broad tenant authority — no finer scopes in this slice).
3. Does **not** possess other tenants’ keys unless separately stolen (credential theft is a residual env/process risk).
4. Can run concurrent clients against the same key (race on idempotency / version insert).
5. Can control SDK process environment (including endpoint URL) if they already control the host — SSRF-like endpoint risk is **misconfiguration / local compromise**, not unauthenticated remote config.
6. Cannot apply production migrations from this review; migration file is committed only.

---

## 4. Trust boundaries

```
[ Developer process / Embedded SDK ]
        |  optional, explicit IGRIS_API_URL + IGRIS_API_KEY
        |  HTTPS (or loopback HTTP only)
        |  Authorization: Bearer igris_…
        |  body = ActionContract v1 + client sdk metadata ONLY
        v
[ Internet / TLS ]  ---- trust boundary T1 (transport)
        v
[ Fiber edge: BetterAuth + rate limit + handlers ]
        |  tenant_id derived ONLY from auth context
        v
[ PostgreSQL: action_definitions, action_contract_versions,
  contract_sync_idempotency ]  ---- trust boundary T2 (data plane)
        |
        +-- NO path to TaskCoordinator.Submit from sync handlers
        +-- NO evidence / approval / policy routes in RegisterContractRoutes

[ Separate: action gateway / MCP / tasks ]  ---- trust boundary T3
        |  may see action_definitions rows including target_type=embedded_sdk
        v
  buildActionRunRequestFromDefinition → default: "unsupported target type"
```

**Critical invariant across T3:** synchronization must never cross into execution. Verified at the dispatch builder (`target_type=embedded_sdk` is outside the executable vocabulary) and by `TestSyncedLogicalActionTargetTypeIsNotExecutable`.

---

## 5. Data flows (this slice)

### 5.1 Sync (write)

1. Guard (if Connected configured) or any HTTP client → `POST /v1/contracts/sync`
2. BetterAuth resolves tenant from API key hash or session (never from body)
3. Body size ≤ 64 KiB; top-level fields only `contract` | `client`
4. Strict ActionContract v1 validation; unknown fields rejected
5. Server recomputes `contract_hash` via `internal/canonicaljson` (HTML-escape off, sorted keys, raw non-ASCII)
6. Optional `Idempotency-Key` lookup bound to `(tenant, operation, action_name, key)` + fingerprint
7. Transaction: ensure logical action (INSERT … ON CONFLICT DO NOTHING) → get/insert immutable version
8. Response includes `grants.execution_permission: false`, `action.id`, `version.id` (additive)

### 5.2 Lookup (read)

- `GET /v1/contracts/actions/:name` — version **summaries** (hash, risk, approval, execution_mode, flags); tenant-scoped; absent ≡ other-tenant (404)
- `GET /v1/contracts/actions/:name/versions/:contract_hash` — full stored contract JSON for same tenant only

### 5.3 What is never sent / stored by sync

Function arguments, redacted or not; decision/outcome events; journals; Ed25519 private keys; environment dumps; evidence batches. Wire payload is built only by `contract_wire_payload()` in `sdk/python/src/igris/connected.py`.

### 5.4 Embedded default

With neither env var set: `resolve_connected_client()` returns `None`; zero network. Socket-guard tests enforce no accidental sockets.

---

## 6. Entry points

| Entry | Auth | Notes |
| --- | --- | --- |
| `POST /v1/contracts/sync` | BetterAuth (Bearer/`X-API-Key` `igris_…` or session cookie) | Primary write |
| `GET /v1/contracts/actions/:name` | Same | List summaries |
| `GET /v1/contracts/actions/:name/versions/:hash` | Same | Full contract |
| SDK `load_connected_config` / `HttpContractSyncClient` | Env-based | Client-side gate before network |
| `@igris.guard` Connected path | Env or injected `sync_client` | Pre-approval, pre-execution |
| Migration `067_action_contract_versions.sql` | DBA runbook | **Not applied** by this change |

Route manifest entry: `/v1/contracts/*` → `RegisterContractRoutes`, classification `core_public_product_api`, notes “declaration only, grants no execution permission”.

---

## 7. Security invariants (required)

| ID | Invariant | Status after review |
| --- | --- | --- |
| I1 | Tenant derived only from authenticated context | **Holds** — body `tenant_id` rejected; all SQL predicates use auth tenant |
| I2 | Server recomputes `contract_hash` from canonical UTF-8 bytes; client hash never trusted for storage identity | **Holds** |
| I3 | Same contract content → one immutable version per `(tenant, action_name, hash)` | **Holds** (unique index + ON CONFLICT) |
| I4 | Same Idempotency-Key + different fingerprint → `409 idempotency_key_conflict` (sequential) | **Holds** sequentially; **partial** under concurrency (see residual R3) |
| I5 | Sync failure occurs before execution; `execution_occurred=false`; journal untouched | **Holds** (SDK tests + e2e) |
| I6 | No configuration → zero network calls | **Holds** |
| I7 | Connected execution remains local Embedded; sync is not dispatch | **Holds** |
| I8 | No client path in this slice assigns `execution_provenance=managed` | **Holds** (field absent from slice) |
| I9 | Only authenticated runtime callbacks (other product paths) can establish Managed provenance — not contract sync | **Holds** by scope fence |
| I10 | `target_type=embedded_sdk` is non-dispatchable on gateway/MCP builder path | **Holds** for `buildActionRunRequestFromDefinition` (shared by REST + MCP) |
| I11 | Synchronization never sets `execution_permission` true | **Holds** (hardcoded false) |
| I12 | Migration 067 is committed and not auto-applied | **Holds** |

---

## 8. Abuse cases, severity, likelihood, controls

Severity scale: **Critical / High / Medium / Low / Info**. Likelihood: **High / Medium / Low** given current controls.

| ID | Abuse case | Sev | Lik | Controls | Residual |
| --- | --- | --- | --- | --- | --- |
| A1 | Auth bypass of sync/lookup | Crit | Low | BetterAuth on group; unauth tests | — |
| A2 | Body-supplied tenant / tenant confusion | Crit | Low | Unexpected field rejection; auth tenant only | — |
| A3 | Cross-tenant read/write | Crit | Low | All queries `tenant_id=$1`; 404 equivalence; Postgres cross-tenant test | — |
| A4 | Caller spoofs `contract_hash` | High | Low | Server recompute + mismatch 422 before DB | — |
| A5 | Unknown-field / schema smuggling into stored evidence | High | Low | Allowlists on request, contract, descriptors; schema_version must be `"1"` | Nested depth not capped beyond 64 KiB |
| A6 | Risk/approval downgrade silent | Med | Med | `security_sensitive_change` + policy_flags on delta | Flags are informational only (no enforcement in this slice) |
| A7 | Action-name squatting within tenant | Med | Med | First writer wins for new names; shared keys are full-tenant | No per-agent scope |
| A8 | Manual action collision → hijack execution config | High | Low | Manual row preserved; `origin_divergence`; target_url untouched (Postgres test) | Operator could later change target via actions API |
| A9 | Auto `sdk_sync` action becomes executable | Crit | Low | `embedded_sdk` + builder default reject; e2e asserts target_type | App-level only; DB does not forbid UPDATE of target_type |
| A10 | Sync grants Managed provenance or remote execution | Crit | Low | No such fields/routes in slice; execution_mode must be `embedded` | Future Managed slices must not weaken this |
| A11 | Upload arguments/journals/keys | Crit | Low | Wire payload is contract-only; tests assert keys | Operator must not log request bodies with secrets (ops) |
| A12 | Token leakage in errors/logs/repr/URL | High | Low | Token not in URL; `repr=False`; error scrubbing; Bearer header | urllib redirect follow residual (R4) |
| A13 | HTTPS→HTTP downgrade / open redirect on client | High | Low | Config requires https except loopback hosts | Default `urlopen` follows redirects — no custom redirect policy (R4) |
| A14 | Localhost HTTP allowlist bypass (numeric/mapped/trailing-dot) | Med | Low | Strict hostname set `{localhost,127.0.0.1,::1}` rejects most alternate forms | `userinfo@localhost` still accepted (local-dev) |
| A15 | SSRF via `IGRIS_API_URL` (e.g. link-local) | Med | Low | Operator-controlled env only; https allowed to any host | No blocklist of link-local/metadata IPs (R5) |
| A16 | Hidden phone-home without config | High | Low | Dual-env opt-in; socket guard; no telemetry | — |
| A17 | Partial config silent Embedded fallback | High | Low | `ConnectedConfigurationError` fail-closed | Product deviation from earlier CLI design (security-positive) |
| A18 | Timeout/retry storms | Med | Med | 10s timeout; SDK marks retry_safe; server 60/min rate limit | Process-local limiter without Redis (R6); tenant-wide shared budget (R7) |
| A19 | Idempotency key reuse different body | Med | Med | Sequential 409 | Concurrent TOCTOU possible (R3) |
| A20 | Cross-tenant idempotency key collision | High | Low | PK includes tenant_id; lookup tenant-scoped | — |
| A21 | Response replay integrity loss | Med | Low | Snapshot stored on success; sequential replay | Concurrent first-writer wins snapshot (R3) |
| A22 | Identifier/metadata disclosure | Low | High (same tenant) | Auth required; list minimizes module/QN; version GET returns full contract | Same-tenant full contract is intentional |
| A23 | Version flooding via `code_fingerprint` / formatting | Med | Med | 60/min rate; unique hash rows | Soft storage growth; fingerprint over-versions by design (ADR) |
| A24 | DB mutation of “immutable” versions | High | Low (needs DB privs) | App INSERT/SELECT only; source guard test | **No** REVOKE/trigger/RLS in migration 067 (R1) |
| A25 | Route-manifest accidental exposure of evidence routes | High | Low | RegisterContractRoutes only contracts; test forbids “evidence” path | — |
| A26 | DoS oversized body / junk JSON | Med | Med | 64 KiB; strict decode; trailing content rejected | No explicit max nesting depth |
| A27 | Broad tenant API key authority; no 403 scope state | Med | High (by design) | Active key ⇒ full tenant | No authenticated-but-unauthorized fine-grained 403 (R2) |
| A28 | Canonicalization Python≠Go (hash split-brain) | Crit | Low | Production canonicalizer + fixtures + specialchars + e2e | — |

---

## 9. Controls inventory (implementation map)

| Control | Location |
| --- | --- |
| Authn | `igris-overture/middleware/session_auth.go` (`BetterAuth`) |
| Tenant extraction | `middleware.GetClerkUserID` in handlers; never body |
| Rate limit | `middleware.NewRateLimiter(60, time.Minute)` on `/v1/contracts` group |
| Validation + hash | `igris-overture/api/routes_contracts.go` |
| Canonical JSON | `igris-overture/internal/canonicaljson` |
| Store append-only | `igris-overture/api/contract_store.go` |
| Schema | `igris-overture/database/migrations/067_action_contract_versions.sql` |
| Non-executable target | `contractLogicalActionTargetType = "embedded_sdk"` + `buildActionRunRequestFromDefinition` default |
| Route registration | `cmd/igris-overture/main.go`, `route_manifest.go` |
| SDK Connected client | `sdk/python/src/igris/connected.py` |
| Guard integration | `sdk/python/src/igris/guard.py` step 1a |
| Typed pre-exec errors | `sdk/python/src/igris/errors.py` |

---

## 10. Test evidence (executed in this review)

All commands run read-only against worktree
`/Users/wira/Desktop/system-worktrees/connected-contract-sync` at `2998a12bf`.
Disposable Postgres DB created and **dropped** after tests; **no production credentials**; **no production migration apply**.

| Suite | Command | Result |
| --- | --- | --- |
| Go canonicalizer | `go test ./igris-overture/internal/canonicaljson/ -count=1` | PASS |
| Contract-v1 conformance | `go test ./conformance/contractv1/ -count=1` | PASS |
| Contract API unit/handler | `go test ./igris-overture/api/ -count=1 -run 'Contract\|RegisterContract'` | PASS (~2–4s) |
| Route manifest/surface | `go test ./igris-overture/api/ -count=1 -run 'RouteManifest\|RouteSurface'` | PASS |
| Python focused | `uv run pytest tests/test_connected.py tests/test_release_metadata.py tests/test_guard.py -q` | **65 passed** |
| Full SDK | `make sdk-python-test` | **134 passed**, ruff clean |
| Real Postgres + e2e | `IGRIS_OVERTURE_POSTGRES_TEST_DSN=… go test … -run 'TestContractSyncPostgres\|TestContractSyncEndToEnd'` on disposable DB | **5/5 PASS** including Python→HTTP→BetterAuth→Postgres e2e |

---

## 11. Residual risks (accepted or deferred)

| ID | Residual risk | Disposition for this slice |
| --- | --- | --- |
| R1 | Immutability is application INSERT/SELECT convention + unique index; migration does not install triggers or REVOKE UPDATE/DELETE | **Accept** for slice; harden DB privileges in future migration |
| R2 | Tenant API keys are coarse; no authenticated-but-unauthorized (403) contracts scope | **Accept**; document operational key hygiene |
| R3 | Concurrent same `Idempotency-Key` + different fingerprint can race past 409 (lookup-then-insert TOCTOU); sequential path verified | **Accept** with hardening recommendation; natural content uniqueness still holds |
| R4 | SDK uses `urllib.request.urlopen` default redirect following; no explicit anti-downgrade redirect policy | **Defer** hardening before public Connected promotion |
| R5 | Any `https://` host accepted (incl. link-local); endpoint is env-configured | **Accept** as operator responsibility |
| R6 | Rate limiter defaults to process-local buckets unless Redis wired | **Accept** for single-instance; multi-instance needs Redis-backed limiter |
| R7 | One noisy client can consume the tenant-wide 60/min budget | **Accept** by design of tenant-scoped limit |
| R8 | Risk/approval flags do not block sync or execution (execution is local anyway) | **Defer** to policy/Managed slices |
| R9 | Operator/actions API can later retarget a logical action name (not done by sync) | **Accept**; out of sync slice |
| R10 | Evidence ingestion, Managed execution, remote approval deferred | **Out of scope** — see scope fence |

---

## 12. Agent C documented deviations — security assessment

| Deviation | Assessment |
| --- | --- |
| Automatic fail-closed sync under explicit Connected config (replaces CLI/non-blocking plan) | **Security-positive.** Prevents “thinks it’s Connected but runs untracked.” Zero-network Embedded preserved when unset. |
| `Idempotency-Key` + `contract_sync_idempotency` shipped in slice 1 | **Correct** for client retries; sequential conflict semantics verified; concurrent TOCTOU is residual R3. |
| Env names `IGRIS_API_URL` / `IGRIS_API_KEY` | **Consistent** with plan SDK section; Bearer-only transport (not query string). |
| No authenticated-but-unauthorized fine-grained 403 | **Accepted residual R2** for this slice; not an auth bypass. |
| Python 3.10 `tomli` dev dependency | **Packaging correctness**; not a runtime security control. |
| Additive `action.id` / `version.id` in responses | **Low risk** same-tenant identifier disclosure; useful for clients; not cross-tenant. |

---

## 13. Scope confirmation

Connected contract synchronization in commit `2998a12bf`:

- Handles **ActionContract declaration data only**
- Implements **no** evidence upload, remote approval, policy evaluation, Managed execution, runtime dispatch, containment, or console workflow
- Does **not** assign Managed provenance
- Leaves Embedded local approval + local signed journals unchanged after successful sync

---

## 14. Review hygiene

- Agent C branch `feature/igris-connected-contract-sync` was inspected read-only (no merge, rebase, cherry-pick, commit, or code edit).
- The separate worktree on `feature/igris-connected-evidence-ingestion` (Agent C’s later evidence-ingestion track — **not** Agent D) was not modified. Agent D owns only the separate legacy `igris-python-sdk` repository, which was also untouched.
- Production systems were not contacted; migration 067 was not applied to any shared database.
- This review branch may change **only** the two security documents under `docs/security/`.
