# Igris MVP Deploy Playbook

Three pieces wire up the MVP. Two are managed services on Render. One
is a managed Postgres at Neon. DNS rides on Cloudflare.

```
                Cloudflare DNS
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
console.igrisinertial.com        api.igrisinertial.com
 (Rails console)                  (Go Overture)
        │                             │
        └────── Authorization: ───────┘
               Bearer igris_…
                       │
                       ▼
                Neon Postgres
                (pooled + direct URLs)
```

**Rails is the product face.** It calls Go through one server-side
`igris_` API key (`OVERTURE_API_KEY`). It owns nothing durable.

**Go is the brain.** It owns actions, runs, policy, routing, recovery,
proof, receipts, and tenant state. It is the only thing that touches
Neon.

**Rust runtime** stays local to the customer machine. It registers
itself with Go through `/api/v1/runtime/register` after install.

The Next.js console (`web/apps/web-console`) is **parked** — keep it
deployed on its current URL but route no new feature work there.

## One-time setup

### 1. Neon

1. Sign up at neon.tech, create project `igris-prod`, region `us-east`
   or `us-west` (match Render region for latency).
2. Grab both connection strings from the project dashboard:
   - **Pooled** (`-pooler` in the hostname) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DATABASE_URL_DIRECT`
3. Append `?sslmode=require` to each.
4. Keep these in your password manager. Do not paste them into Git,
   chat, or this repo.

### 2. Cloudflare DNS

In the `igrisinertial.com` zone, add three records:

| Name                            | Type   | Target                                  | Proxy        |
| ------------------------------- | ------ | --------------------------------------- | ------------ |
| `api.igrisinertial.com`         | CNAME  | `igris-overture-api.onrender.com`       | DNS only     |
| `console.igrisinertial.com`     | CNAME  | `igris-console-rails.onrender.com`      | DNS only     |
| `app.igrisinertial.com`         | CNAME  | `igris-console-rails.onrender.com`      | DNS only     |

Leave `igrisinertial.com` (landing) and `docs.igrisinertial.com` on
their existing Cloudflare records — this slice doesn't touch them.

**Why "DNS only" (grey cloud), not "Proxied" (orange)?** Render
terminates TLS for the custom domains and the proxy adds an extra hop
that complicates streaming endpoints (Turbo/SSE). Re-enable proxy only
if you specifically want Cloudflare's edge cache or WAF.

### 3. Render

The `render.yaml` blueprint at the repo root declares both services
and their domains. To bring them up:

```
# In Render → New → Blueprint → connect this repo → apply render.yaml
```

Render reads the blueprint, creates `igris-overture-api` and
`igris-console-rails`, and prompts for the `sync: false` env vars
(`DATABASE_URL`, `OVERTURE_API_KEY`, etc). Don't paste those values
into the Git tree.

### 4. Migrate the Neon database

```bash
# from a Render shell on igris-overture-api, or locally with DATABASE_URL_DIRECT set
cd igris-overture/database/migrations
for f in $(ls -1 *.sql | sort); do
  echo ">> $f"
  psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -f "$f"
done
```

Use `DATABASE_URL_DIRECT`, not `DATABASE_URL` — Neon's PgBouncer
transaction-mode breaks advisory locks and some prepared statements
used by the migrations.

### 5. Mint the console's service API key

The Rails console needs an `igris_…` key for the console's tenant
(this is your tenant — for solo MVP, you are the only tenant). Steps:

1. Log in to the existing Next.js console once so a `tenants` row
   exists for you.
2. From a browser session with that login, hit:

   ```bash
   curl -X POST https://api.igrisinertial.com/v1/account/api-key \
     -H "Cookie: __Secure-better-auth.session_token=<your_session>" \
     -H "Content-Type: application/json"
   ```

   Response (only shown once):
   ```json
   { "api_key": "igris_<long>", "prefix": "igris_xxxxxx" }
   ```

3. Paste `api_key` into Render → `igris-console-rails` → Environment →
   `OVERTURE_API_KEY`.

4. Redeploy `igris-console-rails` so it picks the new env var.

To rotate: call `POST /v1/account/api-key` again (revokes the prior
key automatically) and update Render. To revoke without replacement:
`DELETE /v1/account/api-key`.

## Day-2 ops

- **Logs**: Render → service → Logs. Rails logs `[Overture] <Error>`
  lines on degraded calls — these include status + machine code but
  never the request body or auth header.
- **Health**: Render dashboard shows the latest healthCheckPath result.
  Console: `/up`. API: `/healthz` (liveness) or `/readyz` (DB-aware).
- **Degraded UI**: if Go is down or returns 5xx, the console shows an
  orange `Overture degraded` strip on every page; it doesn't crash.
- **Rotating Postgres credentials**: regenerate in Neon, update both
  `DATABASE_URL` and `DATABASE_URL_DIRECT` in Render, redeploy
  `igris-overture-api`. Rails is unaffected.
- **Rotating the console API key**: see step 5 above.

## What to do when something breaks

| Symptom                                              | Likely cause                                | Fix                                                                                  |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Console shows orange `Overture degraded` strip       | Go Overture down or 5xx                     | Check Render `igris-overture-api` logs and `/readyz`                                  |
| Console shows `Demo data — OVERTURE_API_BASE_URL not set` chip | `OVERTURE_API_BASE_URL` unset on Rails      | Set the env var on `igris-console-rails`, redeploy                                    |
| Every `GET /v1/actions` returns 401                  | `OVERTURE_API_KEY` invalid or revoked       | Mint a new key (see step 5), set on Rails, redeploy                                   |
| Action list shows wrong tenant's actions             | Should never happen — fail loud             | Check `auth_apikey_tenant_scoping_test.go` is still in the test suite and passing     |
| `psql: error: SSL connection required`               | Connection string missing `?sslmode=require` | Append to both `DATABASE_URL` and `DATABASE_URL_DIRECT`                                |
| Migration hangs on advisory lock                     | Using pooled URL for migrations              | Switch to `DATABASE_URL_DIRECT`                                                       |

## Related files

| File                                      | What it owns                                              |
| ----------------------------------------- | --------------------------------------------------------- |
| `render.yaml`                             | Both Render services (structure only, no secrets)         |
| `igris-overture/DEPLOY.md`                | Go-side deploy details, auth, migrations                  |
| `web/apps/rails-console/DEPLOY.md`        | Rails-side deploy details, modes, security                |
| `SMOKE.md`                                | End-to-end smoke test checklist                           |

## What's intentionally out of scope for MVP

- **Hetzner / self-hosted infra.** Render + Neon is the MVP stack.
- **Multi-tenant end-user auth in the console.** Single-tenant MVP
  uses one service-principal key. Multi-tenant comes later.
- **Decommissioning the Next.js console.** Keep it parked until the
  smoke checklist passes against Rails in production.
- **Live streaming on run detail.** The Rails console polls on
  refresh; Turbo Streams is the next slice.
- **Render preview environments.** Add when staging traffic justifies
  it; for now a single prod environment per service is enough.
