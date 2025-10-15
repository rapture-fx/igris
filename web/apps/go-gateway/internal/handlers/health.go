package handlers

import (
	"context"
	"runtime"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// HealthCheck returns a simple health check handler
func HealthCheck(db *gorm.DB, redisClient *redis.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Check database
		dbStatus := "ok"
		if db != nil {
			sqlDB, err := db.DB()
			if err != nil || sqlDB.Ping() != nil {
				dbStatus = "unavailable"
			}
		}

		// Check Redis
		redisStatus := "ok"
		if redisClient != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			if err := redisClient.Ping(ctx).Err(); err != nil {
				redisStatus = "unavailable"
			}
		}

		duration := time.Since(start)

		return c.JSON(fiber.Map{
			"status":    "ok",
			"service":   "go-gateway",
			"timestamp": time.Now().Unix(),
			"checks": fiber.Map{
				"database": dbStatus,
				"redis":    redisStatus,
			},
			"latency_ms": duration.Milliseconds(),
		})
	}
}

// ReadinessCheck returns a readiness probe handler
func ReadinessCheck(db *gorm.DB, redisClient *redis.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check all critical dependencies
		checks := make(map[string]string)
		ready := true

		// Database check
		if db != nil {
			sqlDB, err := db.DB()
			if err != nil || sqlDB.Ping() != nil {
				checks["database"] = "not_ready"
				ready = false
			} else {
				checks["database"] = "ready"
			}
		}

		// Redis check
		if redisClient != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			if err := redisClient.Ping(ctx).Err(); err != nil {
				checks["redis"] = "not_ready"
				ready = false
			} else {
				checks["redis"] = "ready"
			}
		}

		status := "ready"
		if !ready {
			status = "not_ready"
		}

		statusCode := fiber.StatusOK
		if !ready {
			statusCode = fiber.StatusServiceUnavailable
		}

		return c.Status(statusCode).JSON(fiber.Map{
			"status": status,
			"checks": checks,
		})
	}
}

// VersionInfo returns version information
func VersionInfo(cfg interface{}) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get config
		type Config interface {
			AppVersion string
			Environment string
		}

		var version, environment string
		if config, ok := cfg.(Config); ok {
			version = config.AppVersion
			environment = config.Environment
		}

		return c.JSON(fiber.Map{
			"version":     version,
			"environment": environment,
			"go_version":  runtime.Version(),
			"timestamp":   time.Now().Unix(),
		})
	}
}

// SystemStats returns system statistics (admin only)
func SystemStats() fiber.Handler {
	return func(c *fiber.Ctx) error {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		return c.JSON(fiber.Map{
			"system": fiber.Map{
				"num_goroutine": runtime.NumGoroutine(),
				"num_cpu":       runtime.NumCPU(),
				"memory": fiber.Map{
					"alloc_mb":       m.Alloc / 1024 / 1024,
					"total_alloc_mb": m.TotalAlloc / 1024 / 1024,
					"sys_mb":         m.Sys / 1024 / 1024,
					"num_gc":         m.NumGC,
				},
			},
			"timestamp": time.Now().Unix(),
		})
	}
}
