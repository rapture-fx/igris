package middleware

import (
	"fmt"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// RateLimiter implements token bucket rate limiting
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     int           // requests per window
	window   time.Duration // time window
	cleanupInterval time.Duration
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
	}

	// Start cleanup goroutine
	go limiter.cleanup()

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
