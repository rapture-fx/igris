//! Embedded llama.cpp Binaries for Hassle-Free QLoRA Training
//!
//! This module provides automatic extraction and management of embedded llama-finetune binaries
//! for different platforms, eliminating the need for manual llama.cpp compilation.
//!
//! # Platform Support
//! - macOS (Apple Silicon): arm64
//! - macOS (Intel): x86_64
//! - Linux: x86_64, aarch64
//! - Windows: x86_64
//!
//! # Usage
//! ```no_run
//! use igris_lora_trainer::embedded_bins::get_finetune_binary;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     // Automatically extracts and returns path to llama-finetune binary
//!     let binary_path = get_finetune_binary().await?;
//!     println!("Using llama-finetune at: {}", binary_path.display());
//!     Ok(())
//! }
//! ```

use anyhow::{Context, Result};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// Platform-specific binary data
#[derive(Debug)]
struct PlatformBinary {
    name: &'static str,
    data: Option<&'static [u8]>,
}

/// Detect current platform
fn detect_platform() -> Result<&'static str> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    match (os, arch) {
        ("macos", "aarch64") => Ok("macos-arm64"),
        ("macos", "x86_64") => Ok("macos-x86_64"),
        ("linux", "x86_64") => Ok("linux-x86_64"),
        ("linux", "aarch64") => Ok("linux-aarch64"),
        ("windows", "x86_64") => Ok("windows-x86_64"),
        _ => anyhow::bail!("Unsupported platform: {}-{}", os, arch),
    }
}

/// Get embedded binary data for current platform
fn get_embedded_binary() -> Result<PlatformBinary> {
    let platform = detect_platform()?;

    // Embedded binaries are included at compile time using include_bytes!
    // To embed binaries, place them in: crates/igris-lora-trainer/binaries/<platform>/llama-finetune
    //
    // Example directory structure:
    // binaries/
    //   macos-arm64/llama-finetune
    //   macos-x86_64/llama-finetune
    //   linux-x86_64/llama-finetune
    //   linux-aarch64/llama-finetune
    //   windows-x86_64/llama-finetune.exe

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let data = {
        #[cfg(feature = "embed-binaries")]
        {
            Some(include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/binaries/macos-arm64/llama-finetune"
            )) as &[u8])
        }
        #[cfg(not(feature = "embed-binaries"))]
        None
    };

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let data = {
        #[cfg(feature = "embed-binaries")]
        {
            Some(include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/binaries/macos-x86_64/llama-finetune"
            )) as &[u8])
        }
        #[cfg(not(feature = "embed-binaries"))]
        None
    };

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    let data = {
        #[cfg(feature = "embed-binaries")]
        {
            Some(include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/binaries/linux-x86_64/llama-finetune"
            )) as &[u8])
        }
        #[cfg(not(feature = "embed-binaries"))]
        None
    };

    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    let data = {
        #[cfg(feature = "embed-binaries")]
        {
            Some(include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/binaries/linux-aarch64/llama-finetune"
            )) as &[u8])
        }
        #[cfg(not(feature = "embed-binaries"))]
        None
    };

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    let data = {
        #[cfg(feature = "embed-binaries")]
        {
            Some(include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/binaries/windows-x86_64/llama-finetune.exe"
            )) as &[u8])
        }
        #[cfg(not(feature = "embed-binaries"))]
        None
    };

    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
        all(target_os = "windows", target_arch = "x86_64")
    )))]
    let data = None;

    Ok(PlatformBinary {
        name: platform,
        data,
    })
}

/// Extract embedded binary to a temporary location
async fn extract_embedded_binary(binary: &PlatformBinary) -> Result<PathBuf> {
    let data = binary.data.ok_or_else(|| {
        anyhow::anyhow!(
            "No embedded binary for platform: {}\n\
             Compile with --features embed-binaries to include pre-built binaries,\n\
             or build llama.cpp manually.",
            binary.name
        )
    })?;

    // Extract to user cache directory
    let cache_dir = if let Some(cache) = dirs::cache_dir() {
        cache.join("igris-runtime").join("llama-cpp-bins")
    } else {
        PathBuf::from(".igris-cache").join("llama-cpp-bins")
    };

    fs::create_dir_all(&cache_dir)
        .with_context(|| format!("Failed to create cache directory: {}", cache_dir.display()))?;

    let binary_name = if cfg!(windows) {
        "llama-finetune.exe"
    } else {
        "llama-finetune"
    };

    let binary_path = cache_dir.join(binary_name);

    // Check if already extracted and valid
    if binary_path.exists() {
        if let Ok(existing_data) = fs::read(&binary_path) {
            if existing_data == data {
                debug!(
                    "Using cached llama-finetune binary at {}",
                    binary_path.display()
                );
                return Ok(binary_path);
            }
        }
        warn!("Cached binary differs from embedded version, re-extracting");
    }

    // Extract binary
    info!(
        "Extracting llama-finetune binary to {}",
        binary_path.display()
    );
    fs::write(&binary_path, data)
        .with_context(|| format!("Failed to write binary to {}", binary_path.display()))?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(&binary_path)?.permissions();
        perms.set_mode(0o755); // rwxr-xr-x
        fs::set_permissions(&binary_path, perms)?;
        debug!("Set executable permissions on {}", binary_path.display());
    }

    info!("Successfully extracted llama-finetune binary");
    Ok(binary_path)
}

