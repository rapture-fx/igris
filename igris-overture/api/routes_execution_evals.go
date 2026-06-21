package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/Igris-inertial/system/igris-overture/executionevals"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

func RegisterExecutionEvalRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		return
	}
	v1 := app.Group("/v1/execution-evals")
	v1.Use(middleware.BetterAuth(db))
	store := &executionevals.SQLStore{DB: db}

	v1.Get("", handleExecutionEvalList(store))
	v1.Post("", handleExecutionEvalCreate(store))
	v1.Get("/runs/:run_id", handleExecutionEvalRunsGet(store))
	v1.Get("/:id/runs", handleExecutionEvalRunsForEvalGet(store))
	v1.Get("/:id", handleExecutionEvalGet(store))
	v1.Patch("/:id", handleExecutionEvalUpdate(store))
	v1.Delete("/:id", handleExecutionEvalDelete(store))
	v1.Post("/:id/run", handleExecutionEvalRun(store))
}

type executionEvalRequest struct {
	TenantID         string                     `json:"tenant_id"`
	Name             string                     `json:"name"`
	Description      string                     `json:"description"`
	TargetActionName string                     `json:"target_action_name"`
	TargetAgentID    string                     `json:"target_agent_id"`
	AssertionsJSON   []executionevals.Assertion `json:"assertions_json"`
	Enabled          *bool                      `json:"enabled"`
}

type executionEvalRunRequest struct {
	TenantID string `json:"tenant_id"`
	TaskID   string `json:"task_id"`
}

func handleExecutionEvalList(store *executionevals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		items, err := store.List(c.Context(), tenantID)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"evals": items, "total": len(items)})
	}
}

func handleExecutionEvalCreate(store *executionevals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req executionEvalRequest
		if err := decodeExecutionEvalBody(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}
		created, err := store.Create(c.Context(), tenantID, executionevals.CreateInput{
			Name:             req.Name,
			Description:      req.Description,
			TargetActionName: req.TargetActionName,
			TargetAgentID:    req.TargetAgentID,
			Assertions:       req.AssertionsJSON,
			Enabled:          req.Enabled,
		})
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_execution_eval", "message": err.Error()})
		}
		return c.Status(http.StatusCreated).JSON(fiber.Map{"eval": created})
	}
}

func handleExecutionEvalGet(store *executionevals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		item, err := store.Get(c.Context(), tenantID, c.Params("id"))
		if errors.Is(err, executionevals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"eval": item})
	}
}

func handleExecutionEvalUpdate(store *executionevals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req executionEvalRequest
		if err := decodeExecutionEvalBody(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}
		input := executionevals.UpdateInput{
			Enabled: req.Enabled,
		}
		if bodyHasField(c.Body(), "name") {
			input.Name = &req.Name
		}
		if bodyHasField(c.Body(), "description") {
			input.Description = &req.Description
		}
		if bodyHasField(c.Body(), "target_action_name") {
			input.TargetActionName = &req.TargetActionName
		}
		if bodyHasField(c.Body(), "target_agent_id") {
			input.TargetAgentID = &req.TargetAgentID
		}
		if bodyHasField(c.Body(), "assertions_json") {
			input.Assertions = &req.AssertionsJSON
		}
		updated, err := store.Update(c.Context(), tenantID, c.Params("id"), input)
		if errors.Is(err, executionevals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_execution_eval", "message": err.Error()})
		}
		return c.JSON(fiber.Map{"eval": updated})
	}
}

func handleExecutionEvalDelete(store *executionevals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		err := store.Archive(c.Context(), tenantID, c.Params("id"))
		if errors.Is(err, executionevals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"ok": true})
	}
}

func handleExecutionEvalRun(store *executionevals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req executionEvalRunRequest
		if err := decodeExecutionEvalBody(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}
		taskID, err := uuid.Parse(strings.TrimSpace(req.TaskID))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_task_id"})
		}
		eval, err := store.Get(c.Context(), tenantID, c.Params("id"))
		if errors.Is(err, executionevals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if !eval.Enabled {
			return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "eval_disabled"})
		}
		truth, err := store.LoadExecutionTruth(c.Context(), tenantID, taskID)
		if errors.Is(err, executionevals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		results, passed, failed := executionevals.RunAssertions(eval.Assertions, truth)
		run, err := store.CreateRun(c.Context(), tenantID, eval, truth, results, passed, failed)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.Status(http.StatusCreated).JSON(fiber.Map{"eval_run": run})
	}
}

func handleExecutionEvalRunsGet(store *executionevals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		items, err := store.GetRunsForTaskOrRun(c.Context(), tenantID, c.Params("run_id"))
		if errors.Is(err, executionevals.ErrNotFound) {
			return c.JSON(fiber.Map{"eval_runs": []executionevals.Run{}, "total": 0})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"eval_runs": items, "total": len(items)})
	}
}

func handleExecutionEvalRunsForEvalGet(store *executionevals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		if _, err := store.Get(c.Context(), tenantID, c.Params("id")); errors.Is(err, executionevals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		} else if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		items, err := store.GetRunsForEval(c.Context(), tenantID, c.Params("id"), c.QueryInt("limit", 20))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"eval_runs": items, "total": len(items)})
	}
}

func decodeExecutionEvalBody(body []byte, out any) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	return decoder.Decode(out)
}

func bodyHasField(body []byte, field string) bool {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return false
	}
	_, ok := raw[field]
	return ok
}
