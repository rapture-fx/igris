//! WAL log backed by redb storage.

use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use igris_core::storage::{RedbStorage, WAL_ENTRIES};

use crate::entry::{StepType, WalEntry, WalStatus};

/// Errors produced by WAL operations.
#[derive(Debug, thiserror::Error)]
pub enum WalError {
    #[error("storage error: {0}")]
    Storage(#[from] anyhow::Error),
    #[error("entry not found: {0}")]
    NotFound(String),
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

/// A Write-Ahead Log scoped to a single task.
pub struct WalLog {
    storage: Arc<RedbStorage>,
    task_id: Uuid,
    runtime_id: String,
}

impl WalLog {
    /// Create a new WAL log for the given task, backed by shared redb storage.
    pub fn new(storage: Arc<RedbStorage>, task_id: Uuid, runtime_id: String) -> Self {
        Self {
            storage,
            task_id,
            runtime_id,
        }
    }

    // ── Writes ──────────────────────────────────────────────────────────────

    /// Record the intent to execute a step. Returns the new entry.
    pub fn write_intent(
        &self,
        step_index: u32,
        step_type: StepType,
        input_digest: [u8; 32],
    ) -> Result<WalEntry, WalError> {
        let entry = WalEntry {
            entry_id: Uuid::new_v4(),
            task_id: self.task_id,
            step_index,
            step_type,
            status: WalStatus::Intent,
            input_digest,
            output_digest: None,
            timestamp_ms: now_ms(),
            runtime_id: self.runtime_id.clone(),
            signature: None,
        };
        self.persist(&entry)?;
        Ok(entry)
    }

    /// Transition an entry to `Committed`, recording the output digest and
    /// signing the entry with the runtime's Ed25519 key.
    pub fn write_committed(
        &self,
        entry_id: Uuid,
        output_digest: [u8; 32],
        signing_key: &SigningKey,
    ) -> Result<WalEntry, WalError> {
        let mut entry = self.load(entry_id)?;
        entry.status = WalStatus::Committed;
        entry.output_digest = Some(output_digest);
        entry.timestamp_ms = now_ms();

        // Sign over the entry with signature field cleared.
        // Use a BTreeMap for deterministic key ordering across platforms/versions.
        entry.signature = None;
        let sorted: std::collections::BTreeMap<String, serde_json::Value> =
            if let serde_json::Value::Object(m) = serde_json::to_value(&entry)? {
                m.into_iter().collect()
            } else {
                unreachable!("WalEntry always serializes to an object")
            };
        let payload = serde_json::to_vec(&sorted)?;
        let hash = Sha256::digest(&payload);
        let sig = signing_key.sign(&hash);
        entry.signature = Some(sig.to_bytes().to_vec());

        self.persist(&entry)?;
        Ok(entry)
    }

    /// Transition an entry to `Failed`.
    pub fn write_failed(&self, entry_id: Uuid, reason: String) -> Result<(), WalError> {
        let mut entry = self.load(entry_id)?;
        entry.status = WalStatus::Failed { reason };
        entry.timestamp_ms = now_ms();
        self.persist(&entry)?;
        Ok(())
    }

    /// Import externally persisted WAL entries for this task.
    ///
    /// Used during clean-host recovery: the replacement runtime has an empty
    /// local WAL, but Overture can provide the last durable checkpoint payload.
    /// Entries are persisted as-is so their original runtime_id and signature
    /// remain intact for audit and action-evidence visibility.
    pub fn import_entries(&self, entries: &[WalEntry]) -> Result<(), WalError> {
        for entry in entries {
            if entry.task_id != self.task_id {
                return Err(WalError::NotFound(format!(
                    "checkpoint entry task_id {} does not match {}",
                    entry.task_id, self.task_id
                )));
            }
            self.persist(entry)?;
        }
        Ok(())
    }

    // ── Reads ───────────────────────────────────────────────────────────────

    /// Read all entries for this task with `step_index >= from_step`, ordered
    /// by step_index then entry_id.
    ///
    /// Uses a prefix scan (O(matching entries)) rather than a full table scan.
    pub fn read_from_step(&self, from_step: u32) -> Result<Vec<WalEntry>, WalError> {
        let prefix = format!("{}:", self.task_id);
        let all: Vec<(String, WalEntry)> = self
            .storage
            .list_by_prefix(WAL_ENTRIES, &prefix)
            .map_err(WalError::Storage)?;

        let mut entries: Vec<WalEntry> = all
            .into_iter()
            .map(|(_, entry)| entry)
            .filter(|e| e.step_index >= from_step)
            .collect();

        entries.sort_by_key(|e| (e.step_index, e.entry_id));
        Ok(entries)
    }

    /// Return the step_index of the last committed entry and the rolling
    /// checkpoint digest in one pass, avoiding two separate scans.
    pub fn committed_state(&self) -> Result<(Option<u32>, [u8; 32]), WalError> {
        let entries = self.read_from_step(0)?;
        let mut hasher = Sha256::new();
        let mut last_step: Option<u32> = None;

        // entries are already sorted by (step_index, entry_id)
        for entry in &entries {
            if matches!(entry.status, WalStatus::Committed) {
                if let Some(ref digest) = entry.output_digest {
                    hasher.update(digest);
                }
                last_step = Some(entry.step_index);
            }
        }

        Ok((last_step, hasher.finalize().into()))
    }

    /// Return the step_index of the last committed entry, if any.
    pub fn last_committed_step(&self) -> Result<Option<u32>, WalError> {
        Ok(self.committed_state()?.0)
    }

    /// Compute a rolling SHA-256 over all committed output digests in step
    /// order.  This is the canonical checkpoint digest used for resume
    /// verification.
    pub fn compute_checkpoint_digest(&self) -> Result<[u8; 32], WalError> {
        Ok(self.committed_state()?.1)
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────

    /// Delete all WAL entries for this task. Call after task completes to
    /// prevent unbounded growth of the wal_entries redb table.
    pub fn delete_task_entries(&self) -> Result<(), WalError> {
        let entries = self.read_from_step(0)?;
        for entry in entries {
            let key = self.key(entry.entry_id);
            self.storage
                .delete(WAL_ENTRIES, &key)
                .map_err(WalError::Storage)?;
        }
        Ok(())
    }

    // ── Internal ────────────────────────────────────────────────────────────

    fn key(&self, entry_id: Uuid) -> String {
        format!("{}:{}", self.task_id, entry_id)
    }

    fn persist(&self, entry: &WalEntry) -> Result<(), WalError> {
        let key = self.key(entry.entry_id);
        self.storage
            .set(WAL_ENTRIES, &key, entry)
            .map_err(WalError::Storage)
    }

    fn load(&self, entry_id: Uuid) -> Result<WalEntry, WalError> {
        let key = self.key(entry_id);
        self.storage
            .get::<WalEntry>(WAL_ENTRIES, &key)
            .map_err(WalError::Storage)?
            .ok_or_else(|| WalError::NotFound(key))
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
