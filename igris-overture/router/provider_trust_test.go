package router

import (
	"testing"
	"time"
)

func TestProviderTrustTracker_BasicObservation(t *testing.T) {
	config := DefaultTrustConfig()
	tracker := NewProviderTrustTracker(config)

	// Record successful observation
	tracker.RecordObservation("provider-1", 100.0, false, 0.01)

	// Verify trust score and confidence
	trustScore, confidence, exists := tracker.GetTrustScore("provider-1")
	if !exists {
		t.Fatal("Provider should exist after recording observation")
	}

	if trustScore != 1.0 {
		t.Errorf("Expected initial trust score 1.0, got %.3f", trustScore)
	}

	if confidence <= 0.0 {
		t.Errorf("Expected confidence > 0 after observation, got %.3f", confidence)
	}
}

func TestProviderTrustTracker_TrustDecayOnDivergence(t *testing.T) {
	config := DefaultTrustConfig()
	config.MaxLatencyDivergence = 0.50 // 50% max divergence
	tracker := NewProviderTrustTracker(config)

	// Set reported metrics
	tracker.SetReportedMetrics("provider-1", 100.0, 0.01, 0.01)

	// Record observations that significantly exceed reported latency
	for i := 0; i < 10; i++ {
		// Observed latency is 200ms (100% worse than reported 100ms)
		tracker.RecordObservation("provider-1", 200.0, false, 0.01)
	}

	// Trust should have decayed due to latency divergence
	trustScore, _, _ := tracker.GetTrustScore("provider-1")
	if trustScore >= 1.0 {
		t.Errorf("Expected trust decay due to latency divergence, got score %.3f", trustScore)
	}

	// Verify divergence is tracked
	details, err := tracker.GetProviderTrustDetails("provider-1")
	if err != nil {
		t.Fatalf("Failed to get trust details: %v", err)
	}

	if details.LatencyDivergence <= 0.5 {
		t.Errorf("Expected latency divergence > 0.5, got %.3f", details.LatencyDivergence)
	}
}

func TestProviderTrustTracker_TrustRecovery(t *testing.T) {
	config := DefaultTrustConfig()
	config.MaxLatencyDivergence = 0.50
	config.TrustDecayRate = 0.10
	config.TrustRecoveryRate = 0.05
	tracker := NewProviderTrustTracker(config)

	// Set reported metrics
	tracker.SetReportedMetrics("provider-1", 100.0, 0.01, 0.01)

	// First, cause trust decay with bad performance
	for i := 0; i < 10; i++ {
		tracker.RecordObservation("provider-1", 200.0, false, 0.01) // Exceeds divergence threshold
	}

	trustAfterDecay, _, _ := tracker.GetTrustScore("provider-1")

	// Now recover with good performance
	for i := 0; i < 50; i++ {
		tracker.RecordObservation("provider-1", 100.0, false, 0.01) // Matches reported metrics
	}

	trustAfterRecovery, _, _ := tracker.GetTrustScore("provider-1")

	if trustAfterRecovery <= trustAfterDecay {
		t.Errorf("Expected trust recovery, decay=%.3f recovery=%.3f", trustAfterDecay, trustAfterRecovery)
	}
}

func TestProviderTrustTracker_ErrorRateDivergence(t *testing.T) {
	config := DefaultTrustConfig()
	config.MaxErrorRateDiverge = 0.20 // 20% max divergence
	tracker := NewProviderTrustTracker(config)

	// Set reported error rate at 1%
	tracker.SetReportedMetrics("provider-1", 100.0, 0.01, 0.01)

	// Record many failures (actual error rate will be ~50%)
	for i := 0; i < 100; i++ {
		failed := i%2 == 0 // 50% failure rate
		tracker.RecordObservation("provider-1", 100.0, failed, 0.01)
	}

	// Trust should have decayed due to error rate divergence
	trustScore, _, _ := tracker.GetTrustScore("provider-1")
	if trustScore >= 1.0 {
		t.Errorf("Expected trust decay due to error rate divergence, got score %.3f", trustScore)
	}

	details, _ := tracker.GetProviderTrustDetails("provider-1")
	if details.ObservedErrorRate < 0.40 {
		t.Errorf("Expected observed error rate ~0.5, got %.3f", details.ObservedErrorRate)
	}
}

func TestProviderTrustTracker_CostDivergence(t *testing.T) {
	config := DefaultTrustConfig()
	config.MaxCostDivergence = 0.30 // 30% max divergence
	tracker := NewProviderTrustTracker(config)

	// Set reported cost at $0.01 per 1K tokens
	tracker.SetReportedMetrics("provider-1", 100.0, 0.01, 0.01)

	// Record observations with higher actual cost ($0.015 = 50% more expensive)
	for i := 0; i < 20; i++ {
		tracker.RecordObservation("provider-1", 100.0, false, 0.015)
	}

	// Trust should have decayed due to cost divergence
	trustScore, _, _ := tracker.GetTrustScore("provider-1")
	if trustScore >= 1.0 {
		t.Errorf("Expected trust decay due to cost divergence, got score %.3f", trustScore)
	}

	details, _ := tracker.GetProviderTrustDetails("provider-1")
	if details.CostDivergence <= 0.30 {
		t.Errorf("Expected cost divergence > 0.30, got %.3f", details.CostDivergence)
	}
}

