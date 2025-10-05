package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/schlep-engine/go-gateway/internal/middleware"
	"github.com/schlep-engine/go-gateway/internal/ml"
	"github.com/schlep-engine/go-gateway/internal/observability"
	"github.com/schlep-engine/go-gateway/internal/rust"
)

func main() {
	// Initialize tracing
	shutdownTracing := observability.InitTracing("schlep-gateway")
	defer shutdownTracing()

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Schlep-Engine Gateway",
		ServerHeader: "Schlep-Gateway/2.0",
		ErrorHandler: customErrorHandler,
	})

	// Setup security middleware
	setupMiddleware(app)

	// Initialize ML gRPC client
	mlClient, err := ml.NewClient(getEnv("ML_SERVICE_URL", "python-ml:50051"))
	if err != nil {
		log.Printf("WARNING: ML service connection failed: %v (will retry on request)", err)
		mlClient = nil
	}

	// Setup routes
	setupRoutes(app, mlClient)

	// Start server with TLS support
	port := getEnv("SERVER_PORT", "8080")
	tlsEnabled := getEnv("TLS_ENABLED", "false") == "true"

	log.Printf("🚀 Schlep-Engine Gateway starting on port %s", port)

	if tlsEnabled {
		tlsPort := getEnv("TLS_PORT", "8443")
		certFile := getEnv("TLS_CERT_FILE", "/certs/tls.crt")
		keyFile := getEnv("TLS_KEY_FILE", "/certs/tls.key")

		log.Printf("🔒 TLS enabled on port %s", tlsPort)
		log.Printf("📊 Health check: https://localhost:%s/health", tlsPort)
		log.Printf("📈 Metrics: https://localhost:%s/metrics", tlsPort)
		log.Printf("🔐 Auth: JWT required (public: /health, /metrics, /api/v1/auth/*)", tlsPort)

		// Start HTTP redirect server on port 8080
		go func() {
			redirectApp := fiber.New()
			redirectApp.Use(func(c *fiber.Ctx) error {
				return c.Redirect(fmt.Sprintf("https://%s:%s%s",
					c.Hostname(), tlsPort, c.Path()), fiber.StatusMovedPermanently)
			})
			log.Printf("🔄 HTTP->HTTPS redirect server on port %s", port)
			redirectApp.Listen(":" + port)
		}()

		// Start HTTPS server
		if err := app.ListenTLS(":"+tlsPort, certFile, keyFile); err != nil {
			log.Fatalf("Failed to start HTTPS server: %v", err)
		}
	} else {
		log.Printf("⚠️  WARNING: Running in HTTP mode (not production-ready)")
		log.Printf("📊 Health check: http://localhost:%s/health", port)
		log.Printf("📈 Metrics: http://localhost:%s/metrics", port)
		log.Printf("🔐 Auth: JWT required (public: /health, /metrics, /api/v1/auth/*)", port)

		if err := app.Listen(":" + port); err != nil {
			log.Fatal(err)
		}
	}
}

func setupMiddleware(app *fiber.App) {
	// Panic recovery (must be first)
	app.Use(recover.New(recover.Config{
		EnableStackTrace: true,
	}))

	// Request logging
	app.Use(logger.New(logger.Config{
		Format:     "[${time}] ${status} ${latency} ${method} ${path}\n",
		TimeFormat: "15:04:05",
	}))

	// Prometheus metrics
	app.Use(observability.PrometheusMiddleware())

	// Security headers and CORS
	securityConfig := &middleware.SecurityConfig{
		AllowedOrigins: getAllowedOrigins(),
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization", "X-API-Key"},
	}
	middleware.SetupSecurityMiddleware(app, securityConfig)

	// Rate limiting (100 requests per minute per IP)
	rateLimiter := middleware.NewRateLimiter(100, time.Minute)
	app.Use(rateLimiter.RateLimitMiddleware())

	// JWT authentication (with public path exceptions)
	authConfig := middleware.NewAuthConfig()
	app.Use(middleware.JWTMiddleware(authConfig))
}

func setupRoutes(app *fiber.App, mlClient *ml.Client) {
	// API v1 group
	v1 := app.Group("/api/v1")

	// Public health endpoints
	app.Get("/health", handleHealth)
	app.Get("/metrics", observability.MetricsHandler())

	// Auth endpoints (public)
	auth := v1.Group("/auth")
	auth.Post("/login", handleLogin)
	auth.Post("/register", handleRegister)

	// Protected API endpoints
	api := v1.Group("")

	// Rust FFI endpoints
	rustGroup := api.Group("/rust")
	rustGroup.Get("/add", handleRustAdd)
	rustGroup.Get("/hello", handleRustHello)
	rustGroup.Post("/validate", handleRustValidateJSON)
	rustGroup.Post("/normalize", handleRustNormalize)

	// ML endpoints
	mlGroup := api.Group("/ml")
	mlGroup.Post("/predict", handleMLPredict(mlClient))
	mlGroup.Post("/batch-predict", handleMLBatchPredict(mlClient))
	mlGroup.Get("/models", handleMLListModels(mlClient))

	// Admin endpoints (require admin role)
	admin := api.Group("/admin")
	admin.Use(middleware.RequireRole("admin"))
	admin.Get("/stats", handleAdminStats)
}

