# Igris Core Reuse Map

Version: 2026-07-10
Base branch: `origin/main`
Base commit: `e48fc4238ec4f5e3e0d331f10ab53fbedd5e90f2`

This document characterizes the current Igris core for future Progressive SDK
integration. It does not define the Embedded SDK action-contract schema, event
schema, journal format, local signing format, or ingestion endpoints.

## Current product-direction summary

Igris is moving toward a drop-in action layer for AI agents:

- Embedded: local guard, approval, execution observation, signed local evidence,
  and offline verification. This is owned by the parallel SDK branch and is not
  integrated here.
- Connected: SDK-declared actions connect to shared policy, durable team
  approval, synchronized action contracts, and centralized evidence.
- Managed: selected actions execute through the Igris runtime using the current
  runtime identity, dispatch, callback authentication, anti-replay, checkpoint,
  recovery, containment, and receipt systems.

The existing backend is strongest when it treats actions as tenant-owned durable
task executions. Future SDK integration should adapt into those boundaries
rather than weakening registered-action enforcement, tenant scoping, callback
signatures, proof semantics, or recovery governance.

## Existing core component inventory

| Area | Current implementation | Evidence |
| --- | --- | --- |
| Action registration | `action_definitions` model, create/list/get/patch/archive routes, action target vocabulary, secret/metadata sanitization | `igris-overture/api/routes_actions.go`, `igris-overture/database/migrations/054_action_definitions.sql`, `igris-overture/database/migrations/055_action_execution_targets.sql`, `igris-overture/api/routes_actions_test.go` |
| Registered action execution | `/v1/actions/run` and `/v1/actions/:name/run` resolve a tenant-scoped registered action before building a durable task | `igris-overture/api/routes_actions.go`, `igris-overture/api/routes_actions_test.go` |
| Direct task submission | `/v1/tasks/submit` accepts task-specific public shapes and compiles them to normalized task definitions | `igris-overture/api/routes_tasks.go`, `igris-overture/api/routes_tasks_test.go` |
| Policy evaluation | `evaluateActionPolicy` derives allow, deny, approval-required, replay class, irreversible flags, checkpoint portability, and human gating | `igris-overture/coordinator/execution_governance.go`, `igris-overture/coordinator/execution_governance_test.go` |
| Approval lifecycle | Approval-required tasks pause before dispatch; approve/reject requires tenant ownership and atomic state transitions | `igris-overture/coordinator/task_approval.go`, `igris-overture/coordinator/task_approval_test.go`, `igris-overture/api/routes_actions_approval_test.go` |
| Task lifecycle | `TaskCoordinator.Submit` creates tenant-scoped task records, protects sensitive inputs, selects a runtime, persists policy/audit state, and dispatches asynchronously | `igris-overture/coordinator/task_coordinator.go`, `igris-overture/coordinator/task_coordinator_test.go` |
| Runtime registration and routing | Runtime registration, heartbeat, command fetch, command ack, download, endpoint normalization, and tenant-scoped runtime selection | `igris-overture/api/routes_runtime.go`, `igris-overture/api/routes_runtime_test.go`, `igris-overture/internal/runtime_endpoint.go`, `igris-overture/internal/runtime_selector.go` |
| Runtime callbacks | Checkpoint, complete, and failed callbacks require tenant auth plus signed runtime callback envelope unless the explicit unsafe env override is set | `igris-overture/api/routes_tasks.go`, `igris-overture/api/runtime_callback_signature.go`, `igris-overture/api/routes_tasks_test.go` |
| Idempotency | Task insertion deduplicates by `(tenant_id, idempotency_key)` and tenant-scoped lookup returns the existing task on repeat | `igris-overture/coordinator/checkpoint_store.go`, `igris-overture/coordinator/task_idempotency_test.go`, `igris-overture/database/migrations/057_task_records_tenant_scoped_idempotency.sql` |
| Input persistence and redaction | Sensitive execution inputs are encrypted into execution-input refs when keying is configured; safe task/action responses summarize instead of exposing raw payloads | `igris-overture/coordinator/input_ref_transform.go`, `igris-overture/coordinator/execution_input_refs.go`, `igris-overture/api/routes_actions_test.go`, `igris-overture/coordinator/execution_input_refs_store_test.go` |
| Evidence and receipts | Runtime artifacts are cryptographically verified, persisted on task records, projected to execution lineage, and read through tenant-scoped proof/receipt APIs | `igris-overture/coordinator/task_coordinator.go`, `igris-overture/coordinator/checkpoint_store.go`, `igris-overture/api/routes_proof.go`, `igris-overture/api/routes_proof_tenant_scope_test.go`, `igris-overture/api/routes_proof_contract_test.go` |
| Checkpoints | Runtime checkpoints persist cumulative WAL state and only accept advancing checkpoints for mutable task states | `igris-overture/coordinator/checkpoint_store.go`, `igris-overture/coordinator/checkpoint_store_test.go`, `igris-overture/api/routes_tasks_test.go` |
| Recovery | Failed-runtime recovery is conservative, records handoff decisions, blocks unsafe irreversible replay, and reports explicit skip reasons | `igris-overture/coordinator/task_coordinator.go`, `igris-overture/coordinator/execution_governance.go`, `igris-overture/api/routes_tasks_test.go`, `docs/DURABLE_EXECUTION_RECOVERY.md` |
| Containment | Runtime containment remains managed-runtime behavior; CI Tier A reports unsupported cgroup containment as skipped, and Tier B must fail if required containment is unavailable | `scripts/ci_proof_gate.sh`, `CONTAINMENT_TIER_SPLIT_2026-07-05.md`, `CONTAINMENT_GATE_DECISION_2026-07-05.md`, `igris-overture/api/containment_gate_contract_test.go` |
| Route surface | Default route manifest is deterministic and classifies public, runtime, console, internal, debug, and experimental routes | `igris-overture/api/route_manifest_test.go`, `igris-overture/api/route_surface_test.go`, `igris-overture/api/testdata/route_manifest.default.json` |

