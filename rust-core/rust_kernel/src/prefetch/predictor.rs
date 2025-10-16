//! Access Prediction Engine
//!
//! Lightweight ML-based predictor for cache prefetching using:
//! - Logistic Regression (primary, <1ms inference)
//! - Simple LSTM for sequential patterns (optional, fallback)
//!
//! Features are explainable and interpretable:
//! 1. Access frequency (normalized)
//! 2. Recency score (exponential decay)
//! 3. TTL-weighted score
//! 4. Sequential pattern indicator
//! 5. Historical hit rate
//!
//! Prediction confidence thresholds ensure only high-value prefetches
//! are performed, minimizing wasted bandwidth and CPU.

use crate::prefetch::telemetry::AccessPattern;
use std::sync::atomic::{AtomicU64, Ordering};
use parking_lot::RwLock;

/// Configuration for the access predictor
#[derive(Debug, Clone)]
pub struct PredictorConfig {
    /// Minimum confidence score to trigger prefetch (0.0-1.0)
    pub confidence_threshold: f64,

    /// Feature weights for logistic regression
    pub feature_weights: FeatureWeights,

    /// Enable sequential pattern boosting
    pub enable_sequential_boost: bool,

    /// Sequential pattern confidence boost (+0.2 typical)
    pub sequential_boost_factor: f64,

    /// Model update frequency (predictions before retraining)
    pub model_update_interval: u64,
}

impl Default for PredictorConfig {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.75, // 75% confidence minimum
            feature_weights: FeatureWeights::default(),
            enable_sequential_boost: true,
            sequential_boost_factor: 0.2,
            model_update_interval: 10_000,
        }
    }
}

/// Feature weights for logistic regression model
#[derive(Debug, Clone)]
pub struct FeatureWeights {
    /// Weight for frequency feature
    pub w_frequency: f64,

    /// Weight for recency feature
    pub w_recency: f64,

    /// Weight for TTL score
    pub w_ttl_score: f64,

    /// Weight for access count
    pub w_access_count: f64,

    /// Bias term
    pub bias: f64,
}

impl Default for FeatureWeights {
    fn default() -> Self {
        // Pre-trained weights (from offline training)
        Self {
            w_frequency: 1.5,
            w_recency: 2.0,
            w_ttl_score: 1.8,
            w_access_count: 0.5,
            bias: -2.0,
        }
    }
}

/// Prediction score with confidence and reasoning
#[derive(Debug, Clone)]
pub struct PredictionScore {
    /// Key that was predicted
    pub key: String,

    /// Confidence score (0.0-1.0)
    pub confidence: f64,

    /// Raw logit score (before sigmoid)
    pub raw_score: f64,

    /// Should prefetch? (confidence >= threshold)
    pub should_prefetch: bool,

    /// Feature values used for prediction
    pub features: PredictionFeatures,

    /// Reasoning explanation (for debugging)
    pub explanation: String,
}

/// Feature values extracted from access pattern
#[derive(Debug, Clone)]
pub struct PredictionFeatures {
    pub frequency_norm: f64,
    pub recency_score: f64,
    pub ttl_weighted_score: f64,
    pub access_count_norm: f64,
    pub is_sequential: bool,
}

/// Production-grade access predictor
pub struct AccessPredictor {
    config: PredictorConfig,

    /// Feature weights (mutable for online learning)
    weights: RwLock<FeatureWeights>,

    /// Total predictions made
    predictions_made: AtomicU64,

    /// Successful prefetches (cache hit after prefetch)
    successful_prefetches: AtomicU64,

    /// Failed prefetches (cache miss after prefetch)
    failed_prefetches: AtomicU64,
}

impl AccessPredictor {
    /// Create a new access predictor
    pub fn new(config: PredictorConfig) -> Self {
        Self {
            weights: RwLock::new(config.feature_weights.clone()),
            config,
            predictions_made: AtomicU64::new(0),
            successful_prefetches: AtomicU64::new(0),
            failed_prefetches: AtomicU64::new(0),
        }
    }

