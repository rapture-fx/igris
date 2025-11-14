# Schlep Engine Landing Page - Deployment Guide

## Local Development

### Option 1: Standard Next.js Development (Recommended for development)
```bash
cd /Users/wira/Desktop/schlep-engine/web/apps/web-landing
pnpm dev
```
- URL: http://localhost:3000
- Hot reload enabled
- Best for rapid development
- Note: API routes will work but won't have Cloudflare KV storage (will log errors but continue)

### Option 2: Cloudflare Pages Preview (Recommended for staging/testing)
```bash
# First, build the project
pnpm pages:build

# Then start the Cloudflare Pages local server
pnpm wrangler pages dev .vercel/output/static --port 8788
```
- URL: http://localhost:8788
- Tests the actual Cloudflare environment locally
- Includes KV storage emulation
- Simulates production behavior

## Deployment Environments

### Local Development
- **Command**: `pnpm dev`
- **URL**: http://localhost:3000
- **Purpose**: Rapid development with hot reload

### Staging (Cloudflare Pages Preview)
- **Command**: `pnpm wrangler pages dev .vercel/output/static`
- **URL**: http://localhost:8788
- **Purpose**: Test in Cloudflare environment before deploying

### Production (Cloudflare Pages)
- **Deploy**: Push to main branch or use `wrangler pages deploy`
- **URL**: Your Cloudflare Pages URL
- **Purpose**: Live production site

## Cloudflare Pages Configuration

### 1. Build Settings (in Cloudflare Dashboard)

```
Build command: pnpm pages:build
Build output directory: .vercel/output/static
Root directory: web/apps/web-landing
Node version: 18 or higher
```

### 2. Environment Variables (Optional)

No environment variables are strictly required for the basic site. Add these if you need additional features:

```
# Add any custom environment variables here
```

### 3. KV Namespace Setup (Required for Early Access API)

#### Create Production KV Namespace:
```bash
# From the landing page directory
pnpm wrangler kv:namespace create "EARLY_ACCESS_KV" --preview false
```

This will output something like:
```
🌀 Creating namespace with title "schlep-engine-landing-EARLY_ACCESS_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "EARLY_ACCESS_KV", id = "abc123xyz456" }
```

#### Update wrangler.toml:
1. Copy the `id` from the output above
2. Edit `wrangler.toml`:
```toml
[env.production]
[[env.production.kv_namespaces]]
binding = "EARLY_ACCESS_KV"
id = "abc123xyz456"  # Replace with your actual ID
```

#### Or Configure in Cloudflare Dashboard:
1. Go to your Cloudflare Pages project
2. Navigate to **Settings** > **Functions** > **KV namespace bindings**
3. Add binding:
   - Variable name: `EARLY_ACCESS_KV`
   - KV namespace: Create new or select existing

### 4. Compatibility Flags (Already configured in wrangler.toml)

The following flags are set in `wrangler.toml`:
```toml
compatibility_flags = ["nodejs_compat"]
```

This enables Node.js compatibility for Next.js features.

## Architecture

### Static Routes
All pages are pre-rendered as static HTML:
- `/` - Home page
- `/pricing` - Pricing page
- `/explorer` - Explorer page
- `/tools` - Tools page
- `/jobs` - Jobs page
- `/api` - API documentation page

### Dynamic Routes (Cloudflare Pages Functions)
- `/api/early-access` - Early access signup API (POST)
  - Located at: `functions/api/early-access.ts`
  - Uses Cloudflare KV for storage
  - Runs on Cloudflare's Edge network

## Common Issues & Solutions

### Issue: "pnpm dev" not working
**Solution**: It should work! If not, try:
```bash
rm -rf .next node_modules
pnpm install
pnpm dev
```

### Issue: API routes don't work locally
**Solution**:
- For development: Use `pnpm dev` (API will work but won't persist to KV)
- For testing with KV: Use `pnpm wrangler pages dev .vercel/output/static`

### Issue: Build fails with Edge Runtime error
**Solution**: Make sure you removed the Next.js API route at `app/api/early-access/route.ts`. Only the Cloudflare Pages Function at `functions/api/early-access.ts` should exist.

### Issue: Images not loading
**Solution**: The `next.config.js` has `images.unoptimized = true` which is required for Cloudflare. Images should work in both dev and production.

### Issue: nodejs_compat warnings in local preview
**Solution**: Already fixed in `wrangler.toml` with `compatibility_flags = ["nodejs_compat"]`

## Quick Commands Reference

```bash
# Development
pnpm dev                                    # Start Next.js dev server (localhost:3000)

# Build
pnpm build                                  # Standard Next.js build
pnpm pages:build                            # Build for Cloudflare Pages

# Preview/Staging
pnpm wrangler pages dev .vercel/output/static  # Test Cloudflare environment locally

# Deploy
pnpm wrangler pages deploy .vercel/output/static  # Deploy to Cloudflare Pages
# OR: Push to main branch (if connected to Git)

# KV Management
pnpm wrangler kv:namespace create "EARLY_ACCESS_KV" --preview false  # Create production KV
pnpm wrangler kv:namespace list                                      # List all KV namespaces
pnpm wrangler kv:key list --binding=EARLY_ACCESS_KV                 # List keys in KV
pnpm wrangler kv:key get "submission:123" --binding=EARLY_ACCESS_KV # Get specific value
```

## File Structure

```
web/apps/web-landing/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home page
│   ├── pricing/page.tsx          # Pricing page
│   └── ...
├── functions/                    # Cloudflare Pages Functions
│   └── api/
│       └── early-access.ts       # Early access API (Cloudflare Function)
├── public/                       # Static assets
├── src/                          # Components and utilities
├── next.config.js                # Next.js configuration
├── wrangler.toml                 # Cloudflare configuration
└── package.json                  # Dependencies and scripts
```

## Notes

- **Removed `output: 'export'`** from `next.config.js` to enable server-side features
- **Cloudflare Pages Functions** replace Next.js API routes for production
- **KV Storage** is used instead of file system for data persistence
- **All static pages** are pre-rendered for optimal performance
