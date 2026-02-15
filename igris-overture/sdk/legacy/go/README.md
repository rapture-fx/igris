# Igris-engine Go SDK

**Status:** 🚧 In Development - Planned for Future Release

## Overview

The Igris-engine Go SDK is currently under development and not yet ready for production use.

## Planned Features

- Native Go client for Igris-engine API
- Full support for `/v1/infer`, `/v1/models`, `/v1/health` endpoints
- Context-aware request handling
- Structured error types
- Concurrent request support
- Mock testing utilities

## Installation (Coming Soon)

```bash
go get github.com/igris-inertial/igris-go
```

## Planned Usage

```go
package main

import (
    "context"
    "fmt"
    "github.com/igris-inertial/igris-go"
)

func main() {
    client := igris.NewClient(igris.Config{
        BaseURL: "http://localhost:8081",
        APIKey:  "your-api-key",
    })

    resp, err := client.Infer(context.Background(), &igris.InferRequest{
        Model: "gpt-4",
        Messages: []igris.Message{
            {Role: "user", Content: "Hello!"},
        },
    })

    if err != nil {
        panic(err)
    }

    fmt.Println(resp.Choices[0].Message.Content)
}
```

## Current Status

This SDK is in the planning phase. We are gathering community feedback on the API design.

## Contributing

Interested in contributing to the Go SDK? Please see our [Contributing Guide](https://github.com/igris-inertial/igris-inertial/blob/main/CONTRIBUTING.md).

## Timeline

- **Q1 2026**: Alpha release with basic inference support
- **Q2 2026**: Beta release with full API coverage
- **Q3 2026**: v1.0 stable release

## Alternative Solutions

While we work on the official Go SDK, you can use:
- Direct HTTP requests to the `/v1` endpoints
- The Python or JavaScript SDKs via inter-process communication
- Community-maintained Go clients (not officially supported)

## Contact

For questions or to express interest in early access:
- Email: hello@igris-inertial.com
- GitHub: https://github.com/igris-inertial/igris-inertial/issues

---

**Igris-engine** - Intelligent AI Routing and Cost Optimization
