// Package api provides route registration for provider registry endpoints
package api

import (
	"database/sql"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/cmd/igris-overture/handlers"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
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
	providers.Use(middleware.BetterAuth(config.DB))

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

// RegisterModelProviderRoutes adds GET /models/providers as an alias for
// the existing provider-list endpoint. The web-console calls this path.
func RegisterModelProviderRoutes(app *fiber.App, db *sql.DB, _ *middleware.TenantAuth) {
	if db == nil {
		log.Println("[Routes] /models/providers alias disabled — database not available")
		return
	}

	providerHandler := handlers.NewProviderRegistryHandler(db, nil)

	models := app.Group("/models")
	models.Use(middleware.BetterAuth(db))
	models.Get("/providers", providerHandler.ListProviders)
	models.Post("/providers", providerHandler.RegisterProvider)
	models.Put("/providers/:id", providerHandler.UpdateProvider)
	models.Delete("/providers/:id", providerHandler.DeleteProvider)

	log.Println("[Routes] ✓ Registered /models/providers (GET list, POST create, PUT update, DELETE remove)")
}
