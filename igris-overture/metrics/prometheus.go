package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Phase 4.3.1: Extended Prometheus Metrics
// Comprehensive metrics for observability, including optimizer decisions,
// cost tracking, and latency histograms

var (
	// ==========================================
	// Request Metrics
	// ==========================================

	// InferenceRequestsTotal counts total inference requests by provider, model, and status
	InferenceRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_inference_requests_total",
			Help: "Total number of inference requests",
		},
		[]string{"provider", "model", "status", "tenant_id"},
	)

	// InferenceRequestDuration tracks request latency distribution
	InferenceRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_inference_request_duration_seconds",
			Help:    "Duration of inference requests in seconds",
			Buckets: prometheus.ExponentialBuckets(0.01, 2, 12), // 10ms to ~40s
		},
		[]string{"provider", "model", "tenant_id"},
	)

	// InferenceRequestLatencyMs tracks detailed latency in milliseconds
	InferenceRequestLatencyMs = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_inference_latency_milliseconds",
			Help:    "Inference request latency in milliseconds",
			Buckets: []float64{10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000},
		},
		[]string{"provider", "model"},
	)

	// ==========================================
	// Optimizer Metrics (NEW - Task 4.3.1)
	// ==========================================

	// OptimizerDecisionsTotal counts optimizer decisions by provider
	OptimizerDecisionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_optimizer_decisions_total",
			Help: "Total number of optimizer provider selections",
		},
		[]string{"provider", "algorithm"},
	)

	// OptimizerSelectionDuration tracks optimizer decision latency
	OptimizerSelectionDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "igris_optimizer_selection_duration_microseconds",
			Help:    "Time taken for optimizer to select provider in microseconds",
			Buckets: []float64{100, 250, 500, 1000, 2500, 5000, 10000},
		},
	)

	// OptimizerArmStats tracks Thompson Sampling arm statistics
	OptimizerArmStats = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_optimizer_arm_stats",
			Help: "Thompson Sampling arm statistics (alpha/beta parameters)",
		},
		[]string{"provider", "stat_type"}, // stat_type: alpha, beta, success_rate
	)

	// OptimizerRewardValue tracks reward values
	OptimizerRewardValue = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_optimizer_reward_value",
			Help:    "Distribution of reward values given to optimizer",
			Buckets: []float64{0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"provider"},
	)

	// ==========================================
	// Cost Metrics (NEW - Task 4.3.1)
	// ==========================================

	// InferenceCostUSD tracks cost per request
	InferenceCostUSD = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_inference_cost_usd",
			Help:    "Cost per inference request in USD",
			Buckets: []float64{0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0},
		},
		[]string{"provider", "model"},
	)

	// InferenceTotalCostUSD tracks cumulative costs
	InferenceTotalCostUSD = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_inference_total_cost_usd",
			Help: "Total cumulative cost of inference requests in USD",
		},
		[]string{"provider", "model", "tenant_id"},
	)

	// TenantMonthlyCostUSD tracks per-tenant monthly costs
	TenantMonthlyCostUSD = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_tenant_monthly_cost_usd",
			Help: "Current month-to-date cost per tenant in USD",
		},
		[]string{"tenant_id"},
	)

	// TenantBudgetUtilization tracks budget usage percentage
	TenantBudgetUtilization = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_tenant_budget_utilization_percent",
			Help: "Percentage of monthly budget utilized by tenant",
		},
		[]string{"tenant_id"},
	)

	// ==========================================
	// Token Metrics
	// ==========================================

	// InferenceTokensTotal tracks token usage
	InferenceTokensTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_inference_tokens_total",
			Help: "Total tokens processed in inference requests",
		},
		[]string{"provider", "model", "token_type"}, // token_type: prompt, completion, total
	)

	// InferenceTokensPerRequest tracks token distribution
	InferenceTokensPerRequest = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_inference_tokens_per_request",
			Help:    "Distribution of tokens per request",
			Buckets: []float64{10, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000},
		},
		[]string{"provider", "model", "token_type"},
	)

	// ==========================================
	// Provider Performance Metrics
	// ==========================================

	// ProviderAvailability tracks provider success rate
	ProviderAvailability = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_provider_availability_percent",
			Help: "Provider availability/success rate percentage",
		},
		[]string{"provider"},
	)

	// ProviderErrorsTotal counts errors by type
	ProviderErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_provider_errors_total",
			Help: "Total provider errors by type",
		},
		[]string{"provider", "error_type"}, // error_type: timeout, auth, rate_limit, api_error, etc.
	)

	// ProviderTimeouts tracks timeout occurrences
	ProviderTimeouts = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_provider_timeouts_total",
			Help: "Total number of provider timeouts",
		},
		[]string{"provider"},
	)

	// ==========================================
	// Rate Limiter Metrics (NEW - Anthropic rate limiting)
	// ==========================================

	// ProviderRateLimitHits counts rate limit hits (HTTP 429)
	ProviderRateLimitHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_provider_rate_limit_hits_total",
			Help: "Total number of rate limit hits (HTTP 429) by provider",
		},
		[]string{"provider"},
	)

	// ProviderRetryAttempts counts retry attempts by reason
	ProviderRetryAttempts = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_provider_retry_attempts_total",
			Help: "Total number of retry attempts by provider and reason",
		},
		[]string{"provider", "reason"}, // reason: rate_limit, server_error, timeout
	)

	// ProviderQueueWaitMs tracks time spent waiting in queue
	ProviderQueueWaitMs = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_provider_queue_wait_milliseconds",
			Help:    "Time spent waiting in rate limiter queue in milliseconds",
			Buckets: []float64{10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000},
		},
		[]string{"provider"},
	)

	// ProviderQueueLength tracks current queue length
	ProviderQueueLength = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_provider_queue_length",
			Help: "Current number of requests waiting in rate limiter queue",
		},
		[]string{"provider"},
	)

	// ProviderRateLimiterTokens tracks available rate limiter tokens
	ProviderRateLimiterTokens = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_provider_rate_limiter_tokens",
			Help: "Available tokens in rate limiter (request or token budget)",
		},
		[]string{"provider", "token_type"}, // token_type: request, api_token
	)

	// ==========================================
	// Cache Metrics
	// ==========================================

	// CacheOperations tracks cache hits/misses
	CacheOperations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_cache_operations_total",
			Help: "Total cache operations by result",
		},
		[]string{"operation", "result"}, // operation: get, set, delete; result: hit, miss, error
	)

	// CacheLatency tracks cache operation latency
	CacheLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_cache_operation_duration_milliseconds",
			Help:    "Cache operation latency in milliseconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 25, 50, 100},
		},
		[]string{"operation"},
	)

	// CacheHitRate tracks cache hit rate
	CacheHitRate = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "igris_cache_hit_rate_percent",
			Help: "Cache hit rate percentage",
		},
	)

	// ==========================================
	// Database Metrics
	// ==========================================

	// DatabaseQueryDuration tracks database query latency
	DatabaseQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_database_query_duration_milliseconds",
			Help:    "Database query duration in milliseconds",
			Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
		},
		[]string{"query_type"}, // query_type: select, insert, update, delete
	)

	// DatabaseConnectionPoolSize tracks connection pool metrics
	DatabaseConnectionPoolSize = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_database_connection_pool",
			Help: "Database connection pool metrics",
		},
		[]string{"state"}, // state: idle, in_use, max
	)

	// ==========================================
	// Business Metrics (NEW - Task 4.3.1)
	// ==========================================

	// ActiveTenantsTotal tracks number of active tenants
	ActiveTenantsTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "igris_active_tenants_total",
			Help: "Total number of active tenants",
		},
	)

	// TenantRequestsTotal tracks per-tenant request counts
	TenantRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_tenant_requests_total",
			Help: "Total requests per tenant",
		},
		[]string{"tenant_id"},
	)

	// ModelUsageTotal tracks model popularity
	ModelUsageTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_model_usage_total",
			Help: "Total usage count per model",
		},
		[]string{"provider", "model"},
	)

	// ==========================================
	// System Metrics
	// ==========================================

	// SystemInfo provides static system information
	SystemInfo = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_system_info",
			Help: "System version and build information",
		},
		[]string{"version", "go_version", "rust_enabled"},
	)

	// GoroutinesActive tracks active goroutines
	GoroutinesActive = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "igris_goroutines_active",
			Help: "Number of active goroutines",
		},
	)
)

