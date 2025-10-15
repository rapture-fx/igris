# Phase 7: Parallel Batch Processing Design

**Date**: 2025-10-10
**Status**: Design Complete
**Target**: 1400+ RPS @ <150ms P99

---

## 🎯 Objectives

### Performance Targets
| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Throughput (RPS) | TBD | ≥1400 | +17% |
| P99 Latency (ms) | TBD | ≤150 | Maintain |
| Cache Hit Rate | TBD | ≥97% | +2% |
| Batch Fusion | 0% | ≥70% | New |
| Prefetch Overhead | N/A | ≤5% CPU | New |

### Stability Requirements
- **72-hour crash-free** run at 5x baseline
- **Deterministic routing** preserved
- **QoS guarantees** for latency-sensitive models
- **FFI safety** under concurrent load

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inference Request Stream                      │
│                    (100-2000 RPS variable)                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              Priority Queue (Per-Model Lanes)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ High Priority│  │ Normal       │  │ Low Priority │          │
│  │ (QoS: <50ms) │  │ (QoS: <150ms)│  │ (Best Effort)│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Batch Fusion Layer                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Micro-Batch Builder (Configurable)                        │ │
│  │  • Max size: 64 requests                                   │ │
│  │  • Max wait: 10ms                                          │ │
│  │  • Adaptive sizing based on queue depth                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              Parallel Worker Pool                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Tokio Async Workers (I/O Bound)                  │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  │
│  │  │Worker 1 │  │Worker 2 │  │Worker 3 │  │Worker 4 │    │  │
│  │  │(Async)  │  │(Async)  │  │(Async)  │  │(Async)  │    │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │  │
│  └───────┼────────────┼────────────┼────────────┼──────────┘  │
│          │            │            │            │              │
│  ┌───────▼────────────▼────────────▼────────────▼──────────┐  │
│  │         Rayon Thread Pool (CPU Bound)                   │  │
│  │  • Model inference                                      │  │
│  │  • Post-processing                                      │  │
│  │  • Batch aggregation                                    │  │
│  │  • Work stealing enabled                                │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Response Aggregation                           │
│  • Scatter-gather results                                        │
│  • Error handling & rollback                                     │
│  • Metrics collection                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Batch Fusion Algorithm

### Design Principles
1. **Latency-sensitive**: Never exceed configured max wait time
2. **Throughput-optimized**: Fill batches to target size when possible
3. **QoS-aware**: Respect per-model latency requirements
4. **Adaptive**: Adjust batch size based on queue depth and load

### Algorithm Pseudocode

```rust
struct BatchFusionConfig {
    max_batch_size: usize,      // Default: 64
    max_wait_ms: u64,           // Default: 10ms
    target_fill_ratio: f64,     // Default: 0.8 (80%)
    adaptive_sizing: bool,      // Default: true
}

async fn fusion_loop(config: BatchFusionConfig) {
    let mut current_batch = Vec::new();
    let mut batch_timer = Instant::now();

    loop {
        // Check fusion conditions
        let should_flush =
            current_batch.len() >= config.max_batch_size ||
            batch_timer.elapsed().as_millis() >= config.max_wait_ms ||
            (adaptive_sizing && queue_depth_high());

        if should_flush && !current_batch.is_empty() {
            // Dispatch batch
            dispatch_to_workers(current_batch).await;
            current_batch = Vec::new();
            batch_timer = Instant::now();
        }

        // Collect new requests
        match timeout(remaining_wait_time(), request_rx.recv()).await {
            Ok(Some(req)) => {
                current_batch.push(req);
            }
            Ok(None) => break, // Channel closed
            Err(_) => {
                // Timeout - flush what we have
                if !current_batch.is_empty() {
                    dispatch_to_workers(current_batch).await;
                    current_batch = Vec::new();
                    batch_timer = Instant::now();
                }
            }
        }
    }
}
```

### Adaptive Sizing Logic

```rust
fn calculate_adaptive_batch_size(
    base_size: usize,
    queue_depth: usize,
    worker_utilization: f64
) -> usize {
    // Scale up when queue is growing and workers are idle
    if queue_depth > 100 && worker_utilization < 0.5 {
        return (base_size as f64 * 1.5) as usize;
    }

    // Scale down when queue is empty or workers saturated
    if queue_depth < 10 || worker_utilization > 0.9 {
        return (base_size as f64 * 0.7) as usize;
    }

    base_size
}
```

