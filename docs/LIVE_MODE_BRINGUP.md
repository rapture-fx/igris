# Live-mode bring-up — Azure Container Apps + Neon Postgres

Goal: take Igris from fixture/preview mode to **live mode**, where the Rails
console talks to the Go Overture API, Settings is interactive, project rename
works, agent/app + runtime keys mint, and actions create real runs.

Two Container Apps (Consumption, scale-to-zero, max 1 replica) + one Neon
Postgres. Images come from GHCR. No secrets live in the repo.

```
            Cloudflare DNS (DNS-only)
        ┌──────────────┴───────────────┐
        ▼                              ▼
 app.igrisinertial.com         api.igrisinertial.com
  igris-console (Rails)          igris-api (Go Overture)
        │   Authorization: Bearer igris_…   │
        └─────────────────┬─────────────────┘
                          ▼
                   Neon Postgres 17
              pooled (app) · direct (migrate)
```

**The console owns nothing durable.** It calls Go with one server-side `igris_`
service key. Go owns actions, runs, policy, routing, proof, receipts, tenant
state, and is the only thing that touches Neon.

> Everything in this doc was validated against a local Postgres + locally-built
> Go binary and the Rails console before being written. Where a step has a known
> gotcha (migration `010`, production provider guardrail), it is called out.

---

## What live mode requires (the two non-obvious switches)

These were verified by booting the API and watching it fatal/recover:

1. **`ENABLE_PERSISTENCE=true`** — without it the API runs but registers *no*
   action/run/key/runtime endpoints (it logs "Database not available — …
   disabled"). The console then can't leave fixture mode usefully.
2. **A provider mode the boot guardrail accepts.** In `ENV=production` the API
   defaults to `PROVIDER_MODE=real` and **fatals at boot** if no
   `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` is set
   (`FATAL: PROVIDER_MODE=real but no API keys provided`). The live-mode goal is
   action endpoints, not LLM inference, so deploy with:

   ```
   PROVIDER_MODE=hybrid
   ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION=true
   ```

   The Azure script `02-deploy-api.sh` sets both by default. To enable real
   inference later, set `PROVIDER_MODE=real` and add a provider key as a secret.

You do **not** need `ENABLE_MULTI_TENANCY=true` for live mode — the `igris_`
service key authenticates via the BetterAuth API-key path with just
persistence on (verified: 401 without key, 200 with key, tenant-scoped). Leaving
multi-tenancy off also avoids the `JWT_SECRET`/`VAULT_MASTER_KEY` boot
requirements.

---

## 0. Prerequisites

- `az login` done; subscription active; `rg-igris-prod` in `southeastasia`.
- Neon project `igris-prod`, branch `production`, Postgres 17. Grab both
  connection strings from the Neon dashboard and append `?sslmode=require`:
  - **Pooled** (host contains `-pooler`) → used by the running API.
  - **Direct** (no `-pooler`) → used by migrations and the tenant-key CLI.
- Keep both URLs in a password manager. Never paste them into the repo.

```bash
export NEON_POOLED_URL='postgresql://USER:PASS@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
export NEON_DIRECT_URL='postgresql://USER:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
```

---

## 1. Build & push the images (GitHub Actions, GHCR)

Actions tab → **Build container images** → Run workflow (or it runs on the next
`main` push that touches the build inputs). It builds and pushes:

```
ghcr.io/igris-inertial/system/igris-api:{latest,sha-<short>}
ghcr.io/igris-inertial/system/igris-console:{latest,sha-<short>}
```

Pin to a `sha-<short>` tag for deploys (reproducible). Make both GHCR packages
**public** (Package settings → visibility) for the simplest, free pull — or keep
them private and pass `GHCR_USERNAME`/`GHCR_TOKEN` (a `read:packages` PAT) to the
deploy scripts. See `scripts/azure/fallback-acr.md` if you'd rather use ACR.

> The API image compiles the Rust FFI libs (CGO) — that build is intentional
> (it preserves the accelerated routing/SLO path) and takes a few minutes in CI.

---

## 2. Migrate Neon (uses the **direct** URL)

Neon's pooled endpoint (PgBouncer transaction mode) breaks advisory locks used
by migrations — always migrate over `NEON_DIRECT_URL`.

```bash
cd igris-overture/database/migrations
for f in $(ls -1 *.sql | sort); do
  echo ">> $f"
  if ! psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 -q -f "$f"; then
    if [ "$f" = "010_provider_key_reference.sql" ]; then
      echo "   (expected, non-fatal) 010 links provider_registry + tenant_keys,"
      echo "   which are inference-provider plumbing not present in this set and"
      echo "   not needed for actions/runs/keys/runtimes. Skipping. Continuing."
    else
      echo "   FATAL: $f failed — stop and investigate."; exit 1
    fi
  fi
done
```

**Known issue — migration `010`.** Validated: applying this directory in sorted
order succeeds for every live-mode table (`tenants` with `api_key_hash`,
`action_definitions`, `task_records`, `tenant_api_keys`, runtime tables, …).
The single exception is `010_provider_key_reference.sql`, which references
`provider_registry` (created only in the repo-root `migrations/` set) and
`tenant_keys`. It is inference-only and safe to skip for an actions-first live
deploy. Apply the root `migrations/` set too only if/when you turn on real
LLM-provider routing.

Verify the live-mode tables exist:

```bash
psql "$NEON_DIRECT_URL" -c '\dt' \
  | grep -E 'tenants|action_definitions|task_records|tenant_api_keys|runtime_instances'
```

---

## 3. Mint the console service key (uses the **direct** URL)

The console needs one `igris_` key for its tenant. The Go binary mints it
straight against Postgres — no console UI needed. Run it from a machine with the
binary (build once with `go build -o ./bin/igris-overture ./cmd/igris-overture`)
and `DATABASE_URL_DIRECT` pointing at Neon direct:

```bash
DATABASE_URL_DIRECT="$NEON_DIRECT_URL" \
  ./bin/igris-overture tenant-key \
    --email you@example.com \
    --name "Console Operator" \
    --create-if-missing
# stdout: igris_<64 hex>   ← the raw key, shown ONCE
# stderr: [tenant-key] created new tenant … / new key minted, prefix=igris_xxxxxx
```

Capture the `igris_…` line into your password manager and into the deploy env:

```bash
export OVERTURE_API_KEY='igris_…'   # the raw stdout line
```

Rotating later: run the same command **without** `--create-if-missing` — it
revokes the prior key and prints a new one. Never commit the key.

---

## 4. Deploy

```bash
# 4a. One-time environment.
scripts/azure/01-create-containerapps-env.sh

# 4b. API. Pin the image tag you built in step 1.
export API_IMAGE='ghcr.io/igris-inertial/system/igris-api:sha-<short>'
scripts/azure/02-deploy-api.sh
#   → prints the API FQDN, e.g. https://igris-api.<region>.azurecontainerapps.io

# 4c. Console. Point it at the API FQDN from 4b (or api.igrisinertial.com later).
export CONSOLE_IMAGE='ghcr.io/igris-inertial/system/igris-console:sha-<short>'
export OVERTURE_API_BASE_URL='https://igris-api.<region>.azurecontainerapps.io'
export RAILS_SECRET_KEY_BASE="$(openssl rand -hex 64)"
export ADMIN_USERNAME='founder'
export ADMIN_PASSWORD="$(openssl rand -base64 32)"
# OVERTURE_API_KEY already exported in step 3.
scripts/azure/03-deploy-console.sh
#   → prints the console FQDN
```

Then bind the custom domains: **docs/AZURE_DNS.md**.

---

## Required environment variables

### igris-api (Go Overture) — set by `02-deploy-api.sh`

| Var | Value | Why |
| --- | --- | --- |
| `ENV` | `production` | enables production guardrails |
| `ENABLE_PERSISTENCE` | `true` | **required** — turns on action/run/key/runtime endpoints |
| `DATABASE_URL` | secret → `NEON_POOLED_URL` | the running app uses the pooled endpoint |
| `PROVIDER_MODE` | `hybrid` | boots without an LLM key (actions-first) |
| `ALLOW_NON_REAL_PROVIDER_MODE_IN_PRODUCTION` | `true` | required when `PROVIDER_MODE != real` in prod |
| `REQUIRE_AUTH_FOR_INFERENCE` | `true` | no anonymous inference |
| `PORT` | `8080` | ingress target port |
| `CORS_ALLOWED_ORIGINS` / `ALLOWED_ORIGINS` | `https://app.igrisinertial.com` | browser origin allow-list |

Not needed for live mode: `ENABLE_MULTI_TENANCY`, `JWT_SECRET`,
`VAULT_MASTER_KEY` (only required if you turn multi-tenancy on).

### igris-console (Rails) — set by `03-deploy-console.sh`

| Var | Value | Why |
| --- | --- | --- |
| `RAILS_ENV` | `production` | |
| `SECRET_KEY_BASE` | secret → `openssl rand -hex 64` | cookie/session signing |
| `OVERTURE_API_BASE_URL` | API FQDN / `https://api.igrisinertial.com` | **the** switch out of fixture mode |
| `OVERTURE_PUBLIC_API_URL` | same as above | endpoint URLs shown in snippets |
| `OVERTURE_API_KEY` | secret → `igris_…` | service-principal key (step 3) |
| `ADMIN_USERNAME` | your handle | front-door HTTP Basic |
| `ADMIN_PASSWORD` | secret → long random | front-door HTTP Basic |
| `RAILS_SERVE_STATIC_FILES` | `1` | Puma serves digested CSS |
| `RAILS_LOG_TO_STDOUT` | `1` | logs to the platform |
| `PORT` | `3100` | ingress target port |
| `APP_HOST` | `app.igrisinertial.com` | |

---

## Cost guardrails

- Budget alert already exists on the subscription (outside this repo).
- Both apps: `--min-replicas 0` (scale to zero when idle) `--max-replicas 1`,
  `0.25` vCPU / `0.5Gi`. With scale-to-zero the API's background crons (trial
  expiry, recovery loop) run only while a replica is warm — fine for MVP.
- Database is Neon (external) — nothing here provisions Azure Postgres.
- The scripts create **no** VM, AKS, App Service, Azure Postgres, Storage
  Account, NAT Gateway, Application Gateway, private endpoint, or ACR.
- Logs go to the auto-created Log Analytics workspace (free tier at this
  volume); request bodies and auth headers are never logged by either service.
- **If costs spike, delete everything Azure-side with:**
  `az group delete --name rg-igris-prod --yes --no-wait`
  (Neon and DNS are unaffected.)

---

## Verify it's live

Run the smoke test: **SMOKE_LIVE_MODE.md** (or `scripts/smoke/live-mode-smoke.sh`).
The headline check: the console must show **no** "Demo data — OVERTURE_API_BASE_URL
not set" chip, and a created action must appear on `/actions`.
