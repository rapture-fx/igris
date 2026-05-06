# Console V1 Audit

Source-grounded audit of `web/apps/web-console` against the current backend in `igris-overture` and `igris-runtime`.

No console source files were modified for this audit. This report only adds a new markdown file.

## Current console structure

- Frontend shell: Next.js App Router app under `web/apps/web-console/app`, with shared layout in `components/layout/DashboardLayout.tsx` and sidebar in `components/layout/Sidebar.tsx`.
- Data layer: almost all pages call `lib/apiClient.ts`, which can fall back to `lib/mock/data.ts` in development when `FEATURE_FLAGS.enableMockData` is true in `lib/config.ts`.
- Auth/dev mode: local auth is effectively disabled.
  - `middleware.ts` returns `true` from `hasSession()` and never blocks console routes.
  - `lib/auth-client.ts` returns a hardcoded dev session from `useSession()`.
  - `app/auth/page.tsx` immediately redirects to `/dashboard`.
- Health gating is effectively bypassed in the main shell: `components/layout/DashboardLayout.tsx` renders `HealthCheckGate skipHealthCheck={true}`.

Key refs:
- `components/layout/DashboardLayout.tsx:29`
- `components/layout/Sidebar.tsx:40`
- `lib/apiClient.ts:58`
- `lib/config.ts:37`
- `lib/mock/data.ts:824`
- `middleware.ts:20`
- `lib/auth-client.ts:11`
- `app/auth/page.tsx:11`

## Navigation/sidebar source

Primary sidebar navigation is defined in `components/layout/Sidebar.tsx`.

Current nav tree:

- Dashboard
- Execution: Runs, Tasks, Approvals
- Proof: Receipts, Violations
- Policy: Bounds, Capabilities
- Infrastructure: Providers, Devices
- History: Logs, Metrics
- Settings: General, API Keys, License

Important notes:

- The sidebar already excludes many future-heavy pages that still exist in `app/`.
- The sidebar search index also points at the same v1-friendly subset.
- There is no top-level `/settings` route; navigation points to subroutes only.

Key refs:
- `components/layout/Sidebar.tsx:40`
- `components/layout/Sidebar.tsx:165`

## All existing pages/routes

Category legend:

- `real`: meaningful UI tied to implemented backend handlers
- `mock`: page relies on synthetic fallback objects or dev mock registry in a material way
- `placeholder`: redirect, stub, disabled flow, or page whose current behavior is mostly non-functional scaffolding
- `missing`: route needed for a clean v1 IA but not present

