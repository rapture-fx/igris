//! Shadow Evaluation Tests for Cognitive Control Layer
//!
//! These tests validate that the cognitive reasoner:
//! 1. Generates valid reasoning JSON
//! 2. Never affects live engine state
//! 3. Produces correct reasoning for multiple scenarios
//! 4. Properly assesses risk and confidence

use schlep_kernel::cognitive::{
    PolicyReasoner, ReasonerConfig, ActionType, RiskLevel, TrendDirection,
};
use schlep_kernel::rl::rl_agent::AgentDecision;
use schlep_kernel::orchestration::policy_engine::{TelemetrySnapshot, PolicyUpdate};

#[test]
fn test_shadow_no_action_scenario() {
    // Scenario: Stable system, no action needed
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let telemetry = TelemetrySnapshot {
        avg_latency_ms: 100.0,
        p95_latency_ms: 150.0,
        cache_hit_rate: 0.95,
        throughput_rps: 100.0,
        error_rate: 0.01,
        cpu_utilization: 0.50,
        memory_utilization: 0.50,
        cost_efficiency: 0.85,
    };

    let baseline = PolicyUpdate::default();

    let reasoning = reasoner.generate_reasoning(None, &telemetry, &baseline)
        .expect("Failed to generate reasoning");

    // Validate shadow-only operation
    assert!(reasoning.shadow_metadata.shadow_only);
    assert_eq!(reasoning.recommended_action.action_type, ActionType::NoAction);
    assert!(reasoning.confidence_score > 0.5);
    assert_eq!(reasoning.risk_assessment.risk_level, RiskLevel::Low);

    // Validate JSON serialization
    let json = reasoning.to_json().expect("Failed to serialize");
    assert!(json.contains("no_action"));
    assert!(json.contains("shadow_only"));
}

#[test]
fn test_shadow_rl_guided_batch_increase() {
    // Scenario: RL agent suggests batch increase, system has capacity
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let rl_decision = AgentDecision {
        batch_size: 64,
        prefetch_confidence: 0.90,
        routing_split: 0.85,
        confidence: 0.92,
        expected_reward_improvement: 0.05,
        timestamp_ms: 0,
        should_apply: true,
        reason: "High confidence batch size increase for better throughput".to_string(),
    };

    let telemetry = TelemetrySnapshot {
        avg_latency_ms: 90.0,  // Below target
        p95_latency_ms: 130.0,
        cache_hit_rate: 0.96,
        throughput_rps: 120.0,
        error_rate: 0.005,     // Very low
        cpu_utilization: 0.55, // Room for growth
        memory_utilization: 0.50,
        cost_efficiency: 0.88,
    };

    let baseline = PolicyUpdate::default();

    let reasoning = reasoner.generate_reasoning(Some(&rl_decision), &telemetry, &baseline)
        .expect("Failed to generate reasoning");

    // Validate reasoning
    assert!(reasoning.shadow_metadata.shadow_only);
    assert_eq!(reasoning.recommended_action.action_type, ActionType::IncreaseBatchSize);
    assert!(reasoning.confidence_score >= 0.85);
    assert!(reasoning.source_signals.rl_agent_decision.is_some());
    assert!(reasoning.rationale.primary_reason.contains("capacity"));

    // Validate expected impact
    assert!(reasoning.recommended_action.expected_impact.throughput_delta_rps > 0.0);

    // Validate risk assessment
    assert!(reasoning.risk_assessment.rollback_risk < 0.20);
    assert!(!reasoning.risk_assessment.risk_factors.is_empty() ||
            reasoning.risk_assessment.risk_level == RiskLevel::Low);
}

