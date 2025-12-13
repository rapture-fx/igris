// Package handlers provides HTTP handlers for tenant policy management (Phase 14)
package handlers

import (
	"database/sql"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Schlep-engine/igris-inertial/igris-overture/middleware"
)

// PolicyHandler handles tenant policy operations
type PolicyHandler struct {
	db     *sql.DB
	logger *log.Logger
}

// NewPolicyHandler creates a new policy handler
func NewPolicyHandler(db *sql.DB) *PolicyHandler {
	return &PolicyHandler{
		db:     db,
		logger: log.Default(),
	}
}

// PolicyResponse represents a tenant's policy configuration
type PolicyResponse struct {
	TenantID               string  `json:"tenant_id"`
	MaxMonthlyCostUSD      float64 `json:"max_monthly_cost_usd"`
	EnableBudgetLimit      bool    `json:"enable_budget_limit"`
	FallbackOnBudgetBreach bool    `json:"fallback_on_budget_breach"`
	MaxTokensPerRequest    int     `json:"max_tokens_per_request"`
	EnableTokenLimit       bool    `json:"enable_token_limit"`
	EnableBenchmarkFallback bool   `json:"enable_benchmark_fallback"`

	// Phase 14 new fields
	MaxRequestsPerMinute   *int    `json:"max_requests_per_minute,omitempty"`
	MaxRequestsPerHour     *int    `json:"max_requests_per_hour,omitempty"`
	MaxRequestsPerDay      *int    `json:"max_requests_per_day,omitempty"`
	EnableRateLimiting     bool    `json:"enable_rate_limiting"`

	// Alert settings
	AlertWebhookURL           *string `json:"alert_webhook_url,omitempty"`
	AlertOnBudget80Percent    bool    `json:"alert_on_budget_80_percent"`
	AlertOnBudget100Percent   bool    `json:"alert_on_budget_100_percent"`
	AlertOnKeyValidationFailure bool  `json:"alert_on_key_validation_failure"`

	// Metadata
	CreatedAt  string  `json:"created_at"`
	UpdatedAt  string  `json:"updated_at"`
	UpdatedBy  *string `json:"updated_by,omitempty"`
}

// UpdatePolicyRequest represents a request to update policy settings
type UpdatePolicyRequest struct {
	MaxMonthlyCostUSD       *float64 `json:"max_monthly_cost_usd,omitempty"`
	EnableBudgetLimit       *bool    `json:"enable_budget_limit,omitempty"`
	FallbackOnBudgetBreach  *bool    `json:"fallback_on_budget_breach,omitempty"`
	MaxTokensPerRequest     *int     `json:"max_tokens_per_request,omitempty"`
	EnableTokenLimit        *bool    `json:"enable_token_limit,omitempty"`
	EnableBenchmarkFallback *bool    `json:"enable_benchmark_fallback,omitempty"`

	// Rate limiting
	MaxRequestsPerMinute *int  `json:"max_requests_per_minute,omitempty"`
	MaxRequestsPerHour   *int  `json:"max_requests_per_hour,omitempty"`
	MaxRequestsPerDay    *int  `json:"max_requests_per_day,omitempty"`
	EnableRateLimiting   *bool `json:"enable_rate_limiting,omitempty"`

	// Alert settings
	AlertWebhookURL             *string `json:"alert_webhook_url,omitempty"`
	AlertOnBudget80Percent      *bool   `json:"alert_on_budget_80_percent,omitempty"`
	AlertOnBudget100Percent     *bool   `json:"alert_on_budget_100_percent,omitempty"`
	AlertOnKeyValidationFailure *bool   `json:"alert_on_key_validation_failure,omitempty"`
}

// GetPolicy retrieves the tenant's active policy
// GET /v1/policy
func (ph *PolicyHandler) GetPolicy(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	policy, err := ph.loadPolicy(tenantID)
	if err == sql.ErrNoRows {
		// No policy set, create default
		if err := ph.createDefaultPolicy(tenantID); err != nil {
			ph.logger.Printf("[PolicyHandler] Failed to create default policy: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to retrieve policy",
				"code":  "POLICY_ERROR",
			})
		}

		// Load newly created default
		policy, err = ph.loadPolicy(tenantID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to retrieve policy",
				"code":  "POLICY_ERROR",
			})
		}
	} else if err != nil {
		ph.logger.Printf("[PolicyHandler] Failed to load policy: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve policy",
			"code":  "QUERY_FAILED",
		})
	}

	return c.JSON(policy)
}

