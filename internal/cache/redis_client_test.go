package cache

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupMiniRedis(t *testing.T) (*miniredis.Miniredis, string) {
	mr := miniredis.RunT(t)
	redisURL := "redis://" + mr.Addr()
	return mr, redisURL
}

func TestNewProviderStatsClient(t *testing.T) {
	t.Run("creates client with valid URL", func(t *testing.T) {
		mr, redisURL := setupMiniRedis(t)
		defer mr.Close()

		client, err := NewProviderStatsClient(redisURL)
		require.NoError(t, err)
		require.NotNil(t, client)
		assert.True(t, client.IsEnabled())

		defer client.Close()
	})

	t.Run("disables client with empty URL", func(t *testing.T) {
		client, err := NewProviderStatsClient("")
		require.NoError(t, err)
		require.NotNil(t, client)
		assert.False(t, client.IsEnabled())
	})

	t.Run("returns error with invalid URL", func(t *testing.T) {
		client, err := NewProviderStatsClient("invalid://url")
		assert.Error(t, err)
		assert.Nil(t, client)
	})
}

func TestProviderStatsClient_UpdateAndGetStats(t *testing.T) {
	mr, redisURL := setupMiniRedis(t)
	defer mr.Close()

	client, err := NewProviderStatsClient(redisURL)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	t.Run("update and retrieve stats", func(t *testing.T) {
		stats := &ProviderStats{
			ProviderKey:   "openai:gpt-4",
			ProviderName:  "openai",
			ModelName:     "gpt-4",
			AvgLatencyMs:  250.5,
			TotalCostUSD:  1.50,
			SuccessRate:   98.5,
			TotalRequests: 100,
			SuccessCount:  98,
			ErrorCount:    2,
			FirstSeenAt:   time.Now().Add(-24 * time.Hour),
		}

		err := client.UpdateStats(ctx, stats)
		require.NoError(t, err)

		retrieved, err := client.GetStats(ctx, "openai:gpt-4")
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, stats.ProviderKey, retrieved.ProviderKey)
		assert.Equal(t, stats.ProviderName, retrieved.ProviderName)
		assert.Equal(t, stats.ModelName, retrieved.ModelName)
		assert.Equal(t, stats.TotalRequests, retrieved.TotalRequests)
	})

	t.Run("returns nil for non-existent stats", func(t *testing.T) {
		retrieved, err := client.GetStats(ctx, "non-existent-provider")
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})
}

func TestProviderStatsClient_IncrementRequest(t *testing.T) {
	mr, redisURL := setupMiniRedis(t)
	defer mr.Close()

	client, err := NewProviderStatsClient(redisURL)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()
	providerKey := "anthropic:claude-3"

	t.Run("increment successful requests", func(t *testing.T) {
		err := client.IncrementRequest(ctx, providerKey, true, 150.0, 0.02)
		require.NoError(t, err)

		err = client.IncrementRequest(ctx, providerKey, true, 200.0, 0.03)
		require.NoError(t, err)

		// Verify via direct Redis access
		key := "provider:stats:" + providerKey
		totalRequests, err := client.client.HGet(ctx, key, "total_requests").Int64()
		require.NoError(t, err)
		assert.Equal(t, int64(2), totalRequests)

		successCount, err := client.client.HGet(ctx, key, "success_count").Int64()
		require.NoError(t, err)
		assert.Equal(t, int64(2), successCount)
	})

	t.Run("increment failed requests", func(t *testing.T) {
		providerKey2 := "openai:gpt-3.5"
		err := client.IncrementRequest(ctx, providerKey2, false, 100.0, 0.01)
		require.NoError(t, err)

		key := "provider:stats:" + providerKey2
		errorCount, err := client.client.HGet(ctx, key, "error_count").Int64()
		require.NoError(t, err)
		assert.Equal(t, int64(1), errorCount)
	})
}

func TestProviderStatsClient_GetAllProviders(t *testing.T) {
	mr, redisURL := setupMiniRedis(t)
	defer mr.Close()

	client, err := NewProviderStatsClient(redisURL)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// Create stats for multiple providers
	providers := []string{"openai:gpt-4", "anthropic:claude-3", "openai:gpt-3.5"}

	for _, providerKey := range providers {
		stats := &ProviderStats{
			ProviderKey:   providerKey,
			TotalRequests: 10,
		}
		err := client.UpdateStats(ctx, stats)
		require.NoError(t, err)
	}

	// Get all providers
	allProviders, err := client.GetAllProviders(ctx)
	require.NoError(t, err)
	assert.Len(t, allProviders, 3)

	// Verify all provider keys are present
	providerMap := make(map[string]bool)
	for _, p := range allProviders {
		providerMap[p] = true
	}

	for _, expectedProvider := range providers {
		assert.True(t, providerMap[expectedProvider], "Provider %s not found", expectedProvider)
	}
}

