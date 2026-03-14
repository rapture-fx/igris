// Package api provides history endpoints for the web-console History section.
// Three pages are served: Logs (/v1/history/events), Metrics (/v1/history/metrics),
// and Alerts (/v1/history/alerts with acknowledge/resolve actions).
package api

import (
	"database/sql"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterHistoryRoutes registers the /v1/history/* endpoints.
func RegisterHistoryRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] History endpoints disabled — database not available")
		return
	}

	h := &historyHandler{db: db}

	v1 := app.Group("/v1/history")
	v1.Use(middleware.BetterAuth(db))

	v1.Get("/events", h.listEvents)
	v1.Get("/metrics", h.getMetrics)
	v1.Get("/alerts", h.listAlerts)
	v1.Post("/alerts/:id/acknowledge", h.acknowledgeAlert)
	v1.Post("/alerts/:id/resolve", h.resolveAlert)

	log.Info().Msg("[Routes] Registered history endpoints (/v1/history/events|metrics|alerts)")
}

type historyHandler struct{ db *sql.DB }

// ── /v1/history/events ──────────────────────────────────────────────────────

func (h *historyHandler) listEvents(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "last_1h")
	interval := rangeToInterval(rangeParam)

	limit := 500
	if raw := c.Query("limit", ""); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 2000 {
			limit = v
		}
	}

	agentFilter := c.Query("agent_id", "")
	deviceFilter := c.Query("device_id", "")

	query := `
		SELECT
			id,
			execution_id,
			agent_id,
			COALESCE(runtime_id, '') AS device_id,
			timestamp_utc,
			wall_time_ms,
			violation_occurred
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND timestamp_utc >= NOW() - INTERVAL '` + interval + `'
	`
	args := []interface{}{tenantID}
	idx := 2

	if agentFilter != "" {
		query += " AND agent_id = $" + strconv.Itoa(idx)
		args = append(args, agentFilter)
		idx++
	}
	if deviceFilter != "" {
		query += " AND runtime_id = $" + strconv.Itoa(idx)
		args = append(args, deviceFilter)
		idx++
	}

	query += " ORDER BY timestamp_utc DESC LIMIT $" + strconv.Itoa(idx)
	args = append(args, limit)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[History] Failed to list events")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	type RuntimeEvent struct {
		ID           string `json:"id"`
		ExecutionID  string `json:"execution_id"`
		AgentID      string `json:"agent_id"`
		DeviceID     string `json:"device_id"`
		Timestamp    string `json:"timestamp"`
		DurationMs   int64  `json:"duration_ms"`
		EventType    string `json:"event_type"`
		Severity     string `json:"severity"`
		Message      string `json:"message"`
	}

	events := make([]RuntimeEvent, 0, limit)
	for rows.Next() {
		var e RuntimeEvent
		var ts time.Time
		var violated bool

		if err := rows.Scan(
			&e.ID, &e.ExecutionID, &e.AgentID, &e.DeviceID,
			&ts, &e.DurationMs, &violated,
		); err != nil {
			continue
		}
		e.Timestamp = ts.UTC().Format(time.RFC3339)
		if violated {
			e.EventType = "violation"
			e.Severity = "error"
			e.Message = "Policy violation occurred during execution"
		} else {
			e.EventType = "execution_completed"
			e.Severity = "info"
			e.Message = "Execution completed successfully"
		}
		events = append(events, e)
	}

	return c.JSON(events)
}

// ── /v1/history/metrics ─────────────────────────────────────────────────────

func (h *historyHandler) getMetrics(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "last_24h")
	interval := rangeToInterval(rangeParam)

	type Summary struct {
		TotalExecutions  int64   `json:"total_executions"`
		TotalViolations  int64   `json:"total_violations"`
		AvgDurationMs    float64 `json:"avg_duration_ms"`
		P95DurationMs    float64 `json:"p95_duration_ms"`
		SuccessRate      float64 `json:"success_rate"`
	}

	type TimePoint struct {
		Time    string `json:"time"`
		Count   int64  `json:"count"`
		Violations int64 `json:"violations"`
	}

	var summary Summary
	err := h.db.QueryRow(`
		SELECT
			COUNT(*),
			SUM(CASE WHEN violation_occurred THEN 1 ELSE 0 END),
			COALESCE(AVG(wall_time_ms), 0),
			COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY wall_time_ms), 0)
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND timestamp_utc >= NOW() - INTERVAL '`+interval+`'
	`, tenantID).Scan(
		&summary.TotalExecutions, &summary.TotalViolations,
		&summary.AvgDurationMs, &summary.P95DurationMs,
	)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[History] Failed to aggregate metrics")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	if summary.TotalExecutions > 0 {
		summary.SuccessRate = float64(summary.TotalExecutions-summary.TotalViolations) /
			float64(summary.TotalExecutions) * 100
	}

	// Hourly time series
	rows, err := h.db.Query(`
		SELECT
			DATE_TRUNC('hour', timestamp_utc)                        AS hour,
			COUNT(*)                                                  AS total,
			SUM(CASE WHEN violation_occurred THEN 1 ELSE 0 END)      AS violations
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND timestamp_utc >= NOW() - INTERVAL '`+interval+`'
		GROUP BY hour
		ORDER BY hour ASC
	`, tenantID)
	if err != nil {
		log.Error().Err(err).Msg("[History] Failed to query time series")
		rows = nil
	}

	timeSeries := make([]TimePoint, 0)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var tp TimePoint
			var ts time.Time
			if err := rows.Scan(&ts, &tp.Count, &tp.Violations); err != nil {
				continue
			}
			tp.Time = ts.UTC().Format(time.RFC3339)
			timeSeries = append(timeSeries, tp)
		}
	}

	return c.JSON(fiber.Map{
		"summary":     summary,
		"time_series": timeSeries,
	})
}

// ── /v1/history/alerts ──────────────────────────────────────────────────────

func (h *historyHandler) listAlerts(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "last_24h")
	interval := rangeToInterval(rangeParam)

	limit := 200
	if raw := c.Query("limit", ""); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 1000 {
			limit = v
		}
	}

	rows, err := h.db.Query(`
		SELECT
			id,
			execution_id,
			agent_id,
			COALESCE(runtime_id, '') AS device_id,
			timestamp_utc,
			alert_acknowledged_at,
			alert_resolved_at
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND violation_occurred = TRUE
		  AND timestamp_utc >= NOW() - INTERVAL '`+interval+`'
		ORDER BY timestamp_utc DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[History] Failed to list alerts")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	type SystemAlert struct {
		ID              string  `json:"id"`
		ExecutionID     string  `json:"execution_id"`
		AgentID         string  `json:"agent_id"`
		DeviceID        string  `json:"device_id"`
		Timestamp       string  `json:"timestamp"`
		Severity        string  `json:"severity"`
		Title           string  `json:"title"`
		Message         string  `json:"message"`
		Status          string  `json:"status"`
		AcknowledgedAt  *string `json:"acknowledged_at,omitempty"`
		ResolvedAt      *string `json:"resolved_at,omitempty"`
	}

	alerts := make([]SystemAlert, 0, limit)
	for rows.Next() {
		var a SystemAlert
		var ts time.Time
		var ackAt, resolvedAt sql.NullTime

		if err := rows.Scan(
			&a.ID, &a.ExecutionID, &a.AgentID, &a.DeviceID,
			&ts, &ackAt, &resolvedAt,
		); err != nil {
			continue
		}
		a.Timestamp = ts.UTC().Format(time.RFC3339)
		a.Severity = "error"
		a.Title = "Policy Violation"
		a.Message = "A policy violation was detected during execution of agent " + a.AgentID

		switch {
		case resolvedAt.Valid:
			a.Status = "resolved"
			s := resolvedAt.Time.UTC().Format(time.RFC3339)
			a.ResolvedAt = &s
		case ackAt.Valid:
			a.Status = "acknowledged"
			s := ackAt.Time.UTC().Format(time.RFC3339)
			a.AcknowledgedAt = &s
		default:
			a.Status = "open"
		}
		alerts = append(alerts, a)
	}

	return c.JSON(alerts)
}

func (h *historyHandler) acknowledgeAlert(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	alertID := c.Params("id")

	result, err := h.db.Exec(`
		UPDATE execution_lineage
		SET alert_acknowledged_at = NOW()
		WHERE id = $1
		  AND tenant_id = $2
		  AND violation_occurred = TRUE
		  AND alert_acknowledged_at IS NULL
	`, alertID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("alert_id", alertID).Msg("[History] Acknowledge alert failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "alert not found or already acknowledged"})
	}
	return c.JSON(fiber.Map{"status": "acknowledged"})
}

func (h *historyHandler) resolveAlert(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	alertID := c.Params("id")

	result, err := h.db.Exec(`
		UPDATE execution_lineage
		SET alert_resolved_at = NOW(),
		    alert_acknowledged_at = COALESCE(alert_acknowledged_at, NOW())
		WHERE id = $1
		  AND tenant_id = $2
		  AND violation_occurred = TRUE
		  AND alert_resolved_at IS NULL
	`, alertID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("alert_id", alertID).Msg("[History] Resolve alert failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "alert not found or already resolved"})
	}
	return c.JSON(fiber.Map{"status": "resolved"})
}

// ── helpers ─────────────────────────────────────────────────────────────────

func rangeToInterval(r string) string {
	switch r {
	case "last_1h":
		return "1 hour"
	case "last_6h":
		return "6 hours"
	case "last_24h", "24h":
		return "24 hours"
	case "last_7d", "7d":
		return "7 days"
	case "last_30d", "30d":
		return "30 days"
	default:
		return "24 hours"
	}
}
