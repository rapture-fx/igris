package observability

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/rs/zerolog"
	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/config"
)

// TracingConfig holds configuration for distributed tracing
type TracingConfig struct {
	ServiceName     string
	AgentHost       string
	AgentPort       int
	SamplerType     string  // const, probabilistic, ratelimiting
	SamplerParam    float64 // 0.0 to 1.0 for probabilistic
	LogSpans        bool
	Disabled        bool
}

// TracingManager manages distributed tracing with Jaeger
type TracingManager struct {
	tracer   opentracing.Tracer
	closer   io.Closer
	config   TracingConfig
	logger   zerolog.Logger
}

// NewTracingManager creates a new tracing manager
func NewTracingManager(cfg TracingConfig, logger zerolog.Logger) (*TracingManager, error) {
	if cfg.Disabled {
		logger.Info().Msg("Distributed tracing is disabled")
		return &TracingManager{
			tracer: opentracing.NoopTracer{},
			config: cfg,
			logger: logger.With().Str("component", "tracing-manager").Logger(),
		}, nil
	}

	// Set defaults
	if cfg.ServiceName == "" {
		cfg.ServiceName = "schlep-engine-gateway"
	}
	if cfg.AgentHost == "" {
		cfg.AgentHost = "localhost"
	}
	if cfg.AgentPort == 0 {
		cfg.AgentPort = 6831
	}
	if cfg.SamplerType == "" {
		cfg.SamplerType = "const"
	}
	if cfg.SamplerParam == 0 {
		cfg.SamplerParam = 1.0 // Sample all traces by default
	}

	// Create Jaeger configuration
	jcfg := &config.Configuration{
		ServiceName: cfg.ServiceName,
		Sampler: &config.SamplerConfig{
			Type:  cfg.SamplerType,
			Param: cfg.SamplerParam,
		},
		Reporter: &config.ReporterConfig{
			LogSpans:            cfg.LogSpans,
			BufferFlushInterval: 1 * time.Second,
			LocalAgentHostPort:  fmt.Sprintf("%s:%d", cfg.AgentHost, cfg.AgentPort),
		},
	}

	// Initialize tracer
	tracer, closer, err := jcfg.NewTracer(
		config.Logger(jaeger.StdLogger),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Jaeger tracer: %w", err)
	}

	// Set global tracer
	opentracing.SetGlobalTracer(tracer)

	tm := &TracingManager{
		tracer: tracer,
		closer: closer,
		config: cfg,
		logger: logger.With().Str("component", "tracing-manager").Logger(),
	}

	tm.logger.Info().
		Str("service", cfg.ServiceName).
		Str("agent", fmt.Sprintf("%s:%d", cfg.AgentHost, cfg.AgentPort)).
		Str("sampler", cfg.SamplerType).
		Float64("sample_rate", cfg.SamplerParam).
		Msg("Distributed tracing initialized with Jaeger")

	return tm, nil
}

// StartSpan starts a new span with the given operation name
func (tm *TracingManager) StartSpan(operationName string) opentracing.Span {
	return tm.tracer.StartSpan(operationName)
}

// StartSpanFromContext starts a new span with parent context
func (tm *TracingManager) StartSpanFromContext(ctx context.Context, operationName string) (opentracing.Span, context.Context) {
	span, ctx := opentracing.StartSpanFromContext(ctx, operationName)
	return span, ctx
}

// InjectTraceID injects trace ID into context for propagation
func (tm *TracingManager) InjectTraceID(ctx context.Context, carrier interface{}) error {
	span := opentracing.SpanFromContext(ctx)
	if span == nil {
		return fmt.Errorf("no span found in context")
	}

	return tm.tracer.Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		carrier,
	)
}

// ExtractTraceID extracts trace ID from carrier
func (tm *TracingManager) ExtractTraceID(carrier interface{}) (opentracing.SpanContext, error) {
	return tm.tracer.Extract(
		opentracing.HTTPHeaders,
		carrier,
	)
}

// TraceRequest creates a span for HTTP request
func (tm *TracingManager) TraceRequest(ctx context.Context, method, path string) (opentracing.Span, context.Context) {
	span, ctx := tm.StartSpanFromContext(ctx, fmt.Sprintf("HTTP %s %s", method, path))
	ext.HTTPMethod.Set(span, method)
	ext.HTTPUrl.Set(span, path)
	ext.SpanKindRPCClient.Set(span)
	return span, ctx
}

// TraceGRPCCall creates a span for gRPC call
func (tm *TracingManager) TraceGRPCCall(ctx context.Context, service, method string) (opentracing.Span, context.Context) {
	span, ctx := tm.StartSpanFromContext(ctx, fmt.Sprintf("gRPC %s/%s", service, method))
	span.SetTag("grpc.service", service)
	span.SetTag("grpc.method", method)
	ext.SpanKindRPCClient.Set(span)
	return span, ctx
}

// TraceFFICall creates a span for Rust FFI call
func (tm *TracingManager) TraceFFICall(ctx context.Context, function string) (opentracing.Span, context.Context) {
	span, ctx := tm.StartSpanFromContext(ctx, fmt.Sprintf("FFI %s", function))
	span.SetTag("ffi.function", function)
	span.SetTag("ffi.language", "rust")
	return span, ctx
}

