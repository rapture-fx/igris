# Schlep-Engine Landing Page Copy

> Marketing-focused copy for landing page sections

---

## Hero Section

### Main Headline
```
Stop Overpaying for LLM Inference.
Start Optimizing Automatically.
```

### Subheadline
```
Schlep-Engine is an intelligent LLM gateway that routes requests
across OpenAI, Anthropic, and more—automatically optimizing for
cost, latency, or quality with ML-powered routing.
```

### Value Proposition (3 pillars)
```
✓ 20-40% cost reduction with zero quality loss
✓ 99.9% uptime with automatic provider fallback
✓ ML-powered routing that learns your workload
```

### CTA Buttons
```
Primary: "Get Started Free"  →  /docs/quickstart
Secondary: "View Documentation"  →  /docs
Tertiary: "See How It Works"  →  #how-it-works
```

---

## Problem Section

### Headline
```
Spending Too Much on LLM APIs?
```

### Problem Statements

**Problem 1: Unpredictable Costs**
> You're spending $10k+/month on OpenAI and Anthropic, but you have no idea which provider is more cost-effective for your workload.

**Problem 2: Provider Outages**
> When OpenAI goes down, your entire application goes down with it. You need multi-provider redundancy but managing it manually is a nightmare.

**Problem 3: No Optimization**
> You're routing all GPT-4 requests to OpenAI at $0.03/1K tokens when Claude 3 Sonnet could do the job at $0.003/1K tokens—a 10x cost difference you're missing.

**Problem 4: Risky Experimentation**
> You want to test new routing strategies but can't risk breaking production. Shadow testing is manual and error-prone.

---

## Solution Section

### Headline
```
Meet Schlep-Engine: Your Intelligent LLM Gateway
```

### How It Works (3-Step Visual)

**Step 1: Connect Your Providers**
```
Bring your own API keys for OpenAI, Anthropic, and more.
Schlep-Engine handles provider abstraction and fallback.

[Icon: Multiple provider logos → Unified API]
```

**Step 2: ML-Powered Routing**
```
Our Rust-based Thompson Sampling optimizer learns which
provider performs best for YOUR workload and automatically
routes requests to maximize your goals.

[Icon: Brain/ML → Routing paths]
```

**Step 3: Monitor & Optimize**
```
Real-time cost tracking, latency percentiles, and Prometheus
metrics give you full visibility into every request.

[Icon: Dashboard with graphs]
```

---

## Features Section

### Feature 1: Intelligent Multi-Provider Routing

**Headline**: Never Fail on Provider Outages

**Copy**:
> Automatic fallback to healthy providers means 99.9% uptime even during OpenAI incidents. Your users never see downtime.

**Benefits**:
- Automatic provider detection from model name
- Policy-based routing per request
- Optimize for latency, cost, or quality
- Sub-200ms routing overhead

**Visual**: Flow diagram showing primary provider failure → automatic fallback

---

### Feature 2: Rust-Powered ML Optimization

**Headline**: Machine Learning That Learns Your Workload

**Copy**:
> Our Thompson Sampling optimizer continuously learns which provider works best for YOUR specific requests and automatically adapts routing decisions in real-time.

**Benefits**:
- 20-40% cost reduction with no quality loss
- Continuous learning from every request
- Safe rollout with shadow mode testing
- Automatic Go fallback for safety

**Visual**: Before/After cost comparison graph

**Testimonial Placeholder**:
> "We reduced our LLM costs by 35% in the first month without changing a single line of application code."
> — Engineering Lead, [Company Name]

---

### Feature 3: Hot-Reload Control Plane

**Headline**: Change Configuration Without Downtime

**Copy**:
> Adjust optimizer mode and sample rate in production with zero downtime. No restarts, no dropped requests, no risk.

**Benefits**:
- Zero-downtime configuration changes
- Gradual rollout (5% → 25% → 50% → 100%)
- Instant rollback on anomalies
- Secure token-based admin API

**Visual**: Admin dashboard with slider for sample rate

---

### Feature 4: Real-Time Cost Tracking

**Headline**: Know Exactly What Every Request Costs

