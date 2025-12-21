//! KV cache for prompt caching

use anyhow::Result;
use std::collections::HashMap;

pub struct KVCache {
    cache: HashMap<String, Vec<u8>>,
    max_entries: usize,
    hits: u64,
    misses: u64,
}

impl KVCache {
    pub fn new(max_entries: usize) -> Result<Self> {
        Ok(Self {
            cache: HashMap::new(),
            max_entries,
            hits: 0,
            misses: 0,
        })
    }

    pub fn put(&mut self, key: String, value: Vec<u8>) {
        if self.cache.len() >= self.max_entries {
            // Simple eviction: remove first entry
            if let Some(k) = self.cache.keys().next().cloned() {
                self.cache.remove(&k);
            }
        }
        self.cache.insert(key, value);
    }

    pub fn get(&mut self, key: &str) -> Option<Vec<u8>> {
        if let Some(value) = self.cache.get(key) {
            self.hits += 1;
            Some(value.clone())
        } else {
            self.misses += 1;
            None
        }
    }

    pub fn clear(&mut self) {
        self.cache.clear();
        self.hits = 0;
        self.misses = 0;
    }

    pub fn len(&self) -> usize {
        self.cache.len()
    }

    pub fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0
        } else {
            self.hits as f64 / total as f64
        }
    }
}
