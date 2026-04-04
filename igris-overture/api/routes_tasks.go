package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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
	RoboticsMission *publicRoboticsMission `json:"robotics_mission,omitempty"`
	IdempotencyKey  string                 `json:"idempotency_key,omitempty"`
	DeadlineAt      *time.Time             `json:"deadline_at,omitempty"`
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

	if len(raw.TaskDefinition) > 0 && raw.RoboticsMission != nil {
		return nil, fmt.Errorf("%w: provide either task_definition or robotics_mission, not both", coordinator.ErrInvalidTaskDefinition)
	}

	taskDefinition := raw.TaskDefinition
	if len(taskDefinition) == 0 && raw.RoboticsMission != nil {
		if raw.TaskType != "robotics_workflow" {
			return nil, fmt.Errorf("%w: robotics_mission is only valid with task_type=robotics_workflow", coordinator.ErrInvalidTaskDefinition)
		}
		var err error
		taskDefinition, err = buildRoboticsMissionTaskDefinition(raw.RoboticsMission)
		if err != nil {
			return nil, err
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

func buildRoboticsMissionTaskDefinition(mission *publicRoboticsMission) (json.RawMessage, error) {
	if mission == nil {
		return nil, fmt.Errorf("%w: robotics_mission is required", coordinator.ErrInvalidTaskDefinition)
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
		if approval := buildMissionApproval(mission, "navigate_to_pose", idx+1); approval != nil {
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
		if approval := buildMissionApproval(mission, "publish_prompt", 0); approval != nil {
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
		if approval := buildMissionApproval(mission, "publish_velocity", 0); approval != nil {
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
		if approval := buildMissionApproval(mission, "publish_zero_velocity", 0); approval != nil {
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

func buildMissionApproval(mission *publicRoboticsMission, action string, waypointIndex int) map[string]interface{} {
	if mission == nil || mission.Approval == nil {
		return nil
	}

	approval := map[string]interface{}{
		"required": mission.Approval.Required,
	}
	if mission.Approval.Confidence != nil {
		approval["confidence"] = *mission.Approval.Confidence
	}
	if len(mission.Approval.Context) > 0 {
		context := make(map[string]interface{}, len(mission.Approval.Context)+2)
		for key, value := range mission.Approval.Context {
			context[key] = value
		}
		if mission.Name != "" {
			context["mission_name"] = mission.Name
		}
		context["action"] = action
		if waypointIndex > 0 {
			context["waypoint_index"] = waypointIndex
		}
		approval["context"] = context
	}
	task := mission.Approval.Task
	if task == "" {
		if mission.Name != "" {
			task = mission.Name + ":" + action
		} else {
			task = action
		}
	}
	approval["task"] = task
	return approval
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

	if task.LastCheckpoint != nil {
		resp["last_step"] = task.LastCheckpoint.ResumeToken.LastCommittedStep
		resp["checkpoint_digest"] = task.LastCheckpoint.ResumeToken.CheckpointDigest
		if len(task.LastCheckpoint.Metadata) > 0 {
			resp["checkpoint_metadata"] = json.RawMessage(task.LastCheckpoint.Metadata)
		}
	}

	return resp
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
