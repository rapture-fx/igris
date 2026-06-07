// Package api provides route registration for Phase 14 multi-tenancy endpoints
package api

import (
	"database/sql"
	"log"
	"os"

	"github.com/Igris-inertial/system/cmd/igris-overture/handlers"
	apihandlers "github.com/Igris-inertial/system/igris-overture/api/handlers"
	"github.com/Igris-inertial/system/igris-overture/billing"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
	"github.com/gofiber/fiber/v2"
)

// TenancyRouteConfig holds configuration for tenancy routes
type TenancyRouteConfig struct {
	DB         *sql.DB
	JWTManager *security.JWTManager
	KeyVault   *security.KeyVault
	TenantAuth *middleware.TenantAuth
	APIKeyAuth *middleware.APIKeyAuth
}

// RegisterTenancyRoutes registers all Phase 14 multi-tenancy endpoints
func RegisterTenancyRoutes(app *fiber.App, config *TenancyRouteConfig) {
	log.Println("[Routes] Registering Phase 14 multi-tenancy endpoints...")

	// Create handlers
	tenantHandler := handlers.NewTenantHandler(config.DB, config.JWTManager)
	vaultHandler := handlers.NewVaultHandler(config.KeyVault, config.DB)
	policyHandler := handlers.NewPolicyHandler(config.DB)
	usageHandler := handlers.NewUsageHandler(config.DB)
	tracesHandler := handlers.NewTracesHandler(config.DB)

	// API v1 group
	v1 := app.Group("/v1")

	// ========================================================================
	// PUBLIC ROUTES (No authentication required)
	// ========================================================================

	// Health and metrics remain public (already registered in main routes)
	// app.Get("/health", ...)
	// app.Get("/metrics", ...)

	// ========================================================================
	// ADMIN-ONLY ROUTES (Require admin role)
	// ========================================================================

	admin := v1.Group("/tenants")
	admin.Use(middleware.BetterAuth(config.DB))
	admin.Use(config.TenantAuth.RequireAdmin())

	// Tenant Management (Admin only)
	admin.Post("/", tenantHandler.CreateTenant)                      // POST /v1/tenants
	admin.Get("/", tenantHandler.ListTenants)                        // GET /v1/tenants
	admin.Post("/:tenant_id/suspend", tenantHandler.SuspendTenant)   // POST /v1/tenants/:id/suspend
	admin.Post("/:tenant_id/activate", tenantHandler.ActivateTenant) // POST /v1/tenants/:id/activate
	admin.Delete("/:tenant_id", tenantHandler.DeleteTenant)          // DELETE /v1/tenants/:id

	log.Println("[Routes] ✓ Registered 5 admin tenant management endpoints")

	// ========================================================================
	// TENANT ROUTES (Require tenant authentication - admin or self)
	// ========================================================================

	tenants := v1.Group("/tenants")
	tenants.Use(middleware.BetterAuth(config.DB))

	// Literal /current must be registered before /:tenant_id so Fiber matches
	// it as an exact route rather than treating "current" as a tenant_id param.
	tenants.Get("/current", makeGetCurrentTenant(config.DB)) // GET /v1/tenants/current

	// Tenant self-service
	tenants.Get("/:tenant_id", tenantHandler.GetTenant)    // GET /v1/tenants/:id
	tenants.Put("/:tenant_id", tenantHandler.UpdateTenant) // PUT /v1/tenants/:id

	log.Println("[Routes] ✓ Registered 3 tenant self-service endpoints (current + :id GET/PUT)")

	// ========================================================================
	// BYOK VAULT ROUTES (Require tenant authentication)
	// ========================================================================

	vault := v1.Group("/vault")
	vault.Use(middleware.BetterAuth(config.DB))

	// Vault key management
	vault.Post("/keys", vaultHandler.StoreKey)                       // POST /v1/vault/keys
	vault.Get("/keys", vaultHandler.ListKeys)                        // GET /v1/vault/keys
	vault.Get("/keys/:provider", vaultHandler.GetKey)                // GET /v1/vault/keys/:provider
	vault.Delete("/keys/:provider", vaultHandler.DeleteKey)          // DELETE /v1/vault/keys/:provider
	vault.Post("/keys/:provider/rotate", vaultHandler.RotateKey)     // POST /v1/vault/keys/:provider/rotate
	vault.Post("/keys/:provider/validate", vaultHandler.ValidateKey) // POST /v1/vault/keys/:provider/validate

	log.Println("[Routes] ✓ Registered 6 BYOK vault endpoints")

	// ========================================================================
	// POLICY ROUTES (Require tenant authentication)
	// ========================================================================

	policy := v1.Group("/policy")
	policy.Use(middleware.BetterAuth(config.DB))

	// Policy management
	policy.Get("/", policyHandler.GetPolicy)               // GET /v1/policy
	policy.Put("/", policyHandler.UpdatePolicy)            // PUT /v1/policy
	policy.Post("/reset", policyHandler.ResetPolicy)       // POST /v1/policy/reset
	policy.Get("/history", policyHandler.GetPolicyHistory) // GET /v1/policy/history

	log.Println("[Routes] ✓ Registered 4 policy management endpoints")

	// ========================================================================
	// USAGE & AUDIT ROUTES (Require tenant authentication)
	// ========================================================================

	usage := v1.Group("/usage")
	usage.Use(middleware.BetterAuth(config.DB))

	// Usage reporting
	usage.Get("/", usageHandler.GetCurrentUsage)           // GET /v1/usage
	usage.Get("/history", usageHandler.GetHistoricalUsage) // GET /v1/usage/history

	log.Println("[Routes] ✓ Registered 2 usage reporting endpoints")

	audit := v1.Group("/audit")
	audit.Use(middleware.BetterAuth(config.DB))

	// Audit log access
	audit.Get("/", usageHandler.GetAuditLogs)          // GET /v1/audit
	audit.Get("/export", usageHandler.ExportAuditLogs) // GET /v1/audit/export

	log.Println("[Routes] ✓ Registered 2 audit log endpoints")

	// ========================================================================
	// TRACES ROUTES (Require tenant authentication)
	// ========================================================================

	traces := v1.Group("/traces")
	traces.Use(middleware.BetterAuth(config.DB))

	// Trace access
	traces.Get("/", tracesHandler.ListTraces)             // GET /v1/traces
	traces.Get("/summary", tracesHandler.GetTraceSummary) // GET /v1/traces/summary

	log.Println("[Routes] ✓ Registered 2 trace endpoints")

	// ========================================================================
	// SUMMARY
	// ========================================================================

	log.Println("[Routes] ═══════════════════════════════════════════════════════")
	log.Println("[Routes] Phase 14 Multi-Tenancy Routes Registration Complete")
	log.Println("[Routes] ═══════════════════════════════════════════════════════")
	log.Println("[Routes] Total endpoints registered: 23")
	log.Println("[Routes]   - Tenant Management: 7 endpoints")
	log.Println("[Routes]   - BYOK Vault: 6 endpoints")
	log.Println("[Routes]   - Policy Management: 4 endpoints")
	log.Println("[Routes]   - Usage & Audit: 4 endpoints")
	log.Println("[Routes]   - Traces: 2 endpoints")
	log.Println("[Routes] ═══════════════════════════════════════════════════════")
}

