# Polar Billing Configuration - Unified Igris Platform

## Overview

Single subscription model that includes BOTH edge devices AND cloud request quotas.
Customer pays once, gets complete AI infrastructure (cloud + edge).

---

## Product Configuration in Polar

### Product Name
**Igris Platform** (not "Overture" or "Runtime" separately)

### Description
```
Complete AI infrastructure from cloud to edge.
Includes edge device licensing + cloud routing quota.
One platform, one price, everything included.
```

---

## Subscription Tiers

### The Seed - FREE Tier

**Polar Configuration**:
```json
{
  "product_name": "Igris Platform - The Seed",
  "pricing_model": "free",
  "price": 0,
  "billing_period": "month",
  "features": {
    "edge_devices": 1,
    "cloud_requests_per_month": 50000,
    "dashboard_access": false,
    "support_level": "community"
  }
}
```

**Signup Flow**:
1. User signs up with Clerk (email only)
2. Generate license key immediately: `lic_seed_xxxxx_xxxx`
3. No credit card required
4. Send welcome email with license key
5. User can start using platform immediately

**No Polar subscription needed** - this is a pure free tier, generate license keys directly.

---

### The Horizon - $149/month

**Polar Configuration**:
```json
{
  "product_name": "Igris Platform - The Horizon",
  "pricing_model": "flat_rate",
  "price": 14900,
  "currency": "usd",
  "billing_period": "month",
  "billing_interval": 1,
  "features": {
    "edge_devices": 50,
    "cloud_requests_per_month": 500000,
    "dashboard_access": true,
    "audit_retention_days": 7,
    "support_level": "priority"
  },
  "metadata": {
    "tier": "horizon",
    "devices_limit": 50,
    "cloud_requests_limit": 500000
  }
}
```

**Signup/Upgrade Flow**:
1. User clicks "Get Started" on pricing page
2. Redirect to Polar checkout
3. On successful payment → Polar webhook
4. Generate license key: `lic_horizon_xxxxx_xxxx`
5. Email license key to customer
6. Customer sets `IGRIS_LICENSE_KEY` env var

---

### The Infinite - $399/month

**Polar Configuration**:
```json
{
  "product_name": "Igris Platform - The Infinite",
  "pricing_model": "flat_rate",
  "price": 39900,
  "currency": "usd",
  "billing_period": "month",
  "billing_interval": 1,
  "features": {
    "edge_devices": 250,
    "cloud_requests_per_month": 2000000,
    "dashboard_access": true,
    "audit_retention_days": 90,
    "on_premise_option": true,
    "support_level": "24/7",
    "sla_guarantee": true
  },
  "metadata": {
    "tier": "infinite",
    "devices_limit": 250,
    "cloud_requests_limit": 2000000
  }
}
```

---

### Enterprise - Custom Pricing

**Polar Configuration**:
```json
{
  "product_name": "Igris Platform - Enterprise",
  "pricing_model": "custom",
  "contact_sales": true,
  "features": {
    "edge_devices": "unlimited",
    "cloud_requests_per_month": "unlimited",
    "dashboard_access": true,
    "audit_retention_days": "custom",
    "on_premise_deployment": true,
    "dedicated_support": true,
    "custom_sla": true,
    "compliance_assistance": true
  }
}
```

**Sales Flow**:
1. User clicks "Contact Sales"
2. Sales team negotiates custom pricing
3. Manual license generation: `lic_enterprise_xxxxx_xxxx`
4. Custom Polar invoice setup

---

## Webhook Events

### Listen For These Events

#### `checkout.completed`
```json
{
  "event": "checkout.completed",
  "customer": {
    "email": "user@example.com",
    "name": "John Doe"
  },
  "product": {
    "name": "Igris Platform - The Horizon"
  },
  "subscription_id": "sub_xxxxx",
  "metadata": {
    "tier": "horizon",
    "devices_limit": 50,
    "cloud_requests_limit": 500000
  }
}
```

**Action**:
1. Generate license key for tier
2. Insert into `licenses` table:
   ```sql
   INSERT INTO licenses (
     license_key, tier, customer_email,
     devices_limit, status, created_at
   ) VALUES (
     'lic_horizon_xxxxx_xxxx', 'horizon', 'user@example.com',
     50, 'active', NOW()
   );
   ```
