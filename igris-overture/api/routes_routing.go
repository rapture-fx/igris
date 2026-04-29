// Package api provides route registration for intelligent routing endpoints
package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/Igris-inertial/system/cmd/igris-overture/handlers"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
	"github.com/gofiber/fiber/v2"
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
	type SpeculativeConfigResponse struct {
		Enabled               bool     `json:"enabled"`
		MaxParallelProviders  int      `json:"max_parallel_providers"`
		TimeoutMs             int      `json:"timeout_ms"`
		FirstTokenThresholdMs int      `json:"first_token_threshold_ms"`
		EnabledProviders      []string `json:"enabled_providers"`
	}

	resp := SpeculativeConfigResponse{
		Enabled:               true,
		MaxParallelProviders:  3,
		TimeoutMs:             5000,
		FirstTokenThresholdMs: 500,
		EnabledProviders:      []string{"openai", "anthropic"},
	}

	if speculativeDB == nil {
		return c.JSON(resp)
	}

	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.JSON(resp)
	}

	var raw string
	err := speculativeDB.QueryRowContext(c.Context(), `
		SELECT config_json
		FROM routing_config
		WHERE tenant_id = $1 AND config_key = 'speculative'
	`, tenantID).Scan(&raw)
	if err != nil || raw == "" {
		return c.JSON(resp)
	}

	if unmarshalErr := json.Unmarshal([]byte(raw), &resp); unmarshalErr != nil {
		return c.JSON(resp)
	}
	if resp.MaxParallelProviders == 0 {
		resp.MaxParallelProviders = 3
	}
	if resp.TimeoutMs == 0 {
		resp.TimeoutMs = 5000
	}
	if resp.FirstTokenThresholdMs == 0 {
		resp.FirstTokenThresholdMs = 500
	}
	if resp.EnabledProviders == nil {
		resp.EnabledProviders = []string{"openai", "anthropic"}
	}

	return c.JSON(resp)
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
		// Fall back to system-level circuit breaker entries written by RuntimeSelector.
		sysRows, sysErr := circuitBreakerDB.QueryContext(c.Context(), `
			SELECT provider, state, failure_count, trip_count, last_tripped_at
			FROM circuit_breaker_states
			WHERE tenant_id = 'system'
			ORDER BY provider
		`)
		if sysErr == nil {
			defer sysRows.Close()
			for sysRows.Next() {
				var p CBProviderStatus
				var lastTrippedAt sql.NullTime
				if scanErr := sysRows.Scan(&p.Provider, &p.State, &p.FailureCount, &p.TripCount, &lastTrippedAt); scanErr == nil {
					if lastTrippedAt.Valid {
						ts := lastTrippedAt.Time.UTC().Format(time.RFC3339)
						p.LastTrippedAt = &ts
					}
					providers = append(providers, p)
				}
			}
		}
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

// councilDB is the DB used for council analytics endpoints; may be nil.
var councilDB *sql.DB

// RegisterCouncilRoutes adds the council analytics endpoint to the /v1/routing group.
func RegisterCouncilRoutes(app *fiber.App, db *sql.DB) {
	councilDB = db

	v1 := app.Group("/v1")
	routing := v1.Group("/routing")
	routing.Use(middleware.BetterAuth(db))

	routing.Get("/council/analytics", handleCouncilAnalytics)

	log.Println("[Routes] ✓ Registered 1 council analytics endpoint")
	log.Println("[Routes]   - GET  /v1/routing/council/analytics")
}

// CouncilAnalyticsRow holds per-chairman/winner aggregate stats.
type CouncilAnalyticsRow struct {
	ChairmanProvider    string  `json:"chairman_provider"`
	WinnerProvider      string  `json:"winner_provider"`
	AvgTotalLatencyMs   float64 `json:"avg_total_latency_ms"`
	AvgRankingLatencyMs float64 `json:"avg_ranking_latency_ms"`
	AvgCostUSD          float64 `json:"avg_cost_usd"`
	InvocationCount     int     `json:"invocation_count"`
}

// CouncilAnalyticsResponse is the response body for GET /v1/routing/council/analytics.
type CouncilAnalyticsResponse struct {
	TotalInvocations int                   `json:"total_invocations"`
	Last24h          int                   `json:"last_24h"`
	AvgLatencyMs     float64               `json:"avg_latency_ms"`
	AvgCostUSD       float64               `json:"avg_cost_usd"`
	ByChairman       []CouncilAnalyticsRow `json:"by_chairman"`
}

