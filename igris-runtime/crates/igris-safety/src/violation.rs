use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signer, SigningKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::OpenOptions;
use std::io::Write;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ViolationKind {
    Time,
    Cpu,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ViolationRecord {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub violation_kind: ViolationKind,
    pub context: serde_json::Value,
    /// SHA-256 hex of the previous record's payload for chain integrity.
    pub previous_hash: String,
    /// SHA-256 hex of this record's canonical payload.
    pub hash: String,
    /// Base64-encoded Ed25519 signature over `hash`.
    pub signature: String,
}

impl ViolationRecord {
    pub fn new(
        kind: ViolationKind,
        context: serde_json::Value,
        previous_hash: String,
        signing_key: &SigningKey,
    ) -> Self {
        let id = Uuid::now_v7();
        let timestamp = Utc::now();

        // Canonical payload for hashing (deterministic field order).
        let payload = serde_json::json!({
            "id": id,
            "timestamp": timestamp,
            "violation_kind": kind,
            "context": context,
            "previous_hash": previous_hash,
        });

        let mut hasher = Sha256::new();
        hasher.update(payload.to_string().as_bytes());
        let hash = format!("{:x}", hasher.finalize());

        let signature = signing_key.sign(hash.as_bytes());
        let signature_b64 = STANDARD.encode(signature.to_bytes());

        Self {
            id,
            timestamp,
            violation_kind: kind,
            context,
            previous_hash,
            hash,
            signature: signature_b64,
        }
    }

    /// Append this record as a JSONL line to `path`.
    pub fn append_to_log(&self, path: &str) -> std::io::Result<()> {
        let mut file = OpenOptions::new().create(true).append(true).open(path)?;
        writeln!(file, "{}", serde_json::to_string(self).expect("ViolationRecord is always serializable"))?;
        Ok(())
    }
}
