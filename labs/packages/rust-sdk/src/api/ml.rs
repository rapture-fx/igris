//! Machine Learning Pipeline API client for Schlep-engine.
//!
//! Provides methods for creating ML pipelines, training models, and making predictions.

use serde_json::Value;

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{
    DeploymentResponse, ListParams, PipelineResponse, PredictionResponse, TrainingJobResponse,
};

/// Client for the ML Pipeline API.
///
/// Handles machine learning operations including pipeline creation,
/// model training, deployment, and predictions.
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
///     // Create an ML pipeline
///     let config = json!({
///         "name": "Classification Pipeline",
///         "task_type": "classification",
///         "model_type": "random_forest"
///     });
///     let pipeline = client.ml().create_pipeline(config).await?;
///
///     // Train the pipeline
///     let training_config = json!({"epochs": 10});
///     let job = client.ml()
///         .train_pipeline(&pipeline.pipeline_id, training_config).await?;
///
///     Ok(())
/// }
/// ```
pub struct MLClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> MLClient<'a> {
    /// Create a new ML Pipeline API client.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// Create a new ML pipeline.
    ///
    /// # Arguments
    ///
    /// * `config` - Pipeline configuration including task type, model type, etc.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let config = json!({
    ///     "name": "My Pipeline",
    ///     "task_type": "regression",
    ///     "model_type": "xgboost",
    ///     "target_column": "price"
    /// });
    /// let pipeline = client.ml().create_pipeline(config).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn create_pipeline(&self, config: Value) -> Result<PipelineResponse> {
        self.client.post("/ml/pipelines", config).await
    }

    /// Get pipeline details.
    ///
    /// # Arguments
    ///
    /// * `pipeline_id` - Pipeline identifier
    pub async fn get_pipeline(&self, pipeline_id: &str) -> Result<PipelineResponse> {
        self.client
            .get(&format!("/ml/pipelines/{}", pipeline_id))
            .await
    }

    /// List ML pipelines.
    ///
    /// # Arguments
    ///
    /// * `params` - Optional pagination and filtering parameters
    pub async fn list_pipelines(
        &self,
        params: Option<ListParams>,
    ) -> Result<Vec<PipelineResponse>> {
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
            format!("/ml/pipelines?{}", query_string.join("&"))
        } else {
            "/ml/pipelines".to_string()
        };

        self.client.get(&path).await
    }

    /// Train a pipeline.
    ///
    /// # Arguments
    ///
    /// * `pipeline_id` - Pipeline identifier
    /// * `config` - Training configuration (epochs, batch_size, etc.)
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let config = json!({
    ///     "epochs": 50,
    ///     "batch_size": 32,
    ///     "learning_rate": 0.001
    /// });
    /// let job = client.ml()
    ///     .train_pipeline("pipeline_123", config).await?;
    /// println!("Training job: {}", job.job_id);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn train_pipeline(
        &self,
        pipeline_id: &str,
        config: Value,
    ) -> Result<TrainingJobResponse> {
        let body = serde_json::json!({
            "pipeline_id": pipeline_id,
            "config": config
        });

        self.client.post("/ml/train", body).await
    }

    /// Get training job status and details.
    ///
    /// # Arguments
    ///
    /// * `job_id` - Training job identifier
    pub async fn get_training_job(&self, job_id: &str) -> Result<TrainingJobResponse> {
        self.client
            .get(&format!("/ml/training/{}", job_id))
            .await
    }

    /// Deploy a trained model.
    ///
    /// # Arguments
    ///
    /// * `model_id` - Model identifier from training job
    /// * `config` - Optional deployment configuration
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let config = json!({
    ///     "replicas": 3,
    ///     "auto_scale": true
    /// });
    /// let deployment = client.ml()
    ///     .deploy_model("model_123", Some(config)).await?;
    /// println!("Endpoint: {}", deployment.endpoint_url);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn deploy_model(
        &self,
        model_id: &str,
        config: Option<Value>,
    ) -> Result<DeploymentResponse> {
        let body = serde_json::json!({
            "model_id": model_id,
            "config": config.unwrap_or(Value::Object(serde_json::Map::new()))
        });

        self.client.post("/ml/deploy", body).await
    }

    /// Make predictions using a deployed model.
    ///
    /// # Arguments
    ///
    /// * `endpoint` - Model endpoint URL or identifier
    /// * `data` - Input data for prediction
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let input_data = json!({
    ///     "features": [1.5, 2.3, 3.1, 4.2]
    /// });
    /// let prediction = client.ml()
    ///     .predict("model_123", input_data).await?;
    /// println!("Prediction: {:?}", prediction.predictions);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn predict(&self, endpoint: &str, data: Value) -> Result<PredictionResponse> {
        let body = serde_json::json!({
            "endpoint": endpoint,
            "data": data
        });

        self.client.post("/ml/predict", body).await
    }
}
