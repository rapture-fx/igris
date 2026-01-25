package router

import (
	"context"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/config"
)

// TestCostAccounting_BasicTracking tests basic cost and token tracking
func TestCostAccounting_BasicTracking(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		WasteThreshold: 0.3, // 30%
	}
	ca := NewCostAccounting(cfg)

	tenantID := "tenant-1"
	winnerProvider := "provider-a"
	winnerTokens := 100
	winnerCostUSD := 0.002 // $0.002 for 100 tokens

	// Create waste from losing providers
	losingProviders := map[string]*ProviderWasteStats{
		"provider-b": {
			ProviderID:    "provider-b",
			TokensWasted:  50,
			CostWastedUSD: 0.001,
		},
		"provider-c": {
			ProviderID:    "provider-c",
			TokensWasted:  75,
			CostWastedUSD: 0.0015,
		},
	}

	// Record request
	err := ca.RecordSpeculativeRequest(
		context.Background(),
		tenantID,
		winnerProvider,
		winnerTokens,
		winnerCostUSD,
		losingProviders,
	)

	if err != nil {
		t.Fatalf("Failed to record request: %v", err)
	}

	// Verify stats
	stats := ca.GetTenantStats(tenantID)

	if stats.WinnerTokens != winnerTokens {
		t.Errorf("Expected winner tokens %d, got %d", winnerTokens, stats.WinnerTokens)
	}

	if stats.WinnerCostUSD != winnerCostUSD {
		t.Errorf("Expected winner cost $%.4f, got $%.4f", winnerCostUSD, stats.WinnerCostUSD)
	}

	expectedWastedTokens := 50 + 75
	if stats.WastedTokens != expectedWastedTokens {
		t.Errorf("Expected wasted tokens %d, got %d", expectedWastedTokens, stats.WastedTokens)
	}

	expectedWastedCost := 0.001 + 0.0015
	if stats.WastedCostUSD != expectedWastedCost {
		t.Errorf("Expected wasted cost $%.4f, got $%.4f", expectedWastedCost, stats.WastedCostUSD)
	}

	expectedTotalCost := winnerCostUSD + expectedWastedCost
	if stats.TotalCostUSD != expectedTotalCost {
		t.Errorf("Expected total cost $%.4f, got $%.4f", expectedTotalCost, stats.TotalCostUSD)
	}

	expectedWasteRatio := expectedWastedCost / expectedTotalCost
	if stats.WasteRatio < expectedWasteRatio-0.01 || stats.WasteRatio > expectedWasteRatio+0.01 {
		t.Errorf("Expected waste ratio %.2f%%, got %.2f%%", expectedWasteRatio*100, stats.WasteRatio*100)
	}

	t.Logf("Stats: winner_cost=$%.4f, wasted_cost=$%.4f, total=$%.4f, waste_ratio=%.2f%%",
		stats.WinnerCostUSD, stats.WastedCostUSD, stats.TotalCostUSD, stats.WasteRatio*100)
}

// TestCostAccounting_AutoDisable tests auto-disable logic when waste threshold is exceeded
func TestCostAccounting_AutoDisable(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		WasteThreshold: 0.3, // 30% threshold
	}
	ca := NewCostAccounting(cfg)

	tenantID := "tenant-high-waste"

	// Simulate 10 requests with 50% waste ratio (exceeds 30% threshold)
	for i := 0; i < 10; i++ {
		losingProviders := map[string]*ProviderWasteStats{
			"provider-b": {
				ProviderID:    "provider-b",
				TokensWasted:  100, // Same as winner
				CostWastedUSD: 0.002,
			},
		}

		err := ca.RecordSpeculativeRequest(
			context.Background(),
			tenantID,
			"provider-a",
			100,   // winner tokens
			0.002, // winner cost
			losingProviders,
		)

		if err != nil {
			t.Fatalf("Failed to record request %d: %v", i, err)
		}
	}

	// Check stats
	stats := ca.GetTenantStats(tenantID)
	t.Logf("After 10 requests: waste_ratio=%.2f%%, threshold=%.2f%%",
		stats.WasteRatio*100, cfg.WasteThreshold*100)

	if stats.WasteRatio <= cfg.WasteThreshold {
		t.Errorf("Expected waste ratio %.2f%% to exceed threshold %.2f%%",
			stats.WasteRatio*100, cfg.WasteThreshold*100)
	}

	// Check if auto-disabled
	disabled, reason := ca.ShouldDisableSpeculative(tenantID)
	if !disabled {
		t.Error("Expected speculative mode to be auto-disabled")
	}

	if reason == "" {
		t.Error("Expected disable reason to be provided")
	}

	t.Logf("Auto-disabled: %s", reason)

	// Verify tenant is marked as disabled
	stats = ca.GetTenantStats(tenantID)
	if !stats.IsDisabled {
		t.Error("Expected tenant to be marked as disabled")
	}

	if stats.DisableCount != 1 {
		t.Errorf("Expected disable count 1, got %d", stats.DisableCount)
	}
}

