//! Cognitive Proposal Generation Engine
//!
//! Transforms reasoning outputs and simulation gap data into advisory proposals
//! in structured JSON format for human review and potential implementation.
//!
//! # Engine Architecture
//! - Loads cognitive reasoning and simulation data
//! - Applies safety gate validation
//! - Generates structured proposals with rationale
//! - Outputs proposals to experiments/cognitive/proposals/

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::time::Instant;

use crate::cognitive::proposal_schema::{
    PolicyProposal, ActionType, PolicyParameters, ExpectedImpact,
    ProposalRationale, EvidenceLinks, EvidenceReference, EvidenceType,
    SafetyAssessment, SafetyLevel, ProposalMetadata, SystemState
};
use crate::cognitive::cognitive_control::{ReasoningOutput, RiskLevel};
use crate::cognitive::utils::json_writer::JsonWriter;

/// Configuration for proposal generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalEngineConfig {
    /// Enable proposal generation
    pub enabled: bool,

    /// Minimum confidence threshold for proposals
    pub min_confidence: f64,

    /// Maximum risk threshold for proposals
    pub max_risk: f64,

    /// Output directory for proposal JSON files
    pub output_dir: String,

    /// Enable automatic cleanup of old proposals
    pub auto_cleanup: bool,

    /// Maximum age of proposals to keep (hours)
    pub retention_hours: u64,

    /// Include detailed evidence links
    pub include_evidence: bool,

    /// Require safety gate passage
    pub require_safety_gates: bool,
}

impl Default for ProposalEngineConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            min_confidence: 0.85,
            max_risk: 0.15,
            output_dir: "experiments/cognitive/proposals".to_string(),
            auto_cleanup: true,
            retention_hours: 168, // 7 days
            include_evidence: true,
            require_safety_gates: true,
        }
    }
}

/// Input data for proposal generation
#[derive(Debug, Clone)]
pub struct ProposalInput {
    /// Cognitive reasoning output
    pub reasoning: ReasoningOutput,
    
    /// Current system telemetry
    pub current_telemetry: TelemetrySnapshot,
    
    /// Simulation comparison results (if available)
    pub simulation_data: Option<SimulationData>,
    
    /// Forecast predictions (if available)
    pub forecast_data: Option<ForecastData>,
}

/// Current telemetry snapshot
#[derive(Debug, Clone)]
pub struct TelemetrySnapshot {
    /// Timestamp (milliseconds)
    pub timestamp_ms: u64,
    
    /// Average latency
    pub avg_latency_ms: f64,
    
    /// P95 latency
    pub p95_latency_ms: f64,
    
    /// Throughput (requests per second)
    pub throughput_rps: f64,
    
    /// Error rate (0.0-1.0)
    pub error_rate: f64,
    
    /// CPU utilization (0.0-1.0)
    pub cpu_utilization: f64,
    
    /// Memory utilization (0.0-1.0)
    pub memory_utilization: f64,
    
    /// Cache hit rate (0.0-1.0)
    pub cache_hit_rate: f64,
    
    /// Cost efficiency metric
    pub cost_efficiency: f64,
}

/// Simulation comparison data
#[derive(Debug, Clone)]
pub struct SimulationData {
    /// Reward improvement over actual engine
    pub reward_delta_estimate: f64,
    
    /// Confidence in reward estimation
    pub reward_confidence: f64,
    
    /// Number of comparison intervals
    pub comparison_intervals: u32,
    
    /// Path to simulation results file
    pub simulation_file_path: String,
    
    /// Simulation summary
    pub simulation_summary: String,
}

/// Forecast prediction data
#[derive(Debug, Clone)]
pub struct ForecastData {
    /// Forecasted load (requests per second)
    pub forecasted_load_rps: f64,
    
    /// Forecasted latency (milliseconds)
    pub forecasted_latency_ms: f64,
    
    /// Forecast confidence (0.0-1.0)
    pub forecast_confidence: f64,
    
    /// Forecast horizon (minutes)
    pub horizon_minutes: u64,
    
    /// Recommended proactive adjustment
    pub proactive_adjustment: bool,
    
