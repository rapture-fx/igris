# Executive summary

Audit date: 2026-05-01.

Igris is not yet proven as one unified end-to-end product. The strongest manually proven path is the Rust Runtime by itself: it booted locally with an offline license artifact, served inference against a local mock upstream, accepted signed durable task submissions, emitted signed execution artifacts, and enforced capability-gating on signed task permission envelopes. The control-plane fallback story in Overture is also real: when Runtime forwarding fails, Overture falls back to its own direct router path and still returns a response.

The main break in the unified story is Overture -> Runtime happy-path decoding. Overture did forward work into Runtime, and Runtime did hit the configured upstream provider, but Overture then failed to decode the Runtime task response and fell back to its own mock provider. That makes the "run anywhere as one product" claim only partially proven. Long-horizon checkpoint/recovery, real local GGUF fallback, real external providers, and robotics flows were not proven in this run.

# Environment setup

- Workspace: `/Users/wira/Desktop/system`
- Date/time basis: 2026-05-01 Asia/Makassar
- Runtime binary used: `igris-runtime/target/debug/igris-runtime`
- Overture binary built locally: `/private/tmp/igris-overture-audit`
- Local mock upstream: HTTP server on `127.0.0.1:18090` implementing OpenAI-style `/v1/chat/completions` with SSE
- Runtime endpoint: `http://127.0.0.1:8080`
- Overture endpoint: `http://127.0.0.1:8081`
- Runtime config: `/private/tmp/igris-runtime-audit-config.json5`
- Receipt log used for verification: `/private/tmp/igris-receipts.jsonl`

Notes:

- I had to stop a local `nginx` process to free port `8080`. Runtime binding is effectively fixed to `8080` in `igris-runtime/crates/igris-server/src/main.rs`, which makes local setup brittle.
- Runtime startup required `IGRIS_ALLOW_INSECURE_DEV_MODE=true` plus an offline license artifact generated from the repo's own license-test logic in `igris-runtime/crates/igris-license-client/src/lib.rs`.
- Overture started without a working database and logged that database-backed/dashboard functionality was unavailable.

# Commands run

```bash
GOCACHE=/private/tmp/igris-go-build-cache \
GOPROXY=off GOSUMDB=off GOFLAGS='-mod=readonly -buildvcs=false' \
go build -o /private/tmp/igris-overture-audit ./cmd/igris-overture

cargo test -p igris-license-client \
  validate_license_on_startup_uses_offline_artifact_without_network -- --nocapture

env RUNTIME_MOCK_KEY=dummy \
  IGRIS_ALLOW_INSECURE_DEV_MODE=true \
  IGRIS_CONFIG=/private/tmp/igris-runtime-audit-config.json5 \
  IGRIS_DEVICE_ID=<deterministic-test-device-id> \
  IGRIS_OFFLINE_LICENSE_PATH=/private/tmp/igris-offline-license.json \
  IGRIS_LICENSE_OFFLINE_PUBLIC_KEY=<redacted> \
  IGRIS_OVERTURE_PUBLIC_KEY=<redacted> \
  IGRIS_RECEIPT_LOG=/private/tmp/igris-receipts.jsonl \
  ./igris-runtime/target/debug/igris-runtime serve

env PORT=8081 \
  PROVIDER_MODE=mock \
  IGRIS_RUNTIME_URL=http://127.0.0.1:8080 \
  IGRIS_RUNTIME_TIMEOUT=10s \
  IGRIS_RUNTIME_SECRET=<redacted> \
  IGRIS_OVERTURE_SIGNING_KEY=<redacted> \
  IGRIS_RUNTIME_PUBLIC_KEY=<redacted> \
  /private/tmp/igris-overture-audit

curl http://127.0.0.1:8080/v1/health
curl http://127.0.0.1:8080/v1/chat/completions
curl http://127.0.0.1:8080/v1/runtime/task/submit
curl http://127.0.0.1:8081/v1/infer
```

# Evidence matrix

