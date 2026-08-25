# MVP Deployment Readiness — Final Report

The Igris Rails console and Go Overture API are wired together with a
documented, tested production path on Render + Neon + Cloudflare. No
Hetzner. No new Rails-side state. No execution logic moved out of Go.

## Executive summary

- **The auth path is already in place.** Go's `BetterAuth` middleware
  already accepts `Authorization: Bearer igris_…` against any route in
  the tenant-protected group, including `/v1/actions`, `/v1/tasks`,
  and `/v1/execution/runs`. The Rails console's existing
  `OVERTURE_API_KEY` flow works as-is.
- **Tenant scoping is now locked by an explicit test.** New
  `api/auth_apikey_tenant_scoping_test.go` proves that the tenant_id
  resolved by the API-key middleware flows into the route's SQL filter
  for `/v1/actions`. A small additive change to the shared test driver
  exposes the query args via an optional `checkArgs` hook.
- **`render.yaml`** at the repo root declares both services (Go API +
  Rails console) with their domains, build/start commands, health
  checks, and env-var keys. **No secret values committed.**
- **Three deploy documents** for three audiences:
  - `DEPLOY.md` — top-level MVP playbook (what to do)
  - `igris-overture/DEPLOY.md` — Go-side details (auth, migrations)
  - `web/apps/rails-console/DEPLOY.md` — Rails-side details (modes, security)
- **`SMOKE.md`** — 10-step production checklist a solo founder can run
  in 5 minutes after each deploy. Includes secrets-leak spot check.

## Files changed

```
NEW  render.yaml                                          (Render blueprint, both services)
NEW  DEPLOY.md                                            (top-level playbook)
NEW  SMOKE.md                                             (production smoke checklist)
NEW  igris-overture/DEPLOY.md                             (Go deploy details)
EDIT web/apps/rails-console/DEPLOY.md                     (rewritten — service principal, modes, full env table)
NEW  igris-overture/api/auth_apikey_tenant_scoping_test.go (3 tests locking tenant scoping)
EDIT igris-overture/api/routes_tasks_test.go              (+ checkArgs hook on queuedRouteQueryExpectation — additive)
NEW  MVP_DEPLOY_REPORT.md                                 (this file)
```

No production code in Go was changed. No Rails app code was changed.
Only tests, docs, and infra config touched.

## Auth path chosen

**Service-principal API key, single tenant per key, BetterAuth's
existing Bearer branch.**

```
Rails console (Render) ── Authorization: Bearer igris_<…> ──▶ Go Overture (Render)
                                                                   │
                                                       BetterAuth middleware
                                                       SELECT tenant_id … WHERE api_key_hash = sha256($1) AND is_active
                                                                   │
                                                           c.Locals("clerk_user_id", tenant_id)
                                                                   │
                                                       handlers filter every query by that tenant_id
```

Why this path:

- Zero new Go code. The middleware already supports it
  (`middleware/session_auth.go:27-53`) and the issuance endpoint exists
  (`POST /v1/account/api-key`).
- Already test-covered for valid/invalid/missing/inactive/non-prefix
  cases by `auth_apikey_integration_test.go`. The new
  `auth_apikey_tenant_scoping_test.go` adds the tenant-scoping leg.
- Single secret to rotate. Rotation is a single endpoint call.
- For solo-founder MVP, one tenant = one key. Multi-tenant end-user
  auth comes later as its own slice — the front-door change won't
  affect Overture's API-key auth.

## Go auth behavior

| Header / state                                   | Result                                                        |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `Authorization: Bearer igris_<valid>`            | tenant resolved, request proceeds                              |
| `X-API-Key: igris_<valid>`                       | tenant resolved, request proceeds (alt header)                 |
| `Authorization: Bearer igris_<unknown>`          | 401 `{"error":"unauthorized","code":"INVALID_API_KEY"}`        |
| `Authorization: Bearer not_an_igris_key_xyz`     | falls through to session-cookie path → 401 `MISSING_SESSION`   |
| key valid but `is_active=false`                  | 401 (zero rows returned by `WHERE … AND is_active = true`)     |
| no auth at all                                   | 401 `MISSING_SESSION`                                          |
| valid key from tenant A → `/v1/actions`          | SQL `WHERE tenant_id = $1` with `$1 = A`. Never tenant B's rows |

All seven cases are covered by tests in `igris-overture/api/`.

