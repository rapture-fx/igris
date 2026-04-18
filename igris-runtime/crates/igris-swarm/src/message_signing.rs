//! Swarm message signing and verification (Phase 5).
//!
//! Every inter-node `SwarmMessage` is wrapped in a `SignedSwarmEnvelope` before
//! transmission over HTTP.  The envelope carries:
//!
//! * `peer_id` — the sending node's logical identity.
//! * `timestamp` — ISO-8601 UTC, included in the signed payload to prevent
//!   replay attacks.
//! * `signature` — Base64 Ed25519 over `SHA-256(peer_id:timestamp:body_json)`.
//!
//! Peers MUST call `verify_envelope` before processing any inbound message.
//! Invalid or missing signatures MUST result in the message being dropped.
//!
//! # HTTP header convention
//!
//! When the envelope is serialised for HTTP transport the signature is also
//! available as the `X-Igris-Swarm-Sig` request header (Base64 Ed25519).

use anyhow::Result;
use base64::Engine;
use ed25519_dalek::{Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::transport::SwarmMessage;

// ─────────────────────────────────────────────────────────────────────────────
// SignedSwarmEnvelope
// ─────────────────────────────────────────────────────────────────────────────

/// A signed wrapper around a `SwarmMessage`.
///
/// All fields participate in the signature computation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedSwarmEnvelope {
    /// Sending peer's agent identifier.
    pub peer_id: String,
    /// ISO-8601 UTC timestamp at signing time.
    pub timestamp: String,
    /// The inner swarm message.
    pub message: SwarmMessage,
    /// Base64-encoded Ed25519 signature over
    /// `SHA-256("{peer_id}:{timestamp}:{message_json}")`.
    pub signature: String,
}

impl SignedSwarmEnvelope {
    /// Build and sign a new envelope.
    pub fn new(peer_id: &str, message: SwarmMessage, signing_key: &SigningKey) -> Result<Self> {
        let timestamp = swarm_iso8601_now();
        let message_json = serde_json::to_string(&message)?;
        let payload = format!("{}:{}:{}", peer_id, timestamp, message_json);
        let digest = Sha256::digest(payload.as_bytes());
        let sig = signing_key.sign(&digest);
        let signature = base64::engine::general_purpose::STANDARD.encode(sig.to_bytes());

        Ok(Self {
            peer_id: peer_id.to_string(),
            timestamp,
            message,
            signature,
        })
    }

    /// Return the value suitable for the `X-Igris-Swarm-Sig` HTTP header.
    pub fn header_value(&self) -> &str {
        &self.signature
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SwarmMessageSigner
// ─────────────────────────────────────────────────────────────────────────────

/// Signs outbound swarm messages on behalf of a local node.
pub struct SwarmMessageSigner {
    peer_id: String,
    signing_key: SigningKey,
}

impl SwarmMessageSigner {
    /// Create a new signer with the given Ed25519 key.
    pub fn new(peer_id: impl Into<String>, signing_key: SigningKey) -> Self {
        Self {
            peer_id: peer_id.into(),
            signing_key,
        }
    }

    /// Sign `message` and return a `SignedSwarmEnvelope`.
    pub fn sign(&self, message: SwarmMessage) -> Result<SignedSwarmEnvelope> {
        SignedSwarmEnvelope::new(&self.peer_id, message, &self.signing_key)
    }

    /// Return the hex-encoded public verifying key (for peer exchange).
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.signing_key.verifying_key().as_bytes())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification
// ─────────────────────────────────────────────────────────────────────────────

/// Verify that `envelope.signature` was produced by `verifying_key`.
///
/// Returns `Ok(())` on success, `Err(...)` if the signature is absent, malformed,
/// or does not match the envelope contents.  Callers MUST drop the message on
/// `Err`.
pub fn verify_envelope(envelope: &SignedSwarmEnvelope, verifying_key: &VerifyingKey) -> Result<()> {
    use ed25519_dalek::Signature;

    if envelope.signature.is_empty() {
        anyhow::bail!("swarm envelope has no signature");
    }

    let message_json = serde_json::to_string(&envelope.message)?;
    let payload = format!(
        "{}:{}:{}",
        envelope.peer_id, envelope.timestamp, message_json
    );
    let digest = Sha256::digest(payload.as_bytes());

    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(&envelope.signature)
        .map_err(|e| anyhow::anyhow!("bad base64 signature: {}", e))?;

    let sig = Signature::from_slice(&sig_bytes)
        .map_err(|e| anyhow::anyhow!("invalid signature bytes: {}", e))?;

    verifying_key
        .verify(&digest, &sig)
        .map_err(|e| anyhow::anyhow!("swarm signature verification failed: {}", e))
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn swarm_iso8601_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let rem = secs % 86_400;
    let h = rem / 3_600;
    let m = (rem % 3_600) / 60;
    let s = rem % 60;
    let days = secs / 86_400;
    let (year, month, day) = swarm_days_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, h, m, s
    )
}

fn swarm_days_to_ymd(days: u64) -> (u64, u64, u64) {
    let z = days as i64 + 719_468;
    let era = (if z >= 0 { z } else { z - 146_096 }) / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mo = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if mo <= 2 { y + 1 } else { y };
    (y as u64, mo as u64, d as u64)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;

    fn make_key() -> SigningKey {
        SigningKey::generate(&mut OsRng)
    }

    #[test]
    fn sign_and_verify_heartbeat() {
        let sk = make_key();
        let vk = sk.verifying_key();
        let signer = SwarmMessageSigner::new("node-1", sk);

        let msg = SwarmMessage::Heartbeat {
            leader_id: "node-1".to_string(),
            term: 42,
        };
        let envelope = signer.sign(msg).unwrap();

        assert!(verify_envelope(&envelope, &vk).is_ok());
    }

    #[test]
    fn verify_rejects_tampered_message() {
        let sk = make_key();
        let vk = sk.verifying_key();
        let signer = SwarmMessageSigner::new("node-1", sk);

        let msg = SwarmMessage::Heartbeat {
            leader_id: "node-1".to_string(),
            term: 1,
        };
        let mut envelope = signer.sign(msg).unwrap();

        // Tamper: change the term inside the message.
        envelope.message = SwarmMessage::Heartbeat {
            leader_id: "node-1".to_string(),
            term: 999,
        };

        assert!(verify_envelope(&envelope, &vk).is_err());
    }

    #[test]
    fn verify_rejects_wrong_key() {
        let sk1 = make_key();
        let sk2 = make_key();
        let vk2 = sk2.verifying_key();

        let signer = SwarmMessageSigner::new("node-1", sk1);
        let msg = SwarmMessage::AgentJoined {
            agent_id: "node-1".to_string(),
            capabilities: vec!["inference".to_string()],
        };
        let envelope = signer.sign(msg).unwrap();

        // Verify with different key — should fail.
        assert!(verify_envelope(&envelope, &vk2).is_err());
    }

    #[test]
    fn verify_rejects_empty_signature() {
        let sk = make_key();
        let vk = sk.verifying_key();
        let msg = SwarmMessage::AgentLeft {
            agent_id: "node-1".to_string(),
        };
        let envelope = SignedSwarmEnvelope {
            peer_id: "node-1".to_string(),
            timestamp: swarm_iso8601_now(),
            message: msg,
            signature: String::new(),
        };
        assert!(verify_envelope(&envelope, &vk).is_err());
    }

    #[test]
    fn signer_public_key_hex_is_64_chars() {
        let sk = make_key();
        let signer = SwarmMessageSigner::new("n", sk);
        assert_eq!(signer.public_key_hex().len(), 64);
    }
}
