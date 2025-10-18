# Schlep Engine - ML Inference Routing & Orchestration Platform

> **Status:** v0.1.0-alpha (Early MVP - Active Development)

**Schlep Engine** is an ML inference routing platform that uses **Thompson Sampling** (multi-armed bandit) to intelligently route requests across multiple AI providers (OpenAI, Anthropic). Built with a hybrid polyglot architecture (Go/Rust/Python), it provides safe phased rollouts, shadow mode testing, and comprehensive observability for production ML deployments.

## Current Capabilities

### ✅ **Fully Implemented**

- **Thompson Sampling Multi-Armed Bandit** - Probabilistic routing using Beta distribution with exploration-exploitation tradeoff (Go + Rust FFI)
- **Benchmark Mode** - Complete OpenAI/Anthropic simulation without API calls (realistic latency, token counting, cost calculation)
- **Admin Control Panel** - Hot-reload optimizer settings without restart (`/admin/optimizer/*`)
- **Shadow Mode Testing** - Non-invasive parallel Rust optimizer validation with zero user impact
- **Phased Rollout** - Sample rate control from 1% to 100% traffic with instant revert
- **SLO Breaker** - Automatic fallback on performance degradation with configurable thresholds
- **Distributed Tracing** - Custom trace context with TraceID/SpanID + OpenTelemetry/Jaeger ready
- **Cost Tracking** - Per-request cost breakdown by component (CPU, memory, GPU)
- **Connection Pooling** - ML service pool with health checks, retries, and circuit breakers
- **Prometheus Metrics** - Detailed observability (latency histograms, error rates, routing decisions)
- **OpenAI-Compatible API** - Drop-in replacement for OpenAI endpoints

### ⚠️ **In Development**

- **Real OpenAI/Anthropic Providers** - Infrastructure complete, API integration in progress
- **GPU Acceleration** - Multi-GPU scheduler and runtime configured, CUDA operations pending
- **Python ML Service as Provider** - gRPC service built, provider registration pending
- **Full OpenTelemetry Integration** - Dependencies present, active span export pending

---

## Architecture

The system uses a **hybrid polyglot architecture** to leverage the strengths of each language:

- **Go** (`cmd/`, `internal/`) - High-concurrency HTTP gateway, request routing, middleware
- **Rust** (`rust-core/`) - CPU-intensive Thompson Sampling optimizer via FFI, safe parallel processing
- **Python** (`adapters/python/`) - ML model serving via gRPC (PyTorch, ONNX Runtime)

```
┌────────┐      HTTP Request       ┌──────────────┐
│ Client │ ─────────────────────► │  Go Gateway  │
└────────┘                         │  (Fiber)     │
                                   └──────────────┘
                                    │            │
                      FFI (CGO)     │            │  gRPC
                      Thompson      │            │
                      Sampling      ▼            ▼
                                ┌─────────┐  ┌────────────┐
                                │  Rust   │  │  Python    │
                                │ Kernel  │  │ ML Service │
                                └─────────┘  └────────────┘
```

**Request Flow:**
1. Client sends inference request to Go gateway (`POST /v1/infer`)
2. Gateway determines if Rust optimizer should be used (based on mode + sample rate)
3. If Rust: FFI call to Thompson Sampling optimizer → selects best provider
4. If Go: Native Go router with configurable policy (round-robin, least-latency, etc.)
5. Provider executes inference (benchmark mode or real API call)
6. Response includes metadata (latency, cost, routing decision, trace info)

---

## Quick Start

### Prerequisites

- **Go** 1.23+ (for gateway)
- **Rust** 1.70+ (for kernel FFI library)
- **Python** 3.9+ (for ML service)
- **Docker & Docker Compose** (recommended for orchestration)

### Running with Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/yourusername/schlep-engine.git
cd schlep-engine

# Start all services
docker-compose up --build