// ==========================================
// Helper Functions for Recording Metrics
// ==========================================

// RecordInferenceRequest records comprehensive inference metrics
func RecordInferenceRequestMetrics(
	provider, model, tenantID string,
	latencyMs int64,
	promptTokens, completionTokens, totalTokens int,
	costUSD float64,
	success bool,
) {
	status := "success"
	if !success {
		status = "error"
	}

	// Request count
	InferenceRequestsTotal.WithLabelValues(provider, model, status, tenantID).Inc()

	// Latency
	latencySeconds := float64(latencyMs) / 1000.0
	InferenceRequestDuration.WithLabelValues(provider, model, tenantID).Observe(latencySeconds)
	InferenceRequestLatencyMs.WithLabelValues(provider, model).Observe(float64(latencyMs))

	if success {
		// Cost
		InferenceCostUSD.WithLabelValues(provider, model).Observe(costUSD)
		InferenceTotalCostUSD.WithLabelValues(provider, model, tenantID).Add(costUSD)

		// Tokens
		InferenceTokensTotal.WithLabelValues(provider, model, "prompt").Add(float64(promptTokens))
		InferenceTokensTotal.WithLabelValues(provider, model, "completion").Add(float64(completionTokens))
		InferenceTokensTotal.WithLabelValues(provider, model, "total").Add(float64(totalTokens))

		InferenceTokensPerRequest.WithLabelValues(provider, model, "prompt").Observe(float64(promptTokens))
		InferenceTokensPerRequest.WithLabelValues(provider, model, "completion").Observe(float64(completionTokens))
		InferenceTokensPerRequest.WithLabelValues(provider, model, "total").Observe(float64(totalTokens))

		// Model usage
		ModelUsageTotal.WithLabelValues(provider, model).Inc()

		// Tenant tracking
		if tenantID != "" {
			TenantRequestsTotal.WithLabelValues(tenantID).Inc()
		}
	}
}

