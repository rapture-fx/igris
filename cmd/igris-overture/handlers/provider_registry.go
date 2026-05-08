// Package handlers provides HTTP handlers for provider registry management
package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/repository"
	"github.com/Igris-inertial/system/igris-overture/security"
	"github.com/Igris-inertial/system/igris-overture/services"
	"github.com/gofiber/fiber/v2"
)

// ProviderRegistryHandler handles provider registry operations
type ProviderRegistryHandler struct {
	service *services.ProviderRegistryService
	repo    repository.ProviderRegistryRepository
	logger  *log.Logger
}

// NewProviderRegistryHandler creates a new provider registry handler
func NewProviderRegistryHandler(db *sql.DB, keyVault *security.KeyVault) *ProviderRegistryHandler {
	repo := repository.NewProviderRegistryRepository(db)
	service := services.NewProviderRegistryService(repo, keyVault)

	return &ProviderRegistryHandler{
		service: service,
		repo:    repo,
		logger:  log.Default(),
	}
}

// RegisterProviderRequest represents the request to register a new provider
type RegisterProviderRequest struct {
	Name               string                     `json:"name" validate:"required"`
	Kind               string                     `json:"kind,omitempty"`
	BaseURL            string                     `json:"base_url" validate:"required"`
	Endpoint           string                     `json:"endpoint,omitempty"`
	KeyID              string                     `json:"key_id" validate:"required"` // Vault key reference; no raw keys accepted
	Models             []string                   `json:"models"`
	DefaultModel       string                     `json:"default_model,omitempty"`
	Pricing            *models.ProviderPricing    `json:"pricing,omitempty"`
	CompatibilityClass *models.CompatibilityClass `json:"compatibility_class,omitempty"`
}

// RegisterProviderResponse represents the response after registering a provider
type RegisterProviderResponse struct {
	Status   string                 `json:"status"`
	Message  string                 `json:"message"`
	Provider map[string]interface{} `json:"provider"`
}

// TestProviderRequest represents the request to test a provider
type TestProviderRequest struct {
	ProviderID string `json:"provider_id" validate:"required"`
}

// TestProviderResponse represents the response after testing a provider
type TestProviderResponse struct {
	Status         string   `json:"status"`
	LatencyMs      *int     `json:"latency_ms"`
	ModelsDetected []string `json:"models_detected"`
	ErrorMessage   *string  `json:"error_message,omitempty"`
}

// RegisterProvider registers a new provider for a tenant
// POST /v1/providers/register
func (h *ProviderRegistryHandler) RegisterProvider(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "UNAUTHORIZED",
		})
	}

	// Parse request
	var req RegisterProviderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}
	normalizeProviderRegistryRequest(&req)

	// Validate required fields
	if req.Name == "" || req.BaseURL == "" || req.KeyID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing required fields: name, base_url, key_id",
			"code":  "MISSING_FIELDS",
		})
	}

	// Convert to service request
	serviceReq := &services.RegisterProviderRequest{
		Name:               req.Name,
		BaseURL:            req.BaseURL,
		KeyID:              req.KeyID,
		Models:             req.Models,
		Pricing:            req.Pricing,
		CompatibilityClass: req.CompatibilityClass,
	}

	// Register provider
	ctx := context.Background()
	provider, err := h.service.RegisterProvider(ctx, tenantCtx.TenantID, serviceReq)
	if err != nil {
		h.logger.Printf("[ProviderRegistry] Failed to register provider: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to register provider: %v", err),
			"code":  "REGISTRATION_FAILED",
		})
	}

	// Start async validation in background
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		_, err := h.service.ValidateProvider(ctx, provider.ID)
		if err != nil {
			h.logger.Printf("[ProviderRegistry] Background validation failed for provider %s: %v", provider.ID, err)
		}
	}()

	h.logger.Printf("[ProviderRegistry] Registered provider '%s' for tenant '%s'", req.Name, tenantCtx.TenantID)

	return c.Status(fiber.StatusCreated).JSON(&RegisterProviderResponse{
		Status:   "pending",
		Message:  "Provider registration started. Validation in progress.",
		Provider: provider.ToPublicResponse(),
	})
}

// TestProvider validates connectivity and compatibility of a registered provider
// POST /v1/providers/test
func (h *ProviderRegistryHandler) TestProvider(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "UNAUTHORIZED",
		})
	}

	// Parse request
	var req TestProviderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	if req.ProviderID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing required field: provider_id",
			"code":  "MISSING_FIELD",
		})
	}

	// Verify provider belongs to tenant
	ctx := context.Background()
	provider, err := h.repo.GetByID(ctx, req.ProviderID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Provider not found",
			"code":  "PROVIDER_NOT_FOUND",
		})
	}

	if provider.TenantID != tenantCtx.TenantID && !tenantCtx.IsAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
			"code":  "FORBIDDEN",
		})
	}

	// Validate provider
	validationLog, err := h.service.ValidateProvider(ctx, req.ProviderID)
	if err != nil {
		h.logger.Printf("[ProviderRegistry] Failed to validate provider: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Validation failed: %v", err),
			"code":  "VALIDATION_FAILED",
		})
	}

	// Determine status
	status := "invalid"
	if validationLog.Success {
		status = "active"
	}

	return c.Status(fiber.StatusOK).JSON(&TestProviderResponse{
		Status:         status,
		LatencyMs:      validationLog.LatencyMs,
		ModelsDetected: validationLog.ModelsDetected,
		ErrorMessage:   validationLog.ErrorMessage,
	})
}