## Rails auth behavior

| Concern                                          | Implementation                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Where `OVERTURE_API_KEY` is read                 | `Igris::OvertureClient#initialize` only (server-side env)             |
| Where it's sent                                  | `Igris::OvertureClient#headers` — outbound to Overture only           |
| Where it's NOT sent                              | Not in HTML, not in JS, not in cookies, not in any client response   |
| Logging                                          | `Rails.logger.warn("[Overture] <Class>: <message> status=… code=…")` — class/status/code/message only; never headers or bodies |
| When unconfigured                                | Falls into fixture mode with a visible `Demo data` chip on every page |
| When set but Overture is down                    | Real mode with an orange `Overture degraded` strip on every page; no crash |
| When Overture returns 401                        | `Igris::OvertureClient::Unauthenticated` → friendly inline alert      |
| When Overture returns 403                        | `Igris::OvertureClient::PolicyDenied` → "Policy denied: …"            |
| When Overture returns 503 (runtime_unavailable)  | "No runtime available. Install or reconnect a runtime, then retry."  |

Tests (`actions_real_mode_test.rb`) cover policy-denial, runtime-
unavailable, invalid-JSON, missing-action, and the happy-path redirect.

## Neon env vars

| Var                    | Purpose                                                      | Where set                       |
| ---------------------- | ------------------------------------------------------------ | ------------------------------- |
| `DATABASE_URL`         | Pooled connection (PgBouncer). Used by running Overture app  | Render dashboard, `sync: false` |
| `DATABASE_URL_DIRECT`  | Direct connection (no pooler). Used only for migrations       | Render dashboard, `sync: false` |

Both URLs must have `?sslmode=require` appended — Neon enforces TLS.
Migrations are SQL files under `igris-overture/database/migrations/`
and are applied by `psql "$DATABASE_URL_DIRECT" -f <file>` in order.
No in-app migration runner is needed for MVP; the SQL files are short.

Real Neon strings are **never** committed. The repo only references
the variable names.

## Render deployment setup

**One blueprint, two services:**

| Service                | rootDir                     | runtime | startCommand                          | healthCheckPath | domain                       |
| ---------------------- | --------------------------- | ------- | ------------------------------------- | --------------- | ---------------------------- |
| `igris-overture-api`   | `.`                         | go      | `./bin/igris-overture`                | `/healthz`      | `api.igrisinertial.com`      |
| `igris-console-rails`  | `web/apps/rails-console`    | ruby    | `bundle exec puma -C config/puma.rb`  | `/up`           | `console.…` + `app.…`        |

Build commands:

- Go: `go build -o ./bin/igris-overture ./cmd/igris-overture`
- Rails: `bundle install && bin/rails assets:precompile`

Every secret is declared with `sync: false` in `render.yaml`, so the
value lives in the Render dashboard and not in Git.
`SECRET_KEY_BASE` uses `generateValue: true` so Render mints it once.

## Cloudflare DNS setup

Three CNAMEs in the `igrisinertial.com` zone:

| Name                            | Target                                  | Proxy    |
| ------------------------------- | --------------------------------------- | -------- |
| `api.igrisinertial.com`         | `igris-overture-api.onrender.com`       | DNS only |
| `console.igrisinertial.com`     | `igris-console-rails.onrender.com`      | DNS only |
| `app.igrisinertial.com`         | `igris-console-rails.onrender.com`      | DNS only |

`igrisinertial.com` (landing) and `docs.…` stay on their current
records. "DNS only" (grey cloud) rather than "Proxied" (orange) is
deliberate — Render terminates TLS and the proxy adds a hop that
would complicate Turbo Streams when we add live run detail.

## Smoke test checklist

See `SMOKE.md`. Ten steps:

1. Health endpoints — `/healthz`, `/readyz`, `/up` all 200.
2. Go auth gate — 401 without key, 200 with key.
3. Rails sees Overture — no demo indicator, no degraded strip, page
   renders real registry chip.
4. All eight pages load.
5. Create-action round trip (UI → Go → DB).
6. Run-action round trip (UI → Go → task_id surfaces in detail).
7. Run detail renders honestly (no fabricated proof).
8. Runtimes page degrades safely with zero runtimes.
9. Tenant scoping curl (belt-and-braces on top of the Go test).
10. Secrets hygiene — no `igris_…` in logs or browser HTML.

