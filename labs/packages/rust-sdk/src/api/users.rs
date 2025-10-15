//! Users API client for Schlep-engine.

use serde_json::Value;

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{ApiKeyInfo, UserProfile};

/// Client for the Users API.
///
/// Provides methods for managing user profiles and API keys.
pub struct UsersClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> UsersClient<'a> {
    /// Create a new Users API client.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// Get current user profile.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let profile = client.users().get_profile().await?;
    /// println!("User: {} ({})", profile.email, profile.user_id);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_profile(&self) -> Result<UserProfile> {
        self.client.get("/users/profile").await
    }

    /// Update user profile.
    ///
    /// # Arguments
    ///
    /// * `updates` - Profile fields to update
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let updates = json!({
    ///     "name": "John Doe",
    ///     "preferences": {
    ///         "notifications": true
    ///     }
    /// });
    /// let profile = client.users().update_profile(updates).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn update_profile(&self, updates: Value) -> Result<UserProfile> {
        self.client.put("/users/profile", updates).await
    }

    /// List user's API keys.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let keys = client.users().list_api_keys().await?;
    /// for key in keys {
    ///     println!("Key: {} ({})", key.name, key.key_prefix);
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn list_api_keys(&self) -> Result<Vec<ApiKeyInfo>> {
        self.client.get("/users/api-keys").await
    }

    /// Create a new API key.
    ///
    /// # Arguments
    ///
    /// * `name` - Name for the new API key
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let new_key = client.users()
    ///     .create_api_key("Production Key").await?;
    /// println!("Created key: {}", new_key.key_id);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn create_api_key(&self, name: &str) -> Result<ApiKeyInfo> {
        let body = serde_json::json!({
            "name": name
        });

        self.client.post("/users/api-keys", body).await
    }

    /// Revoke an API key.
    ///
    /// # Arguments
    ///
    /// * `key_id` - API key identifier to revoke
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// client.users().revoke_api_key("key_123").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn revoke_api_key(&self, key_id: &str) -> Result<()> {
        let _: serde_json::Value = self
            .client
            .delete(&format!("/users/api-keys/{}", key_id))
            .await?;
        Ok(())
    }
}
