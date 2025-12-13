# Schlep-Engine Architecture Map

**Purpose**: Technical reference for generating accurate architecture diagrams for landing page and documentation.

**Version**: Extracted from codebase on 2025-10-19

---

## System Overview

Schlep-Engine is an **LLM inference gateway** with intelligent routing and cost optimization. It provides:
- Unified API compatible with OpenAI and Anthropic
- Multi-provider routing with automatic fallback
- Rust-powered Thompson Sampling optimizer (with phased rollout)
- Real-time cost and latency tracking
- Hot-reload control plane for zero-downtime configuration changes

---

## Core Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/JSON
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Fiber/Go)                        │
│  - Entry: cmd/igris-overture/main.go                                │
│  - Middleware: CORS, Recovery, TraceID, Logging, Metrics        │
│  - Routes: /v1/infer, /v1/health, /metrics, /admin/*            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   INFERENCE HANDLER LAYER                        │
│  - File: cmd/igris-overture/handlers/infer.go                       │
│  - InferHandler.HandleInfer()                                   │
│  - Determines: Go Router vs Rust Optimizer                      │
│  - Handles: Streaming & Non-streaming requests                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ↓                             ↓
┌─────────────────────┐       ┌─────────────────────┐
│   GO ROUTER         │       │  RUST OPTIMIZER     │
│  (Temporary)        │       │  (Thompson Sampling)│
│                     │       │                     │
│ File:               │       │ Files:              │
│ router_integration  │       │ shadow_runner.go    │
│                     │       │ ffi_wrapper.go      │
│                     │       │ (CGO → Rust lib)    │
│ Logic:              │       │                     │
│ - Policy-based      │       │ Logic:              │
│ - Latency/cost/     │       │ - Beta distribution │
│   quality optimized │       │ - Multi-armed bandit│
│ - Weighted random   │       │ - Reward feedback   │
└──────────┬──────────┘       └──────────┬──────────┘
           │                             │
           │     ┌───────────────────────┘
           │     │ Shadow Mode: Runs both in parallel
           │     │ Rust Mode: Primary with Go fallback
           ↓     ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PROVIDER INTERFACE LAYER                      │
│  - File: internal/providers/provider_interface.go               │
│  - Interface: Infer(), InferStream(), HealthCheck()             │
│  - Registry: Manages provider instances                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ↓              ↓              ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   OPENAI     │  │  ANTHROPIC   │  │    MOCK      │
│  PROVIDER    │  │   PROVIDER   │  │   PROVIDER   │
│              │  │              │  │              │
│ Real API     │  │  Real API    │  │  No API call │
│ Benchmark    │  │  Benchmark   │  │  Simulated   │
│ (simulated)  │  │  (simulated) │  │  responses   │
└──────────────┘  └──────────────┘  └──────────────┘
          │              │              │
          └──────────────┼──────────────┘
                         │ LLM API Calls
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              EXTERNAL LLM PROVIDERS (OpenAI, Anthropic)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Inference Endpoints
| Endpoint | Method | Description | File |
|----------|--------|-------------|------|
| `/v1/infer` | POST | Main inference endpoint | `internal/api/routes_infer.go:25` |
| `/v1/chat/completions` | POST | OpenAI-compatible alias | `internal/api/routes_infer.go:29` |
| `/v1/health` | GET | Health check | `internal/api/routes_infer.go:33` |
| `/v1/models` | GET | List available models | `internal/api/routes_infer.go:37` |
| `/v1/providers/stats` | GET | Provider statistics | `internal/api/routes_infer.go:41` |

### Observability Endpoints
| Endpoint | Method | Description | File |
|----------|--------|-------------|------|
| `/metrics` | GET | Prometheus metrics | `internal/api/routes_metrics.go:22` |
| `/v1/metrics` | GET | Aggregated JSON metrics | `internal/api/routes_metrics.go:29` |
| `/v1/metrics/health` | GET | Metrics health check | `internal/api/routes_metrics.go:56` |
| `/v1/metrics/debug` | GET | Debug metrics info | `internal/api/routes_metrics.go:82` |

### Admin Control Plane (Requires X-Admin-Token header)
| Endpoint | Method | Description | File |
|----------|--------|-------------|------|
| `/admin/optimizer` | POST | Hot-reload optimizer mode & sample rate | `internal/api/admin_optimizer.go:42` |
| `/admin/optimizer/status` | GET | Current optimizer status | `internal/api/admin_optimizer.go:155` |

---

## Request Flow Diagram

### Standard Inference Request Flow

```
1. HTTP POST /v1/infer
   ↓
2. Middleware Chain
   - CORS validation
   - Error recovery
   - Trace ID injection
   - Request logging
   - Metrics recording
   ↓
3. InferHandler.HandleInfer()
   - Parse InferRequest (cmd/igris-overture/handlers/infer.go:200)
   - Validate request (models/infer_request.go)
   - Start distributed trace
   ↓
4. Determine Routing Source
   Mode = GetRuntimeConfig().GetMode()

   If mode == "go":
     → Use Go Router (always)

   If mode == "shadow":
     → Use Go Router (primary)
     → Run Rust Optimizer in parallel (shadow)
     → Log comparison (no routing impact)

   If mode == "rust":
     SampleRate = GetRuntimeConfig().GetSampleRate()
     If rand() < SampleRate:
       → Try Rust Optimizer
       → If Rust fails: automatic Go fallback
     Else:
       → Use Go Router
   ↓
5. Provider Selection
   [Go Router Path]
   - Check request policy override
   - Model-based provider detection
   - Optimization goal (latency/cost/quality)
   - Weighted selection
   - Record stats

   [Rust Optimizer Path]
   - FFI call: optimizer_select_action()
   - Thompson Sampling (Beta distribution)
   - Map action ID to provider
   - Record decision
   ↓
6. Provider Execution
   Provider.Infer(ctx, request)
   - API key injection
   - HTTP request to LLM provider
   - Parse response
   - Handle errors
   ↓
7. Fallback (if provider fails)
   - Try next available provider
   - Record failure metrics
   - Set fallback flag in metadata
   ↓
8. Response Assembly
   - Calculate cost (provider cost model)
   - Record metrics (latency, tokens, cost)
   - Update optimizer feedback (if Rust mode)
   - Add routing metadata
   - Return InferResponse
   ↓
9. Metrics & Observability
   - Record Prometheus metrics
   - Update aggregated statistics
   - Finish distributed trace
   - Log success/failure
```

---

## Optimizer Modes (Phased Rollout)

### Mode: "go" (Baseline)
```
Request → Go Router → Provider → Response
```
- **Use Case**: Baseline, no Rust optimizer
- **When**: Initial deployment, debugging
- **Config**: `OPTIMIZER_MODE=go`

### Mode: "shadow" (Safe Testing)
```
Request → Go Router (primary) → Provider → Response
          ↓
          Rust Optimizer (parallel)
          ↓
          Comparison Logger (no impact on routing)
```
- **Use Case**: Testing Rust optimizer without affecting production traffic
- **When**: Validating optimizer behavior, collecting comparison data
- **Config**: `OPTIMIZER_MODE=shadow`, `OPTIMIZER_SAMPLE_RATE=0.01` (1% sampled)
- **Files**:
  - `internal/inference/optimizer/shadow/shadow_runner.go`
  - `internal/inference/optimizer/shadow/shadow_logger.go`

### Mode: "rust" (Phased Production Rollout)
```
Request → Sample Rate Check
          ↓
          If sampled:
            Rust Optimizer → Provider
            (with Go fallback on error)
          ↓
          If not sampled:
            Go Router → Provider
```
- **Use Case**: Gradual production rollout of Rust optimizer
- **When**: After successful shadow testing
- **Config**:
  - `OPTIMIZER_MODE=rust`
  - `OPTIMIZER_SAMPLE_RATE=0.05` (start at 5%, gradually increase to 1.0)
- **Safety**: Automatic Go fallback if Rust fails
- **Files**:
  - `cmd/igris-overture/handlers/infer.go:254-299`
  - `internal/inference/optimizer/slo_breaker.go` (SLO guardrails)

---

## Provider System

### Provider Interface
**File**: `internal/providers/provider_interface.go`

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

### Provider Modes (PROVIDER_MODE env var)

| Mode | Description | Providers Registered |
|------|-------------|---------------------|
| `mock` | Development, no real API calls | Mock OpenAI |
| `real` | Production with real API keys | OpenAI, Anthropic (with BYOK) |
| `benchmark` | Simulated providers with realistic pricing/latency | Benchmark OpenAI, Benchmark Anthropic |
| `hybrid` | All of the above | Mock + Real + Benchmark |

**File**: `cmd/igris-overture/handlers/infer.go:44-147`

### Provider Selection Logic

**File**: `internal/inference/router/router_integration.go:129-151`

Priority order:
1. **Explicit policy override** (`req.Policy.Provider`)
2. **Model-based detection** (e.g., "gpt-4" → OpenAI, "claude-3" → Anthropic)
3. **Optimization-based selection**:
   - `optimize_for: "latency"` → Select provider with lowest average latency
   - `optimize_for: "cost"` → Select provider with lowest cost per token
   - `optimize_for: "quality"` → Select provider with highest reliability score
   - No preference → Weighted random based on reliability

### Fallback Mechanism

**File**: `internal/inference/router/router_integration.go:266-292`

```
Primary Provider Fails
  ↓
Try remaining providers in registry
  ↓
Record failure metrics
  ↓
Mark response.Metadata.Fallback = true
  ↓
Return first successful response or error
```

---

## Rust Optimizer Integration (FFI)

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     GO LAYER                                │
│  internal/inference/optimizer/ffi/ffi_wrapper.go           │
│                                                             │
│  OptimizerHandle {                                         │
│    SelectAction() → Action                                 │
│    UpdateReward(actionID, reward)                          │
│    UpdateMetrics(actionID, metrics)                        │
│    GetStats() → []ArmStats                                 │
│    ExportState() → JSON                                    │
│  }                                                          │
└────────────────────────┬───────────────────────────────────┘
                         │ CGO
                         ↓
┌────────────────────────────────────────────────────────────┐
│                     C FFI LAYER                             │
│  internal/inference/optimizer/ffi/ffi_wrapper.go:4-19      │
│                                                             │
│  optimizer_init(config_json) → OptimizerHandle*            │
│  optimizer_select_action(handle) → char* (JSON)            │
│  optimizer_update_reward(handle, action_id, reward)        │
│  optimizer_update_metrics(handle, action_id, metrics_json) │
│  optimizer_get_stats(handle) → char* (JSON)                │
│  optimizer_export_state(handle) → char* (JSON)             │
│  optimizer_free(handle)                                    │
│  optimizer_free_string(char*)                              │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────┐
│                   RUST OPTIMIZER LIB                        │
│  rust-core/rust_kernel/target/release/libschlep_kernel     │
│                                                             │
│  Thompson Sampling (Beta distribution)                     │
│  Multi-armed bandit                                        │
│  Reward calculation with configurable weights              │
└────────────────────────────────────────────────────────────┘
```

### Optimizer Configuration

**File**: `internal/inference/optimizer/ffi/ffi_wrapper.go:206-229`

```go
OptimizerConfig {
    Arms: ["openai/gpt-4", "anthropic/claude-3-5-sonnet", ...]
    InitialAlpha: 1.0    // Beta distribution prior
    InitialBeta: 1.0

    RewardPolicy {
        LatencyWeight: 0.4
        SuccessWeight: 0.3
        CostWeight: 0.15
        CacheWeight: 0.1
        QualityWeight: 0.05

        TargetLatencyMs: 100.0
        MaxLatencyMs: 2000.0
        TargetCostUsd: 0.001
        MaxCostUsd: 0.01
    }
}
```

### Reward Feedback Loop

```
1. Rust selects action (provider/model)
   ↓
2. Go executes inference via provider
   ↓
3. Go measures: latency, success, cost, cache hit
   ↓
4. Go calls: optimizer.UpdateMetrics(actionID, metrics)
   ↓
5. Rust calculates composite reward:
   reward = Σ(weight_i * normalized_metric_i)
   ↓
6. Rust updates Beta distribution (α, β)
   ↓
7. Next request: sample from updated distribution
```

**Files**:
- `internal/inference/optimizer/ffi/ffi_wrapper.go:136-159`
- `internal/inference/optimizer/shadow/shadow_runner.go:256-262`

---

## Admin Control Plane

### Hot-Reload Configuration

**File**: `internal/api/admin_optimizer.go`

**Endpoint**: `POST /admin/optimizer`

**Authentication**: Requires `X-Admin-Token` header (set via `ADMIN_TOKEN` env var)

**Request Body**:
```json
{
  "mode": "rust",        // "go" | "shadow" | "rust"
  "sample_rate": 0.25    // 0.0 to 1.0
}
```

**Response**:
```json
{
  "status": "ok",
  "current_mode": "rust",
  "sample_rate": 0.25,
  "timestamp": "2025-10-19T12:34:56Z"
}
```

**Implementation**:
- Thread-safe runtime config (RWMutex)
- Zero-downtime mode switching
- Changes apply immediately to new requests
- No server restart required

**Files**:
- `internal/api/admin_optimizer.go:42-152`
- `internal/config/optimizer_config.go:19-143`

### SLO Breaker (Guardrails)

**File**: `internal/inference/optimizer/slo_breaker.go`

**Purpose**: Automatically disable Rust optimizer if SLO thresholds are breached

**Metrics Tracked**:
- P95 latency (Rust vs Go)
- Error rate
- Cost deviation
- Sample count (minimum before decision)

**Behavior**:
- If Rust P95 latency > Go P95 latency + threshold → disable Rust
- If Rust error rate > threshold → disable Rust
- Alerts are logged but mode is not changed (manual override required)

---

## Observability & Monitoring

### Prometheus Metrics

**File**: `internal/observability/metrics.go`

**Metrics Exposed at `/metrics`**:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | `method, path, status` | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | `method, path` | Request latency |
| `infer_requests_total` | Counter | `provider, model, status` | Inference requests |
| `infer_request_latency_ms` | Histogram | `provider, model` | Inference latency |
| `infer_tokens_used` | Histogram | `provider, model, token_type` | Token usage |
| `infer_cost_usd` | Histogram | `provider, model` | Request cost |
| `rust_ffi_calls_total` | Counter | `function` | Rust FFI calls |
| `rust_ffi_duration_microseconds` | Histogram | `function` | FFI call latency |
| `model_selection_total` | Counter | `model_id, runtime, strategy` | Model selections |
| `model_performance_total` | Counter | `model_id, runtime, result` | Model performance |

### Distributed Tracing

**File**: `internal/tracing/tracer.go`

**Features**:
- Trace ID injection in all requests
- Span creation for major operations
- Trace context propagation
- Custom attributes (provider, model, tokens, cost)

**Headers**:
- `X-Trace-ID`: Returned in all responses

**Spans**:
- `inference_execute`: Main inference operation
- `inference_stream_execute`: Streaming inference
- `health_check`: Health checks
- `metrics_request`: Metrics queries

### Aggregated Metrics Collector

**File**: `internal/metrics/collector.go`

**Features**:
- In-memory aggregation per provider:model
- Sliding window latency samples (last 1000)
- Percentile calculation (P50, P95, P99)
- Background cleanup of old samples

**Endpoint**: `GET /v1/metrics`

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
        "p99_latency_ms": 580.0
      }
    }
  },
  "top_providers": [...],
  "timestamp": 1729347296
}
```

---

## Configuration

### Environment Variables

| Variable | Default | Description | File |
|----------|---------|-------------|------|
| `PORT` | `8080` | HTTP server port | `cmd/igris-overture/main.go:59` |
| `DEBUG` | `false` | Enable debug logging | `cmd/igris-overture/main.go:17` |
| `PROVIDER_MODE` | `mock` | Provider mode (mock/real/benchmark/hybrid) | `cmd/igris-overture/handlers/infer.go:44` |
| `OPTIMIZER_MODE` | `shadow` | Optimizer mode (go/shadow/rust) | `internal/config/optimizer_config.go:36` |
| `OPTIMIZER_SAMPLE_RATE` | `0.0` | Rust optimizer sample rate (0.0-1.0) | `internal/config/optimizer_config.go:37` |
| `OPTIMIZER_LOG_DIR` | `logs/optimizer` | Shadow comparison log directory | `internal/config/optimizer_config.go:38` |
| `ADMIN_TOKEN` | `""` | Admin API authentication token | `internal/config/optimizer_config.go:39` |
| `OPENAI_API_KEY` | `""` | OpenAI API key (BYOK) | `cmd/igris-overture/handlers/infer.go:112` |
| `ANTHROPIC_API_KEY` | `""` | Anthropic API key (BYOK) | `cmd/igris-overture/handlers/infer.go:130` |

### Runtime Configuration (Hot-Reload)

**File**: `internal/config/optimizer_config.go:19-143`

**Thread-Safe Access**:
```go
config := GetRuntimeConfig()
mode := config.GetMode()              // Read current mode
config.SetMode(ShadowModeRust)        // Update mode (hot-reload)
sampleRate := config.GetSampleRate()  // Read sample rate
config.SetSampleRate(0.5)             // Update sample rate (hot-reload)
```

**No Restart Required**: Changes apply immediately to new requests

---

## Key Code References

### Main Entry Points
- Server: `cmd/igris-overture/main.go:15-72`
- Route Registration: `internal/api/routes_metrics.go:124-136`
- Middleware Setup: `internal/api/routes_metrics.go:139-147`

### Inference Flow
- Handler: `cmd/igris-overture/handlers/infer.go:199-369`
- Router: `internal/inference/router/router_integration.go:52-103`
- Provider Interface: `internal/providers/provider_interface.go:12-37`
- Provider Implementations:
  - OpenAI: `internal/providers/openai/openai_provider.go`
  - Anthropic: `internal/providers/anthropic/anthropic_provider.go`

### Optimizer Components
- Shadow Runner: `internal/inference/optimizer/shadow/shadow_runner.go:71-335`
- FFI Wrapper: `internal/inference/optimizer/ffi/ffi_wrapper.go:80-204`
- Shadow Logger: `internal/inference/optimizer/shadow/shadow_logger.go`
- SLO Breaker: `internal/inference/optimizer/slo_breaker.go`

### Admin & Control
- Admin Handler: `internal/api/admin_optimizer.go:42-206`
- Runtime Config: `internal/config/optimizer_config.go:19-153`

### Observability
- Prometheus Metrics: `internal/observability/metrics.go:13-540`
- Metrics Collector: `internal/metrics/collector.go:59-388`
- Tracing: `internal/tracing/tracer.go`
- Logging: `internal/logging/logger.go`

---

## Data Flows for Landing Page Diagrams

### Flow 1: Simple Inference (Go Router)
```
Client
  → POST /v1/infer {"model": "gpt-4", "messages": [...]}
    → Middleware (auth, trace, metrics)
      → InferHandler (mode = "go")
        → Go Router (selects OpenAI based on model name)
          → OpenAI Provider (API call)
            → OpenAI API
              ← Response
            ← InferResponse
          ← Record metrics (latency, tokens, cost)
        ← Add trace ID, metadata
      ← JSON response
    ← HTTP 200 with trace ID header
  ← Client receives response
```

### Flow 2: Rust Optimizer with Fallback
```
Client
  → POST /v1/infer {"model": "gpt-4", "messages": [...]}
    → Middleware
      → InferHandler (mode = "rust", sample_rate = 0.5)
        → Sample check: rand() < 0.5 → YES
          → Rust Optimizer FFI
            → optimizer_select_action()
              ← "anthropic/claude-3-5-sonnet"
          → Anthropic Provider
            → Anthropic API (network error!)
              ← ERROR
          → Automatic Go Fallback
            → Go Router
              → OpenAI Provider (fallback)
                → OpenAI API
                  ← Success
                ← InferResponse (fallback = true)
              ← Record metrics
            ← Response
          ← Update Rust optimizer (negative reward)
        ← JSON response
      ← HTTP 200
    ← Client receives response
```

### Flow 3: Shadow Mode (Parallel Testing)
```
Client
  → POST /v1/infer
    → InferHandler (mode = "shadow", sample_rate = 0.1)
      → Sample check: rand() < 0.1 → YES
        ┌─ Go Router (PRIMARY)
        │   → Provider → Response A
        │
        └─ Rust Optimizer (PARALLEL)
            → optimizer_select_action() → Response B

      → Wait for primary (A) only
      → Return A to client

      → Background: Compare A vs B
        → Log to shadow_comparisons.jsonl:
          {
            "go_decision": "openai/gpt-4",
            "rust_decision": "anthropic/claude-3-5-sonnet",
            "agreed": false,
            "cost_delta_usd": -0.0003,
            "latency_delta_ms": 15
          }
        → Update shadow metrics

    ← HTTP 200
  ← Client receives response A (unaffected by Rust)
```

### Flow 4: Admin Control Plane
```
Admin
  → POST /admin/optimizer
     Headers: X-Admin-Token: <secret>
     Body: {"mode": "rust", "sample_rate": 0.75}

    → AdminOptimizerHandler
      → Validate token
      → SetMode("rust")
      → SetSampleRate(0.75)
      → Update shadow runner

    ← HTTP 200: {
        "status": "ok",
        "current_mode": "rust",
        "sample_rate": 0.75,
        "timestamp": "..."
      }
  ← Admin sees confirmation

  → Next inference request immediately uses new config
     (no restart required)
```

---

## Capabilities Summary (for Landing Page)

### 1. Intelligent Routing
- **Multi-provider support**: OpenAI, Anthropic, extensible to others
- **Automatic fallback**: Never fail on single provider outage
- **Policy-based routing**: Optimize for latency, cost, or quality
- **Model-aware**: Automatic provider detection from model name

### 2. Rust-Powered Optimization
- **Thompson Sampling**: Bayesian multi-armed bandit
- **Continuous learning**: Adapts to provider performance over time
- **Safe rollout**: Shadow mode → gradual rollout → full production
- **Automatic fallback**: Go router as safety net

### 3. Cost & Performance Tracking
- **Real-time cost tracking**: Per-request USD cost calculation
- **Token accounting**: Prompt, completion, and total tokens
- **Latency percentiles**: P50, P95, P99 tracking per provider/model
- **Prometheus integration**: Standard metrics for Grafana dashboards

### 4. Control Plane
- **Hot-reload**: Change optimizer mode without restart
- **Gradual rollout**: Adjust sample rate from 0% to 100%
- **SLO guardrails**: Automatic safety checks
- **Admin API**: Secure token-based access

### 5. Observability
- **Distributed tracing**: Trace ID in every request
- **Prometheus metrics**: 30+ metrics exposed
- **Structured logging**: JSON logs with trace correlation
- **Aggregated analytics**: Provider performance dashboards

### 6. BYOK (Bring Your Own Key) Safety
- **Provider isolation**: Each provider uses separate API key
- **Benchmark mode**: Test without real API calls
- **Fallback on key exhaustion**: Route to alternative providers
- **Cost caps**: Configurable max cost per request

---

## Architecture Decisions

### Why Go for API Gateway?
- Fast HTTP handling (Fiber framework)
- Strong concurrency model (goroutines)
- Mature ecosystem (middleware, observability)
- Easy deployment (single binary)

### Why Rust for Optimizer?
- Performance: Thompson Sampling calculations
- Safety: Memory safety for long-running ML computations
- Portability: Compile to shared library (.so, .dylib)
- FFI: Easy integration with Go via CGO

### Why FFI (not gRPC)?
- Lower latency (in-process calls)
- Simpler deployment (no separate optimizer service)
- Easier state management (shared memory)
- Fallback simplicity (direct function calls)

### Why Phased Rollout?
- Safety: Validate Rust optimizer before production
- Comparison: Shadow mode logs decision differences
- Gradual confidence: Start at 1%, increase to 100%
- Reversibility: Admin API can disable instantly

---

## Future Extensions (Not Yet Implemented)

These are NOT in the current codebase, mentioned for completeness:

- Embeddings endpoint: `POST /v1/embeddings`
- Fine-tuning endpoint: `POST /v1/fine-tunes`
- Batch processing: Async job queue
- Caching layer: Redis-backed response cache
- Rate limiting: Per-user quota management
- Multi-region deployment: Global load balancing

---

**Generated**: 2025-10-19
**Source**: Schlep-Engine codebase
**Purpose**: Technical reference for architecture diagrams (landing page, docs)
