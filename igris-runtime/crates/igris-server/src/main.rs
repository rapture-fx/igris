use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use clap::{Parser, Subcommand};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{error, info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use igris_core::{config::IgrisConfig, storage::RedbStorage};
use igris_routing::{
    cloud_provider::CloudProvider, council::CouncilRouter, speculative::SpeculativeRouter,
    thompson::ThompsonSamplingRouter, Provider,
};
mod runtime_execute;
use runtime_execute::{PeerRegistry, ViolationLog};
// ── Phase 1–4: Deterministic execution hardening ───────────────────────────
mod capabilities;
mod deployment_security;
mod lifecycle;
mod namespace;
mod receipt;
mod runtime_identity;
mod transaction;
use igris_btree::prelude::*;
use igris_emergency::EscapeVectorCache;
use igris_fleet;
#[cfg(feature = "hitl")]
use igris_hitl::{HitlConfig, HitlCoordinator};
use igris_local_llm::{LocalLLMConfig, LocalLLMProviderAdapter};
use igris_mcp_client::{ContextBroadcaster, McpClient};
use igris_mcp_server::{
    build_mcp_router, protocol::ServerInfo, ContextStore, EncryptedStorage, McpState, PeerDiscovery,
};
#[cfg(feature = "memory")]
use igris_memory::{AgentMemory, MemoryConfig as AgentMemoryConfig};
use igris_planning::{PlanningAgent, PlanningConfig};
use igris_reflection::{
    LLMProvider as ReflectionLLMProvider, ReflectionAgent, ReflectionConfig as ReflectionLoopConfig,
};
use igris_routing::local_provider::LocalProvider;
use lifecycle::{new_lifecycle_registry, LifecycleRegistry};
use receipt::ReceiptLog;
use runtime_identity::load_or_create_runtime_identity;
mod tool_agent;
use tool_agent::ToolAgent;
mod swarm_agent;
use swarm_agent::{run_swarm, SwarmConfig};
// RUNTIME-04: Execution graph observability
mod execution_graph;
#[allow(unused_imports)]
use execution_graph::ExecutionGraphRegistry;
// RUNTIME-05: Resource safety limits
mod resource_limits;
use igris_tools::filesystem::FileSystemTool;
use igris_tools::http::HttpTool;
use igris_tools::shell::ShellTool;
use igris_tools::ToolRegistry;
mod lora_training;
use lora_training::LoraTrainingManager;
mod task_executor;
use igris_lora_trainer::{LoRATrainingConfig, TrainingDataStore};
mod federated_integration;
use federated_integration::FederatedManager;
mod swarm_integration;
use swarm_integration::SwarmManager;
mod fleet_integration;
use deployment_security::{validate_runtime_security_config, RuntimeSecurityPolicy};
use fleet_integration::FleetManager;
mod middleware;
use axum::middleware::from_fn_with_state;
use middleware::security::{security_middleware, RateLimiter};
mod metrics;
use metrics::Metrics;
#[cfg(feature = "ros2")]
pub mod ros2_integration;
#[cfg(test)]
mod server_flow_tests;
use igris_safety::ViolationEventBus;

/// Application state shared across handlers
#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) config: Arc<IgrisConfig>,
    #[allow(dead_code)]
    pub(crate) storage: Arc<RedbStorage>,
    pub(crate) speculative_router: Arc<SpeculativeRouter>,
    pub(crate) thompson_router: Arc<ThompsonSamplingRouter>,
    #[allow(dead_code)]
    pub(crate) council_router: Arc<CouncilRouter>,
    pub(crate) cloud_providers: Arc<Vec<CloudProvider>>,
    pub(crate) local_provider: Option<Arc<LocalProvider>>,
    pub(crate) mcp_context_store: Option<Arc<ContextStore>>,
    pub(crate) reflection_config: Option<ReflectionLoopConfig>,
    pub(crate) tool_registry: Option<Arc<ToolRegistry>>,
    pub(crate) tool_max_steps: u32,
    pub(crate) tool_timeout_ms: u64,
    pub(crate) tool_max_concurrent: usize,
    pub(crate) planning_config: Option<PlanningConfig>,
    pub(crate) swarm_config: Option<SwarmConfig>,
    pub(crate) swarm_peer_id: String,
    pub(crate) lora_training: Option<Arc<LoraTrainingManager>>,
    pub(crate) federated_manager: Option<Arc<FederatedManager>>,
    pub(crate) swarm_manager: Option<Arc<SwarmManager>>,
    pub(crate) fleet_manager: Option<Arc<FleetManager>>,
    pub(crate) rate_limiter: Option<middleware::security::RateLimiter>,
    pub(crate) metrics: Arc<Metrics>,
    pub(crate) escapevector_cache: Option<Arc<EscapeVectorCache>>,
    #[cfg(feature = "memory")]
    pub(crate) agent_memory: Option<Arc<AgentMemory>>,
    #[cfg(feature = "hitl")]
    pub(crate) hitl_coordinator: Option<Arc<HitlCoordinator>>,
    /// In-memory violation log populated by `POST /v1/runtime/execute` timeouts.
    pub(crate) violation_log: Option<ViolationLog>,
    /// Registry of registered peer (edge) runtimes keyed by runtime_id.
    pub(crate) peer_registry: Option<PeerRegistry>,
    /// This server's Ed25519 verifying key (hex-encoded), sent to edge runtimes
    /// on registration so they can verify signed config messages.
    pub(crate) runtime_public_key: Option<String>,
    /// Ed25519 signing key used to sign ExecuteResponse and ViolationRecord hashes.
    pub(crate) signing_key: Option<Arc<ed25519_dalek::SigningKey>>,
    /// Overture's Ed25519 verifying key for X-Igris-Decision-Sig verification.
    /// Populated from IGRIS_OVERTURE_PUBLIC_KEY env var (hex). None = skip verify.
    pub(crate) overture_public_key: Option<Arc<ed25519_dalek::VerifyingKey>>,
    /// Shared containment violation bus for deterministic halt / safe-idle handling.
    pub(crate) violation_bus: ViolationEventBus,
    /// Current runtime license posture surfaced via `/v1/runtime/profile`.
    pub(crate) license_status: RuntimeLicenseStatus,
    // ── Phase 3 ─────────────────────────────────────────────────────────────
    /// Append-only, hash-chained execution receipt log.
    pub(crate) receipt_log: Option<Arc<ReceiptLog>>,
    // ── Phase 4 ─────────────────────────────────────────────────────────────
    /// Registry of per-agent lifecycle state machines.
    pub(crate) lifecycle_registry: Option<LifecycleRegistry>,
    /// Registry of in-flight durable task cancellation signals keyed by task_id.
    pub(crate) task_cancellation_registry:
        Arc<std::sync::RwLock<HashMap<uuid::Uuid, tokio::sync::watch::Sender<bool>>>>,
    // ── BT Live Streaming ─────────────────────────────────────────────────────
    /// Watch sender for per-tick BT state. The `btree_run` handler wires its
    /// executor tick observer to this sender; the `/v1/btree/events` SSE
    /// endpoint subscribes to the receiver side.
    pub(crate) bt_state_tx: Arc<tokio::sync::watch::Sender<serde_json::Value>>,
    // ── ROS2 ─────────────────────────────────────────────────────────────────
    /// ROS2 manager — holds the Ros2Node and ContainmentBridge.
    /// Available when the `ros2` feature is enabled and ENABLE_ROS2=true.
    #[cfg(feature = "ros2")]
    pub(crate) ros2_manager: Option<Arc<crate::ros2_integration::Ros2Manager>>,
}

#[derive(Clone)]
pub(crate) struct RuntimeLicenseStatus {
    pub(crate) state: String,
    pub(crate) tier: Option<String>,
    pub(crate) license_expires_at: Option<String>,
    pub(crate) offline_artifact_expires_at: Option<String>,
}

fn non_empty_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn apply_auth_env_overrides(config: &mut IgrisConfig) {
    if let Some(secret) = non_empty_env("IGRIS_RUNTIME_SECRET") {
        config.auth.api_key = secret;
        config.auth.enabled = true;
        info!("[Runtime/Auth] Bearer token auth enforced via IGRIS_RUNTIME_SECRET");
    } else if config.auth.api_key.trim().is_empty() {
        if let Some(api_key) = non_empty_env("IGRIS_RUNTIME_API_KEY") {
            config.auth.api_key = api_key;
            config.auth.enabled = true;
            info!("[Runtime/Auth] API key auth configured via IGRIS_RUNTIME_API_KEY");
        }
    }

    if config.auth.jwt_hs256_secret.is_none() {
        if let Some(jwt_secret) = non_empty_env("IGRIS_RUNTIME_JWT_HS256_SECRET") {
            config.auth.jwt_hs256_secret = Some(jwt_secret);
            config.auth.enabled = true;
            info!("[Runtime/Auth] JWT auth configured via IGRIS_RUNTIME_JWT_HS256_SECRET");
        }
    }
}

fn load_runtime_config(config_path: &str) -> anyhow::Result<IgrisConfig> {
    let mut config = if std::path::Path::new(config_path).exists() {
        IgrisConfig::load_from_file_unvalidated(config_path)?
    } else {
        warn!("Config file not found, using secure defaults");
        IgrisConfig::default()
    };

    apply_auth_env_overrides(&mut config);
    config.validate()?;
    Ok(config)
}

fn load_overture_public_key() -> Option<Arc<ed25519_dalek::VerifyingKey>> {
    non_empty_env("IGRIS_OVERTURE_PUBLIC_KEY").and_then(|hex| {
        if hex.len() % 2 != 0 {
            return None;
        }

        let bytes: Option<Vec<u8>> = (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).ok())
            .collect();

        bytes
            .and_then(|b| {
                let arr: [u8; 32] = b.try_into().ok()?;
                ed25519_dalek::VerifyingKey::from_bytes(&arr).ok()
            })
            .map(Arc::new)
    })
}

/// Reflection LLM provider backed by the local provider (real llama.cpp execution).
struct LocalProviderReflectionLLM {
    provider: Arc<LocalProvider>,
}

#[async_trait::async_trait]
impl ReflectionLLMProvider for LocalProviderReflectionLLM {
    async fn generate(&self, prompt: &str) -> anyhow::Result<String> {
        self.provider.complete(prompt).await
    }

    fn name(&self) -> &str {
        "local-llm"
    }
}

/// Reflection LLM provider backed by a single cloud provider.
#[derive(Clone)]
struct CloudProviderReflectionLLM(CloudProvider);

#[async_trait::async_trait]
impl ReflectionLLMProvider for CloudProviderReflectionLLM {
    async fn generate(&self, prompt: &str) -> anyhow::Result<String> {
        self.0.complete(prompt).await
    }

    fn name(&self) -> &str {
        self.0.name()
    }
}

/// OpenAPI documentation
#[derive(OpenApi)]
#[openapi(
    paths(health, chat_completions),
    components(
        schemas(ChatCompletionRequest, ChatMessage, ChatCompletionResponse, ChatCompletionChoice, Usage)
    ),
    tags(
        (name = "health", description = "Health check endpoints"),
        (name = "chat", description = "Chat completion endpoints")
    ),
    info(
        title = "Igris Runtime API",
        version = "1.1.0",
        description = "Pure Rust AI routing engine with Thompson Sampling, Speculative Execution, Council Mode, and Local LLM Fallback",
        license(name = "MIT OR Apache-2.0")
    )
)]
struct ApiDoc;

/// Chat message
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct ChatMessage {
    /// Role of the message sender
    #[schema(example = "user")]
    role: String,
    /// Content of the message
    #[schema(example = "Hello, how are you?")]
    content: String,
}

/// Chat completion request (OpenAI-compatible)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct ChatCompletionRequest {
    /// Model identifier
    #[schema(example = "gpt-4")]
    model: String,
    /// Array of messages
    messages: Vec<ChatMessage>,
    /// Maximum tokens to generate
    #[serde(default)]
    #[schema(example = 150)]
    max_tokens: Option<u32>,
    /// Sampling temperature
    #[serde(default)]
    #[schema(example = 0.7)]
    temperature: Option<f32>,
    /// Routing mode: "thompson", "speculative", or "council"
    #[serde(default)]
    #[schema(example = "speculative")]
    mode: Option<String>,
    /// Stream responses (not yet implemented)
    #[serde(default)]
    stream: Option<bool>,
}

/// Usage statistics
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

/// Chat completion choice
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct ChatCompletionChoice {
    index: u32,
    message: ChatMessage,
    finish_reason: String,
}

/// Chat completion response (OpenAI-compatible)
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct ChatCompletionResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<ChatCompletionChoice>,
    usage: Usage,
    /// Optional metadata for degraded mode and caching
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<ResponseMetadata>,
}

