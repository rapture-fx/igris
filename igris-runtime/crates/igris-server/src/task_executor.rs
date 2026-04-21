//! Durable task execution with WAL-backed crash recovery.
//!
//! `POST /v1/runtime/task/submit`       — Submit a multi-step task with WAL tracking.
//! `GET  /v1/runtime/task/{task_id}/wal` — Retrieve WAL entries for reconciliation.

use axum::{
    extract::{Json, Path, State},
    http::{header::HeaderName, HeaderValue, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
};
use base64::Engine;
use ed25519_dalek::{Signer, Verifier};
use futures::{stream, Stream, StreamExt};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::convert::Infallible;
use std::pin::Pin;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::watch;
use tracing::{error, info, warn};
use uuid::Uuid;

use igris_btree::{
    core::{BTreeContext, BtWalSession},
    parser::JsonTreeParser,
    prelude::NodeStatus,
    runtime::{BTreeExecutor, ExecutionResult, ExecutorConfig},
};
use igris_core::storage::{TASK_SUBMISSIONS, TASK_SUBMISSION_STATUS_BY_TASK_ID};
use igris_routing::Provider;
use igris_wal::{CheckpointPayload, ResumeToken, StepType, WalEntry, WalLog};
use std::sync::Arc;

use crate::receipt::ExecutionReceipt;
use crate::runtime_execute::{
    canonical_envelope_bytes, iso8601_now, token_estimate, Bounds, ExecuteMessage, ExecuteUsage,
    ExecutionEnvelope,
};
use crate::{AppState, CloudProviderWrapper};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMemoryOptions {
    #[serde(default)]
    pub recall_query: Option<String>,
    #[serde(default)]
    pub recall_top_k: Option<usize>,
    #[serde(default)]
    pub store_key: Option<String>,
    #[serde(default)]
    pub store_output: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentApprovalOptions {
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub task: Option<String>,
    #[serde(default)]
    pub confidence: Option<f32>,
    #[serde(default)]
    pub context: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStep {
    pub step_index: u32,
    #[serde(default)]
    pub node_id: Option<String>,
    #[serde(default)]
    pub checkpoint_key: Option<String>,
    #[serde(default)]
    pub read_slots: Option<Vec<String>>,
    #[serde(default)]
    pub write_slot: Option<String>,
    pub model: String,
    pub messages: Vec<ExecuteMessage>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub memory: Option<AgentMemoryOptions>,
    #[serde(default)]
    pub approval: Option<AgentApprovalOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationGoalPayload {
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub z: f64,
    #[serde(default = "default_orientation_w")]
    pub orientation_w: f64,
    #[serde(default = "default_frame_id")]
    pub frame_id: String,
}

fn default_orientation_w() -> f64 {
    1.0
}
fn default_frame_id() -> String {
    "map".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum RoboticsAction {
    NavigateToPose {
        goal: NavigationGoalPayload,
        #[serde(default)]
        wait_timeout_ms: Option<u64>,
    },
    GetNavigationStatus,
    CancelNavigation,
    PublishPrompt {
        prompt: String,
    },
    PublishVelocity {
        linear_x: f64,
        angular_z: f64,
    },
    PublishZeroVelocity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoboticsStep {
    pub step_index: u32,
    #[serde(default)]
    pub node_id: Option<String>,
    #[serde(default)]
    pub checkpoint_key: Option<String>,
    #[serde(default)]
    pub read_slots: Option<Vec<String>>,
    #[serde(default)]
    pub write_slot: Option<String>,
    #[serde(flatten)]
    pub action: RoboticsAction,
    #[serde(default)]
    pub approval: Option<AgentApprovalOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub(crate) struct GovernedAction {
    schema_version: String,
    domain: String,
    action_type: String,
    action_name: String,
    node_id: String,
    step_index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    target: Option<String>,
    requires_policy: bool,
    safety_mode_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct GovernedPolicyDecision {
    schema_version: String,
    decision_id: String,
    tenant_id: String,
    task_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    runtime_id: Option<String>,
    action: GovernedAction,
    permit: bool,
    reason: String,
    policy_version: String,
    runtime_permitted: bool,
    tenant_permitted: bool,
    policy_permitted: bool,
    robot_mode_permitted: bool,
    issued_at_unix_ms: u64,
    expires_at_unix_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    signer_key_version: Option<String>,
    signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HumanApprovalStep {
    pub step_index: u32,
    pub node_id: String,
    #[serde(default)]
    pub checkpoint_key: Option<String>,
    #[serde(default)]
    pub read_slots: Option<Vec<String>>,
    #[serde(default)]
    pub write_slot: Option<String>,
    pub task: String,
    #[serde(default)]
    pub confidence: Option<f32>,
    #[serde(default)]
    pub context: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRecallStep {
    pub step_index: u32,
    pub node_id: String,
    #[serde(default)]
    pub checkpoint_key: Option<String>,
    #[serde(default)]
    pub read_slots: Option<Vec<String>>,
    #[serde(default)]
    pub write_slot: Option<String>,
    pub query: String,
    #[serde(default)]
    pub top_k: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStoreStep {
    pub step_index: u32,
    pub node_id: String,
    #[serde(default)]
    pub checkpoint_key: Option<String>,
    #[serde(default)]
    pub read_slots: Option<Vec<String>>,
    #[serde(default)]
    pub write_slot: Option<String>,
    #[serde(default)]
    pub key: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolStep {
    pub step_index: u32,
    pub node_id: String,
    #[serde(default)]
    pub checkpoint_key: Option<String>,
    #[serde(default)]
    pub read_slots: Option<Vec<String>>,
    #[serde(default)]
    pub write_slot: Option<String>,
    pub tool_name: String,
    #[serde(default)]
    pub args: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorTreeStep {
    pub step_index: u32,
    pub node_id: String,
    #[serde(default)]
    pub checkpoint_key: Option<String>,
    #[serde(default)]
    pub read_slots: Option<Vec<String>>,
    #[serde(default)]
    pub write_slot: Option<String>,
    #[serde(default)]
    pub blackboard: Option<serde_json::Value>,
    pub tree: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionGraph {
    #[serde(default)]
    pub graph_id: Option<String>,
    #[serde(default)]
    pub blackboard: Option<serde_json::Value>,
    pub nodes: Vec<ExecutionNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ExecutionNode {
    Reason {
        node_id: String,
        #[serde(default)]
        step_index: Option<u32>,
        #[serde(default)]
        checkpoint_key: Option<String>,
        #[serde(default)]
        read_slots: Option<Vec<String>>,
        #[serde(default)]
        write_slot: Option<String>,
        model: String,
        messages: Vec<ExecuteMessage>,
        #[serde(default)]
        max_tokens: Option<u32>,
        #[serde(default)]
        temperature: Option<f32>,
        #[serde(default)]
        mode: Option<String>,
        #[serde(default)]
        memory: Option<AgentMemoryOptions>,
        #[serde(default)]
        approval: Option<AgentApprovalOptions>,
    },
    Tool {
        node_id: String,
        tool_name: String,
        #[serde(default)]
        args: Option<serde_json::Value>,
        #[serde(default)]
        checkpoint_key: Option<String>,
        #[serde(default)]
        read_slots: Option<Vec<String>>,
        #[serde(default)]
        write_slot: Option<String>,
    },
    BehaviorTree {
        node_id: String,
        tree: serde_json::Value,
        #[serde(default)]
        checkpoint_key: Option<String>,
        #[serde(default)]
        read_slots: Option<Vec<String>>,
        #[serde(default)]
        write_slot: Option<String>,
    },
    Robotics {
        node_id: String,
        #[serde(default)]
        step_index: Option<u32>,
        #[serde(default)]
        checkpoint_key: Option<String>,
        #[serde(default)]
        read_slots: Option<Vec<String>>,
        #[serde(default)]
        write_slot: Option<String>,
        #[serde(flatten)]
        action: RoboticsAction,
        #[serde(default)]
        approval: Option<AgentApprovalOptions>,
    },
    HumanApproval {
        node_id: String,
        #[serde(default)]
        checkpoint_key: Option<String>,
        #[serde(default)]
        read_slots: Option<Vec<String>>,
        #[serde(default)]
        write_slot: Option<String>,
        task: String,
        #[serde(default)]
        confidence: Option<f32>,
        #[serde(default)]
        context: Option<HashMap<String, serde_json::Value>>,
    },
    MemoryRecall {
        node_id: String,
        #[serde(default)]
        checkpoint_key: Option<String>,
        #[serde(default)]
        read_slots: Option<Vec<String>>,
        #[serde(default)]
        write_slot: Option<String>,
        query: String,
        #[serde(default)]
        top_k: Option<usize>,
    },
    MemoryStore {
        node_id: String,
        #[serde(default)]
        checkpoint_key: Option<String>,
        #[serde(default)]
        read_slots: Option<Vec<String>>,
        #[serde(default)]
        write_slot: Option<String>,
        #[serde(default)]
        key: Option<String>,
        content: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TaskType {
    AgentWorkflow {
        steps: Vec<AgentStep>,
    },
    RoboticsWorkflow {
        steps: Vec<RoboticsStep>,
    },
    ExecutionGraph {
        graph: ExecutionGraph,
    },
    SingleInference {
        model: String,
        messages: Vec<ExecuteMessage>,
        #[serde(default)]
        max_tokens: Option<u32>,
        #[serde(default)]
        temperature: Option<f32>,
        #[serde(default)]
        stream: bool,
        #[serde(default)]
        mode: Option<String>,
        #[serde(default)]
        memory: Option<AgentMemoryOptions>,
        #[serde(default)]
        approval: Option<AgentApprovalOptions>,
    },
    /// WAL-backed behavior tree execution. The tree is parsed and run through
    /// BTreeExecutor with a BtWalSession for per-tick durability.
    BehaviorTree {
        /// Runtime behavior tree definition in Igris nested JSON format.
        tree: serde_json::Value,
        /// Maximum ticks before stopping (default: 1000).
        #[serde(default)]
        max_ticks: Option<u64>,
        /// Tick deadline in ms (default: uses task deadline_ms).
        #[serde(default)]
        timeout_ms: Option<u64>,
        /// Checkpoint blackboard every N ticks (default: 10).
        #[serde(default)]
        checkpoint_every: Option<u64>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSubmitRequest {
    pub task_id: Uuid,
    pub task_type: TaskType,
    #[serde(default)]
    pub containment: Option<Bounds>,
    #[serde(default)]
    pub resume_from: Option<ResumeToken>,
    /// Full prior checkpoint forwarded by the coordinator on recovery.
    /// Behavior tree tasks use this to restore blackboard state before
    /// resuming execution. Ignored for agent/robotics task types.
    #[serde(default)]
    pub resume_checkpoint: Option<serde_json::Value>,
    pub idempotency_key: String,
    pub tenant_id: String,
    #[serde(default)]
    pub agent_identity: Option<AgentIdentity>,
    #[serde(default)]
    pub required_capabilities: Vec<String>,
    #[serde(default)]
    pub permission_envelope: Option<TaskPermissionEnvelope>,
    #[serde(default)]
    pub credential_refs: Vec<CredentialReference>,
    #[serde(default)]
    pub(crate) signed_policy_decisions: Vec<GovernedPolicyDecision>,
    #[serde(default)]
    pub deadline_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentIdentity {
    #[serde(default)]
    pub agent_id: String,
    #[serde(default)]
    pub principal_id: String,
    #[serde(default)]
    pub submitted_by: String,
    #[serde(default)]
    pub acting_on_behalf_of: String,
    #[serde(default)]
    pub delegation_chain: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CredentialReference {
    pub reference_id: String,
    pub tenant_id: String,
    pub task_id: String,
    #[serde(default)]
    pub tool: String,
    #[serde(default)]
    pub capability: String,
    #[serde(default)]
    pub scope: String,
    pub expires_at_unix_ms: i64,
    pub revocable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CapabilityDecision {
    pub capability: String,
    pub permit: bool,
    pub reason: String,
    pub policy_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TaskPermissionEnvelope {
    pub schema_version: String,
    pub envelope_id: String,
    pub tenant_id: String,
    pub task_id: String,
    #[serde(default)]
    pub runtime_id: Option<String>,
    pub agent_identity: AgentIdentity,
    #[serde(default)]
    pub required_capabilities: Vec<String>,
    #[serde(default)]
    pub decisions: Vec<CapabilityDecision>,
    #[serde(default)]
    pub credential_refs: Vec<CredentialReference>,
    pub issued_at_unix_ms: i64,
    pub expires_at_unix_ms: i64,
    #[serde(default)]
    pub signer_key_version: Option<String>,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum TaskStatus {
    Completed,
    Checkpointed { resume_token: ResumeToken },
    Failed { reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TaskFailureDetails {
    pub source: String,
    pub operation: String,
    pub rejection_type: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_index: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSubmitResponse {
    pub task_id: Uuid,
    pub steps_completed: u32,
    pub steps_total: u32,
    pub status: TaskStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkpoint: Option<CheckpointPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub final_output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<ExecuteUsage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_details: Option<TaskFailureDetails>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_envelope: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_receipt: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "domain", rename_all = "snake_case")]
enum RuntimeTaskStep {
    Agent(AgentStep),
    Robotics(RoboticsStep),
    Tool(ToolStep),
    HumanApproval(HumanApprovalStep),
    MemoryRecall(MemoryRecallStep),
    MemoryStore(MemoryStoreStep),
    BehaviorTree(BehaviorTreeStep),
}

impl RuntimeTaskStep {
    fn step_index(&self) -> u32 {
        match self {
            Self::Agent(step) => step.step_index,
            Self::Robotics(step) => step.step_index,
            Self::Tool(step) => step.step_index,
            Self::HumanApproval(step) => step.step_index,
            Self::MemoryRecall(step) => step.step_index,
            Self::MemoryStore(step) => step.step_index,
            Self::BehaviorTree(step) => step.step_index,
        }
    }

    fn input_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }

    fn model_name(&self) -> &str {
        match self {
            Self::Agent(step) => step.model.as_str(),
            Self::Robotics(_) => "robotics",
            Self::Tool(step) => step.tool_name.as_str(),
            Self::HumanApproval(_) => "human_approval",
            Self::MemoryRecall(_) => "memory_recall",
            Self::MemoryStore(_) => "memory_store",
            Self::BehaviorTree(_) => "behavior_tree",
        }
    }

    fn domain_name(&self) -> &'static str {
        match self {
            Self::Agent(_) => "agent",
            Self::Robotics(_) => "robotics",
            Self::Tool(_) => "tool",
            Self::HumanApproval(_) => "human_approval",
            Self::MemoryRecall(_) => "memory_recall",
            Self::MemoryStore(_) => "memory_store",
            Self::BehaviorTree(_) => "behavior_tree",
        }
    }

    fn node_id(&self) -> &str {
        match self {
            Self::Agent(step) => step.node_id.as_deref().unwrap_or("agent"),
            Self::Robotics(step) => step.node_id.as_deref().unwrap_or("robotics"),
            Self::Tool(step) => step.node_id.as_str(),
            Self::HumanApproval(step) => step.node_id.as_str(),
            Self::MemoryRecall(step) => step.node_id.as_str(),
            Self::MemoryStore(step) => step.node_id.as_str(),
            Self::BehaviorTree(step) => step.node_id.as_str(),
        }
    }

    #[allow(dead_code)]
    fn read_slots(&self) -> Option<&[String]> {
        match self {
            Self::Agent(step) => step.read_slots.as_deref(),
            Self::Robotics(step) => step.read_slots.as_deref(),
            Self::Tool(step) => step.read_slots.as_deref(),
            Self::HumanApproval(step) => step.read_slots.as_deref(),
            Self::MemoryRecall(step) => step.read_slots.as_deref(),
            Self::MemoryStore(step) => step.read_slots.as_deref(),
            Self::BehaviorTree(step) => step.read_slots.as_deref(),
        }
    }

    fn write_slot(&self) -> Option<&str> {
        match self {
            Self::Agent(step) => step.write_slot.as_deref(),
            Self::Robotics(step) => step.write_slot.as_deref(),
            Self::Tool(step) => step.write_slot.as_deref(),
            Self::HumanApproval(step) => step.write_slot.as_deref(),
            Self::MemoryRecall(step) => step.write_slot.as_deref(),
            Self::MemoryStore(step) => step.write_slot.as_deref(),
            Self::BehaviorTree(step) => step.write_slot.as_deref(),
        }
    }

    fn wal_step_type(&self) -> StepType {
        match self {
            Self::Agent(step) => StepType::Inference {
                provider: String::new(),
                model: step.model.clone(),
            },
            Self::Robotics(step) => match &step.action {
                RoboticsAction::NavigateToPose { goal, .. } => StepType::RoboticsAction {
                    action: "navigate_to_pose".to_string(),
                    target: Some(format!("{},{},{}", goal.x, goal.y, goal.frame_id)),
                },
                RoboticsAction::GetNavigationStatus => StepType::RoboticsAction {
                    action: "get_navigation_status".to_string(),
                    target: None,
                },
                RoboticsAction::CancelNavigation => StepType::RoboticsAction {
                    action: "cancel_navigation".to_string(),
                    target: None,
                },
                RoboticsAction::PublishPrompt { .. } => StepType::RoboticsAction {
                    action: "publish_prompt".to_string(),
                    target: None,
                },
                RoboticsAction::PublishVelocity {
                    linear_x,
                    angular_z,
                } => StepType::RoboticsAction {
                    action: "publish_velocity".to_string(),
                    target: Some(format!("{:.3},{:.3}", linear_x, angular_z)),
                },
                RoboticsAction::PublishZeroVelocity => StepType::RoboticsAction {
                    action: "publish_zero_velocity".to_string(),
                    target: None,
                },
            },
            Self::Tool(step) => StepType::ToolCall {
                tool_name: step.tool_name.clone(),
            },
            Self::HumanApproval(_) => StepType::ToolCall {
                tool_name: "human_approval".to_string(),
            },
            Self::MemoryRecall(_) => StepType::ToolCall {
                tool_name: "memory_recall".to_string(),
            },
            Self::MemoryStore(_) => StepType::ToolCall {
                tool_name: "memory_store".to_string(),
            },
            Self::BehaviorTree(step) => StepType::BtNode {
                node_id: step.node_id.clone(),
                node_type: "execution_graph".to_string(),
            },
        }
    }

    fn governed_action(&self) -> Option<GovernedAction> {
        match self {
            Self::Robotics(step) => Some(GovernedAction {
                schema_version: "governed_action.v1".to_string(),
                domain: "robotics".to_string(),
                action_type: "ros2_action".to_string(),
                action_name: robotics_action_name(&step.action).to_string(),
                node_id: step.node_id.as_deref().unwrap_or("robotics").to_string(),
                step_index: step.step_index,
                target: robotics_action_target(&step.action),
                requires_policy: true,
                safety_mode_required: true,
            }),
            Self::Tool(step) => Some(GovernedAction {
                schema_version: "governed_action.v1".to_string(),
                domain: "tool".to_string(),
                action_type: "tool_call".to_string(),
                action_name: step.tool_name.clone(),
                node_id: step.node_id.clone(),
                step_index: step.step_index,
                target: None,
                requires_policy: true,
                safety_mode_required: false,
            }),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
struct StepExecutionResult {
    output_text: String,
    provider_name: String,
    usage: ExecuteUsage,
    graph_output: Option<serde_json::Value>,
    checkpoint_metadata: Option<serde_json::Value>,
    checkpoint_requested: bool,
}

struct BehaviorTreeRuntimeResult {
    result: ExecutionResult,
    checkpoint: Option<CheckpointPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct IdempotentTaskRecord {
    request_hash: String,
    response: TaskSubmitResponse,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AgentExecutionMode {
    Default,
    Latency,
    Balanced,
    Quality,
    Cost,
    Thompson,
    Council,
}

struct TaskCancellationGuard {
    registry: Arc<std::sync::RwLock<HashMap<Uuid, watch::Sender<bool>>>>,
    task_id: Uuid,
}

impl Drop for TaskCancellationGuard {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.registry.write() {
            guard.remove(&self.task_id);
        }
    }
}

fn register_task_cancellation(
    state: &AppState,
    task_id: Uuid,
) -> (TaskCancellationGuard, watch::Receiver<bool>) {
    let (tx, rx) = watch::channel(false);
    if let Ok(mut guard) = state.task_cancellation_registry.write() {
        guard.insert(task_id, tx);
    }
    (
        TaskCancellationGuard {
            registry: state.task_cancellation_registry.clone(),
            task_id,
        },
        rx,
    )
}

fn signal_task_cancellation(state: &AppState, task_id: Uuid) -> bool {
    state
        .task_cancellation_registry
        .read()
        .ok()
        .and_then(|guard| guard.get(&task_id).cloned())
        .map(|sender| sender.send(true).is_ok())
        .unwrap_or(false)
}

fn is_task_canceled(cancel_rx: &watch::Receiver<bool>) -> bool {
    *cancel_rx.borrow()
}

fn task_cancellation_reason(task_id: Uuid) -> String {
    format!("task {} canceled", task_id)
}

pub async fn handle_task_submit(
    State(state): State<AppState>,
    Json(req): Json<TaskSubmitRequest>,
) -> impl IntoResponse {
    let submission_key = submission_key(&req.tenant_id, &req.idempotency_key);
    let request_hash = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&serde_json::json!({
                "task_type": &req.task_type,
                "containment": &req.containment,
                "tenant_id": &req.tenant_id,
                "deadline_ms": &req.deadline_ms,
                "agent_identity": &req.agent_identity,
                "required_capabilities": &req.required_capabilities,
            }))
            .unwrap_or_default(),
        )
    );
    if let Ok(Some(existing)) = state
        .storage
        .get::<IdempotentTaskRecord>(TASK_SUBMISSIONS, &submission_key)
    {
        if existing.request_hash != request_hash {
            return (
                StatusCode::CONFLICT,
                Json(build_idempotency_conflict_payload(&existing.response)),
            )
                .into_response();
        }
        return (StatusCode::OK, Json(existing.response)).into_response();
    }

    if matches!(
        &req.task_type,
        TaskType::SingleInference { stream: true, .. }
    ) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": {
                    "message": "stream=true is not supported on the durable task endpoint; use /v1/chat/completions for SSE streaming",
                    "type": "unsupported_streaming_mode"
                }
            })),
        )
            .into_response();
    }

    if let Err(reason) = validate_task_permission_envelope(
        &req,
        state.overture_public_key.as_deref(),
        &state.swarm_peer_id,
    ) {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": {
                    "message": reason,
                    "type": "permission_envelope_rejected"
                }
            })),
        )
            .into_response();
    }

    let runtime_id = state.swarm_peer_id.clone();
    let wal = Arc::new(WalLog::new(
        state.storage.clone(),
        req.task_id,
        runtime_id.clone(),
    ));
    let (_cancel_guard, cancel_rx) = register_task_cancellation(&state, req.task_id);

    let start_step = if let Some(ref token) = req.resume_from {
        match wal.committed_state() {
            Ok((local_last_step, local_digest)) => {
                if let Some(start_step) =
                    verified_resume_start_step(token, local_last_step, local_digest)
                {
                    info!(task_id = %req.task_id, "Resume verified at step {}", token.last_committed_step);
                    start_step
                } else {
                    warn!(task_id = %req.task_id, "Checkpoint digest mismatch on resume");
                    return (
                        StatusCode::CONFLICT,
                        Json(build_checkpoint_mismatch_payload(
                            req.task_id,
                            token,
                            local_last_step,
                            local_digest,
                            req.resume_checkpoint.is_some(),
                        )),
                    )
                        .into_response();
                }
            }
            Err(e) => {
                error!(task_id = %req.task_id, "WAL digest computation failed: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": { "message": "WAL error", "type": "wal_error" }
                    })),
                )
                    .into_response();
            }
        }
    } else {
        0
    };

    let deadline = req.deadline_ms.unwrap_or(300_000);
    let max_tick_ms = req
        .containment
        .as_ref()
        .and_then(|b| b.max_tick_ms)
        .unwrap_or(30_000);
    let wall_start = Instant::now();

    // ── Behavior tree path (early return before the step loop) ────────────────
    if let TaskType::BehaviorTree {
        ref tree,
        max_ticks,
        timeout_ms,
        checkpoint_every,
    } = req.task_type
    {
        if state.signing_key.is_none() {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": {
                        "message": "Behavior tree tasks require a runtime configured with an Ed25519 signing key",
                        "type": "missing_signing_key"
                    }
                })),
            ).into_response();
        }

        let bt = match execute_behavior_tree_runtime(
            &state,
            req.task_id,
            tree,
            req.resume_checkpoint.as_ref(),
            None,
            timeout_ms.unwrap_or(deadline),
            max_ticks,
            checkpoint_every.unwrap_or(10),
            Some(wal.clone()),
        )
        .await
        {
            Ok(r) => r,
            Err(e) => {
                if e.to_string().starts_with("invalid behavior tree:") {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({
                            "error": {
                                "message": e.to_string(),
                                "type": "invalid_tree"
                            }
                        })),
                    )
                        .into_response();
                }
                error!(task_id = %req.task_id, "BT execution error: {}", e);
                let response = TaskSubmitResponse {
                    task_id: req.task_id,
                    steps_completed: 0,
                    steps_total: 1,
                    status: TaskStatus::Failed {
                        reason: format!("Execution error: {}", e),
                    },
                    checkpoint: None,
                    final_output: None,
                    usage: None,
                    failure_details: Some(runtime_execution_failure_details(
                        "behavior_tree_execution_error",
                        e.to_string(),
                        None,
                    )),
                    execution_envelope: None,
                    execution_receipt: None,
                };
                let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
                return (StatusCode::OK, Json(response)).into_response();
            }
        };
        let response_checkpoint = bt.checkpoint;
        let (status, steps_completed, failure_details) = match bt.result.status {
            NodeStatus::Success => (TaskStatus::Completed, 1u32, None),
            NodeStatus::Failure | NodeStatus::Skipped => {
                let reason = bt
                    .result
                    .error
                    .unwrap_or_else(|| "behavior tree returned Failure".into());
                (
                    TaskStatus::Failed {
                        reason: reason.clone(),
                    },
                    0u32,
                    Some(runtime_execution_failure_details(
                        "behavior_tree_failed",
                        reason,
                        None,
                    )),
                )
            }
            NodeStatus::Running => {
                if let Some(ref cp) = response_checkpoint {
                    (
                        TaskStatus::Checkpointed {
                            resume_token: cp.resume_token.clone(),
                        },
                        bt.result.tick_count as u32,
                        None,
                    )
                } else {
                    (
                        TaskStatus::Failed {
                            reason: "execution interrupted without checkpoint".into(),
                        },
                        0u32,
                        Some(runtime_execution_failure_details(
                            "execution_interrupted_without_checkpoint",
                            "execution interrupted without checkpoint",
                            None,
                        )),
                    )
                }
            }
        };

        let response = TaskSubmitResponse {
            task_id: req.task_id,
            steps_completed,
            steps_total: 1,
            status,
            checkpoint: response_checkpoint,
            final_output: None,
            usage: None,
            failure_details,
            execution_envelope: None,
            execution_receipt: None,
        };
        let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
        return (StatusCode::OK, Json(response)).into_response();
    }

    let execution_graph = match materialize_execution_graph(&req.task_type) {
        Ok(graph) => graph,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": {
                        "message": e.to_string(),
                        "type": "invalid_execution_graph"
                    }
                })),
            )
                .into_response();
        }
    };

    let steps = match compile_execution_graph_to_steps(&execution_graph) {
        Ok(steps) => steps,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": {
                        "message": e.to_string(),
                        "type": "unsupported_execution_graph"
                    }
                })),
            )
                .into_response();
        }
    };

    let steps_total = steps.len() as u32;
    let mut steps_completed = start_step;
    let mut last_output: Option<String> = None;
    let mut last_usage: Option<ExecuteUsage> = None;
    let mut last_envelope: Option<serde_json::Value> = None;
    let mut last_receipt: Option<serde_json::Value> = None;
    let mut checkpoint: Option<CheckpointPayload> = None;
    let mut checkpoint_metadata: Option<serde_json::Value> = None;
    let mut entries_since_checkpoint: Vec<WalEntry> = Vec::new();
    let mut graph_blackboard =
        initialize_graph_blackboard(&execution_graph, req.resume_checkpoint.as_ref());

    for step in steps.iter().filter(|step| step.step_index() >= start_step) {
        if let Some(failure_details) = permission_failure_for_step(&req, step) {
            let reason = failure_details.message.clone();
            let response = TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed,
                steps_total,
                status: TaskStatus::Failed { reason },
                checkpoint,
                final_output: last_output,
                usage: last_usage,
                failure_details: Some(failure_details),
                execution_envelope: last_envelope,
                execution_receipt: last_receipt,
            };
            let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
            return (StatusCode::OK, Json(response)).into_response();
        }
        if is_task_canceled(&cancel_rx) {
            let reason = task_cancellation_reason(req.task_id);
            let response = TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed,
                steps_total,
                status: TaskStatus::Failed { reason },
                checkpoint,
                final_output: last_output,
                usage: last_usage,
                failure_details: Some(runtime_execution_failure_details(
                    "task_canceled",
                    task_cancellation_reason(req.task_id),
                    None,
                )),
                execution_envelope: last_envelope,
                execution_receipt: last_receipt,
            };
            let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
            return (StatusCode::OK, Json(response)).into_response();
        }
        if wall_start.elapsed().as_millis() as u64 > deadline {
            let payload = match build_checkpoint(
                &wal,
                req.task_id,
                steps_completed.saturating_sub(1),
                runtime_id.clone(),
                entries_since_checkpoint.clone(),
                checkpoint_metadata.clone(),
            ) {
                Ok(p) => p,
                Err(e) => {
                    error!(task_id = %req.task_id, "Deadline checkpoint build failed: {}", e);
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "error": { "message": "Failed to build checkpoint", "type": "wal_error" }
                        })),
                    ).into_response();
                }
            };

            let response = TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed,
                steps_total,
                status: TaskStatus::Checkpointed {
                    resume_token: payload.resume_token.clone(),
                },
                checkpoint: Some(payload),
                final_output: last_output,
                usage: last_usage,
                failure_details: None,
                execution_envelope: last_envelope,
                execution_receipt: last_receipt,
            };
            let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
            return (StatusCode::OK, Json(response)).into_response();
        }

        let input_digest: [u8; 32] = Sha256::digest(step.input_bytes()).into();
        let wal_entry =
            match wal.write_intent(step.step_index(), step.wal_step_type(), input_digest) {
                Ok(entry) => entry,
                Err(e) => {
                    error!(task_id = %req.task_id, "WAL intent write failed: {}", e);
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "error": { "message": "WAL write failed", "type": "wal_error" }
                        })),
                    )
                        .into_response();
                }
            };

        let execution = match step {
            RuntimeTaskStep::Agent(agent_step) => {
                execute_agent_step(
                    state.clone(),
                    req.task_id,
                    &req.tenant_id,
                    agent_step,
                    &graph_blackboard,
                    max_tick_ms,
                )
                .await
            }
            RuntimeTaskStep::Robotics(robotics_step) => {
                execute_robotics_step(
                    state.clone(),
                    req.task_id,
                    &req.tenant_id,
                    robotics_step,
                    &graph_blackboard,
                    req.containment.as_ref(),
                    &req.signed_policy_decisions,
                    max_tick_ms,
                )
                .await
            }
            RuntimeTaskStep::Tool(tool_step) => {
                execute_tool_step(state.clone(), req.task_id, tool_step, &graph_blackboard).await
            }
            RuntimeTaskStep::HumanApproval(approval_step) => {
                execute_human_approval_step(
                    state.clone(),
                    req.task_id,
                    &req.tenant_id,
                    approval_step,
                    &graph_blackboard,
                    max_tick_ms,
                )
                .await
            }
            RuntimeTaskStep::MemoryRecall(recall_step) => {
                execute_memory_recall_step(
                    state.clone(),
                    req.task_id,
                    recall_step,
                    &graph_blackboard,
                )
                .await
            }
            RuntimeTaskStep::MemoryStore(store_step) => {
                execute_memory_store_step(state.clone(), req.task_id, store_step, &graph_blackboard)
                    .await
            }
            RuntimeTaskStep::BehaviorTree(bt_step) => {
                execute_behavior_tree_graph_step(
                    state.clone(),
                    req.task_id,
                    bt_step,
                    req.resume_checkpoint.as_ref(),
                    &wal,
                    &graph_blackboard,
                    max_tick_ms,
                )
                .await
            }
        };

        let step_result = match execution {
            Ok(result) => result,
            Err(e) => {
                warn!(task_id = %req.task_id, step = step.step_index(), "Task step failed: {}", e);
                let _ = wal.write_failed(wal_entry.entry_id, e.to_string());
                let failure_artifacts = build_failure_execution_artifacts(
                    &state,
                    &req,
                    step,
                    &e.to_string(),
                    wall_start.elapsed().as_millis() as u64,
                )
                .await
                .ok();
                let (execution_envelope, execution_receipt) = failure_artifacts
                    .map(|(envelope, receipt)| (Some(envelope), receipt))
                    .unwrap_or_else(|| (last_envelope, last_receipt));
                let response = TaskSubmitResponse {
                    task_id: req.task_id,
                    steps_completed,
                    steps_total,
                    status: TaskStatus::Failed {
                        reason: format!("Step {} failed: {}", step.step_index(), e),
                    },
                    checkpoint,
                    final_output: last_output,
                    usage: last_usage,
                    failure_details: Some(runtime_execution_failure_details(
                        "step_failed",
                        e.to_string(),
                        Some(step),
                    )),
                    execution_envelope,
                    execution_receipt,
                };
                let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
                return (StatusCode::OK, Json(response)).into_response();
            }
        };

        update_graph_blackboard(&mut graph_blackboard, step, &step_result);

        if is_task_canceled(&cancel_rx) {
            let reason = task_cancellation_reason(req.task_id);
            let response = TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed,
                steps_total,
                status: TaskStatus::Failed { reason },
                checkpoint,
                final_output: last_output,
                usage: last_usage,
                failure_details: Some(runtime_execution_failure_details(
                    "task_canceled",
                    task_cancellation_reason(req.task_id),
                    Some(step),
                )),
                execution_envelope: last_envelope,
                execution_receipt: last_receipt,
            };
            let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
            return (StatusCode::OK, Json(response)).into_response();
        }

        if step_result.checkpoint_requested {
            checkpoint_metadata = Some(build_step_checkpoint_metadata(
                step,
                steps_completed,
                &step_result,
            ));
            attach_graph_blackboard_metadata(&mut checkpoint_metadata, &graph_blackboard);
            let payload = match build_checkpoint(
                &wal,
                req.task_id,
                steps_completed.saturating_sub(1),
                runtime_id.clone(),
                entries_since_checkpoint.clone(),
                checkpoint_metadata.clone(),
            ) {
                Ok(p) => p,
                Err(e) => {
                    error!(task_id = %req.task_id, "Step checkpoint build failed: {}", e);
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "error": { "message": "Failed to build checkpoint", "type": "wal_error" }
                        })),
                    ).into_response();
                }
            };

            let response = TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed,
                steps_total,
                status: TaskStatus::Checkpointed {
                    resume_token: payload.resume_token.clone(),
                },
                checkpoint: Some(payload),
                final_output: last_output,
                usage: last_usage,
                failure_details: None,
                execution_envelope: last_envelope,
                execution_receipt: last_receipt,
            };
            let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
            return (StatusCode::OK, Json(response)).into_response();
        }

        let (execution_envelope, execution_receipt) = match build_execution_artifacts(
            &state,
            &req,
            step,
            &step_result,
            wall_start.elapsed().as_millis() as u64,
        )
        .await
        {
            Ok(artifacts) => artifacts,
            Err(e) => {
                error!(task_id = %req.task_id, "Execution artifact build failed: {}", e);
                let _ =
                    wal.write_failed(wal_entry.entry_id, format!("artifact build failed: {}", e));
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": { "message": "Failed to build execution artifacts", "type": "artifact_error" }
                    })),
                ).into_response();
            }
        };

        let output_digest: [u8; 32] = Sha256::digest(step_result.output_text.as_bytes()).into();
        let signing_key = match state.signing_key.as_ref() {
            Some(k) => k,
            None => {
                error!(task_id = %req.task_id, "No signing key configured — cannot produce integrity-guaranteed WAL entries");
                let _ =
                    wal.write_failed(wal_entry.entry_id, "runtime has no signing key".to_string());
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": {
                            "message": "Runtime is not configured with a signing key. Task execution requires Ed25519 signing for WAL integrity.",
                            "type": "missing_signing_key"
                        }
                    })),
                ).into_response();
            }
        };

        let committed_entry =
            match wal.write_committed(wal_entry.entry_id, output_digest, signing_key.as_ref()) {
                Ok(entry) => entry,
                Err(e) => {
                    error!(task_id = %req.task_id, "WAL commit write failed: {}", e);
                    let _ =
                        wal.write_failed(wal_entry.entry_id, format!("commit write failed: {}", e));
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({
                            "error": { "message": "WAL commit failed", "type": "wal_error" }
                        })),
                    )
                        .into_response();
                }
            };

        entries_since_checkpoint.push(committed_entry);
        steps_completed = step.step_index() + 1;
        // Build metadata before consuming step_result fields.
        checkpoint_metadata = Some(build_step_checkpoint_metadata(
            step,
            steps_completed,
            &step_result,
        ));
        attach_graph_blackboard_metadata(&mut checkpoint_metadata, &graph_blackboard);
        last_output = Some(step_result.output_text);
        last_usage = Some(step_result.usage);
        last_envelope = Some(execution_envelope);
        last_receipt = execution_receipt;

        if steps_completed > 0 && steps_completed % 5 == 0 {
            match build_checkpoint(
                &wal,
                req.task_id,
                step.step_index(),
                runtime_id.clone(),
                entries_since_checkpoint.clone(),
                checkpoint_metadata.clone(),
            ) {
                Ok(cp) => {
                    checkpoint = Some(cp);
                    entries_since_checkpoint.clear();
                }
                Err(e) => {
                    // Non-fatal: log and continue. The checkpoint will be
                    // attempted again at the next interval or on task completion.
                    warn!(task_id = %req.task_id, "Periodic checkpoint build failed: {}", e);
                }
            }
        }
    }

    let final_checkpoint = if !entries_since_checkpoint.is_empty() {
        match build_checkpoint(
            &wal,
            req.task_id,
            steps_completed.saturating_sub(1),
            runtime_id.clone(),
            entries_since_checkpoint,
            checkpoint_metadata,
        ) {
            Ok(cp) => Some(cp),
            Err(e) => {
                error!(task_id = %req.task_id, "Final checkpoint build failed: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": { "message": "Failed to build final checkpoint", "type": "wal_error" }
                    })),
                ).into_response();
            }
        }
    } else {
        checkpoint
    };

    let response = TaskSubmitResponse {
        task_id: req.task_id,
        steps_completed,
        steps_total,
        status: TaskStatus::Completed,
        checkpoint: final_checkpoint,
        final_output: last_output,
        usage: last_usage,
        failure_details: None,
        execution_envelope: last_envelope,
        execution_receipt: last_receipt,
    };
    let _ = persist_task_record(&state, &submission_key, &request_hash, &response);

    (StatusCode::OK, Json(response)).into_response()
}

