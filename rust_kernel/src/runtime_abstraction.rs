//! Runtime Abstraction Layer for Schlep-Engine
//! 
//! Provides a unified interface for different inference runtimes
//! including native Rust, Python gRPC, and future WASM runtimes.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use log::{error, info, warn, debug};
use once_cell::sync::Lazy;
use parking_lot::Mutex;

use crate::ffi_guard::{FFIContext, FFIError, safe_ffi_wrapper};

// Runtime configurations
const DEFAULT_TIMEOUT_MS: u64 = 30000; // 30 seconds
const MAX_CONCURRENT_PREDICTIONS: usize = 100;
const MODEL_CACHE_SIZE: usize = 10;

// Global runtime registry
static RUNTIME_REGISTRY: Lazy<RwLock<RuntimeRegistry>> = Lazy::new(|| {
    RwLock::new(RuntimeRegistry::new())
});

// ============================================================================
// Runtime Traits and Interfaces
// ============================================================================

/// Core runtime trait that all inference backends must implement
#[async_trait::async_trait]
pub trait InferenceRuntime: Send + Sync {
    /// Runtime identifier
    fn name(&self) -> &str;
    
    /// Check if runtime is available
    async fn health_check(&self) -> RuntimeHealth;
    
    /// Load a model into the runtime
    async fn load_model(&self, model_id: &str, model_config: &ModelConfig) -> Result<(), RuntimeError>;
    
    /// Unload a model from the runtime
    async fn unload_model(&self, model_id: &str) -> Result<(), RuntimeError>;
    
    /// Run inference with features
    async fn predict(&self, request: InferenceRequest) -> Result<InferenceResponse, RuntimeError>;
    
    /// Run batch inference
    async fn batch_predict(&self, requests: Vec<InferenceRequest>) -> Result<Vec<InferenceResponse>, RuntimeError>;
    
    /// Get model information
    async fn get_model_info(&self, model_id: &str) -> Result<ModelInfo, RuntimeError>;
    
    /// List all loaded models
    async fn list_models(&self) -> Result<Vec<String>, RuntimeError>;
    
    /// Get runtime statistics
    fn get_stats(&self) -> RuntimeStats;
}

/// Health status for runtime
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeHealth {
    pub healthy: bool,
    pub message: String,
    pub metrics: HashMap<String, f64>,
    pub last_check: chrono::DateTime<chrono::Utc>,
}

/// Model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub model_type: ModelType,
    pub model_path: Option<String>,
    pub runtime_specific: HashMap<String, Value>,
    pub cache_in_memory: bool,
    pub preload_on_startup: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelType {
    ONNX,
    PyTorch,
    TensorFlow,
    ScikitLearn,
    Custom(String),
}

/// Inference request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    pub model_id: String,
    pub features: Vec<f64>,
    pub metadata: HashMap<String, String>,
    pub request_id: Option<String>,
    pub timeout_ms: Option<u64>,
}

/// Inference response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResponse {
    pub prediction: Option<f64>,
    pub probabilities: HashMap<String, f64>,
    pub confidence: f64,
    pub model_id: String,
    pub inference_time_ms: u64,
    pub runtime_type: String,
    pub metadata: HashMap<String, Value>,
    pub cached: bool,
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub model_id: String,
    pub model_type: String,
    pub loaded_at: chrono::DateTime<chrono::Utc>,
    pub memory_usage_mb: f64,
    pub inference_count: u64,
    pub avg_inference_time_ms: f64,
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
}

/// Runtime statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeStats {
    pub name: String,
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub avg_response_time_ms: f64,
    pub max_response_time_ms: u64,
    pub min_response_time_ms: u64,
    pub models_loaded: usize,
    pub memory_usage_mb: f64,
    pub cpu_usage_percent: f64,
}

/// Runtime errors
#[derive(Debug, thiserror::Error)]
pub enum RuntimeError {
    #[error("Model not found: {0}")]
    ModelNotFound(String),
    
    #[error("Model loading failed: {0}")]
    ModelLoadingFailed(String),
    
    #[error("Runtime unavailable: {0}")]
    RuntimeUnavailable(String),
    
    #[error("Inference timeout: {0}ms")]
    Timeout(u64),
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    
    #[error("Resource exhausted: {0}")]
    ResourceExhausted(String),
    
    #[error("Connection error: {0}")]
    ConnectionError(String),
    
