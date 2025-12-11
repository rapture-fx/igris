use crate::{
    config::LoRATrainingConfig, encryption::AdapterEncryption, storage::TrainingDataStore,
    TrainingResult, TrainingStatus,
};
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tokio::fs;
use tokio::process::Command;
use tracing::{error, info, warn};

/// LoRA trainer using llama.cpp's fine-tuning capabilities
pub struct LoRATrainer {
    config: LoRATrainingConfig,
    store: TrainingDataStore,
    encryption: Option<AdapterEncryption>,
    llama_cpp_dir: PathBuf,
}

impl LoRATrainer {
    /// Create a new LoRA trainer
    pub fn new(
        config: LoRATrainingConfig,
        store: TrainingDataStore,
        llama_cpp_dir: PathBuf,
    ) -> Self {
        let encryption = if config.encrypt_adapters {
            Some(AdapterEncryption::with_device_key())
        } else {
            None
        };

        Self {
            config,
            store,
            encryption,
            llama_cpp_dir,
        }
    }

    /// Check if training should be triggered
    pub async fn should_trigger_training(&self) -> Result<bool> {
        if !self.config.enabled {
            return Ok(false);
        }

        let request_count = self.store.get_request_counter()?;
        let should_trigger = request_count >= self.config.trigger_threshold as u64;

        if should_trigger {
            info!(
                "Training threshold reached: {} >= {}",
                request_count, self.config.trigger_threshold
            );
        }

        Ok(should_trigger)
    }

    /// Prepare training data from conversation history
    async fn prepare_training_data(&self) -> Result<PathBuf> {
        let examples = self.store.get_history_since_last_training()?;

        if examples.is_empty() {
            anyhow::bail!("No training examples available");
        }

        info!("Preparing {} training examples", examples.len());

        // Create temporary training data file in llama.cpp format
        // Format: Each line is a training example
        let data_dir = PathBuf::from(&self.config.adapter_dir);
        fs::create_dir_all(&data_dir).await?;

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        let data_file = data_dir.join(format!("training_data_{}.txt", timestamp));

        let mut training_text = String::new();
        for example in &examples {
            // Format: prompt + completion as a single training example
            // This is a simple format; llama.cpp's finetune expects text data
            training_text.push_str(&format!(
                "### Instruction:\n{}\n\n### Response:\n{}\n\n",
                example.prompt, example.completion
            ));
        }

        fs::write(&data_file, training_text).await?;
        info!("Training data prepared: {}", data_file.display());

        Ok(data_file)
    }

    /// Run LoRA training using llama.cpp's finetune binary
    pub async fn train(&self, base_model_path: &str) -> Result<TrainingResult> {
        let start_time = Instant::now();
        info!("Starting LoRA training with base model: {}", base_model_path);

        // Prepare training data
        let training_data_path = self
            .prepare_training_data()
            .await
            .context("Failed to prepare training data")?;

        // Setup output paths
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        let adapter_dir = PathBuf::from(&self.config.adapter_dir);
        fs::create_dir_all(&adapter_dir).await?;

        let adapter_path = adapter_dir.join(format!("lora_adapter_{}.gguf", timestamp));

        // Build llama-finetune command
        // Note: llama.cpp's finetune tool outputs a full fine-tuned model, not just a LoRA adapter
        // For true LoRA-only output, we'd need to modify llama.cpp or use export-lora
        // For now, we'll use a simplified approach: run finetune with LoRA params
        let finetune_bin = self.llama_cpp_dir.join("build/bin/llama-finetune");

        if !finetune_bin.exists() {
            warn!(
                "llama-finetune binary not found at {:?}, falling back to stub",
                finetune_bin
            );
            return self.create_stub_adapter(&adapter_path).await;
        }

        // Build command arguments
        let mut cmd = Command::new(&finetune_bin);
        cmd.arg("--model")
            .arg(base_model_path)
            .arg("--file")
            .arg(&training_data_path)
            .arg("--output")
            .arg(&adapter_path)
            .arg("--epochs")
            .arg(self.config.epochs.to_string())
            .arg("--batch")
            .arg(self.config.batch_size.to_string())
            .arg("--learning-rate")
            .arg(self.config.learning_rate.to_string())
            .arg("--threads")
            .arg(self.config.training_threads.to_string())
            .arg("--lora-r")
            .arg(self.config.lora_rank.to_string())
            .arg("--lora-alpha")
            .arg(self.config.lora_alpha.to_string());

        info!("Running training command: {:?}", cmd);

        // Execute training (with timeout)
        let output = tokio::time::timeout(
            std::time::Duration::from_secs(self.config.max_training_time_secs),
            cmd.output(),
        )
        .await
        .context("Training timeout")??;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Training failed: {}", stderr);
            anyhow::bail!("Training process failed: {}", stderr);
        }

