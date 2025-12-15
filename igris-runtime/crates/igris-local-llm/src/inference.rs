//! Real LLM inference engine using llama.cpp **CLI** (no stubs).
//!
//! Why CLI?
//! - Keeps the Rust binary small (helps meet the < 18MB requirement).
//! - Avoids hard-binding to llama.cpp headers / ABI from Rust.
//! - Reuses the `igris-runtime/llama.cpp` submodule (built separately).
//!
//! Production note: This executes an external process. For high-throughput production,
//! migrate to in-process FFI bindings with a long-lived context pool.
use anyhow::Result;
use async_stream::try_stream;
use futures::Stream;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::process::Stdio;
use tokio::io::{AsyncReadExt, BufReader};
use tokio::process::Command;
use tracing::{debug, info};

/// Default path where llama.cpp builds its binaries.
///
/// Users should run:
/// `git submodule update --init --recursive`
/// then build llama.cpp:
/// `cmake -S llama.cpp -B llama.cpp/build && cmake --build llama.cpp/build -j`
fn default_llama_cli_path() -> PathBuf {
    PathBuf::from("llama.cpp/build/bin/llama-cli")
}

/// Real inference engine backed by llama.cpp's `llama-cli` executable.
#[derive(Debug, Clone)]
pub struct RealInferenceEngine {
    llama_cli_path: PathBuf,
    model_path: PathBuf,
    n_ctx: u32,
    n_threads: u32,
}

impl RealInferenceEngine {
    /// Load GGUF model from path.
    ///
    /// This validates the model exists and that the llama.cpp CLI is present.
    pub fn load(model_path: &Path, n_ctx: u32, n_threads: u32) -> Result<Self> {
        if !model_path.exists() {
            anyhow::bail!("GGUF model file not found: {}", model_path.display());
        }

        let llama_cli_path = default_llama_cli_path();
        if !llama_cli_path.exists() {
            anyhow::bail!(
                "llama.cpp CLI not found at {}. Initialize/build the submodule first:\n\
                 - git submodule update --init --recursive\n\
                 - cmake -S llama.cpp -B llama.cpp/build && cmake --build llama.cpp/build -j\n\
                 (Expected binary: llama.cpp/build/bin/llama-cli)",
                llama_cli_path.display()
            );
        }

        info!(
            "Local inference ready: cli={}, model={}, ctx={}, threads={}",
            llama_cli_path.display(),
            model_path.display(),
            n_ctx,
            n_threads
        );

        Ok(Self {
            llama_cli_path,
            model_path: model_path.to_path_buf(),
            n_ctx,
            n_threads,
        })
    }

    /// Generate completion text from a prompt.
    ///
    /// This runs `llama-cli` and returns the model's output as a string.
    pub async fn generate(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
        top_p: f32,
    ) -> Result<String> {
        debug!(
            "Invoking llama-cli (max_tokens={}, temp={}, top_p={})",
            max_tokens, temperature, top_p
        );

        let mut child = Command::new(&self.llama_cli_path)
            // Common llama.cpp CLI flags (supported by `main` historically and `llama-cli`).
            .arg("-m")
            .arg(&self.model_path)
            .arg("-t")
            .arg(self.n_threads.to_string())
            .arg("-c")
            .arg(self.n_ctx.to_string())
            .arg("-n")
            .arg(max_tokens.to_string())
            .arg("--temp")
            .arg(temperature.to_string())
            .arg("--top-p")
            .arg(top_p.to_string())
            // Prompt
            .arg("-p")
            .arg(prompt)
            // Reduce noise if supported; harmless if unsupported? (some versions error).
            // We avoid passing experimental flags to stay compatible across llama.cpp versions.
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn llama-cli: {}", e))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow::anyhow!("Failed to capture llama-cli stdout"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow::anyhow!("Failed to capture llama-cli stderr"))?;

        let mut stdout_reader = BufReader::new(stdout);
        let mut stderr_reader = BufReader::new(stderr);

        // Read both streams fully; for streaming, use `stream_generate`.
        let mut out_buf = Vec::new();
        let mut err_buf = Vec::new();
        let (out_res, err_res, status_res) = tokio::join!(
            stdout_reader.read_to_end(&mut out_buf),
            stderr_reader.read_to_end(&mut err_buf),
            child.wait()
        );
        out_res?;
        err_res?;
        let status = status_res?;

        if !status.success() {
            let err = String::from_utf8_lossy(&err_buf);
            anyhow::bail!("llama-cli exited with {}: {}", status, err.trim());
        }

        let raw_out = String::from_utf8_lossy(&out_buf).to_string();
        let raw_err = String::from_utf8_lossy(&err_buf).to_string();
        if !raw_err.trim().is_empty() {
            debug!("llama-cli stderr: {}", raw_err.trim());
        }

        Ok(Self::extract_model_text(prompt, &raw_out))
    }

