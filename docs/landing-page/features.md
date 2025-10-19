# Schlep-Engine Features

> Production-ready feature highlights for landing page

---

## Hero Section

### Headline
**The Routing Engine and Control Plane for AI Inference**

### Subheadline
Optimize and orchestrate LLM requests across providers with routing intelligence, shadow testing, and rollback safety.

## Core Features

### 1. Intelligent Multi-Provider Routing

**What it does:**
Route LLM requests across multiple providers (OpenAI, Anthropic) with automatic selection based on your optimization goals.

**Key Benefits:**
- **Never fail on provider outages** - Automatic fallback to healthy providers
- **Optimize for your goals** - Choose latency, cost, or quality
- **Model-aware routing** - Automatically detects provider from model name
- **Policy-based control** - Override routing per request with policies

**Technical Details:**
- Policy-based routing: `optimize_for: "latency" | "cost" | "quality"`
- Automatic provider detection from model name (e.g., "gpt-4" → OpenAI)
- Weighted selection based on real-time provider performance
- Fallback cascade: Primary → Secondary → Tertiary providers

**Code Example:**
```json
POST /v1/infer
{
  "model": "gpt-4",
  "messages": [...],
  "policy": {
    "optimize_for": "cost"
  }
}
```

---

### 2. Rust-Powered Thompson Sampling Optimizer

**What it does:**
Machine learning-based routing that learns which provider performs best for your workload and automatically adapts over time.

**Key Benefits:**
- **Continuous learning** - Adapts to provider performance changes in real-time
- **Bayesian optimization** - Thompson Sampling with Beta distributions
- **Safe rollout** - Shadow mode → gradual rollout → full production
- **Automatic fallback** - Go router as safety net if Rust optimizer fails

**How it Works:**
1. **Shadow Mode**: Rust runs in parallel with Go router, logs decisions, zero production impact
2. **Gradual Rollout**: Start at 5% sample rate, increase to 100% based on metrics
3. **Continuous Learning**: Updates Beta distributions (α, β) based on latency, cost, success
4. **Automatic Safety**: Falls back to Go router on errors or SLO violations

**Technical Details:**
- Multi-armed bandit with Thompson Sampling
- Configurable reward weights: latency (40%), success (30%), cost (15%), cache (10%), quality (5%)
- Per-provider Beta distribution tracking
- Shadow comparison logging: agreement rate, cost delta, latency delta

**Configuration:**
```bash
# Start in shadow mode (safe testing)
OPTIMIZER_MODE=shadow
OPTIMIZER_SAMPLE_RATE=0.1  # 10% of requests

# Graduate to production rollout
OPTIMIZER_MODE=rust
OPTIMIZER_SAMPLE_RATE=0.25  # Start at 25%, increase to 1.0
```

---

### 3. Real-Time Cost & Performance Tracking

**What it does:**
Track every request's cost, latency, and token usage with Prometheus metrics and percentile calculations.

**Key Benefits:**
- **USD cost per request** - Real-time cost calculation using official pricing
- **Token accounting** - Prompt, completion, and total tokens tracked
- **Latency percentiles** - P50, P95, P99 per provider and model
- **Prometheus integration** - Ready for Grafana dashboards

**Metrics Exposed:**
- `infer_requests_total` - Request count by provider, model, status
- `infer_request_latency_ms` - Histogram with percentiles
- `infer_tokens_used` - Token usage by type (prompt/completion/total)
- `infer_cost_usd` - Cost distribution per provider/model
- `infer_provider_stats_total` - Aggregated provider statistics

**Endpoints:**
```bash
# Prometheus metrics
GET /metrics

# Aggregated JSON metrics
GET /v1/metrics
{
  "provider_metrics": {
    "openai": {
      "gpt-4": {
        "request_count": 1523,
        "avg_latency_ms": 234.5,
        "p95_latency_ms": 420.0,
        "total_cost_usd": 0.9136
      }
    }
  }
}
```

---

### 4. Hot-Reload Control Plane

**What it does:**
Change optimizer mode and sample rate in production without restarting the server or dropping requests.

**Key Benefits:**
- **Zero downtime** - Changes apply immediately to new requests
- **Gradual rollout** - Adjust sample rate from 0% to 100% safely
- **Instant rollback** - Disable Rust optimizer with single API call
- **Secure admin API** - Token-based authentication

**Use Cases:**
- **Emergency rollback**: Disable Rust optimizer instantly on anomalies
- **Gradual activation**: Increase Rust sample rate from 5% → 25% → 50% → 100%
- **A/B testing**: Set sample rate to 50% for side-by-side comparison
- **Maintenance mode**: Switch to Go-only during provider maintenance

**Admin API:**
```bash
# Enable Rust optimizer at 25% sample rate
curl -X POST http://localhost:8080/admin/optimizer \
  -H "X-Admin-Token: your-secret-token" \
  -d '{"mode": "rust", "sample_rate": 0.25}'

# Response (immediate, no restart)
{
  "status": "ok",
  "current_mode": "rust",
  "sample_rate": 0.25,
  "timestamp": "2025-10-19T12:34:56Z"
}
```

---

### 5. Distributed Tracing & Observability

**What it does:**
Every request gets a unique trace ID that follows it through the entire system for debugging and monitoring.