/// Response metadata for degraded mode and cache information
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct ResponseMetadata {
    /// Whether this response was served in degraded mode (from cache)
    degraded: bool,
    /// Source of the response (e.g., "cache", "local", "openai-gpt4o-mini")
    source: String,
    /// Optional cache age in seconds (only present when served from cache)
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_age_seconds: Option<u64>,
    /// Optional quality score (0.0-1.0, only present when served from cache)
    #[serde(skip_serializing_if = "Option::is_none")]
    quality_score: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct LoraTrainingStatusResponse {
    status: String,
    last_started_at: Option<u64>,
    last_finished_at: Option<u64>,
    last_error: Option<String>,
    total_examples: usize,
    request_counter: u64,
    should_trigger: bool,
    last_result: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MemoryStoreRequest {
    key: String,
    content: String,
    embedding: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MemorySearchRequest {
    embedding: Vec<f32>,
    #[serde(default)]
    top_k: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HitlRequestInput {
    task: String,
    #[serde(default)]
    context: Option<std::collections::HashMap<String, serde_json::Value>>,
    #[serde(default)]
    confidence: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HitlDecisionRequest {
    request_id: String,
}

// ============================================================================
// Model Management types and handlers
// ============================================================================

/// Model info response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct ModelInfoResponse {
    name: String,
    path: String,
    context_size: u32,
    status: String,
    n_gpu_layers: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    lora_adapter_path: Option<String>,
}

/// Load model request
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct LoadModelRequest {
    /// Path to the GGUF model file
    model_path: String,
    /// Number of GPU layers to offload
    #[serde(default)]
    n_gpu_layers: Option<u32>,
    /// Context size for the model
    #[serde(default)]
    context_size: Option<u32>,
}

/// Swap model request
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct SwapModelRequest {
    /// Path to the new GGUF model file
    model_path: String,
    /// Optional LoRA adapter path
    #[serde(default)]
    lora_adapter_path: Option<String>,
    /// Number of GPU layers to offload
    #[serde(default)]
    n_gpu_layers: Option<u32>,
    /// Context size for the model
    #[serde(default)]
    context_size: Option<u32>,
}

/// List loaded models
#[utoipa::path(
    get,
    path = "/v1/admin/models",
    tag = "admin",
    responses(
        (status = 200, description = "List of loaded models", body = Vec<ModelInfoResponse>)
    )
)]
async fn list_models(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(local_provider) = &state.local_provider else {
        return Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "models": [],
                "local_llm_enabled": false
            })),
        )
            .into_response());
    };

    let config = local_provider.config().await;
    let adapter_path = local_provider.get_adapter_path().await;

    let model_info = ModelInfoResponse {
        name: config.model_display_name(),
        path: config.resolve_model_path(),
        context_size: config.resolve_context_size(),
        status: "loaded".to_string(),
        n_gpu_layers: config.n_gpu_layers,
        lora_adapter_path: adapter_path.map(|p| p.display().to_string()),
    };

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "models": [model_info],
            "local_llm_enabled": true
        })),
    )
        .into_response())
}

/// Load a GGUF model
#[utoipa::path(
    post,
    path = "/v1/admin/models/load",
    tag = "admin",
    request_body = LoadModelRequest,
    responses(
        (status = 200, description = "Model loaded successfully", body = ModelInfoResponse),
        (status = 400, description = "Bad request", body = ErrorResponse),
        (status = 503, description = "Local LLM not enabled", body = ErrorResponse)
    )
)]
async fn load_model(
    State(state): State<AppState>,
    Json(req): Json<LoadModelRequest>,
) -> Result<Response, ApiError> {
    let Some(local_provider) = &state.local_provider else {
        return Err(ApiError::ServiceUnavailable(
            "Local LLM is not enabled. Configure local_fallback in config to use model management."
                .to_string(),
        ));
    };

    let model_path = std::path::PathBuf::from(&req.model_path);
    if !model_path.exists() {
        return Err(ApiError::BadRequest(format!(
            "Model file not found: {}",
            req.model_path
        )));
    }

    info!("Loading model: {}", req.model_path);

    local_provider
        .hot_swap(
            model_path,
            req.context_size,
            None, // threads
            req.n_gpu_layers,
            None, // main_gpu
        )
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to load model: {}", e)))?;

    let config = local_provider.config().await;

    let model_info = ModelInfoResponse {
        name: config.model_display_name(),
        path: config.resolve_model_path(),
        context_size: config.resolve_context_size(),
        status: "loaded".to_string(),
        n_gpu_layers: config.n_gpu_layers,
        lora_adapter_path: None,
    };

    info!("Model loaded successfully: {}", req.model_path);
    Ok((StatusCode::OK, Json(model_info)).into_response())
}

/// Hot-swap the active model
#[utoipa::path(
    post,
    path = "/v1/admin/models/swap",
    tag = "admin",
    request_body = SwapModelRequest,
    responses(
        (status = 200, description = "Model swapped successfully", body = ModelInfoResponse),
        (status = 400, description = "Bad request", body = ErrorResponse),
        (status = 503, description = "Local LLM not enabled", body = ErrorResponse)
    )
)]
async fn swap_model(
    State(state): State<AppState>,
    Json(req): Json<SwapModelRequest>,
) -> Result<Response, ApiError> {
    let Some(local_provider) = &state.local_provider else {
        return Err(ApiError::ServiceUnavailable(
            "Local LLM is not enabled. Configure local_fallback in config to use model management."
                .to_string(),
        ));
    };

    let model_path = std::path::PathBuf::from(&req.model_path);
    if !model_path.exists() {
        return Err(ApiError::BadRequest(format!(
            "Model file not found: {}",
            req.model_path
        )));
    }

    info!("Swapping model to: {}", req.model_path);

    // Swap the base model
    local_provider
        .hot_swap(model_path, req.context_size, None, req.n_gpu_layers, None)
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to swap model: {}", e)))?;

    // Optionally load LoRA adapter
    if let Some(ref lora_path) = req.lora_adapter_path {
        let adapter_path = std::path::PathBuf::from(lora_path);
        if !adapter_path.exists() {
            return Err(ApiError::BadRequest(format!(
                "LoRA adapter file not found: {}",
                lora_path
            )));
        }
        local_provider
            .load_lora_adapter(Some(adapter_path))
            .await
            .map_err(|e| ApiError::InternalError(format!("Failed to load LoRA adapter: {}", e)))?;
    }

    let config = local_provider.config().await;
    let adapter_path = local_provider.get_adapter_path().await;

    let model_info = ModelInfoResponse {
        name: config.model_display_name(),
        path: config.resolve_model_path(),
        context_size: config.resolve_context_size(),
        status: "loaded".to_string(),
        n_gpu_layers: config.n_gpu_layers,
        lora_adapter_path: adapter_path.map(|p| p.display().to_string()),
    };

    info!("Model swapped successfully: {}", req.model_path);
    Ok((StatusCode::OK, Json(model_info)).into_response())
}

/// Planning request
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct PlanningRequest {
    /// Goal to accomplish
    #[schema(example = "Find the weather in San Francisco")]
    goal: String,
    /// Enable tool usage
    #[serde(default)]
    enable_tools: Option<bool>,
    /// Maximum planning steps
    #[serde(default)]
    max_steps: Option<u32>,
}

/// Planning response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct PlanningResponse {
    goal: String,
    success: bool,
    total_steps: u32,
    final_answer: String,
    steps: Vec<serde_json::Value>,
}

/// Reflection request
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct ReflectionRequest {
    /// Prompt to generate and improve
    #[schema(example = "Write a haiku about AI")]
    prompt: String,
    /// Maximum reflection iterations
    #[serde(default)]
    max_iterations: Option<u32>,
    /// Quality threshold (0.0-1.0)
    #[serde(default)]
    quality_threshold: Option<f32>,
}

/// Reflection response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
struct ReflectionResponse {
    final_response: String,
    total_iterations: u32,
    final_score: f32,
    threshold_met: bool,
    iterations: Vec<serde_json::Value>,
}

/// Error response
#[derive(Debug, Serialize, Deserialize)]
struct ErrorResponse {
    error: ErrorDetail,
}

#[derive(Debug, Serialize, Deserialize)]
struct ErrorDetail {
    message: String,
    r#type: String,
    code: Option<String>,
}

/// Custom error type
enum ApiError {
    BadRequest(String),
    InternalError(String),
    NotImplemented(String),
    ServiceUnavailable(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message, error_type) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg, "bad_request"),
            ApiError::InternalError(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, msg, "internal_error")
            }
            ApiError::NotImplemented(msg) => (StatusCode::NOT_IMPLEMENTED, msg, "not_implemented"),
            ApiError::ServiceUnavailable(msg) => {
                (StatusCode::SERVICE_UNAVAILABLE, msg, "service_unavailable")
            }
        };

        let error_response = ErrorResponse {
            error: ErrorDetail {
                message,
                r#type: error_type.to_string(),
                code: None,
            },
        };

        (status, Json(error_response)).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError::InternalError(err.to_string())
    }
}

fn compiled_runtime_profiles() -> Vec<&'static str> {
    let mut profiles = Vec::new();
    #[cfg(feature = "agent-platform")]
    profiles.push("agent-platform");
    #[cfg(feature = "robotics-platform")]
    profiles.push("robotics-platform");
    #[cfg(feature = "full-platform")]
    profiles.push("full-platform");
    if profiles.is_empty() {
        profiles.push("minimal");
    }
    profiles
}

/// Health check endpoint
#[utoipa::path(
    get,
    path = "/v1/health",
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = String)
    )
)]
async fn health() -> &'static str {
    "OK"
}

async fn runtime_profile(State(state): State<AppState>) -> Response {
    let agent_memory_enabled = {
        #[cfg(feature = "memory")]
        {
            state.agent_memory.is_some()
        }
        #[cfg(not(feature = "memory"))]
        {
            false
        }
    };

    let hitl_enabled = {
        #[cfg(feature = "hitl")]
        {
            state.hitl_coordinator.is_some()
        }
        #[cfg(not(feature = "hitl"))]
        {
            false
        }
    };

    let ros2_enabled = {
        #[cfg(feature = "ros2")]
        {
            state.ros2_manager.is_some()
        }
        #[cfg(not(feature = "ros2"))]
        {
            false
        }
    };

    let response = serde_json::json!({
        "compiled_profiles": compiled_runtime_profiles(),
        "license": {
            "state": state.license_status.state,
            "tier": state.license_status.tier,
            "license_expires_at": state.license_status.license_expires_at,
            "offline_artifact_expires_at": state.license_status.offline_artifact_expires_at
        },
        "capabilities": {
            "local_llm_fallback": state.local_provider.is_some(),
            "mcp": state.mcp_context_store.is_some(),
            "fleet": state.fleet_manager.is_some(),
            "swarm": state.swarm_manager.is_some(),
            "federated": state.federated_manager.is_some(),
            "escapevector": state.escapevector_cache.is_some(),
            "agent_memory": agent_memory_enabled,
            "human_in_the_loop": hitl_enabled,
            "ros2": ros2_enabled
        }
    });

    (StatusCode::OK, Json(response)).into_response()
}

/// Prometheus metrics endpoint
#[utoipa::path(
    get,
    path = "/metrics",
    tag = "metrics",
    responses(
        (status = 200, description = "Prometheus metrics (text/plain)", body = String)
    )
)]
async fn metrics_handler(State(state): State<AppState>) -> Response {
    let body = state.metrics.render_prometheus();
    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4")],
        body,
    )
        .into_response()
}

/// Fleet types retained for OpenAPI schema generation (utoipa)
#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum InstanceStatus {
    Online,
    Offline,
    Maintenance,
    Syncing,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum SyncStatus {
    InSync,
    OutOfSync,
    Syncing,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
struct EdgeRuntimeInstance {
    id: String,
    name: String,
    region: String,
    availability_zone: String,
    status: InstanceStatus,
    version: String,
    last_heartbeat: String,
    uptime_seconds: u64,
    requests_processed: u64,
    error_rate: f64,
    avg_latency: f64,
    cpu_usage: f64,
    memory_usage: f64,
    sync_status: SyncStatus,
    last_sync_time: String,
    capabilities: Vec<String>,
    provider_connections: u32,
    active_requests: u32,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
struct FleetMetrics {
    total_instances: u32,
    online_instances: u32,
    offline_instances: u32,
    maintenance_instances: u32,
    avg_uptime_percentage: f64,
    total_requests_served: u64,
    fleet_error_rate: f64,
    regions_covered: u32,
    total_capacity: u32,
    used_capacity: u32,
}

#[utoipa::path(
    get,
    path = "/v1/fleet/instances",
    tag = "fleet",
    responses(
        (status = 200, description = "List of fleet instances", body = Vec<EdgeRuntimeInstance>)
    )
)]
async fn fleet_instances(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.fleet_manager else {
        return Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "enabled": false,
                "instances": []
            })),
        )
            .into_response());
    };

    let instance = mgr.get_instance_info().await;
    Ok((StatusCode::OK, Json(vec![instance])).into_response())
}

#[utoipa::path(
    get,
    path = "/v1/fleet/metrics",
    tag = "fleet",
    responses(
        (status = 200, description = "Fleet-wide metrics", body = FleetMetrics)
    )
)]
async fn fleet_metrics(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.fleet_manager else {
        return Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "enabled": false
            })),
        )
            .into_response());
    };

    let metrics = mgr.get_metrics().await;
    Ok((StatusCode::OK, Json(metrics)).into_response())
}

#[utoipa::path(
    get,
    path = "/v1/lora/status",
    tag = "lora",
    responses(
        (status = 200, description = "LoRA training status", body = LoraTrainingStatusResponse)
    )
)]
async fn lora_status(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.lora_training else {
        return Ok((StatusCode::OK, Json(serde_json::json!({"enabled": false}))).into_response());
    };
    let snap = mgr.status_snapshot().await?;
    let last_result = snap
        .last_result
        .as_ref()
        .and_then(|r| serde_json::to_value(r).ok());
    let resp = LoraTrainingStatusResponse {
        status: format!("{:?}", snap.status),
        last_started_at: snap.last_started_at,
        last_finished_at: snap.last_finished_at,
        last_error: snap.last_error,
        total_examples: snap.total_examples,
        request_counter: snap.request_counter,
        should_trigger: snap.should_trigger,
        last_result,
    };
    Ok((StatusCode::OK, Json(resp)).into_response())
}

