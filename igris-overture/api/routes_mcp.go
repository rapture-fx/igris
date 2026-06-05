package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// RegisterMcpRoutes registers MCP proxy routes that forward JSON-RPC requests
// to the Igris Runtime's MCP server. Authentication is required when
// multi-tenancy is enabled.
func RegisterMcpRoutes(app *fiber.App, _ *middleware.TenantAuth) {
	log.Println("[Routes] Registering MCP proxy endpoints...")

	runtimeURL := os.Getenv("RUNTIME_URL")
	if runtimeURL == "" {
		runtimeURL = "http://localhost:8080"
	}

	mcpHandler := &mcpProxyHandler{
		runtimeURL: runtimeURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}

	enableMultiTenancy := os.Getenv("ENABLE_MULTI_TENANCY") == "true"

	if enableMultiTenancy {
		app.Post("/v1/mcp", mcpHandler.handleMcp)
		app.Post("/v1/mcp/stream", mcpHandler.handleMcpStream)
		log.Println("[Routes] ✓ POST /v1/mcp (CLERK AUTH REQUIRED)")
		log.Println("[Routes] ✓ POST /v1/mcp/stream (CLERK AUTH REQUIRED)")
	} else {
		app.Post("/v1/mcp", mcpHandler.handleMcp)
		app.Post("/v1/mcp/stream", mcpHandler.handleMcpStream)
		log.Println("[Routes] ✓ POST /v1/mcp")
		log.Println("[Routes] ✓ POST /v1/mcp/stream")
	}

	log.Println("[Routes] MCP proxy routes registered successfully")
}

// RegisterAgentMcpRoutes registers the agent-facing MCP endpoint backed by the
// Go API's own action/task/runtime primitives. It is intentionally HTTP
// JSON-RPC only for Slice 1.
func RegisterAgentMcpRoutes(app *fiber.App, db *sql.DB, tc *coordinator.TaskCoordinator) {
	if db == nil || tc == nil {
		log.Println("[Routes] Agent MCP endpoints disabled — database or task coordinator unavailable")
		return
	}
	h := newAgentMcpHandler(db, tc)
	v1 := app.Group("/v1/mcp")
	v1.Use(middleware.BetterAuth(db))
	v1.Post("", h.handle)
	log.Println("[Routes] ✓ POST /v1/mcp (agent MCP tools)")
}

type mcpProxyHandler struct {
	runtimeURL string
	httpClient *http.Client
}

// handleMcp forwards a JSON-RPC request to the runtime's /mcp endpoint.
func (h *mcpProxyHandler) handleMcp(c *fiber.Ctx) error {
	return h.proxyToRuntime(c, "/mcp")
}

// handleMcpStream forwards a JSON-RPC request to the runtime's /mcp/stream SSE endpoint.
func (h *mcpProxyHandler) handleMcpStream(c *fiber.Ctx) error {
	return h.proxyToRuntime(c, "/mcp/stream")
}

func (h *mcpProxyHandler) proxyToRuntime(c *fiber.Ctx, path string) error {
	targetURL := h.runtimeURL + path

	req, err := http.NewRequestWithContext(
		c.UserContext(),
		http.MethodPost,
		targetURL,
		bytes.NewReader(c.Body()),
	)
	if err != nil {
		return c.Status(500).JSON(mcpProxyErrorResponse(
			"overture",
			"mcp_proxy_request_build_failed",
			"Failed to create proxy request",
			err.Error(),
		))
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return c.Status(502).JSON(mcpProxyErrorResponse(
			"runtime",
			"runtime_unreachable",
			"Runtime unreachable",
			err.Error(),
		))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(502).JSON(mcpProxyErrorResponse(
			"runtime",
			"runtime_response_read_failed",
			"Failed to read runtime response",
			err.Error(),
		))
	}

	c.Set("Content-Type", resp.Header.Get("Content-Type"))
	return c.Status(resp.StatusCode).Send(body)
}

func mcpProxyErrorResponse(source, failureType, message, detail string) fiber.Map {
	return fiber.Map{
		"jsonrpc": "2.0",
		"id":      nil,
		"error": fiber.Map{
			"code":    -32603,
			"message": message,
		},
		"failure": models.BuildSimpleFailureResponse(source, "mcp_proxy", failureType, message, detail),
	}
}

