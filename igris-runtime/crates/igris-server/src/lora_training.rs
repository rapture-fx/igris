use anyhow::Result;
use igris_lora_trainer::{
    LoRATrainer, LoRATrainingConfig, TrainingDataStore, TrainingExample, TrainingResult,
    TrainingStatus,
};
use igris_routing::local_provider::LocalProvider;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::sync::Semaphore;
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub struct LoraTrainingStatusSnapshot {
    pub status: TrainingStatus,
    pub last_started_at: Option<u64>,
    pub last_finished_at: Option<u64>,
    pub last_error: Option<String>,
    pub last_result: Option<TrainingResult>,
    pub total_examples: usize,
    pub request_counter: u64,
    pub should_trigger: bool,
}

#[derive(Debug, Clone)]
struct RuntimeTrainingState {
    status: TrainingStatus,
    last_started_at: Option<u64>,
    last_finished_at: Option<u64>,
    last_error: Option<String>,
    last_result: Option<TrainingResult>,
}

pub struct LoraTrainingManager {
    base_model_path: String,
    trainer: Arc<LoRATrainer>,
    store: TrainingDataStore,
    max_training_lock: Arc<Semaphore>,
    auto_load: bool,
    local_provider: Option<Arc<LocalProvider>>,
    state: Arc<RwLock<RuntimeTrainingState>>,
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
            state: Arc::new(RwLock::new(RuntimeTrainingState {
                status: TrainingStatus::Idle,
                last_started_at: None,
                last_finished_at: None,
                last_error: None,
                last_result: None,
            })),
        }
    }

    pub async fn maybe_auto_load_latest(&self) -> Result<()> {
        if !self.auto_load {
            return Ok(());
        }
        let Some(local) = &self.local_provider else {
            return Ok(());
        };
        if let Some(path) = self
            .trainer
            .materialize_latest_adapter_for_runtime()
            .await?
        {
            info!("Auto-loading latest LoRA adapter: {}", path.display());
            local.load_lora_adapter(Some(path)).await?;
        }
        Ok(())
    }

    pub async fn status_snapshot(&self) -> Result<LoraTrainingStatusSnapshot> {
        let state = self.state.read().await.clone();
        let total_examples = self.store.get_total_examples()?;
        let request_counter = self.store.get_request_counter()?;
        let should_trigger = self
            .trainer
            .should_trigger_training()
            .await
            .unwrap_or(false);
        Ok(LoraTrainingStatusSnapshot {
            status: state.status,
            last_started_at: state.last_started_at,
            last_finished_at: state.last_finished_at,
            last_error: state.last_error,
            last_result: state.last_result,
            total_examples,
            request_counter,
            should_trigger,
        })
    }

    pub fn record_example(
        &self,
        prompt: String,
        completion: String,
        model_used: String,
    ) -> Result<()> {
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
        let state = self.state.clone();

        tokio::spawn(async move {
            let _permit = permit;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            {
                let mut st = state.write().await;
                st.status = TrainingStatus::Training;
                st.last_started_at = Some(now);
                st.last_error = None;
            }

            match trainer.train(&base_model_path).await {
                Ok(res) => {
                    info!(
                        "LoRA training completed: status={:?} samples={} time={:.2}s encrypted={}",
                        res.status,
                        res.training_samples,
                        res.training_time_secs,
                        res.encrypted_adapter_path.is_some()
                    );
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    {
                        let mut st = state.write().await;
                        st.status = res.status;
                        st.last_finished_at = Some(now);
                        st.last_result = Some(res.clone());
                        st.last_error = None;
                    }

                    if auto_load {
                        if let Some(local) = &local {
                            match trainer.materialize_latest_adapter_for_runtime().await {
                                Ok(Some(path)) => {
                                    if let Err(e) = local.load_lora_adapter(Some(path)).await {
                                        warn!("Failed to hot-load trained adapter: {}", e);
                                    }
                                }
                                Ok(None) => {
                                    warn!("Training finished but no adapter artifact found to load")
                                }
                                Err(e) => warn!("Failed to materialize adapter for runtime: {}", e),
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("LoRA training failed: {}", e);
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    let mut st = state.write().await;
                    st.status = TrainingStatus::Failed;
                    st.last_finished_at = Some(now);
                    st.last_error = Some(e.to_string());
                }
            }
        });

        Ok(())
    }
}
