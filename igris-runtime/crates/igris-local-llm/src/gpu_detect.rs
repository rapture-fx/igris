//! GPU and Hardware Detection Module
//!
//! Auto-detects available GPU hardware and recommends optimal configuration for llama.cpp.
//! Supports CUDA (NVIDIA), Metal (Apple Silicon), ROCm (AMD), and CPU fallback.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::{debug, info, warn};

/// Detected hardware accelerator type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AcceleratorType {
    /// NVIDIA GPU with CUDA
    Cuda,
    /// Apple Silicon with Metal
    Metal,
    /// AMD GPU with ROCm
    Rocm,
    /// CPU-only (no GPU)
    Cpu,
}

/// Hardware detection result with optimization recommendations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    /// Detected accelerator type
    pub accelerator: AcceleratorType,
    /// GPU device name (if available)
    pub device_name: Option<String>,
    /// Total VRAM in MB (if detectable)
    pub vram_mb: Option<u64>,
    /// Recommended number of GPU layers for 7B model
    pub recommended_gpu_layers_7b: u32,
    /// Recommended number of GPU layers for 13B model
    pub recommended_gpu_layers_13b: u32,
    /// Number of physical CPU cores
    pub cpu_cores: usize,
    /// Recommended thread count
    pub recommended_threads: u32,
}

impl HardwareInfo {
    /// Get recommended GPU layers for a given model size (in billions of parameters)
    pub fn recommended_gpu_layers(&self, model_size_b: f32) -> u32 {
        if model_size_b <= 7.0 {
            self.recommended_gpu_layers_7b
        } else if model_size_b <= 13.0 {
            self.recommended_gpu_layers_13b
        } else {
            // For larger models, scale conservatively
            (self.recommended_gpu_layers_13b as f32 * 0.8) as u32
        }
    }
}

/// Detect available hardware and return optimization recommendations
pub fn detect_hardware() -> Result<HardwareInfo> {
    info!("Detecting hardware accelerators...");

    // Try CUDA detection first (NVIDIA)
    if let Ok(cuda_info) = detect_cuda() {
        return Ok(cuda_info);
    }

    // Try Metal detection (Apple Silicon)
    if let Ok(metal_info) = detect_metal() {
        return Ok(metal_info);
    }

    // Try ROCm detection (AMD)
    if let Ok(rocm_info) = detect_rocm() {
        return Ok(rocm_info);
    }

    // Fall back to CPU-only
    warn!("No GPU detected, falling back to CPU-only mode");
    Ok(detect_cpu_only())
}

/// Detect NVIDIA CUDA GPU
fn detect_cuda() -> Result<HardwareInfo> {
    // Try nvidia-smi command
    let output = Command::new("nvidia-smi")
        .arg("--query-gpu=name,memory.total")
        .arg("--format=csv,noheader")
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = stdout.trim().split(',').collect();

            if parts.len() >= 2 {
                let device_name = parts[0].trim().to_string();
                let vram_str = parts[1].trim().replace(" MiB", "");
                let vram_mb = vram_str.parse::<u64>().ok();

                let (layers_7b, layers_13b) = estimate_gpu_layers_cuda(vram_mb);

                info!(
                    "Detected CUDA GPU: {} ({} MB VRAM)",
                    device_name,
                    vram_mb.unwrap_or(0)
                );

                return Ok(HardwareInfo {
                    accelerator: AcceleratorType::Cuda,
                    device_name: Some(device_name),
                    vram_mb,
                    recommended_gpu_layers_7b: layers_7b,
                    recommended_gpu_layers_13b: layers_13b,
                    cpu_cores: num_cpus::get(),
                    recommended_threads: (num_cpus::get() / 2).max(4) as u32,
                });
            }
        }
    }

    anyhow::bail!("CUDA not detected")
}

