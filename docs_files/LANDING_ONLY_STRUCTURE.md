# Schlep-engine Landing-Only Frontend Structure

**Purpose**: Minimal frontend architecture for Alpha launch
**Date**: 2025-10-17
**Status**: Active

---

## Overview

The Schlep-engine frontend has been streamlined to a single landing page application for the Alpha launch. This document describes the current structure, dependencies, and maintenance guidelines.

---

## Directory Structure

```
/web/
├── apps/
│   ├── web-landing/           # ⭐ ONLY FRONTEND APP
│   │   ├── app/              # Next.js 14 App Router
│   │   │   ├── api/          # API route
│   │   │   ├── auth/         # Auth pages
│   │   │   ├── billing/      # Billing page
│   │   │   ├── blog/         # Blog section
│   │   │   ├── dashboard/    # Dashboard preview
│   │   │   ├── explorer/     # Data explorer
│   │   │   ├── jobs/         # Jobs page
│   │   │   ├── pipelines/    # Pipelines page
│   │   │   ├── playground/   # Playground
│   │   │   ├── pricing/      # Pricing tiers
│   │   │   ├── sales-collateral/
│   │   │   ├── signin/       # Sign in
│   │   │   ├── signup/       # Sign up
│   │   │   ├── solutions/    # Solution pages
│   │   │   ├── status/       # System status
│   │   │   ├── test/         # Test page
│   │   │   ├── tools/        # Tools page
│   │   │   ├── globals.css   # Global styles
│   │   │   ├── layout.tsx    # Root layout
│   │   │   ├── page.tsx      # Homepage
│   │   │   └── favicon.ico
│   │   ├── public/           # Static assets (SVGs, images)
│   │   ├── src/              # Source code
│   │   │   ├── components/   # React components
│   │   │   │   ├── sections/ # Page sections
│   │   │   │   └── ui/       # UI components
│   │   │   └── lib/          # Utility libraries
│   │   │       ├── auth/     # Auth utilities
│   │   │       ├── api.ts    # API client
│   │   │       ├── api-service.ts
│   │   │       ├── config.ts # Configuration
│   │   │       └── utils.ts  # Helpers
│   │   ├── .next/            # Build output (gitignored)
│   │   ├── next.config.ts    # Next.js config
│   │   ├── package.json      # Dependencies
│   │   ├── postcss.config.js # PostCSS config
│   │   ├── tailwind.config.ts# Tailwind config
│   │   ├── tsconfig.json     # TypeScript config
│   │   └── README.md         # Landing page docs
│   │
│   ├── backend/              # 🔧 Backend services (preserved)
│   ├── python-ml-service/    # 🔧 ML service (preserved)
│   └── go-gateway/           # 🔧 Go gateway (review needed)
│
├── package.json              # Monorepo root
├── pnpm-workspace.yaml       # Workspace config
├── pnpm-lock.yaml            # Lock file
└── .vercelignore             # Vercel ignore

/labs/packages/               # Shared packages (separate monorepo)
├── types/                    # TypeScript types
├── ui/                       # UI component library
├── pricing-config/           # Pricing configuration
└── javascript-sdk/           # JS SDK
```

---

## Application Details

### web-landing

**Purpose**: Marketing landing page and Alpha product showcase

**Tech Stack**:
- **Framework**: Next.js 14.2.29 (App Router)
- **UI**: React 18.3.1
- **Styling**: Tailwind CSS 3.4.15
- **Animations**: Framer Motion 10.16.4
- **Icons**: Lucide React 0.294.0
- **Charts**: Recharts 2.8.0
- **Auth**: Supabase 2.39.0
- **Theme**: next-themes 0.2.1

**Port**: 3000

**Routes** (23 total):

**Marketing Routes** (Primary):
- `/` - Homepage with hero and features
- `/pricing` - Pricing tiers (Free, Pro, Enterprise)
- `/solutions/*` - Solution pages (cold-start, fraud-detection)
- `/blog` - Blog/content section
- `/status` - System status page

**Application Preview Routes**:
- `/dashboard` - Dashboard preview/demo
- `/explorer` - Data explorer
- `/jobs` - Jobs interface
- `/pipelines` - Pipeline visualization
- `/playground` - Interactive playground
- `/tools` - Developer tools

**Authentication Routes**:
- `/auth` - Auth hub
- `/auth/callback` - OAuth callback
- `/auth/password` - Password reset
- `/auth/register` - Registration
- `/signin` - Sign in page
- `/signup` - Sign up page

**Other Routes**:
- `/api` - API documentation/info
- `/billing` - Billing management
- `/sales-collateral` - Sales materials
- `/test` - Testing page (should be removed in production)

