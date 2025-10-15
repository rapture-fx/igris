# Phase 11: Benchmark Provider Integration

**Status**: ✅ Completed
**Date**: October 2025
**Objective**: Implement benchmark-mode provider integration for OpenAI and Anthropic without real API calls

## Overview

Phase 11 introduces **Benchmark Mode** providers that simulate OpenAI and Anthropic API behavior without making actual network calls. These providers enable:

- **Offline testing** and development without API keys
- **Cost-free optimization** experiments using realistic pricing models
- **Reproducible benchmarks** with consistent latency/cost characteristics
- **Safe integration testing** before activating real API connections (Phase 12)

## Architecture

### Provider Files

```
internal/providers/
├── provider_cost_model.go          # Centralized pricing and cost estimation
├── provider_errors.go              # Error handling and retry logic
├── openai/
│   └── openai_benchmark.go        # OpenAI benchmark provider
└── anthropic/
    └── anthropic_benchmark.go     # Anthropic benchmark provider
```

### Key Components

1. **BenchmarkOpenAIProvider** (`internal/providers/openai/openai_benchmark.go`)
   - Simulates GPT-4, GPT-4-Turbo, GPT-3.5-Turbo models
   - Official OpenAI pricing (input/output tokens)
   - Realistic latency profiles (P50, P95, P99)
   - Streaming support with TTFT simulation

2. **BenchmarkAnthropicProvider** (`internal/providers/anthropic/anthropic_benchmark.go`)
   - Simulates Claude 3 models (Opus, Sonnet, Haiku)
   - Official Anthropic pricing
   - Claude-specific streaming format (message_start/message_stop events)
   - "end_turn" finish reason (Anthropic standard)

3. **CostModel** (`internal/providers/provider_cost_model.go`)
   - Centralized pricing table based on official provider rates
   - Separate input/output token pricing
   - Fallback pricing for unknown models
   - Latency profiles with percentile distributions

4. **ErrorSimulator** (`internal/providers/provider_errors.go`)
   - Configurable error scenarios for resilience testing
   - Retry/non-retry error classification
   - Realistic error probabilities (rate limits, timeouts, etc.)

## Usage

### Enable Benchmark Mode

Set the `PROVIDER_MODE` environment variable:

```bash
export PROVIDER_MODE=benchmark
```

Available modes:
- `mock` (default): Simple mock provider for basic testing
- `benchmark`: Realistic OpenAI/Anthropic simulation (Phase 11)
- `real`: Live API calls (requires API keys)
- `hybrid`: All providers enabled

### Example Request

```bash
curl -X POST http://localhost:8080/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

Response includes realistic metadata:

```json
{
  "id": "benchmark-req-1729123456",
  "model": "gpt-4",
  "choices": [{"message": {"role": "assistant", "content": "..."}}],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 87,
    "total_tokens": 99
  },
  "metadata": {
    "provider": "benchmark-openai",
    "latency_ms": 1234,
    "cost_usd": 0.003642,
    "quality_score": 0.90
  }
}
```

## Pricing Tables

### OpenAI Pricing (per 1K tokens)

| Model | Input | Output |
|-------|-------|--------|
| GPT-4 | $0.03 | $0.06 |
| GPT-4-Turbo | $0.01 | $0.03 |
| GPT-3.5-Turbo | $0.0005 | $0.0015 |

### Anthropic Pricing (per 1K tokens)

| Model | Input | Output |
|-------|-------|--------|
| Claude 3 Opus | $0.015 | $0.075 |
| Claude 3 Sonnet | $0.003 | $0.015 |
| Claude 3 Haiku | $0.00025 | $0.00125 |

## Latency Profiles

### OpenAI Models

| Model | Avg | P50 | P95 | P99 | TTFT |
|-------|-----|-----|-----|-----|------|
| GPT-4 | 1500ms | 1200ms | 3000ms | 5000ms | 400ms |
| GPT-3.5 | 800ms | 600ms | 1500ms | 2500ms | 200ms |

### Anthropic Models

| Model | Avg | P50 | P95 | P99 | TTFT |
|-------|-----|-----|-----|-----|------|
| Claude 3 Opus | 2000ms | 1800ms | 4000ms | 6000ms | 500ms |
| Claude 3 Haiku | 500ms | 400ms | 1000ms | 1500ms | 150ms |

*TTFT = Time to First Token (streaming)*

## Simulation Features

### 1. Latency Simulation

Providers sleep for realistic durations based on model-specific profiles:

```go
// Simulate latency with distribution
latencyMs := minLatency + rand.Intn(maxLatency - minLatency)
time.Sleep(time.Duration(latencyMs) * time.Millisecond)
```

### 2. Token Usage Estimation

```go
// Estimate based on message length (1 token ≈ 4 chars)
promptTokens := totalChars / 4 + len(messages) * 3

