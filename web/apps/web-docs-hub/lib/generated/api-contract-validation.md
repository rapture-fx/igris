# API Contract Validation

Generated: 2026-05-01T08:47:28.380Z

This report validates API reference request/response examples and compares documented request body fields against source request schemas when handlers expose a Go request struct or Rust JSON/OpenAPI schema.

| Endpoint | Request fields | Source schema | Schema policy | Response contract | Response fields | Status |
| --- | ---: | --- | --- | --- | ---: | --- |
| `POST /v1/infer` | 5 | `InferRequest (go, igris-overture/models/infer_request.go)` | source-backed | `igris-overture/models/infer_response.go` | 5 | verified |
| `POST /v1/chat/completions` | 4 | `InferRequest (go, igris-overture/models/infer_request.go)` | source-backed | `igris-overture/models/infer_response.go` | 5 | verified |
| `GET /v1/health` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/models` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/providers/stats` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/infer/multimodal` | 0 | not discovered | example-only: The route accepts a multipart/media-flavored inference envelope; docs keep the customer example while source schema extraction is JSON-struct only. | not required | 0 | verified |
| `GET /v1/infer/multimodal/stats` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/runtime/install` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/runtime/checksum` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/runtime/download` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /api/v1/runtime/download` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /api/v1/runtime/register` | 5 | `runtimeInstanceRegisterRequest (go, igris-overture/api/routes_runtime.go)` | source-backed | not required | 0 | verified |
| `POST /api/v1/runtime/heartbeat` | 2 | `runtimeInstanceHeartbeatRequest (go, igris-overture/api/routes_runtime.go)` | source-backed | not required | 0 | verified |
| `GET /api/v1/runtime/commands` | 0 | not discovered | not-required | not required | 0 | verified |
| `DELETE /api/v1/runtime/deregister` | 1 | `runtimeInstanceHeartbeatRequest (go, igris-overture/api/routes_runtime.go)` | not-required | not required | 0 | verified |
| `GET /api/v1/runtime/list` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /api/v1/runtime/config/push` | 2 | not discovered | example-only: Configuration push is an operational control-plane route whose request body is example-backed until a public source schema is promoted. | not required | 0 | example-validated |
| `POST /api/v1/runtime/update` | 4 | not discovered | example-only: Runtime update orchestration is validated procedurally and remains example-backed in the public docs. | not required | 0 | example-validated |
| `GET /api/subscription/status` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /api/subscription/plans` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/account/api-key` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/account/api-key` | 0 | not discovered | example-only: API key creation does not require a JSON body; the endpoint is bodyless and response-focused. | not required | 0 | verified |
| `DELETE /v1/account/api-key` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/vault/keys` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/vault/keys` | 3 | not discovered | example-only: Vault key storage uses handler validation for provider/key payloads; docs carry the current public example until a reusable schema is exported. | not required | 0 | example-validated |
| `GET /v1/vault/keys/:provider` | 0 | not discovered | not-required | not required | 0 | verified |
| `DELETE /v1/vault/keys/:provider` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/vault/keys/:provider/rotate` | 0 | not discovered | example-only: Provider rotation is path-param driven and bodyless in the public contract. | not required | 0 | verified |
| `POST /v1/vault/keys/:provider/validate` | 0 | not discovered | example-only: Provider validation is path-param driven and bodyless in the public contract. | not required | 0 | verified |
| `GET /v1/policy` | 0 | not discovered | not-required | not required | 0 | verified |
| `PUT /v1/policy` | 0 | not discovered | example-only: Policy update accepts a policy document whose structure is governed by the policy engine, not by a small route request struct. | not required | 0 | verified |
| `GET /v1/policy/history` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/history/events` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/receipts` | 0 | not discovered | not-required | `igris-overture/api/routes_receipts.go` | 14 | verified |
| `GET /v1/receipts/:id` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/receipts/export` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /proof/receipts/verify` | 2 | `VerifyReceiptRequest (go, igris-overture/api/routes_proof.go)` | source-backed | `igris-overture/api/routes_proof.go` | 4 | verified |
| `GET /v1/routing/stats` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/routing/recent` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/routing/leaderboard` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/routing/strategy` | 1 | not discovered | example-only: Routing strategy uses a compact handler-validated payload; docs keep an example-backed contract until the route exports a reusable schema. | not required | 0 | example-validated |
| `POST /v1/routing/provider_weights` | 1 | not discovered | example-only: Provider weights are a map-like tuning payload and are validated procedurally by the routing handler. | not required | 0 | example-validated |
| `GET /v1/routing/speculative/status` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/routing/speculative/config` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/routing/speculative` | 2 | not discovered | example-only: Speculative routing accepts an experiment request shape that is still preview and handler-validated. | not required | 0 | example-validated |
| `GET /v1/routing/speculative/analytics` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/routing/speculative/simulate` | 2 | not discovered | example-only: Speculative simulation is preview and example-backed because the handler accepts simulation parameters rather than a stable exported schema. | not required | 0 | example-validated |
| `POST /v1/routing/council` | 2 | not discovered | example-only: Council mode routing is preview and validated in handler code rather than through a stable public request struct. | not required | 0 | example-validated |
| `GET /v1/routing/council/analytics` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/routing/shadow` | 2 | not discovered | example-only: Shadow routing is preview and handler-validated, so docs keep the current example-only shape. | not required | 0 | example-validated |
| `GET /v1/routing/circuit-breaker/status` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/bt/templates` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/bt/definitions` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/bt/definitions/:id` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/bt/definitions` | 0 | not discovered | example-only: Behavior tree definitions are validated by the behavior-tree schema engine rather than a route request struct. | not required | 0 | verified |
| `DELETE /v1/bt/definitions/:id` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/tasks/submit` | 4 | `publicTaskSubmitRequest (go, igris-overture/api/routes_tasks.go)` | source-backed | `igris-overture/api/routes_tasks.go buildTaskAcceptedResponse` | 6 | verified |
| `GET /v1/tasks/:id` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/tasks` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/tasks/:id/steps` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/tasks/:id/cancel` | 0 | not discovered | example-only: Task cancellation is path-param driven and bodyless in the public contract. | not required | 0 | verified |
| `GET /v1/tasks/proof/readiness` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/tasks/:id/proof/verify` | 0 | not discovered | example-only: Task proof verification is path-param driven and reconciles persisted proof state; no JSON body is required. | not required | 0 | verified |
| `POST /v1/mcp` | 4 | not discovered | example-only: MCP transport carries JSON-RPC envelopes whose schema lives in the MCP method contract rather than a route-specific request struct. | not required | 0 | example-validated |
| `POST /v1/mcp/stream` | 4 | not discovered | example-only: MCP streaming carries JSON-RPC envelopes over a streaming transport; method schemas are documented separately from the transport route. | not required | 0 | example-validated |
| `GET /v1/health` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/runtime/profile` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/chat/completions` | 4 | `InferRequest (go, igris-overture/models/infer_request.go)` | source-backed | `igris-overture/models/infer_response.go` | 5 | verified |
| `POST /v1/plan` | 0 | `PlanningRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/reflect` | 0 | `ReflectionRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `GET /v1/admin/models` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/admin/models/load` | 0 | `LoadModelRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/admin/models/swap` | 0 | `SwapModelRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/btree/validate` | 1 | `BTreeValidateRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/btree/run` | 0 | `BTreeRunRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/btree/deploy` | 0 | `BTreeDeployRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `GET /v1/btree/events` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/lora/status` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/memory/status` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/memory/store` | 3 | `MemoryStoreRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/memory/search` | 2 | `MemorySearchRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `GET /v1/memory/:key` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/hitl/status` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/hitl/requests` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/hitl/request` | 2 | `HitlRequestInput (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/hitl/approve` | 1 | `HitlDecisionRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/hitl/reject` | 1 | `HitlDecisionRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `GET /v1/swarm/status` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/swarm/agents` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/swarm/join` | 1 | `SwarmJoinRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/swarm/propose` | 3 | `SwarmProposeRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `POST /v1/swarm/vote` | 2 | `SwarmVoteRequest (rust, igris-runtime/crates/igris-server/src/main.rs)` | source-backed | not required | 0 | verified |
| `GET /v1/federated/status` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/federated/update` | 2 | not discovered | example-only: Federated update payloads are runtime-local and handler-validated by the federated coordinator. | not required | 0 | example-validated |
| `GET /v1/federated/model/latest` | 0 | not discovered | not-required | not required | 0 | verified |
| `GET /v1/federated/participants` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/runtime/execute` | 8 | `ExecuteRequest (rust, igris-runtime/crates/igris-server/src/runtime_execute.rs)` | source-backed | not required | 0 | verified |
| `GET /v1/runtime/violations` | 0 | not discovered | not-required | not required | 0 | verified |
| `POST /v1/runtime/task/submit` | 6 | `TaskSubmitRequest (rust, igris-runtime/crates/igris-server/src/task_executor.rs)` | source-backed | `igris-runtime/crates/igris-server/src/task_executor.rs TaskSubmitResponse` | 4 | verified |
| `POST /v1/runtime/task/stream` | 6 | `TaskSubmitRequest (rust, igris-runtime/crates/igris-server/src/task_executor.rs)` | source-backed | `igris-runtime/crates/igris-server/src/task_executor.rs build_task_result_payload` | 3 | verified |
| `POST /v1/runtime/task/:task_id/cancel` | 0 | not discovered | example-only: Runtime task cancellation is path-param driven and bodyless in the public contract. | `igris-runtime/crates/igris-server/src/task_executor.rs build_task_cancel_response` | 6 | verified |
| `GET /v1/runtime/task/:task_id/wal` | 0 | not discovered | not-required | `igris-runtime/crates/igris-server/src/task_executor.rs handle_task_wal` | 3 | verified |
| `GET /v1/runtime/agent/:id/state` | 0 | not discovered | not-required | not required | 0 | verified |
