# Igris Inertial — Production Bring-Up & Launch Verification (2026-06-24)

**Role:** Production / Infrastructure / Security Engineer + Launch Lead
**Scope:** Deployment, configuration, and launch verification only. No new features.

---

## Launch Readiness Score: **74 / 100**

## Launch Verdict: **NOT READY** — one P0 deployment blocker

> Single blocker: the **BetterAuth service that serves all signup/login has no
> deployment artifact and no pipeline**. Everything *behind* auth (migrations,
> billing, runtime, console, proof) is in good shape — Polar now carries **real**
> price IDs, auth recovery is wired in code, and prod migrations are applied. But
> a brand-new customer cannot create an account or log in today, so the journey
> fails at step 1. Fix the auth deployment and this moves to **READY WITH MINOR
> ITEMS**. A repo-side fix for the blocker (Dockerfile + CI image) is included in
> this pass; the remaining work is operator provisioning (Container App + env +
> DNS), not engineering.

---

## 1. Executive Summary

I verified the production topology against one question: *can a real customer sign
up, verify email, log in, install the CLI, run an action, verify proof, and buy a
plan with no engineering help?* The answer today is **no — they are stopped at
account creation.**

The customer auth path is: landing `AuthForm` → `authClient` (baseURL =
`https://console.igrisinertial.com`) → Rails console `/api/auth/*`
(`AuthProxyController`) → `BETTER_AUTH_UPSTREAM_URL` → the **`better-auth-upstream`
Next.js service**. That last hop is the problem:

- `better-auth-upstream` had **no Dockerfile**.
- It is **not** in the image-build matrix (`build-container-images.yml` built only
  `igris-api` and `igris-console`).
- It is **not** in any Azure deploy workflow, `render.yaml`, or
  `docker-compose.production.yml`.

So in production, `BETTER_AUTH_UPSTREAM_URL` is either unset (proxy returns
`503 AUTH_UPSTREAM_MISSING`) or points at a service that does not exist (proxy
returns `502 AUTH_UPSTREAM_UNREACHABLE`). Either way **every `/api/auth/*` call
fails and no one can sign up or log in.** This is the launch blocker.

**Fixed in this pass (repo-side, additive, safe):** authored
`web/apps/better-auth-upstream/Dockerfile` (standalone Next.js, pnpm-workspace
context) and added an `igris-auth` entry to the image-build matrix so the service
can be built and pushed to GHCR like the other two. The matrix is `fail-fast:
false`, so this cannot break the existing api/console builds. **This artifact was
not build-verified in this environment** (no `node_modules`, cannot run
`next build`/Docker here) — it mirrors the proven landing standalone pattern and
needs one CI build before trust (see §8).

Everything else is materially better than the prior audits reported:
- **Polar price IDs are now real** (UUIDs in `.env.production`), not placeholders.
- **Password reset + email verification are wired** end-to-end in code.
- **Migrations 064/065/066 are applied + attested** (38/0).

---

## 2. BetterAuth Status

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Auth handler code | ✅ | `web/apps/better-auth-upstream/src/lib/auth-server.ts` — email+password, reset, verification, optional Google/GitHub all wired. |
| Resend sender code | ✅ | `src/lib/email.ts` — dependency-free Resend client, graceful no-op without key, no token logging. |
| Route handler | ✅ | `app/api/auth/[...all]/route.ts` — returns `503 AUTH_NOT_CONFIGURED` if `DATABASE_URL`/`BETTER_AUTH_SECRET` missing. |
| Console proxy | ✅ | `AuthProxyController#forward` forwards to `BETTER_AUTH_UPSTREAM_URL`, strips hop-by-hop headers, forwards cookies. |
| Overture session validation | ✅ | `middleware/session_auth.go` reads `__Secure-better-auth.session_token` + verifies HMAC with `BETTER_AUTH_SECRET`. |
| **Service deployment** | ❌ **P0** | **No Dockerfile, no CI image, no deploy target.** Fixed repo-side in this pass; operator must provision the running service. |
| `next.config.js` | ✅ | `output: 'standalone'` — container-ready. |

