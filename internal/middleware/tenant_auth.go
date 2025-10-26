// Package middleware provides HTTP middleware for tenant authentication and authorization
package middleware

import (
	"database/sql"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/internal/security"
)

// TenantAuth provides tenant authentication middleware
type TenantAuth struct {
	jwtManager *security.JWTManager
	db         *sql.DB
	logger     *log.Logger
	enabled    bool
}

// TenantContextKey is the key used to store tenant info in Fiber context
const TenantContextKey = "tenant"

// TenantContext holds tenant information extracted from JWT
type TenantContext struct {
	TenantID   string
	TenantName string
	Roles      []string
	IsAdmin    bool
}

// NewTenantAuth creates a new tenant authentication middleware
func NewTenantAuth(jwtManager *security.JWTManager, db *sql.DB) *TenantAuth {
	enabled := jwtManager != nil

	return &TenantAuth{
		jwtManager: jwtManager,
		db:         db,
		logger:     log.Default(),
		enabled:    enabled,
	}
}

// Authenticate is the main authentication middleware
// It validates JWT tokens and populates tenant context
func (ta *TenantAuth) Authenticate() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip authentication if disabled (backward compatibility)
		if !ta.enabled {
			return c.Next()
		}

		// Extract token from Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing authorization header",
				"code":  "MISSING_AUTH_HEADER",
			})
		}

		// Check Bearer token format
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid authorization header format. Expected: Bearer <token>",
				"code":  "INVALID_AUTH_FORMAT",
			})
		}

		tokenString := parts[1]

		// Validate token
		claims, err := ta.jwtManager.ValidateToken(tokenString)
		if err != nil {
			ta.logger.Printf("[TenantAuth] Token validation failed: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
				"code":  "INVALID_TOKEN",
			})
		}

		// Verify tenant exists and is active
		tenantStatus, err := ta.getTenantStatus(claims.TenantID)
		if err != nil {
			ta.logger.Printf("[TenantAuth] Failed to get tenant status: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to verify tenant",
				"code":  "TENANT_VERIFICATION_FAILED",
			})
		}

		if tenantStatus != "active" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Tenant account is not active",
				"code":  "TENANT_NOT_ACTIVE",
				"status": tenantStatus,
			})
		}

		// Update tenant last login (async, non-blocking)
		go ta.updateLastLogin(claims.TenantID)

		// Create tenant context
		tenantCtx := &TenantContext{
			TenantID:   claims.TenantID,
			TenantName: claims.TenantName,
			Roles:      claims.Roles,
			IsAdmin:    ta.hasRole(claims.Roles, "admin"),
		}

		// Store in Fiber locals
		c.Locals(TenantContextKey, tenantCtx)

		return c.Next()
	}
}

// RequireAdmin ensures the authenticated user has admin role
func (ta *TenantAuth) RequireAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantCtx := GetTenantContext(c)
		if tenantCtx == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Authentication required",
				"code":  "AUTH_REQUIRED",
			})
		}

		if !tenantCtx.IsAdmin {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Admin privileges required",
				"code":  "ADMIN_REQUIRED",
			})
		}

		return c.Next()
	}
}

// Optional authentication - doesn't fail if no token provided
func (ta *TenantAuth) OptionalAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !ta.enabled {
			return c.Next()
		}

		authHeader := c.Get("Authorization")
		if authHeader == "" {
			// No token provided, continue without authentication
			return c.Next()
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			// Invalid format, continue without authentication
			return c.Next()
		}

		tokenString := parts[1]

		// Try to validate token
		claims, err := ta.jwtManager.ValidateToken(tokenString)
		if err != nil {
			// Invalid token, continue without authentication
			return c.Next()
		}

		// Store tenant context if valid
		tenantCtx := &TenantContext{
			TenantID:   claims.TenantID,
			TenantName: claims.TenantName,
			Roles:      claims.Roles,
			IsAdmin:    ta.hasRole(claims.Roles, "admin"),
		}

		c.Locals(TenantContextKey, tenantCtx)
		return c.Next()
	}
}

// getTenantStatus retrieves the tenant's current status from database
func (ta *TenantAuth) getTenantStatus(tenantID string) (string, error) {
	if ta.db == nil {
		// No database, assume active for backward compatibility
		return "active", nil
	}

	var status string
	err := ta.db.QueryRow(`
		SELECT status FROM tenants WHERE tenant_id = $1
	`, tenantID).Scan(&status)

	if err == sql.ErrNoRows {
		return "", fiber.NewError(fiber.StatusNotFound, "Tenant not found")
	}
	if err != nil {
		return "", err
	}

	return status, nil
}

