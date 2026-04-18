use crate::core::{BTreeContext, BTreeNode, NodeStatus};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;
use tracing::{debug, info, warn};

/// 🤖 LLMPlannerNode: Generates dynamic subtree using LLM
///
/// Workflow:
/// 1. Get task description from blackboard
/// 2. Construct prompt with task + available tools + BTree schema
/// 3. Call LLM (with bounded timeout via igris-rt if available)
/// 4. Parse JSON response into BTree plan
/// 5. Store plan in blackboard for SubtreeLoader
///
/// BYOM: Uses pluggable LlmProvider trait (customer brings their own model)
pub struct LLMPlannerNode {
    name: String,
    task_key: String,
    output_key: String,
    max_retries: u32,
    retry_count: u32,
    bounded_timeout_ms: u64,
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
            bounded_timeout_ms: 5000,
        }
    }

    pub fn with_timeout(mut self, timeout_ms: u64) -> Self {
        self.bounded_timeout_ms = timeout_ms;
        self
    }

    pub fn with_max_retries(mut self, max: u32) -> Self {
        self.max_retries = max;
        self
    }

    async fn generate_plan(&self, context: &BTreeContext, task: &str) -> Result<Value> {
        let provider = context.require_llm()?;

        // Get available tools for prompt
        let available_tools = if let Some(registry) = &context.tool_registry {
            serde_json::to_string_pretty(&registry.get_definitions())?
        } else {
            "[]".to_string()
        };

        // Construct planning prompt
        let prompt = format!(
            r#"You are a behavior tree planner. Generate a JSON behavior tree for this task.

TASK: {task}

AVAILABLE TOOLS: {tools}

BEHAVIOR TREE SCHEMA:
- Sequence: Execute children in order (all must succeed)
- Selector: Try children until one succeeds (fallback)
- Action: Execute a tool
- Condition: Check a condition

Example:
{{
  "type": "Sequence",
  "name": "Plan for task",
  "children": [
    {{"type": "Action", "name": "Do step 1", "tool": "tool_name", "args": {{}}}},
    {{"type": "Action", "name": "Do step 2", "tool": "tool_name2", "args": {{}}}}
  ]
}}

Respond ONLY with valid JSON."#,
            task = task,
            tools = available_tools
        );

        info!("🤖 LLMPlanner '{}': Generating plan", self.name);
        debug!("Prompt: {}", prompt);

        // Execute with bounded timeout if RT executor available
        let plan_text = if let Some(rt_executor) = &context.rt_executor {
            use igris_rt::Priority;

            let provider_clone = provider.clone();
            let prompt_clone = prompt.clone();

            let result = rt_executor
                .execute(Priority::High, async move {
                    provider_clone.generate(&prompt_clone).await
                })
                .await?;

            if !result.deadline_met {
                warn!("⚠️ LLM planning exceeded deadline: {:?}", result.latency);
            }

            result.value?
        } else {
            // Fallback: direct execution without RT guarantees
            provider.generate(&prompt).await?
        };

        // Parse JSON from LLM response
        let parsed = Self::extract_json(&plan_text)?;
        info!("✅ LLMPlanner '{}': Plan generated", self.name);

        Ok(parsed)
    }

    fn extract_json(response: &str) -> Result<Value> {
        // Try direct parse
        if let Ok(json) = serde_json::from_str::<Value>(response) {
            return Ok(json);
        }

        // Try extracting from markdown
        let trimmed = response.trim();
        if let Some(start) = trimmed.find('{') {
            if let Some(end) = trimmed.rfind('}') {
                let json_str = &trimmed[start..=end];
                return serde_json::from_str(json_str)
                    .map_err(|e| anyhow!("Failed to parse JSON: {}", e));
            }
        }

        Err(anyhow!("No valid JSON in LLM response"))
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
        let task = context
            .blackboard
            .get(&self.task_key)
            .await
            .ok_or_else(|| anyhow!("Task not found: {}", self.task_key))?;

        let task_str = task
            .as_str()
            .ok_or_else(|| anyhow!("Task must be string"))?;

        // Generate plan with retry
        loop {
            match self.generate_plan(context, task_str).await {
                Ok(plan) => {
                    context.blackboard.set(&self.output_key, plan).await;
                    info!(
                        "✅ LLMPlanner '{}': Plan stored in '{}'",
                        self.name, self.output_key
                    );
                    return Ok(NodeStatus::Success);
                }
                Err(e) => {
                    self.retry_count += 1;
                    if self.retry_count >= self.max_retries {
                        warn!(
                            "❌ LLMPlanner '{}': Failed after {} retries: {}",
                            self.name, self.max_retries, e
                        );
                        return Ok(NodeStatus::Failure);
                    }
                    warn!(
                        "⚠️ LLMPlanner '{}': Retry {}/{}: {}",
                        self.name, self.retry_count, self.max_retries, e
                    );
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
            "timeout_ms": self.bounded_timeout_ms
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MockLlmProvider;
    use std::sync::Arc;

    #[tokio::test]
    async fn test_llm_planner_basic() {
        let provider = Arc::new(MockLlmProvider::with_navigation_plan());
        let mut context = BTreeContext::new().with_llm(provider);

        context
            .blackboard
            .set("task", serde_json::json!("Navigate to warehouse"))
            .await;

        let mut planner = LLMPlannerNode::new("test", "task", "plan");
        let status = planner.tick(&mut context).await.unwrap();

        assert_eq!(status, NodeStatus::Success);
        assert!(context.blackboard.contains("plan").await);
    }

    #[test]
    fn test_extract_json_direct() {
        let json = r#"{"type": "Sequence", "name": "Test"}"#;
        let parsed = LLMPlannerNode::extract_json(json).unwrap();
        assert_eq!(parsed["type"], "Sequence");
    }

    #[test]
    fn test_extract_json_markdown() {
        let response = r#"Here's the plan:
```json
{"type": "Selector", "name": "Test"}
```
Done!"#;
        let parsed = LLMPlannerNode::extract_json(response).unwrap();
        assert_eq!(parsed["type"], "Selector");
    }
}
