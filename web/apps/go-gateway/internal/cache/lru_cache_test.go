package cache

import (
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewLRUCache(t *testing.T) {
	logger := zerolog.Nop()

	t.Run("default configuration", func(t *testing.T) {
		cache := NewLRUCache(LRUConfig{}, logger)
		assert.NotNil(t, cache)
		assert.Equal(t, 1000, cache.Capacity())
		assert.Equal(t, 0, cache.Size())
	})

	t.Run("custom configuration", func(t *testing.T) {
		cache := NewLRUCache(LRUConfig{
			Capacity:    100,
			TTL:         10 * time.Minute,
			EnableStats: true,
		}, logger)
		assert.Equal(t, 100, cache.Capacity())
		assert.Equal(t, 0, cache.Size())
	})
}

func TestLRUCache_SetAndGet(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    3,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	pred1 := &CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    "model1",
	}

	t.Run("set and get", func(t *testing.T) {
		cache.Set("key1", pred1)
		assert.Equal(t, 1, cache.Size())

		val, ok := cache.Get("key1")
		assert.True(t, ok)
		assert.NotNil(t, val)
		assert.Equal(t, 0.95, val.Prediction)
		assert.Equal(t, "model1", val.ModelID)
	})

	t.Run("get non-existent key", func(t *testing.T) {
		val, ok := cache.Get("nonexistent")
		assert.False(t, ok)
		assert.Nil(t, val)
	})
}

func TestLRUCache_Update(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    3,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	pred1 := &CachedPrediction{Prediction: 0.95, ModelID: "model1"}
	pred2 := &CachedPrediction{Prediction: 0.88, ModelID: "model1"}

	cache.Set("key1", pred1)
	cache.Set("key1", pred2) // Update

	assert.Equal(t, 1, cache.Size())

	val, ok := cache.Get("key1")
	assert.True(t, ok)
	assert.Equal(t, 0.88, val.Prediction)
}

func TestLRUCache_Eviction(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    3,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})
	cache.Set("key2", &CachedPrediction{Prediction: 2.0})
	cache.Set("key3", &CachedPrediction{Prediction: 3.0})
	assert.Equal(t, 3, cache.Size())

	// Add 4th entry, should evict key1 (oldest)
	cache.Set("key4", &CachedPrediction{Prediction: 4.0})
	assert.Equal(t, 3, cache.Size())

	// key1 should be evicted
	_, ok := cache.Get("key1")
	assert.False(t, ok)

	// Others should still exist
	val2, ok := cache.Get("key2")
	assert.True(t, ok)
	assert.Equal(t, 2.0, val2.Prediction)

	val4, ok := cache.Get("key4")
	assert.True(t, ok)
	assert.Equal(t, 4.0, val4.Prediction)

	stats := cache.GetStats()
	assert.Equal(t, int64(1), stats["evictions"])
}

func TestLRUCache_LRUOrdering(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    3,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})
	cache.Set("key2", &CachedPrediction{Prediction: 2.0})
	cache.Set("key3", &CachedPrediction{Prediction: 3.0})

	// Access key1 to make it most recently used
	cache.Get("key1")

	// Add key4, should evict key2 (least recently used)
	cache.Set("key4", &CachedPrediction{Prediction: 4.0})

	_, ok := cache.Get("key2")
	assert.False(t, ok, "key2 should be evicted")

	val1, ok := cache.Get("key1")
	assert.True(t, ok, "key1 should still exist (was accessed recently)")
	assert.Equal(t, 1.0, val1.Prediction)
}

func TestLRUCache_TTL(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10,
		TTL:         100 * time.Millisecond,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})

	// Immediate get should work
	val, ok := cache.Get("key1")
	assert.True(t, ok)
	assert.Equal(t, 1.0, val.Prediction)

	// Wait for expiration
	time.Sleep(150 * time.Millisecond)

	// Should be expired now
	val, ok = cache.Get("key1")
	assert.False(t, ok)
	assert.Nil(t, val)

	stats := cache.GetStats()
	assert.Equal(t, int64(1), stats["expirations"])
}

func TestLRUCache_Delete(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})
	assert.Equal(t, 1, cache.Size())

	deleted := cache.Delete("key1")
	assert.True(t, deleted)
	assert.Equal(t, 0, cache.Size())

	_, ok := cache.Get("key1")
	assert.False(t, ok)

	// Delete non-existent key
	deleted = cache.Delete("key1")
	assert.False(t, deleted)
}

