//! Cache Adapter for Rust Kernel
//! 
//! Provides caching functionality for model outputs with TTL,
//! cache invalidation hooks, and consistency guarantees.
//! Integrates with Redis for distributed cache.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use std::os::raw::c_char;
use std::ptr;
use serde::{Deserialize, Serialize};

use tokio::sync::{RwLock as TokioRwLock, Mutex as TokioMutex, mpsc};
use redis::RedisError;
use hashbrown::HashMap as BrownHashMap;
use parking_lot::RwLock as ParkingRwLock;

use crate::ffi_guard::{FFIContext, FFIError, safe_ffi_wrapper};

// ============================================================================
// Configuration and Constants
// ============================================================================

const DEFAULT_CACHE_TTL: Duration = Duration::from_secs(300); // 5 minutes
const MAX_CACHE_SIZE: usize = 10_000;
const CACHE_CLEANUP_INTERVAL: Duration = Duration::from_secs(60);
const BATCH_CACHE_GET_SIZE: usize = 100;

// Cache key construction constants
const CACHE_MODEL_ID_PREFIX: &str = "model:";
const CACHE_FEATURE_HASH_PREFIX: &str = "hash:";
const CACHE_POLICY_TAG_PREFIX: &str = "policy:";
const CACHE_SEPARATOR: &str = ":";

// ============================================================================
// Cache Configuration
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// Redis connection string
    pub redis_url: String,
    
    /// Default TTL for cache entries in seconds
    pub default_ttl_secs: u64,
    
    /// Maximum number of entries in local cache
    pub max_entries: usize,
    
    /// Enable distributed caching
    pub enable_distributed: bool,
    
    /// Enable local caching with distributed fallback
    pub enable_local_cache: bool,
    
    /// Cache cleanup interval in seconds
    pub cleanup_interval_secs: u64,
    
    /// Connection pool size for Redis
    pub redis_pool_size: u32,
    
    /// Connection timeout in milliseconds
    pub connection_timeout_ms: u64,
    
    /// Command timeout in milliseconds
    pub command_timeout_ms: u64,
    
    /// Key prefix for all cache keys
    pub key_prefix: String,
    
    /// Enable compression for large values
    pub enable_compression: bool,
    
    /// Maximum value size for compression (in bytes)
    pub compression_threshold_bytes: usize,
    
    /// Health check interval in seconds
    pub health_check_interval_secs: u64,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            redis_url: "redis://localhost:6379".to_string(),
            default_ttl_secs: 300,
            max_entries: 10_000,
            enable_distributed: true,
            enable_local_cache: true,
            cleanup_interval_secs: 60,
            redis_pool_size: 10,
            connection_timeout_ms: 5000,
            command_timeout_ms: 1000,
            key_prefix: "igris:cache:".to_string(),
            enable_compression: true,
            compression_threshold_bytes: 1024,
            health_check_interval_secs: 30,
        }
    }
}

/// Cache entry with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    /// Cached data (JSON serialized)
    pub data: String,
    
    /// Creation timestamp (Unix epoch seconds)
    pub created_at: u64,
    
    /// TTL in seconds
    pub ttl: u64,
    
    /// Cache key components
    pub model_id: String,
    pub feature_hash: String,
    pub policy_tags: Vec<String>,
    
    /// Entry size in bytes
    pub size_bytes: usize,
    
    /// Whether this entry is compressed
    pub compressed: bool,
    
    /// Number of times this entry was accessed
    pub access_count: u64,
    
    /// Last access timestamp
    pub last_accessed_at: u64,
    
    /// Entry version for consistency checks
    pub version: u64,
}

/// Cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_entries: usize,
    pub local_hits: u64,
    pub remote_hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub errors: u64,
    pub avg_access_count: f64,
    pub cache_size_bytes: u64,
    pub hit_rate: f64,
    pub redis_connected: bool,
    pub last_cleanup: u64,
}

