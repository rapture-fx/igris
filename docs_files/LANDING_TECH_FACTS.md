# LANDING PAGE TECHNICAL FACTS

## CORE FEATURES

- OpenAI-compatible chat completions API (`/v1/chat/completions`, `/v1/infer`)
- Multi-provider inference routing (OpenAI, Anthropic models)
- Benchmark mode: simulate provider API calls without external requests or costs
- Real provider mode: live API integration (Phase 12+)
- Thompson Sampling-based optimization using multi-armed bandit algorithm
- Phased Rust optimizer activation with admin-controlled rollout (1% → 100%)
- Shadow mode: parallel Rust decision-making without affecting live traffic
- Automatic fallback: Rust optimizer failures gracefully revert to Go router
- Hot-reload configuration via Admin API (no service restart required)
- Server-sent events (SSE) streaming support
- Request-level policy control (provider override, optimization goals)
- Centralized cost modeling with official OpenAI and Anthropic pricing

## DEVELOPER CAPABILITIES

- Drop-in replacement for OpenAI API clients
- Per-request optimization control: `optimize_for: latency|cost|quality`
- Explicit provider override via `policy.provider` field
- Fallback control: enable/disable automatic provider failover
- Response metadata includes: provider used, model executed, latency (ms), cost (USD), routing decision
- Cost estimation before execution (planned endpoint)
- Trace ID in every response for distributed tracing
- Health check and provider statistics endpoints
- Prometheus metrics export at `/metrics`
- Batch inference support (architecture ready, not yet exposed)

## SUPPORTED MODELS & MODES

### OpenAI Models (Benchmark + Real)
- gpt-4 (input: $0.03/1K tokens, output: $0.06/1K)
- gpt-4-turbo (input: $0.01/1K, output: $0.03/1K)
- gpt-3.5-turbo (input: $0.0005/1K, output: $0.0015/1K)

### Anthropic Models (Benchmark + Real)
- claude-3-opus-20240229 (input: $0.015/1K, output: $0.075/1K)
- claude-3-sonnet-20240229 (input: $0.003/1K, output: $0.015/1K)
- claude-3-haiku-20240307 (input: $0.00025/1K, output: $0.00125/1K)

### Generation Modes
- Standard completion (non-streaming)
- Streaming with Server-Sent Events (SSE)
- Batch requests (architecture ready)

### Optimization Modes
- Latency-optimized: selects fastest provider/model
- Cost-optimized: selects cheapest provider/model
- Quality-optimized: selects most reliable provider
- Multi-factor: Thompson Sampling combines cost, latency, quality

### Provider Modes (Environment Variable: PROVIDER_MODE)
- `mock`: simple testing with instant responses
- `benchmark`: realistic simulation with latency profiles, no external API calls
- `real`: live provider API calls (Phase 12+)
- `hybrid`: all providers enabled simultaneously

## SAFETY & CONTROL MECHANISMS

### Phased Activation System
- Admin API: `POST /admin/optimizer` sets mode and sample rate
- Modes: `go` (baseline), `shadow` (validation), `rust` (optimization active)
- Sample rate: 0.0 to 1.0 (percentage of traffic using Rust optimizer)
- Instant effect: configuration changes apply without restart
- Rollout path: shadow mode (0% impact) → 1% → 10% → 25% → 50% → 100%

### Automatic Guardrails (SLO Breakers)
- P95 latency increase >10%: automatic revert to Go router
- Cost increase >5%: automatic revert to Go router
- Error rate increase >0.5%: automatic revert to Go router
- Operator must investigate and manually re-enable after breach

### Fault Tolerance
- Rust FFI failures: caught at boundary, no panic propagation
- Go router fallback: automatic on Rust optimizer errors
- Request validation: schema enforcement before provider routing
- Provider health checks: continuous monitoring

### Shadow Mode (Non-Invasive Testing)
- Go router operates normally (authoritative)
- Rust optimizer runs in parallel goroutine (non-blocking)
- Decisions compared and logged to JSONL files
- Zero impact on user requests
- Metrics: agreement rate, cost delta, latency delta

## ARCHITECTURE ELEMENTS

### Polyglot Stack
- Go: HTTP gateway, request routing, provider orchestration (10K RPS capable)
- Rust: FFI-based optimizer core using Thompson Sampling
- Python: ML service via gRPC (Phase 12+)

### Provider Interface
- Unified provider abstraction: all providers implement same interface
- Methods: `Infer()`, `InferStream()`, `HealthCheck()`, `EstimateCost()`, `Close()`
- Dynamic registration: add new providers without code changes
- Capabilities declaration: each provider advertises supported features

### Routing Logic
1. Explicit policy override (if `Policy.Provider` specified)
2. Model-based detection (gpt* → openai, claude* → anthropic)
3. Optimization-based selection (uses Thompson Sampling)
4. Default provider (OpenAI)

