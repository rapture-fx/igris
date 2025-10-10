//! Batch Fusion - Adaptive micro-batching with latency caps
//!
//! Intelligently combines incoming requests into optimally-sized batches
//! while respecting strict latency requirements.

use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tokio::time::timeout;
use serde::{Deserialize, Serialize};
use log::{debug, info};

/// Configuration for batch fusion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchFusionConfig {
    /// Maximum requests per batch
    pub max_batch_size: usize,

    /// Maximum time to wait for batch to fill (ms)
    pub max_wait_ms: u64,

    /// Target fill ratio (0.0-1.0)
    pub target_fill_ratio: f64,

    /// Enable adaptive sizing based on queue depth
    pub adaptive_sizing: bool,

    /// Minimum batch size before flushing
    pub min_batch_size: usize,
}

impl Default for BatchFusionConfig {
    fn default() -> Self {
        Self {
            max_batch_size: 64,
            max_wait_ms: 10,
            target_fill_ratio: 0.8,
            adaptive_sizing: true,
            min_batch_size: 1,
        }
    }
}

/// Request wrapper for batching
#[derive(Debug, Clone)]
pub struct BatchableRequest<T> {
    pub inner: T,
    pub received_at: Instant,
    pub priority: crate::parallel::Priority,
}

/// Micro-batch of requests
#[derive(Debug)]
pub struct MicroBatch<T> {
    pub requests: Vec<BatchableRequest<T>>,
    pub created_at: Instant,
    pub target_size: usize,
}

impl<T> MicroBatch<T> {
    pub fn new(target_size: usize) -> Self {
        Self {
            requests: Vec::with_capacity(target_size),
            created_at: Instant::now(),
            target_size,
        }
    }

    pub fn len(&self) -> usize {
        self.requests.len()
    }

    pub fn is_empty(&self) -> bool {
        self.requests.is_empty()
    }

    pub fn age(&self) -> Duration {
        self.created_at.elapsed()
    }

    pub fn is_full(&self) -> bool {
        self.requests.len() >= self.target_size
    }

    pub fn average_wait_time(&self) -> Duration {
        if self.requests.is_empty() {
            return Duration::from_secs(0);
        }

        let total: Duration = self.requests
            .iter()
            .map(|r| r.received_at.elapsed())
            .sum();

        total / self.requests.len() as u32
    }
}

/// Batch fusion engine
pub struct BatchFuser<T> {
    config: BatchFusionConfig,
    request_rx: mpsc::UnboundedReceiver<BatchableRequest<T>>,
    batch_tx: mpsc::UnboundedSender<MicroBatch<T>>,
}

