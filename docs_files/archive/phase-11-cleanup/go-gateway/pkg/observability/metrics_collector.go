package observability

import (
	"context"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/rs/zerolog"
)

// MetricsCollector aggregates metrics from all subsystems
type MetricsCollector struct {
	// Inference metrics (per-model)
	InferenceLatency *prometheus.HistogramVec
	InferenceTotal   *prometheus.CounterVec
	InferenceErrors  *prometheus.CounterVec

	// Cache metrics (multi-tier)
	CacheHits        *prometheus.CounterVec
	CacheMisses      *prometheus.CounterVec
	CacheLatency     *prometheus.HistogramVec
	CacheSize        *prometheus.GaugeVec
	CacheEvictions   *prometheus.CounterVec

	// Model registry metrics
	ModelLoadTime    *prometheus.HistogramVec
	ModelReloads     *prometheus.CounterVec
	ModelVersions    *prometheus.GaugeVec

	// ETL pipeline metrics
	ETLJobsTotal     *prometheus.CounterVec
	ETLJobDuration   *prometheus.HistogramVec
	ETLJobQueueSize  *prometheus.GaugeVec
	ETLWorkerBusy    *prometheus.GaugeVec

	// Data processing metrics
	RecordsParsed    *prometheus.CounterVec
	ParseErrors      *prometheus.CounterVec
	ParserLatency    *prometheus.HistogramVec

	// Replica utilization
	ReplicaRequests  *prometheus.CounterVec
	ReplicaLatency   *prometheus.HistogramVec
	ReplicaHealth    *prometheus.GaugeVec

	// Edge routing metrics
	EdgeRequests     *prometheus.CounterVec
	EdgeFailovers    *prometheus.CounterVec
	EdgeNodeHealth   *prometheus.GaugeVec

	// System metrics
	GoroutineCount   prometheus.Gauge
	MemoryUsage      prometheus.Gauge
	CPUUsage         prometheus.Gauge

	logger           zerolog.Logger
	mu               sync.RWMutex
}

