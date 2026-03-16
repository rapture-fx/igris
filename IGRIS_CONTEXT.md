# Igris Inertial — Full Project Context

> Use this document to onboard any AI agent or collaborator onto the Igris Inertial codebase, product vision, architecture, and current build status.

---

## What Is Igris Inertial?

**Igris Inertial** is an **AI inference governance platform**. It gives companies a programmable control plane for AI agents running on edge devices and cloud providers. Instead of AI agents calling APIs directly and uncontrollably, Igris sits between the agents and the world — enforcing policies, SLOs, budgets, and compliance on every execution.

**Core value proposition:** "We govern how AI agents execute so enterprises can deploy them without losing control."

---

## Monorepo Structure

```
/Users/wira/Desktop/system/
├── cmd/igris-overture/main.go      # Go API entry point
├── igris-overture/                 # Go backend packages
│   ├── api/                        # Route handlers
│   ├── billing/                    # Polar.sh billing, trial, tiers
│   ├── database/migrations/        # SQL migrations (001–016)
│   ├── middleware/                 # Auth, rate limiting, tenant isolation
│   ├── models/                     # DB models
│   └── ...
├── igris-runtime/                  # Rust runtime (29 crates)
│   └── crates/
│       ├── igris-core/             # Core runtime
│       ├── igris-server/           # Server wrapper (igris-server binary)
│       ├── igris-federated/        # Federated learning (80% done)
│       ├── igris-swarm/            # Swarm coordination (85% done)
│       ├── igris-multimodal/       # Multimodal input (40% scaffolding)
│       ├── igris-license-client/   # License + registration with Overture
│       ├── igris-lora-trainer/     # LoRA fine-tuning
│       ├── igris-memory/           # Memory management
│       ├── igris-planning/         # Task planning
│       ├── igris-routing/          # Request routing
│       ├── igris-safety/           # Safety checks
│       ├── igris-sensors/          # Sensor integration (robotics)
│       ├── igris-btree/            # BTree memory structure
│       ├── igris-reflection/       # Self-reflection
│       ├── igris-recovery/         # Error recovery
│       ├── igris-hitl/             # Human-in-the-loop
│       ├── igris-local-llm/        # Local LLM support
│       ├── igris-model-manager/    # Model lifecycle
│       ├── igris-simulation/       # Simulation support
│       ├── igris-emergency/        # Emergency recovery
│       ├── igris-ros2/             # ROS2 integration (robotics)
│       ├── igris-fleet/            # Fleet management
│       ├── igris-tools/            # Tool utilities
│       ├── mcp-client/             # MCP protocol client
│       ├── mcp-server/             # MCP protocol server
│       └── overture-server/        # Overture backend crate
├── rust-core/                      # Rust FFI libraries (cgo)
│   ├── rust_kernel/                # Thompson Sampling inference router
│   └── production_slo_enforcer/    # SLO enforcement
├── rust/escapevector-wasm/         # WASM module (182KB, Thompson Sampling)
│   └── pkg/
│       ├── escapevector_wasm_bg.wasm
│       └── escapevector_wasm.js
├── web/                            # Next.js monorepo
│   ├── apps/web-landing/           # Marketing site (igrisinertial.com)
│   ├── apps/web-console/           # Developer console (console.igrisinertial.com)
│   └── apps/web-docs/              # Documentation (docs.igrisinertial.com)
├── labs/packages/                  # Shared frontend packages
│   ├── ui/                         # Shared shadcn components
│   ├── types/                      # Shared TypeScript types
│   ├── config/                     # Shared configs
│   └── javascript-sdk/             # JS SDK workspace
├── igris-javascript-sdk/           # JavaScript/TypeScript SDK ✅
├── igris-python-sdk/               # Python SDK ✅
├── igris-go-sdk/                   # Go SDK ✅
├── igris-rust-sdk/                 # Rust SDK ✅
├── igris-java-sdk/                 # Java SDK ✅
├── igris-ruby-sdk/                 # Ruby SDK (~60%, needs rebrand)
├── igris-csharp-sdk/               # C# SDK (~55%, needs rebrand)
├── Dockerfile                      # Go API Dockerfile
├── web/Dockerfile.console          # Next.js console Dockerfile
├── docker-compose.production.yml   # Production stack
├── Caddyfile                       # Reverse proxy (auto TLS)
├── fly.toml                        # Legacy Fly.io config (now on Hetzner)
└── .github/workflows/
    ├── deploy-vps.yml              # Auto-deploy to Hetzner on push
    └── igris-runtime-release.yml   # Runtime release workflow
```

