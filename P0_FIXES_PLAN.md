# P0 Fixes Plan

This document tracks the P0 work required before a broad self-serve launch of Igris as a safe AI execution layer for agents and robotics.

## Execution Status

- [x] P0-1: Wire OS-Level Containment Into The Live Execution Path
- [x] P0-2: Make Offline And Air-Gapped Startup Real
- [x] P0-3: Complete The Receipt And Verification Trust Chain
- [x] P0-4: Make The Runtime Secure By Default For Self-Serve

## P0-1: Wire OS-Level Containment Into The Live Execution Path

### Status

Completed on 2026-04-25.

### Problem

The current runtime request path uses Tokio timeout enforcement, but does not yet run execution through the worker-supervisor containment path claimed by the product.

### Scope

- Wire `--worker` handling into `igris-server` startup.
- Integrate `igris-safety::ContainmentGuard` into live runtime execution.
- Replace timeout-only enforcement in `/v1/runtime/execute`.
- Extend containment coverage beyond single inference into agent and robotics execution paths where applicable.
- Ensure signed, hash-chained violation logging occurs on termination.

### Target Files

- `igris-runtime/crates/igris-server/src/main.rs`
- `igris-runtime/crates/igris-server/src/runtime_execute.rs`
- `igris-runtime/crates/igris-server/src/task_executor.rs`
- `igris-runtime/crates/igris-safety/src/worker.rs`
- `igris-runtime/crates/igris-safety/src/supervisor.rs`
- `igris-runtime/crates/igris-safety/src/guard.rs`

### Acceptance Criteria

- A hung or malicious execution is terminated by the supervisor, not only timed out in-process.
- A signed violation record is written after enforcement.
- The runtime can truthfully claim worker-isolated execution.

### Completed Work

- Wired `igris-runtime --worker` into the binary before normal CLI parsing so supervisor-spawned workers execute jobs instead of trying to boot the server.
- Added worker job execution support in the runtime binary, including test-only stub jobs used to validate supervisor behavior.
- Replaced the timeout-only `/v1/runtime/execute` path with `igris-safety::ContainmentGuard`.
- Extended the same supervisor-backed worker path into durable non-stream agent task execution so `POST /v1/runtime/task/submit` no longer falls back to an in-process timeout for agent routing.
- Extended the same supervisor-backed path into task streaming so agent task streams no longer bypass containment; stream chunks are now emitted from the contained result rather than an in-process provider stream.
- Moved routing selection for contained executions into the parent runtime and pass an explicit worker route plan so Thompson rewards and council chair selection stay consistent with live runtime state instead of being rebuilt per worker invocation.
- Added a shared containment violation bus to runtime execution and ROS2 integration so worker violations and robotics safety violations drive the same deterministic safe-idle / halt path.
- Added a hard timeout wrapper around every robotics action step with best-effort navigation cancel and zero-velocity fallback before emitting a signed violation record.
- Added per-request supervisor lifecycle cleanup so contained worker processes do not leak.
- Added optional worker binary override support for integration tests and controlled supervisor launches.
- Added process-level memory limits on worker spawn via `setrlimit` on Unix and preserved existing timeout enforcement plus signed violation logging.

### Validation

- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server --test containment_integration -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server security_tests -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server runtime_task_submit_rejects_resume_when_digest_matches_but_step_differs -- --nocapture`
- `cargo check --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server --features robotics-platform`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server --features robotics-platform runtime_task_signed_ros2_timeout_emits_failure_audit_artifacts -- --nocapture`

## P0-2: Make Offline And Air-Gapped Startup Real

### Status

Completed on 2026-04-25.

### Problem

Current startup requires successful online license validation, which contradicts offline and air-gapped positioning.

### Scope

- Add offline license artifact support with signed validation.
- Allow runtime startup from either:
  - live online validation, or
  - valid cached or signed offline license artifact.
- Keep fleet registration and heartbeat optional when offline.
- Surface explicit runtime licensing state.

### Target Files

- `igris-runtime/crates/igris-server/src/main.rs`
- `igris-runtime/crates/igris-license-client/src/lib.rs`

### Acceptance Criteria

- Runtime can cold-start without network using a valid offline license artifact.
- No live network round-trip is required for air-gapped startup.
- Product claims can be aligned to the actual implemented mode.

### Completed Work

