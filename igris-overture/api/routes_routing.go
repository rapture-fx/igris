// Package api provides route registration for intelligent routing endpoints
package api

import (
	"database/sql"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/cmd/igris-overture/handlers"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// speculativeDB is the DB used for speculative router endpoints; may be nil.
var speculativeDB *sql.DB

// RegisterSpeculativeRoutes adds speculative-router endpoints to an existing v1 group.
// This is called after RegisterRoutingRoutes so we extend the same /v1/routing group.
func RegisterSpeculativeRoutes(app *fiber.App, db *sql.DB) {
	speculativeDB = db

	v1 := app.Group("/v1")
	routing := v1.Group("/routing")
	routing.Use(middleware.BetterAuth(db))

	routing.Get("/speculative/status", handleSpeculativeStatus)
	routing.Get("/speculative/config", handleSpeculativeConfig)
	routing.Get("/speculative/analytics", handleSpeculativeAnalytics)
	routing.Post("/speculative/simulate", handleSpeculativeSimulate)

	log.Println("[Routes] ✓ Registered 4 speculative router endpoints")
	log.Println("[Routes]   - GET  /v1/routing/speculative/status")
	log.Println("[Routes]   - GET  /v1/routing/speculative/config")
	log.Println("[Routes]   - GET  /v1/routing/speculative/analytics")
	log.Println("[Routes]   - POST /v1/routing/speculative/simulate")
}

// handleSpeculativeStatus handles GET /v1/routing/speculative/status.
func handleSpeculativeStatus(c *fiber.Ctx) error {
	// Attempt to pull real aggregate data from shadow_comparisons or routing_telemetry
	// tables if they exist; fall back to sensible zeros so the console doesn't break.
	type WinByProvider struct {
		Provider string  `json:"provider"`
		WinRate  float64 `json:"win_rate"`
	}

	type StatusResponse struct {
		Enabled              bool            `json:"enabled"`
		SuccessRate          float64         `json:"success_rate"`
		LatencyImprovementMs int             `json:"latency_improvement_ms"`
		CostDeltaPercent     float64         `json:"cost_delta_percent"`
		Races24h             int             `json:"races_24h"`
		WinsByProvider       []WinByProvider `json:"wins_by_provider"`
	}

	resp := StatusResponse{
		Enabled:              true,
		SuccessRate:          0,
		LatencyImprovementMs: 0,
		CostDeltaPercent:     0,
		Races24h:             0,
		WinsByProvider:       []WinByProvider{},
	}

	// Best-effort: query routing_telemetry if available
	if speculativeDB != nil {
		_ = speculativeDB.QueryRow(`
			SELECT
				COUNT(*),
				COALESCE(AVG(latency_improvement_ms), 0),
				COALESCE(AVG(cost_delta_percent), 0),
				COALESCE(
					100.0 * COUNT(*) FILTER (WHERE winner IS NOT NULL) / NULLIF(COUNT(*), 0),
					0
				)
			FROM routing_telemetry
			WHERE created_at >= NOW() - INTERVAL '24 hours'
		`).Scan(
			&resp.Races24h,
			&resp.LatencyImprovementMs,
			&resp.CostDeltaPercent,
			&resp.SuccessRate,
		)
		// Ignore errors — table may not exist yet; defaults remain.
	}

	return c.JSON(resp)
}

// handleSpeculativeConfig handles GET /v1/routing/speculative/config.
func handleSpeculativeConfig(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"enabled":                    true,
		"max_parallel_providers":     3,
		"timeout_ms":                 5000,
		"first_token_threshold_ms":   500,
		"enabled_providers":          []string{"openai", "anthropic"},
	})
}

// handleSpeculativeAnalytics handles GET /v1/routing/speculative/analytics.
func handleSpeculativeAnalytics(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"race_win_rate":         []fiber.Map{},
		"latency_distribution":  []fiber.Map{},
		"cost_savings_timeline": []fiber.Map{},
	})
}

// handleSpeculativeSimulate handles POST /v1/routing/speculative/simulate.
func handleSpeculativeSimulate(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"simulated": true,
		"message":   "simulation triggered",
	})
}

// circuitBreakerDB is the DB used for circuit breaker endpoints; may be nil.
var circuitBreakerDB *sql.DB

// CBProviderStatus holds per-provider circuit breaker state.
type CBProviderStatus struct {
	Provider      string  `json:"provider"`
	State         string  `json:"state"`
	FailureCount  int     `json:"failure_count"`
	TripCount     int     `json:"trip_count"`
	LastTrippedAt *string `json:"last_tripped_at,omitempty"`
}

// CircuitBreakerStatusResponse is the response body for GET /v1/routing/circuit-breaker/status.
type CircuitBreakerStatusResponse struct {
	Enabled       bool               `json:"enabled"`
	State         string             `json:"state"`
	TripCount     int                `json:"trip_count"`
	LastTrippedAt *string            `json:"last_tripped_at,omitempty"`
	Providers     []CBProviderStatus `json:"providers"`
}

// RegisterCircuitBreakerRoutes adds the circuit-breaker status endpoint to an existing v1 group.
// This is called after RegisterRoutingRoutes so we extend the same /v1/routing group.
func RegisterCircuitBreakerRoutes(app *fiber.App, db *sql.DB) {
	circuitBreakerDB = db

	v1 := app.Group("/v1")
	routing := v1.Group("/routing")
	routing.Use(middleware.BetterAuth(db))

	routing.Get("/circuit-breaker/status", handleCircuitBreakerStatus)

	log.Println("[Routes] ✓ Registered 1 circuit breaker endpoint")
	log.Println("[Routes]   - GET  /v1/routing/circuit-breaker/status")
}