func TestProviderStatsClient_DeleteStats(t *testing.T) {
	mr, redisURL := setupMiniRedis(t)
	defer mr.Close()

	client, err := NewProviderStatsClient(redisURL)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()
	providerKey := "test:provider"

	// Create stats
	stats := &ProviderStats{
		ProviderKey:   providerKey,
		TotalRequests: 100,
	}
	err = client.UpdateStats(ctx, stats)
	require.NoError(t, err)

	// Verify stats exist
	retrieved, err := client.GetStats(ctx, providerKey)
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	// Delete stats
	err = client.DeleteStats(ctx, providerKey)
	require.NoError(t, err)

	// Verify stats are deleted
	retrieved, err = client.GetStats(ctx, providerKey)
	require.NoError(t, err)
	assert.Nil(t, retrieved)
}

func TestProviderStatsClient_GetStatsSummary(t *testing.T) {
	mr, redisURL := setupMiniRedis(t)
	defer mr.Close()

	client, err := NewProviderStatsClient(redisURL)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// Create multiple provider stats
	providers := []struct {
		key      string
		requests int64
		successes int64
		errors    int64
		cost      float64
	}{
		{"openai:gpt-4", 100, 98, 2, 5.50},
		{"anthropic:claude-3", 50, 50, 0, 2.25},
		{"openai:gpt-3.5", 200, 190, 10, 3.00},
	}

	for _, p := range providers {
		stats := &ProviderStats{
			ProviderKey:   p.key,
			TotalRequests: p.requests,
			SuccessCount:  p.successes,
			ErrorCount:    p.errors,
			TotalCostUSD:  p.cost,
		}
		err := client.UpdateStats(ctx, stats)
		require.NoError(t, err)
	}

	// Get summary
	summary, err := client.GetStatsSummary(ctx)
	require.NoError(t, err)
	require.NotNil(t, summary)

	assert.Equal(t, 3, summary["total_providers"])
	assert.Equal(t, int64(350), summary["total_requests"])
	assert.Equal(t, int64(338), summary["success_count"])
	assert.Equal(t, int64(12), summary["error_count"])
	assert.InDelta(t, 10.75, summary["total_cost_usd"], 0.01)

	// Calculate expected success rate
	expectedSuccessRate := (338.0 / 350.0) * 100
	assert.InDelta(t, expectedSuccessRate, summary["success_rate_pct"], 0.01)
}

func TestProviderStatsClient_DisabledOperations(t *testing.T) {
	// Create disabled client
	client := &ProviderStatsClient{enabled: false}
	ctx := context.Background()

	t.Run("UpdateStats is no-op when disabled", func(t *testing.T) {
		stats := &ProviderStats{ProviderKey: "test"}
		err := client.UpdateStats(ctx, stats)
		assert.NoError(t, err)
	})

	t.Run("IncrementRequest is no-op when disabled", func(t *testing.T) {
		err := client.IncrementRequest(ctx, "test", true, 100.0, 0.01)
		assert.NoError(t, err)
	})

	t.Run("GetStats returns error when disabled", func(t *testing.T) {
		_, err := client.GetStats(ctx, "test")
		assert.Error(t, err)
	})

	t.Run("Close is safe when disabled", func(t *testing.T) {
		err := client.Close()
		assert.NoError(t, err)
	})
}

func TestProviderStatsClient_ConcurrentAccess(t *testing.T) {
	mr, redisURL := setupMiniRedis(t)
	defer mr.Close()

	client, err := NewProviderStatsClient(redisURL)
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()
	providerKey := "concurrent:test"

	// Concurrent increment operations
	concurrency := 10
	done := make(chan bool, concurrency)

	for i := 0; i < concurrency; i++ {
		go func() {
			defer func() { done <- true }()

			for j := 0; j < 10; j++ {
				err := client.IncrementRequest(ctx, providerKey, true, 100.0, 0.01)
				assert.NoError(t, err)
			}
		}()
	}

	// Wait for all goroutines
	for i := 0; i < concurrency; i++ {
		<-done
	}

	// Verify total count
	key := "provider:stats:" + providerKey
	totalRequests, err := client.client.HGet(ctx, key, "total_requests").Int64()
	require.NoError(t, err)
	assert.Equal(t, int64(100), totalRequests) // 10 goroutines * 10 requests each
}

// BenchmarkProviderStatsClient_IncrementRequest benchmarks the increment operation
func BenchmarkProviderStatsClient_IncrementRequest(b *testing.B) {
	mr := miniredis.NewMiniRedis()
	if err := mr.Start(); err != nil {
		b.Fatal(err)
	}
	defer mr.Close()

	redisURL := "redis://" + mr.Addr()
	client, err := NewProviderStatsClient(redisURL)
	if err != nil {
		b.Fatal(err)
	}
	defer client.Close()

	ctx := context.Background()
	providerKey := "bench:provider"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.IncrementRequest(ctx, providerKey, true, 100.0, 0.01)
	}
}
