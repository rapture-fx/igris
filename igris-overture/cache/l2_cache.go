package cache

import (
	"context"
	"errors"
	"sync"
	"time"
)

// L2Cache provides a process-local in-memory cache layer
// that sits between the application and L1 Redis cache.
// It's designed to reduce Redis roundtrips for hot data.
type L2Cache interface {
	// Get retrieves a value from L2 cache
	Get(ctx context.Context, key string) (interface{}, bool, error)

	// Set stores a value in L2 cache with TTL
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error

	// Delete removes a key from L2 cache
	Delete(ctx context.Context, key string) error

	// Clear removes all entries from L2 cache
	Clear(ctx context.Context) error

	// Stats returns cache statistics
	Stats() L2Stats

	// Close closes the cache and releases resources
	Close() error
}

// L2CacheConfig holds L2 cache configuration
type L2CacheConfig struct {
	// Maximum number of items to store
	MaxSize int

	// Default TTL for cached items
	DefaultTTL time.Duration

	// Eviction policy: "lru", "lfu", "ttl"
	EvictionPolicy string

	// Enable metrics collection
	EnableMetrics bool

	// Tenant ID (for multi-tenant isolation)
	TenantID string
}

// L2CacheEntry represents a cached entry with metadata
type L2CacheEntry struct {
	Key        string
	Value      interface{}
	ExpiresAt  time.Time
	AccessedAt time.Time
	CreatedAt  time.Time
	AccessCount int64
}

// IsExpired checks if the entry has expired
func (e *L2CacheEntry) IsExpired() bool {
	return !e.ExpiresAt.IsZero() && time.Now().After(e.ExpiresAt)
}

// L2Stats represents L2 cache statistics
type L2Stats struct {
	// Hit/Miss metrics
	Hits   int64
	Misses int64
	HitRate float64

	// Eviction metrics
	Evictions int64

	// Size metrics
	CurrentSize int
	MaxSize     int

	// Operation metrics
	Sets    int64
	Deletes int64

	// Timing metrics
	AvgGetLatency time.Duration
	AvgSetLatency time.Duration
}

// L2CacheWrapper wraps L1 cache with L2 in-memory layer
type L2CacheWrapper struct {
	l1      *PredictionCache // Existing L1 Redis cache
	l2      L2Cache          // L2 in-memory cache
	stats   *L2StatsCollector
	enabled bool
	mu      sync.RWMutex
}

// NewL2CacheWrapper creates a new L2 cache wrapper
func NewL2CacheWrapper(l1 *PredictionCache, l2Config *L2CacheConfig) (*L2CacheWrapper, error) {
	if l1 == nil {
		return nil, errors.New("L1 cache cannot be nil")
	}

	// Create L2 cache instance
	l2, err := NewMemoryL2Cache(l2Config)
	if err != nil {
		return nil, err
	}

	return &L2CacheWrapper{
		l1:      l1,
		l2:      l2,
		stats:   NewL2StatsCollector(),
		enabled: true,
	}, nil
}

// Get retrieves from L2, falling back to L1 on miss
func (w *L2CacheWrapper) Get(ctx context.Context, modelID string, features []float64) (*CachedPrediction, error) {
	key := generateCacheKey(modelID, features)

	// Try L2 first
	if w.isEnabled() {
		start := time.Now()
		if value, found, err := w.l2.Get(ctx, key); err == nil && found {
			w.stats.RecordHit()
			w.stats.RecordGetLatency(time.Since(start))

			if pred, ok := value.(*CachedPrediction); ok {
				return pred, nil
			}
		}
		w.stats.RecordMiss()
	}

	// L2 miss - try L1 (Redis)
	prediction, err := w.l1.Get(ctx, modelID, features)
	if err != nil {
		return nil, err
	}

	// Cache miss completely
	if prediction == nil {
		return nil, nil
	}

	// Populate L2 cache with L1 result
	if w.isEnabled() {
		ttl := 5 * time.Minute // L2 TTL shorter than L1
		w.l2.Set(ctx, key, prediction, ttl)
	}

	return prediction, nil
}

// Set stores in both L1 and L2 caches
func (w *L2CacheWrapper) Set(ctx context.Context, modelID string, features []float64, prediction *CachedPrediction) error {
	// Store in L1 first
	if err := w.l1.Set(ctx, modelID, features, prediction); err != nil {
		return err
	}

	// Store in L2
	if w.isEnabled() {
		key := generateCacheKey(modelID, features)
		ttl := 5 * time.Minute
		return w.l2.Set(ctx, key, prediction, ttl)
	}

	return nil
}

// Invalidate removes from both L1 and L2
func (w *L2CacheWrapper) Invalidate(ctx context.Context, modelID string, features []float64) error {
	key := generateCacheKey(modelID, features)

	// Invalidate L2
	if w.isEnabled() {
		w.l2.Delete(ctx, key)
	}

	// Invalidate L1
	return w.l1.Invalidate(ctx, modelID, features)
}

// InvalidateModel removes all predictions for a model from both caches
func (w *L2CacheWrapper) InvalidateModel(ctx context.Context, modelID string) error {
	// Clear L2 completely (simpler than selective invalidation)
	if w.isEnabled() {
		w.l2.Clear(ctx)
	}

	// Invalidate L1 model
	return w.l1.InvalidateModel(ctx, modelID)
}

// Stats returns combined L1 and L2 statistics
func (w *L2CacheWrapper) Stats(ctx context.Context) (map[string]string, error) {
	l1Stats, err := w.l1.Stats(ctx)
	if err != nil {
		return nil, err
	}

	if !w.isEnabled() {
		return l1Stats, nil
	}

	l2Stats := w.l2.Stats()

	// Combine stats
	combined := make(map[string]string)
	for k, v := range l1Stats {
		combined["l1_"+k] = v
	}

	combined["l2_hits"] = formatInt64(l2Stats.Hits)
	combined["l2_misses"] = formatInt64(l2Stats.Misses)
	combined["l2_hit_rate"] = formatFloat64(l2Stats.HitRate)
	combined["l2_evictions"] = formatInt64(l2Stats.Evictions)
	combined["l2_current_size"] = formatInt(l2Stats.CurrentSize)
	combined["l2_max_size"] = formatInt(l2Stats.MaxSize)

	return combined, nil
}

// Enable enables L2 cache
func (w *L2CacheWrapper) Enable() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.enabled = true
}

// Disable disables L2 cache (falls through to L1)
func (w *L2CacheWrapper) Disable() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.enabled = false
}

// isEnabled checks if L2 is enabled
func (w *L2CacheWrapper) isEnabled() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.enabled
}

// Close closes both L1 and L2 caches
func (w *L2CacheWrapper) Close() error {
	var err error

	if w.l2 != nil {
		if e := w.l2.Close(); e != nil {
			err = e
		}
	}

	if w.l1 != nil {
		if e := w.l1.Close(); e != nil && err == nil {
			err = e
		}
	}

	return err
}

// generateCacheKey creates a consistent cache key
func generateCacheKey(modelID string, features []float64) string {
	// Reuse existing hashFeatures function
	return modelID + ":" + hashFeatures(features)
}

// Helper formatting functions
func formatInt64(v int64) string {
	return string(rune(v))
}

func formatInt(v int) string {
	return string(rune(v))
}

func formatFloat64(v float64) string {
	return string(rune(int(v * 100)))
}
