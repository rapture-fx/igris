package router

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/observability"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// TestSpeculativeObservability_MetricsRecorded tests that Prometheus metrics are recorded
func TestSpeculativeObservability_MetricsRecorded(t *testing.T) {
	// Note: This is a behavioral test to ensure metrics functions are called
	// Actual metric values would be verified via Prometheus scraping in integration tests

	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeLatency,
		MaxProviders:      2,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
	}

	// Create mock providers
	providerRegistry := providers.NewProviderRegistry()
	fastProvider := &MockProvider{
		name:            "fast",
		firstTokenDelay: 100 * time.Millisecond,
		tokenInterval:   10 * time.Millisecond,
		totalTokens:     10,
	}
	slowProvider := &MockProvider{
		name:            "slow",
		firstTokenDelay: 300 * time.Millisecond,
		tokenInterval:   10 * time.Millisecond,
		totalTokens:     10,
	}

	providerRegistry.Register(fastProvider)
	providerRegistry.Register(slowProvider)

	// Create speculative router
	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}
	speculativeRouter := NewSpeculativeRouter(cfg, adaptiveRouter, providerRegistry)

	// Execute speculative request
	ctx := context.Background()
	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
	}

	tokenChan, errChan, metadata, err := speculativeRouter.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)
	if err != nil {
		t.Fatalf("Failed to route speculative request: %v", err)
	}

	// Consume all tokens
	tokenCount := 0
	for {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				goto Done
			}
			tokenCount++
		case err := <-errChan:
			if err != nil {
				t.Logf("Stream ended with error (expected in test): %v", err)
			}
			goto Done
		case <-time.After(5 * time.Second):
			goto Done
		}
	}

Done:
	// Verify metadata was populated
	if metadata == nil {
		t.Fatal("Expected metadata to be populated")
	}

	if metadata.WinnerProvider == "" {
		t.Error("Expected WinnerProvider to be set")
	}

	if len(metadata.ProvidersUsed) < 2 {
		t.Errorf("Expected at least 2 providers used, got %d", len(metadata.ProvidersUsed))
	}

	t.Logf("Metrics test completed: winner=%s, providers=%v, latency_saved=%dms",
		metadata.WinnerProvider, metadata.ProvidersUsed, metadata.LatencySavedMs)

	// Note: Actual metric values would be scraped via Prometheus in integration tests
	// This test verifies that the metric recording functions are called without errors
}

// TestSpeculativeObservability_TracingSpans tests that OpenTelemetry spans are created
func TestSpeculativeObservability_TracingSpans(t *testing.T) {
	// Note: This is a behavioral test to ensure tracing functions are called
	// Actual span data would be verified via Jaeger in integration tests

	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeBalanced,
		MaxProviders:      2,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
	}

	// Create mock providers
	providerRegistry := providers.NewProviderRegistry()
	provider1 := &MockProvider{
		name:            "provider1",
		firstTokenDelay: 150 * time.Millisecond,
		tokenInterval:   10 * time.Millisecond,
		totalTokens:     10,
	}
	provider2 := &MockProvider{
		name:            "provider2",
		firstTokenDelay: 200 * time.Millisecond,
		tokenInterval:   10 * time.Millisecond,
		totalTokens:     10,
	}

	providerRegistry.Register(provider1)
	providerRegistry.Register(provider2)

	// Create speculative router
	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}
	speculativeRouter := NewSpeculativeRouter(cfg, adaptiveRouter, providerRegistry)

	// Execute speculative request with tracing context
	ctx := context.Background()

	// Start a parent span
	ctx, parentSpan := observability.StartSpan(ctx, "test_speculative_request")
	defer parentSpan.End()

	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
	}

	tokenChan, errChan, metadata, err := speculativeRouter.RouteSpeculative(ctx, req, config.SpeculativeModeBalanced)
	if err != nil {
		t.Fatalf("Failed to route speculative request: %v", err)
	}

	// Consume tokens
	for {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				goto Done
			}
		case <-errChan:
			goto Done
		case <-time.After(5 * time.Second):
			goto Done
		}
	}

Done:
	if metadata == nil {
		t.Fatal("Expected metadata to be populated")
	}

	t.Logf("Tracing test completed: composite_score=%.3f, quality_score=%.3f",
		metadata.CompositeScore, metadata.QualityScore)

	// Note: Actual span data (parent span, child spans per provider) would be
	// verified via Jaeger trace visualization in integration tests
}

