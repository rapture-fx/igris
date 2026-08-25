# Checkpoint and Recovery Proof

**Date:** 2026-05-07  
**Product claim under test:** support long-horizon execution by checkpointing and recovering work  
**Scope:** existing Runtime + Overture durable-task paths only, no external provider credentials, no fake checkpoint, recovery, or lineage rows

## Summary

**Proven**
- `agent_workflow` now supports a non-deadline Overture-visible checkpoint trigger: `checkpoint_after_steps`.
- Overture forwards `checkpoint_after_steps` through the existing task definition and Runtime durable-task submit path.
- Runtime returns a structured checkpoint response to Overture when total completed steps first reaches `checkpoint_after_steps`.
- Overture persists that real Runtime checkpoint in `task_records` and `wal_checkpoints`.
- Overture detects stale Runtime 1 and redispatches the checkpointed task to Runtime 2.
- Runtime 2 resumes from step 1 using the existing WAL-backed resume token and completes steps 1 through 7.
- `GET /v1/tasks/:id/steps` shows exactly eight committed steps: step 0 from Runtime 1 and steps 1-7 from Runtime 2.
- Real signed execution artifacts from the completed recovered task populate `execution_lineage`, `/v1/execution/runs`, `/proof/receipts`, receipt verification, and task proof verification.

**Deadline regression still covered**
- Deadline-forced checkpoint behavior remains implemented.
- Expired initial deadlines still dispatch as `deadline_ms = 1`.
- Expired recovery deadlines are omitted so recovery does not replay a synthetic tiny budget.

**Partial**
- This proves same-host replacement recovery with a shared Runtime WAL store. It does not prove clean-host failover with an empty WAL store.

**Not proven**
- External provider proof; the proof uses the local mock provider.

Evidence artifact directory:
- `/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.xVAP8S`

## Checkpoint Trigger Used

The proof task was submitted through Overture as `agent_workflow` with:

```json
{
  "task_definition": {
    "checkpoint_after_steps": 1,
    "steps": [
      {"step_index": 0},
      {"step_index": 1},
      {"step_index": 2},
      {"step_index": 3},
      {"step_index": 4},
      {"step_index": 5},
      {"step_index": 6},
      {"step_index": 7}
    ]
  }
}
```

No `deadline_at` was set in the proof request.

Runtime treats `checkpoint_after_steps` as an absolute progress threshold: return an Overture-visible checkpoint when total completed steps first reaches the threshold. This is intentionally one-shot for a task definition, so a resumed task whose `start_step` is already at or beyond the threshold does not checkpoint again just because it completed one more recovery step.

## Current Behavior

Before this change:
- deadline checkpoints returned `TaskStatus::Checkpointed` and were visible to Overture;
- behavior-tree running checkpoints returned `TaskStatus::Checkpointed` and were visible to Overture;
- agent workflow every-5-steps checkpoints were built inside Runtime but execution continued, so Overture only saw them if a later returned response carried a checkpoint;
- the proof therefore had to use an expired deadline to force the first visible checkpoint.

After this change:
- `checkpoint_after_steps` uses the same Runtime WAL checkpoint builder and same Overture persistence path as deadline checkpoints;
- defaults are unchanged, so tasks without `checkpoint_after_steps` continue as before;
- the existing internal periodic checkpoint remains non-fatal and does not by itself stop execution.

## Commands Run

```bash
GOCACHE=/tmp/igris-gocache-checkpoint go test ./igris-overture/coordinator -run 'TestNormalizePublicTaskDefinition.*AgentWorkflow|TestDispatchToRuntimeForwardsAgentWorkflowCheckpointAfterSteps|TestRuntimeDeadlineBudgetMs|TestRuntimeDispatchIdempotencyKey|TestRecoverRuntime|TestDispatchToRuntimeIncludesRecoveryResumePayload' -count=1 -timeout=120s

GOCACHE=/tmp/igris-gocache-checkpoint go test ./igris-overture/api -run 'TestBuildTaskSubmitRequest|TestBuildTaskResponse' -count=1 -timeout=120s

cargo test --manifest-path igris-runtime/Cargo.toml -p igris-server agent_workflow_checkpoint_after_steps -- --nocapture

cargo build --manifest-path igris-runtime/Cargo.toml -p igris-server --bin igris-runtime

./scripts/checkpoint_proof_demo.sh
```

Previous full `go test ./igris-overture/coordinator -count=1` still has unrelated signature fixture failures:
- `TestVerifyExecutionArtifactsForTaskUsesRuntimeRegistryKey`: `execution_receipt hash mismatch`
- `TestReplayRoboticsAuditReconstructsPolicyActionAndRuntimeReceipt`: `runtime_signature_invalid`

## Checkpoint Evidence

Task:
- `task_id`: `791c9415-d3a7-4e03-b8f2-9c0f6dacd50a`
- Runtime 1 registry id: `571d0d77-2402-4bfb-97ba-b601e51e1ad0`
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
- Runtime 2 registry id: `89257e50-b985-42cb-806d-debbb2933491`
- Runtime 2 peer id: `checkpoint-runtime-2`

