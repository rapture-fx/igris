package observability

import (
	"context"
	"log"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"go.opentelemetry.io/otel/trace"
)

var tracer trace.Tracer

// InitTracing initializes OpenTelemetry tracing with Jaeger
func InitTracing(serviceName string) func() {
	// Get Jaeger endpoint from environment
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "http://jaeger:14268/api/traces"
	}

	// Create Jaeger exporter
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(jaegerEndpoint)))
	if err != nil {
		log.Printf("WARNING: Failed to create Jaeger exporter: %v (tracing disabled)", err)
		return func() {}
	}

	// Create trace provider
	tp := tracesdk.NewTracerProvider(
		tracesdk.WithBatcher(exp),
		tracesdk.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
			attribute.String("environment", getEnv("ENVIRONMENT", "development")),
		)),
	)

	otel.SetTracerProvider(tp)
	tracer = tp.Tracer(serviceName)

	log.Printf("✅ Tracing initialized (Jaeger endpoint: %s)", jaegerEndpoint)

	// Return shutdown function
	return func() {
		if err := tp.Shutdown(context.Background()); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}
}

// StartSpan creates a new span
func StartSpan(ctx context.Context, spanName string) (context.Context, trace.Span) {
	if tracer == nil {
		// Return no-op span if tracing not initialized
		return ctx, trace.SpanFromContext(ctx)
	}
	return tracer.Start(ctx, spanName)
}

// AddSpanAttributes adds attributes to the current span
func AddSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attrs...)
}

// RecordError records an error in the current span
func RecordError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	span.RecordError(err)
}

// MarkSpanAsWinner marks a span as the winner of a speculative race
func MarkSpanAsWinner(ctx context.Context, winner bool) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attribute.Bool("speculative.winner", winner))
}

// AddSpeculativeAttributes adds speculative execution attributes to a span
func AddSpeculativeAttributes(ctx context.Context, mode, providerID string, racePosition int) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(
		attribute.String("speculative.mode", mode),
		attribute.String("speculative.provider_id", providerID),
		attribute.Int("speculative.race_position", racePosition),
	)
}

// AddSpeculativeRaceMetrics adds race result metrics to a span
func AddSpeculativeRaceMetrics(ctx context.Context, firstTokenLatencyMs int64, tokensGenerated, tokenPosition int) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(
		attribute.Int64("speculative.first_token_latency_ms", firstTokenLatencyMs),
		attribute.Int("speculative.tokens_generated", tokensGenerated),
		attribute.Int("speculative.token_position", tokenPosition),
	)
}

// AddSwitchMetadata adds mid-stream switch metadata to a span
func AddSwitchMetadata(ctx context.Context, switched bool, switchTokenNumber int, fromProvider, toProvider string) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(
		attribute.Bool("speculative.switched", switched),
		attribute.Int("speculative.switch_token_number", switchTokenNumber),
		attribute.String("speculative.from_provider", fromProvider),
		attribute.String("speculative.to_provider", toProvider),
	)
}

// AddQualityScoreAttributes adds quality scoring attributes to a span
func AddQualityScoreAttributes(ctx context.Context, latencyScore, qualityScore, costScore, compositeScore float64) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(
		attribute.Float64("speculative.score.latency", latencyScore),
		attribute.Float64("speculative.score.quality", qualityScore),
		attribute.Float64("speculative.score.cost", costScore),
		attribute.Float64("speculative.score.composite", compositeScore),
	)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
