//! Prefetch Runner - Production Execution Engine
//!
//! Coordinates the entire prefetch pipeline:
//! 1. Telemetry collector tracks access patterns
//! 2. Predictor scores keys for prefetching
//! 3. Throttler applies safety controls
//! 4. Runner executes async prefetch into cache
//!
//! Integrates with mempool zero-copy buffers and cache adapter.

use crate::cache::CacheAdapter;
use crate::mempool::SlabAllocator;
use bytes::Bytes;
use crate::prefetch::{
    AccessPredictor, PrefetchThrottler, TelemetryCollector,
    config::PrefetchConfig,
    predictor::PredictorConfig as PredictorCfg,
    telemetry::TelemetryConfig as TelemetryCfg,
    throttler::ThrottleConfig as ThrottlerCfg,
};

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{mpsc, RwLock as TokioRwLock, Semaphore};
use parking_lot::RwLock;

/// Request to prefetch a specific key
#[derive(Debug, Clone)]
pub struct PrefetchRequest {
    /// Key to prefetch
    pub key: String,

    /// Expected value (for testing/validation)
    pub expected_value: Option<Vec<u8>>,

    /// Priority (for future use)
    pub priority: u8,
}

/// Statistics for prefetch runner
#[derive(Debug, Clone)]
pub struct PrefetchStats {
    pub total_predictions: u64,
    pub prefetches_initiated: u64,
    pub prefetches_completed: u64,
    pub prefetches_failed: u64,
    pub prefetches_skipped_throttle: u64,
    pub prefetches_skipped_lowconf: u64,
    pub cache_hit_rate_percent: f64,
    pub avg_prefetch_latency_ms: f64,
    pub queue_depth: usize,
}

/// Production prefetch runner
pub struct PrefetchRunner {
    /// Configuration
    config: Arc<RwLock<PrefetchConfig>>,

    /// Telemetry collector
    telemetry: Arc<TelemetryCollector>,

    /// Access predictor
    predictor: Arc<AccessPredictor>,

    /// Throttler
    throttler: Arc<PrefetchThrottler>,

    /// Cache adapter
    cache: Arc<CacheAdapter>,

    /// Mempool allocator (for pressure monitoring)
    mempool: Option<Arc<SlabAllocator<Bytes>>>,

    /// Prefetch queue
    prefetch_tx: mpsc::Sender<PrefetchRequest>,

    /// Concurrency limiter
    semaphore: Arc<Semaphore>,

    /// Statistics
    stats: Arc<PrefetchRunnerStats>,
}

/// Internal statistics tracking
struct PrefetchRunnerStats {
    total_predictions: AtomicU64,
    prefetches_initiated: AtomicU64,
    prefetches_completed: AtomicU64,
    prefetches_failed: AtomicU64,
    prefetches_skipped_throttle: AtomicU64,
    prefetches_skipped_lowconf: AtomicU64,
    total_latency_ms: AtomicU64,
    queue_depth: Arc<TokioRwLock<usize>>,
}

impl PrefetchRunnerStats {
    fn new() -> Self {
        Self {
            total_predictions: AtomicU64::new(0),
            prefetches_initiated: AtomicU64::new(0),
            prefetches_completed: AtomicU64::new(0),
            prefetches_failed: AtomicU64::new(0),
            prefetches_skipped_throttle: AtomicU64::new(0),
            prefetches_skipped_lowconf: AtomicU64::new(0),
            total_latency_ms: AtomicU64::new(0),
            queue_depth: Arc::new(TokioRwLock::new(0)),
        }
    }
}

impl PrefetchRunner {
    /// Create a new prefetch runner
    pub fn new(config: PrefetchConfig, cache: Arc<CacheAdapter>) -> Self {
        let config_arc = Arc::new(RwLock::new(config.clone()));

        // Initialize components
        let telemetry_cfg = TelemetryCfg {
            window_duration_secs: config.telemetry.window_duration_secs,
            sample_rate: config.feature_flags.telemetry_sample_rate,
            max_tracked_keys: config.telemetry.max_tracked_keys,
            ttl_decay_factor: config.telemetry.ttl_decay_factor,
            min_access_threshold: config.telemetry.min_access_threshold,
        };
        let telemetry = Arc::new(TelemetryCollector::new(telemetry_cfg));

        let predictor_cfg = PredictorCfg {
            confidence_threshold: config.predictor.confidence_threshold,
            feature_weights: Default::default(),
            enable_sequential_boost: config.predictor.enable_sequential_boost,
            sequential_boost_factor: config.predictor.sequential_boost_factor,
            model_update_interval: config.predictor.model_update_interval,
        };
        let predictor = Arc::new(AccessPredictor::new(predictor_cfg));

        let throttler_cfg = ThrottlerCfg {
            max_prefetch_qps: config.throttler.max_prefetch_qps,
            min_mempool_free_percent: config.throttler.min_mempool_free_percent,
            enable_mempool_backpressure: config.feature_flags.enable_backpressure,
            enable_circuit_breaker: true,
            refill_interval_ms: config.throttler.refill_interval_ms,
            max_burst: config.throttler.max_burst,
        };
        let throttler = Arc::new(PrefetchThrottler::new(throttler_cfg));

        let (prefetch_tx, prefetch_rx) = mpsc::channel(config.runner.queue_size);
        let semaphore = Arc::new(Semaphore::new(config.runner.max_concurrent_prefetches));

        let runner = Self {
            config: config_arc,
            telemetry,
            predictor,
            throttler,
            cache,
            mempool: None,
            prefetch_tx,
            semaphore,
            stats: Arc::new(PrefetchRunnerStats::new()),
        };

        // Start worker tasks
        runner.spawn_workers(prefetch_rx);

        runner
    }