| Route | Category | Notes | Frontend source |
|---|---|---|---|
| `/` | placeholder | Redirect-only entrypoint to `/dashboard`. | `app/page.tsx:8` |
| `/auth` | placeholder | Auth UI is bypassed in dev and immediately redirects to `/dashboard`. | `app/auth/page.tsx:11` |
| `/auth/login` | placeholder | Redirect alias to `/auth`. | `app/auth/login/page.tsx:7` |
| `/auth/register` | placeholder | Redirect alias to `/auth`. | `app/auth/register/page.tsx:7` |
| `/clear-session` | placeholder | Utility redirect page; low product value for v1. | `app/clear-session/page.tsx:7` |
| `/reset-password` | real | Actual Better Auth reset flow. | `app/reset-password/page.tsx:23` |
| `/sso-callback` | placeholder | Redirect-only callback page. | `app/sso-callback/page.tsx:6` |
| `/onboarding` | placeholder | Only API key generation is real; workspace/use-case steps are local-only. | `app/onboarding/page.tsx:21` |
| `/downloads/runtime` | real | Runtime download utility tied to `/v1/runtime/download`; not v1 console core. | `app/downloads/runtime/page.tsx:42` |
| `/dashboard` | real | Main verified-execution overview page. | `app/dashboard/page.tsx:88` |
| `/execution/runs` | real | Real list page, but receipt columns depend on fields not returned by backend list contract. | `app/execution/runs/page.tsx:66` |
| `/execution/runs/[id]` | real | Real shell, but no backend `GET /v1/execution/runs/:id`; page reconstructs detail from list + receipts + violations. | `app/execution/runs/[id]/page.tsx:151` |
| `/execution/tasks` | real | Durable task list is tied to real `/v1/tasks` endpoints. | `app/execution/tasks/page.tsx:115` |
| `/execution/tasks/[id]` | real | Task detail and proof verification are wired to real task endpoints. | `app/execution/tasks/[id]/page.tsx:67` |
| `/execution/approvals` | real | Real HITL approvals over paused runs. | `app/execution/approvals/page.tsx:26` |
| `/execution/agents` | real | Backend-backed, but broad/future-heavy for v1. | `app/execution/agents/page.tsx:513` |
| `/execution/agents/[id]/live` | real | SSE-backed live BT state viewer; future-heavy for v1. | `app/execution/agents/[id]/live/page.tsx:257` |
| `/execution/shadow` | real | Backend-backed shadow trace comparison; future-heavy for v1. | `app/execution/shadow/page.tsx:102` |
| `/execution/bt-editor` | real | BT editor backed by real BT routes plus local templates; future-heavy for v1. | `app/execution/bt-editor/page.tsx:453` |
| `/proof/receipts` | real | Real receipts list, but verify payload shape is mismatched with backend. | `app/proof/receipts/page.tsx:218` |
| `/proof/violations` | placeholder | Uses `/v1/history/alerts`, but filters on `category === "policy"` even though backend does not return `category`; likely renders empty. | `app/proof/violations/page.tsx:210` |
| `/policy/bounds` | real | Real editor over `/policy/bounds` and `/policy/history`. | `app/policy/bounds/page.tsx:147` |
| `/policy/capabilities` | real | Real editor over `/policy/capabilities` and history. | `app/policy/capabilities/page.tsx:215` |
| `/history/logs` | real | Real events/traces page, but UI expects richer event types than backend emits. | `app/history/logs/page.tsx:282` |
| `/history/metrics` | real | Real summary/throughput page, but filter endpoint is missing and several chart series are empty from backend. | `app/history/metrics/page.tsx:146` |
| `/history/alerts` | real | Real alert list/actions, but schema is thinner than the UI assumes; not needed for v1. | `app/history/alerts/page.tsx:166` |
| `/models/providers` | real | Real provider registry page; future/hidden for v1. | `app/models/providers/page.tsx:155` |
| `/models/routing` | mock | Major sections fall back to synthetic config/status objects because several backend endpoints do not exist. | `app/models/routing/page.tsx:501` |
| `/models/cost` | real | Real cost page via `/models/usage/*`; future/hidden for v1. | `app/models/cost/page.tsx:179` |
| `/models/training` | real | Real LoRA status/trigger proxy; copy overclaims maturity; future/hidden for v1. | `app/models/training/page.tsx:177` |
| `/models/federated` | real | Real federated routes exist; future/hidden for v1. | `app/models/federated/page.tsx:198` |
| `/fleet/devices` | real | Real fleet page using `/devices` and ROS lifecycle; future/hidden for v1. | `app/fleet/devices/page.tsx:259` |
| `/fleet/devices/[id]/ros-monitor` | real | Real ROS discovery/publish page; future/hidden for v1. | `app/fleet/devices/[id]/ros-monitor/page.tsx:51` |
| `/fleet/ros` | real | Real ROS topic mapping/lifecycle page; future/hidden for v1. | `app/fleet/ros/page.tsx:61` |
| `/fleet/swarm` | mock | Swarm status is real, but timeline is synthetic on failure and clear action uses wrong HTTP method. | `app/fleet/swarm/page.tsx:155` |
| `/settings/general` | placeholder | Mixed page with real POST endpoints, but no GET settings endpoints, missing roles endpoint, and some values are generated client-side. | `app/settings/general/page.tsx:132` |
| `/settings/keys` | real | Real runtime API key + vault key management. | `app/settings/keys/page.tsx:31` |
| `/settings/license` | real | Real license page over `/v1/license`. | `app/settings/license/page.tsx:54` |
| `/settings/billing` | real | Real subscription page; future/hidden for v1. | `app/settings/billing/page.tsx:45` |
| `/settings` | missing | Needed if v1 nav wants a single Settings destination. No route exists. | missing |

## Real API-connected pages

Pages with meaningful backend implementations in `igris-overture` today:

- Dashboard
  - Frontend: `app/dashboard/page.tsx:89`
  - Backend: `igris-overture/api/routes_stats.go:39`, `igris-overture/api/routes_execution.go:130`, `igris-overture/api/routes_proof.go:38`, `igris-overture/api/routes_history.go:30`
- Runs and approvals
  - Frontend: `app/execution/runs/page.tsx:73`, `app/execution/approvals/page.tsx:31`
  - Backend: `igris-overture/api/routes_execution.go:130`
- Tasks
  - Frontend: `hooks/useTasks.ts:79`, `app/execution/tasks/[id]/page.tsx:76`
  - Backend: `igris-overture/api/routes_tasks.go:114`
- Receipts
  - Frontend: `app/proof/receipts/page.tsx:218`
  - Backend: `igris-overture/api/routes_proof.go:36`
