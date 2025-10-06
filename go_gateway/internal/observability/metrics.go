package observability

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/gofiber/adaptor/v2"
)

var (
	// HTTP metrics
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// Rust FFI metrics
	rustFFICalls = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rust_ffi_calls_total",
			Help: "Total number of Rust FFI calls",
		},
		[]string{"function"},
	)

	rustFFIDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "rust_ffi_duration_microseconds",
			Help:    "Rust FFI call duration in microseconds",
			Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
		},
		[]string{"function"},
	)

	// gRPC ML client metrics
	grpcRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_requests_total",
			Help: "Total number of gRPC requests to ML service",
		},
		[]string{"method", "status"},
	)

	grpcRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grpc_request_duration_milliseconds",
			Help:    "gRPC request duration in milliseconds",
			Buckets: []float64{5, 10, 20, 50, 100, 200, 500, 1000, 2000},
		},
		[]string{"method"},
	)

	// Circuit breaker metrics
	circuitBreakerState = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "circuit_breaker_state",
			Help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
		},
		[]string{"name"},
	)

	circuitBreakerFailuresTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "circuit_breaker_failures_total",
			Help: "Total number of circuit breaker failures",
		},
		[]string{"name"},
	)

	// Input validation metrics
	validationErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "validation_errors_total",
			Help: "Total number of input validation errors",
		},
		[]string{"field", "error_type"},
	)

	// Adaptive pool metrics
	inferenceQueueDepth = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "inference_queue_depth",
			Help: "Current depth of the inference job queue",
		},
	)

	activeWorkers = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "active_workers",
			Help: "Current number of active inference workers",
		},
	)

	averageInferenceLatency = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "avg_inference_latency_ms",
			Help: "Moving average inference latency in milliseconds",
		},
	)

	droppedJobsTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "dropped_jobs_total",
			Help: "Total number of dropped inference jobs (queue full)",
		},
	)

	workerScalingEvents = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "worker_scaling_events_total",
			Help: "Total number of worker scaling events",
		},
		[]string{"direction"}, // up or down
	)
)

// PrometheusMiddleware records HTTP metrics
func PrometheusMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process request
		err := c.Next()

		// Record metrics
		duration := time.Since(start).Seconds()
		status := c.Response().StatusCode()
		method := c.Method()
		path := c.Path()

		httpRequestsTotal.WithLabelValues(method, path, string(rune(status))).Inc()
		httpRequestDuration.WithLabelValues(method, path).Observe(duration)

		return err
	}
}

// MetricsHandler returns Prometheus metrics endpoint handler
func MetricsHandler() fiber.Handler {
	return adaptor.HTTPHandler(promhttp.Handler())
}

// RecordRustFFICall records metrics for Rust FFI calls
func RecordRustFFICall(function string, duration time.Duration) {
	rustFFICalls.WithLabelValues(function).Inc()
	rustFFIDuration.WithLabelValues(function).Observe(float64(duration.Microseconds()))
}

// RecordGRPCCall records metrics for gRPC calls
func RecordGRPCCall(method string, duration time.Duration, err error) {
	status := "success"
	if err != nil {
		status = "error"
	}
	grpcRequestsTotal.WithLabelValues(method, status).Inc()
	grpcRequestDuration.WithLabelValues(method).Observe(float64(duration.Milliseconds()))
}

// RecordCircuitBreakerState records circuit breaker state
// state: 0=closed, 1=half-open, 2=open
func RecordCircuitBreakerState(name string, state int) {
	circuitBreakerState.WithLabelValues(name).Set(float64(state))
}

// RecordCircuitBreakerFailure records circuit breaker failures
func RecordCircuitBreakerFailure(name string) {
	circuitBreakerFailuresTotal.WithLabelValues(name).Inc()
}

// RecordValidationError records input validation errors
func RecordValidationError(field string, errorType string) {
	validationErrorsTotal.WithLabelValues(field, errorType).Inc()
}

// RecordInferenceQueueDepth records current queue depth
func RecordInferenceQueueDepth(depth int) {
	inferenceQueueDepth.Set(float64(depth))
}

// RecordActiveWorkers records current number of active workers
func RecordActiveWorkers(workers int) {
	activeWorkers.Set(float64(workers))
}

// RecordAverageInferenceLatency records average inference latency
func RecordAverageInferenceLatency(latencyMs int64) {
	averageInferenceLatency.Set(float64(latencyMs))
}

// RecordDroppedJob records a dropped job
func RecordDroppedJob() {
	droppedJobsTotal.Inc()
}

// RecordWorkerScaling records a worker scaling event
func RecordWorkerScaling(direction string, count int) {
	workerScalingEvents.WithLabelValues(direction).Add(float64(count))
}
