package metrics

import (
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/Igris-inertial/system/igris-overture/logging"
)

// MetricsCollector singleton instance
var globalCollector *MetricsCollector

// InitMetricsCollector initializes the global metrics collector
func InitMetricsCollector() *MetricsCollector {
	if globalCollector == nil {
		globalCollector = NewMetricsCollector()
	}
	return globalCollector
}

// GetMetricsCollector returns the global metrics collector
func GetMetricsCollector() *MetricsCollector {
	if globalCollector == nil {
		globalCollector = NewMetricsCollector()
	}
	return globalCollector
}

// InferenceMetricsMiddleware adds trace ID injection and timing for /v1/infer endpoints
func InferenceMetricsMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Only process /v1/infer requests
		if !matchInferPath(c.Path()) {
			return c.Next()
		}

		// Generate trace ID and inject into context
		traceID := uuid.New().String()
		ctx := context.WithValue(c.Context(), logging.TraceIDKey, traceID)

		// Start timing
		startTime := time.Now()

		// Store start time in context for later use
		ctx = context.WithValue(ctx, "inference_start_time", startTime)
		ctx = context.WithValue(ctx, "trace_id", traceID)

		// Replace the fiber context with our enhanced context
		c.SetUserContext(ctx)

		// Process the request
		err := c.Next()

		// Calculate final metrics if not handled by the handler itself
		if c.Locals("metrics_recorded") == nil || !c.Locals("metrics_recorded").(bool) {
			duration := time.Since(startTime).Milliseconds()
			finishInferenceMetrics(c, duration, true, "")
		}

		return err
	}
}

// InferenceMetricsMiddlewareWithCollector creates middleware with a specific collector instance
func InferenceMetricsMiddlewareWithCollector(collector *MetricsCollector) fiber.Handler {
	if collector == nil {
		collector = GetMetricsCollector()
	}

	return func(c *fiber.Ctx) error {
		// Only process /v1/infer requests
		if !matchInferPath(c.Path()) {
			return c.Next()
		}

		// Generate trace ID and inject into context
		traceID := uuid.New().String()
		ctx := context.WithValue(c.Context(), logging.TraceIDKey, traceID)

		// Start timing
		startTime := time.Now()

		// Store start time and collector in context
		ctx = context.WithValue(ctx, "inference_start_time", startTime)
		ctx = context.WithValue(ctx, "metrics_collector", collector)
		ctx = context.WithValue(ctx, "trace_id", traceID)

		// Replace the fiber context with our enhanced context
		c.SetUserContext(ctx)

		// Add trace ID to response headers for debugging
		c.Set("X-Trace-ID", traceID)

		// Process the request
		err := c.Next()

		// Calculate final metrics if not handled by the handler itself
		if c.Locals("metrics_recorded") == nil || !c.Locals("metrics_recorded").(bool) {
			duration := time.Since(startTime).Milliseconds()
			finishInferenceMetrics(c, duration, true, "")
		}

		return err
	}
}

// RecordInferMetrics records detailed inference metrics (called from handlers)
func RecordInferMetrics(c *fiber.Ctx, provider, model string, latencyMs int64, promptTokens, completionTokens, totalTokens int, costUSD float64, success bool, errorMsg string) {
	// Get trace ID from context
	traceID := getTraceID(c)

	// Get tenant ID from context (Phase 4.3.1)
	tenantID := getTenantID(c)

	// Get metrics collector
	collector := getMetricsCollectorFromContext(c)
	if collector == nil {
		collector = GetMetricsCollector()
	}

	// Record in the collector
	collector.RecordInferenceRequest(c.Context(), provider, model, latencyMs, promptTokens, completionTokens, totalTokens, costUSD, success)

	// Phase 4.3.1: Record comprehensive Prometheus metrics
	RecordInferenceRequestMetrics(
		provider,
		model,
		tenantID,
		latencyMs,
		promptTokens,
		completionTokens,
		totalTokens,
		costUSD,
		success,
	)

	// Log structured inference request
	logging.LogInferenceRequest(logging.InferenceFields{
		TraceID:          traceID,
		Provider:         provider,
		Model:            model,
		LatencyMs:        latencyMs,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      totalTokens,
		CostUSD:          costUSD,
		Status:           "success",
		ErrorMessage:     errorMsg,
	})

	// Mark metrics as recorded to avoid double-counting in middleware
	c.Locals("metrics_recorded", true)

	// Store metrics in context for potential downstream use
	c.Locals("provider", provider)
	c.Locals("model", model)
	c.Locals("latency_ms", latencyMs)
	c.Locals("total_tokens", totalTokens)
	c.Locals("cost_usd", costUSD)
	c.Locals("trace_id", traceID)
}

