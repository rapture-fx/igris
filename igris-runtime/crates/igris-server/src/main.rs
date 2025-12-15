use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{info, warn, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use igris_core::{config::IgrisConfig, storage::RedbStorage};
use igris_routing::{
    cloud_provider::CloudProvider,
    speculative::SpeculativeRouter,
    council::CouncilRouter,
    Provider,
};
use igris_local_llm::{LocalLLMConfig, LocalLLMProviderAdapter};
use igris_routing::local_provider::LocalProvider;
use igris_reflection::{ReflectionAgent, ReflectionConfig as ReflectionLoopConfig, LLMProvider as ReflectionLLMProvider};
use igris_planning::{PlanningAgent, PlanningConfig};
use igris_mcp_server::{
    build_mcp_router, ContextStore, EncryptedStorage, McpState, PeerDiscovery,
    protocol::ServerInfo,
};
use igris_mcp_client::{ContextBroadcaster, McpClient};
mod tool_agent;
use tool_agent::ToolAgent;
mod swarm_agent;
use swarm_agent::{run_swarm, SwarmConfig};
use igris_tools::{ToolRegistry};
use igris_tools::http::HttpTool;
use igris_tools::shell::ShellTool;
use igris_tools::filesystem::FileSystemTool;

/// Application state shared across handlers
#[derive(Clone)]
struct AppState {
    config: Arc<IgrisConfig>,
    storage: Arc<RedbStorage>,
    speculative_router: Arc<SpeculativeRouter>,
    council_router: Arc<CouncilRouter>,
    cloud_providers: Arc<Vec<CloudProvider>>,
    local_provider: Option<Arc<LocalProvider>>,
    mcp_context_store: Option<Arc<ContextStore>>,
    reflection_config: Option<ReflectionLoopConfig>,
    tool_registry: Option<Arc<ToolRegistry>>,
    tool_max_steps: u32,
    tool_timeout_ms: u64,
    tool_max_concurrent: usize,
    planning_config: Option<PlanningConfig>,
    swarm_config: Option<SwarmConfig>,
    swarm_peer_id: String,
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
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message, error_type) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg, "bad_request"),
            ApiError::InternalError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg, "internal_error"),
            ApiError::NotImplemented(msg) => (StatusCode::NOT_IMPLEMENTED, msg, "not_implemented"),
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
) -> Result<Json<ChatCompletionResponse>, ApiError> {
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

    // Check for streaming (not implemented yet)
    if req.stream == Some(true) {
        return Err(ApiError::NotImplemented("Streaming not yet implemented".to_string()));
    }

    // Build prompt from messages
    let prompt = req
        .messages
        .iter()
        .map(|msg| format!("{}: {}", msg.role, msg.content))
        .collect::<Vec<_>>()
        .join("\n");

    let est_prompt_tokens = (prompt.len() as u32) / 4;

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
                    content: result.final_response,
                },
                finish_reason: "stop".to_string(),
            }],
            usage: Usage {
                prompt_tokens: est_prompt_tokens,
                completion_tokens: est_completion_tokens,
                total_tokens: est_prompt_tokens + est_completion_tokens,
            },
        };

        return Ok(Json(response));
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
                    content: final_text,
                },
                finish_reason: "stop".to_string(),
            }],
            usage: Usage {
                prompt_tokens: est_prompt_tokens,
                completion_tokens: est_completion_tokens,
                total_tokens: est_prompt_tokens + est_completion_tokens,
            },
        };

        return Ok(Json(response));
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
                    content: result.final_answer,
                },
                finish_reason: "stop".to_string(),
            }],
            usage: Usage {
                prompt_tokens: est_prompt_tokens,
                completion_tokens: est_completion_tokens,
                total_tokens: est_prompt_tokens + est_completion_tokens,
            },
        };

        return Ok(Json(response));
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
                    content: final_text,
                },
                finish_reason: "stop".to_string(),
            }],
            usage: Usage {
                prompt_tokens: est_prompt_tokens,
                completion_tokens: est_completion_tokens,
                total_tokens: est_prompt_tokens + est_completion_tokens,
            },
        };

        return Ok(Json(response));
    }

    // Try cloud providers first using speculative routing
    let mut response_text = None;
    let mut used_provider = "unknown";
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
            used_provider = &result.winner_id;
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
                    used_provider = local_provider.id();
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

    // If we still don't have a response, fail
    let response_text = response_text.ok_or_else(|| {
        ApiError::InternalError("All providers unavailable".to_string())
    })?;

    let completion_tokens_est = (response_text.len() as u32) / 4;
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
    };

    Ok(Json(response))
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
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "igris_server=info,igris_routing=info,igris_core=info,igris_local_llm=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Igris Runtime v1.1 starting...");

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
    };

    // Build router
    let mut app = Router::new()
        .route("/v1/health", get(health))
        .route("/v1/chat/completions", post(chat_completions))
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .layer(CorsLayer::permissive())
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
