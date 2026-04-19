//! Real-time task executor with priority scheduling

use crate::{Priority, RtConfig, RtMetrics, RtResult};
use anyhow::Result;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{Mutex, Semaphore};
use tracing::{debug, info, warn};

pub type TaskPriority = Priority;

/// A real-time task with priority and deadline tracking
pub struct RtTask<T> {
    pub priority: Priority,
    #[allow(dead_code)]
    future: Pin<Box<dyn Future<Output = T> + Send + 'static>>,
}

impl<T: 'static> RtTask<T> {
    pub fn new<F>(priority: Priority, future: F) -> Self
    where
        F: Future<Output = T> + Send + 'static,
    {
        Self {
            priority,
            future: Box::pin(future),
        }
    }
}

/// Real-time task executor
pub struct RtExecutor {
    config: RtConfig,
    metrics: Arc<Mutex<RtMetrics>>,
    semaphore: Arc<Semaphore>,
}

impl RtExecutor {
    /// Create a new RT executor with the given configuration
    pub fn new(config: RtConfig) -> Self {
        let max_concurrent = config.max_concurrent_tasks;
        Self {
            config,
            metrics: Arc::new(Mutex::new(RtMetrics::default())),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
        }
    }

    /// Execute a task with the given priority
    pub async fn execute<T, F>(&self, priority: Priority, future: F) -> Result<RtResult<T>>
    where
        F: Future<Output = T> + Send + 'static,
        T: Send + 'static,
    {
        if !self.config.enabled {
            // RT mode disabled, execute directly
            let start = Instant::now();
            let value = future.await;
            let latency = start.elapsed();
            return Ok(RtResult::new(value, latency, priority));
        }

        // Acquire semaphore permit for concurrency control
        let _permit = self.semaphore.acquire().await?;

        let start = Instant::now();

        debug!(
            priority = ?priority,
            deadline_ms = priority.latency_bound().as_millis(),
            "Executing RT task"
        );

        let value = future.await;
        let latency = start.elapsed();

        let result = RtResult::new(value, latency, priority);

        // Update metrics
        if self.config.enable_metrics {
            let mut metrics = self.metrics.lock().await;
            metrics.record_execution(&result);
        }

        // Warn if deadline missed or exceeds threshold
        if !result.deadline_met {
            warn!(
                priority = ?priority,
                latency_ms = latency.as_millis(),
                deadline_ms = priority.latency_bound().as_millis(),
                "RT task missed deadline"
            );
        } else if latency.as_millis() > self.config.warn_threshold_ms as u128 {
            warn!(
                priority = ?priority,
                latency_ms = latency.as_millis(),
                threshold_ms = self.config.warn_threshold_ms,
                "RT task exceeded warning threshold"
            );
        } else {
            info!(
                priority = ?priority,
                latency_ms = latency.as_millis(),
                "RT task completed successfully"
            );
        }

        Ok(result)
    }

    /// Get current metrics
    pub async fn metrics(&self) -> RtMetrics {
        self.metrics.lock().await.clone()
    }

    /// Reset metrics
    pub async fn reset_metrics(&self) {
        let mut metrics = self.metrics.lock().await;
        *metrics = RtMetrics::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_executor_basic() {
        let config = RtConfig {
            enabled: true,
            priority_level: 1,
            max_concurrent_tasks: 4,
            enable_metrics: true,
            warn_threshold_ms: 100,
        };

        let executor = RtExecutor::new(config);

        let result = executor
            .execute(Priority::Normal, async { 42 })
            .await
            .unwrap();

        assert_eq!(result.value, 42);
        assert!(result.deadline_met); // Should complete instantly
    }

    #[tokio::test]
    async fn test_executor_deadline_met() {
        let config = RtConfig {
            enabled: true,
            priority_level: 1,
            max_concurrent_tasks: 4,
            enable_metrics: true,
            warn_threshold_ms: 100,
        };

        let executor = RtExecutor::new(config);

        let result = executor
            .execute(Priority::Normal, async {
                sleep(Duration::from_millis(10)).await;
                "success"
            })
            .await
            .unwrap();

        assert_eq!(result.value, "success");
        assert!(result.deadline_met); // 10ms < 1000ms deadline
    }

    #[tokio::test]
    async fn test_executor_deadline_missed() {
        let config = RtConfig {
            enabled: true,
            priority_level: 1,
            max_concurrent_tasks: 4,
            enable_metrics: true,
            warn_threshold_ms: 100,
        };

        let executor = RtExecutor::new(config);

        let result = executor
            .execute(Priority::Critical, async {
                sleep(Duration::from_millis(100)).await;
                "slow"
            })
            .await
            .unwrap();

        assert_eq!(result.value, "slow");
        assert!(!result.deadline_met); // 100ms > 50ms critical deadline
    }

    #[tokio::test]
    async fn test_executor_disabled() {
        let config = RtConfig {
            enabled: false,
            ..Default::default()
        };

        let executor = RtExecutor::new(config);

        let result = executor
            .execute(Priority::Normal, async { "test" })
            .await
            .unwrap();

        assert_eq!(result.value, "test");
    }

    #[tokio::test]
    async fn test_executor_metrics() {
        let config = RtConfig {
            enabled: true,
            priority_level: 1,
            max_concurrent_tasks: 4,
            enable_metrics: true,
            warn_threshold_ms: 100,
        };

        let executor = RtExecutor::new(config);

        // Execute some tasks
        executor
            .execute(Priority::Normal, async { 1 })
            .await
            .unwrap();
        executor.execute(Priority::High, async { 2 }).await.unwrap();

        let metrics = executor.metrics().await;
        assert_eq!(metrics.total_executions, 2);
    }
}
