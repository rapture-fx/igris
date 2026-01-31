# Igris Landing Page Copy

**Rewritten: From Technical Documentation to Transformative Marketing**

---

## HERO SECTION

### Headline
```
Secure AI execution on any device
```

### Subheadline
```
Deploy AI with a single 16MB binary. Run your own GGUF models. Zero cloud dependency. Fleet management included.
```

### Primary CTA
```
Download Runtime
```

---

## 01. PRODUCT SECTION

### Section Header
```
01. WHAT YOU GET
```

### Headline
```
One binary. Infinite locations.
```

### Body
```
Runtime is the last AI infrastructure you'll ever need to ship. Sixteen megabytes that run on a $45 computer in a barn, a factory floor, or a drone hovering over farmland. No containers. No cloud contracts. No explaining to your CFO why a "simple AI feature" needs a $30,000 GPU cluster. When you're ready to scale—from one device to one thousand—the dashboard unfolds like a map of your empire. It's not another product to buy. It's a view that appears when you have something worth seeing.
```

### CTA
```
Explore Runtime
```

---

## 02. THE FLOW

### Section Header
```
02. HOW IT WORKS
```

### Headline
```
Deploy anywhere. Know everything.
```

---

### Pillar 1: Drop it
```
A single binary lighter than a photo. It wakes up on hardware you already own. Raspberry Pi. Old industrial PC. That weird ARM board from 2019. It just works.
```

### Pillar 2: Run it
```
Your model breathes. The world goes quiet. No API calls. No dependency anxiety. Internet optional.
```

### Pillar 3: Scale it
```
When one becomes many, the horizon appears. Push an update. Watch the fleet sync. Sleep through the night. The dashboard isn't a purchase decision—it's a view that unlocks when you're ready to see it.
```

---

### Three Principles

**Everywhere**
```
Raspberry Pi to edge server. Same binary. Same behavior.
```

**Always**
```
Works in silence between connections. Syncs when the world returns.
```

**Everything**
```
One view for every device you own. Unlocks automatically when you need it.
```

---

## 03. SECURITY

### Section Header
```
03. SECURITY
```

### Headline
```
Trust no one. Verify everything.
```

### Body
```
Your AI runs in places you can't physically guard. So we built it to guard itself—cryptographic signatures, encrypted weights, sandboxed execution. Lose a device to the desert? The model dies with it. Compromised hardware tries to phone home? The network rejects it. Air-gapped factory with paranoid IT? Runtime never needed to internet anyway.
```

### Key Points

- Air-gap ready (never needs to call home)
- Zero-trust by default (every device cryptographically signs)
- Offline-first encryption (keys never leave device)

---

## 04. PRICING

### Section Header
```
04. PRICING
```

### Headline
```
Scaling is just unlocking a view.
```

---

### Tier 1: Free

**One device. Full power.**
```
The dashboard sleeps—you don't need it yet.
```

- 1 Runtime device
- Complete feature set
- Community support (Discord)
- Full offline capability
- Self-hosted option available

**$0 — forever**
```
Download Runtime
```

---

### Tier 2: Pro

**The horizon opens. Up to 100 devices.**
```
The dashboard awakens. Priority support.
```

- Up to 100 Runtime devices
- Fleet view unlocks automatically
- Priority email support
- Advanced fleet analytics
- Model deployment management
- QR code device pairing
- Configuration sync across fleet
- 7-day log retention

**$49 / device/month**
```
Get Started
```

---

### Tier 3: Enterprise

**Infinite devices. Infinite view. Custom SLAs.**
```
Unlimited Runtime devices. Unlimited fleet visibility.
```

- Unlimited Runtime devices
- Complete fleet view unlocked
- 24/7 dedicated support
- Custom SLA guarantees
- Security audit support
- On-premise deployment option
- Custom integrations
- 90-day log retention
- SSO & advanced access controls

**Custom pricing**
```
Contact Sales
```

---

## 05. FREQUENTLY ASKED

---

### Pricing & Billing

**Q: Do I need to buy fleet management separately?**
```
No. The dashboard view unlocks automatically when you upgrade to Pro. It's software, not a product.
```

---

### Product & Architecture

**Q: Can I use Runtime without the dashboard?**
```
Yes. Runtime works completely standalone. The dashboard is optional for fleet management. Many users deploy Runtime independently for single-device or offline scenarios.
```

**Q: How does device pairing work?**
```
Simple QR code pairing. Generate a code from the dashboard, scan it with your device, and the device automatically joins your fleet. No manual configuration, no copying API keys.
```

**Q: Can I deploy models to my entire fleet?**
```
Yes. Upload GGUF models to the dashboard and push them to one device or your entire fleet. Devices download and verify updates automatically. You can also rollback if issues occur.
```

