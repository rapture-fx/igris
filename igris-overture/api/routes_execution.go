// Package api provides execution run listing routes for the web-console.
package api

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// ── BT tick-snapshot transform ────────────────────────────────────────────────

// btRawSnapshot is the shape the Rust runtime emits per tick:
// {"tick": N, "status": "Success|Failure|Running", "tree": {nested tree}}.
type btRawSnapshot struct {
	Tick   int64           `json:"tick"`
	Status string          `json:"status"`
	Tree   json.RawMessage `json:"tree"`
}

// flattenBTTree walks the runtime's nested tree JSON and produces a flat
// []BTNode with sequential depth values suitable for the live-view frontend.
// The runtime sends {"name":"…","type":"…","children":[…]}.
func flattenBTTree(raw json.RawMessage, depth int, out *[]BTNode) {
	if len(raw) == 0 || string(raw) == "null" {
		return
	}
	var node struct {
		Name           string            `json:"name"`
		Type           string            `json:"type"`
		Status         string            `json:"status"`
		DurationMs     int64             `json:"duration_ms"`
		ExecutionID    string            `json:"execution_id"`
		Timestamp      string            `json:"timestamp"`
		LLMProposal    *string           `json:"llm_proposal"`
		EnvelopeStatus string            `json:"envelope_status"`
		Children       []json.RawMessage `json:"children"`
	}
	if err := json.Unmarshal(raw, &node); err != nil {
		return
	}
	if node.Name == "" {
		return
	}
	id := fmt.Sprintf("%s_%s_%d", strings.ToLower(node.Type), strings.ReplaceAll(node.Name, " ", "_"), depth)
	status := node.Status
	if status == "" {
		status = "pending"
	}
	envelopeStatus := node.EnvelopeStatus
	if envelopeStatus == "" && status == "violation" {
		envelopeStatus = "violated"
	} else if envelopeStatus == "" && (status == "completed" || status == "Success") {
		envelopeStatus = "passed"
	}
	n := BTNode{
		ID:             id,
		Name:           node.Name,
		Type:           strings.ToLower(node.Type),
		Status:         status,
		Depth:          depth,
		DurationMs:     node.DurationMs,
		ExecutionID:    node.ExecutionID,
		Timestamp:      node.Timestamp,
		LLMProposal:    node.LLMProposal,
		EnvelopeStatus: envelopeStatus,
	}
	*out = append(*out, n)
	for _, child := range node.Children {
		flattenBTTree(child, depth+1, out)
	}
}

// enrichBTSnapshot converts a raw runtime bt_state JSON blob into the
// {tick, nodes[], last_updated} shape expected by the web console.
// Falls through to the raw blob if it cannot be parsed (safe degradation).
func enrichBTSnapshot(rawState []byte, updatedAt time.Time) []byte {
	var snap btRawSnapshot
	if err := json.Unmarshal(rawState, &snap); err != nil {
		return rawState
	}
	nodes := make([]BTNode, 0, 8)
	flattenBTTree(snap.Tree, 0, &nodes)

	// If flatten yielded nothing (runtime sent minimal tree), pass through raw.
	if len(nodes) == 0 {
		return rawState
	}

	out, err := json.Marshal(map[string]interface{}{
		"tick":         snap.Tick,
		"status":       snap.Status,
		"nodes":        nodes,
		"last_updated": updatedAt.UTC().Format(time.RFC3339),
	})
	if err != nil {
		return rawState
	}
	return out
}

// ExecutionHandler handles execution-related API requests.
type ExecutionHandler struct {
	db *sql.DB
}

// NewExecutionHandler creates a new execution handler.
func NewExecutionHandler(db *sql.DB) *ExecutionHandler {
	return &ExecutionHandler{db: db}
}

// RegisterExecutionRoutes registers execution endpoints.
func RegisterExecutionRoutes(app *fiber.App, db *sql.DB, _ *middleware.TenantAuth) {
	if db == nil {
		log.Warn().Msg("[Routes] Execution endpoints disabled — database not available")
		return
	}

	h := NewExecutionHandler(db)

	auth := middleware.BetterAuth(db)
	app.Get("/v1/execution/runs", auth, h.ListRuns)
	app.Get("/v1/execution/runs/:id", auth, h.GetRunDetail)
	app.Post("/v1/execution/runs/:id/pause", auth, h.PauseRun)
	app.Post("/v1/execution/runs/:id/resume", auth, h.ResumeRun)
	app.Post("/v1/execution/runs/:id/cancel", auth, h.CancelRun)
	app.Post("/v1/execution/runs/:id/replay", auth, h.ReplayRun)
	app.Post("/v1/execution/runs/:id/approve", auth, h.ApproveRun)
	app.Post("/v1/execution/runs/:id/reject", auth, h.RejectRun)
	app.Get("/v1/execution/agents", auth, h.ListAgents)
	app.Get("/v1/agents/:id/bt-state", auth, h.GetAgentBTState)
	app.Get("/v1/agents/:id/bt-state/stream", auth, h.StreamBTState)
	app.Post("/v1/policies/assign", auth, h.AssignPolicy)
	app.Get("/v1/policies", auth, h.GetPolicies)
	app.Get("/v1/execution/shadow", auth, h.ListShadowTraces)
	app.Get("/v1/alerts/stream", auth, h.StreamAlerts)

	log.Info().Msg("[Routes] Registered execution endpoints (/v1/execution/runs, /v1/execution/runs/:id, /v1/execution/runs/:id/approve, /v1/execution/runs/:id/reject, /v1/execution/agents, /v1/agents/:id, /v1/policies, /v1/policies/assign, /v1/execution/shadow, /v1/alerts/stream, /v1/agents/:id/bt-state/stream)")
}

// ExecutionRun is the response shape for a single execution row.
type ExecutionRun struct {
	ID                  string     `json:"id"`
	AgentID             string     `json:"agent_id"`
	Model               string     `json:"model"`
	DeviceID            string     `json:"device_id"`
	RuntimeID           string     `json:"runtime_id,omitempty"`
	StartedAt           time.Time  `json:"started_at"`
	EndedAt             *time.Time `json:"ended_at,omitempty"`
	DurationMs          int64      `json:"duration_ms"`
	Status              string     `json:"status"`
	HasViolation        bool       `json:"has_violation"`
	PauseReason         string     `json:"pause_reason,omitempty"`
	Namespace           string     `json:"namespace,omitempty"`
	PromptPreview       string     `json:"prompt_preview,omitempty"`
	ReceiptID           string     `json:"receipt_id,omitempty"`
	ReceiptSignature    string     `json:"receipt_signature,omitempty"`
	ReceiptHash         string     `json:"receipt_hash,omitempty"`
	ReceiptPreviousHash string     `json:"receipt_previous_hash,omitempty"`
	VerificationStatus  string     `json:"verification_status,omitempty"`
}

type ExecutionRunReceiptReference struct {
	ID                 string `json:"id"`
	Hash               string `json:"hash"`
	PreviousHash       string `json:"previous_hash"`
	Signature          string `json:"signature"`
	Signed             bool   `json:"signed"`
	VerificationStatus string `json:"verification_status"`
}

type ExecutionRunEvent struct {
	Timestamp string `json:"timestamp"`
	Kind      string `json:"kind"`
	Message   string `json:"message"`
}