## Verified behavior and test coverage

New characterization tests added in this branch:

- `TestBuildActionRunRequestFromDefinitionOverridesReservedCallerMetadata`:
  reserved dispatch metadata is sourced from the stored action definition, not
  caller-provided metadata.
- `TestRuntimeCallbackPublicKeyLookupIsTenantScoped`: callback verification keys
  are loaded by `(tenant_id, runtime_id)`.
- `TestContainmentProofGateReportsUnsupportedAsSkippedNotPassed`: the CI proof
  gate must represent unsupported containment as skipped or failed, never passed.

Existing coverage used as reuse evidence:

- Action registration, target normalization, registered execution, tenant
  ownership, local runtime fail-safe behavior, action-pack installation, and raw
  task bypass rejection: `igris-overture/api/routes_actions_test.go`,
  `igris-overture/api/routes_action_packs_test.go`.
- Approval gating and invalid state transitions: `igris-overture/api/routes_actions_approval_test.go`,
  `igris-overture/coordinator/task_approval_test.go`.
- Tenant-scoped idempotency: `igris-overture/coordinator/task_idempotency_test.go`
  and optional Postgres coverage in `task_idempotency_postgres_test.go`.
- Runtime callback signature, body digest, freshness, nonce replay, runtime
  identity, terminal callback rejection, and transition races:
  `igris-overture/api/routes_tasks_test.go`,
  `igris-overture/api/runtime_callback_signature_test.go`.
- Receipt and proof tenant scoping, chain verification contract, and safe
  summaries: `igris-overture/api/routes_proof_tenant_scope_test.go`,
  `igris-overture/api/routes_proof_contract_test.go`,
  `igris-overture/coordinator/execution_lineage_tenant_test.go`.
