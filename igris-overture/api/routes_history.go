// Package api provides history endpoints for the web-console History section.
// Three pages are served: Logs (/v1/history/events), Metrics (/v1/history/metrics),
// and Alerts (/v1/history/alerts with acknowledge/resolve actions).
package api

import (
	"database/sql"
	"math"
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
	v1.Post("/alerts/:id/escalate", h.escalateAlert)

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

// rangeToMinutes returns the window size in minutes for exec/min computation.
func rangeToMinutes(r string) float64 {
	switch r {
	case "1h", "last_1h":
		return 60
	case "6h", "last_6h":
		return 360
	case "24h", "last_24h":
		return 1440
	case "7d", "last_7d":
		return 10080
	case "30d", "last_30d":
		return 43200
	default:
		return 1440
	}
}

func (h *historyHandler) getMetrics(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "last_24h")
	interval := rangeToInterval(rangeParam)
	windowMinutes := rangeToMinutes(rangeParam)

	// ── Aggregate summary ────────────────────────────────────────────────────
	var totalExecutions, totalViolations int64
	var avgDurationMs float64

	err := h.db.QueryRow(`
		SELECT
			COUNT(*),
			SUM(CASE WHEN violation_occurred THEN 1 ELSE 0 END),
			COALESCE(AVG(wall_time_ms), 0)
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND timestamp_utc >= NOW() - INTERVAL '`+interval+`'
	`, tenantID).Scan(&totalExecutions, &totalViolations, &avgDurationMs)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[History] Failed to aggregate metrics")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	successRate := 0.0
	if totalExecutions > 0 {
		successRate = float64(totalExecutions-totalViolations) / float64(totalExecutions) * 100
	}
	execsPerMin := 0.0
	if windowMinutes > 0 {
		execsPerMin = math.Round(float64(totalExecutions)/windowMinutes*100) / 100
	}

	summary := fiber.Map{
		"executions_per_minute": execsPerMin,
		"avg_latency_ms":        math.Round(avgDurationMs),
		"success_rate_percent":  math.Round(successRate*10) / 10,
		"policy_violations":     totalViolations,
	}

	// ── Throughput time series (mapped to { time, executions }) ──────────────
	truncUnit := "hour"
	timeFmt := time.RFC3339
	if rangeParam == "7d" || rangeParam == "last_7d" || rangeParam == "30d" || rangeParam == "last_30d" {
		truncUnit = "day"
		timeFmt = "2006-01-02"
	}

	tpRows, err := h.db.Query(`
		SELECT
			DATE_TRUNC('`+truncUnit+`', timestamp_utc) AS bucket,
			COUNT(*)                                    AS executions
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND timestamp_utc >= NOW() - INTERVAL '`+interval+`'
		GROUP BY bucket
		ORDER BY bucket ASC
	`, tenantID)

	type ThroughputPoint struct {
		Time       string `json:"time"`
		Executions int64  `json:"executions"`
	}
	throughput := make([]ThroughputPoint, 0)
	if err == nil {
		defer tpRows.Close()
		for tpRows.Next() {
			var ts time.Time
			var count int64
			if err := tpRows.Scan(&ts, &count); err != nil {
				continue
			}
			throughput = append(throughput, ThroughputPoint{
				Time:       ts.UTC().Format(timeFmt),
				Executions: count,
			})
		}
	}

	// ── Metric events (recent executions as latency_ms events) ───────────────
	evRows, err := h.db.Query(`
		SELECT
			id,
			timestamp_utc,
			wall_time_ms,
			agent_id,
			COALESCE(runtime_id, '') AS device_id
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND timestamp_utc >= NOW() - INTERVAL '`+interval+`'
		ORDER BY timestamp_utc DESC
		LIMIT 200
	`, tenantID)

	type MetricEvent struct {
		ID          string  `json:"id"`
		Timestamp   string  `json:"timestamp"`
		MetricName  string  `json:"metric_name"`
		MetricValue float64 `json:"metric_value"`
		Unit        string  `json:"unit"`
		AgentID     string  `json:"agent_id"`
		DeviceID    string  `json:"device_id"`
		Provider    string  `json:"provider"`
	}
	events := make([]MetricEvent, 0)
	if err == nil {
		defer evRows.Close()
		for evRows.Next() {
			var ev MetricEvent
			var ts time.Time
			var wallMs int64
			if err := evRows.Scan(&ev.ID, &ts, &wallMs, &ev.AgentID, &ev.DeviceID); err != nil {
				continue
			}
			ev.Timestamp = ts.UTC().Format(time.RFC3339)
			ev.MetricName = "latency_ms"
			ev.MetricValue = float64(wallMs)
			ev.Unit = "ms"
			ev.Provider = ""
			events = append(events, ev)
		}
	}

	return c.JSON(fiber.Map{
		"summary":          summary,
		"throughput":       throughput,
		"provider_latency": []fiber.Map{},
		"resource_usage":   []fiber.Map{},
		"fleet_activity":   []fiber.Map{},
		"events":           events,
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

func (h *historyHandler) escalateAlert(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	alertID := c.Params("id")

	result, err := h.db.Exec(`
		UPDATE execution_lineage
		SET alert_escalated_at = NOW()
		WHERE id = $1
		  AND tenant_id = $2
		  AND violation_occurred = TRUE
	`, alertID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("alert_id", alertID).Msg("[History] Escalate alert failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "alert not found"})
	}
	return c.JSON(fiber.Map{"status": "escalated"})
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
