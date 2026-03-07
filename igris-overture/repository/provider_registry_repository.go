// Package repository provides data access layer for Igris Inertial
package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/Igris-inertial/system/igris-overture/models"
)

// ProviderRegistryRepository defines the interface for provider registry operations
type ProviderRegistryRepository interface {
	// Create creates a new provider registration
	Create(ctx context.Context, provider *models.ProviderRegistry) error

	// GetByID retrieves a provider by ID
	GetByID(ctx context.Context, id string) (*models.ProviderRegistry, error)

	// GetByTenantAndName retrieves a provider by tenant ID and name
	GetByTenantAndName(ctx context.Context, tenantID, name string) (*models.ProviderRegistry, error)

	// ListByTenant lists all providers for a tenant
	ListByTenant(ctx context.Context, tenantID string, status *models.ProviderStatus) ([]*models.ProviderRegistry, error)

	// ListActive lists all active providers for a tenant
	ListActive(ctx context.Context, tenantID string) ([]*models.ProviderRegistry, error)

	// ListAll lists all providers (admin use)
	ListAll(ctx context.Context, limit, offset int) ([]*models.ProviderRegistry, error)

	// Update updates a provider's information
	Update(ctx context.Context, provider *models.ProviderRegistry) error

	// UpdateStatus updates a provider's status
	UpdateStatus(ctx context.Context, id string, status models.ProviderStatus) error

	// UpdateHealth updates a provider's health metrics
	UpdateHealth(ctx context.Context, id string, health models.ProviderHealth) error

	// Delete deletes a provider registration
	Delete(ctx context.Context, id string) error

	// LogValidation logs a validation attempt
	LogValidation(ctx context.Context, log *models.ProviderValidationLog) error

	// GetValidationHistory retrieves validation history for a provider
	GetValidationHistory(ctx context.Context, providerID string, limit int) ([]*models.ProviderValidationLog, error)
}

// providerRegistryRepository implements ProviderRegistryRepository
type providerRegistryRepository struct {
	db     *sql.DB
	logger *log.Logger
}

// NewProviderRegistryRepository creates a new provider registry repository
func NewProviderRegistryRepository(db *sql.DB) ProviderRegistryRepository {
	return &providerRegistryRepository{
		db:     db,
		logger: log.Default(),
	}
}

// Create creates a new provider registration
func (r *providerRegistryRepository) Create(ctx context.Context, provider *models.ProviderRegistry) error {
	// Generate UUID if not provided
	if provider.ID == "" {
		provider.ID = uuid.New().String()
	}

	// Marshal JSONB fields
	modelsJSON, err := models.MarshalModelsJSON(provider.Models)
	if err != nil {
		return fmt.Errorf("failed to marshal models: %w", err)
	}

	pricingJSON, err := models.MarshalPricingJSON(provider.Pricing)
	if err != nil {
		return fmt.Errorf("failed to marshal pricing: %w", err)
	}

	healthJSON, err := models.MarshalHealthJSON(provider.Health)
	if err != nil {
		return fmt.Errorf("failed to marshal health: %w", err)
	}

	query := `
		INSERT INTO provider_registry (
			id, tenant_id, name, base_url, auth_header_template,
			key_id, models, pricing, compatibility_class, status, health,
			is_verified, is_official
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING created_at, updated_at
	`

	err = r.db.QueryRowContext(ctx, query,
		provider.ID,
		provider.TenantID,
		provider.Name,
		provider.BaseURL,
		provider.AuthHeaderTemplate,
		provider.KeyID,
		modelsJSON,
		pricingJSON,
		provider.CompatibilityClass,
		provider.Status,
		healthJSON,
		provider.IsVerified,
		provider.IsOfficial,
	).Scan(&provider.CreatedAt, &provider.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	r.logger.Printf("[ProviderRegistry] Created provider: %s for tenant: %s", provider.Name, provider.TenantID)
	return nil
}

// GetByID retrieves a provider by ID
func (r *providerRegistryRepository) GetByID(ctx context.Context, id string) (*models.ProviderRegistry, error) {
	query := `
		SELECT id, tenant_id, name, base_url, auth_header_template, key_id,
		       models, pricing, compatibility_class, status, health,
		       is_verified, is_official, created_at, updated_at, last_validated_at
		FROM provider_registry
		WHERE id = $1
	`

	provider := &models.ProviderRegistry{}
	var modelsJSON, pricingJSON, healthJSON []byte
	var keyID sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&provider.ID,
		&provider.TenantID,
		&provider.Name,
		&provider.BaseURL,
		&provider.AuthHeaderTemplate,
		&keyID,
		&modelsJSON,
		&pricingJSON,
		&provider.CompatibilityClass,
		&provider.Status,
		&healthJSON,
		&provider.IsVerified,
		&provider.IsOfficial,
		&provider.CreatedAt,
		&provider.UpdatedAt,
		&provider.LastValidatedAt,
	)
	if keyID.Valid {
		provider.KeyID = &keyID.String
	}

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("provider not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get provider: %w", err)
	}

	// Unmarshal JSONB fields
	provider.Models, err = models.UnmarshalModelsJSON(modelsJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal models: %w", err)
	}

	provider.Pricing, err = models.UnmarshalPricingJSON(pricingJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal pricing: %w", err)
	}

	provider.Health, err = models.UnmarshalHealthJSON(healthJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal health: %w", err)
	}

	return provider, nil
}

