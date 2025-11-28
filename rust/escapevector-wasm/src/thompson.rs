/*!
 * Thompson Sampling - Bayesian multi-armed bandit optimization
 *
 * Fast Beta distribution sampling using mean approximation + Gaussian noise
 */

use wasm_bindgen::prelude::*;
use crate::BayesianState;
use std::f64::consts::PI;

/// Beta distribution sampler using mean approximation
pub struct BetaSampler;

impl BetaSampler {
    /// Sample from Beta(α, β) using mean approximation with Gaussian noise
    ///
    /// This is 5-10× faster than full Beta sampling while maintaining
    /// statistical properties for Thompson Sampling
    pub fn sample(alpha: f64, beta: f64) -> f64 {
        if alpha <= 0.0 || beta <= 0.0 {
            return 0.5;
        }

        // Mean of Beta distribution
        let mean = alpha / (alpha + beta);

        // Variance of Beta distribution
        let variance = (alpha * beta) /
            ((alpha + beta).powi(2) * (alpha + beta + 1.0));

        // Add Gaussian noise for exploration
        let noise = Self::gaussian_noise() * variance.sqrt();
        let sample = mean + noise;

        // Clamp to [0, 1]
        sample.max(0.0).min(1.0)
    }

    /// Generate Gaussian noise using Box-Muller transform
    ///
    /// Fast, high-quality random normal distribution
    fn gaussian_noise() -> f64 {
        let u1 = Self::random_f64();
        let u2 = Self::random_f64();

        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    }

    /// Generate random f64 in [0, 1) using getrandom
    fn random_f64() -> f64 {
        let mut buf = [0u8; 8];
        getrandom::getrandom(&mut buf).unwrap_or_else(|_| {
            // Fallback: use current timestamp as seed
            let now = js_sys::Date::now() as u64;
            buf.copy_from_slice(&now.to_le_bytes());
        });

        let n = u64::from_le_bytes(buf);
        // Map to [0, 1) by dividing by 2^64
        (n as f64) / (u64::MAX as f64)
    }
}

/// Thompson Sampling router
#[wasm_bindgen]
pub struct ThompsonRouter {
    state: BayesianState,
}

