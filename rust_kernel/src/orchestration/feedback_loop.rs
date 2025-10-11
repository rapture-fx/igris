//! Reinforcement Feedback Loop
//!
//! Implements closed-loop optimization using latency and cost as reward signals.
//! Uses softmax exploration with adaptive learning rate for policy optimization.
//!
//! # Algorithm
//! - Reward Function: R = -(latency + λ * cost)
//! - Exploration: Softmax with temperature decay
//! - Learning: Adaptive step size based on convergence
//!
//! # Example
//! ```no_run
//! use schlep_kernel::orchestration::FeedbackLoop;
//!
//! let loop_engine = FeedbackLoop::new(config);
//! let reward = loop_engine.compute_reward(&metrics);
//! let optimization = loop_engine.optimize_policy(&current_policy, reward);
//! ```

use std::sync::{Arc, RwLock};
use std::collections::VecDeque;
use serde::{Deserialize, Serialize};
use crate::orchestration::policy_engine::{PolicyUpdate, TelemetrySnapshot};

/// Configuration for the reinforcement feedback loop
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackConfig {
    /// Enable feedback loop optimization
    pub enabled: bool,

    /// Cost weight (λ) in reward function
    pub cost_weight: f64,

    /// Initial learning rate (adaptive)
    pub initial_learning_rate: f64,

    /// Exploration temperature (higher = more exploration)
    pub exploration_temperature: f64,

    /// Temperature decay rate per iteration
    pub temperature_decay: f64,

    /// Minimum temperature threshold
    pub min_temperature: f64,

    /// Target convergence threshold
    pub convergence_threshold: f64,

    /// Maximum optimization iterations
    pub max_iterations: usize,

    /// History window size for reward tracking
    pub history_window_size: usize,
}

impl Default for FeedbackConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            cost_weight: 0.3,
            initial_learning_rate: 0.1,
            exploration_temperature: 1.0,
            temperature_decay: 0.95,
            min_temperature: 0.1,
            convergence_threshold: 0.01,
            max_iterations: 10,
            history_window_size: 20,
        }
    }
}

/// Reward signal computed from telemetry metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardSignal {
    /// Overall reward score (higher is better)
    pub reward: f64,

    /// Latency component (normalized)
    pub latency_score: f64,

    /// Cost component (normalized)
    pub cost_score: f64,

    /// Throughput bonus
    pub throughput_bonus: f64,

    /// Reliability penalty (error rate)
    pub reliability_penalty: f64,

    /// Timestamp of reward computation
    pub timestamp_ms: u64,
}

/// Result of policy optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    /// Optimized policy recommendation
    pub recommended_policy: PolicyUpdate,

    /// Expected reward improvement
    pub expected_improvement: f64,

    /// Confidence in the recommendation (0.0-1.0)
    pub confidence: f64,

    /// Number of iterations to converge
    pub iterations: usize,

    /// Exploration vs exploitation ratio
    pub exploration_ratio: f64,
}

/// Reinforcement Feedback Loop Engine
pub struct FeedbackLoop {
    config: Arc<RwLock<FeedbackConfig>>,
    reward_history: Arc<RwLock<VecDeque<RewardSignal>>>,
    current_temperature: Arc<RwLock<f64>>,
    iteration_count: Arc<RwLock<usize>>,
    metrics: Arc<RwLock<FeedbackMetrics>>,
}

/// Internal metrics for the feedback loop
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FeedbackMetrics {
    total_optimizations: u64,
    converged_optimizations: u64,
    avg_iterations_to_converge: f64,
    avg_reward_improvement: f64,
    best_reward: f64,
    worst_reward: f64,
}

impl Default for FeedbackMetrics {
    fn default() -> Self {
        Self {
            total_optimizations: 0,
            converged_optimizations: 0,
            avg_iterations_to_converge: 0.0,
            avg_reward_improvement: 0.0,
            best_reward: f64::NEG_INFINITY,
            worst_reward: f64::INFINITY,
        }
    }
}

impl FeedbackLoop {
    /// Create a new Feedback Loop
    pub fn new(config: FeedbackConfig) -> Self {
        let temperature = config.exploration_temperature;

        Self {
            config: Arc::new(RwLock::new(config)),
            reward_history: Arc::new(RwLock::new(VecDeque::new())),
            current_temperature: Arc::new(RwLock::new(temperature)),
            iteration_count: Arc::new(RwLock::new(0)),
            metrics: Arc::new(RwLock::new(FeedbackMetrics::default())),
        }
    }

