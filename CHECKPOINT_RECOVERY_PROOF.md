# Checkpoint and Recovery Proof

**Date:** 2026-05-07  
**Product claim under test:** support long-horizon execution by checkpointing and recovering work  
**Scope:** existing Runtime + Overture durable-task paths only, no external provider credentials, no fake checkpoint, recovery, or lineage rows

## Summary

**Proven**
- Overture submits a durable task to Runtime and persists a real Runtime checkpoint after step 0.
- Overture detects the stale Runtime 1 registry row and redispatches the checkpointed task to Runtime 2.
- Runtime 2 resumes from step 1 using the existing WAL-backed resume token and completes steps 1 through 7.
- `task_records` ends as `completed`, with final `last_committed_step = 7`.
- `GET /v1/tasks/:id/steps` shows exactly eight committed steps: step 0 from Runtime 1 and steps 1-7 from Runtime 2.
- `wal_checkpoints` contains checkpoint rows for step 0 and step 7; no duplicate step 0 was observed.
- Real signed execution artifacts from the completed recovered task are persisted into `execution_lineage`.
- `/proof/receipts`, `/proof/receipts/verify`, `/v1/execution/runs`, and task proof verification can see the completed recovered execution.

**Partial**
- This proves same-host replacement recovery with a shared Runtime WAL store. It does not prove clean-host failover with an empty WAL store.

**Not proven**
- External provider proof; the proof uses the local mock provider.

Evidence artifact directory:
- `/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.dzIoNc`

## Root Cause Confirmed

The earlier deadline-based proof set `deadline_at = 1970-01-01T00:00:00.001Z` to force Runtime to return an Overture-visible checkpoint after step 0. Overture converted that stored absolute deadline directly into Runtime `deadline_ms` on every dispatch.

On recovery, that replayed the same tiny/expired deadline to Runtime 2. Runtime resumed from the checkpoint but immediately produced another non-advancing checkpoint instead of completing. Overture correctly rejected that checkpoint transition as non-advancing.

A second recovery blocker was also confirmed: if recovery changes the Runtime payload deadline while reusing the original Runtime idempotency key, Runtime can reject the resume as an idempotency conflict against the original checkpointed response.

## Deadline Recovery Behavior Chosen

Overture now sends Runtime a duration budget derived from `deadline_at`, not the absolute Unix timestamp.

Behavior:
- Initial dispatch with an already-expired deadline still sends `deadline_ms = 1`, preserving the existing deadline-forced checkpoint proof behavior.
- Recovery dispatch with an expired deadline omits `deadline_ms`, allowing Runtime's normal default durable-task budget to complete the resumed work.
- Recovery dispatch with a future deadline sends the remaining milliseconds.
- Non-recovery deadline enforcement is not weakened: expired first dispatches still receive the minimum one-millisecond budget, and future deadlines are sent as remaining budgets.
- Recovery dispatch uses a deterministic resume idempotency key derived from the original idempotency key plus the checkpoint watermark, avoiding collision with the original checkpoint response while preserving Overture's task idempotency record.

## Commands Run

```bash
GOCACHE=/tmp/igris-gocache-checkpoint go test ./igris-overture/coordinator -run 'TestDispatchToRuntimeIncludesRecoveryResumePayload|TestRuntimeDeadlineBudgetMsOmitsExpiredDeadlineOnRecovery|TestRuntimeDispatchIdempotencyKeyDerivesRecoveryKeyFromCheckpoint|TestRecoverRuntimeRedispatchesNewestCheckpointPayload|TestRecoverRuntimeRedispatchUsesCheckpointFromTaskRecordWhenWalMissing|TestRecoverRuntimePrefersWalCheckpointWhenTaskRecordCheckpointIsStale|TestRecoverRuntimeRetriesWithLatestCheckpointAfterRedispatchRuntimeFailure|TestRecoverRuntimeMarksFailedOnRedispatchConflictResponse' -count=1 -timeout=60s

GOCACHE=/tmp/igris-gocache-checkpoint go test ./igris-overture/coordinator -run 'TestRecoverRuntime|TestDispatchToRuntime|TestRuntimeDeadlineBudgetMs|TestRuntimeDispatchIdempotencyKey|TestSelectRecoveryCheckpoint|TestBuildExecutionLineageRecordFromReceipt' -count=1 -timeout=120s

cargo build --manifest-path igris-runtime/Cargo.toml -p igris-server --bin igris-runtime

./scripts/checkpoint_proof_demo.sh
```

Full `go test ./igris-overture/coordinator -count=1` was also attempted. It reached unrelated pre-existing signature-verification test failures:
- `TestVerifyExecutionArtifactsForTaskUsesRuntimeRegistryKey`: `execution_receipt hash mismatch`
- `TestReplayRoboticsAuditReconstructsPolicyActionAndRuntimeReceipt`: `runtime_signature_invalid`

## Checkpoint Evidence

