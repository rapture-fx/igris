package safety

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Safety-specific Prometheus metrics
// FUTURE: These will power Customer Budget & Safety Dashboards

var (
	// Budget Metrics
	BudgetLimitTriggeredTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_budget_limit_triggered_total",
			Help: "Total number of times budget limit was triggered",
		},
		[]string{"month", "action"}, // action: "rejected" or "fallback"
	)

	BudgetCurrentSpend = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_budget_current_spend_usd",
			Help: "Current monthly spend in USD",
		},
		[]string{"month"},
	)

	BudgetPercentageUsed = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_budget_percentage_used",
			Help: "Percentage of monthly budget used",
		},
		[]string{"month"},
	)

	// Token Metrics
	TokenLimitTriggeredTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_token_limit_triggered_total",
			Help: "Total number of times token limit was triggered",
		},
		[]string{"action"}, // action: "rejected", "truncated", or "allowed"
	)

	TokensRequestedHistogram = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "igris_tokens_requested",
			Help:    "Distribution of requested token counts",
			Buckets: []float64{10, 50, 100, 256, 512, 1024, 2048, 4096, 8192},
		},
	)

	// Fallback Metrics
	BenchmarkFallbackTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_benchmark_fallback_total",
			Help: "Total number of fallbacks to benchmark mode",
		},
		[]string{"reason", "trace_id"}, // reason: "budget_exceeded", "provider_error", "test_mode"
	)

	// Key Validation Metrics
	KeyValidationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_key_validation_total",
			Help: "Total number of key validation attempts",
		},
		[]string{"provider", "result"}, // result: "valid" or "invalid"
	)

	KeyValidationLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_key_validation_latency_ms",
			Help:    "Key validation latency in milliseconds",
			Buckets: []float64{100, 500, 1000, 2000, 5000, 10000},
		},
		[]string{"provider"},
	)

	// Safety Check Metrics
	SafetyCheckTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_safety_check_total",
			Help: "Total number of safety checks performed",
		},
		[]string{"result"}, // result: "allowed", "rejected", "fallback"
	)

	SafetyCheckLatency = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "igris_safety_check_latency_ms",
			Help:    "Safety check latency in milliseconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10},
		},
	)

	// Cost Tracking Metrics
	CostByProviderTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_cost_by_provider_usd",
			Help: "Total cost in USD by provider",
		},
		[]string{"provider", "model"},
	)

	CostByModelTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_cost_by_model_usd",
			Help: "Total cost in USD by model",
		},
		[]string{"model"},
	)
)

// RecordBudgetCheck records a budget check result
func RecordBudgetCheck(month string, allowed bool, currentSpend, percentageUsed float64) {
	BudgetCurrentSpend.WithLabelValues(month).Set(currentSpend)
	BudgetPercentageUsed.WithLabelValues(month).Set(percentageUsed)

	if !allowed {
		BudgetLimitTriggeredTotal.WithLabelValues(month, "triggered").Inc()
	}
}

// RecordBudgetFallback records a fallback due to budget limit
func RecordBudgetFallback(month string, traceID string) {
	BudgetLimitTriggeredTotal.WithLabelValues(month, "fallback").Inc()
	BenchmarkFallbackTotal.WithLabelValues("budget_exceeded", traceID).Inc()
}

// RecordTokenCheck records a token limit check
func RecordTokenCheck(allowed bool, truncated bool, requestedTokens int) {
	TokensRequestedHistogram.Observe(float64(requestedTokens))

	if !allowed {
		TokenLimitTriggeredTotal.WithLabelValues("rejected").Inc()
	} else if truncated {
		TokenLimitTriggeredTotal.WithLabelValues("truncated").Inc()
	} else {
		TokenLimitTriggeredTotal.WithLabelValues("allowed").Inc()
	}
}

// RecordProviderFallback records a fallback due to provider error
func RecordProviderFallback(traceID string, reason string) {
	BenchmarkFallbackTotal.WithLabelValues(reason, traceID).Inc()
}

// RecordKeyValidation records a key validation attempt
func RecordKeyValidation(provider string, valid bool, latencyMs float64) {
	result := "valid"
	if !valid {
		result = "invalid"
	}

	KeyValidationTotal.WithLabelValues(provider, result).Inc()
	KeyValidationLatency.WithLabelValues(provider).Observe(latencyMs)
}

// RecordSafetyCheck records a safety check result
func RecordSafetyCheck(allowed bool, useBenchmark bool, latencyMs float64) {
	result := "allowed"
	if !allowed {
		result = "rejected"
	} else if useBenchmark {
		result = "fallback"
	}

	SafetyCheckTotal.WithLabelValues(result).Inc()
	SafetyCheckLatency.Observe(latencyMs)
}

// RecordCost records cost metrics
func RecordCost(provider, model string, costUSD float64) {
	CostByProviderTotal.WithLabelValues(provider, model).Add(costUSD)
	CostByModelTotal.WithLabelValues(model).Add(costUSD)
}

// TODO Phase 14: Add per-tenant metrics
// TODO Phase 14: Add cost forecasting metrics
// TODO Phase 15: Add budget alert metrics
// TODO Phase 15: Add real-time dashboard metrics
