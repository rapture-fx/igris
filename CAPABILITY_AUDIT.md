# Igris Capability Audit

Audit date: 2026-05-09.

Scope: `README.md`, `igris-overture`, `cmd/igris-overture`, `igris-runtime`, `rust-core`, `web/apps/web-console`, `web/apps/web-landing`, and `web/apps/web-docs-hub/content/docs`.

Method: greenfield audit from source plus live validation. Existing proof documents were not treated as authority. A capability is marked `proven` only when a live proof script or manually-run end-to-end validation passed during this audit.

## Executive Summary

The current proof-backed product core is narrower and stronger than the repo surface:

- **Run:** a local control-plane-to-runtime execution path passed live using a local mock upstream.
- **Recover:** runtime-level cloud-to-cloud provider fallback passed live; same-host/shared-WAL checkpoint recovery passed live.
- **Verify:** live scripts verified signed execution envelopes and signed receipts for the core proof paths.

Major exposure risks remain:

- Real external provider execution was not run and remains blocked unless sanctioned provider credentials are supplied.
- Local GGUF execution and cloud-to-local fallback have source/tests, but no live end-to-end proof was run.
- Clean-host recovery without a shared WAL store is not proven.
- Robotics, ROS2, swarm, federated, multimodal, behavior trees, routing analytics, fleet workflows, billing, BYOK, SSO, and console advanced pages are implementation or preview surfaces, not homepage claims.
- Several Go test packages are currently red: API, coordinator, security, and router. These failures matter for customer exposure decisions.

## Live Validation Results

| Command | Result | Evidence captured |
|---|---:|---|
| `./scripts/unified_execution_proof_demo.sh` | pass | Proved local mock unified execution. Returned `provider=local-mock-cloud`, `route_decision=forwarded_to_runtime_task`, receipt `019e0b9e-3fd0-76f0-8e77-a64bf356fb27`, artifacts in `/var/.../igris-unified-proof.XkNwRD`. |
| `./scripts/fallback_execution_proof_demo.sh` | pass | Proved runtime cloud-to-cloud fallback. Dead primary `mock-primary-fail`, winner `mock-fallback`, envelope `routing_decision=mock-fallback`, receipt/envelope verified, artifacts in `/var/.../igris-fallback-proof.CYLLa0`. |
| `./scripts/checkpoint_proof_demo.sh` | pass | Proved same-host/shared-WAL checkpoint recovery. Task `636a0e5f-b1e9-4138-92e1-534b2539ed15`, 8 persisted steps, runtime split `checkpoint-runtime-1` then `checkpoint-runtime-2`, `wal_checkpoints` rows `2`, proof receipt verify HTTP `200`, task proof verify HTTP `200`. |
| `go test ./igris-overture/internal ./cmd/igris-overture/handlers ...` with `GOCACHE=/private/tmp/...` | fail | `internal`, `cmd/igris-overture/handlers`, `billing`, and `policy` passed. `api`, `coordinator`, `security`, and `router` failed. Details below. |
| `cargo test ... -p igris-routing -p igris-wal -p igris-local-llm -p igris-multimodal -p igris-ros2 -p igris-swarm -p igris-federated --no-default-features` | pass | Runtime implementation crates passed unit/doc tests. This is implementation evidence, not end-to-end product proof. |
| `cargo test ... -p igris-btree --no-default-features` | fail | 64 passed, 2 failed: `visualizer::alerts::tests::test_alert_cooldown`, `test_alert_creation`, due macOS `system-configuration` null object / poisoned lazy. |
| `cargo test ... -p igris-server agent_workflow_checkpoint_after_steps -- --nocapture` | pass | 2 runtime checkpoint trigger tests passed. |
| `pnpm --filter @igris-inertial/web-console exec tsc --noEmit` | pass | Console typecheck passed. |
| `pnpm --filter @igris/web-docs-hub exec tsc --noEmit` | pass | Docs typecheck passed. |
| `pnpm --filter @igris/web-docs-hub build` | incomplete | Docs generators/validators passed before Next build. Generated report: 103 API endpoints, 15 test-covered, 13 client-referenced, 75 implemented-unverified. Build was terminated after long quiet Next build phase, so full build is not a pass. |

