pub mod models;
pub mod provider;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

pub use models::ModelId;
pub use provider::LocalLLMProviderAdapter;

/// Configuration for local LLM fallback (v1.4 multi-model support)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalLLMConfig {
    /// Enable local LLM fallback
    pub enabled: bool,

    /// Selected model ID (NEW in v1.4)
    /// If not specified, uses model_path for backward compatibility
    #[serde(default)]
    pub selected_model: Option<ModelId>,

    /// Path to GGUF model file (v1.1-1.3 compatibility)
    /// If selected_model is set, this is auto-generated from model registry
    pub model_path: String,

    /// Optional LoRA adapter path (for fine-tuned models)
    #[serde(default)]
    pub lora_adapter_path: Option<String>,

    /// Context size (default: auto-detected from selected_model or 4096)
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

impl LocalLLMConfig {
    /// Resolve the actual model path (v1.4 auto-resolution)
    pub fn resolve_model_path(&self) -> String {
        if let Some(ref model_id) = self.selected_model {
            format!("models/{}", model_id.default_filename())
        } else {
            self.model_path.clone()
        }
    }

    /// Resolve the context size (v1.4 auto-detection)
    pub fn resolve_context_size(&self) -> u32 {
        if let Some(ref model_id) = self.selected_model {
            if self.context_size == 4096 {
                // Use model's recommended context size if user hasn't changed default
                model_id.recommended_context_size()
            } else {
                self.context_size
            }
        } else {
            self.context_size
        }
    }

    /// Get the display name of the current model
    pub fn model_display_name(&self) -> String {
        if let Some(ref model_id) = self.selected_model {
            model_id.display_name().to_string()
        } else {
            "Custom Model".to_string()
        }
    }
}

impl Default for LocalLLMConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            selected_model: None, // Use model_path for backward compatibility
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
        let resolved_path = config.resolve_model_path();
        let model_name = config.model_display_name();

        info!("Initializing local LLM provider: {}", model_name);
        info!("Model path: {}", resolved_path);

        let model_path = PathBuf::from(&resolved_path);
        if !model_path.exists() {
            anyhow::bail!(
                "Model file not found: {}. Run download-model.sh to download it.",
                resolved_path
            );
        }

        info!("Model file found: {}", resolved_path);

        let adapter_path = config.lora_adapter_path.as_ref().map(PathBuf::from);
        if let Some(ref adapter) = adapter_path {
            if adapter.exists() {
                info!("LoRA adapter found: {}", adapter.display());
            } else {
                warn!("LoRA adapter configured but not found: {}", adapter.display());
            }
        }

        let resolved_context = config.resolve_context_size();
        info!(
            "Local LLM initialized: model={}, context_size={}, threads={}, adapter={}",
            model_name,
            resolved_context,
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

        let model_name = config.model_display_name();
        let resolved_context = config.resolve_context_size();
        let resolved_path = config.resolve_model_path();

        let response = format!(
            "[Local LLM Response - {}{}]\n\nReceived prompt: {}\n\n\
            This is a placeholder response. To enable actual local LLM inference:\n\
            1. Ensure llama_cpp_rs is properly configured with platform-specific features\n\
            2. Link against llama.cpp native library\n\
            3. Implement inference using LlamaModel, LlamaContext, and LlamaSampler\n\n\
            Model: {}\nPath: {}\nThreads: {}\nContext: {}{}",
            model_name,
            if adapter.is_some() { " + LoRA" } else { "" },
            prompt,
            model_name,
            resolved_path,
            config.threads,
            resolved_context,
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