    /// Reason for recommendation
    pub forecast_rationale: String,
}

/// Proposal generation engine
pub struct ProposalEngine {
    config: ProposalEngineConfig,
    json_writer: JsonWriter,
}

impl ProposalEngine {
    /// Create a new proposal engine
    pub fn new(config: ProposalEngineConfig) -> Result<Self, String> {
        let json_writer = JsonWriter::new(&config.output_dir)?;
        
        Ok(Self { config, json_writer })
    }

    /// Generate proposals from cognitive reasoning and simulation data
    pub fn generate_proposals(&self, inputs: Vec<ProposalInput>) -> Result<Vec<PolicyProposal>, String> {
        if !self.config.enabled {
            return Ok(Vec::new());
        }

        let mut proposals = Vec::new();
        let start_time = Instant::now();

        for input in inputs {
            // Check basic confidence and risk thresholds
            if !self.meets_basic_criteria(&input) {
                continue;
            }

            // Generate proposal candidates for different actions
            let action_candidates = self.generate_action_candidates(&input);

            for action_type in action_candidates {
                let proposal = match self.create_proposal(&input, action_type) {
                    Ok(proposal) => proposal,
                    Err(e) => {
                        eprintln!("Failed to create proposal for {:?}: {}", action_type, e);
                        continue;
                    }
                };

                // Apply safety gate validation
                if !self.validate_proposal(&proposal) {
                    continue;
                }

                proposals.push(proposal);
            }
        }

        // Persist proposals
        if !proposals.is_empty() {
            self.persist_proposals(&proposals)?;
        }

        // Cleanup old proposals if enabled
        if self.config.auto_cleanup {
            self.cleanup_old_proposals()?;
        }

        let generation_time = start_time.elapsed().as_millis() as f64;
        println!("Generated {} proposals in {:.1}ms", proposals.len(), generation_time);

        Ok(proposals)
    }

    /// Check if input meets basic generation criteria
    fn meets_basic_criteria(&self, input: &ProposalInput) -> bool {
        input.reasoning.confidence >= self.config.min_confidence
            && RiskLevel::from(input.reasoning.risk_assessment) <= self.config.max_risk
    }

    /// Generate action type candidates based on reasoning
    fn generate_action_candidates(&self, input: &ProposalInput) -> Vec<ActionType> {
        let mut candidates = Vec::new();

        // Always consider no action as baseline
        candidates.push(ActionType::NoAction);

        // Extract action from reasoning output
        if let Some((batch_idx, prefetch_idx, routing_idx)) = &input.reasoning.proposed_action {
            
            // Determine action type based on reasoning
            if input.reasoning.expected_improvement > 0.05 {
                // Positive improvement - consider expansion
                if input.current_telemetry.cpu_utilization < 0.80 {
                    candidates.push(ActionType::IncreaseBatchSize);
                }
                candidates.push(ActionType::AdjustRouting);
            } else if input.reasoning.expected_improvement < -0.05 {
                // Negative performance - consider rollback or optimization
                candidates.push(ActionType::Rollback);
                candidates.push(ActionType::DecreaseBatchSize);
            }
            
            // Consider prefetch adjustment
            if *prefetch_idx > 50 {
                candidates.push(ActionType::AdjustPrefetch);
            }
        }

        // Consider routing adjustments if traffic can be distributed
        if candidates.len() < 3 {
            candidates.push(ActionType::AdjustRouting);
        }

        candidates
    }

