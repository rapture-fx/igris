//! Runtime execution API.
//!
//! `POST /v1/runtime/execute`   — Execute inference from Overture, enforce containment bounds.
//! `GET  /v1/runtime/violations` — Return violation records from in-memory log + JSONL file.
//! `POST /v1/runtime/register`  — Edge runtime self-registration with Ed25519 identity.

use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use base64::Engine;
use ed25519_dalek::Signer;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::{Mutex, RwLock};
use tracing::{info, warn};
use uuid::Uuid;

use crate::{AppState, CloudProviderWrapper};
use igris_routing::Provider;

// ─────────────────────────────────────────────────────────────────────────────
// Shared types (re-exported so main.rs can reference them in AppState)
// ─────────────────────────────────────────────────────────────────────────────

/// Thread-safe in-memory violation log.
pub type ViolationLog = Arc<Mutex<Vec<ViolationRecord>>>;

/// Thread-safe peer registry.
pub type PeerRegistry = Arc<RwLock<HashMap<String, PeerEntry>>>;

/// Containment bounds forwarded from SDK via `X-Igris-Bounds` header.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Bounds {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_mb: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tick_ms: Option<u64>,
}

/// A single violation record.  Mirrors `igris-safety::ViolationRecord`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViolationRecord {
    pub id: String,
    pub timestamp: String,
    pub violation_kind: String,
    pub context: serde_json::Value,
    pub previous_hash: String,
    pub hash: String,
    /// Ed25519 signature (base64).  Empty for in-memory records that have no
    /// signing key available at the point of creation.
    pub signature: String,
}

/// A registered peer runtime entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerEntry {
    pub runtime_id: String,
    pub public_key_ed25519: String,
    pub endpoint: String,
    pub capabilities: Vec<String>,
    pub platform: Option<String>,
    pub version: Option<String>,
    pub registered_at: u64,
    pub last_seen: u64,
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/runtime/execute
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteMessage {
    pub role: String,
    pub content: String,
}

/// Execute request — superset of `ChatCompletionRequest` with tenant + bounds.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub model: String,
    pub messages: Vec<ExecuteMessage>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub stream: Option<bool>,
    /// Optional routing mode: "thompson" | "speculative" | "council".
    #[serde(default)]
    pub mode: Option<String>,
    /// Tenant identifier forwarded from Overture.
    #[serde(default)]
    pub tenant_id: Option<String>,
    /// Containment bounds.  `X-Igris-Bounds` header takes precedence when both
    /// are present.
    #[serde(default)]
    pub bounds: Option<Bounds>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Serialize)]
pub struct ExecuteChoice {
    pub index: u32,
    pub message: ExecuteMessage,
    pub finish_reason: String,
}

#[derive(Debug, Serialize)]
pub struct ExecuteMetadata {
    pub runtime_id: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounds_applied: Option<Bounds>,
    pub containment_active: bool,
}

/// Canonical execution proof — all fields used as signing input are sorted
/// alphabetically to guarantee a stable canonical JSON form.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExecutionEnvelope {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounds_applied: Option<Bounds>,
    pub execution_id: String,
    pub finish_reason: String,
    pub model: String,
    pub request_hash: String,
    pub response_hash: String,
    pub routing_decision: String,
    /// Ed25519 signature (base64) over SHA-256 of the canonical JSON form of
    /// all other fields in this envelope (keys sorted alphabetically).
    pub signature: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub violation: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<ExecuteChoice>,
    pub usage: ExecuteUsage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<ExecuteMetadata>,
    /// Full execution envelope with Ed25519 signature. Present when the runtime
    /// has an Ed25519 signing key configured.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_envelope: Option<ExecutionEnvelope>,
}