#[cfg(feature = "memory")]
async fn memory_status(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(memory) = &state.agent_memory else {
        return Ok((StatusCode::OK, Json(serde_json::json!({"enabled": false}))).into_response());
    };

    let stats = memory.stats().await;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "enabled": true,
            "stats": {
                "vector_entries": stats.vector_entries,
                "cache_entries": stats.cache_entries,
                "cache_hit_rate": stats.cache_hit_rate,
            }
        })),
    )
        .into_response())
}

#[cfg(not(feature = "memory"))]
async fn memory_status() -> Result<Response, ApiError> {
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({"enabled": false, "compiled": false})),
    )
        .into_response())
}

#[cfg(feature = "memory")]
async fn memory_store(
    State(state): State<AppState>,
    Json(req): Json<MemoryStoreRequest>,
) -> Result<Response, ApiError> {
    let Some(memory) = &state.agent_memory else {
        return Err(ApiError::ServiceUnavailable(
            "agent memory is disabled".to_string(),
        ));
    };

    memory.store(&req.key, &req.content, req.embedding).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "stored": true,
            "key": req.key,
        })),
    )
        .into_response())
}

#[cfg(not(feature = "memory"))]
async fn memory_store() -> Result<Response, ApiError> {
    Err(ApiError::NotImplemented(
        "agent memory was not compiled into this runtime".to_string(),
    ))
}

#[cfg(feature = "memory")]
async fn memory_get(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> Result<Response, ApiError> {
    let Some(memory) = &state.agent_memory else {
        return Err(ApiError::ServiceUnavailable(
            "agent memory is disabled".to_string(),
        ));
    };

    let entry = memory.get(&key).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "enabled": true,
            "entry": entry,
        })),
    )
        .into_response())
}

#[cfg(not(feature = "memory"))]
async fn memory_get() -> Result<Response, ApiError> {
    Err(ApiError::NotImplemented(
        "agent memory was not compiled into this runtime".to_string(),
    ))
}

#[cfg(feature = "memory")]
async fn memory_search(
    State(state): State<AppState>,
    Json(req): Json<MemorySearchRequest>,
) -> Result<Response, ApiError> {
    let Some(memory) = &state.agent_memory else {
        return Err(ApiError::ServiceUnavailable(
            "agent memory is disabled".to_string(),
        ));
    };

    let results = memory
        .retrieve(req.embedding, req.top_k.unwrap_or(5))
        .await?;
    let results = results
        .into_iter()
        .map(|result| {
            serde_json::json!({
                "key": result.entry.key,
                "content": result.entry.content,
                "timestamp": result.entry.timestamp,
                "similarity": result.similarity,
            })
        })
        .collect::<Vec<_>>();

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "enabled": true,
            "results": results,
        })),
    )
        .into_response())
}

#[cfg(not(feature = "memory"))]
async fn memory_search() -> Result<Response, ApiError> {
    Err(ApiError::NotImplemented(
        "agent memory was not compiled into this runtime".to_string(),
    ))
}

#[cfg(feature = "hitl")]
async fn hitl_status(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(coordinator) = &state.hitl_coordinator else {
        return Ok((StatusCode::OK, Json(serde_json::json!({"enabled": false}))).into_response());
    };

    let pending = coordinator.get_pending_requests().await;
    let config = coordinator.config();
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "enabled": true,
            "pending_requests": pending.len(),
            "auto_approve_threshold": config.auto_approve_threshold,
            "timeout_secs": config.timeout_secs,
        })),
    )
        .into_response())
}

#[cfg(not(feature = "hitl"))]
async fn hitl_status() -> Result<Response, ApiError> {
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({"enabled": false, "compiled": false})),
    )
        .into_response())
}

#[cfg(feature = "hitl")]
async fn hitl_requests(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(coordinator) = &state.hitl_coordinator else {
        return Err(ApiError::ServiceUnavailable("HITL is disabled".to_string()));
    };

    let pending = coordinator.get_pending_requests().await;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "enabled": true,
            "requests": pending,
        })),
    )
        .into_response())
}

#[cfg(not(feature = "hitl"))]
async fn hitl_requests() -> Result<Response, ApiError> {
    Err(ApiError::NotImplemented(
        "HITL was not compiled into this runtime".to_string(),
    ))
}

#[cfg(feature = "hitl")]
async fn hitl_submit(
    State(state): State<AppState>,
    Json(req): Json<HitlRequestInput>,
) -> Result<Response, ApiError> {
    let Some(coordinator) = &state.hitl_coordinator else {
        return Err(ApiError::ServiceUnavailable("HITL is disabled".to_string()));
    };

    let (request, status) = coordinator
        .submit_request(
            req.task,
            req.context.unwrap_or_default(),
            req.confidence.unwrap_or(0.0),
        )
        .await?;

    Ok((
        StatusCode::ACCEPTED,
        Json(serde_json::json!({
            "request": request,
            "status": status,
        })),
    )
        .into_response())
}

#[cfg(not(feature = "hitl"))]
async fn hitl_submit() -> Result<Response, ApiError> {
    Err(ApiError::NotImplemented(
        "HITL was not compiled into this runtime".to_string(),
    ))
}

#[cfg(feature = "hitl")]
async fn hitl_approve(
    State(state): State<AppState>,
    Json(req): Json<HitlDecisionRequest>,
) -> Result<Response, ApiError> {
    let Some(coordinator) = &state.hitl_coordinator else {
        return Err(ApiError::ServiceUnavailable("HITL is disabled".to_string()));
    };

    coordinator.approve(&req.request_id).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({"request_id": req.request_id, "status": "approved"})),
    )
        .into_response())
}

#[cfg(not(feature = "hitl"))]
async fn hitl_approve() -> Result<Response, ApiError> {
    Err(ApiError::NotImplemented(
        "HITL was not compiled into this runtime".to_string(),
    ))
}

#[cfg(feature = "hitl")]
async fn hitl_reject(
    State(state): State<AppState>,
    Json(req): Json<HitlDecisionRequest>,
) -> Result<Response, ApiError> {
    let Some(coordinator) = &state.hitl_coordinator else {
        return Err(ApiError::ServiceUnavailable("HITL is disabled".to_string()));
    };

    coordinator.reject(&req.request_id).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({"request_id": req.request_id, "status": "rejected"})),
    )
        .into_response())
}

#[cfg(not(feature = "hitl"))]
async fn hitl_reject() -> Result<Response, ApiError> {
    Err(ApiError::NotImplemented(
        "HITL was not compiled into this runtime".to_string(),
    ))
}

// ============================================================================
// Federated Learning endpoints
// ============================================================================

async fn federated_status(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.federated_manager else {
        return Ok((StatusCode::OK, Json(serde_json::json!({"enabled": false}))).into_response());
    };
    let status = mgr.get_status().await;
    Ok((StatusCode::OK, Json(status)).into_response())
}

async fn federated_submit_update(
    State(state): State<AppState>,
    Json(update): Json<igris_federated::ModelUpdate>,
) -> Result<Response, ApiError> {
    let Some(mgr) = &state.federated_manager else {
        return Err(ApiError::ServiceUnavailable(
            "Federated learning not enabled".to_string(),
        ));
    };
    match mgr.submit_update(update).await {
        Ok(Some(model)) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "aggregated": true,
                "global_model": model,
            })),
        )
            .into_response()),
        Ok(None) => Ok((
            StatusCode::ACCEPTED,
            Json(serde_json::json!({
                "aggregated": false,
                "message": "Update accepted, waiting for more participants",
            })),
        )
            .into_response()),
        Err(e) => Err(ApiError::BadRequest(e.to_string())),
    }
}

async fn federated_latest_model(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.federated_manager else {
        return Err(ApiError::ServiceUnavailable(
            "Federated learning not enabled".to_string(),
        ));
    };
    match mgr.get_latest_model().await {
        Some(model) => Ok((StatusCode::OK, Json(model)).into_response()),
        None => Ok((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "message": "No global model available yet"
            })),
        )
            .into_response()),
    }
}

async fn federated_participants(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.federated_manager else {
        return Err(ApiError::ServiceUnavailable(
            "Federated learning not enabled".to_string(),
        ));
    };
    let participants = mgr.get_participants().await;
    Ok((StatusCode::OK, Json(participants)).into_response())
}

// ============================================================================
// Swarm Intelligence endpoints
// ============================================================================

async fn swarm_status(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.swarm_manager else {
        return Ok((StatusCode::OK, Json(serde_json::json!({"enabled": false}))).into_response());
    };
    let status = mgr.get_status().await;
    Ok((StatusCode::OK, Json(status)).into_response())
}

async fn swarm_agents(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.swarm_manager else {
        return Err(ApiError::ServiceUnavailable(
            "Swarm not enabled".to_string(),
        ));
    };
    let agents = mgr.get_agents().await;
    Ok((StatusCode::OK, Json(agents)).into_response())
}

#[derive(Deserialize)]
struct SwarmJoinRequest {
    agent_id: String,
}

async fn swarm_join(
    State(state): State<AppState>,
    Json(req): Json<SwarmJoinRequest>,
) -> Result<Response, ApiError> {
    let Some(mgr) = &state.swarm_manager else {
        return Err(ApiError::ServiceUnavailable(
            "Swarm not enabled".to_string(),
        ));
    };
    mgr.join_agent(&req.agent_id)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "joined": true,
            "agent_id": req.agent_id,
        })),
    )
        .into_response())
}

#[derive(Deserialize)]
struct SwarmProposeRequest {
    task_type: String,
    parameters: serde_json::Value,
    #[serde(default = "default_priority")]
    priority: u8,
}

fn default_priority() -> u8 {
    1
}

async fn swarm_propose(
    State(state): State<AppState>,
    Json(req): Json<SwarmProposeRequest>,
) -> Result<Response, ApiError> {
    let Some(mgr) = &state.swarm_manager else {
        return Err(ApiError::ServiceUnavailable(
            "Swarm not enabled".to_string(),
        ));
    };
    let proposal_id = mgr
        .propose_task(req.task_type, req.parameters, req.priority)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "proposal_id": proposal_id,
        })),
    )
        .into_response())
}

#[derive(Deserialize)]
struct SwarmVoteRequest {
    proposal_id: String,
    approve: bool,
}

async fn swarm_vote(
    State(state): State<AppState>,
    Json(req): Json<SwarmVoteRequest>,
) -> Result<Response, ApiError> {
    let Some(mgr) = &state.swarm_manager else {
        return Err(ApiError::ServiceUnavailable(
            "Swarm not enabled".to_string(),
        ));
    };
    mgr.vote(&req.proposal_id, req.approve)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    // Check if proposal now has consensus and execute
    match mgr.check_and_execute(&req.proposal_id).await {
        Ok(Some(result)) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "voted": true,
                "consensus_reached": true,
                "execution_result": result,
            })),
        )
            .into_response()),
        Ok(None) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "voted": true,
                "consensus_reached": false,
            })),
        )
            .into_response()),
        Err(e) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "voted": true,
                "consensus_reached": true,
                "execution_error": e.to_string(),
            })),
        )
            .into_response()),
    }
}

// ── Behavior Tree Endpoints ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct BTreeValidateRequest {
    tree: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct BTreeRunRequest {
    tree: serde_json::Value,
    #[serde(default)]
    context: Option<serde_json::Value>,
    #[serde(default = "default_btree_max_ticks")]
    max_ticks: u64,
    #[serde(default = "default_btree_timeout_ms")]
    timeout_ms: u64,
}

fn default_btree_max_ticks() -> u64 {
    1000
}
fn default_btree_timeout_ms() -> u64 {
    30000
}

#[derive(Debug, Deserialize)]
struct BTreeDeployRequest {
    name: String,
    tree: serde_json::Value,
    #[serde(default)]
    description: Option<String>,
}

async fn btree_validate(Json(req): Json<BTreeValidateRequest>) -> Result<Response, ApiError> {
    let parser = igris_btree::parser::JsonTreeParser::new();
    let context = BTreeContext::new();

    match parser.parse_node(&req.tree, &context) {
        Ok(node) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": true,
                "root_type": node.node_type(),
                "root_name": node.name(),
            })),
        )
            .into_response()),
        Err(e) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": false,
                "error": e.to_string(),
            })),
        )
            .into_response()),
    }
}

async fn btree_run(
    State(state): State<AppState>,
    Json(req): Json<BTreeRunRequest>,
) -> Result<Response, ApiError> {
    let parser = igris_btree::parser::JsonTreeParser::new();
    let mut context = BTreeContext::new();

    // Wire tool registry from AppState if available
    if let Some(ref tr) = state.tool_registry {
        context = context.with_tools(tr.clone());
    }

    // Wire ROS2 node into context when available
    #[cfg(feature = "ros2")]
    if let Some(ref mgr) = state.ros2_manager {
        if !mgr.is_safe_idle() {
            context = context.with_ros2(mgr.node());
        }
    }

    // Set blackboard values from context payload
    if let Some(ctx_val) = &req.context {
        if let Some(obj) = ctx_val.as_object() {
            for (k, v) in obj {
                context.blackboard.set(k, v.clone()).await;
            }
        }
    }

    let mut tree = parser
        .parse_node(&req.tree, &context)
        .map_err(|e| ApiError::BadRequest(format!("Invalid tree: {}", e)))?;

    let executor = BTreeExecutor::new()
        .with_max_ticks(req.max_ticks)
        .with_deadline(std::time::Duration::from_millis(req.timeout_ms))
        .with_tick_observer((*state.bt_state_tx).clone());

    let result = executor
        .execute(tree.as_mut(), &mut context)
        .await
        .map_err(|e| ApiError::InternalError(format!("Execution failed: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "status": format!("{:?}", result.status),
            "success": result.is_success(),
            "tick_count": result.tick_count,
            "duration_ms": result.duration.as_millis() as u64,
            "cancelled": result.cancelled,
            "max_ticks_reached": result.max_ticks_reached,
            "deadline_exceeded": result.deadline_exceeded,
            "error": result.error,
        })),
    )
        .into_response())
}

