//! Reasoning Schema - Structured Format for Cognitive Reasoning Output
//!
//! Defines the data structures for explainable policy decisions,
//! including rationale, confidence scores, and risk assessments.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Structured reasoning output from the cognitive control layer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningOutput {
    /// Unique reasoning ID
    pub reasoning_id: String,

    /// Timestamp when reasoning was generated
    pub timestamp_ms: u64,

    /// Recommended action (shadow-only, never executed)
    pub recommended_action: PolicyAction,

    /// Human-readable rationale for the decision
    pub rationale: Rationale,

    /// Overall confidence score (0.0-1.0)
    pub confidence_score: f64,

    /// Risk assessment for the recommended action
    pub risk_assessment: RiskAssessment,

    /// Source signals that informed this reasoning
    pub source_signals: SourceSignals,

    /// Alternative actions considered
    pub alternatives_considered: Vec<AlternativeAction>,

    /// Shadow mode metadata
    pub shadow_metadata: ShadowMetadata,
}

/// Recommended policy action (shadow-only)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyAction {
    /// Action type
    pub action_type: ActionType,

    /// Target policy parameters
    pub target_parameters: PolicyParameters,

    /// Expected impact of this action
    pub expected_impact: ExpectedImpact,
}

/// Types of policy actions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    /// Increase batch size
    IncreaseBatchSize,

    /// Decrease batch size
    DecreaseBatchSize,

    /// Adjust traffic routing split
    AdjustRouting,

    /// Modify prefetch confidence threshold
    AdjustPrefetch,

    /// Perform rollback to baseline
    Rollback,

    /// No action recommended
    NoAction,

    /// Experimental action (high risk)
    Experimental,
}

/// Target policy parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyParameters {
    /// Target batch size (if applicable)
    pub batch_size: Option<usize>,

    /// Target prefetch confidence (if applicable)
    pub prefetch_confidence: Option<f64>,

    /// Target routing split (if applicable)
    pub routing_split: Option<f64>,

    /// Timeout adjustments (ms)
    pub timeout_ms: Option<u64>,

    /// Circuit breaker threshold
    pub circuit_breaker_threshold: Option<u32>,
}

/// Expected impact of the action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpectedImpact {
    /// Expected latency change (ms, negative = improvement)
    pub latency_delta_ms: f64,

    /// Expected throughput change (rps, positive = improvement)
    pub throughput_delta_rps: f64,

    /// Expected error rate change (percent, negative = improvement)
    pub error_rate_delta_percent: f64,

    /// Expected cost change (percent, negative = improvement)
    pub cost_delta_percent: f64,

    /// Expected cache hit rate change (percent, positive = improvement)
    pub cache_hit_rate_delta_percent: f64,
}

/// Human-readable rationale for the decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rationale {
    /// Primary reason for the decision
    pub primary_reason: String,

    /// Supporting reasons
    pub supporting_reasons: Vec<String>,

    /// Key observations from telemetry
    pub key_observations: Vec<String>,

    /// Trade-offs considered
    pub tradeoffs: Vec<String>,

    /// Why this action is preferred over alternatives
    pub preference_justification: String,
}

/// Risk assessment for the recommended action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    /// Overall risk level
    pub risk_level: RiskLevel,

    /// Rollback risk (0.0-1.0, probability action requires rollback)
    pub rollback_risk: f64,

    /// Performance degradation risk (0.0-1.0)
    pub performance_degradation_risk: f64,

    /// Service disruption risk (0.0-1.0)
    pub disruption_risk: f64,

    /// Identified risk factors
    pub risk_factors: Vec<String>,

    /// Mitigation strategies
    pub mitigation_strategies: Vec<String>,

    /// Maximum acceptable drift (percent)
    pub max_acceptable_drift: f64,
}

/// Risk level categories
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    /// Very low risk, high confidence
    VeryLow,

    /// Low risk, safe to apply
    Low,

    /// Moderate risk, requires careful monitoring
    Moderate,

    /// High risk, shadow evaluation strongly recommended
    High,

    /// Very high risk, likely requires human review
    VeryHigh,

    /// Critical risk, do not apply
    Critical,
}

/// Source signals that informed the reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceSignals {
    /// Phase 11.1 RL agent decision
    pub rl_agent_decision: Option<RLAgentSignal>,

    /// Phase 11.2 predictive forecast
    pub predictive_forecast: Option<PredictiveForecastSignal>,

    /// Current telemetry snapshot
    pub current_telemetry: TelemetrySignal,

    /// Historical performance trends
    pub historical_trends: HistoricalTrends,

    /// Anomaly detection signals
    pub anomalies: Vec<AnomalySignal>,
}

