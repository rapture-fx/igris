# P0 Fixes Plan

This document tracks the P0 work required before a broad self-serve launch of Igris as a safe AI execution layer for agents and robotics.

## Execution Status

- [x] P0-1: Wire OS-Level Containment Into The Live Execution Path
- [ ] P0-2: Make Offline And Air-Gapped Startup Real
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
- Added per-request supervisor lifecycle cleanup so contained worker processes do not leak.
- Added optional worker binary override support for integration tests and controlled supervisor launches.
- Added process-level memory limits on worker spawn via `setrlimit` on Unix and preserved existing timeout enforcement plus signed violation logging.

### Validation

- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server --test containment_integration -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server security_tests -- --nocapture`

## P0-2: Make Offline And Air-Gapped Startup Real

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

## P0-3: Complete The Receipt And Verification Trust Chain

### Status

Completed on 2026-04-25.

### Completed Work

- Added persistent runtime Ed25519 identity storage in `igris-server`, with first-boot key generation and restart reuse.
- Moved runtime identity loading ahead of startup registration so Overture always receives the real runtime public key.
- Extended the runtime registration client payload to include `public_key_ed25519`.
- Updated Overture runtime registration to require, validate, insert, and refresh the runtime public key on re-registration.
- Tightened Overture runtime verification so missing runtime public keys now produce explicit verification errors instead of silent success.
- Updated runtime selection to bind per-runtime public keys into `RuntimeClient` instances from the registry.
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

### Acceptance Criteria

- A fresh self-serve install is not remotely mutable without auth.
- Unsafe production config fails startup instead of only warning.
- Runtime security defaults are fail-closed.

### Validation

- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-core config::tests -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server security_tests -- --nocapture`
- `cargo test --manifest-path /Users/wira/Desktop/system/igris-runtime/Cargo.toml -p igris-server deployment_security::tests -- --nocapture`

## Launch Gates

Broad self-serve launch remains blocked until:

- P0-1 containment is live and proven by integration tests.
- P0-2 offline startup is implemented or all offline startup claims are removed.
- P0-3 runtime identity and strict verification are complete.
- P0-4 secure-by-default runtime config is shipped.
