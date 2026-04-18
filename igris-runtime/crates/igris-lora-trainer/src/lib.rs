pub mod config;
pub mod embedded_bins;
pub mod encryption;
pub mod storage;
pub mod trainer;

// Native Rust training module (optional, enabled with 'native-training' feature)
#[cfg(feature = "native-training")]
pub mod metal_trainer;

#[cfg(feature = "native-training")]
pub mod gguf_metadata;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub use config::{LoRATrainingConfig, TrainingBackend};
pub use encryption::AdapterEncryption;
pub use storage::{ConversationHistory, TrainingDataStore};
pub use trainer::LoRATrainer;

#[cfg(feature = "native-training")]
pub use metal_trainer::MetalLoRATrainer;

/// Represents a single training example (prompt + completion pair)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingExample {
    pub prompt: String,
    pub completion: String,
    pub timestamp: u64,
    pub model_used: String,
}

/// Status of LoRA training
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrainingStatus {
    /// Not yet started
    Idle,
    /// Currently training
    Training,
    /// Training completed successfully
    Completed,
    /// Training failed
    Failed,
}

/// Result of a training run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingResult {
    pub status: TrainingStatus,
    pub adapter_path: Option<PathBuf>,
    pub encrypted_adapter_path: Option<PathBuf>,
    pub training_samples: usize,
    pub training_time_secs: f64,
    pub final_loss: Option<f64>,
    pub adapter_size_bytes: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_training_example_serialization() {
        let example = TrainingExample {
            prompt: "What is 2+2?".to_string(),
            completion: "4".to_string(),
            timestamp: 1234567890,
            model_used: "phi-3".to_string(),
        };

        let json = serde_json::to_string(&example).unwrap();
        let deserialized: TrainingExample = serde_json::from_str(&json).unwrap();
        assert_eq!(example.prompt, deserialized.prompt);
    }
}
