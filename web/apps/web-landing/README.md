# Igris Landing Site

This app contains the public marketing site for Igris Inertial.

The landing narrative should stay aligned with the core product story:

- Igris is one execution system for AI tasks you can verify
- the product model is Request -> Execute -> Verify
- hosted, local, and hybrid are deployment modes or execution surfaces
- preview-heavy areas such as robotics, ROS2, and multimodal must stay clearly caveated

## Purpose

The landing site introduces:

- why direct model calls are insufficient once AI starts doing work
- how Igris governs execution, captures events, and returns signed records
- where operators inspect runs, environments, and verification status
- how teams choose hosted, local, or hybrid deployment modes

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
pnpm start
```

## Deployment

This app is configured for Cloudflare Pages. See [CLOUDFLARE_PAGES_DEPLOYMENT.md](./CLOUDFLARE_PAGES_DEPLOYMENT.md) for deployment details.

## Copy Guidance

When updating this app:

- lead with governed, verifiable execution
- keep routing details as supporting implementation detail
- do not sell unproven advanced surfaces as default capabilities
- link preview-heavy areas back to proof-status language in the docs when needed
