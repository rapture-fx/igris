//! Admin API client for Schlep-engine.

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{ListParams, SystemStats, UserSummary};

/// Client for the Admin API.
///
/// Provides administrative methods for managing users and viewing system statistics.
pub struct AdminClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> AdminClient<'a> {
    /// Create a new Admin API client.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// List all users (admin only).
    ///
    /// # Arguments
    ///
    /// * `params` - Optional pagination parameters
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result, ListParams};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let params = ListParams {
    ///     page: Some(1),
    ///     page_size: Some(50),
    ///     status: Some("active".to_string()),
    /// };
    /// let users = client.admin().list_users(Some(params)).await?;
    /// for user in users {
    ///     println!("User: {} ({})", user.email, user.status);
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn list_users(&self, params: Option<ListParams>) -> Result<Vec<UserSummary>> {
        let path = if let Some(p) = params {
            let query_params = serde_json::to_value(p)?;
            let query_string: Vec<String> = query_params
                .as_object()
                .unwrap()
                .iter()
                .filter_map(|(k, v)| {
                    if v.is_null() {
                        None
                    } else {
                        Some(format!("{}={}", k, v.as_str().unwrap_or(&v.to_string())))
                    }
                })
                .collect();
            format!("/admin/users?{}", query_string.join("&"))
        } else {
            "/admin/users".to_string()
        };

        self.client.get(&path).await
    }

    /// Get system statistics (admin only).
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let stats = client.admin().get_system_stats().await?;
    /// println!("Total users: {}", stats.total_users);
    /// println!("Active jobs: {}", stats.active_jobs);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_system_stats(&self) -> Result<SystemStats> {
        self.client.get("/admin/stats").await
    }
}
