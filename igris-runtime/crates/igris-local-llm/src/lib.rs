pub mod inference;
pub mod models;
pub mod provider;
// Candle inference disabled due to dependency issues - use llama.cpp CLI instead
// pub mod candle_inference;
pub mod benchmark;
pub mod gpu_detect;

use anyhow::Result;
use base64::Engine;
use futures::Stream;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

pub use gpu_detect::{detect_hardware, AcceleratorType, HardwareInfo};
pub use inference::RealInferenceEngine;
pub use models::ModelId;
pub use provider::LocalLLMProviderAdapter;

// Re-export LLMProvider trait for convenience
pub use igris_reflection::LLMProvider;

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

    /// Number of GPU layers to offload (llama.cpp `-ngl` / `--n-gpu-layers`).
    /// Default 0 keeps CPU-only behavior for backward compatibility.
    #[serde(default)]
    pub n_gpu_layers: u32,

    /// Optional main GPU index (llama.cpp `--main-gpu`).
    #[serde(default)]
    pub main_gpu: Option<u32>,

    /// Optional directory for llama.cpp prompt-cache files (enables context caching between identical prompts).
    #[serde(default)]
    pub prompt_cache_dir: Option<String>,

    /// Optional llama.cpp batch size (`--batch-size`).
    #[serde(default)]
    pub batch_size: Option<u32>,

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
            n_gpu_layers: 0,
            main_gpu: None,
            prompt_cache_dir: None,
            batch_size: None,
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
/// **Phase 1 Implementation**: Real inference using llama.cpp bindings.
/// Enable `llama-inference` feature for actual model loading.
/// Without feature: falls back to stub for development.
pub struct LocalLLMProvider {
    config: Arc<Mutex<LocalLLMConfig>>,
    model_path: Arc<Mutex<PathBuf>>,
    current_adapter: Arc<Mutex<Option<PathBuf>>>,
    // Real inference engine (lazy loaded)
    engine: Arc<Mutex<Option<RealInferenceEngine>>>,
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
                warn!(
                    "LoRA adapter configured but not found: {}",
                    adapter.display()
                );
            }
        }

        let resolved_context = config.resolve_context_size();
        info!(
            "Local LLM initialized: model={}, context_size={}, threads={}, adapter={}",
            model_name,
            resolved_context,
            config.threads,
            adapter_path
                .as_ref()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|| "None".to_string())
        );

        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            model_path: Arc::new(Mutex::new(model_path)),
            current_adapter: Arc::new(Mutex::new(adapter_path)),
            engine: Arc::new(Mutex::new(None)), // Lazy load on first generate()
        })
    }

    /// Hot-swap the base model and/or core inference parameters without restarting.
    ///
    /// Implementation detail: we update config + model path and clear the lazy-loaded engine;
    /// the next call will load the new model with the updated settings.
    pub async fn hot_swap(
        &self,
        new_model_path: PathBuf,
        context_size: Option<u32>,
        threads: Option<u32>,
        n_gpu_layers: Option<u32>,
        main_gpu: Option<Option<u32>>,
    ) -> Result<()> {
        if !new_model_path.exists() {
            anyhow::bail!("Model file not found: {}", new_model_path.display());
        }

        // Update config first so future load uses the new params.
        {
            let mut cfg = self.config.lock().await;
            cfg.selected_model = None; // explicit override
            cfg.model_path = new_model_path.display().to_string();
            if let Some(cs) = context_size {
                cfg.context_size = cs;
            }
            if let Some(t) = threads {
                cfg.threads = t;
            }
            if let Some(ngl) = n_gpu_layers {
                cfg.n_gpu_layers = ngl;
            }
            if let Some(mg) = main_gpu {
                cfg.main_gpu = mg;
            }
        }

        // Swap the model path used by the loader.
        {
            let mut mp = self.model_path.lock().await;
            *mp = new_model_path;
        }

        // Clear engine so it reloads on next request.
        {
            let mut eng = self.engine.lock().await;
            *eng = None;
        }

        info!("Local LLM hot-swap staged successfully (reload on next request)");
        Ok(())
    }

    /// Generate completion for a prompt
    ///
    /// **Phase 1**: Real inference with llama.cpp (when feature enabled)
    /// Lazy loads model on first call.
    pub async fn generate(&self, prompt: &str) -> Result<String> {
        debug!("Local LLM generating response for prompt: {}", prompt);

        let config = self.config.lock().await;
        let mut engine = self.engine.lock().await;

        // Lazy load model on first generation
        if engine.is_none() {
            let model_path = self.model_path.lock().await.clone();
            info!("Lazy loading model: {}", model_path.display());

            let resolved_context = config.resolve_context_size();
            let threads = config.threads;

            match RealInferenceEngine::load(
                &model_path,
                resolved_context,
                threads,
                config.n_gpu_layers,
                config.main_gpu,
                config.batch_size,
            ) {
                Ok(loaded_engine) => {
                    info!("Model loaded successfully");
                    *engine = Some(loaded_engine);
                }
                Err(e) => {
                    warn!("Failed to load model: {}. Using fallback.", e);
                    // Return error or fallback
                    anyhow::bail!("Model loading failed: {}", e);
                }
            }
        }

        // Generate with real engine
        let model_name = config.model_display_name();
        let max_tokens = config.max_tokens;
        let temperature = config.temperature;
        let adapter_path = self.current_adapter.lock().await.clone();
        let n_ctx = config.resolve_context_size();
        let prompt_cache_dir = config.prompt_cache_dir.clone();

        drop(config); // Release lock before potentially long inference

        if let Some(ref real_engine) = *engine {
            // Context window management: only do the expensive accurate token count if we might overflow.
            let est_tokens = (prompt.len() as u32) / 4;
            let prompt_to_use = if est_tokens.saturating_add(max_tokens) > n_ctx {
                // Accurate count + truncate from the left if needed (keep most recent suffix).
                let mut best = prompt;

                // Hard limit for prompt tokens.
                let max_prompt_tokens = n_ctx.saturating_sub(max_tokens);
                if max_prompt_tokens == 0 {
                    anyhow::bail!(
                        "Context too small: n_ctx={} max_tokens={}",
                        n_ctx,
                        max_tokens
                    );
                }

                // If full prompt already fits, use it.
                let full_tokens = real_engine.count_tokens(prompt).await?;
                if full_tokens <= max_prompt_tokens {
                    prompt
                } else {
                    // Binary search on a char boundary start index for the smallest prefix to drop.
                    // We search the start offset that makes the suffix fit.
                    let chars: Vec<usize> = prompt
                        .char_indices()
                        .map(|(i, _)| i)
                        .chain(std::iter::once(prompt.len()))
                        .collect();
                    let mut lo = 0usize;
                    let mut hi = chars.len().saturating_sub(1);
                    while lo <= hi {
                        let mid = (lo + hi) / 2;
                        let start = chars[mid];
                        let candidate = &prompt[start..];
                        let toks = real_engine.count_tokens(candidate).await?;
                        if toks <= max_prompt_tokens {
                            best = candidate;
                            // Try to drop less.
                            if mid == 0 {
                                break;
                            }
                            hi = mid.saturating_sub(1);
                        } else {
                            lo = mid + 1;
                        }
                    }
                    best
                }
            } else {
                prompt
            };

            // Stable prompt-cache keying to enable KV reuse as chat prompts grow.
            // We key on: model path + adapter path + prompt *prefix* (first 4096 bytes).
            let model_path_for_hash = self.model_path.lock().await.clone();
            let model_path_for_hash = model_path_for_hash.to_string_lossy().to_string();
            let prompt_cache = prompt_cache_dir.as_ref().map(|dir| {
                let _ = std::fs::create_dir_all(dir);
                let mut h = Sha256::new();
                h.update(model_path_for_hash.as_bytes());
                let prefix_len = prompt_to_use.len().min(4096);
                h.update(&prompt_to_use.as_bytes()[..prefix_len]);
                if let Some(ref ap) = adapter_path {
                    h.update(ap.to_string_lossy().as_bytes());
                }
                let digest = h.finalize();
                let name = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&digest[..12]);
                PathBuf::from(dir).join(format!("prompt-cache-{}.bin", name))
            });

            info!(
                "Generating with local inference engine (model={})",
                model_name
            );
            let result = real_engine
                .generate(
                    prompt_to_use,
                    max_tokens,
                    temperature,
                    0.95,
                    adapter_path,
                    prompt_cache,
                )
                .await?;
            Ok(result)
        } else {
            anyhow::bail!("Inference engine not initialized");
        }
    }

    /// Stream completion output as it is produced by llama.cpp (stdout chunks).
    pub async fn stream(
        &self,
        prompt: &str,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        let config = self.config.lock().await;
        let mut engine = self.engine.lock().await;

        if engine.is_none() {
            let model_path = self.model_path.lock().await.clone();
            info!("Lazy loading model for streaming: {}", model_path.display());
            let resolved_context = config.resolve_context_size();
            let threads = config.threads;
            let loaded_engine = RealInferenceEngine::load(
                &model_path,
                resolved_context,
                threads,
                config.n_gpu_layers,
                config.main_gpu,
                config.batch_size,
            )?;
            *engine = Some(loaded_engine);
        }

        let max_tokens = config.max_tokens;
        let temperature = config.temperature;
        let adapter_path = self.current_adapter.lock().await.clone();
        let n_ctx = config.resolve_context_size();
        let prompt_cache_dir = config.prompt_cache_dir.clone();
        drop(config);

        let real_engine = engine
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Inference engine not initialized"))?
            .clone();

        // Context window management (streaming): same policy as non-streaming.
        let est_tokens = (prompt.len() as u32) / 4;
        let prompt_to_use = if est_tokens.saturating_add(max_tokens) > n_ctx {
            let max_prompt_tokens = n_ctx.saturating_sub(max_tokens);
            if max_prompt_tokens == 0 {
                anyhow::bail!(
                    "Context too small: n_ctx={} max_tokens={}",
                    n_ctx,
                    max_tokens
                );
            }
            let full_tokens = real_engine.count_tokens(prompt).await?;
            if full_tokens <= max_prompt_tokens {
                prompt
            } else {
                let mut best = prompt;
                let chars: Vec<usize> = prompt
                    .char_indices()
                    .map(|(i, _)| i)
                    .chain(std::iter::once(prompt.len()))
                    .collect();
                let mut lo = 0usize;
                let mut hi = chars.len().saturating_sub(1);
                while lo <= hi {
                    let mid = (lo + hi) / 2;
                    let start = chars[mid];
                    let candidate = &prompt[start..];
                    let toks = real_engine.count_tokens(candidate).await?;
                    if toks <= max_prompt_tokens {
                        best = candidate;
                        if mid == 0 {
                            break;
                        }
                        hi = mid.saturating_sub(1);
                    } else {
                        lo = mid + 1;
                    }
                }
                best
            }
        } else {
            prompt
        };

        let model_path_for_hash = self.model_path.lock().await.clone();
        let model_path_for_hash = model_path_for_hash.to_string_lossy().to_string();
        let prompt_cache = prompt_cache_dir.as_ref().map(|dir| {
            let _ = std::fs::create_dir_all(dir);
            let mut h = Sha256::new();
            h.update(model_path_for_hash.as_bytes());
            let prefix_len = prompt_to_use.len().min(4096);
            h.update(&prompt_to_use.as_bytes()[..prefix_len]);
            if let Some(ref ap) = adapter_path {
                h.update(ap.to_string_lossy().as_bytes());
            }
            let digest = h.finalize();
            let name = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&digest[..12]);
            PathBuf::from(dir).join(format!("prompt-cache-{}.bin", name))
        });

        // Engine streaming is async; return its stream directly.
        real_engine
            .stream_generate(
                prompt_to_use,
                max_tokens,
                temperature,
                0.95,
                adapter_path,
                prompt_cache,
            )
            .await
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

/// Implement LLMProvider trait for reflection and planning agents
#[async_trait::async_trait]
impl LLMProvider for LocalLLMProvider {
    async fn generate(&self, prompt: &str) -> Result<String> {
        self.generate(prompt).await
    }

    fn name(&self) -> &str {
        "local-llm"
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
