# Rails Console Spike — Validation Report

Companion to `REPORT.md`. This document records what happened when the
spike was actually executed on a real Ruby 3.2.2 installation.

## Executive summary

The Rails spike **boots cleanly, serves all 8 pages with HTTP 200, and
passes 14/14 tests** (63 assertions). Two bugs surfaced during boot —
both real but trivial — and were fixed. The Overture API boundary held:
no Active Record, no persistence, no execution logic. CSS loads via the
Propshaft digested URL and matches the Next.js console's `--ig-*` tokens
1:1.

**Recommendation: optimize Next.js first, keep this spike on the shelf.**
The validation confirmed visual parity is achievable in Rails and the
boundary is clean — but it also surfaced that the current spike still
depends on hand-rolled SVGs (no Lucide on RubyGems), a custom CSS theme
file maintained in parallel with `primitives.tsx`, and no current
Hotwire wiring for the live execution-detail page. The cheaper bet
remains: cut hydration in the existing Next.js console. Keep this Rails
spike as a fully working escape hatch.

## Ruby / Rails environment used

```
$ ruby -v
ruby 3.2.2 (2023-03-30 revision e51014f9c0) [x86_64-darwin22]

$ bundle -v
Bundler version 4.0.12

$ bin/rails --version
Rails 7.1.6
```

Installation path (recorded for reproducibility):

```
brew install rbenv ruby-build         # ~1 min
rbenv install 3.2.2                   # ~8 min (source compile)
cd web/apps/rails-console
rbenv local 3.2.2                     # writes .ruby-version
gem install bundler --no-document
bundle install                        # 85 gems, ~30 s
```

## Whether the Rails app booted

Yes.

```
$ bin/rails server -p 3100
=> Booting Puma
* Puma version: 6.6.1
* Ruby version: ruby 3.2.2
* Environment: development
* Listening on http://127.0.0.1:3100
```

## Tests run and results

```
$ bin/rails test
Run options: --seed 12721
..............
Finished in 0.308927s, 45.3 runs/s, 203.9 assertions/s.
14 runs, 63 assertions, 0 failures, 0 errors, 0 skips
```

| Test                                          | Outcome |
| --------------------------------------------- | ------- |
| Home renders                                  | pass    |
| Root redirects to /home                       | pass    |
| Actions index renders with fixture rows       | pass    |
| Actions wizard renders each of 4 steps        | pass    |
| Action show renders all 6 tabs                | pass    |
| Action show 404s for unknown id               | pass    |
| Runs index renders                            | pass    |
| Run show renders all 5 tabs                   | pass    |
| Runtimes index renders                        | pass    |
| Settings index renders                        | pass    |
| /up health check                              | pass    |
| OvertureClient — not configured when env nil  | pass    |
| OvertureClient — list_actions on unreachable  | pass    |
| OvertureClient — run_action raises Unavailable| pass    |

`bin/rails routes` lists 12 routes; no orphaned paths. `git diff --check`
passes (no whitespace errors, no conflict markers).

## Pages manually inspected

All eight pages were `curl`ed against the live server and the rendered
HTML was grepped for design landmarks:

| Page                                | HTTP | Landmarks verified                                                                |
| ----------------------------------- | ---- | --------------------------------------------------------------------------------- |
| `/home`                             | 200  | "Keep your AI stack", "Setup guide", Agent→Igris→Tool diagram, `Demo data` chip   |
| `/actions`                          | 200  | `send_email`, `create_invoice`, `rebuild_search_index`, "Proof verified", "Needs runtime" |
| `/actions/new`                      | 200  | Wizard step strip (Identity / Target / Policy / Endpoint)                          |
| `/actions/send_email`               | 200  | Tabs rendered; endpoint snippet present                                            |
| `/runs`                             | 200  | "verified" + "failed" counts; status pills                                         |
| `/runs/run_01HGJ5W0M3B?tab=story`   | 200  | "Execution story", chip "routed via", chip "recovery", "Proof failed" (`is-bad`)   |
| `/runtimes`                         | 200  | Both fixture runtimes (`igris-runtime-prod-01`, `igris-runtime-staging-01`)        |
| `/settings`                         | 200  | API keys / Team / Environment / Advanced cards                                     |

`/assets/application-83136dc2.css` loads (16,996 bytes) — the full token
sheet is being delivered through Propshaft.

Browser screenshots were not captured: no Chrome / Chromium / Edge
binary is installed on this machine. Open `http://127.0.0.1:3100/home`
locally for a side-by-side with `http://localhost:3000/home` (Next.js
console) to do the visual comparison.

## Bugs found and fixed during validation

1. **`settings_index_path` was undefined** —
   `resources :settings, only: :index` exposes the helper as
   `settings_path`, not `settings_index_path`. The icon rail and lens
   sidebar both referenced the wrong name and raised 500 on every page
   render. Fixed in `app/views/shared/_icon_rail.html.erb` and
   `app/views/shared/_lens_sidebar.html.erb`.

2. **Missing `config/environments/test.rb`** — Rails 7.1 warned about
   `config.eager_load` being nil in the test env. Added a minimal
   `test.rb` mirroring the Next.js-equivalent settings. Tests passed
   either way, but the warning is now silenced.

Both bugs were caught by `bin/rails test` on first run — exactly the
loop the spike's tests were meant to provide.

## Visual parity assessment

