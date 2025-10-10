//! Prefetch Throttling and Backpressure Control
//!
//! Implements safety controls to prevent prefetch overload:
//! - Token bucket rate limiting
//! - Mempool pressure monitoring
//! - Circuit breaker integration
//! - Global kill-switch
//!
//! Key safety invariants:
//! - Never prefetch when mempool < 10% free
//! - Never exceed configured max_prefetch_qps
//! - Honor circuit breaker states
//! - Immediate stop on kill-switch

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use parking_lot::RwLock;

/// Configuration for prefetch throttling
#[derive(Debug, Clone)]
pub struct ThrottleConfig {
    /// Maximum prefetch requests per second
    pub max_prefetch_qps: u64,

    /// Minimum mempool free percentage (0-100)
    pub min_mempool_free_percent: u8,

    /// Enable mempool backpressure
    pub enable_mempool_backpressure: bool,

    /// Enable circuit breaker integration
    pub enable_circuit_breaker: bool,

    /// Token bucket refill interval (ms)
    pub refill_interval_ms: u64,

    /// Maximum burst size (tokens)
    pub max_burst: u64,
}

impl Default for ThrottleConfig {
    fn default() -> Self {
        Self {
            max_prefetch_qps: 100, // Conservative default
            min_mempool_free_percent: 10,
            enable_mempool_backpressure: true,
            enable_circuit_breaker: true,
            refill_interval_ms: 100, // 100ms refill
            max_burst: 20, // Allow small bursts
        }
    }
}

/// Token bucket implementation for rate limiting
struct TokenBucket {
    /// Current token count
    tokens: RwLock<f64>,

    /// Maximum tokens (burst capacity)
    max_tokens: f64,

    /// Tokens added per refill
    refill_rate: f64,

    /// Last refill timestamp
    last_refill: RwLock<Instant>,

    /// Refill interval
    refill_interval: Duration,
}

impl TokenBucket {
    fn new(qps: u64, burst: u64, refill_interval_ms: u64) -> Self {
        let refill_interval = Duration::from_millis(refill_interval_ms);
        let refill_rate = (qps as f64 * refill_interval.as_secs_f64()).max(1.0);

        Self {
            tokens: RwLock::new(burst as f64),
            max_tokens: burst as f64,
            refill_rate,
            last_refill: RwLock::new(Instant::now()),
            refill_interval,
        }
    }