func TestProviderTrustTracker_FailClosedUnknownProvider(t *testing.T) {
	config := DefaultTrustConfig()
	tracker := NewProviderTrustTracker(config)

	// Unknown provider should be blocked (fail-closed)
	trusted, reason := tracker.IsProviderTrusted("unknown-provider")
	if trusted {
		t.Error("Expected unknown provider to be blocked (fail-closed)")
	}
	if reason == "" {
		t.Error("Expected reason for blocking unknown provider")
	}
}

func TestProviderTrustTracker_FailClosedColdStart(t *testing.T) {
	config := DefaultTrustConfig()
	config.MinSamplesForTrust = 100
	config.BlockWithoutMinSamples = true
	tracker := NewProviderTrustTracker(config)

	// Record only a few observations (below minimum)
	for i := 0; i < 10; i++ {
		tracker.RecordObservation("provider-1", 100.0, false, 0.01)
	}

	// Provider should be blocked due to insufficient samples
	trusted, reason := tracker.IsProviderTrusted("provider-1")
	if trusted {
		t.Error("Expected cold-start provider to be blocked")
	}
	if reason == "" {
		t.Error("Expected reason for blocking cold-start provider")
	}

	// After enough samples, should be trusted
	for i := 0; i < 100; i++ {
		tracker.RecordObservation("provider-1", 100.0, false, 0.01)
	}

	trusted, _ = tracker.IsProviderTrusted("provider-1")
	if !trusted {
		t.Error("Expected provider to be trusted after minimum samples")
	}
}

func TestProviderTrustTracker_FailClosedBelowThreshold(t *testing.T) {
	config := DefaultTrustConfig()
	config.BlockBelowTrustScore = 0.30
	config.TrustDecayRate = 0.50 // Aggressive decay
	config.MaxLatencyDivergence = 0.10
	tracker := NewProviderTrustTracker(config)

	// Set reported metrics
	tracker.SetReportedMetrics("provider-1", 100.0, 0.01, 0.01)

	// Cause severe trust decay
	for i := 0; i < 10; i++ {
		tracker.RecordObservation("provider-1", 300.0, false, 0.01) // 200% divergence
	}

	// Provider should be blocked due to low trust
	trusted, reason := tracker.IsProviderTrusted("provider-1")
	if trusted {
		t.Error("Expected low-trust provider to be blocked")
	}
	if reason == "" {
		t.Error("Expected reason for blocking low-trust provider")
	}

	trustScore, _, _ := tracker.GetTrustScore("provider-1")
	if trustScore >= config.BlockBelowTrustScore {
		t.Errorf("Expected trust score < %.3f, got %.3f", config.BlockBelowTrustScore, trustScore)
	}
}

func TestProviderTrustTracker_FilterTrustedProviders(t *testing.T) {
	config := DefaultTrustConfig()
	config.MinSamplesForTrust = 10
	config.BlockBelowTrustScore = 0.30
	config.MaxLatencyDivergence = 0.50
	tracker := NewProviderTrustTracker(config)

	// Setup provider-1: good provider
	tracker.SetReportedMetrics("provider-1", 100.0, 0.01, 0.01)
	for i := 0; i < 20; i++ {
		tracker.RecordObservation("provider-1", 100.0, false, 0.01)
	}

	// Setup provider-2: bad provider (high latency divergence)
	tracker.SetReportedMetrics("provider-2", 100.0, 0.01, 0.01)
	for i := 0; i < 20; i++ {
		tracker.RecordObservation("provider-2", 300.0, false, 0.01) // 200% divergence
	}

	// Setup provider-3: cold start (insufficient samples)
	tracker.SetReportedMetrics("provider-3", 100.0, 0.01, 0.01)
	tracker.RecordObservation("provider-3", 100.0, false, 0.01) // Only 1 sample

	// Filter providers
	allProviders := []string{"provider-1", "provider-2", "provider-3", "unknown"}
	trusted, blocked := tracker.FilterTrustedProviders(allProviders)

	// Verify filtering
	if len(trusted) != 1 {
		t.Errorf("Expected 1 trusted provider, got %d: %v", len(trusted), trusted)
	}
	if trusted[0] != "provider-1" {
		t.Errorf("Expected provider-1 to be trusted, got %s", trusted[0])
	}

	if len(blocked) != 3 {
		t.Errorf("Expected 3 blocked providers, got %d: %v", len(blocked), blocked)
	}
}

