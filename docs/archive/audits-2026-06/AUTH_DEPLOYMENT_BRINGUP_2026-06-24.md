# BetterAuth Upstream — Production Deployment Bring-Up (2026-06-24)

**Priority:** P0 · **Goal:** make the BetterAuth upstream a real, deployable
production service and prove the build/runtime works so signup/login are no longer
blocked by missing infrastructure.

---

## Summary

The launch blocker was that `web/apps/better-auth-upstream` (which serves **all**
`/api/auth/*`) had no Dockerfile and no deploy target, so the Rails proxy hit a
non-existent upstream → 502/503 → no signup/login.

This pass makes it real and **build-verified**:

1. **Verified the image build path** with the CI-equivalent `pnpm build` (Docker is
   unavailable in this environment). The build initially produced a **broken,
   non-deterministic standalone layout** — Next.js inferred the wrong workspace root
   from a stray lockfile. **Fixed** by pinning `outputFileTracingRoot` in
   `next.config.js`. After the fix the standalone output is deterministic and the
   **server boots and serves** (verified locally).
2. **Hardened the Dockerfile** to install+build in a single stage (avoids the fragile
   cross-stage copy of pnpm's symlinked `node_modules`) and copy only the
   self-contained `.next/standalone` tree.
3. **Added a real deployment target**: `.github/workflows/deploy-auth-azure.yml`
   (Azure Container App `igris-auth`) that updates the image **and** wires the runtime
   env as Container App secrets + secretrefs, then smoke-tests the live service.
4. **Documented the exact Rails-console wiring** (`BETTER_AUTH_UPSTREAM_URL`) and the
   exact env vars required on each service.

What remains is **operator execution** (push → build image → run deploy workflow with
secrets set, verify Resend domain) — there is no remaining engineering blocker, and
every command is provided below with no ambiguity.

---

## Auth Image Build Result

**Docker unavailable here** (`docker not found`), so I verified the build with the
CI-equivalent pnpm path and proved every Dockerfile assumption:

| Check | Result |
|-------|--------|
| `pnpm --filter @igris/better-auth-upstream build` | ✅ `Compiled successfully`, 4 routes incl. `ƒ /api/auth/[...all]` |
| Standalone output path | ✅ deterministic `apps/better-auth-upstream/server.js` + top-level `node_modules` (after fix) |
| Server boots (`node apps/better-auth-upstream/server.js`) | ✅ `Ready in 479ms`, `GET /` → **200** |
| Handler runs | ✅ `GET /api/auth/ok` → 503 `auth_not_configured` (no DB in test) — the handler executes; **not** the 502 from a missing service |
| Frozen filtered install in partial (Docker-like) context | ✅ `pnpm install --frozen-lockfile --filter @igris/better-auth-upstream...` with only root + app manifests → 274 pkgs, no missing-sibling error |
| Lockfile unchanged by install | ✅ `web/pnpm-lock.yaml` clean (frozen) |

### Bug found and fixed (do-not-guess)
The first build emitted:
> ⚠ Next.js inferred your workspace root … selected `/Users/wira/pnpm-lock.yaml`

…which nested `server.js` under `.next/standalone/Desktop/system/web/apps/better-auth-upstream/server.js` — a path no Dockerfile could reliably copy. Pinning the
tracing root makes it deterministic:

```js
// web/apps/better-auth-upstream/next.config.js
outputFileTracingRoot: path.join(__dirname, '../../'), // = pnpm workspace root web/
```

After the fix: `.next/standalone/apps/better-auth-upstream/server.js` + top-level
`node_modules` + `package.json` — exactly what the Dockerfile copies and runs.

> **One residual step the operator must do once:** run the actual
> `docker build -f apps/better-auth-upstream/Dockerfile -t igris-auth ./web` (or the
> CI `igris-auth` matrix job). The pnpm build, the standalone layout, the boot, and
> the partial-context frozen install are all verified; the only thing not exercised
> here is the Docker layer mechanics themselves (no Docker daemon available).

---

## Deployment Configuration Added

| File | Change |
|------|--------|
| `web/apps/better-auth-upstream/Dockerfile` | New. Node 20 alpine, pnpm 8.15.0, single-stage install+build, non-root, standalone runner, `/` healthcheck, `CMD node apps/better-auth-upstream/server.js`. Context = `./web`. |
| `web/apps/better-auth-upstream/next.config.js` | Pin `outputFileTracingRoot` to workspace root (determinism fix). |
| `.github/workflows/build-container-images.yml` | New `igris-auth` matrix entry → `ghcr.io/igris-inertial/system/igris-auth` (matrix is `fail-fast: false`; cannot affect api/console builds). |
| `.github/workflows/deploy-auth-azure.yml` | New. `workflow_dispatch` deploy of the `igris-auth` Container App: sets registry, secrets, env (secretrefs), image, then smoke-tests `GET /` (200) and `/api/auth/get-session` (non-5xx ⇒ configured). |

**Manual `az` equivalent** (if not using the workflow; replace digest + env source):

```bash
RG=rg-igris-prod; APP=igris-auth
az containerapp registry set -g $RG -n $APP --server ghcr.io \
  --username "$GHCR_USERNAME" --password "$GHCR_TOKEN"
az containerapp secret set -g $RG -n $APP --secrets \
  better-auth-secret="$BETTER_AUTH_SECRET" database-url="$DATABASE_URL" \
  resend-api-key="$RESEND_API_KEY"
az containerapp update -g $RG -n $APP \
  --image ghcr.io/igris-inertial/system/igris-auth@sha256:<digest> \
  --set-env-vars \
    BETTER_AUTH_SECRET=secretref:better-auth-secret \
    DATABASE_URL=secretref:database-url \
    RESEND_API_KEY=secretref:resend-api-key \
    BETTER_AUTH_BASE_URL=https://console.igrisinertial.com \
    NEXT_PUBLIC_LANDING_URL=https://igrisinertial.com \
    "RESEND_FROM_EMAIL=Igris Inertial <noreply@igrisinertial.com>"
```

The Container App must have **external ingress on target port 3001**.

---

## Required Production Environment Variables

**`igris-auth` (BetterAuth service) — required:**

| Var | Value | Notes |
|-----|-------|-------|
| `BETTER_AUTH_SECRET` | (secret) | **Must equal Overture's** value (cookie HMAC). |
| `DATABASE_URL` | (secret, Neon) | Same DB as Overture session tables. |
| `BETTER_AUTH_BASE_URL` | `https://console.igrisinertial.com` | Cookie scope + absolute reset/verify links. |
| `NEXT_PUBLIC_LANDING_URL` | `https://igrisinertial.com` | trustedOrigins. |
| `RESEND_API_KEY` | (secret) | Without it, reset/verify emails no-op (graceful). |
| `RESEND_FROM_EMAIL` | `Igris Inertial <noreply@igrisinertial.com>` | Optional; safe default. |
| `IGRIS_REQUIRE_EMAIL_VERIFICATION` | unset (default off) | See email-verification section. |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | (secret) | Optional; only if OAuth at launch. |
| `PORT` | `3001` | Set by image; ingress targetPort must match. |

**Rails console (`igris-console`) — the wiring that closes the blocker:**

| Var | Value |
|-----|-------|
| `BETTER_AUTH_UPSTREAM_URL` | `https://<igris-auth-fqdn>/api/auth` |
| `BETTER_AUTH_SECRET` | same shared value (defense-in-depth) |
| `LANDING_URL` | `https://igrisinertial.com` |
| `OVERTURE_API_BASE_URL` | `https://api.igrisinertial.com` |

**Overture (`igris-api`):** `BETTER_AUTH_SECRET` (same), `DATABASE_URL` (same Neon),
`ALLOWED_ORIGINS` including the console origin.

**Landing:** `NEXT_PUBLIC_CONSOLE_URL=https://console.igrisinertial.com` (defaults
correctly in code).

> GitHub-side names used by `deploy-auth-azure.yml`: **secrets** `BETTER_AUTH_SECRET`,
> `DATABASE_URL`, `RESEND_API_KEY`, `GH_OAUTH_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`,
> `GHCR_USERNAME/TOKEN`; **vars** `BETTER_AUTH_BASE_URL`, `NEXT_PUBLIC_LANDING_URL`,
> `RESEND_FROM_EMAIL`, `AZURE_*`, optional `AZURE_AUTH_APP` (defaults `igris-auth`).

---

## Rails Proxy Wiring

Verified the path end-to-end in code:

- Route: `match '/api/auth/*path' → auth_proxy#forward` (config/routes.rb).
- `AuthProxyController#forward` reads `ENV['BETTER_AUTH_UPSTREAM_URL']`; if unset →
  `503 AUTH_UPSTREAM_MISSING`; if unreachable → `502 AUTH_UPSTREAM_UNREACHABLE`.
- `build_target_uri` appends the wildcard suffix: with
  `BETTER_AUTH_UPSTREAM_URL=https://<fqdn>/api/auth`, a request to
  `/api/auth/sign-in/email` proxies to `https://<fqdn>/api/auth/sign-in/email`, which
  the auth service's `/api/auth/[...all]` route handles. ✅
- Cookies forwarded both directions; hop-by-hop headers stripped. ✅

**Set `BETTER_AUTH_UPSTREAM_URL` on the console once the auth FQDN exists** — that is
the single env change that turns the current 502/503 into a working login.

---

## Resend / Email Status

- Code: `src/lib/email.ts` sends via Resend REST (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  default sender `Igris Inertial <noreply@igrisinertial.com>`); graceful no-op without
  a key; never logs token/url/body (redacts recipient). ✅
- `auth-server.ts` wires `sendResetPassword`, `sendVerificationEmail`, `sendOnSignUp`. ✅
- **Operator config blocker (cannot be done from repo):** `igrisinertial.com` must be
  a **verified sending domain in Resend (SPF + DKIM)**, and `RESEND_API_KEY` must be
  set on the **igris-auth** deployment (it's a separate process from the Go API). Until
  both are true, reset/verify emails won't deliver — but signup/login still work.

I did **not** fake delivery; no live email was sent from this environment.

---

## Signup/Login Verification

- **Infra blocker resolved:** the upstream now exists as a build-verified, bootable
  service. `GET /` → 200; the BetterAuth handler executes (`/api/auth/*` no longer a
  502/503-from-missing-service).
- **Rails proxy** path verified in code + tests (below).
- **End-to-end live signup/login** requires the deployed Container App + `DATABASE_URL`
  + `BETTER_AUTH_SECRET` + the console's `BETTER_AUTH_UPSTREAM_URL`. With those set, the
  flow is: landing `AuthForm` → console `/api/auth/sign-up|sign-in` → proxy → igris-auth
  → Neon session tables → cookie on console origin → console access. The deploy
  workflow's smoke step asserts `/api/auth/get-session` is non-5xx (proves DB+secret
  wired) before declaring success.

> Cannot complete a real signup from this environment (no prod Neon/secret/daemon).
> The exact remaining steps + commands are listed under "Remaining Operator Steps".

## Password Reset Verification

Code path complete (verified in prior task + re-confirmed wired in `auth-server.ts` and
landing `AuthForm` reset mode). Functional delivery depends on `RESEND_API_KEY` + the
verified Resend domain. Single-use, expiring tokens; no token logging.

## Email Verification Verification

`emailVerification.sendOnSignUp: true` + `autoSignInAfterVerification`. Login-gating is
**env-gated and OFF by default** (`IGRIS_REQUIRE_EMAIL_VERIFICATION` unset), so a mailer
outage can never lock the tenant base out of login.
**Launch implication:** for beta, leave it off (signup works, verification email sent
but not enforced). Decide whether to set it `true` before broad GA.

---

## Security Review

- **No secrets committed:** scan of added files shows only env-var names / GitHub
  secret references / `secretref:` — no `re_…`, `polar_…`, `npg_…`, `postgres://`, or
  digests. ✅
- **No secret leakage in the workflow:** `set -euo pipefail` (no `set -x`), az calls
  `--only-show-errors 1>/dev/null`, sensitive values stored as Container App secrets and
  referenced via `secretref:`; GitHub auto-masks `secrets.*` in logs. ✅
- **No tokens/cookies/reset-links printed:** `email.ts` never logs url/token/body;
  health probe hits `/` only; smoke uses `-o /dev/null`. ✅
- **Non-root container** (uid 1001), minimal standalone image. ✅
- **No env files committed**, lockfile unchanged. ✅

---

## Tests Run

- `pnpm --filter @igris/better-auth-upstream build` → ✅ compiled, deterministic
  standalone (after fix).
- Local standalone boot → ✅ `GET /` 200, handler executes.
- Partial-context frozen install simulation → ✅ no missing-sibling error.
- `rails test test/controllers/auth_proxy_test.rb test/controllers/customer_session_auth_test.rb`
  (rbenv 3.2.2) → ✅ **8 runs, 27 assertions, 0 failures**.
- `git diff --check` → clean. Secret scan → clean.
- (No Rails source changed, so the full suite was not warranted; the auth/proxy path is
  the relevant surface and is green.)

> Note: two rails-console files (`application.css`, `application.html.erb`) show as
> modified independently of this work — an unrelated console **design** WIP (Geist
> fonts/gray scale), likely re-emitted by an asset build during `rails test`. Per the
> "don't touch unrelated WIP" constraint I left them untouched and **excluded them from
> this change set.** Only commit the four auth files below.

---

## Remaining Operator Steps

1. **Commit + push the four auth files** (exclude the unrelated CSS WIP):
   `web/apps/better-auth-upstream/Dockerfile`, `…/next.config.js`,
   `.github/workflows/build-container-images.yml`, `.github/workflows/deploy-auth-azure.yml`.
2. **Build the image:** run `build-container-images.yml` (workflow_dispatch) → grab the
   pinned `ghcr.io/igris-inertial/system/igris-auth@sha256:<digest>`.
3. **Ensure the `igris-auth` Container App exists** with external ingress on port 3001
   (create once if absent), and set GitHub Environment secrets/vars (table above).
4. **Deploy:** run `deploy-auth-azure.yml` with the digest. It wires env + smoke-tests.
5. **Wire the console:** set `BETTER_AUTH_UPSTREAM_URL=https://<igris-auth-fqdn>/api/auth`
   on `igris-console`, redeploy.
6. **Resend:** verify `igrisinertial.com` (SPF/DKIM); confirm `RESEND_API_KEY` on
   igris-auth; send one live reset + one verification email to a real inbox.
7. **Confirm `BETTER_AUTH_SECRET` is identical** on igris-auth, igris-api, igris-console.
8. **Acceptance:** real signup → (verify) → login → reach console, no 502/503.

---

## Final Launch Verdict: **READY WITH MINOR ITEMS**

The infrastructure blocker is engineering-resolved: the BetterAuth upstream is now a
build-verified, bootable, deployable production service with a real deploy pipeline and
documented, unambiguous wiring. Signup/login are **no longer blocked by missing
infrastructure**. The "minor items" are operator execution — run the two workflows with
secrets set, wire one console env var, and verify the Resend domain. None require
further engineering. After step 8's acceptance check passes, the verdict is **READY**.

### Files changed this pass
```
A  web/apps/better-auth-upstream/Dockerfile
M  web/apps/better-auth-upstream/next.config.js          (outputFileTracingRoot — determinism fix)
M  .github/workflows/build-container-images.yml          (igris-auth image)
A  .github/workflows/deploy-auth-azure.yml               (igris-auth Container App deploy + env + smoke)
?? AUTH_DEPLOYMENT_BRINGUP_2026-06-24.md                 (this report)
```
No commit, no push, no deploy, no migrations, no Rails/billing/CLI/schema changes.
Unrelated console-CSS WIP left untouched and excluded.
