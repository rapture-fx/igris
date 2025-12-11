use crate::speculative::Provider;
use igris_local_llm::LocalLLMProviderAdapter;
use std::pin::Pin;
use futures::Stream;

/// Wrapper to implement Provider trait for LocalLLMProviderAdapter
pub struct LocalProvider {
    adapter: LocalLLMProviderAdapter,
}

impl LocalProvider {
    pub fn new(adapter: LocalLLMProviderAdapter) -> Self {
        Self { adapter }
    }
}

impl Provider for LocalProvider {
    fn id(&self) -> &str {
        self.adapter.id()
    }

    fn name(&self) -> &str {
        self.adapter.name()
    }

    async fn stream(&self, prompt: &str) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        self.adapter.stream(prompt).await
    }

    async fn complete(&self, prompt: &str) -> anyhow::Result<String> {
        self.adapter.complete(prompt).await
    }
}