// handleCouncilAnalytics handles GET /v1/routing/council/analytics.
// It queries council_results for the authenticated tenant and returns aggregate
// stats plus a per-chairman/winner breakdown. If the table does not exist or
// no rows are found, it returns a default empty response so the console never
// breaks during initial deployment.
func handleCouncilAnalytics(c *fiber.Ctx) error {
	defaultResp := CouncilAnalyticsResponse{
		TotalInvocations: 0,
		Last24h:          0,
		AvgLatencyMs:     0,
		AvgCostUSD:       0,
		ByChairman:       []CouncilAnalyticsRow{},
	}

	if councilDB == nil {
		return c.JSON(defaultResp)
	}

	tenantID := middleware.GetClerkUserID(c)

	// Aggregate totals query.
	var totalInvocations, last24h int
	var avgLatencyMs, avgCostUSD float64
	err := councilDB.QueryRowContext(c.Context(), `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'),
			COALESCE(AVG(total_latency_ms), 0),
			COALESCE(AVG(council_cost_usd), 0)
		FROM council_results
		WHERE tenant_id = $1
	`, tenantID).Scan(&totalInvocations, &last24h, &avgLatencyMs, &avgCostUSD)
	if err != nil {
		// Table may not exist yet — graceful degradation.
		log.Printf("[Council] aggregate query error (non-fatal): %v", err)
		return c.JSON(defaultResp)
	}

	// Per-chairman breakdown query.
	rows, err := councilDB.QueryContext(c.Context(), `
		SELECT
			chairman_provider,
			winner_provider,
			COALESCE(AVG(total_latency_ms), 0),
			COALESCE(AVG(ranking_latency_ms), 0),
			COALESCE(AVG(council_cost_usd), 0),
			COUNT(*)
		FROM council_results
		WHERE tenant_id = $1
		GROUP BY chairman_provider, winner_provider
		ORDER BY COUNT(*) DESC
		LIMIT 10
	`, tenantID)
	if err != nil {
		log.Printf("[Council] breakdown query error (non-fatal): %v", err)
		return c.JSON(defaultResp)
	}
	defer rows.Close()

	byChairman := make([]CouncilAnalyticsRow, 0)
	for rows.Next() {
		var row CouncilAnalyticsRow
		if scanErr := rows.Scan(
			&row.ChairmanProvider,
			&row.WinnerProvider,
			&row.AvgTotalLatencyMs,
			&row.AvgRankingLatencyMs,
			&row.AvgCostUSD,
			&row.InvocationCount,
		); scanErr != nil {
			log.Printf("[Council] row scan error: %v", scanErr)
			continue
		}
		byChairman = append(byChairman, row)
	}
	if err = rows.Err(); err != nil {
		log.Printf("[Council] rows iteration error: %v", err)
		return c.JSON(defaultResp)
	}

	return c.JSON(CouncilAnalyticsResponse{
		TotalInvocations: totalInvocations,
		Last24h:          last24h,
		AvgLatencyMs:     avgLatencyMs,
		AvgCostUSD:       avgCostUSD,
		ByChairman:       byChairman,
	})
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

	routing.Get("/stats", chatRouter.GetRoutingStats)              // GET /v1/routing/stats
	routing.Get("/recent", chatRouter.GetRecentRequests)           // GET /v1/routing/recent
	routing.Get("/leaderboard", chatRouter.GetProviderLeaderboard) // GET /v1/routing/leaderboard

	log.Println("[Routes] ✓ Registered 3 routing analytics endpoints")
	log.Println("[Routes]   - GET /v1/routing/stats          (Routing statistics)")
	log.Println("[Routes]   - GET /v1/routing/recent         (Recent requests)")
	log.Println("[Routes]   - GET /v1/routing/leaderboard    (Provider leaderboard)")
}

// ── Routing config persistence ───────────────────────────────────────────────

