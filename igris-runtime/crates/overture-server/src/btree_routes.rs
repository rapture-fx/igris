//! BTree Visualization Routes
//!
//! Real-time behavior tree monitoring and visualization endpoints.

use crate::advanced_analysis;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::Response,
    routing::{get, post},
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use redb::{Database, ReadableTable, TableDefinition};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

// Re-export alert types from igris-btree (will be added as dependency)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    pub enabled: bool,
    pub max_failure_rate: f64,
    pub max_replan_rate: f64,
    pub max_llm_latency_ms: f64,
    pub min_tick_rate: f64,
    pub webhook_url: Option<String>,
    pub cooldown_seconds: u64,
}

impl Default for AlertConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            max_failure_rate: 0.20,
            max_replan_rate: 50.0,
            max_llm_latency_ms: 5000.0,
            min_tick_rate: 10.0,
            webhook_url: None,
            cooldown_seconds: 300,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub severity: String,
    pub agent_id: String,
    pub metric: String,
    pub current_value: f64,
    pub threshold: f64,
    pub message: String,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSummary {
    pub total_replans: u64,
    pub avg_tick_rate: f64,
    pub avg_llm_latency_ms: f64,
    pub watchdog_triggers: u64,
    pub total_ticks: u64,
    pub failure_rate: f64,
    pub total_execution_ms: f64,
}

/// Database table for historical snapshots
/// Key: "{agent_id}:{timestamp_ms}", Value: JSON snapshot
pub const SNAPSHOTS_TABLE: TableDefinition<&str, &str> = TableDefinition::new("btree_snapshots");

/// BTree state shared across endpoints
#[derive(Clone)]
pub struct BTreeState {
    /// Latest tree snapshot (per agent)
    snapshots: Arc<RwLock<HashMap<String, serde_json::Value>>>,

    /// Metrics history
    metrics: Arc<RwLock<HashMap<String, Vec<MetricsPoint>>>>,

    /// Connected WebSocket clients
    clients: Arc<RwLock<Vec<tokio::sync::mpsc::UnboundedSender<String>>>>,

    /// Alert configuration
    alert_config: Arc<RwLock<AlertConfig>>,

    /// Recent alerts (per agent, last 100)
    alerts: Arc<RwLock<HashMap<String, Vec<Alert>>>>,

    /// Last alert time (for cooldown tracking)
    last_alert_time: Arc<RwLock<HashMap<String, u64>>>,

    /// Database for historical storage
    db: Option<Arc<Database>>,

    /// Historical storage retention in hours (default: 72 hours)
    retention_hours: u64,
}

impl BTreeState {
    pub fn new() -> Self {
        Self {
            snapshots: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(HashMap::new())),
            clients: Arc::new(RwLock::new(Vec::new())),
            alert_config: Arc::new(RwLock::new(AlertConfig::default())),
            alerts: Arc::new(RwLock::new(HashMap::new())),
            last_alert_time: Arc::new(RwLock::new(HashMap::new())),
            db: None,
            retention_hours: 72, // 3 days default
        }
    }

    pub fn with_database(mut self, db: Arc<Database>) -> Self {
        self.db = Some(db);
        self
    }

    pub fn with_retention_hours(mut self, hours: u64) -> Self {
        self.retention_hours = hours;
        self
    }
}

/// Metrics data point for time-series
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsPoint {
    pub timestamp_ms: u64,
    pub tick_count: u64,
    pub tick_rate: f64,
    pub replan_count: u64,
    pub failure_rate: f64,
    pub llm_latency_ms: f64,
}

/// Query parameters for snapshot endpoint
#[derive(Debug, Deserialize)]
pub struct SnapshotQuery {
    /// Agent/fleet ID
    #[serde(default = "default_agent_id")]
    pub agent_id: String,
}

fn default_agent_id() -> String {
    "default".to_string()
}

/// Query parameters for historical snapshots
#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    /// Start timestamp in milliseconds (optional)
    pub start: Option<u64>,
    /// End timestamp in milliseconds (optional)
    pub end: Option<u64>,
    /// Maximum number of results (default: 100)
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_limit() -> usize {
    100
}

