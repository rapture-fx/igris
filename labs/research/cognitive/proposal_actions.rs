//! Cognitive Proposal Actions Library
//!
//! Provides helper functions and utilities for generating and validating
//! different types of policy proposals within the cognitive advisory system.
//!
//! # Action Categories
//! - Performance optimization actions
//! - Resource management actions  
//! - Emergency response actions
//! - Experimental and maintenance actions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::cognitive::proposal_schema::{
    PolicyProposal, ActionType, PolicyParameters, ExpectedImpact,
    ProposalRationale, EvidenceReference, EvidenceType
};
use crate::cognitive::proposal_engine::{ProposalInput, TelemetrySnapshot};

/// Action generation templates and utilities
pub struct ProposalActions;

impl ProposalActions {
    /// Generate performance optimization proposals
    pub fn generate_performance_actions(input: &ProposalInput) -> Vec<PolicyProposal> {
        let mut proposals = Vec::new();

        // Batch size optimization
        if let Some(batch_proposal) = Self::optimize_batch_size(input) {
            proposals.push(batch_proposal);
        }

        // Routing optimization
        if let Some(routing_proposal) = Self::optimize_routing(input) {
            proposals.push(routing_proposal);
        }

        // Prefetch optimization
        if let Some(prefetch_proposal) = Self::optimize_prefetch(input) {
            proposals.push(prefetch_proposal);
        }

        proposals
    }

    /// Generate resource management proposals
    pub fn generate_resource_actions(input: &ProposalInput) -> Vec<PolicyProposal> {
        let mut proposals = Vec::new();

        // Resource pressure response
        if Self::is_resource_pressure_high(input) {
            if let Some(reduction_proposal) = Self::reduce_resource_usage(input) {
                proposals.push(reduction_proposal);
            }
        }

        // Resource efficiency optimization
        if Self::is_resource_utilization_low(input) {
            if let Some(expansion_proposal) = Self::increase_resource_usage(input) {
                proposals.push(expansion_proposal);
            }
        }

        proposals
    }

    /// Generate emergency response proposals
    pub fn generate_emergency_actions(input: &ProposalInput) -> Vec<PolicyProposal> {
        let mut proposals = Vec::new();

        // High error rate response
        if input.current_telemetry.error_rate > 0.10 {
            proposals.push(Self::emergency_rollback(input));
        }

        // High latency response
        if input.current_telemetry.avg_latency_ms > 500.0 {
            proposals.push(Self::latency_response(input));
        }

        // Resource emergency response
        if input.current_telemetry.cpu_utilization > 0.95 
            || input.current_telemetry.memory_utilization > 0.95 {
            proposals.push(Self::resource_emergency(input));
        }

        proposals
    }

    /// Generate experimental and maintenance proposals
    pub fn generate_experimental_actions(input: &ProposalInput) -> Vec<PolicyProposal> {
        let mut proposals = Vec::new();

        // Periodic maintenance suggestions
        if Self::should_run_maintenance(input) {
            proposals.push(Self::maintenance_optimization(input));
        }

        // A/B testing suggestions
        proposals.push(Self::ab_test_proposal(input));

        proposals
    }