// TestCostAccounting_NoAutoDisable tests that low waste doesn't trigger auto-disable
func TestCostAccounting_NoAutoDisable(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		WasteThreshold: 0.3, // 30% threshold
	}
	ca := NewCostAccounting(cfg)

	tenantID := "tenant-low-waste"

	// Simulate 10 requests with 10% waste ratio (below 30% threshold)
	for i := 0; i < 10; i++ {
		losingProviders := map[string]*ProviderWasteStats{
			"provider-b": {
				ProviderID:    "provider-b",
				TokensWasted:  10, // 10% of winner tokens
				CostWastedUSD: 0.0002,
			},
		}

		err := ca.RecordSpeculativeRequest(
			context.Background(),
			tenantID,
			"provider-a",
			100,   // winner tokens
			0.002, // winner cost
			losingProviders,
		)

		if err != nil {
			t.Fatalf("Failed to record request %d: %v", i, err)
		}
	}

	// Check stats
	stats := ca.GetTenantStats(tenantID)
	t.Logf("After 10 requests: waste_ratio=%.2f%%, threshold=%.2f%%",
		stats.WasteRatio*100, cfg.WasteThreshold*100)

	if stats.WasteRatio >= cfg.WasteThreshold {
		t.Errorf("Expected waste ratio %.2f%% to be below threshold %.2f%%",
			stats.WasteRatio*100, cfg.WasteThreshold*100)
	}

	// Check if not disabled
	disabled, reason := ca.ShouldDisableSpeculative(tenantID)
	if disabled {
		t.Errorf("Expected speculative mode to NOT be disabled, but got: %s", reason)
	}

	// Verify tenant is not disabled
	stats = ca.GetTenantStats(tenantID)
	if stats.IsDisabled {
		t.Error("Expected tenant to NOT be marked as disabled")
	}
}

// TestCostAccounting_ProviderStats tests per-provider statistics tracking
func TestCostAccounting_ProviderStats(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		WasteThreshold: 0.3,
	}
	ca := NewCostAccounting(cfg)

	tenantID := "tenant-provider-stats"

	// Provider A wins 3 times
	for i := 0; i < 3; i++ {
		losingProviders := map[string]*ProviderWasteStats{
			"provider-b": {
				ProviderID:    "provider-b",
				TokensWasted:  50,
				CostWastedUSD: 0.001,
			},
		}

		err := ca.RecordSpeculativeRequest(
			context.Background(),
			tenantID,
			"provider-a",
			100,
			0.002,
			losingProviders,
		)

		if err != nil {
			t.Fatalf("Failed to record request: %v", err)
		}
	}

	// Provider B wins 2 times
	for i := 0; i < 2; i++ {
		losingProviders := map[string]*ProviderWasteStats{
			"provider-a": {
				ProviderID:    "provider-a",
				TokensWasted:  50,
				CostWastedUSD: 0.001,
			},
		}

		err := ca.RecordSpeculativeRequest(
			context.Background(),
			tenantID,
			"provider-b",
			100,
			0.002,
			losingProviders,
		)

		if err != nil {
			t.Fatalf("Failed to record request: %v", err)
		}
	}

	// Verify provider stats
	stats := ca.GetTenantStats(tenantID)

	if len(stats.ProviderStats) != 2 {
		t.Errorf("Expected 2 providers, got %d", len(stats.ProviderStats))
	}

	// Find provider A stats
	var providerAStats *ProviderCostStats
	var providerBStats *ProviderCostStats
	for _, ps := range stats.ProviderStats {
		if ps.ProviderID == "provider-a" {
			providerAStats = ps
		} else if ps.ProviderID == "provider-b" {
			providerBStats = ps
		}
	}

	if providerAStats == nil {
		t.Fatal("Provider A stats not found")
	}
	if providerBStats == nil {
		t.Fatal("Provider B stats not found")
	}

	// Provider A should have 3 wins and 2 losses
	if providerAStats.WonCount != 3 {
		t.Errorf("Provider A: expected 3 wins, got %d", providerAStats.WonCount)
	}
	if providerAStats.LostCount != 2 {
		t.Errorf("Provider A: expected 2 losses, got %d", providerAStats.LostCount)
	}

	// Provider B should have 2 wins and 3 losses
	if providerBStats.WonCount != 2 {
		t.Errorf("Provider B: expected 2 wins, got %d", providerBStats.WonCount)
	}
	if providerBStats.LostCount != 3 {
		t.Errorf("Provider B: expected 3 losses, got %d", providerBStats.LostCount)
	}

	t.Logf("Provider A: wins=%d, losses=%d, winner_tokens=%d, wasted_tokens=%d",
		providerAStats.WonCount, providerAStats.LostCount,
		providerAStats.WinnerTokens, providerAStats.WastedTokens)
	t.Logf("Provider B: wins=%d, losses=%d, winner_tokens=%d, wasted_tokens=%d",
		providerBStats.WonCount, providerBStats.LostCount,
		providerBStats.WinnerTokens, providerBStats.WastedTokens)
}

