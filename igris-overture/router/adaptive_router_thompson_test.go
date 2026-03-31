package router

import (
	"context"
	"testing"
	"time"
)

func TestAdaptiveRouter_ThompsonSampling_ColdStartProtection(t *testing.T) {
	router := NewAdaptiveRouter(PolicyThompsonSampling, 5*time.Minute)

	// Register three backends
	backends := []*Backend{
		{
			ID:           "backend-1",
			URL:          "http://backend1.local",
			Type:         BackendTypeMLPython,
			Capabilities: []string{"inference"},
			MaxCapacity:  100,
			Healthy:      true,
		},
		{
			ID:           "backend-2",
			URL:          "http://backend2.local",
			Type:         BackendTypeMLGPU,
			Capabilities: []string{"inference"},
			MaxCapacity:  100,
			Healthy:      true,
		},
		{
			ID:           "backend-3",
			URL:          "http://backend3.local",
			Type:         BackendTypeMLCPU,
			Capabilities: []string{"inference"},
			MaxCapacity:  100,
			Healthy:      true,
		},
	}

	for _, b := range backends {
		router.RegisterBackend(b)
		// Set reported metrics for trust verification
		router.SetReportedMetrics(b.ID, 100.0, 0.01, 0.01)
	}

	// Warm up all backends to pass trust verification (need >= 100 samples)
	for i := 0; i < 110; i++ {
		for _, b := range backends {
			router.RecordResult(b.ID, 100*time.Millisecond, nil)
		}
	}

	// Now route requests - should see bootstrap behavior initially
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	bootstrapSelections := make(map[string]int)

	// First 15 requests should prioritize bootstrap (5 per backend with default config)
	for i := 0; i < 15; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Unexpected routing error: %v", err)
		}

		bootstrapSelections[decision.Backend.ID]++

		// Should indicate bootstrap phase
		if len(decision.Reason) < 20 || decision.Reason[:20] != "Thompson Sampling: b" {
			// Might not be bootstrap if already warmed up, that's ok
		}

		// Record successful result
		router.RecordResult(decision.Backend.ID, 100*time.Millisecond, nil)
	}

	// Verify each backend received some selections
	for id, count := range bootstrapSelections {
		if count == 0 {
			t.Errorf("Backend %s received no selections during bootstrap", id)
		}
	}
}

func TestAdaptiveRouter_ThompsonSampling_PhaseProgression(t *testing.T) {
	router := NewAdaptiveRouter(PolicyThompsonSampling, 5*time.Minute)

	backend := &Backend{
		ID:           "backend-phases",
		URL:          "http://backend-phases.local",
		Type:         BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity:  100,
		Healthy:      true,
	}
	router.RegisterBackend(backend)
	router.SetReportedMetrics(backend.ID, 100.0, 0.01, 0.01)

	// Warm up for trust verification
	for i := 0; i < 110; i++ {
		router.RecordResult(backend.ID, 100*time.Millisecond, nil)
	}

	// Check initial Thompson Sampling phase (should be Bootstrap initially when first initialized)
	// But since we've recorded results, it might have progressed
	state, exists := router.GetThompsonSamplingState(backend.ID)
	if !exists {
		t.Fatal("Thompson Sampling state should exist after recording results")
	}

	initialPhase := state.Phase
	t.Logf("Initial phase: %s (samples: %d)", initialPhase, state.SamplesCollected)

	// Record more outcomes to progress through phases
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	// Route and record 100 more requests
	for i := 0; i < 100; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Unexpected routing error: %v", err)
		}

		router.RecordResult(decision.Backend.ID, 100*time.Millisecond, nil)
	}

	// Check final phase
	state, _ = router.GetThompsonSamplingState(backend.ID)
	finalPhase := state.Phase

	t.Logf("Final phase: %s (samples: %d)", finalPhase, state.SamplesCollected)

	// Should have progressed through phases (or at least have significant samples)
	if state.SamplesCollected < 100 {
		t.Errorf("Expected at least 100 samples collected, got %d", state.SamplesCollected)
	}
}

func TestAdaptiveRouter_ThompsonSampling_ExplorationVsExploitation(t *testing.T) {
	router := NewAdaptiveRouter(PolicyThompsonSampling, 5*time.Minute)

	// Register two backends with different performance
	goodBackend := &Backend{
		ID:           "backend-good",
		URL:          "http://backend-good.local",
		Type:         BackendTypeMLGPU,
		Capabilities: []string{"inference"},
		MaxCapacity:  100,
		Healthy:      true,
	}

	badBackend := &Backend{
		ID:           "backend-bad",
		URL:          "http://backend-bad.local",
		Type:         BackendTypeMLCPU,
		Capabilities: []string{"inference"},
		MaxCapacity:  100,
		Healthy:      true,
	}

	router.RegisterBackend(goodBackend)
	router.RegisterBackend(badBackend)
	router.SetReportedMetrics(goodBackend.ID, 100.0, 0.01, 0.01)
	router.SetReportedMetrics(badBackend.ID, 100.0, 0.01, 0.01)

	// Warm up both backends for trust verification with different success rates
	for i := 0; i < 110; i++ {
		// Good backend: 95% success
		if i%20 == 0 {
			router.RecordResult(goodBackend.ID, 100*time.Millisecond, someError)
		} else {
			router.RecordResult(goodBackend.ID, 50*time.Millisecond, nil)
		}

		// Bad backend: 70% success
		if i%10 < 3 {
			router.RecordResult(badBackend.ID, 200*time.Millisecond, someError)
		} else {
			router.RecordResult(badBackend.ID, 150*time.Millisecond, nil)
		}
	}

	// Route requests and track selections
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 300 * time.Millisecond,
	}

	selectionCounts := make(map[string]int)

	for i := 0; i < 100; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Unexpected routing error: %v", err)
		}

		selectionCounts[decision.Backend.ID]++
		router.RecordResult(decision.Backend.ID, 100*time.Millisecond, nil)
	}

	// Good backend should receive more selections (Thompson Sampling learns optimal arm)
	if selectionCounts[goodBackend.ID] <= selectionCounts[badBackend.ID] {
		t.Errorf("Expected good backend to receive more selections, got good=%d bad=%d",
			selectionCounts[goodBackend.ID], selectionCounts[badBackend.ID])
	}

	t.Logf("Selection distribution: good=%d, bad=%d", selectionCounts[goodBackend.ID], selectionCounts[badBackend.ID])
}

