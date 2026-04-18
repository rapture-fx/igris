//! Fleet Management integration for igris-server.
//!
//! Provides real telemetry data for fleet HTTP endpoints:
//! - GET /v1/fleet/instances - This runtime instance with real system metrics
//! - GET /v1/fleet/metrics  - Real metrics from this instance

use anyhow::Result;
use igris_fleet::{FleetAgent, FleetConfig};
use serde::Serialize;
use std::sync::Arc;
use std::time::SystemTime;
use tracing::{info, warn};

/// Manages the fleet agent lifecycle within the runtime server
pub struct FleetManager {
    agent: Arc<FleetAgent>,
    agent_id: String,
    start_time: SystemTime,
}

/// Real instance info populated from live system telemetry
#[derive(Serialize)]
pub struct InstanceInfo {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub status: String,
    pub registered: bool,
    pub fleet_id: Option<String>,
    pub config_version: u64,
    pub uptime_seconds: u64,
    pub health: String,
    pub cpu_usage: f64,
    pub memory_usage_mb: u64,
    pub active_tasks: u32,
    pub requests_total: f64,
    pub error_rate: f64,
    pub last_heartbeat: String,
    pub capabilities: Vec<String>,
}

/// Real metrics from this instance
#[derive(Serialize)]
pub struct InstanceMetrics {
    pub total_instances: u32,
    pub online_instances: u32,
    pub registered: bool,
    pub fleet_id: Option<String>,
    pub uptime_seconds: u64,
    pub health: String,
    pub cpu_usage: f64,
    pub memory_usage_mb: u64,
    pub active_tasks: u32,
    pub requests_total: f64,
    pub error_rate: f64,
    pub prometheus_metrics: std::collections::HashMap<String, f64>,
}

impl FleetManager {
    /// Initialize fleet manager: creates agent, registers with Overture, starts sync loops
    pub async fn new(config: FleetConfig) -> Result<Self> {
        let agent_id = config.agent_id.clone();

        let agent = FleetAgent::new(config).await?;

        // Register with Overture control plane
        match agent.register().await {
            Ok(response) => {
                info!(
                    "Fleet agent registered: fleet_id={}, role={}, config_version={}",
                    response.fleet_id, response.assigned_role, response.config_version
                );
            }
            Err(e) => {
                warn!("Fleet registration failed (degraded mode): {}", e);
            }
        }

        // Start background sync loops
        if let Err(e) = agent.start_sync_loops().await {
            warn!("Failed to start fleet sync loops: {}", e);
        } else {
            info!("Fleet sync loops started (config + telemetry)");
        }

        Ok(Self {
            agent: Arc::new(agent),
            agent_id,
            start_time: SystemTime::now(),
        })
    }

    /// Get real instance info from live system telemetry
    pub async fn get_instance_info(&self) -> InstanceInfo {
        let (cpu, memory, tasks) = igris_fleet::telemetry::get_system_stats();
        let metrics = igris_fleet::telemetry::fetch_prometheus_metrics("http://localhost:8080")
            .await
            .unwrap_or_default();
        let health = igris_fleet::telemetry::determine_health(&metrics, cpu, memory);

        let uptime = SystemTime::now()
            .duration_since(self.start_time)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let registered = self.agent.is_registered().await;
        let fleet_id = self.agent.get_fleet_id().await;
        let config_version = self.agent.get_config_version().await;

        let requests_total = metrics.get("requests_total").copied().unwrap_or(0.0);
        let error_rate = metrics.get("error_rate").copied().unwrap_or(0.0);

        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        InstanceInfo {
            id: format!("igris-runtime-{}", &self.agent_id),
            name: format!("Runtime {}", &self.agent_id),
            hostname: std::env::consts::OS.to_string(),
            status: if registered {
                "online".to_string()
            } else {
                "unregistered".to_string()
            },
            registered,
            fleet_id,
            config_version,
            uptime_seconds: uptime,
            health,
            cpu_usage: cpu as f64,
            memory_usage_mb: memory,
            active_tasks: tasks,
            requests_total,
            error_rate,
            last_heartbeat: format_timestamp(now),
            capabilities: vec![
                "speculative_execution".to_string(),
                "council_mode".to_string(),
                "fleet_telemetry".to_string(),
                "ed25519_signing".to_string(),
            ],
        }
    }

    /// Get real metrics from this instance
    pub async fn get_metrics(&self) -> InstanceMetrics {
        let (cpu, memory, tasks) = igris_fleet::telemetry::get_system_stats();
        let metrics = igris_fleet::telemetry::fetch_prometheus_metrics("http://localhost:8080")
            .await
            .unwrap_or_default();
        let health = igris_fleet::telemetry::determine_health(&metrics, cpu, memory);

        let uptime = SystemTime::now()
            .duration_since(self.start_time)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let registered = self.agent.is_registered().await;
        let fleet_id = self.agent.get_fleet_id().await;
        let requests_total = metrics.get("requests_total").copied().unwrap_or(0.0);
        let error_rate = metrics.get("error_rate").copied().unwrap_or(0.0);

        InstanceMetrics {
            total_instances: 1,
            online_instances: if registered { 1 } else { 0 },
            registered,
            fleet_id,
            uptime_seconds: uptime,
            health,
            cpu_usage: cpu as f64,
            memory_usage_mb: memory,
            active_tasks: tasks,
            requests_total,
            error_rate,
            prometheus_metrics: metrics,
        }
    }

    /// Check if agent is registered with Overture
    pub async fn is_registered(&self) -> bool {
        self.agent.is_registered().await
    }

    /// Get fleet ID
    pub async fn get_fleet_id(&self) -> Option<String> {
        self.agent.get_fleet_id().await
    }

    /// Get config version
    pub async fn get_config_version(&self) -> u64 {
        self.agent.get_config_version().await
    }
}

/// Format unix timestamp as ISO 8601
fn format_timestamp(secs: u64) -> String {
    let hours = (secs / 3600) % 24;
    let minutes = (secs / 60) % 60;
    let seconds = secs % 60;
    // Simple UTC formatting
    let days_since_epoch = secs / 86400;
    let (year, month, day) = days_to_ymd(days_since_epoch);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

/// Convert days since epoch to year/month/day
fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Simplified calculation
    let mut y = 1970;
    let mut remaining = days;

    loop {
        let days_in_year = if is_leap_year(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }

    let days_in_months: [u64; 12] = if is_leap_year(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 0;
    for (i, &days_in_month) in days_in_months.iter().enumerate() {
        if remaining < days_in_month {
            m = i;
            break;
        }
        remaining -= days_in_month;
    }

    (y, (m + 1) as u64, remaining + 1)
}

fn is_leap_year(y: u64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
