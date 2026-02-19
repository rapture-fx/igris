//! Reward calculation and normalization
//!
//! Provides utilities for computing rewards from inference metrics.
//! Includes adaptive reward weighting for per-tenant optimization.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Metrics collected from an inference request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardMetrics {
    /// Latency in milliseconds
    pub latency_ms: f64,

    /// Whether the request succeeded
    pub success: bool,

    /// Whether cache was hit
    pub cache_hit: bool,

    /// Cost in USD
    pub cost_usd: f64,

    /// Optional: model quality score [0.0, 1.0]
    pub quality_score: Option<f64>,
}

impl RewardMetrics {
    /// Create new metrics from basic components
    pub fn new(
        latency_ms: f64,
        success: bool,
        cache_hit: bool,
        cost_usd: f64,
    ) -> Self {
        Self {
            latency_ms,
            success,
            cache_hit,
            cost_usd,
            quality_score: None,
        }
    }

    /// Create with quality score
    pub fn with_quality(mut self, quality: f64) -> Self {
        self.quality_score = Some(quality.clamp(0.0, 1.0));
        self
    }
}

/// Reward policy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardPolicy {
    /// Weight for latency component [0.0, 1.0]
    pub latency_weight: f64,

    /// Weight for success component [0.0, 1.0]
    pub success_weight: f64,

    /// Weight for cache hit component [0.0, 1.0]
    pub cache_weight: f64,

    /// Weight for cost component [0.0, 1.0]
    pub cost_weight: f64,

    /// Weight for quality component [0.0, 1.0]
    pub quality_weight: f64,

    /// Target latency in ms (for normalization)
    pub target_latency_ms: f64,

    /// Maximum acceptable latency in ms
    pub max_latency_ms: f64,

    /// Target cost in USD
    pub target_cost_usd: f64,

    /// Maximum acceptable cost in USD
    pub max_cost_usd: f64,
}

impl Default for RewardPolicy {
    fn default() -> Self {
        Self {
            latency_weight: 0.4,
            success_weight: 0.3,
            cache_weight: 0.1,
            cost_weight: 0.15,
            quality_weight: 0.05,
            target_latency_ms: 100.0,
            max_latency_ms: 2000.0,
            target_cost_usd: 0.001,
            max_cost_usd: 0.01,
        }
    }
}

impl RewardPolicy {
    /// Extract weights as a vector for easier manipulation
    pub fn to_weight_vector(&self) -> Vec<f64> {
        vec![
            self.latency_weight,
            self.success_weight,
            self.cache_weight,
            self.cost_weight,
            self.quality_weight,
        ]
    }

    /// Create from weight vector (must sum to ~1.0)
    pub fn from_weight_vector(weights: Vec<f64>) -> Self {
        let mut policy = Self::default();
        if weights.len() >= 5 {
            policy.latency_weight = weights[0];
            policy.success_weight = weights[1];
            policy.cache_weight = weights[2];
            policy.cost_weight = weights[3];
            policy.quality_weight = weights[4];
        }
        policy
    }

    /// Normalize weights to sum to 1.0
    pub fn normalize(&mut self) {
        let sum = self.latency_weight
            + self.success_weight
            + self.cache_weight
            + self.cost_weight
            + self.quality_weight;

        if sum > 0.0 {
            self.latency_weight /= sum;
            self.success_weight /= sum;
            self.cache_weight /= sum;
            self.cost_weight /= sum;
            self.quality_weight /= sum;
        }
    }
}

/// Adaptive reward policy with learned weights
/// Supports per-tenant and per-semantic-class weight optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptiveRewardPolicy {
    /// Default/base weights (fallback)
    pub base_weights: RewardPolicy,

    /// Learned weights per key (tenant_id or tenant_id:semantic_class)
    pub learned_weights: HashMap<String, RewardPolicy>,

    /// Learning rate for weight adaptation (α for gradient descent)
    pub weight_learning_rate: f64,

    /// How many requests between weight updates
    pub update_frequency: usize,

    /// Track number of updates per key
    update_counts: HashMap<String, usize>,

    /// Sample counts for confidence tracking
    sample_counts: HashMap<String, usize>,
}

impl Default for AdaptiveRewardPolicy {
    fn default() -> Self {
        Self {
            base_weights: RewardPolicy::default(),
            learned_weights: HashMap::new(),
            weight_learning_rate: 0.05, // 5% learning rate
            update_frequency: 500,      // Update every 500 requests
            update_counts: HashMap::new(),
            sample_counts: HashMap::new(),
        }
    }
}

