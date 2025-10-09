package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Cost constants for inference calculations
const (
	// Rust runtime costs (per inference)
	RustCPUCostPerSecond = 0.000001  // $0.000001/sec compute
	RustMemoryCostPerMB  = 0.0000001 // $0.0000001/MB/sec

	// Python runtime costs (per inference)
	PythonCPUCostPerSecond = 0.000002  // $0.000002/sec compute (2x Rust)
	PythonMemoryCostPerMB  = 0.0000002 // $0.0000002/MB/sec (2x Rust)

	// GPU costs (if applicable)
	GPUCostPerSecond = 0.00001 // $0.00001/sec GPU compute
)

var (
	// Total inference cost in USD
	inferenceCostTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inference_cost_usd_total",
			Help: "Total inference cost in USD",
		},
		[]string{"runtime", "endpoint", "model"},
	)

	// Total number of inference requests (for cost calculation)
	inferenceRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inference_requests_total",
			Help: "Total number of inference requests",
		},
		[]string{"runtime", "endpoint", "model"},
	)

	// Inference duration (for cost calculation)
	inferenceDurationSeconds = promauto.NewSummaryVec(
		prometheus.SummaryOpts{
			Name:       "inference_duration_seconds",
			Help:       "Inference duration in seconds",
			Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		},
		[]string{"runtime", "endpoint", "model"},
	)

	// Compute time (actual CPU/GPU time)
	inferenceComputeSecondsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inference_compute_seconds_total",
			Help: "Total compute time in seconds for inferences",
		},
		[]string{"runtime", "endpoint", "model"},
	)

	// Memory usage tracking
	inferenceMemoryBytes = promauto.NewSummaryVec(
		prometheus.SummaryOpts{
			Name:       "inference_memory_bytes",
			Help:       "Memory usage per inference in bytes",
			Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		},
		[]string{"runtime", "endpoint", "model"},
	)

	// Cost per inference (instantaneous)
	inferenceCostUSD = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "inference_cost_usd",
			Help:    "Cost per inference in USD",
			Buckets: []float64{0.000001, 0.000005, 0.00001, 0.00005, 0.0001, 0.0005, 0.001},
		},
		[]string{"runtime", "endpoint", "model"},
	)

	// Cost breakdown by component
	inferenceCostByComponent = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inference_cost_by_component_usd_total",
			Help: "Inference cost breakdown by component (CPU, memory, GPU)",
		},
		[]string{"runtime", "component"}, // component: cpu, memory, gpu
	)
)

// InferenceCostMetrics holds cost tracking data for a single inference
type InferenceCostMetrics struct {
	Runtime      string
	Endpoint     string
	Model        string
	StartTime    time.Time
	DurationMs   int64
	MemoryBytes  int64
	IsGPU        bool
	GPUTimeMs    int64
}

// CostTracker handles cost calculation and tracking
type CostTracker struct {
	enableDetailedTracking bool
}

// NewCostTracker creates a new cost tracker instance
func NewCostTracker(enableDetailedTracking bool) *CostTracker {
	return &CostTracker{
		enableDetailedTracking: enableDetailedTracking,
	}
}

// TrackInference records metrics and calculates cost for a single inference
func (ct *CostTracker) TrackInference(metrics InferenceCostMetrics) {
	// Record request count
	inferenceRequestsTotal.WithLabelValues(
		metrics.Runtime,
		metrics.Endpoint,
		metrics.Model,
	).Inc()

	// Record duration
	durationSeconds := float64(metrics.DurationMs) / 1000.0
	inferenceDurationSeconds.WithLabelValues(
		metrics.Runtime,
		metrics.Endpoint,
		metrics.Model,
	).Observe(durationSeconds)

	// Calculate compute cost
	var computeCost float64
	var memoryCost float64
	var gpuCost float64

	if metrics.IsGPU && metrics.GPUTimeMs > 0 {
		// GPU inference cost
		gpuTimeSeconds := float64(metrics.GPUTimeMs) / 1000.0
		gpuCost = gpuTimeSeconds * GPUCostPerSecond

		// Track GPU compute time
		inferenceComputeSecondsTotal.WithLabelValues(
			metrics.Runtime,
			metrics.Endpoint,
			metrics.Model,
		).Add(gpuTimeSeconds)

		inferenceCostByComponent.WithLabelValues(
			metrics.Runtime,
			"gpu",
		).Add(gpuCost)
	} else {
		// CPU inference cost
		computeTimeSeconds := durationSeconds

		if metrics.Runtime == "rust" {
			computeCost = computeTimeSeconds * RustCPUCostPerSecond
			memoryCost = (float64(metrics.MemoryBytes) / (1024 * 1024)) * computeTimeSeconds * RustMemoryCostPerMB
		} else if metrics.Runtime == "python" {
			computeCost = computeTimeSeconds * PythonCPUCostPerSecond
			memoryCost = (float64(metrics.MemoryBytes) / (1024 * 1024)) * computeTimeSeconds * PythonMemoryCostPerMB
		}

		// Track compute time
		inferenceComputeSecondsTotal.WithLabelValues(
			metrics.Runtime,
			metrics.Endpoint,
			metrics.Model,
		).Add(computeTimeSeconds)

		// Track component costs
		inferenceCostByComponent.WithLabelValues(
			metrics.Runtime,
			"cpu",
		).Add(computeCost)

		inferenceCostByComponent.WithLabelValues(
			metrics.Runtime,
			"memory",
		).Add(memoryCost)
	}

	// Total cost for this inference
	totalCost := computeCost + memoryCost + gpuCost

	// Record total cost
	inferenceCostTotal.WithLabelValues(
		metrics.Runtime,
		metrics.Endpoint,
		metrics.Model,
	).Add(totalCost)

	// Record cost distribution
	inferenceCostUSD.WithLabelValues(
		metrics.Runtime,
		metrics.Endpoint,
		metrics.Model,
	).Observe(totalCost)

	// Record memory usage
	if ct.enableDetailedTracking && metrics.MemoryBytes > 0 {
		inferenceMemoryBytes.WithLabelValues(
			metrics.Runtime,
			metrics.Endpoint,
			metrics.Model,
		).Observe(float64(metrics.MemoryBytes))
	}
}

