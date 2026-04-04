/// Tool registry for managing and discovering available tools
use crate::{Tool, ToolResult};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Tool definition for LLM consumption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    /// Tool name
    pub name: String,

    /// Human-readable description
    pub description: String,

    /// JSON Schema for parameters
    pub parameters: serde_json::Value,
}

impl ToolDefinition {
    /// Create from a Tool implementation
    pub fn from_tool(tool: &dyn Tool) -> Self {
        Self {
            name: tool.name().to_string(),
            description: tool.description().to_string(),
            parameters: tool.parameters_schema(),
        }
    }
}

/// Registry of available tools
pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
    /// In-process idempotency cache: idempotency_key → result.
    ///
    /// Prevents double-execution of side-effectful tools when a BT or agent
    /// step is retried within the same runtime session (e.g. after a tick error
    /// that left a WAL intent uncommitted). The cache is in-memory only — it
    /// does not survive a full runtime restart, but combined with WAL step-skip
    /// logic that is sufficient for the common crash-recovery case.
    completed_calls: Arc<tokio::sync::RwLock<HashMap<String, ToolResult>>>,
}

impl ToolRegistry {
    /// Create a new empty registry
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
            completed_calls: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
        }
    }

    /// Register a tool
    pub fn register(&mut self, tool: Arc<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    /// Get all tool definitions (for LLM)
    pub fn get_definitions(&self) -> Vec<ToolDefinition> {
        self.tools
            .values()
            .map(|tool| ToolDefinition::from_tool(tool.as_ref()))
            .collect()
    }

    /// Execute a tool by name
    pub async fn execute(&self, tool_name: &str, args: serde_json::Value) -> Result<ToolResult> {
        let tool = self
            .tools
            .get(tool_name)
            .ok_or_else(|| anyhow::anyhow!("Tool not found: {}", tool_name))?;

        // Enforce tool-level validation consistently (not only when a specific tool calls it).
        tool.validate_args(&args).await?;

        let start = std::time::Instant::now();
        let res = tool.execute(args).await;
        let elapsed = start.elapsed().as_millis() as u64;
        match &res {
            Ok(r) => {
                tracing::info!(
                    tool = %tool_name,
                    success = r.success,
                    execution_time_ms = elapsed,
                    "tool_executed"
                );
            }
            Err(e) => {
                tracing::warn!(
                    tool = %tool_name,
                    execution_time_ms = elapsed,
                    error = %e,
                    "tool_failed"
                );
            }
        }
        res
    }

    /// Execute a tool with an idempotency key.
    ///
    /// Before executing, checks whether a result for `idempotency_key` is already
    /// cached. If so, returns the cached result immediately — the tool is **not**
    /// called again. On a fresh call, executes the tool, caches the result, then
    /// returns it.
    ///
    /// # Idempotency key derivation
    ///
    /// The key should be deterministic and unique per logical tool invocation.
    /// For WAL-backed BT tasks, derive it as:
    ///
    /// ```text
    /// "{task_id}:{tick_count}:{tool_name}:{sha256_hex_of_args}"
    /// ```
    ///
    /// This ensures that a re-executed tick (e.g. after a crash before WAL commit)
    /// returns the same result without re-firing the side effect.
    pub async fn execute_idempotent(
        &self,
        idempotency_key: &str,
        tool_name: &str,
        args: serde_json::Value,
    ) -> Result<ToolResult> {
        // Fast path: already executed.
        {
            let cache = self.completed_calls.read().await;
            if let Some(cached) = cache.get(idempotency_key) {
                tracing::debug!(
                    tool = %tool_name,
                    key = %idempotency_key,
                    "tool_idempotent_cache_hit"
                );
                return Ok(cached.clone());
            }
        }

        // Execute and cache.
        let result = self.execute(tool_name, args).await?;
        self.completed_calls
            .write()
            .await
            .insert(idempotency_key.to_string(), result.clone());
        Ok(result)
    }

    /// Check if a tool is registered
    pub fn has_tool(&self, name: &str) -> bool {
        self.tools.contains_key(name)
    }

    /// Get count of registered tools
    pub fn count(&self) -> usize {
        self.tools.len()
    }

    /// List all tool names
    pub fn list_tools(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Tool;

    // Mock tool for testing
    struct MockTool;

    #[async_trait::async_trait]
    impl Tool for MockTool {
        fn name(&self) -> &str {
            "mock_tool"
        }

        fn description(&self) -> &str {
            "A mock tool for testing"
        }

        fn parameters_schema(&self) -> serde_json::Value {
            serde_json::json!({
                "type": "object",
                "properties": {
                    "test": {"type": "string"}
                }
            })
        }

        async fn execute(&self, _args: serde_json::Value) -> Result<ToolResult> {
            Ok(ToolResult::success(
                "mock_tool".to_string(),
                "success".to_string(),
                0,
            ))
        }
    }

    #[test]
    fn test_registry_register() {
        let mut registry = ToolRegistry::new();
        let tool: Arc<dyn Tool> = Arc::new(MockTool);

        registry.register(tool);

        assert_eq!(registry.count(), 1);
        assert!(registry.has_tool("mock_tool"));
    }

    #[test]
    fn test_registry_definitions() {
        let mut registry = ToolRegistry::new();
        registry.register(Arc::new(MockTool));

        let definitions = registry.get_definitions();
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].name, "mock_tool");
    }

    #[tokio::test]
    async fn test_registry_execute() {
        let mut registry = ToolRegistry::new();
        registry.register(Arc::new(MockTool));

        let result = registry
            .execute("mock_tool", serde_json::json!({}))
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.output, "success");
    }
}
