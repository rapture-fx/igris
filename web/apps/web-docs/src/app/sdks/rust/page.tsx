import Link from 'next/link'
import { ArrowRightIcon, CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function RustSDKPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Rust SDK
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          High-performance Rust SDK for Schlep Engine - Zero-cost abstractions, memory safety, and blazing fast data processing for systems programming and performance-critical applications.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Latest: v0.8.0
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Rust 1.70+
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            Async/Await
          </span>
        </div>

        <div className="flex gap-4">
          <Link
            href="https://crates.io/crates/schlep-engine"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View on Crates.io
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/schlep-engine/rust-sdk"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            GitHub Repository
          </Link>
        </div>
      </div>

      <div className="prose prose-lg max-w-none">
        <div className="bg-orange-50 border-l-4 border-orange-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-orange-800 mb-2">
            Blazing Fast Performance
          </h3>
          <p className="text-orange-700">
            Built for maximum performance with zero-cost abstractions, compile-time optimizations, and efficient memory management.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Cargo.toml</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`[dependencies]
schlep-engine = "0.8.0"

# Optional features
schlep-engine = { version = "0.8.0", features = ["tls", "compression", "tracing"] }

# Async runtime (choose one)
tokio = { version = "1.0", features = ["full"] }
# OR
async-std = { version = "1.12", features = ["attributes"] }`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Install via Cargo</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Add to your project
cargo add schlep-engine

# With optional features
cargo add schlep-engine --features tls,compression,tracing`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Start</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Basic Usage</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`use schlep_engine::{Client, Config, Error};
use schlep_engine::data::{DataProcessingRequest, Transformation, DataFormat};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize client
    let config = Config::builder()
        .api_key("your-api-key-here")
        .base_url("https://api.schlep-engine.com")
        .timeout(Duration::from_secs(30))
        .build()?;

    let client = Client::new(config)?;

    // Process data
    let request = DataProcessingRequest::builder()
        .file_path("data/sales.csv")
        .output_format(DataFormat::Json)
        .transformations(vec![
            Transformation::filter("age > 18"),
            Transformation::aggregate("revenue", "sum"),
        ])
        .build()?;

    let result = client.data().process_file(request).await?;
    println!("Job ID: {}", result.job_id);

    Ok(())
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Error Handling with Result Types</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`use schlep_engine::{Client, Error, Result};
use schlep_engine::error::ErrorKind;

async fn handle_processing() -> Result<()> {
    let client = Client::from_env()?;

    match client.data().process_file(request).await {
        Ok(result) => {
            println!("Processing successful: {}", result.job_id);
            Ok(())
        }
        Err(Error::Authentication(msg)) => {
            eprintln!("Authentication failed: {}", msg);
            // Handle authentication error
            Err(Error::Authentication(msg))
        }
        Err(Error::RateLimit { retry_after, .. }) => {
            eprintln!("Rate limited. Retry after {} seconds", retry_after);
            // Implement backoff strategy
            tokio::time::sleep(Duration::from_secs(retry_after)).await;
            // Retry logic here
            Ok(())
        }
        Err(Error::Validation { errors }) => {
            eprintln!("Validation errors: {:?}", errors);
            // Handle validation errors
            Err(Error::Validation { errors })
        }
        Err(e) => {
            eprintln!("Processing failed: {}", e);
            Err(e)
        }
    }
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Streaming Data Processing</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`use futures_util::StreamExt;
use schlep_engine::streaming::{StreamConfig, ProcessingUpdate};

async fn stream_processing() -> Result<()> {
    let client = Client::from_env()?;

    // Start streaming job
    let job = client.data().start_streaming_job(stream_config).await?;

    // Monitor progress with async stream
    let mut updates = client.data().stream_progress(job.job_id).await?;

    while let Some(update) = updates.next().await {
        match update? {
            ProcessingUpdate::Progress { percentage, .. } => {
                println!("Progress: {}%", percentage);
            }
            ProcessingUpdate::Completed { result } => {
                println!("Processing completed: {:?}", result);
                break;
            }
            ProcessingUpdate::Error { error } => {
                eprintln!("Processing error: {}", error);
                break;
            }
        }
    }

    Ok(())
}`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Key Features</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Zero-Cost Abstractions</h4>
              <p className="text-gray-600">Compile-time optimizations with no runtime overhead</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Memory Safety</h4>
              <p className="text-gray-600">Rust's ownership system prevents data races</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Async/Await Support</h4>
              <p className="text-gray-600">First-class async support with tokio and async-std</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Type Safety</h4>
              <p className="text-gray-600">Strong typing with compile-time guarantees</p>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Core Features</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Machine Learning Pipeline</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`use schlep_engine::ml::{MLPipelineConfig, MLTaskType, ModelType};
use schlep_engine::ml::{TrainingConfig, PredictionRequest};

async fn create_ml_pipeline() -> Result<()> {
    let client = Client::from_env()?;

    // Configure ML pipeline
    let config = MLPipelineConfig::builder()
        .name("Fraud Detection")
        .task_type(MLTaskType::Classification)
        .model_type(ModelType::GradientBoosting)
        .target_column("is_fraud")
        .feature_columns(vec!["amount", "merchant_id", "time_of_day"])
        .auto_hyperparameter_tuning(true)
        .validation_split(0.2)
        .build()?;

    // Create and train pipeline
    let pipeline = client.ml().create_pipeline(config).await?;
    let training_job = client.ml().train_pipeline(pipeline.id).await?;

    // Wait for training completion
    let model = training_job.wait_for_completion().await?;
    println!("Model trained with accuracy: {:.2}%", model.metrics.accuracy);

    // Make predictions
    let predictions = client.ml().predict(
        model.id,
        PredictionRequest::builder()
            .inputs(vec![
                serde_json::json!({
                    "amount": 1500.0,
                    "merchant_id": "merchant_123",
                    "time_of_day": 14
                })
            ])
            .return_probabilities(true)
            .build()?
    ).await?;

    for prediction in predictions.results {
        println!("Prediction: {} (confidence: {:.2})",
                prediction.class, prediction.probability);
    }

    Ok(())
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">High-Performance Data Processing</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`use schlep_engine::data::{DataPipeline, BatchProcessor};
use schlep_engine::performance::{CompressionLevel, MemoryOptimization};
use rayon::prelude::*;

async fn high_performance_processing() -> Result<()> {
    let client = Client::builder()
        .api_key(std::env::var("SCHLEP_ENGINE_API_KEY")?)
        .compression_level(CompressionLevel::High)
        .memory_optimization(MemoryOptimization::LowMemory)
        .max_concurrent_requests(100)
        .build()?;

    // Parallel batch processing
    let file_paths: Vec<String> = get_large_file_list()?;

    let results: Vec<_> = file_paths
        .par_iter()
        .map(|path| {
            let client = client.clone();
            let path = path.clone();

            tokio::runtime::Handle::current().block_on(async move {
                client.data().process_file_optimized(
                    path,
                    OptimizationLevel::MaxPerformance
                ).await
            })
        })
        .collect();

    // Process results
    for result in results {
        match result {
            Ok(job) => println!("Started job: {}", job.job_id),
            Err(e) => eprintln!("Failed to start job: {}", e),
        }
    }

    Ok(())
}`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">WebAssembly Support</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`// Enable WASM feature in Cargo.toml
// [dependencies]
// schlep-engine = { version = "0.8.0", features = ["wasm"] }

use wasm_bindgen::prelude::*;
use schlep_engine::wasm::WebClient;

#[wasm_bindgen]
pub async fn process_data_in_browser(api_key: String, data: String) -> Result<String, JsValue> {
    let client = WebClient::new(&api_key)?;

    let result = client
        .data()
        .process_text(data)
        .await
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    Ok(serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&e.to_string()))?)
}

