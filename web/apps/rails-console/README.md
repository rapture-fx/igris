# Igris Rails Console

The Rails 7.1 product surface for Igris Inertial. This is the active console.
The Go Overture backend and Rust runtime are **not** touched here — Rails
owns views only.

## What this is

- The product console at `web/apps/rails-console`, served in production at
  `console.igrisinertial.com` / `app.igrisinertial.com` via Render.
- Five lenses (Home, Actions, Runs, Runtimes, Settings) with an icon-rail +
  lens-sidebar + main-pane shell.
- Design tokens (all `--ig-*` variables) live in
  `app/assets/stylesheets/application.css`.
- Static fixture data (`app/services/igris/fixtures.rb`) so the UI is
  inspectable locally without Overture running. Pages show a visible
  `Demo data` chip in this mode.

## What this is **not**

- Not an execution engine. Rails never owns routing, policy, runtime
  dispatch, proof verification, receipt signing, or recovery decisions.
- Not a place for durable task/run storage — Go Overture is the source of
  truth.

## Local product-surface development

Two commands. No Docker, no Go Overture, no Neon, no Render, no secrets:

```bash
cd web/apps/rails-console
bin/setup-local           # checks Ruby, installs gems
bin/dev                   # boots Rails on http://localhost:3100
```

Then open **http://localhost:3100/home**.

### Fixture / demo mode (default)

When `OVERTURE_API_BASE_URL` is unset the UI runs in **fixture/demo mode**:
every page renders local fixture data and shows a visible `Demo data` chip.
This is the intended loop for iterating on Home, Actions, Create Action,
Action Detail, Runs, Run Detail, Runtimes, and Settings without needing a
backend.

### Optional: point at a local Overture

Only needed if you're working on real Go ↔ Rails integration. Product-surface
work does **not** need this.

```bash
OVERTURE_API_BASE_URL=http://localhost:8081 \
OVERTURE_API_KEY=igris_xxx \
bin/dev
```

### Ruby

Requires Ruby **≥ 3.2** (pinned to 3.2.2 in `.ruby-version`). macOS system
Ruby is 2.6 — `bin/setup-local` will refuse to continue and print install
instructions. The quickest path:

```bash
brew install rbenv ruby-build
rbenv install 3.2.2
echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc && exec zsh
cd web/apps/rails-console        # .ruby-version selects 3.2.2 automatically
bin/setup-local
```

### Tests

```bash
bin/rails test
```

## Pages

| Route                          | What it shows                                 |
| ------------------------------ | --------------------------------------------- |
| `/` → `/welcome` or `/home`    | First visit → welcome; returning → home |
| `/onboarding` → `/welcome`     | Landing signup compatibility URL |
| `/dashboard` → `/home`         | Landing signin / OAuth compatibility URL |
| `/reset-password`              | Password-reset handoff (→ landing `/auth` when token present) |
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
