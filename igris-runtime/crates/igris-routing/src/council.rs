use futures::future::join_all;
use std::time::Instant;
use tracing::{info, warn, debug};

// Re-export Provider trait from speculative module
pub use crate::speculative::Provider;

/// Result of a council routing attempt
#[derive(Debug)]
pub struct CouncilResult {
    pub chairman_id: String,
    pub response: String,
    pub member_count: usize,
    pub successful_members: usize,
    pub total_latency_ms: u64,
    pub member_responses: Vec<MemberResponse>,
}

#[derive(Debug, Clone)]
pub struct MemberResponse {
    pub provider_id: String,
    pub provider_name: String,
    pub response: String,
    pub latency_ms: u64,
}

pub struct CouncilRouter {
    chairman_id: String,
    min_responses: usize,
}

impl CouncilRouter {
    pub fn new(chairman_id: String) -> Self {
        Self {
            chairman_id,
            min_responses: 1,
        }
    }

    pub fn with_min_responses(mut self, min_responses: usize) -> Self {
        self.min_responses = min_responses;
        self
    }

    /// Execute council mode routing: parallel execution + chairman synthesis
    pub async fn route<P>(&self, prompt: &str, council_members: Vec<P>) -> anyhow::Result<CouncilResult>
    where
        P: Provider + 'static,
    {
        if council_members.is_empty() {
            anyhow::bail!("No council members provided");
        }

        let start_time = Instant::now();
        let member_count = council_members.len();

        info!(
            "Starting council mode with {} members (chairman={})",
            member_count, self.chairman_id
        );

        // Find chairman in council members
        let chairman_opt = council_members
            .iter()
            .find(|p| p.id() == self.chairman_id)
            .map(|p| (p.id().to_string(), p.name().to_string()));

        if chairman_opt.is_none() {
            anyhow::bail!(
                "Chairman '{}' not found in council members",
                self.chairman_id
            );
        }

        // Execute all council members in parallel
        let member_futures: Vec<_> = council_members
            .into_iter()
            .map(|provider| {
                let prompt = prompt.to_string();
                async move {
                    let provider_start = Instant::now();
                    let provider_id = provider.id().to_string();
                    let provider_name = provider.name().to_string();

                    debug!("Council member {} starting", provider_id);

                    match provider.complete(&prompt).await {
                        Ok(response) => {
                            let latency = provider_start.elapsed();
                            debug!(
                                "Council member {} completed in {:?}",
                                provider_id, latency
                            );
                            Ok(MemberResponse {
                                provider_id,
                                provider_name,
                                response,
                                latency_ms: latency.as_millis() as u64,
                            })
                        }
                        Err(e) => {
                            warn!("Council member {} failed: {}", provider_id, e);
                            Err(e)
                        }
                    }
                }
            })
            .collect();

        // Wait for all members to complete
        let results = join_all(member_futures).await;

        // Collect successful responses (excluding chairman for synthesis)
        let mut member_responses: Vec<MemberResponse> = results
            .into_iter()
            .filter_map(|r| r.ok())
            .filter(|r| r.provider_id != self.chairman_id)
            .collect();

        // Find chairman's response
        let chairman_response = member_responses
            .iter()
            .find(|r| r.provider_id == self.chairman_id)
            .cloned();

        let successful_count = member_responses.len() + chairman_response.is_some() as usize;

        if successful_count < self.min_responses {
            anyhow::bail!(
                "Council mode failed: only {}/{} members succeeded (minimum required: {})",
                successful_count,
                member_count,
                self.min_responses
            );
        }

        if member_responses.is_empty() && chairman_response.is_none() {
            anyhow::bail!("All council members failed");
        }

        // Generate synthesis prompt for chairman
        let synthesis_prompt = if member_responses.is_empty() {
            // No other members succeeded, chairman must answer directly
            prompt.to_string()
        } else {
            let member_summaries: Vec<String> = member_responses
                .iter()
                .map(|r| {
                    format!(
                        "**{}** ({}ms):\n{}\n",
                        r.provider_name, r.latency_ms, r.response
                    )
                })
                .collect();

            format!(
                "You are the chairman of a council. {} council members have provided responses to this question:\n\n\
                 **Original Question:**\n{}\n\n\
                 **Council Member Responses:**\n\n{}\n\n\
                 **Your Task:**\n\
                 Synthesize these responses into a single, coherent answer that:\n\
                 1. Identifies common themes and consensus\n\
                 2. Highlights valuable unique perspectives\n\
                 3. Resolves contradictions if any\n\
                 4. Provides a definitive final answer\n\n\
                 Provide only the synthesized answer without meta-commentary.",
                member_responses.len(),
                prompt,
                member_summaries.join("\n---\n\n")
            )
        };

        // Get chairman's synthesis (or reuse if chairman already responded)
        let final_response = if let Some(existing) = chairman_response {
            info!(
                "Using chairman's existing response from parallel execution (latency={}ms)",
                existing.latency_ms
            );
            existing.response
        } else {
            // Chairman didn't participate in initial round, call separately for synthesis
            info!("Calling chairman for synthesis");

            // We need a chairman provider - since we filtered it out, we need to handle this case
            // In a real implementation, we'd keep a reference to the chairman provider
            // For now, return an error if chairman wasn't in the original members
            anyhow::bail!(
                "Chairman synthesis requires chairman to be in council members list"
            );
        };

        let total_latency = start_time.elapsed();

        info!(
            "Council mode complete: {}/{} members succeeded (total_latency={}ms)",
            successful_count,
            member_count,
            total_latency.as_millis()
        );

        Ok(CouncilResult {
            chairman_id: self.chairman_id.clone(),
            response: final_response,
            member_count,
            successful_members: successful_count,
            total_latency_ms: total_latency.as_millis() as u64,
            member_responses,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::pin::Pin;
    use futures::Stream;
    use futures::stream;

    struct MockProvider {
        id: String,
        name: String,
        response: String,
        delay_ms: u64,
        should_fail: bool,
    }

    impl Provider for MockProvider {
        fn id(&self) -> &str {
            &self.id
        }

        fn name(&self) -> &str {
            &self.name
        }

        async fn stream(&self, _prompt: &str) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
            if self.should_fail {
                anyhow::bail!("Mock provider intentional failure");
            }
            tokio::time::sleep(std::time::Duration::from_millis(self.delay_ms)).await;
            let response = self.response.clone();
            Ok(Box::pin(stream::iter(vec![Ok(response)])))
        }

        async fn complete(&self, _prompt: &str) -> anyhow::Result<String> {
            if self.should_fail {
                anyhow::bail!("Mock provider intentional failure");
            }
            tokio::time::sleep(std::time::Duration::from_millis(self.delay_ms)).await;
            Ok(self.response.clone())
        }
    }

    #[test]
    fn test_council_router_creation() {
        let router = CouncilRouter::new("claude-3-5-sonnet".to_string());
        assert_eq!(router.chairman_id, "claude-3-5-sonnet");
    }

    #[tokio::test]
    async fn test_council_mode_basic() {
        let router = CouncilRouter::new("chairman".to_string());

        let members = vec![
            MockProvider {
                id: "member1".to_string(),
                name: "Member 1".to_string(),
                response: "Response from member 1".to_string(),
                delay_ms: 100,
                should_fail: false,
            },
            MockProvider {
                id: "chairman".to_string(),
                name: "Chairman".to_string(),
                response: "Synthesized response".to_string(),
                delay_ms: 150,
                should_fail: false,
            },
            MockProvider {
                id: "member2".to_string(),
                name: "Member 2".to_string(),
                response: "Response from member 2".to_string(),
                delay_ms: 120,
                should_fail: false,
            },
        ];

        let result = router.route("test prompt", members).await;
        assert!(result.is_ok());

        let result = result.unwrap();
        assert_eq!(result.chairman_id, "chairman");
        assert_eq!(result.member_count, 3);
        assert!(result.successful_members >= 1);
    }

    #[tokio::test]
    async fn test_council_mode_with_failures() {
        let router = CouncilRouter::new("chairman".to_string()).with_min_responses(1);

        let members = vec![
            MockProvider {
                id: "member1".to_string(),
                name: "Member 1".to_string(),
                response: "Should fail".to_string(),
                delay_ms: 100,
                should_fail: true,
            },
            MockProvider {
                id: "chairman".to_string(),
                name: "Chairman".to_string(),
                response: "Chairman response".to_string(),
                delay_ms: 150,
                should_fail: false,
            },
        ];

        let result = router.route("test prompt", members).await;
        assert!(result.is_ok());

        let result = result.unwrap();
        assert_eq!(result.successful_members, 1);
    }

    #[tokio::test]
    async fn test_council_mode_chairman_not_found() {
        let router = CouncilRouter::new("nonexistent".to_string());

        let members = vec![MockProvider {
            id: "member1".to_string(),
            name: "Member 1".to_string(),
            response: "Response".to_string(),
            delay_ms: 100,
            should_fail: false,
        }];

        let result = router.route("test prompt", members).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Chairman 'nonexistent' not found"));
    }
}