**Required env on the auth service deployment** (names only):
`DATABASE_URL` (Neon), `BETTER_AUTH_SECRET` (must match Overture), `BETTER_AUTH_BASE_URL`
(= `https://console.igrisinertial.com`, for cookie scope), `NEXT_PUBLIC_LANDING_URL`
(= `https://igrisinertial.com`, trustedOrigins), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
and `GOOGLE_CLIENT_ID/SECRET` + `GITHUB_CLIENT_ID/SECRET` only if OAuth is on at launch.

**Callback / origin notes:**
- Cookies scope to the **console origin** — landing, upstream `baseURL`, and the
  browser auth calls must all resolve to `https://console.igrisinertial.com`. Verified
  in code (`getConsoleUrl()` defaults to `https://console.igrisinertial.com`;
  `auth-server.ts baseURL` defaults to the same via `BETTER_AUTH_BASE_URL`).
- If OAuth is enabled, register provider callback URLs back through the console origin
  (`/api/auth/callback/google`, `/api/auth/callback/github`). Optional for launch —
  email+password works without it.

---

## 3. Resend Status

| Item | Status | Notes |
|------|--------|-------|
| Sender code (Go) | ✅ | `igris-overture/billing/resend.go`. |
| Sender code (auth) | ✅ | `email.ts` reuses the same env + default sender `Igris Inertial <noreply@igrisinertial.com>`. |
| `RESEND_API_KEY` present | ⚠️ | Real key exists in `.env.production` (`re_…`). Must also be set **on the auth-service deployment** — that service is a separate process and does not read `.env.production`. |
| `RESEND_FROM_EMAIL` | ✅ | Set in `.env.production`; defaults safely if unset. |
| **Sender domain verified** | ❓ **operator** | `igrisinertial.com` SPF/DKIM verification in the Resend dashboard **cannot be checked from the repo**. Until verified, verification + reset emails will fail or land in spam. **Action: confirm domain status in Resend before launch.** |

**Operator actions:**
1. In Resend, confirm `igrisinertial.com` is a **verified sending domain** (SPF + DKIM green).
2. Set `RESEND_API_KEY` on the **auth-service** deployment (not just the Go API).
3. Send one live test reset + one verification email end-to-end after deploy.

---

## 4. Polar Status

| Item | Status | Evidence |
|------|--------|----------|
| Real price IDs | ✅ **(was placeholder)** | `.env.production`: `POLAR_PRICE_SEED/HORIZON/INFINITE` = real UUIDs (`46f30e81-…`, `59de0489-…`, `8e0d7668-…`). |
| Webhook secret | ✅ | `POLAR_WEBHOOK_SECRET=polar_whs_…` (real). |
| API key | ✅ | `POLAR_API_KEY=polar_oat_…` (real). |
| Checkout ↔ webhook consistency | ✅ | `billing/polar_client.go` `init()` binds plan `MonthlyPriceID` to the same `POLAR_PRICE_*` env used for checkout, so tier resolution (`GetTierByPriceID`/`ResolveTierID`) matches real IDs. Placeholder fallback retained only when env unset. |
| Plan config | ✅ | Seed $29 / Horizon $149 / Infinite $699, limits 3/50/500. |
| Env reaches prod | ❓ **operator** | These values live in `.env.production` (the legacy Docker/Clerk file). Production is **Azure Container Apps + Neon**, whose env is set in the Container App, **not** from this file. **Confirm `POLAR_*` are set on the Azure `igris-api` app.** |

**Verdict:** Billing is code-complete and now carries real IDs — the only open item
is confirming the values are present on the **Azure** API deployment's environment.
No code change needed.

---

## 5. Customer Journey Validation

| # | Step | Status | Blocker / Notes |
|---|------|--------|-----------------|
| 1 | Create account | ❌ **BLOCKED** | Auth service undeployed → `/api/auth/sign-up` returns 502/503. |
| 2 | Receive verification email | ⛔ blocked by #1 | Code ✅; needs auth service + `RESEND_API_KEY` + verified domain. |
| 3 | Verify account | ⛔ blocked by #1 | Code ✅ (`emailVerification.sendOnSignUp`). |
| 4 | Login | ❌ **BLOCKED** | Same root cause as #1. |
| 5 | Generate API key | ✅ (post-login) | `POST /settings/api-keys` → `tenant_api_keys`. |
| 6 | Install CLI | ✅ | `igrisinertial.com/install` canonical command; `GET /v1/runtime/install` serves it. |
| 7 | Authenticate CLI | ✅ | `IGRIS_API_KEY` header; runtime register endpoints exist. |
| 8 | Register agent | ✅ | Tenant auto-provisioned in `session_auth.go`. |
| 9 | Execute action | ✅ | Actions → run. |
| 10 | View run | ✅ | Runs list + Run detail. |
| 11 | Verify proof | ✅ | Run detail proof/receipts surface. |
| 12 | Access console | ✅ | Session-cookie gated; no Basic Auth for customers. |
| — | Purchase a plan | ✅ (post-login) | Real Polar IDs; checkout + tiering work once Azure env confirmed. |

