# HYBRID BEHAVIOR TREE + LLM IMPLEMENTATION PLAN
**Date:** January 31, 2026
**Architecture:** Deterministic BTree Control + LLM Reasoning Nodes
**Estimated Time:** 8-12 hours core implementation + 4-6 hours integration

---

## EXECUTIVE SUMMARY

Implement a production-grade hybrid system combining:
1. **Deterministic Behavior Trees** - Safe, predictable outer control loop
2. **LLM Reasoning Nodes** - Adaptive planning and decision-making
3. **Dynamic Subtree Generation** - LLM-generated plans loaded at runtime
4. **Failure-Triggered Replanning** - Automatic recovery via LLM
5. **Bounded Execution** - Integration with `igris-rt` for deterministic timing

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                   HYBRID BTREE SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Deterministic Control Layer (BTree)                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Root: Mission Executor (Sequence)                 │    │
│  │  ├─ Condition: Mission Available?                  │    │
│  │  ├─ 🤖 LLMPlannerNode: Parse & Plan Mission        │ ◄──┼─ LLM
│  │  │    ↓ Generates dynamic subtree ↓                │    │
│  │  ├─ SubtreeLoader: Load LLM-generated plan         │    │
│  │  │  ├─ Sequence: Step 1                            │    │
│  │  │  │  ├─ Action: Navigate to waypoint             │    │
│  │  │  │  └─ Action: Execute tool                     │    │
│  │  │  ├─ Selector: Step 2 (with fallback)            │    │
│  │  │  │  ├─ Action: Primary approach                 │    │
│  │  │  │  └─ 🤖 LLMReplanNode: Replan on failure      │ ◄──┼─ LLM
│  │  │  └─ Action: Report completion                   │    │
│  │  ├─ Decorator: ReplanOnFailure(max=3)              │    │
│  │  │  └─ (wraps above subtree)                       │    │
│  │  └─ Action: Send telemetry to Overture             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Safe Execution Layer (igris-rt)                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Priority-based scheduling                          │    │
│  │  - Critical nodes: 50ms deadline                    │    │
│  │  - LLM nodes: 5s timeout with fallback             │    │
│  │  - Watchdog monitoring                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION STRUCTURE

### New Crate: `igris-btree`

```
igris-runtime/crates/igris-btree/
├── Cargo.toml
├── src/
│   ├── lib.rs                    # Public API
│   ├── core/
│   │   ├── mod.rs
│   │   ├── node.rs               # Base BTreeNode trait
│   │   ├── status.rs             # NodeStatus enum
│   │   ├── context.rs            # Execution context + blackboard
│   │   └── tick.rs               # Tick execution engine
│   ├── nodes/
│   │   ├── mod.rs
│   │   ├── composite/
│   │   │   ├── sequence.rs       # Sequence node
│   │   │   ├── selector.rs       # Selector node
│   │   │   ├── parallel.rs       # Parallel node
│   │   │   └── reactive_sequence.rs
│   │   ├── decorator/
│   │   │   ├── repeat.rs         # Repeat decorator
│   │   │   ├── inverter.rs       # Inverter
│   │   │   ├── timeout.rs        # Timeout wrapper
│   │   │   ├── retry.rs          # Retry on failure
│   │   │   └── replan_on_failure.rs  # 🤖 LLM replanning
│   │   ├── action/
│   │   │   ├── tool_action.rs    # Execute igris-tools
│   │   │   ├── ros2_action.rs    # ROS2 commands
│   │   │   └── sleep.rs          # Wait action
│   │   ├── condition/
│   │   │   ├── check_blackboard.rs
│   │   │   └── sensor_check.rs
│   │   └── llm/                  # 🤖 LLM-powered nodes
│   │       ├── llm_planner.rs    # Generate dynamic subtrees
│   │       ├── llm_decision.rs   # LLM-based decisions
│   │       ├── llm_replan.rs     # Replanning on failure
│   │       └── subtree_loader.rs # Dynamic tree injection
│   ├── parser/
│   │   ├── mod.rs
│   │   ├── json_parser.rs        # Parse JSON trees
│   │   ├── xml_parser.rs         # BehaviorTree.CPP XML format
│   │   └── llm_tree_parser.rs    # Parse LLM-generated trees
│   ├── runtime/
│   │   ├── mod.rs
│   │   ├── executor.rs           # BTree executor
│   │   ├── bounded_executor.rs   # igris-rt integration
│   │   └── visualizer.rs         # Runtime tree inspection
│   └── safety/
│       ├── mod.rs
│       ├── watchdog.rs           # Execution watchdog
│       └── fallback.rs           # Safety fallback logic
└── examples/
    ├── simple_tree.rs
    ├── llm_planning.rs
    └── hybrid_mission.rs
```