// TestCostAccounting_ResetStats tests stat reset functionality
func TestCostAccounting_ResetStats(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		WasteThreshold: 0.3,
	}
	ca := NewCostAccounting(cfg)

	tenantID := "tenant-reset"

	// Record some requests
	for i := 0; i < 5; i++ {
		losingProviders := map[string]*ProviderWasteStats{
			"provider-b": {
				ProviderID:    "provider-b",
				TokensWasted:  50,
				CostWastedUSD: 0.001,
			},
		}

		err := ca.RecordSpeculativeRequest(
			context.Background(),
			tenantID,
			"provider-a",
			100,
			0.002,
			losingProviders,
		)

		if err != nil {
			t.Fatalf("Failed to record request: %v", err)
		}
	}

	// Verify stats before reset
	statsBefore := ca.GetTenantStats(tenantID)
	if statsBefore.RequestCount != 5 {
		t.Errorf("Expected 5 requests before reset, got %d", statsBefore.RequestCount)
	}

	if statsBefore.TotalCostUSD == 0 {
		t.Error("Expected non-zero total cost before reset")
	}

	// Reset stats
	ca.ResetTenantStats(tenantID)

	// Verify stats after reset
	statsAfter := ca.GetTenantStats(tenantID)
	if statsAfter.RequestCount != 0 {
		t.Errorf("Expected 0 requests after reset, got %d", statsAfter.RequestCount)
	}

	if statsAfter.TotalCostUSD != 0 {
		t.Errorf("Expected 0 total cost after reset, got $%.4f", statsAfter.TotalCostUSD)
	}

	if statsAfter.WasteRatio != 0 {
		t.Errorf("Expected 0 waste ratio after reset, got %.2f%%", statsAfter.WasteRatio*100)
	}

	t.Logf("Reset successful: before=%d requests, after=%d requests",
		statsBefore.RequestCount, statsAfter.RequestCount)
}

// TestCostAccounting_CoolDownPeriod tests that cool-down period is enforced
func TestCostAccounting_CoolDownPeriod(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		WasteThreshold: 0.3,
	}
	ca := NewCostAccounting(cfg)

	tenantID := "tenant-cooldown"

	// Simulate high waste to trigger auto-disable
	for i := 0; i < 10; i++ {
		losingProviders := map[string]*ProviderWasteStats{
			"provider-b": {
				ProviderID:    "provider-b",
				TokensWasted:  100,
				CostWastedUSD: 0.002,
			},
		}

		err := ca.RecordSpeculativeRequest(
			context.Background(),
			tenantID,
			"provider-a",
			100,
			0.002,
			losingProviders,
		)

		if err != nil {
			t.Fatalf("Failed to record request: %v", err)
		}
	}

	// Should be disabled
	disabled1, reason1 := ca.ShouldDisableSpeculative(tenantID)
	if !disabled1 {
		t.Fatal("Expected to be disabled after high waste")
	}
	t.Logf("First check: %s", reason1)

	// Check again immediately - should still be disabled
	disabled2, reason2 := ca.ShouldDisableSpeculative(tenantID)
	if !disabled2 {
		t.Error("Expected to still be disabled during cool-down period")
	}

	if reason2 == "" || reason2 == reason1 {
		t.Error("Expected cool-down reason to be different")
	}
	t.Logf("Second check: %s", reason2)

	// Verify stats
	stats := ca.GetTenantStats(tenantID)
	if stats.DisableCount != 1 {
		t.Errorf("Expected disable count 1, got %d (should only increment once)", stats.DisableCount)
	}
}

