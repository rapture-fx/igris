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

	// /v1/infer endpoint metrics (Phase 8: Metrics & Telemetry)
	inferRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "infer_requests_total",
			Help: "Total number of /v1/infer requests",
		},
		[]string{"provider", "model", "status"}, // status: success, error
	)

	inferRequestLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "infer_request_latency_ms",
			Help:    "Request latency for /v1/infer in milliseconds",
			Buckets: []float64{50, 100, 200, 400, 800, 1600, 3200, 6400},
		},
		[]string{"provider", "model"},
	)

	inferTokensUsed = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "infer_tokens_used",
			Help:    "Tokens used per /v1/infer request",
			Buckets: []float64{10, 50, 100, 200, 500, 1000, 2000, 4000, 8000},
		},
		[]string{"provider", "model", "token_type"}, // token_type: prompt, completion, total
	)

	inferCostUSD = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "infer_cost_usd",
			Help:    "Cost per /v1/infer request in USD",
			Buckets: []float64{0.00001, 0.0001, 0.001, 0.01, 0.1, 1.0},
		},
		[]string{"provider", "model"},
	)

	inferProviderStats = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "infer_provider_stats_total",
			Help: "Aggregated statistics per provider",
		},
		[]string{"provider", "metric_type"}, // metric_type: requests, errors, tokens
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
// Called as: RecordGPUMetrics(deviceID, memoryUsedMB, utilization)
func RecordGPUMetrics(gpuID int, memoryUsedMB, utilizationPercent int64) {
	// Placeholder - implement if GPU metrics are needed
}

// RecordGPUUnavailable records when a GPU becomes unavailable
// Called as: RecordGPUUnavailable(deviceID)
func RecordGPUUnavailable(gpuID int) {
	// Placeholder - implement if GPU metrics are needed
}

// RecordGPURecovery records when a GPU recovers from failure
func RecordGPURecovery(gpuID int) {
	// Placeholder - implement if GPU metrics are needed
}

// RecordLoadRebalance records load rebalancing events
// Called as: RecordLoadRebalance() with no arguments
func RecordLoadRebalance() {
	// Placeholder - implement if load balancing metrics are needed
}

// Phase 8: /v1/infer endpoint metrics

// RecordInferRequest records a /v1/infer request with latency, tokens, and cost
func RecordInferRequest(provider, model string, latencyMs int64, promptTokens, completionTokens, totalTokens int, costUSD float64, success bool) {
	status := "success"
	if !success {
		status = "error"
	}

	// Record request count
	inferRequestsTotal.WithLabelValues(provider, model, status).Inc()

	// Record latency
	inferRequestLatency.WithLabelValues(provider, model).Observe(float64(latencyMs))

	// Record token usage
	if totalTokens > 0 {
		inferTokensUsed.WithLabelValues(provider, model, "total").Observe(float64(totalTokens))
	}
	if promptTokens > 0 {
		inferTokensUsed.WithLabelValues(provider, model, "prompt").Observe(float64(promptTokens))
	}
	if completionTokens > 0 {
		inferTokensUsed.WithLabelValues(provider, model, "completion").Observe(float64(completionTokens))
	}

	// Record cost
	if costUSD > 0 {
		inferCostUSD.WithLabelValues(provider, model).Observe(costUSD)
	}

	// Update provider stats
	inferProviderStats.WithLabelValues(provider, "requests").Inc()
	if !success {
		inferProviderStats.WithLabelValues(provider, "errors").Inc()
	}
	if totalTokens > 0 {
		inferProviderStats.WithLabelValues(provider, "tokens").Add(float64(totalTokens))
	}
}

// RecordInferLatency records just the latency metric (for use in middleware)
func RecordInferLatency(provider, model string, latencyMs int64) {
	inferRequestLatency.WithLabelValues(provider, model).Observe(float64(latencyMs))
}

// Phase 1: Cost forecasting and provider cost tracking metrics

