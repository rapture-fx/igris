# Polar.sh Billing Integration Guide

> **Status:** Production-ready
> **Version:** v1.3.0 (Updated Pricing)
> **Last Updated:** 2025-11-25

This guide covers the complete Polar.sh billing integration for Schlep Engine API, including updated pricing tiers, trial flow, webhook setup, and migration from old pricing.

---

## Table of Contents
1. [Overview](#overview)
2. [Updated Pricing Tiers](#updated-pricing-tiers)
3. [Polar Dashboard Setup](#polar-dashboard-setup)
4. [Environment Configuration](#environment-configuration)
5. [Trial Signup Flow](#trial-signup-flow)
6. [Webhook Setup](#webhook-setup)
7. [Gating & Feature Locks](#gating--feature-locks)
8. [Migration Guide](#migration-guide)
9. [Testing](#testing)
10. [Production Checklist](#production-checklist)

---

## Overview

**Architecture:**
- **Billing Provider:** Polar.sh (no Stripe)
- **Request Counting:** Redis (atomic counters with monthly reset)
- **Subscription Cache:** Redis (5-minute TTL)
- **Gating:** Fiber middleware with 402 Payment Required responses
- **Webhooks:** HMAC-verified Polar events for subscription lifecycle

**Key Features:**
- 14-day free trial (card-required, 50k requests, full features)
- 3 paid tiers: Develop ($129), Growth ($749), Scale ($2,499)
- 20% annual discount (e.g., Develop annual = $1,238/year = $103/mo)
- Feature gating (speculative/council/cognitive locked to Growth+)
- Request limit enforcement with soft warnings (80%) and hard blocks (100%)

---

## Updated Pricing Tiers

| Tier | Monthly | Annual (20% off) | Requests/Mo | Providers | Key Features |
|------|---------|------------------|-------------|-----------|--------------|
| **Trial** | $0 (14 days) | - | 50k | 3 | Full features unlocked |
| **Develop** | $129 | $1,238 ($103/mo) | 500k | 5 | Routing, failover, BYOK |
| **Growth** | $749 | $7,189 ($599/mo) | 2M | 10 | + Speculative, council, cognitive |
| **Scale** | $2,499 | $23,990 ($1,999/mo) | Unlimited | 20 | + Self-host, advanced SLO |
| **Enterprise** | $5k+ custom | Custom | Unlimited | Unlimited | (Parked for now) |

### Pricing Changes from v1.2.1

| Old Pricing | New Pricing | Change |
|-------------|-------------|--------|
| Develop $249/mo | Develop $99/mo | **-60%** ($150 savings) |
| Growth $799/mo | Growth $499/mo | **-38%** ($300 savings) |
| Scale $1,899/mo | Scale $1,499/mo | **-21%** ($400 savings) |

---

## Polar Dashboard Setup

### Step 1: Create Products

Log into [Polar.sh Dashboard](https://polar.sh/dashboard) and create 3 products:

**1. Develop Tier:**
```
Product Name: Schlep Engine - Develop
Description: 500k requests/month, intelligent routing, BYOK
Product ID: prod_develop (save this)

Prices:
- Monthly: $99.00 USD (price_develop_monthly)
- Annual: $950.00 USD (price_develop_annual)
```

**2. Growth Tier:**
```
Product Name: Schlep Engine - Growth
Description: 2M requests/month, speculative execution, council mode
Product ID: prod_growth

Prices:
- Monthly: $499.00 USD (price_growth_monthly)
- Annual: $4,790.00 USD (price_growth_annual)
```

**3. Scale Tier:**
```
Product Name: Schlep Engine - Scale
Description: Unlimited requests, self-host, advanced SLO
Product ID: prod_scale

Prices:
- Monthly: $1,499.00 USD (price_scale_monthly)
- Annual: $14,390.00 USD (price_scale_annual)
```

### Step 2: Configure Webhooks

1. Navigate to **Settings → Webhooks**
2. Add webhook endpoint: `https://api.schlep-engine.dev/polar/webhook`
3. Select events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.expired`
   - `subscription.trial_end`
4. Save **Webhook Secret** (needed for HMAC verification)

### Step 3: Get API Keys

1. Navigate to **Settings → API Keys**
2. Create new key: `Schlep Engine Production`
3. Copy **Secret Key** (starts with `polar_sk_...`)

---

## Environment Configuration

Add these environment variables to your deployment:

```bash
# Polar.sh Configuration
POLAR_API_KEY=polar_sk_live_your_secret_key
POLAR_WEBHOOK_SECRET=whsec_your_webhook_secret
POLAR_BASE_URL=https://api.polar.sh  # Optional, defaults to this

# Existing Redis (used for request counting)
REDIS_URL=redis://localhost:6379

# Enable billing gating (set to true in production)
ENABLE_BILLING_GATING=true
```

**Security Notes:**
- Store `POLAR_API_KEY` in secure secret management (e.g., AWS Secrets Manager, Vault)
- Rotate `POLAR_WEBHOOK_SECRET` every 90 days
- Never commit secrets to version control

---

## Trial Signup Flow

### API Endpoint: `POST /api/subscribe/trial`

**Request:**
```bash
curl -X POST https://api.schlep-engine.dev/api/subscribe/trial \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "company_name": "Acme Corp",
    "use_case": "AI chatbot for customer support"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_trial_user_example",
    "status": "trialing",
    "tier": "trial",
    "trial_end": "2025-12-09T23:59:59Z",
    "request_limit": 50000,
    "features_unlocked": "all"
  },
  "tenant_id": "tenant_user",
  "api_key": "sk_test_tenant_user_abc123...",
  "message": "Trial created! You have 14 days and 50,000 requests to explore all features.",
  "next_steps": [
    "Save your API key securely",
    "Visit https://docs.schlep-engine.dev to get started",
    "Upgrade anytime at https://polar.sh/schlep-engine/subscribe"
  ]
}
```

**Trial Limits:**
- **Duration:** 14 days from signup
- **Requests:** 50,000 total
- **Features:** All features unlocked (including speculative, council, cognitive)
- **Providers:** 3 providers max
- **Card Required:** Yes (Polar handles this in checkout flow)

**What Happens After Trial:**
- Day 7: Email with stats + upgrade CTA
- Day 13: Urgency email ("Trial ends tomorrow")
- Day 14: Trial expires, API returns 402 Payment Required
- User must upgrade to Develop/Growth/Scale to continue

---

## Webhook Setup

### Webhook Endpoint: `POST /polar/webhook`

**Polar sends events like:**
```json
{
  "type": "subscription.created",
  "data": {
    "id": "sub_abc123",
    "customer_id": "tenant_user",
    "customer_email": "user@example.com",
    "product_id": "prod_develop",
    "price_id": "price_develop_monthly",
    "status": "active",
    "current_period_end": "2025-12-25T23:59:59Z"
  },
  "created_at": "2025-11-25T12:34:56Z"
}
```

**Our Handler:**
1. Verifies HMAC signature (SHA256)
2. Parses event type
3. Updates Redis subscription cache
4. Updates request limits if tier changed
5. Sends confirmation email (async)

**Event Actions:**

| Event | Action |
|-------|--------|
| `subscription.created` | Cache subscription, send welcome email |
| `subscription.updated` | Update cache, adjust limits if tier upgraded |
| `subscription.canceled` | Mark inactive, send cancellation feedback email |
| `subscription.expired` | Block API access, send reactivation email |
| `subscription.trial_end` | Send upgrade CTA email |

**Testing Webhooks Locally:**
```bash
# Use ngrok for local testing
ngrok http 8080

# Update Polar webhook URL to:
https://abc123.ngrok.io/polar/webhook

# Trigger test event from Polar dashboard
# Check logs:
tail -f logs/api.log | grep "\[Webhook\]"
```

---

## Gating & Feature Locks

### How Gating Works

**Middleware Flow:**
```
Request → Auth (JWT/API Key) → Billing Gating → Route Handler
```

**Gating Checks:**
1. **Subscription Status:** Must be `active` or `trialing`
2. **Request Limit:** Increment Redis counter, block if over tier limit
3. **Feature Access:** Check if tier allows requested feature (e.g., speculative execution)

**Example: Develop User Tries Speculative Execution**

Request:
```bash
curl -X POST https://api.schlep-engine.dev/v1/infer \
  -H "Authorization: Bearer sk_develop_user_xyz" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "speculative_mode": "latency"
  }'
```

Response (402 Payment Required):
```json
{
  "error": "Speculative execution not available in Develop tier",
  "code": "FEATURE_LOCKED",
  "feature": "speculative_execution",
  "upgrade_tier": "growth",
  "upgrade_url": "https://polar.sh/schlep-engine/subscribe?price=price_growth_monthly&customer=tenant_user"
}
```

### Feature Lock Matrix

| Feature | Trial | Develop | Growth | Scale |
|---------|-------|---------|--------|-------|
| Thompson Sampling | ✅ | ✅ | ✅ | ✅ |
| Circuit Breaker | ✅ | ✅ | ✅ | ✅ |
| BYOK | ✅ | ✅ | ✅ | ✅ |
| Cost Tracking | ✅ | ✅ | ✅ | ✅ |
| Speculative Execution | ✅ | ❌ (402) | ✅ | ✅ |
| Council Mode | ✅ | ❌ (402) | ✅ | ✅ |
| Cognitive Advisor | ✅ | ❌ (402) | ✅ | ✅ |
| SLO Enforcer | ❌ | ❌ | Basic | Advanced |
| Audit Logs | ❌ | ❌ | ✅ | ✅ |
| Self-Host | ❌ | ❌ | ❌ | ✅ |

### Request Limit Warnings

**Soft Limit (80%):**
- Log warning
- Set response header: `X-Tier-Warning: Approaching limit: 400k/500k requests used`
- Queue email nudge (async)

**Hard Limit (100%):**
- Return 429 Too Many Requests
- Include upgrade URL in response
- Block all inference requests until next billing cycle

---

## Migration Guide

### Migrating Existing Customers (Old → New Pricing)

**Scenario:** You have customers on old pricing ($249/$799/$1,899) and want to migrate them to new pricing ($99/$499/$1,499).

**Migration Script:**

```bash
# Run migration (one-time, idempotent)
curl -X POST https://api.schlep-engine.dev/admin/migrate-pricing \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "dry_run": true
  }'
```

**What It Does:**
1. Queries all active subscriptions
2. Maps old price IDs to new price IDs:
   - `price_develop_old` ($249) → `price_develop_monthly` ($99)
   - `price_growth_old` ($799) → `price_growth_monthly` ($499)
   - `price_scale_old` ($1,899) → `price_scale_monthly` ($1,499)
3. Updates Polar subscription via API (no immediate charge)
4. Sends "Great news: Your subscription is now cheaper!" email
5. Updates Redis cache with new tier

**Migration Output:**
```
[Migration] Starting pricing migration (dry_run=true)
[Migration] Found 47 subscriptions to migrate
[Migration] tenant_abc: develop $249 → $99 (save $150/mo)
[Migration] tenant_xyz: growth $799 → $499 (save $300/mo)
...
[Migration] Migration complete: 47 updated, 0 errors
[Migration] Estimated savings: $7,050/mo for customers
```

**Customer Communication Template:**
```
Subject: Great news: Your Schlep Engine subscription is now cheaper!

Hi [Name],

We've updated our pricing to make Schlep Engine more accessible. Your subscription has been automatically migrated to our new pricing:

Old: $799/month (Growth)
New: $499/month (Growth)
You save: $300/month ($3,600/year)

No action required - your next invoice will reflect the new pricing. All features remain unchanged.

Questions? Reply to this email or visit https://docs.schlep-engine.dev

Cheers,
The Schlep Engine Team
```

---

## Testing

### Run Tests

```bash
# Unit tests for billing logic
go test ./internal/billing/... -v -cover

# Expected output:
=== RUN   TestGetTierByID
--- PASS: TestGetTierByID (0.00s)
=== RUN   TestCreateTrialSubscription
--- PASS: TestCreateTrialSubscription (0.01s)
=== RUN   TestRequestCounterIncrement
--- PASS: TestRequestCounterIncrement (0.01s)
...
PASS
coverage: 92.3% of statements
ok      schlep-engine/internal/billing  0.156s
```

### Manual Testing

**1. Test Trial Signup:**
```bash
curl -X POST http://localhost:8080/api/subscribe/trial \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Should return 201 with API key
```

**2. Test Gating (Develop user, no speculative):**
```bash
# Create develop subscription first
curl -X POST http://localhost:8080/v1/infer \
  -H "Authorization: Bearer sk_develop_test" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hi"}],"speculative_mode":"latency"}'

# Should return 402 Payment Required
```

**3. Test Request Limit:**
```bash
# Increment request counter 50,001 times for trial tenant
for i in {1..50001}; do
  curl -X POST http://localhost:8080/v1/infer \
    -H "Authorization: Bearer sk_trial_test" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"Test '$i'"}]}'
done

# 50,001st request should return 429 Too Many Requests
```

**4. Test Webhook:**
```bash
# Simulate Polar webhook event
curl -X POST http://localhost:8080/polar/webhook \
  -H "Content-Type: application/json" \
  -H "X-Polar-Signature: test_signature" \
  -d '{
    "type": "subscription.created",
    "data": {
      "id": "sub_test",
      "customer_id": "tenant_test",
      "product_id": "prod_develop",
      "price_id": "price_develop_monthly",
      "status": "active"
    }
  }'

# Check Redis: redis-cli HGETALL polar:sub:tenant_test
```

---

## Production Checklist

**Before deploying:**

- [ ] Set `POLAR_API_KEY` in production environment
- [ ] Set `POLAR_WEBHOOK_SECRET` in production environment
- [ ] Enable `ENABLE_BILLING_GATING=true`
- [ ] Verify Redis is running and accessible
- [ ] Configure Polar webhook URL: `https://api.schlep-engine.dev/polar/webhook`
- [ ] Test webhook delivery with Polar dashboard "Send test event"
- [ ] Run migration script with `dry_run=true`, then `dry_run=false`
- [ ] Set up monitoring alerts:
  - [ ] Alert on webhook failures (> 5% error rate)
  - [ ] Alert on Redis connection failures
  - [ ] Alert on Polar API rate limit errors
- [ ] Update documentation site with new pricing
- [ ] Send migration emails to existing customers
- [ ] Monitor first 24 hours for billing issues

**Post-deployment:**

- [ ] Verify trial signups work end-to-end
- [ ] Verify gating blocks Develop users from Growth features
- [ ] Verify request limits enforce correctly
- [ ] Verify webhooks update subscriptions in Redis
- [ ] Monitor Sentry/logs for 402/429 errors

---

## Troubleshooting

**Issue: Webhook returns 401 Unauthorized**
- Verify `POLAR_WEBHOOK_SECRET` matches Polar dashboard
- Check signature calculation in `webhook_handler.go`
- Enable debug logging: `DEBUG=true`

**Issue: Trial signup fails**
- Check Redis connectivity: `redis-cli ping`
- Verify `POLAR_API_KEY` is set
- Check logs: `tail -f logs/api.log | grep "\[Polar\]"`

**Issue: User over limit but not blocked**
- Verify Redis counter exists: `redis-cli GET polar:requests:tenant_id`
- Check TTL: `redis-cli TTL polar:requests:tenant_id`
- Ensure `ENABLE_BILLING_GATING=true`

**Issue: Migration failed for some customers**
- Check migration logs for specific errors
- Retry failed customers individually
- Contact Polar support if Polar API errors

---

## Support

- **Documentation:** https://docs.schlep-engine.dev/billing
- **Polar Support:** https://polar.sh/support
- **Slack:** #billing channel (internal)
- **Email:** billing@schlep-engine.dev

---

**Last Updated:** 2025-11-25
**Version:** v1.3.0
**Author:** Schlep Engine Team