// Use MaxTokens if specified, otherwise simulate range
completionTokens := estimateCompletionTokens(req, config)
```

### 3. Cost Calculation

```go
costUSD = (promptTokens/1000 * inputPricing) +
          (completionTokens/1000 * outputPricing)
```

### 4. Streaming with TTFT

```go
// Simulate Time to First Token
time.Sleep(ttft)

// Stream tokens with inter-token delay (5-25ms)
for word := range words {
    chunkChan <- chunk
    time.Sleep(interTokenDelay)
}
```

### 5. Error Scenarios (Optional)

Configure error simulation for testing resilience:

```go
config := &providers.SimulationConfig{
    ErrorRate: 0.05, // 5% of requests
}

// Simulates: rate limits, timeouts, service unavailable
```

## Integration with Optimizer

Benchmark providers are fully compatible with the Rust optimizer (Phases 7-10):

1. **Provider Selection**: Optimizer can route to `benchmark-openai` or `benchmark-anthropic`
2. **Metrics Collection**: Latency, cost, and quality metrics are recorded
3. **Shadow Mode**: Compare Go vs Rust routing decisions using benchmark providers
4. **SLO Guardrails**: Trigger automatic fallback based on simulated performance

### Example Optimizer Integration

```go
// Optimizer selects provider based on latency/cost/quality goals
selectedProvider := optimizer.SelectAction(ctx, req)

// Routes to benchmark provider
resp, err := router.Route(ctx, req)

// Records metrics for Thompson Sampling
optimizer.UpdateReward(selectedProvider, reward)
```

## Testing

Run the comprehensive test suite:

```bash
# Run all benchmark provider tests
go test ./tests -run TestBenchmark -v

# Run specific provider tests
go test ./tests -run TestBenchmarkOpenAI -v
go test ./tests -run TestBenchmarkAnthropic -v

# Run cost model tests
go test ./tests -run TestProviderCostModel -v

# Benchmark performance
go test ./tests -bench=BenchmarkProvider -benchmem
```

### Test Coverage

- ✅ Provider initialization
- ✅ Basic inference (non-streaming)
- ✅ Streaming inference with TTFT
- ✅ Cost estimation accuracy
- ✅ Health checks
- ✅ Capability reporting
- ✅ Latency profile simulation
- ✅ Optimizer integration
- ✅ Fallback behavior

## Configuration Options

### Custom Simulation Config

```go
config := &providers.ProviderConfig{
    BaseURL:       "https://api.openai.com/v1",
    Timeout:       60,
    MaxRetries:    3,
    RetryDelay:    1000,
    EnableMetrics: true,
    Custom: map[string]interface{}{
        "simulation": &providers.SimulationConfig{
            MinLatencyMs:        100,
            MaxLatencyMs:        500,
            MinCompletionTokens: 50,
            MaxCompletionTokens: 500,
            ErrorRate:           0.02, // 2% error rate
            QualityScore:        0.95,
            EnableVariation:     true,
        },
    },
}