pub async fn handle_task_stream(
    State(state): State<AppState>,
    Json(req): Json<TaskSubmitRequest>,
) -> Response {
    let submission_key = submission_key(&req.tenant_id, &req.idempotency_key);
    let request_hash = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&serde_json::json!({
                "task_type": &req.task_type,
                "containment": &req.containment,
                "tenant_id": &req.tenant_id,
                "deadline_ms": &req.deadline_ms,
            }))
            .unwrap_or_default(),
        )
    );

    if let Ok(Some(existing)) = state
        .storage
        .get::<IdempotentTaskRecord>(TASK_SUBMISSIONS, &submission_key)
    {
        if existing.request_hash != request_hash {
            return (
                StatusCode::CONFLICT,
                Json(build_idempotency_conflict_payload(&existing.response)),
            )
                .into_response();
        }
        if matches!(existing.response.status, TaskStatus::Completed) {
            if let Some(final_output) = existing.response.final_output.clone() {
                let existing_response = existing.response.clone();
                let model_name = match &req.task_type {
                    TaskType::SingleInference { model, .. } => model.clone(),
                    _ => "stream".to_string(),
                };
                let stream = futures::stream::iter(vec![
                    Ok::<Event, Infallible>(chat_chunk_event(&model_name, &final_output)),
                    Ok::<Event, Infallible>(task_result_event(&existing_response)),
                    Ok::<Event, Infallible>(Event::default().data("[DONE]")),
                ]);
                let mut response = Sse::new(stream)
                    .keep_alive(KeepAlive::default())
                    .into_response();
                attach_stream_task_headers(&mut response, req.task_id);
                return response;
            }
        }
        return (
            StatusCode::CONFLICT,
            Json(build_stream_replay_unavailable_payload(&existing.response)),
        )
            .into_response();
    }

    let TaskType::SingleInference {
        model,
        messages,
        max_tokens,
        temperature,
        stream,
        mode,
        memory,
        approval,
    } = &req.task_type
    else {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": {
                    "message": "streaming durable tasks currently support only single_inference",
                    "type": "unsupported_streaming_task_type"
                }
            })),
        )
            .into_response();
    };

    if !stream {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": {
                    "message": "task stream endpoint requires task_type.stream=true",
                    "type": "invalid_streaming_request"
                }
            })),
        )
            .into_response();
    }

    if let Err(e) = normalize_agent_mode(mode.as_deref()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": {
                    "message": e.to_string(),
                    "type": "unsupported_streaming_mode"
                }
            })),
        )
            .into_response();
    }

    if req.resume_from.is_some() || req.resume_checkpoint.is_some() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": {
                    "message": "streaming durable tasks do not support resume yet",
                    "type": "unsupported_streaming_resume"
                },
                "durability": stream_durability_metadata(None),
            })),
        )
            .into_response();
    }

    let stream_task = TaskSubmitRequest {
        task_id: req.task_id,
        task_type: TaskType::SingleInference {
            model: model.clone(),
            messages: messages.clone(),
            max_tokens: *max_tokens,
            temperature: *temperature,
            stream: false,
            mode: mode.clone(),
            memory: memory.clone(),
            approval: approval.clone(),
        },
        containment: req.containment.clone(),
        resume_from: None,
        resume_checkpoint: None,
        idempotency_key: req.idempotency_key.clone(),
        tenant_id: req.tenant_id.clone(),
        agent_identity: req.agent_identity.clone(),
        required_capabilities: req.required_capabilities.clone(),
        permission_envelope: req.permission_envelope.clone(),
        credential_refs: req.credential_refs.clone(),
        signed_policy_decisions: req.signed_policy_decisions.clone(),
        deadline_ms: req.deadline_ms,
    };

    let execution_graph = match materialize_execution_graph(&stream_task.task_type) {
        Ok(graph) => graph,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": {
                        "message": e.to_string(),
                        "type": "invalid_execution_graph"
                    }
                })),
            )
                .into_response();
        }
    };

    let steps = match compile_execution_graph_to_steps(&execution_graph) {
        Ok(steps) => steps,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": {
                        "message": e.to_string(),
                        "type": "unsupported_execution_graph"
                    }
                })),
            )
                .into_response();
        }
    };

    let [RuntimeTaskStep::Agent(step)] = steps.as_slice() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": {
                    "message": "streaming durable tasks currently require a single agent execution step",
                    "type": "unsupported_streaming_graph"
                }
            })),
        )
            .into_response();
    };

    let runtime_id = state.swarm_peer_id.clone();
    let wal = Arc::new(WalLog::new(
        state.storage.clone(),
        req.task_id,
        runtime_id.clone(),
    ));
    let max_tick_ms = req
        .containment
        .as_ref()
        .and_then(|bounds| bounds.max_tick_ms)
        .unwrap_or(30_000);
    let deadline = req.deadline_ms.unwrap_or(300_000);
    let stream = build_task_stream_sse(
        state,
        stream_task,
        request_hash,
        submission_key,
        execution_graph,
        wal,
        step.clone(),
        max_tick_ms,
        deadline,
    );
    let mut response = Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response();
    attach_stream_task_headers(&mut response, req.task_id);
    response
}

pub async fn handle_task_cancel(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> impl IntoResponse {
    let canceled = signal_task_cancellation(&state, task_id);
    let persisted = if canceled {
        None
    } else {
        state
            .storage
            .get::<TaskSubmitResponse>(TASK_SUBMISSION_STATUS_BY_TASK_ID, &task_status_key(task_id))
            .ok()
            .flatten()
    };
    let (status, payload) = build_task_cancel_response(task_id, canceled, persisted.as_ref());

    (status, Json(payload))
}

pub async fn handle_task_wal(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> impl IntoResponse {
    let wal = WalLog::new(state.storage.clone(), task_id, state.swarm_peer_id.clone());

    match wal.read_from_step(0) {
        Ok(entries) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "task_id": task_id,
                "entries": entries,
                "count": entries.len(),
            })),
        )
            .into_response(),
        Err(e) => {
            error!(task_id = %task_id, "Failed to read WAL entries: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": { "message": "Failed to read WAL", "type": "wal_error" }
                })),
            )
                .into_response()
        }
    }
}

fn attach_stream_task_headers(response: &mut Response, task_id: Uuid) {
    response.headers_mut().insert(
        HeaderName::from_static("x-igris-runtime-task-id"),
        HeaderValue::from_str(&task_id.to_string())
            .unwrap_or_else(|_| HeaderValue::from_static("invalid-task-id")),
    );
    response.headers_mut().insert(
        HeaderName::from_static("x-igris-runtime-stream-resume-supported"),
        HeaderValue::from_static("false"),
    );
    response.headers_mut().insert(
        HeaderName::from_static("x-igris-runtime-stream-replay-condition"),
        HeaderValue::from_static("completed-final-output"),
    );
    response.headers_mut().insert(
        HeaderName::from_static("x-accel-buffering"),
        HeaderValue::from_static("no"),
    );
}

fn chat_chunk_event(model: &str, text: &str) -> Event {
    let payload = serde_json::json!({
        "id": "chatcmpl-stream",
        "object": "chat.completion.chunk",
        "model": model,
        "choices": [{
            "index": 0,
            "delta": { "content": text },
            "finish_reason": null
        }]
    });
    Event::default().data(payload.to_string())
}

fn chat_error_event(message: impl Into<String>) -> Event {
    let payload = serde_json::json!({
        "id": "chatcmpl-stream",
        "object": "error",
        "error": { "message": message.into(), "type": "stream_error" }
    });
    Event::default().data(payload.to_string())
}

fn stream_durability_metadata(response: Option<&TaskSubmitResponse>) -> serde_json::Value {
    let replay_supported = response.map_or(false, |response| {
        matches!(response.status, TaskStatus::Completed) && response.final_output.is_some()
    });
    let checkpoint_persisted = response.map_or(false, |response| response.checkpoint.is_some());

    serde_json::json!({
        "mode": "streaming",
        "resume_supported": false,
        "replay_supported": replay_supported,
        "replay_condition": "completed-final-output",
        "checkpoint_persisted": checkpoint_persisted,
    })
}

