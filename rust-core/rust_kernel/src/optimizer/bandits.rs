//! Thompson Sampling bandit algorithm implementation
//!
//! Provides multi-armed bandit optimization for provider/model selection.
//! Includes warm start support for faster convergence of new models.

use super::arms::{BanditArm, InformedPrior};
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

    /// Select best arm with regularization for sparse data (improved exploration)
    /// Adds UCB-style exploration bonus for under-explored arms (pulls < 30)
    pub fn select_action_with_regularization(&self) -> String {
        let mut best_score = f64::NEG_INFINITY;
        let mut best_arm_id = String::new();

        for (arm_id, arm) in &self.arms {
            let sample = arm.sample();

            // Add exploration bonus for under-explored arms
            let score = if arm.pulls < 30 {
                // Exploration bonus: 2 * sqrt(ln(total_pulls) / pulls)
                let exploration_bonus = if arm.pulls > 0 {
                    2.0 * ((self.total_pulls as f64).ln() / arm.pulls as f64).sqrt()
                } else {
                    10.0 // Force exploration of completely unvisited arms
                };

                sample + exploration_bonus
            } else {
                sample // No bonus after 30 pulls (sufficient data)
            };

            if score > best_score || best_arm_id.is_empty() {
                best_score = score;
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

    /// Get confidence for a specific action (beta mean)
    /// Used by binary FFI for returning confidence scores
    pub fn get_action_confidence(&self, arm_id: &str) -> f64 {
        self.arms
            .get(arm_id)
            .map(|arm| arm.beta_mean())
            .unwrap_or(0.0)
    }

    /// Update arm with detailed metrics (binary FFI interface)
    pub fn update_with_metrics(&mut self, arm_id: &str, metrics: RewardMetrics) {
        self.update(arm_id, &metrics);
    }

    /// Add a new arm with warm start (informed prior)
    /// Detects similar existing models and initializes with their historical performance
    pub fn add_arm_with_warm_start(&mut self, new_arm_id: String) {
        // Check if arm already exists
        if self.arms.contains_key(&new_arm_id) {
            return;
        }

        // Try to find a similar model for warm start
        if let Some(similar_arm) = self.find_similar_arm(&new_arm_id) {
            // Use warm start from similar model
            let new_arm = BanditArm::new_from_similar(new_arm_id.clone(), similar_arm);
            self.arms.insert(new_arm_id, new_arm);
        } else {
            // Fall back to informed prior from historical average
            let prior = InformedPrior::default();
            let new_arm = BanditArm::new_with_prior(new_arm_id.clone(), &prior);
            self.arms.insert(new_arm_id, new_arm);
        }
    }

    /// Find a similar arm based on provider/model family
    /// E.g., "openai/gpt-4.5" is similar to "openai/gpt-4"
    fn find_similar_arm(&self, new_arm_id: &str) -> Option<&BanditArm> {
        // Extract provider and model family
        let parts: Vec<&str> = new_arm_id.split('/').collect();
        if parts.len() != 2 {
            return None;
        }

        let provider = parts[0];
        let model = parts[1];

        // Try to find exact family match (e.g., gpt-4.5 -> gpt-4)
        let model_family = Self::extract_model_family(model);

        // Look for arms from same provider with similar model family
        let mut candidates: Vec<&BanditArm> = self
            .arms
            .values()
            .filter(|arm| {
                let arm_parts: Vec<&str> = arm.action_id.split('/').collect();
                if arm_parts.len() != 2 {
                    return false;
                }

                let arm_provider = arm_parts[0];
                let arm_model = arm_parts[1];
                let arm_family = Self::extract_model_family(arm_model);

                // Match on provider and model family
                arm_provider == provider && arm_family == model_family
            })
            .collect();

        if !candidates.is_empty() {
            // Return the best-performing similar model
            candidates.sort_by(|a, b| b.mean_reward().partial_cmp(&a.mean_reward()).unwrap());
            return Some(candidates[0]);
        }

        // Fall back to any model from same provider
        self.arms
            .values()
            .filter(|arm| arm.action_id.starts_with(provider))
            .max_by(|a, b| a.mean_reward().partial_cmp(&b.mean_reward()).unwrap())
    }

    /// Extract model family from model name
    /// E.g., "gpt-4.5-turbo" -> "gpt-4"
    ///       "claude-3-5-sonnet" -> "claude-3"
    fn extract_model_family(model: &str) -> String {
        let parts: Vec<&str> = model.split('-').collect();
        if parts.len() >= 2 {
            format!("{}-{}", parts[0], parts[1])
        } else {
            parts[0].to_string()
        }
    }

    /// Check if an arm exists
    pub fn has_arm(&self, arm_id: &str) -> bool {
        self.arms.contains_key(arm_id)
    }

    /// Add a new arm with explicit prior
    pub fn add_arm_with_prior(&mut self, arm_id: String, prior: &InformedPrior) {
        if !self.arms.contains_key(&arm_id) {
            let arm = BanditArm::new_with_prior(arm_id.clone(), prior);
            self.arms.insert(arm_id, arm);
        }
    }

    /// Get statistics about warm start usage
    pub fn get_warm_start_stats(&self) -> WarmStartStats {
        let mut stats = WarmStartStats::default();

        for arm in self.arms.values() {
            // Arms with alpha > 1 and beta > 1 but pulls = 0 were warm started
            if arm.pulls == 0 && (arm.alpha > 1.5 || arm.beta > 1.5) {
                stats.warm_started_count += 1;
                stats.avg_prior_alpha += arm.alpha;
                stats.avg_prior_beta += arm.beta;
            } else if arm.pulls == 0 {
                stats.cold_started_count += 1;
            }
        }

        if stats.warm_started_count > 0 {
            stats.avg_prior_alpha /= stats.warm_started_count as f64;
            stats.avg_prior_beta /= stats.warm_started_count as f64;
        }

        stats
    }
}

/// Statistics about warm start usage
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WarmStartStats {
    pub warm_started_count: usize,
    pub cold_started_count: usize,
    pub avg_prior_alpha: f64,
    pub avg_prior_beta: f64,
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

    #[test]
    fn test_add_arm_with_warm_start_similar() {
        let mut config = ThompsonSamplingConfig::default();
        config.arms = vec!["openai/gpt-4".to_string()];
        let mut optimizer = ThompsonSampling::new(config);

        // Train existing model
        for _ in 0..50 {
            optimizer.update_reward("openai/gpt-4", 0.9);
        }

        // Add new similar model
        optimizer.add_arm_with_warm_start("openai/gpt-4.5-turbo".to_string());

        // New model should exist
        assert!(optimizer.has_arm("openai/gpt-4.5-turbo"));

        // New model should have better prior than (1,1)
        let new_arm = optimizer.get_arm("openai/gpt-4.5-turbo").unwrap();
        assert!(new_arm.alpha > 1.5);
        assert!(new_arm.pulls == 0);
    }

    #[test]
    fn test_add_arm_with_warm_start_no_similar() {
        let mut config = ThompsonSamplingConfig::default();
        config.arms = vec!["openai/gpt-4".to_string()];
        let mut optimizer = ThompsonSampling::new(config);

        // Add model from different provider (no similar)
        optimizer.add_arm_with_warm_start("anthropic/claude-3-opus".to_string());

        // Should use default informed prior
        let new_arm = optimizer.get_arm("anthropic/claude-3-opus").unwrap();
        assert_eq!(new_arm.alpha, 30.0); // Default: 20.0 + 10.0 similarity boost
        assert_eq!(new_arm.beta, 5.0);
    }

    #[test]
    fn test_extract_model_family() {
        assert_eq!(
            ThompsonSampling::extract_model_family("gpt-4.5-turbo"),
            "gpt-4"
        );
        assert_eq!(
            ThompsonSampling::extract_model_family("claude-3-5-sonnet"),
            "claude-3"
        );
        assert_eq!(
            ThompsonSampling::extract_model_family("gpt-4"),
            "gpt-4"
        );
    }

    #[test]
    fn test_warm_start_convergence() {
        let mut config = ThompsonSamplingConfig::default();
        config.arms = vec!["openai/gpt-4".to_string()];

        // Create two optimizers
        let mut warm_start = ThompsonSampling::new(config.clone());
        let mut cold_start = ThompsonSampling::new(config);

        // Train existing model in warm start optimizer
        for _ in 0..100 {
            warm_start.update_reward("openai/gpt-4", 0.85);
        }

        // Add new model with warm start
        warm_start.add_arm_with_warm_start("openai/gpt-4.5".to_string());

        // Add same model with cold start (manual)
        cold_start.arms.insert(
            "openai/gpt-4.5".to_string(),
            BanditArm::new("openai/gpt-4.5".to_string(), 1.0, 1.0),
        );

        // After 10 pulls with same reward
        for _ in 0..10 {
            warm_start.update_reward("openai/gpt-4.5", 0.8);
            cold_start.update_reward("openai/gpt-4.5", 0.8);
        }

        let warm_arm = warm_start.get_arm("openai/gpt-4.5").unwrap();
        let cold_arm = cold_start.get_arm("openai/gpt-4.5").unwrap();

        // Warm start should have narrower confidence interval
        assert!(warm_arm.confidence_width() < cold_arm.confidence_width());
    }

    #[test]
    fn test_get_warm_start_stats() {
        let mut config = ThompsonSamplingConfig::default();
        config.arms = vec!["openai/gpt-4".to_string()];
        let mut optimizer = ThompsonSampling::new(config);

        // Train existing model
        for _ in 0..50 {
            optimizer.update_reward("openai/gpt-4", 0.9);
        }

        // Add models with different start types
        optimizer.add_arm_with_warm_start("openai/gpt-4.5".to_string());
        optimizer.add_arm_with_warm_start("anthropic/claude-3-opus".to_string());

        let stats = optimizer.get_warm_start_stats();

        // Should have 2 warm started (new models)
        assert_eq!(stats.warm_started_count, 2);
        assert_eq!(stats.cold_started_count, 0);
        assert!(stats.avg_prior_alpha > 1.0);
        assert!(stats.avg_prior_beta > 1.0);
    }

    #[test]
    fn test_add_arm_with_prior() {
        let config = ThompsonSamplingConfig::default();
        let mut optimizer = ThompsonSampling::new(config);

        let custom_prior = InformedPrior {
            baseline_alpha: 25.0,
            baseline_beta: 8.0,
            similarity_boost: 5.0,
        };

        optimizer.add_arm_with_prior("custom/model".to_string(), &custom_prior);

        let arm = optimizer.get_arm("custom/model").unwrap();
        assert_eq!(arm.alpha, 30.0); // 25 + 5
        assert_eq!(arm.beta, 8.0);
    }

    #[test]
    fn test_select_with_regularization() {
        let config = ThompsonSamplingConfig::default();
        let mut optimizer = ThompsonSampling::new(config.clone());

        // Heavily train one arm
        for _ in 0..100 {
            optimizer.update_reward(&config.arms[0], 0.9);
        }

        // Add new arm with no data
        optimizer.arms.insert(
            "new/model".to_string(),
            BanditArm::new("new/model".to_string(), 1.0, 1.0),
        );

        // With regularization, should explore the new arm more
        let mut selections = HashMap::new();
        for _ in 0..50 {
            let action = optimizer.select_action_with_regularization();
            *selections.entry(action).or_insert(0) += 1;
        }

        // New model should get some selections due to exploration bonus
        assert!(selections.get("new/model").unwrap_or(&0) > &0);
    }
}
