/// Reflection agent implementing generate → critique → regenerate loops
use crate::{
    critique::Critique, LLMProvider, ReflectionConfig, ReflectionIteration, ReflectionResult,
};
use anyhow::Result;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Reflection agent that performs self-critique and improvement
pub struct ReflectionAgent {
    config: ReflectionConfig,
    provider: Arc<dyn LLMProvider>,
    /// WAL log and signing key for durable execution (optional).
    /// When set, each iteration is WAL-logged so that a crashed agent
    /// can resume from the last committed iteration rather than starting over.
    #[cfg(feature = "wal")]
    wal: Option<(Arc<igris_wal::WalLog>, Arc<ed25519_dalek::SigningKey>)>,
}

impl ReflectionAgent {
    /// Create a new reflection agent
    pub fn new(config: ReflectionConfig, provider: Arc<dyn LLMProvider>) -> Self {
        Self {
            config,
            provider,
            #[cfg(feature = "wal")]
            wal: None,
        }
    }

    /// Attach a WAL log and signing key for durable, crash-recoverable
    /// reflection execution. Each iteration is written as a WAL entry; on
    /// recovery the agent skips already-committed iterations.
    #[cfg(feature = "wal")]
    pub fn with_wal(
        mut self,
        wal: Arc<igris_wal::WalLog>,
        signing_key: Arc<ed25519_dalek::SigningKey>,
    ) -> Self {
        self.wal = Some((wal, signing_key));
        self
    }