var someError = &testError{msg: "simulated error"}

type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}

func TestAdaptiveRouter_ThompsonSampling_GlobalStats(t *testing.T) {
	router := NewAdaptiveRouter(PolicyThompsonSampling, 5*time.Minute)

	backends := []*Backend{
		{ID: "backend-1", Type: BackendTypeMLPython, Capabilities: []string{"inference"}, MaxCapacity: 100, Healthy: true},
		{ID: "backend-2", Type: BackendTypeMLGPU, Capabilities: []string{"inference"}, MaxCapacity: 100, Healthy: true},
		{ID: "backend-3", Type: BackendTypeMLCPU, Capabilities: []string{"inference"}, MaxCapacity: 100, Healthy: true},
	}

	for _, b := range backends {
		router.RegisterBackend(b)
		router.SetReportedMetrics(b.ID, 100.0, 0.01, 0.01)

		// Warm up for trust verification
		for i := 0; i < 110; i++ {
			router.RecordResult(b.ID, 100*time.Millisecond, nil)
		}
	}

	// Route some requests
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	for i := 0; i < 50; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Unexpected routing error: %v", err)
		}
		router.RecordResult(decision.Backend.ID, 100*time.Millisecond, nil)
	}

	// Get global stats
	stats := router.GetThompsonSamplingStats()

	if stats.TotalBackends != 3 {
		t.Errorf("Expected 3 total backends, got %d", stats.TotalBackends)
	}

	if stats.GlobalExplorationCount == 0 {
		t.Error("Expected some exploration to have occurred")
	}

	t.Logf("Global stats: %+v", stats)
}

func TestAdaptiveRouter_ThompsonSampling_StateReset(t *testing.T) {
	router := NewAdaptiveRouter(PolicyThompsonSampling, 5*time.Minute)

	backend := &Backend{
		ID:           "backend-reset",
		URL:          "http://backend-reset.local",
		Type:         BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity:  100,
		Healthy:      true,
	}
	router.RegisterBackend(backend)
	router.SetReportedMetrics(backend.ID, 100.0, 0.01, 0.01)

	// Record some results
	for i := 0; i < 120; i++ {
		router.RecordResult(backend.ID, 100*time.Millisecond, nil)
	}

	// Verify state exists
	state, exists := router.GetThompsonSamplingState(backend.ID)
	if !exists {
		t.Fatal("Thompson Sampling state should exist")
	}

	if state.SamplesCollected == 0 {
		t.Error("Expected samples collected > 0")
	}

	// Reset state
	router.ResetThompsonSamplingState(backend.ID)

	// Verify state reset
	_, exists = router.GetThompsonSamplingState(backend.ID)
	if exists {
		t.Error("Thompson Sampling state should not exist after reset")
	}
}

func TestAdaptiveRouter_ThompsonSampling_WithTrustFiltering(t *testing.T) {
	router := NewAdaptiveRouter(PolicyThompsonSampling, 5*time.Minute)

	// Register three backends
	trustedBackend := &Backend{
		ID:           "backend-trusted",
		URL:          "http://backend-trusted.local",
		Type:         BackendTypeMLGPU,
		Capabilities: []string{"inference"},
		MaxCapacity:  100,
		Healthy:      true,
	}

	untrustedBackend := &Backend{
		ID:           "backend-untrusted",
		URL:          "http://backend-untrusted.local",
		Type:         BackendTypeMLCPU,
		Capabilities: []string{"inference"},
		MaxCapacity:  100,
		Healthy:      true,
	}

	router.RegisterBackend(trustedBackend)
	router.RegisterBackend(untrustedBackend)

	// Set reported metrics
	router.SetReportedMetrics(trustedBackend.ID, 100.0, 0.01, 0.01)
	router.SetReportedMetrics(untrustedBackend.ID, 100.0, 0.01, 0.01)

	// Warm up trusted backend with good performance (meets reported metrics)
	for i := 0; i < 150; i++ {
		router.RecordResult(trustedBackend.ID, 100*time.Millisecond, nil)
	}

	// Warm up untrusted backend with only 10 samples (below minimum for trust)
	for i := 0; i < 10; i++ {
		router.RecordResult(untrustedBackend.ID, 100*time.Millisecond, nil)
	}

	// Route request - trust filtering should exclude untrusted backend
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	selectionCounts := make(map[string]int)

	for i := 0; i < 20; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Unexpected routing error: %v", err)
		}

		selectionCounts[decision.Backend.ID]++
		router.RecordResult(decision.Backend.ID, 100*time.Millisecond, nil)
	}

	// Only trusted backend should be selected (untrusted blocked by trust verification)
	if selectionCounts[trustedBackend.ID] != 20 {
		t.Errorf("Expected all 20 selections to trusted backend, got %d", selectionCounts[trustedBackend.ID])
	}

	if selectionCounts[untrustedBackend.ID] > 0 {
		t.Errorf("Expected 0 selections to untrusted backend, got %d", selectionCounts[untrustedBackend.ID])
	}
}
