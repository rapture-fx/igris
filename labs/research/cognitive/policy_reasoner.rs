//! Policy Reasoner - Cognitive Control Layer
//!
//! Generates explainable policy decisions by synthesizing signals from:
//! - Phase 11.1: RL agent policy outputs
//! - Phase 11.2: Predictive forecast signals
//! - Current telemetry and historical trends
//!
//! This module operates in SHADOW-ONLY mode: it produces reasoning artifacts
//! but does NOT execute actions or mutate live policies.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use std::collections::VecDeque;
use std::time::Instant;

use crate::cognitive::reasoning_schema::*;
use crate::rl::rl_agent::{AgentDecision};
use crate::orchestration::policy_engine::{TelemetrySnapshot, PolicyUpdate};

/// Configuration for the policy reasoner
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasonerConfig {
    /// Enable cognitive reasoning
    pub enabled: bool,

    /// Minimum confidence threshold for high-confidence decisions
    pub high_confidence_threshold: f64,

    /// Rollback risk threshold (above this requires human review)
    pub rollback_risk_threshold: f64,

    /// Output directory for reasoning artifacts
    pub output_dir: String,

    /// Enable automatic JSON export
    pub auto_export: bool,

    /// Maximum reasoning history size
    pub max_history_size: usize,

    /// Enable verbose logging
    pub verbose: bool,
}

impl Default for ReasonerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            high_confidence_threshold: 0.90,
            rollback_risk_threshold: 0.15,
            output_dir: "experiments/cognitive".to_string(),
            auto_export: true,
            max_history_size: 100,
            verbose: false,
        }
    }
}

/// Cognitive policy reasoner
pub struct PolicyReasoner {
    config: Arc<RwLock<ReasonerConfig>>,
    reasoning_history: Arc<RwLock<VecDeque<ReasoningOutput>>>,
    telemetry_history: Arc<RwLock<VecDeque<TelemetrySnapshot>>>,
    metrics: Arc<RwLock<ReasonerMetrics>>,
}

/// Reasoner metrics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasonerMetrics {
    /// Total reasonings generated
    pub total_reasonings: u64,

    /// High confidence reasonings
    pub high_confidence_count: u64,

    /// Low confidence reasonings
    pub low_confidence_count: u64,

    /// Reasonings requiring human review
    pub human_review_required_count: u64,

    /// Average reasoning latency (ms)
    pub avg_reasoning_latency_ms: f64,

    /// Average confidence score
    pub avg_confidence: f64,

    /// Average rollback risk
    pub avg_rollback_risk: f64,

    /// Artifacts exported
    pub artifacts_exported: u64,
}

impl Default for ReasonerMetrics {
    fn default() -> Self {
        Self {
            total_reasonings: 0,
            high_confidence_count: 0,
            low_confidence_count: 0,
            human_review_required_count: 0,
            avg_reasoning_latency_ms: 0.0,
            avg_confidence: 0.0,
            avg_rollback_risk: 0.0,
            artifacts_exported: 0,
        }
    }
}

