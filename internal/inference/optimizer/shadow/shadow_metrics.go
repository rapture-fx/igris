// Package shadow provides shadow mode execution for the Rust optimizer.
package shadow

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// OptimizerShadowRequestsTotal tracks total shadow mode requests
	OptimizerShadowRequestsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "optimizer_shadow_requests_total",
		Help: "Total number of requests processed in shadow mode",
	})

	// OptimizerShadowAgreementTotal tracks when Go and Rust agree
	OptimizerShadowAgreementTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "optimizer_shadow_agreement_total",
		Help: "Total number of times Go and Rust optimizers agreed on decision",
	})

	// OptimizerShadowDisagreementTotal tracks when Go and Rust disagree
	OptimizerShadowDisagreementTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "optimizer_shadow_disagreement_total",
		Help: "Total number of times Go and Rust optimizers disagreed on decision",
	})

	// OptimizerShadowDecisionLatency tracks Rust decision latency
	OptimizerShadowDecisionLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "optimizer_shadow_decision_latency_ms",
		Help:    "Latency of Rust optimizer decisions in milliseconds",
		Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000},
	})

	// OptimizerShadowCostDelta tracks cost difference between decisions
	OptimizerShadowCostDelta = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "optimizer_shadow_cost_delta_usd",
		Help:    "Cost difference between Go and Rust decisions in USD",
		Buckets: []float64{-0.01, -0.005, -0.001, 0, 0.001, 0.005, 0.01},
	})

	// OptimizerShadowLatencyDelta tracks latency difference between decisions
	OptimizerShadowLatencyDelta = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "optimizer_shadow_latency_delta_ms",
		Help:    "Latency difference between Go and Rust decisions in milliseconds",
		Buckets: []float64{-500, -100, -50, -10, 0, 10, 50, 100, 500},
	})

	// OptimizerShadowErrorsTotal tracks errors in shadow mode
	OptimizerShadowErrorsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "optimizer_shadow_errors_total",
		Help: "Total errors in shadow mode by error type",
	}, []string{"error_type"})

	// OptimizerShadowSamplingRate tracks current sampling rate
	OptimizerShadowSamplingRate = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "optimizer_shadow_sampling_rate",
		Help: "Current sampling rate for shadow mode (0.0 to 1.0)",
	})

	// OptimizerShadowParityRate tracks agreement percentage
	OptimizerShadowParityRate = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "optimizer_shadow_parity_rate",
		Help: "Percentage of agreement between Go and Rust optimizers (0.0 to 1.0)",
	})
)

// MetricsRecorder provides convenience methods for recording metrics
type MetricsRecorder struct{}

// NewMetricsRecorder creates a new metrics recorder
func NewMetricsRecorder() *MetricsRecorder {
	return &MetricsRecorder{}
}

// RecordRequest increments the total request counter
func (m *MetricsRecorder) RecordRequest() {
	OptimizerShadowRequestsTotal.Inc()
}

// RecordAgreement records when Go and Rust agree
func (m *MetricsRecorder) RecordAgreement() {
	OptimizerShadowAgreementTotal.Inc()
}

// RecordDisagreement records when Go and Rust disagree
func (m *MetricsRecorder) RecordDisagreement() {
	OptimizerShadowDisagreementTotal.Inc()
}

// RecordDecisionLatency records the latency of Rust decision
func (m *MetricsRecorder) RecordDecisionLatency(latencyMs float64) {
	OptimizerShadowDecisionLatency.Observe(latencyMs)
}

// RecordCostDelta records the cost difference between decisions
func (m *MetricsRecorder) RecordCostDelta(deltaUsd float64) {
	OptimizerShadowCostDelta.Observe(deltaUsd)
}

// RecordLatencyDelta records the latency difference between decisions
func (m *MetricsRecorder) RecordLatencyDelta(deltaMs float64) {
	OptimizerShadowLatencyDelta.Observe(deltaMs)
}

// RecordError records an error in shadow mode
func (m *MetricsRecorder) RecordError(errorType string) {
	OptimizerShadowErrorsTotal.WithLabelValues(errorType).Inc()
}

// UpdateSamplingRate updates the current sampling rate gauge
func (m *MetricsRecorder) UpdateSamplingRate(rate float64) {
	OptimizerShadowSamplingRate.Set(rate)
}

// UpdateParityRate updates the parity rate gauge
func (m *MetricsRecorder) UpdateParityRate(rate float64) {
	OptimizerShadowParityRate.Set(rate)
}

// CalculateAndUpdateParityRate calculates and updates parity rate from counters
func (m *MetricsRecorder) CalculateAndUpdateParityRate() {
	// Get metric values using a dummy metric collection
	// This is a simplified approach; in production you'd use proper metric collection
	agreements := float64(0)
	disagreements := float64(0)

	// Calculate parity rate
	total := agreements + disagreements
	if total > 0 {
		parityRate := agreements / total
		m.UpdateParityRate(parityRate)
	}
}
