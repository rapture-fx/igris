# Checkpoint and Recovery Proof

**Date:** 2026-05-05  
**Claim:** When a multi-step task hits its wall-clock deadline mid-execution, the Runtime produces a WAL-backed checkpoint with a cryptographic resume token. A subsequent resume request verifies the token against the Runtime's WAL, starts at the next uncommitted step, and completes without re-executing work already committed.  
**Credentials used:** None. All providers are local mock servers.

---

## Summary

A 5-step `agent_workflow` task (step indices 0–4) was submitted to the Runtime directly via `POST /v1/runtime/task/submit` with `deadline_ms=1`. Step 0 completed before the 1ms deadline fired. The Runtime produced a `TaskStatus::Checkpointed` response carrying a WAL-backed `ResumeToken`.

The same task was then resumed using the token. The Runtime verified WAL digest continuity, started execution at step 1 (skipping step 0), and completed steps 1–4. The WAL confirms exactly 5 committed entries (steps 0–4) with Ed25519 signatures — step 0 appears once from the checkpoint phase, not twice.

---

## Commands Run

```
cd /Users/wira/Desktop/system

# Kill any leftover processes
kill $(lsof -iTCP:8080 -sTCP:LISTEN -t) 2>/dev/null || true
kill $(lsof -iTCP:18090 -sTCP:LISTEN -t) 2>/dev/null || true

# Run the checkpoint proof (no credentials required)
bash scripts/checkpoint_proof_demo.sh
```

Output:
```
[1/7] Preparing checkpoint proof artifacts in /tmp/igris-checkpoint-proof.6v754Q
    task_id: d28211b2-9fb0-407c-b953-77ca158fad17
    steps: 5 (indices 0-4)
    checkpoint request: deadline_ms=1 (fires before step 0)
[2/7] Reusing existing Runtime binary
[3/7] Starting mock provider on port 18090
      Starting Runtime on port 8080
[4/7] Submitting task (deadline_ms=1) — expecting checkpoint before step 0
    Checkpoint received: status.status=checkpointed
    WAL entries after checkpoint: 1 (step 0 committed; deadline fired before step 1)
[5/7] Building resume request from checkpoint token
    resume_token.last_committed_step: 0
    resume will start at step 1 (skipping step 0)
      Submitting resume request (deadline_ms=30000)
    Resume completed: status.status=completed, steps_completed=5/5
    WAL entries after resume: 5 (step 0 from checkpoint run + steps 1-4 from resume = 5 total)
[6/7] Verifying checkpoint and resume proofs
Checkpoint and recovery proof succeeded.

Checkpoint type: WAL-backed deadline checkpoint (agent_workflow)
Task ID:         d28211b2-9fb0-407c-b953-77ca158fad17
Steps total:     5
After checkpoint: steps_completed=1 (step 0 ran), WAL committed=1
After resume:    steps_completed=5 (steps 1-4 ran), WAL committed=5
Step 0 not re-executed: true (resume token last_committed_step=0)
WAL step indices committed: [0,1,2,3,4]
WAL count matches steps_total: true
WAL entries signed: true

Resume token:    last_committed_step=0, runtime_id=igris-local
Checkpoint digest: 55f6f0f6ccbf377c1665ab3c2ebb579af39122710ea176a25ef4a3511dba7466
Final output:    mock-response:user: graph_blackboard: {"last_node_id":"agent-step-3","last_outpu

Artifacts: /tmp/igris-checkpoint-proof.6v754Q
```

---

## Checkpoint Phase

### Request

Submitted to `POST /v1/runtime/task/submit` with:
- `task_id`: `d28211b2-9fb0-407c-b953-77ca158fad17`
- `task_type`: `agent_workflow` with 5 steps (indices 0–4)
- `deadline_ms`: 1
- Auth: `x-api-key` (Runtime shared secret) + `x-igris-decision-sig` (Ed25519 signature over SHA-256 of request body, signed with Overture private key)

### Response

