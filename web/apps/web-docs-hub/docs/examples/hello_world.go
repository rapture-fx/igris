// Igris Inertial — Go hello world
// Requires: go get github.com/igris-inertial/go-sdk
//
// Usage:
//   export IGRIS_API_KEY=igris_...
//   go run hello_world.go

package main

import (
	"context"
	"fmt"
	"log"
	"os"

	igris "github.com/igris-inertial/go-sdk"
)

func main() {
	apiKey := os.Getenv("IGRIS_API_KEY")
	if apiKey == "" {
		log.Fatal("Set IGRIS_API_KEY first: export IGRIS_API_KEY=igris_...")
	}

	client := igris.NewClient("https://overture.igrisinertial.com", apiKey)
	ctx := context.Background()

	resp, err := client.Infer(ctx, &igris.InferRequest{
		Model: "gpt-4",
		Messages: []igris.Message{
			{Role: "user", Content: "Hello! Reply in one sentence."},
		},
	})
	if err != nil {
		log.Fatalf("infer: %v", err)
	}

	fmt.Println(resp.Choices[0].Message.Content)
	if resp.Metadata != nil {
		fmt.Printf("Provider : %s\n", resp.Metadata.Provider)
		fmt.Printf("Latency  : %d ms\n", resp.Metadata.LatencyMs)
		fmt.Printf("Cost     : $%.6f\n", resp.Metadata.CostUSD)
	}
}