    /// Optimize batch size based on current conditions
    fn optimize_batch_size(input: &ProposalInput) -> Option<PolicyProposal> {
        let current_cpu = input.current_telemetry.cpu_utilization;
        let current_batch = Self::get_current_batch_size(input);
        
        let action_type = if current_cpu > 0.80 {
            ActionType::DecreaseBatchSize
        } else if current_cpu < 0.60 && input.current_telemetry.avg_latency_ms < 200.0 {
            ActionType::IncreaseBatchSize
        } else {
            return None; // No batch size change needed
        };

        let mut proposal = PolicyProposal::new(action_type);

        // Calculate target batch size
        let target_batch = match action_type {
            ActionType::IncreaseBatchSize => {
                let capacity_available = 1.0 - current_cpu;
                match capacity_available {
                    avail if avail > 0.30 => current_batch * 2, // Double batch
                    avail if avail > 0.15 => (current_batch as f64 * 1.5) as usize,
                    _ => current_batch + 8, // Small increase
                }
            },
            ActionType::DecreaseBatchSize => {
                match current_cpu {
                    cpu if cpu > 0.95 => 8,  // Emergency reduction
                    cpu if cpu > 0.90 => 16, // Aggressive reduction
                    cpu if cpu > 0.80 => 24, // Moderate reduction
                    _ => current_batch / 2,    // Conservative reduction
                }
            },
            _ => return None,
        };

        proposal.target_parameters.batch_size = Some(target_batch);

        // Calculate expected impact
        proposal.expected_impact = Self::estimate_batch_impact(action_type, target_batch, input);

        // Build rationale
        proposal.rationale = ProposalRationale {
            primary_reason: format!(
                "Batch size optimization based on CPU utilization ({:.1}%)",
                current_cpu * 100.0
            ),
            supporting_reasons: vec![
                format!("Current batch size: {}", current_batch),
                format!("Proposed batch size: {}", target_batch),
                format!("Available CPU capacity: {:.1}%", (1.0 - current_cpu) * 100.0)
            ],
            key_observations: vec![
                format!("Current CPU utilization: {:.1}%", current_cpu * 100.0),
                format!("Average latency: {:.1}ms", input.current_telemetry.avg_latency_ms),
                format!("Current throughput: {:.0} rps", input.current_telemetry.throughput_rps)
            ],
            trade_offs: vec![
                "Larger batches improve throughput but may increase latency".to_string(),
                "Smaller batches reduce latency but may decrease cost efficiency".to_string()
            ],
            preference_justification: "Batch size optimization targets current system constraints".to_string(),
        };

        // Add evidence reference
        proposal.evidence.additional_evidence.push(EvidenceReference {
            evidence_type: EvidenceType::TelemetrySnapshot,
            reference: "batch_optimization".to_string(),
            description: "CPU utilization and performance metrics".to_string(),
        });

        Some(proposal)
    }

    /// Optimize routing based on load patterns
    fn optimize_routing(input: &ProposalInput) -> Option<PolicyProposal> {
        // Check if routing optimization is beneficial
        if input.current_telemetry.throughput_rps < 500.0 {
            return None; // Low traffic, routing optimization not beneficial
        }

        let mut proposal = PolicyProposal::new(ActionType::AdjustRouting);

        // Calculate target routing split
        let target_split = if input.current_telemetry.avg_latency_ms > 150.0 {
            0.6 // Shift 60% to better performing service
        } else {
            0.4 // More balanced distribution
        };

        proposal.target_parameters.routing_split = Some(target_split);

        // Estimate impact
        proposal.expected_impact = ExpectedImpact {
            latency_delta_ms: -5.0, // 5ms latency improvement
            throughput_delta_rps: 8.0, // 8 rps throughput increase
            error_rate_delta_percent: -0.3, // 0.3% error rate reduction
            cost_delta_percent: 0.0,
            cache_hit_rate_delta_percent: 0.5,
        };

        proposal.rationale = ProposalRationale {
            primary_reason: "Load-based routing optimization".to_string(),
            supporting_reasons: vec![
                format!("Current throughput: {:.0} rps", input.current_telemetry.throughput_rps),
                format!("Current latency: {:.1}ms", input.current_telemetry.avg_latency_ms)
            ],
            key_observations: vec![
                "High traffic volume detected, routing optimization beneficial".to_string(),
                "Load balancing can improve overall system performance".to_string()
            ],
            trade_offs: vec![
                "Routing changes may temporarily affect cache locality".to_string(),
                "Service rebalancing requires coordination".to_string()
            ],
            preference_justification: "Routing optimization targets high traffic patterns".to_string(),
        };

        Some(proposal)
    }

