//! Priority Queue Implementation
//!
//! Provides QoS-aware request queuing with multiple priority levels

use crossbeam::queue::SegQueue;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use serde::{Deserialize, Serialize};

/// Request priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Priority {
    /// Background tasks (prefetch, warmup)
    Background = 0,
    /// Best effort (no SLA)
    Low = 1,
    /// Standard SLA (<150ms)
    Normal = 2,
    /// High priority SLA (<50ms)
    High = 3,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::Normal
    }
}

/// Priority-aware queue with per-lane metrics
pub struct PriorityQueue<T> {
    queues: HashMap<Priority, Arc<SegQueue<T>>>,
    metrics: Arc<QueueMetrics>,
}

impl<T> PriorityQueue<T> {
    pub fn new() -> Self {
        let mut queues = HashMap::new();
        queues.insert(Priority::High, Arc::new(SegQueue::new()));
        queues.insert(Priority::Normal, Arc::new(SegQueue::new()));
        queues.insert(Priority::Low, Arc::new(SegQueue::new()));
        queues.insert(Priority::Background, Arc::new(SegQueue::new()));

        Self {
            queues,
            metrics: Arc::new(QueueMetrics::new()),
        }
    }

    /// Enqueue a request with given priority
    pub fn enqueue(&self, item: T, priority: Priority) {
        if let Some(queue) = self.queues.get(&priority) {
            queue.push(item);
            self.metrics.record_enqueue(priority);
        }
    }

    /// Dequeue highest priority item
    pub fn dequeue(&self) -> Option<T> {
        // Try queues in priority order
        for priority in [Priority::High, Priority::Normal, Priority::Low, Priority::Background] {
            if let Some(queue) = self.queues.get(&priority) {
                if let Some(item) = queue.pop() {
                    self.metrics.record_dequeue(priority);
                    return Some(item);
                }
            }
        }
        None
    }

    /// Dequeue a batch of items (up to max_size)
    pub fn dequeue_batch(&self, max_size: usize) -> Vec<T> {
        let mut batch = Vec::with_capacity(max_size);

        // Drain high priority first
        for priority in [Priority::High, Priority::Normal, Priority::Low, Priority::Background] {
            if let Some(queue) = self.queues.get(&priority) {
                while batch.len() < max_size {
                    if let Some(item) = queue.pop() {
                        batch.push(item);
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

    /// Get length of specific priority queue
    pub fn len(&self, priority: Priority) -> usize {
        self.queues.get(&priority)
            .map(|q| q.len())
            .unwrap_or(0)
    }

    /// Get total queue length across all priorities
    pub fn total_len(&self) -> usize {
        self.queues.values()
            .map(|q| q.len())
            .sum()
    }

    /// Check if queue is empty
    pub fn is_empty(&self) -> bool {
        self.total_len() == 0
    }

    /// Get queue metrics
    pub fn metrics(&self) -> Arc<QueueMetrics> {
        Arc::clone(&self.metrics)
    }
}

impl<T> Default for PriorityQueue<T> {
    fn default() -> Self {
        Self::new()
    }
}

/// Metrics for priority queue operations
pub struct QueueMetrics {
    enqueued: HashMap<Priority, AtomicU64>,
    dequeued: HashMap<Priority, AtomicU64>,
}

impl QueueMetrics {
    fn new() -> Self {
        let mut enqueued = HashMap::new();
        let mut dequeued = HashMap::new();

        for priority in [Priority::High, Priority::Normal, Priority::Low, Priority::Background] {
            enqueued.insert(priority, AtomicU64::new(0));
            dequeued.insert(priority, AtomicU64::new(0));
        }

        Self { enqueued, dequeued }
    }

    fn record_enqueue(&self, priority: Priority) {
        if let Some(counter) = self.enqueued.get(&priority) {
            counter.fetch_add(1, Ordering::Relaxed);
        }
    }

    fn record_dequeue(&self, priority: Priority) {
        if let Some(counter) = self.dequeued.get(&priority) {
            counter.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn total_enqueued(&self, priority: Priority) -> u64 {
        self.enqueued.get(&priority)
            .map(|c| c.load(Ordering::Relaxed))
            .unwrap_or(0)
    }

    pub fn total_dequeued(&self, priority: Priority) -> u64 {
        self.dequeued.get(&priority)
            .map(|c| c.load(Ordering::Relaxed))
            .unwrap_or(0)
    }

    pub fn pending(&self, priority: Priority) -> u64 {
        self.total_enqueued(priority).saturating_sub(self.total_dequeued(priority))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, PartialEq)]
    struct TestRequest {
        id: usize,
        priority: Priority,
    }

    #[test]
    fn test_priority_queue_ordering() {
        let queue = PriorityQueue::new();

        // Enqueue in mixed order
        queue.enqueue(TestRequest { id: 1, priority: Priority::Low }, Priority::Low);
        queue.enqueue(TestRequest { id: 2, priority: Priority::High }, Priority::High);
        queue.enqueue(TestRequest { id: 3, priority: Priority::Normal }, Priority::Normal);
        queue.enqueue(TestRequest { id: 4, priority: Priority::High }, Priority::High);

        // Dequeue should get high priority first
        let req1 = queue.dequeue().unwrap();
        assert_eq!(req1.id, 2);
        assert_eq!(req1.priority, Priority::High);

        let req2 = queue.dequeue().unwrap();
        assert_eq!(req2.id, 4);
        assert_eq!(req2.priority, Priority::High);

        let req3 = queue.dequeue().unwrap();
        assert_eq!(req3.id, 3);
        assert_eq!(req3.priority, Priority::Normal);

        let req4 = queue.dequeue().unwrap();
        assert_eq!(req4.id, 1);
        assert_eq!(req4.priority, Priority::Low);

        assert!(queue.is_empty());
    }

    #[test]
    fn test_priority_queue_batch_dequeue() {
        let queue = PriorityQueue::new();

        // Add 10 high, 10 normal, 10 low
        for i in 0..10 {
            queue.enqueue(TestRequest { id: i, priority: Priority::High }, Priority::High);
            queue.enqueue(TestRequest { id: i + 10, priority: Priority::Normal }, Priority::Normal);
            queue.enqueue(TestRequest { id: i + 20, priority: Priority::Low }, Priority::Low);
        }

        // Dequeue batch of 15
        let batch = queue.dequeue_batch(15);

        assert_eq!(batch.len(), 15);

        // First 10 should be high priority
        for i in 0..10 {
            assert_eq!(batch[i].priority, Priority::High);
        }

        // Next 5 should be normal priority
        for i in 10..15 {
            assert_eq!(batch[i].priority, Priority::Normal);
        }
    }

    #[test]
    fn test_queue_metrics() {
        let queue = PriorityQueue::new();
        let metrics = queue.metrics();

        queue.enqueue(TestRequest { id: 1, priority: Priority::High }, Priority::High);
        queue.enqueue(TestRequest { id: 2, priority: Priority::High }, Priority::High);
        queue.enqueue(TestRequest { id: 3, priority: Priority::Normal }, Priority::Normal);

        assert_eq!(metrics.total_enqueued(Priority::High), 2);
        assert_eq!(metrics.total_enqueued(Priority::Normal), 1);
        assert_eq!(metrics.pending(Priority::High), 2);

        queue.dequeue();
        assert_eq!(metrics.total_dequeued(Priority::High), 1);
        assert_eq!(metrics.pending(Priority::High), 1);
    }
}