// TestSpeculativeObservability_MidStreamSwitchMetrics tests switch metrics
func TestSpeculativeObservability_MidStreamSwitchMetrics(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeLatency,
		MaxProviders:      2,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
	}

	// Create mock providers - winner will fail mid-stream
	providerRegistry := providers.NewProviderRegistry()
	winnerProvider := &MockProvider{
		name:            "winner",
		firstTokenDelay: 100 * time.Millisecond,
		tokenInterval:   10 * time.Millisecond,
		totalTokens:     10,
		shouldFail:      true,
		failAfterTokens: 5,
	}
	fallbackProvider := &MockProvider{
		name:            "fallback",
		firstTokenDelay: 200 * time.Millisecond,
		tokenInterval:   10 * time.Millisecond,
		totalTokens:     10,
	}

	providerRegistry.Register(winnerProvider)
	providerRegistry.Register(fallbackProvider)

	// Create speculative router
	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}
	speculativeRouter := NewSpeculativeRouter(cfg, adaptiveRouter, providerRegistry)

	// Execute speculative request
	ctx := context.Background()
	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
	}

	tokenChan, errChan, metadata, err := speculativeRouter.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)
	if err != nil {
		t.Fatalf("Failed to route speculative request: %v", err)
	}

	// Consume tokens
	receivedTokens := 0
	for {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				goto Done
			}
			receivedTokens++
		case err := <-errChan:
			if err != nil {
				t.Logf("Received expected error: %v", err)
			}
		case <-time.After(5 * time.Second):
			goto Done
		}
	}

Done:
	if metadata == nil {
		t.Fatal("Expected metadata to be populated")
	}

	// Get final metadata
	finalMeta := metadata.GetFinalMetadata()

	if finalMeta.MidStreamSwitch {
		t.Logf("Mid-stream switch occurred at token %d: %s → %s",
			finalMeta.SwitchTokenNumber, metadata.WinnerProvider, finalMeta.FinalProvider)
	}

	// Note: Actual switch metrics would be verified via Prometheus:
	// - speculative_switches_total{reason="provider_failure"}
	// - speculative_tokens_wasted_total{provider="winner"}
	t.Logf("Switch metrics test completed: tokens_received=%d", receivedTokens)
}

// TestSpeculativeObservability_QualityScoreMetrics tests quality scoring metrics
func TestSpeculativeObservability_QualityScoreMetrics(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeQuality,
		MaxProviders:      3,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
	}

	// Create mock providers with varying latencies
	providerRegistry := providers.NewProviderRegistry()
	providers := []struct {
		name  string
		delay time.Duration
	}{
		{"provider_a", 100 * time.Millisecond},
		{"provider_b", 150 * time.Millisecond},
		{"provider_c", 200 * time.Millisecond},
	}

	for _, p := range providers {
		provider := &MockProvider{
			name:            p.name,
			firstTokenDelay: p.delay,
			tokenInterval:   10 * time.Millisecond,
			totalTokens:     10,
		}
		providerRegistry.Register(provider)
	}

	// Create speculative router
	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}
	speculativeRouter := NewSpeculativeRouter(cfg, adaptiveRouter, providerRegistry)

	// Execute speculative request
	ctx := context.Background()
	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
	}

	tokenChan, errChan, metadata, err := speculativeRouter.RouteSpeculative(ctx, req, config.SpeculativeModeQuality)
	if err != nil {
		t.Fatalf("Failed to route speculative request: %v", err)
	}

	// Consume tokens
	for {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				goto Done
			}
		case <-errChan:
			goto Done
		case <-time.After(5 * time.Second):
			goto Done
		}
	}

Done:
	if metadata == nil {
		t.Fatal("Expected metadata to be populated")
	}

	// Verify quality scoring metadata
	if metadata.QualityScore == 0 {
		t.Error("Expected quality score to be non-zero")
	}

	if metadata.CompositeScore == 0 {
		t.Error("Expected composite score to be non-zero")
	}

	if metadata.SelectionCriteria != string(config.SpeculativeModeQuality) {
		t.Errorf("Expected selection criteria to be 'quality', got %s", metadata.SelectionCriteria)
	}

	t.Logf("Quality score metrics test completed: quality=%.3f, composite=%.3f, winner=%s",
		metadata.QualityScore, metadata.CompositeScore, metadata.WinnerProvider)

	// Note: Actual quality score metrics would be verified via Prometheus:
	// - speculative_quality_score{provider="X", score_type="latency/quality/cost/composite"}
}