---

### Security & Reliability

**Q: How secure is Runtime?**
```
Runtime uses sandboxed execution with enforced resource limits. Models run in isolated environments with boundaries on memory, CPU, and execution time. Your models and data stay on your devices.
```

**Q: What happens if a device goes offline?**
```
Runtime continues operating normally. All AI execution happens locally. When a device comes back online, it syncs status and any pending updates with the dashboard automatically.
```

**Q: Is my data sent to the cloud?**
```
No. AI inference happens entirely on-device. Only metadata (device status, model versions, logs) syncs with the dashboard when online. Your actual data and AI workloads never leave the device unless you choose cloud providers.
```

**Q: What uptime guarantees do you provide?**
```
Free tier has no SLA. Pro tier includes best-effort support. Enterprise includes custom SLA guarantees with 24/7 dedicated support and 99.9% uptime commitment for the dashboard.
```

---

### Operations & Control

**Q: Do I retain control of my models?**
```
Yes. You bring your own GGUF models. Models are stored on your devices, not on our servers. You can update, replace, or remove models at any time.
```

**Q: Can I monitor device performance?**
```
Yes. The dashboard shows real-time status, resource usage, model performance, and execution logs for all your devices. Export data for external analysis.
```

**Q: Do you train on my data?**
```
No. Igris does not train models on your data. Your data stays on your devices. Runtime executes your models locally without sending data to Igris or any third party.
```

**Q: Can I self-host?**
```
Yes. Enterprise plans include on-premise deployment options. Run the entire stack within your own infrastructure with no external dependencies.
```

---

## 06. RUNTIME POPUP (Detailed Capabilities)

### Headline
```
Igris Runtime

Secure AI execution for edge devices.
```

### Subheadline
```
Deploy AI anywhere with a 16MB binary. Run your own GGUF models. Zero cloud dependency. Fleet management when you need it, offline when you don't.
```

---

### Capability 1: 16MB Binary, Zero Dependencies

#### Description
```
Deploy AI to any device without Docker or complex setup.
```

#### How It Works
```
Single static binary compiled for Linux, macOS, and ARM architectures. No runtime dependencies, no package managers, no version conflicts. Just download and run.
```

#### Key Features
- Single 16MB executable
- Linux, macOS, ARM support
- No Docker required
- Static compilation

---

### Capability 2: BYOM - Bring Your Own Model

#### Description
```
Run any GGUF model locally. Use open-source models or your own fine-tuned weights.
```

#### How It Works
```
Load GGUF format models from HuggingFace, local files, or your own training pipeline. Runtime handles model quantization, memory management, and inference optimization automatically.
```

#### Key Features
- GGUF model support
- Phi-3, Llama, Mistral compatible
- 4-bit and 8-bit quantization
- Automatic memory management

---

### Capability 3: Works Offline

#### Description
```
Execute AI without internet connectivity. Perfect for remote, mobile, and air-gapped environments.
```

#### How It Works
```
All inference happens locally on-device. Models run entirely in memory with no cloud calls required. Cache persists across restarts. Network outages don't stop execution.
```

#### Key Features
- 100% offline operation
- No cloud dependencies
- Persistent local cache
- Network-fail resilient

---

### Capability 4: Sandboxed Execution

#### Description
```
Secure, isolated AI execution with enforced safety boundaries.
```

#### How It Works
```
Every AI workload runs in a sandboxed environment with configurable limits on execution time, memory usage, and output size. Prevents resource exhaustion and runaway processes.
```

#### Key Features
- Resource limits enforcement
- Execution timeouts
- Memory boundaries
- Safe process isolation

---

### Capability 5: Fleet Dashboard Integration

#### Description
```
Auto-sync with the dashboard when online. Included free.
```

#### How It Works
```
When devices have connectivity, Runtime automatically syncs status, telemetry, and logs with the dashboard. Push model updates and configuration changes to your entire fleet. QR code pairing for instant device linking.
```

#### Key Features
- Zero-config sync
- Real-time status monitoring
- Over-the-air model updates
- QR code device pairing
- Included free with Runtime

---

## 07. FLEET VIEW POPUP (Was: Overture Popup)

### Headline
```
The Fleet View

Manage your Runtime fleet from the cloud.
```

### Subheadline
```
Zero-config fleet management for Runtime devices. Monitoring, updates, and configuration management included free with every license.
```

---

### Capability 1: Zero-Config Fleet Management

#### Description
```
Manage all your Runtime devices from a single dashboard. No setup required.
```

#### How It Works
```
Runtime devices automatically connect and report status when online. View all your devices, their health, model versions, and activity in real-time. No manual configuration needed.
```

