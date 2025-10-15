//! Cognitive Proposal Safety Gate Integration
//!
//! Enforces safety thresholds: confidence >= 0.85, drift <= 5%, risk <= 0.15
//! before emitting proposals. Integrates with the policy safety framework.
//!
//! # Safety Gates
//! - Confidence Gate: Minimum confidence for proposal generation
//! - Drift Gate: Maximum allowable performance change
//! - Risk Gate: Maximum acceptable risk level
//! - Resource Gate: Resource utilization constraints
//! - Anomaly Gate: System anomaly detection

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::cognitive::proposal_schema::{
    PolicyProposal, SafetyAssessment, SafetyLevel, SafetyGateResult,
    EvidenceReference, EvidenceType, SystemState
};
use crate::cognitive::cognitive_control::{ReasoningOutput, RiskLevel};
use crate::cognitive::proposal_engine::{ProposalInput, TelemetrySnapshot};

/// Safety gate configuration for proposals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalSafetyConfig {
    /// Minimum confidence threshold for proposals
    pub min_confidence: f64,
    
    /// Maximum risk score for proposals
    pub max_risk_score: f64,
    
    /// Maximum allowed performance drift percentage
    pub max_drift_percent: f64,
    
    /// CPU utilization threshold
    pub cpu_threshold: f64,
    
    /// Memory utilization threshold
    pub memory_threshold: f64,
    
    /// Maximum error rate threshold
    pub error_rate_threshold: f64,
    
    /// Maximum latency threshold (ms)
    pub latency_threshold: f64,
    
    /// Enable strict mode (all gates must pass)
    pub strict_mode: bool,
    
    /// Gate weighting for overall safety score
    pub gate_weights: GateWeights,
}

/// Individual gate weights for safety scoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateWeights {
    /// Weight for confidence gate pass/fail
    pub confidence_weight: f64,
    
    /// Weight for risk gate pass/fail
    pub risk_weight: f64,
    
    /// Weight for drift gate pass/fail
    pub drift_weight: f64,
    
    /// Weight for resource gate pass/fail
    pub resource_weight: f64,
    
    /// Weight for anomaly gate pass/fail  
    pub anomaly_weight: f64,
}

impl Default for ProposalSafetyConfig {
    fn default() -> Self {
        Self {
            min_confidence: 0.85,
            max_risk_score: 0.15,
            max_drift_percent: 5.0,
            cpu_threshold: 0.95,
            memory_threshold: 0.95,
            error_rate_threshold: 0.10,
            latency_threshold: 1000.0,
            strict_mode: false,
            gate_weights: GateWeights {
                confidence_weight: 0.25,
                risk_weight: 0.25,
                drift_weight: 0.20,
                resource_weight: 0.15,
                anomaly_weight: 0.15,
            },
        }
    }
}

/// Individual safety gate result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateResult {
    /// Gate name
    pub gate_name: String,
    
    /// Whether this gate passed
    pub passed: bool,
    
    /// Measured value
    pub measured_value: f64,
    
    /// Threshold value
    pub threshold: f64,
    
    /// Gate severity if failed
    pub severity: GateSeverity,
    
    /// Violation message if failed
    pub violation_message: Option<String>,
    
    /// Recommendation if failed
    pub recommendation: Option<String>,
}

/// Gate violation severity
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GateSeverity {
    /// Critical violation, must reject proposal
    Critical,
    
    /// High severity, should reject unless confident
    High,
    
    /// Medium severity, flag for review
    Medium,
    
    /// Low severity, note but can proceed
    Low,
    
    /// No violation
    None,
}

/// Proposal safety validator
pub struct ProposalSafetyValidator {
    config: ProposalSafetyConfig,
}

impl ProposalSafetyValidator {
    /// Create a new safety validator
    pub fn new(config: ProposalSafetyConfig) -> Self {
        Self { config }
    }

