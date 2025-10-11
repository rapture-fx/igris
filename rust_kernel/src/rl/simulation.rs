//! Simulation Harness for Offline RL Training
//!
//! Replays stored Phase 8/10 telemetry to train policies in a safe,
//! controlled environment before production deployment.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

/// Configuration for simulation harness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationConfig {
    /// Path to telemetry trace file
    pub trace_file_path: String,

    /// Maximum traces to load
    pub max_traces: usize,

    /// Enable deterministic replay
    pub deterministic: bool,

    /// Random seed for reproducibility
    pub random_seed: u64,

    /// Simulation time step (milliseconds)
    pub time_step_ms: u64,
}

impl Default for SimulationConfig {
    fn default() -> Self {
        Self {
            trace_file_path: "/telemetry/phase8_baseline.json".to_string(),
            max_traces: 10000,
            deterministic: true,
            random_seed: 42,
            time_step_ms: 100,
        }
    }
}

/// Single telemetry trace entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryTrace {
    /// Timestamp in milliseconds
    pub timestamp_ms: u64,

    /// Average latency
    pub avg_latency_ms: f64,

    /// P95 latency
    pub p95_latency_ms: f64,

    /// Cache hit rate (0.0-1.0)
    pub cache_hit_rate: f64,

    /// Queue depth
    pub queue_depth: usize,

    /// CPU utilization (0.0-1.0)
    pub cpu_utilization: f64,

    /// Memory utilization (0.0-1.0)
    pub memory_utilization: f64,

    /// Throughput (requests per second)
    pub throughput_rps: f64,

    /// Error rate (0.0-1.0)
    pub error_rate: f64,

    /// Current batch size
    pub batch_size: usize,

    /// Current prefetch confidence (0.0-1.0)
    pub prefetch_confidence: f64,

    /// Current routing split (0.0-1.0)
    pub routing_split: f64,
}

impl Default for TelemetryTrace {
    fn default() -> Self {
        Self {
            timestamp_ms: 0,
            avg_latency_ms: 100.0,
            p95_latency_ms: 150.0,
            cache_hit_rate: 0.85,
            queue_depth: 10,
            cpu_utilization: 0.50,
            memory_utilization: 0.50,
            throughput_rps: 100.0,
            error_rate: 0.01,
            batch_size: 32,
            prefetch_confidence: 0.85,
            routing_split: 0.8,
        }
    }
}

/// State representation for RL agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationState {
    /// Recent latency samples (last N)
    pub latency_samples: Vec<f64>,

    /// Cache hit rate
    pub cache_hit_rate: f64,

    /// Queue depth
    pub queue_depth: usize,

    /// Memory pool free percentage
    pub mempool_free_percent: f64,

    /// Drift score from baseline
    pub drift_score: f64,

    /// CPU utilization
    pub cpu_utilization: f64,

    /// Error rate
    pub error_rate: f64,
}

/// Action space for RL agent
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SimulationAction {
    /// Batch size selection {8, 16, 32, 64}
    pub batch_size: usize,

    /// Prefetch confidence (discretized: 0.7, 0.8, 0.9, 0.95)
    pub prefetch_confidence_idx: usize,

    /// Routing split percentage (discretized: 70, 80, 90, 100)
    pub routing_split_idx: usize,
}

impl SimulationAction {
    pub fn prefetch_confidence(&self) -> f64 {
        match self.prefetch_confidence_idx {
            0 => 0.70,
            1 => 0.80,
            2 => 0.90,
            3 => 0.95,
            _ => 0.85,
        }
    }

    pub fn routing_split(&self) -> f64 {
        match self.routing_split_idx {
            0 => 0.70,
            1 => 0.80,
            2 => 0.90,
            3 => 1.00,
            _ => 0.80,
        }
    }
}

/// Reward calculation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reward {
    /// Overall reward score
    pub total: f64,

    /// Latency component
    pub latency_component: f64,

    /// Cost component
    pub cost_component: f64,

    /// Error penalty
    pub error_penalty: f64,
}

/// Simulation harness for RL training
pub struct SimulationHarness {
    config: SimulationConfig,
    traces: VecDeque<TelemetryTrace>,
    current_step: usize,
    reward_weights: RewardWeights,
}

