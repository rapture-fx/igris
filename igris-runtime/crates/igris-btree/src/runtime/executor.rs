//! High-level behavior tree executor with lifecycle management

use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use crate::runtime::ExecutionResult;
use crate::visualizer::TreeVisualizer;
use anyhow::Result;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::watch;
use tracing::{debug, info, warn};

#[cfg(feature = "wal")]
use {
    igris_wal::{BtCheckpointPayload, ResumeToken, StepType},
    sha2::{Digest, Sha256},
};

/// Executor configuration
#[derive(Debug, Clone)]
pub struct ExecutorConfig {
    /// Maximum number of ticks before stopping (None = unlimited)
    pub max_ticks: Option<u64>,

    /// Maximum execution duration before stopping (None = unlimited)
    pub deadline: Option<Duration>,

    /// Enable execution tracing
    pub enable_tracing: bool,

    /// Delay between ticks (for rate limiting)
    pub tick_delay: Option<Duration>,
}

impl Default for ExecutorConfig {
    fn default() -> Self {
        Self {
            max_ticks: None,
            deadline: None,
            enable_tracing: false,
            tick_delay: None,
        }
    }
}

/// High-level behavior tree executor
///
/// Provides lifecycle management, execution bounds, and cancellation support.
///
/// # Example
///
/// ```no_run
/// use igris_btree::prelude::*;
/// use igris_btree::runtime::BTreeExecutor;
/// use std::time::Duration;
///
/// #[tokio::main]
/// async fn main() -> anyhow::Result<()> {
///     let executor = BTreeExecutor::new()
///         .with_max_ticks(1000)
///         .with_deadline(Duration::from_secs(30))
///         .with_tracing(true);
///
///     let mut tree = Sequence::new("mission");
///     let mut context = BTreeContext::new();
///
///     let result = executor.execute(&mut tree, &mut context).await?;
///     println!("Execution completed: {}", result);
///
///     Ok(())
/// }
/// ```
pub struct BTreeExecutor {
    config: ExecutorConfig,
    visualizer: Option<Arc<TreeVisualizer>>,
    /// Optional per-tick state observer. After each tick the executor sends a
    /// JSON snapshot `{"tick": N, "status": "Running"|"Success"|..., "tree": {...}}`
    /// to this channel. The send is best-effort — a lagged receiver does not
    /// stall execution.
    tick_observer: Option<tokio::sync::watch::Sender<serde_json::Value>>,
}

impl BTreeExecutor {
    /// Create a new executor with default configuration
    pub fn new() -> Self {
        Self {
            config: ExecutorConfig::default(),
            visualizer: None,
            tick_observer: None,
        }
    }

    /// Create executor with custom configuration
    pub fn with_config(config: ExecutorConfig) -> Self {
        Self {
            config,
            visualizer: None,
            tick_observer: None,
        }
    }

    /// Attach a visualizer for monitoring and debugging
    pub fn with_visualizer(mut self, visualizer: Arc<TreeVisualizer>) -> Self {
        self.visualizer = Some(visualizer);
        self
    }

    /// Attach a tick observer channel for live streaming.
    ///
    /// After every tick the executor sends:
    /// `{"tick": N, "status": "Running"|"Success"|"Failure", "tree": <tree_json>}`
    /// Sends are best-effort — a stalled receiver does not block execution.
    pub fn with_tick_observer(mut self, tx: tokio::sync::watch::Sender<serde_json::Value>) -> Self {
        self.tick_observer = Some(tx);
        self
    }

    /// Set maximum ticks (builder pattern)
    pub fn with_max_ticks(mut self, max_ticks: u64) -> Self {
        self.config.max_ticks = Some(max_ticks);
        self
    }

    /// Set execution deadline (builder pattern)
    pub fn with_deadline(mut self, deadline: Duration) -> Self {
        self.config.deadline = Some(deadline);
        self
    }

    /// Enable execution tracing (builder pattern)
    pub fn with_tracing(mut self, enabled: bool) -> Self {
        self.config.enable_tracing = enabled;
        self
    }

    /// Set tick delay for rate limiting (builder pattern)
    pub fn with_tick_delay(mut self, delay: Duration) -> Self {
        self.config.tick_delay = Some(delay);
        self
    }

    /// Execute a behavior tree until completion or limits reached
    ///
    /// This method runs the tree's tick loop automatically, handling:
    /// - Max ticks enforcement
    /// - Deadline enforcement
    /// - Execution metadata collection
    ///
    /// Returns an ExecutionResult with final status and metadata.
    pub async fn execute(
        &self,
        tree: &mut dyn BTreeNode,
        context: &mut BTreeContext,
    ) -> Result<ExecutionResult> {
        let (tx, rx) = watch::channel(false);
        drop(tx); // Never cancel

        self.execute_with_cancel(tree, context, rx).await
    }

