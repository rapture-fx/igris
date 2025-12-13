// Package handlers provides HTTP handlers for intelligent routing
package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/Schlep-engine/igris-inertial/igris-overture/adapters"
	"github.com/Schlep-engine/igris-inertial/igris-overture/logging"
	"github.com/Schlep-engine/igris-inertial/igris-overture/middleware"
	"github.com/Schlep-engine/igris-inertial/igris-overture/repository"
	"github.com/Schlep-engine/igris-inertial/igris-overture/routing"
	"github.com/Schlep-engine/igris-inertial/igris-overture/security"
	"github.com/Schlep-engine/igris-inertial/igris-overture/telemetry"
)

// ChatRouterHandler handles intelligent multi-provider routing
type ChatRouterHandler struct {
	db        *sql.DB
	selector  *routing.ProviderSelector
	adapter   *adapters.HTTPAdapter
	telemetry *telemetry.TelemetryCollector
	keyVault  *security.KeyVault
	logger    *log.Logger
}

// NewChatRouterHandler creates a new chat router handler
func NewChatRouterHandler(db *sql.DB, keyVault *security.KeyVault) *ChatRouterHandler {
	repo := repository.NewProviderRegistryRepository(db)
	selector := routing.NewProviderSelector(repo)
	adapter := adapters.NewHTTPAdapter(30 * time.Second)
	telemetryCollector := telemetry.NewTelemetryCollector(db)

	return &ChatRouterHandler{
		db:        db,
		selector:  selector,
		adapter:   adapter,
		telemetry: telemetryCollector,
		keyVault:  keyVault,
		logger:    log.Default(),
	}
}

// ChatCompletionRequest extends the adapter request with provider preferences
type ChatCompletionRequest struct {
	adapters.ChatCompletionRequest
	ProviderPreference []string `json:"provider_preference,omitempty"`
}

