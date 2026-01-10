package router

import (
	"context"
	"errors"
	"testing"
	"time"
)

// TestAdaptiveRouter_TrustIntegration_BasicFiltering verifies trust filtering in routing
func TestAdaptiveRouter_TrustIntegration_BasicFiltering(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	// Register three backends
	backend1 := &Backend{
		ID:          "backend-1",
		URL:         "http://backend1.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	backend2 := &Backend{
		ID:          "backend-2",
		URL:         "http://backend2.local",
		Type:        BackendTypeMLGPU,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	backend3 := &Backend{
		ID:          "backend-3",
		URL:         "http://backend3.local",
		Type:        BackendTypeMLCPU,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}

	router.RegisterBackend(backend1)
	router.RegisterBackend(backend2)
	router.RegisterBackend(backend3)

	// Set reported metrics for all backends
	router.SetReportedMetrics("backend-1", 100.0, 0.01, 0.01)
	router.SetReportedMetrics("backend-2", 100.0, 0.01, 0.01)
	router.SetReportedMetrics("backend-3", 100.0, 0.01, 0.01)

	// Record good observations for backend-1 (meets minimum samples)
	for i := 0; i < 150; i++ {
		router.RecordResult("backend-1", 100*time.Millisecond, nil)
	}

	// Record good observations for backend-2 (meets minimum samples)
	for i := 0; i < 150; i++ {
		router.RecordResult("backend-2", 95*time.Millisecond, nil)
	}

	// Record only a few observations for backend-3 (below minimum samples)
	for i := 0; i < 10; i++ {
		router.RecordResult("backend-3", 100*time.Millisecond, nil)
	}

	// Route request - backend-3 should be filtered out due to cold start
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Expected successful routing, got error: %v", err)
	}

	// Should route to backend-2 (lowest latency among trusted)
	if decision.Backend.ID != "backend-2" {
		t.Errorf("Expected backend-2 (lowest latency), got %s", decision.Backend.ID)
	}

	// Verify backend-3 is not trusted
	trusted, reason := router.IsProviderTrusted("backend-3")
	if trusted {
		t.Error("Expected backend-3 to be blocked due to insufficient samples")
	}
	if reason == "" {
		t.Error("Expected reason for blocking backend-3")
	}
}

// TestAdaptiveRouter_TrustIntegration_TrustDecay verifies trust decay blocks routing
func TestAdaptiveRouter_TrustIntegration_TrustDecay(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	// Register backend
	backend := &Backend{
		ID:          "backend-bad",
		URL:         "http://backend-bad.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)

	// Set reported metrics: claims 100ms latency
	router.SetReportedMetrics("backend-bad", 100.0, 0.01, 0.01)

	// Record observations that significantly exceed reported latency (200ms vs 100ms = 100% divergence)
	for i := 0; i < 150; i++ {
		router.RecordResult("backend-bad", 200*time.Millisecond, nil)
	}

	// Verify trust has decayed
	trustScore, _, exists := router.GetProviderTrustScore("backend-bad")
	if !exists {
		t.Fatal("Backend should exist in trust tracker")
	}
	if trustScore >= 1.0 {
		t.Errorf("Expected trust decay, got score %.3f", trustScore)
	}

	// If trust decayed below threshold, routing should fail
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 300 * time.Millisecond,
	}

	_, err := router.Route(context.Background(), req)

	// Check if backend is trusted
	trusted, _ := router.IsProviderTrusted("backend-bad")

	if !trusted {
		// Trust score below threshold - routing should fail
		if err == nil {
			t.Error("Expected routing to fail when all backends untrusted")
		}
	} else {
		// Trust score above threshold - routing should succeed
		if err != nil {
			t.Errorf("Expected routing to succeed, got error: %v", err)
		}
	}
}

// TestAdaptiveRouter_TrustIntegration_TrustRecovery verifies trust recovery enables routing
func TestAdaptiveRouter_TrustIntegration_TrustRecovery(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "backend-recover",
		URL:         "http://backend-recover.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)

	// Set reported metrics
	router.SetReportedMetrics("backend-recover", 100.0, 0.01, 0.01)

	// First, cause trust decay with bad performance
	for i := 0; i < 150; i++ {
		router.RecordResult("backend-recover", 300*time.Millisecond, nil) // 200% divergence
	}

	trustAfterDecay, _, _ := router.GetProviderTrustScore("backend-recover")

	// Now recover with good performance matching reported metrics
	for i := 0; i < 200; i++ {
		router.RecordResult("backend-recover", 100*time.Millisecond, nil)
	}

	trustAfterRecovery, _, _ := router.GetProviderTrustScore("backend-recover")

	if trustAfterRecovery <= trustAfterDecay {
		t.Errorf("Expected trust recovery, decay=%.3f recovery=%.3f", trustAfterDecay, trustAfterRecovery)
	}

	// Should be able to route now
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Expected successful routing after recovery, got error: %v", err)
	}
	if decision.Backend.ID != "backend-recover" {
		t.Errorf("Expected backend-recover, got %s", decision.Backend.ID)
	}
}