impl<T> BatchFuser<T>
where
    T: Send + 'static,
{
    pub fn new(
        config: BatchFusionConfig,
        request_rx: mpsc::UnboundedReceiver<BatchableRequest<T>>,
        batch_tx: mpsc::UnboundedSender<MicroBatch<T>>,
    ) -> Self {
        Self {
            config,
            request_rx,
            batch_tx,
        }
    }

    /// Start the fusion loop
    pub async fn run(mut self) {
        info!("Batch fusion engine started");
        let mut current_batch = Some(MicroBatch::new(self.config.max_batch_size));
        let mut batch_timer = Instant::now();

        loop {
            let mut batch = current_batch.take().unwrap();
            // Calculate remaining wait time
            let elapsed_ms = batch_timer.elapsed().as_millis() as u64;
            let remaining_ms = self.config.max_wait_ms.saturating_sub(elapsed_ms);

            // Check if we should flush the current batch
            let should_flush = self.should_flush_batch(&batch);

            if should_flush && !batch.is_empty() {
                let batch_size = batch.len();
                let batch_age = batch.age();

                debug!(
                    "Flushing batch: size={}, age={:?}",
                    batch_size,
                    batch_age
                );

                // Send batch to workers
                if self.batch_tx.send(batch).is_err() {
                    info!("Batch channel closed, stopping fusion loop");
                    break;
                }

                // Reset for next batch
                current_batch = Some(MicroBatch::new(self.calculate_adaptive_batch_size()));
                batch_timer = Instant::now();
                continue;
            }

            // Try to collect a new request (with timeout)
            match timeout(Duration::from_millis(remaining_ms), self.request_rx.recv()).await {
                Ok(Some(req)) => {
                    batch.requests.push(req);
                    current_batch = Some(batch);
                }
                Ok(None) => {
                    // Channel closed - flush remaining
                    if !batch.is_empty() {
                        let _ = self.batch_tx.send(batch);
                    }
                    info!("Request channel closed, stopping fusion loop");
                    break;
                }
                Err(_) => {
                    // Timeout - flush if we have anything
                    if !batch.is_empty() {
                        if self.batch_tx.send(batch).is_err() {
                            break;
                        }
                        current_batch = Some(MicroBatch::new(self.calculate_adaptive_batch_size()));
                        batch_timer = Instant::now();
                    } else {
                        current_batch = Some(batch);
                    }
                }
            }
        }

        info!("Batch fusion engine stopped");
    }

    /// Determine if current batch should be flushed
    fn should_flush_batch(&self, batch: &MicroBatch<T>) -> bool {
        // Empty batch - don't flush
        if batch.is_empty() {
            return false;
        }

        // Full batch - always flush
        if batch.is_full() {
            return true;
        }

        // Time limit exceeded - flush
        if batch.age().as_millis() >= self.config.max_wait_ms as u128 {
            return true;
        }

        // Minimum size reached and target fill ratio met
        if batch.len() >= self.config.min_batch_size {
            let fill_ratio = batch.len() as f64 / batch.target_size as f64;
            if fill_ratio >= self.config.target_fill_ratio {
                return true;
            }
        }

        false
    }

    /// Calculate adaptive batch size based on current conditions
    fn calculate_adaptive_batch_size(&self) -> usize {
        if !self.config.adaptive_sizing {
            return self.config.max_batch_size;
        }

        // Get queue depth (approximate)
        let queue_depth = 0; // TODO: Track queue depth

        // Adaptive logic
        if queue_depth > 100 {
            // High load - increase batch size
            (self.config.max_batch_size as f64 * 1.2).min(128.0) as usize
        } else if queue_depth < 10 {
            // Low load - decrease batch size for lower latency
            (self.config.max_batch_size as f64 * 0.7).max(4.0) as usize
        } else {
            self.config.max_batch_size
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone)]
    struct TestRequest {
        id: usize,
    }

    #[tokio::test]
    async fn test_batch_fusion_max_size() {
        let config = BatchFusionConfig {
            max_batch_size: 10,
            max_wait_ms: 1000,
            ..Default::default()
        };

        let (req_tx, req_rx) = mpsc::unbounded_channel();
        let (batch_tx, mut batch_rx) = mpsc::unbounded_channel();

        // Start fuser
        tokio::spawn(async move {
            let fuser = BatchFuser::new(config, req_rx, batch_tx);
            fuser.run().await;
        });

        // Send 25 requests
        for i in 0..25 {
            req_tx.send(BatchableRequest {
                inner: TestRequest { id: i },
                received_at: Instant::now(),
                priority: crate::parallel::Priority::Normal,
            }).unwrap();
        }

        // Should get 3 batches: 10, 10, 5
        let batch1 = batch_rx.recv().await.unwrap();
        assert_eq!(batch1.len(), 10);

        let batch2 = batch_rx.recv().await.unwrap();
        assert_eq!(batch2.len(), 10);

        // Wait a bit for timeout
        tokio::time::sleep(Duration::from_millis(20)).await;
        let batch3 = batch_rx.recv().await.unwrap();
        assert_eq!(batch3.len(), 5);
    }

    #[tokio::test]
    async fn test_batch_fusion_timeout() {
        let config = BatchFusionConfig {
            max_batch_size: 100,
            max_wait_ms: 10,
            min_batch_size: 1,
            ..Default::default()
        };

        let (req_tx, req_rx) = mpsc::unbounded_channel();
        let (batch_tx, mut batch_rx) = mpsc::unbounded_channel();

        // Start fuser
        tokio::spawn(async move {
            let fuser = BatchFuser::new(config, req_rx, batch_tx);
            fuser.run().await;
        });

        // Send just 3 requests
        for i in 0..3 {
            req_tx.send(BatchableRequest {
                inner: TestRequest { id: i },
                received_at: Instant::now(),
                priority: crate::parallel::Priority::Normal,
            }).unwrap();
        }

        let start = Instant::now();

        // Should get batch after ~10ms timeout
        let batch = batch_rx.recv().await.unwrap();
        let elapsed = start.elapsed();

        assert_eq!(batch.len(), 3);
        assert!(elapsed.as_millis() >= 10);
        assert!(elapsed.as_millis() <= 50); // Some buffer for scheduling
    }

    #[test]
    fn test_micro_batch_operations() {
        let mut batch = MicroBatch::<TestRequest>::new(10);

        assert!(batch.is_empty());
        assert!(!batch.is_full());

        for i in 0..10 {
            batch.requests.push(BatchableRequest {
                inner: TestRequest { id: i },
                received_at: Instant::now(),
                priority: crate::parallel::Priority::Normal,
            });
        }

        assert_eq!(batch.len(), 10);
        assert!(batch.is_full());
        assert!(!batch.is_empty());
    }
}