var (
	// Cost forecasting metrics
	igrisEstimatedCostUSDTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_estimated_cost_usd_total",
			Help: "Total estimated cost in USD across all requests",
		},
		[]string{"provider", "model"},
	)

	igrisForecastRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_forecast_requests_total",
			Help: "Total number of requests with cost forecast",
		},
		[]string{"provider", "model", "forecast_method"}, // forecast_method: pre_request, post_request
	)

	igrisProviderCostRatio = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_provider_cost_ratio",
			Help: "Cost efficiency ratio per provider (lower is better)",
		},
		[]string{"provider", "model"},
	)

	igrisCostPerToken = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_cost_per_token",
			Help:    "Cost per token distribution in USD",
			Buckets: []float64{0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1},
		},
		[]string{"provider", "model", "token_type"}, // token_type: input, output, total
	)

	igrisRequestCostUSD = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_request_cost_usd",
			Help:    "Per-request cost distribution in USD",
			Buckets: []float64{0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1, 1.0},
		},
		[]string{"provider", "model"},
	)

	igrisCostForecastAccuracy = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_cost_forecast_accuracy",
			Help:    "Accuracy of cost forecasts (estimated vs actual)",
			Buckets: []float64{0.5, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0, 1.1, 1.2, 1.5},
		},
		[]string{"provider", "model"},
	)
)

// RecordEstimatedCost records estimated cost for a request (before inference)
func RecordEstimatedCost(provider, model string, estimatedCostUSD float64, inputTokens, outputTokens int) {
	// Record total estimated cost
	igrisEstimatedCostUSDTotal.WithLabelValues(provider, model).Add(estimatedCostUSD)

	// Record forecast request
	igrisForecastRequestsTotal.WithLabelValues(provider, model, "pre_request").Inc()

	// Record cost distribution
	igrisRequestCostUSD.WithLabelValues(provider, model).Observe(estimatedCostUSD)

	// Record cost per token if tokens are provided
	if inputTokens > 0 {
		costPerInputToken := estimatedCostUSD / float64(inputTokens+outputTokens)
		igrisCostPerToken.WithLabelValues(provider, model, "input").Observe(costPerInputToken)
	}
}

// RecordActualCost records actual cost after inference completes
func RecordActualCost(provider, model string, actualCostUSD, estimatedCostUSD float64, inputTokens, outputTokens int) {
	// Record actual cost
	igrisEstimatedCostUSDTotal.WithLabelValues(provider, model).Add(actualCostUSD)

	// Record forecast request
	igrisForecastRequestsTotal.WithLabelValues(provider, model, "post_request").Inc()

	// Record cost distribution
	igrisRequestCostUSD.WithLabelValues(provider, model).Observe(actualCostUSD)

	// Record forecast accuracy
	if estimatedCostUSD > 0 && actualCostUSD > 0 {
		accuracy := actualCostUSD / estimatedCostUSD
		igrisCostForecastAccuracy.WithLabelValues(provider, model).Observe(accuracy)
	}

	// Record cost per token
	totalTokens := inputTokens + outputTokens
	if totalTokens > 0 {
		costPerToken := actualCostUSD / float64(totalTokens)
		igrisCostPerToken.WithLabelValues(provider, model, "total").Observe(costPerToken)

		if inputTokens > 0 {
			costPerInputToken := (actualCostUSD * float64(inputTokens) / float64(totalTokens)) / float64(inputTokens)
			igrisCostPerToken.WithLabelValues(provider, model, "input").Observe(costPerInputToken)
		}

		if outputTokens > 0 {
			costPerOutputToken := (actualCostUSD * float64(outputTokens) / float64(totalTokens)) / float64(outputTokens)
			igrisCostPerToken.WithLabelValues(provider, model, "output").Observe(costPerOutputToken)
		}
	}
}

// RecordProviderCostRatio records the cost efficiency ratio for a provider
// Lower ratio = more cost efficient
func RecordProviderCostRatio(provider, model string, costRatio float64) {
	igrisProviderCostRatio.WithLabelValues(provider, model).Set(costRatio)
}

// Phase 2: Policy-based routing and fallback metrics

var (
	igrisPolicyRouteDecisionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_policy_route_decisions_total",
			Help: "Total number of policy-based routing decisions",
		},
		[]string{"provider", "strategy", "preference"}, // strategy: policy_based, default
	)

	igrisCostBasedFallbacksTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_cost_based_fallbacks_total",
			Help: "Total number of cost-based provider fallbacks",
		},
		[]string{"provider"},
	)
)

// RecordPolicyRouteDecision records a policy-based routing decision
func RecordPolicyRouteDecision(provider, strategy, preference string) {
	igrisPolicyRouteDecisionsTotal.WithLabelValues(provider, strategy, preference).Inc()
}

