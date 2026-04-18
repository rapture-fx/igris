//! Real planning agent implementation with Plan → Act → Observe → Reflect.
//!
//! This is a production-grade loop that:
//! - asks an LLM to propose the next action (tool call or final answer) in JSON
//! - executes tools securely via `igris-tools`
//! - records observations and (optionally) reflection notes
use crate::{PlanStep, PlanningConfig, PlanningResult};
use anyhow::Result;
use igris_reflection::LLMProvider;
use igris_tools::{ToolDefinition, ToolRegistry, ToolResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tracing::{debug, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum DecisionType {
    Tool,
    Final,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ToolDecision {
    name: String,
    #[serde(default)]
    arguments: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StepDecision {
    decision_type: DecisionType,
    thought: String,
    #[serde(default)]
    tool: Option<ToolDecision>,
    #[serde(default)]
    final_answer: Option<String>,
}

pub struct PlanningAgent {
    config: PlanningConfig,
    provider: Arc<dyn LLMProvider>,
    tools: Option<Arc<ToolRegistry>>,
    tool_defs: Vec<ToolDefinition>,
    /// WAL log and signing key for durable execution (optional).
    /// Each planning step is WAL-logged so a crashed planner can resume
    /// from the last committed step rather than re-executing from scratch.
    #[cfg(feature = "wal")]
    wal: Option<(Arc<igris_wal::WalLog>, Arc<ed25519_dalek::SigningKey>)>,
}

impl PlanningAgent {
    /// Backward-compatible constructor; planning requires a provider to be useful.
    /// Use `with_provider` for real execution.
    pub fn new(config: PlanningConfig) -> Self {
        struct MissingProvider;
        #[async_trait::async_trait]
        impl LLMProvider for MissingProvider {
            async fn generate(&self, _prompt: &str) -> Result<String> {
                anyhow::bail!("PlanningAgent is missing an LLM provider. Use PlanningAgent::with_provider(...)");
            }
            fn name(&self) -> &str {
                "missing-provider"
            }
        }

        Self {
            config,
            provider: Arc::new(MissingProvider),
            tools: None,
            tool_defs: vec![],
            #[cfg(feature = "wal")]
            wal: None,
        }
    }

    pub fn with_provider(
        config: PlanningConfig,
        provider: Arc<dyn LLMProvider>,
        tools: Option<Arc<ToolRegistry>>,
    ) -> Self {
        let tool_defs = tools
            .as_ref()
            .map(|t| t.get_definitions())
            .unwrap_or_default();
        Self {
            config,
            provider,
            tools,
            tool_defs,
            #[cfg(feature = "wal")]
            wal: None,
        }
    }

    /// Attach a WAL log and signing key for durable, crash-recoverable plan
    /// execution. Each planning step is committed to the WAL; on recovery the
    /// agent skips already-committed steps.
    #[cfg(feature = "wal")]
    pub fn with_wal(
        mut self,
        wal: Arc<igris_wal::WalLog>,
        signing_key: Arc<ed25519_dalek::SigningKey>,
    ) -> Self {
        self.wal = Some((wal, signing_key));
        self
    }

    pub async fn execute_plan(&self, goal: &str) -> Result<PlanningResult> {
        // Determine which step to resume from (WAL recovery).
        #[cfg(feature = "wal")]
        let start_step: u32 = if let Some((ref wal, _)) = self.wal {
            match wal.last_committed_step() {
                Ok(Some(last_step)) => {
                    info!(
                        "Resuming plan execution from step {} (last committed step: {})",
                        last_step + 2,
                        last_step
                    );
                    last_step + 1 // last_step is 0-based; step_num loop is 1-based
                }
                Ok(None) => 0,
                Err(e) => {
                    warn!("WAL state check failed, starting from step 1: {}", e);
                    0
                }
            }
        } else {
            0
        };
        #[cfg(not(feature = "wal"))]
        let start_step: u32 = 0;

        let mut steps: Vec<PlanStep> = Vec::new();
        let mut tool_calls_used: u32 = 0;

        for step_num in 1..=self.config.max_steps {
            // Skip steps already committed to the WAL from a prior run.
            // Note: on recovery, `steps` history is empty for skipped steps —
            // the step_prompt context will be truncated but execution is correct.
            if step_num <= start_step {
                debug!("Skipping already-committed planning step {}", step_num);
                continue;
            }

            info!("Planning step {}/{}", step_num, self.config.max_steps);

            let prompt = self.step_prompt(goal, &steps);

            // WAL: record intent before LLM call (step_index is 0-based).
            #[cfg(feature = "wal")]
            let wal_entry_id = if let Some((ref wal, _)) = self.wal {
                use igris_wal::StepType;
                use sha2::{Digest, Sha256};
                let input_digest: [u8; 32] = Sha256::digest(prompt.as_bytes()).into();
                match wal.write_intent(
                    step_num - 1,
                    StepType::Inference {
                        provider: self.provider.name().to_string(),
                        model: "planning".to_string(),
                    },
                    input_digest,
                ) {
                    Ok(entry) => Some(entry.entry_id),
                    Err(e) => {
                        warn!("WAL intent write failed for step {}: {}", step_num, e);
                        None
                    }
                }
            } else {
                None
            };

            let raw = self.provider.generate(&prompt).await?;

            let decision = parse_step_decision(&raw).ok_or_else(|| {
                anyhow::anyhow!(
                    "Planner did not return valid JSON step decision. Output: {}",
                    raw
                )
            })?;

            match decision.decision_type {
                DecisionType::Final => {
                    let final_answer = decision.final_answer.unwrap_or_else(|| raw.clone());
                    let thought = decision.thought.clone();
                    steps.push(PlanStep {
                        step_number: step_num,
                        thought: decision.thought,
                        action: "final".to_string(),
                        observation: "completed".to_string(),
                        reflection: None,
                    });

                    // WAL: commit the final step.
                    #[cfg(feature = "wal")]
                    if let (Some((ref wal, ref signing_key)), Some(entry_id)) =
                        (&self.wal, wal_entry_id)
                    {
                        use sha2::{Digest, Sha256};
                        let output_payload = format!("{}{}", thought, &final_answer);
                        let output_digest: [u8; 32] =
                            Sha256::digest(output_payload.as_bytes()).into();
                        if let Err(e) = wal.write_committed(entry_id, output_digest, signing_key) {
                            warn!("WAL commit failed for final step {}: {}", step_num, e);
                        }
                    }

                    return Ok(PlanningResult {
                        goal: goal.to_string(),
                        steps,
                        final_answer,
                        success: true,
                        total_steps: step_num,
                    });
                }
                DecisionType::Tool => {
                    if !self.config.enable_tools {
                        anyhow::bail!("Planner requested a tool call but tools are disabled");
                    }
                    if tool_calls_used >= self.config.max_tool_calls {
                        anyhow::bail!("Exceeded max_tool_calls={}", self.config.max_tool_calls);
                    }

                    let tool = decision.tool.ok_or_else(|| {
                        anyhow::anyhow!("decision_type=tool but 'tool' is missing")
                    })?;
                    let registry = self.tools.as_ref().ok_or_else(|| {
                        anyhow::anyhow!("Tools enabled but ToolRegistry is not provided")
                    })?;

                    let result = registry.execute(&tool.name, tool.arguments).await?;
                    tool_calls_used += 1;

                    let observation = format_tool_result(&result);
                    let reflection = if self.config.enable_reflection {
                        Some(
                            self.reflect_prompt(goal, &steps, &decision.thought, &observation)
                                .await?,
                        )
                    } else {
                        None
                    };

                    // WAL: commit the tool step now that tool + optional reflection succeeded.
                    #[cfg(feature = "wal")]
                    if let (Some((ref wal, ref signing_key)), Some(entry_id)) =
                        (&self.wal, wal_entry_id)
                    {
                        use sha2::{Digest, Sha256};
                        let output_payload =
                            format!("{}{}{}", decision.thought, tool.name, observation);
                        let output_digest: [u8; 32] =
                            Sha256::digest(output_payload.as_bytes()).into();
                        if let Err(e) = wal.write_committed(entry_id, output_digest, signing_key) {
                            warn!("WAL commit failed for step {}: {}", step_num, e);
                        }
                    }

                    steps.push(PlanStep {
                        step_number: step_num,
                        thought: decision.thought,
                        action: format!("tool:{}", tool.name),
                        observation,
                        reflection,
                    });
                }
            }
        }

        Ok(PlanningResult {
            goal: goal.to_string(),
            steps,
            final_answer: "Max steps reached without final answer".to_string(),
            success: false,
            total_steps: self.config.max_steps,
        })
    }

    fn step_prompt(&self, goal: &str, steps: &[PlanStep]) -> String {
        let tool_defs_json =
            serde_json::to_string_pretty(&self.tool_defs).unwrap_or_else(|_| "[]".to_string());

        let history = if steps.is_empty() {
            "(none)".to_string()
        } else {
            steps
                .iter()
                .map(|s| {
                    format!(
                        "Step {}:\nThought: {}\nAction: {}\nObservation: {}\nReflection: {}\n",
                        s.step_number,
                        s.thought,
                        s.action,
                        s.observation,
                        s.reflection.clone().unwrap_or_else(|| "(none)".to_string())
                    )
                })
                .collect::<Vec<_>>()
                .join("\n---\n")
        };

        format!(
            r#"You are a planning agent. You MUST respond in JSON only.

GOAL:
{goal}

TOOLS (if needed):
{tool_defs_json}

PAST STEPS:
{history}

DECISION FORMAT:
- To call a tool:
  {{"decision_type":"tool","thought":"...","tool":{{"name":"tool_name","arguments":{{...}}}}}}
- To finish:
  {{"decision_type":"final","thought":"...","final_answer":"..."}}

Now decide the next action."#,
            goal = goal,
            tool_defs_json = tool_defs_json,
            history = history
        )
    }

    async fn reflect_prompt(
        &self,
        goal: &str,
        steps: &[PlanStep],
        thought: &str,
        observation: &str,
    ) -> Result<String> {
        let last = steps.last().map(|s| s.step_number).unwrap_or(0);
        let prompt = format!(
            r#"You are reflecting on a planning step. Respond with plain text (not JSON).

GOAL: {goal}
STEP NUMBER: {next_step}
THOUGHT: {thought}
OBSERVATION: {observation}

Provide a short reflection: what was learned, and how the plan should adapt."#,
            goal = goal,
            next_step = last + 1,
            thought = thought,
            observation = observation
        );
        self.provider.generate(&prompt).await
    }
}

fn format_tool_result(r: &ToolResult) -> String {
    if r.success {
        format!(
            "Tool {} succeeded ({}ms)\n{}",
            r.tool_name, r.execution_time_ms, r.output
        )
    } else {
        format!(
            "Tool {} failed ({}ms)\n{}",
            r.tool_name,
            r.execution_time_ms,
            r.error
                .clone()
                .unwrap_or_else(|| "unknown error".to_string())
        )
    }
}

fn parse_step_decision(s: &str) -> Option<StepDecision> {
    let json = extract_first_json_object(s)?;
    serde_json::from_value::<StepDecision>(json).ok()
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
    use igris_tools::Tool;
    use serde_json::json;

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

    struct EchoTool;
    #[async_trait::async_trait]
    impl Tool for EchoTool {
        fn name(&self) -> &str {
            "echo"
        }
        fn description(&self) -> &str {
            "echo"
        }
        fn parameters_schema(&self) -> Value {
            json!({"type":"object"})
        }
        async fn execute(&self, args: Value) -> Result<ToolResult> {
            Ok(ToolResult::success(
                "echo".to_string(),
                format!("{}", args),
                1,
            ))
        }
    }

    #[tokio::test]
    async fn planner_executes_tool_then_finishes() {
        let provider = Arc::new(MockLLM {
            outputs: vec![
                r#"{"decision_type":"tool","thought":"need echo","tool":{"name":"echo","arguments":{"x":1}}}"#.to_string(),
                r#"reflection text"#.to_string(),
                r#"{"decision_type":"final","thought":"done","final_answer":"ok"}"#.to_string(),
            ],
            idx: tokio::sync::Mutex::new(0),
        });

        let mut reg = ToolRegistry::new();
        reg.register(Arc::new(EchoTool));

        let cfg = PlanningConfig {
            max_steps: 5,
            enable_reflection: true,
            enable_tools: true,
            max_tool_calls: 5,
        };

        let agent = PlanningAgent::with_provider(cfg, provider, Some(Arc::new(reg)));
        let res = agent.execute_plan("test").await.unwrap();
        assert!(res.success);
        assert_eq!(res.final_answer, "ok");
        assert!(res.steps.len() >= 2);
    }
}
