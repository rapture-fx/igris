use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use crate::parser::JsonTreeParser;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;
use tracing::{debug, info, warn};

/// SubtreeLoader: Load and execute dynamically generated subtree from blackboard
///
/// Workflow:
/// 1. Read LLM-generated plan from blackboard (JSON)
/// 2. Parse JSON into BTree nodes using JsonTreeParser
/// 3. Execute loaded subtree
/// 4. Cache subtree for subsequent ticks
pub struct SubtreeLoader {
    name: String,
    plan_key: String,
    loaded_subtree: Option<Box<dyn BTreeNode>>,
}

impl SubtreeLoader {
    pub fn new(name: impl Into<String>, plan_key: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            plan_key: plan_key.into(),
            loaded_subtree: None,
        }
    }

    async fn load_subtree(&mut self, context: &BTreeContext) -> Result<()> {
        // Get plan from blackboard
        let plan = context
            .blackboard
            .get(&self.plan_key)
            .await
            .ok_or_else(|| anyhow!("Plan not found in blackboard: {}", self.plan_key))?;

        info!(
            "📥 SubtreeLoader '{}': Loading plan from blackboard",
            self.name
        );
        debug!("Plan JSON: {}", serde_json::to_string_pretty(&plan)?);

        // Parse JSON into BTree nodes
        let parser = JsonTreeParser::new();
        let subtree = parser.parse_node(&plan, context)?;

        self.loaded_subtree = Some(subtree);
        info!("✅ SubtreeLoader '{}': Subtree loaded and ready", self.name);

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
                warn!(
                    "❌ SubtreeLoader '{}': Failed to load subtree: {}",
                    self.name, e
                );
                return Ok(NodeStatus::Failure);
            }
        }

        // Execute loaded subtree
        if let Some(subtree) = &mut self.loaded_subtree {
            let status = subtree.tick(context).await?;
            debug!(
                "SubtreeLoader '{}': Subtree returned {:?}",
                self.name, status
            );
            Ok(status)
        } else {
            Ok(NodeStatus::Failure)
        }
    }

    async fn reset(&mut self) {
        debug!("SubtreeLoader '{}': Resetting", self.name);
        if let Some(subtree) = &mut self.loaded_subtree {
            subtree.reset().await;
        }
    }

    async fn halt(&mut self) {
        debug!("SubtreeLoader '{}': Halting", self.name);
        if let Some(subtree) = &mut self.loaded_subtree {
            subtree.halt().await;
        }
        // Clear loaded subtree
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nodes::llm::LLMPlannerNode;
    use crate::MockLlmProvider;
    use std::sync::Arc;

    #[tokio::test]
    async fn test_subtree_loader_basic() {
        let provider = Arc::new(MockLlmProvider::with_navigation_plan());
        let mut context = BTreeContext::new().with_llm(provider);

        // First, generate a plan with LLMPlanner
        context
            .blackboard
            .set("task", serde_json::json!("Navigate"))
            .await;
        let mut planner = LLMPlannerNode::new("planner", "task", "plan");
        let status = planner.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Success);

        // Now load and execute the plan
        let mut loader = SubtreeLoader::new("loader", "plan");
        let status = loader.tick(&mut context).await.unwrap();

        // Should succeed if plan is valid
        // (Will fail in this test because we don't have tool registry)
        // But loading should work
        assert!(loader.loaded_subtree.is_some());
    }

    #[tokio::test]
    async fn test_subtree_loader_missing_plan() {
        let mut context = BTreeContext::new();
        let mut loader = SubtreeLoader::new("loader", "missing_plan");

        let status = loader.tick(&mut context).await.unwrap();
        assert_eq!(status, NodeStatus::Failure);
    }
}
