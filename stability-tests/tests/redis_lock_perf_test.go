package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisLockPerfResult stores the results of the lock performance test
type RedisLockPerfResult struct {
	TotalRequests    int     `json:"total_requests"`
	SuccessfulLocks  int     `json:"successful_locks"`
	FailedLocks      int     `json:"failed_locks"`
	LockSuccessRate  float64 `json:"lock_success_rate"`
	P50LatencyMs     float64 `json:"p50_latency_ms"`
	P95LatencyMs     float64 `json:"p95_latency_ms"`
	P99LatencyMs     float64 `json:"p99_latency_ms"`
	AvgLatencyMs     float64 `json:"avg_latency_ms"`
	MaxLatencyMs     float64 `json:"max_latency_ms"`
	MinLatencyMs     float64 `json:"min_latency_ms"`
	DurationSeconds  float64 `json:"duration_seconds"`
	Status           string  `json:"status"`
	PassFail         string  `json:"pass_fail"`
	Recommendations  []string `json:"recommendations"`
}

// TestRedisDistributedLockPerformance validates Redis lock performance under 10k concurrent requests
func TestRedisDistributedLockPerformance(t *testing.T) {
	// Get Redis URL from environment
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	// Parse Redis URL
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("Failed to parse Redis URL: %v", err)
	}

	// Create Redis client
	client := redis.NewClient(opt)
	defer client.Close()

	// Test connection
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}

	t.Log("Starting Redis distributed lock performance test...")
	t.Log("Target: 10,000 concurrent lock requests with 100ms TTL")

	const (
		totalRequests = 10000
		lockTTL       = 100 * time.Millisecond
		concurrency   = 1000 // concurrent goroutines
	)

	// Tracking variables
	var (
		successCount int64
		failCount    int64
		latencies    = make([]float64, 0, totalRequests)
		latenciesMu  sync.Mutex
		wg           sync.WaitGroup
	)

	startTime := time.Now()

	// Create semaphore for concurrency control
	sem := make(chan struct{}, concurrency)

	// Launch concurrent lock attempts
	for i := 0; i < totalRequests; i++ {
		wg.Add(1)
		sem <- struct{}{} // acquire semaphore

		go func(id int) {
			defer wg.Done()
			defer func() { <-sem }() // release semaphore

			key := fmt.Sprintf("test_lock_%d", id)
			lockStart := time.Now()

			// Attempt to acquire lock using SET NX EX
			result, err := client.SetNX(ctx, key, "locked", lockTTL).Result()
			latency := time.Since(lockStart)

			// Record latency
			latenciesMu.Lock()
			latencies = append(latencies, float64(latency.Microseconds())/1000.0)
			latenciesMu.Unlock()

			// Track success/failure
			if err != nil || !result {
				atomic.AddInt64(&failCount, 1)
			} else {
				atomic.AddInt64(&successCount, 1)
				// Clean up lock
				client.Del(ctx, key)
			}
		}(i)
	}

	// Wait for all goroutines to complete
	wg.Wait()
	duration := time.Since(startTime)

	// Calculate statistics
	successRate := float64(successCount) / float64(totalRequests) * 100

	// Sort latencies for percentile calculation
	sortedLatencies := make([]float64, len(latencies))
	copy(sortedLatencies, latencies)
	// Simple bubble sort (good enough for test)
	for i := 0; i < len(sortedLatencies); i++ {
		for j := i + 1; j < len(sortedLatencies); j++ {
			if sortedLatencies[i] > sortedLatencies[j] {
				sortedLatencies[i], sortedLatencies[j] = sortedLatencies[j], sortedLatencies[i]
			}
		}
	}

	// Calculate percentiles
	p50 := sortedLatencies[len(sortedLatencies)*50/100]
	p95 := sortedLatencies[len(sortedLatencies)*95/100]
	p99 := sortedLatencies[len(sortedLatencies)*99/100]

	// Calculate average
	var sum float64
	for _, lat := range latencies {
		sum += lat
	}
	avg := sum / float64(len(latencies))

	min := sortedLatencies[0]
	max := sortedLatencies[len(sortedLatencies)-1]

	// Determine pass/fail based on acceptance criteria
	passFail := "PASS"
	recommendations := []string{}

	if successRate < 99.9 {
		passFail = "FAIL"
		recommendations = append(recommendations,
			fmt.Sprintf("Lock success rate (%.2f%%) below threshold (99.9%%)", successRate))
		recommendations = append(recommendations, "Consider implementing Redlock algorithm for write operations")
	}

	if p99 > 2.0 {
		if passFail == "PASS" {
			passFail = "WARN"
		}
		recommendations = append(recommendations,
			fmt.Sprintf("P99 latency (%.2fms) exceeds 2ms threshold", p99))
		recommendations = append(recommendations, "Consider Redis connection pooling optimization")
	}

	// Create result object
	result := RedisLockPerfResult{
		TotalRequests:   totalRequests,
		SuccessfulLocks: int(successCount),
		FailedLocks:     int(failCount),
		LockSuccessRate: successRate,
		P50LatencyMs:    p50,
		P95LatencyMs:    p95,
		P99LatencyMs:    p99,
		AvgLatencyMs:    avg,
		MaxLatencyMs:    max,
		MinLatencyMs:    min,
		DurationSeconds: duration.Seconds(),
		Status:          fmt.Sprintf("Completed %d lock attempts in %.2fs", totalRequests, duration.Seconds()),
		PassFail:        passFail,
		Recommendations: recommendations,
	}

	// Print results
	t.Logf("\n=== Redis Lock Performance Results ===")
	t.Logf("Total Requests: %d", result.TotalRequests)
	t.Logf("Successful Locks: %d", result.SuccessfulLocks)
	t.Logf("Failed Locks: %d", result.FailedLocks)
	t.Logf("Success Rate: %.2f%%", result.LockSuccessRate)
	t.Logf("Latency Stats:")
	t.Logf("  Min: %.2fms", result.MinLatencyMs)
	t.Logf("  Avg: %.2fms", result.AvgLatencyMs)
	t.Logf("  P50: %.2fms", result.P50LatencyMs)
	t.Logf("  P95: %.2fms", result.P95LatencyMs)
	t.Logf("  P99: %.2fms", result.P99LatencyMs)
	t.Logf("  Max: %.2fms", result.MaxLatencyMs)
	t.Logf("Duration: %.2fs", result.DurationSeconds)
	t.Logf("Status: %s", result.PassFail)

	if len(result.Recommendations) > 0 {
		t.Logf("\nRecommendations:")
		for _, rec := range result.Recommendations {
			t.Logf("  - %s", rec)
		}
	}

	// Save results to JSON file
	resultJSON, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal results: %v", err)
	}

	// Ensure directory exists
	os.MkdirAll("tests/results", 0755)
	outputPath := "tests/results/redis_lock_perf.json"
	if err := os.WriteFile(outputPath, resultJSON, 0644); err != nil {
		t.Fatalf("Failed to write results: %v", err)
	}
	t.Logf("\nResults saved to: %s", outputPath)

	// Assert based on acceptance criteria
	if result.PassFail == "FAIL" {
		t.Errorf("Redis lock performance test FAILED - see recommendations above")
	} else if result.PassFail == "WARN" {
		t.Logf("WARNING: Redis lock performance has minor issues - see recommendations")
	}
}
