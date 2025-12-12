package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// QueryCache provides intelligent caching for database queries
// Enhancement: Reduces database load by caching frequently-accessed query results
type QueryCache struct {
	db            *sql.DB
	cache         *redis.Client
	enabled       bool
	defaultTTL    time.Duration
	maxCacheSize  int64
	logger        *log.Logger

	// Cache policy configuration
	cacheablePatterns []string
	excludePatterns   []string
}

// QueryCacheConfig holds configuration for query caching
type QueryCacheConfig struct {
	Enabled          bool
	RedisURL         string
	DefaultTTL       time.Duration
	MaxCacheSize     int64
	CacheableQueries []string // Patterns for queries that should be cached
	ExcludeQueries   []string // Patterns for queries that should NOT be cached
}

// NewQueryCache creates a new query caching layer
func NewQueryCache(db *sql.DB, config *QueryCacheConfig) (*QueryCache, error) {
	if !config.Enabled || config.RedisURL == "" {
		return &QueryCache{
			db:      db,
			enabled: false,
			logger:  log.Default(),
		}, nil
	}

	// Parse Redis URL
	opt, err := redis.ParseURL(config.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Redis URL: %w", err)
	}

	// Configure for high-performance caching
	opt.MinIdleConns = 10
	opt.PoolSize = 50
	opt.ConnMaxLifetime = 30 * time.Minute
	opt.ConnMaxIdleTime = 10 * time.Minute
	opt.DialTimeout = 2 * time.Second
	opt.ReadTimeout = 1 * time.Second
	opt.WriteTimeout = 1 * time.Second

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to query cache Redis: %w", err)
	}

	qc := &QueryCache{
		db:                db,
		cache:             client,
		enabled:           true,
		defaultTTL:        config.DefaultTTL,
		maxCacheSize:      config.MaxCacheSize,
		logger:            log.Default(),
		cacheablePatterns: config.CacheableQueries,
		excludePatterns:   config.ExcludeQueries,
	}

	log.Printf("[QueryCache] Enabled with TTL=%s, max_size=%d", config.DefaultTTL, config.MaxCacheSize)
	return qc, nil
}

// CachedQueryRow executes a query and caches the single-row result
// Use for queries like SELECT ... WHERE id = $1 that return consistent results
func (qc *QueryCache) CachedQueryRow(ctx context.Context, query string, ttl time.Duration, args ...interface{}) *CachedRow {
	if !qc.enabled {
		// Fall back to direct database query
		return &CachedRow{
			row:   qc.db.QueryRowContext(ctx, query, args...),
			cache: nil,
		}
	}

	// Generate cache key from query + args
	cacheKey := qc.generateCacheKey(query, args...)

	// Try cache first
	cached, err := qc.cache.Get(ctx, cacheKey).Result()
	if err == nil {
		// Cache hit!
		qc.logger.Printf("[QueryCache] Cache HIT: %s", cacheKey[:16])
		return &CachedRow{
			cachedData: cached,
			cache:      qc,
			cacheKey:   cacheKey,
		}
	}

	// Cache miss - query database
	qc.logger.Printf("[QueryCache] Cache MISS: %s", cacheKey[:16])
	row := qc.db.QueryRowContext(ctx, query, args...)

	if ttl == 0 {
		ttl = qc.defaultTTL
	}

	return &CachedRow{
		row:      row,
		cache:    qc,
		cacheKey: cacheKey,
		ttl:      ttl,
	}
}

// CachedQuery executes a query and caches multiple-row results
func (qc *QueryCache) CachedQuery(ctx context.Context, query string, ttl time.Duration, args ...interface{}) (*CachedRows, error) {
	if !qc.enabled {
		rows, err := qc.db.QueryContext(ctx, query, args...)
		return &CachedRows{rows: rows}, err
	}

	cacheKey := qc.generateCacheKey(query, args...)

	// Try cache first
	cached, err := qc.cache.Get(ctx, cacheKey).Result()
	if err == nil {
		// Cache hit!
		qc.logger.Printf("[QueryCache] Cache HIT (multi-row): %s", cacheKey[:16])

		var results []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &results); err != nil {
			qc.logger.Printf("[QueryCache] Failed to unmarshal cached results: %v", err)
			// Fall through to database query
		} else {
			return &CachedRows{
				cachedResults: results,
				currentIndex:  0,
			}, nil
		}
	}

	// Cache miss - query database
	qc.logger.Printf("[QueryCache] Cache MISS (multi-row): %s", cacheKey[:16])
	rows, err := qc.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	if ttl == 0 {
		ttl = qc.defaultTTL
	}

	return &CachedRows{
		rows:     rows,
		cache:    qc,
		cacheKey: cacheKey,
		ttl:      ttl,
	}, nil
}

// Invalidate removes a specific query from cache
func (qc *QueryCache) Invalidate(ctx context.Context, query string, args ...interface{}) error {
	if !qc.enabled {
		return nil
	}

	cacheKey := qc.generateCacheKey(query, args...)
	return qc.cache.Del(ctx, cacheKey).Err()
}

