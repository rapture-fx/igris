// Package main demonstrates multi-turn conversation using the Igris Overture Go SDK.
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/Schlep-engine/igris-inertial/igris-overture/sdk/go/igris"
)

func main() {
	client := igris.NewClient(&igris.Config{
		BaseURL: "http://localhost:8081",
	})

	ctx := context.Background()

	// Initialize conversation with system message
	messages := []igris.Message{
		{
			Role:    "system",
			Content: "You are a helpful AI assistant specializing in explaining technical concepts.",
		},
	}

	// First user message
	messages = append(messages, igris.Message{
		Role:    "user",
		Content: "What is machine learning?",
	})

	fmt.Println("User: What is machine learning?")

	// Get first response
	response1, err := client.Infer(ctx, &igris.InferRequest{
		Model:       "gpt-4",
		Messages:    messages,
		MaxTokens:   igris.Int(200),
		Temperature: igris.Float64(0.7),
	})
	if err != nil {
		log.Fatalf("First inference failed: %v", err)
	}

	assistantResponse1 := response1.Choices[0].Message.Content
	fmt.Printf("\nAssistant: %s\n\n", assistantResponse1)

	// Add assistant response to conversation
	messages = append(messages, igris.Message{
		Role:    "assistant",
		Content: assistantResponse1,
	})

	// Second user message
	messages = append(messages, igris.Message{
		Role:    "user",
		Content: "Can you give me a simple example?",
	})

	fmt.Println("User: Can you give me a simple example?")

	// Get second response
	response2, err := client.Infer(ctx, &igris.InferRequest{
		Model:    "gpt-4",
		Messages: messages,
	})
	if err != nil {
		log.Fatalf("Second inference failed: %v", err)
	}

	assistantResponse2 := response2.Choices[0].Message.Content
	fmt.Printf("\nAssistant: %s\n\n", assistantResponse2)

	// Print conversation statistics
	fmt.Println("Conversation Summary:")
	fmt.Printf("  Total messages: %d\n", len(messages)+1) // +1 for last assistant message
	if response2.Usage != nil {
		fmt.Printf("  Total tokens used: %d\n", response2.Usage.TotalTokens)
	}
}
