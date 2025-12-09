package router

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"sync/atomic" // P0-7: Added for atomic operations
	"time"

	"github.com/rs/zerolog/log"
)

// CircuitBreakerState represents the current state of a circuit breaker
// P0-7 FIX: Changed to int32 for atomic operations
type CircuitBreakerState int32

const (
	// StateClosed - Circuit is closed, requests flow through
	StateClosed CircuitBreakerState = 0

	// StateOpen - Circuit is open, requests are rejected
	StateOpen CircuitBreakerState = 1

	// StateHalfOpen - Circuit is testing if backend has recovered
	StateHalfOpen CircuitBreakerState = 2
)

func (s CircuitBreakerState) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF_OPEN"
	default:
		return "UNKNOWN"
	}
}

// AdaptiveCircuitBreaker implements adaptive thresholds based on rolling metrics
// P0-7 FIX: Use atomic int32 for state to prevent race conditions
type AdaptiveCircuitBreaker struct {
	config CircuitBreakerConfig
	state int32 // P0-7: atomic int32 instead of CircuitBreakerState with mutex
	stateMu sync.RWMutex // P0-7: Still used for other state fields
	metrics *RollingMetrics
	lastStateChange time.Time
	openedAt time.Time
	halfOpenedAt time.Time
	consecutiveSuccesses int
	consecutiveFailures int
	adaptiveThreshold AdaptiveThreshold
	inflightRequests int32
	inflightMu sync.Mutex
}

// CircuitBreakerConfig holds circuit breaker configuration
type CircuitBreakerConfig struct {
	Name                  string
	FailureThreshold      int
	SuccessThreshold      int
	Timeout               time.Duration
	HalfOpenMaxRequests   int
	WindowSize            time.Duration
	BucketCount           int
	EnableAdaptive        bool
	AdaptiveWindowSize    int
	MinErrorRate          float64
	LatencyThresholdMs    int64
	BaseBackoff           time.Duration
	MaxBackoff            time.Duration
	BackoffMultiplier     float64
	JitterFraction        float64
}

// DefaultCircuitBreakerConfig returns sensible defaults
func DefaultCircuitBreakerConfig(name string) CircuitBreakerConfig {
	return CircuitBreakerConfig{
		Name:                  name,
		FailureThreshold:      5,
		SuccessThreshold:      2,
		Timeout:               30 * time.Second,
		HalfOpenMaxRequests:   3,
		WindowSize:            60 * time.Second,
		BucketCount:           10,
		EnableAdaptive:        true,
		AdaptiveWindowSize:    5,
		MinErrorRate:          0.5,
		LatencyThresholdMs:    200,
		BaseBackoff:           1 * time.Second,
		MaxBackoff:            60 * time.Second,
		BackoffMultiplier:     2.0,
		JitterFraction:        0.1,
	}
}

// AdaptiveThreshold tracks adaptive threshold calculations
type AdaptiveThreshold struct {
	mu                sync.RWMutex
	currentErrorRate  float64
	currentP95Latency int64
	historicalRates   []float64
	historicalLatency []int64
	lastUpdate        time.Time
}

// RollingMetrics tracks metrics in a rolling time window
type RollingMetrics struct {
	mu      sync.RWMutex
	buckets []*MetricsBucket
	config  CircuitBreakerConfig
	currentBucketIndex int
	lastRotation time.Time
}

// MetricsBucket holds metrics for a time bucket
type MetricsBucket struct {
	StartTime        time.Time
	TotalRequests    int64
	SuccessfulReqs   int64
	FailedReqs       int64
	TimeoutReqs      int64
	TotalLatencyMs   int64
	LatencyP50Ms     int64
	LatencyP95Ms     int64
	LatencyP99Ms     int64
	Errors           map[string]int64
}

// NewAdaptiveCircuitBreaker creates a new adaptive circuit breaker
func NewAdaptiveCircuitBreaker(config CircuitBreakerConfig) *AdaptiveCircuitBreaker {
	cb := &AdaptiveCircuitBreaker{
		config:          config,
		state:           int32(StateClosed), // P0-7: Initialize as int32
		lastStateChange: time.Now(),
		metrics:         NewRollingMetrics(config),
		adaptiveThreshold: AdaptiveThreshold{
			historicalRates:   make([]float64, 0, config.AdaptiveWindowSize),
			historicalLatency: make([]int64, 0, config.AdaptiveWindowSize),
			lastUpdate:        time.Now(),
		},
	}

	go cb.monitorMetrics()

	log.Info().
		Str("circuit_breaker", config.Name).
		Str("state", CircuitBreakerState(cb.state).String()).
		Msg("Circuit breaker initialized")

	return cb
}