    /// Run the reflection loop on a prompt
    pub async fn reflect(&self, prompt: &str) -> Result<ReflectionResult> {
        // Determine which iteration to start from (WAL recovery).
        #[cfg(feature = "wal")]
        let start_iteration: u32 = if let Some((ref wal, _)) = self.wal {
            match wal.last_committed_step() {
                Ok(Some(last_step)) => {
                    info!(
                        "Resuming reflection from iteration {} (last committed step: {})",
                        last_step + 2,
                        last_step
                    );
                    last_step + 1 // last_step is 0-based; iteration loop is 1-based
                }
                Ok(None) => 0,
                Err(e) => {
                    warn!("WAL state check failed, starting from scratch: {}", e);
                    0
                }
            }
        } else {
            0
        };
        #[cfg(not(feature = "wal"))]
        let start_iteration: u32 = 0;

        info!(
            "Starting reflection loop with max_iterations={}, threshold={}",
            self.config.max_iterations, self.config.quality_threshold
        );

        let mut iterations = Vec::new();
        let mut current_prompt = prompt.to_string();
        let mut previous_response = String::new();
        let mut previous_score = 0.0;
        let mut total_tokens = 0u32;

        for iteration in 1..=self.config.max_iterations {
            // Skip iterations already committed to the WAL from a prior run.
            if iteration <= start_iteration {
                debug!(
                    "Skipping already-committed reflection iteration {}",
                    iteration
                );
                continue;
            }

            if self.config.verbose {
                info!(
                    "Reflection iteration {}/{}",
                    iteration, self.config.max_iterations
                );
            }

            // WAL: record intent before generating (step_index is 0-based).
            #[cfg(feature = "wal")]
            let wal_entry_id = if let Some((ref wal, _)) = self.wal {
                use igris_wal::StepType;
                use sha2::{Digest, Sha256};
                let input_digest: [u8; 32] = Sha256::digest(current_prompt.as_bytes()).into();
                match wal.write_intent(
                    iteration - 1,
                    StepType::Inference {
                        provider: self.provider.name().to_string(),
                        model: "reflection".to_string(),
                    },
                    input_digest,
                ) {
                    Ok(entry) => Some(entry.entry_id),
                    Err(e) => {
                        warn!("WAL intent write failed for iteration {}: {}", iteration, e);
                        None
                    }
                }
            } else {
                None
            };

            // Generate response
            debug!("Generating response for iteration {}", iteration);
            let response = self.provider.generate(&current_prompt).await?;
            total_tokens += Self::estimate_tokens(&current_prompt, &response);

            if self.config.verbose {
                debug!(
                    "Response (iter {}): {}",
                    iteration,
                    &response[..response.len().min(100)]
                );
            }

            // Generate critique
            debug!("Generating critique for iteration {}", iteration);
            let critique_prompt = Critique::create_critique_prompt(prompt, &response);
            let critique_response = self.provider.generate(&critique_prompt).await?;
            total_tokens += Self::estimate_tokens(&critique_prompt, &critique_response);

            let critique = Critique::parse_from_response(&critique_response);

            if self.config.verbose {
                info!(
                    "Critique (iter {}): Score={:.2}, Strengths={}, Weaknesses={}, Suggestions={}",
                    iteration,
                    critique.overall_score,
                    critique.strengths.len(),
                    critique.weaknesses.len(),
                    critique.suggestions.len()
                );
            }

            // WAL: commit this iteration now that generate + critique succeeded.
            #[cfg(feature = "wal")]
            if let (Some((ref wal, ref signing_key)), Some(entry_id)) = (&self.wal, wal_entry_id) {
                use sha2::{Digest, Sha256};
                let output_payload = format!("{}{}", response, critique_response);
                let output_digest: [u8; 32] = Sha256::digest(output_payload.as_bytes()).into();
                if let Err(e) = wal.write_committed(entry_id, output_digest, signing_key) {
                    warn!("WAL commit failed for iteration {}: {}", iteration, e);
                }
            }

            // Check acceptance criteria
            let (accepted, reason) = self.should_accept(
                iteration,
                &critique,
                previous_score,
                previous_response.is_empty(),
            );

            let iter_result = ReflectionIteration {
                iteration,
                response: response.clone(),
                critique: critique.clone(),
                accepted,
                reason: reason.clone(),
            };

            iterations.push(iter_result);

            if accepted {
                info!("Reflection completed: {}", reason);
                return Ok(ReflectionResult {
                    final_response: response,
                    iterations,
                    total_iterations: iteration,
                    final_score: critique.overall_score,
                    threshold_met: critique.overall_score >= self.config.quality_threshold,
                    total_tokens_used: total_tokens,
                });
            }

            // Prepare for next iteration
            if iteration < self.config.max_iterations {
                current_prompt = Critique::create_improvement_prompt(prompt, &response, &critique);
                previous_response = response;
                previous_score = critique.overall_score;
            } else {
                // Max iterations reached, return last response
                warn!(
                    "Max iterations ({}) reached without meeting threshold",
                    self.config.max_iterations
                );
                return Ok(ReflectionResult {
                    final_response: response,
                    iterations,
                    total_iterations: iteration,
                    final_score: critique.overall_score,
                    threshold_met: false,
                    total_tokens_used: total_tokens,
                });
            }
        }

        // Fallback (should not reach here)
        anyhow::bail!("Reflection loop ended unexpectedly");
    }

    /// Determine if the current iteration should be accepted
    fn should_accept(
        &self,
        iteration: u32,
        critique: &Critique,
        previous_score: f32,
        is_first: bool,
    ) -> (bool, String) {
        // Check if threshold is met
        if critique.overall_score >= self.config.quality_threshold {
            return (
                true,
                format!(
                    "Quality threshold met (score={:.2} >= {:.2})",
                    critique.overall_score, self.config.quality_threshold
                ),
            );
        }

        // Check for early stopping (minimal improvement)
        if self.config.early_stopping && !is_first {
            let improvement = critique.overall_score - previous_score;
            if improvement < self.config.min_improvement_delta {
                return (
                    true,
                    format!(
                        "Early stopping: minimal improvement (delta={:.3} < {:.3})",
                        improvement, self.config.min_improvement_delta
                    ),
                );
            }
        }

        // Check if max iterations reached
        if iteration >= self.config.max_iterations {
            return (
                true,
                format!(
                    "Max iterations reached ({}/{}), best score={:.2}",
                    iteration, self.config.max_iterations, critique.overall_score
                ),
            );
        }

        // Continue iterating
        (
            false,
            format!(
                "Score {:.2} below threshold {:.2}, continuing",
                critique.overall_score, self.config.quality_threshold
            ),
        )
    }

