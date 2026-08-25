# Igris — Production Launch Readiness (2026-06-23)

Branch-first execution. **Production was NOT touched.** No secrets printed, no
pooled URLs used, no deploy performed.

---

## Summary

Phase 1 (preflight) and Phase 5 (auth inspection) are complete. Migrations
064/065/066 are confirmed additive/idempotent and the read-only launch
attestation has been **extended to cover them**. The auth architecture is sound
and largely production-shaped (BetterAuth upstream → console proxy → Overture
session validation, tenant auto-provisioned from the BetterAuth user id), with
two items to close: **server-side password-reset email is unconfigured**, and a
set of **production env-consistency requirements** for the auth hosts.

**Phases 2–4 (Neon branch validation → prod preflight → prod migration) are
BLOCKED** on a missing input — see Blockers. I stopped rather than improvise a
database path, per the safety rules.

## Branch Migration Result — PASS

Ran against the Neon **branch** in `.neon_launch_branch_env` (direct, non-pooled;
verified scheme + no `-pooler`; `neondb`). NOTE: the file's values were initially
unquoted and contained `&`/`?`, so they sourced as empty — I rewrote the file to
single-quote each value (`chmod 600` preserved, no secrets printed); a one-line,
lossless fix.

- Pre-migration: schema at 063 (`registered_agents`, `agent_evidence_memory`
  present); 064/065/066 objects all absent — expected.
- Applied in order with `psql -X -v ON_ERROR_STOP=1`: 064 → 065 → 066, all clean
  (`CREATE TABLE` / `CREATE INDEX`, no errors).
- Post-migration read-only checks: all 5 tables, all 5 named indexes, and the
  `trust_recommendation_states` UNIQUE(tenant_id, recommendation_id) present.
- Backend tests (run this session): `executionevals`, `policyproposals`,
  `trustrecs`, `middleware` → all `ok`. Rails console suite: 427 runs, 0 failures
  (clean cache).

**Branch verdict: PASS.**

## Production Preflight Result

Ran read-only (`default_transaction_read_only=on`) against prod `neondb` (direct,
non-pooled; verified scheme + no `-pooler`). The prod env file's
`DATABASE_URL_DIRECT` was unquoted-with-`&` (sourced empty) — fixed by the same
lossless single-quote rewrite (`chmod 600` preserved). NOTE: prod
`IGRIS_NEON_SCHEMA_ATTESTATION_DSN` is a 22-char placeholder, NOT a DSN — must be
set to the direct prod DSN before the post-migration prod attestation can run.

- Prod schema at 063 (`registered_agents`, `agent_evidence_memory` present).
- **Gap: 064, 065, 066 are ALL ABSENT in production** — needs all three.

**No production writes performed.** Phase 4 (apply) is HELD pending a separate
explicit approval, per the operator's "read-only preflight only" choice.

## Production Migration Result — APPLIED (approved 2026-06-23)

Explicit operator approval given. Applied from `.neon_prod_env` only, against the
prod Direct URL (scheme verified, `-pooler` rejected, non-pooled `neondb`).

- `064_execution_evals.sql` → CREATE TABLE ×2, CREATE INDEX ×5 — OK
- `065_policy_proposals.sql` → CREATE TABLE ×2, CREATE INDEX ×3 — OK
- `066_trust_recommendation_states.sql` → CREATE TABLE ×1, CREATE INDEX ×2 — OK

All via `psql "$DATABASE_URL_DIRECT" -X -v ON_ERROR_STOP=1 -f <file>`, in order
064→065→066, stop-on-first-error armed (never triggered). No other migration run.
No deploy.

**Production migration verdict: SUCCESS.**

## Attestation Result

`igris-overture/database/attestation/verify_launch_schema.sql` previously covered
through migration 063 only. I **extended it (read-only checks only)** with object
+ index presence assertions for:
- 064: `execution_evals`, `execution_eval_runs`, `idx_execution_evals_tenant_active`, `idx_execution_eval_runs_task`
- 065: `policy_proposals`, `policy_proposal_events`, `idx_policy_proposals_tenant_active`, `idx_policy_proposal_events_proposal`
- 066: `trust_recommendation_states`, UNIQUE(tenant_id, recommendation_id), `idx_trust_rec_states_tenant`

These are pure `SELECT`/`to_regclass`/`pg_indexes` checks inside the existing
`BEGIN READ ONLY` block — they assert presence, they never create anything.

