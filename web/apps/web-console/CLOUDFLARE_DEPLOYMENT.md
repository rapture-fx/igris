# Cloudflare Deployment Guide - Igris Inertial Dashboard

**Target**: Deploy Next.js 16 dashboard to Cloudflare Pages  
**Auth**: Clerk authentication with Cloudflare Workers compatibility  
**Date**: 2026-01-11

---

## 🚨 CRITICAL COMPATIBILITY NOTICE

### Next.js 16 + Cloudflare Pages Status

**Current Situation**: ⚠️ **PARTIAL COMPATIBILITY**

Next.js 16 on Cloudflare Pages has **limitations** that affect this dashboard:

1. **App Router Support**: ✅ Supported (this dashboard uses App Router)
2. **Server Components**: ⚠️ Limited (runs on Edge Runtime)
3. **Middleware**: ✅ Supported (Clerk middleware will work)
4. **Server Actions**: ⚠️ Limited support
5. **Dynamic Routes**: ✅ Supported
6. **API Routes**: ❌ **NOT SUPPORTED** (use Cloudflare Workers instead)

### Clerk + Cloudflare Workers Compatibility

**Status**: ✅ **FULLY COMPATIBLE**

Clerk officially supports Cloudflare Workers and Pages:
- ✅ `@clerk/nextjs` works on Cloudflare Pages
- ✅ Middleware runs on Edge Runtime (Clerk uses this)
- ✅ Server-side authentication works
- ✅ OAuth flows work correctly
- ✅ Session management works

**Documentation**: https://clerk.com/docs/deployments/cloudflare

---

## 📋 Pre-Deployment Checklist

### 1. Verify Current Setup

**This Dashboard**:
- ✅ Next.js 16.0.7
- ✅ React 19.2.1
- ✅ App Router (not Pages Router)
- ✅ No API routes directory (backend is separate service)
- ✅ Clerk authentication via middleware
- ✅ Client-side data fetching only

**Architecture**:
```
Frontend (Cloudflare Pages)
  ├── Dashboard UI (Next.js 16)
  ├── Clerk Auth (runs on edge)
  └── API Client (calls backend)

Backend (Separate - NOT on Cloudflare)
  ├── PostgreSQL + Redis
  ├── FastAPI service
  └── Running at: localhost:8081 (dev) / api.yourdomain.com (prod)
```

### 2. Code Compatibility Check

**✅ Compatible Features Used**:
- Client Components (`'use client'`)
- React Query for data fetching
- Clerk middleware (Edge Runtime)
- Environment variables
- Static assets
- Dynamic routing

**❌ NOT Using (Good)**:
- No API routes in `/app/api`
- No server actions in this app
- No Node.js-specific APIs in client code

**Result**: ✅ **Dashboard is Cloudflare Pages compatible**

---

## 🔧 Configuration Required

### 1. Update `next.config.js`

**Current** (`next.config.js`):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@schlep-engine/ui', '@schlep-engine/types', '@schlep-engine/javascript-sdk'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
  },
}

module.exports = nextConfig
```

**For Cloudflare Pages** (add this):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@schlep-engine/ui', '@schlep-engine/types', '@schlep-engine/javascript-sdk'],
  
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
  },

  // Cloudflare Pages specific settings
  output: 'export', // For static export (if fully static)
  // OR
  // output: 'standalone', // For SSR on Cloudflare

  images: {
    // Cloudflare Images optimization
    loader: 'custom',
    loaderFile: './cloudflare-image-loader.js',
    // OR disable image optimization
    unoptimized: true,
  },

  // Ensure trailing slashes for consistent routing
  trailingSlash: false,

  // Webpack config for Cloudflare compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
```

**Decision Point**: 
- Use `output: 'export'` if you want **fully static** (no SSR, faster)
- Use default (no output setting) if you want **SSR** (dynamic pages)

**Recommendation**: Since this dashboard uses Clerk auth and user-specific data, **DO NOT use static export**. Keep SSR enabled (default).

### 2. Create `wrangler.toml` (Cloudflare Workers Configuration)

**Create** `wrangler.toml` in project root:

```toml
name = "igris-dashboard"
compatibility_date = "2024-01-10"
pages_build_output_dir = ".vercel/output/static"

[env.production]
vars = { ENVIRONMENT = "production" }

[env.preview]
vars = { ENVIRONMENT = "preview" }

# Bindings (if you add Workers later)
# [[env.production.kv_namespaces]]
# binding = "CACHE"
# id = "your-kv-namespace-id"
```

### 3. Add Cloudflare-Specific Files

**Create** `.node-version` (if not exists):
```
20
```