---

## 👷 Worker Pool Architecture

### Tokio + Rayon Integration

```rust
pub struct ParallelBatchProcessor {
    // Configuration
    config: WorkerPoolConfig,

    // Tokio workers for I/O
    tokio_workers: usize,

    // Rayon pool for CPU-bound work
    rayon_pool: Arc<rayon::ThreadPool>,

    // Work queue
    batch_queue: Arc<SegQueue<MicroBatch>>,

    // Metrics
    metrics: Arc<WorkerMetrics>,

    // Shutdown signal
    shutdown: Arc<AtomicBool>,
}

impl ParallelBatchProcessor {
    pub fn new(config: WorkerPoolConfig) -> Self {
        // Build Rayon pool
        let rayon_pool = rayon::ThreadPoolBuilder::new()
            .num_threads(config.rayon_threads)
            .thread_name(|i| format!("rayon-worker-{}", i))
            .build()
            .expect("Failed to build Rayon pool");

        Self {
            config,
            tokio_workers: config.tokio_workers,
            rayon_pool: Arc::new(rayon_pool),
            batch_queue: Arc::new(SegQueue::new()),
            metrics: Arc::new(WorkerMetrics::new()),
            shutdown: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn start(&self) {
        // Spawn Tokio workers
        for worker_id in 0..self.tokio_workers {
            let queue = Arc::clone(&self.batch_queue);
            let pool = Arc::clone(&self.rayon_pool);
            let metrics = Arc::clone(&self.metrics);
            let shutdown = Arc::clone(&self.shutdown);

            tokio::spawn(async move {
                Self::worker_loop(worker_id, queue, pool, metrics, shutdown).await
            });
        }
    }

    async fn worker_loop(
        worker_id: usize,
        queue: Arc<SegQueue<MicroBatch>>,
        rayon_pool: Arc<rayon::ThreadPool>,
        metrics: Arc<WorkerMetrics>,
        shutdown: Arc<AtomicBool>,
    ) {
        info!("Worker {} started", worker_id);

        while !shutdown.load(Ordering::Relaxed) {
            // Try to get batch from queue
            if let Some(batch) = queue.pop() {
                metrics.record_batch_start(worker_id);

                // Process batch in Rayon pool
                let results = rayon_pool.install(|| {
                    Self::process_batch_parallel(batch)
                });

                metrics.record_batch_complete(worker_id, results.len());
            } else {
                // Queue empty - yield
                tokio::task::yield_now().await;
            }
        }

        info!("Worker {} stopped", worker_id);
    }

    fn process_batch_parallel(batch: MicroBatch) -> Vec<BatchResult> {
        // Use Rayon for parallel processing
        batch.requests.par_iter()
            .map(|req| process_single_request(req))
            .collect()
    }
}
```

### Worker Configuration

```rust
pub struct WorkerPoolConfig {
    /// Number of Tokio async workers
    pub tokio_workers: usize,

    /// Number of Rayon CPU threads
    pub rayon_threads: usize,

    /// Enable thread pinning for cache locality
    pub enable_affinity: bool,

    /// Queue capacity before backpressure
    pub max_queue_depth: usize,

    /// Worker idle timeout
    pub idle_timeout_ms: u64,
}

impl Default for WorkerPoolConfig {
    fn default() -> Self {
        let cpu_count = num_cpus::get();

        Self {
            tokio_workers: cpu_count,
            rayon_threads: cpu_count,
            enable_affinity: false, // Requires elevated permissions
            max_queue_depth: 1000,
            idle_timeout_ms: 100,
        }
    }
}
```

---

## 📊 Priority Queue Implementation

### Per-Model QoS Lanes

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    High = 3,      // <50ms SLA
    Normal = 2,    // <150ms SLA
    Low = 1,       // Best effort
    Background = 0, // Prefetch, warmup
}

pub struct PriorityQueue {
    queues: HashMap<Priority, SegQueue<InferenceRequest>>,
    metrics: Arc<QueueMetrics>,
}

impl PriorityQueue {
    pub fn new() -> Self {
        let mut queues = HashMap::new();
        queues.insert(Priority::High, SegQueue::new());
        queues.insert(Priority::Normal, SegQueue::new());
        queues.insert(Priority::Low, SegQueue::new());
        queues.insert(Priority::Background, SegQueue::new());

        Self {
            queues,
            metrics: Arc::new(QueueMetrics::new()),
        }
    }

