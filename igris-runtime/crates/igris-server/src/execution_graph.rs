//! RUNTIME-04: Execution Graph Observability
//!
//! Captures execution DAG (Directed Acyclic Graph) per request to enable:
//! - Debugging complex multi-step executions
//! - Performance analysis of tool call chains
//! - Observability into agent reasoning flow
#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;
use uuid::Uuid;

/// ExecutionGraph represents a complete execution trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionGraph {
    /// Unique identifier for this execution
    pub execution_id: String,

    /// User prompt that initiated this execution
    pub user_prompt: String,

    /// Start time of execution
    pub start_time: SystemTime,

    /// End time of execution (None if still running)
    pub end_time: Option<SystemTime>,

    /// Total execution duration in milliseconds
    pub total_duration_ms: Option<u64>,

    /// All nodes in the execution graph
    pub nodes: Vec<ExecutionNode>,

    /// Execution metadata
    pub metadata: HashMap<String, String>,

    /// Final outcome
    pub final_answer: Option<String>,

    /// Error if execution failed
    pub error: Option<String>,

    /// Number of steps taken
    pub step_count: u32,

    /// Maximum steps allowed
    pub max_steps: u32,
}

/// ExecutionNode represents a single tool call in the execution graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionNode {
    /// Unique node identifier
    pub node_id: String,

    /// Step number (1-indexed)
    pub step: u32,

    /// Tool name
    pub tool_name: String,

    /// Tool input arguments (JSON)
    pub arguments: serde_json::Value,

    /// Tool execution result
    pub result: Option<ToolExecutionResult>,

    /// Start time of this node
    pub start_time: SystemTime,

    /// End time of this node (None if still running)
    pub end_time: Option<SystemTime>,

    /// Duration in milliseconds
    pub duration_ms: Option<u64>,

    /// Parent node IDs (for dependency tracking)
    pub parent_nodes: Vec<String>,

    /// Child node IDs (nodes that depend on this one)
    pub child_nodes: Vec<String>,

    /// Node-level metadata
    pub metadata: HashMap<String, String>,
}

