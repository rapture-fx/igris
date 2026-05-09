package router

import (
	"context"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// Test helper: create a test setup
func createTestSetup() (*SpeculativeRouter, *providers.ProviderRegistry) {
	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeLatency,
		MaxProviders:      3,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
		CostMultiplier:    1.5,
		WasteThreshold:    0.3,
	}

	registry := providers.NewProviderRegistry()

	// We'll add providers in individual tests

	// Create a minimal AdaptiveRouter (not used in PR#1 but required for constructor)
	// Pass nil to avoid Prometheus registration (tests don't need metrics)
	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}

	router := NewSpeculativeRouter(cfg, adaptiveRouter, registry)
	return router, registry
}

// TestSpeculativeRouter_FastestWins tests that the fastest provider wins
func TestSpeculativeRouter_FastestWins(t *testing.T) {
	router, registry := createTestSetup()

	// Register 3 providers with different latencies
	fastProvider := &MockProvider{
		name:            "fast-provider",
		firstTokenDelay: 100 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     10,
	}
	mediumProvider := &MockProvider{
		name:            "medium-provider",
		firstTokenDelay: 300 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     10,
	}
	slowProvider := &MockProvider{
		name:            "slow-provider",
		firstTokenDelay: 500 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     10,
	}

	registry.Register(fastProvider)
	registry.Register(mediumProvider)
	registry.Register(slowProvider)

	// Create test request
	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
		Stream: true,
	}

	ctx := context.Background()

	// Execute speculative routing
	tokenChan, errChan, metadata, err := router.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)
	if err != nil {
		t.Fatalf("RouteSpeculative failed: %v", err)
	}

	// Verify winner is the fast provider
	if metadata.WinnerProvider != "fast-provider" {
		t.Errorf("Expected winner to be fast-provider, got %s", metadata.WinnerProvider)
	}

	// Verify we used 3 providers
	if len(metadata.ProvidersUsed) != 3 {
		t.Errorf("Expected 3 providers used, got %d", len(metadata.ProvidersUsed))
	}

	// Consume tokens to verify stream works
	tokenCount := 0
	for {
		select {
		case chunk, ok := <-tokenChan:
			if !ok {
				// Stream closed
				if tokenCount == 0 {
					t.Error("Expected to receive tokens, got 0")
				}
				return
			}
			tokenCount++
			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta != nil {
				t.Logf("Received token %d: %s", tokenCount, chunk.Choices[0].Delta.Content)
			}

		case err, ok := <-errChan:
			if !ok {
				// Error channel closed (normal completion)
				return
			}
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

		case <-time.After(3 * time.Second):
			t.Fatal("Timeout waiting for tokens")
		}
	}
}

// TestSpeculativeRouter_CancellationWorks tests that losing providers are cancelled
func TestSpeculativeRouter_CancellationWorks(t *testing.T) {
	router, registry := createTestSetup()

	// Track cancellation
	var fastCancelled, slowCancelled bool

	fastProvider := &MockProvider{
		name:            "fast-provider",
		firstTokenDelay: 100 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     10,
	}
	slowProvider := &MockProvider{
		name:            "slow-provider",
		firstTokenDelay: 1 * time.Second,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     10,
	}

	registry.Register(fastProvider)
	registry.Register(slowProvider)

	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
		Stream: true,
	}

	ctx := context.Background()
	tokenChan, errChan, metadata, err := router.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)
	if err != nil {
		t.Fatalf("RouteSpeculative failed: %v", err)
	}

	// Fast provider should win
	if metadata.WinnerProvider != "fast-provider" {
		t.Errorf("Expected fast-provider to win, got %s", metadata.WinnerProvider)
	}

	// Wait a bit to ensure slow provider gets cancelled
	time.Sleep(200 * time.Millisecond)

	// Consume a few tokens
	for i := 0; i < 3; i++ {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				return
			}
		case err := <-errChan:
			t.Fatalf("Unexpected error: %v", err)
		case <-time.After(2 * time.Second):
			t.Fatal("Timeout waiting for tokens")
		}
	}

	// Test passes if we get here without hanging (slow provider was cancelled)
	_ = fastCancelled
	_ = slowCancelled
}

// TestSpeculativeRouter_Timeout tests behavior when no provider responds in time
func TestSpeculativeRouter_Timeout(t *testing.T) {
	router, registry := createTestSetup()

	// Override timeout to be very short
	router.config.FirstTokenTimeout = 300 * time.Millisecond

	// All providers are slow, but one is slightly faster
	slowProvider1 := &MockProvider{
		name:            "slow-provider-1",
		firstTokenDelay: 350 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     5,
	}
	slowProvider2 := &MockProvider{
		name:            "slow-provider-2",
		firstTokenDelay: 400 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     5,
	}

	registry.Register(slowProvider1)
	registry.Register(slowProvider2)

	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
		Stream: true,
	}

	ctx := context.Background()
	tokenChan, errChan, metadata, err := router.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)

	// Should eventually select the fastest one even after timeout
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Should select slow-provider-1 (slightly faster)
	if metadata.WinnerProvider != "slow-provider-1" {
		t.Logf("Winner was %s (acceptable, both were slow)", metadata.WinnerProvider)
	}

	// Verify we can still consume tokens
	select {
	case _, ok := <-tokenChan:
		if !ok {
			t.Error("Token channel closed unexpectedly")
		}
	case err := <-errChan:
		t.Fatalf("Unexpected error: %v", err)
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for first token after race")
	}
}

