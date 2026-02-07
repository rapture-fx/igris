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
│                   Hetzner CX22                          │
│                   (~€3.99/mo)                           │
│                                                         │
│  api.igrisinertial.com                                  │
│  Docker Compose (docker-compose.production.yml)         │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Postgres │  │  Dragonfly   │  │ Igris Overture  │   │
│  │ 15-alpine│  │  (Redis-     │  │ Go API + Rust   │   │
│  │          │  │   compatible)│  │ FFI (cgo)       │   │
│  └──────────┘  └──────────────┘  └─────────────────┘   │
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
Step 1: Hetzner VPS (backend)   ← web-console needs API URL
Step 2: Cloudflare Pages        ← web-console + web-landing
Step 3: npm publish             ← SDK needs live API URL in README
```

---

## Step 1: Backend to Hetzner

### What you need

- **Hetzner Cloud account**: https://console.hetzner.cloud
- **Server**: CX22 (2 vCPU, 4GB RAM, 40GB SSD, ~€3.99/mo)
- **OS**: Ubuntu 22.04 or Debian 12
- **Domain**: `api.igrisinertial.com` pointed to server IP

### Server setup

```bash
# SSH into your Hetzner server
ssh root@YOUR_SERVER_IP

# Install Docker + Docker Compose
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2
systemctl enable docker && systemctl start docker

# Clone the repo
git clone https://github.com/Igris-inertial/system.git /opt/igris
cd /opt/igris

# Create .env from your secrets
cat > .env << 'EOF'
POSTGRES_DB=igris_overture
POSTGRES_USER=igris_user
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
REDIS_PASSWORD=CHANGE_ME_STRONG_PASSWORD
JWT_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL
VAULT_MASTER_KEY=CHANGE_ME_GENERATE_WITH_OPENSSL
PROVIDER_MODE=benchmark
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
EOF

# Generate secrets
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/VAULT_MASTER_KEY=.*/VAULT_MASTER_KEY=$(openssl rand -hex 32)/" .env

# Deploy
docker compose -f docker-compose.production.yml up -d --build

# Verify
curl http://localhost:8080/v1/health
```

### SSL with Let's Encrypt (after DNS is pointed)

```bash
# Install certbot
apt install -y certbot

# Get certificate
certbot certonly --standalone -d api.igrisinertial.com

# Or use the included ssl-setup script
bash scripts/ssl-setup.sh
```

### Firewall setup

```bash
# Use included firewall script or manual:
bash scripts/setup_firewall.sh

# Manual alternative:
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
```

### Environment variables (in .env)

| Variable | Source | Required |
|----------|--------|----------|
| `POSTGRES_PASSWORD` | Generate strong password | Yes |
| `REDIS_PASSWORD` | Generate strong password | Yes |
| `JWT_SECRET` | `openssl rand -hex 32` | Yes |
| `VAULT_MASTER_KEY` | `openssl rand -hex 32` | Yes |
| `POLAR_API_KEY` | Polar.sh dashboard | For billing |
| `POLAR_WEBHOOK_SECRET` | Polar.sh webhooks | For billing |
| `RESEND_API_KEY` | Resend dashboard | For emails |
| `OPENAI_API_KEY` | OpenAI dashboard | For live inference |
| `ANTHROPIC_API_KEY` | Anthropic dashboard | For live inference |

### What runs on the server

| Container | Image | Port | Memory |
|-----------|-------|------|--------|
| `igris-postgres` | postgres:15-alpine | 5432 | ~256MB |
| `igris-dragonfly` | dragonflydb/dragonfly:latest | 6379 | ~512MB (4GB limit) |
| `igris-overture` | Built from Dockerfile | 8080 | ~256MB |

Optional monitoring (enable with `--profile monitoring`):
| `igris-prometheus` | prom/prometheus | 9090 |
| `igris-grafana` | grafana/grafana | 3000 |
| `igris-jaeger` | jaegertracing/all-in-one | 16686 |

### Management commands

```bash
# View logs
docker compose -f docker-compose.production.yml logs -f api

# Restart API only
docker compose -f docker-compose.production.yml restart api

# Stop everything
docker compose -f docker-compose.production.yml down

# Update and redeploy
cd /opt/igris && git pull && docker compose -f docker-compose.production.yml up -d --build

# Database backup
bash scripts/backup_database.sh

