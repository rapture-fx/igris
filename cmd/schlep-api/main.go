package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/schlep-engine/schlep-engine/internal/api"
	"github.com/schlep-engine/schlep-engine/internal/logging"
	"github.com/schlep-engine/schlep-engine/internal/middleware"
)

func main() {
	// Initialize structured logging
	debug := os.Getenv("DEBUG") == "true"
	logging.Init("schlep-engine", debug)

	log.Println("🚀 Starting Schlep-Engine Inference API...")

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Schlep-Engine API",
		ServerHeader: "Schlep-Engine",
		ErrorHandler: customErrorHandler,
	})

	// Initialize metrics middleware and routes
	api.InitializeMetricsMiddleware(app)

	// Global middleware
	app.Use(recover.New())
	app.Use(cors.New())
	app.Use(middleware.TraceID())           // Add trace IDs to all requests
	app.Use(middleware.RequestLogger())      // Structured request logging

	// Register all routes (including inference and metrics)
	if err := api.RegisterAllRoutes(app); err != nil {
		log.Fatalf("Failed to register routes: %v", err)
	}

	// Root health check
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "schlep-engine",
			"version": "0.1.0-alpha",
			"status":  "running",
			"endpoints": fiber.Map{
				"inference": "/v1/infer",
				"health":    "/v1/health",
				"models":    "/v1/models",
				"metrics":   "/metrics",
			},
		})
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("✅ Server ready on port %s", port)
	log.Printf("   📍 Inference: http://localhost:%s/v1/infer", port)
	log.Printf("   📍 Health:    http://localhost:%s/v1/health", port)
	log.Printf("   📍 Metrics:   http://localhost:%s/metrics", port)

	if err := app.Listen(":" + port); err != nil {
		log.Fatal(err)
	}
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	// Log error with trace ID
	ctx := c.Context()
	logging.LogError(ctx, err, "request_error", map[string]interface{}{
		"path":   c.Path(),
		"method": c.Method(),
		"status": code,
	})

	return c.Status(code).JSON(fiber.Map{
		"error": fiber.Map{
			"message": err.Error(),
			"type":    "api_error",
			"code":    code,
		},
		"trace_id": logging.GetTraceID(ctx),
	})
}
