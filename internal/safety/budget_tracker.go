package safety

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// BudgetTracker tracks cumulative costs and enforces spending limits
// FUTURE: This will become the Customer Budget Dashboard backend
type BudgetTracker struct {
	config *SafetyConfig

	// Current period tracking
	currentMonth      string
	monthlySpend      float64
	requestCount      int64
	lastResetTime     time.Time
	budgetBreached    bool
	firstBreachTime   *time.Time

	// Detailed tracking (FUTURE: per-tenant, per-user)
	costByProvider    map[string]float64
	costByModel       map[string]float64

	mu sync.RWMutex
}

// BudgetCheckResult represents the outcome of a budget check
type BudgetCheckResult struct {
	Allowed           bool
	CurrentSpend      float64
	Limit             float64
	RemainingBudget   float64
	PercentageUsed    float64
	BudgetBreached    bool
	Reason            string
	SuggestedAction   string
}

// NewBudgetTracker creates a new budget tracker
func NewBudgetTracker(config *SafetyConfig) *BudgetTracker {
	currentMonth := time.Now().Format("2006-01")

	tracker := &BudgetTracker{
		config:         config,
		currentMonth:   currentMonth,
		monthlySpend:   0.0,
		requestCount:   0,
		lastResetTime:  time.Now(),
		budgetBreached: false,
		costByProvider: make(map[string]float64),
		costByModel:    make(map[string]float64),
	}

	log.Printf("[BudgetTracker] Initialized for month %s, limit: $%.2f", currentMonth, config.MaxMonthlyCostUSD)

	return tracker
}

// CheckBudget checks if a request would exceed the budget
// FUTURE: This will check per-tenant budgets
func (bt *BudgetTracker) CheckBudget(estimatedCost float64) *BudgetCheckResult {
	bt.mu.RLock()
	defer bt.mu.RUnlock()

	if !bt.config.EnableBudgetLimit {
		return &BudgetCheckResult{
			Allowed:         true,
			CurrentSpend:    bt.monthlySpend,
			Limit:           bt.config.MaxMonthlyCostUSD,
			RemainingBudget: bt.config.MaxMonthlyCostUSD - bt.monthlySpend,
			Reason:          "Budget limit disabled",
		}
	}

	// Check if month rolled over
	currentMonth := time.Now().Format("2006-01")
	if currentMonth != bt.currentMonth {
		// Month changed - reset will happen on next RecordCost
		return &BudgetCheckResult{
			Allowed:         true,
			CurrentSpend:    0.0,
			Limit:           bt.config.MaxMonthlyCostUSD,
			RemainingBudget: bt.config.MaxMonthlyCostUSD,
			Reason:          "New billing period",
		}
	}

	projectedSpend := bt.monthlySpend + estimatedCost
	remaining := bt.config.MaxMonthlyCostUSD - bt.monthlySpend
	percentageUsed := (bt.monthlySpend / bt.config.MaxMonthlyCostUSD) * 100

	if projectedSpend > bt.config.MaxMonthlyCostUSD {
		return &BudgetCheckResult{
			Allowed:         false,
			CurrentSpend:    bt.monthlySpend,
			Limit:           bt.config.MaxMonthlyCostUSD,
			RemainingBudget: remaining,
			PercentageUsed:  percentageUsed,
			BudgetBreached:  true,
			Reason:          fmt.Sprintf("Budget exceeded: $%.4f + $%.4f > $%.2f", bt.monthlySpend, estimatedCost, bt.config.MaxMonthlyCostUSD),
			SuggestedAction: "Fallback to benchmark mode",
		}
	}

	// Warning at 80% usage
	if percentageUsed >= 80 {
		log.Printf("[BudgetTracker] WARNING: %.1f%% of monthly budget used ($%.4f / $%.2f)",
			percentageUsed, bt.monthlySpend, bt.config.MaxMonthlyCostUSD)
	}

	return &BudgetCheckResult{
		Allowed:         true,
		CurrentSpend:    bt.monthlySpend,
		Limit:           bt.config.MaxMonthlyCostUSD,
		RemainingBudget: remaining,
		PercentageUsed:  percentageUsed,
		BudgetBreached:  false,
		Reason:          "Within budget",
	}
}

