// Package metrics provides Prometheus metrics for Igris Inertial
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// TelemetryErrors counts telemetry recording errors
	TelemetryErrors = promauto.NewCounter(prometheus.CounterOpts{
		Name: "igris_telemetry_errors_total",
		Help: "Total number of telemetry recording errors",
	})

	// TelemetryRecorded counts successfully recorded telemetry
	TelemetryRecorded = promauto.NewCounter(prometheus.CounterOpts{
		Name: "igris_telemetry_recorded_total",
		Help: "Total number of telemetry records successfully written",
	})

	// TelemetryDropped counts dropped telemetry due to queue full
	TelemetryDropped = promauto.NewCounter(prometheus.CounterOpts{
		Name: "igris_telemetry_dropped_total",
		Help: "Total number of telemetry records dropped due to queue full",
	})

	// TelemetryLatency measures telemetry recording latency
	TelemetryLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "igris_telemetry_latency_seconds",
		Help:    "Latency of telemetry recording operations",
		Buckets: prometheus.DefBuckets,
	})

	// RoutingErrors counts routing errors by type
	RoutingErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_routing_errors_total",
			Help: "Total number of routing errors by type",
		},
		[]string{"error_type"},
	)

	// ProviderRequests counts requests per provider
	ProviderRequests = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_provider_requests_total",
			Help: "Total number of requests to each provider",
		},
		[]string{"provider", "status"},
	)

	// ProviderLatency measures provider request latency
	ProviderLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "igris_provider_latency_seconds",
			Help:    "Latency of provider requests",
			Buckets: []float64{0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0},
		},
		[]string{"provider"},
	)
)
