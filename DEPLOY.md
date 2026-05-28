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

### 5. Mint the console's service API key (no Next.js needed)

The Rails console needs an `igris_…` key for the console's tenant.
Use the Go CLI subcommand — it talks to Postgres directly, so the
Next.js login is **not** part of this path.

From a Render shell on `igris-overture-api`:

```bash
./bin/igris-overture tenant-key \
  --email you@example.com \
  --name "Console Operator" \
  --create-if-missing
# stdout: igris_<64-hex-chars>
# stderr: [tenant-key] created new tenant: id=… email=…
#         [tenant-key] new key minted, prefix=igris_xxxxxx
```

Capture the raw `igris_…` line, paste it into Render →
`igris-console-rails` → Environment → `OVERTURE_API_KEY`, and redeploy
the Rails service. The raw key is shown **once** — store it in your
password manager.

To rotate later, run the same command without `--create-if-missing` —
it revokes the prior key and mints a new one.

### 6. Set the Rails front-door credentials

The Rails console is gated by HTTP Basic auth. Set:

- `ADMIN_USERNAME` — your handle.
- `ADMIN_PASSWORD` — a long random value (use `openssl rand -base64 32`).

Both go on `igris-console-rails` in the Render dashboard. Store them in
your password manager. Until both are set, the console answers without
challenge — production must have both.

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

## Archiving the Next.js console

After step 5 the Rails console no longer depends on Next.js for the
key bootstrap — the Go CLI talks to Postgres directly. After step 6
end users have their own front door. Once `SMOKE.md` passes end-to-end
against the Rails URL, the Next.js console can be retired.

The Next.js console is deployed to **Cloudflare Pages** (project name
`igris-console`, see `web/apps/web-console/wrangler.toml`). The retire
sequence:

1. **Demote to internal-only.** In Cloudflare → Pages →
   `igris-console`, remove the custom-domain mapping for
   `app.igrisinertial.com`. The Pages project keeps its
   `*.pages.dev` URL as a private fallback.
2. **Verify DNS is clean.** `app.igrisinertial.com` must CNAME to
   `igris-console-rails.onrender.com`, not the Cloudflare Pages target.
3. **Soak for one billing cycle.** Watch logs/error rates on the
   Pages URL. Zero traffic = safety net wasn't needed.
4. **Pause auto-deploys** on the Pages project (disable GitHub
   integration or production-branch deploys). Hold for another 24h.
5. **Delete the Pages project.** At this point all paths to the
   Next.js console are gone in operations.
6. **Open a cleanup PR** that removes `web/apps/web-console/`, the
   `dev:console`/`build:console`/`start:console`/`lint:console`
   scripts from the root `package.json`, and any remaining doc
   references. See `web/apps/web-console/ARCHIVED.md` for the
   in-repo checklist.

Don't skip step 1 — leaving the Cloudflare Pages URL pointed at
`app.igrisinertial.com` after Rails goes live invites confusion about
which console is the source of truth.

## What's intentionally out of scope for MVP

- **Hetzner / self-hosted infra.** Render + Neon is the MVP stack.
- **Multi-tenant end-user auth in the console.** Single-tenant MVP
  uses HTTP Basic + one service-principal key. Multi-tenant (Clerk /
  BetterAuth) comes later.
- **Live streaming on run detail.** The Rails console polls on
  refresh; Turbo Streams is the next slice.
- **Render preview environments.** Add when staging traffic justifies
  it; for now a single prod environment per service is enough.
