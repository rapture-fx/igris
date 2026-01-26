# Igris Overture Tier System

## Authority Progression Model

The Igris Overture tier system follows an **authority progression model** where each tier grants increasing levels of control over routing decisions:

| Tier | Authority Level | Description |
|------|----------------|-------------|
| **Hacker** ($0/mo) | `observe` | Read-only visibility into routing decisions and metrics |
| **Startup** ($79/mo) | `influence` | Configure routing behavior without autonomous execution |
| **Growth** ($249/mo) | `enforce` | System-enforced policies with audit trails and mitigations |
| **Scale** (Custom) | `prove` | Cryptographic guarantees, compliance evidence, regulator-ready logs |

## Authority Levels Explained

### OBSERVE (Hacker Tier)

The Hacker tier provides **read-only visibility** into the routing system:

- View routing decisions and metrics
- Basic cost/latency optimization
- Automatic failover and circuit breaker
- 7-day audit log retention
- **Cannot** configure routing behavior
- **Cannot** use Thompson Sampling (live exploration)
- **Cannot** use speculative execution or council mode

**Rate Limits**: 5 RPS / 150 RPM / 2 concurrent

### INFLUENCE (Startup Tier)

The Startup tier allows you to **configure routing preferences**:

- Configure routing modes and provider preferences
- Historical metrics inform decisions (no live exploration)
- Semantic routing for intent-based model selection
- Cost forecasting
- 14-day audit log retention
- **Manual-only** cognitive advisor (no auto-apply)
- **Non-cryptographic** execution telemetry

**Rate Limits**: 10 RPS / 300 RPM / 5 concurrent

### ENFORCE (Growth Tier)

The Growth tier enables **autonomous decision enforcement**:

- Thompson Sampling (live exploration)
- Speculative execution (parallel provider racing)
- Council mode (multi-LLM consensus)
- Cognitive Advisor with auto-apply and rollback protection
- SLO monitoring with guarded enforcement
- Policy versioning and hot reload
- Real-time analytics
- 30-day audit log retention
- Multi-tenancy support

**Rate Limits**: 50 RPS / 1500 RPM / 50 concurrent

### PROVE (Scale Tier)

The Scale tier provides **cryptographic guarantees**:

- Ed25519-signed routing decisions
- Signed decision-to-execution contracts
- Tamper-evident audit logs
- Compliance-ready execution trails
- Advanced SLO with auto-remediation
- 90-day audit log retention
- SSO integration
- On-premise deployment option
- Multi-region support

**Rate Limits**: 1000 RPS / 60000 RPM / 1000 concurrent

## Feature Matrix

### Routing & Optimization

| Feature | Hacker | Startup | Growth | Scale |
|---------|--------|---------|--------|-------|
| Cost-aware routing | ✅ | ✅ | ✅ | ✅ |
| Automatic failover | ✅ | ✅ | ✅ | ✅ |
| Circuit breaker | ✅ | ✅ | ✅ | ✅ |
| Semantic routing | ❌ | ✅ | ✅ | ✅ |
| Thompson Sampling | ❌ | ❌ | ✅ | ✅ |
| Speculative execution | ❌ | ❌ | ✅ | ✅ |
| Council mode | ❌ | ❌ | ✅ | ✅ |

### Cognitive Advisor

| Feature | Hacker | Startup | Growth | Scale |
|---------|--------|---------|--------|-------|
| View proposals | ✅ | ✅ | ✅ | ✅ |
| Manual apply | ❌ | ✅ | ✅ | ✅ |
| Auto-apply with rollback | ❌ | ❌ | ✅ | ✅ |

### Cryptographic Features

| Feature | Hacker | Startup | Growth | Scale |
|---------|--------|---------|--------|-------|
| Execution telemetry | Non-cryptographic | Non-cryptographic | Non-cryptographic | **Signed** |
| Routing decision signing | ❌ | ❌ | ❌ | ✅ |
| Signed execution envelopes | ❌ | ❌ | ❌ | ✅ |
| Tamper-evident logs | ❌ | ❌ | ❌ | ✅ |

### Governance & Compliance

| Feature | Hacker | Startup | Growth | Scale |
|---------|--------|---------|--------|-------|
| Audit logs | ✅ (7 days) | ✅ (14 days) | ✅ (30 days) | ✅ (90 days) |
| SLO monitoring | ❌ | ✅ (view only) | ✅ (guarded) | ✅ (auto-remediation) |
| Policy versioning | ❌ | ❌ | ✅ | ✅ |
| Hot reload policies | ❌ | ❌ | ✅ | ✅ |
| RBAC | ❌ | ❌ | ✅ | ✅ |
| SSO | ❌ | ❌ | ❌ | ✅ |

## Unkillable Resilience Suite

**FREE for ALL tiers** - these core survival features are never paywalled:

- **Gold Code Override** (BYOK_BYPASS_CONTROL_PLANE) - Direct provider access when control plane is unavailable
- **EscapeVector Mode** (TypeScript + Rust WASM) - Client-side fallback routing
- **Emergency Hotfix** - Blob fetching & application
- **72-hour encrypted Bayesian cache** - Continue routing during outages

> "Core survival is free forever. Superpowers cost money."

## API Endpoint: GET /api/v1/tier/capabilities

Returns the capabilities (features and limits) for the authenticated tenant's tier.

**Response Example (Growth tier):**

```json
{
  "tier": "growth",
  "display_name": "Growth",
  "authority_level": "enforce",
  "description": "Enforce decisions with accountability and audit trails",
  "features": {
    "thompson_sampling": true,
    "semantic_routing": true,
    "cost_aware_routing": true,
    "automatic_failover": true,
    "circuit_breaker": true,
    "speculative_execution": true,
    "council_mode": true,
    "cognitive_advisor": true,
    "cognitive_auto_apply": true,
    "cryptographic_signing": false,
    "signed_execution_envelopes": false,
    "tamper_evident_logs": false,
    "escapevector_mode": true,
    "emergency_hotfix": true,
    "gold_code_override": true,
    "rust_wasm_fallback": true
  },
  "limits": {
    "max_requests_per_month": 2000000,
    "max_requests_per_second": 50,
    "max_requests_per_minute": 1500,
    "max_concurrent_requests": 50,
    "max_providers": 10,
    "audit_log_retention_days": 30
  },
  "cost_controls": {
    "enforce_budget": true,
    "monthly_budget_usd": 500.00,
    "budget_alert_threshold": 0.75
  }
}
```

## Tier Enforcement

Tier limits and feature access are enforced at multiple levels:

1. **Middleware** - `TierEnforcer` middleware checks tier on every request
2. **Route-level** - Specific endpoints are gated by feature flags
3. **Function-level** - Critical functions like `RouteSpeculative()` and `RouteCouncil()` check tier before execution
4. **Config-level** - Auto-apply config endpoints prevent lower tiers from enabling premium features

## Upgrading

When your usage exceeds 120% of your tier limit and the overage cost exceeds the next tier's price, the system may suggest or automatically trigger an upgrade.

To upgrade manually, contact sales or use the self-service upgrade at `/api/v1/account/upgrade`.
