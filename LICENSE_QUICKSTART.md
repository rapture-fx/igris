# Igris Runtime - License Quickstart

## Get Your License

### 1. Free Tier (The Seed)
Perfect for testing and single-device deployments.

- **1 device forever**
- **$0/month**
- All 4 layers included
- No credit card required

**Get yours**: [https://igrisinertial.com/signup](https://igrisinertial.com/signup)

### 2. Paid Tiers
Scale your fleet with advanced features.

| Tier | Devices | Price | Features |
|------|---------|-------|----------|
| **The Horizon** | Up to 50 | $149/month | Dashboard, fleet monitoring, audit logs |
| **The Infinite** | Up to 250 | $399/month | On-premise, advanced analytics, SLA |
| **Enterprise** | Unlimited | Custom | Full platform, dedicated support |

**View pricing**: [https://igrisinertial.com/pricing](https://igrisinertial.com/pricing)

## Installation

### Via npm (Recommended)
```bash
npm install -g @igris/runtime
```

### Via curl
```bash
curl -fsSL https://runtime.igrisinertial.com/install.sh | bash
```

## Setup

### 1. Set Your License Key
```bash
export IGRIS_LICENSE_KEY=lic_xxxxx_xxxxx
```

Or add to your shell profile:
```bash
# ~/.bashrc or ~/.zshrc
export IGRIS_LICENSE_KEY=lic_xxxxx_xxxxx
```

### 2. Start the Runtime
```bash
igris-runtime serve
```

**Expected output**:
```
🔐 Validating license...
✓ License valid: user@example.com (Tier: seed, Devices: 1/1)
✓ Device registered: dev_1a2b3c4d (1 devices)
✓ Server starting on http://0.0.0.0:8080
```

### 3. Test It
```bash
curl http://localhost:8080/v1/health
# {"status":"ok"}
```

## Configuration (Optional)

You can also set the license key in `config.json5`:

```json5
{
  "license_key": "lic_xxxxx_xxxxx",
  "server": {
    "host": "0.0.0.0",
    "port": 8080
  },
  "providers": [
    // ... your cloud providers
  ]
}
```

Then run:
```bash
igris-runtime serve --config config.json5
```

## Device Management

### View Active Devices
Visit your dashboard: [https://dashboard.igrisinertial.com](https://dashboard.igrisinertial.com)

### Deactivate a Device
To free up a device slot:
1. Go to dashboard
2. Click on device
3. Click "Deactivate"

Or stop the runtime on that device (becomes inactive after 1 hour of no heartbeat).

## Upgrading

### From Free to Paid
1. Visit [https://igrisinertial.com/pricing](https://igrisinertial.com/pricing)
2. Select your tier
3. Complete checkout
4. You'll receive a new license key via email
5. Update `IGRIS_LICENSE_KEY` on all devices

Your devices will automatically migrate to the new tier.

## Troubleshooting

### "License validation failed"
**Cause**: Invalid or expired license key
**Solution**:
1. Check your license key is correct
2. Verify it's still active at [https://dashboard.igrisinertial.com](https://dashboard.igrisinertial.com)
3. Contact support if needed: support@igrisinertial.com

### "Device limit exceeded"
**Cause**: You've reached your device limit for your tier
**Solution**:
1. **Free tier (1 device)**: Stop the runtime on another device, or upgrade to The Horizon
2. **Paid tiers**: Deactivate unused devices in the dashboard, or upgrade to next tier

### "License server unreachable"
**Cause**: Can't connect to license validation server
**Solution**:
1. Check internet connection
2. Verify firewall allows outbound HTTPS
3. Try again in a few minutes
4. License caching allows 24 hours offline (coming soon)

### No License Key Set
If you see:
```
⚠ No license key provided (IGRIS_LICENSE_KEY not set)
Get your FREE license (1 device) at: https://igrisinertial.com/signup
```

**Solution**: Set the `IGRIS_LICENSE_KEY` environment variable as shown above.

## FAQ

**Q: Is the free tier really free forever?**
A: Yes! 1 device forever, no credit card, no expiration.

**Q: What happens if I exceed my device limit?**
A: New devices will be blocked from starting until you deactivate old devices or upgrade your tier.

**Q: Can I change tiers anytime?**
A: Yes! Upgrade or downgrade at any time. No long-term contracts.

**Q: What counts as an "active" device?**
A: A device that sent a heartbeat in the last hour. Inactive devices don't count toward your limit.

**Q: Can I use the same license key on multiple devices?**
A: Yes, within your tier's device limit. Each device gets a unique device ID.

**Q: Do I need internet to run the runtime?**
A: License validation requires internet on startup. After that, the runtime can operate offline indefinitely. Heartbeats resume when back online.

**Q: What if I lose my license key?**
A: Log in to the dashboard to view your license key, or contact support.

## Support

- **Documentation**: [https://docs.igrisinertial.com](https://docs.igrisinertial.com)
- **Email**: support@igrisinertial.com
- **GitHub**: [https://github.com/Igris-inertial/Igris](https://github.com/Igris-inertial/Igris)
- **Discord**: [https://discord.gg/igris](https://discord.gg/igris)

## License Key Format

License keys look like this:
```
lic_[tier]_[random]_[checksum]

Examples:
lic_seed_a1b2c3d4e5f6_a9b8       (Free tier)
lic_horizon_x7y8z9a0b1c2_d3e4    (Horizon tier)
lic_infinite_m5n6o7p8q9r0_s1t2   (Infinite tier)
lic_enterprise_u3v4w5x6y7z8_a9b0 (Enterprise tier)
```

The prefix tells you which tier the license is for.

## Next Steps

1. ✅ Install runtime
2. ✅ Get license key
3. ✅ Set environment variable
4. ✅ Start runtime
5. 📚 Read the docs: [https://docs.igrisinertial.com](https://docs.igrisinertial.com)
6. 🚀 Deploy to your fleet!

---

**Welcome to the Igris ecosystem! 🎉**