/// Cache hit or miss result
#[derive(Debug, Clone)]
pub enum CacheResult<T> {
    /// Cache hit with cached data
    Hit(T),
    
    /// Cache miss, data not found
    Miss,
    
    /// Cache error
    Error(String),
}

// ============================================================================
// Redis Client Wrapper
// ============================================================================

/// Redis client with connection pooling
struct RedisClient {
    client: redis::Client,
    config: CacheConfig,
    connected: Arc<TokioRwLock<bool>>,
}

impl RedisClient {
    /// Create new Redis client with connection pool
    async fn new(config: CacheConfig) -> Result<Self, RedisError> {
        let client = redis::Client::open(config.redis_url.clone())?;
        
        // Test connection
        let _: String = client.get("ping").await?;
        
        let connected = Arc::new(TokioRwLock::new(true));
        
        Ok(Self {
            client,
            config,
            connected,
        })
    }
    
    /// Check if Redis is connected
    async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }
    
    /// Get cache entry from Redis
    async fn get(&self, key: &str) -> Result<Option<CacheEntry>, RedisError> {
        let data: Option<String> = self.client.get(key).await?;
        
        match data {
            None => Ok(None),
            Some(json_str) => {
                match serde_json::from_str::<CacheEntry>(&json_str) {
                    Ok(entry) => Ok(Some(entry)),
                    Err(e) => {
                        eprintln!("Failed to deserialize cache entry: {}", e);
                        // Remove corrupted entry
                        let _: () = self.client.del(key).await;
                        Ok(None)
                    }
                }
            }
        }
    }
    
    /// Set cache entry in Redis
    async fn set(&self, key: &str, entry: &CacheEntry) -> Result<(), RedisError> {
        let json_str = serde_json::to_string(entry)
            .map_err(|e| RedisError::from((redis::ErrorKind::TypeError, "Serialization failed", e.to_string())))?;

        // Set with TTL
        let _: () = self.client.set_ex(key, &json_str, entry.ttl).await?;

        Ok(())
    }
    
    /// Delete cache entry from Redis
    async fn delete(&self, key: &str) -> Result<bool, RedisError> {
        let result: i32 = self.client.del(key).await?;
        Ok(result > 0)
    }
    
    /// Check if key exists
    async fn exists(&self, key: &str) -> Result<bool, RedisError> {
        let result: i32 = self.client.exists(key).await?;
        Ok(result == 1)
    }
    
    /// Get TTL for key
    async fn ttl(&self, key: &str) -> Result<i64, RedisError> {
        self.client.ttl(key).await
    }
    
    /// Clean up expired entries
    async fn cleanup_expired(&self) -> Result<u64, RedisError> {
        // This would require Redis SCAN with TTL checks
        // For now, return 0 as placeholder
        Ok(0)
    }
}

// ============================================================================
// Cache Adapter Implementation
// ============================================================================

/// Main cache adapter
pub struct CacheAdapter {
    config: CacheConfig,
    redis_client: Option<Arc<RedisClient>>,
    
    // Local cache
    local_cache: Arc<ParkingRwLock<BrownHashMap<String, CacheEntry>>>,
    
    // Statistics
    stats: Arc<TokioRwLock<CacheStats>>,
    
    // Cleanup channel
    cleanup_tx: mpsc::UnboundedSender<()>,
    cleanup_rx: Arc<TokioMutex<mpsc::UnboundedReceiver<()>>>,
    
    // Version counter for consistency
    version_counter: Arc<TokioRwLock<u64>>
}