### Test Failures That Affect Exposure

| Area | Current failure | Product risk |
|---|---|---|
| API | `TestReplayRoboticsReceiptsRouteVerifiesRuntimeSignatureWithPublicKey` and `TestHILRoboticsStopAndCancelEvidenceExportsThroughAuditBundle` fail with runtime signature/audit evidence issues. | Robotics proof/audit routes should not be customer-marketed. |
| API | `TestGetRunDetailSupportsInferenceRecordWithoutTaskID` fails: `sql: expected 33 destination arguments in Scan, not 34`, HTTP `500` instead of `200`. | Run detail is contract-fragile despite live proof paths working. |
| Coordinator | `TestVerifyExecutionArtifactsForTaskUsesRuntimeRegistryKey` fails with `execution_receipt hash mismatch`. | Receipt verification path has fixture/contract risk outside live happy-path scripts. |
| Coordinator | `TestReplayRoboticsAuditReconstructsPolicyActionAndRuntimeReceipt` fails with runtime signature invalid. | Robotics replay/audit should be hidden. |
| Security | runtime registry/heartbeat/unregister tests fail because registration signature is now required. | Runtime identity registration tests are stale or enforcement changed without test update. |
| Router | router package test build fails: stale council/speculative tests call old provider registry APIs and redeclare types. | Routing internals are not stable enough for core exposure. |
| Behavior trees | visualizer alert tests fail. | Behavior-tree monitoring should stay advanced/internal. |

## Status Vocabulary

| Status | Meaning |
|---|---|
| proven | Passed a live end-to-end proof script or manually-run product validation in this audit. |
| partially_proven | A live path passed, but important limits or failing related tests remain. |
| implemented_not_proven | Source and/or unit tests exist, but no live product proof passed in this audit. |
| stub_or_mock | Default or material behavior is placeholder, fake, mock-only, simulation-only, or synthetic. |
| blocked | Could not validate because credentials, environment, or external dependency was missing. |
| stale | Source/docs/UI/tests claim or assume more than current implementation/proof supports. |
| unknown | Evidence was not found. |

## Capability Matrix

