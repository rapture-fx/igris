//! Tree state exporter for visualization

use super::types::*;
use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

/// Tree visualizer that exports state for dashboard
pub struct TreeVisualizer {
    config: VisualizerConfig,

    /// Execution trace history
    trace: Arc<RwLock<Vec<ExecutionTraceEntry>>>,

    /// Replan events history
    replan_events: Arc<RwLock<Vec<ReplanEvent>>>,

    /// Previous snapshot for diff computation
    previous_snapshot: Arc<RwLock<Option<TreeSnapshot>>>,

    /// Node statistics tracking
    node_stats: Arc<RwLock<HashMap<NodeId, NodeStats>>>,

    /// Global metrics
    metrics: Arc<RwLock<MetricsSummary>>,
}

impl TreeVisualizer {
    /// Create a new visualizer with default config
    pub fn new() -> Self {
        Self::with_config(VisualizerConfig::default())
    }

    /// Create a new visualizer with custom config
    pub fn with_config(config: VisualizerConfig) -> Self {
        Self {
            config,
            trace: Arc::new(RwLock::new(Vec::new())),
            replan_events: Arc::new(RwLock::new(Vec::new())),
            previous_snapshot: Arc::new(RwLock::new(None)),
            node_stats: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(MetricsSummary::default())),
        }
    }

    /// Export current tree state as a snapshot
    pub async fn export_snapshot(
        &self,
        tree: &dyn BTreeNode,
        context: &BTreeContext,
        tick_count: u64,
    ) -> Result<TreeSnapshot> {
        if !self.config.enabled {
            return Ok(self.create_empty_snapshot(tick_count));
        }

        let timestamp_ms = self.current_timestamp_ms();

        // Traverse tree and build snapshot
        let root = self.traverse_node(tree, context, "root".to_string()).await;

        // Get filtered blackboard state
        let blackboard = self.filter_blackboard(context).await;

        // Get execution trace
        let trace = self.trace.read().await;
        let execution_trace = trace
            .iter()
            .rev()
            .take(self.config.max_trace_entries)
            .rev()
            .cloned()
            .collect();

        // Get replan events
        let replans = self.replan_events.read().await;
        let replan_events = replans
            .iter()
            .rev()
            .take(self.config.max_replan_events)
            .rev()
            .cloned()
            .collect();

        // Get metrics
        let metrics = self.metrics.read().await.clone();

        let snapshot = TreeSnapshot {
            timestamp_ms,
            tick_count,
            root,
            blackboard,
            execution_trace,
            replan_events,
            metrics,
        };

        // Store for diff computation
        *self.previous_snapshot.write().await = Some(snapshot.clone());

        Ok(snapshot)
    }

    /// Compute diff between current and previous snapshot
    pub async fn compute_diff(&self, current: &TreeSnapshot) -> Option<TreeDiff> {
        if !self.config.compute_diffs {
            return None;
        }

        let previous = self.previous_snapshot.read().await;
        let previous = previous.as_ref()?;

        Some(self.diff_snapshots(previous, current))
    }

    /// Record a node execution in the trace
    pub async fn record_execution(
        &self,
        node_id: NodeId,
        node_name: String,
        status: NodeStatus,
        duration: Duration,
        tick: u64,
    ) {
        let entry = ExecutionTraceEntry {
            tick,
            timestamp_ms: self.current_timestamp_ms(),
            node_id: node_id.clone(),
            node_name,
            status,
            duration_ms: duration.as_secs_f64() * 1000.0,
        };

        let max_entries = self.config.max_trace_entries;
        let mut trace = self.trace.write().await;
        trace.push(entry);

        // Keep only recent entries
        let len = trace.len();
        if len > max_entries {
            trace.drain(0..(len - max_entries));
        }

        // Update node stats
        self.update_node_stats(node_id, status, duration).await;
    }

    /// Record a replan event
    pub async fn record_replan(
        &self,
        trigger_node_id: NodeId,
        reason: String,
        attempt: u32,
        before_subtree: Option<serde_json::Value>,
        after_subtree: Option<serde_json::Value>,
        tick: u64,
    ) {
        let event = ReplanEvent {
            timestamp_ms: self.current_timestamp_ms(),
            tick,
            trigger_node_id,
            reason,
            attempt,
            before_subtree,
            after_subtree,
        };

        let max_events = self.config.max_replan_events;
        let mut replans = self.replan_events.write().await;
        replans.push(event);

        // Keep only recent events
        let len = replans.len();
        if len > max_events {
            replans.drain(0..(len - max_events));
        }

        // Update metrics
        let mut metrics = self.metrics.write().await;
        metrics.total_replans += 1;
    }

    /// Update global metrics
    pub async fn update_metrics(
        &self,
        tick_duration: Duration,
        llm_latency: Option<Duration>,
        watchdog_triggered: bool,
    ) {
        let mut metrics = self.metrics.write().await;

        metrics.total_ticks += 1;
        metrics.total_execution_ms += tick_duration.as_secs_f64() * 1000.0;

        // Compute average tick rate
        if metrics.total_execution_ms > 0.0 {
            metrics.avg_tick_rate =
                (metrics.total_ticks as f64) / (metrics.total_execution_ms / 1000.0);
        }

        // Update LLM latency
        if let Some(latency) = llm_latency {
            let latency_ms = latency.as_secs_f64() * 1000.0;
            // Simple exponential moving average
            if metrics.avg_llm_latency_ms == 0.0 {
                metrics.avg_llm_latency_ms = latency_ms;
            } else {
                metrics.avg_llm_latency_ms = 0.9 * metrics.avg_llm_latency_ms + 0.1 * latency_ms;
            }
        }

        if watchdog_triggered {
            metrics.watchdog_triggers += 1;
        }
    }

    // Private helper methods

    async fn traverse_node(
        &self,
        node: &dyn BTreeNode,
        context: &BTreeContext,
        node_id: NodeId,
    ) -> NodeSnapshot {
        let name = node.name().to_string();
        let node_type = node.node_type().to_string();

        // Get node status (would need to be tracked separately in real impl)
        let status = NodeStatus::Running; // Placeholder

        // Get node-specific metadata from JSON representation
        let metadata = node
            .to_json()
            .ok()
            .and_then(|v| v.as_object().cloned())
            .map(|obj| {
                obj.into_iter()
                    .filter(|(k, _)| k != "children" && k != "child")
                    .collect()
            })
            .unwrap_or_default();

        // Get stats for this node
        let stats = self
            .node_stats
            .read()
            .await
            .get(&node_id)
            .cloned()
            .unwrap_or_default();

        // Try to get children from JSON
        let children = if let Ok(json) = node.to_json() {
            self.extract_children(&json, context, &node_id).await
        } else {
            Vec::new()
        };

        NodeSnapshot {
            id: node_id,
            name,
            node_type,
            status,
            children,
            metadata,
            stats,
        }
    }

    async fn extract_children(
        &self,
        json: &serde_json::Value,
        _context: &BTreeContext,
        parent_id: &str,
    ) -> Vec<NodeSnapshot> {
        let mut children = Vec::new();

        // Check for children array (composites)
        if let Some(children_array) = json.get("children").and_then(|v| v.as_array()) {
            for (i, child_json) in children_array.iter().enumerate() {
                if child_json.get("name").is_some() {
                    let child_id = format!("{}/{}", parent_id, i);
                    // Would need actual node reference to fully traverse
                    // For now, create placeholder from JSON
                    children.push(self.node_snapshot_from_json(child_json, child_id).await);
                }
            }
        }

        // Check for single child (decorators)
        if let Some(child_json) = json.get("child") {
            let child_id = format!("{}/0", parent_id);
            children.push(self.node_snapshot_from_json(child_json, child_id).await);
        }

        children
    }

    async fn node_snapshot_from_json(
        &self,
        json: &serde_json::Value,
        node_id: NodeId,
    ) -> NodeSnapshot {
        let name = json
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let node_type = json
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let stats = self
            .node_stats
            .read()
            .await
            .get(&node_id)
            .cloned()
            .unwrap_or_default();

        NodeSnapshot {
            id: node_id,
            name,
            node_type,
            status: NodeStatus::Running, // Placeholder
            children: Vec::new(),        // Would recurse in full implementation
            metadata: HashMap::new(),
            stats,
        }
    }

    async fn filter_blackboard(
        &self,
        context: &BTreeContext,
    ) -> HashMap<String, serde_json::Value> {
        let keys = context.blackboard.keys().await;
        let mut result = HashMap::new();

        for key in keys {
            // Apply filter if configured
            if let Some(ref filter) = self.config.blackboard_filter {
                if !filter.contains(&key) {
                    continue;
                }
            }

            if let Some(value) = context.blackboard.get(&key).await {
                result.insert(key, value);
            }
        }

        result
    }

    async fn update_node_stats(&self, node_id: NodeId, status: NodeStatus, duration: Duration) {
        let mut stats_map = self.node_stats.write().await;
        let stats = stats_map.entry(node_id).or_insert_with(NodeStats::default);

        stats.tick_count += 1;

        match status {
            NodeStatus::Success => stats.success_count += 1,
            NodeStatus::Failure => stats.failure_count += 1,
            _ => {}
        }

        let duration_ms = duration.as_secs_f64() * 1000.0;
        stats.last_execution_ms = duration_ms;

        // Update average (simple moving average)
        if stats.tick_count == 1 {
            stats.avg_execution_ms = duration_ms;
        } else {
            stats.avg_execution_ms = (stats.avg_execution_ms * (stats.tick_count - 1) as f64
                + duration_ms)
                / stats.tick_count as f64;
        }

        // Update failure rate in metrics
        let total_terminal = stats.success_count + stats.failure_count;
        if total_terminal > 0 {
            let mut metrics = self.metrics.write().await;
            metrics.failure_rate = stats.failure_count as f64 / total_terminal as f64;
        }
    }

    fn diff_snapshots(&self, old: &TreeSnapshot, new: &TreeSnapshot) -> TreeDiff {
        let mut status_changes = Vec::new();
        let mut added_nodes = Vec::new();
        let mut removed_nodes = Vec::new();

        // Collect all node IDs
        let mut old_nodes = HashMap::new();
        self.collect_node_ids(&old.root, &mut old_nodes);

        let mut new_nodes = HashMap::new();
        self.collect_node_ids(&new.root, &mut new_nodes);

        // Find status changes
        for (id, new_node) in &new_nodes {
            if let Some(old_node) = old_nodes.get(id) {
                if old_node.status != new_node.status {
                    status_changes.push(StatusChange {
                        node_id: id.clone(),
                        old_status: old_node.status,
                        new_status: new_node.status,
                    });
                }
            } else {
                added_nodes.push(id.clone());
            }
        }

        // Find removed nodes
        for id in old_nodes.keys() {
            if !new_nodes.contains_key(id) {
                removed_nodes.push(id.clone());
            }
        }

        // Blackboard changes
        let blackboard_changes = self.diff_blackboard(&old.blackboard, &new.blackboard);

        TreeDiff {
            status_changes,
            added_nodes,
            removed_nodes,
            blackboard_changes,
        }
    }

    fn collect_node_ids(&self, node: &NodeSnapshot, map: &mut HashMap<NodeId, NodeSnapshot>) {
        map.insert(node.id.clone(), node.clone());
        for child in &node.children {
            self.collect_node_ids(child, map);
        }
    }

    fn diff_blackboard(
        &self,
        old: &HashMap<String, serde_json::Value>,
        new: &HashMap<String, serde_json::Value>,
    ) -> HashMap<String, BlackboardChange> {
        let mut changes = HashMap::new();

        // Find modified and added
        for (key, new_value) in new {
            if let Some(old_value) = old.get(key) {
                if old_value != new_value {
                    changes.insert(
                        key.clone(),
                        BlackboardChange::Modified {
                            old: old_value.clone(),
                            new: new_value.clone(),
                        },
                    );
                }
            } else {
                changes.insert(key.clone(), BlackboardChange::Added(new_value.clone()));
            }
        }

        // Find removed
        for (key, old_value) in old {
            if !new.contains_key(key) {
                changes.insert(key.clone(), BlackboardChange::Removed(old_value.clone()));
            }
        }

        changes
    }

    fn create_empty_snapshot(&self, tick_count: u64) -> TreeSnapshot {
        TreeSnapshot {
            timestamp_ms: self.current_timestamp_ms(),
            tick_count,
            root: NodeSnapshot {
                id: "root".to_string(),
                name: "disabled".to_string(),
                node_type: "Root".to_string(),
                status: NodeStatus::Running,
                children: Vec::new(),
                metadata: HashMap::new(),
                stats: NodeStats::default(),
            },
            blackboard: HashMap::new(),
            execution_trace: Vec::new(),
            replan_events: Vec::new(),
            metrics: MetricsSummary::default(),
        }
    }

    fn current_timestamp_ms(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}