// GetByTenantAndName retrieves a provider by tenant ID and name
func (r *providerRegistryRepository) GetByTenantAndName(ctx context.Context, tenantID, name string) (*models.ProviderRegistry, error) {
	query := `
		SELECT id, tenant_id, name, base_url, auth_header_template, key_id,
		       models, pricing, compatibility_class, status, health,
		       is_verified, is_official, created_at, updated_at, last_validated_at
		FROM provider_registry
		WHERE tenant_id = $1 AND name = $2
	`

	provider := &models.ProviderRegistry{}
	var modelsJSON, pricingJSON, healthJSON []byte
	var keyID sql.NullString

	err := r.db.QueryRowContext(ctx, query, tenantID, name).Scan(
		&provider.ID,
		&provider.TenantID,
		&provider.Name,
		&provider.BaseURL,
		&provider.AuthHeaderTemplate,
		&keyID,
		&modelsJSON,
		&pricingJSON,
		&provider.CompatibilityClass,
		&provider.Status,
		&healthJSON,
		&provider.IsVerified,
		&provider.IsOfficial,
		&provider.CreatedAt,
		&provider.UpdatedAt,
		&provider.LastValidatedAt,
	)
	if keyID.Valid {
		provider.KeyID = &keyID.String
	}

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("provider not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get provider: %w", err)
	}

	// Unmarshal JSONB fields
	provider.Models, err = models.UnmarshalModelsJSON(modelsJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal models: %w", err)
	}

	provider.Pricing, err = models.UnmarshalPricingJSON(pricingJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal pricing: %w", err)
	}

	provider.Health, err = models.UnmarshalHealthJSON(healthJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal health: %w", err)
	}

	return provider, nil
}

