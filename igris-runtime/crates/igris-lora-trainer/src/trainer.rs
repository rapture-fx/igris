use crate::{
    config::{LoRATrainingConfig, TrainingBackend},
    encryption::AdapterEncryption,
    storage::TrainingDataStore,
    TrainingResult, TrainingStatus,
};
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tokio::fs;
use tokio::process::Command;
use tracing::{error, info, warn};

#[cfg(feature = "native-training")]
use crate::metal_trainer::MetalLoRATrainer;

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

    /// Prepare training and validation data from conversation history with 80/20 split
    async fn prepare_training_data(&self) -> Result<(PathBuf, Option<PathBuf>)> {
        let mut examples = self.store.get_history_since_last_training()?;

        if examples.is_empty() {
            anyhow::bail!("No training examples available");
        }

        // Shuffle examples for random train/val split (deterministic based on timestamp)
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        examples.sort_by_key(|ex| {
            let mut hasher = DefaultHasher::new();
            ex.timestamp.hash(&mut hasher);
            hasher.finish()
        });

        // 80/20 split for train/validation
        let split_idx = (examples.len() as f64 * 0.8).ceil() as usize;
        let (train_examples, val_examples) = examples.split_at(split_idx);

        info!(
            "Preparing {} training examples, {} validation examples",
            train_examples.len(),
            val_examples.len()
        );

        // Create data directory
        let data_dir = PathBuf::from(&self.config.adapter_dir);
        fs::create_dir_all(&data_dir).await?;

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();

        // Prepare training data file
        let train_file = data_dir.join(format!("training_data_{}.txt", timestamp));
        let mut training_text = String::new();
        for example in train_examples {
            training_text.push_str(&format!(
                "### Instruction:\n{}\n\n### Response:\n{}\n\n",
                example.prompt, example.completion
            ));
        }
        fs::write(&train_file, training_text).await?;
        info!("Training data prepared: {}", train_file.display());

        // Prepare validation data file (if we have validation examples)
        let val_file = if !val_examples.is_empty() {
            let val_file = data_dir.join(format!("validation_data_{}.txt", timestamp));
            let mut validation_text = String::new();
            for example in val_examples {
                validation_text.push_str(&format!(
                    "### Instruction:\n{}\n\n### Response:\n{}\n\n",
                    example.prompt, example.completion
                ));
            }
            fs::write(&val_file, validation_text).await?;
            info!("Validation data prepared: {}", val_file.display());
            Some(val_file)
        } else {
            None
        };

        Ok((train_file, val_file))
    }

    /// Determine which training backend to use based on configuration and availability
    async fn select_backend(&self) -> Result<TrainingBackend> {
        match self.config.backend {
            TrainingBackend::LlamaCpp => {
                // User explicitly requested llama.cpp
                // Try embedded/extracted binary first, then fallback to build directory
                match crate::embedded_bins::get_finetune_binary().await {
                    Ok(_) => {
                        info!("Using llama.cpp backend (embedded or extracted binary)");
                        Ok(TrainingBackend::LlamaCpp)
                    }
                    Err(e) => {
                        // Fallback to checking build directory
                        let finetune_bin = self.llama_cpp_dir.join("build/bin/llama-finetune");
                        if !finetune_bin.exists() {
                            anyhow::bail!(
                                "llama.cpp backend requested but llama-finetune not found.\n{}",
                                e
                            );
                        }
                        Ok(TrainingBackend::LlamaCpp)
                    }
                }
            }
            TrainingBackend::NativeRust => {
                // User explicitly requested native Rust
                #[cfg(feature = "native-training")]
                {
                    Ok(TrainingBackend::NativeRust)
                }
                #[cfg(not(feature = "native-training"))]
                {
                    anyhow::bail!(
                        "Native Rust backend requested but not compiled. \
                         Rebuild with --features native-training"
                    );
                }
            }
            TrainingBackend::Auto => {
                // Auto-detect: prefer native Rust, fallback to llama.cpp
                #[cfg(feature = "native-training")]
                {
                    info!("Auto-selected native Rust training backend");
                    Ok(TrainingBackend::NativeRust)
                }
                #[cfg(not(feature = "native-training"))]
                {
                    // Native not available, try llama.cpp (embedded or build directory)
                    match crate::embedded_bins::get_finetune_binary().await {
                        Ok(path) => {
                            info!(
                                "Auto-selected llama.cpp training backend at {}",
                                path.display()
                            );
                            Ok(TrainingBackend::LlamaCpp)
                        }
                        Err(e) => {
                            anyhow::bail!(
                                "No training backend available.\n{}\n\n\
                                 Alternative: Rebuild with --features native-training for native Rust backend.",
                                e
                            )
                        }
                    }
                }
            }
        }
    }

    /// Run LoRA training using the configured backend
    pub async fn train(&self, base_model_path: &str) -> Result<TrainingResult> {
        let backend = self.select_backend().await?;

        match backend {
            TrainingBackend::NativeRust => {
                #[cfg(feature = "native-training")]
                {
                    self.train_with_native_rust(base_model_path).await
                }
                #[cfg(not(feature = "native-training"))]
                {
                    unreachable!("Native Rust backend selected but feature not enabled")
                }
            }
            TrainingBackend::LlamaCpp | TrainingBackend::Auto => {
                self.train_with_llama_cpp(base_model_path).await
            }
        }
    }

    /// Run LoRA training using native Rust backend
    #[cfg(feature = "native-training")]
    async fn train_with_native_rust(&self, base_model_path: &str) -> Result<TrainingResult> {
        info!("Using native Rust training backend (metal-candle)");

        // Create MetalLoRATrainer with same configuration
        let metal_trainer = MetalLoRATrainer::new(
            self.config.clone(),
            self.store.clone(),
            None, // tokenizer_path - will auto-discover or use fallback
        )?;

        // Delegate to native trainer
        let result = metal_trainer.train(base_model_path).await?;

        // Mark training as completed in storage (same as llama.cpp path)
        self.store.mark_training_completed()?;
        let _ = self.store.reset_request_counter();

        Ok(result)
    }

    /// Run LoRA training using llama.cpp's finetune binary
    async fn train_with_llama_cpp(&self, base_model_path: &str) -> Result<TrainingResult> {
        info!("Using llama.cpp training backend");

        let start_time = Instant::now();
        info!(
            "Starting LoRA training with base model: {}",
            base_model_path
        );

        // Prepare training and validation data
        let (training_data_path, _validation_data_path) = self
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

        // Get llama-finetune binary (embedded, extracted, or from build directory)
        let finetune_bin = match crate::embedded_bins::get_finetune_binary().await {
            Ok(path) => {
                info!("Using llama-finetune binary from: {}", path.display());
                path
            }
            Err(_) => {
                // Fallback to build directory
                let fallback = self.llama_cpp_dir.join("build/bin/llama-finetune");
                if !fallback.exists() {
                    return Err(crate::embedded_bins::get_finetune_binary()
                        .await
                        .unwrap_err());
                }
                info!(
                    "Using llama-finetune binary from build directory: {}",
                    fallback.display()
                );
                fallback
            }
        };

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

        cmd.arg("--epochs")
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

        // Configure command to capture stdout/stderr for progress reporting
        cmd.stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        // Execute training with real-time progress reporting
        let mut child = cmd.spawn().context("Failed to spawn training process")?;

        let stdout = child.stdout.take().context("Failed to capture stdout")?;
        let stderr = child.stderr.take().context("Failed to capture stderr")?;

        // Stream and log training progress in real-time
        use tokio::io::{AsyncBufReadExt, BufReader};
        let stdout_reader = BufReader::new(stdout);
        let stderr_reader = BufReader::new(stderr);

        let mut stdout_lines = stdout_reader.lines();
        let mut stderr_lines = stderr_reader.lines();

        let mut stdout_text = String::new();
        let mut stderr_text = String::new();
        let mut last_loss: Option<f64> = None;
        let mut epoch_count = 0;

        // Monitor training progress with timeout
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(self.config.max_training_time_secs),
            async {
                loop {
                    tokio::select! {
                        line = stdout_lines.next_line() => {
                            match line {
                                Ok(Some(line)) => {
                                    // Parse and report progress
                                    if line.contains("loss") || line.contains("epoch") {
                                        info!("Training progress: {}", line);
                                        if let Some(loss) = extract_loss_from_line(&line) {
                                            last_loss = Some(loss);
                                        }
                                        if line.contains("epoch") {
                                            epoch_count += 1;
                                        }
                                    }
                                    stdout_text.push_str(&line);
                                    stdout_text.push('\n');
                                }
                                Ok(None) => break,
                                Err(e) => {
                                    warn!("Error reading stdout: {}", e);
                                    break;
                                }
                            }
                        }
                        line = stderr_lines.next_line() => {
                            match line {
                                Ok(Some(line)) => {
                                    if !line.trim().is_empty() {
                                        warn!("Training stderr: {}", line);
                                    }
                                    stderr_text.push_str(&line);
                                    stderr_text.push('\n');
                                }
                                Ok(None) => break,
                                Err(e) => {
                                    warn!("Error reading stderr: {}", e);
                                    break;
                                }
                            }
                        }
                    }
                }
                child.wait().await
            },
        )
        .await;

        let output_status = match result {
            Ok(status_result) => status_result.context("Training process failed")?,
            Err(_) => {
                let _ = child.kill().await;
                anyhow::bail!(
                    "Training timeout after {} seconds",
                    self.config.max_training_time_secs
                );
            }
        };

        if !output_status.success() {
            error!("Training failed: {}", stderr_text.trim());
            anyhow::bail!("Training process failed: {}", stderr_text.trim());
        }

        if epoch_count > 0 {
            info!("Completed {} training epochs", epoch_count);
        }
        if let Some(loss) = last_loss {
            info!("Final training loss: {:.6}", loss);
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
        let (adapter_path_for_result, encrypted_path) =
            if let Some(ref encryption) = self.encryption {
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
            final_loss: last_loss
                .or_else(|| parse_final_loss(&stdout_text))
                .or_else(|| parse_final_loss(&stderr_text)),
            adapter_size_bytes: Some(adapter_size_bytes),
        })
    }

    /// Get the latest trained adapter (supports .gguf, .safetensors, and .enc)
    pub async fn get_latest_adapter(&self) -> Result<Option<PathBuf>> {
        let adapter_dir = PathBuf::from(&self.config.adapter_dir);
        if !adapter_dir.exists() {
            return Ok(None);
        }

        let mut entries = fs::read_dir(&adapter_dir).await?;
        let mut latest: Option<(PathBuf, std::time::SystemTime)> = None;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            let ext = path.extension().and_then(|s| s.to_str());
            let is_adapter = matches!(ext, Some("gguf") | Some("safetensors") | Some("enc"));

            if is_adapter {
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
    /// Handles .gguf, .safetensors (with conversion), and .enc (with decryption).
    pub async fn materialize_latest_adapter_for_runtime(&self) -> Result<Option<PathBuf>> {
        let Some(latest) = self.get_latest_adapter().await? else {
            return Ok(None);
        };

        let adapter_dir = PathBuf::from(&self.config.adapter_dir);
        fs::create_dir_all(&adapter_dir).await?;

        let ext = latest.extension().and_then(|s| s.to_str());

        match ext {
            Some("gguf") => {
                // Already in GGUF format, use directly
                Ok(Some(latest))
            }
            Some("safetensors") => {
                // Convert safetensors to GGUF for runtime loading
                #[cfg(feature = "native-training")]
                {
                    info!("Converting safetensors adapter to GGUF for runtime loading...");
                    let gguf_path = adapter_dir.join("current_adapter.gguf");

                    // Use MetalLoRATrainer's conversion helper
                    let metal_trainer =
                        MetalLoRATrainer::new(self.config.clone(), self.store.clone(), None)?;

                    metal_trainer
                        .convert_safetensors_to_gguf(&latest, &gguf_path)
                        .await?;

                    if gguf_path.exists() {
                        Ok(Some(gguf_path))
                    } else {
                        warn!("GGUF conversion failed. Runtime may not support safetensors.");
                        Ok(Some(latest)) // Fallback to safetensors
                    }
                }
                #[cfg(not(feature = "native-training"))]
                {
                    warn!(
                        "Found safetensors adapter but native-training feature not enabled. \
                         Cannot convert to GGUF. Runtime may not support this format."
                    );
                    Ok(Some(latest)) // Return as-is, runtime may or may not support it
                }
            }
            Some("enc") => {
                // Decrypt encrypted adapter
                let enc = self.encryption.as_ref().ok_or_else(|| {
                    anyhow::anyhow!("Found encrypted adapter but encryption is disabled")
                })?;
                let enc = enc.clone();

                let out = adapter_dir.join("current_adapter.gguf");
                let out_for_task = out.clone();
                let latest_for_task = latest.clone();

                // Decrypt (blocking IO inside encryption module)
                tokio::task::spawn_blocking(move || {
                    enc.decrypt_file(latest_for_task, &out_for_task)
                })
                .await
                .context("Decryption task failed")??;

                // After decryption, check if it's safetensors and needs conversion
                if let Some(decrypted_ext) = out.extension().and_then(|s| s.to_str()) {
                    if decrypted_ext == "safetensors" {
                        // Recursively handle the decrypted safetensors
                        #[cfg(feature = "native-training")]
                        {
                            let gguf_path = adapter_dir.join("current_adapter_converted.gguf");
                            let metal_trainer = MetalLoRATrainer::new(
                                self.config.clone(),
                                self.store.clone(),
                                None,
                            )?;
                            metal_trainer
                                .convert_safetensors_to_gguf(&out, &gguf_path)
                                .await?;
                            if gguf_path.exists() {
                                return Ok(Some(gguf_path));
                            }
                        }
                        #[cfg(not(feature = "native-training"))]
                        {
                            warn!("Decrypted adapter is safetensors but cannot convert without native-training feature");
                        }
                    }
                }

                Ok(Some(out))
            }
            _ => {
                warn!("Unknown adapter format: {:?}", ext);
                Ok(None)
            }
        }
    }
}

/// Extract loss value from a single training log line
fn extract_loss_from_line(line: &str) -> Option<f64> {
    let l = line.to_lowercase();
    if !l.contains("loss") {
        return None;
    }

    // Find the position of "loss" and extract number after it
    if let Some(loss_pos) = l.find("loss") {
        let after_loss = &l[loss_pos + 4..]; // Skip "loss"

        // Extract the first number after "loss"
        for token in after_loss
            .split(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-' || c == 'e'))
            .filter(|t| !t.is_empty())
        {
            if let Ok(v) = token.parse::<f64>() {
                if v >= 0.0 && v < 1000.0 {
                    // Sanity check: loss should be reasonable
                    return Some(v);
                }
            }
        }
    }
    None
}

fn parse_final_loss(text: &str) -> Option<f64> {
    // Best-effort parse: look for patterns like "loss=0.123" or "loss: 0.123".
    let mut best: Option<f64> = None;
    for line in text.lines() {
        if let Some(loss) = extract_loss_from_line(line) {
            best = Some(loss);
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::TrainingExample;
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

    #[tokio::test]
    async fn test_training_data_preparation_with_validation_split() -> Result<()> {
        let dir = tempdir()?;
        let db_path = dir.path().join("test.db");
        let adapter_dir = dir.path().join("adapters");
        let store = TrainingDataStore::open(&db_path)?;

        // Create 10 training examples
        for i in 0..10 {
            let example = TrainingExample {
                prompt: format!("Question {}", i),
                completion: format!("Answer {}", i),
                timestamp: 1000 + i,
                model_used: "test-model".to_string(),
            };
            store.store_example(&example)?;
        }

        let mut config = LoRATrainingConfig::default();
        config.adapter_dir = adapter_dir.to_string_lossy().to_string();

        let llama_cpp_dir = PathBuf::from("../../../llama.cpp");
        let trainer = LoRATrainer::new(config, store.clone(), llama_cpp_dir);

        // Prepare training data
        let (train_file, val_file) = trainer.prepare_training_data().await?;

        // Verify files were created
        assert!(train_file.exists());
        assert!(val_file.is_some());

        let val_path = val_file.unwrap();
        assert!(val_path.exists());

        // Verify content (should have ~8 training examples, ~2 validation)
        let train_content = tokio::fs::read_to_string(&train_file).await?;
        let val_content = tokio::fs::read_to_string(&val_path).await?;

        // Count instruction markers (each example has one)
        let train_count = train_content.matches("### Instruction:").count();
        let val_count = val_content.matches("### Instruction:").count();

        assert_eq!(train_count + val_count, 10);
        assert!(train_count >= 7 && train_count <= 9); // ~80%
        assert!(val_count >= 1 && val_count <= 3); // ~20%

        Ok(())
    }

    #[tokio::test]
    async fn test_extract_loss_from_line() {
        // Test various loss line formats
        assert_eq!(extract_loss_from_line("loss: 0.5432"), Some(0.5432));
        assert_eq!(extract_loss_from_line("loss=0.123"), Some(0.123));
        assert_eq!(extract_loss_from_line("epoch 5: loss 1.234"), Some(1.234));
        assert_eq!(extract_loss_from_line("train_loss: 2.5e-3"), Some(0.0025));
        assert_eq!(extract_loss_from_line("no loss here"), None);
        assert_eq!(extract_loss_from_line("loss: -0.1"), None); // Negative loss is invalid
    }

    #[tokio::test]
    async fn test_parse_final_loss() {
        let log =
            "Starting training\nepoch 1: loss 0.8\nepoch 2: loss 0.6\nepoch 3: loss 0.4\nDone";
        assert_eq!(parse_final_loss(log), Some(0.4)); // Should return last loss

        let empty_log = "No loss information here";
        assert_eq!(parse_final_loss(empty_log), None);
    }

    #[tokio::test]
    async fn test_get_latest_adapter() -> Result<()> {
        let dir = tempdir()?;
        let adapter_dir = dir.path().join("adapters");
        tokio::fs::create_dir_all(&adapter_dir).await?;

        let mut config = LoRATrainingConfig::default();
        config.adapter_dir = adapter_dir.to_string_lossy().to_string();

        let db_path = dir.path().join("test.db");
        let store = TrainingDataStore::open(&db_path)?;
        let llama_cpp_dir = PathBuf::from("../../../llama.cpp");
        let trainer = LoRATrainer::new(config, store, llama_cpp_dir);

        // No adapters initially
        assert!(trainer.get_latest_adapter().await?.is_none());

        // Create a mock adapter file
        let adapter1 = adapter_dir.join("lora_adapter_1000.gguf");
        tokio::fs::write(&adapter1, b"mock adapter 1").await?;

        // Wait a bit to ensure different timestamps
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        let adapter2 = adapter_dir.join("lora_adapter_2000.gguf");
        tokio::fs::write(&adapter2, b"mock adapter 2").await?;

        // Should return the most recent one
        let latest = trainer.get_latest_adapter().await?.unwrap();
        assert_eq!(latest.file_name().unwrap(), "lora_adapter_2000.gguf");

        Ok(())
    }

    #[tokio::test]
    async fn test_materialize_encrypted_adapter() -> Result<()> {
        let dir = tempdir()?;
        let adapter_dir = dir.path().join("adapters");
        tokio::fs::create_dir_all(&adapter_dir).await?;

        let mut config = LoRATrainingConfig::default();
        config.adapter_dir = adapter_dir.to_string_lossy().to_string();
        config.encrypt_adapters = true;

        let db_path = dir.path().join("test.db");
        let store = TrainingDataStore::open(&db_path)?;
        let llama_cpp_dir = PathBuf::from("../../../llama.cpp");
        let trainer = LoRATrainer::new(config, store, llama_cpp_dir);

        // Create a mock encrypted adapter
        let encrypted_path = adapter_dir.join("lora_adapter_1000.enc");
        let plain_data = b"This is a mock LoRA adapter in GGUF format";

        // Encrypt it
        let encryption = trainer.encryption.as_ref().unwrap();
        let temp_plain = adapter_dir.join("temp_plain.gguf");
        tokio::fs::write(&temp_plain, plain_data).await?;
        encryption.encrypt_file(&temp_plain, &encrypted_path)?;
        tokio::fs::remove_file(&temp_plain).await?;

        // Materialize should decrypt it
        let materialized = trainer.materialize_latest_adapter_for_runtime().await?;
        assert!(materialized.is_some());

        let decrypted_path = materialized.unwrap();
        assert!(decrypted_path.exists());
        assert_eq!(decrypted_path.file_name().unwrap(), "current_adapter.gguf");

        // Verify decrypted content matches original
        let decrypted_data = tokio::fs::read(&decrypted_path).await?;
        assert_eq!(decrypted_data, plain_data);

        Ok(())
    }
}
