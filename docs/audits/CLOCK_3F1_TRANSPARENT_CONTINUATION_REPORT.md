# Clock 3F.1 — Transparent Durable Continuation Report

**Date:** 2026-07-21  
**Branch:** `feature/clock-3f-product-validation`  
**Base tip:** `1e2695e5c` (Clock 3F integration)  
**Verdict:** **PRODUCT_PATH_GREEN**

## Executive summary

The P0 friction was a Clock 3B recovery-proof artifact: `buildBoundActionExecutionGraphDefinition` forced `checkpoint_after_steps=1`, and Runtime **yielded** (stopped) after the HTTP effect. Overture saved the checkpoint but never continued. Normal `DurableRun.wait()` timed out unless infrastructure resumed.

**Fix:** keep the durable mid-effect checkpoint, but set `continue_after_checkpoint=true` on the product bound graph so Runtime notifies Overture then continues in-process. Recovery proofs opt back into the historical stop via `IGRIS_BOUND_ACTION_YIELD_AFTER_CHECKPOINT=1`.

Scenario A now completes in **~2 seconds** with zero manual resume and zero raw Overture curl in the SDK journey.

## Root cause (Phase 0)

| Question | Answer |
|----------|--------|
| Where is `checkpoint_after_steps=1` set? | `igris-overture/api/routes_actions.go` → `buildBoundActionExecutionGraphDefinition` |
| Why? | Clock 3B proof artifact so Runtime 1 stops after HTTP for clean-host replacement |
| Why Runtime stops? | `should_checkpoint_after_steps` returns `Checkpointed` and exits the step loop |
| What triggers resume? | Only recovery (stale runtime / `MarkRecovering` → redispatch), not normal success |
| Non-bound tasks? | Only stop when they explicitly set `checkpoint_after_steps` (proofs/demos) |

Classification: **test/demo artifact baked into the product path**, plus core Runtime yield semantics for that field.

## Fix (narrow)

1. **Runtime** (`task_executor.rs`): new `continue_after_checkpoint` on `execution_graph`. When set with `checkpoint_after_steps`, send checkpoint callback then continue; otherwise yield (unchanged).
2. **Overture** (`routes_actions.go`): product bound graphs set `continue_after_checkpoint=true` unless `IGRIS_BOUND_ACTION_YIELD_AFTER_CHECKPOINT` is truthy.
3. **Clock 3B harness**: exports `IGRIS_BOUND_ACTION_YIELD_AFTER_CHECKPOINT=1` so recovery injection still works.
4. **Clock 3F harness**: Scenario A uses `run → wait → proof` with no resume; Scenario B uses yield only for recovery injection.

Optional harness env `IGRIS_CONTINUE_AFTER_CHECKPOINT_PAUSE_MS` exists but is unused by the green path.

## Validation results

| Scenario | Result |
|----------|--------|
| A normal success | **PASS** — `completed` in 2s, effect count 1, no manual resume |
| B recovery | **PASS** — yield injection → Runtime 2 → lineage 3 events, effect delta 1 |
| C uncertain effect | **PASS** — `ReconciliationRequiredError`, no auto-replay, operator confirm `cryptographic_proof=false` |
| Security negatives | **PASS** |

Friction: `p0_friction=[]`. Product concepts no longer include mandatory checkpoint/resume.

## Regressions

| Check | Result |
|-------|--------|
| Clock 3B contract-bound proof | **PASS** (effects 1, HTTP 1, DB 1) |
| Go api/coordinator focused tests | **PASS** |
| SDK durable + adapter tests | **29 passed** |
| Frozen protocol manifest | `864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4` unchanged |
| Fast proof gate | **PASS** |
| Full heavy Tier A | **PASS** |

## Second-pass notes

- No blind retry in SDK; polling does not own progression.
- Uncertain effects still fail closed; reconciliation semantics unchanged.
- Checkpoint durability retained (callback before continue; yield preserved for proofs).
- Claim boundaries / Action Protocol unchanged.
- No merge to main.

## Recommendation

Ready for independent clean-room retest of the public SDK path. Next optional step: run full heavy Tier A on the post-fix tip after commit.