    /// Execute with cancellation support
    ///
    /// Allows external cancellation via a watch channel.
    /// When the channel receives `true`, execution stops gracefully.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use igris_btree::prelude::*;
    /// use igris_btree::runtime::BTreeExecutor;
    /// use tokio::sync::watch;
    ///
    /// #[tokio::main]
    /// async fn main() -> anyhow::Result<()> {
    ///     let executor = BTreeExecutor::new();
    ///     let mut tree = Sequence::new("mission");
    ///     let mut context = BTreeContext::new();
    ///
    ///     let (cancel_tx, cancel_rx) = watch::channel(false);
    ///
    ///     // Spawn execution task
    ///     let handle = tokio::spawn(async move {
    ///         executor.execute_with_cancel(&mut tree, &mut context, cancel_rx).await
    ///     });
    ///
    ///     // Later: cancel execution
    ///     cancel_tx.send(true)?;
    ///
    ///     let result = handle.await??;
    ///     println!("Cancelled: {}", result.cancelled);
    ///
    ///     Ok(())
    /// }
    /// ```
    pub async fn execute_with_cancel(
        &self,
        tree: &mut dyn BTreeNode,
        context: &mut BTreeContext,
        mut cancel_rx: watch::Receiver<bool>,
    ) -> Result<ExecutionResult> {
        let start_time = Instant::now();
        let mut tick_count = 0u64;

        if self.config.enable_tracing {
            info!(
                "Starting execution of tree '{}' (type: {})",
                tree.name(),
                tree.node_type()
            );
            debug!("Config: {:?}", self.config);
        }

        loop {
            // Check cancellation
            if *cancel_rx.borrow_and_update() {
                warn!("Execution cancelled at tick {}", tick_count);
                tree.halt().await;
                let mut result =
                    ExecutionResult::new(NodeStatus::Running, tick_count, start_time.elapsed())
                        .with_cancelled();
                #[cfg(feature = "wal")]
                if let Some(cp) = context.last_checkpoint.take() {
                    result = result.with_checkpoint(cp);
                }
                return Ok(result);
            }

            // Check max ticks
            if let Some(max_ticks) = self.config.max_ticks {
                if tick_count >= max_ticks {
                    warn!("Max ticks ({}) reached", max_ticks);
                    tree.halt().await;
                    let mut result =
                        ExecutionResult::new(NodeStatus::Running, tick_count, start_time.elapsed())
                            .with_max_ticks_reached();
                    #[cfg(feature = "wal")]
                    if let Some(cp) = context.last_checkpoint.take() {
                        result = result.with_checkpoint(cp);
                    }
                    return Ok(result);
                }
            }

            // Check deadline
            if let Some(deadline) = self.config.deadline {
                if start_time.elapsed() >= deadline {
                    warn!("Deadline ({:?}) exceeded", deadline);
                    tree.halt().await;
                    let mut result =
                        ExecutionResult::new(NodeStatus::Running, tick_count, start_time.elapsed())
                            .with_deadline_exceeded();
                    #[cfg(feature = "wal")]
                    if let Some(cp) = context.last_checkpoint.take() {
                        result = result.with_checkpoint(cp);
                    }
                    return Ok(result);
                }
            }

            // Execute tick
            tick_count += 1;
            context.tick_count = tick_count;

            if self.config.enable_tracing {
                debug!("Tick {} starting", tick_count);
            }

            // WAL: write intent before tick
            #[cfg(feature = "wal")]
            let wal_entry_id = if let Some(ref session) = context.wal_session {
                let bb_snapshot = context.blackboard.snapshot().await;
                let input_digest: [u8; 32] =
                    Sha256::digest(serde_json::to_vec(&bb_snapshot).unwrap_or_default()).into();
                match session.wal.write_intent(
                    tick_count as u32,
                    StepType::BtNode {
                        node_id: tree.name().to_string(),
                        node_type: tree.node_type().to_string(),
                    },
                    input_digest,
                ) {
                    Ok(entry) => Some(entry.entry_id),
                    Err(e) => {
                        warn!("WAL intent write failed at tick {}: {}", tick_count, e);
                        None
                    }
                }
            } else {
                None
            };

            let status = match tree.tick(context).await {
                Ok(s) => s,
                Err(e) => {
                    warn!("Tick {} failed: {}", tick_count, e);
                    let mut result =
                        ExecutionResult::new(NodeStatus::Failure, tick_count, start_time.elapsed())
                            .with_error(e.to_string());
                    #[cfg(feature = "wal")]
                    if let Some(cp) = context.last_checkpoint.take() {
                        result = result.with_checkpoint(cp);
                    }
                    return Ok(result);
                }
            };

            if self.config.enable_tracing {
                debug!("Tick {} completed with status: {:?}", tick_count, status);
            }

            // Export visualization state (optimized for <5ms)
            if let Some(ref visualizer) = self.visualizer {
                let export_start = Instant::now();
                if let Err(e) = visualizer.export_snapshot(tree, context, tick_count).await {
                    warn!("Visualization export failed: {}", e);
                }
                let export_duration = export_start.elapsed();
                if export_duration.as_millis() > 5 {
                    warn!(
                        "Visualization export took {:?} (>5ms threshold)",
                        export_duration
                    );
                }
            }

            // Emit live tick snapshot to any connected SSE observer.
            if let Some(ref tx) = self.tick_observer {
                let tree_json = tree.to_json().unwrap_or_else(|_| serde_json::Value::Null);
                let _ = tx.send(serde_json::json!({
                    "tick": tick_count,
                    "status": format!("{:?}", status),
                    "tree": tree_json,
                }));
            }

            // WAL: commit after successful tick
            #[cfg(feature = "wal")]
            if let (Some(entry_id), Some(ref session)) =
                (wal_entry_id, context.wal_session.as_ref())
            {
                let bb_after = context.blackboard.snapshot().await;
                let output_digest: [u8; 32] =
                    Sha256::digest(serde_json::to_vec(&bb_after).unwrap_or_default()).into();
                if let Err(e) =
                    session
                        .wal
                        .write_committed(entry_id, output_digest, &session.signing_key)
                {
                    warn!("WAL commit failed at tick {}: {}", tick_count, e);
                }
            }

            // WAL: periodic blackboard checkpoint
            #[cfg(feature = "wal")]
            if let Some(ref session) = context.wal_session.clone() {
                if tick_count > 0 && tick_count % session.checkpoint_every == 0 {
                    let bb_snapshot = context.blackboard.snapshot().await;
                    let (last_step, digest) =
                        session.wal.committed_state().unwrap_or((None, [0u8; 32]));
                    let cp = BtCheckpointPayload {
                        task_id: session.task_id,
                        tick_count,
                        resume_token: ResumeToken {
                            last_committed_step: last_step.unwrap_or(0),
                            checkpoint_digest: digest,
                            runtime_id: String::new(),
                        },
                        blackboard_state: bb_snapshot,
                        wal_entries: session
                            .wal
                            .read_from_step(
                                last_step
                                    .map(|s| s.saturating_sub(session.checkpoint_every as u32))
                                    .unwrap_or(0),
                            )
                            .unwrap_or_default(),
                    };
                    context.last_checkpoint = Some(cp);
                }
            }

            // Check if execution is complete
            match status {
                NodeStatus::Success => {
                    if self.config.enable_tracing {
                        info!(
                            "Execution succeeded after {} ticks ({:?})",
                            tick_count,
                            start_time.elapsed()
                        );
                    }
                    let mut result =
                        ExecutionResult::new(NodeStatus::Success, tick_count, start_time.elapsed());
                    #[cfg(feature = "wal")]
                    if let Some(cp) = context.last_checkpoint.take() {
                        result = result.with_checkpoint(cp);
                    }
                    return Ok(result);
                }
                NodeStatus::Failure => {
                    if self.config.enable_tracing {
                        info!(
                            "Execution failed after {} ticks ({:?})",
                            tick_count,
                            start_time.elapsed()
                        );
                    }
                    let mut result =
                        ExecutionResult::new(NodeStatus::Failure, tick_count, start_time.elapsed());
                    #[cfg(feature = "wal")]
                    if let Some(cp) = context.last_checkpoint.take() {
                        result = result.with_checkpoint(cp);
                    }
                    return Ok(result);
                }
                NodeStatus::Skipped => {
                    if self.config.enable_tracing {
                        info!("Execution skipped after {} ticks", tick_count);
                    }
                    let mut result =
                        ExecutionResult::new(NodeStatus::Skipped, tick_count, start_time.elapsed());
                    #[cfg(feature = "wal")]
                    if let Some(cp) = context.last_checkpoint.take() {
                        result = result.with_checkpoint(cp);
                    }
                    return Ok(result);
                }
                NodeStatus::Running => {
                    // Continue to next tick
                    if let Some(delay) = self.config.tick_delay {
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }
    }

    /// Execute a single tick (for manual control)
    ///
    /// Use this when you want fine-grained control over execution.
    pub async fn tick(
        &self,
        tree: &mut dyn BTreeNode,
        context: &mut BTreeContext,
    ) -> Result<NodeStatus> {
        context.tick_count += 1;

        if self.config.enable_tracing {
            debug!(
                "Manual tick {} on tree '{}'",
                context.tick_count,
                tree.name()
            );
        }

        tree.tick(context).await
    }
}

impl Default for BTreeExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nodes::action::SetBlackboard;
    use crate::nodes::composite::Sequence;

    #[tokio::test]
    async fn test_executor_basic() {
        let executor = BTreeExecutor::new();
        let mut context = BTreeContext::new();

        let mut tree = Sequence::new("test")
            .add_child(Box::new(SetBlackboard::new("set1", "key1", "value1")))
            .add_child(Box::new(SetBlackboard::new("set2", "key2", "value2")));

        let result = executor.execute(&mut tree, &mut context).await.unwrap();

        assert!(result.is_success());
        assert_eq!(result.tick_count, 1);
        assert!(!result.is_interrupted());
    }

    #[tokio::test]
    async fn test_executor_max_ticks() {
        let executor = BTreeExecutor::new().with_max_ticks(5);
        let mut context = BTreeContext::new();

        // Create a tree that never completes
        let mut tree = crate::nodes::decorator::Repeat::infinite(
            "infinite",
            Box::new(SetBlackboard::new("set", "key", "value")),
        );

        let result = executor.execute(&mut tree, &mut context).await.unwrap();

        assert!(result.max_ticks_reached);
        assert!(result.is_interrupted());
        assert_eq!(result.tick_count, 5);
    }

    #[tokio::test]
    async fn test_executor_deadline() {
        let executor = BTreeExecutor::new().with_deadline(Duration::from_millis(100));

        let mut context = BTreeContext::new();

        // Create a tree that sleeps
        use crate::core::{BTreeNode, NodeStatus};
        use async_trait::async_trait;

        struct SlowNode;
        #[async_trait]
        impl BTreeNode for SlowNode {
            fn name(&self) -> &str {
                "slow"
            }
            fn node_type(&self) -> &str {
                "Slow"
            }
            async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
                tokio::time::sleep(Duration::from_millis(50)).await;
                Ok(NodeStatus::Running)
            }
            async fn reset(&mut self) {}
            fn to_json(&self) -> Result<serde_json::Value> {
                Ok(serde_json::json!({"type": "Slow"}))
            }
        }

        let mut tree = SlowNode;
        let result = executor.execute(&mut tree, &mut context).await.unwrap();

        assert!(result.deadline_exceeded);
        assert!(result.is_interrupted());
    }

    #[tokio::test]
    async fn test_executor_cancellation() {
        let executor = BTreeExecutor::new();
        let mut context = BTreeContext::new();

        let (cancel_tx, cancel_rx) = watch::channel(false);

        // Create infinite tree
        let mut tree = crate::nodes::decorator::Repeat::infinite(
            "infinite",
            Box::new(SetBlackboard::new("set", "key", "value")),
        );

        // Spawn execution
        let handle = tokio::spawn(async move {
            executor
                .execute_with_cancel(&mut tree, &mut context, cancel_rx)
                .await
        });

        // Wait a bit, then cancel
        tokio::time::sleep(Duration::from_millis(10)).await;
        cancel_tx.send(true).unwrap();

        let result = handle.await.unwrap().unwrap();

        assert!(result.cancelled);
        assert!(result.is_interrupted());
    }

    #[tokio::test]
    async fn test_executor_with_tracing() {
        let executor = BTreeExecutor::new().with_tracing(true);
        let mut context = BTreeContext::new();

        let mut tree =
            Sequence::new("test").add_child(Box::new(SetBlackboard::new("set", "key", "value")));

        let result = executor.execute(&mut tree, &mut context).await.unwrap();

        assert!(result.is_success());
    }

    #[tokio::test]
    async fn test_executor_manual_tick() {
        let executor = BTreeExecutor::new();
        let mut context = BTreeContext::new();

        let mut tree = SetBlackboard::new("set", "key", "value");

        let status = executor.tick(&mut tree, &mut context).await.unwrap();

        assert_eq!(status, NodeStatus::Success);
        assert_eq!(context.tick_count, 1);
    }
}
