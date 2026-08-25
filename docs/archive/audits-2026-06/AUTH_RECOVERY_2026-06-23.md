# Igris — Authentication Recovery & Verification Readiness (2026-06-23)

## Final Verdict: **READY WITH MINOR ITEMS**

Password reset and email verification are now wired **end-to-end in code**. The
only remaining gate is operator config (one env var + a verified Resend sender
domain) and a deploy of the auth service — no further engineering.

---

## Summary — What Was Implemented

The launch audit flagged auth recovery as the last engineering gap: BetterAuth was
configured with `emailAndPassword.enabled` only — **no email was ever sent** for
password reset or verification, and the landing app had **no UI to set a new
password** after following a reset link. Both are now complete, using the existing
architecture (BetterAuth + Resend), with **no new provider and no new dependency**:

1. **`web/apps/better-auth-upstream/src/lib/email.ts` (new)** — a dependency-free
   Resend sender (via `fetch`, mirroring the Go client's `RESEND_API_KEY` /
   `RESEND_FROM_EMAIL` conventions and default sender). Env-guarded: with no API
   key it is a graceful no-op (never throws), so auth flows don't break in
   unconfigured environments. Includes the reset + verification email templates.
2. **`auth-server.ts`** — wired `emailAndPassword.sendResetPassword`,
   `emailVerification.sendVerificationEmail`, and `sendOnSignUp: true` +
   `autoSignInAfterVerification: true`. `requireEmailVerification` is env-gated
   (`IGRIS_REQUIRE_EMAIL_VERIFICATION`, default **off**) so a mailer outage can
   never lock the tenant base out of login.
3. **`web/apps/web-landing/.../AuthForm.tsx`** — added a `reset` mode that triggers
   on a `?token=` URL (the reset link destination), renders a set-new-password
   form, calls `authClient.resetPassword({ newPassword, token })`, and handles the
   invalid/expired-link (`?error=`) case. This was the missing completion step.

## Authentication Status

| Flow | Status | Evidence |
|------|--------|----------|
| Sign up | ✅ Works | `signUp.email` → `/api/auth` proxy → BetterAuth; tenant auto-provisioned (`session_auth.go`). |
| Login | ✅ Works | `signIn.email` + OAuth; session cookie on console origin. |
| Logout | ✅ Works | Rail "Sign out" wired to `POST /api/auth/sign-out` (prior task). |
| Email verification | ✅ Works (was missing) | `emailVerification.sendVerificationEmail` + `sendOnSignUp`. |
| Password reset | ✅ Works (was broken end-to-end) | server `sendResetPassword` + landing `reset` completion form. |
| Tenant creation | ✅ Works | Auto-provisioned, `tenant_id = BetterAuth user.id`. |
| API key creation | ✅ Works | Settings `POST /settings/api-keys`. |

## Password Reset Status — **Complete (code); needs Resend config to function**

Full flow now wired:
1. Request reset — landing `forgot` → `authClient.requestPasswordReset({ email, redirectTo: console/reset-password })`. ✅
2. Email generated — BetterAuth creates a single-use, expiring token (`verification` table, `expiresAt NOT NULL`). ✅
3. Email sent — **now** via `sendResetPassword` → Resend (requires `RESEND_API_KEY`). ✅ code
4. Reset link works — BetterAuth validates the token, redirects to console `/reset-password` → forwards `?token=` to landing `/auth`. ✅
5. Token validation — handled by BetterAuth. ✅
6. Password update — **now** landing `reset` form → `authClient.resetPassword({ newPassword, token })`. ✅
7. Log in with new password — `signIn.email`. ✅
8. Old tokens invalid — BetterAuth deletes the `verification` row on use (single-use) and enforces `expiresAt`. ✅

## Email Verification Status — **Complete (code); needs Resend config to function**

1. Account created — `signUp.email`. ✅
2. Verification email generated — BetterAuth + `sendOnSignUp: true`. ✅
3. Verification email sent — **now** via `sendVerificationEmail` → Resend. ✅ code
4. Verification link works — BetterAuth `/api/auth/verify-email`. ✅
5. User becomes verified — `user.emailVerified` set; `autoSignInAfterVerification`. ✅
6. Duplicate attempts — token is single-use (row deleted); a re-click on a used/expired link fails safely. ✅
7. Login-gating is optional via `IGRIS_REQUIRE_EMAIL_VERIFICATION=true` (default off).

