# Igris Promise Audit: Run, Recover, Prove

Date: 2026-05-23

## Executive Summary

Igris partially delivers the promise today.

The strongest production-ready path is the durable task path through `POST /v1/tasks/submit`: the coordinator creates a task, classifies the action, records an action policy decision before dispatch, records a runtime boundary, dispatches to a selected runtime, persists checkpoints/WAL state, accepts signed runtime artifacts, stores receipt lineage, and can run fresh proof verification.

The recovery and proof foundations are real, but not complete enough to claim all scenarios are fully proven. Recovery is conservative for irreversible/non-replayable work and records handoff decisions, but broad multi-runtime portability remains experimental. Proof is stronger than logs because receipt hashes, signatures, runtime keys, and chain links are checked, but proof is unavailable unless the runtime returns signed artifacts and a registered key is present. Runtime callback trust is stronger after the signed-envelope hardening: checkpoint, complete, and failed callbacks now require a signed runtime-bound envelope in strict mode.

## Execution Path Traced

1. Client calls `POST /v1/tasks/submit` in `igris-overture/api/routes_tasks.go`.
2. The request is normalized into a runtime-facing task definition. `action_task` compiles to an `execution_graph`.
3. `TaskCoordinator.Submit` creates `task_records` through `CheckpointStore.CreateTask`.
4. The coordinator selects a healthy runtime with `selectRuntime`.
5. `evaluateActionPolicy` classifies the task, records action digest, replay class, irreversibility, human gate, risk, and checkpoint portability.
6. `SaveActionPolicyDecision`, `SetLatestPolicyDecision`, and `SaveExecutionBoundary` persist governance before dispatch.
7. Denied policy returns before `MarkDispatched`; approval-required marks `approval_required` and stores `approval_requests`.
8. Allowed policy calls `MarkDispatched`, builds a signed permission envelope when capabilities are present, and dispatches to `/v1/runtime/task/submit`.
9. Runtime response may include checkpoint, execution envelope, execution receipt, and step receipts.
10. Checkpoints are persisted with `SaveCheckpoint`; WAL entries are validated for task ownership, stable entry IDs, and watermark consistency.
11. Runtime artifacts are verified before persistence with registered runtime Ed25519 keys.
12. Receipts are persisted into `execution_lineage`; task proof state is synced from lineage.
13. `POST /v1/tasks/:id/proof/verify` performs fresh cryptographic and chain-link verification and persists safe summaries.
14. `GET /v1/tasks/:id` returns task lifecycle, policy, boundary, recovery, handoff, receipt, proof, checkpoint, and action evidence for the console.

Callback-only routes now have a separate control-plane trust check before mutation:

1. Runtime posts `POST /v1/tasks/:id/checkpoint`, `complete`, or `failed` with `X-Igris-Callback-Envelope`.
2. Overture validates tenant ID, task ID, runtime ID, callback type, body digest, timestamp freshness, nonce replay, and Ed25519 signature against the registered runtime key.
3. Rejected callbacks are persisted as safe `boundary_violations` evidence with reason and body digest only.

## IDs Connecting The Chain

`task_id` is the primary spine. It connects `task_records`, checkpoints, action policy decisions, recovery events, handoff events, boundaries, verification results, and task detail.

`execution_id` links runtime receipts to `execution_lineage`, proof receipt routes, execution run detail, and task proof state.

`latest_policy_decision_id` links `task_records` to `action_policy_decisions`; `policy_decision_id` also appears in boundaries and verification results.

`runtime_id` links selected runtime, task dispatch, runtime registry public key lookup, boundaries, handoffs, checkpoints, and receipt verification.

`checkpoint_digest` links recovery events, handoff events, task checkpoint summary, and verification results where a checkpoint exists.

`action_digest` links policy decisions to verification results.

## Confirmed Guarantees

