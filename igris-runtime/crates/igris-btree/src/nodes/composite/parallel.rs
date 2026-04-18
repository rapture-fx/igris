//! Parallel composite node - executes children concurrently.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use tracing::debug;

/// Parallel execution policy for determining success/failure.
///
/// Defines when a parallel node should return success or failure based on
/// its children's execution results.
///
/// # Examples
///
/// ```
/// use igris_btree::nodes::composite::ParallelPolicy;
///
/// let policy = ParallelPolicy::RequireAll;
/// let policy2 = ParallelPolicy::RequireOne;
/// ```
#[derive(Debug, Clone, Copy)]
pub enum ParallelPolicy {
    /// All children must succeed for the parallel node to succeed.
    ///
    /// Use this when all concurrent tasks must complete successfully.
    /// If any child fails, the parallel node immediately returns `Failure`.
    ///
    /// Example: "start all motors AND start all sensors"
    RequireAll,

    /// At least one child must succeed for the parallel node to succeed.
    ///
    /// Use this for redundant systems or when any successful approach is acceptable.
    /// If at least one child succeeds, the parallel node returns `Success`.
    /// Only returns `Failure` if all children fail.
    ///
    /// Example: "try multiple search strategies, success if any finds target"
    RequireOne,
}

/// Parallel node: Ticks all children concurrently.
///
/// The parallel node executes multiple children "at the same time" (simulated
/// concurrency via sequential async ticking). This enables behaviors where
/// multiple actions or conditions must be evaluated together.
///
/// # Behavior
///
/// - Ticks all children every cycle (doesn't stop early)
/// - Tracks each child's status independently
/// - Returns `Running` if any child is `Running`
/// - Returns terminal status (`Success`/`Failure`) based on policy
///
/// ## RequireAll Policy
///
/// - Returns `Success` only if all children succeed
/// - Returns `Failure` if any child fails
///
/// ## RequireOne Policy
///
/// - Returns `Success` if at least one child succeeds
/// - Returns `Failure` only if all children fail
///
/// # Use Cases
///
/// - Concurrent monitoring (e.g., "watch battery AND watch obstacles")
/// - Redundant systems (e.g., "try sensor A OR sensor B OR sensor C")
/// - Multi-modal behaviors (e.g., "move forward AND scan environment")
///
/// # Note on Concurrency
///
/// While called "parallel", execution is actually sequential in async Rust.
/// True parallelism would require spawning tasks, which is beyond the scope
/// of the behavior tree model. However, the semantics are parallel: all
/// children are ticked each cycle and their results are combined.
///
/// # Examples
///
/// ## Require All
///
/// ```
/// use igris_btree::prelude::*;
/// use igris_btree::nodes::composite::ParallelPolicy;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut parallel = Parallel::new("all_systems", ParallelPolicy::RequireAll)
///     .add_child(Box::new(SetBlackboard::new("sys1", "system1", "ok")))
///     .add_child(Box::new(SetBlackboard::new("sys2", "system2", "ok")));
///
/// let mut context = BTreeContext::new();
/// let status = parallel.tick(&mut context).await?;
///
/// // Both children succeed, so parallel succeeds
/// assert_eq!(status, NodeStatus::Success);
/// # Ok(())
/// # }
/// ```
///
/// ## Require One
///
/// ```
/// use igris_btree::prelude::*;
/// use igris_btree::nodes::composite::ParallelPolicy;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut parallel = Parallel::new("any_sensor", ParallelPolicy::RequireOne)
///     .add_child(Box::new(CheckBlackboard::new("s1", "sensor1", true)))
///     .add_child(Box::new(SetBlackboard::new("s2", "sensor2", "active")));
///
/// let mut context = BTreeContext::new();
/// let status = parallel.tick(&mut context).await?;
///
/// // First child fails (key not found), but second succeeds
/// // So parallel succeeds (RequireOne)
/// assert_eq!(status, NodeStatus::Success);
/// # Ok(())
/// # }
/// ```
pub struct Parallel {
    name: String,
    children: Vec<Box<dyn BTreeNode>>,
    policy: ParallelPolicy,
    child_statuses: Vec<Option<NodeStatus>>,
}

