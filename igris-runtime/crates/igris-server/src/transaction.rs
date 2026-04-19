//! Execution transaction boundary (Phase 1).
//!
//! An `ExecutionTransaction` is created at the start of every agent execution
//! and advances through exactly one terminal state:
//!
//! ```text
//! PENDING ──► COMMITTED   (execution completed without violation)
//!          └► ABORTED     (execution violated a bound or capability)
//! ```
//!
//! Once committed or aborted the transaction is immutable.  Its canonical JSON
//! is signed with the runtime's Ed25519 key and the hash is carried in the
//! accompanying `ExecutionReceipt`, providing an auditable link between the
//! two records.

use base64::Engine;
use ed25519_dalek::Signer;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::runtime_execute::iso8601_now;

// ─────────────────────────────────────────────────────────────────────────────
// TransactionStatus
// ─────────────────────────────────────────────────────────────────────────────

/// Lifecycle state of an `ExecutionTransaction`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TransactionStatus {
    /// Transaction created; execution has not yet completed.
    Pending,
    /// Execution completed without any containment or capability violation.
    Committed,
    /// Execution was terminated due to a violation.
    Aborted,
}

impl std::fmt::Display for TransactionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "PENDING"),
            Self::Committed => write!(f, "COMMITTED"),
            Self::Aborted => write!(f, "ABORTED"),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionTransaction
// ─────────────────────────────────────────────────────────────────────────────

/// A signed, hash-chained record of one execution boundary.
///
/// The transaction is created in `PENDING` state, then sealed to `COMMITTED`
/// or `ABORTED`.  Once sealed the `hash` and `signature` fields are set and
/// the struct becomes a stable audit record.
///
/// The `hash` is carried in the accompanying `ExecutionReceipt`
/// (`receipt.transaction_id_hash`) to create an auditable link between the
/// two records.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTransaction {
    /// UUIDv7 — monotonically ordered, embeds creation timestamp.
    pub transaction_id: String,
    /// Logical agent identifier.
    pub agent_id: String,
    /// RFC3339 UTC timestamp at transaction creation.
    pub started_at: String,
    /// RFC3339 UTC timestamp when the transaction was committed (`None` if not committed).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committed_at: Option<String>,
    /// RFC3339 UTC timestamp when the transaction was aborted (`None` if not aborted).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aborted_at: Option<String>,
    /// Terminal lifecycle state.
    pub status: TransactionStatus,
    /// SHA-256 hex of the preceding transaction's canonical JSON (empty for first).
    pub previous_hash: String,
    /// SHA-256 hex of this transaction's canonical JSON (excluding `signature`).
    pub hash: String,
    /// Base64 Ed25519 signature over SHA-256 of canonical JSON.
    pub signature: String,
}

impl ExecutionTransaction {
    /// Create a new `PENDING` transaction.  The hash and signature are
    /// computed immediately so the record is tamper-evident from creation.
    pub fn begin(
        agent_id: &str,
        previous_hash: &str,
        signing_key: Option<&Arc<ed25519_dalek::SigningKey>>,
    ) -> Self {
        let transaction_id = Uuid::now_v7().to_string();
        let started_at = iso8601_now();
        Self::build(
            transaction_id,
            agent_id.to_string(),
            started_at,
            None,
            None,
            TransactionStatus::Pending,
            previous_hash.to_string(),
            signing_key,
        )
    }

    /// Seal the transaction as `COMMITTED` and return a new, signed record.
    ///
    /// Panics if the transaction is already in a terminal state.
    pub fn commit(self, signing_key: Option<&Arc<ed25519_dalek::SigningKey>>) -> Self {
        assert_eq!(
            self.status,
            TransactionStatus::Pending,
            "cannot commit a {:?} transaction",
            self.status
        );
        Self::build(
            self.transaction_id,
            self.agent_id,
            self.started_at,
            Some(iso8601_now()),
            None,
            TransactionStatus::Committed,
            self.previous_hash,
            signing_key,
        )
    }

    /// Seal the transaction as `ABORTED` and return a new, signed record.
    ///
    /// Panics if the transaction is already in a terminal state.
    pub fn abort(self, signing_key: Option<&Arc<ed25519_dalek::SigningKey>>) -> Self {
        assert_eq!(
            self.status,
            TransactionStatus::Pending,
            "cannot abort a {:?} transaction",
            self.status
        );
        Self::build(
            self.transaction_id,
            self.agent_id,
            self.started_at,
            None,
            Some(iso8601_now()),
            TransactionStatus::Aborted,
            self.previous_hash,
            signing_key,
        )
    }

    /// Return whether the transaction is in a terminal state.
    #[allow(dead_code)]
    pub fn is_terminal(&self) -> bool {
        matches!(
            self.status,
            TransactionStatus::Committed | TransactionStatus::Aborted
        )
    }

