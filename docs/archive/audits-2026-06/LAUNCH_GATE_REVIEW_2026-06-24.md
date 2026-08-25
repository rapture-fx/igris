# Igris Inertial — Final Production Launch Gate Review (2026-06-24)

**Reviewer hats:** CTO · Staff Platform Eng · Security Lead · Infra Lead · Product Lead
**Question on the table:** *Can Igris accept external customers today?*

---

## Launch Readiness Score: **70 / 100**

## Launch Verdict: **NOT READY** — today

> **Would I personally allow external customers onto Igris today? No.** Not because
> the product is unfinished — the engineering is in good shape — but because the
> **authentication service is not actually deployed**, so a real customer hits
> 502/503 at sign-up. The fix is **operator execution, not engineering**: the deploy
> path is built and build-verified, it just hasn't been run. There is also a
> **committed-secret** issue that must be remediated before/around opening access.
> Clear both and this is **READY WITH MINOR ITEMS** within a day.

---

## 1. Executive Summary

The platform behind the front door is launch-grade: migrations 064/065/066 applied
and attested (38/0), tenant isolation has real test coverage, billing carries real
Polar IDs with HMAC-verified webhooks, and the post-login customer journey
(API key → CLI → agent → action → proof → run) is sound. Auth recovery (reset +
verification) is wired in code, and the BetterAuth service is now build-verified and
has a real deploy pipeline.

But "ready to deploy" is not "deployed." Two gate items stand between the current
state and external customers:

- **P0 — Auth is not running in production.** The `igris-auth` Dockerfile and
  `deploy-auth-azure.yml` are **not even committed** (working-tree only); no image is
  in GHCR, no Container App exists, and the console's `BETTER_AUTH_UPSTREAM_URL` is
  unwired. So `/api/auth/*` → 502/503 → **no customer can sign up or log in today.**
- **P0 (security) — Real secrets committed to git.** `.env.azure.local` is tracked
  (commit `1fd35ea04`) and contains a live Neon DB password, an `igris_…`
  `OVERTURE_API_KEY`, the console `ADMIN_PASSWORD`, and Azure IDs, on a GitHub remote.

Everything else is either green or a one-time operator config (Resend domain, Polar
env on Azure). The launch is **gated on execution + remediation, measured in hours,
not features.**

---

## 2. Infrastructure Status

| Component | Status | Notes |
|-----------|--------|-------|
| `igris-api` (Overture) | ✅ deployed | Azure Container App; Neon-backed; `/healthz` `/readyz`. Confirm the running image SHA includes the 064/065/066-era code (evals/proposals/trustrecs). |
| `igris-console` (Rails) | ✅ deployed | Azure Container App; session-cookie gated; admin Basic fallback. |
| `igris-auth` (BetterAuth) | ❌ **not deployed** | Build-verified locally (boots, `GET /`→200), but **no image, no Container App, files uncommitted.** This is the P0. |
| Azure Container Apps env | ⚠️ | api/console live; **no `igris-auth` app provisioned** (needs external ingress on port 3001). |
| DNS | ⚠️ | api/console/landing/docs documented & live; **no record for the auth host** (the ACA FQDN or `auth.igrisinertial.com`) — needed once auth deploys. |
| Env configuration | ⚠️ | `.env.production` is **legacy Clerk/VPS** (not read by Azure). Azure env is set on the Container Apps and must be confirmed (Polar, Resend, `BETTER_AUTH_SECRET`). |

**Blocks production operation:** the missing `igris-auth` service. Nothing else.

---

## 3. Authentication Status

| Flow | Code | Runtime (prod) |
|------|------|----------------|
| Sign up | ✅ wired | ❌ 502/503 — upstream not deployed |
| Login | ✅ wired | ❌ same root cause |
| Logout | ✅ wired (rail button → `/api/auth/sign-out`) | ❌ same |
| Password reset | ✅ wired (server `sendResetPassword` + landing reset form) | ⚠️ needs auth deployed + `RESEND_API_KEY` + verified domain |
| Email verification | ✅ wired (`sendOnSignUp`, gating off by default) | ⚠️ same |
| Session validation | ✅ | Overture `session_auth.go` HMAC-verifies `BETTER_AUTH_SECRET`; cookie-only `/v1/project` probe |