impl Parallel {
    /// Create a new parallel node.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging and visualization
    /// * `policy` - Success/failure policy (`RequireAll` or `RequireOne`)
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    /// use igris_btree::nodes::composite::ParallelPolicy;
    ///
    /// let parallel = Parallel::new("concurrent_tasks", ParallelPolicy::RequireAll);
    /// assert_eq!(parallel.name(), "concurrent_tasks");
    /// ```
    pub fn new(name: impl Into<String>, policy: ParallelPolicy) -> Self {
        Self {
            name: name.into(),
            children: Vec::new(),
            policy,
            child_statuses: Vec::new(),
        }
    }

    /// Add a child node.
    ///
    /// All children are ticked every cycle.
    ///
    /// # Arguments
    ///
    /// * `child` - The child node to add
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    /// use igris_btree::nodes::composite::ParallelPolicy;
    ///
    /// let parallel = Parallel::new("test", ParallelPolicy::RequireOne)
    ///     .add_child(Box::new(SetBlackboard::new("a", "k1", "v1")))
    ///     .add_child(Box::new(SetBlackboard::new("b", "k2", "v2")));
    /// ```
    pub fn add_child(mut self, child: Box<dyn BTreeNode>) -> Self {
        self.children.push(child);
        self.child_statuses.push(None);
        self
    }
}

#[async_trait]
impl BTreeNode for Parallel {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Parallel"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        debug!(
            "Parallel '{}': Ticking {} children ({:?})",
            self.name,
            self.children.len(),
            self.policy
        );

        let mut any_running = false;
        let mut success_count = 0;
        let mut failure_count = 0;

        // Tick all children (simulated parallel - actually sequential in async)
        for (i, child) in self.children.iter_mut().enumerate() {
            // Skip if already terminal
            if let Some(status) = self.child_statuses[i] {
                if status.is_terminal() {
                    if status.is_success() {
                        success_count += 1;
                    } else if status.is_failure() {
                        failure_count += 1;
                    }
                    continue;
                }
            }

            // Tick child
            let status = child.tick(context).await?;
            self.child_statuses[i] = Some(status);

            match status {
                NodeStatus::Success => success_count += 1,
                NodeStatus::Failure => failure_count += 1,
                NodeStatus::Running => any_running = true,
                NodeStatus::Skipped => {}
            }
        }

        debug!(
            "Parallel '{}': success={}, failure={}, running={}",
            self.name, success_count, failure_count, any_running
        );

        // Check policy
        match self.policy {
            ParallelPolicy::RequireAll => {
                if failure_count > 0 {
                    // Any failure → overall failure
                    self.reset().await;
                    Ok(NodeStatus::Failure)
                } else if success_count == self.children.len() {
                    // All succeeded
                    self.reset().await;
                    Ok(NodeStatus::Success)
                } else {
                    // Still running
                    Ok(NodeStatus::Running)
                }
            }
            ParallelPolicy::RequireOne => {
                if success_count > 0 {
                    // At least one success → overall success
                    self.reset().await;
                    Ok(NodeStatus::Success)
                } else if failure_count == self.children.len() {
                    // All failed
                    self.reset().await;
                    Ok(NodeStatus::Failure)
                } else {
                    // Still running
                    Ok(NodeStatus::Running)
                }
            }
        }
    }

    async fn reset(&mut self) {
        debug!("Parallel '{}': Resetting", self.name);
        self.child_statuses.clear();
        self.child_statuses.resize(self.children.len(), None);
        for child in &mut self.children {
            child.reset().await;
        }
    }

    async fn halt(&mut self) {
        debug!("Parallel '{}': Halting", self.name);
        for child in &mut self.children {
            child.halt().await;
        }
        self.reset().await;
    }

    fn to_json(&self) -> Result<serde_json::Value> {
        let children_json: Result<Vec<_>> = self.children.iter().map(|c| c.to_json()).collect();

        Ok(serde_json::json!({
            "name": self.name,
            "type": "Parallel",
            "policy": format!("{:?}", self.policy),
            "children": children_json?
        }))
    }
}
