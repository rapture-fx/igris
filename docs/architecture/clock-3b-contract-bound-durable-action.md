# Clock 3B — Contract-Bound Durable Igris Action Engineering Report

## Executive summary

Clock 3B lands the smallest safe bridge from an exact immutable SDK `ActionContract` version to one executable HTTP Action target, propagates that binding through Overture durable execution and clean-host recovery, and proves exactly-once consequential effect behavior while keeping Action Protocol Evidence and Runtime receipts as separate claims linked to the same durable run.

**End-to-end proof result:** `scripts/clock_3b_contract_bound_durable_action_proof.sh` succeeded locally (exit 0). Consequential HTTP effect count = 1; endpoint invocations = 1; Runtime 1 → Runtime 2 recovery completed; Runtime receipts verified; Action Protocol journal verified independently with `igris-verify` from protocol release `f98ef76e4fe0cb6b52341639d42cf99213623465`; tampered journal rejected; linked proof view exposed both claim types for the same bound run.

## Final implementation verdict

**IMPLEMENTED_AND_PROVEN** for the narrow Clock 3B durable-local path.

This does **not** unify the entire Igris product. It proves the first coherent contract-bound **Run → Recover → Prove** path connecting the Embedded Action Gate (`igris.wrap_tool`) to Overture + Rust Runtime typed recovery without deploying Python into Runtime and without merging evidence schemas.

## Verified implementation base SHA

| Item | Value |
|------|-------|
| Implementation base / `origin/main` | `1ef093a96dc8ae55c317266aa9b0dc94e5b08579` |
| Protocol release commit | `f98ef76e4fe0cb6b52341639d42cf99213623465` |
| Frozen protocol manifest SHA-256 | `864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4` |
| Clock 3A architecture report | `docs/architecture/unified-igris-action-gate.md` |

Clock 3A assumptions remain applicable: Overture reconciliation of exact contract→target binding was the missing bridge; clean-host typed recovery already existed; Evidence and Runtime receipts stay distinct.

## Branch and final HEAD

| Item | Value |
|------|-------|
| Branch | `feature/clock-3b-contract-bound-durable-action` |
| Branch tip (pre-commit working tree) | still based on `1ef093a96dc8ae55c317266aa9b0dc94e5b08579` (implementation uncommitted at report time) |

No merge to `main`. No force-push. PR #78 / #79 and Clock 2G.1 publication work were not touched.

## Files changed

### Overture / API / coordinator
- `igris-overture/database/migrations/070_contract_execution_bindings.sql` (new)
- `igris-overture/api/contract_binding_store.go` (new)
- `igris-overture/api/contract_bound_action_test.go` (new)
- `igris-overture/api/routes_contracts.go`
- `igris-overture/api/routes_actions.go`
- `igris-overture/api/routes_contracts_test.go`
- `igris-overture/api/routes_contracts_postgres_test.go`
- `igris-overture/api/route_manifest.go` + `testdata/route_manifest.default.json`
- `igris-overture/coordinator/checkpoint_store.go`
- `igris-overture/coordinator/task_coordinator.go`
- `igris-overture/coordinator/execution_governance.go`
- `igris-overture/coordinator/execution_input_refs.go`
- `igris-overture/coordinator/contract_bound_policy_test.go` (new)

### Demo / proof / CI
- `examples/clock_3b_contract_bound_adapter.py` (new)
- `sdk/python/tests/test_clock_3b_adapter_example.py` (new)
- `scripts/clock_3b_contract_bound_durable_action_proof.sh` (new)
- `scripts/action_task_v1_recovery_proof_demo.sh` (Clock 3B mode + clean-host teardown hardening)
- `scripts/ci_proof_gate.sh` (heavy tier includes Clock 3B)
- `scripts/ci/check_manual_migrations.sh` (migration 070)

### Docs
- this report
- pre-existing Clock 3A report preserved: `docs/architecture/unified-igris-action-gate.md`

## Migration added and application status

| Item | Value |
|------|-------|
| Migration | `070_contract_execution_bindings.sql` |
| Application | **manual / proof-script only** — never auto-applied at Overture startup |
| Proof entrypoint applies | 051–052, 054–057, 062, 067–070 when missing |
| Schema objects | `action_contract_execution_bindings`, `contract_bound_action_runs`, `contract_bound_action_evidence_links` + immutability triggers |

## Contract binding model

Explicit tenant-scoped binding of:

`(tenant_id, action_name, contract_hash) → (target_action_id, target_version, parameter_mapping, endpoint_config_ref, timeout, replay_class, idempotency)`

- Created only via authenticated `POST /v1/contracts/actions/:name/versions/:contract_hash/bindings`
- Never bound automatically by action name
- Synchronized `embedded_sdk` declarations remain non-executable until an explicit binding exists
- Name collision / ambiguity fails closed

