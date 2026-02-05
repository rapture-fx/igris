# Igris License System Design

## Overview

License-based access control for igris-runtime with device tracking and tier enforcement.

## License Tiers

### Free (Trial)
- **Devices**: 3
- **Features**: All (full evaluation)
- **Use**: Non-commercial
- **Support**: Community
- **Cost**: $0

### Starter
- **Devices**: 10
- **Features**: All
- **Use**: Commercial
- **Support**: Email
- **Cost**: $29/month

### Pro
- **Devices**: 50
- **Features**: All + Priority
- **Use**: Commercial
- **Support**: Priority
- **Cost**: $99/month

### Enterprise
- **Devices**: Unlimited
- **Features**: All + Custom
- **Use**: Commercial
- **Support**: Dedicated
- **Cost**: Custom pricing

---

## License Key Format

```
Format: lic_[tier]_[random]_[checksum]
Example: lic_pro_a1b2c3d4e5f6_a9b8

Breakdown:
- lic_: Prefix
- pro: Tier (free, starter, pro, enterprise)
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
    pub local_llm: bool,
    pub cloud_routing: bool,
    pub tools: bool,
    pub streaming: bool,
    pub fleet_management: bool,
    pub priority_support: bool,
}

impl LicenseFeatures {
    pub fn for_tier(tier: &str) -> Self {
        match tier {
            "free" => Self {
                local_llm: true,
                cloud_routing: true,
                tools: true,
                streaming: true,
                fleet_management: false,
                priority_support: false,
            },
            "starter" => Self {
                local_llm: true,
                cloud_routing: true,
                tools: true,
                streaming: true,
                fleet_management: false,
                priority_support: false,
            },
            "pro" => Self {
                local_llm: true,
                cloud_routing: true,
                tools: true,
                streaming: true,
                fleet_management: true,
                priority_support: true,
            },
            "enterprise" => Self::all_enabled(),
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

### Device Limit Reached
```bash
$ igris-runtime serve

✗ License validation failed:
  Device limit exceeded (3/3 devices active)

  Options:
  1. Deactivate unused devices: https://dashboard.igrisinertial.com/devices
  2. Upgrade to Starter plan (10 devices): https://igrisinertial.com/pricing

  Current devices:
  - dev_xxx (robot-001) - Last seen: 2 mins ago
  - dev_yyy (robot-002) - Last seen: 5 mins ago
  - dev_zzz (robot-003) - Last seen: 10 mins ago
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

## Next Steps

1. ✅ Design complete (this document)
2. ⏳ Implement license API in overture
3. ⏳ Add license client to runtime
4. ⏳ Create signup flow on website
5. ⏳ Build dashboard
6. ⏳ Update npm package
7. ⏳ Migration plan for existing users
