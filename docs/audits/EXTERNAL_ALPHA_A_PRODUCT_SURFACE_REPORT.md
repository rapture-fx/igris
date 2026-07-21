# External Alpha A — Supported Product Surface and Feature-Gate Audit

**Date:** 2026-07-22  
**Branch:** `feature/external-alpha-product-surface`  
**Base SHA:** `c46b4d8c22d7c7ec50f54f8001621fb28fe94b1c`  
**Worktree:** `/Users/wira/Desktop/system-worktrees/external-alpha-product-surface`  
**Verdict:** `EXTERNAL_ALPHA_SURFACE_READY`

## Positioning

Reliable execution for AI agents that can change real systems.  
Supported lifecycle: **Action → Run → Recover → Reconcile when uncertain → Prove**.

## Supported surface (default production)

- Tenant authentication and isolation (`ENABLE_MULTI_TENANCY`, BetterAuth / tenant API keys)
- Tenant-scoped API keys (`/v1/api-keys`, `/v1/account/api-key`, `/v1/runtime/api-key`)
- Registered Actions (`/v1/actions*`)
- ActionContract synchronization (`/v1/contracts/*`)
- Exact `contract_hash` Action binding
- Durable Action submission + business idempotency
- Runtime dispatch + transparent checkpoints + safe recovery
- Typed uncertain-effect detection
- Igris Run Proof + Action Protocol Evidence (`/proof/*`, `/v1/receipts*`, `/v1/evidence/*`)
- Operator reconciliation (admin session only on `/v1/actions/runs/:id/reconciliation`)
- Durable tasks / Runtime callback bridge (`/v1/tasks*`, `/api/v1/runtime/*`)
- Governance recovery inspection (`/v1/execution/governance/*`)
- Health/readiness probes

## Beta surface (reachable, not independently proven)

- **Overture MCP** `POST /v1/mcp` — reuses the exact durable Action Task submission boundary and security semantics; classified **BETA** until a complete external-alpha MCP journey is independently proven.

## Experimental — disabled by default

### Already gated (unchanged posture)

- Model/inference, LoRA, multimodal (`IGRIS_ENABLE_EXPERIMENTAL_MODEL_ROUTES`)
- Speculative/routing/shadow/council/escapevector (`IGRIS_ENABLE_EXPERIMENTAL_ROUTING_ROUTES`)
- Robotics/ROS/BT definitions (`IGRIS_ENABLE_EXPERIMENTAL_ROBOTICS_ROUTES`)
- AI capability/credentials (`IGRIS_ENABLE_EXPERIMENTAL_AI_POLICY_ROUTES`)
- Federated (Overture) (`IGRIS_ENABLE_EXPERIMENTAL_FEDERATED_ROUTES`)
- Fleet push/OTA (`IGRIS_ENABLE_EXPERIMENTAL_FLEET_ROUTES`)
- Console gap-fill (`IGRIS_ENABLE_EXPERIMENTAL_CONSOLE_GAP_ROUTES`)
- Cognitive (`ENABLE_COGNITIVE_ADVISOR` + `IGRIS_ENABLE_EXPERIMENTAL_COGNITIVE_ROUTES`)
- Debug metrics / SLO admin

### Newly gated in this change (were previously default-on)

| Pack | Flag | Routes |
|---|---|---|
| Action Packs | `IGRIS_ENABLE_EXPERIMENTAL_ACTION_PACKS_ROUTES` | `/v1/action-packs*` |
| Agent Registry | `IGRIS_ENABLE_EXPERIMENTAL_AGENT_REGISTRY_ROUTES` | `/v1/agents*` |
| Evidence Memory | `IGRIS_ENABLE_EXPERIMENTAL_EVIDENCE_MEMORY_ROUTES` | `/v1/agent-memory` |
| Execution Intelligence | `IGRIS_ENABLE_EXPERIMENTAL_EXECUTION_INTELLIGENCE_ROUTES` | `/v1/execution/intelligence`, affinity, trust-recommendations, `/v1/execution-evals*` |
| Policy simulation | `IGRIS_ENABLE_EXPERIMENTAL_POLICY_SIMULATION_ROUTES` | `/v1/policy/simulate`, `/v1/policy/proposals*` |
| Legacy execution console | `IGRIS_ENABLE_EXPERIMENTAL_EXECUTION_CONSOLE_ROUTES` | `/v1/execution/runs*`, BT-state, shadow, policies, alerts |

### Runtime defaults narrowed