func normalizeProviderRegistryRequest(req *RegisterProviderRequest) {
	if req.Name == "" && req.Kind != "" {
		req.Name = req.Kind
	}
	if req.BaseURL == "" && req.Endpoint != "" {
		req.BaseURL = req.Endpoint
	}
	if len(req.Models) == 0 && req.DefaultModel != "" {
		req.Models = []string{req.DefaultModel}
	}
}

// ListProviders lists all registered providers for the current tenant
// GET /v1/providers
func (h *ProviderRegistryHandler) ListProviders(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "UNAUTHORIZED",
		})
	}

	// Parse query parameters
	statusStr := c.Query("status", "")
	var status *models.ProviderStatus
	if statusStr != "" {
		s := models.ProviderStatus(statusStr)
		status = &s
	}

	// List providers
	ctx := context.Background()
	providers, err := h.repo.ListByTenant(ctx, tenantCtx.TenantID, status)
	if err != nil {
		h.logger.Printf("[ProviderRegistry] Failed to list providers: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve providers",
			"code":  "QUERY_FAILED",
		})
	}

	// Convert to public response
	publicProviders := make([]map[string]interface{}, 0, len(providers))
	for _, provider := range providers {
		publicProviders = append(publicProviders, provider.ToPublicResponse())
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"providers": publicProviders,
		"count":     len(publicProviders),
	})
}

// GetProviderHealth retrieves provider health metrics and last validation results
// GET /v1/providers/:id/health
func (h *ProviderRegistryHandler) GetProviderHealth(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "UNAUTHORIZED",
		})
	}

	// Get provider ID from path
	providerID := c.Params("id")
	if providerID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing provider ID",
			"code":  "MISSING_ID",
		})
	}

	// Get provider
	ctx := context.Background()
	provider, err := h.repo.GetByID(ctx, providerID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Provider not found",
			"code":  "PROVIDER_NOT_FOUND",
		})
	}

	// Verify access
	if provider.TenantID != tenantCtx.TenantID && !tenantCtx.IsAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
			"code":  "FORBIDDEN",
		})
	}

	// Get validation history (last 10 attempts)
	validationHistory, err := h.repo.GetValidationHistory(ctx, providerID, 10)
	if err != nil {
		h.logger.Printf("[ProviderRegistry] Failed to get validation history: %v", err)
		validationHistory = []*models.ProviderValidationLog{}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"provider_id":        provider.ID,
		"name":               provider.Name,
		"status":             provider.Status,
		"health":             provider.Health,
		"last_validated_at":  provider.LastValidatedAt,
		"validation_history": validationHistory,
	})
}

// DeleteProvider deletes a provider registration
// DELETE /v1/providers/:id
func (h *ProviderRegistryHandler) DeleteProvider(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "UNAUTHORIZED",
		})
	}

	// Get provider ID from path
	providerID := c.Params("id")
	if providerID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing provider ID",
			"code":  "MISSING_ID",
		})
	}

	// Get provider to verify ownership
	ctx := context.Background()
	provider, err := h.repo.GetByID(ctx, providerID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Provider not found",
			"code":  "PROVIDER_NOT_FOUND",
		})
	}

	// Verify access
	if provider.TenantID != tenantCtx.TenantID && !tenantCtx.IsAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
			"code":  "FORBIDDEN",
		})
	}

	// Delete provider
	if err := h.repo.Delete(ctx, providerID); err != nil {
		h.logger.Printf("[ProviderRegistry] Failed to delete provider: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete provider",
			"code":  "DELETE_FAILED",
		})
	}

	h.logger.Printf("[ProviderRegistry] Deleted provider '%s' for tenant '%s'", provider.Name, tenantCtx.TenantID)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Provider deleted successfully",
	})
}

// UpdateProvider updates a provider's configuration
// PUT /v1/providers/:id
func (h *ProviderRegistryHandler) UpdateProvider(c *fiber.Ctx) error {
	// Get tenant context
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "UNAUTHORIZED",
		})
	}

	// Get provider ID from path
	providerID := c.Params("id")
	if providerID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing provider ID",
			"code":  "MISSING_ID",
		})
	}

	// Get provider
	ctx := context.Background()
	provider, err := h.repo.GetByID(ctx, providerID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Provider not found",
			"code":  "PROVIDER_NOT_FOUND",
		})
	}

	// Verify access
	if provider.TenantID != tenantCtx.TenantID && !tenantCtx.IsAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
			"code":  "FORBIDDEN",
		})
	}

	// Parse update request
	var req RegisterProviderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	// Update fields
	if req.BaseURL != "" {
		provider.BaseURL = req.BaseURL
	}
	if req.KeyID != "" {
		provider.KeyID = &req.KeyID
	}
	if req.Models != nil {
		provider.Models = req.Models
	}
	if req.Pricing != nil {
		provider.Pricing = *req.Pricing
	}

	// Update in database
	if err := h.repo.Update(ctx, provider); err != nil {
		h.logger.Printf("[ProviderRegistry] Failed to update provider: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update provider",
			"code":  "UPDATE_FAILED",
		})
	}

	h.logger.Printf("[ProviderRegistry] Updated provider '%s'", provider.ID)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":  "Provider updated successfully",
		"provider": provider.ToPublicResponse(),
	})
}
