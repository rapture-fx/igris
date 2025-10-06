package ml

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/sony/gobreaker"
)

// CircuitBreakerClient wraps ML client with circuit breaker protection
type CircuitBreakerClient struct {
	client *Client
	cb     *gobreaker.CircuitBreaker
}

// CircuitBreakerConfig holds circuit breaker configuration
type CircuitBreakerConfig struct {
	Name        string
	MaxRequests uint32        // Requests allowed in half-open state
	Interval    time.Duration // Reset error count interval
	Timeout     time.Duration // Time to wait before half-open
	Threshold   float64       // Error ratio to trip circuit (0.0-1.0)
}

// DefaultCircuitBreakerConfig returns recommended defaults
var DefaultCircuitBreakerConfig = CircuitBreakerConfig{
	Name:        "ML-Service",
	MaxRequests: 3,
	Interval:    10 * time.Second,
	Timeout:     30 * time.Second,
	Threshold:   0.5, // 50% error rate trips circuit
}

// NewCircuitBreakerClient creates a new circuit-breaker protected ML client
func NewCircuitBreakerClient(address string, config CircuitBreakerConfig) (*CircuitBreakerClient, error) {
	client, err := NewClient(address)
	if err != nil {
		return nil, fmt.Errorf("failed to create ML client: %w", err)
	}

	cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        config.Name,
		MaxRequests: config.MaxRequests,
		Interval:    config.Interval,
		Timeout:     config.Timeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			if counts.Requests < 10 {
				return false // Need minimum 10 requests to calculate ratio
			}
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return failureRatio >= config.Threshold
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[Circuit Breaker] %s: %s → %s", name, from, to)
		},
	})

	return &CircuitBreakerClient{
		client: client,
		cb:     cb,
	}, nil
}

// Predict makes a prediction with circuit breaker protection
func (c *CircuitBreakerClient) Predict(ctx context.Context, features []float64, modelId string) (*PredictResponse, error) {
	result, err := c.cb.Execute(func() (interface{}, error) {
		return c.client.Predict(ctx, features, modelId)
	})

	if err != nil {
		// Check if circuit breaker is open
		if err == gobreaker.ErrOpenState {
			return nil, &CircuitBreakerOpenError{
				Service: c.cb.Name,
				State:   c.cb.State().String(),
			}
		}
		return nil, fmt.Errorf("ML prediction failed: %w", err)
	}

	return result.(*PredictResponse), nil
}

// HealthCheck performs health check with circuit breaker
func (c *CircuitBreakerClient) HealthCheck(ctx context.Context) (bool, error) {
	result, err := c.cb.Execute(func() (interface{}, error) {
		return c.client.HealthCheck(ctx)
	})

	if err != nil {
		if err == gobreaker.ErrOpenState {
			return false, &CircuitBreakerOpenError{
				Service: c.cb.Name,
				State:   c.cb.State().String(),
			}
		}
		return false, err
	}

	return result.(bool), nil
}

// GetState returns current circuit breaker state
func (c *CircuitBreakerClient) GetState() gobreaker.State {
	return c.cb.State()
}

// GetCounts returns circuit breaker counts
func (c *CircuitBreakerClient) GetCounts() gobreaker.Counts {
	return c.cb.Counts()
}

// Close closes the underlying ML client connection
func (c *CircuitBreakerClient) Close() error {
	if c.client != nil {
		return c.client.Close()
	}
	return nil
}

// CircuitBreakerOpenError indicates circuit breaker is open
type CircuitBreakerOpenError struct {
	Service string
	State   string
}

func (e *CircuitBreakerOpenError) Error() string {
	return fmt.Sprintf("circuit breaker open for %s (state: %s)", e.Service, e.State)
}

// IsCircuitBreakerOpen checks if error is due to open circuit
func IsCircuitBreakerOpen(err error) bool {
	_, ok := err.(*CircuitBreakerOpenError)
	return ok
}
