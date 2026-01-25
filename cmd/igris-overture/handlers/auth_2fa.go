// Package handlers provides HTTP handlers for 2FA authentication
package handlers

import (
	"database/sql"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/igris-overture/auth"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// AuthHandler handles 2FA authentication operations
type AuthHandler struct {
	totpManager *auth.TOTPManager
	db          *sql.DB
	logger      *log.Logger
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(db *sql.DB) *AuthHandler {
	totpManager := auth.NewTOTPManager(db, "Schlep-Engine")
	return &AuthHandler{
		totpManager: totpManager,
		db:          db,
		logger:      log.Default(),
	}
}

// Get2FAStatus returns the 2FA status for the authenticated tenant
// GET /v1/auth/2fa/status
func (ah *AuthHandler) Get2FAStatus(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	enabled, err := ah.totpManager.Get2FAStatus(tenantID)
	if err != nil {
		ah.logger.Printf("[Auth2FA] Failed to get 2FA status: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get 2FA status",
			"code":  "QUERY_FAILED",
		})
	}

	return c.JSON(fiber.Map{
		"enabled": enabled,
	})
}

// Generate2FASecret generates a new TOTP secret
// POST /v1/auth/2fa/generate
func (ah *AuthHandler) Generate2FASecret(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	// Get tenant name
	var tenantName string
	err := ah.db.QueryRow(`
		SELECT tenant_name FROM tenants WHERE tenant_id = $1
	`, tenantID).Scan(&tenantName)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get tenant info",
			"code":  "QUERY_FAILED",
		})
	}

	secret, qrCodeURL, err := ah.totpManager.GenerateSecret(tenantID, tenantName)
	if err != nil {
		ah.logger.Printf("[Auth2FA] Failed to generate secret: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate 2FA secret",
			"code":  "GENERATION_FAILED",
		})
	}

	// Generate backup codes
	backupCodes, err := ah.totpManager.GenerateBackupCodes()
	if err != nil {
		ah.logger.Printf("[Auth2FA] Failed to generate backup codes: %v", err)
		backupCodes = []string{}
	}

	return c.JSON(fiber.Map{
		"secret":       secret,
		"qr_code_url":  qrCodeURL,
		"backup_codes": backupCodes,
	})
}

// Enable2FA enables 2FA for the authenticated tenant
// POST /v1/auth/2fa/enable
func (ah *AuthHandler) Enable2FA(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	var req struct {
		Secret string `json:"secret" validate:"required"`
		Code   string `json:"code" validate:"required"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	if req.Secret == "" || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Secret and code are required",
			"code":  "MISSING_FIELDS",
		})
	}

	err := ah.totpManager.Enable2FA(tenantID, req.Secret, req.Code)
	if err != nil {
		ah.logger.Printf("[Auth2FA] Failed to enable 2FA: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
			"code":  "ENABLE_FAILED",
		})
	}

	ah.logger.Printf("[Auth2FA] Enabled 2FA for tenant: %s", tenantID)

	return c.JSON(fiber.Map{
		"message": "2FA enabled successfully",
		"enabled": true,
	})
}

// Disable2FA disables 2FA for the authenticated tenant
// POST /v1/auth/2fa/disable
func (ah *AuthHandler) Disable2FA(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	var req struct {
		Code string `json:"code" validate:"required"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	// Verify 2FA code before disabling
	valid, err := ah.totpManager.Verify2FA(tenantID, req.Code)
	if err != nil || !valid {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid 2FA code",
			"code":  "INVALID_CODE",
		})
	}

	err = ah.totpManager.Disable2FA(tenantID)
	if err != nil {
		ah.logger.Printf("[Auth2FA] Failed to disable 2FA: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to disable 2FA",
			"code":  "DISABLE_FAILED",
		})
	}

	ah.logger.Printf("[Auth2FA] Disabled 2FA for tenant: %s", tenantID)

	return c.JSON(fiber.Map{
		"message": "2FA disabled successfully",
		"enabled": false,
	})
}

// Verify2FA verifies a 2FA code
// POST /v1/auth/2fa/verify
func (ah *AuthHandler) Verify2FA(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantID(c)

	var req struct {
		Code string `json:"code" validate:"required"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	valid, err := ah.totpManager.Verify2FA(tenantID, req.Code)
	if err != nil {
		ah.logger.Printf("[Auth2FA] Failed to verify 2FA: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
			"code":  "VERIFY_FAILED",
		})
	}

	if !valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid 2FA code",
			"code":  "INVALID_CODE",
			"valid": false,
		})
	}

	return c.JSON(fiber.Map{
		"valid":   true,
		"message": "2FA code verified successfully",
	})
}