    /// Compute reward signal from telemetry metrics
    pub fn compute_reward(&self, telemetry: &TelemetrySnapshot) -> RewardSignal {
        let config = self.config.read().unwrap();

        // Normalize latency score (lower is better, normalize to 0-1)
        // Target: 150ms, anything below gets higher score
        let latency_score = if telemetry.avg_latency_ms <= 150.0 {
            1.0 - (telemetry.avg_latency_ms / 150.0) * 0.5
        } else {
            0.5 / (telemetry.avg_latency_ms / 150.0)
        };

        // Normalize cost score (higher efficiency = better score)
        let cost_score = telemetry.cost_efficiency;

        // Throughput bonus (normalized by target RPS)
        let throughput_bonus = (telemetry.throughput_rps / 1000.0).min(1.0) * 0.2;

        // Reliability penalty (penalize high error rates)
        let reliability_penalty = telemetry.error_rate * 2.0;

        // Compute overall reward: R = -(latency + λ * cost) + bonuses - penalties
        // Invert to make higher better
        let reward = latency_score +
                     (config.cost_weight * cost_score) +
                     throughput_bonus -
                     reliability_penalty;

        let signal = RewardSignal {
            reward,
            latency_score,
            cost_score,
            throughput_bonus,
            reliability_penalty,
            timestamp_ms: Self::current_timestamp_ms(),
        };

        // Update reward history
        let mut history = self.reward_history.write().unwrap();
        history.push_back(signal.clone());

        let window_size = config.history_window_size;
        if history.len() > window_size {
            history.pop_front();
        }

        // Update metrics
        let mut metrics = self.metrics.write().unwrap();
        metrics.best_reward = metrics.best_reward.max(reward);
        metrics.worst_reward = metrics.worst_reward.min(reward);

        signal
    }

    /// Optimize policy using reinforcement learning
    pub fn optimize_policy(
        &self,
        current_policy: &PolicyUpdate,
        current_reward: RewardSignal,
    ) -> Result<OptimizationResult, String> {
        let config = self.config.read().unwrap();

        if !config.enabled {
            return Err("Feedback loop is disabled".to_string());
        }

        let baseline_reward = current_reward.reward;
        let mut best_policy = current_policy.clone();
        let mut best_reward = baseline_reward;
        let mut temperature = *self.current_temperature.read().unwrap();

        let mut iterations = 0;
        let mut converged = false;

        // Gradient descent with softmax exploration
        while iterations < config.max_iterations && !converged {
            // Generate candidate policy using exploration
            let candidate = self.explore_policy_space(
                &best_policy,
                temperature,
                &config,
            )?;

            // Estimate reward for candidate
            let estimated_reward = self.estimate_policy_reward(&candidate);

            // Accept if better or probabilistically explore
            let acceptance_prob = self.softmax_acceptance(
                estimated_reward,
                best_reward,
                temperature,
            );

            if estimated_reward > best_reward || self.should_explore(acceptance_prob) {
                best_policy = candidate;
                best_reward = estimated_reward;
            }

            // Check convergence
            if (best_reward - baseline_reward).abs() < config.convergence_threshold {
                converged = true;
            }

            // Decay temperature
            temperature = (temperature * config.temperature_decay).max(config.min_temperature);
            iterations += 1;
        }

        // Update temperature
        *self.current_temperature.write().unwrap() = temperature;

        // Update iteration counter
        *self.iteration_count.write().unwrap() += iterations;

        // Calculate expected improvement
        let expected_improvement = best_reward - baseline_reward;

        // Calculate confidence based on convergence and improvement
        let confidence = if converged {
            (expected_improvement.abs() * 10.0).min(1.0)
        } else {
            0.5 * (expected_improvement.abs() * 10.0).min(1.0)
        };

        // Update metrics
        let mut metrics = self.metrics.write().unwrap();
        metrics.total_optimizations += 1;
        if converged {
            metrics.converged_optimizations += 1;
        }
        metrics.avg_iterations_to_converge =
            (metrics.avg_iterations_to_converge * (metrics.total_optimizations - 1) as f64 + iterations as f64) /
            metrics.total_optimizations as f64;
        metrics.avg_reward_improvement =
            (metrics.avg_reward_improvement * (metrics.total_optimizations - 1) as f64 + expected_improvement) /
            metrics.total_optimizations as f64;

        Ok(OptimizationResult {
            recommended_policy: best_policy,
            expected_improvement,
            confidence,
            iterations,
            exploration_ratio: temperature / config.exploration_temperature,
        })
    }

