// Production Thompson Sampling implementation
// Re-exports from schlep-kernel optimizer module

use schlep_kernel::optimizer::{
    bandits::{ThompsonSampling, ThompsonSamplingConfig},
    rewards::{RewardMetrics, RewardPolicy},
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, debug};

/// Thompson Sampling router with Beta distribution sampling
pub struct ThompsonSamplingRouter {
    optimizer: Arc<RwLock<ThompsonSampling>>,
}

impl ThompsonSamplingRouter {
    /// Create new Thompson Sampling router with provider list
    pub fn new(providers: Vec<String>, _exploration_rate: f64) -> Self {
        let config = ThompsonSamplingConfig {
            arms: providers.clone(),
            success_threshold: 0.6,
            initial_alpha: 1.0,
            initial_beta: 1.0,
            reward_policy: RewardPolicy::default(),
        };

        let optimizer = ThompsonSampling::new(config);

        info!(
            "Thompson Sampling initialized with {} providers",
            providers.len()
        );

        Self {
            optimizer: Arc::new(RwLock::new(optimizer)),
        }
    }

    /// Select best provider using Thompson Sampling (Beta distribution sampling)
    pub async fn select_provider(&self) -> anyhow::Result<String> {
        let optimizer = self.optimizer.read().await;
        let provider_id = optimizer.select_action();

        if provider_id.is_empty() {
            anyhow::bail!("No providers available");
        }

        debug!("Thompson Sampling selected provider {}", provider_id);

        Ok(provider_id)
    }

    /// Update optimizer with reward metrics after provider response
    pub async fn update_reward(
        &self,
        provider_id: &str,
        latency_ms: f64,
        success: bool,
        cost_usd: f64,
    ) -> anyhow::Result<()> {
        let metrics = RewardMetrics {
            latency_ms,
            success,
            cache_hit: false,
            cost_usd,
            quality_score: if success { Some(1.0) } else { None },
        };

        let mut optimizer = self.optimizer.write().await;
        optimizer.update(provider_id, &metrics);

        debug!(
            "Thompson Sampling updated: provider={}, success={}",
            provider_id, success
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_thompson_sampling_basic() {
        let providers = vec!["provider1".to_string(), "provider2".to_string()];
        let router = ThompsonSamplingRouter::new(providers, 0.1);

        let result = router.select_provider().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_thompson_sampling_update() {
        let providers = vec!["provider1".to_string(), "provider2".to_string()];
        let router = ThompsonSamplingRouter::new(providers, 0.1);

        let provider = router.select_provider().await.unwrap();
        let result = router.update_reward(&provider, 100.0, true, 0.001).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_thompson_sampling_stats() {
        let providers = vec!["provider1".to_string(), "provider2".to_string()];
        let router = ThompsonSamplingRouter::new(providers.clone(), 0.1);

        // Update with some metrics
        router.update_reward(&providers[0], 100.0, true, 0.001).await.unwrap();
        router.update_reward(&providers[1], 200.0, false, 0.002).await.unwrap();

        let stats = router.get_stats().await;
        assert_eq!(stats.len(), 2);
    }
}
