//! Cache Adapter - Core caching functionality
//!
//! Provides unified caching interface with zero dependencies

use bytes::Bytes;
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

use super::policy::{CachePolicy, EntryMetadata};

/// Cache configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub max_entries: usize,
    pub default_ttl_secs: u64,
    pub enable_metrics: bool,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            max_entries: 10000,
            default_ttl_secs: 300,
            enable_metrics: true,
        }
    }
}

/// Cache entry with zero-copy data
#[derive(Debug, Clone)]
pub struct CacheEntry {
    pub key: Arc<str>,
    pub data: Bytes,
    pub metadata: EntryMetadata,
}

/// Cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub total_entries: usize,
    pub hit_rate: f64,
}

/// Main cache adapter
pub struct CacheAdapter {
    config: CacheConfig,
    cache: Arc<DashMap<String, CacheEntry>>,
    policy: Arc<parking_lot::Mutex<Box<dyn CachePolicy>>>,
    stats: Arc<parking_lot::Mutex<CacheStats>>,
}

impl CacheAdapter {
    pub fn new(config: CacheConfig, policy: Box<dyn CachePolicy>) -> Self {
        Self {
            config,
            cache: Arc::new(DashMap::with_capacity(10000)),
            policy: Arc::new(parking_lot::Mutex::new(policy)),
            stats: Arc::new(parking_lot::Mutex::new(CacheStats::default())),
        }
    }

    /// Get cached value
    pub fn get(&self, key: &str) -> Option<Bytes> {
        if let Some(entry) = self.cache.get(key) {
            // Update policy
            self.policy.lock().record_access(key);

            // Update stats
            let mut stats = self.stats.lock();
            stats.hits += 1;
            stats.hit_rate = stats.hits as f64 / (stats.hits + stats.misses) as f64;

            return Some(entry.data.clone());
        }

        // Cache miss
        let mut stats = self.stats.lock();
        stats.misses += 1;
        stats.hit_rate = stats.hits as f64 / (stats.hits + stats.misses) as f64;

        None
    }

    /// Set cached value
    pub fn set(&self, key: String, data: Bytes, ttl: Option<u64>) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let entry = CacheEntry {
            key: Arc::from(key.as_str()),
            data,
            metadata: EntryMetadata {
                created_at: now,
                last_accessed: now,
                access_count: 1,
                ttl: ttl.unwrap_or(self.config.default_ttl_secs),
                size_bytes: 0, // Would calculate actual size
            },
        };

        // Check if eviction needed
        if self.cache.len() >= self.config.max_entries {
            self.evict_one();
        }

        self.cache.insert(key, entry);

        // Update stats
        let mut stats = self.stats.lock();
        stats.total_entries = self.cache.len();
    }

    /// Evict one entry using policy
    fn evict_one(&self) {
        let keys: Vec<String> = self.cache.iter().map(|e| e.key().clone()).collect();

        if let Some(victim) = self.policy.lock().select_victim(
            &keys.iter().map(|s| s.as_str()).collect::<Vec<_>>()
        ) {
            self.cache.remove(&victim);

            let mut stats = self.stats.lock();
            stats.evictions += 1;
        }
    }

    /// Get statistics
    pub fn stats(&self) -> CacheStats {
        self.stats.lock().clone()
    }
}

impl Default for CacheStats {
    fn default() -> Self {
        Self {
            hits: 0,
            misses: 0,
            evictions: 0,
            total_entries: 0,
            hit_rate: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::policy::LruPolicy;

    #[test]
    fn test_cache_basic() {
        let policy = Box::new(LruPolicy::new(100));
        let cache = CacheAdapter::new(CacheConfig::default(), policy);

        cache.set("key1".to_string(), Bytes::from("value1"), None);

        let value = cache.get("key1");
        assert!(value.is_some());
        assert_eq!(value.unwrap(), Bytes::from("value1"));
    }

    #[test]
    fn test_cache_miss() {
        let policy = Box::new(LruPolicy::new(100));
        let cache = CacheAdapter::new(CacheConfig::default(), policy);

        let value = cache.get("nonexistent");
        assert!(value.is_none());

        let stats = cache.stats();
        assert_eq!(stats.misses, 1);
    }
}
