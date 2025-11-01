// Package main demonstrates basic usage of the Schlep-engine Go SDK.
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/schlep-engine/sdk-go/schlep"
)

func main() {
	// Create client with default configuration
	// This will use http://localhost:8081 by default
	// or SCHLEP_BASE_URL if set in environment
	client := schlep.NewClient(&schlep.Config{
		BaseURL: "http://localhost:8081",
		APIKey:  os.Getenv("SCHLEP_API_KEY"), // Optional
	})

	ctx := context.Background()

	// Check API health
	fmt.Println("Checking API health...")
	health, err := client.Health(ctx)
	if err != nil {
		log.Fatalf("Health check failed: %v", err)
	}
	fmt.Printf("✓ API Status: %s\n\n", health.Status)

	// List available models
	fmt.Println("Listing available models...")
	models, err := client.ListModels(ctx)
	if err != nil {
		log.Fatalf("Failed to list models: %v", err)
	}

	fmt.Printf("Found %d models:\n", len(models.Data))
	for _, model := range models.Data {
		fmt.Printf("  - %s\n", model.ID)
	}
	fmt.Println()

	// Make an inference request
	fmt.Println("Making inference request...")
	response, err := client.Infer(ctx, &schlep.InferRequest{
		Model: "gpt-4",
		Messages: []schlep.Message{
			{
				Role:    "system",
				Content: "You are a helpful assistant.",
			},
			{
				Role:    "user",
				Content: "Explain what Schlep-engine does in one sentence.",
			},
		},
		MaxTokens:   schlep.Int(100),
		Temperature: schlep.Float64(0.7),
	})

	if err != nil {
		log.Fatalf("Inference failed: %v", err)
	}

	// Print response
	fmt.Println("Response:")
	fmt.Println(response.Choices[0].Message.Content)

	// Print usage statistics
	if response.Usage != nil {
		fmt.Printf("\nTokens used: %d (prompt: %d, completion: %d)\n",
			response.Usage.TotalTokens,
			response.Usage.PromptTokens,
			response.Usage.CompletionTokens,
		)
	}
}