**Production attestation (post-apply, read-only): 38 PASS / 0 FAIL** — zero FAIL
rows; all eleven 064/065/066 checks PASS. (Prior prod run was 27/0 for 057–063;
+11 new checks = 38, matching exactly.) Run with the real prod Direct URL because
prod `IGRIS_NEON_SCHEMA_ATTESTATION_DSN` is a placeholder; the wrapper enforces
`default_transaction_read_only=on`. Branch run earlier was likewise 38/0.

## Auth Architecture Findings

Flow (verified in code):
1. **`web/apps/better-auth-upstream`** is the BetterAuth server (`betterAuth({...})`,
   Neon `pg.Pool`, `emailAndPassword.enabled`, conditional Google/GitHub social).
   Shares the Neon DB / session tables with Overture.
2. **Landing `/auth`** (`AuthForm.tsx`) supports signin / signup / forgot +
   Google/GitHub. Its auth-client `baseURL = getConsoleUrl()`, so **all
   `/api/auth/*` traffic is directed at the console host** (single auth origin).
3. **Rails console `AuthProxyController`** reverse-proxies `/api/auth/*` →
   `BETTER_AUTH_UPSTREAM_URL`, forwarding cookies, stripping hop-by-hop headers,
   failing with explicit codes when the upstream is missing/unreachable.
4. BetterAuth sets `__Secure-better-auth.session_token` on the **console origin**.
5. **Rails `ConsoleAuthentication`** validates by probing Overture `/v1/project`
   with the session cookie only (never a service key); fails closed in production
   (redirect to `{LANDING_URL}/auth`). Basic-auth (`ADMIN_USERNAME`/`ADMIN_PASSWORD`)
   is an **admin/preview fallback only**.
6. **Overture `middleware/session_auth.go`** looks up `session`→`"user"`, and on
   first authenticated request **auto-provisions the tenant** (`tenant_id = user.id`).
   API keys (`igris_…`) resolve via `tenants.api_key_hash` or `tenant_api_keys`.
   BetterAuth schema is migration `015_better_auth.sql` (`user`/`session`/`account`/`verification`).

Answers to the posed questions:
- **Where should login be handled?** It already is correct: a dedicated BetterAuth
  upstream, with the **console host owning `/api/auth/*`** via the proxy. Landing
  is just the form; it posts to the console origin. Keep this.
- **Cookies / domain?** `__Secure-better-auth.session_token` (+ non-secure variant
  for local). Because everything funnels through the console origin, **cross-subdomain
  cookies are NOT required** — but this only holds if `getConsoleUrl()` (landing),
  `BETTER_AUTH_BASE_URL`/`NEXT_PUBLIC_CONSOLE_URL` (upstream), and the rails console
  host are the **same production origin**. Verify in prod env.
- **Does Rails validate sessions through Overture?** Yes — server-side probe of
  `/v1/project`, cookie-only. Correct and tenant-safe.
- **Basic Auth?** Admin fallback only; not the customer path. Good.
- **Can a new user sign up → sign in → get an API key → reach /home without Basic
  Auth?** Yes by design (auto-tenant-provision + Settings API-key path), pending
  the env wiring below and the password-reset fix.

### Recommended Auth Setup (production)
Keep the current topology. Required env, by host:
- **better-auth-upstream**: `DATABASE_URL` (Neon **direct**), `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_BASE_URL` (= console origin), `NEXT_PUBLIC_LANDING_URL`,
  and `GOOGLE_CLIENT_ID/SECRET` + `GITHUB_CLIENT_ID/SECRET` if OAuth is enabled at
  launch (OAuth redirect/callback URLs must be registered with each provider,
  pointing back through the console origin).
- **rails-console**: `BETTER_AUTH_UPSTREAM_URL`, `OVERTURE_API_BASE_URL`,
  `LANDING_URL`, `BETTER_AUTH_SECRET` (HMAC defense-in-depth), and
  `ADMIN_USERNAME`/`ADMIN_PASSWORD` only if an admin fallback is wanted.
- **landing**: `NEXT_PUBLIC_CONSOLE_URL` (so `getConsoleUrl()` resolves to the
  real console origin).
- **Overture**: `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`.

