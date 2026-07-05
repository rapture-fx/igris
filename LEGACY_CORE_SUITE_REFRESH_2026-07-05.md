# Legacy core-suite proof refresh (2026-07-05)

Follow-up to PR #71 (checkpoint-403 fix). The heavy proof gate's "core proof
suite" (`scripts/proof_suite.sh`) runs four legacy sub-proofs. `task_v1` was
fixed and merged in PR #71. The other three have **independent bit-rot bugs**
and are tracked here, deliberately kept out of PR #71.

All findings were reproduced locally against an isolated Postgres proof DB
(`igris_overture_proof`) with the same migration chain the CI gate applies.

## Status

| Sub-proof | State | Remaining work |
|-----------|-------|----------------|
| `task_v1_proof_demo.sh` | ✅ Fixed in PR #71 | — |
| `unified_execution_proof_demo.sh` | ⚠️ Partial | direct-routing / missing runtime receipt |
| `fallback_execution_proof_demo.sh` | ⚠️ Partial | same direct-routing / receipt issue |
| `checkpoint_proof_demo.sh` | ⚠️ Partial | recovery Runtime 2 callback identity |

## Partial fixes already applied on this branch (correct, but not sufficient)

- **checkpoint**: tenant seed corrected to canonical `tenant_id`/`tenant_email`
  schema; Overture launch given `DATABASE_URL`/`POSTGRES_URL`/`ENABLE_PERSISTENCE`
  and the `IGRIS_RUNTIME_CALLBACK_*` env. With these, Runtime 1's checkpoint now
  succeeds (callback accepted, proof verified) and recovery hands off to
  Runtime 2 — surfacing the remaining identity bug below.
- **unified / fallback**: made bash-3.2 safe (`${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"}`)
  so they run on macOS; this also lets them reach the verify step, surfacing the
  routing/receipt bug below.

## Remaining issues to fix

### 1 & 2. unified / fallback: direct-routing fallback → no runtime receipt
The inference request is served by Overture falling back to **direct provider
routing** instead of forwarding to the Runtime, so no runtime receipt
(`receipts.jsonl`) is written and the verify step fails with `ENOENT`. Need to
determine why the request is not forwarded to the Runtime in these proofs
(runtime routing/readiness/registration) and make the proof assert real
runtime-forwarded execution (or update the proof if direct routing is the
intended path — but then it must not require a runtime receipt).

### 3. checkpoint: recovery Runtime 2 callback identity mismatch
The proof pins each runtime's `mcp.peer_id` to a **fixed string**
(`checkpoint-runtime-1` / `checkpoint-runtime-2`), but Overture assigns each
registered runtime a random UUID. On recovery, the task is redispatched to
Runtime 2's registered UUID, while Runtime 2 signs its callbacks as
`checkpoint-runtime-2` → `runtime callback identity does not match assigned task
runtime` (403) → heartbeat goes stale → `no runtime available for recovery`.
This is the same class as the task_v1 fix: the recovery runtime must present the
identity Overture assigned it (pin `peer_id` to the registered runtime_id, or
seed `runtime_instances` so the assigned id equals the pinned peer id — for both
Runtime 1 and Runtime 2).

## Non-negotiables (same as PR #71)
- Do not weaken runtime callback auth. Signature/identity/tenant/timestamp/replay
  checks stay; unauthorized/wrong-runtime callbacks stay denied.
- No deploy / staging / production migration / secret / landing changes.
- Verify each proof end-to-end locally before dispatching heavy proof.
