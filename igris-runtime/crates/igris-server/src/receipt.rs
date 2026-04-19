//! Deterministic execution receipts (Phase 3).
//!
//! After every agent execution (success or violation) the runtime emits an
//! `ExecutionReceipt`.  Receipts are:
//!
//! * **Hash-chained** — each receipt includes the SHA-256 hash of the
//!   preceding receipt in the log, forming an append-only chain.
//! * **Signed** — the SHA-256 digest of the canonical JSON (BTreeMap, stable
//!   key order) is signed with the runtime's Ed25519 signing key.
//! * **Persisted** — appended as newline-delimited JSON (JSONL) to
//!   `IGRIS_RECEIPT_LOG` (default: `/var/lib/igris/receipts.jsonl`).
//!
//! Overture may verify receipt signatures when `IGRIS_RUNTIME_PUBLIC_KEY` is
//! configured.

use anyhow::Result;
use base64::Engine;
use ed25519_dalek::{Signer, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::runtime_execute::iso8601_now;

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionReceipt
// ─────────────────────────────────────────────────────────────────────────────

/// Immutable record emitted after each agent execution.
///
/// All fields except `signature` are included in the canonical JSON used for
/// signing.  `previous_hash` chains this receipt to the preceding one so that
/// any tampering is detectable.
///
/// `transaction_id` links this receipt to the `ExecutionTransaction` that
/// bounded this execution, creating a two-record audit trail: the transaction
/// records the lifecycle boundary; the receipt records observed resource usage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionReceipt {
    /// UUIDv7 — monotonically ordered execution identifier.
    pub execution_id: String,
    /// Logical agent identifier.
    pub agent_id: String,
    /// UUIDv7 of the `ExecutionTransaction` that bounded this execution.
    /// Empty if no transaction was associated.
    #[serde(skip_serializing_if = "String::is_empty", default)]
    pub transaction_id: String,
    /// SHA-256 hex of the sealed `ExecutionTransaction`'s canonical JSON.
    /// Allows Overture to verify the transaction record independently.
    #[serde(skip_serializing_if = "String::is_empty", default)]
    pub transaction_hash: String,
    /// CPU time consumed by the worker process (milliseconds).
    pub cpu_time_ms: u64,
    /// Wall-clock execution duration (milliseconds).
    pub wall_time_ms: u64,
    /// Peak resident memory of the worker process (MiB).
    pub memory_peak_mb: u64,
    /// Cumulative bytes written to the filesystem during this execution.
    pub fs_bytes_written: u64,
    /// Number of tool calls made during this execution.
    pub tool_calls: u32,
    /// Whether a capability or containment violation occurred.
    pub violation_occurred: bool,
    /// RFC3339 UTC timestamp.
    pub timestamp_utc: String,
    /// SHA-256 hex of the preceding receipt's canonical JSON (empty for first).
    pub previous_hash: String,
    /// SHA-256 hex of this receipt's canonical JSON (excluding `signature`).
    pub hash: String,
    /// Base64-encoded Ed25519 signature over SHA-256 of canonical JSON.
    pub signature: String,
}