    /// Create a proposal for a specific action type
    fn create_proposal(&self, input: &ProposalInput, action_type: ActionType) -> Result<PolicyProposal, String> {
        let mut proposal = PolicyProposal::new(action_type);

        // Set target parameters based on action type and reasoning
        proposal.target_parameters = self.calculate_target_parameters(&action_type, input)?;

        // Set expected impact
        proposal.expected_impact = self.estimate_impact(&action_type, input)?;

        // Build rationale
        proposal.rationale = self.build_rationale(&action_type, input)?;

        // Set confidence and risk scores
        proposal.confidence_score = input.reasoning.confidence;
        proposal.risk_score = RiskLevel::from(input.reasoning.risk_assessment);

        // Set reward estimate from simulation data
        proposal.reward_delta_estimate = input.simulation_data
            .as_ref()
            .map(|sim| sim.reward_delta_estimate)
            .unwrap_or(0.0);

        // Build evidence links
        proposal.evidence = self.build_evidence_links(input);

        // Perform safety assessment
        proposal.safety_assessment = self.perform_safety_assessment(&proposal, input);

        // Set metadata
        proposal.metadata.system_state = SystemState {
            cpu_utilization: input.current_telemetry.cpu_utilization,
            memory_utilization: input.current_telemetry.memory_utilization,
            avg_latency_ms: input.current_telemetry.avg_latency_ms,
            error_rate: input.current_telemetry.error_rate,
            current_throughput_rps: input.current_telemetry.throughput_rps,
            recent_rollbacks: 0, // TODO: Get from telemetry
            stability_score: self.calculate_stability_score(input),
        };

        Ok(proposal)
    }

    /// Calculate target parameters for the proposed action
    fn calculate_target_parameters(&self, action_type: &ActionType, input: &ProposalInput) -> Result<PolicyParameters, String> {
        let mut params = PolicyParameters::default();

        match action_type {
            ActionType::IncreaseBatchSize => {
                // Calculate target batch size based on current utilization
                let capacity_available = 1.0 - input.current_telemetry.cpu_utilization;
                if capacity_available > 0.20 {
                    params.batch_size = Some(64); // Increase to 64 if capacity allows
                } else if capacity_available > 0.10 {
                    params.batch_size = Some(48); // Moderate increase
                } else {
                    params.batch_size = Some(32); // Conservative increase
                }
            },
            ActionType::DecreaseBatchSize => {
                // Reduce batch size under resource pressure
                if input.current_telemetry.cpu_utilization > 0.90 {
                    params.batch_size = Some(16); // Aggressive reduction
                } else if input.current_telemetry.cpu_utilization > 0.80 {
                    params.batch_size = Some(24); // Moderate reduction
                } else {
                    params.batch_size = Some(28); // Conservative reduction
                }
            },
            ActionType::AdjustRouting => {
                // Adjust routing split based on latency differences
                if let Some((_, _, routing_idx)) = &input.reasoning.proposed_action {
                    params.routing_split = Some(*routing_idx as f64 / 100.0);
                } else {
                    params.routing_split = Some(0.6); // Default 60/40 split
                }
            },
            ActionType::AdjustPrefetch => {
                // Set prefetch confidence based on cache hit rate
                if let Some((_, prefetch_idx, _)) = &input.reasoning.proposed_action {
                    params.prefetch_confidence = Some(*prefetch_idx as f64 / 100.0);
                } else {
                    // Adjust based on current cache performance
                    if input.current_telemetry.cache_hit_rate < 0.70 {
                        params.prefetch_confidence = Some(0.70);
                    } else {
                        params.prefetch_confidence = Some(0.85);
                    }
                }
            },
            ActionType::Rollback => {
                // Rollback doesn't change parameters, just state
                // No target parameters needed
            },
            ActionType::NoAction | ActionType::Experimental => {
                // No parameter changes
            },
        }

        Ok(params)
    }