    #[error("Internal error: {0}")]
    InternalError(String),
}

// ============================================================================
// Native Rust Runtime Implementation
// ============================================================================

pub struct RustNativeRuntime {
    name: String,
    loaded_models: Arc<RwLock<HashMap<String, RustModel>>>,
    stats: Arc<Mutex<RuntimeStats>>,
}

#[derive(Debug, Clone)]
struct RustModel {
    model_id: String,
    model_type: ModelType,
    loaded_at: chrono::DateTime<chrono::Utc>,
    inference_count: Arc<Mutex<u64>>,
    total_inference_time: Arc<Mutex<u64>>,
}

impl RustNativeRuntime {
    pub fn new() -> Self {
        Self {
            name: "rust_native".to_string(),
            loaded_models: Arc::new(RwLock::new(HashMap::new())),
            stats: Arc::new(Mutex::new(RuntimeStats::default("rust_native"))),
        }
    }
}

impl Default for RustNativeRuntime {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl InferenceRuntime for RustNativeRuntime {
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn health_check(&self) -> RuntimeHealth {
        // For native runtime, just check if we can access memory and models
        let models = self.loaded_models.read().await;
        let metrics = HashMap::from([
            ("models_loaded".to_string(), models.len() as f64),
            ("memory_usage".to_string(), 64.0), // Fixed for now
            ("cpu_usage".to_string(), 5.0), // Placeholder
        ]);
        
        RuntimeHealth {
            healthy: true,
            message: "Rust runtime healthy".to_string(),
            metrics,
            last_check: chrono::Utc::now(),
        }
    }
    
    async fn load_model(&self, model_id: &str, config: &ModelConfig) -> Result<(), RuntimeError> {
        let mut models = self.loaded_models.write().await;
        
        if models.contains_key(model_id) {
            return Err(RuntimeError::ModelAlreadyLoaded(model_id.to_string()));
        }
        
        // Load model (simplified - real implementation would load actual models)
        let model = RustModel {
            model_id: model_id.to_string(),
            model_type: config.model_type.clone(),
            loaded_at: chrono::Utc::now(),
            inference_count: Arc::new(Mutex::new(0)),
            total_inference_time: Arc::new(Mutex::new(0)),
        };
        
        models.insert(model_id.to_string(), model);
        info!("Model loaded into Rust runtime: {}", model_id);
        
        Ok(())
    }
    
    async fn unload_model(&self, model_id: &str) -> Result<(), RuntimeError> {
        let mut models = self.loaded_models.write().await;
        
        if models.remove(model_id).is_none() {
            return Err(RuntimeError::ModelNotFound(model_id.to_string()));
        }
        
        info!("Model unloaded from Rust runtime: {}", model_id);
        Ok(())
    }
    
    async fn predict(&self, request: InferenceRequest) -> Result<InferenceResponse, RuntimeError> {
        let start_time = Instant::now();
        
        // Check if model is loaded
        let models = self.loaded_models.read().await;
        let model = models.get(&request.model_id)
            .ok_or_else(|| RuntimeError::ModelNotFound(request.model_id.clone()))?;
        
        // Validate input
        if request.features.is_empty() {
            return Err(RuntimeError::InvalidInput("Empty features".to_string()));
        }
        
        // Perform inference (simulated - real implementation would use actual model)
        let prediction = self.simulate_inference(&request.features).await;
        let inference_time = start_time.elapsed().as_millis() as u64;
        
        // Update stats
        {
            let mut count = model.inference_count.lock();
            let mut total_time = model.total_inference_time.lock();
            *count += 1;
            *total_time += inference_time;
        }
        
        self.update_stats(true, inference_time);
        
        Ok(InferenceResponse {
            prediction: Some(prediction),
            probabilities: HashMap::from([
                ("class_0".to_string(), 1.0 - prediction),
                ("class_1".to_string(), prediction),
            ]),
            confidence: 0.85,
            model_id: request.model_id.clone(),
            inference_time_ms: inference_time,
            runtime_type: self.name().to_string(),
            metadata: HashMap::from([
                ("features_count".to_string(), json!(request.features.len())),
                ("model_type".to_string(), json!(format!("{:?}", model.model_type))),
            ]),
            cached: false,
        })
    }
    
    async fn batch_predict(&self, requests: Vec<InferenceRequest>) -> Result<Vec<InferenceResponse>, RuntimeError> {
        let mut responses = Vec::with_capacity(requests.len());
        
        for request in requests {
            let response = self.predict(request).await?;
            responses.push(response);
        }
        
        Ok(responses)
    }
    