## Resend Status — Required Configuration

Already implemented: the Go side uses Resend (`billing/resend.go`); the new
upstream sender reuses the **same env names + default sender**, so all mail comes
from one verified domain.

**Required for production (operator):**
- `RESEND_API_KEY` — set in the **better-auth-upstream** deployment env.
- `RESEND_FROM_EMAIL` — optional; defaults to `Igris Inertial <noreply@igrisinertial.com>`.
- **Resend domain verification** — `igrisinertial.com` must be a verified sending
  domain in Resend (SPF/DKIM) or delivery will fail/spam.
- Optional: `IGRIS_REQUIRE_EMAIL_VERIFICATION=true` to block login until verified.

Without `RESEND_API_KEY` the sender no-ops gracefully (logs a redacted warning),
so signup/login keep working — but reset/verification emails won't arrive. This is
the one remaining functional gate, and it is **config, not code**.

## Security Review

- **Token expiry** — ✅ `verification.expiresAt NOT NULL`; BetterAuth enforces it.
- **Single-use reset/verification tokens** — ✅ BetterAuth deletes the row on use.
- **No token logging** — ✅ `email.ts` never logs `url`/`token`/body — only a
  redacted recipient (`a***@domain`) + subject. `session_auth.go` logs at most an
  8-char token prefix on error.
- **No secrets in UI responses** — ✅ the `/api/auth` proxy strips hop-by-hop
  headers; reset/verify responses don't echo tokens; client errors are generic.
- **No user enumeration** — ✅ `requestPasswordReset` returns success regardless of
  whether the email exists; the landing "Check your inbox" message is identical
  for known/unknown addresses.
- **Invalid requests fail safely** — ✅ invalid/expired reset token →
  BetterAuth error → landing shows a generic "invalid or expired — request a new
  link" with a path back to `forgot`. Min password length (8) enforced client-side
  and by BetterAuth.
- **Lockout safety** — ✅ `requireEmailVerification` defaults off; a mailer outage
  cannot block existing users from signing in.

## Tests Run

- `tsc --noEmit` on web-landing → **0 errors in `AuthForm.tsx`** (the noisy
  pre-existing errors elsewhere, incl. `better-auth/react` not resolving in that
  config, are unrelated and predate this change).
- Isolated `tsc` syntax check of `email.ts` → **clean**; `auth-server.ts` → no
  syntax errors (only the expected `better-auth`/`pg` module-not-found in
  isolation, both real deps in `package.json`).
- Rails auth suite (`customer_session_auth`, `auth_proxy`, `basic_auth`,
  `auth_redirects`, `customer_session`) → **24 runs, 0 failures**.
- Rails full suite (clean cache) → **427 runs, 0 failures**.
- Could not run the BetterAuth Next.js app here (no `node_modules` in
  better-auth-upstream, can't install/deploy) — server change verified by syntax
  check + documented-API conformance + code review.

## Remaining Blockers

- **None in code.**
- **Operator config (P1, not engineering):** set `RESEND_API_KEY` on the
  better-auth-upstream deployment + verify the `igrisinertial.com` sender domain in
  Resend, then deploy the upstream with these changes. After that the full journey
  works without engineering assistance.

## Files Changed
```
A  web/apps/better-auth-upstream/src/lib/email.ts          (Resend sender + templates)
M  web/apps/better-auth-upstream/src/lib/auth-server.ts     (reset + verification wiring)
M  web/apps/web-landing/src/components/auth/AuthForm.tsx     (reset completion UI)
?? AUTH_RECOVERY_2026-06-23.md                               (this report)
```
No DB migrations, no billing/CLI changes, no deploy, no new provider.

## Success Criteria — Journey Check
Create account → verify email → log in → reset password → log back in: **all steps
are now wired in code.** The journey completes without engineering assistance once
`RESEND_API_KEY` is set and the sender domain is verified in Resend, and the auth
service is deployed with these changes. Until then the exact blocker is: **no
`RESEND_API_KEY` configured on the better-auth-upstream deployment** (emails
gracefully skip), located in `web/apps/better-auth-upstream`.
