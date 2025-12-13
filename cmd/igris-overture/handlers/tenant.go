// Package handlers provides HTTP handlers for tenant management (Phase 14)
package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Schlep-engine/igris-inertial/igris-overture/middleware"
	"github.com/Schlep-engine/igris-inertial/igris-overture/security"
)

// TenantHandler handles tenant management operations
type TenantHandler struct {
	db         *sql.DB
	jwtManager *security.JWTManager
	logger     *log.Logger
}

// NewTenantHandler creates a new tenant handler
func NewTenantHandler(db *sql.DB, jwtManager *security.JWTManager) *TenantHandler {
	return &TenantHandler{
		db:         db,
		jwtManager: jwtManager,
		logger:     log.Default(),
	}
}

// CreateTenantRequest represents the request to create a new tenant
type CreateTenantRequest struct {
	TenantID   string `json:"tenant_id" validate:"required,min=3,max=255"`
	TenantName string `json:"tenant_name" validate:"required,min=3,max=255"`
	Email      string `json:"email" validate:"required,email"`
	Company    string `json:"company,omitempty"`
}

// CreateTenantResponse represents the response after creating a tenant
type CreateTenantResponse struct {
	TenantID   string `json:"tenant_id"`
	TenantName string `json:"tenant_name"`
	Email      string `json:"email"`
	APIKey     string `json:"api_key"` // Returned only once during creation
	Status     string `json:"status"`
	CreatedAt  string `json:"created_at"`
}

// TenantResponse represents a tenant in API responses
type TenantResponse struct {
	TenantID     string  `json:"tenant_id"`
	TenantName   string  `json:"tenant_name"`
	Email        string  `json:"email"`
	Company      string  `json:"company,omitempty"`
	Status       string  `json:"status"`
	APIKeyPrefix string  `json:"api_key_prefix"` // Only shows prefix for security
	CreatedAt    string  `json:"created_at"`
	LastLoginAt  *string `json:"last_login_at,omitempty"`
}

// CreateTenant creates a new tenant (admin only)
// POST /v1/tenants
func (h *TenantHandler) CreateTenant(c *fiber.Ctx) error {
	// Parse request
	var req CreateTenantRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	// Validate tenant_id format (lowercase alphanumeric and hyphens only)
	if !isValidTenantID(req.TenantID) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid tenant_id format. Use lowercase letters, numbers, and hyphens only",
			"code":  "INVALID_TENANT_ID",
		})
	}

	// Generate API key for the tenant
	apiKey, err := generateAPIKey()
	if err != nil {
		h.logger.Printf("[TenantHandler] Failed to generate API key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate API key",
			"code":  "KEY_GENERATION_FAILED",
		})
	}

	apiKeyHash := security.HashAPIKey(apiKey)
	apiKeyPrefix := security.GetAPIKeyPrefix(apiKey)

	// Get admin user from context
	tenantCtx := middleware.GetTenantContext(c)
	createdBy := "system"
	if tenantCtx != nil {
		createdBy = tenantCtx.TenantID
	}

	// Create tenant in database
	var tenantID string
	err = h.db.QueryRow(`
		SELECT create_tenant($1, $2, $3, $4, $5, $6)
	`, req.TenantID, req.TenantName, apiKeyHash, apiKeyPrefix, req.Email, createdBy).Scan(&tenantID)

	if err != nil {
		h.logger.Printf("[TenantHandler] Failed to create tenant: %v", err)

		// Check for duplicate tenant_id
		if isDuplicateError(err) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "Tenant ID already exists",
				"code":  "TENANT_EXISTS",
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create tenant",
			"code":  "CREATION_FAILED",
		})
	}

	// Update company if provided
	if req.Company != "" {
		_, err = h.db.Exec(`
			UPDATE tenants SET company = $1 WHERE tenant_id = $2
		`, req.Company, req.TenantID)
		if err != nil {
			h.logger.Printf("[TenantHandler] Failed to update company: %v", err)
		}
	}

	h.logger.Printf("[TenantHandler] Created tenant: %s", req.TenantID)

	// Return tenant info with API key (only returned once!)
	return c.Status(fiber.StatusCreated).JSON(&CreateTenantResponse{
		TenantID:   req.TenantID,
		TenantName: req.TenantName,
		Email:      req.Email,
		APIKey:     apiKey, // WARNING: Only returned once during creation!
		Status:     "active",
		CreatedAt:  time.Now().Format(time.RFC3339),
	})
}

