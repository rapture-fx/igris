# Igris Product Readiness Audit — 2026-06-10

**Scope:** Go Overture API, MCP surface, Rails console, Rust runtime, database/migrations, deployment, docs alignment.
**Method:** Code-first. Route registration, handlers, middleware, migrations, workflows, and test runs were used as the source of truth. Markdown docs were treated as claims to verify, not facts. Audit only — no code, docs, or infrastructure was modified. No deploys, no cloud mutation, no secrets printed.

---

## 1. Executive Summary

The core execution-trust product is in materially better shape than the marketing-era audits suggested. The **registered-action gateway → durable task → push-dispatch to tenant runtime → signed callback → proof/receipt** path is implemented end to end, tenant-scoped at every hop I could verify locally, and covered by passing tests in `igris-overture/api`, `coordinator`, and `middleware`. The MCP surface is exactly what it claims to be: one endpoint, seven tools, strict closed schemas, tenant always from the credential. Runtime callback signing (Ed25519 + nonce + freshness + body digest, unsigned rejected by default) and Overture→runtime decision signatures (fail-closed on the runtime side) are both real.

The biggest gaps are **not** in the security core. They are:

1. **The Rails console test suite is failing on `main`** — 262 runs, **22 failures**. Most are stale copy assertions from the last UI pass, but at least one is a real regression (the console now shows "Not configured" for secrets on every action because the redaction scrubber eats `secret_refs` before the view computes its label).
2. **The public API reference documents the wrong product.** The generated API reference includes `POST /v1/mcp/stream` (dead code, never registered), and dozens of experimental, disabled-by-default endpoints (`/v1/infer`, `/v1/routing/*`, `/v1/federated/*`, `/v1/swarm/*`, …) — while the **core actions API (`/v1/actions`, `/v1/actions/:name/run`) is documented nowhere** in web-docs-hub. The hand-written MCP guide (`content/docs/mcp.mdx`) is accurate; the generated reference is not.
3. **Tenant-binding DB constraints are conditional.** Migrations 058/060 only apply `NOT NULL` on `execution_lineage.tenant_id` / `execution_context.tenant_id` if the backfill leaves zero tenant-null rows — otherwise they print a warning and leave application-level enforcement as the only guard. Whether production (Neon) actually has the constraints applied is **unverifiable from the repo** and must be checked against the live DB.
4. **Postgres-backed isolation tests skip silently without a DSN.** The tenant-scoped idempotency and API-key tenant-scoping Postgres tests (`task_idempotency_postgres_test.go`, `auth_apikey_postgres_test.go`) `t.Skip` unless `IGRIS_OVERTURE_POSTGRES_TEST_DSN` is set, so a green local/CI run does not prove the DB-level behavior unless CI provides the DSN.
5. **Cloudflare docs deploy config is a placeholder.** `web-docs-hub/wrangler.toml` exists but `name = "REPLACE_WITH_DOCS_PAGES_PROJECT_NAME"`.

Hetzner is genuinely legacy now: `deploy-vps.yml` auto-deploy was removed 2026-06-09 (manual-dispatch rollback only), and the runtime-release Hetzner mirror job is gated behind `ENABLE_HETZNER_BINARY_MIRROR=true` (default off). Runtime binaries flow from GitHub Releases with sha256 sidecars, and `install.sh` verifies checksums.

**Verdict:** API + MCP + runtime core: *Mostly Ready*. Console: *Partial* (works, but failing tests and one display regression). Docs: *Not Ready for public launch* (reference actively misleads). Database: *Mostly Ready pending one production check*. Deployment: *Mostly Ready* (manual, digest-pinned, but docs deploy config unfinished).

---

## 2. Verified Current Architecture

All verified from code, not docs:

- **Entry point** `cmd/igris-overture/main.go` (Fiber). Body limit 1 MB default, 30 s timeouts, per-IP/tenant rate limiting, sanitized error handler (no stack traces/provider names/DB errors in responses), CORS allowlist with production domains + localhost fallback.
- **Auth** (`igris-overture/middleware/session_auth.go`): `BetterAuth(db)` accepts either (a) `igris_…` API keys, hashed and resolved against `tenants.api_key_hash` then `tenant_api_keys` (named agent/app/runtime keys), or (b) Better Auth session cookies validated against the `session` table. Tenant identity always comes from the DB row, never the request. Tenants auto-provision on first authenticated request.
- **Actions gateway** (`api/routes_actions.go`): `/v1/actions` CRUD + `/run` + `/:name/run` + `/runs/:id`, all behind BetterAuth, all queries `WHERE tenant_id = $1`. `POST /v1/actions/run` only executes **registered tenant-owned definitions** (404 otherwise). Target vocabulary: `hosted_api`, `webhook`, `local_runtime`, `hybrid_fallback` (model only — resolver deliberately returns 409 `target_not_configured`), `mock_demo`. Internal-only fields (`executedTarget`, `preferredRuntimeID`) are unexported so customer JSON cannot spoof them.
- **Tasks API** (`api/routes_tasks.go`): `/v1/tasks/submit` accepts raw `task_definition` / `agent_task` / `robotics_mission` / `action_task` (exactly one) — this **is** a raw-execution surface, by design, gated by coordinator capability policy. Runtime callbacks (`/:id/checkpoint|complete|failed`) require the signed envelope below.
- **Runtime callback verification** (`api/runtime_callback_signature.go`): `X-Igris-Callback-Envelope` — version, tenant match, task match, callback-type match, body SHA-256 digest match, nonce (replayed nonces persisted + cleaned hourly), runtime identity must match the task's assigned runtime, 5-minute freshness, Ed25519 over canonical JSON against the runtime's registered public key. Unsigned callbacks are **rejected unless** `IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS=true`.
- **Coordinator** (`coordinator/task_coordinator.go`): `Submit` → tenant-scoped idempotency (`CreateTaskWithExecutionInputRefs`, duplicate → return existing task by `(tenant_id, idempotency_key)`) → `selectRuntime` (tenant-bound, healthy, active, heartbeat <90 s, routable endpoint; preferred-runtime pinning cannot cross tenants) → action policy decision persisted (deny → 403, approval → task parked) → signed permission envelope → **async HTTP POST to `{endpoint}/v1/runtime/task/submit`** with `X-Igris-Tenant`, optional `Bearer $IGRIS_RUNTIME_SECRET`, and an Ed25519 decision signature header over the body. Push-to-endpoint is confirmed; there is no pull-queue path for task dispatch (a separate command spool exists for fleet commands via `/api/v1/runtime/commands`).
- **No-runtime behavior:** gateway pre-flights `tenantHasHealthyRuntime` and returns **503 `runtime_unavailable`** before enqueueing; if dispatch later finds no runtime the task is marked failed with `no_runtime_available`.
- **Input protection** (`coordinator/input_redaction.go`, `input_ref_crypto.go`): task-definition inputs are protected before persistence (encrypted execution input refs, multi-version keyring; decrypt strictly by stored key version). Responses pass through `api/redaction.go` (`api-response-redaction-v1`): sensitive-key envelopes with digests, `ciphertext`/`nonce` dropped entirely, >512-char strings digested, URL query/userinfo stripped, header allowlist.
- **Runtime registration** (`api/routes_runtime.go`): `/api/v1/runtime/*` behind tenant API-key auth; register/heartbeat/deregister payloads additionally carry Ed25519 signatures and the runtime's public key (used later for callback verification).
- **Binary distribution** (`api/runtime_download.go`): `GET /v1/runtime/download` (BetterAuth + subscription check + 10/hr Redis rate limit + audit log), `GET /v1/runtime/checksum` (public), `GET /v1/runtime/install` (**public, unauthenticated binary download by design** — auth enforced at registration, not download). Serves from `RUNTIME_BINARIES_DIR` or 302-redirects to `RUNTIME_BINARIES_URL` (GitHub Releases).
- **Rust runtime** (`igris-runtime/crates/igris-server`): Axum server on `0.0.0.0:8080`. `/v1/runtime/task/submit|execute|task/:id/cancel` **require a valid Overture Ed25519 decision signature and fail closed** (503 if no public key configured, 401 on bad sig), before any auth flag is consulted. Submission API itself can be disabled (`IGRIS_ENABLE_RUNTIME_SUBMISSION_API=false`). Tool layer (`igris-tools`) enforces domain/command whitelists and emits digest-only output envelopes (`runtime-output-redaction-v1`). Callbacks to Overture are signed (`runtime_callback.rs`, same envelope format Overture verifies).
- **Rails console** (`web/apps/rails-console`): single-operator console. HTTP Basic front door (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, constant-time compare; **auth disabled when env unset**). Talks to Overture exclusively through `Igris::OvertureClient` using `OVERTURE_API_KEY` Bearer. Real mode vs fixtures mode is explicit (`OVERTURE_API_BASE_URL` set → real; otherwise demo data with a visible indicator). Rails persists no action/run/key state. A second client-side redaction pass (`rails-console-input-redaction-v1`) scrubs anything sensitive that might leak through.
- **Route surface governance:** `api/route_surface.go` + `route_manifest.go` classify every default-surface route; `GenerateRouteManifest` errors on any unclassified route, and `route_manifest_test.go`/`route_surface_test.go` act as the drift guard (passing).
- **Experimental gating:** 8 `IGRIS_ENABLE_EXPERIMENTAL_*_ROUTES` flags + `IGRIS_ENABLE_DEBUG_METRICS_ROUTES`, all default **off** (`RouteFlagEnabled` only accepts explicit truthy values). `/metrics` is not registered by default. `/admin/slo/*` requires `ENABLE_SLO_ENFORCER=true` **and** `IGRIS_INTERNAL_ADMIN_TOKEN` (404 if token unset, constant-time compare).
- **Production guardrails:** in `ENV=production`, multi-tenant + no `REQUIRE_AUTH_FOR_INFERENCE` is fatal; default `JWT_SECRET`/`VAULT_MASTER_KEY` are fatal unless `ALLOW_INSECURE_DEFAULTS=true`.