- Policy decision is evaluated and persisted before runtime dispatch in the durable task path.
- Denied built-in action policy blocks dispatch.
- Approval-required actions pause as `approval_required` before dispatch.
- Irreversible actions are marked non-replayable and same-runtime-only.
- Recovery attempts for irreversible actions are denied by policy.
- Checkpoint payloads are rejected when task IDs do not match, entry IDs are nil, or watermarks are inconsistent.
- Runtime artifact verification requires a runtime key and cryptographic receipt validation before storing task artifacts.
- Receipt verification checks canonical hash, Ed25519 signature, runtime key presence, and chain-link continuity.
- Runtime callback envelopes are mandatory in strict mode for checkpoint, complete, and failed callback routes.
- Runtime callback envelopes bind tenant, task, runtime, callback type, exact body digest, timestamp, nonce, and Ed25519 signature.
- Stale, replayed, malformed, body-tampered, wrong-runtime, missing-key, and terminal-state callback attempts are rejected and auditable.
- Governance APIs are BetterAuth-scoped and query by tenant ID.
- Console task detail is driven by `GET /v1/tasks/:id` and says evidence is unavailable when missing.
- Raw evidence display/export is frontend-redacted.

## Broken Or Weak Guarantees

- Boundary records are mostly expected/declarative policy evidence. They do not prove OS/container isolation by themselves.
- Proof is unavailable when runtime artifacts or runtime public keys are missing. The system handles this honestly, but product claims must not imply proof exists for every run.
- `SaveCheckpoint` does not cryptographically verify WAL entry signatures today; it validates shape and task linkage.
- Multi-runtime portability is guarded by policy and handoff decisions, but compatible-runtime execution remains experimental.
- The console API client can fall back to mock data when feature flags permit it; production must disable mock fallback.
- Runtime-side signed callback sender code now sends checkpoint, complete, and failed callback envelopes when callback configuration is provided. The synchronous runtime submit response still carries execution artifacts and receipts for the existing durable path.

## Security Findings

- Sensitive proof inputs are mostly treated as evidence references, not raw secret payloads.
- Server-side proof responses persist safe booleans and reason strings rather than receipt payloads.
- Governance list endpoints do not expose raw resume tokens or private keys.
- Runtime-submitted callback identity is now checked server-side with signed callback envelopes and registered runtime public keys.
- Rejected runtime callbacks are persisted as `boundary_violations` with safe reason and digest fields, not raw bodies or secrets.

## Recovery Findings

- Recovery loop detects stale runtimes, marks tasks recovering, loads cumulative checkpoints, records `runtime_failed`, evaluates recovery policy, records handoff allow/deny, and redispatches only when allowed.
- Invalid cumulative checkpoints fail recovery.
- Streaming/non-resumable tasks are skipped or failed rather than blindly resumed.
- Irreversible and non-replayable actions are blocked from automatic recovery replay.
- Duplicate callbacks are constrained by nonce replay protection and task status transitions; terminal tasks do not accept further runtime mutations.

## Proof Findings

- Logs are not treated as proof in the audited path.
- Receipt proof requires canonical hash validation, Ed25519 signature validation, runtime key presence, and chain-link verification.
- Missing runtime key produces non-verified state, not verified.
- Verification result persistence links back to task, execution, policy decision, checkpoint digest, and action digest when present.

## Endpoint Audit

Audited endpoints:

- `POST /v1/tasks/submit`
- `GET /v1/tasks/:id`
- `GET /v1/tasks/:id/steps`
- `POST /v1/tasks/:id/checkpoint`
- `POST /v1/tasks/:id/complete`
- `POST /v1/tasks/:id/failed`
- `POST /v1/tasks/:id/proof/verify`
- `GET /v1/execution/runs`
- `GET /v1/execution/runs/:id`
- `GET /v1/execution/governance/summary`
- `GET /v1/execution/governance/policy-decisions`
- `GET /v1/execution/governance/recovery-events`
- `GET /v1/execution/governance/handoff-events`
- `GET /v1/execution/governance/boundary-violations`
- `GET /v1/execution/governance/verification-results`
- `GET /v1/execution/governance/runtimes`
- `GET /v1/execution/governance/runtimes/:runtime_id`
- `GET /v1/execution/governance/boundaries`
- `GET /proof/receipts`
- `POST /proof/receipts/verify`

## Recommended Next Engineering Slice

Complete the runtime callback integration slice:

- Promote failed-callback and recovery-blocking scenarios into the live local promise flow.
- Add an operator-facing metric/count for rejected runtime callback violations.
- Add a migration cleanup/retention policy for `runtime_callback_nonces`.
- Keep `IGRIS_ALLOW_UNSIGNED_RUNTIME_CALLBACKS` disabled outside explicit local development.