    /// Validate a proposal against all safety gates
    pub fn validate_proposal(
        &self,
        proposal: &PolicyProposal,
        input: &ProposalInput,
    ) -> SafetyValidationResult {
        let mut gate_results = HashMap::new();
        let mut safety_concerns = Vec::new();
        let mut recommendations = Vec::new();

        // Confidence Gate
        let confidence_gate = self.validate_confidence_gate(proposal);
        gate_results.insert("confidence".to_string(), confidence_gate.clone());

        // Risk Gate
        let risk_gate = self.validate_risk_gate(proposal);
        gate_results.insert("risk".to_string(), risk_gate.clone());

        // Drift Gate
        let drift_gate = self.validate_drift_gate(proposal);
        gate_results.insert("drift".to_string(), drift_gate.clone());

        // Resource Gate
        let resource_gate = self.validate_resource_gate(input);
        gate_results.insert("resource".to_string(), resource_gate.clone());

        // Anomaly Gate
        let anomaly_gate = self.validate_anomaly_gate(input);
        gate_results.insert("anomaly".to_string(), anomaly_gate.clone());

        // Collect safety concerns and recommendations
        for (name, gate_result) in &gate_results {
            if !gate_result.passed {
                if let Some(violation) = &gate_result.violation_message {
                    safety_concerns.push(format!("{} gate: {}", name, violation));
                }
                if let Some(recommendation) = &gate_result.recommendation {
                    recommendations.push(recommendation.clone());
                }
            }
        }

        // Calculate overall safety score
        let safety_score = self.calculate_safety_score(&gate_results);

        // Determine overall safety level
        let safety_level = self.determine_safety_level(&gate_results, safety_score);

        // Check if overall validation passes
        let passed = self.check_overall_validation(&gate_results);

        SafetyValidationResult {
            passed,
            safety_level,
            safety_score,
            gate_results,
            safety_concerns,
            recommendations,
            requires_human_review: self.requires_human_review(&gate_results, &safety_level),
        }
    }

    /// Validate confidence gate
    fn validate_confidence_gate(&self, proposal: &PolicyProposal) -> GateResult {
        let confidence = proposal.confidence_score;
        let threshold = self.config.min_confidence;

        GateResult {
            gate_name: "confidence".to_string(),
            passed: confidence >= threshold,
            measured_value: confidence,
            threshold,
            severity: if confidence < threshold {
                if confidence < 0.70 { GateSeverity::Critical } else { GateSeverity::High }
            } else {
                GateSeverity::None
            },
            violation_message: if confidence < threshold {
                Some(format!("Confidence {:.2} below threshold {:.2}", confidence, threshold))
            } else {
                None
            },
            recommendation: if confidence < threshold {
                Some("Increase signal quality or gather more data before proposing".to_string())
            } else {
                None
            },
        }
    }

    /// Validate risk gate
    fn validate_risk_gate(&self, proposal: &PolicyProposal) -> GateResult {
        let risk_score = proposal.risk_score;
        let threshold = self.config.max_risk_score;

        GateResult {
            gate_name: "risk".to_string(),
            passed: risk_score <= threshold,
            measured_value: risk_score,
            threshold,
            severity: if risk_score > threshold {
                if risk_score > 0.30 { GateSeverity::Critical } else { GateSeverity::High }
            } else {
                GateSeverity::None
            },
            violation_message: if risk_score > threshold {
                Some(format!("Risk score {:.2} exceeds threshold {:.2}", risk_score, threshold))
            } else {
                None
            },
            recommendation: if risk_score > threshold {
                Some("Address identified risk factors before implementation".to_string())
            } else {
                None
            },
        }
    }

    /// Validate drift gate
    fn validate_drift_gate(&self, proposal: &PolicyProposal) -> GateResult {
        let drift_percent = self.calculate_proposed_drift_percent(proposal);
        let threshold = self.config.max_drift_percent;

        GateResult {
            gate_name: "drift".to_string(),
            passed: drift_percent <= threshold,
            measured_value: drift_percent,
            threshold,
            severity: if drift_percent > threshold {
                if drift_percent > 10.0 { GateSeverity::Critical } else { GateSeverity::Medium }
            } else {
                GateSeverity::None
            },
            violation_message: if drift_percent > threshold {
                Some(format!("Proposed drift {:.1}% exceeds threshold {:.1}%", drift_percent, threshold))
            } else {
                None
            },
            recommendation: if drift_percent > threshold {
                Some("Consider smaller policy changes or better monitoring".to_string())
            } else {
                None
            },
        }
    }