    /// Optimize prefetch parameters
    fn optimize_prefetch(input: &ProposalInput) -> Option<PolicyProposal> {
        let target_confidence = if input.current_telemetry.cache_hit_rate < 0.70 {
            0.70 // Reduce prefetch confidence for low cache performance
        } else if input.current_telemetry.avg_latency_ms < 100.0 {
            0.90 // Increase prefetch confidence when latency is good
        } else {
            return None; // No prefetch optimization needed
        };

        let mut proposal = PolicyProposal::new(ActionType::AdjustPrefetch);
        proposal.target_parameters.prefetch_confidence = Some(target_confidence);

        // Estimate impact
        proposal.expected_impact = ExpectedImpact {
            latency_delta_ms: if target_confidence > 0.80 {
                -6.0 // Aggressive prefetching
            } else {
                2.0 // Conservative prefetching
            },
            throughput_delta_rps: 5.0,
            error_rate_delta_percent: if target_confidence > 0.80 {
                0.2 // Slight increase in errors due to aggressive prefetching
            } else {
                -0.5
            },
            cost_delta_percent: if target_confidence > 0.80 {
                1.5 // Higher resource usage
            } else {
                -0.5 // Resource savings
            },
            cache_hit_rate_delta_percent: if target_confidence > 0.80 {
                3.0
            } else {
                1.5
            },
        };

        proposal.rationale = ProposalRationale {
            primary_reason: format!(
                "Prefetch tuning based on cache hit rate ({:.1}%)",
                input.current_telemetry.cache_hit_rate * 100.0
            ),
            supporting_reasons: vec![
                format!("Current cache hit rate: {:.1}%", input.current_telemetry.cache_hit_rate * 100.0),
                format!("Proposed prefetch confidence: {:.1}%", target_confidence * 100.0)
            ],
            key_observations: vec![
                format!("Current cache performance: {:.1}%", input.current_telemetry.cache_hit_rate * 100.0),
                format!("Average latency impact: {:.1}ms", input.current_telemetry.avg_latency_ms)
            ],
            trade_offs: vec![
                "Higher prefetch confidence increases memory usage".to_string(),
                "Aggressive prefetching may increase error rate".to_string()
            ],
            preference_justification: "Prefetch optimization targets cache performance".to_string(),
        };

        Some(proposal)
    }

    /// Emergency rollback proposal
    fn emergency_rollback(input: &ProposalInput) -> PolicyProposal {
        let mut proposal = PolicyProposal::new(ActionType::Rollback);

        // Emergency rollback has immediate impact on error rate and latency
        proposal.expected_impact = ExpectedImpact {
            latency_delta_ms: -(input.current_telemetry.avg_latency_ms - 100.0), // Return to 100ms baseline
            throughput_delta_rps: 0.0,
            error_rate_delta_percent: -(input.current_telemetry.error_rate * 100.0) * 0.8, // 80% error recovery
            cost_delta_percent: 0.0,
            cache_hit_rate_delta_percent: 0.0,
        };

        proposal.rationale = ProposalRationale {
            primary_reason: format!(
                "Emergency rollback due to high error rate ({:.2}%)",
                input.current_telemetry.error_rate * 100.0
            ),
            supporting_reasons: vec![
                "Immediate system stability required".to_string(),
                "Error rate exceeds safe operational limits".to_string()
            ],
            key_observations: vec![
                format!("Critical error rate: {:.2}%", input.current_telemetry.error_rate * 100.0),
                format!("Current latency: {:.1}ms", input.current_telemetry.avg_latency_ms),
                format!("Error rate impact: {:.2}%", input.current_telemetry.error_rate * 100.0)
            ],
            trade_offs: vec![
                "Rollback will reset performance improvements".to_string(),
                "Service availability temporarily impacted".to_string()
            ],
            preference_justification: "System stability prioritized over performance".to_string(),
        };

        proposal
    }

