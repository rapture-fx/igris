/*!
 * Circuit Breaker - Provider health tracking with atomic operations
 *
 * Reuses P0-7 atomic pattern from main Go implementation
 */

use wasm_bindgen::prelude::*;
use std::sync::atomic::{AtomicI32, AtomicBool, Ordering};

/// Circuit breaker for tracking provider health
#[wasm_bindgen]
pub struct CircuitBreaker {
    failures: AtomicI32,
    threshold: i32,
    is_open: AtomicBool,
    last_opened: AtomicI32, // Timestamp in seconds
}

#[wasm_bindgen]
impl CircuitBreaker {
    /// Create a new circuit breaker with given threshold
    #[wasm_bindgen(constructor)]
    pub fn new(threshold: i32) -> CircuitBreaker {
        CircuitBreaker {
            failures: AtomicI32::new(0),
            threshold,
            is_open: AtomicBool::new(false),
            last_opened: AtomicI32::new(0),
        }
    }

    /// Record a successful request (resets circuit breaker)
    #[wasm_bindgen(js_name = recordSuccess)]
    pub fn record_success(&self) {
        self.failures.store(0, Ordering::Relaxed);
        self.is_open.store(false, Ordering::Relaxed);
    }

    /// Record a failed request (may open circuit breaker)
    #[wasm_bindgen(js_name = recordFailure)]
    pub fn record_failure(&self) {
        let failures = self.failures.fetch_add(1, Ordering::SeqCst) + 1;

        if failures >= self.threshold {
            self.is_open.store(true, Ordering::SeqCst);

            // Store current timestamp in seconds
            let now = (js_sys::Date::now() / 1000.0) as i32;
            self.last_opened.store(now, Ordering::Relaxed);
        }
    }

    /// Check if circuit breaker is open (provider unhealthy)
    ///
    /// Auto-resets after 30 seconds
    #[wasm_bindgen(js_name = isOpen)]
    pub fn is_open(&self) -> bool {
        if !self.is_open.load(Ordering::Relaxed) {
            return false;
        }

        // Auto-reset after 30 seconds
        let now = (js_sys::Date::now() / 1000.0) as i32;
        let last_opened = self.last_opened.load(Ordering::Relaxed);

        if now - last_opened > 30 {
            // Reset circuit breaker
            self.is_open.store(false, Ordering::SeqCst);
            self.failures.store(0, Ordering::Relaxed);
            return false;
        }

        true
    }

    /// Get current failure count
    #[wasm_bindgen(js_name = getFailures)]
    pub fn get_failures(&self) -> i32 {
        self.failures.load(Ordering::Relaxed)
    }

    /// Reset circuit breaker
    #[wasm_bindgen(js_name = reset)]
    pub fn reset(&self) {
        self.failures.store(0, Ordering::Relaxed);
        self.is_open.store(false, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_breaker_opens() {
        let cb = CircuitBreaker::new(3);

        assert!(!cb.is_open());

        cb.record_failure();
        cb.record_failure();
        assert!(!cb.is_open());

        cb.record_failure();
        assert!(cb.is_open());
    }

    #[test]
    fn test_circuit_breaker_resets_on_success() {
        let cb = CircuitBreaker::new(3);

        cb.record_failure();
        cb.record_failure();
        cb.record_success();

        assert!(!cb.is_open());
        assert_eq!(cb.get_failures(), 0);
    }
}
