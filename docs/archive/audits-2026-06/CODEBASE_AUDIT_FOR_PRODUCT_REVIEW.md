# Codebase Audit For Product Review

This audit is based on source inspection of the repository, plus a small number of local repo validation scripts. It is not an end-to-end deployment certification. "Confirmed" below means there is concrete implementation in source, often with persistence paths, handlers, or tests behind it, not just README copy.

## Repository structure

- `igris-runtime/` is the real Rust runtime workspace. It contains the HTTP runtime binary, routing, local model adapter, behavior-tree engine, safety/containment, fleet, swarm, federated, WAL, MCP server/client, and optional robotics/multimodal crates (`igris-runtime/Cargo.toml`, `igris-runtime/crates/igris-server/Cargo.toml`).
- `igris-overture/` is the real Go backend/control plane. It contains API routes, task coordination, routing, billing, security, database config, semantic routing, provider adapters, and proof/receipt persistence (`cmd/igris-overture/main.go`, `igris-overture/api`, `igris-overture/coordinator`, `igris-overture/router`).
- `cmd/igris-overture/` is the Go server entrypoint that wires middleware, route registration, persistence, telemetry, task recovery, and optional subsystems (`cmd/igris-overture/main.go`).
- `web/apps/web-console/` is the operator console. It is a real Next.js app, but it still carries stale branding/docs and development mock-data pathways (`web/apps/web-console/package.json`, `web/apps/web-console/lib/apiClient.ts`, `web/apps/web-console/README.md`).
- `web/apps/web-docs-hub/` is the docs site. It has unusually strong source-audit tooling, including route-claim audits and API-contract validation against the Go/Rust code (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/scripts/audit-docs-implementation.js`, `web/apps/web-docs-hub/scripts/validate-api-contracts.js`).
- `web/apps/web-landing/` is the marketing site. It is a real app, but its README is stale and inconsistent with the codebase brand/history (`web/apps/web-landing/package.json`, `web/apps/web-landing/README.md`).
- SDKs exist for JavaScript, Python, Go, Rust, and additional language shells. The JS/Python/Go/Rust SDKs have real source and examples; the audit below only claims what I confirmed in those codebases (`igris-javascript-sdk`, `igris-python-sdk`, `igris-go-sdk`, `igris-rust-sdk`).
- `migrations/` contains actual SQL schema history for budgets, API keys, provider registry, routing telemetry, SSO, RLS, trial system, and runtime instances (`migrations/*.sql`, `migrations/README.md`).
- `ops/` contains deployment/backup runbooks, not application logic (`ops/runbook.md`, `ops/backups/*`).
- `scripts/` exists, but the visible `scripts/Makefile` is stale and points at old paths that do not match the current monorepo (`scripts/Makefile`).
- `stability-tests/` contains load, routing, circuit-breaker, telemetry, and governance test assets. This is useful proof that reliability was at least designed/test-targeted, even if not all subsystems are polished (`stability-tests/README.md`, `stability-tests/tests/*`, `stability-tests/scripts/*`).
- `rust-core/`, `adapters/python/`, and `proto/` appear to be legacy or sidecar architecture from an older platform shape. They still exist, but the current product-critical path is Go Overture plus Rust Runtime, not Go + Rust FFI + Python ML as the root README still suggests (`README.md`, `rust-core/`, `adapters/python/`, `proto/*`).

## What is actually implemented

### Confirmed implemented features

- OpenAI-compatible inference exists in both the Go control plane and the Rust runtime. Overture exposes `/v1/infer` and `/v1/chat/completions`; Runtime exposes compatible chat and execution paths (`igris-overture/api/routes_infer.go`, `igris-runtime/crates/igris-server/src/main.rs`, `igris-runtime/crates/igris-server/src/runtime_execute.rs`).
- Overture can route requests to registered runtimes first, then fall back to direct cloud providers when no healthy runtime is available (`igris-overture/api/routes_infer.go`, `igris-overture/internal/runtime_selector.go`).
- Real provider adapters exist for OpenAI and Anthropic, including streaming and rate-limit-aware retry logic (`igris-overture/providers/openai/openai_provider.go`, `igris-overture/providers/anthropic/anthropic_provider.go`, `igris-overture/providers/openai/rate_limiter.go`, `igris-overture/providers/anthropic/rate_limiter.go`).
- The runtime implements local model execution through `llama.cpp` CLI tools, with model hot-swap and optional LoRA adapter loading (`igris-runtime/crates/igris-local-llm/src/lib.rs`, `igris-runtime/crates/igris-local-llm/src/inference.rs`).
- The runtime has a real durable task executor with checkpointing/WAL integration, permission envelopes, governance metadata, violation handling, and behavior-tree execution (`igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-runtime/crates/igris-wal`, `igris-runtime/crates/igris-btree`).
- Overture has a real durable task coordinator, persistence model, recovery loop, runtime assignment, and proof-state sync (`igris-overture/api/routes_tasks.go`, `igris-overture/coordinator/task_coordinator.go`, `igris-overture/coordinator/checkpoint_store.go`).
- Runtime registration, heartbeat, deregistration, command polling, and authenticated binary download are implemented in Overture with signature checks and runtime public-key storage (`igris-overture/api/routes_runtime.go`, `igris-overture/api/runtime_download.go`).
- Signed execution envelopes and signed execution receipts are implemented, stored, and at least partially verified across runtime and control plane (`igris-runtime/crates/igris-server/src/receipt.rs`, `igris-runtime/crates/igris-server/src/runtime_execute.rs`, `igris-overture/internal/runtime_client.go`, `igris-overture/coordinator/checkpoint_store.go`).
- Behavior-tree editing/storage exists in Overture, and behavior-tree validation/run/deploy endpoints exist in Runtime (`igris-overture/api/routes_bt.go`, `igris-runtime/crates/igris-server/src/main.rs`, `igris-runtime/crates/igris-btree/examples/*`).
- The docs site has real implementation-audit tooling and catches contract drift. This is a useful asset, not just a docs surface (`web/apps/web-docs-hub/scripts/audit-docs-implementation.js`, `web/apps/web-docs-hub/scripts/validate-api-contracts.js`).

### Partial, stubbed, or mock-heavy features

- Overture multimodal is not a real provider-backed multimodal product today. The route validates base64, chooses a provider/model label, and then builds a stub text response locally (`igris-overture/api/routes_multimodal.go`).
- Runtime multimodal defaults to stub mode unless optional build features are enabled; the default mode returns placeholder descriptions rather than model-backed vision/audio understanding (`igris-runtime/crates/igris-multimodal/src/lib.rs`).
- Runtime ROS2 support is optional and marketed broadly, but the crate explicitly says default builds use a stub implementation unless the ROS2 feature is enabled (`igris-runtime/crates/igris-ros2/src/lib.rs`).
- Fleet config push, OTA update, and ROS lifecycle commands are queued by Overture, but current Runtime command handling dead-letters those commands as not implemented (`igris-overture/api/routes_fleet_push.go`, `igris-runtime/crates/igris-server/src/main.rs`).
- Fleet telemetry has placeholders for active task count, p99 latency, and recent logs (`igris-runtime/crates/igris-fleet/src/telemetry.rs`).
- The semantic routing story is mixed. A keyword classifier is definitely implemented; ONNX classification exists, but as an optional path, not the core always-on routing path (`igris-overture/semantic/classifier.go`, `igris-overture/semantic/onnx_classifier.go`).
- The console is a real app, but several screens and hooks still fall back to development mock data, and the repo already contains an internal console audit documenting drift (`web/apps/web-console/lib/apiClient.ts`, `web/apps/web-console/lib/mockDataGuard.ts`, `web/apps/web-console/hooks/useEscapeVector.ts`, `web/apps/web-console/AUDIT.md`).
- Some local model entries are explicitly placeholders or alias fallbacks rather than cleanly supported product SKUs (`igris-runtime/crates/igris-local-llm/src/models.rs`).

## Runtime capabilities

- The Rust runtime is more than a thin inference shim. It starts an HTTP server, validates config, can self-check health/metrics/status, supports a local chat CLI, exposes admin model management, fleet status, federated model endpoints, swarm endpoints, behavior-tree endpoints, runtime execution/violations, and durable task endpoints (`igris-runtime/crates/igris-server/src/main.rs`).
- Runtime execution uses real containment/safety plumbing. The execution path goes through a containment guard, bounded execution accounting, violation recording, and execution-envelope signing (`igris-runtime/crates/igris-server/src/runtime_execute.rs`, `igris-runtime/crates/igris-safety`, `igris-runtime/crates/igris-server/src/receipt.rs`).
- Routing modes inside Runtime are real: Thompson, speculative, and council paths are wired into the runtime execution stack, and the runtime can fall back from cloud routing to a local provider when configured (`igris-runtime/crates/igris-server/src/runtime_execute.rs`, `igris-runtime/crates/igris-routing/src/speculative.rs`, `igris-runtime/crates/igris-routing/src/cloud_provider.rs`, `igris-runtime/crates/igris-routing/src/local_provider.rs`).
- Local model support is real but operationally brittle. It depends on `llama.cpp/build/bin/llama-cli` and `llama-tokenize` being present, and it shells out to those binaries rather than embedding a model runtime directly (`igris-runtime/crates/igris-local-llm/src/inference.rs`).
- Local fallback includes model path checks, prompt cache support, configurable threading/context/batch sizing, staged hot-swap, and LoRA loading/unloading (`igris-runtime/crates/igris-local-llm/src/lib.rs`, `igris-runtime/crates/igris-local-llm/src/inference.rs`).
- Receipts and signing are first-class runtime concerns, not a docs fiction. The runtime hash-chains receipts, signs them with Ed25519 over a SHA-256 digest of canonical JSON, and persists them as JSONL (`igris-runtime/crates/igris-server/src/receipt.rs`).
- Examples at the runtime layer are narrow. The only clearly Igris-owned runtime examples I found are behavior-tree demos, not end-to-end cloud/runtime/fleet demos (`igris-runtime/crates/igris-btree/examples/hybrid_mission.rs`, `igris-runtime/crates/igris-btree/examples/visualized_mission.rs`).
- Vendored `llama.cpp` contains many examples, but those are upstream local-model examples, not proof of Igris product workflows (`igris-runtime/llama.cpp/examples/*`).

## Backend / Overture capabilities

- Overture is a real control plane with a large amount of implemented surface area: auth middleware, billing, usage, vault/key handling, dashboard APIs, runtime registration, runtime download, tasks, receipts, proof routes, fleet push, robotics policy, and AI capability policy routes are all registered from the main server (`cmd/igris-overture/main.go`).
- Inference can target direct providers or a registered runtime fleet. If persistence is enabled, Overture builds a runtime selector backed by runtime health polling and circuit-breaking; if not, it can still route directly to providers (`igris-overture/api/routes_infer.go`, `igris-overture/internal/runtime_selector.go`, `igris-overture/database/config.go`).
- BYOK/vault support is not just marketing copy. There is an encrypted key-vault implementation with AES-GCM-backed storage abstraction and HTTP routes for managing keys (`igris-overture/security/key_vault.go`, `igris-overture/api/routes_key_vault.go`).
- Persistence is optional, and the code deliberately falls back to in-memory mode when persistence is disabled or DB connection fails without fail-fast enabled. That is practical for demos, but it means many platform features are non-durable by default (`igris-overture/database/config.go`).
- Overture’s task system is one of the strongest assets in the codebase. It persists task records, checkpoints, proof state, execution artifacts, reassigns work when runtimes go stale, and forwards durable task requests to runtimes (`igris-overture/api/routes_tasks.go`, `igris-overture/coordinator/task_coordinator.go`, `igris-overture/coordinator/checkpoint_store.go`).
- Runtime registration is stronger than the docs currently admit. Registration and heartbeat payloads include signed machine identity material and a timestamp validity window, and Overture stores runtime public keys for later verification (`igris-overture/api/routes_runtime.go`, `igris-overture/internal/runtime_client.go`).
- Fleet command queuing is implemented in Overture, but the strongest operators' story is blocked because Runtime does not yet apply several queued command types (`igris-overture/api/routes_runtime.go`, `igris-overture/api/routes_fleet_push.go`, `igris-runtime/crates/igris-server/src/main.rs`).
- The control plane has multiple routing ideas in parallel: direct provider routing, runtime selection, speculative routing, adaptive router/Thompson logic, cost-aware routing, and semantic routing. This is powerful, but it also makes the product story diffuse (`igris-overture/router/speculative_router.go`, `igris-overture/router/adaptive_router.go`, `igris-overture/router/cost_aware_router.go`, `igris-overture/semantic/classifier.go`).

## Receipts and proof implementation

- Signed receipts definitely exist. `ExecutionReceipt` is a concrete runtime struct with receipt hash, previous-hash chain, and signature fields (`igris-runtime/crates/igris-server/src/receipt.rs`).
- The signature method is Ed25519 over the SHA-256 digest of canonical JSON with stable key ordering (`igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/internal/runtime_client.go`).
- The receipt format is JSON/JSONL. The runtime appends newline-delimited JSON records to a local receipt log, and Overture persists receipt-related fields into relational tables such as `execution_lineage` and task proof state (`igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/api/routes_receipts.go`, `igris-overture/coordinator/checkpoint_store.go`).
- Verification exists in two places. Runtime-side receipt signature verification exists in code and tests, and Overture’s runtime client verifies signed runtime envelopes/receipts before accepting them when the runtime public key is available (`igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/internal/runtime_client.go`).
- Overture’s public proof-verify route is weaker than the underlying cryptography. `POST /proof/receipts/verify` compares expected hash to stored hash and syncs proof state, but it does not itself perform Ed25519 verification (`igris-overture/api/routes_proof.go`).
- Verdict: the cryptographic core is real, useful, and one of the best differentiated assets in the repo; the user-facing proof product is only partially productized (`igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/api/routes_proof.go`, `igris-overture/coordinator/checkpoint_store.go`).

## Fallback and reliability implementation

- Provider fallback is real in multiple layers. Runtime can route across cloud providers using speculative, Thompson, or council strategies and then fall back to a local provider if configured (`igris-runtime/crates/igris-server/src/runtime_execute.rs`, `igris-runtime/crates/igris-routing/src/speculative.rs`, `igris-runtime/crates/igris-routing/src/local_provider.rs`).
- Overture can fail over between healthy runtimes. The runtime selector polls health, tracks circuit-breaker state, and tries alternate runtimes before the caller falls back to direct provider routing (`igris-overture/internal/runtime_selector.go`).
- Rate-limit handling is real for OpenAI and Anthropic adapters, but retry behavior is not uniformly broad. The rate limiters explicitly retry 429-style failures with backoff/jitter; non-rate-limit errors are generally surfaced rather than universally retried (`igris-overture/providers/openai/rate_limiter.go`, `igris-overture/providers/anthropic/rate_limiter.go`, `igris-overture/providers/openai/openai_provider.go`, `igris-overture/providers/anthropic/anthropic_provider.go`).
- Runtime containment, violation recording, and governed execution checks are real. The task executor verifies permission envelopes, derives required capabilities, supports human-approval gates when the feature is built, and can attach governed-action and policy-decision hashes into execution artifacts (`igris-runtime/crates/igris-server/src/task_executor.rs`).
- Runtime fleet reliability is incomplete. The telemetry layer still has placeholders, and live config/OTA command execution is not implemented on the runtime side (`igris-runtime/crates/igris-fleet/src/telemetry.rs`, `igris-runtime/crates/igris-server/src/main.rs`).
- Speculative routing is implemented, but some comments in Overture still describe future enhancements inside an already-large routing stack. This is a sign of a system that is real but not yet cleaned into a clear "done" surface (`igris-overture/router/speculative_router.go`, `igris-overture/router/adaptive_router.go`).

## Developer experience

- Real install/build/test commands exist, but they are scattered by subsystem. For Overture, the natural entrypoints are `go build ./cmd/igris-overture` and `go test ./...` from the repo root (`go.mod`, `cmd/igris-overture/main.go`).
- For Runtime, the obvious commands are `cargo run -p igris-server --bin igris-runtime -- serve`, `... -- validate-config`, `... -- health`, `... -- status`, and `... -- chat` (`igris-runtime/crates/igris-server/Cargo.toml`, `igris-runtime/crates/igris-server/src/main.rs`).
- For the docs site, the repo exposes real local validation/build scripts such as `pnpm build`, `pnpm validate`, and the docs audit/contract checks when run from `web/apps/web-docs-hub/` (`web/apps/web-docs-hub/package.json`).
- For the console and landing site, app-local `pnpm dev/build/start` commands are real, but the workspace-level `web/package.json` still references the wrong package names and old Schlep-engine branding, so the safest path is to use each app’s own `package.json`, not the workspace wrapper (`web/package.json`, `web/apps/web-console/package.json`, `web/apps/web-landing/package.json`).
- A clean 5-minute demo does not really exist yet. There are quickstart docs and SDK basics, but I did not find one deterministic end-to-end demo that proves cloud API, runtime registration, fallback, receipts, and proof verification in one path (`web/apps/web-docs-hub/content/docs/quickstart.mdx`, `igris-python-sdk/examples/basic.py`, `igris-javascript-sdk/examples/basic.ts`, `igris-go-sdk/examples/basic/main.go`, `igris-rust-sdk/examples/basic.rs`).
- The main blocker for a new engineer is repo narrative drift. The root README still describes an older architecture centered on Go + Rust FFI + Python ML service, while the actual product backbone is Overture plus Runtime (`README.md`, `cmd/igris-overture/main.go`, `igris-runtime/crates/igris-server/src/main.rs`).
- The next blocker is local-model setup. Runtime local inference depends on external `llama.cpp` binaries in a repo-relative build path, and there is no single polished bootstrap path for that in the code I reviewed (`igris-runtime/crates/igris-local-llm/src/inference.rs`).
- The third blocker is stale docs and wrappers around the frontend workspace. The console README, landing README, and `web/package.json` still contain wrong names, versions, or package references (`web/apps/web-console/README.md`, `web/apps/web-landing/README.md`, `web/package.json`).

## Examples and demos

- `igris-python-sdk/examples/basic.py` proves simple hosted inference, health, model listing, and provider listing through the Python SDK (`igris-python-sdk/examples/basic.py`).
- `igris-javascript-sdk/examples/basic.ts` proves the same baseline hosted path for the JS SDK (`igris-javascript-sdk/examples/basic.ts`).
- `igris-go-sdk/examples/basic/main.go` proves the same baseline hosted path for the Go SDK (`igris-go-sdk/examples/basic/main.go`).
- `igris-rust-sdk/examples/basic.rs` proves hosted inference, health, and model listing for the Rust SDK (`igris-rust-sdk/examples/basic.rs`).
- `igris-runtime/crates/igris-btree/examples/hybrid_mission.rs` proves behavior-tree authoring/orchestration concepts, not productized runtime fleet operation (`igris-runtime/crates/igris-btree/examples/hybrid_mission.rs`).
- `igris-runtime/crates/igris-btree/examples/visualized_mission.rs` proves BT visualization/export/metrics concepts, again not an end-user runtime bootstrap (`igris-runtime/crates/igris-btree/examples/visualized_mission.rs`).
- `igris-runtime/llama.cpp/examples/*` should not be counted as Igris product demos. They are upstream model-runtime examples bundled with the vendored dependency (`igris-runtime/llama.cpp/examples/*`).
- Missing examples for open-source adoption:
  - A single-machine "run runtime locally, submit task, export receipt, verify receipt" demo is missing (`igris-runtime/crates/igris-server/src/main.rs`, `igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/api/routes_proof.go`).
  - A "register runtime with Overture, route traffic to it, simulate failure, observe fallback" demo is missing (`igris-overture/api/routes_runtime.go`, `igris-overture/internal/runtime_selector.go`).
  - A "behavior tree plus governed approval plus proof export" demo is missing, even though the pieces exist (`igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-overture/coordinator/checkpoint_store.go`).

## Docs accuracy

- The root README overstates or misstates the live architecture. It still centers the story on Rust FFI and a Python ML service, while the live source shows Overture provider/runtime routing plus a large Rust runtime product (`README.md`, `cmd/igris-overture/main.go`, `igris-runtime/crates/igris-server/src/main.rs`).
- The multimodal docs overclaim present capability. The docs say the API is functional and routes to multimodal-capable providers; the source currently builds stub content in-process (`web/apps/web-docs-hub/content/docs/multimodal.mdx`, `igris-overture/api/routes_multimodal.go`).
- The ROS2 docs/product story are likely ahead of the shipped default. The codebase has an optional ROS2 crate, but default builds are stubbed unless the feature is enabled (`web/apps/web-docs-hub/content/docs/ros2-integration.mdx`, `igris-runtime/crates/igris-ros2/src/lib.rs`).
- The quickstart docs are partly good and partly optimistic. The runtime install/checksum/download endpoints they reference are real, but the broader "easy path" hides how much operational setup still exists around local models and fleet participation (`web/apps/web-docs-hub/content/docs/quickstart.mdx`, `igris-overture/api/runtime_download.go`, `igris-runtime/crates/igris-local-llm/src/inference.rs`).
- The docs toolchain is better than the docs content. Running the local contract validator reports that runtime register/heartbeat/deregister docs are missing required signature-related request fields, which matches the stricter Go route definitions (`web/apps/web-docs-hub/scripts/validate-api-contracts.js`, `igris-overture/api/routes_runtime.go`, `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-register.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-heartbeat.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/delete-api-v1-runtime-deregister.mdx`).
- The console README and landing README are plainly outdated and should not be trusted as current product documentation (`web/apps/web-console/README.md`, `web/apps/web-landing/README.md`).

## Product opportunities

### 1. Governed edge task runner

- Best wedge: "run governed agent/robot tasks on-device with signed execution artifacts." The code already supports durable tasks, permission envelopes, behavior trees, safety gates, human approval integration, and signed execution artifacts (`igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/coordinator/task_coordinator.go`).
- What is missing: one polished local+cloud demo, a tighter operator UX, and a more honest/feature-gated ROS2 story (`web/apps/web-console/`, `web/apps/web-docs-hub/content/docs/ros2-integration.mdx`).

### 2. Receipt and proof layer for agent execution

- Best wedge: "verifiable execution receipts for hybrid/local agent runs." This is differentiated and already unusually real in the codebase (`igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/internal/runtime_client.go`, `igris-overture/api/routes_receipts.go`).
- What is missing: a first-class verifier tool/demo, clearer proof UX, and a public verification endpoint that does actual signature verification rather than just expected-hash comparison (`igris-overture/api/routes_proof.go`, `igris-overture/coordinator/checkpoint_store.go`).

### 3. Hybrid runtime fleet control plane

- Best wedge: "register edge runtimes, route work to them, recover tasks when devices fail." The registration, health polling, runtime selection, task reassignment, and binary download surfaces already exist (`igris-overture/api/routes_runtime.go`, `igris-overture/internal/runtime_selector.go`, `igris-overture/coordinator/task_coordinator.go`, `igris-overture/api/runtime_download.go`).
- What is missing: fully working config push/OTA execution on the runtime, stronger fleet telemetry, and a single clean operator workflow (`igris-overture/api/routes_fleet_push.go`, `igris-runtime/crates/igris-server/src/main.rs`, `igris-runtime/crates/igris-fleet/src/telemetry.rs`).

## Keep / Kill / Reposition

### Keep

- Keep the Runtime durable-task/governance/receipt core. This is the most differentiated real implementation in the repo (`igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-runtime/crates/igris-server/src/receipt.rs`).
- Keep Overture runtime registration, task coordination, and runtime signature verification. This is the strongest control-plane story already backed by code (`igris-overture/api/routes_runtime.go`, `igris-overture/internal/runtime_client.go`, `igris-overture/coordinator/task_coordinator.go`).
- Keep the docs validation/audit tooling. It is unusually valuable and should become part of the engineering discipline (`web/apps/web-docs-hub/scripts/validate-api-contracts.js`, `web/apps/web-docs-hub/scripts/audit-docs-implementation.js`).
- Keep the local `llama.cpp` integration, but treat it as an expert/operator feature until bootstrap is simplified (`igris-runtime/crates/igris-local-llm/src/inference.rs`).

### Kill or hide

- Hide multimodal from front-page product claims until it is truly provider-backed end to end (`igris-overture/api/routes_multimodal.go`, `web/apps/web-docs-hub/content/docs/multimodal.mdx`).
- Hide fleet config push / OTA update / ROS lifecycle as product promises until Runtime stops dead-lettering those commands (`igris-overture/api/routes_fleet_push.go`, `igris-runtime/crates/igris-server/src/main.rs`).
- Kill stale monorepo wrappers and stale READMEs that point engineers to the wrong product/story (`README.md`, `scripts/Makefile`, `web/package.json`, `web/apps/web-console/README.md`, `web/apps/web-landing/README.md`).

### Reposition

- Reposition Overture from "general AI routing platform with everything" to "control plane for runtime-backed hybrid execution and provider routing" (`cmd/igris-overture/main.go`, `igris-overture/api/routes_infer.go`, `igris-overture/api/routes_runtime.go`).
- Reposition Runtime from "just local inference" to "governed edge execution engine with optional local models" (`igris-runtime/crates/igris-server/src/main.rs`, `igris-runtime/crates/igris-server/src/task_executor.rs`).
- Reposition semantic/ONNX routing as experimental or optional optimization, not the main product promise (`igris-overture/semantic/classifier.go`, `igris-overture/semantic/onnx_classifier.go`).

### Open-source core vs hosted/commercial layer

- Open-source core should be: Runtime execution engine, receipts/signing, local model support, behavior-tree engine, SDKs, and the basic Overture runtime-registration/task-coordination path (`igris-runtime/crates/*`, `igris-overture/api/routes_runtime.go`, `igris-overture/coordinator/*`, `igris-javascript-sdk`, `igris-python-sdk`, `igris-go-sdk`, `igris-rust-sdk`).
- Hosted/commercial layer should be: multi-tenant console, managed vault/BYOK, hosted runtime distribution, billing/tier enforcement, compliance export, and fleet operations UX (`web/apps/web-console/`, `igris-overture/security/key_vault.go`, `igris-overture/api/runtime_download.go`, `igris-overture/billing`, `cmd/igris-overture/main.go`).

## Recommended next 7-day plan

1. Pick one wedge only: hybrid governed task execution with signed receipts. That is the narrowest story already backed by the strongest code (`igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/coordinator/task_coordinator.go`).
2. Build one repo-native demo: start Overture, start one Runtime, submit one task, show a checkpoint or result, export the receipt, and verify it. Put it in a single script plus one markdown walkthrough (`cmd/igris-overture/main.go`, `igris-runtime/crates/igris-server/src/main.rs`, `igris-overture/api/routes_receipts.go`, `igris-overture/api/routes_proof.go`).
3. Rewrite the root README around the actual architecture and that one demo. Remove the old Go+Rust-FFI+Python-primary story (`README.md`, `cmd/igris-overture/main.go`, `igris-runtime/crates/igris-server/src/main.rs`).
4. Fix docs drift that blocks trust: runtime registration API docs, multimodal docs, ROS2 positioning, and stale frontend READMEs (`web/apps/web-docs-hub/scripts/validate-api-contracts.js`, `igris-overture/api/routes_runtime.go`, `web/apps/web-docs-hub/content/docs/multimodal.mdx`, `web/apps/web-docs-hub/content/docs/ros2-integration.mdx`, `web/apps/web-console/README.md`, `web/apps/web-landing/README.md`).
5. Add one missing example per adoption path:
   - local runtime + receipt verification
   - hosted API + runtime fallback
   - behavior tree + governed approval
   (`igris-runtime/crates/igris-btree/examples/*`, `igris-python-sdk/examples/basic.py`, `igris-javascript-sdk/examples/basic.ts`, `igris-go-sdk/examples/basic/main.go`, `igris-rust-sdk/examples/basic.rs`)
6. De-scope or feature-flag what is not ready: multimodal, ROS2 as a default promise, OTA/config push, and broad "AI routing platform" claims (`igris-overture/api/routes_multimodal.go`, `igris-runtime/crates/igris-ros2/src/lib.rs`, `igris-runtime/crates/igris-server/src/main.rs`, `README.md`).

## Bottom line

The codebase is not fake. There is substantial real implementation here, especially in the Runtime durable-task/governance/receipt path and in Overture’s runtime registration/task coordination path. The main problem is not absence of code; it is product sprawl, stale narrative, and several features being marketed ahead of their actual readiness (`igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-runtime/crates/igris-server/src/receipt.rs`, `igris-overture/coordinator/task_coordinator.go`, `README.md`, `web/apps/web-docs-hub/content/docs/multimodal.mdx`).

If the goal is to make this useful to engineers quickly, the fastest path is to stop selling the whole universe and ship one crisp hybrid-execution demo built around signed receipts and runtime-backed task execution.
