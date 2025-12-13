package anthropic

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"
)

// RateLimiterConfig holds rate limiting configuration
type RateLimiterConfig struct {
	RequestsPerMinute int           // Max requests per minute (e.g., 50 for Anthropic)
	TokensPerMinute   int           // Max tokens per minute (e.g., 400000)
	MaxQueueSize      int           // Max requests to queue before rejecting
	BackoffBaseMs     int           // Base backoff in milliseconds (e.g., 200)
	MaxRetries        int           // Max retries for rate limit errors (e.g., 5)
	JitterMaxMs       int           // Max jitter to add to backoff (e.g., 100)
	Enabled           bool          // Enable/disable rate limiting
}

// DefaultRateLimiterConfig returns sensible defaults for Anthropic
func DefaultRateLimiterConfig() *RateLimiterConfig {
	return &RateLimiterConfig{
		RequestsPerMinute: 50,    // Anthropic's typical rate limit
		TokensPerMinute:   400000, // Anthropic's token limit
		MaxQueueSize:      100,   // Buffer up to 100 requests
		BackoffBaseMs:     200,   // Start with 200ms backoff
		MaxRetries:        5,     // Up to 5 retries for rate limits
		JitterMaxMs:       100,   // Add up to 100ms random jitter
		Enabled:           true,  // Enabled by default
	}
}

// RateLimiter implements token bucket rate limiting with request queuing
type RateLimiter struct {
	config *RateLimiterConfig

	// Request-based rate limiting
	requestTokens     float64
	requestTokensMax  float64
	requestRefillRate float64 // tokens per second

	// Token-based rate limiting (for API tokens)
	tokenBudget       float64
	tokenBudgetMax    float64
	tokenRefillRate   float64 // tokens per second

	lastRefill        time.Time
	mu                sync.Mutex

	// Request queue
	queue             chan *queuedRequest
	queueWaitTime     time.Duration // Average wait time

	// Metrics
	rateLimitHits     int64
	retryAttempts     int64
	queuedRequests    int64
	rejectedRequests  int64

	// Random source for jitter
	rng               *rand.Rand
}

// queuedRequest represents a request waiting in the queue
type queuedRequest struct {
	ctx       context.Context
	callback  func() error
	result    chan error
	queueTime time.Time
}

// NewRateLimiter creates a new rate limiter instance
func NewRateLimiter(config *RateLimiterConfig) *RateLimiter {
	if config == nil {
		config = DefaultRateLimiterConfig()
	}

	rl := &RateLimiter{
		config:            config,
		requestTokensMax:  float64(config.RequestsPerMinute),
		requestTokens:     float64(config.RequestsPerMinute), // Start full
		requestRefillRate: float64(config.RequestsPerMinute) / 60.0, // per second
		tokenBudgetMax:    float64(config.TokensPerMinute),
		tokenBudget:       float64(config.TokensPerMinute), // Start full
		tokenRefillRate:   float64(config.TokensPerMinute) / 60.0, // per second
		lastRefill:        time.Now(),
		queue:             make(chan *queuedRequest, config.MaxQueueSize),
		rng:               rand.New(rand.NewSource(time.Now().UnixNano())),
	}

	// Start queue processor
	go rl.processQueue()

	return rl
}

// processQueue continuously processes queued requests
func (rl *RateLimiter) processQueue() {
	for qr := range rl.queue {
		cancelled := false

		// Wait for rate limit availability
		for !cancelled {
			select {
			case <-qr.ctx.Done():
				qr.result <- qr.ctx.Err()
				cancelled = true
			default:
			}

			if cancelled {
				break
			}

			if rl.tryAcquire(1, 0) {
				break
			}
			time.Sleep(50 * time.Millisecond) // Poll every 50ms
		}

		// If not cancelled, execute the request
		if !cancelled {
			// Execute the request
			err := qr.callback()

			// Record queue wait time
			waitTime := time.Since(qr.queueTime)
			rl.mu.Lock()
			rl.queueWaitTime = (rl.queueWaitTime + waitTime) / 2 // Running average
			rl.mu.Unlock()

			qr.result <- err
		}

		close(qr.result)
	}
}

// refill updates token buckets based on elapsed time
func (rl *RateLimiter) refill() {
	now := time.Now()
	elapsed := now.Sub(rl.lastRefill).Seconds()

	// Refill request tokens
	rl.requestTokens = math.Min(
		rl.requestTokensMax,
		rl.requestTokens+(rl.requestRefillRate*elapsed),
	)

	// Refill token budget
	rl.tokenBudget = math.Min(
		rl.tokenBudgetMax,
		rl.tokenBudget+(rl.tokenRefillRate*elapsed),
	)

	rl.lastRefill = now
}

