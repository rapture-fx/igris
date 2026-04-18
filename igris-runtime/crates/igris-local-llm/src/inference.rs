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
use std::sync::Arc;
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

fn derive_llama_tokenize_path(llama_cli_path: &Path) -> Option<PathBuf> {
    let bin_dir = llama_cli_path.parent()?;
    let p = bin_dir.join("llama-tokenize");
    if p.exists() {
        Some(p)
    } else {
        None
    }
}

#[derive(Debug, Clone, Copy)]
enum GpuLayersFlag {
    Ngl,
    NGpuLayers,
}

#[derive(Debug, Clone)]
struct LlamaCliCapabilities {
    gpu_layers_flag: Option<GpuLayersFlag>,
    supports_main_gpu: bool,
    supports_lora: bool,
    supports_prompt_cache: bool,
    supports_prompt_cache_all: bool,
    supports_batch_size: bool,
}

fn detect_llama_cli_capabilities(llama_cli_path: &Path) -> Result<LlamaCliCapabilities> {
    // We try `--help` then `-h` to stay compatible across llama.cpp versions.
    let help = std::process::Command::new(llama_cli_path)
        .arg("--help")
        .output()
        .or_else(|_| {
            std::process::Command::new(llama_cli_path)
                .arg("-h")
                .output()
        })
        .map_err(|e| {
            anyhow::anyhow!(
                "Failed to execute {} to detect capabilities: {}",
                llama_cli_path.display(),
                e
            )
        })?;

    let mut text = String::new();
    text.push_str(&String::from_utf8_lossy(&help.stdout));
    text.push_str(&String::from_utf8_lossy(&help.stderr));

    // Very conservative string matching.
    let gpu_layers_flag = if text.contains(" -ngl") || text.contains("\n-ngl") {
        Some(GpuLayersFlag::Ngl)
    } else if text.contains("--n-gpu-layers") {
        Some(GpuLayersFlag::NGpuLayers)
    } else {
        None
    };

    let supports_main_gpu = text.contains("--main-gpu");
    let supports_lora = text.contains("--lora");
    let supports_prompt_cache = text.contains("--prompt-cache");
    let supports_prompt_cache_all = text.contains("--prompt-cache-all");
    let supports_batch_size = text.contains("--batch-size");

    Ok(LlamaCliCapabilities {
        gpu_layers_flag,
        supports_main_gpu,
        supports_lora,
        supports_prompt_cache,
        supports_prompt_cache_all,
        supports_batch_size,
    })
}

/// Real inference engine backed by llama.cpp's `llama-cli` executable.
#[derive(Debug, Clone)]
pub struct RealInferenceEngine {
    llama_cli_path: PathBuf,
    llama_tokenize_path: Option<PathBuf>,
    model_path: PathBuf,
    n_ctx: u32,
    n_threads: u32,
    n_gpu_layers: u32,
    main_gpu: Option<u32>,
    batch_size: Option<u32>,
    caps: Arc<LlamaCliCapabilities>,
}

impl RealInferenceEngine {
    /// Load GGUF model from path.
    ///
    /// This validates the model exists and that the llama.cpp CLI is present.
    pub fn load(
        model_path: &Path,
        n_ctx: u32,
        n_threads: u32,
        n_gpu_layers: u32,
        main_gpu: Option<u32>,
        batch_size: Option<u32>,
    ) -> Result<Self> {
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

        let caps = detect_llama_cli_capabilities(&llama_cli_path)?;
        let llama_tokenize_path = derive_llama_tokenize_path(&llama_cli_path);
        if (n_gpu_layers > 0 || main_gpu.is_some()) && caps.gpu_layers_flag.is_none() {
            anyhow::bail!(
                "GPU offload requested (n_gpu_layers={}, main_gpu={:?}) but {} does not advertise GPU flags. \
                 Rebuild/upgrade llama.cpp or set n_gpu_layers=0.",
                n_gpu_layers,
                main_gpu,
                llama_cli_path.display()
            );
        }
        if main_gpu.is_some() && !caps.supports_main_gpu {
            anyhow::bail!(
                "main_gpu was set but {} does not advertise --main-gpu support. \
                 Rebuild/upgrade llama.cpp or unset main_gpu.",
                llama_cli_path.display()
            );
        }

        info!(
            "Local inference ready: cli={}, model={}, ctx={}, threads={}, n_gpu_layers={}, main_gpu={:?}",
            llama_cli_path.display(),
            model_path.display(),
            n_ctx,
            n_threads,
            n_gpu_layers,
            main_gpu
        );

        Ok(Self {
            llama_cli_path,
            llama_tokenize_path,
            model_path: model_path.to_path_buf(),
            n_ctx,
            n_threads,
            n_gpu_layers,
            main_gpu,
            batch_size,
            caps: Arc::new(caps),
        })
    }

    fn apply_optional_gpu_args(&self, cmd: &mut Command) {
        if self.n_gpu_layers > 0 {
            match self.caps.gpu_layers_flag {
                Some(GpuLayersFlag::Ngl) => {
                    cmd.arg("-ngl").arg(self.n_gpu_layers.to_string());
                }
                Some(GpuLayersFlag::NGpuLayers) => {
                    cmd.arg("--n-gpu-layers").arg(self.n_gpu_layers.to_string());
                }
                None => {
                    // Should have been validated in load(); keep silent here.
                }
            }
        }

        if let Some(main_gpu) = self.main_gpu {
            if self.caps.supports_main_gpu {
                cmd.arg("--main-gpu").arg(main_gpu.to_string());
            }
        }
    }

