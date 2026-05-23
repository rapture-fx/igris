# Canonical Run, Recover, Prove Scenarios

Date: 2026-05-23

## 1. Policy Denied Dangerous Action

Story: an agent requests an action that policy denies before runtime dispatch.

Must prove:

- Policy decision persisted with `decision=denied`.
- Task never transitions to dispatched.
- Runtime receipt is absent because execution never occurred.
- Console task detail shows denied policy and no fake proof.

Current coverage: built-in policy tests cover approval and irreversible recovery denial. Add a deterministic denied non-recovery fixture if broader dangerous-action classification is added.

## 2. Recovery After Runtime Crash

Story: a runtime dies after checkpoint. The coordinator selects the last safe cumulative checkpoint, records recovery and handoff events, and redispatches only if policy allows it.

Must prove:

- Checkpoint exists with task ID, runtime ID, last committed step, and digest.
- `task_recovery_events` contains runtime failure and redispatch events.
- `runtime_handoff_events` records allowed or denied handoff.
- Committed steps are not replayed from scratch.
- Proof verifies when the resumed runtime returns signed receipts.

Current coverage: coordinator recovery tests cover resume payloads, invalid checkpoints, and mismatch handling. Full local demo still needs a one-command script.

## 3. Irreversible Replay Prevention

Story: an irreversible action commits, then runtime failure occurs. The coordinator does not automatically replay the action.

Must prove:

- Policy decision marks `irreversible=true`, `replay_class=non_retryable`, and `checkpoint_portability=same_runtime_only`.
- Recovery policy denies automatic replay.
- Recovery/handoff event records replay blocked reason.
- Console explains manual recovery requirement.

Current coverage: `TestEvaluateActionPolicyBlocksIrreversibleRecoveryReplay` covers policy denial. Recovery event fixture should be promoted to an integration scenario.

## 4. Boundary Violation

Story: a runtime reports or triggers work outside the expected boundary.

Must prove:

- Boundary was recorded before or during execution.
- Violation is persisted in `boundary_violations` or receipt lineage violation fields.
- Console links violation to task/runtime.
- Proof/compliance status does not claim clean verification when boundary evidence failed.

Current coverage: governance endpoints list violations. Detection/enforcement source remains runtime-dependent.

## 5. Runtime Handoff Blocked

Story: a task attempts to resume on a different runtime while checkpoint portability is `same_runtime_only`.

Must prove:

- Portability mode is checked.
- Handoff is denied and persisted.
- Task fails or waits safely rather than replaying.
- Console shows the handoff denial reason.

Current coverage: `TestRecoveryHandoffBlocksSameRuntimeOnlyMigration` covers the policy decision; recovery code records denied handoff events.

## Suggested Test Commands

```bash
GOCACHE=/tmp/igris-gocache-promise go test ./igris-overture/coordinator ./igris-overture/api -count=1 -timeout=180s
```