| Claim | Result | Evidence level | Evidence |
| --- | --- | --- | --- |
| Run AI across cloud and local runtime | Partial | Manually executed + source-confirmed | Runtime directly served inference through configured provider routing and returned a normal chat completion. Signed durable task submission also executed successfully. Overture did call Runtime, and Runtime did call the upstream mock, but Overture then failed to decode Runtime's `status` object and fell back. Source paths: `igris-runtime/crates/igris-server/src/runtime_execute.rs`, `igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-overture/internal/runtime_client.go`. |
| Survive failure | Partial | Manually executed + source-confirmed | Runtime provider-down case returned `503 service_unavailable`; no local fallback executed in this config. Overture runtime-down case did fall back to direct routing and still returned `200`. Source paths: `igris-runtime/crates/igris-server/src/runtime_execute.rs`, `igris-overture/internal/runtime_client.go`. |
| Prove what it did | Partial | Manually executed + source-confirmed | Runtime durable task responses included `execution_envelope` and `execution_receipt`. I independently verified envelope signatures, receipt signatures, receipt hashes, and receipt-chain linkage from `/private/tmp/igris-receipts.jsonl`. Overture's verification/persistence path exists in source, but the happy path was not proven because Overture fell back before completing Runtime result handling. Source paths: `igris-runtime/crates/igris-server/src/receipt.rs`, `igris-runtime/crates/igris-server/src/runtime_execute.rs`, `igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-overture/internal/runtime_client.go`. |
| Support long-horizon execution | Not proven | Source-confirmed only | WAL, checkpoint, resume token, and recovery structures exist, but I did not produce a live checkpointed task and resume it successfully. Source paths: `igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-runtime/crates/igris-wal/src`, `igris-overture/coordinator/checkpoint_store.go`. |
| Support deterministic/governed execution | Partial | Manually executed + source-confirmed | Runtime rejected a task with `required_capabilities` and no permission envelope (`403 missing task permission envelope`). The same shape with a valid signed `task_permission_envelope.v1` succeeded. That proves envelope-gating exists. It does not prove deterministic replay or full robotics/tool governance. Source paths: `igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-overture/api/routes_tasks.go`. |

# Passed tests

- `cargo test -p igris-license-client validate_license_on_startup_uses_offline_artifact_without_network -- --nocapture` passed. This confirms the offline license startup path used by Runtime is covered by repo tests. Source: `igris-runtime/crates/igris-license-client/src/lib.rs`.
- Runtime health check passed with `200 OK` on `/v1/health`. Source: `igris-runtime/crates/igris-server/src/main.rs`.
- Runtime direct inference passed on `/v1/chat/completions` and returned a mock completion after the upstream mock was updated to support SSE. Runtime log showed `winner=local-mock-cloud`. Source: `igris-runtime/crates/igris-server/src/runtime_execute.rs`.
- Runtime durable single-inference task passed on `/v1/runtime/task/submit` with signed `X-Igris-Decision-Sig`. Response included `checkpoint`, `execution_envelope`, and `execution_receipt`. Source: `igris-runtime/crates/igris-server/src/task_executor.rs`.
- Execution envelope verification passed manually against the Runtime signing key. Source: `igris-runtime/crates/igris-server/src/runtime_execute.rs`.
- Execution receipt verification passed manually: receipt hash matched, signature verified, and the last two receipt-log entries formed a valid hash chain. Source: `igris-runtime/crates/igris-server/src/receipt.rs`.
- Capability-gating deny path passed: task with `required_capabilities=["tools.github.issues.write"]` and no permission envelope returned `403`. Source: `igris-runtime/crates/igris-server/src/task_executor.rs`.
- Capability-gating allow path passed: the same required capability with a valid signed `task_permission_envelope.v1` executed successfully. Source: `igris-runtime/crates/igris-server/src/task_executor.rs`.
- Overture runtime-down fallback passed: with Runtime offline, `/v1/infer` returned `200` from Overture's direct router path and logged `Runtime forward failed, falling back to direct routing`. Source: `igris-overture/internal/runtime_client.go`.

# Failed tests

- Unified Overture -> Runtime happy path failed. Overture log: `Runtime forward failed, falling back to direct routing: runtime_client: decode: json: cannot unmarshal object into Go struct field taskSubmitResponse.status of type string`. Root cause is visible in source: Overture expects `status string` in `igris-overture/internal/runtime_client.go`, while Runtime returns a tagged status object in `igris-runtime/crates/igris-server/src/task_executor.rs`.
- Runtime provider-down test failed over to nothing. With the mock provider stopped and `local_fallback.enabled=false` in `/private/tmp/igris-runtime-audit-config.json5`, Runtime returned `503 service_unavailable`. That means local survivability was not proven.
- Real local model fallback was not executed. The audit config deliberately pointed `local_fallback.model_path` at a nonexistent GGUF file, so this path remains unproven even though fallback code exists in `igris-runtime/crates/igris-server/src/runtime_execute.rs`.

# Partially proven claims