/// GET /v1/btree/events — SSE stream of per-tick BT state snapshots.
///
/// Each event has type `bt_tick` and data `{"tick":N,"status":"Running"|...,"tree":{...}}`.
/// Keepalive comments are sent every 15 s. Clients reconnect on close.
async fn btree_events(State(state): State<AppState>) -> Response {
    let mut rx = state.bt_state_tx.subscribe();

    let stream = async_stream::stream! {
        // Initial keepalive so the browser knows the stream is open.
        yield Ok::<Event, Infallible>(Event::default().comment("keepalive"));

        loop {
            match tokio::time::timeout(
                std::time::Duration::from_secs(15),
                rx.changed(),
            ).await {
                Ok(Ok(())) => {
                    let snapshot = rx.borrow_and_update().clone();
                    yield Ok(Event::default().event("bt_tick").data(snapshot.to_string()));
                }
                Ok(Err(_)) => break, // sender dropped
                Err(_) => {
                    // 15 s keepalive
                    yield Ok(Event::default().comment("keepalive"));
                }
            }
        }
    };

    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

/// MCP SSE streaming endpoint - accepts JSON-RPC requests and streams responses
async fn mcp_stream(
    State(state): State<AppState>,
    Json(req): Json<igris_mcp_server::JsonRpcRequest>,
) -> Result<Response, ApiError> {
    use igris_mcp_server::protocol::ServerInfo;

    let context_store = state
        .mcp_context_store
        .clone()
        .ok_or_else(|| ApiError::ServiceUnavailable("MCP is not enabled".to_string()))?;

    let mcp_state = igris_mcp_server::McpState {
        context_store,
        peer_id: state.swarm_peer_id.clone(),
        server_info: ServerInfo {
            name: "Igris Runtime MCP Server".to_string(),
            version: "1.2.0".to_string(),
        },
        tool_registry: state.tool_registry.clone(),
        execution_signer: Some(Arc::new(igris_mcp_server::ExecutionSigner::new())),
    };

    // Build a temporary MCP router and dispatch the request internally
    let mcp_router = igris_mcp_server::build_mcp_router(mcp_state);

    // Serialize the request to make an internal axum call
    let body = serde_json::to_vec(&req).map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let internal_req = axum::http::Request::builder()
        .method(axum::http::Method::POST)
        .uri("/mcp")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let response = tower::ServiceExt::oneshot(mcp_router, internal_req)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    // Read the response body
    let (_parts, body) = response.into_parts();
    let body_bytes = axum::body::to_bytes(body, 1024 * 1024)
        .await
        .map_err(|e| ApiError::InternalError(e.to_string()))?;

    let result_json: serde_json::Value = serde_json::from_slice(&body_bytes)
        .unwrap_or_else(|_| serde_json::json!({"error": "Failed to parse MCP response"}));

    // Stream the response as SSE events
    let events = vec![
        Ok::<Event, Infallible>(
            Event::default()
                .event("message")
                .data(result_json.to_string()),
        ),
        Ok::<Event, Infallible>(Event::default().data("[DONE]")),
    ];
    let stream = futures::stream::iter(events);

    Ok(Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response())
}

async fn btree_deploy(
    State(state): State<AppState>,
    Json(req): Json<BTreeDeployRequest>,
) -> Result<Response, ApiError> {
    // Validate tree first
    let parser = igris_btree::parser::JsonTreeParser::new();
    let context = BTreeContext::new();
    parser
        .parse_node(&req.tree, &context)
        .map_err(|e| ApiError::BadRequest(format!("Invalid tree: {}", e)))?;

    // Persist to redb BTreeStore
    let entry = serde_json::json!({
        "name": req.name,
        "description": req.description,
        "tree": req.tree,
        "deployed_at": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    });
    state
        .storage
        .set(igris_core::storage::BTREE_STORE, &req.name, &entry)
        .map_err(|e| ApiError::InternalError(format!("Failed to persist tree: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "deployed": true,
            "name": req.name,
            "description": req.description,
        })),
    )
        .into_response())
}

/// Planning endpoint - execute multi-step tasks with optional tool usage
#[utoipa::path(
    post,
    path = "/v1/plan",
    tag = "planning",
    request_body = PlanningRequest,
    responses(
        (status = 200, description = "Planning completed", body = PlanningResponse),
        (status = 400, description = "Bad request", body = ErrorResponse),
        (status = 503, description = "Service unavailable", body = ErrorResponse)
    )
)]
async fn plan_endpoint(
    State(state): State<AppState>,
    Json(req): Json<PlanningRequest>,
) -> Result<Response, ApiError> {
    // Check if local provider is available
    let Some(local_provider) = &state.local_provider else {
        return Err(ApiError::ServiceUnavailable(
            "Planning requires local LLM to be enabled".to_string(),
        ));
    };

    // Get planning config with user overrides
    let mut config = state.planning_config.clone().unwrap_or_default();
    if let Some(max_steps) = req.max_steps {
        config.max_steps = max_steps;
    }
    if let Some(enable_tools) = req.enable_tools {
        config.enable_tools = enable_tools;
    }

    // Create planning agent with local LLM provider
    let llm_provider: Arc<dyn igris_reflection::LLMProvider> =
        Arc::new(LocalProviderReflectionLLM {
            provider: local_provider.clone(),
        });

    let agent = if config.enable_tools {
        PlanningAgent::with_provider(config, llm_provider, state.tool_registry.clone())
    } else {
        PlanningAgent::with_provider(config, llm_provider, None)
    };

    info!("Executing planning task: {}", req.goal);
    let result = agent.execute_plan(&req.goal).await?;

    let steps_json: Vec<serde_json::Value> = result
        .steps
        .iter()
        .map(|s| serde_json::to_value(s).unwrap_or(serde_json::json!({})))
        .collect();

    let response = PlanningResponse {
        goal: result.goal,
        success: result.success,
        total_steps: result.total_steps,
        final_answer: result.final_answer,
        steps: steps_json,
    };

    Ok((StatusCode::OK, Json(response)).into_response())
}

/// Reflection endpoint - iteratively improve responses through self-critique
#[utoipa::path(
    post,
    path = "/v1/reflect",
    tag = "reflection",
    request_body = ReflectionRequest,
    responses(
        (status = 200, description = "Reflection completed", body = ReflectionResponse),
        (status = 400, description = "Bad request", body = ErrorResponse),
        (status = 503, description = "Service unavailable", body = ErrorResponse)
    )
)]
async fn reflect_endpoint(
    State(state): State<AppState>,
    Json(req): Json<ReflectionRequest>,
) -> Result<Response, ApiError> {
    // Check if local provider is available
    let Some(local_provider) = &state.local_provider else {
        return Err(ApiError::ServiceUnavailable(
            "Reflection requires local LLM to be enabled".to_string(),
        ));
    };

    // Get reflection config with user overrides
    let mut config = state.reflection_config.clone().unwrap_or_default();
    if let Some(max_iterations) = req.max_iterations {
        config.max_iterations = max_iterations;
    }
    if let Some(quality_threshold) = req.quality_threshold {
        config.quality_threshold = quality_threshold;
    }

    // Create reflection agent with local LLM provider
    let llm_provider: Arc<dyn igris_reflection::LLMProvider> =
        Arc::new(LocalProviderReflectionLLM {
            provider: local_provider.clone(),
        });

    let agent = ReflectionAgent::new(config, llm_provider);

    info!("Executing reflection task: {} chars", req.prompt.len());
    let result = agent.reflect(&req.prompt).await?;

    let iterations_json: Vec<serde_json::Value> = result
        .iterations
        .iter()
        .map(|i| serde_json::to_value(i).unwrap_or(serde_json::json!({})))
        .collect();

    let response = ReflectionResponse {
        final_response: result.final_response,
        total_iterations: result.total_iterations,
        final_score: result.final_score,
        threshold_met: result.threshold_met,
        iterations: iterations_json,
    };

    Ok((StatusCode::OK, Json(response)).into_response())
}

