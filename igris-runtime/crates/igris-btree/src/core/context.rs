//! Execution context for behavior tree nodes.
//!
//! The context carries all the shared state and dependencies that nodes need
//! during execution, including the blackboard, LLM provider, tools, and
//! real-time executor.

use super::Blackboard;
use crate::LlmProvider;
use igris_tools::ToolRegistry;
use std::sync::Arc;

#[cfg(feature = "ros2")]
use igris_ros2::Ros2Node;

#[cfg(feature = "wal")]
use {
    ed25519_dalek::SigningKey,
    igris_wal::{BtCheckpointPayload, WalLog},
    uuid::Uuid,
};

/// WAL session for a BT execution. Attach to context via `with_wal()`.
#[cfg(feature = "wal")]
pub struct BtWalSession {
    pub wal: Arc<WalLog>,
    pub signing_key: Arc<SigningKey>,
    pub task_id: Uuid,
    /// Checkpoint every N ticks (default: 10).
    pub checkpoint_every: u64,
}

/// Execution context passed to all nodes during ticking.
///
/// The context is passed to every node's `tick()` method and provides:
/// - Shared blackboard for inter-node communication
/// - Optional LLM provider (BYOM - Bring Your Own Model)
/// - Optional tool registry for action execution
/// - Optional RT executor for bounded/real-time execution
/// - Execution metrics (tick count, timing, etc.)
///
/// # Design Philosophy
///
/// The context uses the **BYOM (Bring Your Own Model)** philosophy:
/// - Customers provide their own LLM via the `LlmProvider` trait
/// - No vendor lock-in or hosted services
/// - Full control over inference, cost, and latency
///
/// # Examples
///
/// ## Basic Context
///
/// ```
/// use igris_btree::core::BTreeContext;
///
/// let context = BTreeContext::new();
/// assert_eq!(context.tick_count, 0);
/// assert!(!context.has_llm());
/// ```
///
/// ## Context with LLM Provider
///
/// ```
/// use igris_btree::prelude::*;
/// use igris_btree::MockLlmProvider;
///
/// let provider = Arc::new(MockLlmProvider::new(vec![]));
/// let context = BTreeContext::new()
///     .with_llm(provider);
///
/// assert!(context.has_llm());
/// ```
///
/// ## Full Context Setup
///
/// ```
/// use igris_btree::prelude::*;
/// use igris_btree::MockLlmProvider;
/// use igris_tools::ToolRegistry;
///
/// let provider = Arc::new(MockLlmProvider::new(vec![]));
/// let tools = Arc::new(ToolRegistry::new());
///
/// let context = BTreeContext::new()
///     .with_llm(provider)
///     .with_tools(tools);
///
/// assert!(context.has_llm());
/// assert!(context.has_tools());
/// ```
pub struct BTreeContext {
    /// Shared blackboard for inter-node communication.
    ///
    /// Nodes read and write state to the blackboard to coordinate behavior.
    pub blackboard: Blackboard,

    /// Total ticks executed in this context.
    ///
    /// Incremented by the executor on each tick. Useful for debugging,
    /// metrics, and detecting infinite loops.
    pub tick_count: u64,

    /// Optional LLM provider (customer-supplied, BYOM).
    ///
    /// Required for LLM-powered nodes like `LLMPlannerNode` and `ReplanOnFailure`.
    /// Customers implement the `LlmProvider` trait with their own model.
    pub llm_provider: Option<Arc<dyn LlmProvider>>,

    /// Optional tool registry for action nodes.
    ///
    /// Required for `ToolAction` nodes. Contains definitions and implementations
    /// of available tools (e.g., navigation, manipulation, perception).
    pub tool_registry: Option<Arc<ToolRegistry>>,

    /// Optional RT executor for bounded execution with deadlines.
    ///
    /// When provided, LLM operations and other long-running tasks can be
    /// executed with real-time guarantees and deadline monitoring.
    pub rt_executor: Option<Arc<igris_rt::RtExecutor>>,

    /// Optional ROS2 node for topic publish/subscribe and service calls.
    ///
    /// Required for `RosTopicPublish`, `RosTopicSubscribe`, and `RosServiceCall` nodes.
    /// Enable the `ros2` feature flag to use ROS2 BT nodes.
    #[cfg(feature = "ros2")]
    pub ros2_node: Option<Arc<Ros2Node>>,

