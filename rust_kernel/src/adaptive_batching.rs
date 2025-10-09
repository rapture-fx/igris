//! Adaptive Batching Controller
//! 
//! Dynamically adjusts batch sizes and windows based on:
//! - P95 latency targets
//! - Current system load
//! - Model performance characteristics
//! - Queue depth and wait times

use std::collections::{HashMap, VecDeque, Vec};
use std::sync::{Arc, RwLock, Mutex};
use std::time::{Duration, Instant};
use std::thread;
use tokio::sync::{mpsc, OwnedMutexPermit};

use serde::{Deserialize, Serialize};
use parking_lot::RwLock;
use log::{debug, info, warn, error};
use tokio::time::{interval, sleep};

use crate::ffi_guard::{FFIContext, FFIError, safe_ffi_wrapper};

// ============================================================================
// Configuration
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchingConfig {
    /// Target P95 latency in milliseconds
    pub target_p95_latency_ms: u64,
    
    /// Maximum allowed P95 latency
    pub max_p95_latency_ms: u64,
    
    /// Min batch size
    pub min_batch_size: usize,
    
    /// Max batch size
    pub max_batch_size: usize,
    
    /// Initial batch size
    pub initial_batch_size: usize,
    
    /// Batch window duration in milliseconds
    pub batch_window_ms: u64,
    
    /// Adjustment interval
    pub adjustment_interval_secs: u64,
    
    /// Load threshold for scaling up
    pub scale_up_load_threshold: f64,
    
    /// Load threshold for scaling down
    pub scale_down_load_threshold: f64,
    
    /// Queue length thresholds for aggressive batching
    pub aggressive_queue_threshold: usize,
    
    /// Cooldown period between adjustments (seconds)
    pub adjustment_cooldown_secs: u64,
    
    /// Enable predictive batching based historical data
    pub enable_predictive_batching: bool,
    
    /// Performance history window size (number of samples)
    pub performance_history_size: usize,
    
    /// Maximum number of requests to process concurrently
    pub max_concurrent_requests: usize,
    
    /// Enable automatic performance tuning
    pub enable_auto_tuning: bool,
    
    /// Model-specific configurations
    pub model_configs: HashMap<String, ModelBatchConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelBatchConfig {
    /// Preferred batch size for this model
    pub preferred_batch_size: usize,
    
    /// Maximum batch size for this model
    pub max_batch_size: usize,
    
    /// Optimal throughput (requests/second)
    pub optimal_throughput: f64,
    
    /// Latency characteristics
    pub latency_characteristics: LatencyCharacteristics,
    
    /// Resource constraints
    pub resource_constraints: ResourceConstraints,
    
    /// Custom batching rules
    pub custom_rules: Vec<BatchingRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LatencyCharacteristics {
    Linear,
    SubLinear,       // Sublinear scaling (e.g., some GPU acceleration)
    SuperLinear,     // Superlinear scaling (cache misses, memory issues)
    Fixed,           // Constant time regardless of batch size
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceConstraints {
    pub max_memory_gb: f64,
    pub max_cpu_cores: f64,
    pub max_gpu_utilization: f64,
    pub max_concurrent_batches: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BatchingRule {
    /// Maximum batch size based on input data features
    MaxInputSize {
        max_features: usize,
        max_size_mb: f64,
    },
    
    /// Time-based batching requirements
    MaxWindow {
        max_duration_ms: u64,
        max_events: usize,
    },
    
    /// Avoid batching for specific request types
    NoBatching {
        request_types: Vec<String>,
    },
    
    /// Priority thresholds
    PriorityThresholds {
        high_priority_max_batch: usize,
        medium_priority_max_batch: usize,
        low_priority_max_batch: usize,
    },
}

impl Default for BatchingConfig {
    fn default() -> Self {
        Self {
            target_p95_latency_ms: 100,
            max_p95_latency_ms: 200,
            min_batch_size: 1,
            max_batch_size: 32,
            initial_batch_size: 8,
            batch_window_ms: 50,
            adjustment_interval_secs: 10,
            scale_up_load_threshold: 0.7,
            scale_down_load_threshold: 0.3,
            aggressive_queue_threshold: 100,
            adjustment_cooldown_secs: 30,
            enable_predictive_batching: true,
            performance_history_size: 100,
            max_concurrent_requests: 1000,
            enable_auto_tuning: true,
            model_configs: HashMap::new(),
        }
    }
}

// ============================================================================
// Core Data Structures
// ============================================================================

/// Batch request with metadata
#[derive(Debug, Clone)]
pub struct BatchRequest {
    pub id: String,
    pub model_id: String,
    pub requests: VecDeque<IndividualRequest>,
    
    pub created_at: Instant,
    pub batch_start_time: Option<Instant>,
    pub batch_end_time: Option<Instant>,
    
    pub target_batch_size: usize,
    pub current_size: usize,
    
    pub priority: BatchPriority,
    pub deadline: Option<Instant>,
    
    pub metrics: BatchMetrics,
}

/// Individual request within a batch
#[derive(Debug, Clone)]
pub struct IndividualRequest {
    pub id: String,
    pub input_data: Vec<u8>,
    pub feature_count: usize,
    pub priority: BatchPriority,
    
    pub created_at: Instant,
    pub queued_at: Option<Instant>,
    
    pub metadata: RequestMetadata,
}

#[derive(Debug, Clone)]
pub enum BatchPriority {
    Critical,
    High,
    Normal,
    Low,
    Background,
}

#[derive(Debug, Clone)]
pub struct RequestMetadata {
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub request_source: Option<String>,
    pub client_ip: Option<String>,
    pub custom_tags: HashMap<String, String>,
    
    pub estimated_tokens: Option<usize>,
    pub cost_sensitivity: CostSensitivity,
    
    pub sla_requirements: SLARequirements,
}

#[derive(Debug, Clone)]
pub enum CostSensitivity {
    High,
    Medium,
    Low,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct SLARequirements {
    pub max_latency_ms: u64,
    pub max_cost_per_request: f64,
    pub min_throughput_rps: f64,
    pub max_failure_rate: f64,
}

/// Batch processing metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchMetrics {
    pub total_requests: usize,
    pub successful_requests: usize,
    pub failed_requests: usize,
    
    pub total_duration_ms: u64,
    pub average_individual_latency_ms: f64,
    pub p50_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
    
    pub total_tokens: Option<usize>,
    pub average_tokens_per_request: Option<f64>,
    
    pub cpu_utilization: f64,
    pub memory_utilization: f64,
    pub gpu_utilization: f64,
    
    pub queue_time_ms: u64,
    pub processing_time_ms: u64,
    pub post_processing_time_ms: u64,
    
    pub batch_efficiency: f64, // Latency ratio
    pub resource_efficiency: f64, // Requests/resources ratio
}

/// Current system load and performance metrics
#[derive(Debug, Clone)]
pub struct SystemMetrics {
    pub current_queue_length: usize,
    pub average_queue_wait_time_ms: f64,
    pub current_throughput_rps: f64,
    pub overall_latency_p95_ms: f64,
    
    pub cpu_utilization: f64,
    pub memory_utilization: f64,
    pub gpu_utilization: f64,
    pub network_latency_ms: f64,
    
    pub error_rate: f64,
    pub success_rate: f64,
    pub timeouts: u64,
    
    pub timestamp: Instant,
    pub model_specific_metrics: HashMap<String, ModelMetrics>,
}

#[derive(Debug, Clone)]
pub struct ModelMetrics {
    pub current_batch_size: usize,
    pub recent_latency_p95: f64,
    pub throughput_rps: f64,
    pub efficiency_score: f64,
    
    pub average_processing_time_ms: f64,
    pub queue_time_ms: f64,
    
    pub resource_utilization:(ResourceUtilization),
    pub cost_per_thousand_tokens: Option<f64>,
    pub tokens_per_second: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct ResourceUtilization {
    pub cpu: f64,
    pub memory_gb: f64,
    pub gpu: f64,
    pub network_mbps: f64,
}

/// Batching decision and rationale
#[derive(Debug, Clone)]
pub struct BatchingDecision {
    pub action: BatchingAction,
    pub old_batch_size: Option<usize>,
    pub new_batch_size: usize,
    pub new_window_ms: u64,
    
    pub reasoning: String,
    pub confidence: f64,
    pub factors: Vec<DecisionFactor>,
    
    pub model_id: String,
    pub request_id: String,
    pub timestamp: Instant,
}

#[derive(Debug, Clone)]
pub enum BatchingAction {
    NoChange,
    ScaleUp,
    ScaleDown,
    AggressiveScaleUp,
    ConservativeScaleDown,
    WindowChange,
    ModelSwitch,
    EmergencyFlush,
}

#[derive(Debug, Clone)]
pub struct DecisionFactor {
    pub factor_type: String,
    pub value: f64,
    pub weight: f64,
    pub description: String,
}

#[derive(Debug, Clone)]
pub enum ScalingDirection {
    Up,
    Down,
    None,
}

// ============================================================================
// Adaptive Batching Controller
// ============================================================================

/// Main adaptive batching controller
pub struct AdaptiveBatchingController {
    config: BatchingConfig,
    performance_tracker: Arc<RwLock<PerformanceTracker>>,
    batch_queue: Arc<Mutex<VecDeque<BatchRequest>>>,
    
    // Current state
    current_batch_size: Arc<RwLock<HashMap<String, usize>>>,
    current_window_ms: Arc<RwLock<u64>>,
    last_adjustment: Arc<RwLock<Instant>>,
    adjustment_cooldown: Arc<RwLock<bool>>,
    
    // Communication channels
    batch_tx: mpsc::UnboundedSender<BatchRequest>,
    batch_rx: Arc<Mutex<mpsc::UnboundedReceiver<BatchRequest>>>,
    
    // Request handlers
    request_processor: Arc<dyn BatchRequestProcessor>,
    
    // Monitoring
    metrics_collector: Arc<Mutex<MetricsCollector>>,
}

/// Performance tracker for historical data
pub struct PerformanceTracker {
    history: RwLock<VecDeque<PerformanceSample>>,
    max_samples: usize,
}

/// Performance sample from recent operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSample {
    pub timestamp: Instant,
    pub model_id: String,
    pub batch_size: usize,
    pub window_ms: u64,
    pub p95_latency_ms: f64,
    pub p50_latency_ms: f64,
    pub throughput_rps: f64,
    pub efficiency: f64,
    
    pub queue_length: usize,
    pub system_load: f64,
    pub resource_utilization: ResourceUtilization,
}

/// Interface for processing batch requests
pub trait BatchRequestProcessor: Send + Sync {
    async fn process_batch(&self, batch: BatchRequest) -> Result<BatchResult, BatchingError>;
}

/// Result from batch processing
#[derive(Debug, Clone)]
pub struct BatchResult {
    pub request_id: String,
    pub model_id: String,
    pub batch_size: usize,
    pub processing_time_ms: u64,
    pub individual_results: Vec<(String, Result<Vec<u8>, String>)>,
    pub batch_metrics: BatchMetrics,
}

#[derive(Debug, thiserror::Error)]
pub enum BatchingError {
    ProcessingError(String),
    QueueFull,
    ModelUnavailable(String),
    TimeoutError(String),
    ConfigurationError(String),
}

/// Metrics collector for monitoring
pub struct MetricsCollector {
    total_requests: Mutex<u64>,
    successful_batches: Mutex<u64>,
    failed_batches: Mutex<u64>,
    average_batch_size: Mutex<f64>,
    average_latency_ms: Mutex<f64>,
    throughput_rps: Mutex<f64>,
}

impl AdaptiveBatchingController {
    /// Create new adaptive batching controller
    pub fn new(
        config: BatchingConfig,
        request_processor: Arc<dyn BatchRequestProcessor>,
    ) -> Self {
        let (batch_tx, batch_rx) = mpsc::unbounded_channel();
        
        let current_batch_size = Arc::new(RwLock::new(HashMap::new()));
        let current_window_ms = Arc::new(RwLock::new(config.batch_window_ms));
        
        let controller = Self {
            config: config.clone(),
            performance_tracker: Arc::new(RwLock::new(PerformanceTracker {
                history: RwLock::new(VecDeque::with_capacity(config.performance_history_size)),
                max_samples: config.performance_history_size,
            })),
            batch_queue: Arc::new(Mutex::new(VecDeque::new())),
            current_batch_size,
            current_window_ms,
            last_adjustment: Arc::new(RwLock::new(Instant::now())),
            adjustment_cooldown: Arc::new(RwLock::new(false)),
            batch_tx
        });
        
        // Initialize with configured values
        {
            let mut batch_sizes = controller.current_batch_size.write();
            let mut windows = controller.current_window_ms.write();
            
            // Initialize all model configs with default values
            for (model_id, model_config) in config.model_configs.iter() {
                batch_sizes.insert(model_id.clone(), model_config.preferred_batch_size);
            }
            
            *windows = config.batch_window_ms;
            
            // Start monitoring
            ctrl.start_monitoring();
            ctrl.start_batch_processing_loop();
        }
        
        controller
    }
    
    /// Add request to batching queue
    pub async fn add_request(&self, request: IndividualRequest) -> Result<String, BatchingError> {
        // Check queue limits
        {
            let queue = self.batch_queue.lock();
            if queue.len() >= self.config.max_concurrent_requests {
                return Err(BatchingError::QueueFull);
            }
        }
        
        // Create batch request
        let batch_request = BatchRequest {
            id: request.id.clone(),
            model_id: request.metadata.model_id.clone()
                .unwrap_or_else(|| "default".to_string()),
            requests: VecDeque::from([request]),
            created_at: Instant::now(),
            batch_start_time: None,
            batch_end_time: None,
            target_batch_size: self.get_current_batch_size(&request.model_id),
            current_size: 1,
            priority: request.priority.clone(),
            deadline: None, // Would be set from SLA requirements
            metrics: BatchMetrics::new(),
        };
        
        // Add to queue
        {
            let mut queue = self.batch_queue.lock();
            queue.push_back(batch_request);
        }
        
        send_batch_request(&self.batch_tx, batch_request).await
    }

    /// Get current batch size for a model
    pub fn get_current_batch_size(&self, model_id: &str) -> usize {
        let current_sizes = self.current_batch_size.read();
        *current_sizes.get(model_id).unwrap_or(&self.config.initial_batch_size)
    }

    /// Process batch and make decision
    async fn process_request(&self, request: BatchRequest) -> Result<BatchResult, BatchingError> {
        // Process through the request processor
        let result = self.request_processor.process_batch(request).await?;
        
        // Update performance tracking
        self.record_performance_sample(&request, &result).await;
        
        // Make batching decision
        let decision = self.make_batching_decision(&request).await?;
        
        // Apply decision if scaling needed
        if decision.action != BatchingAction::NoChange {
            self.apply_batching_decision(&decision).await?;
            
            debug!("Applied batching decision: {:?} for model {}", decision.action, decision.model_id);
        }
        
        Ok(result)
    }

    /// Make intelligent batching decision based on current performance
    async fn make_batching_decision(&self, request: &BatchRequest) -> Result<BatchingDecision, BatchingError> {
        let model_id = &request.model_id;
        
        // Collect current metrics
        let system_metrics = self.collect_system_metrics().await;
        let model_config = self.get_model_config(model_id);
        let recent_performance = self.get_recent_performance(model_id).await;
        
        // Build decision factors
        let mut factors = Vec::new();
        let action = self.decide_batching_action(
            &system_metrics,
            &model_config,
            &recent_performance,
            request,
            &mut factors,
        );
        
        let (new_batch_size, new_window_ms) = self.calculate_new_parameters(
            &action,
            &model_config,
            &system_metrics,
            &factors,
        );
        
        let decision = BatchingDecision {
            action,
            old_batch_size: Some(self.get_current_batch_size(model_id)),
            new_batch_size,
            new_window_ms,
            reasoning: self.generate_reasoning(&action, &factors),
            confidence: self.calculate_confidence(&factors),
            factors: vec![], // TODO: Implement factor extraction
            model_id: model_id.clone(),
            request_id: request.id.clone(),
            timestamp: Instant::now(),
        };
        
        Ok(decision)
    }

    /// Decide what batching action to take
    fn decide_batching_action(
        &self,
        system_metrics: &SystemMetrics,
        model_config: &ModelBatchConfig,
        recent_performance: &PerformanceSample,
        request: &BatchRequest,
        factors: &mut Vec<DecisionFactor>,
    ) -> BatchingAction {
        
        // P95 latency is the primary driver
        if system_metrics.overall_latency_p95_ms > self.config.max_p95_latency_ms {
            factors.push(DecisionFactor {
                factor_type: "latency".to_string(),
                value: system_metrics.overall_latency_p95_ms,
                weight: 10.0,
                description: "P95 latency exceeds threshold".to_string(),
            });
            
            // Scale down if possible
            if system_metrics.current_batch_size > self.config.min_batch_size {
                return BatchingAction::ScaleDown;
            } else {
                return BatchingAction::ConservativeScaleDown;
            }
        }
        
        if system_metrics.overall_latency_p95_ms < self.config.target_p95_latency_ms {
            factors.push(DecisionFactor {
                factor_type: "latency".to_string(),
                value: system_metrics.overall_latency_p95_ms,
                weight: 5.0,
                description: "P95 latency within target".to_string(),
            });
            
            // Consider scaling up if conditions are good
            if system_metrics.current_queue_length > self.config.aggressive_queue_threshold {
                factors.push(DecisionFactor {
                    factor_type: "queue".to_string(),
                    value: system_metrics.current_queue_length as f64,
                    weight: 3.0,
                    description: "High queue pressure".to_string(),
                });
            } else if system_metrics.system_load > self.config.scale_up_load_threshold {
                factors.push(DecisionFactor {
                    factor_type: "load".to_string(),
                    value: system_metrics.system_load,
                    weight: 2.0,
                    description: "High system load".to_string(),
                });
            }
        }
        
        // Check model-specific constraints
        let current_size = self.get_current_batch_size(&request.model_id);
        if current_size >= model_config.max_batch_size {
            factors.push(DecisionFactor {
                factor_type: "model_limit".to_string(),
                value: current_size as f64,
                weight: 3.0,
                description: "At model maximum batch size".to_string(),
            });
            
            return BatchingAction::MaxSize;
        }
        
        // Queue length considerations
        if system_metrics.current_queue_length >= self.config.aggressive_queue_threshold {
            factors.push(DecisionFactor {
                factor_type: "queue".to_string(),
                value: system_metrics.current_queue_length as f64,
                weight: 4.0,
                description: "Aggressive queue requires scaling".to_string(),
            });
            return BatchingAction::AggressiveScaleUp;
        }
        
        // Check if optimization is needed
        if self.optimization_needed(recent_performance, system_metrics, request) {
            return BatchingAction::WindowChange;
        }
        
        // No change if everything looks good
        BatchingAction::NoChange
    }

    /// Calculate new batch size based on decision
    fn calculate_new_parameters(
        &self,
        action: &BatchingAction,
        model_config: &ModelConfig,
        system_metrics: &SystemMetrics,
        factors: &Vec<DecisionFactor>,
    ) -> (usize, u64) {
        let current_size = self.get_current_batch_size(&model_config(preferred_batch_size));
        let current_window = *self.current_window_ms.read();
        
        let mut new_batch_size = current_size;
        let mut new_window = current_window;
        
        match action {
            BatchingAction::ScaleUp => {
                // Conservative scaling: try 2x then fallback
                let proposed_size = (current_size * 2).min(model_config.max_batch_size);
                if self.is_safe_to_scale(system_metrics, proposed_size, model_config) {
                    new_batch_size = proposed_size;
                }
            }
            
            BatchingAction::AggressiveScaleUp => {
                // Aggressive scaling: try to reach optimal
                if model_config.optimal_throughput > 0.0 {
                    let optimal_size = (model_config.optimal_throughput / system_metrics.current_throughput_rps).ceil() as usize;
                    new_batch_size = optimal_size.min(model_config.max_batch_size);
                }
            }
            
            BatchingAction::ScaleDown => {
                // Scale down: reduce by half
                new_batch_size = (current_size / 2).max(self.config.min_batch_size);
            }
            
            BatchingAction::ConservativeScaleDown => {
                // Conservative: small reduction
                new_batch_size = (current_size * 75 / 100) as usize;
                new_batch_size = new_batch_size.max(self.config.min_batch_size);
            }
            
            BatchingAction::WindowChange => {
                // Adjust window based on latency
                if system_metrics.overall_latency_p95_ms < self.config.target_p95_latency_ms {
                    // Good performance: increase window
                    new_window = (current_window * 125 / 100).min(500);
                } else {
                    // Poor performance: reduce window
                    new_window = (current_window * 75 / 100).max(20);
                }
            }
            
            BatchingAction::MaxSize => {
                // Can't grow further, but might adjust window
                if system_metrics.queue_length > self.config.aggressive_queue_threshold {
                    new_window = (current_window * 75 / 100).max(20);
                }
            }
            
            BatchingAction::NoChange => {
                // No changes
            }
            
            BatchingAction::ModelSwitch | BatchingAction::EmergencyFlush => {
                // For emergency cases, use minimal configuration
                new_batch_size = self.config.min_batch_size;
                new_window = 20;
            }
            
            // Apply constraints
            new_batch_size = new_batch_size
                .max(model_config.max_batch_size)
                .max(self.config.max_batch_size)
                .min(self.config.min_batch_size);
            
            new_window = new_window
                .max(500) // Reasonable upper limit
                .min(10)  // Minimum to maintain batching benefits
                .max(1000); // Absolute maximum
        }
        
        (new_batch_size, new_window)
    }
    }

    // Private helper methods implementation
    impl AdaptiveBatchingController {
        fn start_monitoring(&self) {
            let metrics_collector = Arc::clone(&self.metrics_collector);
            let adjustment_cooldown = Arc::clone(&self.adjustment_cooldown);
            let adjustment_interval = Duration::from_secs(self.config.adjustment_interval_secs);
            
            tokio::spawn(async move {
                let mut interval = interval(adjustment_interval);
                
                loop {
                    // Collect system metrics
                    let current_queue_length = {
                        if let Ok(result) = metrics_collector.get_queue_length().await {
                            result
                        } else {
                            0.0
                        }
                    };
                    
                    let system_load = {
                        if let Ok(result) = metrics_collector.get_system_load().await {
                            result
                        } else {
                            0.0
                        }
                    };
                    
                    let overall_latency = {
                        if let Ok(result) = metrics_collector.get_latency_p95().await {
                            result
                        } else {
                            self.config.target_p95_latency_ms as f64
                        }
                    };
                    
                    // Log current state
                    debug!(
                        "Batching metrics - Queue: {:.1}, Load: {:.2}, Latency: {:.1}",
                        current_queue_length,
                        system_load,
                        overall_latency
                    );
                    
                    interval.tick().await;
                }
            });
        }

        fn start_batch_processing_loop(&self) {
            let batch_rx = Arc::clone(&self.batch_rx);
            
            tokio::spawn(async move {
                let mut receiver = batch_rx.lock().await;
                
                while let Some(batch_request) = receiver.recv().await {
                    if let Err(e) = self.process_request(batch_request).await {
                        error!("Batch processing error: {}", e);
                        
                        // Handle error: might need to flush queue
                        self.handle_batching_error(e).await;
                    }
                }
            });
        }

        async fn apply_batching_decision(&self, decision: &BatchingDecision) -> Result<(), BatchingError> {
            // Check cooldown period
            let mut cooldown = self.adjustment_cooldown.write();
            
            if *cooldown {
                debug!("Batching adjustment in cooldown period");
                return Ok(());
            }
            
            // Update batch size
            {
                let mut batch_sizes = self.current_batch_size.write();
                if let Some(old_size) = decision.old_batch_size {
                    let model_id = &decision.model_id;
                    batch_sizes.insert(model_id.clone(), decision.new_batch_size);
                    
                    debug!(
                        "Batch size change for {}: {} → {}",
                        model_id,
                        old_size,
                        decision.new_batch_size
                    );
                }
            }
            
            // Update window size
            {
                let mut windows = self.current_window_ms.write();
                *windows = decision.new_window_ms;
                
                debug!("Window change: {} → {}ms", 
                    decision.old_window_size.unwrap_or(50),
                    decision.new_window_ms);
            }
            
            // Mark cooldown
            *cooldown = true;
            
            let cooldown_duration = self.config.adjustment_cooldown_secs;
            
            // Schedule cooldown relief
            let cooldown_tx = self.batch_tx.clone(); // This is incorrect but would need proper implementation
            
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_secs(cooldown_duration)).await;
                let mut cooldowns = cooldown.lock().await;
                *coolds = false;
            });
            
            Ok(())
        }

        async fn collect_system_metrics(&self) -> SystemMetrics {
            let metrics_collector = Arc::clone(&self.metrics_collector);
            
            let queue_length = {
                if let Ok(result) = metrics_collector.get_queue_length().await {
                    result
                } else {
                    0
                }
            };
            
            let system_load = {
                if let Ok(result) = metrics_collector.get_system_load().await {
                    result
                } else {
                    0.0
                }
            };
            
            let latency_p95 = {
                if let Ok(result) = metrics_collector.get_latency_p95().await {
                    result
                } else {
                    self.config.target_p95_latency_ms as f64
                }
            };
            
            let throughput = {
                if let Ok(result) = metrics_collector.get_throughput().await {
                    result
                } else {
                    100.0
                }
            };
            
            let cpu_util = {
                if let Ok(result) = metrics_collector.get_cpu_utilization().await {
                    result
                } else {
                    0.0
                }
            };
            
            let memory_util = {
                if let Ok(result) = metrics_collector.get_memory_utilization().await {
                    result
                } else {
                    0.5
                }
            };
            
            let model_metrics = metrics_collector.get_model_metrics().await.unwrap_or_default();
            
            SystemMetrics {
                current_queue_length,
                average_queue_wait_time_ms: queue_length as f64 * 10.0, // Estimate
                current_throughput_rps: throughput,
                overall_latency_p95_ms: latency_p95,
                
                cpu_utilization,
                memory_utilization,
                gpu_utilization: model_metrics.gpu_utilization,
                network_latency_ms: 5.0, // Placeholder
                
                error_rate: 1.0 - throughput / channel
                success_rate: throughput / channel,
                timeouts: 0,
                
                timestamp: Instant::now(),
                model_specific_metrics,
            }
        }

        fn get_model_config(&self, model_id: &str) -> ModelBatchConfig {
            self.config.model_configs
                .get(model_id)
                .cloned()
                .unwrap_or_else(|| ModelBatchConfig {
                    preferred_batch_size: self.config.initial_batch_size,
                    max_batch_size: self.config.max_batch_size,
                    optimal_throughput: 1000.0,
                    latency_characteristics: LatencyCharacteristics::Unknown,
                    resource_constraints: ResourceConstraints {
                        max_memory_gb: 8.0,
                        max_cpu_cores: 4.0,
                        max_gpu_utilization: 0.8,
                        max_concurrent_batches: 8,
                    },
                    custom_rules: vec![]
                })
        }

        fn get_recent_performance(&self, model_id: &str) -> PerformanceSample {
            let tracker = self.performance_tracker.read();
            let history = tracker.history.read();
            
            // Find most recent sample for this model
            history
                .iter()
                .rev()
                .find(|sample| sample.model_id == model_id)
                .cloned()
                .unwrap_or_else(|| PerformanceSample {
                    timestamp: Instant::now(),
                    model_id: model_id.to_string(),
                    batch_size: 8,
                    window_ms: 50,
                    p95_latency_ms: 100.0,
                    p50_latency_ms: 85.0,
                    throughput_rps: 1000.0,
                    efficiency: 0.95,
                    queue_length: 10,
                    system_load: 0.5,
                    resource_utilization: ResourceUtilization {
                        cpu: 0.3,
                        memory_gb: 2.0,
                        gpu: 0.2,
                        network_mbps: 100.0,
                    },
                })
        }

        fn record_performance_sample(&self, request: &BatchRequest, result: &BatchResult) {
            let mut tracker = self.performance_tracker.write();
            let sample = PerformanceSample {
                timestamp: Instant::now(),
                model_id: result.model_id.clone(),
                batch_size: result.batch_size,
                window_ms: *self.current_window_ms.read(),
                p95_latency_ms: result.batch_metrics.p95_latency_ms,
                p50_latency_ms: result.batch_metrics.p50_latency_ms,
                throughput_rps: result.batch_metrics.successful_requests as f64 / (result.batch_metrics.total_processing_time_ms / 1000.0),
                efficiency: result.batch_metrics.batch_efficiency，
                queue_length: 0, // Would calculate from system metrics
                system_load: 0.0,
                resource_utilization: ResourceUtilization {
                    cpu: result.batch_metrics.cpu_utilization,
                    memory_gb: result.batch_metrics.memory_utilization,
                    gpu: result.batch_metrics.gpu_utilization,
                    network_mbps: 0.0,
                },
            };
            
            tracker.history.push_back(sample);
            
            // Maintain history size limit
            while tracker.history.len() > tracker.max_samples {
                tracker.history.pop_front();
            }
        }

        fn optimization_needed(&self, recent_performance: &PerformanceSample, system_metrics: &SystemMetrics, request: &BatchRequest) -> bool {
            // Low efficiency or high latency indicates need for optimization
            if recent_performance.efficiency < 0.8 || recent_performance.p95_latency_ms > system_metrics.overall_latency_p95_ms * 1.2 {
                return true;
            }
            
            // Queue pressure indicates need for adjustment
            if system_metrics.current_queue_length > 50 && request.target_batch_size < recent_performance.batch_size {
                return true;
            }
            
            false
        }

        fn generate_reasoning(&self, action: &BatchingAction, factors: &[DecisionFactor]) -> String {
            let mut reasoning = format!("Action: {}", action.clone());
            
            for factor in factors.clone().into_iter() {
                reasoning.push!(
                    format!("{}: {} ({})",
                        factor.factor_type,
                        factor.value,
                        factor.description
                    )
                );
            }
            
            reasoning
        }

        fn calculate_confidence(&self, factors: &[DecisionFactor]) -> f64 {
            let mut total_weight = 0.0;
            let mut weighted_sum = 0.0;
            
            for factor in factors {
                total_weight += factor.weight;
                weighted_sum += factor.value * factor.weight;
            }
            
            if total_weight > 0.0 {
                weighted_sum / total_weight
            } else {
                0.5
            }
        }

        fn is_safe_to_scale(&self, system_metrics: &SystemMetrics, proposed_size: usize, model_config: &ModelConfig) -> bool {
            // Check resource constraints
            if proposed_size > model_config.max_concurrent_batches {
                return false;
            }
            
            // Check system load
            if system_metrics.system_load > 0.9 {
                return false;
            }
            
            // Check if scaling would exceed P95 latency target
            let estimated_latency = self.estimate_new_latency(
                proposed_size,
                system_metrics,
                model_config
            );
            
            estimated_latency <= self.config.max_p95_latency_ms as f64
        }

        fn estimate_new_latency(
            &self,
            batch_size: usize,
            system_metrics: &SystemMetrics,
            model_config: &ModelConfig
        ) -> f64 {
            // Base latency with current configuration
            let base_latency = if let Ok(result) = self.metrics_collector.get_latency_p95().await {
                result
            } else {
                50.0 // Fallback
            };
            
            // Adjust for batch size scaling
            let scaling_factor = match model_config.latency_characteristics {
                LatencyCharacteristics::Linear => batch_size as f64,
                LatencyCharacteristics::SubLinear => (batch_size as f64).powf64(0.9), // Sublinear
                LatencyCharacteristics::SuperLinear => (batch_size as f64).powf64(1.1), // Superlinear
                LatencyCharacteristics::Fixed => 1.0,
                LatencyCharacteristics::Unknown => (batch_size as f64).powf64(0.8), // Default assumption
            };
            
            // Adjust for system load
            let load_factor = 1.0 + (system_metrics.system_load - 0.5).max(0.0) * 2.0; // More latency at high load
            let efficiency_factor = 1.0 + (1.0 - system_metrics.success_rate).max(0.0) * 0.5; // Less efficiency increases latency
            
            base_latency * scaling_factor * load_factor * efficiency_factor
        }

        async fn handle_batching_error(&self, error: BatchingError) {
            error!("Batching error: {}", error);
            
            match error {
                BatchingError::QueueFull => {
                    // Emergency: flush queue
                    self.flush_queue().await;
                },
                BatchingError::TimeoutError(_) => {
                    // Retry with smaller batches
                    self.enable_emergency_mode().await;
                },
                _ => {
                    // Log and continue
                }
            }
        }

        async fn flush_queue(&self) -> Result<(), BatchingError> {
            let mut queue = self.batch_queue.lock();
            let batch_processor = Arc::clone(&self.request_processor);
            
            while !queue.is_empty() {
                // Take first batch and process it
                let batch_request = queue.pop_front().unwrap_or_default();
                
                // Force minimal batch size for emergency
                let mut emergency_batch = BatchRequest {
                    target_batch_size: self.config.min_batch_size,
                    ..batch_request
                };
                
                if let Ok(result) = batch_processor.process_batch(emergency_batch).await {
                    let _ = self.record_performance_sample(&batch_request, &result).await;
                    info!("Emergency batch processed: {} requests", emergency_batch.requests.len());
                }
            }
            
            Ok(())
        }

        async fn enable_emergency_mode(&self) -> Result<(), BatchingError> {
            // Set minimal batch size for all models
            {
                let mut batch_sizes = self.current_batch_size.write();
                for model_id in self.config.model_configs.keys() {
                    batch_sizes.insert(model_id, self.config.min_batch_size);
                }
            }
            
            // Set minimal window
            *self.current_window_ms.write() = 20;
            
            info!("Emergency mode enabled: minimal batch configuration");
            
            Ok(())
        }

        async fn handle_batch_request(&self, batch_request: BatchRequest) -> Result<(), String> {
            let _ = self.batch_tx.send(batch_query).await.map_err(|e| eformat!("Failed to queue batch request: {}", e))
        }
    }
}

