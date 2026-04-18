/// Model registry and definitions for v1.4
///
/// This module defines the available local models and their configurations.
use serde::{Deserialize, Serialize};

/// Model identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ModelId {
    /// Microsoft Phi-3 Mini 4K (v1.1-1.3 default)
    Phi3Mini4k,
    /// Qwen3-8B (NEW in v1.4)
    Qwen38b,
    /// Qwen3-14B (NEW in v1.4)
    Qwen314b,
    /// DeepSeek-V3.2-7B (NEW in v1.4)
    DeepseekV327b,
    /// GLM-4-9B (NEW in v1.4)
    Glm49b,
    /// Llama-4-8B - placeholder for when available (NEW in v1.4)
    Llama48b,
}

impl ModelId {
    /// Get the default model (Phi-3 for backward compatibility)
    pub fn default() -> Self {
        Self::Phi3Mini4k
    }

    /// Get display name
    pub fn display_name(&self) -> &str {
        match self {
            Self::Phi3Mini4k => "Microsoft Phi-3 Mini 4K",
            Self::Qwen38b => "Qwen3-8B",
            Self::Qwen314b => "Qwen3-14B",
            Self::DeepseekV327b => "DeepSeek-V3.2-7B",
            Self::Glm49b => "GLM-4-9B",
            Self::Llama48b => "Llama-4-8B",
        }
    }

    /// Get recommended quantization
    pub fn recommended_quantization(&self) -> &str {
        match self {
            Self::Phi3Mini4k => "Q4_K_M",
            Self::Qwen38b => "Q4_K_M",
            Self::Qwen314b => "Q5_K_M",
            Self::DeepseekV327b => "Q4_K_M",
            Self::Glm49b => "Q4_K_M",
            Self::Llama48b => "Q4_K_M",
        }
    }

    /// Get default filename for this model
    pub fn default_filename(&self) -> String {
        match self {
            Self::Phi3Mini4k => "phi-3-mini-4k-instruct-q4.gguf".to_string(),
            Self::Qwen38b => "qwen3-8b-instruct-q4.gguf".to_string(),
            Self::Qwen314b => "qwen3-14b-instruct-q5.gguf".to_string(),
            Self::DeepseekV327b => "deepseek-v3.2-7b-q4.gguf".to_string(),
            Self::Glm49b => "glm-4-9b-chat-q4.gguf".to_string(),
            Self::Llama48b => "llama-4-8b-instruct-q4.gguf".to_string(),
        }
    }

    /// Get HuggingFace download URL (or placeholder for unavailable models)
    pub fn download_url(&self) -> &str {
        match self {
            Self::Phi3Mini4k => {
                "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"
            }
            Self::Qwen38b => {
                "https://huggingface.co/Qwen/Qwen2.5-8B-Instruct-GGUF/resolve/main/qwen2.5-8b-instruct-q4_k_m.gguf"
            }
            Self::Qwen314b => {
                "https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF/resolve/main/qwen2.5-14b-instruct-q5_k_m.gguf"
            }
            Self::DeepseekV327b => {
                // Note: Using DeepSeek-Coder-V2 as V3.2 naming placeholder
                "https://huggingface.co/deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct-GGUF/resolve/main/DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf"
            }
            Self::Glm49b => {
                "https://huggingface.co/second-state/glm-4-9b-chat-GGUF/resolve/main/glm-4-9b-chat-Q4_K_M.gguf"
            }
            Self::Llama48b => {
                // Placeholder - Llama 4 not yet released as of v1.4
                "NOT_YET_AVAILABLE"
            }
        }
    }

    /// Get approximate model size in GB
    pub fn approximate_size_gb(&self) -> f32 {
        match self {
            Self::Phi3Mini4k => 2.3,
            Self::Qwen38b => 4.9,
            Self::Qwen314b => 8.5,
            Self::DeepseekV327b => 4.2,
            Self::Glm49b => 5.4,
            Self::Llama48b => 4.8,
        }
    }

    /// Get recommended context size
    pub fn recommended_context_size(&self) -> u32 {
        match self {
            Self::Phi3Mini4k => 4096,
            Self::Qwen38b => 8192,
            Self::Qwen314b => 8192,
            Self::DeepseekV327b => 16384,
            Self::Glm49b => 8192,
            Self::Llama48b => 8192,
        }
    }

    /// Get strengths/capabilities
    pub fn capabilities(&self) -> Vec<&str> {
        match self {
            Self::Phi3Mini4k => vec!["compact", "fast", "general"],
            Self::Qwen38b => vec!["reasoning", "coding", "math", "multilingual"],
            Self::Qwen314b => vec![
                "reasoning",
                "coding",
                "math",
                "multilingual",
                "high-quality",
            ],
            Self::DeepseekV327b => vec!["coding", "technical", "long-context"],
            Self::Glm49b => vec!["reasoning", "coding", "chinese", "multilingual"],
            Self::Llama48b => vec!["general", "reasoning", "coding"],
        }
    }

    /// Is this model available for download?
    pub fn is_available(&self) -> bool {
        !matches!(self, Self::Llama48b)
    }

    /// Get all available models
    pub fn all_available() -> Vec<Self> {
        vec![
            Self::Phi3Mini4k,
            Self::Qwen38b,
            Self::Qwen314b,
            Self::DeepseekV327b,
            Self::Glm49b,
        ]
    }

    /// Get all models including placeholders
    pub fn all() -> Vec<Self> {
        vec![
            Self::Phi3Mini4k,
            Self::Qwen38b,
            Self::Qwen314b,
            Self::DeepseekV327b,
            Self::Glm49b,
            Self::Llama48b,
        ]
    }
}

impl std::fmt::Display for ModelId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

impl Default for ModelId {
    fn default() -> Self {
        Self::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_metadata() {
        let model = ModelId::Qwen38b;
        assert_eq!(model.display_name(), "Qwen3-8B");
        assert_eq!(model.recommended_quantization(), "Q4_K_M");
        assert!(model.is_available());
        assert!(model.capabilities().contains(&"reasoning"));
    }

    #[test]
    fn test_llama4_placeholder() {
        let model = ModelId::Llama48b;
        assert!(!model.is_available());
        assert_eq!(model.download_url(), "NOT_YET_AVAILABLE");
    }

    #[test]
    fn test_all_models() {
        let all = ModelId::all();
        assert_eq!(all.len(), 6);
        let available = ModelId::all_available();
        assert_eq!(available.len(), 5);
    }

    #[test]
    fn test_serialization() {
        let model = ModelId::Qwen314b;
        let json = serde_json::to_string(&model).unwrap();
        let deserialized: ModelId = serde_json::from_str(&json).unwrap();
        assert_eq!(model, deserialized);
    }
}
