# Neon Migration Readiness — 057→063

**Date:** 2026-06-19
**Mode:** Audit & runbook only — no production mutation, no Neon writes, no secrets printed.
**Scope:** Make the database solid and aligned with current product (Action Packs, Agent Registry, Agent Templates, Agent Evidence Memory, Execution Intelligence) before live validation/deploy.

---

## 1. Summary

Recent product work maps to canonical migrations **057–063** plus existing baseline objects. I inspected every migration 057→063, the legacy `migrations/026`, the prerequisite/baseline tables, the proof-sync trigger (033), and the Go code that reads each new object. I then **updated the existing read-only attestation** (`igris-overture/database/attestation/verify_launch_schema.sql`) to close its gaps — it was missing prerequisite, 059, 061, 062, and `schema_migrations` checks. It is now complete through 063 and remains strictly read-only.

I chose to update the already-wired canonical attestation rather than create a new orphan at `ops/launch/…`, because it is already referenced by the safe runner `scripts/verify_launch_schema.sh`, already opens `BEGIN READ ONLY`, and keeps a single source of truth.

---

## 2. Migration Inventory

- **Canonical tree** `igris-overture/database/migrations/`: 001–063 (the only tree to use for these features).
- **Legacy tree** `migrations/`: 001–028 (inference-era; **do not bulk-apply**). Only `migrations/026_tenant_tier_enum_values.sql` is relevant, and only as a fallback if the `tenant_tier` enum check fails.
- **In-scope new migrations:** 057, 058, 059, 060, 061, 062, 063.

---

## 3. Schema Required by Current Product

| Feature | Requires | Source migration |
|---|---|---|
| Action Packs (`actionpack/install.go`) | `action_definitions` only — INSERTs into it; **no new table** | 054 (baseline) |
| Agent Registry (`agentregistry/store.go`) | `registered_agents` + `task_records.registered_agent_id`/`registered_agent_name` | 061, 062 |
| Agent Evidence Memory (`agentmemory/store.go`) | `agent_evidence_memory` | 063 |
| Execution Intelligence (`routes_execution_intelligence.go`) | reads `task_recovery_events`, `action_policy_decisions`, `approval_requests`, `task_records` — **no new tables** | 051 (baseline) |
| Input-ref decrypt audit (`security/key_rotation.go`, `coordinator/input_ref_crypto.go`) | `execution_input_ref_audit.key_version` | 059 |
| Tenant-bound proof/lineage/context | tenant_id constraints + indexes | 057, 058, 060 |

**Confirmed:** Action Packs need no table beyond `action_definitions`; Execution Intelligence reads existing tables only; 063 is required because `agent_evidence_memory` is a brand-new table.

---

## 4. Attestation SQL

- **Path:** `igris-overture/database/attestation/verify_launch_schema.sql` (updated; +132 lines, 27 checks).
- **Read-only guarantees:** opens `BEGIN READ ONLY`, runner exports `PGOPTIONS=-c default_transaction_read_only=on`, no CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/TRUNCATE (the only "CREATE" is the string literal `'%CREATE UNIQUE INDEX%'` inside an ILIKE matcher).
- **Checks now cover:** prerequisites (`task_records`, `action_definitions`, `execution_input_refs`); 057 (tenant-scoped unique index + legacy global index removed); 058 (no null/empty rows, NOT NULL, non-empty CHECK, receipt-hash index); 059 (`key_version` column); 060 (same four as 058); 061 (table + active unique index); 062 (both attribution columns); 063 (table, all columns, redaction default, 3 constraints, 4 indexes); `tenant_tier` enum has seed/horizon/infinite; proof-sync trigger + function (033); plus a `schema_migrations_advisory` row that surfaces ledger shape without trusting it (object checks are authoritative).

---

## 5. How to Run Branch Attestation

```bash
# 1. Create a Neon branch from production in the Neon console, copy its DIRECT URL.
# 2. Export it as the attestation DSN (DIRECT only — host must NOT contain -pooler):
export IGRIS_NEON_SCHEMA_ATTESTATION_DSN='postgres://USER:PASS@ep-xxxx.REGION.aws.neon.tech/igris?sslmode=require'

# 3. Reject pooled URLs before running:
case "$IGRIS_NEON_SCHEMA_ATTESTATION_DSN" in *-pooler*) echo "POOLED URL — STOP"; exit 1;; esac

# 4. Run the read-only attestation (DSN is never printed):
./scripts/verify_launch_schema.sh
```

Inspect every `FAIL|...` row. The runner exits non-zero if any check fails.

---

## 6. Migration Decision Table

Run a migration **only if its check(s) FAIL**:

| FAIL row(s) | Run |
|---|---|
| `057_*` | `igris-overture/database/migrations/057_task_records_tenant_scoped_idempotency.sql` |
| `058_*` (and `058_*_no_null_or_empty` = PASS) | `igris-overture/database/migrations/058_execution_lineage_tenant_bound.sql` |
| `059_execution_input_ref_audit_key_version_column` | `igris-overture/database/migrations/059_execution_input_ref_audit_key_version.sql` |
| `060_*` (and `060_*_no_null_or_empty` = PASS) | `igris-overture/database/migrations/060_execution_context_tenant_bound.sql` |
| `061_*` | `igris-overture/database/migrations/061_registered_agents.sql` |
| `062_*` | `igris-overture/database/migrations/062_task_records_registered_agent.sql` |
| `063_*` | `igris-overture/database/migrations/063_agent_evidence_memory.sql` |
| `tenant_tier_seed_horizon_infinite` | **No migration.** Check accepts either a `tenant_tier` enum (seed/horizon/infinite) **or** a text/varchar `tenants.tier` (NOT NULL, default `'seed'`). On the production lineage `tier` is text, so this PASSes as-is. **Never run `migrations/026`** (the enum type does not exist; the `ALTER TYPE` would abort). |

---

## 7. Exact Migration Sequence

Apply only the failing ones, always in this order:

```bash
# DIRECT URL only (reuse the same non-pooled URL):
export DATABASE_URL_DIRECT="$IGRIS_NEON_SCHEMA_ATTESTATION_DSN"
case "$DATABASE_URL_DIRECT" in *-pooler*) echo "POOLED — STOP"; exit 1;; esac

# Run each REQUIRED file (skip any whose checks already PASS), in order:
psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f igris-overture/database/migrations/057_task_records_tenant_scoped_idempotency.sql
psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f igris-overture/database/migrations/058_execution_lineage_tenant_bound.sql
psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f igris-overture/database/migrations/059_execution_input_ref_audit_key_version.sql
psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f igris-overture/database/migrations/060_execution_context_tenant_bound.sql
psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f igris-overture/database/migrations/061_registered_agents.sql
psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f igris-overture/database/migrations/062_task_records_registered_agent.sql
psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f igris-overture/database/migrations/063_agent_evidence_memory.sql
# Only if the enum check failed:
psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f migrations/026_tenant_tier_enum_values.sql
```

**Watch 058 and 060 output.** They print `NOTICE ... constrained tenant-bound` on success. If you see `WARNING ... NOT NULL/CHECK not applied`, tenant-null rows remain → **STOP** and clean up ownership before retrying (the constraint/index attestation rows will stay FAIL). All 057–063 files are forward-only and safe to re-run.

After applying, **re-run `./scripts/verify_launch_schema.sh`** — all 27 rows must be PASS.

---

## 8. Production Runbook (only after branch is fully green)

1. Branch attestation passes with **zero FAIL rows** — otherwise stop.
2. Take a Neon production restore point / confirm PITR is enabled.
3. Export the **production DIRECT URL** (no `-pooler`); reject pooled.
4. Run the attestation on production first to see which migrations are actually needed.
5. Apply only the failing migrations, in the 057→063 (+026 if needed) order above.
6. Watch 058/060 NOTICE vs WARNING output.
7. Re-run the attestation on production; require all PASS.
8. No app/deploy changes are part of this task.

---

## 9. Stop Conditions

- Only a pooled URL (host contains `-pooler`) is available.
- `prereq_task_records_present`, `prereq_action_definitions_present`, or `prereq_execution_input_refs_present` FAIL → baseline ≤056 is incomplete; do not proceed.
- `058_*_no_null_or_empty` or `060_*_no_null_or_empty` FAIL (bad rows > 0) → clean ownership first; do not force constraints.
- Migration 058 or 060 prints a `WARNING` and skips constraints.
- `schema_migrations` claims applied but an object check FAILs (object checks win).
- Any migration errors on the branch, or migration order is ambiguous.

---

## 10. Commands Run (this audit — all read-only)

- `git status --short`, `git diff --check`
- `find` over both migration trees + attestation scripts
- `cat`/`grep`/`rg` over migrations 057–063, 026, 031/033/051/054/056, and Go dependency files
- `rg` keyword scan confirming the edited attestation contains no mutating statements

---

## 11. Final Git Status

```
 M igris-overture/database/attestation/verify_launch_schema.sql   (+132 lines, attestation checks only)
```

Only the attestation SQL changed. **No Neon mutation, no production DDL, no secrets printed.** The user runs attestation → branch migrations → production migrations manually using the commands above.