// RegisterAuthRoutes registers authentication endpoints.
// The legacy login/refresh/logout endpoints now return 410 Gone — authentication
// is handled entirely by Clerk on the frontend. The 2FA sub-group remains active
// and is protected by Clerk JWT verification.
func RegisterAuthRoutes(app *fiber.App, db *sql.DB) {
	// Import auth package for TOTP
	authManager := handlers.NewAuthHandler(db)

	auth := app.Group("/v1/auth")

	// Login endpoint — retired. Authentication is now handled by Clerk on the frontend.
	// The frontend sends Clerk session tokens directly; there is no server-side login flow.
	auth.Post("/login", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusGone).JSON(fiber.Map{
			"error": "This endpoint has been retired. Authentication is now handled by Clerk.",
			"code":  "ENDPOINT_RETIRED",
			"docs":  "https://docs.igrisinertial.com/auth",
		})
	})

	// Refresh token endpoint — retired. Clerk manages session token refresh automatically.
	auth.Post("/refresh", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusGone).JSON(fiber.Map{
			"error": "This endpoint has been retired. Token refresh is managed by Clerk.",
			"code":  "ENDPOINT_RETIRED",
			"docs":  "https://docs.igrisinertial.com/auth",
		})
	})

	// Logout endpoint — Clerk manages session termination on the client side.
	// Sign-out must be performed via Clerk's frontend SDK (clerk.signOut()).
	auth.Post("/logout", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusGone).JSON(fiber.Map{
			"error": "This endpoint has been retired. Use Clerk's signOut() to end the session.",
			"code":  "ENDPOINT_RETIRED",
			"docs":  "https://docs.igrisinertial.com/auth",
		})
	})

	// 2FA endpoints (require Clerk authentication)
	twoFA := auth.Group("/2fa")
	twoFA.Use(middleware.BetterAuth(db))

	twoFA.Get("/status", authManager.Get2FAStatus)         // GET /v1/auth/2fa/status
	twoFA.Post("/generate", authManager.Generate2FASecret) // POST /v1/auth/2fa/generate
	twoFA.Post("/enable", authManager.Enable2FA)           // POST /v1/auth/2fa/enable
	twoFA.Post("/disable", authManager.Disable2FA)         // POST /v1/auth/2fa/disable
	twoFA.Post("/verify", authManager.Verify2FA)           // POST /v1/auth/2fa/verify

	log.Println("[Routes] ✓ Registered 8 authentication endpoints (/v1/auth)")
}