impl CacheAdapter {
    /// Create new cache adapter
    pub async fn new(config: CacheConfig) -> Result<Self, Box<dyn std::error::Error>> {
        // Initialize Redis client if distributed caching is enabled
        let redis_client = if config.enable_distributed {
            match RedisClient::new(config.clone()).await {
                Ok(client) => Some(Arc::new(client)),
                Err(e) => {
                    eprintln!("Failed to connect to Redis: {}. Running without distributed cache.", e);
                    None
                }
            }
        } else {
            None
        };
        
        // Initialize local cache
        let local_cache = Arc::new(ParkingRwLock::new(BrownHashMap::with_capacity(config.max_entries)));
        
        // Initialize statistics
        let stats = Arc::new(TokioRwLock::new(CacheStats {
            total_entries: 0,
            local_hits: 0,
            remote_hits: 0,
            misses: 0,
            evictions: 0,
            errors: 0,
            avg_access_count: 0.0,
            cache_size_bytes: 0,
            hit_rate: 0.0,
            redis_connected: redis_client.is_some(),
            last_cleanup: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }));
        
        // Setup cleanup channel
        let (cleanup_tx, cleanup_rx) = mpsc::unbounded_channel();
        
        let adapter = Self {
            config,
            redis_client,
            local_cache,
            stats,
            cleanup_tx,
            cleanup_rx: Arc::new(TokioMutex::new(cleanup_rx)),
            version_counter: Arc::new(TokioRwLock::new(0)),
        };
        
        // Start cleanup task
        adapter.start_cleanup_task();
        
        // Start health check task
        adapter.start_health_check_task();
        
        Ok(adapter)
    }
    
    /// Generate cache key from components
    pub fn generate_cache_key(&self, model_id: &str, feature_hash: &str, policy_tags: &[String]) -> String {
        let mut key_parts = vec![
            self.config.key_prefix.clone(),
            CACHE_MODEL_ID_PREFIX.to_string() + model_id,
            CACHE_FEATURE_HASH_PREFIX.to_string() + feature_hash,
        ];
        
        // Add policy tags if provided
        if !policy_tags.is_empty() {
            key_parts.push(
                CACHE_POLICY_TAG_PREFIX.to_string() + 
                policy_tags.join(",")
            );
        }
        
        key_parts.join(CACHE_SEPARATOR)
    }
    
    /// Get cached inference result
    pub async fn get_cache(&self, model_id: &str, feature_hash: &str, policy_tags: &[String]) -> Result<Option<String>, String> {
        let key = self.generate_cache_key(model_id, feature_hash, policy_tags);

        // Try local cache first
        {
            let cache = self.local_cache.read();
            if let Some(entry) = cache.get(&key) {
                // Check if entry is still valid
                if self.is_entry_valid(&entry) {
                    // Update access statistics
                    drop(cache);
                    self.update_access_stats_local(&key, true);

                    let mut stats = self.stats.write().await;
                    stats.local_hits += 1;
                    self.update_hit_rate(&mut stats);

                    return Ok(Some(entry.data.clone()));
                } else {
                    // Remove expired entry
                    drop(cache);
                    let mut cache = self.local_cache.write();
                    cache.remove(&key);

                    let mut stats = self.stats.write().await;
                    stats.total_entries = cache.len();
                    stats.evictions += 1;
                }
            }
        }

        // Try distributed cache
        if let Some(redis_client) = &self.redis_client {
            match redis_client.get(&key).await {
                Ok(Some(entry)) => {
                    if self.is_entry_valid(&entry) {
                        // Store in local cache (with size limits)
                        self.store_in_local_cache(&key, &entry);

                        // Update access statistics
                        self.update_access_stats_remote(&key, true);

                        let mut stats = self.stats.write().await;
                        stats.remote_hits += 1;
                        self.update_hit_rate(&mut stats);

                        return Ok(Some(entry.data));
                    } else {
                        // Remove expired entry from Redis
                        let _ = redis_client.delete(&key).await;
                    }
                }
                Err(_) => {
                    let mut stats = self.stats.write().await;
                    stats.redis_connected = false;
                    stats.errors += 1;
                }
            }
        }

        // Cache miss
        let mut stats = self.stats.write().await;
        stats.misses += 1;
        self.update_hit_rate(&mut stats);

        Ok(None)
    }
    