- Federated coordinator no longer hard-enabled; requires `IGRIS_ENABLE_EXPERIMENTAL_RUNTIME_FEDERATED=true`
- Swarm coordinator opt-in via `config.swarm.enabled` or `IGRIS_ENABLE_EXPERIMENTAL_RUNTIME_SWARM=true`
- Behavior-tree HTTP routes require `IGRIS_ENABLE_EXPERIMENTAL_RUNTIME_BTREE=true`
- EscapeVector / speculative / thompson / council defaults flipped to **off**
- Chat path respects `routing.speculative.enabled` (no multi-provider race by default)
- Runtime-local MCP remains config-off (`mcp.enabled=false`); when enabled it **bypasses** Action boundary (documented residual risk)

## Internal surface

- License/usage/trial/stats/project console support APIs (operational, not advertised as Clock 3F.1 product)
- Polar webhook (only when `POLAR_API_KEY` configured)
- SLO admin (`ENABLE_SLO_ENFORCER` + `IGRIS_INTERNAL_ADMIN_TOKEN`)
- Debug metrics (`IGRIS_ENABLE_DEBUG_METRICS_ROUTES`)

## Routes / configuration changed

- `cmd/igris-overture/main.go` — gate newly classified packs
- `igris-overture/api/route_surface.go` — flag constants + inventory classification
- `igris-overture/api/route_manifest.go` + fixture — default manifest narrowed
- `igris-overture/api/routes_actions.go` — Action Packs gated inside Action registration
- `igris-overture/api/route_*_test.go` — fail-closed assertions for new packs
- `igris-runtime/crates/igris-core/src/config/mod.rs` — experimental defaults off
- `igris-runtime/crates/igris-server/src/main.rs` — opt-in federated/swarm/btree; speculative gated
- `igris-runtime/crates/igris-swarm/src/lib.rs` — swarm default `enabled: false`
- `igris-runtime/config.json5` — sample config aligned with off-by-default posture

## Security implications

- Smaller default authenticated attack surface on Overture
- Experimental packs fail closed (routes absent, not partially wired)
- Operator reconciliation remains admin-session-only (API keys still 403)
- Runtime no longer starts federated/swarm coordinators or mounts their HTTP APIs by default
- Runtime MCP bypass path unchanged but remains disabled by default
- BetterAuth, tenant scoping, idempotency, Action binding, Runtime callback verification, and reconciliation eligibility were not weakened

## Clock 3F.1 regression

`scripts/clock_3f_product_validation.sh` against this branch binaries:

- Scenario A: **PASS** (completed; proof + evidence present; idempotent replay)
- Scenario B: **PASS** (recovery lineage runtime_failed → handoff_allowed → redispatched)
- Scenario C: **PASS** (uncertain effect; API-key reconcile 403; admin reconcile ok)
- Security negatives: **PASS**
- Frozen protocol manifest SHA: `864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4` **OK**

## Tests run

- `go vet` on affected packages — pass
- Focused Go package tests (`api`, `coordinator`, `handlers`, `internal`) — pass
- Route manifest / route surface / external-alpha pack tests — pass
- `TestBuildBoundAction` — pass
- `scripts/ci_proof_gate.sh fast` — pass
- Rust `continue_after_checkpoint` — pass
- Rust `runtime_callback` — pass
- Clock 3F product validation harness — pass
- Heavy Tier A (`scripts/ci_proof_gate.sh heavy`) — see CI/local log if completed in same session

## Residual risks

1. Overture MCP is BETA: Action-boundary reuse is source-proven, but no dedicated external-alpha MCP end-to-end gate was run here.
2. Console support APIs (license/trial/stats/project) remain registered when DB is present; they are not Clock 3F.1 product claims.
3. Runtime still mounts inference-era chat/memory/HITL/fleet/admin HTTP routes under `agent-platform`; they are outside the Action product path but not fully deleted.
4. Sample `config.json5` speculative/escapevector flags were set off; deployments with custom configs that re-enable them remain operator-controlled.
5. Runtime-local MCP (`mcp.enabled=true`) remains an Action-boundary bypass if explicitly enabled.

## Recommended integration instructions

1. Merge only after independent review; do **not** self-ratify.
2. Production compose/render should leave all `IGRIS_ENABLE_EXPERIMENTAL_*` unset/false.
3. External-alpha docs/SDK surfaces should advertise only the Supported + Beta (MCP) lists above.
4. To restore a gated pack for internal dogfood, set the corresponding flag to `true` (or Runtime env for federated/swarm/btree).
5. Keep operator reconciliation on BetterAuth admin sessions only.
