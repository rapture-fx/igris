# Summary

Status on 2026-05-05:

- DB-backed mock unified execution proof is now **proven** in this environment.
- Live real-provider unified execution proof is still **blocked** because no sanctioned non-empty provider key is available.

What is proven:

- Overture forwards `/v1/infer` to Runtime.
- Runtime returns a signed `execution_envelope`.
- Runtime returns a signed `execution_receipt`.
- Receipt verification passes.
- A first-class `execution_lineage` row is persisted.
- A linked `execution_context` row is persisted.
- `GET /v1/execution/runs` returns the run.
- `GET /v1/execution/runs/:id` returns the run detail.
- `GET /proof/receipts` returns the receipt.
- `POST /proof/receipts/verify` returns `200` and `verified=true`.

# Files changed

- [scripts/unified_execution_proof_demo.sh](/Users/wira/Desktop/system/scripts/unified_execution_proof_demo.sh)
- [scripts/unified_execution_demo_helper.js](/Users/wira/Desktop/system/scripts/unified_execution_demo_helper.js)
- [igris-overture/database/migrations/047_execution_context.sql](/Users/wira/Desktop/system/igris-overture/database/migrations/047_execution_context.sql)
- [igris-overture/database/migrations/048_verified_execution_schema_repair.sql](/Users/wira/Desktop/system/igris-overture/database/migrations/048_verified_execution_schema_repair.sql)
- [igris-overture/api/execution_schema.go](/Users/wira/Desktop/system/igris-overture/api/execution_schema.go)
- [igris-overture/api/routes_execution.go](/Users/wira/Desktop/system/igris-overture/api/routes_execution.go)
- [igris-overture/api/routes_proof.go](/Users/wira/Desktop/system/igris-overture/api/routes_proof.go)
- [igris-overture/coordinator/execution_context.go](/Users/wira/Desktop/system/igris-overture/coordinator/execution_context.go)
- [cmd/igris-overture/handlers/infer.go](/Users/wira/Desktop/system/cmd/igris-overture/handlers/infer.go)

# Provider used

- Live real provider: not executed
- Passing DB-backed proof provider: `local-mock-cloud`
- Real-mode preset inspected: `openai`
- Real-mode default model inspected from helper preset: `gpt-4o-mini`

# Database target and schema readiness

Redacted active target:

```text
db_host=localhost
db_name=schlep
ENABLE_PERSISTENCE=true
```

Schema repair work performed:

- `execution_context` was missing.
- `047_execution_context.sql` was made backward compatible so it only adds the `task_records` foreign key when `task_records` exists.
- `048_verified_execution_schema_repair.sql` was added and applied to repair additive `execution_lineage` drift on the active database.
- `047_execution_context` and `048_verified_execution_schema_repair` were recorded in `schema_migrations`.

Relevant repaired `execution_lineage` columns now present:

- `status`
- `pause_reason`
- `prompt_preview`
- `violation_details`
- `approved_by`
- `approved_at`
- `shadow_run_id`
- `alert_escalated_at`

# Commands run

Redacted command shapes used in this turn:

```bash
/bin/zsh -lc 'export DATABASE_URL=...; export ENABLE_PERSISTENCE=true; export IGRIS_UNIFIED_PROVIDER_MODE=mock; ./scripts/unified_execution_proof_demo.sh'

/bin/zsh -lc 'export IGRIS_UNIFIED_PROVIDER_MODE=real; export IGRIS_REAL_PROVIDER=openai; ./scripts/unified_execution_proof_demo.sh'
```

Credential presence check result:

```text
.env: OPENAI_API_KEY empty
.env.local: OPENAI_API_KEY empty
.env.production: OPENAI_API_KEY empty
```

# DB-backed mock proof result

Passing proof run summary:

```text
Unified execution proof succeeded.
Mode: mock
Provider: local-mock-cloud
Route decision: forwarded_to_runtime_task
Runtime ID: igris-local
Receipt API verified: true
Runs API visibility: true
Receipt execution_id: 019df3ef-97c4-7bd2-af24-233f5c5b3193
Receipt hash: 6768c370744f0d125f86a429d98cdbb24ed89230f768652f180492b96790289d
```