    /// Attach mempool for pressure monitoring
    pub fn with_mempool(mut self, mempool: Arc<SlabAllocator<Bytes>>) -> Self {
        self.mempool = Some(mempool);
        self
    }

    /// Record a cache access (feeds telemetry)
    pub fn record_access(&self, key: String) {
        if !self.config.read().feature_flags.enable_telemetry {
            return;
        }

        self.telemetry.record_access(key.clone());

        // Trigger prefetch prediction periodically
        let predictions = self.stats.total_predictions.load(Ordering::Relaxed);
        if predictions % 100 == 0 {
            self.maybe_trigger_prefetch();
        }
    }

    /// Manually trigger prefetch for a specific key
    pub async fn prefetch_key(&self, key: String) -> Result<(), String> {
        let request = PrefetchRequest {
            key,
            expected_value: None,
            priority: 5,
        };

        self.prefetch_tx
            .send(request)
            .await
            .map_err(|e| format!("Prefetch queue full: {}", e))
    }

    /// Get runner statistics
    pub async fn get_stats(&self) -> PrefetchStats {
        let completed = self.stats.prefetches_completed.load(Ordering::Relaxed);
        let total_latency = self.stats.total_latency_ms.load(Ordering::Relaxed);
        let avg_latency = if completed > 0 {
            total_latency as f64 / completed as f64
        } else {
            0.0
        };

        // Calculate cache hit rate
        let cache_stats = self.cache.stats();
        let total_requests = cache_stats.hits + cache_stats.misses;
        let cache_hit_rate = if total_requests > 0 {
            (cache_stats.hits as f64 / total_requests as f64) * 100.0
        } else {
            0.0
        };

        PrefetchStats {
            total_predictions: self.stats.total_predictions.load(Ordering::Relaxed),
            prefetches_initiated: self.stats.prefetches_initiated.load(Ordering::Relaxed),
            prefetches_completed: completed,
            prefetches_failed: self.stats.prefetches_failed.load(Ordering::Relaxed),
            prefetches_skipped_throttle: self.stats.prefetches_skipped_throttle.load(Ordering::Relaxed),
            prefetches_skipped_lowconf: self.stats.prefetches_skipped_lowconf.load(Ordering::Relaxed),
            cache_hit_rate_percent: cache_hit_rate,
            avg_prefetch_latency_ms: avg_latency,
            queue_depth: *self.stats.queue_depth.read().await,
        }
    }

    /// Update runtime configuration
    pub fn update_config(&self, new_config: PrefetchConfig) {
        *self.config.write() = new_config;
    }

    /// Enable/disable prefetching via kill-switch
    pub fn set_enabled(&self, enabled: bool) {
        if enabled {
            self.throttler.enable();
        } else {
            self.throttler.disable();
        }
    }

    // ========== Private Methods ==========

