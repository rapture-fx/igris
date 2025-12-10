pub mod circuit_breaker;
pub mod rate_limit;
pub mod cost_tracking;
pub mod speculative;
pub mod council;
pub mod thompson;  // Minimal stub until rust_kernel tracing is fixed

// Re-export Thompson Sampling from existing Rust kernel
// TEMPORARILY DISABLED due to compilation errors in rust_kernel tracing module
// pub use schlep_kernel::optimizer;

pub use circuit_breaker::CircuitBreaker;
pub use rate_limit::RateLimiter;
pub use speculative::SpeculativeRouter;
pub use council::CouncilRouter;
pub use thompson::ThompsonSamplingRouter;
