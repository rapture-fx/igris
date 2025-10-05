package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
)

// MultiTierCacheConfig holds configuration for multi-tier cache
type MultiTierCacheConfig struct {
	LRUConfig   LRUConfig
	RedisConfig Config
	EnableL1    bool // Enable in-memory LRU cache
	EnableL2    bool // Enable Redis cache
}

// MultiTierCache implements a two-tier caching strategy:
// L1: In-memory LRU cache (fast, limited capacity)
// L2: Redis cache (slower, larger capacity)
// Fallback order: L1 -> L2 -> compute
type MultiTierCache struct {
	lruCache   *LRUCache
	redisCache *PredictionCache
	logger     zerolog.Logger
	enableL1   bool
	enableL2   bool

	// Metrics
	l1Hits   int64
	l1Misses int64
	l2Hits   int64
	l2Misses int64
}

// NewMultiTierCache creates a new multi-tier cache
func NewMultiTierCache(config MultiTierCacheConfig, logger zerolog.Logger) (*MultiTierCache, error) {
	mtc := &MultiTierCache{
		logger:   logger.With().Str("component", "multi-tier-cache").Logger(),
		enableL1: config.EnableL1,
		enableL2: config.EnableL2,
	}

	// Initialize L1 (LRU) cache
	if config.EnableL1 {
		mtc.lruCache = NewLRUCache(config.LRUConfig, logger)
		mtc.logger.Info().Msg("L1 (LRU) cache enabled")
	}

	// Initialize L2 (Redis) cache
	if config.EnableL2 {
		redisCache, err := NewPredictionCache(config.RedisConfig, logger)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize L2 (Redis) cache: %w", err)
		}
		mtc.redisCache = redisCache
		mtc.logger.Info().Msg("L2 (Redis) cache enabled")
	}

	if !config.EnableL1 && !config.EnableL2 {
		mtc.logger.Warn().Msg("Multi-tier cache created with no cache layers enabled")
	}

	return mtc, nil
}

// generateKey creates a deterministic cache key from model ID and features
func (mtc *MultiTierCache) generateKey(modelID string, features []float64) string {
	data, _ := json.Marshal(map[string]interface{}{
		"model_id": modelID,
		"features": features,
	})

	hash := sha256.Sum256(data)
	hashStr := hex.EncodeToString(hash[:])

	return fmt.Sprintf("ml:{%s}:{%s}", modelID, hashStr[:16])
}

// Get retrieves a cached prediction from the multi-tier cache
// Lookup order: L1 (LRU) -> L2 (Redis) -> nil
// If found in L2, also populate L1 for faster future access
func (mtc *MultiTierCache) Get(ctx context.Context, modelID string, features []float64) (*CachedPrediction, error) {
	key := mtc.generateKey(modelID, features)

	// Try L1 cache first (in-memory, fastest)
	if mtc.enableL1 && mtc.lruCache != nil {
		if pred, ok := mtc.lruCache.Get(key); ok {
			atomic.AddInt64(&mtc.l1Hits, 1)
			mtc.logger.Debug().
				Str("key", key).
				Str("model_id", modelID).
				Msg("L1 cache hit")
			return pred, nil
		}
		atomic.AddInt64(&mtc.l1Misses, 1)
	}

	// Try L2 cache (Redis, slower but larger)
	if mtc.enableL2 && mtc.redisCache != nil {
		pred, err := mtc.redisCache.Get(ctx, modelID, features)
		if err != nil {
			mtc.logger.Warn().
				Err(err).
				Str("key", key).
				Msg("L2 cache lookup error")
			atomic.AddInt64(&mtc.l2Misses, 1)
			return nil, err
		}

		if pred != nil {
			atomic.AddInt64(&mtc.l2Hits, 1)

			// Populate L1 cache for faster future access
			if mtc.enableL1 && mtc.lruCache != nil {
				mtc.lruCache.Set(key, pred)
				mtc.logger.Debug().
					Str("key", key).
					Msg("Promoted L2 hit to L1 cache")
			}

			mtc.logger.Debug().
				Str("key", key).
				Str("model_id", modelID).
				Msg("L2 cache hit")
			return pred, nil
		}
		atomic.AddInt64(&mtc.l2Misses, 1)
	}

	// Cache miss on all tiers
	mtc.logger.Debug().
		Str("key", key).
		Str("model_id", modelID).
		Msg("Multi-tier cache miss")

	return nil, nil
}