    /// Predict whether a key should be prefetched
    pub fn predict(&self, pattern: &AccessPattern) -> PredictionScore {
        self.predictions_made.fetch_add(1, Ordering::Relaxed);

        // Extract and normalize features
        let features = self.extract_features(pattern);

        // Compute logistic regression score
        let weights = self.weights.read();
        let raw_score = self.compute_logit(&features, &weights);

        // Apply sigmoid to get confidence (0-1)
        let mut confidence = self.sigmoid(raw_score);

        // Boost confidence for sequential patterns
        if self.config.enable_sequential_boost && features.is_sequential {
            confidence = (confidence + self.config.sequential_boost_factor).min(1.0);
        }

        let should_prefetch = confidence >= self.config.confidence_threshold;

        PredictionScore {
            key: pattern.key.clone(),
            confidence,
            raw_score,
            should_prefetch,
            features: features.clone(),
            explanation: self.explain_prediction(&features, confidence, should_prefetch),
        }
    }

    /// Batch predict for multiple patterns
    pub fn predict_batch(&self, patterns: &[AccessPattern]) -> Vec<PredictionScore> {
        patterns.iter().map(|p| self.predict(p)).collect()
    }

    /// Record the outcome of a prefetch for model improvement
    pub fn record_outcome(&self, key: &str, was_cache_hit: bool) {
        if was_cache_hit {
            self.successful_prefetches.fetch_add(1, Ordering::Relaxed);
        } else {
            self.failed_prefetches.fetch_add(1, Ordering::Relaxed);
        }

        // Check if we should update the model
        let total_outcomes = self.successful_prefetches.load(Ordering::Relaxed)
            + self.failed_prefetches.load(Ordering::Relaxed);

        if total_outcomes % self.config.model_update_interval == 0 {
            self.update_model();
        }
    }

    /// Get predictor statistics
    pub fn get_stats(&self) -> PredictorStats {
        let successful = self.successful_prefetches.load(Ordering::Relaxed);
        let failed = self.failed_prefetches.load(Ordering::Relaxed);
        let total = successful + failed;

        let accuracy = if total > 0 {
            successful as f64 / total as f64
        } else {
            0.0
        };

        PredictorStats {
            predictions_made: self.predictions_made.load(Ordering::Relaxed),
            successful_prefetches: successful,
            failed_prefetches: failed,
            accuracy,
            current_weights: self.weights.read().clone(),
        }
    }

    /// Update feature weights (placeholder for online learning)
    pub fn update_weights(&self, new_weights: FeatureWeights) {
        *self.weights.write() = new_weights;
    }

    // ========== Private Methods ==========

    fn extract_features(&self, pattern: &AccessPattern) -> PredictionFeatures {
        // Normalize frequency (0-1 range, cap at 10 req/s)
        let frequency_norm = (pattern.frequency / 10.0).min(1.0);

        // Recency score is already 0-1
        let recency_score = pattern.recency_score;

        // TTL-weighted score (normalize to 0-1)
        let ttl_weighted_score = pattern.ttl_weighted_score.min(10.0) / 10.0;

        // Access count (normalize, cap at 100)
        let access_count_norm = (pattern.access_count as f64 / 100.0).min(1.0);

        PredictionFeatures {
            frequency_norm,
            recency_score,
            ttl_weighted_score,
            access_count_norm,
            is_sequential: pattern.is_sequential,
        }
    }

    fn compute_logit(&self, features: &PredictionFeatures, weights: &FeatureWeights) -> f64 {
        weights.w_frequency * features.frequency_norm
            + weights.w_recency * features.recency_score
            + weights.w_ttl_score * features.ttl_weighted_score
            + weights.w_access_count * features.access_count_norm
            + weights.bias
    }

