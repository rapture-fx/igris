//! Bandit Arm definitions and operations
//!
//! Implements Beta distribution-based arms for Thompson Sampling.

use serde::{Deserialize, Serialize};

/// Bandit arm representing a discrete action with Beta distribution parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[repr(C)]
pub struct BanditArm {
    /// Number of successes (rewards > threshold)
    pub alpha: f64,

    /// Number of failures (rewards <= threshold)
    pub beta: f64,

    /// Total pulls
    pub pulls: usize,

    /// Cumulative reward
    pub cumulative_reward: f64,

    /// Action identifier
    pub action_id: String,
}

/// Informed prior for warm start of new models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InformedPrior {
    /// Baseline alpha from historical average
    pub baseline_alpha: f64,

    /// Baseline beta from historical average
    pub baseline_beta: f64,

    /// Similarity boost for related models (e.g., same provider family)
    pub similarity_boost: f64,
}

impl Default for InformedPrior {
    fn default() -> Self {
        Self {
            baseline_alpha: 20.0,  // From historical average (good performer)
            baseline_beta: 5.0,    // From historical average
            similarity_boost: 10.0, // Boost for similar models
        }
    }
}

impl InformedPrior {
    /// Create from existing arm's performance
    pub fn from_arm(arm: &BanditArm, similarity_factor: f64) -> Self {
        Self {
            baseline_alpha: arm.alpha * similarity_factor,
            baseline_beta: arm.beta * similarity_factor,
            similarity_boost: 0.0, // Already applied
        }
    }

    /// Apply similarity boost based on model family match
    pub fn with_similarity_boost(mut self, boost: f64) -> Self {
        self.similarity_boost = boost;
        self
    }
}

impl BanditArm {
    /// Create a new arm with prior parameters
    pub fn new(action_id: String, alpha: f64, beta: f64) -> Self {
        Self {
            alpha,
            beta,
            pulls: 0,
            cumulative_reward: 0.0,
            action_id,
        }
    }

    /// Create a new arm with informed prior (warm start)
    /// Initializes with historical performance instead of uninformative (1,1)
    pub fn new_with_prior(action_id: String, prior: &InformedPrior) -> Self {
        let alpha = prior.baseline_alpha + prior.similarity_boost;
        let beta = prior.baseline_beta;

        Self {
            alpha,
            beta,
            pulls: 0,
            cumulative_reward: 0.0,
            action_id,
        }
    }

    /// Create arm by copying historical performance from similar model
    /// Uses 50% of the similar model's α/β values
    pub fn new_from_similar(action_id: String, similar_arm: &BanditArm) -> Self {
        let similarity_factor = 0.5; // Use 50% of similar model's performance

        Self {
            alpha: (similar_arm.alpha * similarity_factor).max(1.0),
            beta: (similar_arm.beta * similarity_factor).max(1.0),
            pulls: 0,
            cumulative_reward: 0.0,
            action_id,
        }
    }

    /// Sample from Beta distribution using mean approximation
    /// For production with proper sampling, use rand_distr::Beta
    pub fn sample(&self) -> f64 {
        // Use mean of Beta distribution as approximation
        // More sophisticated: implement Beta sampling via Gamma distributions
        let mean = self.alpha / (self.alpha + self.beta);

        // Add small noise for exploration
        let variance = (self.alpha * self.beta)
            / ((self.alpha + self.beta).powi(2) * (self.alpha + self.beta + 1.0));

        // Approximate sampling using mean and variance
        // Clamp to [0, 1]
        (mean + (variance.sqrt() * 0.1 * self.exploration_factor())).clamp(0.0, 1.0)
    }

    /// Calculate exploration factor based on pull count
    fn exploration_factor(&self) -> f64 {
        if self.pulls < 5 {
            2.0
        } else if self.pulls < 20 {
            1.0
        } else {
            0.1
        }
    }

    /// Update arm with new reward observation
    pub fn update(&mut self, reward: f64, success_threshold: f64) {
        self.pulls += 1;
        self.cumulative_reward += reward;

        if reward > success_threshold {
            self.alpha += 1.0;
        } else {
            self.beta += 1.0;
        }
    }

    /// Get estimated mean reward
    pub fn mean_reward(&self) -> f64 {
        if self.pulls == 0 {
            0.0
        } else {
            self.cumulative_reward / self.pulls as f64
        }
    }

    /// Get Beta distribution mean (expected value)
    pub fn beta_mean(&self) -> f64 {
        self.alpha / (self.alpha + self.beta)
    }

    /// Get confidence interval width (approximate 95% CI)
    pub fn confidence_width(&self) -> f64 {
        let n = self.alpha + self.beta;
        // Approximate 95% CI width for Beta distribution
        1.96 * ((self.alpha * self.beta) / (n * n * (n + 1.0))).sqrt()
    }

