//! Thompson Sampling for Contextual Bandits
//!
//! Implements safe, exploration-exploitation balanced action selection
//! using Beta distributions for each arm (action).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Bandit arm representing a discrete action
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub fn new(action_id: String) -> Self {
        Self {
            alpha: 1.0, // Prior
            beta: 1.0,  // Prior
            pulls: 0,
            cumulative_reward: 0.0,
            action_id,
        }
    }

    /// Sample from Beta distribution (simplified using mean approximation)
    pub fn sample(&self) -> f64 {
        // Simplified sampling: use mean of Beta distribution
        // In production, use proper Beta sampler from rand_distr
        self.alpha / (self.alpha + self.beta)
    }

    /// Update arm with new reward
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

    /// Get confidence interval width
    pub fn confidence_width(&self) -> f64 {
        let n = self.alpha + self.beta;
        // Approximate 95% CI width for Beta distribution
        1.96 * ((self.alpha * self.beta) / (n * n * (n + 1.0))).sqrt()
    }
}

/// Action space for Thompson Sampling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionSpace {
    /// Discrete batch sizes
    pub batch_sizes: Vec<usize>,

    /// Prefetch confidence levels
    pub prefetch_confidences: Vec<f64>,

    /// Routing split percentages
    pub routing_splits: Vec<f64>,
}

impl Default for ActionSpace {
    fn default() -> Self {
        Self {
            batch_sizes: vec![8, 16, 32, 64],
            prefetch_confidences: vec![0.70, 0.80, 0.90, 0.95],
            routing_splits: vec![0.70, 0.80, 0.90, 1.00],
        }
    }
}

impl ActionSpace {
    /// Generate all possible actions
    pub fn all_actions(&self) -> Vec<(usize, usize, usize)> {
        let mut actions = Vec::new();

        for (batch_idx, _) in self.batch_sizes.iter().enumerate() {
            for (pf_idx, _) in self.prefetch_confidences.iter().enumerate() {
                for (rs_idx, _) in self.routing_splits.iter().enumerate() {
                    actions.push((batch_idx, pf_idx, rs_idx));
                }
            }
        }

        actions
    }

    /// Convert action indices to string ID
    pub fn action_to_id(batch_idx: usize, pf_idx: usize, rs_idx: usize) -> String {
        format!("b{}p{}r{}", batch_idx, pf_idx, rs_idx)
    }
}

/// Thompson Sampling agent
pub struct ThompsonSampling {
    arms: HashMap<String, BanditArm>,
    action_space: ActionSpace,
    success_threshold: f64,
    exploration_bonus: f64,
}

impl ThompsonSampling {
    /// Create a new Thompson Sampling agent
    pub fn new(action_space: ActionSpace, success_threshold: f64) -> Self {
        let mut arms = HashMap::new();

        // Initialize arms for all actions
        for (batch_idx, pf_idx, rs_idx) in action_space.all_actions() {
            let action_id = ActionSpace::action_to_id(batch_idx, pf_idx, rs_idx);
            arms.insert(action_id.clone(), BanditArm::new(action_id));
        }

        Self {
            arms,
            action_space,
            success_threshold,
            exploration_bonus: 0.1,
        }
    }

    /// Select an action using Thompson Sampling
    pub fn select_action(&self) -> (usize, usize, usize) {
        let mut best_sample = f64::NEG_INFINITY;
        let mut best_action = (0, 0, 0);

        for (batch_idx, pf_idx, rs_idx) in self.action_space.all_actions() {
            let action_id = ActionSpace::action_to_id(batch_idx, pf_idx, rs_idx);

            if let Some(arm) = self.arms.get(&action_id) {
                // Sample from arm's posterior
                let sample = arm.sample();

                // Add exploration bonus for rarely pulled arms
                let exploration = if arm.pulls < 10 {
                    self.exploration_bonus / (arm.pulls as f64 + 1.0)
                } else {
                    0.0
                };

                let score = sample + exploration;

                if score > best_sample {
                    best_sample = score;
                    best_action = (batch_idx, pf_idx, rs_idx);
                }
            }
        }

        best_action
    }

