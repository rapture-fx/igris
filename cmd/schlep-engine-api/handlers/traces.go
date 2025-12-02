// Package handlers provides HTTP handlers for request traces (Phase 14)
package handlers

import (
	"database/sql"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/internal/middleware"
)

// TracesHandler handles request trace operations
type TracesHandler struct {
	db     *sql.DB
	logger *log.Logger
}

// NewTracesHandler creates a new traces handler
func NewTracesHandler(db *sql.DB) *TracesHandler {
	return &TracesHandler{
		db:     db,
		logger: log.Default(),
	}
}

// RequestTrace represents a request trace
type RequestTrace struct {
	ID            string   `json:"id"`
	Timestamp     string   `json:"timestamp"`
	Model         string   `json:"model"`
	Provider      string   `json:"provider"`
	Status        int      `json:"status"`
	Latency       int64    `json:"latency"`
	Cost          float64  `json:"cost"`
	Tokens        Tokens   `json:"tokens"`
	RequestID     string   `json:"request_id"`
	TraceID       *string  `json:"trace_id,omitempty"`
	ErrorMessage  *string  `json:"error,omitempty"`
}

// Tokens represents token usage
type Tokens struct {
	Input  int `json:"input"`
	Output int `json:"output"`
	Total  int `json:"total"`
}

// ListTraces retrieves request traces for a tenant
// GET /v1/traces
func (th *TracesHandler) ListTraces(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	// Query parameters
	limit := c.QueryInt("limit", 100)
	offset := c.QueryInt("offset", 0)
	provider := c.Query("provider", "")
	status := c.Query("status", "")

	if limit > 1000 {
		limit = 1000 // Max 1000 traces
	}

	// Build query
	query := `
		SELECT
			log_id,
			created_at,
			model,
			provider,
			CASE status
				WHEN 'success' THEN 200
				WHEN 'error' THEN 500
				WHEN 'budget_exceeded' THEN 429
				WHEN 'rate_limited' THEN 429
				ELSE 500
			END as status_code,
			0 as latency_ms,
			cost_usd,
			COALESCE(input_tokens, 0) as input_tokens,
			COALESCE(output_tokens, 0) as output_tokens,
			COALESCE(total_tokens, 0) as total_tokens,
			request_id,
			trace_id,
			error_message
		FROM tenant_request_log
		WHERE tenant_id = $1
	`

	args := []interface{}{tenantID}
	argIndex := 2

	if provider != "" {
		query += " AND provider = $" + itoa(argIndex)
		args = append(args, provider)
		argIndex++
	}

	if status != "" {
		query += " AND status = $" + itoa(argIndex)
		args = append(args, status)
		argIndex++
	}

	query += " ORDER BY created_at DESC LIMIT $" + itoa(argIndex)
	args = append(args, limit)
	argIndex++

	query += " OFFSET $" + itoa(argIndex)
	args = append(args, offset)

	rows, err := th.db.Query(query, args...)
	if err != nil {
		th.logger.Printf("[TracesHandler] Failed to query traces: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve traces",
			"code":  "QUERY_FAILED",
		})
	}
	defer rows.Close()

	var traces []RequestTrace
	for rows.Next() {
		var trace RequestTrace
		var createdAt time.Time
		var traceID, errorMsg sql.NullString
		var latencyMs int64
		var inputTokens, outputTokens, totalTokens int

		err := rows.Scan(
			&trace.ID,
			&createdAt,
			&trace.Model,
			&trace.Provider,
			&trace.Status,
			&latencyMs,
			&trace.Cost,
			&inputTokens,
			&outputTokens,
			&totalTokens,
			&trace.RequestID,
			&traceID,
			&errorMsg,
		)

		if err != nil {
			th.logger.Printf("[TracesHandler] Error scanning trace: %v", err)
			continue
		}

		trace.Timestamp = createdAt.Format(time.RFC3339)
		trace.Latency = latencyMs
		trace.Tokens = Tokens{
			Input:  inputTokens,
			Output: outputTokens,
			Total:  totalTokens,
		}

		if traceID.Valid {
			trace.TraceID = &traceID.String
		}
		if errorMsg.Valid {
			trace.ErrorMessage = &errorMsg.String
		}

		traces = append(traces, trace)
	}

	if traces == nil {
		traces = []RequestTrace{}
	}

	// Get total count
	var total int
	countQuery := "SELECT COUNT(*) FROM tenant_request_log WHERE tenant_id = $1"
	th.db.QueryRow(countQuery, tenantID).Scan(&total)

	return c.JSON(fiber.Map{
		"traces": traces,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetTraceSummary retrieves summary statistics for traces
// GET /v1/traces/summary
func (th *TracesHandler) GetTraceSummary(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	query := `
		SELECT
			COUNT(*) as total_requests,
			COALESCE(SUM(cost_usd), 0) as total_cost,
			COALESCE(AVG(CASE WHEN status = 'success' THEN cost_usd END), 0) as avg_cost,
			COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
			COUNT(CASE WHEN status != 'success' THEN 1 END) as error_count
		FROM tenant_request_log
		WHERE tenant_id = $1
			AND created_at >= NOW() - INTERVAL '24 hours'
	`

	var totalRequests, successCount, errorCount int64
	var totalCost, avgCost float64

	err := th.db.QueryRow(query, tenantID).Scan(
		&totalRequests,
		&totalCost,
		&avgCost,
		&successCount,
		&errorCount,
	)

	if err != nil {
		th.logger.Printf("[TracesHandler] Failed to get summary: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve summary",
			"code":  "QUERY_FAILED",
		})
	}

	return c.JSON(fiber.Map{
		"total_requests": totalRequests,
		"monthly_spend":  totalCost,
		"avg_latency":    0, // TODO: Add latency tracking
		"success_count":  successCount,
		"error_count":    errorCount,
	})
}
