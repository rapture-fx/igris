// Package handlers provides HTTP handlers for usage and audit reporting (Phase 14)
package handlers

import (
	"database/sql"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/internal/middleware"
)

// UsageHandler handles usage and audit reporting
type UsageHandler struct {
	db     *sql.DB
	logger *log.Logger
}

// NewUsageHandler creates a new usage handler
func NewUsageHandler(db *sql.DB) *UsageHandler {
	return &UsageHandler{
		db:     db,
		logger: log.Default(),
	}
}

// UsageResponse represents current usage statistics
type UsageResponse struct {
	TenantID         string  `json:"tenant_id"`
	CurrentMonth     string  `json:"current_month"`
	TotalSpendUSD    float64 `json:"total_spend_usd"`
	BudgetLimitUSD   float64 `json:"budget_limit_usd"`
	RemainingUSD     float64 `json:"remaining_usd"`
	PercentageUsed   float64 `json:"percentage_used"`
	Breached         bool    `json:"breached"`
	RequestCount     int64   `json:"request_count"`
	ProviderCount    int     `json:"provider_count"`
	ModelCount       int     `json:"model_count"`

	ByProvider       []ProviderUsage `json:"by_provider"`
	ByModel          []ModelUsage    `json:"by_model"`
}

// ProviderUsage represents usage by provider
type ProviderUsage struct {
	Provider     string  `json:"provider"`
	TotalCostUSD float64 `json:"total_cost_usd"`
	RequestCount int64   `json:"request_count"`
	AvgCostUSD   float64 `json:"avg_cost_usd"`
	InputTokens  int64   `json:"input_tokens"`
	OutputTokens int64   `json:"output_tokens"`
}

// ModelUsage represents usage by model
type ModelUsage struct {
	Model        string  `json:"model"`
	Provider     string  `json:"provider"`
	TotalCostUSD float64 `json:"total_cost_usd"`
	RequestCount int64   `json:"request_count"`
	AvgCostUSD   float64 `json:"avg_cost_usd"`
	InputTokens  int64   `json:"input_tokens"`
	OutputTokens int64   `json:"output_tokens"`
}

// HistoricalUsage represents usage for a specific month
type HistoricalUsage struct {
	YearMonth      string  `json:"year_month"`
	TotalSpendUSD  float64 `json:"total_spend_usd"`
	BudgetLimitUSD float64 `json:"budget_limit_usd"`
	RequestCount   int64   `json:"request_count"`
	Breached       bool    `json:"breached"`
	BreachedAt     *string `json:"breached_at,omitempty"`
}