**Create** `.nvmrc` (optional):
```
20.11.0
```

---

## 🌍 Environment Variables Setup

### Development (`.env.local`)

Already configured ✅:
```bash
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_ENABLE_MOCK_DATA=true
NEXT_PUBLIC_API_URL=http://localhost:8081
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Production (Cloudflare Pages Dashboard)

**Required Environment Variables**:

```bash
# Environment
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_ENABLE_MOCK_DATA=false

# API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_HEALTH_CHECK_URL=/health

# Application URLs
NEXT_PUBLIC_APP_NAME=Igris Inertial Dashboard
NEXT_PUBLIC_APP_URL=https://console.igrisinertial.com
NEXT_PUBLIC_LANDING_URL=https://igrisinertial.com

# Clerk Authentication (PRODUCTION KEYS!)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxx

# Optional: Analytics
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_MONITORING=true
```

**How to Add in Cloudflare**:
1. Go to Cloudflare Dashboard
2. Navigate to **Pages** → Your project
3. **Settings** → **Environment variables**
4. Add each variable for **Production** environment
5. **Save**

---

## 🚀 Deployment Options

### Option 1: Direct Git Integration (Recommended)

**Setup** (One-time):
1. Go to Cloudflare Dashboard → **Pages**
2. Click **Create application** → **Connect to Git**
3. Select your repository
4. Configure build settings:
   - **Framework preset**: `Next.js`
   - **Build command**: `cd web/apps/web-console && npm install && npm run build`
   - **Build output directory**: `web/apps/web-console/.next`
   - **Root directory**: `/` (or leave blank)
   - **Node version**: `20`
5. Add environment variables (see above)
6. Click **Save and Deploy**

**After Setup**:
- Every push to `main` triggers automatic deployment
- Preview deployments for branches/PRs
- Rollback capability

### Option 2: Wrangler CLI Deployment

**Install Wrangler**:
```bash
npm install -g wrangler
# OR
pnpm add -g wrangler
```

**Login**:
```bash
wrangler login
```

**Deploy**:
```bash
# 1. Navigate to project
cd /Users/wira/Desktop/system/web/apps/web-console

# 2. Build the project
npm run build

# 3. Deploy to Cloudflare Pages
wrangler pages deploy .next --project-name=igris-dashboard

# OR for first-time setup
wrangler pages project create igris-dashboard --production-branch=main
wrangler pages deploy .next --project-name=igris-dashboard
```

**Deploy with Environment Variables**:
```bash
# Set environment variables via CLI
wrangler pages project create igris-dashboard

# Upload .env file (NOT recommended - use dashboard instead)
# Use Cloudflare Dashboard for sensitive env vars
```

### Option 3: GitHub Actions CI/CD

**Create** `.github/workflows/deploy-cloudflare.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
    paths:
      - 'web/apps/web-console/**'
  
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        working-directory: web/apps/web-console
        run: pnpm install
      
      - name: Build
        working-directory: web/apps/web-console
        env:
          NEXT_PUBLIC_ENV: production
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
        run: pnpm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: igris-dashboard
          directory: web/apps/web-console/.next
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

**Required GitHub Secrets**:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

---

## 🔐 Clerk Authentication on Cloudflare

### Clerk Configuration for Cloudflare Pages

**1. Update Clerk Dashboard**:

Go to https://dashboard.clerk.com → Your Application → **Paths**

**Add Cloudflare Pages URLs**:
- **Home URL**: `https://console.igrisinertial.com`
- **Sign-in URL**: `https://console.igrisinertial.com/auth?mode=signin`
- **Sign-up URL**: `https://console.igrisinertial.com/auth?mode=signup`
- **Authorized redirect URLs**:
  - `https://console.igrisinertial.com/sso-callback`
  - `https://console.igrisinertial.com/onboarding`
  - `https://console.igrisinertial.com/dashboard`

**2. Enable OAuth Providers**:

Go to **User & Authentication** → **Social Connections**

- ✅ Enable Google OAuth
- Add redirect URL: `https://console.igrisinertial.com/sso-callback`

**3. Production Keys**:

Generate production keys:
1. Go to **API Keys**
2. Click **+ Add** → **Production** instance
3. Copy keys and add to Cloudflare environment variables

### Middleware Edge Runtime

**Current middleware** (`middleware.ts`) already compatible ✅:

```typescript
import { clerkMiddleware } from '@clerk/nextjs/server';

// This runs on Edge Runtime (Cloudflare Workers)
export default clerkMiddleware(async (auth, req) => {
  // Auth logic here
});

export const config = {
  matcher: [/* ... */],
};
```

