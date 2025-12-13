package ml

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Schlep-engine/igris-inertial/internal/observability"
)

// RuntimeType represents different inference runtime backends
type RuntimeType string

const (
	RuntimePyTorch   RuntimeType = "pytorch"
	RuntimeONNX      RuntimeType = "onnx"
	RuntimeTensorRT  RuntimeType = "tensorrt"
	RuntimeCPU       RuntimeType = "cpu"
)

// GPURuntimeConfig holds GPU runtime configuration
type GPURuntimeConfig struct {
	// ONNX Runtime settings
	UseGPU              bool
	CUDADeviceID        int
	ONNXOptimizationLevel int  // 0=disable, 1=basic, 2=extended, 3=all
	EnableTensorRT      bool
	TensorRTFP16        bool   // Enable FP16 precision

	// Performance settings
	IntraOpThreads      int
	InterOpThreads      int
	ExecutionProviders  []string // e.g., ["CUDAExecutionProvider", "CPUExecutionProvider"]

	// Memory management
	MemoryLimitGB       float64
	MemoryArenaExtend   bool
}

// DefaultGPURuntimeConfig returns recommended GPU runtime defaults
var DefaultGPURuntimeConfig = GPURuntimeConfig{
	UseGPU:              true,
	CUDADeviceID:        0,
	ONNXOptimizationLevel: 3,
	EnableTensorRT:      false,
	TensorRTFP16:        false,
	IntraOpThreads:      4,
	InterOpThreads:      2,
	ExecutionProviders:  []string{"CUDAExecutionProvider", "CPUExecutionProvider"},
	MemoryLimitGB:       2.0,
	MemoryArenaExtend:   true,
}

// GPURuntime manages GPU-accelerated inference
type GPURuntime struct {
	config     GPURuntimeConfig
	client     *Client

	// Runtime selection and stats
	preferredRuntime RuntimeType
	runtimeStats     map[RuntimeType]*RuntimeStats
	statsMutex       sync.RWMutex

	// GPU availability
	gpuAvailable     bool
	gpuMemoryUsedMB  int64 // Atomic
	gpuUtilization   int64 // Atomic (0-100)

	// Fallback mechanism
	enableFallback   bool
	fallbackCount    int64 // Atomic
}

// RuntimeStats tracks performance for each runtime
type RuntimeStats struct {
	TotalRequests   int64
	SuccessRequests int64
	FailedRequests  int64
	TotalLatencyMs  int64
	AvgLatencyMs    float64
	LastUpdateTime  time.Time
}

// NewGPURuntime creates a new GPU runtime manager
func NewGPURuntime(client *Client, config GPURuntimeConfig) (*GPURuntime, error) {
	runtime := &GPURuntime{
		config:           config,
		client:           client,
		preferredRuntime: RuntimeONNX,
		runtimeStats:     make(map[RuntimeType]*RuntimeStats),
		enableFallback:   true,
		gpuAvailable:     config.UseGPU,
	}

	// Initialize stats for each runtime type
	runtimeTypes := []RuntimeType{RuntimePyTorch, RuntimeONNX, RuntimeTensorRT, RuntimeCPU}
	for _, rt := range runtimeTypes {
		runtime.runtimeStats[rt] = &RuntimeStats{
			LastUpdateTime: time.Now(),
		}
	}

	// Detect GPU availability
	if config.UseGPU {
		available, err := runtime.checkGPUAvailability()
		if err != nil {
			log.Printf("[GPURuntime] GPU check failed: %v, falling back to CPU", err)
			runtime.gpuAvailable = false
			runtime.preferredRuntime = RuntimeCPU
		} else if !available {
			log.Printf("[GPURuntime] GPU not available, using CPU runtime")
			runtime.gpuAvailable = false
			runtime.preferredRuntime = RuntimeCPU
		} else {
			log.Printf("[GPURuntime] GPU detected (device: %d), using ONNX runtime", config.CUDADeviceID)
			if config.EnableTensorRT {
				runtime.preferredRuntime = RuntimeTensorRT
				log.Printf("[GPURuntime] TensorRT enabled (FP16: %v)", config.TensorRTFP16)
			}
		}
	} else {
		runtime.preferredRuntime = RuntimeCPU
		log.Printf("[GPURuntime] GPU disabled, using CPU runtime")
	}

	return runtime, nil
}

