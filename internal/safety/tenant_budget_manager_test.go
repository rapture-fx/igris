package safety

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTenantBudgetManager_GetTracker(t *testing.T) {
	config := &SafetyConfig{
		MaxMonthlyCostUSD:    100.0,
		EnableBudgetLimit:    true,
		MaxTokensPerRequest:  4096,
		EnableTokenLimit:     true,
	}

	tbm := NewTenantBudgetManager(config, nil)

	t.Run("creates new tracker for new tenant", func(t *testing.T) {
		tracker1 := tbm.GetTracker("tenant-1")
		require.NotNil(t, tracker1)

		// Verify the tracker is cached
		tracker2 := tbm.GetTracker("tenant-1")
		assert.Same(t, tracker1, tracker2, "Should return same tracker instance")
	})

	t.Run("creates separate trackers for different tenants", func(t *testing.T) {
		trackerA := tbm.GetTracker("tenant-a")
		trackerB := tbm.GetTracker("tenant-b")

		assert.NotSame(t, trackerA, trackerB, "Different tenants should have different trackers")
	})

	t.Run("tenant count increases with new tenants", func(t *testing.T) {
		tbm2 := NewTenantBudgetManager(config, nil)

		assert.Equal(t, 0, tbm2.GetTenantCount())

		tbm2.GetTracker("tenant-1")
		assert.Equal(t, 1, tbm2.GetTenantCount())

		tbm2.GetTracker("tenant-2")
		assert.Equal(t, 2, tbm2.GetTenantCount())

		// Same tenant doesn't increase count
		tbm2.GetTracker("tenant-1")
		assert.Equal(t, 2, tbm2.GetTenantCount())
	})
}

func TestTenantBudgetManager_BudgetIsolation(t *testing.T) {
	config := &SafetyConfig{
		MaxMonthlyCostUSD:    10.0,
		EnableBudgetLimit:    true,
		MaxTokensPerRequest:  4096,
		EnableTokenLimit:     true,
	}

	tbm := NewTenantBudgetManager(config, nil)

	t.Run("tenant budgets are isolated", func(t *testing.T) {
		trackerA := tbm.GetTracker("tenant-a")
		trackerB := tbm.GetTracker("tenant-b")

		// Record cost for tenant A
		err := trackerA.RecordCost("openai", "gpt-4", 5.0)
		require.NoError(t, err)

		// Check tenant A budget
		statsA := trackerA.GetStats()
		assert.Equal(t, 5.0, statsA["monthly_spend_usd"])

		// Check tenant B budget (should be 0)
		statsB := trackerB.GetStats()
		assert.Equal(t, 0.0, statsB["monthly_spend_usd"])
	})

	t.Run("tenant A budget breach doesn't affect tenant B", func(t *testing.T) {
		trackerA := tbm.GetTracker("tenant-a-breach")
		trackerB := tbm.GetTracker("tenant-b-safe")

		// Breach tenant A's budget
		err := trackerA.RecordCost("openai", "gpt-4", 12.0) // Over $10 limit
		require.NoError(t, err)

		// Tenant A should be breached
		assert.True(t, trackerA.IsBudgetBreached())

		// Tenant B should still be within budget
		checkB := trackerB.CheckBudget(5.0)
		assert.True(t, checkB.Allowed, "Tenant B should be allowed even though tenant A is breached")
		assert.False(t, trackerB.IsBudgetBreached())
	})
}

func TestTenantBudgetManager_GetAllTrackers(t *testing.T) {
	config := &SafetyConfig{
		MaxMonthlyCostUSD:    100.0,
		EnableBudgetLimit:    true,
		MaxTokensPerRequest:  4096,
		EnableTokenLimit:     true,
	}

	tbm := NewTenantBudgetManager(config, nil)

	// Create several tenants
	tenants := []string{"tenant-1", "tenant-2", "tenant-3"}
	for _, tenant := range tenants {
		tbm.GetTracker(tenant)
	}

	// Get all trackers
	allTrackers := tbm.GetAllTrackers()

	assert.Len(t, allTrackers, 3)
	for _, tenant := range tenants {
		_, exists := allTrackers[tenant]
		assert.True(t, exists, "Tracker for %s should exist", tenant)
	}
}

func TestTenantBudgetManager_GetAggregatedStats(t *testing.T) {
	config := &SafetyConfig{
		MaxMonthlyCostUSD:    100.0,
		EnableBudgetLimit:    true,
		MaxTokensPerRequest:  4096,
		EnableTokenLimit:     true,
	}

	tbm := NewTenantBudgetManager(config, nil)

	// Create trackers and record costs
	tracker1 := tbm.GetTracker("tenant-1")
	tracker1.RecordCost("openai", "gpt-4", 10.0)

	tracker2 := tbm.GetTracker("tenant-2")
	tracker2.RecordCost("anthropic", "claude-3", 20.0)

	tracker3 := tbm.GetTracker("tenant-3")
	tracker3.RecordCost("openai", "gpt-3.5", 5.0)

	// Get aggregated stats
	aggStats := tbm.GetAggregatedStats()

	assert.Equal(t, 3, aggStats["total_tenants"])
	assert.Equal(t, 35.0, aggStats["total_spend_usd"])
	assert.Equal(t, int64(3), aggStats["total_requests"])
	assert.InDelta(t, 11.67, aggStats["avg_spend_per_tenant"], 0.01)
}

func TestTenantBudgetManager_RemoveTracker(t *testing.T) {
	config := &SafetyConfig{
		MaxMonthlyCostUSD:    100.0,
		EnableBudgetLimit:    true,
		MaxTokensPerRequest:  4096,
		EnableTokenLimit:     true,
	}

	tbm := NewTenantBudgetManager(config, nil)

	// Create tracker
	tbm.GetTracker("tenant-to-remove")
	assert.Equal(t, 1, tbm.GetTenantCount())

	// Remove tracker
	tbm.RemoveTracker("tenant-to-remove")
	assert.Equal(t, 0, tbm.GetTenantCount())
}

func TestTenantBudgetManager_ConcurrentAccess(t *testing.T) {
	config := &SafetyConfig{
		MaxMonthlyCostUSD:    100.0,
		EnableBudgetLimit:    true,
		MaxTokensPerRequest:  4096,
		EnableTokenLimit:     true,
	}

	tbm := NewTenantBudgetManager(config, nil)

	// Concurrent access to same tenant
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func() {
			defer func() { done <- true }()

			tracker := tbm.GetTracker("concurrent-tenant")
			assert.NotNil(t, tracker)
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	// Should only have one tracker
	assert.Equal(t, 1, tbm.GetTenantCount())
}