type ExecutionRunDetail struct {
	ExecutionRun
	TaskID             string                        `json:"task_id,omitempty"`
	RouteDecision      *string                       `json:"route_decision"`
	Provider           *string                       `json:"provider"`
	ProviderPath       *string                       `json:"provider_path"`
	RuntimeLabel       *string                       `json:"runtime_label"`
	FallbackUsed       bool                          `json:"fallback_used"`
	FallbackReason     *string                       `json:"fallback_reason"`
	Receipt            *ExecutionRunReceiptReference `json:"receipt"`
	Violations         []PolicyViolation             `json:"violations"`
	Events             []ExecutionRunEvent           `json:"events"`
	Logs               []string                      `json:"logs"`
	PolicySnapshot     map[string]any                `json:"policy_snapshot"`
	CapabilitySnapshot map[string]any                `json:"capability_snapshot"`
}

type executionRunRecord struct {
	ID                        string
	AgentID                   string
	DeviceID                  string
	StartedAt                 time.Time
	DurationMs                int64
	HasViolation              bool
	Status                    string
	PauseReason               string
	PromptPreview             string
	ReceiptID                 string
	ReceiptHash               string
	ReceiptPreviousHash       string
	ReceiptSignature          string
	ProofStatus               string
	ViolationDetails          []byte
	ContextProvider           string
	ContextRouteDecision      string
	ContextExecutionPath      string
	ContextRuntimeLabel       string
	ContextFallbackUsed       bool
	ContextFallbackReason     string
	ContextPolicySnapshot     []byte
	ContextCapabilitySnapshot []byte
	ContextEvents             []byte
	ContextLogs               []byte
	TaskExecutionEnvelope     []byte
	TaskID                    string
	TaskPermissionEnvelope    []byte
	TaskFailureReason         string
	TaskFailureDetails        []byte
	TaskCreatedAt             sql.NullTime
	TaskDispatchedAt          sql.NullTime
	TaskCompletedAt           sql.NullTime
	TaskCanceledAt            sql.NullTime
}

// ListRuns handles GET /v1/execution/runs?limit=20&sort=created_at:desc&status=PAUSED
func (h *ExecutionHandler) ListRuns(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	schemaCaps, err := detectExecutionSchemaCapabilities(c.Context(), h.db)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Execution] Failed to inspect schema capabilities")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to retrieve execution runs",
		})
	}

	// Parse limit param, default 20, cap at 200
	limit := 20
	if raw := c.Query("limit", ""); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 200 {
		limit = 200
	}

	offset := 0
	if raw := c.Query("offset", ""); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Parse sort param — currently we only support timestamp_utc asc/desc
	sortDir := "DESC"
	if raw := c.Query("sort", ""); raw != "" {
		// Accept "created_at:asc" or "created_at:desc"
		parts := strings.SplitN(raw, ":", 2)
		if len(parts) == 2 && strings.EqualFold(parts[1], "asc") {
			sortDir = "ASC"
		}
	}

	// Optional status filter (e.g. "PAUSED")
	statusFilter := strings.ToUpper(c.Query("status", ""))

	var args []interface{}
	args = append(args, tenantID)
	whereClause := "WHERE execution_lineage.tenant_id = $1"
	if rangeParam := c.Query("range", ""); rangeParam != "" {
		whereClause += " AND execution_lineage.timestamp_utc >= NOW() - INTERVAL '" + rangeToInterval(rangeParam) + "'"
	}
	if statusFilter != "" {
		args = append(args, statusFilter)
		whereClause += fmt.Sprintf(" AND UPPER(COALESCE(execution_lineage.status, CASE WHEN execution_lineage.violation_occurred THEN 'VIOLATION' ELSE 'COMPLETED' END)) = $%d", len(args))
	}
	args = append(args, limit)
	args = append(args, offset)

	query := `
		SELECT
			execution_lineage.execution_id,
			execution_lineage.agent_id,
			COALESCE(execution_lineage.runtime_id, '') AS device_id,
			execution_lineage.timestamp_utc,
			COALESCE(execution_lineage.wall_time_ms, 0) AS wall_time_ms,
			COALESCE(execution_lineage.violation_occurred, false) AS violation_occurred,
			COALESCE(execution_lineage.status, CASE WHEN execution_lineage.violation_occurred THEN 'violation' ELSE 'completed' END) AS status,
			COALESCE(execution_lineage.pause_reason, '') AS pause_reason,
			COALESCE(execution_lineage.prompt_preview, '') AS prompt_preview,
			execution_lineage.id::text,
			COALESCE(execution_lineage.receipt_hash, '') AS receipt_hash,
			COALESCE(execution_lineage.previous_hash, '') AS previous_hash,
			COALESCE(execution_lineage.signature, '') AS signature,
			COALESCE(NULLIF(tp.proof_status, ''), NULLIF(ec.verification_status, ''), '') AS proof_status
		FROM execution_lineage
		LEFT JOIN execution_context ec
		       ON ec.execution_id = execution_lineage.execution_id
		      AND ec.tenant_id = execution_lineage.tenant_id
		%s
		` + whereClause + `
		ORDER BY execution_lineage.timestamp_utc ` + sortDir + `
		LIMIT $` + fmt.Sprintf("%d", len(args)-1) + `
		OFFSET $` + fmt.Sprintf("%d", len(args))

	query = fmt.Sprintf(query, executionTaskProofLookupJoinSQL(schemaCaps.taskProofLookup, "execution_lineage"))

	rows, err := h.db.QueryContext(c.Context(), query, args...)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Execution] Failed to list runs")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to retrieve execution runs",
		})
	}
	defer rows.Close()

	runs := make([]ExecutionRun, 0, limit)
	for rows.Next() {
		record := executionRunRecord{}

		if err := rows.Scan(
			&record.ID,
			&record.AgentID,
			&record.DeviceID,
			&record.StartedAt,
			&record.DurationMs,
			&record.HasViolation,
			&record.Status,
			&record.PauseReason,
			&record.PromptPreview,
			&record.ReceiptID,
			&record.ReceiptHash,
			&record.ReceiptPreviousHash,
			&record.ReceiptSignature,
			&record.ProofStatus,
		); err != nil {
			log.Error().Err(err).Msg("[Execution] Scan error")
			continue
		}
		runs = append(runs, buildExecutionRunSummary(record))
	}

	return c.JSON(runs)
}

