//! Sequence composite node - executes children in order.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use tracing::debug;

/// Sequence node: Ticks children in order until all succeed or one fails.
///
/// The sequence node is the most fundamental control flow node. It executes
/// children sequentially, moving to the next child only when the current one
/// succeeds. This creates an "AND" logic pattern.
///
/// # Behavior
///
/// - Ticks children in order (left to right)
/// - If a child returns `Success`, moves to the next child
/// - If a child returns `Running`, returns `Running` (will resume at same child next tick)
/// - If a child returns `Failure`, stops and returns `Failure` immediately
/// - If all children return `Success`, returns `Success`
///
/// # Use Cases
///
/// - Multi-step procedures (e.g., "unlock door, open door, walk through")
/// - Precondition checking (e.g., "check battery, check sensors, start mission")
/// - Sequential state machines
///
/// # Examples
///
/// ## Basic Sequence
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut sequence = Sequence::new("mission_steps")
///     .add_child(Box::new(SetBlackboard::new("step1", "phase", "init")))
///     .add_child(Box::new(SetBlackboard::new("step2", "phase", "execute")))
///     .add_child(Box::new(SetBlackboard::new("step3", "phase", "complete")));
///
/// let mut context = BTreeContext::new();
/// let status = sequence.tick(&mut context).await?;
///
/// assert_eq!(status, NodeStatus::Success);
/// # Ok(())
/// # }
/// ```
///
/// ## Sequence with Failure
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut sequence = Sequence::new("check_then_act")
///     .add_child(Box::new(CheckBlackboard::new("check", "ready", true)))
///     .add_child(Box::new(SetBlackboard::new("act", "status", "running")));
///
/// let mut context = BTreeContext::new();
/// // No "ready" key set, so first child fails
/// let status = sequence.tick(&mut context).await?;
///
/// assert_eq!(status, NodeStatus::Failure);
/// // Second child never executed
/// assert!(!context.blackboard.contains("status").await);
/// # Ok(())
/// # }
/// ```
pub struct Sequence {
    name: String,
    children: Vec<Box<dyn BTreeNode>>,
    current_child: usize,
}

impl Sequence {
    /// Create a new sequence node.
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
    /// let sequence = Sequence::new("my_sequence");
    /// assert_eq!(sequence.name(), "my_sequence");
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
    /// Children are executed in the order they're added.
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
    /// let sequence = Sequence::new("test")
    ///     .add_child(Box::new(SetBlackboard::new("a", "k1", "v1")))
    ///     .add_child(Box::new(SetBlackboard::new("b", "k2", "v2")));
    /// ```
    pub fn add_child(mut self, child: Box<dyn BTreeNode>) -> Self {
        self.children.push(child);
        self
    }

    /// Add multiple children at once.
    ///
    /// Convenience method for adding several children in one call.
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
    ///     Box::new(SetBlackboard::new("a", "k1", "v1")),
    ///     Box::new(SetBlackboard::new("b", "k2", "v2")),
    /// ];
    ///
    /// let sequence = Sequence::new("test").add_children(children);
    /// ```
    pub fn add_children(mut self, children: Vec<Box<dyn BTreeNode>>) -> Self {
        self.children.extend(children);
        self
    }
}

#[async_trait]
impl BTreeNode for Sequence {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Sequence"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        debug!(
            "Sequence '{}': Ticking (child {}/{})",
            self.name,
            self.current_child,
            self.children.len()
        );

        // Tick children in sequence
        while self.current_child < self.children.len() {
            let child = &mut self.children[self.current_child];
            let status = child.tick(context).await?;

            debug!(
                "Sequence '{}': Child {} returned {:?}",
                self.name, self.current_child, status
            );

            match status {
                NodeStatus::Success => {
                    // Move to next child
                    self.current_child += 1;
                }
                NodeStatus::Running => {
                    // Child still running, return Running
                    return Ok(NodeStatus::Running);
                }
                NodeStatus::Failure => {
                    // Child failed, reset and return Failure
                    debug!("Sequence '{}': Child failed, returning Failure", self.name);
                    self.reset().await;
                    return Ok(NodeStatus::Failure);
                }
                NodeStatus::Skipped => {
                    // Move to next child
                    self.current_child += 1;
                }
            }
        }

        // All children succeeded
        debug!("Sequence '{}': All children succeeded", self.name);
        self.reset().await;
        Ok(NodeStatus::Success)
    }

    async fn reset(&mut self) {
        debug!("Sequence '{}': Resetting", self.name);
        self.current_child = 0;
        for child in &mut self.children {
            child.reset().await;
        }
    }

    async fn halt(&mut self) {
        debug!("Sequence '{}': Halting", self.name);
        for child in &mut self.children {
            child.halt().await;
        }
        self.reset().await;
    }

    fn to_json(&self) -> Result<serde_json::Value> {
        let children_json: Result<Vec<_>> = self.children.iter().map(|c| c.to_json()).collect();

        Ok(serde_json::json!({
            "name": self.name,
            "type": "Sequence",
            "children": children_json?
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nodes::action::SetBlackboard;

    #[tokio::test]
    async fn test_sequence_all_success() {
        let mut seq = Sequence::new("test")
            .add_child(Box::new(SetBlackboard::new("set1", "key1", "val1")))
            .add_child(Box::new(SetBlackboard::new("set2", "key2", "val2")));

        let mut context = BTreeContext::new();
        let status = seq.tick(&mut context).await.unwrap();

        assert_eq!(status, NodeStatus::Success);
        assert!(context.blackboard.contains("key1").await);
        assert!(context.blackboard.contains("key2").await);
    }

    #[tokio::test]
    async fn test_sequence_reset_on_completion() {
        let mut seq =
            Sequence::new("test").add_child(Box::new(SetBlackboard::new("set1", "key", "val")));

        let mut context = BTreeContext::new();

        // First execution
        let status = seq.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Success);

        // Should reset current_child to 0
        assert_eq!(seq.current_child, 0);
    }
}
