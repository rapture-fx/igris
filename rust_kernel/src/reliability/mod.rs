//! Reliability Module - Deterministic Replay & Self-Recovery
//!
//! Provides enterprise-grade reliability through:
//! - Request trace recording with nanosecond precision (✅ Complete)
//! - State checkpointing for rollback capability (✅ Complete)
//! - Failure prediction using telemetry analysis (⏳ Planned - Phase 9.2)
//! - Automatic recovery with deterministic replay (⏳ Planned - Phase 9.3)
//!
//! Target SLA: <2.0s recovery time, 100% replay accuracy

pub mod trace_recorder;
pub mod checkpoint;

pub use trace_recorder::{TraceRecorder, TraceEntry, TraceConfig};
pub use checkpoint::{CheckpointManager, StateSnapshot, CheckpointConfig};

// Phase 9.2 and 9.3 modules (planned):
// pub mod failure_predictor;
// pub mod recovery_engine;