- Added signed offline license artifact issuance to the Overture license validation flow using the existing `IGRIS_OVERTURE_SIGNING_KEY` Ed25519 trust anchor.
- Extended the license validation response schema to return `offline_artifact`, `offline_artifact_key_id`, and `offline_artifact_expires_at`.
- Added runtime-side offline artifact verification with Ed25519 signature checking, device binding, license key binding, artifact expiry validation, and explicit startup mode reporting.
- Added automatic offline artifact caching at `IGRIS_OFFLINE_LICENSE_PATH` or `.igris/offline-license.json` after successful online validation.
- Changed runtime device identity from a recomputed `MAC + hostname` fingerprint to a persisted install identity at `IGRIS_DEVICE_ID_PATH` or `.igris/device-id`, with backward-compatible seeding from the legacy fingerprint on first boot.
- Changed runtime startup so it accepts either:
  - successful online validation, or
  - a valid cached offline artifact verified with `IGRIS_LICENSE_OFFLINE_PUBLIC_KEY` or `IGRIS_OVERTURE_PUBLIC_KEY`.
- Restricted license heartbeat and Overture fleet registration to `licensed_online` mode only, and surfaced runtime license state in `/v1/runtime/profile`.

### Validation

- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-license-client -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server security_tests -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server runtime_task_submit_rejects_resume_when_digest_matches_but_step_differs -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server --test containment_integration -- --nocapture`
- `/bin/zsh -lc 'CGO_ENABLED=0 GOCACHE=/tmp/igris-gocache-p0 go test ./igris-overture/api/routes_license.go ./igris-overture/api/routes_license_offline_test.go -run "TestBuildOfflineLicenseArtifact" -count=1'`

## P0-3: Complete The Receipt And Verification Trust Chain

### Status

Completed on 2026-04-25.

### Completed Work

- Added persistent runtime Ed25519 identity storage in `igris-server`, with first-boot key generation and restart reuse.
- Moved runtime identity loading ahead of startup registration so Overture always receives the real runtime public key.
- Extended the runtime registration client payload to include `public_key_ed25519`.
- Extended runtime registration, heartbeat, and deregistration so each request is signed by the runtime Ed25519 key with replay-window timestamp validation.
- Updated Overture runtime registration to require, validate, insert, and refresh the runtime public key on re-registration, and to reject machine key mismatches.
- Tightened Overture runtime verification so missing runtime public keys now produce explicit verification errors instead of silent success.
- Updated runtime selection to bind per-runtime public keys into `RuntimeClient` instances from the registry.
- Changed coordinator-side artifact verification to load the runtime-specific public key from `runtime_instances` and verify execution artifacts against that key instead of an environment fallback.
- Added API-visible runtime signature verification status values:
  - `verified`
  - `unverified_missing_key`
  - `verification_failed`

### Acceptance Criteria

- The same runtime instance keeps the same public key across restarts.
- Overture has the runtime public key before treating proof as verified.
- Verification is not silently skipped in the self-serve happy path.

### Validation

- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server load_or_create_runtime_identity -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server security_tests -- --nocapture`
- `/bin/zsh -lc 'GOCACHE=/tmp/igris-gocache-p0 go test ./igris-overture/internal -run "TestVerifyExecutionArtifactsRawRejectsUnsignedReceiptWhenPublicKeyConfigured|TestVerifyExecutionArtifactsRawWithPublicKeyRejectsMissingKey|TestRuntimeClientCancelTaskAcceptsConflictResponse" -count=1'`
- `/bin/zsh -lc 'GOCACHE=/tmp/igris-gocache-p0 go test ./igris-overture/coordinator -run "TestReplayRoboticsAuditReconstructsPolicyActionAndRuntimeReceipt|TestCheckpointStoreReplayRoboticsAudit|TestCheckpointStoreReplayAIToolAudit" -count=1'`
- `/bin/zsh -lc 'GOCACHE=/tmp/igris-gocache-p0 go test ./igris-overture/api -run "^$" -count=1'`
  - The package reached a pre-existing linker failure for missing native `rust-core` libraries; Go compilation completed before link.
- `GOCACHE=/tmp/igris-gocache-runtime-route2 go test ./igris-overture/api -run 'TestRuntimeRegisterPersistsVerifiedPublicKey|TestRuntimeHeartbeatRejectsInvalidSignature' -count=1`
- `GOCACHE=/tmp/igris-gocache-coordinator go test ./igris-overture/coordinator -run 'TestVerifyExecutionArtifactsForTaskUsesRuntimeRegistryKey' -count=1`

## P0-4: Make The Runtime Secure By Default For Self-Serve

### Status

Completed on 2026-04-25.

### Completed Work

