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
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::{Mutex, RwLock};
use tracing::{info, warn};
use uuid::Uuid;

use igris_routing::Provider;
use crate::{AppState, CloudProviderWrapper};

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

#[derive(Debug, Serialize)]
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
    /// Ed25519 signature over "id:model:finish_reason" (base64). Present when
    /// the runtime was started with an Ed25519 signing key.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
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

            // S2: Sign "id:model:finish_reason" with the runtime's Ed25519 key.
            let signature = state.signing_key.as_ref().map(|sk| {
                let msg = format!("{}:{}:{}", resp_id, req.model, finish_reason);
                let sig = sk.sign(msg.as_bytes());
                base64::engine::general_purpose::STANDARD.encode(sig.to_bytes())
            });

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
                signature,
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

fn token_estimate(text: &str) -> u32 {
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
    let signature = signing_key.map(|sk| {
        let msg = format!("{}:{}:{}", id, kind, hash);
        let sig = sk.sign(msg.as_bytes());
        base64::engine::general_purpose::STANDARD.encode(sig.to_bytes())
    }).unwrap_or_default();

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