// Infer performs inference using the optimal runtime
func (g *GPURuntime) Infer(ctx context.Context, features []float64, modelID string) (*PredictResponse, error) {
	// Select runtime based on current conditions
	runtime := g.selectRuntime(modelID)

	start := time.Now()
	var resp *PredictResponse
	var err error

	// Execute inference based on selected runtime
	switch runtime {
	case RuntimeONNX:
		resp, err = g.inferONNX(ctx, features, modelID)
	case RuntimeTensorRT:
		resp, err = g.inferTensorRT(ctx, features, modelID)
	case RuntimePyTorch:
		resp, err = g.inferPyTorch(ctx, features, modelID)
	case RuntimeCPU:
		resp, err = g.inferCPU(ctx, features, modelID)
	default:
		resp, err = g.inferCPU(ctx, features, modelID)
	}

	latency := time.Since(start)

	// Record metrics
	g.updateRuntimeStats(runtime, latency, err == nil)
	observability.RecordGPUInferenceLatency(string(runtime), latency.Milliseconds(), err == nil)

	// Attempt fallback if GPU inference failed
	if err != nil && g.enableFallback && runtime != RuntimeCPU {
		log.Printf("[GPURuntime] %s inference failed: %v, falling back to CPU", runtime, err)
		atomic.AddInt64(&g.fallbackCount, 1)
		observability.RecordGPUFallback(string(runtime))

		resp, err = g.inferCPU(ctx, features, modelID)
		if err == nil {
			g.updateRuntimeStats(RuntimeCPU, time.Since(start), true)
		}
	}

	return resp, err
}

// selectRuntime chooses the best runtime based on current state
func (g *GPURuntime) selectRuntime(modelID string) RuntimeType {
	// If GPU unavailable, use CPU
	if !g.gpuAvailable {
		return RuntimeCPU
	}

	// Check GPU memory and utilization
	memUsed := atomic.LoadInt64(&g.gpuMemoryUsedMB)
	utilization := atomic.LoadInt64(&g.gpuUtilization)

	// If GPU is overloaded, fall back to CPU
	if utilization > 95 || memUsed > int64(g.config.MemoryLimitGB*1024*0.9) {
		log.Printf("[GPURuntime] GPU overloaded (util: %d%%, mem: %dMB), using CPU", utilization, memUsed)
		return RuntimeCPU
	}

	return g.preferredRuntime
}

// inferONNX performs inference using ONNX Runtime with CUDA
func (g *GPURuntime) inferONNX(ctx context.Context, features []float64, modelID string) (*PredictResponse, error) {
	// In production, this would call into ONNX Runtime via CGO or FFI
	// For now, we'll use the existing client with runtime hint
	req := &PredictRequest{
		Features: features,
		ModelID:  modelID,
		Runtime:  string(RuntimeONNX),
		UseGPU:   true,
		DeviceID: g.config.CUDADeviceID,
	}

	return g.executeInference(ctx, req)
}

// inferTensorRT performs inference using TensorRT
func (g *GPURuntime) inferTensorRT(ctx context.Context, features []float64, modelID string) (*PredictResponse, error) {
	req := &PredictRequest{
		Features: features,
		ModelID:  modelID,
		Runtime:  string(RuntimeTensorRT),
		UseGPU:   true,
		DeviceID: g.config.CUDADeviceID,
		UseFP16:  g.config.TensorRTFP16,
	}

	return g.executeInference(ctx, req)
}

// inferPyTorch performs inference using PyTorch
func (g *GPURuntime) inferPyTorch(ctx context.Context, features []float64, modelID string) (*PredictResponse, error) {
	req := &PredictRequest{
		Features: features,
		ModelID:  modelID,
		Runtime:  string(RuntimePyTorch),
		UseGPU:   g.gpuAvailable,
		DeviceID: g.config.CUDADeviceID,
	}

	return g.executeInference(ctx, req)
}

// inferCPU performs inference using CPU-only runtime
func (g *GPURuntime) inferCPU(ctx context.Context, features []float64, modelID string) (*PredictResponse, error) {
	// Use existing client for CPU inference
	return g.client.Predict(ctx, features, modelID)
}

// executeInference is a helper for executing inference requests
func (g *GPURuntime) executeInference(ctx context.Context, req *PredictRequest) (*PredictResponse, error) {
	// This would be extended to support the new request format
	// For now, use the standard client
	return g.client.Predict(ctx, req.Features, req.ModelID)
}

// checkGPUAvailability checks if GPU is available for inference
func (g *GPURuntime) checkGPUAvailability() (bool, error) {
	// In production, this would query CUDA runtime or ONNX Runtime
	// For now, we simulate GPU availability check
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Try a simple health check
	healthy, err := g.client.HealthCheck(ctx)
	if err != nil {
		return false, err
	}

	// TODO: Add actual GPU detection via:
	// - nvidia-smi query
	// - CUDA runtime API
	// - ONNX Runtime GPU provider check

	return healthy, nil
}

