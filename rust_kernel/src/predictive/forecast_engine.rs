//! Forecast Engine
//!
//! High-level orchestration of forecasting and proactive adjustment.
//! Integrates Horizon Model and Proactive Adjuster.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};

use super::horizon_model::{HorizonModel, HorizonConfig, TimeSeriesData, ForecastHorizon};
use super::proactive_adjuster::{ProactiveAdjuster, AdjustmentConfig, ProactiveDecision};

/// Forecast engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastEngineConfig {
    /// Enable forecasting engine
    pub enabled: bool,

    /// Update interval (seconds)
    pub update_interval_secs: u64,

    /// Metrics to forecast
    pub monitored_metrics: Vec<String>,

    /// Horizon model config
    pub horizon_config: HorizonConfig,

    /// Adjuster config
    pub adjuster_config: AdjustmentConfig,
}

impl Default for ForecastEngineConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            update_interval_secs: 60,
            monitored_metrics: vec![
                "latency_p99".to_string(),
                "throughput".to_string(),
                "error_rate".to_string(),
                "cpu_usage".to_string(),
            ],
            horizon_config: HorizonConfig::default(),
            adjuster_config: AdjustmentConfig::default(),
        }
    }
}

/// Complete forecast result with decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastResult {
    pub metric_name: String,
    pub forecast: ForecastHorizon,
    pub decision: ProactiveDecision,
    pub timestamp: u64,
}

/// Engine-level metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastMetrics {
    pub total_forecasts: u64,
    pub actionable_forecasts: u64,
    pub preemptive_actions: u64,
    pub rollbacks: u64,
    pub forecast_accuracy: f64,
    pub decision_accuracy: f64,
    pub avg_forecast_latency_ms: f64,
    pub uptime_seconds: u64,
}

impl Default for ForecastMetrics {
    fn default() -> Self {
        Self {
            total_forecasts: 0,
            actionable_forecasts: 0,
            preemptive_actions: 0,
            rollbacks: 0,
            forecast_accuracy: 0.0,
            decision_accuracy: 0.0,
            avg_forecast_latency_ms: 0.0,
            uptime_seconds: 0,
        }
    }
}

/// Forecast Engine - orchestrates predictive intelligence
pub struct ForecastEngine {
    config: Arc<RwLock<ForecastEngineConfig>>,
    horizon_models: Arc<RwLock<HashMap<String, HorizonModel>>>,
    adjuster: Arc<RwLock<ProactiveAdjuster>>,
    metrics: Arc<RwLock<ForecastMetrics>>,
    is_running: Arc<RwLock<bool>>,
    start_time: u64,
}

impl ForecastEngine {
    /// Create new forecast engine
    pub fn new(config: ForecastEngineConfig) -> Self {
        let horizon_models = Arc::new(RwLock::new(HashMap::new()));
        let shared_horizon = Arc::new(RwLock::new(HorizonModel::new(config.horizon_config.clone())));
        let adjuster = Arc::new(RwLock::new(
            ProactiveAdjuster::new(config.adjuster_config.clone(), shared_horizon)
        ));

        Self {
            config: Arc::new(RwLock::new(config)),
            horizon_models,
            adjuster,
            metrics: Arc::new(RwLock::new(ForecastMetrics::default())),
            is_running: Arc::new(RwLock::new(false)),
            start_time: Self::current_timestamp(),
        }
    }

    /// Start the forecasting engine
    pub async fn start(&self) {
        let mut is_running = self.is_running.write().await;
        if *is_running {
            return;
        }
        *is_running = true;
        drop(is_running);

        let config = self.config.read().await.clone();
        let update_interval = Duration::from_secs(config.update_interval_secs);

        // Initialize horizon models for each metric
        let mut models = self.horizon_models.write().await;
        for metric_name in &config.monitored_metrics {
            models.insert(
                metric_name.clone(),
                HorizonModel::new(config.horizon_config.clone()),
            );
        }
        drop(models);

        // Spawn background task
        let engine_clone = self.clone_refs();
        tokio::spawn(async move {
            let mut ticker = interval(update_interval);
            loop {
                ticker.tick().await;

                let running = *engine_clone.is_running.read().await;
                if !running {
                    break;
                }

                // Run forecast cycle
                if let Err(e) = engine_clone.run_forecast_cycle().await {
                    eprintln!("Forecast cycle error: {}", e);
                }
            }
        });
    }

    /// Stop the forecasting engine
    pub async fn stop(&self) {
        let mut is_running = self.is_running.write().await;
        *is_running = false;
    }

