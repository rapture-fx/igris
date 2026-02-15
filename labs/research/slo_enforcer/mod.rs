// SLO Enforcer & Auditor for Phase 12
// Continuously enforces SLOs, triggers remediation, and emits auditable runbook entries

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// SLOType represents different service level objectives
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SLOType {
    P99Latency,
    P95Latency,
    ErrorRate,
    Availability,
    Throughput,
}

/// SLOThreshold defines acceptable bounds for an SLO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SLOThreshold {
    pub slo_type: SLOType,
    pub target_value: f64,
    pub warning_value: f64,
    pub critical_value: f64,
    pub evaluation_window_secs: u64,
}

/// SLOStatus represents the current compliance state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SLOStatus {
    Compliant,
    Warning,
    Critical,
    Breached,
}

/// SLOEvaluation captures the result of an SLO check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SLOEvaluation {
    pub slo_type: SLOType,
    pub current_value: f64,
    pub threshold: SLOThreshold,
    pub status: SLOStatus,
    pub timestamp: u64,
    pub evaluation_id: String,
}

/// RemediationAction defines autonomous response to SLO violations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationAction {
    pub action_type: String,
    pub target_resource: String,
    pub parameters: HashMap<String, String>,
    pub triggered_by: String,
    pub scheduled_at: u64,
}

/// AuditEvent represents an immutable audit trail entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub event_id: String,
    pub timestamp: u64,
    pub event_type: String,
    pub actor: String,
    pub action: String,
    pub resource: String,
    pub outcome: String,
    pub metadata: HashMap<String, String>,
    pub checkpoint_id: Option<String>,
    pub hmac_signature: String,
}

/// RunbookEntry links autonomous actions to documented procedures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunbookEntry {
    pub entry_id: String,
    pub timestamp: u64,
    pub runbook_url: String,
    pub action_type: String,
    pub description: String,
    pub audit_event_id: String,
}

/// SLOEnforcerConfig configures the enforcer behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SLOEnforcerConfig {
    pub evaluation_interval_secs: u64,
    pub enable_auto_remediation: bool,
    pub hmac_secret_key: Vec<u8>,
    pub max_audit_events: usize,
    pub breach_cooldown_secs: u64,
}

impl Default for SLOEnforcerConfig {
    fn default() -> Self {
        Self {
            evaluation_interval_secs: 30,
            enable_auto_remediation: true,
            hmac_secret_key: b"default-secret-change-in-production".to_vec(),
            max_audit_events: 100_000,
            breach_cooldown_secs: 300,
        }
    }
}

/// SLOEnforcer continuously monitors and enforces service level objectives
pub struct SLOEnforcer {
    config: SLOEnforcerConfig,
    thresholds: Arc<RwLock<HashMap<SLOType, SLOThreshold>>>,
    evaluations: Arc<RwLock<Vec<SLOEvaluation>>>,
    audit_events: Arc<RwLock<Vec<AuditEvent>>>,
    runbook_entries: Arc<RwLock<Vec<RunbookEntry>>>,
    last_breach_time: Arc<RwLock<HashMap<SLOType, u64>>>,
}

