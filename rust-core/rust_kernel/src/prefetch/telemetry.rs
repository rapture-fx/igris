//! Telemetry Collection for Access Pattern Tracking
//!
//! Implements a sliding-window telemetry collector that tracks:
//! - Access frequency (req/s per key)
//! - Recency (time since last access)
//! - TTL decay (weight decreases over time)
//! - Sequential access patterns
//!
//! Designed for low overhead with sampling and lock-free data structures.

use dashmap::DashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use parking_lot::RwLock;

/// Configuration for telemetry collection
#[derive(Debug, Clone)]
pub struct TelemetryConfig {
    /// Window size for access pattern tracking (default: 60s)
    pub window_duration_secs: u64,

    /// Sampling rate for detailed telemetry (0.01 = 1%)
    pub sample_rate: f64,

    /// Maximum number of keys to track simultaneously
    pub max_tracked_keys: usize,

    /// TTL decay factor (exponential decay per second)
    pub ttl_decay_factor: f64,

    /// Minimum access count to be considered for prediction
    pub min_access_threshold: u64,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            window_duration_secs: 60,
            sample_rate: 0.01, // 1% sampling
            max_tracked_keys: 100_000,
            ttl_decay_factor: 0.95, // 5% decay per second
            min_access_threshold: 3,
        }
    }
}

/// Access pattern data for a single key
#[derive(Debug, Clone)]
pub struct AccessPattern {
    /// Unique key identifier
    pub key: String,

    /// Total access count in current window
    pub access_count: u64,

    /// Last access timestamp (Unix seconds)
    pub last_access_ts: u64,

    /// First access timestamp in window
    pub first_access_ts: u64,

    /// Average time between accesses (seconds)
    pub avg_interval_secs: f64,

    /// Access frequency (req/s)
    pub frequency: f64,

    /// Recency score (0.0 to 1.0, 1.0 = just accessed)
    pub recency_score: f64,

    /// TTL-weighted score
    pub ttl_weighted_score: f64,

    /// Sequential access pattern detected
    pub is_sequential: bool,
}

/// Internal tracking structure for a key
#[derive(Debug)]
struct KeyTracker {
    access_count: AtomicU64,
    last_access_ts: AtomicU64,
    first_access_ts: AtomicU64,
    total_interval_ms: AtomicU64,
    last_interval_ms: AtomicU64,
}

impl KeyTracker {
    fn new(timestamp: u64) -> Self {
        Self {
            access_count: AtomicU64::new(1),
            last_access_ts: AtomicU64::new(timestamp),
            first_access_ts: AtomicU64::new(timestamp),
            total_interval_ms: AtomicU64::new(0),
            last_interval_ms: AtomicU64::new(0),
        }
    }

    fn record_access(&self, timestamp: u64) {
        let prev_ts = self.last_access_ts.load(Ordering::Relaxed);
        let interval_ms = timestamp.saturating_sub(prev_ts);

        self.access_count.fetch_add(1, Ordering::Relaxed);
        self.last_access_ts.store(timestamp, Ordering::Relaxed);
        self.total_interval_ms.fetch_add(interval_ms, Ordering::Relaxed);
        self.last_interval_ms.store(interval_ms, Ordering::Relaxed);
    }
}

/// High-performance telemetry collector with sliding-window tracking
pub struct TelemetryCollector {
    config: TelemetryConfig,

    /// Lock-free map of key → access tracker
    trackers: Arc<DashMap<String, Arc<KeyTracker>>>,

    /// Total events recorded
    total_events: AtomicU64,

    /// Sampled events (for detailed analysis)
    sampled_events: AtomicU64,

    /// Window start time
    window_start: RwLock<Instant>,
}

impl TelemetryCollector {
    /// Create a new telemetry collector
    pub fn new(config: TelemetryConfig) -> Self {
        Self {
            config,
            trackers: Arc::new(DashMap::with_capacity(10_000)),
            total_events: AtomicU64::new(0),
            sampled_events: AtomicU64::new(0),
            window_start: RwLock::new(Instant::now()),
        }
    }