3. Email license key to customer
4. Send to dashboard: "Welcome to Igris! Here's your license key"

#### `subscription.updated`
Customer upgraded/downgraded tier.

**Action**:
1. Update license tier in database
2. Update device limits
3. Update cloud request quota
4. Email customer about tier change

#### `subscription.canceled`
Customer canceled subscription.

**Action**:
1. Mark license status as `suspended` (grace period)
2. Email customer: "Your subscription ends on [date]"
3. After grace period: status = `expired`
4. Runtime will block on next validation

#### `invoice.paid`
Monthly payment successful.

**Action**:
1. Ensure license status = `active`
2. Reset cloud requests counter for new month
3. Log successful payment

#### `invoice.payment_failed`
Payment failed.

**Action**:
1. Day 1: Send email reminder
2. Day 3: Send urgent notice
3. Day 7: Mark license as `suspended`
4. Day 14: Mark license as `expired`, block runtime

---

## Usage Tracking (for future metered billing)

While current model is flat-rate, track usage for potential future models:

### Edge Device Usage
Already tracked via heartbeat system:
```sql
SELECT COUNT(*) as active_devices
FROM devices
WHERE license_id = $1
AND status = 'active'
AND last_seen > NOW() - INTERVAL '1 hour';
```

### Cloud Request Usage
Track in `usage_log` table (to be created):
```sql
CREATE TABLE IF NOT EXISTS usage_log (
  id UUID PRIMARY KEY,
  license_id UUID REFERENCES licenses(id),
  request_type VARCHAR(50), -- 'cloud' or 'edge'
  provider VARCHAR(50),      -- 'openai', 'anthropic', etc (for cloud)
  model VARCHAR(100),
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(12,6),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_log_license ON usage_log(license_id, timestamp);
CREATE INDEX idx_usage_log_month ON usage_log(DATE_TRUNC('month', timestamp));
```

### Monthly Report to Polar (optional)
```rust
// Daily sync of usage metrics
async fn sync_usage_to_polar() {
    for license in active_licenses {
        let active_devices = count_active_devices(license.id).await;
        let cloud_requests = count_monthly_cloud_requests(license.id).await;

        polar_client.report_usage(
            license.polar_subscription_id,
            {
                "edge_devices": active_devices,
                "cloud_requests": cloud_requests
            }
        ).await;
    }
}
```

---

## Customer Dashboard Integration

### License & Billing Page (in web-console)

Show unified subscription details:

```
Your Igris Subscription
─────────────────────────────────────────

Current Plan: The Horizon
Price: $149/month

What's Included:
├─ Edge Devices: 15/50 active
│  └─ $2.98 per device average
├─ Cloud Requests: 234,567/500,000 this month
│  └─ 46.9% used, 265,433 remaining
└─ Support: Priority email support

Billing:
├─ Next invoice: March 1, 2026 ($149.00)
├─ Payment method: •••• 4242
└─ Billing history: [View Invoices]

[Upgrade to The Infinite] [Manage Payment Method]

─────────────────────────────────────────

Usage Details (This Month)

Edge Devices:
• device-001 (robot-01) - Online, last seen 2m ago
• device-002 (robot-02) - Online, last seen 5m ago
• device-003 (edge-gateway) - Offline, last seen 2h ago
... (12 more devices)

[View All Devices] [Add Device]

Cloud Requests:
• OpenAI (GPT-4): 123,456 requests, $234.56
• Anthropic (Claude): 89,012 requests, $178.45
• Google (Gemini): 22,099 requests, $45.23

[View Usage Analytics]
```

---

## Upgrade/Downgrade Flows

### Upgrade (Seed → Horizon)
1. User clicks "Upgrade" in dashboard
2. Redirect to Polar checkout for Horizon tier
3. On payment success:
   - Update license tier in database
   - Increase device limit to 50
   - Increase cloud quota to 500k
   - Email new license key (tier prefix changes)
   - OR keep same key, just update tier field