    /// Set cached inference result
    pub async fn set_cache(&self, model_id: &str, feature_hash: &str, policy_tags: &[String], data: &str, ttl_override: Option<u64>) -> Result<(), String> {
        let key = self.generate_cache_key(model_id, feature_hash, policy_tags);
        let ttl = ttl_override.unwrap_or(self.config.default_ttl_secs);

        // Create cache entry
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let entry = CacheEntry {
            data: data.to_string(),
            created_at: now,
            ttl,
            model_id: model_id.to_string(),
            feature_hash: feature_hash.to_string(),
            policy_tags: policy_tags.to_vec(),
            size_bytes: data.len(),
            compressed: false, // Would implement compression if needed
            access_count: 1,
            last_accessed_at: now,
            version: self.get_current_version(),
        };

        // Store in local cache
        self.store_in_local_cache(&key, &entry);

        // Store in distributed cache
        if let Some(redis_client) = &self.redis_client {
            match redis_client.set(&key, &entry).await {
                Ok(()) => {
                    let mut stats = self.stats.write().await;
                    stats.redis_connected = true;
                }
                Err(_) => {
                    let mut stats = self.stats.write().await;
                    stats.redis_connected = false;
                    stats.errors += 1;
                }
            }
        }

        Ok(())
    }
    
    /// Invalidate cache entries matching pattern
    pub async fn invalidate(&self, pattern: &str) -> Result<u64, String> {
        let mut invalidated_count = 0u64;

        // Invalidate from local cache
        {
            let cache = self.local_cache.read();
            let keys_to_remove: Vec<String> = cache
                .keys()
                .filter(|key| key.contains(pattern))
                .cloned()
                .collect();

            drop(cache);
            let mut cache = self.local_cache.write();
            for key in keys_to_remove {
                cache.remove(&key);
                invalidated_count += 1;
            }
        }

        // Invalidate from distributed cache
        if let Some(_redis_client) = &self.redis_client {
            // We would need Redis SCAN to find keys matching pattern
            // For now, use a simple implementation
            // In production, this should use SCAN with pattern matching
            // TODO: Implement proper pattern-based invalidation
        }

        // Update statistics
        {
            let cache = self.local_cache.read();
            let mut stats = self.stats.write().await;
            stats.total_entries = cache.len();
            stats.evictions += invalidated_count;
        }

        Ok(invalidated_count)
    }
    
    /// Get cache statistics
    pub async fn get_stats(&self) -> CacheStats {
        self.stats.read().await.clone()
    }
    
    /// Health check for cache adapter
    pub async fn health_check(&self) -> CacheHealthStatus {
        let stats = self.get_stats().await;
        
        CacheHealthStatus {
            healthy: stats.redis_connected && stats.errors < 100,
            local_cache_size: self.local_cache.read().len(),
            redis_connected: stats.redis_connected,
            hit_rate: stats.hit_rate,
            error_count: stats.errors,
            last_cleanup: stats.last_cleanup,
        }
    }
    
    /// Preload cache with known data
    pub async fn preload_cache(&self, entries: Vec<(String, String, u64)>) -> Result<usize, String> {
        let mut loaded_count = 0;

        for (key, data, ttl) in entries {
            // Parse key components
            let parts = key.split(':').collect::<Vec<&str>>();
            if parts.len() < 3 {
                continue; // Invalid key format
            }

            let model_id = parts[1].trim_start_matches("model:").to_string();
            let feature_hash = parts[2].trim_start_matches("hash:").to_string();
            let policy_tags = if parts.len() > 3 {
                parts[3]
                    .trim_start_matches("policy:")
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .collect()
            } else {
                vec![]
            };

            // Store in cache
            if let Err(e) = self.set_cache(&model_id, &feature_hash, &policy_tags, &data, Some(ttl)).await {
                eprintln!("Failed to preload cache entry {}: {}", key, e);
                continue;
            }

            loaded_count += 1;
        }

        Ok(loaded_count)
    }
    
