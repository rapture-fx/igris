//! Real-time execution configuration

use serde::{Deserialize, Serialize};

/// Configuration for real-time execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtConfig {
    /// Enable real-time mode
    #[serde(default)]
    pub enabled: bool,

    /// Default priority level for tasks (0-3)
    #[serde(default = "default_priority_level")]
    pub priority_level: u8,

    /// Maximum number of concurrent RT tasks
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent_tasks: usize,

    /// Enable latency monitoring and metrics
    #[serde(default = "default_true")]
    pub enable_metrics: bool,

    /// Warn threshold in milliseconds - log warning if exceeded
    #[serde(default = "default_warn_threshold")]
    pub warn_threshold_ms: u64,
}

fn default_priority_level() -> u8 {
    1 // Normal priority
}

fn default_max_concurrent() -> usize {
    4 // Conservative default for RT tasks
}

fn default_true() -> bool {
    true
}

fn default_warn_threshold() -> u64 {
    100 // 100ms
}

impl Default for RtConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            priority_level: default_priority_level(),
            max_concurrent_tasks: default_max_concurrent(),
            enable_metrics: true,
            warn_threshold_ms: default_warn_threshold(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = RtConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.priority_level, 1);
        assert_eq!(config.max_concurrent_tasks, 4);
        assert!(config.enable_metrics);
        assert_eq!(config.warn_threshold_ms, 100);
    }

    #[test]
    fn test_config_serialization() {
        let config = RtConfig {
            enabled: true,
            priority_level: 2,
            max_concurrent_tasks: 8,
            enable_metrics: true,
            warn_threshold_ms: 50,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: RtConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.enabled, deserialized.enabled);
        assert_eq!(config.priority_level, deserialized.priority_level);
    }
}
