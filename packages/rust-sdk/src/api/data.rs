//! Data Processing API client for Schlep-engine.
//!
//! Provides methods for processing, transforming, and validating data.

use serde_json::Value;

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{
    ListParams, ProcessingJobResponse, TransformationResponse, ValidationResponse,
};

/// Client for the Data Processing API.
///
/// Handles data processing operations including file processing,
/// transformations, and schema validation.
///
/// # Example
///
/// ```rust,no_run
/// use schlep_engine::{SchlepClient, Result};
/// use serde_json::json;
///
/// #[tokio::main]
/// async fn main() -> Result<()> {
///     let client = SchlepClient::new("your-api-key")?;
///
///     // Process a file
///     let file_data = std::fs::read("data.csv")?;
///     let result = client.data().process_file(&file_data, "csv").await?;
///     println!("Processing job ID: {}", result.job_id);
///
///     // Apply transformations
///     let transformations = json!({
///         "operations": [
///             {"type": "filter", "column": "age", "operator": ">", "value": 18}
///         ]
///     });
///     let transform_result = client.data()
///         .transform_data(&result.job_id, transformations).await?;
///
///     Ok(())
/// }
/// ```
pub struct DataClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> DataClient<'a> {
    /// Create a new Data Processing API client.
    ///
    /// This is typically called internally by `SchlepClient`.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// Process a data file.
    ///
    /// Uploads and processes a file, returning a job ID for tracking progress.
    ///
    /// # Arguments
    ///
    /// * `file` - File data as bytes
    /// * `format` - Data format (e.g., "csv", "json", "parquet")
    ///
    /// # Returns
    ///
    /// A `ProcessingJobResponse` with the job ID and status.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let file_data = std::fs::read("data.csv")?;
    /// let result = client.data().process_file(&file_data, "csv").await?;
    /// println!("Job ID: {}", result.job_id);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn process_file(&self, file: &[u8], format: &str) -> Result<ProcessingJobResponse> {
        use reqwest::multipart;

        let form = multipart::Form::new()
            .part(
                "file",
                multipart::Part::bytes(file.to_vec())
                    .file_name("upload")
                    .mime_str("application/octet-stream")?,
            )
            .text("format", format.to_string());

        self.client.post_multipart("/data/process", form).await
    }

    /// Apply transformations to processed data.
    ///
    /// # Arguments
    ///
    /// * `job_id` - Processing job identifier
    /// * `transformations` - JSON object defining transformations to apply
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let transformations = json!({
    ///     "operations": [
    ///         {"type": "rename", "from": "old_name", "to": "new_name"},
    ///         {"type": "filter", "column": "age", "operator": ">", "value": 18}
    ///     ]
    /// });
    /// let result = client.data()
    ///     .transform_data("job_123", transformations).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn transform_data(
        &self,
        job_id: &str,
        transformations: Value,
    ) -> Result<TransformationResponse> {
        let body = serde_json::json!({
            "job_id": job_id,
            "transformations": transformations
        });

        self.client.post("/data/transform", body).await
    }

    /// Validate data against a schema.
    ///
    /// # Arguments
    ///
    /// * `job_id` - Processing job identifier
    /// * `schema` - JSON schema definition
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let schema = json!({
    ///     "fields": [
    ///         {"name": "id", "type": "integer", "required": true},
    ///         {"name": "email", "type": "string", "format": "email"}
    ///     ]
    /// });
    /// let result = client.data()
    ///     .validate_schema("job_123", schema).await?;
    /// if result.valid {
    ///     println!("Schema validation passed!");
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn validate_schema(
        &self,
        job_id: &str,
        schema: Value,
    ) -> Result<ValidationResponse> {
        let body = serde_json::json!({
            "job_id": job_id,
            "schema": schema
        });

        self.client.post("/data/validate", body).await
    }

    /// Get processing job details.
    ///
    /// # Arguments
    ///
    /// * `job_id` - Processing job identifier
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let job = client.data().get_job("job_123").await?;
    /// println!("Status: {}", job.status);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_job(&self, job_id: &str) -> Result<ProcessingJobResponse> {
        self.client.get(&format!("/data/jobs/{}", job_id)).await
    }

    /// List processing jobs.
    ///
    /// # Arguments
    ///
    /// * `params` - Optional pagination and filtering parameters
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
    ///     page_size: Some(20),
    ///     status: Some("completed".to_string()),
    /// };
    /// let jobs = client.data().list_jobs(Some(params)).await?;
    /// for job in jobs {
    ///     println!("Job {}: {}", job.job_id, job.status);
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn list_jobs(&self, params: Option<ListParams>) -> Result<Vec<ProcessingJobResponse>> {
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
            format!("/data/jobs?{}", query_string.join("&"))
        } else {
            "/data/jobs".to_string()
        };

        self.client.get(&path).await
    }
}