**The single failure point that cascades to the whole journey is step 1.** Steps
5–12 are sound; they are simply unreachable until a customer can authenticate.

**Secondary (operator-verifiable) journey risks:**
- `RUNTIME_BINARIES_URL` → GitHub Releases `runtime-v1.6.0`. Confirm that release tag
  exists and the install script served at `/install` matches the authenticated model
  (the repo `install.sh` still references GitHub Releases — verify the deployed copy).

---

## 6. Production Configuration Review

| Area | Status | Notes |
|------|--------|-------|
| DNS — api/console/landing/docs | ✅ documented | `api.`, `console.`, `app.`, landing, `docs.` per `DEPLOY.md`. |
| DNS — **auth host** | ❌ missing | No record for the auth service (e.g. `auth.igrisinertial.com` or internal ACA URL). Needed once the service is deployed. |
| Compute — API | ✅ | Azure Container App `igris-api` (GHCR image). |
| Compute — Console | ✅ | Azure Container App `igris-console` (GHCR image). |
| Compute — **Auth** | ❌ → fixed repo-side | No Container App; no image until this pass added `igris-auth` to the matrix. Operator must create the Container App from the new image. |
| Migrations | ✅ | 064/065/066 applied + attested 38/0 (2026-06-23). |
| Auth secrets | ⚠️ | `BETTER_AUTH_SECRET` must be **identical** across auth service + Overture (+ Rails for defense-in-depth). |
| Billing env | ⚠️ | Real values exist in `.env.production`; confirm present on Azure `igris-api`. |
| Legacy config drift | ⚠️ | `.env.production` + `docker-compose.production.yml` describe the **retired Clerk/VPS** topology (Clerk JWKS, `postgres`/`cache` services). Production is Azure+Neon+BetterAuth. Keep, but do not treat `.env.production` as the source of truth for the Azure env. |

---

## 7. Missing Environment Variables (by host)

