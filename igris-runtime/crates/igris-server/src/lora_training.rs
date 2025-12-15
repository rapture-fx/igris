use anyhow::Result;
use igris_lora_trainer::{LoRATrainer, LoRATrainingConfig, TrainingDataStore, TrainingExample};
use igris_routing::local_provider::LocalProvider;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::{info, warn};

pub struct LoraTrainingManager {
    base_model_path: String,
    trainer: Arc<LoRATrainer>,
    store: TrainingDataStore,
    max_training_lock: Arc<Semaphore>,
    auto_load: bool,
    local_provider: Option<Arc<LocalProvider>>,
}

impl LoraTrainingManager {
    pub fn new(
        config: LoRATrainingConfig,
        store: TrainingDataStore,
        llama_cpp_dir: PathBuf,
        base_model_path: String,
        local_provider: Option<Arc<LocalProvider>>,
    ) -> Self {
        let auto_load = config.auto_load_adapter;
        let trainer = Arc::new(LoRATrainer::new(config, store.clone(), llama_cpp_dir));
        Self {
            base_model_path,
            trainer,
            store,
            max_training_lock: Arc::new(Semaphore::new(1)),
            auto_load,
            local_provider,
        }
    }

    pub async fn maybe_auto_load_latest(&self) -> Result<()> {
        if !self.auto_load {
            return Ok(());
        }
        let Some(local) = &self.local_provider else {
            return Ok(());
        };
        if let Some(path) = self.trainer.materialize_latest_adapter_for_runtime().await? {
            info!("Auto-loading latest LoRA adapter: {}", path.display());
            local.load_lora_adapter(Some(path)).await?;
        }
        Ok(())
    }

    pub fn record_example(&self, prompt: String, completion: String, model_used: String) -> Result<()> {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        let ex = TrainingExample {
            prompt,
            completion,
            timestamp: ts,
            model_used,
        };
        self.store.store_example(&ex)?;
        let _ = self.store.increment_request_counter()?;
        Ok(())
    }

    pub async fn maybe_trigger_background_training(&self) -> Result<()> {
        if !self.trainer.should_trigger_training().await? {
            return Ok(());
        }

        // Prevent concurrent training runs.
        let permit = match self.max_training_lock.clone().try_acquire_owned() {
            Ok(p) => p,
            Err(_) => {
                warn!("LoRA training already in progress; skipping trigger");
                return Ok(());
            }
        };

        let trainer = self.trainer.clone();
        let base_model_path = self.base_model_path.clone();
        let local = self.local_provider.clone();
        let auto_load = self.auto_load;

        tokio::spawn(async move {
            let _permit = permit;
            match trainer.train(&base_model_path).await {
                Ok(res) => {
                    info!(
                        "LoRA training completed: status={:?} samples={} time={:.2}s encrypted={}",
                        res.status,
                        res.training_samples,
                        res.training_time_secs,
                        res.encrypted_adapter_path.is_some()
                    );

                    if auto_load {
                        if let Some(local) = &local {
                            match trainer.materialize_latest_adapter_for_runtime().await {
                                Ok(Some(path)) => {
                                    if let Err(e) = local.load_lora_adapter(Some(path)).await {
                                        warn!("Failed to hot-load trained adapter: {}", e);
                                    }
                                }
                                Ok(None) => warn!("Training finished but no adapter artifact found to load"),
                                Err(e) => warn!("Failed to materialize adapter for runtime: {}", e),
                            }
                        }
                    }
                }
                Err(e) => warn!("LoRA training failed: {}", e),
            }
        });

        Ok(())
    }
}