- Changed runtime auth defaults to fail closed and require a real auth method.
- Added secure boot validation for self-serve mode with an explicit `IGRIS_ALLOW_INSECURE_DEV_MODE=true` escape hatch for local development only.
- Added `IGRIS_ENABLE_RUNTIME_SUBMISSION_API=false` so non-Overture installs can disable submission endpoints instead of running them unverifiable.
- Required `IGRIS_OVERTURE_PUBLIC_KEY` whenever runtime submission endpoints are enabled.
- Narrowed public middleware exceptions to health, metrics, runtime profile, and API docs only.
- Made runtime submission requests fail closed when decision-signature verification is unavailable.
- Updated shipped `igris-runtime/config.json5` to use auth-enabled defaults and nonzero rate limits.
- Added runtime-wide safe-idle admission checks so planning, reflection, chat completion, runtime execution, durable task submission, and durable task streaming reject new work while robotics safety idle is active.
- Changed runtime task capability enforcement to fail closed when derived capabilities are present but no signed permission envelope is supplied.
- Added automatic capability derivation for tool, memory, human-approval, robotics, and behavior-tree execution at Overture submit-time and runtime validation-time.

### Acceptance Criteria

- A fresh self-serve install is not remotely mutable without auth.
- Unsafe production config fails startup instead of only warning.
- Runtime security defaults are fail-closed.

### Validation

- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-core config::tests -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server security_tests -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server deployment_security::tests -- --nocapture`
- `CARGO_TARGET_DIR=/tmp/igris-runtime-target-fix cargo test --manifest-path igris-runtime/Cargo.toml -p igris-server validates_signed_task_permission_envelope_for_required_capability -- --nocapture`
- `CARGO_TARGET_DIR=/tmp/igris-runtime-target-fix cargo test --manifest-path igris-runtime/Cargo.toml -p igris-server permission_guard_blocks_disallowed_tool_before_execution -- --nocapture`
- `CARGO_TARGET_DIR=/tmp/igris-runtime-target-fix cargo test --manifest-path igris-runtime/Cargo.toml -p igris-server permission_validation_rejects_missing_envelope_for_tool_capability -- --nocapture`
- `CARGO_TARGET_DIR=/tmp/igris-runtime-target-fix cargo test --manifest-path igris-runtime/Cargo.toml -p igris-server single_inference_memory_and_approval_require_permission_envelope -- --nocapture`
- `GOCACHE=/tmp/igris-gocache-api-full2 go test ./igris-overture/api ./igris-overture/coordinator ./igris-overture/slo -count=1`

## 2026-04-26 Hardening Follow-Up

- Tightened the fleet trust path so Overture runtime registry calls are proof-of-possession signed by the runtime key, not just tenant API-key authenticated.
- Bound execution-artifact verification to the registered runtime public key during coordinator dispatch handling.
- Aligned governed runtime identity across Overture and the runtime by using the Overture-assigned registry `runtime_id` for permission-envelope and signed-policy validation instead of reusing MCP `swarm_peer_id`.
- Hardened `GET /api/v1/runtime/commands` so pending-command retrieval also requires a signed runtime proof-of-possession request.
- Added a signed runtime command fetch client to `igris-license-client` and wired a background command-poll loop into `igris-server` after successful Overture registration.
- Added a local runtime command spool and dead-letter journal so fetched control-plane commands are durably persisted before execution and are not silently lost on runtime crash or unsupported-command handling.
- Added guarded runtime-side command handling for `ros_publish` with explicit fail-safe rejection/dead-letter behavior for unsupported `ros_lifecycle`, `config_push`, `ota_update`, and unknown command types.
- Moved task capability derivation to submit-time persistence so recovery redispatch reuses the stored governance contract instead of recomputing policy on every retry.
- Persisted signed task permission envelopes at submit-time before asynchronous dispatch so governed tasks keep their original admission contract even if Overture crashes before first dispatch.
- Narrowed permission-envelope hydration to the recovery path and only when signed governance is active, so recovery redispatch reuses the original envelope without adding extra control-plane reads to unrelated task APIs.
- Added legacy/external task-record fallback derivation when Overture signing is available so pre-migration recoveries do not bypass the default-deny capability model.
- Surfaced SLO native vs stub mode in the admin status API and changed the stub implementation to return an explicit unavailable error instead of silently reporting compliance.

### Additional Validation

- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-license-client -- --nocapture`
- `CARGO_TARGET_DIR=/tmp/igris-runtime-target-review2 cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server middleware::security_tests -- --nocapture`
- `CARGO_TARGET_DIR=/tmp/igris-runtime-target-robotics cargo check --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server --features robotics-platform`

## Launch Gates

P0 engineering blockers in this document are implemented in code and validated by targeted tests.

Broad self-serve launch should still wait for:

- full regression coverage across runtime task submission, ROS2/robotics paths, and Overture control-plane integration in a production-like environment
- a fresh launch-readiness review against the updated implementation, install flow, and operational guarantees
