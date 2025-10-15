//! Runtime Configuration for Prefetch System
//!
//! Integrates with Vault for dynamic configuration updates.
//! All settings can be changed at runtime without restart.

use serde::{Deserialize, Serialize};

/// Main prefetch configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrefetchConfig {
    /// Feature flags
    pub feature_flags: PrefetchFeatureFlags,

    /// Prefetch runner settings
    pub runner: RunnerConfig,

    /// Predictor settings
    pub predictor: PredictorConfig,

    /// Throttler settings
    pub throttler: ThrottlerConfig,

    /// Telemetry settings
    pub telemetry: TelemetryConfig,
}

impl Default for PrefetchConfig {
    fn default() -> Self {
        Self {
            feature_flags: PrefetchFeatureFlags::default(),
            runner: RunnerConfig::default(),
            predictor: PredictorConfig::default(),
            throttler: ThrottlerConfig::default(),
            telemetry: TelemetryConfig::default(),
        }
    }
}

/// Feature flags for runtime toggling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrefetchFeatureFlags {
    /// Master enable/disable for prefetching
    pub prefetch_enabled: bool,

    /// Enable predictive model
    pub enable_prediction: bool,

    /// Enable telemetry collection
    pub enable_telemetry: bool,

    /// Enable rate limiting
    pub enable_rate_limiting: bool,

    /// Enable mempool backpressure
    pub enable_backpressure: bool,

    /// Telemetry sampling rate (0.0-1.0)
    pub telemetry_sample_rate: f64,
}

impl Default for PrefetchFeatureFlags {
    fn default() -> Self {
        Self {
            prefetch_enabled: false, // Start disabled for safety
            enable_prediction: true,
            enable_telemetry: true,
            enable_rate_limiting: true,
            enable_backpressure: true,
            telemetry_sample_rate: 0.01, // 1%
        }
    }
}

/// Runner configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunnerConfig {
    /// Maximum concurrent prefetch operations
    pub max_concurrent_prefetches: usize,

    /// Prefetch queue size
    pub queue_size: usize,

    /// Prefetch timeout (seconds)
    pub timeout_secs: u64,

    /// Number of worker threads
    pub worker_threads: usize,

    /// Batch size for prefetch operations
    pub batch_size: usize,
}

impl Default for RunnerConfig {
    fn default() -> Self {
        Self {
            max_concurrent_prefetches: 50,
            queue_size: 1000,
            timeout_secs: 5,
            worker_threads: 4,
            batch_size: 10,
        }
    }
}

/// Predictor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictorConfig {
    /// Confidence threshold (0.0-1.0)
    pub confidence_threshold: f64,

    /// Enable sequential pattern boost
    pub enable_sequential_boost: bool,

    /// Sequential boost factor
    pub sequential_boost_factor: f64,

    /// Model update interval (predictions)
    pub model_update_interval: u64,
}

impl Default for PredictorConfig {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.75,
            enable_sequential_boost: true,
            sequential_boost_factor: 0.2,
            model_update_interval: 10_000,
        }
    }
}

/// Throttler configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThrottlerConfig {
    /// Maximum prefetch QPS
    pub max_prefetch_qps: u64,

    /// Minimum mempool free percent
    pub min_mempool_free_percent: u8,

    /// Token bucket max burst
    pub max_burst: u64,

    /// Refill interval (ms)
    pub refill_interval_ms: u64,
}

impl Default for ThrottlerConfig {
    fn default() -> Self {
        Self {
            max_prefetch_qps: 100,
            min_mempool_free_percent: 10,
            max_burst: 20,
            refill_interval_ms: 100,
        }
    }
}

/// Telemetry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryConfig {
    /// Window duration (seconds)
    pub window_duration_secs: u64,

    /// Maximum tracked keys
    pub max_tracked_keys: usize,

    /// TTL decay factor
    pub ttl_decay_factor: f64,

    /// Minimum access threshold
    pub min_access_threshold: u64,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            window_duration_secs: 60,
            max_tracked_keys: 100_000,
            ttl_decay_factor: 0.95,
            min_access_threshold: 3,
        }
    }
}

/// Configuration loader (integrates with Vault or config file)
pub struct ConfigLoader;

impl ConfigLoader {
    /// Load configuration from Vault (placeholder)
    pub async fn load_from_vault(_vault_addr: &str, _path: &str) -> Result<PrefetchConfig, String> {
        // TODO: Implement Vault integration
        // For now, return default config
        Ok(PrefetchConfig::default())
    }

    /// Load configuration from JSON file
    pub fn load_from_file(path: &str) -> Result<PrefetchConfig, String> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))
    }

    /// Save configuration to JSON file
    pub fn save_to_file(config: &PrefetchConfig, path: &str) -> Result<(), String> {
        let json = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        std::fs::write(path, json)
            .map_err(|e| format!("Failed to write config file: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_default_config() {
        let config = PrefetchConfig::default();
        assert!(!config.feature_flags.prefetch_enabled); // Should start disabled
        assert_eq!(config.runner.max_concurrent_prefetches, 50);
        assert_eq!(config.predictor.confidence_threshold, 0.75);
    }

    #[test]
    fn test_config_serialization() {
        let config = PrefetchConfig::default();
        let json = serde_json::to_string_pretty(&config).unwrap();
        let deserialized: PrefetchConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.runner.queue_size, deserialized.runner.queue_size);
    }

    #[test]
    fn test_file_save_load() {
        let config = PrefetchConfig::default();
        let path = "/tmp/test_prefetch_config.json";

        ConfigLoader::save_to_file(&config, path).unwrap();
        let loaded = ConfigLoader::load_from_file(path).unwrap();

        assert_eq!(config.feature_flags.telemetry_sample_rate, loaded.feature_flags.telemetry_sample_rate);

        fs::remove_file(path).ok();
    }
}
