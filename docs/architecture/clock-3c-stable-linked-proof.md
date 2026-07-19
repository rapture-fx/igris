# Clock 3C — Stable Linked Proof and Durable Run Hardening Report

## Executive summary

Clock 3C productizes the ratified Clock 3B **Run → Recover → Prove** path without reopening settled architecture. It turns the bound-run linked proof view into a stable **Igris Run Proof** (`igris_run_proof.v1`) operator/API contract, hardens evidence-link eligibility so same-contract evidence from another durable run cannot be attached, gives the Python adapter explicit fail-closed semantics for orphaned `in_progress` idempotency keys, and enables continuous heavy proof-gate regression on hosted CI.

Action Protocol Evidence and Runtime receipts remain **separate claim types**. No frozen protocol, ActionContract, Runtime receipt schema, or `igris-verify` semantics were changed.

## Final implementation verdict

**IMPLEMENTED** for the narrow Clock 3C scope:

| Deliverable | Status |
|-------------|--------|
| Stable Igris Run Proof contract | Done (`igris_run_proof.v1`) |
| Run-scoped evidence eligibility | Done (tenant + action_name + contract_hash + decision `input_hash` + exclusive batch/chain) |
| Adapter orphan `in_progress` hardening | Done (`unknown_effect_state` / `reconciliation_required`, no auto-replay) |
| Hosted heavy CI continuous gate | Done (heavy job on PR/push/schedule/dispatch) |
| Frozen protocol / Runtime schemas | Unchanged |

## Exact base SHA

| Item | Value |
|------|-------|
| Ratified Clock 3B tip (implementation base) | `0740f3d90a59a0730ead10f7a1fbae85e8e0b9fe` |
| Protocol release commit | `f98ef76e4fe0cb6b52341639d42cf99213623465` |
| Frozen protocol manifest SHA-256 | `864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4` |

## Branch and final HEAD

| Item | Value |
|------|-------|
| Branch | `feature/clock-3c-stable-linked-proof` |
| Worktree | `/Users/wira/Desktop/system-clock-3c` |
| Base | exact `0740f3d90a59a0730ead10f7a1fbae85e8e0b9fe` |
| Final HEAD (pre-report-SHA-fix) | `7ffe02faed0b4f2cc1fbf6da6837ec688db93be2` |

## Commits

| Full SHA | Message |
|----------|---------|
| `fe889fe0e323a5d8736e97301e93dc394aef4d8e` | `feat(proof): stabilize contract-bound run proof contract` |
| `471761b017f9c3c6b8a63e78857f7680524d037a` | `fix(proof): enforce run-scoped evidence linkage` |
| `601d37e371d43dac1ec0988dd1083eb29071dd72` | `fix(adapter): harden orphaned idempotency state` |
| `7ffe02faed0b4f2cc1fbf6da6837ec688db93be2` | `ci(proof): continuously gate ratified durable recovery path` |

## Files changed

### Overture / API
- `igris-overture/api/igris_run_proof.go` (new) — stable contract, eligibility, exclusive insert
- `igris-overture/api/igris_run_proof_test.go` (new)
- `igris-overture/api/igris_run_proof_postgres_test.go` (new)
- `igris-overture/api/routes_actions.go` — GET run / POST evidence-links use 3C contract
- `igris-overture/api/routes_contracts_postgres_test.go` — apply migration 071 in disposable schemas

### Database
- `igris-overture/database/migrations/071_run_scoped_evidence_link_exclusivity.sql` (new, manual-only)

### Adapter / tests
- `examples/clock_3b_contract_bound_adapter.py` — orphan / unresolved effect semantics
- `sdk/python/tests/test_clock_3b_adapter_example.py` — orphan, concurrent, exception paths

### CI / proof harness
- `.github/workflows/proof-gate.yml` — heavy gate on PR/push
- `scripts/ci_proof_gate.sh` — apply 071
- `scripts/ci/check_manual_migrations.sh` — guard 071
- `scripts/clock_3b_contract_bound_durable_action_proof.sh` — apply 071
- `scripts/action_task_v1_recovery_proof_demo.sh` — assert `igris_run_proof.v1`

### Docs
- this report

## Stable linked-proof contract

**Product term:** Igris Run Proof  
**Schema id:** `igris_run_proof.v1`

Exposed on `GET /v1/actions/runs/:id` for contract-bound runs as:

- top-level `igris_run_proof` (stable contract)
- `linked_proof` (Clock 3B-compatible, additive enrichment)
- top-level status helpers: `durable_execution_status`, `managed_decision_status`, `recovery_status`, `run_linkage_status`

