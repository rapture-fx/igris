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

	// GPU Runtime metrics (Phase 11)
	gpuInferenceLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "gpu_inference_latency_ms",
			Help:    "GPU inference latency in milliseconds",
			Buckets: []float64{5, 10, 15, 20, 30, 50, 75, 100, 150, 200},
		},
		[]string{"runtime", "success"},
	)

	gpuMemoryUsage = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "gpu_memory_usage_mb",
			Help: "GPU memory usage in megabytes",
		},
	)

	gpuUtilization = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "gpu_utilization_percent",
			Help: "GPU utilization percentage (0-100)",
		},
	)

	gpuFallbackTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gpu_fallback_total",
			Help: "Total number of GPU to CPU fallbacks",
		},
		[]string{"runtime"},
	)

	// Multi-model routing metrics
	modelSelectionTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "model_selection_total",
			Help: "Total number of model selections",
		},
		[]string{"model_id", "runtime", "strategy"}, // strategy: direct, exploration, exploitation
	)

	modelPerformance = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "model_performance_total",
			Help: "Model performance counters",
		},
		[]string{"model_id", "runtime", "result"}, // result: success, failure
	)

	modelLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "model_latency_ms",
			Help:    "Model inference latency in milliseconds",
			Buckets: []float64{5, 10, 20, 30, 50, 75, 100, 150, 200, 300},
		},
		[]string{"model_id", "runtime"},
	)

	modelRegistrationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "model_registration_total",
			Help: "Total number of model registrations",
		},
		[]string{"model_id", "runtime"},
	)

	// Streaming inference metrics
	streamInferenceTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "stream_inference_total",
			Help: "Total number of streaming inferences",
		},
		[]string{"stream_mode", "model_id"},
	)

	streamInferenceLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "stream_inference_latency_ms",
			Help:    "Streaming inference latency in milliseconds",
			Buckets: []float64{10, 25, 50, 100, 200, 500, 1000, 2000},
		},
		[]string{"stream_mode", "model_id"},
	)

	activeStreamConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "active_stream_connections",
			Help: "Current number of active WebSocket stream connections",
		},
	)

	// Feedback and drift detection metrics
	inferenceFeedbackTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inference_feedback_total",
			Help: "Total number of inference feedback signals",
		},
		[]string{"model_id", "success"},
	)

	driftScore = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "model_drift_score",
			Help: "Model drift score (0-1, higher = more drift)",
		},
		[]string{"model_id"},
	)

	driftAlertTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "drift_alert_total",
			Help: "Total number of drift alerts raised",
		},
		[]string{"model_id"},
	)

	feedbackConfidence = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "feedback_confidence",
			Help:    "Inference confidence from feedback signals",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"model_id"},
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

// Phase 11: GPU Runtime metrics

// RecordGPUInferenceLatency records GPU inference latency
func RecordGPUInferenceLatency(runtime string, latencyMs int64, success bool) {
	successStr := "false"
	if success {
		successStr = "true"
	}
	gpuInferenceLatency.WithLabelValues(runtime, successStr).Observe(float64(latencyMs))
}

// RecordGPUMemoryUsage records GPU memory usage
func RecordGPUMemoryUsage(memoryMB int64) {
	gpuMemoryUsage.Set(float64(memoryMB))
}

// RecordGPUUtilization records GPU utilization percentage
func RecordGPUUtilization(utilization int64) {
	gpuUtilization.Set(float64(utilization))
}

// RecordGPUFallback records a GPU to CPU fallback event
func RecordGPUFallback(runtime string) {
	gpuFallbackTotal.WithLabelValues(runtime).Inc()
}

// Phase 11: Multi-model routing metrics

// RecordModelSelection records a model selection event
func RecordModelSelection(modelID, runtime, strategy string) {
	modelSelectionTotal.WithLabelValues(modelID, runtime, strategy).Inc()
}

// RecordModelPerformance records model performance result
func RecordModelPerformance(modelID, runtime string, success bool, latencyMs int64) {
	result := "failure"
	if success {
		result = "success"
	}
	modelPerformance.WithLabelValues(modelID, runtime, result).Inc()
	modelLatency.WithLabelValues(modelID, runtime).Observe(float64(latencyMs))
}

// RecordModelRegistration records a model registration
func RecordModelRegistration(modelID, runtime string) {
	modelRegistrationTotal.WithLabelValues(modelID, runtime).Inc()
}

// Phase 11: Streaming inference metrics

// RecordStreamInference records a streaming inference request
func RecordStreamInference(streamMode, modelID string, latencyMs int64) {
	streamInferenceTotal.WithLabelValues(streamMode, modelID).Inc()
	streamInferenceLatency.WithLabelValues(streamMode, modelID).Observe(float64(latencyMs))
}

// RecordActiveStreamConnections records active WebSocket connections
func RecordActiveStreamConnections(count int) {
	activeStreamConnections.Set(float64(count))
}

// Phase 11: Feedback and drift detection metrics

// RecordInferenceFeedback records inference feedback signal
func RecordInferenceFeedback(modelID string, success bool, latencyMs int64, confidence float64) {
	successStr := "false"
	if success {
		successStr = "true"
	}
	inferenceFeedbackTotal.WithLabelValues(modelID, successStr).Inc()
	feedbackConfidence.WithLabelValues(modelID).Observe(confidence)
}

// RecordDriftScore records model drift score
func RecordDriftScore(modelID string, score float64) {
	driftScore.WithLabelValues(modelID).Set(score)
}

// RecordDriftAlert records a drift alert
func RecordDriftAlert(modelID string, score float64) {
	driftAlertTotal.WithLabelValues(modelID).Inc()
}

// RecordGPUSelection records GPU selection metrics
func RecordGPUSelection(gpuID int, strategy string) {
	// Placeholder - implement if GPU metrics are needed
}

// RecordGPUMetrics records GPU utilization and memory metrics
func RecordGPUMetrics(gpuID int, utilizationPercent, memoryUsedMB, memoryTotalMB int64) {
	// Placeholder - implement if GPU metrics are needed
}

// RecordGPUUnavailable records when a GPU becomes unavailable
func RecordGPUUnavailable(gpuID int, reason string) {
	// Placeholder - implement if GPU metrics are needed
}

// RecordGPURecovery records when a GPU recovers from failure
func RecordGPURecovery(gpuID int) {
	// Placeholder - implement if GPU metrics are needed
}

// RecordLoadRebalance records load rebalancing events
func RecordLoadRebalance(fromGPU, toGPU int, jobCount int) {
	// Placeholder - implement if load balancing metrics are needed
}
