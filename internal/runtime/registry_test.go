package runtime

import (
	"context"
	"errors"
	"testing"
	"time"
)

// ============================================================================
// Runtime Registry Tests
// ============================================================================

// MockRuntime is a test implementation of Runtime
type MockRuntime struct {
	name         string
	runtimeType  RuntimeType
	shouldFail   bool
	predictDelay time.Duration
}

func (m *MockRuntime) Name() string {
	return m.name
}

func (m *MockRuntime) Type() RuntimeType {
	return m.runtimeType
}

func (m *MockRuntime) Predict(ctx context.Context, req *PredictRequest) (*PredictResponse, error) {
	if m.predictDelay > 0 {
		time.Sleep(m.predictDelay)
	}

	if m.shouldFail {
		return nil, errors.New("mock prediction failed")
	}

	return &PredictResponse{
		Prediction: 42.0,
		Confidence: 0.95,
		ModelID:    req.ModelID,
		LatencyMs:  int64(m.predictDelay.Milliseconds()),
		Metadata:   map[string]string{"runtime": string(m.runtimeType)},
	}, nil
}

func (m *MockRuntime) HealthCheck(ctx context.Context) (*HealthStatus, error) {
	if m.shouldFail {
		return &HealthStatus{
			Status:              "unhealthy",
			ConsecutiveFailures: 1,
		}, errors.New("mock health check failed")
	}

	return &HealthStatus{
		Status:        "healthy",
		Version:       "1.0.0",
		UptimeSeconds: 100,
	}, nil
}

func (m *MockRuntime) Close() error {
	return nil
}

// TestRegistryRegister tests runtime registration
func TestRegistryRegister(t *testing.T) {
	registry := NewRegistry()

	runtime := &MockRuntime{
		name:        "test-runtime",
		runtimeType: RuntimeTypeRustNative,
	}

	err := registry.Register(runtime)
	if err != nil {
		t.Fatalf("Failed to register runtime: %v", err)
	}

	// Verify registration
	retrieved, err := registry.Get("test-runtime")
	if err != nil {
		t.Fatalf("Failed to get runtime: %v", err)
	}

	if retrieved.Name() != "test-runtime" {
		t.Errorf("Expected name 'test-runtime', got '%s'", retrieved.Name())
	}

	// Test duplicate registration
	err = registry.Register(runtime)
	if err == nil {
		t.Error("Expected error when registering duplicate runtime")
	}
}

// TestRegistryUnregister tests runtime unregistration
func TestRegistryUnregister(t *testing.T) {
	registry := NewRegistry()

	runtime := &MockRuntime{
		name:        "test-runtime",
		runtimeType: RuntimeTypeRustNative,
	}

	registry.Register(runtime)

	err := registry.Unregister("test-runtime")
	if err != nil {
		t.Fatalf("Failed to unregister runtime: %v", err)
	}

	// Verify unregistration
	_, err = registry.Get("test-runtime")
	if err == nil {
		t.Error("Expected error when getting unregistered runtime")
	}
}

// TestRegistryList tests listing runtimes
func TestRegistryList(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	runtimes := registry.List()

	if len(runtimes) != 2 {
		t.Errorf("Expected 2 runtimes, got %d", len(runtimes))
	}

	// Check that both runtimes are listed
	found1, found2 := false, false
	for _, name := range runtimes {
		if name == "runtime1" {
			found1 = true
		}
		if name == "runtime2" {
			found2 = true
		}
	}

	if !found1 || !found2 {
		t.Error("Not all runtimes were listed")
	}
}

// TestRegistryPredict tests prediction through registry
func TestRegistryPredict(t *testing.T) {
	registry := NewRegistry()

	runtime := &MockRuntime{
		name:        "test-runtime",
		runtimeType: RuntimeTypeRustNative,
	}

	registry.Register(runtime)

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	resp, err := registry.Predict(ctx, "test-runtime", req)
	if err != nil {
		t.Fatalf("Prediction failed: %v", err)
	}

	if resp.Prediction != 42.0 {
		t.Errorf("Expected prediction 42.0, got %f", resp.Prediction)
	}

	// Test prediction with non-existent runtime
	_, err = registry.Predict(ctx, "non-existent", req)
	if err == nil {
		t.Error("Expected error when predicting with non-existent runtime")
	}
}