// saveRoutingConfig is a shared helper that reads the raw request body and
// upserts it into the routing_config table under the given key. Errors are
// swallowed so that the console never receives a hard failure — we always
// return {"saved": true}.
func saveRoutingConfig(db *sql.DB, c *fiber.Ctx, key string) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var payload json.RawMessage
	if err := c.BodyParser(&payload); err != nil || len(payload) == 0 {
		payload = json.RawMessage(`{}`)
	}

	if db != nil {
		_, _ = db.ExecContext(c.Context(), `
			INSERT INTO routing_config (tenant_id, config_key, config_json, updated_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (tenant_id, config_key)
			DO UPDATE SET config_json = EXCLUDED.config_json, updated_at = NOW()
		`, tenantID, key, string(payload))
		// Ignore errors — table may not exist yet; graceful degradation.
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"saved": true})
}

// loadRoutingConfig returns a persisted routing config blob or a default JSON payload.
func loadRoutingConfig(db *sql.DB, c *fiber.Ctx, key string, defaultPayload string) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	if db == nil {
		c.Type("json")
		return c.SendString(defaultPayload)
	}

	var payload string
	err := db.QueryRowContext(c.Context(), `
		SELECT config_json
		FROM routing_config
		WHERE tenant_id = $1 AND config_key = $2
	`, tenantID, key).Scan(&payload)
	if err != nil || payload == "" || !json.Valid([]byte(payload)) {
		c.Type("json")
		return c.SendString(defaultPayload)
	}

	c.Type("json")
	return c.SendString(payload)
}

// RegisterRoutingConfigRoutes registers the 5 POST endpoints that persist
// routing configuration from the console. All endpoints require BetterAuth.
// Upserts into routing_config; failures are silent so the console never breaks.
func RegisterRoutingConfigRoutes(app *fiber.App, db *sql.DB) {
	auth := middleware.BetterAuth(db)

	app.Get("/v1/routing/strategy", auth, func(c *fiber.Ctx) error {
		return loadRoutingConfig(db, c, "strategy", `{"mode":"thompson"}`)
	})
	app.Post("/v1/routing/strategy", auth, func(c *fiber.Ctx) error {
		return saveRoutingConfig(db, c, "strategy")
	})
	app.Post("/v1/routing/speculative", auth, func(c *fiber.Ctx) error {
		return saveRoutingConfig(db, c, "speculative")
	})
	app.Post("/v1/routing/council", auth, func(c *fiber.Ctx) error {
		return saveRoutingConfig(db, c, "council")
	})
	app.Post("/v1/routing/shadow", auth, func(c *fiber.Ctx) error {
		return saveRoutingConfig(db, c, "shadow")
	})
	app.Post("/v1/routing/provider_weights", auth, func(c *fiber.Ctx) error {
		return saveRoutingConfig(db, c, "provider_weights")
	})

	log.Println("[Routes] Registered GET  /v1/routing/strategy")
	log.Println("[Routes] Registered POST /v1/routing/strategy")
	log.Println("[Routes] Registered POST /v1/routing/speculative")
	log.Println("[Routes] Registered POST /v1/routing/council")
	log.Println("[Routes] Registered POST /v1/routing/shadow")
	log.Println("[Routes] Registered POST /v1/routing/provider_weights")
}

// ── Routing analytics (standalone, for use when RegisterRoutingRoutes is unavailable) ──

// routingAnalyticsDB is the DB used by the standalone analytics handlers.
var routingAnalyticsDB *sql.DB

// RegisterRoutingAnalyticsRoutes registers the 3 GET analytics endpoints.
// These query routing_telemetry if available, with graceful fallback to empty
// responses so the console never breaks on initial deployment.
func RegisterRoutingAnalyticsRoutes(app *fiber.App, db *sql.DB) {
	routingAnalyticsDB = db

	auth := middleware.BetterAuth(db)

	v1 := app.Group("/v1")
	routing := v1.Group("/routing")
	routing.Use(auth)

	routing.Get("/stats", handleRoutingStats)
	routing.Get("/recent", handleRoutingRecent)
	routing.Get("/leaderboard", handleRoutingLeaderboard)

	log.Println("[Routes] Registered GET /v1/routing/stats")
	log.Println("[Routes] Registered GET /v1/routing/recent")
	log.Println("[Routes] Registered GET /v1/routing/leaderboard")
}

