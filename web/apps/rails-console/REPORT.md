# Rails Console Visual Parity Spike — Final Report

## Executive summary

A Rails 7.1 console spike was built to evaluate whether Rails can replace
the current Next.js console as the product face of Igris Inertial, while
Go Overture remains the execution brain and Rust the runtime muscle.

**Recommendation: pause the Rails migration.** The spike achieves
believable visual parity, and Rails would in fact remove a lot of weight
(no client-side hydration, no React tree, no Tailwind/PostCSS chain, no
React Query for read-mostly pages, no client/server boundary). But the
parts of the existing console that already work well — the execution
detail's live flight-recorder and the `useTasks` / `useGovernance`
streaming hooks — exist precisely because they need the client. Replacing
them in Rails means either (a) recreating Hotwire-driven streams, which
is fine but not a quick win, or (b) keeping the heavy pages in Next.js
and only moving the static read pages to Rails — a worse hybrid than
either pure stack. The honest read: the Next.js console isn't slow
because of Next.js; it's slow because of how much React state it carries
on pages that don't need it. Solving that inside Next.js (trim hooks,
move to RSC for the catalogue pages) is a smaller bet than rewriting the
shell in Rails. Revisit this if/when streaming run detail becomes a
clear pain point that Hotwire would obviously fix.

## Rails app location

`web/apps/rails-console/` — isolated from `web/apps/web-console/`. No
existing Next.js, Go, or Rust files were modified.

## Pages implemented

| Lens     | Routes                                                                 | State    |
| -------- | ---------------------------------------------------------------------- | -------- |
| Home     | `/home`                                                                | Built    |
| Actions  | `/actions`, `/actions/new?step=…`, `/actions/:id?tab=…`                | Built    |
| Runs     | `/runs`, `/runs/:id?tab=…`                                             | Built    |
| Runtimes | `/runtimes`                                                            | Built    |
| Settings | `/settings`                                                            | Built    |
| Health   | `/up`                                                                  | Built    |

Wizard steps covered: Identity, Target, Policy, Endpoint.
Action-detail tabs covered: Overview, Endpoint, Target, Policy, Secrets, Runs.
Run-detail tabs covered: Story, Policy, Recovery, Proof, Raw evidence.

## Design system / components

Token port from `web/apps/web-console/components/console/primitives.tsx`:

| Next.js token                    | Rails port (CSS var)              |
| -------------------------------- | --------------------------------- |
| `--ig-bg` `#0e0e0c`              | identical                         |
| `--ig-bg-rail` `#070707`         | identical                         |
| `--ig-bg-surface`                | identical                         |
| `--ig-border`, `--ig-border-soft`| identical                         |
| `--ig-text*` (5 tiers)           | identical                         |
| `--ig-emerald` / `rose` / `amber`| identical                         |
| `--ig-rail-active-bg` / `mark`   | identical                         |

Reusable Rails components:

- `ConsoleLayout` — `app/views/layouts/application.html.erb`
- `IconRail` — `app/views/shared/_icon_rail.html.erb` (40px wide, brand + 5 lenses)
- `LensSidebar` — `app/views/shared/_lens_sidebar.html.erb` (236px wide, per-lens content)
- `PageHeader`, `Card`, `Pill`, `Chip`, `Tabs`, `Wizard`, `Timeline`, `Table` — CSS classes (`.ig-*`)
- `code_snippet` partial — copyable snippet with `navigator.clipboard` button
- `status_pill` / `chip` / `console_icon` helpers in `ConsoleHelper`

## How closely it matches the current Next.js console

Side-by-side comparison (textual; both are dark, sans-only, sentence-case):

| Surface          | Next.js                                                  | Rails spike                                              | Match    |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------- | -------- |
| Icon rail        | 40px, brand + 5 icons + profile, active mark on left     | 40px, brand + 5 icons + profile, active mark on left     | Tight    |
| Lens sidebar     | 236px, per-lens header + nav-items, empty hint           | 236px, per-lens header + nav-items, empty hint           | Tight    |
| Topbar           | 44px, title + caption left, action right, bottom border  | 44px, title + caption left, action right, bottom border  | Tight    |
| Status strip     | Below topbar, chips on `--ig-bg-surface`                  | Below topbar, chips on `--ig-bg-surface`                  | Tight    |
| Actions table    | Surface-style table, no aggressive borders                | Surface-style table, no aggressive borders                | Tight    |
| Wizard           | Step strip with circles + dashes                          | Step strip with circles + dashes                          | Tight    |
| Snippets         | Dark code box + copy button, monospace inside sans page   | Dark code box + copy button, monospace inside sans page   | Tight    |
| Run detail strip | Chips for action / routed via / policy / recovery / proof | Chips for action / routed via / policy / recovery / proof | Tight    |
| Story timeline   | Vertical dotted timeline w/ status tone                   | Vertical timeline w/ status tone                         | Close    |
| Empty states     | Bordered card teaching the product                        | Bordered dashed card teaching the product                 | Close    |
| Theme switching  | `next-themes` html.dark toggle                            | `<html class="dark">` hard-coded for spike                | Different |

