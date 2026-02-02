//! Core behavior tree node trait and metadata.
//!
//! This module defines the fundamental `BTreeNode` trait that all behavior tree
//! nodes implement, along with supporting metadata structures.

use super::{BTreeContext, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Base trait for all Behavior Tree nodes.
///
/// All nodes (composite, decorator, action, condition, LLM) implement this trait.
/// It defines the core lifecycle methods and serialization interface.
///
/// # Node Types
///
/// - **Composite nodes**: Control flow (Sequence, Selector, Parallel)
/// - **Decorator nodes**: Modify child behavior (Retry, Timeout, Inverter)
/// - **Action nodes**: Execute behaviors (ToolAction, SetBlackboard)
/// - **Condition nodes**: Check conditions (CheckBlackboard)
/// - **LLM nodes**: Dynamic planning (LLMPlannerNode, SubtreeLoader)
///
/// # Lifecycle
///
/// 1. **tick()**: Execute one step of the node's logic
/// 2. **reset()**: Clear internal state (called after terminal status)
/// 3. **halt()**: Emergency stop (called when parent halts)
///
/// # Thread Safety
///
/// Nodes must be `Send + Sync` to work with async executors.
///
/// # Examples
///
/// ## Implementing a Simple Node
///
/// ```
/// use igris_btree::prelude::*;
/// use anyhow::Result;
///
/// struct CounterNode {
///     name: String,
///     count: u32,
///     max: u32,
/// }
///
/// #[async_trait]
/// impl BTreeNode for CounterNode {
///     fn name(&self) -> &str {
///         &self.name
///     }
///
///     fn node_type(&self) -> &str {
///         "Counter"
///     }
///
///     async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
///         self.count += 1;
///         if self.count >= self.max {
///             Ok(NodeStatus::Success)
///         } else {
///             Ok(NodeStatus::Running)
///         }
///     }
///
///     async fn reset(&mut self) {
///         self.count = 0;
///     }
/// }
/// ```
#[async_trait]
pub trait BTreeNode: Send + Sync {
    /// Node name for debugging and visualization.
    ///
    /// Should be a human-readable identifier unique within its parent.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let node = Sequence::new("mission_sequence");
    /// assert_eq!(node.name(), "mission_sequence");
    /// ```
    fn name(&self) -> &str;

    /// Node type for serialization and debugging.
    ///
    /// Returns the type name (e.g., "Sequence", "LLMPlanner", "ToolAction").
    /// Used for JSON serialization and visualization.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let node = Sequence::new("test");
    /// assert_eq!(node.node_type(), "Sequence");
    /// ```
    fn node_type(&self) -> &str;

    /// Tick the node (execute one step).
    ///
    /// This is the core execution method called by the parent node or executor.
    /// Each tick represents one execution cycle of the behavior tree.
    ///
    /// # Arguments
    ///
    /// * `context` - Mutable reference to the execution context
    ///
    /// # Returns
    ///
    /// Returns a `NodeStatus` indicating the execution state:
    /// - `Running`: Node is still executing (call tick again)
    /// - `Success`: Node completed successfully (terminal)
    /// - `Failure`: Node failed (terminal)
    /// - `Skipped`: Node was skipped (rare)
    ///
    /// # Errors
    ///
    /// Returns an error if execution fails unexpectedly. Most nodes return
    /// `Failure` status instead of errors, but critical issues (like missing
    /// dependencies) can return errors.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> anyhow::Result<()> {
    /// let mut node = SetBlackboard::new("set", "key", "value");
    /// let mut context = BTreeContext::new();
    ///
    /// let status = node.tick(&mut context).await?;
    /// assert_eq!(status, NodeStatus::Success);
    /// # Ok(())
    /// # }
    /// ```
    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus>;

    /// Reset node state (called when parent resets).
    ///
    /// Clears any internal state so the node can be executed again.
    /// Typically called after the node returns a terminal status.
    ///
    /// Default implementation is a no-op. Override for stateful nodes
    /// (e.g., nodes with counters, timers, or cached data).
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// # #[tokio::main]
    /// # async fn main() {
    /// let mut node = Retry::new("retry", Box::new(
    ///     SetBlackboard::new("action", "key", "value")
    /// ), 3);
    ///
    /// node.reset().await;
    /// // Internal retry counter is now reset to 0
    /// # }
    /// ```
    async fn reset(&mut self) {
        // Default: no-op
    }

    /// Halt node execution (called when parent halts).
    ///
    /// Used for emergency stops and cleanup. Should cancel any running
    /// async operations, release resources, and reset state.
    ///
    /// Default implementation calls `reset()`. Override if you need to
    /// cancel async tasks or perform additional cleanup.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// # #[tokio::main]
    /// # async fn main() {
    /// let mut node = Sequence::new("sequence")
    ///     .add_child(Box::new(SetBlackboard::new("a", "k1", "v1")))
    ///     .add_child(Box::new(SetBlackboard::new("b", "k2", "v2")));
    ///
    /// node.halt().await;
    /// // All children are halted and internal state is reset
    /// # }
    /// ```
    async fn halt(&mut self) {
        self.reset().await;
    }

    /// Serialize node to JSON for persistence/visualization.
    ///
    /// Converts the node structure to JSON format, which can be used for:
    /// - Saving behavior trees to disk
    /// - Sending trees over network
    /// - Visualization and debugging
    ///
    /// Default implementation returns basic node info (name and type).
    /// Override to include additional node-specific data.
    ///
    /// # Returns
    ///
    /// Returns a JSON representation of the node.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// # fn main() -> anyhow::Result<()> {
    /// let node = Sequence::new("test")
    ///     .add_child(Box::new(SetBlackboard::new("a", "k", "v")));
    ///
    /// let json = node.to_json()?;
    /// assert_eq!(json["type"], "Sequence");
    /// assert!(json["children"].is_array());
    /// # Ok(())
    /// # }
    /// ```
    fn to_json(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "name": self.name(),
            "type": self.node_type()
        }))
    }

    /// Get node metadata for visualization.
    ///
    /// Returns structured metadata that can be used by visualization tools,
    /// debuggers, and monitoring systems.
    ///
    /// Default implementation returns basic metadata. Override to include
    /// runtime state (current status, tick count, etc.).
    ///
    /// # Returns
    ///
    /// Returns a `NodeMetadata` struct with node information.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let node = SetBlackboard::new("test", "key", "value");
    /// let metadata = node.metadata();
    ///
    /// assert_eq!(metadata.name, "test");
    /// assert_eq!(metadata.node_type, "SetBlackboard");
    /// ```
    fn metadata(&self) -> NodeMetadata {
        NodeMetadata {
            id: format!("{}_{}", self.node_type(), self.name()),
            name: self.name().to_string(),
            node_type: self.node_type().to_string(),
            status: None,
            tick_count: 0,
            last_result: None,
        }
    }
}

