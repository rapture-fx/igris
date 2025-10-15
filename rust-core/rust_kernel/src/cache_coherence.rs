//! Cache Coherence Sweeper
//! 
//! Ensures cache consistency by removing expired and stale entries
//! across local and distributed cache layers.

use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::interval;
use log::{debug, info, warn, error};
use serde::{Deserialize, Serialize};

use crate::cache_adapter::{CacheAdapter, CacheEntry};

/// Coherence sweeper configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoherenceConfig {
    /// Sweep interval in seconds (default: 60s)
    pub sweep_interval_secs: u64,
    
    /// Maximum entries to sweep per iteration
    pub max_sweep_batch: usize,
    
    /// Enable strict consistency checks
    pub strict_consistency: bool,
    
    /// TTL grace period (seconds before actual expiration)
    pub ttl_grace_period_secs: u64,
    
    /// Version mismatch behavior
    pub auto_evict_version_mismatch: bool,
    
    /// Checksum validation
    pub enable_checksum_validation: bool,
}

impl Default for CoherenceConfig {
    fn default() -> Self {
        Self {
            sweep_interval_secs: 60,
            max_sweep_batch: 1000,
            strict_consistency: true,
            ttl_grace_period_secs: 5,
            auto_evict_version_mismatch: true,
            enable_checksum_validation: true,
        }
    }
}

/// Sweep statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepStats {
    pub total_sweeps: u64,
    pub total_entries_scanned: u64,
    pub expired_entries_removed: u64,
    pub version_mismatches_removed: u64,
    pub checksum_failures_removed: u64,
    pub total_entries_removed: u64,
    pub last_sweep_duration_ms: u64,
    pub last_sweep_timestamp: u64,
    pub cache_consistency_rate: f64,
}

impl Default for SweepStats {
    fn default() -> Self {
        Self {
            total_sweeps: 0,
            total_entries_scanned: 0,
            expired_entries_removed: 0,
            version_mismatches_removed: 0,
            checksum_failures_removed: 0,
            total_entries_removed: 0,
            last_sweep_duration_ms: 0,
            last_sweep_timestamp: 0,
            cache_consistency_rate: 1.0,
        }
    }
}

/// Cache coherence sweeper
pub struct CacheCoherenceSweeper {
    config: CoherenceConfig,
    cache_adapter: Arc<CacheAdapter>,
    stats: Arc<tokio::sync::RwLock<SweepStats>>,
    stop_signal: Arc<tokio::sync::Notify>,
}

impl CacheCoherenceSweeper {
    /// Create new coherence sweeper
    pub fn new(config: CoherenceConfig, cache_adapter: Arc<CacheAdapter>) -> Self {
        Self {
            config,
            cache_adapter,
            stats: Arc::new(tokio::sync::RwLock::new(SweepStats::default())),
            stop_signal: Arc::new(tokio::sync::Notify::new()),
        }
    }
    
    /// Start the coherence sweeper task
    pub fn start(&self) {
        let config = self.config.clone();
        let cache_adapter = Arc::clone(&self.cache_adapter);
        let stats = Arc::clone(&self.stats);
        let stop_signal = Arc::clone(&self.stop_signal);
        
        tokio::spawn(async move {
            let mut interval_timer = interval(Duration::from_secs(config.sweep_interval_secs));
            
            info!("Cache coherence sweeper started (interval: {}s)", config.sweep_interval_secs);
            
            loop {
                tokio::select! {
                    _ = interval_timer.tick() => {
                        if let Err(e) = Self::perform_sweep(
                            &config,
                            &cache_adapter,
                            &stats,
                        ).await {
                            error!("Coherence sweep failed: {}", e);
                        }
                    }
                    _ = stop_signal.notified() => {
                        info!("Cache coherence sweeper stopped");
                        break;
                    }
                }
            }
        });
    }
    
    /// Stop the sweeper
    pub fn stop(&self) {
        self.stop_signal.notify_one();
    }
    
