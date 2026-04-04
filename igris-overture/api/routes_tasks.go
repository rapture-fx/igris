package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

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

		var req coordinator.TaskSubmitRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		req.TenantID = tenantID // always enforce from auth, not body

		if len(req.TaskDefinition) == 0 {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "task_definition required"})
		}
		if req.TaskType == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "task_type required"})
		}

		task, err := tc.Submit(c.Context(), &req)
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

		resp := fiber.Map{
			"task_id":       task.TaskID,
			"status":        task.Status,
			"runtime_id":    task.RuntimeID,
			"dispatched_at": task.DispatchedAt,
			"completed_at":  task.CompletedAt,
			"created_at":    task.CreatedAt,
		}
		if task.LastCheckpoint != nil {
			resp["last_step"] = task.LastCheckpoint.ResumeToken.LastCommittedStep
			resp["checkpoint_digest"] = task.LastCheckpoint.ResumeToken.CheckpointDigest
		}

		return c.JSON(resp)
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
			item := fiber.Map{
				"task_id":       t.TaskID,
				"status":        t.Status,
				"runtime_id":    t.RuntimeID,
				"dispatched_at": t.DispatchedAt,
				"completed_at":  t.CompletedAt,
				"created_at":    t.CreatedAt,
			}
			if t.LastCheckpoint != nil {
				item["last_step"] = t.LastCheckpoint.ResumeToken.LastCommittedStep
			}
			items = append(items, item)
		}

		return c.JSON(fiber.Map{"tasks": items, "total": len(items)})
	}
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
