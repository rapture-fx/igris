// Package handlers provides HTTP handlers for BYOK vault management (Phase 14)
package handlers

import (
	"database/sql"
	"log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
	"github.com/gofiber/fiber/v2"
)

// VaultHandler handles BYOK vault operations
type VaultHandler struct {
	vault  *security.KeyVault
	db     *sql.DB
	logger *log.Logger
}

// NewVaultHandler creates a new vault handler
func NewVaultHandler(vault *security.KeyVault, db *sql.DB) *VaultHandler {
	return &VaultHandler{
		vault:  vault,
		db:     db,
		logger: log.Default(),
	}
}

// StoreKeyRequest represents a request to store an API key
type StoreKeyRequest struct {
	Provider string `json:"provider" validate:"required"`
	KeyName  string `json:"key_name" validate:"required"`
	APIKey   string `json:"api_key" validate:"required"`
}

// StoreKeyResponse represents the response after storing a key
type StoreKeyResponse struct {
	ID        string `json:"id"`
	Provider  string `json:"provider"`
	KeyName   string `json:"key_name"`
	MaskedKey string `json:"masked_key"`
	IsActive  bool   `json:"is_active"`
	CreatedAt string `json:"created_at"`
}

// KeyListResponse represents a key in list responses
type KeyListResponse struct {
	ID            string  `json:"id"`
	Provider      string  `json:"provider"`
	KeyName       string  `json:"key_name"`
	MaskedKey     string  `json:"masked_key"`
	IsActive      bool    `json:"is_active"`
	IsValid       *bool   `json:"is_valid,omitempty"`
	LastValidated *string `json:"last_validated,omitempty"`
	LastUsed      *string `json:"last_used,omitempty"`
	UsageCount    int64   `json:"usage_count"`
	CreatedAt     string  `json:"created_at"`
}

// StoreKey stores an encrypted API key for a tenant
// POST /v1/vault/keys
func (vh *VaultHandler) StoreKey(c *fiber.Ctx) error {
	// Get tenant from context
	tenantID := middleware.GetTenantID(c)

	// Parse request
	var req StoreKeyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	// Validate provider
	validProviders := map[string]bool{
		"openai":        true,
		"anthropic":     true,
		"benchmark":     true,
		"groq":          true,
		"xai":           true,
		"qwen":          true,
		"kimi":          true,
		"moonshot":      true,
		"glm":           true,
		"zai":           true,
		"deepseek":      true,
		"mistral":       true,
		"google":        true,
		"google_gemini": true,
		"cohere":        true,
		"azure":         true,
		"custom":        true,
	}
	if !validProviders[req.Provider] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid provider. Must be a supported verified provider or custom provider key",
			"code":  "INVALID_PROVIDER",
		})
	}

	// Validate API key format
	if len(req.APIKey) < 20 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "API key too short",
			"code":  "INVALID_API_KEY",
		})
	}

	// Get creator from context
	createdBy := tenantID
	if tenantCtx := middleware.GetTenantContext(c); tenantCtx != nil {
		createdBy = tenantCtx.TenantID
	}

	// Store encrypted key
	encKey, err := vh.vault.StoreKey(tenantID, req.Provider, req.KeyName, req.APIKey, createdBy)
	if err != nil {
		vh.logger.Printf("[VaultHandler] Failed to store key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to store API key",
			"code":  "STORAGE_FAILED",
		})
	}

	vh.logger.Printf("[VaultHandler] Stored %s key for tenant: %s", req.Provider, tenantID)

	// Return response with masked key
	return c.Status(fiber.StatusCreated).JSON(&StoreKeyResponse{
		ID:        encKey.ID,
		Provider:  encKey.Provider,
		KeyName:   encKey.KeyName,
		MaskedKey: maskAPIKey(req.APIKey),
		IsActive:  encKey.IsActive,
		CreatedAt: encKey.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// ListKeys lists all API keys for a tenant (masked)
// GET /v1/vault/keys
func (vh *VaultHandler) ListKeys(c *fiber.Ctx) error {
	// Get tenant from context
	tenantID := middleware.GetTenantID(c)

	// Get query parameter for provider filter
	provider := c.Query("provider", "")

	// List keys
	keys, err := vh.vault.ListKeys(tenantID)
	if err != nil {
		vh.logger.Printf("[VaultHandler] Failed to list keys: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve keys",
			"code":  "QUERY_FAILED",
		})
	}

	// Filter by provider if specified
	var filteredKeys []*KeyListResponse
	for _, key := range keys {
		if provider != "" && key.Provider != provider {
			continue
		}

		keyResp := &KeyListResponse{
			ID:         key.ID,
			Provider:   key.Provider,
			KeyName:    key.KeyName,
			MaskedKey:  key.MaskedKey,
			IsActive:   key.IsActive,
			IsValid:    key.IsValid,
			UsageCount: key.UsageCount,
			CreatedAt:  key.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}

		if key.LastValidated != nil {
			validated := key.LastValidated.Format("2006-01-02T15:04:05Z")
			keyResp.LastValidated = &validated
		}
		if key.LastUsed != nil {
			used := key.LastUsed.Format("2006-01-02T15:04:05Z")
			keyResp.LastUsed = &used
		}

		filteredKeys = append(filteredKeys, keyResp)
	}

	return c.JSON(fiber.Map{
		"keys":  filteredKeys,
		"count": len(filteredKeys),
	})
}

// GetKey retrieves a specific API key (masked)
// GET /v1/vault/keys/:provider
func (vh *VaultHandler) GetKey(c *fiber.Ctx) error {
	// Get tenant from context
	tenantID := middleware.GetTenantID(c)
	provider := c.Params("provider")

	// List all keys and find the active one for this provider
	keys, err := vh.vault.ListKeys(tenantID)
	if err != nil {
		vh.logger.Printf("[VaultHandler] Failed to get key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve key",
			"code":  "QUERY_FAILED",
		})
	}

	// Find active key for provider
	for _, key := range keys {
		if key.Provider == provider && key.IsActive {
			keyResp := &KeyListResponse{
				ID:         key.ID,
				Provider:   key.Provider,
				KeyName:    key.KeyName,
				MaskedKey:  key.MaskedKey,
				IsActive:   key.IsActive,
				IsValid:    key.IsValid,
				UsageCount: key.UsageCount,
				CreatedAt:  key.CreatedAt.Format("2006-01-02T15:04:05Z"),
			}

			if key.LastValidated != nil {
				validated := key.LastValidated.Format("2006-01-02T15:04:05Z")
				keyResp.LastValidated = &validated
			}
			if key.LastUsed != nil {
				used := key.LastUsed.Format("2006-01-02T15:04:05Z")
				keyResp.LastUsed = &used
			}

			return c.JSON(keyResp)
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error": "No active key found for provider",
		"code":  "KEY_NOT_FOUND",
	})
}