    /// Update agent with reward for taken action
    pub fn update(&mut self, batch_idx: usize, pf_idx: usize, rs_idx: usize, reward: f64) {
        let action_id = ActionSpace::action_to_id(batch_idx, pf_idx, rs_idx);

        if let Some(arm) = self.arms.get_mut(&action_id) {
            arm.update(reward, self.success_threshold);
        }
    }

    /// Get statistics for all arms
    pub fn get_arm_stats(&self) -> Vec<(String, f64, f64, usize)> {
        let mut stats: Vec<_> = self.arms.iter()
            .map(|(id, arm)| {
                (id.clone(), arm.mean_reward(), arm.confidence_width(), arm.pulls)
            })
            .collect();

        stats.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        stats
    }

    /// Get best performing arm
    pub fn get_best_arm(&self) -> Option<(String, f64)> {
        self.arms.iter()
            .filter(|(_, arm)| arm.pulls > 5) // Require minimum exploration
            .max_by(|(_, a), (_, b)| a.mean_reward().partial_cmp(&b.mean_reward()).unwrap())
            .map(|(id, arm)| (id.clone(), arm.mean_reward()))
    }

    /// Export policy as JSON
    pub fn export_policy(&self) -> String {
        serde_json::to_string_pretty(&self.arms).unwrap_or_else(|_| "{}".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bandit_arm_creation() {
        let arm = BanditArm::new("test_arm".to_string());
        assert_eq!(arm.alpha, 1.0);
        assert_eq!(arm.beta, 1.0);
        assert_eq!(arm.pulls, 0);
    }

    #[test]
    fn test_bandit_arm_update() {
        let mut arm = BanditArm::new("test".to_string());

        arm.update(0.8, 0.5); // Success
        assert_eq!(arm.alpha, 2.0);
        assert_eq!(arm.beta, 1.0);
        assert_eq!(arm.pulls, 1);

        arm.update(0.3, 0.5); // Failure
        assert_eq!(arm.alpha, 2.0);
        assert_eq!(arm.beta, 2.0);
        assert_eq!(arm.pulls, 2);
    }

    #[test]
    fn test_action_space_generation() {
        let action_space = ActionSpace::default();
        let actions = action_space.all_actions();

        // 4 batch sizes * 4 prefetch * 4 routing = 64 actions
        assert_eq!(actions.len(), 64);
    }

    #[test]
    fn test_thompson_sampling_creation() {
        let action_space = ActionSpace::default();
        let ts = ThompsonSampling::new(action_space, 0.5);

        assert_eq!(ts.arms.len(), 64);
    }

    #[test]
    fn test_action_selection() {
        let action_space = ActionSpace::default();
        let ts = ThompsonSampling::new(action_space, 0.5);

        let (batch_idx, pf_idx, rs_idx) = ts.select_action();

        assert!(batch_idx < 4);
        assert!(pf_idx < 4);
        assert!(rs_idx < 4);
    }

    #[test]
    fn test_reward_update() {
        let action_space = ActionSpace::default();
        let mut ts = ThompsonSampling::new(action_space, 0.5);

        // Select and update
        let (batch_idx, pf_idx, rs_idx) = ts.select_action();
        ts.update(batch_idx, pf_idx, rs_idx, 0.8);

        let action_id = ActionSpace::action_to_id(batch_idx, pf_idx, rs_idx);
        let arm = ts.arms.get(&action_id).unwrap();

        assert_eq!(arm.pulls, 1);
        assert_eq!(arm.cumulative_reward, 0.8);
    }

    #[test]
    fn test_best_arm_selection() {
        let action_space = ActionSpace::default();
        let mut ts = ThompsonSampling::new(action_space, 0.5);

        // Simulate some pulls
        for _ in 0..10 {
            ts.update(2, 2, 2, 0.9); // Good action
            ts.update(0, 0, 0, 0.3); // Poor action
        }

        let best = ts.get_best_arm();
        assert!(best.is_some());

        let (best_id, best_reward) = best.unwrap();
        assert!(best_reward > 0.5);
        assert!(best_id.contains("b2p2r2"));
    }
}
