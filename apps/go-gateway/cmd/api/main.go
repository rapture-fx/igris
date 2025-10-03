package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	fiberLogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"github.com/schlep-engine/gateway/internal/config"
	"github.com/schlep-engine/gateway/internal/handlers"
	"github.com/schlep-engine/gateway/internal/middleware"
	"github.com/schlep-engine/gateway/pkg/logger"
	"github.com/schlep-engine/gateway/pkg/metrics"
	"github.com/valyala/fasthttp/fasthttpadaptor"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize logger
	logger.Initialize(cfg.LogLevel, cfg.LogFormat)
	log.Info().
		Str("version", cfg.AppVersion).
		Str("environment", cfg.Environment).
		Msg("Starting Schlep-Engine Go Gateway")

	// Initialize Redis
	redisClient := initRedis(cfg)
	defer redisClient.Close()

	// Initialize Database
	db := initDatabase(cfg)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:          "Schlep-Engine Gateway",
		ServerHeader:     "Schlep-Gateway/" + cfg.AppVersion,
		ReadTimeout:      cfg.ReadTimeout,
		WriteTimeout:     cfg.WriteTimeout,
		IdleTimeout:      cfg.IdleTimeout,
		ErrorHandler:     middleware.ErrorHandler(logger.Get()),
		DisableStartupMessage: true,
	})

	// Global middleware stack
	setupMiddleware(app, cfg, redisClient)

	// Setup routes
	setupRoutes(app, cfg, db, redisClient)

	// Start server in goroutine
	go func() {
		addr := fmt.Sprintf("%s:%s", cfg.ServerHost, cfg.ServerPort)
		log.Info().
			Str("address", addr).
			Str("metrics", "http://"+addr+"/metrics").
			Str("health", "http://"+addr+"/health").
			Msg("Server starting")

		if err := app.Listen(addr); err != nil {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	// Graceful shutdown
	gracefulShutdown(app, cfg.ShutdownTimeout)
}

// setupMiddleware configures all middleware
func setupMiddleware(app *fiber.App, cfg *config.Config, redisClient *redis.Client) {
	// Recovery middleware (must be first)
	app.Use(middleware.RecoveryMiddleware(middleware.RecoveryConfig{
		Logger:           logger.Get(),
		EnableStackTrace: cfg.IsDevelopment(),
	}))

	// Request logging middleware
	app.Use(middleware.LoggingMiddleware(middleware.LoggingConfig{
		Logger:    logger.Get(),
		SkipPaths: []string{"/health", "/metrics", "/ready"},
		LogRequestBody: cfg.IsDevelopment(),
		LogResponseBody: cfg.IsDevelopment(),
	}))

	// Metrics middleware (Prometheus)
	if cfg.EnableMetrics {
		app.Use(metrics.MetricsMiddleware())
	}

	// CORS middleware
	app.Use(middleware.CORSMiddleware(middleware.CORSConfig{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowCredentials: true,
	}))

	// Compression middleware
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
	}))

	// Rate limiting middleware (skip for health/metrics)
	if cfg.RateLimitEnabled {
		app.Use(middleware.RateLimitMiddleware(middleware.RateLimitConfig{
			RedisClient:     redisClient,
			RequestsPerMin:  cfg.RateLimitPerMin,
			RequestsPerHour: cfg.RateLimitPerHour,
			SkipPaths:       []string{"/health", "/metrics", "/ready"},
		}))
	}

	log.Info().Msg("Middleware stack configured")
}

// setupRoutes configures all application routes
func setupRoutes(app *fiber.App, cfg *config.Config, db *gorm.DB, redisClient *redis.Client) {
	// Health check endpoints (no auth required)
	app.Get("/health", handlers.HealthCheck(db, redisClient))
	app.Get("/ready", handlers.ReadinessCheck(db, redisClient))
	app.Get("/version", handlers.VersionInfo(cfg))

	// Prometheus metrics endpoint
	if cfg.EnableMetrics {
		app.Get("/metrics", func(c *fiber.Ctx) error {
			handler := fasthttpadaptor.NewFastHTTPHandler(promhttp.Handler())
			handler(c.Context())
			return nil
		})
	}

	// API v1 routes
	v1 := app.Group("/api/v1")

	// Public routes (no auth)
	setupPublicRoutes(v1, cfg, db, redisClient)

	// Protected routes (auth required)
	authMiddleware := middleware.AuthMiddleware(middleware.AuthConfig{
		JWTSecret:   cfg.JWTSecret,
		TokenLookup: "header:Authorization",
		TokenPrefix: "Bearer ",
		SkipPaths:   []string{"/api/v1/auth/login", "/api/v1/auth/register"},
	})

	setupProtectedRoutes(v1, authMiddleware, cfg, db, redisClient)

	log.Info().Msg("Routes configured")
}

