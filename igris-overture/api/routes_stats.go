// Package api provides stats/overview API routes for the web-console dashboard.
package api

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// StatsHandler handles dashboard statistics API requests.
type StatsHandler struct {
	db    *sql.DB
	redis *redis.Client
}

// NewStatsHandler creates a new stats handler.
func NewStatsHandler(db *sql.DB, redisClient *redis.Client) *StatsHandler {
	return &StatsHandler{db: db, redis: redisClient}
}

// RegisterStatsRoutes registers the stats and usage summary endpoints.
func RegisterStatsRoutes(app *fiber.App, db *sql.DB, redisClient *redis.Client, _ *middleware.TenantAuth) {
	if db == nil {
		log.Warn().Msg("[Routes] Stats endpoints disabled — database not available")
		return
	}

	h := NewStatsHandler(db, redisClient)

	v1 := app.Group("/v1")
	v1.Get("/stats/overview", middleware.BetterAuth(db), h.Overview)
	v1.Get("/stats/model-usage", middleware.BetterAuth(db), h.ModelUsage)
	v1.Get("/usage/summary", middleware.BetterAuth(db), h.UsageSummary)

	log.Info().Msg("[Routes] Registered stats endpoints (GET /v1/stats/overview, /v1/stats/model-usage, /v1/usage/summary)")
}

// OverviewStats is the response shape for GET /v1/stats/overview.
type OverviewStats struct {
	ActiveExecutions   int     `json:"active_executions"`
	Violations24h      int     `json:"violations_24h"`
	OnlineDevices      int     `json:"online_devices"`
	ModelRequests24h   int     `json:"model_requests_24h"`
	QuotaUsagePercent  float64 `json:"quota_usage_percent"`
	ActiveAlerts       int     `json:"active_alerts"`
}

// Overview handles GET /v1/stats/overview.
// Returns aggregate dashboard statistics for the authenticated tenant.
func (h *StatsHandler) Overview(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	stats := OverviewStats{}

	// Count executions in progress for this tenant (last 5 minutes = "active")
	err := h.db.QueryRow(`
		SELECT COUNT(*)
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND timestamp_utc >= NOW() - INTERVAL '5 minutes'
	`, tenantID).Scan(&stats.ActiveExecutions)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Stats] Failed to count active executions")
	}

	// Count violations in last 24 hours
	err = h.db.QueryRow(`
		SELECT COUNT(*)
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND violation_occurred = TRUE
		  AND timestamp_utc >= NOW() - INTERVAL '24 hours'
	`, tenantID).Scan(&stats.Violations24h)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Stats] Failed to count violations")
	}

	// Count online fleet agents (seen in last 5 minutes)
	err = h.db.QueryRow(`
		SELECT COUNT(*)
		FROM fleet_agents
		WHERE last_seen >= NOW() - INTERVAL '5 minutes'
		  AND status = 'active'
	`).Scan(&stats.OnlineDevices)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Msg("[Stats] Failed to count online devices")
	}

	// Count model requests in last 24 hours (usage_log for this tenant via license)
	err = h.db.QueryRow(`
		SELECT COUNT(*)
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.customer_id = $1
		  AND ul.timestamp >= NOW() - INTERVAL '24 hours'
	`, tenantID).Scan(&stats.ModelRequests24h)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Stats] Failed to count model requests")
	}

	// Quota usage: compare this month's usage to tier limit
	var usedThisMonth int
	var tierLimit int
	err = h.db.QueryRow(`
		SELECT
			COALESCE(
				(SELECT COUNT(*) FROM usage_log ul2
				 JOIN licenses l2 ON ul2.license_id = l2.id
				 WHERE l2.customer_id = $1
				   AND ul2.timestamp >= DATE_TRUNC('month', NOW())),
				0
			),
			CASE
				WHEN t.tier = 'seed'     THEN 50000
				WHEN t.tier = 'horizon'  THEN 500000
				WHEN t.tier = 'infinite' THEN 2000000
				ELSE 50000
			END
		FROM tenants t
		WHERE t.id = $1
	`, tenantID).Scan(&usedThisMonth, &tierLimit)
	if err == nil && tierLimit > 0 {
		stats.QuotaUsagePercent = float64(usedThisMonth) / float64(tierLimit) * 100
		if stats.QuotaUsagePercent > 100 {
			stats.QuotaUsagePercent = 100
		}
	}

	// Active alerts: violations in last 1 hour that haven't been acknowledged
	// Use violations in last hour as a proxy for alerts requiring attention
	err = h.db.QueryRow(`
		SELECT COUNT(*)
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND violation_occurred = TRUE
		  AND timestamp_utc >= NOW() - INTERVAL '1 hour'
	`, tenantID).Scan(&stats.ActiveAlerts)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Stats] Failed to count active alerts")
	}

	return c.JSON(stats)
}

// ModelUsagePoint is one data point in the model-usage time series.
type ModelUsagePoint struct {
	Hour     string `json:"hour"`
	Requests int    `json:"requests"`
}

// ModelUsage handles GET /v1/stats/model-usage?period=24h.
func (h *StatsHandler) ModelUsage(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rows, err := h.db.Query(`
		SELECT
			TO_CHAR(DATE_TRUNC('hour', ul.timestamp), 'HH24:MI') AS hour,
			COUNT(*) AS requests
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.customer_id = $1
		  AND ul.timestamp >= NOW() - INTERVAL '24 hours'
		GROUP BY DATE_TRUNC('hour', ul.timestamp)
		ORDER BY DATE_TRUNC('hour', ul.timestamp) ASC
	`, tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Stats] Failed to query model usage")
		// Return empty array rather than an error so the chart renders cleanly
		return c.JSON([]ModelUsagePoint{})
	}
	defer rows.Close()

	points := make([]ModelUsagePoint, 0, 24)
	for rows.Next() {
		var p ModelUsagePoint
		if err := rows.Scan(&p.Hour, &p.Requests); err != nil {
			log.Error().Err(err).Msg("[Stats] Failed to scan model usage row")
			continue
		}
		points = append(points, p)
	}

	return c.JSON(points)
}

// UsageSummaryResponse is the response for GET /v1/usage/summary.
type UsageSummaryResponse struct {
	Cost24h float64 `json:"cost_24h"`
}

// UsageSummary handles GET /v1/usage/summary.
func (h *StatsHandler) UsageSummary(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var cost24h float64
	err := h.db.QueryRow(`
		SELECT COALESCE(SUM(ul.cost_usd), 0)
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.customer_id = $1
		  AND ul.timestamp >= NOW() - INTERVAL '24 hours'
	`, tenantID).Scan(&cost24h)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Stats] Failed to query cost summary")
	}

	return c.JSON(UsageSummaryResponse{Cost24h: cost24h})
}