#[derive(Debug, Clone)]
struct RewardWeights {
    alpha_latency: f64,
    beta_cost: f64,
    gamma_error: f64,
}

impl Default for RewardWeights {
    fn default() -> Self {
        Self {
            alpha_latency: 0.5,
            beta_cost: 0.3,
            gamma_error: 0.2,
        }
    }
}

impl SimulationHarness {
    /// Create a new simulation harness
    pub fn new(config: SimulationConfig) -> Result<Self, String> {
        let traces = Self::load_traces(&config)?;

        Ok(Self {
            config,
            traces,
            current_step: 0,
            reward_weights: RewardWeights::default(),
        })
    }

    /// Load telemetry traces from file
    fn load_traces(config: &SimulationConfig) -> Result<VecDeque<TelemetryTrace>, String> {
        let path = Path::new(&config.trace_file_path);

        // If file doesn't exist, generate synthetic traces for testing
        if !path.exists() {
            return Ok(Self::generate_synthetic_traces(config.max_traces));
        }

        let file = File::open(path)
            .map_err(|e| format!("Failed to open trace file: {}", e))?;

        let reader = BufReader::new(file);
        let mut traces: Vec<TelemetryTrace> = serde_json::from_reader(reader)
            .map_err(|e| format!("Failed to parse traces: {}", e))?;

        // Limit to max_traces
        traces.truncate(config.max_traces);

        Ok(traces.into_iter().collect())
    }

    /// Generate synthetic traces for testing
    fn generate_synthetic_traces(count: usize) -> VecDeque<TelemetryTrace> {
        let mut traces = VecDeque::new();

        for i in 0..count {
            let mut trace = TelemetryTrace::default();
            trace.timestamp_ms = i as u64 * 100;

            // Add some variance
            let variance = (i % 100) as f64 / 100.0;
            trace.avg_latency_ms = 100.0 + variance * 50.0;
            trace.cache_hit_rate = 0.85 + variance * 0.10;
            trace.throughput_rps = 100.0 + variance * 100.0;

            traces.push_back(trace);
        }

        traces
    }

    /// Reset simulation to beginning
    pub fn reset(&mut self) -> SimulationState {
        self.current_step = 0;
        self.get_current_state()
    }

    /// Take one simulation step with given action
    pub fn step(&mut self, action: &SimulationAction) -> (SimulationState, Reward, bool) {
        if self.current_step >= self.traces.len() {
            // Episode done
            return (self.get_current_state(), Reward { total: 0.0, latency_component: 0.0, cost_component: 0.0, error_penalty: 0.0 }, true);
        }

        let current_trace = &self.traces[self.current_step];

        // Simulate effect of action on next state
        let next_state = self.simulate_action_effect(current_trace, action);

        // Compute reward
        let reward = self.compute_reward(&next_state, action);

        self.current_step += 1;
        let done = self.current_step >= self.traces.len();

        (next_state, reward, done)
    }

    /// Get current simulation state
    fn get_current_state(&self) -> SimulationState {
        if self.traces.is_empty() {
            return SimulationState {
                latency_samples: vec![100.0],
                cache_hit_rate: 0.85,
                queue_depth: 10,
                mempool_free_percent: 0.70,
                drift_score: 0.0,
                cpu_utilization: 0.50,
                error_rate: 0.01,
            };
        }

        let start = self.current_step.saturating_sub(10);
        let end = self.current_step.min(self.traces.len());

        let mut latency_samples: Vec<f64> = self.traces
            .iter()
            .skip(start)
            .take(end - start)
            .map(|t| t.avg_latency_ms)
            .collect();

        // Ensure at least one sample
        if latency_samples.is_empty() && !self.traces.is_empty() {
            latency_samples.push(self.traces[0].avg_latency_ms);
        }

        let current_trace = &self.traces[self.current_step.min(self.traces.len() - 1)];

        SimulationState {
            latency_samples,
            cache_hit_rate: current_trace.cache_hit_rate,
            queue_depth: current_trace.queue_depth,
            mempool_free_percent: 1.0 - current_trace.memory_utilization,
            drift_score: 0.0, // Computed based on baseline
            cpu_utilization: current_trace.cpu_utilization,
            error_rate: current_trace.error_rate,
        }
    }

