//! Unified Cache Module
//!
//! This module provides a clean, dependency-free cache layer with:
//! - Zero-copy data storage using `bytes::Bytes`
//! - Multiple cache policies (LRU, TTL, FIFO)
//! - Async-first design
//! - No circular dependencies

pub mod adapter;
pub mod coherence;
pub mod policy;

pub use adapter::{CacheAdapter, CacheConfig, CacheEntry, CacheStats};
pub use coherence::{CacheCoherenceSweeper, CoherenceConfig};
pub use policy::{CachePolicy, LruPolicy};