## Required Environment Variables (consolidated)
`DATABASE_URL` (direct, all DB-touching services) · `BETTER_AUTH_SECRET` (shared by
upstream + Overture + rails) · `BETTER_AUTH_BASE_URL` · `BETTER_AUTH_UPSTREAM_URL` ·
`NEXT_PUBLIC_CONSOLE_URL` · `NEXT_PUBLIC_LANDING_URL` / `LANDING_URL` ·
`OVERTURE_API_BASE_URL` · `OVERTURE_API_KEY` · `GOOGLE_CLIENT_ID/SECRET` ·
`GITHUB_CLIENT_ID/SECRET` (if OAuth) · `ADMIN_USERNAME/PASSWORD` (optional fallback).

## Launch Blockers (ranked)

**P0 — RESOLVED**
1. ~~Migrations 064/065/066 unapplied in production~~ → **APPLIED 2026-06-23**,
   branch-validated (38/0) then prod-applied + attested (38/0). Evaluations
   persistence, Policy Proposals, and Trust-Rec lifecycle now have their tables in
   prod.
2. ~~Branch validation cannot run~~ → done; branch DSN supplied, validated.

**P1**
3. **Password reset is server-incomplete** — landing calls
   `authClient.requestPasswordReset`, but `auth-server.ts` does not configure
   `emailAndPassword.sendResetPassword`, so **no reset email is ever sent**. The
   forgot-password UI is a dead end until this callback (Resend-backed) is wired.
4. **Auth env-origin consistency** — the single-origin cookie model only works if
   landing/upstream/console URLs resolve to the same production console origin and
   OAuth callbacks are registered. Verify before launch.
5. **Polar price IDs are placeholders** (`price_seed_monthly`, …) — no paid
   conversion until set in the Polar dashboard.
6. **`tenant_tier` enum migration of record** — was fixed by manual `ALTER TYPE`
   on the old VPS; not represented as a migration. Confirm Neon prod has
   `seed/horizon/infinite` enum values (read-only check) and add a migration so no
   environment depends on a manual fix. Per rules, NOT run here without separate
   proof/approval.

**P2**
7. Signup has no email verification (`requireEmailVerification` unset) — acceptable
   for Operator Beta; decide before broad GA.
8. Bootsnap stale-cache can produce phantom Rails test failures — ensure CI starts
   from a clean cache.

## Commands Run (read-only / local only)
- `git status --short`, `git diff --check` (clean)
- `ls .../064* .../065* .../066*` (present)
- env-file existence/perms check (no contents printed)
- tooling probe (`psql` present; `neon` CLI absent)
- attestation coverage grep (064/065/066 absent → extended)
- `go test ./…/executionevals ./…/policyproposals ./…/trustrecs ./…/middleware` → **ok (all pass)**
- rails-console full suite (earlier this session): **427 runs, 0 failures** on clean cache
- auth code inspection (rails console, landing, better-auth-upstream, Overture middleware)

## Files Changed
- `igris-overture/database/attestation/verify_launch_schema.sql` — added read-only
  attestation checks for 064/065/066.
- `LAUNCH_READINESS_2026-06-23.md` — this report.
- `.gitignore` — adds `.neon_launch_branch_env` to the ignore list.
- (gitignored, not committed) `.neon_launch_branch_env`, `.neon_prod_env` —
  values single-quoted so DSNs containing `&`/`?` source correctly; `chmod 600`.

## Final Git Status
```
 M .gitignore
 M igris-overture/database/attestation/verify_launch_schema.sql
?? LAUNCH_READINESS_2026-06-23.md
```
`git diff --check`: clean. Env files confirmed git-ignored (`!!`) — no secrets in
the repo. `AUDIT_PRODUCT_READINESS_2026-06-23.md` already tracked. **No commit, no
push, no deploy performed** (none requested).

## Next Manual Steps
1. Provide `.neon_launch_branch_env` (direct, non-pooled) **or** install `neonctl` +
   `NEON_API_KEY`.
2. I run Phase 2 branch validation → report PASS/FAIL.
3. On PASS, I run Phase 3 prod preflight (read-only) and report the exact gap.
4. **You approve**, then I apply only the missing 064→065→066 in prod + attest.
5. Separately: wire `sendResetPassword` (Resend), set Polar price IDs, confirm auth
   env origins, and add the `tenant_tier` enum migration of record.

## Final Verdict
Code is launch-shaped; the gate is operational. **Do not mark production ready**
until 064–066 are applied + attested and the P1 auth/billing items are closed.
Provide the branch DSN and I will continue immediately, stopping again for explicit
approval before any production write.
