//! Reward calculation and normalization
//!
//! Provides utilities for computing rewards from inference metrics.

use serde::{Deserialize, Serialize};

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
}
