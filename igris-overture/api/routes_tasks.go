package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

type publicTaskSubmitRequest struct {
	TaskID          uuid.UUID              `json:"task_id,omitempty"`
	TaskType        string                 `json:"task_type"`
	TaskDefinition  json.RawMessage        `json:"task_definition"`
	AgentTask       *publicAgentTask       `json:"agent_task,omitempty"`
	RoboticsMission *publicRoboticsMission `json:"robotics_mission,omitempty"`
	IdempotencyKey  string                 `json:"idempotency_key,omitempty"`
	DeadlineAt      *time.Time             `json:"deadline_at,omitempty"`
}

type publicAgentTask struct {
	Name        string               `json:"name,omitempty"`
	Model       string               `json:"model,omitempty"`
	Messages    []publicAgentMessage `json:"messages,omitempty"`
	MaxTokens   *uint32              `json:"max_tokens,omitempty"`
	Temperature *float32             `json:"temperature,omitempty"`
	Mode        string               `json:"mode,omitempty"`
	Memory      *publicAgentMemory   `json:"memory,omitempty"`
	Approval    *publicApproval      `json:"approval,omitempty"`
	Steps       []publicAgentStep    `json:"steps,omitempty"`
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

// RegisterTaskRoutes wires the durable task execution endpoints.
//
//	POST   /v1/tasks/submit           — submit a new task (agent workflow, robotics workflow, single inference, or behavior tree)
//	GET    /v1/tasks/:id              — poll task status
//	GET    /v1/tasks                  — list recent tasks for the tenant
//	POST   /v1/tasks/:id/checkpoint   — runtime pushes a checkpoint back to Overture
//	POST   /v1/tasks/:id/complete     — runtime signals task completion
//	POST   /v1/tasks/:id/failed       — runtime signals task failure
func RegisterTaskRoutes(app *fiber.App, db *sql.DB, tc *coordinator.TaskCoordinator) {
	v1 := app.Group("/v1/tasks")
	v1.Use(middleware.BetterAuth(db))

	v1.Post("/submit", handleTaskSubmit(tc))
	v1.Get("", handleListTasks(tc))
	v1.Get("/:id", handleGetTask(tc))
	v1.Get("/:id/steps", handleGetTaskSteps(tc))
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
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Tasks] Submit failed")
			return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
				"error":   "dispatch_failed",
				"message": err.Error(),
			})
		}

		return c.Status(http.StatusAccepted).JSON(fiber.Map{
			"task_id":    task.TaskID,
			"status":     task.Status,
			"created_at": task.CreatedAt,
		})
	}
}

func buildTaskSubmitRequest(body []byte, tenantID string) (*coordinator.TaskSubmitRequest, error) {
	var raw publicTaskSubmitRequest
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	if conflictingTaskInputCount(raw) > 1 {
		return nil, fmt.Errorf("%w: provide only one of task_definition, agent_task, or robotics_mission", coordinator.ErrInvalidTaskDefinition)
	}

	taskDefinition := raw.TaskDefinition
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
		}
	}

	return &coordinator.TaskSubmitRequest{
		TaskID:         raw.TaskID,
		TenantID:       tenantID,
		TaskType:       raw.TaskType,
		TaskDefinition: taskDefinition,
		IdempotencyKey: raw.IdempotencyKey,
		DeadlineAt:     raw.DeadlineAt,
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
		return json.Marshal(map[string]interface{}{
			"steps": steps,
		})
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

func buildExecutionGraphDefinition(name string, nodes []map[string]interface{}) (json.RawMessage, error) {
	graph := map[string]interface{}{
		"nodes": nodes,
	}
	if name != "" {
		graph["graph_id"] = name
	}
	definition, err := json.Marshal(map[string]interface{}{
		"graph": graph,
	})
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

		return c.JSON(buildTaskResponse(task))
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

		tasks, err := tc.Store().GetTasksByTenant(tenantID, limit)
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

func buildTaskResponse(task *coordinator.TaskRecord) fiber.Map {
	resp := fiber.Map{
		"task_id":       task.TaskID,
		"status":        task.Status,
		"runtime_id":    task.RuntimeID,
		"dispatched_at": task.DispatchedAt,
		"completed_at":  task.CompletedAt,
		"created_at":    task.CreatedAt,
	}
	if task.DeadlineAt != nil {
		resp["deadline_at"] = task.DeadlineAt
	}
	if taskType := extractTaskType(task.TaskDefinition); taskType != "" {
		resp["task_type"] = taskType
	}

	if task.FailureReason != nil && *task.FailureReason != "" {
		resp["failure_reason"] = *task.FailureReason
	}
	if len(task.ExecutionEnvelope) > 0 {
		resp["execution_envelope"] = task.ExecutionEnvelope
	}
	if len(task.ExecutionReceipt) > 0 {
		resp["execution_receipt"] = task.ExecutionReceipt
	}
	if proof := buildTaskProofResponse(task.Proof); proof != nil {
		resp["proof"] = proof
	}

	if task.LastCheckpoint != nil {
		resp["last_step"] = task.LastCheckpoint.ResumeToken.LastCommittedStep
		resp["checkpoint_digest"] = task.LastCheckpoint.ResumeToken.CheckpointDigest
		if len(task.LastCheckpoint.Metadata) > 0 {
			resp["checkpoint_metadata"] = json.RawMessage(task.LastCheckpoint.Metadata)
			if requestedMode, resolvedStrategy := extractModeSemantics(task.LastCheckpoint.Metadata); requestedMode != "" || resolvedStrategy != "" {
				if requestedMode != "" {
					resp["requested_mode"] = requestedMode
				}
				if resolvedStrategy != "" {
					resp["resolved_strategy"] = resolvedStrategy
				}
			}
			if graphBlackboard, graphNodes, graphSlots := extractGraphCheckpointViews(task.LastCheckpoint.Metadata); graphBlackboard != nil {
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

func buildTaskProofResponse(proof *coordinator.TaskProofState) fiber.Map {
	if proof == nil {
		return nil
	}

	resp := fiber.Map{
		"status": proof.Status,
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

		return c.JSON(fiber.Map{
			"task_id": taskID,
			"proof":   buildTaskProofResponse(proof),
		})
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
		if task.Status == coordinator.TaskStatusCompleted || task.Status == coordinator.TaskStatusFailed {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":  "task_terminal",
				"status": task.Status,
			})
		}

		var cp coordinator.CheckpointPayload
		if err := c.BodyParser(&cp); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		cp.TaskID = taskID // enforce from URL

		if err := tc.HandleCheckpoint(&cp); err != nil {
			log.Error().Err(err).Str("task_id", taskID.String()).Msg("[Tasks] Save checkpoint")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "checkpoint_failed"})
		}

		return c.JSON(fiber.Map{"ok": true, "step": cp.ResumeToken.LastCommittedStep})
	}
}

func handleTaskComplete(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		if _, err := tc.Store().GetTask(taskID, tenantID); err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
		}

		if err := tc.HandleComplete(taskID); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"ok": true})
	}
}

func handleTaskFailed(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}

		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		if _, err := tc.Store().GetTask(taskID, tenantID); err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
		}

		var body struct {
			Reason string `json:"reason"`
		}
		_ = c.BodyParser(&body)
		if err := tc.HandleFailed(taskID, body.Reason); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"ok": true})
	}
}