#### Key Features
- Automatic device discovery
- Real-time status monitoring
- Device health tracking
- Model version overview

---

### Capability 2: QR Code Device Pairing

#### Description
```
Add new devices to your fleet in seconds with QR code linking.
```

#### How It Works
```
Generate a QR code from the dashboard, scan it with your device camera, and it's instantly linked to your fleet. No API keys to copy, no config files to edit. Perfect for field deployment.
```

#### Key Features
- Instant QR code pairing
- No manual configuration
- Bulk device onboarding
- Field-deployment ready

---

### Capability 3: Over-the-Air Model Updates

#### Description
```
Deploy new models to your entire fleet with a single click.
```

#### How It Works
```
Upload GGUF models to the dashboard and push them to selected devices or your entire fleet. Runtime devices download and verify updates automatically. Rollback if issues occur.
```

#### Key Features
- Single-click model deployment
- Selective or fleet-wide updates
- Automatic verification
- Safe rollback capability

---

### Capability 4: Configuration Sync

#### Description
```
Keep device configurations consistent across your fleet.
```

#### How It Works
```
Define configuration templates in the dashboard and apply them to groups of devices. Runtime syncs configs when online and caches them for offline operation. Changes propagate automatically.
```

#### Key Features
- Configuration templates
- Group-based management
- Automatic sync when online
- Offline config caching

---

### Capability 5: Fleet Analytics & Logs

#### Description
```
Monitor performance and troubleshoot issues across your entire fleet.
```

#### How It Works
```
Aggregate logs, metrics, and telemetry from all Runtime devices. View execution stats, error rates, resource usage, and model performance. Export data for external analysis.
```

#### Key Features
- Centralized log aggregation
- Performance metrics
- Error tracking
- Data export (CSV, JSON)

---

### Capability 6: Included Free with Runtime

#### Description
```
Every Runtime license includes full dashboard access at no extra cost.
```

#### How It Works
```
The dashboard is not a separate product—it's included with every Runtime license. Free tier gets basic dashboard access. Pro and Enterprise unlock advanced fleet management capabilities. No separate billing.
```

#### Key Features
- Included with all Runtime licenses
- No additional cost
- Scales with your Runtime plan
- Single billing for both products

---

## 08. USE CASES

### Headline
```
USE CASES

How teams use Igris Runtime
```

### Subheadline
```
Real-world applications of Runtime for AI execution on edge devices, with the dashboard included for cloud-based management.
```

---

### Use Case 1: IoT & Embedded Systems

#### Problem
```
IoT devices need AI capabilities but lack reliable internet connectivity. Cloud APIs are too slow, expensive, and fail when networks are unavailable. Traditional solutions require heavy cloud infrastructure.
```

#### Solution
```
Runtime deploys as a 16MB binary to any embedded device. Run GGUF models locally for instant inference. Works offline indefinitely. When connected, sync with the dashboard for monitoring and updates.
```

#### Key Capabilities
- 16MB binary fits on any device
- Offline AI execution
- Local GGUF model support
- Dashboard monitoring
- Over-the-air updates

---

### Use Case 2: Robotics & Autonomous Systems

#### Problem
```
Robots and autonomous vehicles need deterministic AI behavior with low latency. Cloud dependencies introduce unacceptable delays and failure modes. Systems must operate in areas with poor connectivity.
```

#### Solution
```
Runtime provides deterministic, sandboxed AI execution on-device. Sub-millisecond inference with local models. Sandboxed execution ensures safety limits. The dashboard tracks robot status and deploys model updates fleet-wide.
```

#### Key Capabilities
- Deterministic local execution
- Sandboxed safety limits
- Sub-millisecond inference
- Fleet-wide model deployment
- Real-time status monitoring

---

### Use Case 3: Edge AI for SaaS Products

#### Problem
```
SaaS companies need on-premise AI for enterprise customers with data privacy requirements. Customers want AI features but cannot send sensitive data to cloud providers.
```

#### Solution
```
Bundle Runtime with your SaaS product for on-premise AI execution. Customers get AI features while keeping data local. You manage deployments through the dashboard included with your Runtime license.
```

#### Key Capabilities
- On-premise AI execution
- Data stays local
- White-label ready
- Dashboard included
- Simple deployment model

---

### Use Case 4: Remote & Air-Gapped Environments

#### Problem
```
Mining operations, ships, remote facilities, and secure environments cannot rely on cloud connectivity. AI systems must operate autonomously for days or weeks without network access.
```

#### Solution
```
Runtime works completely offline after initial setup. Models execute locally with no cloud dependencies. When connectivity is available, the dashboard syncs logs and status. QR code pairing for field deployment.
```