// TestRegistryHealthCheck tests health checking
func TestRegistryHealthCheck(t *testing.T) {
	registry := NewRegistry()

	runtime := &MockRuntime{
		name:        "test-runtime",
		runtimeType: RuntimeTypeRustNative,
	}

	registry.Register(runtime)

	// Wait for initial health check
	time.Sleep(100 * time.Millisecond)

	health, err := registry.GetHealth("test-runtime")
	if err != nil {
		t.Fatalf("Failed to get health: %v", err)
	}

	if health.Status != "healthy" {
		t.Errorf("Expected status 'healthy', got '%s'", health.Status)
	}
}

// TestRegistryCheckAllHealth tests checking all runtimes
func TestRegistryCheckAllHealth(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc, shouldFail: true}

	registry.Register(runtime1)
	registry.Register(runtime2)

	healthMap := registry.CheckAllHealth()

	if len(healthMap) != 2 {
		t.Errorf("Expected 2 health statuses, got %d", len(healthMap))
	}

	if healthMap["runtime1"].Status != "healthy" {
		t.Error("Runtime1 should be healthy")
	}

	if healthMap["runtime2"].Status != "unhealthy" {
		t.Error("Runtime2 should be unhealthy")
	}
}

// TestRegistryMetrics tests metrics collection
func TestRegistryMetrics(t *testing.T) {
	registry := NewRegistry()

	runtime := &MockRuntime{
		name:        "test-runtime",
		runtimeType: RuntimeTypeRustNative,
	}

	registry.Register(runtime)

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	// Make some predictions
	for i := 0; i < 5; i++ {
		registry.Predict(ctx, "test-runtime", req)
	}

	metrics := registry.GetMetrics()

	if metrics.TotalRuntimes != 1 {
		t.Errorf("Expected 1 total runtime, got %d", metrics.TotalRuntimes)
	}

	if metrics.TotalRequests != 5 {
		t.Errorf("Expected 5 total requests, got %d", metrics.TotalRequests)
	}
}

// TestRegistryRuntimeStats tests runtime statistics
func TestRegistryRuntimeStats(t *testing.T) {
	registry := NewRegistry()

	runtime := &MockRuntime{
		name:        "test-runtime",
		runtimeType: RuntimeTypeRustNative,
	}

	registry.Register(runtime)

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	// Make predictions
	registry.Predict(ctx, "test-runtime", req)

	stats := registry.GetRuntimeStats()

	if len(stats) != 1 {
		t.Fatalf("Expected 1 runtime stat, got %d", len(stats))
	}

	runtimeStat, ok := stats["test-runtime"]
	if !ok {
		t.Fatal("Runtime stat not found")
	}

	if runtimeStat.RequestCount != 1 {
		t.Errorf("Expected 1 request, got %d", runtimeStat.RequestCount)
	}

	if runtimeStat.ErrorCount != 0 {
		t.Errorf("Expected 0 errors, got %d", runtimeStat.ErrorCount)
	}
}

// TestRegistryClose tests closing all runtimes
func TestRegistryClose(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	err := registry.Close()
	if err != nil {
		t.Fatalf("Failed to close registry: %v", err)
	}

	// Verify all runtimes are unregistered
	runtimes := registry.List()
	if len(runtimes) != 0 {
		t.Errorf("Expected 0 runtimes after close, got %d", len(runtimes))
	}
}

// BenchmarkRegistryPredict benchmarks prediction performance
func BenchmarkRegistryPredict(b *testing.B) {
	registry := NewRegistry()

	runtime := &MockRuntime{
		name:        "test-runtime",
		runtimeType: RuntimeTypeRustNative,
	}

	registry.Register(runtime)

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		registry.Predict(ctx, "test-runtime", req)
	}
}