// Execute wraps a function call with circuit breaker logic
func (cb *AdaptiveCircuitBreaker) Execute(ctx context.Context, fn func() error) error {
	if err := cb.beforeRequest(); err != nil {
		return err
	}

	startTime := time.Now()
	err := fn()
	latencyMs := time.Since(startTime).Milliseconds()

	cb.afterRequest(err, latencyMs)
	return err
}

// beforeRequest checks if request should be allowed
// P0-7 FIX: Use atomic load to read state without lock
func (cb *AdaptiveCircuitBreaker) beforeRequest() error {
	state := CircuitBreakerState(atomic.LoadInt32(&cb.state))

	switch state {
	case StateClosed:
		cb.inflightMu.Lock()
		cb.inflightRequests++
		cb.inflightMu.Unlock()
		return nil

	case StateOpen:
		cb.stateMu.RLock()
		openedAt := cb.openedAt
		cb.stateMu.RUnlock()

		backoff := cb.calculateBackoff()

		if time.Since(openedAt) > backoff {
			cb.transitionTo(StateHalfOpen)
			cb.inflightMu.Lock()
			cb.inflightRequests++
			cb.inflightMu.Unlock()
			return nil
		}

		return fmt.Errorf("circuit breaker %s is OPEN", cb.config.Name)

	case StateHalfOpen:
		cb.inflightMu.Lock()
		defer cb.inflightMu.Unlock()

		if cb.inflightRequests >= int32(cb.config.HalfOpenMaxRequests) {
			return fmt.Errorf("circuit breaker %s is HALF_OPEN with max test requests", cb.config.Name)
		}

		cb.inflightRequests++
		return nil

	default:
		return fmt.Errorf("unknown circuit breaker state: %v", state)
	}
}

// afterRequest records the result of a request
// P0-7 FIX: Move metrics recording OUTSIDE lock to reduce contention
func (cb *AdaptiveCircuitBreaker) afterRequest(err error, latencyMs int64) {
	cb.inflightMu.Lock()
	cb.inflightRequests--
	cb.inflightMu.Unlock()

	// P0-7 FIX: Record metrics BEFORE acquiring lock to reduce contention
	cb.metrics.Record(err, latencyMs)

	// P0-7 FIX: Use atomic load to check current state
	currentState := CircuitBreakerState(atomic.LoadInt32(&cb.state))

	cb.stateMu.Lock()
	defer cb.stateMu.Unlock()

	if err != nil {
		cb.consecutiveFailures++
		cb.consecutiveSuccesses = 0

		if currentState == StateClosed && cb.shouldOpenCircuit() {
			cb.transitionToLocked(StateOpen)
		} else if currentState == StateHalfOpen {
			cb.transitionToLocked(StateOpen)
		}
	} else {
		cb.consecutiveSuccesses++
		cb.consecutiveFailures = 0

		if currentState == StateHalfOpen && cb.consecutiveSuccesses >= cb.config.SuccessThreshold {
			cb.transitionToLocked(StateClosed)
		}
	}
}

// shouldOpenCircuit determines if circuit should open
func (cb *AdaptiveCircuitBreaker) shouldOpenCircuit() bool {
	if cb.consecutiveFailures >= cb.config.FailureThreshold {
		return true
	}

	if cb.config.EnableAdaptive {
		stats := cb.metrics.GetStats()

		if stats.TotalRequests > 0 {
			errorRate := float64(stats.FailedRequests) / float64(stats.TotalRequests)
			if errorRate >= cb.config.MinErrorRate {
				return true
			}
		}

		if stats.LatencyP95Ms > cb.config.LatencyThresholdMs {
			return true
		}
	}

	return false
}