- Checkpoint, cumulative recovery checkpoints, recovery skip reasons, and safe
  forward behavior: `igris-overture/coordinator/checkpoint_store_test.go`,
  `igris-overture/coordinator/execution_governance_test.go`,
  `igris-overture/api/routes_tasks_test.go`.
- Default route exposure: `igris-overture/api/route_manifest_test.go` and
  `igris-overture/api/route_surface_test.go`.

## Stable public API candidates

These are candidates for future Connected or Managed integration. They are not
SDK APIs as-is.

- `POST /v1/actions`, `GET /v1/actions`, `GET /v1/actions/:id`, `PATCH
  /v1/actions/:id`, `DELETE /v1/actions/:id`: current manual action definition
  lifecycle. Future contract synchronization can reuse the storage semantics
  behind an adapter.
- `POST /v1/actions/run` and `POST /v1/actions/:name/run`: supported registered
  action execution path. This should remain the public action execution route
  for backend-managed runs.
- `POST /v1/actions/runs/:id/approve` and `/reject`: current durable approval
  decision routes.
- `GET /v1/actions/runs/:id`, `GET /v1/tasks/:id`, `GET /v1/tasks/:id/steps`:
  safe operator/read model candidates.
- Runtime registration/callback routes under `/api/v1/runtime/*` and
  `/v1/tasks/:id/{checkpoint,complete,failed}`: Managed-mode infrastructure,
  not Embedded-mode APIs.
- Proof/receipt reads under `/proof/receipts`, `/v1/receipts`, and
  `/v1/tasks/:id/proof/verify`: centralized evidence read APIs, not local
  offline verification.

## Stable internal service boundaries

- `coordinator.TaskCoordinator.Submit`: durable Managed execution entry point
  after a trusted caller has built a normalized task request.
- `coordinator.CheckpointStore`: task, checkpoint, proof, lineage, approval, and
  recovery persistence boundary.
- `evaluateActionPolicy`: policy characterization boundary for task definitions.
- `buildActionRunRequestFromDefinition`: registered-action-to-runtime-task
  adapter for current manual action records.
- `buildTaskSubmitRequest`: public task-shape normalization boundary.
- `internal.NormalizeHTTPRuntimeEndpoint` and runtime selector methods:
  routability and runtime selection boundary.
- Runtime callback validation in `runtime_callback_signature.go`: signed
  callback authentication boundary.

## Current manual action-registration flow

1. Tenant authenticates through BetterAuth.
2. Tenant creates an action definition under `/v1/actions`.
3. Server normalizes target type, method, policy preset, replay class, fallback
   policy, and redacts unsafe metadata or secret-looking values.
4. Tenant invokes by action id or name.
5. Server loads the tenant-scoped action record and builds the runtime task from
   authoritative stored metadata.
6. Task submission persists a durable task, evaluates policy, optionally pauses
   for approval, and dispatches only after gates pass.

Manual registration is still the current primary flow. Automatic
code-declared registration is not implemented.

## Potential automatic contract-registration seam

A future Connected adapter can map a code-declared contract into
`action_definitions` only after the SDK contract is final. Minimum backend
information needed:

- tenant identity from authenticated connection, never from SDK request body
- stable logical action name
- version or fingerprint that preserves historical meaning
- target mode: connected local observation, managed runtime execution, hosted
  webhook, or another explicit target
- replay class and irreversibility semantics
- approval policy intent or policy lookup key
- safe display metadata
- sanitized input/output schema references, not raw prompts or secrets
- secret references by name or vault reference, not values

Current schema can hold name, target type, policy preset, replay class,
irreversibility, approval flag, and sanitized metadata. It does not currently
model a first-class SDK contract fingerprint or version conflict policy.

## Current approval flow

Approval is task-bound and tenant-bound. Policy evaluation can return
`approval_required`; the task stays in `approval_required` and is not dispatched.
Approve selects a healthy runtime before atomically claiming the task and
dispatching. Reject marks the task failed and never dispatches. Repeated or
invalid transitions return explicit conflict behavior.

