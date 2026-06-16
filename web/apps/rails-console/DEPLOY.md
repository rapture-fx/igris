# Deploying the Rails Console

> Current live mode is Azure Container Apps + Neon, deployed manually by GHCR
> image SHA. Render references below are historical. For the active workflow,
> use `docs/AZURE_DEPLOY_RUNBOOK.md` and `docs/LIVE_MODE_BRINGUP.md`.

The Rails console is a stateless product face. It owns views and the
Overture API client. **No database is required** — Rails stores nothing
durably; all state lives in Go Overture / Neon Postgres.

This is one of two services in the MVP deploy. The other is Go Overture
at `api.igrisinertial.com`. See `igris-overture/DEPLOY.md` for that side
and the top-level `DEPLOY.md` for the end-to-end playbook.

## Where it lives

| Concern    | Where                                               |
| ---------- | --------------------------------------------------- |
| Compute    | Render web service `igris-console-rails`            |
| Database   | none (stateless)                                    |
| DNS        | Cloudflare `console.igrisinertial.com` (+ `app.…`)   |
| Backend    | Go Overture at `api.igrisinertial.com`               |

## Auth model (three layers)

See `AUTH_ROUTES.md` for the full landing ↔ console contract.

### 1. Customer session (BetterAuth) — primary

Signed-in customers reach `/home` and product lenses with a BetterAuth
session cookie. Rails validates the cookie by probing Overture
(`GET /v1/project` with the session cookie only) and forwards that
cookie on subsequent Overture calls so data stays tenant-scoped.

Landing sign-in calls `/api/auth/*` on the console host. Rails proxies
those requests to `BETTER_AUTH_UPSTREAM_URL` (typically `web-landing`
`/api/auth`). Set `BETTER_AUTH_BASE_URL` to the console origin so
cookies are scoped correctly.

### 2. Console preview gate — HTTP Basic auth (admin fallback)