/// `POST /v1/runtime/execute`
///
/// Accepts an inference request forwarded by Overture, routes it through the
/// Runtime's existing provider stack (cloud → local fallback), and enforces
/// the `max_tick_ms` deadline from `X-Igris-Bounds`.  If the deadline is
/// exceeded a `Time` violation is recorded in the in-memory log and 408 is
/// returned.
pub async fn handle_execute(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ExecuteRequest>,
) -> impl IntoResponse {
    // Header-provided bounds take precedence over body.
    let bounds = parse_bounds_header(&headers).or_else(|| req.bounds.clone());
    let tenant_id = req.tenant_id.clone().or_else(|| {
        headers
            .get("x-igris-tenant")
            .and_then(|v| v.to_str().ok())
            .map(String::from)
    });
    let max_tick_ms = bounds
        .as_ref()
        .and_then(|b| b.max_tick_ms)
        .unwrap_or(30_000);

    let wall_start = std::time::Instant::now();

    info!(
        "[Runtime/Execute] model={} tenant={:?} max_tick_ms={}",
        req.model, tenant_id, max_tick_ms
    );

    let prompt = req
        .messages
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    // Enforce hard deadline via tokio timeout.
    let route_result = tokio::time::timeout(
        Duration::from_millis(max_tick_ms),
        do_route(state.clone(), prompt.clone()),
    )
    .await;

    match route_result {
        Ok(Ok((content, provider_name))) => {
            let pt = token_estimate(&prompt);
            let ct = token_estimate(&content);
            let resp_id = format!("exec-{}", Uuid::new_v4());
            let finish_reason = "stop".to_string();
            let ts = iso8601_now();

            // Compute hashes before content/req are moved into structs.
            let request_hash = {
                let b = serde_json::to_vec(&req).unwrap_or_default();
                format!("{:x}", Sha256::digest(&b))
            };
            let response_hash = format!("{:x}", Sha256::digest(content.as_bytes()));

            // Build canonical execution envelope and sign it.
            let execution_envelope = state.signing_key.as_ref().map(|sk| {
                let canon = canonical_envelope_bytes(
                    &resp_id,
                    &ts,
                    tenant_id.as_deref(),
                    &req.model,
                    &request_hash,
                    &response_hash,
                    &provider_name,
                    bounds.as_ref(),
                    &finish_reason,
                    None,
                );
                let hash = Sha256::digest(&canon);
                let sig = sk.sign(&hash);
                let sig_b64 = base64::engine::general_purpose::STANDARD.encode(sig.to_bytes());
                ExecutionEnvelope {
                    bounds_applied: bounds.clone(),
                    execution_id: resp_id.clone(),
                    finish_reason: finish_reason.clone(),
                    model: req.model.clone(),
                    request_hash,
                    response_hash,
                    routing_decision: provider_name.clone(),
                    signature: sig_b64,
                    tenant_id: tenant_id.clone(),
                    timestamp: ts,
                    violation: None,
                }
            });

            // Emit execution receipt with transaction boundary.
            let wall_ms = wall_start.elapsed().as_millis() as u64;
            let agent_id_str = tenant_id.as_deref().unwrap_or("anonymous");
            if let Some(rl) = &state.receipt_log {
                // Build and commit a transaction for this execution.
                let tx = crate::transaction::ExecutionTransaction::begin(
                    agent_id_str,
                    "",
                    state.signing_key.as_ref(),
                )
                .commit(state.signing_key.as_ref());
                let tx_id = tx.transaction_id.clone();
                let tx_hash = tx.hash.clone();
                let _ = rl
                    .append(agent_id_str, &tx_id, &tx_hash, 0, wall_ms, 0, 0, 0, false)
                    .await;
            }

            let resp = ExecuteResponse {
                id: resp_id,
                object: "chat.completion".to_string(),
                created: unix_now(),
                model: req.model.clone(),
                choices: vec![ExecuteChoice {
                    index: 0,
                    message: ExecuteMessage {
                        role: "assistant".to_string(),
                        content,
                    },
                    finish_reason,
                }],
                usage: ExecuteUsage {
                    prompt_tokens: pt,
                    completion_tokens: ct,
                    total_tokens: pt + ct,
                },
                metadata: Some(ExecuteMetadata {
                    runtime_id: state.swarm_peer_id.clone(),
                    provider: provider_name,
                    tenant_id,
                    bounds_applied: bounds,
                    containment_active: true,
                }),
                execution_envelope,
            };
            (StatusCode::OK, Json(resp)).into_response()
        }

        Ok(Err(e)) => {
            warn!("[Runtime/Execute] Routing error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": { "message": "Execution failed", "type": "api_error" }
                })),
            )
                .into_response()
        }

        Err(_elapsed) => {
            warn!(
                "[Runtime/Execute] Timeout after {}ms — containment enforcement",
                max_tick_ms
            );
            // Record in-memory violation.
            if let Some(log) = &state.violation_log {
                append_violation(
                    log,
                    "Time",
                    serde_json::json!({
                        "model": req.model,
                        "tenant_id": tenant_id,
                        "max_tick_ms": max_tick_ms,
                    }),
                    state.signing_key.as_ref(),
                )
                .await;
            }
            // Emit violation receipt with aborted transaction boundary.
            let wall_ms = wall_start.elapsed().as_millis() as u64;
            let agent_id_str = tenant_id.as_deref().unwrap_or("anonymous");
            if let Some(rl) = &state.receipt_log {
                let tx = crate::transaction::ExecutionTransaction::begin(
                    agent_id_str,
                    "",
                    state.signing_key.as_ref(),
                )
                .abort(state.signing_key.as_ref());
                let tx_id = tx.transaction_id.clone();
                let tx_hash = tx.hash.clone();
                let _ = rl
                    .append(agent_id_str, &tx_id, &tx_hash, 0, wall_ms, 0, 0, 0, true)
                    .await;
            }
            (
                StatusCode::REQUEST_TIMEOUT,
                Json(serde_json::json!({
                    "error": {
                        "message": "Execution timeout",
                        "type": "timeout_error",
                        "violation_kind": "Time",
                    }
                })),
            )
                .into_response()
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/runtime/violations
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ViolationsResponse {
    violations: Vec<serde_json::Value>,
    count: usize,
}

/// `GET /v1/runtime/violations`
///
/// Returns all violation records from two sources:
/// 1. The in-memory log (violations from execute timeouts).
/// 2. The on-disk JSONL file written by the `igris-safety` supervisor
///    (path from `IGRIS_VIOLATIONS_LOG`, default `./igris_violations.jsonl`).
pub async fn handle_violations(State(state): State<AppState>) -> impl IntoResponse {
    let mut records: Vec<serde_json::Value> = Vec::new();

    // 1. In-memory log.
    if let Some(log) = &state.violation_log {
        let guard = log.lock().await;
        for r in guard.iter() {
            if let Ok(v) = serde_json::to_value(r) {
                records.push(v);
            }
        }
    }

    // 2. On-disk JSONL.
    let log_path = std::env::var("IGRIS_VIOLATIONS_LOG")
        .unwrap_or_else(|_| "./igris_violations.jsonl".to_string());
    if let Ok(contents) = tokio::fs::read_to_string(&log_path).await {
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                records.push(v);
            }
        }
    }

    let count = records.len();
    (
        StatusCode::OK,
        Json(ViolationsResponse {
            violations: records,
            count,
        }),
    )
        .into_response()
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/runtime/register
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RegisterRuntimeRequest {
    pub runtime_id: String,
    pub public_key_ed25519: String,
    pub endpoint: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub platform: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RegisterRuntimeResponse {
    pub registered: bool,
    pub runtime_id: String,
    /// This server's Ed25519 verifying key (hex-encoded).
    pub server_public_key: String,
}

/// `POST /v1/runtime/register`
///
/// An edge runtime calls this to announce itself.  The request includes the
/// edge's Ed25519 verifying key so the server can authenticate future signed
/// payloads from that edge.  The response includes the server's own verifying
/// key so the edge can verify signed configuration messages.
pub async fn handle_register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRuntimeRequest>,
) -> impl IntoResponse {
    info!(
        "[Runtime/Register] id={} endpoint={} caps={:?}",
        req.runtime_id, req.endpoint, req.capabilities
    );

    if let Some(registry) = &state.peer_registry {
        let now = unix_now();
        let mut guard = registry.write().await;
        guard.insert(
            req.runtime_id.clone(),
            PeerEntry {
                runtime_id: req.runtime_id.clone(),
                public_key_ed25519: req.public_key_ed25519,
                endpoint: req.endpoint,
                capabilities: req.capabilities,
                platform: req.platform,
                version: req.version,
                registered_at: now,
                last_seen: now,
            },
        );
    }

    let server_public_key = state.runtime_public_key.clone().unwrap_or_default();

    (
        StatusCode::OK,
        Json(RegisterRuntimeResponse {
            registered: true,
            runtime_id: req.runtime_id,
            server_public_key,
        }),
    )
        .into_response()
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

fn parse_bounds_header(headers: &HeaderMap) -> Option<Bounds> {
    let raw = headers.get("x-igris-bounds")?.to_str().ok()?;
    serde_json::from_str(raw).ok()
}

pub(crate) fn token_estimate(text: &str) -> u32 {
    (text.len() as u32).saturating_div(4)
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Format current UTC time as ISO-8601 without an external crate.
pub fn iso8601_now() -> String {
    let secs = unix_now();
    let rem = secs % 86_400;
    let h = rem / 3_600;
    let m = (rem % 3_600) / 60;
    let s = rem % 60;
    let days = secs / 86_400;
    let (year, month, day) = days_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, h, m, s
    )
}

/// Convert days since Unix epoch to (year, month, day) using Gregorian calendar.
/// Algorithm: <http://howardhinnant.github.io/date_algorithms.html>
fn days_to_ymd(days: u64) -> (u64, u64, u64) {
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

/// Append a violation record to the in-memory log.
/// S3: Signs the hash using the Ed25519 signing key when available.
async fn append_violation(
    log: &ViolationLog,
    kind: &str,
    context: serde_json::Value,
    signing_key: Option<&Arc<ed25519_dalek::SigningKey>>,
) {
    let mut guard = log.lock().await;
    let previous_hash = guard.last().map(|r| r.hash.clone()).unwrap_or_default();
    let id = Uuid::new_v4().to_string();
    let canonical = format!("{}:{}:{}", id, kind, previous_hash);
    let hash = format!("{:x}", Sha256::digest(canonical.as_bytes()));

    // Sign "id:kind:hash" if a signing key is available.
    let signature = signing_key
        .map(|sk| {
            let msg = format!("{}:{}:{}", id, kind, hash);
            let sig = sk.sign(msg.as_bytes());
            base64::engine::general_purpose::STANDARD.encode(sig.to_bytes())
        })
        .unwrap_or_default();

    guard.push(ViolationRecord {
        id,
        timestamp: iso8601_now(),
        violation_kind: kind.to_string(),
        context,
        previous_hash,
        hash,
        signature,
    });
}

/// Route a prompt through the Runtime's provider stack (cloud → local fallback).
async fn do_route(state: AppState, prompt: String) -> anyhow::Result<(String, String)> {
    // Try cloud providers via speculative routing.
    if !state.cloud_providers.is_empty() {
        let providers: Vec<CloudProviderWrapper> = state
            .cloud_providers
            .iter()
            .take(3)
            .map(|p| CloudProviderWrapper(p.clone()))
            .collect();
        if let Ok(result) = state.speculative_router.route(&prompt, providers).await {
            return Ok((result.response, result.winner_id));
        }
    }

    // Fallback: local LLM.
    if let Some(local) = &state.local_provider {
        let content = local.complete(&prompt).await?;
        return Ok((content, "local".to_string()));
    }

    anyhow::bail!("No providers available")
}

/// Produce the canonical JSON bytes used as signing input for an execution envelope.
///
/// Uses `BTreeMap` at every level so keys are always alphabetically sorted —
/// this matches Go's `json.Marshal(map[string]interface{})` behaviour, which
/// also sorts map keys lexicographically, ensuring both sides compute identical
/// bytes from the same logical envelope.
pub(crate) fn canonical_envelope_bytes(
    execution_id: &str,
    timestamp: &str,
    tenant_id: Option<&str>,
    model: &str,
    request_hash: &str,
    response_hash: &str,
    routing_decision: &str,
    bounds: Option<&Bounds>,
    finish_reason: &str,
    violation: Option<&str>,
) -> Vec<u8> {
    let mut canon = BTreeMap::<&str, serde_json::Value>::new();

    // Nested bounds: explicit BTreeMap so keys are alphabetical, matching Go
    // re-serialization order (cpu_percent < max_tick_ms < memory_mb).
    if let Some(b) = bounds {
        let mut bm = BTreeMap::<&str, serde_json::Value>::new();
        if let Some(v) = b.cpu_percent {
            bm.insert("cpu_percent", serde_json::json!(v));
        }
        if let Some(v) = b.max_tick_ms {
            bm.insert("max_tick_ms", serde_json::json!(v));
        }
        if let Some(v) = b.memory_mb {
            bm.insert("memory_mb", serde_json::json!(v));
        }
        if !bm.is_empty() {
            canon.insert(
                "bounds_applied",
                serde_json::to_value(bm).unwrap_or_default(),
            );
        }
    }

    canon.insert("execution_id", serde_json::json!(execution_id));
    canon.insert("finish_reason", serde_json::json!(finish_reason));
    canon.insert("model", serde_json::json!(model));
    canon.insert("request_hash", serde_json::json!(request_hash));
    canon.insert("response_hash", serde_json::json!(response_hash));
    canon.insert("routing_decision", serde_json::json!(routing_decision));
    if let Some(tid) = tenant_id {
        canon.insert("tenant_id", serde_json::json!(tid));
    }
    canon.insert("timestamp", serde_json::json!(timestamp));
    if let Some(v) = violation {
        canon.insert("violation", serde_json::json!(v));
    }

    serde_json::to_vec(&canon).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{SigningKey, Verifier};
    use rand::rngs::OsRng;

    #[test]
    fn test_envelope_sign_verify() {
        let sk = SigningKey::generate(&mut OsRng);
        let vk = sk.verifying_key();

        let bounds = Bounds {
            cpu_percent: Some(80),
            memory_mb: Some(512),
            max_tick_ms: Some(5_000),
        };
        let canon = canonical_envelope_bytes(
            "exec-001",
            "2026-02-20T12:00:00Z",
            Some("tenant-abc"),
            "gpt-4o",
            "aabbccdd",
            "eeff0011",
            "openai",
            Some(&bounds),
            "stop",
            None,
        );
        let hash = Sha256::digest(&canon);
        let sig = sk.sign(&hash);

        // Verification must succeed with the same canonical bytes.
        assert!(
            vk.verify(&hash, &sig).is_ok(),
            "valid signature should verify"
        );
    }

    #[test]
    fn test_envelope_tamper_detection() {
        let sk = SigningKey::generate(&mut OsRng);
        let vk = sk.verifying_key();

        let canon = canonical_envelope_bytes(
            "exec-002",
            "2026-02-20T12:00:00Z",
            None,
            "claude-3-5-sonnet",
            "aabbccdd",
            "eeff0011",
            "anthropic",
            None,
            "stop",
            None,
        );
        let hash = Sha256::digest(&canon);
        let sig = sk.sign(&hash);

        // Produce canonical bytes for a tampered envelope (different model).
        let tampered = canonical_envelope_bytes(
            "exec-002",
            "2026-02-20T12:00:00Z",
            None,
            "gpt-4o", // tampered field
            "aabbccdd",
            "eeff0011",
            "anthropic",
            None,
            "stop",
            None,
        );
        let tampered_hash = Sha256::digest(&tampered);

        // Original sig must NOT verify against tampered bytes.
        assert!(
            vk.verify(&tampered_hash, &sig).is_err(),
            "tampered envelope must fail verification"
        );
    }
}
