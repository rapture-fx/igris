// Package middleware provides HTTP middleware for tenant authentication and authorization
package middleware

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// TenantAuth provides tenant authentication middleware
type TenantAuth struct {
	jwtManager *security.JWTManager
	db         *sql.DB
	logger     *log.Logger
	enabled    bool
	// Worker pool for async operations
	loginQueue chan string
	workerWg   sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

// TenantContextKey is the key used to store tenant info in Fiber context
const TenantContextKey = "tenant"

// TenantContext holds tenant information extracted from JWT
type TenantContext struct {
	TenantID          string
	TenantName        string
	Roles             []string
	IsAdmin           bool
	SpeculativeConfig *TenantSpeculativeConfig // Per-tenant speculative execution config
}

// TenantSpeculativeConfig holds per-tenant speculative execution configuration
type TenantSpeculativeConfig struct {
	Enabled      bool    `json:"enabled"`
	Mode         string  `json:"mode"` // "off", "latency", "quality", "cost", "balanced"
	MaxProviders int     `json:"max_providers"`
}

// NewTenantAuth creates a new tenant authentication middleware
func NewTenantAuth(jwtManager *security.JWTManager, db *sql.DB) *TenantAuth {
	enabled := jwtManager != nil

	ctx, cancel := context.WithCancel(context.Background())

	ta := &TenantAuth{
		jwtManager: jwtManager,
		db:         db,
		logger:     log.Default(),
		enabled:    enabled,
		loginQueue: make(chan string, 1000), // Buffered channel for 1000 pending updates
		ctx:        ctx,
		cancel:     cancel,
	}

	// Start worker pool (5 workers for async login updates)
	numWorkers := 5
	for i := 0; i < numWorkers; i++ {
		ta.workerWg.Add(1)
		go ta.loginWorker(i)
	}

	log.Printf("[TenantAuth] Started %d workers for async login updates", numWorkers)

	return ta
}

// loginWorker processes login updates from the queue
func (ta *TenantAuth) loginWorker(id int) {
	defer ta.workerWg.Done()

	for {
		select {
		case <-ta.ctx.Done():
			ta.logger.Printf("[TenantAuth] Worker %d shutting down", id)
			return
		case tenantID := <-ta.loginQueue:
			// Create context with timeout for database operation
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

			if err := ta.updateLastLoginWithContext(ctx, tenantID); err != nil {
				ta.logger.Printf("[TenantAuth] Worker %d failed to update last login for tenant %s: %v",
					id, tenantID, err)
			}

			cancel()
		}
	}
}

// Stop gracefully shuts down the worker pool
func (ta *TenantAuth) Stop() {
	ta.logger.Println("[TenantAuth] Stopping authentication worker pool...")

	// Signal all workers to stop
	ta.cancel()

	// Close the queue (no more updates accepted)
	close(ta.loginQueue)

	// Wait for all workers to finish with timeout
	done := make(chan struct{})
	go func() {
		ta.workerWg.Wait()
		close(done)
	}()

	select {
	case <-done:
		ta.logger.Println("[TenantAuth] All workers stopped gracefully")
	case <-time.After(10 * time.Second):
		ta.logger.Println("[TenantAuth] Timeout waiting for workers, forcing shutdown")
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

		// Update tenant last login (async, non-blocking via worker pool)
		select {
		case ta.loginQueue <- claims.TenantID:
			// Successfully queued
		default:
			// Queue full, log warning but don't block request
			ta.logger.Printf("[TenantAuth] Login queue full, dropping update for tenant %s", claims.TenantID)
		}

	// P0-3 FIX: Set tenant context in database session for Row-Level Security
	if ta.db != nil {
		if err := ta.setTenantContextInDB(claims.TenantID); err != nil {
			ta.logger.Printf("[TenantAuth] Failed to set tenant context in DB: %v", err)
		}
	}
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

// updateLastLoginWithContext updates the tenant's last login timestamp with context
func (ta *TenantAuth) updateLastLoginWithContext(ctx context.Context, tenantID string) error {
	if ta.db == nil {
		return nil
	}

	_, err := ta.db.ExecContext(ctx, `
		SELECT update_tenant_last_login($1)
	`, tenantID)

	return err
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
	db         *sql.DB
	logger     *log.Logger
	enabled    bool
	// Worker pool for async operations
	loginQueue chan string
	workerWg   sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

// NewAPIKeyAuth creates a new API key authentication middleware
func NewAPIKeyAuth(db *sql.DB) *APIKeyAuth {
	ctx, cancel := context.WithCancel(context.Background())

	aka := &APIKeyAuth{
		db:         db,
		logger:     log.Default(),
		enabled:    db != nil,
		loginQueue: make(chan string, 1000), // Buffered channel
		ctx:        ctx,
		cancel:     cancel,
	}

	// Start worker pool (5 workers)
	numWorkers := 5
	for i := 0; i < numWorkers; i++ {
		aka.workerWg.Add(1)
		go aka.loginWorker(i)
	}

	log.Printf("[APIKeyAuth] Started %d workers for async login updates", numWorkers)

	return aka
}

// loginWorker processes login updates from the queue
func (aka *APIKeyAuth) loginWorker(id int) {
	defer aka.workerWg.Done()

	for {
		select {
		case <-aka.ctx.Done():
			aka.logger.Printf("[APIKeyAuth] Worker %d shutting down", id)
			return
		case tenantID := <-aka.loginQueue:
			// Create context with timeout for database operation
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

			if err := aka.updateLastLoginWithContext(ctx, tenantID); err != nil {
				aka.logger.Printf("[APIKeyAuth] Worker %d failed to update last login for tenant %s: %v",
					id, tenantID, err)
			}

			cancel()
		}
	}
}

// Stop gracefully shuts down the worker pool
func (aka *APIKeyAuth) Stop() {
	aka.logger.Println("[APIKeyAuth] Stopping authentication worker pool...")

	// Signal all workers to stop
	aka.cancel()

	// Close the queue
	close(aka.loginQueue)

	// Wait for all workers to finish with timeout
	done := make(chan struct{})
	go func() {
		aka.workerWg.Wait()
		close(done)
	}()

	select {
	case <-done:
		aka.logger.Println("[APIKeyAuth] All workers stopped gracefully")
	case <-time.After(10 * time.Second):
		aka.logger.Println("[APIKeyAuth] Timeout waiting for workers, forcing shutdown")
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

		// Update last login (async, non-blocking via worker pool)
		select {
		case aka.loginQueue <- tenantID:
	// P0-3 FIX: Set tenant context in database session for Row-Level Security
	if aka.db != nil {
		if err := aka.setTenantContextInDB(tenantID); err != nil {
			aka.logger.Printf("[APIKeyAuth] Failed to set tenant context in DB: %v", err)
		}
	}
			// Successfully queued
		default:
			// Queue full, log warning but don't block request
			aka.logger.Printf("[APIKeyAuth] Login queue full, dropping update for tenant %s", tenantID)
		}

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

func (aka *APIKeyAuth) updateLastLoginWithContext(ctx context.Context, tenantID string) error {
	if aka.db == nil {
		return nil
	}

	_, err := aka.db.ExecContext(ctx, `
		SELECT update_tenant_last_login($1)
	`, tenantID)

	return err
}

// P0-3 FIX: setTenantContextInDB sets the tenant_id in the database session for RLS
func (ta *TenantAuth) setTenantContextInDB(tenantID string) error {
	// Set the app.tenant_id session variable for Row-Level Security
	// This MUST be called after JWT validation to enforce tenant isolation
	_, err := ta.db.Exec(`SELECT set_tenant_context($1)`, tenantID)
	if err != nil {
		return fmt.Errorf("failed to set tenant context: %w", err)
	}
	return nil
}

// P0-3 FIX: setTenantContextInDB for API key auth
func (aka *APIKeyAuth) setTenantContextInDB(tenantID string) error {
	_, err := aka.db.Exec(`SELECT set_tenant_context($1)`, tenantID)
	if err != nil {
		return fmt.Errorf("failed to set tenant context: %w", err)
	}
	return nil
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
