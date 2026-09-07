# Igris License System Design

## Overview

License-based access control for igris-runtime with device tracking and tier enforcement.

## License Tiers (Per-Device Pricing)

### The Seed (Free Forever)
- **Devices**: 1 device
- **Features**: Complete nervous system (all 4 layers)
  - Execution: Deterministic runtime
  - Intelligence: Local decision routing
  - Memory: Behavioral tracking
  - Proof: Cryptographic signing (Ed25519)
- **Operation**: Offline (indefinite)
- **Support**: Community
- **Cost**: $0 forever

### The Horizon (Per-Device)
- **Devices**: Up to 100 devices
- **Cost**: **$49 per device per month**
  - Example: 10 devices = $490/month
  - Example: 50 devices = $2,450/month
  - Example: 100 devices = $4,900/month
- **Features**: Everything in The Seed, plus:
  - Full dashboard access (all four layers visible)
  - Fleet-wide monitoring and control
  - Advanced routing and cost optimization
  - Performance heatmaps and anomaly detection
  - Immutable audit trails (7-day retention)
  - Over-the-air verified updates
- **Support**: Priority engineering support

### The Infinite (Custom)
- **Devices**: Unlimited
- **Cost**: Custom pricing (contact sales)
- **Features**: Everything in The Horizon, plus:
  - On-premise platform deployment
  - Custom SLA guarantees
  - Extended audit retention (90+ days)
  - Dedicated security review support
  - 24/7 engineering team access
  - Compliance certification assistance
  - Custom integration support
- **Support**: Dedicated 24/7

---

## License Key Format

```
Format: lic_[tier]_[random]_[checksum]
Example: lic_horizon_a1b2c3d4e5f6_a9b8

Breakdown:
- lic_: Prefix
- horizon: Tier (seed, horizon, infinite)
- a1b2c3d4e5f6: Random identifier (12 chars)
- a9b8: Checksum (4 chars)
```

---

## API Endpoints

### 1. Validate License
```http
POST /v1/license/validate
Content-Type: application/json

{
  "license_key": "lic_pro_xxxxx_xxxx",
  "device_id": "device-unique-id",
  "runtime_version": "1.6.0"
}

Response 200:
{
  "valid": true,
  "tier": "pro",
  "customer_email": "user@example.com",
  "devices_limit": 50,
  "devices_active": 12,
  "features": {
    "local_llm": true,
    "cloud_routing": true,
    "tools": true,
    "fleet": true,
    "priority_support": true
  },
  "expires_at": "2026-03-05T00:00:00Z",
  "status": "active"
}

Response 403:
{
  "valid": false,
  "error": "device_limit_exceeded",
  "message": "License allows 50 devices, currently 50 active. Upgrade or deactivate devices.",
  "upgrade_url": "https://igrisinertial.com/pricing"
}
```

### 2. Register Device
```http
POST /v1/license/device/register
Content-Type: application/json

{
  "license_key": "lic_pro_xxxxx_xxxx",
  "device_id": "device-unique-id",
  "device_info": {
    "hostname": "robot-001",
    "platform": "linux-x64",
    "runtime_version": "1.6.0"
  }
}

Response 200:
{
  "registered": true,
  "device_id": "device-unique-id",
  "device_count": 13
}
```

### 3. Heartbeat (Keep-Alive)
```http
POST /v1/license/device/heartbeat
Content-Type: application/json

{
  "license_key": "lic_pro_xxxxx_xxxx",
  "device_id": "device-unique-id"
}

Response 200:
{
  "status": "active",
  "last_seen": "2026-02-05T09:30:00Z"
}
```

### 4. Deregister Device
```http
POST /v1/license/device/deregister
Content-Type: application/json

{
  "license_key": "lic_pro_xxxxx_xxxx",
  "device_id": "device-unique-id"
}

Response 200:
{
  "deregistered": true,
  "device_count": 12
}
```

---

## Device ID Generation

```rust
use sha2::{Sha256, Digest};

fn generate_device_id() -> String {
    let mac = get_primary_mac_address();
    let hostname = gethostname();
    let mut hasher = Sha256::new();
    hasher.update(mac.as_bytes());
    hasher.update(hostname.as_bytes());
    let hash = hasher.finalize();
    format!("dev_{}", hex::encode(&hash[..16]))
}
```

---

## Runtime Integration

### Startup Flow

