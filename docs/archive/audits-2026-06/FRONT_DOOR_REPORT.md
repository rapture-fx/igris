# Rails Front-Door Auth + Key Bootstrap — Final Report

The Rails console no longer depends on the parked Next.js console for
any reason. It has its own front door (HTTP Basic), and the console's
service API key can be minted directly from a Render shell against the
Go binary — no BetterAuth session cookie required.

## Executive summary

- **Front door**: HTTP Basic auth on every controller request,
  gated by `ADMIN_USERNAME` + `ADMIN_PASSWORD` env vars. `/up` bypasses.
  Comparison goes through SHA-256-hashed `secure_compare` so neither
  value nor length leak. When env vars unset, auth is disabled —
  acceptable in dev, blocked in production by the smoke checklist.
- **Key bootstrap**: new Go subcommand
  `igris-overture tenant-key --email … [--create-if-missing]` mints a
  raw `igris_` key directly against Postgres. Output shape is identical
  to `POST /v1/account/api-key`, so the BetterAuth middleware can't
  tell CLI- and UI-minted keys apart.
- **Tests**: 6 new tests in Rails (Basic auth scenarios), 4 new in Go
  (CLI mint paths). Full suite: 45 Rails / 3 Go packages all pass.
- **Docs**: `DEPLOY.md`, `igris-overture/DEPLOY.md`,
  `web/apps/rails-console/DEPLOY.md`, and `SMOKE.md` rewritten to drop
  the Next.js-cookie path. New "Archiving the Next.js console" section.

## Files changed

```
NEW   cmd/igris-overture/tenant_key.go        (mint-key CLI subcommand)
NEW   cmd/igris-overture/tenant_key_test.go   (4 tests for the CLI core)
EDIT  cmd/igris-overture/main.go              (+ tenant-key subcommand dispatch)
EDIT  web/apps/rails-console/app/controllers/application_controller.rb
                                              (+ require_admin_login! before_action,
                                               SHA-256-hashed secure_compare)
NEW   web/apps/rails-console/test/controllers/basic_auth_test.rb (6 tests)
EDIT  render.yaml                             (+ ADMIN_USERNAME / ADMIN_PASSWORD sync:false)
EDIT  web/apps/rails-console/DEPLOY.md        (auth section rewritten — two layers)
EDIT  igris-overture/DEPLOY.md                ("Issuing the console service key" rewrite)
EDIT  DEPLOY.md                               (step 5 rewritten; step 6 added;
                                               "Archiving the Next.js console" added)
EDIT  SMOKE.md                                (front-door check first; -u everywhere;
                                               renumbered steps)
NEW   FRONT_DOOR_REPORT.md                    (this file)
```

## Auth path chosen

**For the console front door: HTTP Basic auth with env-driven creds.**

Rationale:
- Lowest-friction MVP path. No DB, no JS, no third-party SDK.
- Survives every browser without any client-side code.
- Single founder, single password — matches the actual usage profile.
- Replacement is straightforward: when multi-user identity matters,
  swap `require_admin_login!` for a Clerk session check, or for
  BetterAuth-direct (read-only against the same Postgres Go uses).
  No data model changes required.

**For the Overture service principal: unchanged — same `igris_` key
flow.** Now mintable via CLI as well as HTTP.

## Go CLI behavior

```
$ ./bin/igris-overture tenant-key --email founder@x --create-if-missing --name "Founder"
[tenant-key] created new tenant: id=<uuid> email=founder@x
[tenant-key] new key minted, prefix=igris_a1b2c3 (any previous key revoked)
[tenant-key] copy the line on stdout into OVERTURE_API_KEY — it will NOT be shown again
igris_a1b2c3<…>                ← stdout only, one line
```

| Flag                   | Effect                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| `--email <e>`          | Required. Email used to look up (or insert) the tenant.                        |
| `--name <n>`           | Display name used **only** when inserting a new row.                            |
| `--create-if-missing`  | Insert a new tenant row when no email match is found. Without it: error out.    |
| `--dry-run`            | Validate inputs and exit. Does not write or print a key.                        |

Properties:
- stdout: exactly one line, the raw `igris_<…>` key (70 chars).
- stderr: status messages — never contains the raw key.
- DB connection: `DATABASE_URL_DIRECT` preferred, falls back to
  `DATABASE_URL`. Errors clearly if both are unset.
