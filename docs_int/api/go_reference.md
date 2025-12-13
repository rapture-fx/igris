# Go SDK API Reference

Complete API reference for the Schlep-engine Go SDK.

## Installation

```bash
go get github.com/igris-inertial/sdk-go
```

## Import

```go
import "github.com/igris-inertial/sdk-go/schlep"
```

## Package: `schlep`

The `schlep` package provides the official Go SDK for Schlep-engine.

### Constants

```go
const (
	DefaultBaseURL = "http://localhost:8081"
	DefaultTimeout = 30 * time.Second
	SDKVersion     = "1.0.0-rc1"
)
```

---

## Type: `Client`

The main Schlep-engine SDK client.

```go
type Client struct {
	// contains filtered or unexported fields
}
```

### Function: `NewClient`

```go
func NewClient(cfg *Config) *Client
```

Creates a new Schlep-engine client. If `cfg` is nil, default configuration is used.

**Parameters:**
- `cfg` (*Config): Client configuration (optional)

**Returns:**
- `*Client`: New client instance

**Example:**
```go
// Default configuration
client := schlep.NewClient(nil)

// Custom configuration
client := schlep.NewClient(&schlep.Config{
	BaseURL: "http://localhost:8081",
	APIKey:  "your-api-key",
	Timeout: 60 * time.Second,
})
```

---

### Method: `Infer`

```go
func (c *Client) Infer(ctx context.Context, req *InferRequest) (*InferResponse, error)
```

Makes an inference request using Schlep-engine's intelligent routing.

**Parameters:**
- `ctx` (context.Context): Request context for cancellation/timeout
- `req` (*InferRequest): Inference request parameters

**Returns:**
- `*InferResponse`: Inference response
- `error`: Error if request fails

**Example:**
```go
ctx := context.Background()
response, err := client.Infer(ctx, &schlep.InferRequest{
	Model: "gpt-4",
	Messages: []schlep.Message{
		{Role: "system", Content: "You are helpful."},
		{Role: "user", Content: "Hello!"},
	},
	MaxTokens:   schlep.Int(100),
	Temperature: schlep.Float64(0.7),
})
```

---

### Method: `ListModels`

```go
func (c *Client) ListModels(ctx context.Context) (*ModelsResponse, error)
```

Lists all available models.

**Parameters:**
- `ctx` (context.Context): Request context

**Returns:**
- `*ModelsResponse`: List of available models
- `error`: Error if request fails

**Example:**
```go
ctx := context.Background()
models, err := client.ListModels(ctx)
if err != nil {
	log.Fatal(err)
}

for _, model := range models.Data {
	fmt.Println(model.ID)
}
```

---

### Method: `Health`

```go
func (c *Client) Health(ctx context.Context) (*HealthResponse, error)
```

Checks the API health status.

**Parameters:**
- `ctx` (context.Context): Request context

**Returns:**
- `*HealthResponse`: Health status
- `error`: Error if request fails

**Example:**
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

---

### Method: `ProviderStats`

```go
func (c *Client) ProviderStats(ctx context.Context) (ProviderStats, error)
```

Returns provider statistics.

**Parameters:**
- `ctx` (context.Context): Request context

**Returns:**
- `ProviderStats`: Provider statistics map
- `error`: Error if request fails

**Example:**
```go
ctx := context.Background()
stats, err := client.ProviderStats(ctx)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Stats: %+v\n", stats)
```

---

## Type: `Config`

Client configuration options.

```go
type Config struct {
	BaseURL    string
	APIKey     string
	Timeout    time.Duration
	HTTPClient *http.Client
}
```

