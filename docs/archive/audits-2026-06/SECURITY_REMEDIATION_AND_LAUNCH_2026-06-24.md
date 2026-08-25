# Igris — Production Security Remediation & Launch Execution Plan (2026-06-24)

**Hats:** Security Lead · Infrastructure Lead · Production Engineer
**Type:** Review + execution-planning. No auto-rotation, no auto-deploy, no history
rewrite, no migrations, no features.

---

## Executive Summary

Two P0s gate launch. This pass **assessed** the secret exposure precisely,
**performed the safe forward-only git remediation** (untrack + gitignore, verified),
and **confirmed the auth deploy is build-ready** — then stopped at the boundary the
task draws: credential rotation and the actual deploy are documented as exact operator
sequences, not executed.

- **Secret exposure is narrower than feared but real.** Only **one** file ever carried
  live credentials to GitHub: `.env.azure.local` (4 commits, all on `origin/main`).
  The two other "secret-looking" tracked files are **placeholders** (`.env.example`
  → `localhost` sample; the Neon doc → `USER:****@ep-xxxx.REGION` template). Net: **3
  credentials require rotation** (Neon DB password, `OVERTURE_API_KEY`,
  `ADMIN_PASSWORD`); the Azure values in the file are **identifiers, not secrets** (no
  client secret was present — deploys use OIDC). Billing/Resend/`BETTER_AUTH_SECRET`/
  `JWT_SECRET`/`VAULT_MASTER_KEY` were **never committed** (they live only in the
  gitignored `.env.production`).
- **Git is remediated forward.** `.env.azure.local` is untracked, `.gitignore` now has
  a `.env.*` catch-all (preserving `.env.example`), and force-less re-adds are blocked.
  History still contains the secrets — **rotation, not a history rewrite, is the real
  fix** (rotating invalidates every historical copy at once).
- **Auth is deploy-ready but undeployed.** The build-verified Dockerfile, the
  `igris-auth` image matrix, and `deploy-auth-azure.yml` exist but are **uncommitted**,
  so no image is built and signup/login still 502/503.

**Verdict: NOT READY today.** Both blockers are operator execution with no remaining
engineering. Sequence + checklist below.

---

## Secret Exposure Assessment (Phase 1)

**Exposed file:** `.env.azure.local`
**Commits (oldest→newest), all present on `origin/main`:**
`c792a9849` (Create) → `4ef166a88` → `8ee6a6ec3` → `1fd35ea04` (Update)

- **Reached origin?** ✅ Yes — `remotes/origin/main` contains `1fd35ea04`; local and
  origin are in sync (0/0 ahead/behind).
- **Still reachable in history?** ✅ Yes — all 4 commits remain in `main` history (no
  rewrite performed). **4 distinct content hashes** ⇒ multiple credential *generations*
  may be present across the commits. Rotation neutralizes all of them simultaneously.

**Exposed credential inventory (names + locations only):**

| Key in file | What it is | Real secret? | Risk |
|-------------|-----------|--------------|------|
| `NEON_POOLED_URL`, `NEON_DIRECT_URL` | Neon Postgres DSNs incl. role password | ✅ **YES** | **Critical** — full DB read/write |
| `OVERTURE_API_KEY` | `igris_…` service-principal key (console→Overture) | ✅ **YES** | **High** — tenant API access as the console |
| `ADMIN_PASSWORD` (+ `ADMIN_USERNAME`) | Console HTTP Basic fallback | ✅ **YES** | **High** — admin console gate |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Azure SP / sub identifiers | ⚠️ Identifiers, **not** secrets (no client secret in file) | Low — unusable without a secret/federated trust |
| `AZ_RG/AZ_ENV/AZ_LOCATION`, `AZURE_*_APP`, `API_IMAGE`, `CONSOLE_IMAGE`, console URLs | Resource names / image tags / URLs | No | Informational |

**Not exposed (verified — never committed):** `BETTER_AUTH_SECRET`, `JWT_SECRET`,
`VAULT_MASTER_KEY`, `POLAR_API_KEY`/`POLAR_WEBHOOK_SECRET`/`POLAR_PRICE_*`,
`RESEND_API_KEY`. `.env`, `.env.production`, `.env.local`, `.neon_prod_env`,
`.neon_branch_env`, `.neon_launch_branch_env`, `.neon_preprod_env` → **0 commits** in
all history. `.env.example` & the NEON readiness doc → placeholders only.

---

## Required Rotations (Phase 2) — operator, do NOT auto-run

> Assume compromise for every row marked YES above. Order: DB first (broadest), then
> API key, then admin. Azure IDs need verification, not rotation.

### 1. Neon database password — **Critical**
- **Location:** Neon dashboard → project → Roles (`neondb_owner`). Consumed by
  `DATABASE_URL` on **igris-api** + **igris-auth** (when deployed) and any local
  `.neon_*` DSNs / attestation DSN.
- **Risk:** Full production data access.
- **Rotate:** Neon → reset role password → new pooled + direct DSNs. Update
  `DATABASE_URL` (and `DATABASE_URL_DIRECT`) on the igris-api Container App and the
  igris-auth app; update local `.neon_prod_env` (gitignored).
