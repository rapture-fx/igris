// Package api provides execution run listing routes for the web-console.
package api

import (
	"bufio"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

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
	app.Post("/v1/execution/runs/:id/pause", auth, h.PauseRun)
	app.Post("/v1/execution/runs/:id/resume", auth, h.ResumeRun)
	app.Post("/v1/execution/runs/:id/cancel", auth, h.CancelRun)
	app.Post("/v1/execution/runs/:id/replay", auth, h.ReplayRun)
	app.Get("/v1/execution/agents", auth, h.ListAgents)
	app.Patch("/v1/agents/:id", auth, h.PatchAgent)
	app.Get("/v1/agents/:id/bt-state", auth, h.GetAgentBTState)
	app.Get("/v1/agents/:id/bt-state/stream", auth, h.StreamBTState)
	app.Post("/v1/policies/assign", auth, h.AssignPolicy)
	app.Get("/v1/alerts/stream", auth, h.StreamAlerts)

	log.Info().Msg("[Routes] Registered execution endpoints (/v1/execution/runs, /v1/execution/agents, /v1/agents/:id, /v1/policies/assign, /v1/alerts/stream, /v1/agents/:id/bt-state/stream)")
}

// ExecutionRun is the response shape for a single execution row.
type ExecutionRun struct {
	ID           string    `json:"id"`
	AgentID      string    `json:"agent_id"`
	Model        string    `json:"model"`
	DeviceID     string    `json:"device_id"`
	StartedAt    time.Time `json:"started_at"`
	DurationMs   int64     `json:"duration_ms"`
	Status       string    `json:"status"`
	HasViolation bool      `json:"has_violation"`
}

// ListRuns handles GET /v1/execution/runs?limit=20&sort=created_at:desc
func (h *ExecutionHandler) ListRuns(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
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

	// Parse sort param — currently we only support timestamp_utc asc/desc
	sortDir := "DESC"
	if raw := c.Query("sort", ""); raw != "" {
		// Accept "created_at:asc" or "created_at:desc"
		parts := strings.SplitN(raw, ":", 2)
		if len(parts) == 2 && strings.EqualFold(parts[1], "asc") {
			sortDir = "ASC"
		}
	}

	query := `
		SELECT
			execution_id,
			agent_id,
			COALESCE(runtime_id, '') AS device_id,
			timestamp_utc,
			wall_time_ms,
			violation_occurred
		FROM execution_lineage
		WHERE tenant_id = $1
		ORDER BY timestamp_utc ` + sortDir + `
		LIMIT $2
	`

	rows, err := h.db.Query(query, tenantID, limit)
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
		var r ExecutionRun
		var violOccurred bool

		if err := rows.Scan(
			&r.ID,
			&r.AgentID,
			&r.DeviceID,
			&r.StartedAt,
			&r.DurationMs,
			&violOccurred,
		); err != nil {
			log.Error().Err(err).Msg("[Execution] Scan error")
			continue
		}
		r.HasViolation = violOccurred
		// Derive a human-readable status
		if violOccurred {
			r.Status = "violation"
		} else {
			r.Status = "completed"
		}
		// Model is not stored in execution_lineage; emit empty string so the
		// console renders '—' rather than crashing on a missing field.
		r.Model = ""
		runs = append(runs, r)
	}

	return c.JSON(runs)
}

// Agent is the response shape for a single agent derived from execution history.
type Agent struct {
	ID             string   `json:"id"`
	Namespace      string   `json:"namespace"`
	State          string   `json:"state"`
	LastRunAt      *string  `json:"last_run_at,omitempty"`
	DeviceID       *string  `json:"device_id,omitempty"`
	ViolationCount int64    `json:"violation_count"`
	Capabilities   []string `json:"capabilities"`
	ShadowMode     bool     `json:"shadow_mode"`
	ReflectionMode bool     `json:"reflection_mode"`
	CouncilMode    bool     `json:"council_mode"`
	PolicyHash     *string  `json:"policy_hash,omitempty"`
}