    /// Ingest metric data point
    pub async fn ingest_metric(&self, data: TimeSeriesData) {
        let mut models = self.horizon_models.write().await;

        if let Some(model) = models.get_mut(&data.metric_name) {
            model.ingest(data);
        } else {
            // Create new model if metric not yet tracked
            let config = self.config.read().await;
            let mut new_model = HorizonModel::new(config.horizon_config.clone());
            new_model.ingest(data.clone());
            models.insert(data.metric_name.clone(), new_model);
        }
    }

    /// Run a single forecast cycle
    async fn run_forecast_cycle(&self) -> Result<(), String> {
        let config = self.config.read().await.clone();

        if !config.enabled {
            return Ok(());
        }

        for metric_name in &config.monitored_metrics {
            let start = std::time::Instant::now();

            // Generate forecast
            let forecast_result = self.forecast_metric(metric_name).await?;

            // Update metrics
            let mut metrics = self.metrics.write().await;
            metrics.total_forecasts += 1;

            if forecast_result.decision.decision_type != super::proactive_adjuster::DecisionType::NoAction {
                metrics.actionable_forecasts += 1;
            }

            if forecast_result.decision.urgent {
                metrics.preemptive_actions += 1;
            }

            if forecast_result.decision.decision_type == super::proactive_adjuster::DecisionType::PreemptiveRollback {
                metrics.rollbacks += 1;
            }

            // Update timing
            let elapsed = start.elapsed().as_millis() as f64;
            let total = metrics.total_forecasts as f64;
            metrics.avg_forecast_latency_ms = (metrics.avg_forecast_latency_ms * (total - 1.0) + elapsed) / total;

            // Update accuracy from underlying models
            let models = self.horizon_models.read().await;
            if let Some(model) = models.get(metric_name) {
                let accuracy = model.get_accuracy_rate();
                metrics.forecast_accuracy = (metrics.forecast_accuracy * (total - 1.0) + accuracy) / total;
            }
            drop(models);

            let adjuster = self.adjuster.read().await;
            let adj_metrics = adjuster.get_metrics().await;
            metrics.decision_accuracy = adj_metrics.decision_accuracy;
        }

        Ok(())
    }

    /// Forecast a specific metric
    pub async fn forecast_metric(&self, metric_name: &str) -> Result<ForecastResult, String> {
        // Generate forecast
        let mut models = self.horizon_models.write().await;
        let model = models.get_mut(metric_name)
            .ok_or_else(|| format!("Model not found for metric: {}", metric_name))?;

        let forecast = model.forecast()
            .map_err(|e| format!("Forecast failed: {}", e))?;
        drop(models);

        // Get proactive decision
        let adjuster = self.adjuster.read().await;
        let decision = adjuster.evaluate(metric_name).await?;

        Ok(ForecastResult {
            metric_name: metric_name.to_string(),
            forecast,
            decision,
            timestamp: Self::current_timestamp(),
        })
    }

    /// Update policy value (called when policy is actually changed)
    pub async fn update_policy(&self, policy_name: &str, value: f64) {
        let adjuster = self.adjuster.write().await;
        adjuster.update_policy(policy_name, value).await;
    }

    /// Record decision outcome for learning
    pub async fn record_outcome(&self, policy_name: &str, success: bool, actual_impact: f64) {
        let adjuster = self.adjuster.write().await;
        adjuster.record_outcome(policy_name, success, actual_impact).await;
    }

    /// Update forecast accuracy based on actual observation
    pub async fn update_forecast_accuracy(&self, metric_name: &str, actual_value: f64) {
        let mut models = self.horizon_models.write().await;
        if let Some(model) = models.get_mut(metric_name) {
            model.update_accuracy(actual_value);
        }
    }

    /// Get comprehensive metrics
    pub async fn get_metrics(&self) -> ForecastMetrics {
        let mut metrics = self.metrics.read().await.clone();
        metrics.uptime_seconds = Self::current_timestamp() - self.start_time;
        metrics
    }

    /// Get recent forecast results
    pub async fn get_recent_forecasts(&self, limit: usize) -> Vec<ForecastResult> {
        let config = self.config.read().await;
        let mut results = Vec::new();

        for metric_name in &config.monitored_metrics {
            if let Ok(forecast) = self.forecast_metric(metric_name).await {
                results.push(forecast);
            }

            if results.len() >= limit {
                break;
            }
        }

        results
    }

    /// Get rollback success rate
    pub async fn get_rollback_success_rate(&self) -> f64 {
        let adjuster = self.adjuster.read().await;
        adjuster.get_rollback_success_rate().await
    }

    /// Check if engine is running
    pub async fn is_running(&self) -> bool {
        *self.is_running.read().await
    }