// tryAcquire attempts to acquire tokens without blocking
func (rl *RateLimiter) tryAcquire(requests int, tokens int) bool {
	if !rl.config.Enabled {
		return true // Rate limiting disabled
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	rl.refill()

	// Check if we have enough request tokens
	if rl.requestTokens < float64(requests) {
		return false
	}

	// Check if we have enough API tokens
	if tokens > 0 && rl.tokenBudget < float64(tokens) {
		return false
	}

	// Consume tokens
	rl.requestTokens -= float64(requests)
	if tokens > 0 {
		rl.tokenBudget -= float64(tokens)
	}

	return true
}

// Wait blocks until rate limit allows the request
func (rl *RateLimiter) Wait(ctx context.Context, estimatedTokens int) error {
	if !rl.config.Enabled {
		return nil // Rate limiting disabled
	}

	// Try immediate acquisition
	if rl.tryAcquire(1, estimatedTokens) {
		return nil
	}

	// Queue the request
	qr := &queuedRequest{
		ctx:       ctx,
		callback:  func() error { return nil }, // No-op, already acquired in processQueue
		result:    make(chan error, 1),
		queueTime: time.Now(),
	}

	select {
	case rl.queue <- qr:
		rl.mu.Lock()
		rl.queuedRequests++
		rl.mu.Unlock()
	case <-ctx.Done():
		return ctx.Err()
	default:
		// Queue full
		rl.mu.Lock()
		rl.rejectedRequests++
		rl.mu.Unlock()
		return fmt.Errorf("rate limiter queue full (max: %d)", rl.config.MaxQueueSize)
	}

	// Wait for result
	select {
	case err := <-qr.result:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// ExecuteWithRetry executes a function with rate-limit-aware retry logic
func (rl *RateLimiter) ExecuteWithRetry(ctx context.Context, estimatedTokens int, fn func() (bool, error)) error {
	if !rl.config.Enabled {
		// Rate limiting disabled, execute directly
		_, err := fn()
		return err
	}

	var lastErr error

	for attempt := 0; attempt <= rl.config.MaxRetries; attempt++ {
		// Wait for rate limit availability
		if err := rl.Wait(ctx, estimatedTokens); err != nil {
			return fmt.Errorf("rate limiter wait failed: %w", err)
		}

		// Execute the function
		isRateLimit, err := fn()
		if err == nil {
			return nil // Success
		}

		lastErr = err

		// If it's a rate limit error (HTTP 429), apply backoff
		if isRateLimit {
			rl.mu.Lock()
			rl.rateLimitHits++
			rl.retryAttempts++
			rl.mu.Unlock()

			if attempt < rl.config.MaxRetries {
				backoff := rl.calculateBackoff(attempt)

				select {
				case <-time.After(backoff):
					continue
				case <-ctx.Done():
					return ctx.Err()
				}
			}
		} else {
			// Non-rate-limit error, don't retry
			return err
		}
	}

	return fmt.Errorf("max retries (%d) exceeded: %w", rl.config.MaxRetries, lastErr)
}

// calculateBackoff returns exponential backoff with jitter
func (rl *RateLimiter) calculateBackoff(attempt int) time.Duration {
	// Exponential: base * 2^attempt
	baseMs := rl.config.BackoffBaseMs
	exponential := baseMs * (1 << uint(attempt))

	// Add random jitter (0 to JitterMaxMs)
	jitter := rl.rng.Intn(rl.config.JitterMaxMs)

	totalMs := exponential + jitter

	// Cap at 30 seconds
	if totalMs > 30000 {
		totalMs = 30000
	}

	return time.Duration(totalMs) * time.Millisecond
}

// GetMetrics returns current rate limiter metrics
func (rl *RateLimiter) GetMetrics() RateLimiterMetrics {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	return RateLimiterMetrics{
		RateLimitHits:    rl.rateLimitHits,
		RetryAttempts:    rl.retryAttempts,
		QueuedRequests:   rl.queuedRequests,
		RejectedRequests: rl.rejectedRequests,
		QueueLength:      len(rl.queue),
		QueueWaitTimeMs:  int64(rl.queueWaitTime.Milliseconds()),
		RequestTokens:    rl.requestTokens,
		TokenBudget:      rl.tokenBudget,
	}
}

// RateLimiterMetrics contains observable metrics
type RateLimiterMetrics struct {
	RateLimitHits    int64
	RetryAttempts    int64
	QueuedRequests   int64
	RejectedRequests int64
	QueueLength      int
	QueueWaitTimeMs  int64
	RequestTokens    float64
	TokenBudget      float64
}

// Close shuts down the rate limiter
func (rl *RateLimiter) Close() {
	close(rl.queue)
}
