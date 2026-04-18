//! Overture - Fleet Management Control Plane
//!
//! Central server for coordinating Igris edge AI agents across distributed locations.
//!
//! ## Features
//! - Fleet agent registration and management
//! - Configuration synchronization
//! - Telemetry collection and aggregation
//! - Real-time dashboard
//!
//! ## API Endpoints
//!
//! ### Fleet Management
//! - POST `/api/fleet/register` - Register new edge agent
//! - GET `/api/fleet/{fleet_id}/config` - Fetch configuration for agent
//! - POST `/api/fleet/{fleet_id}/telemetry` - Receive telemetry from agent
//!
//! ### BTree Visualization
//! - GET `/api/btree/snapshot?agent_id={id}` - Get current tree snapshot
//! - POST `/api/btree/snapshot/{agent_id}` - Post tree snapshot from agent
//! - GET `/api/btree/metrics?agent_id={id}` - Get metrics history
//! - GET `/api/btree/trace/{agent_id}` - Get execution trace
//! - WebSocket `/ws/btree/live` - Real-time tree updates

mod advanced_analysis;
mod btree_routes;

use anyhow::{Context, Result};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use clap::Parser;
use igris_fleet::{ConfigSyncResponse, RegisterRequest, RegisterResponse, TelemetryData};
use redb::{Database, ReadableTable, TableDefinition};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use tracing::{error, info};
use uuid::Uuid;

/// Command-line arguments
#[derive(Parser, Debug)]
#[command(name = "overture")]
#[command(about = "Overture Fleet Management Control Plane", long_about = None)]
struct Args {
    /// Port to listen on
    #[arg(short, long, default_value_t = 8080)]
    port: u16,

    /// Database path
    #[arg(short, long, default_value = "overture.db")]
    db_path: PathBuf,

    /// API key for authentication (optional)
    #[arg(short, long)]
    api_key: Option<String>,
}

/// Database tables
const AGENTS_TABLE: TableDefinition<&str, &str> = TableDefinition::new("agents");
const TELEMETRY_TABLE: TableDefinition<&str, &str> = TableDefinition::new("telemetry");

/// Application state
#[derive(Clone)]
struct AppState {
    db: Arc<Database>,
    api_key: Option<String>,
    config_store: Arc<RwLock<HashMap<String, serde_json::Value>>>,
}

/// Agent registration data stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredAgent {
    agent_id: String,
    fleet_id: String,
    hostname: String,
    platform: String,
    version: String,
    capabilities: Vec<String>,
    location: Option<String>,
    metadata: HashMap<String, String>,
    registered_at: u64,
    last_seen: u64,
    assigned_role: String,
    config_version: u64,
}

/// Error type for API responses
#[derive(Debug)]
struct ApiError(anyhow::Error);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        error!("API error: {}", self.0);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Internal server error: {}", self.0),
        )
            .into_response()
    }
}

impl<E> From<E> for ApiError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "overture=debug,tower_http=debug".into()),
        )
        .init();

    // Parse command-line arguments
    let args = Args::parse();

    info!("Starting Overture Fleet Management Control Plane");
    info!("Database: {}", args.db_path.display());
    info!("Port: {}", args.port);

    // Initialize database
    let db = Database::create(&args.db_path).context("Failed to create database")?;

    // Create tables if they don't exist
    {
        let write_txn = db.begin_write()?;
        {
            let _ = write_txn.open_table(AGENTS_TABLE)?;
            let _ = write_txn.open_table(TELEMETRY_TABLE)?;
            let _ = write_txn.open_table(btree_routes::SNAPSHOTS_TABLE)?;
        }
        write_txn.commit()?;
    }

    // Wrap database in Arc for sharing
    let db_arc = Arc::new(db);

    // Initialize application state
    let state = AppState {
        db: db_arc.clone(),
        api_key: args.api_key.clone(),
        config_store: Arc::new(RwLock::new(HashMap::new())),
    };

    if state.api_key.is_some() {
        info!("API key authentication enabled");
    } else {
        info!("⚠️  Running without API key authentication (not recommended for production)");
    }

    // Initialize BTree visualization state with database
    let btree_state = btree_routes::BTreeState::new()
        .with_database(db_arc.clone())
        .with_retention_hours(72); // 3 days retention
    let btree_router = btree_routes::create_btree_router(btree_state);

    // Build router
    let app = Router::new()
        .route("/api/fleet/register", post(register_agent))
        .route("/api/fleet/:fleet_id/config", get(get_config))
        .route("/api/fleet/:fleet_id/telemetry", post(receive_telemetry))
        .route("/health", get(health_check))
        .with_state(state)
        .merge(btree_router)
        .layer(TraceLayer::new_for_http());

    // Start server
    let addr = format!("0.0.0.0:{}", args.port);
    info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .context("Failed to bind to address")?;

    axum::serve(listener, app).await.context("Server error")?;

    Ok(())
}

