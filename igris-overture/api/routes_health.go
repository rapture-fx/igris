package api

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/Igris-inertial/system/igris-overture/health"
)

var healthChecker *health.HealthChecker

// InitHealthChecker initializes the global health checker
func InitHealthChecker(version string, db *sql.DB, dbEnabled bool, redis *redis.Client, redisEnabled bool) {
	healthChecker = health.NewHealthChecker(version)

	if db != nil && dbEnabled {
		healthChecker.SetDatabase(db, dbEnabled)
	}

	if redis != nil && redisEnabled {
		healthChecker.SetRedis(redis, redisEnabled)
	}

	log.Println("[Health] Health checker initialized")
}

// RegisterHealthRoutes registers Kubernetes-compatible health check endpoints
func RegisterHealthRoutes(app *fiber.App) error {
	log.Println("[Routes] Registering health check endpoints...")

	// Bare /health alias — required by web console health check gate
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})
	log.Println("[Routes] ✓ GET /health (console health gate alias)")

	// Kubernetes liveness probe
	// Returns 200 if the application is running (even if degraded)
	// Kubernetes will restart the pod if this fails
	app.Get("/healthz", func(c *fiber.Ctx) error {
		if healthChecker == nil {
			return c.Status(503).JSON(fiber.Map{
				"status":  "unhealthy",
				"message": "Health checker not initialized",
			})
		}

		if healthChecker.CheckLiveness() {
			return c.JSON(fiber.Map{
				"status": "alive",
			})
		}

		return c.Status(503).JSON(fiber.Map{
			"status": "dead",
		})
	})
	log.Println("[Routes] ✓ GET /healthz (Kubernetes liveness probe)")

	// Kubernetes readiness probe
	// Returns 200 only if the application is ready to serve traffic
	// Kubernetes will remove the pod from service if this fails
	app.Get("/readyz", func(c *fiber.Ctx) error {
		if healthChecker == nil {
			return c.Status(503).JSON(fiber.Map{
				"status":  "not_ready",
				"message": "Health checker not initialized",
			})
		}

		ctx, cancel := context.WithTimeout(c.UserContext(), 2*time.Second)
		defer cancel()

		if healthChecker.CheckReadiness(ctx) {
			return c.JSON(fiber.Map{
				"status": "ready",
			})
		}

		return c.Status(503).JSON(fiber.Map{
			"status": "not_ready",
		})
	})
	log.Println("[Routes] ✓ GET /readyz (Kubernetes readiness probe)")

	// Detailed health endpoint (OpenAPI compatible)
	// Returns comprehensive health information
	app.Get("/v1/health", func(c *fiber.Ctx) error {
		if healthChecker == nil {
			return c.Status(503).JSON(fiber.Map{
				"status":  "unhealthy",
				"message": "Health checker not initialized",
			})
		}

		ctx, cancel := context.WithTimeout(c.UserContext(), 5*time.Second)
		defer cancel()

		health := healthChecker.CheckHealth(ctx)

		// Return appropriate HTTP status
		statusCode := 200
		if health.Status == "unhealthy" {
			statusCode = 503
		} else if health.Status == "degraded" {
			statusCode = 200 // Still accepting traffic, but degraded
		}

		return c.Status(statusCode).JSON(health)
	})
	log.Println("[Routes] ✓ GET /v1/health (Detailed health check)")

	// Startup probe (Kubernetes)
	// Used to know when a container application has started
	// Prevents liveness/readiness probes from killing slow-starting containers
	app.Get("/startupz", func(c *fiber.Ctx) error {
		// For now, same as liveness
		// In future, could check if initialization is complete
		if healthChecker == nil {
			return c.Status(503).JSON(fiber.Map{
				"status":  "starting",
				"message": "Health checker not initialized",
			})
		}

		return c.JSON(fiber.Map{
			"status": "started",
		})
	})
	log.Println("[Routes] ✓ GET /startupz (Kubernetes startup probe)")

	log.Println("[Routes] All health check routes registered successfully")
	return nil
}
