// Package api provides execution run listing routes for the web-console.
package api

import (
	"database/sql"
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

	v1 := app.Group("/v1")
	v1.Get("/execution/runs", middleware.ClerkAuth(), h.ListRuns)
	v1.Get("/execution/agents", middleware.ClerkAuth(), h.ListAgents)

	log.Info().Msg("[Routes] Registered execution endpoints (GET /v1/execution/runs, GET /v1/execution/agents)")
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
	ID               string        `json:"id"`
	Namespace        string        `json:"namespace"`
	State            string        `json:"state"`
	LastRunAt        *string       `json:"last_run_at,omitempty"`
	DeviceID         *string       `json:"device_id,omitempty"`
	ViolationCount   int64         `json:"violation_count"`
	Capabilities     []string      `json:"capabilities"`
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
			agent_id,
			MAX(timestamp_utc)                                      AS last_run_at,
			COALESCE(
				(SELECT runtime_id FROM execution_lineage e2
				 WHERE e2.agent_id = el.agent_id AND e2.tenant_id = $1
				 ORDER BY e2.timestamp_utc DESC LIMIT 1),
				''
			)                                                       AS device_id,
			SUM(CASE WHEN violation_occurred THEN 1 ELSE 0 END)    AS violation_count,
			BOOL_OR(violation_occurred)                             AS had_violation
		FROM execution_lineage el
		WHERE tenant_id = $1
		GROUP BY agent_id
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

		if err := rows.Scan(&a.ID, &lastRunAt, &deviceID, &a.ViolationCount, &hadViolation); err != nil {
			log.Error().Err(err).Msg("[Execution] Agent scan error")
			continue
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