/// ToolExecutionResult captures the outcome of a tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    /// Whether execution succeeded
    pub success: bool,

    /// Output from the tool
    pub output: String,

    /// Error message if failed
    pub error: Option<String>,

    /// Execution time in milliseconds
    pub execution_time_ms: u64,

    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl ExecutionGraph {
    /// Create a new execution graph
    pub fn new(user_prompt: String, max_steps: u32) -> Self {
        Self {
            execution_id: Uuid::new_v4().to_string(),
            user_prompt,
            start_time: SystemTime::now(),
            end_time: None,
            total_duration_ms: None,
            nodes: Vec::new(),
            metadata: HashMap::new(),
            final_answer: None,
            error: None,
            step_count: 0,
            max_steps,
        }
    }

    /// Add a new node to the graph
    pub fn add_node(&mut self, node: ExecutionNode) {
        self.nodes.push(node);
        self.step_count = self.nodes.len() as u32;
    }

    /// Complete the execution
    pub fn complete(&mut self, final_answer: Option<String>, error: Option<String>) {
        self.end_time = Some(SystemTime::now());
        self.total_duration_ms = self
            .end_time
            .and_then(|end| end.duration_since(self.start_time).ok())
            .map(|d| d.as_millis() as u64);
        self.final_answer = final_answer;
        self.error = error;
    }

    /// Add metadata
    pub fn add_metadata(&mut self, key: String, value: String) {
        self.metadata.insert(key, value);
    }

    /// Get node by ID
    pub fn get_node(&self, node_id: &str) -> Option<&ExecutionNode> {
        self.nodes.iter().find(|n| n.node_id == node_id)
    }

    /// Get node by step number
    pub fn get_node_by_step(&self, step: u32) -> Option<&ExecutionNode> {
        self.nodes.iter().find(|n| n.step == step)
    }

    /// Get all tool names used in this execution
    pub fn get_tool_names(&self) -> Vec<String> {
        self.nodes.iter().map(|n| n.tool_name.clone()).collect()
    }

    /// Get total tool execution time (sum of all node durations)
    pub fn get_total_tool_time_ms(&self) -> u64 {
        self.nodes.iter().filter_map(|n| n.duration_ms).sum()
    }

    /// Get success rate (successful nodes / total nodes)
    pub fn get_success_rate(&self) -> f64 {
        if self.nodes.is_empty() {
            return 0.0;
        }

        let successful = self
            .nodes
            .iter()
            .filter(|n| n.result.as_ref().map_or(false, |r| r.success))
            .count();

        successful as f64 / self.nodes.len() as f64
    }

    /// Serialize to JSON
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Serialize to pretty JSON
    pub fn to_json_pretty(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Deserialize from JSON
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

impl ExecutionNode {
    /// Create a new execution node
    pub fn new(step: u32, tool_name: String, arguments: serde_json::Value) -> Self {
        Self {
            node_id: Uuid::new_v4().to_string(),
            step,
            tool_name,
            arguments,
            result: None,
            start_time: SystemTime::now(),
            end_time: None,
            duration_ms: None,
            parent_nodes: Vec::new(),
            child_nodes: Vec::new(),
            metadata: HashMap::new(),
        }
    }

    /// Complete the node with a result
    pub fn complete(&mut self, result: ToolExecutionResult) {
        self.end_time = Some(SystemTime::now());
        self.duration_ms = self
            .end_time
            .and_then(|end| end.duration_since(self.start_time).ok())
            .map(|d| d.as_millis() as u64);
        self.result = Some(result);
    }

    /// Add a parent node reference
    pub fn add_parent(&mut self, parent_id: String) {
        if !self.parent_nodes.contains(&parent_id) {
            self.parent_nodes.push(parent_id);
        }
    }

    /// Add a child node reference
    pub fn add_child(&mut self, child_id: String) {
        if !self.child_nodes.contains(&child_id) {
            self.child_nodes.push(child_id);
        }
    }

    /// Add metadata
    pub fn add_metadata(&mut self, key: String, value: String) {
        self.metadata.insert(key, value);
    }
}

impl From<igris_tools::ToolResult> for ToolExecutionResult {
    fn from(tool_result: igris_tools::ToolResult) -> Self {
        Self {
            success: tool_result.success,
            output: tool_result.output,
            error: tool_result.error,
            execution_time_ms: tool_result.execution_time_ms,
            metadata: tool_result.metadata,
        }
    }
}

/// ExecutionGraphRegistry manages execution graphs
pub struct ExecutionGraphRegistry {
    graphs: Arc<RwLock<HashMap<String, ExecutionGraph>>>,
    max_graphs: usize,
}

impl ExecutionGraphRegistry {
    /// Create a new registry
    pub fn new(max_graphs: usize) -> Self {
        Self {
            graphs: Arc::new(RwLock::new(HashMap::new())),
            max_graphs,
        }
    }

    /// Register a new execution graph
    pub async fn register(&self, graph: ExecutionGraph) -> String {
        let execution_id = graph.execution_id.clone();
        let mut graphs = self.graphs.write().await;

        // Evict oldest if at capacity
        if graphs.len() >= self.max_graphs {
            self.evict_oldest(&mut graphs);
        }

        graphs.insert(execution_id.clone(), graph);
        execution_id
    }

    /// Get an execution graph by ID
    pub async fn get(&self, execution_id: &str) -> Option<ExecutionGraph> {
        let graphs = self.graphs.read().await;
        graphs.get(execution_id).cloned()
    }

    /// Update an existing execution graph
    pub async fn update(&self, graph: ExecutionGraph) {
        let mut graphs = self.graphs.write().await;
        graphs.insert(graph.execution_id.clone(), graph);
    }

    /// Get all execution IDs
    pub async fn list_execution_ids(&self) -> Vec<String> {
        let graphs = self.graphs.read().await;
        graphs.keys().cloned().collect()
    }

    /// Get recent execution graphs (up to limit)
    pub async fn get_recent(&self, limit: usize) -> Vec<ExecutionGraph> {
        let graphs = self.graphs.read().await;
        let mut graph_list: Vec<_> = graphs.values().cloned().collect();

        // Sort by start time (most recent first)
        graph_list.sort_by(|a, b| b.start_time.cmp(&a.start_time));

        graph_list.into_iter().take(limit).collect()
    }

    /// Clear all execution graphs
    pub async fn clear(&self) {
        let mut graphs = self.graphs.write().await;
        graphs.clear();
    }

    /// Get statistics
    pub async fn get_stats(&self) -> ExecutionStats {
        let graphs = self.graphs.read().await;

        let total_count = graphs.len();
        let completed_count = graphs.values().filter(|g| g.end_time.is_some()).count();
        let running_count = total_count - completed_count;

        let avg_duration_ms = if completed_count > 0 {
            let total_duration: u64 = graphs.values().filter_map(|g| g.total_duration_ms).sum();
            Some(total_duration / completed_count as u64)
        } else {
            None
        };

        let total_nodes: usize = graphs.values().map(|g| g.nodes.len()).sum();
        let avg_nodes_per_execution = if total_count > 0 {
            Some(total_nodes as f64 / total_count as f64)
        } else {
            None
        };

        ExecutionStats {
            total_executions: total_count,
            completed_executions: completed_count,
            running_executions: running_count,
            avg_duration_ms,
            total_nodes,
            avg_nodes_per_execution,
        }
    }

    fn evict_oldest(&self, graphs: &mut HashMap<String, ExecutionGraph>) {
        if let Some((oldest_id, _)) = graphs.iter().min_by_key(|(_, g)| g.start_time) {
            let oldest_id = oldest_id.clone();
            graphs.remove(&oldest_id);
        }
    }
}

/// Statistics about execution graphs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionStats {
    pub total_executions: usize,
    pub completed_executions: usize,
    pub running_executions: usize,
    pub avg_duration_ms: Option<u64>,
    pub total_nodes: usize,
    pub avg_nodes_per_execution: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_execution_graph_creation() {
        let graph = ExecutionGraph::new("test prompt".to_string(), 10);
        assert_eq!(graph.user_prompt, "test prompt");
        assert_eq!(graph.max_steps, 10);
        assert_eq!(graph.step_count, 0);
        assert!(graph.nodes.is_empty());
    }

    #[test]
    fn test_execution_node_lifecycle() {
        let mut node = ExecutionNode::new(
            1,
            "http_get".to_string(),
            serde_json::json!({"url": "https://example.com"}),
        );

        assert_eq!(node.step, 1);
        assert_eq!(node.tool_name, "http_get");
        assert!(node.result.is_none());

        let result = ToolExecutionResult {
            success: true,
            output: "response body".to_string(),
            error: None,
            execution_time_ms: 150,
            metadata: HashMap::new(),
        };

        node.complete(result);
        assert!(node.result.is_some());
        assert!(node.duration_ms.is_some());
    }

    #[test]
    fn test_graph_completion() {
        let mut graph = ExecutionGraph::new("test".to_string(), 10);
        graph.complete(Some("final answer".to_string()), None);

        assert!(graph.end_time.is_some());
        assert!(graph.total_duration_ms.is_some());
        assert_eq!(graph.final_answer, Some("final answer".to_string()));
        assert!(graph.error.is_none());
    }

    #[test]
    fn test_graph_serialization() {
        let graph = ExecutionGraph::new("test".to_string(), 10);
        let json = graph.to_json().unwrap();
        let deserialized = ExecutionGraph::from_json(&json).unwrap();

        assert_eq!(graph.execution_id, deserialized.execution_id);
        assert_eq!(graph.user_prompt, deserialized.user_prompt);
    }

    #[tokio::test]
    async fn test_registry_operations() {
        let registry = ExecutionGraphRegistry::new(10);

        let graph1 = ExecutionGraph::new("prompt1".to_string(), 10);
        let id1 = registry.register(graph1.clone()).await;

        let retrieved = registry.get(&id1).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().execution_id, id1);

        let ids = registry.list_execution_ids().await;
        assert_eq!(ids.len(), 1);
        assert!(ids.contains(&id1));
    }

    #[tokio::test]
    async fn test_registry_eviction() {
        let registry = ExecutionGraphRegistry::new(2);

        let graph1 = ExecutionGraph::new("prompt1".to_string(), 10);
        let id1 = registry.register(graph1).await;

        let graph2 = ExecutionGraph::new("prompt2".to_string(), 10);
        let id2 = registry.register(graph2).await;

        let graph3 = ExecutionGraph::new("prompt3".to_string(), 10);
        let _id3 = registry.register(graph3).await;

        // graph1 should be evicted
        let ids = registry.list_execution_ids().await;
        assert_eq!(ids.len(), 2);
        assert!(!ids.contains(&id1));
        assert!(ids.contains(&id2));
    }

    #[tokio::test]
    async fn test_registry_stats() {
        let registry = ExecutionGraphRegistry::new(10);

        let mut graph1 = ExecutionGraph::new("prompt1".to_string(), 10);
        graph1.complete(Some("answer".to_string()), None);
        registry.register(graph1).await;

        let graph2 = ExecutionGraph::new("prompt2".to_string(), 10);
        registry.register(graph2).await;

        let stats = registry.get_stats().await;
        assert_eq!(stats.total_executions, 2);
        assert_eq!(stats.completed_executions, 1);
        assert_eq!(stats.running_executions, 1);
    }
}
