package optimizer

// This file provides an example of how to integrate the shadow runner
// into your inference router.

import (
	"context"
	"fmt"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/ffi"
	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/shadow"
)

// ExampleRouterWithShadow demonstrates how to integrate shadow mode
func ExampleRouterWithShadow() error {
	// Load optimizer configuration from environment
	optConfig := config.LoadOptimizerConfig()
	shadowConfig := config.CreateShadowConfig(optConfig)

	// Initialize shadow runner
	runner, err := shadow.NewShadowRunner(shadowConfig)
	if err != nil {
		return fmt.Errorf("failed to initialize shadow runner: %w", err)
	}
	defer runner.Close()

	// Example: Handle an inference request
	ctx := context.Background()

	// 1. Your existing Go router logic makes a decision
	goDecision := shadow.DecisionResult{
		ModelID:   "openai/gpt-4",
		LatencyMs: 150,
		CostUsd:   0.003,
		Source:    "go",
	}

	// 2. Run shadow comparison (non-blocking, logs to file)
	req := shadow.DecisionRequest{
		TraceID: "trace-123",
		AvailableModels: []string{
			"openai/gpt-4",
			"anthropic/claude-3-5-sonnet",
			"anthropic/claude-3-opus",
		},
		Policy: "cost-optimized",
	}

	if err := runner.RunShadowComparison(ctx, req, goDecision); err != nil {
		// Log error but don't fail the request
		fmt.Printf("Shadow comparison failed: %v\n", err)
	}

	// 3. Later, after request completes, update optimizer with feedback
	metrics := ffi.RewardMetrics{
		LatencyMs:    float64(goDecision.LatencyMs),
		Success:      true,
		CacheHit:     false,
		CostUsd:      goDecision.CostUsd,
		QualityScore: nil,
	}

	if err := runner.UpdateMetrics(ctx, goDecision.ModelID, metrics); err != nil {
		fmt.Printf("Failed to update metrics: %v\n", err)
	}

	// 4. Your Go router continues with the original decision
	// The shadow comparison happens in parallel and doesn't affect routing

	return nil
}

// ExampleGetOptimizerStats shows how to retrieve optimizer statistics
func ExampleGetOptimizerStats(runner *shadow.ShadowRunner) error {
	stats, err := runner.GetStats()
	if err != nil {
		return fmt.Errorf("failed to get stats: %w", err)
	}

	fmt.Println("Optimizer Arm Statistics:")
	for _, stat := range stats {
		fmt.Printf("  %s: pulls=%d, mean_reward=%.3f, alpha=%.2f, beta=%.2f\n",
			stat.ActionID, stat.Pulls, stat.MeanReward, stat.Alpha, stat.Beta)
	}

	return nil
}

// ExampleExportOptimizerState shows how to export optimizer state
func ExampleExportOptimizerState(runner *shadow.ShadowRunner) error {
	state, err := runner.ExportState()
	if err != nil {
		return fmt.Errorf("failed to export state: %w", err)
	}

	fmt.Printf("Optimizer state:\n%s\n", state)

	// You can persist this state to Redis, PostgreSQL, or file system
	// for recovery or analysis

	return nil
}
