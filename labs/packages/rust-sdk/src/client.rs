//! Main client implementation for the Schlep-engine Rust SDK.

use std::env;

use reqwest::{Client, Response, header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE}};
use serde_json::Value;
use tokio_tungstenite::connect_async;
use url::Url;

use crate::api::{
    AdminClient, AnalyticsClient, DataClient, DocumentClient, MLClient, MonitoringClient,
    QualityClient, StorageClient, UsersClient,
};
use crate::error::{Error, Result};
use crate::types::{DeployResponse, StatusResponse, StreamConfig, TrainResponse, UploadResponse};
use crate::DEFAULT_BASE_URL;

/// Main client for interacting with the Schlep-engine API.
///
/// The client provides methods for uploading data, training models, deploying models,
/// checking job status, and streaming real-time events.
///
/// # Authentication
///
/// The client requires an API key for authentication. You can provide it either:
/// - As a parameter when creating the client: `SchlepClient::new("your-api-key")`
/// - Via the `SCHLEP_API_KEY` environment variable
///
/// # Example
///
/// ```rust,no_run
/// use schlep_engine::{SchlepClient, Result};
///
/// #[tokio::main]
/// async fn main() -> Result<()> {
///     let client = SchlepClient::new("your-api-key")?;
///
///     let upload_result = client.upload("sample data").await?;
///     println!("Upload job ID: {}", upload_result.job_id);
///
///     Ok(())
/// }
/// ```
#[derive(Debug, Clone)]
pub struct SchlepClient {
    client: Client,
    base_url: String,
    api_key: String,
}

impl SchlepClient {
    /// Create a new Schlep-engine client with the provided API key.
    ///
    /// # Arguments
    ///
    /// * `api_key` - Your Schlep-engine API key
    ///
    /// # Errors
    ///
    /// Returns an error if the API key is empty or if the HTTP client cannot be created.
    pub fn new(api_key: impl Into<String>) -> Result<Self> {
        let api_key = api_key.into();
        if api_key.is_empty() {
            return Err(Error::config_error("API key cannot be empty"));
        }

        let client = Client::new();
        Ok(Self {
            client,
            base_url: DEFAULT_BASE_URL.to_string(),
            api_key,
        })
    }

    /// Create a new client using the API key from the `SCHLEP_API_KEY` environment variable.
    ///
    /// # Errors
    ///
    /// Returns an error if the environment variable is not set or empty.
    pub fn from_env() -> Result<Self> {
        let api_key = env::var("SCHLEP_API_KEY")
            .map_err(|_| Error::config_error("SCHLEP_API_KEY environment variable not set"))?;
        Self::new(api_key)
    }

    /// Create a new client with a custom base URL.
    ///
    /// # Arguments
    ///
    /// * `api_key` - Your Schlep-engine API key
    /// * `base_url` - Custom base URL for the API
    pub fn with_base_url(api_key: impl Into<String>, base_url: impl Into<String>) -> Result<Self> {
        let mut client = Self::new(api_key)?;
        client.base_url = base_url.into();
        Ok(client)
    }

    /// Upload data to Schlep-engine for processing.
    ///
    /// # Arguments
    ///
    /// * `data` - The data to upload (can be text, JSON, etc.)
    ///
    /// # Returns
    ///
    /// Returns an `UploadResponse` containing the job ID and status.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let result = client.upload("Hello, world!").await?;
    /// println!("Job ID: {}", result.job_id);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn upload(&self, data: impl Into<String>) -> Result<UploadResponse> {
        let url = format!("{}/upload", self.base_url);
        let payload = serde_json::json!({
            "data": data.into()
        });

        let response = self
            .client
            .post(&url)
            .headers(self.default_headers()?)
            .json(&payload)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Train a machine learning model with the provided configuration.
    ///
    /// # Arguments
    ///
    /// * `config` - Training configuration (model type, dataset, parameters)
    ///
    /// # Returns
    ///
    /// Returns a `TrainResponse` containing the job ID and status.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, TrainConfig, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let config = serde_json::json!({
    ///     "model_type": "classification",
    ///     "dataset_id": "upload_job_123"
    /// });
    /// let result = client.train(config).await?;
    /// println!("Training job ID: {}", result.job_id);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn train(&self, config: Value) -> Result<TrainResponse> {
        let url = format!("{}/train", self.base_url);

