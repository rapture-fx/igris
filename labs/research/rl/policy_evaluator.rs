//! Policy Evaluator with Shadow Evaluation
//!
//! Validates candidate policies in a safe shadow environment before
//! applying them to production traffic.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use std::collections::VecDeque;
use std::time::{Duration, Instant};
use crate::rl::rl_agent::AgentDecision;
use crate::orchestration::policy_engine::{PolicyUpdate, TelemetrySnapshot};

/// Configuration for policy evaluator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluatorConfig {
    /// Enable shadow evaluation
    pub enabled: bool,

    /// Shadow traffic percentage (0.001-0.01 = 0.1%-1%)
    pub shadow_traffic_percent: f64,

    /// Evaluation duration (seconds)
    pub evaluation_duration_secs: u64,

    /// Minimum reward improvement to approve
    pub min_reward_improvement: f64,

    /// Maximum drift tolerance (percent)
    pub max_drift_tolerance: f64,

    /// Require HMAC signature for commit
    pub require_signature: bool,

    /// Integrate with checkpoint manager
    pub enable_checkpoints: bool,
}

impl Default for EvaluatorConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            shadow_traffic_percent: 0.005, // 0.5%
            evaluation_duration_secs: 300, // 5 minutes
            min_reward_improvement: 0.01, // 1%
            max_drift_tolerance: 5.0, // 5%
            require_signature: true,
            enable_checkpoints: true,
        }
    }
}

/// Result of policy evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationResult {
    /// Policy was approved
    pub approved: bool,

    /// Reason for decision
    pub reason: String,

    /// Reward improvement (%)
    pub reward_improvement_percent: f64,

    /// Drift score (%)
    pub drift_score: f64,

    /// Evaluation duration (seconds)
    pub evaluation_duration_secs: f64,

    /// Shadow traffic metrics
    pub shadow_metrics: TelemetrySnapshot,

    /// Baseline metrics
    pub baseline_metrics: TelemetrySnapshot,

    /// Timestamp
    pub timestamp_ms: u64,

    /// HMAC signature (if required)
    pub signature: Option<String>,
}

/// Shadow evaluation state
#[derive(Debug, Clone)]
struct ShadowState {
    candidate_policy: PolicyUpdate,
    start_time: Instant,
    shadow_telemetry: VecDeque<TelemetrySnapshot>,
    baseline_telemetry: VecDeque<TelemetrySnapshot>,
}

/// Policy evaluator
pub struct PolicyEvaluator {
    config: Arc<RwLock<EvaluatorConfig>>,
    shadow_state: Arc<RwLock<Option<ShadowState>>>,
    evaluation_history: Arc<RwLock<VecDeque<EvaluationResult>>>,
    metrics: Arc<RwLock<EvaluatorMetrics>>,
}

/// Evaluator metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluatorMetrics {
    pub total_evaluations: u64,
    pub approved_policies: u64,
    pub rejected_policies: u64,
    pub avg_evaluation_duration_secs: f64,
    pub avg_reward_improvement: f64,
}

impl Default for EvaluatorMetrics {
    fn default() -> Self {
        Self {
            total_evaluations: 0,
            approved_policies: 0,
            rejected_policies: 0,
            avg_evaluation_duration_secs: 0.0,
            avg_reward_improvement: 0.0,
        }
    }
}

