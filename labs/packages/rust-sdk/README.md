# Schlep-engine Rust SDK

Official Rust SDK for the Schlep-engine API platform.

[![Crates.io](https://img.shields.io/crates/v/schlep_engine.svg)](https://crates.io/crates/schlep_engine)
[![Documentation](https://docs.rs/schlep_engine/badge.svg)](https://docs.rs/schlep_engine)
[![License](https://img.shields.io/crates/l/schlep_engine.svg)](LICENSE)

## Features

- 🚀 **Fast & Async**: Built on tokio and reqwest for high-performance async operations
- 🔒 **Type-safe**: Fully typed API with serde for serialization
- 🛡️ **Error Handling**: Comprehensive error types with detailed messages
- 📡 **Streaming**: WebSocket support for real-time events
- 🔑 **Authentication**: Bearer token authentication with environment variable support
- 📚 **Well Documented**: Extensive documentation and examples

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
schlep_engine = "1.0.0"
tokio = { version = "1.0", features = ["full"] }
```

## Quick Start

```rust
use schlep_engine::{SchlepClient, Result};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<()> {
    // Create client with API key
    let client = SchlepClient::new("your-api-key")?;

    // Or from environment variable SCHLEP_API_KEY
    let client = SchlepClient::from_env()?;

    // Upload data
    let upload_result = client.upload("Hello, world!").await?;
    println!("Upload job ID: {}", upload_result.job_id);

    // Train a model
    let train_config = json!({
        "model_type": "classification",
        "dataset_id": upload_result.job_id
    });
    let train_result = client.train(train_config).await?;

    // Deploy model
    if let Some(model_id) = train_result.model_id {
        let deploy_result = client.deploy(&model_id).await?;
        println!("Model deployed at: {}", deploy_result.endpoint_url);
    }

    Ok(())
}
```

## API Reference

### Client Creation

```rust
// With API key
let client = SchlepClient::new("your-api-key")?;

// From environment variable
let client = SchlepClient::from_env()?;

// With custom base URL
let client = SchlepClient::with_base_url("your-api-key", "https://custom.api.com/v1")?;
```

### Upload Data

```rust
let result = client.upload("your data here").await?;
println!("Job ID: {}", result.job_id);
```

### Train Model

```rust
let config = json!({
    "model_type": "classification",
    "dataset_id": "upload_job_123",
    "parameters": {
        "algorithm": "random_forest"
    }
});
let result = client.train(config).await?;
```

### Deploy Model

```rust
let result = client.deploy("model_456").await?;
println!("Endpoint: {}", result.endpoint_url);
```

### Check Status

```rust
let status = client.status("job_123").await?;
println!("Status: {}", status.status);
if let Some(progress) = status.progress {
    println!("Progress: {}%", progress);
}
```

### Stream Events

```rust
use schlep_engine::StreamConfig;

let config = StreamConfig {
    event_types: vec!["training".to_string(), "deployment".to_string()],
    filters: Default::default(),
};

client.stream(config).await?;
```

## Error Handling

The SDK provides comprehensive error handling:

```rust
match client.upload("data").await {
    Ok(result) => println!("Success: {}", result.job_id),
    Err(schlep_engine::Error::Api { code, message }) => {
        eprintln!("API error {}: {}", code, message);
    }
    Err(schlep_engine::Error::Http(e)) => {
        eprintln!("Network error: {}", e);
    }
    Err(schlep_engine::Error::Config(e)) => {
        eprintln!("Configuration error: {}", e);
    }
    Err(e) => {
        eprintln!("Other error: {}", e);
    }
}
```

## Environment Variables

- `SCHLEP_API_KEY`: Your Schlep-engine API key

## Build and Test

```bash
# Build the project
cargo build

# Run tests
cargo test

# Run example
export SCHLEP_API_KEY=your-api-key-here
cargo run --example schlep_engine_example

# Generate documentation
cargo doc --open
```

## Testing

The SDK includes comprehensive tests with mocked HTTP responses:

```bash
# Run all tests
cargo test

# Run integration tests only
cargo test --test integration_tests

# Run tests with output
cargo test -- --nocapture
```

## Examples

Check out the [examples](examples/) directory for more usage examples:

- [Basic Usage](examples/main.rs) - Complete workflow from upload to deployment

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://docs.schlep-engine.com/sdk/rust)
- 🐛 [Issues](https://github.com/schlep-engine/rust-sdk/issues)
- 💬 [Support](https://support.schlep-engine.com)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.