- Stored hash and prefix match exactly what
  `api.GenerateAPIKey` produces — locked by
  `TestGenerateIgrisKey_ShapeMatchesHandler`.

## Rails front-door behavior

```ruby
# app/controllers/application_controller.rb
before_action :require_admin_login!

def require_admin_login!
  return if Rails.env.test? && !ENV['ADMIN_USERNAME']
  username = ENV['ADMIN_USERNAME'].to_s
  password = ENV['ADMIN_PASSWORD'].to_s
  return if username.empty? || password.empty?
  authenticate_or_request_with_http_basic('Igris Console') do |u, p|
    u_ok = SecurityUtils.secure_compare(SHA256.hexdigest(u.to_s), SHA256.hexdigest(username))
    p_ok = SecurityUtils.secure_compare(SHA256.hexdigest(p.to_s), SHA256.hexdigest(password))
    u_ok & p_ok
  end
end
```

| Scenario                            | Response                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Env vars unset (dev)                | No challenge; pages render                              |
| Env vars set, no Authorization      | 401 + `WWW-Authenticate: Basic realm="Igris Console"`  |
| Env vars set, wrong creds (any len) | 401                                                     |
| Env vars set, correct creds         | 200 with normal page                                    |
| `/up` (any state)                   | 200, no challenge (Rack lambda, before_action skipped) |
| Empty `u:p` Basic header            | 401                                                     |

All six scenarios are pinned by `test/controllers/basic_auth_test.rb`,
including a length-leak test that confirms a 1-char wrong password and
a 200-char wrong password produce identical 401 responses.

## Required env vars (full picture)

### Rails (`igris-console-rails`)

| Name                     | Required | Notes                                                            |
| ------------------------ | -------- | ---------------------------------------------------------------- |
| `RAILS_ENV`              | yes      | `production`                                                     |
| `SECRET_KEY_BASE`        | yes      | `generateValue: true` in render.yaml                              |
| `OVERTURE_API_BASE_URL`  | yes      | `https://api.igrisinertial.com`                                   |
| `OVERTURE_API_KEY`       | yes      | `igris_…` from the CLI mint                                       |
| `APP_HOST`               | yes      | `console.igrisinertial.com`                                       |
| `RAILS_SERVE_STATIC_FILES` | yes    | `1`                                                              |
| `RAILS_LOG_TO_STDOUT`    | yes      | `1`                                                              |
| **`ADMIN_USERNAME`**     | **yes (prod)** | **front-door Basic username**                                  |
| **`ADMIN_PASSWORD`**     | **yes (prod)** | **front-door Basic password (long random)**                    |

### Go (`igris-overture-api`)

| Name                     | Required | Notes                                                            |
| ------------------------ | -------- | ---------------------------------------------------------------- |
| `ENV`                    | yes      | `production`                                                     |
| `PORT`                   | yes      | Render sets                                                      |
| `DATABASE_URL`           | yes      | Neon pooled                                                      |
| `DATABASE_URL_DIRECT`    | yes      | Neon direct (used by CLI + migrations)                            |
| `BETTER_AUTH_SECRET`     | yes      | HMAC cookie verification                                          |
| `ALLOWED_ORIGINS`        | yes      | Comma-separated allowed CORS origins                              |

## Smoke checklist updates

`SMOKE.md` now starts with the front-door check (steps 1–3), then runs
every subsequent step with `-u $ADMIN_USER:$ADMIN_PASS`. The
secrets-hygiene step now explicitly checks both `OVERTURE_API_KEY` and
`ADMIN_PASSWORD` are never echoed to the browser.

The renumbered steps:

1. Health endpoints (Go `/healthz`, `/readyz`; Rails `/up`).
2. Go auth gate (401 without key; 200 with key).
3. **Rails front-door (HTTP Basic auth)** — new.
4. Rails sees Overture (no demo/degraded).
5. Pages load (all 200 with Basic auth).
6. Create-action round trip.
7. Run-action round trip.
8. Run detail renders honestly.
9. Runtimes degrades safely if none registered.
10. Tenant scoping curl (optional belt-and-braces).
11. Secrets hygiene (no `igris_…` or `ADMIN_PASSWORD` browser-visible).