Designed to take a solo founder under 5 minutes.

## Tests run

```
$ go test ./igris-overture/api ./igris-overture/coordinator -count=1
ok  	github.com/Igris-inertial/system/igris-overture/api          0.889s
ok  	github.com/Igris-inertial/system/igris-overture/coordinator  1.507s

$ cd web/apps/rails-console && bin/rails test
38 runs, 135 assertions, 0 failures, 0 errors, 0 skips

$ git diff --check
(clean)
```

Test additions:

- `api/auth_apikey_tenant_scoping_test.go` — 3 tests:
  - `TestServiceAPIKey_ActionsList_ScopesToAuthenticatedTenant` asserts the
    tenant_id from the key flows into the `WHERE tenant_id = $1` arg.
  - `TestServiceAPIKey_ActionsList_DifferentKey_DifferentTenant` proves
    two different keys produce two differently-scoped queries back to back.
  - `TestServiceAPIKey_ActionsList_MissingKey_Rejected` proves no SQL
    fires when auth is absent (the route would otherwise have to scope
    by `""`).

These tests would catch regressions like "someone deleted the
`WHERE tenant_id =` clause," "the handler accidentally read tenant_id
from a query param," or "the middleware's `c.Locals("clerk_user_id")`
got renamed without updating consumers."

## Known limitations

1. **Single-tenant console.** The console uses one service-principal
   key for one tenant. End-user authentication (multi-tenant) is a
   follow-up slice — the front door is open for MVP.
2. **Key minting bootstraps from the existing Next.js console.** You
   need an active BetterAuth session cookie (from the Next.js login)
   to call `POST /v1/account/api-key` the first time. After that the
   API key replaces the cookie for Rails. Decommission of the Next.js
   console is gated on first deciding the multi-tenant front-door story.
3. **Render preview environments not configured.** One prod environment
   per service. Add `previewsEnabled` later if you want PR-scoped envs.
4. **No in-app migration runner.** SQL files must be applied manually
   via `psql $DATABASE_URL_DIRECT`. This is fine at MVP scale (five
   migrations to date) — replace with `dbmate` or `goose` once the
   migration count grows.
5. **Polar/Resend/Redis are optional at boot.** Billing routes fail
   gracefully when unconfigured. The MVP smoke doesn't exercise them.
6. **No staging environment.** Cut a Neon branch + spin up a second
   pair of Render services pointing at it when staging traffic
   justifies the cost.

## Next manual deployment steps

The repo is ready. To go live:

1. **Create Neon project** `igris-prod`. Copy pooled + direct strings
   to a password manager. Append `?sslmode=require` to both.
2. **Connect this repo to Render**, choose "Blueprint", confirm both
   services. Render reads `render.yaml`.
3. **Fill `sync: false` env vars** in the Render dashboard:
   - `igris-overture-api`: `DATABASE_URL`, `DATABASE_URL_DIRECT`,
     `BETTER_AUTH_SECRET`, `POLAR_WEBHOOK_SECRET`, `RESEND_API_KEY`,
     `CLERK_SECRET_KEY`.
   - `igris-console-rails`: `OVERTURE_API_KEY` (placeholder for now —
     see step 6).
4. **First deploy** of `igris-overture-api`. Watch logs; it will fail
   readiness until migrations run.
5. **Migrate the DB** via a Render shell:
   ```bash
   cd igris-overture/database/migrations
   for f in $(ls -1 *.sql | sort); do
     psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -f "$f"
   done
   ```
6. **Mint the console service key** from a logged-in browser session
   against the existing Next.js console (or directly with a Clerk/
   BetterAuth cookie):
   ```bash
   curl -X POST https://api.igrisinertial.com/v1/account/api-key \
     -H "Cookie: __Secure-better-auth.session_token=<your cookie>"
   ```
   Take the `api_key` value (shown once) and paste into Render →
   `igris-console-rails` → `OVERTURE_API_KEY`.
7. **Redeploy `igris-console-rails`** so it picks up the key.
8. **Add Cloudflare DNS** records for `api`, `console`, and `app`
   (DNS-only, CNAME to the Render targets).
9. **Run `SMOKE.md` end-to-end** against the production URLs.
10. **Keep the Next.js console parked.** Don't delete it until a real
    workflow has gone through Rails in production.

After step 10, you're live.
