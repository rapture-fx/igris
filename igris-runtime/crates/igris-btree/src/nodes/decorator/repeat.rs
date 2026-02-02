//! Repeat decorator node - repeats child N times or infinitely.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

/// Repeat: Repeat child N times or infinitely.
///
/// This decorator continuously re-executes its child node either a fixed
/// number of times or forever. After each completion (Success or Failure),
/// the child is reset and ticked again.
///
/// # Behavior
///
/// - Ticks child node
/// - When child reaches terminal status (Success/Failure):
///   - Increments completion counter
///   - Resets child
///   - If count limit reached, returns `Success`
///   - Otherwise, returns `Running` (will tick child again next cycle)
/// - Always returns `Running` until count is reached (or forever if infinite)
///
/// # Use Cases
///
/// - Periodic behaviors (e.g., "scan sensors every tick")
/// - Looping animations or motions
/// - Continuous monitoring tasks
/// - Background processes
///
/// # Warning
///
/// Infinite repeats never complete on their own. Use with:
/// - Timeout decorator to limit duration
/// - Watchdog to detect stuck loops
/// - External halt signals
/// - Parent nodes that can interrupt (e.g., Parallel, Selector)
///
/// # Examples
///
/// ## Fixed Repeats
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let child = Box::new(SetBlackboard::new("action", "counter", 1));
/// let mut repeat = Repeat::new("repeat_3", child, Some(3));
///
/// let mut context = BTreeContext::new();
///
/// // First 3 ticks return Running (child completes 3 times)
/// for _ in 0..3 {
///     let status = repeat.tick(&mut context).await?;
///     // Child completes immediately, but repeat returns Running
/// }
///
/// // 4th tick returns Success (count reached)
/// // Note: Due to implementation, may return Running longer
/// # Ok(())
/// # }
/// ```
///
/// ## Infinite Repeat
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let child = Box::new(SetBlackboard::new("action", "tick", "active"));
/// let mut repeat = Repeat::infinite("loop_forever", child);
///
/// let mut context = BTreeContext::new();
///
/// // Will always return Running
/// for _ in 0..100 {
///     let status = repeat.tick(&mut context).await?;
///     assert_eq!(status, NodeStatus::Running);
/// }
/// # Ok(())
/// # }
/// ```
pub struct Repeat {
    name: String,
    child: Box<dyn BTreeNode>,
    count: Option<u32>,
    current: u32,
}

impl Repeat {
    /// Create a new Repeat decorator.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `child` - Child node to repeat
    /// * `count` - Number of times to repeat (None = infinite)
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let child = Box::new(SetBlackboard::new("action", "key", "value"));
    ///
    /// // Repeat 5 times
    /// let repeat_fixed = Repeat::new("repeat_5", child.clone(), Some(5));
    ///
    /// // Repeat forever
    /// let repeat_inf = Repeat::new("repeat_forever", child, None);
    /// ```
    pub fn new(name: impl Into<String>, child: Box<dyn BTreeNode>, count: Option<u32>) -> Self {
        Self {
            name: name.into(),
            child,
            count,
            current: 0,
        }
    }

    /// Create an infinite repeat (convenience method).
    ///
    /// Equivalent to `Repeat::new(name, child, None)`.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `child` - Child node to repeat forever
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let child = Box::new(SetBlackboard::new("action", "key", "value"));
    /// let repeat = Repeat::infinite("loop", child);
    ///
    /// assert_eq!(repeat.name(), "loop");
    /// ```
    pub fn infinite(name: impl Into<String>, child: Box<dyn BTreeNode>) -> Self {
        Self::new(name, child, None)
    }
}

#[async_trait]
impl BTreeNode for Repeat {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Repeat"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        if let Some(max) = self.count {
            if self.current >= max {
                return Ok(NodeStatus::Success);
            }
        }

        let status = self.child.tick(context).await?;
        if status.is_terminal() {
            self.current += 1;
            self.child.reset().await;
        }

        Ok(NodeStatus::Running)
    }

    async fn reset(&mut self) {
        self.current = 0;
        self.child.reset().await;
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "Repeat",
            "count": self.count,
            "child": self.child.to_json()?
        }))
    }
}