    pub fn enqueue(&self, req: InferenceRequest, priority: Priority) {
        if let Some(queue) = self.queues.get(&priority) {
            queue.push(req);
            self.metrics.record_enqueue(priority);
        }
    }

    pub fn dequeue_batch(&self, max_size: usize) -> Vec<InferenceRequest> {
        let mut batch = Vec::with_capacity(max_size);

        // Drain high priority first
        for priority in [Priority::High, Priority::Normal, Priority::Low, Priority::Background] {
            if let Some(queue) = self.queues.get(&priority) {
                while batch.len() < max_size {
                    if let Some(req) = queue.pop() {
                        batch.push(req);
                        self.metrics.record_dequeue(priority);
                    } else {
                        break;
                    }
                }

                if batch.len() >= max_size {
                    break;
                }
            }
        }

        batch
    }

    pub fn len(&self, priority: Priority) -> usize {
        self.queues.get(&priority)
            .map(|q| q.len())
            .unwrap_or(0)
    }

    pub fn total_len(&self) -> usize {
        self.queues.values()
            .map(|q| q.len())
            .sum()
    }
}
```

---

## 🔧 Thread Affinity (Optional)

### CPU Pinning for Cache Locality

```rust
#[cfg(target_os = "linux")]
pub mod affinity {
    use libc::{cpu_set_t, sched_setaffinity, CPU_SET, CPU_ZERO};

    pub fn pin_to_core(core_id: usize) -> Result<(), String> {
        unsafe {
            let mut cpuset: cpu_set_t = std::mem::zeroed();
            CPU_ZERO(&mut cpuset);
            CPU_SET(core_id, &mut cpuset);

            if sched_setaffinity(0, std::mem::size_of::<cpu_set_t>(), &cpuset) != 0 {
                return Err(format!("Failed to set affinity to core {}", core_id));
            }
        }

        Ok(())
    }

    pub fn get_numa_node(core_id: usize) -> Option<usize> {
        // Read from /sys/devices/system/cpu/cpu{}/node{}/
        // Simplified implementation
        Some(core_id / 8) // Assume 8 cores per NUMA node
    }
}

// Usage in worker initialization
fn init_worker_with_affinity(worker_id: usize, enable_affinity: bool) {
    if enable_affinity {
        #[cfg(target_os = "linux")]
        {
            if let Err(e) = affinity::pin_to_core(worker_id) {
                warn!("Failed to pin worker {}: {}", worker_id, e);
            } else {
                info!("Worker {} pinned to core {}", worker_id, worker_id);
            }
        }
    }
}
```

---

## 📈 Metrics Collection

### Batch-Level Metrics

```rust
pub struct WorkerMetrics {
    // Batch statistics
    batch_count: AtomicU64,
    batch_size_sum: AtomicU64,
    batch_wait_time_sum_ms: AtomicU64,

    // Worker utilization
    worker_idle_count: Vec<AtomicU64>,
    worker_active_count: Vec<AtomicU64>,

    // Fusion efficiency
    single_request_batches: AtomicU64,
    multi_request_batches: AtomicU64,
}

impl WorkerMetrics {
    pub fn fusion_efficiency(&self) -> f64 {
        let total = self.batch_count.load(Ordering::Relaxed);
        let multi = self.multi_request_batches.load(Ordering::Relaxed);

        if total == 0 {
            0.0
        } else {
            multi as f64 / total as f64
        }
    }

    pub fn average_batch_size(&self) -> f64 {
        let total_size = self.batch_size_sum.load(Ordering::Relaxed);
        let count = self.batch_count.load(Ordering::Relaxed);

        if count == 0 {
            0.0
        } else {
            total_size as f64 / count as f64
        }
    }

    pub fn worker_utilization(&self, worker_id: usize) -> f64 {
        let active = self.worker_active_count[worker_id].load(Ordering::Relaxed);
        let idle = self.worker_idle_count[worker_id].load(Ordering::Relaxed);
        let total = active + idle;

        if total == 0 {
            0.0
        } else {
            active as f64 / total as f64
        }
    }
}
```

### Prometheus Integration

```rust
use prometheus::{
    Counter, Histogram, Gauge, IntGauge,
    register_counter, register_histogram, register_gauge, register_int_gauge
};

