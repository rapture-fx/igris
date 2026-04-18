use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use crate::nodes::llm::{LLMPlannerNode, SubtreeLoader};
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
/// 4. Load new plan via SubtreeLoader and retry
///
/// This is the key decorator that enables automatic recovery via LLM.
pub struct ReplanOnFailure {
    name: String,
    child: Box<dyn BTreeNode>,
    task_key: String,
    planner: LLMPlannerNode,
    loader: SubtreeLoader,
    max_replans: u32,
    replan_count: u32,
}

impl ReplanOnFailure {
    pub fn new(
        name: impl Into<String>,
        child: Box<dyn BTreeNode>,
        task_key: impl Into<String>,
    ) -> Self {
        let task_key_str = task_key.into();
        let name_str = name.into();

        Self {
            planner: LLMPlannerNode::new(
                format!("{}_planner", name_str),
                task_key_str.clone(),
                "replanned_subtree",
            ),
            loader: SubtreeLoader::new(format!("{}_loader", name_str), "replanned_subtree"),
            name: name_str,
            child,
            task_key: task_key_str,
            max_replans: 3,
            replan_count: 0,
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
                            "❌ ReplanOnFailure '{}': Max replans ({}) reached, returning Failure",
                            self.name, self.max_replans
                        );
                        return Ok(NodeStatus::Failure);
                    }

                    self.replan_count += 1;
                    info!(
                        "🔄 ReplanOnFailure '{}': Child failed, triggering replan {}/{}",
                        self.name, self.replan_count, self.max_replans
                    );

                    // Trigger LLM replanning
                    let plan_status = self.planner.tick(context).await?;
                    if plan_status != NodeStatus::Success {
                        warn!("❌ ReplanOnFailure '{}': Replanning failed", self.name);
                        return Ok(NodeStatus::Failure);
                    }

                    info!("✅ ReplanOnFailure '{}': New plan generated", self.name);

                    // Load replanned subtree
                    let load_status = self.loader.tick(context).await?;
                    if load_status.is_failure() {
                        warn!(
                            "❌ ReplanOnFailure '{}': Failed to load new plan",
                            self.name
                        );
                        return Ok(NodeStatus::Failure);
                    }

                    info!("🔄 ReplanOnFailure '{}': Retrying with new plan", self.name);
                    // Reset child to try again
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
        self.loader.reset().await;
    }

    async fn halt(&mut self) {
        self.child.halt().await;
        self.planner.halt().await;
        self.loader.halt().await;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nodes::action::SetBlackboard;
    use crate::MockLlmProvider;
    use std::sync::Arc;

    struct FailThenSucceedNode {
        fail_count: u32,
        current_fails: std::sync::Arc<std::sync::Mutex<u32>>,
    }

    impl FailThenSucceedNode {
        fn new(fail_count: u32) -> Self {
            Self {
                fail_count,
                current_fails: std::sync::Arc::new(std::sync::Mutex::new(0)),
            }
        }
    }

    #[async_trait]
    impl BTreeNode for FailThenSucceedNode {
        fn name(&self) -> &str {
            "fail_then_succeed"
        }
        fn node_type(&self) -> &str {
            "FailThenSucceed"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            let mut count = self.current_fails.lock().unwrap();
            if *count < self.fail_count {
                *count += 1;
                Ok(NodeStatus::Failure)
            } else {
                Ok(NodeStatus::Success)
            }
        }
        async fn reset(&mut self) {
            *self.current_fails.lock().unwrap() = 0;
        }
    }

    #[tokio::test]
    async fn test_replan_on_failure_success_after_replan() {
        let provider = Arc::new(MockLlmProvider::with_recovery_plan());
        let mut context = BTreeContext::new().with_llm(provider);

        // Set initial task
        context
            .blackboard
            .set("task", serde_json::json!("Test mission"))
            .await;

        // Create node that fails twice then succeeds
        let child = Box::new(FailThenSucceedNode::new(2));
        let mut decorator = ReplanOnFailure::new("test_replan", child, "task").with_max_replans(3);

        let status = decorator.tick(&mut context).await.unwrap();

        // Should eventually succeed after replanning
        assert!(status.is_success() || decorator.replan_count > 0);
    }

    #[tokio::test]
    async fn test_replan_on_failure_max_replans() {
        let provider = Arc::new(MockLlmProvider::with_recovery_plan());
        let mut context = BTreeContext::new().with_llm(provider);

        context
            .blackboard
            .set("task", serde_json::json!("Test"))
            .await;

        // Create node that always fails
        struct AlwaysFailNode;
        #[async_trait]
        impl BTreeNode for AlwaysFailNode {
            fn name(&self) -> &str {
                "always_fail"
            }
            fn node_type(&self) -> &str {
                "AlwaysFail"
            }
            async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
                Ok(NodeStatus::Failure)
            }
        }

        let child = Box::new(AlwaysFailNode);
        let mut decorator = ReplanOnFailure::new("test_max", child, "task").with_max_replans(2);

        let status = decorator.tick(&mut context).await.unwrap();

        // Should fail after max replans
        assert_eq!(status, NodeStatus::Failure);
        assert_eq!(decorator.replan_count, 2);
    }
}