**Design System**:
- **Primary Color**: #007AFF (Apple Blue)
- **Typography**: SF Pro Display/Text
- **Style**: Apple-inspired minimal design
- **Responsive**: Mobile-first approach

---

## Dependencies

### Workspace Packages (Broken - Needs Fix)

The landing page references workspace packages from `/labs/packages/`:

```json
"@schlep-engine/types": "workspace:*"
"@schlep-engine/ui": "workspace:*"
"@schlep/pricing-config": "workspace:*"
"@schlep-engine/javascript-sdk": "workspace:*"
"@schlep-engine/config": "workspace:*"
```

**Issue**: These packages exist in `/labs/packages/` but pnpm-workspace.yaml expects `/web/packages/`

**Solutions**:

**Option 1: Symlinks** (Recommended)
```bash
mkdir -p web/packages
ln -s ../../labs/packages/types web/packages/types
ln -s ../../labs/packages/ui web/packages/ui
ln -s ../../labs/packages/pricing-config web/packages/pricing-config
ln -s ../../labs/packages/javascript-sdk web/packages/javascript-sdk
ln -s ../../labs/packages/config web/packages/config
```

**Option 2: Update Workspace Config**
```yaml
# web/pnpm-workspace.yaml
packages:
  - 'apps/web-landing'
  - '../labs/packages/*'
```

**Option 3: Vendor Dependencies**
Copy needed components directly into web-landing/src/

### External Dependencies

All dependencies are properly versioned in `web/apps/web-landing/package.json`:
- No conflicting versions
- All use stable releases
- Production-ready

---

## Development Workflow

### Setup

```bash
# Navigate to web directory
cd web

# Install dependencies (after fixing workspace packages)
pnpm install

# Start development server
pnpm run dev

# Or start landing page specifically
pnpm run dev:landing
```

### Build

```bash
cd web

# Build for production
pnpm run build

# Or build landing specifically
pnpm --filter @schlep-engine/web-landing build

# Start production server
pnpm run start
```

### Testing

```bash
# Type checking
cd web/apps/web-landing
npx tsc --noEmit

# Linting
pnpm run lint

# Build test
pnpm run build
```

---

## Deployment

### Vercel (Recommended)

web-landing is configured for Vercel deployment:

```bash
# Deploy from root
vercel --cwd web/apps/web-landing

# Or let Vercel auto-detect
# Vercel will use web/.vercelignore
```

**Build Settings**:
- Framework: Next.js
- Build Command: `cd apps/web-landing && pnpm run build`
- Output Directory: `apps/web-landing/.next`
- Install Command: `pnpm install`
- Root Directory: `web/`

### Static Export

For static hosting:

```javascript
// next.config.ts
module.exports = {
  output: 'export',
  // ...other config
}
```

```bash
pnpm run build
# Output in .next/ as static files
```

---

## Maintenance Guidelines

### Adding New Pages

```bash
# Create new route
touch web/apps/web-landing/app/new-page/page.tsx

# Create with layout
mkdir -p web/apps/web-landing/app/new-section
touch web/apps/web-landing/app/new-section/layout.tsx
touch web/apps/web-landing/app/new-section/page.tsx
```

### Adding Components

```bash
# UI components
touch web/apps/web-landing/src/components/ui/NewComponent.tsx

# Section components
touch web/apps/web-landing/src/components/sections/NewSection.tsx
```

### Updating Dependencies

```bash
cd web

# Check outdated
pnpm outdated --recursive

# Update specific package
pnpm update package-name

# Update all (with review)
pnpm update --latest --interactive
```

### Performance Optimization

**Current Status**:
- ✅ Next.js 14 with App Router (automatic optimization)
- ✅ Image optimization with next/image
- ✅ Font optimization with next/font
- ⚠️ Review bundle size: Currently 249MB (mostly .next build)

**Recommendations**:
1. Implement code splitting for large routes
2. Lazy load components below the fold
3. Optimize images in /public directory
4. Enable Turbopack for faster builds (already enabled)

---

## Monitoring & Analytics

### Suggested Setup

```typescript
// web/apps/web-landing/src/lib/analytics.ts
export const trackEvent = (eventName: string, properties?: object) => {
  // Implement analytics (Posthog, Plausible, etc.)
}

// Track page views
export const trackPageView = (path: string) => {
  // Implement
}
```

### Error Tracking

Consider adding Sentry:

```bash
pnpm add @sentry/nextjs
```

---

## Known Issues

### 1. Workspace Dependencies ⚠️
**Status**: Broken
**Impact**: Cannot install dependencies
**Fix**: See "Dependencies" section above

