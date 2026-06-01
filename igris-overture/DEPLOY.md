# Deploying Go Overture

> Current live mode is Azure Container Apps + Neon, deployed manually by GHCR
> image SHA. Render references below are historical. For the active workflow,
> use `docs/AZURE_DEPLOY_RUNBOOK.md` and `docs/LIVE_MODE_BRINGUP.md`.

Go Overture is the execution brain (action registry, policy, routing,
recovery, proof, receipts, task state). It is the **only** persistence
layer for Igris MVP. The Rails console and the Rust runtime both call
into it; neither owns durable state.

## Where it lives

| Concern         | Where                                          |
| --------------- | ---------------------------------------------- |
| Compute         | Render web service `igris-overture-api`         |
| Database        | Neon Postgres (managed, branched-from-prod)    |
| DNS             | Cloudflare `api.igrisinertial.com`              |
| Runtime callers | Customer-installed Rust runtime instances       |
| Console callers | Rails console at `console.igrisinertial.com`    |

See `render.yaml` at the repo root for the Render blueprint.

## Auth surface (MVP)

The console calls Overture with a **service API key** through the
existing BetterAuth API-key path — no new auth code was needed:

- Header: `Authorization: Bearer igris_<random>`
- Lookup: `tenants.api_key_hash = sha256(key)` and `is_active = true`
- Tenant scope: every route filters by the resolved tenant_id

Tests in `api/auth_apikey_integration_test.go` and the new
`api/auth_apikey_tenant_scoping_test.go` lock this contract. If you
ever break it, `go test ./igris-overture/api/...` fails fast.

### Issuing the console service key

Two paths, both produce identical output (the auth middleware can't
tell them apart):

**A. CLI — recommended for first deploy.** No Next.js login required.
The Go binary ships a `tenant-key` subcommand that talks to Postgres
directly. Run it from a Render shell on `igris-overture-api`:

```bash
# Fresh DB — create the tenant row and mint a key in one shot:
./bin/igris-overture tenant-key \
  --email you@example.com \
  --name "Console Operator" \
  --create-if-missing

# Existing tenant — just rotate the key:
./bin/igris-overture tenant-key --email you@example.com
```

stdout receives exactly one line: the raw `igris_<…>` key.
stderr receives a human-readable trace ("found existing tenant", etc).
The raw key is **never** logged anywhere — capture it from stdout
and paste it into Render → `igris-console-rails` → `OVERTURE_API_KEY`,
then redeploy.

The CLI uses `DATABASE_URL_DIRECT` when set, falls back to
`DATABASE_URL`. It stores `sha256(key)` exactly the way
`POST /v1/account/api-key` does, so the auth middleware lookup
succeeds against the same `tenants.api_key_hash` column.

**B. HTTP rotation — once you already have a working session.**
Once any valid auth path exists (an existing API key or a logged-in
session cookie), call:

```bash
curl -X POST https://api.igrisinertial.com/v1/account/api-key \
  -H "Authorization: Bearer $EXISTING_KEY"
# → { "api_key": "igris_…", "prefix": "igris_xxxxxx", "created_at": "…" }
```

Either path revokes the previous key on success. To revoke without
replacement: `DELETE /v1/account/api-key` (HTTP) or — for full
parity from a Render shell —
`psql "$DATABASE_URL_DIRECT" -c "UPDATE tenants SET api_key_hash=NULL, api_key_prefix=NULL WHERE tenant_email=lower('you@example.com')"`.

## Env vars

