package tracing

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/Igris-inertial/system/igris-overture/logging"
)

// TraceContext contains trace information for request tracking
type TraceContext struct {
	TraceID       string                 `json:"trace_id"`
	SpanID        string                 `json:"span_id"`
	ParentSpanID  string                 `json:"parent_span_id,omitempty"`
	SpanName      string                 `json:"span_name"`
	SampleRate    float64                `json:"sample_rate"`
	StartTime     time.Time              `json:"start_time"`
	Attributes    map[string]interface{} `json:"attributes,omitempty"`
	SpanStack     []*TraceContext        `json:"-"`
}

// Tracer handles simple trace context generation and propagation
type Tracer struct {
	serviceName string
	sampleRate  float64
}

// NewTracer creates a new simple tracer instance
func NewTracer(serviceName string, sampleRate float64) *Tracer {
	if sampleRate <= 0 {
		sampleRate = 1.0 // Default to 100% sampling for MVP
	}
	return &Tracer{
		serviceName: serviceName,
		sampleRate:  sampleRate,
	}
}

// GenerateTraceID creates a new unique trace ID
func (t *Tracer) GenerateTraceID() string {
	return uuid.New().String()
}

// GenerateSpanID creates a new unique span ID
func (t *Tracer) GenerateSpanID() string {
	return uuid.New().String()
}

// StartTrace begins a new trace and injects it into the context
func (t *Tracer) StartTrace(ctx context.Context, spanName string) (context.Context, *TraceContext) {
	return t.StartTraceWithParent(ctx, spanName, "")
}

// StartTraceWithParent begins a new trace with a parent span
func (t *Tracer) StartTraceWithParent(ctx context.Context, spanName, parentSpanID string) (context.Context, *TraceContext) {
	traceCtx := &TraceContext{
		TraceID:    t.GenerateTraceID(),
		SpanID:     t.GenerateSpanID(),
		ParentSpanID: parentSpanID,
		SpanName:   spanName,
		SampleRate: t.sampleRate,
		StartTime:  time.Now(),
		Attributes: make(map[string]interface{}),
		SpanStack:  []*TraceContext{},
	}

	// Add service name as attribute
	traceCtx.Attributes["service"] = t.serviceName

	// Inject trace ID into context for logging
	ctx = context.WithValue(ctx, logging.TraceIDKey, traceCtx.TraceID)
	ctx = context.WithValue(ctx, "tracing_context", traceCtx)

	return ctx, traceCtx
}

// StartSpan begins a new span within an existing trace
func (t *Tracer) StartSpan(ctx context.Context, spanName string) (context.Context, *TraceContext) {
	return t.StartSpanWithAttributes(ctx, spanName, nil)
}

// StartSpanWithAttributes begins a new span with initial attributes
func (t *Tracer) StartSpanWithAttributes(ctx context.Context, spanName string, attrs map[string]interface{}) (context.Context, *TraceContext) {
	// Get existing trace context
	parentTraceCtx, ok := ctx.Value("tracing_context").(*TraceContext)
	if !ok {
		// No existing trace, start a new one
		return t.StartTrace(ctx, spanName)
	}

	// Create new span as child of parent
	spanCtx := &TraceContext{
		TraceID:     parentTraceCtx.TraceID, // Same trace ID
		SpanID:      t.GenerateSpanID(),
		ParentSpanID: parentTraceCtx.SpanID,
		SpanName:    spanName,
		SampleRate:  t.sampleRate,
		StartTime:   time.Now(),
		Attributes:  make(map[string]interface{}),
		SpanStack:   append([]*TraceContext{parentTraceCtx}, parentTraceCtx.SpanStack...),
	}

	// Copy service name
	spanCtx.Attributes["service"] = t.serviceName

	// Add provided attributes
	for k, v := range attrs {
		spanCtx.Attributes[k] = v
	}

	// Update context
	ctx = context.WithValue(ctx, logging.TraceIDKey, spanCtx.TraceID)
	ctx = context.WithValue(ctx, "tracing_context", spanCtx)

	return ctx, spanCtx
}

// FinishSpan completes a span and records metrics
func (t *Tracer) FinishSpan(ctx context.Context, spanCtx *TraceContext, err error) {
	if spanCtx == nil {
		return
	}

	duration := time.Since(spanCtx.StartTime)

	// Add duration as attribute
	spanCtx.Attributes["duration_ms"] = duration.Milliseconds()
	spanCtx.Attributes["duration_ns"] = duration.Nanoseconds()

	// Add error information if present
	if err != nil {
		spanCtx.Attributes["error"] = err.Error()
		spanCtx.Attributes["error_type"] = "error"
	} else {
		spanCtx.Attributes["error_type"] = "none"
	}

	// Log span completion with structured data
	logging.LogInfo(ctx, "span_completed", map[string]interface{}{
		"span_name":   spanCtx.SpanName,
		"span_id":     spanCtx.SpanID,
		"duration_ms": duration.Milliseconds(),
		"attributes":  spanCtx.Attributes,
	})
}

// GetTraceID extracts trace ID from context
func (t *Tracer) GetTraceID(ctx context.Context) string {
	// Try tracing context first
	if traceCtx, ok := ctx.Value("tracing_context").(*TraceContext); ok {
		return traceCtx.TraceID
	}
	
	// Fallback to logging context
	return logging.GetTraceID(ctx)
}

// GetCurrentSpan extracts current span context from context
func (t *Tracer) GetCurrentSpan(ctx context.Context) *TraceContext {
	if traceCtx, ok := ctx.Value("tracing_context").(*TraceContext); ok {
		return traceCtx
	}
	return nil
}

