package main

import (
	"context"
	"fmt"
	"log"

	"github.com/Schlep-engine/igris-inertial/igris-overture/models"
	"github.com/Schlep-engine/igris-inertial/igris-overture/providers"
	"github.com/Schlep-engine/igris-inertial/igris-overture/providers/anthropic"
	"github.com/Schlep-engine/igris-inertial/igris-overture/providers/openai"
)

func main() {
	fmt.Println("=== Phase 11 Benchmark Provider Verification ===\n")

	// Test OpenAI Benchmark Provider
	fmt.Println("1. Testing OpenAI Benchmark Provider...")
	testOpenAI()

	// Test Anthropic Benchmark Provider
	fmt.Println("\n2. Testing Anthropic Benchmark Provider...")
	testAnthropic()

	// Test Cost Model
	fmt.Println("\n3. Testing Cost Model...")
	testCostModel()

	fmt.Println("\n=== All tests passed! ===")
}

func testOpenAI() {
	provider, err := openai.NewBenchmarkOpenAIProvider(nil)
	if err != nil {
		log.Fatalf("Failed to create OpenAI provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Hello!"},
		},
		MaxTokens: 100,
	}

	ctx := context.Background()
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		log.Fatalf("Inference failed: %v", err)
	}

	fmt.Printf("   ✓ Provider name: %s\n", provider.Name())
	fmt.Printf("   ✓ Response tokens: %d\n", resp.Usage.TotalTokens)
	fmt.Printf("   ✓ Cost: $%.6f\n", resp.Metadata.CostUSD)
	fmt.Printf("   ✓ Latency: %dms\n", resp.Metadata.LatencyMs)
}

func testAnthropic() {
	provider, err := anthropic.NewBenchmarkAnthropicProvider(nil)
	if err != nil {
		log.Fatalf("Failed to create Anthropic provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "claude-3-haiku",
		Messages: []models.Message{
			{Role: "user", Content: "Hello Claude!"},
		},
		MaxTokens: 100,
	}

	ctx := context.Background()
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		log.Fatalf("Inference failed: %v", err)
	}

	fmt.Printf("   ✓ Provider name: %s\n", provider.Name())
	fmt.Printf("   ✓ Response tokens: %d\n", resp.Usage.TotalTokens)
	fmt.Printf("   ✓ Cost: $%.6f\n", resp.Metadata.CostUSD)
	fmt.Printf("   ✓ Latency: %dms\n", resp.Metadata.LatencyMs)
}

func testCostModel() {
	costModel := providers.NewCostModel()

	// Test OpenAI pricing
	cost1, err := costModel.EstimateCost("openai", "gpt-4", 1000, 500)
	if err != nil {
		log.Fatalf("Cost estimation failed: %v", err)
	}
	fmt.Printf("   ✓ GPT-4 cost (1K input, 500 output): $%.6f\n", cost1)

	// Test Anthropic pricing
	cost2, err := costModel.EstimateCost("anthropic", "claude-3-haiku", 1000, 500)
	if err != nil {
		log.Fatalf("Cost estimation failed: %v", err)
	}
	fmt.Printf("   ✓ Claude Haiku cost (1K input, 500 output): $%.6f\n", cost2)

	// Verify pricing lookup
	pricing, exists := costModel.GetPricing("openai", "gpt-3.5-turbo")
	if !exists {
		log.Fatal("GPT-3.5 pricing not found")
	}
	fmt.Printf("   ✓ GPT-3.5 pricing: input=$%.6f/1K, output=$%.6f/1K\n",
		pricing.InputPer1kTokens, pricing.OutputPer1kTokens)
}