### Downgrade (Horizon → Seed)
1. User clicks "Downgrade" or cancels subscription
2. Confirm: "You'll lose access to 49 devices and reduced cloud quota"
3. On confirm:
   - Mark devices 2-50 as inactive
   - Reduce cloud quota to 50k
   - Downgrade tier in database
   - Email confirmation

### Prorating
Polar handles prorating automatically:
- Upgrade: Credit remaining time, charge new tier
- Downgrade: Credit applied to next invoice

---

## Free Trial Strategy (Optional)

Offer 14-day trial of paid tiers:

```json
{
  "trial_period_days": 14,
  "trial_tier": "horizon",
  "after_trial": "downgrade_to_seed"
}
```

**Flow**:
1. User signs up free (Seed tier)
2. Offer trial: "Try The Horizon free for 14 days"
3. No credit card required for trial
4. After 14 days: "Add payment to keep Horizon, or continue with Seed"

---

## License Key Format

```
Format: lic_[tier]_[random12]_[checksum4]

Examples:
lic_seed_a1b2c3d4e5f6_a9b8         (Free tier)
lic_horizon_x7y8z9a0b1c2_d3e4      (Horizon)
lic_infinite_m5n6o7p8q9r0_s1t2     (Infinite)
lic_enterprise_u3v4w5x6y7z8_a9b0   (Enterprise)
```

Tier is encoded in the key for quick identification.

---

## Anti-Fraud Measures

1. **Email Verification Required**
   - Seed tier: Require verified email before issuing license
   - Paid tiers: Polar handles payment verification

2. **Device Fingerprinting**
   - Generate unique device ID from MAC + hostname
   - Prevent same device_id across multiple licenses

3. **Rate Limiting**
   - License validation: 10 req/min per license
   - Device registration: 5 req/hour per license
   - Heartbeat: 1 req/5min per device

4. **Abuse Detection**
   - Flag licenses with >10 device registrations/hour
   - Flag rapid tier upgrades/downgrades
   - Monitor for key sharing patterns

---

## Implementation Checklist

### Polar Setup
- [ ] Create Polar account
- [ ] Configure webhook endpoint: `https://overture.igrisinertial.com/webhooks/polar`
- [ ] Create products for each tier (Seed, Horizon, Infinite)
- [ ] Set up checkout pages
- [ ] Test webhook delivery

### Backend (igris-overture)
- [x] License validation API
- [x] Device registration/tracking
- [x] Heartbeat mechanism
- [x] Unified tier structure (cloud + edge)
- [ ] Webhook handler for Polar events
- [ ] License key generation on payment
- [ ] Email delivery system
- [ ] Usage tracking for cloud requests

### Runtime (igris-runtime)
- [x] License validation on startup
- [x] Device ID generation
- [x] Heartbeat loop
- [x] Blocking enforcement (exit on invalid license)
- [ ] Display cloud request quota in startup logs

### Dashboard (web-console)
- [ ] Unified billing page (cloud + edge)
- [ ] Device list with status
- [ ] Usage analytics (devices + cloud requests)
- [ ] Upgrade/downgrade buttons
- [ ] Payment method management
- [ ] Invoice history

### Marketing (web-landing)
- [ ] Update pricing page with unified tiers
- [ ] Update homepage to emphasize unified platform
- [ ] Update documentation
- [ ] Add usage quota information

---

## Next Steps

1. **Create Polar account** and configure products
2. **Deploy webhook handler** in igris-overture
3. **Test complete flow**: signup → payment → license → runtime
4. **Update dashboard** to show unified subscription view
5. **Launch!**

---

## Support Queries

### "How do I add more devices?"
"Just install Igris on additional devices with the same license key. Your tier includes up to [N] devices."

### "What if I hit my cloud request limit?"
"You'll see a warning in the dashboard. Upgrade to the next tier for higher quota, or wait for the next billing cycle."

### "Can I use only edge devices without cloud routing?"
"Yes! Igris works 100% offline. Cloud routing is included but optional."

### "Can I use only cloud routing without edge devices?"
"Yes, but you're paying for at least 1 device in every tier. We recommend using edge for offline capability."

---

This configuration provides a simple, unified billing model where customers understand exactly what they're getting: complete AI infrastructure (cloud + edge) in one subscription.