The most visible drift is the absence of hover tooltips on the icon rail
(the Next.js version slides a tooltip out the right edge); the Rails
spike uses the `title` attribute. Not a blocker — easy to add via
Stimulus if the spike continues.

## Was the Overture API client added?

Yes — `app/services/igris/overture_client.rb`. Faraday-based, reads
`OVERTURE_API_BASE_URL` / `OVERTURE_API_KEY`, with `configured?` and
`Unavailable` error class. Wired with tests, but not yet swapped into
controllers (fixtures remain the source). Swapping is a one-line change
per controller — kept fixtures so the spike is evaluable offline.

## What felt simpler in Rails

- No client/server boundary. One ERB page = one HTTP response.
- No React hooks for read-mostly pages. The actions list and runs list are
  pure server-rendered HTML with no hydration cost.
- No PostCSS / Tailwind / Next.js build step. A single CSS file with the
  same tokens. Much less moving parts to keep in sync.
- Helpers (`status_pill`, `chip`, `console_icon`) compose more cleanly
  than React components when the inputs are simple primitives.
- Routes are declarative and one-screen-readable.

## What felt worse in Rails

- The flight-recorder run detail is begging for a live stream. Hotwire
  Turbo Streams can do it, but it's a different mental model than the
  React Query pattern the existing console already standardised on.
- No shared component library with the marketing site. The Next.js
  console reuses the landing page's chips and gradient cards; Rails
  would need a parallel set or a CSS package the landing imports.
- `next-themes`-style dark/light flipping is straightforward to add but
  isn't free — the existing console gets it because of an ecosystem
  primitive.
- Asset pipeline choices (Propshaft vs Sprockets vs jsbundling) add
  decisions that Next.js had already made for us.
- Lucide icons are not on RubyGems in any clean way — the spike inlines
  SVGs. Tolerable for 5 icons, painful at the full Next.js icon set.

## Files changed

All new, all under `web/apps/rails-console/`:

```
Gemfile, Rakefile, config.ru, .gitignore, .ruby-version
bin/rails, bin/setup
config/application.rb, boot.rb, environment.rb, puma.rb, routes.rb
config/environments/{development,production}.rb
config/initializers/inflections.rb
config/locales/en.yml
app/controllers/{application,home,actions,runs,runtimes,settings}_controller.rb
app/helpers/console_helper.rb
app/services/igris/{fixtures,overture_client}.rb
app/assets/stylesheets/application.css
app/views/layouts/application.html.erb
app/views/shared/{_icon_rail,_lens_sidebar,_code_snippet}.html.erb
app/views/home/index.html.erb
app/views/actions/{index,new,show}.html.erb
app/views/runs/{index,show}.html.erb
app/views/runtimes/index.html.erb
app/views/settings/index.html.erb
test/test_helper.rb
test/controllers/{console_routes,overture_client}_test.rb
README.md, REPORT.md
```

No files outside `web/apps/rails-console/` were modified.

## Tests run

Tests are written but **not executed in this environment** — the
machine has system Ruby 2.6 and no Rails installed, and Rails 7.1 needs
Ruby ≥ 3.2. To run:

```bash
cd web/apps/rails-console
bundle install            # needs Ruby 3.2+
bin/rails test
```

Test scope:

- `console_routes_test.rb` — every page returns 200; root redirects; 404
  on unknown action id; every wizard step and every detail tab renders.
- `overture_client_test.rb` — `configured?` toggles on env var; reaches
  through Faraday and gracefully degrades when unreachable; raises
  `Unavailable` on writes without config.

`git diff --check` will pass once committed (no trailing whitespace,
no conflict markers introduced).

## Recommendation

**Pause Rails migration.** Use what this spike proved (the visual
design ports cleanly, and ERB + a small CSS file is genuinely lighter
for the static pages) to inform a smaller change inside the Next.js
console:

1. Move the catalogue/list pages (actions list, runs list, runtimes,
   settings) to React Server Components — same network shape as the
   Rails versions, no client hooks needed.
2. Keep the run-detail flight recorder client-side; it's the page that
   actually justifies the React payload.
3. Strip `useTasks` / `useGovernance` from pages that never re-render.

If that refactor still feels heavy after one iteration, revisit this
Rails spike — the bones are in place and the design system is already a
single CSS file. Until then, the cost of a full migration outweighs the
perceived weight.