// TraceInference creates a span for ML inference
func (tm *TracingManager) TraceInference(ctx context.Context, modelID, version string) (opentracing.Span, context.Context) {
	span, ctx := tm.StartSpanFromContext(ctx, "ML Inference")
	span.SetTag("model.id", modelID)
	span.SetTag("model.version", version)
	return span, ctx
}

// TraceCacheOperation creates a span for cache operation
func (tm *TracingManager) TraceCacheOperation(ctx context.Context, tier, operation string) (opentracing.Span, context.Context) {
	span, ctx := tm.StartSpanFromContext(ctx, fmt.Sprintf("Cache %s", operation))
	span.SetTag("cache.tier", tier)
	span.SetTag("cache.operation", operation)
	return span, ctx
}

// TraceDataParsing creates a span for data parsing
func (tm *TracingManager) TraceDataParsing(ctx context.Context, format string, recordCount int) (opentracing.Span, context.Context) {
	span, ctx := tm.StartSpanFromContext(ctx, fmt.Sprintf("Parse %s", format))
	span.SetTag("data.format", format)
	span.SetTag("data.record_count", recordCount)
	return span, ctx
}

// TraceETLJob creates a span for ETL job
func (tm *TracingManager) TraceETLJob(ctx context.Context, jobType string) (opentracing.Span, context.Context) {
	span, ctx := tm.StartSpanFromContext(ctx, fmt.Sprintf("ETL Job: %s", jobType))
	span.SetTag("etl.job_type", jobType)
	return span, ctx
}

// SetSpanError marks a span as failed with error details
func (tm *TracingManager) SetSpanError(span opentracing.Span, err error) {
	if err == nil {
		return
	}
	ext.Error.Set(span, true)
	span.SetTag("error.message", err.Error())
}

// AddSpanLog adds a log entry to the span
func (tm *TracingManager) AddSpanLog(span opentracing.Span, key, value string) {
	span.LogKV(key, value)
}

// GetTraceID returns the trace ID from a span
func (tm *TracingManager) GetTraceID(span opentracing.Span) string {
	if span == nil {
		return ""
	}

	if sc, ok := span.Context().(jaeger.SpanContext); ok {
		return sc.TraceID().String()
	}

	return ""
}

// AnalyzeLatencyBottlenecks analyzes spans to find top latency bottlenecks
func (tm *TracingManager) AnalyzeLatencyBottlenecks(spans []SpanInfo) []LatencyBottleneck {
	// Aggregate by operation name
	operations := make(map[string]*LatencyStats)

	for _, span := range spans {
		if _, exists := operations[span.Operation]; !exists {
			operations[span.Operation] = &LatencyStats{
				Operation: span.Operation,
			}
		}

		stats := operations[span.Operation]
		stats.TotalDuration += span.Duration
		stats.Count++

		if span.Duration > stats.MaxDuration {
			stats.MaxDuration = span.Duration
		}
		if stats.MinDuration == 0 || span.Duration < stats.MinDuration {
			stats.MinDuration = span.Duration
		}
	}

	// Calculate averages and sort by total duration
	var bottlenecks []LatencyBottleneck
	for _, stats := range operations {
		stats.AvgDuration = stats.TotalDuration / time.Duration(stats.Count)

		bottlenecks = append(bottlenecks, LatencyBottleneck{
			Operation:     stats.Operation,
			AvgLatency:    stats.AvgDuration,
			MaxLatency:    stats.MaxDuration,
			TotalDuration: stats.TotalDuration,
			Count:         stats.Count,
		})
	}

	// Sort by total duration (descending)
	for i := 0; i < len(bottlenecks)-1; i++ {
		for j := i + 1; j < len(bottlenecks); j++ {
			if bottlenecks[j].TotalDuration > bottlenecks[i].TotalDuration {
				bottlenecks[i], bottlenecks[j] = bottlenecks[j], bottlenecks[i]
			}
		}
	}

	// Return top 3
	if len(bottlenecks) > 3 {
		return bottlenecks[:3]
	}
	return bottlenecks
}

// Close closes the tracer and flushes remaining spans
func (tm *TracingManager) Close() error {
	if tm.closer != nil {
		tm.logger.Info().Msg("Closing Jaeger tracer")
		return tm.closer.Close()
	}
	return nil
}

// SpanInfo contains information about a traced span
type SpanInfo struct {
	TraceID   string
	SpanID    string
	Operation string
	Duration  time.Duration
	Tags      map[string]string
	StartTime time.Time
}

// LatencyStats holds latency statistics for an operation
type LatencyStats struct {
	Operation     string
	TotalDuration time.Duration
	AvgDuration   time.Duration
	MinDuration   time.Duration
	MaxDuration   time.Duration
	Count         int
}

// LatencyBottleneck represents a performance bottleneck
type LatencyBottleneck struct {
	Operation     string
	AvgLatency    time.Duration
	MaxLatency    time.Duration
	TotalDuration time.Duration
	Count         int
}

// GetBottleneckReport returns a formatted report of latency bottlenecks
func (tm *TracingManager) GetBottleneckReport(bottlenecks []LatencyBottleneck) string {
	report := "=== Top 3 Latency Bottlenecks ===\n\n"

	for i, b := range bottlenecks {
		report += fmt.Sprintf("%d. %s\n", i+1, b.Operation)
		report += fmt.Sprintf("   Avg: %v | Max: %v | Total: %v | Count: %d\n",
			b.AvgLatency, b.MaxLatency, b.TotalDuration, b.Count)
		report += "\n"
	}

	return report
}
