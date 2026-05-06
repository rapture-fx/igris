# Root cause confirmed

The unified Overture -> Runtime happy path was failing because Overture decoded the Runtime durable task response as if `status` were a plain string.

- Runtime source of truth: [igris-runtime/crates/igris-server/src/task_executor.rs](/Users/wira/Desktop/system/igris-runtime/crates/igris-server/src/task_executor.rs)
  - `TaskSubmitResponse.status` is a tagged serde object via `TaskStatus`.
  - Actual serde shape is:
    - `{"status":"completed"}`
    - `{"status":"checkpointed","resume_token":{...}}`
    - `{"status":"failed","reason":"..."}`
- Broken Overture assumption before fix: [igris-overture/internal/runtime_client.go](/Users/wira/Desktop/system/igris-overture/internal/runtime_client.go)
  - `taskSubmitResponse.Status string`

This mismatch produced the observed error:

```text
runtime_client: decode: json: cannot unmarshal object into Go struct field
taskSubmitResponse.status of type string
```

# Files changed

- [igris-overture/internal/runtime_client.go](/Users/wira/Desktop/system/igris-overture/internal/runtime_client.go)
- [igris-overture/internal/runtime_client_test.go](/Users/wira/Desktop/system/igris-overture/internal/runtime_client_test.go)
- [igris-overture/internal/runtime_selector_test.go](/Users/wira/Desktop/system/igris-overture/internal/runtime_selector_test.go)
- [igris-overture/models/runtime_task_error.go](/Users/wira/Desktop/system/igris-overture/models/runtime_task_error.go)
- [cmd/igris-overture/handlers/infer.go](/Users/wira/Desktop/system/cmd/igris-overture/handlers/infer.go)
- [cmd/igris-overture/handlers/infer_stream_test.go](/Users/wira/Desktop/system/cmd/igris-overture/handlers/infer_stream_test.go)
- [scripts/unified_execution_demo_helper.js](/Users/wira/Desktop/system/scripts/unified_execution_demo_helper.js)
- [scripts/unified_execution_proof_demo.sh](/Users/wira/Desktop/system/scripts/unified_execution_proof_demo.sh)

# Runtime response shape

Confirmed from Rust structs and from a live Runtime response.

- `task_id: string`
- `steps_completed: u32`
- `steps_total: u32`
- `status: object|string`
  - Runtime emits an object today from `TaskStatus`.
  - Overture now accepts both object and legacy string forms for backward compatibility.
- `checkpoint: object|null`
  - Present when Runtime returns checkpoint material.
- `final_output: string|null`
- `usage: {prompt_tokens, completion_tokens, total_tokens}|null`
- `failure_details: object|null`
- `execution_envelope: signed object|null`
- `execution_receipt: signed object|null`

Source paths:

- [igris-runtime/crates/igris-server/src/task_executor.rs](/Users/wira/Desktop/system/igris-runtime/crates/igris-server/src/task_executor.rs)
- Live proof response captured by demo: `/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-unified-proof.aefdwk/overture-response.json`

# Overture decoder changes

- Overture now decodes `status` through a structured `taskSubmitStatus` type instead of a plain string.
- Overture now keeps `checkpoint` and `failure_details` in the decoded task response.
- Overture now treats a Runtime request that reached Runtime but did not complete as a structured `RuntimeTaskError`, not a generic fallback trigger.
- `/v1/infer` now hard-fails on `RuntimeTaskError` instead of silently routing to Overture mock providers.
- Receipt verification was corrected to match the Rust receipt canonicalization in [igris-runtime/crates/igris-server/src/receipt.rs](/Users/wira/Desktop/system/igris-runtime/crates/igris-server/src/receipt.rs):
  - exclude `hash` and `signature` from the signed payload
  - stringify numeric and boolean receipt fields before hashing
  - compare the recomputed digest to `execution_receipt.hash`

Net effect:

- Overture no longer falls back when Runtime actually succeeded.
- Overture can now accept Runtime success responses and attach verified `execution_envelope`, `execution_receipt`, and stable `receipt` references to the final API response.

# Regression tests added

- [igris-overture/internal/runtime_client_test.go](/Users/wira/Desktop/system/igris-overture/internal/runtime_client_test.go)
  - `TestTaskSubmitResponseUnmarshalSupportsStructuredStatus`
  - `TestRuntimeClientForwardExecutionAcceptsStructuredCompletedStatus`
  - `TestRuntimeClientForwardExecutionReturnsStructuredTaskErrorForNonCompletedStatus`
- [cmd/igris-overture/handlers/infer_stream_test.go](/Users/wira/Desktop/system/cmd/igris-overture/handlers/infer_stream_test.go)
  - `TestHandleInferDoesNotFallbackAfterStructuredRuntimeTaskError`
