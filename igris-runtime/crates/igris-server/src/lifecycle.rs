//! Agent lifecycle state machine (Phase 4).
//!
//! Formalises deterministic agent lifecycle states and the transitions between
//! them.  The supervisor holds an `AgentLifecycle` per managed agent; state
//! transitions are signed, logged, and exposed via the HTTP API.
//!
//! # State diagram
//!
//! ```text
//!   INIT ──► RUNNING ──► IDLE
//!               │           │
//!               ▼           │ (after respawn)
//!         SAFE_IDLE ◄────────┘
//!               │
//!         RECOVERING ──► RUNNING
//!               │
//!         DEGRADED ──► TERMINATED
//! ```

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use base64::Engine;
use ed25519_dalek::Signer;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tracing::{info, warn};
use uuid::Uuid;

use crate::runtime_execute::iso8601_now;
use crate::AppState;

// ─────────────────────────────────────────────────────────────────────────────
// AgentState enum
// ─────────────────────────────────────────────────────────────────────────────

/// Deterministic lifecycle state for a supervised agent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentState {
    /// Agent allocated but not yet executing.
    Init,
    /// Agent is actively processing a request.
    Running,
    /// Agent completed successfully and is awaiting work.
    Idle,
    /// Agent encountered a non-fatal error; operating in degraded capacity.
    Degraded,
    /// Agent halted after a containment / capability violation; awaiting
    /// supervisor decision.
    SafeIdle,
    /// Agent recovering from a violation before re-entering `Running`.
    Recovering,
    /// Agent permanently shut down; no further transitions permitted.
    Terminated,
}

impl std::fmt::Display for AgentState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::Init => "INIT",
            Self::Running => "RUNNING",
            Self::Idle => "IDLE",
            Self::Degraded => "DEGRADED",
            Self::SafeIdle => "SAFE_IDLE",
            Self::Recovering => "RECOVERING",
            Self::Terminated => "TERMINATED",
        };
        write!(f, "{}", s)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LifecycleTransition — signed log entry
// ─────────────────────────────────────────────────────────────────────────────

/// A single signed state-transition event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifecycleTransition {
    pub id: String,
    pub agent_id: String,
    pub from: AgentState,
    pub to: AgentState,
    pub reason: String,
    pub timestamp: String,
    /// SHA-256 hex of canonical JSON (excluding `signature`).
    pub hash: String,
    /// Base64 Ed25519 signature over `hash`.
    pub signature: String,
}

