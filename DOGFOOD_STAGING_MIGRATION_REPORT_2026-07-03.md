# Dogfood Report: Controlled Staging Migration (2026-07-03)

Blunt answer first: **yes, Igris proved useful for this workflow — but only
after two fixes made today.** Before them, the durable approval loop had never
actually worked for any action with a realistic (sensitive) input; it had only
ever been proven against the `demo.needs_approval` mock. The loop is now
genuinely safer and more inspectable than running `psql -f` by hand, and the
proof is repeatable. Verdict: **continue, narrowly** — one workflow at a time,
each proven the way this one was.

Contract: `DOGFOOD_STAGING_MIGRATION_2026-07-03.md`.

## What was tested

`dogfood.apply_staging_migration`: apply one SQL migration from
`igris-overture/database/migrations/` to a **loopback-only** staging database
via a localhost migration gateway, behind a `Human-gated` / `irreversible` /
`non_retryable` registered action (`webhook` target). Requested through the
real MCP gateway (`call_action`), reviewed in the rails console, approved via
the durable action routes, executed by a registered local runtime, proven by
verified task proof + hash-chained signed receipts + a `dogfood_migration_audit`
row in the staging database itself.

## Exact commands

```bash
make igris-local-up                      # local Postgres + migrations (needs ports 8080/8081 free)
make dogfood-migration-smoke             # scripted end-to-end proof (~30s warm, ~150s after go build)
IGRIS_SMOKE_CONSOLE_PORT=3180 make dogfood-migration-smoke-console   # + console approval panel
```

Real acceptance (one-shot, this machine): migrations **064/065/066 —
committed for weeks, applied to prod on 2026-06-23, but never applied
locally — were applied to the local staging DB through the full loop**, one
approval each:

- `064_execution_evals.sql` → run `8891249f…`, proof `verified`, `execution_evals` exists
- `065_policy_proposals.sql` → run `422d2d48…`, proof `verified`, `policy_proposals` exists
- `066_trust_recommendation_states.sql` → run `e90eada9…`, proof `verified`, `trust_recommendation_states` exists
- runtime receipt chain verified: 3 receipts, hash-linked, all signed

## What worked (all smoke-asserted, repeatable)

- Registration through the public API (`POST /v1/actions`), no console needed.
- Every run pauses in `approval_required`; MCP returns 409 with the run id.
- Safe review fields on `GET /v1/tasks/:id`: `approval_reason`,
  `required_capabilities`, `policy_preset`, `action_target_type`, and (new)
  `action_name`. Raw input (plan id + reason sentinel) never appears in any
  API response or console page; no DSN appears anywhere in Igris.
- Reject is terminal and never dispatches (plan stayed `planned`).
- Approve dispatches exactly once; double-approve → 409 `not_awaiting_approval`.
- Tamper guard: a migration edited after planning is refused at apply time
  (`checksum_mismatch` audit row, no schema effect) even though the run was
  approved. Path traversal refused at plan time. Non-loopback DSN refuses to
  serve at all.
- Console renders the approval panel for a waiting run with the action name,
  policy, reason, target, capabilities, and working approve/reject controls.
- Proof: task `proof.status=verified`, signed receipt listed with
  `receipt_hash`/`signature_present`, runtime `receipts.jsonl` chain intact.

## What failed (found by this exercise)

1. **P0 (fixed): approval dispatch was broken for every real action.**
   Encrypted input refs store their AEAD associated data in a `jsonb` column;
   Postgres normalizes the bytes, the byte-equality check in
   `DecryptExecutionInputRef` could therefore never pass after a real DB
   roundtrip, and approving any run whose input contained a sensitive key
   (`body` — i.e. every webhook/hosted_api action) failed with an opaque
   `db_error` / `aad_mismatch` audit row. The demo action never exercised this
   path (no sensitive keys → no refs). Fixed by comparing AADs as JSON values
   (`jsonValuesEqual`); GCM still authenticates against the recomputed
   canonical bytes. Regression test added
   (`TestDecryptExecutionInputRefAcceptsJSONBNormalizedAAD`), including a
   wrong-scope negative.