fn build_task_result_payload(response: &TaskSubmitResponse) -> serde_json::Value {
    let (requested_mode, resolved_strategy) = response
        .checkpoint
        .as_ref()
        .and_then(|checkpoint| checkpoint.metadata.as_ref())
        .map(extract_mode_metadata)
        .unwrap_or((None, None));
    let mut payload = serde_json::json!({
        "task_id": response.task_id,
        "steps_completed": response.steps_completed,
        "steps_total": response.steps_total,
        "status": response.status,
        "checkpoint": response.checkpoint,
        "requested_mode": requested_mode,
        "resolved_strategy": resolved_strategy,
        "final_output": response.final_output,
        "usage": response.usage,
        "failure_details": response.failure_details,
        "execution_envelope": response.execution_envelope,
        "execution_receipt": response.execution_receipt,
        "durability": stream_durability_metadata(Some(response)),
    });
    if let Some(receipt) = build_receipt_metadata(response.execution_receipt.as_ref()) {
        payload["receipt"] = receipt;
    }
    payload
}

fn task_result_event(response: &TaskSubmitResponse) -> Event {
    let payload = build_task_result_payload(response);
    Event::default()
        .event("task_result")
        .data(payload.to_string())
}

fn build_task_stream_sse(
    state: AppState,
    req: TaskSubmitRequest,
    request_hash: String,
    submission_key: String,
    execution_graph: ExecutionGraph,
    wal: Arc<WalLog>,
    step: AgentStep,
    max_tick_ms: u64,
    deadline_ms: u64,
) -> impl Stream<Item = Result<Event, Infallible>> {
    async_stream::stream! {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Result<Event, Infallible>>();
        tokio::spawn(async move {
            let (_cancel_guard, mut cancel_rx) = register_task_cancellation(&state, req.task_id);
            let wall_start = Instant::now();
            let mut graph_blackboard = initialize_graph_blackboard(&execution_graph, req.resume_checkpoint.as_ref());
            let step_wrapper = RuntimeTaskStep::Agent(step.clone());
            let input_digest: [u8; 32] = Sha256::digest(step_wrapper.input_bytes()).into();

            let wal_entry = match wal.write_intent(step.step_index, step_wrapper.wal_step_type(), input_digest) {
                Ok(entry) => entry,
                Err(e) => {
                    let _ = tx.send(Ok(chat_error_event(format!("WAL write failed: {}", e))));
                    return;
                }
            };

            match execute_agent_step_stream(
                tx.clone(),
                state.clone(),
                &req,
                &step,
                &step_wrapper,
                &wal,
                wal_entry.entry_id,
                &mut cancel_rx,
                &mut graph_blackboard,
                max_tick_ms,
                deadline_ms,
                wall_start,
            ).await {
                Ok(result) => {
                    let response = TaskSubmitResponse {
                        task_id: req.task_id,
                        steps_completed: 1,
                        steps_total: 1,
                        status: TaskStatus::Completed,
                        checkpoint: result.checkpoint,
                        final_output: Some(result.final_output),
                        usage: Some(result.usage),
                        failure_details: None,
                        execution_envelope: Some(result.execution_envelope),
                        execution_receipt: result.execution_receipt,
                    };
                    let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
                    let _ = tx.send(Ok(task_result_event(&response)));
                    let _ = tx.send(Ok(Event::default().data("[DONE]")));
                }
                Err(error_response) => {
                    let _ = persist_task_record(&state, &submission_key, &request_hash, &error_response.response);
                    let _ = tx.send(Ok(task_result_event(&error_response.response)));
                    let _ = tx.send(Ok(chat_error_event(error_response.client_message)));
                    let _ = tx.send(Ok(Event::default().data("[DONE]")));
                }
            }
        });

        while let Some(event) = rx.recv().await {
            yield event;
        }
    }
}

struct StreamCompletionResult {
    final_output: String,
    usage: ExecuteUsage,
    checkpoint: Option<CheckpointPayload>,
    execution_envelope: serde_json::Value,
    execution_receipt: Option<serde_json::Value>,
}

struct StreamFailureResult {
    response: TaskSubmitResponse,
    client_message: String,
}

fn runtime_execution_failure_details(
    rejection_type: &str,
    message: impl Into<String>,
    step: Option<&RuntimeTaskStep>,
) -> TaskFailureDetails {
    let message = message.into();
    TaskFailureDetails {
        source: "runtime".to_string(),
        operation: "execution".to_string(),
        rejection_type: rejection_type.to_string(),
        message,
        step_index: step.map(RuntimeTaskStep::step_index),
        domain: step.map(|step| step.domain_name().to_string()),
        node_id: step.map(|step| step.node_id().to_string()),
    }
}

fn build_checkpoint(
    wal: &WalLog,
    task_id: Uuid,
    last_committed_step: u32,
    runtime_id: String,
    wal_entries: Vec<WalEntry>,
    metadata: Option<serde_json::Value>,
) -> anyhow::Result<CheckpointPayload> {
    let checkpoint_digest = wal
        .compute_checkpoint_digest()
        .map_err(|e| anyhow::anyhow!("WAL digest computation failed: {}", e))?;

    Ok(CheckpointPayload {
        task_id,
        resume_token: ResumeToken {
            last_committed_step,
            checkpoint_digest,
            runtime_id,
        },
        wal_entries,
        metadata,
    })
}

fn submission_key(tenant_id: &str, idempotency_key: &str) -> String {
    format!("{}:{}", tenant_id, idempotency_key)
}

fn task_status_key(task_id: Uuid) -> String {
    task_id.to_string()
}

fn encode_checkpoint_digest(digest: &[u8; 32]) -> String {
    digest
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>()
}

fn receipt_string_field(receipt: &serde_json::Value, field: &str) -> Option<String> {
    receipt
        .get(field)
        .and_then(|value| value.as_str())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
}

fn build_receipt_metadata(receipt: Option<&serde_json::Value>) -> Option<serde_json::Value> {
    let receipt = receipt?;
    let mut metadata = serde_json::Map::new();
    metadata.insert("available".to_string(), serde_json::json!(true));

    for field in [
        "execution_id",
        "transaction_id",
        "transaction_hash",
        "previous_hash",
    ] {
        if let Some(value) = receipt_string_field(receipt, field) {
            metadata.insert(field.to_string(), serde_json::json!(value));
        }
    }

    if let Some(receipt_hash) = receipt_string_field(receipt, "receipt_hash")
        .or_else(|| receipt_string_field(receipt, "hash"))
    {
        metadata.insert("receipt_hash".to_string(), serde_json::json!(receipt_hash));
    }

    metadata.insert(
        "signature_present".to_string(),
        serde_json::json!(receipt_string_field(receipt, "signature").is_some()),
    );

    Some(serde_json::Value::Object(metadata))
}

fn build_task_response_snapshot(response: &TaskSubmitResponse) -> serde_json::Value {
    let mut payload = serde_json::json!({
        "task_id": response.task_id,
        "status": response.status,
        "steps_completed": response.steps_completed,
        "steps_total": response.steps_total,
        "checkpoint_persisted": response.checkpoint.is_some(),
        "final_output_available": response.final_output.is_some(),
        "failure_details": response.failure_details,
    });
    if let Some(checkpoint) = response.checkpoint.as_ref() {
        payload["last_step"] = serde_json::json!(checkpoint.resume_token.last_committed_step);
        payload["checkpoint_digest"] = serde_json::json!(encode_checkpoint_digest(
            &checkpoint.resume_token.checkpoint_digest
        ));
    }
    if let Some(receipt) = build_receipt_metadata(response.execution_receipt.as_ref()) {
        payload["receipt"] = receipt;
    }
    payload
}

fn build_idempotency_conflict_payload(response: &TaskSubmitResponse) -> serde_json::Value {
    serde_json::json!({
        "error": {
            "message": "Idempotency key already used for a different task submission",
            "type": "idempotency_conflict"
        },
        "task": build_task_response_snapshot(response),
    })
}

fn build_stream_replay_unavailable_payload(response: &TaskSubmitResponse) -> serde_json::Value {
    serde_json::json!({
        "error": {
            "message": "Streaming replay is only available for completed task submissions with final output",
            "type": "stream_replay_unavailable"
        },
        "task": build_task_response_snapshot(response),
        "durability": stream_durability_metadata(Some(response)),
    })
}

fn build_checkpoint_mismatch_payload(
    task_id: Uuid,
    requested_resume_from: &ResumeToken,
    local_last_committed_step: Option<u32>,
    local_checkpoint_digest: [u8; 32],
    resume_checkpoint_provided: bool,
) -> serde_json::Value {
    serde_json::json!({
        "error": {
            "message": "Checkpoint digest mismatch — WAL state diverged",
            "type": "checkpoint_mismatch"
        },
        "task_id": task_id,
        "resume": {
            "requested": true,
            "resume_checkpoint_provided": resume_checkpoint_provided,
            "requested_resume_from": requested_resume_from,
            "local_last_committed_step": local_last_committed_step,
            "local_checkpoint_digest": encode_checkpoint_digest(&local_checkpoint_digest),
        },
    })
}

fn verified_resume_start_step(
    requested_resume_from: &ResumeToken,
    local_last_committed_step: Option<u32>,
    local_checkpoint_digest: [u8; 32],
) -> Option<u32> {
    if local_checkpoint_digest != requested_resume_from.checkpoint_digest {
        return None;
    }
    if local_last_committed_step.unwrap_or(0) != requested_resume_from.last_committed_step {
        return None;
    }
    Some(requested_resume_from.last_committed_step + 1)
}

fn persist_task_record(
    state: &AppState,
    submission_key: &str,
    request_hash: &str,
    response: &TaskSubmitResponse,
) -> anyhow::Result<()> {
    state.storage.set(
        TASK_SUBMISSIONS,
        submission_key,
        &IdempotentTaskRecord {
            request_hash: request_hash.to_string(),
            response: response.clone(),
        },
    )?;
    persist_task_status_index(&state.storage, response)
}

fn persist_task_status_index(
    storage: &igris_core::storage::RedbStorage,
    response: &TaskSubmitResponse,
) -> anyhow::Result<()> {
    storage.set(
        TASK_SUBMISSION_STATUS_BY_TASK_ID,
        &task_status_key(response.task_id),
        response,
    )
}

fn build_task_cancel_response(
    task_id: Uuid,
    canceled: bool,
    persisted: Option<&TaskSubmitResponse>,
) -> (StatusCode, serde_json::Value) {
    if canceled {
        return (
            StatusCode::ACCEPTED,
            serde_json::json!({
                "task_id": task_id,
                "canceled": true,
                "known": true,
                "active_execution": true,
                "cancellation_allowed": true,
                "reason": "cancel_signaled",
            }),
        );
    }

    if let Some(response) = persisted {
        let reason = match response.status {
            TaskStatus::Completed => "task_execution_completed",
            TaskStatus::Checkpointed { .. } => "task_execution_checkpointed",
            TaskStatus::Failed { .. } => "task_execution_failed",
        };
        let mut payload = serde_json::json!({
            "task_id": task_id,
            "canceled": false,
            "known": true,
            "active_execution": false,
            "cancellation_allowed": false,
            "reason": reason,
            "status": response.status,
            "checkpoint_persisted": response.checkpoint.is_some(),
            "failure_details": response.failure_details,
            "durability": stream_durability_metadata(Some(response)),
        });
        if let Some(checkpoint) = response.checkpoint.as_ref() {
            payload["last_step"] = serde_json::json!(checkpoint.resume_token.last_committed_step);
            payload["checkpoint_digest"] = serde_json::json!(encode_checkpoint_digest(
                &checkpoint.resume_token.checkpoint_digest
            ));
        }
        return (StatusCode::CONFLICT, payload);
    }

    (
        StatusCode::NOT_FOUND,
        serde_json::json!({
            "task_id": task_id,
            "canceled": false,
            "known": false,
            "active_execution": false,
            "cancellation_allowed": false,
            "reason": "task_execution_not_found",
        }),
    )
}

fn normalize_agent_mode(mode: Option<&str>) -> anyhow::Result<AgentExecutionMode> {
    match mode.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok(AgentExecutionMode::Default),
        Some("council") => Ok(AgentExecutionMode::Council),
        Some("speculative" | "latency") => Ok(AgentExecutionMode::Latency),
        Some("balanced") => Ok(AgentExecutionMode::Balanced),
        Some("quality") => Ok(AgentExecutionMode::Quality),
        Some("cost") => Ok(AgentExecutionMode::Cost),
        Some("thompson") => Ok(AgentExecutionMode::Thompson),
        Some(other) => anyhow::bail!("unsupported task execution mode '{}'", other),
    }
}

fn provider_score_for_mode(provider: &CloudProviderWrapper, mode: AgentExecutionMode) -> f64 {
    let average_cost = provider.0.average_cost_per_1k();
    let fast = provider.0.has_capability("fast") as i32 as f64;
    let reasoning = provider.0.has_capability("reasoning") as i32 as f64;
    let coding = provider.0.has_capability("coding") as i32 as f64;
    let long_context = provider.0.has_capability("long_context") as i32 as f64;
    let cost_effective = provider.0.has_capability("cost_effective") as i32 as f64;
    let realtime = provider.0.has_capability("realtime") as i32 as f64;
    let premium_name = (provider.0.id().contains("opus")
        || provider.0.id().contains("gpt4")
        || provider.0.id().contains("sonnet")
        || provider.0.id().contains("large")
        || provider.0.id().contains("pro")) as i32 as f64;

    match mode {
        AgentExecutionMode::Default | AgentExecutionMode::Latency => {
            fast * 12.0 + realtime * 8.0 + cost_effective * 4.0 - average_cost * 250.0
        }
        AgentExecutionMode::Balanced => {
            fast * 6.0 + reasoning * 7.0 + coding * 3.0 + long_context * 2.0 + cost_effective * 4.0
                - average_cost * 140.0
        }
        AgentExecutionMode::Quality => {
            reasoning * 12.0 + coding * 6.0 + long_context * 5.0 + premium_name * 4.0
                - average_cost * 45.0
        }
        AgentExecutionMode::Cost => {
            cost_effective * 12.0 + fast * 3.0 + realtime * 2.0 - average_cost * 600.0
        }
        AgentExecutionMode::Thompson | AgentExecutionMode::Council => 0.0,
    }
}

fn ranked_cloud_providers(state: &AppState, mode: AgentExecutionMode) -> Vec<CloudProviderWrapper> {
    let mut providers: Vec<CloudProviderWrapper> = state
        .cloud_providers
        .iter()
        .map(|provider| CloudProviderWrapper(provider.clone()))
        .collect();

    if matches!(
        mode,
        AgentExecutionMode::Default
            | AgentExecutionMode::Latency
            | AgentExecutionMode::Balanced
            | AgentExecutionMode::Quality
            | AgentExecutionMode::Cost
    ) {
        providers.sort_by(|left, right| {
            provider_score_for_mode(right, mode)
                .partial_cmp(&provider_score_for_mode(left, mode))
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    providers.truncate(3);
    providers
}

async fn select_thompson_provider(state: &AppState) -> Option<CloudProviderWrapper> {
    if state.cloud_providers.is_empty() {
        return None;
    }

    let selected_id = state.thompson_router.select_provider().await.ok();
    if let Some(selected_id) = selected_id {
        if let Some(provider) = state
            .cloud_providers
            .iter()
            .find(|provider| provider.id() == selected_id)
        {
            return Some(CloudProviderWrapper(provider.clone()));
        }
    }

    state
        .cloud_providers
        .first()
        .cloned()
        .map(CloudProviderWrapper)
}

async fn update_thompson_reward(
    state: &AppState,
    provider_id: &str,
    started_at: Instant,
    success: bool,
) {
    let _ = state
        .thompson_router
        .update_reward(
            provider_id,
            started_at.elapsed().as_millis() as f64,
            success,
            0.0,
        )
        .await;
}

fn materialize_execution_graph(task_type: &TaskType) -> anyhow::Result<ExecutionGraph> {
    match task_type {
        TaskType::ExecutionGraph { graph } => Ok(graph.clone()),
        TaskType::AgentWorkflow { steps } => Ok(ExecutionGraph {
            graph_id: Some("agent_workflow".to_string()),
            blackboard: None,
            nodes: steps
                .iter()
                .map(|step| ExecutionNode::Reason {
                    node_id: step
                        .node_id
                        .clone()
                        .unwrap_or_else(|| format!("agent-step-{}", step.step_index)),
                    step_index: Some(step.step_index),
                    checkpoint_key: step.checkpoint_key.clone(),
                    read_slots: step.read_slots.clone(),
                    write_slot: step.write_slot.clone(),
                    model: step.model.clone(),
                    messages: step.messages.clone(),
                    max_tokens: step.max_tokens,
                    temperature: step.temperature,
                    mode: step.mode.clone(),
                    memory: step.memory.clone(),
                    approval: step.approval.clone(),
                })
                .collect(),
        }),
        TaskType::RoboticsWorkflow { steps } => Ok(ExecutionGraph {
            graph_id: Some("robotics_workflow".to_string()),
            blackboard: None,
            nodes: steps
                .iter()
                .map(|step| ExecutionNode::Robotics {
                    node_id: step
                        .node_id
                        .clone()
                        .unwrap_or_else(|| format!("robotics-step-{}", step.step_index)),
                    step_index: Some(step.step_index),
                    checkpoint_key: step.checkpoint_key.clone(),
                    read_slots: step.read_slots.clone(),
                    write_slot: step.write_slot.clone(),
                    action: step.action.clone(),
                    approval: step.approval.clone(),
                })
                .collect(),
        }),
        TaskType::SingleInference {
            model,
            messages,
            max_tokens,
            temperature,
            mode,
            memory,
            approval,
            ..
        } => Ok(ExecutionGraph {
            graph_id: Some("single_inference".to_string()),
            blackboard: None,
            nodes: vec![ExecutionNode::Reason {
                node_id: "reason-0".to_string(),
                step_index: Some(0),
                checkpoint_key: Some("single_inference".to_string()),
                read_slots: None,
                write_slot: None,
                model: model.clone(),
                messages: messages.clone(),
                max_tokens: *max_tokens,
                temperature: *temperature,
                mode: mode.clone(),
                memory: memory.clone(),
                approval: approval.clone(),
            }],
        }),
        TaskType::BehaviorTree { .. } => {
            anyhow::bail!("behavior_tree tasks are executed through the dedicated BT path")
        }
    }
}

fn compile_execution_graph_to_steps(
    graph: &ExecutionGraph,
) -> anyhow::Result<Vec<RuntimeTaskStep>> {
    let mut steps = Vec::with_capacity(graph.nodes.len());
    for (idx, node) in graph.nodes.iter().enumerate() {
        let fallback_step_index = idx as u32;
        let step = match node {
            ExecutionNode::Reason {
                node_id,
                step_index: graph_step_index,
                checkpoint_key,
                read_slots,
                write_slot,
                model,
                messages,
                max_tokens,
                temperature,
                mode,
                memory,
                approval,
            } => RuntimeTaskStep::Agent(AgentStep {
                step_index: graph_step_index.unwrap_or(fallback_step_index),
                node_id: Some(node_id.clone()),
                checkpoint_key: checkpoint_key.clone(),
                read_slots: read_slots.clone(),
                write_slot: write_slot.clone(),
                model: model.clone(),
                messages: messages.clone(),
                max_tokens: *max_tokens,
                temperature: *temperature,
                mode: mode.clone(),
                memory: memory.clone(),
                approval: approval.clone(),
            }),
            ExecutionNode::Robotics {
                node_id,
                step_index: graph_step_index,
                checkpoint_key,
                read_slots,
                write_slot,
                action,
                approval,
            } => RuntimeTaskStep::Robotics(RoboticsStep {
                step_index: graph_step_index.unwrap_or(fallback_step_index),
                node_id: Some(node_id.clone()),
                checkpoint_key: checkpoint_key.clone(),
                read_slots: read_slots.clone(),
                write_slot: write_slot.clone(),
                action: action.clone(),
                approval: approval.clone(),
            }),
            ExecutionNode::Tool { .. } => {
                let (node_id, tool_name, args, checkpoint_key, read_slots, write_slot) = match node
                {
                    ExecutionNode::Tool {
                        node_id,
                        tool_name,
                        args,
                        checkpoint_key,
                        read_slots,
                        write_slot,
                    } => (
                        node_id,
                        tool_name,
                        args,
                        checkpoint_key,
                        read_slots,
                        write_slot,
                    ),
                    _ => unreachable!(),
                };
                RuntimeTaskStep::Tool(ToolStep {
                    step_index: fallback_step_index,
                    node_id: node_id.clone(),
                    checkpoint_key: checkpoint_key.clone(),
                    read_slots: read_slots.clone(),
                    write_slot: write_slot.clone(),
                    tool_name: tool_name.clone(),
                    args: args.clone(),
                })
            }
            ExecutionNode::BehaviorTree { .. } => {
                let (node_id, checkpoint_key, read_slots, write_slot, tree) = match node {
                    ExecutionNode::BehaviorTree {
                        node_id,
                        checkpoint_key,
                        read_slots,
                        write_slot,
                        tree,
                    } => (node_id, checkpoint_key, read_slots, write_slot, tree),
                    _ => unreachable!(),
                };
                RuntimeTaskStep::BehaviorTree(BehaviorTreeStep {
                    step_index: fallback_step_index,
                    node_id: node_id.clone(),
                    checkpoint_key: checkpoint_key.clone(),
                    read_slots: read_slots.clone(),
                    write_slot: write_slot.clone(),
                    blackboard: graph.blackboard.clone(),
                    tree: tree.clone(),
                })
            }
            ExecutionNode::HumanApproval { .. } => {
                let (node_id, checkpoint_key, read_slots, write_slot, task, confidence, context) =
                    match node {
                        ExecutionNode::HumanApproval {
                            node_id,
                            checkpoint_key,
                            read_slots,
                            write_slot,
                            task,
                            confidence,
                            context,
                        } => (
                            node_id,
                            checkpoint_key,
                            read_slots,
                            write_slot,
                            task,
                            confidence,
                            context,
                        ),
                        _ => unreachable!(),
                    };
                RuntimeTaskStep::HumanApproval(HumanApprovalStep {
                    step_index: fallback_step_index,
                    node_id: node_id.clone(),
                    checkpoint_key: checkpoint_key.clone(),
                    read_slots: read_slots.clone(),
                    write_slot: write_slot.clone(),
                    task: task.clone(),
                    confidence: *confidence,
                    context: context.clone(),
                })
            }
            ExecutionNode::MemoryRecall { .. } => {
                let (node_id, checkpoint_key, read_slots, write_slot, query, top_k) = match node {
                    ExecutionNode::MemoryRecall {
                        node_id,
                        checkpoint_key,
                        read_slots,
                        write_slot,
                        query,
                        top_k,
                    } => (
                        node_id,
                        checkpoint_key,
                        read_slots,
                        write_slot,
                        query,
                        top_k,
                    ),
                    _ => unreachable!(),
                };
                RuntimeTaskStep::MemoryRecall(MemoryRecallStep {
                    step_index: fallback_step_index,
                    node_id: node_id.clone(),
                    checkpoint_key: checkpoint_key.clone(),
                    read_slots: read_slots.clone(),
                    write_slot: write_slot.clone(),
                    query: query.clone(),
                    top_k: *top_k,
                })
            }
            ExecutionNode::MemoryStore { .. } => {
                let (node_id, checkpoint_key, read_slots, write_slot, key, content) = match node {
                    ExecutionNode::MemoryStore {
                        node_id,
                        checkpoint_key,
                        read_slots,
                        write_slot,
                        key,
                        content,
                    } => (
                        node_id,
                        checkpoint_key,
                        read_slots,
                        write_slot,
                        key,
                        content,
                    ),
                    _ => unreachable!(),
                };
                RuntimeTaskStep::MemoryStore(MemoryStoreStep {
                    step_index: fallback_step_index,
                    node_id: node_id.clone(),
                    checkpoint_key: checkpoint_key.clone(),
                    read_slots: read_slots.clone(),
                    write_slot: write_slot.clone(),
                    key: key.clone(),
                    content: content.clone(),
                })
            }
        };
        steps.push(step);
    }
    Ok(steps)
}

fn initialize_graph_blackboard(
    execution_graph: &ExecutionGraph,
    resume_checkpoint: Option<&serde_json::Value>,
) -> serde_json::Value {
    if let Some(graph_blackboard) =
        resume_checkpoint.and_then(|checkpoint| checkpoint.get("graph_blackboard"))
    {
        return graph_blackboard.clone();
    }

    match execution_graph.blackboard.clone() {
        Some(serde_json::Value::Object(_)) => execution_graph.blackboard.clone().unwrap(),
        Some(value) => serde_json::json!({ "initial": value }),
        None => serde_json::json!({}),
    }
}

fn resolve_graph_value(
    value: serde_json::Value,
    graph_blackboard: &serde_json::Value,
) -> serde_json::Value {
    match value {
        serde_json::Value::String(template) => {
            resolve_graph_string_value(&template, graph_blackboard)
        }
        serde_json::Value::Array(values) => serde_json::Value::Array(
            values
                .into_iter()
                .map(|value| resolve_graph_value(value, graph_blackboard))
                .collect(),
        ),
        serde_json::Value::Object(map) => serde_json::Value::Object(
            map.into_iter()
                .map(|(key, value)| (key, resolve_graph_value(value, graph_blackboard)))
                .collect(),
        ),
        other => other,
    }
}

fn resolve_graph_string_value(
    template: &str,
    graph_blackboard: &serde_json::Value,
) -> serde_json::Value {
    if let Some(path) = extract_exact_placeholder(template) {
        return graph_lookup(graph_blackboard, path)
            .cloned()
            .unwrap_or_else(|| serde_json::Value::String(template.to_string()));
    }

    serde_json::Value::String(render_graph_string(template, graph_blackboard))
}

fn extract_exact_placeholder(template: &str) -> Option<&str> {
    template
        .strip_prefix("${")
        .and_then(|rest| rest.strip_suffix('}'))
        .filter(|path| !path.is_empty())
}

fn render_graph_string(template: &str, graph_blackboard: &serde_json::Value) -> String {
    let mut rendered = String::with_capacity(template.len());
    let mut cursor = template;

    while let Some(start) = cursor.find("${") {
        rendered.push_str(&cursor[..start]);
        let placeholder = &cursor[start + 2..];
        if let Some(end) = placeholder.find('}') {
            let path = &placeholder[..end];
            if let Some(value) = graph_lookup(graph_blackboard, path) {
                rendered.push_str(&graph_value_to_string(value));
            }
            cursor = &placeholder[end + 1..];
        } else {
            rendered.push_str(&cursor[start..]);
            cursor = "";
            break;
        }
    }

    rendered.push_str(cursor);
    rendered
}

fn graph_lookup<'a>(
    graph_blackboard: &'a serde_json::Value,
    path: &str,
) -> Option<&'a serde_json::Value> {
    if let Some(slot_name) = path.strip_prefix("slots.") {
        if let Some(value) = graph_lookup_slot(graph_blackboard, slot_name) {
            return Some(value);
        }
    }

    let mut current = graph_blackboard;
    for segment in path.split('.') {
        current = match current {
            serde_json::Value::Object(map) => map.get(segment)?,
            _ => return None,
        };
    }
    Some(current)
}

fn graph_value_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(boolean) => boolean.to_string(),
        serde_json::Value::Number(number) => number.to_string(),
        serde_json::Value::String(text) => text.clone(),
        other => serde_json::to_string(other).unwrap_or_default(),
    }
}