---

## CORE IMPLEMENTATION

### 1. Base Node Types

**File:** `igris-runtime/crates/igris-btree/src/core/status.rs`

```rust
/// Node execution status following BehaviorTree.CPP conventions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeStatus {
    /// Node is currently executing (async operations)
    Running,
    /// Node completed successfully
    Success,
    /// Node failed
    Failure,
    /// Node execution was skipped
    Skipped,
}

impl NodeStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Success | Self::Failure)
    }

    pub fn is_running(&self) -> bool {
        matches!(self, Self::Running)
    }
}
```

**File:** `igris-runtime/crates/igris-btree/src/core/context.rs`

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde_json::Value;

/// Blackboard for sharing state between nodes
#[derive(Debug, Clone)]
pub struct Blackboard {
    data: Arc<RwLock<HashMap<String, Value>>>,
}

impl Blackboard {
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get(&self, key: &str) -> Option<Value> {
        self.data.read().await.get(key).cloned()
    }

    pub async fn set(&self, key: &str, value: Value) {
        self.data.write().await.insert(key.to_string(), value);
    }

    pub async fn remove(&self, key: &str) -> Option<Value> {
        self.data.write().await.remove(key)
    }

    pub async fn contains(&self, key: &str) -> bool {
        self.data.read().await.contains_key(key)
    }
}

/// Execution context passed to all nodes during ticking
pub struct BTreeContext {
    pub blackboard: Blackboard,
    pub tick_count: u64,
    pub runtime_executor: Option<Arc<igris_rt::RtExecutor>>,
    pub llm_provider: Option<Arc<dyn igris_reflection::LLMProvider>>,
    pub tool_registry: Option<Arc<igris_tools::ToolRegistry>>,
}

impl BTreeContext {
    pub fn new() -> Self {
        Self {
            blackboard: Blackboard::new(),
            tick_count: 0,
            runtime_executor: None,
            llm_provider: None,
            tool_registry: None,
        }
    }

    pub fn with_llm(mut self, provider: Arc<dyn igris_reflection::LLMProvider>) -> Self {
        self.llm_provider = Some(provider);
        self
    }

    pub fn with_tools(mut self, registry: Arc<igris_tools::ToolRegistry>) -> Self {
        self.tool_registry = Some(registry);
        self
    }

    pub fn with_rt_executor(mut self, executor: Arc<igris_rt::RtExecutor>) -> Self {
        self.runtime_executor = Some(executor);
        self
    }
}
```

**File:** `igris-runtime/crates/igris-btree/src/core/node.rs`

```rust
use super::{BTreeContext, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Base trait for all Behavior Tree nodes
#[async_trait]
pub trait BTreeNode: Send + Sync {
    /// Node name for debugging and visualization
    fn name(&self) -> &str;

    /// Node type for serialization
    fn node_type(&self) -> &str;

    /// Tick the node (execute one step)
    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus>;

    /// Reset node state (called when parent resets)
    async fn reset(&mut self) {
        // Default: no-op
    }

    /// Halt node execution (called when parent halts)
    async fn halt(&mut self) {
        // Default: no-op
    }

    /// Serialize node to JSON for persistence
    fn to_json(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "name": self.name(),
            "type": self.node_type()
        }))
    }
}

/// Tree node metadata for visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeMetadata {
    pub id: String,
    pub name: String,
    pub node_type: String,
    pub status: Option<String>,
    pub tick_count: u64,
    pub last_result: Option<String>,
}
```

---

### 2. Composite Nodes (Deterministic Control)

**File:** `igris-runtime/crates/igris-btree/src/nodes/composite/sequence.rs`

```rust
use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;

/// Sequence node: Ticks children in order, returns Success if all succeed
/// Returns Failure if any child fails
/// Returns Running if any child is running
pub struct Sequence {
    name: String,
    children: Vec<Box<dyn BTreeNode>>,
    current_child: usize,
}