    // ── Internal builder ────────────────────────────────────────────────────

    #[allow(clippy::too_many_arguments)]
    fn build(
        transaction_id: String,
        agent_id: String,
        started_at: String,
        committed_at: Option<String>,
        aborted_at: Option<String>,
        status: TransactionStatus,
        previous_hash: String,
        signing_key: Option<&Arc<ed25519_dalek::SigningKey>>,
    ) -> Self {
        // Canonical form: BTreeMap guarantees deterministic key ordering.
        let mut map = BTreeMap::new();
        map.insert("transaction_id", transaction_id.clone());
        map.insert("agent_id", agent_id.clone());
        map.insert("started_at", started_at.clone());
        if let Some(ref ts) = committed_at {
            map.insert("committed_at", ts.clone());
        }
        if let Some(ref ts) = aborted_at {
            map.insert("aborted_at", ts.clone());
        }
        map.insert("status", status.to_string());
        map.insert("previous_hash", previous_hash.clone());

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
            transaction_id,
            agent_id,
            started_at,
            committed_at,
            aborted_at,
            status,
            previous_hash,
            hash,
            signature,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;

    fn sk() -> Arc<SigningKey> {
        Arc::new(SigningKey::generate(&mut OsRng))
    }

    #[test]
    fn begin_is_pending() {
        let tx = ExecutionTransaction::begin("agent-1", "", None);
        assert_eq!(tx.status, TransactionStatus::Pending);
        assert!(!tx.transaction_id.is_empty());
        assert!(!tx.hash.is_empty());
        assert!(tx.committed_at.is_none());
        assert!(tx.aborted_at.is_none());
    }

    #[test]
    fn commit_transitions_to_committed() {
        let tx = ExecutionTransaction::begin("agent-1", "", None);
        let id = tx.transaction_id.clone();
        let committed = tx.commit(None);
        assert_eq!(committed.status, TransactionStatus::Committed);
        assert_eq!(committed.transaction_id, id);
        assert!(committed.committed_at.is_some());
        assert!(committed.aborted_at.is_none());
        assert!(committed.is_terminal());
    }

    #[test]
    fn abort_transitions_to_aborted() {
        let tx = ExecutionTransaction::begin("agent-2", "", None);
        let aborted = tx.abort(None);
        assert_eq!(aborted.status, TransactionStatus::Aborted);
        assert!(aborted.aborted_at.is_some());
        assert!(aborted.committed_at.is_none());
        assert!(aborted.is_terminal());
    }

    #[test]
    fn hash_changes_on_commit() {
        let tx = ExecutionTransaction::begin("agent-3", "", None);
        let pending_hash = tx.hash.clone();
        let committed = tx.commit(None);
        // Hash must change because status and committed_at changed.
        assert_ne!(pending_hash, committed.hash);
    }

    #[test]
    fn signature_produced_with_key() {
        use sha2::Sha256;

        let sk = sk();
        let vk = sk.verifying_key();
        let tx = ExecutionTransaction::begin("agent-4", "", Some(&sk)).commit(Some(&sk));

        assert!(!tx.signature.is_empty());

        // Re-derive canonical JSON.
        let mut map = BTreeMap::new();
        map.insert("transaction_id", tx.transaction_id.clone());
        map.insert("agent_id", tx.agent_id.clone());
        map.insert("started_at", tx.started_at.clone());
        if let Some(ref ts) = tx.committed_at {
            map.insert("committed_at", ts.clone());
        }
        map.insert("status", tx.status.to_string());
        map.insert("previous_hash", tx.previous_hash.clone());
        let canonical = serde_json::to_string(&map).unwrap();
        let digest = Sha256::digest(canonical.as_bytes());

        let sig_bytes = base64::engine::general_purpose::STANDARD
            .decode(&tx.signature)
            .unwrap();
        let sig = ed25519_dalek::Signature::from_slice(&sig_bytes).unwrap();
        vk.verify_strict(&digest, &sig).unwrap();
    }

    #[test]
    fn hash_chaining() {
        let tx1 = ExecutionTransaction::begin("agent-5", "", None).commit(None);
        let tx2 = ExecutionTransaction::begin("agent-5", &tx1.hash, None).commit(None);
        assert_eq!(tx2.previous_hash, tx1.hash);
        assert_ne!(tx1.hash, tx2.hash);
    }

    #[test]
    #[should_panic(expected = "cannot commit a")]
    fn double_commit_panics() {
        let tx = ExecutionTransaction::begin("agent-6", "", None).commit(None);
        tx.commit(None); // should panic
    }

    #[test]
    #[should_panic(expected = "cannot abort a")]
    fn abort_committed_panics() {
        let tx = ExecutionTransaction::begin("agent-7", "", None).commit(None);
        tx.abort(None); // should panic
    }
}