# Enable monitoring stack
docker compose -f docker-compose.production.yml --profile monitoring up -d
```

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
| `NEXT_PUBLIC_API_URL` | `https://api.igrisinertial.com` | Your Hetzner server |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk Dashboard |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk Dashboard |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/auth?mode=signin` | Fixed |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/auth?mode=signup` | Fixed |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` | Fixed |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` | Fixed |
| `NEXT_PUBLIC_ENV` | `production` | Fixed |
| `NEXT_PUBLIC_ENABLE_MOCK_DATA` | `false` | Fixed |

#### Code changes already applied

- `middleware.ts`: `DEV_MODE = false` (done)
- `app/auth/page.tsx`: `useSearchParams` wrapped in Suspense (done)

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
| Welcome | `SendWelcomeEmail(email, tier, licenseKey)` | Polar webhook: new subscription | "Welcome to Igris Inertial -- Your License Key" |
| Upgrade | `SendUpgradeEmail(email, newTier)` | Polar webhook: plan change | "Plan Upgraded -- Igris Inertial" |
| Cancellation | `SendCancellationEmail(email)` | Polar webhook: subscription canceled | "Subscription Canceled -- Igris Inertial" |
| Trial ending | `SendTrialEndEmail(email)` | Polar webhook: trial expiring | "Trial Ending Soon -- Igris Inertial" |

All emails use inline HTML, no external CSS. Sender: `Igris Inertial <noreply@igrisinertial.com>`.

Requires Resend domain verification: add DNS records for `igrisinertial.com` in Resend dashboard.

---

## Clerk Authentication

Location: `web/apps/web-console/` (Cloudflare Pages, NOT Hetzner)

| Component | File | Status |
|-----------|------|--------|
| Provider | `app/layout.tsx` | Done |
| Middleware | `middleware.ts` | Done (DEV_MODE=false) |
| Auth page | `app/auth/page.tsx` | Done (sign in + sign up + Google OAuth) |
| Onboarding | `app/onboarding/page.tsx` | Done |
| SSO callback | `app/sso-callback/page.tsx` | Done |
| Logout | `components/layout/Navbar.tsx` | Done |
| Package | `@clerk/nextjs@6.36.5` | Installed |

### Clerk production setup

1. Go to https://clerk.com -> your app -> **Production** instance
2. Copy `pk_live_...` and `sk_live_...` keys
3. Set them in Cloudflare Pages environment variables
4. Enable Google OAuth in Clerk production settings
5. Add `console.igrisinertial.com` as allowed origin in Clerk dashboard

---

## Pricing Tiers

| Tier | Price | Tier key in code |
|------|-------|-----------------|
| Trial | Free (14 days) | `trial` |
| Develop | $149/mo | `develop` |
| Growth | $899/mo | `growth` |
| Scale | $2,999/mo | `scale` |

Defined in: `igris-overture/billing/polar_client.go`
Mapped from Polar price IDs in: `igris-overture/billing/webhook_handler.go`

---

## Pre-Deploy Checklist

### Accounts needed

- [ ] Hetzner Cloud account
- [ ] Cloudflare account
- [ ] npm account (for SDK publish)
- [ ] Clerk production keys (pk_live, sk_live)
- [ ] Polar.sh API key + webhook secret
- [ ] Resend API key + domain verification

### DNS records needed

| Record | Type | Value |
|--------|------|-------|
| `igrisinertial.com` | CNAME | Cloudflare Pages (web-landing) |
| `console.igrisinertial.com` | CNAME | Cloudflare Pages (web-console) |
| `api.igrisinertial.com` | A | Hetzner server IP |
| Resend verification | TXT/CNAME | From Resend dashboard |

### Code changes before deploy

- [x] `middleware.ts`: Set `DEV_MODE = false`
- [x] `auth/page.tsx`: Wrapped `useSearchParams` in Suspense
- [ ] `polar_client.go`: Map real Polar product/price IDs
- [ ] `webhook_handler.go`: Map real Polar price IDs to tiers

---

## Post-Deploy Verification

```bash
# Backend health (from your machine)
curl https://api.igrisinertial.com/v1/health

# API endpoints
curl https://api.igrisinertial.com/v1/models
curl -X POST https://api.igrisinertial.com/v1/license/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key": "test"}'

# Server logs (SSH into Hetzner)
docker compose -f docker-compose.production.yml logs -f api

# Polar webhook (test from Polar dashboard)

# Clerk (visit in browser)
# https://console.igrisinertial.com/auth

# npm package
npm info igris-inertial
```
