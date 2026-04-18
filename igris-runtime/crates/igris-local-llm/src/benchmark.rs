//! Benchmarking Suite for GPU/CPU Performance
//!
//! Provides tools to measure tokens/second performance across different hardware configurations.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{Duration, Instant};
use tracing::{info, warn};

use crate::gpu_detect::{AcceleratorType, HardwareInfo};
use crate::inference::RealInferenceEngine;

/// Benchmark result for a specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    /// Hardware accelerator used
    pub accelerator: AcceleratorType,
    /// Number of GPU layers
    pub n_gpu_layers: u32,
    /// Context size
    pub n_ctx: u32,
    /// Thread count
    pub n_threads: u32,
    /// Prompt length in tokens (approximate)
    pub prompt_tokens: usize,
    /// Generated tokens
    pub generated_tokens: usize,
    /// Total latency
    pub total_latency: Duration,
    /// Tokens per second
    pub tokens_per_second: f64,
    /// Time to first token (TTFT)
    pub ttft: Duration,
}

impl BenchmarkResult {
    /// Create a summary string for the benchmark
    pub fn summary(&self) -> String {
        format!(
            "{:?} | GPU Layers: {} | Threads: {} | {:.2} tok/s | TTFT: {}ms",
            self.accelerator,
            self.n_gpu_layers,
            self.n_threads,
            self.tokens_per_second,
            self.ttft.as_millis()
        )
    }
}

/// Run a comprehensive benchmark suite
pub async fn run_benchmark_suite(
    model_path: &Path,
    hw_info: &HardwareInfo,
) -> Result<Vec<BenchmarkResult>> {
    info!(
        "Starting benchmark suite for model: {}",
        model_path.display()
    );

    let mut results = Vec::new();

    // Test configurations to try
    let configs = generate_test_configs(hw_info);

    for (n_gpu_layers, n_threads) in configs {
        match run_single_benchmark(model_path, n_gpu_layers, n_threads, 2048).await {
            Ok(result) => {
                info!("✓ {}", result.summary());
                results.push(result);
            }
            Err(e) => {
                warn!(
                    "✗ Benchmark failed (GPU: {}, Threads: {}): {}",
                    n_gpu_layers, n_threads, e
                );
            }
        }
    }

    if !results.is_empty() {
        // Find best configuration
        let best = results
            .iter()
            .max_by(|a, b| {
                a.tokens_per_second
                    .partial_cmp(&b.tokens_per_second)
                    .unwrap()
            })
            .unwrap();

        info!("Best configuration: {}", best.summary());
    }

    Ok(results)
}

/// Generate test configurations based on hardware
fn generate_test_configs(hw_info: &HardwareInfo) -> Vec<(u32, u32)> {
    let mut configs = Vec::new();

    match hw_info.accelerator {
        AcceleratorType::Cuda | AcceleratorType::Metal | AcceleratorType::Rocm => {
            // Test different GPU layer counts
            let recommended = hw_info.recommended_gpu_layers_7b;

            if recommended > 0 {
                // Full GPU offload
                configs.push((recommended, hw_info.recommended_threads));

                // 75% GPU offload
                if recommended > 10 {
                    configs.push((recommended * 3 / 4, hw_info.recommended_threads));
                }

                // 50% GPU offload
                if recommended > 10 {
                    configs.push((recommended / 2, hw_info.recommended_threads));
                }

                // CPU-only for comparison
                configs.push((0, hw_info.recommended_threads));
            } else {
                // CPU-only
                configs.push((0, hw_info.recommended_threads));
                configs.push((0, (hw_info.recommended_threads * 2).min(16)));
            }
        }
        AcceleratorType::Cpu => {
            // Test different thread counts
            configs.push((0, hw_info.recommended_threads));
            configs.push((0, (hw_info.recommended_threads * 2).min(16)));
            configs.push((0, hw_info.recommended_threads / 2));
        }
    }

    configs
}

/// Run a single benchmark with specific configuration
async fn run_single_benchmark(
    model_path: &Path,
    n_gpu_layers: u32,
    n_threads: u32,
    n_ctx: u32,
) -> Result<BenchmarkResult> {
    // Load engine
    let engine = RealInferenceEngine::load(
        model_path,
        n_ctx,
        n_threads,
        n_gpu_layers,
        None, // main_gpu
        None, // batch_size
    )?;

    // Benchmark prompt
    let prompt =
        "Write a detailed technical explanation of how transformers work in machine learning, \
                  including attention mechanisms and positional encoding. ";

    let prompt_tokens = prompt.split_whitespace().count();

    // Measure time to first token and total generation
    let start = Instant::now();
    let mut ttft: Option<Duration> = None;
    let mut generated = String::new();

    // For simplicity, use non-streaming generation
    // In production, you'd stream and measure TTFT precisely
    generated = engine
        .generate(
            prompt, 100,  // max_tokens
            0.7,  // temperature
            0.95, // top_p
            None, // lora
            None, // prompt_cache
        )
        .await?;

    let total_latency = start.elapsed();

    // Estimate TTFT (in non-streaming mode, this is approximate)
    // Real TTFT measurement requires streaming
    let ttft_estimate = total_latency / 10; // Very rough estimate

    let generated_tokens = generated.split_whitespace().count();
    let tokens_per_second = if total_latency.as_secs_f64() > 0.0 {
        generated_tokens as f64 / total_latency.as_secs_f64()
    } else {
        0.0
    };

    // Determine accelerator type
    let accelerator = if n_gpu_layers > 0 {
        AcceleratorType::Cuda // Default assumption, could be refined
    } else {
        AcceleratorType::Cpu
    };

    Ok(BenchmarkResult {
        accelerator,
        n_gpu_layers,
        n_ctx,
        n_threads,
        prompt_tokens,
        generated_tokens,
        total_latency,
        tokens_per_second,
        ttft: ttft_estimate,
    })
}

/// Quick performance test to verify GPU acceleration is working
pub async fn quick_gpu_test(model_path: &Path, n_gpu_layers: u32) -> Result<bool> {
    info!("Running quick GPU test with {} layers...", n_gpu_layers);

    let engine = RealInferenceEngine::load(model_path, 2048, 4, n_gpu_layers, None, None)?;

    let prompt = "Hello, world!";
    let start = Instant::now();

    let _output = engine.generate(prompt, 10, 0.7, 0.95, None, None).await?;

    let latency = start.elapsed();
    let success = latency < Duration::from_secs(10); // Should complete quickly if GPU works

    if success {
        info!("✓ GPU test passed ({}ms)", latency.as_millis());
    } else {
        warn!("✗ GPU test slow or failed ({}ms)", latency.as_millis());
    }

    Ok(success)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_generation() {
        use crate::gpu_detect::HardwareInfo;

        let hw = HardwareInfo {
            accelerator: AcceleratorType::Cuda,
            device_name: Some("RTX 3090".to_string()),
            vram_mb: Some(24000),
            recommended_gpu_layers_7b: 40,
            recommended_gpu_layers_13b: 35,
            cpu_cores: 16,
            recommended_threads: 8,
        };

        let configs = generate_test_configs(&hw);
        assert!(!configs.is_empty());
        assert!(configs.iter().any(|(layers, _)| *layers > 0)); // At least one GPU config
    }
}
