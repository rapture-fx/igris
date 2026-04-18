//! Bridge between LoRA adapters and federated model updates.
//!
//! Converts trained LoRA adapter weights to the `ModelUpdate` format used by
//! the federated coordinator, and applies aggregated global model weights
//! back into LoRA adapter format.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tracing::{info, warn};

use crate::ModelUpdate;

/// LoRA adapter weight format (simplified safetensors-compatible)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoRAWeights {
    pub layers: HashMap<String, Vec<f32>>,
    pub metadata: LoRAMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoRAMetadata {
    pub rank: usize,
    pub alpha: f32,
    pub base_model: String,
    pub training_samples: usize,
    pub final_loss: Option<f64>,
}

/// Bridge between LoRA adapters and federated model updates
pub struct AdapterBridge;

impl AdapterBridge {
    /// Convert LoRA adapter weights to a federated model update
    pub fn adapter_to_update(
        participant_id: &str,
        round: u64,
        weights: &LoRAWeights,
        loss: f32,
    ) -> ModelUpdate {
        ModelUpdate {
            participant_id: participant_id.to_string(),
            round,
            weights: weights.layers.clone(),
            num_samples: weights.metadata.training_samples,
            loss,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }

    /// Convert a federated global model back into LoRA adapter weights
    pub fn update_to_adapter(
        weights: &HashMap<String, Vec<f32>>,
        metadata: LoRAMetadata,
    ) -> LoRAWeights {
        LoRAWeights {
            layers: weights.clone(),
            metadata,
        }
    }

    /// Load LoRA weights from a safetensors file (simplified reader)
    ///
    /// Reads the safetensors header to extract tensor names and shapes,
    /// then loads the weight data as f32 vectors.
    pub fn load_from_safetensors(path: &Path) -> Result<LoRAWeights> {
        use std::fs::File;
        use std::io::Read;

        let mut file = File::open(path)
            .with_context(|| format!("Failed to open adapter: {}", path.display()))?;

        // Read safetensors header length (first 8 bytes, little-endian u64)
        let mut header_len_buf = [0u8; 8];
        file.read_exact(&mut header_len_buf)?;
        let header_len = u64::from_le_bytes(header_len_buf) as usize;

        // Read header JSON
        let mut header_buf = vec![0u8; header_len];
        file.read_exact(&mut header_buf)?;
        let header_str =
            String::from_utf8(header_buf).context("Invalid UTF-8 in safetensors header")?;

        let header: HashMap<String, serde_json::Value> =
            serde_json::from_str(&header_str).context("Failed to parse safetensors header")?;

        // Read remaining data
        let mut data = Vec::new();
        file.read_to_end(&mut data)?;

        let mut layers = HashMap::new();

        for (name, info) in &header {
            if name == "__metadata__" {
                continue;
            }

            let dtype = info.get("dtype").and_then(|v| v.as_str()).unwrap_or("F32");
            if dtype != "F32" {
                warn!(
                    "Skipping tensor {} with dtype {} (only F32 supported)",
                    name, dtype
                );
                continue;
            }

            let offsets = info.get("data_offsets").and_then(|v| v.as_array());
            if let Some(offsets) = offsets {
                let start = offsets[0].as_u64().unwrap_or(0) as usize;
                let end = offsets[1].as_u64().unwrap_or(0) as usize;

                if end > start && end <= data.len() {
                    let tensor_data = &data[start..end];
                    let floats: Vec<f32> = tensor_data
                        .chunks_exact(4)
                        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
                        .collect();
                    layers.insert(name.clone(), floats);
                }
            }
        }

        info!("Loaded {} layers from {}", layers.len(), path.display());

        Ok(LoRAWeights {
            layers,
            metadata: LoRAMetadata {
                rank: 0, // Unknown from file alone
                alpha: 0.0,
                base_model: String::new(),
                training_samples: 0,
                final_loss: None,
            },
        })
    }

    /// Save LoRA weights to a simple JSON format (for federated transport)
    pub fn save_weights_json(weights: &LoRAWeights, path: &Path) -> Result<()> {
        let data =
            serde_json::to_string_pretty(weights).context("Failed to serialize LoRA weights")?;
        std::fs::write(path, data)?;
        info!("Saved LoRA weights to {}", path.display());
        Ok(())
    }

    /// Load LoRA weights from JSON format
    pub fn load_weights_json(path: &Path) -> Result<LoRAWeights> {
        let data = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read weights from {}", path.display()))?;
        let weights: LoRAWeights =
            serde_json::from_str(&data).context("Failed to deserialize LoRA weights")?;
        Ok(weights)
    }

    /// Compute weight delta between two sets of LoRA weights
    ///
    /// Returns the difference (new - old) for each layer, which is what
    /// should be submitted as a federated update (gradient-like).
    pub fn compute_weight_delta(
        old_weights: &HashMap<String, Vec<f32>>,
        new_weights: &HashMap<String, Vec<f32>>,
    ) -> HashMap<String, Vec<f32>> {
        let mut deltas = HashMap::new();

        for (name, new_vals) in new_weights {
            if let Some(old_vals) = old_weights.get(name) {
                let delta: Vec<f32> = new_vals
                    .iter()
                    .zip(old_vals.iter())
                    .map(|(&n, &o)| n - o)
                    .collect();
                deltas.insert(name.clone(), delta);
            } else {
                // New layer not in old weights - use full values as delta
                deltas.insert(name.clone(), new_vals.clone());
            }
        }

        deltas
    }

    /// Apply a weight delta to base weights
    pub fn apply_weight_delta(
        base_weights: &HashMap<String, Vec<f32>>,
        delta: &HashMap<String, Vec<f32>>,
        learning_rate: f32,
    ) -> HashMap<String, Vec<f32>> {
        let mut result = base_weights.clone();

        for (name, delta_vals) in delta {
            if let Some(base_vals) = result.get_mut(name) {
                for (i, d) in delta_vals.iter().enumerate() {
                    if i < base_vals.len() {
                        base_vals[i] += d * learning_rate;
                    }
                }
            } else {
                // New layer from delta
                let scaled: Vec<f32> = delta_vals.iter().map(|&d| d * learning_rate).collect();
                result.insert(name.clone(), scaled);
            }
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adapter_to_update() {
        let mut layers = HashMap::new();
        layers.insert("lora_a".to_string(), vec![1.0, 2.0, 3.0]);
        layers.insert("lora_b".to_string(), vec![4.0, 5.0, 6.0]);

        let weights = LoRAWeights {
            layers,
            metadata: LoRAMetadata {
                rank: 8,
                alpha: 16.0,
                base_model: "phi-3".to_string(),
                training_samples: 100,
                final_loss: Some(0.5),
            },
        };

        let update = AdapterBridge::adapter_to_update("device-1", 0, &weights, 0.5);

        assert_eq!(update.participant_id, "device-1");
        assert_eq!(update.num_samples, 100);
        assert_eq!(update.weights.len(), 2);
    }

    #[test]
    fn test_compute_weight_delta() {
        let mut old = HashMap::new();
        old.insert("layer1".to_string(), vec![1.0, 2.0, 3.0]);

        let mut new = HashMap::new();
        new.insert("layer1".to_string(), vec![1.5, 2.5, 3.5]);

        let delta = AdapterBridge::compute_weight_delta(&old, &new);

        let d = &delta["layer1"];
        assert!((d[0] - 0.5).abs() < 1e-6);
        assert!((d[1] - 0.5).abs() < 1e-6);
        assert!((d[2] - 0.5).abs() < 1e-6);
    }

    #[test]
    fn test_apply_weight_delta() {
        let mut base = HashMap::new();
        base.insert("layer1".to_string(), vec![1.0, 2.0, 3.0]);

        let mut delta = HashMap::new();
        delta.insert("layer1".to_string(), vec![0.5, 0.5, 0.5]);

        let result = AdapterBridge::apply_weight_delta(&base, &delta, 1.0);
        let r = &result["layer1"];

        assert!((r[0] - 1.5).abs() < 1e-6);
        assert!((r[1] - 2.5).abs() < 1e-6);
        assert!((r[2] - 3.5).abs() < 1e-6);
    }

    #[test]
    fn test_apply_weight_delta_with_learning_rate() {
        let mut base = HashMap::new();
        base.insert("layer1".to_string(), vec![1.0, 2.0, 3.0]);

        let mut delta = HashMap::new();
        delta.insert("layer1".to_string(), vec![1.0, 1.0, 1.0]);

        let result = AdapterBridge::apply_weight_delta(&base, &delta, 0.5);
        let r = &result["layer1"];

        assert!((r[0] - 1.5).abs() < 1e-6);
        assert!((r[1] - 2.5).abs() < 1e-6);
        assert!((r[2] - 3.5).abs() < 1e-6);
    }
}
