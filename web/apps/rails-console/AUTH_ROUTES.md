# Landing ↔ Console Auth Route Contract

Stable URLs used by `web/apps/web-landing` after sign-up, sign-in, OAuth, and
password-reset email flows.

## Redirect map

| Landing / OAuth URL | Rails handler | Canonical destination |
| ------------------- | ------------- | --------------------- |
| `GET /onboarding`   | `AuthRedirectsController#onboarding` | `/welcome` (get-started lens) |
| `GET /dashboard`    | `AuthRedirectsController#dashboard`  | `/home` (Overview workspace) |
| `GET /reset-password` | `PasswordResetsController#show`    | Handoff page, or redirect to landing `/auth` when query params are present |

Landing constants live in `web/apps/web-landing/src/lib/console-auth-paths.ts`.

## Auth host decision

| Setting | Value | Why |
| ------- | ----- | --- |
| `BETTER_AUTH_UPSTREAM_URL` | `better-auth-upstream` `/api/auth` base | Node service (`web/apps/better-auth-upstream`) — **not** Cloudflare Pages static landing |
| `BETTER_AUTH_BASE_URL` | Console origin | Browser calls `console/api/auth/*`; cookies must scope to console domain |
| Landing `authClient` `baseURL` | Console origin (`getConsoleUrl()`) | Sign-in API hits console host; Rails proxies to upstream |

`web-landing` uses `output: 'export'` for Cloudflare Pages and cannot host
`/api/auth/*`. Deploy `better-auth-upstream` as a Node/standalone service
(Azure Container Apps, Render, etc.) and point `BETTER_AUTH_UPSTREAM_URL` at it.

**Production example**

- `BETTER_AUTH_UPSTREAM_URL=https://auth.igrisinertial.com/api/auth` (or internal ACA URL)
- `BETTER_AUTH_BASE_URL=https://console.igrisinertial.com`
- `LANDING_URL=https://igrisinertial.com`

**Local example**

- `BETTER_AUTH_UPSTREAM_URL=http://localhost:3001/api/auth`
- `BETTER_AUTH_BASE_URL=http://localhost:3100`
- `LANDING_URL=http://localhost:3000`

## Auth layers

### 1. Customer session (BetterAuth) — primary

Landing `AuthForm` calls `createAuthClient({ baseURL: getConsoleUrl() })`. The
BetterAuth API (`/api/auth/*`) is served on the **console host** via
`AuthProxyController`, which forwards to `BETTER_AUTH_UPSTREAM_URL`.

The upstream handler (`web/apps/better-auth-upstream`) uses shared Neon
Postgres session tables and sets `baseURL` to the console origin.

Protected console routes accept a valid BetterAuth session **without** HTTP
Basic Auth. Rails validates by probing Overture `GET /v1/project` with the
session cookie only. `OvertureClient` forwards the cookie (not
`OVERTURE_API_KEY`) in customer mode.

### 2. Console preview gate (HTTP Basic) — admin fallback

When `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set, operators can reach the
console with HTTP Basic credentials using the `OVERTURE_API_KEY` service
principal.

### 3. Fail-closed production behavior

If neither customer session auth (`OVERTURE_API_BASE_URL` for probe) nor admin
Basic Auth is configured, protected routes deny access. Browser requests
redirect to `LANDING_URL/auth`.

### 4. Public / bypass paths

`/up`, `/onboarding`, `/dashboard`, `/reset-password`, `/api/auth/*` skip the
console gate.

## Environment matrix (names only)

### Rails console

| Variable | Required (prod customer path) | Host / notes |
| -------- | ----------------------------- | ------------ |
| `OVERTURE_API_BASE_URL` | yes | Overture API origin, e.g. `https://api.igrisinertial.com` |
| `BETTER_AUTH_UPSTREAM_URL` | yes | Landing BetterAuth base, e.g. `https://igrisinertial.com/api/auth` |
| `LANDING_URL` | recommended | Account portal for redirects, e.g. `https://igrisinertial.com` |
| `APP_HOST` | yes | Console hostname, e.g. `console.igrisinertial.com` |
| `SECRET_KEY_BASE` | yes | Rails signing key |
| `OVERTURE_API_KEY` | admin path | Service principal; not used in customer session mode |
| `ADMIN_USERNAME` | optional | Admin Basic fallback |
| `ADMIN_PASSWORD` | optional | Admin Basic fallback |
| `OVERTURE_PUBLIC_API_URL` | optional | Snippet URL override |

### `better-auth-upstream` (Node service)

| Variable | Required | Host / notes |
| -------- | -------- | ------------ |
| `DATABASE_URL` | yes | Neon pooled URL (same DB as Overture `user`/`session` tables) |
| `BETTER_AUTH_SECRET` | yes | Must match Overture |
| `BETTER_AUTH_BASE_URL` | yes | Console origin (cookie scope) |
| `NEXT_PUBLIC_CONSOLE_URL` | recommended | Fallback for `BETTER_AUTH_BASE_URL` |
| `NEXT_PUBLIC_LANDING_URL` | recommended | `trustedOrigins`, e.g. `https://igrisinertial.com` |
| `GOOGLE_CLIENT_ID` | optional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | optional | Google OAuth |
| `GITHUB_CLIENT_ID` | optional | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | optional | GitHub OAuth |

### Overture

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `DATABASE_URL` | yes | Session table lookup |
| `BETTER_AUTH_SECRET` | yes | Cookie HMAC (same value as landing) |
| `ALLOWED_ORIGINS` | yes | Include console origin(s) |

## Local dev ports

| App | Port |
| --- | ---- |
| web-landing | `3000` |
| better-auth-upstream | `3001` |
| rails-console | `3100` |

## Smoke

See `AUTH_SMOKE.md` and `scripts/smoke/auth-bridge-smoke.sh`.

## Remaining gaps

- Landing `/auth` token handler for completed password-reset links (post-email)
- Cookie `Domain` alignment across `console.*` and `app.*` aliases in production