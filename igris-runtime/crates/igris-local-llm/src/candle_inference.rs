//! Pure Rust LLM inference using candle-rs
//!
//! This implementation uses candle (Hugging Face's ML framework in Rust) for local LLM inference.
//! Advantages over llama.cpp CLI:
//! - Pure Rust (no external processes)
//! - In-memory model (faster subsequent inferences)
//! - Better control over memory and GPU usage
//! - Native Rust error handling

use anyhow::{Context, Result};
use candle_core::{Device, Tensor, DType};
use candle_nn::VarBuilder;
use candle_transformers::models::quantized_llama as model;
use std::path::Path;
use std::sync::Arc;
use tokenizers::Tokenizer;
use tracing::{debug, info, warn};
use futures::Stream;
use async_stream::try_stream;
use std::pin::Pin;

/// Candle-based inference engine for GGUF models
pub struct CandleInferenceEngine {
    model: model::ModelWeights,
    tokenizer: Arc<Tokenizer>,
    device: Device,
    config: ModelConfig,
}

#[derive(Debug, Clone)]
pub struct ModelConfig {
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: usize,
    pub repeat_penalty: f32,
    pub repeat_last_n: usize,
    pub seed: u64,
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 50,
            repeat_penalty: 1.1,
            repeat_last_n: 64,
            seed: 299792458,
        }
    }
}

impl CandleInferenceEngine {
    /// Load a GGUF model from file
    pub fn load<P: AsRef<Path>>(
        model_path: P,
        tokenizer_path: Option<P>,
        config: ModelConfig,
    ) -> Result<Self> {
        let model_path = model_path.as_ref();
        info!("Loading GGUF model from: {}", model_path.display());

        // Detect best device (Metal for Apple Silicon, CUDA for NVIDIA, CPU fallback)
        let device = Self::detect_device()?;
        info!("Using device: {:?}", device);

        // Load tokenizer
        let tokenizer = Self::load_tokenizer(model_path, tokenizer_path.as_ref().map(|p| p.as_ref()))?;
        info!("Tokenizer loaded: {} vocab size", tokenizer.get_vocab_size(true));

        // Load GGUF model
        let mut file = std::fs::File::open(model_path)
            .with_context(|| format!("Failed to open model file: {}", model_path.display()))?;

        let model = model::ModelWeights::from_gguf(&mut file, &device)
            .context("Failed to load GGUF model")?;

        info!("✓ Model loaded successfully");

        Ok(Self {
            model,
            tokenizer: Arc::new(tokenizer),
            device,
            config,
        })
    }

    fn detect_device() -> Result<Device> {
        // Try Metal first (Apple Silicon)
        #[cfg(target_os = "macos")]
        {
            if let Ok(device) = Device::new_metal(0) {
                return Ok(device);
            }
        }

        // Try CUDA (NVIDIA GPUs)
        #[cfg(feature = "cuda")]
        {
            if let Ok(device) = Device::new_cuda(0) {
                return Ok(device);
            }
        }

        // Fallback to CPU
        Ok(Device::Cpu)
    }