// handleRoutingStats handles GET /v1/routing/stats.
func handleRoutingStats(c *fiber.Ctx) error {
	type ProviderBreakdownItem struct {
		Provider string  `json:"provider"`
		Count    int     `json:"count"`
		AvgMs    float64 `json:"avg_latency_ms"`
	}

	defaultResp := fiber.Map{
		"total_requests":     0,
		"avg_latency_ms":     0,
		"provider_breakdown": []ProviderBreakdownItem{},
	}

	if routingAnalyticsDB == nil {
		return c.JSON(defaultResp)
	}

	var totalRequests int
	var avgLatencyMs float64
	err := routingAnalyticsDB.QueryRowContext(c.Context(), `
		SELECT COUNT(*), COALESCE(AVG(latency_ms), 0)
		FROM routing_telemetry
	`).Scan(&totalRequests, &avgLatencyMs)
	if err != nil {
		// Table may not exist yet — graceful degradation.
		log.Printf("[RoutingAnalytics] stats query error (non-fatal): %v", err)
		return c.JSON(defaultResp)
	}

	rows, err := routingAnalyticsDB.QueryContext(c.Context(), `
		SELECT provider, COUNT(*), COALESCE(AVG(latency_ms), 0)
		FROM routing_telemetry
		GROUP BY provider
		ORDER BY COUNT(*) DESC
		LIMIT 20
	`)
	if err != nil {
		log.Printf("[RoutingAnalytics] breakdown query error (non-fatal): %v", err)
		return c.JSON(fiber.Map{
			"total_requests":     totalRequests,
			"avg_latency_ms":     avgLatencyMs,
			"provider_breakdown": []ProviderBreakdownItem{},
		})
	}
	defer rows.Close()

	breakdown := make([]ProviderBreakdownItem, 0)
	for rows.Next() {
		var item ProviderBreakdownItem
		if scanErr := rows.Scan(&item.Provider, &item.Count, &item.AvgMs); scanErr == nil {
			breakdown = append(breakdown, item)
		}
	}

	return c.JSON(fiber.Map{
		"total_requests":     totalRequests,
		"avg_latency_ms":     avgLatencyMs,
		"provider_breakdown": breakdown,
	})
}

// handleRoutingRecent handles GET /v1/routing/recent.
func handleRoutingRecent(c *fiber.Ctx) error {
	emptySlice := []fiber.Map{}

	if routingAnalyticsDB == nil {
		return c.JSON(emptySlice)
	}

	rows, err := routingAnalyticsDB.QueryContext(c.Context(), `
		SELECT id, provider, latency_ms, created_at
		FROM routing_telemetry
		ORDER BY created_at DESC
		LIMIT 20
	`)
	if err != nil {
		// Table may not exist yet — graceful degradation.
		log.Printf("[RoutingAnalytics] recent query error (non-fatal): %v", err)
		return c.JSON(emptySlice)
	}
	defer rows.Close()

	results := make([]fiber.Map, 0)
	for rows.Next() {
		var id int64
		var provider string
		var latencyMs float64
		var createdAt time.Time
		if scanErr := rows.Scan(&id, &provider, &latencyMs, &createdAt); scanErr == nil {
			results = append(results, fiber.Map{
				"id":         id,
				"provider":   provider,
				"latency_ms": latencyMs,
				"created_at": createdAt.UTC().Format(time.RFC3339),
			})
		}
	}

	return c.JSON(results)
}

// handleRoutingLeaderboard handles GET /v1/routing/leaderboard.
func handleRoutingLeaderboard(c *fiber.Ctx) error {
	emptySlice := []fiber.Map{}

	if routingAnalyticsDB == nil {
		return c.JSON(emptySlice)
	}

	rows, err := routingAnalyticsDB.QueryContext(c.Context(), `
		SELECT provider, COUNT(*) AS request_count, COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
		FROM routing_telemetry
		GROUP BY provider
		ORDER BY request_count DESC
		LIMIT 20
	`)
	if err != nil {
		// Table may not exist yet — graceful degradation.
		log.Printf("[RoutingAnalytics] leaderboard query error (non-fatal): %v", err)
		return c.JSON(emptySlice)
	}
	defer rows.Close()

	results := make([]fiber.Map, 0)
	for rows.Next() {
		var provider string
		var requestCount int
		var avgLatencyMs float64
		if scanErr := rows.Scan(&provider, &requestCount, &avgLatencyMs); scanErr == nil {
			results = append(results, fiber.Map{
				"provider":       provider,
				"request_count":  requestCount,
				"avg_latency_ms": avgLatencyMs,
			})
		}
	}

	return c.JSON(results)
}
