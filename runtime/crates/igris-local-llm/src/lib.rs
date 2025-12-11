pub mod provider;

use anyhow::Result;
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
    /// Optional LoRA adapter path (for fine-tuned models)
    #[serde(default)]
    pub lora_adapter_path: Option<String>,
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
            lora_adapter_path: None,
            context_size: 4096,
            threads: 4,
            max_tokens: 512,
            temperature: 0.7,
            cost_per_1k_tokens: 0.0, // Free!
        }
    }
}

/// Local LLM provider using llama.cpp with optional LoRA adapter support
///
/// NOTE: This is a stub implementation. The actual llama.cpp integration
/// requires platform-specific compilation and is configured via the
/// llama_cpp_rs crate. For production use, ensure llama_cpp_rs is properly
/// configured in Cargo.toml with the appropriate features for your platform.
pub struct LocalLLMProvider {
    config: Arc<Mutex<LocalLLMConfig>>,
    _model_path: PathBuf,
    current_adapter: Arc<Mutex<Option<PathBuf>>>,
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

        let adapter_path = config.lora_adapter_path.as_ref().map(PathBuf::from);
        if let Some(ref adapter) = adapter_path {
            if adapter.exists() {
                info!("LoRA adapter found: {}", adapter.display());
            } else {
                warn!("LoRA adapter configured but not found: {}", adapter.display());
            }
        }

        info!(
            "Local LLM initialized: context_size={}, threads={}, adapter={}",
            config.context_size,
            config.threads,
            adapter_path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "None".to_string())
        );

        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            _model_path: model_path,
            current_adapter: Arc::new(Mutex::new(adapter_path)),
        })
    }

    /// Generate completion for a prompt
    ///
    /// NOTE: This is a stub implementation that will be replaced with actual
    /// llama.cpp inference once the native library is properly linked.
    pub async fn generate(&self, prompt: &str) -> Result<String> {
        debug!("Local LLM generating response for prompt: {}", prompt);

        let config = self.config.lock().await;
        let adapter = self.current_adapter.lock().await;

        // Stub implementation - returns a placeholder response
        // In production, this would call llama.cpp for actual inference with optional LoRA adapter
        let adapter_info = if let Some(ref adapter_path) = *adapter {
            format!("\nLoRA Adapter: {} (ACTIVE)", adapter_path.display())
        } else {
            String::from("\nLoRA Adapter: None")
        };

        let response = format!(
            "[Local LLM Response - Phi-3 Mini 4K{}]\n\nReceived prompt: {}\n\n\
            This is a placeholder response. To enable actual local LLM inference:\n\
            1. Ensure llama_cpp_rs is properly configured with platform-specific features\n\
            2. Link against llama.cpp native library\n\
            3. Implement inference using LlamaModel, LlamaContext, and LlamaSampler\n\n\
            Model: {}\nThreads: {}\nContext: {}{}",
            if adapter.is_some() { " + LoRA" } else { "" },
            prompt,
            config.model_path,
            config.threads,
            config.context_size,
            adapter_info
        );

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        Ok(response)
    }

    /// Hot-swap LoRA adapter at runtime
    pub async fn load_lora_adapter(&self, adapter_path: Option<PathBuf>) -> Result<()> {
        if let Some(ref path) = adapter_path {
            if !path.exists() {
                anyhow::bail!("LoRA adapter file not found: {}", path.display());
            }
            info!("Loading LoRA adapter: {}", path.display());
        } else {
            info!("Unloading LoRA adapter (using base model only)");
        }

        let mut adapter = self.current_adapter.lock().await;
        let mut config = self.config.lock().await;

        *adapter = adapter_path.clone();
        config.lora_adapter_path = adapter_path.map(|p| p.display().to_string());

        info!("LoRA adapter hot-swap completed");
        Ok(())
    }

    /// Check if a LoRA adapter is currently loaded
    pub async fn has_adapter(&self) -> bool {
        self.current_adapter.lock().await.is_some()
    }

    /// Get current adapter path
    pub async fn get_adapter_path(&self) -> Option<PathBuf> {
        self.current_adapter.lock().await.clone()
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
    pub async fn model_path(&self) -> String {
        self.config.lock().await.model_path.clone()
    }

    /// Get config (async due to mutex)
    pub async fn config(&self) -> LocalLLMConfig {
        self.config.lock().await.clone()
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