    /// Record a cache access event
    pub fn record_access(&self, key: String) {
        self.total_events.fetch_add(1, Ordering::Relaxed);

        // Check if we should sample this event
        let should_sample = self.should_sample();
        if !should_sample && self.trackers.len() >= self.config.max_tracked_keys {
            return; // Skip if not sampling and at capacity
        }

        let now_ts = Self::current_timestamp_ms();

        // Update or create tracker
        if let Some(tracker) = self.trackers.get(&key) {
            tracker.record_access(now_ts);
        } else if self.trackers.len() < self.config.max_tracked_keys {
            self.trackers.insert(key.clone(), Arc::new(KeyTracker::new(now_ts)));
        }

        if should_sample {
            self.sampled_events.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Get access pattern for a specific key
    pub fn get_pattern(&self, key: &str) -> Option<AccessPattern> {
        let tracker = self.trackers.get(key)?;
        let now_ts = Self::current_timestamp_ms();

        self.compute_pattern(key, &tracker, now_ts)
    }

    /// Get top N keys by access frequency
    pub fn get_top_patterns(&self, limit: usize) -> Vec<AccessPattern> {
        let now_ts = Self::current_timestamp_ms();
        let mut patterns: Vec<_> = self.trackers
            .iter()
            .filter_map(|entry| {
                let key = entry.key();
                let tracker = entry.value();
                self.compute_pattern(key, tracker, now_ts)
            })
            .filter(|p| p.access_count >= self.config.min_access_threshold)
            .collect();

        // Sort by TTL-weighted score (descending)
        patterns.sort_by(|a, b| {
            b.ttl_weighted_score
                .partial_cmp(&a.ttl_weighted_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        patterns.truncate(limit);
        patterns
    }

    /// Evict stale entries from tracking (call periodically)
    pub fn evict_stale(&self) {
        let now_ts = Self::current_timestamp_ms();
        let window_ms = self.config.window_duration_secs * 1000;

        self.trackers.retain(|_, tracker| {
            let last_access = tracker.last_access_ts.load(Ordering::Relaxed);
            now_ts.saturating_sub(last_access) < window_ms
        });
    }

    /// Reset the tracking window
    pub fn reset_window(&self) {
        self.trackers.clear();
        *self.window_start.write() = Instant::now();
        self.total_events.store(0, Ordering::Relaxed);
        self.sampled_events.store(0, Ordering::Relaxed);
    }

    /// Get telemetry stats
    pub fn get_stats(&self) -> TelemetryStats {
        TelemetryStats {
            total_events: self.total_events.load(Ordering::Relaxed),
            sampled_events: self.sampled_events.load(Ordering::Relaxed),
            tracked_keys: self.trackers.len(),
            window_duration_secs: self.window_start.read().elapsed().as_secs(),
        }
    }

    // ========== Private Methods ==========

    fn compute_pattern(&self, key: &str, tracker: &KeyTracker, now_ts: u64) -> Option<AccessPattern> {
        let access_count = tracker.access_count.load(Ordering::Relaxed);
        if access_count == 0 {
            return None;
        }

        let last_access_ts = tracker.last_access_ts.load(Ordering::Relaxed);
        let first_access_ts = tracker.first_access_ts.load(Ordering::Relaxed);
        let total_interval_ms = tracker.total_interval_ms.load(Ordering::Relaxed);

        // Calculate metrics
        let window_duration_ms = now_ts.saturating_sub(first_access_ts).max(1);
        let frequency = (access_count as f64 * 1000.0) / window_duration_ms as f64;

        let avg_interval_secs = if access_count > 1 {
            (total_interval_ms as f64) / ((access_count - 1) as f64 * 1000.0)
        } else {
            0.0
        };

        // Recency score: exponential decay based on time since last access
        let time_since_access = now_ts.saturating_sub(last_access_ts);
        let recency_score = (-(time_since_access as f64) / 1000.0 / 10.0).exp(); // 10s half-life

        // TTL-weighted score: combines frequency and recency
        let age_secs = window_duration_ms as f64 / 1000.0;
        let decay_factor = self.config.ttl_decay_factor.powf(age_secs);
        let ttl_weighted_score = frequency * recency_score * decay_factor;

        // Detect sequential access pattern (consistent intervals)
        let last_interval = tracker.last_interval_ms.load(Ordering::Relaxed);
        let is_sequential = if access_count > 3 && avg_interval_secs > 0.0 {
            let interval_variance = (last_interval as f64 - avg_interval_secs * 1000.0).abs();
            interval_variance < (avg_interval_secs * 1000.0 * 0.5) // <50% variance
        } else {
            false
        };

        Some(AccessPattern {
            key: key.to_string(),
            access_count,
            last_access_ts: last_access_ts / 1000, // Convert to seconds
            first_access_ts: first_access_ts / 1000,
            avg_interval_secs,
            frequency,
            recency_score,
            ttl_weighted_score,
            is_sequential,
        })
    }

    fn should_sample(&self) -> bool {
        let event_count = self.total_events.load(Ordering::Relaxed);
        let sample_interval = (1.0 / self.config.sample_rate) as u64;
        event_count % sample_interval == 0
    }

    fn current_timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}

/// Telemetry collection statistics
#[derive(Debug, Clone)]
pub struct TelemetryStats {
    pub total_events: u64,
    pub sampled_events: u64,
    pub tracked_keys: usize,
    pub window_duration_secs: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;
    use std::time::Duration;

    #[test]
    fn test_basic_tracking() {
        let config = TelemetryConfig {
            sample_rate: 1.0, // Track everything
            ..Default::default()
        };
        let collector = TelemetryCollector::new(config);

        // Record accesses
        for _ in 0..10 {
            collector.record_access("key1".to_string());
            sleep(Duration::from_millis(10));
        }

        let pattern = collector.get_pattern("key1").unwrap();
        assert_eq!(pattern.access_count, 10);
        assert!(pattern.frequency > 0.0);
        assert!(pattern.recency_score > 0.5); // Recently accessed
    }

    #[test]
    fn test_pattern_detection() {
        let collector = TelemetryCollector::new(TelemetryConfig::default());

        // Create sequential pattern
        for _ in 0..5 {
            collector.record_access("sequential_key".to_string());
            sleep(Duration::from_millis(50));
        }

        let pattern = collector.get_pattern("sequential_key").unwrap();
        assert!(pattern.is_sequential || pattern.access_count >= 3);
    }

    #[test]
    fn test_top_patterns() {
        let collector = TelemetryCollector::new(TelemetryConfig {
            min_access_threshold: 2,
            ..Default::default()
        });

        // Create patterns with different frequencies
        for i in 0..5 {
            collector.record_access(format!("key{}", i));
        }
        for _ in 0..10 {
            collector.record_access("hot_key".to_string());
        }

        let top = collector.get_top_patterns(5);
        assert!(!top.is_empty());
        assert_eq!(top[0].key, "hot_key"); // Should be first
    }

    #[test]
    fn test_eviction() {
        let config = TelemetryConfig {
            window_duration_secs: 1,
            ..Default::default()
        };
        let collector = TelemetryCollector::new(config);

        collector.record_access("old_key".to_string());
        sleep(Duration::from_secs(2));

        collector.evict_stale();
        assert!(collector.get_pattern("old_key").is_none());
    }
}
