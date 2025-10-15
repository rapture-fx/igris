package cache

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
)

func TestNewMultiTierCache(t *testing.T) {
	logger := zerolog.Nop()

	t.Run("L1 only", func(t *testing.T) {
		mtc, err := NewMultiTierCache(MultiTierCacheConfig{
			LRUConfig: LRUConfig{
				Capacity:    100,
				TTL:         5 * time.Minute,
				EnableStats: true,
			},
			EnableL1: true,
			EnableL2: false,
		}, logger)

		assert.NoError(t, err)
		assert.NotNil(t, mtc)
		assert.NotNil(t, mtc.lruCache)
		assert.Nil(t, mtc.redisCache)
	})

	t.Run("no cache layers", func(t *testing.T) {
		mtc, err := NewMultiTierCache(MultiTierCacheConfig{
			EnableL1: false,
			EnableL2: false,
		}, logger)

		assert.NoError(t, err)
		assert.NotNil(t, mtc)
	})
}

func TestMultiTierCache_L1Only(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    10,
			TTL:         1 * time.Hour,
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	require := assert.New(t)
	require.NoError(err)

	pred := &CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    "model1",
	}
	features := []float64{1.0, 2.0, 3.0}

	// Set
	err = mtc.Set(ctx, "model1", features, pred)
	require.NoError(err)

	// Get (should hit L1)
	result, err := mtc.Get(ctx, "model1", features)
	require.NoError(err)
	require.NotNil(result)
	require.Equal(0.95, result.Prediction)

	// Stats should show L1 hit
	stats, err := mtc.GetStats(ctx)
	require.NoError(err)
	overall := stats["overall"].(map[string]interface{})
	require.Equal(int64(1), overall["total_hits"])
	require.Equal(int64(0), overall["total_misses"])
}

func TestMultiTierCache_L1Miss(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    10,
			TTL:         1 * time.Hour,
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	require := assert.New(t)
	require.NoError(err)

	features := []float64{1.0, 2.0, 3.0}

	// Get non-existent key
	result, err := mtc.Get(ctx, "model1", features)
	require.NoError(err)
	require.Nil(result)

	// Stats should show L1 miss
	stats, err := mtc.GetStats(ctx)
	require.NoError(err)
	overall := stats["overall"].(map[string]interface{})
	require.Equal(int64(0), overall["total_hits"])
	require.Equal(int64(1), overall["total_misses"])
}

func TestMultiTierCache_Delete(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    10,
			TTL:         1 * time.Hour,
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	require := assert.New(t)
	require.NoError(err)

	pred := &CachedPrediction{Prediction: 0.95}
	features := []float64{1.0, 2.0, 3.0}

	// Set
	mtc.Set(ctx, "model1", features, pred)

	// Verify exists
	result, _ := mtc.Get(ctx, "model1", features)
	require.NotNil(result)

	// Delete
	err = mtc.Delete(ctx, "model1", features)
	require.NoError(err)

	// Should not exist anymore
	result, _ = mtc.Get(ctx, "model1", features)
	require.Nil(result)
}

func TestMultiTierCache_InvalidateModel(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    10,
			TTL:         1 * time.Hour,
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	require := assert.New(t)
	require.NoError(err)

	pred := &CachedPrediction{Prediction: 0.95}

	// Set multiple predictions for model1
	mtc.Set(ctx, "model1", []float64{1.0}, pred)
	mtc.Set(ctx, "model1", []float64{2.0}, pred)
	mtc.Set(ctx, "model2", []float64{3.0}, pred)

	// Invalidate model1
	err = mtc.InvalidateModel(ctx, "model1")
	require.NoError(err)

	// All entries should be cleared (L1 doesn't support selective invalidation)
	result, _ := mtc.Get(ctx, "model1", []float64{1.0})
	require.Nil(result)
}

func TestMultiTierCache_Statistics(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    10,
			TTL:         1 * time.Hour,
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	require := assert.New(t)
	require.NoError(err)

	pred := &CachedPrediction{Prediction: 0.95}
	features := []float64{1.0, 2.0, 3.0}

	// 2 hits
	mtc.Set(ctx, "model1", features, pred)
	mtc.Get(ctx, "model1", features)
	mtc.Get(ctx, "model1", features)

	// 1 miss
	mtc.Get(ctx, "model2", []float64{4.0, 5.0})

	stats, err := mtc.GetStats(ctx)
	require.NoError(err)

	overall := stats["overall"].(map[string]interface{})
	require.Equal(int64(2), overall["total_hits"])
	require.Equal(int64(1), overall["total_misses"])
	require.InDelta(0.666, overall["overall_hit_ratio"], 0.01)
}

func TestMultiTierCache_ResetMetrics(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    10,
			TTL:         1 * time.Hour,
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	require := assert.New(t)
	require.NoError(err)

	pred := &CachedPrediction{Prediction: 0.95}
	features := []float64{1.0, 2.0, 3.0}

	mtc.Set(ctx, "model1", features, pred)
	mtc.Get(ctx, "model1", features)

	stats, _ := mtc.GetStats(ctx)
	overall := stats["overall"].(map[string]interface{})
	require.Equal(int64(1), overall["total_hits"])

	// Reset metrics
	mtc.ResetMetrics()

	stats, _ = mtc.GetStats(ctx)
	overall = stats["overall"].(map[string]interface{})
	require.Equal(int64(0), overall["total_hits"])
}

func TestMultiTierCache_ConcurrentAccess(t *testing.T) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, err := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    100,
			TTL:         1 * time.Hour,
			EnableStats: true,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)
	require := assert.New(t)
	require.NoError(err)

	done := make(chan bool)

	// Concurrent writes
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 50; j++ {
				features := []float64{float64(id), float64(j)}
				pred := &CachedPrediction{Prediction: float64(j)}
				mtc.Set(ctx, fmt.Sprintf("model_%d", id), features, pred)
			}
			done <- true
		}(i)
	}

	// Concurrent reads
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 50; j++ {
				features := []float64{float64(id), float64(j)}
				mtc.Get(ctx, fmt.Sprintf("model_%d", id), features)
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 20; i++ {
		<-done
	}

	// Should not panic
	stats, err := mtc.GetStats(ctx)
	require.NoError(err)
	require.NotNil(stats)
}

func BenchmarkMultiTierCache_SetL1(b *testing.B) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, _ := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    10000,
			TTL:         1 * time.Hour,
			EnableStats: false,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)

	pred := &CachedPrediction{Prediction: 0.95, Confidence: 0.87}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		features := []float64{float64(i % 10000)}
		mtc.Set(ctx, "model1", features, pred)
	}
}

func BenchmarkMultiTierCache_GetL1(b *testing.B) {
	logger := zerolog.Nop()
	ctx := context.Background()

	mtc, _ := NewMultiTierCache(MultiTierCacheConfig{
		LRUConfig: LRUConfig{
			Capacity:    10000,
			TTL:         1 * time.Hour,
			EnableStats: false,
		},
		EnableL1: true,
		EnableL2: false,
	}, logger)

	pred := &CachedPrediction{Prediction: 0.95, Confidence: 0.87}

	// Pre-populate
	for i := 0; i < 10000; i++ {
		features := []float64{float64(i)}
		mtc.Set(ctx, "model1", features, pred)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		features := []float64{float64(i % 10000)}
		mtc.Get(ctx, "model1", features)
	}
}