## Tenant and immutability guarantees

- Tenant scoping on every binding / bound-run / evidence-link lookup
- Cross-tenant target binding refused (Postgres test coverage)
- Bindings are immutable (DB triggers reject UPDATE/DELETE)
- No `ON DELETE CASCADE` that would fight immutability triggers
- Historical unbound Action rows keep prior semantics

## Parameter mapping model

Deterministic mapping from SDK contract input fields to the HTTP Action target parameters is persisted on the binding. Missing parameters, extra parameters, and type incompatibility fail closed at bind/run time.

## Managed authorization behavior

Overture policy / approval is **managed authorization to dispatch** the durable Action. Bound-contract risk/approval requirements are resolved from the exact `contract_hash` before durable policy execution. Where SDK contract policy and existing Overture Action policy differ, the coordinator applies a deterministic stricter/fail-closed rule (`execution-governance.contract-bound.v1`). Name collision never inherits the wrong contract.

## Embedded authorization behavior

The Python adapter continues to use `igris.wrap_tool` for **local Embedded producer authorization** of the callable. Denial prevents callable execution and returns a non-success result to the durable HTTP step. Overture decisions are not copied into SDK Evidence as if the SDK produced them.

## Two-decision invariant

Managed authorization and Embedded producer authorization are separate assurance layers for the same logical Action. Clock 3B requires both gates to allow execution. They are linked through `contract_hash`, binding ID, task/run ID, and existing metadata — not by inventing new frozen protocol fields.

## Canonical Action identity

Canonical developer API remains `igris.wrap_tool` (Clock 3A). No `igris.action`, `@igris.action`, or generic Executor interface was added.

## Durable run identity

On bound run creation, Overture persists:

- binding ID
- selected `contract_hash`
- executable target ID/version
- business-effect idempotency key / request fingerprint

These survive recovery and appear on the linked proof view. Frozen Runtime receipt schema and Action Protocol Evidence schema were not modified.

## Idempotency propagation

One business-effect idempotency key is generated at the durable Action invocation boundary, persisted on the bound run, carried through Overture dispatch and Runtime HTTP invocation to the adapter. The adapter ledger:

- same key + identical request → returns stored result (no re-effect)
- same key + different request → non-retryable conflict

Recovery-specific dispatch identifiers do not replace the original business-effect key.

## Python HTTP adapter

`examples/clock_3b_contract_bound_adapter.py`:

- one authenticated loopback HTTP endpoint
- one `igris.wrap_tool`-wrapped deterministic consequential function
- strict request validation (reject unknown/missing fields)
- deterministic response shape
- auth token via env / protected input refs — not stored in Evidence

No source upload, wheel upload, pickle, import-path execution, shell execution, or generic remote Python executor.

## Runtime execution graph

Smallest typed graph reused:

1. `http_request` → bound adapter (consequential)
2. `database_write` → remaining deterministic completion step

`checkpoint_after_steps=1` so Runtime 1 stops after the committed HTTP step. No Rust Runtime interface changes were required.

## Controlled failure point

After Runtime 1 commits step 0, returns checkpoint, and Overture durably accepts the signed checkpoint, the proof harness terminates Runtime 1 (process-group-safe kill + port-8080 reclaim) before starting Runtime 2.

## Checkpoint acceptance

Overture verifies and persists the signed checkpoint before recovery is triggered. Proof asserts checkpointed status and committed step lineage before clean-host replacement.

## Clean-host Runtime 2 recovery

- Runtime 2 starts with a distinct empty WAL store (`runtime-2-clean-host.db`)
- Empty-WAL assertion runs before marking Runtime 1 stale
- Runtime 2 identity checked via `/v1/runtime/profile`
- Runtime 1 then marked with stale heartbeat (`is_healthy` left true so `recoverFailedRuntimes` selects it)
- Runtime 2 imports checkpoint, skips committed HTTP step, executes remaining `database_write`
- Task reaches terminal `completed`

## Duplicate-effect assertions

Successful proof reported:

- endpoint invocations: **1**
- consequential effects: **1**
- DB completion rows for task: **1**
- no duplicate committed WAL step indexes (`[0,1]`)

## Runtime receipt verification

Verified through existing Overture `/proof/receipts/verify` and `/v1/tasks/:id/proof/verify` paths. Recovery lineage shows Runtime 1 → Runtime 2 handoff. This report does **not** claim Runtime receipts prove the external side effect or that `igris-verify` validates Runtime receipts.

## Action Protocol Evidence verification