    /// Estimate expected impact of the proposed action
    fn estimate_impact(&self, action_type: &ActionType, input: &ProposalInput) -> Result<ExpectedImpact, String> {
        let current = &input.current_telemetry;
        let mut impact = ExpectedImpact::default();

        match action_type {
            ActionType::IncreaseBatchSize => {
                // Larger batches typically increase throughput but may increase latency
                impact.latency_delta_ms = 5.0; // Slight latency increase
                impact.throughput_delta_rps = 15.0; // Throughput improvement
                impact.cost_delta_percent = -2.0; // Cost efficiency improvement
                impact.cache_hit_rate_delta_percent = 1.5; // Better cache utilization
            },
            ActionType::DecreaseBatchSize => {
                // Smaller batches reduce latency but decrease throughput
                impact.latency_delta_ms = -8.0; // Latency reduction
                impact.throughput_delta_rps = -8.0; // Throughput reduction
                impact.error_rate_delta_percent = -0.8; // Error rate improvement
                impact.cost_delta_percent = 1.5; // Cost increase
                impact.cache_hit_rate_delta_percent = -1.0; // Cache efficiency reduction
            },
            ActionType::AdjustRouting => {
                // Better routing typically reduces latency and improves throughput
                impact.latency_delta_ms = -3.0;
                impact.throughput_delta_rps = 5.0;
                impact.error_rate_delta_percent = -0.5;
                impact.cost_delta_percent = 0.0;
                impact.cache_hit_rate_delta_percent = 0.5;
            },
            ActionType::AdjustPrefetch => {
                // Better prefetching reduces latency and improves cache
                impact.latency_delta_ms = -4.0;
                impact.throughput_delta_rps = 3.0;
                impact.error_rate_delta_percent = -0.3;
                impact.cost_delta_percent = 1.0; // Slight cost increase
                impact.cache_hit_rate_delta_percent = 3.0;
            },
            ActionType::Rollback => {
                // Rollback metrics depend on current degradation
                let baseline_latency = 100.0; // Assume 100ms baseline
                let latency_improvement = current.avg_latency_ms - baseline_latency;
                if latency_improvement > 0.0 {
                    impact.latency_delta_ms = -latency_improvement; // Latency recovery
                }

                // Error rate recovery
                let baseline_error_rate = 0.01; // Assume 1% baseline
                if current.error_rate > baseline_error_rate {
                    impact.error_rate_delta_percent = -(current.error_rate - baseline_error_rate) * 100.0;
                }

                // throughput and cost typically return to baseline
                impact.throughput_delta_rps = 0.0;
                impact.cost_delta_percent = 0.0;
            },
            ActionType::NoAction | ActionType::Experimental => {
                // No impact for no action, conservative for experimental
                impact.latency_delta_ms = 0.0;
                impact.throughput_delta_rps = 0.0;
                impact.error_rate_delta_percent = 0.0;
                impact.cost_delta_percent = 0.0;
                impact.cache_hit_rate_delta_percent = 0.0;
            },
        }

        Ok(impact)
    }

    /// Build rationale for the proposal
    fn build_rationale(&self, action_type: &ActionType, input: &ProposalInput) -> Result<ProposalRationale, String> {
        let mut rationale = ProposalRationale::default();

        // Primary reason based on action type and current state
        rationale.primary_reason = match action_type {
            ActionType::IncreaseBatchSize => {
                format!("System has capacity for larger batches (CPU: {:.1}%, latency: {:.1}ms)",
                    input.current_telemetry.cpu_utilization * 100.0,
                    input.current_telemetry.avg_latency_ms)
            },
            ActionType::DecreaseBatchSize => {
                format!("Resource pressure detected, reducing batch size for stability (CPU: {:.1}%, memory: {:.1}%)",
                    input.current_telemetry.cpu_utilization * 100.0,
                    input.current_telemetry.memory_utilization * 100.0)
            },
            ActionType::AdjustRouting => {
                "Optimize traffic distribution for better performance and resource utilization".to_string()
            },
            ActionType::AdjustPrefetch => {
                format!("Adjust prefetch confidence based on cache hit rate (current: {:.1}%)",
                    input.current_telemetry.cache_hit_rate * 100.0)
            },
            ActionType::Rollback => {
                format!("Performance degradation detected (error rate: {:.2}%), rollback to baseline recommended",
                    input.current_telemetry.error_rate * 100.0)
            },
            ActionType::NoAction => {
                "System performance is stable, no action needed".to_string()
            },
            ActionType::Experimental => {
                "Experimental action suggested for performance testing".to_string()
            },
        };

        // Supporting reasons from reasoning
        rationale.supporting_reasons.push(format!(
            "Cognitive reasoning confidence: {:.2}",
            input.reasoning.confidence
        ));

        if input.reasoning.expected_improvement > 0.0 {
            rationale.supporting_reasons.push(format!(
                "Expected improvement: {:.1}%",
                input.reasoning.expected_improvement * 100.0
            ));
        }

        // Key observations from telemetry
        rationale.key_observations.push(format!(
            "Current latency: {:.1}ms (P95: {:.1}ms)",
            input.current_telemetry.avg_latency_ms,
            input.current_telemetry.p95_latency_ms
        ));
        rationale.key_observations.push(format!(
            "Throughput: {:.0} rps",
            input.current_telemetry.throughput_rps
        ));
        rationale.key_observations.push(format!(
            "Error rate: {:.2}%",
            input.current_telemetry.error_rate * 100.0
        ));

        // Trade-offs
        rationale.trade_offs.push("Larger batches improve throughput but may increase latency".to_string());
        rationale.trade_offs.push("Smaller batches reduce latency but may decrease cost efficiency".to_string());

        // Preference justification
        rationale.preference_justification = format!(
            "Chosen {} optimizes for current system conditions and cognitive reasoning",
            action_type
        );

        Ok(rationale)
    }