**Fields:**
- `BaseURL` (string): API base URL (default: http://localhost:8081 or SCHLEP_BASE_URL)
- `APIKey` (string): API key for authentication (default: SCHLEP_API_KEY)
- `Timeout` (time.Duration): Request timeout (default: 30 seconds)
- `HTTPClient` (*http.Client): Custom HTTP client (optional)

**Example:**
```go
config := &schlep.Config{
	BaseURL: "https://api.schlep.com",
	APIKey:  "your-api-key",
	Timeout: 60 * time.Second,
}
```

---

## Type: `Message`

Represents a chat message.

```go
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
```

**Fields:**
- `Role` (string): Message role ("system", "user", or "assistant")
- `Content` (string): Message content

**Example:**
```go
messages := []schlep.Message{
	{Role: "system", Content: "You are helpful."},
	{Role: "user", Content: "Hello!"},
}
```

---

## Type: `InferRequest`

Inference request parameters.

```go
type InferRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   *int      `json:"max_tokens,omitempty"`
	Temperature *float64  `json:"temperature,omitempty"`
	TopP        *float64  `json:"top_p,omitempty"`
}
```

**Fields:**
- `Model` (string): Model identifier (required)
- `Messages` ([]Message): Conversation messages (required)
- `MaxTokens` (*int): Maximum tokens in response (optional)
- `Temperature` (*float64): Sampling temperature 0.0-2.0 (optional)
- `TopP` (*float64): Nucleus sampling parameter (optional)

**Example:**
```go
request := &schlep.InferRequest{
	Model: "gpt-4",
	Messages: []schlep.Message{
		{Role: "user", Content: "Hello"},
	},
	MaxTokens:   schlep.Int(200),
	Temperature: schlep.Float64(0.7),
	TopP:        schlep.Float64(0.9),
}
```

---

## Type: `InferResponse`

Inference response.

```go
type InferResponse struct {
	ID      string   `json:"id,omitempty"`
	Object  string   `json:"object,omitempty"`
	Created int64    `json:"created,omitempty"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   *Usage   `json:"usage,omitempty"`
}
```

**Fields:**
- `ID` (string): Response ID
- `Object` (string): Object type
- `Created` (int64): Creation timestamp
- `Model` (string): Model used
- `Choices` ([]Choice): Response choices
- `Usage` (*Usage): Token usage statistics

**Example:**
```go
if len(response.Choices) > 0 {
	content := response.Choices[0].Message.Content
	fmt.Println(content)
}

if response.Usage != nil {
	fmt.Printf("Tokens: %d\n", response.Usage.TotalTokens)
}
```

---

## Type: `Choice`

Response choice.

```go
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason,omitempty"`
}
```

**Fields:**
- `Index` (int): Choice index
- `Message` (Message): Response message
- `FinishReason` (string): Reason for completion ("stop", "length", etc.)

---

## Type: `Usage`

Token usage statistics.

```go
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}
```

**Fields:**
- `PromptTokens` (int): Tokens in the prompt
- `CompletionTokens` (int): Tokens in the completion
- `TotalTokens` (int): Total tokens used

---

## Type: `Model`

Model information.

```go
type Model struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created,omitempty"`
	OwnedBy string `json:"owned_by,omitempty"`
}
```

**Fields:**
- `ID` (string): Model identifier
- `Object` (string): Object type
- `Created` (int64): Creation timestamp
- `OwnedBy` (string): Owner organization

---

## Type: `ModelsResponse`

Models list response.

```go
type ModelsResponse struct {
	Object string  `json:"object"`
	Data   []Model `json:"data"`
}
```

**Fields:**
- `Object` (string): Object type ("list")
- `Data` ([]Model): List of models

---

## Type: `HealthResponse`

Health check response.

```go
type HealthResponse struct {
	Status    string `json:"status"`
	Version   string `json:"version,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}
```

**Fields:**
- `Status` (string): Health status ("healthy", "degraded", "unhealthy")
- `Version` (string): API version
- `Timestamp` (string): Check timestamp

---

## Type: `ProviderStats`

Provider statistics.

```go
type ProviderStats map[string]interface{}
```

A map containing provider-specific statistics.

---

## Type: `APIError`

API error response.

```go
type APIError struct {
	StatusCode int
	Message    string
	Response   interface{}
}
```

**Fields:**
- `StatusCode` (int): HTTP status code
- `Message` (string): Error message
- `Response` (interface{}): Full response data

**Method: Error**

```go
func (e *APIError) Error() string
```

Implements the error interface.

**Example:**
```go
import "errors"

response, err := client.Infer(ctx, request)
if err != nil {
	var apiErr *schlep.APIError
	if errors.As(err, &apiErr) {
		fmt.Printf("API Error %d: %s\n", apiErr.StatusCode, apiErr.Message)
		return
	}
	// Handle other errors
}
```

---

## Helper Functions

### Function: `Int`

```go
func Int(v int) *int
```

Returns a pointer to the int value passed in. Useful for optional fields.

**Example:**
```go
request := &schlep.InferRequest{
	Model:     "gpt-4",
	Messages:  messages,
	MaxTokens: schlep.Int(200), // Convert int to *int
}
```

---

### Function: `Float64`

```go
func Float64(v float64) *float64
```

Returns a pointer to the float64 value passed in. Useful for optional fields.

**Example:**
```go
request := &schlep.InferRequest{
	Model:       "gpt-4",
	Messages:    messages,
	Temperature: schlep.Float64(0.7), // Convert float64 to *float64
}
```

---

## Context Usage

All API methods accept a `context.Context` for cancellation and timeout control.

### With Timeout

```go
import (
	"context"
	"time"
)

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

response, err := client.Infer(ctx, request)
```

### With Cancellation

```go
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

// Cancel on some condition
go func() {
	<-someChannel
	cancel()
}()

response, err := client.Infer(ctx, request)
```

### With Deadline

```go
deadline := time.Now().Add(1 * time.Minute)
ctx, cancel := context.WithDeadline(context.Background(), deadline)
defer cancel()

response, err := client.Infer(ctx, request)
```

---

## Error Handling

### Checking Error Types

```go
import "errors"

response, err := client.Infer(ctx, request)
if err != nil {
	// Check for API errors
	var apiErr *schlep.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.StatusCode {
		case 401:
			fmt.Println("Authentication failed")
		case 429:
			fmt.Println("Rate limit exceeded")
		case 500:
			fmt.Println("Server error")
		default:
			fmt.Printf("API error %d: %s\n", apiErr.StatusCode, apiErr.Message)
		}
		return
	}

	// Network or other errors
	fmt.Printf("Request failed: %v\n", err)
	return
}
```

### Retry Logic

The SDK automatically retries transient errors (429, 500+) with exponential backoff up to 30 seconds.

---

## Complete Example

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/igris-inertial/sdk-go/schlep"
)

