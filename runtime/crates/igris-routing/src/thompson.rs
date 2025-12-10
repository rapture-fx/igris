// Minimal Thompson Sampling stub
// TODO: Re-enable path dependency to schlep-kernel once tracing module is fixed

use tracing::info;

/// Minimal Thompson Sampling router stub
pub struct ThompsonSamplingRouter {
    exploration_rate: f64,
}

impl ThompsonSamplingRouter {
    pub fn new(exploration_rate: f64) -> Self {
        Self { exploration_rate }
    }

    pub async fn select_provider(&self, providers: &[String]) -> anyhow::Result<String> {
        if providers.is_empty() {
            anyhow::bail!("No providers available");
        }

        info!(
            "Thompson Sampling: selecting from {} providers (exploration_rate={})",
            providers.len(),
            self.exploration_rate
        );

        // Simple random selection for now
        // TODO: Implement full Thompson Sampling once rust_kernel is available
        let selected = providers[0].clone();

        info!("Thompson Sampling: selected provider {}", selected);

        Ok(selected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_thompson_sampling_basic() {
        let router = ThompsonSamplingRouter::new(0.1);
        let providers = vec!["provider1".to_string(), "provider2".to_string()];

        let result = router.select_provider(&providers).await;
        assert!(result.is_ok());
    }
}