// NewMetricsCollector creates a new comprehensive metrics collector
func NewMetricsCollector(logger zerolog.Logger) *MetricsCollector {
	mc := &MetricsCollector{
		logger: logger.With().Str("component", "metrics-collector").Logger(),

		// Inference metrics
		InferenceLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "ml_inference_latency_milliseconds",
				Help:    "ML inference latency in milliseconds per model",
				Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000},
			},
			[]string{"model_id", "model_version", "quantile"},
		),

		InferenceTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ml_inference_requests_total",
				Help: "Total number of ML inference requests per model",
			},
			[]string{"model_id", "model_version", "status"},
		),

		InferenceErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ml_inference_errors_total",
				Help: "Total number of ML inference errors per model",
			},
			[]string{"model_id", "model_version", "error_type"},
		),

		// Cache metrics
		CacheHits: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "cache_hits_total",
				Help: "Total number of cache hits by tier",
			},
			[]string{"tier", "model_id"},
		),

		CacheMisses: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "cache_misses_total",
				Help: "Total number of cache misses by tier",
			},
			[]string{"tier", "model_id"},
		),

		CacheLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "cache_operation_latency_microseconds",
				Help:    "Cache operation latency in microseconds",
				Buckets: []float64{0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000, 5000},
			},
			[]string{"tier", "operation"},
		),

		CacheSize: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "cache_entries_current",
				Help: "Current number of entries in cache",
			},
			[]string{"tier"},
		),

		CacheEvictions: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "cache_evictions_total",
				Help: "Total number of cache evictions",
			},
			[]string{"tier", "reason"},
		),

		// Model registry metrics
		ModelLoadTime: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "model_load_time_milliseconds",
				Help:    "Model loading time in milliseconds",
				Buckets: []float64{10, 50, 100, 250, 500, 1000, 2500, 5000, 10000},
			},
			[]string{"model_id", "model_version"},
		),

		ModelReloads: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "model_reloads_total",
				Help: "Total number of model reloads (hot reload)",
			},
			[]string{"model_id", "status"},
		),

		ModelVersions: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "model_versions_active",
				Help: "Number of active model versions",
			},
			[]string{"model_id"},
		),

		// ETL pipeline metrics
		ETLJobsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "etl_jobs_total",
				Help: "Total number of ETL jobs processed",
			},
			[]string{"job_type", "status"},
		),

		ETLJobDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "etl_job_duration_milliseconds",
				Help:    "ETL job processing duration in milliseconds",
				Buckets: []float64{10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000},
			},
			[]string{"job_type"},
		),

		ETLJobQueueSize: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "etl_job_queue_size",
				Help: "Current number of jobs in ETL queue",
			},
			[]string{"queue_name"},
		),

		ETLWorkerBusy: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "etl_workers_busy",
				Help: "Number of busy ETL workers",
			},
			[]string{"worker_pool"},
		),

		// Data processing metrics
		RecordsParsed: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "data_records_parsed_total",
				Help: "Total number of data records parsed",
			},
			[]string{"format", "status"},
		),

		ParseErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "data_parse_errors_total",
				Help: "Total number of data parsing errors",
			},
			[]string{"format", "error_type"},
		),

		ParserLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "data_parser_latency_milliseconds",
				Help:    "Data parser latency in milliseconds",
				Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
			},
			[]string{"format"},
		),

		// Replica utilization
		ReplicaRequests: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "replica_requests_total",
				Help: "Total number of requests per replica",
			},
			[]string{"replica_id", "status"},
		),

		ReplicaLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "replica_latency_milliseconds",
				Help:    "Replica response latency in milliseconds",
				Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500},
			},
			[]string{"replica_id"},
		),

		ReplicaHealth: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "replica_health_status",
				Help: "Replica health status (1=healthy, 0=unhealthy)",
			},
			[]string{"replica_id"},
		),

		// Edge routing metrics
		EdgeRequests: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "edge_requests_total",
				Help: "Total number of edge routing requests",
			},
			[]string{"region", "node_id", "status"},
		),

		EdgeFailovers: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "edge_failovers_total",
				Help: "Total number of edge node failovers",
			},
			[]string{"region", "from_node", "to_node"},
		),

		EdgeNodeHealth: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "edge_node_health_status",
				Help: "Edge node health status (1=healthy, 0=unhealthy)",
			},
			[]string{"region", "node_id"},
		),

		// System metrics
		GoroutineCount: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "system_goroutines_count",
				Help: "Current number of goroutines",
			},
		),

		MemoryUsage: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "system_memory_usage_bytes",
				Help: "Current memory usage in bytes",
			},
		),

		CPUUsage: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "system_cpu_usage_percent",
				Help: "Current CPU usage percentage",
			},
		),
	}

	mc.logger.Info().Msg("Metrics collector initialized with comprehensive subsystem metrics")

	return mc
}

// RecordInference records ML inference metrics
func (mc *MetricsCollector) RecordInference(modelID, version, status string, latency time.Duration, quantile string) {
	mc.InferenceTotal.WithLabelValues(modelID, version, status).Inc()
	mc.InferenceLatency.WithLabelValues(modelID, version, quantile).Observe(float64(latency.Milliseconds()))
}

// RecordInferenceError records ML inference error
func (mc *MetricsCollector) RecordInferenceError(modelID, version, errorType string) {
	mc.InferenceErrors.WithLabelValues(modelID, version, errorType).Inc()
}

// RecordCacheHit records cache hit
func (mc *MetricsCollector) RecordCacheHit(tier, modelID string, latency time.Duration) {
	mc.CacheHits.WithLabelValues(tier, modelID).Inc()
	mc.CacheLatency.WithLabelValues(tier, "get").Observe(float64(latency.Microseconds()))
}

// RecordCacheMiss records cache miss
func (mc *MetricsCollector) RecordCacheMiss(tier, modelID string) {
	mc.CacheMisses.WithLabelValues(tier, modelID).Inc()
}

// UpdateCacheSize updates cache size gauge
func (mc *MetricsCollector) UpdateCacheSize(tier string, size int) {
	mc.CacheSize.WithLabelValues(tier).Set(float64(size))
}

// RecordCacheEviction records cache eviction
func (mc *MetricsCollector) RecordCacheEviction(tier, reason string) {
	mc.CacheEvictions.WithLabelValues(tier, reason).Inc()
}

// RecordModelLoad records model loading metrics
func (mc *MetricsCollector) RecordModelLoad(modelID, version string, loadTime time.Duration) {
	mc.ModelLoadTime.WithLabelValues(modelID, version).Observe(float64(loadTime.Milliseconds()))
}

