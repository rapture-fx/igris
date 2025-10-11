//! Predictive Horizon Model
//!
//! Forecasts future system states using simplified LSTM-like time series
//! analysis to enable proactive policy adjustments.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// Configuration for horizon model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizonConfig {
    /// Enable forecasting
    pub enabled: bool,

    /// Prediction horizon (minutes)
    pub horizon_minutes: usize,

    /// Historical window size (samples)
    pub window_size: usize,

    /// Minimum samples before forecasting
    pub min_samples: usize,

    /// Forecast update interval (seconds)
    pub update_interval_secs: u64,

    /// Confidence threshold for actionable forecasts
    pub confidence_threshold: f64,
}

impl Default for HorizonConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            horizon_minutes: 15,
            window_size: 60,
            min_samples: 20,
            update_interval_secs: 60,
            confidence_threshold: 0.85,
        }
    }
}

/// Time series data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeriesData {
    pub timestamp: u64,
    pub value: f64,
    pub metric_name: String,
}

/// Forecast for a specific horizon
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastHorizon {
    /// Predicted value
    pub predicted_value: f64,

    /// Confidence interval (lower bound)
    pub confidence_lower: f64,

    /// Confidence interval (upper bound)
    pub confidence_upper: f64,

    /// Confidence score (0.0-1.0)
    pub confidence: f64,

    /// Horizon time (minutes ahead)
    pub horizon_minutes: usize,

    /// Metric being forecasted
    pub metric_name: String,

    /// Timestamp of forecast
    pub forecast_timestamp: u64,

    /// Trend direction: "increasing", "decreasing", "stable"
    pub trend: String,
}

/// Simplified LSTM-like state for time series
#[derive(Debug, Clone)]
struct LSTMState {
    hidden_state: Vec<f64>,
    cell_state: Vec<f64>,
    weights: Vec<Vec<f64>>,
}

/// Predictive Horizon Model
pub struct HorizonModel {
    config: HorizonConfig,
    historical_data: VecDeque<TimeSeriesData>,
    lstm_state: Option<LSTMState>,
    last_forecast: Option<ForecastHorizon>,
    metrics: HorizonMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizonMetrics {
    pub total_forecasts: u64,
    pub accurate_forecasts: u64,
    pub avg_confidence: f64,
    pub avg_error: f64,
    pub last_forecast_timestamp: u64,
}

impl Default for HorizonMetrics {
    fn default() -> Self {
        Self {
            total_forecasts: 0,
            accurate_forecasts: 0,
            avg_confidence: 0.0,
            avg_error: 0.0,
            last_forecast_timestamp: 0,
        }
    }
}

impl HorizonModel {
    /// Create new horizon model
    pub fn new(config: HorizonConfig) -> Self {
        Self {
            config,
            historical_data: VecDeque::new(),
            lstm_state: None,
            last_forecast: None,
            metrics: HorizonMetrics::default(),
        }
    }

    /// Ingest new time series data point
    pub fn ingest(&mut self, data: TimeSeriesData) {
        self.historical_data.push_back(data);

        // Maintain window size
        while self.historical_data.len() > self.config.window_size {
            self.historical_data.pop_front();
        }
    }

    /// Generate forecast for the configured horizon
    pub fn forecast(&mut self) -> Result<ForecastHorizon, String> {
        if !self.config.enabled {
            return Err("Forecasting disabled".to_string());
        }

        if self.historical_data.len() < self.config.min_samples {
            return Err(format!(
                "Insufficient data: {} < {}",
                self.historical_data.len(),
                self.config.min_samples
            ));
        }

        // Extract values
        let values: Vec<f64> = self.historical_data.iter().map(|d| d.value).collect();
        let metric_name = self.historical_data.back()
            .map(|d| d.metric_name.clone())
            .unwrap_or_else(|| "unknown".to_string());

        // Simple exponential smoothing + trend analysis
        let (predicted, confidence, trend) = self.exponential_smoothing_forecast(&values)?;

        // Confidence intervals (±1 std dev)
        let std_dev = self.calculate_std_dev(&values);
        let confidence_lower = predicted - std_dev;
        let confidence_upper = predicted + std_dev;

        let forecast = ForecastHorizon {
            predicted_value: predicted,
            confidence_lower,
            confidence_upper,
            confidence,
            horizon_minutes: self.config.horizon_minutes,
            metric_name,
            forecast_timestamp: Self::current_timestamp(),
            trend,
        };

        // Update metrics
        self.metrics.total_forecasts += 1;
        self.metrics.last_forecast_timestamp = forecast.forecast_timestamp;
        self.metrics.avg_confidence = (self.metrics.avg_confidence * (self.metrics.total_forecasts - 1) as f64
            + confidence) / self.metrics.total_forecasts as f64;

        self.last_forecast = Some(forecast.clone());

        Ok(forecast)
    }