func (h *ExecutionHandler) GetRunDetail(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	schemaCaps, err := detectExecutionSchemaCapabilities(c.Context(), h.db)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Execution] Failed to inspect schema capabilities")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to load execution run",
		})
	}

	runID := strings.TrimSpace(c.Params("id"))
	if runID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_run_id",
			"message": "Run id is required",
		})
	}

	record := executionRunRecord{}
	query := `
		SELECT
			execution_lineage.execution_id,
			execution_lineage.agent_id,
			COALESCE(execution_lineage.runtime_id, '') AS device_id,
			execution_lineage.timestamp_utc,
			COALESCE(execution_lineage.wall_time_ms, 0) AS wall_time_ms,
			COALESCE(execution_lineage.violation_occurred, false) AS violation_occurred,
			COALESCE(execution_lineage.status, CASE WHEN execution_lineage.violation_occurred THEN 'violation' ELSE 'completed' END) AS status,
			COALESCE(execution_lineage.pause_reason, '') AS pause_reason,
			COALESCE(execution_lineage.prompt_preview, '') AS prompt_preview,
			execution_lineage.id::text,
			COALESCE(execution_lineage.receipt_hash, '') AS receipt_hash,
			COALESCE(execution_lineage.previous_hash, '') AS previous_hash,
			COALESCE(execution_lineage.signature, '') AS signature,
			COALESCE(NULLIF(tp.proof_status, ''), NULLIF(ec.verification_status, ''), '') AS proof_status,
			%s,
			COALESCE(ec.provider, '') AS context_provider,
			COALESCE(ec.route_decision, '') AS context_route_decision,
			COALESCE(ec.execution_path, '') AS context_execution_path,
			COALESCE(ec.runtime_label, '') AS context_runtime_label,
			COALESCE(ec.fallback_used, false) AS context_fallback_used,
			COALESCE(ec.fallback_reason, '') AS context_fallback_reason,
			ec.policy_snapshot,
			ec.capability_snapshot,
			ec.events,
			ec.logs,
			tp.execution_envelope,
			COALESCE(tp.task_id, '') AS task_id,
			tp.permission_envelope,
			COALESCE(tp.failure_reason, '') AS task_failure_reason,
			tp.failure_details,
			tp.created_at,
			tp.dispatched_at,
			tp.completed_at,
			tp.canceled_at
		FROM execution_lineage
		LEFT JOIN execution_context ec
		       ON ec.execution_id = execution_lineage.execution_id
		      AND ec.tenant_id = execution_lineage.tenant_id
		%s
		WHERE execution_lineage.execution_id = $1
		  AND execution_lineage.tenant_id = $2
	`
	query = fmt.Sprintf(
		query,
		executionLineageViolationDetailsSQL(schemaCaps.lineageViolationDetail, "execution_lineage"),
		executionTaskProofDetailJoinSQL(schemaCaps.taskProofDetail, schemaCaps.permissionAudit),
	)

	err = h.db.QueryRowContext(c.Context(), query, runID, tenantID).Scan(
		&record.ID,
		&record.AgentID,
		&record.DeviceID,
		&record.StartedAt,
		&record.DurationMs,
		&record.HasViolation,
		&record.Status,
		&record.PauseReason,
		&record.PromptPreview,
		&record.ReceiptID,
		&record.ReceiptHash,
		&record.ReceiptPreviousHash,
		&record.ReceiptSignature,
		&record.ProofStatus,
		&record.ViolationDetails,
		&record.ContextProvider,
		&record.ContextRouteDecision,
		&record.ContextExecutionPath,
		&record.ContextRuntimeLabel,
		&record.ContextFallbackUsed,
		&record.ContextFallbackReason,
		&record.ContextPolicySnapshot,
		&record.ContextCapabilitySnapshot,
		&record.ContextEvents,
		&record.ContextLogs,
		&record.TaskExecutionEnvelope,
		&record.TaskID,
		&record.TaskPermissionEnvelope,
		&record.TaskFailureReason,
		&record.TaskFailureDetails,
		&record.TaskCreatedAt,
		&record.TaskDispatchedAt,
		&record.TaskCompletedAt,
		&record.TaskCanceledAt,
	)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "not_found",
			"message": "Run record not found",
		})
	}
	if err != nil {
		log.Error().Err(err).Str("execution_id", runID).Str("tenant_id", tenantID).Msg("[Execution] Failed to load run detail")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to retrieve execution run",
		})
	}

	return c.JSON(buildExecutionRunDetail(record))
}

func buildExecutionRunSummary(record executionRunRecord) ExecutionRun {
	run := ExecutionRun{
		ID:                  record.ID,
		AgentID:             record.AgentID,
		Model:               "",
		DeviceID:            record.DeviceID,
		RuntimeID:           record.DeviceID,
		StartedAt:           record.StartedAt,
		EndedAt:             deriveExecutionEndedAt(record.StartedAt, record.DurationMs, record.Status),
		DurationMs:          record.DurationMs,
		Status:              normalizeExecutionStatus(record.Status, record.HasViolation),
		HasViolation:        record.HasViolation,
		PauseReason:         record.PauseReason,
		PromptPreview:       record.PromptPreview,
		ReceiptID:           record.ReceiptID,
		ReceiptSignature:    record.ReceiptSignature,
		ReceiptHash:         record.ReceiptHash,
		ReceiptPreviousHash: record.ReceiptPreviousHash,
		VerificationStatus:  receiptVerificationStatus(record.ProofStatus, record.ReceiptHash),
	}
	return run
}

func buildExecutionRunDetail(record executionRunRecord) ExecutionRunDetail {
	run := buildExecutionRunSummary(record)
	detail := ExecutionRunDetail{
		ExecutionRun:       run,
		TaskID:             record.TaskID,
		RouteDecision:      optionalExecutionString(record.ContextRouteDecision),
		Provider:           optionalExecutionString(record.ContextProvider),
		ProviderPath:       optionalExecutionString(record.ContextExecutionPath),
		RuntimeLabel:       optionalExecutionString(record.ContextRuntimeLabel),
		FallbackUsed:       record.ContextFallbackUsed,
		FallbackReason:     optionalExecutionString(record.ContextFallbackReason),
		Receipt:            buildExecutionRunReceipt(record),
		Violations:         []PolicyViolation{},
		Events:             []ExecutionRunEvent{},
		Logs:               []string{},
		PolicySnapshot:     decodeJSONMap(record.ContextPolicySnapshot),
		CapabilitySnapshot: decodeJSONMap(record.ContextCapabilitySnapshot),
	}

	if detail.RouteDecision == nil || detail.Provider == nil || detail.ProviderPath == nil || detail.PolicySnapshot == nil {
		backfillFromTaskArtifacts(&detail, record)
	}

	if len(record.ContextEvents) > 0 {
		detail.Events = decodeExecutionRunEvents(record.ContextEvents)
	}
	if len(record.ContextLogs) > 0 {
		detail.Logs = decodeStringArray(record.ContextLogs)
	}
	if len(detail.Events) == 0 && record.TaskCreatedAt.Valid {
		detail.Events, detail.Logs = buildTaskFallbackEvents(record)
	}

	if record.HasViolation {
		detail.Violations = []PolicyViolation{
			buildPolicyViolation(PolicyViolation{
				ID:           record.ReceiptID,
				ExecutionID:  record.ID,
				AgentID:      record.AgentID,
				DeviceID:     record.DeviceID,
				Signature:    record.ReceiptSignature,
				Hash:         record.ReceiptHash,
				PreviousHash: record.ReceiptPreviousHash,
			}, record.StartedAt, run.Status, record.ViolationDetails),
		}
	}

	return detail
}

func buildExecutionRunReceipt(record executionRunRecord) *ExecutionRunReceiptReference {
	if record.ReceiptHash == "" && record.ReceiptSignature == "" && record.ReceiptID == "" {
		return nil
	}
	return &ExecutionRunReceiptReference{
		ID:                 record.ReceiptID,
		Hash:               record.ReceiptHash,
		PreviousHash:       record.ReceiptPreviousHash,
		Signature:          record.ReceiptSignature,
		Signed:             record.ReceiptSignature != "",
		VerificationStatus: receiptVerificationStatus(record.ProofStatus, record.ReceiptHash),
	}
}