    async fn get_model_info(&self, model_id: &str) -> Result<ModelInfo, RuntimeError> {
        let models = self.loaded_models.read().await;
        let model = models.get(model_id)
            .ok_or_else(|| RuntimeError::ModelNotFound(model_id.to_string()))?;
        
        let inference_count = *model.inference_count.lock();
        let total_time = *model.total_inference_time.lock();
        let avg_time = if inference_count > 0 {
            total_time as f64 / inference_count as f64
        } else {
            0.0
        };
        
        Ok(ModelInfo {
            model_id: model.model_id.clone(),
            model_type: format!("{:?}", model.model_type),
            loaded_at: model.loaded_at,
            memory_usage_mb: 32.0, // Fixed for simulation
            inference_count,
            avg_inference_time_ms: avg_time,
            last_used: Some(chrono::Utc::now()),
        })
    }
    
    async fn list_models(&self) -> Result<Vec<String>, RuntimeError> {
        let models = self.loaded_models.read().await;
        Ok(models.keys().cloned().collect())
    }
    
    fn get_stats(&self) -> RuntimeStats {
        self.stats.lock().clone()
    }
}

impl RustNativeRuntime {
    async fn simulate_inference(&self, features: &[f64]) -> f64 {
        // Simulate inference computation
        let mut result = 0.5; // Base probability
        
        for (i, &feature) in features.iter().enumerate() {
            result += feature * 0.01 * (i as f64 + 1.0).recip();
        }
        
        // Sigmoid function to ensure result is between 0 and 1
        1.0 / (1.0 + (-result).exp())
    }
    
    fn update_stats(&self, success: bool, response_time_ms: u64) {
        let mut stats = self.stats.lock();
        
        stats.total_requests += 1;
        
        if success {
            stats.successful_requests += 1;
            
            // Update response time stats
            if response_time_ms > stats.max_response_time_ms {
                stats.max_response_time_ms = response_time_ms;
            }
            if response_time_ms < stats.min_response_time_ms || stats.min_response_time_ms == 0 {
                stats.min_response_time_ms = response_time_ms;
            }
            
            let total_time = stats.avg_response_time_ms * (stats.successful_requests - 1) as f64 + response_time_ms as f64;
            stats.avg_response_time_ms = total_time / stats.successful_requests as f64;
        } else {
            stats.failed_requests += 1;
        }
    }
}

impl RuntimeStats {
    fn default(name: &str) -> Self {
        Self {
            name: name.to_string(),
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            avg_response_time_ms: 0.0,
            max_response_time_ms: 0,
            min_response_time_ms: 0,
            models_loaded: 0,
            memory_usage_mb: 64.0,
            cpu_usage_percent: 0.0,
        }
    }
}

// ============================================================================
// Python gRPC Runtime Implementation
// ============================================================================

pub struct PythonGrpcRuntime {
    name: String,
    endpoint: String,
    stats: Arc<Mutex<RuntimeStats>>,
    client: Option<tonic::transport::Channel>,
}

impl PythonGrpcRuntime {
    pub fn new(endpoint: &str) -> Self {
        Self {
            name: "python_grpc".to_string(),
            endpoint: endpoint.to_string(),
            stats: Arc::new(Mutex::new(RuntimeStats::default("python_grpc"))),
            client: None,
        }
    }
    
    async fn connect(&mut self) -> Result<(), RuntimeError> {
        match tonic::transport::Channel::from_shared(self.endpoint.clone()) {
            Ok(channel) => {
                match channel.connect().await {
                    Ok(connected_channel) => {
                        self.client = Some(connected_channel);
                        info!("Connected to Python gRPC runtime at {}", self.endpoint);
                        Ok(())
                    }
                    Err(e) => Err(RuntimeError::ConnectionError(format!("Failed to connect: {}", e))),
                }
            }
            Err(e) => Err(RuntimeError::ConnectionError(format!("Invalid endpoint: {}", e))),
        }
    }
}

#[async_trait::async_trait]
impl InferenceRuntime for PythonGrpcRuntime {
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn health_check(&self) -> RuntimeHealth {
        // Simplified health check - real implementation would gRPC call
        RuntimeHealth {
            healthy: true,
            message: "Python gRPC runtime healthy".to_string(),
            metrics: HashMap::from([
                ("connection_status".to_string(), 1.0),
                ("endpoint".to_string(), 1.0),
            ]),
            last_check: chrono::Utc::now(),
        }
    }
    