    /// Latency response proposal
    fn latency_response(input: &ProposalInput) -> PolicyProposal {
        let mut proposal = PolicyProposal::new(ActionType::DecreaseBatchSize);
        
        // Aggressive batch size reduction for latency
        proposal.target_parameters.batch_size = Some(16);

        proposal.expected_impact = ExpectedImpact {
            latency_delta_ms: -50.0, // Significant latency reduction
            throughput_delta_rps: -30.0, // Throughput penalty
            error_rate_delta_percent: -1.5, // Error rate improvement
            cost_delta_percent: 5.0, // Cost increase
            cache_hit_rate_delta_percent: -2.0, // Cache efficiency loss
        };

        proposal.rationale = ProposalRationale {
            primary_reason: format!(
                "Latency reduction due to high average latency ({:.1}ms)",
                input.current_telemetry.avg_latency_ms
            ),
            supporting_reasons: vec![
                "User experience severely impacted".to_string(),
                "SLA latency thresholds exceeded".to_string()
            ],
            key_observations: vec![
                format!("Critical latency: {:.1}ms", input.current_telemetry.avg_latency_ms),
                format!("P95 latency: {:.1}ms", input.current_telemetry.p95_latency_ms),
                "Latency reduction prioritized".to_string()
            ],
            trade_offs: vec![
                "Aggressive batch reduction impacts throughput".to_string(),
                "Cost efficiency temporarily reduced".to_string()
            ],
            preference_justification: "User experience prioritized over throughput".to_string(),
        };

        proposal
    }

    /// Resource emergency proposal
    fn resource_emergency(input: &ProposalInput) -> PolicyProposal {
        let mut proposal = PolicyProposal::new(ActionType::Rollback);

        proposal.expected_impact = ExpectedImpact {
            latency_delta_ms: -10.0, // Small latency improvement
            throughput_delta_rps: -50.0, // Throughput reduction to lower resource usage
            error_rate_delta_percent: 0.5, // Temporary error rate increase
            cost_delta_percent: 0.0,
            cache_hit_rate_delta_percent: 0.0,
        };

        proposal.rationale = ProposalRationale {
            primary_reason: format!(
                "Resource emergency: CPU {:.1}%, Memory {:.1}%",
                input.current_telemetry.cpu_utilization * 100.0,
                input.current_telemetry.memory_utilization * 100.0
            ),
            supporting_reasons: vec![
                "System resource exhaustion imminent".to_string(),
                "Immediate resource relief required".to_string()
            ],
            key_observations: vec![
                format!("CPU utilization: {:.1}%", input.current_telemetry.cpu_utilization * 100.0),
                format!("Memory utilization: {:.1}%", input.current_telemetry.memory_utilization * 100.0),
                "Emergency resource management activated".to_string()
            ],
            trade_offs: vec![
                "Resource reduction impacts service capacity".to_string(),
                "Throughput temporarily limited".to_string()
            ],
            preference_justification: "System stability prioritized over capacity".to_string(),
        };

        proposal
    }

    /// Maintenance optimization proposal
    fn maintenance_optimization(input: &ProposalInput) -> PolicyProposal {
        let mut proposal = PolicyProposal::new(ActionType::Experimental);

        proposal.target_parameters.custom.insert(
            "maintenance_mode".to_string(),
            serde_json::Value::Bool(true)
        );

        proposal.rationale = ProposalRationale {
            primary_reason: "Periodic maintenance and optimization".to_string(),
            supporting_reasons: vec![
                "Planned maintenance window available".to_string(),
                "System performance monitoring enabled".to_string()
            ],
            key_observations: vec![
                "Maintenance activities scheduled".to_string(),
                "Performance monitoring active".to_string()
            ],
            trade_offs: vec![
                "Maintenance may temporarily impact performance".to_string(),
                "Experimental parameters require careful monitoring".to_string()
            ],
            preference_justification: "Long-term system health improvement".to_string(),
        };

        proposal
    }

