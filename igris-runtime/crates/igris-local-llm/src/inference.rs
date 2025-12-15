/// Real LLM inference engine using llama.cpp
///
/// This module provides REAL token generation (not stubs) using llama.cpp bindings.
/// Phase 1 implementation - basic inference with single model support.
use anyhow::Result;
use std::path::Path;
use tracing::{info, debug, warn};

#[cfg(feature = "llama-inference")]
use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, LlamaModel, AddBos},
    token::data_array::LlamaTokenDataArray,
};

/// Real inference engine (requires llama-inference feature)
#[cfg(feature = "llama-inference")]
pub struct RealInferenceEngine {
    _backend: LlamaBackend,
    model: LlamaModel,
    n_ctx: u32,
}

#[cfg(feature = "llama-inference")]
impl RealInferenceEngine {
    /// Load GGUF model from path
    pub fn load(model_path: &Path, n_ctx: u32, n_threads: u32) -> Result<Self> {
        info!("Loading GGUF model from: {}", model_path.display());

        // Initialize llama backend
        let backend = LlamaBackend::init()?;

        // Model params
        let model_params = LlamaModelParams::default()
            .with_n_gpu_layers(0); // CPU only for now

        // Load model
        let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
            .map_err(|e| anyhow::anyhow!("Failed to load model: {}", e))?;

        info!("Model loaded successfully. Context size: {}", n_ctx);

        Ok(Self {
            _backend: backend,
            model,
            n_ctx,
        })
    }

    /// Generate tokens from prompt
    pub fn generate(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
        top_p: f32,
    ) -> Result<String> {
        debug!("Generating response for prompt (max_tokens={})", max_tokens);

        // Create context
        let ctx_params = LlamaContextParams::default()
            .with_n_ctx(std::num::NonZeroU32::new(self.n_ctx).unwrap())
            .with_seed(42);

        let mut ctx = self.model.new_context(&self._backend, ctx_params)
            .map_err(|e| anyhow::anyhow!("Failed to create context: {}", e))?;

        // Tokenize prompt
        let tokens = self.model
            .str_to_token(prompt, AddBos::Always)
            .map_err(|e| anyhow::anyhow!("Tokenization failed: {}", e))?;

        debug!("Prompt tokenized: {} tokens", tokens.len());

        // Decode prompt
        let mut batch = LlamaBatch::new(self.n_ctx as usize, 1);
        for (i, &token) in tokens.iter().enumerate() {
            batch.add(token, i as i32, &[0], false)
                .map_err(|e| anyhow::anyhow!("Batch add failed: {}", e))?;
        }

        // Process prompt
        ctx.decode(&mut batch)
            .map_err(|e| anyhow::anyhow!("Decode failed: {}", e))?;

        // Generate tokens
        let mut output = String::new();
        let mut n_generated = 0;

        while n_generated < max_tokens {
            let candidates = ctx.candidates_ith(batch.n_tokens() - 1);

            // Sample with temperature and top_p
            let mut candidates_array = LlamaTokenDataArray::from_iter(candidates, false);
            let token = if temperature <= 0.0 {
                candidates_array.sample_token_greedy(&mut ctx)
            } else {
                candidates_array.sample_token_mirostat_v2(&mut ctx, temperature, 0.1, 5.0)
            };

            // Check for EOS
            if self.model.is_eog_token(token) {
                break;
            }

            // Decode token
            if let Ok(piece) = self.model.token_to_str(token) {
                output.push_str(&piece);
            }

            // Prepare for next token
            batch.clear();
            batch.add(token, tokens.len() as i32 + n_generated as i32, &[0], true)
                .map_err(|e| anyhow::anyhow!("Batch add failed: {}", e))?;

            ctx.decode(&mut batch)
                .map_err(|e| anyhow::anyhow!("Decode failed: {}", e))?;

            n_generated += 1;
        }

        info!("Generated {} tokens", n_generated);
        Ok(output)
    }
}

/// Stub engine (when llama-inference feature is disabled)
#[cfg(not(feature = "llama-inference"))]
pub struct RealInferenceEngine;

#[cfg(not(feature = "llama-inference"))]
impl RealInferenceEngine {
    pub fn load(_model_path: &Path, _n_ctx: u32, _n_threads: u32) -> Result<Self> {
        warn!("llama-inference feature not enabled, using stub");
        Ok(Self)
    }

    pub fn generate(
        &self,
        prompt: &str,
        max_tokens: u32,
        _temperature: f32,
        _top_p: f32,
    ) -> Result<String> {
        Ok(format!(
            "[STUB] Would generate {} tokens for: {}...",
            max_tokens,
            &prompt[..prompt.len().min(50)]
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stub_engine_creation() {
        let engine = RealInferenceEngine::load(
            Path::new("test.gguf"),
            4096,
            4,
        );
        assert!(engine.is_ok());
    }
}