/// Check if llama-finetune exists in standard locations
fn check_standard_locations() -> Option<PathBuf> {
    // Check common installation paths
    let candidates = vec![
        "llama.cpp/build/bin/llama-finetune",
        "../llama.cpp/build/bin/llama-finetune",
        "../../llama.cpp/build/bin/llama-finetune",
        "../../../llama.cpp/build/bin/llama-finetune",
        "/usr/local/bin/llama-finetune",
        "/opt/llama.cpp/bin/llama-finetune",
    ];

    for candidate in candidates {
        let path = PathBuf::from(candidate);
        if path.exists() {
            info!(
                "Found llama-finetune at standard location: {}",
                path.display()
            );
            return Some(path);
        }
    }

    None
}

/// Get path to llama-finetune binary (extracted or from standard location)
///
/// This function tries multiple strategies in order:
/// 1. Extract embedded binary (if compiled with --features embed-binaries)
/// 2. Check standard installation paths (llama.cpp/build/bin/*, /usr/local/bin/*, etc.)
/// 3. Return error with helpful build instructions
pub async fn get_finetune_binary() -> Result<PathBuf> {
    let platform = detect_platform()?;
    debug!("Detected platform: {}", platform);

    // Try embedded binary first
    match get_embedded_binary() {
        Ok(binary) => {
            if binary.data.is_some() {
                match extract_embedded_binary(&binary).await {
                    Ok(path) => {
                        info!("Using embedded llama-finetune binary");
                        return Ok(path);
                    }
                    Err(e) => {
                        warn!("Failed to extract embedded binary: {}", e);
                    }
                }
            } else {
                debug!("No embedded binary available (compile with --features embed-binaries to include)");
            }
        }
        Err(e) => {
            warn!("Failed to get embedded binary: {}", e);
        }
    }

    // Try standard locations
    if let Some(path) = check_standard_locations() {
        return Ok(path);
    }

    // No binary found - provide helpful error message
    Err(anyhow::anyhow!(
        "llama-finetune binary not found.\n\n\
         To enable QLoRA training, choose one of the following options:\n\n\
         Option 1: Build llama.cpp (recommended for development)\n\
         --------------------------------------------------------\n\
         cd llama.cpp\n\
         cmake -B build -DGGML_METAL=ON -DLLAMA_BUILD_TOOLS=ON\n\
         cmake --build build --config Release\n\
         # Binary will be at: llama.cpp/build/bin/llama-finetune\n\n\
         Option 2: Use embedded binaries (recommended for production)\n\
         -------------------------------------------------------------\n\
         1. Download pre-built binaries for your platform from:\n\
            https://github.com/ggerganov/llama.cpp/releases\n\
         2. Place llama-finetune in:\n\
            crates/igris-lora-trainer/binaries/{}/\n\
         3. Rebuild with: cargo build --features embed-binaries\n\n\
         Option 3: Install system-wide\n\
         ------------------------------\n\
         # Install llama-finetune to /usr/local/bin/\n\
         sudo cp llama.cpp/build/bin/llama-finetune /usr/local/bin/\n\n\
         Current platform: {}\n\
         Current working directory: {}",
        platform,
        platform,
        std::env::current_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "unknown".to_string())
    ))
}

/// Verify that the llama-finetune binary is functional
pub async fn verify_finetune_binary(binary_path: &Path) -> Result<()> {
    use tokio::process::Command;

    debug!(
        "Verifying llama-finetune binary at: {}",
        binary_path.display()
    );

    let output = Command::new(binary_path)
        .arg("--help")
        .output()
        .await
        .with_context(|| {
            format!(
                "Failed to execute llama-finetune at {}",
                binary_path.display()
            )
        })?;

    if !output.status.success() {
        anyhow::bail!(
            "llama-finetune binary at {} is not functional",
            binary_path.display()
        );
    }

    let help_text = String::from_utf8_lossy(&output.stdout);
    if !help_text.contains("--lora-out") && !help_text.contains("--save-lora") {
        anyhow::bail!(
            "llama-finetune at {} does not support LoRA output. \
             Please rebuild llama.cpp with LoRA support.",
            binary_path.display()
        );
    }

    info!("llama-finetune binary verified successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_platform() {
        let platform = detect_platform();
        assert!(platform.is_ok());
        let platform = platform.unwrap();

        // Platform should be one of the supported ones
        assert!(
            platform == "macos-arm64"
                || platform == "macos-x86_64"
                || platform == "linux-x86_64"
                || platform == "linux-aarch64"
                || platform == "windows-x86_64"
        );
    }

    #[test]
    fn test_get_embedded_binary() {
        let result = get_embedded_binary();
        assert!(result.is_ok());

        let binary = result.unwrap();
        assert!(!binary.name.is_empty());

        // Without embed-binaries feature, data should be None
        #[cfg(not(feature = "embed-binaries"))]
        assert!(binary.data.is_none());
    }

    #[tokio::test]
    async fn test_get_finetune_binary_error_message() {
        // Without embedded binaries or llama.cpp build, should return helpful error
        let result = get_finetune_binary().await;

        if result.is_err() {
            let error = result.unwrap_err();
            let error_msg = format!("{}", error);

            // Error should contain helpful instructions
            assert!(error_msg.contains("llama-finetune binary not found"));
            assert!(error_msg.contains("Option 1:"));
            assert!(error_msg.contains("Option 2:"));
            assert!(error_msg.contains("Option 3:"));
            assert!(error_msg.contains("cmake"));
        }
    }
}
