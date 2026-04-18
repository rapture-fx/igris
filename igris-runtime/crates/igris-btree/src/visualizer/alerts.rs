//! Alert System for BTree Monitoring
//!
//! Provides threshold-based alerting for behavior tree metrics.
//! Supports webhook notifications to Slack, Discord, or custom endpoints.

use crate::visualizer::types::MetricsSummary;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Alert configuration with thresholds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    /// Enable/disable alerting
    pub enabled: bool,

    /// Maximum acceptable failure rate (0.0-1.0)
    pub max_failure_rate: f64,

    /// Maximum replans per minute
    pub max_replan_rate: f64,

    /// Maximum LLM latency in milliseconds
    pub max_llm_latency_ms: f64,

    /// Minimum acceptable tick rate
    pub min_tick_rate: f64,

    /// Webhook URL for notifications (Slack, Discord, etc.)
    pub webhook_url: Option<String>,

    /// Alert cooldown period in seconds (prevent spam)
    pub cooldown_seconds: u64,
}

impl Default for AlertConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            max_failure_rate: 0.20,     // 20%
            max_replan_rate: 50.0,      // 50 replans/min
            max_llm_latency_ms: 5000.0, // 5 seconds
            min_tick_rate: 10.0,        // 10 ticks/sec
            webhook_url: None,
            cooldown_seconds: 300, // 5 minutes
        }
    }
}

/// Alert severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertSeverity {
    Warning,
    Critical,
}

/// Alert message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub severity: AlertSeverity,
    pub agent_id: String,
    pub metric: String,
    pub current_value: f64,
    pub threshold: f64,
    pub message: String,
    pub timestamp_ms: u64,
}

/// Alert manager
pub struct AlertManager {
    config: Arc<RwLock<AlertConfig>>,
    last_alert_time: Arc<RwLock<std::collections::HashMap<String, u64>>>,
    http_client: reqwest::Client,
}