| Capability | Status | Category | Exposure | Current evidence |
|---|---:|---|---|---|
| Unified local Request -> Execute -> Verify | proven | Run | homepage | Live `./scripts/unified_execution_proof_demo.sh` passed. Source: `cmd/igris-overture/handlers/infer.go`, `igris-overture/internal/runtime_client.go`, `igris-runtime/crates/igris-server/src/task_executor.rs`. |
| Runtime-backed inference route decision | proven | Run | homepage | Live unified proof returned `route_decision=forwarded_to_runtime_task`; script fails if Overture falls back away from Runtime. |
| Durable task APIs | proven | Run | core docs | Live checkpoint proof used `POST /v1/tasks/submit`, `GET /v1/tasks/:id`, `GET /v1/tasks/:id/steps`, task proof verify. Source: `igris-overture/api/routes_tasks.go`. |
| Execution run APIs | partially_proven | Run | core docs | Live proof scripts used run/receipt visibility where applicable, but `TestGetRunDetailSupportsInferenceRecordWithoutTaskID` currently fails in `igris-overture/api`. |
| Runtime identity in evidence | proven | Verify | homepage | Live unified/fallback/checkpoint proofs returned runtime identity fields and verified runtime-signed artifacts. |
| Signed execution envelope | proven | Verify | homepage | Live unified and fallback scripts verified envelope signatures from runtime key. Source: `igris-runtime/crates/igris-server/src/runtime_execute.rs`. |
| Signed execution receipt | proven | Verify | homepage | Live unified and fallback scripts verified receipts. Source: `igris-runtime/crates/igris-server/src/receipt.rs`. |
| Receipt hash and receipt-log chain | proven | Verify | core docs | Live unified/fallback helper verification passed against receipt log. |
| Hosted proof receipt API | partially_proven | Verify | core docs | Live checkpoint proof got `/proof/receipts/verify` HTTP `200`; source `igris-overture/api/routes_proof.go` compares stored hash/signature values rather than doing full fresh cryptographic verification. |
| Receipt export / evidence export | implemented_not_proven | Verify | advanced docs | API docs/source exist, but no live export proof was run. |
| Timelines / history events | implemented_not_proven | Verify | advanced docs | Source/UI exist; console audit found schema thinner than UI taxonomy. No live proof. |
| Violations / containment records | partially_proven | Verify | advanced docs | Runtime structures and proof routes exist; API/robotics audit tests fail and console violations page is contract-fragile. |
| Capability-gated task execution | implemented_not_proven | Run | core docs | Source exists in `task_executor.rs` and older manual evidence exists, but this greenfield pass did not run a live capability-envelope proof. |
| Policy bounds/capabilities | implemented_not_proven | Run | advanced docs | Source and console pages exist; `igris-overture/policy` tests passed, but no live policy enforcement proof ran. |
| BYOK / vault / provider credentials | implemented_not_proven | Operate | advanced docs | Source exists in `igris-overture/api/routes_key_vault.go`, `routes_ai_credentials.go`, `security/key_vault.go`; no live BYOK proof. |
| Hosted/local/hybrid deployment | partially_proven | Deployment | core docs | Live proofs start Overture + Runtime locally with mock provider; no hosted or real-provider deployment proof ran. |
| Provider fallback, cloud-to-cloud | proven | Recover | homepage | Live fallback proof passed: dead primary, fallback winner, signed envelope `routing_decision=mock-fallback`. |
| Control-plane fallback when runtime unavailable | implemented_not_proven | Recover | advanced docs | Source exists and handler tests passed, but this audit did not run a live runtime-down fallback proof. |
| Local GGUF model execution | implemented_not_proven | Deployment | private demo only | `igris-local-llm` unit tests passed; tests include missing-model failure and config behavior, not live GGUF inference. |
| Cloud-to-local / local fallback | implemented_not_proven | Recover | private demo only | Source exists; no live cloud-to-local fallback proof ran. |
| Checkpoint recovery, same host/shared WAL | proven | Recover | homepage | Live checkpoint proof passed with 8 persisted steps and two WAL checkpoint rows. |
| Clean-host recovery without shared WAL | blocked | Future | hide | Not exercised; current proof script explicitly uses same-host shared WAL store. |
| WAL resume/no duplicate steps | proven | Recover | core docs | Live checkpoint proof showed step 0 on runtime 1 and steps 1-7 on runtime 2. `igris-wal` tests passed. |
| Routing modes: thompson/speculative/council | implemented_not_proven | Run | advanced docs | `igris-routing` Rust tests passed, but Overture router package tests fail to build. No live customer routing-mode proof beyond fallback. |
| Thompson Sampling routing | implemented_not_proven | Run | advanced docs | Rust routing tests passed; Overture routing tests are stale/failing; no live product proof. |
| Speculative routing | partially_proven | Recover | advanced docs | Live fallback proof uses ranked speculative router; broader mid-stream/council behavior not product-proven. |
| Semantic routing | implemented_not_proven | Run | advanced docs | Source exists in `igris-overture/semantic` and `router/semantic_router.go`; no live proof. |
| Real external provider execution | blocked | Run | private demo only | Not run; requires sanctioned non-empty provider credential. |
| Behavior trees | implemented_not_proven | Future | advanced docs | Most BT tests passed, but visualizer alert tests failed; no live product proof. |
| Fleet registration/heartbeat/runtime lifecycle | implemented_not_proven | Operate | advanced docs | Source exists; security runtime registry tests currently fail due signature requirements. Checkpoint proof registered runtimes for one controlled flow only. |
| Fleet failover | unknown | Future | hide | No live multi-runtime fleet failover proof beyond same-host checkpoint redispatch. |
| Config push / OTA commands | stale | Future | hide | Docs/API surfaces exist; runtime source logs say live config apply and self-update orchestration are not implemented in `igris-runtime/crates/igris-server/src/main.rs`. |
| ROS2 integration | stub_or_mock | Future | private demo only | `igris-ros2` tests passed in no-default/simulation path; real ROS2 feature/hardware path was not run. |
| Robotics execution/replay | stale | Future | hide | Source exists, but API/coordinator robotics receipt/audit tests fail. |
| Swarm | implemented_not_proven | Future | hide | `igris-swarm` unit/doc tests passed; no live product proof and console swarm has synthetic fallback. |
| Federated | implemented_not_proven | Future | hide | `igris-federated` unit/doc tests passed; no live product proof. |
| Multimodal | stub_or_mock | Future | hide | `igris-multimodal` tests passed stub paths (`describe_image_stub`, `transcribe_audio_stub`). |
| Billing/subscription/tier gating | implemented_not_proven | Operate | advanced docs | `igris-overture/billing` tests passed; no live subscription/payment proof. |
| Cost accounting/usage | implemented_not_proven | Operate | advanced docs | Source/tests exist; no live product proof. |
| SSO/auth | stub_or_mock | Operate | internal only | Console auth is bypassed in dev; SSO middleware has TODO state validation; no live SSO proof. |
| Audit logs/history | implemented_not_proven | Verify | advanced docs | Source/UI exist; no live audit-log richness proof. |
| Console core pages | partially_proven | Operate | core docs | TypeScript passed; console still has known API contract fragility. No browser/e2e console validation was run. |
| Console advanced pages | stub_or_mock | Hide | internal only | Existing source includes mock-data fallback and page-local synthetic fallback for advanced areas. |
| SDKs | partially_proven | Run | advanced docs | Docs build validators compiled 9 generated SDK examples and checked 10 snippets; no live SDK-to-service proof. |
| Rate limiting | implemented_not_proven | Operate | advanced docs | Source/docs exist; no live rate-limit proof. |
| SLO enforcer / rust-core | stub_or_mock | Hide | internal only | Source includes mock/stub integration paths; no live product proof. |