// ============================================================================
// Handler Functions
// ============================================================================

func handleHealth(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":    "healthy",
		"service":   "schlep-gateway",
		"version":   "2.0.0",
		"timestamp": time.Now().Unix(),
	})
}

func handleLogin(c *fiber.Ctx) error {
	type LoginRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Validate credentials against database
	// This is a placeholder implementation
	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
		})
	}

	// Generate JWT token
	authConfig := middleware.NewAuthConfig()
	token, err := middleware.GenerateToken(
		authConfig,
		"user-123",      // user_id from database
		req.Email,
		[]string{"user"}, // roles from database
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate token",
		})
	}

	return c.JSON(fiber.Map{
		"token": token,
		"user": fiber.Map{
			"email": req.Email,
			"roles": []string{"user"},
		},
	})
}

func handleRegister(c *fiber.Ctx) error {
	type RegisterRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}

	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Create user in database
	// This is a placeholder implementation

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "User registered successfully",
		"email":   req.Email,
	})
}

func handleRustAdd(c *fiber.Ctx) error {
	x := c.QueryInt("x", 0)
	y := c.QueryInt("y", 0)

	start := time.Now()
	result := rust.Add(x, y)
	duration := time.Since(start)

	// Record metrics
	observability.RecordRustFFICall("add", duration)

	return c.JSON(fiber.Map{
		"operation":   "rust_add",
		"x":           x,
		"y":           y,
		"result":      result,
		"latency_us":  duration.Microseconds(),
	})
}

func handleRustHello(c *fiber.Ctx) error {
	name := c.Query("name", "World")

	start := time.Now()
	message := rust.HelloFrom(name)
	duration := time.Since(start)

	// Record metrics
	observability.RecordRustFFICall("hello", duration)

	return c.JSON(fiber.Map{
		"operation":   "rust_hello",
		"message":     message,
		"latency_us":  duration.Microseconds(),
	})
}

func handleRustValidateJSON(c *fiber.Ctx) error {
	// TODO: Call Rust FFI JSON validation
	return c.JSON(fiber.Map{
		"message": "Not implemented",
	})
}

func handleRustNormalize(c *fiber.Ctx) error {
	// TODO: Call Rust FFI data normalization
	return c.JSON(fiber.Map{
		"message": "Not implemented",
	})
}

func handleMLPredict(mlClient *ml.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if mlClient == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "ML service unavailable",
			})
		}

		type PredictRequest struct {
			Features []float64 `json:"features"`
			ModelID  string    `json:"model_id"`
		}

		var req PredictRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		start := time.Now()
		resp, err := mlClient.Predict(c.Context(), req.Features, req.ModelID)
		duration := time.Since(start)

		// Record metrics
		observability.RecordGRPCCall("Predict", duration, err)

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":      "ML prediction failed",
				"message":    err.Error(),
				"latency_ms": duration.Milliseconds(),
			})
		}

		return c.JSON(fiber.Map{
			"prediction":  resp.Prediction,
			"confidence":  resp.Confidence,
			"model_id":    resp.ModelId,
			"latency_ms":  duration.Milliseconds(),
		})
	}
}

func handleMLBatchPredict(mlClient *ml.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: Implement batch prediction
		return c.JSON(fiber.Map{
			"message": "Not implemented",
		})
	}
}

func handleMLListModels(mlClient *ml.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// TODO: Implement model listing
		return c.JSON(fiber.Map{
			"message": "Not implemented",
		})
	}
}

func handleAdminStats(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"message": "Admin stats endpoint",
		"user_id": c.Locals("user_id"),
		"roles":   c.Locals("roles"),
	})
}

// ============================================================================
// Helper Functions
// ============================================================================

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	log.Printf("ERROR: %v (path: %s)", err, c.Path())

	return c.Status(code).JSON(fiber.Map{
		"error":     err.Error(),
		"timestamp": time.Now().Unix(),
		"path":      c.Path(),
	})
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getAllowedOrigins() []string {
	origins := getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3002,http://localhost:3004")
	return strings.Split(origins, ",")
}
