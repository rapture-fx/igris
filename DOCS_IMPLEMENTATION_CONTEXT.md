# DOCS_IMPLEMENTATION_CONTEXT

Audit date: 2026-05-04  
Scope audited: `web/apps/web-docs-hub/` plus supporting proof/audit artifacts at repo root.

## Executive summary

- The active docs site is `web/apps/web-docs-hub`, a Next.js 15 App Router app using Fumadocs, Fumadocs MDX, and static export. It renders MDX from `web/apps/web-docs-hub/content/docs/` through a single catch-all docs route at `/docs`, with generated API-reference/search/markdown artifacts built by local scripts (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/next.config.mjs`, `web/apps/web-docs-hub/source.config.ts`, `web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`, `web/apps/web-docs-hub/lib/source.ts`).
- Content is authored primarily as MDX under `web/apps/web-docs-hub/content/docs/**/*.mdx`, ordered manually by `meta.json`, then mirrored into public markdown files and search artifacts during build (`web/apps/web-docs-hub/content/docs/meta.json`, `web/apps/web-docs-hub/content/docs/api-reference/meta.json`, `web/apps/web-docs-hub/scripts/generate-docs-artifacts.js`, `web/apps/web-docs-hub/scripts/generate-search-index.js`).
- The strongest implementation risk is not routing or rendering. The app itself can statically build, but the full docs pipeline currently fails because the API reference is out of sync with backend contracts for runtime registration/heartbeat/deregister and receipt verification (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/scripts/validate-api-contracts.js`, `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-register.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-heartbeat.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/delete-api-v1-runtime-deregister.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/post-proof-receipts-verify.mdx`).
- The docs partially align with the new positioning because they do talk about governance, receipts, audit, and bounded execution, but they still lead too often with hosted inference, routing sophistication, cloud/edge/robotics surfaces, and public Overture/Runtime split language instead of a simple Request -> Execute -> Verify product story (`web/apps/web-docs-hub/content/docs/index.mdx`, `web/apps/web-docs-hub/content/docs/quickstart.mdx`, `web/apps/web-docs-hub/content/docs/architecture.mdx`, `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx`, `web/apps/web-docs-hub/content/docs/semantic-routing.mdx`, `web/apps/web-docs-hub/content/docs/speculative-execution.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx`, `web/apps/web-docs-hub/content/docs/articles/thompson-sampling-routing.mdx`).

## Confirmed implementation vs assumptions

### Confirmed implementation

- The production docs app in this workspace is `web/apps/web-docs-hub`; package name `@igris/web-docs-hub` (`web/apps/web-docs-hub/package.json`).
- The site is static-exported Next.js, not a server-rendered docs backend (`web/apps/web-docs-hub/next.config.mjs`).
- Docs routing is generated from Fumadocs source data at build time and filtered by page audience (`web/apps/web-docs-hub/source.config.ts`, `web/apps/web-docs-hub/lib/source.ts`, `web/apps/web-docs-hub/lib/docs-audience.ts`, `web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`).
- Public markdown export is implemented as static files under `public/markdown`, not as route handlers (`web/apps/web-docs-hub/lib/docs-source.ts`, `web/apps/web-docs-hub/scripts/generate-docs-artifacts.js`).
- There are no app-local API routes in the docs app (`web/apps/web-docs-hub/app/`).

### Assumptions / unknowns

- The likely deployment target is a static host or static Vercel deployment, but that is not explicitly confirmed because there is no `vercel.json` and no deployment-specific config in the app root (`web/apps/web-docs-hub/next.config.mjs`).
- It is not confirmed whether non-public audience builds (`operator`, `internal`) are ever deployed publicly; the code supports them, but the audited commands used the default public audience path (`web/apps/web-docs-hub/scripts/docs-audience.js`, `web/apps/web-docs-hub/scripts/validate-public-output.js`).
- The public docs domain `docs.igrisinertial.com` is not hardcoded in app metadata, so canonical/base-domain behavior for production is not visible from local source inspection (`web/apps/web-docs-hub/app/layout.tsx`).

## Docs app location and framework