2. **P1 (fixed): the approver couldn't see what they were approving.** The
   console showed `tool:http_request` instead of the action name.
   `GET /v1/tasks/:id` now exposes `action_name` (whitelisted node metadata,
   pattern-validated, hostile values dropped — test added); the console
   already preferred that field.
3. **P1 (fixed, was uncommitted in the working tree): console receipt evidence
   read legacy `hash`/`signed` keys** while the API sends
   `receipt_hash`/`signature_present`; evidence showed dashes for real runs.

## Remaining blockers

**P1 — a run can read "completed" when the action was refused.** The runtime
http tool treats any HTTP response (409/500 included) as tool success, so the
tampered run C completes in Igris while the gateway refused the apply. The
receipts/audit tell the truth; the status does not. An operator who reads only
the run status will believe a migration applied when it did not. This is the
biggest remaining trust gap; fix belongs in the http tool (or per-action
expected-status policy), deliberately not attempted in this pass.

**P1 — coordinator submit errors are masked as `runtime_unavailable`.** A
missing input-ref keyring (and, per branch history, NOT-NULL violations)
surface as "no runtime was available", sending operators debugging in the
wrong direction. Needs error taxonomy, not a bigger 503.

**P1 — approval context still requires an out-of-band gateway lookup** for the
migration specifics (filename/sha): raw input is redacted by design, so the
console names the action but not the plan. Documented operator step:
`GET :18095/plans` before approving. A follow-up could send a pre-redacted
`request_summary` (the approval panel already renders that field if present).

**P1 — human-gated actions with sensitive inputs hard-require
`IGRIS_EXECUTION_INPUT_REF_KEYS`**, which was documented nowhere an operator
would look (now in `.env.example`; the smoke provisions an ephemeral keyring).

**P2** — local provisioner migration list stops at 063 (same drift class that
previously stopped at 053); smoke ports collide with local dev leftovers
(brew nginx on 8080, a dev rails server pidfile — the smoke now uses its own
pidfile and `IGRIS_SMOKE_CONSOLE_PORT`); per-run GOCACHE in the smoke costs
~450MB per cold run (set `GOCACHE` to reuse).

## Files changed

- `igris-overture/coordinator/execution_input_refs.go` — P0 AAD fix (+ test file)
- `igris-overture/api/routes_tasks.go` — safe `action_name` field (+ test file)
- `web/apps/rails-console/app/services/igris/data_source.rb` — real receipt keys (+ test file)
- `scripts/dogfood_staging_migration_gateway.js` — staging-only migration gateway (new)
- `scripts/dogfood_migration_approval_smoke.sh` — end-to-end dogfood smoke (new)
- `Makefile` — `dogfood-migration-smoke[-console]` targets
- `README.md` — dogfood runbook section; `.env.example` — keyring placeholders
- `DOGFOOD_STAGING_MIGRATION_2026-07-03.md` — contract; this report

## Tests run

- `go test ./igris-overture/api ./igris-overture/coordinator` — **ok** (full packages)
- Rails console suite — **444 runs, 3255 assertions, 0 failures**
- `make approval-loop-smoke` (baseline) — **PASSED**
- `make dogfood-migration-smoke` — **PASSED** (29–150s)
- `make dogfood-migration-smoke-console` — **PASSED**
- Real-migration acceptance (064/065/066) — **PASSED**, proof verified per run

## Local environment side effects (this machine)

- brew nginx stopped (was squatting the runtime port 8080): restore with
  `brew services start nginx` if it was wanted.
- Local staging DB now has migrations 064/065/066 applied (through the loop),
  plus `dogfood_migration_audit` and per-run `dogfood_smoke_*` tables.

## Verdict

Continue, but keep the aperture this narrow. The controlled path is now
demonstrably better than the raw alternative for this one workflow: a wrong
DSN is impossible (loopback-only gateway holds the only credential), a stale
or edited migration cannot slip through (sha-pinned plan), nothing applies
twice, nothing applies without a recorded human decision, and afterwards
there is signed, hash-chained, database-corroborated evidence. What blocks
broader trust is not missing features — it is the P1 that "completed" can
mean "refused". Fix that next, before adding any new surface.
