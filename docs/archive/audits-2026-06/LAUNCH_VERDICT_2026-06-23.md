# Igris — Launch Readiness & Customer Onboarding Verdict (2026-06-23)

## Launch Verdict: **READY WITH MINOR ITEMS**

No P0 **code** blockers remain after this pass. The brand-new-customer journey
(sign up → log in → install → register agent → run → verify proof) works, and the
purchase path works **once the operator sets the Polar env vars** (the code now
supports real price IDs cleanly). Remaining items are operator-config and two P1
auth conveniences (password reset, email verification) that are off the critical
purchase path.

---

## 1. Executive Summary

I validated authentication, billing, CLI onboarding, and the console against one
question: *can a brand-new customer onboard, run an action, verify proof, and
become paying without engineering help?* Answer: **yes**, conditional on two
operator-config steps (Polar price/checkout env vars; confirm the `/install`
endpoint serves the authenticated script). Three launch-critical defects were found
and **fixed safely**: a wrong install URL in the console, a dead "Sign out" button,
and a billing webhook that couldn't resolve real Polar price IDs. Two real gaps
remain as P1 (password reset and email verification are unwired server-side) but
neither blocks a fresh signup→purchase.

## 2. Authentication Status

| Step | Status | Notes |
|------|--------|-------|
| Sign up | ✅ Works | Landing `AuthForm` → console `/api/auth/*` proxy → `better-auth-upstream` (email+password, optional Google/GitHub). |
| Login | ✅ Works | Same path; session cookie set on console origin. |
| Logout | ✅ **Fixed** | The rail "Sign out" button was a dead `<button>` (no handler). Wired it to POST `/api/auth/sign-out` then navigate to `/home` (server redirects to landing sign-in once the session clears). |
| Email verification | ⚠️ P1 | `auth-server.ts` has `emailAndPassword.enabled` only — no `emailVerification`. Signup succeeds without verifying email. Acceptable for beta; decide before GA. |
| Password reset | ⚠️ P1 | Landing calls `authClient.requestPasswordReset`, but the server never configures `emailAndPassword.sendResetPassword` → **no reset email is sent**. A fresh customer doesn't hit this; an existing one who forgets their password is stuck. Not fixed here (needs Resend wiring + `RESEND_API_KEY` + a verified sender domain, in a Next.js app I can't build/verify in this environment — shipping it blind to a critical auth path is the unsafe option). |
| Tenant creation | ✅ Works | Auto-provisioned on first authenticated request in `session_auth.go` (`tenant_id = BetterAuth user.id`), `ON CONFLICT` backfills name/email. |
| API key creation | ✅ Works | Settings `POST /settings/api-keys` → `data_source` (read-once agent/app key in `tenant_api_keys`). |

## 3. Billing Status

- **Checkout:** env-driven — `POLAR_CHECKOUT_{SEED,HORIZON,INFINITE}` (full URL) or
  `POLAR_PRICE_{...}` (price ID → constructed checkout URL), with a generic
  `polar.sh/igris-inertial` fallback. Works when env is set.
- **Webhook / subscription tiering:** `ResolveTierID` is metadata-tier-first, then
  falls back to price-ID → `GetTierByPriceID`. That lookup matched **hardcoded
  placeholder** IDs (`price_seed_monthly`, …), so a real Polar price ID would not
  resolve → customer left untiered. **Fixed:** added an `init()` in
  `polar_client.go` binding each plan's `MonthlyPriceID` to the same
  `POLAR_PRICE_*` env the checkout uses (placeholder retained when unset). Now one
  env value drives both checkout and webhook resolution consistently.
- **Plan config:** Seed $29 / Horizon $149 / Infinite $699, runtime limits 3/50/500
  — consistent across `routes_subscription.go` and `polar_client.go`.
- **Can a customer purchase?** **Yes, once the operator sets `POLAR_CHECKOUT_*`
  and/or `POLAR_PRICE_*`** to the real dashboard values. Code no longer requires a
  source edit to map real price IDs. (Webhook signature handling and the
  status/portal surface exist in `webhook_handler.go` / `routes_subscription.go`;
  the Polar-hosted billing portal is reached via Polar, not self-hosted.)

## 4. CLI Status

- **Install command consistency:** **Fixed.** The console Home told customers
  `curl -fsSL https://igris.sh/install | sh` — a **different domain** (`igris.sh`,
  may not resolve) and `| sh` (the installer uses bash-isms). Every other surface
  (docs ×4, landing ×3) uses `https://igrisinertial.com/install | bash`. Aligned
  the console to the canonical command + updated the pinning test assertion.
