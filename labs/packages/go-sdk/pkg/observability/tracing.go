package observability

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

// TracingConfig holds the configuration for tracing
type TracingConfig struct {
	Enabled         bool   `json:"enabled"`
	ServiceName     string `json:"service_name"`
	ServiceVersion  string `json:"service_version"`
	Environment     string `json:"environment"`
	JaegerEndpoint  string `json:"jaeger_endpoint"`
	SamplingRatio   float64 `json:"sampling_ratio"`
}

// Tracer wraps OpenTelemetry tracer with SDK-specific functionality
type Tracer struct {
	tracer      trace.Tracer
	provider    *sdktrace.TracerProvider
	enabled     bool
	serviceName string
}

// NewTracer creates a new tracer instance
func NewTracer(config TracingConfig) (*Tracer, error) {
	if !config.Enabled {
		return &Tracer{
			enabled: false,
		}, nil
	}

	// Create resource
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(config.ServiceName),
			semconv.ServiceVersion(config.ServiceVersion),
			semconv.DeploymentEnvironment(config.Environment),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create Jaeger exporter
	var exporter sdktrace.SpanExporter
	if config.JaegerEndpoint != "" {
		exporter, err = jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(config.JaegerEndpoint)))
		if err != nil {
			return nil, fmt.Errorf("failed to create Jaeger exporter: %w", err)
		}
	} else {
		// Use stdout exporter for development
		exporter, err = jaeger.New(jaeger.WithCollectorEndpoint())
		if err != nil {
			return nil, fmt.Errorf("failed to create Jaeger exporter: %w", err)
		}
	}

	// Set sampling ratio
	samplingRatio := config.SamplingRatio
	if samplingRatio <= 0 || samplingRatio > 1 {
		samplingRatio = 1.0 // Default to always sample
	}

	// Create tracer provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.TraceIDRatioBased(samplingRatio)),
	)

	// Set global tracer provider
	otel.SetTracerProvider(tp)

	// Set global propagator
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Create tracer
	tracer := tp.Tracer("igris-inertial-go-sdk")

	return &Tracer{
		tracer:      tracer,
		provider:    tp,
		enabled:     true,
		serviceName: config.ServiceName,
	}, nil
}

// StartSpan starts a new span with the given name and options
func (t *Tracer) StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	if !t.enabled {
		return ctx, trace.SpanFromContext(ctx)
	}

	return t.tracer.Start(ctx, name, opts...)
}

// StartHTTPClientSpan starts a span for an HTTP client request
func (t *Tracer) StartHTTPClientSpan(ctx context.Context, method, url string) (context.Context, trace.Span) {
	if !t.enabled {
		return ctx, trace.SpanFromContext(ctx)
	}

	ctx, span := t.tracer.Start(ctx, fmt.Sprintf("HTTP %s", method),
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			semconv.HTTPMethod(method),
			semconv.HTTPURL(url),
			attribute.String("component", "http_client"),
		),
	)

	return ctx, span
}

// StartJobSpan starts a span for job processing
func (t *Tracer) StartJobSpan(ctx context.Context, jobID, jobType string) (context.Context, trace.Span) {
	if !t.enabled {
		return ctx, trace.SpanFromContext(ctx)
	}

	ctx, span := t.tracer.Start(ctx, fmt.Sprintf("Job %s", jobType),
		trace.WithSpanKind(trace.SpanKindInternal),
		trace.WithAttributes(
			attribute.String("job.id", jobID),
			attribute.String("job.type", jobType),
			attribute.String("component", "job_processor"),
		),
	)

	return ctx, span
}

// StartAuthSpan starts a span for authentication
func (t *Tracer) StartAuthSpan(ctx context.Context, method string) (context.Context, trace.Span) {
	if !t.enabled {
		return ctx, trace.SpanFromContext(ctx)
	}

	ctx, span := t.tracer.Start(ctx, fmt.Sprintf("Auth %s", method),
		trace.WithSpanKind(trace.SpanKindInternal),
		trace.WithAttributes(
			attribute.String("auth.method", method),
			attribute.String("component", "authentication"),
		),
	)

	return ctx, span
}

// StartDataProcessingSpan starts a span for data processing
func (t *Tracer) StartDataProcessingSpan(ctx context.Context, operation string, recordCount int) (context.Context, trace.Span) {
	if !t.enabled {
		return ctx, trace.SpanFromContext(ctx)
	}

	ctx, span := t.tracer.Start(ctx, fmt.Sprintf("DataProcessing %s", operation),
		trace.WithSpanKind(trace.SpanKindInternal),
		trace.WithAttributes(
			attribute.String("data.operation", operation),
			attribute.Int("data.record_count", recordCount),
			attribute.String("component", "data_processor"),
		),
	)

	return ctx, span
}

// StartMLSpan starts a span for ML operations
func (t *Tracer) StartMLSpan(ctx context.Context, operation, modelID string) (context.Context, trace.Span) {
	if !t.enabled {
		return ctx, trace.SpanFromContext(ctx)
	}

	attrs := []attribute.KeyValue{
		attribute.String("ml.operation", operation),
		attribute.String("component", "ml_pipeline"),
	}
	
	if modelID != "" {
		attrs = append(attrs, attribute.String("ml.model_id", modelID))
	}

	ctx, span := t.tracer.Start(ctx, fmt.Sprintf("ML %s", operation),
		trace.WithSpanKind(trace.SpanKindInternal),
		trace.WithAttributes(attrs...),
	)

	return ctx, span
}