func main() {
	// Initialize client with environment variables
	client := schlep.NewClient(&schlep.Config{
		BaseURL: os.Getenv("SCHLEP_BASE_URL"),
		APIKey:  os.Getenv("SCHLEP_API_KEY"),
		Timeout: 60 * time.Second,
	})

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check health
	health, err := client.Health(ctx)
	if err != nil {
		log.Fatalf("Health check failed: %v", err)
	}
	fmt.Printf("API Status: %s\n", health.Status)

	// List models
	models, err := client.ListModels(ctx)
	if err != nil {
		log.Fatalf("Failed to list models: %v", err)
	}
	fmt.Printf("Available models: %d\n", len(models.Data))

	// Make inference request
	response, err := client.Infer(ctx, &schlep.InferRequest{
		Model: "gpt-4",
		Messages: []schlep.Message{
			{Role: "system", Content: "You are helpful."},
			{Role: "user", Content: "Explain AI in one sentence."},
		},
		MaxTokens:   schlep.Int(100),
		Temperature: schlep.Float64(0.7),
	})

	if err != nil {
		var apiErr *schlep.APIError
		if errors.As(err, &apiErr) {
			log.Fatalf("API Error %d: %s", apiErr.StatusCode, apiErr.Message)
		}
		log.Fatalf("Request failed: %v", err)
	}

	// Print response
	fmt.Println("\nResponse:")
	fmt.Println(response.Choices[0].Message.Content)

	// Print usage
	if response.Usage != nil {
		fmt.Printf("\nTokens used: %d\n", response.Usage.TotalTokens)
	}
}
```

---

## Environment Variables

- `SCHLEP_BASE_URL` - API base URL (default: http://localhost:8081)
- `SCHLEP_API_KEY` - API key for authentication

---

## Support

- GoDoc: https://pkg.go.dev/github.com/igris-inertial/sdk-go
- GitHub: https://github.com/igris-inertial/igris-inertial
- Issues: https://github.com/igris-inertial/igris-inertial/issues
- Email: hello@igris-inertial.com

---

**Schlep-engine** - Intelligent AI Routing and Cost Optimization

_v1.0.0-rc1_