// RecordOptimizerDecision records optimizer selection metrics
func RecordOptimizerDecision(provider, algorithm string, selectionTimeUs int64, reward float64) {
	// Decision count
	OptimizerDecisionsTotal.WithLabelValues(provider, algorithm).Inc()

	// Selection time
	OptimizerSelectionDuration.Observe(float64(selectionTimeUs))

	// Reward value
	if reward >= 0 {
		OptimizerRewardValue.WithLabelValues(provider).Observe(reward)
	}
}

// UpdateOptimizerArmStats updates Thompson Sampling arm statistics
func UpdateOptimizerArmStats(provider string, alpha, beta, successRate float64) {
	OptimizerArmStats.WithLabelValues(provider, "alpha").Set(alpha)
	OptimizerArmStats.WithLabelValues(provider, "beta").Set(beta)
	OptimizerArmStats.WithLabelValues(provider, "success_rate").Set(successRate)
}

// RecordProviderError records provider error metrics
func RecordProviderError(provider, errorType string) {
	ProviderErrorsTotal.WithLabelValues(provider, errorType).Inc()

	if errorType == "timeout" {
		ProviderTimeouts.WithLabelValues(provider).Inc()
	}
}

// UpdateProviderAvailability updates provider availability gauge
func UpdateProviderAvailability(provider string, availabilityPercent float64) {
	ProviderAvailability.WithLabelValues(provider).Set(availabilityPercent)
}

// RecordRateLimitHit records a rate limit hit (HTTP 429)
func RecordRateLimitHit(provider string) {
	ProviderRateLimitHits.WithLabelValues(provider).Inc()
}

