//! Bandit Arm definitions and operations
//!
//! Implements Beta distribution-based arms for Thompson Sampling.

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

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
}
