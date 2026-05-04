# Igris Inertial

Igris is one execution system for AI tasks you can verify.

The product model is:

1. Request
2. Execute
3. Verify

You send one request through a consistent API surface. Igris applies execution boundaries, records execution events, produces signed records, and returns verification-ready receipts for runs that need governance and post-run inspection.

## Deployment Modes

Igris can run in different execution surfaces without changing the product story:

- Hosted: provider-backed execution through the control plane
- Local: execution closer to where work happens
- Hybrid: hosted coordination with local execution where needed

These are deployment modes of one system, not separate products.

## Proof Status

The current public docs distinguish between:

- Proven locally
- Source-confirmed
- Technical preview
- In development / not yet proven

Use [Proof Status](./web/apps/web-docs-hub/content/docs/proof-status.mdx) and [First Verified Run](./web/apps/web-docs-hub/content/docs/first-verified-run.mdx) as the source of truth for what is demonstrated today.

Areas such as real-provider proof, local fallback, checkpoint recovery, fleet failover, robotics, ROS2, and multimodal execution should be treated according to those labels rather than assumed production-ready.

## Start Here

- Docs app: [web/apps/web-docs-hub](./web/apps/web-docs-hub)
- Docs overview: [web/apps/web-docs-hub/content/docs/index.mdx](./web/apps/web-docs-hub/content/docs/index.mdx)
- Quick start: [web/apps/web-docs-hub/content/docs/quickstart.mdx](./web/apps/web-docs-hub/content/docs/quickstart.mdx)
- First verified run: [web/apps/web-docs-hub/content/docs/first-verified-run.mdx](./web/apps/web-docs-hub/content/docs/first-verified-run.mdx)
- Request -> Execute -> Verify: [web/apps/web-docs-hub/content/docs/request-execute-verify.mdx](./web/apps/web-docs-hub/content/docs/request-execute-verify.mdx)
- Verification: [web/apps/web-docs-hub/content/docs/verification.mdx](./web/apps/web-docs-hub/content/docs/verification.mdx)

## Repository Layout

- `igris-overture/`: control-plane and API implementation
- `igris-runtime/`: runtime implementation for local execution surfaces
- `web/apps/web-docs-hub/`: public documentation site
- `web/apps/web-landing/`: marketing and product website
- `web/apps/web-console/`: operator console for execution runs, events, signed records, and environment visibility
- `rust-core/`: lower-level runtime and routing support code where applicable

## Architecture Context

Internal component names still exist in the codebase, but they are implementation details:

- the control plane coordinates hosted and hybrid execution workflows
- the runtime executes work in local environments
- the docs, landing site, and console explain and operate the same unified execution system

For the current architecture explanation, start with [Architecture](./web/apps/web-docs-hub/content/docs/architecture.mdx) instead of older multi-product descriptions.

## Validation

The docs app already includes validation and build checks:

```bash
pnpm --filter @igris/web-docs-hub lint
pnpm --filter @igris/web-docs-hub exec tsc --noEmit
pnpm --filter @igris/web-docs-hub build
```

## License

See the repository license and product-specific terms where applicable.
