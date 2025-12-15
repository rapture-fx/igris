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

#[derive(Debug, Clone, Copy)]
enum FinetuneOutMode {
    /// llama-finetune can directly write a LoRA adapter artifact.
    LoraOut,
}

#[derive(Debug, Clone)]
struct FinetuneCaps {
    out_mode: FinetuneOutMode,
    /// Flag name used to specify the LoRA adapter output path.
    lora_out_flag: &'static str,
}

async fn detect_finetune_caps(finetune_bin: &Path) -> Result<FinetuneCaps> {
    let output = Command::new(finetune_bin)
        .arg("--help")
        .output()
        .await
        .context("Failed to run llama-finetune --help")?;

    let mut text = String::new();
    text.push_str(&String::from_utf8_lossy(&output.stdout));
    text.push_str(&String::from_utf8_lossy(&output.stderr));

    // We only accept modes where llama.cpp can output a LoRA adapter artifact directly.
    // This avoids any fake/stub outputs and avoids relying on undocumented export steps.
    //
    // Known variants across llama.cpp versions:
    // - --lora-out <path>
    // - --lora-out-dir <dir> (less common)
    // - --save-lora <path> (rare)
    if text.contains("--lora-out") {
        return Ok(FinetuneCaps {
            out_mode: FinetuneOutMode::LoraOut,
            lora_out_flag: "--lora-out",
        });
    }
    if text.contains("--save-lora") {
        return Ok(FinetuneCaps {
            out_mode: FinetuneOutMode::LoraOut,
            lora_out_flag: "--save-lora",
        });
    }

    anyhow::bail!(
        "llama-finetune at {} does not advertise a LoRA adapter output flag (e.g. --lora-out). \
         Rebuild/upgrade llama.cpp with finetune+LoRA output support.",
        finetune_bin.display()
    );
}

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

        let finetune_bin = self.llama_cpp_dir.join("build/bin/llama-finetune");

        if !finetune_bin.exists() {
            anyhow::bail!(
                "llama-finetune binary not found at {}. Build llama.cpp (training tools) first.",
                finetune_bin.display()
            );
        }

        let caps = detect_finetune_caps(&finetune_bin).await?;

        // Build command arguments
        let mut cmd = Command::new(&finetune_bin);
        cmd.arg("--model")
            .arg(base_model_path)
            .arg("--file")
            .arg(&training_data_path);

        match caps.out_mode {
            FinetuneOutMode::LoraOut => {
                cmd.arg(caps.lora_out_flag).arg(&adapter_path);
            }
        }

        cmd
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

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            error!("Training failed: {}", stderr.trim());
            anyhow::bail!("Training process failed: {}", stderr.trim());
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
        let (adapter_path_for_result, encrypted_path) = if let Some(ref encryption) = self.encryption
        {
            let encrypted = adapter_dir.join(format!("lora_adapter_{}.enc", timestamp));
            encryption.encrypt_file(&adapter_path, &encrypted)?;
            // Ensure "at rest" means encrypted: remove plaintext artifact.
            let _ = fs::remove_file(&adapter_path).await;
            (None, Some(encrypted))
        } else {
            (Some(adapter_path.clone()), None)
        };

        // Mark training as completed
        self.store.mark_training_completed()?;
        // Prevent immediately retriggering: reset request counter after a successful training run.
        let _ = self.store.reset_request_counter();

        // Get training examples count
        let examples = self.store.get_history_since_last_training()?;

        Ok(TrainingResult {
            status: TrainingStatus::Completed,
            adapter_path: adapter_path_for_result,
            encrypted_adapter_path: encrypted_path,
            training_samples: examples.len(),
            training_time_secs: training_time,
            final_loss: parse_final_loss(&stdout).or_else(|| parse_final_loss(&stderr)),
            adapter_size_bytes: Some(adapter_size_bytes),
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
            let is_plain = path.extension().and_then(|s| s.to_str()) == Some("gguf");
            let is_enc = path.extension().and_then(|s| s.to_str()) == Some("enc");
            if is_plain || is_enc {
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

    /// Materialize an encrypted adapter to a stable decrypted path for runtime loading.
    ///
    /// Returns a path to a `.gguf` adapter that can be passed to `llama-cli --lora`.
    pub async fn materialize_latest_adapter_for_runtime(&self) -> Result<Option<PathBuf>> {
        let Some(latest) = self.get_latest_adapter().await? else {
            return Ok(None);
        };

        if latest.extension().and_then(|s| s.to_str()) == Some("gguf") {
            return Ok(Some(latest));
        }

        if latest.extension().and_then(|s| s.to_str()) != Some("enc") {
            return Ok(None);
        }

        let enc = self
            .encryption
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Found encrypted adapter but encryption is disabled"))?;
        let enc = enc.clone();

        let adapter_dir = PathBuf::from(&self.config.adapter_dir);
        fs::create_dir_all(&adapter_dir).await?;
        let out = adapter_dir.join("current_adapter.gguf");
        let out_for_task = out.clone();

        // Decrypt (blocking IO inside encryption module; keep it small and explicit).
        tokio::task::spawn_blocking(move || enc.decrypt_file(latest, &out_for_task))
            .await
            .context("Decryption task failed")??;

        Ok(Some(out))
    }
}

fn parse_final_loss(text: &str) -> Option<f64> {
    // Best-effort parse: look for patterns like "loss=0.123" or "loss: 0.123".
    let mut best: Option<f64> = None;
    for line in text.lines() {
        let l = line.to_lowercase();
        if !l.contains("loss") {
            continue;
        }
        for token in l
            .split(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-' || c == 'e'))
            .filter(|t| !t.is_empty())
        {
            if let Ok(v) = token.parse::<f64>() {
                best = Some(v);
            }
        }
    }
    best
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