// ListByTenant lists all providers for a tenant
func (r *providerRegistryRepository) ListByTenant(ctx context.Context, tenantID string, status *models.ProviderStatus) ([]*models.ProviderRegistry, error) {
	query := `
		SELECT id, tenant_id, name, base_url, auth_header_template, key_id,
		       models, pricing, compatibility_class, status, health,
		       is_verified, is_official, created_at, updated_at, last_validated_at
		FROM provider_registry
		WHERE tenant_id = $1 AND ($2::provider_status IS NULL OR status = $2)
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID, status)
	if err != nil {
		return nil, fmt.Errorf("failed to list providers: %w", err)
	}
	defer rows.Close()

	return r.scanProviders(rows)
}

// ListActive lists all active providers for a tenant
func (r *providerRegistryRepository) ListActive(ctx context.Context, tenantID string) ([]*models.ProviderRegistry, error) {
	activeStatus := models.StatusActive
	return r.ListByTenant(ctx, tenantID, &activeStatus)
}

// ListAll lists all providers (admin use)
func (r *providerRegistryRepository) ListAll(ctx context.Context, limit, offset int) ([]*models.ProviderRegistry, error) {
	query := `
		SELECT id, tenant_id, name, base_url, auth_header_template, key_id,
		       models, pricing, compatibility_class, status, health,
		       is_verified, is_official, created_at, updated_at, last_validated_at
		FROM provider_registry
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list all providers: %w", err)
	}
	defer rows.Close()

	return r.scanProviders(rows)
}

// Update updates a provider's information
func (r *providerRegistryRepository) Update(ctx context.Context, provider *models.ProviderRegistry) error {
	// Marshal JSONB fields
	modelsJSON, err := models.MarshalModelsJSON(provider.Models)
	if err != nil {
		return fmt.Errorf("failed to marshal models: %w", err)
	}

	pricingJSON, err := models.MarshalPricingJSON(provider.Pricing)
	if err != nil {
		return fmt.Errorf("failed to marshal pricing: %w", err)
	}

	healthJSON, err := models.MarshalHealthJSON(provider.Health)
	if err != nil {
		return fmt.Errorf("failed to marshal health: %w", err)
	}

	query := `
		UPDATE provider_registry
		SET base_url = $1, auth_header_template = $2, key_id = $3, models = $4,
		    pricing = $5, compatibility_class = $6, status = $7, health = $8
		WHERE id = $9
	`

	result, err := r.db.ExecContext(ctx, query,
		provider.BaseURL,
		provider.AuthHeaderTemplate,
		provider.KeyID,
		modelsJSON,
		pricingJSON,
		provider.CompatibilityClass,
		provider.Status,
		healthJSON,
		provider.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update provider: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("provider not found")
	}

	r.logger.Printf("[ProviderRegistry] Updated provider: %s", provider.ID)
	return nil
}

// UpdateStatus updates a provider's status
func (r *providerRegistryRepository) UpdateStatus(ctx context.Context, id string, status models.ProviderStatus) error {
	query := `
		UPDATE provider_registry
		SET status = $1, last_validated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	result, err := r.db.ExecContext(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update provider status: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("provider not found")
	}

	r.logger.Printf("[ProviderRegistry] Updated provider %s status to %s", id, status)
	return nil
}

// UpdateHealth updates a provider's health metrics
func (r *providerRegistryRepository) UpdateHealth(ctx context.Context, id string, health models.ProviderHealth) error {
	healthJSON, err := models.MarshalHealthJSON(health)
	if err != nil {
		return fmt.Errorf("failed to marshal health: %w", err)
	}

	query := `
		UPDATE provider_registry
		SET health = $1, last_validated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	result, err := r.db.ExecContext(ctx, query, healthJSON, id)
	if err != nil {
		return fmt.Errorf("failed to update provider health: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("provider not found")
	}

	return nil
}

// Delete deletes a provider registration
func (r *providerRegistryRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM provider_registry WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete provider: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("provider not found")
	}

	r.logger.Printf("[ProviderRegistry] Deleted provider: %s", id)
	return nil
}

// LogValidation logs a validation attempt
func (r *providerRegistryRepository) LogValidation(ctx context.Context, log *models.ProviderValidationLog) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.TraceID == "" {
		log.TraceID = uuid.New().String()
	}

	modelsJSON, err := json.Marshal(log.ModelsDetected)
	if err != nil {
		return fmt.Errorf("failed to marshal models detected: %w", err)
	}

	query := `
		INSERT INTO provider_validation_log (
			id, provider_id, success, status_code, latency_ms,
			error_message, models_detected, trace_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING validated_at
	`

	err = r.db.QueryRowContext(ctx, query,
		log.ID,
		log.ProviderID,
		log.Success,
		log.StatusCode,
		log.LatencyMs,
		log.ErrorMessage,
		modelsJSON,
		log.TraceID,
	).Scan(&log.ValidatedAt)

	if err != nil {
		return fmt.Errorf("failed to log validation: %w", err)
	}

	return nil
}

