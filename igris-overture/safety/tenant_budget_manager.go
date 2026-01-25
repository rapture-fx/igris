package safety

import (
	"database/sql"
	"sync"

	"github.com/Igris-inertial/system/igris-overture/metrics"
)

// TenantBudgetManager manages per-tenant budget trackers
// Phase 2: Enables budget isolation across multiple tenants
type TenantBudgetManager struct {
	config   *SafetyConfig
	db       *sql.DB
	trackers map[string]*BudgetTracker
	mu       sync.RWMutex
}

// NewTenantBudgetManager creates a new tenant budget manager
func NewTenantBudgetManager(config *SafetyConfig, db *sql.DB) *TenantBudgetManager {
	return &TenantBudgetManager{
		config:   config,
		db:       db,
		trackers: make(map[string]*BudgetTracker),
	}
}

// GetTracker returns the budget tracker for a specific tenant
// Creates a new tracker if one doesn't exist
func (tbm *TenantBudgetManager) GetTracker(tenantID string) *BudgetTracker {
	// Fast path: read lock for existing tracker
	tbm.mu.RLock()
	tracker, exists := tbm.trackers[tenantID]
	tbm.mu.RUnlock()

	if exists {
		return tracker
	}

	// Slow path: write lock to create new tracker
	tbm.mu.Lock()
	defer tbm.mu.Unlock()

	// Double-check after acquiring write lock
	if tracker, exists := tbm.trackers[tenantID]; exists {
		return tracker
	}

	// Create new tracker for this tenant
	tracker = NewBudgetTrackerWithDB(tbm.config, tbm.db, tenantID)
	tbm.trackers[tenantID] = tracker

	return tracker
}

// GetAllTrackers returns all active tenant trackers
func (tbm *TenantBudgetManager) GetAllTrackers() map[string]*BudgetTracker {
	tbm.mu.RLock()
	defer tbm.mu.RUnlock()

	// Return a copy to avoid race conditions
	trackers := make(map[string]*BudgetTracker, len(tbm.trackers))
	for tenantID, tracker := range tbm.trackers {
		trackers[tenantID] = tracker
	}

	return trackers
}

// GetTenantCount returns the number of active tenants
func (tbm *TenantBudgetManager) GetTenantCount() int {
	tbm.mu.RLock()
	defer tbm.mu.RUnlock()
	return len(tbm.trackers)
}

// GetAggregatedStats returns aggregated statistics across all tenants
func (tbm *TenantBudgetManager) GetAggregatedStats() map[string]interface{} {
	tbm.mu.RLock()
	defer tbm.mu.RUnlock()

	totalSpend := 0.0
	totalRequests := int64(0)
	totalBreached := 0

	for _, tracker := range tbm.trackers {
		stats := tracker.GetStats()
		totalSpend += stats["monthly_spend_usd"].(float64)
		totalRequests += stats["request_count"].(int64)
		if stats["budget_breached"].(bool) {
			totalBreached++
		}
	}

	return map[string]interface{}{
		"total_tenants":        len(tbm.trackers),
		"total_spend_usd":      totalSpend,
		"total_requests":       totalRequests,
		"tenants_breached":     totalBreached,
		"avg_spend_per_tenant": totalSpend / float64(len(tbm.trackers)),
	}
}

// UpdatePrometheusMetrics updates Prometheus metrics for all tenants
// Phase 4.3.1: Export tenant budget metrics to Prometheus
func (tbm *TenantBudgetManager) UpdatePrometheusMetrics() {
	tbm.mu.RLock()
	defer tbm.mu.RUnlock()

	// Update active tenant count
	metrics.UpdateActiveTenants(len(tbm.trackers))

	// Update per-tenant metrics
	for tenantID, tracker := range tbm.trackers {
		stats := tracker.GetStats()

		monthlyCostUSD := stats["monthly_spend_usd"].(float64)
		budgetUSD := tbm.config.MaxMonthlyCostUSD

		// Update tenant budget metrics
		metrics.UpdateTenantMetrics(tenantID, monthlyCostUSD, budgetUSD)
	}
}

// RemoveTracker removes a tenant's budget tracker (useful for cleanup)
func (tbm *TenantBudgetManager) RemoveTracker(tenantID string) {
	tbm.mu.Lock()
	defer tbm.mu.Unlock()
	delete(tbm.trackers, tenantID)
}

// CleanupInactiveTrackers removes trackers for tenants that haven't been used recently
// This could be expanded to check last activity timestamp
func (tbm *TenantBudgetManager) CleanupInactiveTrackers() int {
	tbm.mu.Lock()
	defer tbm.mu.Unlock()

	// For now, this is a placeholder
	// In a real implementation, we'd check last activity time
	// and remove trackers that haven't been used in X days
	return 0
}
