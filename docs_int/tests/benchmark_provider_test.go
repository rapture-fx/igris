package tests

import (
	"context"
	"testing"
	"time"

	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/schlep-engine/schlep-engine/internal/providers"
	"github.com/schlep-engine/schlep-engine/internal/providers/anthropic"
	"github.com/schlep-engine/schlep-engine/internal/providers/openai"
)

// TestBenchmarkOpenAIProvider tests the OpenAI benchmark provider
func TestBenchmarkOpenAIProvider(t *testing.T) {
	t.Run("Provider initialization", func(t *testing.T) {
		config := &providers.ProviderConfig{
			BaseURL:       "https://api.openai.com/v1",
			Timeout:       60,
			MaxRetries:    3,
			EnableMetrics: true,
		}

		provider, err := openai.NewBenchmarkOpenAIProvider(config)
		if err != nil {
			t.Fatalf("Failed to create benchmark provider: %v", err)
		}

		if provider.Name() != "benchmark-openai" {
			t.Errorf("Expected provider name 'benchmark-openai', got '%s'", provider.Name())
		}
	})

	t.Run("Basic inference request", func(t *testing.T) {
		provider, _ := openai.NewBenchmarkOpenAIProvider(nil)

		req := &models.InferRequest{
			Model: "gpt-4",
			Messages: []models.Message{
				{Role: "user", Content: "Hello, how are you?"},
			},
			MaxTokens:   100,
			Temperature: 0.7,
		}

		ctx := context.Background()
		startTime := time.Now()
		resp, err := provider.Infer(ctx, req)
		elapsed := time.Since(startTime)

		if err != nil {
			t.Fatalf("Inference failed: %v", err)
		}

		// Verify response structure
		if resp == nil {
			t.Fatal("Response is nil")
		}

		if len(resp.Choices) == 0 {
			t.Error("Response has no choices")
		}

		if resp.Usage == nil {
			t.Error("Response has no usage statistics")
		}

		// Verify latency simulation
		if elapsed < 80*time.Millisecond {
			t.Errorf("Latency too low (%v), expected at least 80ms", elapsed)
		}

		if elapsed > 5*time.Second {
			t.Errorf("Latency too high (%v), expected less than 5s", elapsed)
		}

		// Verify token usage
		if resp.Usage.TotalTokens == 0 {
			t.Error("Total tokens is 0")
		}

		// Verify cost calculation
		if resp.Metadata.CostUSD <= 0 {
			t.Error("Cost should be greater than 0")
		}

		t.Logf("Inference completed in %v, tokens=%d, cost=$%.6f",
			elapsed, resp.Usage.TotalTokens, resp.Metadata.CostUSD)
	})

	t.Run("Streaming inference", func(t *testing.T) {
		provider, _ := openai.NewBenchmarkOpenAIProvider(nil)

		req := &models.InferRequest{
			Model: "gpt-3.5-turbo",
			Messages: []models.Message{
				{Role: "user", Content: "Count to 5"},
			},
			Stream: true,
		}

		ctx := context.Background()
		chunkChan, errChan := provider.InferStream(ctx, req)

		chunkCount := 0
		for chunk := range chunkChan {
			chunkCount++
			if chunk == nil {
				t.Error("Received nil chunk")
			}
		}

		// Check for errors
		select {
		case err := <-errChan:
			if err != nil {
				t.Fatalf("Streaming error: %v", err)
			}
		default:
			// No error
		}

		if chunkCount == 0 {
			t.Error("No chunks received")
		}

		t.Logf("Received %d chunks", chunkCount)
	})

	t.Run("Cost estimation", func(t *testing.T) {
		provider, _ := openai.NewBenchmarkOpenAIProvider(nil)

		req := &models.InferRequest{
			Model: "gpt-4",
			Messages: []models.Message{
				{Role: "user", Content: "This is a test message for cost estimation"},
			},
			MaxTokens: 500,
		}

		cost, err := provider.EstimateCost(req)
		if err != nil {
			t.Fatalf("Cost estimation failed: %v", err)
		}

		if cost <= 0 {
			t.Error("Estimated cost should be greater than 0")
		}

		t.Logf("Estimated cost: $%.6f", cost)
	})

	t.Run("Health check", func(t *testing.T) {
		provider, _ := openai.NewBenchmarkOpenAIProvider(nil)

		ctx := context.Background()
		err := provider.HealthCheck(ctx)
		if err != nil {
			t.Errorf("Health check failed: %v", err)
		}
	})

	t.Run("Capabilities", func(t *testing.T) {
		provider, _ := openai.NewBenchmarkOpenAIProvider(nil)

		caps := provider.GetCapabilities()
		if caps == nil {
			t.Fatal("Capabilities is nil")
		}

		if len(caps.Models) == 0 {
			t.Error("No models in capabilities")
		}

		if !caps.SupportsStreaming {
			t.Error("Should support streaming")
		}

		t.Logf("Provider supports %d models", len(caps.Models))
	})
}