// RecordCostBasedFallback records when a provider is selected due to cost constraints
func RecordCostBasedFallback(provider string) {
	igrisCostBasedFallbacksTotal.WithLabelValues(provider).Inc()
}

// Phase 3: Semantic Routing & Adaptive Learning Metrics

var (
	// Semantic classification metrics
	igrisSemanticClassificationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_semantic_classifications_total",
			Help: "Total number of semantic classifications performed",
		},
		[]string{"class", "cache_hit"}, // cache_hit: true/false
	)

	igrisSemanticClassificationLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_semantic_classification_latency_ms",
			Help:    "Semantic classification latency in milliseconds",
			Buckets: []float64{1, 2, 5, 10, 15, 20, 30, 50, 100},
		},
		[]string{"class", "cache_hit"},
	)

	igrisSemanticClassificationConfidence = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_semantic_classification_confidence",
			Help:    "Confidence score of semantic classifications (0-1)",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0},
		},
		[]string{"class"},
	)

	// Bandit algorithm metrics
	igrisBanditRewardUpdatesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_bandit_reward_updates_total",
			Help: "Total number of bandit reward updates processed",
		},
		[]string{"provider", "class", "status"}, // status: success/error
	)

	igrisProviderRewardMean = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_provider_reward_mean",
			Help: "Mean composite reward for each provider per semantic class (Thompson Sampling)",
		},
		[]string{"provider", "class"},
	)

	igrisProviderRewardAlpha = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_provider_reward_alpha",
			Help: "Beta distribution alpha parameter (successes) for Thompson Sampling",
		},
		[]string{"provider", "class"},
	)

	igrisProviderRewardBeta = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_provider_reward_beta",
			Help: "Beta distribution beta parameter (failures) for Thompson Sampling",
		},
		[]string{"provider", "class"},
	)

	// Feedback processing metrics
	igrisFeedbackLatencyMs = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_feedback_latency_ms",
			Help:    "Feedback event processing latency in milliseconds",
			Buckets: []float64{1, 2, 5, 10, 15, 20, 30, 50, 100},
		},
		[]string{"provider", "class"},
	)

	igrisFeedbackEventsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_feedback_events_total",
			Help: "Total number of feedback events received",
		},
		[]string{"provider", "class", "success"},
	)

	igrisFeedbackProcessedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_feedback_processed_total",
			Help: "Total number of feedback events processed asynchronously",
		},
		[]string{"status"}, // status: success/error
	)

	// Composite reward component metrics
	igrisRewardComponentLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_reward_component_latency",
			Help:    "Latency score component of composite reward (0-1, higher is better)",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"provider", "class"},
	)

	igrisRewardComponentCost = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_reward_component_cost",
			Help:    "Cost efficiency component of composite reward (0-1, higher is better)",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"provider", "class"},
	)

	igrisRewardComponentSuccess = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_reward_component_success",
			Help:    "Success rate component of composite reward (0-1)",
			Buckets: []float64{0.0, 0.1, 0.5, 0.9, 0.95, 0.99, 1.0},
		},
		[]string{"provider", "class"},
	)

	// Weight tracking for adaptive learning
	igrisCompositeRewardWeights = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_composite_reward_weights",
			Help: "Current weights for composite reward calculation (α, β, γ)",
		},
		[]string{"component", "class"}, // component: latency/cost/success
	)
)

// Phase 4: Adaptive Governance & SLA Metrics

