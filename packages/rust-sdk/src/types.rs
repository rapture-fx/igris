//! Type definitions for the Schlep-engine Rust SDK.

use serde::{Deserialize, Serialize};

/// Response from the upload endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResponse {
    /// Unique job identifier for the upload.
    pub job_id: String,
    /// Current status of the upload.
    pub status: String,
    /// Optional message with additional details.
    pub message: Option<String>,
}

/// Configuration for training a model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainConfig {
    /// Type of model to train.
    pub model_type: String,
    /// Dataset identifier to use for training.
    pub dataset_id: String,
    /// Training parameters.
    #[serde(default)]
    pub parameters: std::collections::HashMap<String, serde_json::Value>,
}

/// Response from the train endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainResponse {
    /// Unique job identifier for the training.
    pub job_id: String,
    /// Model identifier if training completed.
    pub model_id: Option<String>,
    /// Current status of the training.
    pub status: String,
    /// Optional message with additional details.
    pub message: Option<String>,
}

/// Response from the deploy endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeployResponse {
    /// Unique identifier for the deployment.
    pub deployment_id: String,
    /// URL endpoint for the deployed model.
    pub endpoint_url: String,
    /// Current status of the deployment.
    pub status: String,
    /// Optional message with additional details.
    pub message: Option<String>,
}

/// Response from the status endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusResponse {
    /// Job identifier.
    pub job_id: String,
    /// Current status of the job.
    pub status: String,
    /// Progress percentage (0-100).
    pub progress: Option<f32>,
    /// Optional result data if job completed.
    pub result: Option<serde_json::Value>,
    /// Optional error message if job failed.
    pub error: Option<String>,
    /// Timestamp when the job was created.
    pub created_at: Option<String>,
    /// Timestamp when the job was last updated.
    pub updated_at: Option<String>,
}

/// Event data for streaming.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    /// Event type.
    pub event_type: String,
    /// Event data.
    pub data: serde_json::Value,
    /// Timestamp of the event.
    pub timestamp: String,
}

/// Configuration for streaming events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamConfig {
    /// Types of events to subscribe to.
    pub event_types: Vec<String>,
    /// Optional filters for events.
    #[serde(default)]
    pub filters: std::collections::HashMap<String, serde_json::Value>,
}