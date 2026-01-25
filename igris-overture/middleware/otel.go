package middleware

import (
	"github.com/gofiber/fiber/v2"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

const (
	tracerKey  = "otel-tracer"
	tracerName = "github.com/Igris-inertial/system"
)

// OTelConfig holds configuration for OpenTelemetry middleware
type OTelConfig struct {
	// Skip defines a function to skip middleware execution
	Skip func(*fiber.Ctx) bool

	// TracerProvider provides the tracer to use (defaults to global)
	TracerProvider trace.TracerProvider

	// Propagator defines the propagation format to use (defaults to composite)
	Propagator propagation.TextMapPropagator

	// SpanNameFormatter defines how to format span names
	SpanNameFormatter func(*fiber.Ctx) string

	// CustomAttributes adds custom attributes to spans
	CustomAttributes func(*fiber.Ctx) []attribute.KeyValue
}

// ConfigDefault is the default config
var ConfigDefault = OTelConfig{
	Skip:           nil,
	TracerProvider: nil,
	Propagator:     nil,
	SpanNameFormatter: func(c *fiber.Ctx) string {
		return c.Method() + " " + c.Path()
	},
	CustomAttributes: nil,
}

// Helper function to set default values
func configDefault(config ...OTelConfig) OTelConfig {
	if len(config) < 1 {
		return ConfigDefault
	}

	cfg := config[0]

	if cfg.Skip == nil {
		cfg.Skip = ConfigDefault.Skip
	}

	if cfg.TracerProvider == nil {
		cfg.TracerProvider = otel.GetTracerProvider()
	}

	if cfg.Propagator == nil {
		cfg.Propagator = otel.GetTextMapPropagator()
	}

	if cfg.SpanNameFormatter == nil {
		cfg.SpanNameFormatter = ConfigDefault.SpanNameFormatter
	}

	if cfg.CustomAttributes == nil {
		cfg.CustomAttributes = ConfigDefault.CustomAttributes
	}

	return cfg
}

// OpenTelemetry returns a Fiber middleware for OpenTelemetry tracing
func OpenTelemetry(config ...OTelConfig) fiber.Handler {
	cfg := configDefault(config...)

	tracer := cfg.TracerProvider.Tracer(
		tracerName,
		trace.WithInstrumentationVersion("v1.0.0"),
	)

	return func(c *fiber.Ctx) error {
		// Skip if configured
		if cfg.Skip != nil && cfg.Skip(c) {
			return c.Next()
		}

		// Extract trace context from headers
		ctx := cfg.Propagator.Extract(c.Context(), &fiberCarrier{c: c})

		// Generate span name
		spanName := cfg.SpanNameFormatter(c)

		// Start span
		opts := []trace.SpanStartOption{
			trace.WithAttributes(httpServerAttributes(c)...),
			trace.WithSpanKind(trace.SpanKindServer),
		}

		ctx, span := tracer.Start(ctx, spanName, opts...)
		defer span.End()

		// Set context for downstream handlers
		c.SetUserContext(ctx)

		// Add trace ID to response headers for debugging
		if span.SpanContext().IsValid() {
			c.Set("X-Trace-ID", span.SpanContext().TraceID().String())
			c.Set("X-Span-ID", span.SpanContext().SpanID().String())
		}

		// Add custom attributes if configured
		if cfg.CustomAttributes != nil {
			customAttrs := cfg.CustomAttributes(c)
			if len(customAttrs) > 0 {
				span.SetAttributes(customAttrs...)
			}
		}

		// Execute request
		err := c.Next()

		// Record response status
		span.SetAttributes(
			attribute.Int("http.status_code", c.Response().StatusCode()),
			attribute.Int("http.response.size", len(c.Response().Body())),
		)

		// Set span status based on HTTP status code
		statusCode := c.Response().StatusCode()
		if statusCode >= 500 {
			span.SetStatus(codes.Error, fiber.ErrInternalServerError.Message)
		} else if statusCode >= 400 {
			span.SetStatus(codes.Error, "Client error")
		} else {
			span.SetStatus(codes.Ok, "")
		}

		// Record error if present
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}

		return err
	}
}