impl ExecutionReceipt {
    /// Build and sign a new receipt.
    ///
    /// `previous_hash` must be the `hash` of the immediately preceding receipt
    /// in the persistent log, or an empty string for the first entry.
    ///
    /// `transaction_id` and `transaction_hash` link this receipt to the
    /// `ExecutionTransaction` that bounded this execution.  Pass empty strings
    /// when no transaction is associated.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        agent_id: &str,
        transaction_id: &str,
        transaction_hash: &str,
        cpu_time_ms: u64,
        wall_time_ms: u64,
        memory_peak_mb: u64,
        fs_bytes_written: u64,
        tool_calls: u32,
        violation_occurred: bool,
        previous_hash: &str,
        signing_key: Option<&Arc<ed25519_dalek::SigningKey>>,
    ) -> Self {
        let execution_id = Uuid::now_v7().to_string();
        let timestamp_utc = iso8601_now();

        // Canonical form: BTreeMap guarantees deterministic key ordering.
        let mut map = BTreeMap::new();
        map.insert("execution_id", execution_id.clone());
        map.insert("agent_id", agent_id.to_string());
        if !transaction_id.is_empty() {
            map.insert("transaction_id", transaction_id.to_string());
        }
        if !transaction_hash.is_empty() {
            map.insert("transaction_hash", transaction_hash.to_string());
        }
        map.insert("cpu_time_ms", cpu_time_ms.to_string());
        map.insert("wall_time_ms", wall_time_ms.to_string());
        map.insert("memory_peak_mb", memory_peak_mb.to_string());
        map.insert("fs_bytes_written", fs_bytes_written.to_string());
        map.insert("tool_calls", tool_calls.to_string());
        map.insert("violation_occurred", violation_occurred.to_string());
        map.insert("timestamp_utc", timestamp_utc.clone());
        map.insert("previous_hash", previous_hash.to_string());

        let canonical = serde_json::to_string(&map).unwrap_or_default();
        let digest = Sha256::digest(canonical.as_bytes());
        let hash = format!("{:x}", digest);

        let signature = signing_key
            .map(|sk| {
                let sig = sk.sign(&digest);
                base64::engine::general_purpose::STANDARD.encode(sig.to_bytes())
            })
            .unwrap_or_default();

        Self {
            execution_id,
            agent_id: agent_id.to_string(),
            transaction_id: transaction_id.to_string(),
            transaction_hash: transaction_hash.to_string(),
            cpu_time_ms,
            wall_time_ms,
            memory_peak_mb,
            fs_bytes_written,
            tool_calls,
            violation_occurred,
            timestamp_utc,
            previous_hash: previous_hash.to_string(),
            hash,
            signature,
        }
    }

    /// Verify the receipt signature against a known public verifying key.
    ///
    /// Returns `Ok(())` if the signature is valid, `Err(...)` otherwise.
    #[allow(dead_code)]
    pub fn verify_signature(&self, verifying_key: &VerifyingKey) -> Result<()> {
        use ed25519_dalek::Signature;

        if self.signature.is_empty() {
            anyhow::bail!("receipt has no signature");
        }

        // Re-derive canonical JSON (same BTreeMap construction, no `signature`).
        let mut map = BTreeMap::new();
        map.insert("execution_id", self.execution_id.clone());
        map.insert("agent_id", self.agent_id.clone());
        if !self.transaction_id.is_empty() {
            map.insert("transaction_id", self.transaction_id.clone());
        }
        if !self.transaction_hash.is_empty() {
            map.insert("transaction_hash", self.transaction_hash.clone());
        }
        map.insert("cpu_time_ms", self.cpu_time_ms.to_string());
        map.insert("wall_time_ms", self.wall_time_ms.to_string());
        map.insert("memory_peak_mb", self.memory_peak_mb.to_string());
        map.insert("fs_bytes_written", self.fs_bytes_written.to_string());
        map.insert("tool_calls", self.tool_calls.to_string());
        map.insert("violation_occurred", self.violation_occurred.to_string());
        map.insert("timestamp_utc", self.timestamp_utc.clone());
        map.insert("previous_hash", self.previous_hash.clone());

        let canonical = serde_json::to_string(&map)?;
        let digest = Sha256::digest(canonical.as_bytes());

        let sig_bytes = base64::engine::general_purpose::STANDARD.decode(&self.signature)?;
        let sig = Signature::from_slice(&sig_bytes)
            .map_err(|e| anyhow::anyhow!("invalid signature bytes: {}", e))?;

        verifying_key
            .verify(&digest, &sig)
            .map_err(|e| anyhow::anyhow!("signature verification failed: {}", e))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ReceiptLog — append-only JSONL with hash-chaining
// ─────────────────────────────────────────────────────────────────────────────

/// Thread-safe, append-only receipt log persisted as JSONL.
///
/// Each call to `append` writes a single newline-terminated JSON object.  The
/// log is hash-chained: each new receipt's `previous_hash` equals the `hash`
/// of the previous receipt (or `""` for the first).
pub struct ReceiptLog {
    path: PathBuf,
    last_hash: Arc<Mutex<String>>,
    signing_key: Option<Arc<ed25519_dalek::SigningKey>>,
}

impl ReceiptLog {
    /// Open (or create) a receipt log at `path`.
    ///
    /// If the file already contains entries the last hash is recovered so that
    /// the chain continues correctly across restarts.
    pub async fn open(
        path: impl AsRef<Path>,
        signing_key: Option<Arc<ed25519_dalek::SigningKey>>,
    ) -> Result<Self> {
        let path = path.as_ref().to_path_buf();

        // Ensure parent directory exists.
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Recover the last hash if the log already exists.
        let last_hash = recover_last_hash(&path).await.unwrap_or_default();

        Ok(Self {
            path,
            last_hash: Arc::new(Mutex::new(last_hash)),
            signing_key,
        })
    }

    /// Build, sign, append, and return a new `ExecutionReceipt`.
    ///
    /// `transaction_id` and `transaction_hash` are the ID and sealed hash of
    /// the `ExecutionTransaction` that bounded this execution.  Pass empty
    /// strings if no transaction is associated.
    #[allow(clippy::too_many_arguments)]
    pub async fn append(
        &self,
        agent_id: &str,
        transaction_id: &str,
        transaction_hash: &str,
        cpu_time_ms: u64,
        wall_time_ms: u64,
        memory_peak_mb: u64,
        fs_bytes_written: u64,
        tool_calls: u32,
        violation_occurred: bool,
    ) -> Result<ExecutionReceipt> {
        let mut last = self.last_hash.lock().await;

        let receipt = ExecutionReceipt::new(
            agent_id,
            transaction_id,
            transaction_hash,
            cpu_time_ms,
            wall_time_ms,
            memory_peak_mb,
            fs_bytes_written,
            tool_calls,
            violation_occurred,
            &last,
            self.signing_key.as_ref(),
        );

        // Persist to JSONL — one JSON object per line.
        let mut line = serde_json::to_string(&receipt)?;
        line.push('\n');

        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .await?;
        file.write_all(line.as_bytes()).await?;
        file.flush().await?;

        *last = receipt.hash.clone();
        Ok(receipt)
    }

    /// Return the hash of the most-recently appended receipt.
    #[allow(dead_code)]
    pub async fn last_hash(&self) -> String {
        self.last_hash.lock().await.clone()
    }
}

/// Read the last JSONL line and extract its `hash` field.
async fn recover_last_hash(path: &Path) -> Option<String> {
    let content = tokio::fs::read_to_string(path).await.ok()?;
    let last_line = content.trim_end().lines().last()?;
    let v: serde_json::Value = serde_json::from_str(last_line).ok()?;
    v["hash"].as_str().map(String::from)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;

    fn make_signing_key() -> Arc<SigningKey> {
        Arc::new(SigningKey::generate(&mut OsRng))
    }

    #[test]
    fn receipt_hash_chaining() {
        let sk = make_signing_key();
        let r1 = ExecutionReceipt::new(
            "a1",
            "tx-1",
            "tx-hash-1",
            10,
            20,
            5,
            0,
            3,
            false,
            "",
            Some(&sk),
        );
        let r2 = ExecutionReceipt::new(
            "a1",
            "tx-2",
            "tx-hash-2",
            15,
            25,
            5,
            100,
            5,
            false,
            &r1.hash,
            Some(&sk),
        );

        assert_eq!(r2.previous_hash, r1.hash);
        assert_ne!(r1.hash, r2.hash);
        assert!(!r1.hash.is_empty());
    }

    #[test]
    fn receipt_transaction_fields_preserved() {
        let r = ExecutionReceipt::new(
            "ag",
            "txid-123",
            "txhash-456",
            0,
            0,
            0,
            0,
            0,
            false,
            "",
            None,
        );
        assert_eq!(r.transaction_id, "txid-123");
        assert_eq!(r.transaction_hash, "txhash-456");
    }

    #[test]
    fn receipt_signature_valid() {
        let sk = make_signing_key();
        let vk = sk.verifying_key();
        let receipt = ExecutionReceipt::new("ag", "", "", 5, 10, 2, 0, 1, false, "", Some(&sk));

        assert!(receipt.verify_signature(&vk).is_ok());
    }

    #[test]
    fn receipt_signature_tamper_detected() {
        let sk = make_signing_key();
        let vk = sk.verifying_key();
        let mut receipt = ExecutionReceipt::new("ag", "", "", 5, 10, 2, 0, 1, false, "", Some(&sk));

        // Tamper with a field.
        receipt.tool_calls = 99;

        assert!(receipt.verify_signature(&vk).is_err());
    }

    #[test]
    fn receipt_no_signature_when_no_key() {
        let r = ExecutionReceipt::new("ag", "", "", 0, 0, 0, 0, 0, false, "", None);
        assert!(r.signature.is_empty());
    }

    #[tokio::test]
    async fn receipt_log_append_and_chain() {
        use std::env;
        let path = env::temp_dir().join(format!("igris-receipts-test-{}.jsonl", Uuid::new_v4()));
        let sk = make_signing_key();
        let vk = sk.verifying_key();

        let log = ReceiptLog::open(&path, Some(sk.clone())).await.unwrap();

        let r1 = log
            .append("ag", "", "", 10, 20, 4, 0, 2, false)
            .await
            .unwrap();
        let r2 = log
            .append("ag", "txid-1", "txhash-1", 15, 30, 5, 0, 3, false)
            .await
            .unwrap();

        assert_eq!(r2.previous_hash, r1.hash);
        assert!(r1.verify_signature(&vk).is_ok());
        assert!(r2.verify_signature(&vk).is_ok());
        assert_eq!(r2.transaction_id, "txid-1");

        // Re-open and verify chain recovery.
        let log2 = ReceiptLog::open(&path, Some(sk)).await.unwrap();
        assert_eq!(log2.last_hash().await, r2.hash);

        // Cleanup.
        let _ = tokio::fs::remove_file(&path).await;
    }
}
