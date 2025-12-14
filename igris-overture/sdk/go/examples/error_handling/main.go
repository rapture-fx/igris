// Package main demonstrates error handling with the Igris Overture Go SDK.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/Igris-inertial/system/igris-overture/sdk/go/igris"
)

func main() {
	client := igris.NewClient(&igris.Config{
		BaseURL: "http://localhost:8081",
	})

	ctx := context.Background()

	// Example 1: Handling API errors
	fmt.Println("Example 1: API Error Handling")
	_, err := client.Infer(ctx, &igris.InferRequest{
		Model: "invalid-model",
		Messages: []igris.Message{
			{Role: "user", Content: "Hello"},
		},
	})

	if err != nil {
		var apiErr *igris.APIError
		if errors.As(err, &apiErr) {
			fmt.Printf("  API Error: %s (Status: %d)\n", apiErr.Message, apiErr.StatusCode)
		} else {
			fmt.Printf("  Other Error: %v\n", err)
		}
	}
	fmt.Println()

	// Example 2: Successful request
	fmt.Println("Example 2: Successful Request")
	response, err := client.Infer(ctx, &igris.InferRequest{
		Model: "gpt-4",
		Messages: []igris.Message{
			{Role: "user", Content: "Say hello"},
		},
		MaxTokens: igris.Int(50),
	})

	if err != nil {
		log.Fatalf("Inference failed: %v", err)
	}

	fmt.Printf("  Response: %s\n", response.Choices[0].Message.Content)
	fmt.Println()

	// Example 3: Health check with error handling
	fmt.Println("Example 3: Health Check")
	health, err := client.Health(ctx)
	if err != nil {
		fmt.Printf("  Health check failed: %v\n", err)
	} else {
		fmt.Printf("  Status: %s\n", health.Status)
		if health.Version != "" {
			fmt.Printf("  Version: %s\n", health.Version)
		}
	}
}