    /// Validate resource gate
    fn validate_resource_gate(&self, input: &ProposalInput) -> GateResult {
        let cpu_util = input.current_telemetry.cpu_utilization;
        let memory_util = input.current_telemetry.memory_utilization;
        let max_util = cpu_util.max(memory_util);
        let threshold = self.config.cpu_threshold.max(self.config.memory_threshold);

        GateResult {
            gate_name: "resource".to_string(),
            passed: max_util <= threshold,
            measured_value: max_util,
            threshold,
            severity: if max_util > threshold {
                if max_util > 0.98 { GateSeverity::Critical } else { GateSeverity::Medium }
            } else {
                GateSeverity::None
            },
            violation_message: if max_util > threshold {
                Some(format!("Resource utilization {:.1}% exceeds threshold {:.1}%", 
                    max_util * 100.0, threshold * 100.0))
            } else {
                None
            },
            recommendation: if max_util > threshold {
                Some("Reduce resource pressure or scale infrastructure".to_string())
            } else {
                None
            },
        }
    }

    /// Validate anomaly gate
    fn validate_anomaly_gate(&self, input: &ProposalInput) -> GateResult {
        let high_latency = input.current_telemetry.avg_latency_ms > self.config.latency_threshold;
        let high_error_rate = input.current_telemetry.error_rate > self.config.error_rate_threshold;
        
        let anomaly_score = if high_latency || high_error_rate { 1.0 } else { 0.0 };
        let threshold = 1.0; // Any anomaly requires review

        GateResult {
            gate_name: "anomaly".to_string(),
            passed: anomaly_score < threshold,
            measured_value: anomaly_score,
            threshold,
            severity: if anomaly_score >= threshold {
                GateSeverity::High
            } else {
                GateSeverity::None
            },
            violation_message: if anomaly_score >= threshold {
                let mut issues = Vec::new();
                if high_latency {
                    issues.push(format!("High latency: {:.1}ms > {:.1}ms THRESHOLD", 
                        input.current_telemetry.avg_latency_ms, self.config.latency_threshold));
                }
                if high_error_rate {
                    issues.push(format!("High error rate: {:.2}% > {:.2}% THRESHOLD", 
                        input.current_telemetry.error_rate * 100.0, self.config.error_rate_threshold * 100.0));
                }
                Some(issues.join("; "))
            } else {
                None
            },
            recommendation: if anomaly_score >= threshold {
                Some("Investigate and resolve system anomalies before proceeding".to_string())
            } else {
                None
            },
        }
    }

    /// Calculate proposed drift percentage
    fn calculate_proposed_drift_percent(&self, proposal: &PolicyProposal) -> f64 {
        // Simplified drift calculation based on expected impact
        let latency_drift = proposal.expected_impact.latency_delta_ms.abs() / 200.0 * 100.0; // 200ms baseline
        let throughput_drift = proposal.expected_impact.throughput_delta_rps.abs() / 1000.0 * 100.0; // 1000 rps baseline
        let error_drift = proposal.expected_impact.error_rate_delta_percent.abs();

        latency_drift.max(throughput_drift).max(error_drift)
    }

    /// Calculate overall safety score
    fn calculate_safety_score(&self, gate_results: &HashMap<String, GateResult>) -> f64 {
        let mut weighted_score = 0.0;
        let mut total_weight = 0.0;

        let gates = [
            ("confidence", self.config.gate_weights.confidence_weight),
            ("risk", self.config.gate_weights.risk_weight),
            ("drift", self.config.gate_weights.drift_weight),
            ("resource", self.config.gate_weights.resource_weight),
            ("anomaly", self.config.gate_weights.anomaly_weight),
        ];

        for (gate_name, weight) in &gates {
            if let Some(gate_result) = gate_results.get(*gate_name) {
                let gate_score = if gate_result.passed { 1.0 } else { 0.0 };
                weighted_score += gate_score * weight;
                total_weight += weight;
            }
        }

        if total_weight > 0.0 {
            weighted_score / total_weight
        } else {
            0.0
        }
    }

    /// Determine overall safety level
    fn determine_safety_level(
        &self,
        gate_results: &HashMap<String, GateResult>,
        safety_score: f64,
    ) -> SafetyLevel {
        // Count passed gates
        let passed_count = gate_results.values().filter(|gate| gate.passed).count();
        let total_gates = gate_results.len();

        // Check for critical violations
        let has_critical = gate_results.values().any(|gate| 
            matches!(gate.severity, GateSeverity::Critical)
        );

        if has_critical {
            return SafetyLevel::Unsafe;
        }

        match safety_score {
            score if score >= 0.9 => SafetyLevel::VerySafe,
            score if score >= 0.7 => SafetyLevel::Safe,
            score if score >= 0.5 => SafetyLevel::Caution,
            score if score >= 0.3 => SafetyLevel::Risky,
            _ => SafetyLevel::Unsafe,
        }
    }

