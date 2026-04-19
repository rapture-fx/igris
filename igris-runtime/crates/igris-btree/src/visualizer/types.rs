//! Visualization types and data structures

use crate::core::NodeStatus;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unique identifier for a node in the tree
pub type NodeId = String;

/// Complete tree state snapshot for visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeSnapshot {
    /// Timestamp when snapshot was taken
    pub timestamp_ms: u64,

    /// Current tick count
    pub tick_count: u64,

    /// Root node of the tree
    pub root: NodeSnapshot,

    /// Filtered blackboard state (keys relevant to visualization)
    pub blackboard: HashMap<String, serde_json::Value>,

    /// Recent execution trace (last N ticks)
    pub execution_trace: Vec<ExecutionTraceEntry>,

    /// Recent replan events
    pub replan_events: Vec<ReplanEvent>,

    /// Current metrics summary
    pub metrics: MetricsSummary,
}

/// Snapshot of a single node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeSnapshot {
    /// Unique ID for this node (path-based)
    pub id: NodeId,

    /// Node name
    pub name: String,

    /// Node type (Sequence, Selector, Action, etc.)
    pub node_type: String,

    /// Current status
    pub status: NodeStatus,

    /// Children (if composite node)
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<NodeSnapshot>,

    /// Node-specific metadata (parameters, configuration)
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub metadata: HashMap<String, serde_json::Value>,

    /// Execution stats for this node
    pub stats: NodeStats,
}

/// Statistics for a node's execution
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NodeStats {
    /// Total number of times this node was ticked
    pub tick_count: u64,

    /// Number of successes
    pub success_count: u64,

    /// Number of failures
    pub failure_count: u64,

    /// Average execution time in milliseconds
    pub avg_execution_ms: f64,

    /// Last execution time
    pub last_execution_ms: f64,
}

/// Entry in execution trace showing what happened during a tick
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTraceEntry {
    /// Tick number
    pub tick: u64,

    /// Timestamp
    pub timestamp_ms: u64,

    /// Node ID that was executed
    pub node_id: NodeId,

    /// Node name for readability
    pub node_name: String,

    /// Status returned
    pub status: NodeStatus,

    /// Execution duration in milliseconds
    pub duration_ms: f64,
}

/// Replan event showing LLM-triggered plan changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplanEvent {
    /// When the replan occurred
    pub timestamp_ms: u64,

    /// Tick when replan was triggered
    pub tick: u64,

    /// Node that triggered the replan
    pub trigger_node_id: NodeId,

    /// Reason for replan
    pub reason: String,

    /// Replan attempt number
    pub attempt: u32,

    /// Before subtree (JSON representation)
    pub before_subtree: Option<serde_json::Value>,

    /// After subtree (JSON representation)
    pub after_subtree: Option<serde_json::Value>,
}

/// Summary of current metrics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetricsSummary {
    /// Total number of replans
    pub total_replans: u64,

    /// Average ticks per second
    pub avg_tick_rate: f64,

    /// Average LLM call latency in milliseconds
    pub avg_llm_latency_ms: f64,

    /// Total watchdog triggers
    pub watchdog_triggers: u64,

    /// Total ticks executed
    pub total_ticks: u64,

    /// Overall failure rate (0.0 - 1.0)
    pub failure_rate: f64,

    /// Total execution time in milliseconds
    pub total_execution_ms: f64,
}

/// Lightweight diff between two snapshots
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeDiff {
    /// Nodes that changed status
    pub status_changes: Vec<StatusChange>,

    /// Nodes that were added
    pub added_nodes: Vec<NodeId>,

    /// Nodes that were removed
    pub removed_nodes: Vec<NodeId>,

    /// Blackboard changes
    pub blackboard_changes: HashMap<String, BlackboardChange>,
}

/// Change in node status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusChange {
    pub node_id: NodeId,
    pub old_status: NodeStatus,
    pub new_status: NodeStatus,
}

/// Change in blackboard value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlackboardChange {
    Added(serde_json::Value),
    Modified {
        old: serde_json::Value,
        new: serde_json::Value,
    },
    Removed(serde_json::Value),
}

/// Configuration for visualization
#[derive(Debug, Clone)]
pub struct VisualizerConfig {
    /// Enable visualization
    pub enabled: bool,

    /// Maximum trace entries to keep
    pub max_trace_entries: usize,

    /// Maximum replan events to keep
    pub max_replan_events: usize,

    /// Blackboard keys to include (None = all)
    pub blackboard_filter: Option<Vec<String>>,

    /// Export frequency (every N ticks, 0 = every tick)
    pub export_frequency: u64,

    /// Whether to compute diffs
    pub compute_diffs: bool,
}

impl Default for VisualizerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_trace_entries: 100,
            max_replan_events: 10,
            blackboard_filter: None,
            export_frequency: 0, // Every tick
            compute_diffs: true,
        }
    }
}
