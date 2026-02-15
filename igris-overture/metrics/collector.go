package metrics

import (
	"context"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// InferenceMetrics represents aggregated inference metrics for analysis
type InferenceMetrics struct {
	Provider      string    `json:"provider"`
	Model         string    `json:"model"`
	RequestCount  int64     `json:"request_count"`
	SuccessCount  int64     `json:"success_count"`
	ErrorCount    int64     `json:"error_count"`
	TotalTokens   int64     `json:"total_tokens"`
	TotalCostUSD  float64   `json:"total_cost_usd"`
	AvgLatencyMs  float64   `json:"avg_latency_ms"`
	P50LatencyMs  float64   `json:"p50_latency_ms"`
	P95LatencyMs  float64   `json:"p95_latency_ms"`
	P99LatencyMs  float64   `json:"p99_latency_ms"`
	LastUpdated   time.Time `json:"last_updated"`
}

// LatencySample represents a single latency measurement
type LatencySample struct {
	Timestamp time.Time
	LatencyMs int64
}

// MetricsCollector maintains in-memory provider statistics and provides aggregation
type MetricsCollector struct {
	mu sync.RWMutex

	// In-memory aggregated stats per provider and model
	providerStats map[string]map[string]*ProviderStats // provider -> model -> stats

	// Latency samples for percentile calculation
	latencySamples map[string][]*LatencySample // key: provider:model

	// Configuration
	maxLatencySamples int
}

// ProviderStats holds aggregated statistics for a provider+model combination
type ProviderStats struct {
	RequestCount    int64     `json:"request_count"`
	SuccessCount    int64     `json:"success_count"`
	ErrorCount      int64     `json:"error_count"`
	TotalTokens     int64     `json:"total_tokens"`
	TotalCostUSD    float64   `json:"total_cost_usd"`
	TotalLatencyMs  int64     `json:"total_latency_ms"`
	LastRequestTime time.Time `json:"last_request_time"`
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	mc := &MetricsCollector{
		providerStats:     make(map[string]map[string]*ProviderStats),
		latencySamples:    make(map[string][]*LatencySample),
		maxLatencySamples: 1000, // Keep last 1000 samples per provider:model
	}

	// Start background cleanup goroutine
	go mc.cleanupOldSamples()

	return mc
}

// RecordInferenceRequest records metrics for a single inference request
func (mc *MetricsCollector) RecordInferenceRequest(ctx context.Context, provider, model string, latencyMs int64, promptTokens, completionTokens, totalTokens int, costUSD float64, success bool) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	key := provider + ":" + model

	// Initialize provider:model map if needed
	if mc.providerStats[provider] == nil {
		mc.providerStats[provider] = make(map[string]*ProviderStats)
	}

	// Initialize stats if needed
	stats := mc.providerStats[provider][model]
	if stats == nil {
		stats = &ProviderStats{}
		mc.providerStats[provider][model] = stats
	}

	// Update aggregate stats
	stats.RequestCount++
	stats.TotalLatencyMs += latencyMs
	stats.TotalTokens += int64(totalTokens)
	stats.TotalCostUSD += costUSD
	stats.LastRequestTime = time.Now()

	if success {
		stats.SuccessCount++
	} else {
		stats.ErrorCount++
	}

	// Add latency sample for percentile calculation
	mc.addLatencySample(key, latencyMs)
}

// addLatencySample adds a latency sample to the sliding window
func (mc *MetricsCollector) addLatencySample(key string, latencyMs int64) {
	samples := mc.latencySamples[key]
	if samples == nil {
		samples = make([]*LatencySample, 0, mc.maxLatencySamples)
		mc.latencySamples[key] = samples
	}

	// Add new sample
	sample := &LatencySample{
		Timestamp: time.Now(),
		LatencyMs: latencyMs,
	}

	samples = append(samples, sample)

	// Trim to max size if needed
	if len(samples) > mc.maxLatencySamples {
		samples = samples[len(samples)-mc.maxLatencySamples:]
	}

	mc.latencySamples[key] = samples
}

