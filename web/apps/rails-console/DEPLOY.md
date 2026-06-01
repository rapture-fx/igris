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

## Auth model (two layers)

### 1. Console front door — HTTP Basic auth

End users (just the founder for MVP) reach the console through HTTP
Basic auth gated on two env vars:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

When both are set, every request is challenged (`401 + WWW-Authenticate:
Basic realm="Igris Console"`) unless the browser presents matching
credentials. Comparison goes through SHA-256-hashed
`ActiveSupport::SecurityUtils.secure_compare` so neither value nor
length leaks via timing. The `/up` health endpoint is a Rack lambda,
not a controller, so it always responds without challenge.

When either env var is unset, the front door is open — fine for dev,
**must not happen in production**. The `render.yaml` declares both as
`sync: false` so they're set per-environment in the Render dashboard.

Upgrade path: replace with Clerk or BetterAuth-direct when multi-user
identity matters. The MVP runs single-tenant; one founder = one
password is the right shape.

### 2. Overture service principal — `igris_` API key

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

| Name                       | Required (prod) | Purpose                                                              |
| -------------------------- | --------------- | -------------------------------------------------------------------- |
| `RAILS_ENV`                | yes             | `production`                                                          |
| `SECRET_KEY_BASE`          | yes             | Rails session/cookie signing key. `bin/rails secret` or `generateValue` |
| `OVERTURE_API_BASE_URL`    | yes             | `https://api.igrisinertial.com`                                       |
| `OVERTURE_API_KEY`         | yes             | `igris_…` service-principal key — see auth model above                |
| `OVERTURE_PUBLIC_API_URL`  | no              | Override of the public endpoint URL used in snippets                 |
| `APP_HOST`                 | yes             | `console.igrisinertial.com`                                           |
| `ADMIN_USERNAME`           | yes             | Console front-door HTTP Basic username                                |
| `ADMIN_PASSWORD`           | yes             | Console front-door HTTP Basic password — long random, store in pw manager |
| `PORT`                     | yes             | Render sets to `3100` (see `config/puma.rb`)                         |
| `RAILS_SERVE_STATIC_FILES` | yes             | Set to `1` so Puma serves digested CSS from `public/`                |
| `RAILS_LOG_TO_STDOUT`      | recommended     | Render wants logs on stdout                                          |

**Never set `OVERTURE_API_KEY` in `render.yaml` or any committed file.**
`render.yaml` declares the key with `sync: false`; set the value in the
Render dashboard.

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

See `SMOKE.md` at repo root. The Rails-specific steps:

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
