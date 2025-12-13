use tokio::time::{timeout, Duration};
use futures::stream::{StreamExt, FuturesUnordered};
use std::time::Instant;
use std::pin::Pin;
use futures::Stream;
use anyhow::Context;
use tracing::{info, warn, debug};

/// Provider trait for AI model backends
pub trait Provider: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;

    /// Stream tokens from the provider
    async fn stream(&self, prompt: &str) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>>;

    /// Complete a request (non-streaming)
    async fn complete(&self, prompt: &str) -> anyhow::Result<String>;
}

/// Result of a speculative routing attempt
#[derive(Debug)]
pub struct SpeculativeResult {
    pub winner_id: String,
    pub winner_name: String,
    pub response: String,
    pub first_token_latency_ms: u64,
    pub total_latency_ms: u64,
    pub providers_attempted: usize,
}

pub struct SpeculativeRouter {
    max_providers: usize,
    first_token_timeout: Duration,
}

impl SpeculativeRouter {
    pub fn new(max_providers: usize, first_token_timeout: Duration) -> Self {
        Self {
            max_providers,
            first_token_timeout,
        }
    }

    /// Execute speculative routing: race providers, first to respond wins
    pub async fn route<P>(&self, prompt: &str, providers: Vec<P>) -> anyhow::Result<SpeculativeResult>
    where
        P: Provider + 'static,
    {
        if providers.is_empty() {
            anyhow::bail!("No providers available for speculative routing");
        }

        let start_time = Instant::now();
        let providers_to_use = providers.into_iter().take(self.max_providers).collect::<Vec<_>>();
        let provider_count = providers_to_use.len();

        info!(
            "Starting speculative routing with {} providers (max_timeout={:?})",
            provider_count, self.first_token_timeout
        );

        // Create futures for all providers
        let mut futures = FuturesUnordered::new();

        for provider in providers_to_use {
            let prompt = prompt.to_string();
            let timeout_duration = self.first_token_timeout;

            futures.push(async move {
                let provider_start = Instant::now();
                let provider_id = provider.id().to_string();
                let provider_name = provider.name().to_string();

                debug!("Starting provider: {}", provider_id);

                // Wrap the provider call with timeout
                match timeout(timeout_duration, provider.stream(&prompt)).await {
                    Ok(Ok(mut stream)) => {
                        // Get first token
                        match stream.next().await {
                            Some(Ok(first_token)) => {
                                let first_token_latency = provider_start.elapsed();
                                debug!(
                                    "Provider {} produced first token in {:?}",
                                    provider_id, first_token_latency
                                );

                                // Collect remaining tokens
                                let mut response = first_token;
                                while let Some(token_result) = stream.next().await {
                                    match token_result {
                                        Ok(token) => response.push_str(&token),
                                        Err(e) => {
                                            warn!("Provider {} stream error: {}", provider_id, e);
                                            break;
                                        }
                                    }
                                }

                                let total_latency = provider_start.elapsed();

                                Ok((
                                    provider_id,
                                    provider_name,
                                    response,
                                    first_token_latency.as_millis() as u64,
                                    total_latency.as_millis() as u64,
                                ))
                            }
                            Some(Err(e)) => {
                                warn!("Provider {} first token error: {}", provider_id, e);
                                Err(anyhow::anyhow!("Provider {} first token error: {}", provider_id, e))
                            }
                            None => {
                                warn!("Provider {} returned empty stream", provider_id);
                                Err(anyhow::anyhow!("Provider {} returned empty stream", provider_id))
                            }
                        }
                    }
                    Ok(Err(e)) => {
                        warn!("Provider {} failed to start stream: {}", provider_id, e);
                        Err(e)
                    }
                    Err(_) => {
                        warn!("Provider {} timed out", provider_id);
                        Err(anyhow::anyhow!("Provider {} timed out after {:?}", provider_id, timeout_duration))
                    }
                }
            });
        }

        // Wait for first successful response
        while let Some(result) = futures.next().await {
            match result {
                Ok((winner_id, winner_name, response, first_token_latency_ms, total_latency_ms)) => {
                    info!(
                        "Speculative routing complete: winner={} (first_token={}ms, total={}ms)",
                        winner_id, first_token_latency_ms, total_latency_ms
                    );

                    // Drop the futures to cancel remaining providers
                    drop(futures);

                    return Ok(SpeculativeResult {
                        winner_id,
                        winner_name,
                        response,
                        first_token_latency_ms,
                        total_latency_ms,
                        providers_attempted: provider_count,
                    });
                }
                Err(e) => {
                    debug!("Provider failed: {}", e);
                    // Continue to next provider
                }
            }
        }

        // All providers failed
        let elapsed = start_time.elapsed();
        anyhow::bail!(
            "All {} providers failed in speculative routing (elapsed: {:?})",
            provider_count,
            elapsed
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::stream;

    struct MockProvider {
        id: String,
        name: String,
        response: String,
        delay_ms: u64,
    }

    impl Provider for MockProvider {
        fn id(&self) -> &str {
            &self.id
        }

        fn name(&self) -> &str {
            &self.name
        }

        async fn stream(&self, _prompt: &str) -> anyhow::Result<Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>> {
            tokio::time::sleep(std::time::Duration::from_millis(self.delay_ms)).await;
            let response = self.response.clone();
            Ok(Box::pin(stream::iter(vec![Ok(response)])))
        }

        async fn complete(&self, _prompt: &str) -> anyhow::Result<String> {
            tokio::time::sleep(std::time::Duration::from_millis(self.delay_ms)).await;
            Ok(self.response.clone())
        }
    }

    #[tokio::test]
    async fn test_speculative_router_creation() {
        let router = SpeculativeRouter::new(3, Duration::from_secs(5));
        assert_eq!(router.max_providers, 3);
    }

    #[tokio::test]
    async fn test_speculative_routing_fastest_wins() {
        let router = SpeculativeRouter::new(3, Duration::from_secs(5));

        let providers = vec![
            MockProvider {
                id: "slow".to_string(),
                name: "Slow Provider".to_string(),
                response: "Slow response".to_string(),
                delay_ms: 500,
            },
            MockProvider {
                id: "fast".to_string(),
                name: "Fast Provider".to_string(),
                response: "Fast response".to_string(),
                delay_ms: 100,
            },
            MockProvider {
                id: "medium".to_string(),
                name: "Medium Provider".to_string(),
                response: "Medium response".to_string(),
                delay_ms: 300,
            },
        ];

        let result = router.route("test prompt", providers).await;
        assert!(result.is_ok());

        let result = result.unwrap();
        assert_eq!(result.winner_id, "fast");
        assert_eq!(result.response, "Fast response");
        assert!(result.first_token_latency_ms < 200);
    }

    #[tokio::test]
    async fn test_speculative_routing_timeout() {
        let router = SpeculativeRouter::new(2, Duration::from_millis(100));

        let providers = vec![
            MockProvider {
                id: "timeout1".to_string(),
                name: "Timeout Provider 1".to_string(),
                response: "Should timeout".to_string(),
                delay_ms: 200,
            },
            MockProvider {
                id: "timeout2".to_string(),
                name: "Timeout Provider 2".to_string(),
                response: "Should timeout".to_string(),
                delay_ms: 300,
            },
        ];

        let result = router.route("test prompt", providers).await;
        assert!(result.is_err());
    }
}
