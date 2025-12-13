# OpenAI Provider Integration - Technical Documentation

**Version:** 1.0.0
**Status:** ✅ Production Ready
**Last Updated:** October 24, 2025

---

## Overview

The OpenAI provider implements full HTTP client functionality for OpenAI's Chat Completions API with BYOK (Bring Your Own Key) security, streaming support, and accurate cost tracking.

---

## Features

### ✅ Implemented

1. **HTTP Client**
   - Real API calls to `https://api.openai.com/v1/chat/completions`
   - Retry logic with exponential backoff (up to 3 attempts)
   - Context-aware timeout handling (default: 60s)
   - Connection pooling with idle connection management

2. **Streaming Support**
   - Server-Sent Events (SSE) parsing
   - Chunked transfer encoding
   - Delta message processing
   - Context cancellation support

3. **BYOK Security**
   - API key required at initialization
   - Environment variable: `OPENAI_API_KEY`
   - Clear error when key missing: "OpenAI API key is required"
   - No keys logged or committed to version control

4. **Model-Specific Pricing** (as of January 2025)
   - GPT-4: $30/$60 per 1M tokens (prompt/completion)
   - GPT-4 Turbo: $10/$30 per 1M tokens
   - GPT-3.5 Turbo: $0.50/$1.50 per 1M tokens
   - GPT-3.5 Turbo 16K: $3/$4 per 1M tokens

5. **Health Check**
   - Validates API key with `/models` endpoint
   - Detects 401 Unauthorized errors
   - Returns clear error messages

6. **Resource Management**
   - Proper HTTP client cleanup via `Close()`
   - Idle connection closing on shutdown

---

## Usage

### Basic Configuration

```go
import (
    "github.com/igris-inertial/igris-inertial/internal/providers"
    "github.com/igris-inertial/igris-inertial/internal/providers/openai"
)

// Create configuration
config := &providers.ProviderConfig{
    APIKey:     os.Getenv("OPENAI_API_KEY"), // BYOK
    BaseURL:    "https://api.openai.com/v1",
    Timeout:    30,     // seconds
    MaxRetries: 3,
    RetryDelay: 500,    // milliseconds
    EnableMetrics: true,
}

// Initialize provider
provider, err := openai.NewOpenAIProvider(config)
if err != nil {
    log.Fatalf("Failed to initialize OpenAI provider: %v", err)
}
defer provider.Close()
```

### Environment Variables

```bash
# Required
export OPENAI_API_KEY="sk-your-api-key-here"

# Optional (uses defaults if not set)
export PROVIDER_MODE="real"  # or "hybrid", "benchmark", "mock"
```

### Making Requests

#### Non-Streaming Request

```go
req := &models.InferRequest{
    Model: "gpt-4-turbo",
    Messages: []models.Message{
        {Role: "user", Content: "Hello, how are you?"},
    },
    MaxTokens:   150,
    Temperature: 0.7,
}

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

resp, err := provider.Infer(ctx, req)
if err != nil {
    log.Fatalf("Inference failed: %v", err)
}

fmt.Printf("Response: %s\n", resp.Choices[0].Message.Content)
fmt.Printf("Cost: $%.6f\n", resp.Metadata.CostUSD)
fmt.Printf("Latency: %dms\n", resp.Metadata.LatencyMs)
```

#### Streaming Request

```go
req := &models.InferRequest{
    Model:  "gpt-3.5-turbo",
    Stream: true,
    Messages: []models.Message{
        {Role: "user", Content: "Tell me a story"},
    },
}

ctx := context.Background()
chunkChan, errChan := provider.InferStream(ctx, req)

for {
    select {
    case chunk, ok := <-chunkChan:
        if !ok {
            // Stream ended
            return
        }
        fmt.Print(chunk.Delta.Content)

    case err := <-errChan:
        if err != nil {
            log.Printf("Streaming error: %v", err)
        }
        return
    }
}
```

### Health Check

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

err := provider.HealthCheck(ctx)
if err != nil {
    log.Printf("Health check failed: %v", err)
    // Handle degraded state
}
```

---

## API Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/chat/completions` | POST | Main inference endpoint | Yes |
| `/models` | GET | Health check & model listing | Yes |

---

## Error Handling

### Common Errors