impl AdaptiveRewardPolicy {
    /// Create with custom learning rate
    pub fn with_learning_rate(learning_rate: f64) -> Self {
        Self {
            weight_learning_rate: learning_rate.clamp(0.01, 0.5),
            ..Default::default()
        }
    }

    /// Get weights for a specific key (tenant or tenant:semantic_class)
    pub fn get_weights(&self, key: &str) -> &RewardPolicy {
        self.learned_weights.get(key).unwrap_or(&self.base_weights)
    }

    /// Get mutable weights for a specific key, creating if needed
    fn get_weights_mut(&mut self, key: &str) -> &mut RewardPolicy {
        self.learned_weights
            .entry(key.to_string())
            .or_insert_with(|| self.base_weights.clone())
    }

    /// Increment sample count for a key
    pub fn increment_sample(&mut self, key: &str) {
        *self.sample_counts.entry(key.to_string()).or_insert(0) += 1;
    }

    /// Get sample count for confidence estimation
    pub fn get_sample_count(&self, key: &str) -> usize {
        *self.sample_counts.get(key).unwrap_or(&0)
    }

    /// Check if it's time to update weights for this key
    pub fn should_update(&self, key: &str) -> bool {
        let count = self.sample_counts.get(key).unwrap_or(&0);
        count % self.update_frequency == 0 && *count > 0
    }

    /// Adapt weights using gradient descent based on correlation with outcomes
    ///
    /// Algorithm:
    /// 1. Calculate correlation between each reward component and final success
    /// 2. Adjust weights: w_new = w_old + α * (corr - w_old)
    /// 3. Normalize to ensure weights sum to 1.0
    ///
    /// # Arguments
    /// * `key` - Tenant ID or tenant:semantic_class key
    /// * `component_scores` - Individual scores [latency, success, cache, cost, quality]
    /// * `final_outcome` - Actual success metric (0.0 = failure, 1.0 = success)
    pub fn adapt_weights(
        &mut self,
        key: &str,
        component_scores: Vec<f64>,
        final_outcome: f64,
    ) {
        if component_scores.len() != 5 {
            return; // Invalid input
        }

        let lr = self.weight_learning_rate;
        let weights = self.get_weights_mut(key);
        let current_weights = weights.to_weight_vector();

        // Simple correlation: how much does each component align with outcome?
        // In production, this would use a rolling window of historical data
        let mut new_weights = Vec::new();

        for (i, &score) in component_scores.iter().enumerate() {
            // Correlation approximation: if outcome is good and score is high, increase weight
            let correlation = score * final_outcome;

            // Gradient descent update: w_new = w_old + α * (corr - w_old)
            let updated_weight = current_weights[i]
                + lr * (correlation - current_weights[i]);

            new_weights.push(updated_weight.clamp(0.0, 1.0));
        }

        // Update weights from vector
        *weights = RewardPolicy::from_weight_vector(new_weights);

        // Normalize to sum to 1.0
        weights.normalize();

        // Track update count
        *self.update_counts.entry(key.to_string()).or_insert(0) += 1;
    }

    /// Batch adapt weights from multiple observations
    /// More robust than single-sample adaptation
    pub fn adapt_weights_batch(
        &mut self,
        key: &str,
        observations: &[(Vec<f64>, f64)], // (component_scores, outcome) pairs
    ) {
        if observations.is_empty() {
            return;
        }

        let lr = self.weight_learning_rate;
        let weights = self.get_weights_mut(key);
        let mut current_weights = weights.to_weight_vector();

        // Calculate average correlation across all observations
        let mut correlations = vec![0.0; 5];

        for (component_scores, outcome) in observations {
            for (i, &score) in component_scores.iter().enumerate() {
                correlations[i] += score * outcome;
            }
        }

        // Average correlations
        let n = observations.len() as f64;
        for corr in &mut correlations {
            *corr /= n;
        }

        // Update weights using averaged correlations
        for (i, &corr) in correlations.iter().enumerate() {
            current_weights[i] +=
                lr * (corr - current_weights[i]);
            current_weights[i] = current_weights[i].clamp(0.0, 1.0);
        }

        // Update and normalize
        *weights = RewardPolicy::from_weight_vector(current_weights);
        weights.normalize();

        *self.update_counts.entry(key.to_string()).or_insert(0) += 1;
    }

    /// Calculate confidence score for learned weights
    /// Based on sample size (sigmoid function)
    pub fn calculate_confidence(&self, key: &str) -> f64 {
        let sample_count = self.get_sample_count(key) as f64;

        // Sigmoid function: confidence = 1 / (1 + e^(-(n - 500)/100))
        // Reaches ~0.5 at 500 samples, ~0.95 at 1000 samples
        let z = (sample_count - 500.0) / 100.0;
        1.0 / (1.0 + (-z).exp())
    }