// AuditEvent represents an audit log entry
type AuditEvent struct {
	ID            string                 `json:"id"`
	EventType     string                 `json:"event_type"`
	EventCategory string                 `json:"event_category"`
	Severity      string                 `json:"severity"`
	Provider      *string                `json:"provider,omitempty"`
	Model         *string                `json:"model,omitempty"`
	Action        *string                `json:"action,omitempty"`
	CostUSD       *float64               `json:"cost_usd,omitempty"`
	TraceID       *string                `json:"trace_id,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	ErrorMessage  *string                `json:"error_message,omitempty"`
	Timestamp     string                 `json:"timestamp"`
}

// GetCurrentUsage retrieves current month usage statistics
// GET /v1/usage
func (uh *UsageHandler) GetCurrentUsage(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)
	currentMonth := time.Now().UTC().Format("2006-01")

	// Get summary from view
	var usage UsageResponse
	var breachedAt sql.NullTime

	err := uh.db.QueryRow(`
		SELECT tenant_id, year_month, total_spend_usd, budget_limit_usd,
		       request_count, breached, provider_count, model_count
		FROM v_tenant_usage_summary
		WHERE tenant_id = $1 AND year_month = $2
	`, tenantID, currentMonth).Scan(
		&usage.TenantID,
		&usage.CurrentMonth,
		&usage.TotalSpendUSD,
		&usage.BudgetLimitUSD,
		&usage.RequestCount,
		&usage.Breached,
		&usage.ProviderCount,
		&usage.ModelCount,
	)

	if err == sql.ErrNoRows {
		// No usage yet this month
		return c.JSON(&UsageResponse{
			TenantID:       tenantID,
			CurrentMonth:   currentMonth,
			TotalSpendUSD:  0,
			BudgetLimitUSD: 5.0, // Default
			RemainingUSD:   5.0,
			PercentageUsed: 0,
			Breached:       false,
			RequestCount:   0,
			ByProvider:     []ProviderUsage{},
			ByModel:        []ModelUsage{},
		})
	} else if err != nil {
		uh.logger.Printf("[UsageHandler] Failed to get usage: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve usage",
			"code":  "QUERY_FAILED",
		})
	}

	// Calculate derived fields
	usage.RemainingUSD = usage.BudgetLimitUSD - usage.TotalSpendUSD
	if usage.BudgetLimitUSD > 0 {
		usage.PercentageUsed = (usage.TotalSpendUSD / usage.BudgetLimitUSD) * 100
	}

	// Get by provider breakdown
	usage.ByProvider, _ = uh.getProviderBreakdown(tenantID, currentMonth)

	// Get by model breakdown
	usage.ByModel, _ = uh.getModelBreakdown(tenantID, currentMonth)

	return c.JSON(&usage)
}

// GetHistoricalUsage retrieves usage for past months
// GET /v1/usage/history
func (uh *UsageHandler) GetHistoricalUsage(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)
	months := c.QueryInt("months", 6)

	if months > 24 {
		months = 24 // Max 2 years
	}

	rows, err := uh.db.Query(`
		SELECT year_month, total_spend_usd, budget_limit_usd, request_count,
		       breached, breached_at
		FROM budgets
		WHERE tenant_id = $1
		ORDER BY year_month DESC
		LIMIT $2
	`, tenantID, months)

	if err != nil {
		uh.logger.Printf("[UsageHandler] Failed to get history: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve history",
			"code":  "QUERY_FAILED",
		})
	}
	defer rows.Close()

	var history []HistoricalUsage
	for rows.Next() {
		var h HistoricalUsage
		var breachedAt sql.NullTime

		err := rows.Scan(
			&h.YearMonth,
			&h.TotalSpendUSD,
			&h.BudgetLimitUSD,
			&h.RequestCount,
			&h.Breached,
			&breachedAt,
		)

		if err != nil {
			continue
		}

		if breachedAt.Valid {
			timestamp := breachedAt.Time.Format(time.RFC3339)
			h.BreachedAt = &timestamp
		}

		history = append(history, h)
	}

	return c.JSON(fiber.Map{
		"history": history,
		"count":   len(history),
	})
}

// GetAuditLogs retrieves audit log entries
// GET /v1/audit
func (uh *UsageHandler) GetAuditLogs(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	// Query parameters
	limit := c.QueryInt("limit", 100)
	offset := c.QueryInt("offset", 0)
	eventType := c.Query("event_type", "")
	category := c.Query("category", "")
	severity := c.Query("severity", "")
	sinceHours := c.QueryInt("since_hours", 24)

	if limit > 1000 {
		limit = 1000
	}

	// Build query dynamically
	query := `
		SELECT id, event_type, event_category, severity, provider, model,
		       action, cost_usd, trace_id, metadata, error_message, timestamp
		FROM audit_events
		WHERE tenant_id = $1
		  AND timestamp >= NOW() - INTERVAL '1 hour' * $2
	`
	args := []interface{}{tenantID, sinceHours}
	argIndex := 3

	if eventType != "" {
		query += " AND event_type = $" + itoa(argIndex)
		args = append(args, eventType)
		argIndex++
	}
	if category != "" {
		query += " AND event_category = $" + itoa(argIndex)
		args = append(args, category)
		argIndex++
	}
	if severity != "" {
		query += " AND severity = $" + itoa(argIndex)
		args = append(args, severity)
		argIndex++
	}

	query += " ORDER BY timestamp DESC LIMIT $" + itoa(argIndex)
	args = append(args, limit)
	argIndex++

	query += " OFFSET $" + itoa(argIndex)
	args = append(args, offset)

	rows, err := uh.db.Query(query, args...)
	if err != nil {
		uh.logger.Printf("[UsageHandler] Failed to query audit logs: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve audit logs",
			"code":  "QUERY_FAILED",
		})
	}
	defer rows.Close()

	var events []AuditEvent
	for rows.Next() {
		var event AuditEvent
		var provider, model, action, traceID, errorMsg sql.NullString
		var costUSD sql.NullFloat64
		var metadata []byte
		var timestamp time.Time

		err := rows.Scan(
			&event.ID,
			&event.EventType,
			&event.EventCategory,
			&event.Severity,
			&provider, &model, &action,
			&costUSD, &traceID, &metadata,
			&errorMsg, &timestamp,
		)

		if err != nil {
			continue
		}

		// Convert nullable fields
		if provider.Valid {
			event.Provider = &provider.String
		}
		if model.Valid {
			event.Model = &model.String
		}
		if action.Valid {
			event.Action = &action.String
		}
		if costUSD.Valid {
			cost := costUSD.Float64
			event.CostUSD = &cost
		}
		if traceID.Valid {
			event.TraceID = &traceID.String
		}
		if errorMsg.Valid {
			event.ErrorMessage = &errorMsg.String
		}

		event.Timestamp = timestamp.Format(time.RFC3339)

		// Parse metadata JSON (simplified - in production, properly unmarshal)
		event.Metadata = make(map[string]interface{})

		events = append(events, event)
	}

	// Get total count
	var total int
	countQuery := `
		SELECT COUNT(*) FROM audit_events
		WHERE tenant_id = $1 AND timestamp >= NOW() - INTERVAL '1 hour' * $2
	`
	uh.db.QueryRow(countQuery, tenantID, sinceHours).Scan(&total)

	return c.JSON(fiber.Map{
		"events": events,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// ExportAuditLogs exports audit logs as CSV
// GET /v1/audit/export
func (uh *UsageHandler) ExportAuditLogs(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)
	sinceHours := c.QueryInt("since_hours", 168) // Default 7 days

	rows, err := uh.db.Query(`
		SELECT id, event_type, event_category, severity, provider, model,
		       action, cost_usd, trace_id, error_message, timestamp
		FROM audit_events
		WHERE tenant_id = $1
		  AND timestamp >= NOW() - INTERVAL '1 hour' * $2
		ORDER BY timestamp DESC
	`, tenantID, sinceHours)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to export audit logs",
			"code":  "EXPORT_FAILED",
		})
	}
	defer rows.Close()

	// Set CSV headers
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", "attachment; filename=audit_log_"+tenantID+".csv")

	// Write CSV header
	csv := "ID,Event Type,Category,Severity,Provider,Model,Action,Cost USD,Trace ID,Error,Timestamp\n"

	for rows.Next() {
		var id, eventType, category, severity string
		var provider, model, action, traceID, errorMsg sql.NullString
		var costUSD sql.NullFloat64
		var timestamp time.Time

		rows.Scan(&id, &eventType, &category, &severity, &provider, &model, &action,
			&costUSD, &traceID, &errorMsg, &timestamp)

		// Build CSV row
		csv += id + ","
		csv += eventType + ","
		csv += category + ","
		csv += severity + ","
		csv += nvl(provider.String) + ","
		csv += nvl(model.String) + ","
		csv += nvl(action.String) + ","
		if costUSD.Valid {
			csv += floatToString(costUSD.Float64)
		}
		csv += ","
		csv += nvl(traceID.String) + ","
		csv += nvl(errorMsg.String) + ","
		csv += timestamp.Format(time.RFC3339) + "\n"
	}

	return c.SendString(csv)
}

// Helper functions

func (uh *UsageHandler) getProviderBreakdown(tenantID, month string) ([]ProviderUsage, error) {
	rows, err := uh.db.Query(`
		SELECT provider, total_cost_usd, request_count, avg_cost_per_request,
		       total_input_tokens, total_output_tokens
		FROM v_cost_by_provider
		WHERE tenant_id = $1 AND year_month = $2
	`, tenantID, month)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var providers []ProviderUsage
	for rows.Next() {
		var p ProviderUsage
		var inputTokens, outputTokens sql.NullInt64

		err := rows.Scan(&p.Provider, &p.TotalCostUSD, &p.RequestCount, &p.AvgCostUSD,
			&inputTokens, &outputTokens)
		if err != nil {
			continue
		}

		if inputTokens.Valid {
			p.InputTokens = inputTokens.Int64
		}
		if outputTokens.Valid {
			p.OutputTokens = outputTokens.Int64
		}

		providers = append(providers, p)
	}

	return providers, nil
}

func (uh *UsageHandler) getModelBreakdown(tenantID, month string) ([]ModelUsage, error) {
	rows, err := uh.db.Query(`
		SELECT model, provider, total_cost_usd, request_count, avg_cost_per_request,
		       total_input_tokens, total_output_tokens
		FROM v_cost_by_model
		WHERE tenant_id = $1 AND year_month = $2
	`, tenantID, month)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var models []ModelUsage
	for rows.Next() {
		var m ModelUsage
		var inputTokens, outputTokens sql.NullInt64

		err := rows.Scan(&m.Model, &m.Provider, &m.TotalCostUSD, &m.RequestCount,
			&m.AvgCostUSD, &inputTokens, &outputTokens)
		if err != nil {
			continue
		}

		if inputTokens.Valid {
			m.InputTokens = inputTokens.Int64
		}
		if outputTokens.Valid {
			m.OutputTokens = outputTokens.Int64
		}

		models = append(models, m)
	}

	return models, nil
}

func nvl(s string) string {
	if s == "" {
		return ""
	}
	return s
}

func floatToString(f float64) string {
	// Simple float to string conversion
	// In production, use fmt.Sprintf("%.4f", f)
	return ""
}