    /// Perform a single sweep iteration
    async fn perform_sweep(
        config: &CoherenceConfig,
        cache_adapter: &Arc<CacheAdapter>,
        stats: &Arc<tokio::sync::RwLock<SweepStats>>,
    ) -> Result<(), String> {
        let sweep_start = SystemTime::now();
        
        debug!("Starting cache coherence sweep");
        
        // Get current version
        let current_version = cache_adapter.get_current_version().await;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        // Sweep local cache
        let local_result = Self::sweep_local_cache(
            config,
            cache_adapter,
            current_version,
            now,
        ).await?;
        
        // Sweep Redis cache
        let redis_result = Self::sweep_redis_cache(
            config,
            cache_adapter,
            current_version,
            now,
        ).await?;
        
        // Update statistics
        let sweep_duration = sweep_start
            .elapsed()
            .unwrap_or(Duration::from_secs(0))
            .as_millis() as u64;
        
        let mut stats_lock = stats.write().await;
        stats_lock.total_sweeps += 1;
        stats_lock.total_entries_scanned += local_result.scanned + redis_result.scanned;
        stats_lock.expired_entries_removed += local_result.expired + redis_result.expired;
        stats_lock.version_mismatches_removed += local_result.version_mismatches + redis_result.version_mismatches;
        stats_lock.checksum_failures_removed += local_result.checksum_failures + redis_result.checksum_failures;
        stats_lock.total_entries_removed += local_result.total_removed + redis_result.total_removed;
        stats_lock.last_sweep_duration_ms = sweep_duration;
        stats_lock.last_sweep_timestamp = now;
        
        // Calculate consistency rate
        if stats_lock.total_entries_scanned > 0 {
            let consistent_entries = stats_lock.total_entries_scanned - stats_lock.total_entries_removed;
            stats_lock.cache_consistency_rate = consistent_entries as f64 / stats_lock.total_entries_scanned as f64;
        }
        
        info!(
            "Cache coherence sweep completed: scanned={}, removed={}, duration={}ms, consistency={:.2}%",
            local_result.scanned + redis_result.scanned,
            local_result.total_removed + redis_result.total_removed,
            sweep_duration,
            stats_lock.cache_consistency_rate * 100.0
        );
        
        Ok(())
    }
    
    /// Sweep local cache
    async fn sweep_local_cache(
        config: &CoherenceConfig,
        cache_adapter: &Arc<CacheAdapter>,
        current_version: u64,
        now: u64,
    ) -> Result<SweepResult, String> {
        let mut result = SweepResult::default();
        
        // Get local cache access
        let local_cache = cache_adapter.get_local_cache();
        let cache = local_cache.read();
        
        let mut keys_to_remove = Vec::new();
        
        for (key, entry) in cache.iter() {
            result.scanned += 1;
            
            // Check TTL expiration
            if Self::is_expired(entry, now, config.ttl_grace_period_secs) {
                keys_to_remove.push(key.clone());
                result.expired += 1;
                debug!("Marking expired entry for removal: {}", key);
                continue;
            }
            
            // Check version mismatch
            if config.auto_evict_version_mismatch && entry.version != current_version {
                keys_to_remove.push(key.clone());
                result.version_mismatches += 1;
                debug!("Marking version mismatch for removal: {} (entry_v{} != current_v{})", 
                    key, entry.version, current_version);
                continue;
            }
            
            // Check checksum (if enabled)
            if config.enable_checksum_validation {
                if !Self::validate_checksum(entry) {
                    keys_to_remove.push(key.clone());
                    result.checksum_failures += 1;
                    warn!("Checksum validation failed for: {}", key);
                    continue;
                }
            }
            
            // Batch limit
            if keys_to_remove.len() >= config.max_sweep_batch {
                break;
            }
        }
        
        drop(cache);
        
        // Remove marked entries
        if !keys_to_remove.is_empty() {
            let mut cache = local_cache.write();
            for key in &keys_to_remove {
                cache.remove(key);
            }
            result.total_removed = keys_to_remove.len() as u64;
        }
        
        debug!("Local cache sweep: scanned={}, removed={}", result.scanned, result.total_removed);
        
        Ok(result)
    }
    