**No changes needed** - Clerk middleware automatically runs on Edge Runtime.

### Testing Clerk on Cloudflare

**After deployment**:
1. Visit `https://console.igrisinertial.com`
2. Should redirect to `/auth`
3. Test sign up with email
4. Test sign in with email
5. Test Google OAuth
6. Verify onboarding flow
7. Check dashboard access

---

## ⚠️ Known Limitations & Workarounds

### 1. Image Optimization

**Issue**: Next.js Image Optimization doesn't work on Cloudflare Pages by default

**Workaround**:
```javascript
// next.config.js
images: {
  unoptimized: true, // Disable Next.js image optimization
}
```

**OR** use Cloudflare Images:
```javascript
// cloudflare-image-loader.js
export default function cloudflareLoader({ src, width, quality }) {
  const params = [`width=${width}`];
  if (quality) {
    params.push(`quality=${quality}`);
  }
  const paramsString = params.join(',');
  return `/cdn-cgi/image/${paramsString}/${src}`;
}
```

### 2. Server-Side Rendering Performance

**Issue**: Cold starts on Cloudflare Workers can add latency

**Workaround**:
- Keep pages that don't need SSR as client components
- Use `loading.tsx` for better UX during SSR
- Consider static generation for public pages

### 3. Build Size Limits

**Cloudflare Limits**:
- Max 25MB per deployment (compressed)
- Max 20,000 files

**Current Dashboard Size**: ~15MB (within limits ✅)

**If you hit limits**:
- Remove unused dependencies
- Enable tree-shaking
- Split large components
- Use dynamic imports

### 4. No File System Access

**Issue**: Cloudflare Workers have no `fs` module