// Usage in JavaScript:
// import init, { process_data_in_browser } from './pkg/my_wasm_app.js';
//
// async function processData() {
//     await init();
//     const result = await process_data_in_browser("api-key", "csv data...");
//     console.log(result);
// }`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Performance Optimization</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Memory Management</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`use schlep_engine::config::{MemoryConfig, CacheStrategy};
use schlep_engine::performance::ProfilerConfig;

// Configure for low-memory environments
let memory_config = MemoryConfig::builder()
    .max_memory_usage_mb(512)
    .cache_strategy(CacheStrategy::LRU)
    .gc_threshold(0.8)
    .streaming_chunk_size(1024 * 1024) // 1MB chunks
    .build();

let config = Config::builder()
    .api_key("your-api-key")
    .memory_config(memory_config)
    .enable_profiling(true)
    .build()?;

let client = Client::new(config)?;

// Process large files with controlled memory usage
let large_file_processor = client
    .data()
    .create_streaming_processor()
    .chunk_size(memory_config.streaming_chunk_size)
    .parallel_workers(num_cpus::get())
    .build();

let result = large_file_processor
    .process_file("very_large_file.csv")
    .await?;`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Custom HTTP Client Configuration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`use schlep_engine::http::{HttpConfig, RetryPolicy};
use reqwest::ClientBuilder;
use std::time::Duration;

