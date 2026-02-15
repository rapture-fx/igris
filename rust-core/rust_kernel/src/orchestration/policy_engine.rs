//! Adaptive Policy Engine
//!
//! Dynamically adjusts inference routing and batching parameters based on
//! real-time telemetry feedback from the system.
//!
//! # Design Goals
//! - Policy update latency: <100ms
//! - Safe parameter bounds enforcement
//! - Checkpoint integration for rollback
//! - Telemetry-driven adaptation
//!
//! # Example
//! ```no_run
//! use igris_kernel::orchestration::AdaptivePolicyEngine;
//!
//! let engine = AdaptivePolicyEngine::new(config);
//! engine.update_from_telemetry(&telemetry_snapshot);
//! let policy = engine.get_current_policy();
//! ```

use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use dashmap::DashMap;
use crate::reliability::checkpoint::CheckpointManager;

/// Maximum allowed deviation from baseline before forcing rollback
const MAX_DRIFT_PERCENT: f64 = 5.0;

/// Configuration for the Adaptive Policy Engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyEngineConfig {
    /// Enable adaptive policy updates
    pub enabled: bool,

    /// Minimum interval between policy updates
    pub update_interval_ms: u64,

    /// Confidence threshold for applying policy changes (0.0-1.0)
    pub confidence_threshold: f64,

    /// Maximum batch size allowed
    pub max_batch_size: usize,

    /// Minimum batch size allowed
    pub min_batch_size: usize,

    /// Target cache hit rate (0.0-1.0)
    pub target_cache_hit_rate: f64,

    /// Target latency in milliseconds
    pub target_latency_ms: f64,

    /// Enable checkpoint integration for rollback
    pub enable_checkpoints: bool,
}

impl Default for PolicyEngineConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            update_interval_ms: 100,
            confidence_threshold: 0.85,
            max_batch_size: 128,
            min_batch_size: 4,
            target_cache_hit_rate: 0.97,
            target_latency_ms: 150.0,
            enable_checkpoints: true,
        }
    }
}

/// Routing policy for inference requests
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RoutingPolicy {
    /// Preferred model endpoint
    pub primary_endpoint: String,

    /// Fallback endpoint for load balancing
    pub fallback_endpoint: String,

    /// Traffic split ratio (0.0-1.0) to primary
    pub traffic_split: f64,

    /// Circuit breaker threshold
    pub circuit_breaker_threshold: u32,

    /// Request timeout in milliseconds
    pub timeout_ms: u64,
}

impl Default for RoutingPolicy {
    fn default() -> Self {
        Self {
            primary_endpoint: "default".to_string(),
            fallback_endpoint: "fallback".to_string(),
            traffic_split: 0.8,
            circuit_breaker_threshold: 10,
            timeout_ms: 5000,
        }
    }
}

/// Batching policy for request aggregation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BatchingPolicy {
    /// Current batch size
    pub batch_size: usize,

    /// Maximum wait time for batch to fill (ms)
    pub max_wait_ms: u64,

    /// Enable dynamic batch size adjustment
    pub dynamic_sizing: bool,

    /// Batch timeout threshold
    pub timeout_threshold_ms: u64,
}

impl Default for BatchingPolicy {
    fn default() -> Self {
        Self {
            batch_size: 32,
            max_wait_ms: 10,
            dynamic_sizing: true,
            timeout_threshold_ms: 50,
        }
    }
}

/// Unified policy update containing all adjustable parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyUpdate {
    /// Timestamp of the update
    pub timestamp: u64,

    /// Updated routing policy
    pub routing: RoutingPolicy,

    /// Updated batching policy
    pub batching: BatchingPolicy,

    /// Confidence score for this update (0.0-1.0)
    pub confidence: f64,

    /// Source telemetry metrics that triggered this update
    pub trigger_metrics: TelemetrySnapshot,

    /// Policy version for tracking
    pub version: u32,
}

