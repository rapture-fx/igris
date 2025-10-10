//! Memory Pool Statistics

use serde::{Deserialize, Serialize};

/// Statistics for a memory pool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStats {
    /// Total number of allocations (new objects created)
    pub total_allocations: u64,

    /// Number of object reuses from the pool
    pub reuse_count: u64,

    /// Reuse ratio (reuse_count / total_allocations)
    pub reuse_ratio: f64,

    /// Currently active (in-use) objects
    pub active_objects: usize,

    /// Objects waiting in the free list
    pub free_objects: usize,
}

impl PoolStats {
    /// Calculate memory efficiency score (0-100)
    pub fn efficiency_score(&self) -> f64 {
        (self.reuse_ratio * 100.0).min(100.0)
    }

    /// Check if pool is meeting target reuse ratio
    pub fn meets_target(&self, target_ratio: f64) -> bool {
        self.reuse_ratio >= target_ratio
    }
}

impl Default for PoolStats {
    fn default() -> Self {
        Self {
            total_allocations: 0,
            reuse_count: 0,
            reuse_ratio: 0.0,
            active_objects: 0,
            free_objects: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_efficiency_score() {
        let stats = PoolStats {
            reuse_ratio: 0.85,
            ..Default::default()
        };

        assert_eq!(stats.efficiency_score(), 85.0);
    }

    #[test]
    fn test_meets_target() {
        let stats = PoolStats {
            reuse_ratio: 0.90,
            ..Default::default()
        };

        assert!(stats.meets_target(0.85));
        assert!(!stats.meets_target(0.95));
    }
}