// DeleteKey deletes an API key for a provider
// DELETE /v1/vault/keys/:provider
func (vh *VaultHandler) DeleteKey(c *fiber.Ctx) error {
	// Get tenant from context
	tenantID := middleware.GetTenantID(c)
	provider := c.Params("provider")

	// Delete key
	err := vh.vault.DeleteKey(tenantID, provider)
	if err != nil {
		vh.logger.Printf("[VaultHandler] Failed to delete key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete key",
			"code":  "DELETE_FAILED",
		})
	}

	vh.logger.Printf("[VaultHandler] Deleted %s key for tenant: %s", provider, tenantID)

	return c.JSON(fiber.Map{
		"message":  "API key deleted successfully",
		"provider": provider,
	})
}

// RotateKey rotates an API key (stores new key, deactivates old)
// POST /v1/vault/keys/:provider/rotate
func (vh *VaultHandler) RotateKey(c *fiber.Ctx) error {
	// Get tenant from context
	tenantID := middleware.GetTenantID(c)
	provider := c.Params("provider")

	// Parse new key
	var req struct {
		NewAPIKey string `json:"new_api_key" validate:"required"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	if len(req.NewAPIKey) < 20 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "New API key too short",
			"code":  "INVALID_API_KEY",
		})
	}

	// Store new key (this automatically deactivates old ones)
	createdBy := tenantID
	if tenantCtx := middleware.GetTenantContext(c); tenantCtx != nil {
		createdBy = tenantCtx.TenantID
	}

	encKey, err := vh.vault.StoreKey(tenantID, provider, "rotated", req.NewAPIKey, createdBy)
	if err != nil {
		vh.logger.Printf("[VaultHandler] Failed to rotate key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to rotate key",
			"code":  "ROTATION_FAILED",
		})
	}

	vh.logger.Printf("[VaultHandler] Rotated %s key for tenant: %s", provider, tenantID)

	return c.JSON(fiber.Map{
		"message":    "API key rotated successfully",
		"provider":   provider,
		"new_key_id": encKey.ID,
		"masked_key": maskAPIKey(req.NewAPIKey),
	})
}

// ValidateKey validates that a stored API key works with the provider
// POST /v1/vault/keys/:provider/validate
func (vh *VaultHandler) ValidateKey(c *fiber.Ctx) error {
	// Get tenant from context
	tenantID := middleware.GetTenantID(c)
	provider := c.Params("provider")

	// Retrieve and decrypt key
	decKey, err := vh.vault.GetKey(tenantID, provider)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "No active key found for provider",
			"code":  "KEY_NOT_FOUND",
		})
	}

	// TODO: Actually validate the key by making a test API call to the provider
	// For now, just return that it exists
	isValid := true
	validationMessage := "Key retrieved successfully (full validation not implemented)"

	// Update validation status in database
	if vh.db != nil {
		_, err = vh.db.Exec(`
			UPDATE tenant_keys
			SET is_valid = $1, last_validated_at = NOW()
			WHERE tenant_id = $2 AND provider = $3 AND is_active = TRUE
		`, isValid, tenantID, provider)

		if err != nil {
			vh.logger.Printf("[VaultHandler] Failed to update validation status: %v", err)
		}
	}

	vh.logger.Printf("[VaultHandler] Validated %s key for tenant: %s", provider, tenantID)

	return c.JSON(fiber.Map{
		"provider": provider,
		"is_valid": isValid,
		"message":  validationMessage,
		"key_name": decKey.KeyName,
	})
}

// Helper functions

func maskAPIKey(apiKey string) string {
	if len(apiKey) <= 8 {
		return "****"
	}
	prefix := apiKey[:4]
	suffix := apiKey[len(apiKey)-4:]
	return prefix + "****" + suffix
}
