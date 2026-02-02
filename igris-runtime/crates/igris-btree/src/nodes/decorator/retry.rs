//! Retry decorator node - retries child on failure up to N times.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

/// Retry: Retry child on failure up to N times.
///
/// This decorator wraps a child node and automatically retries it if it fails.
/// After the maximum number of retries is exhausted, the retry node itself
/// returns failure.
///
/// # Behavior
///
/// - Ticks the child node
/// - If child returns `Success`, returns `Success` immediately
/// - If child returns `Running`, returns `Running` (keeps waiting)
/// - If child returns `Failure`:
///   - If retries remaining, resets child and tries again
///   - If no retries remaining, returns `Failure`
/// - Retries happen immediately (same tick cycle)
///
/// # Use Cases
///
/// - Network requests that may fail transiently
/// - Sensor readings that may be noisy
/// - Actions that may fail due to temporary conditions
/// - Improving robustness of unreliable operations
///
/// # Examples
///
/// ## Basic Retry
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let child = Box::new(CheckBlackboard::new("check", "sensor_ready", true));
/// let mut retry = Retry::new("retry_check", child, 3);
///
/// let mut context = BTreeContext::new();
///
/// // Will try up to 4 times (initial + 3 retries)
/// let status = retry.tick(&mut context).await?;
/// assert_eq!(status, NodeStatus::Failure); // All attempts failed
/// # Ok(())
/// # }
/// ```
///
/// ## Retry with Nested Action
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let sequence = Box::new(
///     Sequence::new("validate_then_act")
///         .add_child(Box::new(CheckBlackboard::new("check", "ready", true)))
///         .add_child(Box::new(SetBlackboard::new("act", "status", "done")))
/// );
///
/// let mut retry = Retry::new("retry_sequence", sequence, 5);
/// let mut context = BTreeContext::new();
///
/// // Will retry the entire sequence up to 5 times
/// let status = retry.tick(&mut context).await?;
/// # Ok(())
/// # }
/// ```
pub struct Retry {
    name: String,
    child: Box<dyn BTreeNode>,
    max_retries: u32,
    current_retries: u32,
}

impl Retry {
    /// Create a new Retry decorator.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `child` - Child node to retry on failure
    /// * `max_retries` - Maximum number of retry attempts (0 = try once, no retries)
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let child = Box::new(SetBlackboard::new("action", "key", "value"));
    /// let retry = Retry::new("retry_action", child, 3);
    ///
    /// // Will try up to 4 times: 1 initial + 3 retries
    /// assert_eq!(retry.name(), "retry_action");
    /// ```
    pub fn new(name: impl Into<String>, child: Box<dyn BTreeNode>, max_retries: u32) -> Self {
        Self {
            name: name.into(),
            child,
            max_retries,
            current_retries: 0,
        }
    }
}

#[async_trait]
impl BTreeNode for Retry {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Retry"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        loop {
            let status = self.child.tick(context).await?;

            match status {
                NodeStatus::Success => {
                    self.current_retries = 0;
                    return Ok(NodeStatus::Success);
                }
                NodeStatus::Running => {
                    return Ok(NodeStatus::Running);
                }
                NodeStatus::Failure => {
                    if self.current_retries >= self.max_retries {
                        self.reset().await;
                        return Ok(NodeStatus::Failure);
                    }
                    self.current_retries += 1;
                    self.child.reset().await;
                    // Continue loop to retry
                }
                NodeStatus::Skipped => {
                    return Ok(NodeStatus::Skipped);
                }
            }
        }
    }

    async fn reset(&mut self) {
        self.current_retries = 0;
        self.child.reset().await;
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "Retry",
            "max_retries": self.max_retries,
            "current_retries": self.current_retries,
            "child": self.child.to_json()?
        }))
    }
}
