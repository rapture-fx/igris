package router

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/observability"
)

// CostAccounting tracks speculative execution costs and implements auto-disable logic
type CostAccounting struct {
	config *config.SpeculativeConfig

	// Per-tenant cost tracking
	tenantCosts map[string]*TenantCostTracker
	mu          sync.RWMutex

	// Global stats
	totalWastedTokens int64
	totalWastedCostUSD float64
	totalRequestsProcessed int64
}

// TenantCostTracker tracks costs for a specific tenant
type TenantCostTracker struct {
	TenantID string

	// Cost tracking
	WinnerCostUSD      float64
	WastedCostUSD      float64
	TotalCostUSD       float64
	WinnerTokens       int
	WastedTokens       int
	TotalTokens        int

	// Auto-disable tracking
	RequestCount       int64
	DisabledUntil      time.Time
	DisableCount       int64
	WasteRatio         float64
	LastResetTime      time.Time

	// Provider-level tracking
	ProviderCosts      map[string]*ProviderCostStats

	mu                 sync.RWMutex
}

// ProviderCostStats tracks per-provider costs in speculative execution
type ProviderCostStats struct {
	ProviderID         string
	WonCount           int64
	LostCount          int64
	FailedCount        int64
	WinnerTokens       int64
	WastedTokens       int64
	WinnerCostUSD      float64
	WastedCostUSD      float64
}

// NewCostAccounting creates a new cost accounting tracker
func NewCostAccounting(config *config.SpeculativeConfig) *CostAccounting {
	return &CostAccounting{
		config:      config,
		tenantCosts: make(map[string]*TenantCostTracker),
	}
}

// RecordSpeculativeRequest records cost and token usage for a speculative request
func (ca *CostAccounting) RecordSpeculativeRequest(
	ctx context.Context,
	tenantID string,
	winnerProvider string,
	winnerTokens int,
	winnerCostUSD float64,
	losingProviders map[string]*ProviderWasteStats,
) error {
	ca.mu.Lock()
	tracker, exists := ca.tenantCosts[tenantID]
	if !exists {
		tracker = &TenantCostTracker{
			TenantID:       tenantID,
			ProviderCosts:  make(map[string]*ProviderCostStats),
			LastResetTime:  time.Now(),
		}
		ca.tenantCosts[tenantID] = tracker
	}
	ca.mu.Unlock()

	// Update tenant tracker
	tracker.mu.Lock()
	defer tracker.mu.Unlock()

	// Record winner costs
	tracker.WinnerCostUSD += winnerCostUSD
	tracker.WinnerTokens += winnerTokens
	tracker.TotalCostUSD += winnerCostUSD
	tracker.TotalTokens += winnerTokens
	tracker.RequestCount++

	// Update winner provider stats
	if _, exists := tracker.ProviderCosts[winnerProvider]; !exists {
		tracker.ProviderCosts[winnerProvider] = &ProviderCostStats{
			ProviderID: winnerProvider,
		}
	}
	winnerStats := tracker.ProviderCosts[winnerProvider]
	winnerStats.WonCount++
	winnerStats.WinnerTokens += int64(winnerTokens)
	winnerStats.WinnerCostUSD += winnerCostUSD

	// Record wasted costs from losing providers
	var totalWastedCost float64
	var totalWastedTokens int

	for providerID, wasteStats := range losingProviders {
		tracker.WastedCostUSD += wasteStats.CostWastedUSD
		tracker.WastedTokens += wasteStats.TokensWasted
		tracker.TotalCostUSD += wasteStats.CostWastedUSD
		tracker.TotalTokens += wasteStats.TokensWasted

		totalWastedCost += wasteStats.CostWastedUSD
		totalWastedTokens += wasteStats.TokensWasted

		// Update provider stats
		if _, exists := tracker.ProviderCosts[providerID]; !exists {
			tracker.ProviderCosts[providerID] = &ProviderCostStats{
				ProviderID: providerID,
			}
		}
		providerStats := tracker.ProviderCosts[providerID]
		providerStats.LostCount++
		providerStats.WastedTokens += int64(wasteStats.TokensWasted)
		providerStats.WastedCostUSD += wasteStats.CostWastedUSD

		// Record Prometheus metrics
		observability.RecordSpeculativeTokensWasted(providerID, tenantID, wasteStats.TokensWasted)
		observability.RecordSpeculativeCostWasted(providerID, tenantID, wasteStats.CostWastedUSD)
	}

	// Calculate waste ratio
	if tracker.TotalCostUSD > 0 {
		tracker.WasteRatio = tracker.WastedCostUSD / tracker.TotalCostUSD
	}

	// Update global stats
	ca.mu.Lock()
	ca.totalWastedTokens += int64(totalWastedTokens)
	ca.totalWastedCostUSD += totalWastedCost
	ca.totalRequestsProcessed++
	ca.mu.Unlock()

	log.Printf("[CostAccounting] Tenant %s: winner=%s ($%.4f, %d tokens), wasted=$%.4f (%d tokens), waste_ratio=%.2f%%",
		tenantID, winnerProvider, winnerCostUSD, winnerTokens,
		totalWastedCost, totalWastedTokens, tracker.WasteRatio*100)

	return nil
}

