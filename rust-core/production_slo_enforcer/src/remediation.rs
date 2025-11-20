// Remediation action generation logic

use crate::types::*;

pub fn create_remediation_action(evaluation: &SLOEvaluation) -> RemediationAction {
    let (action_type, target) = match evaluation.slo_type {
        SLOType::P99Latency | SLOType::P95Latency => {
            // High latency remediation strategies:
            // 1. Open circuit breaker for slow providers
            // 2. Adjust Thompson Sampling (penalize slow provider)
            // 3. Scale up infrastructure
            if evaluation.current_value >= evaluation.threshold.critical_value * 1.5 {
                // Severe breach: circuit breaker + scale
                ("circuit_breaker:open+scale:deployment", "slow_provider")
            } else {
                // Moderate breach: adjust Thompson Sampling
                ("thompson_sampling:penalize", "slow_provider")
            }
        }
        SLOType::ErrorRate => {
            // High error rate remediation:
            // 1. Circuit breaker for failing provider
            // 2. Failover to backup provider
            ("circuit_breaker:open+failover", "failing_provider")
        }
        SLOType::Availability => {
            // Low availability remediation:
            // 1. Failover to healthy replicas
            // 2. Scale up for redundancy
            ("failover:healthy_replica+scale:deployment", "primary")
        }
        SLOType::Throughput => {
            // Low throughput remediation:
            // 1. Scale horizontally
            // 2. Increase resource limits
            ("scale:horizontal", "api_gateway")
        }
    };

    let reason = format!(
        "{:?} SLO {:?}: current={:.2}, threshold={:.2}",
        evaluation.slo_type,
        evaluation.status,
        evaluation.current_value,
        evaluation.threshold.critical_value
    );

    RemediationAction {
        action_type: action_type.to_string(),
        target: target.to_string(),
        reason,
        slo_type: evaluation.slo_type,
        current_value: evaluation.current_value,
        threshold_value: evaluation.threshold.critical_value,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_latency_remediation() {
        let eval = SLOEvaluation {
            slo_type: SLOType::P99Latency,
            current_value: 200.0,
            threshold: SLOThreshold::p99_latency(),
            status: SLOStatus::Breached,
            timestamp: 0,
            evaluation_id: "test".to_string(),
        };

        let action = create_remediation_action(&eval);
        assert!(action.action_type.contains("circuit_breaker") ||
                action.action_type.contains("thompson_sampling"));
    }

    #[test]
    fn test_error_rate_remediation() {
        let eval = SLOEvaluation {
            slo_type: SLOType::ErrorRate,
            current_value: 0.05,
            threshold: SLOThreshold::error_rate(),
            status: SLOStatus::Breached,
            timestamp: 0,
            evaluation_id: "test".to_string(),
        };

        let action = create_remediation_action(&eval);
        assert!(action.action_type.contains("circuit_breaker"));
        assert!(action.action_type.contains("failover"));
    }
}
