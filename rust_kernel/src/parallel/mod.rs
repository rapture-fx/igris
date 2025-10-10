//! Parallel Batch Processing Module
//!
//! Provides high-throughput parallel processing with:
//! - Tokio async orchestration for I/O
//! - Rayon thread pool for CPU-bound work
//! - Adaptive batch fusion (10ms latency cap)
//! - Priority-based queuing with QoS
//! - Target: 1400+ RPS @ <150ms P99

pub mod fusion;
pub mod worker;
pub mod priority;
pub mod metrics;

pub use fusion::{BatchFusionConfig, BatchFuser};
pub use worker::{ParallelBatchProcessor, WorkerPoolConfig};
pub use priority::{Priority, PriorityQueue};
pub use metrics::WorkerMetrics;
