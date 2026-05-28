# Deploying the Rails Console

The Rails console is a stateless product face. It owns views and the
Overture API client. **No database is required** — Rails stores nothing
durably; all state lives in Go Overture / Postgres.

## Environment variables

| Name                       | Required | Purpose                                                                 |
| -------------------------- | -------- | ----------------------------------------------------------------------- |
| `RAILS_ENV`                | yes      | `production` in prod, `development` locally                             |
| `SECRET_KEY_BASE`          | yes (prod) | Rails session/cookie signing key. Generate with `bin/rails secret`     |
| `OVERTURE_API_BASE_URL`    | yes (prod) | e.g. `https://overture.igrisinertial.com`. When unset, console falls into fixture/demo mode |
| `OVERTURE_API_KEY`         | yes (prod) | Sent as `Authorization: Bearer …`. Never logged                         |
| `OVERTURE_PUBLIC_API_URL`  | no       | Optional. Override of the public endpoint URL used in snippets (default `https://api.igrisinertial.com`) |
| `APP_HOST`                 | no       | Public host for the console (e.g. `console.igrisinertial.com`). Used by Rails for URL generation |
| `PORT`                     | no       | Defaults to 3100 (see `config/puma.rb`)                                  |
| `RAILS_SERVE_STATIC_FILES` | yes (prod) | Set to any non-empty value so Puma serves digested CSS from `public/`  |
| `RAILS_LOG_TO_STDOUT`      | recommended | Render/Heroku want logs on stdout                                     |

## Render service (recommended path)

`render.yaml` (place at the monorepo root or `web/apps/rails-console/`):

```yaml
services:
  - type: web
    name: igris-console-rails
    runtime: ruby
    rootDir: web/apps/rails-console
    buildCommand: |
      bundle install
      bin/rails assets:precompile
    startCommand: bundle exec puma -C config/puma.rb
    healthCheckPath: /up
    plan: starter
    autoDeploy: false
    envVars:
      - key: RAILS_ENV
        value: production
      - key: RAILS_LOG_TO_STDOUT
        value: "1"
      - key: RAILS_SERVE_STATIC_FILES
        value: "1"
      - key: SECRET_KEY_BASE
        generateValue: true
      - key: OVERTURE_API_BASE_URL
        sync: false   # set per-environment in dashboard
      - key: OVERTURE_API_KEY
        sync: false
      - key: APP_HOST
        value: console.igrisinertial.com
```

## Health check

`GET /up` returns `200 ok` and is wired in `config/routes.rb`. Use it
for Render / k8s liveness probes.

## Static assets

Propshaft serves digested CSS via `/assets/application-<hash>.css`. In
production set `RAILS_SERVE_STATIC_FILES=1` (already covered above) and
run `bin/rails assets:precompile` in the build step so digested files
land in `public/assets/`.

## Security posture

- Never log the `Authorization` header or response bodies that contain
  secrets. The `OvertureClient` only logs `class`, `status`, `code`,
  and `message` — no headers, no bodies, no inputs.
- No DATABASE_URL needed. If you ever add Rails-side state (sessions,
  audit logs), keep it in a separate database from Overture's.
- CSRF is on for all `POST` forms (`protect_from_forgery with: :exception`).
- Set the Render service to private if you want it behind your IdP.

## What to do if Overture is down

The console doesn't crash. On unreachable Overture:

1. Reads return empty arrays / `nil` and surface an orange
   `Overture degraded` strip at the top of the page.
2. Writes (create action, run action) raise typed errors that show
   inline in the page's flash strip.
3. The `Demo data` indicator is **not** shown — the console is in real
   mode, just degraded.

If `OVERTURE_API_BASE_URL` is unset entirely, the console falls into
fixture mode and shows a persistent `Demo data — OVERTURE_API_BASE_URL
not set` chip in the bottom-right. Production should always have the
env var set.

## Parking the Next.js console

Until parity is verified in production:

1. Keep the Next.js console (`web/apps/web-console`) deployed and
   reachable on its existing URL.
2. New feature work goes here, not there.
3. Once Rails reaches feature parity on the live API, flip DNS for
   `console.igrisinertial.com` and archive the Next.js service.
