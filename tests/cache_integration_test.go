package tests

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/schlep-engine/go-gateway/internal/cache"
)

// TestCacheIntegration_L1ToL2Fallback tests the multi-tier cache fallback flow
func TestCacheIntegration_L1ToL2Fallback(t *testing.T) {
	t.Skip("Requires Redis instance - run manually")

	logger := zerolog.Nop()
	ctx := context.Background()

	// Create multi-tier cache (L1 + L2)
	mtc, err := cache.NewMultiTierCache(cache.MultiTierCacheConfig{
		LRUConfig: cache.LRUConfig{
			Capacity:    10,
			TTL:         5 * time.Minute,
			EnableStats: true,
		},
		RedisConfig: cache.Config{
			Address:    "localhost:6379",
			DB:         1, // Use test DB
			TTL:        1 * time.Hour,
			PoolSize:   5,
			MaxRetries: 3,
		},
		EnableL1: true,
		EnableL2: true,
	}, logger)
	require.NoError(t, err)
	defer mtc.Close()

	pred := &cache.CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    "test_model",
	}
	features := []float64{1.0, 2.0, 3.0}

	t.Run("L1 miss, L2 miss, then set", func(t *testing.T) {
		// First get - should miss both tiers
		result, err := mtc.Get(ctx, "test_model", features)
		require.NoError(t, err)
		assert.Nil(t, result)

		// Set in both tiers
		err = mtc.Set(ctx, "test_model", features, pred)
		require.NoError(t, err)

		// Second get - should hit L1
		result, err = mtc.Get(ctx, "test_model", features)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, 0.95, result.Prediction)

		// Check stats
		stats, err := mtc.GetStats(ctx)
		require.NoError(t, err)
		overall := stats["overall"].(map[string]interface{})
		assert.Equal(t, int64(1), overall["total_hits"])
	})

	t.Run("L1 miss, L2 hit, promote to L1", func(t *testing.T) {
		// Clear L1 only
		mtc.Delete(ctx, "test_model", features)

		// L2 should still have the data
		// Get should hit L2 and promote to L1
		result, err := mtc.Get(ctx, "test_model", features)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, 0.95, result.Prediction)

		// Next get should hit L1
		result, err = mtc.Get(ctx, "test_model", features)
		require.NoError(t, err)
		require.NotNil(t, result)
	})
}

