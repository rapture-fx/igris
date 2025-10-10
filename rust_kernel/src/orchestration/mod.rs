//! Adaptive Orchestration Layer (Phase 10)
//!
//! Self-optimizing inference orchestration that adapts routing, batching,
//! caching, and scheduling policies in real time using live telemetry feedback.
//!
//! # Architecture
//! ```text
//! Telemetry → Policy Engine → Feedback Loop → Scheduling
//!     ↓            ↓               ↓              ↓
//!  Normalized  Dynamic Params  Reward Signals  Optimized Routes
//! ```
//!
//! # Core Components
//! - **Adaptive Policy Engine**: Learns from telemetry, adjusts parameters
//! - **Reinforcement Feedback Loop**: Optimizes decisions using reward signals
//! - **Drift Monitor**: Detects anomalies, triggers rollback if needed
//!
//! # Safety Guarantees
//! - All policy changes are checkpointed
//! - Automatic rollback on drift >5% from baseline
//! - Zero downtime during adaptive updates
//! - Full observability through structured logs

pub mod policy_engine;
pub mod feedback_loop;
pub mod drift_monitor;

pub use policy_engine::{AdaptivePolicyEngine, PolicyUpdate, RoutingPolicy, BatchingPolicy};
pub use feedback_loop::{FeedbackLoop, RewardSignal, OptimizationResult};
pub use drift_monitor::{DriftMonitor, DriftSignal, DriftThreshold};
