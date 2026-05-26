package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

type actionRunRequest struct {
	Action         string                 `json:"action"`
	Input          map[string]interface{} `json:"input"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	RuntimeTarget  string                 `json:"runtime_target,omitempty"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
	DeadlineAt     *time.Time             `json:"deadline_at,omitempty"`
}

// RegisterActionRoutes wires the product-facing action gateway. These routes
// adapt customer action calls onto the same durable task path used by /v1/tasks.
func RegisterActionRoutes(app *fiber.App, db *sql.DB, tc *coordinator.TaskCoordinator) {
	v1 := app.Group("/v1/actions")
	v1.Use(middleware.BetterAuth(db))

	v1.Post("/run", handleActionRun(tc))
	v1.Get("/runs/:id", handleActionGetRun(tc))
}

func handleActionRun(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		var req actionRunRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}

		taskReq, err := buildActionTaskSubmitRequest(req, tenantID)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "invalid_action_request",
				"message": err.Error(),
			})
		}

		task, err := tc.Submit(c.Context(), taskReq)
		if err != nil {
			if errors.Is(err, coordinator.ErrTaskCapabilityDenied) {
				return c.Status(http.StatusForbidden).JSON(fiber.Map{
					"error":   "policy_denied",
					"message": err.Error(),
				})
			}
			if errors.Is(err, coordinator.ErrInvalidTaskDefinition) {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{
					"error":   "invalid_action_request",
					"message": err.Error(),
				})
			}
			log.Error().Err(err).Str("tenant_id", tenantID).Str("action", req.Action).Msg("[Actions] Run failed")
			return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
				"error":   "runtime_unavailable",
				"message": "no runtime was available to accept the action",
			})
		}

		status := http.StatusAccepted
		if task.Status == coordinator.TaskStatusApprovalRequired {
			status = http.StatusConflict
		}
		return c.Status(status).JSON(buildActionRunResponse(task))
	}
}

func handleActionGetRun(tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		taskID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_run_id"})
		}
		task, err := tc.Store().GetTask(taskID, tenantID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "run_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if coordinator.TaskProofNeedsReadReconciliation(task.Proof, time.Now().UTC()) {
			if proof, err := tc.Store().SyncTaskProofState(taskID, tenantID); err == nil {
				task.Proof = proof
			}
		}
		return c.JSON(buildActionRunResponse(task))
	}
}

func buildActionTaskSubmitRequest(req actionRunRequest, tenantID string) (*coordinator.TaskSubmitRequest, error) {
	action := strings.TrimSpace(req.Action)
	if action == "" {
		return nil, fmt.Errorf("action is required")
	}
	if req.Input == nil {
		return nil, fmt.Errorf("input is required")
	}
	def, err := buildActionExecutionGraphDefinition(req)
	if err != nil {
		return nil, err
	}
	return &coordinator.TaskSubmitRequest{
		TenantID:       tenantID,
		TaskType:       "execution_graph",
		TaskDefinition: def,
		AgentIdentity: &coordinator.AgentIdentity{
			AgentID:     stringFromMap(req.Metadata, "agent_id"),
			PrincipalID: stringFromMap(req.Metadata, "user_id"),
		},
		IdempotencyKey: req.IdempotencyKey,
		DeadlineAt:     req.DeadlineAt,
	}, nil
}

