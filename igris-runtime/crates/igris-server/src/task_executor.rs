//! Durable task execution with WAL-backed crash recovery.
//!
//! `POST /v1/runtime/task/submit`       — Submit a multi-step task with WAL tracking.
//! `GET  /v1/runtime/task/{task_id}/wal` — Retrieve WAL entries for reconciliation.

use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use base64::Engine;
use ed25519_dalek::Signer;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};
use tracing::{error, info, warn};
use uuid::Uuid;

use igris_wal::{CheckpointPayload, ResumeToken, StepType, WalEntry, WalLog};
use igris_core::storage::TASK_SUBMISSIONS;

use crate::receipt::ExecutionReceipt;
use crate::runtime_execute::{
    canonical_envelope_bytes, iso8601_now, token_estimate, Bounds, ExecuteMessage,
    ExecuteUsage, ExecutionEnvelope,
};
use crate::{AppState, CloudProviderWrapper};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStep {
    pub step_index: u32,
    pub model: String,
    pub messages: Vec<ExecuteMessage>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub mode: Option<String>,
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

fn default_orientation_w() -> f64 { 1.0 }
fn default_frame_id() -> String { "map".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum RoboticsAction {
    NavigateToPose {
        goal: NavigationGoalPayload,
        #[serde(default)]
        wait_timeout_ms: Option<u64>,
    },
    PublishPrompt {
        prompt: String,
    },
    PublishZeroVelocity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoboticsStep {
    pub step_index: u32,
    #[serde(flatten)]
    pub action: RoboticsAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TaskType {
    AgentWorkflow { steps: Vec<AgentStep> },
    RoboticsWorkflow { steps: Vec<RoboticsStep> },
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
    pub idempotency_key: String,
    pub tenant_id: String,
    #[serde(default)]
    pub deadline_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum TaskStatus {
    Completed,
    Checkpointed { resume_token: ResumeToken },
    Failed { reason: String },
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
    pub execution_envelope: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_receipt: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "domain", rename_all = "snake_case")]
enum RuntimeTaskStep {
    Agent(AgentStep),
    Robotics(RoboticsStep),
}

impl RuntimeTaskStep {
    fn step_index(&self) -> u32 {
        match self {
            Self::Agent(step) => step.step_index,
            Self::Robotics(step) => step.step_index,
        }
    }

    fn input_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }

    fn model_name(&self) -> &str {
        match self {
            Self::Agent(step) => step.model.as_str(),
            Self::Robotics(_) => "robotics",
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
                RoboticsAction::PublishPrompt { .. } => StepType::RoboticsAction {
                    action: "publish_prompt".to_string(),
                    target: None,
                },
                RoboticsAction::PublishZeroVelocity => StepType::RoboticsAction {
                    action: "publish_zero_velocity".to_string(),
                    target: None,
                },
            },
        }
    }
}

#[derive(Debug, Clone)]
struct StepExecutionResult {
    output_text: String,
    provider_name: String,
    usage: ExecuteUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct IdempotentTaskRecord {
    request_hash: String,
    response: TaskSubmitResponse,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AgentExecutionMode {
    Default,
    Speculative,
    Council,
}

pub async fn handle_task_submit(
    State(state): State<AppState>,
    Json(req): Json<TaskSubmitRequest>,
) -> impl IntoResponse {
    let submission_key = submission_key(&req.tenant_id, &req.idempotency_key);
    let request_hash = format!("{:x}", Sha256::digest(
        serde_json::to_vec(&serde_json::json!({
            "task_type": &req.task_type,
            "containment": &req.containment,
            "tenant_id": &req.tenant_id,
            "deadline_ms": &req.deadline_ms,
        }))
        .unwrap_or_default(),
    ));
    if let Ok(Some(existing)) = state.storage.get::<IdempotentTaskRecord>(TASK_SUBMISSIONS, &submission_key) {
        if existing.request_hash != request_hash {
            return (
                StatusCode::CONFLICT,
                Json(serde_json::json!({
                    "error": {
                        "message": "Idempotency key already used for a different task submission",
                        "type": "idempotency_conflict"
                    }
                })),
            ).into_response();
        }
        return (StatusCode::OK, Json(existing.response)).into_response();
    }

    if matches!(
        &req.task_type,
        TaskType::SingleInference {
            stream: true,
            ..
        }
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

    let runtime_id = state.swarm_peer_id.clone();
    let wal = WalLog::new(state.storage.clone(), req.task_id, runtime_id.clone());

    let start_step = if let Some(ref token) = req.resume_from {
        match wal.compute_checkpoint_digest() {
            Ok(local_digest) if local_digest == token.checkpoint_digest => {
                info!(task_id = %req.task_id, "Resume verified at step {}", token.last_committed_step);
                token.last_committed_step + 1
            }
            Ok(_) => {
                warn!(task_id = %req.task_id, "Checkpoint digest mismatch on resume");
                return (
                    StatusCode::CONFLICT,
                    Json(serde_json::json!({
                        "error": {
                            "message": "Checkpoint digest mismatch — WAL state diverged",
                            "type": "checkpoint_mismatch"
                        }
                    })),
                ).into_response();
            }
            Err(e) => {
                error!(task_id = %req.task_id, "WAL digest computation failed: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": { "message": "WAL error", "type": "wal_error" }
                    })),
                ).into_response();
            }
        }
    } else {
        0
    };

    let deadline = req.deadline_ms.unwrap_or(300_000);
    let max_tick_ms = req.containment.as_ref().and_then(|b| b.max_tick_ms).unwrap_or(30_000);
    let wall_start = Instant::now();

    let steps: Vec<RuntimeTaskStep> = match &req.task_type {
        TaskType::AgentWorkflow { steps } => steps.iter().cloned().map(RuntimeTaskStep::Agent).collect(),
        TaskType::RoboticsWorkflow { steps } => steps.iter().cloned().map(RuntimeTaskStep::Robotics).collect(),
        TaskType::SingleInference {
            model,
            messages,
            max_tokens,
            temperature,
            mode,
            ..
        } => {
            vec![RuntimeTaskStep::Agent(AgentStep {
                step_index: 0,
                model: model.clone(),
                messages: messages.clone(),
                max_tokens: *max_tokens,
                temperature: *temperature,
                mode: mode.clone(),
            })]
        }
    };

    let steps_total = steps.len() as u32;
    let mut steps_completed = start_step;
    let mut last_output: Option<String> = None;
    let mut last_usage: Option<ExecuteUsage> = None;
    let mut last_envelope: Option<serde_json::Value> = None;
    let mut last_receipt: Option<serde_json::Value> = None;
    let mut checkpoint: Option<CheckpointPayload> = None;
    let mut entries_since_checkpoint: Vec<WalEntry> = Vec::new();

    for step in steps.iter().filter(|step| step.step_index() >= start_step) {
        if wall_start.elapsed().as_millis() as u64 > deadline {
            let payload = match build_checkpoint(
                &wal,
                req.task_id,
                steps_completed.saturating_sub(1),
                runtime_id.clone(),
                entries_since_checkpoint.clone(),
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
                execution_envelope: last_envelope,
                execution_receipt: last_receipt,
            };
            let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
            return (
                StatusCode::OK,
                Json(response),
            ).into_response();
        }

        let input_digest: [u8; 32] = Sha256::digest(step.input_bytes()).into();
        let wal_entry = match wal.write_intent(step.step_index(), step.wal_step_type(), input_digest) {
            Ok(entry) => entry,
            Err(e) => {
                error!(task_id = %req.task_id, "WAL intent write failed: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": { "message": "WAL write failed", "type": "wal_error" }
                    })),
                ).into_response();
            }
        };

        let execution = match step {
            RuntimeTaskStep::Agent(agent_step) => execute_agent_step(state.clone(), agent_step, max_tick_ms).await,
            RuntimeTaskStep::Robotics(robotics_step) => {
                execute_robotics_step(state.clone(), robotics_step, max_tick_ms).await
            }
        };

        let step_result = match execution {
            Ok(result) => result,
            Err(e) => {
                warn!(task_id = %req.task_id, step = step.step_index(), "Task step failed: {}", e);
                let _ = wal.write_failed(wal_entry.entry_id, e.to_string());
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
                    execution_envelope: last_envelope,
                    execution_receipt: last_receipt,
                };
                let _ = persist_task_record(&state, &submission_key, &request_hash, &response);
                return (
                    StatusCode::OK,
                    Json(response),
                ).into_response();
            }
        };

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
                let _ = wal.write_failed(wal_entry.entry_id, format!("artifact build failed: {}", e));
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
                let _ = wal.write_failed(wal_entry.entry_id, "runtime has no signing key".to_string());
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

        let committed_entry = match wal.write_committed(wal_entry.entry_id, output_digest, signing_key.as_ref()) {
            Ok(entry) => entry,
            Err(e) => {
                error!(task_id = %req.task_id, "WAL commit write failed: {}", e);
                let _ = wal.write_failed(wal_entry.entry_id, format!("commit write failed: {}", e));
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": { "message": "WAL commit failed", "type": "wal_error" }
                    })),
                ).into_response();
            }
        };

        entries_since_checkpoint.push(committed_entry);
        steps_completed = step.step_index() + 1;
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
        execution_envelope: last_envelope,
        execution_receipt: last_receipt,
    };
    let _ = persist_task_record(&state, &submission_key, &request_hash, &response);

    (
        StatusCode::OK,
        Json(response),
    ).into_response()
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
        ).into_response(),
        Err(e) => {
            error!(task_id = %task_id, "Failed to read WAL entries: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": { "message": "Failed to read WAL", "type": "wal_error" }
                })),
            ).into_response()
        }
    }
}

