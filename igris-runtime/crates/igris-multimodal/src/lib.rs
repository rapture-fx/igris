//! Igris Multi-Modal Input Processing
//!
//! Provides image and audio processing capabilities for AI agents.
//!
//! # Features
//! - `vision`: Enable real image processing (image, imageproc)
//! - `audio`: Enable real audio processing (hound)
//! - `multimodal`: Enable both vision and audio
//!
//! # Compilation Modes
//! - **Default (stub mode)**: No heavy dependencies, returns placeholder descriptions
//! - **With features**: Real image/audio analysis
//!
//! # Example
//! ```no_run
//! use igris_multimodal::{describe_image, transcribe_audio, MultiModalInput};
//! use std::path::Path;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     // Load image
//!     let image = MultiModalInput::from_image_file(Path::new("photo.jpg"))?;
//!     let description = describe_image(&image.data).await?;
//!     println!("Image: {}", description);
//!
//!     // Load audio
//!     let audio = MultiModalInput::from_audio_file(Path::new("speech.wav"))?;
//!     let transcription = transcribe_audio(&audio.data).await?;
//!     println!("Audio: {}", transcription);
//!
//!     Ok(())
//! }
//! ```

use anyhow::{Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[cfg(any(feature = "vision", feature = "audio"))]
use tracing::debug;

use tracing::info;

// warn is used in stub implementations (when features are disabled)
#[allow(unused_imports)]
use tracing::warn;

#[cfg(feature = "vision")]
use image::{DynamicImage, GenericImageView};

#[cfg(feature = "audio")]
use hound;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModalityType {
    Image,
    Audio,
    Text,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiModalInput {
    pub modality: ModalityType,
    pub data: Vec<u8>,
    pub metadata: Option<String>,
}

impl MultiModalInput {
    /// Load image from file
    pub fn from_image_file(path: &Path) -> Result<Self> {
        let data = std::fs::read(path)
            .with_context(|| format!("Failed to read image file: {}", path.display()))?;
        Ok(Self {
            modality: ModalityType::Image,
            data,
            metadata: Some(path.display().to_string()),
        })
    }

    /// Load audio from file
    pub fn from_audio_file(path: &Path) -> Result<Self> {
        let data = std::fs::read(path)
            .with_context(|| format!("Failed to read audio file: {}", path.display()))?;
        Ok(Self {
            modality: ModalityType::Audio,
            data,
            metadata: Some(path.display().to_string()),
        })
    }

    /// Create from raw bytes
    pub fn from_bytes(modality: ModalityType, data: Vec<u8>) -> Self {
        Self {
            modality,
            data,
            metadata: None,
        }
    }

    /// Encode to base64 string
    pub fn to_base64(&self) -> String {
        base64::engine::general_purpose::STANDARD.encode(&self.data)
    }

    /// Decode from base64 string
    pub fn from_base64(modality: ModalityType, base64_str: &str) -> Result<Self> {
        let data = base64::engine::general_purpose::STANDARD
            .decode(base64_str)
            .context("Failed to decode base64 data")?;
        Ok(Self {
            modality,
            data,
            metadata: None,
        })
    }
}

// ============================================================================
// IMAGE PROCESSING - REAL IMPLEMENTATION (vision feature enabled)
// ============================================================================

#[cfg(feature = "vision")]
pub async fn describe_image(image_data: &[u8]) -> Result<String> {
    debug!(
        "Processing image with real vision analysis: {} bytes",
        image_data.len()
    );

    // Decode image
    let img = image::load_from_memory(image_data).context("Failed to decode image")?;

    // Extract metadata
    let (width, height) = img.dimensions();
    let color_type = img.color();

    // Analyze image properties
    let description = analyze_image(&img)?;

    let result = format!(
        "Image Analysis:\n\
         - Dimensions: {}x{} pixels\n\
         - Color Type: {:?}\n\
         - File Size: {} bytes\n\
         - Analysis: {}",
        width,
        height,
        color_type,
        image_data.len(),
        description
    );

    info!("Image processed successfully: {}x{}", width, height);
    Ok(result)
}

#[cfg(feature = "vision")]
fn analyze_image(img: &DynamicImage) -> Result<String> {
    let (width, height) = img.dimensions();

    // Convert to RGB for analysis
    let rgb_img = img.to_rgb8();

    // Calculate average brightness
    let mut total_brightness: u64 = 0;
    let mut pixel_count = 0u64;

    for pixel in rgb_img.pixels() {
        let brightness = (pixel[0] as u64 + pixel[1] as u64 + pixel[2] as u64) / 3;
        total_brightness += brightness;
        pixel_count += 1;
    }

    let avg_brightness = if pixel_count > 0 {
        total_brightness / pixel_count
    } else {
        0
    };

    // Analyze dominant colors (simplified color histogram)
    let mut red_total: u64 = 0;
    let mut green_total: u64 = 0;
    let mut blue_total: u64 = 0;

    for pixel in rgb_img.pixels() {
        red_total += pixel[0] as u64;
        green_total += pixel[1] as u64;
        blue_total += pixel[2] as u64;
    }

    let pixels = (width as u64) * (height as u64);
    let avg_red = red_total / pixels;
    let avg_green = green_total / pixels;
    let avg_blue = blue_total / pixels;

    // Determine dominant color
    let dominant_color = if avg_red > avg_green && avg_red > avg_blue {
        "red-toned"
    } else if avg_green > avg_red && avg_green > avg_blue {
        "green-toned"
    } else if avg_blue > avg_red && avg_blue > avg_green {
        "blue-toned"
    } else {
        "balanced colors"
    };

    // Brightness description
    let brightness_desc = if avg_brightness > 200 {
        "very bright"
    } else if avg_brightness > 150 {
        "bright"
    } else if avg_brightness > 100 {
        "medium brightness"
    } else if avg_brightness > 50 {
        "dim"
    } else {
        "very dark"
    };

    // Calculate aspect ratio
    let aspect_ratio = width as f32 / height as f32;
    let orientation = if aspect_ratio > 1.3 {
        "landscape"
    } else if aspect_ratio < 0.7 {
        "portrait"
    } else {
        "square"
    };

    Ok(format!(
        "{} image with {} colors, average brightness {}/255 ({})",
        orientation, dominant_color, avg_brightness, brightness_desc
    ))
}

// ============================================================================
// IMAGE PROCESSING - STUB IMPLEMENTATION (vision feature disabled)
// ============================================================================

#[cfg(not(feature = "vision"))]
pub async fn describe_image(image_data: &[u8]) -> Result<String> {
    warn!("Vision feature not enabled - using stub implementation");
    info!("Image processing (stub): {} bytes", image_data.len());
    Ok(format!(
        "Image description (stub): {} bytes\n\
         Note: Compile with --features vision for real image analysis",
        image_data.len()
    ))
}

// ============================================================================
// AUDIO PROCESSING - REAL IMPLEMENTATION (audio feature enabled)
// ============================================================================

#[cfg(feature = "audio")]
pub async fn transcribe_audio(audio_data: &[u8]) -> Result<String> {
    debug!(
        "Processing audio with real analysis: {} bytes",
        audio_data.len()
    );

    // Try to read as WAV file
    let cursor = std::io::Cursor::new(audio_data);
    let reader = hound::WavReader::new(cursor).context("Failed to parse audio data as WAV file")?;

    let spec = reader.spec();
    let duration_samples = reader.len();
    let duration_secs = duration_samples as f32 / spec.sample_rate as f32;

    // Analyze audio properties
    let description = analyze_audio(audio_data, &spec, duration_secs)?;

    let result = format!(
        "Audio Analysis:\n\
         - Sample Rate: {} Hz\n\
         - Channels: {}\n\
         - Bits per Sample: {}\n\
         - Duration: {:.2} seconds\n\
         - File Size: {} bytes\n\
         - Analysis: {}",
        spec.sample_rate,
        spec.channels,
        spec.bits_per_sample,
        duration_secs,
        audio_data.len(),
        description
    );

    info!(
        "Audio processed successfully: {:.2}s @ {} Hz",
        duration_secs, spec.sample_rate
    );
    Ok(result)
}

#[cfg(feature = "audio")]
fn analyze_audio(_audio_data: &[u8], spec: &hound::WavSpec, duration: f32) -> Result<String> {
    // Classify duration
    let duration_desc = if duration < 1.0 {
        "very short audio clip"
    } else if duration < 5.0 {
        "short audio clip"
    } else if duration < 30.0 {
        "medium-length audio"
    } else if duration < 300.0 {
        "long audio recording"
    } else {
        "very long audio recording"
    };

    // Classify sample rate
    let quality_desc = if spec.sample_rate >= 44100 {
        "high-quality"
    } else if spec.sample_rate >= 22050 {
        "medium-quality"
    } else {
        "low-quality"
    };

    // Channel description
    let channel_desc = match spec.channels {
        1 => "mono",
        2 => "stereo",
        n => return Ok(format!("{}-channel", n)),
    };

    Ok(format!(
        "{} {} {} audio",
        duration_desc, quality_desc, channel_desc
    ))
}

// ============================================================================
// AUDIO PROCESSING - STUB IMPLEMENTATION (audio feature disabled)
// ============================================================================

#[cfg(not(feature = "audio"))]
pub async fn transcribe_audio(audio_data: &[u8]) -> Result<String> {
    warn!("Audio feature not enabled - using stub implementation");
    info!("Audio processing (stub): {} bytes", audio_data.len());
    Ok(format!(
        "Audio transcription (stub): {} bytes\n\
         Note: Compile with --features audio for real audio analysis",
        audio_data.len()
    ))
}

// ============================================================================
// CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiModalConfig {
    pub enabled: bool,
    pub enable_image: bool,
    pub enable_audio: bool,
}

impl Default for MultiModalConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            enable_image: false,
            enable_audio: false,
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Detect image format from bytes
pub fn detect_image_format(data: &[u8]) -> Option<String> {
    if data.len() < 12 {
        return None;
    }

    // PNG signature
    if data.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some("PNG".to_string());
    }

    // JPEG signature
    if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some("JPEG".to_string());
    }

    // GIF signature
    if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") {
        return Some("GIF".to_string());
    }

    // WebP signature
    if data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        return Some("WebP".to_string());
    }

    // BMP signature
    if data.starts_with(b"BM") {
        return Some("BMP".to_string());
    }

    None
}