type agentMcpHandler struct {
	db           *sql.DB
	tc           *coordinator.TaskCoordinator
	submitAction func(*fiber.Ctx, string, actionDefinition, actionRunByNameRequest) (fiber.Map, int, error)
}

type mcpJSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type mcpToolCallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

func newAgentMcpHandler(db *sql.DB, tc *coordinator.TaskCoordinator) *agentMcpHandler {
	h := &agentMcpHandler{db: db, tc: tc}
	h.submitAction = h.submitActionThroughGateway
	return h
}

func (h *agentMcpHandler) handle(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(http.StatusUnauthorized).JSON(mcpError(nil, -32001, "unauthorized", "authentication required"))
	}
	var req mcpJSONRPCRequest
	if err := json.Unmarshal(c.Body(), &req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(mcpError(nil, -32700, "validation_error", "invalid JSON-RPC body"))
	}
	result, status, err := h.dispatch(c, tenantID, req)
	if err != nil {
		code, msg := mcpErrorCode(err)
		return c.Status(status).JSON(mcpError(req.ID, code, msg, err.Error()))
	}
	return c.JSON(fiber.Map{"jsonrpc": "2.0", "id": req.ID, "result": result})
}

func (h *agentMcpHandler) dispatch(c *fiber.Ctx, tenantID string, req mcpJSONRPCRequest) (interface{}, int, error) {
	switch req.Method {
	case "initialize":
		return fiber.Map{
			"protocolVersion": "2024-11-05",
			"serverInfo":      fiber.Map{"name": "igris-overture", "version": "slice-1"},
			"capabilities":    fiber.Map{"tools": fiber.Map{}},
		}, http.StatusOK, nil
	case "tools/list":
		return fiber.Map{"tools": mcpToolDefinitions()}, http.StatusOK, nil
	case "tools/call":
		var params mcpToolCallParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return nil, http.StatusBadRequest, errValidation("invalid tools/call params")
		}
		result, status, err := h.callTool(c, tenantID, params.Name, params.Arguments)
		if err != nil {
			return nil, status, err
		}
		return mcpToolResult(result), http.StatusOK, nil
	default:
		result, status, err := h.callTool(c, tenantID, req.Method, req.Params)
		if err != nil {
			return nil, status, err
		}
		return result, http.StatusOK, nil
	}
}

func (h *agentMcpHandler) callTool(c *fiber.Ctx, tenantID, name string, args json.RawMessage) (interface{}, int, error) {
	switch name {
	case "list_actions":
		return h.listActions(c, tenantID)
	case "get_action":
		return h.getAction(c, tenantID, args)
	case "call_action":
		return h.callAction(c, tenantID, args)
	case "list_runs":
		return h.listRuns(tenantID, args)
	case "get_run":
		return h.getRun(c, tenantID, args)
	case "get_run_evidence":
		return h.getRunEvidence(c, tenantID, args)
	case "list_runtimes":
		return h.listRuntimes(c, tenantID)
	default:
		return nil, http.StatusBadRequest, errValidation("unknown MCP tool")
	}
}

func (h *agentMcpHandler) listActions(c *fiber.Ctx, tenantID string) (interface{}, int, error) {
	rows, err := h.db.QueryContext(c.Context(), `
		SELECT id, tenant_id, name, display_name, description, target_type, target_url, method,
		       policy_preset, replay_class, approval_required, irreversible, secret_refs,
		       target_metadata, fallback_policy, created_at, updated_at, archived_at
		FROM action_definitions
		WHERE tenant_id = $1 AND archived_at IS NULL
		ORDER BY updated_at DESC
		LIMIT 200`, tenantID)
	if err != nil {
		return nil, http.StatusServiceUnavailable, errBackend("list actions failed")
	}
	defer rows.Close()
	actions := []fiber.Map{}
	for rows.Next() {
		def, err := scanActionDefinition(rows)
		if err != nil {
			return nil, http.StatusServiceUnavailable, errBackend("scan action failed")
		}
		actions = append(actions, safeMCPActionSummary(def))
	}
	if err := rows.Err(); err != nil {
		return nil, http.StatusServiceUnavailable, errBackend("list actions failed")
	}
	return fiber.Map{"actions": actions, "total": len(actions)}, http.StatusOK, nil
}

