//! Autonomous Control Core
//!
//! Orchestrates self-healing workflows: detect -> isolate -> recover -> verify -> resume

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};

use crate::reliability::recovery_engine::RecoveryEngine;
use crate::reliability::checkpoint::CheckpointManager;
use crate::predictive::forecast_engine::ForecastEngine;

/// Autonomous control core configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlConfig {
    /// Enable autonomous mode
    pub enabled: bool,

    /// Enable auto-scaling
    pub auto_scale_enabled: bool,

    /// Enable auto-healing
    pub auto_heal_enabled: bool,

    /// Enable auto-isolation
    pub auto_isolate_enabled: bool,

    /// Maximum concurrent recoveries
    pub max_concurrent_recoveries: usize,

    /// Recovery timeout (seconds)
    pub recovery_timeout_secs: u64,

    /// Verification retries
    pub verification_retries: u32,

    /// Shadow mode (log only, no actions)
    pub shadow_mode: bool,

    /// Manual kill switch enabled
    pub kill_switch_enabled: bool,
}

impl Default for ControlConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_scale_enabled: true,
            auto_heal_enabled: true,
            auto_isolate_enabled: true,
            max_concurrent_recoveries: 5,
            recovery_timeout_secs: 300,
            verification_retries: 3,
            shadow_mode: false,
            kill_switch_enabled: false,
        }
    }
}