// ListAgents handles GET /v1/execution/agents
// Derives the agent list from execution_lineage grouped by agent_id.
func (h *ExecutionHandler) ListAgents(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rows, err := h.db.Query(`
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
			ags.policy_hash
		FROM execution_lineage el
		LEFT JOIN agent_settings ags
		       ON ags.agent_id = el.agent_id AND ags.tenant_id = el.tenant_id
		WHERE el.tenant_id = $1
		GROUP BY el.agent_id, ags.shadow_mode, ags.reflection_mode, ags.council_mode, ags.policy_hash
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

		if err := rows.Scan(&a.ID, &lastRunAt, &deviceID, &a.ViolationCount, &hadViolation, &a.ShadowMode, &a.ReflectionMode, &a.CouncilMode, &policyHash); err != nil {
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

	return c.JSON(agents)
}

// ── GET /v1/agents/:id/bt-state ──────────────────────────────────────────────

// BTNode is a single node in the behaviour-tree execution view.
type BTNode struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Status      string  `json:"status"`
	Depth       int     `json:"depth"`
	DurationMs  int64   `json:"duration_ms,omitempty"`
	ExecutionID string  `json:"execution_id,omitempty"`
	Timestamp   string  `json:"timestamp,omitempty"`
	LLMProposal *string `json:"llm_proposal,omitempty"`
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
			ID:    "root",
			Name:  "Root Selector",
			Type:  "selector",
			Status: "completed",
			Depth: 0,
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
		nodes = append(nodes, BTNode{
			ID:          execID,
			Name:        "Execute Task",
			Type:        "action",
			Status:      displayStatus,
			Depth:       1,
			DurationMs:  wallMs,
			ExecutionID: execID,
			Timestamp:   tsStr,
		})
	}

	// Mark root status from children
	for _, n := range nodes[1:] {
		if n.Status == "violation" {
			nodes[0].Status = "violation"
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

// ── PATCH /v1/agents/:id ─────────────────────────────────────────────────────

// PatchAgent handles PATCH /v1/agents/:id.
// Accepts any subset of: { shadow_mode, reflection_mode, council_mode }.
// At least one field must be provided. All flags are stored in agent_settings
// (migration 017 + 023).
func (h *ExecutionHandler) PatchAgent(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	agentID := c.Params("id")

	var body struct {
		ShadowMode     *bool `json:"shadow_mode"`
		ReflectionMode *bool `json:"reflection_mode"`
		CouncilMode    *bool `json:"council_mode"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.ShadowMode == nil && body.ReflectionMode == nil && body.CouncilMode == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "at least one of shadow_mode, reflection_mode, council_mode is required",
		})
	}

	// Ensure a row exists first, then apply only the provided fields.
	_, err := h.db.ExecContext(c.Context(), `
		INSERT INTO agent_settings (agent_id, tenant_id, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (agent_id, tenant_id) DO UPDATE SET updated_at = NOW()
	`, agentID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("agent_id", agentID).Msg("[Execution] PatchAgent upsert failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	if body.ShadowMode != nil {
		if _, err := h.db.ExecContext(c.Context(),
			`UPDATE agent_settings SET shadow_mode = $1, updated_at = NOW() WHERE agent_id = $2 AND tenant_id = $3`,
			*body.ShadowMode, agentID, tenantID,
		); err != nil {
			log.Error().Err(err).Str("agent_id", agentID).Msg("[Execution] PatchAgent shadow_mode failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
	}
	if body.ReflectionMode != nil {
		if _, err := h.db.ExecContext(c.Context(),
			`UPDATE agent_settings SET reflection_mode = $1, updated_at = NOW() WHERE agent_id = $2 AND tenant_id = $3`,
			*body.ReflectionMode, agentID, tenantID,
		); err != nil {
			log.Error().Err(err).Str("agent_id", agentID).Msg("[Execution] PatchAgent reflection_mode failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
	}
	if body.CouncilMode != nil {
		if _, err := h.db.ExecContext(c.Context(),
			`UPDATE agent_settings SET council_mode = $1, updated_at = NOW() WHERE agent_id = $2 AND tenant_id = $3`,
			*body.CouncilMode, agentID, tenantID,
		); err != nil {
			log.Error().Err(err).Str("agent_id", agentID).Msg("[Execution] PatchAgent council_mode failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
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

				fmt.Fprintf(w, "event: bt_tick\ndata: %s\n\n", rawState)
				w.Flush() //nolint:errcheck

			case <-keepalive.C:
				fmt.Fprintf(w, ": keepalive\n\n")
				w.Flush() //nolint:errcheck
			}
		}
	})

	return nil
}