// ChatCompletions handles POST /v1/chat/completions with intelligent routing
func (h *ChatRouterHandler) ChatCompletions(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{
				"message": "Unauthorized",
				"type":    "authentication_error",
				"code":    "UNAUTHORIZED",
			},
		})
	}

	// Generate trace ID
	traceID := uuid.New()
	c.Set("X-Schlep-Trace-ID", traceID.String())

	// Parse request
	var req ChatCompletionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{
				"message": "Invalid request body",
				"type":    "invalid_request_error",
				"code":    "INVALID_REQUEST",
			},
		})
	}

	// Validate request
	if err := adapters.ValidateRequest(&req.ChatCompletionRequest); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{
				"message": err.Error(),
				"type":    "invalid_request_error",
				"code":    "VALIDATION_FAILED",
			},
		})
	}

	// Set up selection criteria
	criteria := &routing.SelectionCriteria{
		TenantID:           tenantCtx.TenantID,
		Model:              req.Model,
		ProviderPreference: req.ProviderPreference,
		MinUptimePercent:   80.0,
		MaxLatencyMs:       5000,
	}

	// Get ordered list of provider candidates for fallback
	ctx := context.Background()
	candidates, err := h.selector.SelectProviders(ctx, criteria, 3) // Try up to 3 providers
	if err != nil {
		h.logger.Printf("[ChatRouter] No providers available for tenant %s: %v", tenantCtx.TenantID, err)
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": fiber.Map{
				"message": "No healthy providers available",
				"type":    "service_unavailable",
				"code":    "NO_PROVIDERS",
			},
		})
	}

	h.logger.Printf("[ChatRouter] Found %d candidate providers for tenant %s", len(candidates), tenantCtx.TenantID)

	// Try providers in order with fallback
	var lastError error
	var selectionReason routing.SelectionReason

	for fallbackCount, candidate := range candidates {
		provider := candidate.Provider

		// Determine selection reason
		if fallbackCount == 0 {
			if len(req.ProviderPreference) > 0 {
				selectionReason = routing.SelectionReasonPreference
			} else {
				selectionReason = routing.SelectionReasonHealth
			}
		} else {
			selectionReason = routing.SelectionReasonFallback
		}

		h.logger.Printf("[ChatRouter] Attempting provider '%s' (fallback_count=%d, health_score=%.2f)",
			provider.Name, fallbackCount, candidate.HealthScore)

		// Get API key from vault
		decryptedKey, err := h.keyVault.GetKey(provider.TenantID, provider.Name)
		if err != nil {
			h.logger.Printf("[ChatRouter] Failed to get API key for provider '%s': %v", provider.Name, err)
			lastError = fmt.Errorf("API key not found for provider '%s'", provider.Name)

			// Record telemetry for this failure
			if err := h.telemetry.RecordTelemetry(ctx, &telemetry.RoutingTelemetry{
				TenantID:        tenantCtx.TenantID,
				TraceID:         traceID,
				ProviderID:      &provider.ID,
				ProviderName:    provider.Name,
				Model:           req.Model,
				LatencyMs:       0,
				Success:         false,
				FallbackCount:   fallbackCount,
				SelectionReason: string(selectionReason),
			}); err != nil {
				h.logger.Printf("[ChatRouter] WARN: Failed to record telemetry for failed provider '%s' (trace: %s): %v",
					provider.Name, traceID, logging.SanitizeError(err))
				// Metrics are now tracked by async workers
			}

			continue
		}

		apiKey := decryptedKey.PlainKey

		// Send request to provider
		result := h.adapter.SendChatCompletion(ctx, provider, apiKey, &req.ChatCompletionRequest)

		// Record telemetry with proper error handling
		if err := h.telemetry.RecordFromAdapterResult(
			ctx,
			tenantCtx.TenantID,
			traceID,
			provider,
			&req.ChatCompletionRequest,
			result,
			fallbackCount,
			selectionReason,
		); err != nil {
			// Log error but don't fail the request - telemetry is non-critical
			h.logger.Printf("[ChatRouter] WARN: Failed to record telemetry for provider '%s' (trace: %s): %v",
				provider.Name, traceID, logging.SanitizeError(err))
			// Metrics are now tracked by async workers
		}

		// Check if successful
		if result.Success && result.Response != nil {
			h.logger.Printf("[ChatRouter] Success with provider '%s' (latency=%dms, tokens=%d)",
				provider.Name, result.LatencyMs, result.Response.Usage.TotalTokens)

			// Record success for circuit breaker
			h.selector.RecordSuccess(provider.ID)

			// Add routing headers
			c.Set("X-Schlep-Routed-By", provider.Name)
			c.Set("X-Schlep-Provider-ID", provider.ID)
			c.Set("X-Schlep-Latency-Ms", fmt.Sprintf("%d", result.LatencyMs))
			c.Set("X-Schlep-Fallback-Count", fmt.Sprintf("%d", fallbackCount))

			// Return provider's response
			return c.Status(fiber.StatusOK).JSON(result.Response)
		}

		// Request failed, log and continue to next provider
		h.logger.Printf("[ChatRouter] Provider '%s' failed: %v", provider.Name, result.Error)
		lastError = result.Error

		// Record failure for circuit breaker
		h.selector.RecordFailure(provider.ID)

		// Add provider to exclusion list for next attempt
		criteria.ExcludeProviders = append(criteria.ExcludeProviders, provider.Name)
	}

	// All providers failed
	h.logger.Printf("[ChatRouter] All providers failed for tenant %s. Last error: %v", tenantCtx.TenantID, lastError)

	errorMessage := "All providers failed"
	if lastError != nil {
		errorMessage = lastError.Error()
	}

	return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
		"error": fiber.Map{
			"message": errorMessage,
			"type":    "service_unavailable",
			"code":    "ALL_PROVIDERS_FAILED",
		},
		"trace_id": traceID.String(),
	})
}