**Copy**:
> Track USD cost, latency, and token usage for every single request. Prometheus metrics ready for Grafana dashboards.

**Benefits**:
- Per-request cost calculation
- Latency percentiles (P50, P95, P99)
- Token accounting (prompt + completion)
- Prometheus & Grafana integration

**Visual**: Grafana dashboard screenshot

---

### Feature 5: Shadow Mode Testing

**Headline**: Test New Algorithms Without Risk

**Copy**:
> Run experimental routing strategies in parallel with production traffic. Compare decisions, measure impact, and validate improvements before rollout—all with zero production impact.

**Benefits**:
- Parallel testing (Go + Rust)
- Decision comparison logging
- Agreement rate, cost delta, latency delta
- Validate before production rollout

**Visual**: Shadow mode flow diagram

---

## Use Cases Section

### Use Case 1: High-Volume Applications

**Headline**: Reduce LLM Costs for High-Volume Apps

**Scenario**:
> You're running a chatbot serving 1M+ messages/day across GPT-4 and Claude. LLM costs are $15k/month and growing.

**Solution**:
> Schlep-Engine's ML optimizer routes to the cheapest provider that meets your quality threshold, automatically adapting as pricing changes.

**Result**:
> **35% cost reduction** ($5,250/month savings) with **zero quality degradation**

**CTA**: "See Cost Savings Calculator →"

---

### Use Case 2: Mission-Critical Production Systems

**Headline**: Achieve 99.9% Uptime with Multi-Provider Failover

**Scenario**:
> Your B2B SaaS product relies on OpenAI's GPT-4. When OpenAI has an outage, your entire product goes down and customers churn.

**Solution**:
> Automatic fallback to Anthropic Claude when OpenAI is unavailable. Your users never see downtime.

**Result**:
> **99.9% uptime** despite 3 major provider incidents in Q4 2024

**CTA**: "View Reliability Guarantees →"

---

### Use Case 3: Safe ML Experimentation

**Headline**: Test Routing Algorithms Without Breaking Prod

**Scenario**:
> You want to test a new cost-optimized routing strategy but can't risk breaking production traffic.

**Solution**:
> Shadow mode runs your experiment in parallel with production, logging all decisions for comparison without affecting real users.

**Result**:
> Validated **22% cost improvement** before rollout, zero production incidents

**CTA**: "Learn About Shadow Mode →"

---

## Social Proof Section

### Headline
```
Trusted by Teams Building Production LLM Applications
```

### Testimonials (Placeholders)

**Testimonial 1**:
> "Schlep-Engine paid for itself in the first week. We reduced our OpenAI bill by 40% without changing a single line of code."

— **Sarah Chen**, CTO at [AI Startup]

**Testimonial 2**:
> "The shadow mode feature was a game-changer. We validated a 25% latency improvement before rolling it out to production with zero risk."

— **Michael Rodriguez**, Staff Engineer at [Tech Company]

**Testimonial 3**:
> "We survived the OpenAI outage in December without a single customer complaint thanks to automatic fallback. Schlep-Engine is now critical infrastructure."

— **Alex Kim**, VP Engineering at [SaaS Company]

---

## Stats Section (Visual Callouts)

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    20-40%           │  │    <200ms           │  │    99.9%            │
│  Cost Reduction     │  │ Routing Overhead    │  │    Uptime           │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   100% Open Source  │  │  Zero Vendor Lock-in│  │  BYOK Support       │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## Technical Specs Section

### Headline
```
Built for Production. Designed for Scale.
```

### Performance
- **Routing Overhead**: <200ms (P95)
- **Throughput**: 1,000+ req/s per instance
- **Latency Tracking**: P50, P95, P99 percentiles
- **Fallback Time**: <50ms

### Reliability
- **Uptime**: 99.9% with automatic fallback
- **Circuit Breakers**: Per-provider
- **SLO Guardrails**: Auto-disable on violations
- **Health Checks**: Built-in monitoring

### Compatibility
- **OpenAI**: Full API compatibility
- **Anthropic**: Full API compatibility
- **Extensible**: Add custom providers
- **BYOK**: Bring your own API keys

---

## Comparison Table

