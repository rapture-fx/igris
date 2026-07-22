package api

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/internal"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
)

type publicTaskSubmitRequest struct {
	TaskID               uuid.UUID                       `json:"task_id,omitempty"`
	TaskType             string                          `json:"task_type"`
	TaskDefinition       json.RawMessage                 `json:"task_definition"`
	AgentTask            *publicAgentTask                `json:"agent_task,omitempty"`
	RoboticsMission      *publicRoboticsMission          `json:"robotics_mission,omitempty"`
	ActionTask           *publicActionTask               `json:"action_task,omitempty"`
	AgentIdentity        *coordinator.AgentIdentity      `json:"agent_identity,omitempty"`
	RequiredCapabilities []string                        `json:"required_capabilities,omitempty"`
	CredentialRequests   []coordinator.CredentialRequest `json:"credential_requests,omitempty"`
	IdempotencyKey       string                          `json:"idempotency_key,omitempty"`
	DeadlineAt           *time.Time                      `json:"deadline_at,omitempty"`
}

// publicActionTask is the customer-facing shape for an Action Task V1 — a small,
// auditable sequence of controlled local actions (read a file, call a localhost
// HTTP endpoint, write one row to a clearly-named test table). Internally it is
// compiled to a runtime execution graph whose nodes are the sandboxed local
// tools (`filesystem`, `http_request`, `database_write`). It is intentionally
// not a connector framework: only the three actions below are supported.
type publicActionTask struct {
	Name                 string             `json:"name,omitempty"`
	Steps                []publicActionStep `json:"steps,omitempty"`
	CheckpointAfterSteps *uint32            `json:"checkpoint_after_steps,omitempty"`
}

type publicActionStep struct {
	Action string `json:"action"` // "read_file" | "http_call" | "db_write"

	// read_file
	Path string `json:"path,omitempty"`

	// http_call
	Method  string            `json:"method,omitempty"`
	URL     string            `json:"url,omitempty"`
	Body    string            `json:"body,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`

	// db_write
	Table  string                 `json:"table,omitempty"`
	Record map[string]interface{} `json:"record,omitempty"`
}

type publicAgentTask struct {
	Name                 string               `json:"name,omitempty"`
	Model                string               `json:"model,omitempty"`
	Messages             []publicAgentMessage `json:"messages,omitempty"`
	MaxTokens            *uint32              `json:"max_tokens,omitempty"`
	Temperature          *float32             `json:"temperature,omitempty"`
	Mode                 string               `json:"mode,omitempty"`
	Memory               *publicAgentMemory   `json:"memory,omitempty"`
	Approval             *publicApproval      `json:"approval,omitempty"`
	Steps                []publicAgentStep    `json:"steps,omitempty"`
	CheckpointAfterSteps *uint32              `json:"checkpoint_after_steps,omitempty"`
}

type publicAgentStep struct {
	Model       string               `json:"model,omitempty"`
	Messages    []publicAgentMessage `json:"messages,omitempty"`
	MaxTokens   *uint32              `json:"max_tokens,omitempty"`
	Temperature *float32             `json:"temperature,omitempty"`
	Mode        string               `json:"mode,omitempty"`
	Memory      *publicAgentMemory   `json:"memory,omitempty"`
	Approval    *publicApproval      `json:"approval,omitempty"`
}

type publicAgentMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type publicAgentMemory struct {
	RecallQuery string  `json:"recall_query,omitempty"`
	RecallTopK  *uint32 `json:"recall_top_k,omitempty"`
	StoreKey    string  `json:"store_key,omitempty"`
	StoreOutput bool    `json:"store_output,omitempty"`
}

type publicRoboticsMission struct {
	Name                     string              `json:"name,omitempty"`
	Waypoints                []publicMissionGoal `json:"waypoints,omitempty"`
	Prompt                   string              `json:"prompt,omitempty"`
	PublishVelocity          *publicVelocityStep `json:"publish_velocity,omitempty"`
	EmitZeroVelocityOnFinish bool                `json:"emit_zero_velocity_on_finish,omitempty"`
	Approval                 *publicApproval     `json:"approval,omitempty"`
	WaitTimeoutMs            *uint64             `json:"wait_timeout_ms,omitempty"`
}

type publicMissionGoal struct {
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	Z            float64 `json:"z,omitempty"`
	OrientationW float64 `json:"orientation_w,omitempty"`
	FrameID      string  `json:"frame_id,omitempty"`
}

type publicVelocityStep struct {
	LinearX  float64 `json:"linear_x"`
	AngularZ float64 `json:"angular_z"`
}

type publicApproval struct {
	Required   bool                   `json:"required,omitempty"`
	Task       string                 `json:"task,omitempty"`
	Confidence *float32               `json:"confidence,omitempty"`
	Context    map[string]interface{} `json:"context,omitempty"`
}

var runtimeCancelTask = func(ctx context.Context, runtimeEndpoint string, taskID uuid.UUID, tenantID string) (*internal.RuntimeCancelResult, error) {
	return internal.NewRuntimeClient(runtimeEndpoint).CancelTask(ctx, taskID, tenantID)
}

// RegisterTaskRoutes wires the durable task execution endpoints.
//
//	POST   /v1/tasks/submit           — submit a new task (agent workflow, robotics workflow, single inference, or behavior tree)
//	GET    /v1/tasks/:id              — poll task status
//	GET    /v1/tasks                  — list recent tasks for the tenant
//	GET    /v1/tasks/proof/readiness  — report whether trigger-backed proof sync is active
//	POST   /v1/tasks/:id/cancel       — cancel an in-flight durable task
//	POST   /v1/tasks/:id/checkpoint   — runtime pushes a checkpoint back to Overture
//	POST   /v1/tasks/:id/complete     — runtime signals task completion
//	POST   /v1/tasks/:id/failed       — runtime signals task failure
func RegisterTaskRoutes(app *fiber.App, db *sql.DB, tc *coordinator.TaskCoordinator) {
	v1 := app.Group("/v1/tasks")
	v1.Use(middleware.BetterAuth(db))

	v1.Post("/submit", handleTaskSubmit(tc))
	v1.Get("", handleListTasks(tc))
	v1.Get("/proof/readiness", handleTaskProofReadiness(tc))
	v1.Get("/:id", handleGetTask(tc))
	v1.Get("/:id/steps", handleGetTaskSteps(tc))
	v1.Post("/:id/cancel", handleTaskCancel(tc))
	v1.Post("/:id/proof/verify", handleVerifyTaskProof(tc))

	// These three are called by the runtime itself (internal).
	// They use the same Clerk auth — the runtime forwards the tenant context.
	v1.Post("/:id/checkpoint", handleTaskCheckpoint(tc))
	v1.Post("/:id/complete", handleTaskComplete(tc))
	v1.Post("/:id/failed", handleTaskFailed(tc))
}

func handleTaskSubmit(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		req, err := buildTaskSubmitRequest(c.Body(), tenantID)
		if err != nil {
			if errors.Is(err, coordinator.ErrInvalidTaskDefinition) {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{
					"error":   "invalid_task_definition",
					"message": err.Error(),
				})
			}
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}

		if len(req.TaskDefinition) == 0 {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "task_definition required"})
		}
		if req.TaskType == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "task_type required"})
		}

		task, err := tc.Submit(c.Context(), req)
		if err != nil {
			if errors.Is(err, coordinator.ErrInvalidTaskDefinition) {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{
					"error":   "invalid_task_definition",
					"message": err.Error(),
				})
			}
			if errors.Is(err, coordinator.ErrTaskCapabilityDenied) {
				return c.Status(http.StatusForbidden).JSON(fiber.Map{
					"error":   "capability_policy_denied",
					"message": err.Error(),
				})
			}
			if errors.Is(err, coordinator.ErrExecutionInputProtectionUnavailable) {
				return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
					"error":   "input_protection_unavailable",
					"message": "this task's input requires encrypted input protection, but the input-ref keyring is not configured or failed; set IGRIS_EXECUTION_INPUT_REF_KEYS and IGRIS_EXECUTION_INPUT_REF_ACTIVE_KEY_VERSION",
				})
			}
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Tasks] Submit failed")
			return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
				"error":   "dispatch_failed",
				"message": err.Error(),
			})
		}

		return c.Status(http.StatusAccepted).JSON(buildTaskAcceptedResponse(task))
	}
}

func buildTaskSubmitRequest(body []byte, tenantID string) (*coordinator.TaskSubmitRequest, error) {
	var raw publicTaskSubmitRequest
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	if conflictingTaskInputCount(raw) > 1 {
		return nil, fmt.Errorf("%w: provide only one of task_definition, agent_task, robotics_mission, or action_task", coordinator.ErrInvalidTaskDefinition)
	}

	taskDefinition := raw.TaskDefinition
	taskType := raw.TaskType
	if len(taskDefinition) == 0 {
		switch {
		case raw.AgentTask != nil:
			var err error
			taskDefinition, err = buildAgentTaskDefinition(raw.TaskType, raw.AgentTask)
			if err != nil {
				return nil, err
			}
		case raw.RoboticsMission != nil:
			var err error
			taskDefinition, err = buildRoboticsMissionTaskDefinition(raw.RoboticsMission, raw.TaskType)
			if err != nil {
				return nil, err
			}
		case raw.ActionTask != nil:
			if raw.TaskType != "" && raw.TaskType != "action_workflow" {
				return nil, fmt.Errorf("%w: action_task is only valid with task_type=action_workflow", coordinator.ErrInvalidTaskDefinition)
			}
			var err error
			taskDefinition, err = buildActionWorkflowDefinition(raw.ActionTask)
			if err != nil {
				return nil, err
			}
			// An Action Task is dispatched to the runtime as an execution graph
			// of sandboxed local tools — the coordinator and runtime never need
			// to know about a separate task type.
			taskType = "execution_graph"
		}
	}

	return &coordinator.TaskSubmitRequest{
		TaskID:               raw.TaskID,
		TenantID:             tenantID,
		TaskType:             taskType,
		TaskDefinition:       taskDefinition,
		AgentIdentity:        raw.AgentIdentity,
		RequiredCapabilities: raw.RequiredCapabilities,
		CredentialRequests:   raw.CredentialRequests,
		IdempotencyKey:       raw.IdempotencyKey,
		DeadlineAt:           raw.DeadlineAt,
	}, nil
}

func conflictingTaskInputCount(raw publicTaskSubmitRequest) int {
	count := 0
	if len(raw.TaskDefinition) > 0 {
		count++
	}
	if raw.AgentTask != nil {
		count++
	}
	if raw.RoboticsMission != nil {
		count++
	}
	if raw.ActionTask != nil {
		count++
	}
	return count
}