// GetRoutingStats returns routing statistics for the tenant
// GET /v1/routing/stats
func (h *ChatRouterHandler) GetRoutingStats(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	// Get time window (default: 24 hours)
	hours := c.QueryInt("hours", 24)
	if hours > 168 { // Max 7 days
		hours = 168
	}

	ctx := context.Background()

	// Get usage stats
	usage, err := h.telemetry.GetTenantUsage(ctx, tenantCtx.TenantID, hours)
	if err != nil {
		h.logger.Printf("[ChatRouter] Failed to get usage stats: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve stats",
		})
	}

	// Get provider stats
	providerStats, err := h.selector.GetProviderStats(ctx, tenantCtx.TenantID)
	if err != nil {
		h.logger.Printf("[ChatRouter] Failed to get provider stats: %v", err)
		providerStats = map[string]interface{}{}
	}

	// Get circuit breaker stats
	circuitBreakerStats := h.selector.GetCircuitBreakerStats()

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"usage":            usage,
		"providers":        providerStats,
		"circuit_breakers": circuitBreakerStats,
	})
}

// GetRecentRequests returns recent routing requests for the tenant
// GET /v1/routing/recent
func (h *ChatRouterHandler) GetRecentRequests(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	// Get limit (default: 50, max: 100)
	limit := c.QueryInt("limit", 50)
	if limit > 100 {
		limit = 100
	}

	ctx := context.Background()

	// Get recent requests
	requests, err := h.telemetry.GetRecentRequests(ctx, tenantCtx.TenantID, limit)
	if err != nil {
		h.logger.Printf("[ChatRouter] Failed to get recent requests: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve requests",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"requests": requests,
		"count":    len(requests),
	})
}

// GetProviderLeaderboard returns the provider leaderboard
// GET /v1/routing/leaderboard
func (h *ChatRouterHandler) GetProviderLeaderboard(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	ctx := context.Background()

	// Query the materialized view
	query := `
		SELECT
			provider_id, provider_name, status, is_verified,
			compatibility_class, current_latency_ms, uptime_percent,
			requests_24h, successful_requests_24h, avg_latency_24h,
			total_cost_24h, health_score
		FROM provider_leaderboard
		WHERE tenant_id = $1
		  AND status = 'active'
		ORDER BY health_score DESC
		LIMIT 10
	`

	rows, err := h.db.QueryContext(ctx, query, tenantCtx.TenantID)
	if err != nil {
		h.logger.Printf("[ChatRouter] Failed to get leaderboard: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve leaderboard",
		})
	}
	defer rows.Close()

	leaderboard := make([]map[string]interface{}, 0, 10)

	for rows.Next() {
		var (
			providerID       string
			providerName     string
			status           string
			isVerified       bool
			compatClass      string
			currentLatency   sql.NullInt64
			uptimePercent    sql.NullFloat64
			requests24h      int
			successful24h    int
			avgLatency24h    sql.NullFloat64
			totalCost24h     sql.NullFloat64
			healthScore      sql.NullFloat64
		)

		err := rows.Scan(
			&providerID, &providerName, &status, &isVerified,
			&compatClass, &currentLatency, &uptimePercent,
			&requests24h, &successful24h, &avgLatency24h,
			&totalCost24h, &healthScore,
		)
		if err != nil {
			h.logger.Printf("[ChatRouter] Error scanning leaderboard row: %v", err)
			continue
		}

		entry := map[string]interface{}{
			"provider_id":          providerID,
			"provider_name":        providerName,
			"status":               status,
			"is_verified":          isVerified,
			"compatibility_class":  compatClass,
			"requests_24h":         requests24h,
			"successful_requests_24h": successful24h,
			"health_score":         healthScore.Float64,
		}

		if currentLatency.Valid {
			entry["current_latency_ms"] = currentLatency.Int64
		}
		if uptimePercent.Valid {
			entry["uptime_percent"] = uptimePercent.Float64
		}
		if avgLatency24h.Valid {
			entry["avg_latency_24h"] = avgLatency24h.Float64
		}
		if totalCost24h.Valid {
			entry["total_cost_24h"] = totalCost24h.Float64
		}

		leaderboard = append(leaderboard, entry)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"leaderboard": leaderboard,
		"count":       len(leaderboard),
	})
}