    /// Exponential smoothing with trend
    fn exponential_smoothing_forecast(&self, values: &[f64]) -> Result<(f64, f64, String), String> {
        if values.is_empty() {
            return Err("Empty values".to_string());
        }

        // Double exponential smoothing (Holt's method)
        let alpha = 0.3; // Level smoothing
        let beta = 0.1;  // Trend smoothing

        let mut level = values[0];
        let mut trend = 0.0;

        for &value in values.iter().skip(1) {
            let prev_level = level;
            level = alpha * value + (1.0 - alpha) * (level + trend);
            trend = beta * (level - prev_level) + (1.0 - beta) * trend;
        }

        // Forecast h steps ahead
        let h = (self.config.horizon_minutes as f64 / 5.0).ceil(); // Assuming 5-min intervals
        let predicted = level + h * trend;

        // Confidence based on recent variance
        let recent_variance = self.calculate_recent_variance(values, 10);
        let confidence = (1.0 / (1.0 + recent_variance)).clamp(0.0, 1.0);

        // Determine trend
        let trend_str = if trend > 0.05 {
            "increasing"
        } else if trend < -0.05 {
            "decreasing"
        } else {
            "stable"
        };

        Ok((predicted, confidence, trend_str.to_string()))
    }

    /// Calculate standard deviation
    fn calculate_std_dev(&self, values: &[f64]) -> f64 {
        if values.len() < 2 {
            return 0.0;
        }

        let mean = values.iter().sum::<f64>() / values.len() as f64;
        let variance = values.iter()
            .map(|v| (v - mean).powi(2))
            .sum::<f64>() / values.len() as f64;

        variance.sqrt()
    }

    /// Calculate recent variance (last N samples)
    fn calculate_recent_variance(&self, values: &[f64], n: usize) -> f64 {
        let start = values.len().saturating_sub(n);
        let recent = &values[start..];

        if recent.len() < 2 {
            return 0.0;
        }

        let mean = recent.iter().sum::<f64>() / recent.len() as f64;
        let variance = recent.iter()
            .map(|v| (v - mean).powi(2))
            .sum::<f64>() / recent.len() as f64;

        variance
    }

    /// Update forecast accuracy based on actual observation
    pub fn update_accuracy(&mut self, actual_value: f64) {
        if let Some(ref forecast) = self.last_forecast {
            let error = (forecast.predicted_value - actual_value).abs();
            let relative_error = error / actual_value.abs().max(0.001);

            // Consider accurate if within 10% of predicted value
            if relative_error < 0.10 {
                self.metrics.accurate_forecasts += 1;
            }

            // Update average error
            let total = self.metrics.total_forecasts;
            self.metrics.avg_error = (self.metrics.avg_error * (total - 1) as f64 + error) / total as f64;
        }
    }

    /// Get forecast accuracy rate
    pub fn get_accuracy_rate(&self) -> f64 {
        if self.metrics.total_forecasts == 0 {
            return 0.0;
        }
        self.metrics.accurate_forecasts as f64 / self.metrics.total_forecasts as f64
    }

    /// Get current metrics
    pub fn get_metrics(&self) -> HorizonMetrics {
        self.metrics.clone()
    }

