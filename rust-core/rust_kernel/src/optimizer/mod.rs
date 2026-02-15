//! Optimizer module for Thompson Sampling-based provider/model selection
//!
//! This module provides a multi-armed bandit optimization system for selecting
//! the best inference provider/model based on observed metrics (latency, cost,
//! success rate, cache hits).
//!
//! # Architecture
//!
//! - **arms**: Bandit arm definitions with Beta distribution parameters
//! - **rewards**: Reward calculation from inference metrics
//! - **bandits**: Thompson Sampling algorithm implementation
//! - **ffi**: C-compatible exports for Go integration
//!
//! # Example
//!
//! ```rust,no_run
//! use igris_kernel::optimizer::bandits::{ThompsonSampling, ThompsonSamplingConfig};
//! use igris_kernel::optimizer::rewards::RewardMetrics;
//!
//! let config = ThompsonSamplingConfig::default();
//! let mut optimizer = ThompsonSampling::new(config);
//!
//! // Select best provider/model
//! let action = optimizer.select_action();
//!
//! // Update with metrics
//! let metrics = RewardMetrics {
//!     latency_ms: 85.0,
//!     success: true,
//!     cache_hit: false,
//!     cost_usd: 0.002,
//!     quality_score: Some(0.9),
//! };
//!
//! optimizer.update(&action, &metrics);
//! ```

pub mod arms;
pub mod rewards;
pub mod bandits;
pub mod ffi;
pub mod binary_ffi; // Optimized binary FFI for Go (3-5x faster than JSON)

// Phase 4: Distributed tracing support (optional)
#[cfg(feature = "tracing")]
pub mod tracing;

// Re-export main types for convenience
pub use arms::BanditArm;
pub use rewards::{RewardMetrics, RewardPolicy, calculate_reward};
pub use bandits::{ThompsonSampling, ThompsonSamplingConfig, ArmStats};
