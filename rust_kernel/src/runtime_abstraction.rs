// ============================================================================
// Runtime Abstraction Layer for Schlep-Engine
// ============================================================================
//
// Provides a unified interface for inference execution across multiple runtimes:
// - RustNativeRuntime: Local inference via FFI
// - PythonGrpcRuntime: Remote inference via gRPC
// - Future: WasmRuntime for edge deployment
//
// This abstraction enables runtime selection based on:
// - Model complexity
// - Latency requirements
// - Resource availability
// - Deployment context
//
// Phase: 2 - Runtime Abstraction
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

// ============================================================================
// Core Types
// ============================================================================

/// Prediction request structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictRequest {
    /// Model identifier (e.g., "iris", "fraud-detector-v2")
    pub model_id: String,

    /// Feature vector for prediction
    pub features: Vec<f64>,

    /// Optional metadata (request ID, user context, etc.)
    pub metadata: HashMap<String, String>,
}

/// Prediction response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictResponse {
    /// Prediction value (regression) or primary class score (classification)
    pub prediction: f64,

    /// Confidence score [0.0, 1.0]
    pub confidence: f64,

    /// Model ID that generated this prediction
    pub model_id: String,

    /// Inference latency in milliseconds
    pub latency_ms: i64,

    /// Class probabilities for classification (class_name -> probability)
    pub probabilities: HashMap<String, f64>,

    /// Optional metadata (trace ID, model version, etc.)
    pub metadata: HashMap<String, String>,
}

/// Health check status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub status: HealthStatus,
    pub version: String,
    pub uptime_seconds: i64,
    pub loaded_models_count: i32,
    pub loaded_models: Vec<String>,
    pub system_metrics: HashMap<String, String>,
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub model_id: String,
    pub model_type: String,
    pub version: String,
    pub input_features: Vec<String>,
    pub output_classes: Vec<String>,
    pub loaded: bool,
    pub size_bytes: i64,
    pub metadata: HashMap<String, String>,
}

// ============================================================================
// Error Types
// ============================================================================

/// Runtime error types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RuntimeError {
    /// Model not found in the runtime
    ModelNotFound(String),

    /// Invalid input dimensions or features
    InvalidInput(String),

    /// Runtime connection failure (e.g., gRPC connection down)
    ConnectionError(String),

    /// Timeout during prediction
    Timeout(String),

    /// Model loading failure
    LoadError(String),

    /// Internal runtime error
    InternalError(String),

    /// Serialization/deserialization error
    SerializationError(String),

    /// Panic caught from FFI boundary
    PanicError(String),
}

impl std::fmt::Display for RuntimeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RuntimeError::ModelNotFound(msg) => write!(f, "Model not found: {}", msg),
            RuntimeError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            RuntimeError::ConnectionError(msg) => write!(f, "Connection error: {}", msg),
            RuntimeError::Timeout(msg) => write!(f, "Timeout: {}", msg),
            RuntimeError::LoadError(msg) => write!(f, "Load error: {}", msg),
            RuntimeError::InternalError(msg) => write!(f, "Internal error: {}", msg),
            RuntimeError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            RuntimeError::PanicError(msg) => write!(f, "Panic error: {}", msg),
        }
    }
}

impl std::error::Error for RuntimeError {}

// ============================================================================
// Runtime Trait
// ============================================================================

/// Core trait for inference runtimes
///
/// All runtime implementations (Rust, Python gRPC, WASM) must implement this trait.
/// This enables:
/// - Runtime switching without code changes
/// - A/B testing across runtimes
/// - Graceful fallback on runtime failure
/// - Hybrid execution (local + remote)
pub trait InferenceRuntime: Send + Sync {
    /// Execute prediction on the given features
    ///
    /// # Arguments
    /// * `request` - Prediction request with model_id and features
    ///
    /// # Returns
    /// * `Ok(PredictResponse)` - Successful prediction with confidence and metadata
    /// * `Err(RuntimeError)` - Prediction failure (model not found, timeout, etc.)
    fn predict(&self, request: PredictRequest) -> Result<PredictResponse, RuntimeError>;

    /// Check runtime health and availability
    ///
    /// # Returns
    /// * `Ok(HealthCheckResponse)` - Runtime is operational
    /// * `Err(RuntimeError)` - Runtime is down or degraded
    fn health_check(&self) -> Result<HealthCheckResponse, RuntimeError>;