    /// A/B testing proposal
    fn ab_test_proposal(input: &ProposalInput) -> PolicyProposal {
        let mut proposal = PolicyProposal::new(ActionType::Experimental);

        proposal.target_parameters.custom.insert(
            "ab_test_mode".to_string(),
            serde_json::Value::Bool(true)
        );
        proposal.target_parameters.custom.insert(
            "test_percentage".to_string(),
            serde_json::Value::Number(serde_json::Number::from_f64(0.1).unwrap())
        );

        proposal.rationale = ProposalRationale {
            primary_reason: "A/B testing for optimization opportunities".to_string(),
            supporting_reasons: vec![
                "New optimization strategies available".to_string(),
                "Controlled experimental testing needed".to_string()
            ],
            key_observations: vec![
                "Experimental testing at 10% traffic".to_string(),
                "Monitoring and comparison enabled".to_string()
            ],
            trade_offs: vec![
                "Experimental changes may impact some users".to_string(),
                "Test duration and overhead considerations".to_string()
            ],
            preference_justification: "Data-driven optimization through experimentation".to_string(),
        };

        proposal
    }

    /// Resource pressure reduction proposal
    fn reduce_resource_usage(input: &ProposalInput) -> Option<PolicyProposal> {
        let mut proposal = PolicyProposal::new(ActionType::DecreaseBatchSize);
        proposal.target_parameters.batch_size = Some(16);

        proposal.expected_impact = ExpectedImpact {
            latency_delta_ms: 8.0, // Latency increase
            throughput_delta_rps: -20.0, // Throughput reduction
            error_rate_delta_percent: -0.8, // Error rate improvement
            cost_delta_percent: 3.0, // Cost increase
            cache_hit_rate_delta_percent: -1.5, // Cache efficiency reduction
        };

        proposal.rationale = ProposalRationale {
            primary_reason: "Resource pressure detected, reducing usage".to_string(),
            supporting_reasons: vec![
                "System resource utilization high".to_string(),
                "Preventative resource management".to_string()
            ],
            key_observations: vec![
                format!("CPU utilization: {:.1}%", input.current_telemetry.cpu_utilization * 100.0),
                format!("Memory utilization: {:.1}%", input.current_telemetry.memory_utilization * 100.0)
            ],
            trade_offs: vec![
                "Reduced capacity may impact performance".to_string(),
                "Cost efficiency temporarily reduced".to_string()
            ],
            preference_justification: "Resource stability prioritized over performance".to_string(),
        };

        Some(proposal)
    }

    /// Resource capacity expansion proposal
    fn increase_resource_usage(input: &ProposalInput) -> Option<PolicyProposal> {
        let mut proposal = PolicyProposal::new(ActionType::IncreaseBatchSize);
        proposal.target_parameters.batch_size = Some(48);

        proposal.expected_impact = ExpectedImpact {
            latency_delta_ms: 6.0,
            throughput_delta_rps: 25.0,
            error_rate_delta_percent: 0.0,
            cost_delta_percent: -3.0,
            cache_hit_rate_delta_percent: 2.0,
        };

        proposal.rationale = ProposalRationale {
            primary_reason: "Resource capacity available for expansion".to_string(),
            supporting_reasons: vec![
                "Low resource utilization detected".to_string(),
                "Underutilized capacity can be leveraged".to_string()
            ],
            key_observations: vec![
                format!("CPU utilization: {:.1}%", input.current_telemetry.cpu_utilization * 100.0),
                "Available capacity for optimization".to_string()
            ],
            trade_offs: vec![
                "Increased resource usage may affect other services".to_string(),
                "Risk of resource pressure under traffic spikes".to_string()
            ],
            preference_justification: "Efficiency improvement through capacity utilization".to_string(),
        };

        Some(proposal)
    }

    /// Check if resource pressure is high
    fn is_resource_pressure_high(input: &ProposalInput) -> bool {
        input.current_telemetry.cpu_utilization > 0.80
            || input.current_telemetry.memory_utilization > 0.80
    }

