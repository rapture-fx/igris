# Igris Rails Console — Visual Parity Spike

A Rails 7.1 spike that recreates the Igris developer console UI to evaluate
whether Rails can replace the Next.js console as the product face. The Go
Overture backend and Rust runtime are **not** touched — Rails owns views only.

## What this is

- A Rails app in `web/apps/rails-console`, isolated from the existing Next.js
  console (`web/apps/web-console`).
- The same five lenses (Home, Actions, Runs, Runtimes, Settings) with the
  same icon-rail + lens-sidebar + main-pane shell.
- A 1:1 port of the design tokens from
  `web/apps/web-console/components/console/primitives.tsx` (all `--ig-*`
  variables) into `app/assets/stylesheets/application.css`.
- Static fixture data (`app/services/igris/fixtures.rb`) so the spike is
  evaluable offline without Overture running. The Home page shows a
  visible `Demo data` chip.

## What this is **not**

- Not a replacement for the Next.js console.
- Not an execution engine. Rails never owns routing, policy, runtime
  dispatch, proof verification, receipt signing, or recovery decisions.
- Not a redesign — visual parity with the current console is the goal.

## Running it

```bash
cd web/apps/rails-console
bundle install
bin/rails server      # http://localhost:3100
```

Requires Ruby ≥ 3.2 (see `.ruby-version`). The repo's system Ruby is 2.6 —
install 3.2 via `rbenv install 3.2.2` or `asdf install ruby 3.2.2`.

## Pages

| Route                          | What it shows                                 |
| ------------------------------ | --------------------------------------------- |
| `/` → `/home`                  | Onboarding front door + setup guide + recent runs |
| `/actions`                     | List of registered actions (catalogue)        |
| `/actions/new?step=…`          | Wizard: Identity → Target → Policy → Endpoint |
| `/actions/:id?tab=…`           | Action detail (Overview / Endpoint / Target / Policy / Secrets / Runs) |
| `/runs`                        | All runs with status / proof / routed-via     |
| `/runs/:id?tab=…`              | Flight-recorder (Story / Policy / Recovery / Proof / Raw evidence) |
| `/runtimes`                    | Connected runtimes + install command          |
| `/settings`                    | API keys / team / environment placeholders    |
| `/up`                          | Health check                                  |

## Design system

All visual primitives live in `app/assets/stylesheets/application.css`
and are namespaced under `ig-*`. The CSS variables in `:root` and
`html.dark` are a direct copy of `--ig-*` from the Next.js console — when
that file changes, this one must change too.

Reusable Rails partials/helpers:

- `shared/_icon_rail.html.erb` — 40px lens rail
- `shared/_lens_sidebar.html.erb` — 236px lens-specific sidebar
- `shared/_code_snippet.html.erb` — copyable snippet box (curl, fetch, endpoint)
- `ConsoleHelper#status_pill`, `#chip`, `#console_icon` — pills, chips, icons

## Overture API client (optional)

`app/services/igris/overture_client.rb` is a thin Faraday wrapper that
talks to Go Overture when `OVERTURE_API_BASE_URL` is set. Controllers
currently use fixtures only — wiring is left as a one-line swap in
each controller once Overture endpoints are confirmed.

The client is **read-mostly**. Rails never persists action/run state.

## Tests

```bash
bin/rails test
```

Covers:

- Every page renders 200
- Every wizard step and every tab on action/run detail
- Unknown action id returns 404
- Overture client gracefully handles unconfigured / unreachable cases

## Boundary contract

| Owned by Rails             | Stays in Go Overture / Rust runtime |
| -------------------------- | ----------------------------------- |
| Views, layouts, partials   | Execution routing                   |
| Console URL routes         | Policy evaluation                   |
| UI state, copy buttons     | Runtime dispatch                    |
| Form rendering             | Proof verification                  |
| Overture API client        | Receipt signing                     |
| Static visual fixtures     | Recovery decisions                  |
|                            | Durable task/run storage            |
|                            | Source of truth                     |

See `REPORT.md` for the evaluation summary and migration recommendation.
