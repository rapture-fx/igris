//! Igris Multi-Modal Input Processing
//!
//! Provides image and audio processing capabilities for AI agents.

use anyhow::Result;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub fn from_image_file(path: &Path) -> Result<Self> {
        let data = std::fs::read(path)?;
        Ok(Self {
            modality: ModalityType::Image,
            data,
            metadata: Some(path.display().to_string()),
        })
    }

    pub fn from_audio_file(path: &Path) -> Result<Self> {
        let data = std::fs::read(path)?;
        Ok(Self {
            modality: ModalityType::Audio,
            data,
            metadata: Some(path.display().to_string()),
        })
    }

    pub fn to_base64(&self) -> String {
        base64::engine::general_purpose::STANDARD.encode(&self.data)
    }
}

pub async fn describe_image_stub(image_data: &[u8]) -> Result<String> {
    info!("Image processing (stub): {} bytes", image_data.len());
    Ok(format!("Image description (placeholder): {} bytes", image_data.len()))
}

pub async fn transcribe_audio_stub(audio_data: &[u8]) -> Result<String> {
    info!("Audio processing (stub): {} bytes", audio_data.len());
    Ok(format!("Audio transcription (placeholder): {} bytes", audio_data.len()))
}

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