    /// Get number of weight updates performed for a key
    pub fn get_update_count(&self, key: &str) -> usize {
        *self.update_counts.get(key).unwrap_or(&0)
    }

    /// Reset learned weights for a key (useful for drift detection)
    pub fn reset_weights(&mut self, key: &str) {
        self.learned_weights.remove(key);
        self.update_counts.remove(key);
        self.sample_counts.remove(key);
    }
}

/// Calculate individual component scores for adaptive learning
/// Returns: [latency_score, success_score, cache_score, cost_score, quality_score]
pub fn calculate_component_scores(
    metrics: &RewardMetrics,
    policy: &RewardPolicy,
) -> Vec<f64> {
    let mut scores = Vec::new();

    // Latency score
    let latency_score = if metrics.latency_ms <= policy.target_latency_ms {
        1.0
    } else if metrics.latency_ms >= policy.max_latency_ms {
        0.0
    } else {
        1.0 - (metrics.latency_ms - policy.target_latency_ms)
            / (policy.max_latency_ms - policy.target_latency_ms)
    };
    scores.push(latency_score);

    // Success score (binary)
    scores.push(if metrics.success { 1.0 } else { 0.0 });

    // Cache score (binary)
    scores.push(if metrics.cache_hit { 1.0 } else { 0.0 });

    // Cost score
    let cost_score = if metrics.cost_usd <= policy.target_cost_usd {
        1.0
    } else if metrics.cost_usd >= policy.max_cost_usd {
        0.0
    } else {
        1.0 - (metrics.cost_usd - policy.target_cost_usd)
            / (policy.max_cost_usd - policy.target_cost_usd)
    };
    scores.push(cost_score);

    // Quality score
    scores.push(metrics.quality_score.unwrap_or(0.5));

    scores
}

/// Calculate reward from metrics using policy
pub fn calculate_reward(metrics: &RewardMetrics, policy: &RewardPolicy) -> f64 {
    let mut reward = 0.0;

    // Latency component: inverse normalized latency
    // Better latency -> higher reward
    let latency_score = if metrics.latency_ms <= policy.target_latency_ms {
        1.0
    } else if metrics.latency_ms >= policy.max_latency_ms {
        0.0
    } else {
        1.0 - (metrics.latency_ms - policy.target_latency_ms)
            / (policy.max_latency_ms - policy.target_latency_ms)
    };
    reward += latency_score * policy.latency_weight;

    // Success component: binary
    if metrics.success {
        reward += policy.success_weight;
    }

    // Cache hit component: binary
    if metrics.cache_hit {
        reward += policy.cache_weight;
    }

    // Cost component: inverse normalized cost
    // Lower cost -> higher reward
    let cost_score = if metrics.cost_usd <= policy.target_cost_usd {
        1.0
    } else if metrics.cost_usd >= policy.max_cost_usd {
        0.0
    } else {
        1.0 - (metrics.cost_usd - policy.target_cost_usd)
            / (policy.max_cost_usd - policy.target_cost_usd)
    };
    reward += cost_score * policy.cost_weight;

    // Quality component: optional direct score
    if let Some(quality) = metrics.quality_score {
        reward += quality * policy.quality_weight;
    }

    // Clamp final reward to [0.0, 1.0]
    reward.clamp(0.0, 1.0)
}