```rust
#[tokio::main]
async fn main() -> Result<()> {
    // 1. Load config
    let config = load_config()?;

    // 2. Check license
    let license_key = config.license_key
        .or_else(|| env::var("IGRIS_LICENSE_KEY").ok())
        .ok_or_else(|| anyhow!("License key required. Get yours at https://igrisinertial.com/pricing"))?;

    // 3. Generate device ID
    let device_id = generate_device_id();

    // 4. Validate license
    let license_client = LicenseClient::new("https://overture.igrisinertial.com");
    let validation = license_client
        .validate(&license_key, &device_id, VERSION)
        .await?;

    if !validation.valid {
        error!("License validation failed: {}", validation.message);
        error!("Upgrade at: {}", validation.upgrade_url);
        exit(1);
    }

    info!("License valid: {} (Tier: {}, Devices: {}/{})",
          validation.customer_email,
          validation.tier,
          validation.devices_active,
          validation.devices_limit);

    // 5. Register device
    license_client.register_device(&license_key, &device_id).await?;

    // 6. Start heartbeat (every 5 minutes)
    tokio::spawn(heartbeat_loop(license_client.clone(), license_key.clone(), device_id.clone()));

    // 7. Start runtime
    start_server(config, validation).await
}
```

---

## Database Schema

### licenses table
```sql
CREATE TABLE licenses (
    id UUID PRIMARY KEY,
    license_key VARCHAR(64) UNIQUE NOT NULL,
    tier VARCHAR(20) NOT NULL, -- free, starter, pro, enterprise
    customer_email VARCHAR(255) NOT NULL,
    customer_id UUID,
    devices_limit INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL, -- active, suspended, expired
    created_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_customer ON licenses(customer_email);
```

### devices table
```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY,
    license_id UUID REFERENCES licenses(id),
    device_id VARCHAR(128) UNIQUE NOT NULL,
    hostname VARCHAR(255),
    platform VARCHAR(64),
    runtime_version VARCHAR(32),
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL, -- active, inactive
    metadata JSONB
);

CREATE INDEX idx_devices_license ON devices(license_id);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);
```

---

## Enforcement Rules

### Device Limit
- Count active devices: `SELECT COUNT(*) FROM devices WHERE license_id = ? AND status = 'active'`
- If count >= devices_limit: Reject new registrations
- Mark inactive after 1 hour of no heartbeat

### Offline Grace Period
- If runtime can't reach license server: Allow 24 hours offline
- Cache last validation result
- After 24h: Show warning, continue with limited features
- After 72h: Require online validation

### Feature Flags
```rust
pub struct LicenseFeatures {
    // Core features (all tiers)
    pub execution_layer: bool,        // Deterministic runtime
    pub intelligence_layer: bool,      // Local decision routing
    pub memory_layer: bool,            // Behavioral tracking
    pub proof_layer: bool,             // Cryptographic signing

    // Dashboard features (Horizon+)
    pub dashboard_access: bool,
    pub fleet_monitoring: bool,
    pub cost_optimization: bool,
    pub performance_heatmaps: bool,
    pub audit_trails: bool,            // 7-day retention
    pub ota_updates: bool,

    // Enterprise features (Infinite)
    pub on_premise: bool,
    pub custom_sla: bool,
    pub extended_retention: bool,      // 90+ days
    pub dedicated_support: bool,
}

impl LicenseFeatures {
    pub fn for_tier(tier: &str) -> Self {
        match tier {
            "seed" => Self {
                // Core nervous system - all included
                execution_layer: true,
                intelligence_layer: true,
                memory_layer: true,
                proof_layer: true,

                // No dashboard features
                dashboard_access: false,
                fleet_monitoring: false,
                cost_optimization: false,
                performance_heatmaps: false,
                audit_trails: false,
                ota_updates: false,

                // No enterprise features
                on_premise: false,
                custom_sla: false,
                extended_retention: false,
                dedicated_support: false,
            },
            "horizon" => Self {
                // Everything from Seed
                execution_layer: true,
                intelligence_layer: true,
                memory_layer: true,
                proof_layer: true,

                // Dashboard features unlocked
                dashboard_access: true,
                fleet_monitoring: true,
                cost_optimization: true,
                performance_heatmaps: true,
                audit_trails: true,  // 7-day
                ota_updates: true,

                // No enterprise features yet
                on_premise: false,
                custom_sla: false,
                extended_retention: false,
                dedicated_support: false,
            },
            "infinite" => Self::all_enabled(),
            _ => Self::all_disabled(),
        }
    }
}
```

---

## User Experience

### First Install
```bash
$ npm install -g @igris/runtime
$ igris-runtime serve

Error: License key required.

Get your FREE license (3 devices) at:
  https://igrisinertial.com/signup

Or set license key:
  export IGRIS_LICENSE_KEY=lic_xxxxx_xxxxx
  # or add to config.json5
```

