# Mock OpenAI Provider

## Overview

The MockOpenAIProvider provides a realistic simulation of OpenAI's API for development and testing without incurring external costs or requiring API keys.

## Features

✅ **Realistic Latency Simulation** - 50-200ms with actual sleep()
✅ **Token Usage Calculation** - 100-1200 tokens with variation
✅ **Cost Estimation** - $0.000002 per token
✅ **Streaming Support** - Full SSE streaming with TTFT simulation
✅ **Context-Aware Responses** - Includes user query in response
✅ **No External Dependencies** - Works offline, no API keys needed

## Usage

### Environment Variable

```bash
# Use mock provider (default)
export PROVIDER_MODE=mock

# Use real providers
export PROVIDER_MODE=real

# Use both
export PROVIDER_MODE=hybrid
```

### Direct Instantiation

```go
import "github.com/igris-inertial/igris-inertial/internal/providers/openai"

// Use defaults
provider, err := openai.NewMockOpenAIProvider(nil)

// Custom configuration
config := &providers.ProviderConfig{
    Custom: map[string]interface{}{
        "mock": &openai.MockConfig{
            MinLatencyMs: 100,
            MaxLatencyMs: 150,
            MinTokens:    200,
            MaxTokens:    400,
            CostPerToken: 0.000003,
        },
    },
}
provider, err := openai.NewMockOpenAIProvider(config)
```

### Making Requests

```go
req := &models.InferRequest{
    Model: "igris-mock-gpt-4",
    Messages: []models.Message{
        {Role: "user", Content: "Hello!"},
    },
    MaxTokens: 150,
}

ctx := context.Background()
resp, err := provider.Infer(ctx, req)
```

## Configuration

### MockConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| MinLatencyMs | int | 50 | Minimum simulated latency |
| MaxLatencyMs | int | 200 | Maximum simulated latency |
| MinTokens | int | 100 | Minimum completion tokens |
| MaxTokens | int | 1200 | Maximum completion tokens |
| CostPerToken | float64 | 0.000002 | Cost per token in USD |
| EnableVariation | bool | true | Enable random variation |

## Supported Models

- `igris-mock-gpt-4`
- `igris-mock-gpt-3.5-turbo`

## API Compatibility

The mock provider implements the full `Provider` interface:

- ✅ `Name()` - Returns "mock-openai"
- ✅ `Infer()` - Simulated inference with metadata
- ✅ `InferStream()` - Streaming inference with chunks
- ✅ `HealthCheck()` - Always returns healthy
- ✅ `GetCapabilities()` - Returns mock capabilities
- ✅ `EstimateCost()` - Cost estimation
- ✅ `Close()` - No-op cleanup

## Testing

Run the unit tests:

```bash
go test -v ./internal/providers/openai -run TestMockProvider
```

**Test Coverage:**
- ✅ Basic inference
- ✅ Capabilities
- ✅ Streaming
- ✅ Health checks
- ✅ Cost estimation
- ✅ Custom configuration

## Response Format

The mock provider returns OpenAI-compatible responses with additional simulation metadata:

```json
{
  "id": "chatcmpl-1729012345000000000",
  "object": "chat.completion",
  "model": "igris-mock-gpt-4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello from Igris Mock OpenAI! 🎭..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 330,
    "total_tokens": 342
  },
  "metadata": {
    "provider": "mock-openai",
    "model_used": "igris-mock-gpt-4",
    "latency_ms": 127,
    "cost_usd": 0.000684,
    "quality_score": 0.95
  }
}
```

## Benefits

### For Development
- Zero API costs
- No rate limits
- Works offline
- Fast iteration

### For Testing
- Predictable behavior
- Reproducible results
- Context cancellation testing
- Performance benchmarking

### For CI/CD
- No external dependencies
- Fast test execution
- Deterministic outcomes
- No credential management

## Implementation Details

### Latency Simulation

Actual `time.Sleep()` is used to simulate realistic API behavior:

```go
latencyMs := minLatency + rand.Intn(maxLatency-minLatency+1)
time.Sleep(time.Duration(latencyMs) * time.Millisecond)
```

### Token Estimation

Prompt tokens: `len(content) / 4` (rough approximation)
Completion tokens: Respects `MaxTokens` parameter with 60-90% variance

### Streaming

- TTFT: 20-70ms
- Inter-token delay: 5-20ms
- Proper finish reason handling

## Files

- `mock_openai.go` - Main implementation (386 lines)
- `mock_openai_test.go` - Unit tests (210 lines)
- `README_MOCK.md` - This documentation

## Future Enhancements

- [ ] Error simulation (rate limits, timeouts)
- [ ] Response recording/replay
- [ ] Advanced metrics tracking
- [ ] Configurable response templates

## See Also

- [Provider Interface](../provider_interface.go)
- [InferRequest Model](../../models/infer_request.go)
- [InferResponse Model](../../models/infer_response.go)
- [Phase 7 Documentation](../../../docs/STRUCTURE_STABILIZATION_LOG.md#phase-7-mock-provider-integration-realistic-mode)
