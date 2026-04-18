/// RUNTIME-05: Resource Limit Enforcement Tests
///
/// Tests verifying that resource limits are properly enforced during tool agent execution
use super::*;
use crate::resource_limits::{ResourceLimitError, ResourceLimits};
use igris_tools::{ToolRegistry, ToolResult};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

/// Mock LLM that generates specific responses
struct MockLLM {
    outputs: Vec<String>,
    idx: tokio::sync::Mutex<usize>,
}

#[async_trait::async_trait]
impl LLMProvider for MockLLM {
    async fn generate(&self, _prompt: &str) -> Result<String> {
        let mut idx = self.idx.lock().await;
        let out = self.outputs[*idx].clone();
        *idx = (*idx + 1).min(self.outputs.len().saturating_sub(1));
        Ok(out)
    }

    fn name(&self) -> &str {
        "mock"
    }
}

/// Mock tool that sleeps for a specified duration
struct SlowTool {
    sleep_ms: u64,
}

unsafe impl Send for SlowTool {}
unsafe impl Sync for SlowTool {}

#[async_trait::async_trait]
impl igris_tools::Tool for SlowTool {
    fn name(&self) -> &str {
        "slow_tool"
    }

    fn description(&self) -> &str {
        "A tool that takes a long time to execute"
    }

    fn parameters_schema(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }

    async fn execute(&self, _args: serde_json::Value) -> Result<ToolResult> {
        sleep(Duration::from_millis(self.sleep_ms)).await;
        Ok(ToolResult::success(
            "slow_tool".to_string(),
            "Slow operation completed".to_string(),
            self.sleep_ms,
        ))
    }
}

/// Mock tool that returns large output
struct LargeOutputTool {
    output_size: usize,
}

unsafe impl Send for LargeOutputTool {}
unsafe impl Sync for LargeOutputTool {}

#[async_trait::async_trait]
impl igris_tools::Tool for LargeOutputTool {
    fn name(&self) -> &str {
        "large_output_tool"
    }

    fn description(&self) -> &str {
        "A tool that returns large output"
    }

    fn parameters_schema(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }

    async fn execute(&self, _args: serde_json::Value) -> Result<ToolResult> {
        let output = "x".repeat(self.output_size);
        Ok(ToolResult::success(
            "large_output_tool".to_string(),
            output,
            100,
        ))
    }
}

#[tokio::test]
async fn test_max_tool_calls_limit() {
    // Create LLM that will request many tool calls
    let provider = Arc::new(MockLLM {
        outputs: vec![
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"final_answer":"done"}"#.to_string(),
        ],
        idx: tokio::sync::Mutex::new(0),
    });

    let mut registry = ToolRegistry::new();
    registry.register(Arc::new(SlowTool { sleep_ms: 10 }));

    // Set very low tool call limit
    let limits = ResourceLimits {
        max_tool_calls: 3,
        ..ResourceLimits::default()
    };

    let agent =
        ToolAgent::new(provider, Arc::new(registry), 10, 2, 5000).with_resource_limits(limits);

    let result = agent.run("test").await;

    // Should fail with max tool calls exceeded
    assert!(result.is_err());
    let error = result.unwrap_err();
    let error_msg = error.to_string();
    assert!(
        error_msg.contains("Maximum tool calls exceeded") || error_msg.contains("tool calls"),
        "Expected tool calls limit error, got: {}",
        error_msg
    );
}

#[tokio::test]
async fn test_max_tool_calls_per_step_limit() {
    // Create LLM that will request many parallel tool calls
    let provider = Arc::new(MockLLM {
        outputs: vec![
            r#"{"tool_calls":[
                {"name":"slow_tool","arguments":{}},
                {"name":"slow_tool","arguments":{}},
                {"name":"slow_tool","arguments":{}},
                {"name":"slow_tool","arguments":{}},
                {"name":"slow_tool","arguments":{}},
                {"name":"slow_tool","arguments":{}},
                {"name":"slow_tool","arguments":{}}
            ]}"#
            .to_string(),
            r#"{"final_answer":"done"}"#.to_string(),
        ],
        idx: tokio::sync::Mutex::new(0),
    });

    let mut registry = ToolRegistry::new();
    registry.register(Arc::new(SlowTool { sleep_ms: 10 }));

    // Set very low tool calls per step limit
    let limits = ResourceLimits {
        max_tool_calls_per_step: 3,
        ..ResourceLimits::default()
    };

    let agent =
        ToolAgent::new(provider, Arc::new(registry), 10, 10, 5000).with_resource_limits(limits);

    let result = agent.run("test").await;

    // Should fail with max tool calls per step exceeded
    assert!(result.is_err());
    let error = result.unwrap_err();
    let error_msg = error.to_string();
    assert!(
        error_msg.contains("per step") || error_msg.contains("tool calls"),
        "Expected tool calls per step limit error, got: {}",
        error_msg
    );
}