    /// Try to consume a token, returns true if successful
    fn try_consume(&self) -> bool {
        self.refill();

        let mut tokens = self.tokens.write();
        if *tokens >= 1.0 {
            *tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Try to consume N tokens
    fn try_consume_many(&self, count: u64) -> bool {
        self.refill();

        let mut tokens = self.tokens.write();
        let required = count as f64;
        if *tokens >= required {
            *tokens -= required;
            true
        } else {
            false
        }
    }

    /// Refill tokens based on elapsed time
    fn refill(&self) {
        let mut last_refill = self.last_refill.write();
        let now = Instant::now();
        let elapsed = now.duration_since(*last_refill);

        if elapsed >= self.refill_interval {
            let intervals = elapsed.as_secs_f64() / self.refill_interval.as_secs_f64();
            let new_tokens = self.refill_rate * intervals;

            let mut tokens = self.tokens.write();
            *tokens = (*tokens + new_tokens).min(self.max_tokens);

            *last_refill = now;
        }
    }

    fn available_tokens(&self) -> u64 {
        self.refill();
        self.tokens.read().floor() as u64
    }
}

/// Prefetch throttler with multiple safety mechanisms
pub struct PrefetchThrottler {
    config: ThrottleConfig,

    /// Token bucket for rate limiting
    token_bucket: Arc<TokenBucket>,

    /// Global kill-switch (default: enabled)
    enabled: AtomicBool,

    /// Circuit breaker state (open = block prefetch)
    circuit_breaker_open: AtomicBool,

    /// Total requests attempted
    total_requests: AtomicU64,

    /// Requests allowed
    requests_allowed: AtomicU64,

    /// Requests blocked (rate limit)
    requests_blocked_rate: AtomicU64,

    /// Requests blocked (mempool pressure)
    requests_blocked_mempool: AtomicU64,

    /// Requests blocked (circuit breaker)
    requests_blocked_circuit: AtomicU64,

    /// Requests blocked (kill-switch)
    requests_blocked_disabled: AtomicU64,
}

impl PrefetchThrottler {
    /// Create a new prefetch throttler
    pub fn new(config: ThrottleConfig) -> Self {
        let token_bucket = Arc::new(TokenBucket::new(
            config.max_prefetch_qps,
            config.max_burst,
            config.refill_interval_ms,
        ));

        Self {
            token_bucket,
            config,
            enabled: AtomicBool::new(true), // Enabled by default
            circuit_breaker_open: AtomicBool::new(false),
            total_requests: AtomicU64::new(0),
            requests_allowed: AtomicU64::new(0),
            requests_blocked_rate: AtomicU64::new(0),
            requests_blocked_mempool: AtomicU64::new(0),
            requests_blocked_circuit: AtomicU64::new(0),
            requests_blocked_disabled: AtomicU64::new(0),
        }
    }

    /// Check if a prefetch request should be allowed
    pub fn should_allow(&self, mempool_free_percent: u8) -> bool {
        self.total_requests.fetch_add(1, Ordering::Relaxed);

        // Check 1: Kill-switch
        if !self.enabled.load(Ordering::Relaxed) {
            self.requests_blocked_disabled.fetch_add(1, Ordering::Relaxed);
            return false;
        }

        // Check 2: Circuit breaker
        if self.config.enable_circuit_breaker && self.circuit_breaker_open.load(Ordering::Relaxed) {
            self.requests_blocked_circuit.fetch_add(1, Ordering::Relaxed);
            return false;
        }

        // Check 3: Mempool pressure
        if self.config.enable_mempool_backpressure && mempool_free_percent < self.config.min_mempool_free_percent {
            self.requests_blocked_mempool.fetch_add(1, Ordering::Relaxed);
            return false;
        }

        // Check 4: Rate limit (token bucket)
        if !self.token_bucket.try_consume() {
            self.requests_blocked_rate.fetch_add(1, Ordering::Relaxed);
            return false;
        }

        self.requests_allowed.fetch_add(1, Ordering::Relaxed);
        true
    }

    /// Try to allow multiple prefetch requests
    pub fn should_allow_batch(&self, count: u64, mempool_free_percent: u8) -> bool {
        self.total_requests.fetch_add(count, Ordering::Relaxed);

        // Same checks as single request
        if !self.enabled.load(Ordering::Relaxed) {
            self.requests_blocked_disabled.fetch_add(count, Ordering::Relaxed);
            return false;
        }

        if self.config.enable_circuit_breaker && self.circuit_breaker_open.load(Ordering::Relaxed) {
            self.requests_blocked_circuit.fetch_add(count, Ordering::Relaxed);
            return false;
        }

        if self.config.enable_mempool_backpressure && mempool_free_percent < self.config.min_mempool_free_percent {
            self.requests_blocked_mempool.fetch_add(count, Ordering::Relaxed);
            return false;
        }

        if !self.token_bucket.try_consume_many(count) {
            self.requests_blocked_rate.fetch_add(count, Ordering::Relaxed);
            return false;
        }

        self.requests_allowed.fetch_add(count, Ordering::Relaxed);
        true
    }

    /// Enable prefetching (clear kill-switch)
    pub fn enable(&self) {
        self.enabled.store(true, Ordering::Relaxed);
    }

    /// Disable prefetching (activate kill-switch)
    pub fn disable(&self) {
        self.enabled.store(false, Ordering::Relaxed);
    }

    /// Check if prefetching is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }

    /// Update circuit breaker state
    pub fn set_circuit_breaker_open(&self, open: bool) {
        self.circuit_breaker_open.store(open, Ordering::Relaxed);
    }

    /// Get current throttle statistics
    pub fn get_stats(&self) -> ThrottleStats {
        let total = self.total_requests.load(Ordering::Relaxed);
        let allowed = self.requests_allowed.load(Ordering::Relaxed);
        let allowed_rate = if total > 0 {
            (allowed as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        ThrottleStats {
            total_requests: total,
            requests_allowed: allowed,
            requests_blocked_rate: self.requests_blocked_rate.load(Ordering::Relaxed),
            requests_blocked_mempool: self.requests_blocked_mempool.load(Ordering::Relaxed),
            requests_blocked_circuit: self.requests_blocked_circuit.load(Ordering::Relaxed),
            requests_blocked_disabled: self.requests_blocked_disabled.load(Ordering::Relaxed),
            allowed_rate_percent: allowed_rate,
            available_tokens: self.token_bucket.available_tokens(),
            enabled: self.enabled.load(Ordering::Relaxed),
        }
    }

    /// Reset statistics (for testing/monitoring)
    pub fn reset_stats(&self) {
        self.total_requests.store(0, Ordering::Relaxed);
        self.requests_allowed.store(0, Ordering::Relaxed);
        self.requests_blocked_rate.store(0, Ordering::Relaxed);
        self.requests_blocked_mempool.store(0, Ordering::Relaxed);
        self.requests_blocked_circuit.store(0, Ordering::Relaxed);
        self.requests_blocked_disabled.store(0, Ordering::Relaxed);
    }
}

/// Throttle performance statistics
#[derive(Debug, Clone)]
pub struct ThrottleStats {
    pub total_requests: u64,
    pub requests_allowed: u64,
    pub requests_blocked_rate: u64,
    pub requests_blocked_mempool: u64,
    pub requests_blocked_circuit: u64,
    pub requests_blocked_disabled: u64,
    pub allowed_rate_percent: f64,
    pub available_tokens: u64,
    pub enabled: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn test_rate_limiting() {
        let config = ThrottleConfig {
            max_prefetch_qps: 10,
            max_burst: 5,
            refill_interval_ms: 100,
            ..Default::default()
        };
        let throttler = PrefetchThrottler::new(config);

        // Should allow burst
        for _ in 0..5 {
            assert!(throttler.should_allow(50));
        }

        // Should block after burst exhausted
        assert!(!throttler.should_allow(50));

        // Wait for refill
        sleep(Duration::from_millis(150));

        // Should allow again
        assert!(throttler.should_allow(50));
    }

    #[test]
    fn test_mempool_backpressure() {
        let throttler = PrefetchThrottler::new(ThrottleConfig::default());

        // Should allow with healthy mempool
        assert!(throttler.should_allow(50));

        // Should block with low mempool
        assert!(!throttler.should_allow(5));

        let stats = throttler.get_stats();
        assert_eq!(stats.requests_blocked_mempool, 1);
    }

    #[test]
    fn test_kill_switch() {
        let throttler = PrefetchThrottler::new(ThrottleConfig::default());

        assert!(throttler.is_enabled());
        assert!(throttler.should_allow(50));

        throttler.disable();
        assert!(!throttler.is_enabled());
        assert!(!throttler.should_allow(50));

        throttler.enable();
        assert!(throttler.is_enabled());
        assert!(throttler.should_allow(50));
    }

    #[test]
    fn test_circuit_breaker_integration() {
        let throttler = PrefetchThrottler::new(ThrottleConfig::default());

        assert!(throttler.should_allow(50));

        throttler.set_circuit_breaker_open(true);
        assert!(!throttler.should_allow(50));

        let stats = throttler.get_stats();
        assert_eq!(stats.requests_blocked_circuit, 1);

        throttler.set_circuit_breaker_open(false);
        assert!(throttler.should_allow(50));
    }

    #[test]
    fn test_batch_throttling() {
        let config = ThrottleConfig {
            max_prefetch_qps: 20,
            max_burst: 10,
            ..Default::default()
        };
        let throttler = PrefetchThrottler::new(config);

        assert!(throttler.should_allow_batch(5, 50));
        assert!(throttler.should_allow_batch(5, 50));
        assert!(!throttler.should_allow_batch(5, 50)); // Exceeded burst

        let stats = throttler.get_stats();
        assert_eq!(stats.requests_allowed, 10);
    }
}