var (
	// Policy routing metrics
	igrisPolicyVersionActive = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_policy_version_active",
			Help: "Currently active policy version per tenant (1=active, 0=inactive)",
		},
		[]string{"tenant_id", "version"},
	)

	igrisPolicyReloadTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_policy_reload_total",
			Help: "Total number of policy hot reloads",
		},
		[]string{"tenant_id", "status"}, // status: success/error
	)

	igrisPolicyReloadLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_policy_reload_latency_seconds",
			Help:    "Policy reload latency in seconds",
			Buckets: []float64{0.1, 0.25, 0.5, 0.75, 1.0, 2.0, 5.0},
		},
		[]string{"tenant_id"},
	)

	// SLA tracking metrics
	igrisSLAViolationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_sla_violations_total",
			Help: "Total number of SLA violations",
		},
		[]string{"tenant_id", "provider", "violation_type", "severity"}, // violation_type: uptime/latency_p95/latency_p99/cost/success_rate
	)

	igrisSLAComplianceStatus = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_sla_compliance_status",
			Help: "Current SLA compliance status (1=compliant, 0.5=warning, 0=critical)",
		},
		[]string{"tenant_id"},
	)

	igrisProviderDegradedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_provider_degraded_total",
			Help: "Total number of times providers marked as degraded due to SLA violations",
		},
		[]string{"provider", "reason"},
	)

	igrisSLAMeasuredValue = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_sla_measured_value",
			Help: "Current measured value for SLA metrics",
		},
		[]string{"tenant_id", "provider", "metric_type"}, // metric_type: uptime/latency_p95/latency_p99/cost/success_rate
	)

	igrisSLATargetValue = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_sla_target_value",
			Help: "Target value for SLA metrics",
		},
		[]string{"tenant_id", "metric_type"},
	)

	// Audit log metrics
	igrisAuditLogEntriesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_audit_log_entries_total",
			Help: "Total number of audit log entries created",
		},
		[]string{"tenant_id", "policy_version"},
	)

	igrisAuditLogRetentionCleanup = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "igris_audit_log_retention_cleanup_total",
			Help: "Total number of audit log entries cleaned up due to retention policy",
		},
	)

	// Self-tuning metrics
	igrisSelfTuningOptimizationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_self_tuning_optimizations_total",
			Help: "Total number of self-tuning weight optimizations performed",
		},
		[]string{"class", "status"}, // status: applied/rejected
	)

	igrisSelfTuningPerformanceImprovement = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_self_tuning_performance_improvement",
			Help:    "Expected performance improvement from self-tuning (percentage)",
			Buckets: []float64{-10, -5, 0, 1, 2, 5, 10, 15, 20, 30, 50},
		},
		[]string{"class"},
	)

	igrisSelfTuningConfidence = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_self_tuning_confidence",
			Help:    "Confidence score for self-tuning optimization (0-1)",
			Buckets: []float64{0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0},
		},
		[]string{"class"},
	)
)

// Phase 3: Semantic Routing & Adaptive Learning Functions

// RecordSemanticClassification records a semantic classification event
func RecordSemanticClassification(class string, latencyMs int64, confidence float64, cacheHit bool) {
	cacheHitStr := "false"
	if cacheHit {
		cacheHitStr = "true"
	}

	igrisSemanticClassificationsTotal.WithLabelValues(class, cacheHitStr).Inc()
	igrisSemanticClassificationLatency.WithLabelValues(class, cacheHitStr).Observe(float64(latencyMs))
	igrisSemanticClassificationConfidence.WithLabelValues(class).Observe(confidence)
}

// RecordBanditRewardUpdate records a bandit reward update event
func RecordBanditRewardUpdate(provider, class string, latencyMs int64, success bool) {
	status := "success"
	if !success {
		status = "error"
	}

	igrisBanditRewardUpdatesTotal.WithLabelValues(provider, class, status).Inc()
	igrisFeedbackLatencyMs.WithLabelValues(provider, class).Observe(float64(latencyMs))
}

// RecordProviderReward records Thompson Sampling parameters for a provider
func RecordProviderReward(provider, class string, alpha, beta, compositeMean float64) {
	igrisProviderRewardAlpha.WithLabelValues(provider, class).Set(alpha)
	igrisProviderRewardBeta.WithLabelValues(provider, class).Set(beta)
	igrisProviderRewardMean.WithLabelValues(provider, class).Set(compositeMean)
}

// RecordFeedbackEvent records a feedback event
func RecordFeedbackEvent(provider, class string, success bool, processingLatencyMs int64) {
	successStr := "false"
	if success {
		successStr = "true"
	}

	igrisFeedbackEventsTotal.WithLabelValues(provider, class, successStr).Inc()

	if processingLatencyMs > 0 {
		igrisFeedbackLatencyMs.WithLabelValues(provider, class).Observe(float64(processingLatencyMs))
	}
}

// RecordFeedbackProcessed records completion of feedback processing
func RecordFeedbackProcessed(success bool) {
	status := "success"
	if !success {
		status = "error"
	}
	igrisFeedbackProcessedTotal.WithLabelValues(status).Inc()
}

