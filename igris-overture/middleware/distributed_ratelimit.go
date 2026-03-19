package middleware

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// DistributedRateLimiter provides distributed rate limiting using Redis/Dragonfly
// Enhancement: Enables accurate rate limiting across multiple server instances
type DistributedRateLimiter struct {
	cache   *redis.Client
	enabled bool
	logger  *log.Logger

	// Default limits (can be overridden per-tenant)
	defaultRequestsPerMinute int
	defaultBurstSize         int
}

// RateLimitConfig holds rate limit configuration
type RateLimitConfig struct {
	Enabled              bool
	RedisURL             string
	DefaultRequestsPerMin int
	DefaultBurstSize     int
}

// RateLimitTier defines different rate limit tiers
type RateLimitTier struct {
	Name               string
	RequestsPerSecond  int // P0-3: Per-second rate limiting
	RequestsPerMinute  int
	RequestsPerHour    int
	RequestsPerDay     int
	BurstSize          int
	ConcurrentRequests int // P0-4: Concurrent request limit
}

var (
	// Predefined rate limit tiers - aligned with tier_config.yaml
	// See roadmap: Trial/Developer (10 RPS / 300 RPM), Growth (50 RPS / 1500 RPM), Scale (1000 RPS / 60000 RPM)
	RateLimitTiers = map[string]*RateLimitTier{
		// Developer tier (also used for trial)
		"developer": {
			Name:               "developer",
			RequestsPerSecond:  10,      // 10 RPS
			RequestsPerMinute:  300,     // 300 RPM
			RequestsPerHour:    10000,
			RequestsPerDay:     50000,
			BurstSize:          10,
			ConcurrentRequests: 5,       // Max 5 concurrent requests
		},
		// Growth tier
		"growth": {
			Name:               "growth",
			RequestsPerSecond:  50,      // 50 RPS
			RequestsPerMinute:  1500,    // 1500 RPM
			RequestsPerHour:    50000,
			RequestsPerDay:     500000,
			BurstSize:          50,
			ConcurrentRequests: 50,      // Max 50 concurrent requests
		},
		// Scale tier
		"scale": {
			Name:               "scale",
			RequestsPerSecond:  1000,    // 1000 RPS
			RequestsPerMinute:  60000,   // 60000 RPM
			RequestsPerHour:    0,       // Unlimited
			RequestsPerDay:     0,       // Unlimited
			BurstSize:          1000,
			ConcurrentRequests: 1000,    // Max 1000 concurrent requests
		},
		"trial": {
			Name:               "trial",
			RequestsPerSecond:  10,      // Same as developer during trial
			RequestsPerMinute:  300,
			RequestsPerHour:    10000,
			RequestsPerDay:     50000,
			BurstSize:          10,
			ConcurrentRequests: 5,
		},
	}
)

// NewDistributedRateLimiter creates a new distributed rate limiter
func NewDistributedRateLimiter(config *RateLimitConfig) (*DistributedRateLimiter, error) {
	if !config.Enabled || config.RedisURL == "" {
		return &DistributedRateLimiter{
			enabled: false,
			logger:  log.Default(),
		}, nil
	}

	// Parse Redis URL
	opt, err := redis.ParseURL(config.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Redis URL: %w", err)
	}

	// Optimize for high-throughput rate limiting
	opt.MinIdleConns = 50
	opt.PoolSize = 200
	opt.ConnMaxLifetime = 30 * time.Minute
	opt.ConnMaxIdleTime = 10 * time.Minute
	opt.DialTimeout = 2 * time.Second
	opt.ReadTimeout = 500 * time.Millisecond
	opt.WriteTimeout = 500 * time.Millisecond

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to rate limit Redis: %w", err)
	}

	rl := &DistributedRateLimiter{
		cache:                    client,
		enabled:                  true,
		logger:                   log.Default(),
		defaultRequestsPerMinute: config.DefaultRequestsPerMin,
		defaultBurstSize:         config.DefaultBurstSize,
	}

	log.Printf("[RateLimiter] Enabled with default: %d req/min, burst: %d",
		config.DefaultRequestsPerMin, config.DefaultBurstSize)
	return rl, nil
}