    // Private helper methods
    
    fn store_in_local_cache(&self, key: &str, entry: &CacheEntry) {
        let mut cache = self.local_cache.write();
        
        // Check size limits
        if cache.len() >= self.config.max_entries {
            // Remove LRU entries (simplified - would use proper LRU)
            let keys_to_remove: Vec<String> = cache
                .keys()
                .take(self.config.max_entries / 10) // Remove 10%
                .cloned()
                .collect();
            
            for old_key in keys_to_remove {
                cache.remove(&old_key);
            }
        }
        
        cache.insert(key.to_string(), entry.clone());
        
        // Update statistics
        {
            let mut stats = self.stats.blocking_write();
            stats.total_entries = cache.len();
            stats.cache_size_bytes += entry.size_bytes as u64;
        }
    }
    
    fn is_entry_valid(&self, entry: &CacheEntry) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .as_secs();
        
        let age = now - entry.created_at;
        
        // Check TTL
        if age >= entry.ttl {
            return false;
        }
        
        // Check version consistency
        let current_version = self.get_current_version();
        if entry.version != current_version {
            return false;
        }
        
        true
    }
    
    fn update_access_stats_local(&self, key: &str, hit: bool) {
        if let Some(entry) = self.local_cache.write().get_mut(key) {
            entry.access_count += 1;
            entry.last_accessed_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .as_secs();
        }
    }
    
    fn update_access_stats_remote(&self, key: &str, hit: bool) {
        // Would update Redis access stats here
        // For now, just update local cache if entry exists
        self.update_access_stats_local(key, hit);
    }
    
    fn update_hit_rate(&self, stats: &mut CacheStats) {
        let total_requests = stats.local_hits + stats.remote_hits + stats.misses;

        if total_requests > 0 {
            stats.hit_rate = (stats.local_hits + stats.remote_hits) as f64 / total_requests as f64;
        }

        // Update average access count
        let cache = self.local_cache.read();
        if !cache.is_empty() {
            let total_access: u64 = cache.values().map(|e| e.access_count).sum();
            stats.avg_access_count = total_access as f64 / cache.len() as f64;
        }
    }
    
    fn get_current_version(&self) -> u64 {
        self.version_counter.try_read().map(|v| *v).unwrap_or(0)
    }
    
    fn increment_version(&self) {
        if let Ok(mut v) = self.version_counter.try_write() {
            *v += 1;
        }
    }
    
    fn start_cleanup_task(&self) {
        let cleanup_rx = Arc::clone(&self.cleanup_rx);
        let interval = Duration::from_secs(self.config.cleanup_interval_secs);
        let local_cache = Arc::clone(&self.local_cache);
        let stats = Arc::clone(&self.stats);
        let cleanup_tx = self.cleanup_tx.clone();
        
        tokio::spawn(async move {
            let mut rx = cleanup_rx.lock().await;
            
            let mut interval_timer = tokio::time::interval(interval);
            
            loop {
                tokio::select! {
                    _ = interval_timer.tick() => {
                        Self::cleanup_expired_entries(&local_cache, &stats).await;
                    }
                    _ = rx.recv() => {
                        // Shutdown signal
                        break;
                    }
                }
            }
            
            // Signal completion
            let _ = cleanup_tx.send(());
        });
    }
    
    fn start_health_check_task(&self) {
        let redis_client = self.redis_client.clone();
        let stats = Arc::clone(&self.stats);
        let interval = Duration::from_secs(self.config.health_check_interval_secs);
        
        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);
            
            loop {
                interval_timer.tick().await;
                
                if let Some(client) = &redis_client {
                    match client.is_connected().await {
                        connected => {
                            let mut s = stats.write().await;
                            s.redis_connected = connected;
                        }
                    }
                } else {
                    let mut s = stats.write().await;
                    s.redis_connected = false;
                }
            }
        });
    }
    
    async fn cleanup_expired_entries(
        local_cache: &Arc<ParkingRwLock<BrownHashMap<String, CacheEntry>>>,
        stats: &Arc<TokioRwLock<CacheStats>>,
    ) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .as_secs();
        
        let mut cache = local_cache.write();
        let mut expired_keys = Vec::new();
        
        for (key, entry) in cache.iter() {
            let age = now - entry.created_at;
            if age >= entry.ttl {
                expired_keys.push(key.clone());
            }
        }
        
        // Remove expired entries
        for key in expired_keys {
            cache.remove(&key);
        }
        
        // Update statistics
        let mut s = stats.write().await;
        s.total_entries = cache.len();
        s.evictions += expired_keys.len() as u64;
        s.last_cleanup = now;
    }
}