provider := openai.NewBenchmarkOpenAIProvider(config)
```

## Constraints (Phase 11)

As specified in the task requirements:

- ❌ **No external HTTP requests** - All responses are simulated
- ❌ **No official SDKs** - Pure Go implementation
- ✅ **Offline operation** - Works without internet connectivity
- ✅ **OPTIMIZER_MODE independent** - Does not affect shadow mode settings
- ✅ **Compatible with /v1/infer** - Drop-in replacement for mock providers

## Differences from Mock Provider

| Feature | Mock Provider | Benchmark Provider |
|---------|---------------|-------------------|
| Purpose | Simple testing | Realistic optimization testing |
| Pricing | Hardcoded/free | Official provider rates |
| Latency | Fixed range (50-200ms) | Model-specific profiles |
| Models | 1-2 generic | All major provider models |
| Cost Model | Simplified | Centralized, accurate |
| Error Simulation | No | Yes (configurable) |
| TTFT Simulation | Basic | Realistic per-model |
| Phase | Pre-Phase 11 | Phase 11+ |

## Next Steps (Phase 12)

Phase 12 will enable **Live API Activation**:

1. **API Key Management**: Secure credential storage
2. **Real HTTP Clients**: Actual OpenAI/Anthropic API calls
3. **Connection Testing**: Verify API connectivity before routing
4. **Hybrid Mode**: Fallback from benchmark to real APIs
5. **Rate Limit Handling**: Respect provider rate limits
6. **Credential Rotation**: Support multiple API keys per provider

Benchmark providers will remain available for testing and development.

## API Reference

### BenchmarkOpenAIProvider

```go
type BenchmarkOpenAIProvider struct {
    config         *ProviderConfig
    costModel      *CostModel
    simulationCfg  *SimulationConfig
}

func NewBenchmarkOpenAIProvider(config *ProviderConfig) (*BenchmarkOpenAIProvider, error)

func (p *BenchmarkOpenAIProvider) Name() string
func (p *BenchmarkOpenAIProvider) Infer(ctx context.Context, req *InferRequest) (*InferResponse, error)
func (p *BenchmarkOpenAIProvider) InferStream(ctx context.Context, req *InferRequest) (<-chan *StreamChunk, <-chan error)
func (p *BenchmarkOpenAIProvider) HealthCheck(ctx context.Context) error
func (p *BenchmarkOpenAIProvider) GetCapabilities() *ProviderCapabilities
func (p *BenchmarkOpenAIProvider) EstimateCost(req *InferRequest) (float64, error)
func (p *BenchmarkOpenAIProvider) Close() error
```

### BenchmarkAnthropicProvider

```go
type BenchmarkAnthropicProvider struct {
    config         *ProviderConfig
    costModel      *CostModel
    simulationCfg  *SimulationConfig
}

func NewBenchmarkAnthropicProvider(config *ProviderConfig) (*BenchmarkAnthropicProvider, error)

// Methods identical to BenchmarkOpenAIProvider
```

### CostModel

```go
type CostModel struct {
    pricingTable map[string]*ModelPricing
}

func NewCostModel() *CostModel
func (cm *CostModel) EstimateCost(provider, model string, inputTokens, outputTokens int) (float64, error)
func (cm *CostModel) GetPricing(provider, model string) (*ModelPricing, bool)
```

## Metrics Collected

Benchmark providers record the same metrics as real providers:

- `schlep_infer_requests_total{provider, model, status}`
- `schlep_infer_latency_ms{provider, model}`
- `schlep_infer_tokens_total{provider, model, type}`
- `schlep_infer_cost_usd{provider, model}`
- `schlep_provider_quality_score{provider, model}`

These metrics enable A/B testing and optimization without real API costs.

## Troubleshooting

### Issue: "No providers registered"

**Solution**: Ensure `PROVIDER_MODE=benchmark` is set before starting:

```bash
export PROVIDER_MODE=benchmark
go run cmd/schlep-api/main.go
```

### Issue: Latency seems unrealistic

**Solution**: Check simulation config. Default profiles match real-world P50-P95:

```bash
# View latency profiles
curl http://localhost:8080/v1/providers/stats
```

### Issue: Cost calculations don't match expected

**Solution**: Verify you're using the centralized cost model (Phase 11):

```go
costModel := providers.NewCostModel()
cost, _ := costModel.EstimateCost("openai", "gpt-4", 1000, 500)
// Returns: $0.06 (1000*0.03/1000 + 500*0.06/1000)
```

## Summary

Phase 11 establishes a robust benchmark provider architecture that:

- ✅ Simulates OpenAI and Anthropic APIs without external calls
- ✅ Uses official pricing tables for accurate cost modeling
- ✅ Implements realistic latency profiles per model
- ✅ Supports streaming with TTFT simulation
- ✅ Integrates seamlessly with the optimizer (Phases 7-10)
- ✅ Enables safe testing before Phase 12 live API activation
- ✅ Provides comprehensive test coverage

**Ready for Phase 12**: Live API integration with connection testing and fallback to benchmark mode for safe production rollout.