// RateLimitMiddleware returns a Fiber middleware for rate limiting
func (rl *DistributedRateLimiter) RateLimitMiddleware(tierName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !rl.enabled {
			return c.Next()
		}

		// Get tenant ID from context
		tenantID := GetTenantID(c)
		if tenantID == "" {
			tenantID = "anonymous"
		}

		// Get tier configuration
		tier, exists := RateLimitTiers[tierName]
		if !exists {
			tier = &RateLimitTier{
				Name:               "default",
				RequestsPerSecond:  10,
				RequestsPerMinute:  rl.defaultRequestsPerMinute,
				BurstSize:          rl.defaultBurstSize,
				ConcurrentRequests: 5,
			}
		}

		// Check rate limits (multiple windows)
		ctx := c.Context()

		// 0. Per-second limit (most restrictive - P0-3 FIX)
		if tier.RequestsPerSecond > 0 {
			allowed, remaining, resetTime, err := rl.checkLimit(ctx, tenantID, "second", tier.RequestsPerSecond)
			if err != nil {
				rl.logger.Printf("[RateLimiter] Error checking per-second limit: %v", err)
				// Fail open on error
			} else if !allowed {
				retryAfter := 1 // Wait 1 second for per-second limit
				c.Set("Retry-After", strconv.Itoa(retryAfter))
				c.Set("X-RateLimit-Limit-Second", strconv.Itoa(tier.RequestsPerSecond))
				c.Set("X-RateLimit-Remaining-Second", strconv.Itoa(remaining))
				c.Set("X-RateLimit-Reset-Second", strconv.FormatInt(resetTime.Unix(), 10))

				return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
					"error":       "Rate limit exceeded",
					"code":        "RATE_LIMIT_EXCEEDED",
					"limit":       tier.RequestsPerSecond,
					"window":      "second",
					"tier":        tier.Name,
					"retry_after": retryAfter,
					"reset_at":    resetTime,
				})
			}
		}

		// 1. Per-minute limit
		allowed, remaining, resetTime, err := rl.checkLimit(ctx, tenantID, "minute", tier.RequestsPerMinute)
		if err != nil {
			rl.logger.Printf("[RateLimiter] Error checking limit: %v", err)
			// Fail open on error (don't block requests)
			return c.Next()
		}

		// Set rate limit headers
		c.Set("X-RateLimit-Limit", strconv.Itoa(tier.RequestsPerMinute))
		c.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Set("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))
		c.Set("X-RateLimit-Tier", tier.Name)

		if !allowed {
			retryAfter := int(time.Until(resetTime).Seconds())
			c.Set("Retry-After", strconv.Itoa(retryAfter))

			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":       "Rate limit exceeded",
				"code":        "RATE_LIMIT_EXCEEDED",
				"limit":       tier.RequestsPerMinute,
				"window":      "minute",
				"tier":        tier.Name,
				"retry_after": retryAfter,
				"reset_at":    resetTime,
			})
		}

		// 2. Per-hour limit (if configured)
		if tier.RequestsPerHour > 0 {
			allowed, _, resetTime, err := rl.checkLimit(ctx, tenantID, "hour", tier.RequestsPerHour)
			if err != nil {
				rl.logger.Printf("[RateLimiter] Error checking hourly limit: %v", err)
			} else if !allowed {
				retryAfter := int(time.Until(resetTime).Seconds())
				c.Set("Retry-After", strconv.Itoa(retryAfter))

				return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
					"error":       "Hourly rate limit exceeded",
					"code":        "RATE_LIMIT_EXCEEDED",
					"limit":       tier.RequestsPerHour,
					"window":      "hour",
					"retry_after": retryAfter,
					"reset_at":    resetTime,
				})
			}
		}

		// 3. Per-day limit (if configured)
		if tier.RequestsPerDay > 0 {
			allowed, _, resetTime, err := rl.checkLimit(ctx, tenantID, "day", tier.RequestsPerDay)
			if err != nil {
				rl.logger.Printf("[RateLimiter] Error checking daily limit: %v", err)
			} else if !allowed {
				retryAfter := int(time.Until(resetTime).Seconds())
				c.Set("Retry-After", strconv.Itoa(retryAfter))

				return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
					"error":       "Daily rate limit exceeded",
					"code":        "RATE_LIMIT_EXCEEDED",
					"limit":       tier.RequestsPerDay,
					"window":      "day",
					"retry_after": retryAfter,
					"reset_at":    resetTime,
				})
			}
		}

		return c.Next()
	}
}

