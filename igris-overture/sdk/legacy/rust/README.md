# Igris-engine Rust SDK

**Status:** 🚧 In Development - Planned for Future Release

## Overview

The Igris-engine Rust SDK is currently under development and not yet ready for production use.

## Planned Features

- Idiomatic Rust API with strong type safety
- Async/await support with tokio
- Zero-cost abstractions
- Comprehensive error handling with `Result<T, E>`
- Builder pattern for request configuration
- Full OpenAPI schema validation

## Installation (Coming Soon)

```toml
[dependencies]
igris = "1.0.0"
tokio = { version = "1", features = ["full"] }
```

## Planned Usage

```rust
use igris::{Client, InferRequest, Message};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::builder()
        .base_url("http://localhost:8081")
        .api_key("your-api-key")
        .build()?;

    let response = client.infer(
        InferRequest::builder()
            .model("gpt-4")
            .message(Message::user("Hello, world!"))
            .max_tokens(100)
            .build()?
    ).await?;

    println!("{}", response.choices[0].message.content);
    Ok(())
}
```

## Current Status

This SDK is in the design phase. We are working on the core architecture and type system.

## Contributing

Interested in contributing to the Rust SDK? Please see our [Contributing Guide](https://github.com/igris-inertial/igris-inertial/blob/main/CONTRIBUTING.md).

## Timeline

- **Q2 2026**: Alpha release with core functionality
- **Q3 2026**: Beta release with streaming support
- **Q4 2026**: v1.0 stable release

## Alternative Solutions

While we work on the official Rust SDK, you can use:
- Direct HTTP requests with `reqwest` crate
- The Python or JavaScript SDKs via FFI
- Community-maintained Rust clients (not officially supported)

## Contact

For questions or to express interest in early access:
- Email: hello@igris-inertial.com
- GitHub: https://github.com/igris-inertial/igris-inertial/issues

---

**Igris-engine** - Intelligent AI Routing and Cost Optimization