// GetProviderMetrics returns aggregated metrics for all providers
func (mc *MetricsCollector) GetProviderMetrics() map[string]map[string]InferenceMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	result := make(map[string]map[string]InferenceMetrics)

	for provider, models := range mc.providerStats {
		result[provider] = make(map[string]InferenceMetrics)

		for model, stats := range models {
			key := provider + ":" + model
			
			// Calculate percentiles from samples
			samples := mc.latencySamples[key]
			var p50, p95, p99 float64
			if len(samples) > 0 {
				latencies := make([]int64, len(samples))
				for i, sample := range samples {
					latencies[i] = sample.LatencyMs
				}
				
				p50 = calculatePercentile(latencies, 0.5)
				p95 = calculatePercentile(latencies, 0.95)
				p99 = calculatePercentile(latencies, 0.99)
			}

			// Calculate average latency
			var avgLatency float64
			if stats.RequestCount > 0 {
				avgLatency = float64(stats.TotalLatencyMs) / float64(stats.RequestCount)
			}

			metrics := InferenceMetrics{
				Provider:      provider,
				Model:         model,
				RequestCount:  stats.RequestCount,
				SuccessCount:  stats.SuccessCount,
				ErrorCount:    stats.ErrorCount,
				TotalTokens:   stats.TotalTokens,
				TotalCostUSD:  stats.TotalCostUSD,
				AvgLatencyMs:  avgLatency,
				P50LatencyMs:  p50,
				P95LatencyMs:  p95,
				P99LatencyMs:  p99,
				LastUpdated:   stats.LastRequestTime,
			}

			result[provider][model] = metrics
		}
	}

	return result
}

// GetMetricsForProvider returns metrics for a specific provider
func (mc *MetricsCollector) GetMetricsForProvider(provider string) map[string]InferenceMetrics {
	all := mc.GetProviderMetrics()
	return all[provider]
}

// GetMetricsForModel returns metrics for a specific provider+model combination
func (mc *MetricsCollector) GetMetricsForModel(provider, model string) (InferenceMetrics, bool) {
	providerMetrics := mc.GetProviderMetrics()
	modelMetrics := providerMetrics[provider]
	if modelMetrics == nil {
		return InferenceMetrics{}, false
	}

	metric, exists := modelMetrics[model]
	return metric, exists
}

// GetTopProviders returns providers sorted by request count
func (mc *MetricsCollector) GetTopProviders(limit int) []InferenceMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	var allMetrics []InferenceMetrics

	for provider, models := range mc.providerStats {
		for model, stats := range models {
			key := provider + ":" + model
			samples := mc.latencySamples[key]
			var p95 float64
			if len(samples) > 0 {
				latencies := make([]int64, len(samples))
				for i, sample := range samples {
					latencies[i] = sample.LatencyMs
				}
				p95 = calculatePercentile(latencies, 0.95)
			}

			var avgLatency float64
			if stats.RequestCount > 0 {
				avgLatency = float64(stats.TotalLatencyMs) / float64(stats.RequestCount)
			}

			allMetrics = append(allMetrics, InferenceMetrics{
				Provider:      provider,
				Model:         model,
				RequestCount:  stats.RequestCount,
				SuccessCount:  stats.SuccessCount,
				ErrorCount:    stats.ErrorCount,
				TotalTokens:   stats.TotalTokens,
				TotalCostUSD:  stats.TotalCostUSD,
				AvgLatencyMs:  avgLatency,
				P95LatencyMs:  p95,
				LastUpdated:   stats.LastRequestTime,
			})
		}
	}

	// Sort by request count (descending)
	for i := 0; i < len(allMetrics)-1; i++ {
		for j := i + 1; j < len(allMetrics); j++ {
			if allMetrics[j].RequestCount > allMetrics[i].RequestCount {
				allMetrics[i], allMetrics[j] = allMetrics[j], allMetrics[i]
			}
		}
	}

	if limit > 0 && limit < len(allMetrics) {
		return allMetrics[:limit]
	}

	return allMetrics
}