    /// Get information about a specific model
    ///
    /// # Arguments
    /// * `model_id` - Model identifier
    ///
    /// # Returns
    /// * `Ok(ModelInfo)` - Model metadata and status
    /// * `Err(RuntimeError)` - Model not found or runtime error
    fn get_model_info(&self, model_id: &str) -> Result<ModelInfo, RuntimeError>;

    /// Get runtime name for logging and metrics
    fn name(&self) -> &str;

    /// Get runtime type identifier
    fn runtime_type(&self) -> RuntimeType;
}

/// Runtime type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RuntimeType {
    /// Native Rust inference via FFI
    RustNative,

    /// Python ML service via gRPC
    PythonGrpc,

    /// WebAssembly runtime (future)
    Wasm,
}

impl std::fmt::Display for RuntimeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RuntimeType::RustNative => write!(f, "rust_native"),
            RuntimeType::PythonGrpc => write!(f, "python_grpc"),
            RuntimeType::Wasm => write!(f, "wasm"),
        }
    }
}

// ============================================================================
// Rust Native Runtime Implementation
// ============================================================================

/// Local Rust inference runtime using FFI
///
/// Advantages:
/// - Ultra-low latency (< 1ms)
/// - No network overhead
/// - Type safety
///
/// Limitations:
/// - Limited to simple models
/// - No GPU acceleration
/// - Memory constraints
pub struct RustNativeRuntime {
    name: String,
    start_time: Instant,
    loaded_models: HashMap<String, ModelInfo>,
}

impl RustNativeRuntime {
    /// Create a new Rust native runtime
    pub fn new(name: String) -> Self {
        Self {
            name,
            start_time: Instant::now(),
            loaded_models: HashMap::new(),
        }
    }

    /// Register a model with this runtime
    pub fn register_model(&mut self, model_info: ModelInfo) {
        self.loaded_models.insert(model_info.model_id.clone(), model_info);
    }

    /// Simple linear model inference (placeholder)
    ///
    /// In production, this would call actual ML inference code
    /// For now, implements a simple weighted sum for testing
    fn execute_inference(&self, features: &[f64]) -> Result<PredictResponse, RuntimeError> {
        if features.is_empty() {
            return Err(RuntimeError::InvalidInput("Empty feature vector".to_string()));
        }

        let start = Instant::now();

        // Simple linear model: weighted sum + bias
        let weights = vec![0.5, 0.3, 0.2, 0.1];
        let bias = 0.5;

        let mut prediction = bias;
        for (i, &feature) in features.iter().enumerate() {
            let weight = weights.get(i).unwrap_or(&0.1);
            prediction += feature * weight;
        }

        // Normalize to [0, 1] for confidence
        let confidence = (prediction.tanh() + 1.0) / 2.0;

        let latency = start.elapsed();

        Ok(PredictResponse {
            prediction,
            confidence,
            model_id: "rust_native_model".to_string(),
            latency_ms: latency.as_millis() as i64,
            probabilities: HashMap::new(),
            metadata: HashMap::new(),
        })
    }
}

impl InferenceRuntime for RustNativeRuntime {
    fn predict(&self, request: PredictRequest) -> Result<PredictResponse, RuntimeError> {
        // Validate input
        if request.features.is_empty() {
            return Err(RuntimeError::InvalidInput(
                "Feature vector cannot be empty".to_string()
            ));
        }

        // Check if model exists (if we're tracking models)
        if !self.loaded_models.is_empty() && !self.loaded_models.contains_key(&request.model_id) {
            return Err(RuntimeError::ModelNotFound(
                format!("Model '{}' not registered in Rust runtime", request.model_id)
            ));
        }

        // Execute inference
        let mut response = self.execute_inference(&request.features)?;
        response.model_id = request.model_id;

        // Add runtime metadata
        response.metadata.insert("runtime".to_string(), "rust_native".to_string());
        response.metadata.insert("runtime_name".to_string(), self.name.clone());

        Ok(response)
    }

    fn health_check(&self) -> Result<HealthCheckResponse, RuntimeError> {
        let uptime = self.start_time.elapsed();

        Ok(HealthCheckResponse {
            status: HealthStatus::Healthy,
            version: "0.1.0".to_string(),
            uptime_seconds: uptime.as_secs() as i64,
            loaded_models_count: self.loaded_models.len() as i32,
            loaded_models: self.loaded_models.keys().cloned().collect(),
            system_metrics: HashMap::new(),
        })
    }