    fn maybe_trigger_prefetch(&self) {
        let config = self.config.read();
        if !config.feature_flags.prefetch_enabled || !config.feature_flags.enable_prediction {
            return;
        }
        drop(config);

        // Get top access patterns
        let top_patterns = self.telemetry.get_top_patterns(100);

        self.stats.total_predictions.fetch_add(top_patterns.len() as u64, Ordering::Relaxed);

        // Predict which keys to prefetch
        let predictions = self.predictor.predict_batch(&top_patterns);

        for prediction in predictions {
            if !prediction.should_prefetch {
                self.stats.prefetches_skipped_lowconf.fetch_add(1, Ordering::Relaxed);
                continue;
            }

            // Check throttle
            let mempool_free = self.get_mempool_free_percent();
            if !self.throttler.should_allow(mempool_free) {
                self.stats.prefetches_skipped_throttle.fetch_add(1, Ordering::Relaxed);
                continue;
            }

            // Queue prefetch (non-blocking)
            let request = PrefetchRequest {
                key: prediction.key.clone(),
                expected_value: None,
                priority: 5,
            };

            if self.prefetch_tx.try_send(request).is_ok() {
                self.stats.prefetches_initiated.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    fn spawn_workers(&self, mut prefetch_rx: mpsc::Receiver<PrefetchRequest>) {
        let cache = Arc::clone(&self.cache);
        let semaphore = Arc::clone(&self.semaphore);
        let stats = Arc::clone(&self.stats);
        let queue_depth = Arc::clone(&self.stats.queue_depth);
        let predictor = Arc::clone(&self.predictor);

        tokio::spawn(async move {
            while let Some(request) = prefetch_rx.recv().await {
                *queue_depth.write().await = prefetch_rx.len();

                let permit = semaphore.clone().acquire_owned().await.unwrap();
                let cache = Arc::clone(&cache);
                let stats = Arc::clone(&stats);
                let predictor = Arc::clone(&predictor);

                tokio::spawn(async move {
                    let start = Instant::now();

                    // Perform prefetch
                    let result = Self::execute_prefetch(cache, &request.key).await;

                    let latency_ms = start.elapsed().as_millis() as u64;
                    stats.total_latency_ms.fetch_add(latency_ms, Ordering::Relaxed);

                    match result {
                        Ok(was_cache_hit) => {
                            stats.prefetches_completed.fetch_add(1, Ordering::Relaxed);
                            predictor.record_outcome(&request.key, was_cache_hit);
                        }
                        Err(_) => {
                            stats.prefetches_failed.fetch_add(1, Ordering::Relaxed);
                        }
                    }

                    drop(permit);
                });
            }
        });
    }

    async fn execute_prefetch(cache: Arc<CacheAdapter>, key: &str) -> Result<bool, String> {
        // Check if already in cache
        if cache.get(key).is_some() {
            return Ok(true); // Already cached
        }

        // Simulate fetch from upstream (in production, call actual data source)
        // For now, we'll populate with a placeholder
        let value = format!("prefetched_value_{}", key).into_bytes();
        cache.set(key.to_string(), value.into(), None);

        Ok(false) // Was not in cache before
    }

    fn get_mempool_free_percent(&self) -> u8 {
        if let Some(mempool) = &self.mempool {
            let stats = mempool.stats();
            let total = stats.total_allocations + 1000; // Estimate capacity
            let used = stats.total_allocations - stats.reuse_count;
            let free_percent = ((total - used) as f64 / total as f64 * 100.0) as u8;
            free_percent.min(100)
        } else {
            100 // Assume healthy if no mempool attached
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_runner_creation() {
        use crate::cache::{CacheConfig, LruPolicy};

        let config = PrefetchConfig::default();
        let cache = Arc::new(CacheAdapter::new(CacheConfig::default(), Box::new(LruPolicy::new(1000))));
        let runner = PrefetchRunner::new(config, cache);

        let stats = runner.get_stats().await;
        assert_eq!(stats.total_predictions, 0);
        assert_eq!(stats.prefetches_completed, 0);
    }

    #[tokio::test]
    async fn test_access_recording() {
        use crate::cache::{CacheConfig, LruPolicy};

        let mut config = PrefetchConfig::default();
        config.feature_flags.enable_telemetry = true;

        let cache = Arc::new(CacheAdapter::new(CacheConfig::default(), Box::new(LruPolicy::new(1000))));
        let runner = PrefetchRunner::new(config, cache);

        for i in 0..10 {
            runner.record_access(format!("key_{}", i));
        }

        let telemetry_stats = runner.telemetry.get_stats();
        assert!(telemetry_stats.total_events >= 10);
    }

    #[tokio::test]
    async fn test_manual_prefetch() {
        use std::time::Duration;
        use crate::cache::{CacheConfig, LruPolicy};

        let mut config = PrefetchConfig::default();
        config.feature_flags.prefetch_enabled = true;

        let cache = Arc::new(CacheAdapter::new(CacheConfig::default(), Box::new(LruPolicy::new(1000))));
        let runner = PrefetchRunner::new(config, cache);

        runner.prefetch_key("test_key".to_string()).await.ok();

        tokio::time::sleep(Duration::from_millis(100)).await;

        let stats = runner.get_stats().await;
        assert!(stats.prefetches_initiated > 0 || stats.prefetches_completed > 0);
    }

    #[tokio::test]
    async fn test_kill_switch() {
        use crate::cache::{CacheConfig, LruPolicy};

        let mut config = PrefetchConfig::default();
        config.feature_flags.prefetch_enabled = true;

        let cache = Arc::new(CacheAdapter::new(CacheConfig::default(), Box::new(LruPolicy::new(1000))));
        let runner = PrefetchRunner::new(config, cache);

        assert!(runner.throttler.is_enabled());

        runner.set_enabled(false);
        assert!(!runner.throttler.is_enabled());

        runner.set_enabled(true);
        assert!(runner.throttler.is_enabled());
    }
}