    async fn load_model(&self, model_id: &str, config: &ModelConfig) -> Result<(), RuntimeError> {
        // Simplified - real implementation would make gRPC call to Python
        info!("Model load request sent to Python runtime: {}", model_id);
        Ok(())
    }
    
    async fn unload_model(&self, model_id: &str) -> Result<(), RuntimeError> {
        info!("Model unload request sent to Python runtime: {}", model_id);
        Ok(())
    }
    
    async fn predict(&self, request: InferenceRequest) -> Result<InferenceResponse, RuntimeError> {
        let start_time = Instant::now();
        
        // Simulate gRPC call to Python
        let prediction = self.predict_in_python(&request.features).await;
        let inference_time = start_time.elapsed().as_millis() as u64;
        
        self.update_stats(true, inference_time);
        
        Ok(InferenceResponse {
            prediction: Some(prediction),
            probabilities: HashMap::from([
                ("python_class_0".to_string(), 1.0 - prediction),
                ("python_class_1".to_string(), prediction),
            ]),
            confidence: 0.88,
            model_id: request.model_id.clone(),
            inference_time_ms: inference_time,
            runtime_type: self.name().to_string(),
            metadata: HashMap::from([
                ("gRPC_endpoint".to_string(), json!(self.endpoint)),
                ("features_count".to_string(), json!(request.features.len())),
            ]),
            cached: false,
        })
    }
    
    async fn batch_predict(&self, requests: Vec<InferenceRequest>) -> Result<Vec<InferenceResponse>, RuntimeError> {
        let mut responses = Vec::with_capacity(requests.len());
        
        for request in requests {
            let response = self.predict(request).await?;
            responses.push(response);
        }
        
        Ok(responses)
    }
    
    async fn get_model_info(&self, model_id: &str) -> Result<ModelInfo, RuntimeError> {
        Ok(ModelInfo {
            model_id: model_id.to_string(),
            model_type: "python_sklearn".to_string(),
            loaded_at: chrono::Utc::now(),
            memory_usage_mb: 128.0,
            inference_count: 1,
            avg_inference_time_ms: 25.0,
            last_used: Some(chrono::Utc::now()),
        })
    }
    
    async fn list_models(&self) -> Result<Vec<String>, RuntimeError> {
        Ok(vec!["python_model_1".to_string(), "python_model_2".to_string()])
    }
    
    fn get_stats(&self) -> RuntimeStats {
        self.stats.lock().clone()
    }
}

impl PythonGrpcRuntime {
    async fn predict_in_python(&self, features: &[f64]) -> f64 {
        // Simulate Python prediction (would be real gRPC call)
        let sum: f64 = features.iter().sum();
        let avg = sum / features.len() as f64;
        
        // Different calculation than Rust to show runtime difference
        (avg / 100.0).clamp(0.0, 1.0)
    }
    
    fn update_stats(&self, success: bool, response_time_ms: u64) {
        let mut stats = self.stats.lock();
        
        stats.total_requests += 1;
        
        if success {
            stats.successful_requests += 1;
            
            // Update response time stats
            if response_time_ms > stats.max_response_time_ms {
                stats.max_response_time_ms = response_time_ms;
            }
            if response_time_ms < stats.min_response_time_ms || stats.min_response_time_ms == 0 {
                stats.min_response_time_ms = response_time_ms;
            }
            
            let total_time = stats.avg_response_time_ms * (stats.successful_requests - 1) as f64 + response_time_ms as f64;
            stats.avg_response_time_ms = total_time / stats.successful_requests as f64;
        } else {
            stats.failed_requests += 1;
        }
    }
}

// ============================================================================
// Runtime Registry and Manager
// ============================================================================

pub struct RuntimeRegistry {
    runtimes: HashMap<String, Arc<dyn InferenceRuntime>>,
    default_runtime: Option<String>,
    model_routing: HashMap<String, String>, // model_id -> runtime_name
}

impl RuntimeRegistry {
    pub fn new() -> Self {
        Self {
            runtimes: HashMap::new(),
            default_runtime: None,
            model_routing: HashMap::new(),
        }
    }
    
