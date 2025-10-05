package models

import (
	"fmt"
	"sync"
	"time"
)

// MetricsCollector collects and exposes model performance metrics
type MetricsCollector struct {
	registry *ModelRegistry
	reloader *ModelReloader

	// Per-model metrics
	inferenceLatency    map[string]*LatencyMetrics
	inferenceThroughput map[string]*ThroughputMetrics
	modelLoadTime       map[string]time.Duration
	errorCounts         map[string]int64

	mu sync.RWMutex
}

// LatencyMetrics tracks latency statistics
type LatencyMetrics struct {
	Count       int64
	TotalTimeMs int64
	MinMs       int64
	MaxMs       int64
	P50Ms       int64
	P95Ms       int64
	P99Ms       int64
	samples     []int64 // For percentile calculation
	mu          sync.RWMutex
}

// ThroughputMetrics tracks throughput statistics
type ThroughputMetrics struct {
	RequestCount int64
	StartTime    time.Time
	LastUpdate   time.Time
	CurrentRPS   float64
	mu           sync.RWMutex
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(registry *ModelRegistry, reloader *ModelReloader) *MetricsCollector {
	return &MetricsCollector{
		registry:            registry,
		reloader:            reloader,
		inferenceLatency:    make(map[string]*LatencyMetrics),
		inferenceThroughput: make(map[string]*ThroughputMetrics),
		modelLoadTime:       make(map[string]time.Duration),
		errorCounts:         make(map[string]int64),
	}
}

// RecordInference records an inference request
func (mc *MetricsCollector) RecordInference(modelID string, latencyMs int64, success bool) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	// Initialize metrics if not exists
	if _, exists := mc.inferenceLatency[modelID]; !exists {
		mc.inferenceLatency[modelID] = &LatencyMetrics{
			MinMs:   latencyMs,
			MaxMs:   latencyMs,
			samples: make([]int64, 0, 1000),
		}
	}

	if _, exists := mc.inferenceThroughput[modelID]; !exists {
		mc.inferenceThroughput[modelID] = &ThroughputMetrics{
			StartTime:  time.Now(),
			LastUpdate: time.Now(),
		}
	}

	// Update latency metrics
	latency := mc.inferenceLatency[modelID]
	latency.mu.Lock()
	latency.Count++
	latency.TotalTimeMs += latencyMs

	if latencyMs < latency.MinMs {
		latency.MinMs = latencyMs
	}
	if latencyMs > latency.MaxMs {
		latency.MaxMs = latencyMs
	}

	// Store sample for percentile calculation (keep last 1000)
	if len(latency.samples) < 1000 {
		latency.samples = append(latency.samples, latencyMs)
	} else {
		// Rolling window: shift and add
		copy(latency.samples, latency.samples[1:])
		latency.samples[len(latency.samples)-1] = latencyMs
	}

	// Calculate percentiles
	latency.calculatePercentiles()
	latency.mu.Unlock()

	// Update throughput metrics
	throughput := mc.inferenceThroughput[modelID]
	throughput.mu.Lock()
	throughput.RequestCount++
	throughput.LastUpdate = time.Now()

	// Calculate current RPS
	elapsed := time.Since(throughput.StartTime).Seconds()
	if elapsed > 0 {
		throughput.CurrentRPS = float64(throughput.RequestCount) / elapsed
	}
	throughput.mu.Unlock()

	// Track errors
	if !success {
		mc.errorCounts[modelID]++
	}
}

// RecordModelLoad records a model load event
func (mc *MetricsCollector) RecordModelLoad(modelID string, duration time.Duration) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.modelLoadTime[modelID] = duration
}

// GetModelMetrics returns metrics for a specific model
func (mc *MetricsCollector) GetModelMetrics(modelID string) *ModelMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	metrics := &ModelMetrics{
		ModelID: modelID,
	}

	// Get latency metrics
	if latency, exists := mc.inferenceLatency[modelID]; exists {
		latency.mu.RLock()
		metrics.InferenceLatencyMs = &InferenceLatency{
			Count:   latency.Count,
			Average: 0,
			Min:     latency.MinMs,
			Max:     latency.MaxMs,
			P50:     latency.P50Ms,
			P95:     latency.P95Ms,
			P99:     latency.P99Ms,
		}
		if latency.Count > 0 {
			metrics.InferenceLatencyMs.Average = latency.TotalTimeMs / latency.Count
		}
		latency.mu.RUnlock()
	}

	// Get throughput metrics
	if throughput, exists := mc.inferenceThroughput[modelID]; exists {
		throughput.mu.RLock()
		metrics.Throughput = &Throughput{
			RequestCount: throughput.RequestCount,
			CurrentRPS:   throughput.CurrentRPS,
			Uptime:       time.Since(throughput.StartTime),
		}
		throughput.mu.RUnlock()
	}

	// Get load time
	if loadTime, exists := mc.modelLoadTime[modelID]; exists {
		metrics.LoadTimeMs = loadTime.Milliseconds()
	}

	// Get error count
	if errorCount, exists := mc.errorCounts[modelID]; exists {
		metrics.ErrorCount = errorCount
	}

	// Get model version
	if metadata, err := mc.registry.Get(modelID); err == nil {
		metrics.Version = metadata.Version
		metrics.Status = string(metadata.Status)
	}

	return metrics
}

