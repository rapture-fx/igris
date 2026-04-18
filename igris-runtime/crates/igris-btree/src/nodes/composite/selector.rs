//! Selector (Fallback) composite node - tries children until one succeeds.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use tracing::debug;

/// Selector node (Fallback): Tries children until one succeeds or all fail.
///
/// The selector node implements fallback logic, trying alternative approaches
/// until one succeeds. This creates an "OR" logic pattern, making it ideal for
/// robust behaviors with backup options.
///
/// # Behavior
///
/// - Ticks children in order (left to right)
/// - If a child returns `Success`, stops and returns `Success` immediately
/// - If a child returns `Running`, returns `Running` (will resume at same child next tick)
/// - If a child returns `Failure`, moves to the next child
/// - If all children return `Failure`, returns `Failure`
///
/// # Use Cases
///
/// - Fallback strategies (e.g., "try WiFi, else try cellular, else go offline")
/// - Error recovery (e.g., "try primary approach, else try alternative, else fail gracefully")
/// - Condition-based branching (e.g., "if can see target, approach; else search")
///
/// # Examples
///
/// ## Basic Fallback
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut selector = Selector::new("try_approaches")
///     .add_child(Box::new(CheckBlackboard::new("check_primary", "primary_available", true)))
///     .add_child(Box::new(SetBlackboard::new("fallback", "used_fallback", true)));
///
/// let mut context = BTreeContext::new();
/// // No "primary_available" key, so first child fails
/// // Second child (fallback) succeeds
/// let status = selector.tick(&mut context).await?;
///
/// assert_eq!(status, NodeStatus::Success);
/// assert!(context.blackboard.contains("used_fallback").await);
/// # Ok(())
/// # }
/// ```
///
/// ## All Options Fail
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut selector = Selector::new("try_all")
///     .add_child(Box::new(CheckBlackboard::new("opt1", "option1", true)))
///     .add_child(Box::new(CheckBlackboard::new("opt2", "option2", true)))
///     .add_child(Box::new(CheckBlackboard::new("opt3", "option3", true)));
///
/// let mut context = BTreeContext::new();
/// // None of the options are available
/// let status = selector.tick(&mut context).await?;
///
/// assert_eq!(status, NodeStatus::Failure);
/// # Ok(())
/// # }
/// ```
pub struct Selector {
    name: String,
    children: Vec<Box<dyn BTreeNode>>,
    current_child: usize,
}

impl Selector {
    /// Create a new selector node.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging and visualization
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let selector = Selector::new("fallback_strategy");
    /// assert_eq!(selector.name(), "fallback_strategy");
    /// ```
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            children: Vec::new(),
            current_child: 0,
        }
    }

    /// Add a child node (builder pattern).
    ///
    /// Children are tried in the order they're added (left to right).
    ///
    /// # Arguments
    ///
    /// * `child` - The child node to add
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let selector = Selector::new("test")
    ///     .add_child(Box::new(CheckBlackboard::new("primary", "ready", true)))
    ///     .add_child(Box::new(SetBlackboard::new("fallback", "used_backup", true)));
    /// ```
    pub fn add_child(mut self, child: Box<dyn BTreeNode>) -> Self {
        self.children.push(child);
        self
    }

    /// Add multiple children at once.
    ///
    /// Convenience method for adding several fallback options in one call.
    ///
    /// # Arguments
    ///
    /// * `children` - Vector of child nodes to add
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let children: Vec<Box<dyn BTreeNode>> = vec![
    ///     Box::new(CheckBlackboard::new("opt1", "primary", true)),
    ///     Box::new(CheckBlackboard::new("opt2", "secondary", true)),
    /// ];
    ///
    /// let selector = Selector::new("test").add_children(children);
    /// ```
    pub fn add_children(mut self, children: Vec<Box<dyn BTreeNode>>) -> Self {
        self.children.extend(children);
        self
    }
}

#[async_trait]
impl BTreeNode for Selector {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Selector"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        debug!(
            "Selector '{}': Ticking (child {}/{})",
            self.name,
            self.current_child,
            self.children.len()
        );

        // Try children in order until one succeeds
        while self.current_child < self.children.len() {
            let child = &mut self.children[self.current_child];
            let status = child.tick(context).await?;

            debug!(
                "Selector '{}': Child {} returned {:?}",
                self.name, self.current_child, status
            );

            match status {
                NodeStatus::Success => {
                    // Child succeeded, reset and return Success
                    debug!(
                        "Selector '{}': Child succeeded, returning Success",
                        self.name
                    );
                    self.reset().await;
                    return Ok(NodeStatus::Success);
                }
                NodeStatus::Running => {
                    // Child still running, return Running
                    return Ok(NodeStatus::Running);
                }
                NodeStatus::Failure => {
                    // Child failed, try next child
                    self.current_child += 1;
                }
                NodeStatus::Skipped => {
                    // Move to next child
                    self.current_child += 1;
                }
            }
        }

        // All children failed
        debug!("Selector '{}': All children failed", self.name);
        self.reset().await;
        Ok(NodeStatus::Failure)
    }

    async fn reset(&mut self) {
        debug!("Selector '{}': Resetting", self.name);
        self.current_child = 0;
        for child in &mut self.children {
            child.reset().await;
        }
    }

    async fn halt(&mut self) {
        debug!("Selector '{}': Halting", self.name);
        for child in &mut self.children {
            child.halt().await;
        }
        self.reset().await;
    }

    fn to_json(&self) -> Result<serde_json::Value> {
        let children_json: Result<Vec<_>> = self.children.iter().map(|c| c.to_json()).collect();

        Ok(serde_json::json!({
            "name": self.name,
            "type": "Selector",
            "children": children_json?
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct AlwaysFailNode;
    #[async_trait]
    impl BTreeNode for AlwaysFailNode {
        fn name(&self) -> &str {
            "fail"
        }
        fn node_type(&self) -> &str {
            "AlwaysFail"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            Ok(NodeStatus::Failure)
        }
    }

    struct AlwaysSucceedNode;
    #[async_trait]
    impl BTreeNode for AlwaysSucceedNode {
        fn name(&self) -> &str {
            "succeed"
        }
        fn node_type(&self) -> &str {
            "AlwaysSucceed"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            Ok(NodeStatus::Success)
        }
    }

    #[tokio::test]
    async fn test_selector_first_succeeds() {
        let mut sel = Selector::new("test")
            .add_child(Box::new(AlwaysSucceedNode))
            .add_child(Box::new(AlwaysFailNode));

        let mut context = BTreeContext::new();
        let status = sel.tick(&mut context).await.unwrap();

        assert_eq!(status, NodeStatus::Success);
    }

    #[tokio::test]
    async fn test_selector_fallback() {
        let mut sel = Selector::new("test")
            .add_child(Box::new(AlwaysFailNode))
            .add_child(Box::new(AlwaysSucceedNode));

        let mut context = BTreeContext::new();
        let status = sel.tick(&mut context).await.unwrap();

        // Should try first (fails), then second (succeeds)
        assert_eq!(status, NodeStatus::Success);
    }

    #[tokio::test]
    async fn test_selector_all_fail() {
        let mut sel = Selector::new("test")
            .add_child(Box::new(AlwaysFailNode))
            .add_child(Box::new(AlwaysFailNode));

        let mut context = BTreeContext::new();
        let status = sel.tick(&mut context).await.unwrap();

        assert_eq!(status, NodeStatus::Failure);
    }
}