/// Control decision made by autonomous core
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlDecision {
    pub decision_type: DecisionType,
    pub target: String,
    pub reason: String,
    pub confidence: f64,
    pub timestamp: DateTime<Utc>,
    pub workflow_id: String,
    pub shadow_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DecisionType {
    ScaleUp,
    ScaleDown,
    IsolateNode,
    RecoverNode,
    Checkpoint,
    Rollback,
    NoAction,
}

/// Recovery workflow state machine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryWorkflow {
    pub workflow_id: String,
    pub target: String,
    pub state: WorkflowState,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub steps: Vec<WorkflowStep>,
    pub verification_attempts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkflowState {
    Detecting,
    Isolating,
    Recovering,
    Verifying,
    Resuming,
    Completed,
    Failed,
    RolledBack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub step_name: String,
    pub state: StepState,
    pub timestamp: DateTime<Utc>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StepState {
    Pending,
    Running,
    Completed,
    Failed,
}

/// Autonomous Control Core
pub struct AutonomousControlCore {
    config: Arc<RwLock<ControlConfig>>,
    forecast_engine: Arc<RwLock<ForecastEngine>>,
    active_workflows: Arc<RwLock<HashMap<String, RecoveryWorkflow>>>,
    metrics: Arc<RwLock<ControlMetrics>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlMetrics {
    pub total_decisions: u64,
    pub auto_scale_actions: u64,
    pub auto_heal_actions: u64,
    pub isolations: u64,
    pub recoveries: u64,
    pub rollbacks: u64,
    pub verification_failures: u64,
    pub avg_recovery_time_secs: f64,
    pub success_rate: f64,
}

impl Default for ControlMetrics {
    fn default() -> Self {
        Self {
            total_decisions: 0,
            auto_scale_actions: 0,
            auto_heal_actions: 0,
            isolations: 0,
            recoveries: 0,
            rollbacks: 0,
            verification_failures: 0,
            avg_recovery_time_secs: 0.0,
            success_rate: 1.0,
        }
    }
}

impl AutonomousControlCore {
    /// Create new autonomous control core
    pub fn new(
        config: ControlConfig,
        forecast_engine: Arc<RwLock<ForecastEngine>>,
    ) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            forecast_engine,
            active_workflows: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(ControlMetrics::default())),
        }
    }

    /// Evaluate system state and make autonomous decisions
    pub async fn evaluate(&self) -> Result<Vec<ControlDecision>, String> {
        let config = self.config.read().await;

        if config.kill_switch_enabled {
            return Ok(vec![]);
        }

        if !config.enabled {
            return Ok(vec![]);
        }

        let mut decisions = Vec::new();

        // Check for needed scaling actions
        if config.auto_scale_enabled {
            if let Some(scale_decision) = self.evaluate_scaling().await {
                decisions.push(scale_decision);
            }
        }

        // Check for healing actions
        if config.auto_heal_enabled {
            if let Some(heal_decision) = self.evaluate_healing().await {
                decisions.push(heal_decision);
            }
        }

        // Check for isolation needs
        if config.auto_isolate_enabled {
            if let Some(isolate_decision) = self.evaluate_isolation().await {
                decisions.push(isolate_decision);
            }
        }

        // Update metrics
        let mut metrics = self.metrics.write().await;
        metrics.total_decisions += decisions.len() as u64;

        Ok(decisions)
    }

    /// Evaluate scaling needs
    async fn evaluate_scaling(&self) -> Option<ControlDecision> {
        // Get forecasts from predictive layer
        let forecast_engine = self.forecast_engine.read().await;
        let forecasts = forecast_engine.get_recent_forecasts(1).await;

        if forecasts.is_empty() {
            return None;
        }

        let forecast = &forecasts[0];

        // Check if preemptive scaling is needed
        if matches!(forecast.decision.decision_type, crate::predictive::proactive_adjuster::DecisionType::ScaleUp) && forecast.decision.urgent {
            let config = self.config.read().await;
            return Some(ControlDecision {
                decision_type: DecisionType::ScaleUp,
                target: forecast.metric_name.clone(),
                reason: format!("Preemptive scale-up based on forecast: {}", forecast.decision.reason),
                confidence: forecast.decision.confidence,
                timestamp: Utc::now(),
                workflow_id: format!("scale_{}", Utc::now().timestamp()),
                shadow_mode: config.shadow_mode,
            });
        }

        if matches!(forecast.decision.decision_type, crate::predictive::proactive_adjuster::DecisionType::ScaleDown) {
            let config = self.config.read().await;
            return Some(ControlDecision {
                decision_type: DecisionType::ScaleDown,
                target: forecast.metric_name.clone(),
                reason: format!("Preemptive scale-down: {}", forecast.decision.reason),
                confidence: forecast.decision.confidence,
                timestamp: Utc::now(),
                workflow_id: format!("scale_{}", Utc::now().timestamp()),
                shadow_mode: config.shadow_mode,
            });
        }

        None
    }

    /// Evaluate healing needs
    async fn evaluate_healing(&self) -> Option<ControlDecision> {
        // This would integrate with the Recovery Engine to detect failures
        // For now, placeholder logic
        None
    }

    /// Evaluate isolation needs
    async fn evaluate_isolation(&self) -> Option<ControlDecision> {
        // Get forecasts for preemptive rollback
        let forecast_engine = self.forecast_engine.read().await;
        let forecasts = forecast_engine.get_recent_forecasts(1).await;

        if forecasts.is_empty() {
            return None;
        }

        let forecast = &forecasts[0];

        if matches!(forecast.decision.decision_type, crate::predictive::proactive_adjuster::DecisionType::AdjustPolicy) {
            let config = self.config.read().await;
            return Some(ControlDecision {
                decision_type: DecisionType::IsolateNode,
                target: forecast.metric_name.clone(),
                reason: format!("Preemptive isolation: {}", forecast.decision.reason),
                confidence: forecast.decision.confidence,
                timestamp: Utc::now(),
                workflow_id: format!("isolate_{}", Utc::now().timestamp()),
                shadow_mode: config.shadow_mode,
            });
        }

        None
    }

    /// Execute a control decision
    pub async fn execute(&self, decision: &ControlDecision) -> Result<String, String> {
        let config = self.config.read().await;

        if config.shadow_mode || decision.shadow_mode {
            // Log only, don't execute
            return Ok(format!("SHADOW: Would execute {:?} on {}", decision.decision_type, decision.target));
        }

        // Create workflow
        let workflow = RecoveryWorkflow {
            workflow_id: decision.workflow_id.clone(),
            target: decision.target.clone(),
            state: WorkflowState::Detecting,
            started_at: Utc::now(),
            updated_at: Utc::now(),
            steps: vec![],
            verification_attempts: 0,
        };

        let mut workflows = self.active_workflows.write().await;
        workflows.insert(decision.workflow_id.clone(), workflow);
        drop(workflows);

        // Execute based on decision type
        match decision.decision_type {
            DecisionType::ScaleUp => self.execute_scale_up(decision).await,
            DecisionType::ScaleDown => self.execute_scale_down(decision).await,
            DecisionType::IsolateNode => self.execute_isolate(decision).await,
            DecisionType::RecoverNode => self.execute_recover(decision).await,
            DecisionType::Checkpoint => self.execute_checkpoint(decision).await,
            DecisionType::Rollback => self.execute_rollback(decision).await,
            DecisionType::NoAction => Ok("No action taken".to_string()),
        }
    }

    /// Execute scale-up
    async fn execute_scale_up(&self, decision: &ControlDecision) -> Result<String, String> {
        // Update workflow state
        self.update_workflow_state(&decision.workflow_id, WorkflowState::Recovering).await;

        // Simulate scale-up action
        // In production, this would call cluster autoscaler API
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Verify
        if self.verify_action(&decision.workflow_id).await {
            self.update_workflow_state(&decision.workflow_id, WorkflowState::Completed).await;

            let mut metrics = self.metrics.write().await;
            metrics.auto_scale_actions += 1;

            Ok(format!("Scaled up {}", decision.target))
        } else {
            self.update_workflow_state(&decision.workflow_id, WorkflowState::Failed).await;
            Err(format!("Failed to scale up {}", decision.target))
        }
    }

    /// Execute scale-down
    async fn execute_scale_down(&self, decision: &ControlDecision) -> Result<String, String> {
        self.update_workflow_state(&decision.workflow_id, WorkflowState::Recovering).await;

        // Simulate scale-down
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        if self.verify_action(&decision.workflow_id).await {
            self.update_workflow_state(&decision.workflow_id, WorkflowState::Completed).await;

            let mut metrics = self.metrics.write().await;
            metrics.auto_scale_actions += 1;

            Ok(format!("Scaled down {}", decision.target))
        } else {
            self.update_workflow_state(&decision.workflow_id, WorkflowState::Failed).await;
            Err(format!("Failed to scale down {}", decision.target))
        }
    }

    /// Execute node isolation
    async fn execute_isolate(&self, decision: &ControlDecision) -> Result<String, String> {
        self.update_workflow_state(&decision.workflow_id, WorkflowState::Isolating).await;

        // Simulate isolation
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        self.update_workflow_state(&decision.workflow_id, WorkflowState::Completed).await;

        let mut metrics = self.metrics.write().await;
        metrics.isolations += 1;

        Ok(format!("Isolated {}", decision.target))
    }

    /// Execute node recovery
    async fn execute_recover(&self, decision: &ControlDecision) -> Result<String, String> {
        self.update_workflow_state(&decision.workflow_id, WorkflowState::Recovering).await;

        // Simulate recovery
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        if self.verify_action(&decision.workflow_id).await {
            self.update_workflow_state(&decision.workflow_id, WorkflowState::Resuming).await;
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            self.update_workflow_state(&decision.workflow_id, WorkflowState::Completed).await;

            let mut metrics = self.metrics.write().await;
            metrics.recoveries += 1;
            metrics.auto_heal_actions += 1;

            Ok(format!("Recovered {}", decision.target))
        } else {
            self.update_workflow_state(&decision.workflow_id, WorkflowState::Failed).await;
            Err(format!("Failed to recover {}", decision.target))
        }
    }

    /// Execute checkpoint
    async fn execute_checkpoint(&self, decision: &ControlDecision) -> Result<String, String> {
        self.update_workflow_state(&decision.workflow_id, WorkflowState::Recovering).await;

        // Simulate checkpoint creation
        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

        self.update_workflow_state(&decision.workflow_id, WorkflowState::Completed).await;

        Ok(format!("Checkpoint created for {}", decision.target))
    }

    /// Execute rollback
    async fn execute_rollback(&self, decision: &ControlDecision) -> Result<String, String> {
        self.update_workflow_state(&decision.workflow_id, WorkflowState::Recovering).await;

        // Simulate rollback
        tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;

        if self.verify_action(&decision.workflow_id).await {
            self.update_workflow_state(&decision.workflow_id, WorkflowState::RolledBack).await;

            let mut metrics = self.metrics.write().await;
            metrics.rollbacks += 1;

            Ok(format!("Rolled back {}", decision.target))
        } else {
            self.update_workflow_state(&decision.workflow_id, WorkflowState::Failed).await;
            Err(format!("Failed to rollback {}", decision.target))
        }
    }

    /// Verify action success
    async fn verify_action(&self, workflow_id: &str) -> bool {
        let config = self.config.read().await;
        let mut workflows = self.active_workflows.write().await;

        if let Some(workflow) = workflows.get_mut(workflow_id) {
            workflow.verification_attempts += 1;

            // Simulate verification (in production, would check actual metrics)
            if workflow.verification_attempts <= config.verification_retries {
                // Success probability increases with retries
                return workflow.verification_attempts >= 2;
            }

            let mut metrics = self.metrics.write().await;
            metrics.verification_failures += 1;
            return false;
        }

        false
    }

    /// Update workflow state
    async fn update_workflow_state(&self, workflow_id: &str, new_state: WorkflowState) {
        let mut workflows = self.active_workflows.write().await;

        if let Some(workflow) = workflows.get_mut(workflow_id) {
            workflow.state = new_state.clone();
            workflow.updated_at = Utc::now();

            workflow.steps.push(WorkflowStep {
                step_name: format!("{:?}", new_state),
                state: StepState::Completed,
                timestamp: Utc::now(),
                error: None,
            });
        }
    }

    /// Get metrics
    pub async fn get_metrics(&self) -> ControlMetrics {
        self.metrics.read().await.clone()
    }

    /// Get active workflows
    pub async fn get_active_workflows(&self) -> Vec<RecoveryWorkflow> {
        let workflows = self.active_workflows.read().await;
        workflows.values().cloned().collect()
    }

    /// Enable/disable kill switch
    pub async fn set_kill_switch(&self, enabled: bool) {
        let mut config = self.config.write().await;
        config.kill_switch_enabled = enabled;
    }

    /// Enable/disable shadow mode
    pub async fn set_shadow_mode(&self, enabled: bool) {
        let mut config = self.config.write().await;
        config.shadow_mode = enabled;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::predictive::forecast_engine::{ForecastEngineConfig};

    #[tokio::test]
    async fn test_control_core_creation() {
        let forecast_engine = Arc::new(RwLock::new(
            ForecastEngine::new(ForecastEngineConfig::default())
        ));

        let core = AutonomousControlCore::new(
            ControlConfig::default(),
            forecast_engine,
        );

        let metrics = core.get_metrics().await;
        assert_eq!(metrics.total_decisions, 0);
    }

    #[tokio::test]
    async fn test_kill_switch() {
        let forecast_engine = Arc::new(RwLock::new(
            ForecastEngine::new(ForecastEngineConfig::default())
        ));

        let core = AutonomousControlCore::new(
            ControlConfig::default(),
            forecast_engine,
        );

        // Enable kill switch
        core.set_kill_switch(true).await;

        // Evaluate should return no decisions
        let decisions = core.evaluate().await.unwrap();
        assert_eq!(decisions.len(), 0);
    }

    #[tokio::test]
    async fn test_shadow_mode() {
        let forecast_engine = Arc::new(RwLock::new(
            ForecastEngine::new(ForecastEngineConfig::default())
        ));

        let core = AutonomousControlCore::new(
            ControlConfig::default(),
            forecast_engine,
        );

        core.set_shadow_mode(true).await;

        let decision = ControlDecision {
            decision_type: DecisionType::ScaleUp,
            target: "test".to_string(),
            reason: "test".to_string(),
            confidence: 0.9,
            timestamp: Utc::now(),
            workflow_id: "test_123".to_string(),
            shadow_mode: true,
        };

        let result = core.execute(&decision).await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains("SHADOW"));
    }

    #[tokio::test]
    async fn test_scale_up_execution() {
        let forecast_engine = Arc::new(RwLock::new(
            ForecastEngine::new(ForecastEngineConfig::default())
        ));

        let core = AutonomousControlCore::new(
            ControlConfig::default(),
            forecast_engine,
        );

        let decision = ControlDecision {
            decision_type: DecisionType::ScaleUp,
            target: "cpu_usage".to_string(),
            reason: "High CPU predicted".to_string(),
            confidence: 0.92,
            timestamp: Utc::now(),
            workflow_id: format!("scale_{}", Utc::now().timestamp()),
            shadow_mode: false,
        };

        let result = core.execute(&decision).await;
        assert!(result.is_ok());

        let metrics = core.get_metrics().await;
        assert_eq!(metrics.auto_scale_actions, 1);
    }

    #[tokio::test]
    async fn test_workflow_tracking() {
        let forecast_engine = Arc::new(RwLock::new(
            ForecastEngine::new(ForecastEngineConfig::default())
        ));

        let core = AutonomousControlCore::new(
            ControlConfig::default(),
            forecast_engine,
        );

        let decision = ControlDecision {
            decision_type: DecisionType::RecoverNode,
            target: "node1".to_string(),
            reason: "Node failure detected".to_string(),
            confidence: 0.95,
            timestamp: Utc::now(),
            workflow_id: format!("recover_{}", Utc::now().timestamp()),
            shadow_mode: false,
        };

        core.execute(&decision).await.ok();

        let workflows = core.get_active_workflows().await;
        assert_eq!(workflows.len(), 1);
        assert_eq!(workflows[0].state, WorkflowState::Completed);
    }
}
