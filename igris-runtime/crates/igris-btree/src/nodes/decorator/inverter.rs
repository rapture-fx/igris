//! Inverter decorator node - inverts child's success/failure status.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

/// Inverter: Invert child's Success/Failure status.
///
/// This decorator implements NOT logic - it flips the child's terminal status.
/// Success becomes Failure, and Failure becomes Success. Running and Skipped
/// are passed through unchanged.
///
/// # Behavior
///
/// - Ticks child node
/// - If child returns `Success`, returns `Failure`
/// - If child returns `Failure`, returns `Success`
/// - If child returns `Running` or `Skipped`, passes through unchanged
///
/// # Use Cases
///
/// - Implementing "until not" loops (e.g., "do X until not Y")
/// - Inverting condition checks (e.g., "is NOT ready")
/// - Creating negative preconditions
/// - Building more complex logical expressions
///
/// # Examples
///
/// ## Basic Inversion
///
/// ```
/// use igris_btree::prelude::*;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let child = Box::new(SetBlackboard::new("action", "key", "value"));
/// let mut inverter = Inverter::new("invert_action", child);
///
/// let mut context = BTreeContext::new();
/// let status = inverter.tick(&mut context).await?;
///
/// // Child returns Success, but inverter flips it to Failure
/// assert_eq!(status, NodeStatus::Failure);
/// # Ok(())
/// # }
/// ```
///
/// ## Negating a Condition
///
/// ```
/// use igris_btree::prelude::*;
/// use serde_json::json;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// // "NOT ready" condition
/// let check = Box::new(CheckBlackboard::new("check", "ready", true));
/// let mut not_ready = Inverter::new("not_ready", check);
///
/// let mut context = BTreeContext::new();
///
/// // No "ready" key, so check fails, inverter makes it succeed
/// let status = not_ready.tick(&mut context).await?;
/// assert_eq!(status, NodeStatus::Success);
///
/// // Set ready=true, check succeeds, inverter makes it fail
/// context.blackboard.set("ready", json!(true)).await;
/// let status = not_ready.tick(&mut context).await?;
/// assert_eq!(status, NodeStatus::Failure);
/// # Ok(())
/// # }
/// ```
pub struct Inverter {
    name: String,
    child: Box<dyn BTreeNode>,
}

impl Inverter {
    /// Create a new Inverter decorator.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `child` - Child node whose status will be inverted
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    ///
    /// let child = Box::new(CheckBlackboard::new("check", "flag", true));
    /// let inverter = Inverter::new("not_flag", child);
    ///
    /// assert_eq!(inverter.name(), "not_flag");
    /// ```
    pub fn new(name: impl Into<String>, child: Box<dyn BTreeNode>) -> Self {
        Self {
            name: name.into(),
            child,
        }
    }
}

#[async_trait]
impl BTreeNode for Inverter {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Inverter"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        let status = self.child.tick(context).await?;
        Ok(match status {
            NodeStatus::Success => NodeStatus::Failure,
            NodeStatus::Failure => NodeStatus::Success,
            other => other,
        })
    }

    async fn reset(&mut self) {
        self.child.reset().await;
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "Inverter",
            "child": self.child.to_json()?
        }))
    }
}