func buildAgentTaskDefinition(taskType string, task *publicAgentTask) (json.RawMessage, error) {
	if task == nil {
		return nil, fmt.Errorf("%w: agent_task is required", coordinator.ErrInvalidTaskDefinition)
	}

	switch taskType {
	case "execution_graph":
		return buildAgentExecutionGraphDefinition(task)
	case "single_inference":
		if len(task.Steps) > 0 {
			return nil, fmt.Errorf("%w: agent_task.steps is only valid with task_type=agent_workflow", coordinator.ErrInvalidTaskDefinition)
		}
		if err := requirePublicAgentMessages(task.Model, task.Messages); err != nil {
			return nil, err
		}
		return json.Marshal(map[string]interface{}{
			"model":       task.Model,
			"messages":    buildAgentMessages(task.Messages),
			"max_tokens":  optionalUint32(task.MaxTokens),
			"temperature": optionalFloat32(task.Temperature),
			"mode":        optionalString(task.Mode),
			"memory":      buildAgentMemory(task.Memory),
			"approval":    buildTaskApproval(task.Approval, task.Name, "single_inference", 0),
		})
	case "agent_workflow":
		steps, err := buildAgentWorkflowSteps(task)
		if err != nil {
			return nil, err
		}
		definition := map[string]interface{}{
			"steps": steps,
		}
		if task.CheckpointAfterSteps != nil {
			definition["checkpoint_after_steps"] = *task.CheckpointAfterSteps
		}
		return json.Marshal(definition)
	default:
		return nil, fmt.Errorf("%w: agent_task is only valid with task_type=single_inference, task_type=agent_workflow, or task_type=execution_graph", coordinator.ErrInvalidTaskDefinition)
	}
}

func buildAgentWorkflowSteps(task *publicAgentTask) ([]map[string]interface{}, error) {
	steps := make([]map[string]interface{}, 0, max(1, len(task.Steps)))
	if len(task.Steps) == 0 {
		if err := requirePublicAgentMessages(task.Model, task.Messages); err != nil {
			return nil, err
		}
		steps = append(steps, buildAgentStepDefinition(1, task.Name, publicAgentStep{
			Model:       task.Model,
			Messages:    task.Messages,
			MaxTokens:   task.MaxTokens,
			Temperature: task.Temperature,
			Mode:        task.Mode,
			Memory:      task.Memory,
			Approval:    task.Approval,
		}))
		return steps, nil
	}

	for idx, step := range task.Steps {
		if err := requirePublicAgentMessages(step.Model, step.Messages); err != nil {
			return nil, fmt.Errorf("%w: agent_task.steps[%d]: %s", coordinator.ErrInvalidTaskDefinition, idx, unwrapTaskDefinitionError(err))
		}
		steps = append(steps, buildAgentStepDefinition(idx+1, task.Name, step))
	}
	return steps, nil
}

func buildAgentExecutionGraphDefinition(task *publicAgentTask) (json.RawMessage, error) {
	nodes := make([]map[string]interface{}, 0, max(1, len(task.Steps)))
	if len(task.Steps) == 0 {
		if err := requirePublicAgentMessages(task.Model, task.Messages); err != nil {
			return nil, err
		}
		nodes = append(nodes, buildAgentReasonNode(0, task.Name, publicAgentStep{
			Model:       task.Model,
			Messages:    task.Messages,
			MaxTokens:   task.MaxTokens,
			Temperature: task.Temperature,
			Mode:        task.Mode,
			Memory:      task.Memory,
			Approval:    task.Approval,
		}))
	} else {
		for idx, step := range task.Steps {
			if err := requirePublicAgentMessages(step.Model, step.Messages); err != nil {
				return nil, fmt.Errorf("%w: agent_task.steps[%d]: %s", coordinator.ErrInvalidTaskDefinition, idx, unwrapTaskDefinitionError(err))
			}
			nodes = append(nodes, buildAgentReasonNode(idx, task.Name, step))
		}
	}

	return buildExecutionGraphDefinition(task.Name, nodes)
}

func buildAgentStepDefinition(stepIndex int, taskName string, step publicAgentStep) map[string]interface{} {
	definition := map[string]interface{}{
		"step_index": stepIndex,
		"model":      step.Model,
		"messages":   buildAgentMessages(step.Messages),
	}
	if step.MaxTokens != nil {
		definition["max_tokens"] = *step.MaxTokens
	}
	if step.Temperature != nil {
		definition["temperature"] = *step.Temperature
	}
	if step.Mode != "" {
		definition["mode"] = step.Mode
	}
	if memory := buildAgentMemory(step.Memory); memory != nil {
		definition["memory"] = memory
	}
	if approval := buildTaskApproval(step.Approval, taskName, "agent_step", stepIndex); approval != nil {
		definition["approval"] = approval
	}
	return definition
}

func buildAgentReasonNode(stepIndex int, taskName string, step publicAgentStep) map[string]interface{} {
	nodeID := fmt.Sprintf("%s-%d", defaultTaskName(taskName, "reason"), stepIndex)
	node := map[string]interface{}{
		"kind":       "reason",
		"node_id":    nodeID,
		"step_index": stepIndex,
		"write_slot": defaultGraphWriteSlot("reason", stepIndex, nodeID),
		"model":      step.Model,
		"messages":   buildAgentMessages(step.Messages),
	}
	if step.MaxTokens != nil {
		node["max_tokens"] = *step.MaxTokens
	}
	if step.Temperature != nil {
		node["temperature"] = *step.Temperature
	}
	if step.Mode != "" {
		node["mode"] = step.Mode
	}
	if memory := buildAgentMemory(step.Memory); memory != nil {
		node["memory"] = memory
	}
	if approval := buildTaskApproval(step.Approval, taskName, "reason", stepIndex); approval != nil {
		node["approval"] = approval
	}
	node["checkpoint_key"] = fmt.Sprintf("%s-checkpoint-%d", defaultTaskName(taskName, "reason"), stepIndex)
	return node
}

func buildAgentMessages(messages []publicAgentMessage) []map[string]interface{} {
	built := make([]map[string]interface{}, 0, len(messages))
	for _, message := range messages {
		built = append(built, map[string]interface{}{
			"role":    message.Role,
			"content": message.Content,
		})
	}
	return built
}

func buildAgentMemory(memory *publicAgentMemory) map[string]interface{} {
	if memory == nil {
		return nil
	}
	payload := map[string]interface{}{}
	if memory.RecallQuery != "" {
		payload["recall_query"] = memory.RecallQuery
	}
	if memory.RecallTopK != nil {
		payload["recall_top_k"] = *memory.RecallTopK
	}
	if memory.StoreKey != "" {
		payload["store_key"] = memory.StoreKey
	}
	if memory.StoreOutput {
		payload["store_output"] = true
	}
	if len(payload) == 0 {
		return nil
	}
	return payload
}

func requirePublicAgentMessages(model string, messages []publicAgentMessage) error {
	if model == "" {
		return fmt.Errorf("%w: model is required", coordinator.ErrInvalidTaskDefinition)
	}
	if len(messages) == 0 {
		return fmt.Errorf("%w: messages must contain at least one message", coordinator.ErrInvalidTaskDefinition)
	}
	for idx, message := range messages {
		if message.Role == "" {
			return fmt.Errorf("%w: messages[%d].role is required", coordinator.ErrInvalidTaskDefinition, idx)
		}
		if message.Content == "" {
			return fmt.Errorf("%w: messages[%d].content is required", coordinator.ErrInvalidTaskDefinition, idx)
		}
	}
	return nil
}