// Reset resets all metrics (useful for testing)
func (mc *MetricsCollector) Reset() {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.providerStats = make(map[string]map[string]*ProviderStats)
	mc.latencySamples = make(map[string][]*LatencySample)
}

// calculatePercentile calculates the percentile value from a sorted slice
func calculatePercentile(values []int64, percentile float64) float64 {
	if len(values) == 0 {
		return 0
	}

	// Create a copy and sort it
	sorted := make([]int64, len(values))
	copy(sorted, values)

	// Insertion sort for efficiency with small slices
	for i := 1; i < len(sorted); i++ {
		key := sorted[i]
		j := i - 1
		for j >= 0 && sorted[j] > key {
			sorted[j+1] = sorted[j]
			j--
		}
		sorted[j+1] = key
	}

	// Calculate percentile
	index := percentile * float64(len(sorted)-1)
	lower := int(index)
	upper := lower + 1
	fraction := index - float64(lower)

	if upper >= len(sorted) {
		return float64(sorted[lower])
	}

	return float64(sorted[lower])*(1-fraction) + float64(sorted[upper])*fraction
}

// cleanupOldSamples removes old latency samples to prevent memory leaks
func (mc *MetricsCollector) cleanupOldSamples() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		mc.mu.Lock()
		cutoff := time.Now().Add(-1 * time.Hour) // Keep samples from last hour

		for key, samples := range mc.latencySamples {
			// Filter out old samples
			validSamples := make([]*LatencySample, 0, len(samples))
			for _, sample := range samples {
				if sample.Timestamp.After(cutoff) {
					validSamples = append(validSamples, sample)
				}
			}

			if len(validSamples) == 0 {
				delete(mc.latencySamples, key)
			} else {
				mc.latencySamples[key] = validSamples
			}
		}

		mc.mu.Unlock()
	}
}

// PrometheusMetrics returns metrics in Prometheus format
// GetMaxLatencySamples returns the maximum number of latency samples stored per provider:model
func (mc *MetricsCollector) GetMaxLatencySamples() int {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	return mc.maxLatencySamples
}

// PrometheusMetrics returns metrics in Prometheus format
func (mc *MetricsCollector) PrometheusMetrics() []prometheus.Metric {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	var metrics []prometheus.Metric

	for provider, models := range mc.providerStats {
		for model, stats := range models {
			// Request count metric
			requestMetric := prometheus.NewGauge(prometheus.GaugeOpts{
				Name:        "igris_infer_requests_total_aggregated",
				Help:        "Aggregated total number of inference requests",
				ConstLabels: prometheus.Labels{"provider": provider, "model": model},
			})
			requestMetric.Set(float64(stats.RequestCount))
			metrics = append(metrics, requestMetric)

			// Success rate metric
			var successRate float64
			if stats.RequestCount > 0 {
				successRate = float64(stats.SuccessCount) / float64(stats.RequestCount)
			}
			successMetric := prometheus.NewGauge(prometheus.GaugeOpts{
				Name:        "igris_infer_success_rate_aggregated",
				Help:        "Aggregated success rate for inference requests",
				ConstLabels: prometheus.Labels{"provider": provider, "model": model},
			})
			successMetric.Set(successRate)
			metrics = append(metrics, successMetric)

			// Average latency metric
			var avgLatency float64
			if stats.RequestCount > 0 {
				avgLatency = float64(stats.TotalLatencyMs) / float64(stats.RequestCount)
			}
			latencyMetric := prometheus.NewGauge(prometheus.GaugeOpts{
				Name:        "igris_infer_avg_latency_ms_aggregated",
				Help:        "Aggregated average latency in milliseconds",
				ConstLabels: prometheus.Labels{"provider": provider, "model": model},
			})
			latencyMetric.Set(avgLatency)
			metrics = append(metrics, latencyMetric)
		}
	}

	return metrics
}
