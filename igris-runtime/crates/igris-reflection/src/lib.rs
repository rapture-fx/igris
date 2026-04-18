/// Igris Reflection - Self-Critique and Improvement Loops (v1.4)
///
/// This crate provides reflection capabilities for local LLMs:
/// - Generate → Critique → Regenerate loops
/// - Self-improvement agents
/// - Quality assessment and iterative refinement
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fmt;

pub mod agent;
pub mod critique;

pub use agent::ReflectionAgent;
pub use critique::{Critique, CritiqueScore};

/// Reflection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflectionConfig {
    /// Maximum number of reflection iterations
    #[serde(default = "default_max_iterations")]
    pub max_iterations: u32,

    /// Minimum quality score to accept (0.0-1.0)
    #[serde(default = "default_quality_threshold")]
    pub quality_threshold: f32,

    /// Enable verbose logging of reflection process
    #[serde(default)]
    pub verbose: bool,

    /// Temperature for generation (0.0-2.0)
    #[serde(default = "default_temperature")]
    pub temperature: f32,

    /// Early stopping if improvement is minimal
    #[serde(default = "default_early_stopping")]
    pub early_stopping: bool,

    /// Minimum improvement delta for early stopping
    #[serde(default = "default_min_improvement")]
    pub min_improvement_delta: f32,
}

fn default_max_iterations() -> u32 {
    3
}

fn default_quality_threshold() -> f32 {
    0.7
}

fn default_temperature() -> f32 {
    0.7
}

fn default_early_stopping() -> bool {
    true
}

fn default_min_improvement() -> f32 {
    0.05
}

impl Default for ReflectionConfig {
    fn default() -> Self {
        Self {
            max_iterations: 3,
            quality_threshold: 0.7,
            verbose: false,
            temperature: 0.7,
            early_stopping: true,
            min_improvement_delta: 0.05,
        }
    }
}

/// Result of a reflection iteration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflectionIteration {
    /// Iteration number (1-indexed)
    pub iteration: u32,

    /// Generated response
    pub response: String,

    /// Critique of the response
    pub critique: Critique,

    /// Whether this iteration was accepted as final
    pub accepted: bool,

    /// Reason for acceptance/rejection
    pub reason: String,
}

impl fmt::Display for ReflectionIteration {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Iteration {} [Score: {:.2}, {}]: {}",
            self.iteration,
            self.critique.overall_score,
            if self.accepted {
                "ACCEPTED"
            } else {
                "REJECTED"
            },
            self.reason
        )
    }
}

/// Final result of the reflection process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflectionResult {
    /// The final accepted response
    pub final_response: String,

    /// All iterations performed
    pub iterations: Vec<ReflectionIteration>,

    /// Total number of iterations
    pub total_iterations: u32,

    /// Final quality score
    pub final_score: f32,

    /// Whether the quality threshold was met
    pub threshold_met: bool,

    /// Total tokens used (approximate)
    pub total_tokens_used: u32,
}

impl ReflectionResult {
    /// Get the improvement over iterations
    pub fn improvement(&self) -> f32 {
        if self.iterations.len() < 2 {
            return 0.0;
        }
        let first_score = self.iterations[0].critique.overall_score;
        let final_score = self.final_score;
        final_score - first_score
    }

    /// Check if reflection was successful
    pub fn is_successful(&self) -> bool {
        self.threshold_met
    }
}

impl fmt::Display for ReflectionResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "Reflection Result:")?;
        writeln!(f, "  Total iterations: {}", self.total_iterations)?;
        writeln!(f, "  Final score: {:.2}", self.final_score)?;
        writeln!(f, "  Threshold met: {}", self.threshold_met)?;
        writeln!(f, "  Improvement: {:.2}", self.improvement())?;
        writeln!(f, "  Tokens used: ~{}", self.total_tokens_used)?;
        writeln!(f, "\nIterations:")?;
        for iter in &self.iterations {
            writeln!(f, "  {}", iter)?;
        }
        Ok(())
    }
}

/// Provider trait for LLM backends
///
/// This allows the reflection system to work with any LLM provider
#[async_trait::async_trait]
pub trait LLMProvider: Send + Sync {
    /// Generate a completion for the given prompt
    async fn generate(&self, prompt: &str) -> Result<String>;

    /// Get the provider name
    fn name(&self) -> &str;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = ReflectionConfig::default();
        assert_eq!(config.max_iterations, 3);
        assert_eq!(config.quality_threshold, 0.7);
        assert!(config.early_stopping);
    }

    #[test]
    fn test_config_serialization() {
        let config = ReflectionConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ReflectionConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.max_iterations, deserialized.max_iterations);
    }

    #[test]
    fn test_reflection_result_improvement() {
        let result = ReflectionResult {
            final_response: "test".to_string(),
            iterations: vec![
                ReflectionIteration {
                    iteration: 1,
                    response: "v1".to_string(),
                    critique: Critique {
                        overall_score: 0.5,
                        strengths: vec![],
                        weaknesses: vec![],
                        suggestions: vec![],
                        categories: std::collections::HashMap::new(),
                    },
                    accepted: false,
                    reason: "Low score".to_string(),
                },
                ReflectionIteration {
                    iteration: 2,
                    response: "v2".to_string(),
                    critique: Critique {
                        overall_score: 0.8,
                        strengths: vec![],
                        weaknesses: vec![],
                        suggestions: vec![],
                        categories: std::collections::HashMap::new(),
                    },
                    accepted: true,
                    reason: "Threshold met".to_string(),
                },
            ],
            total_iterations: 2,
            final_score: 0.8,
            threshold_met: true,
            total_tokens_used: 500,
        };

        assert_eq!(result.improvement(), 0.3);
        assert!(result.is_successful());
    }
}