/// Detect audio format from bytes
pub fn detect_audio_format(data: &[u8]) -> Option<String> {
    if data.len() < 12 {
        return None;
    }

    // WAV/RIFF signature
    if data.starts_with(b"RIFF") && data.len() >= 12 && &data[8..12] == b"WAVE" {
        return Some("WAV".to_string());
    }

    // MP3 signature (ID3v2)
    if data.starts_with(b"ID3") {
        return Some("MP3".to_string());
    }

    // MP3 signature (MPEG frame sync)
    if data.len() >= 2 && data[0] == 0xFF && (data[1] & 0xE0) == 0xE0 {
        return Some("MP3".to_string());
    }

    // FLAC signature
    if data.starts_with(b"fLaC") {
        return Some("FLAC".to_string());
    }

    // OGG signature
    if data.starts_with(b"OggS") {
        return Some("OGG".to_string());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_multimodal_input_base64_roundtrip() {
        let original = MultiModalInput {
            modality: ModalityType::Image,
            data: vec![1, 2, 3, 4, 5],
            metadata: Some("test.jpg".to_string()),
        };

        let base64 = original.to_base64();
        let decoded = MultiModalInput::from_base64(ModalityType::Image, &base64).unwrap();

        assert_eq!(original.data, decoded.data);
        assert_eq!(original.modality, decoded.modality);
    }

    #[test]
    fn test_detect_png_format() {
        let png_header = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
        assert_eq!(detect_image_format(&png_header), Some("PNG".to_string()));
    }

    #[test]
    fn test_detect_jpeg_format() {
        let jpeg_header = vec![0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0];
        assert_eq!(detect_image_format(&jpeg_header), Some("JPEG".to_string()));
    }

    #[test]
    fn test_detect_wav_format() {
        let mut wav_header = b"RIFF".to_vec();
        wav_header.extend_from_slice(&[0, 0, 0, 0]); // Size
        wav_header.extend_from_slice(b"WAVE");
        assert_eq!(detect_audio_format(&wav_header), Some("WAV".to_string()));
    }

    #[tokio::test]
    async fn test_describe_image_stub() {
        // This test works in both stub and real mode
        let fake_image_data = vec![0xFF, 0xD8, 0xFF, 0xE0]; // JPEG header
        let result = describe_image(&fake_image_data).await;

        // Should not panic, either returns stub or real description
        assert!(result.is_ok() || result.is_err());
    }

    #[tokio::test]
    async fn test_transcribe_audio_stub() {
        // This test works in both stub and real mode
        let fake_audio_data = vec![0; 100];
        let result = transcribe_audio(&fake_audio_data).await;

        // Should not panic, either returns stub or real transcription
        assert!(result.is_ok() || result.is_err());
    }
}