impl Sequence {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            children: Vec::new(),
            current_child: 0,
        }
    }

    pub fn add_child(mut self, child: Box<dyn BTreeNode>) -> Self {
        self.children.push(child);
        self
    }
}

#[async_trait]
impl BTreeNode for Sequence {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Sequence"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        // Tick children in sequence
        while self.current_child < self.children.len() {
            let child = &mut self.children[self.current_child];
            let status = child.tick(context).await?;

            match status {
                NodeStatus::Success => {
                    // Move to next child
                    self.current_child += 1;
                }
                NodeStatus::Running => {
                    // Child still running, return Running
                    return Ok(NodeStatus::Running);
                }
                NodeStatus::Failure => {
                    // Child failed, reset and return Failure
                    self.reset().await;
                    return Ok(NodeStatus::Failure);
                }
                NodeStatus::Skipped => {
                    // Move to next child
                    self.current_child += 1;
                }
            }
        }

        // All children succeeded
        self.reset().await;
        Ok(NodeStatus::Success)
    }

    async fn reset(&mut self) {
        self.current_child = 0;
        for child in &mut self.children {
            child.reset().await;
        }
    }

    async fn halt(&mut self) {
        for child in &mut self.children {
            child.halt().await;
        }
        self.reset().await;
    }

    fn to_json(&self) -> Result<serde_json::Value> {
        let children_json: Result<Vec<_>> = self.children.iter()
            .map(|c| c.to_json())
            .collect();

        Ok(serde_json::json!({
            "name": self.name,
            "type": "Sequence",
            "children": children_json?
        }))
    }
}
```

**File:** `igris-runtime/crates/igris-btree/src/nodes/composite/selector.rs`

```rust
use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::Result;
use async_trait::async_trait;

/// Selector node (Fallback): Ticks children in order, returns Success on first success
/// Returns Failure if all children fail
/// Returns Running if any child is running
pub struct Selector {
    name: String,
    children: Vec<Box<dyn BTreeNode>>,
    current_child: usize,
}

impl Selector {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            children: Vec::new(),
            current_child: 0,
        }
    }

    pub fn add_child(mut self, child: Box<dyn BTreeNode>) -> Self {
        self.children.push(child);
        self
    }
}

#[async_trait]
impl BTreeNode for Selector {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "Selector"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        // Try children in order until one succeeds
        while self.current_child < self.children.len() {
            let child = &mut self.children[self.current_child];
            let status = child.tick(context).await?;

            match status {
                NodeStatus::Success => {
                    // Child succeeded, reset and return Success
                    self.reset().await;
                    return Ok(NodeStatus::Success);
                }
                NodeStatus::Running => {
                    // Child still running, return Running
                    return Ok(NodeStatus::Running);
                }
                NodeStatus::Failure => {
                    // Child failed, try next child
                    self.current_child += 1;
                }
                NodeStatus::Skipped => {
                    // Move to next child
                    self.current_child += 1;
                }
            }
        }

        // All children failed
        self.reset().await;
        Ok(NodeStatus::Failure)
    }

    async fn reset(&mut self) {
        self.current_child = 0;
        for child in &mut self.children {
            child.reset().await;
        }
    }

    async fn halt(&mut self) {
        for child in &mut self.children {
            child.halt().await;
        }
        self.reset().await;
    }

    fn to_json(&self) -> Result<serde_json::Value> {
        let children_json: Result<Vec<_>> = self.children.iter()
            .map(|c| c.to_json())
            .collect();

        Ok(serde_json::json!({
            "name": self.name,
            "type": "Selector",
            "children": children_json?
        }))
    }
}
```

---

### 3. 🤖 LLM-Powered Nodes (Adaptive Reasoning)

**File:** `igris-runtime/crates/igris-btree/src/nodes/llm/llm_planner.rs`

```rust
use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use crate::parser::llm_tree_parser::LLMTreeParser;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;
use tracing::{debug, info, warn};

/// LLMPlannerNode: Generates dynamic subtree using LLM
///
/// Prompts LLM with:
/// - Task description from blackboard
/// - Available tools/actions
/// - BTree schema (JSON format)
///
/// LLM outputs a subtree plan → Parse and store in blackboard for SubtreeLoader
pub struct LLMPlannerNode {
    name: String,
    task_key: String,           // Blackboard key for task description
    output_key: String,          // Where to store generated plan
    max_retries: u32,
    retry_count: u32,
    bounded_timeout_ms: u64,     // Use igris-rt for bounded execution
}

