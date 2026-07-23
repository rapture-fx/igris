# Clock 3D Operator Reconciliation

Clock 3D closes the managed safety loop for a contract-bound Action whose
consequential HTTP target explicitly reports an unknown effect state. It does
not retry the effect and does not change the historical task result, Runtime
receipt, or Action Protocol Evidence.

## Eligibility

A run is eligible only when all of these server-observed facts exist:

1. Runtime received the exact structured target response
   `error=idempotency_unresolved`,
   `effect_status=unknown_effect_state`, and
   `reconciliation_required=true`.
2. Runtime propagated that condition in typed failure metadata, not a parsed
   human-readable error string.
3. Overture matched the failed task to an immutable tenant-scoped
   `contract_bound_action_runs` row and an idempotency-required binding.
4. Overture atomically appended the initial
   `unresolved_effect_observed` event while recording the task failure.

No client field can manufacture eligibility. An ordinary failed or completed
run returns `reconciliation_not_required`.

## Authorization

Read and append endpoints require an authenticated Better Auth session with
the existing `admin` role. Tenant API keys are not operator credentials.
Tenant ID, operator ID, and operator email are derived by the server.

## API

### Inspect reconciliation context

`GET /v1/actions/runs/:id/reconciliation`

The response includes the exact run, contract, binding and target identities,
a SHA-256 digest of the business idempotency identity, current state, and the
immutable event history. Runtime response bodies and credentials are never
stored.

### Append an operator resolution

`POST /v1/actions/runs/:id/reconciliation`

```json
{
  "request_id": "1baf199b-4a1d-4438-8f2d-c7991bca6d66",
  "resolution": "confirmed_succeeded",
  "reason": "Provider transaction was independently verified",
  "external_reference": {
    "type": "transaction_id",
    "value": "txn-123"
  }
}
```

Allowed resolutions:

- `confirmed_succeeded`
- `confirmed_failed`
- `remains_unknown`

Allowed external reference types are `provider_reference`, `transaction_id`,
`deployment_id`, and `ticket_id`. Values are bounded to a conservative
identifier character set. Credential-like reason or reference content is
rejected.

An exact retry with the same `request_id`, operator, and payload returns the
original event with `idempotent_replay=true`. Reusing a request ID for another
claim returns `resolution_conflict`. After `confirmed_succeeded` or
`confirmed_failed`, every later resolution conflicts. `remains_unknown` keeps
the run unresolved and never makes it retryable.

Errors are machine-readable:

- `run_not_found`
- `not_authorized`
- `reconciliation_not_required`
- `invalid_resolution`
- `resolution_conflict`

## Operator workflow

1. Retrieve `GET /v1/actions/runs/:id`.
2. Inspect `igris_run_proof`, managed decision and execution status, recovery
   lineage, Runtime proof, and linked Action Protocol Evidence.
3. Inspect the reconciliation context and business idempotency digest.
4. Independently query the external provider or system of record.
5. Append one of the three allowed operator resolutions.
6. Retrieve the run again. Igris Run Proof now contains a separate
   `operator_reconciliation` claim.

`confirmed_succeeded` is an authenticated operator assertion. It is not
cryptographic proof that the external effect occurred, and it does not alter
Runtime or Action Protocol verification status.

## Persistence and deployment

Migration `072_operator_reconciliation_events.sql` is append-only and uses
database triggers to reject updates, deletes, resolution-before-observation,
and post-terminal appends. It follows the manual migration runbook and is
never applied at application startup. Migration 071 remains an independent
manual prerequisite and must not be skipped.
