//! # Schlep-engine Rust SDK
//!
//! Official Rust client for the Schlep-engine API platform.
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use schlep_engine::{SchlepClient, Result};
//! use serde_json::json;
//!
//! #[tokio::main]
//! async fn main() -> Result<()> {
//!     let client = SchlepClient::new("your-api-key")?;
//!
//!     // Process data
//!     let file_data = std::fs::read("data.csv")?;
//!     let job = client.data().process_file(&file_data, "csv").await?;
//!     println!("Processing job ID: {}", job.job_id);
//!
//!     // Create ML pipeline
//!     let pipeline_config = json!({
//!         "name": "My Pipeline",
//!         "task_type": "classification",
//!         "model_type": "random_forest"
//!     });
//!     let pipeline = client.ml().create_pipeline(pipeline_config).await?;
//!     println!("Pipeline ID: {}", pipeline.pipeline_id);
//!
//!     // Train model
//!     let train_config = json!({"epochs": 10});
//!     let training = client.ml().train_pipeline(&pipeline.pipeline_id, train_config).await?;
//!     println!("Training job: {}", training.job_id);
//!
//!     Ok(())
//! }
//! ```
//!
//! ## API Modules
//!
//! The SDK is organized into specialized API clients:
//!
//! - **Data Processing** (`client.data()`): Upload, transform, and validate data
//! - **ML Pipeline** (`client.ml()`): Create pipelines, train models, make predictions
//! - **Analytics** (`client.analytics()`): Execute queries, create reports
//! - **Document Extraction** (`client.document()`): Extract text, tables, images, OCR
//! - **Data Quality** (`client.quality()`): Assess quality, create validation rules
//! - **Storage** (`client.storage()`): Upload, download, list files
//! - **Monitoring** (`client.monitoring()`): Metrics, health checks, alerts
//! - **Users** (`client.users()`): Profile management, API keys
//! - **Admin** (`client.admin()`): User management, system statistics

pub mod api;
pub mod client;
pub mod error;
pub mod types;

pub use client::SchlepClient;
pub use error::{Error, Result};
pub use types::*;

// Re-export API clients for convenience
pub use api::{
    AdminClient, AnalyticsClient, DataClient, DocumentClient, MLClient, MonitoringClient,
    QualityClient, StorageClient, UsersClient,
};

pub const DEFAULT_BASE_URL: &str = "https://api.schlep-engine.com/v1";