---

## Infrastructure

| Layer | Technology | Domain |
|-------|-----------|--------|
| Go API | Docker on Hetzner VPS | `overture.igrisinertial.com` |
| Next.js Console | Docker on Hetzner VPS | `console.igrisinertial.com` |
| Landing page | Cloudflare Pages | `igrisinertial.com` |
| Docs | Cloudflare Pages | `docs.igrisinertial.com` |
| Database | PostgreSQL 15 (Docker) | Internal |
| Cache | Dragonfly (Redis-compatible) | Internal |
| Reverse proxy | Caddy 2 (auto TLS) | VPS |
| CI/CD | GitHub Actions | Auto-deploy on push to main |
| Billing | Polar.sh (webhooks) | — |
| Email | Resend API | — |
| Auth | Better Auth (cookie sessions) | Cross-subdomain |
| DNS/CDN | Cloudflare (unproxied for VPS) | — |

**Auto-deploy rules:**
- `web/**` or `labs/packages/**` changes → rebuild + restart `console` container
- `igris-overture/**` or `Dockerfile` changes → rebuild + restart `api` container

---

## Authentication

**Stack:** Better Auth with PostgreSQL session store

- Cookie: `better-auth.session_token` (HTTP) / `__Secure-better-auth.session_token` (HTTPS)
- Cross-subdomain: `domain=igrisinertial.com` (shared between console and API)
- Session table: `session` + `user` + `account` + `verification` (migration 016)
- Social providers: Google OAuth, GitHub OAuth (separate apps for local vs prod)
- Go backend validates sessions directly via DB query (`session JOIN "user"`)
- Better Auth server runs inside Next.js app (`/api/auth/[...all]`)

**Auth flow:**
1. User signs in via GitHub/Google/email on `console.igrisinertial.com`
2. Better Auth creates session, sets cookie for `.igrisinertial.com`
3. All API calls to `overture.igrisinertial.com` include the cookie
4. Go middleware reads `__Secure-better-auth.session_token` (or bare name), queries session table, auto-provisions tenant

---

## Pricing Tiers

| Tier | Price | Runtime Instances | Use Case |
|------|-------|------------------|---------|
| Seed | $29/mo | 1 | Individual developers |
| Horizon | $149/mo | 50 | Teams |
| Infinite | $699/mo | 500 | Enterprise |

- 7-day free trial on all tiers, one per tenant
- Trial expiry → downgraded to Seed (not locked out)
- Billing via Polar.sh (price IDs are placeholders — update after Polar dashboard setup)
- No per-request limits, no free tier

---

## Core Features (What's Working ~75%)

### 1. Provider Routing (Fully Implemented)
- Thompson Sampling (multi-armed bandit) via Rust FFI for adaptive routing
- Council mode: multiple models vote on a response
- Shadow mode: route to shadow provider for comparison, promote when ready
- Speculative execution: parallel requests, use fastest response
- Cost-optimized, latency-optimized, quality-optimized routing strategies
- Real-time provider health monitoring

### 2. SLO Enforcement (Fully Implemented)
- SLO definitions: max duration, max tokens, cost budgets
- Execution receipts: cryptographic proof of policy compliance
- Violation tracking and alerting
- Prometheus scraper for metrics (uses Rust FFI)