func (h *agentMcpHandler) getAction(c *fiber.Ctx, tenantID string, args json.RawMessage) (interface{}, int, error) {
	def, status, err := h.loadActionFromArgs(c, tenantID, args)
	if err != nil {
		return nil, status, err
	}
	return fiber.Map{"action": safeMCPActionDetail(def)}, http.StatusOK, nil
}

func (h *agentMcpHandler) callAction(c *fiber.Ctx, tenantID string, args json.RawMessage) (interface{}, int, error) {
	var req struct {
		ID             string                 `json:"id"`
		ActionID       string                 `json:"action_id"`
		Name           string                 `json:"name"`
		ActionName     string                 `json:"action_name"`
		Input          map[string]interface{} `json:"input"`
		Metadata       map[string]interface{} `json:"metadata"`
		IdempotencyKey string                 `json:"idempotency_key"`
		DeadlineAt     *time.Time             `json:"deadline_at"`
	}
	if err := json.Unmarshal(args, &req); err != nil {
		return nil, http.StatusBadRequest, errValidation("invalid call_action arguments")
	}
	def, status, err := h.loadAction(c, tenantID, firstNonEmptyString(req.ActionID, req.ID), firstNonEmptyString(req.ActionName, req.Name))
	if err != nil {
		return nil, status, err
	}
	resp, status, err := h.submitAction(c, tenantID, def, actionRunByNameRequest{
		Input:          req.Input,
		Metadata:       req.Metadata,
		IdempotencyKey: req.IdempotencyKey,
		DeadlineAt:     req.DeadlineAt,
	})
	if err != nil {
		return nil, status, err
	}
	resp["action"] = safeMCPActionSummary(def)
	resp["inspect_ref"] = fmt.Sprintf("/v1/mcp get_run run_id=%s", stringFromAny(resp["run_id"]))
	return resp, http.StatusOK, nil
}

func (h *agentMcpHandler) listRuns(tenantID string, args json.RawMessage) (interface{}, int, error) {
	limit := 20
	var req struct {
		Limit int `json:"limit"`
	}
	if len(args) > 0 {
		_ = json.Unmarshal(args, &req)
		if req.Limit > 0 {
			limit = req.Limit
		}
	}
	if limit > 100 {
		limit = 100
	}
	_ = h.tc.Store().RefreshPendingProofStates(tenantID, limit)
	tasks, err := h.tc.Store().GetTasksByTenant(tenantID, limit)
	if err != nil {
		return nil, http.StatusServiceUnavailable, errBackend("list runs failed")
	}
	runs := []fiber.Map{}
	for _, task := range tasks {
		runs = append(runs, safeMCPRunSummary(task))
	}
	return fiber.Map{"runs": runs, "total": len(runs)}, http.StatusOK, nil
}

func (h *agentMcpHandler) getRun(c *fiber.Ctx, tenantID string, args json.RawMessage) (interface{}, int, error) {
	task, status, err := h.loadRun(c, tenantID, args)
	if err != nil {
		return nil, status, err
	}
	appendProofReadReconciliation(h.tc, task, tenantID)
	return fiber.Map{"run": safeMCPRunDetail(task)}, http.StatusOK, nil
}

func (h *agentMcpHandler) getRunEvidence(c *fiber.Ctx, tenantID string, args json.RawMessage) (interface{}, int, error) {
	task, status, err := h.loadRun(c, tenantID, args)
	if err != nil {
		return nil, status, err
	}
	appendProofReadReconciliation(h.tc, task, tenantID)
	steps, _ := h.tc.Store().GetAllTaskSteps(task.TaskID)
	return fiber.Map{"evidence": safeMCPRunEvidence(task, steps)}, http.StatusOK, nil
}

