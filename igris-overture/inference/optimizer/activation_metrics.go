// Package optimizer provides activation metrics for the Rust optimizer phased rollout.
package optimizer

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// OptimizerLiveSampleRate tracks the current live sample rate for Rust optimizer
	OptimizerLiveSampleRate = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "optimizer_live_sample_rate",
		Help: "Current live sample rate for Rust optimizer activation (0.0 to 1.0)",
	})

	// OptimizerCurrentModeInfo tracks the current optimizer mode as an info metric
	OptimizerCurrentModeInfo = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "optimizer_current_mode_info",
		Help: "Current optimizer mode (1=active, 0=inactive)",
	}, []string{"mode"}) // mode: go, shadow, rust

	// OptimizerRustDecisionsTotal tracks total live decisions made by Rust optimizer
	OptimizerRustDecisionsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "optimizer_rust_decisions_total",
		Help: "Total number of live routing decisions made by Rust optimizer",
	})

	// OptimizerGoFallbacksTotal tracks total fallbacks to Go router
	OptimizerGoFallbacksTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "optimizer_go_fallbacks_total",
		Help: "Total fallbacks to Go router by reason",
	}, []string{"reason"}) // reason: error, panic, slo_breach, sample_skip

	// OptimizerSLOBreaksTotal tracks total SLO guardrail breaches
	OptimizerSLOBreaksTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "optimizer_slo_breaks_total",
		Help: "Total SLO guardrail breaches by metric type",
	}, []string{"metric_type"}) // metric_type: p95_latency, cost_delta, error_rate

	// OptimizerRustFailuresTotal tracks Rust optimizer failures
	OptimizerRustFailuresTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "optimizer_rust_failures_total",
		Help: "Total Rust optimizer failures by error type",
	}, []string{"error_type"}) // error_type: ffi_error, panic, null_response

	// OptimizerActivationRequestsTotal tracks total requests processed in each mode
	OptimizerActivationRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "optimizer_activation_requests_total",
		Help: "Total inference requests by optimizer mode",
	}, []string{"mode", "decision_source"}) // mode: go|shadow|rust, decision_source: go_router|rust_optimizer

	// OptimizerActivationLatencyMs tracks latency by decision source
	OptimizerActivationLatencyMs = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "optimizer_activation_latency_ms",
		Help:    "Inference latency by decision source in milliseconds",
		Buckets: []float64{10, 25, 50, 100, 250, 500, 1000, 2000, 5000},
	}, []string{"decision_source"}) // decision_source: go_router|rust_optimizer

	// OptimizerActivationCostUsd tracks cost by decision source
	OptimizerActivationCostUsd = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "optimizer_activation_cost_usd",
		Help:    "Inference cost by decision source in USD",
		Buckets: []float64{0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1},
	}, []string{"decision_source"}) // decision_source: go_router|rust_optimizer
)

// ActivationMetricsRecorder provides convenience methods for recording activation metrics
type ActivationMetricsRecorder struct{}

// NewActivationMetricsRecorder creates a new activation metrics recorder
func NewActivationMetricsRecorder() *ActivationMetricsRecorder {
	return &ActivationMetricsRecorder{}
}

// UpdateCurrentMode updates the current optimizer mode gauge
func (m *ActivationMetricsRecorder) UpdateCurrentMode(mode string) {
	// Reset all modes to 0
	OptimizerCurrentModeInfo.WithLabelValues("go").Set(0)
	OptimizerCurrentModeInfo.WithLabelValues("shadow").Set(0)
	OptimizerCurrentModeInfo.WithLabelValues("rust").Set(0)

	// Set active mode to 1
	OptimizerCurrentModeInfo.WithLabelValues(mode).Set(1)
}

// UpdateSampleRate updates the live sample rate gauge
func (m *ActivationMetricsRecorder) UpdateSampleRate(rate float64) {
	OptimizerLiveSampleRate.Set(rate)
}

// RecordRustDecision records a live Rust optimizer decision
func (m *ActivationMetricsRecorder) RecordRustDecision() {
	OptimizerRustDecisionsTotal.Inc()
}

// RecordGoFallback records a fallback to Go router
func (m *ActivationMetricsRecorder) RecordGoFallback(reason string) {
	OptimizerGoFallbacksTotal.WithLabelValues(reason).Inc()
}

// RecordSLOBreak records an SLO guardrail breach
func (m *ActivationMetricsRecorder) RecordSLOBreak(metricType string) {
	OptimizerSLOBreaksTotal.WithLabelValues(metricType).Inc()
}

// RecordRustFailure records a Rust optimizer failure
func (m *ActivationMetricsRecorder) RecordRustFailure(errorType string) {
	OptimizerRustFailuresTotal.WithLabelValues(errorType).Inc()
}

// RecordRequest records a request processed in a specific mode
func (m *ActivationMetricsRecorder) RecordRequest(mode, decisionSource string) {
	OptimizerActivationRequestsTotal.WithLabelValues(mode, decisionSource).Inc()
}

// RecordLatency records latency for a decision source
func (m *ActivationMetricsRecorder) RecordLatency(decisionSource string, latencyMs float64) {
	OptimizerActivationLatencyMs.WithLabelValues(decisionSource).Observe(latencyMs)
}

// RecordCost records cost for a decision source
func (m *ActivationMetricsRecorder) RecordCost(decisionSource string, costUsd float64) {
	OptimizerActivationCostUsd.WithLabelValues(decisionSource).Observe(costUsd)
}
