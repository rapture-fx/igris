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