/// RL agent signal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLAgentSignal {
    /// Agent's recommended batch size
    pub batch_size: usize,

    /// Agent's prefetch confidence
    pub prefetch_confidence: f64,

    /// Agent's routing split
    pub routing_split: f64,

    /// Agent's confidence
    pub confidence: f64,

    /// Expected reward improvement
    pub expected_reward_improvement: f64,

    /// Agent's reason
    pub reason: String,
}

/// Predictive forecast signal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictiveForecastSignal {
    /// Forecasted load (rps)
    pub forecasted_load_rps: f64,

    /// Forecasted latency (ms)
    pub forecasted_latency_ms: f64,

    /// Forecast confidence
    pub forecast_confidence: f64,

    /// Forecast horizon (minutes)
    pub horizon_minutes: u64,

    /// Proactive adjustment recommended
    pub proactive_adjustment: bool,
}

/// Current telemetry signal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetrySignal {
    /// Average latency (ms)
    pub avg_latency_ms: f64,

    /// P95 latency (ms)
    pub p95_latency_ms: f64,

    /// Cache hit rate (0.0-1.0)
    pub cache_hit_rate: f64,

    /// Throughput (rps)
    pub throughput_rps: f64,

    /// Error rate (0.0-1.0)
    pub error_rate: f64,

    /// CPU utilization (0.0-1.0)
    pub cpu_utilization: f64,

    /// Memory utilization (0.0-1.0)
    pub memory_utilization: f64,

    /// Cost efficiency (0.0-1.0)
    pub cost_efficiency: f64,
}

/// Historical performance trends
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalTrends {
    /// Latency trend (positive = increasing)
    pub latency_trend: TrendDirection,

    /// Throughput trend (positive = increasing)
    pub throughput_trend: TrendDirection,

    /// Error rate trend (positive = increasing)
    pub error_rate_trend: TrendDirection,

    /// Recent policy changes
    pub recent_policy_changes: usize,

    /// Recent rollbacks
    pub recent_rollbacks: usize,
}

/// Trend direction
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TrendDirection {
    StronglyIncreasing,
    Increasing,
    Stable,
    Decreasing,
    StronglyDecreasing,
}

/// Anomaly detection signal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalySignal {
    /// Anomaly type
    pub anomaly_type: String,

    /// Severity (0.0-1.0)
    pub severity: f64,

    /// Detected at timestamp
    pub detected_at_ms: u64,

    /// Description
    pub description: String,
}

/// Alternative action considered
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeAction {
    /// Alternative action type
    pub action_type: ActionType,

    /// Expected impact
    pub expected_impact: ExpectedImpact,

    /// Why this was not chosen
    pub rejection_reason: String,

    /// Confidence score for this alternative
    pub confidence: f64,
}

/// Shadow mode metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShadowMetadata {
    /// This is shadow-only, not executed
    pub shadow_only: bool,

    /// Reasoning version
    pub reasoning_version: String,

    /// Model version used
    pub model_version: String,

    /// Human review required
    pub requires_human_review: bool,

    /// Reasoning latency (ms)
    pub reasoning_latency_ms: f64,

    /// Additional tags for categorization
    pub tags: Vec<String>,

    /// Custom metadata
    pub custom: HashMap<String, String>,
}

impl ReasoningOutput {
    /// Create a new reasoning output with default values
    pub fn new(action_type: ActionType) -> Self {
        Self {
            reasoning_id: Self::generate_id(),
            timestamp_ms: Self::current_timestamp_ms(),
            recommended_action: PolicyAction {
                action_type,
                target_parameters: PolicyParameters::default(),
                expected_impact: ExpectedImpact::default(),
            },
            rationale: Rationale::default(),
            confidence_score: 0.0,
            risk_assessment: RiskAssessment::default(),
            source_signals: SourceSignals::default(),
            alternatives_considered: Vec::new(),
            shadow_metadata: ShadowMetadata::default(),
        }
    }

    /// Generate a unique reasoning ID
    fn generate_id() -> String {
        use std::time::SystemTime;
        let now = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap();
        format!("reasoning_{}", now.as_nanos())
    }

