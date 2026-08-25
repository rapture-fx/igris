# Console IA & Workflow Redesign — Connect → Execute → Verify → Improve

Date: 2026-06-24
Surface: `web/apps/rails-console`
Scope: information architecture, navigation, workflow, discoverability. No new
backend systems, governance layers, trust layers, tables, or APIs — reuse what
exists.

---

## Part 1 — Current Console Workflow

### Top-level navigation (icon rail)

`Home · Overview · Actions · Agents · Runs · Runtimes · Settings`

### What is already good (from prior IA passes)

The hardest part of the brief is **already done**: the internal platform concepts
named in the task are *not* top-level destinations. They are nested:

- **Evaluations**, **Proposals**, **Intelligence** → in-page view tabs under the
  **Runs** lens (`shared/_runs_view_tabs`).
- **Trust Recommendations** → inside Runs → Intelligence (`_trust_recommendations`).
- **Evidence Memory**, **Run Story**, **Agent attribution**, **Policy
  Simulation** → partials inside **Run detail** (`runs/show`).
- **Action packs**, **Agent onboarding (Getting started)** → in-page view tabs
  under the **Agents** lens (`agents/_view_tabs`).
- **Home** is already onboarding-first (install command + next steps), not a
  dashboard.

So the console does *not* force a customer to learn "Evaluations" or "Proposals"
to begin. That myth is out of date.

### Where the journey still breaks

The remaining problem is **ordering and grouping**, not surfacing:

1. **Nav order contradicts the journey.** The journey is
   Connect (agent + runtime) → Execute (actions) → Verify (runs). But the rail
   lists **Actions before Agents**, and **Runtimes is stranded after Runs**.
   A new operator reads top-to-bottom and hits "Execute" before "Connect".

2. **The two connect surfaces are split apart.** Registering an **Agent** and
   connecting a **Runtime** are the same step in the user's head ("get my agent
   talking to Igris"), but they sit at opposite ends of the rail.

3. **Home vs Overview is ambiguous from the rail.** Both read as landing pages.
   Home = first-run onboarding; Overview = daily workspace. The rail gives no
   hint which is which. (Per project history the split itself is intentional and
   must stay — do not merge them or re-add an education hero to Home.)

4. **No visual mapping to the mental model.** Seven flat icons give the operator
   no scaffold for *why* the surfaces are ordered the way they are.

### Confusion points, mapped to the five questions

| Question | Answered today? | Friction |
|---|---|---|
| How do I connect an agent? | Yes (Home install + Agents > Getting started) | Agents sits *below* Actions in the rail |
| What can it do? | Yes (Actions, Agents > Action packs) | Execute appears before Connect |
| Did it work? | Yes (Runs history, Overview feed) | — |
| What happened? | Yes (Run detail: Run Story, attribution, evidence) | — |
| What needs attention? | Partly (Overview > Attention, Runs > Intelligence) | "Attention" is a buried tab, not a first-class answer |

---

## Part 2 — Recommended Information Architecture

Keep every existing surface and lens. Re-sequence and **group** the rail so it
reads as the journey, and make "what needs attention" reachable in one hop.

### Navigation (grouped rail)

```
Home                 ← first-run onboarding (install, connect, first action)
Overview             ← daily workspace (activity, attention, summary)

CONNECT
  Agents             ← register agents · Action packs · Getting started
  Runtimes           ← connect a runtime · API keys

EXECUTE
  Actions            ← what agents can do · readiness · health

VERIFY
  Runs               ← what happened · Intelligence · Evaluations · Proposals
                       (Improve lives here: Runs → Intelligence)

Settings             ← real configuration only
```

Group labels appear only when the rail is expanded (collapsed stays a clean icon
rail). The reorder alone carries the journey when collapsed.

### Surface hierarchy & page responsibilities

- **Home** — onboarding only. Install command, connect an agent, first action,
  recent activity. Never a metrics page. (Already true.)
- **Overview** — the daily operator workspace. Run Activity Map, feed,
  attention, summary panel. (Already true.)
- **Agents (Connect)** — catalog ("what agents do I have / what are they
  doing"), Action packs ("what can they do"), Getting started ("connect
  another"). (Already true; just promoted above Execute.)
- **Runtimes (Connect)** — connect a runtime, manage API keys. Grouped with
  Agents because operators treat them as one "get connected" step.
- **Actions (Execute)** — the catalog of what agents can do, with readiness and
  health filters. (Already true.)
- **Runs (Verify + Improve)** — the primary operational surface. History answers
  "what happened"; Intelligence/Trust answers "what needs attention"; Evaluations
  and Proposals are the improvement workflow attached here. (Already true.)
- **Settings** — customer configuration only; read-only where values are
  environment/credentials. (Already true per prior pass.)

### Decisions on the surfaces the brief asked about

- **Evaluations** → stays supporting workflow under Runs (already a Runs view
  tab). No standalone destination. Correct as-is.
- **Proposals** → stays governance workflow under Runs (already a Runs view tab),
  attached to Intelligence/recommendations. Correct as-is.
- **Trust Recommendations** → already inside Runs → Intelligence with a
  lifecycle (acknowledge/snooze/resolve). Improvement: make each recommendation
  explicitly answer *why am I seeing this / what to investigate / what next*
  (Phase B copy pass).
- **Settings** → already read-only and stops echoing env/credentials (prior
  pass). Phase B: confirm every row is real customer config, not implementation
  detail.

---

## Part 3 — Implementation Plan

### Phase A — High value, do now

1. **Reorder + group the rail** to Connect → Execute → Verify
   (`shared/_icon_rail.html.erb`). Move Agents above Actions; move Runtimes up
   next to Agents; add expanded-only group headers (Connect / Execute / Verify).
   Pure view change, no controller/route impact. **[implemented this iteration]**
2. **Disambiguate Home vs Overview** in the rail and topbars so it is obvious
   which is onboarding and which is the daily workspace (label/subtext, no merge).
3. **Promote "what needs attention"** so it is reachable in one hop from Overview
   and Runs (it exists as an Overview tab and as Runs → Intelligence; surface a
   direct entry).

### Phase B — Helpful improvements

4. **Trust Recommendation copy**: ensure each row answers why / investigate /
   next. Reuse existing fields; no new data.
5. **Settings audit pass**: verify every setting is real customer config; hide or
   relabel implementation-detail rows.
6. **Cross-links between Connect → Execute → Verify** on empty states (e.g. a
   freshly registered agent links straight to "give it an action").

### Phase C — Future considerations

7. Per-agent activity rollup on Agent detail ("what is this agent doing") using
   existing run data.
8. Health summary on the Actions list (healthy / failing) from existing run
   aggregates.
9. Optional collapsed-rail group hints if user testing shows the reorder alone is
   not enough.

### Constraints honored

No new platform layers, backend systems, trust/governance systems, tables, or
APIs. Every change is navigation, sequencing, copy, and cross-linking over
capabilities that already ship.

### Success criteria check

After Phase A the rail reads top-to-bottom as the exact five-question journey, so
a new customer can answer *connect an agent → what can it do → did it work → what
happened → what needs attention* by following the rail in order within minutes.