    fn load_tokenizer(model_path: &Path, tokenizer_path: Option<&Path>) -> Result<Tokenizer> {
        // Try explicit tokenizer path first
        if let Some(tok_path) = tokenizer_path {
            if tok_path.exists() {
                return Tokenizer::from_file(tok_path)
                    .map_err(|e| anyhow::anyhow!("Failed to load tokenizer from {}: {}", tok_path.display(), e));
            }
        }

        // Try tokenizer.json in same directory as model
        if let Some(model_dir) = model_path.parent() {
            let tok_path = model_dir.join("tokenizer.json");
            if tok_path.exists() {
                info!("Found tokenizer at: {}", tok_path.display());
                return Tokenizer::from_file(&tok_path)
                    .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e));
            }
        }

        // Try tokenizer.json in current directory
        let tok_path = std::path::PathBuf::from("tokenizer.json");
        if tok_path.exists() {
            info!("Found tokenizer at: {}", tok_path.display());
            return Tokenizer::from_file(&tok_path)
                .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e));
        }

        // Download LLaMA tokenizer as fallback
        info!("No local tokenizer found, downloading LLaMA tokenizer...");
        let api = hf_hub::api::sync::Api::new()
            .map_err(|e| anyhow::anyhow!("Failed to create HF API: {}", e))?;

        let repo = api.model("hf-internal-testing/llama-tokenizer".to_string());
        let tokenizer_path = repo.get("tokenizer.json")
            .map_err(|e| anyhow::anyhow!("Failed to download tokenizer: {}", e))?;

        Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| anyhow::anyhow!("Failed to load downloaded tokenizer: {}", e))
    }

    /// Generate text from a prompt
    pub async fn generate(&mut self, prompt: &str, max_tokens: usize) -> Result<String> {
        debug!("Generating completion for prompt ({} chars)", prompt.len());

        // Tokenize input
        let tokens = self.tokenizer
            .encode(prompt, true)
            .map_err(|e| anyhow::anyhow!("Tokenization failed: {}", e))?;

        let input_tokens = tokens.get_ids();
        debug!("Input tokens: {}", input_tokens.len());

        // Convert to tensor
        let input_tensor = Tensor::new(input_tokens, &self.device)?
            .unsqueeze(0)?; // Add batch dimension

        // Generate tokens
        let mut generated_tokens = Vec::new();
        let mut logits_processor = LogitsProcessor::new(
            self.config.seed,
            Some(self.config.temperature),
            Some(self.config.top_p),
        );

        let mut next_token = None;
        let eos_token = self.get_eos_token();

        for token_idx in 0..max_tokens {
            // Prepare input (start + generated so far)
            let context_tokens: Vec<u32> = if token_idx == 0 {
                input_tokens.to_vec()
            } else {
                let mut ctx = input_tokens.to_vec();
                ctx.extend(&generated_tokens);
                ctx
            };

            let context_tensor = Tensor::new(context_tokens.as_slice(), &self.device)?
                .unsqueeze(0)?;

            // Forward pass
            let logits = self.model.forward(&context_tensor, context_tokens.len() - 1)?;

            // Sample next token
            next_token = Some(logits_processor.sample(&logits)?);

            // Check for EOS
            if next_token == Some(eos_token) {
                debug!("EOS token generated at position {}", token_idx);
                break;
            }

            generated_tokens.push(next_token.unwrap());

            // Progress logging
            if token_idx % 10 == 0 && token_idx > 0 {
                debug!("Generated {} / {} tokens", token_idx, max_tokens);
            }
        }

        // Decode tokens
        let output_text = self.tokenizer
            .decode(&generated_tokens, true)
            .map_err(|e| anyhow::anyhow!("Decoding failed: {}", e))?;

        debug!("Generated {} tokens", generated_tokens.len());
        Ok(output_text)
    }

    /// Stream generation token by token
    pub async fn stream_generate(
        &mut self,
        prompt: &str,
        max_tokens: usize,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<String>> + Send + '_>>> {
        debug!("Starting streaming generation");

        // Tokenize input
        let tokens = self.tokenizer
            .encode(prompt, true)
            .map_err(|e| anyhow::anyhow!("Tokenization failed: {}", e))?;

        let input_tokens = tokens.get_ids().to_vec();

        let stream = try_stream! {
            let mut generated_tokens = Vec::new();
            let mut logits_processor = LogitsProcessor::new(
                self.config.seed,
                Some(self.config.temperature),
                Some(self.config.top_p),
            );

            let eos_token = self.get_eos_token();

            for token_idx in 0..max_tokens {
                // Prepare context
                let mut context_tokens = input_tokens.clone();
                context_tokens.extend(&generated_tokens);

                let context_tensor = Tensor::new(context_tokens.as_slice(), &self.device)?
                    .unsqueeze(0)?;

                // Forward pass
                let logits = self.model.forward(&context_tensor, context_tokens.len() - 1)?;

                // Sample next token
                let next_token = logits_processor.sample(&logits)?;

                // Check for EOS
                if next_token == eos_token {
                    break;
                }

                generated_tokens.push(next_token);

                // Decode just this token and yield it
                let token_text = self.tokenizer
                    .decode(&[next_token], false)
                    .map_err(|e| anyhow::anyhow!("Decoding failed: {}", e))?;

                yield token_text;
            }
        };

        Ok(Box::pin(stream))
    }

    fn get_eos_token(&self) -> u32 {
        // Try to get EOS token from tokenizer
        if let Some(eos) = self.tokenizer.token_to_id("</s>") {
            return eos;
        }
        if let Some(eos) = self.tokenizer.token_to_id("<|endoftext|>") {
            return eos;
        }
        // Default EOS token ID for LLaMA
        2
    }

    /// Get model information
    pub fn model_info(&self) -> ModelInfo {
        ModelInfo {
            vocab_size: self.tokenizer.get_vocab_size(true),
            device: format!("{:?}", self.device),
        }
    }
}

#[derive(Debug)]
pub struct ModelInfo {
    pub vocab_size: usize,
    pub device: String,
}

/// Logits processor for sampling
struct LogitsProcessor {
    rng: rand::rngs::StdRng,
    temperature: Option<f64>,
    top_p: Option<f64>,
}

impl LogitsProcessor {
    fn new(seed: u64, temperature: Option<f64>, top_p: Option<f64>) -> Self {
        use rand::SeedableRng;
        Self {
            rng: rand::rngs::StdRng::seed_from_u64(seed),
            temperature,
            top_p,
        }
    }

    fn sample(&mut self, logits: &Tensor) -> Result<u32> {
        let logits = logits.to_vec1::<f32>()?;
        let next_token = self.sample_argmax(&logits)?;
        Ok(next_token)
    }

    fn sample_argmax(&mut self, logits: &[f32]) -> Result<u32> {
        // Apply temperature
        let logits = if let Some(temp) = self.temperature {
            logits.iter().map(|&l| l / temp as f32).collect::<Vec<_>>()
        } else {
            logits.to_vec()
        };

        // Find argmax
        let mut max_idx = 0;
        let mut max_val = logits[0];
        for (idx, &val) in logits.iter().enumerate().skip(1) {
            if val > max_val {
                max_val = val;
                max_idx = idx;
            }
        }

        Ok(max_idx as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_config_defaults() {
        let config = ModelConfig::default();
        assert_eq!(config.temperature, 0.7);
        assert_eq!(config.top_p, 0.9);
    }

    #[test]
    fn test_device_detection() {
        let device = CandleInferenceEngine::detect_device();
        assert!(device.is_ok());
    }
}