### 2. Orphaned Test Route ⚠️
**Route**: `/test`
**Impact**: Low - test page in production
**Fix**: Delete `web/apps/web-landing/app/test/` before production deploy

### 3. Large Build Size ⚠️
**Size**: 249MB total (236MB is .next build)
**Impact**: Slow deployments
**Fix**:
- Add `.next/` to `.gitignore` (should not be committed)
- Optimize assets in `/public/`

### 4. Missing TypeScript Strictness ⚠️
**Impact**: Medium - potential type issues
**Fix**: Enable strict mode in tsconfig.json

---

## Configuration Files

### pnpm-workspace.yaml

**Current** (Needs Update):
```yaml
packages:
  - 'apps/api'
  - 'apps/web-*'
  - 'packages/*'
```

**Recommended**:
```yaml
packages:
  - 'apps/web-landing'
  # Removed: web-admin, web-console, web-docs

  # Option A: Symlink packages (if created)
  - 'packages/*'

  # Option B: Reference labs packages
  # - '../labs/packages/types'
  # - '../labs/packages/ui'
  # - '../labs/packages/pricing-config'
```

### package.json (Root)

**Current Scripts** (Needs Update):
```json
{
  "scripts": {
    "dev": "pnpm --parallel --filter \"@schlep-engine/*\" dev",
    "dev:landing": "pnpm --filter @schlep-engine/web-landing dev",
    "dev:admin": "pnpm --filter @schlep-engine/web-admin dev",  // REMOVE
    "dev:docs": "pnpm --filter @schlep-engine/web-docs dev",    // REMOVE
    "dev:console": "pnpm --filter @schlep-engine/web-console dev" // REMOVE
  }
}
```

**Recommended**:
```json
{
  "scripts": {
    "dev": "pnpm --filter @schlep-engine/web-landing dev",
    "build": "pnpm --filter @schlep-engine/web-landing build",
    "start": "pnpm --filter @schlep-engine/web-landing start",
    "lint": "pnpm --filter @schlep-engine/web-landing lint",
    "dev:landing": "pnpm --filter @schlep-engine/web-landing dev"
  }
}
```

---

## Alpha Launch Checklist

### Pre-Launch
- [ ] Fix workspace package dependencies
- [ ] Remove `/test` route
- [ ] Verify all links work
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Add meta tags for SEO
- [ ] Add OpenGraph tags for social sharing
- [ ] Set up analytics (optional)
- [ ] Set up error tracking (recommended)
- [ ] Test build: `pnpm run build`
- [ ] Test production mode: `pnpm run start`

### Content
- [ ] Update homepage copy for Alpha launch
- [ ] Add "Alpha" badge/notice
- [ ] Add GitHub repository link
- [ ] Add installation guide
- [ ] Add API documentation link
- [ ] Add support/contact information
- [ ] Review pricing tiers for Alpha
- [ ] Add changelog/release notes link

### Technical
- [ ] Configure environment variables (.env.local)
- [ ] Set up Supabase project (if using auth)
- [ ] Configure CORS for API
- [ ] Set up rate limiting
- [ ] Add robots.txt
- [ ] Add sitemap.xml
- [ ] Test API endpoints
- [ ] Verify auth flows (signin, signup, password reset)

### Deployment
- [ ] Choose hosting platform (Vercel recommended)
- [ ] Configure custom domain
- [ ] Set up SSL certificate
- [ ] Configure environment variables in hosting
- [ ] Set up deployment pipeline
- [ ] Test deployed application
- [ ] Monitor initial traffic

---

## Support & Maintenance

### Code Ownership
**Primary**: Frontend team
**Backup**: Full-stack team

### Documentation
- **This File**: Frontend structure and maintenance
- **README.md**: General landing page info
- **package.json**: Dependencies and scripts

### Common Tasks

**Update dependencies**:
```bash
cd web && pnpm update
```

**Add new route**:
```bash
mkdir -p web/apps/web-landing/app/new-route
echo 'export default function Page() { return <div>New Route</div> }' > web/apps/web-landing/app/new-route/page.tsx
```

**Debug build issues**:
```bash
cd web/apps/web-landing
rm -rf .next
pnpm install
pnpm run build
```

---

## Related Documentation

- **FRONTEND_PURGE_REPORT.md**: Details of cleanup operation
- **web/apps/web-landing/README.md**: Landing page specific docs
- **docs/**: Main project documentation (if exists)

---

## Changelog

**2025-10-17**: Initial landing-only structure
- Removed web-console, web-admin, temp-landing
- Preserved backend services
- Documented structure and workflows

---

**End of Document**