// Custom HTTP client for maximum performance
let http_client = ClientBuilder::new()
    .pool_max_idle_per_host(20)
    .pool_idle_timeout(Duration::from_secs(60))
    .timeout(Duration::from_secs(120))
    .tcp_keepalive(Duration::from_secs(60))
    .http2_prior_knowledge()
    .build()?;

let retry_policy = RetryPolicy::builder()
    .max_retries(5)
    .base_delay(Duration::from_millis(100))
    .max_delay(Duration::from_secs(60))
    .backoff_factor(2.0)
    .retry_on_status(&[429, 502, 503, 504])
    .build();

let config = Config::builder()
    .api_key("your-api-key")
    .http_client(http_client)
    .retry_policy(retry_policy)
    .build()?;`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Requirements</h2>

        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>Rust 1.70.0 or later</li>
          <li>Tokio 1.0+ or async-std 1.12+ (async runtime)</li>
          <li>OpenSSL or native TLS (for HTTPS)</li>
          <li>Optional: WASM target for browser applications</li>
        </ul>

        <h2 className="text-3xl font-semibant mt-12 mb-6">Feature Flags</h2>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Available features
[dependencies]
schlep-engine = {
    version = "0.8.0",
    features = [
        "tls",           # TLS support (enabled by default)
        "compression",   # Request/response compression
        "tracing",       # Distributed tracing support
        "metrics",       # Prometheus metrics
        "wasm",          # WebAssembly support
        "native-tls",    # Use native TLS instead of rustls
        "json",          # JSON support (enabled by default)
        "csv",           # CSV processing optimizations
        "parquet",       # Parquet format support
    ]
}`}</code></pre>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <DocumentTextIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Documentation</h3>
            <p className="text-gray-600 mb-4">
              Complete API documentation with examples and type signatures.
            </p>
            <Link href="https://docs.rs/schlep-engine" className="text-blue-600 hover:text-blue-700 font-medium">
              View on docs.rs →
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Performance Guide</h3>
            <p className="text-gray-600 mb-4">
              Optimization techniques and performance best practices.
            </p>
            <Link href="/guides/rust-performance" className="text-blue-600 hover:text-blue-700 font-medium">
              View Performance Guide →
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">🦀</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Examples</h3>
            <p className="text-gray-600 mb-4">
              Real-world Rust examples and integration patterns.
            </p>
            <Link href="https://github.com/schlep-engine/rust-sdk-examples" className="text-blue-600 hover:text-blue-700 font-medium">
              View Examples →
            </Link>
          </div>
        </div>

        <div className="bg-orange-50 border-l-4 border-orange-400 p-6">
          <h3 className="text-lg font-semibold text-orange-800 mb-2">
            Ready for High Performance?
          </h3>
          <p className="text-orange-700 mb-4">
            Harness the power of Rust for blazing fast data processing with memory safety guarantees.
          </p>
          <div className="flex gap-4">
            <Link
              href="/introduction/quickstart"
              className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Quick Start Guide
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/api-reference"
              className="inline-flex items-center gap-2 border border-orange-300 text-orange-700 px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors"
            >
              API Reference
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}