/// Tree node metadata for visualization and debugging.
///
/// Contains runtime and structural information about a node that's useful for:
/// - Visualization tools (tree diagrams, status indicators)
/// - Debugging (execution traces, state inspection)
/// - Monitoring (performance metrics, error tracking)
///
/// # Examples
///
/// ```
/// use igris_btree::core::NodeMetadata;
///
/// let metadata = NodeMetadata {
///     id: "sequence_1".to_string(),
///     name: "Mission Sequence".to_string(),
///     node_type: "Sequence".to_string(),
///     status: Some("Running".to_string()),
///     tick_count: 42,
///     last_result: Some("Child 2 of 5 running".to_string()),
/// };
///
/// assert_eq!(metadata.node_type, "Sequence");
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeMetadata {
    /// Unique node identifier.
    ///
    /// Typically constructed from node type and name (e.g., "Sequence_mission").
    /// Used to track nodes across serialization and visualization.
    pub id: String,

    /// Human-readable node name.
    ///
    /// The name given to the node at construction time.
    pub name: String,

    /// Node type identifier.
    ///
    /// One of: "Sequence", "Selector", "Parallel", "Retry", "Timeout",
    /// "Inverter", "Repeat", "ToolAction", "SetBlackboard", "CheckBlackboard",
    /// "LLMPlanner", "SubtreeLoader", "ReplanOnFailure", "Watchdog", etc.
    pub node_type: String,

    /// Current execution status.
    ///
    /// String representation of the last status returned by tick()
    /// (e.g., "Running", "Success", "Failure").
    pub status: Option<String>,

    /// Number of times this node has been ticked.
    ///
    /// Useful for detecting infinite loops and measuring execution patterns.
    pub tick_count: u64,

    /// Last execution result or error message.
    ///
    /// Human-readable description of what happened during the last tick.
    /// Can include debug info, error messages, or progress updates.
    pub last_result: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestNode {
        name: String,
        status: NodeStatus,
    }

    #[async_trait]
    impl BTreeNode for TestNode {
        fn name(&self) -> &str {
            &self.name
        }

        fn node_type(&self) -> &str {
            "Test"
        }

        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            Ok(self.status)
        }
    }

    #[tokio::test]
    async fn test_node_basic() {
        let mut node = TestNode {
            name: "test".to_string(),
            status: NodeStatus::Success,
        };
        let mut context = BTreeContext::new();

        let status = node.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Success);
    }

    #[tokio::test]
    async fn test_node_metadata() {
        let node = TestNode {
            name: "test".to_string(),
            status: NodeStatus::Running,
        };

        let meta = node.metadata();
        assert_eq!(meta.name, "test");
        assert_eq!(meta.node_type, "Test");
    }
}