impl Default for PolicyUpdate {
    fn default() -> Self {
        Self {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            routing: RoutingPolicy::default(),
            batching: BatchingPolicy::default(),
            confidence: 1.0,
            trigger_metrics: TelemetrySnapshot::default(),
            version: 0,
        }
    }
}

/// Snapshot of telemetry metrics used for policy decisions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    /// Average latency in milliseconds
    pub avg_latency_ms: f64,

    /// P95 latency in milliseconds
    pub p95_latency_ms: f64,

    /// Current cache hit rate (0.0-1.0)
    pub cache_hit_rate: f64,

    /// Request throughput (requests per second)
    pub throughput_rps: f64,

    /// Error rate (0.0-1.0)
    pub error_rate: f64,

    /// CPU utilization (0.0-1.0)
    pub cpu_utilization: f64,

    /// Memory utilization (0.0-1.0)
    pub memory_utilization: f64,

    /// Cost efficiency score (normalized 0.0-1.0)
    pub cost_efficiency: f64,
}

impl Default for TelemetrySnapshot {
    fn default() -> Self {
        Self {
            avg_latency_ms: 100.0,
            p95_latency_ms: 150.0,
            cache_hit_rate: 0.95,
            throughput_rps: 100.0,
            error_rate: 0.01,
            cpu_utilization: 0.5,
            memory_utilization: 0.5,
            cost_efficiency: 0.8,
        }
    }
}

/// Policy history entry for tracking and rollback
#[derive(Debug, Clone)]
struct PolicyHistoryEntry {
    update: PolicyUpdate,
    applied_at: Instant,
    performance_metrics: Option<TelemetrySnapshot>,
}

/// Adaptive Policy Engine - core orchestration component
pub struct AdaptivePolicyEngine {
    config: Arc<RwLock<PolicyEngineConfig>>,
    current_policy: Arc<RwLock<PolicyUpdate>>,
    baseline_policy: Arc<RwLock<PolicyUpdate>>,
    policy_history: Arc<DashMap<u32, PolicyHistoryEntry>>,
    checkpoint_manager: Option<Arc<CheckpointManager>>,
    last_update: Arc<RwLock<Instant>>,
    version_counter: Arc<RwLock<u32>>,
    metrics: Arc<RwLock<PolicyEngineMetrics>>,
}

/// Internal metrics for the policy engine
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PolicyEngineMetrics {
    total_updates: u64,
    successful_updates: u64,
    rejected_updates: u64,
    rollbacks: u64,
    avg_confidence: f64,
    last_update_latency_ms: f64,
}

impl Default for PolicyEngineMetrics {
    fn default() -> Self {
        Self {
            total_updates: 0,
            successful_updates: 0,
            rejected_updates: 0,
            rollbacks: 0,
            avg_confidence: 0.0,
            last_update_latency_ms: 0.0,
        }
    }
}

impl AdaptivePolicyEngine {
    /// Create a new Adaptive Policy Engine
    pub fn new(config: PolicyEngineConfig) -> Self {
        let initial_policy = PolicyUpdate {
            timestamp: Self::current_timestamp_ms(),
            routing: RoutingPolicy::default(),
            batching: BatchingPolicy::default(),
            confidence: 1.0,
            trigger_metrics: TelemetrySnapshot::default(),
            version: 0,
        };

        Self {
            config: Arc::new(RwLock::new(config.clone())),
            current_policy: Arc::new(RwLock::new(initial_policy.clone())),
            baseline_policy: Arc::new(RwLock::new(initial_policy)),
            policy_history: Arc::new(DashMap::new()),
            checkpoint_manager: None,
            last_update: Arc::new(RwLock::new(Instant::now())),
            version_counter: Arc::new(RwLock::new(0)),
            metrics: Arc::new(RwLock::new(PolicyEngineMetrics::default())),
        }
    }

    /// Initialize with checkpoint manager for rollback support
    pub fn with_checkpoint_manager(mut self, manager: Arc<CheckpointManager>) -> Self {
        self.checkpoint_manager = Some(manager);
        self
    }