| Surface          | Status   | Notes                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------- |
| Icon rail        | Match    | 40px column, 5 lenses, active-state vertical mark, brand at top       |
| Lens sidebar     | Match    | 236px column, per-lens content, empty-state hint                      |
| Topbar           | Match    | 44px tall, title + caption left, action right, bottom border          |
| Status strip     | Match    | Chip row on `--ig-bg-surface`                                         |
| Card surfaces    | Match    | `border-[0.5px] var(--ig-border)` + inset shadow                      |
| Status pills     | Match    | emerald / amber / rose tones                                          |
| Wizard           | Match    | Numbered circles + sep lines                                          |
| Code snippets    | Match    | Mono inside otherwise sans page; copy button                          |
| Story timeline   | Close    | Vertical dotted timeline with tone-coded dots                         |
| Run-detail strip | Match    | action / routed via / policy / recovery / proof chips                 |
| Hover tooltips   | Drift    | Icon rail uses `title=` instead of the custom tooltip slot            |
| Theme switching  | Drift    | `<html class="dark">` hard-coded; no `next-themes` toggle             |

None of the drifts are blockers — both are 1–2 hours of Stimulus or a
`data-theme` toggle to close. The spike does **not** look like a generic
Rails admin panel.

## Overture API client assessment

`Igris::OvertureClient` covers the four endpoints called out in the
task spec (`list_actions`, `create_action`, `run_action`, `get_task`),
uses `OVERTURE_API_BASE_URL` and `OVERTURE_API_KEY`, and degrades to
`nil` / `[]` on unreachable Go API. Writes raise the explicit
`Igris::OvertureClient::Unavailable` exception instead of silently
swallowing failures — controllers can decide whether to surface that or
fall back to fixtures.

The boundary is clean:

| Check                                                        | Result |
| ------------------------------------------------------------ | ------ |
| Rails persists no action/run/proof state                     | clean — no Active Record loaded, no models, no migrations |
| Rails reaches Overture only via `OvertureClient`             | clean — no other HTTP calls in `app/`                     |
| Fixture data is clearly demo-labeled                         | clean — `Demo data` chip on Home + comment header in `fixtures.rb` |
| No secrets exposed in views                                  | clean — Secrets tab shows `Configured / Not configured` only |
| No execution/policy/proof logic in Rails                     | clean — only views + read-mostly client                    |

## Performance / DX comparison

**Boot-time numbers (development):**

- `bin/rails server` cold boot: ~2 s to "Listening on http://127.0.0.1:3100"
- First `/home` render: 84 ms total, 11 ms in the view
- Subsequent `/home` render: under 20 ms
- Asset compile: zero — Propshaft just serves the file with a digest

For comparison, the Next.js console's `pnpm dev` cold boot is typically
in the 8–12 s range and first-render hydration adds further delay on
slower machines.

**Page-development DX:**

- Adding a new field to a fixture row + showing it in a table = edit
  two files, no rebuild, refresh the page. The Next.js equivalent
  touches the schema, the hook, the type, and the JSX.
- Reusable primitives (`status_pill`, `chip`, `code_snippet`) compose
  as helpers; no `'use client'` boundary or prop-drilling concerns.
- Hand-rolled SVG icons are the main friction point — Lucide isn't on
  RubyGems in a clean form, so each icon is inlined. Tolerable at 5
  icons; painful at the full set the Next.js console uses.

## Risks of Rails migration

- **Live execution detail page.** The flight-recorder will need Hotwire
  Turbo Streams or a small Stimulus controller. Doable but a different
  mental model than the React Query + WebSocket pattern the rest of
  the org uses.
- **Asset pipeline drift.** A second styling system (Propshaft + plain
  CSS) lives alongside the existing Tailwind/PostCSS pipeline. The
  design tokens must stay in lock-step — easy to forget.
- **Icon set.** Lucide is integral to the current console; porting
  every icon to inline SVG is grind.
- **Ops surface.** Adds a second runtime (Ruby + Puma) to deploy,
  monitor, and update alongside Next.js — extra Dockerfile, extra
  health endpoint, extra log stream.
- **Hiring.** The current codebase is JS/Go/Rust. Adding Ruby narrows
  the contributor pool.

## Risks of staying on Next.js

- **Console perceived slowness persists** until someone trims the
  client hooks. Easy to keep deferring.
- **Hydration weight** on read-mostly pages is real even after that
  cleanup — RSC migration is the more invasive cure, and we haven't
  budgeted for it.
- **Design drift** — the Next.js console has accumulated 31 routes;
  many are stubs. Without a forcing function (like a stack swap),
  cleanup tends not to happen.

## Recommendation

**Optimize Next.js first.** Concretely:

1. Move `actions/page.tsx`, `runs/page.tsx` (the catalogue tables that
   the Rails spike renders in <100 ms server-side) to React Server
   Components. They have no client interactivity; they shouldn't ship
   the React runtime to the browser at all.
2. Audit `useTasks` and `useGovernance` usage. If a page never
   re-renders after first paint, those hooks should run server-side.
3. Keep the execution-detail page client-rendered — it's the page that
   actually needs the React runtime.

Park this Rails spike in `web/apps/rails-console` as the demonstrated
escape hatch. Revisit if (a) the hydration cleanup above doesn't move
the needle on perceived performance, or (b) the team decides the
Next.js console's surface is too big to maintain and a from-scratch
re-platforming becomes attractive on its own merits.

This recommendation is the same as `REPORT.md` but is now grounded in
evidence: the spike actually runs.
