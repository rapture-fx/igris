// Package safety provides policy persistence for Phase 13+.
//
// This file implements database-backed persistence for safety policy configuration
// while maintaining backward compatibility with environment-based configuration.
package safety

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// PolicyPersistence provides database-backed persistence for policy settings
type PolicyPersistence struct {
	db       *sql.DB
	mu       sync.RWMutex
	enabled  bool
	tenantID string
	logger   *log.Logger
}

// NewPolicyPersistence creates a new policy persistence layer
// If db is nil, persistence is disabled and operations become no-ops
func NewPolicyPersistence(db *sql.DB, tenantID string) *PolicyPersistence {
	enabled := db != nil

	pp := &PolicyPersistence{
		db:       db,
		enabled:  enabled,
		tenantID: tenantID,
		logger:   log.Default(),
	}

	if enabled {
		log.Printf("[PolicyPersistence] Enabled for tenant: %s\n", tenantID)
	} else {
		log.Println("[PolicyPersistence] Disabled - using environment-based configuration only")
	}

	return pp
}

// IsEnabled returns whether database persistence is enabled
func (pp *PolicyPersistence) IsEnabled() bool {
	return pp.enabled
}

// PolicyRecord represents a policy configuration record in the database
type PolicyRecord struct {
	ID                      string
	TenantID                string
	MaxMonthlyCostUSD       float64
	EnableBudgetLimit       bool
	FallbackOnBudgetBreach  bool
	MaxTokensPerRequest     int
	EnableTokenLimit        bool
	EnableBenchmarkFallback bool
	ValidateKeysOnStartup   bool
	FailFastOnInvalidKey    bool
	TestMode                bool
	CreatedAt               time.Time
	UpdatedAt               time.Time
	CreatedBy               string
	UpdatedBy               string
}