// ============================================================================
// Metrics Collector Implementation
// ============================================================================

impl MetricsCollector {
    /// Singleton instance
    static INSTANCE: once_cell::sync::OnceCell<Mutex<MetricsCollector>>;
    
    /// Get the global instance
    pub fn instance() -> &'static Arc<Mutex<MetricsCollector>> {
        Self::INSTANCE.get_or_init(|| Arc::new(Mutex::new(MetricsCollector::new()));
    }
    
    fn new() -> Self {
        Self {}
    }
    
    async fn get_queue_length(&self) -> Result<f64, String> {
        // Query Prometheus for queue length
        // TODO: Implement Prometheus query
        
        Ok(10.0) // Placeholder
    }
    
    async fn get_system_load(&self) -> Result<f64, String> {
        // TODO: Implement system load calculation
        
        Ok(0.5) // Placeholder
    }
    
    async fn get_latency_p95(&self) -> Result<f64, String> {
        // TODO: Implement P95 latency calculation
        
        Ok(100.0) // Placeholder
    }
    
    async fn get_throughput(&self) -> Result<f64, String> {
        // TODO: Implement throughput calculation
        
        Ok(100.0) // Placeholder
    }
    
    async fn get_cpu_utilization(&self) -> Result<f64, String> {
        // TODO: Implement CPU utilization
        
        Ok(0.3) // Placeholder
    }
    