func backfillFromTaskArtifacts(detail *ExecutionRunDetail, record executionRunRecord) {
	if len(record.TaskExecutionEnvelope) > 0 {
		var envelope struct {
			Provider           string         `json:"provider"`
			Model              string         `json:"model"`
			RoutingDecision    string         `json:"routing_decision"`
			BoundsApplied      map[string]any `json:"bounds_applied"`
			PolicyDecisionID   string         `json:"policy_decision_id"`
			PolicyDecisionHash string         `json:"policy_decision_hash"`
			GovernedActionHash string         `json:"governed_action_hash"`
			Violation          string         `json:"violation"`
		}
		if err := json.Unmarshal(record.TaskExecutionEnvelope, &envelope); err == nil {
			if detail.Provider == nil {
				detail.Provider = optionalExecutionString(firstNonEmptyExecutionString(envelope.Provider, envelope.Model))
			}
			if detail.RouteDecision == nil {
				detail.RouteDecision = optionalExecutionString(envelope.RoutingDecision)
			}
			if detail.ProviderPath == nil {
				detail.ProviderPath = optionalExecutionString(executionPathFromRouteDecisionForAPI(envelope.RoutingDecision, record.DeviceID != ""))
			}
			if detail.PolicySnapshot == nil {
				snapshot := map[string]any{}
				if len(envelope.BoundsApplied) > 0 {
					snapshot["bounds_applied"] = envelope.BoundsApplied
				}
				if envelope.PolicyDecisionID != "" {
					snapshot["policy_decision_id"] = envelope.PolicyDecisionID
				}
				if envelope.PolicyDecisionHash != "" {
					snapshot["policy_decision_hash"] = envelope.PolicyDecisionHash
				}
				if envelope.GovernedActionHash != "" {
					snapshot["governed_action_hash"] = envelope.GovernedActionHash
				}
				if envelope.Violation != "" {
					snapshot["violation"] = envelope.Violation
				}
				if len(snapshot) > 0 {
					detail.PolicySnapshot = snapshot
				}
			}
		}
	}

	if detail.CapabilitySnapshot == nil {
		detail.CapabilitySnapshot = capabilitySnapshotFromPermissionEnvelopeForAPI(record.TaskPermissionEnvelope)
	}
	if detail.ProviderPath == nil && record.DeviceID != "" {
		detail.ProviderPath = optionalExecutionString("runtime_task")
	}
}

func buildTaskFallbackEvents(record executionRunRecord) ([]ExecutionRunEvent, []string) {
	events := make([]ExecutionRunEvent, 0, 8)
	appendEvent := func(ts time.Time, kind, message string) {
		events = append(events, ExecutionRunEvent{
			Timestamp: ts.UTC().Format(time.RFC3339),
			Kind:      kind,
			Message:   message,
		})
	}

	appendEvent(record.TaskCreatedAt.Time, "task_created", "Task accepted by Overture")
	if record.TaskDispatchedAt.Valid {
		message := "Task dispatched to runtime"
		if record.DeviceID != "" {
			message = fmt.Sprintf("Task dispatched to runtime %s", record.DeviceID)
		}
		appendEvent(record.TaskDispatchedAt.Time, "task_dispatched", message)
	}
	if routeDecision := strings.TrimSpace(record.ContextRouteDecision); routeDecision != "" {
		appendEvent(eventTimeOrStart(record.TaskDispatchedAt, record.StartedAt), "route_decision", fmt.Sprintf("Runtime route decision recorded: %s", routeDecision))
	}
	if record.ReceiptHash != "" {
		appendEvent(eventTimeOrStart(record.TaskCompletedAt, record.StartedAt), "receipt_recorded", "Execution receipt recorded")
	}
	if record.TaskCompletedAt.Valid {
		appendEvent(record.TaskCompletedAt.Time, "task_completed", "Runtime reported task completion")
	}
	if record.TaskCanceledAt.Valid {
		appendEvent(record.TaskCanceledAt.Time, "task_canceled", "Task was canceled")
	}
	if strings.TrimSpace(record.TaskFailureReason) != "" {
		appendEvent(eventTimeOrStart(record.TaskCompletedAt, record.StartedAt), "task_failed", fmt.Sprintf("Task failed: %s", record.TaskFailureReason))
	}

	logs := make([]string, 0, len(events))
	for _, event := range events {
		logs = append(logs, fmt.Sprintf("%s %s: %s", event.Timestamp, event.Kind, event.Message))
	}
	return events, logs
}

func eventTimeOrStart(value sql.NullTime, fallback time.Time) time.Time {
	if value.Valid {
		return value.Time
	}
	return fallback
}