impl LLMPlannerNode {
    pub fn new(
        name: impl Into<String>,
        task_key: impl Into<String>,
        output_key: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            task_key: task_key.into(),
            output_key: output_key.into(),
            max_retries: 3,
            retry_count: 0,
            bounded_timeout_ms: 5000, // 5 second timeout
        }
    }

    pub fn with_timeout(mut self, timeout_ms: u64) -> Self {
        self.bounded_timeout_ms = timeout_ms;
        self
    }

    async fn generate_plan(&self, context: &BTreeContext, task: &str) -> Result<Value> {
        let provider = context.llm_provider.as_ref()
            .ok_or_else(|| anyhow!("LLM provider not configured in context"))?;

        // Get available tools for prompt
        let available_tools = if let Some(registry) = &context.tool_registry {
            registry.get_definitions()
        } else {
            vec![]
        };

        let tools_json = serde_json::to_string_pretty(&available_tools)?;

        // Construct planning prompt
        let prompt = format!(
            r#"You are a behavior tree planner for an autonomous system.

TASK:
{task}

AVAILABLE ACTIONS/TOOLS:
{tools_json}

BEHAVIOR TREE SCHEMA:
Generate a JSON behavior tree using these node types:
- Sequence: Execute children in order (all must succeed)
- Selector: Try children until one succeeds (fallback)
- Action: Execute a tool/action
- Condition: Check a condition

Example format:
{{
  "type": "Sequence",
  "name": "Plan for <task>",
  "children": [
    {{
      "type": "Action",
      "name": "Navigate to waypoint",
      "tool": "navigate",
      "args": {{"x": 10, "y": 20}}
    }},
    {{
      "type": "Selector",
      "name": "Try approaches",
      "children": [
        {{
          "type": "Action",
          "name": "Primary approach",
          "tool": "primary_tool",
          "args": {{}}
        }},
        {{
          "type": "Action",
          "name": "Fallback approach",
          "tool": "fallback_tool",
          "args": {{}}
        }}
      ]
    }}
  ]
}}

Generate a valid JSON behavior tree for the task. Respond ONLY with JSON."#,
            task = task,
            tools_json = tools_json
        );

        info!("🤖 LLMPlanner: Generating plan for task: {}", task);
        debug!("Prompt length: {} chars", prompt.len());

        // Execute with bounded timeout using igris-rt if available
        let plan_json = if let Some(rt_executor) = &context.runtime_executor {
            use igris_rt::{Priority, RtTask};
            use std::time::Duration;

            let task = RtTask::new(
                "llm_planning",
                Priority::High,
                Box::pin(async move {
                    provider.generate(&prompt).await
                }),
            );

            let result = rt_executor
                .execute_with_timeout(task, Duration::from_millis(self.bounded_timeout_ms))
                .await?;

            if !result.deadline_met {
                warn!("LLM planning exceeded deadline: {:?}", result.latency);
            }

            result.value?
        } else {
            // Fallback: direct execution without RT guarantees
            warn!("igris-rt executor not available, using unbounded LLM call");
            provider.generate(&prompt).await?
        };

        // Parse JSON from LLM response
        let parsed = LLMTreeParser::extract_json(&plan_json)?;
        info!("✅ LLMPlanner: Plan generated successfully");
        debug!("Generated plan: {}", serde_json::to_string_pretty(&parsed)?);

        Ok(parsed)
    }
}

#[async_trait]
impl BTreeNode for LLMPlannerNode {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "LLMPlanner"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        // Get task from blackboard
        let task = context.blackboard.get(&self.task_key).await
            .ok_or_else(|| anyhow!("Task not found in blackboard: {}", self.task_key))?;

        let task_str = task.as_str()
            .ok_or_else(|| anyhow!("Task must be a string"))?;

