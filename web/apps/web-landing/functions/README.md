# Cloudflare Pages Functions

This directory contains Cloudflare Pages Functions that run on Cloudflare's edge network.

## `/api/early-access.ts`

Handles early access form submissions. This replaces the Next.js API route when deployed to Cloudflare Pages.

### Local Development

The Next.js API route (`app/api/early-access/route.ts`) is used during local development.

### Production (Cloudflare Pages)

This function runs on Cloudflare's edge network and stores submissions in Cloudflare KV (if configured).

### Setup Cloudflare KV (Optional)

To persist form submissions:

1. Create a KV namespace in Cloudflare dashboard
2. Bind it in Pages settings as `EARLY_ACCESS_KV`

Without KV, submissions will be logged to console (viewable in Cloudflare dashboard).

## Learn More

- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