---

## 3. Product Readiness Scorecard

| Area | Status | Confidence | Key evidence | Main gaps | Next action |
|---|---|---|---|---|---|
| Actions API (registered-action gateway) | **Ready** | High | `routes_actions.go`, `routes_actions_test.go` (pass), tenant-scoped SQL everywhere | `hybrid_fallback` resolver unimplemented (honest 409); legacy `api` alias accepted | Document it publicly (see Docs) |
| Durable tasks / recovery / idempotency | **Mostly Ready** | High | `task_coordinator.go`, `checkpoint_store.go`, `task_idempotency_test.go`, recovery loop + replay-class blocking | Postgres-DSN tests skip locally; recovery behavior verified at unit level only | Run Postgres-backed tests in CI with DSN |
| MCP surface | **Ready** | High | `routes_mcp.go` (agent handler), `routes_mcp_test.go` (pass), strict schemas, forbidden fields | Docs reference page drift (see Docs); legacy proxy is dead code that should be deleted | Delete `RegisterMcpRoutes`/`mcpProxyHandler` |
| Proof / receipts / evidence | **Mostly Ready** | Medium-High | `routes_proof.go`, `routes_receipts.go` (tenant-scoped WHERE clauses), `routes_proof_tenant_scope_test.go` (pass) | Conditional NOT NULL on lineage/context (mig. 058/060) — prod state unverified | Verify constraints on Neon prod |
| Runtime (Rust) | **Mostly Ready** | Medium-High | Fail-closed decision sigs, signed callbacks, tool whitelists, redaction tests pass (23/23 in igris-tools) | Full `cargo test` workspace not run locally (heavy); many non-core crates (swarm/federated/multimodal) are preview-grade; CORS permissive on runtime server | Run full runtime test suite in CI |
| Runtime distribution / install | **Ready** | High | `igris-runtime-release.yml` (5 targets, GH Releases, sha256), `install.sh` checksum verify, Hetzner mirror off by default | `/v1/runtime/install` is public by design — confirm that's intended posture | None blocking |
| Rails console | **Partial** | High | Controllers/views/tests read; real/fixture split honest; key handling read-once | **22 failing tests on main**; `secrets_state` display regression; Basic auth single-user only; auth disabled when env unset | Fix regression + stale tests before launch |
| Database / tenant isolation | **Mostly Ready** | Medium | Migrations 047–060; tenant-scoped unique idempotency index (057); backfill+constrain pattern (058/060) | Conditional constraints may be unapplied in prod; two migration trees (root `migrations/` vs `igris-overture/database/migrations/`) with no single runner; no migration in repo for the `tenant_tier` enum fix applied manually on the old VPS | Prod constraint check + consolidate migration story |
| Deployment / ops | **Mostly Ready** | High | `build-container-images.yml` (GHCR auto on path change), Azure deploys manual + digest-pinned, Hetzner manual-only legacy | Docs-hub wrangler name placeholder; no automated prod smoke suite beyond deploy-workflow checks | Fill in Pages project name; scripted smoke test |
| Documentation | **Not Ready** | High | `lib/api-reference-page-data.ts`, `content/docs/api-reference/**` | Unwired `/v1/mcp/stream` documented; experimental endpoints documented as Cloud API; **actions API absent**; guide pages (mcp.mdx) accurate | Regenerate reference from the route manifest |

---

## 4. API Backend Findings

**Answers to the audit questions:**

- **Actual production routes (default flags, DB present):** health probes; `POST /v1/mcp`; `/v1/actions*`; `/v1/tasks*`; `/api/v1/runtime/*` (register/heartbeat/deregister/download/commands/commands-ack); `/v1/runtime/install|checksum|download`; `/v1/runtime/api-key*`; `/v1/api-keys*`; `/v1/account/*`; `/proof/*`, `/v1/proof/*`, `/v1/receipts*`; `/v1/execution/*` (+ governance), `/v1/agents/*`, `/v1/policies*`, `/v1/alerts/*`; `/api/v1/license/*`, `/api/v1/usage/*` (console-support, license-key-in-payload); `/v1/stats/*`, `/v1/usage/*`, `/v1/project*`, `/v1/trial/*`; `POST /webhooks/polar` (when Polar+Redis+DB configured); `/` (feature/endpoint listing). Everything else requires an explicit experimental flag.
- **Raw arbitrary execution:** `POST /v1/actions/run` cannot run unregistered actions. `POST /v1/tasks/submit` **can** accept raw task definitions (execution graphs, agent workflows) — authenticated, tenant-bound, capability-policy-checked, but it is a raw surface. If the product story is "registered actions only," this needs an explicit decision (keep as power-user API, flag-gate it, or restrict task types).
- **Tenant isolation:** consistent in every core handler read (`GetClerkUserID` → `WHERE tenant_id = $1`); `GetTask(taskID, tenantID)`; runtime selection tenant-bound; preferred-runtime pinning tenant-guarded; callback envelopes tenant-matched. Middleware leak tests (`tenant_auth_leak_test.go`, `tenant_isolation_test.go`) pass.
- **Idempotency:** tenant-scoped in code (`GetTaskByIdempotencyKey(tenantID, key)`) and schema (migration 057 composite unique index).
- **Raw payload exposure:** response redaction (`redaction.go`) drops `ciphertext`/`nonce`, envelopes sensitive keys, digests large strings/URLs/headers. Task input summaries are digest-only (`safeInputSummaryRaw`). I found no handler returning raw task definitions or bodies on the default surface.
- **Dispatch:** push-to-endpoint confirmed (POST `{endpoint}/v1/runtime/task/submit`); no routable runtime → 503 at the gateway / failed task with explicit failure details.