// updateRuntimeStats updates statistics for a runtime
func (g *GPURuntime) updateRuntimeStats(runtime RuntimeType, latency time.Duration, success bool) {
	g.statsMutex.Lock()
	defer g.statsMutex.Unlock()

	stats := g.runtimeStats[runtime]
	atomic.AddInt64(&stats.TotalRequests, 1)

	if success {
		atomic.AddInt64(&stats.SuccessRequests, 1)
	} else {
		atomic.AddInt64(&stats.FailedRequests, 1)
	}

	latencyMs := latency.Milliseconds()
	atomic.AddInt64(&stats.TotalLatencyMs, latencyMs)

	// Calculate moving average
	totalReqs := atomic.LoadInt64(&stats.TotalRequests)
	totalLat := atomic.LoadInt64(&stats.TotalLatencyMs)
	stats.AvgLatencyMs = float64(totalLat) / float64(totalReqs)
	stats.LastUpdateTime = time.Now()
}

// GetRuntimeStats returns statistics for a specific runtime
func (g *GPURuntime) GetRuntimeStats(runtime RuntimeType) *RuntimeStats {
	g.statsMutex.RLock()
	defer g.statsMutex.RUnlock()

	stats := g.runtimeStats[runtime]
	return &RuntimeStats{
		TotalRequests:   atomic.LoadInt64(&stats.TotalRequests),
		SuccessRequests: atomic.LoadInt64(&stats.SuccessRequests),
		FailedRequests:  atomic.LoadInt64(&stats.FailedRequests),
		TotalLatencyMs:  atomic.LoadInt64(&stats.TotalLatencyMs),
		AvgLatencyMs:    stats.AvgLatencyMs,
		LastUpdateTime:  stats.LastUpdateTime,
	}
}

// GetAllStats returns statistics for all runtimes
func (g *GPURuntime) GetAllStats() map[RuntimeType]*RuntimeStats {
	result := make(map[RuntimeType]*RuntimeStats)

	runtimeTypes := []RuntimeType{RuntimePyTorch, RuntimeONNX, RuntimeTensorRT, RuntimeCPU}
	for _, rt := range runtimeTypes {
		result[rt] = g.GetRuntimeStats(rt)
	}

	return result
}

// UpdateGPUMetrics updates GPU memory and utilization metrics
func (g *GPURuntime) UpdateGPUMetrics(memoryMB int64, utilization int64) {
	atomic.StoreInt64(&g.gpuMemoryUsedMB, memoryMB)
	atomic.StoreInt64(&g.gpuUtilization, utilization)

	observability.RecordGPUMemoryUsage(memoryMB)
	observability.RecordGPUUtilization(utilization)
}

// GetGPUStatus returns current GPU status
func (g *GPURuntime) GetGPUStatus() GPUStatus {
	return GPUStatus{
		Available:      g.gpuAvailable,
		DeviceID:       g.config.CUDADeviceID,
		MemoryUsedMB:   atomic.LoadInt64(&g.gpuMemoryUsedMB),
		MemoryLimitMB:  int64(g.config.MemoryLimitGB * 1024),
		Utilization:    atomic.LoadInt64(&g.gpuUtilization),
		FallbackCount:  atomic.LoadInt64(&g.fallbackCount),
		RuntimeInUse:   g.preferredRuntime,
	}
}

// PredictRequest extended for GPU runtime support
type PredictRequest struct {
	Features []float64
	ModelID  string
	Runtime  string
	UseGPU   bool
	DeviceID int
	UseFP16  bool
}

// GPUStatus contains GPU runtime status information
type GPUStatus struct {
	Available      bool
	DeviceID       int
	MemoryUsedMB   int64
	MemoryLimitMB  int64
	Utilization    int64
	FallbackCount  int64
	RuntimeInUse   RuntimeType
}

// String returns a string representation of GPU status
func (s GPUStatus) String() string {
	return fmt.Sprintf(
		"GPU[%d]: Available=%v, Mem=%dMB/%dMB (%.1f%%), Util=%d%%, Fallbacks=%d, Runtime=%s",
		s.DeviceID,
		s.Available,
		s.MemoryUsedMB,
		s.MemoryLimitMB,
		float64(s.MemoryUsedMB)/float64(s.MemoryLimitMB)*100,
		s.Utilization,
		s.FallbackCount,
		s.RuntimeInUse,
	)
}
