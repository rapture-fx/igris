# Igris Inertial — Production Readiness Audit (2026-06-23)

Scope: audit the platform **as it exists today**. No new features, no new layers,
no fixes beyond what validation required (none were needed). Evidence is from the
working tree at branch `main` with the uncommitted `home/index.html.erb` +
`project_identity_test.rb` changes present.

---

## Executive Summary

The platform is functionally complete and, on the dimensions audited, operationally
sound. The three pending migrations (064/065/066) are additive, idempotent, and
free of hidden dependencies. The rails-console test suite is **green** (427 runs,
0 failures) once the bootsnap cache is cleared — the lone failure observed on a
stale cache was a ghost of a renamed test, not a defect. Security invariants the
product markets (no prompt/CoT/raw-payload exposure, no agent-UUID on run detail,
no client-supplied tenant_id, runtime IDs confined to the operator's own surface)
all hold at the code level. Console routes are coherent with no route-level dead
ends.

The remaining gap to a clean "Production Ready" call is operational, not
structural: migrations 064/065/066 are **committed but unapplied** in every
environment, so the features they back (Evaluations persistence, Policy Proposals,
Trust-Recommendation lifecycle) currently run in their documented degrade-to-empty
modes against live data.

## Production Readiness Score

**88 / 100** — strong core, gated only on applying three already-validated
migrations and an attestation pass.

## Migration Readiness — VERDICT: SAFE TO APPLY

| Migration | Tables | Additive | Idempotent | External deps |
|---|---|---|---|---|
| 064_execution_evals | `execution_evals`, `execution_eval_runs` | yes | `CREATE TABLE/INDEX IF NOT EXISTS` | none (self-contained FK) |
| 065_policy_proposals | `policy_proposals`, `policy_proposal_events` | yes | same | none (self-contained FK) |
| 066_trust_recommendation_states | `trust_recommendation_states` | yes | same | none |

- All three create **new** tables only — no `ALTER`, no column drops, no type
  changes, no backfill. Zero risk to existing rows.
- Foreign keys are intra-migration (`execution_eval_runs → execution_evals`,
  `policy_proposal_events → policy_proposals`) with `ON DELETE CASCADE`. No FK
  reaches into pre-existing tables, so apply order among 064/065/066 is
  independent and they can land in any order after 063.
- `tenant_id TEXT NOT NULL` on every table preserves the tenant-scoping
  convention used since 057/058; JSONB columns are guarded with
  `jsonb_typeof` CHECKs (array for assertions/results, object for criteria).
- Compatible with the schema-attestation process: they are pure forward DDL with
  no data migration, exactly the shape the attestation pass expects. 065 and 066
  carry explicit header notes that they are intentionally unapplied pending the
  consolidated attestation pass.
- **Caveat (carried from prior audits):** the `tenant_tier` enum gap fixed by
  hand on the old VPS still has no migration; unrelated to 064–066 but worth
  folding into the same attestation pass so no environment depends on a manual
  `ALTER TYPE`.

Do **not** block on these — they are ready. Apply 064→065→066 in the attestation
pass.

## Test Health — VERDICT: HEALTHY (no blocking defects)

- Full rails-console suite on a **clean bootsnap cache: 427 runs, 3086 assertions,
  0 failures, 0 errors, 0 skips.**
- The three named-for-investigation tests pass: `FirstActionExperienceTest`,
  `WelcomeHomeSplitTest`, `ConsoleRoutesTest` (verified together: 57 runs, 0
  failures).
- The single failure seen on the first (stale-cache) run —
  `ProjectIdentityTest#test_home_prompts_to_create_a_project_when_real_mode_has_no_name`
  — is **not a real defect**. That method name no longer exists in source: the
  working tree renames the test to `...does_not_prompt_for_project_naming_in_install_first_layout`
  and coordinately rewrites `home/index.html.erb` from a "Create your project"
  naming form into the install-first onboarding page. The stale bootsnap-cached
  compile of the old test ran against the new view and failed. Clearing
  `tmp/cache/bootsnap*` and re-running yields green. **Cosmetic/tooling, not
  product.**
- Action item (non-blocking): the prior audit's "22 failures (secret_refs scrub
  regression)" is **not reproducible** on this tree — current run is clean.

