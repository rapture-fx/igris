// Package safety provides tenant-aware safety controller integration (Phase 14)
//
// This file extends SafetyController with multi-tenant capabilities including
// per-tenant policies, BYOK key retrieval, and tenant-specific budget tracking.
package safety

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// TenantSafetyController wraps SafetyController with tenant-specific features
type TenantSafetyController struct {
	*SafetyController

	// Phase 14: Multi-tenant features
	vault             *security.KeyVault
	policyPersistence *PolicyPersistence
	tenantID          string
	db                *sql.DB
	logger            *log.Logger
}

// NewTenantSafetyController creates a tenant-aware safety controller
func NewTenantSafetyController(
	config *SafetyConfig,
	db *sql.DB,
	tenantID string,
	vault *security.KeyVault,
) *TenantSafetyController {
	// Create base controller with tenant-specific budget tracker
	baseController := NewSafetyControllerWithDB(config, db, tenantID)

	tsc := &TenantSafetyController{
		SafetyController:  baseController,
		vault:             vault,
		policyPersistence: NewPolicyPersistence(db, tenantID),
		tenantID:          tenantID,
		db:                db,
		logger:            log.Default(),
	}

	// Load tenant-specific policy if available
	if err := tsc.loadTenantPolicy(); err != nil {
		tsc.logger.Printf("[TenantSafety] Warning: Failed to load tenant policy: %v", err)
		// Continue with default policy from config
	}

	return tsc
}

// loadTenantPolicy loads and applies tenant-specific policy from database
func (tsc *TenantSafetyController) loadTenantPolicy() error {
	if tsc.policyPersistence == nil || !tsc.policyPersistence.IsEnabled() {
		return nil
	}

	// Try to apply persisted policy to config
	if err := tsc.policyPersistence.ApplyToConfig(tsc.config); err != nil {
		return fmt.Errorf("failed to apply tenant policy: %w", err)
	}

	tsc.logger.Printf("[TenantSafety] Loaded policy for tenant: %s", tsc.tenantID)
	return nil
}

// GetProviderKey retrieves the decrypted API key for a provider using BYOK vault
func (tsc *TenantSafetyController) GetProviderKey(provider string) (string, error) {
	if tsc.vault == nil || !tsc.vault.IsEnabled() {
		return "", fmt.Errorf("BYOK vault not enabled for tenant %s", tsc.tenantID)
	}

	decKey, err := tsc.vault.GetKey(tsc.tenantID, provider)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve key for provider %s: %w", provider, err)
	}

	return decKey.PlainKey, nil
}

// HasProviderKey checks if tenant has a key configured for the provider
func (tsc *TenantSafetyController) HasProviderKey(provider string) bool {
	if tsc.vault == nil || !tsc.vault.IsEnabled() {
		return false
	}

	_, err := tsc.vault.GetKey(tsc.tenantID, provider)
	return err == nil
}

// PreRequestCheckTenant performs safety checks with tenant context
// This is the main entry point for tenant-aware request validation
func (tsc *TenantSafetyController) PreRequestCheckTenant(
	req *models.InferRequest,
	estimatedCost float64,
	traceID string,
) (*SafetyCheckResult, error) {
	// Reload policy if needed (for real-time policy updates)
	if tsc.policyPersistence != nil && tsc.policyPersistence.IsEnabled() {
		if err := tsc.loadTenantPolicy(); err != nil {
			tsc.logger.Printf("[TenantSafety] Warning: Failed to reload policy: %v", err)
		}
	}

	// Use the base controller's PreRequestCheckWithTrace
	return tsc.PreRequestCheckWithTrace(req, estimatedCost, traceID)
}

// PostRequestRecordTenant records cost with tenant context
func (tsc *TenantSafetyController) PostRequestRecordTenant(
	provider, model string,
	cost float64,
	requestID, traceID string,
) error {
	return tsc.PostRequestRecordWithTrace(provider, model, cost, requestID, traceID)
}

// GetTenantPolicy returns the current effective policy for the tenant
func (tsc *TenantSafetyController) GetTenantPolicy() *SafetyConfig {
	return tsc.config
}

// UpdateTenantPolicy updates the tenant's safety policy
func (tsc *TenantSafetyController) UpdateTenantPolicy(newConfig *SafetyConfig, updatedBy string) error {
	if tsc.policyPersistence == nil || !tsc.policyPersistence.IsEnabled() {
		return fmt.Errorf("policy persistence not enabled")
	}

	// Save new policy
	if err := tsc.policyPersistence.SavePolicy(newConfig, updatedBy); err != nil {
		return fmt.Errorf("failed to save policy: %w", err)
	}

	// Apply to current config
	tsc.config = newConfig

	// Update budget tracker's config
	tsc.budgetTracker.config = newConfig

	tsc.logger.Printf("[TenantSafety] Updated policy for tenant: %s", tsc.tenantID)
	return nil
}

// GetTenantID returns the tenant ID for this controller
func (tsc *TenantSafetyController) GetTenantID() string {
	return tsc.tenantID
}

// TenantSafetyManager manages safety controllers for multiple tenants
type TenantSafetyManager struct {
	db                *sql.DB
	vault             *security.KeyVault
	defaultConfig     *SafetyConfig
	controllers       map[string]*TenantSafetyController
	logger            *log.Logger
}

// NewTenantSafetyManager creates a manager for tenant safety controllers
func NewTenantSafetyManager(db *sql.DB, vault *security.KeyVault, defaultConfig *SafetyConfig) *TenantSafetyManager {
	return &TenantSafetyManager{
		db:            db,
		vault:         vault,
		defaultConfig: defaultConfig,
		controllers:   make(map[string]*TenantSafetyController),
		logger:        log.Default(),
	}
}

// GetController retrieves or creates a safety controller for a tenant
func (tsm *TenantSafetyManager) GetController(tenantID string) (*TenantSafetyController, error) {
	// Check if controller already exists
	if controller, exists := tsm.controllers[tenantID]; exists {
		return controller, nil
	}

	// Create new controller for tenant
	controller := NewTenantSafetyController(
		tsm.defaultConfig,
		tsm.db,
		tenantID,
		tsm.vault,
	)

	// Cache controller
	tsm.controllers[tenantID] = controller

	tsm.logger.Printf("[TenantSafetyManager] Created controller for tenant: %s", tenantID)
	return controller, nil
}

// GetOrCreateController is an alias for GetController for clarity
func (tsm *TenantSafetyManager) GetOrCreateController(tenantID string) (*TenantSafetyController, error) {
	return tsm.GetController(tenantID)
}

// ClearController removes a tenant's controller from cache (e.g., after policy update)
func (tsm *TenantSafetyManager) ClearController(tenantID string) {
	delete(tsm.controllers, tenantID)
	tsm.logger.Printf("[TenantSafetyManager] Cleared controller for tenant: %s", tenantID)
}

// ReloadController clears and recreates a tenant's controller
func (tsm *TenantSafetyManager) ReloadController(tenantID string) (*TenantSafetyController, error) {
	tsm.ClearController(tenantID)
	return tsm.GetController(tenantID)
}

// GetAllControllers returns all cached controllers
func (tsm *TenantSafetyManager) GetAllControllers() map[string]*TenantSafetyController {
	return tsm.controllers
}

// Stats returns statistics about managed controllers
func (tsm *TenantSafetyManager) Stats() map[string]interface{} {
	return map[string]interface{}{
		"active_controllers": len(tsm.controllers),
		"tenants":            getKeys(tsm.controllers),
	}
}

// Helper function to get map keys
func getKeys(m map[string]*TenantSafetyController) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
