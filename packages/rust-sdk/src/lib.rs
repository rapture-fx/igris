//! # Schlep-engine Rust SDK
//!
//! Official Rust client for the Schlep-engine API platform.
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use schlep_engine::{SchlepClient, Result};
//!
//! #[tokio::main]
//! async fn main() -> Result<()> {
//!     let client = SchlepClient::new("your-api-key")?;
//!
//!     // Upload data
//!     let upload_result = client.upload("Hello, world!").await?;
//!     println!("Upload job ID: {}", upload_result.job_id);
//!
//!     // Train a model
//!     let train_config = serde_json::json!({
//!         "model_type": "classification",
//!         "dataset_id": upload_result.job_id
//!     });
//!     let train_result = client.train(train_config).await?;
//!
//!     // Deploy model
//!     if let Some(model_id) = &train_result.model_id {
//!         let deploy_result = client.deploy(model_id).await?;
//!         println!("Model deployed at: {}", deploy_result.endpoint_url);
//!     }
//!
//!     Ok(())
//! }
//! ```

pub mod client;
pub mod error;
pub mod types;

pub use client::SchlepClient;
pub use error::{Error, Result};
pub use types::*;

pub const DEFAULT_BASE_URL: &str = "https://api.schlep-engine.com/v1";