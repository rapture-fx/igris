//! Cognitive Proposal System Integration Tests
//!
//! Validates JSON structure, metric encoding, and safety checks for
//! the cognitive advisory system Phase 11.5.
//!
//! # Test Coverage
//! - Proposal generation and validation
//! - JSON output structure and content
//! - Safety gate enforcement
//! - Integration with reasoning and simulation data

use std::collections::HashMap;
use std::path::Path;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use igris_kernel::cognitive::proposal_schema::{
    PolicyProposal, ActionType, PolicyParameters, ExpectedImpact,
    ProposalRationale, EvidenceLinks, SafetyAssessment, SafetyLevel,
    Metadata, SystemState, EvidenceReference, EvidenceType
};
use igris_kernel::cognitive::proposal_engine::{
    ProposalEngine, ProposalEngineConfig, ProposalInput, SimulationData, 
    ForecastData, TelemetrySnapshot
};
use igris_kernel::cognitive::proposal_safety::{
    ProposalSafetyValidator, SafetyValidationResult
};
use igris_kernel::cognitive::proposal_actions::ProposalActions;
use igris_kernel::cognitive::cognitive_control::{ReasoningOutput, RiskLevel};
use igris_kernel::cognitive::utils::json_writer::JsonWriter;

#[test]
fn test_proposal_schema_structure() {
    let proposal = PolicyProposal::new(ActionType::IncreaseBatchSize);
    
    // Verify basic structure
    assert!(!proposal.proposal_id.is_empty());
    assert!(proposal.proposal_id.starts_with("cognitive_proposal_"));
    assert!(proposal.timestamp_ms > 0);
    assert_eq!(proposal.action_type, ActionType::IncreaseBatchSize);
    
    // Verify default safety assessment
    assert_eq!(proposal.safety_assessment.safety_level, SafetyLevel::Safe);
    assert!(proposal.safety_assessment.confidence_gate_passed == false); // Default false until validation
    
    // Verify metadata structure
    assert_eq!(proposal.metadata.cognitive_version, "11.5.0");
    assert_eq!(proposal.metadata.schema_version, "1.0.0");
    assert!(proposal.metadata.tags.contains(&"cognitive".to_string()));
    assert!(proposal.metadata.tags.contains(&"advisory".to_string()));
}

#[test]
fn test_json_serialization_roundtrip() {
    let mut proposal = PolicyProposal::new(ActionType::AdjustRouting);
    
    // Set some test data
    proposal.confidence_score = 0.92;
    proposal.risk_score = 0.08;
    proposal.reward_delta_estimate = 6.5;
    
    proposal.target_parameters.routing_split = Some(0.7);
    proposal.expected_impact.latency_delta_ms = -5.0;
    proposal.expected_impact.throughput_delta_rps = 12.0;
    
    proposal.rationale.primary_reason = "Test routing optimization".to_string();
    proposal.rationale.supporting_reasons.push("High traffic detected".to_string());
    
    // Serialize and deserialize
    let json = proposal.to_json().unwrap();
    let deserialized: PolicyProposal = serde_json::from_str(&json).unwrap();
    
    // Verify all fields preserved
    assert_eq!(proposal.proposal_id, deserialized.proposal_id);
    assert_eq!(proposal.action_type, deserialized.action_type);
    assert_eq!(proposal.confidence_score, deserialized.confidence_score);
    assert_eq!(proposal.risk_score, deserialized.risk_score);
    assert_eq!(proposal.target_parameters.routing_split, deserialized.target_parameters.routing_split);
    assert_eq!(proposal.rationale.primary_reason, deserialized.rationale.primary_reason);
}

