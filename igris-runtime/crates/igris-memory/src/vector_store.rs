//! Vector store for semantic memory

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sled::Db;
use std::cmp::Ordering;
use std::collections::BinaryHeap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub key: String,
    pub content: String,
    pub embedding: Vec<f32>,
    pub timestamp: u64,
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub entry: MemoryEntry,
    pub similarity: f64,
}

impl Eq for SearchResult {}

impl PartialEq for SearchResult {
    fn eq(&self, other: &Self) -> bool {
        self.similarity == other.similarity
    }
}

impl PartialOrd for SearchResult {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        other.similarity.partial_cmp(&self.similarity) // Reverse for max-heap
    }
}

impl Ord for SearchResult {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

pub struct VectorStore {
    db: Db,
}

impl VectorStore {
    pub fn new(path: &str) -> Result<Self> {
        let db = sled::open(path)?;
        Ok(Self { db })
    }

    pub fn insert(&mut self, key: &str, content: &str, embedding: Vec<f32>) -> Result<()> {
        let entry = MemoryEntry {
            key: key.to_string(),
            content: content.to_string(),
            embedding,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs(),
        };

        let encoded = serde_json::to_vec(&entry)?;
        self.db.insert(key.as_bytes(), encoded)?;
        Ok(())
    }

    pub fn get(&self, key: &str) -> Result<Option<MemoryEntry>> {
        if let Some(data) = self.db.get(key.as_bytes())? {
            let entry: MemoryEntry = serde_json::from_slice(&data)?;
            Ok(Some(entry))
        } else {
            Ok(None)
        }
    }

    pub fn search(&self, query_embedding: &[f32], top_k: usize) -> Result<Vec<SearchResult>> {
        let mut heap = BinaryHeap::new();

        for item in self.db.iter() {
            let (_key, value) = item?;
            let entry: MemoryEntry = serde_json::from_slice(&value)?;
            let similarity = cosine_similarity(query_embedding, &entry.embedding);

            heap.push(SearchResult { entry, similarity });
        }

        Ok(heap.into_sorted_vec().into_iter().take(top_k).collect())
    }

    pub fn clear(&mut self) -> Result<()> {
        self.db.clear()?;
        Ok(())
    }

    pub fn len(&self) -> usize {
        self.db.len()
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        (dot / (norm_a * norm_b)) as f64
    }
}
