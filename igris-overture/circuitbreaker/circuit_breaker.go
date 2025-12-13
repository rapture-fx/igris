// Package circuitbreaker implements circuit breaker pattern for provider fault tolerance
package circuitbreaker

import (
	"sync"
	"time"
)

// State represents the circuit breaker state
type State int

const (
	// StateClosed means the circuit is closed and requests are allowed
	StateClosed State = iota
	// StateOpen means the circuit is open and requests are blocked
	StateOpen
	// StateHalfOpen means the circuit is testing if the service recovered
	StateHalfOpen
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	state            State
	failureCount     int
	successCount     int
	lastFailureTime  time.Time
	failureThreshold int           // Open after N consecutive failures
	recoveryTimeout  time.Duration // Time to wait before trying half-open
	mu               sync.RWMutex
}

// Config holds circuit breaker configuration
type Config struct {
	FailureThreshold int           // Default: 3
	RecoveryTimeout  time.Duration // Default: 2 minutes
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(config Config) *CircuitBreaker {
	if config.FailureThreshold <= 0 {
		config.FailureThreshold = 3
	}
	if config.RecoveryTimeout <= 0 {
		config.RecoveryTimeout = 2 * time.Minute
	}

	return &CircuitBreaker{
		state:            StateClosed,
		failureThreshold: config.FailureThreshold,
		recoveryTimeout:  config.RecoveryTimeout,
	}
}

// Allow checks if a request should be allowed through
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		// Allow all requests
		return true

	case StateOpen:
		// Check if recovery timeout has passed
		if time.Since(cb.lastFailureTime) >= cb.recoveryTimeout {
			// Transition to half-open
			cb.state = StateHalfOpen
			cb.successCount = 0
			cb.failureCount = 0
			return true
		}
		// Still open, reject request
		return false

	case StateHalfOpen:
		// Allow one request to test
		return true

	default:
		return false
	}
}

// RecordSuccess records a successful request
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		// Reset failure count on success
		cb.failureCount = 0

	case StateHalfOpen:
		// Count successes in half-open state
		cb.successCount++
		// After 2 consecutive successes, transition to closed
		if cb.successCount >= 2 {
			cb.state = StateClosed
			cb.failureCount = 0
			cb.successCount = 0
		}
	}
}

// RecordFailure records a failed request
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastFailureTime = time.Now()

	switch cb.state {
	case StateClosed:
		cb.failureCount++
		// Open circuit if threshold reached
		if cb.failureCount >= cb.failureThreshold {
			cb.state = StateOpen
		}

	case StateHalfOpen:
		// Any failure in half-open immediately reopens
		cb.state = StateOpen
		cb.failureCount = 0
		cb.successCount = 0
	}
}

// GetState returns the current circuit breaker state (thread-safe)
func (cb *CircuitBreaker) GetState() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// GetFailureCount returns the current failure count (thread-safe)
func (cb *CircuitBreaker) GetFailureCount() int {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.failureCount
}

// Reset manually resets the circuit breaker to closed state
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = StateClosed
	cb.failureCount = 0
	cb.successCount = 0
}

// ProviderCircuitBreakers manages circuit breakers for multiple providers
type ProviderCircuitBreakers struct {
	breakers map[string]*CircuitBreaker
	config   Config
	mu       sync.RWMutex
}

// NewProviderCircuitBreakers creates a new manager for provider circuit breakers
func NewProviderCircuitBreakers(config Config) *ProviderCircuitBreakers {
	return &ProviderCircuitBreakers{
		breakers: make(map[string]*CircuitBreaker),
		config:   config,
	}
}

// GetOrCreate gets or creates a circuit breaker for a provider
func (pcb *ProviderCircuitBreakers) GetOrCreate(providerID string) *CircuitBreaker {
	pcb.mu.RLock()
	if breaker, exists := pcb.breakers[providerID]; exists {
		pcb.mu.RUnlock()
		return breaker
	}
	pcb.mu.RUnlock()

	// Create new circuit breaker
	pcb.mu.Lock()
	defer pcb.mu.Unlock()

	// Double-check after acquiring write lock
	if breaker, exists := pcb.breakers[providerID]; exists {
		return breaker
	}

	breaker := NewCircuitBreaker(pcb.config)
	pcb.breakers[providerID] = breaker
	return breaker
}

// GetState returns the state of a provider's circuit breaker
func (pcb *ProviderCircuitBreakers) GetState(providerID string) State {
	pcb.mu.RLock()
	defer pcb.mu.RUnlock()

	if breaker, exists := pcb.breakers[providerID]; exists {
		return breaker.GetState()
	}
	return StateClosed // Non-existent breakers are considered closed
}

// IsProviderAvailable checks if a provider is available (circuit not open)
func (pcb *ProviderCircuitBreakers) IsProviderAvailable(providerID string) bool {
	breaker := pcb.GetOrCreate(providerID)
	return breaker.Allow()
}

// RecordSuccess records a success for a provider
func (pcb *ProviderCircuitBreakers) RecordSuccess(providerID string) {
	breaker := pcb.GetOrCreate(providerID)
	breaker.RecordSuccess()
}

// RecordFailure records a failure for a provider
func (pcb *ProviderCircuitBreakers) RecordFailure(providerID string) {
	breaker := pcb.GetOrCreate(providerID)
	breaker.RecordFailure()
}

// Reset resets a provider's circuit breaker
func (pcb *ProviderCircuitBreakers) Reset(providerID string) {
	breaker := pcb.GetOrCreate(providerID)
	breaker.Reset()
}

// GetStats returns statistics for all circuit breakers
func (pcb *ProviderCircuitBreakers) GetStats() map[string]map[string]interface{} {
	pcb.mu.RLock()
	defer pcb.mu.RUnlock()

	stats := make(map[string]map[string]interface{})
	for providerID, breaker := range pcb.breakers {
		stats[providerID] = map[string]interface{}{
			"state":         breaker.GetState().String(),
			"failure_count": breaker.GetFailureCount(),
		}
	}
	return stats
}