### 3. Runtime Distribution (Fully Implemented)
- Authenticated binary downloads: `GET /v1/runtime/download?platform=…`
- Platforms: Linux x64/ARM64, macOS Intel/Apple Silicon, Windows
- Rate-limited (10/hr), audit-logged in `runtime_downloads` table
- Installer script: `Igris.sh` (prompts for API key, downloads binary)
- Runtime auto-registers with Overture on startup, 30s heartbeat, deregisters on shutdown

### 4. Multi-Tenancy (Fully Implemented)
- Tenant auto-provisioned on first authenticated request
- Per-tenant: API keys, policies, usage tracking, billing
- Runtime instances scoped per tenant

### 5. Policy Engine (Fully Implemented)
- Execution bounds: max duration, max ticks, max steps
- Resource limits: CPU, memory, disk write
- Policy versioning with history
- Capability snapshots per execution

### 6. Billing & Trials (Fully Implemented)
- 7-day free trial system (TrialManager in `billing/trial.go`)
- Daily cron: expire trials, send reminders (3-day, 1-day warnings)
- Polar.sh integration for subscription management
- Tier enforcement: RuntimeEnforcer blocks overuse

### 7. WASM Module (Built, Partially Wired)
- `rust/escapevector-wasm/` — Thompson Sampling in WASM (182KB)
- Served from `/public/wasm/escapevector_wasm_bg.wasm`
- `useWasmEngine` hook loads + compiles the module
- EscapeVector page exists but benchmark/visualization UI is incomplete

---

## Features In Progress

### Federated Learning (~80% Rust, 0% UI)
- `igris-runtime/crates/igris-federated/` — 22KB of real implementation
- FedAvg, weighted averaging, median aggregation strategies
- Differential privacy (Laplace noise)
- QLoRA weight merging for quantized adapter aggregation
- **Missing:** Go API routes, console management page, result visualization

### Swarm Coordination (~85% Rust, mock UI)
- `igris-runtime/crates/igris-swarm/` — 32KB of real implementation
- Raft-style leader election (Leader/Follower/Candidate roles)
- Message signing for envelope validation
- Task execution handlers (InferenceTask, HealthCheck)
- Console page exists at `/dashboard/runtime/swarm` but shows hardcoded data
- **Missing:** Real Go API routes wired to swarm, live data in console

### Multimodal (~40% scaffolding)
- `igris-runtime/crates/igris-multimodal/` — type definitions + stubs
- Feature-gated: `vision` (requires `image`, `imageproc`) and `audio` (requires `hound`)
- **Missing:** Enable feature flags, real implementation, Go API routes, console UI

---

## Console Pages Status

### Fully Built (Real API data)
- `/dashboard` — Overview stats, executions, violations, charts
- `/execution/runs` — Filterable execution list with detail drawer
- `/models/routing` — Routing strategy configuration
- `/policy/bounds` — Execution and resource limits
- `/dashboard/fleet` — Fleet overview and instance management
- `/downloads/runtime` — Runtime binary download page
- `/settings/billing`, `/settings/keys`, `/settings/license`, `/settings/general`
- `/proof/violations`, `/proof/receipts`
- `/models/cost`, `/models/providers`

### Partial (UI exists, mock/incomplete data)
- `/dashboard/overture/escapevector` — WASM hooks wired, UI incomplete
- `/dashboard/runtime/swarm` — Hardcoded mock data
- `/dashboard/agents/planning`, `/agents/tools`, `/agents/qlora`
- Overture pages: council, shadow, speculative, cognitive

### Stubs (Empty placeholder)
- Getting started, most settings sub-pages, observability, usage detail

---

## SDKs

| SDK | Status | Notes |
|-----|--------|-------|
| JavaScript/TypeScript | ✅ Full | Real implementation |
| Python | ✅ Full | Real implementation |
| Go | ✅ Full | Real implementation |
| Rust | ✅ Full | Real implementation |
| Java | ✅ Full | Real implementation |
| Ruby | ⚠️ 60% | Still branded "Schlep-engine", missing Igris-specific APIs |
| C# | ⚠️ 55% | Still branded "Schlep", minimal HTTP implementation |