Optional operator fallback via `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
When both are set, matching Basic credentials also satisfy the console
gate. This path uses the `OVERTURE_API_KEY` service principal.

`/up`, `/onboarding`, `/dashboard`, `/reset-password`, and `/api/auth/*`
skip the gate. Unauthenticated browser requests to protected routes
redirect to `LANDING_URL/auth`. Production fails closed when neither
customer session auth nor admin Basic Auth is configured.

### 3. Overture service principal — `igris_` API key (admin/preview)

The console authenticates to Overture as a **service principal** — a
single `igris_` prefixed API key issued for the console's own tenant.
The key:

- Is set as `OVERTURE_API_KEY` on Render. Never committed.
- Travels in `Authorization: Bearer …` headers from Rails server to
  Overture only. **Never** sent to the browser, logged, or rendered.
- Maps to a single tenant. Every Overture call is tenant-scoped by it.

`OvertureClient` enforces the no-leak rules: the only place that reads
the env var is the constructor; the only place the header is written
is in `headers`; the logger emits only error `class / status / code /
message`, never the request body or auth header.

Two ways to mint or rotate the key (both produce identical output —
the auth middleware can't tell them apart):

- **CLI** (recommended for first deploy):
  `./bin/igris-overture tenant-key --email <you> --create-if-missing`
  See `igris-overture/DEPLOY.md`.
- **HTTP**: `POST /v1/account/api-key` from any authenticated session.
  Once you have a key, the console itself can rotate it.

## Environment variables

### Rails console service

| Name                       | Required (prod) | Purpose                                                              |
| -------------------------- | --------------- | -------------------------------------------------------------------- |
| `RAILS_ENV`                | yes             | `production`                                                          |
| `SECRET_KEY_BASE`          | yes             | Rails session/cookie signing key. `bin/rails secret` or `generateValue` |
| `OVERTURE_API_BASE_URL`    | yes             | `https://api.igrisinertial.com` — session probe + product data        |
| `BETTER_AUTH_UPSTREAM_URL` | yes (customer)  | `better-auth-upstream` base, e.g. `https://auth.igrisinertial.com/api/auth` |
| `LANDING_URL`              | recommended     | Account portal for unauthenticated redirect (default `https://igrisinertial.com`) |
| `APP_HOST`                 | yes             | `console.igrisinertial.com`                                           |
| `OVERTURE_API_KEY`         | admin path      | `igris_…` service principal — used with HTTP Basic fallback only      |
| `ADMIN_USERNAME`           | optional        | HTTP Basic admin fallback username                                    |
| `ADMIN_PASSWORD`           | optional        | HTTP Basic admin fallback password                                    |
| `OVERTURE_PUBLIC_API_URL`  | no              | Override of the public endpoint URL used in snippets                 |
| `PORT`                     | yes             | Render sets to `3100` (see `config/puma.rb`)                         |
| `RAILS_SERVE_STATIC_FILES` | yes             | Set to `1` so Puma serves digested CSS from `public/`                |
| `RAILS_LOG_TO_STDOUT`      | recommended     | Render wants logs on stdout                                          |

Production must have **either** customer session auth (`OVERTURE_API_BASE_URL` +
`BETTER_AUTH_UPSTREAM_URL`) **or** admin Basic Auth (`ADMIN_USERNAME` +
`ADMIN_PASSWORD`), or both. Customer path is primary for end users.

### `better-auth-upstream` (separate Node service)

Deploy `web/apps/better-auth-upstream` with `output: 'standalone'`. Not on
Cloudflare Pages static landing. Set on the auth service, not on Rails:

| Name | Required | Purpose |
| ---- | -------- | ------- |
| `DATABASE_URL` | yes | Neon pooled URL (shared `user`/`session` tables) |
| `BETTER_AUTH_SECRET` | yes | Must match Overture |
| `BETTER_AUTH_BASE_URL` | yes | Console origin, e.g. `https://console.igrisinertial.com` |
| `NEXT_PUBLIC_CONSOLE_URL` | recommended | Fallback for `BETTER_AUTH_BASE_URL` |
| `NEXT_PUBLIC_LANDING_URL` | recommended | `trustedOrigins`, e.g. `https://igrisinertial.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | GitHub OAuth |

### Overture (session validation)

| Name | Required | Purpose |
| ---- | -------- | ------- |
| `DATABASE_URL` | yes | Session table lookup |
| `BETTER_AUTH_SECRET` | yes | Same value as landing upstream |
| `ALLOWED_ORIGINS` | yes | Include `https://console.igrisinertial.com` |

See `AUTH_ROUTES.md` for host relationships and `AUTH_SMOKE.md` for the smoke
checklist.

**Never set `OVERTURE_API_KEY` or `BETTER_AUTH_SECRET` in committed files.**
Set values in the deployment dashboard only.

## Modes

The console runs in one of three modes:

| Mode                  | Trigger                                              | Indicator on page                                          |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| **Real**              | `OVERTURE_API_BASE_URL` set, Overture reachable      | No indicator. Production default.                          |
| **Real (degraded)**   | env set but Overture unreachable / 5xx / network     | Orange `Overture degraded` strip on every page             |
| **Fixture / demo**    | `OVERTURE_API_BASE_URL` unset                        | `Demo data — OVERTURE_API_BASE_URL not set` chip bottom-right |

**Production must never run in fixture mode.** Setting
`OVERTURE_API_BASE_URL` in `render.yaml` guarantees real mode at boot.

## Health check

`GET /up` returns `200 ok`. Wired via `config/routes.rb`. Render's
`healthCheckPath: /up` uses this.

## Static assets

Propshaft digests CSS into `public/assets/`. Build step:

```
bundle install
bin/rails assets:precompile
```

Start step:

```
bundle exec puma -C config/puma.rb
```

## Security posture

- `Authorization` header is **never** logged. The `OvertureClient`
  logs `class / status / code / message` only.
- CSRF on for all `POST` forms (`protect_from_forgery with: :exception`).
- No `DATABASE_URL` needed. If you ever add Rails-side state (sessions,
  audit logs), keep it on a different database than Overture's.
- Set the Render service to public; the API key is the only thing in
  front of the console for MVP. Once end-user auth lands, the service
  can sit behind its own front door.

## Smoke checklist

Auth bridge: `AUTH_SMOKE.md` and `./scripts/smoke/auth-bridge-smoke.sh`.

Broader deploy: `SMOKE.md` at repo root. Rails-specific steps:

```bash
# health
curl -fsS https://console.igrisinertial.com/up

# pages load (replace with your actual domain)
for path in /home /actions /runs /runtimes /settings; do
  curl -fsS -o /dev/null -w "%{http_code} %{url_effective}\n" \
    https://console.igrisinertial.com$path
done

# no demo indicator must be present in production HTML
curl -fsS https://console.igrisinertial.com/home | grep -c 'Demo data — OVERTURE_API_BASE_URL not set'
# expect: 0
```

## Parking the Next.js console

Until parity is verified:

1. Keep `web-console` deployed on its existing service/domain.
2. New feature work goes here, not there.
3. Once the smoke checklist passes against `console.igrisinertial.com`,
   flip DNS (or the alias `app.igrisinertial.com`) and decommission
   the Next.js service in Render.