// TestBenchmarkAnthropicProvider tests the Anthropic benchmark provider
func TestBenchmarkAnthropicProvider(t *testing.T) {
	t.Run("Provider initialization", func(t *testing.T) {
		config := &providers.ProviderConfig{
			BaseURL:       "https://api.anthropic.com/v1",
			Timeout:       60,
			MaxRetries:    3,
			EnableMetrics: true,
		}

		provider, err := anthropic.NewBenchmarkAnthropicProvider(config)
		if err != nil {
			t.Fatalf("Failed to create benchmark provider: %v", err)
		}

		if provider.Name() != "benchmark-anthropic" {
			t.Errorf("Expected provider name 'benchmark-anthropic', got '%s'", provider.Name())
		}
	})

	t.Run("Basic inference request", func(t *testing.T) {
		provider, _ := anthropic.NewBenchmarkAnthropicProvider(nil)

		req := &models.InferRequest{
			Model: "claude-3-haiku",
			Messages: []models.Message{
				{Role: "user", Content: "Hello Claude!"},
			},
			MaxTokens:   150,
			Temperature: 0.7,
		}

		ctx := context.Background()
		startTime := time.Now()
		resp, err := provider.Infer(ctx, req)
		elapsed := time.Since(startTime)

		if err != nil {
			t.Fatalf("Inference failed: %v", err)
		}

		if resp == nil {
			t.Fatal("Response is nil")
		}

		// Verify latency simulation (Claude typically has different latency profile)
		if elapsed < 80*time.Millisecond {
			t.Errorf("Latency too low (%v)", elapsed)
		}

		// Verify response structure
		if len(resp.Choices) == 0 {
			t.Error("Response has no choices")
		}

		// Verify Anthropic-specific stop reason
		if resp.Choices[0].FinishReason != "end_turn" {
			t.Logf("Note: Finish reason is '%s', Anthropic typically uses 'end_turn'",
				resp.Choices[0].FinishReason)
		}

		t.Logf("Inference completed in %v, tokens=%d, cost=$%.6f",
			elapsed, resp.Usage.TotalTokens, resp.Metadata.CostUSD)
	})

	t.Run("Streaming inference", func(t *testing.T) {
		provider, _ := anthropic.NewBenchmarkAnthropicProvider(nil)

		req := &models.InferRequest{
			Model: "claude-3-sonnet",
			Messages: []models.Message{
				{Role: "user", Content: "Write a haiku"},
			},
			Stream: true,
		}

		ctx := context.Background()
		chunkChan, errChan := provider.InferStream(ctx, req)

		chunkCount := 0
		for chunk := range chunkChan {
			chunkCount++
			if chunk == nil {
				t.Error("Received nil chunk")
			}
		}

		select {
		case err := <-errChan:
			if err != nil {
				t.Fatalf("Streaming error: %v", err)
			}
		default:
		}

		if chunkCount == 0 {
			t.Error("No chunks received")
		}

		t.Logf("Received %d chunks", chunkCount)
	})

	t.Run("Cost estimation for different models", func(t *testing.T) {
		provider, _ := anthropic.NewBenchmarkAnthropicProvider(nil)

		models := []string{"claude-3-opus", "claude-3-sonnet", "claude-3-haiku"}

		for _, model := range models {
			req := &models.InferRequest{
				Model: model,
				Messages: []models.Message{
					{Role: "user", Content: "Test message"},
				},
				MaxTokens: 500,
			}

			cost, err := provider.EstimateCost(req)
			if err != nil {
				t.Fatalf("Cost estimation failed for %s: %v", model, err)
			}

			if cost <= 0 {
				t.Errorf("Estimated cost for %s should be greater than 0", model)
			}

			t.Logf("Model %s estimated cost: $%.6f", model, cost)
		}
	})
}

// TestProviderCostModel tests the centralized cost model
func TestProviderCostModel(t *testing.T) {
	costModel := providers.NewCostModel()

	t.Run("OpenAI pricing", func(t *testing.T) {
		cost, err := costModel.EstimateCost("openai", "gpt-4", 1000, 500)
		if err != nil {
			t.Fatalf("Cost estimation failed: %v", err)
		}

		// GPT-4: $0.03/1K input + $0.06/1K output
		// Expected: (1000/1000 * 0.03) + (500/1000 * 0.06) = 0.03 + 0.03 = 0.06
		expected := 0.06
		if cost != expected {
			t.Errorf("Expected cost $%.6f, got $%.6f", expected, cost)
		}
	})

	t.Run("Anthropic pricing", func(t *testing.T) {
		cost, err := costModel.EstimateCost("anthropic", "claude-3-haiku", 1000, 500)
		if err != nil {
			t.Fatalf("Cost estimation failed: %v", err)
		}

		// Haiku: $0.00025/1K input + $0.00125/1K output
		// Expected: (1000/1000 * 0.00025) + (500/1000 * 0.00125) = 0.00025 + 0.000625 = 0.000875
		expected := 0.000875
		if cost != expected {
			t.Errorf("Expected cost $%.6f, got $%.6f", expected, cost)
		}
	})

	t.Run("Pricing table lookup", func(t *testing.T) {
		pricing, exists := costModel.GetPricing("openai", "gpt-3.5-turbo")
		if !exists {
			t.Error("Pricing for gpt-3.5-turbo should exist")
		}

		if pricing.InputPer1kTokens <= 0 {
			t.Error("Input pricing should be greater than 0")
		}

		t.Logf("GPT-3.5 pricing: input=$%.6f/1K, output=$%.6f/1K",
			pricing.InputPer1kTokens, pricing.OutputPer1kTokens)
	})
}