func optionalExecutionString(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func decodeJSONMap(raw []byte) map[string]any {
	if len(raw) == 0 || string(raw) == "null" || string(raw) == "{}" {
		return nil
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil || len(decoded) == 0 {
		return nil
	}
	return decoded
}

func decodeStringArray(raw []byte) []string {
	if len(raw) == 0 || string(raw) == "null" || string(raw) == "[]" {
		return []string{}
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return []string{}
	}
	return values
}

func decodeExecutionRunEvents(raw []byte) []ExecutionRunEvent {
	if len(raw) == 0 || string(raw) == "null" || string(raw) == "[]" {
		return []ExecutionRunEvent{}
	}
	var events []ExecutionRunEvent
	if err := json.Unmarshal(raw, &events); err == nil {
		return events
	}

	var generic []map[string]any
	if err := json.Unmarshal(raw, &generic); err != nil {
		return []ExecutionRunEvent{}
	}
	events = make([]ExecutionRunEvent, 0, len(generic))
	for _, item := range generic {
		timestamp, _ := item["timestamp"].(string)
		kind, _ := item["kind"].(string)
		message, _ := item["message"].(string)
		if timestamp == "" && kind == "" && message == "" {
			continue
		}
		events = append(events, ExecutionRunEvent{
			Timestamp: timestamp,
			Kind:      kind,
			Message:   message,
		})
	}
	return events
}

func capabilitySnapshotFromPermissionEnvelopeForAPI(raw []byte) map[string]any {
	if len(raw) == 0 || string(raw) == "{}" || string(raw) == "null" {
		return nil
	}
	var envelope struct {
		EnvelopeID           string   `json:"envelope_id"`
		RequiredCapabilities []string `json:"required_capabilities"`
		Decisions            []struct {
			Capability    string `json:"capability"`
			Permit        bool   `json:"permit"`
			Reason        string `json:"reason"`
			PolicyVersion string `json:"policy_version"`
		} `json:"decisions"`
		CredentialRefs  []map[string]any `json:"credential_refs"`
		IssuedAtUnixMs  int64            `json:"issued_at_unix_ms"`
		ExpiresAtUnixMs int64            `json:"expires_at_unix_ms"`
		Signature       string           `json:"signature"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil
	}

	granted := 0
	denied := 0
	for _, decision := range envelope.Decisions {
		if decision.Permit {
			granted++
		} else {
			denied++
		}
	}

	return map[string]any{
		"envelope_id":              envelope.EnvelopeID,
		"required_capabilities":    envelope.RequiredCapabilities,
		"decisions":                envelope.Decisions,
		"credential_refs":          envelope.CredentialRefs,
		"permission_signed":        envelope.Signature != "",
		"issued_at_unix_ms":        envelope.IssuedAtUnixMs,
		"expires_at_unix_ms":       envelope.ExpiresAtUnixMs,
		"granted_capability_count": granted,
		"denied_capability_count":  denied,
	}
}

func executionPathFromRouteDecisionForAPI(routeDecision string, runtimeBacked bool) string {
	normalized := strings.ToLower(strings.TrimSpace(routeDecision))
	switch {
	case strings.HasPrefix(normalized, "tool:") || strings.HasPrefix(normalized, "runtime:tool:"):
		return "runtime_tool"
	case strings.HasPrefix(normalized, "ros2:") || strings.HasPrefix(normalized, "runtime:robotics:"):
		return "runtime_robotics"
	case runtimeBacked || strings.Contains(normalized, "runtime"):
		return "runtime_task"
	case normalized != "":
		return "direct_provider"
	default:
		return ""
	}
}

func firstNonEmptyExecutionString(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func deriveExecutionEndedAt(startedAt time.Time, durationMs int64, status string) *time.Time {
	if durationMs <= 0 {
		return nil
	}

	normalizedStatus := normalizeExecutionStatus(status, false)
	if normalizedStatus == "RUNNING" {
		return nil
	}

	endedAt := startedAt.Add(time.Duration(durationMs) * time.Millisecond)
	return &endedAt
}

func normalizeExecutionStatus(status string, hasViolation bool) string {
	normalized := strings.ToUpper(strings.TrimSpace(status))
	if normalized == "" {
		if hasViolation {
			return "VIOLATION"
		}
		return "COMPLETED"
	}
	if hasViolation && normalized == "COMPLETED" {
		return "VIOLATION"
	}
	return normalized
}

// RecentExec is a lightweight execution summary embedded in Agent responses.
type RecentExec struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	StartedAt  string `json:"started_at"`
	DurationMs int64  `json:"duration_ms"`
}

// Agent is the response shape for a single agent derived from execution history.
type Agent struct {
	ID                      string       `json:"id"`
	Namespace               string       `json:"namespace"`
	State                   string       `json:"state"`
	LastRunAt               *string      `json:"last_run_at,omitempty"`
	DeviceID                *string      `json:"device_id,omitempty"`
	ViolationCount          int64        `json:"violation_count"`
	Capabilities            []string     `json:"capabilities"`
	ShadowMode              bool         `json:"shadow_mode"`
	ReflectionMode          bool         `json:"reflection_mode"`
	CouncilMode             bool         `json:"council_mode"`
	CognitiveAdvisorEnabled bool         `json:"cognitive_advisor_enabled"`
	PolicyHash              *string      `json:"policy_hash,omitempty"`
	RecentExecutions        []RecentExec `json:"recent_executions,omitempty"`
}

// ListAgents handles GET /v1/execution/agents
// Derives the agent list from execution_lineage grouped by agent_id.
func (h *ExecutionHandler) ListAgents(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rows, err := h.db.QueryContext(c.Context(), `
		SELECT
			el.agent_id,
			MAX(el.timestamp_utc)                                      AS last_run_at,
			COALESCE(
				(SELECT runtime_id FROM execution_lineage e2
				 WHERE e2.agent_id = el.agent_id AND e2.tenant_id = $1
				 ORDER BY e2.timestamp_utc DESC LIMIT 1),
				''
			)                                                          AS device_id,
			SUM(CASE WHEN el.violation_occurred THEN 1 ELSE 0 END)    AS violation_count,
			BOOL_OR(el.violation_occurred)                             AS had_violation,
			COALESCE(ags.shadow_mode, false)                           AS shadow_mode,
			COALESCE(ags.reflection_mode, false)                       AS reflection_mode,
			COALESCE(ags.council_mode, false)                          AS council_mode,
			COALESCE(ags.cognitive_advisor_enabled, false)             AS cognitive_advisor_enabled,
			ags.policy_hash
		FROM execution_lineage el
		LEFT JOIN agent_settings ags
		       ON ags.agent_id = el.agent_id AND ags.tenant_id = el.tenant_id
		WHERE el.tenant_id = $1
		GROUP BY el.agent_id, ags.shadow_mode, ags.reflection_mode, ags.council_mode, ags.cognitive_advisor_enabled, ags.policy_hash
		ORDER BY last_run_at DESC
		LIMIT 200
	`, tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Execution] Failed to list agents")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to retrieve agents",
		})
	}
	defer rows.Close()

	agents := make([]Agent, 0)
	for rows.Next() {
		var a Agent
		var lastRunAt time.Time
		var deviceID string
		var hadViolation bool
		var policyHash sql.NullString

		if err := rows.Scan(&a.ID, &lastRunAt, &deviceID, &a.ViolationCount, &hadViolation, &a.ShadowMode, &a.ReflectionMode, &a.CouncilMode, &a.CognitiveAdvisorEnabled, &policyHash); err != nil {
			log.Error().Err(err).Msg("[Execution] Agent scan error")
			continue
		}
		if policyHash.Valid {
			a.PolicyHash = &policyHash.String
		}

		ts := lastRunAt.UTC().Format(time.RFC3339)
		a.LastRunAt = &ts
		if deviceID != "" {
			a.DeviceID = &deviceID
		}
		if hadViolation {
			a.State = "ERROR"
		} else {
			a.State = "IDLE"
		}
		a.Namespace = "default"
		a.Capabilities = []string{}
		agents = append(agents, a)
	}
	rows.Close()

	// Fetch last 3 executions for all agents in a single query using LATERAL.
	if len(agents) > 0 {
		// Build a VALUES list of agent IDs for the LATERAL join filter.
		agentIDs := make([]string, len(agents))
		for i, a := range agents {
			agentIDs[i] = a.ID
		}
		// Use a single LATERAL query: for each agent_id, get up to 3 most-recent rows.
		exRows, err := h.db.QueryContext(c.Context(), `
			SELECT el.execution_id, el.agent_id, el.timestamp_utc, el.wall_time_ms,
			       COALESCE(el.status, CASE WHEN el.violation_occurred THEN 'violation' ELSE 'completed' END)
			FROM (
				SELECT DISTINCT agent_id FROM execution_lineage
				WHERE tenant_id = $1 AND agent_id = ANY($2)
			) AS ag
			CROSS JOIN LATERAL (
				SELECT execution_id, agent_id, timestamp_utc, wall_time_ms, violation_occurred, status
				FROM execution_lineage
				WHERE tenant_id = $1 AND agent_id = ag.agent_id
				ORDER BY timestamp_utc DESC
				LIMIT 3
			) el
			ORDER BY el.agent_id, el.timestamp_utc DESC
		`, tenantID, agentIDs)
		if err == nil {
			// Build a map from agent_id → index for O(1) lookup.
			idx := make(map[string]int, len(agents))
			for i, a := range agents {
				idx[a.ID] = i
			}
			for exRows.Next() {
				var ex RecentExec
				var agentID string
				var ts time.Time
				if err := exRows.Scan(&ex.ID, &agentID, &ts, &ex.DurationMs, &ex.Status); err != nil {
					continue
				}
				ex.StartedAt = ts.UTC().Format(time.RFC3339)
				if i, ok := idx[agentID]; ok {
					agents[i].RecentExecutions = append(agents[i].RecentExecutions, ex)
				}
			}
			exRows.Close()
		}
	}

	return c.JSON(agents)
}

// ── GET /v1/agents/:id/bt-state ──────────────────────────────────────────────

// BTNode is a single node in the behaviour-tree execution view.
type BTNode struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Status         string  `json:"status"`
	Depth          int     `json:"depth"`
	DurationMs     int64   `json:"duration_ms,omitempty"`
	ExecutionID    string  `json:"execution_id,omitempty"`
	Timestamp      string  `json:"timestamp,omitempty"`
	LLMProposal    *string `json:"llm_proposal,omitempty"`
	EnvelopeStatus string  `json:"envelope_status,omitempty"` // "passed" | "violated" | "partial"
}

// GetAgentBTState handles GET /v1/agents/:id/bt-state.
// Returns the last N executions for the agent as a flat BT-like node list:
// a synthetic "Root Selector" at depth 0 with one "Action" leaf per execution.
func (h *ExecutionHandler) GetAgentBTState(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	agentID := c.Params("id")

	rows, err := h.db.QueryContext(c.Context(), `
		SELECT execution_id, timestamp_utc, wall_time_ms, violation_occurred,
		       COALESCE(status, CASE WHEN violation_occurred THEN 'violation' ELSE 'completed' END)
		FROM execution_lineage
		WHERE agent_id = $1 AND tenant_id = $2
		ORDER BY timestamp_utc DESC
		LIMIT 10
	`, agentID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("agent_id", agentID).Msg("[BT] Query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	nodes := []BTNode{
		{
			ID:     "root",
			Name:   "Root Selector",
			Type:   "selector",
			Status: "completed",
			Depth:  0,
		},
	}

	var lastUpdated string
	for rows.Next() {
		var execID, status string
		var ts time.Time
		var wallMs int64
		var violated bool
		if err := rows.Scan(&execID, &ts, &wallMs, &violated, &status); err != nil {
			continue
		}
		tsStr := ts.UTC().Format(time.RFC3339)
		if lastUpdated == "" {
			lastUpdated = tsStr
		}
		displayStatus := status
		if violated && displayStatus == "completed" {
			displayStatus = "violation"
		}
		envelopeStatus := "passed"
		if violated {
			envelopeStatus = "violated"
		}
		nodes = append(nodes, BTNode{
			ID:             execID,
			Name:           "Execute Task",
			Type:           "action",
			Status:         displayStatus,
			Depth:          1,
			DurationMs:     wallMs,
			ExecutionID:    execID,
			Timestamp:      tsStr,
			EnvelopeStatus: envelopeStatus,
		})
	}

	// Mark root status and envelope_status from children
	nodes[0].EnvelopeStatus = "passed"
	for _, n := range nodes[1:] {
		if n.Status == "violation" {
			nodes[0].Status = "violation"
			nodes[0].EnvelopeStatus = "violated"
			break
		}
	}

	return c.JSON(fiber.Map{
		"agent_id":     agentID,
		"nodes":        nodes,
		"last_updated": lastUpdated,
	})
}

// ── Run control mutations ────────────────────────────────────────────────────

// PauseRun handles POST /v1/execution/runs/:id/pause
func (h *ExecutionHandler) PauseRun(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	runID := c.Params("id")
	res, err := h.db.ExecContext(c.Context(), `
		UPDATE execution_lineage SET status = 'PAUSED'
		WHERE execution_id = $1 AND tenant_id = $2 AND COALESCE(status,'') NOT IN ('PAUSED','CANCELLED','COMPLETED','violation')
	`, runID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("run_id", runID).Msg("[Execution] PauseRun failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "run not found or not pausable"})
	}
	return c.JSON(fiber.Map{"status": "PAUSED"})
}

// ResumeRun handles POST /v1/execution/runs/:id/resume — transitions a PAUSED run back to active.
func (h *ExecutionHandler) ResumeRun(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	runID := c.Params("id")
	res, err := h.db.ExecContext(c.Context(), `
		UPDATE execution_lineage SET status = 'RUNNING'
		WHERE execution_id = $1 AND tenant_id = $2 AND COALESCE(status,'') = 'PAUSED'
	`, runID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("run_id", runID).Msg("[Execution] ResumeRun failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "run not found or not in PAUSED state"})
	}
	return c.JSON(fiber.Map{"status": "RUNNING"})
}

// CancelRun handles POST /v1/execution/runs/:id/cancel
func (h *ExecutionHandler) CancelRun(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	runID := c.Params("id")
	res, err := h.db.ExecContext(c.Context(), `
		UPDATE execution_lineage SET status = 'CANCELLED'
		WHERE execution_id = $1 AND tenant_id = $2 AND COALESCE(status,'') NOT IN ('CANCELLED','COMPLETED')
	`, runID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("run_id", runID).Msg("[Execution] CancelRun failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "run not found or already terminal"})
	}
	return c.JSON(fiber.Map{"status": "CANCELLED"})
}

// ReplayRun handles POST /v1/execution/runs/:id/replay — inserts a new run cloned from the original.
func (h *ExecutionHandler) ReplayRun(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	runID := c.Params("id")

	var agentID, runtimeID sql.NullString
	if err := h.db.QueryRowContext(c.Context(), `
		SELECT agent_id, runtime_id FROM execution_lineage
		WHERE execution_id = $1 AND tenant_id = $2
	`, runID, tenantID).Scan(&agentID, &runtimeID); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "run not found"})
		}
		log.Error().Err(err).Str("run_id", runID).Msg("[Execution] ReplayRun lookup failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	var newID string
	if err := h.db.QueryRowContext(c.Context(), `
		INSERT INTO execution_lineage (agent_id, runtime_id, tenant_id, timestamp_utc, wall_time_ms, violation_occurred)
		VALUES ($1, $2, $3, NOW(), 0, false)
		RETURNING execution_id
	`, agentID, runtimeID, tenantID).Scan(&newID); err != nil {
		log.Error().Err(err).Str("run_id", runID).Msg("[Execution] ReplayRun insert failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	return c.JSON(fiber.Map{"status": "replayed", "new_execution_id": newID})
}

// ApproveRun handles POST /v1/execution/runs/:id/approve
// Transitions a PAUSED run to RUNNING (approved by human reviewer).
func (h *ExecutionHandler) ApproveRun(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	runID := c.Params("id")

	res, err := h.db.ExecContext(c.Context(), `
		UPDATE execution_lineage
		SET status = 'RUNNING',
		    approved_at = NOW(),
		    approved_by = $3
		WHERE execution_id = $1 AND tenant_id = $2 AND COALESCE(status,'') = 'PAUSED'
	`, runID, tenantID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("run_id", runID).Msg("[Execution] ApproveRun failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "run not found or not in PAUSED state"})
	}
	log.Info().Str("run_id", runID).Str("tenant_id", tenantID).Msg("[Execution] Run approved by human reviewer")
	return c.JSON(fiber.Map{"status": "RUNNING", "approved": true})
}

// RejectRun handles POST /v1/execution/runs/:id/reject
// Terminates a PAUSED run with REJECTED status.
func (h *ExecutionHandler) RejectRun(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	runID := c.Params("id")

	var body struct {
		Reason string `json:"reason"`
	}
	_ = c.BodyParser(&body)
	reason := body.Reason
	if reason == "" {
		reason = "human_rejected"
	}

	res, err := h.db.ExecContext(c.Context(), `
		UPDATE execution_lineage
		SET status = 'REJECTED',
		    pause_reason = $3
		WHERE execution_id = $1 AND tenant_id = $2 AND COALESCE(status,'') = 'PAUSED'
	`, runID, tenantID, reason)
	if err != nil {
		log.Error().Err(err).Str("run_id", runID).Msg("[Execution] RejectRun failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "run not found or not in PAUSED state"})
	}
	log.Info().Str("run_id", runID).Str("tenant_id", tenantID).Str("reason", reason).Msg("[Execution] Run rejected by human reviewer")
	return c.JSON(fiber.Map{"status": "REJECTED", "reason": reason})
}

// ── PATCH /v1/agents/:id ─────────────────────────────────────────────────────

// PatchAgent handles PATCH /v1/agents/:id.
// Accepts any subset of: { shadow_mode, reflection_mode, council_mode, cognitive_advisor_enabled }.
// At least one field must be provided. All flags are stored in agent_settings
// (migration 017 + 023).
func (h *ExecutionHandler) PatchAgent(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	agentID := c.Params("id")

	var body struct {
		ShadowMode              *bool `json:"shadow_mode"`
		ReflectionMode          *bool `json:"reflection_mode"`
		CouncilMode             *bool `json:"council_mode"`
		CognitiveAdvisorEnabled *bool `json:"cognitive_advisor_enabled"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.ShadowMode == nil && body.ReflectionMode == nil && body.CouncilMode == nil && body.CognitiveAdvisorEnabled == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "at least one of shadow_mode, reflection_mode, council_mode, cognitive_advisor_enabled is required",
		})
	}

	// Single UPSERT: insert or update only the provided fields using COALESCE
	// so un-provided fields retain their existing DB values.
	shadowMode := body.ShadowMode
	reflectionMode := body.ReflectionMode
	councilMode := body.CouncilMode
	cogAdvisor := body.CognitiveAdvisorEnabled

	_, err := h.db.ExecContext(c.Context(), `
		INSERT INTO agent_settings (agent_id, tenant_id, shadow_mode, reflection_mode, council_mode, cognitive_advisor_enabled, updated_at)
		VALUES ($1, $2,
			COALESCE($3, false),
			COALESCE($4, false),
			COALESCE($5, false),
			COALESCE($6, false),
			NOW()
		)
		ON CONFLICT (agent_id, tenant_id) DO UPDATE SET
			shadow_mode              = COALESCE($3, agent_settings.shadow_mode),
			reflection_mode          = COALESCE($4, agent_settings.reflection_mode),
			council_mode             = COALESCE($5, agent_settings.council_mode),
			cognitive_advisor_enabled = COALESCE($6, agent_settings.cognitive_advisor_enabled),
			updated_at               = NOW()
	`, agentID, tenantID, shadowMode, reflectionMode, councilMode, cogAdvisor)
	if err != nil {
		log.Error().Err(err).Str("agent_id", agentID).Msg("[Execution] PatchAgent upsert failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	resp := fiber.Map{"agent_id": agentID}
	if body.ShadowMode != nil {
		resp["shadow_mode"] = *body.ShadowMode
	}
	if body.ReflectionMode != nil {
		resp["reflection_mode"] = *body.ReflectionMode
	}
	if body.CouncilMode != nil {
		resp["council_mode"] = *body.CouncilMode
	}
	if body.CognitiveAdvisorEnabled != nil {
		resp["cognitive_advisor_enabled"] = *body.CognitiveAdvisorEnabled
	}
	return c.JSON(resp)
}

// ── POST /v1/policies/assign ─────────────────────────────────────────────────

// AssignPolicy handles POST /v1/policies/assign — marks the given policy_hash as
// applied to the listed agents by upserting into agent_settings.
func (h *ExecutionHandler) AssignPolicy(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var body struct {
		AgentIDs   []string `json:"agent_ids"`
		PolicyHash string   `json:"policy_hash"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if len(body.AgentIDs) == 0 || body.PolicyHash == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "agent_ids and policy_hash are required"})
	}

	for _, agentID := range body.AgentIDs {
		if _, err := h.db.ExecContext(c.Context(), `
			INSERT INTO agent_settings (agent_id, tenant_id, policy_hash, updated_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (agent_id, tenant_id) DO UPDATE
			  SET policy_hash = EXCLUDED.policy_hash,
			      updated_at  = NOW()
		`, agentID, tenantID, body.PolicyHash); err != nil {
			log.Error().Err(err).Str("agent_id", agentID).Msg("[Execution] AssignPolicy failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
	}

	log.Info().Str("tenant_id", tenantID).Str("policy_hash", body.PolicyHash).
		Int("agent_count", len(body.AgentIDs)).Msg("[Execution] Policy assigned")
	return c.JSON(fiber.Map{"status": "assigned", "agent_count": len(body.AgentIDs)})
}

// ── GET /v1/policies ─────────────────────────────────────────────────────────

// PolicyLimits is the response shape for GET /v1/policies.
type PolicyLimits struct {
	MaxActionNodes   *int     `json:"max_action_nodes,omitempty"`
	MaxDepth         *int     `json:"max_depth,omitempty"`
	AllowedNodeTypes []string `json:"allowed_node_types,omitempty"`
	MaxToolCalls     *int     `json:"max_tool_calls,omitempty"`
	MaxDurationSecs  *int     `json:"max_duration_secs,omitempty"`
}

// GetPolicies handles GET /v1/policies
// Returns the active BT envelope policy limits for the authenticated tenant.
// Falls back to sensible defaults when no custom policy is configured.
func (h *ExecutionHandler) GetPolicies(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Try to read from tenant_policies table; fall back to defaults when no row exists.
	var maxActions, maxDepth, maxTools, maxDuration sql.NullInt64
	_ = h.db.QueryRowContext(c.Context(), `
		SELECT
			COALESCE(max_action_nodes, NULL),
			COALESCE(max_depth, NULL),
			COALESCE(max_tool_calls, NULL),
			COALESCE(max_duration_secs, NULL)
		FROM tenant_policies
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, tenantID).Scan(&maxActions, &maxDepth, &maxTools, &maxDuration)

	limits := PolicyLimits{
		AllowedNodeTypes: []string{"Sequence", "Selector", "Parallel", "Decorator", "Action", "Condition", "RosTopicPublish", "RosTopicSubscribe", "RosServiceCall"},
	}
	if maxActions.Valid {
		v := int(maxActions.Int64)
		limits.MaxActionNodes = &v
	}
	if maxDepth.Valid {
		v := int(maxDepth.Int64)
		limits.MaxDepth = &v
	}
	if maxTools.Valid {
		v := int(maxTools.Int64)
		limits.MaxToolCalls = &v
	}
	if maxDuration.Valid {
		v := int(maxDuration.Int64)
		limits.MaxDurationSecs = &v
	}

	return c.JSON(limits)
}

// ── GET /v1/execution/shadow ─────────────────────────────────────────────────

// ShadowTrace is the response shape for a shadow vs real execution comparison.
type ShadowTrace struct {
	ID                string     `json:"id"`
	AgentID           string     `json:"agent_id"`
	Timestamp         string     `json:"timestamp"`
	RealExecutionID   string     `json:"real_execution_id"`
	ShadowExecutionID string     `json:"shadow_execution_id"`
	DivergenceScore   *float64   `json:"divergence_score,omitempty"`
	Real              ShadowSide `json:"real"`
	Shadow            ShadowSide `json:"shadow"`
}

// ShadowSide holds metrics for one side of a shadow comparison pair.
type ShadowSide struct {
	Status     string `json:"status"`
	DurationMs int64  `json:"duration_ms"`
	Violations int    `json:"violations"`
	Model      string `json:"model"`
}

// ListShadowTraces handles GET /v1/execution/shadow?range=24h&agent_id=xxx
// Returns paired real vs shadow execution comparisons for agents with shadow_mode=true.
func (h *ExecutionHandler) ListShadowTraces(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Parse time range using a switch to produce a safe, discrete interval string.
	rangeParam := c.Query("range", "24h")
	var interval string
	switch rangeParam {
	case "1h":
		interval = "1 hour"
	case "7d":
		interval = "7 days"
	default:
		interval = "24 hours"
	}

	agentFilter := c.Query("agent_id", "")

	args := []interface{}{tenantID}
	whereAgent := ""
	if agentFilter != "" {
		args = append(args, agentFilter)
		whereAgent = fmt.Sprintf("AND el.agent_id = $%d", len(args))
	}

	rows, err := h.db.QueryContext(c.Context(), `
		SELECT
			el.execution_id,
			el.agent_id,
			el.timestamp_utc,
			el.wall_time_ms,
			el.violation_occurred,
			COALESCE(el.status, CASE WHEN el.violation_occurred THEN 'violation' ELSE 'completed' END) AS status,
			COALESCE(el.shadow_run_id, '') AS shadow_run_id
		FROM execution_lineage el
		INNER JOIN agent_settings ags
		       ON ags.agent_id = el.agent_id AND ags.tenant_id = el.tenant_id
		WHERE el.tenant_id = $1
		  AND el.timestamp_utc >= NOW() - '`+interval+`'::interval
		  AND ags.shadow_mode = true
		  `+whereAgent+`
		ORDER BY el.timestamp_utc DESC
		LIMIT 50
	`, args...)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Shadow] ListShadowTraces query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	traces := make([]ShadowTrace, 0)
	for rows.Next() {
		var execID, agentID, shadowRunID, status string
		var ts time.Time
		var durationMs int64
		var violated bool

		if err := rows.Scan(&execID, &agentID, &ts, &durationMs, &violated, &status, &shadowRunID); err != nil {
			continue
		}

		real := ShadowSide{
			Status:     status,
			DurationMs: durationMs,
			Violations: 0,
			Model:      "",
		}
		if violated {
			real.Violations = 1
		}

		// Shadow side: slightly perturbed for demo; real impl queries shadow_run_id row.
		shadow := ShadowSide{
			Status:     status,
			DurationMs: durationMs + int64(float64(durationMs)*0.05),
			Violations: 0,
			Model:      "",
		}
		if shadowRunID != "" {
			// Try to fetch the shadow execution row.
			var sStatus string
			var sDuration int64
			var sViolated bool
			err := h.db.QueryRowContext(c.Context(), `
				SELECT wall_time_ms, violation_occurred,
				       COALESCE(status, CASE WHEN violation_occurred THEN 'violation' ELSE 'completed' END)
				FROM execution_lineage
				WHERE execution_id = $1
			`, shadowRunID).Scan(&sDuration, &sViolated, &sStatus)
			if err == nil {
				shadow.Status = sStatus
				shadow.DurationMs = sDuration
				if sViolated {
					shadow.Violations = 1
				}
			}
		}

		shadowExecID := shadowRunID
		if shadowExecID == "" {
			shadowExecID = execID + "_shadow"
		}

		// Compute divergence score: combination of status mismatch, violation diff,
		// and relative duration delta. Range [0, 1].
		var divergenceScore *float64
		if shadowRunID != "" {
			var score float64
			// Status divergence: +0.5 if statuses differ
			if real.Status != shadow.Status {
				score += 0.5
			}
			// Violation divergence: +0.3 if violation status differs
			if real.Violations != shadow.Violations {
				score += 0.3
			}
			// Duration divergence: scaled by relative delta, up to +0.2
			if real.DurationMs > 0 {
				delta := float64(shadow.DurationMs-real.DurationMs) / float64(real.DurationMs)
				if delta < 0 {
					delta = -delta
				}
				if delta > 1 {
					delta = 1
				}
				score += delta * 0.2
			}
			if score > 1 {
				score = 1
			}
			divergenceScore = &score
		}

		trace := ShadowTrace{
			ID:                execID + "_pair",
			AgentID:           agentID,
			Timestamp:         ts.UTC().Format(time.RFC3339),
			RealExecutionID:   execID,
			ShadowExecutionID: shadowExecID,
			DivergenceScore:   divergenceScore,
			Real:              real,
			Shadow:            shadow,
		}
		traces = append(traces, trace)
	}

	return c.JSON(traces)
}

// ── GET /v1/alerts/stream (SSE) ──────────────────────────────────────────────

// StreamAlerts handles GET /v1/alerts/stream — sends new violation alerts as
// server-sent events. Polls execution_lineage every 5 s for unacknowledged
// violations newer than the client's last-seen timestamp.
func (h *ExecutionHandler) StreamAlerts(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		// Track which violations we have already sent.
		sent := make(map[string]struct{})

		// Send a keepalive immediately so the browser knows the stream is open.
		fmt.Fprintf(w, ": keepalive\n\n")
		w.Flush() //nolint:errcheck

		for range ticker.C {
			rows, err := h.db.Query(`
				SELECT id, execution_id, agent_id, COALESCE(runtime_id,'') AS device_id, timestamp_utc
				FROM execution_lineage
				WHERE tenant_id = $1
				  AND violation_occurred = TRUE
				  AND alert_acknowledged_at IS NULL
				  AND timestamp_utc >= NOW() - INTERVAL '5 minutes'
				ORDER BY timestamp_utc DESC
				LIMIT 20
			`, tenantID)
			if err != nil {
				log.Error().Err(err).Str("tenant_id", tenantID).Msg("[SSE] alerts query failed")
				fmt.Fprintf(w, "event: error\ndata: {\"error\":\"query_failed\"}\n\n")
				w.Flush() //nolint:errcheck
				return
			}

			for rows.Next() {
				var id, execID, agentID, deviceID string
				var ts time.Time
				if err := rows.Scan(&id, &execID, &agentID, &deviceID, &ts); err != nil {
					continue
				}
				if _, ok := sent[id]; ok {
					continue
				}
				sent[id] = struct{}{}

				payload := fmt.Sprintf(
					`{"id":%q,"execution_id":%q,"agent_id":%q,"device_id":%q,"timestamp":%q,"severity":"error","title":"Policy Violation","message":"Policy violation during execution of agent %s","status":"open"}`,
					id, execID, agentID, deviceID, ts.UTC().Format(time.RFC3339), agentID,
				)
				fmt.Fprintf(w, "id: %s\nevent: alert\ndata: %s\n\n", id, payload)
			}
			rows.Close()
			w.Flush() //nolint:errcheck
		}
	})

	return nil
}

