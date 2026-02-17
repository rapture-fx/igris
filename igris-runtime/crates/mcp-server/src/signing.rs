//! Ed25519 signing for MCP execution envelopes.
//!
//! Generates a keypair on initialization and signs tool execution results
//! to produce verifiable `SignedExecutionEnvelope` responses.

use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use rand::rngs::OsRng;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::protocol::SignedExecutionEnvelope;

/// Manages Ed25519 signing for tool execution results.
pub struct ExecutionSigner {
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
}

impl ExecutionSigner {
    /// Create a new signer with a randomly generated Ed25519 keypair.
    pub fn new() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        Self {
            signing_key,
            verifying_key,
        }
    }

    /// Return the public verifying key bytes (32 bytes, hex-encoded).
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.verifying_key.as_bytes())
    }

    /// Sign a tool execution result, producing a `SignedExecutionEnvelope`.
    pub fn sign_result(&self, result: &Value) -> SignedExecutionEnvelope {
        let execution_id = uuid::Uuid::new_v4().to_string();
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            .to_string();

        // Canonical JSON serialization for signing
        let payload = serde_json::to_string(result).unwrap_or_default();
        let sign_input = format!("{}:{}:{}", execution_id, timestamp, payload);

        let signature = self.signing_key.sign(sign_input.as_bytes());
        let signature_hex = hex::encode(&signature.to_bytes());

        SignedExecutionEnvelope {
            result: result.clone(),
            signature: signature_hex,
            timestamp,
            execution_id,
        }
    }
}

impl Default for ExecutionSigner {
    fn default() -> Self {
        Self::new()
    }
}

// hex encoding helper (avoids adding hex crate dependency)
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_signer_creation() {
        let signer = ExecutionSigner::new();
        let pubkey = signer.public_key_hex();
        assert_eq!(pubkey.len(), 64); // 32 bytes = 64 hex chars
    }

    #[test]
    fn test_sign_result() {
        let signer = ExecutionSigner::new();
        let result = json!({"content": [{"type": "text", "text": "hello"}]});

        let envelope = signer.sign_result(&result);

        assert!(!envelope.execution_id.is_empty());
        assert!(!envelope.timestamp.is_empty());
        assert!(!envelope.signature.is_empty());
        assert_eq!(envelope.signature.len(), 128); // 64 bytes = 128 hex chars
        assert_eq!(envelope.result, result);
    }

    #[test]
    fn test_different_results_different_signatures() {
        let signer = ExecutionSigner::new();
        let r1 = json!({"output": "a"});
        let r2 = json!({"output": "b"});

        let e1 = signer.sign_result(&r1);
        let e2 = signer.sign_result(&r2);

        assert_ne!(e1.signature, e2.signature);
        assert_ne!(e1.execution_id, e2.execution_id);
    }
}
