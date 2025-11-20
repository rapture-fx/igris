// Core SLO Enforcer logic

use crate::types::*;
use crate::remediation::*;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct SLOEnforcer {
    config: SLOEnforcerConfig,
    thresholds: HashMap<SLOType, SLOThreshold>,
    last_breach_time: HashMap<SLOType, u64>,
}

impl SLOEnforcer {
    pub fn new(config: SLOEnforcerConfig) -> Self {
        let mut thresholds = HashMap::new();
        thresholds.insert(SLOType::P99Latency, SLOThreshold::p99_latency());
        thresholds.insert(SLOType::P95Latency, SLOThreshold::p95_latency());
        thresholds.insert(SLOType::ErrorRate, SLOThreshold::error_rate());
        thresholds.insert(SLOType::Availability, SLOThreshold::availability());
        thresholds.insert(SLOType::Throughput, SLOThreshold::throughput());

        Self {
            config,
            thresholds,
            last_breach_time: HashMap::new(),
        }
    }

    pub fn evaluate_slo(&self, slo_type: SLOType, current_value: f64) -> SLOEvaluation {
        let threshold = self.thresholds.get(&slo_type)
            .expect("Threshold not configured")
            .clone();

        let status = self.determine_status(slo_type, current_value, &threshold);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        SLOEvaluation {
            slo_type,
            current_value,
            threshold,
            status,
            timestamp,
            evaluation_id: format!("eval-{:?}-{}", slo_type, timestamp),
        }
    }

    fn determine_status(&self, slo_type: SLOType, value: f64, threshold: &SLOThreshold) -> SLOStatus {
        match slo_type {
            SLOType::P99Latency | SLOType::P95Latency | SLOType::ErrorRate => {
                // Higher is worse
                if value >= threshold.critical_value {
                    SLOStatus::Breached
                } else if value >= threshold.warning_value {
                    SLOStatus::Critical
                } else if value >= threshold.target_value {
                    SLOStatus::Warning
                } else {
                    SLOStatus::Compliant
                }
            }
            SLOType::Availability | SLOType::Throughput => {
                // Lower is worse
                if value <= threshold.critical_value {
                    SLOStatus::Breached
                } else if value <= threshold.warning_value {
                    SLOStatus::Critical
                } else if value <= threshold.target_value {
                    SLOStatus::Warning
                } else {
                    SLOStatus::Compliant
                }
            }
        }
    }

    pub fn should_remediate(&self, evaluation: &SLOEvaluation) -> Option<RemediationAction> {
        if !self.config.enable_auto_remediation {
            return None;
        }

        // Only remediate Critical and Breached
        if evaluation.status != SLOStatus::Critical && evaluation.status != SLOStatus::Breached {
            return None;
        }

        // Check cooldown
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if let Some(&last_time) = self.last_breach_time.get(&evaluation.slo_type) {
            if now - last_time < self.config.breach_cooldown_secs {
                return None; // Still in cooldown
            }
        }

        // Generate remediation action
        Some(create_remediation_action(evaluation))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_p99_latency_breach() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        let eval = enforcer.evaluate_slo(SLOType::P99Latency, 160.0);

        assert_eq!(eval.status, SLOStatus::Breached);
        assert_eq!(eval.current_value, 160.0);
    }

    #[test]
    fn test_error_rate_compliant() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        let eval = enforcer.evaluate_slo(SLOType::ErrorRate, 0.0005);

        assert_eq!(eval.status, SLOStatus::Compliant);
    }

    #[test]
    fn test_remediation_action() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        let eval = enforcer.evaluate_slo(SLOType::P99Latency, 160.0);

        let action = enforcer.should_remediate(&eval);
        assert!(action.is_some());

        let action = action.unwrap();
        assert_eq!(action.slo_type, SLOType::P99Latency);
    }
}