    /// Build evidence links to supporting data
    fn build_evidence_links(&self, input: &ProposalInput) -> EvidenceLinks {
        let mut evidence = EvidenceLinks::default();

        if self.config.include_evidence {
            // Reference to reasoning output
            if !input.reasoning.expected_improvement.is_nan() {
                evidence.reasoning_output_id = Some(input.reasoning.timestamp_ms.to_string());
            }

            // Reference to simulation data
            if let Some(ref sim_data) = input.simulation_data {
                evidence.simulation_comparison_id = Some(sim_data.simulation_summary.clone());
                evidence.simulation_file_path = Some(sim_data.simulation_file_path.clone());
            }

            // Add telemetry snapshot reference
            let telemetry_ref = EvidenceReference {
                evidence_type: EvidenceType::TelemetrySnapshot,
                reference: input.current_telemetry.timestamp_ms.to_string(),
                description: "Current system performance metrics".to_string(),
            };
            evidence.additional_evidence.push(telemetry_ref);

            // Add forecast evidence if available
            if let Some(ref forecast) = input.forecast_data {
                let forecast_ref = EvidenceReference {
                    evidence_type: EvidenceType::ForecastPrediction,
                    reference: format!("forecast_{}", forecast horizon_minutes),
                    description: format!("{}-minute load forecast", forecast.horizon_minutes),
                };
                evidence.additional_evidence.push(forecast_ref);
            }
        }

        evidence
    }

    /// Perform safety assessment for the proposal
    fn perform_safety_assessment(&self, proposal: &PolicyProposal, input: &ProposalInput) -> SafetyAssessment {
        let mut assessment = SafetyAssessment::default();

        // Confidence gate
        assessment.confidence_gate_passed = proposal.confidence_score >= 0.85;

        // Risk gate
        assessment.risk_gate_passed = proposal.risk_score <= 0.15;

        // Drift gate - check if proposed action causes excessive change
        let drift_percentage = self.calculate_drift_percentage(proposal);
        assessment.drift_gate_passed = drift_percentage <= 5.0;

        // Resource gate - check utilization limits
        assessment.resource_gate_passed = input.current_telemetry.cpu_utilization <= 0.95
            && input.current_telemetry.memory_utilization <= 0.95;

        // Anomaly gate - check for system anomalies
        assessment.anomaly_gate_passed = input.current_telemetry.error_rate <= 0.10
            && input.current_telemetry.avg_latency_ms <= 1000.0;

        // Determine overall safety level
        let gates_passed = [
            assessment.confidence_gate_passed,
            assessment.drift_gate_passed,
            assessment.risk_gate_passed,
            assessment.resource_gate_passed,
            assessment.anomaly_gate_passed,
        ];
        let passed_count = gates_passed.iter().filter(|&&passed| passed).count();

        assessment.safety_level = match passed_count {
            5 => SafetyLevel::VerySafe,
            4 => SafetyLevel::Safe,
            3 => SafetyLevel::Caution,
            2 => SafetyLevel::Risky,
            _ => SafetyLevel::Unsafe,
        };

        // Identify safety concerns
        if !assessment.confidence_gate_passed {
            assessment.safety_concerns.push(
                format!("Confidence {:.2} below minimum threshold 0.85", proposal.confidence_score)
            );
        }
        if !assessment.drift_gate_passed {
            assessment.safety_concerns.push(
                format!("Predicted drift {:.1}% exceeds 5% threshold", drift_percentage)
            );
        }
        if !assessment.risk_gate_passed {
            assessment.safety_concerns.push(
                format!("Risk score {:.2} exceeds 0.15 threshold", proposal.risk_score)
            );
        }
        if !assessment.resource_gate_passed {
            assessment.safety_concerns.push(
                "High resource utilization detected".to_string()
            );
        }

        assessment
    }

