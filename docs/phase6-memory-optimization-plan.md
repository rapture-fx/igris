# Phase 6: Caching & Memory Pooling Optimization

**Date**: 2025-10-10
**Status**: In Progress
**Objective**: Achieve 1200+ RPS with <150ms P99 latency and ≥85% memory reuse

---

## 🎯 Goals

### Performance Targets
| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Throughput (RPS) | TBD | ≥1200 | +35% |
| P99 Latency (ms) | TBD | ≤150 | -25% |
| Memory Reuse | 0% | ≥85% | New |
| Cache Hit Rate | TBD | ≥95% | New |
| CPU Efficiency | TBD | ≥80% | +15% |

### Technical Objectives
1. **Zero circular dependencies** in cache modules
2. **Memory pool** with 85%+ reuse ratio
3. **Unified cache layer** (policy, inference, routing)
4. **Zero-copy buffers** throughout the pipeline
5. **Parallel batch processing** with work-stealing

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Inference Request                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Memory Pool (Batch Allocator)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Free Pool   │  │ Active Pool │  │ Recycle Pool│         │
│  │ (Slab 1-4K) │  │ (In Use)    │  │ (Pending)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Unified Cache Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Policy Cache  │  │Inference Cache│  │Routing Cache │      │
│  │(LRU + TTL)   │  │(Arc<Bytes>)  │  │(Lock-free)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Parallel Batch Processor                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ Worker 1│  │ Worker 2│  │ Worker 3│  │ Worker 4│       │
│  │(Tokio)  │  │(Tokio)  │  │(Tokio)  │  │(Tokio)  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│              ▲                                               │
│              │ Rayon ThreadPool (CPU-bound work)            │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Plan

### Day 1-2: Memory Pooling Infrastructure

#### 1.1 Fix Circular Dependencies
**Problem**: `cache_adapter` ↔ `cache_coherence` ↔ `adaptive_batching`

**Solution**:
```rust
// Create new structure:
src/
  cache/
    mod.rs           // Re-exports all cache types
    adapter.rs       // Core cache logic (no deps)
    coherence.rs     // Depends on adapter
    policy.rs        // Cache policies

  batching/
    mod.rs
    controller.rs    // Depends on cache::adapter
    pool.rs          // Memory pool (no cache deps)

  mempool/
    mod.rs
    slab.rs          // Slab allocator
    arena.rs         // Arena allocator
```

#### 1.2 Memory Pool Implementation
```rust
// src/mempool/slab.rs
pub struct SlabAllocator<T> {
    slabs: Vec<Slab<T>>,
    free_list: Vec<*mut T>,
    active_count: AtomicUsize,
    total_allocations: AtomicU64,
    reuse_count: AtomicU64,
}

impl<T> SlabAllocator<T> {
    pub fn acquire(&self) -> PooledObject<T> {
        // Try free list first (fast path)
        if let Some(ptr) = self.free_list.pop() {
            self.reuse_count.fetch_add(1, Ordering::Relaxed);
            return PooledObject::from_raw(ptr);
        }

        // Allocate new (slow path)
        self.total_allocations.fetch_add(1, Ordering::Relaxed);
        PooledObject::new(T::default())
    }

    pub fn release(&self, obj: PooledObject<T>) {
        self.free_list.push(obj.into_raw());
    }

    pub fn stats(&self) -> PoolStats {
        let total = self.total_allocations.load(Ordering::Relaxed);
        let reused = self.reuse_count.load(Ordering::Relaxed);

        PoolStats {
            reuse_ratio: reused as f64 / total as f64,
            active: self.active_count.load(Ordering::Relaxed),
            total_allocs: total,
        }
    }
}
```

**Performance Target**: <0.2ms allocation time, 85%+ reuse

---

### Day 3-4: Unified Cache Layer

#### 3.1 Cache Module Structure
```rust
// src/cache/mod.rs
pub mod adapter;
pub mod coherence;
pub mod policy;
pub mod prefetch;

pub use adapter::{CacheAdapter, CacheEntry};
pub use policy::{CachePolicy, LruPolicy, TtlPolicy};
pub use prefetch::CachePrefetcher;

// No circular imports - clean dependency graph
```

#### 3.2 Zero-Copy Cache Entries
```rust
use bytes::Bytes;

pub struct CacheEntry {
    key: Arc<str>,
    data: Bytes,              // Zero-copy buffer
    metadata: EntryMetadata,
    version: u64,
}

impl CacheEntry {
    pub fn data(&self) -> &Bytes {
        &self.data  // No clone, just ref
    }

    pub fn clone_data(&self) -> Bytes {
        self.data.clone()  // Cheap: just Arc increment
    }
}
```

#### 3.3 Cache Prefetching
```rust
pub struct CachePrefetcher {
    predictor: AccessPredictor,
    warmup_queue: mpsc::UnboundedSender<String>,
}

impl CachePrefetcher {
    pub async fn predict_and_warm(&self, key: &str) {
        let predictions = self.predictor.predict_next(key, 5);

        for predicted_key in predictions {
            // Async warmup - don't block
            self.warmup_queue.send(predicted_key).ok();
        }
    }
}
```

**Target**: 95%+ cache hit rate with predictive warming

---

### Day 5: Parallel Batch Processing