// RecordCompositeRewardComponents records individual reward components
func RecordCompositeRewardComponents(provider, class string, latencyScore, costEfficiency, successRate float64) {
	igrisRewardComponentLatency.WithLabelValues(provider, class).Observe(latencyScore)
	igrisRewardComponentCost.WithLabelValues(provider, class).Observe(costEfficiency)
	igrisRewardComponentSuccess.WithLabelValues(provider, class).Observe(successRate)
}

// RecordCompositeRewardWeights records current weight configuration
func RecordCompositeRewardWeights(class string, latencyWeight, costWeight, successWeight float64) {
	igrisCompositeRewardWeights.WithLabelValues("latency", class).Set(latencyWeight)
	igrisCompositeRewardWeights.WithLabelValues("cost", class).Set(costWeight)
	igrisCompositeRewardWeights.WithLabelValues("success", class).Set(successWeight)
}

// Phase 5: Speculative Execution Metrics

var (
	// Speculative request metrics
	speculativeRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "speculative_requests_total",
			Help: "Total number of speculative execution requests",
		},
		[]string{"mode", "winner_provider", "tenant_id"},
	)

	speculativeLatencySaved = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "speculative_latency_saved_seconds",
			Help:    "Latency saved by speculative execution in seconds",
			Buckets: []float64{0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0},
		},
		[]string{"mode", "tenant_id"},
	)

	speculativeSwitchesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "speculative_switches_total",
			Help: "Total number of mid-stream provider switches",
		},
		[]string{"reason", "from_provider", "to_provider", "tenant_id"},
	)

	speculativeTokensWasted = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "speculative_tokens_wasted_total",
			Help: "Total number of tokens wasted in speculative execution (from losing providers)",
		},
		[]string{"provider", "tenant_id"},
	)

	speculativeProviderRaceLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "speculative_provider_race_latency_ms",
			Help:    "Time to first token per provider in speculative race (milliseconds)",
			Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000, 10000},
		},
		[]string{"provider", "mode", "result"}, // result: winner/loser
	)

	speculativeQualityScore = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "speculative_quality_score",
			Help:    "Quality score of providers in speculative race (0-1)",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"provider", "mode", "score_type"}, // score_type: latency/quality/cost/composite
	)

	speculativeCostWastedUSD = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "speculative_cost_wasted_usd_total",
			Help: "Total cost wasted in USD from losing providers in speculative execution",
		},
		[]string{"provider", "tenant_id"},
	)

	speculativeProvidersRaced = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "speculative_providers_raced",
			Help:    "Number of providers raced in speculative execution",
			Buckets: []float64{2, 3, 4},
		},
		[]string{"mode", "tenant_id"},
	)

	speculativeRaceTimeoutTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "speculative_race_timeout_total",
			Help: "Total number of speculative races that timed out",
		},
		[]string{"mode", "tenant_id"},
	)

	speculativeFallbackBufferSize = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "speculative_fallback_buffer_size",
			Help: "Current size of fallback provider token buffers",
		},
		[]string{"provider", "tenant_id"},
	)

	speculativeStreamDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "speculative_stream_duration_seconds",
			Help:    "Total duration of speculative streams including any mid-stream switches",
			Buckets: []float64{1, 5, 10, 30, 60, 120, 300},
		},
		[]string{"mode", "final_provider", "switched", "tenant_id"}, // switched: true/false
	)

	speculativeCandidateFailures = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "speculative_candidate_failures_total",
			Help: "Total number of provider failures during speculative races",
		},
		[]string{"provider", "failure_reason", "tenant_id"},
	)
)

// RecordSpeculativeRequest records a speculative execution request
func RecordSpeculativeRequest(mode, winnerProvider, tenantID string, latencySavedMs int64, providersRaced int) {
	speculativeRequestsTotal.WithLabelValues(mode, winnerProvider, tenantID).Inc()
	speculativeLatencySaved.WithLabelValues(mode, tenantID).Observe(float64(latencySavedMs) / 1000.0)
	speculativeProvidersRaced.WithLabelValues(mode, tenantID).Observe(float64(providersRaced))
}

// RecordSpeculativeSwitch records a mid-stream provider switch
func RecordSpeculativeSwitch(reason, fromProvider, toProvider, tenantID string) {
	speculativeSwitchesTotal.WithLabelValues(reason, fromProvider, toProvider, tenantID).Inc()
}