    /// Check if resource utilization is low
    fn is_resource_utilization_low(input: &ProposalInput) -> bool {
        input.current_telemetry.cpu_utilization < 0.30
            && input.current_telemetry.memory_utilization < 0.30
    }

    /// Check if maintenance should be suggested
    fn should_run_maintenance(input: &ProposalInput) -> bool {
        // Simplified: suggest maintenance if system is stable
        input.current_telemetry.cpu_utilization < 0.50
            && input.current_telemetry.memory_utilization < 0.50
            && input.current_telemetry.error_rate < 0.01
    }

    /// Get current batch size from telemetry
    fn get_current_batch_size(_input: &ProposalInput) -> usize {
        // TODO: Extract from actual telemetry or configuration
        32 // Default batch size
    }

    /// Estimate batch size impact
    fn estimate_batch_impact(_action: ActionType, _target_batch: usize, _input: &ProposalInput) -> ExpectedImpact {
        // Simplified impact estimation
        ExpectedImpact {
            latency_delta_ms: 4.0,
            throughput_delta_rps: 10.0,
            error_rate_delta_percent: 0.0,
            cost_delta_percent: -1.0,
            cache_hit_rate_delta_percent: 1.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cognitive::cognitive_control::{ReasoningOutput, RiskLevel};

    fn create_test_input() -> ProposalInput {
        ProposalInput {
            reasoning: ReasoningOutput {
                confidence: 0.90,
                expected_improvement: 0.05,
                risk_assessment: RiskLevel::Low,
                proposed_action: Some((32, 80, 50)),
                ..Default::default()
            },
            current_telemetry: TelemetrySnapshot {
                cpu_utilization: 0.70,
                memory_utilization: 0.50,
                avg_latency_ms: 150.0,
                throughput_rps: 1000.0,
                error_rate: 0.02,
                cache_hit_rate: 0.75,
                ..Default::default()
            },
            simulation_data: None,
            forecast_data: None,
        }
    }

    #[test]
    fn test_performance_actions_generation() {
        let input = create_test_input();
        let actions = ProposalActions::generate_performance_actions(&input);
        
        assert!(!actions.is_empty());
        
        // Should include at least one optimization action
        assert!(actions.iter().any(|a| matches!(a.action_type, 
            ActionType::IncreaseBatchSize | ActionType::AdjustRouting | ActionType::AdjustPrefetch
        )));
    }

    #[test]
    fn test_emergency_response_actions() {
        let mut input = create_test_input();
        
        // Trigger emergency conditions
        input.current_telemetry.error_rate = 0.15;
        input.current_telemetry.avg_latency_ms = 600.0;
        
        let emergency_actions = ProposalActions::generate_emergency_actions(&input);
        
        // Should generate emergency actions
        assert!(!emergency_actions.is_empty());
        
        // Should include rollback for high error rate
        assert!(emergency_actions.iter().any(|a| a.action_type == ActionType::Rollback));
    }

    #[test]
    fn test_resource_management_actions() {
        let mut input = create_test_input();
        
        // High resource pressure
        input.current_telemetry.cpu_utilization = 0.90;
        input.current_telemetry.memory_utilization = 0.85;
        
        let resource_actions = ProposalActions::generate_resource_actions(&input);
        
        // Should generate resource reduction actions
        assert!(!resource_actions.is_empty());
        
        // Should include batch size reduction
        assert!(resource_actions.iter().any(|a| a.action_type == ActionType::DecreaseBatchSize));
    }

    #[test]
    fn test_experimental_actions() {
        let input = create_test_input();
        
        let experimental_actions = ProposalActions::generate_experimental_actions(&input);
        
        // Should generate experimental proposals
        assert!(!experimental_actions.is_empty());
        
        // Should include experimental actions
        assert!(experimental_actions.iter().any(|a| a.action_type == ActionType::Experimental));
    }
}
