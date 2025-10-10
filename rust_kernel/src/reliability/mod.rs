//! Reliability Module - Deterministic Replay & Self-Recovery
//!
//! Provides enterprise-grade reliability through:
//! - Request trace recording with nanosecond precision (✅ Phase 9.1 Complete)
//! - State checkpointing for rollback capability (✅ Phase 9.1 Complete)
//! - Failure prediction using telemetry analysis (✅ Phase 9.2 Complete)
//! - Automatic recovery with deterministic replay (⏳ Phase 9.3 Planned)
//!
//! Target SLA: <2.0s recovery time, 100% replay accuracy, 80% prediction confidence

pub mod trace_recorder;
pub mod checkpoint;
pub mod failure_predictor;

pub use trace_recorder::{TraceRecorder, TraceEntry, TraceConfig};
pub use checkpoint::{CheckpointManager, StateSnapshot, CheckpointConfig};
pub use failure_predictor::{FailurePredictor, PredictionSignal, PredictorConfig, TelemetrySignals};

// Phase 9.3 module (planned):
// pub mod recovery_engine;