// TrackRustInference is a helper for tracking Rust FFI inference costs
func (ct *CostTracker) TrackRustInference(endpoint, model string, durationMs, memoryBytes int64) {
	ct.TrackInference(InferenceCostMetrics{
		Runtime:     "rust",
		Endpoint:    endpoint,
		Model:       model,
		StartTime:   time.Now(),
		DurationMs:  durationMs,
		MemoryBytes: memoryBytes,
		IsGPU:       false,
	})
}

// TrackPythonInference is a helper for tracking Python ML service inference costs
func (ct *CostTracker) TrackPythonInference(endpoint, model string, durationMs, memoryBytes int64) {
	ct.TrackInference(InferenceCostMetrics{
		Runtime:     "python",
		Endpoint:    endpoint,
		Model:       model,
		StartTime:   time.Now(),
		DurationMs:  durationMs,
		MemoryBytes: memoryBytes,
		IsGPU:       false,
	})
}

// TrackGPUInference is a helper for tracking GPU inference costs
func (ct *CostTracker) TrackGPUInference(runtime, endpoint, model string, durationMs, gpuTimeMs, memoryBytes int64) {
	ct.TrackInference(InferenceCostMetrics{
		Runtime:     runtime,
		Endpoint:    endpoint,
		Model:       model,
		StartTime:   time.Now(),
		DurationMs:  durationMs,
		MemoryBytes: memoryBytes,
		IsGPU:       true,
		GPUTimeMs:   gpuTimeMs,
	})
}

// GetCostEstimate returns estimated cost for a given runtime and duration
func GetCostEstimate(runtime string, durationMs, memoryMB int64, isGPU bool) float64 {
	durationSeconds := float64(durationMs) / 1000.0

	if isGPU {
		return durationSeconds * GPUCostPerSecond
	}

	var computeCost, memoryCost float64
	if runtime == "rust" {
		computeCost = durationSeconds * RustCPUCostPerSecond
		memoryCost = float64(memoryMB) * durationSeconds * RustMemoryCostPerMB
	} else if runtime == "python" {
		computeCost = durationSeconds * PythonCPUCostPerSecond
		memoryCost = float64(memoryMB) * durationSeconds * PythonMemoryCostPerMB
	}

	return computeCost + memoryCost
}

// Cost comparison helpers

// GetRustVsPythonCostRatio calculates the cost ratio between Rust and Python
func GetRustVsPythonCostRatio(durationMs, memoryMB int64) float64 {
	rustCost := GetCostEstimate("rust", durationMs, memoryMB, false)
	pythonCost := GetCostEstimate("python", durationMs, memoryMB, false)

	if pythonCost == 0 {
		return 0
	}

	return rustCost / pythonCost
}

// GetMonthlyCostProjection projects monthly cost based on hourly rate
func GetMonthlyCostProjection(hourlyRate float64) float64 {
	return hourlyRate * 24 * 30 // 30 days
}

// GetCostPer1000Inferences calculates cost per 1000 inferences
func GetCostPer1000Inferences(totalCost float64, requestCount int64) float64 {
	if requestCount == 0 {
		return 0
	}
	return (totalCost / float64(requestCount)) * 1000
}