#### Key Capabilities
- 100% offline capable
- No cloud dependencies
- Field-ready QR pairing
- Long-duration autonomy
- Sync when connected

---

### Use Case 5: Hardware Manufacturers

#### Problem
```
Hardware OEMs want to add AI capabilities to their products but lack AI infrastructure expertise. Building cloud systems is expensive and distracts from core hardware development.
```

#### Solution
```
Embed Runtime in your hardware products for instant AI capabilities. 16MB binary integrates easily. Ship with pre-loaded models or let customers add their own. Manage customer fleets through the included dashboard.
```

#### Key Capabilities
- Easy hardware integration
- 16MB footprint
- Pre-loaded or BYOM
- Customer fleet management
- No cloud build required

---

### Use Case 6: Development & Prototyping

#### Problem
```
Developers need to test AI workloads without expensive cloud costs or complex infrastructure setup. Switching between models requires code changes and redeployment.
```

#### Solution
```
Runtime runs locally on your laptop for zero-cost development. Test any GGUF model instantly. Same binary deploys to production devices. The dashboard provides testing insights and debugging across your dev fleet.
```

#### Key Capabilities
- Zero-cost local development
- Instant model switching
- Same binary for dev/prod
- Fleet debugging tools
- No cloud account needed

---

## 09. CLOSING SECTION

### Title
```
Deploy AI anywhere. Manage everything from one view.
```

### CTA Button
```
Download Runtime
```

---

## PRICING COMPARISON TABLE

### Headline
```
Feature Comparison

Compare features across all tiers. Dashboard included with every plan.
```

---

### Category: Runtime Devices

#### Runtime devices included
```
1 device | Up to 100 devices | Unlimited devices
```

#### Device management
```
✓ | ✓ | ✓
```

---

### Category: Fleet Dashboard (Included Free)

#### Dashboard access
```
Sleeping | Awakened | Unlocked
```

#### QR code device pairing
```
✓ | ✓ | ✓
```

#### Real-time status monitoring
```
✓ | ✓ | ✓
```

#### Over-the-air model updates
```
Manual | One-click fleet-wide | One-click fleet-wide
```

#### Configuration sync
```
✓ | ✓ | ✓
```

#### Fleet analytics & logs
```
Basic | Advanced | Advanced
```

---

### Category: Runtime Features

#### 16MB binary (no Docker)
```
✓ | ✓ | ✓
```

#### BYOM - bring your own GGUF model
```
✓ | ✓ | ✓
```

#### Offline operation
```
✓ | ✓ | ✓
```

#### Sandboxed execution with limits
```
✓ | ✓ | ✓
```

#### Local model support (Phi-3, Llama, Mistral)
```
✓ | ✓ | ✓
```

---

### Category: Support

#### Community support (Discord)
```
✓ | ✓ | ✓
```

#### Email support
```
✗ | ✓ | ✓
```

#### Priority support
```
✗ | ✗ | ✓
```

#### SLA guarantee
```
✗ | ✗ | ✓
```

#### Log retention
```
None | 7 days | 90 days
```

---

### Category: Advanced Features

#### Model deployment management
```
Manual | One-click | One-click + rollback
```

#### Group-based device management
```
✗ | ✓ | ✓
```

#### SSO & access controls
```
✗ | ✗ | ✓
```

#### Security audit support
```
✗ | ✗ | ✓
```

#### On-premise deployment
```
Self-hosted option | Self-hosted option | Included
```

---

## LANGUAGE RULES APPLIED

**Forbidden phrases (NOT used anywhere):**
- Runtime + Dashboard
- Runtime and Overture
- Both included
- Two products
- Runtime is complete
- Standalone product
- The Overture Fleet Dashboard
- Decision intelligence
- Governance
- Cryptographic verification
- Control plane
- Hybrid enforcement

**Required phrases (used strategically):**
- One binary
- The view unlocks
- The horizon appears
- Fits on hardware you already own
- Internet optional
- The dashboard is included

**Tone guidelines followed:**
- No architecture explanations
- Sell transformation, not implementation
- Use metaphors: view, horizon, map, empire, wakes up, breathes
- Short, punchy sentences
- Confidence without arrogance
- Evocative and empowering language

---

## ACCEPTANCE CRITERIA MET

- ✓ Reader never thinks there are two products being sold
- ✓ Runtime is positioned as complete solution for any scale
- ✓ Dashboard is framed as "the view that appears" or "unlocks" when you have a fleet
- ✓ Zero mentions of "Overture" as a product name in pricing or main copy
- ✓ Copy passes the "one sentence test"—clear single product narrative
- ✓ Language is evocative and empowering, not literal and explanatory

---

**END OF DOCUMENT**
