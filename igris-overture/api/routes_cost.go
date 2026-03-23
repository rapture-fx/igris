// Package api provides cost/usage analytics endpoints for the web-console
// Models > Cost page. All endpoints are under /models/usage/* and aggregate
// from the usage_log table (joined through licenses → customer_id).
package api

import (
	"database/sql"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterCostRoutes registers the /models/usage/* endpoints.
func RegisterCostRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Cost endpoints disabled — database not available")
		return
	}

	h := &costHandler{db: db}

	models := app.Group("/models/usage")
	models.Use(middleware.BetterAuth(db))

	models.Get("/summary", h.summary)
	models.Get("/providers", h.byProvider)
	models.Get("/models", h.byModel)
	models.Get("/daily", h.daily)
	models.Get("/events", h.events)

	log.Info().Msg("[Routes] Registered cost endpoints (/models/usage/summary|providers|models|daily|events)")
}

type costHandler struct{ db *sql.DB }

func costInterval(r string) string {
	switch r {
	case "7d":
		return "7 days"
	case "30d":
		return "30 days"
	case "90d":
		return "90 days"
	default:
		return "30 days"
	}
}

// ── GET /models/usage/summary ────────────────────────────────────────────────

func (h *costHandler) summary(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "30d")
	interval := costInterval(rangeParam)

	var totalRequests int64
	var totalTokensIn, totalTokensOut sql.NullInt64
	var totalCostUSD sql.NullFloat64

	err := h.db.QueryRow(`
		SELECT
			COUNT(ul.id),
			SUM(ul.tokens_input),
			SUM(ul.tokens_output),
			SUM(ul.cost_usd)
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.tenant_id = $1
		  AND ul.timestamp >= NOW() - INTERVAL '`+interval+`'
	`, tenantID).Scan(&totalRequests, &totalTokensIn, &totalTokensOut, &totalCostUSD)
	if err != nil && err != sql.ErrNoRows {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Cost] Summary query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	return c.JSON(fiber.Map{
		"total_requests":  totalRequests,
		"total_tokens_in": totalTokensIn.Int64,
		"total_tokens_out": totalTokensOut.Int64,
		"total_cost_usd":  totalCostUSD.Float64,
		"range":           rangeParam,
	})
}

// ── GET /models/usage/providers ─────────────────────────────────────────────

func (h *costHandler) byProvider(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "30d")
	interval := costInterval(rangeParam)

	rows, err := h.db.Query(`
		SELECT
			COALESCE(ul.provider, 'unknown')   AS provider,
			COUNT(ul.id)                        AS requests,
			COALESCE(SUM(ul.tokens_input), 0)  AS tokens_in,
			COALESCE(SUM(ul.tokens_output), 0) AS tokens_out,
			COALESCE(SUM(ul.cost_usd), 0)      AS cost_usd
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.tenant_id = $1
		  AND ul.timestamp >= NOW() - INTERVAL '`+interval+`'
		GROUP BY provider
		ORDER BY cost_usd DESC
	`, tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Cost] By-provider query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	type ProviderRow struct {
		Provider  string  `json:"provider"`
		Requests  int64   `json:"requests"`
		TokensIn  int64   `json:"tokens_in"`
		TokensOut int64   `json:"tokens_out"`
		CostUSD   float64 `json:"cost_usd"`
	}

	result := make([]ProviderRow, 0)
	for rows.Next() {
		var r ProviderRow
		if err := rows.Scan(&r.Provider, &r.Requests, &r.TokensIn, &r.TokensOut, &r.CostUSD); err != nil {
			continue
		}
		result = append(result, r)
	}
	return c.JSON(result)
}

// ── GET /models/usage/models ─────────────────────────────────────────────────

func (h *costHandler) byModel(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "30d")
	interval := costInterval(rangeParam)

	rows, err := h.db.Query(`
		SELECT
			COALESCE(ul.model, 'unknown')       AS model,
			COALESCE(ul.provider, 'unknown')    AS provider,
			COUNT(ul.id)                         AS requests,
			COALESCE(SUM(ul.tokens_input), 0)   AS tokens_in,
			COALESCE(SUM(ul.tokens_output), 0)  AS tokens_out,
			COALESCE(SUM(ul.cost_usd), 0)       AS cost_usd
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.tenant_id = $1
		  AND ul.timestamp >= NOW() - INTERVAL '`+interval+`'
		GROUP BY ul.model, ul.provider
		ORDER BY cost_usd DESC
	`, tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Cost] By-model query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	type ModelRow struct {
		Model     string  `json:"model"`
		Provider  string  `json:"provider"`
		Requests  int64   `json:"requests"`
		TokensIn  int64   `json:"tokens_in"`
		TokensOut int64   `json:"tokens_out"`
		CostUSD   float64 `json:"cost_usd"`
	}

	result := make([]ModelRow, 0)
	for rows.Next() {
		var r ModelRow
		if err := rows.Scan(&r.Model, &r.Provider, &r.Requests, &r.TokensIn, &r.TokensOut, &r.CostUSD); err != nil {
			continue
		}
		result = append(result, r)
	}
	return c.JSON(result)
}

// ── GET /models/usage/daily ──────────────────────────────────────────────────

func (h *costHandler) daily(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "30d")
	interval := costInterval(rangeParam)

	rows, err := h.db.Query(`
		SELECT
			DATE_TRUNC('day', ul.timestamp)     AS day,
			COUNT(ul.id)                         AS requests,
			COALESCE(SUM(ul.tokens_input), 0)   AS tokens_in,
			COALESCE(SUM(ul.tokens_output), 0)  AS tokens_out,
			COALESCE(SUM(ul.cost_usd), 0)       AS cost_usd
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.tenant_id = $1
		  AND ul.timestamp >= NOW() - INTERVAL '`+interval+`'
		GROUP BY day
		ORDER BY day ASC
	`, tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Cost] Daily query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	type DayRow struct {
		Day       string  `json:"day"`
		Requests  int64   `json:"requests"`
		TokensIn  int64   `json:"tokens_in"`
		TokensOut int64   `json:"tokens_out"`
		CostUSD   float64 `json:"cost_usd"`
	}

	result := make([]DayRow, 0)
	for rows.Next() {
		var r DayRow
		var ts time.Time
		if err := rows.Scan(&ts, &r.Requests, &r.TokensIn, &r.TokensOut, &r.CostUSD); err != nil {
			continue
		}
		r.Day = ts.UTC().Format("2006-01-02")
		result = append(result, r)
	}
	return c.JSON(result)
}

// ── GET /models/usage/events ─────────────────────────────────────────────────

func (h *costHandler) events(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rangeParam := c.Query("range", "30d")
	interval := costInterval(rangeParam)

	limit := 200
	if raw := c.Query("limit", ""); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 1000 {
			limit = v
		}
	}

	rows, err := h.db.Query(`
		SELECT
			ul.id,
			ul.timestamp,
			COALESCE(ul.model, 'unknown')       AS model,
			COALESCE(ul.provider, 'unknown')    AS provider,
			COALESCE(ul.tokens_input, 0)        AS tokens_in,
			COALESCE(ul.tokens_output, 0)       AS tokens_out,
			COALESCE(ul.cost_usd, 0)            AS cost_usd,
			l.license_key
		FROM usage_log ul
		JOIN licenses l ON ul.license_id = l.id
		WHERE l.tenant_id = $1
		  AND ul.timestamp >= NOW() - INTERVAL '`+interval+`'
		ORDER BY ul.timestamp DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Cost] Events query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	type EventRow struct {
		ID         string  `json:"id"`
		Timestamp  string  `json:"timestamp"`
		Model      string  `json:"model"`
		Provider   string  `json:"provider"`
		TokensIn   int64   `json:"tokens_in"`
		TokensOut  int64   `json:"tokens_out"`
		CostUSD    float64 `json:"cost_usd"`
		LicenseKey string  `json:"license_key"`
	}

	result := make([]EventRow, 0, limit)
	for rows.Next() {
		var r EventRow
		var ts time.Time
		if err := rows.Scan(
			&r.ID, &ts, &r.Model, &r.Provider,
			&r.TokensIn, &r.TokensOut, &r.CostUSD, &r.LicenseKey,
		); err != nil {
			continue
		}
		r.Timestamp = ts.UTC().Format(time.RFC3339)
		result = append(result, r)
	}
	return c.JSON(result)
}