impl PolicyReasoner {
    /// Create a new policy reasoner
    pub fn new(config: ReasonerConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            reasoning_history: Arc::new(RwLock::new(VecDeque::new())),
            telemetry_history: Arc::new(RwLock::new(VecDeque::new())),
            metrics: Arc::new(RwLock::new(ReasonerMetrics::default())),
        }
    }

    /// Ingest telemetry for historical context
    pub fn ingest_telemetry(&self, telemetry: TelemetrySnapshot) {
        let mut history = self.telemetry_history.write().unwrap();
        history.push_back(telemetry);

        // Maintain history size
        while history.len() > 100 {
            history.pop_front();
        }
    }

    /// Generate cognitive reasoning for policy decision
    ///
    /// SHADOW-ONLY: This function only generates reasoning artifacts.
    /// It does NOT apply policies or mutate orchestrator state.
    pub fn generate_reasoning(
        &self,
        rl_decision: Option<&AgentDecision>,
        current_telemetry: &TelemetrySnapshot,
        baseline_policy: &PolicyUpdate,
    ) -> Result<ReasoningOutput, String> {
        let start = Instant::now();
        let config = self.config.read().unwrap();

        if !config.enabled {
            return Err("Cognitive reasoner disabled".to_string());
        }

        // Build source signals
        let source_signals = self.build_source_signals(
            rl_decision,
            current_telemetry,
        );

        // Determine recommended action
        let (action_type, target_parameters) = self.determine_action(
            rl_decision,
            current_telemetry,
            baseline_policy,
        );

        // Compute expected impact
        let expected_impact = self.compute_expected_impact(
            &action_type,
            &target_parameters,
            current_telemetry,
        );

        // Generate rationale
        let rationale = self.generate_rationale(
            &action_type,
            rl_decision,
            current_telemetry,
            &source_signals,
        );

        // Assess risk
        let risk_assessment = self.assess_risk(
            &action_type,
            &expected_impact,
            current_telemetry,
            &source_signals,
        );

        // Compute overall confidence
        let confidence_score = self.compute_confidence(
            rl_decision,
            &risk_assessment,
            &source_signals,
        );

        // Consider alternatives
        let alternatives = self.generate_alternatives(
            &action_type,
            current_telemetry,
        );

        // Build shadow metadata
        let reasoning_latency = start.elapsed().as_secs_f64() * 1000.0;
        let requires_review = risk_assessment.rollback_risk > config.rollback_risk_threshold
            || confidence_score < config.high_confidence_threshold;

        let shadow_metadata = ShadowMetadata {
            shadow_only: true,
            reasoning_version: "1.0.0".to_string(),
            model_version: "cognitive-v1".to_string(),
            requires_human_review: requires_review,
            reasoning_latency_ms: reasoning_latency,
            tags: vec![
                "shadow".to_string(),
                "cognitive".to_string(),
                format!("risk_{}", risk_assessment.risk_level.to_string()),
            ],
            custom: std::collections::HashMap::new(),
        };

        let reasoning_output = ReasoningOutput {
            reasoning_id: self.generate_reasoning_id(),
            timestamp_ms: Self::current_timestamp_ms(),
            recommended_action: PolicyAction {
                action_type: action_type.clone(),
                target_parameters,
                expected_impact,
            },
            rationale,
            confidence_score,
            risk_assessment,
            source_signals,
            alternatives_considered: alternatives,
            shadow_metadata,
        };

        // Store in history
        self.add_to_history(reasoning_output.clone());

        // Update metrics
        self.update_metrics(&reasoning_output, reasoning_latency);

        // Auto-export if enabled
        if config.auto_export {
            self.export_reasoning(&reasoning_output)?;
        }

        Ok(reasoning_output)
    }

    /// Build source signals from available inputs
    fn build_source_signals(
        &self,
        rl_decision: Option<&AgentDecision>,
        current_telemetry: &TelemetrySnapshot,
    ) -> SourceSignals {
        let rl_signal = rl_decision.map(|decision| RLAgentSignal {
            batch_size: decision.batch_size,
            prefetch_confidence: decision.prefetch_confidence,
            routing_split: decision.routing_split,
            confidence: decision.confidence,
            expected_reward_improvement: decision.expected_reward_improvement,
            reason: decision.reason.clone(),
        });

        let telemetry_signal = TelemetrySignal {
            avg_latency_ms: current_telemetry.avg_latency_ms,
            p95_latency_ms: current_telemetry.p95_latency_ms,
            cache_hit_rate: current_telemetry.cache_hit_rate,
            throughput_rps: current_telemetry.throughput_rps,
            error_rate: current_telemetry.error_rate,
            cpu_utilization: current_telemetry.cpu_utilization,
            memory_utilization: current_telemetry.memory_utilization,
            cost_efficiency: current_telemetry.cost_efficiency,
        };

        let historical_trends = self.analyze_trends();

        SourceSignals {
            rl_agent_decision: rl_signal,
            predictive_forecast: None, // TODO: Integrate Phase 11.2 forecasts
            current_telemetry: telemetry_signal,
            historical_trends,
            anomalies: self.detect_anomalies(current_telemetry),
        }
    }

    /// Determine recommended action based on all signals
    fn determine_action(
        &self,
        rl_decision: Option<&AgentDecision>,
        current_telemetry: &TelemetrySnapshot,
        _baseline_policy: &PolicyUpdate,
    ) -> (ActionType, PolicyParameters) {
        // Priority 1: Handle critical states
        if current_telemetry.error_rate > 0.10 {
            return (
                ActionType::Rollback,
                PolicyParameters::default(),
            );
        }

        // Priority 2: High resource pressure
        if current_telemetry.cpu_utilization > 0.90 || current_telemetry.memory_utilization > 0.90 {
            return (
                ActionType::DecreaseBatchSize,
                PolicyParameters {
                    batch_size: Some(16),
                    ..Default::default()
                },
            );
        }

        // Priority 3: Follow RL agent if available and confident
        if let Some(decision) = rl_decision {
            if decision.should_apply && decision.confidence > 0.85 {
                let action = if decision.batch_size > 32 {
                    ActionType::IncreaseBatchSize
                } else {
                    ActionType::AdjustRouting
                };

                return (
                    action,
                    PolicyParameters {
                        batch_size: Some(decision.batch_size),
                        prefetch_confidence: Some(decision.prefetch_confidence),
                        routing_split: Some(decision.routing_split),
                        ..Default::default()
                    },
                );
            }
        }

        // Priority 4: Maintain stability
        (ActionType::NoAction, PolicyParameters::default())
    }

    /// Compute expected impact of the action
    fn compute_expected_impact(
        &self,
        action_type: &ActionType,
        target_params: &PolicyParameters,
        current_telemetry: &TelemetrySnapshot,
    ) -> ExpectedImpact {
        match action_type {
            ActionType::IncreaseBatchSize => {
                // Larger batches: better throughput, slightly higher latency
                ExpectedImpact {
                    latency_delta_ms: 5.0,
                    throughput_delta_rps: 15.0,
                    error_rate_delta_percent: 0.0,
                    cost_delta_percent: -2.0,
                    cache_hit_rate_delta_percent: 1.0,
                }
            }
            ActionType::DecreaseBatchSize => {
                // Smaller batches: lower latency, reduced throughput
                ExpectedImpact {
                    latency_delta_ms: -8.0,
                    throughput_delta_rps: -10.0,
                    error_rate_delta_percent: -0.5,
                    cost_delta_percent: 1.0,
                    cache_hit_rate_delta_percent: -0.5,
                }
            }
            ActionType::AdjustRouting => {
                ExpectedImpact {
                    latency_delta_ms: -3.0,
                    throughput_delta_rps: 5.0,
                    error_rate_delta_percent: -1.0,
                    cost_delta_percent: 0.0,
                    cache_hit_rate_delta_percent: 0.0,
                }
            }
            ActionType::Rollback => {
                ExpectedImpact {
                    latency_delta_ms: -(current_telemetry.avg_latency_ms - 100.0),
                    throughput_delta_rps: 0.0,
                    error_rate_delta_percent: -current_telemetry.error_rate * 100.0,
                    cost_delta_percent: 0.0,
                    cache_hit_rate_delta_percent: 0.0,
                }
            }
            _ => ExpectedImpact::default(),
        }
    }

    /// Generate human-readable rationale
    fn generate_rationale(
        &self,
        action_type: &ActionType,
        rl_decision: Option<&AgentDecision>,
        current_telemetry: &TelemetrySnapshot,
        source_signals: &SourceSignals,
    ) -> Rationale {
        let primary_reason = match action_type {
            ActionType::IncreaseBatchSize => {
                format!("System has capacity for larger batches (CPU: {:.1}%, latency: {:.1}ms)",
                    current_telemetry.cpu_utilization * 100.0,
                    current_telemetry.avg_latency_ms)
            }
            ActionType::DecreaseBatchSize => {
                "High resource utilization detected, reducing batch size for stability".to_string()
            }
            ActionType::Rollback => {
                format!("Critical error rate ({:.2}%) requires rollback to baseline",
                    current_telemetry.error_rate * 100.0)
            }
            ActionType::NoAction => {
                "System performance is stable, no action needed".to_string()
            }
            _ => "Action determined by cognitive analysis".to_string(),
        };

        let mut supporting_reasons = Vec::new();
        if let Some(rl) = &source_signals.rl_agent_decision {
            supporting_reasons.push(format!(
                "RL agent suggests batch={}, confidence={:.2}",
                rl.batch_size, rl.confidence
            ));
        }

        let key_observations = vec![
            format!("Latency: {:.1}ms (P95: {:.1}ms)",
                current_telemetry.avg_latency_ms,
                current_telemetry.p95_latency_ms),
            format!("Cache hit rate: {:.1}%",
                current_telemetry.cache_hit_rate * 100.0),
            format!("Error rate: {:.2}%",
                current_telemetry.error_rate * 100.0),
        ];

        let tradeoffs = vec![
            "Larger batches improve throughput but may increase latency".to_string(),
            "Smaller batches reduce latency but may decrease cost efficiency".to_string(),
        ];

        let preference_justification = format!(
            "Chosen {} based on current system state and historical performance",
            action_type.to_string()
        );

        Rationale {
            primary_reason,
            supporting_reasons,
            key_observations,
            tradeoffs,
            preference_justification,
        }
    }

    /// Assess risk of the recommended action
    fn assess_risk(
        &self,
        action_type: &ActionType,
        expected_impact: &ExpectedImpact,
        current_telemetry: &TelemetrySnapshot,
        source_signals: &SourceSignals,
    ) -> RiskAssessment {
        let rollback_risk = match action_type {
            ActionType::Rollback => 0.0, // Already rolling back
            ActionType::NoAction => 0.0,
            ActionType::IncreaseBatchSize => {
                if current_telemetry.cpu_utilization > 0.75 {
                    0.25
                } else {
                    0.10
                }
            }
            ActionType::DecreaseBatchSize => 0.05,
            ActionType::AdjustRouting => 0.15,
            _ => 0.20,
        };

        let performance_degradation_risk = if expected_impact.latency_delta_ms > 10.0 {
            0.30
        } else {
            0.10
        };

        let disruption_risk = if current_telemetry.error_rate > 0.05 {
            0.40
        } else {
            0.05
        };

        let risk_level = if rollback_risk > 0.30 || disruption_risk > 0.40 {
            RiskLevel::High
        } else if rollback_risk > 0.15 {
            RiskLevel::Moderate
        } else {
            RiskLevel::Low
        };

        let mut risk_factors = Vec::new();
        if current_telemetry.error_rate > 0.05 {
            risk_factors.push(format!("Elevated error rate: {:.2}%",
                current_telemetry.error_rate * 100.0));
        }
        if source_signals.historical_trends.recent_rollbacks > 2 {
            risk_factors.push("Multiple recent rollbacks detected".to_string());
        }

        let mitigation_strategies = vec![
            "Shadow evaluation on 0.5% traffic before full rollout".to_string(),
            "Automatic rollback on drift >5%".to_string(),
            "Continuous monitoring of key metrics".to_string(),
        ];

        RiskAssessment {
            risk_level,
            rollback_risk,
            performance_degradation_risk,
            disruption_risk,
            risk_factors,
            mitigation_strategies,
            max_acceptable_drift: 5.0,
        }
    }

    /// Compute overall confidence score
    fn compute_confidence(
        &self,
        rl_decision: Option<&AgentDecision>,
        risk_assessment: &RiskAssessment,
        _source_signals: &SourceSignals,
    ) -> f64 {
        let mut confidence = 0.7; // Base confidence

        // Boost from RL agent
        if let Some(decision) = rl_decision {
            if decision.should_apply {
                confidence += decision.confidence * 0.2;
            }
        }

        // Penalty from risk
        confidence -= risk_assessment.rollback_risk * 0.3;
        confidence -= risk_assessment.disruption_risk * 0.2;

        confidence.clamp(0.0, 1.0)
    }

    /// Generate alternative actions considered
    fn generate_alternatives(
        &self,
        chosen_action: &ActionType,
        _current_telemetry: &TelemetrySnapshot,
    ) -> Vec<AlternativeAction> {
        let mut alternatives = Vec::new();

        if *chosen_action != ActionType::NoAction {
            alternatives.push(AlternativeAction {
                action_type: ActionType::NoAction,
                expected_impact: ExpectedImpact::default(),
                rejection_reason: "Current action has higher expected benefit".to_string(),
                confidence: 0.60,
            });
        }

        alternatives
    }

    /// Analyze historical trends
    fn analyze_trends(&self) -> HistoricalTrends {
        let history = self.telemetry_history.read().unwrap();

        if history.len() < 2 {
            return HistoricalTrends::default();
        }

        // Simple trend analysis on recent data
        let recent: Vec<_> = history.iter().rev().take(10).collect();
        let latency_trend = self.compute_trend(recent.iter().map(|t| t.avg_latency_ms));

        HistoricalTrends {
            latency_trend,
            throughput_trend: TrendDirection::Stable,
            error_rate_trend: TrendDirection::Stable,
            recent_policy_changes: 0,
            recent_rollbacks: 0,
        }
    }

    /// Compute trend direction from values
    fn compute_trend<I>(&self, values: I) -> TrendDirection
    where
        I: Iterator<Item = f64>,
    {
        let values: Vec<f64> = values.collect();
        if values.len() < 2 {
            return TrendDirection::Stable;
        }

        let first_half_avg = values[..values.len() / 2].iter().sum::<f64>() / (values.len() / 2) as f64;
        let second_half_avg = values[values.len() / 2..].iter().sum::<f64>() / (values.len() - values.len() / 2) as f64;

        let change_percent = ((second_half_avg - first_half_avg) / first_half_avg) * 100.0;

        if change_percent > 10.0 {
            TrendDirection::StronglyIncreasing
        } else if change_percent > 3.0 {
            TrendDirection::Increasing
        } else if change_percent < -10.0 {
            TrendDirection::StronglyDecreasing
        } else if change_percent < -3.0 {
            TrendDirection::Decreasing
        } else {
            TrendDirection::Stable
        }
    }

    /// Detect anomalies in current telemetry
    fn detect_anomalies(&self, telemetry: &TelemetrySnapshot) -> Vec<AnomalySignal> {
        let mut anomalies = Vec::new();

        if telemetry.error_rate > 0.10 {
            anomalies.push(AnomalySignal {
                anomaly_type: "high_error_rate".to_string(),
                severity: telemetry.error_rate,
                detected_at_ms: Self::current_timestamp_ms(),
                description: format!("Error rate {:.2}% exceeds threshold", telemetry.error_rate * 100.0),
            });
        }

        if telemetry.avg_latency_ms > 300.0 {
            anomalies.push(AnomalySignal {
                anomaly_type: "high_latency".to_string(),
                severity: 0.7,
                detected_at_ms: Self::current_timestamp_ms(),
                description: format!("Latency {:.1}ms exceeds threshold", telemetry.avg_latency_ms),
            });
        }

        anomalies
    }

    /// Add reasoning to history
    fn add_to_history(&self, reasoning: ReasoningOutput) {
        let config = self.config.read().unwrap();
        let mut history = self.reasoning_history.write().unwrap();

        history.push_back(reasoning);

        while history.len() > config.max_history_size {
            history.pop_front();
        }
    }

    /// Update reasoner metrics
    fn update_metrics(&self, reasoning: &ReasoningOutput, latency_ms: f64) {
        let config = self.config.read().unwrap();
        let mut metrics = self.metrics.write().unwrap();

        metrics.total_reasonings += 1;

        if reasoning.confidence_score >= config.high_confidence_threshold {
            metrics.high_confidence_count += 1;
        } else {
            metrics.low_confidence_count += 1;
        }

        if reasoning.shadow_metadata.requires_human_review {
            metrics.human_review_required_count += 1;
        }

        let total = metrics.total_reasonings as f64;
        metrics.avg_reasoning_latency_ms =
            (metrics.avg_reasoning_latency_ms * (total - 1.0) + latency_ms) / total;
        metrics.avg_confidence =
            (metrics.avg_confidence * (total - 1.0) + reasoning.confidence_score) / total;
        metrics.avg_rollback_risk =
            (metrics.avg_rollback_risk * (total - 1.0) + reasoning.risk_assessment.rollback_risk) / total;
    }

    /// Export reasoning to JSON file
    fn export_reasoning(&self, reasoning: &ReasoningOutput) -> Result<(), String> {
        let config = self.config.read().unwrap();
        let json = reasoning.to_json()?;

        let file_path = format!(
            "{}/{}.json",
            config.output_dir,
            reasoning.reasoning_id
        );

        std::fs::write(&file_path, json)
            .map_err(|e| format!("Failed to write reasoning to {}: {}", file_path, e))?;

        let mut metrics = self.metrics.write().unwrap();
        metrics.artifacts_exported += 1;

        if config.verbose {
            println!("Exported reasoning to: {}", file_path);
        }

        Ok(())
    }

    /// Get reasoner metrics
    pub fn get_metrics(&self) -> ReasonerMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Get reasoning history
    pub fn get_history(&self) -> Vec<ReasoningOutput> {
        self.reasoning_history.read().unwrap().iter().cloned().collect()
    }

    /// Generate unique reasoning ID
    fn generate_reasoning_id(&self) -> String {
        format!("reasoning_{}", Self::current_timestamp_ms())
    }

    /// Get current timestamp in milliseconds
    fn current_timestamp_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

