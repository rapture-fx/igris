# Go SDK Quickstart

Get started with the Schlep-engine Go SDK in minutes.

## Installation

```bash
go get github.com/schlep-engine/sdk-go
```

## Quick Start

### Basic Usage

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/schlep-engine/sdk-go/schlep"
)

func main() {
	// Create client
	client := schlep.NewClient(&schlep.Config{
		BaseURL: "http://localhost:8081",
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

### With Authentication

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/schlep-engine/sdk-go/schlep"
)

func main() {
	client := schlep.NewClient(&schlep.Config{
		BaseURL: "https://api.schlep.com",
		APIKey:  os.Getenv("SCHLEP_API_KEY"),
	})

	ctx := context.Background()
	response, err := client.Infer(ctx, &schlep.InferRequest{
		Model: "gpt-4",
		Messages: []schlep.Message{
			{Role: "user", Content: "Explain AI"},
		},
	})

	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(response.Choices[0].Message.Content)
}
```

## Common Examples

### Chat Conversation

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/schlep-engine/sdk-go/schlep"
)

func main() {
	client := schlep.NewClient(&schlep.Config{
		BaseURL: "http://localhost:8081",
	})

	ctx := context.Background()

	// Initialize conversation
	messages := []schlep.Message{
		{Role: "system", Content: "You are a helpful assistant."},
		{Role: "user", Content: "What is machine learning?"},
	}

	// Get first response
	response1, err := client.Infer(ctx, &schlep.InferRequest{
		Model:       "gpt-4",
		Messages:    messages,
		MaxTokens:   schlep.Int(200),
		Temperature: schlep.Float64(0.7),
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Assistant: %s\n\n", response1.Choices[0].Message.Content)

	// Add assistant response to conversation
	messages = append(messages, schlep.Message{
		Role:    "assistant",
		Content: response1.Choices[0].Message.Content,
	})

	// Continue conversation
	messages = append(messages, schlep.Message{
		Role:    "user",
		Content: "Can you give me an example?",
	})

	response2, err := client.Infer(ctx, &schlep.InferRequest{
		Model:    "gpt-4",
		Messages: messages,
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Assistant: %s\n", response2.Choices[0].Message.Content)
}
```

### List Available Models

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/schlep-engine/sdk-go/schlep"
)

func main() {
	client := schlep.NewClient(&schlep.Config{
		BaseURL: "http://localhost:8081",
	})

	ctx := context.Background()
	models, err := client.ListModels(ctx)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Available models:")
	for _, model := range models.Data {
		fmt.Printf("  - %s (owned by %s)\n", model.ID, model.OwnedBy)
	}
}
```

### Health Check

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/schlep-engine/sdk-go/schlep"
)

func main() {
	client := schlep.NewClient(&schlep.Config{
		BaseURL: "http://localhost:8081",
	})

	ctx := context.Background()
	health, err := client.Health(ctx)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("API Status: %s\n", health.Status)
	if health.Version != "" {
		fmt.Printf("Version: %s\n", health.Version)
	}
}
```

### Error Handling

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/schlep-engine/sdk-go/schlep"
)

func main() {
	client := schlep.NewClient(&schlep.Config{
		BaseURL: "http://localhost:8081",
	})

	ctx := context.Background()
	response, err := client.Infer(ctx, &schlep.InferRequest{
		Model: "gpt-4",
		Messages: []schlep.Message{
			{Role: "user", Content: "Hello"},
		},
	})

	if err != nil {
		// Check if it's an API error
		var apiErr *schlep.APIError
		if errors.As(err, &apiErr) {
			fmt.Printf("API Error %d: %s\n", apiErr.StatusCode, apiErr.Message)
			return
		}

		// Other errors (network, timeout, etc.)
		log.Fatalf("Request failed: %v", err)
	}

	fmt.Println(response.Choices[0].Message.Content)
}
```

## Configuration Options

### Client Configuration

```go
import (
	"net/http"
	"time"

	"github.com/schlep-engine/sdk-go/schlep"
)

// Full configuration
client := schlep.NewClient(&schlep.Config{
	BaseURL: "http://localhost:8081",  // API endpoint
	APIKey:  "your-api-key",           // Optional authentication
	Timeout: 60 * time.Second,         // Request timeout
	HTTPClient: &http.Client{          // Custom HTTP client
		Timeout: 60 * time.Second,
	},
})
```

### Inference Parameters

```go
response, err := client.Infer(ctx, &schlep.InferRequest{
	Model: "gpt-4",                     // Model identifier
	Messages: []schlep.Message{...},   // Conversation messages
	MaxTokens:   schlep.Int(500),      // Maximum response length
	Temperature: schlep.Float64(0.7),  // Randomness (0.0-2.0)
	TopP:        schlep.Float64(0.9),  // Nucleus sampling
})
```

## Context and Timeouts

### With Timeout

```go
import (
	"context"
	"time"
)

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

response, err := client.Infer(ctx, &schlep.InferRequest{
	Model: "gpt-4",
	Messages: []schlep.Message{
		{Role: "user", Content: "Hello"},
	},
})
```

### With Cancellation

```go
import "context"

ctx, cancel := context.WithCancel(context.Background())

// Cancel after some condition
go func() {
	// ... wait for some event
	cancel()
}()

response, err := client.Infer(ctx, &schlep.InferRequest{
	Model:    "gpt-4",
	Messages: []schlep.Message{{Role: "user", Content: "Hello"}},
})
```

## Environment Variables

The SDK automatically uses these environment variables:

```bash
export SCHLEP_BASE_URL="http://localhost:8081"
export SCHLEP_API_KEY="your-api-key"
```

```go
// No need to pass config - will use environment variables
client := schlep.NewClient(nil)
```

## Complete Example

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/schlep-engine/sdk-go/schlep"
)

func main() {
	// Initialize client
	client := schlep.NewClient(&schlep.Config{
		BaseURL: os.Getenv("SCHLEP_BASE_URL"),
		APIKey:  os.Getenv("SCHLEP_API_KEY"),
	})

	ctx := context.Background()

	// Check health
	fmt.Println("Checking API health...")
	health, err := client.Health(ctx)
	if err != nil {
		log.Fatalf("Health check failed: %v", err)
	}
	fmt.Printf("✓ API Status: %s\n\n", health.Status)

	// List models
	fmt.Println("Listing models...")
	models, err := client.ListModels(ctx)
	if err != nil {
		log.Fatalf("Failed to list models: %v", err)
	}
	fmt.Printf("Found %d models\n\n", len(models.Data))

	// Make inference request
	fmt.Println("Making inference request...")
	response, err := client.Infer(ctx, &schlep.InferRequest{
		Model: "gpt-4",
		Messages: []schlep.Message{
			{Role: "system", Content: "You are helpful."},
			{Role: "user", Content: "Explain Schlep-engine in one sentence."},
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

## Next Steps

- Read the [Go SDK API Reference](/docs/api/go_reference.md)
- Explore the [examples directory](/internal/sdk/go/examples/)
- Learn about [BYOK configuration](/docs/byok.md)
- Check the [GoDoc documentation](https://pkg.go.dev/github.com/schlep-engine/sdk-go)

## Support

- GitHub: https://github.com/schlep-engine/schlep-engine
- Issues: https://github.com/schlep-engine/schlep-engine/issues
- Email: hello@schlep-engine.com

---

**Schlep-engine** - Intelligent AI Routing and Cost Optimization
