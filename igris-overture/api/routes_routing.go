// Package api provides route registration for intelligent routing endpoints
package api

import (
	"database/sql"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Schlep-engine/igris-inertial/cmd/igris-overture/handlers"
	"github.com/Schlep-engine/igris-inertial/internal/middleware"
	"github.com/Schlep-engine/igris-inertial/internal/security"
)

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
		config.TenantAuth.Authenticate(),
		rateLimiter.RateLimitMiddleware(),
		chatRouter.ChatCompletions,
	)

	log.Println("[Routes] ✓ Registered chat completions routing endpoint")
	log.Println("[Routes]   - POST /v1/chat/completions (Intelligent multi-provider routing)")

	// ========================================================================
	// ROUTING ANALYTICS (Require tenant authentication)
	// ========================================================================

	routing := v1.Group("/routing")
	routing.Use(config.TenantAuth.Authenticate())

	routing.Get("/stats", chatRouter.GetRoutingStats)           // GET /v1/routing/stats
	routing.Get("/recent", chatRouter.GetRecentRequests)        // GET /v1/routing/recent
	routing.Get("/leaderboard", chatRouter.GetProviderLeaderboard) // GET /v1/routing/leaderboard

	log.Println("[Routes] ✓ Registered 3 routing analytics endpoints")
	log.Println("[Routes]   - GET /v1/routing/stats          (Routing statistics)")
	log.Println("[Routes]   - GET /v1/routing/recent         (Recent requests)")
	log.Println("[Routes]   - GET /v1/routing/leaderboard    (Provider leaderboard)")
}