// TestCostAccounting_GlobalStats tests global statistics
func TestCostAccounting_GlobalStats(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		WasteThreshold: 0.3,
	}
	ca := NewCostAccounting(cfg)

	// Simulate requests from multiple tenants
	tenants := []string{"tenant-1", "tenant-2", "tenant-3"}

	for _, tenantID := range tenants {
		for i := 0; i < 3; i++ {
			losingProviders := map[string]*ProviderWasteStats{
				"provider-b": {
					ProviderID:    "provider-b",
					TokensWasted:  50,
					CostWastedUSD: 0.001,
				},
			}

			err := ca.RecordSpeculativeRequest(
				context.Background(),
				tenantID,
				"provider-a",
				100,
				0.002,
				losingProviders,
			)

			if err != nil {
				t.Fatalf("Failed to record request: %v", err)
			}
		}
	}

	// Check global stats
	globalStats := ca.GetGlobalStats()

	expectedRequests := int64(len(tenants) * 3)
	if globalStats.TotalRequestsProcessed != expectedRequests {
		t.Errorf("Expected %d total requests, got %d",
			expectedRequests, globalStats.TotalRequestsProcessed)
	}

	if globalStats.TenantCount != len(tenants) {
		t.Errorf("Expected %d tenants, got %d", len(tenants), globalStats.TenantCount)
	}

	expectedWastedTokens := int64(len(tenants) * 3 * 50) // 3 tenants * 3 requests * 50 tokens
	if globalStats.TotalWastedTokens != expectedWastedTokens {
		t.Errorf("Expected %d wasted tokens, got %d",
			expectedWastedTokens, globalStats.TotalWastedTokens)
	}

	expectedWastedCost := float64(len(tenants)) * 3 * 0.001
	if globalStats.TotalWastedCostUSD < expectedWastedCost-0.0001 ||
		globalStats.TotalWastedCostUSD > expectedWastedCost+0.0001 {
		t.Errorf("Expected $%.4f wasted cost, got $%.4f",
			expectedWastedCost, globalStats.TotalWastedCostUSD)
	}

	t.Logf("Global stats: requests=%d, tenants=%d, wasted_tokens=%d, wasted_cost=$%.4f",
		globalStats.TotalRequestsProcessed,
		globalStats.TenantCount,
		globalStats.TotalWastedTokens,
		globalStats.TotalWastedCostUSD)
}

// TestCostAccounting_ProviderFailure tests recording provider failures
func TestCostAccounting_ProviderFailure(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		WasteThreshold: 0.3,
	}
	ca := NewCostAccounting(cfg)

	tenantID := "tenant-failures"
	providerID := "provider-failure"

	// Record failures
	for i := 0; i < 5; i++ {
		ca.RecordProviderFailure(tenantID, providerID)
	}

	// Verify failure count
	stats := ca.GetTenantStats(tenantID)

	var providerStats *ProviderCostStats
	for _, ps := range stats.ProviderStats {
		if ps.ProviderID == providerID {
			providerStats = ps
			break
		}
	}

	if providerStats == nil {
		t.Fatal("Provider stats not found")
	}

	if providerStats.FailedCount != 5 {
		t.Errorf("Expected 5 failures, got %d", providerStats.FailedCount)
	}

	t.Logf("Provider %s failure count: %d", providerID, providerStats.FailedCount)
}

// TestCalculateWaste tests waste calculation helper
func TestCalculateWaste(t *testing.T) {
	// Create mock candidates
	candidates := []*ProviderCandidate{
		{
			ProviderID: "winner",
			TokenCount: 100,
		},
		{
			ProviderID: "loser-1",
			TokenCount: 75,
		},
		{
			ProviderID: "loser-2",
			TokenCount: 50,
		},
	}

	winner := candidates[0]

	costPerTokenUSD := map[string]float64{
		"winner":  0.002,
		"loser-1": 0.001,
		"loser-2": 0.0002,
	}

	waste := CalculateWaste(candidates, winner, costPerTokenUSD)

	// Verify waste calculation
	if len(waste) != 2 {
		t.Errorf("Expected 2 losing providers, got %d", len(waste))
	}

	// Check loser-1
	if loser1, exists := waste["loser-1"]; exists {
		if loser1.TokensWasted != 75 {
			t.Errorf("Loser-1: expected 75 wasted tokens, got %d", loser1.TokensWasted)
		}

		expectedCost := float64(75) * (0.001 / 1000.0)
		if loser1.CostWastedUSD < expectedCost-0.0001 || loser1.CostWastedUSD > expectedCost+0.0001 {
			t.Errorf("Loser-1: expected $%.6f, got $%.6f", expectedCost, loser1.CostWastedUSD)
		}
	} else {
		t.Error("Loser-1 not found in waste map")
	}

	// Check loser-2
	if loser2, exists := waste["loser-2"]; exists {
		if loser2.TokensWasted != 50 {
			t.Errorf("Loser-2: expected 50 wasted tokens, got %d", loser2.TokensWasted)
		}

		expectedCost := float64(50) * (0.0002 / 1000.0)
		if loser2.CostWastedUSD < expectedCost-0.00001 || loser2.CostWastedUSD > expectedCost+0.00001 {
			t.Errorf("Loser-2: expected $%.6f, got $%.6f", expectedCost, loser2.CostWastedUSD)
		}
	} else {
		t.Error("Loser-2 not found in waste map")
	}

	// Winner should not be in waste map
	if _, exists := waste["winner"]; exists {
		t.Error("Winner should not be in waste map")
	}
}