// ProviderWasteStats contains waste statistics for a losing provider
type ProviderWasteStats struct {
	ProviderID     string
	TokensWasted   int
	CostWastedUSD  float64
}

// ShouldDisableSpeculative checks if speculative mode should be auto-disabled for a tenant
// Returns true if waste ratio exceeds threshold
func (ca *CostAccounting) ShouldDisableSpeculative(tenantID string) (bool, string) {
	ca.mu.RLock()
	tracker, exists := ca.tenantCosts[tenantID]
	ca.mu.RUnlock()

	if !exists {
		return false, ""
	}

	tracker.mu.RLock()
	defer tracker.mu.RUnlock()

	// Check if already disabled
	if time.Now().Before(tracker.DisabledUntil) {
		remainingTime := time.Until(tracker.DisabledUntil)
		return true, fmt.Sprintf("disabled for %v more (cool-down period)", remainingTime.Round(time.Second))
	}

	// Check if we have enough samples (minimum 10 requests)
	if tracker.RequestCount < 10 {
		return false, ""
	}

	// Check waste ratio threshold
	if tracker.WasteRatio > ca.config.WasteThreshold {
		reason := fmt.Sprintf("waste ratio %.2f%% exceeds threshold %.2f%% (wasted: $%.4f / total: $%.4f)",
			tracker.WasteRatio*100,
			ca.config.WasteThreshold*100,
			tracker.WastedCostUSD,
			tracker.TotalCostUSD,
		)

		// Auto-disable for 5 minutes
		tracker.mu.RUnlock()
		tracker.mu.Lock()
		tracker.DisabledUntil = time.Now().Add(5 * time.Minute)
		tracker.DisableCount++
		tracker.mu.Unlock()
		tracker.mu.RLock()

		log.Printf("[CostAccounting] Auto-disabling speculative mode for tenant %s: %s", tenantID, reason)

		return true, reason
	}

	return false, ""
}

// ResetTenantStats resets cost tracking stats for a tenant (call periodically, e.g. daily)
func (ca *CostAccounting) ResetTenantStats(tenantID string) {
	ca.mu.Lock()
	tracker, exists := ca.tenantCosts[tenantID]
	ca.mu.Unlock()

	if !exists {
		return
	}

	tracker.mu.Lock()
	defer tracker.mu.Unlock()

	log.Printf("[CostAccounting] Resetting stats for tenant %s: requests=%d, total_cost=$%.4f, waste_ratio=%.2f%%",
		tenantID, tracker.RequestCount, tracker.TotalCostUSD, tracker.WasteRatio*100)

	// Keep provider stats, but reset cost/token counts
	tracker.WinnerCostUSD = 0
	tracker.WastedCostUSD = 0
	tracker.TotalCostUSD = 0
	tracker.WinnerTokens = 0
	tracker.WastedTokens = 0
	tracker.TotalTokens = 0
	tracker.RequestCount = 0
	tracker.WasteRatio = 0
	tracker.LastResetTime = time.Now()

	// Reset provider stats
	for _, providerStats := range tracker.ProviderCosts {
		providerStats.WinnerTokens = 0
		providerStats.WastedTokens = 0
		providerStats.WinnerCostUSD = 0
		providerStats.WastedCostUSD = 0
	}
}

