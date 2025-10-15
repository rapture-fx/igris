//! Cognitive Advisory Proposal Schema
//!
//! Defines structured policy proposals for cognitive advisory mode, including
//! action_type, rationale, confidence_score, risk_score, and reward_delta_estimate.
//!
//! # Proposal Structure
//! - Action: Specific policy change recommendation
//! - Rationale: Human-readable explanation of why
//! - Confidence: 0.0-1.0 confidence in the recommendation
//! - Risk: Quantified risk assessment
//! - Reward: Expected improvement over current policy
//! - Evidence: Links to supporting reasoning and simulation data

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::cognitive::cognitive_control::{ReasoningOutput, RiskLevel};

/// Action types for policy proposals
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    /// Increase batch size for processing
    IncreaseBatchSize,
    /// Decrease batch size for resource constraints
    DecreaseBatchSize,
    /// Adjust traffic routing between services
    AdjustRouting,
    /// Modify prefetch confidence threshold
    AdjustPrefetch,
    /// Emergency rollback to safe baseline
    Rollback,
    /// No action recommended
    NoAction,
    /// Experimental or high-risk action
    Experimental,
}

/// Target policy parameters for the proposed action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyParameters {
    /// Target batch size (if applicable to action type)
    pub batch_size: Option<usize>,
    /// Target prefetch confidence threshold (0.0-1.0)
    pub prefetch_confidence: Option<f64>,
    /// Target routing split between services (0.0-1.0)
    pub routing_split: Option<f64>,
    /// Timeout adjustments in milliseconds
    pub timeout_ms: Option<u64>,
    /// Circuit breaker threshold adjustments
    pub circuit_breaker_threshold: Option<u32>,
    /// Additional custom parameters
    pub custom: HashMap<String, serde_json::Value>,
}

impl Default for PolicyParameters {
    fn default() -> Self {
        Self {
            batch_size: None,
            prefetch_confidence: None,
            routing_split: None,
            timeout_ms: None,
            circuit_breaker_threshold: None,
            custom: HashMap::new(),
        }
    }
}

/// Expected impact metrics for the proposed action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpectedImpact {
    /// Expected latency change in milliseconds (negative = improvement)
    pub latency_delta_ms: f64,
    /// Expected throughput change in requests per second (positive = improvement)
    pub throughput_delta_rps: f64,
    /// Expected error rate change in percentage points (negative = improvement)
    pub error_rate_delta_percent: f64,
    /// Expected cost change in percentage (negative = savings)
    pub cost_delta_percent: f64,
    /// Expected cache hit rate change in percentage points (positive = improvement)
    pub cache_hit_rate_delta_percent: f64,
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

/// Comprehensive policy proposal from cognitive advisory system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyProposal {
    /// Unique proposal identifier
    pub proposal_id: String,

    /// Timestamp when proposal was generated
    pub timestamp_ms: u64,

    /// Proposed action parameters
    pub action_type: ActionType,
    pub target_parameters: PolicyParameters,

    /// Expected performance impact
    pub expected_impact: ExpectedImpact,

    /// Human-readable rationale for the proposal
    pub rationale: ProposalRationale,

    /// Confidence and risk assessment
    pub confidence_score: f64,
    pub risk_score: f64,

    /// Reward estimate over current policy
    pub reward_delta_estimate: f64,

    /// Supporting evidence and sources
    pub evidence: EvidenceLinks,

    /// Safety gate results
    pub safety_assessment: SafetyAssessment,

    /// Metadata about the proposal
    pub metadata: ProposalMetadata,
}

/// Detailed rationale explaining the proposal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalRationale {
    /// Primary reason for the proposal
    pub primary_reason: String,
    /// Supporting reasons and factors
    pub supporting_reasons: Vec<String>,
    /// Key observations from telemetry and analysis
    pub key_observations: Vec<String>,
    /// Trade-offs and considerations
    pub trade_offs: Vec<String>,
    /// Why this action is preferred over alternatives
    pub preference_justification: String,
}

/// Links to supporting evidence and reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceLinks {
    /// Reference to cognitive reasoning output (if available)
    pub reasoning_output_id: Option<String>,
    /// Path to reasoning output file
    pub reasoning_file_path: Option<String>,
    /// Reference to simulation comparison results
    pub simulation_comparison_id: Option<String>,
    /// Path to simulation results file
    pub simulation_file_path: Option<String>,
    /// Additional evidence references
    pub additional_evidence: Vec<EvidenceReference>,
}

/// Individual evidence reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceReference {
    /// Type of evidence
    pub evidence_type: EvidenceType,
    /// Reference identifier or path
    pub reference: String,
    /// Brief description of what this evidence supports
    pub description: String,
}