// checkLimit checks if a request is within rate limit using sliding window algorithm
// Returns: (allowed, remaining, resetTime, error)
func (rl *DistributedRateLimiter) checkLimit(ctx context.Context, tenantID, window string, limit int) (bool, int, time.Time, error) {
	now := time.Now()
	key := fmt.Sprintf("ratelimit:%s:%s:%s", tenantID, window, getWindowKey(now, window))

	// Use Lua script for atomic increment and TTL check
	// This ensures race-free distributed rate limiting
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
			return {0, current, redis.call('TTL', key)}
		end

		local new = redis.call('INCR', key)
		if new == 1 then
			redis.call('EXPIRE', key, ttl)
		end

		return {1, new, redis.call('TTL', key)}
	`)

	ttl := getWindowTTL(window)

	result, err := script.Run(ctx, rl.cache, []string{key}, limit, int(ttl.Seconds())).Result()
	if err != nil {
		return false, 0, time.Time{}, err
	}

	resultSlice, ok := result.([]interface{})
	if !ok || len(resultSlice) != 3 {
		return false, 0, time.Time{}, fmt.Errorf("unexpected script response")
	}

	allowed := resultSlice[0].(int64) == 1
	current := int(resultSlice[1].(int64))
	remaining := limit - current
	if remaining < 0 {
		remaining = 0
	}

	ttlSeconds := resultSlice[2].(int64)
	resetTime := now.Add(time.Duration(ttlSeconds) * time.Second)

	return allowed, remaining, resetTime, nil
}

// getWindowKey returns a window key based on current time
func getWindowKey(t time.Time, window string) string {
	switch window {
	case "second":
		return fmt.Sprintf("%d-%02d-%02d-%02d:%02d:%02d",
			t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second())
	case "minute":
		return fmt.Sprintf("%d-%02d-%02d-%02d:%02d",
			t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute())
	case "hour":
		return fmt.Sprintf("%d-%02d-%02d-%02d",
			t.Year(), t.Month(), t.Day(), t.Hour())
	case "day":
		return fmt.Sprintf("%d-%02d-%02d",
			t.Year(), t.Month(), t.Day())
	default:
		return fmt.Sprintf("%d", t.Unix())
	}
}

// getWindowTTL returns TTL for a window
func getWindowTTL(window string) time.Duration {
	switch window {
	case "second":
		return 2 * time.Second // Keep for 2 seconds
	case "minute":
		return 2 * time.Minute // Keep for 2 minutes
	case "hour":
		return 2 * time.Hour // Keep for 2 hours
	case "day":
		return 2 * 24 * time.Hour // Keep for 2 days
	default:
		return 5 * time.Minute
	}
}

// GetLimitInfo returns current limit info for a tenant
func (rl *DistributedRateLimiter) GetLimitInfo(ctx context.Context, tenantID, window string, limit int) (int, int, time.Time, error) {
	if !rl.enabled {
		return limit, limit, time.Time{}, nil
	}

	now := time.Now()
	key := fmt.Sprintf("ratelimit:%s:%s:%s", tenantID, window, getWindowKey(now, window))

	current, err := rl.cache.Get(ctx, key).Int()
	if err == redis.Nil {
		current = 0
	} else if err != nil {
		return 0, 0, time.Time{}, err
	}

	remaining := limit - current
	if remaining < 0 {
		remaining = 0
	}

	ttl, err := rl.cache.TTL(ctx, key).Result()
	if err != nil {
		return 0, 0, time.Time{}, err
	}

	resetTime := now.Add(ttl)

	return current, remaining, resetTime, nil
}

// ResetLimit resets the rate limit for a tenant (admin operation)
func (rl *DistributedRateLimiter) ResetLimit(ctx context.Context, tenantID, window string) error {
	if !rl.enabled {
		return fmt.Errorf("rate limiter not enabled")
	}

	pattern := fmt.Sprintf("ratelimit:%s:%s:*", tenantID, window)

	iter := rl.cache.Scan(ctx, 0, pattern, 100).Iterator()
	deleted := 0

	for iter.Next(ctx) {
		if err := rl.cache.Del(ctx, iter.Val()).Err(); err != nil {
			rl.logger.Printf("[RateLimiter] Failed to delete key %s: %v", iter.Val(), err)
		} else {
			deleted++
		}
	}

	if err := iter.Err(); err != nil {
		return err
	}

	rl.logger.Printf("[RateLimiter] Reset %d limit keys for tenant %s window %s", deleted, tenantID, window)
	return nil
}

// GetStats returns rate limiter statistics
func (rl *DistributedRateLimiter) GetStats(ctx context.Context) (map[string]interface{}, error) {
	if !rl.enabled {
		return map[string]interface{}{
			"enabled": false,
		}, nil
	}

	// Count active rate limit keys
	var keyCount int64
	iter := rl.cache.Scan(ctx, 0, "ratelimit:*", 100).Iterator()
	for iter.Next(ctx) {
		keyCount++
	}

	if err := iter.Err(); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"enabled":      true,
		"active_keys":  keyCount,
		"default_rpm":  rl.defaultRequestsPerMinute,
		"default_burst": rl.defaultBurstSize,
		"tiers":        RateLimitTiers,
	}, nil
}

// Close closes the Redis connection
func (rl *DistributedRateLimiter) Close() error {
	if rl.cache != nil {
		return rl.cache.Close()
	}
	return nil
}