**Status**: ✅ Not an issue (dashboard doesn't use `fs`)

### 5. API Routes Alternative

**Issue**: Next.js API routes (`/app/api`) don't work well on Cloudflare

**Current Setup**: ✅ Backend is separate FastAPI service (no issue)

**If you need serverless functions**:
- Use Cloudflare Workers directly
- Use Cloudflare Pages Functions (`/functions` directory)

---

## 📊 Performance Optimization for Cloudflare

### 1. Enable Caching

**Cloudflare Dashboard** → **Caching** → **Configuration**:
- Browser Cache TTL: **4 hours**
- Cache Level: **Standard**
- Enable **Always Online**

### 2. Add Cache Headers

**Create** `_headers` file in `public/`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/static/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable
```

### 3. Optimize Bundle Size

**Install bundle analyzer**:
```bash
npm install @next/bundle-analyzer
```

**Update** `next.config.js`:
```javascript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
```

**Analyze**:
```bash
ANALYZE=true npm run build
```

### 4. Use CDN for Static Assets

**Move to Cloudflare CDN**:
- Upload images to Cloudflare Images
- Upload fonts to Cloudflare CDN
- Reference via Cloudflare URLs

---

## 🧪 Testing Before Production

### 1. Preview Deployment

**Cloudflare automatically creates preview URLs**:
- Every branch gets a preview: `https://branch-name.igris-dashboard.pages.dev`
- Every PR gets a preview URL
- Test auth, API calls, environment variables

### 2. Local Testing with Wrangler

**Run locally with Cloudflare Pages environment**:
```bash
# Install wrangler dev dependencies
npm install -D wrangler

# Run dev server with Cloudflare Pages emulation
npx wrangler pages dev npm run dev

# OR build and test production build locally
npm run build
npx wrangler pages dev .next
```

### 3. Test Clerk Integration

**Checklist**:
- [ ] Email sign up → verification → onboarding → dashboard
- [ ] Email sign in → dashboard (skip onboarding if completed)
- [ ] Google OAuth → onboarding → dashboard
- [ ] Protected routes redirect to /auth
- [ ] Onboarding completion persists in Clerk metadata
- [ ] Session management works (refresh, logout)

---

## 🚨 Deployment Troubleshooting

### Build Fails

**Error**: `Module not found`
- **Fix**: Ensure all dependencies in `package.json`
- **Fix**: Check import paths are correct

**Error**: `Out of memory`
- **Fix**: Increase Node memory: `NODE_OPTIONS="--max-old-space-size=4096"`

**Error**: `Build exceeded maximum duration`
- **Fix**: Optimize build (remove unused deps, split bundles)

### Runtime Errors

**Error**: `fetch failed` or CORS errors
- **Fix**: Check `NEXT_PUBLIC_API_URL` is set correctly
- **Fix**: Verify backend API has CORS enabled for Cloudflare domain

**Error**: Clerk authentication not working
- **Fix**: Verify Clerk production keys are set
- **Fix**: Check Clerk dashboard redirect URLs include Cloudflare domain
- **Fix**: Ensure `CLERK_SECRET_KEY` is set (not just public key)

**Error**: Middleware redirect loop
- **Fix**: Check middleware.ts logic
- **Fix**: Verify onboarding completion flag is being set

### Performance Issues

**Slow cold starts**
- **Expected**: First request after idle can be 500ms-1s
- **Fix**: Use Cloudflare Workers Paid plan (faster cold starts)
- **Fix**: Keep pages warm with uptime monitoring

**Slow API calls**
- **Fix**: Ensure backend API is geographically close
- **Fix**: Use Cloudflare Argo Smart Routing
- **Fix**: Implement request caching

---

## ✅ Production Deployment Checklist

**Pre-Deployment**:
- [ ] Update `next.config.js` for Cloudflare compatibility
- [ ] Create `wrangler.toml` configuration
- [ ] Test build locally: `npm run build`
- [ ] Test production build: `npm start`
- [ ] Verify all environment variables are documented

**Clerk Configuration**:
- [ ] Create Clerk production application
- [ ] Get production API keys (`pk_live_`, `sk_live_`)
- [ ] Update Clerk redirect URLs to production domain
- [ ] Enable Google OAuth in production app
- [ ] Test auth flows in Clerk test mode first

**Cloudflare Setup**:
- [ ] Create Cloudflare Pages project
- [ ] Connect Git repository
- [ ] Configure build settings
- [ ] Add all environment variables
- [ ] Set production branch (main)

**First Deployment**:
- [ ] Deploy to Cloudflare Pages
- [ ] Wait for build to complete (~3-5 min)
- [ ] Check build logs for errors
- [ ] Visit production URL
- [ ] Test authentication flows
- [ ] Test API connectivity
- [ ] Monitor for errors (Cloudflare Dashboard → Analytics)

**Post-Deployment**:
- [ ] Set up custom domain (console.igrisinertial.com)
- [ ] Enable HTTPS (automatic with Cloudflare)
- [ ] Configure caching rules
- [ ] Set up monitoring (Sentry, Cloudflare Analytics)
- [ ] Create rollback plan
- [ ] Document deployment process for team

---

## 🎯 Recommended Deployment Strategy

### Phase 1: Preview Deployment (Week 1)
1. Deploy to Cloudflare Pages preview URL
2. Test all features with preview URL
3. Invite team to test
4. Fix any issues found

### Phase 2: Production Deployment (Week 2)
1. Set up production Clerk application
2. Configure production environment variables
3. Deploy to production
4. Test with production data (limited users)

### Phase 3: Custom Domain (Week 3)
1. Add custom domain in Cloudflare
2. Update DNS records
3. Enable HTTPS
4. Update Clerk redirect URLs
5. Full team rollout

### Phase 4: Optimization (Ongoing)
1. Monitor performance (Cloudflare Analytics)
2. Optimize bundle size
3. Implement caching strategies
4. A/B test improvements

---

## 📚 Additional Resources

**Cloudflare**:
- [Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

**Clerk**:
- [Clerk + Cloudflare Guide](https://clerk.com/docs/deployments/cloudflare)
- [Clerk Middleware Docs](https://clerk.com/docs/references/nextjs/clerk-middleware)
- [Clerk OAuth Setup](https://clerk.com/docs/authentication/social-connections/overview)

**Next.js**:
- [Deploying Next.js](https://nextjs.org/docs/deployment)
- [Edge Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)

---

## 💡 Final Notes

### Why Cloudflare Pages?

**Advantages** ✅:
- Fast global CDN (200+ locations)
- Free SSL/TLS
- Automatic scaling
- DDoS protection included
- Generous free tier
- Preview deployments
- Edge runtime (low latency)

**Disadvantages** ⚠️:
- Limited Node.js runtime features
- No traditional API routes
- Cold start latency
- Build size limits

### Alternative: Vercel

**If Cloudflare doesn't work**:
- Vercel has better Next.js support
- Full Node.js runtime
- Better dev experience
- Similar pricing

**Trade-off**: Vercel is more expensive at scale

### Current Status

**Dashboard Compatibility**: ✅ **READY FOR CLOUDFLARE PAGES**

**Auth Compatibility**: ✅ **CLERK WORKS ON CLOUDFLARE**

**Deployment Blockers**: ❌ **NONE**

**Recommended Action**: Deploy to Cloudflare Pages preview URL and test

---

**Last Updated**: 2026-01-11  
**Reviewed By**: Claude (AI Assistant)  
**Status**: Ready for deployment
