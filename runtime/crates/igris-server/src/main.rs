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
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use igris_core::{config::IgrisConfig, providers::get_default_providers, storage::RedbStorage};
use igris_routing::{speculative::SpeculativeRouter, council::CouncilRouter};

/// Application state shared across handlers
#[derive(Clone)]
struct AppState {
    config: Arc<IgrisConfig>,
    storage: Arc<RedbStorage>,
    speculative_router: Arc<SpeculativeRouter>,
    council_router: Arc<CouncilRouter>,
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
        version = "1.0.0",
        description = "Pure Rust AI routing engine with Thompson Sampling, Speculative Execution, and Council Mode",
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
    #[schema(example = "thompson")]
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

/// Chat completions endpoint
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
    State(_state): State<AppState>,
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

    // For now, return a mock response
    // TODO: Implement actual routing logic with Thompson Sampling, Speculative, and Council modes
    let response_text = format!(
        "Mock response to: {}\n(Routing mode: {}, Model requested: {})",
        prompt,
        req.mode.as_deref().unwrap_or("thompson"),
        req.model
    );

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
                content: response_text,
            },
            finish_reason: "stop".to_string(),
        }],
        usage: Usage {
            prompt_tokens: prompt.len() as u32 / 4, // Rough estimate
            completion_tokens: 50,
            total_tokens: (prompt.len() as u32 / 4) + 50,
        },
    };

    Ok(Json(response))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "igris_server=info,igris_routing=info,igris_core=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Igris Runtime v1.0 starting...");

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

    // Initialize routers
    info!("Initializing routing engines...");
    let speculative_router = SpeculativeRouter::new(
        3,
        std::time::Duration::from_secs(5),
    );

    let council_router = CouncilRouter::new("anthropic-sonnet".to_string());

    info!("Routing engines initialized");

    // Load default providers
    let providers = get_default_providers();
    info!("Loaded {} default providers", providers.len());

    // Create application state
    let state = AppState {
        config: Arc::new(config),
        storage: Arc::new(storage),
        speculative_router: Arc::new(speculative_router),
        council_router: Arc::new(council_router),
    };

    // Build router
    let app = Router::new()
        .route("/v1/health", get(health))
        .route("/v1/chat/completions", post(chat_completions))
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    info!("Server listening on {}", addr);
    info!("Swagger UI available at http://localhost:8080/swagger-ui");
    info!("Igris Runtime v1.0 started successfully");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
