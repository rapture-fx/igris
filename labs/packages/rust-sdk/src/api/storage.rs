//! Storage API client for Schlep-engine.

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{FileMetadata, FileUploadResponse, ListParams};

/// Client for the Storage API.
///
/// Provides methods for uploading, downloading, listing, and deleting files.
pub struct StorageClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> StorageClient<'a> {
    /// Create a new Storage API client.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// Upload a file to storage.
    ///
    /// # Arguments
    ///
    /// * `file` - File data as bytes
    /// * `filename` - Name for the uploaded file
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let file_data = std::fs::read("data.csv")?;
    /// let result = client.storage()
    ///     .upload_file(&file_data, "data.csv").await?;
    /// println!("File ID: {}", result.file_id);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn upload_file(&self, file: &[u8], filename: &str) -> Result<FileUploadResponse> {
        use reqwest::multipart;

        let form = multipart::Form::new().part(
            "file",
            multipart::Part::bytes(file.to_vec())
                .file_name(filename.to_string())
                .mime_str("application/octet-stream")?,
        );

        self.client.post_multipart("/storage/upload", form).await
    }

    /// Download a file from storage.
    ///
    /// # Arguments
    ///
    /// * `file_id` - File identifier
    ///
    /// # Returns
    ///
    /// File data as bytes
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let file_data = client.storage()
    ///     .download_file("file_123").await?;
    /// std::fs::write("downloaded.csv", file_data)?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn download_file(&self, file_id: &str) -> Result<Vec<u8>> {
        self.client
            .download(&format!("/storage/files/{}/download", file_id))
            .await
    }

    /// List files in storage.
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
    /// let files = client.storage().list_files(None).await?;
    /// for file in files {
    ///     println!("File: {} ({})", file.filename, file.file_id);
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn list_files(&self, params: Option<ListParams>) -> Result<Vec<FileMetadata>> {
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
            format!("/storage/files?{}", query_string.join("&"))
        } else {
            "/storage/files".to_string()
        };

        self.client.get(&path).await
    }

    /// Delete a file from storage.
    ///
    /// # Arguments
    ///
    /// * `file_id` - File identifier
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// client.storage().delete_file("file_123").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn delete_file(&self, file_id: &str) -> Result<()> {
        let _: serde_json::Value = self
            .client
            .delete(&format!("/storage/files/{}", file_id))
            .await?;
        Ok(())
    }
}
