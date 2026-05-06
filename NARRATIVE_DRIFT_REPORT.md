# Narrative Drift Report

Date: 2026-05-04

This report captures repo-wide narrative drift found during the Phase 5 audit, what was corrected in this pass, and what remains intentionally unchanged.

The target story is:

- Igris is one execution system for AI tasks you can verify
- the main model is Request -> Execute -> Verify
- hosted, local, and hybrid are deployment modes or execution surfaces
- advanced routing is implementation detail under Execute
- proof-limited areas stay labeled as source-confirmed, technical preview, or in development

## Public-Facing Critical

| File | Old phrase or framing | Why it was risky | Recommended action | Status |
|---|---|---|---|---|
| `README.md` | "This repository contains two products" plus routing-first architecture and Thompson Sampling positioning | Told the wrong product story at the repo root and reintroduced multi-product framing | Rewrite around one execution system, Request -> Execute -> Verify, and proof-status discipline | Fixed |
| `web/apps/web-landing/public/llms.txt` | Runtime vs Overture split, robotics-first claims, OTA/config claims, BYOM/BYOK framing as identity | Machine-readable public summary contradicted the docs reset | Replace with execution-first summary and proof-language guidance | Fixed |
| `web/apps/web-console/README.md` | "Schlep-engine Developer Console" and inference-infrastructure framing | Adjacent app README was stale and off-brand | Rewrite as Igris operator console for runs, events, signed records, and environments | Fixed |
| `web/apps/web-landing/app/terms/page.tsx` | Meta description advertised speculative execution and BYOK routing | Public metadata exposed stale positioning | Replace with neutral product/legal description | Fixed |
| `web/apps/web-console/app/layout.tsx` | "Manage your AI inference infrastructure with Overture and Runtime" | Public metadata reintroduced two-surface identity | Replace with execution-run and operator-visibility language | Fixed |
| `web/apps/web-docs-hub/content/docs/articles/thompson-sampling-routing.mdx` | Routing algorithm presented as the main product value | Article conflicted with the new docs entry path | Reframe as advanced Execute-stage path selection | Fixed |

## Public-Facing Medium

| File | Old phrase or framing | Why it was risky | Recommended action | Status |
|---|---|---|---|---|
| `web/apps/web-docs-hub/content/docs/model-aggregation.mdx` | Federated learning sold as an Infinite-tier capability | Public docs overcommitted to an unproven specialized surface | Mark as technical preview and remove tier-promise language | Fixed |
| `web/apps/web-docs-hub/content/docs/swarm.mdx` | Council Mode and Swarm Mode presented as normal product flows | Elevated advanced coordination above the core execution story | Collapse to technical-preview framing with operator caveats | Fixed |
| `web/apps/web-docs-hub/content/docs/cognitive-advisor.mdx` | Auto-optimizing routing assistant with auto-apply posture | Suggested proof-backed autonomous tuning | Reframe as advanced operator suggestion surface | Fixed |
| `web/apps/web-docs-hub/content/docs/audit.mdx` | Public proof verification described too strongly | Conflicted with current proof semantics | Reframe around signed records, retention, and hosted verification caveats | Fixed |
| `web/apps/web-docs-hub/content/docs/security.mdx` | Hosted proof verify example implied stronger public verification semantics | Public security page overstated the proof route | Use correct request shape and caveat hosted verification behavior | Fixed |
| `web/apps/web-docs-hub/content/docs/sla.mdx` | SLA table included config push and OTA timing guarantees | Public commercial commitment outpaced proof and rollout evidence | Limit SLA to hosted surfaces and exclude preview-heavy areas | Fixed |
| `web/apps/web-docs-hub/content/docs/changelog.mdx` | Historical speculative execution notes looked like current guarantees | Historical note could be misread as active product truth | Add proof-language note and soften speculative release claims | Fixed |
| `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` | Routing-first troubleshooting and fleet-first headings | Reinforced older path-selection identity | Reframe around execution paths and environment visibility | Fixed |
| `web/apps/web-docs-hub/content/docs/upgrade-migration.mdx` | Automatic OTA updates presented as default upgrade story | Suggested proven rollout behavior beyond current evidence | Make manual upgrade the default recommended path and caveat coordinated rollout | Fixed |
| `web/apps/web-docs-hub/content/docs/articles/index.mdx` | Routing-heavy article blurb and broken back link | Conflicted with new story and navigation quality | Update article summary and fix the back link | Fixed |
| `web/apps/web-landing/src/components/AIAgentView.tsx` | "nervous system", deterministic blanket claims, fleet-wide update promises | Highly visible landing copy widened the product claim | Reframe as governed execution with proof-aware caveats | Fixed |
| `web/apps/web-landing/app/machine/page.tsx` | robotics/fallback/OTA heavy machine-readable page | Public page overpromoted preview-heavy and unproven surfaces | Replace with execution-first language and softer pricing/features copy | Fixed |
| `web/apps/web-landing/src/components/sections/Faq.tsx` | Thompson Sampling, speculative execution, council mode, EscapeVector, auto-fallback as FAQ answers | Marketing FAQ was selling advanced or unproven surfaces as defaults | Keep the questions but caveat the answers and bring them back under Request -> Execute -> Verify | Fixed |
| `web/apps/web-landing/app/core/page.tsx` | Thompson Sampling and on-device determinism as default identity | Core architecture page drifted into old platform story | Reframe toward governed execution and configured environments | Fixed |
| `web/apps/web-landing/app/use-cases/page.tsx` | Overture/Runtime split and deterministic/failover promises | Public use-case copy still implied older product structure | Reframe use cases around one execution system and proof-limited hybrid claims | Fixed |

