//! Production Thompson Sampling implementation (pure Rust; no external path deps).
//!
//! This replaces the previous path dependency on `rust-core/rust_kernel` which can
//! drift / fail to compile. We keep the public surface area used by the runtime:
//! - select_provider()
//! - update_reward()
//! - get_stats()
//!
//! Algorithm:
//! - Maintain Beta(\(\alpha,\beta\)) per provider where success increments \(\alpha\),
//!   failure increments \(\beta\).
//! - Select provider by sampling from each Beta and taking argmax.
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThompsonStats {
    pub provider_id: String,
    pub alpha: f64,
    pub beta: f64,
    pub successes: u64,
    pub failures: u64,
}

#[derive(Debug)]
struct ArmState {
    alpha: f64,
    beta: f64,
    successes: u64,
    failures: u64,
}

impl ArmState {
    fn new(initial_alpha: f64, initial_beta: f64) -> Self {
        Self {
            alpha: initial_alpha,
            beta: initial_beta,
            successes: 0,
            failures: 0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ThompsonSamplingConfig {
    pub initial_alpha: f64,
    pub initial_beta: f64,
}

impl Default for ThompsonSamplingConfig {
    fn default() -> Self {
        Self {
            initial_alpha: 1.0,
            initial_beta: 1.0,
        }
    }
}

#[derive(Debug)]
struct ThompsonSampling {
    arms: HashMap<String, ArmState>,
    #[allow(dead_code)]
    cfg: ThompsonSamplingConfig,
}

impl ThompsonSampling {
    fn new(providers: Vec<String>, cfg: ThompsonSamplingConfig) -> Self {
        let mut arms = HashMap::new();
        for p in providers {
            arms.insert(p, ArmState::new(cfg.initial_alpha, cfg.initial_beta));
        }
        Self { arms, cfg }
    }

    fn select_action(&self) -> anyhow::Result<String> {
        if self.arms.is_empty() {
            anyhow::bail!("No providers available");
        }

        let mut rng = rand::thread_rng();
        let mut best: Option<(String, f64)> = None;

        for (provider_id, arm) in &self.arms {
            let sample = sample_beta(&mut rng, arm.alpha, arm.beta)?;
            match &best {
                None => best = Some((provider_id.clone(), sample)),
                Some((_, best_score)) if sample > *best_score => {
                    best = Some((provider_id.clone(), sample))
                }
                _ => {}
            }
        }

        Ok(best.expect("non-empty").0)
    }

    fn update(&mut self, provider_id: &str, success: bool) -> anyhow::Result<()> {
        let arm = self
            .arms
            .get_mut(provider_id)
            .ok_or_else(|| anyhow::anyhow!("Unknown provider_id: {}", provider_id))?;

        if success {
            arm.alpha += 1.0;
            arm.successes += 1;
        } else {
            arm.beta += 1.0;
            arm.failures += 1;
        }

        Ok(())
    }

    fn stats(&self) -> Vec<ThompsonStats> {
        self.arms
            .iter()
            .map(|(id, a)| ThompsonStats {
                provider_id: id.clone(),
                alpha: a.alpha,
                beta: a.beta,
                successes: a.successes,
                failures: a.failures,
            })
            .collect()
    }
}

/// Thompson Sampling router with Beta distribution sampling
pub struct ThompsonSamplingRouter {
    optimizer: Arc<RwLock<ThompsonSampling>>,
}

impl ThompsonSamplingRouter {
    /// Create new Thompson Sampling router with provider list
    pub fn new(providers: Vec<String>, _exploration_rate: f64) -> Self {
        let cfg = ThompsonSamplingConfig::default();
        let optimizer = ThompsonSampling::new(providers.clone(), cfg.clone());

        info!(
            "Thompson Sampling initialized with {} providers (alpha={}, beta={})",
            providers.len(),
            cfg.initial_alpha,
            cfg.initial_beta
        );

        Self {
            optimizer: Arc::new(RwLock::new(optimizer)),
        }
    }

    /// Select best provider using Thompson Sampling (Beta distribution sampling)
    pub async fn select_provider(&self) -> anyhow::Result<String> {
        let optimizer = self.optimizer.read().await;
        let provider_id = optimizer.select_action()?;
        debug!("Thompson Sampling selected provider {}", provider_id);
        Ok(provider_id)
    }

    /// Update optimizer after provider response.
    ///
    /// For Phase 1 this is driven primarily by success/failure; latency/cost can be
    /// incorporated as a future extension (e.g., contextual bandits / reward shaping).
    pub async fn update_reward(
        &self,
        provider_id: &str,
        _latency_ms: f64,
        success: bool,
        _cost_usd: f64,
    ) -> anyhow::Result<()> {
        let mut optimizer = self.optimizer.write().await;
        optimizer.update(provider_id, success)?;
        Ok(())
    }

    /// Get current bandit stats (for debugging/metrics).
    pub async fn get_stats(&self) -> Vec<ThompsonStats> {
        let optimizer = self.optimizer.read().await;
        optimizer.stats()
    }
}

// -------------------------
// Beta sampling primitives
// -------------------------

/// Sample from Beta(alpha, beta) using two Gamma draws.
fn sample_beta<R: Rng + ?Sized>(rng: &mut R, alpha: f64, beta: f64) -> anyhow::Result<f64> {
    if alpha <= 0.0 || beta <= 0.0 {
        anyhow::bail!("Invalid Beta params: alpha={}, beta={}", alpha, beta);
    }
    let x = sample_gamma(rng, alpha)?;
    let y = sample_gamma(rng, beta)?;
    Ok(x / (x + y))
}

/// Sample from Gamma(k, theta=1) using Marsaglia & Tsang (2000).
fn sample_gamma<R: Rng + ?Sized>(rng: &mut R, k: f64) -> anyhow::Result<f64> {
    if k <= 0.0 {
        anyhow::bail!("Invalid Gamma shape: {}", k);
    }

    // Use boosting method for k < 1:
    // Gamma(k) = Gamma(k+1) * U^(1/k)
    if k < 1.0 {
        let u: f64 = rng.gen::<f64>().clamp(f64::MIN_POSITIVE, 1.0);
        return Ok(sample_gamma(rng, k + 1.0)? * u.powf(1.0 / k));
    }

    // Marsaglia & Tsang for k >= 1
    let d = k - 1.0 / 3.0;
    let c = 1.0 / (3.0 * d).sqrt();

    loop {
        // Standard normal via Box-Muller
        let x = sample_standard_normal(rng);
        let v = 1.0 + c * x;
        if v <= 0.0 {
            continue;
        }
        let v3 = v * v * v;
        let u: f64 = rng.gen::<f64>().clamp(f64::MIN_POSITIVE, 1.0);

        // Squeeze test
        if u < 1.0 - 0.0331 * x * x * x * x {
            return Ok(d * v3);
        }

        if u.ln() < 0.5 * x * x + d * (1.0 - v3 + v3.ln()) {
            return Ok(d * v3);
        }
    }
}

fn sample_standard_normal<R: Rng + ?Sized>(rng: &mut R) -> f64 {
    // Box-Muller transform
    let u1: f64 = rng.gen::<f64>().clamp(f64::MIN_POSITIVE, 1.0);
    let u2: f64 = rng.gen::<f64>().clamp(f64::MIN_POSITIVE, 1.0);
    (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
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
        router
            .update_reward(&providers[0], 100.0, true, 0.001)
            .await
            .unwrap();
        router
            .update_reward(&providers[1], 200.0, false, 0.002)
            .await
            .unwrap();

        let stats = router.get_stats().await;
        assert_eq!(stats.len(), 2);
    }
}