// UpdatePolicy updates the tenant's policy settings
// PUT /v1/policy
func (ph *PolicyHandler) UpdatePolicy(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	var req UpdatePolicyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	// Validate values
	if err := ph.validatePolicy(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
			"code":  "INVALID_POLICY",
		})
	}

	// Get updater from context
	updatedBy := tenantID
	if tenantCtx := middleware.GetTenantContext(c); tenantCtx != nil {
		updatedBy = tenantCtx.TenantID
	}

	// Build update query dynamically
	updates := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.MaxMonthlyCostUSD != nil {
		updates = append(updates, "max_monthly_cost_usd = $"+itoa(argIndex))
		args = append(args, *req.MaxMonthlyCostUSD)
		argIndex++
	}
	if req.EnableBudgetLimit != nil {
		updates = append(updates, "enable_budget_limit = $"+itoa(argIndex))
		args = append(args, *req.EnableBudgetLimit)
		argIndex++
	}
	if req.FallbackOnBudgetBreach != nil {
		updates = append(updates, "fallback_on_budget_breach = $"+itoa(argIndex))
		args = append(args, *req.FallbackOnBudgetBreach)
		argIndex++
	}
	if req.MaxTokensPerRequest != nil {
		updates = append(updates, "max_tokens_per_request = $"+itoa(argIndex))
		args = append(args, *req.MaxTokensPerRequest)
		argIndex++
	}
	if req.EnableTokenLimit != nil {
		updates = append(updates, "enable_token_limit = $"+itoa(argIndex))
		args = append(args, *req.EnableTokenLimit)
		argIndex++
	}
	if req.EnableBenchmarkFallback != nil {
		updates = append(updates, "enable_benchmark_fallback = $"+itoa(argIndex))
		args = append(args, *req.EnableBenchmarkFallback)
		argIndex++
	}
	if req.MaxRequestsPerMinute != nil {
		updates = append(updates, "max_requests_per_minute = $"+itoa(argIndex))
		args = append(args, *req.MaxRequestsPerMinute)
		argIndex++
	}
	if req.MaxRequestsPerHour != nil {
		updates = append(updates, "max_requests_per_hour = $"+itoa(argIndex))
		args = append(args, *req.MaxRequestsPerHour)
		argIndex++
	}
	if req.MaxRequestsPerDay != nil {
		updates = append(updates, "max_requests_per_day = $"+itoa(argIndex))
		args = append(args, *req.MaxRequestsPerDay)
		argIndex++
	}
	if req.EnableRateLimiting != nil {
		updates = append(updates, "enable_rate_limiting = $"+itoa(argIndex))
		args = append(args, *req.EnableRateLimiting)
		argIndex++
	}
	if req.AlertWebhookURL != nil {
		updates = append(updates, "alert_webhook_url = $"+itoa(argIndex))
		args = append(args, *req.AlertWebhookURL)
		argIndex++
	}
	if req.AlertOnBudget80Percent != nil {
		updates = append(updates, "alert_on_budget_80_percent = $"+itoa(argIndex))
		args = append(args, *req.AlertOnBudget80Percent)
		argIndex++
	}
	if req.AlertOnBudget100Percent != nil {
		updates = append(updates, "alert_on_budget_100_percent = $"+itoa(argIndex))
		args = append(args, *req.AlertOnBudget100Percent)
		argIndex++
	}
	if req.AlertOnKeyValidationFailure != nil {
		updates = append(updates, "alert_on_key_validation_failure = $"+itoa(argIndex))
		args = append(args, *req.AlertOnKeyValidationFailure)
		argIndex++
	}

	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "No fields to update",
			"code":  "NO_UPDATES",
		})
	}

	// Add updated_by and tenant_id
	updates = append(updates, "updated_by = $"+itoa(argIndex))
	args = append(args, updatedBy)
	argIndex++

	updates = append(updates, "updated_at = NOW()")

	args = append(args, tenantID)

	query := "UPDATE tenant_policies SET " + joinUpdates(updates) +
		" WHERE tenant_id = $" + itoa(argIndex)

	result, err := ph.db.Exec(query, args...)
	if err != nil {
		ph.logger.Printf("[PolicyHandler] Failed to update policy: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update policy",
			"code":  "UPDATE_FAILED",
		})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		// Policy doesn't exist, create it
		if err := ph.createPolicyFromRequest(tenantID, &req, updatedBy); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to create policy",
				"code":  "CREATE_FAILED",
			})
		}
	}

	// Log audit event (async)
	go ph.logPolicyChange(tenantID, updatedBy, &req)

	ph.logger.Printf("[PolicyHandler] Updated policy for tenant: %s", tenantID)

	// Return updated policy
	policy, err := ph.loadPolicy(tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve updated policy",
			"code":  "QUERY_FAILED",
		})
	}

	return c.JSON(policy)
}