fn resolve_execute_messages(
    messages: &[ExecuteMessage],
    graph_blackboard: &serde_json::Value,
) -> Vec<ExecuteMessage> {
    messages
        .iter()
        .map(|message| ExecuteMessage {
            role: message.role.clone(),
            content: match resolve_graph_string_value(&message.content, graph_blackboard) {
                serde_json::Value::String(text) => text,
                other => graph_value_to_string(&other),
            },
        })
        .collect()
}

fn collect_slot_inputs(
    graph_blackboard: &serde_json::Value,
    read_slots: Option<&[String]>,
) -> Option<serde_json::Value> {
    let read_slots = read_slots?;
    if read_slots.is_empty() {
        return None;
    }

    let mut collected = serde_json::Map::new();
    for slot in read_slots {
        if let Some(value) = graph_lookup_slot(graph_blackboard, slot) {
            collected.insert(slot.clone(), value.clone());
        }
    }

    if collected.is_empty() {
        None
    } else {
        Some(serde_json::Value::Object(collected))
    }
}

fn graph_lookup_slot<'a>(
    graph_blackboard: &'a serde_json::Value,
    slot: &str,
) -> Option<&'a serde_json::Value> {
    let slots = graph_blackboard
        .as_object()
        .and_then(|root| root.get("slots"))
        .and_then(|slots| slots.as_object())?;

    if let Some(value) = slots.get(slot) {
        return Some(value);
    }

    let mut current = slots;
    let mut value: Option<&serde_json::Value> = None;
    for segment in slot.split('.') {
        let next = current.get(segment)?;
        value = Some(next);
        current = match next.as_object() {
            Some(map) => map,
            None => break,
        };
    }

    value
}

fn update_graph_blackboard(
    graph_blackboard: &mut serde_json::Value,
    step: &RuntimeTaskStep,
    result: &StepExecutionResult,
) {
    let output_value = result
        .graph_output
        .clone()
        .or_else(|| serde_json::from_str::<serde_json::Value>(&result.output_text).ok())
        .unwrap_or_else(|| serde_json::Value::String(result.output_text.clone()));
    let slot_value = output_value.clone();
    let node_id = step.node_id().to_string();
    ensure_graph_blackboard_object(graph_blackboard);
    let root = graph_blackboard
        .as_object_mut()
        .expect("graph blackboard should be an object");
    root.insert(
        "last_node_id".to_string(),
        serde_json::Value::String(node_id.clone()),
    );
    root.insert(
        "last_provider".to_string(),
        serde_json::Value::String(result.provider_name.clone()),
    );
    root.insert("last_output".to_string(), output_value.clone());
    let nodes = root
        .entry("nodes".to_string())
        .or_insert_with(|| serde_json::json!({}));
    if let Some(nodes_object) = nodes.as_object_mut() {
        nodes_object.insert(node_id, output_value);
    }
    if let Some(write_slot) = step.write_slot() {
        let slots = root
            .entry("slots".to_string())
            .or_insert_with(|| serde_json::json!({}));
        if let Some(slots_object) = slots.as_object_mut() {
            slots_object.insert(write_slot.to_string(), slot_value);
        }
    }
}

fn ensure_graph_blackboard_object(graph_blackboard: &mut serde_json::Value) {
    if !graph_blackboard.is_object() {
        let initial = graph_blackboard.clone();
        *graph_blackboard = serde_json::json!({ "initial": initial });
    }
}

fn attach_graph_blackboard_metadata(
    checkpoint_metadata: &mut Option<serde_json::Value>,
    graph_blackboard: &serde_json::Value,
) {
    match checkpoint_metadata {
        Some(metadata) => merge_checkpoint_metadata(
            metadata,
            &serde_json::json!({
                "graph_blackboard": graph_blackboard
            }),
        ),
        None => {
            *checkpoint_metadata = Some(serde_json::json!({
                "graph_blackboard": graph_blackboard
            }));
        }
    }
}

async fn do_route(
    state: AppState,
    prompt: String,
    mode: Option<&str>,
) -> anyhow::Result<(String, String)> {
    use igris_routing::Provider;

    let execution_mode = normalize_agent_mode(mode)?;

    if !state.cloud_providers.is_empty() {
        match execution_mode {
            AgentExecutionMode::Default
            | AgentExecutionMode::Latency
            | AgentExecutionMode::Balanced
            | AgentExecutionMode::Quality
            | AgentExecutionMode::Cost => {
                let providers = ranked_cloud_providers(&state, execution_mode);
                if let Ok(result) = state.speculative_router.route(&prompt, providers).await {
                    return Ok((result.response, result.winner_id));
                }
            }
            AgentExecutionMode::Thompson => {
                if let Some(provider) = select_thompson_provider(&state).await {
                    let provider_id = provider.id().to_string();
                    let started_at = Instant::now();
                    match provider.complete(&prompt).await {
                        Ok(response) => {
                            update_thompson_reward(&state, &provider_id, started_at, true).await;
                            return Ok((response, provider_id));
                        }
                        Err(err) => {
                            update_thompson_reward(&state, &provider_id, started_at, false).await;
                            warn!(provider_id = %provider_id, error = %err, "thompson-selected provider failed");
                        }
                    }
                }
            }
            AgentExecutionMode::Council => {
                let providers = ranked_cloud_providers(&state, AgentExecutionMode::Quality);
                if let Ok(result) = state.council_router.route(&prompt, providers.clone()).await {
                    return Ok((result.response, result.chairman_id));
                }

                if let Some(chairman_id) =
                    providers.first().map(|provider| provider.id().to_string())
                {
                    warn!(
                        chairman_id = %chairman_id,
                        "Configured council route unavailable for current providers; falling back to first available provider as chairman"
                    );
                    let fallback_router = igris_routing::CouncilRouter::new(chairman_id);
                    if let Ok(result) = fallback_router.route(&prompt, providers).await {
                        return Ok((result.response, result.chairman_id));
                    }
                }
            }
        }
    }

    if let Some(local) = &state.local_provider {
        let content = local.complete(&prompt).await?;
        return Ok((content, "local".to_string()));
    }

    anyhow::bail!("No providers available")
}

async fn do_route_stream(
    state: AppState,
    prompt: String,
    mode: Option<&str>,
) -> anyhow::Result<(
    Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>,
    String,
)> {
    use igris_routing::Provider;

    let execution_mode = normalize_agent_mode(mode)?;

    if !state.cloud_providers.is_empty() {
        match execution_mode {
            AgentExecutionMode::Default
            | AgentExecutionMode::Latency
            | AgentExecutionMode::Balanced
            | AgentExecutionMode::Quality
            | AgentExecutionMode::Cost => {
                let providers = ranked_cloud_providers(&state, execution_mode);
                if let Ok(result) = state
                    .speculative_router
                    .route_stream(&prompt, providers)
                    .await
                {
                    return Ok((result.stream, result.winner_id));
                }
            }
            AgentExecutionMode::Thompson => {
                if let Some(provider) = select_thompson_provider(&state).await {
                    let provider_id = provider.id().to_string();
                    let started_at = Instant::now();
                    match provider.stream(&prompt).await {
                        Ok(mut inner_stream) => {
                            let state_for_reward = state.clone();
                            let provider_id_for_stream = provider_id.clone();
                            let wrapped = async_stream::try_stream! {
                                while let Some(chunk) = inner_stream.next().await {
                                    match chunk {
                                        Ok(text) => yield text,
                                        Err(err) => {
                                            update_thompson_reward(&state_for_reward, &provider_id_for_stream, started_at, false).await;
                                            Err(err)?;
                                        }
                                    }
                                }
                                update_thompson_reward(&state_for_reward, &provider_id_for_stream, started_at, true).await;
                            };
                            return Ok((Box::pin(wrapped), provider_id));
                        }
                        Err(err) => {
                            update_thompson_reward(&state, &provider_id, started_at, false).await;
                            warn!(provider_id = %provider_id, error = %err, "thompson-selected provider stream failed");
                        }
                    }
                }
            }
            AgentExecutionMode::Council => {
                let (response, chairman_id) =
                    do_route(state.clone(), prompt.clone(), Some("council")).await?;
                let response_stream = stream::once(async move { Ok(response) });
                let response_stream: Pin<
                    Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>,
                > = Box::pin(response_stream);
                return Ok((response_stream, chairman_id));
            }
        }
    }

    if let Some(local) = &state.local_provider {
        let stream = local.stream(&prompt).await?;
        return Ok((stream, "local".to_string()));
    }

    anyhow::bail!("No providers available")
}

async fn execute_agent_step_stream(
    tx: tokio::sync::mpsc::UnboundedSender<Result<Event, Infallible>>,
    state: AppState,
    req: &TaskSubmitRequest,
    step: &AgentStep,
    step_wrapper: &RuntimeTaskStep,
    wal: &Arc<WalLog>,
    wal_entry_id: Uuid,
    cancel_rx: &mut watch::Receiver<bool>,
    graph_blackboard: &mut serde_json::Value,
    max_tick_ms: u64,
    deadline_ms: u64,
    wall_start: Instant,
) -> Result<StreamCompletionResult, StreamFailureResult> {
    if is_task_canceled(cancel_rx) {
        let reason = task_cancellation_reason(req.task_id);
        let _ = wal.write_failed(wal_entry_id, reason.clone());
        return Err(StreamFailureResult {
            response: TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed: 0,
                steps_total: 1,
                status: TaskStatus::Failed {
                    reason: reason.clone(),
                },
                checkpoint: None,
                final_output: None,
                usage: None,
                failure_details: Some(runtime_execution_failure_details(
                    "task_canceled",
                    reason.clone(),
                    Some(step_wrapper),
                )),
                execution_envelope: None,
                execution_receipt: None,
            },
            client_message: reason,
        });
    }
    let resolved_messages = resolve_execute_messages(&step.messages, graph_blackboard);
    let slot_inputs = collect_slot_inputs(graph_blackboard, step.read_slots.as_deref());
    let mut base_prompt = resolved_messages
        .iter()
        .map(|message| format!("{}: {}", message.role, message.content))
        .collect::<Vec<_>>()
        .join("\n");
    if let Some(slot_context) = slot_inputs.as_ref() {
        base_prompt = format!(
            "slot_inputs: {}\n\n{}",
            serde_json::to_string(slot_context).unwrap_or_default(),
            base_prompt
        );
    } else if let Some(blackboard_context) = graph_blackboard
        .as_object()
        .filter(|state| !state.is_empty())
    {
        base_prompt = format!(
            "graph_blackboard: {}\n\n{}",
            serde_json::to_string(blackboard_context).unwrap_or_default(),
            base_prompt
        );
    }

    if let Err(e) = maybe_require_step_approval(
        &state,
        req.task_id,
        &req.tenant_id,
        step.step_index,
        &step.model,
        "agent-step",
        step.approval.as_ref(),
        max_tick_ms,
    )
    .await
    {
        let _ = wal.write_failed(wal_entry_id, e.to_string());
        return Err(StreamFailureResult {
            response: TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed: 0,
                steps_total: 1,
                status: TaskStatus::Failed {
                    reason: format!("Step {} failed: {}", step.step_index, e),
                },
                checkpoint: None,
                final_output: None,
                usage: None,
                failure_details: Some(runtime_execution_failure_details(
                    "step_failed",
                    e.to_string(),
                    Some(step_wrapper),
                )),
                execution_envelope: None,
                execution_receipt: None,
            },
            client_message: e.to_string(),
        });
    }

    let prompt = match prepare_agent_prompt(&state, req.task_id, step, base_prompt.clone()).await {
        Ok(prompt) => prompt,
        Err(e) => {
            let _ = wal.write_failed(wal_entry_id, e.to_string());
            return Err(StreamFailureResult {
                response: TaskSubmitResponse {
                    task_id: req.task_id,
                    steps_completed: 0,
                    steps_total: 1,
                    status: TaskStatus::Failed {
                        reason: format!("Step {} failed: {}", step.step_index, e),
                    },
                    checkpoint: None,
                    final_output: None,
                    usage: None,
                    failure_details: Some(runtime_execution_failure_details(
                        "step_failed",
                        e.to_string(),
                        Some(step_wrapper),
                    )),
                    execution_envelope: None,
                    execution_receipt: None,
                },
                client_message: e.to_string(),
            });
        }
    };

    let (mut stream, provider_name) =
        match do_route_stream(state.clone(), prompt, step.mode.as_deref()).await {
            Ok(result) => result,
            Err(e) => {
                let _ = wal.write_failed(wal_entry_id, e.to_string());
                return Err(StreamFailureResult {
                    response: TaskSubmitResponse {
                        task_id: req.task_id,
                        steps_completed: 0,
                        steps_total: 1,
                        status: TaskStatus::Failed {
                            reason: format!("Step {} failed: {}", step.step_index, e),
                        },
                        checkpoint: None,
                        final_output: None,
                        usage: None,
                        failure_details: Some(runtime_execution_failure_details(
                            "step_failed",
                            e.to_string(),
                            Some(step_wrapper),
                        )),
                        execution_envelope: None,
                        execution_receipt: None,
                    },
                    client_message: e.to_string(),
                });
            }
        };

    let timeout = tokio::time::sleep(Duration::from_millis(max_tick_ms));
    tokio::pin!(timeout);
    let mut content = String::new();

    loop {
        let next_chunk = tokio::select! {
            changed = cancel_rx.changed() => {
                if changed.is_ok() && is_task_canceled(cancel_rx) {
                    let reason = task_cancellation_reason(req.task_id);
                    let _ = wal.write_failed(wal_entry_id, reason.clone());
                    return Err(StreamFailureResult {
                        response: TaskSubmitResponse {
                            task_id: req.task_id,
                            steps_completed: 0,
                            steps_total: 1,
                            status: TaskStatus::Failed { reason: reason.clone() },
                            checkpoint: None,
                            final_output: None,
                            usage: None,
                            failure_details: Some(runtime_execution_failure_details(
                                "task_canceled",
                                reason.clone(),
                                Some(step_wrapper),
                            )),
                            execution_envelope: None,
                            execution_receipt: None,
                        },
                        client_message: reason,
                    });
                }
                continue;
            }
            _ = &mut timeout => {
                let reason = format!("timeout after {}ms", max_tick_ms);
                let _ = wal.write_failed(wal_entry_id, reason.clone());
                return Err(StreamFailureResult {
                    response: TaskSubmitResponse {
                        task_id: req.task_id,
                        steps_completed: 0,
                        steps_total: 1,
                        status: TaskStatus::Failed { reason: format!("Step {} failed: {}", step.step_index, reason) },
                        checkpoint: None,
                        final_output: None,
                        usage: None,
                        failure_details: Some(runtime_execution_failure_details(
                            "timeout",
                            reason.clone(),
                            Some(step_wrapper),
                        )),
                        execution_envelope: None,
                        execution_receipt: None,
                    },
                    client_message: reason,
                });
            }
            next = stream.next() => next,
        };

        match next_chunk {
            Some(Ok(chunk)) => {
                content.push_str(&chunk);
                let _ = tx.send(Ok(chat_chunk_event(&step.model, &chunk)));
            }
            Some(Err(e)) => {
                let reason = e.to_string();
                let _ = wal.write_failed(wal_entry_id, reason.clone());
                return Err(StreamFailureResult {
                    response: TaskSubmitResponse {
                        task_id: req.task_id,
                        steps_completed: 0,
                        steps_total: 1,
                        status: TaskStatus::Failed {
                            reason: format!("Step {} failed: {}", step.step_index, reason),
                        },
                        checkpoint: None,
                        final_output: None,
                        usage: None,
                        failure_details: Some(runtime_execution_failure_details(
                            "step_failed",
                            reason.clone(),
                            Some(step_wrapper),
                        )),
                        execution_envelope: None,
                        execution_receipt: None,
                    },
                    client_message: reason,
                });
            }
            None => break,
        }
    }

    if wall_start.elapsed().as_millis() as u64 > deadline_ms {
        let reason = format!("deadline exceeded after {}ms", deadline_ms);
        let _ = wal.write_failed(wal_entry_id, reason.clone());
        return Err(StreamFailureResult {
            response: TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed: 0,
                steps_total: 1,
                status: TaskStatus::Failed {
                    reason: format!("Step {} failed: {}", step.step_index, reason),
                },
                checkpoint: None,
                final_output: None,
                usage: None,
                failure_details: Some(runtime_execution_failure_details(
                    "deadline_exceeded",
                    reason.clone(),
                    Some(step_wrapper),
                )),
                execution_envelope: None,
                execution_receipt: None,
            },
            client_message: reason,
        });
    }

    if let Err(e) =
        maybe_store_agent_memory(&state, req.task_id, step, &base_prompt, &content).await
    {
        let _ = wal.write_failed(wal_entry_id, e.to_string());
        return Err(StreamFailureResult {
            response: TaskSubmitResponse {
                task_id: req.task_id,
                steps_completed: 0,
                steps_total: 1,
                status: TaskStatus::Failed {
                    reason: format!("Step {} failed: {}", step.step_index, e),
                },
                checkpoint: None,
                final_output: None,
                usage: None,
                failure_details: Some(runtime_execution_failure_details(
                    "step_failed",
                    e.to_string(),
                    Some(step_wrapper),
                )),
                execution_envelope: None,
                execution_receipt: None,
            },
            client_message: e.to_string(),
        });
    }

    let usage = ExecuteUsage {
        prompt_tokens: resolved_messages
            .iter()
            .map(|message| token_estimate(&message.content))
            .sum(),
        completion_tokens: token_estimate(&content),
        total_tokens: resolved_messages
            .iter()
            .map(|message| token_estimate(&message.content))
            .sum::<u32>()
            + token_estimate(&content),
    };
    let step_result = StepExecutionResult {
        output_text: content.clone(),
        provider_name,
        usage: usage.clone(),
        graph_output: None,
        checkpoint_metadata: None,
        checkpoint_requested: false,
    };
    update_graph_blackboard(graph_blackboard, step_wrapper, &step_result);

    let (execution_envelope, execution_receipt) = match build_execution_artifacts(
        &state,
        req,
        step_wrapper,
        &step_result,
        wall_start.elapsed().as_millis() as u64,
    )
    .await
    {
        Ok(artifacts) => artifacts,
        Err(e) => {
            let _ = wal.write_failed(wal_entry_id, format!("artifact build failed: {}", e));
            return Err(StreamFailureResult {
                response: TaskSubmitResponse {
                    task_id: req.task_id,
                    steps_completed: 0,
                    steps_total: 1,
                    status: TaskStatus::Failed {
                        reason: format!("Step {} failed: {}", step.step_index, e),
                    },
                    checkpoint: None,
                    final_output: None,
                    usage: None,
                    failure_details: Some(runtime_execution_failure_details(
                        "artifact_build_failed",
                        e.to_string(),
                        Some(step_wrapper),
                    )),
                    execution_envelope: None,
                    execution_receipt: None,
                },
                client_message: e.to_string(),
            });
        }
    };

    let output_digest: [u8; 32] = Sha256::digest(content.as_bytes()).into();
    let signing_key = match state.signing_key.as_ref() {
        Some(key) => key,
        None => {
            let reason = "runtime has no signing key".to_string();
            let _ = wal.write_failed(wal_entry_id, reason.clone());
            return Err(StreamFailureResult {
                response: TaskSubmitResponse {
                    task_id: req.task_id,
                    steps_completed: 0,
                    steps_total: 1,
                    status: TaskStatus::Failed {
                        reason: format!("Step {} failed: {}", step.step_index, reason),
                    },
                    checkpoint: None,
                    final_output: None,
                    usage: None,
                    failure_details: Some(runtime_execution_failure_details(
                        "missing_signing_key",
                        reason.clone(),
                        Some(step_wrapper),
                    )),
                    execution_envelope: None,
                    execution_receipt: None,
                },
                client_message: reason,
            });
        }
    };
    let committed_entry =
        match wal.write_committed(wal_entry_id, output_digest, signing_key.as_ref()) {
            Ok(entry) => entry,
            Err(e) => {
                let reason = format!("WAL commit failed: {}", e);
                let _ = wal.write_failed(wal_entry_id, reason.clone());
                return Err(StreamFailureResult {
                    response: TaskSubmitResponse {
                        task_id: req.task_id,
                        steps_completed: 0,
                        steps_total: 1,
                        status: TaskStatus::Failed {
                            reason: format!("Step {} failed: {}", step.step_index, reason),
                        },
                        checkpoint: None,
                        final_output: None,
                        usage: None,
                        failure_details: Some(runtime_execution_failure_details(
                            "wal_commit_failed",
                            reason.clone(),
                            Some(step_wrapper),
                        )),
                        execution_envelope: None,
                        execution_receipt: None,
                    },
                    client_message: reason,
                });
            }
        };

    let mut checkpoint_metadata = Some(build_step_checkpoint_metadata(
        step_wrapper,
        1,
        &step_result,
    ));
    attach_graph_blackboard_metadata(&mut checkpoint_metadata, graph_blackboard);
    let checkpoint = build_checkpoint(
        wal,
        req.task_id,
        step.step_index,
        state.swarm_peer_id.clone(),
        vec![committed_entry],
        checkpoint_metadata,
    )
    .ok();

    Ok(StreamCompletionResult {
        final_output: content,
        usage,
        checkpoint,
        execution_envelope,
        execution_receipt,
    })
}

