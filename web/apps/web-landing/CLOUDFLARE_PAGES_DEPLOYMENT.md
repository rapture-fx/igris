# Cloudflare Pages Deployment Guide

This guide covers deploying the Igris web-landing application to Cloudflare Pages.

## Prerequisites

- Cloudflare account with Pages access
- GitHub repository connected to Cloudflare Pages
- Node.js 20.x (specified in `.node-version` files)

## Project Configuration

### Next.js Version
- **Next.js**: 15.5.9
- **React**: 18.3.1
- **React DOM**: 18.3.1

### Key Configuration Files

#### `.node-version` Files
Node.js version files have been added at multiple levels to ensure Cloudflare uses the correct Node version:
- `/Users/wira/Desktop/system/.node-version`
- `/Users/wira/Desktop/system/web/.node-version`
- `/Users/wira/Desktop/system/web/apps/web-landing/.node-version`

All specify: `20.19.5`

#### `next.config.js`
```javascript
const path = require('path');

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Required for Cloudflare Pages
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

module.exports = nextConfig
```

## Cloudflare Pages Configuration

### Method 1: GitHub Integration (Recommended)

1. **Connect Repository to Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to Pages → Create a project
   - Connect your GitHub account
   - Select your repository: `Igris-inertial/system`

2. **Configure Build Settings**
   ```yaml
   Framework preset: Next.js
   Branch: main
   Root directory: web
   Build command: cd apps/web-landing && pnpm build
   Build output directory: apps/web-landing/out
   ```

3. **Environment Variables** (if needed)
   ```bash
   NODE_VERSION=20.19.5
   PNPM_VERSION=8.15.0
   ```

4. **Advanced Settings**
   - **Node.js version**: Auto-detected from `.node-version` (20.19.5)
   - **Build timeout**: 20 minutes (default should be sufficient)

### Method 2: Direct Upload via Wrangler CLI

If you prefer manual deployment:

1. **Install Wrangler** (if not already installed)
   ```bash
   npm install -g wrangler
   ```

2. **Authenticate**
   ```bash
   wrangler login
   ```

3. **Build the project**
   ```bash
   cd /Users/wira/Desktop/system/web/apps/web-landing
   pnpm build
   ```

4. **Deploy**
   ```bash
   wrangler pages deploy out --project-name=igris-web-landing
   ```
   (`wrangler.toml` in this directory carries the project name and output
   dir, so a bare `wrangler pages deploy` from here also works. Do NOT move
   that file up to `web/` — `web` is the shared Pages Root directory of the
   landing AND docs projects, and a wrangler.toml there overrides the
   dashboard build output directory for both; this broke docs deploys in
   Jun 2026. CI blocks it via `pages-config-guard` in
   `.github/workflows/docs-quality.yml`.)

## Build Process Details

### What Happens During Build

1. **Dependency Installation**
   - pnpm installs all workspace dependencies
   - Uses pnpm workspace protocol for monorepo packages

2. **Next.js Build**
   - Compiles TypeScript (errors ignored for deployment)
   - Skips ESLint (errors ignored for deployment)
   - Generates static pages (16 static routes)
   - Creates API routes (2 dynamic routes)

3. **Output Structure**
   ```
   out/
   ├── static/          # Static assets
   ├── _next/           # Next.js client chunks
   └── index.html       # Static export entry point
   ```

### Build Output Summary
```
Route (app)                                 Size  First Load JS
┌ ○ /                                    5.79 kB         121 kB
├ ○ /_not-found                            131 B         102 kB
├ ƒ /api/early-access                      131 B         102 kB
├ ƒ /api/test                              131 B         102 kB
├ ○ /cookies                               957 B         116 kB
├ ○ /dpa                                 1.74 kB         117 kB
├ ○ /explorer                               4 kB         106 kB
├ ○ /jobs                                4.49 kB         106 kB
├ ○ /overture                            5.34 kB         120 kB
├ ○ /pricing                             4.38 kB         119 kB
├ ○ /privacy                             1.51 kB         116 kB
├ ○ /runtime                             3.45 kB         118 kB
├ ○ /terms                               7.64 kB         123 kB
├ ○ /terms/cancellation-policy           1.36 kB         116 kB
├ ○ /terms/refund-policy                 1.54 kB         116 kB
└ ○ /tools                               6.35 kB         108 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

## Troubleshooting

### Common Issues

#### 1. Node.js Version Mismatch
**Error**: `yargs-parser` or other dependency errors
**Solution**: Ensure `.node-version` files are committed and Cloudflare detects Node 20+

#### 2. Workspace Dependencies Not Found
**Error**: Cannot find module `@igris-inertial/config`
**Solution**: Ensure `Root directory` is set to `web`, so Cloudflare uses the workspace lockfile at `web/pnpm-lock.yaml`.

#### 3. Build Timeout
**Error**: Build exceeds time limit
**Solution**: Increase build timeout in Cloudflare Pages settings

#### 4. API Routes Not Working
**Issue**: API routes return 404
**Note**: API routes (`/api/early-access`, `/api/test`) require Cloudflare Pages Functions
- Place API routes in `functions/api/` directory, OR
- Use environment variable bindings if the routes need D1 or other Cloudflare services

## API Routes Configuration

The landing page includes two API routes that previously used Edge Runtime:

### `/api/early-access`
- Removed `export const runtime = 'edge'` declaration
- Now runs as standard Next.js API route
- **Note**: If this route needs Cloudflare D1 database access, you'll need to:
  1. Configure D1 binding in Cloudflare dashboard
  2. Migrate route to Cloudflare Pages Functions

### `/api/test`
- Removed `export const runtime = 'edge'` declaration
- Simple health check endpoint

## Deployment Checklist

- [ ] Commit all changes to Git
- [ ] Push changes to GitHub `main` branch
- [ ] Connect repository to Cloudflare Pages
- [ ] Configure build settings (see above)
- [ ] Verify Node.js version is detected correctly
- [ ] Trigger first deployment
- [ ] Test deployed site
- [ ] Configure custom domain (if needed)
- [ ] Set up environment variables (if needed)

## Post-Deployment

### Custom Domain Setup
1. Go to Cloudflare Pages → Your Project → Custom domains
2. Add your domain
3. Update DNS records as instructed

### Environment Variables
Add via Cloudflare Dashboard → Pages → Settings → Environment variables

### Monitoring
- View deployment logs in Cloudflare dashboard
- Set up error tracking (e.g., Sentry) if needed

## Performance Optimization

Cloudflare Pages automatically provides:
- ✅ Global CDN distribution
- ✅ HTTP/3 and QUIC support
- ✅ Automatic HTTPS
- ✅ Brotli compression
- ✅ HTTP/2 Server Push
- ✅ DDoS protection

## Support

For issues specific to:
- **Cloudflare Pages**: [Cloudflare Community](https://community.cloudflare.com/)
- **Next.js on Cloudflare**: [Next.js Docs](https://nextjs.org/docs/deployment#cloudflare-pages)
- **Project Issues**: Open issue in GitHub repository

---

**Last Updated**: December 17, 2025
**Next.js Version**: 15.5.9
**Node.js Version**: 20.19.5