    /// Explore policy space with controlled randomization
    fn explore_policy_space(
        &self,
        base_policy: &PolicyUpdate,
        temperature: f64,
        config: &FeedbackConfig,
    ) -> Result<PolicyUpdate, String> {
        let mut explored = base_policy.clone();

        // Explore batch size (±20% with temperature scaling)
        let batch_delta = (explored.batching.batch_size as f64 * 0.2 * temperature * self.random_sign()).round() as i32;
        explored.batching.batch_size = ((explored.batching.batch_size as i32 + batch_delta).max(4).min(128)) as usize;

        // Explore max wait time (±30% with temperature scaling)
        let wait_delta = (explored.batching.max_wait_ms as f64 * 0.3 * temperature * self.random_sign()).round() as i64;
        explored.batching.max_wait_ms = ((explored.batching.max_wait_ms as i64 + wait_delta).max(5).min(100)) as u64;

        // Explore traffic split (±0.1 with temperature scaling)
        let traffic_delta = 0.1 * temperature * self.random_sign();
        explored.routing.traffic_split = (explored.routing.traffic_split + traffic_delta).clamp(0.5, 1.0);

        // Update timestamp and version
        explored.timestamp = Self::current_timestamp_ms();

        Ok(explored)
    }

    /// Estimate reward for a candidate policy
    fn estimate_policy_reward(&self, policy: &PolicyUpdate) -> f64 {
        // Heuristic reward estimation based on policy parameters
        // In production, this would use a learned model

        let batch_score = 1.0 - ((policy.batching.batch_size as f64 - 32.0).abs() / 96.0);
        let wait_score = 1.0 - ((policy.batching.max_wait_ms as f64 - 10.0).abs() / 90.0);
        let traffic_score = policy.routing.traffic_split;

        (batch_score + wait_score + traffic_score) / 3.0
    }

    /// Softmax acceptance probability
    fn softmax_acceptance(&self, new_reward: f64, current_reward: f64, temperature: f64) -> f64 {
        let delta = new_reward - current_reward;
        (delta / temperature).exp() / (1.0 + (delta / temperature).exp())
    }

    /// Decide whether to explore based on probability
    fn should_explore(&self, probability: f64) -> bool {
        // Simplified random decision
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        Self::current_timestamp_ms().hash(&mut hasher);
        let random = (hasher.finish() % 10000) as f64 / 10000.0;

        random < probability
    }

    /// Random sign for exploration
    fn random_sign(&self) -> f64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        (Self::current_timestamp_ms() + *self.iteration_count.read().unwrap() as u64).hash(&mut hasher);

