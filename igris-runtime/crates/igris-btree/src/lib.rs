//! # Igris Behavior Tree (Hybrid BTree + LLM)
//!
//! A production-grade behavior tree engine combining:
//! - **Deterministic control flow** (Sequence, Selector, Parallel nodes)
//! - **LLM-powered adaptive reasoning** (LLMPlanner, ReplanOnFailure)
//! - **Bounded execution** (integration with igris-rt for real-time guarantees)
//! - **BYOM philosophy** (pluggable LlmProvider trait, no vendor lock-in)
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────┐
//! │  Deterministic BTree Control Layer                  │
//! │  ├─ Sequence: Execute children in order            │
//! │  ├─ Selector: Try until success (fallback)         │
//! │  └─ Parallel: Execute children concurrently        │
//! └─────────────────────────────────────────────────────┘
//!          ▲                            ▲
//!          │ Hybrid Integration         │
//! ┌────────┴────────────────────────────┴───────────────┐
//! │  🤖 LLM-Powered Adaptive Nodes                      │
//! │  ├─ LLMPlannerNode: Generate dynamic subtrees      │
//! │  ├─ SubtreeLoader: Load LLM plans at runtime       │
//! │  └─ ReplanOnFailure: Auto-recovery via LLM         │
//! └─────────────────────────────────────────────────────┘
//!          ▲
//!          │ Pluggable (BYOM)
//! ┌────────┴─────────────────────────────────────────┐
//! │  LlmProvider Trait (customer-supplied)           │
//! │  - Local models (Phi-3, Qwen, etc.)              │
//! │  - Cloud APIs (if customer chooses)              │
//! │  - Mock provider (testing)                       │
//! └──────────────────────────────────────────────────┘
//! ```
//!
//! ## Example: Hybrid Mission Tree
//!
//! ```rust,no_run
//! use igris_btree::prelude::*;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     // Setup context with mock LLM
//!     let mut context = BTreeContext::new()
//!         .with_llm(Arc::new(MockLlmProvider::new()));
//!
//!     // Build hybrid tree
//!     let mut root = Sequence::new("Mission")
//!         .add_child(Box::new(SetBlackboard::new("task", "Navigate to warehouse")))
//!         .add_child(Box::new(LLMPlannerNode::new("planner", "task", "plan")))
//!         .add_child(Box::new(SubtreeLoader::new("executor", "plan")));
//!
//!     // Execute tree
//!     let status = root.tick(&mut context).await?;
//!     println!("Status: {:?}", status);
//!     Ok(())
//! }
//! ```

pub mod core;
pub mod nodes;
pub mod parser;
pub mod runtime;
pub mod safety;
pub mod visualizer;

// Re-export commonly used types
pub mod prelude {
    pub use crate::core::{
        BTreeContext, BTreeNode, Blackboard, BlackboardEntry, NodeStatus, ScopedBlackboard,
    };
    #[cfg(feature = "ros2")]
    pub use crate::nodes::action::{RosServiceCall, RosTopicPublish, RosTopicSubscribe};
    pub use crate::nodes::{
        action::{SetBlackboard, ToolAction},
        composite::{Parallel, Selector, Sequence},
        condition::CheckBlackboard,
        decorator::{Inverter, Repeat, ReplanOnFailure, Retry, Timeout},
        llm::{LLMPlannerNode, SubtreeLoader},
    };
    pub use crate::parser::{JsonTreeParser, LlmTreeParser};
    pub use crate::runtime::{BTreeExecutor, ExecutionResult, ExecutorConfig};
    pub use crate::safety::Watchdog;
    pub use async_trait::async_trait;
    pub use std::sync::Arc;
}

/// Pluggable LLM provider trait (BYOM - Bring Your Own Model)
///
/// Customers implement this trait with their own model/inference backend.
/// No vendor lock-in, no hosted services, full control.
#[async_trait::async_trait]
pub trait LlmProvider: Send + Sync {
    /// Generate text from prompt
    async fn generate(&self, prompt: &str) -> anyhow::Result<String>;

    /// Provider name for logging
    fn name(&self) -> &str;

    /// Optional: streaming generation
    async fn generate_stream(
        &self,
        _prompt: &str,
    ) -> anyhow::Result<tokio::sync::mpsc::Receiver<String>> {
        anyhow::bail!("Streaming not supported by this provider")
    }
}

/// Mock LLM provider for testing (returns predefined responses)
pub struct MockLlmProvider {
    responses: Vec<String>,
    current: std::sync::Mutex<usize>,
}

impl MockLlmProvider {
    pub fn new(responses: Vec<String>) -> Self {
        Self {
            responses,
            current: std::sync::Mutex::new(0),
        }
    }

    /// Create mock with simple navigation plan
    pub fn with_navigation_plan() -> Self {
        Self::new(vec![r#"{
                "type": "Sequence",
                "name": "Navigate to warehouse",
                "children": [
                    {
                        "type": "Action",
                        "name": "Move forward",
                        "tool": "navigate",
                        "args": {"direction": "forward", "distance": 10}
                    },
                    {
                        "type": "Action",
                        "name": "Turn right",
                        "tool": "navigate",
                        "args": {"direction": "right", "angle": 90}
                    }
                ]
            }"#
        .to_string()])
    }

    /// Create mock with failure recovery plan
    pub fn with_recovery_plan() -> Self {
        Self::new(vec![
            // First plan (will fail)
            r#"{"type": "Action", "name": "Primary", "tool": "primary", "args": {}}"#.to_string(),
            // Recovery plan (second attempt)
            r#"{"type": "Action", "name": "Fallback", "tool": "fallback", "args": {}}"#.to_string(),
        ])
    }
}

#[async_trait::async_trait]
impl LlmProvider for MockLlmProvider {
    async fn generate(&self, _prompt: &str) -> anyhow::Result<String> {
        let mut idx = self.current.lock().unwrap();
        let response = self.responses[*idx % self.responses.len()].clone();
        *idx += 1;
        Ok(response)
    }

    fn name(&self) -> &str {
        "mock"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_provider() {
        let provider = MockLlmProvider::new(vec!["test".to_string()]);
        let result = provider.generate("prompt").await.unwrap();
        assert_eq!(result, "test");
    }

    #[tokio::test]
    async fn test_mock_navigation_plan() {
        let provider = MockLlmProvider::with_navigation_plan();
        let result = provider.generate("").await.unwrap();
        assert!(result.contains("Navigate"));
        assert!(result.contains("Sequence"));
    }
}