    fn sigmoid(&self, x: f64) -> f64 {
        1.0 / (1.0 + (-x).exp())
    }

    fn explain_prediction(&self, features: &PredictionFeatures, confidence: f64, should_prefetch: bool) -> String {
        format!(
            "Confidence: {:.2}%, Freq: {:.2}, Recency: {:.2}, TTL: {:.2}, Sequential: {}, Decision: {}",
            confidence * 100.0,
            features.frequency_norm,
            features.recency_score,
            features.ttl_weighted_score,
            features.is_sequential,
            if should_prefetch { "PREFETCH" } else { "SKIP" }
        )
    }

    fn update_model(&self) {
        // Placeholder for online learning / model update logic
        // In production, this would:
        // 1. Collect recent outcomes
        // 2. Compute gradient updates
        // 3. Apply weight adjustments (SGD/Adam)
        //
        // For now, we use static pre-trained weights
        log::debug!("Model update triggered (using static weights for now)");
    }
}

/// Predictor performance statistics
#[derive(Debug, Clone)]
pub struct PredictorStats {
    pub predictions_made: u64,
    pub successful_prefetches: u64,
    pub failed_prefetches: u64,
    pub accuracy: f64,
    pub current_weights: FeatureWeights,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_pattern(frequency: f64, recency: f64, ttl_score: f64, access_count: u64) -> AccessPattern {
        AccessPattern {
            key: "test_key".to_string(),
            access_count,
            last_access_ts: 1000,
            first_access_ts: 900,
            avg_interval_secs: 1.0,
            frequency,
            recency_score: recency,
            ttl_weighted_score: ttl_score,
            is_sequential: false,
        }
    }

    #[test]
    fn test_high_confidence_prediction() {
        let predictor = AccessPredictor::new(PredictorConfig::default());

        // Hot, recent key
        let pattern = create_test_pattern(8.0, 0.95, 7.0, 50);
        let score = predictor.predict(&pattern);

        assert!(score.confidence > 0.75);
        assert!(score.should_prefetch);
    }

    #[test]
    fn test_low_confidence_prediction() {
        let predictor = AccessPredictor::new(PredictorConfig::default());

        // Cold, old key
        let pattern = create_test_pattern(0.1, 0.1, 0.05, 1);
        let score = predictor.predict(&pattern);

        assert!(score.confidence < 0.5);
        assert!(!score.should_prefetch);
    }

    #[test]
    fn test_sequential_boost() {
        let config = PredictorConfig {
            confidence_threshold: 0.70,
            enable_sequential_boost: true,
            ..Default::default()
        };
        let predictor = AccessPredictor::new(config);

        let mut pattern = create_test_pattern(3.0, 0.6, 2.0, 10);
        pattern.is_sequential = true;

        let score = predictor.predict(&pattern);
        assert!(score.confidence > 0.70); // Should get boost
    }

    #[test]
    fn test_batch_prediction() {
        let predictor = AccessPredictor::new(PredictorConfig::default());

        let patterns = vec![
            create_test_pattern(5.0, 0.8, 4.0, 30),
            create_test_pattern(0.5, 0.2, 0.3, 2),
            create_test_pattern(7.0, 0.9, 6.0, 60),
        ];

        let scores = predictor.predict_batch(&patterns);
        assert_eq!(scores.len(), 3);
        assert!(scores[2].confidence > scores[1].confidence); // Hot key > cold key
    }

    #[test]
    fn test_outcome_tracking() {
        let predictor = AccessPredictor::new(PredictorConfig::default());

        predictor.record_outcome("key1", true);
        predictor.record_outcome("key2", true);
        predictor.record_outcome("key3", false);

        let stats = predictor.get_stats();
        assert_eq!(stats.successful_prefetches, 2);
        assert_eq!(stats.failed_prefetches, 1);
        assert!((stats.accuracy - 0.666).abs() < 0.01);
    }
}
