//! SetBlackboard action node - writes a value to the blackboard.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

/// SetBlackboard: Simple action to set a blackboard value.
///
/// This is the most basic action node. It writes a fixed value to the
/// blackboard and always succeeds. Useful for:
/// - Setting state flags (e.g., "mission_started", "phase" values)
/// - Initializing blackboard values
/// - Testing behavior trees
/// - Passing data between nodes
///
/// # Behavior
///
/// - Writes the configured value to the configured key
/// - Always returns `Success` (never fails)
/// - Completes in a single tick (never `Running`)
///
/// # Examples
///
/// ## Basic Usage
///
/// ```
/// use igris_btree::prelude::*;
/// use serde_json::json;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut node = SetBlackboard::new("set_status", "status", "ready");
/// let mut context = BTreeContext::new();
///
/// let status = node.tick(&mut context).await?;
///
/// assert_eq!(status, NodeStatus::Success);
/// assert_eq!(context.blackboard.get("status").await, Some(json!("ready")));
/// # Ok(())
/// # }
/// ```
///
/// ## Setting Complex Values
///
/// ```
/// use igris_btree::prelude::*;
/// use serde_json::json;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let config = json!({
///     "timeout": 5000,
///     "retry": true,
///     "max_attempts": 3
/// });
///
/// let mut node = SetBlackboard::new("set_config", "config", config.clone());
/// let mut context = BTreeContext::new();
///
/// node.tick(&mut context).await?;
///
/// assert_eq!(context.blackboard.get("config").await, Some(config));
/// # Ok(())
/// # }
/// ```
pub struct SetBlackboard {
    name: String,
    key: String,
    value: Value,
}

impl SetBlackboard {
    /// Create a new SetBlackboard node.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `key` - Blackboard key to write to
    /// * `value` - Value to write (converted to JSON)
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::nodes::action::SetBlackboard;
    /// use serde_json::json;
    ///
    /// let node = SetBlackboard::new("init", "phase", "starting");
    /// assert_eq!(node.name(), "init");
    ///
    /// // Can also use JSON values directly
    /// let node2 = SetBlackboard::new("set_count", "count", json!(42));
    /// ```
    pub fn new(name: impl Into<String>, key: impl Into<String>, value: impl Into<Value>) -> Self {
        Self {
            name: name.into(),
            key: key.into(),
            value: value.into(),
        }
    }
}

#[async_trait]
impl BTreeNode for SetBlackboard {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "SetBlackboard"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        context.blackboard.set(&self.key, self.value.clone()).await;
        Ok(NodeStatus::Success)
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "SetBlackboard",
            "key": self.key,
            "value": self.value
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_set_blackboard() {
        let mut node = SetBlackboard::new("set", "key", "value");
        let mut context = BTreeContext::new();

        let status = node.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Success);

        let value = context.blackboard.get("key").await;
        assert_eq!(value, Some(serde_json::json!("value")));
    }
}