// GetAllMetrics returns metrics for all models
func (mc *MetricsCollector) GetAllMetrics() map[string]*ModelMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	result := make(map[string]*ModelMetrics)

	// Get all model IDs
	models := mc.registry.List()
	for _, model := range models {
		result[model.ModelID] = mc.GetModelMetrics(model.ModelID)
	}

	return result
}

// ExportPrometheusMetrics exports metrics in Prometheus format
func (mc *MetricsCollector) ExportPrometheusMetrics() string {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	var output string

	// HELP and TYPE declarations
	output += "# HELP model_inference_latency_ms Model inference latency in milliseconds\n"
	output += "# TYPE model_inference_latency_ms gauge\n"

	output += "# HELP model_inference_throughput_rps Model inference throughput (requests per second)\n"
	output += "# TYPE model_inference_throughput_rps gauge\n"

	output += "# HELP model_load_time_ms Model load time in milliseconds\n"
	output += "# TYPE model_load_time_ms gauge\n"

	output += "# HELP model_active_version Active model version\n"
	output += "# TYPE model_active_version gauge\n"

	output += "# HELP model_error_count Total error count for model\n"
	output += "# TYPE model_error_count counter\n"

	// Export metrics for each model
	models := mc.registry.List()
	for _, model := range models {
		modelID := model.ModelID
		version := model.Version

		// Latency metrics
		if latency, exists := mc.inferenceLatency[modelID]; exists {
			latency.mu.RLock()
			output += fmt.Sprintf("model_inference_latency_ms{model=\"%s\",version=\"%s\",quantile=\"0.5\"} %d\n",
				modelID, version, latency.P50Ms)
			output += fmt.Sprintf("model_inference_latency_ms{model=\"%s\",version=\"%s\",quantile=\"0.95\"} %d\n",
				modelID, version, latency.P95Ms)
			output += fmt.Sprintf("model_inference_latency_ms{model=\"%s\",version=\"%s\",quantile=\"0.99\"} %d\n",
				modelID, version, latency.P99Ms)
			latency.mu.RUnlock()
		}

		// Throughput metrics
		if throughput, exists := mc.inferenceThroughput[modelID]; exists {
			throughput.mu.RLock()
			output += fmt.Sprintf("model_inference_throughput_rps{model=\"%s\",version=\"%s\"} %.2f\n",
				modelID, version, throughput.CurrentRPS)
			throughput.mu.RUnlock()
		}

		// Load time
		if loadTime, exists := mc.modelLoadTime[modelID]; exists {
			output += fmt.Sprintf("model_load_time_ms{model=\"%s\",version=\"%s\"} %d\n",
				modelID, version, loadTime.Milliseconds())
		}

		// Active version indicator
		if model.Status == StatusActive {
			output += fmt.Sprintf("model_active_version{model=\"%s\",version=\"%s\"} 1\n",
				modelID, version)
		}

		// Error count
		if errorCount, exists := mc.errorCounts[modelID]; exists {
			output += fmt.Sprintf("model_error_count{model=\"%s\",version=\"%s\"} %d\n",
				modelID, version, errorCount)
		}
	}

	return output
}

// calculatePercentiles calculates percentile values from samples
func (lm *LatencyMetrics) calculatePercentiles() {
	if len(lm.samples) == 0 {
		return
	}

	// Create sorted copy
	sorted := make([]int64, len(lm.samples))
	copy(sorted, lm.samples)

	// Simple insertion sort (efficient for small arrays)
	for i := 1; i < len(sorted); i++ {
		key := sorted[i]
		j := i - 1
		for j >= 0 && sorted[j] > key {
			sorted[j+1] = sorted[j]
			j--
		}
		sorted[j+1] = key
	}

	// Calculate percentiles
	n := len(sorted)
	lm.P50Ms = sorted[n*50/100]
	lm.P95Ms = sorted[n*95/100]
	lm.P99Ms = sorted[n*99/100]
}

// ModelMetrics represents aggregated metrics for a model
type ModelMetrics struct {
	ModelID            string             `json:"model_id"`
	Version            string             `json:"version"`
	Status             string             `json:"status"`
	InferenceLatencyMs *InferenceLatency  `json:"inference_latency_ms,omitempty"`
	Throughput         *Throughput        `json:"throughput,omitempty"`
	LoadTimeMs         int64              `json:"load_time_ms,omitempty"`
	ErrorCount         int64              `json:"error_count"`
}

// InferenceLatency contains latency statistics
type InferenceLatency struct {
	Count   int64 `json:"count"`
	Average int64 `json:"average"`
	Min     int64 `json:"min"`
	Max     int64 `json:"max"`
	P50     int64 `json:"p50"`
	P95     int64 `json:"p95"`
	P99     int64 `json:"p99"`
}

// Throughput contains throughput statistics
type Throughput struct {
	RequestCount int64         `json:"request_count"`
	CurrentRPS   float64       `json:"current_rps"`
	Uptime       time.Duration `json:"uptime_seconds"`
}