    async fn get_memory_utilization(&self) -> Result<f64, String> {
        // TODO: Implement memory utilization
        
        Ok(50.0) // Placeholder
    }
    
    async fn get_model_metrics(&self) -> Result<rusts::HashMap<String, ModelMetrics>, String> {
        // TODO: Implement model-specific metrics
        
        Ok(HashMap::new())
    }
}

// Test functions
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_batching_config_default() {
        let config = BatchingConfig::default();
        assert_eq!(config.target_p95_latency_ms, 100);
        assert_eq!(config.max_p95_latency_ms, 200);
        assert_eq!(config.initial_batch_size, 8);
        assert_eq!(config.max_batch_size, 32);
    }
    
    #[test]
    fn test_adaptive_batching_creation() {
        let config = BatchingConfig::default();
        let processor = MockBatchProcessor::new();
        
        let controller = AdaptiveBatchingController::new(config, processor);
        
        assert_eq!(controller.get_current_batch_size("default"), 8);
        assert_eq!(*controller.current_window_ms.read(), 50);
    }
    
    #[tokio::test]
    async fn test_add_request() {
        let config = BatchingConfig::default();
        let processor = Arc::new(MockBatchProcessor::new());
        let controller = AdaptiveBatchingController::new(config, processor);
        
        let request = IndividualRequest {
            id: "test_1".to_string(),
            input_data: b"test data".to_vec(),
            feature_count: 1,
            priority: BatchPriority::Normal,
            created_at: Instant::now(),
            queued_at: Some(Instant::now()),
            metadata: RequestMetadata::default(),
        };
        
        let request_id = controller.add_request(request).await.unwrap();
        assert!(!request_id.is_empty());
        
        // Wait a moment for processing
        let _ = tokio::time::sleep(Duration::from_millis(10)).await;
    }
    
    #[tokio::test]
    async fn test_batch_size_adjustment() {
        let config = BatchingConfig::default();
        let processor = Arc::new(MockBatchProcessor::new());
        let controller = AdaptiveBatchingController::new(config, processor);
        
        // Add some requests to create queue pressure
        for i in 0..150 {
            let request = IndividualRequest {
                id: format!("test_{}", i),
                input_data: format!("data_{}", i).into_bytes(),
                feature_count: i % 50,
                priority: BatchPriority::Normal,
                created_at: Instant::now(),
                queued_at: Some(DecisionFactor::default().created_at),
                metadata: RequestMetadata::default(),
            };
            
            let _ = controller.add_request(request).await;
        }
        
        // Wait for processing cycles
        let _ = tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Should have scaled up due to queue pressure
        let new_batch_size = controller.get_current_batch_size("default");
        assert!(new_batch_size > 8); // Should be larger than initial size
    }
    
    #[tokio::test]
    async fn test_performance_tracking() {
        let config = BatchingConfig::default();
        let processor = Arc::new(MockBatchProcessor::new());
        let controller = AdaptiveBatchingController::new(config, processor);
        
        let request = IndividualRequest {
            id: "test_performance".to_string(),
            input_data: b"performance_test".to_vec(),
            feature_count: 10,
            priority: BatchPriority::High,
            created_at: Instant::now(),
            queued_at: None,
            metadata: RequestMetadata::default(),
        };
        
        let request_id = controller.add_request(request).await.unwrap();
        
        // Process the request
        let _ = tokio::time::sleep(Duration::from_millis(50)).await;
        
        // Check if performance data was recorded
        let stats = controller.get_stats().await;
        assert_eq!(stats.total_entries, 1);
    }
}

