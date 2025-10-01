//! Type definitions for the Schlep-engine Rust SDK.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ========== Common Types ==========

/// Parameters for paginated list requests.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ListParams {
    /// Page number (1-indexed).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    /// Number of items per page.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<u32>,
    /// Filter by status.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

/// Paginated response wrapper.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    /// Items in current page.
    pub items: Vec<T>,
    /// Total number of items.
    pub total: u64,
    /// Current page number.
    pub page: u32,
    /// Number of items per page.
    pub page_size: u32,
    /// Total number of pages.
    pub total_pages: u32,
}

// ========== Legacy Types (for backward compatibility) ==========

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
    pub parameters: HashMap<String, serde_json::Value>,
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
    pub filters: HashMap<String, serde_json::Value>,
}

// ========== Data Processing Types ==========

/// Response from data processing operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingJobResponse {
    /// Job identifier.
    pub job_id: String,
    /// Job status.
    pub status: String,
    /// Optional result data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    /// Created timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    /// Updated timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

/// Response from data transformation operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformationResponse {
    /// Job identifier.
    pub job_id: String,
    /// Transformation status.
    pub status: String,
    /// Transformations applied.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transformations_applied: Option<Vec<String>>,
}

/// Response from schema validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResponse {
    /// Whether validation passed.
    pub valid: bool,
    /// Validation errors if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<String>>,
    /// Validation warnings.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
}

// ========== ML Pipeline Types ==========

/// ML pipeline configuration and details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineResponse {
    /// Pipeline identifier.
    pub pipeline_id: String,
    /// Pipeline name.
    pub name: String,
    /// Pipeline status.
    pub status: String,
    /// Pipeline configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<serde_json::Value>,
    /// Created timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

/// Training job information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingJobResponse {
    /// Job identifier.
    pub job_id: String,
    /// Associated pipeline ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pipeline_id: Option<String>,
    /// Training status.
    pub status: String,
    /// Training progress (0-100).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<f32>,
    /// Model ID if training completed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    /// Training metrics.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<serde_json::Value>,
}

/// Model deployment response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentResponse {
    /// Deployment identifier.
    pub deployment_id: String,
    /// Model identifier.
    pub model_id: String,
    /// Endpoint URL.
    pub endpoint_url: String,
    /// Deployment status.
    pub status: String,
}

/// Prediction result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionResponse {
    /// Predictions.
    pub predictions: serde_json::Value,
    /// Model identifier used.
    pub model_id: String,
    /// Optional probabilities.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probabilities: Option<serde_json::Value>,
}

// ========== Analytics Types ==========

/// Query execution result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResponse {
    /// Query identifier.
    pub query_id: String,
    /// Query results.
    pub results: serde_json::Value,
    /// Number of rows returned.
    pub row_count: u64,
    /// Execution time in milliseconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_time_ms: Option<u64>,
}

/// Report information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportResponse {
    /// Report identifier.
    pub report_id: String,
    /// Report name.
    pub name: String,
    /// Report status.
    pub status: String,
    /// Report data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Dataset information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetResponse {
    /// Dataset identifier.
    pub dataset_id: String,
    /// Dataset name.
    pub name: String,
    /// Number of rows.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_count: Option<u64>,
    /// Number of columns.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column_count: Option<u32>,
}

// ========== Document Extraction Types ==========

/// Text extraction result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResponse {
    /// Extracted text.
    pub text: String,
    /// Document metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    /// Page count.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_count: Option<u32>,
}

/// Table extraction result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableExtractionResponse {
    /// Extracted tables.
    pub tables: Vec<serde_json::Value>,
    /// Number of tables found.
    pub table_count: usize,
}

/// Image extraction result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageExtractionResponse {
    /// Extracted image URLs or data.
    pub images: Vec<String>,
    /// Number of images found.
    pub image_count: usize,
}

/// OCR processing result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResponse {
    /// Recognized text.
    pub text: String,
    /// Confidence score (0-1).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f32>,
    /// Language detected.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

// ========== Data Quality Types ==========

/// Quality assessment result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityAssessmentResponse {
    /// Overall quality score (0-100).
    pub quality_score: f32,
    /// Issues found.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issues: Option<Vec<QualityIssue>>,
    /// Metrics.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<serde_json::Value>,
}

/// Quality issue details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityIssue {
    /// Issue type.
    pub issue_type: String,
    /// Issue severity.
    pub severity: String,
    /// Issue description.
    pub description: String,
    /// Affected rows/columns.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affected: Option<serde_json::Value>,
}

/// Quality rule information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityRuleResponse {
    /// Rule identifier.
    pub rule_id: String,
    /// Rule name.
    pub name: String,
    /// Rule configuration.
    pub config: serde_json::Value,
}

/// Validation result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResultResponse {
    /// Whether validation passed.
    pub passed: bool,
    /// Validation results.
    pub results: Vec<ValidationResult>,
}

/// Individual validation result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    /// Rule identifier.
    pub rule_id: String,
    /// Whether rule passed.
    pub passed: bool,
    /// Error message if failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ========== Storage Types ==========

/// File upload result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileUploadResponse {
    /// File identifier.
    pub file_id: String,
    /// File URL.
    pub url: String,
    /// File size in bytes.
    pub size: u64,
}

/// File metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    /// File identifier.
    pub file_id: String,
    /// File name.
    pub filename: String,
    /// File size in bytes.
    pub size: u64,
    /// Content type.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    /// Upload timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uploaded_at: Option<String>,
}

// ========== Monitoring Types ==========

/// System metrics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsResponse {
    /// Metrics data.
    pub metrics: serde_json::Value,
    /// Timestamp.
    pub timestamp: String,
}

/// Health check response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    /// Service status.
    pub status: String,
    /// Service version.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Component statuses.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<HashMap<String, String>>,
}

/// Alert information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertResponse {
    /// Alert identifier.
    pub alert_id: String,
    /// Alert type.
    pub alert_type: String,
    /// Alert severity.
    pub severity: String,
    /// Alert message.
    pub message: String,
    /// Alert timestamp.
    pub timestamp: String,
}

// ========== Users Types ==========

/// User profile information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    /// User identifier.
    pub user_id: String,
    /// User email.
    pub email: String,
    /// User name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Account created timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

/// API key information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyInfo {
    /// Key identifier.
    pub key_id: String,
    /// Key name.
    pub name: String,
    /// Key prefix (partial key for identification).
    pub key_prefix: String,
    /// Created timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    /// Last used timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
}

// ========== Admin Types ==========

/// User summary for admin operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSummary {
    /// User identifier.
    pub user_id: String,
    /// User email.
    pub email: String,
    /// User status.
    pub status: String,
    /// Registration timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registered_at: Option<String>,
}

/// System statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    /// Total users.
    pub total_users: u64,
    /// Total jobs.
    pub total_jobs: u64,
    /// Active jobs.
    pub active_jobs: u64,
    /// Additional statistics.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub additional_stats: Option<HashMap<String, serde_json::Value>>,
}