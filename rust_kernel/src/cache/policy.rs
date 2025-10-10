//! Cache Eviction Policies
//!
//! Provides different eviction strategies for the cache layer

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Cache eviction policy trait
pub trait CachePolicy: Send + Sync {
    /// Check if entry should be evicted
    fn should_evict(&self, key: &str, metadata: &EntryMetadata) -> bool;

    /// Record access to update policy state
    fn record_access(&mut self, key: &str);

    /// Select victim for eviction
    fn select_victim(&self, candidates: &[&str]) -> Option<String>;
}

/// Entry metadata for policy decisions
#[derive(Debug, Clone)]
pub struct EntryMetadata {
    pub created_at: u64,
    pub last_accessed: u64,
    pub access_count: u64,
    pub ttl: u64,
    pub size_bytes: usize,
}

/// LRU (Least Recently Used) eviction policy
pub struct LruPolicy {
    access_times: HashMap<String, u64>,
    max_size: usize,
}

impl LruPolicy {
    pub fn new(max_size: usize) -> Self {
        Self {
            access_times: HashMap::with_capacity(max_size),
            max_size,
        }
    }

    fn current_time() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }
}

impl CachePolicy for LruPolicy {
    fn should_evict(&self, _key: &str, _metadata: &EntryMetadata) -> bool {
        self.access_times.len() >= self.max_size
    }

    fn record_access(&mut self, key: &str) {
        self.access_times.insert(key.to_string(), Self::current_time());
    }

    fn select_victim(&self, candidates: &[&str]) -> Option<String> {
        candidates
            .iter()
            .min_by_key(|key| self.access_times.get(&key.to_string()).unwrap_or(&0))
            .map(|s| s.to_string())
    }
}

/// TTL-based eviction policy
pub struct TtlPolicy {
    default_ttl: u64,
}

impl TtlPolicy {
    pub fn new(default_ttl_secs: u64) -> Self {
        Self {
            default_ttl: default_ttl_secs,
        }
    }

    fn is_expired(metadata: &EntryMetadata) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        now >= metadata.created_at + metadata.ttl
    }
}

impl CachePolicy for TtlPolicy {
    fn should_evict(&self, _key: &str, metadata: &EntryMetadata) -> bool {
        Self::is_expired(metadata)
    }

    fn record_access(&mut self, _key: &str) {
        // TTL policy doesn't track access
    }

    fn select_victim(&self, candidates: &[&str]) -> Option<String> {
        // TTL policy selects oldest entry
        candidates.first().map(|s| s.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lru_policy() {
        let mut policy = LruPolicy::new(3);

        policy.record_access("key1");
        std::thread::sleep(std::time::Duration::from_millis(10));
        policy.record_access("key2");
        std::thread::sleep(std::time::Duration::from_millis(10));
        policy.record_access("key3");

        // key1 should be the victim (oldest access)
        let victim = policy.select_victim(&["key1", "key2", "key3"]);
        assert_eq!(victim, Some("key1".to_string()));
    }

    #[test]
    fn test_ttl_policy() {
        let policy = TtlPolicy::new(300);

        let metadata = EntryMetadata {
            created_at: 0,
            last_accessed: 0,
            access_count: 1,
            ttl: 1,
            size_bytes: 100,
        };

        // Should be expired (created at 0, TTL 1 second)
        assert!(policy.should_evict("key", &metadata));
    }
}
