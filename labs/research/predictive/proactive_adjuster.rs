//! Proactive Policy Adjuster
//!
//! Adjusts policies preemptively based on forecasts from the Horizon Model
//! before performance degradation occurs. Implements preemptive rollback
//! when anomalies are predicted.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::horizon_model::{ForecastHorizon, HorizonModel};

/// Configuration for proactive adjuster
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdjustmentConfig {
    /// Enable proactive adjustments
    pub enabled: bool,

    /// Confidence threshold for taking action
    pub action_threshold: f64,

    /// Anomaly score threshold for preemptive rollback
    pub rollback_threshold: f64,

    /// Maximum policy adjustment per iteration (%)
    pub max_adjustment_pct: f64,

    /// Cooldown period after adjustment (seconds)
    pub cooldown_secs: u64,

    /// Enable preemptive rollback
    pub enable_rollback: bool,

    /// Rollback safety margin (multiplier)
    pub rollback_margin: f64,
}

impl Default for AdjustmentConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            action_threshold: 0.80,
            rollback_threshold: 0.75,
            max_adjustment_pct: 20.0,
            cooldown_secs: 300,
            enable_rollback: true,
            rollback_margin: 1.5,
        }
    }
}

/// Proactive decision made by the adjuster
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProactiveDecision {
    /// Decision type
    pub decision_type: DecisionType,

    /// Policy to adjust
    pub policy_name: String,

    /// Current value
    pub current_value: f64,

    /// Recommended value
    pub recommended_value: f64,

    /// Confidence in the decision
    pub confidence: f64,

    /// Reason for the decision
    pub reason: String,

    /// Timestamp
    pub timestamp: u64,

    /// Should this trigger immediate action?
    pub urgent: bool,

    /// Forecast that triggered this decision
    pub triggering_forecast: Option<ForecastHorizon>,
}

/// Type of proactive decision
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DecisionType {
    /// Increase capacity preemptively
    ScaleUp,

    /// Decrease capacity proactively
    ScaleDown,

    /// Adjust policy parameter
    AdjustPolicy,

    /// Preemptive rollback to safe state
    PreemptiveRollback,

    /// No action needed
    NoAction,
}

/// Historical decision tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
struct DecisionHistory {
    pub decision: ProactiveDecision,
    pub outcome: Option<DecisionOutcome>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DecisionOutcome {
    pub success: bool,
    pub actual_impact: f64,
    pub predicted_impact: f64,
    pub timestamp: u64,
}

/// Proactive Policy Adjuster
pub struct ProactiveAdjuster {
    config: AdjustmentConfig,
    horizon_model: Arc<RwLock<HorizonModel>>,
    decision_history: Arc<RwLock<Vec<DecisionHistory>>>,
    last_adjustment_time: Arc<RwLock<HashMap<String, u64>>>,
    pub(crate) current_policies: Arc<RwLock<HashMap<String, f64>>>,
    metrics: Arc<RwLock<AdjusterMetrics>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdjusterMetrics {
    pub total_decisions: u64,
    pub preemptive_actions: u64,
    pub rollbacks: u64,
    pub successful_predictions: u64,
    pub false_positives: u64,
    pub avg_response_time_ms: f64,
    pub decision_accuracy: f64,
}

impl Default for AdjusterMetrics {
    fn default() -> Self {
        Self {
            total_decisions: 0,
            preemptive_actions: 0,
            rollbacks: 0,
            successful_predictions: 0,
            false_positives: 0,
            avg_response_time_ms: 0.0,
            decision_accuracy: 0.0,
        }
    }
}

impl ProactiveAdjuster {
    /// Create new proactive adjuster
    pub fn new(config: AdjustmentConfig, horizon_model: Arc<RwLock<HorizonModel>>) -> Self {
        Self {
            config,
            horizon_model,
            decision_history: Arc::new(RwLock::new(Vec::new())),
            last_adjustment_time: Arc::new(RwLock::new(HashMap::new())),
            current_policies: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(AdjusterMetrics::default())),
        }
    }

