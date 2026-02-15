package openai

import (
	"context"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// TestMockProviderBasic tests basic mock provider functionality
func TestMockProviderBasic(t *testing.T) {
	provider, err := NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	if provider.Name() != "mock-openai" {
		t.Errorf("Expected provider name 'mock-openai', got '%s'", provider.Name())
	}

	req := &models.InferRequest{
		Model: "igris-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Test message"},
		},
	}

	ctx := context.Background()
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		t.Fatalf("Inference failed: %v", err)
	}

	if resp == nil {
		t.Fatal("Response is nil")
	}

	if len(resp.Choices) == 0 {
		t.Fatal("No choices in response")
	}

	if resp.Metadata.Provider != "mock-openai" {
		t.Errorf("Expected provider 'mock-openai', got '%s'", resp.Metadata.Provider)
	}

	t.Logf("✓ Mock provider test passed: latency=%dms, tokens=%d",
		resp.Metadata.LatencyMs, resp.Usage.TotalTokens)
}

// TestMockProviderCapabilities tests provider capabilities
func TestMockProviderCapabilities(t *testing.T) {
	provider, err := NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	caps := provider.GetCapabilities()
	if caps == nil {
		t.Fatal("Capabilities are nil")
	}

	if !caps.SupportsStreaming {
		t.Error("Mock provider should support streaming")
	}

	if caps.CostPerToken != 0.000002 {
		t.Errorf("Expected cost per token 0.000002, got %f", caps.CostPerToken)
	}

	t.Log("✓ Capabilities test passed")
}

// TestMockProviderStreaming tests streaming functionality
func TestMockProviderStreaming(t *testing.T) {
	provider, err := NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model:  "igris-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Stream test"},
		},
		Stream: true,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	chunkChan, errChan := provider.InferStream(ctx, req)

	chunkCount := 0
	for {
		select {
		case _, ok := <-chunkChan:
			if !ok {
				goto Done
			}
			chunkCount++
			if chunkCount > 1500 { // Safety limit (max tokens is 1200)
				t.Fatal("Too many chunks")
			}

		case err := <-errChan:
			if err != nil {
				t.Fatalf("Streaming error: %v", err)
			}
			goto Done

		case <-time.After(10 * time.Second):
			t.Fatal("Streaming timeout")
		}
	}

Done:
	if chunkCount == 0 {
		t.Fatal("No chunks received")
	}

	t.Logf("✓ Streaming test passed: %d chunks", chunkCount)
}

// TestMockProviderHealthCheck tests health check
func TestMockProviderHealthCheck(t *testing.T) {
	provider, err := NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	ctx := context.Background()
	err = provider.HealthCheck(ctx)
	if err != nil {
		t.Errorf("Health check failed: %v", err)
	}

	t.Log("✓ Health check passed")
}

// TestMockProviderCostEstimation tests cost estimation
func TestMockProviderCostEstimation(t *testing.T) {
	provider, err := NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "igris-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Estimate my cost"},
		},
		MaxTokens: 200,
	}

	cost, err := provider.EstimateCost(req)
	if err != nil {
		t.Fatalf("Cost estimation failed: %v", err)
	}

	if cost <= 0 {
		t.Error("Estimated cost should be positive")
	}

	t.Logf("✓ Cost estimation passed: $%.6f", cost)
}

// TestMockProviderConfig tests custom configuration
func TestMockProviderConfig(t *testing.T) {
	config := &providers.ProviderConfig{
		BaseURL:       "https://mock.test.local",
		Timeout:       60,
		EnableMetrics: true,
		Custom: map[string]interface{}{
			"mock": &MockConfig{
				MinLatencyMs: 100,
				MaxLatencyMs: 150,
				MinTokens:    200,
				MaxTokens:    400,
				CostPerToken: 0.000003,
			},
		},
	}

	provider, err := NewMockOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create mock provider with config: %v", err)
	}

	req := &models.InferRequest{
		Model: "igris-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Custom config test"},
		},
	}

	ctx := context.Background()
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		t.Fatalf("Inference failed: %v", err)
	}

	// Verify latency is in custom range
	if resp.Metadata.LatencyMs < 100 || resp.Metadata.LatencyMs > 200 {
		t.Errorf("Latency %dms outside custom range [100-150ms]", resp.Metadata.LatencyMs)
	}

	t.Logf("✓ Custom config test passed")
}
