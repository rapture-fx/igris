package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/redis/go-redis/v9"
	"github.com/schlep-engine/schlep-engine/internal/api"
	"github.com/schlep-engine/schlep-engine/internal/cache"
	"github.com/schlep-engine/schlep-engine/internal/database"
	"github.com/schlep-engine/schlep-engine/internal/logging"
	"github.com/schlep-engine/schlep-engine/internal/middleware"
	"github.com/schlep-engine/schlep-engine/internal/observability"
	"github.com/schlep-engine/schlep-engine/internal/security"
)

func main() {
	// Initialize structured logging
	debug := os.Getenv("DEBUG") == "true"
	logging.Init("schlep-engine", debug)

	log.Println("🚀 Starting Schlep-Engine Inference API...")

	// Initialize OpenTelemetry tracing (if enabled)
	tracingEnabled := os.Getenv("TRACING_ENABLED") == "true"
	var shutdownTracer func()
	if tracingEnabled {
		log.Println("[Tracing] Initializing OpenTelemetry with Jaeger...")
		shutdownTracer = observability.InitTracing("schlep-engine-api")
		defer shutdownTracer()
		log.Println("[Tracing] ✅ OpenTelemetry tracing initialized")
	} else {
		log.Println("[Tracing] OpenTelemetry tracing disabled (set TRACING_ENABLED=true to enable)")
	}

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

	// OpenTelemetry tracing middleware (if enabled)
	if tracingEnabled {
		app.Use(middleware.OpenTelemetry())
	}

	app.Use(middleware.TraceID())           // Add trace IDs to all requests
	app.Use(middleware.RequestLogger())      // Structured request logging

	// Phase 2: Initialize multi-tenancy BEFORE registering routes (if enabled)
	var tenantAuth *middleware.TenantAuth
	var db *database.DB
	var redisClient *redis.Client
	enableMultiTenancy := os.Getenv("ENABLE_MULTI_TENANCY") == "true"
	useRedis := os.Getenv("USE_REDIS") == "true"

	// Initialize database (for multi-tenancy or health checks)
	if enableMultiTenancy || os.Getenv("ENABLE_PERSISTENCE") == "true" {
		log.Println("[Database] Initializing database connection...")
		dbConfig := database.NewConfig()
		var err error
		db, err = database.Connect(dbConfig)
		if err != nil {
			log.Fatalf("Failed to connect to database: %v", err)
		}

		if db != nil && db.IsEnabled() {
			log.Println("[Database] ✅ Database connection established")

			// Ensure database is closed on shutdown
			defer func() {
				if err := db.Close(); err != nil {
					log.Printf("Error closing database: %v", err)
				}
			}()
		}
	}

	// Initialize Redis (for Phase 2 state externalization)
	if useRedis {
		log.Println("[Redis] Initializing Redis connection...")
		redisURL := os.Getenv("REDIS_URL")
		if redisURL == "" {
			redisURL = "redis://localhost:6379/0"
		}

		statsClient, err := cache.NewProviderStatsClient(redisURL)
		if err != nil {
			log.Printf("[Redis] ⚠️  Failed to connect to Redis: %v", err)
		} else if statsClient.IsEnabled() {
			redisClient = statsClient.GetClient()
			log.Println("[Redis] ✅ Redis connection established")
		}
	}

	if enableMultiTenancy {
		log.Println("[Phase 2] Multi-tenancy enabled - initializing...")

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

			// Initialize JWT manager for tenant auth
			jwtManager, err := security.NewJWTManager(db.DB, jwtSecret, 24, true)
			if err != nil {
				log.Fatalf("Failed to initialize JWT manager: %v", err)
			}

			// Create tenant auth middleware
			tenantAuth = middleware.NewTenantAuth(jwtManager, db.DB)

			// Setup multi-tenancy routes (admin, vault, etc.)
			if err := api.SetupMultiTenancy(app, db.DB, jwtSecret, vaultMasterKey); err != nil {
				log.Fatalf("Failed to setup multi-tenancy: %v", err)
			}

			log.Println("[Phase 2] ✅ Multi-tenancy initialized successfully")

			// Initialize Provider Health Monitor (if enabled)
			enableProviderHealthMonitor := os.Getenv("ENABLE_PROVIDER_HEALTH_MONITOR") != "false" // Default: enabled
			if enableProviderHealthMonitor {
				log.Println("[ProviderHealthMonitor] Initializing provider health monitor...")

				// Initialize key vault for health monitor
				keyVault, err := security.NewKeyVault(db.DB, vaultMasterKey)
				if err != nil {
					log.Printf("[ProviderHealthMonitor] ⚠️  Failed to initialize key vault: %v", err)
				} else {
					// Import scheduler package
					providerHealthMonitor := api.NewProviderHealthMonitor(db.DB, keyVault, nil)
					providerHealthMonitor.Start()

					log.Println("[ProviderHealthMonitor] ✅ Provider health monitor started")

					// Ensure monitor is stopped on shutdown
					defer providerHealthMonitor.Stop()

					// Initialize Telemetry Aggregator (if enabled)
					enableTelemetryAggregator := os.Getenv("ENABLE_TELEMETRY_AGGREGATOR") != "false" // Default: enabled
					if enableTelemetryAggregator {
						log.Println("[TelemetryAggregator] Initializing telemetry aggregator...")
						telemetryAggregator := api.NewTelemetryAggregator(db.DB, nil)
						telemetryAggregator.Start()

						log.Println("[TelemetryAggregator] ✅ Telemetry aggregator started")

						// Ensure aggregator is stopped on shutdown
						defer telemetryAggregator.Stop()
					}
				}
			}
		} else {
			log.Println("[Warning] Database not available - multi-tenancy features disabled")
		}
	}

	// Phase 3: Initialize health checker with database and Redis
	version := "1.0.0-rc1"
	var dbInstance *sql.DB
	var dbEnabled bool
	if db != nil && db.IsEnabled() {
		dbInstance = db.DB
		dbEnabled = true
	}
	api.InitHealthChecker(version, dbInstance, dbEnabled, redisClient, useRedis)

	// Register health check routes
	if err := api.RegisterHealthRoutes(app); err != nil {
		log.Fatalf("Failed to register health routes: %v", err)
	}

	// Register all routes (including inference and metrics)
	// Pass tenant auth middleware (nil if multi-tenancy disabled)
	if err := api.RegisterAllRoutes(app, tenantAuth); err != nil {
		log.Fatalf("Failed to register routes: %v", err)
	}

	// Root health check
	app.Get("/", func(c *fiber.Ctx) error {
		endpoints := fiber.Map{
			"inference": "/v1/infer",
			"health":    "/v1/health",
			"liveness":  "/healthz",
			"readiness": "/readyz",
			"startup":   "/startupz",
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
			"version": version,
			"status":  "running",
			"features": fiber.Map{
				"multi_tenancy": enableMultiTenancy,
				"redis":         useRedis,
				"persistence":   dbEnabled,
			},
			"endpoints": endpoints,
		})
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("✅ Server ready on port %s (version %s)", port, version)
	log.Printf("   📍 Inference: http://localhost:%s/v1/infer", port)
	log.Printf("   📍 Health:    http://localhost:%s/v1/health", port)
	log.Printf("   📍 Liveness:  http://localhost:%s/healthz", port)
	log.Printf("   📍 Readiness: http://localhost:%s/readyz", port)
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