        if hasher.finish() % 2 == 0 { 1.0 } else { -1.0 }
    }

    /// Get average reward from history
    pub fn get_average_reward(&self) -> f64 {
        let history = self.reward_history.read().unwrap();
        if history.is_empty() {
            return 0.0;
        }

        let sum: f64 = history.iter().map(|r| r.reward).sum();
        sum / history.len() as f64
    }

    /// Get reward trend (positive = improving)
    pub fn get_reward_trend(&self) -> f64 {
        let history = self.reward_history.read().unwrap();
        if history.len() < 2 {
            return 0.0;
        }

        let recent_avg: f64 = history.iter().rev().take(5).map(|r| r.reward).sum::<f64>() / 5.0;
        let historical_avg: f64 = history.iter().take(5).map(|r| r.reward).sum::<f64>() / 5.0;

        recent_avg - historical_avg
    }

    /// Get current feedback metrics
    pub fn get_metrics(&self) -> FeedbackMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Reset the feedback loop state
    pub fn reset(&self) {
        let config = self.config.read().unwrap();
        *self.current_temperature.write().unwrap() = config.exploration_temperature;
        *self.iteration_count.write().unwrap() = 0;
        self.reward_history.write().unwrap().clear();
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
    use crate::orchestration::policy_engine::{RoutingPolicy, BatchingPolicy};

    #[test]
    fn test_feedback_loop_creation() {
        let config = FeedbackConfig::default();
        let feedback = FeedbackLoop::new(config);

        let avg_reward = feedback.get_average_reward();
        assert_eq!(avg_reward, 0.0);
    }

    #[test]
    fn test_reward_computation() {
        let config = FeedbackConfig::default();
        let feedback = FeedbackLoop::new(config);

        let telemetry = TelemetrySnapshot {
            avg_latency_ms: 100.0,
            p95_latency_ms: 150.0,
            cache_hit_rate: 0.97,
            throughput_rps: 500.0,
            error_rate: 0.01,
            cpu_utilization: 0.5,
            memory_utilization: 0.5,
            cost_efficiency: 0.9,
        };

        let reward = feedback.compute_reward(&telemetry);

        // Good metrics should produce positive reward
        assert!(reward.reward > 0.0);
        assert!(reward.latency_score > 0.5);
        assert!(reward.cost_score > 0.5);
    }

    #[test]
    fn test_reward_history_window() {
        let config = FeedbackConfig {
            history_window_size: 5,
            ..Default::default()
        };
        let feedback = FeedbackLoop::new(config);

        // Add more rewards than window size
        for i in 0..10 {
            let telemetry = TelemetrySnapshot {
                avg_latency_ms: 100.0 + i as f64,
                ..Default::default()
            };
            feedback.compute_reward(&telemetry);
        }

        let history = feedback.reward_history.read().unwrap();
        assert_eq!(history.len(), 5);
    }

    #[test]
    fn test_policy_optimization() {
        let config = FeedbackConfig::default();
        let feedback = FeedbackLoop::new(config);

        let base_policy = PolicyUpdate {
            timestamp: 0,
            routing: RoutingPolicy::default(),
            batching: BatchingPolicy::default(),
            confidence: 1.0,
            trigger_metrics: TelemetrySnapshot::default(),
            version: 0,
        };

        let telemetry = TelemetrySnapshot::default();
        let reward = feedback.compute_reward(&telemetry);

        let result = feedback.optimize_policy(&base_policy, reward).unwrap();

        assert!(result.iterations > 0);
        assert!(result.iterations <= 10);
        assert!(result.confidence >= 0.0 && result.confidence <= 1.0);
    }

    #[test]
    fn test_reward_trend() {
        let config = FeedbackConfig::default();
        let feedback = FeedbackLoop::new(config);

        // Add improving rewards
        for i in 0..10 {
            let telemetry = TelemetrySnapshot {
                avg_latency_ms: 150.0 - (i as f64 * 5.0), // Improving latency
                cost_efficiency: 0.7 + (i as f64 * 0.02), // Improving cost
                ..Default::default()
            };
            feedback.compute_reward(&telemetry);
        }

        let trend = feedback.get_reward_trend();
        assert!(trend > 0.0); // Should show positive trend
    }

    #[test]
    fn test_temperature_decay() {
        let config = FeedbackConfig {
            exploration_temperature: 1.0,
            temperature_decay: 0.9,
            min_temperature: 0.1,
            ..Default::default()
        };
        let feedback = FeedbackLoop::new(config);

        let base_policy = PolicyUpdate {
            timestamp: 0,
            routing: RoutingPolicy::default(),
            batching: BatchingPolicy::default(),
            confidence: 1.0,
            trigger_metrics: TelemetrySnapshot::default(),
            version: 0,
        };

        let reward = feedback.compute_reward(&TelemetrySnapshot::default());

        // Run multiple optimizations
        for _ in 0..5 {
            feedback.optimize_policy(&base_policy, reward.clone()).ok();
        }

        let final_temp = *feedback.current_temperature.read().unwrap();
        assert!(final_temp < 1.0);
        assert!(final_temp >= 0.1);
    }

    #[test]
    fn test_metrics_tracking() {
        let config = FeedbackConfig::default();
        let feedback = FeedbackLoop::new(config);

        let base_policy = PolicyUpdate {
            timestamp: 0,
            routing: RoutingPolicy::default(),
            batching: BatchingPolicy::default(),
            confidence: 1.0,
            trigger_metrics: TelemetrySnapshot::default(),
            version: 0,
        };

        let reward = feedback.compute_reward(&TelemetrySnapshot::default());
        feedback.optimize_policy(&base_policy, reward).ok();

        let metrics = feedback.get_metrics();
        assert_eq!(metrics.total_optimizations, 1);
        assert!(metrics.avg_iterations_to_converge > 0.0);
    }
}
