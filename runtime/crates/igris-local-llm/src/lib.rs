pub mod provider;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

pub use provider::LocalLLMProviderAdapter;

/// Configuration for local LLM fallback
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalLLMConfig {
    /// Enable local LLM fallback
    pub enabled: bool,
    /// Path to GGUF model file
    pub model_path: String,
    /// Context size (default: 4096)
    #[serde(default = "default_context_size")]
    pub context_size: u32,
    /// Number of threads for inference (default: 4)
    #[serde(default = "default_threads")]
    pub threads: u32,
    /// Maximum tokens to generate (default: 512)
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    /// Temperature for sampling (default: 0.7)
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    /// Cost per 1k tokens (for Thompson Sampling)
    #[serde(default)]
    pub cost_per_1k_tokens: f64,
}

fn default_context_size() -> u32 {
    4096
}

fn default_threads() -> u32 {
    4
}

fn default_max_tokens() -> u32 {
    512
}

fn default_temperature() -> f32 {
    0.7
}

impl Default for LocalLLMConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            model_path: "models/phi-3-mini-4k-instruct-q4.gguf".to_string(),
            context_size: 4096,
            threads: 4,
            max_tokens: 512,
            temperature: 0.7,
            cost_per_1k_tokens: 0.0, // Free!
        }
    }
}

/// Local LLM provider using llama.cpp
///
/// NOTE: This is a stub implementation. The actual llama.cpp integration
/// requires platform-specific compilation and is configured via the
/// llama_cpp_rs crate. For production use, ensure llama_cpp_rs is properly
/// configured in Cargo.toml with the appropriate features for your platform.
pub struct LocalLLMProvider {
    config: LocalLLMConfig,
    _model_path: PathBuf,
}

impl LocalLLMProvider {
    /// Create a new local LLM provider
    pub fn new(config: LocalLLMConfig) -> Result<Self> {
        info!("Initializing local LLM provider from {}", config.model_path);

        let model_path = PathBuf::from(&config.model_path);
        if !model_path.exists() {
            anyhow::bail!(
                "Model file not found: {}. Run download-model.sh to download it.",
                config.model_path
            );
        }

        info!("Model file found: {}", config.model_path);
        info!(
            "Local LLM initialized: context_size={}, threads={}",
            config.context_size, config.threads
        );

        Ok(Self {
            config,
            _model_path: model_path,
        })
    }

    /// Generate completion for a prompt
    ///
    /// NOTE: This is a stub implementation that will be replaced with actual
    /// llama.cpp inference once the native library is properly linked.
    pub async fn generate(&self, prompt: &str) -> Result<String> {
        debug!("Local LLM generating response for prompt: {}", prompt);

        // Stub implementation - returns a placeholder response
        // In production, this would call llama.cpp for actual inference
        let response = format!(
            "[Local LLM Response - Phi-3 Mini 4K]\n\nReceived prompt: {}\n\n\
            This is a placeholder response. To enable actual local LLM inference:\n\
            1. Ensure llama_cpp_rs is properly configured with platform-specific features\n\
            2. Link against llama.cpp native library\n\
            3. Implement inference using LlamaModel, LlamaContext, and LlamaSampler\n\n\
            Model: {}\nThreads: {}\nContext: {}",
            prompt,
            self.config.model_path,
            self.config.threads,
            self.config.context_size
        );

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        Ok(response)
    }

    /// Get provider ID
    pub fn id(&self) -> &str {
        "local-phi3"
    }

    /// Get provider name
    pub fn name(&self) -> &str {
        "Local Phi-3 Mini 4K (Stub)"
    }

    /// Get model path
    pub fn model_path(&self) -> &str {
        &self.config.model_path
    }

    /// Get config
    pub fn config(&self) -> &LocalLLMConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = LocalLLMConfig::default();
        assert_eq!(config.context_size, 4096);
        assert_eq!(config.threads, 4);
        assert!(!config.enabled);
    }

    #[test]
    fn test_config_serialization() {
        let config = LocalLLMConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: LocalLLMConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.context_size, deserialized.context_size);
    }
}