// Helper trait implementations

impl std::fmt::Display for ActionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ActionType::IncreaseBatchSize => write!(f, "increase_batch_size"),
            ActionType::DecreaseBatchSize => write!(f, "decrease_batch_size"),
            ActionType::AdjustRouting => write!(f, "adjust_routing"),
            ActionType::AdjustPrefetch => write!(f, "adjust_prefetch"),
            ActionType::Rollback => write!(f, "rollback"),
            ActionType::NoAction => write!(f, "no_action"),
            ActionType::Experimental => write!(f, "experimental"),
        }
    }
}

impl std::fmt::Display for RiskLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RiskLevel::VeryLow => write!(f, "very_low"),
            RiskLevel::Low => write!(f, "low"),
            RiskLevel::Moderate => write!(f, "moderate"),
            RiskLevel::High => write!(f, "high"),
            RiskLevel::VeryHigh => write!(f, "very_high"),
            RiskLevel::Critical => write!(f, "critical"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reasoner_creation() {
        let config = ReasonerConfig::default();
        let reasoner = PolicyReasoner::new(config);
        let metrics = reasoner.get_metrics();
        assert_eq!(metrics.total_reasonings, 0);
    }

    #[test]
    fn test_telemetry_ingestion() {
        let config = ReasonerConfig::default();
        let reasoner = PolicyReasoner::new(config);

        for _ in 0..5 {
            reasoner.ingest_telemetry(TelemetrySnapshot::default());
        }

        let history = reasoner.telemetry_history.read().unwrap();
        assert_eq!(history.len(), 5);
    }

    #[test]
    fn test_reasoning_generation_no_action() {
        let config = ReasonerConfig::default();
        let reasoner = PolicyReasoner::new(config);

        let telemetry = TelemetrySnapshot::default();
        let baseline = PolicyUpdate::default();

        let reasoning = reasoner.generate_reasoning(None, &telemetry, &baseline).unwrap();

        assert_eq!(reasoning.recommended_action.action_type, ActionType::NoAction);
        assert!(reasoning.shadow_metadata.shadow_only);
    }

    #[test]
    fn test_reasoning_generation_with_rl() {
        let config = ReasonerConfig::default();
        let reasoner = PolicyReasoner::new(config);

        let rl_decision = AgentDecision {
            batch_size: 64,
            prefetch_confidence: 0.90,
            routing_split: 0.85,
            confidence: 0.92,
            expected_reward_improvement: 0.05,
            timestamp_ms: 0,
            should_apply: true,
            reason: "test".to_string(),
        };

        let telemetry = TelemetrySnapshot::default();
        let baseline = PolicyUpdate::default();

        let reasoning = reasoner.generate_reasoning(Some(&rl_decision), &telemetry, &baseline).unwrap();

        assert!(reasoning.confidence_score > 0.0);
        assert!(reasoning.source_signals.rl_agent_decision.is_some());
    }

    #[test]
    fn test_critical_error_triggers_rollback() {
        let config = ReasonerConfig::default();
        let reasoner = PolicyReasoner::new(config);

        let telemetry = TelemetrySnapshot {
            error_rate: 0.15, // 15% error rate
            ..Default::default()
        };
        let baseline = PolicyUpdate::default();

        let reasoning = reasoner.generate_reasoning(None, &telemetry, &baseline).unwrap();

        assert_eq!(reasoning.recommended_action.action_type, ActionType::Rollback);
    }

    #[test]
    fn test_high_resource_triggers_batch_decrease() {
        let config = ReasonerConfig::default();
        let reasoner = PolicyReasoner::new(config);

        let telemetry = TelemetrySnapshot {
            cpu_utilization: 0.95,
            ..Default::default()
        };
        let baseline = PolicyUpdate::default();

        let reasoning = reasoner.generate_reasoning(None, &telemetry, &baseline).unwrap();

        assert_eq!(reasoning.recommended_action.action_type, ActionType::DecreaseBatchSize);
    }

    #[test]
    fn test_anomaly_detection() {
        let config = ReasonerConfig::default();
        let reasoner = PolicyReasoner::new(config);

        let telemetry = TelemetrySnapshot {
            error_rate: 0.12,
            avg_latency_ms: 350.0,
            ..Default::default()
        };

        let anomalies = reasoner.detect_anomalies(&telemetry);
        assert!(anomalies.len() >= 2); // Should detect both high error and high latency
    }

    #[test]
    fn test_metrics_tracking() {
        let config = ReasonerConfig {
            auto_export: false, // Disable export for test
            ..Default::default()
        };
        let reasoner = PolicyReasoner::new(config);

        let telemetry = TelemetrySnapshot::default();
        let baseline = PolicyUpdate::default();

        for _ in 0..3 {
            reasoner.generate_reasoning(None, &telemetry, &baseline).ok();
        }

        let metrics = reasoner.get_metrics();
        assert_eq!(metrics.total_reasonings, 3);
        assert!(metrics.avg_reasoning_latency_ms > 0.0);
    }

    #[test]
    fn test_trend_analysis() {
        let config = ReasonerConfig::default();
        let reasoner = PolicyReasoner::new(config);

        // Add telemetry with increasing latency
        for i in 1..=10 {
            let telemetry = TelemetrySnapshot {
                avg_latency_ms: 100.0 + (i as f64 * 10.0),
                ..Default::default()
            };
            reasoner.ingest_telemetry(telemetry);
        }

        let trends = reasoner.analyze_trends();
        assert!(trends.latency_trend == TrendDirection::Increasing ||
                trends.latency_trend == TrendDirection::StronglyIncreasing);
    }
}
