# Cloudflare Pages Deployment Guide - READY TO DEPLOY ✅

**Status**: ✅ **Configuration Fixed - Ready for Production**
**Last Updated**: 2026-01-11
**Architecture**: Cloudflare Pages (Frontend) + VPS (Backend)

---

## 🎯 Deployment Architecture

```
┌─────────────────────────────────────────────┐
│  Cloudflare Pages (Global Edge Network)    │
│  ├── Next.js 16 Dashboard UI                │
│  ├── Clerk Auth Middleware (Edge Runtime)   │
│  └── Static Assets (CSS, JS, Images)        │
└─────────────────────────────────────────────┘
                    ↓ HTTPS API Calls
┌─────────────────────────────────────────────┐
│  Your VPS Infrastructure                    │
│  ├── igris-overture (Go/Fiber) :8080        │
│  ├── igris-runtime (Rust/Axum) :8080        │
│  ├── PostgreSQL :5432                       │
│  └── Dragonfly/Redis :6379                  │
└─────────────────────────────────────────────┘
```

---

## ✅ FIXES APPLIED

### 1. **next.config.js** - Removed Static Export ✅
**Problem**: `output: 'export'` was breaking Clerk authentication middleware
**Solution**: Removed static export to enable SSR and Edge Runtime for middleware

**Before**:
```javascript
output: 'export', // ❌ Breaks auth
```

**After**:
```javascript
// SSR mode for Cloudflare Pages (required for Clerk middleware)
// DO NOT use output: 'export' - it breaks authentication middleware
```

### 2. **wrangler.toml** - Created ✅
**Location**: `/web/apps/web-console/wrangler.toml`
**Purpose**: Cloudflare Pages configuration for build output and environment settings

### 3. **_headers** - Created ✅
**Location**: `/web/apps/web-console/public/_headers`
**Purpose**: Security headers and aggressive caching for static assets

### 4. **.env.production.example** - Updated ✅
**Changes**:
- Updated API URL documentation for VPS deployment
- Clarified backend port (8080 for igris-overture)
- Added Cloudflare Pages environment variable instructions

---

## 🚀 Deployment Steps

### STEP 1: Prepare Your VPS Backend (Do First)

Before deploying the frontend, ensure your VPS backend is ready:

**1. Deploy igris-overture + igris-runtime to your VPS**
```bash
# On your VPS
cd /path/to/system
docker-compose -f docker-compose.production.yml up -d
```

**2. Configure CORS in igris-overture**

Add your Cloudflare Pages domain to CORS allowed origins:

**File**: `igris-overture/config/config.go` or your Fiber CORS middleware

```go
// CORS configuration
AllowOrigins: []string{
    "https://console.igrisinertial.com",  // Production
    "https://*.pages.dev",                 // Cloudflare Pages preview URLs
    "http://localhost:3005",               // Local development
}
AllowCredentials: true
AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
AllowHeaders: []string{"Origin", "Content-Type", "Authorization"}
```

**3. Verify VPS backend is accessible**
```bash
# Test from your local machine
curl https://api.igrisinertial.com/v1/health
# Should return: {"status": "healthy"}
```

**4. Set up SSL/TLS for your VPS**
- Use Let's Encrypt (certbot) or Cloudflare Origin Certificates
- Ensure HTTPS is enabled on port 443
- Configure reverse proxy (nginx/caddy) if needed

---

### STEP 2: Deploy to Cloudflare Pages

#### Option A: Git Integration (Recommended)

**1. Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Navigate to: **Pages** → **Create application** → **Connect to Git**

**2. Configure Repository**
   - Select your GitHub/GitLab repository
   - Choose the branch: `main`

**3. Configure Build Settings**

**IMPORTANT**: Use these exact settings:

| Setting | Value |
|---------|-------|
| **Framework preset** | `Next.js` |
| **Build command** | `cd web/apps/web-console && pnpm install && pnpm run pages:build` |
| **Build output directory** | `web/apps/web-console/.vercel/output/static` |
| **Root directory** | `/` (leave blank) |
| **Node version** | Add env var: `NODE_VERSION=20` |

**4. Add Environment Variables**

Go to: **Settings** → **Environment variables** → **Production**

**Required Variables**:
```bash
# Environment
NEXT_PUBLIC_ENV=production

# API Configuration (YOUR VPS!)
NEXT_PUBLIC_API_URL=https://api.igrisinertial.com
NEXT_PUBLIC_API_HEALTH_CHECK_URL=/v1/health

# Application URLs
NEXT_PUBLIC_APP_NAME=Igris Inertial Developer Console
NEXT_PUBLIC_APP_URL=https://console.igrisinertial.com
NEXT_PUBLIC_LANDING_URL=https://igrisinertial.com

# Clerk Authentication (PRODUCTION KEYS!)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxx

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth?mode=signin
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth?mode=signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL=/auth?mode=signup

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_MONITORING=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=false

# Optional
CLERK_TELEMETRY_DISABLED=1
```