/// Types of supporting evidence
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceType {
    /// Cognitive reasoning output
    ReasoningOutput,
    /// Shadow simulation results
    SimulationResults,
    /// Telemetry snapshot
    TelemetrySnapshot,
    /// Forecast prediction
    ForecastPrediction,
    /// Statistical analysis
    StatisticalAnalysis,
    /// Historical trends
    HistoricalTrends,
    /// Manual configuration
    ManualOverride,
}

/// Safety assessment for the proposal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyAssessment {
    /// Overall safety level
    pub safety_level: SafetyLevel,
    /// Confidence gate validation
    pub confidence_gate_passed: bool,
    /// Drift gate validation
    pub drift_gate_passed: bool,
    /// Risk gate validation
    pub risk_gate_passed: bool,
    /// Resource gate validation
    pub resource_gate_passed: bool,
    /// Anomaly gate validation
    pub anomaly_gate_passed: bool,
    /// Identified safety concerns
    pub safety_concerns: Vec<String>,
    /// Recommended safety precautions
    pub safety_precautions: Vec<String>,
}

/// Safety level classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SafetyLevel {
    /// Extremely safe, minimal risk
    VerySafe,
    /// Safe within normal parameters
    Safe,
    /// Minor concerns, requires monitoring
    Caution,
    /// Significant concerns, human review recommended
    Risky,
    /// Too dangerous for advisory mode
    Unsafe,
}

/// Metadata about the proposal generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalMetadata {
    /// Cognitive engine version
    pub cognitive_version: String,
    /// Proposal schema version
    pub schema_version: String,
    /// Processing latency in milliseconds
    pub generation_latency_ms: f64,
    /// System state snapshot at generation time
    pub system_state: SystemState,
    /// Tags and categorization
    pub tags: Vec<String>,
    /// Custom metadata fields
    pub custom: HashMap<String, String>,
}

/// System state snapshot at proposal generation time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemState {
    /// Current CPU utilization (0.0-1.0)
    pub cpu_utilization: f64,
    /// Current memory utilization (0.0-1.0)
    pub memory_utilization: f64,
    /// Current average latency in milliseconds
    pub avg_latency_ms: f64,
    /// Current error rate (0.0-1.0)
    pub error_rate: f64,
    /// Current throughput in requests per second
    pub current_throughput_rps: f64,
    /// Number of recent rollbacks (past hour)
    pub recent_rollbacks: u32,
    /// System stability score (0.0-1.0)
    pub stability_score: f64,
}

impl PolicyProposal {
    /// Create a new proposal with generated ID and timestamp
    pub fn new(action_type: ActionType) -> Self {
        let proposal_id = Self::generate_proposal_id();
        let timestamp_ms = Self::current_timestamp_ms();

        Self {
            proposal_id,
            timestamp_ms,
            action_type,
            target_parameters: PolicyParameters::default(),
            expected_impact: ExpectedImpact::default(),
            rationale: ProposalRationale::default(),
            confidence_score: 0.0,
            risk_score: 0.0,
            reward_delta_estimate: 0.0,
            evidence: EvidenceLinks::default(),
            safety_assessment: SafetyAssessment::default(),
            metadata: ProposalMetadata::default(),
        }
    }

    /// Check if proposal meets safety criteria for advisory output
    pub fn meets_safety_criteria(&self) -> bool {
        self.confidence_score >= 0.85
            && self.risk_score <= 0.15
            && self.safety_assessment.safety_level != SafetyLevel::Unsafe
    }

    /// Check if proposal requires human review
    pub fn requires_human_review(&self) -> bool {
        self.confidence_score < 0.90
            || self.risk_score > 0.10
            || self.safety_assessment.safety_level == SafetyLevel::Risky
            || !self.safety_assessment.confidence_gate_passed
            || !self.safety_assessment.risk_gate_passed
    }