- `Run AI across cloud and local runtime`: proven for direct Runtime execution against a configured provider; not proven as one clean Overture -> Runtime -> result path because Overture falls back after decode failure.
- `Survive failure`: proven only for Overture control-plane fallback when Runtime is unavailable; not proven for Runtime surviving provider failure with a local model.
- `Prove what it did`: proven at the Runtime response/log layer; not proven through Overture ingestion, persistence, and downstream API exposure.
- `Support deterministic/governed execution`: proven for signed permission-envelope gating; not proven for deterministic replay, tool action replay, or robotics policy enforcement in a live run.

# Not proven claims

- Long-horizon checkpoint creation, interruption, recovery, and continuation in a live task. Source paths exist in `igris-runtime/crates/igris-server/src/task_executor.rs` and `igris-overture/coordinator/checkpoint_store.go`, but no manual proof was produced.
- Real cloud-provider integrations such as OpenAI or Anthropic. This audit used only local mocks.
- Real local GGUF inference fallback via `llama.cpp`. Source exists under `igris-runtime/llama.cpp` and Runtime routing code, but no local model was installed or exercised.
- Runtime registration/fleet/dashboard/database-backed flows in Overture. Overture started without a working database, so DB-backed behavior was not executed.
- Robotics/ROS2/fleet command execution. Relevant code exists in `igris-runtime/crates/igris-server/src/task_executor.rs` and Overture robotics routes, but none of it was run.

# Screenshots/log excerpts if available

Unified happy-path break:

```text
2026/05/01 18:24:36 [Infer] Runtime forward failed, falling back to direct routing:
runtime_client: decode: json: cannot unmarshal object into Go struct field
taskSubmitResponse.status of type string
```

Runtime-down fallback in Overture:

```text
2026/05/01 18:36:32 [Infer] Runtime forward failed, falling back to direct routing:
runtime_client: http: Post "http://127.0.0.1:8080/v1/runtime/task/submit":
dial tcp 127.0.0.1:8080: connect: connection refused
```

Provider-down behavior in Runtime:

```text
2026-05-01T10:37:38Z WARN speculative:
Provider local-mock-cloud failed to start stream:
tcp connect error: Connection refused (os error 61)
```

Manual artifact verification:

```text
execution_envelope signature: valid
basic execution_receipt: hashMatches=true, sigValid=true
allowed execution_receipt: hashMatches=true, sigValid=true
receipt chain link: valid
```

# Recommended fixes before open source

- Fix the Runtime response decoder mismatch first. Overture's `taskSubmitResponse` in `igris-overture/internal/runtime_client.go` must match Runtime's structured `TaskStatus` in `igris-runtime/crates/igris-server/src/task_executor.rs`.
- Ship one supported local demo script that starts mock upstream, Runtime, and Overture in the right order with sanctioned dev credentials. Right now the boot path is too fragile and depends on `IGRIS_ALLOW_INSECURE_DEV_MODE=true`, a hand-built offline license artifact, and manual port cleanup. Relevant paths: `igris-runtime/crates/igris-license-client/src/lib.rs`, `igris-runtime/crates/igris-server/src/main.rs`.
- Either provide a real local fallback demo model or remove local-fallback claims from the default pitch until it is runnable in one command. Relevant path: `igris-runtime/crates/igris-server/src/runtime_execute.rs`.
- Add one end-to-end integration test that asserts: Overture -> Runtime -> signed receipt -> Overture verification/persistence. Relevant paths: `igris-overture/internal/runtime_client.go`, `igris-runtime/crates/igris-server/src/receipt.rs`.
- Make Runtime honor configured ports cleanly instead of effectively hardcoding `8080`. Relevant path: `igris-runtime/crates/igris-server/src/main.rs`.

# Recommended fixes before commercial positioning

- Prove a real success path for the unified product, not just Runtime in isolation. The current audit shows the control plane can route around Runtime failures, but the first-party Runtime path is still broken at the integration layer.
- Prove provider failure recovery with an actual local model fallback, then automate it. Until that happens, "survive failure" is too broad.
- Prove checkpoint/recovery under deliberate interruption, ideally with kill/restart and persisted WAL replay. Relevant paths: `igris-runtime/crates/igris-server/src/task_executor.rs`, `igris-runtime/crates/igris-wal/src`, `igris-overture/coordinator/checkpoint_store.go`.
- Prove Overture persistence, receipt verification, and task visibility with a real database-backed deployment. Right now the hosted/control-plane story is source-heavy and execution-light.
- Keep robotics out of the unified commercial claim set until there is a reproducible live ROS2/policy run showing governed action execution and recovery.