/// Chat completions endpoint with local LLM fallback
#[utoipa::path(
    post,
    path = "/v1/chat/completions",
    tag = "chat",
    request_body = ChatCompletionRequest,
    responses(
        (status = 200, description = "Successful completion", body = ChatCompletionResponse),
        (status = 400, description = "Bad request", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
async fn chat_completions(
    State(state): State<AppState>,
    Json(req): Json<ChatCompletionRequest>,
) -> Result<Response, ApiError> {
    state
        .metrics
        .chat_requests_total
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    info!(
        "Chat completion request: model={}, messages={}, mode={:?}",
        req.model,
        req.messages.len(),
        req.mode
    );

    // Validate request
    if req.messages.is_empty() {
        return Err(ApiError::BadRequest(
            "messages array cannot be empty".to_string(),
        ));
    }
    if req.messages.len() > 64 {
        return Err(ApiError::BadRequest(
            "too many messages (max 64)".to_string(),
        ));
    }
    if req.model.len() > 128 {
        return Err(ApiError::BadRequest(
            "model identifier too long".to_string(),
        ));
    }
    let mut total_chars: usize = 0;
    for m in &req.messages {
        if m.role.len() > 32 {
            return Err(ApiError::BadRequest("role too long".to_string()));
        }
        if m.content.len() > 16_384 {
            return Err(ApiError::BadRequest(
                "message content too long (max 16384 chars)".to_string(),
            ));
        }
        total_chars = total_chars.saturating_add(m.role.len() + m.content.len());
        if total_chars > 65_536 {
            return Err(ApiError::BadRequest(
                "request too large (max 65536 chars total)".to_string(),
            ));
        }
    }

    // Build prompt from messages
    let prompt = req
        .messages
        .iter()
        .map(|msg| format!("{}: {}", msg.role, msg.content))
        .collect::<Vec<_>>()
        .join("\n");

    let est_prompt_tokens = (prompt.len() as u32) / 4;

    // Streaming (SSE): only supported for base chat mode (no reflection/tools/planning/swarm).
    if req.stream == Some(true) {
        state
            .metrics
            .chat_stream_requests_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if req.mode.is_some() {
            return Err(ApiError::NotImplemented(
                "Streaming is currently only supported for base chat mode (omit `mode`)"
                    .to_string(),
            ));
        }

        // 1) Try cloud providers first using speculative routing (stream winner).
        if !state.cloud_providers.is_empty() {
            let providers: Vec<CloudProviderWrapper> = state
                .cloud_providers
                .iter()
                .take(3)
                .map(|p| CloudProviderWrapper(p.clone()))
                .collect();

            match state
                .speculative_router
                .route_stream(&prompt, providers)
                .await
            {
                Ok(stream_result) => {
                    let model = req.model.clone();
                    let s = stream_result.stream.map(move |chunk| {
                        let ev = match chunk {
                            Ok(text) => {
                                let payload = serde_json::json!({
                                    "id": "chatcmpl-stream",
                                    "object": "chat.completion.chunk",
                                    "model": model.clone(),
                                    "choices": [{
                                        "index": 0,
                                        "delta": { "content": text },
                                        "finish_reason": null
                                    }]
                                });
                                Event::default().data(payload.to_string())
                            }
                            Err(e) => {
                                let payload = serde_json::json!({
                                    "id": "chatcmpl-stream",
                                    "object": "error",
                                    "error": { "message": e.to_string(), "type": "stream_error" }
                                });
                                Event::default().data(payload.to_string())
                            }
                        };
                        Ok::<Event, Infallible>(ev)
                    });

                    let done = futures::stream::once(async move {
                        Ok::<Event, Infallible>(Event::default().data("[DONE]"))
                    });

                    let out = Sse::new(s.chain(done)).keep_alive(KeepAlive::default());
                    return Ok(out.into_response());
                }
                Err(e) => {
                    warn!(
                        "Cloud streaming failed, falling back to local if available: {}",
                        e
                    );
                }
            }
        }

        // 2) Fallback to local provider if available.
        if let Some(local_provider) = &state.local_provider {
            let model = "local".to_string();
            let stream = local_provider.stream(&prompt).await?;
            let s = stream.map(move |chunk| {
                let ev = match chunk {
                    Ok(text) => {
                        let payload = serde_json::json!({
                            "id": "chatcmpl-stream",
                            "object": "chat.completion.chunk",
                            "model": model.clone(),
                            "choices": [{
                                "index": 0,
                                "delta": { "content": text },
                                "finish_reason": null
                            }]
                        });
                        Event::default().data(payload.to_string())
                    }
                    Err(e) => {
                        let payload = serde_json::json!({
                            "id": "chatcmpl-stream",
                            "object": "error",
                            "error": { "message": e.to_string(), "type": "stream_error" }
                        });
                        Event::default().data(payload.to_string())
                    }
                };
                Ok::<Event, Infallible>(ev)
            });

            let done = futures::stream::once(async move {
                Ok::<Event, Infallible>(Event::default().data("[DONE]"))
            });

            let out = Sse::new(s.chain(done)).keep_alive(KeepAlive::default());
            return Ok(out.into_response());
        }

        return Err(ApiError::InternalError(
            "Streaming requested but no providers are available".to_string(),
        ));
    }

    // Reflection mode (Phase 2): generate -> critique -> regenerate loops with real LLM calls.
    let reflection_enabled_by_config = state
        .config
        .reflection
        .as_ref()
        .map(|r| r.enabled)
        .unwrap_or(false);
    let reflection_requested = matches!(req.mode.as_deref(), Some("reflection"));
    let use_reflection = reflection_requested || reflection_enabled_by_config;

    if use_reflection {
        let reflection_cfg = state.reflection_config.clone().unwrap_or_default();

        // Choose the provider for reflection:
        // - Prefer local LLM if available (offline-capable, deterministic deployment).
        // - Otherwise use the first configured cloud provider.
        let provider: Arc<dyn ReflectionLLMProvider> = if let Some(local) = &state.local_provider {
            Arc::new(LocalProviderReflectionLLM {
                provider: local.clone(),
            })
        } else if let Some(first_cloud) = state.cloud_providers.first() {
            Arc::new(CloudProviderReflectionLLM(first_cloud.clone()))
        } else {
            return Err(ApiError::InternalError(
                "Reflection requested but no providers are available".to_string(),
            ));
        };

        let agent = ReflectionAgent::new(reflection_cfg, provider);
        let result = agent.reflect(&prompt).await?;
        let final_response_text = result.final_response.clone();
        let est_completion_tokens = (result.final_response.len() as u32) / 4;

        let response = ChatCompletionResponse {
            id: format!("chatcmpl-{}", uuid::Uuid::new_v4()),
            object: "chat.completion".to_string(),
            created: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            model: req.model.clone(),
            choices: vec![ChatCompletionChoice {
                index: 0,
                message: ChatMessage {
                    role: "assistant".to_string(),
                    content: final_response_text.clone(),
                },
                finish_reason: "stop".to_string(),
            }],
            usage: Usage {
                prompt_tokens: est_prompt_tokens,
                completion_tokens: est_completion_tokens,
                total_tokens: est_prompt_tokens + est_completion_tokens,
            },
            metadata: None,
        };

        if let Some(mgr) = &state.lora_training {
            let _ = mgr.record_example(
                prompt.clone(),
                final_response_text,
                "reflection".to_string(),
            );
            let _ = mgr.maybe_trigger_background_training().await;
        }

        return Ok(Json(response).into_response());
    }

    // Tool mode (Phase 3): LLM-driven tool calling loop.
    if matches!(req.mode.as_deref(), Some("tools")) {
        let registry = state.tool_registry.clone().ok_or_else(|| {
            ApiError::BadRequest("Tool mode requested but tools are disabled in config".to_string())
        })?;

        // Prefer local provider for tool mode (offline); otherwise first cloud provider.
        let provider: Arc<dyn ReflectionLLMProvider> = if let Some(local) = &state.local_provider {
            Arc::new(LocalProviderReflectionLLM {
                provider: local.clone(),
            })
        } else if let Some(first_cloud) = state.cloud_providers.first() {
            Arc::new(CloudProviderReflectionLLM(first_cloud.clone()))
        } else {
            return Err(ApiError::InternalError(
                "Tool mode requested but no providers are available".to_string(),
            ));
        };

        let agent = ToolAgent::new(
            provider,
            registry,
            state.tool_max_steps,
            state.tool_max_concurrent,
            state.tool_timeout_ms,
        );

        let final_text = agent.run(&prompt).await?;
        let est_completion_tokens = (final_text.len() as u32) / 4;

        let response = ChatCompletionResponse {
            id: format!("chatcmpl-{}", uuid::Uuid::new_v4()),
            object: "chat.completion".to_string(),
            created: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            model: req.model.clone(),
            choices: vec![ChatCompletionChoice {
                index: 0,
                message: ChatMessage {
                    role: "assistant".to_string(),
                    content: final_text.clone(),
                },
                finish_reason: "stop".to_string(),
            }],
            usage: Usage {
                prompt_tokens: est_prompt_tokens,
                completion_tokens: est_completion_tokens,
                total_tokens: est_prompt_tokens + est_completion_tokens,
            },
            metadata: None,
        };

        if let Some(mgr) = &state.lora_training {
            let _ = mgr.record_example(prompt.clone(), final_text, "tools".to_string());
            let _ = mgr.maybe_trigger_background_training().await;
        }

        return Ok(Json(response).into_response());
    }

    // Planning mode (Phase 4): Plan -> Act -> Observe -> Reflect with optional tools.
    let planning_enabled_by_config = state
        .config
        .planning
        .as_ref()
        .map(|p| p.enabled)
        .unwrap_or(false);
    let planning_requested = matches!(req.mode.as_deref(), Some("planning"));
    let use_planning = planning_requested || planning_enabled_by_config;

    if use_planning {
        let cfg = state.planning_config.clone().unwrap_or_default();
        let registry = state.tool_registry.clone();

        let provider: Arc<dyn ReflectionLLMProvider> = if let Some(local) = &state.local_provider {
            Arc::new(LocalProviderReflectionLLM {
                provider: local.clone(),
            })
        } else if let Some(first_cloud) = state.cloud_providers.first() {
            Arc::new(CloudProviderReflectionLLM(first_cloud.clone()))
        } else {
            return Err(ApiError::InternalError(
                "Planning requested but no providers are available".to_string(),
            ));
        };

        let agent = PlanningAgent::with_provider(cfg, provider, registry);
        let result = agent.execute_plan(&prompt).await?;
        let final_answer_text = result.final_answer.clone();
        let est_completion_tokens = (result.final_answer.len() as u32) / 4;

        let response = ChatCompletionResponse {
            id: format!("chatcmpl-{}", uuid::Uuid::new_v4()),
            object: "chat.completion".to_string(),
            created: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            model: req.model.clone(),
            choices: vec![ChatCompletionChoice {
                index: 0,
                message: ChatMessage {
                    role: "assistant".to_string(),
                    content: final_answer_text.clone(),
                },
                finish_reason: "stop".to_string(),
            }],
            usage: Usage {
                prompt_tokens: est_prompt_tokens,
                completion_tokens: est_completion_tokens,
                total_tokens: est_prompt_tokens + est_completion_tokens,
            },
            metadata: None,
        };

        if let Some(mgr) = &state.lora_training {
            let _ = mgr.record_example(prompt.clone(), final_answer_text, "planning".to_string());
            let _ = mgr.maybe_trigger_background_training().await;
        }

        return Ok(Json(response).into_response());
    }

    // Swarm mode (Phase 5): spawn multiple role agents, store to MCP context, synthesize.
    let swarm_enabled_by_config = state
        .config
        .swarm
        .as_ref()
        .map(|s| s.enabled)
        .unwrap_or(false);
    let swarm_requested = matches!(req.mode.as_deref(), Some("swarm"));
    let use_swarm = swarm_requested || swarm_enabled_by_config;

    if use_swarm {
        let cfg = state.swarm_config.clone().unwrap_or(SwarmConfig {
            size: 10,
            max_concurrent: 4,
            agent_timeout_ms: 60_000,
            dynamic_roles: false,
            enable_bus: false,
            consensus_candidates: 1,
        });

        let provider: Arc<dyn ReflectionLLMProvider> = if let Some(local) = &state.local_provider {
            Arc::new(LocalProviderReflectionLLM {
                provider: local.clone(),
            })
        } else if let Some(first_cloud) = state.cloud_providers.first() {
            Arc::new(CloudProviderReflectionLLM(first_cloud.clone()))
        } else {
            return Err(ApiError::InternalError(
                "Swarm requested but no providers are available".to_string(),
            ));
        };

        let conversation_id = format!("swarm-{}", uuid::Uuid::new_v4());
        let final_text = run_swarm(
            cfg,
            provider,
            state.mcp_context_store.clone(),
            conversation_id,
            state.swarm_peer_id.clone(),
            &prompt,
        )
        .await?;

        let est_completion_tokens = (final_text.len() as u32) / 4;

        let response = ChatCompletionResponse {
            id: format!("chatcmpl-{}", uuid::Uuid::new_v4()),
            object: "chat.completion".to_string(),
            created: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            model: req.model.clone(),
            choices: vec![ChatCompletionChoice {
                index: 0,
                message: ChatMessage {
                    role: "assistant".to_string(),
                    content: final_text.clone(),
                },
                finish_reason: "stop".to_string(),
            }],
            usage: Usage {
                prompt_tokens: est_prompt_tokens,
                completion_tokens: est_completion_tokens,
                total_tokens: est_prompt_tokens + est_completion_tokens,
            },
            metadata: None,
        };

        if let Some(mgr) = &state.lora_training {
            let _ = mgr.record_example(prompt.clone(), final_text, "swarm".to_string());
            let _ = mgr.maybe_trigger_background_training().await;
        }

        return Ok(Json(response).into_response());
    }

    // Try cloud providers first using speculative routing
    let mut response_text = None;
    let mut used_provider = "unknown".to_string();
    let mut used_local_fallback = false;

    if !state.cloud_providers.is_empty() {
        info!("Attempting cloud providers with speculative routing");

        // Convert cloud providers to wrappers
        let providers: Vec<CloudProviderWrapper> = state
            .cloud_providers
            .iter()
            .take(3) // Use top 3 providers for speculative routing
            .map(|p| CloudProviderWrapper(p.clone()))
            .collect();

        if let Ok(result) = state.speculative_router.route(&prompt, providers).await {
            info!(
                "Cloud provider succeeded: {} ({}ms)",
                result.winner_id, result.total_latency_ms
            );
            response_text = Some(result.response);
            used_provider = result.winner_id;
        } else {
            warn!("All cloud providers failed or timed out");
        }
    }

    // Fallback to local LLM if cloud providers failed
    if response_text.is_none() && state.local_provider.is_some() {
        info!("Cloud providers failed, falling back to local LLM");
        used_local_fallback = true;

        if let Some(local_provider) = &state.local_provider {
            match local_provider.complete(&prompt).await {
                Ok(result) => {
                    info!("Local LLM succeeded");
                    response_text = Some(result);
                    used_provider = local_provider.id().to_string();
                }
                Err(e) => {
                    error!("Local LLM also failed: {}", e);
                    return Err(ApiError::InternalError(format!(
                        "All providers failed. Last error: {}",
                        e
                    )));
                }
            }
        }
    }

    // If we still don't have a response, try EscapeVector cache as final fallback
    let mut from_cache = false;
    let mut cache_metadata: Option<(u64, f32)> = None; // (age, quality_score)

    let response_text = if let Some(text) = response_text {
        text
    } else {
        // All providers failed - check EscapeVector cache
        if let Some(cache) = &state.escapevector_cache {
            info!("All providers failed, checking EscapeVector cache for graceful degradation");
            match cache.load_response(&prompt) {
                Ok(Some(cached)) => {
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                    let cache_age = now - cached.cached_at;

                    info!(
                        "EscapeVector cache hit! Serving cached response (age: {}s, quality: {:.2}, hits: {})",
                        cache_age,
                        cached.quality_score,
                        cached.hit_count
                    );

                    from_cache = true;
                    cache_metadata = Some((cache_age, cached.quality_score));
                    used_provider = format!("escapevector-cache:{}", cached.model);
                    cached.response_text
                }
                Ok(None) => {
                    error!("All providers failed and no cached response available");
                    return Err(ApiError::ServiceUnavailable(
                        "All AI providers are currently unavailable. Please try again in a few moments.".to_string()
                    ));
                }
                Err(e) => {
                    error!("Failed to load EscapeVector cache: {}", e);
                    return Err(ApiError::ServiceUnavailable(
                        "All AI providers are currently unavailable. Please try again in a few moments.".to_string()
                    ));
                }
            }
        } else {
            error!("All providers failed and EscapeVector cache not available");
            return Err(ApiError::ServiceUnavailable(
                "All AI providers are currently unavailable. Please try again in a few moments."
                    .to_string(),
            ));
        }
    };
    let response_text_for_record = response_text.clone();

    let completion_tokens_est = (response_text.len() as u32) / 4;

    // Build metadata if serving from cache or in degraded mode
    let metadata = if from_cache {
        Some(ResponseMetadata {
            degraded: true,
            source: used_provider.clone(),
            cache_age_seconds: cache_metadata.map(|(age, _)| age),
            quality_score: cache_metadata.map(|(_, quality)| quality),
        })
    } else {
        None
    };

    let response = ChatCompletionResponse {
        id: format!("chatcmpl-{}", uuid::Uuid::new_v4()),
        object: "chat.completion".to_string(),
        created: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        model: if used_local_fallback {
            "phi-3-mini-4k (local)".to_string()
        } else {
            req.model.clone()
        },
        choices: vec![ChatCompletionChoice {
            index: 0,
            message: ChatMessage {
                role: "assistant".to_string(),
                content: response_text,
            },
            finish_reason: "stop".to_string(),
        }],
        usage: Usage {
            prompt_tokens: est_prompt_tokens, // Rough estimate
            completion_tokens: completion_tokens_est,
            total_tokens: est_prompt_tokens + completion_tokens_est,
        },
        metadata,
    };

    // Record for LoRA training if enabled
    if let Some(mgr) = &state.lora_training {
        let _ = mgr.record_example(
            prompt.clone(),
            response_text_for_record.clone(),
            used_provider.clone(),
        );
        let _ = mgr.maybe_trigger_background_training().await;
    }

    // Cache successful response for EscapeVector graceful degradation
    if let Some(cache) = &state.escapevector_cache {
        if let Some(ev_config) = &state.config.escapevector {
            if ev_config.auto_cache && !used_local_fallback {
                // Calculate quality score based on response characteristics
                let quality_score = if used_provider.starts_with("escapevector-cache") {
                    0.5 // Cached responses get lower quality for re-caching
                } else {
                    // Higher quality for cloud providers
                    0.85
                };

                if quality_score >= ev_config.min_quality_score {
                    match cache.save_response(
                        &prompt,
                        &response_text_for_record,
                        &used_provider,
                        quality_score,
                    ) {
                        Ok(_) => {
                            info!(
                                "Cached response for EscapeVector (quality: {:.2})",
                                quality_score
                            );
                        }
                        Err(e) => {
                            warn!("Failed to cache response: {}", e);
                        }
                    }
                }
            }
        }
    }

    Ok(Json(response).into_response())
}

// Wrapper to allow CloudProvider to be cloned in Box<dyn Provider>
#[derive(Clone)]
pub(crate) struct CloudProviderWrapper(CloudProvider);

impl Provider for CloudProviderWrapper {
    fn id(&self) -> &str {
        self.0.id()
    }

    fn name(&self) -> &str {
        self.0.name()
    }

    async fn stream(
        &self,
        prompt: &str,
    ) -> anyhow::Result<
        std::pin::Pin<Box<dyn futures::Stream<Item = Result<String, anyhow::Error>> + Send>>,
    > {
        self.0.stream(prompt).await
    }

    async fn complete(&self, prompt: &str) -> anyhow::Result<String> {
        self.0.complete(prompt).await
    }
}

fn load_worker_config(config_path: &str) -> anyhow::Result<IgrisConfig> {
    if std::path::Path::new(config_path).exists() {
        IgrisConfig::load_from_file_unvalidated(config_path)
    } else {
        Ok(IgrisConfig::default())
    }
}

fn build_worker_route_context(config: &IgrisConfig) -> runtime_execute::RouteExecutionContext {
    let cloud_providers: Vec<CloudProvider> = config
        .providers
        .iter()
        .map(|provider| CloudProvider::new(provider.clone()))
        .collect();

    let local_provider = config.local_fallback.as_ref().and_then(|local_config| {
        if !local_config.enabled {
            return None;
        }

        let llm_config = LocalLLMConfig {
            enabled: local_config.enabled,
            selected_model: None,
            model_path: local_config.model_path.clone(),
            lora_adapter_path: local_config.lora_adapter_path.clone(),
            n_gpu_layers: local_config.n_gpu_layers,
            main_gpu: local_config.main_gpu,
            prompt_cache_dir: local_config.prompt_cache_dir.clone(),
            batch_size: local_config.batch_size,
            context_size: local_config.context_size,
            threads: local_config.threads,
            max_tokens: local_config.max_tokens,
            temperature: local_config.temperature,
            cost_per_1k_tokens: local_config.cost_per_1k_tokens,
        };

        match LocalLLMProviderAdapter::new(llm_config) {
            Ok(adapter) => Some(Arc::new(LocalProvider::new(adapter))),
            Err(e) => {
                warn!("[Runtime/Worker] Local provider unavailable: {}", e);
                None
            }
        }
    });

    runtime_execute::RouteExecutionContext {
        speculative_router: Arc::new(SpeculativeRouter::new(3, std::time::Duration::from_secs(5))),
        thompson_router: Arc::new(ThompsonSamplingRouter::new(
            cloud_providers
                .iter()
                .map(|provider| provider.id().to_string())
                .collect(),
            0.1,
        )),
        council_router: Arc::new(CouncilRouter::new(
            cloud_providers
                .first()
                .map(|provider| provider.id().to_string())
                .unwrap_or_else(|| "local".to_string()),
        )),
        cloud_providers: Arc::new(cloud_providers),
        local_provider,
    }
}

async fn run_contained_worker_mode() -> anyhow::Result<()> {
    let config_path = std::env::var("IGRIS_CONFIG").unwrap_or_else(|_| "config.json5".to_string());
    let mut route_context: Option<runtime_execute::RouteExecutionContext> = None;

    let stdin = tokio::io::stdin();
    let mut lines = tokio::io::BufReader::new(stdin).lines();
    let mut stdout = tokio::io::stdout();

    while let Some(line) = lines.next_line().await? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = match serde_json::from_str::<runtime_execute::WorkerExecuteJob>(trimmed) {
            Ok(job) => {
                if job.kind == "route" && route_context.is_none() {
                    let config = load_worker_config(&config_path)?;
                    route_context = Some(build_worker_route_context(&config));
                }

                match runtime_execute::execute_worker_job(route_context.as_ref(), job).await {
                    Ok(result) => serde_json::json!({
                        "status": "ok",
                        "result": result,
                    }),
                    Err(err) => serde_json::json!({
                        "status": "error",
                        "error": err.to_string(),
                    }),
                }
            }
            Err(err) => serde_json::json!({
                "status": "error",
                "error": format!("invalid worker payload: {}", err),
            }),
        };

        stdout.write_all(response.to_string().as_bytes()).await?;
        stdout.write_all(b"\n").await?;
        stdout.flush().await?;
    }

    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if igris_safety::is_worker_mode() {
        return run_contained_worker_mode().await;
    }

    #[derive(Debug, Parser)]
    #[command(
        name = "igris-runtime",
        version,
        about = "Igris Runtime v1.6 server + CLI"
    )]
    struct Cli {
        /// Path to config file (overrides IGRIS_CONFIG)
        #[arg(long, global = true)]
        config: Option<String>,

        #[command(subcommand)]
        command: Option<Command>,
    }

    #[derive(Debug, Subcommand)]
    enum Command {
        /// Start the HTTP server (default)
        Serve,
        /// Validate a config.json5 file and exit
        ValidateConfig,
        /// Ping /v1/health and exit
        Health {
            #[arg(long, default_value = "http://localhost:8080")]
            url: String,
        },
        /// Fetch /metrics and print (status + first lines)
        Metrics {
            #[arg(long, default_value = "http://localhost:8080")]
            url: String,
        },
        /// Show status (health + LoRA status + metrics status)
        Status {
            #[arg(long, default_value = "http://localhost:8080")]
            url: String,
        },
        /// Send a chat request to a running server
        Chat {
            prompt: String,
            #[arg(long, default_value = "http://localhost:8080")]
            url: String,
            #[arg(long, default_value = "gpt-4")]
            model: String,
            #[arg(long)]
            stream: bool,
        },
        /// Download a GGUF model via the existing script (requires bash + curl/wget)
        DownloadModel {
            #[arg(long, default_value = "./download-model.sh")]
            script: String,
        },
    }

    let cli = Cli::parse();
    if let Some(cfg) = cli.config.as_ref() {
        std::env::set_var("IGRIS_CONFIG", cfg);
    }

    match cli.command.unwrap_or(Command::Serve) {
        Command::Serve => {}
        Command::ValidateConfig => {
            let config_path =
                std::env::var("IGRIS_CONFIG").unwrap_or_else(|_| "config.json5".to_string());
            let security_policy = RuntimeSecurityPolicy::from_env();
            match load_runtime_config(&config_path).and_then(|config| {
                validate_runtime_security_config(
                    &config,
                    security_policy,
                    load_overture_public_key().is_some(),
                )?;
                Ok(config)
            }) {
                Ok(_) => {
                    println!("OK: config valid ({})", config_path);
                    return Ok(());
                }
                Err(e) => {
                    eprintln!("ERROR: config invalid ({}): {}", config_path, e);
                    std::process::exit(1);
                }
            }
        }
        Command::Health { url } => {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()?;
            let resp = client.get(format!("{}/v1/health", url)).send().await?;
            if !resp.status().is_success() {
                anyhow::bail!("health check failed: {}", resp.status());
            }
            println!("OK");
            return Ok(());
        }
        Command::Metrics { url } => {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()?;
            let resp = client.get(format!("{}/metrics", url)).send().await?;
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            println!("status: {}", status);
            for line in body.lines().take(20) {
                println!("{}", line);
            }
            return Ok(());
        }
        Command::Status { url } => {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()?;
            let health = client.get(format!("{}/v1/health", url)).send().await?;
            println!("health: {}", health.status());
            let lora = client.get(format!("{}/v1/lora/status", url)).send().await;
            match lora {
                Ok(resp) => println!("lora_status: {}", resp.status()),
                Err(e) => println!("lora_status: error: {}", e),
            }
            let metrics = client.get(format!("{}/metrics", url)).send().await;
            match metrics {
                Ok(resp) => println!("metrics: {}", resp.status()),
                Err(e) => println!("metrics: error: {}", e),
            }
            return Ok(());
        }
        Command::Chat {
            prompt,
            url,
            model,
            stream,
        } => {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()?;
            let body = serde_json::json!({
                "model": model,
                "messages": [{ "role": "user", "content": prompt }],
                "stream": stream
            });
            let resp = client
                .post(format!("{}/v1/chat/completions", url))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await?;
            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                anyhow::bail!("request failed: {} {}", status, text);
            }
            if !stream {
                let v: serde_json::Value = resp.json().await?;
                let out = v["choices"][0]["message"]["content"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                println!("{}", out);
                return Ok(());
            }
            let mut bytes = resp.bytes_stream();
            let mut buf: Vec<u8> = Vec::with_capacity(16 * 1024);
            while let Some(next) = bytes.next().await {
                let chunk = next?;
                buf.extend_from_slice(&chunk);
                while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                    let mut line = buf.drain(..=pos).collect::<Vec<u8>>();
                    if line.last() == Some(&b'\n') {
                        line.pop();
                    }
                    if line.last() == Some(&b'\r') {
                        line.pop();
                    }
                    if line.is_empty() {
                        continue;
                    }
                    let line = String::from_utf8_lossy(&line);
                    let line = line.trim();
                    if !line.starts_with("data:") {
                        continue;
                    }
                    let data = line.trim_start_matches("data:").trim();
                    if data == "[DONE]" {
                        println!();
                        return Ok(());
                    }
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(delta) = v
                            .get("choices")
                            .and_then(|c| c.get(0))
                            .and_then(|c0| c0.get("delta"))
                            .and_then(|d| d.get("content"))
                            .and_then(|x| x.as_str())
                        {
                            print!("{}", delta);
                            use std::io::Write;
                            let _ = std::io::stdout().flush();
                        }
                    }
                }
            }
            println!();
            return Ok(());
        }
        Command::DownloadModel { script } => {
            let status = std::process::Command::new("bash")
                .arg(script)
                .status()
                .map_err(|e| anyhow::anyhow!("failed to run download script via bash: {}", e))?;
            if !status.success() {
                anyhow::bail!("download-model.sh failed with {}", status);
            }
            return Ok(());
        }
    }

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                "igris_server=info,igris_routing=info,igris_core=info,igris_local_llm=info".into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Igris Runtime v1.6 starting...");

    // Load configuration
    let config_path = std::env::var("IGRIS_CONFIG").unwrap_or_else(|_| "config.json5".to_string());

    info!("Loading configuration from: {}", config_path);

    let security_policy = RuntimeSecurityPolicy::from_env();
    let config = load_runtime_config(&config_path)?;

    info!("Config loaded successfully");

    if security_policy.allow_insecure_dev_mode {
        warn!(
            "[Runtime/Security] IGRIS_ALLOW_INSECURE_DEV_MODE=true disables self-serve boot hardening; use for local development only"
        );
    }

    let config = config;
    let overture_public_key = load_overture_public_key();
    validate_runtime_security_config(&config, security_policy, overture_public_key.is_some())?;
    if overture_public_key.is_some() {
        info!(
            "[Runtime/Security] Overture public key loaded — decision signatures will be verified"
        );
    } else if !security_policy.runtime_submission_api_enabled {
        info!(
            "[Runtime/Security] Runtime submission API disabled — Overture decision key not required"
        );
    }

    let runtime_identity = load_or_create_runtime_identity()?;
    let runtime_public_key = runtime_identity.public_key_hex.clone();
    let signing_key = runtime_identity.signing_key;
    info!(
        "[Runtime/Identity] Ed25519 verifying key: {}",
        &runtime_public_key[..16]
    );

    // License validation (REQUIRED unless a valid signed offline artifact is present)
    let license_key = std::env::var("IGRIS_LICENSE_KEY").ok();
    let startup_license = match igris_license_client::validate_license_on_startup(license_key.as_deref()).await {
        Ok(result) => result,
        Err(e) => {
            error!("────────────────────────────────────────────────");
            error!("LICENSE VALIDATION FAILED");
            error!("────────────────────────────────────────────────");
            error!("{}", e);
            error!("");
            error!("Igris Platform requires a valid online license or signed offline artifact to run.");
            error!("");
            error!("Online startup:");
            error!("export IGRIS_LICENSE_KEY=lic_xxxxx_xxxxx");
            error!("");
            error!("Offline startup:");
            error!("set IGRIS_OFFLINE_LICENSE_PATH to a signed artifact and configure IGRIS_OVERTURE_PUBLIC_KEY or IGRIS_LICENSE_OFFLINE_PUBLIC_KEY");
            error!("────────────────────────────────────────────────");
            std::process::exit(1);
        }
    };

    let license_mode = startup_license.mode.clone();
    let validation = startup_license.validation.clone();
    let license_status = RuntimeLicenseStatus {
        state: license_mode.as_str().to_string(),
        tier: validation.tier.clone(),
        license_expires_at: validation.expires_at.clone(),
        offline_artifact_expires_at: validation.offline_artifact_expires_at.clone(),
    };

    info!("License validated successfully");
    info!(
        "Mode: {} | Tier: {} | Devices: {}/{} | Cloud requests: {}/{}/month",
        license_mode.as_str(),
        validation.tier.as_deref().unwrap_or("unknown"),
        validation.devices_active.unwrap_or(0),
        validation.devices_limit.unwrap_or(0),
        validation.cloud_requests_used.unwrap_or(0),
        validation.cloud_requests_limit.unwrap_or(0)
    );

    if license_mode == igris_license_client::RuntimeLicenseMode::LicensedOnline {
        if let Some(key) = license_key.clone() {
            let key_clone = key;
            let device_id = startup_license.device_id.clone();
            tokio::spawn(async move {
                igris_license_client::start_heartbeat_loop(key_clone, device_id).await;
            });
        }

        // Register this runtime instance with Overture (fleet registry).
        // Uses IGRIS_API_KEY env var; if not set, registration is skipped.
        if let Ok(api_key) = std::env::var("IGRIS_API_KEY") {
            let overture_url = std::env::var("IGRIS_OVERTURE_URL").ok();
            let overture_url_ref = overture_url.as_deref();
            let version = env!("CARGO_PKG_VERSION");
            match igris_license_client::register_runtime_with_overture(
                api_key,
                overture_url_ref,
                version,
                runtime_public_key.clone(),
            )
            .await
            {
                Ok(reg_client) => {
                    info!(
                        "Runtime registered with Overture (machine_id={})",
                        reg_client.machine_id()
                    );
                    let _reg = reg_client;
                }
                Err(e) => {
                    warn!("Fleet registration failed (non-fatal): {}", e);
                }
            }
        } else {
            info!("IGRIS_API_KEY not set — skipping fleet registration (runtime won't appear in dashboard)");
        }
    } else {
        info!("Offline license mode active — skipping license heartbeat and fleet registration");
    }

    // Validate tool configuration (RUNTIME-01: Secure Runtime Defaults)
    if let Some(tools_cfg) = &config.tools {
        if let Err(e) = tools_cfg.validate() {
            error!("{}", e);
            error!("Server startup BLOCKED due to insecure tool configuration.");
            error!("Fix your config file or disable the tool to proceed.");
            std::process::exit(1);
        }
        // Emit security warnings about tool configuration
        tools_cfg.emit_security_warnings();
    }

    // Initialize storage
    let storage_path = config
        .storage
        .as_ref()
        .and_then(|s| s.path.as_deref())
        .unwrap_or("igris.db");

    info!("Initializing storage: {}", storage_path);
    let storage = RedbStorage::new(storage_path)?;
    info!("Storage initialized");

    // Initialize cloud providers
    let cloud_providers: Vec<CloudProvider> = config
        .providers
        .iter()
        .map(|c| CloudProvider::new(c.clone()))
        .collect();

    info!("Loaded {} cloud providers", cloud_providers.len());

    // Initialize local LLM provider if enabled
    let local_provider = if let Some(local_config) = &config.local_fallback {
        if local_config.enabled {
            info!("Local fallback is ENABLED");
            info!("Model path: {}", local_config.model_path);

            let llm_config = LocalLLMConfig {
                enabled: local_config.enabled,
                selected_model: None,
                model_path: local_config.model_path.clone(),
                lora_adapter_path: local_config.lora_adapter_path.clone(),
                n_gpu_layers: local_config.n_gpu_layers,
                main_gpu: local_config.main_gpu,
                prompt_cache_dir: local_config.prompt_cache_dir.clone(),
                batch_size: local_config.batch_size,
                context_size: local_config.context_size,
                threads: local_config.threads,
                max_tokens: local_config.max_tokens,
                temperature: local_config.temperature,
                cost_per_1k_tokens: local_config.cost_per_1k_tokens,
            };

            match LocalLLMProviderAdapter::new(llm_config) {
                Ok(adapter) => {
                    info!("Local LLM provider initialized successfully");
                    Some(Arc::new(LocalProvider::new(adapter)))
                }
                Err(e) => {
                    warn!("Failed to initialize local LLM provider: {}", e);
                    warn!("Local fallback will not be available");
                    None
                }
            }
        } else {
            info!("Local fallback is DISABLED in config");
            None
        }
    } else {
        info!("Local fallback not configured");
        None
    };

    // Initialize routers
    info!("Initializing routing engines...");
    let speculative_router = SpeculativeRouter::new(3, std::time::Duration::from_secs(5));
    let thompson_router = ThompsonSamplingRouter::new(
        cloud_providers
            .iter()
            .map(|provider| provider.id().to_string())
            .collect(),
        config.routing.thompson_sampling.exploration_rate,
    );

    let council_router = CouncilRouter::new("anthropic-sonnet".to_string());

    info!("Routing engines initialized");

    // Check if local provider is available
    let has_local_fallback = local_provider.is_some();

    // Reflection config (optional)
    let reflection_config = config.reflection.as_ref().map(|r| ReflectionLoopConfig {
        max_iterations: r.max_iterations,
        quality_threshold: r.quality_threshold,
        verbose: r.verbose,
        temperature: r.temperature,
        early_stopping: r.early_stopping,
        min_improvement_delta: r.min_improvement_delta,
    });

    // Tools config (optional)
    let tool_registry: Option<Arc<ToolRegistry>> = config.tools.as_ref().and_then(|tcfg| {
        if !tcfg.enabled {
            return None;
        }

        let mut reg = ToolRegistry::new();
        if tcfg.enable_http {
            reg.register(Arc::new(HttpTool::new(tcfg.allowed_http_domains.clone())));
        }
        if tcfg.enable_shell {
            reg.register(Arc::new(ShellTool::new(
                tcfg.allowed_shell_commands.clone(),
                tcfg.allowed_shell_working_dirs.clone(),
            )));
        }
        if tcfg.enable_filesystem {
            reg.register(Arc::new(FileSystemTool::new(
                tcfg.allowed_filesystem_paths.clone(),
            )));
        }

        Some(Arc::new(reg))
    });

    let tool_max_steps: u32 = 8;
    let tool_timeout_ms: u64 = config
        .tools
        .as_ref()
        .map(|t| t.max_execution_time_ms)
        .unwrap_or(30_000);
    let tool_max_concurrent: usize = config
        .tools
        .as_ref()
        .map(|t| t.max_concurrent_executions)
        .unwrap_or(5);

    // LoRA training (Phase 3): record conversations + background fine-tuning + hot-load adapter.
    let lora_training: Option<Arc<LoraTrainingManager>> = config.lora_training.as_ref().and_then(|lc| {
        if !lc.enabled {
            return None;
        }
        let Some(local_cfg) = config.local_fallback.as_ref() else {
            warn!("LoRA training enabled but local_fallback is missing; disabling LoRA training");
            return None;
        };
        if !local_cfg.enabled {
            warn!("LoRA training enabled but local_fallback.enabled=false; disabling LoRA training");
            return None;
        }

        let store_path = std::path::PathBuf::from(&lc.adapter_dir).join("training.db");
        let store = match TrainingDataStore::open(&store_path) {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to open LoRA training store at {}: {}", store_path.display(), e);
                return None;
            }
        };

        let cfg = LoRATrainingConfig {
            enabled: lc.enabled,
            backend: igris_lora_trainer::TrainingBackend::default(),
            trigger_threshold: lc.trigger_threshold,
            max_adapter_size_mb: lc.max_adapter_size_mb,
            lora_rank: lc.lora_rank,
            lora_alpha: lc.lora_alpha,
            epochs: lc.epochs,
            batch_size: lc.batch_size,
            learning_rate: lc.learning_rate,
            adapter_dir: lc.adapter_dir.clone(),
            encrypt_adapters: lc.encrypt_adapters,
            auto_load_adapter: lc.auto_load_adapter,
            max_training_time_secs: lc.max_training_time_secs,
            training_threads: lc.training_threads,
        };

        let manager = LoraTrainingManager::new(
            cfg,
            store,
            std::path::PathBuf::from("llama.cpp"),
            local_cfg.model_path.clone(),
            local_provider.clone(),
        );
        Some(Arc::new(manager))
    });

    if let Some(mgr) = &lora_training {
        if let Err(e) = mgr.maybe_auto_load_latest().await {
            warn!("Failed to auto-load latest LoRA adapter: {}", e);
        }
    }

    // Planning config (optional)
    let planning_config = config.planning.as_ref().map(|p| PlanningConfig {
        max_steps: p.max_steps,
        enable_reflection: p.enable_reflection,
        // Only allow tools if both planning and tools config enable it.
        enable_tools: p.enable_tools && config.tools.as_ref().map(|t| t.enabled).unwrap_or(false),
        max_tool_calls: p.max_tool_calls,
    });

    // Swarm config (optional)
    let swarm_config = config.swarm.as_ref().map(|s| SwarmConfig {
        size: s.size,
        max_concurrent: s.max_concurrent,
        agent_timeout_ms: s.agent_timeout_ms,
        dynamic_roles: s.dynamic_roles,
        enable_bus: s.enable_bus,
        consensus_candidates: s.consensus_candidates,
    });
    let swarm_peer_id = config
        .mcp
        .as_ref()
        .and_then(|m| m.peer_id.clone())
        .unwrap_or_else(|| "igris-local".to_string());

    // Initialize MCP swarm if enabled
    let (mcp_context_store, mcp_router) = if let Some(mcp_config) = &config.mcp {
        if mcp_config.enabled {
            info!("MCP Swarm Mode is ENABLED");

            // Generate or use peer ID
            let peer_id = mcp_config
                .peer_id
                .clone()
                .unwrap_or_else(|| format!("igris-{}", uuid::Uuid::new_v4()));
            info!("Peer ID: {}", peer_id);

            // Initialize context storage
            let context_store = if mcp_config.persist {
                let enc_storage = Arc::new(
                    EncryptedStorage::new(&mcp_config.storage_path, None)
                        .expect("Failed to create encrypted storage"),
                );
                Arc::new(
                    ContextStore::with_storage(enc_storage)
                        .expect("Failed to initialize context store"),
                )
            } else {
                Arc::new(ContextStore::new())
            };

            // Initialize peer discovery
            let discovery = Arc::new(
                PeerDiscovery::new(peer_id.clone(), config.server.port)
                    .expect("Failed to initialize peer discovery"),
            );

            // Start discovery
            discovery
                .clone()
                .start()
                .await
                .expect("Failed to start discovery");

            // Initialize MCP client
            let mcp_client = Arc::new(McpClient::new(peer_id.clone()));

            // Start context broadcaster
            let broadcaster = Arc::new(ContextBroadcaster::new(
                mcp_client.clone(),
                context_store.clone(),
                discovery.clone(),
                peer_id.clone(),
            ));

            tokio::spawn(async move {
                broadcaster.start().await;
            });

            // Build MCP router
            let execution_signer = Arc::new(igris_mcp_server::ExecutionSigner::new());
            info!(
                "MCP execution signer initialized (public key: {})",
                execution_signer.public_key_hex()
            );

            let mcp_state = McpState {
                context_store: context_store.clone(),
                peer_id: peer_id.clone(),
                server_info: ServerInfo {
                    name: "Igris Runtime MCP Server".to_string(),
                    version: "1.2.0".to_string(),
                },
                tool_registry: tool_registry.clone(),
                execution_signer: Some(execution_signer),
            };

            let mcp_router = build_mcp_router(mcp_state);

            info!("MCP Swarm Mode initialized successfully");
            (Some(context_store), Some(mcp_router))
        } else {
            info!("MCP Swarm Mode is DISABLED in config");
            (None, None)
        }
    } else {
        info!("MCP Swarm Mode not configured");
        (None, None)
    };

    // Create application state
    let rate_limiter = if config.auth.enabled && config.auth.rate_limit_per_minute > 0 {
        Some(RateLimiter::new(
            config.auth.rate_limit_per_minute,
            config.auth.rate_limit_burst,
        ))
    } else {
        None
    };

    let metrics = Arc::new(Metrics::new());

    // Initialize EscapeVector cache for graceful degradation (Phase 1, v1.9)
    let escapevector_cache: Option<Arc<EscapeVectorCache>> =
        if let Some(ev_config) = &config.escapevector {
            if ev_config.enabled {
                info!("EscapeVector graceful degradation is ENABLED");
                info!("Cache directory: {}", ev_config.cache_dir);

                // Derive cache encryption key from a stable device identifier
                // In production, this should be derived from a device-specific secret or config
                let mut cache_key = [0u8; 32];
                let key_material = format!("igris-runtime-{}", config.server.port);
                let hash = sha2::Sha256::digest(key_material.as_bytes());
                cache_key.copy_from_slice(&hash[..32]);

                match EscapeVectorCache::new(&ev_config.cache_dir, cache_key) {
                    Ok(cache) => {
                        info!("EscapeVector cache initialized successfully");
                        Some(Arc::new(cache))
                    }
                    Err(e) => {
                        warn!("Failed to initialize EscapeVector cache: {}", e);
                        warn!("Graceful degradation will not be available");
                        None
                    }
                }
            } else {
                info!("EscapeVector graceful degradation is DISABLED in config");
                None
            }
        } else {
            info!("EscapeVector not configured (using default: enabled)");
            // Default behavior: enable with default config
            let cache_dir = ".escapevector";
            let mut cache_key = [0u8; 32];
            let key_material = format!("igris-runtime-{}", config.server.port);
            let hash = sha2::Sha256::digest(key_material.as_bytes());
            cache_key.copy_from_slice(&hash[..32]);

            match EscapeVectorCache::new(cache_dir, cache_key) {
                Ok(cache) => Some(Arc::new(cache)),
                Err(e) => {
                    warn!("Failed to initialize default EscapeVector cache: {}", e);
                    None
                }
            }
        };

    // Initialize Fleet Management (Phase 2, Dev 10)
    let fleet_manager: Option<Arc<FleetManager>> = {
        if let Some(fleet_runtime_config) = &config.fleet {
            if fleet_runtime_config.enabled {
                info!("Fleet Management is ENABLED");
                info!(
                    "Overture endpoint: {}",
                    fleet_runtime_config.overture_endpoint
                );
                info!("Agent ID: {}", fleet_runtime_config.agent_id);

                let api_key = std::env::var(&fleet_runtime_config.api_key_env).ok();
                let fleet_config = igris_fleet::FleetConfig {
                    enabled: fleet_runtime_config.enabled,
                    overture_endpoint: fleet_runtime_config.overture_endpoint.clone(),
                    agent_id: fleet_runtime_config.agent_id.clone(),
                    api_key,
                    enable_tls: fleet_runtime_config.enable_tls,
                    sync_interval_secs: fleet_runtime_config.sync_interval_secs,
                    auto_sync_config: fleet_runtime_config.auto_sync_config,
                    enable_telemetry: fleet_runtime_config.enable_telemetry,
                    telemetry_interval_secs: fleet_runtime_config.telemetry_interval_secs,
                    mock_mode: false,
                };

                match FleetManager::new(fleet_config).await {
                    Ok(mgr) => {
                        info!("Fleet manager initialized");
                        Some(Arc::new(mgr))
                    }
                    Err(e) => {
                        warn!("Failed to initialize fleet manager: {}", e);
                        None
                    }
                }
            } else {
                info!("Fleet Management is DISABLED in config");
                None
            }
        } else {
            info!("Fleet Management not configured");
            None
        }
    };

    // Initialize Federated Learning (always available, just may be disabled)
    let federated_manager: Option<Arc<FederatedManager>> = {
        let fed_config = igris_federated::FederatedConfig {
            enabled: true,
            min_participants: 3,
            ..Default::default()
        };
        let state_dir = ".federated_state";
        match FederatedManager::new(fed_config, state_dir).await {
            Ok(mgr) => {
                info!("Federated Learning coordinator initialized");
                Some(Arc::new(mgr))
            }
            Err(e) => {
                warn!("Federated Learning disabled: {}", e);
                None
            }
        }
    };

    // Initialize Swarm Intelligence
    let swarm_manager: Option<Arc<SwarmManager>> = {
        let agent_id = format!("runtime-{}", &swarm_peer_id[..8.min(swarm_peer_id.len())]);
        match SwarmManager::new(&agent_id).await {
            Ok(mgr) => {
                info!("Swarm coordinator initialized for agent {}", agent_id);
                Some(Arc::new(mgr))
            }
            Err(e) => {
                warn!("Swarm coordination disabled: {}", e);
                None
            }
        }
    };

    // ── Phase 3: Execution receipt log ──────────────────────────────────────
    let receipt_log_path = std::env::var("IGRIS_RECEIPT_LOG")
        .unwrap_or_else(|_| "/var/lib/igris/receipts.jsonl".to_string());
    let receipt_log =
        match receipt::ReceiptLog::open(&receipt_log_path, Some(Arc::new(signing_key.clone())))
            .await
        {
            Ok(log) => {
                info!("[Runtime/Receipt] log={}", receipt_log_path);
                Some(Arc::new(log))
            }
            Err(e) => {
                warn!(
                    "[Runtime/Receipt] Could not open receipt log at {}: {}",
                    receipt_log_path, e
                );
                None
            }
        };

    // ── Phase 4: Lifecycle registry ─────────────────────────────────────────
    let lifecycle_registry = Some(new_lifecycle_registry());

    #[cfg(feature = "memory")]
    let agent_memory: Option<Arc<AgentMemory>> = {
        let enabled = std::env::var("ENABLE_AGENT_MEMORY")
            .map(|value| value != "false")
            .unwrap_or(true);

        if enabled {
            let db_path = std::env::var("IGRIS_MEMORY_DB")
                .unwrap_or_else(|_| ".igris/agent_memory.db".to_string());
            if let Some(parent) = std::path::Path::new(&db_path).parent() {
                if !parent.as_os_str().is_empty() {
                    if let Err(e) = std::fs::create_dir_all(parent) {
                        warn!(
                            "[Memory] Failed to create memory directory {}: {}",
                            parent.display(),
                            e
                        );
                    }
                }
            }

            let max_cache_entries = std::env::var("IGRIS_MEMORY_MAX_CACHE")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(1000);
            let embedding_dim = std::env::var("IGRIS_MEMORY_EMBEDDING_DIM")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(384);

            let cfg = AgentMemoryConfig {
                enabled: true,
                db_path: db_path.clone(),
                max_cache_entries,
                embedding_dim,
            };

            match AgentMemory::new(cfg).await {
                Ok(memory) => {
                    info!("[Memory] Agent memory initialized at {}", db_path);
                    Some(Arc::new(memory))
                }
                Err(e) => {
                    warn!("[Memory] Failed to initialize agent memory: {}", e);
                    None
                }
            }
        } else {
            info!("[Memory] Agent memory disabled by environment");
            None
        }
    };

    #[cfg(feature = "hitl")]
    let hitl_coordinator: Option<Arc<HitlCoordinator>> = {
        let enabled = std::env::var("ENABLE_HITL")
            .map(|value| value != "false")
            .unwrap_or(true);

        if enabled {
            let auto_approve_threshold = std::env::var("HITL_AUTO_APPROVE_THRESHOLD")
                .ok()
                .and_then(|value| value.parse::<f32>().ok())
                .unwrap_or(0.9);
            let timeout_secs = std::env::var("HITL_TIMEOUT_SECS")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(300);
            let config = HitlConfig {
                enabled: true,
                auto_approve_threshold,
                escalation_endpoint: std::env::var("HITL_ESCALATION_ENDPOINT").ok(),
                timeout_secs,
            };

            match HitlCoordinator::new(config).await {
                Ok(coordinator) => {
                    info!("[HITL] Human-in-the-loop coordinator initialized");
                    Some(Arc::new(coordinator))
                }
                Err(e) => {
                    warn!("[HITL] Failed to initialize coordinator: {}", e);
                    None
                }
            }
        } else {
            info!("[HITL] Human-in-the-loop disabled by environment");
            None
        }
    };

    #[cfg_attr(not(feature = "ros2"), allow(unused_mut))]
    let violation_bus = ViolationEventBus::new();

    #[cfg_attr(not(feature = "ros2"), allow(unused_mut))]
    let mut state = AppState {
        config: Arc::new(config),
        storage: Arc::new(storage),
        speculative_router: Arc::new(speculative_router),
        thompson_router: Arc::new(thompson_router),
        council_router: Arc::new(council_router),
        cloud_providers: Arc::new(cloud_providers),
        local_provider,
        mcp_context_store,
        reflection_config,
        tool_registry,
        tool_max_steps,
        tool_timeout_ms,
        tool_max_concurrent,
        planning_config,
        swarm_config,
        swarm_peer_id,
        lora_training,
        federated_manager,
        swarm_manager,
        fleet_manager,
        rate_limiter,
        metrics,
        escapevector_cache,
        #[cfg(feature = "memory")]
        agent_memory,
        #[cfg(feature = "hitl")]
        hitl_coordinator,
        violation_log: Some(Arc::new(tokio::sync::Mutex::new(Vec::new()))),
        peer_registry: Some(Arc::new(tokio::sync::RwLock::new(
            std::collections::HashMap::new(),
        ))),
        runtime_public_key: Some(runtime_public_key),
        signing_key: Some(Arc::new(signing_key)),
        overture_public_key,
        violation_bus: violation_bus.clone(),
        license_status,
        receipt_log,
        lifecycle_registry,
        task_cancellation_registry: Arc::new(std::sync::RwLock::new(HashMap::new())),
        bt_state_tx: Arc::new(tokio::sync::watch::channel(serde_json::Value::Null).0),
        #[cfg(feature = "ros2")]
        ros2_manager: None, // Populated below if ENABLE_ROS2=true
    };

    // ── ROS2 startup (feature-gated) ─────────────────────────────────────────
    #[cfg(feature = "ros2")]
    {
        if std::env::var("ENABLE_ROS2").as_deref() == Ok("true") {
            use igris_ros2::Ros2Config;
            let ros2_config = Ros2Config {
                enabled: true,
                enable_nav2: std::env::var("ENABLE_NAV2").as_deref() == Ok("true"),
                node_name: std::env::var("ROS2_NODE_NAME")
                    .unwrap_or_else(|_| "igris_runtime".to_string()),
                ..Default::default()
            };

            // Clone the signing key from AppState for the ContainmentBridge.
            let ros2_signing_key = state
                .signing_key
                .as_ref()
                .map(|k| (**k).clone())
                .unwrap_or_else(|| {
                    use rand::rngs::OsRng;
                    ed25519_dalek::SigningKey::generate(&mut OsRng)
                });

            let ros2_log_path = std::env::var("ROS2_VIOLATION_LOG")
                .unwrap_or_else(|_| "/tmp/igris_ros2_violations.jsonl".to_string());

                match crate::ros2_integration::Ros2Manager::start(
                    ros2_config,
                    &violation_bus,
                    ros2_signing_key,
                    ros2_log_path,
                    String::new(),
            )
            .await
            {
                Ok(mgr) => {
                    info!("[ROS2] Ros2Manager started — ContainmentBridge active");
                    state.ros2_manager = Some(Arc::new(mgr));
                }
                Err(e) => {
                    warn!(
                        "[ROS2] Ros2Manager failed to start, ROS2 BT nodes disabled: {}",
                        e
                    );
                }
            }
        }
    }

    // Build router
    let mut app = Router::new()
        .route("/v1/health", get(health))
        .route("/v1/runtime/profile", get(runtime_profile))
        .route("/metrics", get(metrics_handler))
        .route("/v1/lora/status", get(lora_status))
        .route("/v1/memory/status", get(memory_status))
        .route("/v1/memory/store", post(memory_store))
        .route("/v1/memory/search", post(memory_search))
        .route("/v1/memory/:key", get(memory_get))
        .route("/v1/hitl/status", get(hitl_status))
        .route("/v1/hitl/requests", get(hitl_requests))
        .route("/v1/hitl/request", post(hitl_submit))
        .route("/v1/hitl/approve", post(hitl_approve))
        .route("/v1/hitl/reject", post(hitl_reject))
        .route("/v1/chat/completions", post(chat_completions))
        .route("/v1/plan", post(plan_endpoint))
        .route("/v1/reflect", post(reflect_endpoint))
        // Model management endpoints
        .route("/v1/admin/models", get(list_models))
        .route("/v1/admin/models/load", post(load_model))
        .route("/v1/admin/models/swap", post(swap_model))
        .route("/v1/fleet/instances", get(fleet_instances))
        .route("/v1/fleet/metrics", get(fleet_metrics))
        // Federated Learning endpoints
        .route("/v1/federated/status", get(federated_status))
        .route("/v1/federated/update", post(federated_submit_update))
        .route("/v1/federated/model/latest", get(federated_latest_model))
        .route("/v1/federated/participants", get(federated_participants))
        // Swarm Intelligence endpoints
        .route("/v1/swarm/status", get(swarm_status))
        .route("/v1/swarm/agents", get(swarm_agents))
        .route("/v1/swarm/join", post(swarm_join))
        .route("/v1/swarm/propose", post(swarm_propose))
        .route("/v1/swarm/vote", post(swarm_vote))
        // Behavior Tree endpoints
        .route("/v1/btree/validate", post(btree_validate))
        .route("/v1/btree/run", post(btree_run))
        .route("/v1/btree/deploy", post(btree_deploy))
        .route("/v1/btree/events", get(btree_events))
        // MCP SSE streaming endpoint
        .route("/mcp/stream", post(mcp_stream))
        .route(
            "/v1/runtime/violations",
            get(runtime_execute::handle_violations),
        )
        .route(
            "/v1/runtime/register",
            post(runtime_execute::handle_register),
        )
        // Phase 4: Agent lifecycle state endpoint
        .route(
            "/v1/runtime/agent/:id/state",
            get(lifecycle::handle_agent_state),
        )
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()));

    if security_policy.runtime_submission_api_enabled {
        app = app
            .route("/v1/runtime/execute", post(runtime_execute::handle_execute))
            .route(
                "/v1/runtime/task/submit",
                post(task_executor::handle_task_submit),
            )
            .route(
                "/v1/runtime/task/stream",
                post(task_executor::handle_task_stream),
            )
            .route(
                "/v1/runtime/task/:task_id/cancel",
                post(task_executor::handle_task_cancel),
            )
            .route(
                "/v1/runtime/task/:task_id/wal",
                get(task_executor::handle_task_wal),
            );
    } else {
        info!(
            "[Runtime/Security] Runtime submission API disabled via IGRIS_ENABLE_RUNTIME_SUBMISSION_API=false"
        );
    }

    // Merge MCP router if enabled
    if let Some(mcp_router) = mcp_router {
        app = app.nest_service("/", mcp_router);
        info!("MCP endpoints mounted at /mcp");
    }

    let app: Router = app
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .layer(from_fn_with_state(state.clone(), security_middleware))
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    info!("Server listening on {}", addr);
    info!("Swagger UI available at http://localhost:8080/swagger-ui");
    info!("Igris Runtime v1.1 started successfully");
    info!(
        "Compiled runtime profiles: {}",
        compiled_runtime_profiles().join(", ")
    );
    info!(
        "Local LLM fallback: {}",
        if has_local_fallback {
            "ENABLED"
        } else {
            "DISABLED"
        }
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
