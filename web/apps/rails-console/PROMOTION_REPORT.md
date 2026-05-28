# Rails Console Promotion Report

The Rails console (`web/apps/rails-console`) has been promoted from a
fixture-backed visual spike to the **real product console** wired to Go
Overture. Go and Rust are untouched. Next.js console (`web-console`) is
parked and gets no new feature work.

## Executive summary

- `Igris::OvertureClient` now speaks the full action-gateway protocol
  with typed errors and never-log-secrets discipline.
- `Igris::DataSource` normalizes Overture's raw shapes (`actionDefinition`,
  task response, runtime governance summary) into the view-friendly hash
  the existing UI already renders.
- Controllers run in **real mode** when `OVERTURE_API_BASE_URL` is set
  and **fixture mode** otherwise. Fixture mode shows a visible
  `Demo data — OVERTURE_API_BASE_URL not set` chip in the bottom-right.
- New `POST /actions/:id/run` flow submits real runs through Overture
  and redirects to the run-detail page; Overture's `task_id` becomes the
  Rails run id.
- Wizard now collects every field Overture's
  `actionDefinitionRequest` accepts (name, display_name, description,
  target_type, target_url, method, policy_preset, replay_class,
  approval_required) and posts them in step 4.
- Zero ActiveRecord. Zero migrations. No mirrored action/run/proof
  state in Rails. The boundary contract is verified by a test that
  greps `app/` and `config/` for `ActiveRecord|migrate|has_many`.

## Files changed

```
app/services/igris/overture_client.rb       (rewritten — typed errors, full surface)
app/services/igris/data_source.rb           (new — adapter layer)
app/services/igris/fixtures.rb              (runtime fixtures: runtime_id, no hostname)
app/controllers/application_controller.rb   (data_source + demo_mode? helpers)
app/controllers/actions_controller.rb       (create + run wired to Overture; typed-error rescue)
app/controllers/home_controller.rb          (data_source.recent_runs)
app/controllers/runs_controller.rb          (data_source.find_run / all_runs)
app/controllers/runtimes_controller.rb      (data_source.runtimes)
app/views/layouts/application.html.erb      (global Demo data indicator)
app/views/shared/_flash.html.erb            (new — notice / alert / degraded strip)
app/views/home/index.html.erb               (flash partial)
app/views/actions/index.html.erb            (flash + degraded)
app/views/actions/new.html.erb              (full wizard with all Overture fields)
app/views/actions/show.html.erb             (Run test action button + Run-a-test form)
app/views/runs/index.html.erb               (flash + degraded)
app/views/runs/show.html.erb                (flash + degraded)
app/views/runtimes/index.html.erb           (runtime_id surface; no hostname)
config/routes.rb                            (POST /actions/:id/run member route)
test/controllers/console_routes_test.rb     (updated — fixture-mode coverage)
test/controllers/overture_client_test.rb    (rewritten — Faraday test adapter, typed errors)
test/controllers/data_source_test.rb        (new — normalization tests)
test/controllers/actions_real_mode_test.rb  (new — real-mode controller via injected DS)
DEPLOY.md                                   (new — Render deployment notes)
PROMOTION_REPORT.md                         (this file)
```

## Overture API methods added

In `Igris::OvertureClient`:

| Ruby method                  | Overture endpoint                          |
| ---------------------------- | ------------------------------------------ |
| `list_actions`               | `GET /v1/actions`                          |
| `create_action(payload)`     | `POST /v1/actions`                         |
| `get_action(id)`             | `GET /v1/actions/:id`                      |
| `find_action_by_name(name)`  | composes `get_action` + `list_actions`     |
| `run_action(name, …)`        | `POST /v1/actions/:name/run`               |
| `get_task(id)`               | `GET /v1/tasks/:id`                        |
| `list_tasks(limit:)`         | `GET /v1/tasks`                            |
| `get_execution_run(id)`      | `GET /v1/execution/runs/:id`               |
| `list_runtimes`              | `GET /v1/execution/governance/runtimes`    |
| `health`                     | `GET /v1/health`                           |

Typed error hierarchy: `Error` → `Unavailable`, `Unauthenticated`,
`PolicyDenied`, `NotFound`, `Conflict`, `ValidationError`,
`ServiceUnavailable`, `ServerError`. Each carries `status` + `code`
fields populated from Overture's `{ error, message }` envelope. The
`Authorization` header is set from `OVERTURE_API_KEY` and **never
logged** (only error class / status / code / message are).