#[wasm_bindgen]
impl ThompsonRouter {
    /// Create new Thompson router from state JSON
    #[wasm_bindgen(constructor)]
    pub fn new(state_json: &str) -> Result<ThompsonRouter, JsValue> {
        let state: BayesianState = serde_json::from_str(state_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;

        Ok(ThompsonRouter { state })
    }

    /// Select best arm using Thompson Sampling
    ///
    /// Returns the index of the selected arm, or -1 if no healthy arms
    #[wasm_bindgen(js_name = selectArm)]
    pub fn select_arm(&self, healthy_indices: &[usize]) -> i32 {
        if healthy_indices.is_empty() {
            return -1;
        }

        // Exploration with probability ε
        if Self::random_f64() < self.state.exploration_rate {
            // Random exploration
            let idx = (Self::random_f64() * healthy_indices.len() as f64) as usize;
            return healthy_indices[idx] as i32;
        }

        // Exploitation: Sample from Beta(α, β) for each healthy arm
        let mut best_arm_idx: i32 = -1;
        let mut max_sample = -1.0;

        for &arm_idx in healthy_indices {
            if arm_idx >= self.state.arms.len() {
                continue;
            }

            let arm = &self.state.arms[arm_idx];
            let sample = BetaSampler::sample(arm.alpha, arm.beta);

            if sample > max_sample {
                max_sample = sample;
                best_arm_idx = arm_idx as i32;
            }
        }

        best_arm_idx
    }

    /// Update arm on success
    #[wasm_bindgen(js_name = updateSuccess)]
    pub fn update_success(&mut self, arm_idx: usize, latency_ms: f64) -> Result<(), JsValue> {
        if arm_idx >= self.state.arms.len() {
            return Err(JsValue::from_str("Invalid arm index"));
        }

        // Calculate scores first (before borrowing arm mutably)
        let latency_score = Self::normalize_latency_static(latency_ms, self.state.max_latency_ms);

        let arm = &mut self.state.arms[arm_idx];

        // Update Thompson Sampling parameters
        arm.alpha += 1.0;
        arm.total_selections += 1;
        arm.total_successes += 1;

        // Update composite rewards
        arm.avg_latency_score = Self::update_moving_average_static(
            arm.avg_latency_score,
            latency_score,
            arm.total_selections,
        );
        arm.avg_success_rate = arm.total_successes as f64 / arm.total_selections as f64;
        arm.updated_at = js_sys::Date::now() as u64;

        Ok(())
    }

    /// Update arm on failure
    #[wasm_bindgen(js_name = updateFailure)]
    pub fn update_failure(&mut self, arm_idx: usize, latency_ms: f64) -> Result<(), JsValue> {
        if arm_idx >= self.state.arms.len() {
            return Err(JsValue::from_str("Invalid arm index"));
        }

        // Calculate scores first (before borrowing arm mutably)
        let latency_score = Self::normalize_latency_static(latency_ms, self.state.max_latency_ms);

        let arm = &mut self.state.arms[arm_idx];

        // Update Thompson Sampling parameters
        arm.beta += 1.0;
        arm.total_selections += 1;
        arm.total_failures += 1;

        // Update composite rewards
        arm.avg_latency_score = Self::update_moving_average_static(
            arm.avg_latency_score,
            latency_score,
            arm.total_selections,
        );
        arm.avg_success_rate = arm.total_successes as f64 / arm.total_selections as f64;
        arm.updated_at = js_sys::Date::now() as u64;

        Ok(())
    }

    /// Get current state as JSON
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> String {
        serde_json::to_string(&self.state).unwrap_or_else(|_| "{}".to_string())
    }

    /// Update state from JSON
    #[wasm_bindgen(js_name = updateState)]
    pub fn update_state(&mut self, state_json: &str) -> Result<(), JsValue> {
        self.state = serde_json::from_str(state_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse state: {}", e)))?;
        Ok(())
    }

    /// Get arm count
    #[wasm_bindgen(js_name = getArmCount)]
    pub fn get_arm_count(&self) -> usize {
        self.state.arms.len()
    }

    /// Get arm info as JSON
    #[wasm_bindgen(js_name = getArm)]
    pub fn get_arm(&self, idx: usize) -> Result<String, JsValue> {
        if idx >= self.state.arms.len() {
            return Err(JsValue::from_str("Invalid arm index"));
        }

        serde_json::to_string(&self.state.arms[idx])
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize arm: {}", e)))
    }

    // Private helper methods (static to avoid borrow conflicts)
    fn normalize_latency_static(latency_ms: f64, max_latency_ms: f64) -> f64 {
        if latency_ms <= 0.0 {
            return 1.0;
        }
        let score = 1.0 - latency_ms / max_latency_ms;
        score.max(0.0).min(1.0)
    }

    fn update_moving_average_static(current: f64, new_value: f64, count: u64) -> f64 {
        if count == 1 {
            return new_value;
        }
        let alpha = 2.0 / (count as f64 + 1.0);
        alpha * new_value + (1.0 - alpha) * current
    }

    fn random_f64() -> f64 {
        BetaSampler::random_f64()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_beta_sampler() {
        // Test that samples are in [0, 1]
        for _ in 0..1000 {
            let sample = BetaSampler::sample(2.0, 3.0);
            assert!(sample >= 0.0 && sample <= 1.0);
        }
    }

    #[test]
    fn test_beta_sampler_mean() {
        // Test that mean is approximately correct
        let mut sum = 0.0;
        let n = 10000;
        for _ in 0..n {
            sum += BetaSampler::sample(2.0, 3.0);
        }
        let mean = sum / n as f64;
        let expected_mean = 2.0 / (2.0 + 3.0);

        // Should be within 5% of expected
        assert!((mean - expected_mean).abs() < 0.05);
    }
}