// RecordSpeculativeTokensWasted records wasted tokens from losing providers
func RecordSpeculativeTokensWasted(provider, tenantID string, tokensWasted int) {
	speculativeTokensWasted.WithLabelValues(provider, tenantID).Add(float64(tokensWasted))
}

// RecordSpeculativeProviderRace records provider race metrics
func RecordSpeculativeProviderRace(provider, mode, result string, firstTokenLatencyMs int64) {
	speculativeProviderRaceLatency.WithLabelValues(provider, mode, result).Observe(float64(firstTokenLatencyMs))
}

// RecordSpeculativeQualityScore records quality scores from speculative race
func RecordSpeculativeQualityScore(provider, mode, scoreType string, score float64) {
	speculativeQualityScore.WithLabelValues(provider, mode, scoreType).Observe(score)
}

// RecordSpeculativeCostWasted records cost wasted from losing providers
func RecordSpeculativeCostWasted(provider, tenantID string, costWastedUSD float64) {
	speculativeCostWastedUSD.WithLabelValues(provider, tenantID).Add(costWastedUSD)
}

// RecordSpeculativeRaceTimeout records when a race times out
func RecordSpeculativeRaceTimeout(mode, tenantID string) {
	speculativeRaceTimeoutTotal.WithLabelValues(mode, tenantID).Inc()
}

// RecordSpeculativeFallbackBuffer records fallback buffer size
func RecordSpeculativeFallbackBuffer(provider, tenantID string, bufferSize int) {
	speculativeFallbackBufferSize.WithLabelValues(provider, tenantID).Set(float64(bufferSize))
}

// RecordSpeculativeStreamDuration records total stream duration
func RecordSpeculativeStreamDuration(mode, finalProvider, tenantID string, switched bool, durationMs int64) {
	switchedStr := "false"
	if switched {
		switchedStr = "true"
	}
	speculativeStreamDuration.WithLabelValues(mode, finalProvider, switchedStr, tenantID).Observe(float64(durationMs) / 1000.0)
}

// RecordSpeculativeCandidateFailure records a provider failure during race
func RecordSpeculativeCandidateFailure(provider, failureReason, tenantID string) {
	speculativeCandidateFailures.WithLabelValues(provider, failureReason, tenantID).Inc()
}

// Phase 4: Adaptive Governance Functions

// RecordPolicyVersionActive marks a policy version as active
func RecordPolicyVersionActive(tenantID, version string, active bool) {
	value := 0.0
	if active {
		value = 1.0
	}
	igrisPolicyVersionActive.WithLabelValues(tenantID, version).Set(value)
}

// RecordPolicyReload records a policy hot reload event
func RecordPolicyReload(tenantID string, latencySeconds float64, success bool) {
	status := "success"
	if !success {
		status = "error"
	}

	igrisPolicyReloadTotal.WithLabelValues(tenantID, status).Inc()
	igrisPolicyReloadLatency.WithLabelValues(tenantID).Observe(latencySeconds)
}

// RecordSLAViolation records an SLA violation
func RecordSLAViolation(tenantID, provider, violationType, severity string) {
	igrisSLAViolationsTotal.WithLabelValues(tenantID, provider, violationType, severity).Inc()
}

// RecordSLACompliance updates SLA compliance status
func RecordSLACompliance(tenantID string, status string) {
	// status: compliant=1.0, warning=0.5, critical=0.0
	value := 0.0
	switch status {
	case "compliant":
		value = 1.0
	case "warning":
		value = 0.5
	case "critical":
		value = 0.0
	}
	igrisSLAComplianceStatus.WithLabelValues(tenantID).Set(value)
}

// RecordProviderDegraded records when a provider is marked as degraded
func RecordProviderDegraded(provider, reason string) {
	igrisProviderDegradedTotal.WithLabelValues(provider, reason).Inc()
}

// RecordSLAMetrics records current SLA measurements vs targets
func RecordSLAMetrics(tenantID, provider, metricType string, measuredValue, targetValue float64) {
	igrisSLAMeasuredValue.WithLabelValues(tenantID, provider, metricType).Set(measuredValue)
	igrisSLATargetValue.WithLabelValues(tenantID, metricType).Set(targetValue)
}