**Findings:**

| Sev | Finding | Evidence | Impact / Recommendation | Block prod? |
|---|---|---|---|---|
| P2 | `/v1/tasks/submit` is a raw-definition surface alongside the registered-action story | `routes_tasks.go:217-270` | Decide and document: power-API (document + policy) or gate it. Currently safe (auth + tenant + capability policy) but contradicts "registered actions only" messaging | No |
| P2 | Dead code: `RegisterMcpRoutes` / `mcpProxyHandler` (incl. unauth `/v1/mcp/stream` proxy) never called but still compiled | `routes_mcp.go:24-141`, no call sites | Someone could wire it up later by accident; it also feeds the stale docs. Delete it | No |
| P2 | Session-cookie HMAC mismatch only logs a warning and proceeds to DB lookup | `session_auth.go:150-159` | DB lookup is authoritative so not exploitable, but the defense-in-depth check is advisory only. Consider failing closed when `BETTER_AUTH_SECRET` is set | No |
| P3 | `GET /v1/runtime/install` serves binaries unauthenticated (deliberate, commented) | `runtime_download.go:245-280` | Fine if intended (binary is useless without a key); confirm with product. Public endpoint also bypasses the download audit log and rate limit | No |
| P3 | `detectPlatform` maps Windows UAs to `windows-amd64`, which has no entry in `platformBinaries` → confusing 400 | `runtime_download.go:355-396` | Cosmetic; return a clearer "Windows unsupported" message | No |
| P3 | Coordinator dispatch auth to runtime is a single shared `IGRIS_RUNTIME_SECRET` bearer (optional) — the real guard is the decision signature | `task_coordinator.go:478-481` | Acceptable since runtime verifies the Ed25519 decision sig; document that the secret is optional belt-and-braces | No |

---

## 5. MCP Findings

- **Tools (verified in `mcpToolDefinitions`)**: `list_actions`, `get_action`, `call_action`, `list_runs`, `get_run`, `get_run_evidence`, `list_runtimes`. Nothing else; unknown tool → validation error.
- **Strictness:** every schema is `additionalProperties: false` with `schema_version: "2026-06-06"`; `tools/call` params reject any field other than `name`/`arguments`; `call_action` explicitly forbids `tenant_id`, `task_definition`, `task_type`, `runtime_target`, `execution_graph`, `ciphertext`, `nonce`, `runtime_endpoint`, `runtime_id`, etc.
- **Registered actions only:** `call_action` loads the definition by id/name scoped to the authenticated tenant and submits through the same gateway path as REST (`submitActionThroughGateway`). No raw task submission via MCP.
- **Tenant override:** impossible — tenant comes from `BetterAuth` locals; forbidden-field validation rejects `tenant_id` in arguments.
- **Run/evidence exposure:** `safeMCPRunDetail`/`safeMCPRunEvidence` return status, policy state, runtime id, proof state, step digests, receipt hash/signed flag, and a digest-only input summary. No raw inputs/outputs.
- **`/v1/mcp/stream`:** not registered in production (`RegisterAgentMcpRoutes` registers only `POST /v1/mcp`). The proxy that would serve it is dead code.
- **Readiness:** implementation is external-user ready. The blocker is documentation (generated reference) and SDK examples, not code.

| Sev | Finding | Evidence | Recommendation | Block prod? |
|---|---|---|---|---|
| P1 | Docs publish `/v1/mcp/stream` as a callable Cloud API endpoint (curl/JS/Go/Rust examples) for a route that 404s in production | `web-docs-hub/lib/api-reference-page-data.ts:1205`, `content/docs/api-reference/mcp-transport/post-v1-mcp-stream.mdx`, `api-reference/index.mdx:126` | Remove the page (edit the TS source, not MDX — MDX is generated) | **Yes** (docs criterion) |

---

## 6. Rails Console Findings

**What a user can actually do (real mode):** create actions (wizard with policy presets), run actions with inline test results, list/inspect runs (story timeline, WAL step evidence with digests, proof state, run-inspector drawer), see recovery/proof/receipt state, manage runtimes (onboarding, runtime API key mint read-once, verify-connection), manage agent/app API keys (read-once create, revoke), set project name. All state lives in Overture; Rails persists nothing.

