# Legacy core-suite proof refresh (2026-07-05)

Follow-up to PR #71 (checkpoint-403 fix). The heavy proof gate's "core proof
suite" (`scripts/proof_suite.sh`) runs four legacy sub-proofs. `task_v1` was
fixed and merged in PR #71. The other three had **independent bit-rot bugs**,
reproduced locally against an isolated Postgres proof DB (`igris_overture_proof`)
with the same migration chain the CI gate applies.

All four now pass locally, end to end, in the sequential suite:

```
Task V1 golden-path proof succeeded.
Unified execution proof succeeded.
Fallback execution proof succeeded.
Checkpoint and recovery proof succeeded.
Core proof suite passed: Run, Recover, and Verify all green.
```

## Status

| Sub-proof | State | Root cause | Fix |
|-----------|-------|------------|-----|
| `task_v1_proof_demo.sh` | ✅ Fixed in PR #71 (+ exec teardown here) | — | — |
| `unified_execution_proof_demo.sh` | ✅ Fixed | `/v1/infer` feature-flag gated off → 404 | set `IGRIS_ENABLE_EXPERIMENTAL_MODEL_ROUTES=true` |
| `fallback_execution_proof_demo.sh` | ✅ Fixed | same `/v1/infer` gating | same flag |
| `checkpoint_proof_demo.sh` | ✅ Fixed | recovery runtime identity + orphaned runtime process | register-before-boot + pin peer id; `exec` the runtime |

## Root causes and fixes

### 1 & 2. unified / fallback: `/v1/infer` was never registered (404, not a receipt bug)
The earlier "direct-routing fallback" theory was wrong. The Overture log showed
`/v1/infer` returning **404 `Cannot POST /v1/infer`** — the route was never
registered, so no request ever reached the Runtime and no receipt was written
(the verify step then failed with `ENOENT` on `receipts.jsonl`).

`RegisterInferRoutes` is gated behind `ExperimentalModelRoutesEnabled()`
(`IGRIS_ENABLE_EXPERIMENTAL_MODEL_ROUTES`, commit `cb316c373`). The model
gateway is classified `experimental_non_core, feature_flag_required` and is
disabled by default. The proofs start Overture without that flag, so the
endpoint they depend on is absent.

**Fix:** the unified and fallback proofs now start Overture with
`IGRIS_ENABLE_EXPERIMENTAL_MODEL_ROUTES=true`. `/v1/infer` registers, the request
forwards to the Runtime (`source=runtime`, `route_decision=forwarded_to_runtime_task`),
and a signed runtime receipt is produced and verified. Receipt verification is
**unchanged and still strict** — the proof still fails on any missing/invalid
receipt or on `Runtime forward failed, falling back to direct routing`.

### 3. checkpoint: recovery Runtime 2 callback identity + orphaned Runtime 1
Two compounding harness bugs:

- **Identity.** The proof pinned each runtime's `mcp.peer_id` to a fixed string
  (`checkpoint-runtime-1/2`), but Overture assigns each registered runtime a
  random UUID. `validateRuntimeCallback` requires the callback envelope
  `runtime_id` to equal the task's assigned `runtime_id` (and it keys the pubkey
  lookup by that id). On recovery the coordinator sets `task.runtime_id` to
  Runtime 2's registered UUID, so Runtime 2's resume checkpoint callback
  (`POST /v1/tasks/:id/checkpoint`) was rejected **403**
  ("checkpoint runtime identity does not match assigned task runtime"). Runtime 1
  passed only because `task.runtime_id` was still empty at its first checkpoint.

- **Orphaned process.** Each runtime/Overture was launched as
  `( cd "$ROOT_DIR"; env … serve ) &`, so `RUNTIME_PID=$!` captured the
  **subshell**, not the runtime. `kill "$RUNTIME_PID"` at the interruption step
  killed the subshell and orphaned the actual `igris-runtime` (reparented to
  PID 1). Runtime 1 kept the shared WAL lock and port 8080, Runtime 2 crashed
  with `Database already open. Cannot acquire lock.`, and Runtime 1 — still alive
  with its own identity — answered the redispatch and got the 403. The same leak
  also left ports held after every proof, which would break the sequential suite
  at the next `check_port_free`.

**Fix:**
- Register **before** boot and pin `mcp.peer_id` to the assigned registry UUID for
  **both** Runtime 1 and Runtime 2 (same shape as the task_v1 fix). The signed
  checkpoint resume tokens and per-step `runtime_id` now carry the registered id,
  and the validation asserts against the registered ids.
- Launch runtimes/Overture with `exec env … serve` so `$!` is the real process;
  `kill`/`wait`/cleanup now terminate it. Applied to all four proofs so teardown
  is reliable between sequential suite steps.

## Heavy proof CI status (workflow_dispatch, run 28739140975)

The heavy gate now **reaches the core proof suite** — it clears all four
Action Task V1 recovery proofs (the layer that blocked the earlier heavy-proof
work) and enters `proof_suite.sh`. It then aborts at **step 1/4,
`task_v1_proof_demo.sh`**, on a runtime-side `containment violation: cpu after
30000ms` (step 1), with `wall_time_ms:6` and `cpu_time_ms:0`.

This is a **pre-existing, environment-specific failure, not caused by this
branch**: today's `main` nightly (run 28738844165) aborts at the exact same
line with the identical violation. A mock step that ran 6 ms wall / 0 ms CPU
cannot have exceeded a 30 s CPU limit — the containment Supervisor's CPU
enforcement misfires on GitHub-hosted runners, which deny cgroup control to the
unprivileged job (documented in
`igris-runtime/crates/igris-server/tests/containment_integration.rs`: "Shared CI
runners (e.g. GitHub-hosted) deny cgroup creation"). It is the next concrete
layer to peel and is **out of scope** for this unified/fallback/checkpoint
refresh (and touches security-critical containment code — not to be relaxed
speculatively).

Consequence: the three fixes here are validated **locally** (full 4-proof suite
green) but cannot yet be exercised on CI past this task_v1 containment layer.
Because `task_v1` is step 1/4, the suite never reaches the unified/fallback/
checkpoint steps on the GitHub runner.

## Non-negotiables (honored)
- Runtime callback auth is **unchanged**. Signature/identity/tenant/timestamp/
  replay checks stay; unauthorized and wrong-runtime callbacks stay denied
  (still observed as 403 whenever identity mismatched; covered by
  `TestHandleTaskCheckpointRejectsWrongRuntime` and the callback-signature tests).
- No receipts were faked and no receipt verification was relaxed.
- Direct routing is not treated as equivalent to runtime execution — the proofs
  still require a real runtime-forwarded receipt.
- Changes are limited to the four proof scripts. No product/Go code, no deploy,
  staging, production migration, secret, or landing changes.