- Exact docs app directory: `web/apps/web-docs-hub/` (`web/apps/web-docs-hub/package.json`).
- Framework stack:
  - Next.js 15.5.9 App Router (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/app/`).
  - Fumadocs UI/Core (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/app/docs/layout.tsx`, `web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`).
  - Fumadocs MDX source generation (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/source.config.ts`).
  - MDX rendering with custom component map (`web/apps/web-docs-hub/components/mdx.tsx`).
- There is no `mdx-components.*` file in this app. The equivalent MDX component registry is `web/apps/web-docs-hub/components/mdx.tsx`.
- Relevant rendering/build dependencies:
  - `next`, `react`, `react-dom`
  - `fumadocs-core`, `fumadocs-mdx`, `fumadocs-ui`, `fumadocs-typescript`
  - `@mdx-js/loader`, `@mdx-js/react`, `next-mdx-remote`
  - `remark-gfm`, `gray-matter`
  - `next-themes`, `react-syntax-highlighter`
  (`web/apps/web-docs-hub/package.json`)

### Build and dev scripts

- `dev`: clean, generate docs artifacts, generate API verification, generate search index, then run `next dev --port 3001` (`web/apps/web-docs-hub/package.json`).
- `build`: clean, generate artifacts, validate contracts/snippets/docs, audit implementation, generate search, lint, run `next build`, validate public output (`web/apps/web-docs-hub/package.json`).
- `typecheck`: `next typegen` + `tsc --noEmit` (`web/apps/web-docs-hub/package.json`).
- `docs:generate`, `docs:validate-api-contracts`, `docs:validate-sdk-snippets`, `docs:audit`, `docs:audit:report`, `docs:verify-api` all exist as separate entry points (`web/apps/web-docs-hub/package.json`).

## Routing model

### How routes are generated

- `/` redirects to `/docs` via `app/page.tsx` (`web/apps/web-docs-hub/app/page.tsx`).
- The docs surface is a single catch-all route: `app/docs/[[...slug]]/page.tsx` (`web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`).
- Static params come from the Fumadocs source loader and are filtered by audience visibility before generation (`web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`, `web/apps/web-docs-hub/lib/source.ts`, `web/apps/web-docs-hub/lib/docs-audience.ts`).
- Fumadocs source is created from `content/docs` with `baseUrl: '/docs'` (`web/apps/web-docs-hub/source.config.ts`, `web/apps/web-docs-hub/lib/source.ts`).

### Key route files

- `web/apps/web-docs-hub/app/page.tsx`
- `web/apps/web-docs-hub/app/layout.tsx`
- `web/apps/web-docs-hub/app/docs/layout.tsx`
- `web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`
- `web/apps/web-docs-hub/app/not-found.tsx`

### Static vs dynamic

- The app is configured for `output: 'export'` and `trailingSlash: true`, so the docs are exported as static HTML (`web/apps/web-docs-hub/next.config.mjs`).
- `generateStaticParams()` is present and the standalone `next build` exported the docs successfully as static content (`web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`; local command result documented below).
- There are no App Router `route.ts` / `route.js` handlers in the docs app.
- There is no `app/api/*` surface in this app.

### Markdown export routes

- Markdown exports are not implemented as Next.js routes.
- `getDocMarkdownUrl()` maps docs pages to `/markdown/<relative>.mdx` (`web/apps/web-docs-hub/lib/docs-source.ts`).
- `scripts/generate-docs-artifacts.js` mirrors visible MDX source files into `web/apps/web-docs-hub/public/markdown/**`, which means markdown is served as static public files (`web/apps/web-docs-hub/scripts/generate-docs-artifacts.js`).
- `components/docs-page-actions.tsx` links each page to both GitHub source and its mirrored markdown file (`web/apps/web-docs-hub/components/docs-page-actions.tsx`).

### API routes used by the docs app

- None in `web/apps/web-docs-hub/app/`.
- Search is static-file based: `public/search-index.json` and `public/search-static.json`, consumed by `components/docs-search-dialog.tsx` (`web/apps/web-docs-hub/scripts/generate-search-index.js`, `web/apps/web-docs-hub/components/docs-search-dialog.tsx`).

### Dynamic rendering / Vercel concerns

- Full `pnpm build` is blocked today by API contract validation failures before `next build` starts, so deployment pipelines using the package build script will fail until those docs are corrected (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/scripts/validate-api-contracts.js`).
- Because the app is static-exported, any future rewrite must avoid adding server-only route logic unless the deployment model changes (`web/apps/web-docs-hub/next.config.mjs`).
- No `vercel.json` is present in the app root, and no `metadataBase` / canonical URL is configured in `app/layout.tsx`, so domain-specific SEO behavior is implicit rather than explicitly encoded (`web/apps/web-docs-hub/app/layout.tsx`).

## Content source model

### Where docs content lives

- Main authored docs: `web/apps/web-docs-hub/content/docs/*.mdx`
- Articles: `web/apps/web-docs-hub/content/docs/articles/*.mdx`
- API reference guides and endpoint pages: `web/apps/web-docs-hub/content/docs/api-reference/**/*.mdx`
- Navigation metadata: `web/apps/web-docs-hub/content/docs/meta.json`, `web/apps/web-docs-hub/content/docs/api-reference/meta.json`, and section-level `meta.json` files inside API reference folders

### Frontmatter requirements

- `audience` is required on every docs page and must be one of `public`, `operator`, or `internal` (`web/apps/web-docs-hub/scripts/validate-docs.js`, `web/apps/web-docs-hub/scripts/docs-audience.js`).
- `title` and `description` are widely used, but the validator enforces `audience` explicitly, not a full frontmatter schema (`web/apps/web-docs-hub/scripts/validate-docs.js`).

### How pages are discovered

- Fumadocs discovers pages from `dir: 'content/docs'` in `source.config.ts` (`web/apps/web-docs-hub/source.config.ts`).
- The root docs order is manual via `content/docs/meta.json` (`web/apps/web-docs-hub/content/docs/meta.json`).
- API reference order is manual via `content/docs/api-reference/meta.json` and section `meta.json` files (`web/apps/web-docs-hub/content/docs/api-reference/meta.json`).

### Generated content and indexes

- Generated docs artifacts:
  - `web/apps/web-docs-hub/lib/generated/api-reference.json`
  - `web/apps/web-docs-hub/lib/generated/api-verification.json`
  - `web/apps/web-docs-hub/lib/generated/api-contract-validation.json`
  - `web/apps/web-docs-hub/lib/generated/docs-audience.json`
  - `web/apps/web-docs-hub/lib/generated/sdk-support.json`
  - `web/apps/web-docs-hub/lib/generated/mcp-reference.json`
  (`web/apps/web-docs-hub/scripts/generate-docs-artifacts.js`, `web/apps/web-docs-hub/scripts/generate-api-verification-report.js`, `web/apps/web-docs-hub/scripts/validate-api-contracts.js`)
- Search outputs:
  - `web/apps/web-docs-hub/lib/search-index.json`
  - `web/apps/web-docs-hub/public/search-index.json`
  - `web/apps/web-docs-hub/public/search-static.json`
  (`web/apps/web-docs-hub/scripts/generate-search-index.js`)
- Public raw markdown mirror:
  - `web/apps/web-docs-hub/public/markdown/**`
  (`web/apps/web-docs-hub/scripts/generate-docs-artifacts.js`)

### Authored vs generated API reference

- The API-reference page set is partly generated from structured endpoint metadata and source-schema scanning, not purely hand-written prose (`web/apps/web-docs-hub/scripts/generate-api-reference-content.js`, `web/apps/web-docs-hub/scripts/docs-data.js`, `web/apps/web-docs-hub/lib/api-reference-page-data.ts`).

## Navigation and sidebar implementation

### Where nav/sidebar ordering is defined

- Root docs nav ordering: `web/apps/web-docs-hub/content/docs/meta.json`
- API reference nav ordering: `web/apps/web-docs-hub/content/docs/api-reference/meta.json` plus section `meta.json`
- Sidebar tree is auto-generated from Fumadocs page tree, then filtered by audience and by `hiddenReferenceNames` in `lib/sidebar-tree.ts` (`web/apps/web-docs-hub/lib/sidebar-tree.ts`, `web/apps/web-docs-hub/lib/source.ts`)
- A separate manual “Documentation” dropdown is implemented in `components/reference-menu.tsx` (`web/apps/web-docs-hub/components/reference-menu.tsx`).

### Current top-level groups

- `Ungrouped`: Overview (`web/apps/web-docs-hub/content/docs/meta.json`, `web/apps/web-docs-hub/content/docs/index.mdx`)
- `Start Here`
- `Operate Igris`
- `Core Concepts`
- `Agents & Context`
- `Routing & Policy`
- `Edge & Robotics`
- `Reliability & Governance`
- `Reference`
- `Articles`
  (`web/apps/web-docs-hub/content/docs/meta.json`)

### Is navigation automatic or manual?

- Ordering is manual.
- Route existence is automatic through Fumadocs source discovery.
- Visibility is automatic through the audience filter (`web/apps/web-docs-hub/content/docs/meta.json`, `web/apps/web-docs-hub/lib/source.ts`, `web/apps/web-docs-hub/scripts/docs-audience.js`).

### Content pages not in root navigation

- `web/apps/web-docs-hub/content/docs/docs-authoring.mdx` (`internal`)
- `web/apps/web-docs-hub/content/docs/docs-authoring-components.mdx` (`internal`)
- `web/apps/web-docs-hub/content/docs/docs-authoring-schemas.mdx` (`internal`)
- `web/apps/web-docs-hub/content/docs/documentation-roadmap.mdx` (`internal`)

These are intentionally excluded from public root nav and match their `audience` values (`web/apps/web-docs-hub/content/docs/meta.json`, `web/apps/web-docs-hub/scripts/validate-docs.js`).

### Navigation items pointing to missing pages

- Root nav: no missing target pages were found in `content/docs/meta.json`.
- API reference meta: no missing section directories or broken meta entries were found in `content/docs/api-reference/meta.json`.
- Broken internal docs link found in content:
  - `web/apps/web-docs-hub/content/docs/articles/index.mdx` links to `/docs/overview`, but the overview route is `/docs` (`web/apps/web-docs-hub/content/docs/articles/index.mdx`, `web/apps/web-docs-hub/content/docs/index.mdx`).

## Current documentation information architecture

### Public top-level tree

- `Overview` — `web/apps/web-docs-hub/content/docs/index.mdx` — onboarding / product intro
- `Start Here`
  - `Quick Start` — `web/apps/web-docs-hub/content/docs/quickstart.mdx` — onboarding
  - `SDKs` — `web/apps/web-docs-hub/content/docs/sdk.mdx` — onboarding
  - `SDK Integration Patterns` — `web/apps/web-docs-hub/content/docs/sdk-integration-patterns.mdx` — guide
  - `First Cloud Integration` — `web/apps/web-docs-hub/content/docs/first-cloud-integration.mdx` — guide
  - `Deploy Local Runtime` — `web/apps/web-docs-hub/content/docs/deploy-local-runtime.mdx` — guide
  - `Hybrid Deployment Workflow` — `web/apps/web-docs-hub/content/docs/hybrid-deployment-workflow.mdx` — guide
  - `Receipts and Audit Workflow` — `web/apps/web-docs-hub/content/docs/receipts-audit-workflow.mdx` — guide
- `Operate Igris`
  - `Fleet Rollout Workflow` — `web/apps/web-docs-hub/content/docs/fleet-rollout-workflow.mdx` — guide
  - `Console User Guide` — `web/apps/web-docs-hub/content/docs/console.mdx` — guide
  - `Cloud Coordination` — `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` — concepts / guide
  - `Fleet Management` — `web/apps/web-docs-hub/content/docs/fleet-management.mdx` — guide
  - `Trial & Billing` — `web/apps/web-docs-hub/content/docs/trial-billing.mdx` — guide
  - `Licensing & Activation` — `web/apps/web-docs-hub/content/docs/licensing-activation.mdx` — guide
  - `Pricing & Tiers` — `web/apps/web-docs-hub/content/docs/pricing-tiers.mdx` — guide / commercial
- `Core Concepts`
  - `Architecture` — `web/apps/web-docs-hub/content/docs/architecture.mdx` — architecture
  - `Deployment` — `web/apps/web-docs-hub/content/docs/deployment.mdx` — architecture / guide
  - `Security` — `web/apps/web-docs-hub/content/docs/security.mdx` — concepts
  - `Identity & Access` — `web/apps/web-docs-hub/content/docs/identity-access.mdx` — concepts
  - `Execution Model` — `web/apps/web-docs-hub/content/docs/execution-model.mdx` — concepts
  - `Execution Flow` — `web/apps/web-docs-hub/content/docs/execution-flow.mdx` — concepts
  - `Safety & Containment` — `web/apps/web-docs-hub/content/docs/safety.mdx` — concepts
  - `Capabilities & Limits` — `web/apps/web-docs-hub/content/docs/capability-model.mdx` — concepts
  - `Execution Receipts` — `web/apps/web-docs-hub/content/docs/execution-receipts.mdx` — concepts / proof
  - `History & Alerts` — `web/apps/web-docs-hub/content/docs/history.mdx` — concepts / guide
  - `Durable Task Execution` — `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` — advanced / guide
  - `Agent Lifecycle` — `web/apps/web-docs-hub/content/docs/agent-lifecycle.mdx` — concepts
  - `Human-in-the-Loop Approvals` — `web/apps/web-docs-hub/content/docs/approval-workflows.mdx` — guide
- `Agents & Context`
  - `Agents` — `web/apps/web-docs-hub/content/docs/agents.mdx` — concepts
  - `Context Engineering` — `web/apps/web-docs-hub/content/docs/context-engineering.mdx` — concepts
  - `Behavior Trees` — `web/apps/web-docs-hub/content/docs/behavior-trees.mdx` — advanced
  - `Tools` — `web/apps/web-docs-hub/content/docs/tools.mdx` — concepts
  - `Memory` — `web/apps/web-docs-hub/content/docs/memory.mdx` — concepts / advanced
  - `MCP` — `web/apps/web-docs-hub/content/docs/mcp.mdx` — concepts
  - `MCP Server` — `web/apps/web-docs-hub/content/docs/mcp-server.mdx` — advanced
  - `MCP Swarm Mode` — `web/apps/web-docs-hub/content/docs/mcp-swarm.mdx` — advanced
  - `MCP Integration Patterns` — `web/apps/web-docs-hub/content/docs/mcp-integration-patterns.mdx` — guide
  - `Swarm & Council Mode` — `web/apps/web-docs-hub/content/docs/swarm.mdx` — advanced
  - `Routing Advisor` — `web/apps/web-docs-hub/content/docs/cognitive-advisor.mdx` — advanced
- `Routing & Policy`
  - `Semantic Routing` — `web/apps/web-docs-hub/content/docs/semantic-routing.mdx` — advanced
  - `Policy` — `web/apps/web-docs-hub/content/docs/policy.mdx` — concepts
  - `Key Management` — `web/apps/web-docs-hub/content/docs/key-management.mdx` — guide
  - `Provider Health` — `web/apps/web-docs-hub/content/docs/provider-health.mdx` — advanced
  - `Provider Trust` — `web/apps/web-docs-hub/content/docs/provider-trust.mdx` — advanced
  - `Circuit Breaker` — `web/apps/web-docs-hub/content/docs/circuit-breaker.mdx` — advanced
  - `Routing Engine` — `web/apps/web-docs-hub/content/docs/escapevector.mdx` — advanced
  - `Shadow Mode` — `web/apps/web-docs-hub/content/docs/shadow-mode.mdx` — advanced
  - `Speculative Execution` — `web/apps/web-docs-hub/content/docs/speculative-execution.mdx` — advanced
  - `Model Aggregation` — `web/apps/web-docs-hub/content/docs/model-aggregation.mdx` — unknown / advanced
- `Edge & Robotics`
  - `Robotics` — `web/apps/web-docs-hub/content/docs/robotics.mdx` — advanced / domain-specific
  - `ROS2 Integration` — `web/apps/web-docs-hub/content/docs/ros2-integration.mdx` — advanced / domain-specific
  - `Local LLM Fallback` — `web/apps/web-docs-hub/content/docs/local-llm-fallback.mdx` — advanced
  - `Multimodal Inference` — `web/apps/web-docs-hub/content/docs/multimodal.mdx` — advanced / preview
- `Reliability & Governance`
  - `Governance` — `web/apps/web-docs-hub/content/docs/governance.mdx` — concepts
  - `Audit` — `web/apps/web-docs-hub/content/docs/audit.mdx` — concepts / proof
  - `Observability & Tracing` — `web/apps/web-docs-hub/content/docs/observability-tracing.mdx` — guide
  - `Tamper-Evident Logs` — `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` — concepts / proof
  - `SLO Enforcer` — `web/apps/web-docs-hub/content/docs/slo-enforcer.mdx` — advanced
  - `Multi-Tenancy` — `web/apps/web-docs-hub/content/docs/multi-tenancy.mdx` — advanced
  - `Data Privacy` — `web/apps/web-docs-hub/content/docs/data-privacy.mdx` — guide / concepts
  - `Rate Limiting` — `web/apps/web-docs-hub/content/docs/rate-limiting.mdx` — guide
  - `Error Codes` — `web/apps/web-docs-hub/content/docs/error-codes.mdx` — reference
  - `Service Level Agreement` — `web/apps/web-docs-hub/content/docs/sla.mdx` — commercial / guide
- `Reference`
  - `API Reference` — `web/apps/web-docs-hub/content/docs/api-reference/index.mdx` — API reference
  - `Troubleshooting` — `web/apps/web-docs-hub/content/docs/troubleshooting.mdx` — reference
  - `Upgrade & Migration` — `web/apps/web-docs-hub/content/docs/upgrade-migration.mdx` — reference
  - `Changelog` — `web/apps/web-docs-hub/content/docs/changelog.mdx` — reference
- `Articles`
  - `Articles` — `web/apps/web-docs-hub/content/docs/articles/index.mdx` — article hub
  - `Deploying Igris on Edge Devices` — `web/apps/web-docs-hub/content/docs/articles/edge-deployment-guide.mdx` — article
  - `Building Safe Agents with Capability Gates` — `web/apps/web-docs-hub/content/docs/articles/safe-agents-capability-gates.mdx` — article
  - `How Adaptive Routing Works` — `web/apps/web-docs-hub/content/docs/articles/thompson-sampling-routing.mdx` — article

### Hidden/internal pages

- `Docs Authoring` — `web/apps/web-docs-hub/content/docs/docs-authoring.mdx` — internal
- `Docs Authoring Components` — `web/apps/web-docs-hub/content/docs/docs-authoring-components.mdx` — internal
- `Docs Authoring Schemas` — `web/apps/web-docs-hub/content/docs/docs-authoring-schemas.mdx` — internal
- `Documentation Roadmap` — `web/apps/web-docs-hub/content/docs/documentation-roadmap.mdx` — roadmap / internal

### API reference structure

- Guides
  - `API Reference` — `web/apps/web-docs-hub/content/docs/api-reference/index.mdx`
  - `Introduction` — `web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx`
  - `Authentication` — `web/apps/web-docs-hub/content/docs/api-reference/authentication.mdx`
  - `Errors` — `web/apps/web-docs-hub/content/docs/api-reference/errors.mdx`
  - `Rate Limits` — `web/apps/web-docs-hub/content/docs/api-reference/rate-limits.mdx`
- Endpoint section directories
  - `Inference & Integration` — 7 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/inference-integration/`
  - `Runtime Distribution & Fleet Coordination` — 11 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/`
  - `Account, Trial, and Billing` — 5 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/account-trial-and-billing/`
  - `Vault, Policy, and Governance` — 9 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/vault-policy-and-governance/`
  - `Execution, History, and Receipts` — 5 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/`
  - `Routing Control & Analytics` — 14 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/routing-control-analytics/`
  - `Behavior Trees` — 5 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/behavior-trees/`
  - `Durable Tasks` — 7 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/durable-tasks/`
  - `MCP Transport` — 2 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/mcp-transport/`
  - `Local Runtime API` — 38 endpoint pages — `web/apps/web-docs-hub/content/docs/api-reference/local-runtime-api/`

## Current product story in docs

### What the docs currently say

- The overview page frames Igris as a governed execution system, but its first major structure is “One System, Three Surfaces” with Cloud, Edge, and Robots (`web/apps/web-docs-hub/content/docs/index.mdx`).
- Quickstart leads with the hosted OpenAI-compatible API, provider keys, and cloud routing as the default path (`web/apps/web-docs-hub/content/docs/quickstart.mdx`).
- Architecture explains Igris through “two production components” and then spends most of its surface area on coordination/routing subsystems (`web/apps/web-docs-hub/content/docs/architecture.mdx`).
- API-reference intro says Igris is “one product with two access points,” which is better than a two-product pitch but still starts from surface split, not Request -> Execute -> Verify (`web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx`).
- Cloud and routing pages repeatedly foreground Overture, provider selection, semantic routing, speculative execution, and adaptive routing (`web/apps/web-docs-hub/content/docs/cloud-coordination.mdx`, `web/apps/web-docs-hub/content/docs/semantic-routing.mdx`, `web/apps/web-docs-hub/content/docs/speculative-execution.mdx`, `web/apps/web-docs-hub/content/docs/articles/thompson-sampling-routing.mdx`).

### One product or multiple products?

- Public docs mostly describe one product with multiple surfaces / access points, not two separate products (`web/apps/web-docs-hub/content/docs/index.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx`).
- However, root metadata still says “Documentation for Igris products - Overture and Runtime,” which reintroduces a two-product framing at the app shell level (`web/apps/web-docs-hub/app/layout.tsx`).

### Does the docs set lead with routing/inference?

- Yes, especially in:
  - `web/apps/web-docs-hub/content/docs/index.mdx`
  - `web/apps/web-docs-hub/content/docs/quickstart.mdx`
  - `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx`
  - `web/apps/web-docs-hub/content/docs/semantic-routing.mdx`
  - `web/apps/web-docs-hub/content/docs/speculative-execution.mdx`
  - `web/apps/web-docs-hub/content/docs/articles/thompson-sampling-routing.mdx`

### Introductory pages that mention internal architecture names

- `web/apps/web-docs-hub/app/layout.tsx` mentions Overture and Runtime in site metadata.
- `web/apps/web-docs-hub/content/docs/architecture.mdx` uses “Coordination Layer,” “Runtime,” “Adaptive Router,” “Circuit Breaker,” “Routing Advisor,” “SLO Enforcer,” and “Key Vault.”
- `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` is explicitly Overture-centered.
- `web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx` uses hosted API vs local runtime as the first mental model.

### Alignment against the new positioning

- Aligned:
  - governance / bounded execution (`web/apps/web-docs-hub/content/docs/governance.mdx`, `web/apps/web-docs-hub/content/docs/execution-model.mdx`)
  - signed records / receipts (`web/apps/web-docs-hub/content/docs/execution-receipts.mdx`, `web/apps/web-docs-hub/content/docs/audit.mdx`, `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx`)
  - verification workflow (`web/apps/web-docs-hub/content/docs/receipts-audit-workflow.mdx`)
- Misaligned:
  - front-page emphasis still starts with cloud inference/routing and surface splits instead of Request -> Execute -> Verify (`web/apps/web-docs-hub/content/docs/index.mdx`, `web/apps/web-docs-hub/content/docs/quickstart.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx`)
  - robotics, routing sophistication, speculative execution, and semantic routing are too prominent relative to proof status (`web/apps/web-docs-hub/content/docs/robotics.mdx`, `web/apps/web-docs-hub/content/docs/ros2-integration.mdx`, `web/apps/web-docs-hub/content/docs/speculative-execution.mdx`, `web/apps/web-docs-hub/content/docs/semantic-routing.mdx`)

## Claim audit

Classification rules used here come from the task request and are supported by `UNIFIED_EXECUTION_PROOF.md`, `REAL_PROVIDER_EXECUTION_PROOF.md`, `EXECUTION_EVIDENCE_MATRIX.md`, and `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md`.

| Claim in docs | Primary docs evidence | Classification | Basis | Notes |
| --- | --- | --- | --- | --- |
| Signed execution receipts and hash-linked audit records exist | `web/apps/web-docs-hub/content/docs/execution-receipts.mdx`, `web/apps/web-docs-hub/content/docs/audit.mdx`, `web/apps/web-docs-hub/content/docs/tamper-evident-logs.mdx` | `proven` | `UNIFIED_EXECUTION_PROOF.md`, `EXECUTION_EVIDENCE_MATRIX.md`, `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md` | Proven narrowly in local unified mock flow; strongest proof is runtime-side and mock-provider-based rather than full commercial hosted proof. |
| Governed execution / capability gating exists | `web/apps/web-docs-hub/content/docs/governance.mdx`, `web/apps/web-docs-hub/content/docs/execution-model.mdx`, `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | `proven` | `EXECUTION_EVIDENCE_MATRIX.md`, `UNIFIED_EXECUTION_PROOF.md` | Permission-envelope gating is proven; broader deterministic replay and robotics governance are not. |
| Unified Overture -> Runtime -> receipt flow works | `web/apps/web-docs-hub/content/docs/architecture.mdx`, `web/apps/web-docs-hub/content/docs/execution-receipts.mdx` | `proven` | `UNIFIED_EXECUTION_PROOF.md` | Proven only for the narrow local mock demo path. |
| Real provider-backed unified flow is working | Implied across hosted/cloud docs (`web/apps/web-docs-hub/content/docs/quickstart.mdx`, `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx`) | `source_confirmed_only` | `REAL_PROVIDER_EXECUTION_PROOF.md` | Real-mode demo wiring exists, but no real-provider proof artifact was captured in this environment. |
| Local GGUF fallback is operational and safe to lead with | `web/apps/web-docs-hub/content/docs/local-llm-fallback.mdx`, `web/apps/web-docs-hub/content/docs/quickstart.mdx`, `web/apps/web-docs-hub/content/docs/execution-model.mdx` | `source_confirmed_only` | `EXECUTION_EVIDENCE_MATRIX.md`, `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md` | Code exists, but live fallback proof was not produced. |
| Checkpoint/recovery and long-horizon resumption are working product claims | `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | `source_confirmed_only` | `EXECUTION_EVIDENCE_MATRIX.md`, `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md` | WAL/checkpoint/recovery structures exist; live resume proof was not produced. |
| Fleet registration/download/list are real customer-facing surfaces | `web/apps/web-docs-hub/content/docs/fleet-management.mdx`, `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx`, runtime lifecycle API pages | `source_confirmed_only` | `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md`, `web/apps/web-docs-hub/lib/generated/api-verification.md` | Implemented and documented, but docs are contract-drifted on several required signature fields. |
| Config push / OTA update are shipped fleet capabilities | `web/apps/web-docs-hub/content/docs/fleet-management.mdx`, `web/apps/web-docs-hub/content/docs/robotics.mdx`, runtime lifecycle API pages | `in_development` | `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md` | Overture queues commands, but Runtime still dead-letters several command types. |
| ROS2 integration is a mature public feature | `web/apps/web-docs-hub/content/docs/robotics.mdx`, `web/apps/web-docs-hub/content/docs/ros2-integration.mdx` | `technical_preview` | `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md`, `EXECUTION_EVIDENCE_MATRIX.md` | Source exists behind optional feature gating; default builds are stubbed and no live proof artifact was captured. Docs overstate readiness. |
| Robotics mission execution is a mature primary claim | `web/apps/web-docs-hub/content/docs/robotics.mdx`, `web/apps/web-docs-hub/content/docs/durable-tasks.mdx` | `technical_preview` | `EXECUTION_EVIDENCE_MATRIX.md`, `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md` | Durable-task/BT machinery is real, but live robotics execution and recovery proof is absent. |
| Multimodal inference is functional customer-ready early access | `web/apps/web-docs-hub/content/docs/multimodal.mdx`, multimodal API pages | `stale` | `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md` | Current code path is stub-heavy; docs present a stronger provider-backed story than the audit supports. |
| Semantic / Thompson / adaptive routing is a core public differentiator | `web/apps/web-docs-hub/content/docs/semantic-routing.mdx`, `web/apps/web-docs-hub/content/docs/articles/thompson-sampling-routing.mdx`, `web/apps/web-docs-hub/content/docs/escapevector.mdx` | `source_confirmed_only` | `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md` | Real routing code exists, but proof artifacts are not the strongest part of the product story and docs over-emphasize it. |
| Speculative routing works and improves latency materially | `web/apps/web-docs-hub/content/docs/speculative-execution.mdx`, speculative API pages | `source_confirmed_only` | `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md`, `web/apps/web-docs-hub/lib/generated/api-verification.md` | Endpoints exist; telemetry is best-effort; the “up to 60%” claim is not backed by proof in the audited artifacts. |
| Public proof verification endpoint verifies receipt hash and signature cryptographically | `web/apps/web-docs-hub/content/docs/audit.mdx`, `web/apps/web-docs-hub/content/docs/security.mdx`, `web/apps/web-docs-hub/content/docs/execution-receipts.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/post-proof-receipts-verify.mdx` | `stale` | `CODEBASE_AUDIT_FOR_PRODUCT_REVIEW.md`, build-time contract validation output | The cryptographic core is real, but the public proof route is weaker than the docs imply. |

## Pages most in need of rewrite

| Rank | Page | Why content needs change | Implementation / routing issue |
| --- | --- | --- | --- |
| 1 | `web/apps/web-docs-hub/content/docs/index.mdx` | Leads with Cloud / Edge / Robots instead of Request -> Execute -> Verify. Makes routing/fallback/robotics feel primary. | None blocking. |
| 2 | `web/apps/web-docs-hub/content/docs/quickstart.mdx` | Starts with hosted inference/provider-key setup rather than first governed, verifiable run. Hides proof-status caveats. | None blocking. |
| 3 | `web/apps/web-docs-hub/content/docs/architecture.mdx` | Uses old Overture/Runtime/control-plane mental model and routing subsystem detail as the main intro architecture story. | None blocking. |
| 4 | `web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx` | Frames the API around “two access points” instead of one execution layer with hosted/local execution surfaces. | None blocking. |
| 5 | `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx` | Overture-first framing reinforces inference/routing as the core story. | None blocking. |
| 6 | `web/apps/web-docs-hub/content/docs/fleet-management.mdx` | Promises config push and OTA as current fleet capabilities without enough caveat. | Contract drift with backend request schemas also blocks full build. |
| 7 | `web/apps/web-docs-hub/content/docs/multimodal.mdx` | Overstates feature readiness relative to audited source reality. | Its API pages participate in generated API reference and should be preview-gated more clearly. |
| 8 | `web/apps/web-docs-hub/content/docs/robotics.mdx` | Makes robotics/ROS2/OTA central to product value before proof level is established. | None blocking. |
| 9 | `web/apps/web-docs-hub/content/docs/ros2-integration.mdx` | Presents supported distributions and package flows as mature defaults even though audited source says feature-gated/stubbed by default. | None blocking. |
| 10 | `web/apps/web-docs-hub/content/docs/speculative-execution.mdx` and `web/apps/web-docs-hub/content/docs/semantic-routing.mdx` | Keep the docs story centered on routing sophistication rather than governed execution and receipts. | None blocking. |
| 11 | `web/apps/web-docs-hub/content/docs/audit.mdx` and `web/apps/web-docs-hub/content/docs/execution-receipts.mdx` | Good direction, but they overstate public proof verification semantics and should be restructured into clearer Receipts / Verification / Proof Status pages. | The `POST /proof/receipts/verify` API page is contract-drifted and must be corrected. |
| 12 | `web/apps/web-docs-hub/content/docs/articles/index.mdx` | Article hub still reinforces routing content and has a broken “Back to Documentation” link. | Broken link to `/docs/overview`. |

## Docs build and validation commands

### Commands available

- `pnpm --filter @igris/web-docs-hub dev`
- `pnpm --filter @igris/web-docs-hub build`
- `pnpm --filter @igris/web-docs-hub lint`
- `pnpm --filter @igris/web-docs-hub exec tsc --noEmit`
- `node scripts/validate-docs.js`
- `node scripts/audit-docs-implementation.js --allow-gaps`
- `node scripts/validate-api-contracts.js`
- `node scripts/validate-sdk-snippets.js`
- `node scripts/generate-docs-artifacts.js`
- `node scripts/generate-api-verification-report.js`
- `node scripts/generate-search-index.js`
- `node scripts/validate-public-output.js`
  (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/scripts/`)

### Commands run during this audit

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @igris/web-docs-hub lint` | Passed | ESLint completed with no reported errors. |
| `pnpm --filter @igris/web-docs-hub exec tsc --noEmit` | Passed | TypeScript check completed cleanly. |
| `pnpm --filter @igris/web-docs-hub build` | Failed | Failure happened in `validate-api-contracts.js` before `next build` started. |
| `node scripts/validate-docs.js` | Passed | Audience/nav/leak validation passed. |
| `node scripts/audit-docs-implementation.js --allow-gaps` | Passed | Generated audit with `929` route claims, all marked `implemented`. |
| `pnpm --filter @igris/web-docs-hub exec next build` | Passed | Standalone Next build compiled, generated static pages, and exported successfully. |

### Exact build-failure summary

`pnpm --filter @igris/web-docs-hub build` failed with these contract-validation errors:

- `POST /api/v1/runtime/register`: missing documented request fields `public_key_ed25519`, `timestamp_unix_ms`, `signature`
- `POST /api/v1/runtime/heartbeat`: missing documented request fields `timestamp_unix_ms`, `signature`
- `DELETE /api/v1/runtime/deregister`: missing documented request fields `timestamp_unix_ms`, `signature`
- `POST /proof/receipts/verify`: missing documented request fields `hash`, `signature`
- `POST /proof/receipts/verify`: sample response missing required fields `verified`, `receipt_id`, `verification_status`, `message`

Affected docs pages:

- `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-register.mdx`
- `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/post-api-v1-runtime-heartbeat.mdx`
- `web/apps/web-docs-hub/content/docs/api-reference/runtime-distribution-fleet-coordination/delete-api-v1-runtime-deregister.mdx`
- `web/apps/web-docs-hub/content/docs/api-reference/execution-history-and-receipts/post-proof-receipts-verify.mdx`

Likely cause: generated/public docs examples have drifted behind stricter route request/response contracts in the Go backend (`web/apps/web-docs-hub/scripts/validate-api-contracts.js`, `igris-overture/api/routes_runtime.go`, `igris-overture/api/routes_proof.go`).

## Existing docs quality tooling

| Tool / script | Path | What it does |
| --- | --- | --- |
| Docs audience parsing | `web/apps/web-docs-hub/scripts/docs-audience.js` | Parses frontmatter, enforces audience values, determines build visibility mode via `IGRIS_DOCS_AUDIENCE` / `DOCS_AUDIENCE`. |
| Docs data catalog | `web/apps/web-docs-hub/scripts/docs-data.js` | Central structured source for SDK support, MCP reference, and API sections used by generators. |
| Generate docs artifacts | `web/apps/web-docs-hub/scripts/generate-docs-artifacts.js` | Builds API reference JSON, SDK support JSON, MCP reference JSON, docs audience map, and mirrors visible markdown into `public/markdown`. |
| Generate API reference pages | `web/apps/web-docs-hub/scripts/generate-api-reference-content.js` | Generates API guide/endpoint page content from structured route metadata. |
| API verification report | `web/apps/web-docs-hub/scripts/generate-api-verification-report.js` | Scans repo source/tests/clients and classifies endpoint evidence as `test-covered`, `client-referenced`, or `implemented-unverified`. |
| API contract validator | `web/apps/web-docs-hub/scripts/validate-api-contracts.js` | Compares documented request/response fields against source schemas and generated API page data. |
| SDK snippet validator | `web/apps/web-docs-hub/scripts/validate-sdk-snippets.js` | Extracts code blocks from SDK docs, checks exported symbols/methods, and generates compile examples. |
| Docs validator | `web/apps/web-docs-hub/scripts/validate-docs.js` | Validates audience frontmatter, required generated artifacts, onboarding nav order, public leak patterns, and markdown visibility. |
| Docs implementation audit | `web/apps/web-docs-hub/scripts/audit-docs-implementation.js` | Extracts route claims from docs and checks that they match real Go/Rust route inventory. |
| Search index generator | `web/apps/web-docs-hub/scripts/generate-search-index.js` | Builds search JSON and static search database from docs content and generated API metadata. |
| Public output validator | `web/apps/web-docs-hub/scripts/validate-public-output.js` | Checks exported `out/` and search artifacts for audience leaks and banned internal phrases. |

### Generated reports worth preserving for the next agent

- `web/apps/web-docs-hub/lib/generated/api-verification.md`
- `web/apps/web-docs-hub/lib/generated/api-contract-validation.md`
- `web/apps/web-docs-hub/lib/generated/docs-implementation-audit.md`

## Visual/design implementation

### Page/layout components

- Root shell: `web/apps/web-docs-hub/app/layout.tsx`
- Docs layout: `web/apps/web-docs-hub/app/docs/layout.tsx`
- Docs page renderer: `web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`
- Shared nav options: `web/apps/web-docs-hub/lib/layout.shared.ts`

### Theme / dark mode

- Theme is handled through `fumadocs-ui/provider/next` RootProvider with:
  - theme enabled
  - `attribute: 'class'`
  - `defaultTheme: 'dark'`
  - `enableSystem: false`
  (`web/apps/web-docs-hub/app/layout.tsx`)
- CSS imports `fumadocs-ui/css/neutral.css` and `fumadocs-ui/css/preset.css`, with custom sizing and docs typography overrides in `app/globals.css` (`web/apps/web-docs-hub/app/globals.css`).

### MDX component surface

- `web/apps/web-docs-hub/components/mdx.tsx` registers:
  - custom code blocks via `CodeBlock` / `Pre`
  - headings
  - zoomable images
  - tabs
  - steps
  - type tables
  - inline TOC
  - files/folders
  - `CopyAgentPrompt`
  - `SdkSupportMatrix`

### Code blocks

- Code blocks are rendered through `fumadocs-ui/components/codeblock` with custom sizing classes (`web/apps/web-docs-hub/components/mdx.tsx`, `web/apps/web-docs-hub/app/globals.css`).

### Callouts / admonitions

- A custom callout component exists at `web/apps/web-docs-hub/components/Callout.tsx`.
- MDX component registration in `components/mdx.tsx` does not explicitly add the custom `Info`/`Warning`/`Tip` exports, so future content rewrites should either stay on Fumadocs-native patterns or make custom callout wiring explicit before depending on it heavily (`web/apps/web-docs-hub/components/Callout.tsx`, `web/apps/web-docs-hub/components/mdx.tsx`).

### Other components that affect content authoring

- Search dialog: `web/apps/web-docs-hub/components/docs-search-dialog.tsx`
- Reference dropdown: `web/apps/web-docs-hub/components/reference-menu.tsx`
- Page action menu (GitHub / Markdown / external assistant links): `web/apps/web-docs-hub/components/docs-page-actions.tsx`
- SDK support cards: `web/apps/web-docs-hub/components/docs/SdkSupportMatrix.tsx`
- Copy prompt callout: `web/apps/web-docs-hub/components/docs/CopyAgentPrompt.tsx`

### Mermaid / diagrams

- A Mermaid renderer component exists at `web/apps/web-docs-hub/components/MermaidChart.tsx`, loaded from jsDelivr at runtime.
- Current docs content appears to show Mermaid source inside tabs rather than using `<MermaidChart>` directly (`web/apps/web-docs-hub/components/MermaidChart.tsx`, `web/apps/web-docs-hub/content/docs/architecture.mdx`).

## Deployment configuration

### What is visible in source

- Static export enabled: `output: 'export'` (`web/apps/web-docs-hub/next.config.mjs`)
- Images are unoptimized (`web/apps/web-docs-hub/next.config.mjs`)
- No `vercel.json` exists in `web/apps/web-docs-hub/`
- No `basePath`, `metadataBase`, or canonical URL config is set in `app/layout.tsx`

### Hardcoded domain and repo assumptions

- Hosted API base URL is hardcoded widely as `https://overture.igrisinertial.com` in docs content and generated API pages (`web/apps/web-docs-hub/content/docs/quickstart.mdx`, `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx`, `web/apps/web-docs-hub/lib/api-reference-page-data.ts`, `web/apps/web-docs-hub/scripts/generate-api-reference-content.js`).
- Console URLs are hardcoded as `https://console.igrisinertial.com` in several pages (`web/apps/web-docs-hub/content/docs/quickstart.mdx`, `web/apps/web-docs-hub/content/docs/pricing-tiers.mdx`, `web/apps/web-docs-hub/content/docs/console.mdx`).
- GitHub source links are hardcoded to `https://github.com/wiramahendra/Schlep-engine` on branch `main` (`web/apps/web-docs-hub/lib/docs-source.ts`, `web/apps/web-docs-hub/lib/layout.shared.ts`).

### Environment variables

#### Docs app build/runtime behavior

- `IGRIS_DOCS_AUDIENCE`
- `DOCS_AUDIENCE`

These control which pages are visible/generated in a build (`web/apps/web-docs-hub/lib/docs-audience.ts`, `web/apps/web-docs-hub/scripts/docs-audience.js`).

#### User-facing example/config variables referenced in docs

- `IGRIS_API_KEY`
- `IGRIS_RUNTIME_API_KEY`
- `IGRIS_SESSION_TOKEN`
- `IGRIS_LICENSE_KEY`
- `IGRIS_BASE_URL`

These appear in examples and generated snippet validation, but they are not required for the docs site to render itself (`web/apps/web-docs-hub/content/docs/quickstart.mdx`, `web/apps/web-docs-hub/lib/api-reference-page-data.ts`, `web/apps/web-docs-hub/scripts/validate-sdk-snippets.js`).

## Recommended new docs IA

### Proposed structure aligned to the new positioning

- `Getting Started`
  - `Overview`
  - `Quickstart`
  - `First Verified Run` (new)
  - `SDKs`
  - `Hosted vs Local vs Hybrid` (merge/refactor from current deploy/hybrid/cloud intros)
- `Core Concepts`
  - `Request -> Execute -> Verify` (new)
  - `Governed Execution`
  - `Failure Paths` (new)
  - `Execution Events` (new)
  - `Receipts`
  - `Verification`
  - `Capability Bounds`
- `Guides`
  - `First Hosted Integration` (rename from `First Cloud Integration`)
  - `Deploy Local Runtime`
  - `Hybrid Deployment Workflow`
  - `Receipts and Audit Workflow`
  - `Durable Task Operations` (new, distilled from current durable tasks/history/governance pages)
- `API Reference`
  - `Introduction`
  - `Authentication`
  - `Errors`
  - `Rate Limits`
  - `Hosted API`
  - `Runtime Lifecycle`
  - `Receipts & Proof`
  - `Durable Tasks`
  - `Local Runtime`
  - `MCP`
- `Architecture`
  - `Architecture`
  - `Deployment`
  - `Security`
  - `Identity & Access`
- `Advanced`
  - `Agents`
  - `Context Engineering`
  - `Behavior Trees`
  - `Tools`
  - `Memory`
  - `MCP`
  - `Policy`
  - `Provider Health`
  - `Circuit Breaker`
  - `Shadow Mode`
- `Proof Status`
  - `Unified Execution Proof`
  - `Real Provider Proof Status`
  - `Execution Evidence Matrix`
  - `Known Gaps / Caveats`

### Existing-page mapping

| Current page(s) | Proposed action |
| --- | --- |
| `index.mdx` | Rewrite around one execution layer and Request -> Execute -> Verify. |
| `quickstart.mdx` | Rewrite around first verified run, then hosted/local/hybrid paths. |
| `first-cloud-integration.mdx` | Rename to `First Hosted Integration`; keep as secondary path. |
| `execution-model.mdx`, `execution-flow.mdx`, `governance.mdx` | Merge/reframe into clearer core-concept sequence. |
| `execution-receipts.mdx`, `audit.mdx`, `tamper-evident-logs.mdx`, `receipts-audit-workflow.mdx` | Merge into `Receipts`, `Verification`, and `Receipts and Audit Workflow`. |
| `history.mdx` | Reframe as `Execution Events` or `History & Events`; move out of proof language. |
| `cloud-coordination.mdx` | Rename to `Hosted Control Plane` or absorb into architecture/deployment. |
| `fleet-management.mdx`, `fleet-rollout-workflow.mdx` | Keep, but demote behind proof-status caveats until config push/OTA claims are tighter. |
| `robotics.mdx`, `ros2-integration.mdx`, `multimodal.mdx` | Move out of primary nav or label explicitly as preview / proof-limited. |
| `semantic-routing.mdx`, `speculative-execution.mdx`, `articles/thompson-sampling-routing.mdx` | Demote from primary story; keep as advanced or archive until proof status is clearer. |
| `documentation-roadmap.mdx` | Keep internal only. |

### Pages to create

- `First Verified Run`
- `Request -> Execute -> Verify`
- `Failure Paths`
- `Execution Events`
- `Verification`
- `Proof Status`

### Pages to archive or hide from primary nav

- `robotics.mdx`
- `ros2-integration.mdx`
- `multimodal.mdx`
- `speculative-execution.mdx`
- `semantic-routing.mdx`
- `articles/thompson-sampling-routing.mdx`

## Rewrite plan for next agent

### Phase 1: Core story rewrite

Target pages:

- `Overview`
- `Quickstart`
- `First Verified Run` (new)
- `Receipts`
- `Verification` (new)
- `Proof Status` (new)
- `Architecture`

Phase-1 acceptance criteria:

- Front-page docs lead with governed, verifiable execution rather than hosted inference/routing.
- The main mental model is explicitly `Request -> Execute -> Verify`.
- Every high-level claim on those pages is either:
  - directly proven by current artifacts, or
  - clearly labeled as preview / source-confirmed / in development.
- Overture/Runtime internal naming is removed from first-contact messaging unless required for a concrete API/runtime distinction.
- Receipts, verification, signed records, failure visibility, and execution events are made central.

### Phase 2: API and workflow reshaping

- Rewrite `cloud-coordination.mdx`, `first-cloud-integration.mdx`, `deploy-local-runtime.mdx`, `hybrid-deployment-workflow.mdx`, `fleet-management.mdx`.
- Update API-reference intro and receipts/proof pages to match current contract behavior.
- Fix runtime lifecycle API pages and proof verify API page so `pnpm build` passes again.

### Phase 3: Reduce overclaiming

- Re-label or demote robotics, ROS2, multimodal, speculative, semantic-routing, and OTA/config-push content.
- Move proof-limited pages under `Advanced` or `Proof Status` if they remain public.

### Phase 4: Validation pass

- Re-run:
  - `pnpm --filter @igris/web-docs-hub lint`
  - `pnpm --filter @igris/web-docs-hub exec tsc --noEmit`
  - `pnpm --filter @igris/web-docs-hub build`
- Confirm no broken `/docs/...` links remain.
- Confirm `public/markdown` and search artifacts still generate correctly.

## Open questions

### Questions requiring human confirmation

- Should public docs continue to use `Overture` and `Runtime` as public nouns, or should they be reduced to hosted/local execution surfaces?
- Is robotics / ROS2 still a public-nav feature area, or should it move behind preview/proof labeling?
- Should `multimodal` remain public-nav material before provider-backed proof is stronger?
- Should `semantic routing`, `Thompson sampling`, and `speculative execution` remain primary-doc concepts or move to advanced/operator content?
- Is `GET /proof/receipts` intended to remain a public docs concept, or should the receipt story standardize on `/v1/receipts*` + explicit proof caveats?

### Claims requiring additional proof before promotion

- Real provider-backed unified hosted/local verified execution
- Local GGUF fallback under failure
- Checkpoint/recovery and long-horizon resume
- Multi-runtime fleet failover
- Config push / OTA execution end to end
- ROS2 runtime execution and recovery
- Multimodal provider-backed execution
- Public proof verification semantics strong enough to market as cryptographic verification

## Bottom line

The docs implementation is real, well-instrumented, and unusually disciplined for a product docs app. The weak point is not the app shell. The weak point is product-story drift plus a subset of API-reference pages that no longer match backend contracts. The next agent should treat `web/apps/web-docs-hub` as the single source of docs implementation truth, keep the build/static-export model intact, rewrite the public story around Request -> Execute -> Verify, and fix the contract-drift pages before attempting broader IA surgery (`web/apps/web-docs-hub/package.json`, `web/apps/web-docs-hub/next.config.mjs`, `web/apps/web-docs-hub/content/docs/index.mdx`, `web/apps/web-docs-hub/content/docs/quickstart.mdx`, `web/apps/web-docs-hub/content/docs/api-reference/introduction.mdx`, `web/apps/web-docs-hub/scripts/validate-api-contracts.js`).