    fn get_model_info(&self, model_id: &str) -> Result<ModelInfo, RuntimeError> {
        self.loaded_models
            .get(model_id)
            .cloned()
            .ok_or_else(|| RuntimeError::ModelNotFound(
                format!("Model '{}' not found", model_id)
            ))
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn runtime_type(&self) -> RuntimeType {
        RuntimeType::RustNative
    }
}

// ============================================================================
// Runtime Registry
// ============================================================================

/// Registry for managing multiple runtime instances
///
/// Enables:
/// - Runtime selection based on model requirements
/// - Load balancing across runtimes
/// - Fallback on runtime failure
pub struct RuntimeRegistry {
    runtimes: HashMap<String, Arc<dyn InferenceRuntime>>,
}

impl RuntimeRegistry {
    /// Create a new runtime registry
    pub fn new() -> Self {
        Self {
            runtimes: HashMap::new(),
        }
    }

    /// Register a runtime
    pub fn register(&mut self, id: String, runtime: Arc<dyn InferenceRuntime>) {
        self.runtimes.insert(id, runtime);
    }

    /// Get a runtime by ID
    pub fn get(&self, id: &str) -> Option<Arc<dyn InferenceRuntime>> {
        self.runtimes.get(id).cloned()
    }

    /// List all registered runtime IDs
    pub fn list_runtimes(&self) -> Vec<String> {
        self.runtimes.keys().cloned().collect()
    }

    /// Execute prediction with runtime selection
    ///
    /// Tries the specified runtime, falls back to default if unavailable
    pub fn predict(
        &self,
        runtime_id: &str,
        request: PredictRequest,
    ) -> Result<PredictResponse, RuntimeError> {
        let runtime = self.get(runtime_id)
            .ok_or_else(|| RuntimeError::InternalError(
                format!("Runtime '{}' not found", runtime_id)
            ))?;

        runtime.predict(request)
    }
}

impl Default for RuntimeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rust_native_runtime_predict() {
        let runtime = RustNativeRuntime::new("test-runtime".to_string());

        let request = PredictRequest {
            model_id: "test-model".to_string(),
            features: vec![1.0, 2.0, 3.0, 4.0],
            metadata: HashMap::new(),
        };

        let result = runtime.predict(request);
        assert!(result.is_ok());

        let response = result.unwrap();
        assert_eq!(response.model_id, "test-model");
        assert!(response.confidence >= 0.0 && response.confidence <= 1.0);
        assert!(response.latency_ms >= 0);
    }

    #[test]
    fn test_rust_native_runtime_empty_features() {
        let runtime = RustNativeRuntime::new("test-runtime".to_string());

        let request = PredictRequest {
            model_id: "test-model".to_string(),
            features: vec![],
            metadata: HashMap::new(),
        };

        let result = runtime.predict(request);
        assert!(result.is_err());

        match result.unwrap_err() {
            RuntimeError::InvalidInput(_) => {},
            _ => panic!("Expected InvalidInput error"),
        }
    }

    #[test]
    fn test_rust_native_runtime_health_check() {
        let runtime = RustNativeRuntime::new("test-runtime".to_string());

        let result = runtime.health_check();
        assert!(result.is_ok());

        let response = result.unwrap();
        assert_eq!(response.status, HealthStatus::Healthy);
        assert!(response.uptime_seconds >= 0);
    }

    #[test]
    fn test_runtime_registry() {
        let mut registry = RuntimeRegistry::new();

        let runtime = Arc::new(RustNativeRuntime::new("test-runtime".to_string()));
        registry.register("rust".to_string(), runtime.clone());

        let retrieved = registry.get("rust");
        assert!(retrieved.is_some());

        let runtimes = registry.list_runtimes();
        assert_eq!(runtimes.len(), 1);
        assert_eq!(runtimes[0], "rust");
    }

    #[test]
    fn test_runtime_registry_predict() {
        let mut registry = RuntimeRegistry::new();

        let runtime = Arc::new(RustNativeRuntime::new("test-runtime".to_string()));
        registry.register("rust".to_string(), runtime);

        let request = PredictRequest {
            model_id: "test-model".to_string(),
            features: vec![1.0, 2.0, 3.0],
            metadata: HashMap::new(),
        };

        let result = registry.predict("rust", request);
        assert!(result.is_ok());
    }
}