### Metrics & Observability
- Prometheus metrics: requests, latency, tokens, cost, quality scores
- Distributed tracing: trace ID per request, spans for each operation
- Structured logging: JSON output with request/response details
- Provider statistics: per-provider success rate, latency histograms

### Benchmark Provider Simulation
- Realistic latency profiles: P50/P95/P99 percentiles per model
- Time-to-first-token (TTFT) simulation for streaming
- Consistent token estimation: 1 token ≈ 4 characters
- Configurable error injection: default 5% failure rate
- Offline operation: no network calls, reproducible results

## EXAMPLE API USAGE

### Basic Inference Request
```bash
POST /v1/infer
Content-Type: application/json

{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "What is 2+2?"}
  ],
  "max_tokens": 500,
  "temperature": 0.7
}
```

### Response Format
```json
{
  "id": "req-trace-123",
  "model": "gpt-4",
  "choices": [{
    "message": {"role": "assistant", "content": "..."},
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 123,
    "total_tokens": 168
  },
  "metadata": {
    "provider": "benchmark-openai",
    "latency_ms": 1234,
    "cost_usd": 0.003642,
    "route_decision": "optimization metadata"
  }
}
```

### Cost-Optimized Request
```bash
POST /v1/infer
{
  "model": "gpt-3.5-turbo",
  "messages": [...],
  "policy": {
    "optimize_for": "cost"
  }
}
```

### Provider Override
```bash
POST /v1/infer
{
  "model": "custom-model",
  "messages": [...],
  "policy": {
    "provider": "anthropic",
    "fallback_enabled": true
  }
}
```

### Streaming Request
```bash
POST /v1/infer
{
  "model": "gpt-4",
  "messages": [...],
  "stream": true
}

# Response: Server-Sent Events
data: {"choices": [{"delta": {"content": "Hello"}}]}
data: {"choices": [{"delta": {"content": " world"}}]}
data: [DONE]
```

### Admin Optimizer Control
```bash
# Update optimizer mode
POST /admin/optimizer
X-Admin-Token: <token>
{
  "mode": "rust",
  "sample_rate": 0.25
}

# Check status
GET /admin/optimizer/status
X-Admin-Token: <token>

# Response
{
  "current_mode": "rust",
  "sample_rate": 0.25,
  "arm_stats": [
    {"action_id": "openai/gpt-4", "alpha": 120.5, "beta": 15.2}
  ]
}
```

### Health Check
```bash
GET /v1/health

# Response
{
  "status": "healthy",
  "timestamp": 1729123200,
  "providers": 3
}
```

### Metrics Export
```bash
GET /metrics

# Prometheus format
schlep_infer_requests_total{provider="benchmark-openai",model="gpt-4",status="success"} 1523
schlep_infer_latency_ms{provider="benchmark-openai",model="gpt-4"} 1234
schlep_infer_cost_usd{provider="benchmark-openai",model="gpt-4"} 0.003642
optimizer_rust_decisions_total 342
optimizer_go_fallbacks_total{reason="rust_error"} 12
```

## DEPLOYMENT CONFIGURATION

### Required Environment Variables
- `PROVIDER_MODE`: mock|benchmark|real|hybrid
- `OPTIMIZER_MODE`: go|shadow|rust
- `OPTIMIZER_SAMPLE_RATE`: 0.0 to 1.0
- `ADMIN_TOKEN`: authentication token for admin API
- `PORT`: HTTP server port (default: 8080)

### Benchmark Mode Features
- No external API calls
- No provider credentials required
- Realistic latency simulation (P50/P95/P99 per model)
- Accurate cost calculation using official pricing
- Offline operation for testing and development

### Real Provider Mode (Phase 12+)
- Requires API credentials: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- Live rate limit handling
- Connection validation before routing
- Hybrid fallback: benchmark → real provider

## TECHNICAL DIFFERENTIATORS

- Zero-cost benchmarking: test optimization logic without paying for API calls
- Safe phased rollout: 1% → 100% traffic with automatic safety guardrails
- Non-invasive shadow mode: validate changes with zero user impact
- Multi-factor Thompson Sampling: optimizes cost, latency, and quality simultaneously
- Hot-reload configuration: mode and sample rate changes take effect instantly
- Automatic Rust fallback: optimizer failures never affect user requests
- Provider-agnostic design: unified interface for any LLM provider
- Centralized cost model: single source of truth for pricing calculations
- Distributed tracing: trace ID propagation for request correlation
- OpenAI API compatibility: drop-in replacement for existing clients

## KNOWN LIMITATIONS (CURRENT PHASE)

- Streaming currently aggregates to single response (true SSE in Phase 12)
- Real provider API calls not yet active (Phase 12 feature)
- Batch inference API not yet exposed (architecture ready)
- Python gRPC ML service integration pending (Phase 13)
- Cost estimation endpoint planned but not implemented
- Multi-region failover architecture designed but not deployed