impl PolicyEvaluator {
    /// Create a new policy evaluator
    pub fn new(config: EvaluatorConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            shadow_state: Arc::new(RwLock::new(None)),
            evaluation_history: Arc::new(RwLock::new(VecDeque::new())),
            metrics: Arc::new(RwLock::new(EvaluatorMetrics::default())),
        }
    }

    /// Start shadow evaluation of a candidate policy
    pub fn start_shadow_evaluation(
        &self,
        decision: &AgentDecision,
        baseline_policy: &PolicyUpdate,
    ) -> Result<(), String> {
        let config = self.config.read().unwrap();

        if !config.enabled {
            return Err("Evaluator disabled".to_string());
        }

        // Create candidate policy from agent decision
        let candidate_policy = self.decision_to_policy(decision, baseline_policy)?;

        // Initialize shadow state
        let shadow_state = ShadowState {
            candidate_policy,
            start_time: Instant::now(),
            shadow_telemetry: VecDeque::new(),
            baseline_telemetry: VecDeque::new(),
        };

        *self.shadow_state.write().unwrap() = Some(shadow_state);

        println!("Started shadow evaluation for policy (batch={}, prefetch={:.2}, routing={:.2})",
            decision.batch_size,
            decision.prefetch_confidence,
            decision.routing_split
        );

        Ok(())
    }

    /// Ingest telemetry during shadow evaluation
    pub fn ingest_shadow_telemetry(&self, shadow: TelemetrySnapshot, baseline: TelemetrySnapshot) {
        let mut state = self.shadow_state.write().unwrap();

        if let Some(ref mut shadow_state) = *state {
            shadow_state.shadow_telemetry.push_back(shadow);
            shadow_state.baseline_telemetry.push_back(baseline);

            // Keep only recent samples
            while shadow_state.shadow_telemetry.len() > 100 {
                shadow_state.shadow_telemetry.pop_front();
                shadow_state.baseline_telemetry.pop_front();
            }
        }
    }

    /// Check if evaluation is complete and get result
    pub fn evaluate(&self) -> Result<EvaluationResult, String> {
        let config = self.config.read().unwrap();
        let mut state = self.shadow_state.write().unwrap();

        let shadow_state = state.as_ref()
            .ok_or_else(|| "No active evaluation".to_string())?;

        // Check if evaluation period is complete
        let elapsed = shadow_state.start_time.elapsed();
        if elapsed < Duration::from_secs(config.evaluation_duration_secs) {
            return Err(format!(
                "Evaluation in progress ({:.1}s / {}s)",
                elapsed.as_secs_f64(),
                config.evaluation_duration_secs
            ));
        }

        // Compute metrics
        let shadow_avg = self.compute_average_telemetry(&shadow_state.shadow_telemetry);
        let baseline_avg = self.compute_average_telemetry(&shadow_state.baseline_telemetry);

        // Compute reward improvement
        let shadow_reward = self.compute_reward(&shadow_avg);
        let baseline_reward = self.compute_reward(&baseline_avg);
        let reward_improvement_percent = if baseline_reward != 0.0 {
            ((shadow_reward - baseline_reward) / baseline_reward.abs()) * 100.0
        } else {
            0.0
        };

        // Compute drift
        let drift_score = self.compute_drift(&shadow_avg, &baseline_avg);

        // Decision logic
        let approved = reward_improvement_percent >= config.min_reward_improvement
            && drift_score <= config.max_drift_tolerance;

        let reason = if approved {
            format!("Approved: +{:.2}% reward, {:.2}% drift",
                reward_improvement_percent, drift_score)
        } else if reward_improvement_percent < config.min_reward_improvement {
            format!("Rejected: insufficient improvement ({:.2}% < {:.2}%)",
                reward_improvement_percent, config.min_reward_improvement)
        } else {
            format!("Rejected: excessive drift ({:.2}% > {:.2}%)",
                drift_score, config.max_drift_tolerance)
        };

        // Generate signature if required
        let signature = if config.require_signature {
            Some(self.generate_signature(&shadow_avg))
        } else {
            None
        };

        let result = EvaluationResult {
            approved,
            reason,
            reward_improvement_percent,
            drift_score,
            evaluation_duration_secs: elapsed.as_secs_f64(),
            shadow_metrics: shadow_avg,
            baseline_metrics: baseline_avg,
            timestamp_ms: Self::current_timestamp_ms(),
            signature,
        };

        // Update metrics
        self.update_metrics(&result);

        // Store in history
        let mut history = self.evaluation_history.write().unwrap();
        history.push_back(result.clone());
        if history.len() > 100 {
            history.pop_front();
        }

        // Clear shadow state
        *state = None;

        Ok(result)
    }

    /// Compute average telemetry from samples
    fn compute_average_telemetry(&self, samples: &VecDeque<TelemetrySnapshot>) -> TelemetrySnapshot {
        if samples.is_empty() {
            return TelemetrySnapshot::default();
        }

        let n = samples.len() as f64;

        TelemetrySnapshot {
            avg_latency_ms: samples.iter().map(|s| s.avg_latency_ms).sum::<f64>() / n,
            p95_latency_ms: samples.iter().map(|s| s.p95_latency_ms).sum::<f64>() / n,
            cache_hit_rate: samples.iter().map(|s| s.cache_hit_rate).sum::<f64>() / n,
            throughput_rps: samples.iter().map(|s| s.throughput_rps).sum::<f64>() / n,
            error_rate: samples.iter().map(|s| s.error_rate).sum::<f64>() / n,
            cpu_utilization: samples.iter().map(|s| s.cpu_utilization).sum::<f64>() / n,
            memory_utilization: samples.iter().map(|s| s.memory_utilization).sum::<f64>() / n,
            cost_efficiency: samples.iter().map(|s| s.cost_efficiency).sum::<f64>() / n,
        }
    }

    /// Compute reward for telemetry
    fn compute_reward(&self, telemetry: &TelemetrySnapshot) -> f64 {
        // R = -(α·latency + β·cost + γ·error)
        let alpha = 0.5;
        let beta = 0.3;
        let gamma = 0.2;

        let latency_norm = telemetry.avg_latency_ms / 150.0;
        let cost_norm = 1.0 - telemetry.cost_efficiency;
        let error_norm = telemetry.error_rate * 100.0;

        -(alpha * latency_norm + beta * cost_norm + gamma * error_norm)
    }

    /// Compute drift percentage between shadow and baseline
    fn compute_drift(&self, shadow: &TelemetrySnapshot, baseline: &TelemetrySnapshot) -> f64 {
        let latency_drift = ((shadow.avg_latency_ms - baseline.avg_latency_ms) / baseline.avg_latency_ms).abs();
        let cache_drift = ((shadow.cache_hit_rate - baseline.cache_hit_rate) / baseline.cache_hit_rate).abs();
        let error_drift = if baseline.error_rate > 0.0 {
            ((shadow.error_rate - baseline.error_rate) / baseline.error_rate).abs()
        } else {
            0.0
        };

        // Maximum drift across metrics
        (latency_drift.max(cache_drift).max(error_drift)) * 100.0
    }

    /// Convert agent decision to policy update
    fn decision_to_policy(
        &self,
        decision: &AgentDecision,
        baseline: &PolicyUpdate,
    ) -> Result<PolicyUpdate, String> {
        let mut new_policy = baseline.clone();

        // Update with agent's suggested parameters
        new_policy.batching.batch_size = decision.batch_size;
        new_policy.routing.traffic_split = decision.routing_split;
        new_policy.confidence = decision.confidence;
        new_policy.timestamp = Self::current_timestamp_ms();

        Ok(new_policy)
    }

    /// Generate HMAC signature for policy
    fn generate_signature(&self, _telemetry: &TelemetrySnapshot) -> String {
        // In production, use actual HMAC-SHA256
        // For now, generate a placeholder
        format!("hmac_{}", Self::current_timestamp_ms())
    }

    /// Update evaluator metrics
    fn update_metrics(&self, result: &EvaluationResult) {
        let mut metrics = self.metrics.write().unwrap();

        metrics.total_evaluations += 1;

        if result.approved {
            metrics.approved_policies += 1;
        } else {
            metrics.rejected_policies += 1;
        }

        let total = metrics.total_evaluations;
        metrics.avg_evaluation_duration_secs =
            (metrics.avg_evaluation_duration_secs * (total - 1) as f64 + result.evaluation_duration_secs) / total as f64;

        metrics.avg_reward_improvement =
            (metrics.avg_reward_improvement * (total - 1) as f64 + result.reward_improvement_percent) / total as f64;
    }

    /// Get evaluator metrics
    pub fn get_metrics(&self) -> EvaluatorMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Get evaluation history
    pub fn get_history(&self) -> Vec<EvaluationResult> {
        self.evaluation_history.read().unwrap().iter().cloned().collect()
    }

    /// Check if evaluation is in progress
    pub fn is_evaluating(&self) -> bool {
        self.shadow_state.read().unwrap().is_some()
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
    use crate::rl::rl_agent::AgentDecision;
    use crate::orchestration::policy_engine::{RoutingPolicy, BatchingPolicy};

    #[test]
    fn test_evaluator_creation() {
        let config = EvaluatorConfig::default();
        let evaluator = PolicyEvaluator::new(config);

        assert!(!evaluator.is_evaluating());
    }

    #[test]
    fn test_start_shadow_evaluation() {
        let config = EvaluatorConfig::default();
        let evaluator = PolicyEvaluator::new(config);

        let decision = AgentDecision {
            batch_size: 64,
            prefetch_confidence: 0.90,
            routing_split: 0.85,
            confidence: 0.92,
            expected_reward_improvement: 0.05,
            timestamp_ms: 0,
            should_apply: true,
            reason: "test".to_string(),
            cognitive_agreed: false,
            decision_source: "rl".to_string(),
            cognitive_confidence: None,
        };

        let baseline = PolicyUpdate {
            timestamp: 0,
            routing: RoutingPolicy::default(),
            batching: BatchingPolicy::default(),
            confidence: 1.0,
            trigger_metrics: TelemetrySnapshot::default(),
            version: 0,
        };

        let result = evaluator.start_shadow_evaluation(&decision, &baseline);
        assert!(result.is_ok());
        assert!(evaluator.is_evaluating());
    }

    #[test]
    fn test_telemetry_ingestion() {
        let config = EvaluatorConfig::default();
        let evaluator = PolicyEvaluator::new(config);

        let decision = AgentDecision {
            batch_size: 32,
            prefetch_confidence: 0.85,
            routing_split: 0.80,
            confidence: 0.90,
            expected_reward_improvement: 0.03,
            timestamp_ms: 0,
            should_apply: true,
            reason: "test".to_string(),
            cognitive_agreed: false,
            decision_source: "rl".to_string(),
            cognitive_confidence: None,
        };

        let baseline = PolicyUpdate::default();
        evaluator.start_shadow_evaluation(&decision, &baseline).unwrap();

        // Ingest telemetry
        for _ in 0..10 {
            evaluator.ingest_shadow_telemetry(
                TelemetrySnapshot::default(),
                TelemetrySnapshot::default(),
            );
        }

        let state = evaluator.shadow_state.read().unwrap();
        let shadow_state = state.as_ref().unwrap();
        assert_eq!(shadow_state.shadow_telemetry.len(), 10);
    }

    #[test]
    fn test_evaluation_incomplete() {
        let config = EvaluatorConfig {
            evaluation_duration_secs: 1000,
            ..Default::default()
        };
        let evaluator = PolicyEvaluator::new(config);

        let decision = AgentDecision {
            batch_size: 32,
            prefetch_confidence: 0.85,
            routing_split: 0.80,
            confidence: 0.90,
            expected_reward_improvement: 0.03,
            timestamp_ms: 0,
            should_apply: true,
            reason: "test".to_string(),
            cognitive_agreed: false,
            decision_source: "rl".to_string(),
            cognitive_confidence: None,
        };

        let baseline = PolicyUpdate::default();
        evaluator.start_shadow_evaluation(&decision, &baseline).unwrap();

        // Try to evaluate immediately (should fail)
        let result = evaluator.evaluate();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("in progress"));
    }

    #[test]
    fn test_reward_computation() {
        let config = EvaluatorConfig::default();
        let evaluator = PolicyEvaluator::new(config);

        let telemetry = TelemetrySnapshot {
            avg_latency_ms: 100.0,
            cache_hit_rate: 0.95,
            error_rate: 0.01,
            cost_efficiency: 0.90,
            ..Default::default()
        };

        let reward = evaluator.compute_reward(&telemetry);
        assert!(reward < 0.0); // Rewards are negative (minimize)
    }

    #[test]
    fn test_drift_computation() {
        let config = EvaluatorConfig::default();
        let evaluator = PolicyEvaluator::new(config);

        let baseline = TelemetrySnapshot {
            avg_latency_ms: 100.0,
            cache_hit_rate: 0.90,
            error_rate: 0.01,
            ..Default::default()
        };

        let shadow = TelemetrySnapshot {
            avg_latency_ms: 110.0, // 10% increase
            cache_hit_rate: 0.90,
            error_rate: 0.01,
            ..Default::default()
        };

        let drift = evaluator.compute_drift(&shadow, &baseline);
        assert!(drift >= 9.0 && drift <= 11.0); // ~10% drift
    }

    #[test]
    fn test_average_telemetry_computation() {
        let config = EvaluatorConfig::default();
        let evaluator = PolicyEvaluator::new(config);

        let mut samples = VecDeque::new();
        samples.push_back(TelemetrySnapshot {
            avg_latency_ms: 100.0,
            ..Default::default()
        });
        samples.push_back(TelemetrySnapshot {
            avg_latency_ms: 120.0,
            ..Default::default()
        });

        let avg = evaluator.compute_average_telemetry(&samples);
        assert_eq!(avg.avg_latency_ms, 110.0);
    }

    #[test]
    fn test_metrics_tracking() {
        let config = EvaluatorConfig::default();
        let evaluator = PolicyEvaluator::new(config);

        let result = EvaluationResult {
            approved: true,
            reason: "test".to_string(),
            reward_improvement_percent: 5.0,
            drift_score: 2.0,
            evaluation_duration_secs: 300.0,
            shadow_metrics: TelemetrySnapshot::default(),
            baseline_metrics: TelemetrySnapshot::default(),
            timestamp_ms: 0,
            signature: None,
        };

        evaluator.update_metrics(&result);

        let metrics = evaluator.get_metrics();
        assert_eq!(metrics.total_evaluations, 1);
        assert_eq!(metrics.approved_policies, 1);
        assert_eq!(metrics.avg_reward_improvement, 5.0);
    }
}