// SetupMultiTenancy is a convenience function to set up all multi-tenancy routes
func SetupMultiTenancy(app *fiber.App, db *sql.DB, jwtSecret, vaultMasterKey string) error {
	log.Println("[Setup] Initializing Phase 14 multi-tenancy...")

	// Initialize JWT manager
	jwtManager, err := security.NewJWTManager(db, jwtSecret, 24, true)
	if err != nil {
		return err
	}

	// Initialize key vault
	keyVault, err := security.NewKeyVault(db, vaultMasterKey)
	if err != nil {
		return err
	}

	// Initialize authentication middleware
	tenantAuth := middleware.NewTenantAuth(jwtManager, db)
	apiKeyAuth := middleware.NewAPIKeyAuth(db)

	// Register routes
	config := &TenancyRouteConfig{
		DB:         db,
		JWTManager: jwtManager,
		KeyVault:   keyVault,
		TenantAuth: tenantAuth,
		APIKeyAuth: apiKeyAuth,
	}

	RegisterTenancyRoutes(app, config)
	RegisterAuthRoutes(app, db)

	if ExperimentalModelRoutesEnabled() {
		providerConfig := &ProviderRegistryRouteConfig{
			DB:         db,
			KeyVault:   keyVault,
			TenantAuth: tenantAuth,
			APIKeyAuth: apiKeyAuth,
		}
		RegisterProviderRegistryRoutes(app, providerConfig)
	} else {
		log.Printf("[Setup] Provider registry routes disabled (%s not enabled)", ExperimentalModelRoutesFlag)
	}

	if ExperimentalRoutingRoutesEnabled() {
		routingConfig := &RoutingRouteConfig{
			DB:         db,
			KeyVault:   keyVault,
			TenantAuth: tenantAuth,
		}
		RegisterRoutingRoutes(app, routingConfig)
	} else {
		log.Printf("[Setup] Intelligent routing routes disabled (%s not enabled)", ExperimentalRoutingRoutesFlag)
	}

	// Register subscription status and plans endpoints (used by web-console billing page)
	polarAPIKey := os.Getenv("POLAR_API_KEY")
	if polarAPIKey != "" && ExperimentalConsoleGapRoutesEnabled() {
		// GatingMiddleware only needs polar client for GetTierUsage
		polarCfg := &billing.PolarConfig{APIKey: polarAPIKey, Redis: nil}
		polarClient, _ := billing.NewPolarClient(*polarCfg)
		if polarClient != nil {
			gating := billing.NewGatingMiddleware(polarClient)
			subHandler := apihandlers.NewSubscriptionHandler(polarClient, gating)

			sub := app.Group("/api/subscription")
			sub.Use(middleware.BetterAuth(db))
			sub.Get("/status", subHandler.GetSubscriptionStatus)
			sub.Get("/plans", subHandler.GetAvailablePlans)
			sub.Get("/upgrade-options", subHandler.GetUpgradeOptions)

			log.Println("[Setup] ✓ Registered subscription endpoints (/api/subscription)")
		}
	} else if polarAPIKey != "" {
		log.Printf("[Setup] subscription endpoints disabled (%s not enabled)", ExperimentalConsoleGapRoutesFlag)
	} else {
		log.Println("[Setup] ⚠ POLAR_API_KEY not set — subscription status endpoints disabled")
	}

	log.Println("[Setup] ✓ Phase 14 multi-tenancy initialization complete")
	return nil
}
