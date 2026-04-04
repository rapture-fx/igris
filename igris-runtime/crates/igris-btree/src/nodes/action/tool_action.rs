//! ToolAction node - executes tools from the igris-tools registry.

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use igris_tools::ToolRegistry;
use serde_json::Value;
use std::sync::Arc;
use tracing::{debug, warn};

/// ToolAction: Execute an igris-tools tool.
///
/// This node executes tools registered in the `ToolRegistry`. Tools can be
/// anything from navigation commands to sensor readings to manipulation actions.
///
/// # Behavior
///
/// - Looks up the specified tool in the registry
/// - Executes the tool with the provided arguments
/// - Returns `Success` if the tool reports success
/// - Returns `Failure` if the tool reports failure or errors
/// - Completes in a single tick (tools are responsible for their own async behavior)
///
/// # Tool Integration
///
/// Tools are provided by the `igris-tools` crate and registered in a `ToolRegistry`.
/// The registry is passed to the context at initialization:
///
/// ```no_run
/// use igris_btree::prelude::*;
/// use igris_tools::ToolRegistry;
///
/// let mut registry = ToolRegistry::new();
/// // Register tools here...
///
/// let context = BTreeContext::new()
///     .with_tools(Arc::new(registry));
/// ```
///
/// # Examples
///
/// ## Basic Tool Execution
///
/// ```no_run
/// use igris_btree::prelude::*;
/// use igris_tools::ToolRegistry;
/// use serde_json::json;
///
/// # #[tokio::main]
/// # async fn main() -> anyhow::Result<()> {
/// let mut registry = ToolRegistry::new();
/// // Assume "navigate" tool is registered
///
/// let mut node = ToolAction::new(
///     "move_forward",
///     "navigate",
///     json!({"direction": "forward", "distance": 10}),
///     Arc::new(registry)
/// );
///
/// let mut context = BTreeContext::new();
/// let status = node.tick(&mut context).await?;
/// # Ok(())
/// # }
/// ```
pub struct ToolAction {
    name: String,
    tool_name: String,
    args: Value,
    registry: Arc<ToolRegistry>,
}

impl ToolAction {
    /// Create a new ToolAction node.
    ///
    /// # Arguments
    ///
    /// * `name` - Node name for debugging
    /// * `tool_name` - Name of the tool to execute (must be registered)
    /// * `args` - JSON arguments to pass to the tool
    /// * `registry` - Tool registry containing tool implementations
    ///
    /// # Example
    ///
    /// ```no_run
    /// use igris_btree::nodes::action::ToolAction;
    /// use igris_tools::ToolRegistry;
    /// use serde_json::json;
    /// use std::sync::Arc;
    ///
    /// let registry = Arc::new(ToolRegistry::new());
    /// let node = ToolAction::new(
    ///     "scan_area",
    ///     "lidar_scan",
    ///     json!({"angle": 180, "resolution": 1}),
    ///     registry
    /// );
    /// ```
    pub fn new(
        name: impl Into<String>,
        tool_name: impl Into<String>,
        args: Value,
        registry: Arc<ToolRegistry>,
    ) -> Self {
        Self {
            name: name.into(),
            tool_name: tool_name.into(),
            args,
            registry,
        }
    }
}

#[async_trait]
impl BTreeNode for ToolAction {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "ToolAction"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        debug!("ToolAction '{}': Executing tool '{}'", self.name, self.tool_name);

        // When a WAL session is active, derive a deterministic idempotency key so
        // that re-executing this tick (e.g. after a crash before WAL commit) returns
        // the cached result rather than re-firing the tool's side effect.
        #[cfg(feature = "wal")]
        let tool_result = {
            if let Some(ref session) = context.wal_session {
                use sha2::{Digest, Sha256};
                let args_hash = format!(
                    "{:x}",
                    Sha256::digest(serde_json::to_vec(&self.args).unwrap_or_default())
                );
                let key = format!(
                    "{}:{}:{}:{}",
                    session.task_id, context.tick_count, self.tool_name, args_hash
                );
                self.registry
                    .execute_idempotent(&key, &self.tool_name, self.args.clone())
                    .await
            } else {
                self.registry.execute(&self.tool_name, self.args.clone()).await
            }
        };

        #[cfg(not(feature = "wal"))]
        let tool_result = self.registry.execute(&self.tool_name, self.args.clone()).await;

        match tool_result {
            Ok(result) => {
                if result.success {
                    debug!("ToolAction '{}': Tool succeeded ({}ms)", self.name, result.execution_time_ms);
                    Ok(NodeStatus::Success)
                } else {
                    warn!(
                        "ToolAction '{}': Tool failed: {}",
                        self.name,
                        result.error.unwrap_or_else(|| "unknown error".to_string())
                    );
                    Ok(NodeStatus::Failure)
                }
            }
            Err(e) => {
                warn!("ToolAction '{}': Tool execution error: {}", self.name, e);
                Ok(NodeStatus::Failure)
            }
        }
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "ToolAction",
            "tool": self.tool_name,
            "args": self.args
        }))
    }
}