---

## Go API Routes (Key Endpoints)

```
GET  /healthz                          — Health check (public)
POST /v1/auth/login                    — Legacy JWT (not primary auth)
GET  /v1/tenants/current               — Current tenant info
POST /v1/trial/start                   — Start free trial
GET  /v1/trial/status                  — Trial status
GET  /v1/stats/overview                — Dashboard overview stats
GET  /v1/execution/runs                — Execution list
GET  /v1/proof/violations              — Violations list
GET  /v1/proof/receipts                — Execution receipts
GET  /v1/runtime/download?platform=…  — Authenticated binary download
GET  /v1/runtime/checksum?platform=…  — Public checksum
POST /api/v1/runtime/register          — Register runtime instance
POST /api/v1/runtime/heartbeat         — Runtime heartbeat
POST /api/v1/runtime/deregister        — Deregister runtime
GET  /routing/strategy                 — Get routing strategy
PUT  /routing/strategy                 — Update routing strategy
GET  /routing/speculative              — Speculative config
PUT  /routing/council                  — Council config
GET  /v1/usage/summary                 — Usage summary
GET  /v1/stats/model-usage             — Model usage chart data
GET  /api/subscription/status          — Subscription + runtime usage
GET  /v1/vault/keys                    — API key vault
```

---

## Database Schema (Key Tables)

```sql
users              — Better Auth users
session            — Better Auth sessions
account            — OAuth accounts
tenants            — Tenant records (auto-provisioned on first auth)
tenant_api_keys    — Per-tenant API keys
runtime_instances  — Registered runtime devices (heartbeat, status)
runtime_downloads  — Audit log for binary downloads
executions         — Execution records
violations         — Policy violations
slo_records        — SLO compliance records
billing_events     — Polar.sh webhook events
subscriptions      — Active subscriptions
-- Migration history: 001–016
```

---

## Environment Variables (Production)

**Go API (docker-compose):**
```
DATABASE_URL            — postgres://...
REDIS_URL               — redis://:password@cache:6379/0
JWT_SECRET              — for runtime download auth
VAULT_MASTER_KEY        — for API key encryption
CORS_ALLOWED_ORIGINS    — comma-separated allowed origins
POLAR_WEBHOOK_SECRET    — Polar.sh webhook validation
RESEND_API_KEY          — for transactional emails
USE_REDIS=true          — required for billing
```

**Next.js Console (build args + runtime):**
```
NEXT_PUBLIC_API_URL     — https://overture.igrisinertial.com (baked at build)
NEXT_PUBLIC_APP_URL     — https://console.igrisinertial.com (baked at build)
BETTER_AUTH_SECRET      — session signing key (must match between deploys)
BETTER_AUTH_URL         — https://console.igrisinertial.com
DATABASE_URL            — same postgres instance as Go API
COOKIE_DOMAIN           — igrisinertial.com
GOOGLE_CLIENT_ID/SECRET — production OAuth app
GITHUB_CLIENT_ID/SECRET — production OAuth app (separate from local)
RESEND_API_KEY          — for password reset emails
```

---

## Known Issues & TODOs

1. **Auth bounce-back** — users get redirected to `/auth` after OAuth login. Middleware fix deployed (raw cookie header check), not yet confirmed working.
2. **`ROUTES.LOGIN`** in `utils/constants.ts` points to `/auth/login` which doesn't exist — should be `/auth?mode=signin`. Any 401 API error redirects to a 404.
3. **Polar price IDs** are placeholders (`price_seed_monthly` etc.) — need real IDs from Polar dashboard.
4. **WASM EscapeVector page** — module loads but no interactive UI built.
5. **Swarm console page** — shows hardcoded mock data, needs real API.
6. **Federated learning** — no console UI, no Go routes.
7. **Multimodal** — scaffolding only, feature flags disabled.
8. **Ruby + C# SDKs** — need "Schlep" → "Igris" rebrand + Igris-specific APIs.

