use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
    Router,
};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, warn, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use clap::{Parser, Subcommand};
use sha2::Digest;

use igris_core::{config::IgrisConfig, storage::RedbStorage};
use igris_routing::{
    cloud_provider::CloudProvider,
    speculative::SpeculativeRouter,
    council::CouncilRouter,
    Provider,
};
use igris_local_llm::{LocalLLMConfig, LocalLLMProviderAdapter};
use igris_routing::local_provider::LocalProvider;
use igris_emergency::EscapeVectorCache;
use igris_reflection::{ReflectionAgent, ReflectionConfig as ReflectionLoopConfig, LLMProvider as ReflectionLLMProvider};
use igris_planning::{PlanningAgent, PlanningConfig};
use igris_fleet;
use igris_mcp_server::{
    build_mcp_router, ContextStore, EncryptedStorage, McpState, PeerDiscovery,
    protocol::ServerInfo,
};
use igris_mcp_client::{ContextBroadcaster, McpClient};
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
use igris_tools::{ToolRegistry};
use igris_tools::http::HttpTool;
use igris_tools::shell::ShellTool;
use igris_tools::filesystem::FileSystemTool;
mod lora_training;
use lora_training::LoraTrainingManager;
use igris_lora_trainer::{LoRATrainingConfig, TrainingDataStore};
mod federated_integration;
use federated_integration::FederatedManager;
mod swarm_integration;
use swarm_integration::SwarmManager;
mod middleware;
use axum::middleware::from_fn_with_state;
use middleware::security::{security_middleware, RateLimiter};
mod metrics;
use metrics::Metrics;
#[cfg(test)]
mod server_flow_tests;

/// Application state shared across handlers
#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) config: Arc<IgrisConfig>,
    #[allow(dead_code)]
    pub(crate) storage: Arc<RedbStorage>,
    pub(crate) speculative_router: Arc<SpeculativeRouter>,
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
    pub(crate) rate_limiter: Option<middleware::security::RateLimiter>,
    pub(crate) metrics: Arc<Metrics>,
    pub(crate) escapevector_cache: Option<Arc<EscapeVectorCache>>,
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
            ApiError::InternalError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg, "internal_error"),
            ApiError::NotImplemented(msg) => (StatusCode::NOT_IMPLEMENTED, msg, "not_implemented"),
            ApiError::ServiceUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg, "service_unavailable"),
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

/// Fleet instances endpoint - returns all edge runtime instances
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum InstanceStatus {
    Online,
    Offline,
    Maintenance,
    Syncing,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum SyncStatus {
    InSync,
    OutOfSync,
    Syncing,
}

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
async fn fleet_instances(State(_state): State<AppState>) -> Result<Response, ApiError> {
    use std::time::SystemTime;

    // For now, return this instance + a few simulated instances
    // In production, this would query the fleet control plane (Overture)
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Format timestamp as ISO 8601
    let format_timestamp = |secs_ago: u64| -> String {
        let timestamp = now - secs_ago;
        format!("2025-12-28T{:02}:{:02}:{:02}Z",
            (timestamp / 3600) % 24,
            (timestamp / 60) % 60,
            timestamp % 60)
    };

    let instances = vec![
        EdgeRuntimeInstance {
            id: "igris-runtime-us-east-1-a".to_string(),
            name: "US-EAST-1 A Runtime".to_string(),
            region: "us-east-1".to_string(),
            availability_zone: "a".to_string(),
            status: InstanceStatus::Online,
            version: "v1.6.0".to_string(),
            last_heartbeat: format_timestamp(5),
            uptime_seconds: 86400,
            requests_processed: 125000,
            error_rate: 0.5,
            avg_latency: 85.0,
            cpu_usage: 45.2,
            memory_usage: 62.8,
            sync_status: SyncStatus::InSync,
            last_sync_time: format_timestamp(10),
            capabilities: vec!["speculative_execution".to_string(), "council_mode".to_string()],
            provider_connections: 3,
            active_requests: 12,
        },
        EdgeRuntimeInstance {
            id: "igris-runtime-us-west-2-a".to_string(),
            name: "US-WEST-2 A Runtime".to_string(),
            region: "us-west-2".to_string(),
            availability_zone: "a".to_string(),
            status: InstanceStatus::Online,
            version: "v1.6.0".to_string(),
            last_heartbeat: format_timestamp(3),
            uptime_seconds: 172800,
            requests_processed: 98000,
            error_rate: 0.3,
            avg_latency: 92.0,
            cpu_usage: 38.5,
            memory_usage: 58.2,
            sync_status: SyncStatus::InSync,
            last_sync_time: format_timestamp(8),
            capabilities: vec!["speculative_execution".to_string()],
            provider_connections: 3,
            active_requests: 8,
        },
        EdgeRuntimeInstance {
            id: "igris-runtime-eu-west-1-a".to_string(),
            name: "EU-WEST-1 A Runtime".to_string(),
            region: "eu-west-1".to_string(),
            availability_zone: "a".to_string(),
            status: InstanceStatus::Online,
            version: "v1.6.0".to_string(),
            last_heartbeat: format_timestamp(7),
            uptime_seconds: 259200,
            requests_processed: 156000,
            error_rate: 0.4,
            avg_latency: 78.0,
            cpu_usage: 52.1,
            memory_usage: 65.3,
            sync_status: SyncStatus::InSync,
            last_sync_time: format_timestamp(15),
            capabilities: vec!["speculative_execution".to_string(), "council_mode".to_string(), "cache_optimization".to_string()],
            provider_connections: 4,
            active_requests: 15,
        },
    ];

    Ok((StatusCode::OK, Json(instances)).into_response())
}

#[utoipa::path(
    get,
    path = "/v1/fleet/metrics",
    tag = "fleet",
    responses(
        (status = 200, description = "Fleet-wide metrics", body = FleetMetrics)
    )
)]
async fn fleet_metrics(State(_state): State<AppState>) -> Result<Response, ApiError> {
    // In production, aggregate from all instances via Overture
    let metrics = FleetMetrics {
        total_instances: 3,
        online_instances: 3,
        offline_instances: 0,
        maintenance_instances: 0,
        avg_uptime_percentage: 99.8,
        total_requests_served: 379000,
        fleet_error_rate: 0.4,
        regions_covered: 3,
        total_capacity: 300,
        used_capacity: 35,
    };

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
        return Err(ApiError::ServiceUnavailable("Federated learning not enabled".to_string()));
    };
    match mgr.submit_update(update).await {
        Ok(Some(model)) => Ok((StatusCode::OK, Json(serde_json::json!({
            "aggregated": true,
            "global_model": model,
        }))).into_response()),
        Ok(None) => Ok((StatusCode::ACCEPTED, Json(serde_json::json!({
            "aggregated": false,
            "message": "Update accepted, waiting for more participants",
        }))).into_response()),
        Err(e) => Err(ApiError::BadRequest(e.to_string())),
    }
}