### Minimum fields

| Field | Source |
|-------|--------|
| `run_id` / `task_id` | durable task |
| `action_name` | task definition metadata |
| `contract_hash` | bound run |
| `binding_id` | bound run |
| `target_action_id` / `target_version` | bound run |
| `business_idempotency_key` | bound run |
| `request_fingerprint` | bound run (server digest) |
| `tool_input_hash` | recomputed from bound HTTP tool body |
| `runtime_execution_id` | Runtime proof |
| `statuses.*` | machine-readable dimensions |
| `claim_boundary` | explicit claim separation |
| `runtime_proof` | Runtime receipt claim |
| `action_protocol_evidence` | Embedded evidence claim when linked |
| `recovery_lineage` / `latest_runtime_handoff` | recovery events |

No new cryptographic proof format. No universal signed object wrapping both claim types.

## Claim-type separation

| Claim | What it proves | What it does not prove |
|-------|----------------|------------------------|
| Action Protocol Evidence | Embedded gate decision/outcome for the wrapped callable | Managed dispatch, Runtime recovery, external side-effect uniqueness alone |
| Runtime receipt | Typed durable execution + recovery under Overture | Action Protocol chain validity via `igris-verify` |
| Igris Run Proof | Same durable run identity joins both claims when eligible | Protocol-level unification of the two claim types |

## Run-scoped evidence-link model

Eligibility for `POST /v1/actions/runs/:id/evidence-links` requires **all** of:

1. Authenticated tenant owns the bound run (IDOR fail-closed)
2. Batch is `verified` Embedded evidence for that tenant
3. Batch has a decision event with exact `contract_hash`
4. Decision event `action_name` matches the bound run’s action
5. Decision event `input_hash` matches the server-recomputed tool input hash for **this** run’s task definition
6. Batch / chain digest is not already linked to a **different** run (exclusive ownership)

Links are **append-only / immutable** (migration 070 triggers). Silent relinking is impossible. Same run + same digest is idempotent.

### Same-contract different-run rejection

A verified batch for the same `contract_hash` but a different tool input (or already exclusive to another run) returns `409 evidence_not_linkable`.

### Residual limitation (honest)

Action Protocol Evidence v1 has **no `run_id`**. When two runs share an identical tool input, server rules cannot cryptographically distinguish which run produced an unlinked batch. Mitigations:

- exclusive batch/chain ownership (one batch → one run)
- input_hash matching
- fail-closed when eligibility cannot be proven

`run_linkage_status: eligible_linked` means server rules matched — **not** `cryptographically_run_bound`.

## Tenant isolation

- Every evidence-link read/write is tenant-scoped
- Cross-tenant batch IDs fail eligibility
- Bound-run load is `(task_id, tenant_id)`
- Migration 071 exclusive indexes are tenant-prefixed

## Evidence-link concurrency behavior

`insertEvidenceLinkExclusive` runs in a transaction, checks conflicting links under `FOR SHARE`, then inserts. Unique indexes on `(tenant_id, evidence_batch_id)` and `(tenant_id, evidence_chain_digest)` serialize races; conflicts fail closed as `evidence_not_linkable`.

## Adapter idempotency state machine

```
(absent) --reserve--> in_progress --success--> completed
                |                      |
                | process dies         | identical key+hash → replay stored result
                v                      | different hash → idempotency_conflict
         unknown_effect_state /
         reconciliation_required
         (HTTP 409 idempotency_unresolved)
                |
                +-- never auto re-executes consequential callable
```

### `in_progress` orphan handling

- Written **before** the consequential callable runs
- If process dies after reserve: key stays `in_progress`
- Next request with same key: **refuses re-execution** with `status=unknown_effect_state`, `reconciliation_required=true`
- If callable throws: ledger persists `reconciliation_required` + `effect_status=unknown_effect_state`

### Uncertain effect-state semantics

When the system cannot distinguish effect-not-started from effect-completed, it **does not claim exactly-once replay safety**. It returns an explicit unresolved/reconciliation state and never treats orphan timeout as permission to execute again.

## Operator-facing proof statuses

| Dimension | Example values |
|-----------|----------------|
| `contract_binding_status` | `present` |
| `managed_decision_status` | `observed`, `required`, `rejected` |
| `execution_status` | `in_progress`, `completed`, `failed`, `recovering`, `pending` |
| `recovery_status` | `none`, `present`, `completed`, `recovering` |
| `runtime_proof_status` | `verified`, `pending`, `unavailable`, … |
| `action_evidence_status` | `not_linked`, `linked` |
| `action_evidence_verification_status` | `verified`, `unavailable` |
| `run_linkage_status` | `not_linked`, `eligible_linked` |