### With License
```bash
$ export IGRIS_LICENSE_KEY=lic_free_abc123_def4
$ igris-runtime serve

✓ License validated: user@example.com (Free tier)
✓ Device registered: dev_1a2b3c4d (1/3 devices)
✓ Server starting on http://0.0.0.0:8080
```

### Device Limit Reached (Seed Tier)
```bash
$ igris-runtime serve

✗ License validation failed:
  Device limit exceeded (1/1 devices active)

  You're on The Seed plan (1 device free).
  This device cannot start because another device is already active.

  Options:
  1. Deactivate the other device: https://dashboard.igrisinertial.com/devices
  2. Upgrade to The Horizon ($49/device/month): https://igrisinertial.com/pricing

  Active device:
  - dev_xxx (robot-001) - Last seen: 2 mins ago
```

### Adding More Devices (Horizon Tier)
```bash
$ igris-runtime serve

✓ License validated: user@example.com (The Horizon)
✓ Device registered: dev_1a2b3c4d (15/100 devices)
✓ Current billing: $735/month (15 devices × $49)
✓ Server starting on http://0.0.0.0:8080

Note: Each additional device adds $49/month to your subscription.
```

---

## Security Considerations

### License Key Protection
- Never log full license keys
- Mask in logs: `lic_pro_****_****`
- Store encrypted in config if possible

### API Rate Limiting
- Validation: 10 req/min per license
- Registration: 5 req/hour per license
- Heartbeat: 1 req/5min per device

### Anti-Abuse
- Track validation attempts
- Block suspicious patterns
- Require email verification for free tier

---

## Migration Path

### Phase 1: Add License Check (Non-Blocking)
- Warn if no license, but allow operation
- Collect device telemetry
- "License will be required in v1.7.0"

### Phase 2: Require License (Blocking)
- Must have valid license to start
- Grace period for existing users
- Email notification before enforcement

### Phase 3: Full Enforcement
- Device limits enforced
- Feature flags active
- Dashboard for management

---

## Dashboard Features

User portal at `https://dashboard.igrisinertial.com`:

- View active devices
- Deactivate devices remotely
- Usage analytics
- Billing management
- Download invoices
- Upgrade/downgrade tier

---

## Billing Integration (Polar)

### Per-Device Metered Billing

**Polar Configuration:**
```json
{
  "product_name": "Igris Runtime - The Horizon",
  "pricing_model": "per_seat",
  "price_per_seat": 4900,  // $49.00 in cents
  "billing_period": "month",
  "metered_usage": true,
  "usage_unit": "device"
}
```

### Device Count Tracking

**Billing calculation:**
```rust
// Count active devices for billing
let active_devices = db.query(
    "SELECT COUNT(*) FROM devices
     WHERE license_id = ?
     AND status = 'active'
     AND last_seen > NOW() - INTERVAL '1 hour'"
).fetch_one().await?;

let monthly_cost = active_devices * 49; // $49 per device
```

### Polar Webhook Events

**Listen for:**
- `subscription.created` - New customer signs up
- `subscription.updated` - Device count changed
- `subscription.canceled` - Customer cancels
- `invoice.paid` - Payment successful
- `invoice.payment_failed` - Handle failed payment

**Update license status accordingly:**
```rust
match webhook_event {
    PolarEvent::SubscriptionCreated { customer_id, .. } => {
        // Create license key
        // Send welcome email with license key
    }
    PolarEvent::InvoicePaymentFailed { subscription_id, .. } => {
        // Mark license as suspended after grace period
        // Send payment reminder
    }
    PolarEvent::SubscriptionCanceled { subscription_id, .. } => {
        // Mark license as expired
        // Keep data for 30 days
    }
}
```

### Usage Reporting to Polar

**Daily sync of active device count:**
```rust
// Every 24 hours
tokio::spawn(async move {
    loop {
        for license in active_licenses {
            let device_count = get_active_device_count(license.id).await?;

            // Report to Polar
            polar_client.update_subscription_quantity(
                license.polar_subscription_id,
                device_count
            ).await?;
        }

        sleep(Duration::from_hours(24)).await;
    }
});
```

### Free Tier Limitations

**The Seed (Free) - No Polar Subscription:**
- No credit card required
- Email signup only
- Generate free license key immediately
- Hard limit: 1 device
- Can upgrade to Horizon anytime

**The Horizon - Polar Subscription:**
- Credit card required
- Billed monthly based on active devices
- Soft limit: 100 devices (contact for more)
- Auto-scaling billing

---

## Next Steps

1. ✅ Design complete (this document)
2. ⏳ Implement license API in overture
3. ⏳ Add license client to runtime
4. ⏳ Integrate Polar for billing
5. ⏳ Create signup flow on website
6. ⏳ Build dashboard
7. ⏳ Update npm package
8. ⏳ Migration plan for existing users