fn build_checkpoint(
    wal: &WalLog,
    task_id: Uuid,
    last_committed_step: u32,
    runtime_id: String,
    wal_entries: Vec<WalEntry>,
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
    })
}

fn submission_key(tenant_id: &str, idempotency_key: &str) -> String {
    format!("{}:{}", tenant_id, idempotency_key)
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
    )
}

fn normalize_agent_mode(mode: Option<&str>) -> anyhow::Result<AgentExecutionMode> {
    match mode.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok(AgentExecutionMode::Default),
        Some("council") => Ok(AgentExecutionMode::Council),
        Some("speculative" | "thompson" | "latency" | "balanced" | "quality" | "cost") => {
            Ok(AgentExecutionMode::Speculative)
        }
        Some(other) => anyhow::bail!("unsupported task execution mode '{}'", other),
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
        let providers: Vec<CloudProviderWrapper> = state
            .cloud_providers
            .iter()
            .take(3)
            .map(|provider| CloudProviderWrapper(provider.clone()))
            .collect();

        match execution_mode {
            AgentExecutionMode::Default | AgentExecutionMode::Speculative => {
                if let Ok(result) = state.speculative_router.route(&prompt, providers).await {
                    return Ok((result.response, result.winner_id));
                }
            }
            AgentExecutionMode::Council => {
                if let Ok(result) = state.council_router.route(&prompt, providers.clone()).await {
                    return Ok((result.response, result.chairman_id));
                }

                if let Some(chairman_id) = providers.first().map(|provider| provider.id().to_string()) {
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

async fn execute_agent_step(
    state: AppState,
    step: &AgentStep,
    max_tick_ms: u64,
) -> anyhow::Result<StepExecutionResult> {
    let _ = step.temperature;
    let prompt = step
        .messages
        .iter()
        .map(|message| format!("{}: {}", message.role, message.content))
        .collect::<Vec<_>>()
        .join("\n");

    match tokio::time::timeout(
        Duration::from_millis(max_tick_ms),
        do_route(state, prompt, step.mode.as_deref()),
    )
    .await
    {
        Ok(Ok((content, provider_name))) => Ok(StepExecutionResult {
            usage: ExecuteUsage {
                prompt_tokens: step
                    .messages
                    .iter()
                    .map(|message| token_estimate(&message.content))
                    .sum(),
                completion_tokens: token_estimate(&content),
                total_tokens: step
                    .messages
                    .iter()
                    .map(|message| token_estimate(&message.content))
                    .sum::<u32>()
                    + token_estimate(&content),
            },
            output_text: content,
            provider_name,
        }),
        Ok(Err(e)) => Err(e),
        Err(_) => anyhow::bail!("timeout after {}ms", max_tick_ms),
    }
}

async fn execute_robotics_step(
    state: AppState,
    step: &RoboticsStep,
    max_tick_ms: u64,
) -> anyhow::Result<StepExecutionResult> {
    #[cfg(feature = "ros2")]
    {
        let manager = state
            .ros2_manager
            .clone()
            .ok_or_else(|| anyhow::anyhow!("ROS2 manager is not enabled on this runtime"))?;

        if manager.is_safe_idle() {
            anyhow::bail!("robotics execution blocked: runtime is in safe-idle containment mode");
        }

        match &step.action {
            RoboticsAction::NavigateToPose { goal, wait_timeout_ms } => {
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
                let nav_state = tokio::time::timeout(Duration::from_millis(timeout_ms), handle.wait())
                    .await
                    .map_err(|_| anyhow::anyhow!("navigation timed out after {}ms", timeout_ms))??;
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
                            goal.frame_id, goal_id, feedback.distance_remaining, feedback.estimated_time_remaining
                        ),
                        usage: ExecuteUsage {
                            prompt_tokens: 0,
                            completion_tokens: 0,
                            total_tokens: 0,
                        },
                    }),
                    igris_ros2::NavigationState::Failed(reason) => anyhow::bail!("navigation failed: {}", reason),
                    igris_ros2::NavigationState::Canceled => anyhow::bail!("navigation canceled"),
                    other => anyhow::bail!("navigation ended in unexpected state {:?}", other),
                }
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
                })
            }
        }
    }

    #[cfg(not(feature = "ros2"))]
    {
        let _ = (state, step, max_tick_ms);
        anyhow::bail!("robotics task execution requires a runtime built with the robotics-platform feature")
    }
}

