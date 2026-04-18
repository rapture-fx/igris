//! Watchdog for detecting stuck nodes and infinite loops

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::time::{Duration, Instant};
use tracing::{error, warn};

/// Watchdog node that monitors child execution
///
/// Detects stuck nodes and infinite loops by tracking execution time.
/// If the child runs for too long without completing, the watchdog
/// triggers an emergency stop.
///
/// # Example
///
/// ```no_run
/// use igris_btree::prelude::*;
/// use igris_btree::safety::Watchdog;
/// use std::time::Duration;
///
/// let child = SetBlackboard::new("action", "key", "value");
///
/// let watchdog = Watchdog::new(
///     "safety",
///     Box::new(child),
///     Duration::from_secs(10),
/// );
/// ```
pub struct Watchdog {
    name: String,
    child: Box<dyn BTreeNode>,
    timeout: Duration,
    start_time: Option<Instant>,
    tick_count: u64,
    max_consecutive_running: u64,
    consecutive_running_count: u64,
}

impl Watchdog {
    /// Create a new watchdog with a timeout
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `child` - Child node to monitor
    /// * `timeout` - Maximum execution time before emergency stop
    pub fn new(name: impl Into<String>, child: Box<dyn BTreeNode>, timeout: Duration) -> Self {
        Self {
            name: name.into(),
            child,
            timeout,
            start_time: None,
            tick_count: 0,
            max_consecutive_running: 100,
            consecutive_running_count: 0,
        }
    }

    /// Set maximum consecutive Running status before warning
    ///
    /// Helps detect infinite loops where child keeps returning Running.
    pub fn with_max_consecutive_running(mut self, max: u64) -> Self {
        self.max_consecutive_running = max;
        self
    }

    /// Check if timeout has been exceeded
    fn check_timeout(&self) -> bool {
        if let Some(start) = self.start_time {
            start.elapsed() > self.timeout
        } else {
            false
        }
    }

    /// Emergency stop the child node
    async fn emergency_stop(&mut self) -> Result<NodeStatus> {
        error!(
            "⚠️ Watchdog '{}': EMERGENCY STOP triggered after {:?} ({} ticks)",
            self.name,
            self.start_time.map(|s| s.elapsed()),
            self.tick_count
        );

        // Halt the child
        self.child.halt().await;

        // Reset state
        self.reset().await;

        // Return failure to propagate emergency stop
        Ok(NodeStatus::Failure)
    }
}

#[async_trait]
impl BTreeNode for Watchdog {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Watchdog"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        // Initialize timer on first tick
        if self.start_time.is_none() {
            self.start_time = Some(Instant::now());
        }

        self.tick_count += 1;

        // Check for timeout BEFORE ticking child
        if self.check_timeout() {
            warn!(
                "⚠️ Watchdog '{}': Timeout ({:?}) exceeded after {} ticks",
                self.name, self.timeout, self.tick_count
            );
            return self.emergency_stop().await;
        }

        // Tick child
        let status = self.child.tick(context).await?;

        // Track consecutive Running status
        match status {
            NodeStatus::Running => {
                self.consecutive_running_count += 1;

                if self.consecutive_running_count >= self.max_consecutive_running {
                    warn!(
                        "⚠️ Watchdog '{}': Possible infinite loop detected ({} consecutive Running)",
                        self.name, self.consecutive_running_count
                    );
                    // Don't stop yet, just warn
                }
            }
            _ => {
                // Reset consecutive count on non-Running status
                self.consecutive_running_count = 0;
            }
        }

        // Check if child completed
        if status.is_terminal() {
            self.reset().await;
        }

        Ok(status)
    }

    async fn reset(&mut self) {
        self.start_time = None;
        self.tick_count = 0;
        self.consecutive_running_count = 0;
        self.child.reset().await;
    }

    async fn halt(&mut self) {
        self.child.halt().await;
        self.start_time = None;
        self.tick_count = 0;
        self.consecutive_running_count = 0;
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "Watchdog",
            "timeout_ms": self.timeout.as_millis(),
            "max_consecutive_running": self.max_consecutive_running,
            "child": self.child.to_json()?
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nodes::action::SetBlackboard;
    use crate::nodes::decorator::Repeat;

    #[tokio::test]
    async fn test_watchdog_success() {
        let mut context = BTreeContext::new();

        let child = Box::new(SetBlackboard::new("action", "key", "value"));
        let mut watchdog = Watchdog::new("test", child, Duration::from_secs(1));

        let status = watchdog.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Success);
    }

    #[tokio::test]
    async fn test_watchdog_timeout() {
        let mut context = BTreeContext::new();

        // Create a slow child that sleeps
        struct SlowNode;
        #[async_trait]
        impl BTreeNode for SlowNode {
            fn name(&self) -> &str {
                "slow"
            }
            fn node_type(&self) -> &str {
                "Slow"
            }
            async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
                tokio::time::sleep(Duration::from_millis(50)).await;
                Ok(NodeStatus::Running)
            }
            async fn reset(&mut self) {}
            fn to_json(&self) -> Result<Value> {
                Ok(serde_json::json!({"type": "Slow"}))
            }
        }

        let child = Box::new(SlowNode);
        let mut watchdog = Watchdog::new("test", child, Duration::from_millis(100));

        // Tick multiple times until timeout
        let mut last_status = NodeStatus::Running;
        for _ in 0..10 {
            last_status = watchdog.tick(&mut context).await.unwrap();
            if last_status != NodeStatus::Running {
                break;
            }
        }

        // Should have failed due to timeout
        assert_eq!(last_status, NodeStatus::Failure);
    }

    #[tokio::test]
    async fn test_watchdog_consecutive_running_warning() {
        let mut context = BTreeContext::new();

        // Create infinite repeat
        let child = Box::new(Repeat::infinite(
            "infinite",
            Box::new(SetBlackboard::new("action", "key", "value")),
        ));

        let mut watchdog =
            Watchdog::new("test", child, Duration::from_secs(10)).with_max_consecutive_running(5);

        // Tick 10 times (should trigger warning after 5)
        for _ in 0..10 {
            let status = watchdog.tick(&mut context).await.unwrap();
            assert_eq!(status, NodeStatus::Running);
        }

        // Should have warned but not stopped
        assert_eq!(watchdog.consecutive_running_count, 10);
    }

    #[tokio::test]
    async fn test_watchdog_reset() {
        let mut context = BTreeContext::new();

        let child = Box::new(SetBlackboard::new("action", "key", "value"));
        let mut watchdog = Watchdog::new("test", child, Duration::from_secs(1));

        watchdog.tick(&mut context).await.unwrap();

        // Should reset after success
        assert!(watchdog.start_time.is_none());
        assert_eq!(watchdog.tick_count, 0);
    }

    #[tokio::test]
    async fn test_watchdog_to_json() {
        let child = Box::new(SetBlackboard::new("action", "key", "value"));
        let watchdog = Watchdog::new("test", child, Duration::from_millis(500));

        let json = watchdog.to_json().unwrap();

        assert_eq!(json["type"], "Watchdog");
        assert_eq!(json["timeout_ms"], 500);
        assert!(json["child"].is_object());
    }
}
