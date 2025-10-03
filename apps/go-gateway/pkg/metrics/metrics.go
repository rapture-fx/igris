package metrics

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP metrics
	HttpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HttpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path", "status"},
	)

	// FFI metrics
	RustFFICallsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rust_ffi_calls_total",
			Help: "Total number of Rust FFI calls",
		},
		[]string{"function", "status"},
	)

	RustFFIDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "rust_ffi_duration_microseconds",
			Help:    "Rust FFI call latency in microseconds",
			Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
		},
		[]string{"function"},
	)

	// gRPC client metrics
	GrpcCallsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_client_calls_total",
			Help: "Total number of gRPC client calls",
		},
		[]string{"service", "method", "status"},
	)

	GrpcCallDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grpc_client_call_duration_milliseconds",
			Help:    "gRPC client call latency in milliseconds",
			Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000},
		},
		[]string{"service", "method"},
	)

	// Database metrics
	DbQueriesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "db_queries_total",
			Help: "Total number of database queries",
		},
		[]string{"operation", "table", "status"},
	)

	DbQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "db_query_duration_milliseconds",
			Help:    "Database query latency in milliseconds",
			Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
		},
		[]string{"operation", "table"},
	)

	// Cache metrics
	CacheOperationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_operations_total",
			Help: "Total number of cache operations",
		},
		[]string{"operation", "status"},
	)

	CacheHitRatio = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "cache_hit_ratio",
			Help: "Cache hit ratio (hits / total requests)",
		},
		[]string{"cache_type"},
	)
)

// RecordHTTPRequest records HTTP request metrics
func RecordHTTPRequest(method, path string, status int, duration time.Duration) {
	statusStr := strconv.Itoa(status)
	HttpRequestsTotal.WithLabelValues(method, path, statusStr).Inc()
	HttpRequestDuration.WithLabelValues(method, path, statusStr).Observe(duration.Seconds())
}

// RecordRustFFICall records Rust FFI call metrics
func RecordRustFFICall(function, status string, duration time.Duration) {
	RustFFICallsTotal.WithLabelValues(function, status).Inc()
	RustFFIDuration.WithLabelValues(function).Observe(float64(duration.Microseconds()))
}

// RecordGrpcCall records gRPC client call metrics
func RecordGrpcCall(service, method, status string, duration time.Duration) {
	GrpcCallsTotal.WithLabelValues(service, method, status).Inc()
	GrpcCallDuration.WithLabelValues(service, method).Observe(float64(duration.Milliseconds()))
}

// RecordDatabaseQuery records database query metrics
func RecordDatabaseQuery(operation, table, status string, duration time.Duration) {
	DbQueriesTotal.WithLabelValues(operation, table, status).Inc()
	DbQueryDuration.WithLabelValues(operation, table).Observe(float64(duration.Milliseconds()))
}

// RecordCacheOperation records cache operation metrics
func RecordCacheOperation(operation, status string) {
	CacheOperationsTotal.WithLabelValues(operation, status).Inc()
}

// UpdateCacheHitRatio updates cache hit ratio gauge
func UpdateCacheHitRatio(cacheType string, ratio float64) {
	CacheHitRatio.WithLabelValues(cacheType).Set(ratio)
}

// MetricsMiddleware is a Fiber middleware for collecting HTTP metrics
func MetricsMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Continue to next handler
		err := c.Next()

		// Record metrics after request is complete
		duration := time.Since(start)
		status := c.Response().StatusCode()
		method := c.Method()
		path := c.Route().Path

		RecordHTTPRequest(method, path, status, duration)

		return err
	}
}
