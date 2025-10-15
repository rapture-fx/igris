package ml

import (
	"context"
	"testing"
	"time"
)

func TestNewGPURuntime(t *testing.T) {
	client, err := NewClient("localhost:50051")
	if err != nil {
		t.Skip("ML service not available, skipping GPU runtime tests")
	}
	defer client.Close()

	config := DefaultGPURuntimeConfig
	config.UseGPU = false // Force CPU mode for testing

	runtime, err := NewGPURuntime(client, config)
	if err != nil {
		t.Fatalf("Failed to create GPU runtime: %v", err)
	}

	if runtime == nil {
		t.Fatal("Runtime should not be nil")
	}

	if runtime.preferredRuntime != RuntimeCPU {
		t.Errorf("Expected CPU runtime when GPU disabled, got %s", runtime.preferredRuntime)
	}
}

func TestGPURuntimeInfer(t *testing.T) {
	client, err := NewClient("localhost:50051")
	if err != nil {
		t.Skip("ML service not available")
	}
	defer client.Close()

	config := DefaultGPURuntimeConfig
	config.UseGPU = false

	runtime, err := NewGPURuntime(client, config)
	if err != nil {
		t.Fatalf("Failed to create runtime: %v", err)
	}

	ctx := context.Background()
	features := []float64{1.0, 2.0, 3.0}

	result, err := runtime.Infer(ctx, features, "test_model")
	if err != nil {
		t.Fatalf("Inference failed: %v", err)
	}

	if result == nil {
		t.Fatal("Result should not be nil")
	}
}

func TestGPURuntimeSelection(t *testing.T) {
	client, err := NewClient("localhost:50051")
	if err != nil {
		t.Skip("ML service not available")
	}
	defer client.Close()

	config := DefaultGPURuntimeConfig
	config.UseGPU = false

	runtime, err := NewGPURuntime(client, config)
	if err != nil {
		t.Fatalf("Failed to create runtime: %v", err)
	}

	selectedRuntime := runtime.selectRuntime("test")
	if selectedRuntime != RuntimeCPU {
		t.Errorf("Expected CPU runtime, got %s", selectedRuntime)
	}
}

func TestGPURuntimeStats(t *testing.T) {
	client, err := NewClient("localhost:50051")
	if err != nil {
		t.Skip("ML service not available")
	}
	defer client.Close()

	config := DefaultGPURuntimeConfig
	config.UseGPU = false

	runtime, err := NewGPURuntime(client, config)
	if err != nil {
		t.Fatalf("Failed to create runtime: %v", err)
	}

	// Update some fake stats
	runtime.updateRuntimeStats(RuntimeCPU, 10*time.Millisecond, true)
	runtime.updateRuntimeStats(RuntimeCPU, 20*time.Millisecond, true)

	stats := runtime.GetRuntimeStats(RuntimeCPU)
	if stats.TotalRequests != 2 {
		t.Errorf("Expected 2 requests, got %d", stats.TotalRequests)
	}

	if stats.SuccessRequests != 2 {
		t.Errorf("Expected 2 success, got %d", stats.SuccessRequests)
	}
}

func TestGPUStatusString(t *testing.T) {
	status := GPUStatus{
		Available:      true,
		DeviceID:       0,
		MemoryUsedMB:   512,
		MemoryLimitMB:  2048,
		Utilization:    75,
		FallbackCount:  3,
		RuntimeInUse:   RuntimeONNX,
	}

	str := status.String()
	if str == "" {
		t.Error("Status string should not be empty")
	}
}

func TestGPUMetricsUpdate(t *testing.T) {
	client, err := NewClient("localhost:50051")
	if err != nil {
		t.Skip("ML service not available")
	}
	defer client.Close()

	config := DefaultGPURuntimeConfig
	runtime, err := NewGPURuntime(client, config)
	if err != nil {
		t.Fatalf("Failed to create runtime: %v", err)
	}

	runtime.UpdateGPUMetrics(1024, 80)

	status := runtime.GetGPUStatus()
	if status.MemoryUsedMB != 1024 {
		t.Errorf("Expected memory 1024MB, got %d", status.MemoryUsedMB)
	}

	if status.Utilization != 80 {
		t.Errorf("Expected utilization 80%%, got %d", status.Utilization)
	}
}

func BenchmarkGPURuntimeInfer(b *testing.B) {
	client, err := NewClient("localhost:50051")
	if err != nil {
		b.Skip("ML service not available")
	}
	defer client.Close()

	config := DefaultGPURuntimeConfig
	config.UseGPU = false

	runtime, err := NewGPURuntime(client, config)
	if err != nil {
		b.Fatalf("Failed to create runtime: %v", err)
	}

	ctx := context.Background()
	features := []float64{1.0, 2.0, 3.0}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = runtime.Infer(ctx, features, "test_model")
	}
}