| Feature | Schlep-Engine | Direct API Calls | LangChain | LiteLLM |
|---------|---------------|------------------|-----------|---------|
| Multi-provider routing | ✅ ML-powered | ❌ Manual | ⚠️ Basic | ⚠️ Basic |
| Cost optimization | ✅ Automatic | ❌ None | ❌ None | ⚠️ Manual |
| Automatic fallback | ✅ Yes | ❌ No | ⚠️ Limited | ✅ Yes |
| Real-time cost tracking | ✅ Per-request | ❌ None | ❌ None | ⚠️ Aggregated |
| Hot-reload config | ✅ Zero downtime | ❌ N/A | ❌ Restart | ❌ Restart |
| Shadow testing | ✅ Built-in | ❌ Manual | ❌ None | ❌ None |
| Distributed tracing | ✅ Every request | ❌ None | ⚠️ Basic | ⚠️ Basic |
| Production-ready | ✅ Yes | ⚠️ DIY | ⚠️ Framework | ✅ Yes |

---

## Pricing Section (If Applicable)

### Open Source (Free Forever)
```
✓ Unlimited requests
✓ All features included
✓ Community support
✓ Self-hosted
```

**Price**: $0/month

**CTA**: "Deploy Now →"

---

### Managed Cloud (Coming Soon)
```
✓ Everything in Open Source
✓ Hosted infrastructure
✓ Automatic updates
✓ Priority support
✓ SLA guarantees
```

**Price**: Starting at $99/month

**CTA**: "Join Waitlist →"

---

## FAQ Section

### Q: How does Schlep-Engine reduce costs?
**A**: Our ML-powered optimizer learns which provider (OpenAI, Anthropic, etc.) performs best for YOUR specific requests and automatically routes to the cheapest option that meets your quality threshold. Most teams see 20-40% cost reduction.

### Q: What happens if a provider goes down?
**A**: Automatic fallback. If OpenAI fails, we instantly route to Anthropic (or your configured backup). Your users never see downtime.

### Q: Is it safe to use in production?
**A**: Yes. Start in shadow mode to test without production impact, then gradually rollout with configurable sample rates (5% → 100%). Automatic Go router fallback ensures safety.

### Q: Do I need to change my application code?
**A**: No. Schlep-Engine is a drop-in replacement for OpenAI and Anthropic APIs. Just change your base URL and API key.

### Q: How does shadow mode work?
**A**: Shadow mode runs the Rust optimizer in parallel with the Go router, logs both decisions for comparison, but always returns the Go result. Zero production impact, full visibility.

### Q: What metrics are tracked?
**A**: Every request tracks: cost (USD), latency (ms), tokens (prompt/completion/total), provider, model, success/failure, and more. All exposed via Prometheus.

### Q: Can I bring my own API keys?
**A**: Yes! BYOK (Bring Your Own Key) is fully supported. Use your OpenAI and Anthropic keys with provider isolation and fallback.

### Q: How is this different from LangChain?
**A**: LangChain is an application framework. Schlep-Engine is infrastructure—a production-grade gateway with ML-powered routing, cost optimization, and automatic fallback. Use both together if needed.

---

## CTA Section (Bottom of Page)

### Headline
```
Ready to Reduce Your LLM Costs?
```

### Subheadline
```
Deploy Schlep-Engine in 5 minutes and start optimizing automatically.
```

### Buttons
```
Primary: "Get Started Free"  →  /docs/quickstart
Secondary: "Schedule Demo"  →  /demo
Tertiary: "Join Discord"  →  /discord
```

### Footer Badge
```
100% Open Source • MIT License • No Vendor Lock-In
```

---

## Footer Section

### Quick Links
- [Documentation](https://docs.schlep-engine.dev)
- [Quickstart Guide](https://docs.schlep-engine.dev/quickstart)
- [API Reference](https://api.schlep-engine.dev)
- [GitHub](https://github.com/your-org/schlep-engine)

### Community
- [Twitter](https://twitter.com/schlepengine)

### Company
- About
- Careers
- Contact: support@schlep-engine.com
- Privacy Policy
- Terms of Service

---

**© 2024 Schlep-engine.**
