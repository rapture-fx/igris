package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/schlep-engine/schlep-engine/internal/api"
	"github.com/schlep-engine/schlep-engine/internal/database"
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

	// Initialize database and Phase 14 multi-tenancy (optional)
	enableMultiTenancy := os.Getenv("ENABLE_MULTI_TENANCY") == "true"
	if enableMultiTenancy {
		log.Println("[Phase 14] Multi-tenancy enabled - initializing...")

		// Connect to database
		dbConfig := database.NewConfig()
		db, err := database.Connect(dbConfig)
		if err != nil {
			log.Fatalf("Failed to connect to database: %v", err)
		}

		if db != nil && db.IsEnabled() {
			// Get configuration from environment
			jwtSecret := os.Getenv("JWT_SECRET")
			if jwtSecret == "" {
				log.Println("[Warning] JWT_SECRET not set - using default (INSECURE for production!)")
				jwtSecret = "default-jwt-secret-change-in-production"
			}

			vaultMasterKey := os.Getenv("VAULT_MASTER_KEY")
			if vaultMasterKey == "" {
				log.Println("[Warning] VAULT_MASTER_KEY not set - using default (INSECURE for production!)")
				vaultMasterKey = "default-vault-key-change-in-production"
			}

			// Setup multi-tenancy routes
			if err := api.SetupMultiTenancy(app, db.DB, jwtSecret, vaultMasterKey); err != nil {
				log.Fatalf("Failed to setup multi-tenancy: %v", err)
			}

			log.Println("[Phase 14] ✅ Multi-tenancy initialized successfully")

			// Ensure database is closed on shutdown
			defer func() {
				if err := db.Close(); err != nil {
					log.Printf("Error closing database: %v", err)
				}
			}()
		} else {
			log.Println("[Warning] Database not available - multi-tenancy features disabled")
		}
	}

	// Root health check
	app.Get("/", func(c *fiber.Ctx) error {
		endpoints := fiber.Map{
			"inference": "/v1/infer",
			"health":    "/v1/health",
			"models":    "/v1/models",
			"metrics":   "/metrics",
		}

		// Add multi-tenancy endpoints if enabled
		if enableMultiTenancy {
			endpoints["tenants"] = "/v1/tenants"
			endpoints["vault"] = "/v1/vault/keys"
			endpoints["auth"] = "/v1/auth/login"
		}

		return c.JSON(fiber.Map{
			"service": "schlep-engine",
			"version": "0.1.0-alpha",
			"status":  "running",
			"features": fiber.Map{
				"multi_tenancy": enableMultiTenancy,
			},
			"endpoints": endpoints,
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

	if enableMultiTenancy {
		log.Printf("   📍 Auth:      http://localhost:%s/v1/auth/login", port)
		log.Printf("   📍 Tenants:   http://localhost:%s/v1/tenants", port)
	}

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