// updateLastLogin updates the tenant's last login timestamp
func (ta *TenantAuth) updateLastLogin(tenantID string) {
	if ta.db == nil {
		return
	}

	_, err := ta.db.Exec(`
		SELECT update_tenant_last_login($1)
	`, tenantID)

	if err != nil {
		ta.logger.Printf("[TenantAuth] Failed to update last login for %s: %v", tenantID, err)
	}
}

// hasRole checks if a role exists in the roles slice
func (ta *TenantAuth) hasRole(roles []string, role string) bool {
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

// GetTenantContext extracts tenant context from Fiber context
func GetTenantContext(c *fiber.Ctx) *TenantContext {
	if ctx := c.Locals(TenantContextKey); ctx != nil {
		if tenantCtx, ok := ctx.(*TenantContext); ok {
			return tenantCtx
		}
	}
	return nil
}

// GetTenantID is a helper to quickly get the tenant ID from context
func GetTenantID(c *fiber.Ctx) string {
	if ctx := GetTenantContext(c); ctx != nil {
		return ctx.TenantID
	}
	return "default" // Fallback to default for backward compatibility
}

// RequireTenant ensures a tenant is authenticated (alias for Authenticate for clarity)
func (ta *TenantAuth) RequireTenant() fiber.Handler {
	return ta.Authenticate()
}

// APIKeyAuth provides API key authentication (alternative to JWT)
type APIKeyAuth struct {
	db      *sql.DB
	logger  *log.Logger
	enabled bool
}

// NewAPIKeyAuth creates a new API key authentication middleware
func NewAPIKeyAuth(db *sql.DB) *APIKeyAuth {
	return &APIKeyAuth{
		db:      db,
		logger:  log.Default(),
		enabled: db != nil,
	}
}

// Authenticate validates API key and populates tenant context
func (aka *APIKeyAuth) Authenticate() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !aka.enabled {
			return c.Next()
		}

		// Extract API key from header
		apiKey := c.Get("X-API-Key")
		if apiKey == "" {
			// Try Authorization header as fallback
			authHeader := c.Get("Authorization")
			if strings.HasPrefix(authHeader, "ApiKey ") {
				apiKey = strings.TrimPrefix(authHeader, "ApiKey ")
			}
		}

		if apiKey == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing API key",
				"code":  "MISSING_API_KEY",
			})
		}

		// Hash the API key for lookup
		apiKeyHash := security.HashAPIKey(apiKey)

		// Lookup tenant by API key hash
		var tenantID, tenantName, status string
		err := aka.db.QueryRow(`
			SELECT tenant_id, tenant_name, status
			FROM tenants
			WHERE api_key_hash = $1
		`, apiKeyHash).Scan(&tenantID, &tenantName, &status)

		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid API key",
				"code":  "INVALID_API_KEY",
			})
		}
		if err != nil {
			aka.logger.Printf("[APIKeyAuth] Database error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Authentication failed",
				"code":  "AUTH_FAILED",
			})
		}

		if status != "active" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Tenant account is not active",
				"code":  "TENANT_NOT_ACTIVE",
				"status": status,
			})
		}

		// Update last login
		go aka.updateLastLogin(tenantID)

		// Create tenant context
		tenantCtx := &TenantContext{
			TenantID:   tenantID,
			TenantName: tenantName,
			Roles:      []string{"user"}, // API key auth gets user role by default
			IsAdmin:    false,
		}

		c.Locals(TenantContextKey, tenantCtx)
		return c.Next()
	}
}

func (aka *APIKeyAuth) updateLastLogin(tenantID string) {
	if aka.db == nil {
		return
	}

	_, err := aka.db.Exec(`
		SELECT update_tenant_last_login($1)
	`, tenantID)

	if err != nil {
		aka.logger.Printf("[APIKeyAuth] Failed to update last login for %s: %v", tenantID, err)
	}
}

// BypassAuth creates a middleware that bypasses authentication for specific paths
func BypassAuth(paths ...string) fiber.Handler {
	pathMap := make(map[string]bool)
	for _, path := range paths {
		pathMap[path] = true
	}

	return func(c *fiber.Ctx) error {
		// Check if current path should bypass authentication
		if pathMap[c.Path()] {
			return c.Next()
		}

		// Path not in bypass list, continue to authentication
		return c.Next()
	}
}