- **Verify:** `GET https://api.igrisinertial.com/readyz` → 200 (DB-aware); a `psql`
  connect with the new DSN succeeds; old DSN refused.

### 2. `OVERTURE_API_KEY` (console service principal) — **High**
- **Location:** console Container App env `OVERTURE_API_KEY`.
- **Risk:** Acts as the console's tenant against Overture.
- **Rotate:** re-mint via the Go CLI `./bin/igris-overture tenant-key --email <op> --name "Console Operator"`
  (without `--create-if-missing` it **revokes the prior key** and mints a new one).
  Set the new `igris_…` on the console; redeploy.
- **Verify:** console `GET /actions` (or `/v1/actions`) returns 200 with the new key;
  the old key returns 401.

### 3. `ADMIN_PASSWORD` (console Basic fallback) — **High**
- **Location:** console Container App env `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- **Risk:** Admin console access (fallback gate).
- **Rotate:** `openssl rand -base64 32`; set on the console; redeploy. (Optionally
  change `ADMIN_USERNAME` too.)
- **Verify:** Basic-auth challenge accepts the new pair; old pair rejected (401).

### 4. Azure service principal — **Verify (likely no rotation)**
- **Location:** GitHub Environment vars (`AZURE_CLIENT_ID/TENANT_ID/SUBSCRIPTION_ID`).
- **Risk:** Low — only **identifiers** leaked; the deploy workflows use OIDC
  (`azure/login` with `id-token: write`), so there is no client secret to leak.
- **Action:** Confirm the app registration has **no usable client secret** and relies
  on the federated credential scoped to this repo/environment. If a client secret
  exists anywhere, rotate it in Entra ID.
- **Verify:** a `workflow_dispatch` deploy still authenticates via OIDC; no secret in
  the SP credentials list.

### 5. Auth / Billing / Resend — **Not exposed by this incident**
- `BETTER_AUTH_SECRET`, `JWT_SECRET`, `VAULT_MASTER_KEY`, `POLAR_*`, `RESEND_API_KEY`
  were never committed. **No rotation required from this exposure.** (Optional
  defense-in-depth: rotate `BETTER_AUTH_SECRET` once — but it must then be set
  **identically** on igris-auth + igris-api + console, or sessions break.)

---

## Git Remediation Status (Phase 3) — **performed + verified**

Done this pass (working tree, **not committed** — see note):
- `git rm --cached .env.azure.local` → staged removal; **local file preserved** so the
  operator can read the values to rotate them.
- `.gitignore` → added a `.env.*` catch-all with `!.env.example`. Root cause: the old
  rules (`*.env`, `*.env.local`) never matched `.env.azure.local`.

Verified:
- `git check-ignore` → now ignored via `.gitignore:107 .env.*`. ✅
- `.env.example` → still tracked (negation works). ✅
- `git add .env.azure.local` → **blocked** ("Use -f if you really want"). ✅
- Local `.env.azure.local` still present (for rotation). ✅
- Staged: `D .env.azure.local`, `M .gitignore`.

**Operator must finalize** (single commit; the untrack is meaningless for the *origin*
copy until rotation is also done, so do them together):
```bash
git commit -m "security: untrack .env.azure.local; ignore all local env files"
git push origin main
```

**History reachability — options (require explicit instruction; not done here):**
- The secrets remain in history at `origin/main`. **Rotation makes them inert** — the
  primary and sufficient fix.
- *Optional hardening:* purge the file from all history with `git filter-repo
  --path .env.azure.local --invert-paths` (or BFG `--delete-files .env.azure.local`),
  then **force-push** and have every clone/fork re-clone. This **rewrites shared
  history** (force-push) — do only with explicit sign-off, and rotate regardless.
- Also: GitHub may retain the blobs in cached views/PRs; rotation is the only thing
  that truly defuses them.

---

## Auth Deployment Status (Phase 4) — **ready, uncommitted, not deployed**

| Artifact | State |
|----------|-------|
| `web/apps/better-auth-upstream/Dockerfile` | present, **uncommitted** (new) — build-verified last session (standalone boots, `GET /`→200) |
| `web/apps/better-auth-upstream/next.config.js` | `outputFileTracingRoot` fix — **uncommitted modification** |
| `.github/workflows/build-container-images.yml` | `igris-auth` matrix entry — **uncommitted modification** |
| `.github/workflows/deploy-auth-azure.yml` | present, **uncommitted** (new) — env guards + Container App secrets/`secretref:` + smoke |
| Console `BETTER_AUTH_UPSTREAM_URL` | read by `AuthProxyController` ✅; **not yet set** to a live auth FQDN |

**Required env (igris-auth):** `DATABASE_URL` (rotated Neon), `BETTER_AUTH_SECRET`
(= Overture's), `BETTER_AUTH_BASE_URL=https://console.igrisinertial.com`,
`NEXT_PUBLIC_LANDING_URL=https://igrisinertial.com`, `RESEND_API_KEY`,
`RESEND_FROM_EMAIL` (opt), `IGRIS_REQUIRE_EMAIL_VERIFICATION` (opt, default off),
`GOOGLE_/GITHUB_*` (opt). Container ingress on **port 3001**.
**Callback URLs (only if OAuth on):** `…/api/auth/callback/google`,
`…/api/auth/callback/github` registered at each provider, pointing through the console
origin.