// RecordRetryAttempt records a retry attempt with reason
func RecordRetryAttempt(provider, reason string) {
	ProviderRetryAttempts.WithLabelValues(provider, reason).Inc()
}

// RecordQueueWait records time spent waiting in queue
func RecordQueueWait(provider string, waitMs int64) {
	ProviderQueueWaitMs.WithLabelValues(provider).Observe(float64(waitMs))
}

// UpdateQueueLength updates current queue length
func UpdateQueueLength(provider string, length int) {
	ProviderQueueLength.WithLabelValues(provider).Set(float64(length))
}

// UpdateRateLimiterTokens updates available rate limiter tokens
func UpdateRateLimiterTokens(provider string, requestTokens, apiTokens float64) {
	ProviderRateLimiterTokens.WithLabelValues(provider, "request").Set(requestTokens)
	ProviderRateLimiterTokens.WithLabelValues(provider, "api_token").Set(apiTokens)
}

// RecordCacheOperation records cache metrics
func RecordCacheOperation(operation, result string, latencyMs float64) {
	CacheOperations.WithLabelValues(operation, result).Inc()
	CacheLatency.WithLabelValues(operation).Observe(latencyMs)
}

// UpdateCacheHitRate updates cache hit rate
func UpdateCacheHitRate(hitRatePercent float64) {
	CacheHitRate.Set(hitRatePercent)
}

// RecordDatabaseQuery records database query metrics
func RecordDatabaseQuery(queryType string, durationMs float64) {
	DatabaseQueryDuration.WithLabelValues(queryType).Observe(durationMs)
}

// UpdateDatabaseConnectionPool updates connection pool metrics
func UpdateDatabaseConnectionPool(idle, inUse, max int) {
	DatabaseConnectionPoolSize.WithLabelValues("idle").Set(float64(idle))
	DatabaseConnectionPoolSize.WithLabelValues("in_use").Set(float64(inUse))
	DatabaseConnectionPoolSize.WithLabelValues("max").Set(float64(max))
}

// UpdateTenantMetrics updates per-tenant cost and budget metrics
func UpdateTenantMetrics(tenantID string, monthlyCostUSD, budgetUSD float64) {
	TenantMonthlyCostUSD.WithLabelValues(tenantID).Set(monthlyCostUSD)

	if budgetUSD > 0 {
		utilizationPercent := (monthlyCostUSD / budgetUSD) * 100
		TenantBudgetUtilization.WithLabelValues(tenantID).Set(utilizationPercent)
	}
}

// UpdateActiveTenants updates active tenant count
func UpdateActiveTenants(count int) {
	ActiveTenantsTotal.Set(float64(count))
}

// UpdateSystemInfo sets system information metrics
func UpdateSystemInfo(version, goVersion string, rustEnabled bool) {
	rustEnabledStr := "false"
	if rustEnabled {
		rustEnabledStr = "true"
	}
	SystemInfo.WithLabelValues(version, goVersion, rustEnabledStr).Set(1)
}

// UpdateGoroutineCount updates active goroutine count
func UpdateGoroutineCount(count int) {
	GoroutinesActive.Set(float64(count))
}

// ==========================================
// Operations Metrics (P3-4 Monitoring)
// ==========================================

var (
	// BillingWebhookFailuresTotal counts Polar webhook processing errors
	BillingWebhookFailuresTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "billing_webhook_failures_total",
			Help: "Total number of Polar billing webhook processing failures",
		},
	)

	// RuntimeInstallAttemptsTotal counts all requests to the public runtime install endpoint
	RuntimeInstallAttemptsTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "runtime_install_attempts_total",
			Help: "Total number of runtime binary install download attempts",
		},
	)

	// RuntimeInstallCompletionsTotal counts successfully completed runtime binary downloads
	RuntimeInstallCompletionsTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "runtime_install_completions_total",
			Help: "Total number of runtime binary install downloads that completed successfully (HTTP 200)",
		},
	)

	// ActiveRuntimeAgents tracks the current number of registered runtime agents
	ActiveRuntimeAgents = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "igris_active_runtime_agents",
			Help: "Number of currently registered and active runtime agents",
		},
	)
)