    /// Update policies based on incoming telemetry
    pub fn update_from_telemetry(&self, telemetry: &TelemetrySnapshot) -> Result<bool, String> {
        let start = Instant::now();

        // Check if updates are enabled
        let config = self.config.read().unwrap();
        if !config.enabled {
            return Ok(false);
        }

        // Check update interval throttling
        let last_update = *self.last_update.read().unwrap();
        let elapsed = start.duration_since(last_update);
        if elapsed < Duration::from_millis(config.update_interval_ms) {
            return Ok(false);
        }

        // Compute new policy based on telemetry
        let new_policy = self.compute_adaptive_policy(telemetry, &config)?;

        // Validate confidence threshold
        if new_policy.confidence < config.confidence_threshold {
            let mut metrics = self.metrics.write().unwrap();
            metrics.total_updates += 1;
            metrics.rejected_updates += 1;
            return Ok(false);
        }

        // Note: Checkpoint integration skipped for now
        // Phase 9 CheckpointManager uses different snapshot format
        // Future enhancement: create PolicyCheckpointManager wrapper

        // Apply the new policy
        self.apply_policy(new_policy)?;

        // Update metrics
        let update_latency = start.elapsed().as_secs_f64() * 1000.0;
        let mut metrics = self.metrics.write().unwrap();
        metrics.total_updates += 1;
        metrics.successful_updates += 1;
        metrics.last_update_latency_ms = update_latency;

        // Update last update timestamp
        *self.last_update.write().unwrap() = Instant::now();

        Ok(true)
    }

    /// Compute adaptive policy based on telemetry and optimization goals
    fn compute_adaptive_policy(
        &self,
        telemetry: &TelemetrySnapshot,
        config: &PolicyEngineConfig,
    ) -> Result<PolicyUpdate, String> {
        let current = self.current_policy.read().unwrap().clone();
        let mut new_routing = current.routing.clone();
        let mut new_batching = current.batching.clone();
        let mut confidence = 1.0;

        // Adjust batching based on latency targets
        if telemetry.avg_latency_ms > config.target_latency_ms {
            // Latency too high - reduce batch size for faster processing
            new_batching.batch_size = (new_batching.batch_size as f64 * 0.9).max(config.min_batch_size as f64) as usize;
            new_batching.max_wait_ms = (new_batching.max_wait_ms as f64 * 0.8) as u64;
            confidence *= 0.9;
        } else if telemetry.avg_latency_ms < config.target_latency_ms * 0.7 {
            // Latency well below target - increase batch size for better throughput
            new_batching.batch_size = (new_batching.batch_size as f64 * 1.1).min(config.max_batch_size as f64) as usize;
            new_batching.max_wait_ms = (new_batching.max_wait_ms as f64 * 1.2) as u64;
        }

        // Adjust routing based on error rate
        if telemetry.error_rate > 0.05 {
            // High error rate - increase fallback traffic
            new_routing.traffic_split = (new_routing.traffic_split - 0.1).max(0.5);
            new_routing.circuit_breaker_threshold = (new_routing.circuit_breaker_threshold as f64 * 0.8) as u32;
            confidence *= 0.85;
        } else if telemetry.error_rate < 0.01 {
            // Low error rate - increase primary traffic
            new_routing.traffic_split = (new_routing.traffic_split + 0.05).min(1.0);
        }

        // Adjust for cache hit rate optimization
        if telemetry.cache_hit_rate < config.target_cache_hit_rate {
            // Poor cache performance - reduce batch variation to improve locality
            new_batching.dynamic_sizing = false;
            confidence *= 0.95;
        }

        // Adjust for resource utilization
        if telemetry.cpu_utilization > 0.85 || telemetry.memory_utilization > 0.85 {
            // High resource pressure - reduce batch size
            new_batching.batch_size = (new_batching.batch_size as f64 * 0.85) as usize;
            new_routing.timeout_ms = (new_routing.timeout_ms as f64 * 1.2) as u64;
            confidence *= 0.9;
        }

        // Ensure bounds
        new_batching.batch_size = new_batching.batch_size.clamp(config.min_batch_size, config.max_batch_size);

        // Increment version
        let mut version = self.version_counter.write().unwrap();
        *version += 1;

        Ok(PolicyUpdate {
            timestamp: Self::current_timestamp_ms(),
            routing: new_routing,
            batching: new_batching,
            confidence,
            trigger_metrics: telemetry.clone(),
            version: *version,
        })
    }