async fn build_execution_artifacts(
    state: &AppState,
    req: &TaskSubmitRequest,
    step: &RuntimeTaskStep,
    result: &StepExecutionResult,
    wall_time_ms: u64,
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
        None,
    );
    let hash = Sha256::digest(&canon);
    let sig = signing_key.sign(&hash);
    let envelope = ExecutionEnvelope {
        bounds_applied: req.containment.clone(),
        execution_id,
        finish_reason,
        model: step.model_name().to_string(),
        request_hash,
        response_hash,
        routing_decision: result.provider_name.clone(),
        signature: base64::engine::general_purpose::STANDARD.encode(sig.to_bytes()),
        tenant_id: tenant_id.clone(),
        timestamp,
        violation: None,
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
                false,
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
            false,
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

#[cfg(test)]
mod tests {
    use super::{normalize_agent_mode, AgentExecutionMode};

    #[test]
    fn normalize_agent_mode_accepts_supported_values() {
        assert_eq!(normalize_agent_mode(None).unwrap(), AgentExecutionMode::Default);
        assert_eq!(
            normalize_agent_mode(Some("speculative")).unwrap(),
            AgentExecutionMode::Speculative
        );
        assert_eq!(
            normalize_agent_mode(Some("latency")).unwrap(),
            AgentExecutionMode::Speculative
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
}