lazy_static! {
    // Batch metrics
    static ref BATCH_SIZE: Histogram = register_histogram!(
        "batch_size",
        "Distribution of batch sizes",
        vec![1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 64.0, 128.0]
    ).unwrap();

    static ref BATCH_WAIT_TIME: Histogram = register_histogram!(
        "batch_wait_time_ms",
        "Time requests wait in fusion queue",
        vec![1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0]
    ).unwrap();

    static ref BATCH_FUSION_RATE: Gauge = register_gauge!(
        "batch_fusion_rate",
        "Percentage of batches with >1 request"
    ).unwrap();

    // Worker metrics
    static ref WORKER_UTILIZATION: Gauge = register_gauge!(
        "worker_utilization",
        "Worker pool utilization (0-1)"
    ).unwrap();

    static ref QUEUE_DEPTH: IntGauge = register_int_gauge!(
        "priority_queue_depth",
        "Current depth of priority queue"
    ).unwrap();

    // Throughput
    static ref BATCHES_PROCESSED: Counter = register_counter!(
        "batches_processed_total",
        "Total batches processed"
    ).unwrap();
}

// Export metrics
pub fn record_batch_metrics(batch_size: usize, wait_time_ms: u64, fusion_rate: f64) {
    BATCH_SIZE.observe(batch_size as f64);
    BATCH_WAIT_TIME.observe(wait_time_ms as f64);
    BATCH_FUSION_RATE.set(fusion_rate);
    BATCHES_PROCESSED.inc();
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_batch_fusion_max_size() {
        let config = BatchFusionConfig {
            max_batch_size: 10,
            max_wait_ms: 1000,
            ..Default::default()
        };

        let (tx, rx) = mpsc::unbounded_channel();

        // Send 15 requests
        for i in 0..15 {
            tx.send(InferenceRequest { id: i, .. }).unwrap();
        }

        let batches = collect_batches(rx, config).await;

        // Should create 2 batches: 10 + 5
        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0].len(), 10);
        assert_eq!(batches[1].len(), 5);
    }

    #[tokio::test]
    async fn test_batch_fusion_timeout() {
        let config = BatchFusionConfig {
            max_batch_size: 100,
            max_wait_ms: 10,
            ..Default::default()
        };

        let start = Instant::now();
        let batches = collect_batches_with_timeout(config).await;

        // Should flush after 10ms even if not full
        assert!(start.elapsed().as_millis() <= 15);
        assert!(!batches.is_empty());
    }

    #[test]
    fn test_priority_queue_ordering() {
        let queue = PriorityQueue::new();

        queue.enqueue(req1, Priority::Low);
        queue.enqueue(req2, Priority::High);
        queue.enqueue(req3, Priority::Normal);

        let batch = queue.dequeue_batch(10);

        // Should get high priority first
        assert_eq!(batch[0].id, req2.id);
        assert_eq!(batch[1].id, req3.id);
        assert_eq!(batch[2].id, req1.id);
    }
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_end_to_end_parallel_processing() {
    let processor = ParallelBatchProcessor::new(WorkerPoolConfig::default());
    processor.start().await;

    // Send 1000 requests
    let mut handles = vec![];
    for i in 0..1000 {
        let handle = processor.submit(InferenceRequest { id: i, .. });
        handles.push(handle);
    }

    // Wait for all results
    let results = futures::future::join_all(handles).await;

    // Verify all succeeded
    assert_eq!(results.len(), 1000);
    assert!(results.iter().all(|r| r.is_ok()));

    // Check metrics
    let metrics = processor.metrics();
    assert!(metrics.fusion_efficiency() >= 0.5); // At least 50% fusion
    assert!(metrics.average_batch_size() > 1.0);
}
```

---

## 🎯 Success Criteria

### Performance
- [ ] Sustained throughput ≥1400 RPS
- [ ] P99 latency ≤150ms
- [ ] Batch fusion rate ≥70%
- [ ] Worker utilization 70-90%

### Stability
- [ ] Zero crashes in 72-hour run
- [ ] Memory stable (no leaks)
- [ ] CPU usage predictable

### Quality
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Loom concurrency tests passing
- [ ] FFI safety verified

---

**Status**: Design complete, ready for implementation
**Next**: Implement core fusion loop and worker pool
