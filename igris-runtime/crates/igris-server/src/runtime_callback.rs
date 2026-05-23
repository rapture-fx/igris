//! Signed callback envelopes for runtime-to-coordinator control-plane reports.
//!
//! These helpers produce the `X-Igris-Callback-Envelope` header accepted by
//! Overture for checkpoint, complete, and failed callbacks.

use anyhow::{bail, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signer, SigningKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub const RUNTIME_CALLBACK_ENVELOPE_HEADER: &str = "X-Igris-Callback-Envelope";
pub const RUNTIME_CALLBACK_VERSION: &str = "runtime_callback.v1";
pub const RUNTIME_CALLBACK_ALGORITHM: &str = "ed25519-sha256-canonical-json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeCallbackEnvelope {
    pub version: String,
    pub tenant_id: String,
    pub task_id: String,
    pub runtime_id: String,
    pub callback_type: String,
    pub body_digest: String,
    pub timestamp_unix_ms: i64,
    pub nonce: String,
    pub algorithm: String,
    pub signature: String,
}

pub fn runtime_callback_body_digest(body: &[u8]) -> String {
    let digest = Sha256::digest(body);
    hex::encode(digest)
}

pub fn sign_runtime_callback_envelope(
    signing_key: &SigningKey,
    tenant_id: &str,
    task_id: &str,
    runtime_id: &str,
    callback_type: &str,
    body: &[u8],
    nonce: &str,
    timestamp_unix_ms: i64,
) -> Result<RuntimeCallbackEnvelope> {
    if tenant_id.trim().is_empty() {
        bail!("tenant_id is required for runtime callback signing");
    }
    if task_id.trim().is_empty() {
        bail!("task_id is required for runtime callback signing");
    }
    if runtime_id.trim().is_empty() {
        bail!("runtime_id is required for runtime callback signing");
    }
    if !matches!(callback_type, "checkpoint" | "complete" | "failed") {
        bail!("unsupported runtime callback type");
    }
    if nonce.trim().is_empty() {
        bail!("nonce is required for runtime callback signing");
    }
    if timestamp_unix_ms == 0 {
        bail!("timestamp_unix_ms is required for runtime callback signing");
    }

    let body_digest = runtime_callback_body_digest(body);
    let canonical = canonical_runtime_callback_envelope(
        tenant_id,
        task_id,
        runtime_id,
        callback_type,
        &body_digest,
        nonce,
        timestamp_unix_ms,
    )?;
    let digest = Sha256::digest(&canonical);
    let signature = signing_key.sign(&digest);

    Ok(RuntimeCallbackEnvelope {
        version: RUNTIME_CALLBACK_VERSION.to_string(),
        tenant_id: tenant_id.to_string(),
        task_id: task_id.to_string(),
        runtime_id: runtime_id.to_string(),
        callback_type: callback_type.to_string(),
        body_digest,
        timestamp_unix_ms,
        nonce: nonce.to_string(),
        algorithm: RUNTIME_CALLBACK_ALGORITHM.to_string(),
        signature: STANDARD.encode(signature.to_bytes()),
    })
}

pub fn sign_runtime_callback_header(
    signing_key: &SigningKey,
    tenant_id: &str,
    task_id: &str,
    runtime_id: &str,
    callback_type: &str,
    body: &[u8],
    nonce: &str,
    timestamp_unix_ms: i64,
) -> Result<String> {
    let envelope = sign_runtime_callback_envelope(
        signing_key,
        tenant_id,
        task_id,
        runtime_id,
        callback_type,
        body,
        nonce,
        timestamp_unix_ms,
    )?;
    let raw = serde_json::to_vec(&envelope)?;
    Ok(STANDARD.encode(raw))
}

fn canonical_runtime_callback_envelope(
    tenant_id: &str,
    task_id: &str,
    runtime_id: &str,
    callback_type: &str,
    body_digest: &str,
    nonce: &str,
    timestamp_unix_ms: i64,
) -> Result<Vec<u8>> {
    let mut map = BTreeMap::<&str, serde_json::Value>::new();
    map.insert("algorithm", serde_json::json!(RUNTIME_CALLBACK_ALGORITHM));
    map.insert("body_digest", serde_json::json!(body_digest));
    map.insert("callback_type", serde_json::json!(callback_type));
    map.insert("nonce", serde_json::json!(nonce));
    map.insert("runtime_id", serde_json::json!(runtime_id));
    map.insert("task_id", serde_json::json!(task_id));
    map.insert("tenant_id", serde_json::json!(tenant_id));
    map.insert("timestamp_unix_ms", serde_json::json!(timestamp_unix_ms));
    map.insert("version", serde_json::json!(RUNTIME_CALLBACK_VERSION));
    Ok(serde_json::to_vec(&map)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signature, Verifier};

    #[test]
    fn callback_header_contains_signed_body_digest() {
        let signing_key = SigningKey::from_bytes(&[7u8; 32]);
        let body = br#"{"reason":"runtime failed"}"#;

        let header = sign_runtime_callback_header(
            &signing_key,
            "tenant-1",
            "task-1",
            "runtime-1",
            "failed",
            body,
            "nonce-1",
            1_700_000_000_000,
        )
        .expect("header should sign");

        let raw = STANDARD.decode(header).expect("header should be base64 JSON");
        let envelope: RuntimeCallbackEnvelope =
            serde_json::from_slice(&raw).expect("envelope should decode");
        assert_eq!(envelope.version, RUNTIME_CALLBACK_VERSION);
        assert_eq!(envelope.algorithm, RUNTIME_CALLBACK_ALGORITHM);
        assert_eq!(envelope.body_digest, runtime_callback_body_digest(body));

        let canonical = canonical_runtime_callback_envelope(
            &envelope.tenant_id,
            &envelope.task_id,
            &envelope.runtime_id,
            &envelope.callback_type,
            &envelope.body_digest,
            &envelope.nonce,
            envelope.timestamp_unix_ms,
        )
        .expect("canonical envelope should encode");
        let digest = Sha256::digest(canonical);
        let signature_bytes = STANDARD
            .decode(&envelope.signature)
            .expect("signature should decode");
        let signature = Signature::from_slice(&signature_bytes).expect("signature length");

        signing_key
            .verifying_key()
            .verify(&digest, &signature)
            .expect("signature should verify");
    }

    #[test]
    fn callback_signing_rejects_unsupported_types() {
        let signing_key = SigningKey::from_bytes(&[9u8; 32]);
        let err = sign_runtime_callback_header(
            &signing_key,
            "tenant-1",
            "task-1",
            "runtime-1",
            "receipt",
            b"{}",
            "nonce-1",
            1,
        )
        .expect_err("unsupported callback type should fail");

        assert!(err.to_string().contains("unsupported runtime callback type"));
    }
}
