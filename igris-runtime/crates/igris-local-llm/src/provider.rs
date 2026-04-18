use crate::{LocalLLMConfig, LocalLLMProvider as LocalLLMEngine};
use futures::Stream;
use std::pin::Pin;
use std::sync::Arc;

/// Provider wrapper that implements the igris-routing Provider trait
pub struct LocalLLMProviderAdapter {
    engine: Arc<LocalLLMEngine>,
}

impl LocalLLMProviderAdapter {
    /// Create a new LocalLLMProviderAdapter
    pub fn new(config: LocalLLMConfig) -> anyhow::Result<Self> {
        let engine = LocalLLMEngine::new(config)?;
        Ok(Self {
            engine: Arc::new(engine),
        })
    }

    /// Get the underlying engine (for testing)
    pub fn engine(&self) -> &LocalLLMEngine {
        &self.engine
    }
}

// Note: We can't implement the Provider trait here directly because it's defined
// in igris-routing, and we don't want circular dependencies. Instead, we'll
// implement it in the igris-routing crate using this adapter.

// For now, we'll provide the methods that will be needed:
impl LocalLLMProviderAdapter {
    pub fn id(&self) -> &str {
        self.engine.id()
    }

    pub fn name(&self) -> &str {
        self.engine.name()
    }

    pub async fn complete(&self, prompt: &str) -> anyhow::Result<String> {
        self.engine.generate(prompt).await
    }

    pub async fn stream(
        &self,
        prompt: &str,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        // Real streaming: forward stdout chunks from llama.cpp CLI.
        self.engine.stream(prompt).await
    }

    /// Hot-swap the LoRA adapter used by the underlying local engine.
    pub async fn load_lora_adapter(
        &self,
        adapter_path: Option<std::path::PathBuf>,
    ) -> anyhow::Result<()> {
        self.engine.load_lora_adapter(adapter_path).await
    }

    /// Hot-swap the underlying local model without restarting.
    pub async fn hot_swap(
        &self,
        new_model_path: std::path::PathBuf,
        context_size: Option<u32>,
        threads: Option<u32>,
        n_gpu_layers: Option<u32>,
        main_gpu: Option<Option<u32>>,
    ) -> anyhow::Result<()> {
        self.engine
            .hot_swap(
                new_model_path,
                context_size,
                threads,
                n_gpu_layers,
                main_gpu,
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adapter_creation_fails_without_model() {
        let config = LocalLLMConfig::default();
        let result = LocalLLMProviderAdapter::new(config);
        // Should fail because model file doesn't exist
        assert!(result.is_err());
    }
}
