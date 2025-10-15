package runtime

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// ============================================================================
// Runtime Registry for Schlep-Engine
// ============================================================================
//
// Manages multiple inference runtimes with:
// - Runtime registration and discovery
// - Health tracking per runtime
// - Metrics collection
// - Thread-safe operations
//
// Runtimes can include:
// - Rust Native (FFI)
// - Python gRPC
// - Future: WASM, TensorFlow Serving, etc.
//
// Phase: 2 - Runtime Abstraction
// ============================================================================

// Runtime represents an inference runtime
type Runtime interface {
	// Name returns the runtime identifier
	Name() string

	// Type returns the runtime type (rust_native, python_grpc, wasm)
	Type() RuntimeType

	// Predict executes inference on the runtime
	Predict(ctx context.Context, req *PredictRequest) (*PredictResponse, error)

	// HealthCheck checks runtime health
	HealthCheck(ctx context.Context) (*HealthStatus, error)

	// Close shuts down the runtime
	Close() error
}

// RuntimeType identifies the runtime implementation
type RuntimeType string

const (
	RuntimeTypeRustNative RuntimeType = "rust_native"
	RuntimeTypePythonGrpc RuntimeType = "python_grpc"
	RuntimeTypeWasm       RuntimeType = "wasm"
)

// PredictRequest contains prediction input
type PredictRequest struct {
	ModelID  string
	Features []float64
	Metadata map[string]string
}

// PredictResponse contains prediction output
type PredictResponse struct {
	Prediction    float64
	Confidence    float64
	ModelID       string
	LatencyMs     int64
	Probabilities map[string]float64
	Metadata      map[string]string
}

// HealthStatus represents runtime health
type HealthStatus struct {
	Status             string
	Version            string
	UptimeSeconds      int64
	LoadedModelsCount  int32
	LoadedModels       []string
	SystemMetrics      map[string]string
	LastHealthCheck    time.Time
	ConsecutiveFailures int
}

// Registry manages a collection of runtimes
type Registry struct {
	runtimes map[string]*runtimeEntry
	mu       sync.RWMutex
	metrics  *RegistryMetrics
}

// runtimeEntry wraps a runtime with metadata
type runtimeEntry struct {
	runtime      Runtime
	health       *HealthStatus
	registeredAt time.Time
	lastUsed     time.Time
	requestCount uint64
	errorCount   uint64
	mu           sync.RWMutex
}

// RegistryMetrics tracks registry statistics
type RegistryMetrics struct {
	TotalRuntimes   int
	HealthyRuntimes int
	TotalRequests   uint64
	FailedRequests  uint64
	mu              sync.RWMutex
}

// NewRegistry creates a new runtime registry
func NewRegistry() *Registry {
	return &Registry{
		runtimes: make(map[string]*runtimeEntry),
		metrics: &RegistryMetrics{
			TotalRuntimes:   0,
			HealthyRuntimes: 0,
			TotalRequests:   0,
			FailedRequests:  0,
		},
	}
}

// Register adds a runtime to the registry
func (r *Registry) Register(runtime Runtime) error {
	if runtime == nil {
		return fmt.Errorf("runtime cannot be nil")
	}

	name := runtime.Name()
	if name == "" {
		return fmt.Errorf("runtime name cannot be empty")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.runtimes[name]; exists {
		return fmt.Errorf("runtime '%s' already registered", name)
	}

	entry := &runtimeEntry{
		runtime:      runtime,
		registeredAt: time.Now(),
		lastUsed:     time.Now(),
		health: &HealthStatus{
			Status:              "unknown",
			LastHealthCheck:     time.Now(),
			ConsecutiveFailures: 0,
		},
	}

	r.runtimes[name] = entry
	r.metrics.TotalRuntimes++

	// Perform initial health check
	go r.checkRuntimeHealth(name)

	return nil
}

// Unregister removes a runtime from the registry
func (r *Registry) Unregister(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	entry, exists := r.runtimes[name]
	if !exists {
		return fmt.Errorf("runtime '%s' not found", name)
	}

	// Close the runtime
	if err := entry.runtime.Close(); err != nil {
		return fmt.Errorf("failed to close runtime: %w", err)
	}

	delete(r.runtimes, name)
	r.metrics.TotalRuntimes--

	return nil
}

// Get retrieves a runtime by name
func (r *Registry) Get(name string) (Runtime, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	entry, exists := r.runtimes[name]
	if !exists {
		return nil, fmt.Errorf("runtime '%s' not found", name)
	}

	return entry.runtime, nil
}

// List returns all registered runtime names
func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.runtimes))
	for name := range r.runtimes {
		names = append(names, name)
	}

	return names
}