// handleCircuitBreakerStatus handles GET /v1/routing/circuit-breaker/status.
// It queries circuit_breaker_states for the authenticated tenant and returns
// an aggregate view plus per-provider breakdown. If the table does not exist
// or the tenant has no rows yet, it returns a default "closed" response so
// the console never breaks during initial deployment.
func handleCircuitBreakerStatus(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)

	defaultResp := CircuitBreakerStatusResponse{
		Enabled:   true,
		State:     "closed",
		TripCount: 0,
		Providers: []CBProviderStatus{},
	}

	if circuitBreakerDB == nil {
		return c.JSON(defaultResp)
	}

	rows, err := circuitBreakerDB.QueryContext(c.Context(), `
		SELECT provider, state, failure_count, trip_count, last_tripped_at
		FROM circuit_breaker_states
		WHERE tenant_id = $1
		ORDER BY provider
	`, tenantID)
	if err != nil {
		// Table may not exist yet — graceful degradation.
		log.Printf("[CircuitBreaker] query error (non-fatal): %v", err)
		return c.JSON(defaultResp)
	}
	defer rows.Close()

	var providers []CBProviderStatus
	for rows.Next() {
		var p CBProviderStatus
		var lastTrippedAt sql.NullTime
		if scanErr := rows.Scan(&p.Provider, &p.State, &p.FailureCount, &p.TripCount, &lastTrippedAt); scanErr != nil {
			log.Printf("[CircuitBreaker] row scan error: %v", scanErr)
			continue
		}
		if lastTrippedAt.Valid {
			ts := lastTrippedAt.Time.UTC().Format(time.RFC3339)
			p.LastTrippedAt = &ts
		}
		providers = append(providers, p)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[CircuitBreaker] rows iteration error: %v", err)
		return c.JSON(defaultResp)
	}

	if len(providers) == 0 {
		return c.JSON(defaultResp)
	}

	// Derive aggregate state: open > half-open > closed.
	overallState := "closed"
	totalTrips := 0
	var latestTrip *string
	for _, p := range providers {
		totalTrips += p.TripCount
		if p.State == "open" {
			overallState = "open"
		} else if p.State == "half-open" && overallState != "open" {
			overallState = "half-open"
		}
		if p.LastTrippedAt != nil {
			if latestTrip == nil || *p.LastTrippedAt > *latestTrip {
				latestTrip = p.LastTrippedAt
			}
		}
	}

	resp := CircuitBreakerStatusResponse{
		Enabled:       true,
		State:         overallState,
		TripCount:     totalTrips,
		LastTrippedAt: latestTrip,
		Providers:     providers,
	}
	return c.JSON(resp)
}

// RoutingRouteConfig holds configuration for routing routes
type RoutingRouteConfig struct {
	DB         *sql.DB
	KeyVault   *security.KeyVault
	TenantAuth *middleware.TenantAuth
}

// RegisterRoutingRoutes registers all intelligent routing endpoints
func RegisterRoutingRoutes(app *fiber.App, config *RoutingRouteConfig) {
	log.Println("[Routes] Registering intelligent routing endpoints...")

	// Create chat router handler
	chatRouter := handlers.NewChatRouterHandler(config.DB, config.KeyVault)

	// Configure rate limiting (default: 100 requests/minute per tenant)
	rateLimitPerMin := 100
	if envLimit := os.Getenv("RATE_LIMIT_PER_MINUTE"); envLimit != "" {
		if parsed, err := strconv.Atoi(envLimit); err == nil && parsed > 0 {
			rateLimitPerMin = parsed
		}
	}
	rateLimiter := middleware.NewRateLimiter(rateLimitPerMin, time.Minute)
	log.Printf("[Routes] Rate limiting configured: %d requests/minute per tenant", rateLimitPerMin)

	// API v1 group
	v1 := app.Group("/v1")

	// ========================================================================
	// CHAT COMPLETIONS ROUTING (Require tenant authentication + rate limiting)
	// ========================================================================

	// Main routing endpoint (OpenAI-compatible) with rate limiting
	v1.Post("/chat/completions",
		middleware.BetterAuth(config.DB),
		rateLimiter.RateLimitMiddleware(),
		chatRouter.ChatCompletions,
	)

	log.Println("[Routes] ✓ Registered chat completions routing endpoint")
	log.Println("[Routes]   - POST /v1/chat/completions (Intelligent multi-provider routing)")

	// ========================================================================
	// ROUTING ANALYTICS (Require tenant authentication)
	// ========================================================================

	routing := v1.Group("/routing")
	routing.Use(middleware.BetterAuth(config.DB))

	routing.Get("/stats", chatRouter.GetRoutingStats)           // GET /v1/routing/stats
	routing.Get("/recent", chatRouter.GetRecentRequests)        // GET /v1/routing/recent
	routing.Get("/leaderboard", chatRouter.GetProviderLeaderboard) // GET /v1/routing/leaderboard

	log.Println("[Routes] ✓ Registered 3 routing analytics endpoints")
	log.Println("[Routes]   - GET /v1/routing/stats          (Routing statistics)")
	log.Println("[Routes]   - GET /v1/routing/recent         (Recent requests)")
	log.Println("[Routes]   - GET /v1/routing/leaderboard    (Provider leaderboard)")
}