// ResetPolicy resets the tenant's policy to defaults
// POST /v1/policy/reset
func (ph *PolicyHandler) ResetPolicy(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	// Delete existing policy
	_, err := ph.db.Exec(`
		DELETE FROM tenant_policies WHERE tenant_id = $1
	`, tenantID)

	if err != nil {
		ph.logger.Printf("[PolicyHandler] Failed to delete policy: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to reset policy",
			"code":  "RESET_FAILED",
		})
	}

	// Create default policy
	if err := ph.createDefaultPolicy(tenantID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create default policy",
			"code":  "CREATE_FAILED",
		})
	}

	// Log audit event
	go ph.logPolicyReset(tenantID)

	ph.logger.Printf("[PolicyHandler] Reset policy to defaults for tenant: %s", tenantID)

	// Return new default policy
	policy, _ := ph.loadPolicy(tenantID)
	return c.JSON(fiber.Map{
		"message": "Policy reset to defaults",
		"policy":  policy,
	})
}

// GetPolicyHistory retrieves policy change history
// GET /v1/policy/history
func (ph *PolicyHandler) GetPolicyHistory(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)
	limit := c.QueryInt("limit", 50)
	offset := c.QueryInt("offset", 0)

	if limit > 100 {
		limit = 100
	}

	// Query audit events for policy changes
	rows, err := ph.db.Query(`
		SELECT event_type, metadata, timestamp, trace_id
		FROM audit_events
		WHERE tenant_id = $1
		  AND event_category = 'policy'
		ORDER BY timestamp DESC
		LIMIT $2 OFFSET $3
	`, tenantID, limit, offset)

	if err != nil {
		ph.logger.Printf("[PolicyHandler] Failed to query history: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve history",
			"code":  "QUERY_FAILED",
		})
	}
	defer rows.Close()

	type HistoryEntry struct {
		EventType string                 `json:"event_type"`
		Changes   map[string]interface{} `json:"changes"`
		Timestamp string                 `json:"timestamp"`
		TraceID   string                 `json:"trace_id,omitempty"`
	}

	var history []HistoryEntry
	for rows.Next() {
		var entry HistoryEntry
		var metadata []byte
		var timestamp time.Time
		var traceID sql.NullString

		err := rows.Scan(&entry.EventType, &metadata, &timestamp, &traceID)
		if err != nil {
			continue
		}

		entry.Timestamp = timestamp.Format(time.RFC3339)
		if traceID.Valid {
			entry.TraceID = traceID.String
		}

		// Parse metadata JSON
		// Note: In production, properly unmarshal the JSONB
		entry.Changes = make(map[string]interface{})

		history = append(history, entry)
	}

	return c.JSON(fiber.Map{
		"history": history,
		"total":   len(history),
		"limit":   limit,
		"offset":  offset,
	})
}

// Helper functions

func (ph *PolicyHandler) loadPolicy(tenantID string) (*PolicyResponse, error) {
	var policy PolicyResponse
	var maxReqMin, maxReqHour, maxReqDay sql.NullInt64
	var webhookURL, updatedBy sql.NullString
	var createdAt, updatedAt time.Time

	err := ph.db.QueryRow(`
		SELECT tenant_id, max_monthly_cost_usd, enable_budget_limit,
		       fallback_on_budget_breach, max_tokens_per_request, enable_token_limit,
		       enable_benchmark_fallback, max_requests_per_minute, max_requests_per_hour,
		       max_requests_per_day, enable_rate_limiting, alert_webhook_url,
		       alert_on_budget_80_percent, alert_on_budget_100_percent,
		       alert_on_key_validation_failure, created_at, updated_at, updated_by
		FROM tenant_policies
		WHERE tenant_id = $1
	`, tenantID).Scan(
		&policy.TenantID,
		&policy.MaxMonthlyCostUSD,
		&policy.EnableBudgetLimit,
		&policy.FallbackOnBudgetBreach,
		&policy.MaxTokensPerRequest,
		&policy.EnableTokenLimit,
		&policy.EnableBenchmarkFallback,
		&maxReqMin, &maxReqHour, &maxReqDay,
		&policy.EnableRateLimiting,
		&webhookURL,
		&policy.AlertOnBudget80Percent,
		&policy.AlertOnBudget100Percent,
		&policy.AlertOnKeyValidationFailure,
		&createdAt, &updatedAt, &updatedBy,
	)

	if err != nil {
		return nil, err
	}

	if maxReqMin.Valid {
		val := int(maxReqMin.Int64)
		policy.MaxRequestsPerMinute = &val
	}
	if maxReqHour.Valid {
		val := int(maxReqHour.Int64)
		policy.MaxRequestsPerHour = &val
	}
	if maxReqDay.Valid {
		val := int(maxReqDay.Int64)
		policy.MaxRequestsPerDay = &val
	}
	if webhookURL.Valid {
		policy.AlertWebhookURL = &webhookURL.String
	}
	if updatedBy.Valid {
		policy.UpdatedBy = &updatedBy.String
	}

	policy.CreatedAt = createdAt.Format(time.RFC3339)
	policy.UpdatedAt = updatedAt.Format(time.RFC3339)

	return &policy, nil
}