// Predict executes prediction on the specified runtime
func (r *Registry) Predict(ctx context.Context, runtimeName string, req *PredictRequest) (*PredictResponse, error) {
	r.mu.RLock()
	entry, exists := r.runtimes[runtimeName]
	r.mu.RUnlock()

	if !exists {
		r.metrics.mu.Lock()
		r.metrics.FailedRequests++
		r.metrics.mu.Unlock()
		return nil, fmt.Errorf("runtime '%s' not found", runtimeName)
	}

	// Update usage stats
	entry.mu.Lock()
	entry.lastUsed = time.Now()
	entry.requestCount++
	entry.mu.Unlock()

	r.metrics.mu.Lock()
	r.metrics.TotalRequests++
	r.metrics.mu.Unlock()

	// Execute prediction
	resp, err := entry.runtime.Predict(ctx, req)
	if err != nil {
		entry.mu.Lock()
		entry.errorCount++
		entry.mu.Unlock()

		r.metrics.mu.Lock()
		r.metrics.FailedRequests++
		r.metrics.mu.Unlock()

		return nil, err
	}

	return resp, nil
}

// GetHealth returns health status for a runtime
func (r *Registry) GetHealth(name string) (*HealthStatus, error) {
	r.mu.RLock()
	entry, exists := r.runtimes[name]
	r.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("runtime '%s' not found", name)
	}

	entry.mu.RLock()
	defer entry.mu.RUnlock()

	// Return a copy of the health status
	health := *entry.health
	return &health, nil
}

// checkRuntimeHealth performs a health check on a specific runtime
func (r *Registry) checkRuntimeHealth(name string) {
	r.mu.RLock()
	entry, exists := r.runtimes[name]
	r.mu.RUnlock()

	if !exists {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	health, err := entry.runtime.HealthCheck(ctx)

	entry.mu.Lock()
	defer entry.mu.Unlock()

	if err != nil {
		entry.health.Status = "unhealthy"
		entry.health.ConsecutiveFailures++
		entry.health.LastHealthCheck = time.Now()
	} else {
		entry.health = health
		entry.health.LastHealthCheck = time.Now()
		entry.health.ConsecutiveFailures = 0
	}
}

// CheckAllHealth performs health checks on all runtimes
func (r *Registry) CheckAllHealth() map[string]*HealthStatus {
	r.mu.RLock()
	names := make([]string, 0, len(r.runtimes))
	for name := range r.runtimes {
		names = append(names, name)
	}
	r.mu.RUnlock()

	results := make(map[string]*HealthStatus)
	for _, name := range names {
		r.checkRuntimeHealth(name)
		if health, err := r.GetHealth(name); err == nil {
			results[name] = health
		}
	}

	// Update metrics
	healthyCount := 0
	for _, health := range results {
		if health.Status == "healthy" {
			healthyCount++
		}
	}

	r.metrics.mu.Lock()
	r.metrics.HealthyRuntimes = healthyCount
	r.metrics.mu.Unlock()

	return results
}

// GetMetrics returns registry metrics
func (r *Registry) GetMetrics() *RegistryMetrics {
	r.metrics.mu.RLock()
	defer r.metrics.mu.RUnlock()

	return &RegistryMetrics{
		TotalRuntimes:   r.metrics.TotalRuntimes,
		HealthyRuntimes: r.metrics.HealthyRuntimes,
		TotalRequests:   r.metrics.TotalRequests,
		FailedRequests:  r.metrics.FailedRequests,
	}
}

// GetRuntimeStats returns detailed statistics for all runtimes
func (r *Registry) GetRuntimeStats() map[string]*RuntimeStats {
	r.mu.RLock()
	defer r.mu.RUnlock()

	stats := make(map[string]*RuntimeStats)
	for name, entry := range r.runtimes {
		entry.mu.RLock()
		stats[name] = &RuntimeStats{
			Name:         name,
			Type:         entry.runtime.Type(),
			RegisteredAt: entry.registeredAt,
			LastUsed:     entry.lastUsed,
			RequestCount: entry.requestCount,
			ErrorCount:   entry.errorCount,
			ErrorRate:    float64(entry.errorCount) / float64(max(entry.requestCount, 1)),
			Health:       *entry.health,
		}
		entry.mu.RUnlock()
	}

	return stats
}

// RuntimeStats contains statistics for a single runtime
type RuntimeStats struct {
	Name         string
	Type         RuntimeType
	RegisteredAt time.Time
	LastUsed     time.Time
	RequestCount uint64
	ErrorCount   uint64
	ErrorRate    float64
	Health       HealthStatus
}

// Close shuts down all runtimes in the registry
func (r *Registry) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	var lastError error
	for name, entry := range r.runtimes {
		if err := entry.runtime.Close(); err != nil {
			lastError = fmt.Errorf("failed to close runtime '%s': %w", name, err)
		}
	}

	r.runtimes = make(map[string]*runtimeEntry)
	r.metrics.TotalRuntimes = 0
	r.metrics.HealthyRuntimes = 0

	return lastError
}

// Helper function
func max(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}
