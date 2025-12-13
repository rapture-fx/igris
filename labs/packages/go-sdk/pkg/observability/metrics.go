package observability

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel"
)

// MetricsCollector handles metrics collection for the SDK
type MetricsCollector struct {
	enabled     bool
	serviceName string
	
	// Prometheus metrics
	requestCounter        *prometheus.CounterVec
	requestDuration       *prometheus.HistogramVec
	requestsInFlight      *prometheus.GaugeVec
	errorCounter          *prometheus.CounterVec
	circuitBreakerState   *prometheus.GaugeVec
	retryCounter          *prometheus.CounterVec
	authCounter           *prometheus.CounterVec
	jobCounter            *prometheus.CounterVec
	jobDuration           *prometheus.HistogramVec
	healthCheckStatus     *prometheus.GaugeVec
	cacheHits             *prometheus.CounterVec
	rateLimitHits         *prometheus.CounterVec
	websocketConnections  *prometheus.GaugeVec
	websocketMessages     *prometheus.CounterVec
	
	// OpenTelemetry metrics
	otelMeter metric.Meter
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(serviceName string, enabled bool) *MetricsCollector {
	if !enabled {
		return &MetricsCollector{
			enabled:     false,
			serviceName: serviceName,
		}
	}

	// Create Prometheus metrics
	requestCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schlep_requests_total",
			Help: "Total number of HTTP requests made to Schlep-engine API",
		},
		[]string{"method", "endpoint", "status_code", "service"},
	)

	requestDuration := promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "schlep_request_duration_seconds",
			Help:    "Duration of HTTP requests to Schlep-engine API",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint", "status_code", "service"},
	)

	requestsInFlight := promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "schlep_requests_in_flight",
			Help: "Number of HTTP requests currently in flight",
		},
		[]string{"method", "endpoint", "service"},
	)

	errorCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schlep_errors_total",
			Help: "Total number of errors by type",
		},
		[]string{"error_type", "component", "service"},
	)

	circuitBreakerState := promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "schlep_circuit_breaker_state",
			Help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
		},
		[]string{"name", "service"},
	)

	retryCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schlep_retries_total",
			Help: "Total number of retry attempts",
		},
		[]string{"operation", "success", "service"},
	)

	authCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schlep_auth_attempts_total",
			Help: "Total number of authentication attempts",
		},
		[]string{"method", "success", "service"},
	)

	jobCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schlep_jobs_total",
			Help: "Total number of jobs processed",
		},
		[]string{"job_type", "status", "service"},
	)

	jobDuration := promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "schlep_job_duration_seconds",
			Help:    "Duration of job processing",
			Buckets: []float64{1, 5, 10, 30, 60, 300, 600, 1800, 3600}, // 1s to 1h
		},
		[]string{"job_type", "status", "service"},
	)

	healthCheckStatus := promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "schlep_health_check_status",
			Help: "Health check status (1=healthy, 0=unhealthy)",
		},
		[]string{"check_name", "service"},
	)

	cacheHits := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schlep_cache_operations_total",
			Help: "Total number of cache operations",
		},
		[]string{"operation", "hit", "service"},
	)

	rateLimitHits := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schlep_rate_limit_hits_total",
			Help: "Total number of rate limit hits",
		},
		[]string{"operation", "allowed", "service"},
	)

	websocketConnections := promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "schlep_websocket_connections",
			Help: "Number of active WebSocket connections",
		},
		[]string{"channel", "service"},
	)

	websocketMessages := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schlep_websocket_messages_total",
			Help: "Total number of WebSocket messages",
		},
		[]string{"channel", "type", "direction", "service"},
	)

	// OpenTelemetry meter
	otelMeter := otel.Meter("igris-inertial-go-sdk")

	return &MetricsCollector{
		enabled:               true,
		serviceName:           serviceName,
		requestCounter:        requestCounter,
		requestDuration:       requestDuration,
		requestsInFlight:      requestsInFlight,
		errorCounter:          errorCounter,
		circuitBreakerState:   circuitBreakerState,
		retryCounter:          retryCounter,
		authCounter:           authCounter,
		jobCounter:            jobCounter,
		jobDuration:           jobDuration,
		healthCheckStatus:     healthCheckStatus,
		cacheHits:             cacheHits,
		rateLimitHits:         rateLimitHits,
		websocketConnections:  websocketConnections,
		websocketMessages:     websocketMessages,
		otelMeter:            otelMeter,
	}
}

// RecordHTTPRequest records HTTP request metrics
func (m *MetricsCollector) RecordHTTPRequest(method, endpoint string, statusCode int, duration time.Duration) {
	if !m.enabled {
		return
	}

	labels := prometheus.Labels{
		"method":      method,
		"endpoint":    endpoint,
		"status_code": fmt.Sprintf("%d", statusCode),
		"service":     m.serviceName,
	}

	m.requestCounter.With(labels).Inc()
	m.requestDuration.With(labels).Observe(duration.Seconds())
}

// RecordRequestInFlight records in-flight request metrics
func (m *MetricsCollector) RecordRequestInFlight(method, endpoint string, delta float64) {
	if !m.enabled {
		return
	}

	m.requestsInFlight.With(prometheus.Labels{
		"method":   method,
		"endpoint": endpoint,
		"service":  m.serviceName,
	}).Add(delta)
}

// RecordError records error metrics
func (m *MetricsCollector) RecordError(errorType, component string) {
	if !m.enabled {
		return
	}

	m.errorCounter.With(prometheus.Labels{
		"error_type": errorType,
		"component":  component,
		"service":    m.serviceName,
	}).Inc()
}