// InvalidatePattern removes all cached queries matching a pattern
// Example: InvalidatePattern("tenant:12345:*") removes all queries for tenant 12345
func (qc *QueryCache) InvalidatePattern(ctx context.Context, pattern string) (int64, error) {
	if !qc.enabled {
		return 0, nil
	}

	var deleted int64
	iter := qc.cache.Scan(ctx, 0, "qcache:"+pattern, 100).Iterator()

	for iter.Next(ctx) {
		if err := qc.cache.Del(ctx, iter.Val()).Err(); err != nil {
			qc.logger.Printf("[QueryCache] Failed to delete key %s: %v", iter.Val(), err)
		} else {
			deleted++
		}
	}

	if err := iter.Err(); err != nil {
		return deleted, err
	}

	qc.logger.Printf("[QueryCache] Invalidated %d keys matching pattern: %s", deleted, pattern)
	return deleted, nil
}

// generateCacheKey creates a deterministic cache key from query and args
func (qc *QueryCache) generateCacheKey(query string, args ...interface{}) string {
	// Serialize query + args for hashing
	data := struct {
		Query string        `json:"q"`
		Args  []interface{} `json:"a"`
	}{
		Query: query,
		Args:  args,
	}

	jsonData, _ := json.Marshal(data)
	hash := sha256.Sum256(jsonData)
	return "qcache:" + hex.EncodeToString(hash[:])
}

// CachedRow wraps sql.Row with caching support
type CachedRow struct {
	row        *sql.Row
	cachedData string
	cache      *QueryCache
	cacheKey   string
	ttl        time.Duration
}

// Scan scans the result and optionally caches it
func (cr *CachedRow) Scan(dest ...interface{}) error {
	// If we have cached data, unmarshal it
	if cr.cachedData != "" {
		var values []interface{}
		if err := json.Unmarshal([]byte(cr.cachedData), &values); err != nil {
			return err
		}
		// Copy values to dest
		for i, v := range values {
			if i < len(dest) {
				// Simple type conversion - would need more robust handling in production
				switch d := dest[i].(type) {
				case *string:
					if s, ok := v.(string); ok {
						*d = s
					}
				case *int:
					if f, ok := v.(float64); ok {
						*d = int(f)
					}
				case *int64:
					if f, ok := v.(float64); ok {
						*d = int64(f)
					}
				}
			}
		}
		return nil
	}

	// Scan from database
	if err := cr.row.Scan(dest...); err != nil {
		return err
	}

	// Cache the result if cache is enabled
	if cr.cache != nil && cr.cache.enabled && cr.cacheKey != "" {
		go cr.cacheResult(dest...)
	}

	return nil
}

func (cr *CachedRow) cacheResult(dest ...interface{}) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Serialize result
	cached, err := json.Marshal(dest)
	if err != nil {
		cr.cache.logger.Printf("[QueryCache] Failed to marshal result: %v", err)
		return
	}

	// Store in cache
	if err := cr.cache.cache.Set(ctx, cr.cacheKey, cached, cr.ttl).Err(); err != nil {
		cr.cache.logger.Printf("[QueryCache] Failed to cache result: %v", err)
	}
}

// CachedRows wraps sql.Rows with caching support
type CachedRows struct {
	rows          *sql.Rows
	cachedResults []map[string]interface{}
	currentIndex  int
	cache         *QueryCache
	cacheKey      string
	ttl           time.Duration
}

// Next advances to the next row
func (cr *CachedRows) Next() bool {
	if cr.cachedResults != nil {
		cr.currentIndex++
		return cr.currentIndex <= len(cr.cachedResults)
	}
	return cr.rows.Next()
}

// Scan scans the current row
func (cr *CachedRows) Scan(dest ...interface{}) error {
	if cr.cachedResults != nil {
		if cr.currentIndex > 0 && cr.currentIndex <= len(cr.cachedResults) {
			return cr.scanFromCache(cr.cachedResults[cr.currentIndex-1], dest...)
		}
		return sql.ErrNoRows
	}
	return cr.rows.Scan(dest...)
}

// Close closes the rows
func (cr *CachedRows) Close() error {
	if cr.rows != nil {
		return cr.rows.Close()
	}
	return nil
}

func (cr *CachedRows) scanFromCache(data map[string]interface{}, dest ...interface{}) error {
	// Simple mapping - in production would need column name mapping
	for i, d := range dest {
		if i < len(data) {
			// Type assertion based on destination type
			// This is simplified - production would need robust type handling
			switch v := d.(type) {
			case *string:
				if str, ok := data[fmt.Sprintf("col%d", i)].(string); ok {
					*v = str
				}
			case *int:
				if num, ok := data[fmt.Sprintf("col%d", i)].(float64); ok {
					*v = int(num)
				}
			case *int64:
				if num, ok := data[fmt.Sprintf("col%d", i)].(float64); ok {
					*v = int64(num)
				}
			}
		}
	}
	return nil
}

// GetCacheStats returns current cache statistics
func (qc *QueryCache) GetCacheStats(ctx context.Context) (map[string]interface{}, error) {
	if !qc.enabled {
		return map[string]interface{}{
			"enabled": false,
		}, nil
	}

	info, err := qc.cache.Info(ctx, "stats").Result()
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"enabled":     true,
		"redis_stats": info,
	}, nil
}

// Close closes the cache connection
func (qc *QueryCache) Close() error {
	if qc.cache != nil {
		return qc.cache.Close()
	}
	return nil
}
