package tests

import (
	"context"
	"testing"
	"time"

	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/schlep-engine/schlep-engine/internal/providers"
	"github.com/schlep-engine/schlep-engine/internal/providers/openai"
)

// TestMockProviderInitialization tests mock provider creation
func TestMockProviderInitialization(t *testing.T) {
	config := &providers.ProviderConfig{
		BaseURL:       "https://mock.schlep-engine.local",
		Timeout:       30,
		EnableMetrics: true,
	}

	provider, err := openai.NewMockOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	if provider == nil {
		t.Fatal("Provider is nil")
	}

	if provider.Name() != "mock-openai" {
		t.Errorf("Expected provider name 'mock-openai', got '%s'", provider.Name())
	}
}

// TestMockProviderInference tests basic inference functionality
func TestMockProviderInference(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "schlep-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Hello, this is a test message!"},
		},
		MaxTokens:   100,
		Temperature: 0.7,
	}

	ctx := context.Background()
	startTime := time.Now()

	resp, err := provider.Infer(ctx, req)
	if err != nil {
		t.Fatalf("Inference failed: %v", err)
	}

	elapsed := time.Since(startTime).Milliseconds()

	// Verify response structure
	if resp == nil {
		t.Fatal("Response is nil")
	}

	if len(resp.Choices) == 0 {
		t.Fatal("No choices in response")
	}

	if resp.Choices[0].Message == nil {
		t.Fatal("Message is nil in first choice")
	}

	if resp.Choices[0].Message.Content == "" {
		t.Error("Message content is empty")
	}

	// Verify metadata
	if resp.Metadata == nil {
		t.Fatal("Metadata is nil")
	}

	if resp.Metadata.Provider != "mock-openai" {
		t.Errorf("Expected provider 'mock-openai', got '%s'", resp.Metadata.Provider)
	}

	if resp.Metadata.ModelUsed != "schlep-mock-gpt-4" {
		t.Errorf("Expected model 'schlep-mock-gpt-4', got '%s'", resp.Metadata.ModelUsed)
	}

	// Verify latency simulation (should be between 50-200ms)
	if resp.Metadata.LatencyMs < 50 || resp.Metadata.LatencyMs > 250 {
		t.Errorf("Latency %dms outside expected range [50-250ms]", resp.Metadata.LatencyMs)
	}

	// Verify actual elapsed time is close to simulated latency
	if elapsed < 50 {
		t.Errorf("Actual elapsed time %dms less than minimum expected latency", elapsed)
	}

	t.Logf("✓ Inference completed in %dms (simulated: %dms)", elapsed, resp.Metadata.LatencyMs)
}

// TestMockProviderTokenUsage tests token simulation
func TestMockProviderTokenUsage(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "schlep-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Test message for token counting"},
		},
		MaxTokens: 500,
	}

	ctx := context.Background()
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		t.Fatalf("Inference failed: %v", err)
	}

	// Verify usage stats
	if resp.Usage == nil {
		t.Fatal("Usage stats are nil")
	}

	if resp.Usage.PromptTokens <= 0 {
		t.Error("Prompt tokens should be positive")
	}

	if resp.Usage.CompletionTokens <= 0 {
		t.Error("Completion tokens should be positive")
	}

	if resp.Usage.TotalTokens != resp.Usage.PromptTokens+resp.Usage.CompletionTokens {
		t.Error("Total tokens mismatch")
	}

	// Verify token range (should be between 100-1200 for completion)
	if resp.Usage.CompletionTokens < 50 || resp.Usage.CompletionTokens > 1500 {
		t.Errorf("Completion tokens %d outside expected range", resp.Usage.CompletionTokens)
	}

	t.Logf("✓ Token usage: prompt=%d, completion=%d, total=%d",
		resp.Usage.PromptTokens, resp.Usage.CompletionTokens, resp.Usage.TotalTokens)
}

// TestMockProviderCostSimulation tests cost calculation
func TestMockProviderCostSimulation(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "schlep-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Calculate my cost please"},
		},
		MaxTokens: 300,
	}

	ctx := context.Background()
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		t.Fatalf("Inference failed: %v", err)
	}

	// Verify cost is calculated
	if resp.Metadata.CostUSD <= 0 {
		t.Error("Cost should be positive")
	}

	// Verify cost is realistic ($0.000002 per token)
	expectedCost := float64(resp.Usage.TotalTokens) * 0.000002
	tolerance := expectedCost * 0.01 // 1% tolerance

	if resp.Metadata.CostUSD < expectedCost-tolerance || resp.Metadata.CostUSD > expectedCost+tolerance {
		t.Errorf("Cost %.6f outside expected range [%.6f - %.6f]",
			resp.Metadata.CostUSD, expectedCost-tolerance, expectedCost+tolerance)
	}

	t.Logf("✓ Cost simulation: $%.6f for %d tokens (rate: $%.6f/token)",
		resp.Metadata.CostUSD, resp.Usage.TotalTokens, resp.Metadata.CostUSD/float64(resp.Usage.TotalTokens))
}

