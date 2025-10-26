# Anthropic Provider Integration - Technical Documentation

**Version:** 1.0.0
**Status:** ✅ Production Ready
**Last Updated:** October 24, 2025

---

## Overview

The Anthropic provider implements full HTTP client functionality for Anthropic's Messages API with BYOK (Bring Your Own Key) security, streaming support, and accurate cost tracking for Claude models.

---

## Features

### ✅ Implemented

1. **HTTP Client**
   - Real API calls to `https://api.anthropic.com/v1/messages`
   - Retry logic with exponential backoff (up to 3 attempts)
   - Context-aware timeout handling (default: 60s)
   - Connection pooling with idle connection management

2. **Streaming Support**
   - Server-Sent Events (SSE) parsing with Anthropic's event format
   - Event types: `message_start`, `content_block_delta`, `message_delta`, `message_stop`
   - Delta message processing
   - Context cancellation support

3. **BYOK Security**
   - API key required at initialization
   - Environment variable: `ANTHROPIC_API_KEY`
   - Clear error when key missing: "Anthropic API key is required"
   - No keys logged or committed to version control

4. **Model-Specific Pricing** (as of January 2025)
   - Claude 3 Opus: $15/$75 per 1M tokens (input/output)
   - Claude 3 Sonnet: $3/$15 per 1M tokens
   - Claude 3.5 Sonnet: $3/$15 per 1M tokens
   - Claude 3 Haiku: $0.25/$1.25 per 1M tokens
   - Claude 2.1: $8/$24 per 1M tokens

5. **Health Check**
   - Minimal message request to validate API key
   - Detects 401/403 Unauthorized errors
   - Returns clear error messages

6. **Resource Management**
   - Proper HTTP client cleanup via `Close()`
   - Idle connection closing on shutdown

7. **System Message Handling**
   - Anthropic requires system messages as separate parameter
   - Automatic extraction from messages array
   - Proper formatting for Claude API

---

## Usage

### Basic Configuration

```go
import (
    "github.com/schlep-engine/schlep-engine/internal/providers"
    "github.com/schlep-engine/schlep-engine/internal/providers/anthropic"
)

// Create configuration
config := &providers.ProviderConfig{
    APIKey:     os.Getenv("ANTHROPIC_API_KEY"), // BYOK
    BaseURL:    "https://api.anthropic.com/v1",
    Timeout:    30,     // seconds
    MaxRetries: 3,
    RetryDelay: 500,    // milliseconds
    EnableMetrics: true,
}

// Initialize provider
provider, err := anthropic.NewAnthropicProvider(config)
if err != nil {
    log.Fatalf("Failed to initialize Anthropic provider: %v", err)
}
defer provider.Close()
```

### Environment Variables

```bash
# Required
export ANTHROPIC_API_KEY="sk-ant-your-api-key-here"

# Optional (uses defaults if not set)
export PROVIDER_MODE="real"  # or "hybrid", "benchmark", "mock"
```

### Making Requests

#### Non-Streaming Request

```go
req := &models.InferRequest{
    Model: "claude-3-sonnet-20240229",
    Messages: []models.Message{
        {Role: "system", Content: "You are a helpful assistant."},
        {Role: "user", Content: "Hello, how are you?"},
    },
    MaxTokens:   200,
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
    Model:  "claude-3-haiku-20240307",
    Stream: true,
    Messages: []models.Message{
        {Role: "user", Content: "Tell me a story"},
    },
    MaxTokens: 500,
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
        if chunk.Delta.Content != "" {
            fmt.Print(chunk.Delta.Content)
        }

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
| `/messages` | POST | Main inference endpoint | Yes |

---

## Anthropic-Specific Features

### 1. System Message Handling

Unlike OpenAI, Anthropic requires system messages as a separate parameter:

```go
// Input messages
[]models.Message{
    {Role: "system", Content: "You are helpful."},
    {Role: "user", Content: "Hello"},
}