    /// Apply a new policy update
    fn apply_policy(&self, policy: PolicyUpdate) -> Result<(), String> {
        // Store in history
        self.policy_history.insert(
            policy.version,
            PolicyHistoryEntry {
                update: policy.clone(),
                applied_at: Instant::now(),
                performance_metrics: None,
            },
        );

        // Update current policy
        *self.current_policy.write().unwrap() = policy;

        Ok(())
    }

    /// Get the current active policy
    pub fn get_current_policy(&self) -> PolicyUpdate {
        self.current_policy.read().unwrap().clone()
    }

    /// Get baseline policy for drift comparison
    pub fn get_baseline_policy(&self) -> PolicyUpdate {
        self.baseline_policy.read().unwrap().clone()
    }

    /// Set a new baseline policy
    pub fn set_baseline_policy(&self, policy: PolicyUpdate) {
        *self.baseline_policy.write().unwrap() = policy;
    }

    /// Rollback to a previous policy version
    pub fn rollback_to_version(&self, version: u32) -> Result<(), String> {
        let entry = self.policy_history.get(&version)
            .ok_or_else(|| format!("Policy version {} not found", version))?;

        let policy = entry.update.clone();
        drop(entry); // Release the lock

        // Note: Checkpoint-based rollback skipped for now
        // Using history-based rollback instead

        // Fallback to history-based rollback
        self.apply_policy(policy)?;

        let mut metrics = self.metrics.write().unwrap();
        metrics.rollbacks += 1;

        Ok(())
    }

    /// Rollback to baseline policy
    pub fn rollback_to_baseline(&self) -> Result<(), String> {
        let baseline = self.baseline_policy.read().unwrap().clone();
        self.apply_policy(baseline)?;

        let mut metrics = self.metrics.write().unwrap();
        metrics.rollbacks += 1;

        Ok(())
    }

    /// Get current metrics
    pub fn get_metrics(&self) -> PolicyEngineMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Export current policy as JSON
    pub fn export_policy_json(&self) -> String {
        let policy = self.get_current_policy();
        serde_json::to_string_pretty(&policy).unwrap_or_else(|_| "{}".to_string())
    }

    /// Import policy from JSON
    pub fn import_policy_json(&self, json: &str) -> Result<(), String> {
        let policy: PolicyUpdate = serde_json::from_str(json)
            .map_err(|e| format!("Failed to parse policy JSON: {}", e))?;

        self.apply_policy(policy)
    }


    /// Get current timestamp in milliseconds
    fn current_timestamp_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_policy_engine_creation() {
        let config = PolicyEngineConfig::default();
        let engine = AdaptivePolicyEngine::new(config);
        let policy = engine.get_current_policy();

        assert_eq!(policy.version, 0);
        assert_eq!(policy.confidence, 1.0);
    }

    #[test]
    fn test_policy_adaptation_high_latency() {
        let mut config = PolicyEngineConfig::default();
        config.update_interval_ms = 0; // Allow immediate updates
        let engine = AdaptivePolicyEngine::new(config);

        let initial_policy = engine.get_current_policy();
        let initial_batch_size = initial_policy.batching.batch_size;

        // Wait to ensure we're past the initial interval
        std::thread::sleep(std::time::Duration::from_millis(10));

        // Simulate high latency telemetry
        let high_latency_telemetry = TelemetrySnapshot {
            avg_latency_ms: 200.0, // Above target of 150ms
            p95_latency_ms: 250.0,
            cache_hit_rate: 0.95,
            throughput_rps: 100.0,
            error_rate: 0.01,
            cpu_utilization: 0.6,
            memory_utilization: 0.5,
            cost_efficiency: 0.8,
        };

        engine.update_from_telemetry(&high_latency_telemetry).unwrap();
        let updated_policy = engine.get_current_policy();

        // Batch size should decrease to reduce latency
        assert!(updated_policy.batching.batch_size < initial_batch_size);
        assert!(updated_policy.confidence < 1.0);
    }