// ==========================================
// Cognitive Layer Metrics (v1.2.0)
// ==========================================

var (
	// CognitiveProposalsGenerated tracks total proposals generated
	CognitiveProposalsGenerated = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_cognitive_proposals_generated_total",
			Help: "Total number of cognitive proposals generated",
		},
		[]string{"tenant_id"},
	)

	// CognitiveProposalsApproved tracks approved proposals
	CognitiveProposalsApproved = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_cognitive_proposals_approved_total",
			Help: "Total number of cognitive proposals approved",
		},
		[]string{"tenant_id"},
	)

	// CognitiveProposalsRejected tracks rejected proposals
	CognitiveProposalsRejected = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_cognitive_proposals_rejected_total",
			Help: "Total number of cognitive proposals rejected",
		},
		[]string{"tenant_id"},
	)

	// CognitiveProposalsApplied tracks applied proposals
	CognitiveProposalsApplied = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_cognitive_proposals_applied_total",
			Help: "Total number of cognitive proposals applied",
		},
		[]string{"tenant_id"},
	)

	// CognitiveConfidence tracks confidence distribution
	CognitiveConfidenceHistogram = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "igris_cognitive_confidence_histogram",
			Help:    "Distribution of cognitive proposal confidence scores",
			Buckets: []float64{0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0},
		},
	)

	// CognitiveRiskScore tracks risk score distribution
	CognitiveRiskScore = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "igris_cognitive_risk_score_histogram",
			Help:    "Distribution of cognitive proposal risk scores",
			Buckets: []float64{0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
	)

	// CognitiveAnalysisDuration tracks analysis time
	CognitiveAnalysisDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "igris_cognitive_analysis_duration_seconds",
			Help:    "Time taken for cognitive analysis in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
		},
	)

	// CognitiveProjectedSavings tracks projected cost savings
	CognitiveProjectedSavingsUSD = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "igris_cognitive_projected_savings_usd",
			Help:    "Projected monthly cost savings in USD",
			Buckets: []float64{10, 50, 100, 250, 500, 1000, 2500, 5000, 10000},
		},
	)

	// CognitiveProjectedLatencyReduction tracks projected latency improvements
	CognitiveProjectedLatencyReduction = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "igris_cognitive_projected_latency_reduction_pct",
			Help:    "Projected P95 latency reduction percentage",
			Buckets: []float64{5, 10, 15, 20, 25, 30, 40, 50},
		},
	)
)

// RecordCognitiveProposalGenerated records a generated proposal
func RecordCognitiveProposalGenerated(tenantID string, confidence, riskScore float64, analysisDurationSeconds float64) {
	CognitiveProposalsGenerated.WithLabelValues(tenantID).Inc()
	CognitiveConfidenceHistogram.Observe(confidence)
	CognitiveRiskScore.Observe(riskScore)
	CognitiveAnalysisDuration.Observe(analysisDurationSeconds)
}

// RecordCognitiveProposalApproved records an approved proposal
func RecordCognitiveProposalApproved(tenantID string) {
	CognitiveProposalsApproved.WithLabelValues(tenantID).Inc()
}

// RecordCognitiveProposalRejected records a rejected proposal
func RecordCognitiveProposalRejected(tenantID string) {
	CognitiveProposalsRejected.WithLabelValues(tenantID).Inc()
}

// RecordCognitiveProposalApplied records an applied proposal with impact
func RecordCognitiveProposalApplied(tenantID string, projectedSavingsUSD, projectedLatencyReductionPct float64) {
	CognitiveProposalsApplied.WithLabelValues(tenantID).Inc()

	if projectedSavingsUSD > 0 {
		CognitiveProjectedSavingsUSD.Observe(projectedSavingsUSD)
	}

	if projectedLatencyReductionPct > 0 {
		CognitiveProjectedLatencyReduction.Observe(projectedLatencyReductionPct)
	}
}
