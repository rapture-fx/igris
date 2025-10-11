//! Offline Trainer for RL Policy
//!
//! Replays stored telemetry traces to pre-train a policy seed
//! using Thompson Sampling before deploying to production.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs::File;
use std::io::Write;
use crate::rl::simulation::{SimulationHarness, SimulationConfig, SimulationAction};
use crate::rl::thompson_sampling::{ThompsonSampling, ActionSpace};

/// Configuration for offline trainer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerConfig {
    /// Number of training episodes
    pub num_episodes: usize,

    /// Maximum steps per episode
    pub max_steps_per_episode: usize,

    /// Success threshold for rewards
    pub success_threshold: f64,

    /// Learning rate
    pub learning_rate: f64,

    /// Exploration decay rate
    pub exploration_decay: f64,

    /// Minimum exploration rate
    pub min_exploration: f64,

    /// Save policy every N episodes
    pub save_interval: usize,

    /// Output path for policy seed
    pub output_path: String,
}

impl Default for TrainerConfig {
    fn default() -> Self {
        Self {
            num_episodes: 100,
            max_steps_per_episode: 1000,
            success_threshold: 0.0,
            learning_rate: 0.1,
            exploration_decay: 0.99,
            min_exploration: 0.05,
            save_interval: 10,
            output_path: "policy_seed_v1.json".to_string(),
        }
    }
}

/// Trained policy seed artifact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicySeed {
    /// Version identifier
    pub version: String,

    /// Training timestamp
    pub timestamp_ms: u64,

    /// Total training episodes
    pub episodes_trained: usize,

    /// Total steps taken
    pub total_steps: usize,

    /// Final average reward
    pub final_avg_reward: f64,

    /// Baseline average reward (random policy)
    pub baseline_avg_reward: f64,

    /// Reward improvement percentage
    pub reward_improvement_percent: f64,

    /// Serialized Thompson Sampling arms
    pub policy_data: String,

    /// Best action identified
    pub best_action: Option<(usize, usize, usize)>,

    /// Training metrics
    pub training_metrics: TrainingMetrics,
}

/// Training metrics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingMetrics {
    /// Episode rewards
    pub episode_rewards: Vec<f64>,

    /// Episode lengths
    pub episode_lengths: Vec<usize>,

    /// Convergence iteration
    pub convergence_episode: Option<usize>,

    /// Training duration (seconds)
    pub training_duration_secs: f64,
}

/// Offline trainer for RL policy
pub struct OfflineTrainer {
    config: TrainerConfig,
    simulation: SimulationHarness,
    agent: ThompsonSampling,
    metrics: TrainingMetrics,
}

impl OfflineTrainer {
    /// Create a new offline trainer
    pub fn new(
        trainer_config: TrainerConfig,
        simulation_config: SimulationConfig,
    ) -> Result<Self, String> {
        let simulation = SimulationHarness::new(simulation_config)?;
        let action_space = ActionSpace::default();
        let agent = ThompsonSampling::new(action_space, trainer_config.success_threshold);

        Ok(Self {
            config: trainer_config,
            simulation,
            agent,
            metrics: TrainingMetrics {
                episode_rewards: Vec::new(),
                episode_lengths: Vec::new(),
                convergence_episode: None,
                training_duration_secs: 0.0,
            },
        })
    }

    /// Train the policy using offline simulation
    pub fn train(&mut self) -> Result<PolicySeed, String> {
        let start_time = std::time::Instant::now();

        println!("Starting offline training for {} episodes...", self.config.num_episodes);

        // Compute baseline (random policy)
        let baseline_reward = self.evaluate_random_policy()?;
        println!("Baseline reward (random): {:.4}", baseline_reward);

        // Training loop
        for episode in 0..self.config.num_episodes {
            let episode_reward = self.train_episode(episode)?;
            self.metrics.episode_rewards.push(episode_reward);

            if (episode + 1) % 10 == 0 {
                let avg_reward = self.metrics.episode_rewards.iter()
                    .rev()
                    .take(10)
                    .sum::<f64>() / 10.0;

                println!("Episode {}/{}: Avg reward (last 10): {:.4}",
                    episode + 1,
                    self.config.num_episodes,
                    avg_reward
                );
            }

            // Check for convergence
            if self.metrics.convergence_episode.is_none() && episode >= 20 {
                if self.check_convergence(episode) {
                    self.metrics.convergence_episode = Some(episode);
                    println!("✓ Policy converged at episode {}", episode);
                }
            }

            // Save checkpoint
            if (episode + 1) % self.config.save_interval == 0 {
                self.save_checkpoint(episode)?;
            }
        }

        let training_duration = start_time.elapsed().as_secs_f64();
        self.metrics.training_duration_secs = training_duration;

        // Generate final policy seed
        let policy_seed = self.generate_policy_seed(baseline_reward)?;

        println!("\nTraining complete!");
        println!("Duration: {:.2}s", training_duration);
        println!("Final avg reward: {:.4}", policy_seed.final_avg_reward);
        println!("Reward improvement: {:.2}%", policy_seed.reward_improvement_percent);

        // Save final policy
        self.save_policy_seed(&policy_seed)?;

        Ok(policy_seed)
    }

