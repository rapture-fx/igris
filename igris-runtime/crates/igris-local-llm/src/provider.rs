use crate::{LocalLLMConfig, LocalLLMProvider as LocalLLMEngine};
use async_stream::stream;
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
        // For streaming, we'll generate the full response and stream it word by word
        // This is a simple implementation; a real streaming impl would need
        // token-by-token generation
        let result = self.engine.generate(prompt).await?;

        let s = stream! {
            // Split by spaces and yield each word
            for word in result.split_whitespace() {
                yield Ok(format!("{} ", word));
            }
        };

        Ok(Box::pin(s))
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