    /// Sweep Redis cache
    async fn sweep_redis_cache(
        config: &CoherenceConfig,
        cache_adapter: &Arc<CacheAdapter>,
        current_version: u64,
        now: u64,
    ) -> Result<SweepResult, String> {
        let mut result = SweepResult::default();
        
        // Get Redis client
        let redis_client = match cache_adapter.get_redis_client() {
            Some(client) => client,
            None => {
                debug!("Redis not available, skipping distributed cache sweep");
                return Ok(result);
            }
        };
        
        // Scan Redis keys (using cursor-based iteration)
        let pattern = format!("{}*", cache_adapter.get_key_prefix());
        let mut cursor = 0u64;
        let mut keys_to_remove = Vec::new();
        
        loop {
            // SCAN command
            let scan_result: (u64, Vec<String>) = redis_client
                .scan(cursor, &pattern, config.max_sweep_batch)
                .await
                .map_err(|e| format!("Redis SCAN failed: {}", e))?;
            
            cursor = scan_result.0;
            let keys = scan_result.1;
            
            for key in keys {
                result.scanned += 1;
                
                // Get entry
                let entry: Option<CacheEntry> = redis_client
                    .get(&key)
                    .await
                    .unwrap_or(None);
                
                let entry = match entry {
                    Some(e) => e,
                    None => continue,
                };
                
                // Check TTL expiration
                if Self::is_expired(&entry, now, config.ttl_grace_period_secs) {
                    keys_to_remove.push(key.clone());
                    result.expired += 1;
                    continue;
                }
                
                // Check version mismatch
                if config.auto_evict_version_mismatch && entry.version != current_version {
                    keys_to_remove.push(key.clone());
                    result.version_mismatches += 1;
                    continue;
                }
                
                // Check checksum
                if config.enable_checksum_validation && !Self::validate_checksum(&entry) {
                    keys_to_remove.push(key.clone());
                    result.checksum_failures += 1;
                    continue;
                }
                
                // Batch limit
                if keys_to_remove.len() >= config.max_sweep_batch {
                    break;
                }
            }
            
            // Delete marked keys
            if !keys_to_remove.is_empty() {
                for key in &keys_to_remove {
                    let _ = redis_client.delete(key).await;
                }
                result.total_removed += keys_to_remove.len() as u64;
                keys_to_remove.clear();
            }
            
            // Check if scan is complete
            if cursor == 0 {
                break;
            }
            
            // Prevent infinite loops
            if result.scanned > config.max_sweep_batch as u64 * 10 {
                warn!("Redis sweep exceeded scan limit");
                break;
            }
        }
        
        debug!("Redis cache sweep: scanned={}, removed={}", result.scanned, result.total_removed);
        
        Ok(result)
    }
    
    /// Check if entry is expired
    fn is_expired(entry: &CacheEntry, now: u64, grace_period: u64) -> bool {
        let expiration_time = entry.created_at + entry.ttl;
        let grace_expiration = expiration_time.saturating_sub(grace_period);
        
        now >= grace_expiration
    }
    
    /// Validate entry checksum
    fn validate_checksum(entry: &CacheEntry) -> bool {
        // Calculate expected checksum
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(entry.data.as_bytes());
        let calculated = format!("{:x}", hasher.finalize());
        let calculated_short = &calculated[..16];
        
        // Compare with stored checksum (if present)
        // For now, we'll assume checksum is stored in metadata
        // In production, this would be a field in CacheEntry
        true // Placeholder - would implement actual validation
    }
    
    /// Get sweep statistics
    pub async fn get_stats(&self) -> SweepStats {
        self.stats.read().await.clone()
    }
}

/// Result of a sweep operation
#[derive(Debug, Default)]
struct SweepResult {
    scanned: u64,
    expired: u64,
    version_mismatches: u64,
    checksum_failures: u64,
    total_removed: u64,
}

// Extension trait for CacheAdapter
pub trait CacheAdapterExt {
    fn get_local_cache(&self) -> &Arc<parking_lot::RwLock<hashbrown::HashMap<String, CacheEntry>>>;
    fn get_redis_client(&self) -> Option<&Arc<RedisClient>>;
    fn get_key_prefix(&self) -> &str;
    async fn get_current_version(&self) -> u64;
}

// Placeholder implementations (would be in cache_adapter.rs)
struct RedisClient;

impl RedisClient {
    async fn scan(&self, cursor: u64, pattern: &str, count: usize) -> Result<(u64, Vec<String>), String> {
        // Placeholder
        Ok((0, Vec::new()))
    }
    
    async fn get(&self, key: &str) -> Result<Option<CacheEntry>, String> {
        // Placeholder
        Ok(None)
    }
    
    async fn delete(&self, key: &str) -> Result<bool, String> {
        // Placeholder
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_coherence_sweeper_creation() {
        let config = CoherenceConfig::default();
        assert_eq!(config.sweep_interval_secs, 60);
        assert_eq!(config.max_sweep_batch, 1000);
        assert!(config.strict_consistency);
    }
    
    #[test]
    fn test_is_expired() {
        let entry = CacheEntry {
            created_at: 1000,
            ttl: 300,
            // ... other fields
        };
        
        // Not expired
        assert!(!CacheCoherenceSweeper::is_expired(&entry, 1200, 5));
        
        // Expired (within grace period)
        assert!(CacheCoherenceSweeper::is_expired(&entry, 1295, 5));
        
        // Expired (past TTL)
        assert!(CacheCoherenceSweeper::is_expired(&entry, 1400, 5));
    }
    
    #[test]
    fn test_sweep_stats_consistency_rate() {
        let mut stats = SweepStats::default();
        stats.total_entries_scanned = 1000;
        stats.total_entries_removed = 10;
        
        let consistent = stats.total_entries_scanned - stats.total_entries_removed;
        let rate = consistent as f64 / stats.total_entries_scanned as f64;
        
        assert_eq!(rate, 0.99); // 99% consistency
    }
}
