# How Schlep-Engine Works

> Deep technical documentation for engineers

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Request Flow](#request-flow)
3. [Routing Algorithms](#routing-algorithms)
4. [Optimizer Modes](#optimizer-modes)
5. [Provider System](#provider-system)
6. [Observability](#observability)
7. [Configuration](#configuration)

---

## System Architecture

### High-Level Overview

Schlep-Engine is built as a multi-layer gateway with the following components:

```
┌─────────────────────────────────────────┐
│         API Gateway (Go/Fiber)          │  ← Entry point
├─────────────────────────────────────────┤
│       Inference Handler Layer           │  ← Request processing
├─────────────────────────────────────────┤
│   Routing Layer (Go + Rust Optimizer)  │  ← Intelligence
├─────────────────────────────────────────┤
│        Provider Interface Layer         │  ← Abstraction
├─────────────────────────────────────────┤
│    Provider Implementations (OpenAI,    │  ← Adapters
│         Anthropic, Mock, etc.)          │
└─────────────────────────────────────────┘
          ↓                    ↓
    External APIs        Observability
```

### Core Components

#### 1. API Gateway (`cmd/schlep-api/main.go`)
- **Framework**: Fiber (Go)
- **Responsibilities**:
  - HTTP request handling
  - Middleware execution (CORS, recovery, trace ID, logging)
  - Route registration
  - Error handling

**Key Files**:
- `cmd/schlep-api/main.go` - Server entry point
- `internal/api/routes_infer.go` - Inference endpoints
- `internal/api/routes_metrics.go` - Observability endpoints
- `internal/api/admin_optimizer.go` - Admin control plane

#### 2. Inference Handler (`cmd/schlep-api/handlers/infer.go`)
- **Responsibilities**:
  - Request parsing and validation
  - Optimizer mode determination
  - Router selection (Go vs Rust)
  - Response assembly
  - Metrics recording

**Key Functions**:
```go
func (h *InferHandler) HandleInfer(c *fiber.Ctx) error {
    // 1. Parse request
    var req models.InferRequest
    c.BodyParser(&req)

    // 2. Determine routing source
    mode := h.runtimeConfig.GetMode()

    // 3. Route based on mode
    if mode == "rust" && shouldSample() {
        resp, err = h.routeWithRustOptimizer(c, &req)
        if err != nil {
            // Automatic Go fallback
            resp, err = h.router.Route(c.Context(), &req)
        }
    } else {
        resp, err = h.router.Route(c.Context(), &req)
    }

    // 4. Record metrics and return
    return c.JSON(resp)
}
```

#### 3. Routing Layer

**Go Router** (`internal/inference/router/router_integration.go`):
- Policy-based provider selection
- Model-aware routing
- Optimization goal handling (latency/cost/quality)
- Fallback cascade

**Rust Optimizer** (`internal/inference/optimizer/`):
- Thompson Sampling implementation
- Beta distribution tracking per provider
- Reward calculation from metrics
- FFI integration with Go

**Shadow Runner** (`internal/inference/optimizer/shadow/shadow_runner.go`):
- Parallel execution (Go + Rust)
- Decision comparison
- Metrics logging
- Sample rate control

#### 4. Provider Layer (`internal/providers/`)

**Provider Interface**:
```go
type Provider interface {
    Name() string
    Infer(ctx, *InferRequest) (*InferResponse, error)
    InferStream(ctx, *InferRequest) (<-chan *StreamChunk, <-chan error)
    HealthCheck(ctx) error
    GetCapabilities() *ProviderCapabilities
    EstimateCost(*InferRequest) (float64, error)
    Close() error
}
```

**Implementations**:
- `openai_provider.go` - OpenAI API client
- `anthropic_provider.go` - Anthropic API client
- `mock_openai.go` - Mock provider for testing
- `*_benchmark.go` - Benchmark providers with simulated latency/cost

---

## Request Flow

### Standard Inference Request

```
1. Client → POST /v1/infer
   {
     "model": "gpt-4",
     "messages": [{"role": "user", "content": "Hello"}]
   }

2. API Gateway
   ├─ CORS validation
   ├─ Error recovery setup
   ├─ Trace ID injection
   └─ Request logging

3. InferHandler.HandleInfer()
   ├─ Parse request body → models.InferRequest
   ├─ Validate request (model, messages, etc.)
   └─ Start distributed trace

4. Determine Routing Source
   mode = GetRuntimeConfig().GetMode()

   switch mode {
   case "go":
       → Use Go Router
   case "shadow":
       → Go Router (primary)
       → Rust Optimizer (parallel, logged)
   case "rust":
       if rand() < SampleRate:
           → Try Rust Optimizer
           if error: → Automatic Go fallback
       else:
           → Use Go Router
   }

5. Provider Selection
   [Go Router Path]
   ├─ Check explicit policy override
   ├─ Model-based provider detection
   ├─ Optimization goal (latency/cost/quality)
   └─ Weighted random selection

   [Rust Optimizer Path]
   ├─ FFI call: optimizer_select_action()
   ├─ Thompson Sampling from Beta distributions
   └─ Map action ID to provider

6. Provider Execution
   provider.Infer(ctx, request)
   ├─ Inject API key
   ├─ HTTP request to LLM provider
   ├─ Parse response
   └─ Handle errors

7. Fallback (if provider fails)
   ├─ Try next available provider
   ├─ Record failure metrics
   └─ Set fallback flag in metadata

8. Response Assembly
   ├─ Calculate cost (provider cost model)
   ├─ Record metrics (latency, tokens, cost)
   ├─ Update optimizer feedback (if Rust mode)
   ├─ Add routing metadata
   └─ Return InferResponse

9. Metrics & Observability
   ├─ Record Prometheus metrics
   ├─ Update aggregated statistics
   ├─ Finish distributed trace
   └─ Log success/failure
```

### Streaming Inference Request

Similar flow with key differences:
- `req.Stream = true`
- Handler calls `router.RouteStream()` instead of `router.Route()`
- Returns Server-Sent Events (SSE) stream
- Metrics recorded on stream completion

---

## Routing Algorithms

### Go Router: Policy-Based Selection

**Priority Order**:
1. **Explicit policy override**
   ```json
   {"policy": {"provider": "openai"}}
   ```

2. **Model-based detection**
   ```
   "gpt-4" → OpenAI
   "claude-3-opus" → Anthropic
   ```

3. **Optimization goal**
   ```json
   {"policy": {"optimize_for": "latency"}}
   ```
   - `latency`: Select provider with lowest avg latency
   - `cost`: Select provider with lowest cost per token
   - `quality`: Select provider with highest reliability score

4. **Weighted random** (fallback)
   - Weight by reliability: `success_count / total_count`

**Implementation** (`internal/inference/router/router_integration.go:129-195`):
```go
func (r *InferenceRouter) selectProvider(req *InferRequest) (string, error) {
    // 1. Policy override
    if req.Policy != nil && req.Policy.Provider != "" {
        return req.Policy.Provider, nil
    }

    // 2. Model-based detection
    if provider, _ := req.GetProvider(); provider != "" {
        return provider, nil
    }

    // 3. Optimization-based
    if req.Policy != nil && req.Policy.OptimizeFor != "" {
        switch req.Policy.OptimizeFor {
        case "latency":
            return r.selectByLowestLatency(providers)
        case "cost":
            return r.selectByLowestCost(providers)
        case "quality":
            return r.selectByHighestQuality(providers)
        }
    }

    // 4. Weighted random
    return r.weightedRandomSelection(providers)
}
```

### Rust Optimizer: Thompson Sampling

**Algorithm**: Multi-Armed Bandit with Thompson Sampling

**Beta Distribution per Provider**:
- Each provider has parameters (α, β)
- Initial: α = 1.0, β = 1.0 (uniform prior)
- Updated after each request based on reward

**Selection Process**:
```rust
1. For each provider (arm):
   sample_i = Beta(α_i, β_i).sample()

2. Select provider with highest sample:
   selected = argmax(sample_i)

3. Execute inference with selected provider

4. Calculate reward from metrics:
   reward = Σ(weight_i * normalized_metric_i)

5. Update Beta distribution:
   if reward > threshold:
       α_i += 1  // Success
   else:
       β_i += 1  // Failure
```

**Reward Calculation** (`rust-core/rust_kernel/src/optimizer.rs`):
```rust
reward =
    latency_weight * (1 - latency_ms / max_latency_ms) +
    success_weight * (success ? 1.0 : 0.0) +
    cost_weight * (1 - cost_usd / max_cost_usd) +
    cache_weight * (cache_hit ? 1.0 : 0.0) +
    quality_weight * quality_score

// Default weights:
// latency: 0.4, success: 0.3, cost: 0.15, cache: 0.1, quality: 0.05
```

**Exploration vs Exploitation**:
- Thompson Sampling naturally balances exploration and exploitation
- High uncertainty (α ≈ β) → More exploration
- High confidence (α >> β or β >> α) → More exploitation

---

## Optimizer Modes

### Mode: "go" (Baseline)

**Description**: Use only Go router, no Rust optimizer

**Use Cases**:
- Initial deployment
- Debugging routing issues
- Baseline performance measurement

**Flow**:
```
Request → Go Router → Provider → Response
```

**Configuration**:
```bash
OPTIMIZER_MODE=go
```

### Mode: "shadow" (Safe Testing)

**Description**: Run Rust optimizer in parallel with Go router, log comparisons, return Go result

**Use Cases**:
- Validating Rust optimizer behavior
- Collecting comparison data
- A/B testing without production impact

**Flow**:
```
Request → Go Router (PRIMARY) → Provider → Response to Client
          ↓
          Rust Optimizer (PARALLEL) → Provider (shadow)
          ↓
          Shadow Logger (comparison data)
```

**Configuration**:
```bash
OPTIMIZER_MODE=shadow
OPTIMIZER_SAMPLE_RATE=0.1  # 10% of requests sampled
OPTIMIZER_LOG_DIR=logs/optimizer
```

**Shadow Logs** (`logs/optimizer/shadow_comparisons.jsonl`):
```json
{
  "trace_id": "abc123",
  "timestamp": "2025-10-19T12:34:56Z",
  "go_decision": "openai/gpt-4",
  "rust_decision": "anthropic/claude-3-5-sonnet",
  "agreed": false,
  "go_cost_usd": 0.002,
  "rust_cost_usd": 0.0015,
  "cost_delta_usd": -0.0005,
  "go_latency_ms": 200,
  "rust_latency_ms": 185,
  "latency_delta_ms": -15,
  "arms": [
    {"id": "openai/gpt-4", "alpha": 5.2, "beta": 1.8, "score": 0.743},
    {"id": "anthropic/claude-sonnet", "alpha": 4.1, "beta": 2.3, "score": 0.639}
  ]
}
```

**Metrics**:
- `shadow_agreement_rate` - % of requests where Go and Rust agree
- `shadow_cost_delta` - Average cost difference
- `shadow_latency_delta` - Average latency difference

### Mode: "rust" (Phased Production)

**Description**: Use Rust optimizer for sampled requests, with automatic Go fallback on errors

**Use Cases**:
- Production rollout after successful shadow testing
- Gradual activation (5% → 25% → 50% → 100%)
- ML-powered optimization in production

**Flow**:
```
Request → Sample Rate Check
          ↓
          if rand() < sample_rate:
              Rust Optimizer → Provider
              (with Go fallback on error)
          else:
              Go Router → Provider
```

**Configuration**:
```bash
OPTIMIZER_MODE=rust
OPTIMIZER_SAMPLE_RATE=0.25  # 25% use Rust, 75% use Go
```

**Rollout Strategy**:
1. Start at 5% sample rate
2. Monitor metrics for 24h
3. If SLO met: increase to 25%
4. Repeat: 50%, 75%, 100%

**Safety Features**:
- Automatic Go fallback on Rust errors
- SLO guardrails (see below)
- Instant rollback via Admin API

---

## Provider System

### Provider Interface

All providers implement the same interface for consistent behavior:

```go
type Provider interface {
    // Identifier
    Name() string  // "openai", "anthropic", "mock-openai"

    // Inference
    Infer(ctx context.Context, req *InferRequest) (*InferResponse, error)
    InferStream(ctx context.Context, req *InferRequest) (<-chan *StreamChunk, <-chan error)

    // Health & capabilities
    HealthCheck(ctx context.Context) error
    GetCapabilities() *ProviderCapabilities

    // Cost estimation
    EstimateCost(req *InferRequest) (float64, error)

    // Lifecycle
    Close() error
}
```

### Provider Registry

**File**: `internal/providers/provider_interface.go:84-125`

```go
type ProviderRegistry struct {
    providers map[string]Provider
}

// Registration
registry := NewProviderRegistry()
registry.Register(openaiProvider)
registry.Register(anthropicProvider)

// Lookup
provider, exists := registry.Get("openai")

// List all
providerNames := registry.List()  // ["openai", "anthropic", "mock-openai"]
```

### Provider Modes (PROVIDER_MODE)

**mock** - Development/Testing:
```go
mockProvider, _ := openai.NewMockOpenAIProvider(config)
// Returns simulated responses, no API calls
// Latency: ~10ms, Cost: $0.0001
```

**real** - Production with BYOK:
```go
config := &ProviderConfig{
    APIKey: os.Getenv("OPENAI_API_KEY"),
    BaseURL: "https://api.openai.com/v1",
}
realProvider, _ := openai.NewOpenAIProvider(config)
// Real API calls with your API key
```

**benchmark** - Simulated with realistic pricing:
```go
benchmarkProvider, _ := openai.NewBenchmarkOpenAIProvider(config)
// Simulates realistic latency + cost, no API calls
// GPT-4: ~200ms latency, $0.03/1K tokens (input), $0.06/1K tokens (output)
```

**hybrid** - All providers registered:
```go
// Registers: mock + real + benchmark
// Useful for testing routing logic with multiple options
```

### Fallback Mechanism

**File**: `internal/inference/router/router_integration.go:266-292`

```go
func (r *InferenceRouter) attemptFallback(ctx, req, failedProvider) (*InferResponse, error) {
    providerNames := r.registry.List()

    for _, name := range providerNames {
        if name == failedProvider {
            continue  // Skip failed provider
        }

        provider, _ := r.registry.Get(name)
        resp, err := provider.Infer(ctx, req)

        if err == nil {
            r.recordSuccess(name, latency)
            resp.Metadata.Fallback = true
            return resp, nil
        }

        r.recordFailure(name)
    }

    return nil, fmt.Errorf("all fallback providers failed")
}
```

**Behavior**:
1. Primary provider fails
2. Try each remaining provider in registry order
3. Return first successful response
4. Mark `response.Metadata.Fallback = true`
5. Record failure metrics for all failed providers

---

## Observability

### Prometheus Metrics

**Endpoint**: `GET /metrics`

**Key Metrics**:

```prometheus
# HTTP requests
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}

# Inference requests
infer_requests_total{provider, model, status}
infer_request_latency_ms{provider, model}
infer_tokens_used{provider, model, token_type}
infer_cost_usd{provider, model}

# Rust FFI
rust_ffi_calls_total{function}
rust_ffi_duration_microseconds{function}

# Model routing
model_selection_total{model_id, runtime, strategy}
model_performance_total{model_id, runtime, result}

# Shadow mode
shadow_agreement_total
shadow_cost_delta_usd
shadow_latency_delta_ms
```

### Distributed Tracing

**Implementation**: `internal/tracing/tracer.go`

**Trace ID Flow**:
```
1. Request arrives → Generate trace ID
2. Store in context → Propagate through layers
3. Add to all log entries → Correlation
4. Return in X-Trace-ID header → Client visibility
```

**Spans**:
- `inference_execute` - Main inference operation
- `router_select` - Provider selection
- `provider_infer` - External LLM call
- `optimizer_decide` - Rust optimizer decision

**Attributes**:
```go
tracing.AddAttribute(ctx, "provider", "openai")
tracing.AddAttribute(ctx, "model", "gpt-4")
tracing.AddAttribute(ctx, "latency_ms", latencyMs)
tracing.AddAttribute(ctx, "tokens", totalTokens)
tracing.AddAttribute(ctx, "cost_usd", costUSD)
tracing.AddAttribute(ctx, "decision_source", "rust_optimizer")
```

### Aggregated Metrics

**Endpoint**: `GET /v1/metrics`

**In-Memory Collector** (`internal/metrics/collector.go`):
- Sliding window of last 1000 latency samples per provider:model
- Percentile calculation (P50, P95, P99)
- Background cleanup of old samples (>1 hour)

**Response**:
```json
{
  "provider_metrics": {
    "openai": {
      "gpt-4": {
        "request_count": 1523,
        "success_count": 1520,
        "error_count": 3,
        "total_tokens": 45680,
        "total_cost_usd": 0.9136,
        "avg_latency_ms": 234.5,
        "p50_latency_ms": 215.0,
        "p95_latency_ms": 420.0,
        "p99_latency_ms": 580.0,
        "last_updated": "2025-10-19T12:34:56Z"
      }
    }
  },
  "top_providers": [
    {"provider": "openai", "model": "gpt-4", "request_count": 1523},
    {"provider": "anthropic", "model": "claude-3-sonnet", "request_count": 892}
  ]
}
```

---

## Configuration

### Environment Variables

**File**: `internal/config/config.go`, `internal/config/optimizer_config.go`

```bash
# Server
PORT=8080                    # HTTP server port
DEBUG=true                   # Enable debug logging

# Providers
PROVIDER_MODE=real           # mock | real | benchmark | hybrid
OPENAI_API_KEY=sk-...       # OpenAI API key (BYOK)
ANTHROPIC_API_KEY=sk-ant-... # Anthropic API key (BYOK)

# Optimizer
OPTIMIZER_MODE=shadow        # go | shadow | rust
OPTIMIZER_SAMPLE_RATE=0.1    # 0.0 to 1.0
OPTIMIZER_LOG_DIR=logs/optimizer

# Admin API
ADMIN_TOKEN=your-secret-token  # Admin API authentication

# Observability
METRICS_ENABLED=true
TRACING_ENABLED=true
LOG_LEVEL=info               # debug | info | warn | error
```

### Runtime Configuration (Hot-Reload)

**File**: `internal/config/optimizer_config.go:19-143`

**Thread-Safe Access**:
```go
type RuntimeOptimizerConfig struct {
    mu         sync.RWMutex
    mode       shadow.ShadowMode
    sampleRate float64
    updatedAt  time.Time
}

// Read (multiple goroutines safe)
mode := config.GetMode()
sampleRate := config.GetSampleRate()

// Write (atomic with locking)
config.SetMode(shadow.ShadowModeRust)
config.SetSampleRate(0.5)
```

**Hot-Reload via Admin API**:
```bash
curl -X POST http://localhost:8080/admin/optimizer \
  -H "X-Admin-Token: your-secret" \
  -d '{"mode": "rust", "sample_rate": 0.75}'

# Response (changes applied immediately)
{
  "status": "ok",
  "current_mode": "rust",
  "sample_rate": 0.75,
  "timestamp": "2025-10-19T12:34:56Z"
}
```

**No Restart Required**: Changes apply to all new requests immediately.

---

## SLO Guardrails

**File**: `internal/inference/optimizer/slo_breaker.go`

**Purpose**: Automatically disable Rust optimizer if it underperforms Go router

**Thresholds** (configurable):
```go
type SLOThresholds struct {
    MaxP95LatencyDelta  float64  // 100ms - Rust can't be >100ms slower than Go
    MaxErrorRateDelta   float64  // 0.01 - Rust error rate can't exceed Go by >1%
    MaxCostDelta        float64  // 0.0005 - Rust can't cost >$0.0005 more per request
    MinSampleCount      int      // 100 - Minimum samples before decision
}
```

**Check Logic**:
```go
func (s *SLOBreaker) CheckAndEnforce() {
    if s.sampleCount < s.thresholds.MinSampleCount {
        return  // Not enough data
    }

    rustP95 := s.calculateP95(s.rustLatencies)
    goP95 := s.calculateP95(s.goLatencies)

    if rustP95 - goP95 > s.thresholds.MaxP95LatencyDelta {
        s.disableRustOptimizer("P95 latency SLO breach")
    }

    if s.rustErrorRate - s.goErrorRate > s.thresholds.MaxErrorRateDelta {
        s.disableRustOptimizer("Error rate SLO breach")
    }
}
```

**Actions on Breach**:
1. Log alert with metrics
2. Optionally disable Rust optimizer (configurable)
3. Send notification (if configured)
4. Continue monitoring

---

## Code References

**Main Entry Points**:
- Server: `cmd/schlep-api/main.go:15-72`
- Handler: `cmd/schlep-api/handlers/infer.go:199-369`

**Routing**:
- Go Router: `internal/inference/router/router_integration.go:52-103`
- Rust Optimizer: `internal/inference/optimizer/shadow/shadow_runner.go:124-203`
- FFI Wrapper: `internal/inference/optimizer/ffi/ffi_wrapper.go:98-204`

**Providers**:
- Interface: `internal/providers/provider_interface.go:12-37`
- OpenAI: `internal/providers/openai/openai_provider.go`
- Anthropic: `internal/providers/anthropic/anthropic_provider.go`

**Observability**:
- Metrics: `internal/observability/metrics.go:13-540`
- Collector: `internal/metrics/collector.go:59-388`
- Tracing: `internal/tracing/tracer.go`

**Configuration**:
- Static: `internal/config/config.go:83-131`
- Runtime: `internal/config/optimizer_config.go:19-143`
- Admin API: `internal/api/admin_optimizer.go:42-206`

---

**Last Updated**: 2025-10-19
**Version**: Extracted from codebase
