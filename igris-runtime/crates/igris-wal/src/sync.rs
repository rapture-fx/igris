//! Delta-sync types for checkpoint / resume protocol.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entry::WalEntry;

/// Token that captures enough state to resume a task from the last committed
/// checkpoint on any runtime instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeToken {
    /// Step index of the last committed entry.
    pub last_committed_step: u32,
    /// Rolling SHA-256 digest over all committed output digests in step order.
    /// Serialised as a hex string in JSON.
    #[serde(with = "hex_digest")]
    pub checkpoint_digest: [u8; 32],
    /// The runtime that produced this token.
    pub runtime_id: String,
}

/// Payload sent back to Overture so it can persist checkpoint state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointPayload {
    /// The task this checkpoint belongs to.
    pub task_id: Uuid,
    /// Resume token capturing the watermark.
    pub resume_token: ResumeToken,
    /// WAL entries written since the last checkpoint was sent.
    pub wal_entries: Vec<WalEntry>,
    /// Task-type-specific metadata stored opaquely by the coordinator and
    /// forwarded verbatim to the new runtime on recovery. Behavior tree tasks
    /// use this to carry `blackboard_state` and `tick_count` across failover.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// BT-specific checkpoint that includes serialized blackboard state.
///
/// Unlike general `CheckpointPayload`, the BT checkpoint captures the full
/// blackboard so a new runtime can restore tree execution state exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BtCheckpointPayload {
    /// The task this checkpoint belongs to.
    pub task_id: Uuid,
    /// Tick number at which this checkpoint was taken.
    pub tick_count: u64,
    /// Resume token (step watermark + digest).
    pub resume_token: ResumeToken,
    /// Full blackboard state as JSON. Restored on the new runtime before
    /// restarting tree execution.
    pub blackboard_state: serde_json::Value,
    /// WAL entries since the last checkpoint sent to Overture.
    pub wal_entries: Vec<WalEntry>,
}

/// Serde helper: serialize `[u8; 32]` as a hex string.
mod hex_digest {
    use serde::{self, Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &[u8; 32], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let hex = bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>();
        serializer.serialize_str(&hex)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<[u8; 32], D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let bytes: Vec<u8> = (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(serde::de::Error::custom))
            .collect::<Result<Vec<u8>, _>>()?;
        let arr: [u8; 32] = bytes
            .try_into()
            .map_err(|_| serde::de::Error::custom("expected 32 bytes"))?;
        Ok(arr)
    }
}
