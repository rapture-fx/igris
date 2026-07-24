# Product surface reconciliation

Date: 2026-07-24

Product truth: `docs/product/PRD.md`

Model: **Action → Run → Proof**, with exceptional **Reconciliation**

## Executive result

The highest-traffic repository surfaces have been reconciled to the PRD:

- root README;
- landing hero, navigation, footer, machine-readable copy, setup prompt, and
  proof/failure illustration;
- docs homepage, navigation, managed Python quickstart, deploy-staging
  tutorial, Reconciliation guide, and Action Protocol positioning; and
- Python SDK README and durable Action quickstart.

The repository still contains a broad historical documentation and UI surface.
Those pages were not deleted or rewritten wholesale. They are classified below
so follow-up can remain product-scoped.

## MUST_FIX_BEFORE_ALPHA

| Surface | Status | Files | Direction |
|---|---|---|---|
| Canonical product definition | fixed | `docs/product/PRD.md` | Product definition, wedge, vocabulary, claim boundaries, allowed/frozen work, and change control. |
| Root first contact | fixed | `README.md` | Lead with coding-agent deploy/migrate/publish Actions and the managed Python flow; state install truth. |
| Landing first contact | fixed in repository; deployment pending | `web/apps/web-landing/src/components/sections/Vision.tsx`, `VisionChangesPanel.tsx`, `Header.tsx`, `Footer.tsx`, `app/layout.tsx` | Lead with consequential coding-agent actions and Action → Run → Proof. Show the Python facade, block blind replay, and state Proof limits. |
| Landing machine/agent copy | fixed in repository; deployment pending | `web/apps/web-landing/public/llms.txt`, `src/lib/coding-agent-prompt.ts`, `src/lib/docs-urls.ts` | Keep generated agent instructions on `deploy.staging`, stable idempotency, Reconciliation, and honest Proof. |
| Docs homepage/navigation | fixed | `web/apps/web-docs-hub/content/docs/index.mdx`, `meta.json` | Put managed Python, deploy staging, Reconciliation, Proof, and REST first. Move internal/legacy topics under Advanced. |
| Managed quickstart | fixed | `web/apps/web-docs-hub/content/docs/quickstart.mdx`, `sdk/python/docs/durable-action-quickstart.md` | Separate one-time configuration from ordinary Run; document public HTTPS target policy and SDK contract identity. |
| Initial wedge tutorial | fixed | `web/apps/web-docs-hub/content/docs/deploy-staging.mdx` | Target allowlist, target credentials, target-side idempotency, approval, uncertain effect, and promotion boundary. |
| Reconciliation | fixed in docs; console UI pending | `web/apps/web-docs-hub/content/docs/reconciliation.mdx` | Exceptional, attributable, non-cryptographic operator assertion. |
| Python install claim | fixed | `README.md`, `sdk/python/README.md`, quickstarts | `igris-sdk` is not on PyPI; `igris` is unrelated. Use checkout or operator-provided wheel only. |
| Live landing/docs deployment | not fixed | external deployment | The public landing still serves pre-PRD copy. Merge and deploy pinned artifacts before inviting the first user. |
| Hosted endpoint reachability | not fixed | external infrastructure | External probes could not establish API/auth/console/docs reachability. Resolve DNS/ingress and repeat live smoke. |

## FIX_LATER

These surfaces are real but distract from the alpha wedge or contain old
Request/Execute/Verify, Run/Recover/Prove, multi-product, or broad platform
positioning. Keep them out of first-contact navigation until reconciled:

- `web/apps/web-docs-hub/content/docs/request-execute-verify.mdx`
- `web/apps/web-docs-hub/content/docs/first-verified-run.mdx`
- `web/apps/web-docs-hub/content/docs/first-tenant-action.mdx`
- `web/apps/web-docs-hub/content/docs/first-agent-onboarding.mdx`
- `web/apps/web-docs-hub/content/docs/install.mdx`
- `web/apps/web-docs-hub/content/docs/sdk.mdx`
- `web/apps/web-docs-hub/content/docs/sdk-integration-patterns.mdx`
- `web/apps/web-docs-hub/content/docs/mcp.mdx`
- `web/apps/web-docs-hub/content/docs/mcp-server.mdx`
- `web/apps/web-docs-hub/content/docs/mcp-integration-patterns.mdx`
- `web/apps/web-docs-hub/content/docs/console.mdx`
- `web/apps/web-landing/app/use-cases/page.tsx`
- `web/apps/web-landing/app/ai-agents/page.tsx`
- `web/apps/web-landing/app/machine/page.tsx`
- `web/apps/web-landing/src/components/popups/UseCasesPopup.tsx`
- `web/apps/web-landing/src/lib/faq.ts`
- `web/apps/rails-console/app/views/home/index.html.erb`
- `web/apps/rails-console/app/views/overview/index.html.erb`
- `web/apps/rails-console/app/views/shared/_icon_rail.html.erb`

Recommended copy direction: describe what the engineer controls—Action
configuration, one Run, approval, uncertainty, and Proof—rather than routing,
fleet, governance, or internal execution machinery. MCP and CLI pages should
state that they adapt the canonical REST product.

## KEEP_AS_ADVANCED

These surfaces may remain because they describe implementation, operations, or
ratified interoperability. They must remain labeled advanced/internal and must
not become first-step onboarding:

- `web/apps/web-docs-hub/content/docs/action-protocol.mdx`
- `web/apps/web-docs-hub/content/docs/architecture.mdx`
- `web/apps/web-docs-hub/content/docs/deploy-local-runtime.mdx`
- `web/apps/web-docs-hub/content/docs/hybrid-deployment-workflow.mdx`
- `web/apps/web-docs-hub/content/docs/cloud-coordination.mdx`
- `web/apps/web-docs-hub/content/docs/fleet-management.mdx`
- `web/apps/web-docs-hub/content/docs/fleet-rollout-workflow.mdx`
- `web/apps/web-docs-hub/content/docs/robotics.mdx`
- `web/apps/web-docs-hub/content/docs/ros2-integration.mdx`
- `web/apps/web-docs-hub/content/docs/local-llm-fallback.mdx`
- `web/apps/web-docs-hub/content/docs/multimodal.mdx`
- endpoint-level generated API reference for Runtime/fleet/robotics routes;
- `docs/rfcs/**`, `docs/adr/**`, conformance fixtures, and protocol release
  records; and
- contributor/operator runbooks that explicitly name Overture, Runtime, WAL,
  checkpoints, bindings, and receipts.

## Console scope classification

### ALPHA_REQUIRED

- authenticated account/session;
- named API-key list, read-once creation, and tenant-scoped revocation;
- Action list/detail and one-time setup assistance;
- Run list/detail, approval/rejection, and honest Proof summary; and
- Reconciliation read/append for uncertain effects.

API-key endpoints and console controllers already exist. Runs and approval
already exist. A Reconciliation console route/view does not currently exist,
so the first user needs an operator/API procedure until that minimal UI is
implemented.

### LATER

- agents/catalog/adoption pages;
- evaluations, recommendations, proposals, and broad governance;
- connections and Runtime-management convenience; and
- analytics/metrics views.

### OUT_OF_SCOPE

- runtime fleet dashboard;
- workflow builder;
- protocol explorer;
- marketplace;
- robotics UI; and
- broad executive dashboard.

No console implementation was changed in this reconciliation.