    /// Evaluate forecasts and make proactive decisions
    pub async fn evaluate(&self, metric_name: &str) -> Result<ProactiveDecision, String> {
        if !self.config.enabled {
            return Ok(ProactiveDecision {
                decision_type: DecisionType::NoAction,
                policy_name: metric_name.to_string(),
                current_value: 0.0,
                recommended_value: 0.0,
                confidence: 0.0,
                reason: "Proactive adjustment disabled".to_string(),
                timestamp: Self::current_timestamp(),
                urgent: false,
                triggering_forecast: None,
            });
        }

        // Check cooldown
        if self.is_in_cooldown(metric_name).await {
            return Ok(ProactiveDecision {
                decision_type: DecisionType::NoAction,
                policy_name: metric_name.to_string(),
                current_value: 0.0,
                recommended_value: 0.0,
                confidence: 0.0,
                reason: "In cooldown period".to_string(),
                timestamp: Self::current_timestamp(),
                urgent: false,
                triggering_forecast: None,
            });
        }

        // Get forecast from horizon model
        let mut horizon = self.horizon_model.write().await;
        let forecast = horizon.forecast()
            .map_err(|e| format!("Forecast error: {}", e))?;

        // Only proceed if confidence is above threshold
        if forecast.confidence < self.config.action_threshold {
            return Ok(ProactiveDecision {
                decision_type: DecisionType::NoAction,
                policy_name: metric_name.to_string(),
                current_value: 0.0,
                recommended_value: 0.0,
                confidence: forecast.confidence,
                reason: format!("Confidence too low: {:.2}", forecast.confidence),
                timestamp: Self::current_timestamp(),
                urgent: false,
                triggering_forecast: Some(forecast),
            });
        }

        // Get current policy value
        let policies = self.current_policies.read().await;
        let current_value = policies.get(metric_name).copied().unwrap_or(0.0);
        drop(policies);

        // Determine decision based on forecast
        let decision = self.make_decision(&forecast, metric_name, current_value).await;

        // Record decision
        let mut history = self.decision_history.write().await;
        history.push(DecisionHistory {
            decision: decision.clone(),
            outcome: None,
        });

        // Update last adjustment time if actionable
        if decision.decision_type != DecisionType::NoAction {
            let mut last_adj = self.last_adjustment_time.write().await;
            last_adj.insert(metric_name.to_string(), Self::current_timestamp());

            // Update metrics
            let mut metrics = self.metrics.write().await;
            metrics.total_decisions += 1;
            if decision.urgent {
                metrics.preemptive_actions += 1;
            }
            if decision.decision_type == DecisionType::PreemptiveRollback {
                metrics.rollbacks += 1;
            }
        }

        Ok(decision)
    }

    /// Make proactive decision based on forecast
    async fn make_decision(
        &self,
        forecast: &ForecastHorizon,
        metric_name: &str,
        current_value: f64,
    ) -> ProactiveDecision {
        let predicted = forecast.predicted_value;
        let confidence = forecast.confidence;

        // Check for anomaly - potential preemptive rollback
        if self.config.enable_rollback && self.is_anomaly_predicted(forecast) {
            return ProactiveDecision {
                decision_type: DecisionType::PreemptiveRollback,
                policy_name: metric_name.to_string(),
                current_value,
                recommended_value: current_value * 0.7, // Reduce to 70% capacity
                confidence,
                reason: format!(
                    "Anomaly predicted: value exceeding confidence bounds (predicted: {:.2}, upper: {:.2})",
                    predicted, forecast.confidence_upper
                ),
                timestamp: Self::current_timestamp(),
                urgent: true,
                triggering_forecast: Some(forecast.clone()),
            };
        }

        // Determine if scaling is needed based on trend
        match forecast.trend.as_str() {
            "increasing" => {
                let increase_factor = 1.0 + (self.config.max_adjustment_pct / 100.0);
                let recommended = (current_value * increase_factor).min(current_value * 1.5);

                ProactiveDecision {
                    decision_type: DecisionType::ScaleUp,
                    policy_name: metric_name.to_string(),
                    current_value,
                    recommended_value: recommended,
                    confidence,
                    reason: format!(
                        "Increasing trend detected, predicted value: {:.2}, current: {:.2}",
                        predicted, current_value
                    ),
                    timestamp: Self::current_timestamp(),
                    urgent: predicted > forecast.confidence_upper,
                    triggering_forecast: Some(forecast.clone()),
                }
            }
            "decreasing" => {
                let decrease_factor = 1.0 - (self.config.max_adjustment_pct / 100.0);
                let recommended = (current_value * decrease_factor).max(current_value * 0.5);

                ProactiveDecision {
                    decision_type: DecisionType::ScaleDown,
                    policy_name: metric_name.to_string(),
                    current_value,
                    recommended_value: recommended,
                    confidence,
                    reason: format!(
                        "Decreasing trend detected, predicted value: {:.2}, current: {:.2}",
                        predicted, current_value
                    ),
                    timestamp: Self::current_timestamp(),
                    urgent: false,
                    triggering_forecast: Some(forecast.clone()),
                }
            }
            _ => {
                // Stable or no clear trend
                let adjustment_needed = (predicted - current_value).abs() / current_value.max(1.0) > 0.15;

                if adjustment_needed {
                    ProactiveDecision {
                        decision_type: DecisionType::AdjustPolicy,
                        policy_name: metric_name.to_string(),
                        current_value,
                        recommended_value: predicted,
                        confidence,
                        reason: format!(
                            "Significant deviation predicted: {:.2} vs current {:.2}",
                            predicted, current_value
                        ),
                        timestamp: Self::current_timestamp(),
                        urgent: false,
                        triggering_forecast: Some(forecast.clone()),
                    }
                } else {
                    ProactiveDecision {
                        decision_type: DecisionType::NoAction,
                        policy_name: metric_name.to_string(),
                        current_value,
                        recommended_value: current_value,
                        confidence,
                        reason: "System stable, no adjustment needed".to_string(),
                        timestamp: Self::current_timestamp(),
                        urgent: false,
                        triggering_forecast: Some(forecast.clone()),
                    }
                }
            }
        }
    }