impl SLOEnforcer {
    /// Create a new SLO enforcer with default production thresholds
    pub fn new(config: SLOEnforcerConfig) -> Self {
        let mut thresholds = HashMap::new();

        // Production SLO thresholds from acceptance criteria
        thresholds.insert(
            SLOType::P99Latency,
            SLOThreshold {
                slo_type: SLOType::P99Latency,
                target_value: 100.0,
                warning_value: 130.0,
                critical_value: 150.0,
                evaluation_window_secs: 60,
            },
        );

        thresholds.insert(
            SLOType::P95Latency,
            SLOThreshold {
                slo_type: SLOType::P95Latency,
                target_value: 50.0,
                warning_value: 80.0,
                critical_value: 100.0,
                evaluation_window_secs: 60,
            },
        );

        thresholds.insert(
            SLOType::ErrorRate,
            SLOThreshold {
                slo_type: SLOType::ErrorRate,
                target_value: 0.001,
                warning_value: 0.01,
                critical_value: 0.02,
                evaluation_window_secs: 300,
            },
        );

        thresholds.insert(
            SLOType::Availability,
            SLOThreshold {
                slo_type: SLOType::Availability,
                target_value: 0.9999,
                warning_value: 0.999,
                critical_value: 0.99,
                evaluation_window_secs: 3600,
            },
        );

        thresholds.insert(
            SLOType::Throughput,
            SLOThreshold {
                slo_type: SLOType::Throughput,
                target_value: 10000.0,
                warning_value: 8000.0,
                critical_value: 5000.0,
                evaluation_window_secs: 60,
            },
        );

        Self {
            config,
            thresholds: Arc::new(RwLock::new(thresholds)),
            evaluations: Arc::new(RwLock::new(Vec::new())),
            audit_events: Arc::new(RwLock::new(Vec::new())),
            runbook_entries: Arc::new(RwLock::new(Vec::new())),
            last_breach_time: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Evaluate a specific SLO and return the result
    pub fn evaluate_slo(&self, slo_type: SLOType, current_value: f64) -> SLOEvaluation {
        let thresholds = self.thresholds.read().unwrap();
        let threshold = thresholds
            .get(&slo_type)
            .cloned()
            .unwrap_or_else(|| panic!("No threshold defined for {:?}", slo_type));

        let status = self.determine_status(slo_type, current_value, &threshold);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let evaluation = SLOEvaluation {
            slo_type,
            current_value,
            threshold,
            status,
            timestamp,
            evaluation_id: format!("eval-{}-{}", slo_type_to_str(slo_type), timestamp),
        };

        // Store evaluation
        let mut evaluations = self.evaluations.write().unwrap();
        evaluations.push(evaluation.clone());

        // Trim old evaluations
        if evaluations.len() > 10_000 {
            evaluations.drain(0..5_000);
        }

        evaluation
    }

    /// Determine SLO status based on value and thresholds
    fn determine_status(&self, slo_type: SLOType, value: f64, threshold: &SLOThreshold) -> SLOStatus {
        // For latency and error rate, higher is worse
        // For availability and throughput, lower is worse
        match slo_type {
            SLOType::P99Latency | SLOType::P95Latency | SLOType::ErrorRate => {
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

    /// Trigger remediation action in response to SLO violation
    pub fn trigger_remediation(
        &self,
        evaluation: &SLOEvaluation,
        checkpoint_id: Option<String>,
    ) -> Option<RemediationAction> {
        if !self.config.enable_auto_remediation {
            return None;
        }

        // Check cooldown to prevent remediation storms
        let mut last_breach = self.last_breach_time.write().unwrap();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if let Some(&last_time) = last_breach.get(&evaluation.slo_type) {
            if now - last_time < self.config.breach_cooldown_secs {
                return None; // Still in cooldown
            }
        }

        last_breach.insert(evaluation.slo_type, now);

        // Only trigger for Critical or Breached status
        if evaluation.status != SLOStatus::Critical && evaluation.status != SLOStatus::Breached {
            return None;
        }

        let action = self.create_remediation_action(evaluation);

        // Create audit event
        let audit_event = self.create_audit_event(
            "slo_remediation",
            "slo_enforcer",
            &format!("trigger_remediation_{:?}", evaluation.slo_type),
            &evaluation.evaluation_id,
            "scheduled",
            checkpoint_id,
        );

        // Create runbook entry
        self.create_runbook_entry(
            &format!("https://runbook.igris-inertial.com/slo/{:?}", evaluation.slo_type),
            &action.action_type,
            &format!(
                "Auto-remediation for {:?} SLO breach: {} > {}",
                evaluation.slo_type, evaluation.current_value, evaluation.threshold.critical_value
            ),
            &audit_event.event_id,
        );

        Some(action)
    }

    /// Create a remediation action based on SLO type
    fn create_remediation_action(&self, evaluation: &SLOEvaluation) -> RemediationAction {
        let (action_type, target_resource) = match evaluation.slo_type {
            SLOType::P99Latency | SLOType::P95Latency => {
                ("scale_up", "compute_cluster")
            }
            SLOType::ErrorRate => ("restart_unhealthy_nodes", "worker_pool"),
            SLOType::Availability => ("failover_replica", "primary_db"),
            SLOType::Throughput => ("scale_horizontal", "api_gateway"),
        };

        let mut parameters = HashMap::new();
        parameters.insert("slo_type".to_string(), format!("{:?}", evaluation.slo_type));
        parameters.insert(
            "current_value".to_string(),
            evaluation.current_value.to_string(),
        );
        parameters.insert("evaluation_id".to_string(), evaluation.evaluation_id.clone());

        RemediationAction {
            action_type: action_type.to_string(),
            target_resource: target_resource.to_string(),
            parameters,
            triggered_by: "slo_enforcer".to_string(),
            scheduled_at: evaluation.timestamp,
        }
    }

    /// Create an immutable HMAC-signed audit event
    pub fn create_audit_event(
        &self,
        event_type: &str,
        actor: &str,
        action: &str,
        resource: &str,
        outcome: &str,
        checkpoint_id: Option<String>,
    ) -> AuditEvent {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let event_id = format!("audit-{}-{}", event_type, timestamp);

        let event = AuditEvent {
            event_id: event_id.clone(),
            timestamp,
            event_type: event_type.to_string(),
            actor: actor.to_string(),
            action: action.to_string(),
            resource: resource.to_string(),
            outcome: outcome.to_string(),
            metadata: HashMap::new(),
            checkpoint_id,
            hmac_signature: String::new(), // Computed below
        };

        let signature = self.compute_hmac(&event);
        let mut signed_event = event;
        signed_event.hmac_signature = signature;

        // Store audit event
        let mut audit_events = self.audit_events.write().unwrap();
        audit_events.push(signed_event.clone());

        // Trim old audit events
        if audit_events.len() > self.config.max_audit_events {
            audit_events.drain(0..10_000);
        }

        signed_event
    }

    /// Compute HMAC signature for audit event
    fn compute_hmac(&self, event: &AuditEvent) -> String {
        let mut mac = HmacSha256::new_from_slice(&self.config.hmac_secret_key)
            .expect("HMAC can take key of any size");

        let payload = format!(
            "{}|{}|{}|{}|{}|{}|{}",
            event.event_id,
            event.timestamp,
            event.event_type,
            event.actor,
            event.action,
            event.resource,
            event.outcome
        );

        mac.update(payload.as_bytes());
        let result = mac.finalize();
        hex::encode(result.into_bytes())
    }

    /// Verify HMAC signature of an audit event
    pub fn verify_audit_event(&self, event: &AuditEvent) -> bool {
        let computed = self.compute_hmac(event);
        computed == event.hmac_signature
    }

    /// Create a runbook entry linking action to documentation
    pub fn create_runbook_entry(
        &self,
        runbook_url: &str,
        action_type: &str,
        description: &str,
        audit_event_id: &str,
    ) -> RunbookEntry {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let entry = RunbookEntry {
            entry_id: format!("runbook-{}", timestamp),
            timestamp,
            runbook_url: runbook_url.to_string(),
            action_type: action_type.to_string(),
            description: description.to_string(),
            audit_event_id: audit_event_id.to_string(),
        };

        let mut runbook_entries = self.runbook_entries.write().unwrap();
        runbook_entries.push(entry.clone());

        entry
    }

    /// Get SLO status summary
    pub fn get_slo_status(&self) -> HashMap<SLOType, SLOStatus> {
        let evaluations = self.evaluations.read().unwrap();
        let mut status_map = HashMap::new();

        for slo_type in [
            SLOType::P99Latency,
            SLOType::P95Latency,
            SLOType::ErrorRate,
            SLOType::Availability,
            SLOType::Throughput,
        ] {
            let latest = evaluations
                .iter()
                .rev()
                .find(|e| e.slo_type == slo_type)
                .map(|e| e.status)
                .unwrap_or(SLOStatus::Compliant);
            status_map.insert(slo_type, latest);
        }

        status_map
    }

    /// Get SLO history for a specific type
    pub fn get_slo_history(&self, slo_type: SLOType, limit: usize) -> Vec<SLOEvaluation> {
        let evaluations = self.evaluations.read().unwrap();
        evaluations
            .iter()
            .rev()
            .filter(|e| e.slo_type == slo_type)
            .take(limit)
            .cloned()
            .collect()
    }

    /// Get recent audit events
    pub fn get_audit_events(&self, limit: usize) -> Vec<AuditEvent> {
        let audit_events = self.audit_events.read().unwrap();
        audit_events
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    /// Get recent runbook entries
    pub fn get_runbook_entries(&self, limit: usize) -> Vec<RunbookEntry> {
        let runbook_entries = self.runbook_entries.read().unwrap();
        runbook_entries
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    /// Export metrics for monitoring
    pub fn export_metrics(&self) -> HashMap<String, f64> {
        let evaluations = self.evaluations.read().unwrap();
        let audit_events = self.audit_events.read().unwrap();
        let runbook_entries = self.runbook_entries.read().unwrap();

        let mut metrics = HashMap::new();
        metrics.insert("total_evaluations".to_string(), evaluations.len() as f64);
        metrics.insert("total_audit_events".to_string(), audit_events.len() as f64);
        metrics.insert("total_runbook_entries".to_string(), runbook_entries.len() as f64);

        // Count breaches in last hour
        let one_hour_ago = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            - 3600;

        let recent_breaches = evaluations
            .iter()
            .filter(|e| e.timestamp > one_hour_ago && e.status == SLOStatus::Breached)
            .count();

        metrics.insert("slo_breaches_last_hour".to_string(), recent_breaches as f64);

        metrics
    }
}

fn slo_type_to_str(slo_type: SLOType) -> &'static str {
    match slo_type {
        SLOType::P99Latency => "p99_latency",
        SLOType::P95Latency => "p95_latency",
        SLOType::ErrorRate => "error_rate",
        SLOType::Availability => "availability",
        SLOType::Throughput => "throughput",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slo_evaluation_compliant() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        let eval = enforcer.evaluate_slo(SLOType::P99Latency, 80.0);

        assert_eq!(eval.status, SLOStatus::Compliant);
        assert_eq!(eval.current_value, 80.0);
    }

    #[test]
    fn test_slo_evaluation_breached() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        let eval = enforcer.evaluate_slo(SLOType::P99Latency, 160.0);

        assert_eq!(eval.status, SLOStatus::Breached);
    }

    #[test]
    fn test_remediation_triggered_on_breach() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        let eval = enforcer.evaluate_slo(SLOType::P99Latency, 160.0);

        let action = enforcer.trigger_remediation(&eval, Some("checkpoint-123".to_string()));
        assert!(action.is_some());

        let action = action.unwrap();
        assert_eq!(action.action_type, "scale_up");
        assert_eq!(action.target_resource, "compute_cluster");
    }

    #[test]
    fn test_remediation_cooldown() {
        let mut config = SLOEnforcerConfig::default();
        config.breach_cooldown_secs = 10;
        let enforcer = SLOEnforcer::new(config);

        let eval1 = enforcer.evaluate_slo(SLOType::ErrorRate, 0.05);
        let action1 = enforcer.trigger_remediation(&eval1, None);
        assert!(action1.is_some());

        // Immediate second trigger should be blocked by cooldown
        let eval2 = enforcer.evaluate_slo(SLOType::ErrorRate, 0.06);
        let action2 = enforcer.trigger_remediation(&eval2, None);
        assert!(action2.is_none());
    }

    #[test]
    fn test_audit_event_hmac_signature() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        let event = enforcer.create_audit_event(
            "test_event",
            "test_actor",
            "test_action",
            "test_resource",
            "success",
            None,
        );

        assert!(!event.hmac_signature.is_empty());
        assert!(enforcer.verify_audit_event(&event));

        // Tamper with event
        let mut tampered = event.clone();
        tampered.outcome = "failure".to_string();
        assert!(!enforcer.verify_audit_event(&tampered));
    }

    #[test]
    fn test_runbook_entry_creation() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        let entry = enforcer.create_runbook_entry(
            "https://runbook.example.com/scale",
            "scale_up",
            "Scale up compute cluster",
            "audit-123",
        );

        assert_eq!(entry.runbook_url, "https://runbook.example.com/scale");
        assert_eq!(entry.action_type, "scale_up");
        assert_eq!(entry.audit_event_id, "audit-123");
    }

    #[test]
    fn test_slo_status_summary() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        enforcer.evaluate_slo(SLOType::P99Latency, 80.0);
        enforcer.evaluate_slo(SLOType::ErrorRate, 0.05);

        let status = enforcer.get_slo_status();
        assert_eq!(status.get(&SLOType::P99Latency), Some(&SLOStatus::Compliant));
        assert_eq!(status.get(&SLOType::ErrorRate), Some(&SLOStatus::Breached));
    }

    #[test]
    fn test_slo_history() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        for i in 0..10 {
            enforcer.evaluate_slo(SLOType::P99Latency, 50.0 + i as f64);
        }

        let history = enforcer.get_slo_history(SLOType::P99Latency, 5);
        assert_eq!(history.len(), 5);
        assert_eq!(history[0].current_value, 59.0); // Most recent
    }

    #[test]
    fn test_metrics_export() {
        let enforcer = SLOEnforcer::new(SLOEnforcerConfig::default());
        enforcer.evaluate_slo(SLOType::P99Latency, 80.0);
        enforcer.create_audit_event("test", "actor", "action", "resource", "success", None);

        let metrics = enforcer.export_metrics();
        assert_eq!(metrics.get("total_evaluations"), Some(&1.0));
        assert_eq!(metrics.get("total_audit_events"), Some(&1.0));
    }
}