    /// Get last forecast
    pub fn get_last_forecast(&self) -> Option<ForecastHorizon> {
        self.last_forecast.clone()
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

    #[test]
    fn test_horizon_model_creation() {
        let config = HorizonConfig::default();
        let model = HorizonModel::new(config);

        assert_eq!(model.historical_data.len(), 0);
    }

    #[test]
    fn test_data_ingestion() {
        let config = HorizonConfig::default();
        let mut model = HorizonModel::new(config);

        for i in 0..10 {
            model.ingest(TimeSeriesData {
                timestamp: i,
                value: 100.0 + i as f64,
                metric_name: "latency".to_string(),
            });
        }

        assert_eq!(model.historical_data.len(), 10);
    }

    #[test]
    fn test_window_size_maintenance() {
        let config = HorizonConfig {
            window_size: 5,
            ..Default::default()
        };
        let mut model = HorizonModel::new(config);

        for i in 0..10 {
            model.ingest(TimeSeriesData {
                timestamp: i,
                value: 100.0,
                metric_name: "latency".to_string(),
            });
        }

        assert_eq!(model.historical_data.len(), 5);
    }

    #[test]
    fn test_forecast_insufficient_data() {
        let config = HorizonConfig {
            min_samples: 20,
            ..Default::default()
        };
        let mut model = HorizonModel::new(config);

        // Add only 10 samples
        for i in 0..10 {
            model.ingest(TimeSeriesData {
                timestamp: i,
                value: 100.0,
                metric_name: "latency".to_string(),
            });
        }

        let result = model.forecast();
        assert!(result.is_err());
    }

    #[test]
    fn test_forecast_with_sufficient_data() {
        let config = HorizonConfig {
            min_samples: 10,
            ..Default::default()
        };
        let mut model = HorizonModel::new(config);

        // Add increasing trend
        for i in 0..20 {
            model.ingest(TimeSeriesData {
                timestamp: i,
                value: 100.0 + i as f64,
                metric_name: "latency".to_string(),
            });
        }

        let result = model.forecast();
        assert!(result.is_ok());

        let forecast = result.unwrap();
        assert!(forecast.predicted_value > 100.0);
        assert_eq!(forecast.trend, "increasing");
    }

    #[test]
    fn test_forecast_stable_trend() {
        let config = HorizonConfig {
            min_samples: 10,
            ..Default::default()
        };
        let mut model = HorizonModel::new(config);

        // Add stable values
        for i in 0..20 {
            model.ingest(TimeSeriesData {
                timestamp: i,
                value: 100.0,
                metric_name: "latency".to_string(),
            });
        }

        let result = model.forecast();
        assert!(result.is_ok());

        let forecast = result.unwrap();
        assert_eq!(forecast.trend, "stable");
        assert!((forecast.predicted_value - 100.0).abs() < 5.0);
    }

    #[test]
    fn test_accuracy_tracking() {
        let config = HorizonConfig {
            min_samples: 10,
            ..Default::default()
        };
        let mut model = HorizonModel::new(config);

        for i in 0..20 {
            model.ingest(TimeSeriesData {
                timestamp: i,
                value: 100.0,
                metric_name: "latency".to_string(),
            });
        }

        model.forecast().ok();

        // Update with accurate observation
        model.update_accuracy(102.0); // Within 10%

        assert_eq!(model.metrics.accurate_forecasts, 1);
        assert!(model.get_accuracy_rate() > 0.0);
    }

    #[test]
    fn test_confidence_intervals() {
        let config = HorizonConfig {
            min_samples: 10,
            ..Default::default()
        };
        let mut model = HorizonModel::new(config);

        for i in 0..20 {
            model.ingest(TimeSeriesData {
                timestamp: i,
                value: 100.0 + (i % 3) as f64, // Some variance
                metric_name: "latency".to_string(),
            });
        }

        let forecast = model.forecast().unwrap();

        assert!(forecast.confidence_lower < forecast.predicted_value);
        assert!(forecast.confidence_upper > forecast.predicted_value);
        assert!(forecast.confidence > 0.0 && forecast.confidence <= 1.0);
    }

    #[test]
    fn test_std_dev_calculation() {
        let config = HorizonConfig::default();
        let model = HorizonModel::new(config);

        let values = vec![100.0, 102.0, 98.0, 101.0, 99.0];
        let std_dev = model.calculate_std_dev(&values);

        assert!(std_dev > 0.0);
        assert!(std_dev < 5.0); // Should be small for this data
    }

    #[test]
    fn test_metrics_tracking() {
        let config = HorizonConfig {
            min_samples: 5,
            ..Default::default()
        };
        let mut model = HorizonModel::new(config);

        for i in 0..10 {
            model.ingest(TimeSeriesData {
                timestamp: i,
                value: 100.0,
                metric_name: "latency".to_string(),
            });
        }

        // Generate multiple forecasts
        model.forecast().ok();
        model.forecast().ok();
        model.forecast().ok();

        let metrics = model.get_metrics();
        assert_eq!(metrics.total_forecasts, 3);
        assert!(metrics.avg_confidence > 0.0);
    }
}
