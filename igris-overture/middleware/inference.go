package middleware

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/Igris-inertial/system/igris-overture/logging"
	"github.com/Igris-inertial/system/igris-overture/observability"
)

// InferenceMetrics is a middleware that tracks metrics and adds trace IDs for /v1/infer requests
func InferenceMetrics() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Only track metrics for /v1/infer and /v1/chat/completions endpoints
		path := c.Path()
		if path != "/v1/infer" && path != "/v1/chat/completions" {
			return c.Next()
		}

		// Generate trace ID
		traceID := uuid.New().String()

		// Attach trace ID to context
		ctx := context.WithValue(c.Context(), logging.TraceIDKey, traceID)
		c.SetUserContext(ctx)

		// Add trace ID to response headers for debugging
		c.Set("X-Trace-ID", traceID)

		// Start timer
		startTime := time.Now()

		// Process request
		err := c.Next()

		// Calculate latency
		latencyMs := time.Since(startTime).Milliseconds()

		// Extract provider and model from response (if available)
		// This is a best-effort extraction - we'll get more detailed metrics from the handler
		provider := c.Locals("provider")
		model := c.Locals("model")

		// Record basic latency metric if we have the information
		if provider != nil && model != nil {
			observability.RecordInferLatency(
				provider.(string),
				model.(string),
				latencyMs,
			)
		}

		// Log basic request info
		status := c.Response().StatusCode()
		logging.LogInfo(ctx, "inference_request", map[string]interface{}{
			"method":     c.Method(),
			"path":       path,
			"status":     status,
			"latency_ms": latencyMs,
		})

		return err
	}
}

// RequestLogger is a structured logging middleware
func RequestLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		startTime := time.Now()

		// Process request
		err := c.Next()

		// Log request
		latency := time.Since(startTime)
		logging.Logger().Info().
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", c.Response().StatusCode()).
			Dur("latency", latency).
			Str("ip", c.IP()).
			Str("user_agent", c.Get("User-Agent")).
			Msg("http_request")

		return err
	}
}

// TraceID is a middleware that injects trace IDs into all requests
func TraceID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check if trace ID already exists in headers
		traceID := c.Get("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}

		// Attach trace ID to context
		ctx := context.WithValue(c.Context(), logging.TraceIDKey, traceID)
		c.SetUserContext(ctx)

		// Add trace ID to response headers
		c.Set("X-Trace-ID", traceID)

		return c.Next()
	}
}