// ============================================================================
// Health Status
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheHealthStatus {
    pub healthy: bool,
    pub local_cache_size: usize,
    pub redis_connected: bool,
    pub hit_rate: f64,
    pub error_count: u64,
    pub last_cleanup: u64,
}

// ============================================================================
// FFI Exports
// ============================================================================

/// Create new cache adapter
#[no_mangle]
pub extern "C" fn cache_adapter_create(config_json: *const c_char) -> *mut c_void {
    let context = FFIContext::new("cache_create", 5000);
    
    safe_ffi_wrapper(context, move || {
        // Parse configuration
        let config_str = crate::ffi_guard::safe_read_c_string(config_json)?;
        let config: CacheConfig = serde_json::from_str(&config_str)
            .map_err(|e| FFIError::InvalidInput(format!("Invalid config: {}", e)))?;
        
        // Create adapter
        let adapter = match tokio::block_on(CacheAdapter::new(config)) {
            Ok(adapter) => adapter,
            Err(e) => return Err(FFIError::InternalError(format!("Failed to create cache adapter: {}", e))),
        };
        
        Box::into_raw(Box::new(adapter)) as *mut c_void
    })
}

/// Get cached value
#[no_mangle]
pub extern "C" fn cache_adapter_get(
    adapter_ptr: *mut c_void,
    model_id: *const c_char,
    feature_hash: *const c_char,
    policy_tags_json: *const c_char,
    result_ptr: *mut *mut c_char
) -> i32 {
    let context = FFIContext::new("cache_get", 5000);
    
    if adapter_ptr.is_null() || model_id.is_null() || feature_hash.is_null() {
        crate::ffi_guard::safe_free_string(*result_ptr);
        return FFIError::NullPointer as i32;
    }
    
    safe_ffi_wrapper(context, move || {
        let adapter = unsafe { &*(adapter_ptr as *const CacheAdapter) };
        
        let model_id_str = crate::ffi_guard::safe_read_c_string(model_id)?;
        let feature_hash_str = crate::ffi_guard::safe_read_c_string(feature_hash)?;
        
        let policy_tags = if !policy_tags_json.is_null() {
            let tags_json = crate::ffi_guard::safe_read_c_string(policy_tags_json)?;
            serde_json::from_str::<Vec<String>>(&tags_json)
                .map_err(|e| FFIError::InvalidInput(format!("Invalid policy tags: {}", e)))?
        } else {
            vec![]
        };
        
        match adapter.get_cache(&model_id_str, &feature_hash_str, &policy_tags).await {
            Ok(Some(data)) => {
                let c_string = crate::ffi_guard::safe_create_c_string(&data);
                unsafe {
                    *result_ptr = c_string;
                }
            }
            Ok(None) => {
                unsafe {
                    *result_ptr = ptr::null_mut();
                }
            }
            Err(error) => {
                let error_json = crate::ffi_guard::safe_create_c_string(&format!("{{\"error\": \"{}\"}}", error));
                unsafe {
                    *result_ptr = error_json;
                }
            }
        }
        
        Ok(())
    })
}