    /// Get Upper Confidence Bound (UCB1)
    pub fn ucb_score(&self, total_pulls: usize, exploration_constant: f64) -> f64 {
        if self.pulls == 0 {
            return f64::INFINITY; // Force exploration of unvisited arms
        }

        let mean = self.mean_reward();
        let exploration = exploration_constant
            * ((total_pulls as f64).ln() / self.pulls as f64).sqrt();

        mean + exploration
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arm_creation() {
        let arm = BanditArm::new("test".to_string(), 1.0, 1.0);
        assert_eq!(arm.alpha, 1.0);
        assert_eq!(arm.beta, 1.0);
        assert_eq!(arm.pulls, 0);
    }

    #[test]
    fn test_arm_update_success() {
        let mut arm = BanditArm::new("test".to_string(), 1.0, 1.0);
        arm.update(0.8, 0.5);

        assert_eq!(arm.alpha, 2.0);
        assert_eq!(arm.beta, 1.0);
        assert_eq!(arm.pulls, 1);
        assert_eq!(arm.cumulative_reward, 0.8);
    }

    #[test]
    fn test_arm_update_failure() {
        let mut arm = BanditArm::new("test".to_string(), 1.0, 1.0);
        arm.update(0.3, 0.5);

        assert_eq!(arm.alpha, 1.0);
        assert_eq!(arm.beta, 2.0);
        assert_eq!(arm.pulls, 1);
    }

    #[test]
    fn test_beta_mean() {
        let arm = BanditArm::new("test".to_string(), 2.0, 1.0);
        assert!((arm.beta_mean() - 0.666).abs() < 0.01);
    }

    #[test]
    fn test_sample() {
        let arm = BanditArm::new("test".to_string(), 10.0, 5.0);
        let sample = arm.sample();
        assert!(sample >= 0.0 && sample <= 1.0);
    }

    #[test]
    fn test_ucb_score() {
        let mut arm = BanditArm::new("test".to_string(), 1.0, 1.0);
        arm.update(0.8, 0.5);

        let score = arm.ucb_score(100, 1.0);
        assert!(score > 0.0);
    }

    #[test]
    fn test_unvisited_arm_ucb() {
        let arm = BanditArm::new("test".to_string(), 1.0, 1.0);
        let score = arm.ucb_score(100, 1.0);
        assert_eq!(score, f64::INFINITY);
    }

    #[test]
    fn test_informed_prior_default() {
        let prior = InformedPrior::default();
        assert_eq!(prior.baseline_alpha, 20.0);
        assert_eq!(prior.baseline_beta, 5.0);
        assert_eq!(prior.similarity_boost, 10.0);
    }

    #[test]
    fn test_informed_prior_from_arm() {
        let arm = BanditArm::new("existing".to_string(), 40.0, 10.0);
        let prior = InformedPrior::from_arm(&arm, 0.5);

        // Should be 50% of existing arm's values
        assert_eq!(prior.baseline_alpha, 20.0);
        assert_eq!(prior.baseline_beta, 5.0);
        assert_eq!(prior.similarity_boost, 0.0);
    }

    #[test]
    fn test_new_with_prior() {
        let prior = InformedPrior {
            baseline_alpha: 15.0,
            baseline_beta: 3.0,
            similarity_boost: 5.0,
        };

        let arm = BanditArm::new_with_prior("new_model".to_string(), &prior);

        // Alpha should include similarity boost
        assert_eq!(arm.alpha, 20.0); // 15 + 5
        assert_eq!(arm.beta, 3.0);
        assert_eq!(arm.pulls, 0);
        assert_eq!(arm.cumulative_reward, 0.0);

        // Beta mean should be higher than uninformative (1,1) prior
        let uninformed = BanditArm::new("uninformed".to_string(), 1.0, 1.0);
        assert!(arm.beta_mean() > uninformed.beta_mean());
    }

    #[test]
    fn test_new_from_similar() {
        // Existing successful model
        let mut existing = BanditArm::new("gpt-4".to_string(), 1.0, 1.0);
        for _ in 0..100 {
            existing.update(0.9, 0.6); // High success rate
        }

        // New similar model (e.g., gpt-4.5)
        let new_model = BanditArm::new_from_similar("gpt-4.5".to_string(), &existing);

        // Should have 50% of existing model's α/β
        assert!((new_model.alpha - existing.alpha * 0.5).abs() < 1.0);
        assert!((new_model.beta - existing.beta * 0.5).abs() < 1.0);

        // Should start with better prior than uninformative
        let uninformed = BanditArm::new("uninformed".to_string(), 1.0, 1.0);
        assert!(new_model.beta_mean() > uninformed.beta_mean());

        // Should have no pulls yet
        assert_eq!(new_model.pulls, 0);
    }

    #[test]
    fn test_warm_start_convergence() {
        // Warm start should converge faster than cold start

        // Cold start: uninformative prior
        let mut cold_start = BanditArm::new("cold".to_string(), 1.0, 1.0);

        // Warm start: informed prior
        let prior = InformedPrior {
            baseline_alpha: 30.0,
            baseline_beta: 10.0,
            similarity_boost: 0.0,
        };
        let mut warm_start = BanditArm::new_with_prior("warm".to_string(), &prior);

        // After just 10 observations, warm start should be more stable
        for _ in 0..10 {
            cold_start.update(0.8, 0.6);
            warm_start.update(0.8, 0.6);
        }

        // Warm start should have narrower confidence interval (more stable)
        assert!(warm_start.confidence_width() < cold_start.confidence_width());
    }

    #[test]
    fn test_similarity_boost_application() {
        let prior = InformedPrior::default().with_similarity_boost(15.0);

        assert_eq!(prior.similarity_boost, 15.0);

        let arm = BanditArm::new_with_prior("test".to_string(), &prior);
        assert_eq!(arm.alpha, 35.0); // 20 + 15
    }
}