**Auth service (`better-auth-upstream`) — NOT YET DEPLOYED, all required:**
- `DATABASE_URL` (Neon — same DB as Overture session tables)
- `BETTER_AUTH_SECRET` (must equal Overture's)
- `BETTER_AUTH_BASE_URL` = `https://console.igrisinertial.com`
- `NEXT_PUBLIC_LANDING_URL` = `https://igrisinertial.com`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (optional; safe default)
- `IGRIS_REQUIRE_EMAIL_VERIFICATION` (optional; default off — keep off for beta)
- `GOOGLE_/GITHUB_ CLIENT_ID/SECRET` (only if OAuth at launch)

**Rails console (Azure `igris-console`):**
- `BETTER_AUTH_UPSTREAM_URL` = `https://<auth-host>/api/auth` — **currently the
  missing link; set once the auth service is up.**
- `BETTER_AUTH_SECRET`, `LANDING_URL`, `OVERTURE_API_BASE_URL` (verify present).

**Landing (Cloudflare Pages):**
- `NEXT_PUBLIC_CONSOLE_URL` = `https://console.igrisinertial.com` (defaults correctly
  in code, but set explicitly for clarity).

**Overture API (Azure `igris-api`):**
- Confirm `POLAR_PRICE_SEED/HORIZON/INFINITE`, `POLAR_API_KEY`,
  `POLAR_WEBHOOK_SECRET`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `DATABASE_URL`,
  `ALLOWED_ORIGINS` (must include console origin) are all set on the Container App.

---

## 8. Remaining Launch Blockers

**P0 — must fix before launch**
1. **Deploy the BetterAuth service.** Repo-side artifact now exists
   (`web/apps/better-auth-upstream/Dockerfile` + `igris-auth` CI image). Operator must:
   build/push the image, create the Azure Container App, set its env (§7), give it a
   reachable host, and point `BETTER_AUTH_UPSTREAM_URL` at `https://<host>/api/auth`.
   **Verify the Dockerfile build once** — it was not build-verified here; if pnpm
   `--frozen-lockfile` complains about missing sibling manifests, copy the other
   `apps/*/package.json` into the deps stage. Confirm the standalone output path
   (`apps/better-auth-upstream/.next/standalone/apps/better-auth-upstream/server.js`).

**P1 — confirm before customer traffic**
2. **Resend domain verification** — confirm `igrisinertial.com` SPF/DKIM is verified;
   set `RESEND_API_KEY` on the auth service; send one live reset + verify email.
3. **Polar env on Azure** — confirm the real `POLAR_*` values are on the `igris-api`
   Container App (they live in `.env.production`, which Azure does not read).
4. **Auth origin/secret consistency** — `BETTER_AUTH_SECRET` identical across
   auth+Overture; all origins resolve to the console domain; OAuth callbacks
   registered if OAuth is on.

**P2 — operational, not launch-gating**
5. Confirm `runtime-v1.6.0` release exists and the deployed `/install` script matches
   the authenticated model.
6. `tenant_tier` enum has no migration of record (fixed by manual `ALTER TYPE`) —
   add one so no environment depends on a manual fix.
7. Email-verification login-gating off (`IGRIS_REQUIRE_EMAIL_VERIFICATION` unset) —
   fine for beta; decide before broad GA.

---

## 9. Launch Checklist

**Code / repo (this pass)**
- [x] BetterAuth `Dockerfile` authored (`web/apps/better-auth-upstream/Dockerfile`).
- [x] `igris-auth` added to `build-container-images.yml` matrix.
- [ ] **One CI/local build of the `igris-auth` image succeeds** (not done here).

**Auth service (operator)**
- [ ] Build + push `ghcr.io/igris-inertial/system/igris-auth`.
- [ ] Create Azure Container App for auth; set env (§7).
- [ ] Assign a reachable host; add DNS if external.
- [ ] Set `BETTER_AUTH_UPSTREAM_URL` on the console to `https://<host>/api/auth`.
- [ ] Smoke: `scripts/smoke/auth-bridge-smoke.sh` against prod origins.

**Email (operator)**
- [ ] `igrisinertial.com` verified in Resend (SPF + DKIM).
- [ ] `RESEND_API_KEY` set on the auth service.
- [ ] Live reset + verification email delivered to a real inbox.

**Billing (operator)**
- [ ] `POLAR_*` real values present on Azure `igris-api`.
- [ ] One live test checkout → webhook → tenant tiered correctly.

**Journey acceptance**
- [ ] Sign up → verify email → log in (real customer, no eng help).
- [ ] Generate API key → install CLI → register agent → run action.
- [ ] View run → verify proof.
- [ ] Purchase a plan.

---

## 10. Final Recommendation

**Hold launch until the BetterAuth service is deployed and the sign-up → log-in path
is smoke-tested in production.** That is the only thing standing between the current
state and a working customer journey — everything downstream (CLI, runtime, actions,
proof, console, billing) is ready, and billing/auth-recovery gaps from prior audits
are closed in code.

Concretely: build + deploy the new `igris-auth` image, wire its env and
`BETTER_AUTH_UPSTREAM_URL`, verify the Resend domain, and confirm the Polar env on
Azure. After those four operator steps (no further engineering), re-run the journey
acceptance checklist; on green, the verdict moves to **READY WITH MINOR ITEMS** and a
real customer can onboard, run, verify proof, and purchase without engineering
assistance.

**Exact current blocker and location:** customer sign-up/login fail at
`AuthProxyController` → `BETTER_AUTH_UPSTREAM_URL` because the
`web/apps/better-auth-upstream` service has no production deployment. Repo-side fix
shipped here; operator provisioning is the remaining step.

---

### Files changed this pass
```
A  web/apps/better-auth-upstream/Dockerfile              (standalone image, workspace context)
M  .github/workflows/build-container-images.yml          (igris-auth matrix entry + header)
?? LAUNCH_BRINGUP_VERIFICATION_2026-06-24.md             (this report)
```
No commit, no push, no deploy, no new migrations, no feature/UI changes.
