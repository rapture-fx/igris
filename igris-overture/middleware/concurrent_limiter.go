// Package middleware provides concurrent request limiting per tenant
package middleware

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
)

// ============================================================================
// PROMETHEUS METRICS
// ============================================================================

var (
	// Concurrent request metrics
	concurrentRequestsGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_concurrent_requests",
			Help: "Current number of concurrent requests per tenant",
		},
		[]string{"tenant_id", "tier"},
	)

	concurrentLimitExceeded = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_concurrent_limit_exceeded_total",
			Help: "Total number of concurrent limit violations",
		},
		[]string{"tenant_id", "tier"},
	)

	concurrentRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_concurrent_request_duration_seconds",
			Help:    "Duration of concurrent requests",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"tenant_id", "tier"},
	)
)

// ============================================================================
// CONCURRENT LIMITER
// ============================================================================

// ConcurrentLimiter limits the number of concurrent requests per tenant
// Implements P0-4: Per-tier concurrent request limits
type ConcurrentLimiter struct {
	// In-memory tracking (fast path)
	activeRequests map[string]*int64 // tenant_id -> active count
	mu             sync.RWMutex

	// Redis for distributed tracking (optional)
	redis   *redis.Client
	useRedis bool

	// Configuration
	defaultLimit int
	enabled      bool
	logger       *log.Logger

	// Tier-specific limits
	tierLimits map[string]int
}

// ConcurrentLimiterConfig holds configuration for the concurrent limiter
type ConcurrentLimiterConfig struct {
	Enabled      bool
	DefaultLimit int
	Redis        *redis.Client
	UseRedis     bool // Use Redis for distributed counting
}

// NewConcurrentLimiter creates a new concurrent request limiter
func NewConcurrentLimiter(cfg ConcurrentLimiterConfig) *ConcurrentLimiter {
	cl := &ConcurrentLimiter{
		activeRequests: make(map[string]*int64),
		redis:          cfg.Redis,
		useRedis:       cfg.UseRedis && cfg.Redis != nil,
		defaultLimit:   cfg.DefaultLimit,
		enabled:        cfg.Enabled,
		logger:         log.Default(),
		tierLimits:     make(map[string]int),
	}

	// Set tier-specific limits from RateLimitTiers
	for tierName, tier := range RateLimitTiers {
		cl.tierLimits[tierName] = tier.ConcurrentRequests
	}

	cl.logger.Printf("[ConcurrentLimiter] Initialized (enabled: %v, distributed: %v, default_limit: %d)",
		cfg.Enabled, cl.useRedis, cfg.DefaultLimit)

	return cl
}

// Middleware returns a Fiber middleware for concurrent request limiting
func (cl *ConcurrentLimiter) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !cl.enabled {
			return c.Next()
		}

		// Get tenant ID and tier from context
		tenantID := GetTenantID(c)
		if tenantID == "" {
			tenantID = "anonymous"
		}

		tier := c.Locals("tier")
		tierName := "developer" // Default tier
		if tier != nil {
			tierName = tier.(string)
		}

		// Get limit for this tier
		limit := cl.getLimit(tierName)

		// Try to acquire a slot
		acquired, currentCount, err := cl.acquire(c.Context(), tenantID, limit)
		if err != nil {
			cl.logger.Printf("[ConcurrentLimiter] Error acquiring slot: %v", err)
			// Fail open on error
			return c.Next()
		}

		// Record current count
		concurrentRequestsGauge.WithLabelValues(tenantID, tierName).Set(float64(currentCount))

		if !acquired {
			// Limit exceeded
			concurrentLimitExceeded.WithLabelValues(tenantID, tierName).Inc()

			cl.logger.Printf("[ConcurrentLimiter] Limit exceeded: tenant=%s tier=%s current=%d limit=%d",
				tenantID, tierName, currentCount, limit)

			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":              "Too many concurrent requests",
				"code":               "CONCURRENT_LIMIT_EXCEEDED",
				"tier":               tierName,
				"current_concurrent": currentCount,
				"limit":              limit,
				"retry_after":        1,
				"message": fmt.Sprintf("Your %s tier allows up to %d concurrent requests. Please wait for pending requests to complete.",
					tierName, limit),
			})
		}

		// Track request start time
		startTime := time.Now()

		// Ensure we release the slot when the request completes
		defer func() {
			cl.release(c.Context(), tenantID)
			newCount := cl.getCurrentCount(tenantID)
			concurrentRequestsGauge.WithLabelValues(tenantID, tierName).Set(float64(newCount))

			// Record request duration
			duration := time.Since(startTime).Seconds()
			concurrentRequestDuration.WithLabelValues(tenantID, tierName).Observe(duration)
		}()

		// Set header with concurrent usage info
		c.Set("X-Concurrent-Requests", fmt.Sprintf("%d/%d", currentCount, limit))

		return c.Next()
	}
}

// getLimit returns the concurrent limit for a tier
func (cl *ConcurrentLimiter) getLimit(tierName string) int {
	if limit, exists := cl.tierLimits[tierName]; exists && limit > 0 {
		return limit
	}
	return cl.defaultLimit
}

// acquire attempts to acquire a concurrent request slot
// Returns: (acquired, currentCount, error)
func (cl *ConcurrentLimiter) acquire(ctx context.Context, tenantID string, limit int) (bool, int64, error) {
	if cl.useRedis {
		return cl.acquireRedis(ctx, tenantID, limit)
	}
	return cl.acquireLocal(tenantID, limit)
}