Overture recovery log snippets:
- `[Coordinator] Recovering tasks from failed runtime`
- `[Coordinator] Redispatching recovered task`

Status history after recovery:
- repeated `checkpointed`
- `dispatched`
- final `completed`

## Resume-To-Completion Evidence

Final task state from `db-task-after-recovery.json`:
- `status = "completed"`
- `runtime_id = "89257e50-b985-42cb-806d-debbb2933491"`
- `last_committed_step = "7"`
- `checkpoint_runtime_id = "checkpoint-runtime-2"`
- `checkpoint_digest = c0785c04e2ff7f0c76a534f4bc052daec7b5a8d32cc1d80ca1e7f377981e348f`
- `execution_envelope_present = true`
- `execution_receipt_present = true`
- `proof_status = "verified"`

`task-after-recovery.json`:
- `status = "completed"`
- `last_step = 7`
- receipt available for execution `019e0304-b256-7932-96d5-9e8e83fbba63`
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

## Runs And Receipts Visibility

Final recovered execution:
- `execution_id = 019e0304-b256-7932-96d5-9e8e83fbba63`
- `receipt_hash = a6d85058136a1da31a416edb82cd173cefeb8c2094a2290fa541f2737f4c5515`
- `execution_lineage` count for the final execution: `1`

Global API visibility:
- `/proof/receipts` includes the completed recovered execution with `verification_status = "verified"`.
- `/proof/receipts/verify` returned HTTP `200` and `verified = true`.
- `/v1/execution/runs` includes the recovered execution with `status = "COMPLETED"`.
- `POST /v1/tasks/:id/proof/verify` returned HTTP `200` and `proof.status = "verified"`.

The checkpointed intermediate execution also appears in proof/run listings as `CHECKPOINTED`/pending, reflecting real checkpoint artifacts from Runtime 1.

## Console Visibility

Task detail now shows a Checkpoint and Recovery section backed by real task API fields and WAL steps:
- checkpoint status, last committed step, checkpoint runtime, checkpoint digest, resume-token presence, and proof status from `GET /v1/tasks/:id`;
- recovered/original runtime split, resumed-from step, final step, WAL step count, and duplicate-step status derived from `GET /v1/tasks/:id/steps`.

Run detail remains focused on execution proof and receipt data. When Overture can link a run to a durable task, it shows the task id as a link back to task detail.

Raw resume token material is not exposed in the console.

## Files Changed

- [igris-runtime/crates/igris-server/src/task_executor.rs](/Users/wira/Desktop/system/igris-runtime/crates/igris-server/src/task_executor.rs)
- [igris-overture/coordinator/task_coordinator.go](/Users/wira/Desktop/system/igris-overture/coordinator/task_coordinator.go)
- [igris-overture/coordinator/task_coordinator_test.go](/Users/wira/Desktop/system/igris-overture/coordinator/task_coordinator_test.go)
- [igris-overture/api/routes_tasks.go](/Users/wira/Desktop/system/igris-overture/api/routes_tasks.go)
- [igris-overture/api/routes_execution.go](/Users/wira/Desktop/system/igris-overture/api/routes_execution.go)
- [igris-overture/api/execution_schema.go](/Users/wira/Desktop/system/igris-overture/api/execution_schema.go)
- [web/apps/web-console/app/execution/tasks/[id]/page.tsx](/Users/wira/Desktop/system/web/apps/web-console/app/execution/tasks/[id]/page.tsx)
- [web/apps/web-console/app/execution/runs/[id]/page.tsx](/Users/wira/Desktop/system/web/apps/web-console/app/execution/runs/[id]/page.tsx)
- [web/apps/web-console/hooks/useTasks.ts](/Users/wira/Desktop/system/web/apps/web-console/hooks/useTasks.ts)
- [web/apps/web-console/lib/executionRuns.ts](/Users/wira/Desktop/system/web/apps/web-console/lib/executionRuns.ts)
- [scripts/checkpoint_proof_demo.sh](/Users/wira/Desktop/system/scripts/checkpoint_proof_demo.sh)
- [scripts/unified_execution_demo_helper.js](/Users/wira/Desktop/system/scripts/unified_execution_demo_helper.js)
- [CHECKPOINT_RECOVERY_PROOF.md](/Users/wira/Desktop/system/CHECKPOINT_RECOVERY_PROOF.md)

## Known Limitations

- This is same-host recovery with a shared Runtime WAL store.
- The proof uses the local mock provider, not a real external model provider.
- `checkpoint_after_steps` is an explicit one-shot checkpoint threshold, not a recurring coordinator-visible interval.
- Full coordinator package tests currently have unrelated signature fixture failures noted above.

## Recommended Next Task

Add a separately named recurring coordinator-visible checkpoint policy if product workflows need multiple planned Overture-visible checkpoints during a single long `agent_workflow` run.