- Policy bounds and capabilities
  - Frontend: `app/policy/bounds/page.tsx:147`, `app/policy/capabilities/page.tsx:215`
  - Backend: `igris-overture/api/routes_policy_ext.go:30`
- Logs, metrics, alerts
  - Frontend: `app/history/logs/page.tsx:308`, `app/history/metrics/page.tsx:167`, `app/history/alerts/page.tsx:220`
  - Backend: `igris-overture/api/routes_history.go:18`
- Settings keys and license
  - Frontend: `hooks/useApiKey.ts:20`, `hooks/useVault.ts:23`, `app/settings/license/page.tsx:59`
  - Backend: `igris-overture/api/routes_apikey.go:49`, `igris-overture/api/routes_tenancy.go:91`, `igris-overture/api/routes_license.go:176`

Important caveat: some pages are "API-connected" but still contract-fragile. The main examples are run detail, receipts verify, proof violations, logs, metrics, and settings general.

## Mock-data pages

The console has two separate fallback systems:

- Global dev mock registry in `lib/apiClient.ts` + `lib/mock/data.ts`
- Page-local synthetic objects returned from `catch { ... }`

Global dev mock registry is enabled by default in development:

- `lib/config.ts:37`
- `lib/apiClient.ts:87`
- `lib/mock/data.ts:824`

Routes with explicit dev mock coverage in `lib/mock/data.ts` include:

- `/v1/stats/overview`
- `/v1/execution/runs`
- `/v1/execution/agents`
- `/v1/fleet/devices`
- `/v1/model/routing`
- `/v1/model/providers`
- `/v1/model/cost`
- `/v1/policy/bounds`
- `/v1/policy/capabilities`
- `/v1/proof/receipts`
- `/v1/proof/violations`
- `/v1/history/logs`
- `/v1/history/metrics`
- `/v1/history/alerts`
- `/v1/license`

Pages with material synthetic fallback behavior:

- `app/models/routing/page.tsx`
  - Falls back to hardcoded strategy, circuit-breaker, speculative, council, and shadow config/status objects.
  - Refs: `app/models/routing/page.tsx:501`, `:526`, `:545`, `:597`, `:660`, `:680`
- `app/fleet/swarm/page.tsx`
  - Builds a synthetic 60-point timeline if `/v1/fleet/swarm/timeline` is unavailable.
  - Ref: `app/fleet/swarm/page.tsx:190`
- `app/settings/general/page.tsx`
  - Generates a verification key in-browser and fabricates a raw API key if backend does not return one.
  - Refs: `app/settings/general/page.tsx:173`, `:218`
- `app/onboarding/page.tsx`
  - Workspace and use-case steps are local state only.
  - Refs: `app/onboarding/page.tsx:31`, `:37`

## Placeholder/stub pages

- Auth is intentionally disabled in local console flows.
  - `app/auth/page.tsx:12`
  - `middleware.ts:20`
  - `lib/auth-client.ts:11`
- Redirect-only pages:
  - `app/page.tsx:8`
  - `app/auth/login/page.tsx:7`
  - `app/auth/register/page.tsx:7`
  - `app/sso-callback/page.tsx:6`
- Onboarding is not a persisted setup flow yet.
  - `app/onboarding/page.tsx:31`
  - `app/onboarding/page.tsx:37`
- Settings general is not a trustworthy read/write settings console yet.
  - No GET endpoints exist for general/security/runtime settings in backend.
  - Frontend defaults are local state.
  - Refs: `app/settings/general/page.tsx:137`, `:160`, `:183`; `igris-overture/api/routes_settings.go:31`
- Proof violations page is effectively stubbed by schema mismatch.
  - Frontend expects `category`, `source`, `alert_type`, `violation_details`.
  - Backend returns `title`, `message`, `severity`, `status` only.
  - Refs: `app/proof/violations/page.tsx:214`, `igris-overture/api/routes_history.go:337`

## Stale or overclaiming copy

- README is still old-product and old-branding copy.
  - Title and body still say `Schlep-engine Developer Console`.
  - Ref: `README.md:1`
- Root metadata still describes a broader inference-infra product, not the verified execution v1 focus.
  - Ref: `app/layout.tsx:7`
- Training page copy overstates current product maturity:
  - "automatically fine-tunes a LoRA adapter from inference history" and "hot-loaded without restart"
  - Ref: `app/models/training/page.tsx:216`