/// Replay session metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaySession {
    pub agent_id: String,
    pub total_snapshots: usize,
    pub start_time_ms: u64,
    pub end_time_ms: u64,
    pub duration_ms: u64,
    pub snapshots: Vec<serde_json::Value>,
}

/// Create BTree visualization router
pub fn create_btree_router(state: BTreeState) -> Router {
    Router::new()
        // Snapshot endpoints
        .route("/api/btree/snapshot", get(get_snapshot))
        .route("/api/btree/snapshot/:agent_id", post(post_snapshot))
        .route("/api/btree/history/:agent_id", get(get_history))
        .route("/api/btree/replay/:agent_id", get(get_replay_session))
        // Metrics endpoints
        .route("/api/btree/metrics", get(get_metrics))
        .route("/api/btree/trace/:agent_id", get(get_trace))
        // Alert endpoints
        .route("/api/btree/alerts/config", get(get_alert_config))
        .route("/api/btree/alerts/config", post(update_alert_config))
        .route("/api/btree/alerts/:agent_id", get(get_alerts))
        // Advanced analysis endpoints
        .route("/api/btree/heatmap/:agent_id", get(get_heatmap))
        .route("/api/btree/fleet/overview", get(get_fleet_overview))
        .route("/api/btree/anomalies/:agent_id", get(detect_anomalies))
        .route("/api/btree/compare", post(compare_variants))
        .route("/api/btree/suggestions/:agent_id", get(get_suggestions))
        // Prometheus metrics
        .route("/metrics", get(prometheus_metrics))
        // WebSocket
        .route("/ws/btree/live", get(websocket_handler))
        .with_state(state)
}