    /// Estimate tokens used (rough approximation)
    fn estimate_tokens(prompt: &str, response: &str) -> u32 {
        // Rough estimate: ~0.75 tokens per character
        let total_chars = prompt.len() + response.len();
        (total_chars as f32 * 0.75) as u32
    }

    /// Get the underlying config
    pub fn config(&self) -> &ReflectionConfig {
        &self.config
    }

    /// Get the provider name
    pub fn provider_name(&self) -> &str {
        self.provider.name()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LLMProvider;

    // Mock LLM provider for testing
    struct MockProvider {
        responses: Vec<String>,
        call_count: std::sync::Arc<std::sync::Mutex<usize>>,
    }

    impl MockProvider {
        fn new(responses: Vec<String>) -> Self {
            Self {
                responses,
                call_count: std::sync::Arc::new(std::sync::Mutex::new(0)),
            }
        }
    }

    #[async_trait::async_trait]
    impl LLMProvider for MockProvider {
        async fn generate(&self, _prompt: &str) -> Result<String> {
            let mut count = self.call_count.lock().unwrap();
            let idx = *count % self.responses.len();
            *count += 1;
            Ok(self.responses[idx].clone())
        }

        fn name(&self) -> &str {
            "MockProvider"
        }
    }

    #[tokio::test]
    async fn test_reflection_threshold_met() {
        let responses = vec![
            "Initial response".to_string(),
            "SCORE: 0.9\nSTRENGTHS:\n- Excellent\nWEAKNESSES:\nSUGGESTIONS:".to_string(),
        ];

        let provider = Arc::new(MockProvider::new(responses));
        let config = ReflectionConfig {
            max_iterations: 3,
            quality_threshold: 0.8,
            verbose: false,
            temperature: 0.7,
            early_stopping: true,
            min_improvement_delta: 0.05,
        };

        let agent = ReflectionAgent::new(config, provider);
        let result = agent.reflect("Test prompt").await.unwrap();

        assert_eq!(result.total_iterations, 1);
        assert!(result.threshold_met);
        assert!(result.final_score >= 0.8);
    }

    #[tokio::test]
    async fn test_reflection_max_iterations() {
        let responses = vec![
            "Response 1".to_string(),
            "SCORE: 0.5\nSTRENGTHS:\n- OK\nWEAKNESSES:\n- Needs work\nSUGGESTIONS:\n- Improve"
                .to_string(),
            "Response 2".to_string(),
            "SCORE: 0.55\nSTRENGTHS:\n- Better\nWEAKNESSES:\n- Still needs work\nSUGGESTIONS:\n- Keep trying"
                .to_string(),
            "Response 3".to_string(),
            "SCORE: 0.6\nSTRENGTHS:\n- Getting there\nWEAKNESSES:\n- Not quite\nSUGGESTIONS:\n- Almost"
                .to_string(),
        ];

        let provider = Arc::new(MockProvider::new(responses));
        let config = ReflectionConfig {
            max_iterations: 3,
            quality_threshold: 0.8,
            verbose: false,
            temperature: 0.7,
            early_stopping: false,
            min_improvement_delta: 0.05,
        };

        let agent = ReflectionAgent::new(config, provider);
        let result = agent.reflect("Test prompt").await.unwrap();

        assert_eq!(result.total_iterations, 3);
        assert!(!result.threshold_met);
        assert_eq!(result.iterations.len(), 3);
    }

    #[test]
    fn test_estimate_tokens() {
        let tokens = ReflectionAgent::estimate_tokens("Hello world", "This is a response");
        assert!(tokens > 0);
        assert!(tokens < 100); // Should be reasonable
    }
}