    /// Clone references for background task
    fn clone_refs(&self) -> Self {
        Self {
            config: Arc::clone(&self.config),
            horizon_models: Arc::clone(&self.horizon_models),
            adjuster: Arc::clone(&self.adjuster),
            metrics: Arc::clone(&self.metrics),
            is_running: Arc::clone(&self.is_running),
            start_time: self.start_time,
        }
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

    #[tokio::test]
    async fn test_forecast_engine_creation() {
        let engine = ForecastEngine::new(ForecastEngineConfig::default());
        assert!(!engine.is_running().await);
    }

    #[tokio::test]
    async fn test_engine_start_stop() {
        let engine = ForecastEngine::new(ForecastEngineConfig::default());

        engine.start().await;
        assert!(engine.is_running().await);

        engine.stop().await;
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(!engine.is_running().await);
    }

    #[tokio::test]
    async fn test_metric_ingestion() {
        let engine = ForecastEngine::new(ForecastEngineConfig::default());

        let data = TimeSeriesData {
            timestamp: ForecastEngine::current_timestamp(),
            value: 100.0,
            metric_name: "test_metric".to_string(),
        };

        engine.ingest_metric(data).await;

        let models = engine.horizon_models.read().await;
        assert!(models.contains_key("test_metric"));
    }

    #[tokio::test]
    async fn test_forecast_generation() {
        let config = ForecastEngineConfig {
            monitored_metrics: vec!["latency".to_string()],
            horizon_config: HorizonConfig {
                min_samples: 5,
                ..Default::default()
            },
            ..Default::default()
        };

        let engine = ForecastEngine::new(config);

        // Start the engine to initialize models
        engine.start().await;

        // Ingest data
        for i in 0..10 {
            engine.ingest_metric(TimeSeriesData {
                timestamp: i,
                value: 100.0 + i as f64,
                metric_name: "latency".to_string(),
            }).await;
        }

        let result = engine.forecast_metric("latency").await;
        assert!(result.is_ok(), "Forecast failed: {:?}", result);

        let forecast_result = result.unwrap();
        assert_eq!(forecast_result.metric_name, "latency");
        assert!(forecast_result.forecast.confidence > 0.0);

        engine.stop().await;
    }

    #[tokio::test]
    async fn test_metrics_tracking() {
        let config = ForecastEngineConfig {
            monitored_metrics: vec!["latency_p99".to_string()],
            horizon_config: HorizonConfig {
                min_samples: 5,
                ..Default::default()
            },
            ..Default::default()
        };
        let engine = ForecastEngine::new(config);

        // Start engine to initialize models
        engine.start().await;

        // Ingest sufficient data
        for i in 0..20 {
            engine.ingest_metric(TimeSeriesData {
                timestamp: i,
                value: 100.0,
                metric_name: "latency_p99".to_string(),
            }).await;
        }

        // Run forecast cycle
        engine.run_forecast_cycle().await.ok();

        let metrics = engine.get_metrics().await;
        assert!(metrics.total_forecasts > 0);

        engine.stop().await;
    }

    #[tokio::test]
    async fn test_policy_update() {
        let engine = ForecastEngine::new(ForecastEngineConfig::default());

        engine.update_policy("test_policy", 150.0).await;

        // Verify through adjuster
        let adjuster = engine.adjuster.read().await;
        let policies = adjuster.current_policies.read().await;
        assert_eq!(policies.get("test_policy"), Some(&150.0));
    }

    #[tokio::test]
    async fn test_outcome_recording() {
        let config = ForecastEngineConfig {
            monitored_metrics: vec!["latency".to_string()],
            horizon_config: HorizonConfig {
                min_samples: 5,
                ..Default::default()
            },
            ..Default::default()
        };
        let engine = ForecastEngine::new(config);

        // Start engine to initialize models
        engine.start().await;

        // First add some data and generate a forecast with decision
        for i in 0..15 {
            engine.ingest_metric(TimeSeriesData {
                timestamp: i,
                value: 100.0 + i as f64 * 2.0,
                metric_name: "latency".to_string(),
            }).await;
        }

        // Update policy so adjuster has a baseline
        engine.update_policy("latency", 100.0).await;

        // Generate forecast to create a decision
        let _ = engine.forecast_metric("latency").await;

        // Record outcome
        engine.record_outcome("latency", true, 25.0).await;

        // Verify metrics updated
        let adjuster = engine.adjuster.read().await;
        let metrics = adjuster.get_metrics().await;
        assert_eq!(metrics.successful_predictions, 1);

        engine.stop().await;
    }
}