#[test]
fn test_shadow_critical_error_rollback() {
    // Scenario: High error rate triggers rollback recommendation
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let telemetry = TelemetrySnapshot {
        avg_latency_ms: 180.0,
        p95_latency_ms: 280.0,
        cache_hit_rate: 0.88,
        throughput_rps: 85.0,
        error_rate: 0.12,      // 12% error rate - CRITICAL
        cpu_utilization: 0.65,
        memory_utilization: 0.60,
        cost_efficiency: 0.70,
    };

    let baseline = PolicyUpdate::default();

    let reasoning = reasoner.generate_reasoning(None, &telemetry, &baseline)
        .expect("Failed to generate reasoning");

    // Validate rollback reasoning
    assert!(reasoning.shadow_metadata.shadow_only);
    assert_eq!(reasoning.recommended_action.action_type, ActionType::Rollback);
    assert!(reasoning.rationale.primary_reason.contains("error rate") ||
            reasoning.rationale.primary_reason.contains("Critical"));

    // Validate risk for rollback action is low (rollback is safe)
    assert_eq!(reasoning.risk_assessment.rollback_risk, 0.0);

    // Validate anomaly detection
    assert!(!reasoning.source_signals.anomalies.is_empty());
    assert!(reasoning.source_signals.anomalies.iter()
        .any(|a| a.anomaly_type.contains("error")));
}

#[test]
fn test_shadow_high_resource_batch_decrease() {
    // Scenario: High CPU/memory triggers batch size decrease
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let telemetry = TelemetrySnapshot {
        avg_latency_ms: 160.0,
        p95_latency_ms: 220.0,
        cache_hit_rate: 0.92,
        throughput_rps: 95.0,
        error_rate: 0.02,
        cpu_utilization: 0.93,  // Very high
        memory_utilization: 0.91, // Very high
        cost_efficiency: 0.75,
    };

    let baseline = PolicyUpdate::default();

    let reasoning = reasoner.generate_reasoning(None, &telemetry, &baseline)
        .expect("Failed to generate reasoning");

    // Validate batch decrease reasoning
    assert!(reasoning.shadow_metadata.shadow_only);
    assert_eq!(reasoning.recommended_action.action_type, ActionType::DecreaseBatchSize);
    assert!(reasoning.recommended_action.target_parameters.batch_size.is_some());
    assert!(reasoning.recommended_action.target_parameters.batch_size.unwrap() <= 32);

    // Validate rationale mentions resource pressure
    assert!(reasoning.rationale.primary_reason.contains("resource") ||
            reasoning.rationale.primary_reason.contains("utilization") ||
            reasoning.rationale.primary_reason.contains("stability"));

    // Expected impact: lower latency, potentially lower throughput
    assert!(reasoning.recommended_action.expected_impact.latency_delta_ms < 0.0);
}

#[test]
fn test_shadow_conflicting_signals() {
    // Scenario: RL suggests increase but resources are high
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let rl_decision = AgentDecision {
        batch_size: 64,
        prefetch_confidence: 0.88,
        routing_split: 0.85,
        confidence: 0.87,
        expected_reward_improvement: 0.03,
        timestamp_ms: 0,
        should_apply: true,
        reason: "Moderate confidence increase".to_string(),
    };

    let telemetry = TelemetrySnapshot {
        avg_latency_ms: 140.0,
        p95_latency_ms: 200.0,
        cache_hit_rate: 0.93,
        throughput_rps: 105.0,
        error_rate: 0.015,
        cpu_utilization: 0.92, // High - conflicts with RL suggestion
        memory_utilization: 0.88,
        cost_efficiency: 0.78,
    };

    let baseline = PolicyUpdate::default();

    let reasoning = reasoner.generate_reasoning(Some(&rl_decision), &telemetry, &baseline)
        .expect("Failed to generate reasoning");

    // Cognitive layer should prioritize safety over RL suggestion
    assert!(reasoning.shadow_metadata.shadow_only);
    assert_eq!(reasoning.recommended_action.action_type, ActionType::DecreaseBatchSize);

    // Validate that RL signal is acknowledged but overridden
    assert!(reasoning.source_signals.rl_agent_decision.is_some());

    // Rationale should explain why RL suggestion was not followed
    assert!(!reasoning.rationale.supporting_reasons.is_empty());
}