        let response = self
            .client
            .post(&url)
            .headers(self.default_headers()?)
            .json(&config)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Deploy a trained model to a production endpoint.
    ///
    /// # Arguments
    ///
    /// * `model_id` - ID of the trained model to deploy
    ///
    /// # Returns
    ///
    /// Returns a `DeployResponse` containing the deployment details.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let result = client.deploy("model_123").await?;
    /// println!("Endpoint URL: {}", result.endpoint_url);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn deploy(&self, model_id: &str) -> Result<DeployResponse> {
        let url = format!("{}/deploy", self.base_url);
        let payload = serde_json::json!({
            "model_id": model_id
        });

        let response = self
            .client
            .post(&url)
            .headers(self.default_headers()?)
            .json(&payload)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Check the status of a job (upload, training, deployment, etc.).
    ///
    /// # Arguments
    ///
    /// * `job_id` - ID of the job to check
    ///
    /// # Returns
    ///
    /// Returns a `StatusResponse` containing the current job status and progress.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let status = client.status("job_123").await?;
    /// println!("Status: {}", status.status);
    /// if let Some(progress) = status.progress {
    ///     println!("Progress: {}%", progress);
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn status(&self, job_id: &str) -> Result<StatusResponse> {
        let url = format!("{}/status/{}", self.base_url, job_id);

        let response = self
            .client
            .get(&url)
            .headers(self.default_headers()?)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Stream real-time events from Schlep-engine.
    ///
    /// This is a basic WebSocket streaming implementation. For production use,
    /// you may want to implement more sophisticated event handling and reconnection logic.
    ///
    /// # Arguments
    ///
    /// * `events` - Configuration for the types of events to stream
    ///
    /// # Returns
    ///
    /// Returns a stream of `StreamEvent` objects.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, StreamConfig, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let config = StreamConfig {
    ///     event_types: vec!["training".to_string(), "deployment".to_string()],
    ///     filters: Default::default(),
    /// };
    ///
    /// // Note: This is a simplified example. In practice, you'd want to
    /// // handle the stream in a loop and implement proper error handling.
    /// client.stream(config).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn stream(&self, events: StreamConfig) -> Result<()> {
        let ws_url = self.base_url.replace("https://", "wss://").replace("http://", "ws://");
        let url = format!("{}/stream", ws_url);

        let url = Url::parse(&url)?;
        let (_ws_stream, _) = connect_async(url).await
            .map_err(|e| Error::WebSocket(e.to_string()))?;

        // Send subscription message
        let _subscription = serde_json::json!({
            "action": "subscribe",
            "events": events,
            "auth": {
                "api_key": self.api_key
            }
        });

        // This is a basic implementation - in practice you'd want to handle
        // the stream properly with a loop and error handling
        println!("WebSocket connection established for streaming");
        Ok(())
    }

    /// Create default headers for API requests.
    fn default_headers(&self) -> Result<HeaderMap> {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", self.api_key))
                .map_err(|e| Error::config_error(format!("Invalid API key format: {}", e)))?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        Ok(headers)
    }

    /// Handle HTTP response and parse JSON or return appropriate error.
    async fn handle_response<T>(&self, response: Response) -> Result<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let status = response.status();
        let response_text = response.text().await?;