// transitionTo transitions to a new state
func (cb *AdaptiveCircuitBreaker) transitionTo(newState CircuitBreakerState) {
	cb.stateMu.Lock()
	defer cb.stateMu.Unlock()
	cb.transitionToLocked(newState)
}

// transitionToLocked transitions to a new state (must be called with lock held)
// P0-7 FIX: Use atomic CAS to prevent race conditions and flapping
func (cb *AdaptiveCircuitBreaker) transitionToLocked(newState CircuitBreakerState) {
	oldState := CircuitBreakerState(atomic.LoadInt32(&cb.state))

	if oldState == newState {
		return
	}

	// P0-7 FIX: Use Compare-And-Swap to atomically transition state
	// This prevents race conditions where multiple goroutines try to change state simultaneously
	if !atomic.CompareAndSwapInt32(&cb.state, int32(oldState), int32(newState)) {
		// Another goroutine changed the state, abort this transition
		log.Info().
			Str("circuit_breaker", cb.config.Name).
			Str("attempted_transition", oldState.String()+" -> "+newState.String()).
			Msg("Circuit breaker state transition aborted (race detected)")
		return
	}

	cb.lastStateChange = time.Now()

	switch newState {
	case StateOpen:
		cb.openedAt = time.Now()
		cb.consecutiveSuccesses = 0

	case StateHalfOpen:
		cb.halfOpenedAt = time.Now()
		cb.consecutiveSuccesses = 0
		cb.consecutiveFailures = 0

	case StateClosed:
		cb.consecutiveFailures = 0
	}

	log.Info().
		Str("circuit_breaker", cb.config.Name).
		Str("old_state", oldState.String()).
		Str("new_state", newState.String()).
		Msg("Circuit breaker state transition")
}

// calculateBackoff calculates exponential backoff with jitter
func (cb *AdaptiveCircuitBreaker) calculateBackoff() time.Duration {
	cb.stateMu.RLock()
	timeSinceLastChange := time.Since(cb.lastStateChange)
	cb.stateMu.RUnlock()

	retries := int(timeSinceLastChange / cb.config.Timeout)
	backoff := float64(cb.config.BaseBackoff) * math.Pow(cb.config.BackoffMultiplier, float64(retries))

	if backoff > float64(cb.config.MaxBackoff) {
		backoff = float64(cb.config.MaxBackoff)
	}

	jitter := backoff * cb.config.JitterFraction * (rand.Float64()*2 - 1)
	backoffWithJitter := backoff + jitter

	if backoffWithJitter < 0 {
		backoffWithJitter = backoff
	}

	return time.Duration(backoffWithJitter)
}

// GetState returns current circuit breaker state
// P0-7 FIX: Use atomic load instead of lock
func (cb *AdaptiveCircuitBreaker) GetState() CircuitBreakerState {
	return CircuitBreakerState(atomic.LoadInt32(&cb.state))
}

// monitorMetrics updates adaptive thresholds periodically
func (cb *AdaptiveCircuitBreaker) monitorMetrics() {
	ticker := time.NewTicker(cb.config.WindowSize / time.Duration(cb.config.BucketCount))
	defer ticker.Stop()

	for range ticker.C {
		stats := cb.metrics.GetStats()

		cb.adaptiveThreshold.mu.Lock()

		if stats.TotalRequests > 0 {
			cb.adaptiveThreshold.currentErrorRate = float64(stats.FailedRequests) / float64(stats.TotalRequests)
		} else {
			cb.adaptiveThreshold.currentErrorRate = 0
		}

		cb.adaptiveThreshold.currentP95Latency = stats.LatencyP95Ms

		cb.adaptiveThreshold.historicalRates = append(cb.adaptiveThreshold.historicalRates, cb.adaptiveThreshold.currentErrorRate)
		cb.adaptiveThreshold.historicalLatency = append(cb.adaptiveThreshold.historicalLatency, cb.adaptiveThreshold.currentP95Latency)

		if len(cb.adaptiveThreshold.historicalRates) > cb.config.AdaptiveWindowSize {
			cb.adaptiveThreshold.historicalRates = cb.adaptiveThreshold.historicalRates[1:]
		}
		if len(cb.adaptiveThreshold.historicalLatency) > cb.config.AdaptiveWindowSize {
			cb.adaptiveThreshold.historicalLatency = cb.adaptiveThreshold.historicalLatency[1:]
		}

		cb.adaptiveThreshold.lastUpdate = time.Now()
		cb.adaptiveThreshold.mu.Unlock()
	}
}