Adapter `wrap_tool` produced frozen decision/outcome Evidence. Verified with `igris-verify` built from protocol release `f98ef76e4fe0cb6b52341639d42cf99213623465` (nested module `conformance/go-verifier`). Machine JSON summary inspected (`summary` starts with `valid_`, `events_verified=2`). Tampered journal summary = `invalid`. Runtime receipt journal is rejected / unsupported by the Action Protocol verifier as expected.

## Linked proof view

`GET /v1/actions/runs/:id` (bound runs) plus `POST /v1/actions/runs/:id/evidence-links` expose a **Linked Igris proof view** referencing:

- `contract_hash` / binding ID
- Overture task/run ID
- Runtime proof status
- Action Protocol evidence batch / chain digest
- recovery lineage / handoff

Clearly labels Action Protocol Evidence and Runtime receipt as separate claims. No universal Evidence schema was invented.

## Evidence versus Runtime receipt claim boundary

| Claim | What it proves | What it does not prove |
|-------|----------------|------------------------|
| Action Protocol Evidence | Embedded gate decision/outcome for the wrapped callable | Managed Overture dispatch, Runtime recovery, or external side-effect uniqueness alone |
| Runtime receipt / Overture lineage | Typed durable execution + recovery under Overture control | Embedded Evidence chain validity via `igris-verify` |
| Linked view | Same durable run identity ties both claims | Protocol-level unification of the two claim types |

## Unit test results

Focused runs (exit 0):

- `go test ./igris-overture/api -run 'TestContract|TestBound|TestRouteManifest|Binding|Clock3'`
- `go test ./igris-overture/coordinator -run 'TestContractBound|Bound|Policy'`
- `uv run --project sdk/python pytest -q sdk/python/tests/test_clock_3b_adapter_example.py` → 2 passed

Full `./igris-overture/api` package run can fail in this environment when unrelated Anthropic startup key validation trips; that failure is outside Clock 3B scope.

## Postgres test results

`TestContractExecutionBindingPostgresTenantScopeAndImmutability` — **PASS** with `POSTGRES_TEST_DSN` / `DATABASE_URL`.

## Integration test results

Covered by API/coordinator tests plus the live Clock 3B proof script path: contract sync → explicit binding → bound run → policy → coordinator identity → Runtime target config → adapter idempotency key → both gates.

## Recovery proof results

`bash scripts/clock_3b_contract_bound_durable_action_proof.sh` → **EXIT 0**

Observed success markers:

- clean-host empty WAL before resume
- Redispatch Runtime 1 → Runtime 2
- `[11/11] Clock 3B contract-bound durable Action proof succeeded`
- endpoint invocations = 1, consequential effects = 1

## Existing proof-gate regression results

- Clock 3B registered in heavy tier of `scripts/ci_proof_gate.sh`
- Manual migration guard updated for `070`
- Full heavy suite (Action Task V1 / clean-host / same-host / cumulative) was **not** fully re-executed in this session due to local disk pressure; the Clock 3B proof reuses and hardens the shared Action Task V1 recovery harness

**Recommendation:** run `scripts/ci_proof_gate.sh` heavy tier on a CI runner with adequate disk before merge.

## Security review

Satisfied for Clock 3B scope:

- no arbitrary Python into Runtime
- no source/wheel/pickle/import-path/shell generic execution
- adapter auth via env + encrypted input refs
- signed Runtime callbacks required (unsigned callbacks not enabled)
- tenant-scoped bindings/runs/evidence links
- fail closed on binding/parameter/idempotency ambiguity
- loopback adapter exposure for local proof

## Any Runtime changes and justification

**None.** Existing typed HTTP/tool graph, WAL, checkpoint, and receipt machinery were reused.

## Any deviations from Clock 3A

None material. Clock 3A required Overture reconciliation first; Clock 3B implements exactly that binding + narrow durable proof path. Proof-harness hardening (Runtime process teardown, empty-WAL race control, nested-module `igris-verify` build, CLI `igris.cli` invocation) is harness/engineering detail, not an architecture deviation.

## Deferred features

Unchanged from the task charter: ROS2/Nav2, fleet/OTA/dashboard, speculative/council routing, Python continuation checkpointing, generic Executor, new Action decorator, Evidence/ActionContract v2, universal Runtime receipt verifier, PR #78/#79 landing, Clock 2G.1 publication.

## Exact recommended next product-engineering task

**Clock 3C — Operator-facing linked proof + CI heavy-gate green on clean runners:** promote the Linked Igris proof view to a stable console/API contract for bound runs, ensure heavy `ci_proof_gate` (including Clock 3B + existing Action Task V1 clean-host/same-host proofs) is green on CI disk, then decide whether the next product slice expands bound targets beyond the single HTTP adapter demo or hardens multi-binding lifecycle/versioning for Connected customers.

---

*Implemented fact ends above. Commits were not created in this session unless explicitly requested afterward.*