```json
{
  "task_id": "d28211b2-9fb0-407c-b953-77ca158fad17",
  "steps_completed": 1,
  "steps_total": 5,
  "status": {
    "status": "checkpointed",
    "resume_token": {
      "last_committed_step": 0,
      "checkpoint_digest": "55f6f0f6ccbf377c1665ab3c2ebb579af39122710ea176a25ef4a3511dba7466",
      "runtime_id": "igris-local"
    }
  },
  "checkpoint": {
    "task_id": "d28211b2-9fb0-407c-b953-77ca158fad17",
    "resume_token": {
      "last_committed_step": 0,
      "checkpoint_digest": "55f6f0f6ccbf377c1665ab3c2ebb579af39122710ea176a25ef4a3511dba7466",
      "runtime_id": "igris-local"
    },
    "wal_entries": ["<1 committed WalEntry for step 0 — see WAL section>"],
    "metadata": {
      "domain": "agent",
      "step_index": 0,
      "steps_completed": 1,
      "output_preview": "mock-response:user: user: checkpoint proof step 0"
    }
  },
  "final_output": "mock-response:user: user: checkpoint proof step 0",
  "execution_envelope": {
    "execution_id": "exec-10deb9d3-75f3-489a-9737-8a69725ad204",
    "routing_decision": "local-mock-cloud",
    "runtime_id": "igris-local",
    "signature": "fPGtoYZlJgvU53MPi3P8z0NyU7ct/JlWgNYkZ41YvD6EoUbMs9X5hFFLxbfKOpEDXG6epttuEvN5bfcgShrXDQ==",
    "timestamp": "2026-05-05T17:00:39Z"
  },
  "execution_receipt": {
    "execution_id": "019df915-a7a0-7021-837f-183b8a7837cd",
    "hash": "719b5b0320705a7c3eda0495f892889226585cfc3b00002c98e6a354fb75cc13",
    "runtime_id": "igris-local",
    "signature": "17ioARWXNZXVl2E823DZ2RJTNFNps5oJhSP8BXt7oGpb3MPHfn8qlDF+W6rVRyavqA500XZmiDL57IG21FWUCA==",
    "wall_time_ms": 37
  }
}
```

**`steps_completed=1`, `steps_total=5`, `status.status="checkpointed"`** — step 0 ran; deadline fired before step 1. The `resume_token` encodes the WAL watermark needed for verification.

---

## WAL State After Checkpoint

`GET /v1/runtime/task/d28211b2-9fb0-407c-b953-77ca158fad17/wal` (auth: `x-api-key`):

```json
{
  "task_id": "d28211b2-9fb0-407c-b953-77ca158fad17",
  "count": 1,
  "entries": [
    {
      "step_index": 0,
      "step_type": { "Inference": { "provider": "", "model": "mock-model" } },
      "status": "Committed",
      "signature_present": true
    }
  ]
}
```

**1 committed entry** for step 0. Step 0 is durably recorded with an Ed25519 signature over its output digest.

### Checkpoint Digest

`checkpoint_digest = SHA-256(output_digest[step 0])` — a rolling hash over committed outputs. The resume verifies this matches the Runtime's local WAL state before allowing any work to proceed.

---

## Resume Phase

### Request

Built from the checkpoint token. Submitted to `POST /v1/runtime/task/submit` with:
- **Same** `task_id`: `d28211b2-9fb0-407c-b953-77ca158fad17`
- **Different** `idempotency_key` (prevents idempotency cache collision)
- `resume_from`: the `resume_token` from the checkpoint response
- `deadline_ms`: 30000

The Runtime's `verified_resume_start_step()` confirms:
- `local_checkpoint_digest` (WAL SHA-256 over step 0 output) == `token.checkpoint_digest` ✓
- `local_last_committed_step` (0) == `token.last_committed_step` (0) ✓
- Returns `Some(0 + 1) = 1` → execution starts at step 1, skipping step 0

### Response

```json
{
  "task_id": "d28211b2-9fb0-407c-b953-77ca158fad17",
  "steps_completed": 5,
  "steps_total": 5,
  "status": { "status": "completed" },
  "final_output": "mock-response:user: graph_blackboard: ..."
}
```

**`steps_completed=5`, `status.status="completed"`** — steps 1–4 executed; all 5 steps done.

---

## WAL State After Resume

`GET /v1/runtime/task/d28211b2-9fb0-407c-b953-77ca158fad17/wal`:

```json
{
  "task_id": "d28211b2-9fb0-407c-b953-77ca158fad17",
  "count": 5,
  "entries": [
    { "step_index": 0, "status": "Committed", "signature_present": true },
    { "step_index": 1, "status": "Committed", "signature_present": true },
    { "step_index": 2, "status": "Committed", "signature_present": true },
    { "step_index": 3, "status": "Committed", "signature_present": true },
    { "step_index": 4, "status": "Committed", "signature_present": true }
  ]
}
```

**5 committed entries** (one per step). Step 0 appears exactly once — from the checkpoint phase. Steps 1–4 were added during the resume. **Step 0 was not re-executed.**

---

## Verification Result

```json
{
  "task_id": "d28211b2-9fb0-407c-b953-77ca158fad17",
  "checkpoint_steps_completed": 1,
  "resume_steps_completed": 5,
  "steps_total": 5,
  "step_0_skipped_by_resume": true,
  "all_steps_completed": true,
  "resume_token_last_committed_step": 0,
  "wal_committed_entries_after_resume": 5,
  "wal_step_indices_committed": [0, 1, 2, 3, 4],
  "wal_count_matches_steps_total": true,
  "wal_has_signed_entries": true,
  "checkpoint_verified": true,
  "resume_verified": true
}
```

---

## Checkpoint Mechanism — Code Evidence

| Component | Location | Role |
|---|---|---|
| Deadline check | `task_executor.rs:1165` | `if wall_start.elapsed().as_millis() as u64 > deadline` |
| `build_checkpoint()` | `task_executor.rs:2031` | Computes rolling SHA-256 digest over WAL committed outputs; creates `CheckpointPayload` |
| `WalLog::compute_checkpoint_digest()` | `igris-wal/src/log.rs` | Rolling SHA-256 over committed output digests in step order |
| `verified_resume_start_step()` | `task_executor.rs:2174` | Returns `Some(last_committed_step + 1)` if digest AND step both match; `None` (→ 409) otherwise |
| Resume filter | `task_executor.rs:1114` | `for step in steps.iter().filter(|step| step.step_index() >= start_step)` |
| WAL write (intent) | `task_executor.rs:1206` | Written before step execution |
| WAL write (committed) | `task_executor.rs:1440` | Signed with Runtime Ed25519 key after step completes |

---

## Checkpoint Type Demonstrated

**Deadline checkpoint on `agent_workflow`.**

The Runtime checked the wall-clock deadline between step 0 (completed) and step 1 (not started). This is the primary durability guarantee: any task with a bounded deadline will checkpoint rather than fail if it exhausts its time budget mid-execution.

The resume token's `checkpoint_digest` is a rolling SHA-256 over committed output digests. A forged or stale digest fails `verified_resume_start_step()` and the Runtime rejects the resume with 409 Conflict — preventing replays from an inconsistent state.

---

## Known Limitations

1. **Only `deadline_ms=1` checkpoint tested.** The step-level checkpoint (fired explicitly by `step_result.checkpoint_requested`) and the periodic every-5-steps checkpoint are not demonstrated in this script. Both paths lead to the same `build_checkpoint()` call.

2. **No Overture persistence demonstrated.** The checkpoint payload is verified at the Runtime level only. Overture's coordinator saves checkpoint payloads to `wal_checkpoints` (migration 031) when it dispatches tasks through the task coordinator API. That flow requires migrations 031-035 applied and Overture running with a DB — not exercised here.

3. **No recovery loop demonstrated.** The coordinator's `StartRecoveryLoop()` fires every 15 seconds, marks tasks assigned to runtimes with stale heartbeats (`last_heartbeat < NOW() - 90s`) as `recovering`, and re-dispatches with the last checkpoint. This path is not exercised here because it requires two Overture + Runtime instances and a deliberate heartbeat timeout.

4. **No cloud-to-local fallback after checkpoint.** If a cloud provider fails during the resume, the Runtime falls back to local LLM (if configured). No GGUF model is available in this environment.

---

## Files Changed

| File | Change |
|---|---|
| `scripts/unified_execution_demo_helper.js` | Added `prepare-checkpoint`, `build-resume-request`, `verify-checkpoint`, `verify-checkpoint-resume` commands |
| `scripts/checkpoint_proof_demo.sh` | New — end-to-end checkpoint proof script |
| `CHECKPOINT_RECOVERY_PROOF.md` | This document |

No Runtime or Overture application code was modified. The checkpoint behavior is exercised as-shipped.