Task:
- `task_id`: `c63dfb3d-e442-431f-88ee-40077f1056b3`
- Runtime 1 registry id: `743895bd-4a3b-49de-9820-3bf9e062fc54`
- Runtime 1 peer id: `checkpoint-runtime-1`

Checkpoint state from `db-task-after-checkpoint.json`:
- `status = "checkpointed"`
- `last_committed_step = "0"`
- `checkpoint_runtime_id = "checkpoint-runtime-1"`
- `checkpoint_digest = 55f6f0f6ccbf377c1665ab3c2ebb579af39122710ea176a25ef4a3511dba7466`
- `execution_envelope_present = true`
- `execution_receipt_present = true`
- `proof_status = "verified"`

## Recovery Redispatch Evidence

Runtime 1 was stopped. Runtime 2 was started with the same Runtime WAL store and registered as:
- Runtime 2 registry id: `f4f0d345-7a90-4bc5-8748-0d70caf0ef12`
- Runtime 2 peer id: `checkpoint-runtime-2`

Overture recovery log snippets:
- `[Coordinator] Recovering tasks from failed runtime`
- `[Coordinator] Redispatching recovered task`

Status history after recovery:
- repeated `checkpointed`
- final `completed`

## Resume-To-Completion Evidence

Final task state from `db-task-after-recovery.json`:
- `status = "completed"`
- `runtime_id = "f4f0d345-7a90-4bc5-8748-0d70caf0ef12"`
- `last_committed_step = "7"`
- `checkpoint_runtime_id = "checkpoint-runtime-2"`
- `checkpoint_digest = c0785c04e2ff7f0c76a534f4bc052daec7b5a8d32cc1d80ca1e7f377981e348f`
- `execution_envelope_present = true`
- `execution_receipt_present = true`
- `proof_status = "verified"`

`task-after-recovery.json`:
- `status = "completed"`
- `last_step = 7`
- receipt available for execution `019e02d0-53ac-7093-9b89-bb3c32156506`
- task proof `matched = true`

## WAL / No-Duplicate-Step Evidence

`GET /v1/tasks/:id/steps` after recovery returned `total = 8`.

Step split:
- step 0: `checkpoint-runtime-1`
- steps 1, 2, 3, 4, 5, 6, 7: `checkpoint-runtime-2`

`wal_checkpoints` after recovery:
- `count = 2`
- row 1: `step_index = 0`, `resume_runtime_id = checkpoint-runtime-1`, `wal_entry_count = 1`
- row 2: `step_index = 7`, `resume_runtime_id = checkpoint-runtime-2`, `wal_entry_count = 7`

This proves step 0 was not re-executed by Runtime 2.

## Execution Lineage And Proof Visibility

Final recovered execution:
- `execution_id = 019e02d0-53ac-7093-9b89-bb3c32156506`
- `receipt_hash = 3819ad5507758c484716ea197b21959a583f39b3945f20b8ca82d8533d23b89f`
- `execution_lineage` count for the final execution: `1`

Global API visibility:
- `/proof/receipts` includes the completed recovered execution with `verification_status = "verified"`.
- `/proof/receipts/verify` returned HTTP `200` and `verified = true`.
- `/v1/execution/runs` includes the recovered execution with `status = "COMPLETED"`.
- `POST /v1/tasks/:id/proof/verify` returned HTTP `200` and `proof.status = "verified"`.

The checkpointed intermediate execution also appears in proof/run listings as `CHECKPOINTED`/pending, which reflects real checkpoint artifacts from Runtime 1.

## Files Changed

- [igris-overture/coordinator/task_coordinator.go](/Users/wira/Desktop/system/igris-overture/coordinator/task_coordinator.go)
- [igris-overture/coordinator/task_coordinator_test.go](/Users/wira/Desktop/system/igris-overture/coordinator/task_coordinator_test.go)
- [igris-runtime/crates/igris-server/src/task_executor.rs](/Users/wira/Desktop/system/igris-runtime/crates/igris-server/src/task_executor.rs)
- [scripts/checkpoint_proof_demo.sh](/Users/wira/Desktop/system/scripts/checkpoint_proof_demo.sh)
- [scripts/unified_execution_demo_helper.js](/Users/wira/Desktop/system/scripts/unified_execution_demo_helper.js)
- [CHECKPOINT_RECOVERY_PROOF.md](/Users/wira/Desktop/system/CHECKPOINT_RECOVERY_PROOF.md)

## Known Limitations

- This is same-host recovery with a shared Runtime WAL store.
- The checkpoint trigger for this proof is still deadline-driven.
- The proof uses the local mock provider, not a real external model provider.
- Full coordinator package tests currently have unrelated signature fixture failures noted above.

## Recommended Next Task

Add an Overture-visible non-deadline checkpoint trigger for `agent_workflow` so the recovery proof no longer depends on an intentionally expired `deadline_at` to force the first checkpoint.