        // Generate plan with retry logic
        loop {
            match self.generate_plan(context, task_str).await {
                Ok(plan) => {
                    // Store plan in blackboard
                    context.blackboard.set(&self.output_key, plan).await;
                    info!("🤖 LLMPlanner: Plan stored in blackboard key '{}'", self.output_key);
                    return Ok(NodeStatus::Success);
                }
                Err(e) => {
                    self.retry_count += 1;
                    if self.retry_count >= self.max_retries {
                        warn!("❌ LLMPlanner: Failed after {} retries: {}", self.max_retries, e);
                        return Ok(NodeStatus::Failure);
                    }
                    warn!("⚠️ LLMPlanner: Retry {}/{}: {}", self.retry_count, self.max_retries, e);
                }
            }
        }
    }

    async fn reset(&mut self) {
        self.retry_count = 0;
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "LLMPlanner",
            "task_key": self.task_key,
            "output_key": self.output_key,
            "max_retries": self.max_retries,
            "timeout_ms": self.bounded_timeout_ms
        }))
    }
}
```

**File:** `igris-runtime/crates/igris-btree/src/nodes/llm/subtree_loader.rs`

```rust
use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use crate::parser::llm_tree_parser::LLMTreeParser;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;
use tracing::{debug, info};

/// SubtreeLoader: Load and execute dynamically generated subtree from blackboard
pub struct SubtreeLoader {
    name: String,
    plan_key: String,           // Blackboard key where LLMPlanner stored the plan
    loaded_subtree: Option<Box<dyn BTreeNode>>,
    parser: LLMTreeParser,
}

impl SubtreeLoader {
    pub fn new(name: impl Into<String>, plan_key: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            plan_key: plan_key.into(),
            loaded_subtree: None,
            parser: LLMTreeParser::new(),
        }
    }

    async fn load_subtree(&mut self, context: &BTreeContext) -> Result<()> {
        // Get plan from blackboard
        let plan = context.blackboard.get(&self.plan_key).await
            .ok_or_else(|| anyhow!("Plan not found in blackboard: {}", self.plan_key))?;

        info!("📥 SubtreeLoader: Loading plan from blackboard");
        debug!("Plan JSON: {}", serde_json::to_string_pretty(&plan)?);

        // Parse JSON into BTree nodes
        let subtree = self.parser.parse_node(&plan, context)?;
        self.loaded_subtree = Some(subtree);

        info!("✅ SubtreeLoader: Subtree loaded successfully");
        Ok(())
    }
}

#[async_trait]
impl BTreeNode for SubtreeLoader {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "SubtreeLoader"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        // Load subtree on first tick
        if self.loaded_subtree.is_none() {
            if let Err(e) = self.load_subtree(context).await {
                warn!("❌ SubtreeLoader: Failed to load subtree: {}", e);
                return Ok(NodeStatus::Failure);
            }
        }

        // Execute loaded subtree
        if let Some(subtree) = &mut self.loaded_subtree {
            subtree.tick(context).await
        } else {
            Ok(NodeStatus::Failure)
        }
    }

    async fn reset(&mut self) {
        if let Some(subtree) = &mut self.loaded_subtree {
            subtree.reset().await;
        }
    }

    async fn halt(&mut self) {
        if let Some(subtree) = &mut self.loaded_subtree {
            subtree.halt().await;
        }
        self.loaded_subtree = None;
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "SubtreeLoader",
            "plan_key": self.plan_key,
            "loaded": self.loaded_subtree.is_some()
        }))
    }
}
```

**File:** `igris-runtime/crates/igris-btree/src/nodes/decorator/replan_on_failure.rs`

```rust
use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use crate::nodes::llm::LLMPlannerNode;
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tracing::{info, warn};

/// ReplanOnFailure: Decorator that triggers LLM replanning when child fails
///
/// Workflow:
/// 1. Tick child
/// 2. If Success → return Success
/// 3. If Failure → trigger LLM replan (up to max_replans)
/// 4. Load new plan and retry
pub struct ReplanOnFailure {
    name: String,
    child: Box<dyn BTreeNode>,
    planner: LLMPlannerNode,
    max_replans: u32,
    replan_count: u32,
    task_description_key: String,
}

impl ReplanOnFailure {
    pub fn new(
        name: impl Into<String>,
        child: Box<dyn BTreeNode>,
        task_description_key: impl Into<String>,
    ) -> Self {
        let task_key = task_description_key.into();
        Self {
            name: name.into(),
            planner: LLMPlannerNode::new(
                "replan_llm",
                task_key.clone(),
                "replanned_subtree",
            ),
            child,
            max_replans: 3,
            replan_count: 0,
            task_description_key: task_key,
        }
    }

