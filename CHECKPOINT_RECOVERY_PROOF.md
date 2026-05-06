# Checkpoint and Recovery Proof

**Date:** 2026-05-06  
**Product claim under test:** support long-horizon execution by checkpointing and recovering work  
**Scope:** existing Runtime + Overture paths only, no external provider credentials, no fake checkpoint or recovery events

## Summary

**Proven today**
- Overture can submit a durable task to Runtime, receive a real Runtime checkpoint, persist it in `task_records` and `wal_checkpoints`, and expose that checkpoint through `GET /v1/tasks/:id` and `GET /v1/tasks/:id/steps`.
- The checkpointed task detail includes signed `execution_envelope` and `execution_receipt`, and the task writes an `execution_context` row.
- Overture's failed-runtime recovery loop detects the stale runtime and redispatches the checkpointed task to a replacement runtime.

**Partially proven**
- Recovery redispatch is real and observable, but end-to-end Overture resume-to-completion is **not** proven.

**Not proven**
- A full Overture checkpoint -> recovery -> completed task -> global proof/run API chain.
- `/proof/receipts` and `/v1/execution/runs` visibility for this checkpointed task path.

Evidence artifacts referenced below come from:
- `/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OObsHt`
- `/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OADIUf`

## Checkpoint mechanism inspected

- Runtime checkpoint generation lives in `igris-runtime/crates/igris-server/src/task_executor.rs`.
- WAL payload and resume token types live in `igris-runtime/crates/igris-wal/`.
- Overture persistence and redispatch live in `igris-overture/coordinator/task_coordinator.go` and `igris-overture/coordinator/checkpoint_store.go`.
- Task API visibility lives in `igris-overture/api/routes_tasks.go`.
- Execution/proof listing APIs live in `igris-overture/api/routes_execution.go` and `igris-overture/api/routes_proof.go`.

Important findings from inspection:
- Runtime returns externally visible checkpoints on the deadline path and on behavior-tree `Running` checkpoints.
- Runtime's periodic every-5-steps checkpoint is only cached internally; it is not returned to Overture as a checkpoint response.
- Overture recovery redispatch exists and is active.
- The recovery proof path initially had three real interop bugs that were fixed during this task:
  - Overture was not sending `Authorization: Bearer $IGRIS_RUNTIME_SECRET` to Runtime durable-task submit.
  - Overture expected Runtime task `status` to be a string instead of the actual structured object.
  - Overture's Go checkpoint mirror did not accept Runtime WAL JSON shapes for digests/signatures.

## Commands run

Secrets were redacted. `DATABASE_URL` was sourced from `.env` and never printed.

```bash
go test ./igris-overture/coordinator -run 'TestDispatchToRuntimeIncludesRecoveryResumePayload|TestDispatchToRuntimePreservesCheckpointAndFailureDetailsOnExecutionFailure|TestDispatchToRuntimeAcceptsStructuredRuntimeCheckpointStatus' -count=1

./scripts/checkpoint_proof_demo.sh

psql "$DATABASE_URL" -f igris-overture/database/migrations/031_task_records.sql
psql "$DATABASE_URL" -f igris-overture/database/migrations/032_task_record_artifacts.sql
...
psql "$DATABASE_URL" -f igris-overture/database/migrations/048_runtime_command_device_key.sql

psql "$DATABASE_URL" -c 'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT '\''seed'\'';'
psql "$DATABASE_URL" -c 'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;'
psql "$DATABASE_URL" -c 'ALTER TABLE runtime_instances ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;'
```

## Checkpoint creation result

**Proven**

Checkpointed task:
- `task_id`: `e879d14c-efa2-426b-a055-e03b487e7c79`
- Overture artifact: [task-after-checkpoint.json](</var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OObsHt/task-after-checkpoint.json>)

Observed result from `GET /v1/tasks/:id`:
- `status: "checkpointed"`
- `last_step: 0`
- `checkpoint_digest: 55f6f0f6ccbf377c1665ab3c2ebb579af39122710ea176a25ef4a3511dba7466`
- `checkpoint_runtime_id: "checkpoint-runtime-1"`
- signed `execution_envelope` present
- signed `execution_receipt` present

This was a real Runtime deadline checkpoint produced through the normal Overture durable-task submit path. It was not synthesized from source code or manual DB writes.

## Checkpoint persistence result

**Proven**

Task row snapshot:
- [db-task-after-checkpoint.json](</var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OObsHt/db-task-after-checkpoint.json>)

Persisted facts:
- `task_records.status = "checkpointed"`
- `task_records.last_checkpoint.resume_token.last_committed_step = 0`
- `task_records.last_checkpoint.resume_token.runtime_id = "checkpoint-runtime-1"`
- `task_records.execution_envelope IS NOT NULL`
- `task_records.execution_receipt IS NOT NULL`

Checkpoint history snapshot:
- [db-wal-checkpoints-after-checkpoint.json](</var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OObsHt/db-wal-checkpoints-after-checkpoint.json>)

Persisted facts:
- `wal_checkpoints.count = 1`
- persisted checkpoint row `step_index = 0`
- persisted checkpoint row `resume_runtime_id = "checkpoint-runtime-1"`
- persisted checkpoint row `wal_entry_count = 1`

## Recovery/resume result

**Partial**