async fn execute_agent_step(
    state: AppState,
    task_id: Uuid,
    tenant_id: &str,
    step: &AgentStep,
    graph_blackboard: &serde_json::Value,
    max_tick_ms: u64,
) -> anyhow::Result<StepExecutionResult> {
    let _ = step.temperature;
    let resolved_messages = resolve_execute_messages(&step.messages, graph_blackboard);
    let slot_inputs = collect_slot_inputs(graph_blackboard, step.read_slots.as_deref());
    let mut base_prompt = resolved_messages
        .iter()
        .map(|message| format!("{}: {}", message.role, message.content))
        .collect::<Vec<_>>()
        .join("\n");
    if let Some(slot_context) = slot_inputs.as_ref() {
        base_prompt = format!(
            "slot_inputs: {}\n\n{}",
            serde_json::to_string(slot_context).unwrap_or_default(),
            base_prompt
        );
    } else if let Some(blackboard_context) = graph_blackboard
        .as_object()
        .filter(|state| !state.is_empty())
    {
        base_prompt = format!(
            "graph_blackboard: {}\n\n{}",
            serde_json::to_string(blackboard_context).unwrap_or_default(),
            base_prompt
        );
    }
    maybe_require_step_approval(
        &state,
        task_id,
        tenant_id,
        step.step_index,
        &step.model,
        "agent-step",
        step.approval.as_ref(),
        max_tick_ms,
    )
    .await?;
    let prompt = prepare_agent_prompt(&state, task_id, step, base_prompt.clone()).await?;

    match tokio::time::timeout(
        Duration::from_millis(max_tick_ms),
        do_route(state.clone(), prompt, step.mode.as_deref()),
    )
    .await
    {
        Ok(Ok((content, provider_name))) => {
            maybe_store_agent_memory(&state, task_id, step, &base_prompt, &content).await?;
            Ok(StepExecutionResult {
                usage: ExecuteUsage {
                    prompt_tokens: resolved_messages
                        .iter()
                        .map(|message| token_estimate(&message.content))
                        .sum(),
                    completion_tokens: token_estimate(&content),
                    total_tokens: resolved_messages
                        .iter()
                        .map(|message| token_estimate(&message.content))
                        .sum::<u32>()
                        + token_estimate(&content),
                },
                output_text: content,
                provider_name,
                graph_output: None,
                checkpoint_metadata: None,
                checkpoint_requested: false,
            })
        }
        Ok(Err(e)) => Err(e),
        Err(_) => anyhow::bail!("timeout after {}ms", max_tick_ms),
    }
}

async fn execute_robotics_step(
    state: AppState,
    task_id: Uuid,
    tenant_id: &str,
    step: &RoboticsStep,
    graph_blackboard: &serde_json::Value,
    containment: Option<&Bounds>,
    signed_policy_decisions: &[GovernedPolicyDecision],
    max_tick_ms: u64,
) -> anyhow::Result<StepExecutionResult> {
    let governed_action = RuntimeTaskStep::Robotics(step.clone())
        .governed_action()
        .ok_or_else(|| anyhow::anyhow!("robotics action is missing governed action metadata"))?;
    let safety_gate = evaluate_robotics_safety_gate(
        state.overture_public_key.as_deref(),
        task_id,
        &state.swarm_peer_id,
        tenant_id,
        &governed_action,
        containment,
        signed_policy_decisions,
    );
    if !safety_gate.permitted {
        anyhow::bail!(
            "robotics safety gate denied action {}: {}",
            robotics_action_name(&step.action),
            safety_gate.reason
        );
    }
    let governance_metadata = safety_gate
        .policy_decision
        .as_ref()
        .map(|decision| robotics_governance_metadata(&governed_action, decision));
    #[cfg(not(feature = "ros2"))]
    let _ = &governance_metadata;

    maybe_require_step_approval(
        &state,
        task_id,
        tenant_id,
        step.step_index,
        "robotics",
        "robotics-action",
        step.approval.as_ref(),
        max_tick_ms,
    )
    .await?;

    #[cfg(feature = "ros2")]
    {
        let resolved_action = serde_json::from_value(resolve_graph_value(
            serde_json::to_value(&step.action)?,
            graph_blackboard,
        ))?;
        let manager = state
            .ros2_manager
            .clone()
            .ok_or_else(|| anyhow::anyhow!("ROS2 manager is not enabled on this runtime"))?;

        if manager.is_safe_idle() {
            anyhow::bail!("robotics execution blocked: runtime is in safe-idle containment mode");
        }

        match &resolved_action {
            RoboticsAction::NavigateToPose {
                goal,
                wait_timeout_ms,
            } => {
                let handle = manager
                    .node()
                    .navigate_to_pose(igris_ros2::NavigationGoal {
                        x: goal.x,
                        y: goal.y,
                        z: goal.z,
                        orientation_w: goal.orientation_w,
                        frame_id: goal.frame_id.clone(),
                    })
                    .await?;

                let timeout_ms = wait_timeout_ms.unwrap_or(max_tick_ms);
                let nav_state =
                    tokio::time::timeout(Duration::from_millis(timeout_ms), handle.wait())
                        .await
                        .map_err(|_| {
                            anyhow::anyhow!("navigation timed out after {}ms", timeout_ms)
                        })??;
                let goal_id = handle.goal_id().await;
                let feedback = handle.feedback().await;

                match nav_state {
                    igris_ros2::NavigationState::Succeeded => Ok(StepExecutionResult {
                        output_text: format!(
                            "navigation goal {} succeeded at ({}, {}, {})",
                            goal_id, goal.x, goal.y, goal.z
                        ),
                        provider_name: format!(
                            "ros2:navigate_to_pose:{}:{}:{:.3}:{:.3}",
                            goal.frame_id,
                            goal_id,
                            feedback.distance_remaining,
                            feedback.estimated_time_remaining
                        ),
                        usage: ExecuteUsage {
                            prompt_tokens: 0,
                            completion_tokens: 0,
                            total_tokens: 0,
                        },
                        graph_output: Some(serde_json::json!({
                            "action": "navigate_to_pose",
                            "goal_id": goal_id,
                            "goal": goal,
                            "feedback": feedback,
                            "status": "succeeded"
                        })),
                        checkpoint_metadata: governance_metadata.clone(),
                        checkpoint_requested: false,
                    }),
                    igris_ros2::NavigationState::Failed(reason) => {
                        anyhow::bail!("navigation failed: {}", reason)
                    }
                    igris_ros2::NavigationState::Canceled => anyhow::bail!("navigation canceled"),
                    other => anyhow::bail!("navigation ended in unexpected state {:?}", other),
                }
            }
            RoboticsAction::GetNavigationStatus => {
                let status = manager.node().get_navigation_status().await?;
                let output_text = serde_json::to_string(&serde_json::json!({
                    "navigation_status": status,
                }))?;
                Ok(StepExecutionResult {
                    output_text: output_text.clone(),
                    provider_name: "ros2:get_navigation_status".to_string(),
                    usage: ExecuteUsage {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                    },
                    graph_output: serde_json::from_str(&output_text).ok(),
                    checkpoint_metadata: governance_metadata.clone(),
                    checkpoint_requested: false,
                })
            }
            RoboticsAction::CancelNavigation => {
                manager.node().cancel_navigation().await?;
                Ok(StepExecutionResult {
                    output_text: "requested navigation cancellation".to_string(),
                    provider_name: "ros2:cancel_navigation".to_string(),
                    usage: ExecuteUsage {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                    },
                    graph_output: Some(serde_json::json!({
                        "action": "cancel_navigation",
                        "status": "requested"
                    })),
                    checkpoint_metadata: governance_metadata.clone(),
                    checkpoint_requested: false,
                })
            }
            RoboticsAction::PublishPrompt { prompt } => {
                manager.node().publish_prompt(prompt).await?;
                Ok(StepExecutionResult {
                    output_text: format!("published robotics prompt: {}", prompt),
                    provider_name: "ros2:publish_prompt".to_string(),
                    usage: ExecuteUsage {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                    },
                    graph_output: Some(serde_json::json!({
                        "action": "publish_prompt",
                        "prompt": prompt
                    })),
                    checkpoint_metadata: governance_metadata.clone(),
                    checkpoint_requested: false,
                })
            }
            RoboticsAction::PublishVelocity {
                linear_x,
                angular_z,
            } => {
                manager
                    .node()
                    .publish_velocity(*linear_x, *angular_z)
                    .await?;
                Ok(StepExecutionResult {
                    output_text: format!(
                        "published velocity command linear_x={:.3} angular_z={:.3}",
                        linear_x, angular_z
                    ),
                    provider_name: "ros2:publish_velocity".to_string(),
                    usage: ExecuteUsage {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                    },
                    graph_output: Some(serde_json::json!({
                        "action": "publish_velocity",
                        "linear_x": linear_x,
                        "angular_z": angular_z
                    })),
                    checkpoint_metadata: governance_metadata.clone(),
                    checkpoint_requested: false,
                })
            }
            RoboticsAction::PublishZeroVelocity => {
                manager.node().publish_zero_velocity().await?;
                Ok(StepExecutionResult {
                    output_text: "published zero velocity command".to_string(),
                    provider_name: "ros2:publish_zero_velocity".to_string(),
                    usage: ExecuteUsage {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                    },
                    graph_output: Some(serde_json::json!({
                        "action": "publish_zero_velocity",
                        "status": "published"
                    })),
                    checkpoint_metadata: governance_metadata.clone(),
                    checkpoint_requested: false,
                })
            }
        }
    }

    #[cfg(not(feature = "ros2"))]
    {
        let _ = (
            state,
            step,
            graph_blackboard,
            max_tick_ms,
            signed_policy_decisions,
        );
        anyhow::bail!(
            "robotics task execution requires a runtime built with the robotics-platform feature"
        )
    }
}

#[derive(Debug, Clone)]
struct RoboticsSafetyGateDecision {
    permitted: bool,
    reason: String,
    policy_decision: Option<GovernedPolicyDecision>,
}

fn evaluate_robotics_safety_gate(
    overture_public_key: Option<&ed25519_dalek::VerifyingKey>,
    task_id: Uuid,
    runtime_id: &str,
    tenant_id: &str,
    action: &GovernedAction,
    containment: Option<&Bounds>,
    signed_policy_decisions: &[GovernedPolicyDecision],
) -> RoboticsSafetyGateDecision {
    let Some(verifying_key) = overture_public_key else {
        return denied_robotics_safety_gate("missing signed policy verifier");
    };

    let Some(decision) = signed_policy_decisions.iter().find(|decision| {
        decision.tenant_id == tenant_id
            && decision.task_id == task_id.to_string()
            && decision.action == *action
            && decision
                .runtime_id
                .as_deref()
                .map(|value| value == runtime_id || value == "*")
                .unwrap_or(true)
    }) else {
        return denied_robotics_safety_gate("missing signed policy decision");
    };

    if let Err(err) = verify_policy_decision_signature(decision, verifying_key) {
        return denied_robotics_safety_gate(format!("invalid signed policy decision: {err}"));
    }

    if decision.schema_version != "governed_policy_decision.v1" {
        return denied_robotics_safety_gate("unsupported signed policy decision schema");
    }

    if decision.expires_at_unix_ms <= unix_now_ms() {
        return denied_robotics_safety_gate("signed policy decision expired");
    }

    let runtime_permitted = decision.runtime_permitted;
    let tenant_permitted = decision.tenant_permitted;
    let policy_permitted = containment.is_some() && decision.policy_permitted;
    let robot_mode_permitted = decision.robot_mode_permitted;
    let permitted = decision.permit
        && runtime_permitted
        && tenant_permitted
        && policy_permitted
        && robot_mode_permitted;
    let reason = if permitted {
        decision.reason.clone()
    } else {
        let mut missing = Vec::new();
        if !runtime_permitted {
            missing.push("runtime");
        }
        if !tenant_permitted {
            missing.push("tenant");
        }
        if !policy_permitted {
            missing.push("policy");
        }
        if !robot_mode_permitted {
            missing.push("robot_mode");
        }
        if !decision.permit {
            missing.push("permit");
        }
        format!(
            "signed policy decision {} denied {}: missing {}",
            decision.decision_id,
            action.action_name,
            missing.join(",")
        )
    };

    RoboticsSafetyGateDecision {
        permitted,
        reason,
        policy_decision: if permitted {
            Some(decision.clone())
        } else {
            None
        },
    }
}

fn denied_robotics_safety_gate(reason: impl Into<String>) -> RoboticsSafetyGateDecision {
    RoboticsSafetyGateDecision {
        permitted: false,
        reason: reason.into(),
        policy_decision: None,
    }
}

fn verify_policy_decision_signature(
    decision: &GovernedPolicyDecision,
    verifying_key: &ed25519_dalek::VerifyingKey,
) -> anyhow::Result<()> {
    if decision.signature.is_empty() {
        anyhow::bail!("missing signature");
    }
    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(&decision.signature)
        .map_err(|err| anyhow::anyhow!("signature base64 decode failed: {err}"))?;
    let arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| anyhow::anyhow!("invalid signature length"))?;
    let signature = ed25519_dalek::Signature::from_bytes(&arr);
    let canonical = canonical_policy_decision_bytes(decision);
    let digest = Sha256::digest(&canonical);
    verifying_key
        .verify(&digest, &signature)
        .map_err(|err| anyhow::anyhow!("signature verification failed: {err}"))
}

fn unix_now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_millis() as u64
}

fn canonical_governed_action_value(action: &GovernedAction) -> serde_json::Value {
    let mut value = BTreeMap::<&str, serde_json::Value>::new();
    value.insert("action_name", serde_json::json!(action.action_name));
    value.insert("action_type", serde_json::json!(action.action_type));
    value.insert("domain", serde_json::json!(action.domain));
    value.insert("node_id", serde_json::json!(action.node_id));
    value.insert("requires_policy", serde_json::json!(action.requires_policy));
    value.insert(
        "safety_mode_required",
        serde_json::json!(action.safety_mode_required),
    );
    value.insert("schema_version", serde_json::json!(action.schema_version));
    value.insert("step_index", serde_json::json!(action.step_index));
    if let Some(target) = &action.target {
        value.insert("target", serde_json::json!(target));
    }
    serde_json::to_value(value).unwrap_or_default()
}

fn canonical_governed_action_bytes(action: &GovernedAction) -> Vec<u8> {
    serde_json::to_vec(&canonical_governed_action_value(action)).unwrap_or_default()
}

fn canonical_policy_decision_bytes(decision: &GovernedPolicyDecision) -> Vec<u8> {
    let mut value = BTreeMap::<&str, serde_json::Value>::new();
    value.insert("action", canonical_governed_action_value(&decision.action));
    value.insert("decision_id", serde_json::json!(decision.decision_id));
    value.insert(
        "expires_at_unix_ms",
        serde_json::json!(decision.expires_at_unix_ms),
    );
    value.insert(
        "issued_at_unix_ms",
        serde_json::json!(decision.issued_at_unix_ms),
    );
    value.insert("permit", serde_json::json!(decision.permit));
    value.insert(
        "policy_permitted",
        serde_json::json!(decision.policy_permitted),
    );
    value.insert("policy_version", serde_json::json!(decision.policy_version));
    value.insert("reason", serde_json::json!(decision.reason));
    value.insert(
        "robot_mode_permitted",
        serde_json::json!(decision.robot_mode_permitted),
    );
    if let Some(runtime_id) = &decision.runtime_id {
        value.insert("runtime_id", serde_json::json!(runtime_id));
    }
    value.insert(
        "runtime_permitted",
        serde_json::json!(decision.runtime_permitted),
    );
    value.insert("schema_version", serde_json::json!(decision.schema_version));
    if let Some(key_version) = &decision.signer_key_version {
        value.insert("signer_key_version", serde_json::json!(key_version));
    }
    value.insert("task_id", serde_json::json!(decision.task_id));
    value.insert("tenant_id", serde_json::json!(decision.tenant_id));
    value.insert(
        "tenant_permitted",
        serde_json::json!(decision.tenant_permitted),
    );
    serde_json::to_vec(&value).unwrap_or_default()
}

fn hash_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn policy_decision_hash(decision: &GovernedPolicyDecision) -> String {
    hash_hex(&canonical_policy_decision_bytes(decision))
}

fn validate_task_permission_envelope(
    req: &TaskSubmitRequest,
    overture_public_key: Option<&ed25519_dalek::VerifyingKey>,
    runtime_id: &str,
) -> Result<(), String> {
    if req.required_capabilities.is_empty() && req.permission_envelope.is_none() {
        return Ok(());
    }

    let envelope = req
        .permission_envelope
        .as_ref()
        .ok_or_else(|| "missing task permission envelope".to_string())?;
    let verifying_key = overture_public_key
        .ok_or_else(|| "missing task permission envelope verifier".to_string())?;

    if envelope.schema_version != "task_permission_envelope.v1" {
        return Err("unsupported task permission envelope schema".to_string());
    }
    if envelope.tenant_id != req.tenant_id {
        return Err("task permission envelope tenant mismatch".to_string());
    }
    if envelope.task_id != req.task_id.to_string() {
        return Err("task permission envelope task mismatch".to_string());
    }
    if let Some(envelope_runtime_id) = envelope.runtime_id.as_deref() {
        if envelope_runtime_id != runtime_id && envelope_runtime_id != "*" {
            return Err("task permission envelope runtime mismatch".to_string());
        }
    }
    if envelope.expires_at_unix_ms <= unix_now_ms() as i64 {
        return Err("task permission envelope expired".to_string());
    }
    verify_task_permission_envelope_signature(envelope, verifying_key)
        .map_err(|err| format!("invalid task permission envelope: {err}"))?;

    for capability in &req.required_capabilities {
        if !permission_envelope_allows_capability(envelope, capability) {
            return Err(format!(
                "required capability {capability} is not permitted by task permission envelope"
            ));
        }
    }
    Ok(())
}

fn verify_task_permission_envelope_signature(
    envelope: &TaskPermissionEnvelope,
    verifying_key: &ed25519_dalek::VerifyingKey,
) -> anyhow::Result<()> {
    if envelope.signature.is_empty() {
        anyhow::bail!("missing signature");
    }
    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(&envelope.signature)
        .map_err(|err| anyhow::anyhow!("signature base64 decode failed: {err}"))?;
    let arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| anyhow::anyhow!("invalid signature length"))?;
    let signature = ed25519_dalek::Signature::from_bytes(&arr);
    let canonical = canonical_task_permission_envelope_bytes(envelope);
    let digest = Sha256::digest(&canonical);
    verifying_key
        .verify(&digest, &signature)
        .map_err(|err| anyhow::anyhow!("signature verification failed: {err}"))
}

fn canonical_task_permission_envelope_bytes(envelope: &TaskPermissionEnvelope) -> Vec<u8> {
    let mut value = BTreeMap::<&str, serde_json::Value>::new();
    value.insert(
        "agent_identity",
        canonical_agent_identity_value(&envelope.agent_identity),
    );
    value.insert(
        "credential_refs",
        serde_json::json!(canonical_credential_reference_values(
            &envelope.credential_refs
        )),
    );
    value.insert(
        "decisions",
        serde_json::json!(canonical_capability_decision_values(&envelope.decisions)),
    );
    value.insert("envelope_id", serde_json::json!(envelope.envelope_id));
    value.insert(
        "expires_at_unix_ms",
        serde_json::json!(envelope.expires_at_unix_ms),
    );
    value.insert(
        "issued_at_unix_ms",
        serde_json::json!(envelope.issued_at_unix_ms),
    );
    value.insert(
        "required_capabilities",
        serde_json::json!(envelope.required_capabilities),
    );
    if let Some(runtime_id) = &envelope.runtime_id {
        value.insert("runtime_id", serde_json::json!(runtime_id));
    }
    value.insert("schema_version", serde_json::json!(envelope.schema_version));
    if let Some(key_version) = &envelope.signer_key_version {
        value.insert("signer_key_version", serde_json::json!(key_version));
    }
    value.insert("task_id", serde_json::json!(envelope.task_id));
    value.insert("tenant_id", serde_json::json!(envelope.tenant_id));
    serde_json::to_vec(&value).unwrap_or_default()
}

fn canonical_agent_identity_value(identity: &AgentIdentity) -> serde_json::Value {
    let mut value = BTreeMap::<&str, serde_json::Value>::new();
    value.insert(
        "acting_on_behalf_of",
        serde_json::json!(identity.acting_on_behalf_of),
    );
    value.insert("agent_id", serde_json::json!(identity.agent_id));
    value.insert(
        "delegation_chain",
        serde_json::json!(identity.delegation_chain),
    );
    value.insert("principal_id", serde_json::json!(identity.principal_id));
    value.insert("submitted_by", serde_json::json!(identity.submitted_by));
    serde_json::to_value(value).unwrap_or_default()
}

fn canonical_capability_decision_values(
    decisions: &[CapabilityDecision],
) -> Vec<serde_json::Value> {
    decisions
        .iter()
        .map(|decision| {
            let mut value = BTreeMap::<&str, serde_json::Value>::new();
            value.insert("capability", serde_json::json!(decision.capability));
            value.insert("permit", serde_json::json!(decision.permit));
            value.insert("policy_version", serde_json::json!(decision.policy_version));
            value.insert("reason", serde_json::json!(decision.reason));
            serde_json::to_value(value).unwrap_or_default()
        })
        .collect()
}