// acquireLocal uses in-memory tracking (single instance)
func (cl *ConcurrentLimiter) acquireLocal(tenantID string, limit int) (bool, int64, error) {
	cl.mu.Lock()
	defer cl.mu.Unlock()

	counter, exists := cl.activeRequests[tenantID]
	if !exists {
		var initial int64 = 0
		counter = &initial
		cl.activeRequests[tenantID] = counter
	}

	currentCount := atomic.LoadInt64(counter)

	// Check if we're at the limit
	if currentCount >= int64(limit) {
		return false, currentCount, nil
	}

	// Increment
	newCount := atomic.AddInt64(counter, 1)

	return true, newCount, nil
}

// acquireRedis uses Redis for distributed tracking
func (cl *ConcurrentLimiter) acquireRedis(ctx context.Context, tenantID string, limit int) (bool, int64, error) {
	key := fmt.Sprintf("concurrent:%s", tenantID)

	// Lua script for atomic check-and-increment
	script := redis.NewScript(`
		local key = KEYS[1]
		local limit = tonumber(ARGV[1])
		local ttl = tonumber(ARGV[2])

		local current = redis.call('GET', key)
		if current == false then
			current = 0
		else
			current = tonumber(current)
		end

		if current >= limit then
			return {0, current}
		end

		local new = redis.call('INCR', key)
		-- Set TTL as a safety measure (auto-cleanup if release fails)
		redis.call('EXPIRE', key, ttl)

		return {1, new}
	`)

	// TTL of 5 minutes as safety net (requests should complete faster)
	result, err := script.Run(ctx, cl.redis, []string{key}, limit, 300).Result()
	if err != nil {
		return false, 0, err
	}

	resultSlice, ok := result.([]interface{})
	if !ok || len(resultSlice) != 2 {
		return false, 0, fmt.Errorf("unexpected script response")
	}

	acquired := resultSlice[0].(int64) == 1
	currentCount := resultSlice[1].(int64)

	return acquired, currentCount, nil
}

// release releases a concurrent request slot
func (cl *ConcurrentLimiter) release(ctx context.Context, tenantID string) {
	if cl.useRedis {
		cl.releaseRedis(ctx, tenantID)
	} else {
		cl.releaseLocal(tenantID)
	}
}

// releaseLocal decrements the local counter
func (cl *ConcurrentLimiter) releaseLocal(tenantID string) {
	cl.mu.RLock()
	counter, exists := cl.activeRequests[tenantID]
	cl.mu.RUnlock()

	if !exists {
		return
	}

	newVal := atomic.AddInt64(counter, -1)
	if newVal < 0 {
		// Should never happen, but reset to 0 for safety
		atomic.StoreInt64(counter, 0)
	}
}

// releaseRedis decrements the Redis counter
func (cl *ConcurrentLimiter) releaseRedis(ctx context.Context, tenantID string) {
	key := fmt.Sprintf("concurrent:%s", tenantID)

	// Decrement but don't go below 0
	script := redis.NewScript(`
		local key = KEYS[1]
		local current = redis.call('GET', key)
		if current == false or tonumber(current) <= 0 then
			redis.call('SET', key, 0)
			return 0
		end
		return redis.call('DECR', key)
	`)

	if _, err := script.Run(ctx, cl.redis, []string{key}).Result(); err != nil {
		cl.logger.Printf("[ConcurrentLimiter] Error releasing Redis slot: %v", err)
	}
}

// getCurrentCount returns the current concurrent count for a tenant
func (cl *ConcurrentLimiter) getCurrentCount(tenantID string) int64 {
	if cl.useRedis {
		key := fmt.Sprintf("concurrent:%s", tenantID)
		val, err := cl.redis.Get(context.Background(), key).Int64()
		if err != nil {
			return 0
		}
		return val
	}

	cl.mu.RLock()
	defer cl.mu.RUnlock()

	if counter, exists := cl.activeRequests[tenantID]; exists {
		return atomic.LoadInt64(counter)
	}
	return 0
}

// GetStats returns current statistics
func (cl *ConcurrentLimiter) GetStats(ctx context.Context) (map[string]interface{}, error) {
	stats := map[string]interface{}{
		"enabled":       cl.enabled,
		"distributed":   cl.useRedis,
		"default_limit": cl.defaultLimit,
		"tier_limits":   cl.tierLimits,
	}

	if cl.useRedis {
		// Count active concurrent keys in Redis
		var keyCount int64
		iter := cl.redis.Scan(ctx, 0, "concurrent:*", 100).Iterator()
		for iter.Next(ctx) {
			keyCount++
		}
		stats["active_tenants"] = keyCount
	} else {
		cl.mu.RLock()
		stats["active_tenants"] = len(cl.activeRequests)
		cl.mu.RUnlock()
	}

	return stats, nil
}

// Reset resets the concurrent count for a tenant (admin operation)
func (cl *ConcurrentLimiter) Reset(ctx context.Context, tenantID string) error {
	if cl.useRedis {
		key := fmt.Sprintf("concurrent:%s", tenantID)
		return cl.redis.Del(ctx, key).Err()
	}

	cl.mu.Lock()
	defer cl.mu.Unlock()

	if counter, exists := cl.activeRequests[tenantID]; exists {
		atomic.StoreInt64(counter, 0)
	}

	return nil
}