    pub fn with_max_replans(mut self, max: u32) -> Self {
        self.max_replans = max;
        self
    }
}

#[async_trait]
impl BTreeNode for ReplanOnFailure {
    fn name(&self) -> &str {
        &self.name
    }

    fn node_type(&self) -> &str {
        "ReplanOnFailure"
    }

    async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
        loop {
            // Tick child
            let status = self.child.tick(context).await?;

            match status {
                NodeStatus::Success => {
                    self.replan_count = 0; // Reset on success
                    return Ok(NodeStatus::Success);
                }
                NodeStatus::Running => {
                    return Ok(NodeStatus::Running);
                }
                NodeStatus::Failure => {
                    // Child failed, check if we should replan
                    if self.replan_count >= self.max_replans {
                        warn!(
                            "❌ ReplanOnFailure: Max replans ({}) reached, returning Failure",
                            self.max_replans
                        );
                        return Ok(NodeStatus::Failure);
                    }

                    self.replan_count += 1;
                    info!(
                        "🔄 ReplanOnFailure: Child failed, triggering replan {}/{}",
                        self.replan_count, self.max_replans
                    );

                    // Trigger LLM replanning
                    let plan_status = self.planner.tick(context).await?;
                    if plan_status != NodeStatus::Success {
                        warn!("❌ ReplanOnFailure: Replanning failed");
                        return Ok(NodeStatus::Failure);
                    }

                    // Get replanned subtree from blackboard
                    let new_plan = context.blackboard.get("replanned_subtree").await;
                    if new_plan.is_none() {
                        warn!("❌ ReplanOnFailure: No replanned subtree in blackboard");
                        return Ok(NodeStatus::Failure);
                    }

                    info!("✅ ReplanOnFailure: New plan generated, retrying child");
                    // Reset child to try again with new plan
                    self.child.reset().await;
                    // Continue loop to retry
                }
                NodeStatus::Skipped => {
                    return Ok(NodeStatus::Skipped);
                }
            }
        }
    }

    async fn reset(&mut self) {
        self.replan_count = 0;
        self.child.reset().await;
        self.planner.reset().await;
    }

    async fn halt(&mut self) {
        self.child.halt().await;
        self.planner.halt().await;
        self.reset().await;
    }

    fn to_json(&self) -> Result<Value> {
        Ok(serde_json::json!({
            "name": self.name,
            "type": "ReplanOnFailure",
            "max_replans": self.max_replans,
            "replan_count": self.replan_count,
            "child": self.child.to_json()?
        }))
    }
}
```

---

### 4. LLM Tree Parser

**File:** `igris-runtime/crates/igris-btree/src/parser/llm_tree_parser.rs`

```rust
use crate::core::BTreeContext;
use crate::nodes::{
    composite::{Selector, Sequence},
    action::ToolAction,
    condition::CheckBlackboard,
};
use crate::core::BTreeNode;
use anyhow::{anyhow, Result};
use serde_json::Value;
use tracing::debug;

pub struct LLMTreeParser;

impl LLMTreeParser {
    pub fn new() -> Self {
        Self
    }

    /// Extract JSON from LLM response (handles markdown code blocks)
    pub fn extract_json(response: &str) -> Result<Value> {
        // Try direct parse first
        if let Ok(json) = serde_json::from_str::<Value>(response) {
            return Ok(json);
        }

        // Try extracting from markdown code block
        let trimmed = response.trim();
        if trimmed.starts_with("```") {
            // Find first { and last }
            if let Some(start) = trimmed.find('{') {
                if let Some(end) = trimmed.rfind('}') {
                    let json_str = &trimmed[start..=end];
                    return serde_json::from_str(json_str)
                        .map_err(|e| anyhow!("Failed to parse JSON from markdown: {}", e));
                }
            }
        }

        Err(anyhow!("No valid JSON found in LLM response"))
    }

    /// Parse JSON node into BTree node
    pub fn parse_node(&self, json: &Value, context: &BTreeContext) -> Result<Box<dyn BTreeNode>> {
        let node_type = json.get("type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'type' field in node"))?;

        let name = json.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("unnamed")
            .to_string();

        debug!("Parsing node: type={}, name={}", node_type, name);