## API compatibility

- Existing Clock 3B fields on `linked_proof` retained and enriched additively
- New `igris_run_proof` object; no route rename
- Evidence-link 201 response gains `schema`, `run_id`, `run_linkage_status`, `tool_input_hash`, `action_name`
- No new public route required
- Route surface / methods unchanged (manifest fixture still matches)

## Database changes and migration status

| Migration | Purpose | Auto-apply |
|-----------|---------|------------|
| `071_run_scoped_evidence_link_exclusivity.sql` | Exclusive indexes for batch/chain → one run | **No** — manual / proof/CI only |

Does not weaken binding immutability or tenant isolation. No change to 070 tables beyond additive unique indexes.

## Hosted CI configuration

`.github/workflows/proof-gate.yml`:

- **fast** on PR/push path filters (unchanged intent)
- **heavy** now also on `pull_request` and `push` (plus schedule / dispatch)
- Failures are **not** `continue-on-error`
- Containment Tier B remains optional self-hosted (`containment-capable`); GitHub-hosted runners honestly skip containment-dependent suite with a warning rather than false green

## Focused test results

| Suite | Result |
|-------|--------|
| Go `TestExtractBoundTool*`, `TestBuildIgris*`, claim/status unit tests | PASS |
| Go Clock 3B bound-action unit tests | PASS |
| Go coordinator bound policy tests | PASS |
| Route manifest fixture | PASS |
| Python adapter tests (7) | PASS |
| Migration guard 067–071 | PASS |
| Frozen manifest SHA | `864e8043…776f4` unchanged |

## Postgres test results

| Test | Result |
|------|--------|
| `TestRunScopedEvidenceLinkPostgresEligibilityAndExclusivity` | PASS |
| `TestContractExecutionBindingPostgresTenantScopeAndImmutability` | PASS |

## Clock 3B / recovery proofs

| Proof | Result |
|-------|--------|
| Clock 3B solo (`clock_3b_contract_bound_durable_action_proof.sh`) | Run on clean CI / adequate-disk host; harness asserts `igris_run_proof.v1` |
| Ordinary Action Task V1 | Included in heavy gate |
| Same-host recovery | Included in heavy gate |
| Clean-host recovery | Included in heavy gate |
| Cumulative clean-host recovery | Included in heavy gate |
| Full heavy proof gate | Continuous on hosted CI; local disk may be insufficient |

## Protocol manifest integrity

```
git show f98ef76e4fe0cb6b52341639d42cf99213623465:spec/test-vectors/suite-schema-1/manifest.json | shasum -a 256
# 864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4
```

## Security review

- Tenant-scoped bound-run and evidence-link paths
- IDOR fail-closed on missing/foreign run
- No silent evidence relink; immutable link rows
- Cross-tenant evidence rejected
- Concurrent exclusive link races fail closed
- Adapter never auto-replays uncertain effects
- No Runtime arbitrary Python execution
- No protocol schema mutation

## Known residual risks

1. **Identical tool inputs across business keys:** without a frozen protocol `run_id`, an unlinked evidence batch matching the same input could still be eligible for either run until one claims exclusive ownership.
2. **Adapter orphan requires operator reconciliation:** unresolved keys do not self-heal; this is intentional safety, not availability optimization.
3. **Heavy proofs are disk- and time-intensive** on local developers’ machines; hosted CI is the continuous insurance path.
4. **Migration 071 must be applied** on proof/CI/prod runbooks manually — not at process startup.

## Deferred features

Unchanged from charter: ROS2, fleet, speculation, behavior trees, local inference productization, broad dashboard, Python continuation checkpointing, generic Executor, `@igris.action`, Evidence/ActionContract v2, protocol-level claim unification.

## Exact recommended next engineering task

**Clock 3D — Operator reconciliation surface for unresolved adapter effects + optional Connected metadata correlation:** give operators a safe inspection path for `reconciliation_required` adapter keys, and evaluate whether Connected-mode (non-frozen) correlation metadata can strengthen run↔evidence binding for multi-run identical inputs without mutating Action Protocol Evidence v1.

---

*Implemented fact ends above. Claims of protocol unification or universal exactly-once for arbitrary non-idempotent targets are out of scope and not made.*