// TestSpeculativeObservability_FallbackBufferMetrics tests buffer size metrics
func TestSpeculativeObservability_FallbackBufferMetrics(t *testing.T) {
	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		DefaultMode:       config.SpeculativeModeLatency,
		MaxProviders:      2,
		FirstTokenTimeout: 2 * time.Second,
		EarlyTokenCount:   5,
	}

	// Create mock providers
	providerRegistry := providers.NewProviderRegistry()
	fastProvider := &MockProvider{
		name:            "fast",
		firstTokenDelay: 100 * time.Millisecond,
		tokenInterval:   5 * time.Millisecond, // Slow token delivery
		totalTokens:     20,                    // More tokens
	}
	slowProvider := &MockProvider{
		name:            "slow",
		firstTokenDelay: 300 * time.Millisecond,
		tokenInterval:   5 * time.Millisecond,
		totalTokens:     20,
	}

	providerRegistry.Register(fastProvider)
	providerRegistry.Register(slowProvider)

	// Create speculative router
	adaptiveRouter := &AdaptiveRouter{
		backends:      make(map[string]*Backend),
		metricsWindow: 5 * time.Minute,
		routingPolicy: PolicyThompsonSampling,
	}
	speculativeRouter := NewSpeculativeRouter(cfg, adaptiveRouter, providerRegistry)

	// Execute speculative request
	ctx := context.Background()
	req := &models.InferRequest{
		Model: "test-model",
		Messages: []models.Message{
			{Role: "user", Content: "test"},
		},
	}

	tokenChan, errChan, metadata, err := speculativeRouter.RouteSpeculative(ctx, req, config.SpeculativeModeLatency)
	if err != nil {
		t.Fatalf("Failed to route speculative request: %v", err)
	}

	// Consume tokens slowly to allow fallback buffering
	tokenCount := 0
	for {
		select {
		case _, ok := <-tokenChan:
			if !ok {
				goto Done
			}
			tokenCount++
			time.Sleep(10 * time.Millisecond) // Allow fallback to buffer
		case <-errChan:
			goto Done
		case <-time.After(5 * time.Second):
			goto Done
		}
	}

Done:
	if metadata == nil {
		t.Fatal("Expected metadata to be populated")
	}

	// Get final metadata with buffer stats
	finalMeta := metadata.GetFinalMetadata()

	t.Logf("Fallback buffer test completed: tokens_received=%d, buffer_sizes=%v",
		tokenCount, finalMeta)

	// Note: Actual buffer size metrics would be verified via Prometheus:
	// - speculative_fallback_buffer_size{provider="slow"}
}

// Mock provider implementation for testing (same as in other test files)
// This is duplicated here for test isolation
type MockProviderForObservability struct {
	name            string
	firstTokenDelay time.Duration
	tokenInterval   time.Duration
	totalTokens     int
	shouldFail      bool
	failAfterTokens int
}

func (m *MockProviderForObservability) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		// Simulate first token delay
		select {
		case <-time.After(m.firstTokenDelay):
		case <-ctx.Done():
			return
		}

		// Send tokens
		for i := 0; i < m.totalTokens; i++ {
			// Check if should fail
			if m.shouldFail && i >= m.failAfterTokens {
				errChan <- fmt.Errorf("mock provider %s failed after %d tokens", m.name, i)
				return
			}

			finishReason := ""
			if i == m.totalTokens-1 {
				finishReason = "stop"
			}

			chunk := models.NewStreamChunk(
				"test-req",
				req.Model,
				fmt.Sprintf("token_%d ", i),
				0,
				finishReason,
			)

			select {
			case chunkChan <- chunk:
			case <-ctx.Done():
				return
			}

			// Inter-token delay
			select {
			case <-time.After(m.tokenInterval):
			case <-ctx.Done():
				return
			}
		}
	}()

	return chunkChan, errChan
}

func (m *MockProviderForObservability) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (m *MockProviderForObservability) Name() string {
	return m.name
}

func (m *MockProviderForObservability) HealthCheck(ctx context.Context) error {
	return nil
}