func TestLRUCache_Clear(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})
	cache.Set("key2", &CachedPrediction{Prediction: 2.0})
	cache.Set("key3", &CachedPrediction{Prediction: 3.0})
	assert.Equal(t, 3, cache.Size())

	cache.Clear()
	assert.Equal(t, 0, cache.Size())

	_, ok := cache.Get("key1")
	assert.False(t, ok)
}

func TestLRUCache_CleanupExpired(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10,
		TTL:         50 * time.Millisecond,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})
	cache.Set("key2", &CachedPrediction{Prediction: 2.0})
	cache.Set("key3", &CachedPrediction{Prediction: 3.0})

	time.Sleep(100 * time.Millisecond)

	removed := cache.CleanupExpired()
	assert.Equal(t, 3, removed)
	assert.Equal(t, 0, cache.Size())
}

func TestLRUCache_Statistics(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})
	cache.Set("key2", &CachedPrediction{Prediction: 2.0})

	// 2 hits
	cache.Get("key1")
	cache.Get("key2")

	// 1 miss
	cache.Get("key3")

	stats := cache.GetStats()
	assert.Equal(t, int64(2), stats["hits"])
	assert.Equal(t, int64(1), stats["misses"])
	assert.InDelta(t, 0.666, stats["hit_ratio"], 0.01)
	assert.Equal(t, 2, stats["size"])
	assert.Equal(t, 10, stats["capacity"])
}

func TestLRUCache_ResetStats(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})
	cache.Get("key1")
	cache.Get("key2") // miss

	stats := cache.GetStats()
	assert.Equal(t, int64(1), stats["hits"])
	assert.Equal(t, int64(1), stats["misses"])

	cache.ResetStats()

	stats = cache.GetStats()
	assert.Equal(t, int64(0), stats["hits"])
	assert.Equal(t, int64(0), stats["misses"])
}

func TestLRUCache_Keys(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	cache.Set("key1", &CachedPrediction{Prediction: 1.0})
	cache.Set("key2", &CachedPrediction{Prediction: 2.0})
	cache.Set("key3", &CachedPrediction{Prediction: 3.0})

	keys := cache.Keys()
	assert.Len(t, keys, 3)
	assert.Contains(t, keys, "key1")
	assert.Contains(t, keys, "key2")
	assert.Contains(t, keys, "key3")
}

func TestLRUCache_ConcurrentAccess(t *testing.T) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    100,
		TTL:         1 * time.Hour,
		EnableStats: true,
	}, logger)

	done := make(chan bool)

	// Concurrent writes
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 100; j++ {
				key := fmt.Sprintf("key_%d_%d", id, j)
				cache.Set(key, &CachedPrediction{Prediction: float64(j)})
			}
			done <- true
		}(i)
	}

	// Concurrent reads
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 100; j++ {
				key := fmt.Sprintf("key_%d_%d", id, j)
				cache.Get(key)
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 20; i++ {
		<-done
	}

	// Cache should not panic and should have some entries
	assert.LessOrEqual(t, cache.Size(), cache.Capacity())
}

func BenchmarkLRUCache_Set(b *testing.B) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10000,
		TTL:         1 * time.Hour,
		EnableStats: false,
	}, logger)

	pred := &CachedPrediction{Prediction: 0.95, Confidence: 0.87}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("key_%d", i%10000)
		cache.Set(key, pred)
	}
}

func BenchmarkLRUCache_Get(b *testing.B) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10000,
		TTL:         1 * time.Hour,
		EnableStats: false,
	}, logger)

	pred := &CachedPrediction{Prediction: 0.95, Confidence: 0.87}

	// Pre-populate cache
	for i := 0; i < 10000; i++ {
		key := fmt.Sprintf("key_%d", i)
		cache.Set(key, pred)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("key_%d", i%10000)
		cache.Get(key)
	}
}

func BenchmarkLRUCache_SetParallel(b *testing.B) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10000,
		TTL:         1 * time.Hour,
		EnableStats: false,
	}, logger)

	pred := &CachedPrediction{Prediction: 0.95, Confidence: 0.87}

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			key := fmt.Sprintf("key_%d", i%10000)
			cache.Set(key, pred)
			i++
		}
	})
}

func BenchmarkLRUCache_GetParallel(b *testing.B) {
	logger := zerolog.Nop()
	cache := NewLRUCache(LRUConfig{
		Capacity:    10000,
		TTL:         1 * time.Hour,
		EnableStats: false,
	}, logger)

	pred := &CachedPrediction{Prediction: 0.95, Confidence: 0.87}

	// Pre-populate cache
	for i := 0; i < 10000; i++ {
		key := fmt.Sprintf("key_%d", i)
		cache.Set(key, pred)
	}

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			key := fmt.Sprintf("key_%d", i%10000)
			cache.Get(key)
			i++
		}
	})
}