// RecordAuditLogEntry records creation of an audit log entry
func RecordAuditLogEntry(tenantID, policyVersion string) {
	igrisAuditLogEntriesTotal.WithLabelValues(tenantID, policyVersion).Inc()
}

// RecordAuditLogCleanup records cleanup of old audit entries
func RecordAuditLogCleanup(count int) {
	igrisAuditLogRetentionCleanup.Add(float64(count))
}

// RecordSelfTuningOptimization records a self-tuning optimization event
func RecordSelfTuningOptimization(class string, performanceImprovement, confidence float64, applied bool) {
	status := "rejected"
	if applied {
		status = "applied"
	}

	igrisSelfTuningOptimizationsTotal.WithLabelValues(class, status).Inc()
	igrisSelfTuningPerformanceImprovement.WithLabelValues(class).Observe(performanceImprovement)
	igrisSelfTuningConfidence.WithLabelValues(class).Observe(confidence)
}

// Phase 1 Security Hardening: Control Surface Metrics

var (
	// Rate limiting metrics
	controlSurfaceRateLimitExceeded = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "control_surface_rate_limit_exceeded_total",
			Help: "Total number of rate limit violations on control surface endpoints",
		},
		[]string{"tenant_id", "endpoint"},
	)

	controlSurfaceRateLimitAllowed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "control_surface_rate_limit_allowed_total",
			Help: "Total number of allowed requests (within rate limit)",
		},
		[]string{"tenant_id", "endpoint"},
	)

	// Signature verification metrics
	controlSurfaceSignatureVerifications = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "control_surface_signature_verifications_total",
			Help: "Total number of signature verification attempts",
		},
		[]string{"tenant_id", "result"}, // result: valid/invalid/missing
	)

	controlSurfaceSignatureVerificationLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "control_surface_signature_verification_latency_us",
			Help:    "Signature verification latency in microseconds",
			Buckets: []float64{10, 25, 50, 100, 250, 500, 1000},
		},
		[]string{"tenant_id"},
	)

	// Vault integration metrics
	vaultSecretsReadTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "vault_secrets_read_total",
			Help: "Total number of secrets read from Vault",
		},
		[]string{"path", "result"}, // result: success/error/fallback
	)

	vaultHealthStatus = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "vault_health_status",
			Help: "Vault health status (1=healthy, 0=unhealthy)",
		},
	)

	vaultRotationsTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "vault_rotations_total",
			Help: "Total number of secret rotations performed",
		},
	)

	// Tamper detection metrics
	tamperDetectionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "tamper_detections_total",
			Help: "Total number of tamper detection events",
		},
		[]string{"tenant_id", "detection_type"}, // detection_type: signature_mismatch/replay_attack/timestamp_drift
	)

	// Self-tuner metrics (Phase 2)
	selfTunerRunsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "self_tuner_runs_total",
			Help: "Total number of self-tuner execution cycles",
		},
		[]string{"tenant_id", "status"}, // status: success/error/skipped
	)

	selfTunerLastRunTimestamp = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "self_tuner_last_run_timestamp",
			Help: "Unix timestamp of last self-tuner run",
		},
		[]string{"tenant_id"},
	)

	// Auto-apply metrics (Phase 2)
	autoAppliedProposalsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auto_applied_proposals_total",
			Help: "Total number of automatically applied proposals",
		},
		[]string{"tenant_id", "result"}, // result: applied/skipped/failed
	)

	rollbacksTriggeredTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rollbacks_triggered_total",
			Help: "Total number of auto-rollbacks triggered due to degradation",
		},
		[]string{"tenant_id", "reason"}, // reason: latency_degradation/error_rate/cost_increase
	)

	// Cryptographic verification metrics (Phase 3)
	verificationFailuresTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "verification_failures_total",
			Help: "Total number of cryptographic verification failures",
		},
		[]string{"tenant_id", "failure_type"}, // failure_type: invalid_signature/expired_nonce/decision_mismatch
	)

	decisionSigningLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "decision_signing_latency_us",
			Help:    "Routing decision signing latency in microseconds",
			Buckets: []float64{5, 10, 25, 50, 100, 250, 500},
		},
		[]string{"tenant_id"},
	)

	executionEnvelopeVerificationLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "execution_envelope_verification_latency_us",
			Help:    "Execution envelope verification latency in microseconds",
			Buckets: []float64{10, 25, 50, 100, 250, 500, 1000},
		},
		[]string{"tenant_id"},
	)
)