impl LifecycleTransition {
    fn new(
        agent_id: &str,
        from: AgentState,
        to: AgentState,
        reason: &str,
        signing_key: Option<&Arc<ed25519_dalek::SigningKey>>,
    ) -> Self {
        let id = Uuid::new_v4().to_string();
        let timestamp = iso8601_now();

        let mut map = BTreeMap::new();
        map.insert("id", id.clone());
        map.insert("agent_id", agent_id.to_string());
        map.insert("from", from.to_string());
        map.insert("to", to.to_string());
        map.insert("reason", reason.to_string());
        map.insert("timestamp", timestamp.clone());

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
            id,
            agent_id: agent_id.to_string(),
            from,
            to,
            reason: reason.to_string(),
            timestamp,
            hash,
            signature,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentLifecycle — per-agent supervisor
// ─────────────────────────────────────────────────────────────────────────────

/// Supervisor-maintained lifecycle for one agent.
pub struct AgentLifecycle {
    agent_id: String,
    state: Mutex<AgentState>,
    transitions: Mutex<Vec<LifecycleTransition>>,
    signing_key: Option<Arc<ed25519_dalek::SigningKey>>,
}

impl AgentLifecycle {
    /// Create a new lifecycle starting in `INIT`.
    pub fn new(agent_id: &str, signing_key: Option<Arc<ed25519_dalek::SigningKey>>) -> Arc<Self> {
        Arc::new(Self {
            agent_id: agent_id.to_string(),
            state: Mutex::new(AgentState::Init),
            transitions: Mutex::new(Vec::new()),
            signing_key,
        })
    }

    /// Read the current state without blocking longer than a mutex acquisition.
    pub async fn current_state(&self) -> AgentState {
        *self.state.lock().await
    }

    /// Attempt a state transition, logging and signing the event.
    ///
    /// Returns `Err` if the transition is not permitted from the current state.
    pub async fn transition(&self, to: AgentState, reason: &str) -> anyhow::Result<AgentState> {
        let mut state = self.state.lock().await;
        let from = *state;

        if !Self::is_valid_transition(from, to) {
            anyhow::bail!(
                "invalid transition {from} → {to} for agent {}",
                self.agent_id
            );
        }

        let t =
            LifecycleTransition::new(&self.agent_id, from, to, reason, self.signing_key.as_ref());

        info!(
            "[Lifecycle] agent={} {} → {} reason=\"{}\"",
            self.agent_id, from, to, reason
        );

        self.transitions.lock().await.push(t);
        *state = to;
        Ok(to)
    }

    /// Force a transition without validation — for emergency shutdown only.
    pub async fn force_terminate(&self, reason: &str) {
        let mut state = self.state.lock().await;
        let from = *state;
        let t = LifecycleTransition::new(
            &self.agent_id,
            from,
            AgentState::Terminated,
            reason,
            self.signing_key.as_ref(),
        );
        warn!(
            "[Lifecycle] FORCE TERMINATE agent={} from={} reason=\"{}\"",
            self.agent_id, from, reason
        );
        self.transitions.lock().await.push(t);
        *state = AgentState::Terminated;
    }

    /// Return a snapshot of all recorded transitions.
    pub async fn history(&self) -> Vec<LifecycleTransition> {
        self.transitions.lock().await.clone()
    }

    // ── Allowed transition table ─────────────────────────────────────────────

    fn is_valid_transition(from: AgentState, to: AgentState) -> bool {
        use AgentState::*;
        matches!(
            (from, to),
            (Init, Running)
                | (Running, Idle)
                | (Running, SafeIdle)    // containment violation
                | (Running, Degraded)
                | (Running, Terminated)
                | (Idle, Running)
                | (Idle, Terminated)
                | (Degraded, Running)
                | (Degraded, Terminated)
                | (SafeIdle, Recovering) // supervisor initiates respawn
                | (Recovering, Running)
                | (Recovering, Terminated)
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Thread-safe registry
// ─────────────────────────────────────────────────────────────────────────────

/// Registry of all supervised agent lifecycles, keyed by agent_id.
pub type LifecycleRegistry = Arc<RwLock<HashMap<String, Arc<AgentLifecycle>>>>;

/// Create an empty registry.
pub fn new_lifecycle_registry() -> LifecycleRegistry {
    Arc::new(RwLock::new(HashMap::new()))
}

/// Register a new agent lifecycle (or replace an existing one).
pub async fn register_lifecycle(
    registry: &LifecycleRegistry,
    agent_id: &str,
    signing_key: Option<Arc<ed25519_dalek::SigningKey>>,
) -> Arc<AgentLifecycle> {
    let lc = AgentLifecycle::new(agent_id, signing_key);
    registry
        .write()
        .await
        .insert(agent_id.to_string(), lc.clone());
    lc
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP handler: GET /v1/runtime/agent/{id}/state
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct AgentStateResponse {
    agent_id: String,
    state: AgentState,
    history: Vec<LifecycleTransition>,
}

/// `GET /v1/runtime/agent/:id/state`
///
/// Returns the current lifecycle state and transition history for an agent.
pub async fn handle_agent_state(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
) -> impl IntoResponse {
    let registry = match &state.lifecycle_registry {
        Some(r) => r,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({
                    "error": "lifecycle registry not enabled"
                })),
            )
                .into_response();
        }
    };

    let guard = registry.read().await;
    match guard.get(&agent_id) {
        Some(lc) => {
            let current = lc.current_state().await;
            let history = lc.history().await;
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "agent_id": agent_id,
                    "state": current,
                    "history": history,
                })),
            )
                .into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": format!("agent '{}' not found", agent_id)
            })),
        )
            .into_response(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn valid_transitions_succeed() {
        let lc = AgentLifecycle::new("agent-1", None);
        assert_eq!(lc.current_state().await, AgentState::Init);

        lc.transition(AgentState::Running, "started").await.unwrap();
        assert_eq!(lc.current_state().await, AgentState::Running);

        lc.transition(AgentState::SafeIdle, "violation detected")
            .await
            .unwrap();
        assert_eq!(lc.current_state().await, AgentState::SafeIdle);

        lc.transition(AgentState::Recovering, "respawning")
            .await
            .unwrap();
        lc.transition(AgentState::Running, "recovered")
            .await
            .unwrap();
        assert_eq!(lc.current_state().await, AgentState::Running);
    }

    #[tokio::test]
    async fn invalid_transition_returns_error() {
        let lc = AgentLifecycle::new("agent-2", None);
        // Cannot jump from Init directly to Terminated via valid path
        // (but let's test an actually invalid hop: Init → Idle).
        let result = lc.transition(AgentState::Idle, "invalid").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn history_records_transitions() {
        let lc = AgentLifecycle::new("agent-3", None);
        lc.transition(AgentState::Running, "t1").await.unwrap();
        lc.transition(AgentState::Idle, "t2").await.unwrap();
        let history = lc.history().await;
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].from, AgentState::Init);
        assert_eq!(history[0].to, AgentState::Running);
        assert_eq!(history[1].from, AgentState::Running);
        assert_eq!(history[1].to, AgentState::Idle);
    }

    #[tokio::test]
    async fn transitions_are_signed() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;
        let sk = Arc::new(SigningKey::generate(&mut OsRng));
        let vk = sk.verifying_key();

        let lc = AgentLifecycle::new("agent-4", Some(sk));
        lc.transition(AgentState::Running, "start").await.unwrap();
        let history = lc.history().await;
        let t = &history[0];

        assert!(!t.signature.is_empty());

        // Re-derive canonical JSON and verify.
        let mut map = BTreeMap::new();
        map.insert("id", t.id.clone());
        map.insert("agent_id", t.agent_id.clone());
        map.insert("from", t.from.to_string());
        map.insert("to", t.to.to_string());
        map.insert("reason", t.reason.clone());
        map.insert("timestamp", t.timestamp.clone());
        let canonical = serde_json::to_string(&map).unwrap();
        let digest = Sha256::digest(canonical.as_bytes());
        let sig_bytes = base64::engine::general_purpose::STANDARD
            .decode(&t.signature)
            .unwrap();
        let sig = ed25519_dalek::Signature::from_slice(&sig_bytes).unwrap();
        vk.verify_strict(&digest, &sig).unwrap();
    }

    #[tokio::test]
    async fn registry_register_and_lookup() {
        let registry = new_lifecycle_registry();
        register_lifecycle(&registry, "agent-5", None).await;

        let guard = registry.read().await;
        assert!(guard.contains_key("agent-5"));
    }
}