    /// Validate proposal against safety requirements
    fn validate_proposal(&self, proposal: &PolicyProposal) -> bool {
        // Safety gate requirements
        if self.config.require_safety_gates {
            proposal.safety_assessment.safety_level != SafetyLevel::Unsafe
                && proposal.safety_assessment.confidence_gate_passed
                && proposal.safety_assessment.risk_gate_passed
        } else {
            true
        }
    }

    /// Calculate policy drift percentage
    fn calculate_drift_percentage(&self, proposal: &PolicyProposal) -> f64 {
        // Simplified drift calculation based on expected impact
        let latency_drift = proposal.expected_impact.latency_delta_ms.abs() / 200.0 * 100.0; // 200ms baseline
        let throughput_drift = proposal.expected_impact.throughput_delta_rps.abs() / 1000.0 * 100.0; // 1000 rps baseline
        let error_drift = proposal.expected_impact.error_rate_delta_percent.abs();

        latency_drift.max(throughput_drift).max(error_drift)
    }

    /// Calculate system stability score
    fn calculate_stability_score(&self, input: &ProposalInput) -> f64 {
        let mut score = 1.0;

        // Penalize high error rate
        if input.current_telemetry.error_rate > 0.01 {
            score -= input.current_telemetry.error_rate * 5.0;
        }

        // Penalize high latency
        if input.current_telemetry.avg_latency_ms > 200.0 {
            score -= (input.current_telemetry.avg_latency_ms - 200.0) / 100.0;
        }

        // Penalize low resource utilization (inefficiency)
        if input.current_telemetry.cpu_utilization < 0.10 {
            score -= 0.2;
        }

        score.clamp(0.0, 1.0)
    }

    /// Persist proposals to JSON files
    fn persist_proposals(&self, proposals: &[PolicyProposal]) -> Result<Vec<String>, String> {
        let mut saved_files = Vec::new();

        for proposal in proposals {
            let file_path = format!("{}/{}.json", self.config.output_dir, proposal.proposal_id);
            
            if let Err(e) = self.json_writer.write_json_file(&file_path, proposal) {
                eprintln!("Failed to save proposal {}: {}", proposal.proposal_id, e);
                continue;
            }

            saved_files.push(file_path);
        }

        println!("persisted {} proposal files to {}", saved_files.len(), self.config.output_dir);
        Ok(saved_files)
    }

