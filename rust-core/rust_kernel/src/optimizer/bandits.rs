//! Thompson Sampling bandit algorithm implementation
//!
//! Provides multi-armed bandit optimization for provider/model selection.

use super::arms::BanditArm;
use super::rewards::{RewardMetrics, RewardPolicy, calculate_reward};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Configuration for Thompson Sampling optimizer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThompsonSamplingConfig {
    /// Available provider/model arms
    pub arms: Vec<String>,

    /// Success threshold for binary feedback
    pub success_threshold: f64,

    /// Initial alpha for Beta prior
    pub initial_alpha: f64,

    /// Initial beta for Beta prior
    pub initial_beta: f64,

    /// Reward policy
    pub reward_policy: RewardPolicy,
}

impl Default for ThompsonSamplingConfig {
    fn default() -> Self {
        Self {
            arms: vec![
                "openai/gpt-4".to_string(),
                "anthropic/claude-3-5-sonnet".to_string(),
                "anthropic/claude-3-opus".to_string(),
            ],
            success_threshold: 0.6,
            initial_alpha: 1.0,
            initial_beta: 1.0,
            reward_policy: RewardPolicy::default(),
        }
    }
}

/// Thompson Sampling optimizer
pub struct ThompsonSampling {
    arms: HashMap<String, BanditArm>,
    config: ThompsonSamplingConfig,
    total_pulls: usize,
}

impl ThompsonSampling {
    /// Create new Thompson Sampling optimizer
    pub fn new(config: ThompsonSamplingConfig) -> Self {
        let mut arms = HashMap::new();

        for arm_id in &config.arms {
            arms.insert(
                arm_id.clone(),
                BanditArm::new(
                    arm_id.clone(),
                    config.initial_alpha,
                    config.initial_beta,
                ),
            );
        }

        Self {
            arms,
            config,
            total_pulls: 0,
        }
    }

    /// Select best arm using Thompson Sampling
    pub fn select_action(&self) -> String {
        let mut best_sample = f64::NEG_INFINITY;
        let mut best_arm_id = String::new();

        for (arm_id, arm) in &self.arms {
            let sample = arm.sample();

            if sample > best_sample || best_arm_id.is_empty() {
                best_sample = sample;
                best_arm_id = arm_id.clone();
            }
        }

        best_arm_id
    }

    /// Update arm with reward from metrics
    pub fn update(&mut self, arm_id: &str, metrics: &RewardMetrics) {
        let reward = calculate_reward(metrics, &self.config.reward_policy);

        if let Some(arm) = self.arms.get_mut(arm_id) {
            arm.update(reward, self.config.success_threshold);
            self.total_pulls += 1;
        }
    }

    /// Update arm with raw reward value
    pub fn update_reward(&mut self, arm_id: &str, reward: f64) {
        if let Some(arm) = self.arms.get_mut(arm_id) {
            arm.update(reward, self.config.success_threshold);
            self.total_pulls += 1;
        }
    }

    /// Get statistics for all arms
    pub fn get_arm_stats(&self) -> Vec<ArmStats> {
        let mut stats: Vec<_> = self
            .arms
            .values()
            .map(|arm| ArmStats {
                action_id: arm.action_id.clone(),
                alpha: arm.alpha,
                beta: arm.beta,
                pulls: arm.pulls,
                mean_reward: arm.mean_reward(),
                beta_mean: arm.beta_mean(),
                confidence_width: arm.confidence_width(),
            })
            .collect();

        stats.sort_by(|a, b| b.mean_reward.partial_cmp(&a.mean_reward).unwrap());
        stats
    }

    /// Get best arm (highest mean reward with minimum pulls)
    pub fn get_best_arm(&self, min_pulls: usize) -> Option<String> {
        self.arms
            .values()
            .filter(|arm| arm.pulls >= min_pulls)
            .max_by(|a, b| a.mean_reward().partial_cmp(&b.mean_reward()).unwrap())
            .map(|arm| arm.action_id.clone())
    }

    /// Export optimizer state as JSON
    pub fn export_state(&self) -> Result<String, serde_json::Error> {
        let state = OptimizerState {
            arms: self.arms.values().cloned().collect(),
            total_pulls: self.total_pulls,
            config: self.config.clone(),
        };

        serde_json::to_string_pretty(&state)
    }

    /// Import optimizer state from JSON
    pub fn import_state(json: &str) -> Result<Self, serde_json::Error> {
        let state: OptimizerState = serde_json::from_str(json)?;

        let mut arms = HashMap::new();
        for arm in state.arms {
            arms.insert(arm.action_id.clone(), arm);
        }

        Ok(Self {
            arms,
            config: state.config,
            total_pulls: state.total_pulls,
        })
    }