| Var                              | Required | Purpose                                                                                  |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `ENV`                            | yes      | `production` flips production-only safety paths                                          |
| `PORT`                           | yes      | Render sets this; default `8080`                                                         |
| `DATABASE_URL`                   | yes      | Neon **pooled** connection string (used by the running app)                              |
| `DATABASE_URL_DIRECT`            | yes      | Neon **direct** connection string (used by migrations only)                              |
| `BETTER_AUTH_SECRET`             | yes      | HMAC key for session-cookie signature verification (defense-in-depth)                    |
| `POLAR_WEBHOOK_SECRET`           | as used  | Polar.sh billing webhook signing                                                         |
| `RESEND_API_KEY`                 | as used  | Outbound email for trial reminders                                                        |
| `CLERK_SECRET_KEY`               | optional | Clerk JWKs validation (legacy auth path)                                                 |
| `ALLOWED_ORIGINS`                | yes      | Comma-separated allowed CORS origins (set to the console URL)                            |
| `USE_REDIS`                      | optional | `true` enables PolarClient (billing). Without Redis, billing is offline                  |
| `REDIS_URL`                      | if above | Redis connection string                                                                   |
| `REQUIRE_AUTH_FOR_INFERENCE`     | yes      | `true` in prod                                                                            |

Never commit real values for any of the above. Set them in the Render
dashboard. The repo's `render.yaml` only declares the keys.

## Neon Postgres setup

1. **Create Neon project** at neon.tech.
2. **Two connection strings**:
   - **Pooled** (`-pooler` suffix in hostname) → `DATABASE_URL`
     The running app uses this; Neon's PgBouncer multiplexes connections
     so we don't exhaust Postgres limits under Render's free/starter plan.
   - **Direct** (no `-pooler`) → `DATABASE_URL_DIRECT`
     Migrations need direct because PgBouncer transaction-mode breaks
     advisory locks and prepared statements used by some migrations.
3. **Append `?sslmode=require`** to both strings — Neon enforces TLS.
4. **Branching**: keep `main` as production. Create a `staging` branch
   for pre-release work. Branches share storage but have isolated WAL.

### Connection-string hygiene

- Strings include the password — treat like any other secret.
- Don't paste them in commit messages, PRs, or docs.
- Render's `sync: false` means the value is set per-environment in the
  dashboard, not synced from `render.yaml`. Use that.

### Running migrations against Neon

```bash
# On a Render shell, or locally with the direct URL exported.
cd igris-overture/database/migrations
for f in $(ls -1 *.sql | sort); do
  echo ">> $f"
  psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -f "$f"
done
```

Add new migration files in `igris-overture/database/migrations/` with
incrementing prefixes. There is no in-app migration runner — apply
SQL manually, then redeploy.

## Health checks

| Endpoint     | Auth | Purpose                                                  |
| ------------ | ---- | -------------------------------------------------------- |
| `/healthz`   | no   | Liveness — returns 200 if the process is up              |
| `/readyz`    | no   | Readiness — returns 200 only if DB ping succeeds         |
| `/v1/health` | no   | Detailed — returns sub-component status                  |

Render's `healthCheckPath: /healthz` is set in `render.yaml`. If you
want stricter gating (e.g., refuse routing traffic when DB is down),
switch to `/readyz`.

## Smoke test (after deploy)

See `SMOKE.md` at repo root. The Overture-specific steps:

```bash
# liveness
curl -fsS https://api.igrisinertial.com/healthz | jq

# auth gate (should 401 without a key)
curl -i https://api.igrisinertial.com/v1/actions

# auth gate (should 200 with a valid console key)
curl -i https://api.igrisinertial.com/v1/actions \
  -H "Authorization: Bearer $OVERTURE_API_KEY"

# tenant scoping (every row must belong to that tenant)
curl -fsS https://api.igrisinertial.com/v1/actions \
  -H "Authorization: Bearer $OVERTURE_API_KEY" | jq '.actions | length'
```

## What stays out of Go

- UI rendering (Rails owns it).
- Per-user session UX (Rails forwards the API key only; end-user auth
  belongs to the console front door once we add it).
- Local execution (Rust runtime).

If a feature wants to live in Go, it must be one of: action storage,
policy, routing, recovery, proof, receipts, runtime coordination, task
state, billing webhooks, or operational metrics. Everything else is a
red flag.