// NewRollingMetrics creates a new rolling metrics tracker
func NewRollingMetrics(config CircuitBreakerConfig) *RollingMetrics {
	rm := &RollingMetrics{
		config:             config,
		buckets:            make([]*MetricsBucket, config.BucketCount),
		currentBucketIndex: 0,
		lastRotation:       time.Now(),
	}

	for i := 0; i < config.BucketCount; i++ {
		rm.buckets[i] = &MetricsBucket{
			StartTime: time.Now(),
			Errors:    make(map[string]int64),
		}
	}

	go rm.rotateBuckets()
	return rm
}

// Record records a request result
func (rm *RollingMetrics) Record(err error, latencyMs int64) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	bucket := rm.buckets[rm.currentBucketIndex]
	bucket.TotalRequests++
	bucket.TotalLatencyMs += latencyMs

	if err != nil {
		bucket.FailedReqs++
		bucket.Errors[err.Error()]++
	} else {
		bucket.SuccessfulReqs++
	}

	if latencyMs > bucket.LatencyP95Ms {
		bucket.LatencyP95Ms = latencyMs
	}
}

// GetStats aggregates stats across all buckets
func (rm *RollingMetrics) GetStats() MetricsStats {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	var total, successful, failed, timeouts int64
	var totalLatency, maxP95 int64

	for _, bucket := range rm.buckets {
		total += bucket.TotalRequests
		successful += bucket.SuccessfulReqs
		failed += bucket.FailedReqs
		timeouts += bucket.TimeoutReqs
		totalLatency += bucket.TotalLatencyMs

		if bucket.LatencyP95Ms > maxP95 {
			maxP95 = bucket.LatencyP95Ms
		}
	}

	avgLatency := int64(0)
	if total > 0 {
		avgLatency = totalLatency / total
	}

	return MetricsStats{
		TotalRequests:      total,
		SuccessfulRequests: successful,
		FailedRequests:     failed,
		TimeoutRequests:    timeouts,
		AverageLatencyMs:   avgLatency,
		LatencyP95Ms:       maxP95,
	}
}

// MetricsStats holds aggregated statistics
type MetricsStats struct {
	TotalRequests      int64
	SuccessfulRequests int64
	FailedRequests     int64
	TimeoutRequests    int64
	AverageLatencyMs   int64
	LatencyP95Ms       int64
}

// rotateBuckets rotates buckets periodically
func (rm *RollingMetrics) rotateBuckets() {
	bucketDuration := rm.config.WindowSize / time.Duration(rm.config.BucketCount)
	ticker := time.NewTicker(bucketDuration)
	defer ticker.Stop()

	for range ticker.C {
		rm.mu.Lock()

		rm.currentBucketIndex = (rm.currentBucketIndex + 1) % rm.config.BucketCount

		rm.buckets[rm.currentBucketIndex] = &MetricsBucket{
			StartTime: time.Now(),
			Errors:    make(map[string]int64),
		}

		rm.lastRotation = time.Now()
		rm.mu.Unlock()
	}
}

// CircuitBreakerManager manages multiple circuit breakers
type CircuitBreakerManager struct {
	breakers map[string]*AdaptiveCircuitBreaker
	mu       sync.RWMutex
}

// NewCircuitBreakerManager creates a new circuit breaker manager
func NewCircuitBreakerManager() *CircuitBreakerManager {
	return &CircuitBreakerManager{
		breakers: make(map[string]*AdaptiveCircuitBreaker),
	}
}

// GetOrCreate gets or creates a circuit breaker
func (cbm *CircuitBreakerManager) GetOrCreate(name string, config CircuitBreakerConfig) *AdaptiveCircuitBreaker {
	cbm.mu.Lock()
	defer cbm.mu.Unlock()

	if cb, exists := cbm.breakers[name]; exists {
		return cb
	}

	cb := NewAdaptiveCircuitBreaker(config)
	cbm.breakers[name] = cb
	return cb
}

// Prometheus metrics are defined in internal/observability package
// to avoid duplicate registration conflicts
