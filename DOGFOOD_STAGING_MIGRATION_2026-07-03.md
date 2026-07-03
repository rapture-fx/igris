# Dogfood Workflow: Controlled Staging Migration (2026-07-03)

Internal dogfooding contract and acceptance record for the first Igris-controlled
workflow we intend to trust for our own engineering work. This is **not** a
production feature and must not be pointed at a production database.

## Phase 1 — Workflow chosen

**Controlled staging database migration.**

An agent (or engineer acting as one) prepares a SQL migration and asks Igris to
apply it to a **staging/local** database. Igris records the request, pauses it on
a human-approval gate, shows the reviewer the run in the console, dispatches to a
runtime only after approval, and leaves a signed receipt plus a database-side
audit row.

Why this candidate over deploy/repo actions:

- It is this team's most recurring real hazard: migrations 064/065/066 sat
  "committed but not applied" for weeks; the `tenant_tier` enum drifted on the
  VPS because a manual `ALTER TYPE` never became a migration. Applying
  migrations by hand with a raw `psql $DSN -f file.sql` is exactly the kind of
  action where a wrong DSN is catastrophic.
- It maps onto existing primitives with **no new backend abstractions**: a
  registered action (`webhook` target pinned to a localhost gateway),
  `Human-gated` policy preset, the durable approval loop
  (`POST /v1/actions/runs/:id/approve|reject`), runtime `http_request` tool,
  signed receipts, console run detail + approval panel.
- Deploy and repo-push candidates would both require new runtime capabilities
  (git/registry access) that do not exist; building them would violate the
  "smallest honest workflow" constraint.

## Phase 2 — Product contract

**What action is being requested?**
`dogfood.apply_staging_migration` — apply one named SQL migration file from
`igris-overture/database/migrations/` (or an explicitly configured migrations
dir) to a staging database, exactly once, after human approval.

**What makes it risky?**
Schema changes are effectively irreversible (no automatic down-migrations in
this repo), can destroy data, and the identical command shape against the wrong
DSN destroys production. History shows the failure mode is real here.

**What policy applies?**
Policy preset `Human-gated`, `approval_required: true`, `irreversible: true`.
Every run pauses in `approval_required`; nothing is dispatched until a human
decides. Rejection is terminal and never dispatches.

**What approval is required?**
One explicit human decision in the rails console (or via
`POST /v1/actions/runs/:id/approve`) by an authenticated operator session.
Double-approval is blocked server-side (409 `not_awaiting_approval`).

**What runtime performs the action?**
A tenant-registered local `igris-runtime` instance. It executes a single
`http_request` tool call to the **migration gateway**, a localhost-only helper
process that is the only component holding the staging DSN. The runtime and
Overture never see database credentials.

The gateway enforces, independently of Igris:
- staging-only: refuses to start unless the DSN host is loopback
  (`127.0.0.1`/`localhost`) — there is no override flag;
- migrations must be basename-only files inside its pinned migrations dir
  (no path traversal);
- apply requires a previously recorded **plan** whose SHA-256 must still match
  the file content at apply time (the file cannot be swapped between review
  and apply);
- each plan applies at most once (repeat apply calls return the recorded
  result instead of re-executing);
- every plan and apply outcome is written to a `dogfood_migration_audit` table
  in the staging database itself.

**What proof exists after completion?**
1. The Igris run record: status history, `proof_status`, input digest.
2. The signed runtime receipt (listed via `/proof/receipts`, hash-chained in
   the runtime's `receipts.jsonl`).
3. The gateway audit rows: filename, SHA-256, statement count, applied_at,
   outcome — in the same database the migration touched.
4. The console run detail page showing the same story without SQL access.

**What should the console show?**
The run paused in `Approval required` with: action name, policy preset,
"why approval is required", requested target type, requested capabilities,
requested time; after approval: dispatch/completion timeline and receipt
evidence (`receipt_hash`, `signature_present`). Approve/Reject controls with
optional reject reason.

**What must never be exposed?**
- The staging DSN / any credentials (only the gateway holds it).
- Raw migration SQL or raw action input through any Igris API or console
  surface (input is digest-summarized; the reviewer reads the SQL from the
  repo or the gateway's plan listing, both of which they already trust).
- Receipt signing keys.

**What is explicitly out of scope?**
Production databases, Neon, Azure. Down-migrations/rollback. Multi-migration
batches. Concurrent-index or non-transactional migrations. Action versioning.
Hybrid fallback. Any new Overture endpoint or schema change.

## Operator flow (the thing we are dogfooding)

```
# 0. once: make igris-local-up            # local Postgres + migrations
# 1. run the whole loop, interactively approving in the console:
make dogfood-migration-smoke              # scripted end-to-end proof
# or manually:
#   scripts/dogfood_staging_migration_gateway.js serve <port> <staging-dsn> [migrations-dir]
#   POST gateway /plan {"filename": "0xx_foo.sql"}      -> plan_id + sha256
#   MCP call_action dogfood.apply_staging_migration {"plan_id": ...}
#   -> run pauses approval_required; review in console /runs/<id>
#   curl gateway /plans        # see exactly what is staged before approving
#   Approve in console -> dispatch -> completed; receipt + audit row recorded
```

Phases 3-7 results: `DOGFOOD_STAGING_MIGRATION_REPORT_2026-07-03.md` — the
loop passed end to end, including a real acceptance run that applied pending
migrations 064/065/066 to the local staging database through one approval each.