#[test]
fn test_shadow_trend_analysis() {
    // Scenario: Build up telemetry history and validate trend detection
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    // Ingest telemetry showing degrading performance
    for i in 1..=10 {
        let telemetry = TelemetrySnapshot {
            avg_latency_ms: 100.0 + (i as f64 * 10.0), // Increasing latency
            p95_latency_ms: 150.0 + (i as f64 * 15.0),
            cache_hit_rate: 0.95 - (i as f64 * 0.01),  // Decreasing cache hits
            throughput_rps: 100.0,
            error_rate: 0.01,
            cpu_utilization: 0.50 + (i as f64 * 0.02),
            memory_utilization: 0.50,
            cost_efficiency: 0.85,
        };
        reasoner.ingest_telemetry(telemetry);
    }

    let current_telemetry = TelemetrySnapshot {
        avg_latency_ms: 200.0,
        p95_latency_ms: 300.0,
        cache_hit_rate: 0.85,
        throughput_rps: 100.0,
        error_rate: 0.01,
        cpu_utilization: 0.70,
        memory_utilization: 0.50,
        cost_efficiency: 0.85,
    };

    let baseline = PolicyUpdate::default();

    let reasoning = reasoner.generate_reasoning(None, &current_telemetry, &baseline)
        .expect("Failed to generate reasoning");

    // Validate trend detection
    let trends = &reasoning.source_signals.historical_trends;
    assert!(trends.latency_trend == TrendDirection::Increasing ||
            trends.latency_trend == TrendDirection::StronglyIncreasing);
}

#[test]
fn test_shadow_metrics_accumulation() {
    // Scenario: Validate metrics are properly tracked
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let telemetry = TelemetrySnapshot::default();
    let baseline = PolicyUpdate::default();

    // Generate multiple reasonings
    for _ in 0..5 {
        reasoner.generate_reasoning(None, &telemetry, &baseline).ok();
    }

    let metrics = reasoner.get_metrics();

    assert_eq!(metrics.total_reasonings, 5);
    assert!(metrics.avg_reasoning_latency_ms > 0.0);
    assert!(metrics.avg_confidence >= 0.0 && metrics.avg_confidence <= 1.0);
}

#[test]
fn test_shadow_reasoning_history() {
    // Scenario: Validate reasoning history is maintained
    let config = ReasonerConfig {
        auto_export: false,
        max_history_size: 3,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let telemetry = TelemetrySnapshot::default();
    let baseline = PolicyUpdate::default();

    // Generate more reasonings than history size
    for _ in 0..5 {
        reasoner.generate_reasoning(None, &telemetry, &baseline).ok();
    }

    let history = reasoner.get_history();

    // History should be capped at max_history_size
    assert_eq!(history.len(), 3);
}

#[test]
fn test_shadow_alternatives_considered() {
    // Scenario: Validate that alternatives are generated and documented
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let telemetry = TelemetrySnapshot {
        avg_latency_ms: 180.0,
        p95_latency_ms: 250.0,
        cache_hit_rate: 0.90,
        throughput_rps: 90.0,
        error_rate: 0.03,
        cpu_utilization: 0.75,
        memory_utilization: 0.70,
        cost_efficiency: 0.78,
    };

    let baseline = PolicyUpdate::default();

    let reasoning = reasoner.generate_reasoning(None, &telemetry, &baseline)
        .expect("Failed to generate reasoning");

    // If an action is recommended, NoAction should be in alternatives
    if reasoning.recommended_action.action_type != ActionType::NoAction {
        assert!(!reasoning.alternatives_considered.is_empty());
        assert!(reasoning.alternatives_considered.iter()
            .any(|alt| alt.action_type == ActionType::NoAction));
    }
}

#[test]
fn test_shadow_json_roundtrip() {
    // Scenario: Validate JSON serialization/deserialization
    let config = ReasonerConfig {
        auto_export: false,
        ..Default::default()
    };
    let reasoner = PolicyReasoner::new(config);

    let telemetry = TelemetrySnapshot::default();
    let baseline = PolicyUpdate::default();

    let reasoning = reasoner.generate_reasoning(None, &telemetry, &baseline)
        .expect("Failed to generate reasoning");

    // Serialize to JSON
    let json = reasoning.to_json().expect("Failed to serialize");

    // Deserialize back
    use schlep_kernel::cognitive::ReasoningOutput;
    let deserialized = ReasoningOutput::from_json(&json)
        .expect("Failed to deserialize");

    // Validate key fields match
    assert_eq!(deserialized.reasoning_id, reasoning.reasoning_id);
    assert_eq!(deserialized.recommended_action.action_type, reasoning.recommended_action.action_type);
    assert_eq!(deserialized.confidence_score, reasoning.confidence_score);
    assert!(deserialized.shadow_metadata.shadow_only);
}