    /// Optional WAL session for crash-recoverable execution.
    #[cfg(feature = "wal")]
    pub wal_session: Option<Arc<BtWalSession>>,

    /// Last WAL checkpoint produced during execution.
    #[cfg(feature = "wal")]
    pub last_checkpoint: Option<BtCheckpointPayload>,
}

impl BTreeContext {
    /// Create a new context with an empty blackboard.
    ///
    /// All optional dependencies (LLM, tools, RT executor) start as `None`
    /// and can be added via builder methods.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::BTreeContext;
    ///
    /// let context = BTreeContext::new();
    /// assert_eq!(context.tick_count, 0);
    /// ```
    pub fn new() -> Self {
        Self {
            blackboard: Blackboard::new(),
            tick_count: 0,
            llm_provider: None,
            tool_registry: None,
            rt_executor: None,
            #[cfg(feature = "ros2")]
            ros2_node: None,
            #[cfg(feature = "wal")]
            wal_session: None,
            #[cfg(feature = "wal")]
            last_checkpoint: None,
        }
    }

    /// Set the LLM provider (BYOM - customer brings their own model).
    ///
    /// The LLM provider is used by nodes like `LLMPlannerNode` and
    /// `ReplanOnFailure` to generate dynamic behavior trees.
    ///
    /// # Arguments
    ///
    /// * `provider` - An implementation of the `LlmProvider` trait
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    /// use igris_btree::MockLlmProvider;
    ///
    /// let provider = Arc::new(MockLlmProvider::new(vec![]));
    /// let context = BTreeContext::new().with_llm(provider);
    /// assert!(context.has_llm());
    /// ```
    pub fn with_llm(mut self, provider: Arc<dyn LlmProvider>) -> Self {
        self.llm_provider = Some(provider);
        self
    }

    /// Set the tool registry for action nodes.
    ///
    /// The tool registry contains definitions and implementations of available
    /// tools (e.g., navigation, manipulation, perception) that `ToolAction`
    /// nodes can execute.
    ///
    /// # Arguments
    ///
    /// * `registry` - A tool registry with registered tools
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::prelude::*;
    /// use igris_tools::ToolRegistry;
    ///
    /// let tools = Arc::new(ToolRegistry::new());
    /// let context = BTreeContext::new().with_tools(tools);
    /// assert!(context.has_tools());
    /// ```
    pub fn with_tools(mut self, registry: Arc<ToolRegistry>) -> Self {
        self.tool_registry = Some(registry);
        self
    }

    /// Set the RT executor for bounded execution.
    ///
    /// When provided, long-running operations (like LLM inference) can be
    /// executed with real-time guarantees and deadline monitoring.
    ///
    /// # Arguments
    ///
    /// * `executor` - An igris-rt executor instance
    ///
    /// # Example
    ///
    /// ```no_run
    /// use igris_btree::prelude::*;
    /// use igris_rt::RtExecutor;
    ///
    /// let rt_executor = Arc::new(RtExecutor::new());
    /// let context = BTreeContext::new().with_rt_executor(rt_executor);
    /// assert!(context.has_rt_executor());
    /// ```
    pub fn with_rt_executor(mut self, executor: Arc<igris_rt::RtExecutor>) -> Self {
        self.rt_executor = Some(executor);
        self
    }

    /// Set the ROS2 node for robotics action nodes (requires `ros2` feature).
    ///
    /// Required for `RosTopicPublish`, `RosTopicSubscribe`, and `RosServiceCall` nodes.
    #[cfg(feature = "ros2")]
    pub fn with_ros2(mut self, node: Arc<Ros2Node>) -> Self {
        self.ros2_node = Some(node);
        self
    }

    /// Attach a WAL session for crash-recoverable BT execution.
    /// When set, each tick is written to the WAL before execution and
    /// committed after. The blackboard is checkpointed every N ticks.
    ///
    /// # Panics
    ///
    /// Panics if `session.checkpoint_every == 0` (would cause division by zero
    /// in the tick loop).
    #[cfg(feature = "wal")]
    pub fn with_wal(mut self, session: BtWalSession) -> Self {
        assert!(
            session.checkpoint_every > 0,
            "BtWalSession.checkpoint_every must be > 0"
        );
        self.wal_session = Some(Arc::new(session));
        self
    }