**Remaining work is configuration/execution, not engineering.** The proxy
(`AuthProxyController` → `BETTER_AUTH_UPSTREAM_URL`) is correct and tested
(`auth_proxy_test` + `customer_session_auth_test` → 8/0). The standalone server was
booted locally and serves. The only thing missing is *running it in prod and pointing
the console at it*. See the prior bring-up report `AUTH_DEPLOYMENT_BRINGUP_2026-06-24.md`.

---

## 4. Billing Status

| Item | Status |
|------|--------|
| Polar products/prices | ✅ Real price IDs (UUIDs) in `.env.production`: Seed/Horizon/Infinite. |
| Webhook configuration | ✅ `webhook_handler.go` HMAC-verifies `X-Polar-Signature`; **rejects all webhooks if no secret configured** (fail-closed). Real `POLAR_WEBHOOK_SECRET` present. |
| Checkout flow | ✅ env-driven `POLAR_CHECKOUT_*` / `POLAR_PRICE_*`; consistent with webhook tier resolution via `init()` binding. |
| Subscription handling | ✅ `ResolveTierID` metadata-first then price-ID; Seed/Horizon/Infinite limits 3/50/500. |
| Launch readiness | ⚠️ **Code-ready.** Confirm the real `POLAR_*` values are set on the **Azure `igris-api`** Container App (they live in the legacy `.env.production`, which Azure doesn't read). |

Billing is **not a launch blocker** — it's one env-confirmation step, and it's off the
critical signup path anyway (customers can onboard before purchasing).

---

## 5. Customer Journey Status

| # | Step | Status | Failure point |
|---|------|--------|---------------|
| 1 | Create account | ❌ **BLOCKED** | auth service not deployed → 502/503 |
| 2 | Verify email | ⛔ blocked by #1 | + needs verified Resend domain to deliver |
| 3 | Login | ❌ **BLOCKED** | same root cause |
| 4 | Generate API key | ✅ (post-login) | `POST /settings/api-keys` |
| 5 | Install CLI | ✅ | `igrisinertial.com/install` |
| 6 | Authenticate CLI | ✅ | `IGRIS_API_KEY` |
| 7 | Register agent | ✅ | tenant auto-provisioned |
| 8 | Execute action | ✅ | |
| 9 | Verify proof | ✅ | run detail receipts |
| 10 | View run | ✅ | |
| 11 | Purchase plan | ✅ (post-login) | real Polar IDs; confirm Azure env |

**Single cascading failure point: step 1.** Steps 4–11 are sound but unreachable until
a customer can authenticate. There are no *second* hidden blockers downstream.

---

## 6. Security Status

| Area | Status | Notes |
|------|--------|-------|
| Secret exposure (env files) | ❌ **P0** | `.env.azure.local` **committed** (`1fd35ea04`) with live Neon password, `OVERTURE_API_KEY`, `ADMIN_PASSWORD`, Azure IDs, on a GitHub remote. `.env.production`/`.env`/`.neon_*` are correctly gitignored. |
| Auth secrets config | ⚠️ | `BETTER_AUTH_SECRET` must be **identical** across auth/api/console; verify once auth deploys. |
| Tenant isolation | ✅ | Real coverage: `tenant_isolation_test.go`, `tenant_auth_leak_test.go`, `auth_apikey_tenant_scoping_test.go`, `routes_proof_tenant_scope_test.go`, execution-lineage tenant tests. |
| Recovery flow safety | ✅ | Single-use expiring tokens; no user enumeration; no token/url/cookie logging; reset-gating fail-open so a mailer outage can't lock out logins. |
| Webhook integrity | ✅ | HMAC verify, fail-closed without secret. |
| Container hardening | ✅ | `igris-auth` image runs non-root (uid 1001), minimal standalone. |
| Deploy secret handling | ✅ | `deploy-auth-azure.yml` uses Container App secrets + `secretref:`, no echo, GitHub auto-masks. |

**Action:** treat the committed `.env.azure.local` credentials as compromised —
**rotate** the Neon password, the `OVERTURE_API_KEY`, and the `ADMIN_PASSWORD`, then
**git-rm the file, add it to `.gitignore`** (consider history scrubbing if the repo is
or ever was public).

---

## 7. P0 Issues — Launch Blockers

1. **`igris-auth` not deployed.** Files uncommitted → no GHCR image → no Container App
   → console `BETTER_AUTH_UPSTREAM_URL` unwired → signup/login 502/503. *Fix: commit
   the 4 auth files, run `build-container-images.yml`, provision the Container App,
   run `deploy-auth-azure.yml`, wire the console.* (Engineering done & verified;
   execution pending.)
2. **Committed secrets in `.env.azure.local`.** Rotate Neon password / `OVERTURE_API_KEY`
   / `ADMIN_PASSWORD`; untrack + gitignore the file. Do before opening access.

---

## 8. P1 Issues — Should Fix Soon

1. **Resend domain verification.** `igrisinertial.com` must be SPF/DKIM-verified and
   `RESEND_API_KEY` set on the **auth** deployment, or verification/reset emails won't
   deliver. (Signup/login still work without it — gating is off.)
2. **Polar env on Azure.** Confirm the real `POLAR_PRICE_*` / `POLAR_WEBHOOK_SECRET` /
   `POLAR_API_KEY` are set on the `igris-api` Container App, not just in `.env.production`.
3. **Auth origin/secret consistency.** `BETTER_AUTH_SECRET` identical across all three
   services; all origins resolve to the console domain; OAuth callbacks registered if
   OAuth is enabled at launch.
4. **Confirm deployed API image SHA** includes the evals/proposals/trustrecs code that
   matches the applied migrations (`.env.azure.local` references `sha-b49470f`).

---

## 9. P2 Issues — Future Improvements

1. Email-verification login-gating is off (`IGRIS_REQUIRE_EMAIL_VERIFICATION` unset) —
   fine for beta; decide before broad GA.
2. `tenant_tier` enum has no migration of record (was a manual `ALTER TYPE`) — add one
   so no environment depends on a manual fix.
3. Confirm `runtime-v1.6.0` release exists and the served `/install` script matches the
   authenticated model (repo `install.sh` still references GitHub Releases).
4. Auth deploy is `workflow_dispatch` only; consider a gated auto-deploy once stable.

---

## 10. Recommended Launch Sequence

**Day 0 — security remediation (parallel, ~1–2h)**
1. Rotate Neon password, `OVERTURE_API_KEY`, `ADMIN_PASSWORD`; update them on the live
   Azure apps. `git rm --cached .env.azure.local`, add to `.gitignore`, commit.

**Day 0 — auth bring-up (~1–2h, mostly waiting on builds)**
2. Commit the 4 auth files; run `build-container-images.yml` → capture `igris-auth@sha256:…`.
3. Create the `igris-auth` Container App (external ingress :3001); set GitHub Env
   secrets/vars (`BETTER_AUTH_SECRET`=api's value, `DATABASE_URL`, `RESEND_API_KEY`,
   `BETTER_AUTH_BASE_URL`=console origin, `NEXT_PUBLIC_LANDING_URL`).
4. Run `deploy-auth-azure.yml` with the digest (it smoke-tests `/` + `/api/auth/get-session`).
5. Set console `BETTER_AUTH_UPSTREAM_URL=https://<auth-fqdn>/api/auth`; redeploy console.

**Day 0 — config confirms (~30m)**
6. Verify Resend domain (SPF/DKIM) + `RESEND_API_KEY` on auth. Confirm Polar env on `igris-api`.

**Day 0 — acceptance (the gate)**
7. Real signup → (verify email) → login → API key → install CLI → run action → proof →
   (test purchase). No 502/503. Confirm `BETTER_AUTH_SECRET` identical across services.

**Open access** only after step 7 is green end-to-end.

---

## 11. Final Recommendation

**Hold external access until the auth service is live and the committed credentials are
rotated.** Both are operator tasks with no remaining engineering — the auth deploy is
build-verified and scripted, and the secret remediation is a rotate-and-untrack. Once
the Day-0 sequence above passes its acceptance check (real signup→login→run→proof), the
verdict flips to **READY WITH MINOR ITEMS** (Resend domain + Polar Azure env being the
trailing P1 config), and a real customer can onboard without engineering assistance.

**Exact blocker today:** customer sign-up fails at `AuthProxyController` →
`BETTER_AUTH_UPSTREAM_URL` because `igris-auth` is not deployed (and its files are not
yet committed); secondarily, live credentials are committed in `.env.azure.local`.

---

*Review basis: code/config inspection + reproduced builds/tests this session
(`pnpm build` standalone boot, rails auth suite 8/0, git tracking + webhook/tenant
checks). No features built, no migrations, no architecture changes — review only.*
