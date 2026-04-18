use crate::speculative::Provider;
use futures::Stream;
use igris_local_llm::LocalLLMProviderAdapter;
use std::pin::Pin;

/// Wrapper to implement Provider trait for LocalLLMProviderAdapter
pub struct LocalProvider {
    adapter: LocalLLMProviderAdapter,
}

impl LocalProvider {
    pub fn new(adapter: LocalLLMProviderAdapter) -> Self {
        Self { adapter }
    }

    /// Hot-swap the LoRA adapter used by the underlying local engine.
    pub async fn load_lora_adapter(
        &self,
        adapter_path: Option<std::path::PathBuf>,
    ) -> anyhow::Result<()> {
        self.adapter.load_lora_adapter(adapter_path).await
    }

    /// Hot-swap the underlying local model without restarting the server.
    pub async fn hot_swap(
        &self,
        new_model_path: std::path::PathBuf,
        context_size: Option<u32>,
        threads: Option<u32>,
        n_gpu_layers: Option<u32>,
        main_gpu: Option<Option<u32>>,
    ) -> anyhow::Result<()> {
        self.adapter
            .hot_swap(
                new_model_path,
                context_size,
                threads,
                n_gpu_layers,
                main_gpu,
            )
            .await
    }

    /// Get the current config of the underlying engine.
    pub async fn config(&self) -> igris_local_llm::LocalLLMConfig {
        self.adapter.engine().config().await
    }

    /// Get the current adapter path.
    pub async fn get_adapter_path(&self) -> Option<std::path::PathBuf> {
        self.adapter.engine().get_adapter_path().await
    }
}

impl Provider for LocalProvider {
    fn id(&self) -> &str {
        self.adapter.id()
    }

    fn name(&self) -> &str {
        self.adapter.name()
    }

    async fn stream(
        &self,
        prompt: &str,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        self.adapter.stream(prompt).await
    }

    async fn complete(&self, prompt: &str) -> anyhow::Result<String> {
        self.adapter.complete(prompt).await
    }
}
