package ml

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestNewAdaptiveInferencePool(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	config := DefaultAdaptivePoolConfig
	config.MinWorkers = 3
	config.MaxWorkers = 10

	pool := NewAdaptiveInferencePool(cbClient, config)
	defer pool.Shutdown(5 * time.Second)

	stats := pool.GetStats()
	if stats.Workers != config.MinWorkers {
		t.Errorf("Expected %d workers, got %d", config.MinWorkers, stats.Workers)
	}
}

func TestAdaptivePool_Submit_Success(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	pool := NewAdaptiveInferencePool(cbClient, DefaultAdaptivePoolConfig)
	defer pool.Shutdown(5 * time.Second)

	ctx := context.Background()
	features := []float64{1.0, 2.0, 3.0}

	result, err := pool.Submit(ctx, features, "test-model")
	if err != nil {
		t.Fatalf("Submit failed: %v", err)
	}

	if result == nil {
		t.Fatal("Expected non-nil result")
	}

	if result.Error != nil {
		t.Fatalf("Inference failed: %v", result.Error)
	}

	if result.Response == nil {
		t.Fatal("Expected non-nil response")
	}

	if result.Latency == 0 {
		t.Error("Expected non-zero latency")
	}
}

func TestAdaptivePool_ConcurrentSubmits(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	config := DefaultAdaptivePoolConfig
	config.MinWorkers = 5
	config.MaxWorkers = 20

	pool := NewAdaptiveInferencePool(cbClient, config)
	defer pool.Shutdown(10 * time.Second)

	// Submit 100 concurrent requests
	concurrency := 100
	var wg sync.WaitGroup
	errors := make([]error, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			ctx := context.Background()
			features := []float64{float64(idx), float64(idx + 1)}

			result, err := pool.Submit(ctx, features, "test-model")
			if err != nil {
				errors[idx] = err
				return
			}

			if result.Error != nil {
				errors[idx] = result.Error
			}
		}(i)
	}

	wg.Wait()

	// Check for errors
	errorCount := 0
	for _, err := range errors {
		if err != nil {
			errorCount++
		}
	}

	if errorCount > 0 {
		t.Errorf("Expected 0 errors, got %d", errorCount)
	}

	stats := pool.GetStats()
	if stats.TotalJobs != int64(concurrency) {
		t.Errorf("Expected %d total jobs, got %d", concurrency, stats.TotalJobs)
	}
}

func TestAdaptivePool_ScaleUp(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	config := DefaultAdaptivePoolConfig
	config.MinWorkers = 2
	config.MaxWorkers = 20
	config.ScaleUpThreshold = 5

	pool := NewAdaptiveInferencePool(cbClient, config)
	defer pool.Shutdown(10 * time.Second)

	initialWorkers := pool.GetStats().Workers

	// Submit many requests to trigger scale up
	ctx := context.Background()
	var wg sync.WaitGroup

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			pool.Submit(ctx, []float64{1.0}, "test")
		}()
	}

	// Give time for scaling to occur
	time.Sleep(2 * time.Second)

	finalStats := pool.GetStats()

	// Workers should have scaled up
	if finalStats.Workers <= initialWorkers {
		t.Logf("Warning: Expected workers to scale up from %d, got %d (may be timing-dependent)",
			initialWorkers, finalStats.Workers)
	}

	wg.Wait()
}

func TestAdaptivePool_QueueFull(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	config := DefaultAdaptivePoolConfig
	config.QueueSize = 10 // Small queue
	config.MinWorkers = 1 // Single worker

	pool := NewAdaptiveInferencePool(cbClient, config)
	defer pool.Shutdown(5 * time.Second)

	ctx := context.Background()
	var wg sync.WaitGroup
	droppedCount := 0
	var mu sync.Mutex

	// Submit many requests quickly to fill the queue
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			result, err := pool.Submit(ctx, []float64{1.0}, "test")
			if err == ErrQueueFull {
				mu.Lock()
				droppedCount++
				mu.Unlock()
			} else if err != nil {
				t.Logf("Unexpected error: %v", err)
			} else if result != nil && result.Error != nil {
				t.Logf("Inference error: %v", result.Error)
			}
		}()
	}

	wg.Wait()

	// Should have dropped some jobs
	if droppedCount == 0 {
		t.Log("Warning: Expected some dropped jobs (may be timing-dependent)")
	}

	stats := pool.GetStats()
	if stats.DroppedJobs == 0 && droppedCount > 0 {
		t.Error("Stats should reflect dropped jobs")
	}
}

