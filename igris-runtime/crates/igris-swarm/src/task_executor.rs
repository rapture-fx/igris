//! Task execution engine for swarm consensus-approved tasks.
//!
//! After a task proposal reaches consensus via voting, it gets dispatched
//! to a TaskExecutor which runs the appropriate handler and reports results.

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Result of executing a swarm task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskExecutionResult {
    pub proposal_id: String,
    pub executor_id: String,
    pub success: bool,
    pub result: serde_json::Value,
    pub duration_ms: u64,
}

/// Handler for a specific task type
#[async_trait]
pub trait TaskHandler: Send + Sync {
    /// Execute the task with given parameters
    async fn execute(&self, parameters: serde_json::Value) -> Result<serde_json::Value>;

    /// Check if this handler can run on the current agent
    fn can_execute(&self) -> bool {
        true
    }
}

/// Task executor that dispatches consensus-approved tasks to handlers
pub struct TaskExecutor {
    agent_id: String,
    handlers: Arc<RwLock<HashMap<String, Arc<dyn TaskHandler>>>>,
    execution_history: Arc<RwLock<Vec<TaskExecutionResult>>>,
}

impl TaskExecutor {
    /// Create a new task executor
    pub fn new(agent_id: &str) -> Self {
        Self {
            agent_id: agent_id.to_string(),
            handlers: Arc::new(RwLock::new(HashMap::new())),
            execution_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Register a handler for a task type
    pub async fn register_handler(&self, task_type: &str, handler: Arc<dyn TaskHandler>) {
        self.handlers
            .write()
            .await
            .insert(task_type.to_string(), handler);
        info!("Registered task handler for type: {}", task_type);
    }

    /// Check if a task type has a registered handler
    pub async fn can_handle(&self, task_type: &str) -> bool {
        let handlers = self.handlers.read().await;
        if let Some(handler) = handlers.get(task_type) {
            handler.can_execute()
        } else {
            false
        }
    }

    /// Execute a consensus-approved task
    pub async fn execute_task(
        &self,
        proposal_id: &str,
        task_type: &str,
        parameters: serde_json::Value,
    ) -> Result<TaskExecutionResult> {
        let handlers = self.handlers.read().await;
        let handler = handlers
            .get(task_type)
            .ok_or_else(|| anyhow::anyhow!("No handler registered for task type: {}", task_type))?;

        info!("Executing task {} (type: {})", proposal_id, task_type);

        let start = std::time::Instant::now();
        let result = handler.execute(parameters).await;
        let duration_ms = start.elapsed().as_millis() as u64;

        let execution_result = match result {
            Ok(value) => {
                info!("Task {} completed in {}ms", proposal_id, duration_ms);
                TaskExecutionResult {
                    proposal_id: proposal_id.to_string(),
                    executor_id: self.agent_id.clone(),
                    success: true,
                    result: value,
                    duration_ms,
                }
            }
            Err(e) => {
                warn!("Task {} failed: {}", proposal_id, e);
                TaskExecutionResult {
                    proposal_id: proposal_id.to_string(),
                    executor_id: self.agent_id.clone(),
                    success: false,
                    result: serde_json::json!({ "error": e.to_string() }),
                    duration_ms,
                }
            }
        };

        // Record in history
        self.execution_history
            .write()
            .await
            .push(execution_result.clone());

        Ok(execution_result)
    }

    /// Get execution history
    pub async fn get_history(&self) -> Vec<TaskExecutionResult> {
        self.execution_history.read().await.clone()
    }

    /// Get registered task types
    pub async fn registered_types(&self) -> Vec<String> {
        self.handlers.read().await.keys().cloned().collect()
    }
}

/// Built-in inference task handler
pub struct InferenceTaskHandler;

#[async_trait]
impl TaskHandler for InferenceTaskHandler {
    async fn execute(&self, parameters: serde_json::Value) -> Result<serde_json::Value> {
        // In production, this would call the local inference engine
        let model = parameters
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("default");
        let prompt = parameters
            .get("prompt")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        info!(
            "Running inference task: model={}, prompt_len={}",
            model,
            prompt.len()
        );

        Ok(serde_json::json!({
            "model": model,
            "status": "completed",
            "tokens_generated": 0
        }))
    }
}

/// Built-in health check task handler
pub struct HealthCheckHandler;

#[async_trait]
impl TaskHandler for HealthCheckHandler {
    async fn execute(&self, _parameters: serde_json::Value) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "status": "healthy",
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestHandler;

    #[async_trait]
    impl TaskHandler for TestHandler {
        async fn execute(&self, params: serde_json::Value) -> Result<serde_json::Value> {
            let x = params.get("x").and_then(|v| v.as_i64()).unwrap_or(0);
            Ok(serde_json::json!({ "result": x * 2 }))
        }
    }

    #[tokio::test]
    async fn test_task_executor() {
        let executor = TaskExecutor::new("agent-1");
        executor
            .register_handler("double", Arc::new(TestHandler))
            .await;

        assert!(executor.can_handle("double").await);
        assert!(!executor.can_handle("unknown").await);

        let result = executor
            .execute_task("task-1", "double", serde_json::json!({ "x": 21 }))
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.result["result"], 42);
    }

    #[tokio::test]
    async fn test_execution_history() {
        let executor = TaskExecutor::new("agent-1");
        executor
            .register_handler("health", Arc::new(HealthCheckHandler))
            .await;

        executor
            .execute_task("task-1", "health", serde_json::json!({}))
            .await
            .unwrap();

        executor
            .execute_task("task-2", "health", serde_json::json!({}))
            .await
            .unwrap();

        let history = executor.get_history().await;
        assert_eq!(history.len(), 2);
    }
}
