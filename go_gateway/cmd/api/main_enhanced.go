package main

import (
	"crypto/tls"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/schlep-engine/go-gateway/internal/config"
	"github.com/schlep-engine/go-gateway/internal/middleware"
	"github.com/schlep-engine/go-gateway/internal/ml"
	"github.com/schlep-engine/go-gateway/internal/observability"
	"github.com/schlep-engine/go-gateway/internal/rust"
)

func main() {
	// Load configuration from environment
	cfg := config.LoadConfig()

	// Configure logging
	setupLogging(cfg.Observability.LogLevel)

	log.Printf("🚀 Starting Schlep-Engine Gateway")
	log.Printf("📋 Environment: %s", cfg.Server.Environment)
	log.Printf("🔒 TLS Enabled: %v", cfg.TLS.Enabled)
	log.Printf("📊 Metrics Enabled: %v", cfg.Observability.MetricsEnabled)

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Schlep-Engine Gateway",
		ServerHeader: "Schlep-Gateway",
		ErrorHandler: customErrorHandler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	})

	// Middleware stack
	setupMiddleware(app, cfg)

	// Initialize ML gRPC client with circuit breaker
	mlClient, err := initializeMLClient(cfg)
	if err != nil {
		log.Printf("WARNING: ML service initialization failed: %v", err)
		mlClient = nil
	}

	// Setup routes
	setupEnhancedRoutes(app, mlClient, cfg)

	// Start metrics server if enabled
	if cfg.Observability.MetricsEnabled {
		go startMetricsServer(cfg.Observability.MetricsPort)
	}

	// Start server
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	log.Printf("🌐 Server starting on %s", addr)

	if cfg.TLS.Enabled {
		startTLSServer(app, addr, cfg.TLS)
	} else {
		if err := app.Listen(addr); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}
}

func setupLogging(level string) {
	// Configure log flags
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// In production, use structured logging
	// For now, simple text logging
	log.Printf("📝 Log level: %s", level)
}

func setupMiddleware(app *fiber.App, cfg *config.Config) {
	// Recovery middleware
	app.Use(recover.New())

	// Logger middleware
	app.Use(logger.New(logger.Config{
		Format:     "${time} | ${status} | ${latency} | ${method} ${path} | ${error}\n",
		TimeFormat: "15:04:05",
		TimeZone:   "UTC",
	}))

	// CORS middleware
	if cfg.Security.CORSEnabled {
		app.Use(cors.New(cors.Config{
			AllowOrigins: cfg.Security.CORSOrigins,
			AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
			AllowHeaders: "Origin,Content-Type,Accept,Authorization,X-Trace-ID",
		}))
	}

	// Prometheus metrics middleware
	if cfg.Observability.MetricsEnabled {
		app.Use(observability.PrometheusMiddleware())
	}

	// Input validation middleware (applies to /ml/predict endpoints)
	validationConfig := middleware.ValidationConfig{
		MaxFeaturesLength: cfg.Validation.MaxFeatures,
		RequireTraceID:    cfg.Validation.RequireTraceID,
	}
	app.Use(middleware.InputValidationMiddleware(validationConfig))
}

func initializeMLClient(cfg *config.Config) (*ml.CircuitBreakerClient, error) {
	log.Printf("🔌 Connecting to ML service at %s", cfg.MLService.Address)

	cbConfig := ml.CircuitBreakerConfig{
		Name:        cfg.CircuitBreaker.Name,
		MaxRequests: cfg.CircuitBreaker.MaxRequests,
		Interval:    cfg.CircuitBreaker.Interval,
		Timeout:     cfg.CircuitBreaker.Timeout,
		Threshold:   cfg.CircuitBreaker.Threshold,
	}

	client, err := ml.NewCircuitBreakerClient(cfg.MLService.Address, cbConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create ML client: %w", err)
	}

	log.Printf("✅ ML client initialized with circuit breaker")
	return client, nil
}

