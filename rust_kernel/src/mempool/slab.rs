//! Slab Allocator for Memory Pooling
//!
//! Provides fast, lock-free object pooling with automatic reuse

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use crossbeam::queue::SegQueue;
use std::ops::{Deref, DerefMut};

use super::stats::PoolStats;

/// Slab-based memory pool for objects of type T
pub struct SlabAllocator<T> {
    /// Free objects ready for reuse
    free_list: Arc<SegQueue<Box<T>>>,

    /// Total number of allocations
    total_allocations: AtomicU64,

    /// Number of reuses from free list
    reuse_count: AtomicU64,

    /// Currently active objects
    active_count: AtomicUsize,

    /// Factory function for new objects
    factory: Arc<dyn Fn() -> T + Send + Sync>,
}

impl<T: Default + Send + 'static> SlabAllocator<T> {
    /// Create a new slab allocator
    pub fn new() -> Self {
        Self::with_factory(Arc::new(T::default))
    }

    /// Create a slab allocator with custom factory
    pub fn with_factory(factory: Arc<dyn Fn() -> T + Send + Sync>) -> Self {
        Self {
            free_list: Arc::new(SegQueue::new()),
            total_allocations: AtomicU64::new(0),
            reuse_count: AtomicU64::new(0),
            active_count: AtomicUsize::new(0),
            factory,
        }
    }

    /// Acquire an object from the pool
    pub fn acquire(&self) -> PooledObject<T> {
        // Fast path: try to reuse from free list
        if let Some(obj) = self.free_list.pop() {
            self.reuse_count.fetch_add(1, Ordering::Relaxed);
            self.active_count.fetch_add(1, Ordering::Relaxed);

            return PooledObject {
                inner: Some(obj),
                pool: Arc::downgrade(&self.free_list),
                active_count: Some(Arc::new(AtomicUsize::new(self.active_count.load(Ordering::Relaxed)))),
            };
        }

        // Slow path: allocate new object
        self.total_allocations.fetch_add(1, Ordering::Relaxed);
        self.active_count.fetch_add(1, Ordering::Relaxed);

        PooledObject {
            inner: Some(Box::new((self.factory)())),
            pool: Arc::downgrade(&self.free_list),
            active_count: Some(Arc::new(AtomicUsize::new(self.active_count.load(Ordering::Relaxed)))),
        }
    }

    /// Get pool statistics
    pub fn stats(&self) -> PoolStats {
        let total = self.total_allocations.load(Ordering::Relaxed);
        let reused = self.reuse_count.load(Ordering::Relaxed);

        PoolStats {
            total_allocations: total,
            reuse_count: reused,
            reuse_ratio: if total > 0 {
                reused as f64 / total as f64
            } else {
                0.0
            },
            active_objects: self.active_count.load(Ordering::Relaxed),
            free_objects: self.free_list.len(),
        }
    }

    /// Clear all free objects (for testing)
    pub fn clear(&self) {
        while self.free_list.pop().is_some() {}
    }
}

impl<T: Default + Send + 'static> Default for SlabAllocator<T> {
    fn default() -> Self {
        Self::new()
    }
}

/// RAII wrapper for pooled objects
///
/// Automatically returns objects to the pool when dropped
pub struct PooledObject<T> {
    inner: Option<Box<T>>,
    pool: std::sync::Weak<SegQueue<Box<T>>>,
    active_count: Option<Arc<AtomicUsize>>,
}

impl<T> PooledObject<T> {
    /// Extract the inner value, consuming this wrapper
    pub fn into_inner(mut self) -> Box<T> {
        self.inner.take().expect("PooledObject already consumed")
    }
}

impl<T> Deref for PooledObject<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        self.inner.as_ref().expect("PooledObject already consumed")
    }
}

impl<T> DerefMut for PooledObject<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.inner.as_mut().expect("PooledObject already consumed")
    }
}

impl<T> Drop for PooledObject<T> {
    fn drop(&mut self) {
        if let Some(obj) = self.inner.take() {
            // Return to pool if it still exists
            if let Some(pool) = self.pool.upgrade() {
                pool.push(obj);

                // Decrement active count
                if let Some(counter) = &self.active_count {
                    counter.fetch_sub(1, Ordering::Relaxed);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Default)]
    struct TestObject {
        data: Vec<u8>,
    }

    #[test]
    fn test_slab_allocator_basic() {
        let pool = SlabAllocator::<TestObject>::new();

        let obj1 = pool.acquire();
        let obj2 = pool.acquire();

        let stats = pool.stats();
        assert_eq!(stats.total_allocations, 2);
        assert_eq!(stats.active_objects, 2);
    }

    #[test]
    fn test_slab_allocator_reuse() {
        let pool = SlabAllocator::<TestObject>::new();

        // Allocate and drop
        {
            let _obj = pool.acquire();
        }

        // Should reuse
        let _obj2 = pool.acquire();

        let stats = pool.stats();
        assert_eq!(stats.total_allocations, 1);
        assert_eq!(stats.reuse_count, 1);
        assert!(stats.reuse_ratio > 0.0);
    }

    #[test]
    fn test_slab_allocator_high_reuse() {
        let pool = SlabAllocator::<TestObject>::new();

        // Warm up pool
        let mut objects = Vec::new();
        for _ in 0..100 {
            objects.push(pool.acquire());
        }

        // Release all
        objects.clear();

        // Reuse test
        for _ in 0..100 {
            let _obj = pool.acquire();
        }

        let stats = pool.stats();
        // Should have 100% reuse on second batch
        assert!(stats.reuse_ratio >= 0.5); // At least 50% overall
    }
}