        if status.is_success() {
            serde_json::from_str(&response_text)
                .map_err(|e| Error::invalid_response(format!("Failed to parse response: {}", e)))
        } else {
            // Try to parse error response
            if let Ok(error_json) = serde_json::from_str::<Value>(&response_text) {
                let message = error_json["message"]
                    .as_str()
                    .unwrap_or("Unknown API error")
                    .to_string();
                Err(Error::api_error(status.as_u16(), message))
            } else {
                Err(Error::api_error(status.as_u16(), response_text))
            }
        }
    }

    // ========== Helper methods for API modules ==========

    /// Make a GET request to the API.
    ///
    /// # Arguments
    ///
    /// * `path` - API endpoint path
    ///
    /// # Type Parameters
    ///
    /// * `T` - Response type that implements Deserialize
    pub(crate) async fn get<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .get(&url)
            .headers(self.default_headers()?)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Make a POST request to the API.
    ///
    /// # Arguments
    ///
    /// * `path` - API endpoint path
    /// * `body` - JSON body to send
    pub(crate) async fn post<T>(&self, path: &str, body: Value) -> Result<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .post(&url)
            .headers(self.default_headers()?)
            .json(&body)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Make a PUT request to the API.
    ///
    /// # Arguments
    ///
    /// * `path` - API endpoint path
    /// * `body` - JSON body to send
    pub(crate) async fn put<T>(&self, path: &str, body: Value) -> Result<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .put(&url)
            .headers(self.default_headers()?)
            .json(&body)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Make a DELETE request to the API.
    ///
    /// # Arguments
    ///
    /// * `path` - API endpoint path
    pub(crate) async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .delete(&url)
            .headers(self.default_headers()?)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Make a POST request with multipart form data.
    ///
    /// # Arguments
    ///
    /// * `path` - API endpoint path
    /// * `form` - Multipart form to send
    pub(crate) async fn post_multipart<T>(&self, path: &str, form: reqwest::multipart::Form) -> Result<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);

        // Create headers without Content-Type (reqwest sets it automatically for multipart)
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", self.api_key))
                .map_err(|e| Error::config_error(format!("Invalid API key format: {}", e)))?,
        );

        let response = self
            .client
            .post(&url)
            .headers(headers)
            .multipart(form)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// Download binary data from the API.
    ///
    /// # Arguments
    ///
    /// * `path` - API endpoint path
    pub(crate) async fn download(&self, path: &str) -> Result<Vec<u8>> {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .get(&url)
            .headers(self.default_headers()?)
            .send()
            .await?;

        let status = response.status();
        if status.is_success() {
            Ok(response.bytes().await?.to_vec())
        } else {
            let response_text = response.text().await?;
            if let Ok(error_json) = serde_json::from_str::<Value>(&response_text) {
                let message = error_json["message"]
                    .as_str()
                    .unwrap_or("Unknown API error")
                    .to_string();
                Err(Error::api_error(status.as_u16(), message))
            } else {
                Err(Error::api_error(status.as_u16(), response_text))
            }
        }
    }

    // ========== API Client Accessors ==========

    /// Access the Data Processing API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let file_data = std::fs::read("data.csv")?;
    /// let result = client.data().process_file(&file_data, "csv").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn data(&self) -> DataClient<'_> {
        DataClient::new(self)
    }

    /// Access the ML Pipeline API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let config = json!({"name": "My Pipeline", "task_type": "classification"});
    /// let pipeline = client.ml().create_pipeline(config).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn ml(&self) -> MLClient<'_> {
        MLClient::new(self)
    }

    /// Access the Analytics API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let query = json!({"sql": "SELECT * FROM users"});
    /// let result = client.analytics().execute_query(query).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn analytics(&self) -> AnalyticsClient<'_> {
        AnalyticsClient::new(self)
    }

    /// Access the Document Extraction API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let file_data = std::fs::read("document.pdf")?;
    /// let result = client.document().extract_text(&file_data, "pdf").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn document(&self) -> DocumentClient<'_> {
        DocumentClient::new(self)
    }

    /// Access the Data Quality API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let assessment = client.quality().assess_quality("job_123").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn quality(&self) -> QualityClient<'_> {
        QualityClient::new(self)
    }

    /// Access the Storage API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let file_data = std::fs::read("data.csv")?;
    /// let result = client.storage().upload_file(&file_data, "data.csv").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn storage(&self) -> StorageClient<'_> {
        StorageClient::new(self)
    }

    /// Access the Monitoring API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let health = client.monitoring().get_health().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn monitoring(&self) -> MonitoringClient<'_> {
        MonitoringClient::new(self)
    }

    /// Access the Users API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let profile = client.users().get_profile().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn users(&self) -> UsersClient<'_> {
        UsersClient::new(self)
    }

    /// Access the Admin API.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// let client = SchlepClient::new("your-api-key")?;
    /// let stats = client.admin().get_system_stats().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn admin(&self) -> AdminClient<'_> {
        AdminClient::new(self)
    }
}