- Logs page UI implies rich event taxonomy (`ExecutionStarted`, `ProviderSelected`, `ToolCall`, `ReceiptSigned`) that the current backend does not emit.
  - Frontend: `app/history/logs/page.tsx:34`
  - Backend emits only minimal `event_type` values like `violation` and `execution_completed`.
  - Ref: `igris-overture/api/routes_history.go:125`
- Dashboard "Fallback signals" implies log-level routing/failover evidence, but current execution run list contract does not expose `logs`.
  - Frontend: `app/dashboard/page.tsx:27`
  - Backend run struct: `igris-overture/api/routes_execution.go:149`
- Existing `AUDIT.md` is stale against the current tree.
  - It references old `/dashboard/*` architecture and claims that no longer match this repo state.
  - Ref: `AUDIT.md:9`

## Backend endpoints currently used

Implemented and used by the console:

| Endpoint | Backend status | Backend source | Main frontend usage |
|---|---|---|---|
| `GET /v1/tenants/current` | implemented | `igris-overture/api/routes_tenancy.go:75` | `hooks/useTenant.ts:59` |
| `GET/POST/DELETE /v1/account/api-key` | implemented | `igris-overture/api/routes_apikey.go:49` | `hooks/useApiKey.ts:20` |
| `GET/POST/DELETE /v1/vault/keys*` | implemented, but path style differs by id/provider semantics | `igris-overture/api/routes_tenancy.go:91` | `hooks/useVault.ts:23` |
| `GET /v1/stats/overview` | implemented | `igris-overture/api/routes_stats.go:39` | `app/dashboard/page.tsx:93` |
| `GET /v1/execution/runs` | implemented | `igris-overture/api/routes_execution.go:130` | `lib/executionRuns.ts:105` |
| `POST /v1/execution/runs/:id/(pause|cancel|replay|approve|reject)` | implemented | `igris-overture/api/routes_execution.go:131` | run detail + approvals |
| `GET /v1/tasks`, `GET /v1/tasks/:id`, `GET /v1/tasks/:id/steps`, `POST /v1/tasks/:id/proof/verify` | implemented | `igris-overture/api/routes_tasks.go:118` | `hooks/useTasks.ts:79`, task detail |
| `GET /proof/receipts`, `POST /proof/receipts/verify` | implemented | `igris-overture/api/routes_proof.go:37` | receipts pages |
| `GET /v1/proof/violations` | implemented | `igris-overture/api/routes_proof.go:42` | dashboard + run detail helper |
| `GET/POST /policy/bounds`, `GET /policy/history` | implemented | `igris-overture/api/routes_policy_ext.go:33` | bounds page |
| `GET/POST /policy/capabilities`, `GET /policy/capabilities/history` | implemented | `igris-overture/api/routes_policy_ext.go:35` | capabilities page |
| `GET /v1/history/events`, `GET /v1/history/metrics`, `GET/POST /v1/history/alerts*` | implemented | `igris-overture/api/routes_history.go:30` | logs, metrics, alerts, proof violations |
| `POST /v1/settings/general|security|runtime`, `GET/POST /v1/settings/api-keys*` | partially implemented | `igris-overture/api/routes_settings.go:31` | settings general |
| `GET/POST /api/subscription/status|plans` | implemented | `igris-overture/api/routes_subscription.go:16` | billing, fleet quota |
| `GET/POST /v1/license*` | implemented | `igris-overture/api/routes_license.go:176` | license page |
| `GET /models/providers`, CRUD alias | implemented | `igris-overture/api/routes_provider_registry.go:56` | providers page |
| `GET /models/usage/*` | implemented | `igris-overture/api/routes_cost.go:17` | cost page |
| `GET /devices*` | implemented | `igris-overture/api/routes_fleet.go:609` | fleet devices, ROS page |
| `GET /v1/ros/topics`, `POST/DELETE /v1/ros/topics/map*`, `POST /v1/ros/lifecycle`, `GET /v1/ros/discovery`, `POST /v1/ros/publish` | implemented | `igris-overture/api/routes_fleet.go:1032` | ROS and BT pages |
| `GET /v1/fleet/swarm`, `POST /v1/fleet/swarm/broadcast` | implemented | `igris-overture/api/routes_fleet.go:1021` | swarm page |
| `GET /v1/lora/status`, `POST /v1/lora/trigger` | implemented | `igris-overture/api/routes_lora.go:34` | training page |
| `GET/POST /v1/federated/*` | implemented | `igris-overture/api/routes_federated.go:62` | federated page |

Contract mismatches already visible from source:

- Frontend calls `GET /v1/execution/runs/:id`, but backend does not register it.
  - Frontend: `lib/executionRuns.ts:108`
  - Backend: `igris-overture/api/routes_execution.go:130`