---

## Product Positioning (from live landing page)

### Hero
> "Run AI that survives failure and proves what it did."
> "Deterministic runtime. Cloud + local fallback. OS-level containment with signed violation logs. Deploy anywhere."

### The Three Guarantees
1. **Execute with Bounds** — Every execution runs in an isolated worker. Memory, CPU, and time enforced at OS level. Exceed a limit and the worker is killed. Every violation is signed and hash-chained.
2. **Decide with Structure** — Language models generate reasoning. The runtime governs execution through bounded control paths. Isolated, time-limited, and supervised.
3. **Remember with Proof** — Every execution produces a signed envelope. Violations are hash-chained and tamper-evident. Verify independently — without our control plane.

### Deploy. Verify. Optimize.
- **Deploy** — Single binary, any device. Execution, routing, memory, proof included.
- **Verify** — Cryptographically signed decisions. Behavior trees execute predictably. Works offline.
- **Optimize** — Fleet dashboard, provider routing intelligence, execution health at scale.

### Key Differentiators (FAQ copy)
- "Thompson Sampling learns which provider performs best for your workload — starting with cautious exploration, converging to optimal routing after ~500 requests."
- "Speculative Execution races 2-3 providers in parallel. Council Mode has providers evaluate each other's answers. Speed vs. quality — you choose per request."
- "The runtime operates fully offline with local LLM inference via llama.cpp. When connectivity is available, it routes to cloud providers."
- "EscapeVector: a 72-hour encrypted response cache (AES-256-GCM) that activates when all providers fail."
- "Gold Code: Ed25519-signed emergency override protocol. Only patches signed by your authorized keys are accepted."
- "We never train models on your data. Federated learning shares only encrypted model weight updates — raw data never leaves the device."

### Security Claims (must be true)
- Ed25519 signed routing decisions
- AES-256-GCM encrypted API keys at rest
- Post-quantum TLS (Rustls + AWS-LC-RS)
- Sandboxed tool execution with resource limits
- Air-gapped operation

### Use Cases Marketed
1. Enterprise AI Operations — multi-tenant cost control, policy routing
2. Hybrid Cloud–Edge Reliability — cryptographic decision binding, automatic failover
3. Edge-First AI Systems — deterministic execution, local LLM, robotics
4. Air-Gapped & Restricted Environments — isolated operation, encrypted storage
5. AI Reliability Engineering — decision traces, replayable execution paths

### ⚠️ Copy vs. Reality Discrepancies to Fix
- Landing FAQ says "Seed plan gives you 1 device... free forever" — **actual Seed is $29/mo, no free tier**
- Pricing section shows "5 runtime instances" for Seed — **actual limit is 1**
- These must be corrected in the landing page copy

---

## Domains

| Domain | Points To |
|--------|-----------|
| `igrisinertial.com` | Cloudflare Pages (landing) |
| `console.igrisinertial.com` | Hetzner VPS (Next.js, port 3005) |
| `overture.igrisinertial.com` | Hetzner VPS (Go API, port 8080) |
| `docs.igrisinertial.com` | Cloudflare Pages (docs) |

DNS: Cloudflare, **unproxied (DNS only)** for VPS subdomains — Caddy handles TLS directly.

---

## Development Setup

```bash
# Go API
cd /Users/wira/Desktop/system
go run ./cmd/igris-overture

# Next.js Console
cd web
pnpm --filter @igris-inertial/web-console dev   # runs on :3005

# Next.js Landing
pnpm --filter @igris-inertial/web-landing dev   # runs on :3000

# Rust Runtime (single crate)
cd igris-runtime
cargo build --bin igris-server

# WASM
cd rust/escapevector-wasm
wasm-pack build --target web --out-dir pkg
```

---

*Last updated: March 2026*