    /// Train a single episode
    fn train_episode(&mut self, episode: usize) -> Result<f64, String> {
        let mut total_reward = 0.0;
        let mut steps = 0;

        // Reset environment
        let mut _state = self.simulation.reset();

        // Episode loop
        while !self.simulation.is_done() && steps < self.config.max_steps_per_episode {
            // Select action using Thompson Sampling
            let (batch_idx, pf_idx, rs_idx) = self.agent.select_action();

            // Convert to simulation action
            let action = SimulationAction {
                batch_size: self.get_batch_size(batch_idx),
                prefetch_confidence_idx: pf_idx,
                routing_split_idx: rs_idx,
            };

            // Take step
            let (next_state, reward, done) = self.simulation.step(&action);

            // Update agent
            self.agent.update(batch_idx, pf_idx, rs_idx, reward.total);

            total_reward += reward.total;
            steps += 1;
            _state = next_state;

            if done {
                break;
            }
        }

        self.metrics.episode_lengths.push(steps);

        Ok(total_reward / steps as f64)
    }

    /// Evaluate a random policy for baseline
    fn evaluate_random_policy(&mut self) -> Result<f64, String> {
        let mut total_reward = 0.0;
        let mut steps = 0;
        let num_eval_episodes = 10;

        for _ in 0..num_eval_episodes {
            self.simulation.reset();

            while !self.simulation.is_done() && steps < 100 {
                // Random action
                let action = SimulationAction {
                    batch_size: 32, // Default
                    prefetch_confidence_idx: 2, // 0.90
                    routing_split_idx: 1, // 0.80
                };

                let (_next_state, reward, done) = self.simulation.step(&action);
                total_reward += reward.total;
                steps += 1;

                if done {
                    break;
                }
            }
        }

        Ok(total_reward / steps as f64)
    }

    /// Check if policy has converged
    fn check_convergence(&self, current_episode: usize) -> bool {
        if current_episode < 20 {
            return false;
        }

        // Check last 10 episodes for stability
        let recent_rewards: Vec<f64> = self.metrics.episode_rewards
            .iter()
            .rev()
            .take(10)
            .copied()
            .collect();

        if recent_rewards.len() < 10 {
            return false;
        }

        let mean = recent_rewards.iter().sum::<f64>() / recent_rewards.len() as f64;
        let variance = recent_rewards.iter()
            .map(|r| (r - mean).powi(2))
            .sum::<f64>() / recent_rewards.len() as f64;

        let std_dev = variance.sqrt();

        // Converged if std dev < 5% of mean
        std_dev < mean.abs() * 0.05
    }

    /// Generate policy seed artifact
    fn generate_policy_seed(&self, baseline_reward: f64) -> Result<PolicySeed, String> {
        let final_avg_reward = self.metrics.episode_rewards
            .iter()
            .rev()
            .take(10)
            .sum::<f64>() / 10.0;

        let reward_improvement_percent = if baseline_reward != 0.0 {
            ((final_avg_reward - baseline_reward) / baseline_reward.abs()) * 100.0
        } else {
            0.0
        };

        let best_action = self.agent.get_best_arm()
            .and_then(|(id, _)| self.parse_action_id(&id));

        Ok(PolicySeed {
            version: "v1.0.0".to_string(),
            timestamp_ms: Self::current_timestamp_ms(),
            episodes_trained: self.config.num_episodes,
            total_steps: self.metrics.episode_lengths.iter().sum(),
            final_avg_reward,
            baseline_avg_reward: baseline_reward,
            reward_improvement_percent,
            policy_data: self.agent.export_policy(),
            best_action,
            training_metrics: self.metrics.clone(),
        })
    }

    /// Save policy seed to file
    fn save_policy_seed(&self, seed: &PolicySeed) -> Result<(), String> {
        let path = Path::new(&self.config.output_path);
        let json = serde_json::to_string_pretty(seed)
            .map_err(|e| format!("Failed to serialize policy seed: {}", e))?;

        let mut file = File::create(path)
            .map_err(|e| format!("Failed to create file: {}", e))?;

        file.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write file: {}", e))?;

        println!("Policy seed saved to: {}", self.config.output_path);

        Ok(())
    }