func TestProviderTrustTracker_ConfidenceGrowth(t *testing.T) {
	config := DefaultTrustConfig()
	config.ConfidenceGrowthRate = 0.10 // 10% per sample
	config.MaxConfidence = 1.0
	tracker := NewProviderTrustTracker(config)

	// Record observations and track confidence growth
	for i := 0; i < 15; i++ {
		tracker.RecordObservation("provider-1", 100.0, false, 0.01)

		_, confidence, _ := tracker.GetTrustScore("provider-1")
		expectedConfidence := float64(i+1) * config.ConfidenceGrowthRate
		if expectedConfidence > config.MaxConfidence {
			expectedConfidence = config.MaxConfidence
		}

		if confidence < expectedConfidence-0.01 || confidence > expectedConfidence+0.01 {
			t.Errorf("Sample %d: expected confidence ~%.3f, got %.3f", i+1, expectedConfidence, confidence)
		}
	}

	// Confidence should cap at MaxConfidence
	_, finalConfidence, _ := tracker.GetTrustScore("provider-1")
	if finalConfidence > config.MaxConfidence {
		t.Errorf("Confidence exceeded max: %.3f > %.3f", finalConfidence, config.MaxConfidence)
	}
}

func TestProviderTrustTracker_ConsecutiveFailures(t *testing.T) {
	config := DefaultTrustConfig()
	tracker := NewProviderTrustTracker(config)

	// Record consecutive failures
	for i := 0; i < 5; i++ {
		tracker.RecordObservation("provider-1", 100.0, true, 0.01)
	}

	details, _ := tracker.GetProviderTrustDetails("provider-1")
	if details.ConsecutiveFails != 5 {
		t.Errorf("Expected 5 consecutive fails, got %d", details.ConsecutiveFails)
	}

	// Record success to reset counter
	tracker.RecordObservation("provider-1", 100.0, false, 0.01)

	details, _ = tracker.GetProviderTrustDetails("provider-1")
	if details.ConsecutiveFails != 0 {
		t.Errorf("Expected consecutive fails to reset to 0, got %d", details.ConsecutiveFails)
	}
}

func TestProviderTrustTracker_TimeBasedDecay(t *testing.T) {
	config := DefaultTrustConfig()
	config.TrustDecayInterval = 1 * time.Second // Short interval for testing
	config.TimeBasedDecayRate = 0.10            // 10% decay per interval
	tracker := NewProviderTrustTracker(config)

	// Record initial observations
	tracker.RecordObservation("provider-1", 100.0, false, 0.01)

	initialScore, _, _ := tracker.GetTrustScore("provider-1")

	// Wait for decay interval
	time.Sleep(1100 * time.Millisecond)

	// Record new observation to trigger time-based decay check
	tracker.RecordObservation("provider-1", 100.0, false, 0.01)

	afterDecayScore, _, _ := tracker.GetTrustScore("provider-1")

	// Trust should have decayed due to time passage
	if afterDecayScore >= initialScore {
		t.Errorf("Expected time-based trust decay, initial=%.3f after=%.3f", initialScore, afterDecayScore)
	}
}

func TestProviderTrustTracker_ResetProviderTrust(t *testing.T) {
	config := DefaultTrustConfig()
	config.MaxLatencyDivergence = 0.10
	tracker := NewProviderTrustTracker(config)

	// Setup provider with decayed trust
	tracker.SetReportedMetrics("provider-1", 100.0, 0.01, 0.01)
	for i := 0; i < 10; i++ {
		tracker.RecordObservation("provider-1", 300.0, false, 0.01) // Cause decay
	}

	decayedScore, _, _ := tracker.GetTrustScore("provider-1")
	if decayedScore >= 1.0 {
		t.Error("Expected trust decay before reset")
	}

	// Reset trust
	tracker.ResetProviderTrust("provider-1")

	resetScore, _, _ := tracker.GetTrustScore("provider-1")
	if resetScore != 1.0 {
		t.Errorf("Expected trust score 1.0 after reset, got %.3f", resetScore)
	}

	// Verify observed metrics are preserved
	details, _ := tracker.GetProviderTrustDetails("provider-1")
	if details.ObservedLatencyMs == 0 {
		t.Error("Expected observed metrics to be preserved after reset")
	}
}

func TestProviderTrustTracker_ZeroDivisionProtection(t *testing.T) {
	config := DefaultTrustConfig()
	tracker := NewProviderTrustTracker(config)

	// Set reported error rate to 0
	tracker.SetReportedMetrics("provider-1", 100.0, 0.0, 0.01)

	// Record observations with some errors
	tracker.RecordObservation("provider-1", 100.0, true, 0.01)
	tracker.RecordObservation("provider-1", 100.0, false, 0.01)

	// Should not panic or produce NaN
	details, err := tracker.GetProviderTrustDetails("provider-1")
	if err != nil {
		t.Fatalf("Failed to get details: %v", err)
	}

	// Error rate divergence should be calculated safely (using epsilon)
	if details.ErrorRateDiverge < 0 {
		t.Errorf("ErrorRateDiverge should not be negative: %.3f", details.ErrorRateDiverge)
	}
}