// Set stores a prediction in both cache tiers
func (mtc *MultiTierCache) Set(ctx context.Context, modelID string, features []float64, prediction *CachedPrediction) error {
	key := mtc.generateKey(modelID, features)

	var errs []error

	// Write to L1 cache (in-memory)
	if mtc.enableL1 && mtc.lruCache != nil {
		mtc.lruCache.Set(key, prediction)
		mtc.logger.Debug().
			Str("key", key).
			Msg("Cached in L1")
	}

	// Write to L2 cache (Redis)
	if mtc.enableL2 && mtc.redisCache != nil {
		if err := mtc.redisCache.Set(ctx, modelID, features, prediction); err != nil {
			errs = append(errs, fmt.Errorf("L2 cache set error: %w", err))
			mtc.logger.Warn().
				Err(err).
				Str("key", key).
				Msg("Failed to cache in L2")
		} else {
			mtc.logger.Debug().
				Str("key", key).
				Msg("Cached in L2")
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("cache set errors: %v", errs)
	}

	return nil
}

// Delete removes a prediction from all cache tiers
func (mtc *MultiTierCache) Delete(ctx context.Context, modelID string, features []float64) error {
	key := mtc.generateKey(modelID, features)

	var errs []error

	// Delete from L1
	if mtc.enableL1 && mtc.lruCache != nil {
		mtc.lruCache.Delete(key)
	}

	// Delete from L2
	if mtc.enableL2 && mtc.redisCache != nil {
		if err := mtc.redisCache.Delete(ctx, modelID, features); err != nil {
			errs = append(errs, fmt.Errorf("L2 cache delete error: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("cache delete errors: %v", errs)
	}

	return nil
}

// InvalidateModel clears all cached predictions for a specific model from all tiers
func (mtc *MultiTierCache) InvalidateModel(ctx context.Context, modelID string) error {
	var errs []error

	// Invalidate L1 - need to iterate through keys since LRU doesn't support pattern matching
	if mtc.enableL1 && mtc.lruCache != nil {
		// For simplicity, clear entire L1 cache on model invalidation
		// In production, could implement prefix-based invalidation
		mtc.lruCache.Clear()
		mtc.logger.Info().
			Str("model_id", modelID).
			Msg("Cleared L1 cache for model invalidation")
	}

	// Invalidate L2 (Redis supports pattern matching)
	if mtc.enableL2 && mtc.redisCache != nil {
		if err := mtc.redisCache.InvalidateModel(ctx, modelID); err != nil {
			errs = append(errs, fmt.Errorf("L2 cache invalidation error: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("cache invalidation errors: %v", errs)
	}

	return nil
}

// GetStats returns comprehensive statistics from all cache tiers
func (mtc *MultiTierCache) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Overall metrics
	l1Total := mtc.l1Hits + mtc.l1Misses
	l2Total := mtc.l2Hits + mtc.l2Misses
	totalRequests := l1Total

	l1HitRatio := 0.0
	l2HitRatio := 0.0
	overallHitRatio := 0.0

	if l1Total > 0 {
		l1HitRatio = float64(mtc.l1Hits) / float64(l1Total)
	}
	if l2Total > 0 {
		l2HitRatio = float64(mtc.l2Hits) / float64(l2Total)
	}
	if totalRequests > 0 {
		overallHitRatio = float64(mtc.l1Hits+mtc.l2Hits) / float64(totalRequests)
	}

	stats["enabled_tiers"] = map[string]bool{
		"l1_lru":   mtc.enableL1,
		"l2_redis": mtc.enableL2,
	}

	stats["overall"] = map[string]interface{}{
		"total_requests":     totalRequests,
		"total_hits":         mtc.l1Hits + mtc.l2Hits,
		"total_misses":       mtc.l2Misses,
		"overall_hit_ratio":  overallHitRatio,
		"cache_miss_rate":    1.0 - overallHitRatio,
	}

	// L1 stats
	if mtc.enableL1 && mtc.lruCache != nil {
		l1Stats := mtc.lruCache.GetStats()
		l1Stats["tier_hits"] = mtc.l1Hits
		l1Stats["tier_misses"] = mtc.l1Misses
		l1Stats["tier_hit_ratio"] = l1HitRatio
		stats["l1_lru"] = l1Stats
	}

	// L2 stats
	if mtc.enableL2 && mtc.redisCache != nil {
		l2Stats, err := mtc.redisCache.GetStats(ctx)
		if err != nil {
			mtc.logger.Warn().Err(err).Msg("Failed to get L2 stats")
		} else {
			l2Stats["tier_hits"] = mtc.l2Hits
			l2Stats["tier_misses"] = mtc.l2Misses
			l2Stats["tier_hit_ratio"] = l2HitRatio
			stats["l2_redis"] = l2Stats
		}
	}

	return stats, nil
}

// Ping checks connectivity to all cache tiers
func (mtc *MultiTierCache) Ping(ctx context.Context) error {
	var errs []error

	// L1 is always available (in-memory), no ping needed

	// Ping L2
	if mtc.enableL2 && mtc.redisCache != nil {
		if err := mtc.redisCache.Ping(ctx); err != nil {
			errs = append(errs, fmt.Errorf("L2 (Redis) ping failed: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("cache ping errors: %v", errs)
	}

	return nil
}

// Close closes connections to all cache tiers
func (mtc *MultiTierCache) Close() error {
	var errs []error

	// Close L2 (Redis)
	if mtc.enableL2 && mtc.redisCache != nil {
		if err := mtc.redisCache.Close(); err != nil {
			errs = append(errs, fmt.Errorf("L2 cache close error: %w", err))
		}
	}

	// L1 (LRU) is in-memory, no close needed
	if mtc.enableL1 && mtc.lruCache != nil {
		mtc.lruCache.Clear()
	}

	if len(errs) > 0 {
		return fmt.Errorf("cache close errors: %v", errs)
	}

	mtc.logger.Info().Msg("Multi-tier cache closed")
	return nil
}

// StartCleanupWorker starts a background worker to cleanup expired L1 entries
func (mtc *MultiTierCache) StartCleanupWorker(ctx context.Context, interval time.Duration) {
	if !mtc.enableL1 || mtc.lruCache == nil {
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	mtc.logger.Info().
		Dur("interval", interval).
		Msg("Started L1 cache cleanup worker")

	for {
		select {
		case <-ctx.Done():
			mtc.logger.Info().Msg("Stopping L1 cache cleanup worker")
			return
		case <-ticker.C:
			removed := mtc.lruCache.CleanupExpired()
			if removed > 0 {
				mtc.logger.Debug().
					Int("removed", removed).
					Msg("L1 cache cleanup completed")
			}
		}
	}
}

// ResetMetrics resets all cache metrics
func (mtc *MultiTierCache) ResetMetrics() {
	atomic.StoreInt64(&mtc.l1Hits, 0)
	atomic.StoreInt64(&mtc.l1Misses, 0)
	atomic.StoreInt64(&mtc.l2Hits, 0)
	atomic.StoreInt64(&mtc.l2Misses, 0)

	if mtc.enableL1 && mtc.lruCache != nil {
		mtc.lruCache.ResetStats()
	}

	mtc.logger.Info().Msg("Multi-tier cache metrics reset")
}