- **Installer:** `igris-runtime/install.sh` detects platform, downloads, and
  verifies a SHA-256 checksum — solid. ⚠️ P1: its `BASE_URL` points at **GitHub
  Releases**, while the production model (per ops history) serves binaries through
  **authenticated `igrisinertial.com/install`** with `IGRIS_API_KEY`. The script
  served at the domain may diverge from this repo file — verify the deployed
  `/install` matches the authenticated model.
- **Quickstart docs:** `quickstart.mdx`, `install.mdx`, `first-tenant-action.mdx`
  present and use the canonical command/domain. ✅
- **Binary serving:** `GET /v1/runtime/install` (public) + authenticated
  download/register endpoints exist. ✅

## 5. First Customer Journey

1. **Install CLI** — ✅ after fix (canonical command in console + docs).
2. **Authenticate** — ✅ sign up / log in via landing → console proxy.
3. **Register an agent** — ✅ Agents surface; tenant auto-provisioned.
4. **Run first action** — ✅ Actions → run; quickstart documents the first call.
5. **View run** — ✅ Runs list + Run detail.
6. **Verify proof** — ✅ Run detail proof/receipts surface.
7. **Become paying** — ✅ **conditional**: operator must set the Polar env vars;
   then checkout + correct tiering work end to end.

**Without engineering assistance?** Yes for steps 1–6. Step 7 needs a one-time
operator config (Polar env), not engineering. The only true customer-facing
follow-up gap is password reset (P1), which a brand-new customer does not hit.

## 6. Console Status

- Routes coherent; no route-level dead ends (Home, Overview, Runs, Agents, Actions,
  Runs▸Evaluations, Runs▸Proposals, Runs▸Trust-recommendations, Run detail).
- **Dead control fixed:** rail "Sign out" now works.
- **Onboarding copy fixed:** Home install command canonicalized.
- No redesign performed.

## 7. Launch Blockers (P0)

- **None in code** after this pass.
- **P0 (operator config, not code):** set real Polar values —
  `POLAR_CHECKOUT_{SEED,HORIZON,INFINITE}` and/or `POLAR_PRICE_{SEED,HORIZON,INFINITE}`
  — from the Polar dashboard. Until then, tier resolution falls back to placeholders
  and a real purchase won't tier the customer. (Code is ready; only env is missing.)

## 8. Launch Risks (P1)

1. **Password reset unwired server-side** — wire `sendResetPassword` (Resend) in
   `better-auth-upstream/auth-server.ts` + `RESEND_API_KEY` + verified domain.
2. **Email verification not configured** — fine for beta; decide before GA.
3. **`/install` endpoint vs repo `install.sh`** — confirm the deployed authenticated
   script matches; repo file still references GitHub Releases.
4. **Auth env-origin consistency** — landing/upstream/console URLs must resolve to
   the same production console origin; OAuth callbacks registered.
5. **Prod `IGRIS_NEON_SCHEMA_ATTESTATION_DSN`** is a placeholder (operational).

## 9. Fixes Implemented

1. **Billing real-price-ID resolution** — `igris-overture/billing/polar_client.go`:
   `init()` binds plan `MonthlyPriceID` to `POLAR_PRICE_*` env (placeholder
   fallback). Build ✅, `go test ./billing` ✅.
2. **Console logout** — `app/views/shared/_icon_rail.html.erb`: wired "Sign out" to
   the BetterAuth proxy + redirect.
3. **Install command** — `app/views/home/index.html.erb`: `igris.sh … | sh` →
   `igrisinertial.com/install | bash`; updated `test/support/console_page_assertions.rb`.
4. (From prior task, included here) attestation SQL extended for 064/065/066.

## 10. Files Changed

```
 M igris-overture/billing/polar_client.go                         (real Polar price IDs via env)
 M web/apps/rails-console/app/views/shared/_icon_rail.html.erb     (logout wired)
 M web/apps/rails-console/app/views/home/index.html.erb            (canonical install command)
 M web/apps/rails-console/test/support/console_page_assertions.rb  (assertion updated)
 M igris-overture/database/attestation/verify_launch_schema.sql    (prior task; 064/065/066 checks)
 M .gitignore                                                      (prior task)
?? LAUNCH_READINESS_2026-06-23.md, LAUNCH_VERDICT_2026-06-23.md    (reports)
```
No commit, no push, no deploy. No new migrations.

## 11. Tests Run

- `go build ./igris-overture/billing/... ./igris-overture/api/...` → OK.
- `go test ./igris-overture/billing` → ok.
- rails-console full suite (clean bootsnap cache) → **427 runs, 0 failures**.
- Targeted: welcome/home split, project identity, product representation → 50/0.

## 12. Final Recommendation

Ship to **Operator Beta / early customers now.** Before broad GA: set the Polar
env vars (P0 config), wire password reset + email verification (P1), and confirm the
deployed `/install` script. With the Polar env in place, a brand-new customer can
onboard, run an action, verify proof, and purchase without engineering assistance.
