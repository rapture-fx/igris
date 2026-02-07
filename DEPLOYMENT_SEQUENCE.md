# Igris Inertial — Deployment Sequence

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                      │
│                                                         │
│  igrisinertial.com          console.igrisinertial.com   │
│  (web-landing)              (web-console + Clerk auth)  │
│  Static export              SSR via next-on-pages       │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      Fly.io                             │
│                                                         │
│  api.igrisinertial.com (or igris-overture.fly.dev)      │
│  Go backend (Fiber) on port 8080                        │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Postgres │  │  Redis   │  │ Rust FFI (embedded)  │  │
│  │ (Fly)    │  │  (Fly)   │  │ Thompson Sampling    │  │
│  │          │  │          │  │ SLO Enforcer         │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         Polar.sh     Resend    Clerk
         (billing)    (email)   (auth)
```

## Deployment Order

Everything depends on the backend being live first.

```
Step 1: Fly.io (backend)     ← web-console needs API URL
Step 2: Cloudflare Pages     ← web-console + web-landing
Step 3: npm publish           ← SDK needs live API URL in README
```

---

## Step 1: Backend to Fly.io

### What you need from Fly.io

- **Account**: Sign up at https://fly.io
- **Credit card**: Required even for free tier (fraud prevention)
- **CLI**: `brew install flyctl` (or `curl -L https://fly.io/install.sh | sh`)
- **Login**: `fly auth login`

### Fly.io resources we'll create

| Resource | Purpose | Estimated Cost |
|----------|---------|----------------|
| App (`igris-overture`) | Go backend, shared-cpu-1x, 512MB | ~$3-5/mo |
| Postgres (`igris-overture-db`) | Managed Postgres, 1GB | ~$0 (free tier) |
| Redis (Upstash via Fly) | Session/cache/billing state | ~$0 (free tier) |

Total: **~$5/mo** to start. Scale up later.

### Deploy commands (run after signup)

```bash
# 1. Create the app (don't deploy yet)
fly launch --name igris-overture --region sjc --no-deploy

# 2. Create Postgres
fly postgres create --name igris-overture-db --region sjc
fly postgres attach igris-overture-db --app igris-overture

# 3. Create Redis (Upstash)
fly redis create --name igris-overture-redis --region sjc
# This outputs REDIS_URL — save it

# 4. Set all secrets
fly secrets set \
  POLAR_API_KEY="your-polar-api-key" \
  POLAR_WEBHOOK_SECRET="your-polar-webhook-secret" \
  RESEND_API_KEY="your-resend-api-key" \
  RESEND_FROM_EMAIL="Igris Inertial <noreply@igrisinertial.com>" \
  JWT_SECRET="$(openssl rand -hex 32)" \
  REDIS_URL="redis://..." \
  --app igris-overture

# 5. Deploy
fly deploy

# 6. Verify
curl https://igris-overture.fly.dev/v1/health
```

### Custom domain (optional, after deploy works)

```bash
fly certs add api.igrisinertial.com --app igris-overture
# Then add CNAME: api.igrisinertial.com → igris-overture.fly.dev
```

### Environment variables on Fly.io

| Variable | Source | Required |
|----------|--------|----------|
| `DATABASE_URL` | Auto-set by `fly postgres attach` | Yes |
| `REDIS_URL` | Output of `fly redis create` | Yes |
| `POLAR_API_KEY` | Polar.sh dashboard → Settings → API | Yes |
| `POLAR_WEBHOOK_SECRET` | Polar.sh dashboard → Webhooks | Yes |
| `RESEND_API_KEY` | Resend dashboard → API Keys | Yes |
| `RESEND_FROM_EMAIL` | Your verified sender | Yes |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` | Yes |
| `ENABLE_PERSISTENCE` | `true` | Set in fly.toml |
| `USE_REDIS` | `true` | Set in fly.toml |
| `ENABLE_MULTI_TENANCY` | `true` | Set in fly.toml |

---

## Step 2: Cloudflare Pages

### web-console (console.igrisinertial.com)

| Setting | Value |
|---------|-------|
| Platform | Cloudflare Pages (SSR) |
| Build command | `cd web/apps/web-console && npx @cloudflare/next-on-pages` |
| Build output | `web/apps/web-console/.vercel/output/static` |
| Root directory | `/` (monorepo root) |
| Node version | 20 |

#### Environment variables for web-console

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_API_URL` | `https://igris-overture.fly.dev` (or custom domain) | Fly.io |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk Dashboard |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk Dashboard |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/auth?mode=signin` | Fixed |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/auth?mode=signup` | Fixed |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` | Fixed |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` | Fixed |
| `NEXT_PUBLIC_ENV` | `production` | Fixed |
| `NEXT_PUBLIC_ENABLE_MOCK_DATA` | `false` | Fixed |