// RecordRateLimitExceeded records a rate limit violation
func RecordRateLimitExceeded(tenantID, endpoint string) {
	controlSurfaceRateLimitExceeded.WithLabelValues(tenantID, endpoint).Inc()
}

// RecordRateLimitAllowed records an allowed request
func RecordRateLimitAllowed(tenantID, endpoint string) {
	controlSurfaceRateLimitAllowed.WithLabelValues(tenantID, endpoint).Inc()
}

// RecordSignatureVerification records a signature verification attempt
func RecordSignatureVerification(tenantID, result string, latencyUs int64) {
	controlSurfaceSignatureVerifications.WithLabelValues(tenantID, result).Inc()
	controlSurfaceSignatureVerificationLatency.WithLabelValues(tenantID).Observe(float64(latencyUs))
}

// RecordVaultSecretRead records a Vault secret read attempt
func RecordVaultSecretRead(path, result string) {
	vaultSecretsReadTotal.WithLabelValues(path, result).Inc()
}

// RecordVaultHealth records Vault health status
func RecordVaultHealth(healthy bool) {
	if healthy {
		vaultHealthStatus.Set(1)
	} else {
		vaultHealthStatus.Set(0)
	}
}

// RecordVaultRotation records a secret rotation event
func RecordVaultRotation() {
	vaultRotationsTotal.Inc()
}

// RecordTamperDetection records a tamper detection event
func RecordTamperDetection(tenantID, detectionType string) {
	tamperDetectionsTotal.WithLabelValues(tenantID, detectionType).Inc()
}

// RecordSelfTunerRun records a self-tuner execution
func RecordSelfTunerRun(tenantID, status string) {
	selfTunerRunsTotal.WithLabelValues(tenantID, status).Inc()
	selfTunerLastRunTimestamp.WithLabelValues(tenantID).Set(float64(time.Now().Unix()))
}

// RecordAutoAppliedProposal records an auto-applied proposal result
func RecordAutoAppliedProposal(tenantID, result string) {
	autoAppliedProposalsTotal.WithLabelValues(tenantID, result).Inc()
}

// RecordRollbackTriggered records a rollback triggered due to degradation
func RecordRollbackTriggered(tenantID, reason string) {
	rollbacksTriggeredTotal.WithLabelValues(tenantID, reason).Inc()
}

// RecordVerificationFailure records a cryptographic verification failure
func RecordVerificationFailure(tenantID, failureType string) {
	verificationFailuresTotal.WithLabelValues(tenantID, failureType).Inc()
}

// RecordDecisionSigningLatency records decision signing performance
func RecordDecisionSigningLatency(tenantID string, latencyUs int64) {
	decisionSigningLatency.WithLabelValues(tenantID).Observe(float64(latencyUs))
}

// RecordExecutionEnvelopeVerificationLatency records envelope verification performance
func RecordExecutionEnvelopeVerificationLatency(tenantID string, latencyUs int64) {
	executionEnvelopeVerificationLatency.WithLabelValues(tenantID).Observe(float64(latencyUs))
}

// Quality Scorer Metrics

var (
	// Quality scorer fallback events
	qualityScorerFallbackTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "quality_scorer_fallback_total",
			Help: "Total number of fallbacks from ONNX to heuristic quality scoring",
		},
		[]string{"reason"}, // reason: onnx_init_failed/onnx_runtime_error/disabled
	)

	// Quality scorer results
	qualityScorerResultTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "quality_scorer_result_total",
			Help: "Total number of quality scoring operations by method",
		},
		[]string{"provider", "method"}, // method: onnx/heuristic/heuristic_fallback
	)

	qualityScorerScore = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "quality_scorer_score",
			Help:    "Quality scores produced by the quality scorer (0-1)",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"provider", "method"},
	)
)

// RecordQualityScorerFallback records a fallback from ONNX to heuristic scoring
func RecordQualityScorerFallback(reason string) {
	qualityScorerFallbackTotal.WithLabelValues(reason).Inc()
}

// RecordQualityScorerResult records a quality scoring result
func RecordQualityScorerResult(provider string, score float64, method string) {
	qualityScorerResultTotal.WithLabelValues(provider, method).Inc()
	qualityScorerScore.WithLabelValues(provider, method).Observe(score)
}