## Potential Connected approval seam

Connected mode can reuse the approval request/store/transition model for
backend-mediated decisions. It needs an adapter that creates the right durable
decision record for an SDK-declared logical action without pretending local
Embedded execution is managed by Igris runtime. Approval decisions must remain
bound to tenant, logical action, contract version/fingerprint, and execution
attempt.

## Current evidence and receipt flow

Managed runtime artifacts are verified against the registered runtime public key,
persisted to task records, projected into execution lineage, and exposed through
safe tenant-scoped proof/receipt APIs. Failure, missing proof, unverified proof,
signature mismatch, chain mismatch, and success remain distinguishable.

## Potential local-evidence ingestion seam

A future local-evidence ingestion path can reuse tenant-scoped storage and proof
read models only behind a provenance adapter. It must preserve that local
Embedded evidence is locally observed evidence, not Igris-managed runtime
evidence. Do not store local JSONL events as runtime receipts unless the final
SDK schema and cryptographic provenance can represent that truthfully.

Blocked on SDK contract:

- local decision event fields
- local outcome event fields
- local signing identity and key registration
- whether local evidence has action contract fingerprints
- whether local evidence can include raw inputs, redacted summaries, or digests
- offline verification result format

## Current runtime dispatch flow

`TaskCoordinator.Submit` normalizes task definitions, protects sensitive inputs,
persists a pending task, selects a tenant-owned routable runtime, evaluates
policy, persists policy/audit records, marks dispatched, signs the dispatch
request, and sends a runtime task submit payload. Runtime callbacks then update
checkpoint, completion, or failure state under signed callback authentication.

## Potential Managed execution seam

Managed SDK execution can reuse the current task coordinator and runtime
callback system if the SDK-selected action is explicitly marked Managed and
converted to the same normalized durable task format. It must not infer Managed
runtime guarantees for Embedded/local-only execution.

## Tenant and identity boundaries

- BetterAuth-derived tenant is the source of tenant identity on action/task/read
  routes.
- Action definition lookup includes `tenant_id`.
- Runtime key lookup for callbacks includes `tenant_id` and `runtime_id`.
- Receipt and proof reads filter by tenant and avoid tenant-null fallback.
- Runtime selection filters by tenant, health, active status, nonblank endpoint,
  recent heartbeat, and endpoint routability.
- Body `tenant_id` overrides are rejected or ignored by the current routes.

## Idempotency and replay boundaries

- Task idempotency is scoped by `(tenant_id, idempotency_key)`.
- Runtime dispatch on resume derives a resume-specific idempotency key using
  last committed step and checkpoint digest.
- Runtime callback replay is blocked by `(tenant_id, runtime_id, nonce)` plus
  signed timestamp freshness and body digest.
- Current task idempotency does not persist a request payload fingerprint.
  Same-tenant key reuse returns the existing task according to the current
  contract; it does not explicitly detect a changed payload. A future SDK
  synchronization endpoint should add a contract fingerprint/version conflict
  rule instead of reusing task idempotency as-is.

## Checkpoint and recovery boundaries

- Checkpoints are accepted only for mutable task states.
- Checkpoint payload task id is enforced from the route URL.
- Callback runtime identity must match the assigned task runtime when available.
- Checkpoints must advance cumulative WAL state.
- Recovery records handoff decisions and skip reasons.
- Irreversible or non-retryable work is not blindly replayed.
- Streaming non-resumable and unsupported recovery states fail or skip
  explicitly.

## Containment boundaries

Containment is a Managed-runtime guarantee. The current proof gate treats
GitHub-hosted or other cgroup-incapable Linux environments as unsupported for
execution-containment proofs. Tier B with `IGRIS_REQUIRE_CONTAINMENT=1` must fail
if containment is unavailable. Unsupported containment is skipped or failed,
never passed.

Embedded local execution must not claim current runtime containment guarantees.

## What can be reused unchanged

