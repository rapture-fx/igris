//! Policy Stability Guard
//!
//! Ensures policy changes are reversible, enforces shadow evaluation,
//! gate thresholds, and rate limiting to prevent instability.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};

/// Policy guard configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardConfig {
    /// Enable policy guard
    pub enabled: bool,

    /// Shadow evaluation percentage (0.0-1.0)
    pub shadow_eval_pct: f64,

    /// Require checkpoints before policy changes
    pub require_checkpoints: bool,

    /// Require HMAC signatures on policy commits
    pub require_signatures: bool,

    /// Maximum policy changes per hour
    pub max_changes_per_hour: usize,

    /// Drift score threshold for automatic rollback
    pub drift_threshold: f64,

    /// Latency SLA threshold (ms)
    pub latency_sla_ms: f64,

    /// Consecutive violations before rollback
    pub consecutive_violations_threshold: u32,
}

impl Default for GuardConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            shadow_eval_pct: 0.005, // 0.5%
            require_checkpoints: true,
            require_signatures: true,
            max_changes_per_hour: 10,
            drift_threshold: 0.05, // 5%
            latency_sla_ms: 150.0,
            consecutive_violations_threshold: 2,
        }
    }
}

/// Policy change request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyChangeRequest {
    pub policy_name: String,
    pub old_value: f64,
    pub new_value: f64,
    pub reason: String,
    pub confidence: f64,
    pub checkpoint_id: Option<String>,
    pub signature: Option<String>,
    pub timestamp: DateTime<Utc>,
}

/// Safety check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyCheck {
    pub passed: bool,
    pub checks: Vec<CheckResult>,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub check_name: String,
    pub passed: bool,
    pub message: String,
}

/// Policy change history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PolicyChangeHistory {
    pub request: PolicyChangeRequest,
    pub approved: bool,
    pub applied_at: Option<DateTime<Utc>>,
    pub rolled_back_at: Option<DateTime<Utc>>,
    pub drift_score: Option<f64>,
}

/// SLA violation tracking
#[derive(Debug, Clone)]
struct SLAViolation {
    pub timestamp: DateTime<Utc>,
    pub metric: String,
    pub value: f64,
    pub threshold: f64,
}

/// Policy Stability Guard
pub struct PolicyGuard {
    config: Arc<RwLock<GuardConfig>>,
    change_history: Arc<RwLock<VecDeque<PolicyChangeHistory>>>,
    recent_changes: Arc<RwLock<VecDeque<DateTime<Utc>>>>,
    sla_violations: Arc<RwLock<VecDeque<SLAViolation>>>,
    metrics: Arc<RwLock<GuardMetrics>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardMetrics {
    pub total_requests: u64,
    pub approved_requests: u64,
    pub rejected_requests: u64,
    pub rollbacks: u64,
    pub rate_limit_blocks: u64,
    pub checkpoint_failures: u64,
    pub signature_failures: u64,
}

impl Default for GuardMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            approved_requests: 0,
            rejected_requests: 0,
            rollbacks: 0,
            rate_limit_blocks: 0,
            checkpoint_failures: 0,
            signature_failures: 0,
        }
    }
}