#[tokio::test]
async fn test_execution_time_limit() {
    // Create LLM that will use slow tools
    let provider = Arc::new(MockLLM {
        outputs: vec![
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"final_answer":"done"}"#.to_string(),
        ],
        idx: tokio::sync::Mutex::new(0),
    });

    let mut registry = ToolRegistry::new();
    // Each tool takes 200ms, total would be ~600ms
    registry.register(Arc::new(SlowTool { sleep_ms: 200 }));

    // Set execution time limit to 300ms
    let limits = ResourceLimits {
        max_execution_time: Duration::from_millis(300),
        ..ResourceLimits::default()
    };

    let agent =
        ToolAgent::new(provider, Arc::new(registry), 10, 2, 5000).with_resource_limits(limits);

    let result = agent.run("test").await;

    // Should fail with execution time exceeded
    assert!(result.is_err());
    let error = result.unwrap_err();
    let error_msg = error.to_string();
    assert!(
        error_msg.contains("execution time") || error_msg.contains("time exceeded"),
        "Expected execution time limit error, got: {}",
        error_msg
    );
}

#[tokio::test]
async fn test_tool_output_size_limit() {
    // Create LLM that will request a tool with large output
    let provider = Arc::new(MockLLM {
        outputs: vec![
            r#"{"tool_calls":[{"name":"large_output_tool","arguments":{}}]}"#.to_string(),
            r#"{"final_answer":"done"}"#.to_string(),
        ],
        idx: tokio::sync::Mutex::new(0),
    });

    let mut registry = ToolRegistry::new();
    // Tool returns 1MB of output
    registry.register(Arc::new(LargeOutputTool {
        output_size: 1_000_000,
    }));

    // Set tool output size limit to 100KB
    let limits = ResourceLimits {
        max_tool_output_size: 100_000,
        ..ResourceLimits::default()
    };

    let agent =
        ToolAgent::new(provider, Arc::new(registry), 10, 2, 5000).with_resource_limits(limits);

    let result = agent.run("test").await;

    // Should fail with tool output size exceeded
    assert!(result.is_err());
    let error = result.unwrap_err();
    let error_msg = error.to_string();
    assert!(
        error_msg.contains("output size") || error_msg.contains("size exceeded"),
        "Expected tool output size limit error, got: {}",
        error_msg
    );
}

#[tokio::test]
async fn test_limits_not_exceeded_with_conservative_config() {
    // Create LLM that will use tools within limits
    let provider = Arc::new(MockLLM {
        outputs: vec![
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"final_answer":"done"}"#.to_string(),
        ],
        idx: tokio::sync::Mutex::new(0),
    });

    let mut registry = ToolRegistry::new();
    registry.register(Arc::new(SlowTool { sleep_ms: 10 }));

    // Use conservative limits
    let agent = ToolAgent::new(provider, Arc::new(registry), 10, 2, 5000)
        .with_resource_limits(ResourceLimits::conservative());

    let result = agent.run("test").await;

    // Should succeed
    assert!(result.is_ok());
    let answer = result.unwrap();
    assert_eq!(answer, "done");
}