    /// Get total number of pulls across all arms
    pub fn total_pulls(&self) -> usize {
        self.total_pulls
    }

    /// Get arm by ID
    pub fn get_arm(&self, arm_id: &str) -> Option<&BanditArm> {
        self.arms.get(arm_id)
    }
}

/// Arm statistics for reporting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArmStats {
    pub action_id: String,
    pub alpha: f64,
    pub beta: f64,
    pub pulls: usize,
    pub mean_reward: f64,
    pub beta_mean: f64,
    pub confidence_width: f64,
}

/// Serializable optimizer state
#[derive(Debug, Clone, Serialize, Deserialize)]
struct OptimizerState {
    arms: Vec<BanditArm>,
    total_pulls: usize,
    config: ThompsonSamplingConfig,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optimizer_creation() {
        let config = ThompsonSamplingConfig::default();
        let optimizer = ThompsonSampling::new(config.clone());

        assert_eq!(optimizer.arms.len(), config.arms.len());
        assert_eq!(optimizer.total_pulls(), 0);
    }

    #[test]
    fn test_select_action() {
        let config = ThompsonSamplingConfig::default();
        let optimizer = ThompsonSampling::new(config);

        let action = optimizer.select_action();
        assert!(!action.is_empty());
    }

    #[test]
    fn test_update_reward() {
        let config = ThompsonSamplingConfig::default();
        let mut optimizer = ThompsonSampling::new(config.clone());

        let arm_id = &config.arms[0];
        optimizer.update_reward(arm_id, 0.8);

        assert_eq!(optimizer.total_pulls(), 1);

        let arm = optimizer.get_arm(arm_id).unwrap();
        assert_eq!(arm.pulls, 1);
        assert_eq!(arm.cumulative_reward, 0.8);
    }

    #[test]
    fn test_update_with_metrics() {
        let config = ThompsonSamplingConfig::default();
        let mut optimizer = ThompsonSampling::new(config.clone());

        let metrics = RewardMetrics {
            latency_ms: 80.0,
            success: true,
            cache_hit: true,
            cost_usd: 0.001,
            quality_score: Some(0.9),
        };

        let arm_id = &config.arms[0];
        optimizer.update(arm_id, &metrics);

        assert_eq!(optimizer.total_pulls(), 1);
    }

    #[test]
    fn test_get_best_arm() {
        let config = ThompsonSamplingConfig::default();
        let mut optimizer = ThompsonSampling::new(config.clone());

        // Simulate multiple pulls with different rewards
        for _ in 0..10 {
            optimizer.update_reward(&config.arms[0], 0.9); // Good
            optimizer.update_reward(&config.arms[1], 0.3); // Bad
        }

        let best = optimizer.get_best_arm(5);
        assert!(best.is_some());
        assert_eq!(best.unwrap(), config.arms[0]);
    }

    #[test]
    fn test_get_arm_stats() {
        let config = ThompsonSamplingConfig::default();
        let mut optimizer = ThompsonSampling::new(config.clone());

        optimizer.update_reward(&config.arms[0], 0.8);
        optimizer.update_reward(&config.arms[1], 0.6);

        let stats = optimizer.get_arm_stats();
        assert_eq!(stats.len(), config.arms.len());

        // Stats should be sorted by mean reward
        assert!(stats[0].mean_reward >= stats[1].mean_reward);
    }

    #[test]
    fn test_export_import_state() {
        let config = ThompsonSamplingConfig::default();
        let mut optimizer = ThompsonSampling::new(config.clone());

        // Make some updates
        optimizer.update_reward(&config.arms[0], 0.8);
        optimizer.update_reward(&config.arms[1], 0.6);

        // Export state
        let exported = optimizer.export_state().unwrap();

        // Import state
        let imported = ThompsonSampling::import_state(&exported).unwrap();

        assert_eq!(imported.total_pulls(), optimizer.total_pulls());
        assert_eq!(imported.arms.len(), optimizer.arms.len());
    }

    #[test]
    fn test_exploration_exploitation() {
        let config = ThompsonSamplingConfig::default();
        let mut optimizer = ThompsonSampling::new(config.clone());

        // Heavily reward first arm
        for _ in 0..100 {
            optimizer.update_reward(&config.arms[0], 0.95);
        }

        // Should still occasionally explore other arms (via sampling)
        let mut selections = HashMap::new();
        for _ in 0..50 {
            let action = optimizer.select_action();
            *selections.entry(action).or_insert(0) += 1;
        }

        // First arm should be selected most, but not exclusively
        assert!(selections.get(&config.arms[0]).unwrap_or(&0) > &30);
        // Due to Thompson Sampling, might occasionally select others
    }
}
