//! Reliability Module - Deterministic Replay & Self-Recovery
//!
//! Provides enterprise-grade reliability through:
//! - Request trace recording with nanosecond precision
//! - State checkpointing for rollback capability
//! - Failure prediction using telemetry analysis
//! - Automatic recovery with deterministic replay
//!
//! Target SLA: <2.0s recovery time, 100% replay accuracy

pub mod trace_recorder;
pub mod checkpoint;
pub mod failure_predictor;
pub mod recovery_engine;

pub use trace_recorder::{TraceRecorder, TraceEntry, TraceConfig};
pub use checkpoint::{CheckpointManager, StateSnapshot, CheckpointConfig};
pub use failure_predictor::{FailurePredictor, PredictionSignal, PredictorConfig};
pub use recovery_engine::{RecoveryEngine, RecoveryStats, RecoveryConfig};