#[tokio::test]
async fn test_execution_graph_includes_resource_usage() {
    // Create LLM that will use tools
    let provider = Arc::new(MockLLM {
        outputs: vec![
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"final_answer":"done"}"#.to_string(),
        ],
        idx: tokio::sync::Mutex::new(0),
    });

    let mut registry = ToolRegistry::new();
    registry.register(Arc::new(SlowTool { sleep_ms: 10 }));

    let agent = ToolAgent::new(provider, Arc::new(registry), 10, 2, 5000).with_graph_tracking(true);

    let result = agent.run_with_graph("test").await;

    // Should succeed
    assert!(result.is_ok());
    let (_answer, graph) = result.unwrap();

    // Check that resource usage metadata was added
    assert!(graph.metadata.contains_key("total_tool_calls"));
    assert!(graph.metadata.contains_key("execution_time_ms"));

    // Verify values
    let tool_calls = graph.metadata.get("total_tool_calls").unwrap();
    assert_eq!(tool_calls, "2"); // Called slow_tool twice

    let exec_time = graph.metadata.get("execution_time_ms").unwrap();
    let exec_time_value: u64 = exec_time.parse().unwrap();
    assert!(exec_time_value > 0);
}

#[tokio::test]
async fn test_execution_graph_includes_limit_exceeded_metadata() {
    // Create LLM that will exceed tool call limits
    let provider = Arc::new(MockLLM {
        outputs: vec![
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"tool_calls":[{"name":"slow_tool","arguments":{}}]}"#.to_string(),
            r#"{"final_answer":"done"}"#.to_string(),
        ],
        idx: tokio::sync::Mutex::new(0),
    });

    let mut registry = ToolRegistry::new();
    registry.register(Arc::new(SlowTool { sleep_ms: 10 }));

    // Set very low tool call limit
    let limits = ResourceLimits {
        max_tool_calls: 2,
        ..ResourceLimits::default()
    };

    let agent = ToolAgent::new(provider, Arc::new(registry), 10, 2, 5000)
        .with_graph_tracking(true)
        .with_resource_limits(limits);

    let result = agent.run_with_graph("test").await;

    // Should fail
    assert!(result.is_err());

    // The error should contain limit information
    let error = result.unwrap_err();
    let error_msg = error.to_string();
    assert!(error_msg.contains("Maximum tool calls exceeded"));
}

#[tokio::test]
async fn test_default_limits_are_reasonable() {
    let limits = ResourceLimits::default();

    // Verify default values are set
    assert_eq!(limits.max_tool_calls, 100);
    assert_eq!(limits.max_recursion_depth, 10);
    assert_eq!(limits.max_speculative_branches, 5);
    assert_eq!(limits.max_execution_time, Duration::from_secs(300)); // 5 minutes
    assert_eq!(limits.max_tool_calls_per_step, 10);
    assert_eq!(limits.max_tool_output_size, 10 * 1024 * 1024); // 10MB

    // Verify limits pass validation
    assert!(limits.validate().is_ok());
}

#[tokio::test]
async fn test_conservative_limits_are_stricter() {
    let default_limits = ResourceLimits::default();
    let conservative_limits = ResourceLimits::conservative();

    // Conservative should be stricter than default
    assert!(conservative_limits.max_tool_calls < default_limits.max_tool_calls);
    assert!(conservative_limits.max_recursion_depth < default_limits.max_recursion_depth);
    assert!(conservative_limits.max_execution_time < default_limits.max_execution_time);
    assert!(conservative_limits.max_tool_calls_per_step < default_limits.max_tool_calls_per_step);
    assert!(conservative_limits.max_tool_output_size < default_limits.max_tool_output_size);

    // Verify limits pass validation
    assert!(conservative_limits.validate().is_ok());
}

#[tokio::test]
async fn test_permissive_limits_are_more_generous() {
    let default_limits = ResourceLimits::default();
    let permissive_limits = ResourceLimits::permissive();

    // Permissive should be more generous than default
    assert!(permissive_limits.max_tool_calls > default_limits.max_tool_calls);
    assert!(permissive_limits.max_recursion_depth > default_limits.max_recursion_depth);
    assert!(permissive_limits.max_execution_time > default_limits.max_execution_time);
    assert!(permissive_limits.max_tool_calls_per_step > default_limits.max_tool_calls_per_step);
    assert!(permissive_limits.max_tool_output_size > default_limits.max_tool_output_size);

    // Verify limits pass validation
    assert!(permissive_limits.validate().is_ok());
}