    pub fn register_runtime(&mut self, runtime: Arc<dyn InferenceRuntime>) {
        let name = runtime.name().to_string();
        self.runtimes.insert(name.clone(), runtime);
        
        // Set as default if no default exists
        if self.default_runtime.is_none() {
            self.default_runtime = Some(name);
        }
    }
    
    pub fn get_runtime(&self, name: &str) -> Option<Arc<dyn InferenceRuntime>> {
        self.runtimes.get(name).cloned()
    }
    
    pub fn get_default_runtime(&self) -> Option<Arc<dyn InferenceRuntime>> {
        if let Some(default_name) = &self.default_runtime {
            self.get_runtime(default_name)
        } else {
            None
        }
    }
    
    pub async fn route_model_to_runtime(&mut self, model_id: &str, runtime_name: &str) -> Result<(), RuntimeError> {
        if !self.runtimes.contains_key(runtime_name) {
            return Err(RuntimeError::RuntimeUnavailable(format!("Runtime '{}' not found", runtime_name)));
        }
        
        self.model_routing.insert(model_id.to_string(), runtime_name.to_string());
        Ok(())
    }
    
    pub fn get_runtime_for_model(&self, model_id: &str) -> Option<Arc<dyn InferenceRuntime>> {
        if let Some(runtime_name) = self.model_routing.get(model_id) {
            self.get_runtime(runtime_name)
        } else {
            self.get_default_runtime()
        }
    }
    
    pub fn list_runtimes(&self) -> Vec<String> {
        self.runtimes.keys().cloned().collect()
    }
}

pub struct RuntimeManager {
    registry: Arc<RwLock<RuntimeRegistry>>,
    connection_pool: Arc<RwLock<Vec<Arc<dyn InferenceRuntime>>>>,
}

impl RuntimeManager {
    pub async fn new() -> Self {
        Self {
            registry: Arc::new(RwLock::new(RuntimeRegistry::new())),
            connection_pool: Arc::new(RwLock::new(Vec::new())),
        }
    }
    
    pub async fn initialize_default_runtimes(&self) -> Result<(), RuntimeError> {
        let rust_runtime = Arc::new(RustNativeRuntime::new());
        let python_runtime = Arc::new(PythonGrpcRuntime::new("localhost:50051"));
        
        {
            let mut registry = self.registry.write().await;
            registry.register_runtime(rust_runtime);
            registry.register_runtime(python_runtime);
        }
        
        info!("Default runtimes initialized");
        Ok(())
    }
    
    pub async fn predict(&self, request: InferenceRequest) -> Result<InferenceResponse, RuntimeError> {
        let registry = self.registry.read().await;
        let runtime = registry.get_runtime_for_model(&request.model_id)
            .ok_or_else(|| RuntimeError::RuntimeUnavailable("No runtime available".to_string()))?;
        
        debug!("Routing prediction for model {} to runtime {}", request.model_id, runtime.name());
        runtime.predict(request).await
    }
    
    pub async fn batch_predict(&self, requests: Vec<InferenceRequest>) -> Result<Vec<InferenceResponse>, RuntimeError> {
        if requests.is_empty() {
            return Ok(Vec::new());
        }
        
        let mut responses = Vec::with_capacity(requests.len());
        
        for request in requests {
            let response = self.predict(request).await?;
            responses.push(response);
        }
        
        Ok(responses)
    }
    
    pub async fn load_model(&self, model_id: &str, config: &ModelConfig, runtime_name: Option<&str>) -> Result<(), RuntimeError> {
        let registry = self.registry.read().await;
        
        let runtime = if let Some(rt_name) = runtime_name {
            registry.get_runtime(rt_name)
                .ok_or_else(|| RuntimeError::RuntimeUnavailable(format!("Runtime '{}' not found", rt_name)))?
        } else {
            registry.get_default_runtime()
                .ok_or_else(|| RuntimeError::RuntimeUnavailable("No default runtime available".to_string()))?
        };
        
        if let Err(e) = runtime.load_model(model_id, config).await {
            return Err(e);
        }
        
        // Route model to runtime for future predictions
        drop(registry);
        let mut registry = self.registry.write().await;
        registry.route_model_to_runtime(model_id, runtime.name()).await?;
        
        info!("Model {} loaded and routed to runtime {}", model_id, runtime.name());
        Ok(())
    }
    
