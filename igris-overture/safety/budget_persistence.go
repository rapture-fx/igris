// Package safety provides the budget persistence layer for Phase 13+.
//
// This file implements database-backed persistence for budget tracking while
// maintaining full backward compatibility with the in-memory-only BudgetTracker.
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

// BudgetPersistence provides database-backed persistence for budget tracking
type BudgetPersistence struct {
	db       *sql.DB
	mu       sync.RWMutex
	enabled  bool
	tenantID string
	logger   *log.Logger
}

// NewBudgetPersistence creates a new budget persistence layer
// If db is nil, persistence is disabled and operations become no-ops
func NewBudgetPersistence(db *sql.DB, tenantID string) *BudgetPersistence {
	enabled := db != nil

	bp := &BudgetPersistence{
		db:       db,
		enabled:  enabled,
		tenantID: tenantID,
		logger:   log.Default(),
	}

	if enabled {
		log.Printf("[BudgetPersistence] Enabled for tenant: %s\n", tenantID)
	} else {
		log.Println("[BudgetPersistence] Disabled - using in-memory mode only")
	}

	return bp
}

// IsEnabled returns whether database persistence is enabled
func (bp *BudgetPersistence) IsEnabled() bool {
	return bp.enabled
}

// BudgetRecord represents a budget record in the database
type BudgetRecord struct {
	ID               string
	TenantID         string
	YearMonth        string
	TotalSpendUSD    float64
	RequestCount     int64
	BudgetLimitUSD   float64
	Breached         bool
	BreachedAt       *time.Time
	FirstBreachTime  *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// LoadCurrentMonth loads the budget for the current month from the database
// Returns nil if not found (first month) or if persistence is disabled
func (bp *BudgetPersistence) LoadCurrentMonth() (*BudgetRecord, error) {
	if !bp.enabled {
		return nil, nil
	}

	bp.mu.RLock()
	defer bp.mu.RUnlock()

	currentMonth := time.Now().UTC().Format("2006-01")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT id, tenant_id, year_month, total_spend_usd, request_count,
		       budget_limit_usd, breached, breached_at, first_breach_time,
		       created_at, updated_at
		FROM budgets
		WHERE tenant_id = $1 AND year_month = $2
	`

	var record BudgetRecord
	var breachedAt, firstBreachTime sql.NullTime

	err := bp.db.QueryRowContext(ctx, query, bp.tenantID, currentMonth).Scan(
		&record.ID,
		&record.TenantID,
		&record.YearMonth,
		&record.TotalSpendUSD,
		&record.RequestCount,
		&record.BudgetLimitUSD,
		&record.Breached,
		&breachedAt,
		&firstBreachTime,
		&record.CreatedAt,
		&record.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil // Not found - this is OK for first month
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load budget: %w", err)
	}

	// Convert nullable timestamps
	if breachedAt.Valid {
		record.BreachedAt = &breachedAt.Time
	}
	if firstBreachTime.Valid {
		record.FirstBreachTime = &firstBreachTime.Time
	}

	bp.logger.Printf("[BudgetPersistence] Loaded budget for %s: $%.2f spent of $%.2f limit\n",
		currentMonth, record.TotalSpendUSD, record.BudgetLimitUSD)

	return &record, nil
}

// GetOrCreateBudget gets or creates a budget record for the current month
func (bp *BudgetPersistence) GetOrCreateBudget(budgetLimitUSD float64) (*BudgetRecord, error) {
	if !bp.enabled {
		return nil, nil
	}

	bp.mu.Lock()
	defer bp.mu.Unlock()

	currentMonth := time.Now().UTC().Format("2006-01")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Try to get existing budget first
	var record BudgetRecord
	var breachedAt, firstBreachTime sql.NullTime

	query := `
		SELECT id, tenant_id, year_month, total_spend_usd, request_count,
		       budget_limit_usd, breached, breached_at, first_breach_time,
		       created_at, updated_at
		FROM budgets
		WHERE tenant_id = $1 AND year_month = $2
	`

	err := bp.db.QueryRowContext(ctx, query, bp.tenantID, currentMonth).Scan(
		&record.ID,
		&record.TenantID,
		&record.YearMonth,
		&record.TotalSpendUSD,
		&record.RequestCount,
		&record.BudgetLimitUSD,
		&record.Breached,
		&breachedAt,
		&firstBreachTime,
		&record.CreatedAt,
		&record.UpdatedAt,
	)

	if err == nil {
		// Found existing budget
		if breachedAt.Valid {
			record.BreachedAt = &breachedAt.Time
		}
		if firstBreachTime.Valid {
			record.FirstBreachTime = &firstBreachTime.Time
		}
		return &record, nil
	}

	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to query budget: %w", err)
	}

	// Create new budget
	newID := uuid.New().String()
	now := time.Now().UTC()

	insertQuery := `
		INSERT INTO budgets (id, tenant_id, year_month, total_spend_usd,
		                     request_count, budget_limit_usd, breached,
		                     created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err = bp.db.ExecContext(ctx, insertQuery,
		newID, bp.tenantID, currentMonth, 0.0, 0, budgetLimitUSD, false, now, now)

	if err != nil {
		return nil, fmt.Errorf("failed to create budget: %w", err)
	}

	record = BudgetRecord{
		ID:             newID,
		TenantID:       bp.tenantID,
		YearMonth:      currentMonth,
		TotalSpendUSD:  0.0,
		RequestCount:   0,
		BudgetLimitUSD: budgetLimitUSD,
		Breached:       false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	bp.logger.Printf("[BudgetPersistence] Created new budget for %s: limit=$%.2f\n",
		currentMonth, budgetLimitUSD)

	return &record, nil
}

// RecordSpending records a spending transaction to the database
func (bp *BudgetPersistence) RecordSpending(
	provider string,
	model string,
	costUSD float64,
	tokensInput int,
	tokensOutput int,
	requestID string,
	traceID string,
) error {
	if !bp.enabled {
		return nil
	}

	bp.mu.Lock()
	defer bp.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use the database function to record spending (atomic operation)
	query := `
		SELECT record_spending($1, $2, $3, $4, $5, $6, $7, $8)
	`

	var spendingID string
	err := bp.db.QueryRowContext(ctx, query,
		bp.tenantID,
		provider,
		model,
		costUSD,
		nullInt(tokensInput),
		nullInt(tokensOutput),
		nullString(requestID),
		nullString(traceID),
	).Scan(&spendingID)

	if err != nil {
		return fmt.Errorf("failed to record spending: %w", err)
	}

	return nil
}

// UpdateBudgetState updates the in-memory budget state from database
// This is called after recording to sync the in-memory tracker
func (bp *BudgetPersistence) UpdateBudgetState(tracker *BudgetTracker) error {
	if !bp.enabled {
		return nil
	}

	record, err := bp.LoadCurrentMonth()
	if err != nil {
		return fmt.Errorf("failed to load current month: %w", err)
	}

	if record == nil {
		return nil // No record yet
	}

	// Update tracker with database values
	tracker.mu.Lock()
	defer tracker.mu.Unlock()

	tracker.monthlySpend = record.TotalSpendUSD
	tracker.requestCount = record.RequestCount
	tracker.budgetBreached = record.Breached
	if record.FirstBreachTime != nil {
		tracker.firstBreachTime = record.FirstBreachTime
	}

	return nil
}

// GetCostBreakdown retrieves cost breakdown by provider and model for current month
func (bp *BudgetPersistence) GetCostBreakdown() (map[string]float64, map[string]float64, error) {
	if !bp.enabled {
		return make(map[string]float64), make(map[string]float64), nil
	}

	bp.mu.RLock()
	defer bp.mu.RUnlock()

	currentMonth := time.Now().UTC().Format("2006-01")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get budget ID for current month
	var budgetID string
	err := bp.db.QueryRowContext(ctx,
		"SELECT id FROM budgets WHERE tenant_id = $1 AND year_month = $2",
		bp.tenantID, currentMonth).Scan(&budgetID)

	if err == sql.ErrNoRows {
		return make(map[string]float64), make(map[string]float64), nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get budget ID: %w", err)
	}

	// Get cost by provider
	costByProvider := make(map[string]float64)
	rows, err := bp.db.QueryContext(ctx,
		"SELECT provider, SUM(cost_usd) FROM spending_log WHERE budget_id = $1 GROUP BY provider",
		budgetID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query cost by provider: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var provider string
		var cost float64
		if err := rows.Scan(&provider, &cost); err != nil {
			return nil, nil, fmt.Errorf("failed to scan provider cost: %w", err)
		}
		costByProvider[provider] = cost
	}

	// Get cost by model
	costByModel := make(map[string]float64)
	rows, err = bp.db.QueryContext(ctx,
		"SELECT model, SUM(cost_usd) FROM spending_log WHERE budget_id = $1 GROUP BY model",
		budgetID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query cost by model: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var model string
		var cost float64
		if err := rows.Scan(&model, &cost); err != nil {
			return nil, nil, fmt.Errorf("failed to scan model cost: %w", err)
		}
		costByModel[model] = cost
	}

	return costByProvider, costByModel, nil
}

// GetHistoricalSpending retrieves spending for previous months
func (bp *BudgetPersistence) GetHistoricalSpending(months int) ([]BudgetRecord, error) {
	if !bp.enabled {
		return nil, nil
	}

	bp.mu.RLock()
	defer bp.mu.RUnlock()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT id, tenant_id, year_month, total_spend_usd, request_count,
		       budget_limit_usd, breached, breached_at, first_breach_time,
		       created_at, updated_at
		FROM budgets
		WHERE tenant_id = $1
		ORDER BY year_month DESC
		LIMIT $2
	`

	rows, err := bp.db.QueryContext(ctx, query, bp.tenantID, months)
	if err != nil {
		return nil, fmt.Errorf("failed to query historical spending: %w", err)
	}
	defer rows.Close()

	var records []BudgetRecord
	for rows.Next() {
		var record BudgetRecord
		var breachedAt, firstBreachTime sql.NullTime

		err := rows.Scan(
			&record.ID,
			&record.TenantID,
			&record.YearMonth,
			&record.TotalSpendUSD,
			&record.RequestCount,
			&record.BudgetLimitUSD,
			&record.Breached,
			&breachedAt,
			&firstBreachTime,
			&record.CreatedAt,
			&record.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan budget record: %w", err)
		}

		if breachedAt.Valid {
			record.BreachedAt = &breachedAt.Time
		}
		if firstBreachTime.Valid {
			record.FirstBreachTime = &firstBreachTime.Time
		}

		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return records, nil
}

// Helper functions for nullable types

func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func nullInt(i int) sql.NullInt64 {
	if i == 0 {
		return sql.NullInt64{Valid: false}
	}
	return sql.NullInt64{Int64: int64(i), Valid: true}
}

func nullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{Valid: false}
	}
	return sql.NullTime{Time: *t, Valid: true}
}
