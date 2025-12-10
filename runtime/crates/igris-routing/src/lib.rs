pub mod circuit_breaker;
pub mod rate_limit;
pub mod cost_tracking;
pub mod speculative;
pub mod council;

// Re-export Thompson Sampling from existing Rust kernel
pub use schlep_kernel::optimizer;

pub use circuit_breaker::CircuitBreaker;
pub use rate_limit::RateLimiter;
pub use speculative::SpeculativeRouter;
pub use council::CouncilRouter;
