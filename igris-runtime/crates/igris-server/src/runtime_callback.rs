//! Signed callback envelopes for runtime-to-coordinator control-plane reports.
//!
//! These helpers produce the `X-Igris-Callback-Envelope` header accepted by
//! Overture for checkpoint, complete, and failed callbacks.

use anyhow::{bail, Context, Result};
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeCallbackAuth {
    pub header_name: String,
    pub header_value: String,
}

#[derive(Debug, Clone)]
pub struct RuntimeCallbackClient {
    base_url: String,
    auth: RuntimeCallbackAuth,
    http: reqwest::Client,
    evidence_log: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeCallbackSendOutcome {
    pub callback_type: String,
    pub task_id: String,
    pub runtime_id: String,
    pub body_digest: String,
    pub status_code: u16,
    pub accepted: bool,
}

impl RuntimeCallbackClient {
    pub fn new(base_url: String, auth: RuntimeCallbackAuth) -> Result<Self> {
        Self::with_evidence_log(
            base_url,
            auth,
            std::env::var("IGRIS_RUNTIME_CALLBACK_EVIDENCE_LOG").ok(),
        )
    }

    pub fn with_evidence_log(
        base_url: String,
        auth: RuntimeCallbackAuth,
        evidence_log: Option<String>,
    ) -> Result<Self> {
        if base_url.trim().is_empty() {
            bail!("runtime callback base URL is required");
        }
        if auth.header_name.trim().is_empty() || auth.header_value.trim().is_empty() {
            bail!("runtime callback auth header is required");
        }
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            auth,
            http: reqwest::Client::new(),
            evidence_log,
        })
    }

    pub async fn send_signed(
        &self,
        signing_key: &SigningKey,
        tenant_id: &str,
        task_id: &str,
        runtime_id: &str,
        callback_type: &str,
        body: Vec<u8>,
    ) -> Result<RuntimeCallbackSendOutcome> {
        let (request, base_outcome) = self.build_signed_request(
            signing_key,
            tenant_id,
            task_id,
            runtime_id,
            callback_type,
            body,
        )?;
        let response = self
            .http
            .execute(request)
            .await
            .context("runtime callback HTTP request failed")?;
        let status_code = response.status().as_u16();
        let accepted = response.status().is_success();
        let outcome = RuntimeCallbackSendOutcome {
            status_code,
            accepted,
            ..base_outcome
        };
        self.write_evidence(&outcome).await;
        if !accepted {
            bail!("runtime callback rejected with status {}", status_code);
        }
        Ok(outcome)
    }

    pub(crate) fn build_signed_request(
        &self,
        signing_key: &SigningKey,
        tenant_id: &str,
        task_id: &str,
        runtime_id: &str,
        callback_type: &str,
        body: Vec<u8>,
    ) -> Result<(reqwest::Request, RuntimeCallbackSendOutcome)> {
        let nonce = uuid::Uuid::new_v4().to_string();
        let timestamp_unix_ms = current_unix_ms()?;
        let envelope_header = sign_runtime_callback_header(
            signing_key,
            tenant_id,
            task_id,
            runtime_id,
            callback_type,
            &body,
            &nonce,
            timestamp_unix_ms,
        )?;
        let body_digest = runtime_callback_body_digest(&body);
        let endpoint = format!("{}/v1/tasks/{}/{}", self.base_url, task_id, callback_type);
        let request = self
            .http
            .post(endpoint)
            .header("Content-Type", "application/json")
            .header(RUNTIME_CALLBACK_ENVELOPE_HEADER, envelope_header)
            .header(
                self.auth.header_name.as_str(),
                self.auth.header_value.as_str(),
            )
            .body(body)
            .build()
            .context("runtime callback HTTP request build failed")?;
        let outcome = RuntimeCallbackSendOutcome {
            callback_type: callback_type.to_string(),
            task_id: task_id.to_string(),
            runtime_id: runtime_id.to_string(),
            body_digest,
            status_code: 0,
            accepted: false,
        };
        Ok((request, outcome))
    }

    async fn write_evidence(&self, outcome: &RuntimeCallbackSendOutcome) {
        let Some(path) = self
            .evidence_log
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        else {
            return;
        };
        let record = serde_json::json!({
            "schema_version": "runtime_callback_evidence.v1",
            "callback_type": outcome.callback_type,
            "task_id": outcome.task_id,
            "runtime_id": outcome.runtime_id,
            "body_digest": outcome.body_digest,
            "status_code": outcome.status_code,
            "accepted": outcome.accepted,
            "recorded_at_unix_ms": current_unix_ms().unwrap_or_default(),
        });
        let line = match serde_json::to_vec(&record) {
            Ok(mut bytes) => {
                bytes.push(b'\n');
                bytes
            }
            Err(_) => return,
        };
        if let Ok(mut file) = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .await
        {
            use tokio::io::AsyncWriteExt;
            let _ = file.write_all(&line).await;
        }
    }
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

fn current_unix_ms() -> Result<i64> {
    let duration = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .context("system clock is before UNIX epoch")?;
    Ok(duration.as_millis() as i64)
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

        let raw = STANDARD
            .decode(header)
            .expect("header should be base64 JSON");
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

        assert!(err
            .to_string()
            .contains("unsupported runtime callback type"));
    }

    #[test]
    fn callback_client_builds_signed_request_for_exact_body() {
        let signing_key = SigningKey::from_bytes(&[3u8; 32]);
        let client = RuntimeCallbackClient::with_evidence_log(
            "http://127.0.0.1:8081".to_string(),
            RuntimeCallbackAuth {
                header_name: "X-Test-Auth".to_string(),
                header_value: "redacted-token".to_string(),
            },
            None,
        )
        .expect("client");
        let body = br#"{"status":"complete"}"#.to_vec();

        let (request, outcome) = client
            .build_signed_request(
                &signing_key,
                "tenant-1",
                "task-1",
                "runtime-1",
                "complete",
                body.clone(),
            )
            .expect("callback request should build");

        assert_eq!(outcome.body_digest, runtime_callback_body_digest(&body));
        assert_eq!(
            request.url().as_str(),
            "http://127.0.0.1:8081/v1/tasks/task-1/complete"
        );
        assert_eq!(
            request
                .body()
                .and_then(|body| body.as_bytes())
                .expect("request body"),
            body.as_slice()
        );
        assert_eq!(
            request.headers().get("x-test-auth").unwrap(),
            "redacted-token"
        );
        let header = request
            .headers()
            .get(RUNTIME_CALLBACK_ENVELOPE_HEADER)
            .expect("envelope header")
            .to_str()
            .expect("header string");
        let raw = STANDARD
            .decode(header)
            .expect("header should be base64 JSON");
        let envelope: RuntimeCallbackEnvelope =
            serde_json::from_slice(&raw).expect("envelope should decode");
        assert_eq!(envelope.callback_type, "complete");
        assert_eq!(envelope.body_digest, runtime_callback_body_digest(&body));

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
}