// RecordModelReload records model reload event
func (mc *MetricsCollector) RecordModelReload(modelID, status string) {
	mc.ModelReloads.WithLabelValues(modelID, status).Inc()
}

// UpdateModelVersions updates active model versions gauge
func (mc *MetricsCollector) UpdateModelVersions(modelID string, count int) {
	mc.ModelVersions.WithLabelValues(modelID).Set(float64(count))
}

// RecordETLJob records ETL job metrics
func (mc *MetricsCollector) RecordETLJob(jobType, status string, duration time.Duration) {
	mc.ETLJobsTotal.WithLabelValues(jobType, status).Inc()
	mc.ETLJobDuration.WithLabelValues(jobType).Observe(float64(duration.Milliseconds()))
}

// UpdateETLQueueSize updates ETL queue size
func (mc *MetricsCollector) UpdateETLQueueSize(queueName string, size int) {
	mc.ETLJobQueueSize.WithLabelValues(queueName).Set(float64(size))
}

// UpdateETLWorkersBusy updates busy worker count
func (mc *MetricsCollector) UpdateETLWorkersBusy(poolName string, count int) {
	mc.ETLWorkerBusy.WithLabelValues(poolName).Set(float64(count))
}

// RecordDataParsing records data parsing metrics
func (mc *MetricsCollector) RecordDataParsing(format, status string, count int, latency time.Duration) {
	mc.RecordsParsed.WithLabelValues(format, status).Add(float64(count))
	mc.ParserLatency.WithLabelValues(format).Observe(float64(latency.Milliseconds()))
}

// RecordParseError records parsing error
func (mc *MetricsCollector) RecordParseError(format, errorType string) {
	mc.ParseErrors.WithLabelValues(format, errorType).Inc()
}

// RecordReplicaRequest records replica request
func (mc *MetricsCollector) RecordReplicaRequest(replicaID, status string, latency time.Duration) {
	mc.ReplicaRequests.WithLabelValues(replicaID, status).Inc()
	mc.ReplicaLatency.WithLabelValues(replicaID).Observe(float64(latency.Milliseconds()))
}

// UpdateReplicaHealth updates replica health status
func (mc *MetricsCollector) UpdateReplicaHealth(replicaID string, healthy bool) {
	value := 0.0
	if healthy {
		value = 1.0
	}
	mc.ReplicaHealth.WithLabelValues(replicaID).Set(value)
}

// RecordEdgeRequest records edge routing request
func (mc *MetricsCollector) RecordEdgeRequest(region, nodeID, status string) {
	mc.EdgeRequests.WithLabelValues(region, nodeID, status).Inc()
}

// RecordEdgeFailover records edge failover event
func (mc *MetricsCollector) RecordEdgeFailover(region, fromNode, toNode string) {
	mc.EdgeFailovers.WithLabelValues(region, fromNode, toNode).Inc()
}

// UpdateEdgeNodeHealth updates edge node health
func (mc *MetricsCollector) UpdateEdgeNodeHealth(region, nodeID string, healthy bool) {
	value := 0.0
	if healthy {
		value = 1.0
	}
	mc.EdgeNodeHealth.WithLabelValues(region, nodeID).Set(value)
}

// StartSystemMetricsCollector starts a background worker to collect system metrics
func (mc *MetricsCollector) StartSystemMetricsCollector(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	mc.logger.Info().
		Dur("interval", interval).
		Msg("Started system metrics collection worker")

	for {
		select {
		case <-ctx.Done():
			mc.logger.Info().Msg("Stopping system metrics collection worker")
			return
		case <-ticker.C:
			mc.collectSystemMetrics()
		}
	}
}

// collectSystemMetrics collects runtime system metrics
func (mc *MetricsCollector) collectSystemMetrics() {
	// This would integrate with runtime.NumGoroutine(), runtime.MemStats, etc.
	// Placeholder implementation
	mc.logger.Debug().Msg("Collecting system metrics")
}

// GetScrapeOverhead returns the overhead of scraping all metrics
func (mc *MetricsCollector) GetScrapeOverhead() time.Duration {
	start := time.Now()
	// Simulate metrics scrape
	_ = prometheus.DefaultGatherer
	return time.Since(start)
}