// RecordInferError records an error inference request
func RecordInferError(c *fiber.Ctx, provider, model string, latencyMs int64, errorMsg string) {
	RecordInferMetrics(c, provider, model, latencyMs, 0, 0, 0, 0, false, errorMsg)
}

// GetMetricsFromContext extracts metrics from the current request context
func GetMetricsFromContext(c *fiber.Ctx) (provider, model string, latencyMs int64, totalTokens int, costUSD float64, traceID string) {
	provider = getStringFromLocals(c, "provider")
	model = getStringFromLocals(c, "model")
	latencyMs = getInt64FromLocals(c, "latency_ms")
	totalTokens = getIntFromLocals(c, "total_tokens")
	costUSD = getFloat64FromLocals(c, "cost_usd")
	traceID = getStringFromLocals(c, "trace_id")
	return
}

// TimingMiddleware is a simpler middleware that just adds timing for performance monitoring
func TimingMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process request
		err := c.Next()

		// Record timing for all requests
		duration := time.Since(start).Microseconds()
		
		// Add timing to headers for debugging
		c.Set("X-Response-Time-Duration-Us", fmt.Sprintf("%d", duration))
		c.Set("X-Response-Time-Path", c.Path())
		
		return err
	}
}

// HealthCheckMetrics adds metrics collection to health endpoints
func HealthCheckMetrics() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process request
		err := c.Next()

		// If this is a health endpoint, add health metrics
		if c.Path() == "/v1/health" || c.Path() == "/_health" {
			duration := time.Since(start).Milliseconds()
			c.Set("X-Health-Check-Duration-Ms", fmt.Sprintf("%d", duration))
			c.Set("X-Health-Check-Timestamp", fmt.Sprintf("%d", time.Now().Unix()))
		}

		return err
	}
}

// Helper functions

func matchInferPath(path string) bool {
	return path == "/v1/infer" || path == "/v1/infer/"
}

func getTraceID(c *fiber.Ctx) string {
	if traceID := getStringFromContext(c, "trace_id"); traceID != "" {
		return traceID
	}

	// Fallback to logging context
	ctx := c.Context()
	return logging.GetTraceID(ctx)
}

func getTenantID(c *fiber.Ctx) string {
	// Try to get tenant ID from locals (set by tenant auth middleware)
	if tenantID := getStringFromLocals(c, "tenant_id"); tenantID != "" {
		return tenantID
	}

	// Try to get from context
	if tenantID := getStringFromContext(c, "tenant_id"); tenantID != "" {
		return tenantID
	}

	// Default to "default" for single-tenant mode
	return "default"
}

func getMetricsCollectorFromContext(c *fiber.Ctx) *MetricsCollector {
	if collector, ok := c.Context().Value("metrics_collector").(*MetricsCollector); ok {
		return collector
	}
	return nil
}

func getStringFromContext(c *fiber.Ctx, key string) string {
	if val, ok := c.Context().Value(key).(string); ok {
		return val
	}
	return ""
}

func getStringFromLocals(c *fiber.Ctx, key string) string {
	if val := c.Locals(key); val != nil {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func getInt64FromLocals(c *fiber.Ctx, key string) int64 {
	if val := c.Locals(key); val != nil {
		if i, ok := val.(int64); ok {
			return i
		}
	}
	return 0
}

func getIntFromLocals(c *fiber.Ctx, key string) int {
	if val := c.Locals(key); val != nil {
		if i, ok := val.(int); ok {
			return i
		}
	}
	return 0
}

func getFloat64FromLocals(c *fiber.Ctx, key string) float64 {
	if val := c.Locals(key); val != nil {
		if f, ok := val.(float64); ok {
			return f
		}
	}
	return 0
}

func finishInferenceMetrics(c *fiber.Ctx, latencyMs int64, success bool, errorMsg string) {
	traceID := getTraceID(c)
	
	// Extract provider/model from locals if available
	provider := getStringFromLocals(c, "provider")
	model := getStringFromLocals(c, "model")
	
	// If provider/model not available, use defaults for middleware-only metrics
	if provider == "" {
		provider = "unknown"
	}
	if model == "" {
		model = "unknown"
	}

	// Get metrics collector
	collector := getMetricsCollectorFromContext(c)
	if collector == nil {
		collector = GetMetricsCollector()
	}

	// Record metrics
	collector.RecordInferenceRequest(c.Context(), provider, model, latencyMs, 0, 0, 0, 0, success)

	// Log simplified error if this is just middleware fallback
	if !success && errorMsg != "" {
		logging.LogError(c.Context(), fiber.NewError(fiber.StatusInternalServerError, errorMsg), "inference_middleware_error", map[string]interface{}{
			"trace_id":   traceID,
			"provider":   provider,
			"model":      model,
			"latency_ms": latencyMs,
		})
	}
}