// TestCacheIntegration_ConcurrentAccess tests concurrent cache operations
func TestCacheIntegration_ConcurrentAccess(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := cache.NewMultiTierCache(cache.MultiTierCacheConfig{
		LRUConfig: cache.LRUConfig{
			Capacity:    100,
			TTL:         10 * time.Minute,
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false, // L1 only for this test
	}, logger)
	require.NoError(t, err)
	defer mtc.Close()

	// Concurrent writes
	t.Run("concurrent writes", func(t *testing.T) {
		done := make(chan bool)

		for i := 0; i < 10; i++ {
			go func(id int) {
				for j := 0; j < 100; j++ {
					features := []float64{float64(id), float64(j)}
					pred := &cache.CachedPrediction{
						Prediction: float64(j),
						ModelID:    fmt.Sprintf("model_%d", id),
					}
					mtc.Set(ctx, fmt.Sprintf("model_%d", id), features, pred)
				}
				done <- true
			}(i)
		}

		for i := 0; i < 10; i++ {
			<-done
		}

		stats, err := mtc.GetStats(ctx)
		require.NoError(t, err)
		assert.NotNil(t, stats)
	})

	// Concurrent reads and writes
	t.Run("concurrent reads and writes", func(t *testing.T) {
		done := make(chan bool)

		// Writers
		for i := 0; i < 5; i++ {
			go func(id int) {
				for j := 0; j < 50; j++ {
					features := []float64{float64(id), float64(j)}
					pred := &cache.CachedPrediction{
						Prediction: float64(j),
						ModelID:    fmt.Sprintf("rw_model_%d", id),
					}
					mtc.Set(ctx, fmt.Sprintf("rw_model_%d", id), features, pred)
					time.Sleep(1 * time.Millisecond)
				}
				done <- true
			}(i)
		}

		// Readers
		for i := 0; i < 5; i++ {
			go func(id int) {
				for j := 0; j < 50; j++ {
					features := []float64{float64(id), float64(j)}
					mtc.Get(ctx, fmt.Sprintf("rw_model_%d", id), features)
					time.Sleep(1 * time.Millisecond)
				}
				done <- true
			}(i)
		}

		for i := 0; i < 10; i++ {
			<-done
		}
	})
}

// TestCacheIntegration_TTLExpiration tests cache entry expiration
func TestCacheIntegration_TTLExpiration(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := cache.NewMultiTierCache(cache.MultiTierCacheConfig{
		LRUConfig: cache.LRUConfig{
			Capacity:    10,
			TTL:         100 * time.Millisecond, // Very short TTL for testing
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	require.NoError(t, err)
	defer mtc.Close()

	pred := &cache.CachedPrediction{
		Prediction: 0.95,
		ModelID:    "ttl_test",
	}
	features := []float64{1.0, 2.0}

	// Set entry
	err = mtc.Set(ctx, "ttl_test", features, pred)
	require.NoError(t, err)

	// Immediate get should work
	result, err := mtc.Get(ctx, "ttl_test", features)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Wait for expiration
	time.Sleep(150 * time.Millisecond)

	// Should be expired now
	result, err = mtc.Get(ctx, "ttl_test", features)
	require.NoError(t, err)
	assert.Nil(t, result)
}

// TestCacheIntegration_Invalidation tests cache invalidation
func TestCacheIntegration_Invalidation(t *testing.T) {
	t.Skip("Requires Redis instance - run manually")

	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := cache.NewMultiTierCache(cache.MultiTierCacheConfig{
		LRUConfig: cache.LRUConfig{
			Capacity:    10,
			TTL:         1 * time.Hour,
			EnableStats: true,
		},
		RedisConfig: cache.Config{
			Address:    "localhost:6379",
			DB:         1,
			TTL:        1 * time.Hour,
			PoolSize:   5,
			MaxRetries: 3,
		},
		EnableL1: true,
		EnableL2: true,
	}, logger)
	require.NoError(t, err)
	defer mtc.Close()

	// Set multiple predictions for a model
	pred1 := &cache.CachedPrediction{Prediction: 0.95, ModelID: "inv_test"}
	pred2 := &cache.CachedPrediction{Prediction: 0.88, ModelID: "inv_test"}

	mtc.Set(ctx, "inv_test", []float64{1.0}, pred1)
	mtc.Set(ctx, "inv_test", []float64{2.0}, pred2)

	// Verify both exist
	result1, _ := mtc.Get(ctx, "inv_test", []float64{1.0})
	result2, _ := mtc.Get(ctx, "inv_test", []float64{2.0})
	require.NotNil(t, result1)
	require.NotNil(t, result2)

	// Invalidate model
	err = mtc.InvalidateModel(ctx, "inv_test")
	require.NoError(t, err)

	// Both should be gone
	result1, _ = mtc.Get(ctx, "inv_test", []float64{1.0})
	result2, _ = mtc.Get(ctx, "inv_test", []float64{2.0})
	assert.Nil(t, result1)
	assert.Nil(t, result2)
}

// BenchmarkCacheIntegration_MultiTierGet benchmarks multi-tier cache get operations
func BenchmarkCacheIntegration_MultiTierGet(b *testing.B) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, _ := cache.NewMultiTierCache(cache.MultiTierCacheConfig{
		LRUConfig: cache.LRUConfig{
			Capacity:    10000,
			TTL:         1 * time.Hour,
			EnableStats: false,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	defer mtc.Close()

	// Pre-populate
	pred := &cache.CachedPrediction{Prediction: 0.95, Confidence: 0.87}
	for i := 0; i < 10000; i++ {
		features := []float64{float64(i)}
		mtc.Set(ctx, "bench_model", features, pred)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		features := []float64{float64(i % 10000)}
		mtc.Get(ctx, "bench_model", features)
	}
}

// BenchmarkCacheIntegration_MultiTierSet benchmarks multi-tier cache set operations
func BenchmarkCacheIntegration_MultiTierSet(b *testing.B) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, _ := cache.NewMultiTierCache(cache.MultiTierCacheConfig{
		LRUConfig: cache.LRUConfig{
			Capacity:    10000,
			TTL:         1 * time.Hour,
			EnableStats: false,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	defer mtc.Close()

	pred := &cache.CachedPrediction{Prediction: 0.95, Confidence: 0.87}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		features := []float64{float64(i % 10000)}
		mtc.Set(ctx, "bench_model", features, pred)
	}
}