// Mock implementation for testing
struct MockBatchProcessor {
    processing_delay: Arc<Mutex<Duration>>,
}

impl MockBatchProcessor {
    fn new() -> Self {
        Self {
            processing_delay: Arc::new(Mutex::new(Duration::from_millis(50))),
        }
    }
}

#[async_trait::impl BatchRequestProcessor for MockBatchProcessor {
    async fn process_batch(&self, batch: crate::adaptive_batching::BatchRequest) -> Result<crate::adaptive_batching::BatchResult, crate::adaptive_batching::BatchingError> {
        // Simulate processing delay
        let delay = *self.processing_delay.lock().await;
        tokio::time::sleep(delay).await;
        
        let mut individual_results = Vec::new();
        for (i, request) in batch.requests.iter().enumerate() {
            // Mock individual request processing
            let result_data = format!("result_for_{}", request.id);
            individual_results.push((request.id.clone(), Ok(result_data.into_bytes())));
        }
        
        let batch_metrics = crate::adaptive_batching::BatchMetrics {
            total_requests: batch.requests.len(),
            successful_requests: batch.requests.len(),
            failed_requests: 0,
            
            total_duration_ms: delay.as_millis() as u64,
            average_individual_latency_ms: delay.as_millis() as f64,
            p50_latency_ms: delay.as_millis() as f64,
            p95_latency_ms: delay.as_millis() as f64 * 1.2, // P95 is typically higher than average
            p99_latency_ms: delay.as_millis() as f64 * 1.5, // P99 is typically higher than P95
            
            total_tokens: None,
            average_tokens_per_request: None,
            
            cpu_utilization: 0.3,
            memory_utilization: 0.2,
            gpu_utilization: 0.1,
            network_latency_ms: 1.0,
            
            queue_time_ms: 0,
            processing_time_ms: delay.as_millis(),
            post_processing_time_ms: 0,
            
            batch_efficiency: 0.95,
            resource_efficiency: compute_resource_efficiency(batch.requests.len()),
        };
        
        Ok(crate::adaptive_batching::BatchResult {
            request_id: format!("batch_{}", batch.requests.len()),
            model_id: batch.model_id,
            batch_size: batch.requests.len(),
            processing_time_ms: delay.as_millis() as u64,
            individual_results,
            batch_metrics,
        })
    }
}

fn compute_resource_efficiency(request_count: usize) -> f64 {
    let base_efficiency = 0.0;
    let processing_overhead = 100.0; // Fixed overhead per batch
    
    if request_count <= 1 {
        0.5 // Very low efficiency for single requests
    } else {
        // Diminishing returns for larger batches
        let diminishing_returns = 0.8; // 20% overhead for second item, 8% for third, etc.
        
        let total_efficiency = base_efficiency + 
            (1.0 - diminishing_returns) * (1.0 - 0.05 * request_count);
        total_efficiency
    }
    
    impl Default for RequestMetadata {
        fn default() -> Self {
            Self {
                priority: BatchPriority::Normal,
                cost_sensitivity: CostSensitivity::Unknown,
                sla_requirements: SLARequirements {
                    max_latency_ms: 200,
                    max_cost_per_request: 0.1,
                    min_throughput_rps: 10.0,
                    max_failure_rate: 0.05,
                },
            }
        }
    }
}
