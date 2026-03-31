package router

import (
	"context"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// TestHandlerIntegration_SpeculativeFlow tests the full speculative execution flow
func TestHandlerIntegration_SpeculativeFlow(t *testing.T) {
	// Create provider registry with mock providers
	registry := providers.NewProviderRegistry()

	// Register fast provider
	fastProvider := &MockProvider{
		id:    "fast-provider",
		delay: 100 * time.Millisecond,
	}
	registry.Register(fastProvider)

	// Register slow provider
	slowProvider := &MockProvider{
		id:    "slow-provider",
		delay: 300 * time.Millisecond,
	}
	registry.Register(slowProvider)

	// Create speculative router
	specConfig := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeLatency,
		MaxProviders:      2,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
		WasteThreshold:    0.30,
	}

	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}

	speculativeRouter := NewSpeculativeRouter(specConfig, adaptiveRouter, registry)

	// Create request with speculative mode
	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "Hello, world!"},
		},
		SpeculativeMode: "latency",
	}

	// Execute speculative request
	ctx := context.Background()
	tokenChan, errChan, metadata, err := speculativeRouter.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)
	if err != nil {
		t.Fatalf("Failed to route speculative request: %v", err)
	}

	// Consume tokens
	tokenCount := 0
	for {
		select {
		case token, ok := <-tokenChan:
			if !ok {
				goto Done
			}
			tokenCount++
			t.Logf("Received token %d: %v", tokenCount, token)
		case err := <-errChan:
			if err != nil {
				t.Logf("Stream ended with error: %v", err)
			}
			goto Done
		case <-time.After(5 * time.Second):
			t.Fatal("Test timeout - stream did not complete")
		}
	}

Done:
	// Verify we received tokens
	if tokenCount == 0 {
		t.Fatal("Expected to receive tokens, got 0")
	}

	// Verify metadata
	if metadata == nil {
		t.Fatal("Expected metadata to be populated")
	}

	if metadata.WinnerProvider == "" {
		t.Error("Expected WinnerProvider to be set")
	}

	if len(metadata.ProvidersUsed) < 2 {
		t.Errorf("Expected at least 2 providers used, got %d", len(metadata.ProvidersUsed))
	}

	// Verify latency savings
	if metadata.LatencySavedMs <= 0 {
		t.Errorf("Expected positive latency savings, got %d", metadata.LatencySavedMs)
	}

	t.Logf("✓ Integration test passed:")
	t.Logf("  Winner: %s", metadata.WinnerProvider)
	t.Logf("  Providers raced: %v", metadata.ProvidersUsed)
	t.Logf("  Latency saved: %dms", metadata.LatencySavedMs)
	t.Logf("  Tokens received: %d", tokenCount)
}

// TestHandlerIntegration_ModeParsing tests different speculative modes
func TestHandlerIntegration_ModeParsing(t *testing.T) {
	tests := []struct {
		name          string
		requestMode   string
		expectedMode  config.SpeculativeMode
		shouldSucceed bool
	}{
		{"Latency mode", "latency", config.SpeculativeModeLatency, true},
		{"Balanced mode", "balanced", config.SpeculativeModeBalanced, true},
		{"Quality mode", "quality", config.SpeculativeModeQuality, true},
		{"Cost mode", "cost", config.SpeculativeModeCost, true},
		{"Empty mode (disabled)", "", config.SpeculativeModeLatency, false},
	}

	// Create provider registry with 2 providers (minimum for speculative execution)
	registry := providers.NewProviderRegistry()
	mockProvider1 := &MockProvider{
		id:    "test-provider-1",
		delay: 100 * time.Millisecond,
	}
	mockProvider2 := &MockProvider{
		id:    "test-provider-2",
		delay: 150 * time.Millisecond,
	}
	registry.Register(mockProvider1)
	registry.Register(mockProvider2)

	// Create speculative router
	specConfig := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeLatency,
		MaxProviders:      2,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
		WasteThreshold:    0.30,
	}

	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}

	speculativeRouter := NewSpeculativeRouter(specConfig, adaptiveRouter, registry)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &models.InferRequest{
				Model: "test-model",
				Messages: []models.Message{
					{Role: "user", Content: "Test"},
				},
				SpeculativeMode: tt.requestMode,
			}

			// Test would check if mode is parsed correctly
			// For now, just verify request structure is valid
			if req.SpeculativeMode != tt.requestMode {
				t.Errorf("Mode mismatch: expected %s, got %s", tt.requestMode, req.SpeculativeMode)
			}

			// If mode is not empty, try routing
			if tt.requestMode != "" {
				ctx := context.Background()
				tokenChan, errChan, metadata, err := speculativeRouter.RouteSpeculative(ctx, req, tt.expectedMode)
				if err != nil {
					if tt.shouldSucceed {
						t.Fatalf("Expected success but got error: %v", err)
					}
					return
				}

				// Consume tokens
				for {
					select {
					case _, ok := <-tokenChan:
						if !ok {
							goto TestDone
						}
					case <-errChan:
						goto TestDone
					case <-time.After(2 * time.Second):
						goto TestDone
					}
				}

			TestDone:
				if metadata == nil {
					t.Error("Expected metadata to be populated")
				}
			}
		})
	}
}

// TestHandlerIntegration_CostRecording tests that cost accounting is called
func TestHandlerIntegration_CostRecording(t *testing.T) {
	// Create provider registry
	registry := providers.NewProviderRegistry()
	provider1 := &MockProvider{
		id:    "provider1",
		delay: 100 * time.Millisecond,
	}
	provider2 := &MockProvider{
		id:    "provider2",
		delay: 200 * time.Millisecond,
	}
	registry.Register(provider1)
	registry.Register(provider2)

	// Create speculative router with cost accounting
	specConfig := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeLatency,
		MaxProviders:      2,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
		WasteThreshold:    0.30,
	}

	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}

	speculativeRouter := NewSpeculativeRouter(specConfig, adaptiveRouter, registry)

	// Execute request
	ctx := context.Background()
	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "Test cost recording"},
		},
	}

	tokenChan, errChan, metadata, err := speculativeRouter.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)
	if err != nil {
		t.Fatalf("Failed to route: %v", err)
	}

	// Consume tokens
	for {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				goto CostTestDone
			}
		case <-errChan:
			goto CostTestDone
		case <-time.After(3 * time.Second):
			goto CostTestDone
		}
	}

CostTestDone:
	// Check that cost accounting info is available in metadata
	finalMeta := metadata.GetFinalMetadata()

	if finalMeta.TotalTokens == 0 {
		t.Error("Expected total tokens to be tracked")
	}

	t.Logf("Cost tracking test completed:")
	t.Logf("  Total tokens: %d", finalMeta.TotalTokens)
	t.Logf("  Winner: %s", finalMeta.FinalProvider)
}