# Gateway available at http://localhost:8080
```

### Running Locally (Development)

**1. Build Rust Kernel:**
```bash
cd rust-core/rust_kernel
cargo build --release
# Creates librust_kernel.dylib (macOS), .so (Linux), or .dll (Windows)
cd ../..
```

**2. Build Go Gateway:**
```bash
cd cmd/schlep-api
go build -o schlep-api
cd ../..
```

**3. Start Python ML Service (Optional):**
```bash
cd adapters/python/python_ml
python -m grpc_tools.protoc -I./proto --python_out=. --grpc_python_out=. ./proto/ml_service.proto
python service/server.py
cd ../../..
```

**4. Run Gateway:**
```bash
export PROVIDER_MODE=benchmark  # Options: mock, benchmark, real, hybrid
export PORT=8080
./cmd/schlep-api/schlep-api
```

---

## API Reference

### Health Check

```bash
curl http://localhost:8080/v1/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "schlep-engine-api",
  "version": "0.1.0-alpha"
}
```

### Inference (OpenAI-Compatible)

**Endpoint:** `POST /v1/infer` or `POST /v1/chat/completions`

```bash
curl -X POST http://localhost:8080/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Explain Thompson Sampling in one sentence"}
    ]
  }'
```

**Response (Benchmark Mode):**
```json
{
  "id": "chatcmpl-abc123",
  "model": "gpt-4",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Thompson Sampling is a..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 42,
    "total_tokens": 57
  },
  "metadata": {
    "provider": "openai",
    "latency_ms": 234,
    "cost_usd": 0.00171,
    "routing_decision": "thompson-sampling",
    "trace_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Cost-Optimized Inference

Use Thompson Sampling to automatically select the most cost-effective provider:

```bash
curl -X POST http://localhost:8080/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "optimization": "cost"
  }'
```

### Admin Controls

**Update Optimizer Mode (Hot-Reload):**

```bash
# Enable Rust optimizer for 50% of traffic
curl -X POST http://localhost:8080/admin/optimizer \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "rust",
    "sample_rate": 50,
    "slo_threshold_ms": 500
  }'
```

**Modes:**
- `go` - Use Go router only
- `rust` - Use Rust Thompson Sampling optimizer
- `shadow` - Run Rust in parallel for validation (no user impact)

**Check Optimizer Status:**

```bash
curl http://localhost:8080/admin/optimizer/status
```

**Response:**
```json
{
  "mode": "rust",
  "sample_rate": 50,
  "slo_threshold_ms": 500,
  "total_requests": 10523,
  "rust_requests": 5261,
  "go_fallbacks": 12,
  "slo_breaker_active": false
}
```

### Provider Statistics

```bash
curl http://localhost:8080/v1/providers/stats
```

**Response:**
```json
{
  "providers": [
    {
      "name": "openai/gpt-4",
      "requests": 5234,
      "avg_latency_ms": 287,
      "error_rate": 0.012,
      "total_cost_usd": 124.56,
      "thompson_sampling_score": 0.87
    },
    {
      "name": "anthropic/claude-3-5-sonnet",
      "requests": 5289,
      "avg_latency_ms": 312,
      "error_rate": 0.008,
      "total_cost_usd": 98.34,
      "thompson_sampling_score": 0.91
    }
  ]
}
```

### Prometheus Metrics

```bash
curl http://localhost:8080/metrics
```

Exports metrics in Prometheus format:
- `inference_requests_total` - Total inference requests by provider
- `inference_latency_seconds` - Latency histogram by provider
- `inference_errors_total` - Error count by provider and type
- `routing_decisions_total` - Routing decisions by method (thompson-sampling, round-robin, etc.)
- `cost_usd_total` - Total cost by provider and component

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `PROVIDER_MODE` | `benchmark` | Provider mode: `mock`, `benchmark`, `real`, `hybrid` |
| `DEBUG` | `false` | Enable debug logging |
| `OPTIMIZER_MODE` | `go` | Optimizer: `go`, `rust`, `shadow` |
| `OPTIMIZER_SAMPLE_RATE` | `0` | Rust optimizer sample rate (0-100%) |
| `OPENAI_API_KEY` | - | OpenAI API key (for `real` mode) |
| `ANTHROPIC_API_KEY` | - | Anthropic API key (for `real` mode) |
| `ML_SERVICE_ADDRESS` | `localhost:50051` | Python ML service gRPC address |
| `REDIS_URL` | `localhost:6379` | Redis cache URL |
| `POSTGRES_URL` | - | PostgreSQL connection string |

### Provider Modes

**`benchmark`** (Recommended for Testing)
- Simulates OpenAI/Anthropic APIs without real API calls
- Realistic latency profiles, token counting, and cost calculation
- No API keys required
- Perfect for load testing and development

**`mock`**
- Simple mock responses for unit testing
- Fixed latency and token counts
- Fastest mode for testing

**`real`** (In Development)
- Actual OpenAI/Anthropic API calls
- Requires valid API keys
- **Status:** Provider stubs present, integration in progress

**`hybrid`**
- Mix of benchmark and real providers
- Useful for gradual migration

---

## Project Structure

```
schlep-engine/
├── cmd/
│   └── schlep-api/          # Main API entry point
├── internal/                # Core Go packages
│   ├── api/                 # Routes and handlers
│   ├── inference/           # Router, optimizer, policy
│   ├── router/              # AdaptiveRouter with Thompson Sampling
│   ├── providers/           # Provider implementations
│   │   ├── openai/          # OpenAI provider (benchmark + mock)
│   │   └── anthropic/       # Anthropic provider (benchmark + mock)
│   ├── ml/                  # ML service integration, GPU runtime
│   ├── tracing/             # Distributed tracing
│   ├── metrics/             # Prometheus metrics, cost tracking
│   ├── middleware/          # HTTP middleware
│   └── telemetry/           # Observability
├── rust-core/
│   └── rust_kernel/         # Rust FFI library
│       ├── src/
│       │   ├── lib.rs       # FFI exports
│       │   ├── optimizer/   # Thompson Sampling
│       │   │   ├── bandits.rs     # Beta distribution sampling
│       │   │   ├── arms.rs        # Bandit arm state
│       │   │   └── ffi.rs         # C-compatible FFI
│       │   ├── cache/       # Caching layer
│       │   ├── mempool/     # Memory pooling
│       │   └── parallel/    # Parallel processing
│       └── Cargo.toml
├── adapters/
│   └── python/
│       └── python_ml/       # Python ML service (gRPC)
│           ├── service/     # gRPC server
│           ├── proto/       # Protobuf definitions
│           └── Dockerfile
├── web/
│   └── apps/
│       ├── web-landing/     # Next.js landing page
│       ├── web-admin/       # Admin dashboard
│       └── web-docs/        # Documentation site
├── labs/                    # Research & experiments
│   └── research/
│       ├── cognitive/       # Autonomous decision-making
│       ├── rl/              # Reinforcement learning
│       └── predictive/      # Predictive optimization
├── infra/                   # Infrastructure
│   ├── docker/              # Docker configs
│   └── k8s/                 # Kubernetes manifests
├── tests/                   # Integration tests
├── scripts/                 # Build & deployment scripts
├── go.mod                   # Go dependencies
└── README.md
```

---

## Thompson Sampling Implementation

The core routing algorithm uses **Thompson Sampling**, a Bayesian approach to the multi-armed bandit problem.

### How It Works

1. **Beta Distribution per Provider** - Each provider maintains α (successes) and β (failures) parameters
2. **Sampling** - For each request, sample from Beta(α, β) for each provider
3. **Selection** - Choose provider with highest sample (exploitation) or random (exploration)
4. **Update** - Update α/β based on request outcome (latency, cost, errors)

### Reward Calculation

Providers are scored based on:
- **Latency** (weight: 0.4) - Faster = higher reward
- **Cost** (weight: 0.3) - Cheaper = higher reward
- **Error Rate** (weight: 0.3) - Fewer errors = higher reward

### Configuration

```go
// internal/router/adaptive_router.go
type ThompsonSamplingConfig struct {
    ExplorationRate  float64  // Default: 0.15 (15% random selection)
    SuccessThreshold float64  // Default: 0.6
    InitialAlpha     float64  // Default: 1.0
    InitialBeta      float64  // Default: 1.0
}
```

### Rust FFI Integration

```bash
# Rust optimizer can be called via FFI
optimizer_select_action(handle) → "openai/gpt-4"
optimizer_update_reward(handle, "openai/gpt-4", 0.85)
```

Benefits:
- **Safe Concurrency** - Rust's ownership system prevents race conditions
- **Performance** - ~10-100x faster than Go for Beta sampling at scale
- **Memory Safety** - No memory leaks from FFI boundary

---

## Development Phases

- **Phase 1-10:** Core architecture, polyglot integration, data processing
- **Phase 11:** Thompson Sampling optimizer, benchmark providers, cost tracking ← **Current**
- **Phase 12:** (Planned) Advanced SLO enforcer, autonomous agents
- **Phase 13:** (Research) Cognitive layer, predictive optimization

---

## Testing

### Unit Tests

```bash
# Go tests
go test ./internal/... -v

# Rust tests
cd rust-core/rust_kernel
cargo test
```

### Integration Tests

```bash
# Run integration test suite
go test ./tests/... -v -timeout 120s
```

### Benchmark Tests

```bash
# Benchmark Thompson Sampling performance
cd tests
go test -run TestBenchmark -v -timeout 120s
```

---

## Observability & Monitoring

### Distributed Tracing

Every request receives a `TraceID` and `SpanID` for correlation:

```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "span_id": "7f12a3b4c5d6e7f8",
  "parent_span_id": null
}
```

**OpenTelemetry Integration (Pending):**
- Jaeger exporter configured
- Dependencies present in `go.mod`
- Active span export in development

### Cost Tracking

Per-request cost breakdown:

```json
{
  "total_cost_usd": 0.00234,
  "breakdown": {
    "cpu_ms": 12,
    "cpu_cost_usd": 0.000012,
    "memory_mb": 45,
    "memory_cost_usd": 0.000045,
    "gpu_ms": 150,
    "gpu_cost_usd": 0.0015,
    "provider_cost_usd": 0.000783
  }
}
```

### Metrics Dashboard

Prometheus metrics can be visualized in Grafana:
- Request throughput (RPS)
- P50/P95/P99 latency by provider
- Error rates and types
- Thompson Sampling decisions
- Cost per request
- Provider performance comparison

---

## Production Deployment

### Docker Compose (Staging)

```bash
docker-compose -f docker-compose.staging.yml up -d
```

### Kubernetes (Production)

```bash
kubectl apply -f infra/k8s/
```

**Resources:**
- API Gateway: 2 CPU, 4GB RAM (auto-scaling)
- Python ML Service: 4 CPU, 8GB RAM, GPU optional
- Redis: 1 CPU, 2GB RAM
- PostgreSQL: 2 CPU, 4GB RAM

### Health Checks

- **Liveness:** `GET /v1/health`
- **Readiness:** `GET /v1/health` (checks downstream services)

---

## Roadmap

### v0.2.0 (Q2 2025)
- [ ] Complete real OpenAI/Anthropic provider integration
- [ ] Wire Python ML service as inference provider
- [ ] Implement actual GPU operations (CUDA)
- [ ] Full OpenTelemetry span export
- [ ] Streaming response support at scale

### v0.3.0 (Q3 2025)
- [ ] Advanced SLO enforcer with automatic scaling
- [ ] Multi-region routing
- [ ] Fine-tuning API endpoints
- [ ] Embeddings API
- [ ] Model versioning and A/B testing

### v1.0.0 (Q4 2025)
- [ ] Production-ready with SLA guarantees
- [ ] 10,000+ RPS throughput (verified)
- [ ] Autonomous optimization agents
- [ ] Enterprise support

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Key Areas for Contribution:**
- Real provider implementations (OpenAI, Anthropic, others)
- GPU acceleration with CUDA
- Additional routing policies
- Performance optimizations
- Documentation improvements

---

## License

[MIT License](LICENSE)

---

## Support

- **Documentation:** [https://docs.schlep-engine.com](https://docs.schlep-engine.com)
- **Issues:** [GitHub Issues](https://github.com/yourusername/schlep-engine/issues)
- **Email:** support@schlep-engine.com
- **Discord:** [Join our community](https://discord.gg/schlep-engine)

---

## Acknowledgments

Built with:
- [Fiber](https://gofiber.io/) - Go web framework
- [Tokio](https://tokio.rs/) - Rust async runtime
- [PyTorch](https://pytorch.org/) - ML framework
- [OpenTelemetry](https://opentelemetry.io/) - Distributed tracing
- [Prometheus](https://prometheus.io/) - Metrics and monitoring

**Inspired by:** Multi-armed bandit algorithms, Bayesian optimization, and production ML serving challenges.