    fn apply_optional_lora_args(
        &self,
        cmd: &mut Command,
        lora_adapter: Option<&Path>,
    ) -> Result<()> {
        if let Some(adapter) = lora_adapter {
            if !adapter.exists() {
                anyhow::bail!("LoRA adapter not found: {}", adapter.display());
            }
            if !self.caps.supports_lora {
                anyhow::bail!(
                    "LoRA adapter requested but {} does not advertise --lora support. Rebuild/upgrade llama.cpp.",
                    self.llama_cli_path.display()
                );
            }
            cmd.arg("--lora").arg(adapter);
        }
        Ok(())
    }

    fn apply_optional_prompt_cache_args(
        &self,
        cmd: &mut Command,
        prompt_cache: Option<&Path>,
    ) -> Result<()> {
        if let Some(cache_path) = prompt_cache {
            if !self.caps.supports_prompt_cache {
                anyhow::bail!(
                    "Prompt cache requested but {} does not advertise --prompt-cache support. Rebuild/upgrade llama.cpp.",
                    self.llama_cli_path.display()
                );
            }
            cmd.arg("--prompt-cache").arg(cache_path);
            if self.caps.supports_prompt_cache_all {
                cmd.arg("--prompt-cache-all");
            }
        }
        Ok(())
    }

    fn apply_optional_batch_args(&self, cmd: &mut Command) -> Result<()> {
        if let Some(bs) = self.batch_size {
            if !self.caps.supports_batch_size {
                anyhow::bail!(
                    "batch_size was set ({}), but {} does not advertise --batch-size support. Rebuild/upgrade llama.cpp or unset batch_size.",
                    bs,
                    self.llama_cli_path.display()
                );
            }
            cmd.arg("--batch-size").arg(bs.to_string());
        }
        Ok(())
    }

    /// Count tokens in `text` for the currently configured model using llama.cpp's `llama-tokenize`.
    ///
    /// This is used for context window management. If `llama-tokenize` isn't available, this returns an error
    /// (we avoid fake/guessed counts for safety when enforcing limits).
    pub async fn count_tokens(&self, text: &str) -> Result<u32> {
        let tokenize = self
            .llama_tokenize_path
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!(
                "llama-tokenize not found next to {}. Build llama.cpp tools to enable accurate token counting.",
                self.llama_cli_path.display()
            ))?;

        // Try a small set of flag combinations for compatibility across llama.cpp versions.
        let attempts: &[&[&str]] = &[
            &["-m", self.model_path.to_str().unwrap_or_default(), "-p"],
            &[
                "-m",
                self.model_path.to_str().unwrap_or_default(),
                "--prompt",
            ],
            &[
                "--model",
                self.model_path.to_str().unwrap_or_default(),
                "-p",
            ],
        ];

        let mut last_err: Option<anyhow::Error> = None;

        for prefix in attempts {
            let mut cmd = Command::new(tokenize);
            for a in *prefix {
                cmd.arg(a);
            }
            cmd.arg(text);
            cmd.stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let out = cmd.output().await;
            match out {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    // Prefer counting integer token ids if present.
                    let mut int_count: u32 = 0;
                    for w in stdout.split_whitespace() {
                        if w.parse::<i64>().is_ok() {
                            int_count += 1;
                        }
                    }
                    if int_count > 0 {
                        return Ok(int_count);
                    }

                    // Fallback: count non-empty whitespace-delimited fields.
                    let fields = stdout.split_whitespace().count() as u32;
                    if fields > 0 {
                        return Ok(fields);
                    }

                    // If stdout is empty, treat as 0 tokens.
                    return Ok(0);
                }
                Ok(output) => {
                    let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    last_err = Some(anyhow::anyhow!(
                        "llama-tokenize failed ({}): {}",
                        output.status,
                        err
                    ));
                }
                Err(e) => last_err = Some(anyhow::anyhow!("Failed to run llama-tokenize: {}", e)),
            }
        }

        Err(last_err.unwrap_or_else(|| anyhow::anyhow!("llama-tokenize failed with unknown error")))
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
        lora_adapter: Option<PathBuf>,
        prompt_cache: Option<PathBuf>,
    ) -> Result<String> {
        debug!(
            "Invoking llama-cli (max_tokens={}, temp={}, top_p={})",
            max_tokens, temperature, top_p
        );

        let mut cmd = Command::new(&self.llama_cli_path);
        cmd
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
            .stderr(Stdio::piped());

        self.apply_optional_gpu_args(&mut cmd);
        self.apply_optional_lora_args(&mut cmd, lora_adapter.as_deref())?;
        self.apply_optional_prompt_cache_args(&mut cmd, prompt_cache.as_deref())?;
        self.apply_optional_batch_args(&mut cmd)?;

        let mut child = cmd
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
        lora_adapter: Option<PathBuf>,
        prompt_cache: Option<PathBuf>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
        let prompt_owned = prompt.to_string();

        let mut cmd = Command::new(&self.llama_cli_path);
        cmd.arg("-m")
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
            .stderr(Stdio::piped());

        self.apply_optional_gpu_args(&mut cmd);
        self.apply_optional_lora_args(&mut cmd, lora_adapter.as_deref())?;
        self.apply_optional_prompt_cache_args(&mut cmd, prompt_cache.as_deref())?;
        self.apply_optional_batch_args(&mut cmd)?;

        let mut child = cmd
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
        let engine =
            RealInferenceEngine::load(Path::new("does-not-exist.gguf"), 4096, 4, 0, None, None);
        assert!(engine.is_err());
    }
}