/// Get current tree snapshot
async fn get_snapshot(
    State(state): State<BTreeState>,
    Query(query): Query<SnapshotQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let snapshots = state.snapshots.read().await;

    if let Some(snapshot) = snapshots.get(&query.agent_id) {
        Ok(Json(snapshot.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Get historical snapshots for an agent
async fn get_history(
    State(state): State<BTreeState>,
    Path(agent_id): Path<String>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let db = match &state.db {
        Some(db) => db,
        None => return Ok(Json(Vec::new())), // No database configured
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let start_time = query.start.unwrap_or(0);
    let end_time = query.end.unwrap_or(now);

    let mut results = Vec::new();

    if let Ok(read_txn) = db.begin_read() {
        if let Ok(table) = read_txn.open_table(SNAPSHOTS_TABLE) {
            // Iterate through snapshots in time range
            for item in table.iter().ok().into_iter().flatten() {
                if results.len() >= query.limit {
                    break;
                }

                if let Ok((key, value)) = item {
                    let key_str = key.value();

                    // Parse key: "{agent_id}:{timestamp_ms}"
                    if let Some((_agent, timestamp_str)) = key_str.split_once(':') {
                        if let Ok(timestamp) = timestamp_str.parse::<u64>() {
                            // Check if this is the right agent and in time range
                            if key_str.starts_with(&format!("{}:", agent_id))
                                && timestamp >= start_time
                                && timestamp <= end_time
                            {
                                if let Ok(snapshot) =
                                    serde_json::from_str::<serde_json::Value>(value.value())
                                {
                                    results.push(snapshot);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp (newest first)
    results.sort_by(|a, b| {
        let a_ts = a.get("timestamp_ms").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_ts = b.get("timestamp_ms").and_then(|v| v.as_u64()).unwrap_or(0);
        b_ts.cmp(&a_ts)
    });

    Ok(Json(results))
}

/// Get replay session for an agent (optimized for step-through debugging)
async fn get_replay_session(
    State(state): State<BTreeState>,
    Path(agent_id): Path<String>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<ReplaySession>, StatusCode> {
    let db = match &state.db {
        Some(db) => db,
        None => return Err(StatusCode::NOT_IMPLEMENTED),
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let start_time = query.start.unwrap_or(now.saturating_sub(3600000)); // Last hour default
    let end_time = query.end.unwrap_or(now);

    let mut snapshots = Vec::new();
    let mut min_time = u64::MAX;
    let mut max_time = 0u64;

    if let Ok(read_txn) = db.begin_read() {
        if let Ok(table) = read_txn.open_table(SNAPSHOTS_TABLE) {
            for item in table.iter().ok().into_iter().flatten() {
                if snapshots.len() >= query.limit {
                    break;
                }

                if let Ok((key, value)) = item {
                    let key_str = key.value();

                    if let Some((_agent, timestamp_str)) = key_str.split_once(':') {
                        if let Ok(timestamp) = timestamp_str.parse::<u64>() {
                            if key_str.starts_with(&format!("{}:", agent_id))
                                && timestamp >= start_time
                                && timestamp <= end_time
                            {
                                if let Ok(snapshot) =
                                    serde_json::from_str::<serde_json::Value>(value.value())
                                {
                                    min_time = min_time.min(timestamp);
                                    max_time = max_time.max(timestamp);
                                    snapshots.push(snapshot);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp (oldest first for replay)
    snapshots.sort_by(|a, b| {
        let a_ts = a.get("timestamp_ms").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_ts = b.get("timestamp_ms").and_then(|v| v.as_u64()).unwrap_or(0);
        a_ts.cmp(&b_ts)
    });

    let session = ReplaySession {
        agent_id,
        total_snapshots: snapshots.len(),
        start_time_ms: if min_time == u64::MAX { 0 } else { min_time },
        end_time_ms: max_time,
        duration_ms: if min_time == u64::MAX {
            0
        } else {
            max_time.saturating_sub(min_time)
        },
        snapshots,
    };

    Ok(Json(session))
}

/// Post new tree snapshot (called by agents)
async fn post_snapshot(
    State(state): State<BTreeState>,
    Path(agent_id): Path<String>,
    Json(snapshot): Json<serde_json::Value>,
) -> StatusCode {
    info!("Received BTree snapshot from agent: {}", agent_id);

    // Store snapshot
    {
        let mut snapshots = state.snapshots.write().await;
        snapshots.insert(agent_id.clone(), snapshot.clone());
    }

    // Extract and store metrics
    if let Some(metrics_obj) = snapshot.get("metrics") {
        if let Ok(metrics) = serde_json::from_value::<serde_json::Value>(metrics_obj.clone()) {
            let point = MetricsPoint {
                timestamp_ms: snapshot
                    .get("timestamp_ms")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0),
                tick_count: snapshot
                    .get("tick_count")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0),
                tick_rate: metrics
                    .get("avg_tick_rate")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0),
                replan_count: metrics
                    .get("total_replans")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0),
                failure_rate: metrics
                    .get("failure_rate")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0),
                llm_latency_ms: metrics
                    .get("avg_llm_latency_ms")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0),
            };

            let mut metrics_store = state.metrics.write().await;
            metrics_store
                .entry(agent_id.clone())
                .or_insert_with(Vec::new)
                .push(point);

            // Keep only last 1000 points
            if let Some(history) = metrics_store.get_mut(&agent_id) {
                if history.len() > 1000 {
                    history.drain(0..(history.len() - 1000));
                }
            }
        }
    }

    // Check for alerts
    if let Some(metrics_obj) = snapshot.get("metrics") {
        if let Ok(metrics_summary) = serde_json::from_value::<MetricsSummary>(metrics_obj.clone()) {
            let config = state.alert_config.read().await;
            if config.enabled {
                drop(config); // Release read lock
                if let Ok(new_alerts) =
                    check_metrics_for_alerts(&state, &agent_id, &metrics_summary).await
                {
                    if !new_alerts.is_empty() {
                        let mut alerts_store = state.alerts.write().await;
                        let agent_alerts = alerts_store
                            .entry(agent_id.clone())
                            .or_insert_with(Vec::new);
                        agent_alerts.extend(new_alerts);

                        // Keep only last 100 alerts per agent
                        if agent_alerts.len() > 100 {
                            agent_alerts.drain(0..(agent_alerts.len() - 100));
                        }
                    }
                }
            }
        }
    }

    // Store snapshot in database for historical queries
    if let Some(ref db) = state.db {
        if let Some(timestamp_ms) = snapshot.get("timestamp_ms").and_then(|v| v.as_u64()) {
            let key = format!("{}:{}", agent_id, timestamp_ms);
            let snapshot_json = serde_json::to_string(&snapshot).unwrap_or_default();

            if let Ok(write_txn) = db.begin_write() {
                if let Ok(mut table) = write_txn.open_table(SNAPSHOTS_TABLE) {
                    let _ = table.insert(key.as_str(), snapshot_json.as_str());
                }
                let _ = write_txn.commit();
            }
        }
    }

    // Broadcast to WebSocket clients
    let snapshot_str = serde_json::to_string(&snapshot).unwrap_or_default();
    let clients = state.clients.read().await;
    for client in clients.iter() {
        let _ = client.send(snapshot_str.clone());
    }

    StatusCode::OK
}

/// Get metrics history
async fn get_metrics(
    State(state): State<BTreeState>,
    Query(query): Query<SnapshotQuery>,
) -> Result<Json<Vec<MetricsPoint>>, StatusCode> {
    let metrics = state.metrics.read().await;

    if let Some(history) = metrics.get(&query.agent_id) {
        Ok(Json(history.clone()))
    } else {
        Ok(Json(Vec::new()))
    }
}

/// Get execution trace
async fn get_trace(
    State(state): State<BTreeState>,
    Path(agent_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let snapshots = state.snapshots.read().await;

    if let Some(snapshot) = snapshots.get(&agent_id) {
        if let Some(trace) = snapshot.get("execution_trace") {
            Ok(Json(trace.clone()))
        } else {
            Ok(Json(serde_json::json!([])))
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Check metrics against alert thresholds
async fn check_metrics_for_alerts(
    state: &BTreeState,
    agent_id: &str,
    metrics: &MetricsSummary,
) -> Result<Vec<Alert>, anyhow::Error> {
    let config = state.alert_config.read().await;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis() as u64;

    let mut alerts = Vec::new();

    // Check failure rate
    if metrics.failure_rate > config.max_failure_rate {
        let key = format!("{}:failure_rate", agent_id);
        if should_alert(state, &key, now, config.cooldown_seconds).await {
            alerts.push(Alert {
                severity: if metrics.failure_rate > 0.5 {
                    "Critical".to_string()
                } else {
                    "Warning".to_string()
                },
                agent_id: agent_id.to_string(),
                metric: "failure_rate".to_string(),
                current_value: metrics.failure_rate,
                threshold: config.max_failure_rate,
                message: format!(
                    "High failure rate: {:.1}% (threshold: {:.1}%)",
                    metrics.failure_rate * 100.0,
                    config.max_failure_rate * 100.0
                ),
                timestamp_ms: now,
            });
        }
    }

    // Check replan rate
    let runtime_minutes = metrics.total_execution_ms / 60000.0;
    let replan_rate = if runtime_minutes > 0.0 {
        metrics.total_replans as f64 / runtime_minutes
    } else {
        0.0
    };

    if replan_rate > config.max_replan_rate {
        let key = format!("{}:replan_rate", agent_id);
        if should_alert(state, &key, now, config.cooldown_seconds).await {
            alerts.push(Alert {
                severity: "Warning".to_string(),
                agent_id: agent_id.to_string(),
                metric: "replan_rate".to_string(),
                current_value: replan_rate,
                threshold: config.max_replan_rate,
                message: format!(
                    "High replan rate: {:.1} replans/min (threshold: {:.1})",
                    replan_rate, config.max_replan_rate
                ),
                timestamp_ms: now,
            });
        }
    }

    // Check LLM latency
    if metrics.avg_llm_latency_ms > config.max_llm_latency_ms {
        let key = format!("{}:llm_latency", agent_id);
        if should_alert(state, &key, now, config.cooldown_seconds).await {
            alerts.push(Alert {
                severity: if metrics.avg_llm_latency_ms > config.max_llm_latency_ms * 2.0 {
                    "Critical".to_string()
                } else {
                    "Warning".to_string()
                },
                agent_id: agent_id.to_string(),
                metric: "llm_latency".to_string(),
                current_value: metrics.avg_llm_latency_ms,
                threshold: config.max_llm_latency_ms,
                message: format!(
                    "High LLM latency: {:.0}ms (threshold: {:.0}ms)",
                    metrics.avg_llm_latency_ms, config.max_llm_latency_ms
                ),
                timestamp_ms: now,
            });
        }
    }

    // Check tick rate
    if metrics.avg_tick_rate > 0.0 && metrics.avg_tick_rate < config.min_tick_rate {
        let key = format!("{}:tick_rate", agent_id);
        if should_alert(state, &key, now, config.cooldown_seconds).await {
            alerts.push(Alert {
                severity: "Warning".to_string(),
                agent_id: agent_id.to_string(),
                metric: "tick_rate".to_string(),
                current_value: metrics.avg_tick_rate,
                threshold: config.min_tick_rate,
                message: format!(
                    "Low tick rate: {:.1} ticks/sec (threshold: {:.1})",
                    metrics.avg_tick_rate, config.min_tick_rate
                ),
                timestamp_ms: now,
            });
        }
    }

    // Send webhook notifications if configured
    if !alerts.is_empty() {
        if let Some(webhook_url) = &config.webhook_url {
            for alert in &alerts {
                let _ = send_webhook_alert(alert, webhook_url).await;
            }
        }
    }

    Ok(alerts)
}

/// Check if enough time has passed since last alert (cooldown)
async fn should_alert(state: &BTreeState, key: &str, now: u64, cooldown_seconds: u64) -> bool {
    let mut last_times = state.last_alert_time.write().await;

    if let Some(&last_time) = last_times.get(key) {
        let elapsed_seconds = (now - last_time) / 1000;
        if elapsed_seconds < cooldown_seconds {
            return false;
        }
    }

    last_times.insert(key.to_string(), now);
    true
}

/// Send alert to webhook
async fn send_webhook_alert(alert: &Alert, webhook_url: &str) -> Result<(), anyhow::Error> {
    let color = match alert.severity.as_str() {
        "Critical" => "#FF0000", // Red
        _ => "#FFA500",          // Orange
    };

    let payload = serde_json::json!({
        "embeds": [{
            "title": format!("🚨 BTree Alert: {}", alert.metric),
            "description": alert.message,
            "color": color,
            "fields": [
                {
                    "name": "Agent ID",
                    "value": alert.agent_id,
                    "inline": true
                },
                {
                    "name": "Severity",
                    "value": &alert.severity,
                    "inline": true
                },
                {
                    "name": "Current Value",
                    "value": format!("{:.2}", alert.current_value),
                    "inline": true
                },
                {
                    "name": "Threshold",
                    "value": format!("{:.2}", alert.threshold),
                    "inline": true
                }
            ]
        }]
    });

    let client = reqwest::Client::new();
    match client.post(webhook_url).json(&payload).send().await {
        Ok(_) => {
            info!("Alert sent to webhook: {}", alert.metric);
            Ok(())
        }
        Err(e) => {
            warn!("Failed to send webhook alert: {}", e);
            Err(e.into())
        }
    }
}

/// Get alert configuration
async fn get_alert_config(State(state): State<BTreeState>) -> Json<AlertConfig> {
    let config = state.alert_config.read().await;
    Json(config.clone())
}

/// Update alert configuration
async fn update_alert_config(
    State(state): State<BTreeState>,
    Json(new_config): Json<AlertConfig>,
) -> StatusCode {
    let mut config = state.alert_config.write().await;
    *config = new_config;
    info!("Alert configuration updated");
    StatusCode::OK
}

/// Get recent alerts for an agent
async fn get_alerts(
    State(state): State<BTreeState>,
    Path(agent_id): Path<String>,
) -> Result<Json<Vec<Alert>>, StatusCode> {
    let alerts = state.alerts.read().await;

    if let Some(agent_alerts) = alerts.get(&agent_id) {
        Ok(Json(agent_alerts.clone()))
    } else {
        Ok(Json(Vec::new()))
    }
}

/// Get performance heatmap for an agent
async fn get_heatmap(
    State(state): State<BTreeState>,
    Path(agent_id): Path<String>,
) -> Result<Json<advanced_analysis::PerformanceHeatmap>, StatusCode> {
    let snapshots = state.snapshots.read().await;

    if let Some(snapshot) = snapshots.get(&agent_id) {
        if let Some(heatmap) = advanced_analysis::compute_heatmap(&agent_id, snapshot) {
            Ok(Json(heatmap))
        } else {
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Get fleet overview with all agents
async fn get_fleet_overview(
    State(state): State<BTreeState>,
) -> Json<advanced_analysis::FleetOverview> {
    let snapshots = state.snapshots.read().await;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let mut agents = Vec::new();
    let mut healthy = 0;
    let mut warning = 0;
    let mut critical = 0;
    let mut offline = 0;
    let mut total_tick_rate = 0.0;
    let mut total_replans = 0u64;

    for (agent_id, snapshot) in snapshots.iter() {
        let timestamp_ms = snapshot
            .get("timestamp_ms")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let age_seconds = (now - timestamp_ms) as f64 / 1000.0;

        let metrics = snapshot.get("metrics");
        let tick_rate = metrics
            .and_then(|m| m.get("avg_tick_rate"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let failure_rate = metrics
            .and_then(|m| m.get("failure_rate"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let replan_count = metrics
            .and_then(|m| m.get("total_replans"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let status = if age_seconds > 300.0 {
            "offline"
        } else if failure_rate > 0.5 {
            "critical"
        } else if failure_rate > 0.2 || tick_rate < 10.0 {
            "warning"
        } else {
            "healthy"
        };

        match status {
            "healthy" => healthy += 1,
            "warning" => warning += 1,
            "critical" => critical += 1,
            "offline" => offline += 1,
            _ => {}
        }

        total_tick_rate += tick_rate;
        total_replans += replan_count;

        let current_mission = snapshot
            .get("blackboard")
            .and_then(|bb| bb.get("mission_task"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        agents.push(advanced_analysis::AgentStatus {
            agent_id: agent_id.clone(),
            status: status.to_string(),
            last_seen_ms: timestamp_ms,
            tick_rate,
            failure_rate,
            replan_count,
            current_mission,
        });
    }

    let total = agents.len();
    let avg_tick_rate = if total > 0 {
        total_tick_rate / total as f64
    } else {
        0.0
    };

    Json(advanced_analysis::FleetOverview {
        total_agents: total,
        healthy_agents: healthy,
        warning_agents: warning,
        critical_agents: critical,
        offline_agents: offline,
        avg_tick_rate,
        total_replans_last_hour: total_replans,
        agents,
    })
}

/// Detect anomalies in agent metrics
async fn detect_anomalies(
    State(state): State<BTreeState>,
    Path(agent_id): Path<String>,
) -> Result<Json<advanced_analysis::AnomalyReport>, StatusCode> {
    let metrics_store = state.metrics.read().await;

    let history = match metrics_store.get(&agent_id) {
        Some(h) => h,
        None => {
            return Ok(Json(advanced_analysis::AnomalyReport {
                agent_id,
                anomalies: Vec::new(),
                total_anomalies: 0,
            }))
        }
    };

    if history.len() < 10 {
        // Not enough data for baseline
        return Ok(Json(advanced_analysis::AnomalyReport {
            agent_id,
            anomalies: Vec::new(),
            total_anomalies: 0,
        }));
    }

    let mut anomalies = Vec::new();

    // Compute baseline statistics (using first 80% of data)
    let baseline_len = (history.len() as f64 * 0.8) as usize;
    let baseline = &history[..baseline_len];
    let recent = history.last().unwrap();

    // Compute mean and stddev for tick_rate
    let tick_rates: Vec<f64> = baseline.iter().map(|p| p.tick_rate).collect();
    let mean_tick_rate = tick_rates.iter().sum::<f64>() / tick_rates.len() as f64;
    let variance_tick_rate = tick_rates
        .iter()
        .map(|x| (x - mean_tick_rate).powi(2))
        .sum::<f64>()
        / tick_rates.len() as f64;
    let stddev_tick_rate = variance_tick_rate.sqrt();

    let z_score_tick_rate = if stddev_tick_rate > 0.0 {
        (recent.tick_rate - mean_tick_rate) / stddev_tick_rate
    } else {
        0.0
    };

    if z_score_tick_rate.abs() > 2.0 {
        anomalies.push(advanced_analysis::Anomaly {
            agent_id: agent_id.clone(),
            metric: "tick_rate".to_string(),
            current_value: recent.tick_rate,
            baseline_mean: mean_tick_rate,
            baseline_stddev: stddev_tick_rate,
            z_score: z_score_tick_rate,
            severity: if z_score_tick_rate.abs() > 3.0 {
                "severe"
            } else {
                "moderate"
            }
            .to_string(),
            description: format!(
                "Tick rate deviated {:.1} standard deviations from baseline",
                z_score_tick_rate.abs()
            ),
            timestamp_ms: recent.timestamp_ms,
        });
    }

    // Similar analysis for failure_rate
    let failure_rates: Vec<f64> = baseline.iter().map(|p| p.failure_rate).collect();
    let mean_failure_rate = failure_rates.iter().sum::<f64>() / failure_rates.len() as f64;
    let variance_failure_rate = failure_rates
        .iter()
        .map(|x| (x - mean_failure_rate).powi(2))
        .sum::<f64>()
        / failure_rates.len() as f64;
    let stddev_failure_rate = variance_failure_rate.sqrt();

    let z_score_failure_rate = if stddev_failure_rate > 0.0 {
        (recent.failure_rate - mean_failure_rate) / stddev_failure_rate
    } else {
        0.0
    };

    if z_score_failure_rate.abs() > 2.0 {
        anomalies.push(advanced_analysis::Anomaly {
            agent_id: agent_id.clone(),
            metric: "failure_rate".to_string(),
            current_value: recent.failure_rate,
            baseline_mean: mean_failure_rate,
            baseline_stddev: stddev_failure_rate,
            z_score: z_score_failure_rate,
            severity: if z_score_failure_rate > 3.0 {
                "severe"
            } else if z_score_failure_rate > 2.5 {
                "moderate"
            } else {
                "minor"
            }
            .to_string(),
            description: format!(
                "Failure rate increased {:.1} standard deviations above baseline",
                z_score_failure_rate
            ),
            timestamp_ms: recent.timestamp_ms,
        });
    }

    let total = anomalies.len();

    Ok(Json(advanced_analysis::AnomalyReport {
        agent_id,
        total_anomalies: total,
        anomalies,
    }))
}

/// Compare two tree variants for A/B testing
#[derive(Debug, Deserialize)]
struct CompareRequest {
    variant_a_id: String,
    variant_b_id: String,
}

async fn compare_variants(
    State(state): State<BTreeState>,
    Json(req): Json<CompareRequest>,
) -> Result<Json<advanced_analysis::ABTestComparison>, StatusCode> {
    let snapshots = state.snapshots.read().await;

    let variant_a = snapshots
        .get(&req.variant_a_id)
        .ok_or(StatusCode::NOT_FOUND)?;
    let variant_b = snapshots
        .get(&req.variant_b_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(comparison) = advanced_analysis::compare_ab_variants(variant_a, variant_b) {
        Ok(Json(comparison))
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

/// Get optimization suggestions for an agent
async fn get_suggestions(
    State(state): State<BTreeState>,
    Path(agent_id): Path<String>,
) -> Result<Json<advanced_analysis::OptimizationReport>, StatusCode> {
    let snapshots = state.snapshots.read().await;

    if let Some(snapshot) = snapshots.get(&agent_id) {
        let report = advanced_analysis::generate_suggestions(&agent_id, snapshot);
        Ok(Json(report))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Prometheus metrics endpoint
async fn prometheus_metrics(State(state): State<BTreeState>) -> String {
    let mut output = String::new();

    // Add HELP and TYPE declarations
    output.push_str("# HELP btree_tick_rate Current tick rate in ticks per second\n");
    output.push_str("# TYPE btree_tick_rate gauge\n");

    output.push_str("# HELP btree_failure_rate Current failure rate (0.0-1.0)\n");
    output.push_str("# TYPE btree_failure_rate gauge\n");

    output.push_str("# HELP btree_replan_count Total number of replans\n");
    output.push_str("# TYPE btree_replan_count counter\n");

    output.push_str("# HELP btree_llm_latency_ms Average LLM latency in milliseconds\n");
    output.push_str("# TYPE btree_llm_latency_ms gauge\n");

    output.push_str("# HELP btree_total_ticks Total number of ticks executed\n");
    output.push_str("# TYPE btree_total_ticks counter\n");

    output.push_str("# HELP btree_watchdog_triggers Number of watchdog triggers\n");
    output.push_str("# TYPE btree_watchdog_triggers counter\n");

    output.push_str("# HELP btree_execution_time_ms Total execution time in milliseconds\n");
    output.push_str("# TYPE btree_execution_time_ms counter\n");

    output.push_str("# HELP btree_snapshot_age_seconds Time since last snapshot update\n");
    output.push_str("# TYPE btree_snapshot_age_seconds gauge\n");

    // Export metrics for each agent
    let snapshots = state.snapshots.read().await;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    for (agent_id, snapshot) in snapshots.iter() {
        if let Some(metrics_obj) = snapshot.get("metrics") {
            if let Ok(metrics) = serde_json::from_value::<MetricsSummary>(metrics_obj.clone()) {
                let labels = format!("agent_id=\"{}\"", agent_id);

                output.push_str(&format!(
                    "btree_tick_rate{{{}}} {}\n",
                    labels, metrics.avg_tick_rate
                ));
                output.push_str(&format!(
                    "btree_failure_rate{{{}}} {}\n",
                    labels, metrics.failure_rate
                ));
                output.push_str(&format!(
                    "btree_replan_count{{{}}} {}\n",
                    labels, metrics.total_replans
                ));
                output.push_str(&format!(
                    "btree_llm_latency_ms{{{}}} {}\n",
                    labels, metrics.avg_llm_latency_ms
                ));
                output.push_str(&format!(
                    "btree_total_ticks{{{}}} {}\n",
                    labels, metrics.total_ticks
                ));
                output.push_str(&format!(
                    "btree_watchdog_triggers{{{}}} {}\n",
                    labels, metrics.watchdog_triggers
                ));
                output.push_str(&format!(
                    "btree_execution_time_ms{{{}}} {}\n",
                    labels, metrics.total_execution_ms
                ));

                // Calculate snapshot age
                if let Some(timestamp_ms) = snapshot.get("timestamp_ms").and_then(|v| v.as_u64()) {
                    let age_seconds = (now - timestamp_ms) as f64 / 1000.0;
                    output.push_str(&format!(
                        "btree_snapshot_age_seconds{{{}}} {:.2}\n",
                        labels, age_seconds
                    ));
                }
            }
        }
    }

    // Add fleet-level aggregate metrics
    let total_agents = snapshots.len();
    output.push_str(&format!("btree_total_agents {}\n", total_agents));

    output
}

/// WebSocket handler for live updates
async fn websocket_handler(ws: WebSocketUpgrade, State(state): State<BTreeState>) -> Response {
    ws.on_upgrade(|socket| handle_websocket(socket, state))
}

async fn handle_websocket(socket: WebSocket, state: BTreeState) {
    info!("New WebSocket client connected for BTree live updates");

    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Register client
    {
        let mut clients = state.clients.write().await;
        clients.push(tx);
    }

    // Spawn task to send updates to client
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages (keep-alive, etc.)
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                debug!("Received WebSocket message: {}", text);
            }
            Ok(Message::Close(_)) => {
                info!("WebSocket client disconnected");
                break;
            }
            Err(e) => {
                warn!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_btree_state_creation() {
        let state = BTreeState::new();
        assert!(state.snapshots.try_read().is_ok());
    }
}
