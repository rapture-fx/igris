//! Worker Pool - Tokio + Rayon parallel processing
//!
//! Combines async I/O (Tokio) with CPU-bound parallelism (Rayon)

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use crossbeam::queue::SegQueue;
use serde::{Deserialize, Serialize};
use log::{info, debug};

use super::fusion::MicroBatch;
use super::metrics::WorkerMetrics;

/// Worker pool configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerPoolConfig {
    /// Number of Tokio async workers
    pub tokio_workers: usize,

    /// Number of Rayon CPU threads
    pub rayon_threads: usize,

    /// Queue capacity before backpressure
    pub max_queue_depth: usize,

    /// Worker idle timeout (ms)
    pub idle_timeout_ms: u64,
}

impl Default for WorkerPoolConfig {
    fn default() -> Self {
        let cpu_count = num_cpus::get();

        Self {
            tokio_workers: cpu_count,
            rayon_threads: cpu_count,
            max_queue_depth: 1000,
            idle_timeout_ms: 100,
        }
    }
}

/// Parallel batch processor using Tokio + Rayon
pub struct ParallelBatchProcessor<T, R>
where
    T: Send + 'static,
    R: Send + 'static,
{
    config: WorkerPoolConfig,
    rayon_pool: Arc<rayon::ThreadPool>,
    batch_queue: Arc<SegQueue<MicroBatch<T>>>,
    metrics: Arc<WorkerMetrics>,
    shutdown: Arc<AtomicBool>,
    _phantom: std::marker::PhantomData<R>,
}

impl<T, R> ParallelBatchProcessor<T, R>
where
    T: Send + Clone + 'static,
    R: Send + 'static,
{
    pub fn new(config: WorkerPoolConfig) -> Self {
        // Build Rayon thread pool
        let rayon_pool = rayon::ThreadPoolBuilder::new()
            .num_threads(config.rayon_threads)
            .thread_name(|i| format!("rayon-worker-{}", i))
            .build()
            .expect("Failed to build Rayon pool");

        info!(
            "Created worker pool: {} Tokio workers, {} Rayon threads",
            config.tokio_workers, config.rayon_threads
        );

        Self {
            config: config.clone(),
            rayon_pool: Arc::new(rayon_pool),
            batch_queue: Arc::new(SegQueue::new()),
            metrics: Arc::new(WorkerMetrics::new(config.tokio_workers)),
            shutdown: Arc::new(AtomicBool::new(false)),
            _phantom: std::marker::PhantomData,
        }
    }

    /// Start worker pool
    pub fn start<F>(&self, processor: F)
    where
        F: Fn(Vec<T>) -> Vec<R> + Send + Sync + Clone + 'static,
    {
        let processor = Arc::new(processor);

        // Spawn Tokio workers
        for worker_id in 0..self.config.tokio_workers {
            let queue = Arc::clone(&self.batch_queue);
            let rayon_pool = Arc::clone(&self.rayon_pool);
            let metrics = Arc::clone(&self.metrics);
            let shutdown = Arc::clone(&self.shutdown);
            let proc = Arc::clone(&processor);

            tokio::spawn(async move {
                Self::worker_loop(worker_id, queue, rayon_pool, metrics, shutdown, proc).await
            });
        }

        info!("Worker pool started");
    }

    /// Worker event loop
    async fn worker_loop<F>(
        worker_id: usize,
        queue: Arc<SegQueue<MicroBatch<T>>>,
        rayon_pool: Arc<rayon::ThreadPool>,
        metrics: Arc<WorkerMetrics>,
        shutdown: Arc<AtomicBool>,
        processor: Arc<F>,
    )
    where
        F: Fn(Vec<T>) -> Vec<R> + Send + Sync + 'static,
    {
        debug!("Worker {} started", worker_id);

        while !shutdown.load(Ordering::Relaxed) {
            if let Some(batch) = queue.pop() {
                let batch_size = batch.len();
                let wait_time_ms = batch.average_wait_time().as_millis() as u64;

                metrics.record_batch_start(worker_id, batch_size);
                metrics.record_batch_wait_time(wait_time_ms);

                // Extract requests from batch
                let requests: Vec<T> = batch.requests
                    .into_iter()
                    .map(|r| r.inner)
                    .collect();

                // Process in Rayon pool (CPU-bound)
                let results = rayon_pool.install(|| {
                    processor(requests)
                });

                metrics.record_batch_complete(worker_id, results.len());
            } else {
                // Queue empty - yield to avoid busy loop
                tokio::task::yield_now().await;
            }
        }

        debug!("Worker {} stopped", worker_id);
    }

    /// Submit batch for processing
    pub fn submit_batch(&self, batch: MicroBatch<T>) {
        self.batch_queue.push(batch);
    }

    /// Get current queue depth
    pub fn queue_depth(&self) -> usize {
        self.batch_queue.len()
    }

    /// Get metrics
    pub fn metrics(&self) -> Arc<WorkerMetrics> {
        Arc::clone(&self.metrics)
    }

    /// Shutdown worker pool gracefully
    pub fn shutdown(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
        info!("Worker pool shutdown initiated");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::fusion::BatchableRequest;
    use super::super::priority::Priority;
    use std::time::Instant;

    #[derive(Debug, Clone)]
    struct TestRequest {
        id: usize,
    }

    #[derive(Debug, Clone)]
    struct TestResult {
        id: usize,
        value: usize,
    }

    #[tokio::test]
    async fn test_worker_pool_basic() {
        let config = WorkerPoolConfig {
            tokio_workers: 2,
            rayon_threads: 2,
            ..Default::default()
        };

        let processor = ParallelBatchProcessor::<TestRequest, TestResult>::new(config);

        // Simple processor: double the ID
        processor.start(|reqs| {
            reqs.iter()
                .map(|r| TestResult { id: r.id, value: r.id * 2 })
                .collect()
        });

        // Create and submit batch
        let mut batch = MicroBatch::new(10);
        for i in 0..10 {
            batch.requests.push(BatchableRequest {
                inner: TestRequest { id: i },
                received_at: Instant::now(),
                priority: Priority::Normal,
            });
        }

        processor.submit_batch(batch);

        // Wait for processing
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Check metrics
        let metrics = processor.metrics();
        let snapshot = metrics.snapshot();

        assert!(snapshot.total_batches >= 1);
        assert!(snapshot.total_requests >= 10);
    }
}