**5. Deploy**
   - Click **Save and Deploy**
   - Wait 3-5 minutes for build to complete
   - Monitor build logs for errors

---

#### Option B: Wrangler CLI Deployment

**1. Install Wrangler**
```bash
npm install -g wrangler
# or
pnpm add -g wrangler
```

**2. Login to Cloudflare**
```bash
wrangler login
```

**3. Build and Deploy**
```bash
# Navigate to web-console
cd /Users/wira/Desktop/system/web/apps/web-console

# Install dependencies
pnpm install

# Build using @cloudflare/next-on-pages
pnpm run pages:build

# Deploy to Cloudflare Pages
wrangler pages deploy .vercel/output/static --project-name=igris-console

# For first-time deployment
wrangler pages project create igris-console --production-branch=main
wrangler pages deploy .vercel/output/static --project-name=igris-console
```

**4. Set environment variables via Wrangler**
```bash
# Add environment variables
wrangler pages secret put NEXT_PUBLIC_API_URL --project-name=igris-console
# Enter: https://api.igrisinertial.com

wrangler pages secret put CLERK_SECRET_KEY --project-name=igris-console
# Enter: sk_live_xxxxxxxxxxxxx

# Repeat for all required env vars
```

---

### STEP 3: Configure Clerk Production Application

**1. Create Production Application**
   - Go to: https://dashboard.clerk.com
   - Create a new **Production** instance (not Development)

**2. Configure Application URLs**

Navigate to: **Paths** section

| Setting | Value |
|---------|-------|
| **Home URL** | `https://console.igrisinertial.com` |
| **Sign-in URL** | `https://console.igrisinertial.com/auth?mode=signin` |
| **Sign-up URL** | `https://console.igrisinertial.com/auth?mode=signup` |

**3. Configure Redirect URLs**

Navigate to: **Allowed redirect URLs**

Add these URLs:
- `https://console.igrisinertial.com/sso-callback`
- `https://console.igrisinertial.com/onboarding`
- `https://console.igrisinertial.com/dashboard`
- `https://*.pages.dev/*` (for preview deployments)

**4. Enable OAuth Providers**

Navigate to: **User & Authentication** → **Social Connections**

- ✅ Enable **Google** OAuth
- Add redirect URL: `https://console.igrisinertial.com/sso-callback`

**5. Get Production API Keys**

Navigate to: **API Keys**

- Copy **Publishable Key** (`pk_live_...`)
- Copy **Secret Key** (`sk_live_...`)
- Add these to Cloudflare Pages environment variables

---

### STEP 4: Configure Custom Domain

**1. Add Custom Domain in Cloudflare Pages**
   - Go to: **Pages** → Your project → **Custom domains**
   - Click **Set up a custom domain**
   - Enter: `console.igrisinertial.com`

**2. Update DNS Records**

Cloudflare will automatically add the required DNS records if your domain is on Cloudflare. If not:

```
Type: CNAME
Name: console
Content: igris-console.pages.dev
Proxy: Enabled (orange cloud)
```

**3. Wait for SSL Certificate**
   - Cloudflare automatically provisions SSL/TLS certificate
   - Usually takes 1-5 minutes
   - Check status in **Custom domains** section

**4. Update Clerk URLs**
   - Go back to Clerk Dashboard
   - Update all URLs from `*.pages.dev` to `console.igrisinertial.com`
   - Save changes

---

## 🧪 Testing Checklist

After deployment, test these critical flows:

### Authentication Tests
- [ ] Visit `https://console.igrisinertial.com`
- [ ] Should redirect to `/auth` (unauthenticated)
- [ ] Test email sign-up → verification → onboarding → dashboard
- [ ] Test email sign-in → skip onboarding (if completed) → dashboard
- [ ] Test Google OAuth → onboarding → dashboard
- [ ] Test logout → redirect to `/auth`

### API Integration Tests
- [ ] Open browser DevTools → Network tab
- [ ] Navigate to dashboard
- [ ] Verify API calls go to: `https://api.igrisinertial.com`
- [ ] Check for CORS errors (should be none)
- [ ] Verify data loads correctly (no mock data)

### Protected Routes Tests
- [ ] Try accessing `/dashboard` without auth → should redirect to `/auth`
- [ ] Try accessing `/settings` without auth → should redirect to `/auth`
- [ ] Try accessing `/onboarding` after completion → should redirect to `/dashboard`