// RecordCircuitBreakerState records circuit breaker state
func (m *MetricsCollector) RecordCircuitBreakerState(name string, state string) {
	if !m.enabled {
		return
	}

	var stateValue float64
	switch state {
	case "closed":
		stateValue = 0
	case "half-open":
		stateValue = 1
	case "open":
		stateValue = 2
	default:
		stateValue = -1
	}

	m.circuitBreakerState.With(prometheus.Labels{
		"name":    name,
		"service": m.serviceName,
	}).Set(stateValue)
}

// RecordRetry records retry attempt metrics
func (m *MetricsCollector) RecordRetry(operation string, success bool) {
	if !m.enabled {
		return
	}

	successStr := "false"
	if success {
		successStr = "true"
	}

	m.retryCounter.With(prometheus.Labels{
		"operation": operation,
		"success":   successStr,
		"service":   m.serviceName,
	}).Inc()
}

// RecordAuthentication records authentication metrics
func (m *MetricsCollector) RecordAuthentication(method string, success bool) {
	if !m.enabled {
		return
	}

	successStr := "false"
	if success {
		successStr = "true"
	}

	m.authCounter.With(prometheus.Labels{
		"method":  method,
		"success": successStr,
		"service": m.serviceName,
	}).Inc()
}

// RecordJob records job processing metrics
func (m *MetricsCollector) RecordJob(jobType string, status string, duration time.Duration) {
	if !m.enabled {
		return
	}

	labels := prometheus.Labels{
		"job_type": jobType,
		"status":   status,
		"service":  m.serviceName,
	}

	m.jobCounter.With(labels).Inc()
	if duration > 0 {
		m.jobDuration.With(labels).Observe(duration.Seconds())
	}
}

// RecordHealthCheck records health check metrics
func (m *MetricsCollector) RecordHealthCheck(checkName string, healthy bool) {
	if !m.enabled {
		return
	}

	healthValue := 0.0
	if healthy {
		healthValue = 1.0
	}

	m.healthCheckStatus.With(prometheus.Labels{
		"check_name": checkName,
		"service":    m.serviceName,
	}).Set(healthValue)
}

// RecordCacheOperation records cache operation metrics
func (m *MetricsCollector) RecordCacheOperation(operation string, hit bool) {
	if !m.enabled {
		return
	}

	hitStr := "false"
	if hit {
		hitStr = "true"
	}

	m.cacheHits.With(prometheus.Labels{
		"operation": operation,
		"hit":       hitStr,
		"service":   m.serviceName,
	}).Inc()
}

// RecordRateLimit records rate limiting metrics
func (m *MetricsCollector) RecordRateLimit(operation string, allowed bool) {
	if !m.enabled {
		return
	}

	allowedStr := "false"
	if allowed {
		allowedStr = "true"
	}

	m.rateLimitHits.With(prometheus.Labels{
		"operation": operation,
		"allowed":   allowedStr,
		"service":   m.serviceName,
	}).Inc()
}

// RecordWebSocketConnection records WebSocket connection metrics
func (m *MetricsCollector) RecordWebSocketConnection(connected bool) {
	if !m.enabled {
		return
	}

	delta := -1.0
	if connected {
		delta = 1.0
	}

	m.websocketConnections.With(prometheus.Labels{
		"channel": "default",
		"service": m.serviceName,
	}).Add(delta)
}

// RecordWebSocketMessage records WebSocket message metrics
func (m *MetricsCollector) RecordWebSocketMessage(direction, messageType string) {
	if !m.enabled {
		return
	}

	m.websocketMessages.With(prometheus.Labels{
		"channel":   "default",
		"type":      messageType,
		"direction": direction,
		"service":   m.serviceName,
	}).Inc()
}

// RecordWebSocketEvent records WebSocket event metrics
func (m *MetricsCollector) RecordWebSocketEvent(eventType string, handlerCount int) {
	if !m.enabled {
		return
	}

	m.websocketMessages.With(prometheus.Labels{
		"channel":   "events",
		"type":      eventType,
		"direction": "received",
		"service":   m.serviceName,
	}).Inc()
}

// RecordCustomMetric records a custom metric with OpenTelemetry
func (m *MetricsCollector) RecordCustomMetric(ctx context.Context, name string, value float64, attributes []attribute.KeyValue) {
	if !m.enabled {
		return
	}

	// Add service name to attributes
	attrs := append(attributes, attribute.String("service", m.serviceName))

	// Create a counter for the custom metric
	counter, err := m.otelMeter.Float64Counter(
		name,
		metric.WithDescription("Custom metric from Schlep-engine Go SDK"),
	)
	if err != nil {
		return
	}

	counter.Add(ctx, value, metric.WithAttributes(attrs...))
}

// RecordHistogram records a histogram metric with OpenTelemetry
func (m *MetricsCollector) RecordHistogram(ctx context.Context, name string, value float64, attributes []attribute.KeyValue) {
	if !m.enabled {
		return
	}

	// Add service name to attributes
	attrs := append(attributes, attribute.String("service", m.serviceName))

	// Create a histogram for the metric
	histogram, err := m.otelMeter.Float64Histogram(
		name,
		metric.WithDescription("Histogram metric from Schlep-engine Go SDK"),
	)
	if err != nil {
		return
	}

	histogram.Record(ctx, value, metric.WithAttributes(attrs...))
}

// GetPrometheusRegistry returns the Prometheus registry for custom metrics
func (m *MetricsCollector) GetPrometheusRegistry() prometheus.Registerer {
	return prometheus.DefaultRegisterer
}

// IsEnabled returns whether metrics collection is enabled
func (m *MetricsCollector) IsEnabled() bool {
	return m.enabled
}

// GetServiceName returns the service name
func (m *MetricsCollector) GetServiceName() string {
	return m.serviceName
}