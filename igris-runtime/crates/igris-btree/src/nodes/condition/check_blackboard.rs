//! CheckBlackboard condition node - checks if a blackboard value matches an expected value.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

/// CheckBlackboard: Condition that checks if a blackboard value matches an expected value.
///
/// This is a basic condition node that compares a blackboard value against
/// an expected value. Useful for:
/// - Precondition checking (e.g., "is battery > 20%")
/// - State validation (e.g., "is phase == 'ready'")
/// - Branching logic in Selector nodes
/// - Conditional execution in Sequence nodes
///
/// # Behavior
///
/// - Reads the specified key from the blackboard
/// - Compares the value against the expected value (using JSON equality)
/// - Returns `Success` if they match
/// - Returns `Failure` if they don't match or if the key doesn't exist
/// - Completes in a single tick (never `Running`)
///
/// # Examples
///
/// ## Basic Condition Check
///
/// ```
/// use igris_btree::prelude::*;
/// use serde_json::json;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut node = CheckBlackboard::new("check_status", "status", json!("ready"));
/// let mut context = BTreeContext::new();
///
/// // Key doesn't exist → Failure
/// let status = node.tick(&mut context).await?;
/// assert_eq!(status, NodeStatus::Failure);
///
/// // Set matching value → Success
/// context.blackboard.set("status", json!("ready")).await;
/// let status = node.tick(&mut context).await?;
/// assert_eq!(status, NodeStatus::Success);
///
/// // Set different value → Failure
/// context.blackboard.set("status", json!("busy")).await;
/// let status = node.tick(&mut context).await?;
/// assert_eq!(status, NodeStatus::Failure);
/// # Ok(())
/// # }
/// ```
///
/// ## Using in a Sequence
///
/// ```
/// use igris_btree::prelude::*;
/// use serde_json::json;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut sequence = Sequence::new("conditional_action")
///     .add_child(Box::new(CheckBlackboard::new("check", "enabled", true)))
///     .add_child(Box::new(SetBlackboard::new("act", "action_taken", true)));
///
/// let mut context = BTreeContext::new();
///
/// // Without "enabled" flag, check fails and action doesn't execute
/// let status = sequence.tick(&mut context).await?;
/// assert_eq!(status, NodeStatus::Failure);
/// assert!(!context.blackboard.contains("action_taken").await);
///
/// // With "enabled" flag, check succeeds and action executes
/// context.blackboard.set("enabled", json!(true)).await;
/// let status = sequence.tick(&mut context).await?;
/// assert_eq!(status, NodeStatus::Success);
/// assert!(context.blackboard.contains("action_taken").await);
/// # Ok(())
/// # }
/// ```
pub struct CheckBlackboard {
    name: String,
    key: String,
    expected: Value,
}

impl CheckBlackboard {
    /// Create a new CheckBlackboard node.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `key` - Blackboard key to check
    /// * `expected` - Expected value to match against
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::nodes::condition::CheckBlackboard;
    /// use serde_json::json;
    ///
    /// let node = CheckBlackboard::new("check_ready", "status", json!("ready"));
    /// assert_eq!(node.name(), "check_ready");
    ///
    /// // Can check any JSON-serializable value
    /// let node2 = CheckBlackboard::new("check_count", "count", json!(42));
    /// let node3 = CheckBlackboard::new("check_flag", "enabled", json!(true));
    /// ```
    pub fn new(name: impl Into<String>, key: impl Into<String>, expected: Value) -> Self {
        Self {
            name: name.into(),
            key: key.into(),
            expected,
        }
    }
}

#[async_trait]
impl BTreeNode for CheckBlackboard {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "CheckBlackboard"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        let value = context.blackboard.get(&self.key).await;

        if let Some(val) = value {
            if val == self.expected {
                Ok(NodeStatus::Success)
            } else {
                Ok(NodeStatus::Failure)
            }
        } else {
            Ok(NodeStatus::Failure)
        }
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "CheckBlackboard",
            "key": self.key,
            "expected": self.expected
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_blackboard() {
        let mut node = CheckBlackboard::new("check", "key", serde_json::json!("value"));
        let mut context = BTreeContext::new();

        // No value set → Failure
        let status = node.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Failure);

        // Set matching value → Success
        context
            .blackboard
            .set("key", serde_json::json!("value"))
            .await;
        let status = node.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Success);

        // Set different value → Failure
        context
            .blackboard
            .set("key", serde_json::json!("other"))
            .await;
        let status = node.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Failure);
    }
}