/// Validate API key from request headers
fn validate_api_key(state: &AppState, headers: &HeaderMap) -> Result<(), ApiError> {
    // If no API key is configured, allow all requests
    let Some(expected_key) = &state.api_key else {
        return Ok(());
    };

    // Get API key from headers
    let provided_key = headers.get("x-api-key").and_then(|v| v.to_str().ok());

    match provided_key {
        Some(key) if key == expected_key => Ok(()),
        Some(_) => Err(anyhow::anyhow!("Invalid API key").into()),
        None => Err(anyhow::anyhow!("Missing API key").into()),
    }
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}

/// Register a new edge agent
async fn register_agent(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>, ApiError> {
    // Validate API key
    validate_api_key(&state, &headers)?;
    info!("Registering agent: {}", req.agent_id);

    // Generate fleet ID
    let fleet_id = Uuid::new_v4().to_string();

    // Create stored agent record
    let agent = StoredAgent {
        agent_id: req.agent_id.clone(),
        fleet_id: fleet_id.clone(),
        hostname: req.hostname,
        platform: req.platform,
        version: req.version,
        capabilities: req.capabilities,
        location: req.location,
        metadata: req.metadata,
        registered_at: SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs(),
        last_seen: SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs(),
        assigned_role: "edge-worker".to_string(),
        config_version: 1,
    };

    // Store in database
    let write_txn = state.db.begin_write()?;
    {
        let mut table = write_txn.open_table(AGENTS_TABLE)?;
        let agent_json = serde_json::to_string(&agent)?;
        table.insert(fleet_id.as_str(), agent_json.as_str())?;
    }
    write_txn.commit()?;

    info!(
        "Agent {} registered with fleet ID {}",
        req.agent_id, fleet_id
    );

    // Return response
    Ok(Json(RegisterResponse {
        success: true,
        fleet_id,
        assigned_role: "edge-worker".to_string(),
        config_version: 1,
    }))
}

/// Get configuration for a fleet agent
async fn get_config(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(fleet_id): Path<String>,
) -> Result<Json<ConfigSyncResponse>, ApiError> {
    // Validate API key
    validate_api_key(&state, &headers)?;

    info!("Config sync request from fleet: {}", fleet_id);

    // Verify agent exists
    let read_txn = state.db.begin_read()?;
    let table = read_txn.open_table(AGENTS_TABLE)?;

    if table.get(fleet_id.as_str())?.is_none() {
        return Err(anyhow::anyhow!("Fleet ID not found").into());
    }

    // Get config from store (or return default)
    let config_store = state.config_store.read().await;
    let config = config_store.get(&fleet_id).cloned().unwrap_or_else(|| {
        serde_json::json!({
            "model": "gpt-4o-mini",
            "temperature": 0.7,
            "max_tokens": 1000,
            "enable_tools": true,
        })
    });

    Ok(Json(ConfigSyncResponse {
        version: 2,
        config,
        requires_restart: false,
    }))
}

/// Receive telemetry from edge agent
async fn receive_telemetry(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(fleet_id): Path<String>,
    Json(telemetry): Json<TelemetryData>,
) -> Result<StatusCode, ApiError> {
    // Validate API key
    validate_api_key(&state, &headers)?;

    info!(
        "Telemetry from fleet {}: {} metrics, status: {}",
        fleet_id,
        telemetry.metrics.len(),
        telemetry.status.health
    );

    // Update last_seen timestamp
    let write_txn = state.db.begin_write()?;
    {
        let mut agents_table = write_txn.open_table(AGENTS_TABLE)?;

        // Get agent data and convert to owned string before mutating table
        let agent_data_string = agents_table
            .get(fleet_id.as_str())?
            .map(|data| data.value().to_string());

        if let Some(agent_data) = agent_data_string {
            let mut agent: StoredAgent = serde_json::from_str(&agent_data)?;
            agent.last_seen = SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)?
                .as_secs();

            let agent_json = serde_json::to_string(&agent)?;
            agents_table.insert(fleet_id.as_str(), agent_json.as_str())?;
        }

        // Store telemetry (using timestamp as key for time-series data)
        let mut telemetry_table = write_txn.open_table(TELEMETRY_TABLE)?;
        let telemetry_key = format!("{}:{}", fleet_id, telemetry.timestamp);
        let telemetry_json = serde_json::to_string(&telemetry)?;
        telemetry_table.insert(telemetry_key.as_str(), telemetry_json.as_str())?;
    }
    write_txn.commit()?;

    // Log interesting metrics
    if let Some(epoch) = telemetry.metrics.get("training_epoch") {
        if let Some(train_loss) = telemetry.metrics.get("train_loss") {
            if let Some(val_loss) = telemetry.metrics.get("val_loss") {
                info!(
                    "📊 Fleet {}: Training epoch {}, train_loss: {:.6}, val_loss: {:.6}",
                    fleet_id, epoch, train_loss, val_loss
                );
            }
        }
    }

    Ok(StatusCode::OK)
}
