# Product Promise Acceptance

The product promise: **Igris turns agent tool calls into durable executions.**
Agents and MCP clients call registered actions; Igris handles policy, tenant
scoping, idempotency, runtime dispatch, recovery, proof, receipts, and
operator inspection.

This document maps each promise to the executable evidence that proves it.
Run the whole suite with:

```
make product-promise
# or
./scripts/product_promise_acceptance.sh
```

The suite is hermetic: fake DB driver, fake runtime transport, Rails test
mode. It uses **no production services and no secrets**. Optional toggles
(names only): `IGRIS_PROMISE_SKIP_RAILS`, `IGRIS_PROMISE_SKIP_RUNTIME`,
`GOCACHE`.

Each Go stage fails if its test selector matches zero tests, so a renamed or
deleted test cannot silently hollow out a promise.

## Promise → evidence map

| # | Promise | Stage | Key tests |
|---|---------|-------|-----------|
| 1 | A registered action runs through REST and returns a durable, inspectable, redacted run | `rest-registered-action-happy-path` | `TestHandleActionRunRegisteredActionDispatchesToFakeRuntime`, `TestHandleActionCreatePersistsDefinition`, `TestBuildActionRunResponseDoesNotExposeRawProofOrSecrets`, `TestHandleActionRunIgnoresBodyTenantOverride` |
| 2 | The same idempotency key never creates duplicate work, on REST or MCP, and keys are tenant-isolated | `idempotent-replay-no-duplicate-work` | `TestProductPromiseRESTIdempotentReplayReturnsExistingRunWithoutRedispatch`, `TestMCPCallActionIdempotentReplayReturnsExistingRecoveringTaskWithoutRedispatch`, `TestMCPCallActionCrossTenantSameIdempotencyKeyIsIsolated` |
| 3 | MCP `call_action` rides the registered-action path and cannot smuggle tenant overrides or raw execution material | `mcp-call-action-gateway` | `TestMCPToolsListReturnsStrictSchemas`, `TestMCPCallActionUsesExistingActionRunPath`, `TestProductPromiseMCPCallActionRejectsRawExecutionOverrideFields` (all 14 forbidden fields), `TestMCPCallActionRawTaskPayloadDoesNotDispatch` |
| 4 | `get_run` / `get_run_evidence` / `list_runs` return safe metadata only | `run-and-evidence-output-is-metadata-safe` | `TestMCPGetRunEvidenceDoesNotLeakUnsafeBodies`, `TestMCPGetRunReturnsEncryptedInputRefMetadataOnly`, `TestMCPListRuntimesDoesNotLeakHostnamesIPsOrKeys` |
| 5 | A `local_runtime` action without a healthy routable runtime is refused explicitly, never silently accepted | `runtime-unavailable-is-explicit` | `TestHandleActionRunLocalRuntimeFailsSafelyWithNoRoutableRuntime`, `TestMCPListRuntimesDoesNotMarkEndpointlessRuntimeRoutable` |
| 6 | Dispatch reaches the runtime endpoint; callbacks must be signed; unsigned/bad/replayed callbacks are rejected and recorded; valid ones move the run | `runtime-dispatch-and-signed-callbacks` | `TestHandleActionRunRegisteredActionDispatchesToFakeRuntime`, `TestRuntimeCallbackEnvelopeRejectionPathsPersistViolations`, `TestHandleTaskCheckpointReturnsLifecycleMetadata`, `TestRuntimeCallbackNonceReplayStillBlocksBeforeCleanup` |
| 7 | Failures are inspectable with safe reasons, recovery state is visible, irreversible work is never blindly replayed, approval gates hold | `failure-and-recovery-visibility` | `TestHandleGetTaskReturnsRuntimeExecutionFailureDetails*`, `TestEvaluateActionPolicyBlocksIrreversibleRecoveryReplay`, `TestRuntimeFailedRecoveryDecisionBlocksIrreversibleReplay`, `TestEvaluateActionPolicyRequiresApprovalBeforeExecution` |
| 8 | The Rails console shows actions, runs, runtimes, and proof/receipt/evidence metadata that matches API truth, without secrets or raw bodies | `rails-console-alignment` | full `web/apps/rails-console` suite (notably `run_detail_evidence_test.rb`, `run_inspector_test.rb`, `actions_real_mode_test.rb`, `data_source_test.rb`) |
| 9 | The runtime execution/WAL layer the dispatch path relies on stays green | `runtime-crates` | `cargo test -p igris-tools -p igris-wal --lib` |

## What stays manual

These require a live environment and a disposable tenant; they are
deliberately **not** automated here:

- The first-external-user dry run against a deployed environment:
  [first_external_user_dry_run.md](first_external_user_dry_run.md).
- Production Neon schema attestation (read-only scripts exist; run them
  manually, never from this suite).
- Visual review of console pages beyond what controller tests assert.

## Rules of engagement

- Never weaken a security/redaction/policy test to make a stage pass.
- If a stage reports "test selector matched no tests", the promise lost its
  coverage — restore or re-point the tests before shipping anything that
  touches that surface.