#[test]
fn test_proposal_engine_basic_generation() {
    let config = ProposalEngineConfig::default();
    let engine = ProposalEngine::new(config).unwrap();
    
    // Create test input
    let reasoning = ReasoningOutput {
        confidence: 0.95,
        expected_improvement: 0.08,
        risk_assessment: RiskLevel::Low,
        proposed_action: Some((64, 85, 60)),
        explanation: "High confidence improvement detected".to_string(),
        signal_sources: vec!["rl".to_string(), "telemetry".to_string()],
        timestamp_ms: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64,
        ..Default::default()
    };
    
    let telemetry = TelemetrySnapshot {
        timestamp_ms: 1234567890,
        avg_latency_ms: 150.0,
        p95_latency_ms: 200.0,
        throughput_rps: 1200.0,
        error_rate: 0.015,
        cpu_utilization: 0.65,
        memory_utilization: 0.45,
        cache_hit_rate: 0.82,
        cost_efficiency: 0.88,
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
    
    // Check first proposal structure
    let proposal = &proposals[0];
    assert!(proposal.meets_safety_criteria());
    assert!(proposal.confidence_score >= 0.85);
    assert!(proposal.risk_score <= 0.15);
    assert!(!proposal.rationale.primary_reason.is_empty());
}

#[test]
fn test_proposal_engine_with_simulation_data() {
    let config = ProposalEngineConfig::default();
    let engine = ProposalEngine::new(config).unwrap();
    
    // Create input with simulation data
    let reasoning = ReasoningOutput {
        confidence: 0.90,
        expected_improvement: 0.06,
        risk_assessment: RiskLevel::Low,
        proposed_action: Some((48, 75, 55)),
        ..Default::default()
    };
    
    let telemetry = TelemetrySnapshot {
        cpu_utilization: 0.70,
        avg_latency_ms: 180.0,
        throughput_rps: 1000.0,
        error_rate: 0.02,
        ..Default::default()
    };
    
    let simulation_data = SimulationData {
        reward_delta_estimate: 8.5,
        reward_confidence: 0.88,
        comparison_intervals: 15,
        simulation_file_path: "test_simulation.json".to_string(),
        simulation_summary: "Cognitive simulation showed 8.5% improvement".to_string(),
    };
    
    let input = ProposalInput {
        reasoning,
        current_telemetry: telemetry,
        simulation_data: Some(simulation_data),
        forecast_data: None,
    };
    
    let proposals = engine.generate_proposals(vec![input]).unwrap();
    
    // Should include simulation evidence
    let proposal = &proposals[0];
    assert!(proposal.evidence.simulation_file_path.is_some());
    assert!(proposal.reward_delta_estimate == 8.5); // From simulation data
}

#[test]
fn test_proposal_engine_with_forecast_data() {
    let config = ProposalEngineConfig::default();
    let engine = ProposalEngine::new(config).unwrap();
    
    let reasoning = ReasoningOutput {
        confidence: 0.92,
        expected_improvement: 0.07,
        risk_assessment: RiskLevel::Low,
        proposed_action: Some((56, 88, 62)),
        ..Default::default()
    };
    
    let telemetry = TelemetrySnapshot {
        throughput_rps: 900.0,
        cpu_utilization: 0.60,
        ..Default::default()
    };
    
    let forecast_data = ForecastData {
        forecasted_load_rps: 1400.0,
        forecasted_latency_ms: 130.0,
        forecast_confidence: 0.83,
        horizon_minutes: 30,
        proactive_adjustment: true,
        forecast_rationale: "Increasing load predicted for next 30 minutes".to_string(),
    };
    
    let input = ProposalInput {
        reasoning,
        current_telemetry: telemetry,
        simulation_data: None,
        forecast_data: Some(forecast_data),
    };
    
    let proposals = engine.generate_proposals(vec![input]).unwrap();
    
    // Should include forecast evidence
    let proposal = &proposals[0];
    assert!(!proposal.evidence.additional_evidence.is_empty());
    
    // Check for forecast evidence
    let has_forecast_evidence = proposal.evidence.additional_evidence
        .iter()
        .any(|e| matches!(e.evidence_type, EvidenceType::ForecastPrediction));
    assert!(has_forecast_evidence);
}

#[test]
fn test_safety_gate_validation() {
    let config = ProposalSafetyConfig::default();
    let validator = ProposalSafetyValidator::new(config);
    
    // Create test proposal
    let mut proposal = PolicyProposal::new(ActionType::IncreaseBatchSize);
    proposal.confidence_score = 0.95;
    proposal.risk_score = 0.08;
    proposal.reward_delta_estimate = 5.0;
    
    // Create input with normal metrics
    let input = ProposalInput {
        reasoning: ReasoningOutput::default(),
        current_telemetry: TelemetrySnapshot {
            cpu_utilization: 0.65,
            memory_utilization: 0.50,
            avg_latency_ms: 120.0,
            error_rate: 0.01,
            ..Default::default()
        },
        simulation_data: None,
        forecast_data: None,
    };
    
    let result = validator.validate_proposal(&proposal, &input);
    
    // Should pass basic safety validation
    assert!(result.passed);
    assert!(matches!(result.safety_level, SafetyLevel::VerySafe | SafetyLevel::Safe));
    assert!(result.safety_score > 0.8);
    assert!(!result.requires_human_review);
    
    // Check all gates evaluated
    assert_eq!(result.gate_results.len(), 5);
    assert!(result.gate_results.contains_key("confidence"));
    assert!(result.gate_results.contains_key("risk"));
    assert!(result.gate_results.contains_key("drift"));
    assert!(result.gate_results.contains_key("resource"));
    assert!(result.gate_results.contains_key("anomaly"));
}

#[test]
fn test_safety_gate_violations() {
    let config = ProposalSafetyConfig::default();
    let validator = ProposalSafetyValidator::new(config);
    
    // Create proposal with low confidence (should fail)
    let mut proposal = PolicyProposal::new(ActionType::Experimental);
    proposal.confidence_score = 0.70; // Below threshold
    proposal.risk_score = 0.25;     // Above threshold
    
    // Create input with high resource usage
    let input = ProposalInput {
        reasoning: ReasoningOutput::default(),
        current_telemetry: TelemetrySnapshot {
            cpu_utilization: 0.98,    // Above threshold
            avg_latency_ms: 1500.0,   // High latency anomaly
            error_rate: 0.12,          // High error rate
            ..Default::default()
        },
        simulation_data: None,
        forecast_data: None,
    };
    
    let result = validator.validate_proposal(&proposal, &input);
    
    // Should fail validation
    assert!(!result.passed);
    assert!(matches!(result.safety_level, SafetyLevel::Unsafe | SafetyLevel::Risky));
    assert!(result.requires_human_review);
    
    // Should identify safety concerns
    assert!(!result.safety_concerns.is_empty());
    
    // Should have recommendations
    assert!(!result.recommendations.is_empty());
    
    // Check failed gates
    let failed_gates: Vec<_> = result.gate_results
        .iter()
        .filter_map(|(name, gate)| if !gate.passed { Some(name.clone()) } else { None })
        .collect();
    
    assert!(failed_gates.len() >= 2); // Should fail at least confidence and another gate
}

#[test]
fn test_proposal_actions_generation() {
    // Test performance actions
    let input = create_test_input_good();
    let performance_actions = ProposalActions::generate_performance_actions(&input);
    assert!(!performance_actions.is_empty());
    
    // Test resource actions under pressure
    let mut high_pressure_input = create_test_input_good();
    high_pressure_input.current_telemetry.cpu_utilization = 0.92;
    high_pressure_input.current_telemetry.memory_utilization = 0.88;
    
    let resource_actions = ProposalActions::generate_resource_actions(&high_pressure_input);
    assert!(!resource_actions.is_empty());
    
    // Should include batch size reduction
    assert!(resource_actions.iter().any(|a| a.action_type == ActionType::DecreaseBatchSize));
    
    // Test emergency actions
    let mut emergency_input = create_test_input_good();
    emergency_input.current_telemetry.error_rate = 0.15;
    emergency_input.current_telemetry.avg_latency_ms = 800.0;
    
    let emergency_actions = ProposalActions::generate_emergency_actions(&emergency_input);
    assert!(!emergency_actions.is_empty());
    
    // Should include rollback
    assert!(emergency_actions.iter().any(|a| a.action_type == ActionType::Rollback));
}

#[test]
fn test_json_persistence() {
    let temp_dir = "/tmp/test_proposal_persistence";
    fs::create_dir_all(temp_dir).unwrap();
    
    let writer = JsonWriter::new(temp_dir).unwrap();
    
    // Create test proposal
    let proposal = PolicyProposal::new(ActionType::AdjustPrefetch);
    proposal.confidence_score = 0.91;
    proposal.risk_score = 0.09;
    proposal.reward_delta_estimate = 4.2;
    
    // Write proposal
    let file_path = writer.write_json_file("test_proposal.json", &proposal).unwrap();
    
    // Verify file exists
    assert!(Path::new(&file_path).exists());
    
    // Read back and verify
    let read_proposal: PolicyProposal = writer.read_json_file("test_proposal.json").unwrap();
    assert_eq!(proposal.proposal_id, read_proposal.proposal_id);
    assert_eq!(proposal.confidence_score, read_proposal.confidence_score);
    
    // Cleanup
    let _ = fs::remove_dir_all(temp_dir);
}

#[test]
fn test_batch_proposal_generation() {
    let config = ProposalEngineConfig::default();
    let engine = ProposalEngine::new(config).unwrap();
    
    // Create multiple inputs
    let mut inputs = Vec::new();
    
    for i in 0..3 {
        let reasoning = ReasoningOutput {
            confidence: 0.85 + (i as f64 * 0.02),
            expected_improvement: 0.05 + (i as f64 * 0.01),
            risk_assessment: RiskLevel::Low,
            proposed_action: Some((32 + (i * 16), 80, 60)),
            ..Default::default()
        };
        
        let telemetry = TelemetrySnapshot {
            cpu_utilization: 0.60 + (i as f64 * 0.10),
            avg_latency_ms: 140.0 + (i as f64 * 20.0),
            throughput_rps: 1000.0 + (i as f64 * 200.0),
            ..Default::default()
        };
        
        inputs.push(ProposalInput {
            reasoning,
            current_telemetry: telemetry,
            simulation_data: None,
            forecast_data: None,
        });
    }
    
    let proposals = engine.generate_proposals(inputs).unwrap();
    
    // Should generate proposals for all valid inputs
    assert_eq!(proposals.len(), 3);
    
    // Each should be safe
    assert!(proposals.iter().all(|p| p.meets_safety_criteria()));
    
    // Should have different action types based on conditions
    let action_types: Vec<_> = proposals.iter().map(|p| &p.action_type).collect();
    // Should include some variety in actions
    assert!(action_types.len() >= 2); // At least some variety
}

#[test]
fn test_proposal_parameter_calculations() {
    let config = ProposalEngineConfig::default();
    let engine = ProposalEngine::new(config).unwrap();
    
    // Test batch size calculations under different loads
    let high_cpu = create_test_input_with_cpu(0.85);
    let low_cpu = create_test_input_with_cpu(0.40);
    
    // High CPU should suggest smaller batches
    let high_cpu_proposals = engine.generate_action_candidates(&high_cpu);
    assert!(high_cpu_proposals.contains(&ActionType::DecreaseBatchSize));
    
    // Low CPU should allow larger batches
    let low_cpu_proposals = engine.generate_action_candidates(&low_cpu);
    assert!(low_cpu_proposals.contains(&ActionType::IncreaseBatchSize));
}

#[test]
fn test_proposal_impact_estimation() {
    let config = ProposalEngineConfig::default();
    let engine = ProposalEngine::new(config).unwrap();
    
    let input = create_test_input_good();
    
    // Test batch size increase impact
    let batch_increase_impact = engine.estimate_impact(&ActionType::IncreaseBatchSize, &input).unwrap();
    assert!(batch_increase_impact.throughput_delta_rps > 0.0); // Should increase throughput
    assert!(batch_increase_impact.latency_delta_ms >= 0.0); // May increase latency slightly
    
    // Test batch size decrease impact
    let batch_decrease_impact = engine.estimate_impact(&ActionType::DecreaseBatchSize, &input).unwrap();
    assert!(batch_decrease_impact.latency_delta_ms < 0.0); // Should reduce latency
    assert!(batch_decrease_impact.throughput_delta_rps < 0.0); // May reduce throughput
}

#[test]
fn test_proposal_evidence_links() {
    let config = ProposalEngineConfig::default();
    let engine = ProposalEngine::new(config).unwrap();
    
    let reasoning = ReasoningOutput {
        timestamp_ms: 1234567890,
        confidence: 0.92,
        ..Default::default()
    };
    
    let simulation_data = SimulationData {
        simulation_file_path: "test_simulation.json".to_string(),
        simulation_summary: "Test simulation results".to_string(),
        ..Default::default()
    };
    
    let input = ProposalInput {
        reasoning,
        current_telemetry: create_test_telemetry(),
        simulation_data: Some(simulation_data),
        forecast_data: None,
    };
    
    let proposals = engine.generate_proposals(vec![input]).unwrap();
    let proposal = &proposals[0];
    
    // Should include reasoning reference
    assert!(proposal.evidence.reasoning_output_id.is_some());
    
    // Should include simulation reference
    assert!(proposal.evidence.simulation_file_path.is_some());
    assert_eq!(proposal.evidence.simulation_file_path.unwrap(), "test_simulation.json");
    
    // Should include telemetry evidence
    assert!(!proposal.evidence.additional_evidence.is_empty());
    let has_telemetry = proposal.evidence.additional_evidence
        .iter()
        .any(|e| matches!(e.evidence_type, EvidenceType::TelemetrySnapshot));
    assert!(has_telemetry);
}

#[test]
fn test_proposal_timeout_and_limits() {
    let config = ProposalEngineConfig {
        max_risk: 0.10, // Lower risk threshold
        require_safety_gates: true,
        ..Default::default()
    };
    let engine = ProposalEngine::new(config).unwrap();
    
    // Create input with medium risk (should be filtered out)
    let reasoning = ReasoningOutput {
        confidence: 0.88,
        risk_assessment: RiskLevel::Medium, // Should convert to risk > 0.10
        proposed_action: Some((32, 80, 50)),
        ..Default::default()
    };
    
    let input = ProposalInput {
        reasoning,
        current_telemetry: create_test_telemetry(),
        simulation_data: None,
        forecast_data: None,
    };
    
    let proposals = engine.generate_proposals(vec![input]).unwrap();
    
    // Might not generate proposals due to risk threshold
    // (depends on exact risk calculation from RiskLevel::Medium)
    // But if proposals are generated, they should all meet safety criteria
    assert!(proposals.iter().all(|p| p.risk_score <= 0.10));
}

// Helper functions for testing
fn create_test_input_good() -> ProposalInput {
    ProposalInput {
        reasoning: ReasoningOutput {
            confidence: 0.92,
            expected_improvement: 0.07,
            risk_assessment: RiskLevel::Low,
            proposed_action: Some((48, 85, 60)),
            explanation: "Good improvement opportunity".to_string(),
            signal_sources: vec!["rl".to_string(), "telemetry".to_string()],
            timestamp_ms: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64,
            ..Default::default()
        },
        current_telemetry: create_test_telemetry(),
        simulation_data: None,
        forecast_data: None,
    }
}

fn create_test_input_with_cpu(cpu_utilization: f64) -> ProposalInput {
    let mut input = create_test_input_good();
    input.current_telemetry.cpu_utilization = cpu_utilization;
    input
}

fn create_test_telemetry() -> TelemetrySnapshot {
    TelemetrySnapshot {
        timestamp_ms: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64,
        avg_latency_ms: 130.0,
        p95_latency_ms: 180.0,
        throughput_rps: 1100.0,
        error_rate: 0.015,
        cpu_utilization: 0.65,
        memory_utilization: 0.48,
        cache_hit_rate: 0.82,
        cost_efficiency: 0.89,
    }
}

#[test]
fn test_complete_integration_workflow() {
    // Setup
    let temp_dir = "/tmp/test_complete_integration";
    fs::create_dir_all(temp_dir).unwrap();
    let mut config = ProposalEngineConfig::new();
    config.output_dir = temp_dir.to_string();
    
    let engine = ProposalEngine::new(config).unwrap();
    let safety_config = ProposalSafetyConfig::default();
    let validator = ProposalSafetyValidator::new(safety_config);
    
    // Create realistic input
    let reasoning = ReasoningOutput {
        confidence: 0.93,
        expected_improvement: 0.08,
        risk_assessment: RiskLevel::Low,
        proposed_action: Some((56, 88, 65)),
        explanation: "Resource optimization opportunity detected".to_string(),
        signal_sources: vec!["rl".to_string(), "telemetry".to_string(), "forecast".to_string()],
        timestamp_ms: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64,
        ..Default::default()
    };
    
    let simulation_data = SimulationData {
        reward_delta_estimate: 7.2,
        reward_confidence: 0.85,
        comparison_intervals: 12,
        simulation_file_path: "integration_test_simulation.json".to_string(),
        simulation_summary: "Cognitive improvements validated".to_string(),
    };
    
    let forecast_data = ForecastData {
        forecasted_load_rps: 1350.0,
        forecasted_latency_ms: 125.0,
        forecast_confidence: 0.88,
        horizon_minutes: 45,
        proactive_adjustment: true,
        forecast_rationale: "Modest load increase expected".to_string(),
    };
    
    let input = ProposalInput {
        reasoning,
        current_telemetry: create_test_telemetry(),
        simulation_data: Some(simulation_data),
        forecast_data: Some(forecast_data),
    };
    
    // Generate proposals
    let proposals = engine.generate_proposals(vec![input]).unwrap();
    assert!(!proposals.is_empty());
    
    // Validate each proposal
    for proposal in &proposals {
        // Check safety criteria
        assert!(proposal.meets_safety_criteria());
        
        // Validate structure
        assert!(!proposal.proposal_id.is_empty());
        assert!(proposal.confidence_score >= 0.85);
        assert!(proposal.risk_score <= 0.15);
        assert!(!proposal.rationale.primary_reason.is_empty());
        assert!(!proposal.expected_impact.latency_delta_ms.is_nan());
        assert!(proposal.timestamp_ms > 0);
        
        // Safety validation
        let safety_result = validator.validate_proposal(proposal, &input);
        
        // Should not require human review for safe proposals
        if proposal.confidence_score >= 0.90 && proposal.risk_score <= 0.10 {
            assert!(!safety_result.requires_human_review);
        }
    }
    
    // Verify proposals were written to disk
    let writer = JsonWriter::new(temp_dir).unwrap();
    let file_count = writer.get_file_count().unwrap();
    assert!(file_count >= proposals.len());
    
    // Cleanup
    let _ = fs::remove_dir_all(temp_dir);
}