| Error | Cause | HTTP Status | Solution |
|-------|-------|-------------|----------|
| "OpenAI API key is required" | Missing API key | N/A | Set `OPENAI_API_KEY` environment variable |
| "invalid API key (401 Unauthorized)" | Invalid key | 401 | Check API key validity in OpenAI dashboard |
| "request failed after 3 retries" | Network/server issues | 5xx | Implement exponential backoff, check OpenAI status |
| "context deadline exceeded" | Timeout | N/A | Increase timeout or check network |

### Retry Logic

The provider automatically retries requests on:
- HTTP 5xx errors (server errors)
- Network connectivity issues

Retry behavior:
- Max retries: 3 (configurable)
- Backoff: Exponential (100ms, 200ms, 400ms, ...)
- Client errors (4xx): No retry

---

## Cost Calculation

### Formula

```
Total Cost = (PromptTokens × PromptPrice + CompletionTokens × CompletionPrice) / 1,000,000
```

### Example

```
Model: GPT-4 Turbo
Prompt Tokens: 1,000
Completion Tokens: 500

Prompt Cost: 1,000 × $10 / 1,000,000 = $0.01
Completion Cost: 500 × $30 / 1,000,000 = $0.015
Total Cost: $0.025
```

---

## Supported Models

| Model | Context Window | Pricing (Input/Output per 1M) | Best For |
|-------|----------------|-------------------------------|----------|
| gpt-4 | 8K | $30/$60 | Complex reasoning |
| gpt-4-turbo | 128K | $10/$30 | Long context, balanced cost |
| gpt-3.5-turbo | 16K | $0.50/$1.50 | Fast responses, low cost |

---

## Testing

### Running Tests

```bash
# Run all tests
go test ./internal/providers/openai/... -v

# Run specific test
go test ./internal/providers/openai/... -run TestInfer_MockServer -v

# Run with race detector
go test ./internal/providers/openai/... -race -v
```

### Test Coverage

| Test | Coverage |
|------|----------|
| BYOK Validation | ✅ |
| Provider Initialization | ✅ |
| Mock Inference | ✅ |
| Auth Error Handling | ✅ |
| Health Check | ✅ |
| Invalid Key Detection | ✅ |
| Cost Calculation (3 models) | ✅ |
| Resource Cleanup | ✅ |

**Total: 12 passing tests**

---

## Security Best Practices

1. **Never commit API keys** - Use environment variables
2. **Use `.env` files** - Add to `.gitignore`
3. **Rotate keys regularly** - Follow OpenAI's recommendations
4. **Monitor usage** - Track costs via provider metrics
5. **Use least privilege** - Limit API key permissions if available

---

## Performance Considerations

### Timeouts

- Default: 60 seconds
- Recommended: 30 seconds for most use cases
- Streaming: May need longer timeout for large responses

### Connection Pooling

```go
MaxIdleConns:        100
MaxIdleConnsPerHost: 10
IdleConnTimeout:     90 * time.Second
```

### Optimization Tips

1. Use GPT-3.5 Turbo for simple tasks (20x cheaper than GPT-4)
2. Limit `MaxTokens` to reduce costs
3. Implement response caching for repeated queries
4. Use streaming for better UX on long responses

---

## Troubleshooting

### Provider Won't Initialize

```bash
# Check API key is set
echo $OPENAI_API_KEY

# Verify key format (should start with sk-)
# Valid: sk-abc123...
# Invalid: abc123...
```

### Requests Timing Out

1. Check internet connectivity
2. Verify OpenAI API status: https://status.openai.com
3. Increase timeout in config
4. Check for rate limiting

### Streaming Not Working

1. Ensure `req.Stream = true`
2. Check SSE support in client
3. Verify network allows streaming connections

---

## Migration from Benchmark Mode

```go
// Before (Benchmark Mode)
provider, _ := openai.NewBenchmarkOpenAIProvider(config)

// After (Real Mode with BYOK)
config.APIKey = os.Getenv("OPENAI_API_KEY")
provider, _ := openai.NewOpenAIProvider(config)
```

---

## References

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [OpenAI Pricing](https://openai.com/pricing)
- [Best Practices](https://platform.openai.com/docs/guides/production-best-practices)

---

**Document Version:** 1.0.0
**Author:** Schlep-Engine Team
**Last Review:** October 24, 2025