/// Simpler reward calculation with default policy
pub fn calculate_reward_simple(
    latency_ms: f64,
    success: bool,
    cache_hit: bool,
) -> f64 {
    let metrics = RewardMetrics {
        latency_ms,
        success,
        cache_hit,
        cost_usd: 0.0,
        quality_score: None,
    };

    let policy = RewardPolicy {
        latency_weight: 0.5,
        success_weight: 0.3,
        cache_weight: 0.2,
        cost_weight: 0.0,
        quality_weight: 0.0,
        target_latency_ms: 100.0,
        max_latency_ms: 2000.0,
        target_cost_usd: 0.001,
        max_cost_usd: 0.01,
    };

    calculate_reward(&metrics, &policy)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perfect_reward() {
        let metrics = RewardMetrics {
            latency_ms: 50.0, // Better than target
            success: true,
            cache_hit: true,
            cost_usd: 0.0005, // Better than target
            quality_score: Some(1.0),
        };

        let policy = RewardPolicy::default();
        let reward = calculate_reward(&metrics, &policy);

        // Should be close to 1.0 (sum of all weights)
        assert!(reward > 0.95);
        assert!(reward <= 1.0);
    }

    #[test]
    fn test_worst_reward() {
        let metrics = RewardMetrics {
            latency_ms: 3000.0, // Worse than max
            success: false,
            cache_hit: false,
            cost_usd: 0.02, // Worse than max
            quality_score: Some(0.0),
        };

        let policy = RewardPolicy::default();
        let reward = calculate_reward(&metrics, &policy);

        // Should be close to 0.0
        assert!(reward < 0.1);
        assert!(reward >= 0.0);
    }

    #[test]
    fn test_mixed_reward() {
        let metrics = RewardMetrics {
            latency_ms: 500.0, // Mid-range
            success: true,
            cache_hit: false,
            cost_usd: 0.005, // Mid-range
            quality_score: None,
        };

        let policy = RewardPolicy::default();
        let reward = calculate_reward(&metrics, &policy);

        // Should be moderate
        assert!(reward > 0.3 && reward < 0.7);
    }

    #[test]
    fn test_simple_reward() {
        let reward = calculate_reward_simple(80.0, true, true);
        assert!(reward > 0.8); // Fast, successful, cached

        let reward2 = calculate_reward_simple(1500.0, false, false);
        assert!(reward2 < 0.3); // Slow, failed, no cache
    }

    #[test]
    fn test_reward_clamping() {
        let metrics = RewardMetrics {
            latency_ms: 50.0,
            success: true,
            cache_hit: true,
            cost_usd: 0.0001,
            quality_score: Some(1.0),
        };

        let policy = RewardPolicy::default();
        let reward = calculate_reward(&metrics, &policy);

        // Should not exceed 1.0
        assert!(reward <= 1.0);
        assert!(reward >= 0.0);
    }

    #[test]
    fn test_target_latency() {
        let policy = RewardPolicy::default();

        // At target latency
        let m1 = RewardMetrics::new(100.0, true, false, 0.001);
        let r1 = calculate_reward(&m1, &policy);

        // Better than target
        let m2 = RewardMetrics::new(50.0, true, false, 0.001);
        let r2 = calculate_reward(&m2, &policy);

        // Should get same latency score (both meet target)
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_adaptive_policy_creation() {
        let policy = AdaptiveRewardPolicy::default();
        assert_eq!(policy.weight_learning_rate, 0.05);
        assert_eq!(policy.update_frequency, 500);
        assert_eq!(policy.learned_weights.len(), 0);
    }

    #[test]
    fn test_adaptive_policy_with_learning_rate() {
        let policy = AdaptiveRewardPolicy::with_learning_rate(0.1);
        assert_eq!(policy.weight_learning_rate, 0.1);

        // Test clamping
        let policy2 = AdaptiveRewardPolicy::with_learning_rate(0.8);
        assert_eq!(policy2.weight_learning_rate, 0.5); // Clamped to max
    }

    #[test]
    fn test_get_weights_fallback() {
        let policy = AdaptiveRewardPolicy::default();

        // Should return base weights for unknown key
        let weights = policy.get_weights("tenant_123");
        assert_eq!(weights.latency_weight, 0.4);
        assert_eq!(weights.success_weight, 0.3);
    }

    #[test]
    fn test_increment_sample() {
        let mut policy = AdaptiveRewardPolicy::default();

        policy.increment_sample("tenant_1");
        assert_eq!(policy.get_sample_count("tenant_1"), 1);

        policy.increment_sample("tenant_1");
        assert_eq!(policy.get_sample_count("tenant_1"), 2);

        assert_eq!(policy.get_sample_count("tenant_2"), 0);
    }

    #[test]
    fn test_should_update() {
        let mut policy = AdaptiveRewardPolicy::default();

        // Not yet time to update
        for _ in 0..499 {
            policy.increment_sample("tenant_1");
        }
        assert!(!policy.should_update("tenant_1"));

        // Now it's time
        policy.increment_sample("tenant_1");
        assert!(policy.should_update("tenant_1"));

        // Next update at 1000
        policy.increment_sample("tenant_1");
        assert!(!policy.should_update("tenant_1"));
    }

    #[test]
    fn test_adapt_weights_single() {
        let mut policy = AdaptiveRewardPolicy::default();

        // Simulate a scenario where latency matters most
        let component_scores = vec![1.0, 0.5, 0.0, 0.5, 0.5]; // High latency score
        let outcome = 1.0; // Success

        policy.adapt_weights("tenant_1", component_scores, outcome);

        let learned = policy.get_weights("tenant_1");

        // Latency weight should increase (it was strongly correlated with success)
        assert!(learned.latency_weight > 0.4);

        // Weights should sum to ~1.0
        let sum = learned.latency_weight
            + learned.success_weight
            + learned.cache_weight
            + learned.cost_weight
            + learned.quality_weight;
        assert!((sum - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_adapt_weights_batch() {
        let mut policy = AdaptiveRewardPolicy::default();

        // Multiple observations where success correlates with low cost
        let observations = vec![
            (vec![0.5, 1.0, 0.0, 1.0, 0.5], 1.0), // Success with good cost
            (vec![0.5, 1.0, 0.0, 1.0, 0.5], 1.0), // Success with good cost
            (vec![0.5, 1.0, 0.0, 0.0, 0.5], 0.0), // Failure with bad cost
            (vec![0.5, 1.0, 0.0, 0.0, 0.5], 0.0), // Failure with bad cost
        ];

        policy.adapt_weights_batch("tenant_1", &observations);

        let learned = policy.get_weights("tenant_1");

        // Cost weight should increase (strong correlation)
        assert!(learned.cost_weight > 0.15);
    }

    #[test]
    fn test_calculate_confidence() {
        let mut policy = AdaptiveRewardPolicy::default();

        // Low samples = low confidence
        for _ in 0..100 {
            policy.increment_sample("tenant_1");
        }
        let conf1 = policy.calculate_confidence("tenant_1");
        assert!(conf1 < 0.5);

        // Medium samples = medium confidence
        for _ in 100..500 {
            policy.increment_sample("tenant_1");
        }
        let conf2 = policy.calculate_confidence("tenant_1");
        assert!(conf2 > 0.4 && conf2 < 0.6);

        // High samples = high confidence
        for _ in 500..1000 {
            policy.increment_sample("tenant_1");
        }
        let conf3 = policy.calculate_confidence("tenant_1");
        assert!(conf3 > 0.9);
    }

    #[test]
    fn test_reset_weights() {
        let mut policy = AdaptiveRewardPolicy::default();

        // Learn some weights
        policy.increment_sample("tenant_1");
        policy.adapt_weights("tenant_1", vec![1.0, 0.5, 0.0, 0.5, 0.5], 1.0);

        assert_eq!(policy.get_sample_count("tenant_1"), 1);
        assert!(policy.learned_weights.contains_key("tenant_1"));

        // Reset
        policy.reset_weights("tenant_1");

        assert_eq!(policy.get_sample_count("tenant_1"), 0);
        assert!(!policy.learned_weights.contains_key("tenant_1"));
    }

    #[test]
    fn test_component_scores() {
        let metrics = RewardMetrics {
            latency_ms: 150.0,  // Mid-range
            success: true,
            cache_hit: false,
            cost_usd: 0.005,    // Mid-range
            quality_score: Some(0.8),
        };

        let policy = RewardPolicy::default();
        let scores = calculate_component_scores(&metrics, &policy);

        assert_eq!(scores.len(), 5);
        assert!(scores[0] > 0.0 && scores[0] < 1.0); // Latency score mid-range
        assert_eq!(scores[1], 1.0);                   // Success
        assert_eq!(scores[2], 0.0);                   // No cache
        assert!(scores[3] > 0.0 && scores[3] < 1.0); // Cost score mid-range
        assert_eq!(scores[4], 0.8);                   // Quality
    }

    #[test]
    fn test_weight_normalization() {
        let mut policy = RewardPolicy {
            latency_weight: 0.5,
            success_weight: 0.5,
            cache_weight: 0.5,
            cost_weight: 0.5,
            quality_weight: 0.5,
            ..Default::default()
        };

        policy.normalize();

        let sum = policy.latency_weight
            + policy.success_weight
            + policy.cache_weight
            + policy.cost_weight
            + policy.quality_weight;

        assert!((sum - 1.0).abs() < 0.001);

        // Each should be 0.2 after normalization
        assert!((policy.latency_weight - 0.2).abs() < 0.001);
    }

    #[test]
    fn test_weight_vector_conversion() {
        let policy = RewardPolicy::default();
        let vec = policy.to_weight_vector();

        assert_eq!(vec.len(), 5);
        assert_eq!(vec[0], 0.4);  // latency
        assert_eq!(vec[1], 0.3);  // success
        assert_eq!(vec[2], 0.1);  // cache
        assert_eq!(vec[3], 0.15); // cost
        assert_eq!(vec[4], 0.05); // quality

        // Convert back
        let policy2 = RewardPolicy::from_weight_vector(vec);
        assert_eq!(policy2.latency_weight, policy.latency_weight);
        assert_eq!(policy2.success_weight, policy.success_weight);
    }
}
