package middleware

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	RedisClient     *redis.Client
	RequestsPerMin  int
	RequestsPerHour int
	KeyPrefix       string
	SkipPaths       []string
	GetKey          func(*fiber.Ctx) string // Custom key generator
}

// RateLimitMiddleware creates a Redis-backed rate limiting middleware
func RateLimitMiddleware(config RateLimitConfig) fiber.Handler {
	// Default key generator (IP-based)
	if config.GetKey == nil {
		config.GetKey = func(c *fiber.Ctx) string {
			return c.IP()
		}
	}

	if config.KeyPrefix == "" {
		config.KeyPrefix = "ratelimit"
	}

	return func(c *fiber.Ctx) error {
		// Skip rate limiting for certain paths
		path := c.Path()
		for _, skipPath := range config.SkipPaths {
			if path == skipPath {
				return c.Next()
			}
		}

		// Generate rate limit key
		identifier := config.GetKey(c)
		minKey := fmt.Sprintf("%s:%s:min", config.KeyPrefix, identifier)
		hourKey := fmt.Sprintf("%s:%s:hour", config.KeyPrefix, identifier)

		ctx := context.Background()

		// Check minute limit
		minCount, err := incrementAndExpire(ctx, config.RedisClient, minKey, time.Minute)
		if err != nil {
			// On Redis error, allow request but log warning
			c.Locals("rate_limit_error", err)
			return c.Next()
		}

		// Check hour limit
		hourCount, err := incrementAndExpire(ctx, config.RedisClient, hourKey, time.Hour)
		if err != nil {
			c.Locals("rate_limit_error", err)
			return c.Next()
		}

		// Set rate limit headers
		c.Set("X-RateLimit-Limit-Minute", strconv.Itoa(config.RequestsPerMin))
		c.Set("X-RateLimit-Remaining-Minute", strconv.Itoa(max(0, config.RequestsPerMin-minCount)))
		c.Set("X-RateLimit-Limit-Hour", strconv.Itoa(config.RequestsPerHour))
		c.Set("X-RateLimit-Remaining-Hour", strconv.Itoa(max(0, config.RequestsPerHour-hourCount)))

		// Check if rate limit exceeded
		if minCount > config.RequestsPerMin {
			c.Set("Retry-After", "60")
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   "Rate limit exceeded",
				"message": fmt.Sprintf("Too many requests. Limit: %d requests per minute", config.RequestsPerMin),
				"retry_after": 60,
			})
		}

		if hourCount > config.RequestsPerHour {
			c.Set("Retry-After", "3600")
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   "Rate limit exceeded",
				"message": fmt.Sprintf("Too many requests. Limit: %d requests per hour", config.RequestsPerHour),
				"retry_after": 3600,
			})
		}

		return c.Next()
	}
}

// incrementAndExpire increments a Redis key and sets expiration
func incrementAndExpire(ctx context.Context, client *redis.Client, key string, expiration time.Duration) (int, error) {
	pipe := client.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, expiration)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return 0, err
	}

	return int(incr.Val()), nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
