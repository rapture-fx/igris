//! Timeout decorator node - fails if child exceeds time limit.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::time::{Duration, Instant};

/// Timeout: Fail if child exceeds timeout.
///
/// This decorator wraps a child node and enforces a time limit on its execution.
/// If the child doesn't complete within the timeout, the decorator halts the
/// child and returns failure.
///
/// # Behavior
///
/// - Starts timer on first tick
/// - Ticks child normally while within timeout
/// - If child completes (Success/Failure), returns that status and resets
/// - If timeout is exceeded:
///   - Calls `halt()` on the child to clean up
///   - Resets state
///   - Returns `Failure`
///
/// # Use Cases
///
/// - Enforcing deadlines on long-running operations
/// - Preventing stuck nodes from blocking execution
/// - Implementing time-bounded searches or planning
/// - Safety timeouts for physical operations
///
/// # Examples
///
/// ## Basic Timeout
///
/// ```
/// use igris_btree::prelude::*;
/// use std::time::Duration;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let child = Box::new(SetBlackboard::new("action", "key", "value"));
/// let mut timeout = Timeout::new("timeout_action", child, 1000); // 1 second
///
/// let mut context = BTreeContext::new();
/// let status = timeout.tick(&mut context).await?;
///
/// // Child completes quickly, so succeeds
/// assert_eq!(status, NodeStatus::Success);
/// # Ok(())
/// # }
/// ```
///
/// ## Timeout with Slow Operation
///
/// ```no_run
/// use igris_btree::prelude::*;
/// use std::time::Duration;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// // Assume SlowNode takes >2 seconds
/// # struct SlowNode;
/// # use async_trait::async_trait;
/// # #[async_trait]
/// # impl BTreeNode for SlowNode {
/// #     fn name(&self) -> &str { "slow" }
/// #     fn node_type(&self) -> &str { "Slow" }
/// #     async fn tick(&mut self, _: &mut BTreeContext) -> anyhow::Result<NodeStatus> {
/// #         tokio::time::sleep(Duration::from_secs(3)).await;
/// #         Ok(NodeStatus::Success)
/// #     }
/// # }
/// let child = Box::new(SlowNode);
/// let mut timeout = Timeout::new("bounded_op", child, 2000); // 2 second limit
///
/// let mut context = BTreeContext::new();
///
/// // After multiple ticks, timeout will trigger
/// loop {
///     let status = timeout.tick(&mut context).await?;
///     if status != NodeStatus::Running {
///         // Will eventually return Failure due to timeout
///         break;
///     }
/// }
/// # Ok(())
/// # }
/// ```
pub struct Timeout {
    name: String,
    child: Box<dyn BTreeNode>,
    timeout: Duration,
    start_time: Option<Instant>,
}

impl Timeout {
    /// Create a new Timeout decorator.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `child` - Child node to monitor
    /// * `timeout_ms` - Timeout in milliseconds
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let child = Box::new(SetBlackboard::new("action", "key", "value"));
    /// let timeout = Timeout::new("bounded_action", child, 5000);
    ///
    /// // Child has 5 seconds to complete
    /// assert_eq!(timeout.name(), "bounded_action");
    /// ```
    pub fn new(name: impl Into<String>, child: Box<dyn BTreeNode>, timeout_ms: u64) -> Self {
        Self {
            name: name.into(),
            child,
            timeout: Duration::from_millis(timeout_ms),
            start_time: None,
        }
    }
}

#[async_trait]
impl BTreeNode for Timeout {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Timeout"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        if self.start_time.is_none() {
            self.start_time = Some(Instant::now());
        }

        if let Some(start) = self.start_time {
            if start.elapsed() > self.timeout {
                self.child.halt().await;
                self.reset().await;
                return Ok(NodeStatus::Failure);
            }
        }

        let status = self.child.tick(context).await?;
        if status.is_terminal() {
            self.reset().await;
        }
        Ok(status)
    }

    async fn reset(&mut self) {
        self.start_time = None;
        self.child.reset().await;
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "Timeout",
            "timeout_ms": self.timeout.as_millis(),
            "child": self.child.to_json()?
        }))
    }
}