// AddAttribute adds an attribute to the current span
func (t *Tracer) AddAttribute(ctx context.Context, key string, value interface{}) {
	spanCtx := t.GetCurrentSpan(ctx)
	if spanCtx != nil && spanCtx.Attributes != nil {
		spanCtx.Attributes[key] = value
	}
}

// AddAttributes adds multiple attributes to the current span
func (t *Tracer) AddAttributes(ctx context.Context, attrs map[string]interface{}) {
	spanCtx := t.GetCurrentSpan(ctx)
	if spanCtx != nil && spanCtx.Attributes != nil {
		for k, v := range attrs {
			spanCtx.Attributes[k] = v
		}
	}
}

// AddError records an error in the current span
func (t *Tracer) AddError(ctx context.Context, err error) {
	t.AddAttribute(ctx, "error", err.Error())
	t.AddAttribute(ctx, "error_type", "error")
}

// TraceHTTPRequest adds HTTP request attributes to the current span
func (t *Tracer) TraceHTTPRequest(ctx context.Context, method, path, userAgent string, headers map[string][]string, contentLength int64) {
	attrs := map[string]interface{}{
		"http.method":        method,
		"http.path":          path,
		"http.user_agent":    userAgent,
		"http.content_length": contentLength,
	}

	// Add useful headers
	usefulHeaders := []string{"x-forwarded-for", "x-request-id", "x-api-key", "authorization"}
	for _, header := range usefulHeaders {
		if values, ok := headers[header]; ok && len(values) > 0 {
			if header == "authorization" || header == "x-api-key" {
				attrs["http."+header] = "[REDACTED]"
			} else {
				attrs["http."+header] = values[0]
			}
		}
	}

	t.AddAttributes(ctx, attrs)
}

// TraceInferenceRequest adds inference-specific attributes to the current span
func (t *Tracer) TraceInferenceRequest(ctx context.Context, provider, model string, messageCount int, stream bool) {
	attrs := map[string]interface{}{
		"inference.provider":      provider,
		"inference.model":         model,
		"inference.message_count": messageCount,
		"inference.stream":        stream,
	}

	t.AddAttributes(ctx, attrs)
}

// TraceInferenceResponse adds inference response attributes to the current span
func (t *Tracer) TraceInferenceResponse(ctx context.Context, latencyMs int64, promptTokens, completionTokens, totalTokens int, costUSD float64, success bool) {
	attrs := map[string]interface{}{
		"inference.latency_ms":         latencyMs,
		"inference.prompt_tokens":      promptTokens,
		"inference.completion_tokens":  completionTokens,
		"inference.total_tokens":       totalTokens,
		"inference.cost_usd":           costUSD,
		"inference.success":            success,
	}

	t.AddAttributes(ctx, attrs)
}

// HTTP middleware for automatic trace propagation
func (t *Tracer) HTTPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Start new span for this HTTP request
		spanName := r.Method + " " + r.URL.Path
		ctx, spanCtx := t.StartTrace(ctx, spanName)

		// Add HTTP request attributes
		t.TraceHTTPRequest(ctx, r.Method, r.URL.Path, r.UserAgent(), r.Header, r.ContentLength)

		// Add trace ID to response headers for debugging
		w.Header().Set("X-Trace-ID", spanCtx.TraceID)

		// Wrap response writer to capture status code
		wrapped := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK, // Default status
		}

		// Process request
		next.ServeHTTP(wrapped, r.WithContext(ctx))

		// Add response attributes
		t.AddAttribute(ctx, "http.status_code", wrapped.statusCode)
		t.AddAttribute(ctx, "http.response_size", wrapped.size)

		// Finish the span
		t.FinishSpan(ctx, spanCtx, nil)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code and size
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	size       int
}

func (rw *responseWriter) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.ResponseWriter.WriteHeader(statusCode)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.size += n
	return n, err
}

// Global tracer instance
var defaultTracer *Tracer

// InitGlobalTracer initializes the global tracer
func InitGlobalTracer(serviceName string, sampleRate float64) *Tracer {
	defaultTracer = NewTracer(serviceName, sampleRate)
	return defaultTracer
}

// GetGlobalTracer returns the global tracer instance
func GetGlobalTracer() *Tracer {
	if defaultTracer == nil {
		defaultTracer = NewTracer("igris-inertial", 1.0)
	}
	return defaultTracer
}

// Convenience functions using global tracer

func StartTrace(ctx context.Context, spanName string) (context.Context, *TraceContext) {
	return GetGlobalTracer().StartTrace(ctx, spanName)
}

func StartSpan(ctx context.Context, spanName string) (context.Context, *TraceContext) {
	return GetGlobalTracer().StartSpan(ctx, spanName)
}

func FinishSpan(ctx context.Context, spanCtx *TraceContext, err error) {
	GetGlobalTracer().FinishSpan(ctx, spanCtx, err)
}

func GetTraceID(ctx context.Context) string {
	return GetGlobalTracer().GetTraceID(ctx)
}

func AddAttribute(ctx context.Context, key string, value interface{}) {
	GetGlobalTracer().AddAttribute(ctx, key, value)
}

func TraceInferenceRequest(ctx context.Context, provider, model string, messageCount int, stream bool) {
	GetGlobalTracer().TraceInferenceRequest(ctx, provider, model, messageCount, stream)
}

func TraceInferenceResponse(ctx context.Context, latencyMs int64, promptTokens, completionTokens, totalTokens int, costUSD float64, success bool) {
	GetGlobalTracer().TraceInferenceResponse(ctx, latencyMs, promptTokens, completionTokens, totalTokens, costUSD, success)
}