## UX Readiness — VERDICT: READY (route-level), pending live walkthrough

- Routes enumerate cleanly: Home, Overview, Welcome, Actions (+ new/run),
  Runs (+ detail), Runs ▸ Evaluations, Runs ▸ Proposals, Runs ▸
  trust-recommendations/state, Agents (+ packs/archive), Runtimes, Settings.
  No route points at a missing controller/action; Evaluations and Proposals are
  correctly nested under the Runs lens (not new nav), matching the design intent.
- Home now leads with install-first onboarding (`curl … | sh`) plus
  Create-agent / Register-action / Execute-run / Review-proof next-steps — a
  coherent first-run path, no naming dead-end.
- Not yet exercised in this pass: a live in-browser click-through of each
  workflow to completion. Per project convention I did not spin up a dev server;
  the walkthrough below is a code-level trace. A short live operator pass is the
  one open UX item before a "Production Ready" stamp.

## Security Readiness — VERDICT: PASS

- **No client-supplied `tenant_id`**: grep of `app/` finds no tenant_id flowing
  from params/body — tenancy is server-derived.
- **No prompt / CoT / raw-payload exposure**: every match for prompt / reasoning /
  raw_* in views is a *negative guarantee in copy* ("never renders prompts, model
  output, or raw request bodies"), not a render of such data. Confirmed across
  evaluations, policy-proposals, agents, and actions surfaces.
- **No agent UUID on run detail**: `runs/_agent_attribution.html.erb` renders only
  `display_name`/`name`/`agent_type`/`template_name`; `agent[:agent_id]` is never
  emitted, with an explicit privacy comment ("run detail must never render that
  id … enforced by tests").
- **Runtime identifiers**: `runtime_id` appears only on `/runtimes`, the operator's
  own runtime-management surface — legitimate, not a cross-tenant/run leak.
- **Tenant isolation**: every new table (064–066) is `tenant_id`-scoped and the
  console never forwards tenant identity from the client, consistent with the
  058/060 tenant-bound model.

## Operational Risks

1. **Unapplied migrations (064/065/066)** — features degrade to empty/all-active
   against live data until applied. Low technical risk (validated), but a real
   functional gap operators would notice.
2. **`tenant_tier` enum** still relies on a manual `ALTER TYPE` in at least one
   historical environment; no migration of record.
3. **Bootsnap stale-cache** can surface phantom test failures in CI if the cache
   is reused across a test-rename — ensure CI starts from a clean cache (it likely
   does on fresh checkout, but worth asserting).
4. **Polar price IDs** remain placeholders (`price_seed_monthly`, …) — billing
   won't transact until set in the dashboard. Out of audit scope but production-
   blocking for paid signups.

## Blocking Issues

- **None code-level.** No broken routes, no leaking identifiers, no failing tests
  on a clean cache, no unsafe migrations.
- The only true production-gate is **operational**: apply 064–066 + run the
  attestation pass, and set real Polar price IDs before charging.

## Recommended Fixes (in priority order)

1. Run the consolidated attestation pass: apply 064 → 065 → 066, and add a
   migration of record for the `tenant_tier` enum values.
2. Confirm CI builds the rails-console suite from a clean bootsnap cache.
3. Do one live in-browser operator walkthrough (register agent → actions → runs →
   failures → proof → evaluations → recommendations → proposals) to close the UX
   item.
4. Replace placeholder Polar price IDs before enabling paid conversion.

## Final Verdict

**Operator Beta.**

The platform is structurally sound, secure on the audited invariants, test-green,
and its pending schema is safe. It is ready to put in front of real operators. It
is held back from an unqualified "Production Ready" only by operational follow-through
that is already de-risked: applying three validated migrations + attestation, a
single live UX walkthrough, and real billing price IDs. Clear those and the next
audit can move this to Production Ready.

---

### Audit method note
Migrations read in full; rails-console suite executed under rbenv 3.2.2 (system
ruby 2.6 is too old); security findings are from static analysis of
`app/` views and controllers; UX is a route + view trace, not a live browser
session (no dev server spun up, per project convention).