// ListTenants lists all tenants (admin only)
// GET /v1/tenants
func (h *TenantHandler) ListTenants(c *fiber.Ctx) error {
	// Get query parameters
	status := c.Query("status", "active")
	limit := c.QueryInt("limit", 50)
	offset := c.QueryInt("offset", 0)

	if limit > 100 {
		limit = 100 // Max 100 tenants per page
	}

	query := `
		SELECT tenant_id, tenant_name, email, company, status,
		       api_key_prefix, created_at, last_login_at
		FROM tenants
		WHERE ($1 = 'all' OR status = $1)
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := h.db.Query(query, status, limit, offset)
	if err != nil {
		h.logger.Printf("[TenantHandler] Failed to list tenants: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve tenants",
			"code":  "QUERY_FAILED",
		})
	}
	defer rows.Close()

	var tenants []*TenantResponse
	for rows.Next() {
		var tenant TenantResponse
		var company, email sql.NullString
		var lastLogin sql.NullTime

		err := rows.Scan(
			&tenant.TenantID,
			&tenant.TenantName,
			&email,
			&company,
			&tenant.Status,
			&tenant.APIKeyPrefix,
			&tenant.CreatedAt,
			&lastLogin,
		)
		if err != nil {
			h.logger.Printf("[TenantHandler] Error scanning tenant: %v", err)
			continue
		}

		if email.Valid {
			tenant.Email = email.String
		}
		if company.Valid {
			tenant.Company = company.String
		}
		if lastLogin.Valid {
			lastLoginStr := lastLogin.Time.Format(time.RFC3339)
			tenant.LastLoginAt = &lastLoginStr
		}

		tenants = append(tenants, &tenant)
	}

	// Get total count
	var total int
	err = h.db.QueryRow(`
		SELECT COUNT(*) FROM tenants
		WHERE ($1 = 'all' OR status = $1)
	`, status).Scan(&total)
	if err != nil {
		total = len(tenants)
	}

	return c.JSON(fiber.Map{
		"tenants": tenants,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// GetTenant retrieves a specific tenant
// GET /v1/tenants/:tenant_id
func (h *TenantHandler) GetTenant(c *fiber.Ctx) error {
	tenantID := c.Params("tenant_id")

	// Check if user can access this tenant
	if !h.canAccessTenant(c, tenantID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied to this tenant",
			"code":  "ACCESS_DENIED",
		})
	}

	var tenant TenantResponse
	var company, email sql.NullString
	var lastLogin sql.NullTime

	err := h.db.QueryRow(`
		SELECT tenant_id, tenant_name, email, company, status,
		       api_key_prefix, created_at, last_login_at
		FROM tenants
		WHERE tenant_id = $1
	`, tenantID).Scan(
		&tenant.TenantID,
		&tenant.TenantName,
		&email,
		&company,
		&tenant.Status,
		&tenant.APIKeyPrefix,
		&tenant.CreatedAt,
		&lastLogin,
	)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Tenant not found",
			"code":  "TENANT_NOT_FOUND",
		})
	}
	if err != nil {
		h.logger.Printf("[TenantHandler] Failed to get tenant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve tenant",
			"code":  "QUERY_FAILED",
		})
	}

	if email.Valid {
		tenant.Email = email.String
	}
	if company.Valid {
		tenant.Company = company.String
	}
	if lastLogin.Valid {
		lastLoginStr := lastLogin.Time.Format(time.RFC3339)
		tenant.LastLoginAt = &lastLoginStr
	}

	return c.JSON(&tenant)
}

// UpdateTenant updates tenant information
// PUT /v1/tenants/:tenant_id
func (h *TenantHandler) UpdateTenant(c *fiber.Ctx) error {
	tenantID := c.Params("tenant_id")

	// Check if user can access this tenant
	if !h.canAccessTenant(c, tenantID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied to this tenant",
			"code":  "ACCESS_DENIED",
		})
	}

	var req struct {
		TenantName string `json:"tenant_name,omitempty"`
		Email      string `json:"email,omitempty"`
		Company    string `json:"company,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	// Build update query dynamically
	updates := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.TenantName != "" {
		updates = append(updates, fmt.Sprintf("tenant_name = $%d", argIndex))
		args = append(args, req.TenantName)
		argIndex++
	}
	if req.Email != "" {
		updates = append(updates, fmt.Sprintf("email = $%d", argIndex))
		args = append(args, req.Email)
		argIndex++
	}
	if req.Company != "" {
		updates = append(updates, fmt.Sprintf("company = $%d", argIndex))
		args = append(args, req.Company)
		argIndex++
	}

	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "No fields to update",
			"code":  "NO_UPDATES",
		})
	}

	// Add tenant_id as last parameter
	args = append(args, tenantID)

	query := fmt.Sprintf(`
		UPDATE tenants
		SET %s, updated_at = NOW()
		WHERE tenant_id = $%d
	`, joinStrings(updates, ", "), argIndex)

	result, err := h.db.Exec(query, args...)
	if err != nil {
		h.logger.Printf("[TenantHandler] Failed to update tenant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update tenant",
			"code":  "UPDATE_FAILED",
		})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Tenant not found",
			"code":  "TENANT_NOT_FOUND",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Tenant updated successfully",
	})
}