// TestProviderFallback tests provider fallback behavior
func TestProviderFallback(t *testing.T) {
	t.Run("OpenAI benchmark with optimizer", func(t *testing.T) {
		provider, _ := openai.NewBenchmarkOpenAIProvider(nil)

		req := &models.InferRequest{
			Model: "gpt-3.5-turbo",
			Messages: []models.Message{
				{Role: "user", Content: "Test optimizer compatibility"},
			},
		}

		ctx := context.Background()
		resp, err := provider.Infer(ctx, req)

		if err != nil {
			t.Fatalf("Inference failed: %v", err)
		}

		// Verify metadata includes routing information
		if resp.Metadata.Provider != "benchmark-openai" {
			t.Errorf("Expected provider 'benchmark-openai', got '%s'", resp.Metadata.Provider)
		}

		if resp.Metadata.RouteDecision == "" {
			t.Error("Route decision should be populated")
		}
	})

	t.Run("Anthropic benchmark with optimizer", func(t *testing.T) {
		provider, _ := anthropic.NewBenchmarkAnthropicProvider(nil)

		req := &models.InferRequest{
			Model: "claude-3-opus",
			Messages: []models.Message{
				{Role: "user", Content: "Test optimizer integration"},
			},
		}

		ctx := context.Background()
		resp, err := provider.Infer(ctx, req)

		if err != nil {
			t.Fatalf("Inference failed: %v", err)
		}

		if resp.Metadata.Provider != "benchmark-anthropic" {
			t.Errorf("Expected provider 'benchmark-anthropic', got '%s'", resp.Metadata.Provider)
		}
	})
}

// TestLatencyProfiles tests realistic latency simulation
func TestLatencyProfiles(t *testing.T) {
	t.Run("GPT-4 latency profile", func(t *testing.T) {
		profile := providers.GetLatencyProfile("openai", "gpt-4")

		if profile == nil {
			t.Fatal("Latency profile is nil")
		}

		// GPT-4 should have higher latency than GPT-3.5
		if profile.AvgLatencyMs < 1000 {
			t.Logf("Note: GPT-4 avg latency (%dms) seems low", profile.AvgLatencyMs)
		}

		t.Logf("GPT-4 profile: avg=%dms, p50=%dms, p95=%dms, TTFT=%v",
			profile.AvgLatencyMs, profile.P50LatencyMs, profile.P95LatencyMs, profile.TTFT)
	})

	t.Run("Claude Haiku latency profile", func(t *testing.T) {
		profile := providers.GetLatencyProfile("anthropic", "claude-3-haiku")

		if profile == nil {
			t.Fatal("Latency profile is nil")
		}

		// Haiku should be fast
		if profile.AvgLatencyMs > 1000 {
			t.Logf("Note: Haiku avg latency (%dms) seems high", profile.AvgLatencyMs)
		}

		t.Logf("Haiku profile: avg=%dms, p50=%dms, p95=%dms, TTFT=%v",
			profile.AvgLatencyMs, profile.P50LatencyMs, profile.P95LatencyMs, profile.TTFT)
	})
}

// BenchmarkProviderPerformance benchmarks the provider performance
func BenchmarkProviderPerformance(b *testing.B) {
	b.Run("OpenAI Benchmark", func(b *testing.B) {
		provider, _ := openai.NewBenchmarkOpenAIProvider(nil)
		req := &models.InferRequest{
			Model: "gpt-3.5-turbo",
			Messages: []models.Message{
				{Role: "user", Content: "Benchmark test"},
			},
		}

		ctx := context.Background()
		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			_, err := provider.Infer(ctx, req)
			if err != nil {
				b.Fatalf("Inference failed: %v", err)
			}
		}
	})

	b.Run("Anthropic Benchmark", func(b *testing.B) {
		provider, _ := anthropic.NewBenchmarkAnthropicProvider(nil)
		req := &models.InferRequest{
			Model: "claude-3-haiku",
			Messages: []models.Message{
				{Role: "user", Content: "Benchmark test"},
			},
		}

		ctx := context.Background()
		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			_, err := provider.Infer(ctx, req)
			if err != nil {
				b.Fatalf("Inference failed: %v", err)
			}
		}
	})
}