- Tenant-scoped action read/write authorization pattern.
- Registered action execution path as the backend public execution path.
- Approval state machine and audit row pattern.
- Runtime callback signature envelope and nonce replay protection.
- Receipt/proof tenant-scoped read guards.
- Route manifest and route-source guard tests.
- Conservative recovery decision model for Managed runtime work.

## What likely needs an adapter

- Code-declared contract synchronization into `action_definitions`.
- Connected policy lookup for SDK-declared logical actions.
- Local evidence ingestion into centralized evidence views.
- SDK action versions/fingerprints mapped to current action identifiers.
- Managed selection that turns an SDK logical action into a normalized durable
  task without copying backend database models into the SDK API.

## What likely needs refactoring

- First-class contract fingerprint/version persistence for automatic
  synchronization conflict detection.
- Explicit provenance model separating local observed evidence from
  runtime-managed receipts.
- Clear separation of manual registration fields from SDK synchronization
  fields if both flows must coexist for a transition period.
- Idempotency conflict behavior for contract synchronization; task idempotency is
  not enough because it lacks payload identity.

## What must not be reused for Embedded mode

- Runtime registration and heartbeat as proof that local Embedded execution is
  managed.
- Runtime callback endpoints for local JSONL events unless a future authenticated
  ingestion adapter is explicitly designed.
- Managed recovery, checkpoints, and containment claims.
- Runtime receipt verification language for local-only evidence unless the final
  SDK cryptographic format supports equivalent guarantees.
- Automatic dispatch or hidden network behavior.

## Known schema or semantic mismatches

- `action_definitions` has no explicit SDK contract fingerprint/version field.
- Task idempotency lacks payload identity comparison.
- Current task records assume runtime dispatch for durable execution.
- Local observed execution and managed runtime execution are not represented as
  distinct evidence provenance classes.
- Hybrid fallback model exists, but the resolver is intentionally not wired.
- Containment evidence depends on runtime and host capability, not on backend
  task state alone.

## Questions blocked on the Embedded SDK's final contract

- Exact code-declared action identifier format.
- Contract versioning and compatibility semantics.
- Local decision and outcome event schema.
- Local signature key registration and rotation semantics.
- Whether local evidence includes raw input, redacted input, or digests only.
- Offline verifier output shape.
- How local approval maps to team approval in Connected mode.
- Whether Embedded can run entirely offline with no backend attempt.
- Which fields are stable enough for centralized search, proof, and operator
  review.

## Recommended integration sequence

1. Land Embedded SDK foundation independently.
2. Define the final SDK contract and local evidence schemas.
3. Add a Connected contract synchronization adapter with tenant-scoped
   authentication, contract fingerprinting, idempotent repeat behavior, and
   explicit conflict behavior.
4. Add Connected approval tests that prove denial/approval semantics without
   changing decorated application code.
5. Add local evidence ingestion with explicit provenance and safe redaction.
6. Add Managed opt-in that maps the same logical action identity to the existing
   task coordinator/runtime path.
7. Reuse current callback, checkpoint, recovery, containment, and receipt tests
   for Managed SDK execution.

## Explicit non-goals

- No Python SDK implementation.
- No `@igris.guard` API definition.
- No Embedded SDK action-contract or event schema.
- No ingestion endpoint.
- No database migration in this branch.
- No deployment.
- No production credentials.
- No claim that Connected or Managed SDK execution exists today.

## Classification table