// RecordCost records the actual cost of a request
// FUTURE: This will record per-tenant, per-user costs
func (bt *BudgetTracker) RecordCost(provider, model string, cost float64) error {
	bt.mu.Lock()
	defer bt.mu.Unlock()

	// Check if month rolled over
	currentMonth := time.Now().Format("2006-01")
	if currentMonth != bt.currentMonth {
		bt.resetMonth(currentMonth)
	}

	// Record cost
	bt.monthlySpend += cost
	bt.requestCount++

	// Track by provider and model
	bt.costByProvider[provider] += cost
	bt.costByModel[model] += cost

	// Check if we just breached the budget
	if !bt.budgetBreached && bt.monthlySpend > bt.config.MaxMonthlyCostUSD {
		bt.budgetBreached = true
		now := time.Now()
		bt.firstBreachTime = &now
		log.Printf("[BudgetTracker] ⚠️  BUDGET BREACHED: $%.4f > $%.2f (month: %s)",
			bt.monthlySpend, bt.config.MaxMonthlyCostUSD, bt.currentMonth)
	}

	// Log every $0.50 spent
	if int(bt.monthlySpend*2) > int((bt.monthlySpend-cost)*2) {
		log.Printf("[BudgetTracker] Monthly spend: $%.4f / $%.2f (%.1f%%, %d requests)",
			bt.monthlySpend, bt.config.MaxMonthlyCostUSD,
			(bt.monthlySpend/bt.config.MaxMonthlyCostUSD)*100, bt.requestCount)
	}

	return nil
}

// resetMonth resets tracking for a new month
func (bt *BudgetTracker) resetMonth(newMonth string) {
	log.Printf("[BudgetTracker] Month rollover: %s → %s, resetting spend (was $%.4f)",
		bt.currentMonth, newMonth, bt.monthlySpend)

	bt.currentMonth = newMonth
	bt.monthlySpend = 0.0
	bt.requestCount = 0
	bt.budgetBreached = false
	bt.firstBreachTime = nil
	bt.lastResetTime = time.Now()
	bt.costByProvider = make(map[string]float64)
	bt.costByModel = make(map[string]float64)
}

// GetStats returns current budget statistics
// FUTURE: This will power the Customer Budget Dashboard
func (bt *BudgetTracker) GetStats() map[string]interface{} {
	bt.mu.RLock()
	defer bt.mu.RUnlock()

	percentageUsed := 0.0
	if bt.config.MaxMonthlyCostUSD > 0 {
		percentageUsed = (bt.monthlySpend / bt.config.MaxMonthlyCostUSD) * 100
	}

	stats := map[string]interface{}{
		"current_month":      bt.currentMonth,
		"monthly_spend_usd":  bt.monthlySpend,
		"budget_limit_usd":   bt.config.MaxMonthlyCostUSD,
		"remaining_usd":      bt.config.MaxMonthlyCostUSD - bt.monthlySpend,
		"percentage_used":    percentageUsed,
		"budget_breached":    bt.budgetBreached,
		"request_count":      bt.requestCount,
		"last_reset":         bt.lastResetTime.Format(time.RFC3339),
		"cost_by_provider":   bt.costByProvider,
		"cost_by_model":      bt.costByModel,
	}

	if bt.firstBreachTime != nil {
		stats["first_breach_time"] = bt.firstBreachTime.Format(time.RFC3339)
	}

	return stats
}

// IsBudgetBreached returns whether the budget has been breached
func (bt *BudgetTracker) IsBudgetBreached() bool {
	bt.mu.RLock()
	defer bt.mu.RUnlock()
	return bt.budgetBreached
}

// GetCurrentSpend returns the current monthly spend
func (bt *BudgetTracker) GetCurrentSpend() float64 {
	bt.mu.RLock()
	defer bt.mu.RUnlock()
	return bt.monthlySpend
}

// TODO Phase 14: Add persistence to database for tracking across restarts
// TODO Phase 14: Add per-tenant budget tracking (multi-tenancy support)
// TODO Phase 14: Add budget alerts via webhook/email
// TODO Phase 15: Add budget forecasting based on usage trends
// TODO Phase 15: Add budget allocation by team/project