// StartWebSocketSpan starts a span for WebSocket operations
func (t *Tracer) StartWebSocketSpan(ctx context.Context, operation, channel string) (context.Context, trace.Span) {
	if !t.enabled {
		return ctx, trace.SpanFromContext(ctx)
	}

	ctx, span := t.tracer.Start(ctx, fmt.Sprintf("WebSocket %s", operation),
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("websocket.operation", operation),
			attribute.String("websocket.channel", channel),
			attribute.String("component", "websocket"),
		),
	)

	return ctx, span
}

// RecordHTTPResponse records HTTP response information on a span
func (t *Tracer) RecordHTTPResponse(span trace.Span, statusCode int, responseSize int64) {
	if !t.enabled {
		return
	}

	span.SetAttributes(
		semconv.HTTPStatusCode(statusCode),
		semconv.HTTPResponseContentLength(int(responseSize)),
	)

	// Set status based on HTTP status code
	if statusCode >= 400 {
		span.SetStatus(codes.Error, fmt.Sprintf("HTTP %d", statusCode))
	} else {
		span.SetStatus(codes.Ok, "")
	}
}

// RecordError records an error on a span
func (t *Tracer) RecordError(span trace.Span, err error, description string) {
	if !t.enabled {
		return
	}

	span.RecordError(err)
	span.SetStatus(codes.Error, description)
	span.SetAttributes(
		attribute.Bool("error", true),
		attribute.String("error.type", fmt.Sprintf("%T", err)),
	)
}

// RecordJobProgress records job progress on a span
func (t *Tracer) RecordJobProgress(span trace.Span, progress float64, status string) {
	if !t.enabled {
		return
	}

	span.SetAttributes(
		attribute.Float64("job.progress", progress),
		attribute.String("job.status", status),
	)
	
	span.AddEvent("job.progress_update", trace.WithAttributes(
		attribute.Float64("progress", progress),
		attribute.String("status", status),
	))
}

// RecordAuthResult records authentication result on a span
func (t *Tracer) RecordAuthResult(span trace.Span, success bool, userID string) {
	if !t.enabled {
		return
	}

	attrs := []attribute.KeyValue{
		attribute.Bool("auth.success", success),
	}
	
	if userID != "" {
		attrs = append(attrs, attribute.String("auth.user_id", userID))
	}
	
	span.SetAttributes(attrs...)

	if success {
		span.SetStatus(codes.Ok, "Authentication successful")
	} else {
		span.SetStatus(codes.Error, "Authentication failed")
	}
}

// RecordDataProcessingResult records data processing result on a span
func (t *Tracer) RecordDataProcessingResult(span trace.Span, inputRecords, outputRecords int, duration float64) {
	if !t.enabled {
		return
	}

	span.SetAttributes(
		attribute.Int("data.input_records", inputRecords),
		attribute.Int("data.output_records", outputRecords),
		attribute.Float64("data.processing_duration_seconds", duration),
	)

	if outputRecords > 0 {
		successRate := (float64(outputRecords) / float64(inputRecords)) * 100
		span.SetAttributes(attribute.Float64("data.success_rate", successRate))
	}

	span.SetStatus(codes.Ok, "Data processing completed")
}

// RecordMLResult records ML operation result on a span
func (t *Tracer) RecordMLResult(span trace.Span, success bool, accuracy float64, modelSize int64) {
	if !t.enabled {
		return
	}

	attrs := []attribute.KeyValue{
		attribute.Bool("ml.success", success),
	}
	
	if accuracy > 0 {
		attrs = append(attrs, attribute.Float64("ml.accuracy", accuracy))
	}
	
	if modelSize > 0 {
		attrs = append(attrs, attribute.Int64("ml.model_size_bytes", modelSize))
	}
	
	span.SetAttributes(attrs...)

	if success {
		span.SetStatus(codes.Ok, "ML operation completed")
	} else {
		span.SetStatus(codes.Error, "ML operation failed")
	}
}

// AddEvent adds an event to a span
func (t *Tracer) AddEvent(span trace.Span, name string, attributes ...attribute.KeyValue) {
	if !t.enabled {
		return
	}

	span.AddEvent(name, trace.WithAttributes(attributes...))
}

// InjectContext injects the trace context into a carrier
func (t *Tracer) InjectContext(ctx context.Context, carrier propagation.TextMapCarrier) {
	if !t.enabled {
		return
	}

	otel.GetTextMapPropagator().Inject(ctx, carrier)
}

// ExtractContext extracts the trace context from a carrier
func (t *Tracer) ExtractContext(ctx context.Context, carrier propagation.TextMapCarrier) context.Context {
	if !t.enabled {
		return ctx
	}

	return otel.GetTextMapPropagator().Extract(ctx, carrier)
}

// GetTraceID returns the trace ID from the current context
func (t *Tracer) GetTraceID(ctx context.Context) string {
	if !t.enabled {
		return ""
	}

	span := trace.SpanFromContext(ctx)
	if !span.SpanContext().IsValid() {
		return ""
	}

	return span.SpanContext().TraceID().String()
}

// GetSpanID returns the span ID from the current context
func (t *Tracer) GetSpanID(ctx context.Context) string {
	if !t.enabled {
		return ""
	}

	span := trace.SpanFromContext(ctx)
	if !span.SpanContext().IsValid() {
		return ""
	}

	return span.SpanContext().SpanID().String()
}

// Close closes the tracer and flushes any remaining spans
func (t *Tracer) Close(ctx context.Context) error {
	if !t.enabled || t.provider == nil {
		return nil
	}

	return t.provider.Shutdown(ctx)
}

// IsEnabled returns whether tracing is enabled
func (t *Tracer) IsEnabled() bool {
	return t.enabled
}

// GetServiceName returns the service name
func (t *Tracer) GetServiceName() string {
	return t.serviceName
}