## Proven Capabilities

- Run: local unified execution through control plane and runtime with mock upstream.
- Run: durable task submission in the checkpoint recovery flow.
- Recover: cloud-to-cloud fallback inside runtime speculative routing.
- Recover: same-host/shared-WAL checkpoint recovery with no duplicate step replay.
- Verify: signed envelopes, signed receipts, receipt hashes, receipt-log linkage, runtime identity evidence in live scripts.

## Partially Proven Capabilities

- Execution run and proof APIs: live paths worked, but focused API tests expose run-detail and robotics/audit failures.
- Hosted/local/hybrid deployment: live local composition works; hosted and real-provider paths were not proven.
- Speculative routing: proven only for ranked cloud-to-cloud fallback.
- Console core: typechecks, but not browser-validated and some backend contracts are red.
- SDKs: snippets compile, but no live service proof.

## Implemented But Not Proven

- BYOK/key vault.
- Broad policy enforcement.
- Semantic routing.
- Local GGUF inference and cloud-to-local fallback.
- Behavior-tree product workflows.
- Fleet lifecycle beyond controlled proof registration.
- Billing, cost, subscription, rate limits.
- History/audit-log richness.
- Swarm and federated workflows.

## Stub/Mock-Heavy Capabilities

- Multimodal default behavior.
- ROS2 without real feature/hardware environment.
- Console auth/dev mock session.
- Console advanced page fallback data.
- SLO action executor/no-cgo paths.

## Blocked Capabilities

- Real-provider execution: requires sanctioned provider credentials and network access.
- Clean-host recovery: requires a proof design that does not reuse the same runtime WAL store.
- Production ROS2/robotics: requires ROS2 environment/hardware or a sanctioned simulator proof.

## Stale Or Risky Claims Found