    /// Stream generation output as it is produced by `llama-cli`.
    ///
    /// This is **real streaming** (stdout chunks), not post-hoc splitting.
    pub async fn stream_generate(
        &self,
        prompt: &str,
        max_tokens: u32,
        temperature: f32,
        top_p: f32,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        let prompt_owned = prompt.to_string();

        let mut child = Command::new(&self.llama_cli_path)
            .arg("-m")
            .arg(&self.model_path)
            .arg("-t")
            .arg(self.n_threads.to_string())
            .arg("-c")
            .arg(self.n_ctx.to_string())
            .arg("-n")
            .arg(max_tokens.to_string())
            .arg("--temp")
            .arg(temperature.to_string())
            .arg("--top-p")
            .arg(top_p.to_string())
            .arg("-p")
            .arg(&prompt_owned)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn llama-cli: {}", e))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow::anyhow!("Failed to capture llama-cli stdout"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow::anyhow!("Failed to capture llama-cli stderr"))?;

        let mut stdout_reader = BufReader::new(stdout);
        let mut stderr_reader = BufReader::new(stderr);

        // Stream stdout in chunks while collecting stderr.
        let s = try_stream! {
            let mut buf = vec![0u8; 16 * 1024];
            let mut is_first_chunk = true;

            loop {
                let n = stdout_reader.read(&mut buf).await?;
                if n == 0 {
                    break;
                }
                let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                let chunk = if is_first_chunk {
                    is_first_chunk = false;
                    // Best-effort: remove prompt echo only from the first chunk.
                    RealInferenceEngine::extract_model_text(&prompt_owned, &chunk)
                } else {
                    chunk
                };
                if !chunk.is_empty() {
                    yield chunk;
                }
            }

            // Read stderr fully at the end (keep memory bounded; stderr should be small).
            let mut err_buf = Vec::new();
            stderr_reader.read_to_end(&mut err_buf).await?;

            let status = child.wait().await?;
            if !status.success() {
                let err = String::from_utf8_lossy(&err_buf);
                Err(anyhow::anyhow!("llama-cli exited with {}: {}", status, err.trim()))?;
            }
        };

        Ok(Box::pin(s))
    }

    /// Best-effort extraction of model text from llama.cpp CLI output.
    ///
    /// Different llama.cpp versions may echo the prompt or print headers. We:
    /// - remove a leading exact prompt echo if present
    /// - trim whitespace
    fn extract_model_text(prompt: &str, stdout: &str) -> String {
        let mut s = stdout.to_string();
        if s.starts_with(prompt) {
            s = s[prompt.len()..].to_string();
        }
        s.trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_model_text_removes_prompt_echo() {
        let prompt = "Hello";
        let stdout = "Hello world!\n";
        let extracted = RealInferenceEngine::extract_model_text(prompt, stdout);
        assert_eq!(extracted, "world!");
    }

    #[test]
    fn load_fails_if_model_missing() {
        let engine = RealInferenceEngine::load(Path::new("does-not-exist.gguf"), 4096, 4);
        assert!(engine.is_err());
    }
}