        match node_type {
            "Sequence" => self.parse_sequence(json, context, name),
            "Selector" => self.parse_selector(json, context, name),
            "Action" => self.parse_action(json, context, name),
            "Condition" => self.parse_condition(json, context, name),
            _ => Err(anyhow!("Unknown node type: {}", node_type)),
        }
    }

    fn parse_sequence(&self, json: &Value, context: &BTreeContext, name: String) -> Result<Box<dyn BTreeNode>> {
        let children = json.get("children")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow!("Sequence missing 'children' array"))?;

        let mut seq = Sequence::new(name);
        for child_json in children {
            let child = self.parse_node(child_json, context)?;
            seq = seq.add_child(child);
        }

        Ok(Box::new(seq))
    }

    fn parse_selector(&self, json: &Value, context: &BTreeContext, name: String) -> Result<Box<dyn BTreeNode>> {
        let children = json.get("children")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow!("Selector missing 'children' array"))?;

        let mut sel = Selector::new(name);
        for child_json in children {
            let child = self.parse_node(child_json, context)?;
            sel = sel.add_child(child);
        }

        Ok(Box::new(sel))
    }

    fn parse_action(&self, json: &Value, context: &BTreeContext, name: String) -> Result<Box<dyn BTreeNode>> {
        let tool_name = json.get("tool")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Action missing 'tool' field"))?;

        let args = json.get("args")
            .cloned()
            .unwrap_or(Value::Object(serde_json::Map::new()));

        let tool_registry = context.tool_registry.as_ref()
            .ok_or_else(|| anyhow!("Tool registry not available in context"))?;

        Ok(Box::new(ToolAction::new(name, tool_name, args, tool_registry.clone())))
    }

    fn parse_condition(&self, json: &Value, _context: &BTreeContext, name: String) -> Result<Box<dyn BTreeNode>> {
        let key = json.get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Condition missing 'key' field"))?;

        let expected = json.get("expected")
            .cloned()
            .ok_or_else(|| anyhow!("Condition missing 'expected' field"))?;

        Ok(Box::new(CheckBlackboard::new(name, key, expected)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_from_markdown() {
        let response = r#"
Here's the plan:
```json
{"type": "Sequence", "name": "Test"}
```
"#;
        let json = LLMTreeParser::extract_json(response).unwrap();
        assert_eq!(json["type"], "Sequence");
    }

    #[test]
    fn test_extract_json_direct() {
        let response = r#"{"type": "Selector", "name": "Test"}"#;
        let json = LLMTreeParser::extract_json(response).unwrap();
        assert_eq!(json["type"], "Selector");
    }
}
```

---

## INTEGRATION EXAMPLE

**File:** `igris-runtime/crates/igris-btree/examples/hybrid_mission.rs`

```rust
use igris_btree::{
    core::{BTreeContext, BTreeNode, NodeStatus},
    nodes::{
        composite::{Selector, Sequence},
        decorator::ReplanOnFailure,
        llm::{LLMPlannerNode, SubtreeLoader},
        action::SetBlackboard,
        condition::CheckBlackboard,
    },
};
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    // Setup context with LLM provider and tools
    let llm_provider = Arc::new(/* Your LLM provider */);
    let tool_registry = Arc::new(/* Your tool registry */);
    let rt_executor = Arc::new(igris_rt::RtExecutor::new(igris_rt::RtConfig::default()));

    let mut context = BTreeContext::new()
        .with_llm(llm_provider)
        .with_tools(tool_registry)
        .with_rt_executor(rt_executor);

    // Build hybrid tree
    let mut root = Sequence::new("Hybrid Mission")
        // 1. Set mission in blackboard
        .add_child(Box::new(SetBlackboard::new(
            "set_mission",
            "mission_task",
            "Navigate to warehouse and pick up package",
        )))

        // 2. 🤖 LLM generates dynamic plan
        .add_child(Box::new(LLMPlannerNode::new(
            "llm_generate_plan",
            "mission_task",      // Input: task description
            "dynamic_plan",      // Output: generated BTree JSON
        ).with_timeout(5000)))  // 5 second bounded timeout

        // 3. Load and execute LLM-generated subtree with replanning on failure
        .add_child(Box::new(ReplanOnFailure::new(
            "execute_with_replan",
            Box::new(SubtreeLoader::new("load_dynamic_plan", "dynamic_plan")),
            "mission_task",
        ).with_max_replans(3)))

        // 4. Report completion
        .add_child(Box::new(/* Report to Overture action */));

    // Execute tree
    loop {
        let status = root.tick(&mut context).await?;
        context.tick_count += 1;

        match status {
            NodeStatus::Success => {
                println!("✅ Mission completed successfully!");
                break;
            }
            NodeStatus::Failure => {
                println!("❌ Mission failed!");
                break;
            }
            NodeStatus::Running => {
                println!("⏳ Mission running... tick {}", context.tick_count);
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
            NodeStatus::Skipped => {
                println!("⏭️ Mission skipped");
                break;
            }
        }
    }

    Ok(())
}
```

---

## SAFETY GUARANTEES

### 1. Bounded LLM Execution

```rust
// LLM calls execute with igris-rt deadlines
let task = RtTask::new("llm_planning", Priority::High, llm_future);
let result = rt_executor.execute_with_timeout(task, Duration::from_secs(5)).await?;

if !result.deadline_met {
    // Trigger fallback or replanning
    warn!("LLM exceeded deadline, using cached plan");
}
```

### 2. Watchdog Monitoring

```rust
// Terminate runaway BTree execution
let watchdog = BTreeWatchdog::new(Duration::from_secs(30));
let result = watchdog.execute(root_node, &mut context).await;
```

### 3. Deterministic Fallbacks

```rust
Selector::new("Safe execution")
    .add_child(Box::new(LLMPlannerNode::new(...))) // Try LLM first
    .add_child(Box::new(LoadCachedPlan::new(...)))  // Fallback to cached plan
    .add_child(Box::new(EmergencyStop::new()))      // Last resort
```

---

## DEPLOYMENT TIMELINE

### Phase 1: Core BTree (4 hours)
- [ ] Implement `NodeStatus`, `Blackboard`, `BTreeContext`
- [ ] Implement `Sequence`, `Selector`, `Parallel` nodes
- [ ] Implement decorators: `Repeat`, `Inverter`, `Timeout`
- [ ] Unit tests for composite nodes

### Phase 2: LLM Integration (4 hours)
- [ ] Implement `LLMPlannerNode` with bounded execution
- [ ] Implement `SubtreeLoader` with JSON parsing
- [ ] Implement `ReplanOnFailure` decorator
- [ ] Integration with `igris-rt` for deadlines

### Phase 3: Action/Condition Nodes (2 hours)
- [ ] Implement `ToolAction` (execute `igris-tools`)
- [ ] Implement `ROS2Action` (execute ROS2 commands)
- [ ] Implement `CheckBlackboard` condition
- [ ] Implement `SensorCheck` condition

### Phase 4: Parser & Visualization (2 hours)
- [ ] Implement `LLMTreeParser` (JSON to BTree)
- [ ] Implement tree serialization (BTree to JSON)
- [ ] Add runtime visualization (tree state inspection)
- [ ] Web dashboard integration

### Total: 12 hours

---

## TESTING STRATEGY

### Unit Tests
```rust
#[tokio::test]
async fn test_llm_planner_generates_valid_tree() {
    let mock_llm = MockLLM::new(vec![
        r#"{"type":"Sequence","name":"Plan","children":[...]}"#
    ]);
    let planner = LLMPlannerNode::new("test", "task", "output");
    // ... test execution
}
```

### Integration Tests
```rust
#[tokio::test]
async fn test_hybrid_tree_execution() {
    // Build hybrid tree
    // Execute with real LLM
    // Verify deterministic outer loop + adaptive inner logic
}
```

### Safety Tests
```rust
#[tokio::test]
async fn test_bounded_llm_timeout() {
    // Verify LLM calls respect igris-rt deadlines
    // Verify fallback on timeout
}
```

---

## NEXT STEPS

1. **Review this plan** - Does it match your vision?
2. **Choose integration points** - Which existing crates to connect?
3. **Start implementation** - I can create the full `igris-btree` crate
4. **Test with real LLM** - Validate dynamic planning works
5. **Deploy to edge devices** - Test hybrid execution on Runtime

Ready to proceed? I can:
- Generate all the Rust code files
- Create Cargo.toml with dependencies
- Write comprehensive tests
- Add web dashboard visualization

**Approve to start implementation?**
