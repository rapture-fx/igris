//! igris-wal — Write-Ahead Log for durable task execution.
//!
//! Provides crash-resilient tracking of multi-step task execution by persisting
//! intent, execution, and commit records into redb before each state transition.

pub mod entry;
pub mod log;
pub mod sync;

pub use entry::{StepType, WalEntry, WalStatus};
pub use log::{WalError, WalLog};
pub use sync::{BtCheckpointPayload, CheckpointPayload, ResumeToken};