    /// Check if overall validation passes
    fn check_overall_validation(&self, gate_results: &HashMap<String, GateResult>) -> bool {
        if self.config.strict_mode {
            // In strict mode, all gates must pass
            gate_results.values().all(|gate| gate.passed)
        } else {
            // In normal mode, critical gates must pass
            let critical_gates = ["confidence", "risk", "drift"];
            critical_gates.iter().all(|&gate_name| {
                gate_results.get(gate_name).map_or(false, |gate| gate.passed)
            })
        }
    }

    /// Check if human review is required
    fn requires_human_review(
        &self,
        gate_results: &HashMap<String, GateResult>,
        safety_level: &SafetyLevel,
    ) -> bool {
        // Always require review for unsafe or risky proposals
        if matches!(safety_level, SafetyLevel::Unsafe | SafetyLevel::Risky) {
            return true;
        }

        // Require review if multiple gates failed
        let failed_gates = gate_results.values().filter(|gate| !gate.passed).count();
        if failed_gates > 2 {
            return true;
        }

        // Require review if critical gates failed
        if ["confidence", "risk", "drift"].iter().any(|&gate_name| {
            gate_results.get(gate_name).map_or(false, |gate| !gate.passed)
        }) {
            return true;
        }

        false
    }

    /// Batch validate multiple proposals
    pub fn validate_proposals(
        &self,
        proposals: &[(PolicyProposal, ProposalInput)],
    ) -> Vec<SafetyValidationResult> {
        proposals
            .iter()
            .map(|(proposal, input)| self.validate_proposal(proposal, input))
            .collect()
    }

    /// Get configuration
    pub fn config(&self) -> &ProposalSafetyConfig {
        &self.config
    }
}