// LoadPolicy loads the policy configuration for the tenant from the database
// Returns nil if not found or if persistence is disabled
func (pp *PolicyPersistence) LoadPolicy() (*PolicyRecord, error) {
	if !pp.enabled {
		return nil, nil
	}

	pp.mu.RLock()
	defer pp.mu.RUnlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, tenant_id, max_monthly_cost_usd, enable_budget_limit,
		       fallback_on_budget_breach, max_tokens_per_request, enable_token_limit,
		       enable_benchmark_fallback, validate_keys_on_startup,
		       fail_fast_on_invalid_key, test_mode,
		       created_at, updated_at, created_by, updated_by
		FROM policy_settings
		WHERE tenant_id = $1
	`

	var record PolicyRecord
	var createdBy, updatedBy sql.NullString

	err := pp.db.QueryRowContext(ctx, query, pp.tenantID).Scan(
		&record.ID,
		&record.TenantID,
		&record.MaxMonthlyCostUSD,
		&record.EnableBudgetLimit,
		&record.FallbackOnBudgetBreach,
		&record.MaxTokensPerRequest,
		&record.EnableTokenLimit,
		&record.EnableBenchmarkFallback,
		&record.ValidateKeysOnStartup,
		&record.FailFastOnInvalidKey,
		&record.TestMode,
		&record.CreatedAt,
		&record.UpdatedAt,
		&createdBy,
		&updatedBy,
	)

	if err == sql.ErrNoRows {
		pp.logger.Printf("[PolicyPersistence] No policy found for tenant: %s (using defaults)\n", pp.tenantID)
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load policy: %w", err)
	}

	if createdBy.Valid {
		record.CreatedBy = createdBy.String
	}
	if updatedBy.Valid {
		record.UpdatedBy = updatedBy.String
	}

	pp.logger.Printf("[PolicyPersistence] Loaded policy for tenant: %s\n", pp.tenantID)
	return &record, nil
}

// SavePolicy saves or updates the policy configuration for the tenant
func (pp *PolicyPersistence) SavePolicy(config *SafetyConfig, updatedBy string) error {
	if !pp.enabled {
		return nil
	}

	pp.mu.Lock()
	defer pp.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if policy exists
	var existingID string
	checkQuery := "SELECT id FROM policy_settings WHERE tenant_id = $1"
	err := pp.db.QueryRowContext(ctx, checkQuery, pp.tenantID).Scan(&existingID)

	now := time.Now().UTC()

	if err == sql.ErrNoRows {
		// Create new policy
		newID := uuid.New().String()
		insertQuery := `
			INSERT INTO policy_settings (
				id, tenant_id, max_monthly_cost_usd, enable_budget_limit,
				fallback_on_budget_breach, max_tokens_per_request, enable_token_limit,
				enable_benchmark_fallback, validate_keys_on_startup,
				fail_fast_on_invalid_key, test_mode,
				created_at, updated_at, created_by, updated_by
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		`

		_, err := pp.db.ExecContext(ctx, insertQuery,
			newID, pp.tenantID,
			config.MaxMonthlyCostUSD, config.EnableBudgetLimit,
			config.FallbackOnBudgetBreach, config.MaxTokensPerRequest,
			config.EnableTokenLimit, config.EnableBenchmarkFallback,
			config.ValidateKeysOnStartup, config.FailFastOnInvalidKey,
			config.TestMode,
			now, now, updatedBy, updatedBy,
		)

		if err != nil {
			return fmt.Errorf("failed to create policy: %w", err)
		}

		pp.logger.Printf("[PolicyPersistence] Created new policy for tenant: %s\n", pp.tenantID)
		return nil
	}

	if err != nil {
		return fmt.Errorf("failed to check existing policy: %w", err)
	}

	// Update existing policy
	updateQuery := `
		UPDATE policy_settings
		SET max_monthly_cost_usd = $1,
		    enable_budget_limit = $2,
		    fallback_on_budget_breach = $3,
		    max_tokens_per_request = $4,
		    enable_token_limit = $5,
		    enable_benchmark_fallback = $6,
		    validate_keys_on_startup = $7,
		    fail_fast_on_invalid_key = $8,
		    test_mode = $9,
		    updated_at = $10,
		    updated_by = $11
		WHERE tenant_id = $12
	`

	_, err = pp.db.ExecContext(ctx, updateQuery,
		config.MaxMonthlyCostUSD, config.EnableBudgetLimit,
		config.FallbackOnBudgetBreach, config.MaxTokensPerRequest,
		config.EnableTokenLimit, config.EnableBenchmarkFallback,
		config.ValidateKeysOnStartup, config.FailFastOnInvalidKey,
		config.TestMode,
		now, updatedBy, pp.tenantID,
	)

	if err != nil {
		return fmt.Errorf("failed to update policy: %w", err)
	}

	pp.logger.Printf("[PolicyPersistence] Updated policy for tenant: %s\n", pp.tenantID)
	return nil
}

// ApplyToConfig applies the persisted policy to a SafetyConfig
// If no persisted policy exists, the config remains unchanged (env-based defaults)
func (pp *PolicyPersistence) ApplyToConfig(config *SafetyConfig) error {
	if !pp.enabled {
		return nil
	}

	record, err := pp.LoadPolicy()
	if err != nil {
		return fmt.Errorf("failed to load policy: %w", err)
	}

	if record == nil {
		pp.logger.Println("[PolicyPersistence] No persisted policy found - using environment defaults")
		return nil
	}

	// Apply persisted values to config
	config.MaxMonthlyCostUSD = record.MaxMonthlyCostUSD
	config.EnableBudgetLimit = record.EnableBudgetLimit
	config.FallbackOnBudgetBreach = record.FallbackOnBudgetBreach
	config.MaxTokensPerRequest = record.MaxTokensPerRequest
	config.EnableTokenLimit = record.EnableTokenLimit
	config.EnableBenchmarkFallback = record.EnableBenchmarkFallback
	config.ValidateKeysOnStartup = record.ValidateKeysOnStartup
	config.FailFastOnInvalidKey = record.FailFastOnInvalidKey
	config.TestMode = record.TestMode

	pp.logger.Printf("[PolicyPersistence] Applied persisted policy to config for tenant: %s\n", pp.tenantID)
	return nil
}

// DeletePolicy deletes the policy configuration for the tenant
func (pp *PolicyPersistence) DeletePolicy() error {
	if !pp.enabled {
		return nil
	}

	pp.mu.Lock()
	defer pp.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := "DELETE FROM policy_settings WHERE tenant_id = $1"
	result, err := pp.db.ExecContext(ctx, query, pp.tenantID)
	if err != nil {
		return fmt.Errorf("failed to delete policy: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		pp.logger.Printf("[PolicyPersistence] No policy found to delete for tenant: %s\n", pp.tenantID)
	} else {
		pp.logger.Printf("[PolicyPersistence] Deleted policy for tenant: %s\n", pp.tenantID)
	}

	return nil
}

// GetAllTenantPolicies retrieves all tenant policies (admin function)
func GetAllTenantPolicies(db *sql.DB) ([]PolicyRecord, error) {
	if db == nil {
		return nil, fmt.Errorf("database not enabled")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT id, tenant_id, max_monthly_cost_usd, enable_budget_limit,
		       fallback_on_budget_breach, max_tokens_per_request, enable_token_limit,
		       enable_benchmark_fallback, validate_keys_on_startup,
		       fail_fast_on_invalid_key, test_mode,
		       created_at, updated_at, created_by, updated_by
		FROM policy_settings
		ORDER BY tenant_id
	`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query policies: %w", err)
	}
	defer rows.Close()

	var records []PolicyRecord
	for rows.Next() {
		var record PolicyRecord
		var createdBy, updatedBy sql.NullString

		err := rows.Scan(
			&record.ID,
			&record.TenantID,
			&record.MaxMonthlyCostUSD,
			&record.EnableBudgetLimit,
			&record.FallbackOnBudgetBreach,
			&record.MaxTokensPerRequest,
			&record.EnableTokenLimit,
			&record.EnableBenchmarkFallback,
			&record.ValidateKeysOnStartup,
			&record.FailFastOnInvalidKey,
			&record.TestMode,
			&record.CreatedAt,
			&record.UpdatedAt,
			&createdBy,
			&updatedBy,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan policy record: %w", err)
		}

		if createdBy.Valid {
			record.CreatedBy = createdBy.String
		}
		if updatedBy.Valid {
			record.UpdatedBy = updatedBy.String
		}

		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return records, nil
}
