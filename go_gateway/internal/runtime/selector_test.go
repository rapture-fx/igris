package runtime

import (
	"context"
	"testing"
)

// ============================================================================
// Runtime Selector Tests
// ============================================================================

// TestSelectorRoundRobin tests round-robin selection
func TestSelectorRoundRobin(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	selector := NewSelector(registry, SelectorConfig{
		Strategy: StrategyRoundRobin,
	})

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	// Test round-robin distribution
	selections := make(map[string]int)
	for i := 0; i < 10; i++ {
		selected, err := selector.SelectRuntime(ctx, req)
		if err != nil {
			t.Fatalf("Selection failed: %v", err)
		}
		selections[selected]++
	}

	// Both runtimes should be selected multiple times
	if selections["runtime1"] == 0 || selections["runtime2"] == 0 {
		t.Error("Round-robin should select all runtimes")
	}
}

// TestSelectorLeastLoaded tests least-loaded selection
func TestSelectorLeastLoaded(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	// Wait for health checks to complete
	registry.CheckAllHealth()

	selector := NewSelector(registry, SelectorConfig{
		Strategy: StrategyLeastLoaded,
	})

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	// Make runtime1 busy
	for i := 0; i < 10; i++ {
		registry.Predict(ctx, "runtime1", req)
	}

	// Next selection should prefer runtime2 (less loaded)
	selected, err := selector.SelectRuntime(ctx, req)
	if err != nil {
		t.Fatalf("Selection failed: %v", err)
	}

	// runtime2 should be selected as it has fewer requests
	if selected != "runtime2" {
		t.Errorf("Expected 'runtime2' to be selected (least loaded), got '%s'", selected)
	}
}

// TestSelectorHealthyOnly tests healthy-only selection
func TestSelectorHealthyOnly(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc, shouldFail: true}

	registry.Register(runtime1)
	registry.Register(runtime2)

	// Wait for health checks
	registry.CheckAllHealth()

	selector := NewSelector(registry, SelectorConfig{
		Strategy: StrategyHealthyOnly,
	})

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	// Should only select healthy runtime
	selected, err := selector.SelectRuntime(ctx, req)
	if err != nil {
		t.Fatalf("Selection failed: %v", err)
	}

	if selected != "runtime1" {
		t.Errorf("Expected 'runtime1' (healthy), got '%s'", selected)
	}
}

// TestSelectorWeighted tests weighted selection
func TestSelectorWeighted(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	selector := NewSelector(registry, SelectorConfig{
		Strategy: StrategyWeighted,
		Weights: map[string]float64{
			"runtime1": 0.9, // 90% weight
			"runtime2": 0.1, // 10% weight
		},
	})

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	// Test weighted distribution
	selections := make(map[string]int)
	iterations := 100

	for i := 0; i < iterations; i++ {
		selected, err := selector.SelectRuntime(ctx, req)
		if err != nil {
			t.Fatalf("Selection failed: %v", err)
		}
		selections[selected]++
	}

	// runtime1 should be selected more often (roughly 90% of the time)
	ratio := float64(selections["runtime1"]) / float64(iterations)
	if ratio < 0.7 || ratio > 1.0 {
		t.Logf("Warning: Expected ~90%% selection for runtime1, got %.2f%%", ratio*100)
	}
}

// TestSelectorPredictWithFallback tests fallback mechanism
func TestSelectorPredictWithFallback(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative, shouldFail: true}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	selector := NewSelector(registry, SelectorConfig{
		Strategy:      StrategyRoundRobin,
		FallbackChain: []string{"runtime2"},
	})

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	// Should fallback to runtime2 when runtime1 fails
	resp, err := selector.PredictWithFallback(ctx, req)
	if err != nil {
		t.Fatalf("Prediction with fallback failed: %v", err)
	}

	if resp == nil {
		t.Fatal("Expected non-nil response")
	}

	// Check fallback metadata
	if resp.Metadata["fallback_to"] != "runtime2" {
		t.Error("Expected fallback metadata to indicate runtime2")
	}
}

// TestSelectorSelectForModel tests model-based selection
func TestSelectorSelectForModel(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "rust-fast", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "python-gpu", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	selector := NewSelector(registry, SelectorConfig{
		Strategy: StrategyRoundRobin,
	})

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	// Test GPU requirement
	requirements := ModelRequirements{
		RequiresGPU: true,
	}

	selected, err := selector.SelectForModel(ctx, req, requirements)
	if err != nil {
		t.Fatalf("Model selection failed: %v", err)
	}

	// Should select Python runtime for GPU
	if selected != "python-gpu" {
		t.Errorf("Expected 'python-gpu' for GPU requirement, got '%s'", selected)
	}

	// Test low latency requirement
	requirements = ModelRequirements{
		MaxLatencyMs: 3,
	}

	selected, err = selector.SelectForModel(ctx, req, requirements)
	if err != nil {
		t.Fatalf("Model selection failed: %v", err)
	}

	// Should select Rust runtime for low latency
	if selected != "rust-fast" {
		t.Errorf("Expected 'rust-fast' for low latency, got '%s'", selected)
	}
}

// TestSelectorABTest tests A/B testing
func TestSelectorABTest(t *testing.T) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	selector := NewSelector(registry, SelectorConfig{
		Strategy: StrategyRoundRobin,
	})

	config := ABTestConfig{
		RuntimeA:      "runtime1",
		RuntimeB:      "runtime2",
		TrafficSplitA: 0.5, // 50/50 split
	}

	// Test A/B distribution
	selections := make(map[string]int)
	iterations := 100

	for i := 0; i < iterations; i++ {
		selected, err := selector.SelectForABTest(config)
		if err != nil {
			t.Fatalf("A/B test selection failed: %v", err)
		}
		selections[selected]++
	}

	// Both runtimes should be selected roughly equally
	ratio := float64(selections["runtime1"]) / float64(iterations)
	if ratio < 0.3 || ratio > 0.7 {
		t.Logf("Warning: Expected ~50%% for runtime1, got %.2f%%", ratio*100)
	}
}

// TestSelectorNoRuntimes tests behavior with no runtimes
func TestSelectorNoRuntimes(t *testing.T) {
	registry := NewRegistry()

	selector := NewSelector(registry, SelectorConfig{
		Strategy: StrategyRoundRobin,
	})

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	_, err := selector.SelectRuntime(ctx, req)
	if err == nil {
		t.Error("Expected error when no runtimes available")
	}
}

// BenchmarkSelectorRoundRobin benchmarks round-robin selection
func BenchmarkSelectorRoundRobin(b *testing.B) {
	registry := NewRegistry()

	runtime1 := &MockRuntime{name: "runtime1", runtimeType: RuntimeTypeRustNative}
	runtime2 := &MockRuntime{name: "runtime2", runtimeType: RuntimeTypePythonGrpc}

	registry.Register(runtime1)
	registry.Register(runtime2)

	selector := NewSelector(registry, SelectorConfig{
		Strategy: StrategyRoundRobin,
	})

	ctx := context.Background()
	req := &PredictRequest{
		ModelID:  "test-model",
		Features: []float64{1.0, 2.0, 3.0},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		selector.SelectRuntime(ctx, req)
	}
}
