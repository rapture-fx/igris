//! Analytics API client for Schlep-engine.

use serde_json::Value;

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{DatasetResponse, QueryResponse, ReportResponse};

/// Client for the Analytics API.
///
/// Provides methods for executing queries, creating reports, and managing datasets.
pub struct AnalyticsClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> AnalyticsClient<'a> {
    /// Create a new Analytics API client.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// Execute an analytics query.
    ///
    /// # Arguments
    ///
    /// * `query` - Query definition
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let query = json!({
    ///     "sql": "SELECT * FROM users WHERE age > 18",
    ///     "dataset_id": "dataset_123"
    /// });
    /// let result = client.analytics().execute_query(query).await?;
    /// println!("Rows: {}", result.row_count);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn execute_query(&self, query: Value) -> Result<QueryResponse> {
        self.client.post("/analytics/query", query).await
    }

    /// Create a report.
    ///
    /// # Arguments
    ///
    /// * `config` - Report configuration
    pub async fn create_report(&self, config: Value) -> Result<ReportResponse> {
        self.client.post("/analytics/reports", config).await
    }

    /// Get report details.
    ///
    /// # Arguments
    ///
    /// * `report_id` - Report identifier
    pub async fn get_report(&self, report_id: &str) -> Result<ReportResponse> {
        self.client
            .get(&format!("/analytics/reports/{}", report_id))
            .await
    }

    /// Create a dataset.
    ///
    /// # Arguments
    ///
    /// * `config` - Dataset configuration
    pub async fn create_dataset(&self, config: Value) -> Result<DatasetResponse> {
        self.client.post("/analytics/datasets", config).await
    }

    /// Get dataset details.
    ///
    /// # Arguments
    ///
    /// * `dataset_id` - Dataset identifier
    pub async fn get_dataset(&self, dataset_id: &str) -> Result<DatasetResponse> {
        self.client
            .get(&format!("/analytics/datasets/{}", dataset_id))
            .await
    }
}