// GetTenantStats returns cost statistics for a tenant
func (ca *CostAccounting) GetTenantStats(tenantID string) *TenantCostStats {
	ca.mu.RLock()
	tracker, exists := ca.tenantCosts[tenantID]
	ca.mu.RUnlock()

	if !exists {
		return &TenantCostStats{
			TenantID: tenantID,
		}
	}

	tracker.mu.RLock()
	defer tracker.mu.RUnlock()

	stats := &TenantCostStats{
		TenantID:          tenantID,
		RequestCount:      tracker.RequestCount,
		WinnerCostUSD:     tracker.WinnerCostUSD,
		WastedCostUSD:     tracker.WastedCostUSD,
		TotalCostUSD:      tracker.TotalCostUSD,
		WinnerTokens:      tracker.WinnerTokens,
		WastedTokens:      tracker.WastedTokens,
		TotalTokens:       tracker.TotalTokens,
		WasteRatio:        tracker.WasteRatio,
		IsDisabled:        time.Now().Before(tracker.DisabledUntil),
		DisabledUntil:     tracker.DisabledUntil,
		DisableCount:      tracker.DisableCount,
		ProviderStats:     make([]*ProviderCostStats, 0, len(tracker.ProviderCosts)),
	}

	// Copy provider stats
	for _, providerStats := range tracker.ProviderCosts {
		stats.ProviderStats = append(stats.ProviderStats, &ProviderCostStats{
			ProviderID:    providerStats.ProviderID,
			WonCount:      providerStats.WonCount,
			LostCount:     providerStats.LostCount,
			FailedCount:   providerStats.FailedCount,
			WinnerTokens:  providerStats.WinnerTokens,
			WastedTokens:  providerStats.WastedTokens,
			WinnerCostUSD: providerStats.WinnerCostUSD,
			WastedCostUSD: providerStats.WastedCostUSD,
		})
	}

	return stats
}

// TenantCostStats is a snapshot of tenant cost statistics
type TenantCostStats struct {
	TenantID       string
	RequestCount   int64
	WinnerCostUSD  float64
	WastedCostUSD  float64
	TotalCostUSD   float64
	WinnerTokens   int
	WastedTokens   int
	TotalTokens    int
	WasteRatio     float64
	IsDisabled     bool
	DisabledUntil  time.Time
	DisableCount   int64
	ProviderStats  []*ProviderCostStats
}

// GetGlobalStats returns global cost accounting statistics
func (ca *CostAccounting) GetGlobalStats() *GlobalCostStats {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	stats := &GlobalCostStats{
		TotalWastedTokens:     ca.totalWastedTokens,
		TotalWastedCostUSD:    ca.totalWastedCostUSD,
		TotalRequestsProcessed: ca.totalRequestsProcessed,
		TenantCount:           len(ca.tenantCosts),
	}

	return stats
}

// GlobalCostStats contains global cost accounting statistics
type GlobalCostStats struct {
	TotalWastedTokens      int64
	TotalWastedCostUSD     float64
	TotalRequestsProcessed int64
	TenantCount            int
}

// CalculateWaste calculates waste for losing providers in a speculative race
// This should be called after the stream completes
func CalculateWaste(
	candidates []*ProviderCandidate,
	winner *ProviderCandidate,
	costPerTokenUSD map[string]float64,
) map[string]*ProviderWasteStats {
	waste := make(map[string]*ProviderWasteStats)

	for _, candidate := range candidates {
		// Skip the winner
		if candidate.ProviderID == winner.ProviderID {
			continue
		}

		candidate.mu.Lock()
		tokensWasted := candidate.TokenCount
		candidate.mu.Unlock()

		// Calculate cost (default to $0.002 per 1k tokens if not provided)
		costPer1k := 0.002
		if cost, exists := costPerTokenUSD[candidate.ProviderID]; exists {
			costPer1k = cost
		}

		costWasted := float64(tokensWasted) * (costPer1k / 1000.0)

		waste[candidate.ProviderID] = &ProviderWasteStats{
			ProviderID:    candidate.ProviderID,
			TokensWasted:  tokensWasted,
			CostWastedUSD: costWasted,
		}
	}

	return waste
}

// RecordProviderFailure records when a provider fails during a speculative race
func (ca *CostAccounting) RecordProviderFailure(tenantID, providerID string) {
	ca.mu.Lock()
	tracker, exists := ca.tenantCosts[tenantID]
	if !exists {
		tracker = &TenantCostTracker{
			TenantID:      tenantID,
			ProviderCosts: make(map[string]*ProviderCostStats),
			LastResetTime: time.Now(),
		}
		ca.tenantCosts[tenantID] = tracker
	}
	ca.mu.Unlock()

	tracker.mu.Lock()
	defer tracker.mu.Unlock()

	if _, exists := tracker.ProviderCosts[providerID]; !exists {
		tracker.ProviderCosts[providerID] = &ProviderCostStats{
			ProviderID: providerID,
		}
	}

	tracker.ProviderCosts[providerID].FailedCount++
}