- Frontend posts `{ execution_id, hash, signature }` to `/proof/receipts/verify`, but backend verifier reads `expected_hash`.
  - Frontend: `app/proof/receipts/page.tsx:230`, `app/execution/runs/[id]/page.tsx:236`
  - Backend: `igris-overture/api/routes_proof.go:171`
- Frontend proof violations page uses `/v1/history/alerts`; the dedicated `/v1/proof/violations` route exists but is not used there.
  - Frontend: `app/proof/violations/page.tsx:214`
  - Backend: `igris-overture/api/routes_proof.go:268`
- Frontend fleet swarm clear uses `POST`; backend registers `DELETE`.
  - Frontend: `app/fleet/swarm/page.tsx:178`
  - Backend: `igris-overture/api/routes_fleet.go:1028`

## Missing endpoints needed for v1

For a trustworthy v1 around verified execution, the highest-value missing or mismatched contracts are:

1. `GET /v1/execution/runs/:id`
   - Needed because run detail currently reconstructs state from list endpoints.
   - Frontend expects richer fields than list responses provide.
   - Refs: `lib/executionRuns.ts:108`, `igris-overture/api/routes_execution.go:130`

2. A consistent receipts verify contract
   - Either frontend must send `expected_hash`, or backend must accept `hash`.
   - Refs: `app/proof/receipts/page.tsx:230`, `igris-overture/api/routes_proof.go:171`

3. A single violations contract for v1
   - Either use `/v1/proof/violations` everywhere, or expand `/v1/history/alerts` to return `category`, `source`, `alert_type`, and violation detail fields.
   - Refs: `app/proof/violations/page.tsx:214`, `igris-overture/api/routes_proof.go:268`, `igris-overture/api/routes_history.go:337`

4. `GET /v1/history/metrics/filters`
   - Frontend calls it; backend does not implement it.
   - Refs: `app/history/metrics/page.tsx:154`

5. Read endpoints for settings state
   - `GET /v1/settings/general`
   - `GET /v1/settings/security`
   - `GET /v1/settings/runtime`
   - Without these, settings are mostly write-only and boot from local defaults.
   - Refs: `app/settings/general/page.tsx:137`, `igris-overture/api/routes_settings.go:31`

6. If the roles table stays in v1: `GET /api/admin/users`
   - The frontend queries it, but no handler exists in these repos.
   - Refs: `app/settings/general/page.tsx:235`

7. Optional but useful for IA cleanliness: a top-level `/settings` route
   - Needed only if the v1 nav wants a single Settings destination.

## Recommended v1 navigation

Recommended active nav:

- Dashboard
- Runs
- Tasks
- Receipts
- Violations
- Bounds
- Capabilities
- Logs
- Metrics
- Settings

Recommended IA changes:

- Flatten the sidebar around verified execution rather than technical silos.
- Keep `Settings` as one destination, with tabs/sections for General, API Keys, and License inside it.
- Keep `Approvals` accessible from Runs/Tasks context, not as a first-class nav item unless approval volume is high.
- Remove `Infrastructure`, `Models`, and `Fleet` from the default v1 sidebar.

Implementation source for current nav to update:

- `components/layout/Sidebar.tsx:40`

## Recommended pages to hide or mark future

Hide or mark future in v1:

- `/execution/agents`
- `/execution/agents/[id]/live`
- `/execution/shadow`
- `/execution/bt-editor`
- `/models/providers`
- `/models/routing`
- `/models/cost`
- `/models/training`
- `/models/federated`
- `/fleet/devices`
- `/fleet/devices/[id]/ros-monitor`
- `/fleet/ros`
- `/fleet/swarm`
- `/history/alerts`
- `/settings/billing`
- `/downloads/runtime`

Why:

- They either broaden scope away from verified execution, depend on missing contracts, or expose future-heavy platform surfaces not needed for the v1 product story.

## Recommended first implementation task

First task: make the verified-execution core contract coherent before changing visuals.

Recommended scope:

1. Add `GET /v1/execution/runs/:id` in `igris-overture`.
2. Align `/proof/receipts/verify` request/response shape with the frontend.
3. Repoint Proof > Violations to one authoritative endpoint and make its schema match the UI.
4. Then trim `components/layout/Sidebar.tsx` down to the v1 navigation above.

Why this first:

- Runs, receipts, and violations are the product core.
- Today they look close to real, but the source shows contract gaps that will undermine a refactor if left in place.
- Once those contracts are stable, the console can be safely simplified without preserving broken surfaces.