    /// Get current timestamp in milliseconds
    fn current_timestamp_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    /// Serialize to JSON string
    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize reasoning output: {}", e))
    }

    /// Deserialize from JSON string
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json)
            .map_err(|e| format!("Failed to deserialize reasoning output: {}", e))
    }
}

// Default implementations

impl Default for PolicyParameters {
    fn default() -> Self {
        Self {
            batch_size: None,
            prefetch_confidence: None,
            routing_split: None,
            timeout_ms: None,
            circuit_breaker_threshold: None,
        }
    }
}

impl Default for ExpectedImpact {
    fn default() -> Self {
        Self {
            latency_delta_ms: 0.0,
            throughput_delta_rps: 0.0,
            error_rate_delta_percent: 0.0,
            cost_delta_percent: 0.0,
            cache_hit_rate_delta_percent: 0.0,
        }
    }
}

impl Default for Rationale {
    fn default() -> Self {
        Self {
            primary_reason: "No specific reason provided".to_string(),
            supporting_reasons: Vec::new(),
            key_observations: Vec::new(),
            tradeoffs: Vec::new(),
            preference_justification: "Default preference".to_string(),
        }
    }
}

impl Default for RiskAssessment {
    fn default() -> Self {
        Self {
            risk_level: RiskLevel::Moderate,
            rollback_risk: 0.0,
            performance_degradation_risk: 0.0,
            disruption_risk: 0.0,
            risk_factors: Vec::new(),
            mitigation_strategies: Vec::new(),
            max_acceptable_drift: 5.0, // 5% default
        }
    }
}

impl Default for SourceSignals {
    fn default() -> Self {
        Self {
            rl_agent_decision: None,
            predictive_forecast: None,
            current_telemetry: TelemetrySignal::default(),
            historical_trends: HistoricalTrends::default(),
            anomalies: Vec::new(),
        }
    }
}

impl Default for TelemetrySignal {
    fn default() -> Self {
        Self {
            avg_latency_ms: 0.0,
            p95_latency_ms: 0.0,
            cache_hit_rate: 0.0,
            throughput_rps: 0.0,
            error_rate: 0.0,
            cpu_utilization: 0.0,
            memory_utilization: 0.0,
            cost_efficiency: 0.0,
        }
    }
}

impl Default for HistoricalTrends {
    fn default() -> Self {
        Self {
            latency_trend: TrendDirection::Stable,
            throughput_trend: TrendDirection::Stable,
            error_rate_trend: TrendDirection::Stable,
            recent_policy_changes: 0,
            recent_rollbacks: 0,
        }
    }
}

impl Default for ShadowMetadata {
    fn default() -> Self {
        Self {
            shadow_only: true,
            reasoning_version: "1.0.0".to_string(),
            model_version: "cognitive-v1".to_string(),
            requires_human_review: false,
            reasoning_latency_ms: 0.0,
            tags: vec!["shadow".to_string(), "cognitive".to_string()],
            custom: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reasoning_output_creation() {
        let output = ReasoningOutput::new(ActionType::IncreaseBatchSize);
        assert_eq!(output.recommended_action.action_type, ActionType::IncreaseBatchSize);
        assert!(output.shadow_metadata.shadow_only);
    }

    #[test]
    fn test_reasoning_output_serialization() {
        let output = ReasoningOutput::new(ActionType::NoAction);
        let json = output.to_json().unwrap();
        assert!(json.contains("no_action"));
        assert!(json.contains("shadow_only"));
    }

    #[test]
    fn test_reasoning_output_deserialization() {
        let output = ReasoningOutput::new(ActionType::AdjustRouting);
        let json = output.to_json().unwrap();
        let deserialized = ReasoningOutput::from_json(&json).unwrap();
        assert_eq!(deserialized.recommended_action.action_type, ActionType::AdjustRouting);
    }

    #[test]
    fn test_risk_level_ordering() {
        assert_eq!(RiskLevel::VeryLow, RiskLevel::VeryLow);
        assert_ne!(RiskLevel::Low, RiskLevel::High);
    }

    #[test]
    fn test_policy_parameters_defaults() {
        let params = PolicyParameters::default();
        assert!(params.batch_size.is_none());
        assert!(params.prefetch_confidence.is_none());
    }

    #[test]
    fn test_expected_impact_defaults() {
        let impact = ExpectedImpact::default();
        assert_eq!(impact.latency_delta_ms, 0.0);
        assert_eq!(impact.throughput_delta_rps, 0.0);
    }
}