// P0-1 FIX: New method to record costs with per-provider breakdown
// This replaces RecordSpeculativeRequest for accurate per-provider billing
type ProviderDeliveredCost struct {
	ProviderID       string
	TokensDelivered  int
	CostDeliveredUSD float64
}

func (ca *CostAccounting) RecordSpeculativeRequestWithProviderBreakdown(
	ctx context.Context,
	tenantID string,
	deliveredByProvider map[string]*ProviderDeliveredCost,
	wasteByProvider map[string]*ProviderWasteStats,
) error {
	ca.mu.Lock()
	tracker, exists := ca.tenantCosts[tenantID]
	if !exists {
		tracker = &TenantCostTracker{
			TenantID:       tenantID,
			ProviderCosts:  make(map[string]*ProviderCostStats),
			LastResetTime:  time.Now(),
		}
		ca.tenantCosts[tenantID] = tracker
	}
	ca.mu.Unlock()

	tracker.mu.Lock()
	defer tracker.mu.Unlock()

	// Track total delivered costs and tokens
	var totalDeliveredCost float64
	var totalDeliveredTokens int

	// Record costs for each provider that DELIVERED tokens
	for _, delivered := range deliveredByProvider {
		totalDeliveredCost += delivered.CostDeliveredUSD
		totalDeliveredTokens += delivered.TokensDelivered

		// Update provider stats
		if _, exists := tracker.ProviderCosts[delivered.ProviderID]; !exists {
			tracker.ProviderCosts[delivered.ProviderID] = &ProviderCostStats{
				ProviderID: delivered.ProviderID,
			}
		}
		providerStats := tracker.ProviderCosts[delivered.ProviderID]
		providerStats.WonCount++
		providerStats.WinnerTokens += int64(delivered.TokensDelivered)
		providerStats.WinnerCostUSD += delivered.CostDeliveredUSD
	}

	// Record waste for each provider
	var totalWastedCost float64
	var totalWastedTokens int

	for _, waste := range wasteByProvider {
		totalWastedCost += waste.CostWastedUSD
		totalWastedTokens += waste.TokensWasted

		// Update provider stats
		if _, exists := tracker.ProviderCosts[waste.ProviderID]; !exists {
			tracker.ProviderCosts[waste.ProviderID] = &ProviderCostStats{
				ProviderID: waste.ProviderID,
			}
		}
		providerStats := tracker.ProviderCosts[waste.ProviderID]

		// Only increment LostCount if this provider delivered ZERO tokens
		if _, delivered := deliveredByProvider[waste.ProviderID]; !delivered {
			providerStats.LostCount++
		}

		providerStats.WastedTokens += int64(waste.TokensWasted)
		providerStats.WastedCostUSD += waste.CostWastedUSD

		// Record Prometheus metrics
		observability.RecordSpeculativeTokensWasted(waste.ProviderID, tenantID, waste.TokensWasted)
		observability.RecordSpeculativeCostWasted(waste.ProviderID, tenantID, waste.CostWastedUSD)
	}

	// Update tenant totals
	tracker.WinnerCostUSD += totalDeliveredCost
	tracker.WinnerTokens += totalDeliveredTokens
	tracker.WastedCostUSD += totalWastedCost
	tracker.WastedTokens += totalWastedTokens
	tracker.TotalCostUSD += totalDeliveredCost + totalWastedCost
	tracker.TotalTokens += totalDeliveredTokens + totalWastedTokens
	tracker.RequestCount++

	// Calculate waste ratio
	if tracker.TotalCostUSD > 0 {
		tracker.WasteRatio = tracker.WastedCostUSD / tracker.TotalCostUSD
	}

	// Update global stats
	ca.mu.Lock()
	ca.totalWastedTokens += int64(totalWastedTokens)
	ca.totalWastedCostUSD += totalWastedCost
	ca.totalRequestsProcessed++
	ca.mu.Unlock()

	log.Printf("[CostAccounting] Tenant %s: delivered=$%.4f (%d tokens from %d providers), wasted=$%.4f (%d tokens), waste_ratio=%.2f%%",
		tenantID, totalDeliveredCost, totalDeliveredTokens, len(deliveredByProvider),
		totalWastedCost, totalWastedTokens, tracker.WasteRatio*100)

	return nil
}
