//! WAL entry types for durable execution.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A single entry in the Write-Ahead Log.
///
/// Each entry tracks one discrete step within a task execution (inference call,
/// tool invocation, behaviour-tree node tick, or checkpoint).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalEntry {
    /// Unique identifier for this WAL entry.
    pub entry_id: Uuid,
    /// The task this entry belongs to.
    pub task_id: Uuid,
    /// Zero-based ordinal position within the task.
    pub step_index: u32,
    /// What kind of work this step performs.
    pub step_type: StepType,
    /// Current lifecycle status.
    pub status: WalStatus,
    /// SHA-256 digest of the serialised input payload.
    pub input_digest: [u8; 32],
    /// SHA-256 digest of the serialised output payload (set on commit).
    pub output_digest: Option<[u8; 32]>,
    /// Wall-clock timestamp (milliseconds since UNIX epoch).
    pub timestamp_ms: u64,
    /// Identifier of the runtime instance that owns this entry.
    pub runtime_id: String,
    /// Ed25519 signature over the entry (with this field set to `None`),
    /// populated when the entry transitions to `Committed`.
    pub signature: Option<Vec<u8>>,
}

/// The type of work performed by a WAL step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepType {
    /// LLM inference request.
    Inference { provider: String, model: String },
    /// Robotics action routed through the runtime execution layer.
    RoboticsAction { action: String, target: Option<String> },
    /// External tool invocation.
    ToolCall { tool_name: String },
    /// Behaviour-tree node tick.
    BtNode { node_id: String, node_type: String },
    /// Explicit checkpoint marker.
    Checkpoint,
}

/// Lifecycle status of a WAL entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WalStatus {
    /// Step has been planned but execution has not started.
    Intent,
    /// Step is currently executing.
    Executing,
    /// Step completed successfully; output digest and signature are present.
    Committed,
    /// Step failed with the given reason.
    Failed { reason: String },
}