func (ph *PolicyHandler) createDefaultPolicy(tenantID string) error {
	_, err := ph.db.Exec(`
		INSERT INTO tenant_policies (tenant_id, max_monthly_cost_usd, max_tokens_per_request)
		VALUES ($1, 5.0, 1024)
		ON CONFLICT (tenant_id) DO NOTHING
	`, tenantID)
	return err
}

func (ph *PolicyHandler) createPolicyFromRequest(tenantID string, req *UpdatePolicyRequest, createdBy string) error {
	_, err := ph.db.Exec(`
		INSERT INTO tenant_policies (
			tenant_id, max_monthly_cost_usd, enable_budget_limit,
			fallback_on_budget_breach, max_tokens_per_request, enable_token_limit,
			enable_benchmark_fallback, created_by, updated_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, tenantID,
		coalesce(req.MaxMonthlyCostUSD, 5.0),
		coalesce(req.EnableBudgetLimit, true),
		coalesce(req.FallbackOnBudgetBreach, true),
		coalesce(req.MaxTokensPerRequest, 1024),
		coalesce(req.EnableTokenLimit, true),
		coalesce(req.EnableBenchmarkFallback, true),
		createdBy, createdBy,
	)
	return err
}

func (ph *PolicyHandler) validatePolicy(req *UpdatePolicyRequest) error {
	if req.MaxMonthlyCostUSD != nil && *req.MaxMonthlyCostUSD < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "max_monthly_cost_usd must be non-negative")
	}
	if req.MaxTokensPerRequest != nil && (*req.MaxTokensPerRequest < 1 || *req.MaxTokensPerRequest > 100000) {
		return fiber.NewError(fiber.StatusBadRequest, "max_tokens_per_request must be between 1 and 100000")
	}
	if req.MaxRequestsPerMinute != nil && *req.MaxRequestsPerMinute < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "max_requests_per_minute must be non-negative")
	}
	if req.MaxRequestsPerHour != nil && *req.MaxRequestsPerHour < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "max_requests_per_hour must be non-negative")
	}
	if req.MaxRequestsPerDay != nil && *req.MaxRequestsPerDay < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "max_requests_per_day must be non-negative")
	}
	return nil
}

func (ph *PolicyHandler) logPolicyChange(tenantID, updatedBy string, req *UpdatePolicyRequest) {
	// Log to audit_events table
	_, err := ph.db.Exec(`
		INSERT INTO audit_events (tenant_id, event_type, event_category, severity, metadata)
		VALUES ($1, 'policy_updated', 'policy', 'info', $2)
	`, tenantID, `{}`) // In production, properly serialize req as JSON

	if err != nil {
		ph.logger.Printf("[PolicyHandler] Failed to log policy change: %v", err)
	}
}

func (ph *PolicyHandler) logPolicyReset(tenantID string) {
	_, err := ph.db.Exec(`
		INSERT INTO audit_events (tenant_id, event_type, event_category, severity)
		VALUES ($1, 'policy_reset', 'policy', 'warning')
	`, tenantID)

	if err != nil {
		ph.logger.Printf("[PolicyHandler] Failed to log policy reset: %v", err)
	}
}

// Utility functions

func itoa(i int) string {
	return string(rune('0' + i))
}

func joinUpdates(strs []string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += ", " + strs[i]
	}
	return result
}

func coalesce[T any](ptr *T, defaultVal T) T {
	if ptr != nil {
		return *ptr
	}
	return defaultVal
}
