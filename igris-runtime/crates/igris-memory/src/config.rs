//! Memory configuration

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub enabled: bool,
    pub db_path: String,
    pub max_cache_entries: usize,
    pub embedding_dim: usize,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            db_path: "agent_memory.db".to_string(),
            max_cache_entries: 1000,
            embedding_dim: 384,
        }
    }
}
