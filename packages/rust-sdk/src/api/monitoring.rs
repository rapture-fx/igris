//! Monitoring API client for Schlep-engine.

use serde_json::Value;

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{AlertResponse, HealthResponse, MetricsResponse};

/// Client for the Monitoring API.
///
/// Provides methods for getting system metrics, health checks, and alerts.
pub struct MonitoringClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> MonitoringClient<'a> {
    /// Create a new Monitoring API client.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// Get system metrics.
    ///
    /// # Arguments
    ///
    /// * `params` - Query parameters for metrics (time range, metric types, etc.)
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let params = json!({
    ///     "from": "2024-01-01T00:00:00Z",
    ///     "to": "2024-01-31T23:59:59Z",
    ///     "metrics": ["cpu", "memory", "requests"]
    /// });
    /// let metrics = client.monitoring().get_metrics(params).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_metrics(&self, params: Value) -> Result<MetricsResponse> {
        self.client.post("/monitoring/metrics", params).await
    }

    /// Get system health status.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let health = client.monitoring().get_health().await?;
    /// println!("Status: {}", health.status);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_health(&self) -> Result<HealthResponse> {
        self.client.get("/monitoring/health").await
    }

    /// List active alerts.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let alerts = client.monitoring().list_alerts().await?;
    /// for alert in alerts {
    ///     println!("Alert: {} - {}", alert.severity, alert.message);
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn list_alerts(&self) -> Result<Vec<AlertResponse>> {
        self.client.get("/monitoring/alerts").await
    }
}
