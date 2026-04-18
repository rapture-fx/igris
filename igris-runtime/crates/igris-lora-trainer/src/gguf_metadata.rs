///! GGUF metadata parser
///!
///! Parses GGUF file headers to extract model metadata like embedding dimensions.
///! This allows loading the correct model dimensions instead of hard-coding 768.
///!
///! GGUF Format Reference: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tracing::{debug, info, warn};

/// GGUF metadata value types
#[derive(Debug, Clone)]
pub enum GGUFValue {
    UInt8(u8),
    Int8(i8),
    UInt16(u16),
    Int16(i16),
    UInt32(u32),
    Int32(i32),
    UInt64(u64),
    Int64(i64),
    Float32(f32),
    Float64(f64),
    Bool(bool),
    String(String),
    Array(Vec<GGUFValue>),
}

impl GGUFValue {
    /// Try to convert to usize (for dimensions)
    pub fn as_usize(&self) -> Option<usize> {
        match self {
            GGUFValue::UInt32(v) => Some(*v as usize),
            GGUFValue::Int32(v) if *v > 0 => Some(*v as usize),
            GGUFValue::UInt64(v) => Some(*v as usize),
            GGUFValue::Int64(v) if *v > 0 => Some(*v as usize),
            _ => None,
        }
    }
}

/// GGUF metadata parser
pub struct GGUFMetadata {
    pub metadata: HashMap<String, GGUFValue>,
}

impl GGUFMetadata {
    /// Load GGUF metadata from a file
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        debug!("Loading GGUF metadata from: {}", path.display());

        let file = File::open(path)
            .with_context(|| format!("Failed to open GGUF file: {}", path.display()))?;
        let mut reader = BufReader::new(file);

        // Read magic number (4 bytes: "GGUF")
        let mut magic = [0u8; 4];
        reader
            .read_exact(&mut magic)
            .context("Failed to read GGUF magic number")?;

        if &magic != b"GGUF" {
            anyhow::bail!("Not a valid GGUF file (magic number mismatch)");
        }

        // Read version (4 bytes, little-endian u32)
        let version = read_u32_le(&mut reader).context("Failed to read GGUF version")?;
        debug!("GGUF version: {}", version);

        if version < 2 || version > 3 {
            warn!(
                "Unsupported GGUF version: {}. Trying to parse anyway...",
                version
            );
        }

        // Read tensor count (8 bytes, little-endian u64)
        let _tensor_count = read_u64_le(&mut reader).context("Failed to read tensor count")?;

        // Read metadata count (8 bytes, little-endian u64)
        let metadata_count = read_u64_le(&mut reader).context("Failed to read metadata count")?;
        debug!("GGUF metadata entries: {}", metadata_count);

        // Read metadata key-value pairs
        let mut metadata = HashMap::new();
        for i in 0..metadata_count {
            match read_metadata_entry(&mut reader) {
                Ok((key, value)) => {
                    debug!("  {}: {:?}", key, value);
                    metadata.insert(key, value);
                }
                Err(e) => {
                    warn!("Failed to read metadata entry {}: {}", i, e);
                    // Continue parsing remaining entries
                }
            }
        }

        info!("Loaded {} metadata entries from GGUF file", metadata.len());
        Ok(Self { metadata })
    }

    /// Get embedding dimension from metadata
    /// Tries multiple common keys for embedding dimensions
    pub fn get_embedding_dim(&self) -> Option<usize> {
        // Try common keys for embedding dimensions
        let keys = [
            "llama.embedding_length",
            "embedding_length",
            "n_embd",
            "hidden_size",
            "d_model",
        ];

        for key in &keys {
            if let Some(value) = self.metadata.get(*key) {
                if let Some(dim) = value.as_usize() {
                    info!("Found embedding dimension from '{}': {}", key, dim);
                    return Some(dim);
                }
            }
        }

        None
    }

    /// Get model architecture (e.g., "llama", "gpt2", "bert")
    pub fn get_architecture(&self) -> Option<String> {
        if let Some(GGUFValue::String(arch)) = self.metadata.get("general.architecture") {
            return Some(arch.clone());
        }
        None
    }

    /// Get model name
    pub fn get_model_name(&self) -> Option<String> {
        if let Some(GGUFValue::String(name)) = self.metadata.get("general.name") {
            return Some(name.clone());
        }
        None
    }
}

/// Read a metadata key-value entry
fn read_metadata_entry<R: Read>(reader: &mut R) -> Result<(String, GGUFValue)> {
    // Read key (string)
    let key = read_string(reader)?;

    // Read value type (4 bytes)
    let value_type = read_u32_le(reader)?;

    // Read value based on type
    let value = read_value(reader, value_type)?;

    Ok((key, value))
}