    /// Serialize proposal to JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Serialize proposal to JSON bytes
    pub fn to_json_bytes(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    /// Generate unique proposal ID
    fn generate_proposal_id() -> String {
        use std::time::SystemTime;
        let now = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap();
        format!("cognitive_proposal_{}", now.as_nanos())
    }

    /// Get current timestamp in milliseconds
    fn current_timestamp_ms() -> u64 {
        use std::time::SystemTime;
        SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

impl Default for PolicyProposal {
    fn default() -> Self {
        Self::new(ActionType::NoAction)
    }
}

impl Default for ProposalRationale {
    fn default() -> Self {
        Self {
            primary_reason: "No specific rationale provided".to_string(),
            supporting_reasons: Vec::new(),
            key_observations: Vec::new(),
            trade_offs: Vec::new(),
            preference_justification: "Default policy".to_string(),
        }
    }
}

impl Default for EvidenceLinks {
    fn default() -> Self {
        Self {
            reasoning_output_id: None,
            reasoning_file_path: None,
            simulation_comparison_id: None,
            simulation_file_path: None,
            additional_evidence: Vec::new(),
        }
    }
}

impl Default for SafetyAssessment {
    fn default() -> Self {
        Self {
            safety_level: SafetyLevel::Safe,
            confidence_gate_passed: false,
            drift_gate_passed: false,
            risk_gate_passed: false,
            resource_gate_passed: false,
            anomaly_gate_passed: false,
            safety_concerns: Vec::new(),
            safety_precautions: vec![
                "Monitor performance metrics closely after implementation".to_string(),
                "Have rollback plan ready if issues occur".to_string(),
            ],
        }
    }
}

impl Default for ProposalMetadata {
    fn default() -> Self {
        Self {
            cognitive_version: "11.5.0".to_string(),
            schema_version: "1.0.0".to_string(),
            generation_latency_ms: 0.0,
            system_state: SystemState::default(),
            tags: vec!["cognitive".to_string(), "advisory".to_string()],
            custom: HashMap::new(),
        }
    }
}

impl Default for SystemState {
    fn default() -> Self {
        Self {
            cpu_utilization: 0.0,
            memory_utilization: 0.0,
            avg_latency_ms: 0.0,
            error_rate: 0.0,
            current_throughput_rps: 0.0,
            recent_rollbacks: 0,
            stability_score: 1.0,
        }
    }
}

/// Conversion from ActionType to string representation
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

/// Conversion from RiskLevel to safety score (0.0 = safest, 1.0 = riskiest)
impl From<RiskLevel> for f64 {
    fn from(risk: RiskLevel) -> f64 {
        match risk {
            RiskLevel::Low => 0.1,
            RiskLevel::Medium => 0.3,
            RiskLevel::High => 0.7,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proposal_creation() {
        let proposal = PolicyProposal::new(ActionType::IncreaseBatchSize);
        assert_eq!(proposal.action_type, ActionType::IncreaseBatchSize);
        assert!(!proposal.proposal_id.is_empty());
        assert!(proposal.timestamp_ms > 0);
    }

    #[test]
    fn test_safety_criteria_validation() {
        let mut proposal = PolicyProposal::new(ActionType::IncreaseBatchSize);
        
        // Should not meet criteria with default values
        assert!(!proposal.meets_safety_criteria());
        
        // Set high confidence, low risk
        proposal.confidence_score = 0.95;
        proposal.risk_score = 0.10;
        proposal.safety_assessment.safety_level = SafetyLevel::Safe;
        
        assert!(proposal.meets_safety_criteria());
    }

    #[test]
    fn test_human_review_requirements() {
        let proposal = PolicyProposal::new(ActionType::IncreaseBatchSize);
        
        // Low confidence should require review
        proposal.confidence_score = 0.80;
        assert!(proposal.requires_human_review());
        
        // High confidence should not require review
        proposal.confidence_score = 0.95;
        proposal.risk_score = 0.05;
        proposal.safety_assessment.confidence_gate_passed = true;
        proposal.safety_assessment.risk_gate_passed = true;
        assert!(!proposal.requires_human_review());
    }

    #[test]
    fn test_json_serialization() {
        let proposal = PolicyProposal::new(ActionType::DecreaseBatchSize);
        let json = proposal.to_json().unwrap();
        
        // Should contain action type and proposal ID
        assert!(json.contains("decrease_batch_size"));
        assert!(json.contains("cognitive_proposal_"));
        
        // Round trip should work
        let deserialized: PolicyProposal = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.action_type, ActionType::DecreaseBatchSize);
    }

    #[test]
    fn test_risk_level_conversion() {
        let low_risk: f64 = RiskLevel::Low.into();
        assert_eq!(low_risk, 0.1);
        
        let medium_risk: f64 = RiskLevel::Medium.into();
        assert_eq!(medium_risk, 0.3);
        
        let high_risk: f64 = RiskLevel::High.into();
        assert_eq!(high_risk, 0.7);
    }

    #[test]
    fn test_action_type_display() {
        assert_eq!(ActionType::IncreaseBatchSize.to_string(), "increase_batch_size");
        assert_eq!(ActionType::Rollback.to_string(), "rollback");
        assert_eq!(ActionType::NoAction.to_string(), "no_action");
    }
}
