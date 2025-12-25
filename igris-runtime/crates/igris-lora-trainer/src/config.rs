use serde::{Deserialize, Serialize};

/// Training backend to use
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrainingBackend {
    /// Use llama.cpp's finetune binary (requires external dependency)
    LlamaCpp,
    /// Use native Rust training with metal-candle (recommended)
    NativeRust,
    /// Auto-detect: prefer native Rust, fallback to llama.cpp if available
    Auto,
}

impl Default for TrainingBackend {
    fn default() -> Self {
        Self::Auto
    }
}

/// Configuration for on-device QLoRA fine-tuning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoRATrainingConfig {
    /// Enable automatic LoRA training
    #[serde(default)]
    pub enabled: bool,

    /// Training backend to use (default: auto)
    #[serde(default)]
    pub backend: TrainingBackend,

    /// Trigger training after N requests (default: 100)
    #[serde(default = "default_trigger_threshold")]
    pub trigger_threshold: usize,

    /// Maximum adapter size in MB (default: 64)
    #[serde(default = "default_max_adapter_size_mb")]
    pub max_adapter_size_mb: usize,

    /// LoRA rank (default: 8 for QLoRA)
    #[serde(default = "default_lora_rank")]
    pub lora_rank: usize,

    /// LoRA alpha scaling factor (default: 16)
    #[serde(default = "default_lora_alpha")]
    pub lora_alpha: f32,

    /// Training epochs (default: 1)
    #[serde(default = "default_epochs")]
    pub epochs: usize,

    /// Batch size for training (default: 4)
    #[serde(default = "default_batch_size")]
    pub batch_size: usize,

    /// Learning rate (default: 0.0001)
    #[serde(default = "default_learning_rate")]
    pub learning_rate: f32,

    /// Directory to store adapters (default: "lora_adapters")
    #[serde(default = "default_adapter_dir")]
    pub adapter_dir: String,

    /// Enable adapter encryption at rest (default: true)
    #[serde(default = "default_encrypt_adapters")]
    pub encrypt_adapters: bool,

    /// Auto-load latest adapter on startup (default: true)
    #[serde(default = "default_auto_load_adapter")]
    pub auto_load_adapter: bool,

    /// Maximum training time in seconds (default: 1800 = 30 minutes)
    #[serde(default = "default_max_training_time_secs")]
    pub max_training_time_secs: u64,

    /// Number of threads for training (default: 4)
    #[serde(default = "default_training_threads")]
    pub training_threads: usize,
}

fn default_trigger_threshold() -> usize {
    100
}

fn default_max_adapter_size_mb() -> usize {
    64
}

fn default_lora_rank() -> usize {
    8
}

fn default_lora_alpha() -> f32 {
    16.0
}

fn default_epochs() -> usize {
    1
}

fn default_batch_size() -> usize {
    4
}

fn default_learning_rate() -> f32 {
    0.0001
}

fn default_adapter_dir() -> String {
    "lora_adapters".to_string()
}

fn default_encrypt_adapters() -> bool {
    true
}

fn default_auto_load_adapter() -> bool {
    true
}

fn default_max_training_time_secs() -> u64 {
    1800
}

fn default_training_threads() -> usize {
    4
}

impl Default for LoRATrainingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            backend: TrainingBackend::default(),
            trigger_threshold: default_trigger_threshold(),
            max_adapter_size_mb: default_max_adapter_size_mb(),
            lora_rank: default_lora_rank(),
            lora_alpha: default_lora_alpha(),
            epochs: default_epochs(),
            batch_size: default_batch_size(),
            learning_rate: default_learning_rate(),
            adapter_dir: default_adapter_dir(),
            encrypt_adapters: default_encrypt_adapters(),
            auto_load_adapter: default_auto_load_adapter(),
            max_training_time_secs: default_max_training_time_secs(),
            training_threads: default_training_threads(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = LoRATrainingConfig::default();
        assert_eq!(config.trigger_threshold, 100);
        assert_eq!(config.max_adapter_size_mb, 64);
        assert_eq!(config.lora_rank, 8);
        assert!(!config.enabled);
        assert!(config.encrypt_adapters);
    }

    #[test]
    fn test_config_serialization() {
        let config = LoRATrainingConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: LoRATrainingConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.trigger_threshold, deserialized.trigger_threshold);
    }
}