| File | Risky copy | Reason |
|---|---|---|
| `web/apps/web-landing/app/layout.tsx` | "Deploy AI anywhere with a 16MB binary... Works offline..." | Binary size/offline/local execution claims were not live-proven. |
| `web/apps/web-landing/app/runtime/page.tsx` | "Run any GGUF model locally"; "100% offline operation"; "Over-the-air model updates"; "No setup required" | Local GGUF and OTA/config push were not live-proven; runtime code says live config/self-update are not implemented. |
| `web/apps/web-landing/src/components/popups/RuntimePopup.tsx` | "Run any GGUF model locally"; "Network outages don't stop execution"; "Over-the-air model updates" | Overstates local fallback and OTA readiness. |
| `web/apps/web-landing/src/components/popups/UseCasesPopup.tsx` | "Works offline indefinitely"; "Sub-millisecond inference"; "Fleet-wide model deployment" | Broad edge/robotics claims exceed live proof. |
| `web/apps/web-landing/src/components/AIAgentView.tsx` | "offline: true (local execution when cloud fails)"; "Cloud + local fallback"; "Every update is signed" | Cloud-to-local fallback and update verification were not proven. |
| `web/apps/web-landing/public/architecture.mmd` | "Runtime -> Offline/Fallback -> Local Inference" | Implies cloud-to-local fallback is proven. It is not. |
| `web/apps/web-docs-hub/content/docs/agents.mdx` | "All run inside the execution envelope with full governance applied"; "Any instance in the swarm can continue an execution that another instance started" | Swarm and cross-instance recovery are not live-proven. |
| `igris-runtime/crates/igris-btree/IMPLEMENTATION_STATUS.md` | "production-ready" BT claims | BT product workflow was not live-proven and BT visualizer alert tests fail. |
| `igris-runtime/crates/overture-server/ADVANCED_FEATURES.md` | "production-ready" fleet/BT monitoring claims | Internal monitoring docs overstate customer readiness. |

## Recommended Exposure Model

| Exposure | Capabilities |
|---|---|
| homepage | Local verified execution, signed envelopes/receipts, runtime identity evidence, cloud-to-cloud fallback, same-host/shared-WAL checkpoint recovery. Use explicit proof boundaries. |
| core docs | First verified run, durable tasks, receipts, fallback proof, checkpoint proof, proof API caveats, deployment modes with proof labels. |
| advanced docs | BYOK, policy, routing internals, lifecycle, billing/cost/rate limits, SDKs, history APIs, local runtime APIs. |
| private demo only | Real-provider execution, local GGUF execution/fallback, ROS2/robotics controlled demos. |
| internal only | Console advanced mock-heavy pages, OTA/config push, broad fleet orchestration, SLO enforcer, BT monitoring until tests/proofs are green. |
| hide | Multimodal broad claims, swarm/federated public claims, clean-host recovery, production robotics, cloud-to-local fallback as a general claim. |
| deprecate | Any two-product framing that exposes internal implementation names as separate customer product categories. |

## Recommended Next Engineering Priorities

1. Fix red API/coordinator proof tests.
   - Strengthens: Verify.
   - Claim protected: "Receipts and replay evidence verify correctly."

2. Add full cryptographic verification to hosted proof APIs.
   - Strengthens: Verify.
   - Claim protected: "Verify does not rely on stored-value comparison."

3. Prove real-provider unified execution.
   - Strengthens: Run and Verify.
   - Claim protected: "Igris verifies real AI task execution, not just local mocks."

4. Build a local GGUF/cloud-to-local fallback proof.
   - Strengthens: Recover.
   - Claim protected: "Recover can continue through local execution when cloud providers fail."

5. Harden console Run/Recover/Verify contracts and add browser validation.
   - Strengthens: Operate.
   - Claim protected: "Operators can inspect runs, receipts, tasks, checkpoints, and violations without mock ambiguity."

## Known Limitations

- This audit ran focused tests and live proof scripts, not every package in the monorepo.
- Real provider proof was not attempted because no sanctioned credential was provided in this task.
- Docs build was interrupted after generators/validators/search-index generation and before a full Next build result.
- Existing proof docs remain useful historical context, but this audit's statuses are based on live commands and source inspection from this pass.