func buildActionExecutionGraphDefinition(req actionRunRequest) (json.RawMessage, error) {
	target := strings.TrimSpace(req.RuntimeTarget)
	if target == "" {
		target = inferRuntimeTarget(req.Input)
	}
	if target == "" {
		return nil, fmt.Errorf("runtime_target is required until this action is registered; use http_request, filesystem, or database_write")
	}

	nodeID := actionNodeID(req.Action)
	node := map[string]interface{}{
		"kind":           "tool",
		"node_id":        nodeID,
		"checkpoint_key": nodeID + "-checkpoint-0",
		"write_slot":     "action." + strings.ReplaceAll(nodeID, "-", "_"),
		"metadata": map[string]interface{}{
			"action": req.Action,
		},
	}

	switch target {
	case "http_request":
		url := stringFromMap(req.Input, "url")
		if url == "" {
			return nil, fmt.Errorf("input.url is required for runtime_target=http_request")
		}
		method := strings.ToUpper(stringFromMap(req.Input, "method"))
		if method == "" {
			method = "POST"
		}
		args := map[string]interface{}{"method": method, "url": url}
		if body, ok := req.Input["body"]; ok {
			args["body"] = stringifyActionBody(body)
		}
		if headers, ok := req.Input["headers"].(map[string]interface{}); ok && len(headers) > 0 {
			args["headers"] = headers
		}
		node["tool_name"] = "http_request"
		node["args"] = args
	case "filesystem":
		path := stringFromMap(req.Input, "path")
		if path == "" {
			return nil, fmt.Errorf("input.path is required for runtime_target=filesystem")
		}
		operation := stringFromMap(req.Input, "operation")
		if operation == "" {
			operation = "read"
		}
		node["tool_name"] = "filesystem"
		node["args"] = map[string]interface{}{"operation": operation, "path": path}
	case "database_write":
		table := stringFromMap(req.Input, "table")
		if table == "" {
			return nil, fmt.Errorf("input.table is required for runtime_target=database_write")
		}
		record, _ := req.Input["record"].(map[string]interface{})
		if record == nil {
			record = map[string]interface{}{}
		}
		node["tool_name"] = "database_write"
		node["args"] = map[string]interface{}{"table": table, "record": record}
	default:
		return nil, fmt.Errorf("runtime_target must be one of http_request, filesystem, or database_write")
	}

	return buildExecutionGraphDefinition(req.Action, []map[string]interface{}{node})
}

func buildActionRunResponse(task *coordinator.TaskRecord) fiber.Map {
	proofStatus := "pending"
	executionID := ""
	if task.Proof == nil {
		proofStatus = "unavailable"
	} else {
		if task.Proof.Status != "" {
			proofStatus = task.Proof.Status
		}
		executionID = task.Proof.ExecutionID
	}
	resp := fiber.Map{
		"task_id":      task.TaskID.String(),
		"run_id":       task.TaskID.String(),
		"status":       string(task.Status),
		"proof_status": proofStatus,
	}
	if executionID != "" {
		resp["execution_id"] = executionID
	}
	if task.Status == coordinator.TaskStatusFailed && task.FailureReason != nil {
		resp["error"] = "action_failed"
		resp["message"] = *task.FailureReason
	}
	if task.Status == coordinator.TaskStatusApprovalRequired {
		resp["error"] = "approval_required"
	}
	if task.Status == coordinator.TaskStatusCompleted {
		resp["result"] = fiber.Map{"status": "completed"}
	}
	if consoleURL := actionConsoleURL(task.TaskID.String()); consoleURL != "" {
		resp["console_url"] = consoleURL
	}
	return resp
}

func inferRuntimeTarget(input map[string]interface{}) string {
	switch {
	case stringFromMap(input, "url") != "":
		return "http_request"
	case stringFromMap(input, "path") != "":
		return "filesystem"
	case stringFromMap(input, "table") != "":
		return "database_write"
	default:
		return ""
	}
}

func actionNodeID(action string) string {
	replacer := strings.NewReplacer(".", "-", "_", "-", "/", "-", " ", "-")
	nodeID := strings.ToLower(replacer.Replace(strings.TrimSpace(action)))
	nodeID = strings.Trim(nodeID, "-")
	if nodeID == "" {
		return "action-0"
	}
	return nodeID + "-0"
}

func stringFromMap(values map[string]interface{}, key string) string {
	if values == nil {
		return ""
	}
	value, ok := values[key]
	if !ok {
		return ""
	}
	if s, ok := value.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func stringifyActionBody(body interface{}) string {
	if s, ok := body.(string); ok {
		return s
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return ""
	}
	return string(raw)
}

func actionConsoleURL(taskID string) string {
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("IGRIS_CONSOLE_URL")), "/")
	if base == "" {
		return ""
	}
	return base + "/execution/tasks/" + taskID
}