- **Demo handling is honest:** fixtures only when `OVERTURE_API_BASE_URL` is unset, with a visible demo indicator; keys and project names are never fabricated in fixture mode; API errors degrade to empty states with an error chip (`DataSource#capture`).
- **Secret exposure:** none found. Raw keys shown exactly once on mint (from the Go response), never persisted or re-displayed. Settings page is read-only and does not echo env/credential values. The client never logs the auth header. A full client-side scrub pass (`scrub_sensitive_payload`) re-redacts anything sensitive the API might return.

| Sev | Finding | Evidence | Impact | Recommendation | Block prod? |
|---|---|---|---|---|---|
| P1 | **Test suite failing on main: 262 runs, 22 failures, 0 errors** | `bundle exec rails test` (rbenv 3.2.2) | CI signal is dead; regressions can land silently | Fix the suite before any further console work | **Yes** |
| P1 | Real regression: every action shows secrets "Not configured" | `data_source_test.rb:65` failure — `secret_refs` matches the `secret` sensitive-key pattern, so `scrub_sensitive_payload` replaces the array with a redaction envelope before `normalize_action` checks `raw[:secret_refs].is_a?(Array)` | Misleading operator UI for actions with configured secret refs | Allowlist `secret_refs` (it's a list of reference names, not values) or compute `secrets_state` from the pre-scrub payload like `target_url` already does | Yes |
| P2 | Remaining ~20 failures are stale assertions from the welcome/home redesign (e.g. expecting `ic-diagram`, "View evidence" copy) | `welcome_home_split_test.rb`, `runs_loop_test.rb`, `action_detail_test.rb`, etc. | Noise that hides real failures | Update or delete stale assertions | Yes (as part of suite fix) |
| P2 | Basic auth disabled when `ADMIN_USERNAME`/`ADMIN_PASSWORD` unset — a misconfigured prod deploy is silently open | `application_controller.rb:22-38` | Anyone reaching the console gets the operator view (and the Overture service key's powers) | Fail closed in `RAILS_ENV=production` when creds unset | Recommended before prod |
| P3 | Console is single-tenant/single-operator by design (one service key, one Basic credential) | `overture_client.rb` | Fine for first-user phase; not multi-user | Documented limitation; revisit with BetterAuth-direct later | No |

---

## 7. Runtime Findings

- **Execution:** tools layer supports filesystem read, HTTP call, shell (command-whitelisted), DB write, plus the agent/inference graph executor. Domain whitelist deny-by-default for HTTP (`test_empty_whitelist_denies_all` passes).
- **Redaction:** `igris-tools/src/redaction.rs` mirrors the Go policy (digest envelopes, sensitive key patterns, 512-char cap, safe header allowlist); 23/23 tests pass including `filesystem::test_read_emits_safe_result_envelope`.
- **Inbound work:** push model — Overture POSTs to the runtime's registered endpoint. The runtime **requires inbound reachability from Overture** for task dispatch; the separate `/api/v1/runtime/commands` poll covers fleet commands only, not task execution. This matches the console's "endpoint must be reachable" onboarding.
- **Inbound protection:** decision-signature verification is fail-closed for `task/submit`, `execute`, `cancel` even when local auth is disabled; submission API can be disabled outright.
- **Callbacks:** signed envelopes (Ed25519, nonce, body digest, timestamp) matching Overture's verifier; replay-safe via server-side nonce persistence.
- **Registration:** `IGRIS_API_KEY` → `POST /api/v1/runtime/register` with machine identity + Ed25519 public key + payload signature; tier-based instance limits enforced via `billing.RuntimeEnforcer` (requires Redis).
- **Release/install:** tag `runtime-v*` → 5-platform matrix (musl static Linux x64/arm64/armv7, macOS arm64/x64) → GitHub Releases with `.sha256` sidecars; `install.sh` downloads from `github.com/Igris-inertial/system/releases/download` and verifies checksums. Hetzner mirror job exists but is `if: vars.ENABLE_HETZNER_BINARY_MIRROR == 'true'` (default skip).

| Sev | Finding | Evidence | Recommendation | Block prod? |
|---|---|---|---|---|
| P2 | Runtime HTTP server uses `CorsLayer::permissive()` and binds `0.0.0.0:8080` unconditionally | `igris-server/src/main.rs` (~line 4983) | CORS is mostly irrelevant for server-to-server, but permissive CORS + any future browser-credential flow is a trap; make bind address/CORS configurable | No |
| P2 | Large preview surface compiled into the same binary (swarm, federated, multimodal, btree, HITL, memory, LoRA) with public-ish routes when submission API is on | route table `main.rs:4886-4960` | These are the runtime-side equivalent of the experimental flags — consider feature-gating route registration like Overture does | No |
| P3 | Full workspace `cargo test` not run in this audit (heavy: llama.cpp, 29 crates) | — | Run in CI: `cargo test --manifest-path igris-runtime/Cargo.toml --workspace` | Unverified |

---

## 8. Database and Tenant Isolation Findings

- **Two migration trees:** root `migrations/` (28 files, inference-era: tenants, API keys, RLS policies, trial columns, `tenant_tier` enum values, runtime_instances tenant_id) with its own `migrate.sh`; and `igris-overture/database/migrations/` (60 files, product-era: task_records, action_definitions, execution_context/lineage, input refs, callback envelopes). **No unified runner; no evidence in-repo of which have been applied to Neon.** Memory notes migrations need manual execution; nothing in the repo contradicts that.
- **Tenant-binding:** migration 057 gives tenant-scoped idempotency uniqueness; 058 (execution_lineage) and 060 (execution_context) backfill tenant_id deterministically then apply `NOT NULL + CHECK` **only if zero tenant-null rows remain**, otherwise `RAISE WARNING` and rely on app-level fail-closed reads. This is sound engineering but means **the DB constraint state in production is data-dependent and unknown from the repo**.
- **RLS:** root-tree migrations 013/019 add RLS policies for inference-era tables; the product-era tables (task_records, execution_lineage, action_definitions) rely on application scoping + constraints, not RLS.
- **Pre-prod checks that must run against Neon** (read-only): `SELECT COUNT(*) FROM execution_lineage WHERE tenant_id IS NULL OR tenant_id=''` (and same for execution_context); confirm `task_records_tenant_id_idempotency_key_idx` exists and the old global index is gone; confirm `tenant_tier` enum contains seed/horizon/infinite (the manual VPS fix never became a migration — root tree has `026_tenant_tier_enum_values.sql`, verify it's applied to Neon).

| Sev | Finding | Recommendation | Block prod? |
|---|---|---|---|
| P1 | Conditional tenant-binding constraints (058/060) may be unapplied in prod; unverifiable locally | Run the read-only checks above on Neon; if rows remain, run the documented cleanup then re-apply | **Yes — verify before launch** |
| P2 | Two migration trees, manual execution, no applied-state tracking visible in repo | Consolidate or at least document one canonical apply order + a `schema_migrations` check script | No, but soon |
| P3 | Postgres-backed isolation tests skip without `IGRIS_OVERTURE_POSTGRES_TEST_DSN` | Provide DSN in CI so they actually run | No |

---

## 9. Deployment and Operations Findings

- **Auto on push to main:** only `build-container-images.yml` (GHCR `igris-api` + `igris-console` images, path-filtered; build+push only, never deploys). `docs-quality.yml` and `proof-gate.yml` run on PRs.
- **Manual:** `deploy-api-azure.yml` / `deploy-console-azure.yml` (workflow_dispatch, staging|production environment, **pinned image digest required**, OIDC to Azure, GHCR pull creds). Runtime release on `runtime-v*` tags.
- **Legacy:** `deploy-vps.yml` is explicitly marked LEGACY, manual-dispatch only ("Auto-deploy on push to main was removed 2026-06-09"). The runtime-release Hetzner mirror is off by default. **No active dependency on Hetzner remains in the default paths.** Caveat: `DEPLOY.md` still narrates the historical Render playbook (it says so itself) — secondary reference only.
- **Docs/landing:** `web-docs-hub/wrangler.toml` (Cloudflare Pages, static export) exists but the project `name` is a placeholder — docs deploy is not reproducible from the repo yet. `web/wrangler.toml` covers the landing separately.
- **Required env (verified from code):** API — `DATABASE_URL`/`POSTGRES_URL`, `ENABLE_PERSISTENCE`/`ENABLE_MULTI_TENANCY`, `JWT_SECRET`, `VAULT_MASTER_KEY`, `BETTER_AUTH_SECRET`, `USE_REDIS`+`REDIS_URL` (runtime limits, download rate limiting, Polar), `IGRIS_RUNTIME_CALLBACK_BASE_URL` (+ optional callback auth header pair), `IGRIS_RUNTIME_SECRET` (optional), `RUNTIME_BINARIES_URL` or `RUNTIME_BINARIES_DIR` + `RUNTIME_BINARY_VERSION` (exact tag, not "latest", for GH redirects), `CORS_ALLOWED_ORIGINS`, `ENV=production`, optional `IGRIS_INTERNAL_ADMIN_TOKEN`, `RESEND_API_KEY`, `POLAR_API_KEY`. Console — `OVERTURE_API_BASE_URL`, `OVERTURE_API_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OVERTURE_PUBLIC_API_URL`. Runtime — `IGRIS_API_KEY`, Overture base URL, callback config, `IGRIS_ENABLE_RUNTIME_SUBMISSION_API`.
- **Smoke:** deploy workflows include validation steps; `SMOKE.md`/`SMOKE_LIVE_MODE.md` exist as manual playbooks. Minimum honest prod smoke: `GET /readyz`, `GET /` feature map, authenticated `POST /v1/mcp` `tools/list`, create+run a `mock_demo` action, `GET /v1/runtime/checksum`.

| Sev | Finding | Recommendation | Block prod? |
|---|---|---|---|
| P2 | Docs-hub Pages project name placeholder — docs deploy not reproducible | Fill in real project name | Yes for docs launch |
| P3 | No scripted post-deploy smoke (manual MD playbooks only) | Turn SMOKE_LIVE_MODE.md into a script invoked by the Azure deploy workflows | No |

---

## 10. Documentation Alignment Findings

| Sev | Finding | Evidence | Block public launch? |
|---|---|---|---|
| **P1** | **Core actions API undocumented.** No page anywhere in web-docs-hub mentions `/v1/actions` — zero hits in `content/docs/**` and `api-reference-page-data.ts` | `grep -r "v1/actions" web-docs-hub/content → 0 results` | **Yes** — the primary product API is invisible |
| **P1** | API reference documents `/v1/mcp/stream` (unwired) as a callable preview endpoint with full code samples | `api-reference-page-data.ts:1205`; generated MDX pages | **Yes** |
| P1 | API reference presents experimental, disabled-by-default endpoints as "Cloud API": `/v1/infer`, `/v1/chat/completions`, `/v1/routing/*` (12 pages), `/v1/federated/*`, `/v1/swarm/*`, `/v1/memory/*`, `/v1/hitl/*`, `/v1/btree/*`, `/v1/vault/*`, `/api/v1/runtime/config/push`, `/api/v1/runtime/update` — none reachable without `IGRIS_ENABLE_EXPERIMENTAL_*` flags (and several are runtime-local, not cloud) | endpoint list in `api-reference-page-data.ts` vs flag gating in `main.go`/`route_surface.go` | Yes — readers will integrate against 404s |
| — | **Accurate:** `content/docs/mcp.mdx` matches implementation exactly (7 fixed tools, closed schemas, tenant-from-credential); runtime reachability and receipts guides reflect the push model | read directly | — |
| P2 | The right fix surface is `lib/api-reference-page-data.ts` (MDX under `content/docs/api-reference/**` is generated; hand-edits revert on build) | repo convention verified in earlier work | — |
| P2 | A route-manifest→docs generator would prevent recurrence: `GenerateRouteManifest` already produces the classified default surface | `route_manifest.go` | — |

---

## 11. Security Risks (consolidated)

1. **(P1, ops not code)** Tenant-binding constraints on the proof ledger may be unapplied in prod — app code fails closed, but the DB backstop is unconfirmed (§8).
2. **(P2)** Console front door fails open when Basic-auth env vars are unset (§6).
3. **(P2)** Dead unauthenticated MCP proxy code retained (§4).
4. **(P2)** Cookie HMAC verification advisory-only (§4).
5. **(P3)** Public `/v1/runtime/install` bypasses download audit/rate-limit (accepted design; confirm).
6. **(P3)** Shared optional `IGRIS_RUNTIME_SECRET` for dispatch auth — mitigated by mandatory decision signatures on the runtime side.
7. **No raw secret/payload leak paths found** through API responses, MCP results, console views, or runtime tool envelopes on the default surface. Redaction is implemented in three layers (Overture responses, runtime tool outputs, console scrub) with consistent digest-envelope policy.

## 12. Reliability Risks

1. Dispatch is async fire-and-forget after 202; recovery loop (15 s scan, 90 s heartbeat timeout) redispatches replay-safe work and **blocks** automatic replay for irreversible/non-retryable tasks (decision + recovery event persisted) — implemented and unit-tested, not yet load/chaos tested.
2. `tc.httpClient` timeout is 300 s; a slow runtime ties up a goroutine per task (acceptable at current scale).
3. Trial cron, callback-nonce cleanup, and compliance export scheduler all run in-process — single-replica assumptions; fine on Container Apps with one replica, revisit before scaling out (duplicate crons).
4. Proof sync depends on a DB trigger; startup logs detect absence and fall back to read reconciliation (`HasTaskProofSyncTrigger`) — good degradation, but verify the trigger exists in prod.

## 13. Product UX Gaps

1. Console secrets-state regression (§6) — misleading on every action with secret refs.
2. `hybrid_fallback` is selectable vocabulary but always 409s — console copy says "Coming soon," which is honest; docs should match.
3. Windows users get an unhelpful unsupported-platform error from download/install.
4. Single-operator console: no per-user identity, no audit of *who* in the org ran an action (only agent identity from API metadata).

## 14. Demo-Only or Experimental Areas

- **Flag-gated, off by default (Overture):** inference/model gateway (`/v1/infer`, `/v1/models`, multimodal, LoRA), routing experiments (speculative/council/shadow/circuit-breaker), cognitive advisor, federated learning, robotics/ROS/BT routes, AI policy/credentials, fleet push/OTA, console gap-fill routes, debug metrics.
- **Failing or broken tests live exactly there:** `providers` test file doesn't compile; shadow-runner test panics (nil RNG); openai mock streaming timeout; Thompson-sampling trust test fails. Core packages are unaffected.
- **`mock_demo` action target** is an explicit, labeled demo path (writes a marked record, never calls external APIs) — honest by construction.
- **Console fixture mode** is demo-only and labeled.
- **Runtime preview crates:** swarm, federated, multimodal, simulation — scaffolding-to-partial.

## 15. Test Results

| Suite | Command | Result |
|---|---|---|
| Overture core | `go test ./igris-overture/api/... ./igris-overture/coordinator/... ./igris-overture/middleware/... -count=1` | ✅ **PASS** (api 2.6 s, coordinator 4.5 s, middleware 6.9 s) |
| Overture full | `go test ./igris-overture/... -count=1` | ❌ 4 failures, all experimental: `providers` (test file compile error `key_rotation_test.go:262` — imports after declarations), `inference/optimizer/shadow` (`TestShadowRunner_TimeoutPrevention` nil-pointer panic, `shadow_runner.go:127`), `providers/openai` (`TestMockProviderStreaming` deadline), `router` Thompson-sampling trust test. Product-related to experimental surfaces only; core unaffected |
| Rails console | `RBENV_VERSION=3.2.2 rbenv exec bundle exec rails test` | ❌ **262 runs, 1840 assertions, 22 failures** — 1 real regression (secrets_state), ~21 stale view assertions (full list in §6 / `/tmp/rails_test_full.log`) |
| Runtime (targeted) | `cargo test -p igris-tools -p igris-wal --lib` | ✅ 23/23 pass (redaction, whitelists, registry, filesystem envelope) |
| Runtime (full workspace) | not run locally (heavy native deps: llama.cpp, 29 crates) | ⚠️ Run in CI: `cargo test --manifest-path igris-runtime/Cargo.toml --workspace` |
| Postgres-backed Go tests | skipped automatically (no `IGRIS_OVERTURE_POSTGRES_TEST_DSN`) | ⚠️ Provide DSN in CI |
| Docs build | not run — `pnpm --filter web-docs-hub build` regenerates `lib/generated/**` (those files are already modified in the working tree) and would violate the no-edit rule | ⚠️ Run in CI / clean tree |

## 16. Unknowns and Manual Verification Needed

1. **Neon prod schema state** — constraints from 058/060, idempotency index from 057, `tenant_tier` enum values, proof-sync trigger presence. *How:* read-only psql against Neon (queries in §8).
2. **Azure app env state** — `IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS` must be unset/false; `RUNTIME_BINARY_VERSION` must be an exact release tag; `ADMIN_USERNAME/PASSWORD` set on the console app; experimental flags all unset. *How:* `az containerapp show` env listing (no values printed).
3. **GitHub Releases artifacts** — latest `runtime-v*` release actually contains all 5 tar.gz + .sha256 pairs. *How:* `gh release view`.
4. **Which migrations have been applied where** — no in-repo record. *How:* compare `schema_migrations`-style tracking (root tree creates one via migrate.sh) and information_schema against both trees.
5. **Full runtime workspace test health** — CI run.
6. **Docs static export builds green** — CI run on a clean tree.

## 17. Prioritized Fix List

**P0 — none found.** No unauthenticated data exposure, cross-tenant read, or secret leak was identified on the default surface.

**P1 (before first external user / public docs):**
1. Verify + enforce tenant-binding constraints on Neon (058/060 conditional path) — §8.
2. Fix the Rails console suite: the secrets_state regression + 21 stale assertions; restore green CI — §6.
3. Regenerate the public API reference from truth: remove `/v1/mcp/stream`, demote/remove experimental endpoints, **add the actions API** — edit `lib/api-reference-page-data.ts` — §10.

**P2 (shortly after):**
4. Delete dead MCP proxy code (`RegisterMcpRoutes`, `mcpProxyHandler`).
5. Console: fail closed in production when Basic-auth creds are unset.
6. Fix the broken `providers/key_rotation_test.go` compile error and the shadow-runner nil-pointer panic (or quarantine the experimental packages from the default test run).
7. Fill in the Cloudflare Pages project name in `web-docs-hub/wrangler.toml`.
8. Provide `IGRIS_OVERTURE_POSTGRES_TEST_DSN` in CI so DB-level isolation tests actually run.
9. Decide and document the `/v1/tasks/submit` raw-surface posture.
10. Consolidate the two migration trees (or document canonical order + applied-state check).

**P3:**
11. Script the post-deploy smoke test into the Azure workflows.
12. Windows platform messaging on download/install; runtime CORS/bind configurability; cookie-HMAC fail-closed option.

## 18. Recommended Next Tasks

1. **"Docs truth pass"** — one task: drive `api-reference-page-data.ts` from `GenerateRouteManifest` output (the manifest already classifies exposure/auth/flags), add the actions + MCP pages, delete unwired/experimental pages. This converts the route-drift guard into a docs-drift guard.
2. **"Console green"** — fix the secrets_state scrub ordering, refresh stale assertions, add the suite to CI (it currently isn't in any workflow I found).
3. **"Prod schema attestation"** — small read-only script (psql) that asserts the §8 invariants and runs in the Azure deploy workflow before traffic shift.
4. **"Runtime CI"** — full `cargo test` workspace job (path-filtered) so runtime claims are continuously verified.
5. After those: first-external-user dry run — fresh tenant, mint key, install runtime via `install.sh` from GitHub Releases, register, create `local_runtime` action, run it via MCP `call_action`, inspect evidence in the console. Every step above is implemented; this validates the seam end-to-end.
