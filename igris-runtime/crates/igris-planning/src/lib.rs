/// Igris Planning - Planning Agents with Chain-of-Thought (v1.5)
/// Plan → Act → Observe → Reflect loop with tool integration
use serde::{Deserialize, Serialize};

pub mod agent;
pub mod chain_of_thought;

pub use agent::PlanningAgent;
pub use chain_of_thought::ChainOfThought;

/// Planning configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanningConfig {
    /// Max planning steps
    #[serde(default = "default_max_steps")]
    pub max_steps: u32,

    /// Enable reflection after each action
    #[serde(default = "default_enable_reflection")]
    pub enable_reflection: bool,

    /// Enable tool use
    #[serde(default)]
    pub enable_tools: bool,

    /// Max tool calls per plan
    #[serde(default = "default_max_tool_calls")]
    pub max_tool_calls: u32,
}

fn default_max_steps() -> u32 {
    10
}
fn default_enable_reflection() -> bool {
    true
}
fn default_max_tool_calls() -> u32 {
    20
}

impl Default for PlanningConfig {
    fn default() -> Self {
        Self {
            max_steps: 10,
            enable_reflection: true,
            enable_tools: false,
            max_tool_calls: 20,
        }
    }
}

/// Planning step in the execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    pub step_number: u32,
    pub thought: String,
    pub action: String,
    pub observation: String,
    pub reflection: Option<String>,
}

/// Final planning result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanningResult {
    pub goal: String,
    pub steps: Vec<PlanStep>,
    pub final_answer: String,
    pub success: bool,
    pub total_steps: u32,
}
