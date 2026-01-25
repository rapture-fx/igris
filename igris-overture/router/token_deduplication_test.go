package router

import (
	"context"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test P0-1: Token-Level Deduplication
// Ensures that customers are billed only for tokens actually delivered to them,
// not for duplicate or wasted tokens from losing providers in speculative execution.
func TestStreamMerger_TokenDeduplication(t *testing.T) {
	ctx := context.Background()

	// Create mock provider candidates
	winner := &ProviderCandidate{
		ProviderID: "provider-A",
		TokenChan:  make(chan *models.StreamChunk, 10),
		ErrChan:    make(chan error, 1),
		TokenCount: 0,
	}
	winner.Context, winner.Cancel = context.WithCancel(ctx)

	loser1 := &ProviderCandidate{
		ProviderID: "provider-B",
		TokenChan:  make(chan *models.StreamChunk, 10),
		ErrChan:    make(chan error, 1),
		TokenCount: 0,
	}
	loser1.Context, loser1.Cancel = context.WithCancel(ctx)

	loser2 := &ProviderCandidate{
		ProviderID: "provider-C",
		TokenChan:  make(chan *models.StreamChunk, 10),
		ErrChan:    make(chan error, 1),
		TokenCount: 0,
	}
	loser2.Context, loser2.Cancel = context.WithCancel(ctx)

	candidates := []*ProviderCandidate{winner, loser1, loser2}

	// Create stream merger
	merger := NewStreamMerger(ctx, winner, candidates)

	// Start the merger
	tokenChan, errChan := merger.Start()

	// Simulate streaming from all providers in parallel
	// Winner sends 5 tokens
	go func() {
		for i := 1; i <= 5; i++ {
			winner.mu.Lock()
			winner.TokenCount++
			winner.mu.Unlock()

			winner.TokenChan <- &models.StreamChunk{
				Choices: []models.Choice{
					{
						Index: 0,
						Delta: &models.Message{
							Content: string(rune('A' + i - 1)), // A, B, C, D, E
						},
					},
				},
			}
			time.Sleep(10 * time.Millisecond)
		}
		close(winner.TokenChan)
	}()

	// Loser1 sends 3 tokens (these should be wasted)
	go func() {
		for i := 1; i <= 3; i++ {
			loser1.mu.Lock()
			loser1.TokenCount++
			loser1.mu.Unlock()

			loser1.TokenChan <- &models.StreamChunk{
				Choices: []models.Choice{
					{
						Index: 0,
						Delta: &models.Message{
							Content: string(rune('X' + i - 1)), // X, Y, Z
						},
					},
				},
			}
			time.Sleep(15 * time.Millisecond)
		}
		close(loser1.TokenChan)
	}()

	// Loser2 sends 2 tokens (these should be wasted)
	go func() {
		for i := 1; i <= 2; i++ {
			loser2.mu.Lock()
			loser2.TokenCount++
			loser2.mu.Unlock()

			loser2.TokenChan <- &models.StreamChunk{
				Choices: []models.Choice{
					{
						Index: 0,
						Delta: &models.Message{
							Content: string(rune('P' + i - 1)), // P, Q
						},
					},
				},
			}
			time.Sleep(20 * time.Millisecond)
		}
		close(loser2.TokenChan)
	}()

	// Consume all delivered tokens
	deliveredTokens := make([]*models.StreamChunk, 0)
	timeout := time.After(2 * time.Second)

consuming:
	for {
		select {
		case token, ok := <-tokenChan:
			if !ok {
				break consuming
			}
			deliveredTokens = append(deliveredTokens, token)

		case err := <-errChan:
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

		case <-timeout:
			t.Fatal("Timeout waiting for tokens")
		}
	}

	// Verify only 5 tokens were delivered (from winner, not 5+3+2=10)
	assert.Equal(t, 5, len(deliveredTokens), "Should deliver exactly 5 tokens from winner")

	// Verify content of delivered tokens
	expectedContent := []string{"A", "B", "C", "D", "E"}
	for i, token := range deliveredTokens {
		if len(token.Choices) > 0 && token.Choices[0].Delta != nil {
			assert.Equal(t, expectedContent[i], token.Choices[0].Delta.Content)
		}
	}

	// Get metadata and verify per-provider counts
	metadata := merger.GetMetadata()

	assert.Equal(t, 5, metadata.TokensDelivered, "Should report 5 tokens delivered")
	assert.Equal(t, 5, metadata.UniqueTokensDelivered, "Should track 5 unique tokens")
	assert.Equal(t, "provider-A", metadata.FinalProvider, "Final provider should be winner")

	// Verify per-provider token counts
	assert.Equal(t, 5, metadata.ProviderTokenCounts["provider-A"], "Provider A should have delivered 5 tokens")
	assert.Equal(t, 0, metadata.ProviderTokenCounts["provider-B"], "Provider B should have delivered 0 tokens")
	assert.Equal(t, 0, metadata.ProviderTokenCounts["provider-C"], "Provider C should have delivered 0 tokens")

	// Verify token counts in candidates (for waste calculation)
	winner.mu.Lock()
	winnerGenerated := winner.TokenCount
	winner.mu.Unlock()

	loser1.mu.Lock()
	loser1Generated := loser1.TokenCount
	loser1.mu.Unlock()

	loser2.mu.Lock()
	loser2Generated := loser2.TokenCount
	loser2.mu.Unlock()

	assert.Equal(t, 5, winnerGenerated, "Winner should have generated 5 tokens")
	assert.Equal(t, 3, loser1Generated, "Loser1 should have generated 3 tokens (wasted)")
	assert.Equal(t, 2, loser2Generated, "Loser2 should have generated 2 tokens (wasted)")

	// Calculate waste correctly
	costPerTokenUSD := map[string]float64{
		"provider-A": 0.002,
		"provider-B": 0.002,
		"provider-C": 0.002,
	}

	wasteByProvider := make(map[string]*ProviderWasteStats)
	for _, candidate := range candidates {
		candidate.mu.Lock()
		tokensGenerated := candidate.TokenCount
		candidate.mu.Unlock()

		tokensDelivered := 0
		if count, exists := metadata.ProviderTokenCounts[candidate.ProviderID]; exists {
			tokensDelivered = count
		}

		tokensWasted := tokensGenerated - tokensDelivered
		if tokensWasted > 0 {
			costWasted := float64(tokensWasted) * (costPerTokenUSD[candidate.ProviderID] / 1000.0)
			wasteByProvider[candidate.ProviderID] = &ProviderWasteStats{
				ProviderID:    candidate.ProviderID,
				TokensWasted:  tokensWasted,
				CostWastedUSD: costWasted,
			}
		}
	}

	// Verify waste calculation
	assert.Nil(t, wasteByProvider["provider-A"], "Winner should have no waste")
	require.NotNil(t, wasteByProvider["provider-B"], "Loser1 should have waste")
	require.NotNil(t, wasteByProvider["provider-C"], "Loser2 should have waste")

	assert.Equal(t, 3, wasteByProvider["provider-B"].TokensWasted)
	assert.Equal(t, 2, wasteByProvider["provider-C"].TokensWasted)

	// Total waste should be 5 tokens (3+2), not counted in delivered
	totalWaste := 0
	for _, waste := range wasteByProvider {
		totalWaste += waste.TokensWasted
	}
	assert.Equal(t, 5, totalWaste, "Total wasted tokens should be 5")

	// Customer should ONLY be billed for 5 delivered tokens, not 10 total generated
	customerBilledTokens := metadata.TokensDelivered
	assert.Equal(t, 5, customerBilledTokens, "Customer billed for exactly 5 delivered tokens")
}

// Test P0-1: Duplicate Token Detection
// Ensures that if the same token content appears twice (e.g., mid-stream switch),
// it's only delivered once
func TestStreamMerger_DuplicateTokenPrevention(t *testing.T) {
	ctx := context.Background()

	winner := &ProviderCandidate{
		ProviderID: "provider-A",
		TokenChan:  make(chan *models.StreamChunk, 10),
		ErrChan:    make(chan error, 1),
		TokenCount: 0,
	}
	winner.Context, winner.Cancel = context.WithCancel(ctx)

	candidates := []*ProviderCandidate{winner}
	merger := NewStreamMerger(ctx, winner, candidates)
	tokenChan, _ := merger.Start()

	// Send same token twice (simulate duplicate)
	duplicateToken := &models.StreamChunk{
		Choices: []models.Choice{
			{
				Index: 0,
				Delta: &models.Message{
					Content: "Hello",
				},
			},
		},
	}

	go func() {
		winner.TokenChan <- duplicateToken
		time.Sleep(10 * time.Millisecond)
		winner.TokenChan <- duplicateToken // Duplicate!
		time.Sleep(10 * time.Millisecond)
		close(winner.TokenChan)
	}()

	// Consume tokens
	deliveredCount := 0
	timeout := time.After(1 * time.Second)

	for {
		select {
		case token, ok := <-tokenChan:
			if !ok {
				goto done
			}
			if token != nil {
				deliveredCount++
			}
		case <-timeout:
			goto done
		}
	}

done:
	// Should only deliver 1 token, not 2
	assert.Equal(t, 1, deliveredCount, "Duplicate token should be filtered out")

	metadata := merger.GetMetadata()
	assert.Equal(t, 1, metadata.UniqueTokensDelivered, "Should track 1 unique token")
	assert.Equal(t, 1, metadata.TokensDelivered, "Should deliver 1 token")
}

// Test P0-1: Cost Accounting Integration
// Ensures RecordSpeculativeRequestWithProviderBreakdown correctly calculates costs
func TestCostAccounting_PerProviderBilling(t *testing.T) {
	config := &config.SpeculativeConfig{
		WasteThreshold: 0.5,
	}
	ca := NewCostAccounting(config)

	tenantID := "test-tenant"

	// Simulate scenario: 3 providers raced, 2 delivered tokens, 1 was pure waste
	deliveredByProvider := map[string]*ProviderDeliveredCost{
		"provider-A": {
			ProviderID:       "provider-A",
			TokensDelivered:  50,
			CostDeliveredUSD: 0.100, // 50 tokens * $0.002/1k
		},
		"provider-B": {
			ProviderID:       "provider-B",
			TokensDelivered:  30,
			CostDeliveredUSD: 0.060, // 30 tokens * $0.002/1k (mid-stream switch)
		},
	}

	wasteByProvider := map[string]*ProviderWasteStats{
		"provider-A": {
			ProviderID:    "provider-A",
			TokensWasted:  10, // Generated 60, delivered 50
			CostWastedUSD: 0.020,
		},
		"provider-B": {
			ProviderID:    "provider-B",
			TokensWasted:  5, // Generated 35, delivered 30
			CostWastedUSD: 0.010,
		},
		"provider-C": {
			ProviderID:    "provider-C",
			TokensWasted:  20, // Generated 20, delivered 0 (lost race)
			CostWastedUSD: 0.040,
		},
	}

	err := ca.RecordSpeculativeRequestWithProviderBreakdown(
		context.Background(),
		tenantID,
		deliveredByProvider,
		wasteByProvider,
	)
	require.NoError(t, err)

	// Verify tenant stats
	stats := ca.GetTenantStats(tenantID)
	require.NotNil(t, stats)

	// Total delivered: 50 + 30 = 80 tokens
	assert.Equal(t, 80, stats.WinnerTokens, "Should track 80 delivered tokens")

	// Total waste: 10 + 5 + 20 = 35 tokens
	assert.Equal(t, 35, stats.WastedTokens, "Should track 35 wasted tokens")

	// Total cost delivered: $0.100 + $0.060 = $0.160
	assert.InDelta(t, 0.160, stats.WinnerCostUSD, 0.001, "Delivered cost should be $0.160")

	// Total cost wasted: $0.020 + $0.010 + $0.040 = $0.070
	assert.InDelta(t, 0.070, stats.WastedCostUSD, 0.001, "Wasted cost should be $0.070")

	// Total cost: $0.160 + $0.070 = $0.230
	assert.InDelta(t, 0.230, stats.TotalCostUSD, 0.001, "Total cost should be $0.230")

	// Waste ratio: $0.070 / $0.230 = ~30.4%
	assert.InDelta(t, 0.304, stats.WasteRatio, 0.01, "Waste ratio should be ~30.4%")

	// Verify per-provider stats
	providerAStats := findProviderStats(stats.ProviderStats, "provider-A")
	require.NotNil(t, providerAStats, "Provider A stats should exist")
	assert.Equal(t, int64(1), providerAStats.WonCount, "Provider A won once")
	assert.Equal(t, int64(50), providerAStats.WinnerTokens, "Provider A delivered 50 tokens")

	providerBStats := findProviderStats(stats.ProviderStats, "provider-B")
	require.NotNil(t, providerBStats, "Provider B stats should exist")
	assert.Equal(t, int64(1), providerBStats.WonCount, "Provider B won once (contributed tokens)")
	assert.Equal(t, int64(30), providerBStats.WinnerTokens, "Provider B delivered 30 tokens")

	providerCStats := findProviderStats(stats.ProviderStats, "provider-C")
	require.NotNil(t, providerCStats, "Provider C stats should exist")
	assert.Equal(t, int64(1), providerCStats.LostCount, "Provider C lost (delivered 0 tokens)")
	assert.Equal(t, int64(20), providerCStats.WastedTokens, "Provider C wasted 20 tokens")
}

func findProviderStats(stats []*ProviderCostStats, providerID string) *ProviderCostStats {
	for _, stat := range stats {
		if stat.ProviderID == providerID {
			return stat
		}
	}
	return nil
}
