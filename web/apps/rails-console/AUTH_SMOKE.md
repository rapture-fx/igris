# Auth Bridge — Local and Staging Smoke

Run after wiring auth env vars and before promoting a console deploy. No
production infrastructure changes are required to execute the local path.

## Host relationships (decision)

| Role | Host (prod example) | Path |
| ---- | ------------------- | ---- |
| Landing account portal | `https://igrisinertial.com` | `/auth` |
| BetterAuth upstream handler | `better-auth-upstream` service | `/api/auth/*` |
| Console (browser-facing auth API) | `https://console.igrisinertial.com` | `/api/auth/*` (Rails proxy) |
| Console product | `https://console.igrisinertial.com` | `/home`, `/welcome`, … |
| Overture API | `https://api.igrisinertial.com` | `/v1/project`, … |

**`BETTER_AUTH_UPSTREAM_URL`** must point at the BetterAuth handler base path on
the **`better-auth-upstream`** Node service (`web/apps/better-auth-upstream`).
Do **not** point at Cloudflare Pages static `web-landing` — it cannot run API
routes.

- Local: `http://localhost:3001/api/auth`
- Staging/prod: dedicated auth service URL, e.g. `https://auth.igrisinertial.com/api/auth`

**`BETTER_AUTH_BASE_URL`** must be the **console origin** (what the browser
uses for sign-in API calls and cookie scope):

- Local: `http://localhost:3100`
- Staging/prod: `https://console.igrisinertial.com`

Rails proxies `console/api/auth/*` → upstream. BetterAuth emits
`Set-Cookie` for the console domain because `baseURL` is the console origin.

## Env var checklist (names only)

### Rails console (`igris-console-rails`)

| Variable | Required (customer auth) | Purpose |
| -------- | ------------------------ | ------- |
| `OVERTURE_API_BASE_URL` | yes | Session probe (`GET /v1/project`) and product data |
| `BETTER_AUTH_UPSTREAM_URL` | yes | Proxy target for `/api/auth/*` |
| `LANDING_URL` | recommended | Redirect when unauthenticated (default `https://igrisinertial.com`) |
| `OVERTURE_API_KEY` | admin path only | Service principal when using HTTP Basic fallback |
| `ADMIN_USERNAME` | optional | HTTP Basic admin fallback |
| `ADMIN_PASSWORD` | optional | HTTP Basic admin fallback |
| `APP_HOST` | yes | Console hostname for URL generation |
| `SECRET_KEY_BASE` | yes | Rails cookie signing |

### `better-auth-upstream` service

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `DATABASE_URL` | yes | Neon Postgres (`user`, `session`, `account` tables) |
| `BETTER_AUTH_SECRET` | yes | BetterAuth HMAC (must match Overture) |
| `BETTER_AUTH_BASE_URL` | yes | Console origin for cookies/redirects |
| `NEXT_PUBLIC_CONSOLE_URL` | recommended | Fallback for `BETTER_AUTH_BASE_URL` |
| `NEXT_PUBLIC_LANDING_URL` | recommended | `trustedOrigins` for cross-origin sign-in |
| `GOOGLE_CLIENT_ID` | optional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | optional | Google OAuth |
| `GITHUB_CLIENT_ID` | optional | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | optional | GitHub OAuth |

### Overture API (`igris-overture-api`)

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `DATABASE_URL` | yes | Session lookup for BetterAuth cookies |
| `BETTER_AUTH_SECRET` | yes | Cookie HMAC verification (defense-in-depth) |
| `ALLOWED_ORIGINS` | yes | Include console origin(s) |

`BETTER_AUTH_SECRET` must be identical on landing upstream and Overture.

## Local smoke (manual)

Prerequisites: Neon `DATABASE_URL` (or local Postgres with migration
`016_better_auth.sql`), Overture running, auth upstream on `:3001`, landing on
`:3000`, Rails on `:3100`.

```bash
# Terminal 1 — Overture
export DATABASE_URL=… BETTER_AUTH_SECRET=…
./bin/igris-overture

# Terminal 2 — BetterAuth upstream (Node)
cd web/apps/better-auth-upstream
export DATABASE_URL=… BETTER_AUTH_SECRET=…
export BETTER_AUTH_BASE_URL=http://localhost:3100
export NEXT_PUBLIC_LANDING_URL=http://localhost:3000
pnpm dev

# Terminal 3 — landing (static UI only)
cd web/apps/web-landing && pnpm dev

# Terminal 4 — Rails console
cd web/apps/rails-console
export OVERTURE_API_BASE_URL=http://localhost:8080
export BETTER_AUTH_UPSTREAM_URL=http://localhost:3001/api/auth
export LANDING_URL=http://localhost:3000
bin/dev
```

Checklist:

1. Open `http://localhost:3000/auth` → sign in with email/password.
2. Browser network tab: `POST http://localhost:3100/api/auth/sign-in/email` → 200.
3. Response includes `Set-Cookie` with `better-auth.session_token` (console host).
4. Redirect lands on `http://localhost:3100/dashboard` → `/home` without Basic prompt.
5. `curl -i http://localhost:3100/home` without cookie → `302` to `http://localhost:3000/auth`.
6. Optional admin: set `ADMIN_USERNAME`/`ADMIN_PASSWORD` + `OVERTURE_API_KEY`, confirm
   `curl -u user:pass http://localhost:3100/home` → 200 without session cookie.

## Automated smoke (no real secrets required)

```bash
# Structural checks only (upstream may return 503 if not configured)
CONSOLE_BASE=http://localhost:3100 \
LANDING_BASE=http://localhost:3000 \
./scripts/smoke/auth-bridge-smoke.sh

# With admin fallback credentials (values from your env, not committed)
CONSOLE_BASE=https://console.example.com \
ADMIN_USERNAME=… ADMIN_PASSWORD=… \
./scripts/smoke/auth-bridge-smoke.sh

# With a disposable session cookie (from browser DevTools after sign-in)
CONSOLE_BASE=https://console.example.com \
API_BASE=https://api.example.com \
SESSION_COOKIE='better-auth.session_token=…' \
./scripts/smoke/auth-bridge-smoke.sh
```

## Staging / production smoke (after env wiring)

Use `scripts/smoke/auth-bridge-smoke.sh` with staging URLs. Then manually:

1. Sign in at `LANDING_URL/auth`.
2. Confirm `/home` loads without HTTP Basic prompt.
3. Confirm invalid cookie cannot access `/home` (use incognito or delete cookie).
4. Confirm admin Basic still works if `ADMIN_*` are set.
5. Confirm `OVERTURE_API_KEY` does not appear in browser network responses.

See also `SMOKE.md` sections 1–5 for broader deploy smoke.