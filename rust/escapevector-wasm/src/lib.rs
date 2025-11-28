/*!
 * EscapeVector WASM - Rust-powered Thompson Sampling for unkillable AI routing
 *
 * Target: <180 KB gzipped, 3-5× faster than TypeScript
 * Features: Thompson Sampling, Beta distribution, Circuit breakers, AES-GCM encryption
 */

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

mod crypto;
mod thompson;
mod circuit_breaker;

pub use crypto::*;
pub use thompson::*;
pub use circuit_breaker::*;

/// Initialize WASM module (called once on load)
#[wasm_bindgen(start)]
pub fn init() {
    // Set panic hook for better error messages in development
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Bandit arm representing a provider with Thompson Sampling parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct BanditArm {
    #[wasm_bindgen(skip)]
    pub provider_id: String,
    #[wasm_bindgen(skip)]
    pub name: String,
    #[wasm_bindgen(skip)]
    pub endpoint: String,
    #[wasm_bindgen(skip)]
    pub api_key: Option<String>,

    // Thompson Sampling parameters
    #[wasm_bindgen(skip)]
    pub alpha: f64,
    #[wasm_bindgen(skip)]
    pub beta: f64,

    // Performance tracking
    #[wasm_bindgen(skip)]
    pub total_selections: u64,
    #[wasm_bindgen(skip)]
    pub total_successes: u64,
    #[wasm_bindgen(skip)]
    pub total_failures: u64,

    // Composite reward components (0-1 normalized)
    #[wasm_bindgen(skip)]
    pub avg_latency_score: f64,
    #[wasm_bindgen(skip)]
    pub avg_cost_efficiency: f64,
    #[wasm_bindgen(skip)]
    pub avg_success_rate: f64,

    // Reward weights
    #[wasm_bindgen(skip)]
    pub weight_latency: f64,
    #[wasm_bindgen(skip)]
    pub weight_cost: f64,
    #[wasm_bindgen(skip)]
    pub weight_success: f64,

    #[wasm_bindgen(skip)]
    pub updated_at: u64,
}

/// Complete Bayesian state for Thompson Sampling
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct BayesianState {
    #[wasm_bindgen(skip)]
    pub version: u32,
    #[wasm_bindgen(skip)]
    pub timestamp: u64,
    #[wasm_bindgen(skip)]
    pub arms: Vec<BanditArm>,

    // Configuration
    #[wasm_bindgen(skip)]
    pub exploration_rate: f64,
    #[wasm_bindgen(skip)]
    pub circuit_breaker_threshold: i32,
    #[wasm_bindgen(skip)]
    pub timeout_ms: u64,
    #[wasm_bindgen(skip)]
    pub max_retries: u32,
    #[wasm_bindgen(skip)]
    pub speculative_execution: bool,

    // Normalization parameters
    #[wasm_bindgen(skip)]
    pub max_latency_ms: f64,
    #[wasm_bindgen(skip)]
    pub max_cost_usd: f64,
}

#[wasm_bindgen]
impl BayesianState {
    /// Create a new BayesianState from JSON
    #[wasm_bindgen(constructor)]
    pub fn from_json(json: &str) -> Result<BayesianState, JsValue> {
        serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse JSON: {}", e)))
    }

    /// Convert BayesianState to JSON
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(self)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
    }

    /// Get default Bayesian state for Gold Code Override
    #[wasm_bindgen(js_name = getDefault)]
    pub fn get_default() -> BayesianState {
        let now = js_sys::Date::now() as u64;

        BayesianState {
            version: 0,
            timestamp: now,
            arms: vec![
                BanditArm {
                    provider_id: "openai".to_string(),
                    name: "openai".to_string(),
                    endpoint: "https://api.openai.com/v1".to_string(),
                    api_key: None,
                    alpha: 1.0,
                    beta: 1.0,
                    total_selections: 0,
                    total_successes: 0,
                    total_failures: 0,
                    avg_latency_score: 0.0,
                    avg_cost_efficiency: 0.0,
                    avg_success_rate: 0.0,
                    weight_latency: 0.33,
                    weight_cost: 0.33,
                    weight_success: 0.34,
                    updated_at: now,
                },
                BanditArm {
                    provider_id: "anthropic".to_string(),
                    name: "anthropic".to_string(),
                    endpoint: "https://api.anthropic.com/v1".to_string(),
                    api_key: None,
                    alpha: 1.0,
                    beta: 1.0,
                    total_selections: 0,
                    total_successes: 0,
                    total_failures: 0,
                    avg_latency_score: 0.0,
                    avg_cost_efficiency: 0.0,
                    avg_success_rate: 0.0,
                    weight_latency: 0.33,
                    weight_cost: 0.33,
                    weight_success: 0.34,
                    updated_at: now,
                },
                BanditArm {
                    provider_id: "google".to_string(),
                    name: "google".to_string(),
                    endpoint: "https://generativelanguage.googleapis.com/v1".to_string(),
                    api_key: None,
                    alpha: 1.0,
                    beta: 1.0,
                    total_selections: 0,
                    total_successes: 0,
                    total_failures: 0,
                    avg_latency_score: 0.0,
                    avg_cost_efficiency: 0.0,
                    avg_success_rate: 0.0,
                    weight_latency: 0.33,
                    weight_cost: 0.33,
                    weight_success: 0.34,
                    updated_at: now,
                },
            ],
            exploration_rate: 0.1,
            circuit_breaker_threshold: 5,
            timeout_ms: 10000,
            max_retries: 2,
            speculative_execution: false,
            max_latency_ms: 5000.0,
            max_cost_usd: 1.0,
        }
    }
}

/// Version string for verification
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get WASM module size (for testing <180KB constraint)
#[wasm_bindgen]
pub fn module_name() -> String {
    "escapevector-wasm".to_string()
}