/// Read a GGUF value based on type ID
fn read_value<R: Read>(reader: &mut R, type_id: u32) -> Result<GGUFValue> {
    match type_id {
        0 => Ok(GGUFValue::UInt8(read_u8(reader)?)),
        1 => Ok(GGUFValue::Int8(read_i8(reader)?)),
        2 => Ok(GGUFValue::UInt16(read_u16_le(reader)?)),
        3 => Ok(GGUFValue::Int16(read_i16_le(reader)?)),
        4 => Ok(GGUFValue::UInt32(read_u32_le(reader)?)),
        5 => Ok(GGUFValue::Int32(read_i32_le(reader)?)),
        6 => Ok(GGUFValue::Float32(read_f32_le(reader)?)),
        7 => Ok(GGUFValue::Bool({
            let b = read_u8(reader)?;
            b != 0
        })),
        8 => Ok(GGUFValue::String(read_string(reader)?)),
        9 => {
            // Array
            let array_type = read_u32_le(reader)?;
            let array_len = read_u64_le(reader)?;
            let mut array = Vec::with_capacity(array_len as usize);
            for _ in 0..array_len {
                array.push(read_value(reader, array_type)?);
            }
            Ok(GGUFValue::Array(array))
        }
        10 => Ok(GGUFValue::UInt64(read_u64_le(reader)?)),
        11 => Ok(GGUFValue::Int64(read_i64_le(reader)?)),
        12 => Ok(GGUFValue::Float64(read_f64_le(reader)?)),
        _ => anyhow::bail!("Unknown GGUF value type: {}", type_id),
    }
}

/// Read a string (u64 length + UTF-8 bytes)
fn read_string<R: Read>(reader: &mut R) -> Result<String> {
    let len = read_u64_le(reader)?;
    let mut buf = vec![0u8; len as usize];
    reader.read_exact(&mut buf)?;
    String::from_utf8(buf).context("Invalid UTF-8 in GGUF string")
}

// Helper functions for reading primitive types
fn read_u8<R: Read>(reader: &mut R) -> Result<u8> {
    let mut buf = [0u8; 1];
    reader.read_exact(&mut buf)?;
    Ok(buf[0])
}

fn read_i8<R: Read>(reader: &mut R) -> Result<i8> {
    let mut buf = [0u8; 1];
    reader.read_exact(&mut buf)?;
    Ok(buf[0] as i8)
}

fn read_u16_le<R: Read>(reader: &mut R) -> Result<u16> {
    let mut buf = [0u8; 2];
    reader.read_exact(&mut buf)?;
    Ok(u16::from_le_bytes(buf))
}

fn read_i16_le<R: Read>(reader: &mut R) -> Result<i16> {
    let mut buf = [0u8; 2];
    reader.read_exact(&mut buf)?;
    Ok(i16::from_le_bytes(buf))
}

fn read_u32_le<R: Read>(reader: &mut R) -> Result<u32> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf)?;
    Ok(u32::from_le_bytes(buf))
}

fn read_i32_le<R: Read>(reader: &mut R) -> Result<i32> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf)?;
    Ok(i32::from_le_bytes(buf))
}

fn read_u64_le<R: Read>(reader: &mut R) -> Result<u64> {
    let mut buf = [0u8; 8];
    reader.read_exact(&mut buf)?;
    Ok(u64::from_le_bytes(buf))
}

fn read_i64_le<R: Read>(reader: &mut R) -> Result<i64> {
    let mut buf = [0u8; 8];
    reader.read_exact(&mut buf)?;
    Ok(i64::from_le_bytes(buf))
}

fn read_f32_le<R: Read>(reader: &mut R) -> Result<f32> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf)?;
    Ok(f32::from_le_bytes(buf))
}

fn read_f64_le<R: Read>(reader: &mut R) -> Result<f64> {
    let mut buf = [0u8; 8];
    reader.read_exact(&mut buf)?;
    Ok(f64::from_le_bytes(buf))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gguf_value_conversions() {
        assert_eq!(GGUFValue::UInt32(768).as_usize(), Some(768));
        assert_eq!(GGUFValue::Int32(4096).as_usize(), Some(4096));
        assert_eq!(GGUFValue::Int32(-1).as_usize(), None);
        assert_eq!(GGUFValue::String("test".to_string()).as_usize(), None);
    }

    // Note: Full GGUF file tests require actual model files
    // In production, test with real GGUF files from your model directory
}
