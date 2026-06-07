package api

import (
	"log"

	"github.com/Igris-inertial/system/igris-overture/database"
	"github.com/Igris-inertial/system/igris-overture/metrics"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/tracing"
	"github.com/gofiber/adaptor/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// RegisterMetricsRoutes registers metrics and telemetry endpoints
func RegisterMetricsRoutes(app *fiber.App) error {
	log.Println("[Routes] Registering metrics endpoints...")

	// Initialize metrics collector if not already done
	metrics.InitMetricsCollector()

	// Prometheus metrics endpoint
	// Exposes metrics in Prometheus format
	app.Get("/metrics", func(c *fiber.Ctx) error {
		return adaptor.HTTPHandler(promhttp.Handler())(c)
	})
	log.Println("[Routes] ✓ GET /metrics (Prometheus metrics)")

	// Igris-engine specific aggregated metrics endpoint
	// Returns JSON with provider statistics and aggregated metrics
	app.Get("/v1/metrics", func(c *fiber.Ctx) error {
		// Start trace for metrics request
		fiberCtx := c.UserContext()
		ctx, traceCtx := tracing.StartSpan(fiberCtx, "metrics_request")
		defer tracing.FinishSpan(ctx, traceCtx, nil)

		// Get metrics collector
		collector := metrics.GetMetricsCollector()

		// Get aggregated metrics
		providerMetrics := collector.GetProviderMetrics()
		topProviders := collector.GetTopProviders(10)

		// Add trace ID to response
		c.Set("X-Trace-ID", traceCtx.TraceID)

		return c.JSON(fiber.Map{
			"provider_metrics": providerMetrics,
			"top_providers":    topProviders,
			"timestamp":        traceCtx.StartTime.Unix(),
			"trace_id":         traceCtx.TraceID,
		})
	})
	log.Println("[Routes] ✓ GET /v1/metrics (Aggregated metrics)")

	// Metrics health check endpoint
	// Verifies metrics collection is working
	app.Get("/v1/metrics/health", func(c *fiber.Ctx) error {
		// Start trace for metrics health check
		fiberCtx := c.UserContext()
		ctx, traceCtx := tracing.StartSpan(fiberCtx, "metrics_health")
		defer tracing.FinishSpan(ctx, traceCtx, nil)

		collector := metrics.GetMetricsCollector()

		// Basic health indicators
		health := fiber.Map{
			"status":                "healthy",
			"collector_initialized": true,
			"total_providers":       len(collector.GetProviderMetrics()),
			"timestamp":             traceCtx.StartTime.Unix(),
			"trace_id":              traceCtx.TraceID,
		}

		// Add trace ID to response
		c.Set("X-Trace-ID", traceCtx.TraceID)

		return c.JSON(health)
	})
	log.Println("[Routes] ✓ GET /v1/metrics/health (Metrics health)")

	// Metrics debug endpoint
	// Returns detailed debug information about metrics collection
	app.Get("/v1/metrics/debug", func(c *fiber.Ctx) error {
		// Start trace for metrics debug request
		fiberCtx := c.UserContext()
		ctx, traceCtx := tracing.StartSpan(fiberCtx, "metrics_debug")
		defer tracing.FinishSpan(ctx, traceCtx, nil)

		collector := metrics.GetMetricsCollector()

		// Debug information
		debug := fiber.Map{
			"collector_memory_info": fiber.Map{
				"provider_count":   len(collector.GetProviderMetrics()),
				"sample_retention": collector.GetMaxLatencySamples(),
			},
			"trace_info": fiber.Map{
				"trace_id":   traceCtx.TraceID,
				"span_id":    traceCtx.SpanID,
				"span_name":  traceCtx.SpanName,
				"start_time": traceCtx.StartTime,
				"attributes": traceCtx.Attributes,
			},
			"request_info": fiber.Map{
				"path":       c.Path(),
				"method":     c.Method(),
				"user_agent": c.Get("User-Agent"),
				"ip":         c.IP(),
			},
			"timestamp": traceCtx.StartTime.Unix(),
		}

		// Add trace ID to response
		c.Set("X-Trace-ID", traceCtx.TraceID)

		return c.JSON(debug)
	})
	log.Println("[Routes] ✓ GET /v1/metrics/debug (Metrics debug)")

	log.Println("[Routes] All metrics routes registered successfully")
	return nil
}

// RegisterAllRoutes registers optional model and debug routes.
// Phase 2: Now accepts optional tenant auth middleware and database for inference endpoints
func RegisterAllRoutes(app *fiber.App, tenantAuth interface{}, db interface{}) error {
	// Type assert tenant auth middleware (can be nil for backward compatibility)
	var ta *middleware.TenantAuth
	if tenantAuth != nil {
		if auth, ok := tenantAuth.(*middleware.TenantAuth); ok {
			ta = auth
		}
	}

	// Type assert database (can be nil for backward compatibility)
	var dbInstance *database.DB
	if db != nil {
		if dbVal, ok := db.(*database.DB); ok {
			dbInstance = dbVal
		}
	}

	if ExperimentalModelRoutesEnabled() {
		if err := RegisterInferRoutes(app, ta, dbInstance); err != nil {
			return err
		}
	} else {
		log.Printf("[Routes] Experimental model routes disabled (%s not enabled)", ExperimentalModelRoutesFlag)
	}

	if DebugMetricsRoutesEnabled() {
		if err := RegisterMetricsRoutes(app); err != nil {
			return err
		}
	} else {
		log.Printf("[Routes] Debug metrics routes disabled (%s not enabled)", DebugMetricsRoutesFlag)
	}

	// Note: Multi-tenancy routes are registered separately via SetupMultiTenancy
	// in main.go when ENABLE_MULTI_TENANCY=true

	return nil
}

// InitializeMetricsMiddleware initializes global metrics middleware for the app
func InitializeMetricsMiddleware(app *fiber.App) {
	// Add inference metrics middleware
	app.Use(metrics.InferenceMetricsMiddleware())

	// Add global timing middleware
	app.Use(metrics.TimingMiddleware())

	log.Println("[Middleware] ✓ Metrics middleware initialized")
}
