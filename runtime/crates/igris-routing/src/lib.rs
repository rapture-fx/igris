// External crate declarations
extern crate schlep_kernel;

pub mod circuit_breaker;
pub mod rate_limit;
pub mod cost_tracking;
pub mod speculative;
pub mod council;
pub mod thompson;
pub mod cloud_provider;

#[cfg(feature = "local-llm")]
pub mod local_provider;

// Re-export Thompson Sampling from existing Rust kernel
pub use schlep_kernel::optimizer;

pub use circuit_breaker::CircuitBreaker;
pub use rate_limit::RateLimiter;
pub use speculative::{SpeculativeRouter, Provider};
pub use council::CouncilRouter;
pub use thompson::ThompsonSamplingRouter;
pub use cloud_provider::CloudProvider;

#[cfg(feature = "local-llm")]
pub use local_provider::LocalProvider;