/// Result of safety validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyValidationResult {
    /// Overall validation passed
    pub passed: bool,
    
    /// Overall safety level
    pub safety_level: SafetyLevel,
    
    /// Safety score (0.0-1.0)
    pub safety_score: f64,
    
    /// Individual gate results
    pub gate_results: HashMap<String, GateResult>,
    
    /// Safety concerns identified
    pub safety_concerns: Vec<String>,
    
    /// Recommendations for addressing issues
    pub recommendations: Vec<String>,
    
    /// Human review required
    pub requires_human_review: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cognitive::proposal_schema::{PolicyProposal, ActionType, ExpectedImpact};

    fn create_test_proposal() -> PolicyProposal {
        let mut proposal = PolicyProposal::new(ActionType::IncreaseBatchSize);
        proposal.confidence_score = 0.90;
        proposal.risk_score = 0.10;
        proposal.expected_impact = ExpectedImpact {
            latency_delta_ms: 5.0,
            throughput_delta_rps: 10.0,
            error_rate_delta_percent: 0.0,
            cost_delta_percent: -2.0,
            cache_hit_rate_delta_percent: 1.5,
        };
        proposal
    }

    fn create_test_input() -> ProposalInput {
        ProposalInput {
            reasoning: ReasoningOutput::default(),
            current_telemetry: TelemetrySnapshot {
                cpu_utilization: 0.70,
                memory_utilization: 0.50,
                avg_latency_ms: 150.0,
                p95_latency_ms: 200.0,
                throughput_rps: 1000.0,
                error_rate: 0.02,
                cache_hit_rate: 0.80,
                ..Default::default()
            },
            simulation_data: None,
            forecast_data: None,
        }
    }

    #[test]
    fn test_safety_validator_creation() {
        let config = ProposalSafetyConfig::default();
        let validator = ProposalSafetyValidator::new(config);
        assert_eq!(validator.config().min_confidence, 0.85);
    }

    #[test]
    fn test_confidence_gate_validation() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        
        // Test passing case
        let mut proposal = create_test_proposal();
        proposal.confidence_score = 0.95;
        
        let result = validator.validate_confidence_gate(&proposal);
        assert!(result.passed);
        assert_eq!(result.severity, GateSeverity::None);
        assert!(result.violation_message.is_none());

        // Test failing case
        proposal.confidence_score = 0.70;
        let result = validator.validate_confidence_gate(&proposal);
        assert!(!result.passed);
        assert_eq!(result.severity, GateSeverity::High);
        assert!(result.violation_message.is_some());
    }

    #[test]
    fn test_risk_gate_validation() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        
        // Test passing case
        let mut proposal = create_test_proposal();
        proposal.risk_score = 0.10;
        
        let result = validator.validate_risk_gate(&proposal);
        assert!(result.passed);
        assert_eq!(result.severity, GateSeverity::None);

        // Test failing case
        proposal.risk_score = 0.20;
        let result = validator.validate_risk_gate(&proposal);
        assert!(!result.passed);
        assert_eq!(result.severity, GateSeverity::High);
    }

    #[test]
    fn test_drift_gate_validation() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        
        // Test passing case
        let proposal = create_test_proposal(); // Should have reasonable drift
        let result = validator.validate_drift_gate(&proposal);
        assert!(result.passed);

        // Test failing case - high drift
        let mut proposal = create_test_proposal();
        proposal.expected_impact.latency_delta_ms = 300.0; // Very high change
        let result = validator.validate_drift_gate(&proposal);
        assert!(!result.passed);
        assert_eq!(result.severity, GateSeverity::Medium);
    }

    #[test]
    fn test_resource_gate_validation() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        
        // Test passing case
        let input = create_test_input();
        let result = validator.validate_resource_gate(&input);
        assert!(result.passed);

        // Test failing case - high resource usage
        let mut high_resource_input = create_test_input();
        high_resource_input.current_telemetry.cpu_utilization = 0.98;
        high_resource_input.current_telemetry.memory_utilization = 0.95;
        let result = validator.validate_resource_gate(&high_resource_input);
        assert!(!result.passed);
        assert_eq!(result.severity, GateSeverity::Critical);
    }

    #[test]
    fn test_anomaly_gate_validation() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        
        // Test passing case - normal metrics
        let normal_input = create_test_input();
        let result = validator.validate_anomaly_gate(&normal_input);
        assert!(result.passed);

        // Test failing case - high latency
        let mut anomalous_input = create_test_input();
        anomalous_input.current_telemetry.avg_latency_ms = 1500.0; // Very high latency
        let result = validator.validate_anomaly_gate(&anomalous_input);
        assert!(!result.passed);
        assert_eq!(result.severity, GateSeverity::High);
    }

    #[test]
    fn test_complete_safety_validation() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        let proposal = create_test_proposal();
        let input = create_test_input();

        let result = validator.validate_proposal(&proposal, &input);
        
        // Should pass with current test data
        assert!(result.passed);
        assert!(matches!(result.safety_level, SafetyLevel::Safe | SafetyLevel::VerySafe));
        assert!(result.safety_score > 0.5);
        
        // Should include all gate results
        assert_eq!(result.gate_results.len(), 5); // confidence, risk, drift, resource, anomaly
    }

    #[test]
    fn test_safety_score_calculation() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        
        // Test with all gates passing
        let proposal = create_test_proposal();
        let input = create_test_input();
        let result = validator.validate_proposal(&proposal, &input);
        assert!(result.safety_score > 0.8);

        // Test with some gates failing
        let mut low_confidence_proposal = create_test_proposal();
        low_confidence_proposal.confidence_score = 0.7;
        let result = validator.validate_proposal(&low_confidence_proposal, &input);
        assert!(result.safety_score < 0.8);
    }

    #[test]
    fn test_human_review_requirements() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        let proposal = create_test_proposal();
        let input = create_test_input();

        // Should not require review for safe proposal
        let result = validator.validate_proposal(&proposal, &input);
        assert!(!result.requires_human_review);

        // Should require review for high risk
        let mut risky_proposal = create_test_proposal();
        risky_proposal.confidence_score = 0.8;
        risky_proposal.risk_score = 0.2;
        let result = validator.validate_proposal(&risky_proposal, &input);
        assert!(result.requires_human_review);
    }

    #[test]
    fn test_batch_validation() {
        let validator = ProposalSafetyValidator::new(ProposalSafetyConfig::default());
        
        let proposals = vec![
            (create_test_proposal(), create_test_input()),
            (create_test_proposal(), create_test_input()),
        ];

        let results = validator.validate_proposals(&proposals);
        assert_eq!(results.len(), 2);
        
        // All should pass with our test data
        assert!(results.iter().all(|r| r.passed));
    }
}

// Default implementations for testing
impl Default for TelemetrySnapshot {
    fn default() -> Self {
        Self {
            timestamp_ms: 0,
            avg_latency_ms: 100.0,
            p95_latency_ms: 150.0,
            throughput_rps: 1000.0,
            error_rate: 0.01,
            cpu_utilization: 0.5,
            memory_utilization: 0.4,
            cache_hit_rate: 0.8,
            cost_efficiency: 0.9,
        }
    }
}