async fn federated_latest_model(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.federated_manager else {
        return Err(ApiError::ServiceUnavailable("Federated learning not enabled".to_string()));
    };
    match mgr.get_latest_model().await {
        Some(model) => Ok((StatusCode::OK, Json(model)).into_response()),
        None => Ok((StatusCode::NOT_FOUND, Json(serde_json::json!({
            "message": "No global model available yet"
        }))).into_response()),
    }
}

async fn federated_participants(State(state): State<AppState>) -> Result<Response, ApiError> {
    let Some(mgr) = &state.federated_manager else {
        return Err(ApiError::ServiceUnavailable("Federated learning not enabled".to_string()));
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
        return Err(ApiError::ServiceUnavailable("Swarm not enabled".to_string()));
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
        return Err(ApiError::ServiceUnavailable("Swarm not enabled".to_string()));
    };
    mgr.join_agent(&req.agent_id).await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;
    Ok((StatusCode::OK, Json(serde_json::json!({
        "joined": true,
        "agent_id": req.agent_id,
    }))).into_response())
}

#[derive(Deserialize)]
struct SwarmProposeRequest {
    task_type: String,
    parameters: serde_json::Value,
    #[serde(default = "default_priority")]
    priority: u8,
}

fn default_priority() -> u8 { 1 }

