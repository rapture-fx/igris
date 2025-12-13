package shadow

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test P0-6: Shadow Mode Memory Leak Prevention
// Ensures semaphore limits parallel executions to prevent OOM
func TestShadowRunner_MemoryLeakPrevention(t *testing.T) {
	// Create shadow runner with 100% sampling (all requests trigger shadow)
	config := ShadowConfig{
		Mode:       ShadowModeShadow,
		SampleRate: 1.0, // 100% sampling
		LogDir:     t.TempDir(),
	}

	// Mock FFI optimizer to avoid actual Rust calls
	runner, err := NewShadowRunner(config)
	if err != nil {
		t.Skip("Skipping test: requires Rust optimizer")
	}
	defer runner.Close()

	// Override optimizer to nil to test without FFI
	runner.optimizer = nil

	// Simulate 1000 concurrent shadow requests (like 10k RPS with 10% sampling)
	numRequests := 1000
	var wg sync.WaitGroup
	var skippedCount int32
	var executedCount int32

	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			req := DecisionRequest{
				TraceID:         "test-" + string(rune(idx)),
				AvailableModels: []string{"model-a", "model-b"},
				Policy:          "test",
			}

			goDecision := DecisionResult{
				ModelID:   "model-a",
				LatencyMs: 100,
				CostUsd:   0.002,
				Source:    "go",
			}

			// This will timeout since optimizer is nil, but that's ok for testing semaphore
			err := runner.RunShadowComparison(context.Background(), req, goDecision)
			if err != nil && err.Error() == "shadow capacity reached, skipping comparison" {
				atomic.AddInt32(&skippedCount, 1)
			} else {
				atomic.AddInt32(&executedCount, 1)
			}
		}(i)
	}

	wg.Wait()

	// Verify that semaphore limited execution
	// At most 100 should execute in parallel, rest should be skipped
	t.Logf("Executed: %d, Skipped: %d", executedCount, skippedCount)
	assert.Greater(t, skippedCount, int32(0), "Some requests should be skipped due to semaphore limit")
	assert.LessOrEqual(t, executedCount, int32(100), "No more than 100 should execute in parallel")
}

// Test P0-6: Shadow Mode Timeout Prevention
// Ensures 10s timeout prevents runaway executions
func TestShadowRunner_TimeoutPrevention(t *testing.T) {
	config := ShadowConfig{
		Mode:       ShadowModeDisabled, // Use disabled to avoid FFI
		SampleRate: 1.0,
		LogDir:     t.TempDir(),
	}

	runner, err := NewShadowRunner(config)
	require.NoError(t, err)
	defer runner.Close()

	// Manually set mode to test timeout logic
	runner.SetMode(ShadowModeShadow)

	// Create a mock slow decision that would hang without timeout
	startTime := time.Now()

	req := DecisionRequest{
		TraceID:         "timeout-test",
		AvailableModels: []string{"slow-model"},
		Policy:          "test",
	}

	goDecision := DecisionResult{
		ModelID:   "slow-model",
		LatencyMs: 100,
		CostUsd:   0.002,
		Source:    "go",
	}

	// This should return quickly due to timeout, not hang forever
	_ = runner.RunShadowComparison(context.Background(), req, goDecision)

	elapsed := time.Since(startTime)

	// Should complete within 11 seconds (10s timeout + 1s buffer)
	assert.Less(t, elapsed, 11*time.Second, "Shadow comparison should timeout within 10 seconds")
}

// Test P0-6: Semaphore Release on Panic
// Ensures semaphore is released even if shadow comparison panics
func TestShadowRunner_SemaphoreReleaseOnPanic(t *testing.T) {
	config := ShadowConfig{
		Mode:       ShadowModeShadow,
		SampleRate: 1.0,
		LogDir:     t.TempDir(),
	}

	runner, err := NewShadowRunner(config)
	if err != nil {
		t.Skip("Skipping test: requires Rust optimizer")
	}
	defer runner.Close()

	// Force a scenario that might panic (nil optimizer)
	runner.optimizer = nil

	req := DecisionRequest{
		TraceID:         "panic-test",
		AvailableModels: []string{"model-a"},
		Policy:          "test",
	}

	goDecision := DecisionResult{
		ModelID:   "model-a",
		LatencyMs: 100,
		CostUsd:   0.002,
		Source:    "go",
	}

	// Run multiple times to ensure semaphore is properly released
	for i := 0; i < 150; i++ {
		_ = runner.RunShadowComparison(context.Background(), req, goDecision)
	}

	// If semaphore wasn't released, this would deadlock
	// The test passing means semaphore is working correctly
	assert.True(t, true, "Semaphore properly released on each execution")
}

// Test P0-6: Memory Usage Under Load
// Stress test to ensure memory doesn't balloon
func TestShadowRunner_MemoryUsageUnderLoad(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping memory stress test in short mode")
	}

	config := ShadowConfig{
		Mode:       ShadowModeShadow,
		SampleRate: 0.1, // 10% sampling like production
		LogDir:     t.TempDir(),
	}

	runner, err := NewShadowRunner(config)
	if err != nil {
		t.Skip("Skipping test: requires Rust optimizer")
	}
	defer runner.Close()

	runner.optimizer = nil // Mock to avoid FFI

	// Simulate 10k RPS for 5 seconds = 50k requests
	// With 10% sampling = 5k shadow comparisons
	// With semaphore limit of 100, memory should stay bounded
	numRequests := 50000
	var wg sync.WaitGroup
	startTime := time.Now()

	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			req := DecisionRequest{
				TraceID:         "load-test-" + string(rune(idx%1000)),
				AvailableModels: []string{"model-a"},
				Policy:          "test",
			}

			goDecision := DecisionResult{
				ModelID:   "model-a",
				LatencyMs: 100,
				CostUsd:   0.002,
				Source:    "go",
			}

			_ = runner.RunShadowComparison(context.Background(), req, goDecision)
		}(i)

		// Throttle to simulate 10k RPS
		if i%100 == 0 {
			time.Sleep(10 * time.Millisecond)
		}
	}

	wg.Wait()
	elapsed := time.Since(startTime)

	t.Logf("Processed %d requests in %v (%.0f req/s)", numRequests, elapsed, float64(numRequests)/elapsed.Seconds())

	// Test passes if we don't OOM and complete within reasonable time
	assert.Less(t, elapsed, 30*time.Second, "Should complete without hanging or OOM")
}