/// Set cached value
#[no_mangle]
pub extern "C" fn cache_adapter_set(
    adapter_ptr: *mut c_void,
    model_id: *const c_char,
    feature_hash: *const c_char,
    policy_tags_json: *const c_char,
    data: *const c_char,
    ttl_seconds: u64
) -> i32 {
    let context = FFIContext::new("cache_set", 5000);
    
    if adapter_ptr.is_null() || model_id.is_null() || feature_hash.is_null() || data.is_null() {
        return FFIError::NullPointer as i32;
    }
    
    safe_ffi_wrapper(context, move || {
        let adapter = unsafe { &*(adapter_ptr as *const CacheAdapter) };
        
        let model_id_str = crate::ffi_guard::safe_read_c_string(model_id)?;
        let feature_hash_str = crate::ffi_guard::safe_read_c_string(feature_hash)?;
        let data_str = crate::ffi_guard::safe_read_c_string(data)?;
        
        let policy_tags = if !policy_tags_json.is_null() {
            let tags_json = crate::ffi_guard::safe_read_c_string(policy_tags_json)?;
            serde_json::from_str::<Vec<String>>(&tags_json)
                .map_err(|e| FFIError::InvalidInput(format!("Invalid policy tags: {}", e)))?
        } else {
            vec![]
        };
        
        adapter.set_cache(&model_id_str, &feature_hash_str, &policy_tags, &data_str, Some(ttl_seconds)).await
    })
}

/// Invalidate cache entries
#[no_mangle]
pub extern "C" fn cache_adapter_invalidate(
    adapter_ptr: *mut c_void,
    pattern: *const c_char
) -> u64 {
    let context = FFIContext::new("cache_invalidate", 5000);
    
    if adapter_ptr.is_null() || pattern.is_null() {
        return 0;
    }
    
    safe_ffi_wrapper(context, move || {
        let adapter = unsafe { &*(adapter_ptr as *const CacheAdapter) };
        let pattern_str = crate::ffi_guard::safe_read_c_string(pattern)?;
        
        adapter.invalidate(&pattern_str).await.unwrap_or(0)
    })
}

/// Get cache statistics
#[no_mangle]
pub extern "C" fn cache_adapter_get_stats(adapter_ptr: *mut c_void) -> *mut c_char {
    let context = FFIContext::new("cache_stats", 1000);
    
    if adapter_ptr.is_null() {
        let error = crate::ffi_guard::safe_create_c_string("{\"error\":\"Null pointer\"}");
        return error;
    }
    
    safe_ffi_wrapper(context, move || {
        let adapter = unsafe { &*(adapter_ptr as *const CacheAdapter) };
        let stats = adapter.get_stats().await;
        
        let stats_json = serde_json::to_string(&stats);
        crate::ffi_guard::safe_create_c_string(&stats_json)
    })
}

/// Health check
#[no_mangle]
pub extern "C" fn cache_adapter_health_check(adapter_ptr: *mut c_void) -> *mut c_char {
    let context = FFIContext::new("cache_health", 1000);
    
    if adapter_ptr.is_null() {
        let error = crate::ffi_guard::safe_create_c_string("{\"error\":\"Null pointer\"}");
        return error;
    }
    
    safe_ffi_wrapper(context, move || {
        let adapter = unsafe { &*(adapter_ptr as *const CacheAdapter) };
        let health = adapter.health_check().await;
        
        let health_json = serde_json::to_string(&health);
        crate::ffi_guard::safe_create_c_string(&health_json)
    })
}

/// Destroy cache adapter
#[no_mangle]
pub extern "C" fn cache_adapter_destroy(adapter_ptr: *mut c_void) -> i32 {
    if adapter_ptr.is_null() {
        return FFIError::NullPointer as i32;
    }
    
    let _adapter = unsafe { Box::from_raw(adapter_ptr as *mut CacheAdapter) };
    
    FFIError::Success as i32
}