func setupEnhancedRoutes(app *fiber.App, mlClient *ml.CircuitBreakerClient, cfg *config.Config) {
	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		health := fiber.Map{
			"status":      "ok",
			"service":     "go-gateway",
			"version":     "1.0.0-phase10",
			"timestamp":   time.Now().Unix(),
			"environment": cfg.Server.Environment,
		}

		// Check ML service health if client is available
		if mlClient != nil {
			mlHealthy, err := mlClient.HealthCheck(c.Context())
			health["ml_service"] = fiber.Map{
				"healthy":         mlHealthy,
				"circuit_state":   mlClient.GetState().String(),
				"error":           err,
			}
		}

		return c.JSON(health)
	})

	// Rust FFI test endpoint
	app.Get("/rust/add", func(c *fiber.Ctx) error {
		x := c.QueryInt("x", 0)
		y := c.QueryInt("y", 0)

		startTime := time.Now()
		result := rust.Add(x, y)
		duration := time.Since(startTime)

		observability.RecordRustFFICall("add", duration)

		return c.JSON(fiber.Map{
			"operation":  "rust_add",
			"x":          x,
			"y":          y,
			"result":     result,
			"latency_us": duration.Microseconds(),
		})
	})

	// ML prediction endpoint with circuit breaker and validation
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		if mlClient == nil {
			return c.Status(503).JSON(fiber.Map{
				"error": "ML service unavailable",
			})
		}

		// Get validated request from context (set by validation middleware)
		req, ok := c.Locals("validated_request").(middleware.MLPredictRequest)
		if !ok {
			// Fallback to parsing if validation middleware didn't run
			if err := c.BodyParser(&req); err != nil {
				return c.Status(400).JSON(fiber.Map{
					"error": "Invalid request body",
				})
			}
		}

		traceID := c.Locals("trace_id")

		startTime := time.Now()
		resp, err := mlClient.Predict(c.Context(), req.Features, req.ModelID)
		duration := time.Since(startTime)

		// Record metrics
		observability.RecordGRPCCall("Predict", duration, err)

		if err != nil {
			// Check if circuit breaker is open
			if ml.IsCircuitBreakerOpen(err) {
				return c.Status(503).JSON(fiber.Map{
					"error":      "Circuit breaker open - ML service temporarily unavailable",
					"trace_id":   traceID,
					"latency_ms": duration.Milliseconds(),
					"retry_after": 30,
				})
			}

			return c.Status(500).JSON(fiber.Map{
				"error":      "ML prediction failed",
				"message":    err.Error(),
				"trace_id":   traceID,
				"latency_ms": duration.Milliseconds(),
			})
		}

		return c.JSON(fiber.Map{
			"prediction":  resp.Prediction,
			"confidence":  resp.Confidence,
			"model_id":    resp.ModelId,
			"latency_ms":  duration.Milliseconds(),
			"trace_id":    traceID,
		})
	})

	// Circuit breaker status endpoint
	app.Get("/ml/circuit-breaker", func(c *fiber.Ctx) error {
		if mlClient == nil {
			return c.Status(503).JSON(fiber.Map{
				"error": "ML service unavailable",
			})
		}

		counts := mlClient.GetCounts()
		state := mlClient.GetState()

		return c.JSON(fiber.Map{
			"state":           state.String(),
			"requests":        counts.Requests,
			"total_successes": counts.TotalSuccesses,
			"total_failures":  counts.TotalFailures,
			"consecutive_successes": counts.ConsecutiveSuccesses,
			"consecutive_failures":  counts.ConsecutiveFailures,
		})
	})

	// Benchmark endpoint
	app.Get("/benchmark", func(c *fiber.Ctx) error {
		iterations := c.QueryInt("iterations", 1000)

		rustStart := time.Now()
		for i := 0; i < iterations; i++ {
			rust.Add(i, i+1)
		}
		rustTotal := time.Since(rustStart)

		return c.JSON(fiber.Map{
			"iterations":           iterations,
			"rust_ffi_total_ms":    rustTotal.Milliseconds(),
			"rust_ffi_avg_us":      rustTotal.Microseconds() / int64(iterations),
			"rust_ffi_ops_per_sec": float64(iterations) / rustTotal.Seconds(),
		})
	})
}

func startMetricsServer(port string) {
	metricsApp := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	metricsApp.Get("/metrics", observability.MetricsHandler())

	addr := fmt.Sprintf(":%s", port)
	log.Printf("📊 Metrics server starting on %s", addr)

	if err := metricsApp.Listen(addr); err != nil {
		log.Printf("Failed to start metrics server: %v", err)
	}
}

func startTLSServer(app *fiber.App, addr string, tlsConfig config.TLSConfig) {
	if tlsConfig.CertFile == "" || tlsConfig.KeyFile == "" {
		log.Fatal("TLS enabled but cert/key files not specified")
	}

	// Load TLS certificate
	cert, err := tls.LoadX509KeyPair(tlsConfig.CertFile, tlsConfig.KeyFile)
	if err != nil {
		log.Fatalf("Failed to load TLS certificate: %v", err)
	}

	tlsCfg := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}

	ln, err := tls.Listen("tcp", addr, tlsCfg)
	if err != nil {
		log.Fatalf("Failed to create TLS listener: %v", err)
	}

	log.Printf("🔒 TLS server starting on %s", addr)
	if err := app.Listener(ln); err != nil {
		log.Fatalf("Failed to start TLS server: %v", err)
	}
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	traceID := c.Locals("trace_id")

	return c.Status(code).JSON(fiber.Map{
		"error":     err.Error(),
		"timestamp": time.Now().Unix(),
		"trace_id":  traceID,
	})
}