What was proven:
- Runtime 1 was intentionally stopped after the checkpoint.
- Runtime 2 was started on the same WAL store.
- Runtime 2 registered successfully in Overture under a different runtime instance:
  - old runtime row: `ec261179-ae11-4ca7-b42c-2197aa8bd700`
  - replacement runtime row: `d53ecbb1-fbad-4fda-a9a9-0d6fe3113b9e`
- Overture recovery loop detected the stale runtime and redispatched the task.

Recovery evidence:
- [overture.log](</var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OObsHt/logs/overture.log:272>)
- [task-status-history-after-recovery.txt](</var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OObsHt/task-status-history-after-recovery.txt>)

Relevant Overture log lines:
- `[Coordinator] Recovering tasks from failed runtime`
- `[Coordinator] Redispatching recovered task`
- `[Coordinator] Save checkpoint` with `task transition rejected`

What failed:
- The deadline-based checkpoint proof used `deadline_at=1970-01-01T00:00:00.001Z` so Overture forwarded `deadline_ms=1` on every dispatch.
- On recovery redispatch, Runtime resumed under the same 1ms budget and returned another non-advancing checkpoint instead of completing.
- Overture then rejected that checkpoint as non-advancing (`task transition rejected`), leaving the task unable to complete through this path.

Additional recovery attempt:
- The later interval-based run `84d7df8c-778c-46c7-94d6-f6987044feca` removed the synthetic deadline and used an 8-step task.
- Result: the task went straight from `dispatched` to `completed`; no Overture-visible checkpoint was emitted.
- That showed the Runtime's periodic checkpoint is internal-only for this task type and cannot currently be used to prove Overture-visible recovery.

Bottom line:
- **Recovery detection and redispatch are proven.**
- **Resume-to-completion through Overture is not proven today.**

## Receipt/proof result

**Partial**

Proven:
- The checkpointed task detail already carried signed execution artifacts:
  - `execution_envelope.signature` present
  - `execution_receipt.signature` present
- The task also persisted an `execution_context` row:
  - `execution_id = 019dfdf0-2ed7-7d92-9797-5a2dad9386d3`
  - `runtime_id = checkpoint-runtime-1`
  - `route_decision = local-mock-cloud`
  - `verification_status = pending`

Not proven:
- Global proof receipt indexing for this task path.

DB evidence:
- `execution_context` row exists for the task.
- `execution_lineage` row count for `execution_id = 019dfdf0-2ed7-7d92-9797-5a2dad9386d3` was `0`.

Implication:
- Task detail retained the signed receipt.
- The global proof/run listing APIs that depend on `execution_lineage` were not proven for this checkpoint path.

## API visibility result

**Proven**
- `GET /v1/tasks/:id` exposed the checkpointed state and receipt metadata.
- `GET /v1/tasks/:id/steps` exposed the persisted WAL-backed step snapshot after checkpoint.

Evidence:
- [task-after-checkpoint.json](</var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OObsHt/task-after-checkpoint.json>)
- [task-steps-after-checkpoint.json](</var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-checkpoint-proof.OObsHt/task-steps-after-checkpoint.json>)

Observed task-step visibility after checkpoint:
- `total = 1`
- `step_index = 0`
- `runtime_id = "checkpoint-runtime-1"`

**Not proven**
- `GET /proof/receipts`
- `POST /proof/receipts/verify`
- `GET /v1/execution/runs`

Reason:
- the checkpoint path wrote `execution_context`, but did not produce `execution_lineage` rows for the task evidence inspected here.

## Files changed

- [igris-overture/coordinator/task_coordinator.go](/Users/wira/Desktop/system/igris-overture/coordinator/task_coordinator.go)
- [igris-overture/coordinator/checkpoint_store.go](/Users/wira/Desktop/system/igris-overture/coordinator/checkpoint_store.go)
- [igris-overture/coordinator/task_coordinator_test.go](/Users/wira/Desktop/system/igris-overture/coordinator/task_coordinator_test.go)
- [scripts/unified_execution_demo_helper.js](/Users/wira/Desktop/system/scripts/unified_execution_demo_helper.js)
- [scripts/checkpoint_proof_demo.sh](/Users/wira/Desktop/system/scripts/checkpoint_proof_demo.sh)
- [CHECKPOINT_RECOVERY_PROOF.md](/Users/wira/Desktop/system/CHECKPOINT_RECOVERY_PROOF.md)

## Known limitations

- This proof does **not** show a completed Overture recovery flow.
- The successful checkpoint proof depended on a deadline-driven checkpoint.
- The Runtime's periodic checkpoint path is not externally surfaced to Overture for `agent_workflow`.
- Global proof/run APIs were not proven for the checkpoint task because `execution_lineage` was absent for the inspected execution.
- Local DB compatibility work was required before the proof could run:
  - durable-task migrations `031` through `048`
  - `tenants.tier`
  - `tenants.is_active`
  - `runtime_instances.tenant_id` widened from `UUID` to `TEXT`

## Recommended next task

Fix the Overture-visible recovery path without inventing a new subsystem:
- make Runtime return a coordinator-visible checkpoint for the existing periodic checkpoint path, or
- change Overture recovery redispatch to use a correct remaining deadline model instead of replaying the original synthetic `deadline_ms=1`,
- then wire successful durable-task artifacts into `execution_lineage` so `/proof/receipts` and `/v1/execution/runs` become provable for checkpointed/recovered tasks.