// Automatically converted to:
{
    "system": "You are helpful.",
    "messages": [
        {"role": "user", "content": "Hello"}
    ]
}
```

### 2. Top-K Support

Anthropic supports `top_k` parameter (unlike OpenAI):

```go
req := &models.InferRequest{
    Model: "claude-3-sonnet-20240229",
    TopK:  40, // Supported by Anthropic
    ...
}
```

### 3. Streaming Event Types

Anthropic uses specific event types in streaming:
- `message_start`: Stream initiated, contains message ID
- `content_block_start`: Content block begins
- `content_block_delta`: Incremental text content
- `message_delta`: Metadata updates (e.g., stop reason)
- `message_stop`: Stream completed

---

## Error Handling

### Common Errors

| Error | Cause | HTTP Status | Solution |
|-------|-------|-------------|----------|
| "Anthropic API key is required" | Missing API key | N/A | Set `ANTHROPIC_API_KEY` environment variable |
| "invalid API key (status 401)" | Invalid key | 401 | Check API key validity in Anthropic console |
| "request failed after 3 retries" | Network/server issues | 5xx | Implement exponential backoff, check Anthropic status |
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
Total Cost = (InputTokens × InputPrice + OutputTokens × OutputPrice) / 1,000,000
```

### Example

```
Model: Claude 3 Sonnet
Input Tokens: 1,000
Output Tokens: 500

Input Cost: 1,000 × $3 / 1,000,000 = $0.003
Output Cost: 500 × $15 / 1,000,000 = $0.0075
Total Cost: $0.0105
```

---

## Supported Models

| Model | Context Window | Pricing (Input/Output per 1M) | Best For |
|-------|----------------|-------------------------------|----------|
| claude-3-opus-20240229 | 200K | $15/$75 | Complex analysis, nuanced tasks |
| claude-3-sonnet-20240229 | 200K | $3/$15 | Balanced performance & cost |
| claude-3.5-sonnet | 200K | $3/$15 | Latest Sonnet with improvements |
| claude-3-haiku-20240307 | 200K | $0.25/$1.25 | Fast responses, low cost |
| claude-2.1 | 200K | $8/$24 | Legacy support |

---

## Testing

### Running Tests

```bash
# Run all tests
go test ./internal/providers/anthropic/... -v

# Run specific test
go test ./internal/providers/anthropic/... -run TestInfer_MockServer -v

# Run with race detector
go test ./internal/providers/anthropic/... -race -v
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
| Cost Calculation (4 models) | ✅ |
| System Message Handling | ✅ |
| Resource Cleanup | ✅ |

**Total: 10 passing tests (100% pass rate)**

---

## Security Best Practices

1. **Never commit API keys** - Use environment variables
2. **Use `.env` files** - Add to `.gitignore`
3. **Rotate keys regularly** - Follow Anthropic's recommendations
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

1. Use Claude 3 Haiku for simple tasks (60x cheaper than Opus)
2. Limit `MaxTokens` to reduce costs
3. Use Claude 3 Sonnet for balanced cost/performance
4. Implement response caching for repeated queries
5. Use streaming for better UX on long responses

---

## Troubleshooting

### Provider Won't Initialize

```bash
# Check API key is set
echo $ANTHROPIC_API_KEY

# Verify key format (should start with sk-ant-)
# Valid: sk-ant-api03-abc123...
# Invalid: abc123...
```

### Requests Timing Out

1. Check internet connectivity
2. Verify Anthropic API status: https://status.anthropic.com
3. Increase timeout in config
4. Check for rate limiting

### Streaming Not Working

1. Ensure `req.Stream = true`
2. Check SSE support in client
3. Verify network allows streaming connections
4. Check for event parsing issues in logs

---

## Migration from Benchmark Mode

```go
// Before (Benchmark Mode)
provider, _ := anthropic.NewBenchmarkAnthropicProvider(config)

// After (Real Mode with BYOK)
config.APIKey = os.Getenv("ANTHROPIC_API_KEY")
provider, _ := anthropic.NewAnthropicProvider(config)
```

---

## Differences from OpenAI Provider

| Feature | OpenAI | Anthropic |
|---------|--------|-----------|
| Auth Header | `Authorization: Bearer {key}` | `x-api-key: {key}` |
| Version Header | None | `anthropic-version: 2023-06-01` (required) |
| System Messages | In messages array | Separate `system` parameter |
| Top-K | Not supported | Supported |
| Streaming Events | `data: {json}` | Event-specific types |
| Health Endpoint | `/models` | None (use minimal message) |

---

## References

- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference/getting-started)
- [Anthropic Pricing](https://www.anthropic.com/api)
- [Claude Models](https://docs.anthropic.com/claude/docs/models-overview)

---

**Document Version:** 1.0.0
**Author:** Schlep-Engine Team
**Last Review:** October 24, 2025