fn canonical_credential_reference_values(
    refs: &[CredentialReference],
) -> Vec<serde_json::Value> {
    refs.iter()
        .map(|credential_ref| {
            let mut value = BTreeMap::<&str, serde_json::Value>::new();
            value.insert("capability", serde_json::json!(credential_ref.capability));
            value.insert(
                "expires_at_unix_ms",
                serde_json::json!(credential_ref.expires_at_unix_ms),
            );
            value.insert(
                "reference_id",
                serde_json::json!(credential_ref.reference_id),
            );
            value.insert("revocable", serde_json::json!(credential_ref.revocable));
            value.insert("scope", serde_json::json!(credential_ref.scope));
            value.insert("task_id", serde_json::json!(credential_ref.task_id));
            value.insert("tenant_id", serde_json::json!(credential_ref.tenant_id));
            value.insert("tool", serde_json::json!(credential_ref.tool));
            serde_json::to_value(value).unwrap_or_default()
        })
        .collect()
}

fn permission_failure_for_step(
    req: &TaskSubmitRequest,
    step: &RuntimeTaskStep,
) -> Option<TaskFailureDetails> {
    let envelope = req.permission_envelope.as_ref()?;
    let capability = step_required_capability(step)?;
    if permission_envelope_allows_capability(envelope, &capability) {
        return None;
    }
    Some(runtime_execution_failure_details(
        "capability_policy_denied",
        format!("capability {capability} denied by task permission envelope"),
        Some(step),
    ))
}

fn step_required_capability(step: &RuntimeTaskStep) -> Option<String> {
    match step {
        RuntimeTaskStep::Tool(tool_step) => Some(tool_capability(&tool_step.tool_name)),
        RuntimeTaskStep::MemoryRecall(_) => Some("memory.read".to_string()),
        RuntimeTaskStep::MemoryStore(_) => Some("memory.write".to_string()),
        RuntimeTaskStep::HumanApproval(_) => Some("human.approval".to_string()),
        RuntimeTaskStep::Agent(_)
        | RuntimeTaskStep::Robotics(_)
        | RuntimeTaskStep::BehaviorTree(_) => None,
    }
}

fn tool_capability(tool_name: &str) -> String {
    let normalized = tool_name.trim().to_ascii_lowercase();
    if normalized.starts_with("tools.") {
        normalized
    } else {
        format!("tools.{normalized}")
    }
}

fn permission_envelope_allows_capability(
    envelope: &TaskPermissionEnvelope,
    capability: &str,
) -> bool {
    let capability = capability.trim().to_ascii_lowercase();
    envelope.decisions.iter().any(|decision| {
        decision.permit && capability_pattern_matches(&decision.capability, &capability)
    })
}

fn capability_pattern_matches(pattern: &str, capability: &str) -> bool {
    let pattern = pattern.trim().to_ascii_lowercase();
    pattern == capability
        || pattern == "*"
        || (pattern.ends_with(".*") && capability.starts_with(pattern.trim_end_matches('*')))
}

fn governed_action_hash(action: &GovernedAction) -> String {
    hash_hex(&canonical_governed_action_bytes(action))
}

fn robotics_governance_metadata(
    action: &GovernedAction,
    decision: &GovernedPolicyDecision,
) -> serde_json::Value {
    serde_json::json!({
        "governance": {
            "governed_action_hash": governed_action_hash(action),
            "policy_decision_id": decision.decision_id,
            "policy_decision_hash": policy_decision_hash(decision),
            "policy_version": decision.policy_version,
            "signed_policy_decision": decision,
        }
    })
}

