// Type definitions for SLO Enforcer

use serde::{Deserialize, Serialize};

/// SLO Type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SLOType {
    P99Latency,
    P95Latency,
    ErrorRate,
    Availability,
    Throughput,
}

/// SLO Status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SLOStatus {
    Compliant,
    Warning,
    Critical,
    Breached,
}

/// SLO Threshold configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SLOThreshold {
    pub slo_type: SLOType,
    pub target_value: f64,
    pub warning_value: f64,
    pub critical_value: f64,
    pub evaluation_window_secs: u64,
}

/// SLO Evaluation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SLOEvaluation {
    pub slo_type: SLOType,
    pub current_value: f64,
    pub threshold: SLOThreshold,
    pub status: SLOStatus,
    pub timestamp: u64,
    pub evaluation_id: String,
}

/// Remediation Action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationAction {
    pub action_type: String,
    pub target: String,
    pub reason: String,
    pub slo_type: SLOType,
    pub current_value: f64,
    pub threshold_value: f64,
}

/// Metrics input from Prometheus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsInput {
    pub p99_latency_ms: Option<f64>,
    pub p95_latency_ms: Option<f64>,
    pub error_rate: Option<f64>,
    pub availability: Option<f64>,
    pub throughput_rps: Option<f64>,
}

/// Evaluation response (FFI output)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationResponse {
    pub breached: bool,
    pub actions: Vec<RemediationAction>,
    pub timestamp: u64,
}

/// SLO Enforcer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SLOEnforcerConfig {
    pub evaluation_interval_secs: u64,
    pub enable_auto_remediation: bool,
    pub breach_cooldown_secs: u64,
}

impl Default for SLOEnforcerConfig {
    fn default() -> Self {
        Self {
            evaluation_interval_secs: 20,
            enable_auto_remediation: true,
            breach_cooldown_secs: 300,
        }
    }
}

impl SLOThreshold {
    pub fn p99_latency() -> Self {
        Self {
            slo_type: SLOType::P99Latency,
            target_value: 100.0,
            warning_value: 130.0,
            critical_value: 150.0,
            evaluation_window_secs: 60,
        }
    }

    pub fn p95_latency() -> Self {
        Self {
            slo_type: SLOType::P95Latency,
            target_value: 50.0,
            warning_value: 80.0,
            critical_value: 100.0,
            evaluation_window_secs: 60,
        }
    }

    pub fn error_rate() -> Self {
        Self {
            slo_type: SLOType::ErrorRate,
            target_value: 0.001,
            warning_value: 0.01,
            critical_value: 0.02,
            evaluation_window_secs: 300,
        }
    }

    pub fn availability() -> Self {
        Self {
            slo_type: SLOType::Availability,
            target_value: 0.9999,
            warning_value: 0.999,
            critical_value: 0.99,
            evaluation_window_secs: 3600,
        }
    }

    pub fn throughput() -> Self {
        Self {
            slo_type: SLOType::Throughput,
            target_value: 10000.0,
            warning_value: 8000.0,
            critical_value: 5000.0,
            evaluation_window_secs: 60,
        }
    }
}
