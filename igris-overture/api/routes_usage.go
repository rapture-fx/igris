// Package api provides usage tracking API routes
package api

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// UsageHandler handles usage tracking API requests
type UsageHandler struct {
	db *sql.DB
}

// NewUsageHandler creates a new usage handler
func NewUsageHandler(db *sql.DB) *UsageHandler {
	return &UsageHandler{db: db}
}

// RegisterUsageRoutes registers usage tracking API routes
func RegisterUsageRoutes(app *fiber.App, db *sql.DB) {
	handler := NewUsageHandler(db)

	// v1 API routes (internal, called by Overture routing)
	v1 := app.Group("/api/v1/usage")

	// Log usage endpoint
	v1.Post("/log", handler.LogUsage)

	log.Info().Msg("[Routes] ✓ Registered usage tracking endpoints (/api/v1/usage)")
}

// LogUsageRequest represents a usage logging request
type LogUsageRequest struct {
	LicenseKey   string  `json:"license_key" validate:"required"`
	RequestType  string  `json:"request_type" validate:"required"` // 'cloud' or 'edge'
	Provider     string  `json:"provider"`                        // 'openai', 'anthropic', etc.
	Model        string  `json:"model"`                           // 'gpt-4', 'claude-3-opus', etc.
	TokensInput  int     `json:"tokens_input"`
	TokensOutput int     `json:"tokens_output"`
	CostUSD      float64 `json:"cost_usd"`
	Metadata     string  `json:"metadata"` // JSON string for additional data
}

// LogUsageResponse represents a usage logging response
type LogUsageResponse struct {
	Logged              bool   `json:"logged"`
	UsageID             string `json:"usage_id,omitempty"`
	CloudRequestsUsed   int    `json:"cloud_requests_used"`
	CloudRequestsLimit  int    `json:"cloud_requests_limit"`
	QuotaExceeded       bool   `json:"quota_exceeded"`
	Error               string `json:"error,omitempty"`
	Message             string `json:"message,omitempty"`
}

// LogUsage handles POST /api/v1/usage/log
func (h *UsageHandler) LogUsage(c *fiber.Ctx) error {
	var req LogUsageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(LogUsageResponse{
			Logged:  false,
			Error:   "invalid_request",
			Message: "Failed to parse request body",
		})
	}

	// Validate required fields
	if req.LicenseKey == "" || req.RequestType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(LogUsageResponse{
			Logged:  false,
			Error:   "missing_fields",
			Message: "license_key and request_type are required",
		})
	}

	// Look up license ID from license key
	var licenseID string
	var tier string
	err := h.db.QueryRow(`
		SELECT id, tier
		FROM licenses
		WHERE license_key = $1 AND status = 'active'
	`, req.LicenseKey).Scan(&licenseID, &tier)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusForbidden).JSON(LogUsageResponse{
			Logged:  false,
			Error:   "invalid_license",
			Message: "License not found or inactive",
		})
	}

	if err != nil {
		log.Error().Err(err).Str("license_key", maskLicenseKey(req.LicenseKey)).Msg("[Usage] Failed to lookup license")
		return c.Status(fiber.StatusInternalServerError).JSON(LogUsageResponse{
			Logged:  false,
			Error:   "internal_error",
			Message: "Failed to log usage",
		})
	}

	// Insert usage log entry
	usageID := uuid.New().String()
	_, err = h.db.Exec(`
		INSERT INTO usage_log (id, license_id, request_type, provider, model, tokens_input, tokens_output, cost_usd, timestamp, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9::jsonb)
	`, usageID, licenseID, req.RequestType, req.Provider, req.Model, req.TokensInput, req.TokensOutput, req.CostUSD, req.Metadata)

	if err != nil {
		log.Error().Err(err).Str("license_id", licenseID).Msg("[Usage] Failed to insert usage log")
		return c.Status(fiber.StatusInternalServerError).JSON(LogUsageResponse{
			Logged:  false,
			Error:   "internal_error",
			Message: "Failed to log usage",
		})
	}

	// Get updated usage count and quota
	var cloudRequestsUsed int
	var cloudRequestsLimit int

	h.db.QueryRow(`
		SELECT
			COALESCE(get_monthly_cloud_requests($1), 0),
			CASE
				WHEN $2 = 'seed' THEN 50000
				WHEN $2 = 'horizon' THEN 500000
				WHEN $2 = 'infinite' THEN 2000000
				WHEN $2 = 'enterprise' THEN -1
				ELSE 0
			END
	`, licenseID, tier).Scan(&cloudRequestsUsed, &cloudRequestsLimit)

	// Check if quota exceeded
	quotaExceeded := false
	if cloudRequestsLimit > 0 && cloudRequestsUsed >= cloudRequestsLimit {
		quotaExceeded = true
	}

	log.Info().
		Str("usage_id", usageID).
		Str("license_id", licenseID).
		Str("request_type", req.RequestType).
		Str("provider", req.Provider).
		Str("model", req.Model).
		Int("usage", cloudRequestsUsed).
		Int("limit", cloudRequestsLimit).
		Bool("quota_exceeded", quotaExceeded).
		Msg("[Usage] Request logged")

	return c.JSON(LogUsageResponse{
		Logged:             true,
		UsageID:            usageID,
		CloudRequestsUsed:  cloudRequestsUsed,
		CloudRequestsLimit: cloudRequestsLimit,
		QuotaExceeded:      quotaExceeded,
	})
}

// Note: maskLicenseKey is defined in routes_license.go (same package)