    pub async fn health_check_all(&self) -> HashMap<String, RuntimeHealth> {
        let registry = self.registry.read().await;
        let mut health_results = HashMap::new();
        
        for (name, runtime) in registry.runtimes.iter() {
            let health = runtime.health_check().await;
            health_results.insert(name.clone(), health);
        }
        
        health_results
    }
    
    pub async fn get_all_stats(&self) -> HashMap<String, RuntimeStats> {
        let registry = self.registry.read().await;
        let mut stats_results = HashMap::new();
        
        for (name, runtime) in registry.runtimes.iter() {
            let stats = runtime.get_stats();
            stats_results.insert(name.clone(), stats);
        }
        
        stats_results
    }
}

// ============================================================================
// FFI Exports for Go Integration
// ============================================================================

/// Create a new runtime manager instance
#[no_mangle]
pub extern "C" fn runtime_manager_create() -> *mut c_void {
    let manager = Box::new(RuntimeManager::new());
    Box::into_raw(manager) as *mut c_void
}

/// Destroy runtime manager instance  
#[no_mangle]
pub extern "C" fn runtime_manager_destroy(manager_ptr: *mut c_void) {
    if !manager_ptr.is_null() {
        unsafe {
            let _ = Box::from_raw(manager_ptr as *mut RuntimeManager);
        }
    }
}

/// Initialize default runtimes
#[no_mangle]
pub extern "C" fn runtime_manager_initialize(manager_ptr: *mut c_void) -> i32 {
    if manager_ptr.is_null() {
        return FFIError::NullPointer as i32;
    }
    
    let context = FFIContext::new("runtime_initialize", 5000);
    
    let result = safe_ffi_wrapper(context, move || {
        let manager = unsafe { &*(manager_ptr as *const RuntimeManager) };
        
        // Block on async operation
        tokio::block_on(async {
            manager.initialize_default_runtimes().await
        })
    });
    
    match result {
        Ok(()) => FFIError::Success as i32,
        Err(error) => {
            error!("Runtime manager initialization failed: {:?}", error);
            FFIError::InternalError as i32
        }
    }
}

/// Load model into runtime
#[no_mangle]
pub extern "C" fn runtime_manager_load_model(
    manager_ptr: *mut c_void,
    model_id_ptr: *const c_char,
    model_type_ptr: *const c_char,
    runtime_name_ptr: *const c_char
) -> i32 {
    if manager_ptr.is_null() || model_id_ptr.is_null() {
        return FFIError::NullPointer as i32;
    }
    
    let context = FFIContext::new("runtime_load_model", 10000);
    
    let result = safe_ffi_wrapper(context, move || {
        let manager = unsafe { &*(manager_ptr as *const RuntimeManager) };
        
        let model_id = crate::ffi_guard::safe_read_c_string(model_id_ptr)?;
        let model_type = crate::ffi_guard::safe_read_c_string(model_type_ptr.ok_or(FFIError::NullPointer)?)?;
        let runtime_name = if !runtime_name_ptr.is_null() {
            Some(crate::ffi_guard::safe_read_c_string(runtime_name_ptr)?)
        } else {
            None
        };
        
        let config = ModelConfig {
            model_type: match model_type.as_str() {
                "onnx" => ModelType::ONNX,
                "pytorch" => ModelType::PyTorch,
                "tensorflow" => ModelType::TensorFlow,
                "sklearn" => ModelType::ScikitLearn,
                _ => ModelType::Custom(model_type),
            },
            model_path: None,
            runtime_specific: HashMap::new(),
            cache_in_memory: true,
            preload_on_startup: false,
        };
        
        // Block on async operation
        tokio::block_on(async {
            manager.load_model(&model_id, &config, runtime_name.as_deref()).await
        })
    });
    
    match result {
        Ok(()) => FFIError::Success as i32,
        Err(error) => {
            error!("Model loading failed: {:?}", error);
            FFIError::InvalidInput as i32
        }
    }
}

/// Run inference using runtime abstraction
#[no_mangle]
pub extern "C" fn runtime_manager_predict(
    manager_ptr: *mut c_void,
    model_id_ptr: *const c_char,
    features_ptr: *const f64,
    features_len: usize,
    response_ptr: *mut *mut c_char
) -> i32 {
    if manager_ptr.is_null() || model_id_ptr.is_null() || features_ptr.is_null() || response_ptr.is_null() {
        return FFIError::NullPointer as i32;
    }
    
    let context = FFIContext::new("runtime_predict", DEFAULT_TIMEOUT_MS);
    
    let result = safe_ffi_wrapper(context, move || {
        let manager = unsafe { &*(manager_ptr as *const RuntimeManager) };
        
        let model_id = crate::ffi_guard::safe_read_c_string(model_id_ptr)?;
        
        // Copy features from C array
        let features = unsafe {
            if features_len > MAX_CONCURRENT_PREDICTIONS {
                return Err(FFIError::InvalidInput);
            }
            std::slice::from_raw_parts(features_ptr, features_len).to_vec()
        };
        
        let request = InferenceRequest {
            model_id,
            features,
            metadata: HashMap::new(),
            request_id None,
            timeout_ms Some(DEFAULT_TIMEOUT_MS),
        };
        
        // Block on async operation
        let response = tokio::block_on(async {
            manager.predict(request).await
        })?;
        
        // Convert response to JSON and create C string
        let response_json = json!(response);
        let c_string = crate::ffi_guard::safe_create_c_string(&response_json.to_string());
        
        unsafe {
            *response_ptr = c_string;
        }
        
        Ok(())
    });
    
    match result {
        Ok(()) => FFIError::Success as i32,
        Err(error) => {
            error!("Prediction failed: {:?}", error);
            FFIError::InvalidInput as i32
        }
    }
}

/// Get health status of all runtimes
#[no_mangle]
pub extern "C" fn runtime_manager_health_check(manager_ptr: *mut c_void) -> *mut c_char {
    if manager_ptr.is_null() {
        let error = json!({
            "error": "Null manager pointer",
            "runtimes": {}
        });
        return crate::ffi_guard::safe_create_c_string(&error.to_string());
    }
    
    let manager = unsafe { &*(manager_ptr as *const RuntimeManager) };
    
    let health_results = tokio::block_on(async {
        manager.health_check_all().await
    });
    
    let response = json!({
        "healthy": health_results.values().all(|h| h.healthy),
        "runtimes": health_results,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    crate::ffi_guard::safe_create_c_string(&response.to_string())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_rust_native_runtime() {
        let runtime = RustNativeRuntime::new();
        
        // Test health check
        let health = runtime.health_check().await;
        assert!(health.healthy);
        
        // Test model loading
        let config = ModelConfig {
            model_type: ModelType::ScikitLearn,
            model_path: Some("test_model.pkl".to_string()),
            runtime_specific: HashMap::new(),
            cache_in_memory: true,
            preload_on_startup: false,
        };
        
        runtime.load_model("test_model", &config).await.unwrap();
        
        // Test prediction
        let request = InferenceRequest {
            model_id: "test_model".to_string(),
            features: vec![1.0, 2.0, 3.0, 4.0],
            metadata: HashMap::new(),
            request_id: None,
            timeout_ms: Some(5000),
        };
        
        let response = runtime.predict(request).await.unwrap();
        assert!(response.prediction.is_some());
        assert_eq!(response.runtime_type, "rust_native");
        
        // Test cleanup
        runtime.unload_model("test_model").await.unwrap();
    }
    
    #[tokio::test]
    async fn test_runtime_manager() {
        let manager = RuntimeManager::new().await;
        
        // Initialize runtimes
        manager.initialize_default_runtimes().await.unwrap();
        
        // Load model
        let config = ModelConfig {
            model_type: ModelType::ScikitLearn,
            model_path: None,
            runtime_specific: HashMap::new(),
            cache_in_memory: true,
            preload_on_startup: false,
        };
        
        manager.load_model("test_model", &config, Some("rust_native")).await.unwrap();
        
        // Test prediction
        let request = InferenceRequest {
            model_id: "test_model".to_string(),
            features: vec![1.0, 2.0, 3.0],
            metadata: HashMap::new(),
            request_id: None,
            timeout_ms: Some(5000),
        };
        
        let response = manager.predict(request).await.unwrap();
        assert!(response.prediction.is_some());
        
        // Test health check
        let health_results = manager.health_check_all().await;
        assert!(health_results.len() >= 2); // At least Rust and Python runtimes
    }
    
    #[test]
    fn test_runtime_registry() {
        let mut registry = RuntimeRegistry::new();
        let rust_runtime = Arc::new(RustNativeRuntime::new());
        
        registry.register_runtime(rust_runtime);
        assert!(registry.get_default_runtime().is_some());
        
        let runtimes = registry.list_runtimes();
        assert!(!runtimes.is_empty());
    }
}