/// Detect Apple Metal GPU
fn detect_metal() -> Result<HardwareInfo> {
    // Check if we're on macOS
    #[cfg(target_os = "macos")]
    {
        // Try system_profiler to get GPU info
        let output = Command::new("system_profiler")
            .arg("SPDisplaysDataType")
            .output();

        if let Ok(output) = output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);

                // Look for Metal support indicators
                if stdout.contains("Metal") || stdout.contains("Apple") {
                    // Try to extract chipset info
                    let device_name = if stdout.contains("M1") {
                        "Apple M1"
                    } else if stdout.contains("M2") {
                        "Apple M2"
                    } else if stdout.contains("M3") {
                        "Apple M3"
                    } else {
                        "Apple Silicon"
                    }
                    .to_string();

                    // Apple Silicon has unified memory
                    // Estimate based on chip generation
                    let (vram_mb, layers_7b, layers_13b) = if device_name.contains("M1") {
                        (8192, 32, 20) // M1 8GB base
                    } else if device_name.contains("M2") {
                        (16384, 40, 28) // M2 typically 16GB
                    } else if device_name.contains("M3") {
                        (16384, 40, 30) // M3 typically 16GB+
                    } else {
                        (8192, 30, 18) // Conservative default
                    };

                    info!(
                        "Detected Metal GPU: {} (~{} MB unified memory)",
                        device_name, vram_mb
                    );

                    return Ok(HardwareInfo {
                        accelerator: AcceleratorType::Metal,
                        device_name: Some(device_name),
                        vram_mb: Some(vram_mb),
                        recommended_gpu_layers_7b: layers_7b,
                        recommended_gpu_layers_13b: layers_13b,
                        cpu_cores: num_cpus::get(),
                        recommended_threads: (num_cpus::get() / 2).max(4) as u32,
                    });
                }
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Not on macOS, Metal not available
    }

    anyhow::bail!("Metal not detected")
}

/// Detect AMD ROCm GPU
fn detect_rocm() -> Result<HardwareInfo> {
    // Try rocm-smi command
    let output = Command::new("rocm-smi").arg("--showproductname").output();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);

            if !stdout.is_empty() {
                let device_name = stdout
                    .lines()
                    .find(|line| !line.contains("GPU"))
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| "AMD GPU".to_string());

                // ROCm detection is basic - assume 8GB VRAM conservatively
                let vram_mb = Some(8192);
                let layers_7b = 30;
                let layers_13b = 18;

                info!("Detected ROCm GPU: {}", device_name);

                return Ok(HardwareInfo {
                    accelerator: AcceleratorType::Rocm,
                    device_name: Some(device_name),
                    vram_mb,
                    recommended_gpu_layers_7b: layers_7b,
                    recommended_gpu_layers_13b: layers_13b,
                    cpu_cores: num_cpus::get(),
                    recommended_threads: (num_cpus::get() / 2).max(4) as u32,
                });
            }
        }
    }

    anyhow::bail!("ROCm not detected")
}

/// CPU-only fallback configuration
fn detect_cpu_only() -> HardwareInfo {
    let cpu_cores = num_cpus::get();
    let recommended_threads = (cpu_cores / 2).max(4);

    info!(
        "CPU-only mode: {} cores, {} threads recommended",
        cpu_cores, recommended_threads
    );

    HardwareInfo {
        accelerator: AcceleratorType::Cpu,
        device_name: None,
        vram_mb: None,
        recommended_gpu_layers_7b: 0,
        recommended_gpu_layers_13b: 0,
        cpu_cores,
        recommended_threads: recommended_threads as u32,
    }
}

/// Estimate optimal GPU layers for CUDA based on VRAM
fn estimate_gpu_layers_cuda(vram_mb: Option<u64>) -> (u32, u32) {
    match vram_mb {
        Some(vram) if vram >= 24000 => (99, 99), // 24GB+ = full offload
        Some(vram) if vram >= 16000 => (40, 35), // 16GB = most layers
        Some(vram) if vram >= 12000 => (35, 28), // 12GB = good offload
        Some(vram) if vram >= 8000 => (30, 20),  // 8GB = partial offload
        Some(vram) if vram >= 6000 => (25, 15),  // 6GB = limited offload
        Some(vram) if vram >= 4000 => (20, 10),  // 4GB = minimal offload
        _ => (0, 0),                             // Unknown or <4GB = CPU only
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hardware_detection() {
        // This will detect whatever hardware is available on the test machine
        let result = detect_hardware();
        assert!(result.is_ok());

        let info = result.unwrap();
        println!("Detected: {:?}", info);

        // Basic sanity checks
        assert!(info.cpu_cores > 0);
        assert!(info.recommended_threads > 0);
    }

    #[test]
    fn test_gpu_layers_estimation() {
        let info = HardwareInfo {
            accelerator: AcceleratorType::Cuda,
            device_name: Some("Test GPU".to_string()),
            vram_mb: Some(16000),
            recommended_gpu_layers_7b: 40,
            recommended_gpu_layers_13b: 35,
            cpu_cores: 8,
            recommended_threads: 4,
        };

        assert_eq!(info.recommended_gpu_layers(7.0), 40);
        assert_eq!(info.recommended_gpu_layers(13.0), 35);
        assert_eq!(info.recommended_gpu_layers(70.0), 28); // Scaled down
    }
}