// setupPublicRoutes configures public API routes
func setupPublicRoutes(router fiber.Router, cfg *config.Config, db *gorm.DB, redisClient *redis.Client) {
	// Auth endpoints
	auth := router.Group("/auth")
	auth.Post("/login", handlers.Login(cfg, db))
	auth.Post("/register", handlers.Register(cfg, db))
	auth.Post("/refresh", handlers.RefreshToken(cfg))

	// Rust FFI test endpoints (public for benchmarking)
	if cfg.EnableRustFFI {
		rust := router.Group("/rust")
		rust.Get("/add", handlers.RustAdd())
		rust.Get("/hello", handlers.RustHello())
	}

	// Python ML test endpoints (public for benchmarking)
	if cfg.EnableMLService {
		ml := router.Group("/ml")
		ml.Post("/predict", handlers.MLPredict(cfg))
	}

	// Hybrid test endpoint
	router.Get("/test/hybrid", handlers.HybridTest(cfg))
}

// setupProtectedRoutes configures protected API routes (auth required)
func setupProtectedRoutes(router fiber.Router, authMiddleware fiber.Handler, cfg *config.Config, db *gorm.DB, redisClient *redis.Client) {
	// Apply auth middleware to all protected routes
	protected := router.Group("", authMiddleware)

	// User endpoints
	users := protected.Group("/users")
	users.Get("/me", handlers.GetCurrentUser(db))
	users.Put("/me", handlers.UpdateCurrentUser(db))

	// Admin endpoints (require admin role)
	adminMiddleware := middleware.AuthMiddleware(middleware.AuthConfig{
		JWTSecret:     cfg.JWTSecret,
		TokenLookup:   "header:Authorization",
		TokenPrefix:   "Bearer ",
		RequiredRoles: []string{"admin"},
	})

	admin := protected.Group("/admin", adminMiddleware)
	admin.Get("/users", handlers.ListUsers(db))
	admin.Get("/system/stats", handlers.SystemStats())

	// More endpoints to be migrated here...
}

// initRedis initializes Redis client
func initRedis(cfg *config.Config) *redis.Client {
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to parse Redis URL")
	}

	if cfg.RedisPassword != "" {
		opt.Password = cfg.RedisPassword
	}
	opt.DB = cfg.RedisDB

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Warn().Err(err).Msg("Redis connection failed - rate limiting will be disabled")
	} else {
		log.Info().Msg("Redis connection established")
	}

	return client
}

// initDatabase initializes GORM database connection
func initDatabase(cfg *config.Config) *gorm.DB {
	gormConfig := &gorm.Config{
		Logger: gormLogger.Default.LogMode(gormLogger.Silent),
	}

	if cfg.IsDevelopment() {
		gormConfig.Logger = gormLogger.Default.LogMode(gormLogger.Info)
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), gormConfig)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to get database instance")
	}

	sqlDB.SetMaxOpenConns(cfg.DBMaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.DBMaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.DBConnMaxLifetime)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		log.Fatal().Err(err).Msg("Database ping failed")
	}

	log.Info().
		Int("max_open_conns", cfg.DBMaxOpenConns).
		Int("max_idle_conns", cfg.DBMaxIdleConns).
		Msg("Database connection established")

	return db
}

// gracefulShutdown handles graceful shutdown on interrupt signals
func gracefulShutdown(app *fiber.App, timeout time.Duration) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	<-quit
	log.Info().Msg("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if err := app.ShutdownWithContext(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited gracefully")
}