    /// Check if forecast predicts an anomaly
    fn is_anomaly_predicted(&self, forecast: &ForecastHorizon) -> bool {
        // Anomaly if predicted value exceeds confidence bounds by significant margin
        let exceeds_upper = forecast.predicted_value > forecast.confidence_upper * self.config.rollback_margin;
        let below_lower = forecast.predicted_value < forecast.confidence_lower / self.config.rollback_margin;

        exceeds_upper || below_lower
    }

    /// Check if metric is in cooldown period
    async fn is_in_cooldown(&self, metric_name: &str) -> bool {
        let last_adj = self.last_adjustment_time.read().await;
        if let Some(&last_time) = last_adj.get(metric_name) {
            let elapsed = Self::current_timestamp() - last_time;
            elapsed < self.config.cooldown_secs
        } else {
            false
        }
    }

    /// Update current policy value
    pub async fn update_policy(&self, policy_name: &str, value: f64) {
        let mut policies = self.current_policies.write().await;
        policies.insert(policy_name.to_string(), value);
    }

    /// Record decision outcome for accuracy tracking
    pub async fn record_outcome(&self, policy_name: &str, success: bool, actual_impact: f64) {
        let mut history = self.decision_history.write().await;

        // Find most recent decision for this policy
        if let Some(entry) = history.iter_mut()
            .filter(|h| h.decision.policy_name == policy_name)
            .last()
        {
            let predicted_impact = entry.decision.recommended_value - entry.decision.current_value;

            entry.outcome = Some(DecisionOutcome {
                success,
                actual_impact,
                predicted_impact,
                timestamp: Self::current_timestamp(),
            });

            // Update metrics
            let mut metrics = self.metrics.write().await;
            if success {
                metrics.successful_predictions += 1;
            } else {
                metrics.false_positives += 1;
            }

            let total = metrics.successful_predictions + metrics.false_positives;
            metrics.decision_accuracy = metrics.successful_predictions as f64 / total.max(1) as f64;
        }
    }

    /// Get adjuster metrics
    pub async fn get_metrics(&self) -> AdjusterMetrics {
        self.metrics.read().await.clone()
    }

    /// Get decision history
    pub async fn get_decision_history(&self, limit: usize) -> Vec<DecisionHistory> {
        let history = self.decision_history.read().await;
        history.iter().rev().take(limit).cloned().collect()
    }

    /// Get rollback success rate
    pub async fn get_rollback_success_rate(&self) -> f64 {
        let history = self.decision_history.read().await;

        let rollback_decisions: Vec<_> = history.iter()
            .filter(|h| h.decision.decision_type == DecisionType::PreemptiveRollback)
            .collect();

        if rollback_decisions.is_empty() {
            return 0.0;
        }

        let successful = rollback_decisions.iter()
            .filter(|h| {
                h.outcome.as_ref()
                    .map(|o| o.success)
                    .unwrap_or(false)
            })
            .count();

        successful as f64 / rollback_decisions.len() as f64
    }

    fn current_timestamp() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::predictive::horizon_model::{HorizonConfig, TimeSeriesData};

