package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// Execution target vocabulary for the unified Action model (Slice 1).
//
// These are not separate products. They are the surfaces a single Igris
// Action can run on. `actionTargetAPIDeprecated` is the legacy alias for
// `actionTargetHostedAPI` that existed before vocabulary normalization;
// it is accepted on input and rewritten to the canonical form, but it is
// never the preferred product term.
const (
	actionTargetHostedAPI      = "hosted_api"
	actionTargetWebhook        = "webhook"
	actionTargetLocalRuntime   = "local_runtime"
	actionTargetHybridFallback = "hybrid_fallback"
	actionTargetMockDemo       = "mock_demo"
	actionTargetAPIDeprecated  = "api"
)

// canonicalActionTargetType normalizes legacy aliases (currently only `api`)
// to the canonical execution target vocabulary. Unknown values are returned
// unchanged so the caller's validation step can report a precise error.
func canonicalActionTargetType(targetType string) string {
	t := strings.TrimSpace(targetType)
	if t == actionTargetAPIDeprecated {
		return actionTargetHostedAPI
	}
	return t
}

type actionRunRequest struct {
	Action         string                 `json:"action"`
	Input          map[string]interface{} `json:"input"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	RuntimeTarget  string                 `json:"runtime_target,omitempty"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
	DeadlineAt     *time.Time             `json:"deadline_at,omitempty"`

	// Internal-only fields populated by the gateway from the registered Action
	// definition. They are never deserialized from the public API body — the
	// `-` json tag keeps customer payloads from spoofing them.
	executedTarget     string
	preferredRuntimeID string
}

// actionFallbackPolicy describes how an Action may fall back from a primary
// execution target to a secondary one. Fallback is always explicit; the
// resolver in a later slice will refuse to silently switch surfaces.
//
// `Enabled` defaults to false. For `hybrid_fallback` actions, the create/patch
// path requires `Enabled = true` plus a primary and secondary target. The
// resolver itself is not implemented in this slice — only the model.
type actionFallbackPolicy struct {
	Enabled            bool     `json:"enabled"`
	PrimaryTarget      string   `json:"primary_target,omitempty"`
	SecondaryTarget    string   `json:"secondary_target,omitempty"`
	AllowedTargets     []string `json:"allowed_targets,omitempty"`
	RequiresReplaySafe bool     `json:"requires_replay_safe"`
	MaxAttempts        int      `json:"max_attempts,omitempty"`
}

type actionDefinition struct {
	ID               string                 `json:"id"`
	TenantID         string                 `json:"-"`
	Name             string                 `json:"name"`
	DisplayName      string                 `json:"display_name"`
	Description      string                 `json:"description"`
	TargetType       string                 `json:"target_type"`
	TargetURL        string                 `json:"target_url"`
	Method           string                 `json:"method"`
	PolicyPreset     string                 `json:"policy_preset"`
	ReplayClass      string                 `json:"replay_class"`
	ApprovalRequired bool                   `json:"approval_required"`
	Irreversible     bool                   `json:"irreversible"`
	SecretRefs       []string               `json:"secret_refs"`
	TargetMetadata   map[string]interface{} `json:"target_metadata,omitempty"`
	FallbackPolicy   actionFallbackPolicy   `json:"fallback_policy"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	ArchivedAt       *time.Time             `json:"archived_at,omitempty"`
}

type actionDefinitionRequest struct {
	Name             string                 `json:"name"`
	DisplayName      string                 `json:"display_name"`
	Description      string                 `json:"description"`
	TargetType       string                 `json:"target_type"`
	TargetURL        string                 `json:"target_url"`
	Method           string                 `json:"method"`
	PolicyPreset     string                 `json:"policy_preset"`
	ReplayClass      string                 `json:"replay_class"`
	ApprovalRequired *bool                  `json:"approval_required"`
	Irreversible     *bool                  `json:"irreversible"`
	SecretRefs       []string               `json:"secret_refs"`
	TargetMetadata   map[string]interface{} `json:"target_metadata"`
	FallbackPolicy   *actionFallbackPolicy  `json:"fallback_policy"`
}

type actionRunByNameRequest struct {
	Input          map[string]interface{} `json:"input"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
	DeadlineAt     *time.Time             `json:"deadline_at,omitempty"`
}

var actionNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_]{1,63}$`)

// RegisterActionRoutes wires the product-facing action gateway. These routes
// adapt customer action calls onto the same durable task path used by /v1/tasks.
func RegisterActionRoutes(app *fiber.App, db *sql.DB, tc *coordinator.TaskCoordinator) {
	v1 := app.Group("/v1/actions")
	v1.Use(middleware.BetterAuth(db))

	v1.Get("", handleActionList(db))
	v1.Post("", handleActionCreate(db))
	v1.Post("/run", handleActionRun(tc))
	v1.Get("/runs/:id", handleActionGetRun(tc))
	v1.Post("/:name/run", handleActionRunByName(db, tc))
	v1.Get("/:id", handleActionGet(db))
	v1.Patch("/:id", handleActionPatch(db))
	v1.Delete("/:id", handleActionArchive(db))
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

		return submitActionRun(c, tc, tenantID, req)
	}
}

func handleActionRunByName(db *sql.DB, tc *coordinator.TaskCoordinator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		name := strings.TrimSpace(c.Params("name"))
		if !validActionName(name) {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_name"})
		}
		def, err := loadActionDefinitionByName(c.Context(), db, tenantID, name)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error":   "action_not_found",
				"message": "No action with that name is configured.",
			})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		var req actionRunByNameRequest
		if len(c.Body()) > 0 {
			if err := json.Unmarshal(c.Body(), &req); err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
			}
		}
		runReq, err := buildActionRunRequestFromDefinition(def, req)
		if err != nil {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "target_not_configured",
				"message": err.Error(),
			})
		}
		return submitActionRun(c, tc, tenantID, runReq)
	}
}

func submitActionRun(c *fiber.Ctx, tc *coordinator.TaskCoordinator, tenantID string, req actionRunRequest) error {
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

func handleActionList(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		rows, err := db.QueryContext(c.Context(), `
			SELECT id, tenant_id, name, display_name, description, target_type, target_url, method,
			       policy_preset, replay_class, approval_required, irreversible, secret_refs,
			       target_metadata, created_at, updated_at, archived_at
			FROM action_definitions
			WHERE tenant_id = $1 AND archived_at IS NULL
			ORDER BY updated_at DESC
			LIMIT 200`, tenantID)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		defer rows.Close()

		actions := make([]actionDefinition, 0)
		for rows.Next() {
			def, err := scanActionDefinition(rows)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			actions = append(actions, def)
		}
		if err := rows.Err(); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"actions": actions})
	}
}

func handleActionCreate(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req actionDefinitionRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		def, err := normalizeActionDefinitionRequest(req, nil)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_definition", "message": err.Error()})
		}
		def.ID = uuid.NewString()
		def.TenantID = tenantID
		secretRefs, targetMetadata, fallbackPolicy, err := marshalActionJSON(def)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_definition", "message": err.Error()})
		}

		created, err := queryActionDefinition(c.Context(), db, `
			INSERT INTO action_definitions (
				id, tenant_id, name, display_name, description, target_type, target_url, method,
				policy_preset, replay_class, approval_required, irreversible, secret_refs, target_metadata,
				fallback_policy
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb)
			RETURNING id, tenant_id, name, display_name, description, target_type, target_url, method,
			          policy_preset, replay_class, approval_required, irreversible, secret_refs,
			          target_metadata, fallback_policy, created_at, updated_at, archived_at`,
			def.ID, def.TenantID, def.Name, def.DisplayName, def.Description, def.TargetType, def.TargetURL, def.Method,
			def.PolicyPreset, def.ReplayClass, def.ApprovalRequired, def.Irreversible, string(secretRefs), string(targetMetadata),
			string(fallbackPolicy))
		if err != nil {
			if isLikelyUniqueViolation(err) {
				return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "action_name_conflict"})
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.Status(http.StatusCreated).JSON(created)
	}
}

func handleActionGet(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		def, err := loadActionDefinitionByID(c.Context(), db, tenantID, c.Params("id"))
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(def)
	}
}

func handleActionPatch(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		current, err := loadActionDefinitionByID(c.Context(), db, tenantID, c.Params("id"))
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		var req actionDefinitionRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		def, err := normalizeActionDefinitionRequest(req, &current)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_definition", "message": err.Error()})
		}
		secretRefs, targetMetadata, fallbackPolicy, err := marshalActionJSON(def)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_action_definition", "message": err.Error()})
		}
		updated, err := queryActionDefinition(c.Context(), db, `
			UPDATE action_definitions
			SET name = $3, display_name = $4, description = $5, target_type = $6, target_url = $7,
			    method = $8, policy_preset = $9, replay_class = $10, approval_required = $11,
			    irreversible = $12, secret_refs = $13::jsonb, target_metadata = $14::jsonb,
			    fallback_policy = $15::jsonb, updated_at = NOW()
			WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL
			RETURNING id, tenant_id, name, display_name, description, target_type, target_url, method,
			          policy_preset, replay_class, approval_required, irreversible, secret_refs,
			          target_metadata, fallback_policy, created_at, updated_at, archived_at`,
			tenantID, current.ID, def.Name, def.DisplayName, def.Description, def.TargetType, def.TargetURL, def.Method,
			def.PolicyPreset, def.ReplayClass, def.ApprovalRequired, def.Irreversible, string(secretRefs), string(targetMetadata),
			string(fallbackPolicy))
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		if err != nil {
			if isLikelyUniqueViolation(err) {
				return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "action_name_conflict"})
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(updated)
	}
}

func handleActionArchive(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		res, err := db.ExecContext(c.Context(), `
			UPDATE action_definitions
			SET archived_at = NOW(), updated_at = NOW()
			WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL`, tenantID, c.Params("id"))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		return c.SendStatus(http.StatusNoContent)
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
		IdempotencyKey:     req.IdempotencyKey,
		DeadlineAt:         req.DeadlineAt,
		PreferredRuntimeID: req.preferredRuntimeID,
	}, nil
}

func buildActionRunRequestFromDefinition(def actionDefinition, req actionRunByNameRequest) (actionRunRequest, error) {
	metadata := copyActionMap(req.Metadata)
	metadata["action_definition_id"] = def.ID
	metadata["action_name"] = def.Name
	metadata["target_type"] = def.TargetType
	metadata["policy_preset"] = def.PolicyPreset
	metadata["replay_class"] = def.ReplayClass
	metadata["approval_required"] = def.ApprovalRequired
	metadata["irreversible"] = def.Irreversible

	runReq := actionRunRequest{
		Action:         def.Name,
		Input:          copyActionMap(req.Input),
		Metadata:       metadata,
		IdempotencyKey: req.IdempotencyKey,
		DeadlineAt:     req.DeadlineAt,
	}

	// Resolve legacy `api` rows to `hosted_api` for the dispatch switch.
	// Behavior for hosted_api and webhook is identical in this slice; the
	// target_type only differs in the metadata stamped onto the run.
	targetType := canonicalActionTargetType(def.TargetType)
	switch targetType {
	case actionTargetMockDemo:
		record := map[string]interface{}{
			"demo":                 true,
			"demo_behavior":        "mock_demo target; no external API was called",
			"action":               def.Name,
			"action_definition_id": def.ID,
			"requested_input":      req.Input,
			"policy_preset":        def.PolicyPreset,
			"replay_class":         def.ReplayClass,
			"approval_required":    def.ApprovalRequired,
			"irreversible":         def.Irreversible,
			"created_by_gateway":   true,
			"target_configuration": "mock_demo",
		}
		runReq.RuntimeTarget = "database_write"
		runReq.Input = map[string]interface{}{
			"table":  "action_task_mock_demo",
			"record": record,
		}
	case actionTargetWebhook, actionTargetHostedAPI:
		if strings.TrimSpace(def.TargetURL) == "" {
			return actionRunRequest{}, fmt.Errorf("target URL is not configured")
		}
		body := req.Input
		if body == nil {
			body = map[string]interface{}{}
		}
		runReq.RuntimeTarget = "http_request"
		runReq.Input = map[string]interface{}{
			"url":    def.TargetURL,
			"method": def.Method,
			"body":   body,
		}
	case actionTargetLocalRuntime:
		// local_runtime actions execute on a tenant-owned runtime. The action's
		// `input` declares the tool call (http_request / filesystem /
		// database_write) — the runtime executes it with its own local
		// capabilities. `target_metadata.runtime_id`, when set, pins dispatch
		// to a specific tenant runtime; all other target_metadata fields
		// (environment, capabilities, working_directory_label, timeout_ms) are
		// reserved for future selector slices and intentionally not echoed
		// back through the public response.
		if req.Input == nil {
			return actionRunRequest{}, fmt.Errorf("input is required for local_runtime actions")
		}
		if rid := stringFromMap(def.TargetMetadata, "runtime_id"); rid != "" {
			runReq.preferredRuntimeID = rid
		}
		runReq.executedTarget = actionTargetLocalRuntime
	case actionTargetHybridFallback:
		// Routing model exists, resolver does not. Refusing here keeps the
		// slice purely additive — no surprise behavior change for callers.
		return actionRunRequest{}, fmt.Errorf("hybrid_fallback resolver is not configured in this slice")
	default:
		return actionRunRequest{}, fmt.Errorf("unsupported target type")
	}
	// Stamp the canonical target on the run metadata so downstream slices
	// (and the console) can render "Routed via …" without re-deriving it.
	runReq.Metadata["target_type"] = targetType
	return runReq, nil
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
		"metadata":       actionNodeMetadata(req),
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

type actionDefinitionScanner interface {
	Scan(dest ...interface{}) error
}

func loadActionDefinitionByID(ctx context.Context, db *sql.DB, tenantID, id string) (actionDefinition, error) {
	return queryActionDefinition(ctx, db, `
		SELECT id, tenant_id, name, display_name, description, target_type, target_url, method,
		       policy_preset, replay_class, approval_required, irreversible, secret_refs,
		       target_metadata, fallback_policy, created_at, updated_at, archived_at
		FROM action_definitions
		WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL`, tenantID, id)
}

func loadActionDefinitionByName(ctx context.Context, db *sql.DB, tenantID, name string) (actionDefinition, error) {
	return queryActionDefinition(ctx, db, `
		SELECT id, tenant_id, name, display_name, description, target_type, target_url, method,
		       policy_preset, replay_class, approval_required, irreversible, secret_refs,
		       target_metadata, fallback_policy, created_at, updated_at, archived_at
		FROM action_definitions
		WHERE tenant_id = $1 AND name = $2 AND archived_at IS NULL`, tenantID, name)
}

func queryActionDefinition(ctx context.Context, db *sql.DB, query string, args ...interface{}) (actionDefinition, error) {
	row := db.QueryRowContext(ctx, query, args...)
	return scanActionDefinition(row)
}

func scanActionDefinition(scanner actionDefinitionScanner) (actionDefinition, error) {
	var def actionDefinition
	var secretRefsRaw []byte
	var targetMetadataRaw []byte
	var fallbackPolicyRaw []byte
	err := scanner.Scan(
		&def.ID,
		&def.TenantID,
		&def.Name,
		&def.DisplayName,
		&def.Description,
		&def.TargetType,
		&def.TargetURL,
		&def.Method,
		&def.PolicyPreset,
		&def.ReplayClass,
		&def.ApprovalRequired,
		&def.Irreversible,
		&secretRefsRaw,
		&targetMetadataRaw,
		&fallbackPolicyRaw,
		&def.CreatedAt,
		&def.UpdatedAt,
		&def.ArchivedAt,
	)
	if err != nil {
		return actionDefinition{}, err
	}
	if len(secretRefsRaw) > 0 {
		_ = json.Unmarshal(secretRefsRaw, &def.SecretRefs)
	}
	if len(targetMetadataRaw) > 0 {
		_ = json.Unmarshal(targetMetadataRaw, &def.TargetMetadata)
	}
	if len(fallbackPolicyRaw) > 0 {
		_ = json.Unmarshal(fallbackPolicyRaw, &def.FallbackPolicy)
	}
	if def.SecretRefs == nil {
		def.SecretRefs = []string{}
	}
	if def.TargetMetadata == nil {
		def.TargetMetadata = map[string]interface{}{}
	}
	// Persisted rows pre-dating migration 055 read back as an empty struct,
	// which is the same as the canonical "disabled" default — no rewrite needed.
	//
	// Canonicalize on read so API responses never leak the deprecated `api`
	// alias — rows persisted before the rename keep working but always present
	// as `hosted_api` to the world.
	def.TargetType = canonicalActionTargetType(def.TargetType)
	def.FallbackPolicy.PrimaryTarget = canonicalActionTargetType(def.FallbackPolicy.PrimaryTarget)
	def.FallbackPolicy.SecondaryTarget = canonicalActionTargetType(def.FallbackPolicy.SecondaryTarget)
	for i, allowed := range def.FallbackPolicy.AllowedTargets {
		def.FallbackPolicy.AllowedTargets[i] = canonicalActionTargetType(allowed)
	}
	return def, nil
}

func normalizeActionDefinitionRequest(req actionDefinitionRequest, current *actionDefinition) (actionDefinition, error) {
	def := actionDefinition{
		TargetType:     "mock_demo",
		Method:         "POST",
		PolicyPreset:   "Safe automation",
		ReplayClass:    "retryable",
		SecretRefs:     []string{},
		TargetMetadata: map[string]interface{}{},
	}
	if current != nil {
		def = *current
		def.SecretRefs = append([]string(nil), current.SecretRefs...)
		def.TargetMetadata = copyActionMap(current.TargetMetadata)
	}
	if strings.TrimSpace(req.Name) != "" || current == nil {
		def.Name = normalizeActionName(req.Name)
	}
	if !validActionName(def.Name) {
		return actionDefinition{}, fmt.Errorf("name must match %s", actionNamePattern.String())
	}
	if strings.TrimSpace(req.DisplayName) != "" || current == nil {
		def.DisplayName = strings.TrimSpace(req.DisplayName)
	}
	if def.DisplayName == "" {
		def.DisplayName = def.Name
	}
	if strings.TrimSpace(req.Description) != "" || current == nil {
		def.Description = strings.TrimSpace(req.Description)
	}
	if strings.TrimSpace(req.TargetType) != "" {
		def.TargetType = canonicalActionTargetType(req.TargetType)
	} else {
		// Re-canonicalize any legacy value that may have been carried over
		// from `current` so the normalized definition is always written back
		// using the preferred vocabulary.
		def.TargetType = canonicalActionTargetType(def.TargetType)
	}
	if !validActionTargetType(def.TargetType) {
		return actionDefinition{}, fmt.Errorf(
			"target_type must be one of hosted_api, webhook, local_runtime, hybrid_fallback, or mock_demo",
		)
	}
	if strings.TrimSpace(req.TargetURL) != "" || current == nil {
		def.TargetURL = strings.TrimSpace(req.TargetURL)
	}
	if strings.TrimSpace(req.Method) != "" {
		def.Method = strings.ToUpper(strings.TrimSpace(req.Method))
	}
	if def.Method == "" {
		def.Method = "POST"
	}
	if !validActionMethod(def.Method) {
		return actionDefinition{}, fmt.Errorf("method must be GET, POST, PUT, PATCH, or DELETE")
	}
	if strings.TrimSpace(req.PolicyPreset) != "" || current == nil {
		def.PolicyPreset = strings.TrimSpace(req.PolicyPreset)
	}
	if !validPolicyPreset(def.PolicyPreset) {
		return actionDefinition{}, fmt.Errorf("unsupported policy_preset")
	}
	applyPolicyPresetDefaults(&def)
	if strings.TrimSpace(req.ReplayClass) != "" {
		def.ReplayClass = strings.TrimSpace(req.ReplayClass)
	}
	if !validReplayClass(def.ReplayClass) {
		return actionDefinition{}, fmt.Errorf("replay_class must be retryable, non_retryable, or read_only")
	}
	if req.ApprovalRequired != nil {
		def.ApprovalRequired = *req.ApprovalRequired
	}
	if req.Irreversible != nil {
		def.Irreversible = *req.Irreversible
	}
	if req.SecretRefs != nil {
		for _, ref := range req.SecretRefs {
			if strings.TrimSpace(ref) == "" {
				return actionDefinition{}, fmt.Errorf("secret_refs cannot contain empty values")
			}
		}
		def.SecretRefs = append([]string(nil), req.SecretRefs...)
	}
	if req.TargetMetadata != nil {
		def.TargetMetadata = copyActionMap(req.TargetMetadata)
	}
	if req.FallbackPolicy != nil {
		def.FallbackPolicy = *req.FallbackPolicy
		def.FallbackPolicy.PrimaryTarget = canonicalActionTargetType(def.FallbackPolicy.PrimaryTarget)
		def.FallbackPolicy.SecondaryTarget = canonicalActionTargetType(def.FallbackPolicy.SecondaryTarget)
		for i, allowed := range def.FallbackPolicy.AllowedTargets {
			def.FallbackPolicy.AllowedTargets[i] = canonicalActionTargetType(allowed)
		}
	}
	if err := validateFallbackPolicy(def); err != nil {
		return actionDefinition{}, err
	}
	return def, nil
}

// validateFallbackPolicy enforces the slice-1 fallback rules:
//
//   - hybrid_fallback actions require an explicit, enabled policy with both
//     primary and secondary targets set, and the two targets must differ.
//   - Both targets, when set, must be canonical execution surfaces (not
//     another `hybrid_fallback`).
//   - Irreversible actions and `non_retryable` replay classes are not
//     fallback-safe by default. Operators may opt in only by explicitly
//     setting `requires_replay_safe: false` on the policy.
//   - For non-hybrid actions a disabled / zero-value policy is accepted and
//     is the canonical default.
func validateFallbackPolicy(def actionDefinition) error {
	fp := def.FallbackPolicy
	if def.TargetType == actionTargetHybridFallback {
		if !fp.Enabled {
			return fmt.Errorf("target_type hybrid_fallback requires fallback_policy.enabled = true")
		}
		if fp.PrimaryTarget == "" || fp.SecondaryTarget == "" {
			return fmt.Errorf("hybrid_fallback requires both fallback_policy.primary_target and secondary_target")
		}
		if fp.PrimaryTarget == fp.SecondaryTarget {
			return fmt.Errorf("hybrid_fallback primary_target and secondary_target must differ")
		}
		if !isCanonicalFallbackSurface(fp.PrimaryTarget) {
			return fmt.Errorf("fallback_policy.primary_target must be a canonical execution surface")
		}
		if !isCanonicalFallbackSurface(fp.SecondaryTarget) {
			return fmt.Errorf("fallback_policy.secondary_target must be a canonical execution surface")
		}
		if fp.MaxAttempts < 0 {
			return fmt.Errorf("fallback_policy.max_attempts must be >= 0")
		}
	}
	if fp.Enabled && !fp.RequiresReplaySafe {
		if def.Irreversible {
			return fmt.Errorf("irreversible actions cannot enable fallback without requires_replay_safe=true")
		}
		if def.ReplayClass == "non_retryable" {
			return fmt.Errorf("non_retryable replay_class cannot enable fallback without requires_replay_safe=true")
		}
	}
	return nil
}

func isCanonicalFallbackSurface(targetType string) bool {
	switch targetType {
	case actionTargetHostedAPI, actionTargetWebhook, actionTargetLocalRuntime, actionTargetMockDemo:
		return true
	default:
		return false
	}
}

func marshalActionJSON(def actionDefinition) ([]byte, []byte, []byte, error) {
	secretRefs, err := json.Marshal(def.SecretRefs)
	if err != nil {
		return nil, nil, nil, err
	}
	targetMetadata, err := json.Marshal(def.TargetMetadata)
	if err != nil {
		return nil, nil, nil, err
	}
	fallbackPolicy, err := json.Marshal(def.FallbackPolicy)
	if err != nil {
		return nil, nil, nil, err
	}
	return secretRefs, targetMetadata, fallbackPolicy, nil
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

func actionNodeMetadata(req actionRunRequest) map[string]interface{} {
	metadata := map[string]interface{}{"action": req.Action}
	for key, value := range req.Metadata {
		switch key {
		case "action_definition_id", "action_name", "target_type", "policy_preset", "replay_class", "approval_required", "irreversible":
			metadata[key] = value
		}
	}
	return metadata
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

func normalizeActionName(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, "-", "_")
	name = strings.ReplaceAll(name, " ", "_")
	return name
}

func validActionName(name string) bool {
	return actionNamePattern.MatchString(name)
}

func validActionTargetType(targetType string) bool {
	switch targetType {
	case actionTargetHostedAPI,
		actionTargetWebhook,
		actionTargetLocalRuntime,
		actionTargetHybridFallback,
		actionTargetMockDemo:
		return true
	default:
		return false
	}
}

func validActionMethod(method string) bool {
	switch method {
	case "GET", "POST", "PUT", "PATCH", "DELETE":
		return true
	default:
		return false
	}
}

func validPolicyPreset(preset string) bool {
	switch preset {
	case "Safe automation", "Human-gated", "Non-replayable", "Read-only":
		return true
	default:
		return false
	}
}

func applyPolicyPresetDefaults(def *actionDefinition) {
	switch def.PolicyPreset {
	case "Human-gated":
		def.ReplayClass = "non_retryable"
		def.ApprovalRequired = true
	case "Non-replayable":
		def.ReplayClass = "non_retryable"
		def.Irreversible = true
	case "Read-only":
		def.ReplayClass = "read_only"
		def.ApprovalRequired = false
	default:
		def.ReplayClass = "retryable"
		def.ApprovalRequired = false
	}
}

func validReplayClass(replayClass string) bool {
	switch replayClass {
	case "retryable", "non_retryable", "read_only":
		return true
	default:
		return false
	}
}

func copyActionMap(values map[string]interface{}) map[string]interface{} {
	copied := make(map[string]interface{})
	for key, value := range values {
		copied[key] = value
	}
	return copied
}

func isLikelyUniqueViolation(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
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