impl AlertManager {
    /// Create new alert manager
    pub fn new(config: AlertConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            last_alert_time: Arc::new(RwLock::new(std::collections::HashMap::new())),
            http_client: reqwest::Client::new(),
        }
    }

    /// Update alert configuration
    pub async fn update_config(&self, config: AlertConfig) {
        let mut cfg = self.config.write().await;
        *cfg = config;
        info!("Alert configuration updated");
    }

    /// Get current configuration
    pub async fn get_config(&self) -> AlertConfig {
        self.config.read().await.clone()
    }

    /// Check metrics and trigger alerts if needed
    pub async fn check_metrics(
        &self,
        agent_id: &str,
        metrics: &MetricsSummary,
    ) -> Result<Vec<Alert>> {
        let config = self.config.read().await;

        if !config.enabled {
            return Ok(Vec::new());
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis() as u64;

        let mut alerts = Vec::new();

        // Check failure rate
        if metrics.failure_rate > config.max_failure_rate {
            if self
                .should_alert(agent_id, "failure_rate", now, config.cooldown_seconds)
                .await
            {
                let alert = Alert {
                    severity: if metrics.failure_rate > 0.5 {
                        AlertSeverity::Critical
                    } else {
                        AlertSeverity::Warning
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
                };
                alerts.push(alert);
            }
        }

        // Check replan rate (replans per minute)
        let runtime_minutes = metrics.total_execution_ms / 60000.0;
        let replan_rate = if runtime_minutes > 0.0 {
            metrics.total_replans as f64 / runtime_minutes
        } else {
            0.0
        };

        if replan_rate > config.max_replan_rate {
            if self
                .should_alert(agent_id, "replan_rate", now, config.cooldown_seconds)
                .await
            {
                let alert = Alert {
                    severity: AlertSeverity::Warning,
                    agent_id: agent_id.to_string(),
                    metric: "replan_rate".to_string(),
                    current_value: replan_rate,
                    threshold: config.max_replan_rate,
                    message: format!(
                        "High replan rate: {:.1} replans/min (threshold: {:.1})",
                        replan_rate, config.max_replan_rate
                    ),
                    timestamp_ms: now,
                };
                alerts.push(alert);
            }
        }

        // Check LLM latency
        if metrics.avg_llm_latency_ms > config.max_llm_latency_ms {
            if self
                .should_alert(agent_id, "llm_latency", now, config.cooldown_seconds)
                .await
            {
                let alert = Alert {
                    severity: if metrics.avg_llm_latency_ms > config.max_llm_latency_ms * 2.0 {
                        AlertSeverity::Critical
                    } else {
                        AlertSeverity::Warning
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
                };
                alerts.push(alert);
            }
        }

        // Check tick rate
        if metrics.avg_tick_rate > 0.0 && metrics.avg_tick_rate < config.min_tick_rate {
            if self
                .should_alert(agent_id, "tick_rate", now, config.cooldown_seconds)
                .await
            {
                let alert = Alert {
                    severity: AlertSeverity::Warning,
                    agent_id: agent_id.to_string(),
                    metric: "tick_rate".to_string(),
                    current_value: metrics.avg_tick_rate,
                    threshold: config.min_tick_rate,
                    message: format!(
                        "Low tick rate: {:.1} ticks/sec (threshold: {:.1})",
                        metrics.avg_tick_rate, config.min_tick_rate
                    ),
                    timestamp_ms: now,
                };
                alerts.push(alert);
            }
        }

        // Send alerts via webhook
        if !alerts.is_empty() && config.webhook_url.is_some() {
            for alert in &alerts {
                self.send_webhook_alert(alert, &config).await?;
            }
        }

        Ok(alerts)
    }

    /// Check if enough time has passed since last alert (cooldown)
    async fn should_alert(
        &self,
        agent_id: &str,
        metric: &str,
        now: u64,
        cooldown_seconds: u64,
    ) -> bool {
        let key = format!("{}:{}", agent_id, metric);
        let mut last_times = self.last_alert_time.write().await;

        if let Some(&last_time) = last_times.get(&key) {
            let elapsed_seconds = (now - last_time) / 1000;
            if elapsed_seconds < cooldown_seconds {
                return false;
            }
        }

        last_times.insert(key, now);
        true
    }

    /// Send alert to webhook
    async fn send_webhook_alert(&self, alert: &Alert, config: &AlertConfig) -> Result<()> {
        let webhook_url = match &config.webhook_url {
            Some(url) => url,
            None => return Ok(()),
        };

        let color = match alert.severity {
            AlertSeverity::Warning => "#FFA500",  // Orange
            AlertSeverity::Critical => "#FF0000", // Red
        };

        // Generic webhook payload (works with Slack, Discord, etc.)
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
                        "value": format!("{:?}", alert.severity),
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
                ],
                "timestamp": chrono::DateTime::from_timestamp_millis(alert.timestamp_ms as i64)
                    .unwrap()
                    .to_rfc3339()
            }]
        });

        match self
            .http_client
            .post(webhook_url)
            .json(&payload)
            .send()
            .await
        {
            Ok(_) => {
                info!("Alert sent to webhook: {:?}", alert.metric);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to send webhook alert: {}", e);
                Err(e.into())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_alert_creation() {
        let config = AlertConfig {
            enabled: true,
            max_failure_rate: 0.1,
            ..Default::default()
        };

        let manager = AlertManager::new(config);

        let metrics = MetricsSummary {
            total_replans: 5,
            avg_tick_rate: 100.0,
            avg_llm_latency_ms: 500.0,
            watchdog_triggers: 0,
            total_ticks: 100,
            failure_rate: 0.25, // Above threshold
            total_execution_ms: 1000.0,
        };

        let alerts = manager.check_metrics("test-agent", &metrics).await.unwrap();
        assert!(!alerts.is_empty());
        assert_eq!(alerts[0].metric, "failure_rate");
    }

    #[tokio::test]
    async fn test_alert_cooldown() {
        let config = AlertConfig {
            enabled: true,
            max_failure_rate: 0.1,
            cooldown_seconds: 60,
            ..Default::default()
        };

        let manager = AlertManager::new(config);

        let metrics = MetricsSummary {
            total_replans: 0,
            avg_tick_rate: 100.0,
            avg_llm_latency_ms: 500.0,
            watchdog_triggers: 0,
            total_ticks: 100,
            failure_rate: 0.25,
            total_execution_ms: 1000.0,
        };

        // First alert should trigger
        let alerts1 = manager.check_metrics("test-agent", &metrics).await.unwrap();
        assert!(!alerts1.is_empty());

        // Second alert immediately should be suppressed (cooldown)
        let alerts2 = manager.check_metrics("test-agent", &metrics).await.unwrap();
        assert!(alerts2.is_empty());
    }
}