    #[tokio::test]
    async fn test_proactive_adjuster_creation() {
        let horizon_model = Arc::new(RwLock::new(HorizonModel::new(HorizonConfig::default())));
        let adjuster = ProactiveAdjuster::new(AdjustmentConfig::default(), horizon_model);

        let metrics = adjuster.get_metrics().await;
        assert_eq!(metrics.total_decisions, 0);
    }

    #[tokio::test]
    async fn test_disabled_adjuster() {
        let horizon_model = Arc::new(RwLock::new(HorizonModel::new(HorizonConfig::default())));
        let config = AdjustmentConfig {
            enabled: false,
            ..Default::default()
        };
        let adjuster = ProactiveAdjuster::new(config, horizon_model);

        let decision = adjuster.evaluate("test_metric").await.unwrap();
        assert_eq!(decision.decision_type, DecisionType::NoAction);
    }

    #[tokio::test]
    async fn test_policy_update() {
        let horizon_model = Arc::new(RwLock::new(HorizonModel::new(HorizonConfig::default())));
        let adjuster = ProactiveAdjuster::new(AdjustmentConfig::default(), horizon_model);

        adjuster.update_policy("latency", 100.0).await;

        let policies = adjuster.current_policies.read().await;
        assert_eq!(policies.get("latency"), Some(&100.0));
    }

    #[tokio::test]
    async fn test_cooldown_period() {
        let horizon_model = Arc::new(RwLock::new(HorizonModel::new(HorizonConfig::default())));
        let config = AdjustmentConfig {
            cooldown_secs: 3600, // 1 hour
            ..Default::default()
        };
        let adjuster = ProactiveAdjuster::new(config, horizon_model);

        // Simulate recent adjustment
        let mut last_adj = adjuster.last_adjustment_time.write().await;
        last_adj.insert("test_metric".to_string(), ProactiveAdjuster::current_timestamp());
        drop(last_adj);

        let in_cooldown = adjuster.is_in_cooldown("test_metric").await;
        assert!(in_cooldown);
    }

    #[tokio::test]
    async fn test_outcome_recording() {
        let horizon_model = Arc::new(RwLock::new(HorizonModel::new(HorizonConfig::default())));
        let adjuster = ProactiveAdjuster::new(AdjustmentConfig::default(), horizon_model);

        // Add a decision to history
        let decision = ProactiveDecision {
            decision_type: DecisionType::ScaleUp,
            policy_name: "test_policy".to_string(),
            current_value: 100.0,
            recommended_value: 120.0,
            confidence: 0.9,
            reason: "Test".to_string(),
            timestamp: ProactiveAdjuster::current_timestamp(),
            urgent: false,
            triggering_forecast: None,
        };

        let mut history = adjuster.decision_history.write().await;
        history.push(DecisionHistory {
            decision,
            outcome: None,
        });
        drop(history);

        // Record outcome
        adjuster.record_outcome("test_policy", true, 20.0).await;

        let history = adjuster.decision_history.read().await;
        let outcome = &history.last().unwrap().outcome;
        assert!(outcome.is_some());
        assert!(outcome.as_ref().unwrap().success);
    }

    #[tokio::test]
    async fn test_rollback_success_rate() {
        let horizon_model = Arc::new(RwLock::new(HorizonModel::new(HorizonConfig::default())));
        let adjuster = ProactiveAdjuster::new(AdjustmentConfig::default(), horizon_model);

        // Add rollback decisions
        let decision1 = ProactiveDecision {
            decision_type: DecisionType::PreemptiveRollback,
            policy_name: "test".to_string(),
            current_value: 100.0,
            recommended_value: 70.0,
            confidence: 0.9,
            reason: "Anomaly".to_string(),
            timestamp: ProactiveAdjuster::current_timestamp(),
            urgent: true,
            triggering_forecast: None,
        };

        let mut history = adjuster.decision_history.write().await;
        history.push(DecisionHistory {
            decision: decision1.clone(),
            outcome: Some(DecisionOutcome {
                success: true,
                actual_impact: 30.0,
                predicted_impact: 30.0,
                timestamp: ProactiveAdjuster::current_timestamp(),
            }),
        });

        history.push(DecisionHistory {
            decision: decision1,
            outcome: Some(DecisionOutcome {
                success: false,
                actual_impact: 10.0,
                predicted_impact: 30.0,
                timestamp: ProactiveAdjuster::current_timestamp(),
            }),
        });
        drop(history);

        let success_rate = adjuster.get_rollback_success_rate().await;
        assert!((success_rate - 0.5).abs() < 0.01);
    }
}
