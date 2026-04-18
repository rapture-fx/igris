//! Swarm Intelligence integration for igris-server.
//!
//! Provides API endpoints for swarm coordination:
//! - POST /v1/swarm/join - Join the swarm
//! - GET  /v1/swarm/status - Get swarm status
//! - POST /v1/swarm/propose - Propose a task
//! - POST /v1/swarm/vote - Vote on a proposal

use anyhow::Result;
use igris_swarm::{
    HealthCheckHandler, InferenceTaskHandler, SwarmConfig as SwarmCrateConfig, SwarmCoordinator,
    SwarmStatus, TaskExecutor,
};
use std::sync::Arc;
use tracing::info;

/// Manages the swarm lifecycle within the runtime server
pub struct SwarmManager {
    coordinator: Arc<SwarmCoordinator>,
}

impl SwarmManager {
    /// Initialize with default task handlers
    pub async fn new(agent_id: &str) -> Result<Self> {
        let config = SwarmCrateConfig::default();
        let mut coordinator = SwarmCoordinator::with_id(config, agent_id).await?;

        // Register this agent in the swarm
        coordinator.join_swarm(agent_id).await?;

        // Set up task executor with built-in handlers
        let executor = Arc::new(TaskExecutor::new(agent_id));
        executor
            .register_handler("health", Arc::new(HealthCheckHandler))
            .await;
        executor
            .register_handler("inference", Arc::new(InferenceTaskHandler))
            .await;
        coordinator.set_task_executor(executor);

        info!("Swarm manager initialized for agent {}", agent_id);

        Ok(Self {
            coordinator: Arc::new(coordinator),
        })
    }

    /// Get swarm status
    pub async fn get_status(&self) -> SwarmStatus {
        self.coordinator.get_status().await
    }

    /// Join another agent to the swarm
    pub async fn join_agent(&self, agent_id: &str) -> Result<()> {
        self.coordinator.join_swarm(agent_id).await
    }

    /// Get all agents
    pub async fn get_agents(&self) -> Vec<igris_swarm::AgentInfo> {
        self.coordinator.get_agents().await
    }

    /// Propose a task
    pub async fn propose_task(
        &self,
        task_type: String,
        parameters: serde_json::Value,
        priority: u8,
    ) -> Result<String> {
        self.coordinator
            .propose_task(task_type, parameters, priority)
            .await
    }

    /// Vote on a proposal
    pub async fn vote(&self, proposal_id: &str, approve: bool) -> Result<()> {
        self.coordinator
            .vote_on_proposal(proposal_id, approve)
            .await
    }

    /// Check and execute a proposal if it has consensus
    pub async fn check_and_execute(
        &self,
        proposal_id: &str,
    ) -> Result<Option<igris_swarm::TaskExecutionResult>> {
        self.coordinator
            .check_and_execute_proposal(proposal_id)
            .await
    }

    /// Start election
    pub async fn start_election(&self) -> Result<()> {
        self.coordinator.start_election().await
    }

    /// Process an incoming swarm message
    pub async fn process_message(
        &self,
        message: igris_swarm::SwarmMessage,
    ) -> Result<Option<igris_swarm::SwarmMessage>> {
        self.coordinator.process_message(message).await
    }

    /// Clean up stale agents
    pub async fn cleanup_stale(&self) -> Vec<String> {
        self.coordinator.cleanup_stale_agents().await
    }
}