Artifact directory for the passing run:

```text
/var/folders/fh/k0b3m2091rq5s0l4yq2lp4c80000gn/T/igris-unified-proof.gmknXw
```

# API visibility result

Verified from the passing run artifacts:

- `POST /v1/infer`: `200`
- `GET /v1/execution/runs`: `200`
- `GET /v1/execution/runs/:id`: `200`
- `GET /proof/receipts`: `200`
- `POST /proof/receipts/verify`: `200`

Captured `api-visibility.json` from the passing run:

```json
{
  "execution_id": "019df3ef-97c4-7bd2-af24-233f5c5b3193",
  "route_decision": "forwarded_to_runtime_task",
  "provider": "local-mock-cloud",
  "runtime_id": "igris-local",
  "receipt_hash": "6768c370744f0d125f86a429d98cdbb24ed89230f768652f180492b96790289d",
  "receipt_verification": true,
  "runs_list_match": true,
  "run_detail_match": true,
  "receipts_match": true
}
```

# Persistence result

Latest persisted `execution_lineage` row after the passing proof:

```text
019df3ef-97c4-7bd2-af24-233f5c5b3193|proof-db1b03a88c8b42d09eae4765|igris-local|6768c370744f0d125f86a429d98cdbb24ed89230f768652f180492b96790289d|COMPLETED|hello unified product
```

Latest persisted `execution_context` row after the passing proof:

```text
019df3ef-97c4-7bd2-af24-233f5c5b3193|proof-db1b03a88c8b42d09eae4765|igris-local|local-mock-cloud|forwarded_to_runtime_task|runtime_task|6768c370744f0d125f86a429d98cdbb24ed89230f768652f180492b96790289d
```

# Run detail evidence

Key verified fields from the passing `GET /v1/execution/runs/:id` response:

- `route_decision = forwarded_to_runtime_task`
- `provider = local-mock-cloud`
- `provider_path = runtime_task`
- `runtime_id = igris-local`
- `runtime_label = runtime-registry`
- `verification_status = verified`
- `receipt.hash = 6768c370744f0d125f86a429d98cdbb24ed89230f768652f180492b96790289d`
- `fallback_used = false`

# Receipt verification result

From the passing `POST /proof/receipts/verify` response:

```json
{
  "verified": true,
  "valid": true,
  "execution_id": "019df3ef-97c4-7bd2-af24-233f5c5b3193",
  "receipt_id": "614699ee-7380-4814-8081-42506bd5b628",
  "runtime_id": "igris-local",
  "runtime_label": "runtime-registry",
  "verification_status": "verified",
  "hash_valid": true,
  "signature_matches": true
}
```

This endpoint still performs stored-value matching, not fresh cryptographic signature verification.

# Runtime identity

Proven on the passing DB-backed proof:

- `execution_envelope.runtime_id = igris-local`
- `execution_receipt.runtime_id = igris-local`
- `receipt.runtime_id = igris-local`
- `run_detail.runtime_id = igris-local`
- `proof_receipts.runtime_id = igris-local`

# Real-provider proof blocker

Real-provider unified proof is still blocked because no sanctioned non-empty provider key is present.

Current blocker:

```text
required environment variable is not set: OPENAI_API_KEY
```

# Known limitations

- Real-provider execution is still unproven in this environment.
- `task_records` is still absent in the active database, but the verified-execution APIs now degrade safely for the taskless Runtime-forwarded proof path.
- Some non-core background tables are still absent on `schlep`, for example:
  - `provider_registry`
  - `provider_performance_aggregates`
  - `circuit_breaker_states`

Those gaps no longer block the verified-execution proof path covered here.

# Recommended next task

Provide a sanctioned non-empty real provider key and rerun the same proof in real mode:

```bash
export DATABASE_URL=...
export ENABLE_PERSISTENCE=true
export IGRIS_UNIFIED_PROVIDER_MODE=real
export IGRIS_REAL_PROVIDER=openai
export OPENAI_API_KEY=...
./scripts/unified_execution_proof_demo.sh
```

That is now the shortest path to proving the full real-provider unified execution story on top of the repaired database.