#### Pre-deploy code change

```
File: web/apps/web-console/middleware.ts
Line 5: Change `const DEV_MODE = true` → `const DEV_MODE = false`
```

### web-landing (igrisinertial.com)

| Setting | Value |
|---------|-------|
| Platform | Cloudflare Pages (static) |
| Build command | `cd web/apps/web-landing && pnpm build` |
| Build output | `web/apps/web-landing/out` |
| Root directory | `/` (monorepo root) |
| Node version | 20 |

No environment variables needed (static site).

---

## Step 3: npm Publish (JS SDK)

### Package details

| Field | Value |
|-------|-------|
| Name | `igris-inertial` |
| Version | `1.0.0` |
| Location | `igris-overture/sdk/javascript/` |
| Includes | `dist/` (compiled JS) + `wasm/` (186KB WASM binary) |

### Publish commands

```bash
cd igris-overture/sdk/javascript
npm install
npm run build
npm publish --access public
```

### User installation

```bash
npm install igris-inertial
```

```typescript
import { Igris } from 'igris-inertial';

const client = new Igris({
  baseUrl: 'https://api.igrisinertial.com',
  apiKey: 'your-license-key'
});

const response = await client.infer({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

---

## Resend Email Templates

Location: `igris-overture/billing/resend.go`

| Template | Function | Triggered by | Subject line |
|----------|----------|-------------|--------------|
| Welcome | `SendWelcomeEmail(email, tier, licenseKey)` | Polar webhook: new subscription | "Welcome to Igris Inertial — Your License Key" |
| Upgrade | `SendUpgradeEmail(email, newTier)` | Polar webhook: plan change | "Plan Upgraded — Igris Inertial" |
| Cancellation | `SendCancellationEmail(email)` | Polar webhook: subscription canceled | "Subscription Canceled — Igris Inertial" |
| Trial ending | `SendTrialEndEmail(email)` | Polar webhook: trial expiring | "Trial Ending Soon — Igris Inertial" |

All emails use inline HTML, no external CSS. Sender: `Igris Inertial <noreply@igrisinertial.com>`.

Requires Resend domain verification: add DNS records for `igrisinertial.com` in Resend dashboard.

---

## Clerk Authentication

Location: `web/apps/web-console/` (Cloudflare Pages, NOT Fly.io)

| Component | File | Status |
|-----------|------|--------|
| Provider | `app/layout.tsx` | Done |
| Middleware | `middleware.ts` | Done (DEV_MODE=true, flip before deploy) |
| Auth page | `app/auth/page.tsx` | Done (sign in + sign up + Google OAuth) |
| Onboarding | `app/onboarding/page.tsx` | Done |
| SSO callback | `app/sso-callback/page.tsx` | Done |
| Logout | `components/layout/Navbar.tsx` | Done |
| Package | `@clerk/nextjs@6.36.5` | Installed |

### Clerk production setup

1. Go to https://clerk.com → your app → **Production** instance
2. Copy `pk_live_...` and `sk_live_...` keys
3. Set them in Cloudflare Pages environment variables
4. Enable Google OAuth in Clerk production settings
5. Add `console.igrisinertial.com` as allowed origin in Clerk dashboard

---

## Pre-Deploy Checklist

### Accounts needed

- [ ] Fly.io account + credit card
- [ ] Cloudflare account (you likely have this)
- [ ] npm account (for SDK publish)
- [ ] Clerk production keys (pk_live, sk_live)
- [ ] Polar.sh API key + webhook secret
- [ ] Resend API key + domain verification

### DNS records needed

| Record | Type | Value |
|--------|------|-------|
| `igrisinertial.com` | CNAME | Cloudflare Pages (web-landing) |
| `console.igrisinertial.com` | CNAME | Cloudflare Pages (web-console) |
| `api.igrisinertial.com` | CNAME | `igris-overture.fly.dev` |
| Resend verification | TXT/CNAME | From Resend dashboard |

### Code changes before deploy

- [ ] `middleware.ts`: Set `DEV_MODE = false`
- [ ] `polar_client.go`: Map real Polar product/price IDs
- [ ] Verify `fly.toml` region matches your preference

---

## Post-Deploy Verification

```bash
# Backend health
curl https://api.igrisinertial.com/v1/health

# API endpoints
curl https://api.igrisinertial.com/v1/models
curl -X POST https://api.igrisinertial.com/v1/license/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key": "test"}'

# Polar webhook (test from Polar dashboard)
# Check Fly logs: fly logs --app igris-overture

# Clerk (visit in browser)
# https://console.igrisinertial.com/auth

# npm package
npm info igris-inertial
```
