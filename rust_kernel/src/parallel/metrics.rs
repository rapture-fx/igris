//! Worker Pool Metrics
//!
//! Comprehensive metrics collection for parallel batch processing

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::Instant;
use serde::{Deserialize, Serialize};

/// Worker pool performance metrics
pub struct WorkerMetrics {
    // Batch statistics
    batch_count: AtomicU64,
    batch_size_sum: AtomicU64,
    batch_wait_time_sum_ms: AtomicU64,

    // Worker utilization
    worker_count: usize,
    worker_idle_count: Vec<AtomicU64>,
    worker_active_count: Vec<AtomicU64>,

    // Fusion efficiency
    single_request_batches: AtomicU64,
    multi_request_batches: AtomicU64,

    // Throughput tracking
    requests_processed: AtomicU64,
    start_time: Instant,
}

impl WorkerMetrics {
    pub fn new(worker_count: usize) -> Self {
        let mut worker_idle_count = Vec::with_capacity(worker_count);
        let mut worker_active_count = Vec::with_capacity(worker_count);

        for _ in 0..worker_count {
            worker_idle_count.push(AtomicU64::new(0));
            worker_active_count.push(AtomicU64::new(0));
        }

        Self {
            batch_count: AtomicU64::new(0),
            batch_size_sum: AtomicU64::new(0),
            batch_wait_time_sum_ms: AtomicU64::new(0),
            worker_count,
            worker_idle_count,
            worker_active_count,
            single_request_batches: AtomicU64::new(0),
            multi_request_batches: AtomicU64::new(0),
            requests_processed: AtomicU64::new(0),
            start_time: Instant::now(),
        }
    }

    /// Record batch processing start
    pub fn record_batch_start(&self, worker_id: usize, batch_size: usize) {
        if worker_id < self.worker_count {
            self.worker_active_count[worker_id].fetch_add(1, Ordering::Relaxed);
        }

        self.batch_count.fetch_add(1, Ordering::Relaxed);
        self.batch_size_sum.fetch_add(batch_size as u64, Ordering::Relaxed);

        if batch_size == 1 {
            self.single_request_batches.fetch_add(1, Ordering::Relaxed);
        } else {
            self.multi_request_batches.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Record batch processing complete
    pub fn record_batch_complete(&self, worker_id: usize, requests_count: usize) {
        if worker_id < self.worker_count {
            self.worker_idle_count[worker_id].fetch_add(1, Ordering::Relaxed);
        }

        self.requests_processed.fetch_add(requests_count as u64, Ordering::Relaxed);
    }

    /// Record batch wait time
    pub fn record_batch_wait_time(&self, wait_time_ms: u64) {
        self.batch_wait_time_sum_ms.fetch_add(wait_time_ms, Ordering::Relaxed);
    }

    /// Get batch fusion efficiency (percentage of multi-request batches)
    pub fn fusion_efficiency(&self) -> f64 {
        let total = self.batch_count.load(Ordering::Relaxed);
        let multi = self.multi_request_batches.load(Ordering::Relaxed);

        if total == 0 {
            0.0
        } else {
            multi as f64 / total as f64
        }
    }

    /// Get average batch size
    pub fn average_batch_size(&self) -> f64 {
        let total_size = self.batch_size_sum.load(Ordering::Relaxed);
        let count = self.batch_count.load(Ordering::Relaxed);

        if count == 0 {
            0.0
        } else {
            total_size as f64 / count as f64
        }
    }

    /// Get average batch wait time (ms)
    pub fn average_wait_time_ms(&self) -> f64 {
        let total_wait = self.batch_wait_time_sum_ms.load(Ordering::Relaxed);
        let count = self.batch_count.load(Ordering::Relaxed);

        if count == 0 {
            0.0
        } else {
            total_wait as f64 / count as f64
        }
    }

    /// Get worker utilization (0.0 - 1.0)
    pub fn worker_utilization(&self, worker_id: usize) -> f64 {
        if worker_id >= self.worker_count {
            return 0.0;
        }

        let active = self.worker_active_count[worker_id].load(Ordering::Relaxed);
        let idle = self.worker_idle_count[worker_id].load(Ordering::Relaxed);
        let total = active + idle;

        if total == 0 {
            0.0
        } else {
            active as f64 / total as f64
        }
    }

    /// Get overall worker pool utilization
    pub fn overall_utilization(&self) -> f64 {
        let mut total_active = 0u64;
        let mut total_idle = 0u64;

        for i in 0..self.worker_count {
            total_active += self.worker_active_count[i].load(Ordering::Relaxed);
            total_idle += self.worker_idle_count[i].load(Ordering::Relaxed);
        }

        let total = total_active + total_idle;

        if total == 0 {
            0.0
        } else {
            total_active as f64 / total as f64
        }
    }

    /// Get current throughput (RPS)
    pub fn current_throughput(&self) -> f64 {
        let requests = self.requests_processed.load(Ordering::Relaxed);
        let elapsed_secs = self.start_time.elapsed().as_secs_f64();

        if elapsed_secs == 0.0 {
            0.0
        } else {
            requests as f64 / elapsed_secs
        }
    }

    /// Get snapshot of all metrics
    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            total_batches: self.batch_count.load(Ordering::Relaxed),
            average_batch_size: self.average_batch_size(),
            fusion_efficiency: self.fusion_efficiency(),
            average_wait_time_ms: self.average_wait_time_ms(),
            overall_utilization: self.overall_utilization(),
            throughput_rps: self.current_throughput(),
            total_requests: self.requests_processed.load(Ordering::Relaxed),
        }
    }
}

/// Snapshot of metrics at a point in time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    pub total_batches: u64,
    pub average_batch_size: f64,
    pub fusion_efficiency: f64,
    pub average_wait_time_ms: f64,
    pub overall_utilization: f64,
    pub throughput_rps: f64,
    pub total_requests: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_worker_metrics_basic() {
        let metrics = WorkerMetrics::new(4);

        // Simulate batch processing
        metrics.record_batch_start(0, 10);
        metrics.record_batch_complete(0, 10);

        assert_eq!(metrics.batch_count.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.average_batch_size(), 10.0);
    }

    #[test]
    fn test_fusion_efficiency() {
        let metrics = WorkerMetrics::new(4);

        // 3 multi-request batches
        metrics.record_batch_start(0, 10);
        metrics.record_batch_start(0, 5);
        metrics.record_batch_start(0, 8);

        // 2 single-request batches
        metrics.record_batch_start(0, 1);
        metrics.record_batch_start(0, 1);

        // Efficiency should be 3/5 = 60%
        assert!((metrics.fusion_efficiency() - 0.6).abs() < 0.01);
    }

    #[test]
    fn test_worker_utilization() {
        let metrics = WorkerMetrics::new(2);

        // Worker 0: 7 active, 3 idle = 70%
        for _ in 0..7 {
            metrics.worker_active_count[0].fetch_add(1, Ordering::Relaxed);
        }
        for _ in 0..3 {
            metrics.worker_idle_count[0].fetch_add(1, Ordering::Relaxed);
        }

        assert!((metrics.worker_utilization(0) - 0.7).abs() < 0.01);
    }

    #[test]
    fn test_average_wait_time() {
        let metrics = WorkerMetrics::new(4);

        metrics.record_batch_start(0, 5);
        metrics.record_batch_wait_time(10);

        metrics.record_batch_start(0, 3);
        metrics.record_batch_wait_time(20);

        // Average should be (10 + 20) / 2 = 15ms
        assert_eq!(metrics.average_wait_time_ms(), 15.0);
    }
}