// GetValidationHistory retrieves validation history for a provider
func (r *providerRegistryRepository) GetValidationHistory(ctx context.Context, providerID string, limit int) ([]*models.ProviderValidationLog, error) {
	query := `
		SELECT id, provider_id, success, status_code, latency_ms,
		       error_message, models_detected, validated_at, trace_id
		FROM provider_validation_log
		WHERE provider_id = $1
		ORDER BY validated_at DESC
		LIMIT $2
	`

	rows, err := r.db.QueryContext(ctx, query, providerID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get validation history: %w", err)
	}
	defer rows.Close()

	var logs []*models.ProviderValidationLog
	for rows.Next() {
		log := &models.ProviderValidationLog{}
		var modelsJSON []byte

		err := rows.Scan(
			&log.ID,
			&log.ProviderID,
			&log.Success,
			&log.StatusCode,
			&log.LatencyMs,
			&log.ErrorMessage,
			&modelsJSON,
			&log.ValidatedAt,
			&log.TraceID,
		)
		if err != nil {
			r.logger.Printf("[ProviderRegistry] Error scanning validation log: %v", err)
			continue
		}

		// Unmarshal models detected
		if err := json.Unmarshal(modelsJSON, &log.ModelsDetected); err != nil {
			r.logger.Printf("[ProviderRegistry] Error unmarshaling models detected: %v", err)
			log.ModelsDetected = []string{}
		}

		logs = append(logs, log)
	}

	return logs, nil
}

// scanProviders is a helper function to scan multiple provider rows
func (r *providerRegistryRepository) scanProviders(rows *sql.Rows) ([]*models.ProviderRegistry, error) {
	var providers []*models.ProviderRegistry

	for rows.Next() {
		provider := &models.ProviderRegistry{}
		var modelsJSON, pricingJSON, healthJSON []byte
		var keyID sql.NullString

		err := rows.Scan(
			&provider.ID,
			&provider.TenantID,
			&provider.Name,
			&provider.BaseURL,
			&provider.AuthHeaderTemplate,
			&keyID,
			&modelsJSON,
			&pricingJSON,
			&provider.CompatibilityClass,
			&provider.Status,
			&healthJSON,
			&provider.IsVerified,
			&provider.IsOfficial,
			&provider.CreatedAt,
			&provider.UpdatedAt,
			&provider.LastValidatedAt,
		)
		if keyID.Valid {
			provider.KeyID = &keyID.String
		}
		if err != nil {
			r.logger.Printf("[ProviderRegistry] Error scanning provider: %v", err)
			continue
		}

		// Unmarshal JSONB fields
		provider.Models, err = models.UnmarshalModelsJSON(modelsJSON)
		if err != nil {
			r.logger.Printf("[ProviderRegistry] Error unmarshaling models: %v", err)
			provider.Models = []string{}
		}

		provider.Pricing, err = models.UnmarshalPricingJSON(pricingJSON)
		if err != nil {
			r.logger.Printf("[ProviderRegistry] Error unmarshaling pricing: %v", err)
			provider.Pricing = models.ProviderPricing{}
		}

		provider.Health, err = models.UnmarshalHealthJSON(healthJSON)
		if err != nil {
			r.logger.Printf("[ProviderRegistry] Error unmarshaling health: %v", err)
			provider.Health = models.ProviderHealth{
				UptimePercent: 100.0,
			}
		}

		providers = append(providers, provider)
	}

	return providers, nil
}