## Internal-Only Or Operator-Facing

| File | Old phrase or framing | Why it was risky | Recommended action | Status |
|---|---|---|---|---|
| `web/apps/web-console/app/models/routing/page.tsx` | "what Overture and Runtime are actually doing right now" | Operator UI still uses older internal component names | Align operator copy to "hosted and local execution surfaces" in a later console copy pass | Remaining |
| `web/apps/web-console/DEPLOYMENT_CHECKLIST.md` | "production-ready" language | Internal checklist, not core public positioning | Leave for a later console/internal audit pass | Remaining |
| `web/apps/web-console/AUDIT.md` | Historical council mode and production-readiness notes | Internal audit document, not external product page | Leave unless a broader internal-doc cleanup is requested | Remaining |
| `web/apps/web-console/SIDEBAR_REDESIGN.md` | Historical references to council mode/speculative router | Internal design note | Leave unless internal documentation is being normalized | Remaining |

## Safe To Leave For Now

| File | Phrase or surface | Why it is acceptable for now | Recommended action | Status |
|---|---|---|---|---|
| `web/apps/web-docs-hub/content/docs/changelog.mdx` | Historical speculative heading remains visible | Now explicitly marked as historical and subordinated to Proof Status | Leave unless you want a separate archival changelog cleanup | Safe to leave |
| `web/apps/web-landing/src/components/sections/Faq.tsx` | Questions still mention Thompson Sampling, Speculative Execution, Council Mode, EscapeVector | The answers now caveat them as advanced or preview-oriented rather than selling them as defaults | Leave unless you want the landing FAQ simplified further | Safe to leave |
| `web/apps/web-docs-hub/content/docs/model-aggregation.mdx` | Page still discusses model aggregation by name | The page now clearly marks the area as technical preview and removes general-availability posture | Leave unless the feature is being hidden entirely | Safe to leave |

## Remaining Public Narrative Debt

These public-facing files still contain older framing and should be the next cleanup target:

| File | Current issue | Recommended action |
|---|---|---|
| `web/apps/web-landing/src/components/sections/Header.tsx` | "Robotics Research" remains a prominent navigation item | Demote or relabel once the landing IA is updated |
| `web/apps/web-landing/src/components/sections/UseCasesTeaser.tsx` | Still leads a teaser with deterministic robotics/offline framing | Reword around execution environments and preview labels |
| `web/apps/web-landing/src/components/sections/AutonomousSystems.tsx` | Still leans heavily on robotics/edge/offline narrative | Convert into an explicitly preview-oriented advanced section |
| `web/apps/web-landing/src/components/sections/SDKs.tsx` | Mentions robotics prototypes in top-level marketing copy | Replace with long-running tasks, governed execution, or operator workflows |
| `web/apps/web-landing/public/overture.mmd` | Public diagram still centers intelligent routing, Thompson Sampling, and EscapeVector | Redraw around Request -> Execute -> Verify |
| `web/apps/web-landing/public/Simplifydiagram.svg` | Public asset still visually centers provider routing as the story | Replace with a diagram that matches the current execution-first positioning |

## What Was Fixed In This Pass

- Rewrote the repo root README to the current one-product story
- Rewrote adjacent landing and console READMEs
- Updated public machine-readable and metadata surfaces that still exposed stale positioning
- Reframed the routing-heavy article as advanced Execute-stage detail
- Converted remaining advanced docs pages to proof-aware, preview-oriented copy where appropriate
- Softened public commercial and upgrade claims that exceeded current proof
- Reduced the most visible stale landing-site copy without doing a full landing rewrite

## Validation Notes

Narrative grep checks were rerun after the edits. Remaining matches are mostly:

- explicit preview labels
- historical changelog wording now marked as historical
- intentionally untouched landing components and public diagram assets listed above

Use this report as the handoff for the next landing-focused narrative cleanup pass.