impl Default for TreeVisualizer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nodes::action::SetBlackboard;

    #[tokio::test]
    async fn test_visualizer_basic() {
        let visualizer = TreeVisualizer::new();
        let context = BTreeContext::new();
        let node = SetBlackboard::new("test", "key", "value");

        let snapshot = visualizer
            .export_snapshot(&node, &context, 1)
            .await
            .unwrap();

        assert_eq!(snapshot.tick_count, 1);
        assert_eq!(snapshot.root.name, "test");
    }

    #[tokio::test]
    async fn test_record_execution() {
        let visualizer = TreeVisualizer::new();

        visualizer
            .record_execution(
                "node1".to_string(),
                "TestNode".to_string(),
                NodeStatus::Success,
                Duration::from_millis(10),
                1,
            )
            .await;

        let trace = visualizer.trace.read().await;
        assert_eq!(trace.len(), 1);
        assert_eq!(trace[0].node_name, "TestNode");
    }

    #[tokio::test]
    async fn test_record_replan() {
        let visualizer = TreeVisualizer::new();

        visualizer
            .record_replan(
                "node1".to_string(),
                "Child failed".to_string(),
                1,
                None,
                None,
                5,
            )
            .await;

        let replans = visualizer.replan_events.read().await;
        assert_eq!(replans.len(), 1);
        assert_eq!(replans[0].reason, "Child failed");

        let metrics = visualizer.metrics.read().await;
        assert_eq!(metrics.total_replans, 1);
    }
}