async fn execute_human_approval_step(
    state: AppState,
    task_id: Uuid,
    tenant_id: &str,
    step: &HumanApprovalStep,
    graph_blackboard: &serde_json::Value,
    max_tick_ms: u64,
) -> anyhow::Result<StepExecutionResult> {
    let resolved_task = match resolve_graph_string_value(&step.task, graph_blackboard) {
        serde_json::Value::String(text) => text,
        other => graph_value_to_string(&other),
    };
    let slot_inputs = collect_slot_inputs(graph_blackboard, step.read_slots.as_deref());
    let approval = AgentApprovalOptions {
        required: true,
        task: Some(resolved_task.clone()),
        confidence: step.confidence,
        context: {
            let mut context = step
                .context
                .clone()
                .map(|context| {
                    context
                        .into_iter()
                        .map(|(key, value)| (key, resolve_graph_value(value, graph_blackboard)))
                        .collect::<HashMap<_, _>>()
                })
                .unwrap_or_default();
            if let Some(slot_context) = slot_inputs {
                context.insert("slot_inputs".to_string(), slot_context);
            }
            if context.is_empty() {
                None
            } else {
                Some(context)
            }
        },
    };

    maybe_require_step_approval(
        &state,
        task_id,
        tenant_id,
        step.step_index,
        "human",
        "human-approval",
        Some(&approval),
        max_tick_ms,
    )
    .await?;

    Ok(StepExecutionResult {
        output_text: format!("human approval granted for {}", resolved_task),
        provider_name: "hitl:approval".to_string(),
        usage: ExecuteUsage {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
        graph_output: Some(serde_json::json!({
            "task": resolved_task,
            "status": "approved"
        })),
        checkpoint_metadata: None,
        checkpoint_requested: false,
    })
}

async fn execute_memory_recall_step(
    state: AppState,
    _task_id: Uuid,
    step: &MemoryRecallStep,
    graph_blackboard: &serde_json::Value,
) -> anyhow::Result<StepExecutionResult> {
    #[cfg(feature = "memory")]
    {
        let memory = state.agent_memory.as_ref().ok_or_else(|| {
            anyhow::anyhow!("memory recall requested but the runtime has it disabled")
        })?;
        let top_k = step.top_k.unwrap_or(5);
        let query = match resolve_graph_string_value(&step.query, graph_blackboard) {
            serde_json::Value::String(text) => text,
            other => graph_value_to_string(&other),
        };
        let embedding = deterministic_embedding(&query, memory.embedding_dim());
        let results = memory.retrieve(embedding, top_k).await?;
        let output_text = serde_json::to_string(&serde_json::json!({
            "query": query,
            "results": results.into_iter().map(|result| serde_json::json!({
                "key": result.entry.key,
                "content": result.entry.content,
                "similarity": result.similarity,
            })).collect::<Vec<_>>()
        }))?;

        return Ok(StepExecutionResult {
            output_text: output_text.clone(),
            provider_name: "memory:recall".to_string(),
            usage: ExecuteUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            graph_output: serde_json::from_str(&output_text).ok(),
            checkpoint_metadata: None,
            checkpoint_requested: false,
        });
    }

    #[cfg(not(feature = "memory"))]
    {
        let _ = state;
        anyhow::bail!(
            "memory recall requested but this runtime was not built with the memory feature"
        );
    }
}

async fn execute_memory_store_step(
    state: AppState,
    task_id: Uuid,
    step: &MemoryStoreStep,
    graph_blackboard: &serde_json::Value,
) -> anyhow::Result<StepExecutionResult> {
    #[cfg(feature = "memory")]
    {
        let memory = state.agent_memory.as_ref().ok_or_else(|| {
            anyhow::anyhow!("memory store requested but the runtime has it disabled")
        })?;
        let key = step
            .key
            .clone()
            .map(
                |key| match resolve_graph_string_value(&key, graph_blackboard) {
                    serde_json::Value::String(text) => text,
                    other => graph_value_to_string(&other),
                },
            )
            .unwrap_or_else(|| format!("task:{}:memory-store:{}", task_id, step.step_index));
        let content = match resolve_graph_string_value(&step.content, graph_blackboard) {
            serde_json::Value::String(text) => text,
            other => graph_value_to_string(&other),
        };
        let embedding = deterministic_embedding(&content, memory.embedding_dim());
        memory.store(&key, &content, embedding).await?;
        return Ok(StepExecutionResult {
            output_text: format!("stored memory entry {}", key),
            provider_name: "memory:store".to_string(),
            usage: ExecuteUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            graph_output: Some(serde_json::json!({
                "key": key,
                "content": content
            })),
            checkpoint_metadata: None,
            checkpoint_requested: false,
        });
    }

    #[cfg(not(feature = "memory"))]
    {
        let _ = (state, task_id);
        anyhow::bail!(
            "memory store requested but this runtime was not built with the memory feature"
        );
    }
}

async fn execute_tool_step(
    state: AppState,
    task_id: Uuid,
    step: &ToolStep,
    graph_blackboard: &serde_json::Value,
) -> anyhow::Result<StepExecutionResult> {
    let registry = state.tool_registry.as_ref().ok_or_else(|| {
        anyhow::anyhow!("tool execution requested but the runtime has no tool registry")
    })?;
    let args = resolve_graph_value(
        step.args.clone().unwrap_or_else(|| serde_json::json!({})),
        graph_blackboard,
    );
    let idempotency_key = format!(
        "{}:{}:{:x}",
        task_id,
        step.node_id,
        Sha256::digest(serde_json::to_vec(&args)?)
    );
    let result = registry
        .execute_idempotent(&idempotency_key, &step.tool_name, args.clone())
        .await?;
    if !result.success {
        anyhow::bail!(
            "tool {} failed: {}",
            step.tool_name,
            result
                .error
                .unwrap_or_else(|| "unknown tool error".to_string())
        );
    }

    let graph_output = serde_json::json!({
        "tool_name": result.tool_name,
        "output": result.output,
        "execution_time_ms": result.execution_time_ms,
        "metadata": result.metadata,
        "args": args,
    });
    let output_text = graph_output["output"]
        .as_str()
        .map(|text| text.to_string())
        .unwrap_or_else(|| serde_json::to_string(&graph_output).unwrap_or_default());

    Ok(StepExecutionResult {
        output_text,
        provider_name: format!("tool:{}", step.tool_name),
        usage: ExecuteUsage {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
        graph_output: Some(graph_output),
        checkpoint_metadata: None,
        checkpoint_requested: false,
    })
}

async fn execute_behavior_tree_runtime(
    state: &AppState,
    task_id: Uuid,
    tree: &serde_json::Value,
    resume_checkpoint: Option<&serde_json::Value>,
    initial_blackboard: Option<&serde_json::Value>,
    deadline_ms: u64,
    max_ticks: Option<u64>,
    checkpoint_every: u64,
    wal: Option<Arc<WalLog>>,
) -> anyhow::Result<BehaviorTreeRuntimeResult> {
    let parser = JsonTreeParser::new();
    let mut context = BTreeContext::new();

    if let Some(ref tr) = state.tool_registry {
        context = context.with_tools(tr.clone());
    }

    #[cfg(feature = "ros2")]
    if let Some(ref mgr) = state.ros2_manager {
        if !mgr.is_safe_idle() {
            context = context.with_ros2(mgr.node());
        }
    }

    if let Some(resume_cp) = resume_checkpoint {
        if let Some(blackboard_state) = resume_cp.get("blackboard_state") {
            context.blackboard.restore(blackboard_state).await;
        }
    } else if let Some(blackboard_state) = initial_blackboard {
        context.blackboard.restore(blackboard_state).await;
    }

    let mut tree_node = parser
        .parse_node(tree, &context)
        .map_err(|e| anyhow::anyhow!("invalid behavior tree: {}", e))?;

    if let Some(wal) = wal {
        let signing_key = state.signing_key.as_ref().cloned().ok_or_else(|| {
            anyhow::anyhow!(
                "behavior tree execution requires a runtime configured with an Ed25519 signing key"
            )
        })?;
        context = context.with_wal(BtWalSession {
            wal,
            signing_key,
            task_id,
            checkpoint_every,
        });
    }

    let mut exec_config = ExecutorConfig::default();
    exec_config.max_ticks = max_ticks;
    exec_config.deadline = Some(Duration::from_millis(deadline_ms));

    let executor =
        BTreeExecutor::with_config(exec_config).with_tick_observer((*state.bt_state_tx).clone());
    let result = executor.execute(tree_node.as_mut(), &mut context).await?;
    let checkpoint = result.checkpoint.clone().map(|bt_cp| CheckpointPayload {
        task_id: bt_cp.task_id,
        resume_token: bt_cp.resume_token,
        wal_entries: bt_cp.wal_entries,
        metadata: Some(serde_json::json!({
            "blackboard_state": bt_cp.blackboard_state,
            "tick_count": bt_cp.tick_count,
        })),
    });

    Ok(BehaviorTreeRuntimeResult { result, checkpoint })
}

async fn execute_behavior_tree_graph_step(
    state: AppState,
    task_id: Uuid,
    step: &BehaviorTreeStep,
    resume_checkpoint: Option<&serde_json::Value>,
    wal: &Arc<WalLog>,
    graph_blackboard: &serde_json::Value,
    max_tick_ms: u64,
) -> anyhow::Result<StepExecutionResult> {
    let bt = execute_behavior_tree_runtime(
        &state,
        task_id,
        &step.tree,
        resume_checkpoint,
        Some(graph_blackboard),
        max_tick_ms,
        None,
        10,
        Some(wal.clone()),
    )
    .await
    .map_err(|e| anyhow::anyhow!("behavior tree node {}: {}", step.node_id, e))?;

    match bt.result.status {
        NodeStatus::Success => Ok(StepExecutionResult {
            output_text: format!(
                "behavior tree node {} completed successfully in {} ticks",
                step.node_id, bt.result.tick_count
            ),
            provider_name: format!("btree:{}", step.node_id),
            usage: ExecuteUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            graph_output: None,
            checkpoint_metadata: bt.checkpoint.and_then(|checkpoint| checkpoint.metadata),
            checkpoint_requested: false,
        }),
        NodeStatus::Failure | NodeStatus::Skipped => {
            anyhow::bail!(
                "behavior tree node {} failed: {}",
                step.node_id,
                bt.result
                    .error
                    .unwrap_or_else(|| "behavior tree returned Failure".to_string())
            )
        }
        NodeStatus::Running => {
            let checkpoint = bt.checkpoint.ok_or_else(|| {
                anyhow::anyhow!(
                    "behavior tree node {} interrupted without checkpoint",
                    step.node_id
                )
            })?;
            Ok(StepExecutionResult {
                output_text: format!(
                    "behavior tree node {} checkpointed after {} ticks",
                    step.node_id, bt.result.tick_count
                ),
                provider_name: format!("btree:{}", step.node_id),
                usage: ExecuteUsage {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
                graph_output: None,
                checkpoint_metadata: checkpoint.metadata,
                checkpoint_requested: true,
            })
        }
    }
}

#[derive(Debug, Default)]
struct GovernanceArtifactRefs {
    governed_action_hash: Option<String>,
    policy_decision_id: Option<String>,
    policy_decision_hash: Option<String>,
}

fn extract_governance_artifact_refs(
    metadata: Option<&serde_json::Value>,
) -> GovernanceArtifactRefs {
    let Some(governance) = metadata.and_then(|value| value.get("governance")) else {
        return GovernanceArtifactRefs::default();
    };

    GovernanceArtifactRefs {
        governed_action_hash: governance
            .get("governed_action_hash")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        policy_decision_id: governance
            .get("policy_decision_id")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        policy_decision_hash: governance
            .get("policy_decision_hash")
            .and_then(|value| value.as_str())
            .map(str::to_string),
    }
}

async fn build_execution_artifacts(
    state: &AppState,
    req: &TaskSubmitRequest,
    step: &RuntimeTaskStep,
    result: &StepExecutionResult,
    wall_time_ms: u64,
) -> anyhow::Result<(serde_json::Value, Option<serde_json::Value>)> {
    build_execution_artifacts_with_violation(state, req, step, result, wall_time_ms, None).await
}

async fn build_failure_execution_artifacts(
    state: &AppState,
    req: &TaskSubmitRequest,
    step: &RuntimeTaskStep,
    reason: &str,
    wall_time_ms: u64,
) -> anyhow::Result<(serde_json::Value, Option<serde_json::Value>)> {
    let result = StepExecutionResult {
        output_text: reason.to_string(),
        provider_name: format!("runtime:{}:failed", step.domain_name()),
        usage: ExecuteUsage {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
        graph_output: None,
        checkpoint_metadata: governance_metadata_from_request(state, req, step),
        checkpoint_requested: false,
    };
    build_execution_artifacts_with_violation(state, req, step, &result, wall_time_ms, Some(reason))
        .await
}

async fn build_execution_artifacts_with_violation(
    state: &AppState,
    req: &TaskSubmitRequest,
    step: &RuntimeTaskStep,
    result: &StepExecutionResult,
    wall_time_ms: u64,
    violation: Option<&str>,
) -> anyhow::Result<(serde_json::Value, Option<serde_json::Value>)> {
    let signing_key = state
        .signing_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("runtime has no signing key"))?;

    let execution_id = format!("exec-{}", Uuid::new_v4());
    let timestamp = iso8601_now();
    let request_hash = format!("{:x}", Sha256::digest(step.input_bytes()));
    let response_hash = format!("{:x}", Sha256::digest(result.output_text.as_bytes()));
    let finish_reason = "stop".to_string();
    let governance = extract_governance_artifact_refs(result.checkpoint_metadata.as_ref());
    let tenant_id = if req.tenant_id.is_empty() {
        None
    } else {
        Some(req.tenant_id.clone())
    };

    let canon = canonical_envelope_bytes(
        &execution_id,
        &timestamp,
        tenant_id.as_deref(),
        step.model_name(),
        &request_hash,
        &response_hash,
        &result.provider_name,
        req.containment.as_ref(),
        &finish_reason,
        violation,
        governance.governed_action_hash.as_deref(),
        governance.policy_decision_id.as_deref(),
        governance.policy_decision_hash.as_deref(),
    );
    let hash = Sha256::digest(&canon);
    let sig = signing_key.sign(&hash);
    let envelope = ExecutionEnvelope {
        bounds_applied: req.containment.clone(),
        execution_id,
        finish_reason,
        governed_action_hash: governance.governed_action_hash,
        model: step.model_name().to_string(),
        policy_decision_hash: governance.policy_decision_hash,
        policy_decision_id: governance.policy_decision_id,
        request_hash,
        response_hash,
        routing_decision: result.provider_name.clone(),
        signature: base64::engine::general_purpose::STANDARD.encode(sig.to_bytes()),
        tenant_id: tenant_id.clone(),
        timestamp,
        violation: violation.map(str::to_string),
    };

    let tx = crate::transaction::ExecutionTransaction::begin(
        tenant_id.as_deref().unwrap_or("anonymous"),
        "",
        state.signing_key.as_ref(),
    )
    .commit(state.signing_key.as_ref());

    let receipt = if let Some(log) = &state.receipt_log {
        Some(
            log.append(
                tenant_id.as_deref().unwrap_or("anonymous"),
                &tx.transaction_id,
                &tx.hash,
                0,
                wall_time_ms,
                0,
                0,
                0,
                violation.is_some(),
            )
            .await?,
        )
    } else {
        Some(ExecutionReceipt::new(
            tenant_id.as_deref().unwrap_or("anonymous"),
            &tx.transaction_id,
            &tx.hash,
            0,
            wall_time_ms,
            0,
            0,
            0,
            violation.is_some(),
            "",
            state.signing_key.as_ref(),
        ))
    };

    Ok((
        serde_json::to_value(envelope)?,
        match receipt {
            Some(value) => Some(serde_json::to_value(value)?),
            None => None,
        },
    ))
}

fn governance_metadata_from_request(
    state: &AppState,
    req: &TaskSubmitRequest,
    step: &RuntimeTaskStep,
) -> Option<serde_json::Value> {
    let action = step.governed_action()?;
    let verifying_key = state.overture_public_key.as_deref()?;
    let decision = req.signed_policy_decisions.iter().find(|decision| {
        decision.tenant_id == req.tenant_id
            && decision.task_id == req.task_id.to_string()
            && decision.action == action
            && decision
                .runtime_id
                .as_deref()
                .map(|value| value == state.swarm_peer_id || value == "*")
                .unwrap_or(true)
    })?;
    if verify_policy_decision_signature(decision, verifying_key).is_err() {
        return None;
    }
    Some(robotics_governance_metadata(&action, decision))
}

fn deterministic_embedding(input: &str, dim: usize) -> Vec<f32> {
    if dim == 0 {
        return Vec::new();
    }

    let mut values = Vec::with_capacity(dim);
    let mut counter = 0u64;
    while values.len() < dim {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        hasher.update(counter.to_le_bytes());
        let digest = hasher.finalize();
        for chunk in digest.chunks(4) {
            if values.len() == dim {
                break;
            }
            let bytes = [chunk[0], chunk[1], chunk[2], chunk[3]];
            let raw = u32::from_le_bytes(bytes);
            let unit = (raw as f64 / u32::MAX as f64) * 2.0 - 1.0;
            values.push(unit as f32);
        }
        counter = counter.saturating_add(1);
    }

    let norm = values.iter().map(|value| value * value).sum::<f32>().sqrt();
    if norm > 0.0 {
        for value in &mut values {
            *value /= norm;
        }
    }

    values
}

async fn prepare_agent_prompt(
    state: &AppState,
    task_id: Uuid,
    step: &AgentStep,
    base_prompt: String,
) -> anyhow::Result<String> {
    let mut prompt = base_prompt.clone();

    #[cfg(feature = "memory")]
    {
        if let Some(memory_options) = &step.memory {
            let recall_top_k = memory_options.recall_top_k.unwrap_or(0);
            if recall_top_k > 0 {
                let memory = state.agent_memory.as_ref().ok_or_else(|| {
                    anyhow::anyhow!("agent memory requested but the runtime has it disabled")
                })?;
                let query_text = memory_options
                    .recall_query
                    .clone()
                    .unwrap_or_else(|| base_prompt.clone());
                let embedding = deterministic_embedding(&query_text, memory.embedding_dim());
                let recalled = memory.retrieve(embedding, recall_top_k).await?;
                if !recalled.is_empty() {
                    let memory_block = recalled
                        .into_iter()
                        .map(|result| format!("[{}] {}", result.entry.key, result.entry.content))
                        .collect::<Vec<_>>()
                        .join("\n");
                    prompt.push_str(&format!(
                        "\n\nRetrieved memory for task {}:\n{}",
                        task_id, memory_block
                    ));
                }
            }
        }
    }

    #[cfg(not(feature = "memory"))]
    {
        let _ = (state, task_id);
        if step.memory.is_some() {
            anyhow::bail!(
                "agent memory requested but this runtime was not built with the memory feature"
            );
        }
    }

    Ok(prompt)
}

async fn maybe_store_agent_memory(
    state: &AppState,
    task_id: Uuid,
    step: &AgentStep,
    base_prompt: &str,
    output: &str,
) -> anyhow::Result<()> {
    #[cfg(feature = "memory")]
    {
        let Some(memory_options) = &step.memory else {
            return Ok(());
        };
        if !memory_options.store_output {
            return Ok(());
        }

        let memory = state.agent_memory.as_ref().ok_or_else(|| {
            anyhow::anyhow!("agent memory storage requested but the runtime has it disabled")
        })?;
        let key = memory_options.store_key.clone().unwrap_or_else(|| {
            format!(
                "task:{}:step:{}:{:x}",
                task_id,
                step.step_index,
                Sha256::digest(base_prompt.as_bytes())
            )
        });
        let content = format!("Prompt:\n{}\n\nResponse:\n{}", base_prompt, output);
        let embedding = deterministic_embedding(base_prompt, memory.embedding_dim());
        memory.store(&key, &content, embedding).await?;
        return Ok(());
    }

    #[cfg(not(feature = "memory"))]
    {
        let _ = (state, task_id, base_prompt, output);
        if let Some(memory_options) = &step.memory {
            if memory_options.store_output || memory_options.store_key.is_some() {
                anyhow::bail!("agent memory storage requested but this runtime was not built with the memory feature");
            }
        }
        Ok(())
    }
}

async fn maybe_require_step_approval(
    state: &AppState,
    task_id: Uuid,
    tenant_id: &str,
    step_index: u32,
    model: &str,
    default_task: &str,
    approval: Option<&AgentApprovalOptions>,
    max_tick_ms: u64,
) -> anyhow::Result<()> {
    let Some(approval) = approval else {
        return Ok(());
    };
    if !approval.required && approval.confidence.is_none() {
        return Ok(());
    }

    #[cfg(feature = "hitl")]
    {
        let coordinator = state.hitl_coordinator.as_ref().ok_or_else(|| {
            anyhow::anyhow!("human approval requested but the runtime has HITL disabled")
        })?;
        let mut context = approval.context.clone().unwrap_or_default();
        context.insert("task_id".to_string(), serde_json::json!(task_id));
        context.insert("tenant_id".to_string(), serde_json::json!(tenant_id));
        context.insert("model".to_string(), serde_json::json!(model));
        context.insert("step_index".to_string(), serde_json::json!(step_index));

        let task_description = approval.task.clone().unwrap_or_else(|| {
            format!(
                "Approve {} {} for model {}",
                default_task, step_index, model
            )
        });

        let status = tokio::time::timeout(
            Duration::from_millis(max_tick_ms),
            coordinator.request_approval(
                task_description,
                context,
                approval.confidence.unwrap_or(0.0),
            ),
        )
        .await
        .map_err(|_| anyhow::anyhow!("human approval timed out after {}ms", max_tick_ms))??;

        match status {
            igris_hitl::ApprovalStatus::Approved => Ok(()),
            igris_hitl::ApprovalStatus::Rejected => {
                anyhow::bail!("human approval rejected task {}", task_id)
            }
            igris_hitl::ApprovalStatus::Timeout => {
                anyhow::bail!("human approval timed out for task {}", task_id)
            }
            igris_hitl::ApprovalStatus::Pending => {
                anyhow::bail!("human approval is still pending for task {}", task_id)
            }
        }
    }

    #[cfg(not(feature = "hitl"))]
    {
        let _ = (state, task_id, tenant_id, max_tick_ms);
        anyhow::bail!(
            "human approval requested but this runtime was not built with the hitl feature"
        );
    }
}

fn build_step_checkpoint_metadata(
    step: &RuntimeTaskStep,
    steps_completed: u32,
    result: &StepExecutionResult,
) -> serde_json::Value {
    let mut metadata = match step {
        RuntimeTaskStep::Agent(agent_step) => serde_json::json!({
            "domain": "agent",
            "node_id": agent_step.node_id,
            "checkpoint_key": agent_step.checkpoint_key,
            "read_slots": agent_step.read_slots,
            "write_slot": agent_step.write_slot,
            "step_index": agent_step.step_index,
            "steps_completed": steps_completed,
            "model": agent_step.model,
            "requested_mode": requested_mode_label(agent_step.mode.as_deref()),
            "resolved_strategy": resolved_strategy_for_mode(agent_step.mode.as_deref()),
            "provider": result.provider_name,
            "output_preview": truncate_preview(&result.output_text, 240),
        }),
        RuntimeTaskStep::Robotics(robotics_step) => serde_json::json!({
            "domain": "robotics",
            "node_id": robotics_step.node_id,
            "checkpoint_key": robotics_step.checkpoint_key,
            "read_slots": robotics_step.read_slots,
            "write_slot": robotics_step.write_slot,
            "step_index": robotics_step.step_index,
            "steps_completed": steps_completed,
            "action": robotics_action_name(&robotics_step.action),
            "provider": result.provider_name,
            "output_preview": truncate_preview(&result.output_text, 240),
        }),
        RuntimeTaskStep::Tool(tool_step) => serde_json::json!({
            "domain": "tool",
            "node_id": tool_step.node_id,
            "checkpoint_key": tool_step.checkpoint_key,
            "read_slots": tool_step.read_slots,
            "write_slot": tool_step.write_slot,
            "step_index": tool_step.step_index,
            "steps_completed": steps_completed,
            "tool_name": tool_step.tool_name,
            "provider": result.provider_name,
            "output_preview": truncate_preview(&result.output_text, 240),
        }),
        RuntimeTaskStep::HumanApproval(approval_step) => serde_json::json!({
            "domain": "human_approval",
            "node_id": approval_step.node_id,
            "checkpoint_key": approval_step.checkpoint_key,
            "read_slots": approval_step.read_slots,
            "write_slot": approval_step.write_slot,
            "step_index": approval_step.step_index,
            "steps_completed": steps_completed,
            "task": approval_step.task,
            "provider": result.provider_name,
            "output_preview": truncate_preview(&result.output_text, 240),
        }),
        RuntimeTaskStep::MemoryRecall(recall_step) => serde_json::json!({
            "domain": "memory_recall",
            "node_id": recall_step.node_id,
            "checkpoint_key": recall_step.checkpoint_key,
            "read_slots": recall_step.read_slots,
            "write_slot": recall_step.write_slot,
            "step_index": recall_step.step_index,
            "steps_completed": steps_completed,
            "query": recall_step.query,
            "provider": result.provider_name,
            "output_preview": truncate_preview(&result.output_text, 240),
        }),
        RuntimeTaskStep::MemoryStore(store_step) => serde_json::json!({
            "domain": "memory_store",
            "node_id": store_step.node_id,
            "checkpoint_key": store_step.checkpoint_key,
            "read_slots": store_step.read_slots,
            "write_slot": store_step.write_slot,
            "step_index": store_step.step_index,
            "steps_completed": steps_completed,
            "key": store_step.key,
            "provider": result.provider_name,
            "output_preview": truncate_preview(&result.output_text, 240),
        }),
        RuntimeTaskStep::BehaviorTree(bt_step) => serde_json::json!({
            "domain": "behavior_tree",
            "node_id": bt_step.node_id,
            "checkpoint_key": bt_step.checkpoint_key,
            "read_slots": bt_step.read_slots,
            "write_slot": bt_step.write_slot,
            "step_index": bt_step.step_index,
            "steps_completed": steps_completed,
            "provider": result.provider_name,
            "output_preview": truncate_preview(&result.output_text, 240),
        }),
    };

    if let Some(extra_metadata) = result.checkpoint_metadata.as_ref() {
        merge_checkpoint_metadata(&mut metadata, extra_metadata);
    }
    if let Some(governed_action) = step.governed_action() {
        metadata["governed_action"] = serde_json::json!(governed_action);
    }

    metadata
}

fn merge_checkpoint_metadata(base: &mut serde_json::Value, extra: &serde_json::Value) {
    let Some(base_object) = base.as_object_mut() else {
        return;
    };
    let Some(extra_object) = extra.as_object() else {
        return;
    };
    for (key, value) in extra_object {
        base_object.insert(key.clone(), value.clone());
    }
}

fn requested_mode_label(mode: Option<&str>) -> String {
    mode.map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("default")
        .to_string()
}

fn resolved_strategy_for_mode(mode: Option<&str>) -> &'static str {
    match normalize_agent_mode(mode).unwrap_or(AgentExecutionMode::Default) {
        AgentExecutionMode::Default | AgentExecutionMode::Latency => "provider_race_latency",
        AgentExecutionMode::Balanced => "provider_race_balanced",
        AgentExecutionMode::Quality => "provider_race_quality",
        AgentExecutionMode::Cost => "provider_race_cost",
        AgentExecutionMode::Thompson => "single_provider_thompson",
        AgentExecutionMode::Council => "council_synthesis",
    }
}

fn extract_mode_metadata(metadata: &serde_json::Value) -> (Option<String>, Option<String>) {
    let requested_mode = metadata
        .get("requested_mode")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let resolved_strategy = metadata
        .get("resolved_strategy")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    (requested_mode, resolved_strategy)
}

fn robotics_action_name(action: &RoboticsAction) -> &'static str {
    match action {
        RoboticsAction::NavigateToPose { .. } => "navigate_to_pose",
        RoboticsAction::GetNavigationStatus => "get_navigation_status",
        RoboticsAction::CancelNavigation => "cancel_navigation",
        RoboticsAction::PublishPrompt { .. } => "publish_prompt",
        RoboticsAction::PublishVelocity { .. } => "publish_velocity",
        RoboticsAction::PublishZeroVelocity => "publish_zero_velocity",
    }
}

fn robotics_action_target(action: &RoboticsAction) -> Option<String> {
    match action {
        RoboticsAction::NavigateToPose { goal, .. } => {
            Some(format!("{},{},{}", goal.x, goal.y, goal.frame_id))
        }
        RoboticsAction::PublishPrompt { prompt } => Some(truncate_preview(prompt, 120)),
        RoboticsAction::PublishVelocity {
            linear_x,
            angular_z,
        } => Some(format!("{:.3},{:.3}", linear_x, angular_z)),
        _ => None,
    }
}

fn truncate_preview(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::{
        attach_stream_task_headers, build_checkpoint_mismatch_payload,
        build_idempotency_conflict_payload, build_step_checkpoint_metadata,
        build_stream_replay_unavailable_payload, build_task_cancel_response,
        build_task_result_payload, canonical_policy_decision_bytes,
        canonical_task_permission_envelope_bytes, collect_slot_inputs, compile_execution_graph_to_steps,
        deterministic_embedding, evaluate_robotics_safety_gate, initialize_graph_blackboard,
        materialize_execution_graph, normalize_agent_mode, permission_failure_for_step,
        persist_task_status_index, resolve_graph_value, robotics_action_name,
        runtime_execution_failure_details, stream_durability_metadata, task_status_key,
        unix_now_ms, update_graph_blackboard, validate_task_permission_envelope,
        verified_resume_start_step, AgentExecutionMode, AgentIdentity, BehaviorTreeStep,
        CapabilityDecision, CredentialReference, ExecutionGraph, ExecutionNode, GovernedAction,
        GovernedPolicyDecision, HumanApprovalStep, RoboticsAction, RoboticsStep,
        RuntimeTaskStep, StepExecutionResult, TaskFailureDetails, TaskPermissionEnvelope,
        TaskStatus, TaskSubmitRequest, TaskSubmitResponse, TaskType, ToolStep,
    };
    use crate::runtime_execute::{Bounds, ExecuteMessage, ExecuteUsage};
    use axum::{body::Body, http::StatusCode, response::Response};
    use base64::Engine;
    use ed25519_dalek::{Signer, SigningKey};
    use igris_core::storage::{RedbStorage, TASK_SUBMISSION_STATUS_BY_TASK_ID};
    use igris_wal::{CheckpointPayload, ResumeToken};
    use sha2::{Digest, Sha256};
    use std::env;
    use uuid::Uuid;

    #[test]
    fn normalize_agent_mode_accepts_supported_values() {
        assert_eq!(
            normalize_agent_mode(None).unwrap(),
            AgentExecutionMode::Default
        );
        assert_eq!(
            normalize_agent_mode(Some("speculative")).unwrap(),
            AgentExecutionMode::Latency
        );
        assert_eq!(
            normalize_agent_mode(Some("latency")).unwrap(),
            AgentExecutionMode::Latency
        );
        assert_eq!(
            normalize_agent_mode(Some("quality")).unwrap(),
            AgentExecutionMode::Quality
        );
        assert_eq!(
            normalize_agent_mode(Some("council")).unwrap(),
            AgentExecutionMode::Council
        );
    }

    #[test]
    fn normalize_agent_mode_rejects_unknown_values() {
        assert!(normalize_agent_mode(Some("reflection")).is_err());
    }

    #[test]
    fn deterministic_embedding_is_stable_and_sized() {
        let a = deterministic_embedding("hello", 8);
        let b = deterministic_embedding("hello", 8);
        let c = deterministic_embedding("world", 8);
        assert_eq!(a.len(), 8);
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn robotics_checkpoint_metadata_contains_action_name() {
        let step = RuntimeTaskStep::Robotics(RoboticsStep {
            step_index: 2,
            node_id: Some("robotics-node-2".to_string()),
            checkpoint_key: Some("mission-waypoint".to_string()),
            read_slots: Some(vec!["reason.plan".to_string()]),
            write_slot: Some("robotics.pose".to_string()),
            action: RoboticsAction::PublishZeroVelocity,
            approval: None,
        });
        let result = StepExecutionResult {
            output_text: "published zero velocity command".to_string(),
            provider_name: "ros2:publish_zero_velocity".to_string(),
            usage: ExecuteUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            graph_output: None,
            checkpoint_metadata: None,
            checkpoint_requested: false,
        };

        let metadata = build_step_checkpoint_metadata(&step, 3, &result);
        assert_eq!(metadata["domain"], "robotics");
        assert_eq!(metadata["node_id"], "robotics-node-2");
        assert_eq!(metadata["checkpoint_key"], "mission-waypoint");
        assert_eq!(metadata["read_slots"][0], "reason.plan");
        assert_eq!(metadata["write_slot"], "robotics.pose");
        assert_eq!(metadata["action"], "publish_zero_velocity");
        assert_eq!(metadata["steps_completed"], 3);
        assert_eq!(
            metadata["governed_action"]["schema_version"],
            "governed_action.v1"
        );
        assert_eq!(metadata["governed_action"]["domain"], "robotics");
        assert_eq!(metadata["governed_action"]["action_type"], "ros2_action");
        assert_eq!(
            metadata["governed_action"]["action_name"],
            "publish_zero_velocity"
        );
        assert_eq!(metadata["governed_action"]["requires_policy"], true);
        assert_eq!(metadata["governed_action"]["safety_mode_required"], true);
    }

    #[test]
    fn tool_checkpoint_metadata_uses_governed_action_schema() {
        let step = RuntimeTaskStep::Tool(ToolStep {
            step_index: 4,
            node_id: "tool-4".to_string(),
            checkpoint_key: Some("tool-result".to_string()),
            read_slots: Some(vec!["reason.plan".to_string()]),
            write_slot: Some("tool.output".to_string()),
            tool_name: "inventory.lookup".to_string(),
            args: None,
        });
        let result = StepExecutionResult {
            output_text: "ok".to_string(),
            provider_name: "tool:inventory.lookup".to_string(),
            usage: ExecuteUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            graph_output: None,
            checkpoint_metadata: None,
            checkpoint_requested: false,
        };

        let metadata = build_step_checkpoint_metadata(&step, 5, &result);
        assert_eq!(
            metadata["governed_action"]["schema_version"],
            "governed_action.v1"
        );
        assert_eq!(metadata["governed_action"]["domain"], "tool");
        assert_eq!(metadata["governed_action"]["action_type"], "tool_call");
        assert_eq!(
            metadata["governed_action"]["action_name"],
            "inventory.lookup"
        );
        assert_eq!(metadata["governed_action"]["safety_mode_required"], false);
    }

    fn test_governed_robotics_action() -> GovernedAction {
        GovernedAction {
            schema_version: "governed_action.v1".to_string(),
            domain: "robotics".to_string(),
            action_type: "ros2_action".to_string(),
            action_name: "publish_zero_velocity".to_string(),
            node_id: "robotics".to_string(),
            step_index: 0,
            target: None,
            requires_policy: true,
            safety_mode_required: true,
        }
    }

    fn signed_policy_decision(
        signing_key: &SigningKey,
        task_id: Uuid,
        tenant_id: &str,
        runtime_id: &str,
        action: GovernedAction,
        permit: bool,
    ) -> GovernedPolicyDecision {
        let mut decision = GovernedPolicyDecision {
            schema_version: "governed_policy_decision.v1".to_string(),
            decision_id: "decision-test".to_string(),
            tenant_id: tenant_id.to_string(),
            task_id: task_id.to_string(),
            runtime_id: Some(runtime_id.to_string()),
            action,
            permit,
            reason: if permit { "permitted" } else { "denied" }.to_string(),
            policy_version: "robotics-policy.test".to_string(),
            runtime_permitted: permit,
            tenant_permitted: permit,
            policy_permitted: permit,
            robot_mode_permitted: permit,
            issued_at_unix_ms: unix_now_ms(),
            expires_at_unix_ms: unix_now_ms() + 30_000,
            signer_key_version: Some("test-key".to_string()),
            signature: String::new(),
        };
        let canonical = canonical_policy_decision_bytes(&decision);
        let digest = Sha256::digest(&canonical);
        let signature = signing_key.sign(&digest);
        decision.signature = base64::engine::general_purpose::STANDARD.encode(signature.to_bytes());
        decision
    }

    #[test]
    fn robotics_safety_gate_defaults_to_deny() {
        let task_id = Uuid::new_v4();
        let action = test_governed_robotics_action();
        let decision = evaluate_robotics_safety_gate(
            None,
            task_id,
            "runtime-robot",
            "tenant-robot",
            &action,
            None,
            &[],
        );
        assert!(!decision.permitted);
        assert!(decision.reason.contains("missing signed policy verifier"));
    }

    #[test]
    fn robotics_safety_gate_requires_signed_policy_decision() {
        let signing_key = SigningKey::generate(&mut rand::rngs::OsRng);
        let verifying_key = signing_key.verifying_key();
        let task_id = Uuid::new_v4();
        let runtime_id = "runtime-robot";
        let tenant_id = "tenant-robot";
        let action = test_governed_robotics_action();
        let bounds = Bounds {
            cpu_percent: Some(50),
            memory_mb: None,
            max_tick_ms: Some(1_000),
        };
        let signed_decision = signed_policy_decision(
            &signing_key,
            task_id,
            tenant_id,
            runtime_id,
            action.clone(),
            true,
        );
        let decision = evaluate_robotics_safety_gate(
            Some(&verifying_key),
            task_id,
            runtime_id,
            tenant_id,
            &action,
            Some(&bounds),
            &[signed_decision],
        );
        assert!(decision.permitted);
        assert_eq!(decision.reason, "permitted");
        assert!(decision.policy_decision.is_some());
    }

    #[test]
    fn robotics_action_name_supports_mission_control_actions() {
        assert_eq!(
            robotics_action_name(&RoboticsAction::GetNavigationStatus),
            "get_navigation_status"
        );
        assert_eq!(
            robotics_action_name(&RoboticsAction::CancelNavigation),
            "cancel_navigation"
        );
        assert_eq!(
            robotics_action_name(&RoboticsAction::PublishVelocity {
                linear_x: 0.5,
                angular_z: 0.1,
            }),
            "publish_velocity"
        );
    }

    #[test]
    fn materialize_execution_graph_from_single_inference_creates_reason_node() {
        let graph = materialize_execution_graph(&TaskType::SingleInference {
            model: "gpt-4.1-mini".to_string(),
            messages: vec![ExecuteMessage {
                role: "user".to_string(),
                content: "hello".to_string(),
            }],
            max_tokens: Some(128),
            temperature: Some(0.2),
            stream: false,
            mode: Some("council".to_string()),
            memory: None,
            approval: None,
        })
        .unwrap();

        assert_eq!(graph.graph_id.as_deref(), Some("single_inference"));
        assert_eq!(graph.nodes.len(), 1);
        match &graph.nodes[0] {
            ExecutionNode::Reason {
                node_id,
                step_index,
                model,
                mode,
                ..
            } => {
                assert_eq!(node_id, "reason-0");
                assert_eq!(*step_index, Some(0));
                assert_eq!(model, "gpt-4.1-mini");
                assert_eq!(mode.as_deref(), Some("council"));
            }
            other => panic!("unexpected node: {:?}", other),
        }
    }

    #[test]
    fn compile_execution_graph_to_steps_preserves_node_metadata() {
        let graph = ExecutionGraph {
            graph_id: Some("graph-1".to_string()),
            blackboard: None,
            nodes: vec![ExecutionNode::Reason {
                node_id: "reason-node-1".to_string(),
                step_index: Some(7),
                checkpoint_key: Some("plan-1".to_string()),
                read_slots: Some(vec!["mission.goal".to_string()]),
                write_slot: Some("reason.plan".to_string()),
                model: "gpt-4.1-mini".to_string(),
                messages: vec![ExecuteMessage {
                    role: "user".to_string(),
                    content: "plan".to_string(),
                }],
                max_tokens: Some(64),
                temperature: None,
                mode: Some("speculative".to_string()),
                memory: None,
                approval: None,
            }],
        };

        let steps = compile_execution_graph_to_steps(&graph).unwrap();
        assert_eq!(steps.len(), 1);
        match &steps[0] {
            RuntimeTaskStep::Agent(step) => {
                assert_eq!(step.step_index, 7);
                assert_eq!(step.node_id.as_deref(), Some("reason-node-1"));
                assert_eq!(step.checkpoint_key.as_deref(), Some("plan-1"));
                assert_eq!(
                    step.read_slots.as_ref().unwrap(),
                    &vec!["mission.goal".to_string()]
                );
                assert_eq!(step.write_slot.as_deref(), Some("reason.plan"));
                assert_eq!(step.mode.as_deref(), Some("speculative"));
            }
            other => panic!("unexpected runtime step: {:?}", other),
        }
    }

    #[test]
    fn compile_execution_graph_supports_tool_nodes() {
        let graph = ExecutionGraph {
            graph_id: None,
            blackboard: None,
            nodes: vec![ExecutionNode::Tool {
                node_id: "tool-1".to_string(),
                tool_name: "web.search".to_string(),
                args: None,
                checkpoint_key: None,
                read_slots: Some(vec!["reason.plan".to_string()]),
                write_slot: Some("tool.search".to_string()),
            }],
        };

        let steps = compile_execution_graph_to_steps(&graph).unwrap();
        assert_eq!(steps.len(), 1);
        match &steps[0] {
            RuntimeTaskStep::Tool(ToolStep {
                node_id,
                tool_name,
                args,
                read_slots,
                write_slot,
                ..
            }) => {
                assert_eq!(node_id, "tool-1");
                assert_eq!(tool_name, "web.search");
                assert!(args.is_none());
                assert_eq!(
                    read_slots.as_ref().unwrap(),
                    &vec!["reason.plan".to_string()]
                );
                assert_eq!(write_slot.as_deref(), Some("tool.search"));
            }
            other => panic!("unexpected runtime step: {:?}", other),
        }
    }

    #[test]
    fn initialize_graph_blackboard_prefers_resume_state() {
        let graph = ExecutionGraph {
            graph_id: None,
            blackboard: Some(serde_json::json!({ "goal": "dock" })),
            nodes: vec![],
        };
        let resume_checkpoint = serde_json::json!({
            "graph_blackboard": {
                "goal": "resume",
                "nodes": {
                    "reason-1": "done"
                }
            }
        });

        let blackboard = initialize_graph_blackboard(&graph, Some(&resume_checkpoint));
        assert_eq!(blackboard["goal"], "resume");
        assert_eq!(blackboard["nodes"]["reason-1"], "done");
    }

    #[test]
    fn resolve_graph_value_substitutes_blackboard_placeholders() {
        let blackboard = serde_json::json!({
            "goal": "dock",
            "slots": {
                "reason.plan": "navigate"
            },
            "nodes": {
                "reason-1": {
                    "next_action": "navigate"
                }
            }
        });

        let resolved = resolve_graph_value(
            serde_json::json!({
                "prompt": "Proceed to ${goal}",
                "action": "${nodes.reason-1.next_action}"
            }),
            &blackboard,
        );

        assert_eq!(resolved["prompt"], "Proceed to dock");
        assert_eq!(resolved["action"], "navigate");
    }

    #[test]
    fn collect_slot_inputs_returns_requested_slot_values() {
        let blackboard = serde_json::json!({
            "slots": {
                "reason.plan": {"step":"navigate"},
                "robotics.pose": {"x": 1.0}
            }
        });

        let slots = collect_slot_inputs(
            &blackboard,
            Some(&["reason.plan".to_string(), "missing".to_string()]),
        );
        assert_eq!(slots.unwrap()["reason.plan"]["step"], "navigate");
    }

    #[test]
    fn stream_durability_metadata_tracks_replay_and_checkpoint_state() {
        let completed = TaskSubmitResponse {
            task_id: Uuid::nil(),
            steps_completed: 1,
            steps_total: 1,
            status: TaskStatus::Completed,
            checkpoint: Some(CheckpointPayload {
                task_id: Uuid::nil(),
                resume_token: ResumeToken {
                    last_committed_step: 1,
                    checkpoint_digest: [0xabu8; 32],
                    runtime_id: "runtime-1".to_string(),
                },
                wal_entries: vec![],
                metadata: None,
            }),
            final_output: Some("done".to_string()),
            usage: None,
            failure_details: None,
            execution_envelope: None,
            execution_receipt: None,
        };

        let completed_meta = stream_durability_metadata(Some(&completed));
        assert_eq!(completed_meta["mode"], "streaming");
        assert_eq!(completed_meta["resume_supported"], false);
        assert_eq!(completed_meta["replay_supported"], true);
        assert_eq!(completed_meta["replay_condition"], "completed-final-output");
        assert_eq!(completed_meta["checkpoint_persisted"], true);

        let incomplete_meta = stream_durability_metadata(None);
        assert_eq!(incomplete_meta["resume_supported"], false);
        assert_eq!(incomplete_meta["replay_supported"], false);
        assert_eq!(incomplete_meta["checkpoint_persisted"], false);
    }

    #[test]
    fn build_task_result_payload_includes_durability_metadata() {
        let response = TaskSubmitResponse {
            task_id: Uuid::nil(),
            steps_completed: 1,
            steps_total: 1,
            status: TaskStatus::Completed,
            checkpoint: None,
            final_output: Some("final".to_string()),
            usage: None,
            failure_details: None,
            execution_envelope: None,
            execution_receipt: None,
        };

        let payload = build_task_result_payload(&response);
        assert_eq!(payload["task_id"], Uuid::nil().to_string());
        assert_eq!(payload["durability"]["mode"], "streaming");
        assert_eq!(payload["durability"]["resume_supported"], false);
        assert_eq!(payload["durability"]["replay_supported"], true);
        assert_eq!(payload["durability"]["checkpoint_persisted"], false);
    }

    #[test]
    fn build_task_result_payload_includes_receipt_metadata() {
        let response = TaskSubmitResponse {
            task_id: Uuid::nil(),
            steps_completed: 1,
            steps_total: 1,
            status: TaskStatus::Completed,
            checkpoint: None,
            final_output: Some("final".to_string()),
            usage: None,
            failure_details: None,
            execution_envelope: None,
            execution_receipt: Some(serde_json::json!({
                "execution_id": "exec-1",
                "hash": "receipt-hash-1",
                "previous_hash": "prev-hash-0",
                "transaction_id": "tx-1",
                "transaction_hash": "tx-hash-1",
                "signature": "sig-1",
            })),
        };

        let payload = build_task_result_payload(&response);
        assert_eq!(payload["receipt"]["available"], true);
        assert_eq!(payload["receipt"]["execution_id"], "exec-1");
        assert_eq!(payload["receipt"]["receipt_hash"], "receipt-hash-1");
        assert_eq!(payload["receipt"]["previous_hash"], "prev-hash-0");
        assert_eq!(payload["receipt"]["transaction_id"], "tx-1");
        assert_eq!(payload["receipt"]["transaction_hash"], "tx-hash-1");
        assert_eq!(payload["receipt"]["signature_present"], true);
        assert_eq!(payload["execution_receipt"]["hash"], "receipt-hash-1");
    }

    #[test]
    fn build_task_result_payload_includes_failure_details() {
        let response = TaskSubmitResponse {
            task_id: Uuid::nil(),
            steps_completed: 2,
            steps_total: 5,
            status: TaskStatus::Failed {
                reason: "Step 3 failed: approval required for tool execution".to_string(),
            },
            checkpoint: None,
            final_output: None,
            usage: None,
            failure_details: Some(TaskFailureDetails {
                source: "runtime".to_string(),
                operation: "execution".to_string(),
                rejection_type: "step_failed".to_string(),
                message: "approval required for tool execution".to_string(),
                step_index: Some(3),
                domain: Some("tool".to_string()),
                node_id: Some("tool-3".to_string()),
            }),
            execution_envelope: None,
            execution_receipt: None,
        };

        let payload = build_task_result_payload(&response);
        assert_eq!(payload["failure_details"]["source"], "runtime");
        assert_eq!(payload["failure_details"]["operation"], "execution");
        assert_eq!(payload["failure_details"]["rejection_type"], "step_failed");
        assert_eq!(
            payload["failure_details"]["message"],
            "approval required for tool execution"
        );
        assert_eq!(payload["failure_details"]["step_index"], 3);
        assert_eq!(payload["failure_details"]["domain"], "tool");
        assert_eq!(payload["failure_details"]["node_id"], "tool-3");
    }

    #[test]
    fn runtime_execution_failure_details_include_step_metadata() {
        let step = RuntimeTaskStep::Tool(ToolStep {
            step_index: 3,
            node_id: "tool-3".to_string(),
            checkpoint_key: None,
            read_slots: None,
            write_slot: Some("tool.output".to_string()),
            tool_name: "web.search".to_string(),
            args: None,
        });

        let details = runtime_execution_failure_details(
            "step_failed",
            "approval required for tool execution",
            Some(&step),
        );

        assert_eq!(
            details,
            TaskFailureDetails {
                source: "runtime".to_string(),
                operation: "execution".to_string(),
                rejection_type: "step_failed".to_string(),
                message: "approval required for tool execution".to_string(),
                step_index: Some(3),
                domain: Some("tool".to_string()),
                node_id: Some("tool-3".to_string()),
            }
        );
    }

    #[test]
    fn attach_stream_task_headers_exposes_streaming_durability_contract() {
        let task_id = Uuid::new_v4();
        let mut response = Response::new(Body::empty());

        attach_stream_task_headers(&mut response, task_id);

        assert_eq!(
            response.headers()["x-igris-runtime-task-id"],
            task_id.to_string().as_str()
        );
        assert_eq!(
            response.headers()["x-igris-runtime-stream-resume-supported"],
            "false"
        );
        assert_eq!(
            response.headers()["x-igris-runtime-stream-replay-condition"],
            "completed-final-output"
        );
    }

    #[test]
    fn build_task_cancel_response_reports_persisted_terminal_status() {
        let task_id = Uuid::new_v4();
        let response = TaskSubmitResponse {
            task_id,
            steps_completed: 3,
            steps_total: 3,
            status: TaskStatus::Failed {
                reason: "task failed".to_string(),
            },
            checkpoint: Some(CheckpointPayload {
                task_id,
                resume_token: ResumeToken {
                    last_committed_step: 2,
                    checkpoint_digest: [0x11u8; 32],
                    runtime_id: "runtime-1".to_string(),
                },
                wal_entries: vec![],
                metadata: None,
            }),
            final_output: None,
            usage: None,
            failure_details: Some(TaskFailureDetails {
                source: "runtime".to_string(),
                operation: "execution".to_string(),
                rejection_type: "step_failed".to_string(),
                message: "approval required for tool execution".to_string(),
                step_index: Some(3),
                domain: Some("tool".to_string()),
                node_id: Some("tool-3".to_string()),
            }),
            execution_envelope: None,
            execution_receipt: None,
        };

        let (status, payload) = build_task_cancel_response(task_id, false, Some(&response));
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(payload["task_id"], task_id.to_string());
        assert_eq!(payload["known"], true);
        assert_eq!(payload["active_execution"], false);
        assert_eq!(payload["cancellation_allowed"], false);
        assert_eq!(payload["reason"], "task_execution_failed");
        assert_eq!(payload["checkpoint_persisted"], true);
        assert_eq!(payload["last_step"], 2);
        assert_eq!(
            payload["checkpoint_digest"],
            "1111111111111111111111111111111111111111111111111111111111111111"
        );
        assert_eq!(payload["status"]["status"], "failed");
        assert_eq!(payload["status"]["reason"], "task failed");
        assert_eq!(payload["durability"]["mode"], "streaming");
        assert_eq!(payload["durability"]["resume_supported"], false);
        assert_eq!(payload["durability"]["replay_supported"], false);
        assert_eq!(
            payload["durability"]["replay_condition"],
            "completed-final-output"
        );
        assert_eq!(payload["durability"]["checkpoint_persisted"], true);
        assert_eq!(payload["failure_details"]["source"], "runtime");
        assert_eq!(payload["failure_details"]["operation"], "execution");
        assert_eq!(payload["failure_details"]["rejection_type"], "step_failed");
        assert_eq!(
            payload["failure_details"]["message"],
            "approval required for tool execution"
        );
        assert_eq!(payload["failure_details"]["step_index"], 3);
        assert_eq!(payload["failure_details"]["domain"], "tool");
        assert_eq!(payload["failure_details"]["node_id"], "tool-3");
    }

    #[test]
    fn build_idempotency_conflict_payload_includes_existing_task_snapshot() {
        let response = TaskSubmitResponse {
            task_id: Uuid::new_v4(),
            steps_completed: 2,
            steps_total: 4,
            status: TaskStatus::Checkpointed {
                resume_token: ResumeToken {
                    last_committed_step: 2,
                    checkpoint_digest: [0x22u8; 32],
                    runtime_id: "runtime-1".to_string(),
                },
            },
            checkpoint: Some(CheckpointPayload {
                task_id: Uuid::nil(),
                resume_token: ResumeToken {
                    last_committed_step: 2,
                    checkpoint_digest: [0x22u8; 32],
                    runtime_id: "runtime-1".to_string(),
                },
                wal_entries: vec![],
                metadata: None,
            }),
            final_output: None,
            usage: None,
            failure_details: None,
            execution_envelope: None,
            execution_receipt: Some(serde_json::json!({
                "execution_id": "exec-2",
                "receipt_hash": "receipt-hash-2",
                "signature": "",
            })),
        };

        let payload = build_idempotency_conflict_payload(&response);
        assert_eq!(payload["error"]["type"], "idempotency_conflict");
        assert_eq!(payload["task"]["task_id"], response.task_id.to_string());
        assert_eq!(payload["task"]["steps_completed"], 2);
        assert_eq!(payload["task"]["steps_total"], 4);
        assert_eq!(payload["task"]["checkpoint_persisted"], true);
        assert_eq!(payload["task"]["last_step"], 2);
        assert_eq!(
            payload["task"]["checkpoint_digest"],
            "2222222222222222222222222222222222222222222222222222222222222222"
        );
        assert_eq!(payload["task"]["final_output_available"], false);
        assert_eq!(payload["task"]["status"]["status"], "checkpointed");
        assert_eq!(payload["task"]["receipt"]["available"], true);
        assert_eq!(payload["task"]["receipt"]["execution_id"], "exec-2");
        assert_eq!(payload["task"]["receipt"]["receipt_hash"], "receipt-hash-2");
        assert_eq!(payload["task"]["receipt"]["signature_present"], false);
    }

    #[test]
    fn build_checkpoint_mismatch_payload_includes_resume_details() {
        let task_id = Uuid::new_v4();
        let requested = ResumeToken {
            last_committed_step: 7,
            checkpoint_digest: [0x33u8; 32],
            runtime_id: "runtime-old".to_string(),
        };

        let payload =
            build_checkpoint_mismatch_payload(task_id, &requested, Some(6), [0x44u8; 32], true);
        assert_eq!(payload["error"]["type"], "checkpoint_mismatch");
        assert_eq!(payload["task_id"], task_id.to_string());
        assert_eq!(payload["resume"]["requested"], true);
        assert_eq!(payload["resume"]["resume_checkpoint_provided"], true);
        assert_eq!(
            payload["resume"]["requested_resume_from"]["last_committed_step"],
            7
        );
        assert_eq!(payload["resume"]["local_last_committed_step"], 6);
        assert_eq!(
            payload["resume"]["local_checkpoint_digest"],
            "4444444444444444444444444444444444444444444444444444444444444444"
        );
    }

    #[test]
    fn verified_resume_start_step_requires_digest_and_step_match() {
        let token = ResumeToken {
            last_committed_step: 7,
            checkpoint_digest: [0x33u8; 32],
            runtime_id: "runtime-old".to_string(),
        };

        assert_eq!(
            verified_resume_start_step(&token, Some(7), [0x33u8; 32]),
            Some(8)
        );
        assert_eq!(
            verified_resume_start_step(&token, Some(6), [0x33u8; 32]),
            None
        );
        assert_eq!(
            verified_resume_start_step(&token, Some(7), [0x44u8; 32]),
            None
        );
        assert_eq!(verified_resume_start_step(&token, None, [0x33u8; 32]), None);
    }

    #[test]
    fn build_stream_replay_unavailable_payload_includes_task_snapshot() {
        let response = TaskSubmitResponse {
            task_id: Uuid::new_v4(),
            steps_completed: 1,
            steps_total: 2,
            status: TaskStatus::Checkpointed {
                resume_token: ResumeToken {
                    last_committed_step: 1,
                    checkpoint_digest: [0x55u8; 32],
                    runtime_id: "runtime-2".to_string(),
                },
            },
            checkpoint: Some(CheckpointPayload {
                task_id: Uuid::nil(),
                resume_token: ResumeToken {
                    last_committed_step: 1,
                    checkpoint_digest: [0x55u8; 32],
                    runtime_id: "runtime-2".to_string(),
                },
                wal_entries: vec![],
                metadata: None,
            }),
            final_output: None,
            usage: None,
            failure_details: None,
            execution_envelope: None,
            execution_receipt: None,
        };

        let payload = build_stream_replay_unavailable_payload(&response);
        assert_eq!(payload["error"]["type"], "stream_replay_unavailable");
        assert_eq!(payload["task"]["task_id"], response.task_id.to_string());
        assert_eq!(payload["task"]["status"]["status"], "checkpointed");
        assert_eq!(payload["task"]["last_step"], 1);
        assert_eq!(
            payload["task"]["checkpoint_digest"],
            "5555555555555555555555555555555555555555555555555555555555555555"
        );
        assert_eq!(payload["durability"]["resume_supported"], false);
        assert_eq!(payload["durability"]["checkpoint_persisted"], true);
    }

    #[test]
    fn persist_task_status_index_writes_task_id_lookup() {
        let db_path = env::temp_dir().join(format!("igris-task-status-{}.db", Uuid::new_v4()));
        let storage = RedbStorage::new(&db_path).unwrap();
        let response = TaskSubmitResponse {
            task_id: Uuid::new_v4(),
            steps_completed: 1,
            steps_total: 1,
            status: TaskStatus::Completed,
            checkpoint: None,
            final_output: Some("done".to_string()),
            usage: None,
            failure_details: None,
            execution_envelope: None,
            execution_receipt: None,
        };

        persist_task_status_index(&storage, &response).unwrap();

        let stored = storage
            .get::<TaskSubmitResponse>(
                TASK_SUBMISSION_STATUS_BY_TASK_ID,
                &task_status_key(response.task_id),
            )
            .unwrap()
            .unwrap();
        assert!(matches!(stored.status, TaskStatus::Completed));
        assert_eq!(stored.final_output.as_deref(), Some("done"));

        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn compile_execution_graph_supports_human_approval_and_memory_nodes() {
        let graph = ExecutionGraph {
            graph_id: Some("ops-graph".to_string()),
            blackboard: None,
            nodes: vec![
                ExecutionNode::HumanApproval {
                    node_id: "approve-1".to_string(),
                    checkpoint_key: Some("approval-gate".to_string()),
                    read_slots: Some(vec!["reason.plan".to_string()]),
                    write_slot: Some("approval.result".to_string()),
                    task: "approve deployment".to_string(),
                    confidence: Some(0.8),
                    context: None,
                },
                ExecutionNode::MemoryRecall {
                    node_id: "recall-1".to_string(),
                    checkpoint_key: Some("memory-recall".to_string()),
                    read_slots: Some(vec!["reason.plan".to_string()]),
                    write_slot: Some("memory.recall".to_string()),
                    query: "recent incidents".to_string(),
                    top_k: Some(3),
                },
                ExecutionNode::MemoryStore {
                    node_id: "store-1".to_string(),
                    checkpoint_key: Some("memory-store".to_string()),
                    read_slots: Some(vec!["reason.plan".to_string()]),
                    write_slot: Some("memory.store".to_string()),
                    key: Some("incident-42".to_string()),
                    content: "resolved by restarting runtime".to_string(),
                },
            ],
        };

        let steps = compile_execution_graph_to_steps(&graph).unwrap();
        assert_eq!(steps.len(), 3);
        match &steps[0] {
            RuntimeTaskStep::HumanApproval(step) => {
                assert_eq!(step.node_id, "approve-1");
                assert_eq!(step.checkpoint_key.as_deref(), Some("approval-gate"));
                assert_eq!(step.write_slot.as_deref(), Some("approval.result"));
            }
            other => panic!("unexpected first step: {:?}", other),
        }
        match &steps[1] {
            RuntimeTaskStep::MemoryRecall(step) => {
                assert_eq!(step.node_id, "recall-1");
                assert_eq!(
                    step.read_slots.as_ref().unwrap(),
                    &vec!["reason.plan".to_string()]
                );
                assert_eq!(step.top_k, Some(3));
            }
            other => panic!("unexpected second step: {:?}", other),
        }
        match &steps[2] {
            RuntimeTaskStep::MemoryStore(step) => {
                assert_eq!(step.node_id, "store-1");
                assert_eq!(step.write_slot.as_deref(), Some("memory.store"));
                assert_eq!(step.key.as_deref(), Some("incident-42"));
            }
            other => panic!("unexpected third step: {:?}", other),
        }
    }

    #[test]
    fn approval_checkpoint_metadata_contains_task() {
        let step = RuntimeTaskStep::HumanApproval(HumanApprovalStep {
            step_index: 5,
            node_id: "approval-5".to_string(),
            checkpoint_key: Some("gate-5".to_string()),
            read_slots: Some(vec!["reason.plan".to_string()]),
            write_slot: Some("approval.result".to_string()),
            task: "approve mission".to_string(),
            confidence: Some(0.6),
            context: None,
        });
        let result = StepExecutionResult {
            output_text: "human approval granted for approve mission".to_string(),
            provider_name: "hitl:approval".to_string(),
            usage: ExecuteUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            graph_output: None,
            checkpoint_metadata: None,
            checkpoint_requested: false,
        };

        let metadata = build_step_checkpoint_metadata(&step, 6, &result);
        assert_eq!(metadata["domain"], "human_approval");
        assert_eq!(metadata["task"], "approve mission");
        assert_eq!(metadata["node_id"], "approval-5");
        assert_eq!(metadata["write_slot"], "approval.result");
    }

    #[test]
    fn agent_checkpoint_metadata_contains_mode_semantics() {
        let step = RuntimeTaskStep::Agent(super::AgentStep {
            step_index: 2,
            node_id: Some("reason-2".to_string()),
            checkpoint_key: Some("reason-key".to_string()),
            read_slots: Some(vec!["memory.context".to_string()]),
            write_slot: Some("reason.output".to_string()),
            model: "gpt-4.1-mini".to_string(),
            messages: vec![ExecuteMessage {
                role: "user".to_string(),
                content: "hello".to_string(),
            }],
            max_tokens: None,
            temperature: None,
            mode: Some("quality".to_string()),
            memory: None,
            approval: None,
        });
        let result = StepExecutionResult {
            output_text: "ok".to_string(),
            provider_name: "anthropic-sonnet".to_string(),
            usage: ExecuteUsage {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
            },
            graph_output: None,
            checkpoint_metadata: None,
            checkpoint_requested: false,
        };

        let metadata = build_step_checkpoint_metadata(&step, 3, &result);
        assert_eq!(metadata["requested_mode"], "quality");
        assert_eq!(metadata["resolved_strategy"], "provider_race_quality");
    }

    #[test]
    fn compile_execution_graph_supports_behavior_tree_nodes() {
        let graph = ExecutionGraph {
            graph_id: Some("bt-graph".to_string()),
            blackboard: Some(serde_json::json!({
                "goal": "dock"
            })),
            nodes: vec![ExecutionNode::BehaviorTree {
                node_id: "bt-node-1".to_string(),
                checkpoint_key: Some("bt-checkpoint".to_string()),
                read_slots: Some(vec!["reason.plan".to_string()]),
                write_slot: Some("bt.result".to_string()),
                tree: serde_json::json!({
                    "type": "sequence",
                    "children": [
                        { "type": "condition", "name": "battery_ok" },
                        { "type": "action", "name": "dispatch_task" }
                    ]
                }),
            }],
        };

        let steps = compile_execution_graph_to_steps(&graph).unwrap();
        assert_eq!(steps.len(), 1);
        match &steps[0] {
            RuntimeTaskStep::BehaviorTree(step) => {
                assert_eq!(step.node_id, "bt-node-1");
                assert_eq!(step.checkpoint_key.as_deref(), Some("bt-checkpoint"));
                assert_eq!(
                    step.read_slots.as_ref().unwrap(),
                    &vec!["reason.plan".to_string()]
                );
                assert_eq!(step.write_slot.as_deref(), Some("bt.result"));
                assert_eq!(step.blackboard, Some(serde_json::json!({ "goal": "dock" })));
            }
            other => panic!("unexpected runtime step: {:?}", other),
        }
    }

    #[test]
    fn behavior_tree_checkpoint_metadata_contains_node_id() {
        let step = RuntimeTaskStep::BehaviorTree(BehaviorTreeStep {
            step_index: 4,
            node_id: "bt-node-4".to_string(),
            checkpoint_key: Some("bt-key".to_string()),
            read_slots: Some(vec!["reason.plan".to_string()]),
            write_slot: Some("bt.result".to_string()),
            blackboard: None,
            tree: serde_json::json!({
                "type": "sequence",
                "children": []
            }),
        });
        let result = StepExecutionResult {
            output_text: "behavior tree node bt-node-4 completed successfully in 2 ticks"
                .to_string(),
            provider_name: "btree:bt-node-4".to_string(),
            usage: ExecuteUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            graph_output: None,
            checkpoint_metadata: Some(serde_json::json!({
                "tick_count": 2,
                "blackboard_state": {
                    "goal": "dock"
                }
            })),
            checkpoint_requested: false,
        };

        let metadata = build_step_checkpoint_metadata(&step, 5, &result);
        assert_eq!(metadata["domain"], "behavior_tree");
        assert_eq!(metadata["node_id"], "bt-node-4");
        assert_eq!(metadata["checkpoint_key"], "bt-key");
        assert_eq!(metadata["write_slot"], "bt.result");
        assert_eq!(metadata["tick_count"], 2);
        assert_eq!(metadata["blackboard_state"]["goal"], "dock");
    }

    #[test]
    fn update_graph_blackboard_persists_named_write_slots() {
        let mut blackboard = serde_json::json!({});
        let step = RuntimeTaskStep::Tool(ToolStep {
            step_index: 2,
            node_id: "tool-2".to_string(),
            checkpoint_key: Some("tool-key".to_string()),
            read_slots: Some(vec!["reason.plan".to_string()]),
            write_slot: Some("tool.fetch".to_string()),
            tool_name: "web.fetch".to_string(),
            args: None,
        });
        let result = StepExecutionResult {
            output_text: "fetched".to_string(),
            provider_name: "tool:web.fetch".to_string(),
            usage: ExecuteUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            graph_output: Some(serde_json::json!({"content":"fetched"})),
            checkpoint_metadata: None,
            checkpoint_requested: false,
        };

        update_graph_blackboard(&mut blackboard, &step, &result);
        assert_eq!(blackboard["nodes"]["tool-2"]["content"], "fetched");
        assert_eq!(blackboard["slots"]["tool.fetch"]["content"], "fetched");
    }
}