    /// Save training checkpoint
    fn save_checkpoint(&self, episode: usize) -> Result<(), String> {
        let checkpoint_path = format!("policy_checkpoint_ep{}.json", episode);
        let json = self.agent.export_policy();

        let path = Path::new(&checkpoint_path);
        let mut file = File::create(path)
            .map_err(|e| format!("Failed to create checkpoint: {}", e))?;

        file.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write checkpoint: {}", e))?;

        Ok(())
    }

    /// Helper: Convert batch index to size
    fn get_batch_size(&self, idx: usize) -> usize {
        match idx {
            0 => 8,
            1 => 16,
            2 => 32,
            3 => 64,
            _ => 32,
        }
    }

    /// Helper: Parse action ID string
    fn parse_action_id(&self, id: &str) -> Option<(usize, usize, usize)> {
        // Format: "bXpYrZ"
        let parts: Vec<&str> = id.split(['b', 'p', 'r'])
            .filter(|s| !s.is_empty())
            .collect();

        if parts.len() == 3 {
            let batch_idx = parts[0].parse().ok()?;
            let pf_idx = parts[1].parse().ok()?;
            let rs_idx = parts[2].parse().ok()?;
            Some((batch_idx, pf_idx, rs_idx))
        } else {
            None
        }
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
    fn test_trainer_creation() {
        let trainer_config = TrainerConfig {
            num_episodes: 10,
            ..Default::default()
        };
        let sim_config = SimulationConfig::default();

        let trainer = OfflineTrainer::new(trainer_config, sim_config);
        assert!(trainer.is_ok());
    }

    #[test]
    fn test_train_single_episode() {
        let trainer_config = TrainerConfig {
            num_episodes: 1,
            max_steps_per_episode: 50,
            ..Default::default()
        };
        let sim_config = SimulationConfig {
            max_traces: 100,
            ..Default::default()
        };

        let mut trainer = OfflineTrainer::new(trainer_config, sim_config).unwrap();
        let reward = trainer.train_episode(0);

        assert!(reward.is_ok());
    }

    #[test]
    fn test_convergence_check() {
        let trainer_config = TrainerConfig::default();
        let sim_config = SimulationConfig::default();
        let mut trainer = OfflineTrainer::new(trainer_config, sim_config).unwrap();

        // Add stable rewards
        for _ in 0..25 {
            trainer.metrics.episode_rewards.push(-0.5);
        }

        assert!(trainer.check_convergence(24));
    }

    #[test]
    fn test_policy_seed_generation() {
        let trainer_config = TrainerConfig::default();
        let sim_config = SimulationConfig::default();
        let trainer = OfflineTrainer::new(trainer_config, sim_config).unwrap();

        let seed = trainer.generate_policy_seed(-0.6);
        assert!(seed.is_ok());

        let seed = seed.unwrap();
        assert_eq!(seed.version, "v1.0.0");
    }

    #[test]
    fn test_action_id_parsing() {
        let trainer_config = TrainerConfig::default();
        let sim_config = SimulationConfig::default();
        let trainer = OfflineTrainer::new(trainer_config, sim_config).unwrap();

        let action = trainer.parse_action_id("b2p3r1");
        assert_eq!(action, Some((2, 3, 1)));
    }

    #[test]
    fn test_batch_size_conversion() {
        let trainer_config = TrainerConfig::default();
        let sim_config = SimulationConfig::default();
        let trainer = OfflineTrainer::new(trainer_config, sim_config).unwrap();

        assert_eq!(trainer.get_batch_size(0), 8);
        assert_eq!(trainer.get_batch_size(1), 16);
        assert_eq!(trainer.get_batch_size(2), 32);
        assert_eq!(trainer.get_batch_size(3), 64);
    }

    #[test]
    fn test_full_training_small() {
        let trainer_config = TrainerConfig {
            num_episodes: 5,
            max_steps_per_episode: 20,
            save_interval: 5,
            output_path: "/tmp/test_policy_seed.json".to_string(),
            ..Default::default()
        };
        let sim_config = SimulationConfig {
            max_traces: 50,
            ..Default::default()
        };

        let mut trainer = OfflineTrainer::new(trainer_config, sim_config).unwrap();
        let result = trainer.train();

        assert!(result.is_ok());
        let seed = result.unwrap();
        assert!(seed.episodes_trained == 5);
        assert!(seed.total_steps > 0);
    }
}