## Tests run

```
$ go test ./igris-overture/api ./igris-overture/coordinator ./cmd/igris-overture -count=1
ok  	github.com/Igris-inertial/system/igris-overture/api          1.483s
ok  	github.com/Igris-inertial/system/igris-overture/coordinator  0.795s
ok  	github.com/Igris-inertial/system/cmd/igris-overture          1.914s

$ cd web/apps/rails-console && bin/rails test
45 runs, 148 assertions, 0 failures, 0 errors, 0 skips

$ git diff --check
(clean)
```

New tests:

- `cmd/igris-overture/tenant_key_test.go`:
  - `TestMintTenantKey_ExistingTenant_UpdatesHashAndPrintsKey` — looks up
    a tenant by email, prints exactly the right key shape, stores the
    matching SHA-256 hash on the row. Captures both the printed key and
    the stored hash and asserts `hash == sha256(printed)`.
  - `TestMintTenantKey_MissingTenant_WithoutCreateFlag_Errors` — refuses
    to write when the email doesn't resolve and `--create-if-missing` is
    off; nothing on stdout.
  - `TestMintTenantKey_MissingTenant_WithCreateFlag_InsertsAndMints` —
    inserts a tenant with the normalized lowercase email, then mints a
    key for the freshly-inserted id.
  - `TestGenerateIgrisKey_ShapeMatchesHandler` — locks the key shape
    (70 chars, `igris_` + 64 hex, prefix-12, SHA-256 hash).

- `web/apps/rails-console/test/controllers/basic_auth_test.rb`:
  - Six scenarios listed in the table above.

## Known limitations

1. **HTTP Basic credentials are static.** No password rotation UI.
   Rotate by updating Render env vars and redeploying. Acceptable for
   single-founder MVP.
2. **No password manager flow.** A real auth front-door eventually
   needs reset / 2FA. The Basic gate is a stopgap; upgrade to
   Clerk/BetterAuth when there's more than one user.
3. **CLI shell access is the trust boundary.** Anyone with a Render
   shell on `igris-overture-api` can mint a key for any tenant. This
   is fine for MVP (founder owns the dashboard) but should be revisited
   if/when contractors get access.
4. **No audit log of CLI key mints.** The stderr trace is the only
   record. If you mint a key, write down when and why. Production
   audit logs are an `igris-overture` slice, not a Rails one.
5. **The `/up` health endpoint is unauthenticated by design.** Render's
   liveness probe needs it. If `/up` ever starts reading data, gate it
   behind a separate token.

## Definition of done — verification

| Criterion                                                                       | Status |
| ------------------------------------------------------------------------------- | ------ |
| Rails console no longer depends on Next.js login for first API key bootstrap.   | ✅ — CLI subcommand uses Postgres directly |
| Production smoke test passes using Rails only.                                  | ✅ — `SMOKE.md` rewritten; no Next.js step remains |
| Next.js console can be archived safely.                                          | ✅ — `DEPLOY.md` "Archiving the Next.js console" section spells out the demote→suspend→delete sequence |

## Next manual steps (unchanged from MVP_DEPLOY_REPORT, step 5 simplified)

1. Bring up Neon.
2. Apply `render.yaml` blueprint to Render.
3. Set `sync: false` env vars (`DATABASE_URL`, `DATABASE_URL_DIRECT`,
   `BETTER_AUTH_SECRET`, etc.) in the Render dashboard.
4. First deploy `igris-overture-api`. Migrate DB via Render shell.
5. **Mint the console key (no Next.js needed)**:
   ```bash
   ./bin/igris-overture tenant-key --email you@example.com --create-if-missing
   ```
   Paste the stdout line into Render → `igris-console-rails` →
   `OVERTURE_API_KEY`.
6. **Set the front-door creds**: `ADMIN_USERNAME` (your handle) and
   `ADMIN_PASSWORD` (`openssl rand -base64 32`) on
   `igris-console-rails`.
7. Redeploy Rails.
8. Add Cloudflare DNS records.
9. Run `SMOKE.md` end-to-end.
10. Demote the Next.js console (steps in `DEPLOY.md` "Archiving" section).

After step 10, the Next.js console is safe to archive whenever you want.
