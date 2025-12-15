use anyhow::Result;
use futures::future::join_all;
use igris_reflection::LLMProvider;
use igris_tools::{ToolDefinition, ToolRegistry, ToolResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::{debug, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub name: String,
    #[serde(default)]
    pub arguments: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolAgentResponse {
    #[serde(default)]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(default)]
    pub final_answer: Option<String>,
}

/// Tool-driven agent loop:
/// - Ask model for either tool calls or a final answer (JSON).
/// - Execute requested tools.
/// - Feed results back to model.
pub struct ToolAgent {
    provider: Arc<dyn LLMProvider>,
    registry: Arc<ToolRegistry>,
    tool_defs: Vec<ToolDefinition>,
    max_steps: u32,
    max_concurrent: usize,
    tool_timeout_ms: u64,
}

impl ToolAgent {
    pub fn new(
        provider: Arc<dyn LLMProvider>,
        registry: Arc<ToolRegistry>,
        max_steps: u32,
        max_concurrent: usize,
        tool_timeout_ms: u64,
    ) -> Self {
        let tool_defs = registry.get_definitions();
        Self {
            provider,
            registry,
            tool_defs,
            max_steps,
            max_concurrent: max_concurrent.max(1),
            tool_timeout_ms,
        }
    }

    pub async fn run(&self, user_prompt: &str) -> Result<String> {
        let mut scratch = String::new();
        let mut current_prompt = self.initial_prompt(user_prompt);

        for step in 1..=self.max_steps {
            info!("ToolAgent step {}/{}", step, self.max_steps);
            let raw = self.provider.generate(&current_prompt).await?;
            debug!("ToolAgent model output (truncated): {}", &raw[..raw.len().min(200)]);

            if let Some(parsed) = parse_tool_agent_response(&raw) {
                if let Some(final_answer) = parsed.final_answer {
                    return Ok(final_answer);
                }

                if let Some(tool_calls) = parsed.tool_calls {
                    if tool_calls.is_empty() {
                        // Empty tool_calls means the model decided it can't proceed; fall back.
                        return Ok(raw);
                    }

                    let tool_results = self.execute_tool_calls(tool_calls).await;
                    scratch.push_str("\n\n");
                    scratch.push_str(&format_tool_results(&tool_results));
                    current_prompt = self.followup_prompt(user_prompt, &scratch);
                    continue;
                }
            }

            // If response isn't in the expected JSON shape, treat as final answer.
            warn!("ToolAgent: model did not return a valid tool JSON; returning raw output");
            return Ok(raw);
        }

        anyhow::bail!("ToolAgent exceeded max_steps={}", self.max_steps);
    }

    fn initial_prompt(&self, user_prompt: &str) -> String {
        format!(
            r#"You are an agent that can use tools. You MUST respond in JSON only.

TOOLS:
{}

RESPONSE FORMAT:
- If you need to call tools, respond with:
  {{"tool_calls":[{{"name":"tool_name","arguments":{{...}}}}]}}
- If you are done, respond with:
  {{"final_answer":"..."}}

USER PROMPT:
{}"#,
            serde_json::to_string_pretty(&self.tool_defs).unwrap_or_else(|_| "[]".to_string()),
            user_prompt
        )
    }

    fn followup_prompt(&self, user_prompt: &str, tool_trace: &str) -> String {
        format!(
            r#"You are continuing a tool-using session. You MUST respond in JSON only.

TOOLS:
{}

RESPONSE FORMAT:
- {{"tool_calls":[{{"name":"tool_name","arguments":{{...}}}}]}}
- {{"final_answer":"..."}}

USER PROMPT:
{}

TOOL RESULTS SO FAR:
{}"#,
            serde_json::to_string_pretty(&self.tool_defs).unwrap_or_else(|_| "[]".to_string()),
            user_prompt,
            tool_trace
        )
    }

    async fn execute_tool_calls(&self, tool_calls: Vec<ToolCall>) -> Vec<ToolResult> {
        let sem = Arc::new(Semaphore::new(self.max_concurrent));
        let mut futures = Vec::with_capacity(tool_calls.len());

        for call in tool_calls {
            let registry = self.registry.clone();
            let sem = sem.clone();
            let timeout_ms = self.tool_timeout_ms;
            futures.push(async move {
                let _permit = sem.acquire().await.expect("semaphore closed");
                let exec = registry.execute(&call.name, call.arguments);
                match tokio::time::timeout(std::time::Duration::from_millis(timeout_ms), exec).await
                {
                    Ok(Ok(result)) => result,
                    Ok(Err(e)) => ToolResult::failure(call.name, e.to_string(), timeout_ms),
                    Err(_) => ToolResult::failure(
                        call.name,
                        format!("Tool timed out after {}ms", timeout_ms),
                        timeout_ms,
                    ),
                }
            });
        }

        join_all(futures).await
    }
}

fn format_tool_results(results: &[ToolResult]) -> String {
    serde_json::to_string_pretty(results).unwrap_or_else(|_| "[]".to_string())
}

/// Best-effort parse of the model output into ToolAgentResponse.
///
/// The model is instructed to return JSON only, but we still defensively scan
/// for a JSON object in case of extra tokens.
pub fn parse_tool_agent_response(s: &str) -> Option<ToolAgentResponse> {
    let json = extract_first_json_object(s)?;
    serde_json::from_value::<ToolAgentResponse>(json).ok()
}

fn extract_first_json_object(s: &str) -> Option<Value> {
    let mut start: Option<usize> = None;
    let mut depth: i32 = 0;
    let mut in_string = false;
    let mut escape = false;

    for (idx, ch) in s.char_indices() {
        if start.is_none() {
            if ch == '{' {
                start = Some(idx);
                depth = 1;
                in_string = false;
                escape = false;
            }
            continue;
        }

        if in_string {
            if escape {
                escape = false;
                continue;
            }
            match ch {
                '\\' => escape = true,
                '"' => in_string = false,
                _ => {}
            }
            continue;
        }

        match ch {
            '"' => in_string = true,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    let begin = start?;
                    let end = idx + ch.len_utf8();
                    let slice = &s[begin..end];
                    if let Ok(val) = serde_json::from_str::<Value>(slice) {
                        if val.is_object() {
                            return Some(val);
                        }
                    }
                    // If parse fails, keep scanning for the next object.
                    start = None;
                }
            }
            _ => {}
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

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

    #[tokio::test]
    async fn parse_json_with_noise() {
        let s = "noise\n{\"final_answer\":\"ok\"}\nmore";
        let parsed = parse_tool_agent_response(s).unwrap();
        assert_eq!(parsed.final_answer.unwrap(), "ok");
    }

    #[tokio::test]
    async fn tool_agent_returns_final() {
        let mut reg = ToolRegistry::new();
        // no tools needed
        let provider = Arc::new(MockLLM {
            outputs: vec![r#"{"final_answer":"done"}"#.to_string()],
            idx: tokio::sync::Mutex::new(0),
        });
        let agent = ToolAgent::new(provider, Arc::new(reg), 3, 2, 1000);
        let out = agent.run("hi").await.unwrap();
        assert_eq!(out, "done");
    }
}


