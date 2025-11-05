// Package api provides route registration for provider registry endpoints
package api

import (
	"database/sql"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/cmd/schlep-engine-api/handlers"
	"github.com/schlep-engine/schlep-engine/internal/middleware"
	"github.com/schlep-engine/schlep-engine/internal/security"
)

// ProviderRegistryRouteConfig holds configuration for provider registry routes
type ProviderRegistryRouteConfig struct {
	DB         *sql.DB
	KeyVault   *security.KeyVault
	TenantAuth *middleware.TenantAuth
	APIKeyAuth *middleware.APIKeyAuth
}

// RegisterProviderRegistryRoutes registers all provider registry endpoints
func RegisterProviderRegistryRoutes(app *fiber.App, config *ProviderRegistryRouteConfig) {
	log.Println("[Routes] Registering provider registry endpoints...")

	// Create handler
	providerHandler := handlers.NewProviderRegistryHandler(config.DB, config.KeyVault)

	// API v1 group
	v1 := app.Group("/v1")

	// ========================================================================
	// PROVIDER REGISTRY ROUTES (Require tenant authentication)
	// ========================================================================

	providers := v1.Group("/providers")
	providers.Use(config.TenantAuth.Authenticate())

	// Provider Registration & Management
	providers.Post("/register", providerHandler.RegisterProvider)      // POST /v1/providers/register
	providers.Post("/test", providerHandler.TestProvider)              // POST /v1/providers/test
	providers.Get("/", providerHandler.ListProviders)                  // GET /v1/providers
	providers.Get("/:id/health", providerHandler.GetProviderHealth)    // GET /v1/providers/:id/health
	providers.Delete("/:id", providerHandler.DeleteProvider)           // DELETE /v1/providers/:id
	providers.Put("/:id", providerHandler.UpdateProvider)              // PUT /v1/providers/:id

	log.Println("[Routes] ✓ Registered 6 provider registry endpoints")
	log.Println("[Routes]   - POST   /v1/providers/register       (Register new provider)")
	log.Println("[Routes]   - POST   /v1/providers/test           (Test provider connectivity)")
	log.Println("[Routes]   - GET    /v1/providers                (List tenant providers)")
	log.Println("[Routes]   - GET    /v1/providers/:id/health     (Get provider health)")
	log.Println("[Routes]   - DELETE /v1/providers/:id            (Delete provider)")
	log.Println("[Routes]   - PUT    /v1/providers/:id            (Update provider)")
}