    /// Clean up old proposal files
    fn cleanup_old_proposals(&self) -> Result<usize, String> {
        let cutoff_hours = self.config.retention_hours;
        let cutoff_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64 - (cutoff_hours * 3600 * 1000);

        let output_dir = Path::new(&self.config.output_dir);
        
        if !output_dir.exists() {
            return Ok(0);
        }

        let mut removed_count = 0;

        for entry in fs::read_dir(output_dir)? {
            let entry = entry?;
            let path = entry.path();

            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    let modified_ms = modified.duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64;

                    if modified_ms < cutoff_ms {
                        if let Err(e) = fs::remove_file(&path) {
                            eprintln!("Failed to remove old proposal file {:?}: {}", path, e);
                        } else {
                            removed_count += 1;
                        }
                    }
                }
            }
        }

        if removed_count > 0 {
            println!("Cleaned up {} old proposal files (retention: {} hours)", removed_count, cutoff_hours);
        }

        Ok(removed_count)
    }

    /// Get configuration
    pub fn config(&self) -> &ProposalEngineConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proposal_engine_creation() {
        let config = ProposalEngineConfig::default();
        let engine = ProposalEngine::new(config).unwrap();
        assert!(engine.config().enabled);
    }

    #[test]
    fn test_proposal_generation_basic() {
        let config = ProposalEngineConfig::default();
        let engine = ProposalEngine::new(config).unwrap();

        let reasoning = ReasoningOutput {
            confidence: 0.95,
            expected_improvement: 0.08,
            risk_assessment: RiskLevel::Low,
            proposed_action: Some((64, 85, 60)),
            ..Default::default()
        };

        let telemetry = TelemetrySnapshot {
            timestamp_ms: 1234567890,
            avg_latency_ms: 150.0,
            cpu_utilization: 0.60,
            ..Default::default()
        };

        let input = ProposalInput {
            reasoning,
            current_telemetry: telemetry,
            simulation_data: None,
            forecast_data: None,
        };

        let proposals = engine.generate_proposals(vec![input]).unwrap();
        
        // Should generate at least one proposal
        assert!(!proposals.is_empty());
        
        // Check proposal structure
        let proposal = &proposals[0];
        assert!(proposal.proposal_id.starts_with("cognitive_proposal_"));
        assert!(proposal.timestamp_ms > 0);
        assert!(proposal.confidence_score >= 0.85);
    }

    #[test]
    fn test_safety_assessment() {
        let mut proposal = PolicyProposal::new(ActionType::IncreaseBatchSize);
        proposal.confidence_score = 0.90;
        proposal.risk_score = 0.10;
        proposal.expected_impact.latency_delta_ms = 5.0;

        let telemetry = TelemetrySnapshot {
            cpu_utilization: 0.70,
            memory_utilization: 0.50,
            error_rate: 0.02,
            ..Default::default()
        };

        let input = ProposalInput {
            reasoning: ReasoningOutput::default(),
            current_telemetry: telemetry,
            simulation_data: None,
            forecast_data: None,
        };

        let engine = ProposalEngine::new(ProposalEngineConfig::default()).unwrap();
        let assessment = engine.perform_safety_assessment(&proposal, &input);

        assert!(assessment.confidence_gate_passed);
        assert!(assessment.risk_gate_passed);
        assert!(matches!(assessment.safety_level, SafetyLevel::Safe | SafetyLevel::VerySafe));
    }

    #[test]
    fn test_action_candidate_generation() {
        let engine = ProposalEngine::new(ProposalEngineConfig::default()).unwrap();
        
        let reasoning = ReasoningOutput {
            expected_improvement: 0.08,
            proposed_action: Some((64, 85, 60)),
            risk_assessment: RiskLevel::Low,
            ..Default::default()
        };

        let telemetry = TelemetrySnapshot {
            cpu_utilization: 0.70,
            ..Default::default()
        };

        let input = ProposalInput {
            reasoning,
            current_telemetry: telemetry,
            simulation_data: None,
            forecast_data: None,
        };

        let candidates = engine.generate_action_candidates(&input);
        
        // Should include NoAction
        assert!(candidates.contains(&ActionType::NoAction));
        
        // Should include expansion actions due to positive improvement
        assert!(candidates.contains(&ActionType::AdjustRouting));
    }
}

// Default implementations for testing
impl Default for ProposalInput {
    fn default() -> Self {
        Self {
            reasoning: ReasoningOutput::default(),
            current_telemetry: TelemetrySnapshot::default(),
            simulation_data: None,
            forecast_data: None,
        }
    }
}

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

impl Default for SimulationData {
    fn default() -> Self {
        Self {
            reward_delta_estimate: 0.05,
            reward_confidence: 0.8,
            comparison_intervals: 10,
            simulation_file_path: "experiments/cognitive/sim_result.json".to_string(),
            simulation_summary: "Cognitive showed 5% improvement".to_string(),
        }
    }
}

impl Default for ForecastData {
    fn default() -> Self {
        Self {
            forecasted_load_rps: 1200.0,
            forecasted_latency_ms: 110.0,
            forecast_confidence: 0.75,
            horizon_minutes: 30,
            proactive_adjustment: true,
            forecast_rationale: "Increasing load forecast".to_string(),
        }
    }
}