// TestMockProviderStreaming tests streaming inference
func TestMockProviderStreaming(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "schlep-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Stream me some content"},
		},
		Stream: true,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	chunkChan, errChan := provider.InferStream(ctx, req)

	chunkCount := 0
	var lastFinishReason string
	startTime := time.Now()

	for {
		select {
		case chunk, ok := <-chunkChan:
			if !ok {
				// Stream finished
				goto Done
			}

			chunkCount++

			if len(chunk.Choices) == 0 {
				t.Error("Chunk has no choices")
				continue
			}

			if chunk.Choices[0].Delta != nil {
				t.Logf("Chunk %d: '%s'", chunkCount, chunk.Choices[0].Delta.Content)
			}

			lastFinishReason = chunk.Choices[0].FinishReason

		case err := <-errChan:
			if err != nil {
				t.Fatalf("Streaming error: %v", err)
			}
			goto Done

		case <-time.After(30 * time.Second):
			t.Fatal("Streaming timeout")
		}
	}

Done:
	elapsed := time.Since(startTime).Milliseconds()

	if chunkCount == 0 {
		t.Fatal("No chunks received")
	}

	if lastFinishReason != "stop" {
		t.Errorf("Expected finish reason 'stop', got '%s'", lastFinishReason)
	}

	t.Logf("✓ Streaming completed: %d chunks in %dms", chunkCount, elapsed)
}

// TestMockProviderCapabilities tests provider capabilities
func TestMockProviderCapabilities(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	caps := provider.GetCapabilities()
	if caps == nil {
		t.Fatal("Capabilities are nil")
	}

	// Verify basic capabilities
	if !caps.SupportsStreaming {
		t.Error("Mock provider should support streaming")
	}

	if !caps.SupportsTemperature {
		t.Error("Mock provider should support temperature")
	}

	if len(caps.Models) == 0 {
		t.Error("No models listed in capabilities")
	}

	if caps.CostPerToken != 0.000002 {
		t.Errorf("Expected cost per token 0.000002, got %f", caps.CostPerToken)
	}

	if caps.ReliabilityScore != 1.0 {
		t.Errorf("Expected reliability score 1.0, got %f", caps.ReliabilityScore)
	}

	t.Logf("✓ Capabilities: %d models, streaming=%v, cost=%.6f/token",
		len(caps.Models), caps.SupportsStreaming, caps.CostPerToken)
}

// TestMockProviderHealthCheck tests health check
func TestMockProviderHealthCheck(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
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
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "schlep-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "This is a test message"},
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

	// Cost should be reasonable (< $1)
	if cost > 1.0 {
		t.Errorf("Estimated cost %.6f is unreasonably high", cost)
	}

	t.Logf("✓ Estimated cost: $%.6f", cost)
}

// TestMockProviderVariation tests response variation
func TestMockProviderVariation(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "schlep-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Test variation"},
		},
		MaxTokens: 150,
	}

	ctx := context.Background()

	// Run multiple inferences and check for variation
	latencies := make([]int64, 5)
	tokenCounts := make([]int, 5)

	for i := 0; i < 5; i++ {
		resp, err := provider.Infer(ctx, req)
		if err != nil {
			t.Fatalf("Inference %d failed: %v", i, err)
		}

		latencies[i] = resp.Metadata.LatencyMs
		tokenCounts[i] = resp.Usage.TotalTokens
	}

	// Check that values vary (not all the same)
	allSameLatency := true
	allSameTokens := true

	for i := 1; i < 5; i++ {
		if latencies[i] != latencies[0] {
			allSameLatency = false
		}
		if tokenCounts[i] != tokenCounts[0] {
			allSameTokens = false
		}
	}

	if allSameLatency {
		t.Error("Latencies should vary across requests")
	}

	if allSameTokens {
		t.Error("Token counts should vary across requests")
	}

	t.Logf("✓ Variation confirmed: latencies=%v, tokens=%v", latencies, tokenCounts)
}

// TestMockProviderWithPolicy tests provider with explicit policy
func TestMockProviderWithPolicy(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "schlep-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Test with policy"},
		},
		Policy: &models.PolicyOverride{
			Provider:    "mock-openai",
			OptimizeFor: "latency",
		},
	}

	ctx := context.Background()
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		t.Fatalf("Inference with policy failed: %v", err)
	}

	if resp.Metadata.Provider != "mock-openai" {
		t.Errorf("Expected provider 'mock-openai', got '%s'", resp.Metadata.Provider)
	}

	t.Log("✓ Policy-based routing successful")
}

// TestMockProviderContextCancellation tests context cancellation
func TestMockProviderContextCancellation(t *testing.T) {
	provider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("Failed to create mock provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "schlep-mock-gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Test cancellation"},
		},
		Stream: true,
	}

	ctx, cancel := context.WithCancel(context.Background())

	chunkChan, errChan := provider.InferStream(ctx, req)

	// Cancel after receiving first chunk
	go func() {
		<-chunkChan
		cancel()
	}()

	// Wait for error or completion
	select {
	case err := <-errChan:
		if err != context.Canceled {
			t.Errorf("Expected context.Canceled error, got: %v", err)
		}
		t.Log("✓ Context cancellation handled correctly")
	case <-time.After(5 * time.Second):
		t.Fatal("Timeout waiting for cancellation")
	}
}