// SuspendTenant suspends a tenant (admin only)
// POST /v1/tenants/:tenant_id/suspend
func (h *TenantHandler) SuspendTenant(c *fiber.Ctx) error {
	tenantID := c.Params("tenant_id")

	if tenantID == "default" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cannot suspend default tenant",
			"code":  "CANNOT_SUSPEND_DEFAULT",
		})
	}

	_, err := h.db.Exec(`
		UPDATE tenants
		SET status = 'suspended', updated_at = NOW()
		WHERE tenant_id = $1
	`, tenantID)

	if err != nil {
		h.logger.Printf("[TenantHandler] Failed to suspend tenant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to suspend tenant",
			"code":  "SUSPEND_FAILED",
		})
	}

	// Revoke all active tokens
	if h.jwtManager != nil {
		err = h.jwtManager.RevokeAllTenantTokens(tenantID, "tenant_suspended")
		if err != nil {
			h.logger.Printf("[TenantHandler] Failed to revoke tokens: %v", err)
		}
	}

	h.logger.Printf("[TenantHandler] Suspended tenant: %s", tenantID)

	return c.JSON(fiber.Map{
		"message": "Tenant suspended successfully",
		"tenant_id": tenantID,
	})
}

// ActivateTenant activates a suspended tenant (admin only)
// POST /v1/tenants/:tenant_id/activate
func (h *TenantHandler) ActivateTenant(c *fiber.Ctx) error {
	tenantID := c.Params("tenant_id")

	_, err := h.db.Exec(`
		UPDATE tenants
		SET status = 'active', updated_at = NOW()
		WHERE tenant_id = $1
	`, tenantID)

	if err != nil {
		h.logger.Printf("[TenantHandler] Failed to activate tenant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to activate tenant",
			"code":  "ACTIVATE_FAILED",
		})
	}

	h.logger.Printf("[TenantHandler] Activated tenant: %s", tenantID)

	return c.JSON(fiber.Map{
		"message": "Tenant activated successfully",
		"tenant_id": tenantID,
	})
}

// DeleteTenant soft-deletes a tenant (admin only)
// DELETE /v1/tenants/:tenant_id
func (h *TenantHandler) DeleteTenant(c *fiber.Ctx) error {
	tenantID := c.Params("tenant_id")

	if tenantID == "default" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cannot delete default tenant",
			"code":  "CANNOT_DELETE_DEFAULT",
		})
	}

	// Soft delete by setting status to deleted
	_, err := h.db.Exec(`
		UPDATE tenants
		SET status = 'deleted', updated_at = NOW()
		WHERE tenant_id = $1
	`, tenantID)

	if err != nil {
		h.logger.Printf("[TenantHandler] Failed to delete tenant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete tenant",
			"code":  "DELETE_FAILED",
		})
	}

	// Revoke all tokens
	if h.jwtManager != nil {
		err = h.jwtManager.RevokeAllTenantTokens(tenantID, "tenant_deleted")
		if err != nil {
			h.logger.Printf("[TenantHandler] Failed to revoke tokens: %v", err)
		}
	}

	h.logger.Printf("[TenantHandler] Deleted tenant: %s", tenantID)

	return c.JSON(fiber.Map{
		"message": "Tenant deleted successfully",
		"tenant_id": tenantID,
	})
}

// Helper functions

func (h *TenantHandler) canAccessTenant(c *fiber.Ctx, tenantID string) bool {
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return false
	}

	// Admin can access all tenants
	if tenantCtx.IsAdmin {
		return true
	}

	// Regular users can only access their own tenant
	return tenantCtx.TenantID == tenantID
}

func generateAPIKey() (string, error) {
	// Generate 32 random bytes
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	// Encode as hex and add prefix
	return "schlep_" + hex.EncodeToString(bytes), nil
}

func isValidTenantID(tenantID string) bool {
	if len(tenantID) < 3 || len(tenantID) > 255 {
		return false
	}

	for _, char := range tenantID {
		if !((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char == '-') {
			return false
		}
	}

	return true
}

func isDuplicateError(err error) bool {
	// PostgreSQL unique violation error code
	return err != nil && (
		containsString(err.Error(), "duplicate key") ||
		containsString(err.Error(), "already exists") ||
		containsString(err.Error(), "unique constraint"))
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) &&
		(s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
		findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}