func buildRoboticsMissionTaskDefinition(mission *publicRoboticsMission, taskType ...string) (json.RawMessage, error) {
	if mission == nil {
		return nil, fmt.Errorf("%w: robotics_mission is required", coordinator.ErrInvalidTaskDefinition)
	}
	targetTaskType := "robotics_workflow"
	if len(taskType) > 0 && taskType[0] != "" {
		targetTaskType = taskType[0]
	}
	if targetTaskType != "robotics_workflow" && targetTaskType != "execution_graph" {
		return nil, fmt.Errorf("%w: robotics_mission is only valid with task_type=robotics_workflow or task_type=execution_graph", coordinator.ErrInvalidTaskDefinition)
	}

	if targetTaskType == "execution_graph" {
		return buildRoboticsExecutionGraphDefinition(mission)
	}

	steps := make([]map[string]interface{}, 0, len(mission.Waypoints)+3)
	stepIndex := 1
	for idx, waypoint := range mission.Waypoints {
		goal := map[string]interface{}{
			"x": waypoint.X,
			"y": waypoint.Y,
		}
		if waypoint.Z != 0 {
			goal["z"] = waypoint.Z
		}
		if waypoint.OrientationW != 0 {
			goal["orientation_w"] = waypoint.OrientationW
		}
		if waypoint.FrameID != "" {
			goal["frame_id"] = waypoint.FrameID
		}

		step := map[string]interface{}{
			"step_index": stepIndex,
			"action":     "navigate_to_pose",
			"goal":       goal,
		}
		if mission.WaitTimeoutMs != nil {
			step["wait_timeout_ms"] = *mission.WaitTimeoutMs
		}
		if approval := buildTaskApproval(mission.Approval, mission.Name, "navigate_to_pose", idx+1); approval != nil {
			step["approval"] = approval
		}
		steps = append(steps, step)
		stepIndex++
	}

	if mission.Prompt != "" {
		step := map[string]interface{}{
			"step_index": stepIndex,
			"action":     "publish_prompt",
			"prompt":     mission.Prompt,
		}
		if approval := buildTaskApproval(mission.Approval, mission.Name, "publish_prompt", 0); approval != nil {
			step["approval"] = approval
		}
		steps = append(steps, step)
		stepIndex++
	}

	if mission.PublishVelocity != nil {
		step := map[string]interface{}{
			"step_index": stepIndex,
			"action":     "publish_velocity",
			"linear_x":   mission.PublishVelocity.LinearX,
			"angular_z":  mission.PublishVelocity.AngularZ,
		}
		if approval := buildTaskApproval(mission.Approval, mission.Name, "publish_velocity", 0); approval != nil {
			step["approval"] = approval
		}
		steps = append(steps, step)
		stepIndex++
	}

	if mission.EmitZeroVelocityOnFinish {
		step := map[string]interface{}{
			"step_index": stepIndex,
			"action":     "publish_zero_velocity",
		}
		if approval := buildTaskApproval(mission.Approval, mission.Name, "publish_zero_velocity", 0); approval != nil {
			step["approval"] = approval
		}
		steps = append(steps, step)
	}

	if len(steps) == 0 {
		return nil, fmt.Errorf("%w: robotics_mission must include at least one waypoint, prompt, or velocity action", coordinator.ErrInvalidTaskDefinition)
	}

	definition, err := json.Marshal(map[string]interface{}{
		"steps": steps,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: could not encode robotics_mission", coordinator.ErrInvalidTaskDefinition)
	}

	return definition, nil
}

func buildRoboticsExecutionGraphDefinition(mission *publicRoboticsMission) (json.RawMessage, error) {
	nodes := make([]map[string]interface{}, 0, len(mission.Waypoints)+3)
	nodeIndex := 0
	for idx, waypoint := range mission.Waypoints {
		goal := map[string]interface{}{
			"x": waypoint.X,
			"y": waypoint.Y,
		}
		if waypoint.Z != 0 {
			goal["z"] = waypoint.Z
		}
		if waypoint.OrientationW != 0 {
			goal["orientation_w"] = waypoint.OrientationW
		}
		if waypoint.FrameID != "" {
			goal["frame_id"] = waypoint.FrameID
		}

		node := map[string]interface{}{
			"kind":           "robotics",
			"node_id":        fmt.Sprintf("%s-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex),
			"step_index":     nodeIndex,
			"checkpoint_key": fmt.Sprintf("%s-checkpoint-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex),
			"write_slot":     defaultGraphWriteSlot("robotics", nodeIndex, fmt.Sprintf("%s-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex)),
			"action":         "navigate_to_pose",
			"goal":           goal,
		}
		if mission.WaitTimeoutMs != nil {
			node["wait_timeout_ms"] = *mission.WaitTimeoutMs
		}
		if approval := buildTaskApproval(mission.Approval, mission.Name, "navigate_to_pose", idx+1); approval != nil {
			node["approval"] = approval
		}
		nodes = append(nodes, node)
		nodeIndex++
	}

	if mission.Prompt != "" {
		node := map[string]interface{}{
			"kind":           "robotics",
			"node_id":        fmt.Sprintf("%s-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex),
			"step_index":     nodeIndex,
			"checkpoint_key": fmt.Sprintf("%s-checkpoint-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex),
			"write_slot":     defaultGraphWriteSlot("robotics", nodeIndex, fmt.Sprintf("%s-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex)),
			"action":         "publish_prompt",
			"prompt":         mission.Prompt,
		}
		if approval := buildTaskApproval(mission.Approval, mission.Name, "publish_prompt", 0); approval != nil {
			node["approval"] = approval
		}
		nodes = append(nodes, node)
		nodeIndex++
	}

	if mission.PublishVelocity != nil {
		node := map[string]interface{}{
			"kind":           "robotics",
			"node_id":        fmt.Sprintf("%s-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex),
			"step_index":     nodeIndex,
			"checkpoint_key": fmt.Sprintf("%s-checkpoint-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex),
			"write_slot":     defaultGraphWriteSlot("robotics", nodeIndex, fmt.Sprintf("%s-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex)),
			"action":         "publish_velocity",
			"linear_x":       mission.PublishVelocity.LinearX,
			"angular_z":      mission.PublishVelocity.AngularZ,
		}
		if approval := buildTaskApproval(mission.Approval, mission.Name, "publish_velocity", 0); approval != nil {
			node["approval"] = approval
		}
		nodes = append(nodes, node)
		nodeIndex++
	}

	if mission.EmitZeroVelocityOnFinish {
		node := map[string]interface{}{
			"kind":           "robotics",
			"node_id":        fmt.Sprintf("%s-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex),
			"step_index":     nodeIndex,
			"checkpoint_key": fmt.Sprintf("%s-checkpoint-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex),
			"write_slot":     defaultGraphWriteSlot("robotics", nodeIndex, fmt.Sprintf("%s-%d", defaultTaskName(mission.Name, "robotics"), nodeIndex)),
			"action":         "publish_zero_velocity",
		}
		if approval := buildTaskApproval(mission.Approval, mission.Name, "publish_zero_velocity", 0); approval != nil {
			node["approval"] = approval
		}
		nodes = append(nodes, node)
	}

	if len(nodes) == 0 {
		return nil, fmt.Errorf("%w: robotics_mission must include at least one waypoint, prompt, or velocity action", coordinator.ErrInvalidTaskDefinition)
	}

	return buildExecutionGraphDefinition(mission.Name, nodes)
}

// buildActionWorkflowDefinition compiles an Action Task V1 (`action_task`) into
// a runtime execution graph whose nodes are the sandboxed local tools. Each
// action maps to exactly one tool:
//
//	read_file  -> kind=tool tool_name=filesystem     args={operation:read, path}
//	http_call  -> kind=tool tool_name=http_request   args={method, url, body?, headers?}
//	db_write   -> kind=tool tool_name=database_write  args={table, record}
//
// Node ids are `<action>-<index>` so the action sequence is visible in task
// detail and the WAL step list. checkpoint_after_steps is threaded through to
// the runtime execution_graph path so recovery proofs can checkpoint after a
// committed action and resume without replaying that side effect.
func buildActionWorkflowDefinition(task *publicActionTask) (json.RawMessage, error) {
	if task == nil {
		return nil, fmt.Errorf("%w: action_task is required", coordinator.ErrInvalidTaskDefinition)
	}
	if len(task.Steps) == 0 {
		return nil, fmt.Errorf("%w: action_task.steps must contain at least one step", coordinator.ErrInvalidTaskDefinition)
	}
	name := defaultTaskName(task.Name, "action")
	nodes := make([]map[string]interface{}, 0, len(task.Steps))
	for idx, step := range task.Steps {
		action := strings.ToLower(strings.TrimSpace(step.Action))
		if action == "" {
			return nil, fmt.Errorf("%w: action_task.steps[%d].action is required", coordinator.ErrInvalidTaskDefinition, idx)
		}
		nodeID := fmt.Sprintf("%s-%d", action, idx)
		node := map[string]interface{}{
			"kind":           "tool",
			"node_id":        nodeID,
			"checkpoint_key": fmt.Sprintf("%s-checkpoint-%d", name, idx),
			"write_slot":     defaultGraphWriteSlot("action", idx, nodeID),
		}
		switch action {
		case "read_file":
			if strings.TrimSpace(step.Path) == "" {
				return nil, fmt.Errorf("%w: action_task.steps[%d].path is required for read_file", coordinator.ErrInvalidTaskDefinition, idx)
			}
			node["tool_name"] = "filesystem"
			node["args"] = map[string]interface{}{"operation": "read", "path": step.Path}
		case "http_call":
			if strings.TrimSpace(step.URL) == "" {
				return nil, fmt.Errorf("%w: action_task.steps[%d].url is required for http_call", coordinator.ErrInvalidTaskDefinition, idx)
			}
			method := strings.ToUpper(strings.TrimSpace(step.Method))
			if method == "" {
				method = "GET"
			}
			args := map[string]interface{}{"method": method, "url": step.URL}
			if step.Body != "" {
				args["body"] = step.Body
			}
			if len(step.Headers) > 0 {
				args["headers"] = step.Headers
			}
			node["tool_name"] = "http_request"
			node["args"] = args
		case "db_write":
			if strings.TrimSpace(step.Table) == "" {
				return nil, fmt.Errorf("%w: action_task.steps[%d].table is required for db_write", coordinator.ErrInvalidTaskDefinition, idx)
			}
			record := step.Record
			if record == nil {
				record = map[string]interface{}{}
			}
			node["tool_name"] = "database_write"
			node["args"] = map[string]interface{}{"table": step.Table, "record": record}
		default:
			return nil, fmt.Errorf("%w: action_task.steps[%d].action %q is not supported (use read_file, http_call, or db_write)", coordinator.ErrInvalidTaskDefinition, idx, step.Action)
		}
		nodes = append(nodes, node)
	}
	return buildExecutionGraphDefinition(name, nodes, task.CheckpointAfterSteps)
}

func buildTaskApproval(approvalConfig *publicApproval, taskName, action string, waypointIndex int) map[string]interface{} {
	if approvalConfig == nil {
		return nil
	}

	approval := map[string]interface{}{
		"required": approvalConfig.Required,
	}
	if approvalConfig.Confidence != nil {
		approval["confidence"] = *approvalConfig.Confidence
	}
	if len(approvalConfig.Context) > 0 {
		context := make(map[string]interface{}, len(approvalConfig.Context)+2)
		for key, value := range approvalConfig.Context {
			context[key] = value
		}
		if taskName != "" {
			context["task_name"] = taskName
		}
		context["action"] = action
		if waypointIndex > 0 {
			context["waypoint_index"] = waypointIndex
		}
		approval["context"] = context
	}
	task := approvalConfig.Task
	if task == "" {
		if taskName != "" {
			task = taskName + ":" + action
		} else {
			task = action
		}
	}
	approval["task"] = task
	return approval
}

func optionalUint32(value *uint32) interface{} {
	if value == nil {
		return nil
	}
	return *value
}

func optionalFloat32(value *float32) interface{} {
	if value == nil {
		return nil
	}
	return *value
}

func optionalString(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
}

func unwrapTaskDefinitionError(err error) string {
	prefix := coordinator.ErrInvalidTaskDefinition.Error() + ": "
	return strings.TrimPrefix(err.Error(), prefix)
}

func buildExecutionGraphDefinition(name string, nodes []map[string]interface{}, checkpointAfterSteps ...*uint32) (json.RawMessage, error) {
	graph := map[string]interface{}{
		"nodes": nodes,
	}
	if name != "" {
		graph["graph_id"] = name
	}
	def := map[string]interface{}{
		"graph": graph,
	}
	if len(checkpointAfterSteps) > 0 && checkpointAfterSteps[0] != nil {
		def["checkpoint_after_steps"] = *checkpointAfterSteps[0]
	}
	definition, err := json.Marshal(def)
	if err != nil {
		return nil, fmt.Errorf("%w: could not encode execution_graph", coordinator.ErrInvalidTaskDefinition)
	}
	return definition, nil
}

func defaultTaskName(name, fallback string) string {
	if name != "" {
		return name
	}
	return fallback
}

func defaultGraphWriteSlot(domain string, stepIndex int, nodeID string) string {
	base := strings.ReplaceAll(nodeID, "-", "_")
	if base != "" {
		return fmt.Sprintf("%s.%s", domain, base)
	}
	return fmt.Sprintf("%s.step_%d", domain, stepIndex)
}

func handleGetTask(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		if coordinator.TaskProofNeedsReadReconciliation(task.Proof, time.Now().UTC()) {
			if proof, err := tc.Store().SyncTaskProofState(taskID, tenantID); err == nil {
				task.Proof = proof
			}
		}

		allSteps, _ := tc.Store().GetAllTaskSteps(taskID)
		allCheckpoints, _ := tc.Store().GetAllCheckpoints(taskID)
		resp := buildTaskResponse(task, actionEvidenceSource{
			walEntries:      allSteps,
			blackboardNodes: actionEvidenceNodesFromCheckpoints(allCheckpoints),
		})
		appendTaskGovernanceSummaries(resp, tc.Store(), task)
		return c.JSON(resp)
	}
}

// handleGetTaskSteps returns all WAL entries for a task, aggregated across
// every checkpoint row. Each entry represents one committed step — its type,
// status, input digest, output digest, Ed25519 signature, and timestamp.
// Entries are deduplicated by entry_id and sorted by step_index ascending.
//
// Returns an empty array (not 404) when the task has not yet produced any
// checkpoints (e.g. still in 'dispatched' state).
func handleGetTaskSteps(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		// Verify the task belongs to this tenant before exposing its WAL entries.
		if _, err := tc.Store().GetTask(taskID, tenantID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		steps, err := tc.Store().GetAllTaskSteps(taskID)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		if len(steps) == 0 {
			return c.JSON(fiber.Map{"steps": []interface{}{}, "total": 0})
		}

		return c.JSON(fiber.Map{"steps": steps, "total": len(steps)})
	}
}

func handleListTasks(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		limit := c.QueryInt("limit", 20)
		if limit > 100 {
			limit = 100
		}

		_ = tc.Store().RefreshPendingProofStates(tenantID, limit)

		// Optional agent_id filter scopes the listing to one registered agent so
		// an "agent's runs" investigation link is precise. A malformed id is a
		// bad request rather than a silent unscoped listing — the caller asked
		// for a specific agent and must get exactly that or an error.
		var (
			tasks []*coordinator.TaskRecord
			err   error
		)
		if raw := strings.TrimSpace(c.Query("agent_id")); raw != "" {
			agentID, perr := uuid.Parse(raw)
			if perr != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_agent_id"})
			}
			tasks, err = tc.Store().GetTasksByTenantAndAgent(tenantID, agentID, limit)
		} else {
			tasks, err = tc.Store().GetTasksByTenant(tenantID, limit)
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		items := make([]fiber.Map, 0, len(tasks))
		for _, t := range tasks {
			items = append(items, buildTaskResponse(t))
		}

		return c.JSON(fiber.Map{"tasks": items, "total": len(items)})
	}
}

func handleTaskProofReadiness(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		triggerAvailable, err := tc.Store().HasTaskProofSyncTrigger()
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		return c.JSON(buildTaskProofReadinessResponse(triggerAvailable))
	}
}

type actionEvidenceSource struct {
	walEntries      []coordinator.WalEntry
	blackboardNodes map[string]map[string]interface{}
}

func buildTaskResponse(task *coordinator.TaskRecord, sources ...actionEvidenceSource) fiber.Map {
	resp := fiber.Map{
		"task_id":       task.TaskID,
		"status":        task.Status,
		"lifecycle":     buildTaskLifecycleResponse(task.Status),
		"durability":    buildTaskDurabilityResponse(task),
		"recovery":      buildTaskRecoveryResponse(task),
		"links":         buildTaskLinks(task),
		"runtime_id":    task.RuntimeID,
		"dispatched_at": task.DispatchedAt,
		"completed_at":  task.CompletedAt,
		"created_at":    task.CreatedAt,
	}
	if task.CanceledAt != nil {
		resp["canceled_at"] = task.CanceledAt
	}
	if task.DeadlineAt != nil {
		resp["deadline_at"] = task.DeadlineAt
	}
	if taskType := extractTaskType(task.TaskDefinition); taskType != "" {
		resp["task_type"] = taskType
	}
	if inputSummary := safeInputSummaryRaw(task.TaskDefinition); inputSummary != nil {
		resp["input_summary"] = inputSummary
	}
	// executed_target is the canonical Action execution surface that ran this
	// task. Surfaced so Run detail can render "Routed via …" without guessing.
	// fallback_reason is only set by a future hybrid_fallback resolver — until
	// then it stays nil and is omitted from the response.
	if task.ExecutedTarget != nil && *task.ExecutedTarget != "" {
		resp["executed_target"] = *task.ExecutedTarget
	}
	if task.FallbackReason != nil && *task.FallbackReason != "" {
		resp["fallback_reason"] = *task.FallbackReason
	}
	if agent := agentSummaryForTask(task, nil); agent != nil {
		resp["agent"] = agent
	}

	if task.FailureReason != nil && *task.FailureReason != "" {
		resp["failure_reason"] = *task.FailureReason
	}

	// ── Safe approval / run-detail fields for the console approval panel ──
	// All of these are already-safe, name-only values derived from data the
	// task record already carries. None expose raw inputs, payloads, secrets,
	// paths, headers, or encrypted input refs.

	// required_capabilities is the derived, name-only capability list (e.g.
	// "tools.http_request", "network.api"). scanTaskRecord populates it from the
	// stored definition; it is never a raw payload.
	if len(task.RequiredCapabilities) > 0 {
		resp["required_capabilities"] = task.RequiredCapabilities
	}

	// approval_reason is the human-gate / policy reason a run is paused on,
	// surfaced separately from failure_reason so the console does not overload
	// the failure field. For an approval_required run MarkApprovalRequired stores
	// the policy reason in failure_reason, so it is the safe source here.
	if task.Status == coordinator.TaskStatusApprovalRequired && task.FailureReason != nil && *task.FailureReason != "" {
		resp["approval_reason"] = *task.FailureReason
	}

	// action_target_type is the configured execution surface (hosted_api,
	// webhook, local_runtime, mock_demo, …). It is stamped onto the run at submit
	// even before dispatch, so an approval-required run can show where it will
	// run. Prefer the stamped executed_target; fall back to the target_type the
	// gateway recorded in the execution-graph node metadata.
	targetType := ""
	if task.ExecutedTarget != nil {
		targetType = strings.TrimSpace(*task.ExecutedTarget)
	}
	if targetType == "" {
		targetType = safeActionNodeMetaString(task.TaskDefinition, "target_type")
	}
	targetType = canonicalActionTargetType(targetType)
	if validActionTargetType(targetType) {
		resp["action_target_type"] = targetType
	}

	// policy_preset is the configured, human-readable policy preset for the
	// action (a safe enum label), stamped into node metadata by the gateway.
	if preset := safeActionNodeMetaString(task.TaskDefinition, "policy_preset"); validPolicyPreset(preset) {
		resp["policy_preset"] = preset
	}

	// action_name is the registered action definition name the gateway stamped
	// into node metadata — a pattern-validated identifier, never raw input. An
	// approver reviewing a paused run needs to see WHICH action they are
	// approving, not just its tool shape.
	if name := safeActionNodeMetaString(task.TaskDefinition, "action_name"); validActionName(name) {
		resp["action_name"] = name
	}

	// request_summary is the caller-provided approval one-liner, scrubbed at
	// submit (actionNodeMetadata) and re-scrubbed here on the way out.
	if summary := sanitizeActionRequestSummary(safeActionNodeMetaString(task.TaskDefinition, "request_summary")); summary != "" {
		resp["request_summary"] = summary
	}

	if failureDetails := buildTaskFailureDetailsResponse(task.FailureDetails); failureDetails != nil {
		resp["failure_details"] = failureDetails
	}
	if failure := buildTaskFailureResponse(task.FailureReason, task.FailureDetails); failure != nil {
		resp["failure"] = failure
	}
	if len(task.ExecutionEnvelope) > 0 {
		resp["execution_envelope"] = sanitizeJSONRawMessage(task.ExecutionEnvelope)
	}
	if len(task.ExecutionReceipt) > 0 {
		resp["execution_receipt"] = sanitizeJSONRawMessage(task.ExecutionReceipt)
		if receipt := buildTaskReceiptResponse(task.ExecutionReceipt); receipt != nil {
			resp["receipt"] = receipt
		}
	}
	if proof := buildTaskProofResponse(task.Proof); proof != nil {
		resp["proof"] = proof
	}

	if evidence := buildActionEvidence(task, sources...); len(evidence) > 0 {
		resp["action_evidence"] = evidence
	}

	if task.LastCheckpoint != nil {
		resp["last_step"] = task.LastCheckpoint.ResumeToken.LastCommittedStep
		resp["checkpoint_digest"] = task.LastCheckpoint.ResumeToken.CheckpointDigest
		resp["checkpoint_runtime_id"] = task.LastCheckpoint.ResumeToken.RuntimeID
		resp["checkpoint_summary"] = buildTaskCheckpointSummaryResponse(task)
		if len(task.LastCheckpoint.Metadata) > 0 && !isActionTaskDefinition(task.TaskDefinition) {
			safeMetadata := sanitizeJSONRawMessage(task.LastCheckpoint.Metadata)
			resp["checkpoint_metadata"] = safeMetadata
			if requestedMode, resolvedStrategy := extractModeSemantics(task.LastCheckpoint.Metadata); requestedMode != "" || resolvedStrategy != "" {
				if requestedMode != "" {
					resp["requested_mode"] = requestedMode
				}
				if resolvedStrategy != "" {
					resp["resolved_strategy"] = resolvedStrategy
				}
			}
			if graphBlackboard, graphNodes, graphSlots := extractGraphCheckpointViews(safeMetadata); graphBlackboard != nil {
				resp["graph_blackboard"] = graphBlackboard
				if graphNodes != nil {
					resp["graph_nodes"] = graphNodes
				}
				if graphSlots != nil {
					resp["graph_slots"] = graphSlots
				}
			}
		}
	}

	return resp
}

func isActionTaskDefinition(taskDefinition json.RawMessage) bool {
	if len(taskDefinition) == 0 {
		return false
	}
	var def struct {
		Type  string `json:"type"`
		Graph struct {
			Nodes []struct {
				Kind     string `json:"kind"`
				NodeID   string `json:"node_id"`
				ToolName string `json:"tool_name"`
			} `json:"nodes"`
		} `json:"graph"`
	}
	if err := json.Unmarshal(taskDefinition, &def); err != nil {
		return false
	}
	if def.Type != "execution_graph" || len(def.Graph.Nodes) == 0 {
		return false
	}
	for _, node := range def.Graph.Nodes {
		actionType, ok := actionToolForType[node.ToolName]
		if node.Kind != "tool" || !ok || !strings.HasPrefix(node.NodeID, actionType+"-") {
			return false
		}
	}
	return true
}

func buildTaskCheckpointSummaryResponse(task *coordinator.TaskRecord) fiber.Map {
	if task == nil || task.LastCheckpoint == nil {
		return nil
	}
	status := string(task.Status)
	if status == "" {
		status = "checkpointed"
	}
	resp := fiber.Map{
		"checkpoint_status":     status,
		"last_committed_step":   task.LastCheckpoint.ResumeToken.LastCommittedStep,
		"checkpoint_digest":     task.LastCheckpoint.ResumeToken.CheckpointDigest,
		"checkpoint_runtime_id": task.LastCheckpoint.ResumeToken.RuntimeID,
		"resume_token_present": task.LastCheckpoint.ResumeToken.CheckpointDigest != "" ||
			task.LastCheckpoint.ResumeToken.RuntimeID != "" ||
			task.LastCheckpoint.ResumeToken.LastCommittedStep > 0,
		"wal_entry_count": len(task.LastCheckpoint.WalEntries),
	}
	if proof := buildTaskProofResponse(task.Proof); proof != nil {
		if status, ok := proof["status"]; ok {
			resp["proof_status"] = status
		}
	}
	return resp
}

func buildTaskAcceptedResponse(task *coordinator.TaskRecord) fiber.Map {
	resp := fiber.Map{
		"task_id":    task.TaskID,
		"status":     task.Status,
		"created_at": task.CreatedAt,
		"lifecycle":  buildTaskLifecycleResponse(task.Status),
		"durability": buildTaskDurabilityResponse(task),
		"recovery":   buildTaskRecoveryResponse(task),
		"links":      buildTaskLinks(task),
	}
	if taskType := extractTaskType(task.TaskDefinition); taskType != "" {
		resp["task_type"] = taskType
	}
	if inputSummary := safeInputSummaryRaw(task.TaskDefinition); inputSummary != nil {
		resp["input_summary"] = inputSummary
	}
	return resp
}

// buildTaskLinks returns navigable URLs for the task's lifecycle:
//   - task: GET task detail (status, runtime, checkpoint, receipt, proof state)
//   - steps: GET WAL steps for the task
//   - verify: POST to re-sync the task's proof state and return verification status
//   - run: GET execution run detail (only set once an execution_id has been recorded)
//   - receipt_verify: POST receipt-level verification by execution_id
func buildTaskLinks(task *coordinator.TaskRecord) fiber.Map {
	if task == nil {
		return nil
	}
	id := task.TaskID.String()
	links := fiber.Map{
		"task":           fmt.Sprintf("/v1/tasks/%s", id),
		"steps":          fmt.Sprintf("/v1/tasks/%s/steps", id),
		"verify":         fmt.Sprintf("/v1/tasks/%s/proof/verify", id),
		"receipt_verify": "/proof/receipts/verify",
	}
	if task.Proof != nil && task.Proof.ExecutionID != "" {
		links["run"] = fmt.Sprintf("/v1/execution/runs/%s", task.Proof.ExecutionID)
	}
	return links
}

func buildTaskMutationResponse(task *coordinator.TaskRecord, extras fiber.Map) fiber.Map {
	resp := buildTaskResponse(task)
	resp["ok"] = true
	for key, value := range extras {
		resp[key] = value
	}
	return resp
}

func buildTaskReceiptResponse(receipt json.RawMessage) fiber.Map {
	if len(receipt) == 0 {
		return nil
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(receipt, &payload); err != nil {
		return nil
	}
	return fiber.Map(models.BuildReceiptReference(payload))
}

func buildTaskLifecycleResponse(status coordinator.TaskRecordStatus) fiber.Map {
	runtimeMutationAllowed := coordinator.TaskAllowsRuntimeMutation(status)
	dispatchAllowed := coordinator.TaskAllowsDispatch(status)
	recoveryRedispatchAllowed := coordinator.TaskAllowsRecoveryRedispatch(status)
	cancellationAllowed := coordinator.TaskAllowsCancellation(status)

	return fiber.Map{
		"terminal":                    !runtimeMutationAllowed && !dispatchAllowed && !recoveryRedispatchAllowed && !cancellationAllowed,
		"runtime_mutation_allowed":    runtimeMutationAllowed,
		"dispatch_allowed":            dispatchAllowed,
		"recovery_redispatch_allowed": recoveryRedispatchAllowed,
		"cancellation_allowed":        cancellationAllowed,
	}
}

func buildTaskDurabilityResponse(task *coordinator.TaskRecord) fiber.Map {
	if task == nil {
		return fiber.Map{
			"class":            coordinator.TaskDurabilityClassResumable,
			"streaming":        false,
			"resume_supported": false,
		}
	}

	class := coordinator.TaskDurabilityClassForDefinition(task.TaskDefinition)
	return fiber.Map{
		"class":            class,
		"streaming":        class == coordinator.TaskDurabilityClassStreamingNonResumable,
		"resume_supported": coordinator.TaskSupportsRecoveryResume(task),
	}
}

func buildTaskRecoveryResponse(task *coordinator.TaskRecord) fiber.Map {
	if task == nil {
		return fiber.Map{"redispatch_eligible": false}
	}

	resp := fiber.Map{
		"redispatch_eligible": coordinator.TaskRecoveryRedispatchEligible(task),
	}

	if skipReason := coordinator.TaskRecoverySkipReason(task); skipReason != "" {
		resp["skip_reason"] = skipReason
	}

	return resp
}

func appendTaskGovernanceSummaries(resp fiber.Map, store *coordinator.CheckpointStore, task *coordinator.TaskRecord) {
	if resp == nil || store == nil || task == nil {
		return
	}
	if decision, err := store.LatestActionPolicyDecision(task.TenantID, task.TaskID); err == nil && decision != nil {
		resp["policy"] = fiber.Map{
			"decision_id":            decision.DecisionID,
			"decision":               decision.Decision,
			"action_name":            decision.ActionName,
			"risk_level":             decision.RiskLevel,
			"replay_class":           decision.ReplayClass,
			"irreversible":           decision.Irreversible,
			"human_gated":            decision.HumanGated,
			"policy_version":         decision.PolicyVersion,
			"reason":                 decision.PolicyReason,
			"action_digest":          decision.ActionDigest,
			"checkpoint_portability": decision.CheckpointPortability,
			"created_at":             decision.CreatedAt,
		}
	}
	if events, err := store.ListRecoveryEvents(task.TenantID, task.TaskID); err == nil && len(events) > 0 {
		safe := make([]fiber.Map, 0, len(events))
		for _, event := range events {
			row := fiber.Map{
				"event_type":        event.EventType,
				"source_runtime_id": event.SourceRuntimeID,
				"target_runtime_id": event.TargetRuntimeID,
				"checkpoint_digest": event.CheckpointDigest,
				"reason":            event.Reason,
				"created_at":        event.CreatedAt,
			}
			if event.LastCommittedStep != nil {
				row["last_committed_step"] = *event.LastCommittedStep
			}
			if event.ReplayAllowed != nil {
				row["replay_allowed"] = *event.ReplayAllowed
			}
			safe = append(safe, row)
		}
		if recovery, ok := resp["recovery"].(fiber.Map); ok {
			recovery["events"] = safe
		} else {
			resp["recovery"] = fiber.Map{"events": safe}
		}
	}
	if handoff, err := store.LatestRuntimeHandoffEvent(task.TenantID, task.TaskID); err == nil && handoff != nil {
		resp["runtime_handoff"] = fiber.Map{
			"source_runtime_id":      handoff.SourceRuntimeID,
			"target_runtime_id":      handoff.TargetRuntimeID,
			"checkpoint_digest":      handoff.CheckpointDigest,
			"checkpoint_portability": handoff.CheckpointPortability,
			"decision":               handoff.Decision,
			"reason":                 handoff.Reason,
			"created_at":             handoff.CreatedAt,
		}
	}
	if boundary, err := store.LatestExecutionBoundary(task.TenantID, task.TaskID); err == nil && boundary != nil {
		resp["runtime_boundary"] = fiber.Map{
			"boundary_id":          boundary.BoundaryID,
			"runtime_id":           boundary.RuntimeID,
			"environment_label":    boundary.EnvironmentLabel,
			"allowed_tools":        json.RawMessage(boundary.AllowedTools),
			"denied_tools":         json.RawMessage(boundary.DeniedTools),
			"network_scope":        boundary.NetworkScope,
			"filesystem_scope":     boundary.FilesystemScope,
			"api_scope":            boundary.APIScope,
			"resource_limits":      json.RawMessage(boundary.ResourceLimits),
			"runtime_capabilities": json.RawMessage(boundary.RuntimeCapabilities),
			"boundary_digest":      boundary.BoundaryDigest,
			"created_at":           boundary.CreatedAt,
		}
	}
}

func buildTaskFailureDetailsResponse(details *coordinator.TaskFailureDetails) fiber.Map {
	if details == nil {
		return nil
	}

	resp := fiber.Map{}
	if details.Source != "" {
		resp["source"] = details.Source
	}
	if details.Operation != "" {
		resp["operation"] = details.Operation
	}
	if details.StatusCode != 0 {
		resp["status_code"] = details.StatusCode
	}
	if details.RejectionType != "" {
		resp["rejection_type"] = details.RejectionType
	}
	if details.Message != "" {
		resp["message"] = details.Message
	}
	if details.StepIndex != nil {
		resp["step_index"] = *details.StepIndex
	}
	if details.Domain != "" {
		resp["domain"] = details.Domain
	}
	if details.NodeID != "" {
		resp["node_id"] = details.NodeID
	}
	if details.RequestedLastStep != nil {
		resp["requested_last_step"] = *details.RequestedLastStep
	}
	if details.LocalLastStep != nil {
		resp["local_last_step"] = *details.LocalLastStep
	}
	if details.RequestedCheckpointDigest != "" {
		resp["requested_checkpoint_digest"] = details.RequestedCheckpointDigest
	}
	if details.LocalCheckpointDigest != "" {
		resp["local_checkpoint_digest"] = details.LocalCheckpointDigest
	}
	if details.ResumeCheckpointProvided != nil {
		resp["resume_checkpoint_provided"] = *details.ResumeCheckpointProvided
	}
	if details.EffectState != "" {
		resp["effect_state"] = details.EffectState
	}
	if details.ReconciliationRequired {
		resp["reconciliation_required"] = true
	}
	if details.TargetErrorCode != "" {
		resp["target_error_code"] = details.TargetErrorCode
	}
	if details.TargetHost != "" {
		resp["target_host"] = details.TargetHost
	}
	if details.TargetResponseDigest != "" {
		resp["target_response_digest"] = details.TargetResponseDigest
	}
	if len(resp) == 0 {
		return nil
	}
	return resp
}

func buildTaskFailureResponse(reason *string, details *coordinator.TaskFailureDetails) fiber.Map {
	var reasonValue string
	if reason != nil {
		reasonValue = *reason
	}
	return fiber.Map(models.BuildFailureResponse(reasonValue, mapFromFiber(buildTaskFailureDetailsResponse(details))))
}

func buildRuntimeCancelResponse(result *internal.RuntimeCancelResult) fiber.Map {
	if result == nil {
		return nil
	}
	resp := fiber.Map(result.ResponsePayload())
	if details, ok := resp["failure_details"].(map[string]any); ok {
		if failure := models.BuildFailureResponse(stringValue(resp["reason"]), details); failure != nil {
			resp["failure"] = fiber.Map(failure)
		}
	}
	return resp
}

func mapFromFiber(value fiber.Map) map[string]interface{} {
	if value == nil {
		return nil
	}
	resp := make(map[string]interface{}, len(value))
	for key, item := range value {
		resp[key] = item
	}
	return resp
}

func stringValue(value any) string {
	if typed, ok := value.(string); ok {
		return typed
	}
	return ""
}

func buildTaskCanceledResponse(task *coordinator.TaskRecord, runtimeCancelAttempted, runtimeCancelSignaled bool, runtimeCancel fiber.Map) fiber.Map {
	extras := fiber.Map{
		"runtime_cancel_attempted": runtimeCancelAttempted,
		"runtime_cancel_signaled":  runtimeCancelSignaled,
	}
	if runtimeCancel != nil {
		extras["runtime_cancel"] = runtimeCancel
	}
	return buildTaskMutationResponse(task, extras)
}

func buildTaskProofReadinessResponse(triggerAvailable bool) fiber.Map {
	mode := "fallback"
	if triggerAvailable {
		mode = "trigger"
	}

	return fiber.Map{
		"proof_sync_mode":              mode,
		"trigger_available":            triggerAvailable,
		"read_reconciliation_fallback": true,
	}
}

func buildTaskProofResponse(proof *coordinator.TaskProofState) fiber.Map {
	if proof == nil {
		return nil
	}

	resp := fiber.Map{
		"status":            proof.Status,
		"needs_refresh":     coordinator.TaskProofNeedsRefresh(proof, time.Now().UTC()),
		"reconcile_on_read": coordinator.TaskProofNeedsReadReconciliation(proof, time.Now().UTC()),
	}
	if proof.ExecutionID != "" {
		resp["execution_id"] = proof.ExecutionID
	}
	if proof.ExpectedHash != "" {
		resp["expected_hash"] = proof.ExpectedHash
	}
	if proof.StoredHash != "" {
		resp["stored_hash"] = proof.StoredHash
	}
	if proof.Signature != "" {
		resp["signature"] = proof.Signature
	}
	if proof.CheckedAt != nil {
		resp["checked_at"] = proof.CheckedAt
	}
	if proof.Status == "verified" {
		resp["present"] = true
		resp["matched"] = true
	} else if proof.Status == "mismatch" {
		resp["present"] = true
		resp["matched"] = false
	} else if proof.Status == "present" {
		resp["present"] = true
	}
	// Persisted verification summary (from the last /proof/verify run). Absent
	// keys mean "verification has not run yet" — the UI shows that honestly.
	if proof.Verified != nil {
		resp["verified"] = *proof.Verified
	}
	if proof.HashValid != nil {
		resp["hash_valid"] = *proof.HashValid
	}
	if proof.SignatureMatches != nil {
		resp["signature_matches"] = *proof.SignatureMatches
	}
	if proof.RuntimeKeyFound != nil {
		resp["runtime_key_found"] = *proof.RuntimeKeyFound
	}
	if proof.ChainLinkValid != nil {
		resp["chain_link_valid"] = *proof.ChainLinkValid
	}
	if proof.VerificationReason != "" {
		resp["verification_reason"] = proof.VerificationReason
	}
	if proof.VerifiedAt != nil {
		resp["verified_at"] = proof.VerifiedAt
	}
	return resp
}

func handleVerifyTaskProof(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if task.Proof == nil || task.Proof.ExecutionID == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "proof_unavailable",
				"message": "task does not have a persisted proof reference",
			})
		}

		proof, err := tc.Store().SyncTaskProofState(taskID, tenantID)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if proof == nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "proof_unavailable",
				"message": "task does not have a persisted proof reference",
			})
		}

		// Fresh cryptographic verification using the task's stored signed
		// envelope + signed receipt and the runtime's registered public key
		// (with env-var fallback). Stored-value comparison alone is not
		// sufficient to mark verified=true.
		crypto := verifyTaskCryptographic(c.Context(), tc, task)

		// Chain-link verification: verify the task receipt's previous_hash
		// pointer resolves to a real, untampered prior receipt for the same
		// tenant. Independent of cryptographic verification of the current
		// receipt — both are reported separately in the response.
		chain := verifyTaskChainLink(c.Context(), tc, task, tenantID)

		// Persist the safe verification summary so the task detail GET path can
		// show "Receipt verified" / "Chain intact" without re-running this.
		reason := strings.TrimSpace(crypto.Reason)
		if chain.Checked && chain.Reason != "" {
			if reason != "" {
				reason += "; "
			}
			reason += "chain: " + chain.Reason
		}
		if err := tc.Store().PersistTaskProofVerification(taskID, tenantID, coordinator.TaskProofVerificationSummary{
			Verified:         crypto.Verified(),
			HashValid:        crypto.HashValid,
			SignatureMatches: crypto.SignatureValid,
			RuntimeKeyFound:  crypto.RuntimeKeyFound,
			ChainChecked:     chain.Checked,
			ChainLinkValid:   chain.Valid,
			Reason:           reason,
		}); err != nil {
			log.Warn().Err(err).Str("task_id", taskID.String()).Msg("failed to persist task proof verification summary")
		} else {
			// Reflect the just-persisted summary in the response too.
			v := crypto.Verified()
			hv := crypto.HashValid
			sm := crypto.SignatureValid
			rk := crypto.RuntimeKeyFound
			proof.Verified = &v
			proof.HashValid = &hv
			proof.SignatureMatches = &sm
			proof.RuntimeKeyFound = &rk
			proof.VerificationReason = reason
			verifiedAt := time.Now().UTC()
			proof.VerifiedAt = &verifiedAt
			if chain.Checked {
				cv := chain.Valid
				proof.ChainLinkValid = &cv
			}
		}
		persistVerificationResult(tc.Store(), task, proof, crypto.Verified(), chain.Valid, reason)

		respProof := buildTaskProofResponse(proof)
		applyCryptographicProofFields(respProof, crypto)
		applyChainProofFields(respProof, chain)

		return c.JSON(fiber.Map{
			"task_id":  taskID,
			"verified": crypto.Verified(),
			"proof":    respProof,
		})
	}
}

func persistVerificationResult(store *coordinator.CheckpointStore, task *coordinator.TaskRecord, proof *coordinator.TaskProofState, verified bool, chainValid bool, reason string) {
	if store == nil || task == nil {
		return
	}
	status := "failed_verification"
	if verified && chainValid {
		status = "verified"
	} else if verified {
		status = "partially_verified"
	} else if proof == nil || proof.ExecutionID == "" {
		status = "unverifiable"
	}
	var policyDecisionID *uuid.UUID
	actionDigest := ""
	policyCompliant := true
	if decision, err := store.LatestActionPolicyDecision(task.TenantID, task.TaskID); err == nil && decision != nil {
		id := decision.DecisionID
		policyDecisionID = &id
		actionDigest = decision.ActionDigest
		if decision.Decision == coordinator.ActionDecisionDenied {
			policyCompliant = false
			status = "policy_violation"
		}
	}
	executionID := ""
	if proof != nil {
		executionID = proof.ExecutionID
	}
	checkpointDigest := ""
	if task.LastCheckpoint != nil {
		checkpointDigest = task.LastCheckpoint.ResumeToken.CheckpointDigest
	}
	if strings.TrimSpace(reason) == "" {
		reason = "verification completed"
	}
	if err := store.SaveVerificationResult(coordinator.VerificationResultRecord{
		TenantID:         task.TenantID,
		TaskID:           task.TaskID,
		ExecutionID:      executionID,
		PolicyDecisionID: policyDecisionID,
		CheckpointDigest: checkpointDigest,
		ActionDigest:     actionDigest,
		Status:           status,
		PolicyCompliant:  &policyCompliant,
		EvidenceDigest:   proofEvidenceDigest(task.ExecutionReceipt),
		Reason:           reason,
	}); err != nil {
		log.Warn().Err(err).Str("task_id", task.TaskID.String()).Msg("failed to persist verification result")
	}
}

func proofEvidenceDigest(receipt json.RawMessage) string {
	if len(receipt) == 0 {
		return ""
	}
	sum := sha256.Sum256(receipt)
	return fmt.Sprintf("%x", sum[:])
}

// verifyTaskChainLink extracts previous_hash from the task's stored receipt
// and runs the same chain-link verification used by /proof/receipts/verify.
// Tenant-scoped: the prior receipt must belong to the same tenant.
func verifyTaskChainLink(ctx context.Context, tc *coordinator.TaskCoordinator, task *coordinator.TaskRecord, tenantID string) chainLinkOutcome {
	out := chainLinkOutcome{Checked: true}
	if task == nil || len(task.ExecutionReceipt) == 0 {
		out.Reason = "task has no execution receipt to chain"
		return out
	}
	var receipt struct {
		PreviousHash string `json:"previous_hash"`
	}
	if err := json.Unmarshal(task.ExecutionReceipt, &receipt); err != nil {
		out.Reason = "execution_receipt invalid json: " + err.Error()
		return out
	}
	out.PreviousHash = receipt.PreviousHash
	if tc == nil || tc.Store() == nil || tc.Store().DB() == nil {
		out.Reason = "database not available for chain lookup"
		return out
	}
	return verifyReceiptChainLinkWithDB(ctx, tc.Store().DB(), tenantID, receipt.PreviousHash)
}

// applyChainProofFields layers chain-link outcome onto the task proof
// response. Distinct from cryptographic fields: a receipt may verify
// cryptographically while failing the chain check (or vice versa).
func applyChainProofFields(resp fiber.Map, chain chainLinkOutcome) {
	if resp == nil {
		return
	}
	if !chain.Checked {
		return
	}
	resp["chain_link_valid"] = chain.Valid
	if chain.PreviousHash != "" {
		resp["previous_hash"] = chain.PreviousHash
	}
	if chain.Reason != "" {
		resp["chain_link_reason"] = chain.Reason
	}
	if chain.PriorReceiptID != "" {
		resp["prior_receipt_id"] = chain.PriorReceiptID
	}
}

// verifyTaskCryptographic looks up the runtime public key for the task's
// runtime_id (falling back to IGRIS_RUNTIME_PUBLIC_KEY) and re-derives the
// canonical receipt + envelope hashes for fresh Ed25519 verification. It
// never returns an error: a missing key, missing artifacts, or failed crypto
// surface as RuntimeKeyFound=false / SignatureValid=false / HashValid=false
// in the result so the HTTP layer keeps a 200-shaped response.
func verifyTaskCryptographic(ctx context.Context, tc *coordinator.TaskCoordinator, task *coordinator.TaskRecord) internal.ReceiptVerificationResult {
	if task == nil || len(task.ExecutionReceipt) == 0 {
		return internal.ReceiptVerificationResult{Reason: "task has no execution receipt"}
	}

	publicKeyHex := lookupRuntimePublicKeyForTask(ctx, tc, task)

	var receipt map[string]interface{}
	if err := json.Unmarshal(task.ExecutionReceipt, &receipt); err != nil {
		return internal.ReceiptVerificationResult{Reason: "execution_receipt invalid json: " + err.Error()}
	}

	return internal.VerifyReceiptCryptographic(receipt, publicKeyHex)
}

// lookupRuntimePublicKeyForTask returns the hex-encoded Ed25519 public key
// registered for the task's runtime in runtime_instances, or the value of
// IGRIS_RUNTIME_PUBLIC_KEY when no registry entry is available. Returns ""
// when neither source has a key.
func lookupRuntimePublicKeyForTask(ctx context.Context, tc *coordinator.TaskCoordinator, task *coordinator.TaskRecord) string {
	if tc != nil && task != nil && task.RuntimeID != nil && *task.RuntimeID != "" {
		var key string
		err := tc.Store().DB().QueryRowContext(ctx, `
			SELECT COALESCE(public_key_ed25519, '')
			FROM runtime_instances
			WHERE runtime_id::text = $1
			LIMIT 1
		`, *task.RuntimeID).Scan(&key)
		if err == nil && strings.TrimSpace(key) != "" {
			return strings.TrimSpace(key)
		}
	}
	return strings.TrimSpace(os.Getenv("IGRIS_RUNTIME_PUBLIC_KEY"))
}

// applyCryptographicProofFields layers fresh-verification flags onto the
// existing proof response, preserving back-compat fields. We never set
// "matched": true unless the cryptographic Verified() path succeeded.
func applyCryptographicProofFields(resp fiber.Map, crypto internal.ReceiptVerificationResult) {
	if resp == nil {
		return
	}
	resp["runtime_key_found"] = crypto.RuntimeKeyFound
	resp["hash_valid"] = crypto.HashValid
	resp["signature_valid"] = crypto.SignatureValid
	resp["cryptographic_verification"] = crypto.Verified()
	if crypto.Reason != "" {
		resp["verification_reason"] = crypto.Reason
	}
	// Promote status to "verified" only when crypto succeeded; downgrade to
	// "mismatch" when crypto rejects an otherwise present receipt.
	if crypto.Verified() {
		resp["status"] = "verified"
		resp["present"] = true
		resp["matched"] = true
	} else if crypto.RuntimeKeyFound && crypto.ReceiptPresent && crypto.SignaturePresent && (!crypto.HashValid || !crypto.SignatureValid) {
		resp["status"] = "mismatch"
		resp["present"] = true
		resp["matched"] = false
	}
}

func buildTaskTransitionRejectedPayload(task *coordinator.TaskRecord) fiber.Map {
	resp := fiber.Map{"error": "task_transition_rejected"}
	if task == nil {
		return resp
	}

	resp["status"] = task.Status
	resp["lifecycle"] = buildTaskLifecycleResponse(task.Status)
	resp["durability"] = buildTaskDurabilityResponse(task)
	resp["recovery"] = buildTaskRecoveryResponse(task)
	if task.CanceledAt != nil {
		resp["canceled_at"] = task.CanceledAt
	}
	if task.CompletedAt != nil {
		resp["completed_at"] = task.CompletedAt
	}
	if task.FailureReason != nil && *task.FailureReason != "" {
		resp["failure_reason"] = *task.FailureReason
	}
	if failureDetails := buildTaskFailureDetailsResponse(task.FailureDetails); failureDetails != nil {
		resp["failure_details"] = failureDetails
	}
	if failure := buildTaskFailureResponse(task.FailureReason, task.FailureDetails); failure != nil {
		resp["failure"] = failure
	}
	return resp
}

func taskTransitionRejectedPayload(tc *coordinator.TaskCoordinator, taskID uuid.UUID, tenantID string) fiber.Map {
	task, err := tc.Store().GetTask(taskID, tenantID)
	if err != nil {
		return buildTaskTransitionRejectedPayload(nil)
	}
	return buildTaskTransitionRejectedPayload(task)
}

func handleTaskCancel(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if !coordinator.TaskAllowsCancellation(task.Status) {
			return c.Status(http.StatusConflict).JSON(buildTaskTransitionRejectedPayload(task))
		}

		if err := tc.HandleCancel(taskID); err != nil {
			if errors.Is(err, coordinator.ErrTaskTransitionRejected) {
				return c.Status(http.StatusConflict).JSON(taskTransitionRejectedPayload(tc, taskID, tenantID))
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		runtimeCancelAttempted := false
		runtimeCancelSignaled := false
		var runtimeCancel fiber.Map
		if task.RuntimeEndpoint != nil && *task.RuntimeEndpoint != "" {
			runtimeCancelAttempted = true
			result, err := runtimeCancelTask(context.Background(), *task.RuntimeEndpoint, taskID, tenantID)
			if err != nil {
				log.Warn().Err(err).Str("task_id", taskID.String()).Msg("[Tasks] Runtime cancel propagation failed")
			} else {
				runtimeCancelSignaled = result.Signaled()
				runtimeCancel = buildRuntimeCancelResponse(result)
			}
		}

		updatedTask, err := tc.Store().GetTask(taskID, tenantID)
		if err != nil {
			fallbackTask := *task
			fallbackTask.Status = coordinator.TaskStatusCanceled
			updatedTask = &fallbackTask
		}

		return c.JSON(buildTaskCanceledResponse(updatedTask, runtimeCancelAttempted, runtimeCancelSignaled, runtimeCancel))
	}
}

func extractTaskType(taskDefinition json.RawMessage) string {
	if len(taskDefinition) == 0 {
		return ""
	}
	var payload struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(taskDefinition, &payload); err != nil {
		return ""
	}
	return payload.Type
}

// safeActionNodeMetaString returns a single whitelisted string value that the
// action gateway stamped into an execution-graph node's metadata (e.g.
// target_type, policy_preset). It reads ONLY the named key as a string from node
// metadata and returns "" for anything else, so no raw input, payload, or
// arbitrary metadata can leak. Callers still validate the value against a known
// enum before exposing it.
func safeActionNodeMetaString(taskDefinition json.RawMessage, key string) string {
	if len(taskDefinition) == 0 {
		return ""
	}
	var payload struct {
		Graph struct {
			Nodes []struct {
				Metadata map[string]json.RawMessage `json:"metadata"`
			} `json:"nodes"`
		} `json:"graph"`
	}
	if err := json.Unmarshal(taskDefinition, &payload); err != nil {
		return ""
	}
	for _, node := range payload.Graph.Nodes {
		raw, ok := node.Metadata[key]
		if !ok {
			continue
		}
		var value string
		if err := json.Unmarshal(raw, &value); err != nil {
			continue
		}
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func extractGraphCheckpointViews(metadata json.RawMessage) (graphBlackboard json.RawMessage, graphNodes json.RawMessage, graphSlots json.RawMessage) {
	if len(metadata) == 0 {
		return nil, nil, nil
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(metadata, &payload); err != nil {
		return nil, nil, nil
	}

	blackboard, ok := payload["graph_blackboard"]
	if !ok || len(blackboard) == 0 {
		return nil, nil, nil
	}

	var graph map[string]json.RawMessage
	if err := json.Unmarshal(blackboard, &graph); err != nil {
		return blackboard, nil, nil
	}

	return blackboard, graph["nodes"], graph["slots"]
}

// actionToolForType maps the sandboxed runtime tool that an Action Task V1 step
// compiles to back to the customer-facing action verb. An Action Task graph is
// composed *exclusively* of these three tools — any other node kind/tool means
// the task is a general execution graph, not an Action Task, and we do not
// surface it as customer "actions".
var actionToolForType = map[string]string{
	"filesystem":     "read_file",
	"http_request":   "http_call",
	"database_write": "db_write",
}

// buildActionEvidence derives a small, safe, authoritative view of the actions
// an Action Task V1 performed, in execution order. It joins three sources that
// are already on the task record:
//
//   - the compiled execution-graph definition  -> action_type + target_summary
//     (controlled file path, HTTP method+URL, DB table — never file contents,
//     request/response bodies, or raw records)
//   - the latest checkpoint's WAL entries      -> status, result_digest,
//     runtime_id, recorded_at
//   - the checkpoint's graph blackboard nodes  -> result_summary (whitelisted,
//     structured fields only: bytes read, HTTP status code, written row id)
//
// Returns nil for anything that is not an Action Task V1 graph.
func buildActionEvidence(task *coordinator.TaskRecord, sources ...actionEvidenceSource) []fiber.Map {
	if task == nil || len(task.TaskDefinition) == 0 {
		return nil
	}
	var def struct {
		Type  string `json:"type"`
		Graph struct {
			Nodes []json.RawMessage `json:"nodes"`
		} `json:"graph"`
	}
	if err := json.Unmarshal(task.TaskDefinition, &def); err != nil {
		return nil
	}
	if def.Type != "execution_graph" || len(def.Graph.Nodes) == 0 {
		return nil
	}

	type compiledAction struct {
		stepIndex  int
		nodeID     string
		actionType string
		toolName   string
		target     string
	}
	compiled := make([]compiledAction, 0, len(def.Graph.Nodes))
	for idx, rawNode := range def.Graph.Nodes {
		var node struct {
			Kind     string          `json:"kind"`
			NodeID   string          `json:"node_id"`
			ToolName string          `json:"tool_name"`
			Args     json.RawMessage `json:"args"`
		}
		if err := json.Unmarshal(rawNode, &node); err != nil {
			return nil
		}
		if node.Kind != "tool" {
			return nil
		}
		actionType, ok := actionToolForType[node.ToolName]
		if !ok {
			return nil
		}
		if !strings.HasPrefix(node.NodeID, actionType+"-") {
			return nil
		}
		compiled = append(compiled, compiledAction{
			stepIndex:  idx,
			nodeID:     node.NodeID,
			actionType: actionType,
			toolName:   node.ToolName,
			target:     actionTargetSummary(actionType, node.Args),
		})
	}
	if len(compiled) == 0 {
		return nil
	}

	walByIndex := map[uint32]coordinator.WalEntry{}
	if len(sources) > 0 && len(sources[0].walEntries) > 0 {
		for _, e := range sources[0].walEntries {
			existing, ok := walByIndex[e.StepIndex]
			if !ok || (existing.OutputDigest == nil && e.OutputDigest != nil) {
				walByIndex[e.StepIndex] = e
			}
		}
	} else if task.LastCheckpoint != nil {
		for _, e := range task.LastCheckpoint.WalEntries {
			existing, ok := walByIndex[e.StepIndex]
			if !ok || (existing.OutputDigest == nil && e.OutputDigest != nil) {
				walByIndex[e.StepIndex] = e
			}
		}
	}

	blackboardNodes := map[string]map[string]interface{}{}
	if len(sources) > 0 && len(sources[0].blackboardNodes) > 0 {
		blackboardNodes = sources[0].blackboardNodes
	} else if task.LastCheckpoint != nil && len(task.LastCheckpoint.Metadata) > 0 {
		var meta struct {
			GraphBlackboard struct {
				Nodes map[string]map[string]interface{} `json:"nodes"`
			} `json:"graph_blackboard"`
		}
		if err := json.Unmarshal(task.LastCheckpoint.Metadata, &meta); err == nil && meta.GraphBlackboard.Nodes != nil {
			blackboardNodes = meta.GraphBlackboard.Nodes
		}
	}

	out := make([]fiber.Map, 0, len(compiled))
	for _, ca := range compiled {
		row := fiber.Map{
			"step_index":  ca.stepIndex,
			"node_id":     ca.nodeID,
			"action_type": ca.actionType,
			"tool_name":   ca.toolName,
		}
		if ca.target != "" {
			row["target_summary"] = sanitizeTargetSummary(ca.actionType, ca.target)
		}
		if e, ok := walByIndex[uint32(ca.stepIndex)]; ok {
			if e.Status != "" {
				row["status"] = e.Status
			}
			if e.OutputDigest != nil && *e.OutputDigest != "" {
				row["result_digest"] = *e.OutputDigest
			}
			if e.RuntimeID != "" {
				row["runtime_id"] = e.RuntimeID
			}
			if e.TimestampMs > 0 {
				row["recorded_at"] = time.UnixMilli(int64(e.TimestampMs)).UTC().Format(time.RFC3339)
			}
		}
		if node := blackboardNodes[ca.nodeID]; node != nil {
			if _, has := row["status"]; !has {
				if s, ok := node["status"].(string); ok && s != "" {
					row["status"] = s
				}
			}
			if rs := summarizeActionResult(ca.actionType, node); len(rs) > 0 {
				row["result_summary"] = rs
			}
		}
		out = append(out, row)
	}
	return out
}

func actionEvidenceNodesFromCheckpoints(checkpoints []*coordinator.CheckpointPayload) map[string]map[string]interface{} {
	nodes := map[string]map[string]interface{}{}
	for _, cp := range checkpoints {
		if cp == nil || len(cp.Metadata) == 0 {
			continue
		}
		var meta struct {
			GraphBlackboard struct {
				Nodes map[string]map[string]interface{} `json:"nodes"`
			} `json:"graph_blackboard"`
		}
		if err := json.Unmarshal(cp.Metadata, &meta); err != nil || meta.GraphBlackboard.Nodes == nil {
			continue
		}
		for nodeID, node := range meta.GraphBlackboard.Nodes {
			nodes[nodeID] = node
		}
	}
	return nodes
}

// actionTargetSummary returns a short description of *what* an action targeted,
// derived from the compiled tool args. It deliberately reads only safe fields:
// file path digests / controlled file paths, HTTP method + URL, and DB table
// name - never file contents, request/response bodies, headers, or records.
func actionTargetSummary(actionType string, args json.RawMessage) string {
	if len(args) == 0 {
		return ""
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(args, &raw); err != nil {
		return ""
	}

	stringField := func(key string) string {
		if v, ok := raw[key].(string); ok {
			return strings.TrimSpace(v)
		}
		return ""
	}
	protectedFieldDigest := func(key string) string {
		obj, ok := raw[key].(map[string]interface{})
		if !ok {
			return ""
		}
		for _, digestKey := range []string{"safe_path_digest", "input_digest_sha256", "content_digest_sha256"} {
			if v := strings.TrimSpace(valueToString(obj[digestKey])); v != "" && v != "null" {
				return v
			}
		}
		if v := strings.TrimSpace(valueToString(obj["encrypted_input_ref_id"])); v != "" && v != "null" {
			return "input-ref:" + v
		}
		return ""
	}

	switch actionType {
	case "read_file":
		if path := stringField("path"); path != "" {
			return path
		}
		if digest := protectedFieldDigest("path"); digest != "" {
			return "redacted-path:" + digest
		}
	case "http_call":
		method := strings.ToUpper(stringField("method"))
		url := stringField("url")
		if url == "" {
			if digest := protectedFieldDigest("url"); digest != "" {
				url = "redacted-url:" + digest
			}
		}
		switch {
		case method != "" && url != "":
			return method + " " + url
		case url != "":
			return url
		default:
			return ""
		}
	case "db_write":
		if t := stringField("table"); t != "" {
			return "table " + t
		}
	}
	return ""
}

// summarizeActionResult extracts a small whitelist of safe, structured result
// fields from a graph blackboard node (and its nested `metadata`). The Runtime
// tools emit a stable result envelope into the tool metadata — read_file:
// `bytes_read` + `content_digest`; http_call: `status_code` + `response_digest`;
// db_write: `table` + `row_id` — and this consumes exactly those keys (with a
// couple of legacy aliases as fallback). It never echoes arbitrary blackboard
// content, so raw file contents / request+response bodies / headers / DB record
// payloads cannot leak through this path.
func summarizeActionResult(actionType string, node map[string]interface{}) fiber.Map {
	if node == nil {
		return nil
	}
	scopes := []map[string]interface{}{node}
	if m, ok := node["metadata"].(map[string]interface{}); ok {
		scopes = append(scopes, m)
	}
	pickString := func(keys ...string) string {
		for _, s := range scopes {
			for _, k := range keys {
				if v, ok := s[k].(string); ok && v != "" {
					return v
				}
			}
		}
		return ""
	}
	// Tool metadata is a string map (igris_tools::ToolResult.metadata), so a
	// "byte count" or "status code" arrives either as a JSON number (blackboard
	// node body) or a numeric string (tool metadata) — accept both.
	pickInt := func(keys ...string) (int64, bool) {
		for _, s := range scopes {
			for _, k := range keys {
				switch v := s[k].(type) {
				case float64:
					return int64(v), true
				case string:
					if n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64); err == nil {
						return n, true
					}
				}
			}
		}
		return 0, false
	}
	out := fiber.Map{}
	switch actionType {
	case "read_file":
		if n, ok := pickInt("bytes_read", "content_bytes", "bytes", "received_bytes", "size"); ok {
			out["bytes_read"] = n
		}
		if d := pickString("content_digest_sha256", "content_digest", "digest"); d != "" {
			out["content_digest"] = d
		}
		if redacted := pickString("content_redacted"); redacted != "" {
			out["content_redacted"] = redacted
		}
	case "http_call":
		if n, ok := pickInt("status_code", "http_status", "response_status"); ok {
			out["status_code"] = n
		}
		if d := pickString("content_digest_sha256", "response_digest", "digest"); d != "" {
			out["response_digest"] = d
		}
		if n, ok := pickInt("content_bytes", "response_bytes"); ok {
			out["content_bytes"] = n
		}
	case "db_write":
		if t := pickString("table"); t != "" {
			out["table"] = t
		}
		if id := pickString("row_id", "id"); id != "" {
			out["row_id"] = id
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func extractModeSemantics(metadata json.RawMessage) (requestedMode string, resolvedStrategy string) {
	if len(metadata) == 0 {
		return "", ""
	}
	var payload struct {
		RequestedMode    string `json:"requested_mode"`
		ResolvedStrategy string `json:"resolved_strategy"`
	}
	if err := json.Unmarshal(metadata, &payload); err != nil {
		return "", ""
	}
	return payload.RequestedMode, payload.ResolvedStrategy
}

func handleTaskCheckpoint(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		body := append([]byte(nil), c.Body()...)
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		// Verify the task belongs to this tenant and is in a checkpointable state.
		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if !coordinator.TaskAllowsRuntimeMutation(task.Status) {
			callbackValidation := runtimeCallbackValidation{bodyDigest: sha256Hex(body)}
			if raw := strings.TrimSpace(c.Get(runtimeCallbackEnvelopeHeader)); raw != "" {
				callbackValidation = validateRuntimeCallback(c, tc.Store(), task, tenantID, "checkpoint", body)
			}
			persistRejectedRuntimeCallback(tc.Store(), tenantID, taskID, callbackRuntimeID(callbackValidation, c), "checkpoint", "terminal task does not allow runtime checkpoint mutation", callbackValidation.bodyDigest)
			return c.Status(http.StatusConflict).JSON(buildTaskTransitionRejectedPayload(task))
		}
		callbackValidation := validateRuntimeCallback(c, tc.Store(), task, tenantID, "checkpoint", body)
		if callbackValidation.reason != "" {
			return runtimeCallbackRejection(c, tc.Store(), task, tenantID, "checkpoint", callbackValidation)
		}

		var cp coordinator.CheckpointPayload
		if err := json.Unmarshal(body, &cp); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		cp.TaskID = taskID // enforce from URL
		if !runtimeCallbackMatchesTask(task, checkpointRuntimeID(&cp), c.Get("X-Igris-Runtime-ID")) {
			validation := runtimeCallbackValidation{envelope: callbackValidation.envelope, bodyDigest: callbackValidation.bodyDigest, reason: "checkpoint runtime identity does not match assigned task runtime", status: http.StatusForbidden}
			return runtimeCallbackRejection(c, tc.Store(), task, tenantID, "checkpoint", validation)
		}

		if err := tc.HandleCheckpoint(&cp); err != nil {
			if errors.Is(err, coordinator.ErrTaskTransitionRejected) {
				return c.Status(http.StatusConflict).JSON(taskTransitionRejectedPayload(tc, taskID, tenantID))
			}
			log.Error().Err(err).Str("task_id", taskID.String()).Msg("[Tasks] Save checkpoint")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "checkpoint_failed"})
		}

		updatedTask, err := tc.Store().GetTask(taskID, tenantID)
		if err != nil {
			fallbackTask := *task
			fallbackTask.Status = coordinator.TaskStatusCheckpointed
			cpCopy := cp
			fallbackTask.LastCheckpoint = &cpCopy
			updatedTask = &fallbackTask
		}

		return c.JSON(buildTaskMutationResponse(updatedTask, fiber.Map{
			"step": cp.ResumeToken.LastCommittedStep,
		}))
	}
}

func handleTaskComplete(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		body := append([]byte(nil), c.Body()...)
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if !coordinator.TaskAllowsRuntimeMutation(task.Status) {
			callbackValidation := runtimeCallbackValidation{bodyDigest: sha256Hex(body)}
			if raw := strings.TrimSpace(c.Get(runtimeCallbackEnvelopeHeader)); raw != "" {
				callbackValidation = validateRuntimeCallback(c, tc.Store(), task, tenantID, "complete", body)
			}
			persistRejectedRuntimeCallback(tc.Store(), tenantID, taskID, callbackRuntimeID(callbackValidation, c), "complete", "terminal task does not allow runtime complete mutation", callbackValidation.bodyDigest)
			return c.Status(http.StatusConflict).JSON(buildTaskTransitionRejectedPayload(task))
		}
		callbackValidation := validateRuntimeCallback(c, tc.Store(), task, tenantID, "complete", body)
		if callbackValidation.reason != "" {
			return runtimeCallbackRejection(c, tc.Store(), task, tenantID, "complete", callbackValidation)
		}
		if !runtimeCallbackMatchesTask(task, "", c.Get("X-Igris-Runtime-ID")) {
			validation := runtimeCallbackValidation{envelope: callbackValidation.envelope, bodyDigest: callbackValidation.bodyDigest, reason: "runtime callback header identity does not match assigned task runtime", status: http.StatusForbidden}
			return runtimeCallbackRejection(c, tc.Store(), task, tenantID, "complete", validation)
		}

		if err := tc.HandleComplete(taskID); err != nil {
			if errors.Is(err, coordinator.ErrTaskTransitionRejected) {
				return c.Status(http.StatusConflict).JSON(taskTransitionRejectedPayload(tc, taskID, tenantID))
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		updatedTask, err := tc.Store().GetTask(taskID, tenantID)
		if err != nil {
			fallbackTask := *task
			now := time.Now().UTC()
			fallbackTask.Status = coordinator.TaskStatusCompleted
			fallbackTask.CompletedAt = &now
			updatedTask = &fallbackTask
		}
		return c.JSON(buildTaskMutationResponse(updatedTask, nil))
	}
}

type taskFailedCallbackBody struct {
	Reason         string                          `json:"reason"`
	FailureDetails *coordinator.TaskFailureDetails `json:"failure_details,omitempty"`
}

func handleTaskFailed(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		body := append([]byte(nil), c.Body()...)
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if !coordinator.TaskAllowsRuntimeMutation(task.Status) {
			callbackValidation := runtimeCallbackValidation{bodyDigest: sha256Hex(body)}
			if raw := strings.TrimSpace(c.Get(runtimeCallbackEnvelopeHeader)); raw != "" {
				callbackValidation = validateRuntimeCallback(c, tc.Store(), task, tenantID, "failed", body)
			}
			persistRejectedRuntimeCallback(tc.Store(), tenantID, taskID, callbackRuntimeID(callbackValidation, c), "failed", "terminal task does not allow runtime failed mutation", callbackValidation.bodyDigest)
			return c.Status(http.StatusConflict).JSON(buildTaskTransitionRejectedPayload(task))
		}
		callbackValidation := validateRuntimeCallback(c, tc.Store(), task, tenantID, "failed", body)
		if callbackValidation.reason != "" {
			return runtimeCallbackRejection(c, tc.Store(), task, tenantID, "failed", callbackValidation)
		}
		if !runtimeCallbackMatchesTask(task, "", c.Get("X-Igris-Runtime-ID")) {
			validation := runtimeCallbackValidation{envelope: callbackValidation.envelope, bodyDigest: callbackValidation.bodyDigest, reason: "runtime callback header identity does not match assigned task runtime", status: http.StatusForbidden}
			return runtimeCallbackRejection(c, tc.Store(), task, tenantID, "failed", validation)
		}

		var failedBody taskFailedCallbackBody
		_ = json.Unmarshal(body, &failedBody)
		if err := tc.HandleFailedWithDetails(taskID, failedBody.Reason, failedBody.FailureDetails); err != nil {
			if errors.Is(err, coordinator.ErrTaskTransitionRejected) {
				return c.Status(http.StatusConflict).JSON(taskTransitionRejectedPayload(tc, taskID, tenantID))
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if err := tc.RecordRuntimeFailedRecoveryDecision(task, callbackRuntimeID(callbackValidation, c)); err != nil {
			log.Warn().Err(err).Str("task_id", taskID.String()).Msg("[Tasks] Persist runtime-failed recovery decision")
		}

		updatedTask, err := tc.Store().GetTask(taskID, tenantID)
		if err != nil {
			fallbackTask := *task
			fallbackTask.Status = coordinator.TaskStatusFailed
			if failedBody.Reason != "" {
				reason := failedBody.Reason
				fallbackTask.FailureReason = &reason
			}
			updatedTask = &fallbackTask
		}
		return c.JSON(buildTaskMutationResponse(updatedTask, nil))
	}
}

func callbackRuntimeID(validation runtimeCallbackValidation, c *fiber.Ctx) string {
	if validation.envelope != nil && validation.envelope.RuntimeID != "" {
		return validation.envelope.RuntimeID
	}
	if c != nil {
		return c.Get("X-Igris-Runtime-ID")
	}
	return ""
}

func checkpointRuntimeID(cp *coordinator.CheckpointPayload) string {
	if cp == nil {
		return ""
	}
	if cp.ResumeToken.RuntimeID != "" {
		return strings.TrimSpace(cp.ResumeToken.RuntimeID)
	}
	for _, entry := range cp.WalEntries {
		if strings.TrimSpace(entry.RuntimeID) != "" {
			return strings.TrimSpace(entry.RuntimeID)
		}
	}
	return ""
}

func runtimeCallbackMatchesTask(task *coordinator.TaskRecord, runtimeIDs ...string) bool {
	if task == nil || task.RuntimeID == nil || strings.TrimSpace(*task.RuntimeID) == "" {
		return true
	}
	want := strings.TrimSpace(*task.RuntimeID)
	for _, runtimeID := range runtimeIDs {
		got := strings.TrimSpace(runtimeID)
		if got == "" {
			continue
		}
		if got != want {
			return false
		}
	}
	return true
}