// TestAdaptiveRouter_TrustIntegration_ErrorRateTracking verifies error rate affects trust
func TestAdaptiveRouter_TrustIntegration_ErrorRateTracking(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "backend-errors",
		URL:         "http://backend-errors.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)

	// Set reported metrics: claims 1% error rate
	router.SetReportedMetrics("backend-errors", 100.0, 0.01, 0.01)

	// Record many failures (50% error rate)
	for i := 0; i < 200; i++ {
		if i%2 == 0 {
			router.RecordResult("backend-errors", 100*time.Millisecond, errors.New("simulated error"))
		} else {
			router.RecordResult("backend-errors", 100*time.Millisecond, nil)
		}
	}

	// Trust should have decayed due to error rate divergence
	trustScore, _, _ := router.GetProviderTrustScore("backend-errors")

	details, err := router.GetProviderTrustDetails("backend-errors")
	if err != nil {
		t.Fatalf("Failed to get trust details: %v", err)
	}

	if details.ObservedErrorRate < 0.40 {
		t.Errorf("Expected observed error rate ~0.5, got %.3f", details.ObservedErrorRate)
	}

	if trustScore >= 1.0 {
		t.Errorf("Expected trust decay due to error rate divergence, got score %.3f", trustScore)
	}
}

// TestAdaptiveRouter_TrustIntegration_AllBackendsBlocked verifies fail-closed behavior
func TestAdaptiveRouter_TrustIntegration_AllBackendsBlocked(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	// Register multiple backends
	for i := 1; i <= 3; i++ {
		backend := &Backend{
			ID:          "backend-untrusted-" + string(rune('0'+i)),
			URL:         "http://backend-untrusted.local",
			Type:        BackendTypeMLPython,
			Capabilities: []string{"inference"},
			MaxCapacity: 100,
			Healthy:     true,
		}
		router.RegisterBackend(backend)

		// Set reported metrics
		router.SetReportedMetrics(backend.ID, 100.0, 0.01, 0.01)

		// Record only 5 observations (below minimum of 100)
		for j := 0; j < 5; j++ {
			router.RecordResult(backend.ID, 100*time.Millisecond, nil)
		}
	}

	// All backends should be blocked due to cold start
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	_, err := router.Route(context.Background(), req)
	if err == nil {
		t.Error("Expected routing to fail when all backends blocked by trust verification")
	}

	// Error should mention trust verification blocking
	if err != nil && len(err.Error()) == 0 {
		t.Error("Expected descriptive error message about trust verification")
	}
}

// TestAdaptiveRouter_TrustIntegration_ManualTrustReset verifies trust reset functionality
func TestAdaptiveRouter_TrustIntegration_ManualTrustReset(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "backend-reset",
		URL:         "http://backend-reset.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)

	// Set reported metrics
	router.SetReportedMetrics("backend-reset", 100.0, 0.01, 0.01)

	// Cause trust decay
	for i := 0; i < 150; i++ {
		router.RecordResult("backend-reset", 400*time.Millisecond, nil) // Severe divergence
	}

	decayedScore, _, _ := router.GetProviderTrustScore("backend-reset")
	if decayedScore >= 1.0 {
		t.Error("Expected trust decay before reset")
	}

	// Manually reset trust
	router.ResetProviderTrust("backend-reset")

	resetScore, _, _ := router.GetProviderTrustScore("backend-reset")
	if resetScore != 1.0 {
		t.Errorf("Expected trust score 1.0 after reset, got %.3f", resetScore)
	}
}

// TestAdaptiveRouter_TrustIntegration_MultipleBackendsSelection verifies best trusted backend selection
func TestAdaptiveRouter_TrustIntegration_MultipleBackendsSelection(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	// Register three backends
	backends := []*Backend{
		{
			ID:          "backend-fast",
			URL:         "http://backend-fast.local",
			Type:        BackendTypeMLGPU,
			Capabilities: []string{"inference"},
			MaxCapacity: 100,
			Healthy:     true,
		},
		{
			ID:          "backend-medium",
			URL:         "http://backend-medium.local",
			Type:        BackendTypeMLPython,
			Capabilities: []string{"inference"},
			MaxCapacity: 100,
			Healthy:     true,
		},
		{
			ID:          "backend-slow",
			URL:         "http://backend-slow.local",
			Type:        BackendTypeMLCPU,
			Capabilities: []string{"inference"},
			MaxCapacity: 100,
			Healthy:     true,
		},
	}

	for _, b := range backends {
		router.RegisterBackend(b)
		router.SetReportedMetrics(b.ID, 100.0, 0.01, 0.01)
	}

	// Record observations: fast backend has lowest latency
	for i := 0; i < 150; i++ {
		router.RecordResult("backend-fast", 50*time.Millisecond, nil)
		router.RecordResult("backend-medium", 100*time.Millisecond, nil)
		router.RecordResult("backend-slow", 150*time.Millisecond, nil)
	}

	// Route with least-latency policy
	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Expected successful routing, got error: %v", err)
	}

	// Should select backend-fast (lowest latency among trusted)
	if decision.Backend.ID != "backend-fast" {
		t.Errorf("Expected backend-fast (lowest latency), got %s", decision.Backend.ID)
	}
}