    /// Returns true if a ROS2 node is available (requires `ros2` feature).
    #[cfg(feature = "ros2")]
    pub fn has_ros2(&self) -> bool {
        self.ros2_node.is_some()
    }

    /// Get the ROS2 node or return an error if not configured (requires `ros2` feature).
    #[cfg(feature = "ros2")]
    pub fn require_ros2(&self) -> anyhow::Result<Arc<Ros2Node>> {
        self.ros2_node.clone().ok_or_else(|| {
            anyhow::anyhow!("ROS2 node not configured in context — call with_ros2()")
        })
    }

    /// Check if an LLM provider is available.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::BTreeContext;
    ///
    /// let context = BTreeContext::new();
    /// assert!(!context.has_llm());
    /// ```
    pub fn has_llm(&self) -> bool {
        self.llm_provider.is_some()
    }

    /// Check if a tool registry is available.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::BTreeContext;
    ///
    /// let context = BTreeContext::new();
    /// assert!(!context.has_tools());
    /// ```
    pub fn has_tools(&self) -> bool {
        self.tool_registry.is_some()
    }

    /// Check if an RT executor is available.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::BTreeContext;
    ///
    /// let context = BTreeContext::new();
    /// assert!(!context.has_rt_executor());
    /// ```
    pub fn has_rt_executor(&self) -> bool {
        self.rt_executor.is_some()
    }

    /// Get the LLM provider or return an error if not configured.
    ///
    /// This is typically called by LLM-powered nodes to access the provider.
    ///
    /// # Returns
    ///
    /// Returns `Ok(provider)` if configured, otherwise returns an error.
    ///
    /// # Errors
    ///
    /// Returns an error if no LLM provider was configured in the context.
    ///
    /// # Example
    ///
    /// ```
    /// use igris_btree::core::BTreeContext;
    ///
    /// let context = BTreeContext::new();
    /// assert!(context.require_llm().is_err());
    /// ```
    pub fn require_llm(&self) -> anyhow::Result<Arc<dyn LlmProvider>> {
        self.llm_provider
            .clone()
            .ok_or_else(|| anyhow::anyhow!("LLM provider not configured in context"))
    }

    /// Get the tool registry or return an error if not configured.
    ///
    /// This is typically called by `ToolAction` nodes to access tools.
    ///
    /// # Returns
    ///
    /// Returns `Ok(registry)` if configured, otherwise returns an error.
    ///
    /// # Errors
    ///
    /// Returns an error if no tool registry was configured in the context.
    pub fn require_tools(&self) -> anyhow::Result<Arc<ToolRegistry>> {
        self.tool_registry
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Tool registry not configured in context"))
    }

    /// Get the RT executor or return an error if not configured.
    ///
    /// This is typically called by nodes that need real-time guarantees.
    ///
    /// # Returns
    ///
    /// Returns `Ok(executor)` if configured, otherwise returns an error.
    ///
    /// # Errors
    ///
    /// Returns an error if no RT executor was configured in the context.
    pub fn require_rt_executor(&self) -> anyhow::Result<Arc<igris_rt::RtExecutor>> {
        self.rt_executor
            .clone()
            .ok_or_else(|| anyhow::anyhow!("RT executor not configured in context"))
    }
}

impl Default for BTreeContext {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MockLlmProvider;

    #[test]
    fn test_context_builder() {
        let provider = Arc::new(MockLlmProvider::new(vec![]));
        let context = BTreeContext::new().with_llm(provider);

        assert!(context.has_llm());
        assert!(!context.has_tools());
        assert!(!context.has_rt_executor());
    }

    #[test]
    fn test_context_require() {
        let context = BTreeContext::new();

        // Should error when not configured
        assert!(context.require_llm().is_err());
        assert!(context.require_tools().is_err());

        // Should succeed when configured
        let provider = Arc::new(MockLlmProvider::new(vec![]));
        let context = BTreeContext::new().with_llm(provider);
        assert!(context.require_llm().is_ok());
    }
}
