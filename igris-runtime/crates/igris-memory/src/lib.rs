//! Igris Advanced Memory Management
//!
//! Provides persistent vector storage, KV cache management, and semantic memory retrieval.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info};

pub mod config;
pub mod kv_cache;
pub mod vector_store;

pub use config::MemoryConfig;
pub use kv_cache::KVCache;
pub use vector_store::{MemoryEntry, SearchResult, VectorStore};

/// Agent memory manager with vector store and KV cache
pub struct AgentMemory {
    vector_store: Arc<RwLock<VectorStore>>,
    kv_cache: Arc<RwLock<KVCache>>,
    config: MemoryConfig,
}

impl AgentMemory {
    /// Create a new agent memory instance
    pub async fn new(config: MemoryConfig) -> Result<Self> {
        info!("Initializing agent memory: db_path={}", config.db_path);

        let vector_store = VectorStore::new(&config.db_path)?;
        let kv_cache = KVCache::new(config.max_cache_entries)?;

        Ok(Self {
            vector_store: Arc::new(RwLock::new(vector_store)),
            kv_cache: Arc::new(RwLock::new(kv_cache)),
            config,
        })
    }

    /// Store a memory entry with embeddings
    pub async fn store(&self, key: &str, content: &str, embedding: Vec<f32>) -> Result<()> {
        debug!("Storing memory entry: key={}", key);
        let mut store = self.vector_store.write().await;
        store.insert(key, content, embedding)
    }

    /// Retrieve semantically similar memories
    pub async fn retrieve(
        &self,
        query_embedding: Vec<f32>,
        top_k: usize,
    ) -> Result<Vec<SearchResult>> {
        debug!("Retrieving top {} similar memories", top_k);
        let store = self.vector_store.read().await;
        store.search(&query_embedding, top_k)
    }

    /// Get a specific memory by key
    pub async fn get(&self, key: &str) -> Result<Option<MemoryEntry>> {
        let store = self.vector_store.read().await;
        store.get(key)
    }

    /// Cache a KV pair (for prompt/response caching)
    pub async fn cache_put(&self, key: String, value: Vec<u8>) -> Result<()> {
        let mut cache = self.kv_cache.write().await;
        cache.put(key, value);
        Ok(())
    }

    /// Get cached value
    pub async fn cache_get(&self, key: &str) -> Option<Vec<u8>> {
        let mut cache = self.kv_cache.write().await;
        cache.get(key)
    }

    /// Clear all memory (vector store + cache)
    pub async fn clear_all(&self) -> Result<()> {
        info!("Clearing all agent memory");
        let mut store = self.vector_store.write().await;
        let mut cache = self.kv_cache.write().await;
        store.clear()?;
        cache.clear();
        Ok(())
    }

    /// Get memory statistics
    pub async fn stats(&self) -> MemoryStats {
        let store = self.vector_store.read().await;
        let cache = self.kv_cache.read().await;

        MemoryStats {
            vector_entries: store.len(),
            cache_entries: cache.len(),
            cache_hit_rate: cache.hit_rate(),
        }
    }

    /// Return the configured embedding dimension for callers that need to
    /// construct compatible query vectors.
    pub fn embedding_dim(&self) -> usize {
        self.config.embedding_dim
    }
}

/// Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    pub vector_entries: usize,
    pub cache_entries: usize,
    pub cache_hit_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_agent_memory_basic() {
        let config = MemoryConfig {
            enabled: true,
            db_path: "/tmp/test_memory.db".to_string(),
            max_cache_entries: 100,
            embedding_dim: 384,
        };

        let memory = AgentMemory::new(config).await.unwrap();

        // Store a memory
        let embedding = vec![0.1; 384];
        memory
            .store("test_key", "test content", embedding.clone())
            .await
            .unwrap();

        // Retrieve it
        let entry = memory.get("test_key").await.unwrap();
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().content, "test content");

        // Search
        let results = memory.retrieve(embedding, 1).await.unwrap();
        assert_eq!(results.len(), 1);
    }
}
