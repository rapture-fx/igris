# Schlep-engine Go SDK

Official Go SDK for Schlep-engine - Intelligent AI routing and cost optimization.

[![Go Reference](https://pkg.go.dev/badge/github.com/igris-inertial/sdk-go.svg)](https://pkg.go.dev/github.com/igris-inertial/sdk-go)
[![Go Report Card](https://goreportcard.com/badge/github.com/igris-inertial/sdk-go)](https://goreportcard.com/report/github.com/igris-inertial/sdk-go)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
go get github.com/igris-inertial/sdk-go
```

## Quick Start

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/igris-inertial/sdk-go/schlep"
)

func main() {
	// Create client
	client := schlep.NewClient(&schlep.Config{
		BaseURL: "http://localhost:8081",
		APIKey:  "your-api-key", // Optional
	})

	// Make inference request
	ctx := context.Background()
	response, err := client.Infer(ctx, &schlep.InferRequest{
		Model: "gpt-4",
		Messages: []schlep.Message{
			{Role: "user", Content: "Hello, world!"},
		},
	})

	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(response.Choices[0].Message.Content)
}
```

## Features

- ✅ Idiomatic Go API with context support
- ✅ Automatic retry logic with exponential backoff
- ✅ Full type safety
- ✅ Minimal dependencies
- ✅ Comprehensive error handling
- ✅ OpenAI-compatible endpoints
- ✅ BYOK (Bring Your Own Key) support

## Usage

### Client Configuration

```go
import "github.com/igris-inertial/sdk-go/schlep"

// Basic configuration
client := schlep.NewClient(&schlep.Config{
	BaseURL: "http://localhost:8081",
})

// With API key
client := schlep.NewClient(&schlep.Config{
	BaseURL: "http://localhost:8081",
	APIKey:  "your-api-key",
})

// With custom timeout
client := schlep.NewClient(&schlep.Config{
	BaseURL: "http://localhost:8081",
	Timeout: 60 * time.Second,
})

// With environment variables
// SCHLEP_BASE_URL and SCHLEP_API_KEY will be used automatically
client := schlep.NewClient(nil)
```

### Making Inference Requests

```go
ctx := context.Background()

response, err := client.Infer(ctx, &schlep.InferRequest{
	Model: "gpt-4",
	Messages: []schlep.Message{
		{Role: "system", Content: "You are a helpful assistant."},
		{Role: "user", Content: "Explain quantum computing."},
	},
	MaxTokens:   schlep.Int(200),
	Temperature: schlep.Float64(0.7),
})

if err != nil {
	log.Fatal(err)
}

fmt.Println(response.Choices[0].Message.Content)

// Access usage statistics
if response.Usage != nil {
	fmt.Printf("Tokens used: %d\n", response.Usage.TotalTokens)
}
```

### Listing Models

```go
ctx := context.Background()

models, err := client.ListModels(ctx)
if err != nil {
	log.Fatal(err)
}

for _, model := range models.Data {
	fmt.Printf("%s - owned by %s\n", model.ID, model.OwnedBy)
}
```

### Health Check

```go
ctx := context.Background()

health, err := client.Health(ctx)
if err != nil {
	log.Fatal(err)
}

if health.Status == "healthy" {
	fmt.Println("API is operational")
}
```

### Error Handling

```go
import "errors"

response, err := client.Infer(ctx, &schlep.InferRequest{
	Model: "gpt-4",
	Messages: []schlep.Message{
		{Role: "user", Content: "Hello"},
	},
})

if err != nil {
	var apiErr *schlep.APIError
	if errors.As(err, &apiErr) {
		fmt.Printf("API Error %d: %s\n", apiErr.StatusCode, apiErr.Message)
	} else {
		fmt.Printf("Network Error: %v\n", err)
	}
	return
}
```

### Context and Timeouts

```go
import "time"

// With timeout
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

response, err := client.Infer(ctx, &schlep.InferRequest{
	Model: "gpt-4",
	Messages: []schlep.Message{
		{Role: "user", Content: "Hello"},
	},
})

// With cancellation
ctx, cancel := context.WithCancel(context.Background())
go func() {
	time.Sleep(5 * time.Second)
	cancel() // Cancel after 5 seconds
}()

response, err := client.Health(ctx)
```

### Multi-turn Conversation

```go
messages := []schlep.Message{
	{Role: "system", Content: "You are helpful."},
	{Role: "user", Content: "What is AI?"},
}

// First response
response1, err := client.Infer(ctx, &schlep.InferRequest{
	Model:    "gpt-4",
	Messages: messages,
})

// Add assistant response to conversation
messages = append(messages, schlep.Message{
	Role:    "assistant",
	Content: response1.Choices[0].Message.Content,
})

// Continue conversation
messages = append(messages, schlep.Message{
	Role:    "user",
	Content: "Tell me more",
})

response2, err := client.Infer(ctx, &schlep.InferRequest{
	Model:    "gpt-4",
	Messages: messages,
})
```

## Examples

See the [examples](./examples/) directory for complete examples:

- [Basic Usage](./examples/basic/main.go) - Simple inference request
- [Conversation](./examples/conversation/main.go) - Multi-turn conversation
- [Error Handling](./examples/error_handling/main.go) - Comprehensive error handling

Run an example:

```bash
cd examples/basic
go run main.go
```

## Environment Variables

The SDK supports the following environment variables:

- `SCHLEP_BASE_URL` - API base URL (default: http://localhost:8081)
- `SCHLEP_API_KEY` - API key for authentication

## API Reference

### Types

**Client**: Main SDK client

**Config**: Client configuration
- `BaseURL string` - API base URL
- `APIKey string` - API key for authentication
- `Timeout time.Duration` - Request timeout
- `HTTPClient *http.Client` - Custom HTTP client

**Message**: Chat message
- `Role string` - Message role (system, user, assistant)
- `Content string` - Message content

**InferRequest**: Inference request
- `Model string` - Model identifier
- `Messages []Message` - Conversation messages
- `MaxTokens *int` - Maximum tokens in response
- `Temperature *float64` - Sampling temperature (0.0-2.0)
- `TopP *float64` - Nucleus sampling parameter

**InferResponse**: Inference response
- `ID string` - Response ID
- `Object string` - Object type
- `Model string` - Model used
- `Choices []Choice` - Response choices
- `Usage *Usage` - Token usage statistics

**HealthResponse**: Health check response
- `Status string` - Health status
- `Version string` - API version
- `Timestamp string` - Check timestamp

**APIError**: API error
- `StatusCode int` - HTTP status code
- `Message string` - Error message
- `Response interface{}` - Full response

### Methods

**NewClient(cfg *Config) *Client**
Creates a new Schlep client

**Infer(ctx context.Context, req *InferRequest) (*InferResponse, error)**
Makes an inference request

**ListModels(ctx context.Context) (*ModelsResponse, error)**
Lists available models

**Health(ctx context.Context) (*HealthResponse, error)**
Checks API health status

**ProviderStats(ctx context.Context) (ProviderStats, error)**
Returns provider statistics

### Helper Functions

**Int(v int) *int**
Returns a pointer to an int value

**Float64(v float64) *float64**
Returns a pointer to a float64 value

## Testing

```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run tests with verbose output
go test -v ./...
```

## Documentation

- [Go Quickstart](/docs/api/go_quickstart.md)
- [API Reference](/docs/api/go_reference.md)
- [GoDoc](https://pkg.go.dev/github.com/igris-inertial/sdk-go)

## Requirements

- Go 1.21 or later

## Dependencies

- `github.com/cenkalti/backoff/v4` - Exponential backoff for retries

## License

MIT License - see LICENSE file for details.

## Support

- GitHub: https://github.com/igris-inertial/igris-inertial
- Issues: https://github.com/igris-inertial/igris-inertial/issues
- Email: hello@igris-inertial.com

---

**Schlep-engine** - Intelligent AI Routing and Cost Optimization

_v1.0.0-rc1_