- [igris-overture/internal/runtime_selector_test.go](/Users/wira/Desktop/system/igris-overture/internal/runtime_selector_test.go)
  - mock runtime response updated to the Runtime-style structured `status` object

These cover:

- structured Runtime response decoding
- proof-field preservation
- verified successful Overture -> Runtime decoding
- noncompleted Runtime results not being masked by fallback

# Demo script added

- Runner: [scripts/unified_execution_proof_demo.sh](/Users/wira/Desktop/system/scripts/unified_execution_proof_demo.sh)
- Helper: [scripts/unified_execution_demo_helper.js](/Users/wira/Desktop/system/scripts/unified_execution_demo_helper.js)

What the demo does:

1. Generates a local offline license artifact and local Overture signing keys.
2. Starts a local mock OpenAI-compatible upstream on `127.0.0.1:18090`.
3. Starts Runtime on `127.0.0.1:8080`.
4. Starts Overture on `127.0.0.1:8081`.
5. Sends one `/v1/infer` request through Overture.
6. Fails if Overture logs `Runtime forward failed, falling back to direct routing`.
7. Verifies the returned `execution_envelope` signature.
8. Verifies the returned `execution_receipt` signature and hash.
9. Verifies the receipt appears in the local receipt log with a valid chain link.

# Commands run

Regression tests:

```bash
GOCACHE=/private/tmp/igris-go-test-cache GOFLAGS='-mod=readonly -buildvcs=false' GOPROXY=off GOSUMDB=off \
  go test ./igris-overture/internal -run 'TestRuntimeClient|TestTaskSubmitResponse|TestSelector' -count=1

GOCACHE=/private/tmp/igris-go-test-cache GOFLAGS='-mod=readonly -buildvcs=false' GOPROXY=off GOSUMDB=off \
  go test ./cmd/igris-overture/handlers -run 'TestHandleInferDoesNotFallbackAfterStructuredRuntimeTaskError|TestHandleStreamingInfer' -count=1

GOCACHE=/private/tmp/igris-go-test-cache GOFLAGS='-mod=readonly -buildvcs=false' GOPROXY=off GOSUMDB=off \
  go test ./igris-overture/models -run 'TestBuildReceiptReferenceUsesStableFields|TestBuildFailureResponse|TestBuildSimpleFailureResponse' -count=1
```

Proof demo:

```bash
./scripts/unified_execution_proof_demo.sh
```

Observed demo result:

```text
Unified execution proof succeeded.
Content: mock-response:user: user: hello unified product
Provider: local-mock-cloud
Route decision: forwarded_to_runtime_task
Receipt execution_id: 019de343-34ad-7941-b228-87ba3e9ad824
Receipt hash: 42cbd8e558441f549374fdf16f1032fafe4206d6d20c140fae6209d6210ec353
```

# Proof result

The unified Overture -> Runtime -> receipt path is now proven locally for the narrow demo case.

What is proven:

- Overture accepted `/v1/infer` and used Runtime as the execution authority.
- Runtime executed the request against the configured upstream provider.
- Overture decoded the structured Runtime task response successfully.
- Overture did not fall back to direct mock routing on this successful Runtime call.
- Overture returned `execution_envelope`, `execution_receipt`, and `receipt` in the public response.
- The demo verified:
  - `metadata.provider == local-mock-cloud`
  - `metadata.route_decision == forwarded_to_runtime_task`
  - execution envelope signature valid
  - execution receipt signature valid
  - execution receipt hash matches recomputed digest
  - receipt exists in the Runtime receipt log with a valid chain link

Primary evidence:

- Response payload: `/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-unified-proof.aefdwk/overture-response.json`
- Verification summary: `/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-unified-proof.aefdwk/verification.json`
- Overture log: `/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-unified-proof.aefdwk/logs/overture.log`

# Remaining unproven claims

- Real external providers such as OpenAI or Anthropic. This proof used a local mock upstream.
- Runtime local GGUF fallback. The demo explicitly keeps `local_fallback.enabled=false`.
- Checkpoint/recovery and long-horizon resumption.
- ROS2/robotics execution.
- Database-backed persistence, dashboard visibility, and fleet workflows in Overture.
- Multi-runtime failover across a registered fleet.

Known limitations of the current demo:

- Runtime still effectively binds to `8080`, so the demo aborts if that port is already occupied.
- The mock upstream returns a synthetic completion, not a real model result.
- The returned content currently includes the Runtime prompt formatting artifact `user: user: ...`; this is cosmetic and not part of the contract fix.

# Recommended next task

Prove one real provider-backed path without changing architecture:

1. Replace the mock upstream in the demo with one sanctioned real provider path.
2. Keep the same Overture -> Runtime -> verified receipt flow.
3. Add one automated integration test or nightly smoke test that runs the proof script and fails on any Runtime fallback log line.