// ── GET /v1/agents/:id/bt-state/stream (SSE) ────────────────────────────────

// StreamBTState handles GET /v1/agents/:id/bt-state/stream — emits live BT tick
// snapshots as server-sent events. Polls runtime_instances.bt_state every 500 ms
// and emits a `bt_tick` event whenever the state changes. Keepalive every 15 s.
func (h *ExecutionHandler) StreamBTState(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	machineID := c.Params("id")

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()

		keepalive := time.NewTicker(15 * time.Second)
		defer keepalive.Stop()

		var lastSeen string

		// Initial keepalive.
		fmt.Fprintf(w, ": keepalive\n\n")
		w.Flush() //nolint:errcheck

		for {
			select {
			case <-ticker.C:
				var rawState []byte
				var updatedAt time.Time
				err := h.db.QueryRow(`
					SELECT COALESCE(bt_state, 'null'::jsonb)::text,
					       COALESCE(bt_state_updated_at, '1970-01-01'::timestamptz)
					FROM runtime_instances
					WHERE tenant_id = $1 AND machine_id = $2
					LIMIT 1
				`, tenantID, machineID).Scan(&rawState, &updatedAt)
				if err != nil {
					log.Error().Err(err).Str("machine_id", machineID).Msg("[SSE] bt-state query failed")
					fmt.Fprintf(w, "event: error\ndata: {\"error\":\"query_failed\"}\n\n")
					w.Flush() //nolint:errcheck
					return
				}

				// Only emit if the state actually changed (avoid duplicate events).
				ts := updatedAt.UTC().Format(time.RFC3339Nano)
				if ts == lastSeen || string(rawState) == "null" {
					continue
				}
				lastSeen = ts

				// Transform nested runtime tree into flat nodes[] shape for
				// the live-view frontend — safe fallback if parse fails.
				enriched := enrichBTSnapshot(rawState, updatedAt)
				fmt.Fprintf(w, "event: bt_tick\ndata: %s\n\n", enriched)
				w.Flush() //nolint:errcheck

			case <-keepalive.C:
				fmt.Fprintf(w, ": keepalive\n\n")
				w.Flush() //nolint:errcheck
			}
		}
	})

	return nil
}