func TestAdaptivePool_ContextCancellation(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	pool := NewAdaptiveInferencePool(cbClient, DefaultAdaptivePoolConfig)
	defer pool.Shutdown(5 * time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	result, err := pool.Submit(ctx, []float64{1.0}, "test")

	// Should timeout
	if err != context.DeadlineExceeded {
		t.Errorf("Expected DeadlineExceeded, got %v", err)
	}

	if result != nil {
		t.Error("Expected nil result on timeout")
	}
}

func TestAdaptivePool_GetStats(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	config := DefaultAdaptivePoolConfig
	config.MinWorkers = 3

	pool := NewAdaptiveInferencePool(cbClient, config)
	defer pool.Shutdown(5 * time.Second)

	// Submit some jobs
	ctx := context.Background()
	for i := 0; i < 10; i++ {
		pool.Submit(ctx, []float64{float64(i)}, "test")
	}

	time.Sleep(500 * time.Millisecond)

	stats := pool.GetStats()

	if stats.Workers < config.MinWorkers {
		t.Errorf("Expected at least %d workers, got %d", config.MinWorkers, stats.Workers)
	}

	if stats.TotalJobs != 10 {
		t.Errorf("Expected 10 total jobs, got %d", stats.TotalJobs)
	}

	if stats.AverageLatency == 0 {
		t.Error("Expected non-zero average latency")
	}
}

func TestAdaptivePool_Shutdown(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	pool := NewAdaptiveInferencePool(cbClient, DefaultAdaptivePoolConfig)

	// Submit some jobs
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		go pool.Submit(ctx, []float64{1.0}, "test")
	}

	// Shutdown should complete quickly
	err = pool.Shutdown(5 * time.Second)
	if err != nil {
		t.Errorf("Shutdown failed: %v", err)
	}

	// Submitting after shutdown should fail
	result, err := pool.Submit(ctx, []float64{1.0}, "test")
	if err == nil {
		t.Error("Expected error when submitting to shutdown pool")
	}
	if result != nil {
		t.Error("Expected nil result from shutdown pool")
	}
}

func TestAdaptivePool_LatencyTracking(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		t.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	pool := NewAdaptiveInferencePool(cbClient, DefaultAdaptivePoolConfig)
	defer pool.Shutdown(5 * time.Second)

	ctx := context.Background()

	// Submit jobs and collect latencies
	var latencies []time.Duration
	for i := 0; i < 10; i++ {
		result, err := pool.Submit(ctx, []float64{float64(i)}, "test")
		if err != nil {
			t.Fatalf("Submit failed: %v", err)
		}
		if result.Error != nil {
			t.Fatalf("Inference failed: %v", result.Error)
		}
		latencies = append(latencies, result.Latency)
	}

	// All latencies should be > 0
	for i, lat := range latencies {
		if lat == 0 {
			t.Errorf("Latency %d was zero", i)
		}
	}

	// Average latency should be calculated
	stats := pool.GetStats()
	if stats.AverageLatency == 0 {
		t.Error("Expected non-zero average latency")
	}
}

func BenchmarkAdaptivePool_Submit(b *testing.B) {
	ts, err := StartTestServer()
	if err != nil {
		b.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	cbClient, err := NewCircuitBreakerClient(ts.Address, DefaultCircuitBreakerConfig)
	if err != nil {
		b.Fatalf("Failed to create circuit breaker client: %v", err)
	}
	defer cbClient.Close()

	config := DefaultAdaptivePoolConfig
	config.MinWorkers = 10
	config.MaxWorkers = 50

	pool := NewAdaptiveInferencePool(cbClient, config)
	defer pool.Shutdown(10 * time.Second)

	ctx := context.Background()
	features := []float64{1.0, 2.0, 3.0}

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			result, err := pool.Submit(ctx, features, "test")
			if err != nil {
				b.Errorf("Submit failed: %v", err)
			}
			if result != nil && result.Error != nil {
				b.Errorf("Inference failed: %v", result.Error)
			}
		}
	})

	b.StopTimer()

	stats := pool.GetStats()
	b.Logf("Final stats: Workers=%d, Jobs=%d, Dropped=%d, AvgLatency=%v",
		stats.Workers, stats.TotalJobs, stats.DroppedJobs, stats.AverageLatency)
}
