# Igris Runtime - Final Pricing Structure

## Volume-Based Pricing Model

### The Seed - FREE Forever
- **1 device**
- **$0/month**
- All core features (4 layers)
- Offline operation
- Community support

---

### The Horizon - Volume Pricing
**For 1-50 devices**

| Devices | Price/Device | Monthly Cost | Use Case |
|---------|--------------|--------------|----------|
| 1-10    | $9/device    | $9-$90       | Small fleet, prototyping |
| 11-25   | $7/device    | $105-$195    | Growing fleet |
| 26-50   | $5/device    | $195-$300    | Medium fleet |

**Features:**
- Everything in The Seed
- Full dashboard access
- Fleet monitoring
- 7-day audit logs
- Priority support

---

### The Infinite - Scaled Pricing
**For 51-250 devices**

| Devices  | Price/Device | Monthly Cost | Use Case |
|----------|--------------|--------------|----------|
| 51-100   | $4/device    | $300-$499    | Large fleet |
| 101-250  | $3/device    | $499-$849    | Enterprise fleet |

**Features:**
- Everything in The Horizon
- On-premise deployment option
- 90-day audit retention
- Advanced analytics
- Custom SLA
- 24/7 support

---

### Enterprise - Custom
**For 251+ devices**

**Pricing:** Contact sales for volume discount

**Features:**
- Everything in The Infinite
- Unlimited devices
- On-premise platform deployment
- Custom SLA guarantees
- Dedicated support team
- Compliance assistance

---

## Pricing Examples

| Fleet Size | Monthly Cost | Per Device | Tier |
|------------|--------------|------------|------|
| 1 device   | **$0**       | $0         | The Seed |
| 5 devices  | **$45**      | $9         | The Horizon |
| 10 devices | **$90**      | $9         | The Horizon |
| 25 devices | **$195**     | $7.80 avg  | The Horizon |
| 50 devices | **$300**     | $6 avg     | The Horizon |
| 100 devices| **$499**     | $4.99 avg  | The Infinite |
| 250 devices| **$849**     | $3.40 avg  | The Infinite |
| 500+ devices| **Custom**  | <$3        | Enterprise |

---

## Competitive Comparison

| Provider | Model | Price Range |
|----------|-------|-------------|
| **Igris** | Volume tiers | $3-9/device |
| Balena | Flat per device | $10-15/device |
| Samsara | Flat per device | $30/device |
| Losant | Platform fee | $25-50/mo base + devices |
| AWS IoT | Usage-based | $0.001/min/device |

**Igris Advantage:** Most competitive pricing at scale with transparent volume discounts.

---

## Billing Integration (Polar)

### Setup
```json
{
  "product_name": "Igris Runtime",
  "pricing_type": "usage_based",
  "tiers": [
    { "up_to": 10, "unit_price": 900 },    // $9.00
    { "up_to": 25, "unit_price": 700 },    // $7.00
    { "up_to": 50, "unit_price": 500 },    // $5.00
    { "up_to": 100, "unit_price": 400 },   // $4.00
    { "up_to": 250, "unit_price": 300 }    // $3.00
  ],
  "billing_period": "month"
}
```

### Device Tracking
- **Active Device:** Last seen < 1 hour
- **Billing Count:** Count of active devices at end of billing period
- **Prorated:** New devices charged from activation date
- **Deactivation:** Removed devices credited for unused time

---

## License System Alignment

### License Tiers Match Pricing

**lic_seed_xxxxx**
- Free tier
- 1 device limit enforced
- No credit card required

**lic_horizon_xxxxx**
- Paid tier (1-50 devices)
- Billed based on active device count
- Volume pricing applied automatically

**lic_infinite_xxxxx**
- Paid tier (51-250 devices)
- Lower per-device cost
- Advanced features enabled

**lic_enterprise_xxxxx**
- Custom pricing
- Unlimited devices
- All features enabled

---

## User Journey

### Free Tier Signup
1. User visits igrisinertial.com/pricing
2. Clicks "Get Started" on The Seed
3. Signs up with Clerk (email only)
4. Receives free license key instantly
5. Downloads runtime via npm or curl
6. Uses 1 device free forever

### Paid Tier Upgrade
1. User exceeds 1 device limit
2. Runtime shows upgrade prompt
3. Redirects to Polar checkout
4. Selects initial device count (slider)
5. Enters payment details
6. Receives paid license key
7. Billing auto-adjusts as devices added/removed

---

## Dashboard Features by Tier

### The Seed (Free)
- ❌ No dashboard access
- ✅ Runtime works standalone
- ✅ Local monitoring only

### The Horizon
- ✅ Dashboard access
- ✅ Fleet view (all devices)
- ✅ Performance metrics
- ✅ 7-day audit logs
- ✅ Device management

### The Infinite
- ✅ Everything in Horizon
- ✅ 90-day audit logs
- ✅ Advanced analytics
- ✅ Custom integrations
- ✅ On-premise option

---

## Migration Plan

### Existing Users (if any)
1. **Week 1:** Announce pricing changes
2. **Week 2:** Grandfather existing users at old pricing for 3 months
3. **Month 3:** Transition to new pricing with 20% early adopter discount
4. **Month 6:** Full pricing in effect

### New Users (Launch)
- New pricing from day 1
- Clear volume discounts
- No surprises

---

## FAQ

**Q: What happens if I exceed my device limit?**
A: Devices are auto-billed. You'll see the new device count and cost before it's activated.

**Q: Can I remove devices to lower my bill?**
A: Yes! Deactivate devices in the dashboard anytime. Bill adjusts next cycle.

**Q: What counts as an "active" device?**
A: Any device that sent a heartbeat in the last hour.

**Q: Can I switch between tiers?**
A: Yes, automatic. As you add/remove devices, you move between tiers seamlessly.

**Q: Is there a contract?**
A: No. Monthly billing, cancel anytime.

---

## Implementation Checklist

- [ ] Update Pricing.tsx with slider component
- [ ] Update LICENSE_SYSTEM_DESIGN.md with volume pricing
- [ ] Configure Polar with tiered pricing
- [ ] Update Overture billing logic to handle volume tiers
- [ ] Test price calculation with various device counts
- [ ] Update marketing copy to reflect volume pricing
- [ ] Create pricing FAQ page
- [ ] Setup Polar webhooks for billing events

---

## Next Steps

1. ✅ Pricing structure finalized
2. ⏳ Replace Pricing.tsx with PricingNew.tsx
3. ⏳ Update license system to use volume tiers
4. ⏳ Configure Polar billing integration
5. ⏳ Test full user journey (signup → payment → license)
6. ⏳ Launch! 🚀