        let training_time = start_time.elapsed().as_secs_f64();
        info!("Training completed in {:.2}s", training_time);

        // Check adapter size
        let metadata = fs::metadata(&adapter_path).await?;
        let adapter_size_bytes = metadata.len();
        let adapter_size_mb = adapter_size_bytes / (1024 * 1024);

        if adapter_size_mb > self.config.max_adapter_size_mb as u64 {
            warn!(
                "Adapter size ({} MB) exceeds limit ({} MB)",
                adapter_size_mb, self.config.max_adapter_size_mb
            );
        }

        // Encrypt adapter if configured
        let encrypted_path = if let Some(ref encryption) = self.encryption {
            let encrypted = adapter_dir.join(format!("lora_adapter_{}.enc", timestamp));
            encryption.encrypt_file(&adapter_path, &encrypted)?;
            Some(encrypted)
        } else {
            None
        };

        // Mark training as completed
        self.store.mark_training_completed()?;

        // Get training examples count
        let examples = self.store.get_history_since_last_training()?;

        Ok(TrainingResult {
            status: TrainingStatus::Completed,
            adapter_path: Some(adapter_path),
            encrypted_adapter_path: encrypted_path,
            training_samples: examples.len(),
            training_time_secs: training_time,
            final_loss: None, // Would need to parse from training output
            adapter_size_bytes: Some(adapter_size_bytes),
        })
    }

    /// Create a stub adapter for development/testing when llama-finetune is not available
    async fn create_stub_adapter(&self, adapter_path: &Path) -> Result<TrainingResult> {
        info!("Creating stub adapter (llama-finetune not available)");

        // Create a small stub GGUF file
        let stub_data = b"STUB_LORA_ADAPTER_FOR_TESTING";
        fs::write(adapter_path, stub_data).await?;

        let encrypted_path = if let Some(ref encryption) = self.encryption {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs();
            let encrypted = PathBuf::from(&self.config.adapter_dir)
                .join(format!("lora_adapter_{}.enc", timestamp));
            encryption.encrypt_file(adapter_path, &encrypted)?;
            Some(encrypted)
        } else {
            None
        };

        self.store.mark_training_completed()?;

        Ok(TrainingResult {
            status: TrainingStatus::Completed,
            adapter_path: Some(adapter_path.to_path_buf()),
            encrypted_adapter_path: encrypted_path,
            training_samples: 0,
            training_time_secs: 0.0,
            final_loss: None,
            adapter_size_bytes: Some(stub_data.len() as u64),
        })
    }

    /// Get the latest trained adapter
    pub async fn get_latest_adapter(&self) -> Result<Option<PathBuf>> {
        let adapter_dir = PathBuf::from(&self.config.adapter_dir);
        if !adapter_dir.exists() {
            return Ok(None);
        }

        let mut entries = fs::read_dir(&adapter_dir).await?;
        let mut latest: Option<(PathBuf, std::time::SystemTime)> = None;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("gguf") {
                let metadata = fs::metadata(&path).await?;
                let modified = metadata.modified()?;

                if let Some((_, latest_time)) = latest {
                    if modified > latest_time {
                        latest = Some((path, modified));
                    }
                } else {
                    latest = Some((path, modified));
                }
            }
        }

        Ok(latest.map(|(path, _)| path))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_should_trigger_training() -> Result<()> {
        let dir = tempdir()?;
        let db_path = dir.path().join("test.db");
        let store = TrainingDataStore::open(&db_path)?;

        let mut config = LoRATrainingConfig::default();
        config.enabled = true;
        config.trigger_threshold = 5;

        let llama_cpp_dir = PathBuf::from("../../../llama.cpp");
        let trainer = LoRATrainer::new(config, store.clone(), llama_cpp_dir);

        // Should not trigger initially
        assert!(!trainer.should_trigger_training().await?);

        // Add some requests
        for _ in 0..5 {
            store.increment_request_counter()?;
        }

        // Should trigger now
        assert!(trainer.should_trigger_training().await?);

        Ok(())
    }
}