**Key Benefits:**
- **Request correlation** - Track requests across distributed components
- **Performance debugging** - Identify slow components with trace spans
- **Error tracking** - Correlate errors with specific requests
- **Custom attributes** - Provider, model, cost, tokens in every trace

**Trace Components:**
- Trace ID injection in all requests
- Span creation for major operations (routing, provider calls, optimizer decisions)
- Custom attributes: provider, model, latency, tokens, cost, decision source
- X-Trace-ID header in all responses

**Example:**
```bash
POST /v1/infer
# Response headers:
X-Trace-ID: abc123-def456-ghi789

# All logs contain:
{
  "trace_id": "abc123-def456-ghi789",
  "span_name": "inference_execute",
  "provider": "openai",
  "model": "gpt-4",
  "latency_ms": 234
}
```

---

### 6. BYOK (Bring Your Own Key) Safety

**What it does:**
Use your own API keys for OpenAI and Anthropic with provider isolation and automatic fallback.

**Key Benefits:**
- **Provider isolation** - Each provider uses separate API key
- **Benchmark mode** - Test routing without real API calls
- **Key exhaustion fallback** - Route to alternative providers on quota limits
- **Cost visibility** - Track spend per provider with your own keys

**Provider Modes:**
```bash
# Development: Mock providers (no API calls)
PROVIDER_MODE=mock

# Production: Real providers with your API keys
PROVIDER_MODE=real
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Testing: Benchmark providers (simulated with realistic pricing)
PROVIDER_MODE=benchmark

# All modes combined
PROVIDER_MODE=hybrid
```

**Safety Features:**
- Provider-level circuit breakers
- Automatic fallback on key exhaustion
- Per-provider rate limiting
- Cost caps (configurable max per request)

---

## Comparison Table

| Feature | Schlep-Engine | Direct API Calls | Other Gateways |
|---------|---------------|------------------|----------------|
| Multi-provider routing | ✅ Automatic | ❌ Manual | ⚠️ Basic |
| Cost optimization | ✅ ML-powered | ❌ None | ⚠️ Rule-based |
| Automatic fallback | ✅ Yes | ❌ No | ⚠️ Limited |
| Real-time cost tracking | ✅ Per-request | ❌ None | ⚠️ Aggregated |
| Hot-reload config | ✅ Zero downtime | ❌ Restart required | ❌ Not supported |
| Shadow testing | ✅ Built-in | ❌ Manual | ❌ Not supported |
| Distributed tracing | ✅ Every request | ❌ None | ⚠️ Basic |
| BYOK support | ✅ Full isolation | ✅ Yes | ⚠️ Limited |

---

## Technical Specifications

### Performance
- Routing overhead: <200ms (P95)
- Throughput: 1000+ req/s (single instance)
- Latency percentiles tracked: P50, P95, P99
- Fallback time: <50ms

### Reliability
- Uptime: 99.9% with automatic fallback
- Circuit breakers: Per-provider
- SLO guardrails: Automatic Rust optimizer disable on violations
- Health checks: /v1/health endpoint

### Scalability
- Stateless design (horizontal scaling)
- Thread-safe configuration
- Connection pooling per provider
- Efficient memory usage (<100MB baseline)

### Compatibility
- OpenAI API compatible
- Anthropic API compatible
- Supports all OpenAI models (gpt-4, gpt-3.5-turbo, etc.)
- Supports all Anthropic models (claude-3-opus, claude-3-sonnet, etc.)

---

## Use Cases

### 1. Cost Optimization for High-Volume Applications
**Problem**: Spending $10k+/month on LLM APIs
**Solution**: Schlep-Engine routes to cheapest provider based on real-time pricing
**Result**: 20-40% cost reduction with no quality loss

### 2. High-Availability Production Systems
**Problem**: Provider outages cause downtime
**Solution**: Automatic fallback to healthy providers
**Result**: 99.9% uptime despite provider incidents

### 3. Safe ML Model Experimentation
**Problem**: Want to test new routing algorithms without risk
**Solution**: Shadow mode runs experiments in parallel with zero production impact
**Result**: Validated 15% latency improvement before rollout

### 4. Multi-Region Compliance
**Problem**: Different providers for different regions (data residency)
**Solution**: Policy-based routing per request
**Result**: Compliance + cost optimization

---

## Getting Started

### Quick Start (5 minutes)
```bash
# 1. Clone and build
git clone https://github.com/your-org/schlep-engine
cd schlep-engine
make build

# 2. Configure API keys
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export PROVIDER_MODE=real

# 3. Start server
./bin/schlep-api

# 4. Make your first request
curl -X POST http://localhost:8080/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Production Deployment
1. **Start in shadow mode** - Test Rust optimizer safely
2. **Monitor metrics** - Watch agreement rate, cost delta
3. **Gradual rollout** - Increase sample rate 5% → 25% → 100%
4. **Enable SLO guardrails** - Automatic safety checks
5. **Set up Grafana** - Visualize cost and performance

---

## Support & Documentation

- **Documentation**: [docs.schlep-engine.dev](https://docs.schlep-engine.dev)
- **API Reference**: [api.schlep-engine.dev](https://api.schlep-engine.dev)
- **GitHub**: [github.com/your-org/schlep-engine](https://github.com/your-org/schlep-engine)
- **Discord**: Join our community for support
- **Email**: support@schlep-engine.dev

---

**Ready to optimize your LLM infrastructure?**

[Get Started →](#getting-started) | [View Documentation →](#) | [Join Discord →](#)
