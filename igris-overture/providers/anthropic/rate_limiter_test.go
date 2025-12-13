package anthropic

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestRateLimiter_BasicFunctionality(t *testing.T) {
	config := &RateLimiterConfig{
		RequestsPerMinute: 60, // 1 request per second
		TokensPerMinute:   6000,
		MaxQueueSize:      10,
		BackoffBaseMs:     100,
		MaxRetries:        3,
		JitterMaxMs:       50,
		Enabled:           true,
	}

	rl := NewRateLimiter(config)
	defer rl.Close()

	ctx := context.Background()

	// Test basic wait
	err := rl.Wait(ctx, 100)
	if err != nil {
		t.Fatalf("Wait failed: %v", err)
	}

	// Verify we can make requests
	requestCount := 0
	err = rl.ExecuteWithRetry(ctx, 100, func() (bool, error) {
		requestCount++
		return false, nil // Success, not a rate limit
	})

	if err != nil {
		t.Fatalf("ExecuteWithRetry failed: %v", err)
	}

	if requestCount != 1 {
		t.Errorf("Expected 1 request, got %d", requestCount)
	}
}

func TestRateLimiter_Queueing(t *testing.T) {
	config := &RateLimiterConfig{
		RequestsPerMinute: 6, // Very low - 1 request per 10 seconds
		TokensPerMinute:   6000,
		MaxQueueSize:      5,
		BackoffBaseMs:     100,
		MaxRetries:        3,
		JitterMaxMs:       50,
		Enabled:           true,
	}

	rl := NewRateLimiter(config)
	defer rl.Close()

	ctx := context.Background()

	// Concurrent requests should queue
	var wg sync.WaitGroup
	successCount := 0
	var mu sync.Mutex

	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			err := rl.Wait(ctx, 100)
			if err == nil {
				mu.Lock()
				successCount++
				mu.Unlock()
			}
		}()
	}

	// Wait for all goroutines with timeout
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// Success
	case <-time.After(5 * time.Second):
		t.Fatal("Timeout waiting for queued requests")
	}

	if successCount < 1 {
		t.Errorf("Expected at least 1 successful request, got %d", successCount)
	}
}

// rateLimitError is a test error type
type rateLimitError struct{}

func (e *rateLimitError) Error() string { return "rate limit exceeded" }

func TestRateLimiter_Retry(t *testing.T) {
	config := &RateLimiterConfig{
		RequestsPerMinute: 60,
		TokensPerMinute:   6000,
		MaxQueueSize:      10,
		BackoffBaseMs:     50,
		MaxRetries:        3,
		JitterMaxMs:       20,
		Enabled:           true,
	}

	rl := NewRateLimiter(config)
	defer rl.Close()

	ctx := context.Background()

	// Simulate rate limit errors
	attemptCount := 0
	err := rl.ExecuteWithRetry(ctx, 100, func() (bool, error) {
		attemptCount++
		if attemptCount < 2 {
			return true, &rateLimitError{} // Rate limit error
		}
		return false, nil // Success
	})

	if err != nil {
		t.Fatalf("ExecuteWithRetry should succeed after retry: %v", err)
	}

	if attemptCount != 2 {
		t.Errorf("Expected 2 attempts, got %d", attemptCount)
	}

	// Verify metrics
	metrics := rl.GetMetrics()
	if metrics.RetryAttempts == 0 {
		t.Error("Expected retry attempts to be recorded")
	}
}

func TestRateLimiter_Disabled(t *testing.T) {
	config := &RateLimiterConfig{
		RequestsPerMinute: 1,  // Very restrictive
		TokensPerMinute:   100,
		MaxQueueSize:      1,
		BackoffBaseMs:     1000,
		MaxRetries:        1,
		JitterMaxMs:       0,
		Enabled:           false, // Disabled
	}

	rl := NewRateLimiter(config)
	defer rl.Close()

	ctx := context.Background()

	// With rate limiting disabled, all requests should succeed immediately
	start := time.Now()
	for i := 0; i < 10; i++ {
		err := rl.Wait(ctx, 100)
		if err != nil {
			t.Fatalf("Wait should succeed when disabled: %v", err)
		}
	}
	elapsed := time.Since(start)

	// Should complete almost instantly (< 100ms)
	if elapsed > 100*time.Millisecond {
		t.Errorf("With rate limiting disabled, 10 requests took %v, expected < 100ms", elapsed)
	}
}

func TestRateLimiter_ContextCancellation(t *testing.T) {
	config := &RateLimiterConfig{
		RequestsPerMinute: 1, // Very low to force queueing
		TokensPerMinute:   100,
		MaxQueueSize:      10,
		BackoffBaseMs:     100,
		MaxRetries:        3,
		JitterMaxMs:       50,
		Enabled:           true,
	}

	rl := NewRateLimiter(config)
	defer rl.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Exhaust the rate limiter
	rl.Wait(context.Background(), 100)

	// Next request should timeout
	err := rl.Wait(ctx, 100)
	if err == nil {
		t.Error("Expected error when context times out")
	}
}

func TestRateLimiter_Metrics(t *testing.T) {
	config := DefaultRateLimiterConfig()
	rl := NewRateLimiter(config)
	defer rl.Close()

	ctx := context.Background()

	// Make a request
	err := rl.Wait(ctx, 100)
	if err != nil {
		t.Fatalf("Wait failed: %v", err)
	}

	// Check metrics
	metrics := rl.GetMetrics()

	if metrics.RequestTokens <= 0 {
		t.Error("Expected positive request tokens")
	}

	if metrics.TokenBudget <= 0 {
		t.Error("Expected positive token budget")
	}
}

func TestRateLimiter_ExponentialBackoff(t *testing.T) {
	config := &RateLimiterConfig{
		RequestsPerMinute: 60,
		TokensPerMinute:   6000,
		MaxQueueSize:      10,
		BackoffBaseMs:     100,
		MaxRetries:        3,
		JitterMaxMs:       10,
		Enabled:           true,
	}

	rl := NewRateLimiter(config)

	// Test backoff calculation
	backoff1 := rl.calculateBackoff(0)
	backoff2 := rl.calculateBackoff(1)
	backoff3 := rl.calculateBackoff(2)

	// Each backoff should be roughly double (with jitter)
	if backoff2 < backoff1 {
		t.Errorf("Expected increasing backoff, got %v -> %v", backoff1, backoff2)
	}

	if backoff3 < backoff2 {
		t.Errorf("Expected increasing backoff, got %v -> %v", backoff2, backoff3)
	}

	// Verify backoff is within reasonable bounds
	if backoff1 < 100*time.Millisecond || backoff1 > 200*time.Millisecond {
		t.Errorf("Backoff 1 out of expected range: %v", backoff1)
	}
}
