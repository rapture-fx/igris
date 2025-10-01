//! Document Extraction API client for Schlep-engine.

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{
    ExtractionResponse, ImageExtractionResponse, OCRResponse, TableExtractionResponse,
};

/// Client for the Document Extraction API.
///
/// Provides methods for extracting text, tables, images, and performing OCR.
pub struct DocumentClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> DocumentClient<'a> {
    /// Create a new Document Extraction API client.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// Extract text from a document.
    ///
    /// # Arguments
    ///
    /// * `file` - Document file as bytes
    /// * `format` - Document format (e.g., "pdf", "docx", "txt")
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let file_data = std::fs::read("document.pdf")?;
    /// let result = client.document()
    ///     .extract_text(&file_data, "pdf").await?;
    /// println!("Extracted text: {}", result.text);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn extract_text(&self, file: &[u8], format: &str) -> Result<ExtractionResponse> {
        use reqwest::multipart;

        let form = multipart::Form::new()
            .part(
                "file",
                multipart::Part::bytes(file.to_vec())
                    .file_name("document")
                    .mime_str("application/octet-stream")?,
            )
            .text("format", format.to_string());

        self.client.post_multipart("/document/extract/text", form).await
    }

    /// Extract tables from a document.
    ///
    /// # Arguments
    ///
    /// * `file` - Document file as bytes
    pub async fn extract_tables(&self, file: &[u8]) -> Result<TableExtractionResponse> {
        use reqwest::multipart;

        let form = multipart::Form::new().part(
            "file",
            multipart::Part::bytes(file.to_vec())
                .file_name("document")
                .mime_str("application/octet-stream")?,
        );

        self.client.post_multipart("/document/extract/tables", form).await
    }

    /// Extract images from a document.
    ///
    /// # Arguments
    ///
    /// * `file` - Document file as bytes
    pub async fn extract_images(&self, file: &[u8]) -> Result<ImageExtractionResponse> {
        use reqwest::multipart;

        let form = multipart::Form::new().part(
            "file",
            multipart::Part::bytes(file.to_vec())
                .file_name("document")
                .mime_str("application/octet-stream")?,
        );

        self.client.post_multipart("/document/extract/images", form).await
    }

    /// Perform OCR on a document or image.
    ///
    /// # Arguments
    ///
    /// * `file` - Document/image file as bytes
    /// * `language` - Optional language code (e.g., "en", "es", "fr")
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let image_data = std::fs::read("scan.jpg")?;
    /// let result = client.document()
    ///     .ocr(&image_data, Some("en")).await?;
    /// println!("OCR text: {}", result.text);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn ocr(&self, file: &[u8], language: Option<&str>) -> Result<OCRResponse> {
        use reqwest::multipart;

        let mut form = multipart::Form::new().part(
            "file",
            multipart::Part::bytes(file.to_vec())
                .file_name("image")
                .mime_str("application/octet-stream")?,
        );

        if let Some(lang) = language {
            form = form.text("language", lang.to_string());
        }

        self.client.post_multipart("/document/ocr", form).await
    }
}
