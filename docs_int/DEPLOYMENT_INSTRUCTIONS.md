# Phase 1 - Public Face Deployment Instructions

## Overview
This document provides step-by-step instructions for deploying the Schlep-engine public-facing components, including the landing page with pricing and early access, and Mintlify documentation.

---

## Prerequisites

- [x] Cloudflare Pages account with deployment access
- [x] Mintlify account (sign up at https://mintlify.com)
- [x] DNS access for schlep-engine.com domain
- [x] GitHub repository access

---

## Part 1: Deploy Frontend (Landing Page)

### 1.1 Commit Changes

```bash
cd /Users/wira/Desktop/schlep-engine

# Check status
git status

# Add all changes
git add web/apps/web-landing/

# Commit with descriptive message
git commit -m "feat: integrate Mintlify docs + pricing + early access flow

- Update Header and Footer with links to https://docs.schlep-engine.com/
- Add Pricing section with 4 tiers (Developer, Founders, Pro, Enterprise)
- Create Early Access form with validation and JSON storage
- Update CallToAction to link to early access form
- All components integrated into landing page
- Build verified successfully (Next.js 14.2.29)

Phase 1 - Public Face Deployment complete"

# Push to main branch
git push origin main
```

### 1.2 Deploy to Cloudflare Pages

#### Option A: Via Cloudflare Dashboard (Recommended)

1. **Login to Cloudflare**
   - Go to https://dash.cloudflare.com/
   - Navigate to `Pages` section

2. **Create New Project**
   - Click "Create a project"
   - Select "Connect to Git"
   - Choose GitHub and authorize Cloudflare
   - Select repository: `Schlep-engine/schlep-engine`

3. **Configure Build Settings**
   ```
   Project name: schlep-engine-landing
   Production branch: main
   Build command: cd web/apps/web-landing && pnpm install && pnpm build
   Build output directory: web/apps/web-landing/.next
   Root directory: /
   ```

4. **Environment Variables** (if needed)
   - No environment variables required for basic deployment
   - Add later if integrating with external services

5. **Deploy**
   - Click "Save and Deploy"
   - Wait for build to complete (~2-3 minutes)
   - Note the deployment URL (e.g., https://schlep-engine-landing.pages.dev)

#### Option B: Via Wrangler CLI

```bash
# Install Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
cd web/apps/web-landing
pnpm build
wrangler pages deploy .next --project-name=schlep-engine-landing
```

### 1.3 Configure Custom Domain

1. **In Cloudflare Pages Dashboard**
   - Go to your project: `schlep-engine-landing`
   - Navigate to "Custom domains" tab
   - Click "Set up a custom domain"
   - Enter: `schlep-engine.com` or `www.schlep-engine.com`
   - Follow DNS configuration prompts

2. **DNS Configuration**
   - Add CNAME record pointing to `<project-name>.pages.dev`
   - Or use Cloudflare's automatic DNS configuration

---

## Part 2: Deploy Mintlify Documentation

### 2.1 Prepare Documentation Repository

The documentation already exists in two locations:
- Local: `/web/apps/docs` (in main monorepo)
- External: `https://github.com/Schlep-engine/docs` (already cloned to `/Users/wira/Desktop/schlep-docs`)

**Choose your preferred setup:**

#### Option A: Use Existing External Repository (Recommended)
```bash
cd /Users/wira/Desktop/schlep-docs

# Ensure it's up to date
git pull origin main

# Verify docs.json exists
cat docs.json
```

#### Option B: Use Documentation from Main Monorepo
```bash
cd /Users/wira/Desktop/schlep-engine/web/apps/docs

# Create separate git repository for docs (if needed)
git init
git add .
git commit -m "Initial Mintlify documentation"
git remote add origin https://github.com/Schlep-engine/docs.git
git push -u origin main
```

### 2.2 Deploy to Mintlify

1. **Sign Up / Login to Mintlify**
   - Go to https://mintlify.com
   - Sign up or login with GitHub account

2. **Connect Repository**
   - Click "New Documentation"
   - Select "Connect GitHub repository"
   - Choose repository: `Schlep-engine/docs`
   - Grant necessary permissions

3. **Configure Deployment**
   ```
   Repository: Schlep-engine/docs
   Branch: main
   Configuration file: docs.json (auto-detected)
   ```

4. **Set Custom Domain**
   - In Mintlify dashboard, go to Settings > Custom Domain
   - Enter: `docs.schlep-engine.com`
   - Mintlify will provide DNS records to configure

5. **Configure DNS**
   - In Cloudflare DNS settings for `schlep-engine.com`:
   - Add CNAME record:
     ```
     Type: CNAME
     Name: docs
     Target: <provided-by-mintlify>.mintlify.app
     Proxy status: DNS only (grey cloud)
     ```

6. **Verify Deployment**
   - Wait for DNS propagation (usually 5-15 minutes)
   - Visit https://docs.schlep-engine.com/
   - Verify all pages load correctly

### 2.3 Mintlify Configuration Verification

Ensure your `docs.json` includes:
- ✅ Navigation structure with tabs
- ✅ Color theme matching brand (#16A34A)
- ✅ Logo and favicon
- ✅ GitHub links in navbar and footer
- ✅ All documentation pages referenced

---

## Part 3: Post-Deployment Verification

### 3.1 Frontend Checklist

- [ ] Visit production URL (e.g., https://schlep-engine.com)
- [ ] Click "Docs" button in header → Should open https://docs.schlep-engine.com/ in new tab
- [ ] Scroll to Pricing section → All 4 tiers visible
- [ ] Founders' Plan highlighted with "Most Popular" badge
- [ ] Click "Start Free Trial" → Smooth scroll to Early Access form
- [ ] Test Early Access form submission:
  - [ ] Fill all required fields
  - [ ] Submit form
  - [ ] Verify success message displays
  - [ ] Check that submission is saved (check server logs or data/early-signups.json)
- [ ] Click "Documentation" link in footer → Opens docs in new tab
- [ ] Test responsive layout on mobile/tablet

### 3.2 Documentation Checklist

- [ ] Visit https://docs.schlep-engine.com/
- [ ] Verify Introduction page loads
- [ ] Test navigation tabs (Documentation, API Reference, Multi-Tenancy)
- [ ] Click GitHub link in navbar → Opens GitHub repo
- [ ] Verify search functionality works
- [ ] Check that all code examples render correctly
- [ ] Test dark/light mode toggle

### 3.3 Integration Checklist

- [ ] Header Docs link → Points to Mintlify docs
- [ ] Footer Documentation link → Points to Mintlify docs
- [ ] Pricing CTAs → Scroll to Early Access form
- [ ] Early Access form → Submits successfully
- [ ] CallToAction "Get Early Access" → Scrolls to form

---

## Part 4: Monitoring & Analytics (Optional)

### 4.1 Add Analytics (Recommended)

```bash
# Install analytics package
cd web/apps/web-landing
pnpm add @vercel/analytics
# or
pnpm add react-ga4
```

Update `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 4.2 Set Up Form Submission Notifications

Consider integrating:
- Email notifications (SendGrid, Resend)
- Slack notifications
- Webhook to CRM system

---

## Part 5: Data Management

### 5.1 Early Access Submissions

Submissions are currently stored in:
```
web/apps/web-landing/data/early-signups.json
```

**Production Recommendation**: Migrate to database
- Option 1: Supabase (Recommended)
- Option 2: PostgreSQL
- Option 3: Airtable
- Option 4: Google Sheets API

### 5.2 Migrate to Supabase (Optional)

```bash
# Install Supabase client
pnpm add @supabase/supabase-js

# Update API route to use Supabase instead of JSON file
```

Example Supabase schema:
```sql
CREATE TABLE early_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  plan_interest TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
cd web/apps/web-landing
rm -rf .next node_modules
pnpm install
pnpm build
```

### DNS Not Resolving
```bash
# Check DNS propagation
dig docs.schlep-engine.com
nslookup docs.schlep-engine.com

# Wait 15-30 minutes for DNS propagation
```

### Mintlify Deployment Issues
- Verify `docs.json` is valid JSON
- Check all referenced pages exist
- Ensure branch is set to `main` or correct default branch

---

## Success Metrics

After deployment, you should have:
1. ✅ Landing page live at https://schlep-engine.com
2. ✅ Mintlify docs live at https://docs.schlep-engine.com
3. ✅ Functional pricing section with 4 tiers
4. ✅ Working early access form with submissions captured
5. ✅ All links properly connected (Header, Footer, CTAs)
6. ✅ No console errors or broken links
7. ✅ Mobile-responsive design

---

## Support & Resources

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Mintlify Docs**: https://mintlify.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Schlep-engine GitHub**: https://github.com/Schlep-engine/schlep-engine
- **Mintlify Docs Repo**: https://github.com/Schlep-engine/docs

---

## Next Phase Preparation

Once Phase 1 is complete, prepare for Phase 2 by:
- Setting up analytics dashboard
- Monitoring early access sign-ups
- Gathering user feedback
- Planning additional documentation pages (SDK, Telemetry)
- Preparing for production API deployment

---

**Deployment Date**: November 7, 2025
**Phase**: 1 - Public Face Deployment
**Status**: Ready for Deployment