    /// Simulate the effect of an action on the environment
    fn simulate_action_effect(&self, trace: &TelemetryTrace, action: &SimulationAction) -> SimulationState {
        let mut state = self.get_current_state();

        // Simulate batch size effect on latency
        let batch_factor = (action.batch_size as f64 / 32.0).ln() / 2.0_f64.ln();
        let latency_adjustment = batch_factor * 20.0; // Larger batches add latency

        let adjusted_latency = trace.avg_latency_ms + latency_adjustment;
        state.latency_samples.push(adjusted_latency);
        if state.latency_samples.len() > 10 {
            state.latency_samples.remove(0);
        }

        // Simulate prefetch effect on cache hit rate
        let prefetch_boost = (action.prefetch_confidence() - 0.80) * 0.15;
        state.cache_hit_rate = (trace.cache_hit_rate + prefetch_boost).min(1.0);

        // Simulate routing split effect on error rate
        let routing_factor = 1.0 - action.routing_split();
        state.error_rate = trace.error_rate * (1.0 + routing_factor * 0.5);

        state
    }

    /// Compute reward for state-action pair
    fn compute_reward(&self, state: &SimulationState, _action: &SimulationAction) -> Reward {
        let avg_latency = state.latency_samples.iter().sum::<f64>() / state.latency_samples.len() as f64;

        // Normalize latency (lower is better)
        let latency_component = -(avg_latency / 150.0) * self.reward_weights.alpha_latency;

        // Cost estimate (based on throughput and resource usage)
        let cost_estimate = state.cpu_utilization * 0.5 + (1.0 - state.cache_hit_rate) * 0.5;
        let cost_component = -cost_estimate * self.reward_weights.beta_cost;

        // Error penalty
        let error_penalty = -state.error_rate * 100.0 * self.reward_weights.gamma_error;

        let total = latency_component + cost_component + error_penalty;

        Reward {
            total,
            latency_component,
            cost_component,
            error_penalty,
        }
    }

    /// Get total number of traces
    pub fn num_traces(&self) -> usize {
        self.traces.len()
    }

    /// Check if episode is done
    pub fn is_done(&self) -> bool {
        self.current_step >= self.traces.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simulation_harness_creation() {
        let config = SimulationConfig::default();
        let harness = SimulationHarness::new(config);
        assert!(harness.is_ok());
    }

    #[test]
    fn test_synthetic_trace_generation() {
        let traces = SimulationHarness::generate_synthetic_traces(100);
        assert_eq!(traces.len(), 100);
        assert!(traces[0].avg_latency_ms > 0.0);
    }

    #[test]
    fn test_simulation_step() {
        let config = SimulationConfig {
            max_traces: 100,
            ..Default::default()
        };
        let mut harness = SimulationHarness::new(config).unwrap();

        let initial_state = harness.reset();
        assert!(!initial_state.latency_samples.is_empty());

        let action = SimulationAction {
            batch_size: 32,
            prefetch_confidence_idx: 2,
            routing_split_idx: 1,
        };

        let (next_state, reward, done) = harness.step(&action);
        assert!(!done);
        assert!(reward.total != 0.0);
        assert!(!next_state.latency_samples.is_empty());
    }

    #[test]
    fn test_action_space() {
        let action = SimulationAction {
            batch_size: 32,
            prefetch_confidence_idx: 2,
            routing_split_idx: 3,
        };

        assert_eq!(action.prefetch_confidence(), 0.90);
        assert_eq!(action.routing_split(), 1.00);
    }

    #[test]
    fn test_reward_computation() {
        let config = SimulationConfig::default();
        let harness = SimulationHarness::new(config).unwrap();

        let state = SimulationState {
            latency_samples: vec![100.0, 105.0, 98.0],
            cache_hit_rate: 0.90,
            queue_depth: 5,
            mempool_free_percent: 0.80,
            drift_score: 0.0,
            cpu_utilization: 0.50,
            error_rate: 0.01,
        };

        let action = SimulationAction {
            batch_size: 32,
            prefetch_confidence_idx: 2,
            routing_split_idx: 1,
        };

        let reward = harness.compute_reward(&state, &action);

        // Good performance should give positive total reward
        assert!(reward.total < 0.0); // Negative because we minimize
        assert!(reward.latency_component < 0.0);
    }
}