async fn swarm_propose(
    State(state): State<AppState>,
    Json(req): Json<SwarmProposeRequest>,
) -> Result<Response, ApiError> {
    let Some(mgr) = &state.swarm_manager else {
        return Err(ApiError::ServiceUnavailable("Swarm not enabled".to_string()));
    };
    let proposal_id = mgr.propose_task(req.task_type, req.parameters, req.priority)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;
    Ok((StatusCode::OK, Json(serde_json::json!({
        "proposal_id": proposal_id,
    }))).into_response())
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
        return Err(ApiError::ServiceUnavailable("Swarm not enabled".to_string()));
    };
    mgr.vote(&req.proposal_id, req.approve)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    // Check if proposal now has consensus and execute
    match mgr.check_and_execute(&req.proposal_id).await {
        Ok(Some(result)) => Ok((StatusCode::OK, Json(serde_json::json!({
            "voted": true,
            "consensus_reached": true,
            "execution_result": result,
        }))).into_response()),
        Ok(None) => Ok((StatusCode::OK, Json(serde_json::json!({
            "voted": true,
            "consensus_reached": false,
        }))).into_response()),
        Err(e) => Ok((StatusCode::OK, Json(serde_json::json!({
            "voted": true,
            "consensus_reached": true,
            "execution_error": e.to_string(),
        }))).into_response()),
    }
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
            "Planning requires local LLM to be enabled".to_string()
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
    let llm_provider: Arc<dyn igris_reflection::LLMProvider> = Arc::new(LocalProviderReflectionLLM {
        provider: local_provider.clone(),
    });

    let agent = if config.enable_tools {
        PlanningAgent::with_provider(
            config,
            llm_provider,
            state.tool_registry.clone(),
        )
    } else {
        PlanningAgent::with_provider(
            config,
            llm_provider,
            None,
        )
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
            "Reflection requires local LLM to be enabled".to_string()
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
    let llm_provider: Arc<dyn igris_reflection::LLMProvider> = Arc::new(LocalProviderReflectionLLM {
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
        return Err(ApiError::BadRequest("messages array cannot be empty".to_string()));
    }
    if req.messages.len() > 64 {
        return Err(ApiError::BadRequest("too many messages (max 64)".to_string()));
    }
    if req.model.len() > 128 {
        return Err(ApiError::BadRequest("model identifier too long".to_string()));
    }
    let mut total_chars: usize = 0;
    for m in &req.messages {
        if m.role.len() > 32 {
            return Err(ApiError::BadRequest("role too long".to_string()));
        }
        if m.content.len() > 16_384 {
            return Err(ApiError::BadRequest("message content too long (max 16384 chars)".to_string()));
        }
        total_chars = total_chars.saturating_add(m.role.len() + m.content.len());
        if total_chars > 65_536 {
            return Err(ApiError::BadRequest("request too large (max 65536 chars total)".to_string()));
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
                "Streaming is currently only supported for base chat mode (omit `mode`)".to_string(),
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

            match state.speculative_router.route_stream(&prompt, providers).await {
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
                    warn!("Cloud streaming failed, falling back to local if available: {}", e);
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
            let _ = mgr.record_example(prompt.clone(), final_response_text, "reflection".to_string());
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
                "All AI providers are currently unavailable. Please try again in a few moments.".to_string()
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
        let _ = mgr.record_example(prompt.clone(), response_text_for_record.clone(), used_provider.clone());
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
                    match cache.save_response(&prompt, &response_text_for_record, &used_provider, quality_score) {
                        Ok(_) => {
                            info!("Cached response for EscapeVector (quality: {:.2})", quality_score);
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
struct CloudProviderWrapper(CloudProvider);

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
    ) -> anyhow::Result<std::pin::Pin<Box<dyn futures::Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        self.0.stream(prompt).await
    }

    async fn complete(&self, prompt: &str) -> anyhow::Result<String> {
        self.0.complete(prompt).await
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    #[derive(Debug, Parser)]
    #[command(name = "igris-runtime", version, about = "Igris Runtime v1.6 server + CLI")]
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
            match IgrisConfig::load_from_file(&config_path) {
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
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "igris_server=info,igris_routing=info,igris_core=info,igris_local_llm=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Igris Runtime v1.6 starting...");

    // Load configuration
    let config_path = std::env::var("IGRIS_CONFIG").unwrap_or_else(|_| "config.json5".to_string());

    info!("Loading configuration from: {}", config_path);

    let config = if std::path::Path::new(&config_path).exists() {
        IgrisConfig::load_from_file(&config_path)?
    } else {
        warn!("Config file not found, using defaults");
        IgrisConfig::default()
    };

    info!("Config loaded successfully");

    // License validation (REQUIRED)
    let license_key = std::env::var("IGRIS_LICENSE_KEY").ok();

    if let Some(key) = license_key {
        info!("License key provided, validating...");
        match igris_license_client::validate_license_on_startup(&key).await {
            Ok(validation) => {
                info!("License validated successfully");
                info!("Tier: {} | Devices: {}/{} | Cloud requests: {}/{}/month",
                    validation.tier.as_deref().unwrap_or("unknown"),
                    validation.devices_active.unwrap_or(0),
                    validation.devices_limit.unwrap_or(0),
                    validation.cloud_requests_used.unwrap_or(0),
                    validation.cloud_requests_limit.unwrap_or(0)
                );

                // Start heartbeat loop in background
                let key_clone = key.clone();
                let device_id = igris_license_client::LicenseClient::generate_device_id();
                tokio::spawn(async move {
                    igris_license_client::start_heartbeat_loop(key_clone, device_id).await;
                });
            }
            Err(e) => {
                error!("────────────────────────────────────────────────");
                error!("LICENSE VALIDATION FAILED");
                error!("────────────────────────────────────────────────");
                error!("{}", e);
                error!("");
                error!("Igris Platform requires a valid license to run.");
                error!("");
                error!("Get your FREE license (1 device + 50k cloud requests/month):");
                error!("→ https://igrisinertial.com/signup");
                error!("");
                error!("Or view paid tiers with more devices + cloud quota:");
                error!("→ https://igrisinertial.com/pricing");
                error!("");
                error!("Set your license key:");
                error!("export IGRIS_LICENSE_KEY=lic_xxxxx_xxxxx");
                error!("────────────────────────────────────────────────");
                std::process::exit(1);
            }
        }
    } else {
        error!("────────────────────────────────────────────────");
        error!("NO LICENSE KEY PROVIDED");
        error!("────────────────────────────────────────────────");
        error!("Igris Platform requires a license key to run.");
        error!("");
        error!("Get your FREE license (1 device + 50k cloud requests/month):");
        error!("→ https://igrisinertial.com/signup");
        error!("");
        error!("Already have a license? Set it:");
        error!("export IGRIS_LICENSE_KEY=lic_xxxxx_xxxxx");
        error!("");
        error!("View all tiers:");
        error!("→ https://igrisinertial.com/pricing");
        error!("────────────────────────────────────────────────");
        std::process::exit(1);
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
    let storage_path = config.storage.as_ref()
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
    let speculative_router = SpeculativeRouter::new(
        3,
        std::time::Duration::from_secs(5),
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
            discovery.clone().start().await.expect("Failed to start discovery");

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
            let mcp_state = McpState {
                context_store: context_store.clone(),
                peer_id: peer_id.clone(),
                server_info: ServerInfo {
                    name: "Igris Runtime MCP Server".to_string(),
                    version: "1.2.0".to_string(),
                },
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
    let rate_limiter = if (config.auth.enabled || config.auth.api_key != "default-api-key" || config.auth.jwt_hs256_secret.is_some())
        && config.auth.rate_limit_per_minute > 0
    {
        Some(RateLimiter::new(
            config.auth.rate_limit_per_minute,
            config.auth.rate_limit_burst,
        ))
    } else {
        None
    };

    let metrics = Arc::new(Metrics::new());

    // Initialize EscapeVector cache for graceful degradation (Phase 1, v1.9)
    let escapevector_cache: Option<Arc<EscapeVectorCache>> = if let Some(ev_config) = &config.escapevector {
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
    if let Some(fleet_runtime_config) = &config.fleet {
        if fleet_runtime_config.enabled {
            info!("Fleet Management is ENABLED");
            info!("Overture endpoint: {}", fleet_runtime_config.overture_endpoint);
            info!("Agent ID: {}", fleet_runtime_config.agent_id);

            // Convert RuntimeConfig to FleetConfig
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
                mock_mode: false,  // Never use mock mode in production
            };

            match igris_fleet::FleetAgent::new(fleet_config).await {
                Ok(agent) => {
                    // Register with fleet control plane
                    match agent.register().await {
                        Ok(response) => {
                            info!(
                                "Successfully registered with fleet: {} (role: {}, config_version: {})",
                                response.fleet_id, response.assigned_role, response.config_version
                            );

                            // Start background sync loops for config and telemetry
                            if let Err(e) = agent.start_sync_loops().await {
                                warn!("Failed to start fleet sync loops: {}", e);
                            } else {
                                info!("Fleet sync loops started (config + telemetry)");
                            }
                        }
                        Err(e) => {
                            warn!("Failed to register with fleet: {}", e);
                            warn!("Fleet management will continue in degraded mode");
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to initialize fleet agent: {}", e);
                    warn!("Fleet management will not be available");
                }
            }
        } else {
            info!("Fleet Management is DISABLED in config");
        }
    } else {
        info!("Fleet Management not configured");
    }

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

    let state = AppState {
        config: Arc::new(config),
        storage: Arc::new(storage),
        speculative_router: Arc::new(speculative_router),
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
        rate_limiter,
        metrics,
        escapevector_cache,
    };

    // Build router
    let mut app = Router::new()
        .route("/v1/health", get(health))
        .route("/metrics", get(metrics_handler))
        .route("/v1/lora/status", get(lora_status))
        .route("/v1/chat/completions", post(chat_completions))
        .route("/v1/plan", post(plan_endpoint))
        .route("/v1/reflect", post(reflect_endpoint))
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
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .layer(from_fn_with_state(state.clone(), security_middleware))
        .with_state(state);

    // Merge MCP router if enabled
    if let Some(mcp_router) = mcp_router {
        app = app.merge(mcp_router);
        info!("MCP endpoints mounted at /mcp");
    }

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    info!("Server listening on {}", addr);
    info!("Swagger UI available at http://localhost:8080/swagger-ui");
    info!("Igris Runtime v1.1 started successfully");
    info!("Local LLM fallback: {}", if has_local_fallback { "ENABLED" } else { "DISABLED" });

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