    #[test]
    fn test_policy_adaptation_high_error_rate() {
        let mut config = PolicyEngineConfig::default();
        config.update_interval_ms = 0; // Allow immediate updates
        config.confidence_threshold = 0.80; // Lower threshold to accept the update
        let engine = AdaptivePolicyEngine::new(config);

        let initial_policy = engine.get_current_policy();
        let initial_traffic_split = initial_policy.routing.traffic_split;

        // Wait to ensure we're past the initial interval
        std::thread::sleep(std::time::Duration::from_millis(10));

        // Simulate high error rate
        let high_error_telemetry = TelemetrySnapshot {
            avg_latency_ms: 100.0,
            p95_latency_ms: 150.0,
            cache_hit_rate: 0.95,
            throughput_rps: 100.0,
            error_rate: 0.08, // 8% error rate
            cpu_utilization: 0.5,
            memory_utilization: 0.5,
            cost_efficiency: 0.7,
        };

        let result = engine.update_from_telemetry(&high_error_telemetry).unwrap();
        assert!(result, "Update should have been accepted");

        let updated_policy = engine.get_current_policy();

        // Traffic split should shift more to fallback
        assert!(updated_policy.routing.traffic_split < initial_traffic_split,
            "Expected traffic_split {} < initial {}", updated_policy.routing.traffic_split, initial_traffic_split);
    }

    #[test]
    fn test_policy_rollback() {
        let config = PolicyEngineConfig::default();
        let engine = AdaptivePolicyEngine::new(config);

        let baseline = engine.get_current_policy();
        let baseline_version = baseline.version;

        // Apply multiple updates
        for _ in 0..3 {
            let telemetry = TelemetrySnapshot::default();
            engine.update_from_telemetry(&telemetry).ok();
        }

        // Rollback to baseline
        engine.rollback_to_baseline().unwrap();
        let restored = engine.get_current_policy();

        assert_eq!(restored.batching, baseline.batching);
        assert_eq!(restored.routing, baseline.routing);
    }

    #[test]
    fn test_confidence_threshold_rejection() {
        let mut config = PolicyEngineConfig::default();
        config.confidence_threshold = 0.95;
        config.update_interval_ms = 0; // Allow immediate updates
        let engine = AdaptivePolicyEngine::new(config);

        // Wait to ensure we're past the initial interval
        std::thread::sleep(std::time::Duration::from_millis(10));

        // Create telemetry that will produce low confidence
        let telemetry = TelemetrySnapshot {
            avg_latency_ms: 200.0,
            p95_latency_ms: 300.0,
            cache_hit_rate: 0.85,
            throughput_rps: 50.0,
            error_rate: 0.1,
            cpu_utilization: 0.9,
            memory_utilization: 0.9,
            cost_efficiency: 0.5,
        };

        let result = engine.update_from_telemetry(&telemetry).unwrap();
        assert_eq!(result, false); // Update should be rejected

        let metrics = engine.get_metrics();
        assert!(metrics.rejected_updates > 0);
    }

    #[test]
    fn test_policy_export_import() {
        let config = PolicyEngineConfig::default();
        let engine = AdaptivePolicyEngine::new(config);

        let original = engine.get_current_policy();
        let json = engine.export_policy_json();

        // Create new engine and import
        let engine2 = AdaptivePolicyEngine::new(PolicyEngineConfig::default());
        engine2.import_policy_json(&json).unwrap();
        let imported = engine2.get_current_policy();

        assert_eq!(imported.batching, original.batching);
        assert_eq!(imported.routing, original.routing);
    }
}
