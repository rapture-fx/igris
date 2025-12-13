// Package api provides route registration for Phase 14 multi-tenancy endpoints
package api

import (
	"database/sql"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/Schlep-engine/igris-inertial/cmd/igris-overture/handlers"
	"github.com/Schlep-engine/igris-inertial/internal/middleware"
	"github.com/Schlep-engine/igris-inertial/internal/security"
)

// TenancyRouteConfig holds configuration for tenancy routes
type TenancyRouteConfig struct {
	DB          *sql.DB
	JWTManager  *security.JWTManager
	KeyVault    *security.KeyVault
	TenantAuth  *middleware.TenantAuth
	APIKeyAuth  *middleware.APIKeyAuth
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
	admin.Use(config.TenantAuth.Authenticate())
	admin.Use(config.TenantAuth.RequireAdmin())

	// Tenant Management (Admin only)
	admin.Post("/", tenantHandler.CreateTenant)                   // POST /v1/tenants
	admin.Get("/", tenantHandler.ListTenants)                     // GET /v1/tenants
	admin.Post("/:tenant_id/suspend", tenantHandler.SuspendTenant) // POST /v1/tenants/:id/suspend
	admin.Post("/:tenant_id/activate", tenantHandler.ActivateTenant) // POST /v1/tenants/:id/activate
	admin.Delete("/:tenant_id", tenantHandler.DeleteTenant)       // DELETE /v1/tenants/:id

	log.Println("[Routes] ✓ Registered 5 admin tenant management endpoints")

	// ========================================================================
	// TENANT ROUTES (Require tenant authentication - admin or self)
	// ========================================================================

	tenants := v1.Group("/tenants")
	tenants.Use(config.TenantAuth.Authenticate())

	// Tenant self-service
	tenants.Get("/:tenant_id", tenantHandler.GetTenant)    // GET /v1/tenants/:id
	tenants.Put("/:tenant_id", tenantHandler.UpdateTenant) // PUT /v1/tenants/:id

	log.Println("[Routes] ✓ Registered 2 tenant self-service endpoints")

	// ========================================================================
	// BYOK VAULT ROUTES (Require tenant authentication)
	// ========================================================================

	vault := v1.Group("/vault")
	vault.Use(config.TenantAuth.Authenticate())

	// Vault key management
	vault.Post("/keys", vaultHandler.StoreKey)                          // POST /v1/vault/keys
	vault.Get("/keys", vaultHandler.ListKeys)                           // GET /v1/vault/keys
	vault.Get("/keys/:provider", vaultHandler.GetKey)                   // GET /v1/vault/keys/:provider
	vault.Delete("/keys/:provider", vaultHandler.DeleteKey)             // DELETE /v1/vault/keys/:provider
	vault.Post("/keys/:provider/rotate", vaultHandler.RotateKey)        // POST /v1/vault/keys/:provider/rotate
	vault.Post("/keys/:provider/validate", vaultHandler.ValidateKey)    // POST /v1/vault/keys/:provider/validate

	log.Println("[Routes] ✓ Registered 6 BYOK vault endpoints")

	// ========================================================================
	// POLICY ROUTES (Require tenant authentication)
	// ========================================================================

	policy := v1.Group("/policy")
	policy.Use(config.TenantAuth.Authenticate())

	// Policy management
	policy.Get("/", policyHandler.GetPolicy)           // GET /v1/policy
	policy.Put("/", policyHandler.UpdatePolicy)        // PUT /v1/policy
	policy.Post("/reset", policyHandler.ResetPolicy)   // POST /v1/policy/reset
	policy.Get("/history", policyHandler.GetPolicyHistory) // GET /v1/policy/history

	log.Println("[Routes] ✓ Registered 4 policy management endpoints")

	// ========================================================================
	// USAGE & AUDIT ROUTES (Require tenant authentication)
	// ========================================================================

	usage := v1.Group("/usage")
	usage.Use(config.TenantAuth.Authenticate())

	// Usage reporting
	usage.Get("/", usageHandler.GetCurrentUsage)       // GET /v1/usage
	usage.Get("/history", usageHandler.GetHistoricalUsage) // GET /v1/usage/history

	log.Println("[Routes] ✓ Registered 2 usage reporting endpoints")

	audit := v1.Group("/audit")
	audit.Use(config.TenantAuth.Authenticate())

	// Audit log access
	audit.Get("/", usageHandler.GetAuditLogs)          // GET /v1/audit
	audit.Get("/export", usageHandler.ExportAuditLogs) // GET /v1/audit/export

	log.Println("[Routes] ✓ Registered 2 audit log endpoints")

	// ========================================================================
	// TRACES ROUTES (Require tenant authentication)
	// ========================================================================

	traces := v1.Group("/traces")
	traces.Use(config.TenantAuth.Authenticate())

	// Trace access
	traces.Get("/", tracesHandler.ListTraces)           // GET /v1/traces
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

// RegisterAuthRoutes registers authentication endpoints (optional)
func RegisterAuthRoutes(app *fiber.App, jwtManager *security.JWTManager, db *sql.DB) {
	// Import auth package for TOTP
	authManager := handlers.NewAuthHandler(db)

	auth := app.Group("/v1/auth")

	// Login endpoint (generates JWT from API key)
	auth.Post("/login", func(c *fiber.Ctx) error {
		var req struct {
			APIKey string `json:"api_key"`
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		// Hash API key
		apiKeyHash := security.HashAPIKey(req.APIKey)

		// Lookup tenant
		var tenantID, tenantName, status string
		err := db.QueryRow(`
			SELECT tenant_id, tenant_name, status
			FROM tenants
			WHERE api_key_hash = $1
		`, apiKeyHash).Scan(&tenantID, &tenantName, &status)

		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid API key",
			})
		}
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Authentication failed",
			})
		}

		if status != "active" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Tenant account is not active",
				"status": status,
			})
		}

		// Generate JWT
		tokenInfo, err := jwtManager.GenerateToken(
			tenantID,
			tenantName,
			[]string{"user"},
			c.IP(),
			c.Get("User-Agent"),
		)

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to generate token",
			})
		}

		return c.JSON(fiber.Map{
			"token":      tokenInfo.Token,
			"tenant_id":  tenantID,
			"expires_at": tokenInfo.ExpiresAt,
		})
	})

	// Refresh token endpoint
	auth.Post("/refresh", func(c *fiber.Ctx) error {
		var req struct {
			Token string `json:"token"`
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		// Refresh token
		newToken, err := jwtManager.RefreshToken(
			req.Token,
			c.IP(),
			c.Get("User-Agent"),
		)

		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		return c.JSON(fiber.Map{
			"token":      newToken.Token,
			"expires_at": newToken.ExpiresAt,
		})
	})

	// Logout endpoint (revoke token)
	auth.Post("/logout", func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Missing authorization header",
			})
		}

		// Extract token
		token := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		} else {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid authorization format",
			})
		}

		// Revoke token
		if err := jwtManager.RevokeToken(token, "logout"); err != nil {
			log.Printf("[Auth] Failed to revoke token: %v", err)
		}

		return c.JSON(fiber.Map{
			"message": "Logged out successfully",
		})
	})

	// 2FA endpoints (require authentication)
	twoFA := auth.Group("/2fa")
	twoFA.Use(middleware.NewTenantAuth(jwtManager, db).Authenticate())

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
	RegisterAuthRoutes(app, jwtManager, db)

	// Register provider registry routes
	providerConfig := &ProviderRegistryRouteConfig{
		DB:         db,
		KeyVault:   keyVault,
		TenantAuth: tenantAuth,
		APIKeyAuth: apiKeyAuth,
	}
	RegisterProviderRegistryRoutes(app, providerConfig)

	// Register intelligent routing routes
	routingConfig := &RoutingRouteConfig{
		DB:         db,
		KeyVault:   keyVault,
		TenantAuth: tenantAuth,
	}
	RegisterRoutingRoutes(app, routingConfig)

	log.Println("[Setup] ✓ Phase 14 multi-tenancy initialization complete")
	return nil
}