// ============================================================================
// Additional utility functions
// ============================================================================

/// Feature hash function for cache keys
pub fn hash_features(features: &[f64]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    features.hash(&mut hasher);
    
    // Use first 8 characters of hash for cache keys
    format!("{:08x}", hasher.finish())
}

/// Model performance cache key
pub fn build_model_cache_key(model_id: &str, task: &str) -> String {
    format!("model:{}:task:{}", model_id, task)
}

/// Batch cache operations
pub struct BatchCacheOps {
    adapter: Arc<CacheAdapter>,
    batch_size: usize,
}

impl BatchCacheOps {
    pub fn new(adapter: Arc<CacheAdapter>, batch_size: usize) -> Self {
        Self {
            adapter,
            batch_size,
        }
    }
    
    /// Batch get operations
    pub async fn batch_get(&self, requests: Vec<(String, String, Vec<String>)>) -> Vec<Option<String>> {
        let futures: Vec<_> = requests
            .iter()
            .map(|(model_id, feature_hash, tags)| {
                let adapter = Arc::clone(&self.adapter);
                async move {
                    adapter.get_cache(model_id, feature_hash, &tags).await
                }
            })
            .collect();
        
        let results = futures::future::join_all(futures).await;
        
        results.into_iter()
            .map(|r| match r {
                Ok(Some(data)) => Some(data),
                Ok(None) | Err(_) => None,
            })
            .collect()
    }
}

// Tests
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_cache_adapter_creation() {
        let config = CacheConfig::default();
        let adapter = CacheAdapter::new(config).await.unwrap();
        
        let stats = adapter.get_stats().await;
        assert_eq!(stats.total_entries, 0);
        assert!(stats.hit_rate >= 0.0);
    }
    
    #[tokio::test]
    async fn test_cache_set_get() {
        let config = CacheConfig::default();
        let adapter = Arc::new(CacheAdapter::new(config).await.unwrap());
        
        let model_id = "test_model";
        let feature_hash = hash_features(&[1.0, 2.0, 3.0]);
        let policy_tags = vec!["high_performance".to_string()];
        let data = r#"{"prediction": 0.85, "confidence": 0.9}"#;
        
        // Set cache
        adapter.set_cache(&model_id, &feature_hash, &policy_tags, data, Some(300)).await.unwrap();
        
        // Get cache
        let result = adapter.get_cache(&model_id, &feature_hash, &policy_tags).await.unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap(), data);
    }
    
    #[tokio::test]
    async fn test_cache_invalidation() {
        let config = CacheConfig::default();
        let adapter = Arc::new(CacheAdapter::new(config).await.unwrap());
        
        // Set multiple entries
        adapter.set_cache("model1", "hash1", &["tag1"], "data1", Some(300)).await.unwrap();
        adapter.set_cache("model2", "hash2", &["tag2"], "data2", Some(300)).await.unwrap();
        
        // Invalidate
        let invalidated = adapter.invalidate("model1").await.unwrap();
        assert_eq!(invalidated, 1);
        
        // Verify cache miss
        let result = adapter.get_cache("model1", "hash1", &["tag1"]).await.unwrap();
        assert!(result.is_none());
        
        // Verify other model still cached
        let result = adapter.get_cache("model2", "hash2", &["tag2"]).await.unwrap();
        assert!(result.is_some());
    }
    
    #[test]
    fn test_feature_hash() {
        let hash1 = hash_features(&[1.0, 2.0, 3.0]);
        let hash2 = hash_features(&[1.0, 2.0, 3.0]);
        let hash3 = hash_features(&[1.0, 2.0, 4.0]);
        
        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
        assert!(hash1.len() == 16); // Hex string length
    }
}