func (h *agentMcpHandler) listRuntimes(c *fiber.Ctx, tenantID string) (interface{}, int, error) {
	rows, err := h.db.QueryContext(c.Context(), `
		SELECT runtime_id, status, capabilities, last_seen_at
		FROM runtime_instances
		WHERE tenant_id = $1
		ORDER BY last_seen_at DESC NULLS LAST
		LIMIT 100`, tenantID)
	if err != nil {
		return nil, http.StatusServiceUnavailable, errBackend("list runtimes failed")
	}
	defer rows.Close()
	runtimes := []fiber.Map{}
	for rows.Next() {
		var runtimeID, status string
		var capabilitiesRaw []byte
		var lastSeen *time.Time
		if err := rows.Scan(&runtimeID, &status, &capabilitiesRaw, &lastSeen); err != nil {
			return nil, http.StatusServiceUnavailable, errBackend("scan runtime failed")
		}
		runtimes = append(runtimes, fiber.Map{
			"runtime_id":   runtimeID,
			"status":       status,
			"capabilities": safeJSONList(capabilitiesRaw),
			"last_seen_at": lastSeen,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, http.StatusServiceUnavailable, errBackend("list runtimes failed")
	}
	return fiber.Map{"runtimes": runtimes, "total": len(runtimes)}, http.StatusOK, nil
}

func (h *agentMcpHandler) loadActionFromArgs(c *fiber.Ctx, tenantID string, args json.RawMessage) (actionDefinition, int, error) {
	var req struct {
		ID         string `json:"id"`
		ActionID   string `json:"action_id"`
		Name       string `json:"name"`
		ActionName string `json:"action_name"`
	}
	if err := json.Unmarshal(args, &req); err != nil {
		return actionDefinition{}, http.StatusBadRequest, errValidation("invalid get_action arguments")
	}
	return h.loadAction(c, tenantID, firstNonEmptyString(req.ActionID, req.ID), firstNonEmptyString(req.ActionName, req.Name))
}

func (h *agentMcpHandler) loadAction(c *fiber.Ctx, tenantID, id, name string) (actionDefinition, int, error) {
	if strings.TrimSpace(id) != "" {
		def, err := loadActionDefinitionByID(c.Context(), h.db, tenantID, id)
		return def, statusForActionLoadErr(err), errForActionLoadErr(err)
	}
	if strings.TrimSpace(name) != "" {
		def, err := loadActionDefinitionByName(c.Context(), h.db, tenantID, name)
		return def, statusForActionLoadErr(err), errForActionLoadErr(err)
	}
	return actionDefinition{}, http.StatusBadRequest, errValidation("action_id or action_name is required")
}

func (h *agentMcpHandler) loadRun(c *fiber.Ctx, tenantID string, args json.RawMessage) (*coordinator.TaskRecord, int, error) {
	var req struct {
		RunID  string `json:"run_id"`
		TaskID string `json:"task_id"`
		ID     string `json:"id"`
	}
	if err := json.Unmarshal(args, &req); err != nil {
		return nil, http.StatusBadRequest, errValidation("invalid run arguments")
	}
	id := firstNonEmptyString(req.RunID, req.TaskID, req.ID)
	taskID, err := uuid.Parse(id)
	if err != nil {
		return nil, http.StatusBadRequest, errValidation("invalid run id")
	}
	task, err := h.tc.Store().GetTask(taskID, tenantID)
	if err == sql.ErrNoRows {
		return nil, http.StatusNotFound, errNotFound("run not found")
	}
	if err != nil {
		return nil, http.StatusServiceUnavailable, errBackend("get run failed")
	}
	return task, http.StatusOK, nil
}

func (h *agentMcpHandler) submitActionThroughGateway(c *fiber.Ctx, tenantID string, def actionDefinition, req actionRunByNameRequest) (fiber.Map, int, error) {
	runReq, err := buildActionRunRequestFromDefinition(def, req)
	if err != nil {
		return nil, http.StatusConflict, errValidation(err.Error())
	}
	if runReq.executedTarget == actionTargetLocalRuntime && !tenantHasHealthyRuntime(c.Context(), h.db, tenantID, runReq.preferredRuntimeID) {
		return nil, http.StatusServiceUnavailable, errRuntimeUnavailable("no connected runtime is available to execute this local_runtime action")
	}
	taskReq, err := buildActionTaskSubmitRequest(runReq, tenantID)
	if err != nil {
		return nil, http.StatusBadRequest, errValidation(err.Error())
	}
	task, err := h.tc.Submit(c.Context(), taskReq)
	if err != nil {
		if errors.Is(err, coordinator.ErrTaskCapabilityDenied) {
			return nil, http.StatusForbidden, errPolicyDenied(err.Error())
		}
		if errors.Is(err, coordinator.ErrInvalidTaskDefinition) {
			return nil, http.StatusBadRequest, errValidation(err.Error())
		}
		return nil, http.StatusServiceUnavailable, errRuntimeUnavailable("no runtime was available to accept the action")
	}
	if runReq.executedTarget != "" {
		_ = h.tc.Store().StampExecutedTarget(task.TaskID, tenantID, runReq.executedTarget)
	}
	resp := buildActionRunResponse(task)
	resp["created_at"] = task.CreatedAt
	resp["action_id"] = def.ID
	resp["action_name"] = def.Name
	resp["inspect_url"] = fmt.Sprintf("/v1/tasks/%s", task.TaskID.String())
	if task.Status == coordinator.TaskStatusApprovalRequired {
		return resp, http.StatusConflict, nil
	}
	return resp, http.StatusAccepted, nil
}

func safeMCPActionSummary(def actionDefinition) fiber.Map {
	return fiber.Map{
		"action_id":           def.ID,
		"name":                def.Name,
		"target_type":         canonicalActionTargetType(def.TargetType),
		"policy":              safeMCPPolicySummary(def),
		"runtime_requirement": runtimeRequirementForAction(def),
		"description":         strings.TrimSpace(firstNonEmptyString(def.DisplayName, def.Description)),
	}
}

func safeMCPActionDetail(def actionDefinition) fiber.Map {
	resp := safeMCPActionSummary(def)
	resp["policy_summary"] = safeMCPPolicySummary(def)
	resp["call"] = fiber.Map{
		"tool":                "call_action",
		"action_id":           def.ID,
		"action_name":         def.Name,
		"method":              safeMethodForAction(def),
		"endpoint_configured": strings.TrimSpace(def.TargetURL) != "",
	}
	if example := safeExamplePayload(def); example != nil {
		resp["example_payload"] = example
	}
	return resp
}

func safeMCPPolicySummary(def actionDefinition) fiber.Map {
	status := "configured"
	if strings.TrimSpace(def.PolicyPreset) == "" {
		status = "unspecified"
	}
	return fiber.Map{
		"preset":            def.PolicyPreset,
		"status":            status,
		"replay_class":      def.ReplayClass,
		"approval_required": def.ApprovalRequired,
		"irreversible":      def.Irreversible,
	}
}

func runtimeRequirementForAction(def actionDefinition) string {
	switch canonicalActionTargetType(def.TargetType) {
	case actionTargetLocalRuntime:
		return "tenant_runtime_required"
	case actionTargetHybridFallback:
		return "runtime_resolver_required"
	case actionTargetMockDemo:
		return "igris_managed_demo"
	default:
		return "igris_managed_runtime"
	}
}

func safeMethodForAction(def actionDefinition) string {
	if canonicalActionTargetType(def.TargetType) == actionTargetHostedAPI || canonicalActionTargetType(def.TargetType) == actionTargetWebhook {
		if method := strings.ToUpper(strings.TrimSpace(def.Method)); method != "" {
			return method
		}
	}
	return ""
}

func safeExamplePayload(def actionDefinition) fiber.Map {
	switch canonicalActionTargetType(def.TargetType) {
	case actionTargetLocalRuntime:
		return fiber.Map{"input": fiber.Map{"url": "https://service.example/action", "method": "POST"}}
	case actionTargetMockDemo:
		return fiber.Map{"input": fiber.Map{"example": true}}
	default:
		return fiber.Map{"input": fiber.Map{}}
	}
}

func safeMCPRunSummary(task *coordinator.TaskRecord) fiber.Map {
	resp := fiber.Map{
		"run_id":           task.TaskID.String(),
		"task_id":          task.TaskID.String(),
		"status":           string(task.Status),
		"action":           actionInfoFromTask(task),
		"policy_state":     policyStateFromTask(task),
		"runtime_state":    safeRuntimeState(task),
		"evidence_summary": safeEvidenceSummary(task, nil),
		"created_at":       task.CreatedAt,
	}
	return resp
}

func safeMCPRunDetail(task *coordinator.TaskRecord) fiber.Map {
	resp := safeMCPRunSummary(task)
	resp["policy"] = policyStateFromTask(task)
	resp["runtime"] = safeRuntimeState(task)
	resp["recovery"] = buildTaskRecoveryResponse(task)
	resp["proof"] = safeProofState(task.Proof)
	resp["safe_execution_summary"] = safeExecutionSummary(task)
	if inputSummary := safeInputSummaryRaw(task.TaskDefinition); inputSummary != nil {
		resp["input_summary"] = inputSummary
	}
	return resp
}

func safeMCPRunEvidence(task *coordinator.TaskRecord, steps []coordinator.WalEntry) fiber.Map {
	resp := safeEvidenceSummary(task, steps)
	if task != nil && len(task.ExecutionReceipt) > 0 {
		if receipt := buildTaskReceiptResponse(task.ExecutionReceipt); receipt != nil {
			resp["receipt_hash"] = firstNonEmptyString(stringFromAny(receipt["hash"]), stringFromAny(receipt["receipt_hash"]))
			resp["receipt_signed"] = receipt["signed"]
		}
	}
	return resp
}

func safeEvidenceSummary(task *coordinator.TaskRecord, steps []coordinator.WalEntry) fiber.Map {
	resp := fiber.Map{
		"proof_status":    safeProofStatus(task),
		"safe_step_count": len(steps),
	}
	digests := []fiber.Map{}
	for _, step := range steps {
		item := fiber.Map{"step_index": step.StepIndex, "input_digest": step.InputDigest}
		if step.OutputDigest != nil {
			item["output_digest"] = *step.OutputDigest
		}
		digests = append(digests, item)
	}
	if len(digests) > 0 {
		resp["digests"] = digests
	}
	if task != nil && task.Proof != nil {
		resp["proof"] = safeProofState(task.Proof)
	}
	return resp
}

func safeProofState(proof *coordinator.TaskProofState) fiber.Map {
	if proof == nil {
		return fiber.Map{"status": "unavailable"}
	}
	resp := fiber.Map{"status": proof.Status}
	if proof.ExecutionID != "" {
		resp["execution_id"] = proof.ExecutionID
	}
	if proof.Verified != nil {
		resp["verified"] = *proof.Verified
	}
	if proof.HashValid != nil {
		resp["hash_valid"] = *proof.HashValid
	}
	if proof.SignatureMatches != nil {
		resp["signature_matches"] = *proof.SignatureMatches
	}
	if proof.ChainLinkValid != nil {
		resp["chain_link_valid"] = *proof.ChainLinkValid
	}
	if proof.VerificationReason != "" {
		resp["verification_reason"] = proof.VerificationReason
	}
	return resp
}

func safeProofStatus(task *coordinator.TaskRecord) string {
	if task == nil || task.Proof == nil || task.Proof.Status == "" {
		return "unavailable"
	}
	return task.Proof.Status
}

func actionInfoFromTask(task *coordinator.TaskRecord) fiber.Map {
	info := fiber.Map{}
	var def struct {
		Graph struct {
			Nodes []struct {
				Metadata map[string]interface{} `json:"metadata"`
			} `json:"nodes"`
		} `json:"graph"`
	}
	if task != nil && json.Unmarshal(task.TaskDefinition, &def) == nil && len(def.Graph.Nodes) > 0 {
		meta := def.Graph.Nodes[0].Metadata
		if id := stringFromMap(meta, "action_definition_id"); id != "" {
			info["action_id"] = id
		}
		if name := firstNonEmptyString(stringFromMap(meta, "action_name"), stringFromMap(meta, "action")); name != "" {
			info["name"] = name
		}
		if target := stringFromMap(meta, "target_type"); target != "" {
			info["target_type"] = target
		}
	}
	return info
}

func policyStateFromTask(task *coordinator.TaskRecord) fiber.Map {
	info := fiber.Map{"status": "unknown"}
	var def struct {
		Graph struct {
			Nodes []struct {
				Metadata map[string]interface{} `json:"metadata"`
			} `json:"nodes"`
		} `json:"graph"`
	}
	if task != nil && json.Unmarshal(task.TaskDefinition, &def) == nil && len(def.Graph.Nodes) > 0 {
		meta := def.Graph.Nodes[0].Metadata
		if preset := stringFromMap(meta, "policy_preset"); preset != "" {
			info["preset"] = preset
			info["status"] = "configured"
		}
		if replayClass := stringFromMap(meta, "replay_class"); replayClass != "" {
			info["replay_class"] = replayClass
		}
		if approval, ok := meta["approval_required"].(bool); ok {
			info["approval_required"] = approval
		}
	}
	return info
}

func safeRuntimeState(task *coordinator.TaskRecord) fiber.Map {
	resp := fiber.Map{"status": "unassigned"}
	if task == nil {
		return resp
	}
	if task.RuntimeID != nil && *task.RuntimeID != "" {
		resp["runtime_id"] = *task.RuntimeID
		resp["status"] = "assigned"
	}
	if task.ExecutedTarget != nil && *task.ExecutedTarget != "" {
		resp["executed_target"] = *task.ExecutedTarget
	}
	return resp
}

func safeExecutionSummary(task *coordinator.TaskRecord) fiber.Map {
	resp := fiber.Map{"status": string(task.Status)}
	if task.FailureReason != nil && *task.FailureReason != "" {
		resp["failure_reason"] = *task.FailureReason
	}
	if task.CompletedAt != nil {
		resp["completed_at"] = task.CompletedAt
	}
	if task.DispatchedAt != nil {
		resp["dispatched_at"] = task.DispatchedAt
	}
	return resp
}

func appendProofReadReconciliation(tc *coordinator.TaskCoordinator, task *coordinator.TaskRecord, tenantID string) {
	if task != nil && coordinator.TaskProofNeedsReadReconciliation(task.Proof, time.Now().UTC()) {
		if proof, err := tc.Store().SyncTaskProofState(task.TaskID, tenantID); err == nil {
			task.Proof = proof
		}
	}
}

func safeJSONList(raw []byte) interface{} {
	if len(raw) == 0 {
		return []interface{}{}
	}
	var out interface{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return []interface{}{}
	}
	if out == nil {
		return []interface{}{}
	}
	return out
}

func mcpToolResult(result interface{}) fiber.Map {
	raw, _ := json.Marshal(result)
	return fiber.Map{
		"content":           []fiber.Map{{"type": "text", "text": string(raw)}},
		"structuredContent": result,
	}
}

func mcpToolDefinitions() []fiber.Map {
	names := []string{"list_actions", "get_action", "call_action", "list_runs", "get_run", "get_run_evidence", "list_runtimes"}
	tools := make([]fiber.Map, 0, len(names))
	for _, name := range names {
		tools = append(tools, fiber.Map{
			"name":        name,
			"description": mcpToolDescription(name),
			"inputSchema": fiber.Map{"type": "object"},
		})
	}
	return tools
}

func mcpToolDescription(name string) string {
	switch name {
	case "list_actions":
		return "List safe actions available to the authenticated tenant."
	case "get_action":
		return "Get one safe action definition."
	case "call_action":
		return "Call an Igris action through the existing action run path."
	case "list_runs":
		return "List recent tenant-scoped runs."
	case "get_run":
		return "Get one safe run summary."
	case "get_run_evidence":
		return "Get audit-supporting safe evidence summary."
	case "list_runtimes":
		return "List safe runtime status."
	default:
		return name
	}
}

type mcpTypedError struct {
	kind string
	msg  string
}

func (e mcpTypedError) Error() string { return e.msg }

func errValidation(msg string) error   { return mcpTypedError{kind: "validation_error", msg: msg} }
func errNotFound(msg string) error     { return mcpTypedError{kind: "not_found", msg: msg} }
func errBackend(msg string) error      { return mcpTypedError{kind: "backend_unavailable", msg: msg} }
func errPolicyDenied(msg string) error { return mcpTypedError{kind: "policy_denied", msg: msg} }
func errRuntimeUnavailable(msg string) error {
	return mcpTypedError{kind: "runtime_unavailable", msg: msg}
}

func statusForActionLoadErr(err error) int {
	if err == nil {
		return http.StatusOK
	}
	if err == sql.ErrNoRows {
		return http.StatusNotFound
	}
	return http.StatusServiceUnavailable
}

func errForActionLoadErr(err error) error {
	if err == nil {
		return nil
	}
	if err == sql.ErrNoRows {
		return errNotFound("action not found")
	}
	return errBackend("load action failed")
}

func mcpErrorCode(err error) (int, string) {
	var typed mcpTypedError
	if errors.As(err, &typed) {
		switch typed.kind {
		case "validation_error":
			return -32602, typed.kind
		case "not_found":
			return -32004, typed.kind
		case "policy_denied":
			return -32013, typed.kind
		case "runtime_unavailable":
			return -32014, typed.kind
		case "backend_unavailable":
			return -32015, typed.kind
		}
	}
	return -32603, "backend_unavailable"
}

func mcpError(id interface{}, code int, message, detail string) fiber.Map {
	return fiber.Map{
		"jsonrpc": "2.0",
		"id":      id,
		"error": fiber.Map{
			"code":    code,
			"message": message,
			"data":    fiber.Map{"detail": detail},
		},
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func stringFromAny(value interface{}) string {
	if value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return s
	}
	return fmt.Sprint(value)
}