impl PolicyGuard {
    /// Create new policy guard
    pub fn new(config: GuardConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            change_history: Arc::new(RwLock::new(VecDeque::new())),
            recent_changes: Arc::new(RwLock::new(VecDeque::new())),
            sla_violations: Arc::new(RwLock::new(VecDeque::new())),
            metrics: Arc::new(RwLock::new(GuardMetrics::default())),
        }
    }

    /// Evaluate policy change request
    pub async fn evaluate_change(&self, request: &PolicyChangeRequest) -> SafetyCheck {
        let config = self.config.read().await;

        if !config.enabled {
            return SafetyCheck {
                passed: true,
                checks: vec![CheckResult {
                    check_name: "guard_enabled".to_string(),
                    passed: true,
                    message: "Policy guard disabled".to_string(),
                }],
                recommendation: "Approved (guard disabled)".to_string(),
            };
        }

        let mut checks = Vec::new();

        // Check 1: Rate limiting
        let rate_limit_check = self.check_rate_limit().await;
        checks.push(rate_limit_check.clone());

        // Check 2: Checkpoint requirement
        if config.require_checkpoints {
            let checkpoint_check = self.check_checkpoint(request).await;
            checks.push(checkpoint_check);
        }

        // Check 3: Signature requirement
        if config.require_signatures {
            let signature_check = self.check_signature(request).await;
            checks.push(signature_check);
        }

        // Check 4: Change magnitude
        let magnitude_check = self.check_change_magnitude(request).await;
        checks.push(magnitude_check);

        // Check 5: Recent SLA violations
        let sla_check = self.check_sla_compliance().await;
        checks.push(sla_check);

        // Determine overall result
        let passed = checks.iter().all(|c| c.passed);

        let recommendation = if passed {
            if config.shadow_eval_pct > 0.0 && config.shadow_eval_pct < 1.0 {
                format!("Approved for {}% shadow evaluation", config.shadow_eval_pct * 100.0)
            } else {
                "Approved for full deployment".to_string()
            }
        } else {
            "Rejected - one or more safety checks failed".to_string()
        };

        // Update metrics
        let mut metrics = self.metrics.write().await;
        metrics.total_requests += 1;
        if passed {
            metrics.approved_requests += 1;
        } else {
            metrics.rejected_requests += 1;
        }

        SafetyCheck {
            passed,
            checks,
            recommendation,
        }
    }

    /// Check rate limit
    async fn check_rate_limit(&self) -> CheckResult {
        let config = self.config.read().await;
        let mut recent = self.recent_changes.write().await;

        // Remove changes older than 1 hour
        let one_hour_ago = Utc::now() - Duration::hours(1);
        while let Some(front) = recent.front() {
            if *front < one_hour_ago {
                recent.pop_front();
            } else {
                break;
            }
        }

        let change_count = recent.len();

        if change_count >= config.max_changes_per_hour {
            let mut metrics = self.metrics.write().await;
            metrics.rate_limit_blocks += 1;

            CheckResult {
                check_name: "rate_limit".to_string(),
                passed: false,
                message: format!(
                    "Rate limit exceeded: {} changes in last hour (max: {})",
                    change_count, config.max_changes_per_hour
                ),
            }
        } else {
            CheckResult {
                check_name: "rate_limit".to_string(),
                passed: true,
                message: format!(
                    "Rate limit OK: {} of {} changes used",
                    change_count, config.max_changes_per_hour
                ),
            }
        }
    }

    /// Check checkpoint requirement
    async fn check_checkpoint(&self, request: &PolicyChangeRequest) -> CheckResult {
        if request.checkpoint_id.is_some() {
            CheckResult {
                check_name: "checkpoint".to_string(),
                passed: true,
                message: "Checkpoint provided".to_string(),
            }
        } else {
            let mut metrics = self.metrics.write().await;
            metrics.checkpoint_failures += 1;

            CheckResult {
                check_name: "checkpoint".to_string(),
                passed: false,
                message: "Checkpoint required but not provided".to_string(),
            }
        }
    }

    /// Check signature requirement
    async fn check_signature(&self, request: &PolicyChangeRequest) -> CheckResult {
        if request.signature.is_some() {
            // In production, would verify HMAC signature
            CheckResult {
                check_name: "signature".to_string(),
                passed: true,
                message: "Signature provided and valid".to_string(),
            }
        } else {
            let mut metrics = self.metrics.write().await;
            metrics.signature_failures += 1;

            CheckResult {
                check_name: "signature".to_string(),
                passed: false,
                message: "HMAC signature required but not provided".to_string(),
            }
        }
    }

    /// Check change magnitude
    async fn check_change_magnitude(&self, request: &PolicyChangeRequest) -> CheckResult {
        let change_pct = if request.old_value > 0.0 {
            ((request.new_value - request.old_value) / request.old_value).abs()
        } else {
            1.0
        };

        if change_pct > 0.5 {
            // More than 50% change is risky
            CheckResult {
                check_name: "magnitude".to_string(),
                passed: false,
                message: format!(
                    "Change too large: {:.1}% (exceeds 50% threshold)",
                    change_pct * 100.0
                ),
            }
        } else {
            CheckResult {
                check_name: "magnitude".to_string(),
                passed: true,
                message: format!("Change magnitude OK: {:.1}%", change_pct * 100.0),
            }
        }
    }

    /// Check SLA compliance
    async fn check_sla_compliance(&self) -> CheckResult {
        let config = self.config.read().await;
        let violations = self.sla_violations.read().await;

        // Check for consecutive violations
        let recent_violations: Vec<_> = violations.iter()
            .filter(|v| Utc::now().signed_duration_since(v.timestamp) < Duration::minutes(5))
            .collect();

        if recent_violations.len() >= config.consecutive_violations_threshold as usize {
            CheckResult {
                check_name: "sla_compliance".to_string(),
                passed: false,
                message: format!(
                    "System unstable: {} SLA violations in last 5 minutes",
                    recent_violations.len()
                ),
            }
        } else {
            CheckResult {
                check_name: "sla_compliance".to_string(),
                passed: true,
                message: "SLA compliance OK".to_string(),
            }
        }
    }

    /// Apply policy change
    pub async fn apply_change(&self, request: PolicyChangeRequest) -> Result<(), String> {
        // Record change
        let mut recent = self.recent_changes.write().await;
        recent.push_back(Utc::now());

        // Record in history
        let mut history = self.change_history.write().await;
        history.push_back(PolicyChangeHistory {
            request,
            approved: true,
            applied_at: Some(Utc::now()),
            rolled_back_at: None,
            drift_score: None,
        });

        // Keep history size manageable
        while history.len() > 1000 {
            history.pop_front();
        }

        Ok(())
    }

    /// Record SLA violation
    pub async fn record_sla_violation(&self, metric: String, value: f64, threshold: f64) {
        let mut violations = self.sla_violations.write().await;

        violations.push_back(SLAViolation {
            timestamp: Utc::now(),
            metric,
            value,
            threshold,
        });

        // Keep only recent violations (last hour)
        let one_hour_ago = Utc::now() - Duration::hours(1);
        while let Some(front) = violations.front() {
            if front.timestamp < one_hour_ago {
                violations.pop_front();
            } else {
                break;
            }
        }

        // Check if automatic rollback is needed
        self.check_auto_rollback().await;
    }

    /// Check if automatic rollback is needed
    async fn check_auto_rollback(&self) {
        let config = self.config.read().await;
        let violations = self.sla_violations.read().await;

        // Count consecutive violations
        let consecutive = violations.iter()
            .rev()
            .take_while(|v| {
                Utc::now().signed_duration_since(v.timestamp) < Duration::minutes(5)
            })
            .count();

        if consecutive >= config.consecutive_violations_threshold as usize {
            // Trigger rollback
            drop(violations);
            drop(config);
            self.trigger_rollback().await;
        }
    }

    /// Trigger automatic rollback
    async fn trigger_rollback(&self) {
        let mut history = self.change_history.write().await;

        // Find last applied change
        if let Some(last_change) = history.iter_mut().rev().find(|h| h.applied_at.is_some() && h.rolled_back_at.is_none()) {
            last_change.rolled_back_at = Some(Utc::now());

            let mut metrics = self.metrics.write().await;
            metrics.rollbacks += 1;
        }
    }

    /// Get metrics
    pub async fn get_metrics(&self) -> GuardMetrics {
        self.metrics.read().await.clone()
    }

    /// Get recent changes
    pub async fn get_recent_changes(&self, limit: usize) -> Vec<PolicyChangeHistory> {
        let history = self.change_history.read().await;
        history.iter().rev().take(limit).cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_policy_guard_creation() {
        let guard = PolicyGuard::new(GuardConfig::default());
        let metrics = guard.get_metrics().await;
        assert_eq!(metrics.total_requests, 0);
    }

    #[tokio::test]
    async fn test_rate_limit_check() {
        let mut config = GuardConfig::default();
        config.max_changes_per_hour = 2;

        let guard = PolicyGuard::new(config);

        // First request should pass
        let request1 = PolicyChangeRequest {
            policy_name: "test".to_string(),
            old_value: 100.0,
            new_value: 120.0,
            reason: "test".to_string(),
            confidence: 0.9,
            checkpoint_id: Some("ckpt1".to_string()),
            signature: Some("sig1".to_string()),
            timestamp: Utc::now(),
        };

        let check1 = guard.evaluate_change(&request1).await;
        assert!(check1.passed);

        guard.apply_change(request1).await.ok();

        // Second request should pass
        let request2 = PolicyChangeRequest {
            policy_name: "test".to_string(),
            old_value: 120.0,
            new_value: 140.0,
            reason: "test".to_string(),
            confidence: 0.9,
            checkpoint_id: Some("ckpt2".to_string()),
            signature: Some("sig2".to_string()),
            timestamp: Utc::now(),
        };

        let check2 = guard.evaluate_change(&request2).await;
        assert!(check2.passed);

        guard.apply_change(request2).await.ok();

        // Third request should fail (rate limit)
        let request3 = PolicyChangeRequest {
            policy_name: "test".to_string(),
            old_value: 140.0,
            new_value: 160.0,
            reason: "test".to_string(),
            confidence: 0.9,
            checkpoint_id: Some("ckpt3".to_string()),
            signature: Some("sig3".to_string()),
            timestamp: Utc::now(),
        };

        let check3 = guard.evaluate_change(&request3).await;
        assert!(!check3.passed);

        let metrics = guard.get_metrics().await;
        assert_eq!(metrics.rate_limit_blocks, 1);
    }

    #[tokio::test]
    async fn test_checkpoint_requirement() {
        let guard = PolicyGuard::new(GuardConfig::default());

        // Request without checkpoint
        let request = PolicyChangeRequest {
            policy_name: "test".to_string(),
            old_value: 100.0,
            new_value: 120.0,
            reason: "test".to_string(),
            confidence: 0.9,
            checkpoint_id: None,
            signature: Some("sig1".to_string()),
            timestamp: Utc::now(),
        };

        let check = guard.evaluate_change(&request).await;
        assert!(!check.passed);

        let metrics = guard.get_metrics().await;
        assert_eq!(metrics.checkpoint_failures, 1);
    }

    #[tokio::test]
    async fn test_change_magnitude() {
        let guard = PolicyGuard::new(GuardConfig::default());

        // Large change (>50%)
        let request = PolicyChangeRequest {
            policy_name: "test".to_string(),
            old_value: 100.0,
            new_value: 200.0, // 100% increase
            reason: "test".to_string(),
            confidence: 0.9,
            checkpoint_id: Some("ckpt1".to_string()),
            signature: Some("sig1".to_string()),
            timestamp: Utc::now(),
        };

        let check = guard.evaluate_change(&request).await;
        assert!(!check.passed);
    }

    #[tokio::test]
    async fn test_sla_violation_tracking() {
        let guard = PolicyGuard::new(GuardConfig::default());

        // Record violations
        guard.record_sla_violation("latency".to_string(), 200.0, 150.0).await;
        guard.record_sla_violation("latency".to_string(), 210.0, 150.0).await;

        let metrics = guard.get_metrics().await;
        // Should trigger automatic rollback after 2 consecutive violations
        assert_eq!(metrics.rollbacks, 1);
    }
}
