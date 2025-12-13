package middleware

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// RateLimiter implements token bucket rate limiting with Redis and local fallback
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     int           // requests per window
	window   time.Duration // time window
	cleanupInterval time.Duration

	// Redis support with automatic fallback
	redis         *redis.Client
	redisEnabled  bool
	redisFailed   bool
	lastRedisCheck time.Time
	redisCheckInterval time.Duration
}

type bucket struct {
	tokens     int
	lastRefill time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	limiter := &RateLimiter{
		buckets:  make(map[string]*bucket),
		rate:     rate,
		window:   window,
		cleanupInterval: time.Minute * 5,
		redisCheckInterval: time.Second * 30,
	}

	// Start cleanup goroutine
	go limiter.cleanup()

	return limiter
}

// NewRateLimiterWithRedis creates a rate limiter with Redis backend
func NewRateLimiterWithRedis(rate int, window time.Duration, redisClient *redis.Client) *RateLimiter {
	limiter := &RateLimiter{
		buckets:  make(map[string]*bucket),
		rate:     rate,
		window:   window,
		cleanupInterval: time.Minute * 5,
		redis:    redisClient,
		redisEnabled: true,
		redisCheckInterval: time.Second * 30,
	}

	// Start cleanup goroutine
	go limiter.cleanup()

	// Start Redis health check
	go limiter.monitorRedis()

	return limiter
}

// RateLimitMiddleware creates a rate limiting middleware
func (rl *RateLimiter) RateLimitMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Use tenant ID as key (from tenant context), fallback to IP
		key := c.IP() // Default to IP

		// Try to get tenant ID from context for tenant-scoped rate limiting
		if tenantCtx := GetTenantContext(c); tenantCtx != nil {
			key = tenantCtx.TenantID
		}

		if !rl.allow(key) {
			// Calculate retry-after time (window remaining)
			retryAfter := int(rl.window.Seconds())

			c.Set("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.Set("X-RateLimit-Limit", fmt.Sprintf("%d", rl.rate))
			c.Set("X-RateLimit-Remaining", "0")

			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": fiber.Map{
					"message": "Rate limit exceeded. Please try again later.",
					"type":    "rate_limit_error",
					"code":    "RATE_LIMIT_EXCEEDED",
				},
				"retry_after_seconds": retryAfter,
			})
		}

		return c.Next()
	}
}

// allow checks if request is allowed based on rate limit
func (rl *RateLimiter) allow(key string) bool {
	// Try Redis first if enabled and not failed
	if rl.redisEnabled && !rl.redisFailed {
		allowed, err := rl.allowRedis(key)
		if err == nil {
			return allowed
		}
		// Redis failed, mark it and fall back to local
		rl.redisFailed = true
		log.Printf("Redis rate limiter failed, falling back to local: %v", err)
	}

	// Local token bucket fallback
	return rl.allowLocal(key)
}

// allowRedis checks rate limit using Redis
func (rl *RateLimiter) allowRedis(key string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	redisKey := fmt.Sprintf("ratelimit:%s", key)

	// Increment counter
	count, err := rl.redis.Incr(ctx, redisKey).Result()
	if err != nil {
		return false, err
	}

	// Set expiry on first request
	if count == 1 {
		rl.redis.Expire(ctx, redisKey, rl.window)
	}

	return count <= int64(rl.rate), nil
}

// allowLocal checks rate limit using local token bucket
func (rl *RateLimiter) allowLocal(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, exists := rl.buckets[key]
	if !exists {
		b = &bucket{
			tokens:     rl.rate - 1,
			lastRefill: time.Now(),
		}
		rl.buckets[key] = b
		return true
	}

	// Refill tokens based on time elapsed
	now := time.Now()
	elapsed := now.Sub(b.lastRefill)

	if elapsed >= rl.window {
		// Full refill
		b.tokens = rl.rate - 1
		b.lastRefill = now
		return true
	}

	// Check if tokens available
	if b.tokens > 0 {
		b.tokens--
		return true
	}

	return false
}

// cleanup removes old buckets periodically
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, b := range rl.buckets {
			if now.Sub(b.lastRefill) > rl.window*2 {
				delete(rl.buckets, key)
			}
		}
		rl.mu.Unlock()
	}
}

// monitorRedis periodically checks Redis health and recovers if needed
func (rl *RateLimiter) monitorRedis() {
	ticker := time.NewTicker(rl.redisCheckInterval)
	defer ticker.Stop()

	for range ticker.C {
		if !rl.redisFailed {
			continue
		}

		// Try to ping Redis
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		err := rl.redis.Ping(ctx).Err()
		cancel()

		if err == nil {
			// Redis recovered
			rl.redisFailed = false
			log.Println("Redis rate limiter recovered, resuming Redis mode")
		}
	}
}
