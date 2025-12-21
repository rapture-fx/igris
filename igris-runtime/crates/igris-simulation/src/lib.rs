//! Simulation & Testing Suite for Igris Runtime
//!
//! Provides virtual environments and chaos testing for AI agents.

use anyhow::Result;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationConfig {
    pub enabled: bool,
    pub env_type: EnvironmentType,
    pub chaos_enabled: bool,
    pub failure_rate: f32,
}

impl Default for SimulationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            env_type: EnvironmentType::VirtualSwarm,
            chaos_enabled: false,
            failure_rate: 0.1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnvironmentType {
    VirtualSwarm,
    Gazebo,
    IsaacSim,
}

pub struct SimulationEnvironment {
    config: SimulationConfig,
    agents: Vec<VirtualAgent>,
}

#[derive(Debug, Clone)]
pub struct VirtualAgent {
    pub id: String,
    pub position: (f32, f32, f32),
    pub status: AgentStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AgentStatus {
    Active,
    Failed,
    Recovering,
}

impl SimulationEnvironment {
    pub async fn new(config: SimulationConfig) -> Result<Self> {
        info!("Initializing simulation environment: {:?}", config.env_type);

        Ok(Self {
            config,
            agents: vec![],
        })
    }

    pub async fn spawn_agent(&mut self, id: String) -> Result<()> {
        let agent = VirtualAgent {
            id,
            position: (0.0, 0.0, 0.0),
            status: AgentStatus::Active,
        };

        self.agents.push(agent);
        Ok(())
    }

    pub async fn inject_failure(&mut self, agent_id: &str) -> Result<()> {
        if let Some(agent) = self.agents.iter_mut().find(|a| a.id == agent_id) {
            agent.status = AgentStatus::Failed;
            info!("Injected failure into agent '{}'", agent_id);
        }
        Ok(())
    }

    pub async fn step(&mut self) -> Result<()> {
        // Simulate chaos if enabled
        if self.config.chaos_enabled {
            let mut rng = rand::thread_rng();
            for agent in &mut self.agents {
                if agent.status == AgentStatus::Active
                    && rng.gen::<f32>() < self.config.failure_rate
                {
                    agent.status = AgentStatus::Failed;
                }
            }
        }

        Ok(())
    }

    pub fn get_agent_count(&self) -> usize {
        self.agents.len()
    }

    pub fn get_active_agents(&self) -> usize {
        self.agents
            .iter()
            .filter(|a| a.status == AgentStatus::Active)
            .count()
    }
}

pub struct BenchmarkRunner {
    results: HashMap<String, BenchmarkResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub test_name: String,
    pub duration_ms: u64,
    pub success: bool,
    pub metrics: HashMap<String, f64>,
}

impl BenchmarkRunner {
    pub fn new() -> Self {
        Self {
            results: HashMap::new(),
        }
    }

    pub async fn run_benchmark(&mut self, name: &str) -> Result<BenchmarkResult> {
        let start = std::time::Instant::now();

        // Simulated benchmark
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let duration = start.elapsed().as_millis() as u64;

        let result = BenchmarkResult {
            test_name: name.to_string(),
            duration_ms: duration,
            success: true,
            metrics: HashMap::new(),
        };

        self.results.insert(name.to_string(), result.clone());

        Ok(result)
    }

    pub fn get_results(&self) -> Vec<BenchmarkResult> {
        self.results.values().cloned().collect()
    }
}

impl Default for BenchmarkRunner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_simulation_init() {
        let config = SimulationConfig::default();
        let sim = SimulationEnvironment::new(config).await;
        assert!(sim.is_ok());
    }

    #[tokio::test]
    async fn test_spawn_agents() {
        let config = SimulationConfig::default();
        let mut sim = SimulationEnvironment::new(config).await.unwrap();

        sim.spawn_agent("agent-1".to_string()).await.unwrap();
        sim.spawn_agent("agent-2".to_string()).await.unwrap();

        assert_eq!(sim.get_agent_count(), 2);
        assert_eq!(sim.get_active_agents(), 2);
    }

    #[tokio::test]
    async fn test_failure_injection() {
        let config = SimulationConfig::default();
        let mut sim = SimulationEnvironment::new(config).await.unwrap();

        sim.spawn_agent("agent-1".to_string()).await.unwrap();
        assert_eq!(sim.get_active_agents(), 1);

        sim.inject_failure("agent-1").await.unwrap();
        assert_eq!(sim.get_active_agents(), 0);
    }

    #[tokio::test]
    async fn test_benchmark() {
        let mut runner = BenchmarkRunner::new();
        let result = runner.run_benchmark("test").await.unwrap();

        assert_eq!(result.test_name, "test");
        assert!(result.success);
        assert!(result.duration_ms > 0);
    }
}