### Exact deployment sequence (operator)
1. `git commit` the 4 auth files (+ the Phase-3 hygiene) and `git push`.
2. Run **`build-container-images.yml`** (workflow_dispatch) → capture
   `ghcr.io/igris-inertial/system/igris-auth@sha256:<digest>`.
3. Ensure an **`igris-auth` Azure Container App** exists (external ingress :3001); set
   GitHub Environment secrets/vars used by `deploy-auth-azure.yml`
   (`BETTER_AUTH_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `BETTER_AUTH_BASE_URL`,
   `NEXT_PUBLIC_LANDING_URL`, `RESEND_FROM_EMAIL`, optional OAuth pairs).
4. Run **`deploy-auth-azure.yml`** with the digest — it wires env (secretrefs) and
   smoke-tests `GET /` (200) + `/api/auth/get-session` (non-5xx ⇒ configured).
5. Set console **`BETTER_AUTH_UPSTREAM_URL=https://<igris-auth-fqdn>/api/auth`**;
   redeploy the console.
6. Confirm `BETTER_AUTH_SECRET` is **identical** across igris-auth, igris-api, console.

---

## Launch Checklist (Phase 5)

| # | Gate | Owner | Verify |
|---|------|-------|--------|
| 1 | Secret rotation complete (Neon, `OVERTURE_API_KEY`, `ADMIN_PASSWORD`) | Operator | new creds live; old refused (`/readyz` 200, old key 401) |
| 2 | Git hygiene committed + pushed | Operator | `.env.azure.local` absent from `origin/main` HEAD; `.env.*` ignored |
| 3 | Auth deployed (`igris-auth` up) | Operator | `deploy-auth-azure` smoke green (`/`, `/api/auth/get-session`) |
| 4 | Console wired | Operator | `BETTER_AUTH_UPSTREAM_URL` set; `/api/auth/*` no longer 502/503 |
| 5 | Resend verified | Operator | `igrisinertial.com` SPF/DKIM green; `RESEND_API_KEY` on igris-auth; test email delivered |
| 6 | Polar verified | Operator | real `POLAR_*` on igris-api; test checkout → webhook tiers the tenant |
| 7 | **Signup** works | Acceptance | real account created, no 5xx |
| 8 | **Login** works | Acceptance | session cookie on console origin |
| 9 | **Password reset** works | Acceptance | reset email → set new password → login |
| 10 | **Email verification** works | Acceptance | verify link flips `emailVerified` |
| 11 | **CLI onboarding** works | Acceptance | install + `IGRIS_API_KEY` auth + agent register |
| 12 | **First action + proof** works | Acceptance | run executes; receipt/proof verifies; run visible |

---

## Remaining Blockers

**P0**
1. **Rotate the 3 exposed credentials** + commit/push the Phase-3 untrack (rotation is
   mandatory; history copies stay inert only once rotated).
2. **Deploy `igris-auth`** + wire `BETTER_AUTH_UPSTREAM_URL` (signup/login is 502/503
   until then).

**P1**
3. Verify Resend domain (SPF/DKIM) + `RESEND_API_KEY` on igris-auth.
4. Confirm real `POLAR_*` on igris-api (Azure env, not the legacy `.env.production`).
5. Confirm Azure SP is OIDC-only (no rotatable client secret); if one exists, rotate.

**P2**
6. Optional history scrub of `.env.azure.local` (force-push; explicit sign-off).
7. Decide email-verification login-gating before broad GA (default off now).

---

## Final Verdict: **NOT READY** (today)

Two P0s remain, both **operator execution with zero remaining engineering**: rotate the
three live credentials (+ finalize the already-staged git untrack) and run the two
prepared workflows to bring `igris-auth` online and wire the console. The secret
exposure is bounded and the git gap is closed going forward; the auth deploy is
build-verified and scripted.

**Launchable when:** checklist items 1–4 are green (rotation + git pushed + auth
deployed + console wired) and the acceptance items 7–12 pass end-to-end. At that point
a new customer can complete onboarding without engineering intervention, and the verdict
moves to **READY WITH MINOR ITEMS** (Resend domain + Polar Azure-env being the trailing
P1 config).

---

### Changes made this pass (working tree only — not committed, not pushed)
```
M  .gitignore                 (.env.* catch-all; preserves .env.example)
D  .env.azure.local           (git rm --cached; local file preserved for rotation)
?? SECURITY_REMEDIATION_AND_LAUNCH_2026-06-24.md  (this report)
```
No credentials rotated, no services deployed, no history rewritten, no migrations.
The auth-deploy artifacts from the prior pass remain staged/untracked, awaiting the
operator commit in the sequence above.
