package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/adaptor/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/redis/go-redis/v9"
	"github.com/Igris-inertial/system/igris-overture/api"
	"github.com/Igris-inertial/system/igris-overture/bandit"
	"github.com/Igris-inertial/system/igris-overture/billing"
	"github.com/Igris-inertial/system/igris-overture/cache"
	"github.com/Igris-inertial/system/igris-overture/cognitive"
	"github.com/Igris-inertial/system/igris-overture/database"
	"github.com/Igris-inertial/system/igris-overture/logging"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/observability"
	"github.com/Igris-inertial/system/igris-overture/orchestration"
	"github.com/Igris-inertial/system/igris-overture/policies"
	"github.com/Igris-inertial/system/igris-overture/router"
	"github.com/Igris-inertial/system/igris-overture/security"
	"github.com/Igris-inertial/system/igris-overture/semantic"
	"github.com/Igris-inertial/system/igris-overture/slo"
)

func main() {
	// Initialize structured logging
	debug := os.Getenv("DEBUG") == "true"
	logging.Init("igris-inertial", debug)

	log.Println("🚀 Starting Igris Overture API...")

	// Initialize OpenTelemetry tracing (if enabled)
	tracingEnabled := os.Getenv("TRACING_ENABLED") == "true"
	var shutdownTracer func()
	if tracingEnabled {
		log.Println("[Tracing] Initializing OpenTelemetry with Jaeger...")
		shutdownTracer = observability.InitTracing("igris-overture")
		defer shutdownTracer()
		log.Println("[Tracing] ✅ OpenTelemetry tracing initialized")
	} else {
		log.Println("[Tracing] OpenTelemetry tracing disabled (set TRACING_ENABLED=true to enable)")
	}

	// Configure request limits from environment or use secure defaults
	bodyLimitMB := 1 // Default: 1MB
	if envLimit := os.Getenv("BODY_LIMIT_MB"); envLimit != "" {
		if parsed, err := strconv.Atoi(envLimit); err == nil && parsed > 0 {
			bodyLimitMB = parsed
		}
	}

	readTimeoutSec := 30 // Default: 30s
	if envTimeout := os.Getenv("READ_TIMEOUT_SEC"); envTimeout != "" {
		if parsed, err := strconv.Atoi(envTimeout); err == nil && parsed > 0 {
			readTimeoutSec = parsed
		}
	}

	writeTimeoutSec := 30 // Default: 30s
	if envTimeout := os.Getenv("WRITE_TIMEOUT_SEC"); envTimeout != "" {
		if parsed, err := strconv.Atoi(envTimeout); err == nil && parsed > 0 {
			writeTimeoutSec = parsed
		}
	}

	// Initialize Fiber app with security limits
	app := fiber.New(fiber.Config{
		AppName:      "Igris Inertial API",
		ServerHeader: "Igris-Inertial",
		ErrorHandler: customErrorHandler,
		// Security limits
		BodyLimit:    bodyLimitMB * 1024 * 1024,         // Convert MB to bytes
		ReadTimeout:  time.Second * time.Duration(readTimeoutSec),
		WriteTimeout: time.Second * time.Duration(writeTimeoutSec),
	})

	log.Printf("[Security] Request limits configured: body=%dMB, read_timeout=%ds, write_timeout=%ds",
		bodyLimitMB, readTimeoutSec, writeTimeoutSec)

	// Initialize metrics middleware and routes
	api.InitializeMetricsMiddleware(app)

	// Global middleware
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     getAllowedOrigins(),
		AllowMethods:     "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-API-Key,X-Trace-ID,X-Budget-Override",
		AllowCredentials: true,
		MaxAge:           3600,
	}))

	// OpenTelemetry tracing middleware (if enabled)
	if tracingEnabled {
		app.Use(middleware.OpenTelemetry())
	}

	app.Use(middleware.TraceID())           // Add trace IDs to all requests
	app.Use(middleware.RequestLogger())      // Structured request logging

	// Global rate limiting (per-IP, per-tenant when authenticated)
	globalRateLimit := 100 // requests per minute default
	if envRate := os.Getenv("RATE_LIMIT_PER_MINUTE"); envRate != "" {
		if parsed, err := strconv.Atoi(envRate); err == nil && parsed > 0 {
			globalRateLimit = parsed
		}
	}
	rateLimiter := middleware.NewRateLimiter(globalRateLimit, time.Minute)
	app.Use(rateLimiter.RateLimitMiddleware())

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

			// Initialize Cognitive Advisor (v1.2.0 - if enabled)
			enableCognitiveAdvisor := os.Getenv("ENABLE_COGNITIVE_ADVISOR") == "true"
			if enableCognitiveAdvisor {
				log.Println("[CognitiveAdvisor] Initializing Cognitive Layer (v1.2.0)...")

				// Initialize Advanced Policy Engine for cognitive layer
				advancedPolicyEngine := policies.NewAdvancedPolicyEngine(db.DB, redisClient)

				// Initialize semantic router (keyword-based classifier, no ONNX needed)
				var semanticCache semantic.ClassificationCache
				if redisClient != nil {
					semanticCache = semantic.NewRedisClassificationCache(redisClient)
				} else {
					semanticCache = semantic.NewNullCache()
				}
				var semanticDB semantic.ClassificationDB
				if db.DB != nil {
					semanticDB = semantic.NewPostgresClassificationDB(db.DB)
				} else {
					semanticDB = semantic.NewNullDB()
				}
				classifier := semantic.NewClassifier(semanticCache, semanticDB)

				// Initialize reward engine (Thompson Sampling per semantic class)
				rewardEngine := bandit.NewRewardEngine(db.DB)

				// Initialize adaptive router for semantic routing backend selection
				adaptiveRouter := router.NewAdaptiveRouter(router.PolicyThompsonSampling, 5*time.Minute)

				// Create semantic router
				semanticRouter := router.NewSemanticRouter(classifier, rewardEngine, adaptiveRouter)
				log.Println("[SemanticRouter] Keyword-based semantic router initialized")

				// Initialize cognitive worker (creates advisor and applier internally)
				worker := cognitive.NewWorker(db.DB, advancedPolicyEngine, semanticRouter)

				// Start cognitive worker (runs every 15 minutes)
				ctx := context.Background()
				worker.Start(ctx)

				// Register cognitive admin routes (use worker's applier)
				api.RegisterCognitiveRoutes(app, worker.GetApplier())

				log.Println("[CognitiveAdvisor] ✅ Cognitive Layer initialized successfully")
				log.Println("[CognitiveAdvisor] 🧠 AI-powered optimization running every 15 minutes")
				log.Println("[CognitiveAdvisor] 📊 Admin API available at /admin/cognitive/*")

				// Ensure worker is stopped on shutdown
				defer worker.Stop()
			}

			// Initialize SLO Enforcer (v1.2.0 - if enabled)
			enableSLOEnforcer := os.Getenv("ENABLE_SLO_ENFORCER") == "true"
			if enableSLOEnforcer {
				log.Println("[SLOEnforcer] Initializing SLO Enforcer (v1.2.0)...")

				// Get SLO enforcer version
				sloVersion := slo.GetVersion()
				log.Printf("[SLOEnforcer] Using SLO enforcer library version: %s", sloVersion)

				// Initialize audit logger
				auditLogger := slo.NewAuditLogger(db.DB)

				// Initialize Prometheus scraper
				metricsURL := os.Getenv("SLO_METRICS_URL")
				if metricsURL == "" {
					metricsURL = "http://localhost:8080/metrics"
				}
				promScraper := slo.NewPrometheusScraper(metricsURL)

				// Initialize action executor
				actionExecutor := slo.NewActionExecutor(auditLogger)

				// Start Prometheus scraper in background
				ctx := context.Background()
				go promScraper.Start(ctx, actionExecutor)

				// Register SLO admin routes
				sloHandler := api.NewSLOHandler(auditLogger, promScraper)
				app.Get("/admin/slo/status", adaptor.HTTPHandlerFunc(sloHandler.HandleGetStatus))
				app.Get("/admin/slo/audit", adaptor.HTTPHandlerFunc(sloHandler.HandleGetAuditEvents))
				app.Post("/admin/slo/evaluate", adaptor.HTTPHandlerFunc(sloHandler.HandleEvaluate))
				app.Get("/admin/slo/metrics", adaptor.HTTPHandlerFunc(sloHandler.HandleGetMetrics))

				log.Println("[SLOEnforcer] ✅ SLO Enforcer initialized successfully")
				log.Printf("[SLOEnforcer] 🔍 Monitoring /metrics endpoint (20s interval)")
				log.Println("[SLOEnforcer] 📊 Admin API available at /admin/slo/*")

				// Ensure scraper is stopped on shutdown
				defer promScraper.Stop()
			}

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

	// Initialize Orchestration Layer (Simatic) - gRPC server for distributed routing
	var orchestrationServer *orchestration.Server
	enableOrchestration := os.Getenv("ENABLE_ORCHESTRATION") != "false" // Default: enabled
	if enableOrchestration {
		grpcPort := os.Getenv("GRPC_PORT")
		if grpcPort == "" {
			grpcPort = "50051"
		}

		orchestrationServer = orchestration.NewServer(grpcPort)
		if err := orchestrationServer.Start(); err != nil {
			log.Printf("[Orchestration] ⚠️  Failed to start gRPC server: %v", err)
		} else {
			log.Println("[Orchestration] ✅ Simatic Layer initialized successfully")
			log.Printf("[Orchestration] 🌐 gRPC server listening on port %s", grpcPort)
			defer orchestrationServer.Stop()
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
	// Pass tenant auth middleware and database (nil if disabled)
	if err := api.RegisterAllRoutes(app, tenantAuth, db); err != nil {
		log.Fatalf("Failed to register routes: %v", err)
	}

	// Register license validation and usage tracking routes (requires database)
	if dbInstance != nil {
		api.RegisterLicenseRoutes(app, dbInstance)
		api.RegisterUsageRoutes(app, dbInstance)
		log.Println("[Licensing] ✅ License and usage endpoints registered")
	} else {
		log.Println("[Licensing] ⚠️  Database not available — license endpoints disabled")
	}

	// Initialize Polar billing webhook handler (if configured)
	enableBilling := os.Getenv("POLAR_API_KEY") != ""
	if enableBilling && redisClient != nil && dbInstance != nil {
		log.Println("[Billing] Initializing Polar webhook handler...")
		polarCfg, err := billing.LoadPolarConfig(redisClient)
		if err != nil {
			log.Printf("[Billing] ⚠️  Failed to load Polar config: %v", err)
		} else {
			polarClient, err := billing.NewPolarClient(*polarCfg)
			if err != nil {
				log.Printf("[Billing] ⚠️  Failed to create Polar client: %v", err)
			} else {
				webhookHandler := billing.NewWebhookHandler(polarClient, dbInstance)
				app.Post("/webhooks/polar", adaptor.HTTPHandlerFunc(webhookHandler.HandleWebhook))
				log.Println("[Billing] ✅ Polar webhook handler registered at POST /webhooks/polar")
			}
		}
	} else if enableBilling {
		log.Println("[Billing] ⚠️  POLAR_API_KEY set but Redis or DB not available — webhooks disabled")
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

		// Add license endpoints if database is available
		if dbInstance != nil {
			endpoints["license_validate"] = "/api/v1/license/validate"
			endpoints["usage_log"] = "/api/v1/usage/log"
		}

		// Add billing webhook if configured
		if enableBilling {
			endpoints["webhooks_polar"] = "/webhooks/polar"
		}

		// Add multi-tenancy endpoints if enabled
		if enableMultiTenancy {
			endpoints["tenants"] = "/v1/tenants"
			endpoints["vault"] = "/v1/vault/keys"
			endpoints["auth"] = "/v1/auth/login"
		}

		// Add cognitive advisor endpoints if enabled
		enableCognitiveAdvisor := os.Getenv("ENABLE_COGNITIVE_ADVISOR") == "true"
		if enableCognitiveAdvisor {
			endpoints["cognitive"] = "/admin/cognitive/proposals"
		}

		// Add SLO enforcer endpoints if enabled
		enableSLOEnforcer := os.Getenv("ENABLE_SLO_ENFORCER") == "true"
		if enableSLOEnforcer {
			endpoints["slo_status"] = "/admin/slo/status"
			endpoints["slo_audit"] = "/admin/slo/audit"
		}

		// Add orchestration endpoints if enabled
		if enableOrchestration && orchestrationServer != nil {
			grpcPort := os.Getenv("GRPC_PORT")
			if grpcPort == "" {
				grpcPort = "50051"
			}
			endpoints["grpc"] = "grpc://localhost:" + grpcPort
		}

		return c.JSON(fiber.Map{
			"service": "igris-overture",
			"version": version,
			"status":  "running",
			"features": fiber.Map{
				"multi_tenancy":      enableMultiTenancy,
				"redis":              useRedis,
				"persistence":        dbEnabled,
				"licensing":          dbInstance != nil,
				"billing":            enableBilling,
				"cognitive_advisor":  enableCognitiveAdvisor,
				"slo_enforcer":       enableSLOEnforcer,
				"simatic_layer":      enableOrchestration,
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

	if dbInstance != nil {
		log.Printf("   📍 License:   http://localhost:%s/api/v1/license/validate", port)
		log.Printf("   📍 Usage:     http://localhost:%s/api/v1/usage/log", port)
	}
	if enableBilling {
		log.Printf("   📍 Webhooks:  http://localhost:%s/webhooks/polar", port)
	}

	if enableMultiTenancy {
		log.Printf("   📍 Auth:      http://localhost:%s/v1/auth/login", port)
		log.Printf("   📍 Tenants:   http://localhost:%s/v1/tenants", port)
	}

	if err := app.Listen(":" + port); err != nil {
		log.Fatal(err)
	}
}

// getAllowedOrigins returns CORS allowed origins from environment or defaults
func getAllowedOrigins() string {
	origins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if origins != "" {
		return origins
	}
	// Default: production domains + localhost for development
	return "https://igrisinertial.com,https://www.igrisinertial.com,https://admin.igris-inertial.com,https://docs.igrisinertial.com,http://localhost:3000,http://localhost:3001,http://localhost:3005"
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	// Log full error internally with trace ID and sanitization
	ctx := c.Context()
	logging.LogError(ctx, err, "request_error", map[string]interface{}{
		"path":   c.Path(),
		"method": c.Method(),
		"status": code,
	})

	// Return sanitized error to client (NEVER include stack traces, provider names, DB errors, etc.)
	var message string
	var errorType string

	switch code {
	case fiber.StatusBadRequest:
		message = "Invalid request. Please check your input and try again."
		errorType = "invalid_request_error"
	case fiber.StatusUnauthorized:
		message = "Authentication required. Please provide valid credentials."
		errorType = "authentication_error"
	case fiber.StatusForbidden:
		message = "Access denied. You do not have permission to access this resource."
		errorType = "authorization_error"
	case fiber.StatusNotFound:
		message = "Resource not found."
		errorType = "not_found_error"
	case fiber.StatusTooManyRequests:
		message = "Rate limit exceeded. Please try again later."
		errorType = "rate_limit_error"
	case fiber.StatusRequestEntityTooLarge:
		message = "Request payload too large. Maximum size is 1MB."
		errorType = "payload_too_large_error"
	case fiber.StatusServiceUnavailable:
		message = "Service temporarily unavailable. Please try again later."
		errorType = "service_unavailable"
	case fiber.StatusGatewayTimeout:
		message = "Request timeout. Please try again."
		errorType = "timeout_error"
	default:
		// For all other errors (including 500), return generic message
		// NEVER expose internal details like:
		// - Stack traces
		// - Provider names or IDs
		// - Database errors
		// - File paths
		// - Configuration details
		message = "An internal error occurred. Please try again later."
		errorType = "internal_error"
	}

	return c.Status(code).JSON(fiber.Map{
		"error": fiber.Map{
			"message": message,
			"type":    errorType,
			"code":    code,
		},
		"trace_id": logging.GetTraceID(ctx),
	})
}
