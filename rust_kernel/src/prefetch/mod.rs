//! Predictive Cache Prefetching Module
//!
//! Production-grade prefetching system designed to achieve ≥97% cache hit rate
//! with minimal CPU overhead (<5%). Implements intelligent access pattern
//! prediction with safety controls and backpressure mechanisms.
//!
//! # Architecture
//! ```text
//! Telemetry Collector → Access Predictor → Prefetch Runner → Cache
//!         ↓                    ↓                  ↓
//!    Sliding Window      ML Model (LR)    Token Bucket + Circuit Breaker
//! ```
//!
//! # Key Features
//! - Lightweight ML-based access prediction
//! - Configurable confidence thresholds
//! - Mempool-aware backpressure
//! - Feature flags via runtime config
//! - Low-overhead telemetry sampling (1%)
//!
//! # Safety Controls
//! - Kill-switch for immediate disable
//! - Prefetch rate limiting
//! - Circuit breaker integration
//! - Mempool pressure monitoring

pub mod telemetry;
pub mod predictor;
pub mod runner;
pub mod throttler;
pub mod config;

pub use telemetry::{TelemetryCollector, AccessPattern, TelemetryConfig};
pub use predictor::{AccessPredictor, PredictionScore, PredictorConfig};
pub use runner::{PrefetchRunner, PrefetchRequest, PrefetchStats};
pub use throttler::{PrefetchThrottler, ThrottleConfig};
pub use config::{PrefetchConfig, PrefetchFeatureFlags};