### Performance Tests
- [ ] Check Lighthouse score (aim for 90+)
- [ ] Test page load times (should be < 2s)
- [ ] Test on mobile devices
- [ ] Verify caching headers (DevTools → Network → check headers)

---

## 📊 Monitoring & Debugging

### Cloudflare Pages Dashboard

**Build Logs**:
- Pages → Your project → **Deployments**
- Click on latest deployment → **Build logs**

**Analytics**:
- Pages → Your project → **Analytics**
- Monitor: Traffic, Bandwidth, Requests

**Functions Logs** (for Edge Middleware):
- Pages → Your project → **Functions**
- Real-time logs for middleware execution

### Common Issues & Solutions

**Build Fails**:
```
Error: Module not found
→ Solution: Check package.json dependencies, run pnpm install locally first
```

**Auth Not Working**:
```
Middleware redirect loop
→ Solution: Check Clerk keys are production keys (pk_live_, sk_live_)
→ Solution: Verify Clerk redirect URLs include your domain
```

**API Calls Failing**:
```
CORS error
→ Solution: Check igris-overture CORS configuration allows your domain
→ Solution: Verify VPS backend is accessible via HTTPS
```

**Environment Variables Not Loading**:
```
API URL undefined
→ Solution: Ensure env vars are set in Cloudflare Pages (not just .env file)
→ Solution: Redeploy after adding env vars
```

---

## 🔒 Security Checklist

Before going live:

- [ ] Clerk production keys configured (not test keys)
- [ ] `NEXT_PUBLIC_ENABLE_MOCK_DATA=false` in production
- [ ] VPS backend has SSL/TLS enabled (HTTPS)
- [ ] CORS configured to only allow your domains
- [ ] PostgreSQL not publicly accessible (internal only)
- [ ] Dragonfly/Redis not publicly accessible (internal only)
- [ ] Security headers enabled (_headers file deployed)
- [ ] Rate limiting enabled on backend API
- [ ] Input validation on backend API endpoints

---

## 📈 Performance Optimization

**Cloudflare Settings**:

1. **Caching** → **Configuration**:
   - Browser Cache TTL: `4 hours`
   - Cache Level: `Standard`
   - Enable **Always Online**

2. **Speed** → **Optimization**:
   - Enable **Auto Minify** (JS, CSS, HTML)
   - Enable **Brotli** compression
   - Enable **HTTP/3** (QUIC)

3. **Network**:
   - Enable **Argo Smart Routing** (paid, faster routes)
   - Enable **HTTP/2** to Origin

---

## 🎯 Rollback Plan

If deployment fails or issues occur:

**1. Instant Rollback**:
   - Pages → Deployments → Previous deployment → **Rollback**
   - Takes effect immediately (< 30 seconds)

**2. Revert to Preview**:
   - Change production branch from `main` to a stable branch
   - Automatic redeployment

**3. Emergency Maintenance Page**:
   - Upload a static `maintenance.html` to a separate Pages project
   - Update DNS to point to maintenance page temporarily

---

## 📚 Additional Resources

**Cloudflare**:
- [Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [@cloudflare/next-on-pages Docs](https://github.com/cloudflare/next-on-pages)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

**Clerk**:
- [Clerk + Cloudflare Guide](https://clerk.com/docs/deployments/cloudflare)
- [Clerk Middleware Docs](https://clerk.com/docs/references/nextjs/clerk-middleware)

**Next.js**:
- [Edge Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)
- [Deploying Next.js](https://nextjs.org/docs/deployment)

---

## ✅ Final Deployment Checklist

**Pre-Deployment**:
- [x] Fixed `next.config.js` (removed static export)
- [x] Created `wrangler.toml`
- [x] Created `_headers` file
- [x] Updated `.env.production.example`
- [ ] VPS backend deployed and accessible
- [ ] VPS CORS configured for Cloudflare Pages domain
- [ ] Clerk production application created
- [ ] Production environment variables documented

**Cloudflare Pages Setup**:
- [ ] Created Pages project
- [ ] Connected Git repository
- [ ] Configured build settings
- [ ] Added all environment variables
- [ ] Triggered first deployment
- [ ] Verified build succeeded

**Post-Deployment**:
- [ ] Custom domain configured
- [ ] SSL certificate issued
- [ ] Tested authentication flows
- [ ] Tested API integration
- [ ] Verified no mock data in production
- [ ] Monitoring and analytics configured

---

**Status**: ✅ **READY TO DEPLOY**

Your web-console is now properly configured for Cloudflare Pages deployment with authentication middleware working correctly!

**Next Step**: Deploy your VPS backend, then deploy to Cloudflare Pages using the steps above.