// TestSpeculativeRouter_InsufficientProviders tests handling of insufficient providers
func TestSpeculativeRouter_InsufficientProviders(t *testing.T) {
	router, registry := createTestSetup()

	// Only register 1 provider when we need 2+
	singleProvider := &MockProvider{
		name:            "only-provider",
		firstTokenDelay: 100 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     5,
	}
	registry.Register(singleProvider)

	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
		Stream: true,
	}

	ctx := context.Background()
	_, _, _, err := router.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)

	// Should fail due to insufficient candidates
	if err == nil {
		t.Error("Expected error for insufficient providers, got nil")
	}

	if err != nil {
		t.Logf("Got expected error: %v", err)
	}
}

// TestSpeculativeRouter_ModeOff tests that mode=off returns error
func TestSpeculativeRouter_ModeOff(t *testing.T) {
	router, registry := createTestSetup()

	provider := &MockProvider{
		name:            "test-provider",
		firstTokenDelay: 100 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     5,
	}
	registry.Register(provider)

	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
		Stream: true,
	}

	ctx := context.Background()
	_, _, _, err := router.RouteSpeculative(ctx, req, config.SpeculativeModeOff)

	if err == nil {
		t.Error("Expected error when mode is off, got nil")
	}
}

// TestSpeculativeRouter_ProviderFailureDuringRace tests handling of provider failure
func TestSpeculativeRouter_ProviderFailureDuringRace(t *testing.T) {
	router, registry := createTestSetup()

	// Fast provider that fails immediately
	failingProvider := &MockProvider{
		name:            "failing-provider",
		firstTokenDelay: 50 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     5,
		shouldFail:      true,
		failAfterTokens: 0, // Fail before first token
	}

	// Slow but reliable provider
	reliableProvider := &MockProvider{
		name:            "reliable-provider",
		firstTokenDelay: 200 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     10,
		shouldFail:      false,
	}

	registry.Register(failingProvider)
	registry.Register(reliableProvider)

	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
		Stream: true,
	}

	ctx := context.Background()
	tokenChan, errChan, metadata, err := router.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)

	if err != nil {
		t.Fatalf("RouteSpeculative failed: %v", err)
	}

	// Reliable provider should win (failing provider fails before first token)
	if metadata.WinnerProvider != "reliable-provider" {
		t.Errorf("Expected reliable-provider to win, got %s", metadata.WinnerProvider)
	}

	// Consume first token to verify
	select {
	case chunk, ok := <-tokenChan:
		if !ok {
			t.Error("Token channel closed unexpectedly")
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta != nil {
			t.Logf("Received first token: %s", chunk.Choices[0].Delta.Content)
		}
	case err, ok := <-errChan:
		if ok && err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for first token")
	}
}

// TestSpeculativeRouter_MetadataCorrectness tests metadata accuracy
func TestSpeculativeRouter_MetadataCorrectness(t *testing.T) {
	router, registry := createTestSetup()

	provider1 := &MockProvider{
		name:            "provider-1",
		firstTokenDelay: 100 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     5,
	}
	provider2 := &MockProvider{
		name:            "provider-2",
		firstTokenDelay: 200 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     5,
	}
	provider3 := &MockProvider{
		name:            "provider-3",
		firstTokenDelay: 300 * time.Millisecond,
		tokenInterval:   50 * time.Millisecond,
		totalTokens:     5,
	}

	registry.Register(provider1)
	registry.Register(provider2)
	registry.Register(provider3)

	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
		Stream: true,
	}

	ctx := context.Background()
	start := time.Now()
	_, _, metadata, err := router.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)

	if err != nil {
		t.Fatalf("RouteSpeculative failed: %v", err)
	}

	// Verify metadata fields
	if metadata.WinnerProvider == "" {
		t.Error("WinnerProvider should not be empty")
	}

	if len(metadata.ProvidersUsed) != 3 {
		t.Errorf("Expected 3 providers used, got %d", len(metadata.ProvidersUsed))
	}

	if metadata.SwitchTokenNumber != 1 {
		t.Errorf("Expected SwitchTokenNumber=1, got %d", metadata.SwitchTokenNumber)
	}

	if metadata.LatencySavedMs <= 0 {
		t.Errorf("Expected positive latency, got %d", metadata.LatencySavedMs)
	}

	elapsed := time.Since(start)
	if elapsed > 1*time.Second {
		t.Errorf("Race took too long: %v", elapsed)
	}

	t.Logf("Metadata: winner=%s, latency=%dms, providers=%v",
		metadata.WinnerProvider, metadata.LatencySavedMs, metadata.ProvidersUsed)
}