// httpServerAttributes returns standard HTTP server attributes for a request
func httpServerAttributes(c *fiber.Ctx) []attribute.KeyValue {
	attrs := []attribute.KeyValue{
		attribute.String("http.method", c.Method()),
		attribute.String("http.target", string(c.Request().RequestURI())),
		attribute.String("http.route", c.Route().Path),
		attribute.String("http.scheme", c.Protocol()),
		attribute.String("http.host", c.Hostname()),
		attribute.String("http.user_agent", c.Get("User-Agent")),
		attribute.String("http.client_ip", c.IP()),
		attribute.Int64("http.request.size", int64(len(c.Request().Body()))),
	}

	// Add request ID if present
	if requestID := c.Get("X-Request-ID"); requestID != "" {
		attrs = append(attrs, attribute.String("http.request_id", requestID))
	}

	// Add tenant ID if present (from multi-tenancy middleware)
	if tenantID := c.Locals("tenant_id"); tenantID != nil {
		if tid, ok := tenantID.(string); ok {
			attrs = append(attrs, attribute.String("tenant.id", tid))
		}
	}

	// Add API key reference (hashed, not actual key)
	if apiKey := c.Get("X-API-Key"); apiKey != "" && len(apiKey) >= 8 {
		attrs = append(attrs, attribute.String("auth.api_key_prefix", apiKey[:8]+"..."))
	}

	return attrs
}

// fiberCarrier adapts Fiber context to OpenTelemetry TextMapCarrier
type fiberCarrier struct {
	c *fiber.Ctx
}

// Get returns the value associated with the passed key
func (fc *fiberCarrier) Get(key string) string {
	return fc.c.Get(key)
}

// Set stores the key-value pair
func (fc *fiberCarrier) Set(key, value string) {
	fc.c.Set(key, value)
}

// Keys lists the keys stored in this carrier
func (fc *fiberCarrier) Keys() []string {
	keys := make([]string, 0)
	fc.c.Request().Header.VisitAll(func(key, _ []byte) {
		keys = append(keys, string(key))
	})
	return keys
}

// InferenceSpanAttributes returns standard attributes for inference operations
func InferenceSpanAttributes(provider, model string, stream bool, messageCount int) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String("inference.provider", provider),
		attribute.String("inference.model", model),
		attribute.Bool("inference.stream", stream),
		attribute.Int("inference.message_count", messageCount),
	}
}

// InferenceResponseAttributes returns attributes for inference responses
func InferenceResponseAttributes(latencyMs int64, promptTokens, completionTokens, totalTokens int, costUSD float64, success bool) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.Int64("inference.latency_ms", latencyMs),
		attribute.Int("inference.tokens.prompt", promptTokens),
		attribute.Int("inference.tokens.completion", completionTokens),
		attribute.Int("inference.tokens.total", totalTokens),
		attribute.Float64("inference.cost_usd", costUSD),
		attribute.Bool("inference.success", success),
	}
}

// OptimizerSpanAttributes returns attributes for optimizer operations
func OptimizerSpanAttributes(algorithm string, providersCount int, decision string) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String("optimizer.algorithm", algorithm),
		attribute.Int("optimizer.providers_count", providersCount),
		attribute.String("optimizer.decision", decision),
	}
}

// CacheSpanAttributes returns attributes for cache operations
func CacheSpanAttributes(operation string, hit bool, key string) []attribute.KeyValue {
	attrs := []attribute.KeyValue{
		attribute.String("cache.operation", operation),
		attribute.Bool("cache.hit", hit),
	}

	// Only include key prefix for security
	if len(key) > 8 {
		attrs = append(attrs, attribute.String("cache.key_prefix", key[:8]+"..."))
	}

	return attrs
}

// DatabaseSpanAttributes returns attributes for database operations
func DatabaseSpanAttributes(operation, table string, rowCount int) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String("db.operation", operation),
		attribute.String("db.table", table),
		attribute.Int("db.row_count", rowCount),
	}
}