| Component | Current responsibility | Verified by | Embedded relevance | Connected relevance | Managed relevance | Reuse classification | Risks or gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `action_definitions` and action routes | Tenant-owned manual action registry | `routes_actions_test.go`, migrations 054/055 | Reference only | Contract sync target behind adapter | Logical action source | reuse behind adapter | Missing contract fingerprint/version |
| `/v1/actions/run`, `/:name/run` | Registered action execution | `routes_actions_test.go` | Not suitable for offline Embedded | Connected execution decision surface | Managed execution entry | reuse unchanged | Must not accept raw unregistered task payloads |
| Action request builder | Converts stored action record to task input | New reserved-metadata test, `routes_actions_test.go` | Reference only | Adapter can reuse concepts | Reuse for current action records | reuse unchanged | Current builder is tied to stored DB model |
| Policy evaluation | Allow/deny/approval/recovery semantics | `execution_governance_test.go` | Local policy may differ | Shared policy engine candidate | Runtime dispatch gate | reuse behind adapter | Requires SDK contract mapping |
| Approval lifecycle | Human approval gate | `task_approval_test.go`, `routes_actions_approval_test.go` | Local-only approval remains separate | Durable team approval seam | Managed dispatch gate | reuse unchanged | Approval must bind contract version/attempt |
| TaskCoordinator | Durable task creation and dispatch | `task_coordinator_test.go`, `routes_tasks_test.go` | Not suitable | Limited Connected orchestration | Core Managed path | managed-only | Assumes remote runtime dispatch |
| Runtime registry/selector | Tenant runtime identity, health, endpoint routing | `routes_runtime_test.go`, `runtime_selector_test.go` | Not suitable | Runtime availability visibility | Core Managed path | managed-only | Endpoint/routability must stay fail-closed |
| Runtime callback signature | Authenticated callbacks and replay protection | `routes_tasks_test.go`, new public-key test | Not suitable | Possible ingestion pattern, not direct reuse | Core Managed path | managed-only | Requires registered runtime key |
| Task idempotency | Tenant-scoped task dedupe | `task_idempotency_test.go` | Reference only | Needs stronger contract sync idempotency | Useful for task attempts | reuse behind adapter | No payload fingerprint conflict detection |
| Execution input refs | Encrypt/redact sensitive task inputs | `execution_input_refs_store_test.go`, action tests | Reference for local redaction | Useful for centralized ingestion | Core Managed path | reuse behind adapter | Requires keyring; no raw input persistence |
| Evidence/receipt storage | Runtime proof and lineage | proof/lineage tests | Local evidence needs separate provenance | Centralized evidence candidate | Core Managed proof | reuse behind adapter | Must not mislabel local evidence as managed |
| Checkpoints | WAL checkpoint persistence | checkpoint tests, callback tests | Not suitable | Not needed for Connected local execution | Core Managed recovery | managed-only | Authenticated callback required |
| Recovery governance | Safe-forward recovery and skip reasons | governance/recovery tests | Not suitable | Not relevant to local-only execution | Core Managed recovery | managed-only | No generic exactly-once claim |
| Containment gate | Truthful proof-tier reporting | new containment gate test, shell script | Not suitable | Not relevant | Managed runtime proof | managed-only | Tier B infrastructure may be unavailable |
| Route manifest | Public/experimental route exposure guard | `route_manifest_test.go`, `route_surface_test.go` | Reference | Protects new Connected routes | Protects Managed routes | reuse unchanged | Must update intentionally on route additions |

## Future integration test plan

Implement these only after the Embedded SDK branch lands and the SDK contracts are
final:

1. A code-declared SDK action contract is accepted without manual console
   registration.
2. Repeated synchronization of the same contract is idempotent.
3. A changed contract produces a new version or explicit conflict rather than
   silently replacing historical meaning.
4. A contract cannot be synchronized into another tenant.
5. Connected policy can require approval without changing decorated application
   code.
6. Connected denial prevents execution according to final Connected semantics.
7. Local evidence can be ingested without being represented as runtime-managed
   evidence.
8. Backend reads preserve the distinction between locally observed and
   Igris-managed execution.
9. A selected action can move to Managed execution without changing its logical
   action identity.
10. Managed execution uses existing runtime authentication, anti-replay,
    checkpoint, recovery, containment, and evidence behavior.
11. Disconnected or unavailable backend behavior is explicit and policy-driven.
12. Embedded mode has no hidden phone-home behavior.