## Actions real-data behavior

- `/actions` calls `GET /v1/actions`, normalizes each `actionDefinition`
  into the view shape (target label, policy in plain language, replay
  on/off, secrets configured/not-configured, ready/needs-target/needs-runtime).
- `/actions/new` POSTs a full `actionDefinitionRequest` to `POST /v1/actions`.
  On success the user is redirected to `/actions/:name`. On 400 /
  `invalid_action_definition` the wizard re-renders with an error
  strip; on 409 / `action_name_conflict` the message is shown inline.
- `/actions/:id` calls `find_action_by_name` (falls back to `get_action`
  for UUIDish ids), shows real description / policy / target /
  secrets-state, and lists runs filtered by action name from
  `list_tasks`.
- In fixture mode the same screens render `Igris::Fixtures` content,
  with the persistent demo indicator on screen.

## Run action behavior

- New route `POST /actions/:id/run` (member route on `resources :actions`).
- "Run test action" button on the action-detail topbar submits an
  empty body; the "Run a test" card on the Overview tab takes a JSON
  input + optional `idempotency_key`.
- On success, redirect to `/runs/<task_id>` with a flash showing
  `status=… proof=…` from the Overture response.
- Typed errors mapped to friendly inline alerts:

  | Overture                          | UI message                                              |
  | --------------------------------- | ------------------------------------------------------- |
  | `invalid_body` / 400              | `Invalid: <message>`                                    |
  | `capability_policy_denied` / 403  | `Policy denied: <message>`                              |
  | `action_not_found` / 404          | Redirect to `/actions` with "Action not found"          |
  | `runtime_unavailable` / 503       | "No runtime available. Install or reconnect a runtime, then retry." |
  | other 5xx                         | `Overture error (status): <message>`                    |

- Client-side JSON parse error → "Input must be valid JSON" (no request leaves Rails).

## Run detail behavior

`/runs/:id` calls `GET /v1/tasks/:id` and builds:

- **Top strip chips** — action, `routed via` (from `executed_target` +
  `runtime_id`), `policy`, `recovery` (counts retries / awaiting review
  / not needed), `proof` (verified / failed / unavailable).
- **Story tab** — built from real fields:
  - "Action received" (always)
  - "Policy evaluated · accepted" or "Policy denied"
  - "Routed to target · <executed_target>" (only when present)
  - "Side effect completed · duration ms" / "Side effect failed · failure_reason" / "Awaiting human approval" / "In flight"
  - "Receipt signed" with proof tone — `verified` ok, `mismatch` bad, otherwise omitted
- **Recovery tab** — uses `recovery.state` and `retry_count` if present;
  otherwise "Not needed".
- **Proof tab** — surfaces `Proof verified/failed/unavailable`. Receipt
  hash is truncated. **Proof is never fabricated**: if Overture didn't
  return a verified receipt, the page says so.
- **Raw evidence tab** — shows task_id, executed_target, runtime_id,
  receipt hash, signed flag. Missing fields render `—`, not invented
  values.

## Runtimes behavior

- `/runtimes` calls `GET /v1/execution/governance/runtimes` and shows
  per-runtime cards with only the safe fields:
  - `runtime_id` (the only identifier shown)
  - `status` (Healthy / Stale / Degraded / Offline) — computed from
    Overture's status + last-seen freshness
  - `last_seen_at` (humanized relative time)
  - `capabilities` (chip list)
  - optional `os` (platform string, when Overture returns one)
- **Never exposed**: hostnames, internal IPs, environment values, raw
  secrets. A `data_source_test.rb` test asserts that
  `internal.example` and `10.0.0.5` never leak into the runtime hash
  even when Overture returns them.

## Fixture / demo fallback behavior

- Default = real mode if `OVERTURE_API_BASE_URL` is set.
- Fixture mode only when env var is unset. A visible pill
  `Demo data — OVERTURE_API_BASE_URL not set` lives in the bottom-right
  on every page in this mode.
- Writes are inert in fixture mode: `POST /actions` and
  `POST /actions/:id/run` redirect back with `Demo mode — set
  OVERTURE_API_BASE_URL to …`. No fake task_id is ever produced.
- When the env var **is** set but Overture is unreachable, reads return
  empty / nil and the page shows an orange `Overture degraded` strip
  with class name + HTTP status + machine code. This is real-mode
  graceful degradation — not fixtures pretending to be real.

## Deployment notes

See `DEPLOY.md`. Highlights:

- Stateless Rails — no `DATABASE_URL` required.
- Required env vars: `RAILS_ENV`, `SECRET_KEY_BASE`, `OVERTURE_API_BASE_URL`,
  `OVERTURE_API_KEY`, `RAILS_SERVE_STATIC_FILES`, `RAILS_LOG_TO_STDOUT`.
- Render `web` service example with `healthCheckPath: /up`.
- `rootDir: web/apps/rails-console`.
- Build step: `bundle install && bin/rails assets:precompile`.
- Start: `bundle exec puma -C config/puma.rb`.

## Tests run

```
$ bin/rails test
38 runs, 135 assertions, 0 failures, 0 errors, 0 skips
$ git diff --check         # clean
```

| Test file                          | Coverage                                                        |
| ---------------------------------- | --------------------------------------------------------------- |
| `console_routes_test.rb`           | Every page returns 200 in fixture mode; demo indicator shown    |
| `overture_client_test.rb`          | Faraday-stubbed: 400/401/403/404/409/503/500 → typed errors; auth header set; network failure → Unavailable |
| `data_source_test.rb`              | Action normalization (all target types); run summary mapping; story building; runtime never exposes hostname/IP |
| `actions_real_mode_test.rb`        | Controller paths with injected fake DS: create POST, run POST with redirect, runtime_unavailable / PolicyDenied / invalid JSON / NotFound paths |

Manual verification:

- Booted server with `OVERTURE_API_BASE_URL=http://127.0.0.1:65535`
  (unreachable). `/actions` returned 200 with the orange "Overture
  degraded" strip and no demo indicator.
- Booted with env unset. All 8 pages 200; demo indicator visible;
  `POST /actions/send_email/run` redirected with a notice that demo
  mode does not call Overture.
- Server log line on degraded read:
  `[Overture] Unavailable: overture unreachable (ConnectionFailed) (status= code=network)`
  — no secrets, no headers, no bodies.

## Known API gaps

1. **No `executed_target` mapping for hybrid_fallback yet.** Overture's
   `submitActionRun` records `executed_target` for `mock_demo` /
   `hosted_api` / `webhook` / `local_runtime`. The hybrid case is
   marked "Coming soon" on the wizard and the resolver doesn't exist
   server-side yet. Rails renders `Pending dispatch` when empty.
2. **Runtime listing endpoint shape uncertain.** I wired
   `GET /v1/execution/governance/runtimes` based on the Go route
   declaration; the response field names (`items` vs `runtimes`,
   `last_seen_at` vs `last_heartbeat_at`, `health` vs `status`) are
   handled with defensive lookups in `normalize_runtime`. Worth
   verifying once a runtime is actually registered against Overture
   from this console.
3. **No streaming run detail.** Overture has `GET /v1/alerts/stream`
   and `bt-state/stream` but the Rails detail page polls on refresh.
   Hotwire Turbo Streams is the right next step for the live view.
4. **API key auth assumes the route group accepts `Bearer <api_key>`.**
   Overture's action routes are behind `BetterAuth` (Clerk session).
   For a server-side console using a non-Clerk API key, this needs
   confirmation that the API key path through BetterAuth is wired —
   if not, the Rails console will need its own Clerk session bridge
   or a service-to-service token.
5. **`runs_for_action` filtering is client-side.** Overture's
   `GET /v1/tasks` doesn't take an `action_name` filter today, so
   Rails fetches up to N and filters. Add `?action_name=` server-side
   for cleaner pagination once Overture supports it.

## Recommended next slice

1. **Confirm auth.** Decide whether the Rails console authenticates
   end users with Clerk (BetterAuth direct) or via an API key minted
   for the console service. Wire whichever path Overture exposes.
2. **Live run detail.** Add Turbo Streams polling (or SSE via
   `/v1/alerts/stream`) so the flight recorder updates without refresh.
3. **Inline secrets management.** Today the action detail's Secrets
   tab shows `Configured / Not configured`. Add a `PATCH /v1/actions/:id`
   form to update `secret_refs` (never values) once the product flow
   is decided.
4. **`?action_name=` filter on `/v1/tasks`.** Small Go-side addition
   that removes the client-side filter and unlocks cleaner pagination.
5. **Parity audit vs Next.js console.** Walk every page on the
   Next.js console and confirm Rails covers it — then flip DNS and
   archive the Next.js service per `DEPLOY.md`.

This slice is done. Rails is now the real Igris console.