#### 5.1 Work-Stealing Batch Processor
```rust
use tokio::task::JoinSet;
use rayon::ThreadPoolBuilder;

pub struct ParallelBatchProcessor {
    tokio_workers: usize,
    rayon_pool: rayon::ThreadPool,
    batch_queue: Arc<SegQueue<Batch>>,
}

impl ParallelBatchProcessor {
    pub async fn process_parallel(&self, batches: Vec<Batch>) -> Vec<Result> {
        let mut join_set = JoinSet::new();

        // Spawn Tokio tasks for I/O-bound work
        for batch in batches.chunks(32) {
            let pool = self.rayon_pool.clone();

            join_set.spawn(async move {
                // CPU-bound: offload to Rayon
                pool.install(|| {
                    batch.par_iter()
                        .map(|item| process_item(item))
                        .collect()
                })
            });
        }

        // Collect results
        let mut results = Vec::new();
        while let Some(res) = join_set.join_next().await {
            results.extend(res?);
        }

        results
    }
}
```

**Target**: 1200+ RPS with balanced CPU/I/O utilization

---

## 🧪 Testing Strategy

### 1. Memory Pool Tests
```rust
#[test]
fn test_pool_reuse_ratio() {
    let pool = SlabAllocator::<Batch>::new(1000);

    // Warm up pool
    let mut objects = Vec::new();
    for _ in 0..1000 {
        objects.push(pool.acquire());
    }

    // Release all
    for obj in objects {
        pool.release(obj);
    }

    // Reuse test
    for _ in 0..1000 {
        let _obj = pool.acquire();
    }

    let stats = pool.stats();
    assert!(stats.reuse_ratio >= 0.85); // 85%+ reuse
}
```

### 2. Cache Consistency Tests
```rust
#[tokio::test]
async fn test_cache_coherence_under_load() {
    let cache = UnifiedCache::new(config);

    // 1000 concurrent writers
    let mut handles = vec![];
    for i in 0..1000 {
        handles.push(tokio::spawn(async move {
            cache.set(format!("key_{}", i), data).await
        }));
    }

    join_all(handles).await;

    // Verify consistency
    let stats = cache.coherence_stats().await;
    assert!(stats.consistency_rate >= 0.9995); // 99.95%+
}
```

### 3. Stress Tests
```bash
# Load test with wrk
wrk -t8 -c200 -d60s --latency http://localhost:8080/api/inference

# Expected results:
# Requests/sec: ≥1200
# Latency P99:  ≤150ms
# Errors:       <0.01%
```

### 4. Memory Leak Tests
```bash
# Valgrind - 72h continuous run
valgrind --leak-check=full \
         --show-leak-kinds=all \
         --track-origins=yes \
         --log-file=memcheck.log \
         ./target/release/schlep_kernel_server

# Expected: 0 leaks after 72h
```

---

## 📊 Success Metrics

### Memory Efficiency
- **Allocation Time**: <0.2ms per request
- **Reuse Ratio**: ≥85%
- **Memory Footprint**: Stable <2GB under load
- **Fragmentation**: <5%

### Cache Performance
- **Hit Rate**: ≥95%
- **Prefetch Accuracy**: ≥70%
- **Consistency**: ≥99.95%
- **Eviction Efficiency**: <1% premature evictions

### Throughput & Latency
- **Sustained RPS**: ≥1200
- **P50 Latency**: ≤80ms
- **P99 Latency**: ≤150ms
- **P99.9 Latency**: ≤250ms

### Reliability
- **Uptime**: ≥99.99% (72h continuous)
- **Error Rate**: <0.01%
- **Crash-Free Runtime**: ≥72 hours
- **Memory Leaks**: 0

---

## 🔧 Dependencies to Add

```toml
[dependencies]
# Memory management
bytes = "1.5"
slab = "0.4"

# Parallel processing
rayon = "1.8"
crossbeam = "0.8"
dashmap = "5.5"

# Caching
lru = "0.12"
moka = { version = "0.12", features = ["sync"] }

# Monitoring
prometheus = "0.13"
metrics = "0.21"
```

---

## 🚧 Risk Mitigation

### Circular Dependencies
**Risk**: Module import cycles preventing compilation
**Mitigation**:
- Clear module hierarchy with `pub(crate)` boundaries
- Trait-based abstractions for loose coupling
- Lazy initialization where needed

### Memory Leaks at FFI Boundary
**Risk**: Rust/Go boundary leaking memory
**Mitigation**:
- Comprehensive leak tests with Valgrind
- Reference counting audits
- FFI ownership transfer documentation

### Data Races in Memory Pool
**Risk**: Concurrent access corruption
**Mitigation**:
- Loom concurrency testing
- Lock-free data structures (crossbeam)
- Atomic operations with proper ordering

### Cache Stampede
**Risk**: Multiple requests fetching same key simultaneously
**Mitigation**:
- Request coalescing
- Single-flight pattern
- Stale-while-revalidate cache policy

---

## 📅 Timeline

| Day | Milestone | Deliverables |
|-----|-----------|--------------|
| 1 | Fix circular deps | Clean module structure |
| 2 | Memory pooling | SlabAllocator with 85%+ reuse |
| 3 | Cache layer | Unified cache with zero-copy |
| 4 | Cache testing | 95%+ hit rate validated |
| 5 | Parallel batching | 1200+ RPS achieved |
| 6 | Stress testing | 72h continuous run |

---

**Status**: Ready to implement
**Next Action**: Fix circular dependencies and create module structure
