package ml

import (
	"context"
	"testing"
	"time"

	"github.com/sony/gobreaker"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestNewCircuitBreakerClient_Success(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	config := DefaultCircuitBreakerConfig
	cbClient, err := NewCircuitBreakerClient(ts.Address, config)
	if err != nil {
		t.Fatalf("NewCircuitBreakerClient() error = %v", err)
	}
	defer cbClient.Close()

	if cbClient.client == nil {
		t.Error("Expected non-nil client")
	}
	if cbClient.cb == nil {
		t.Error("Expected non-nil circuit breaker")
	}

	// Verify initial state is Closed
	if cbClient.GetState() != gobreaker.StateClosed {
		t.Errorf("Initial state = %v, want StateClosed", cbClient.GetState())
	}
}

func TestCircuitBreaker_Predict_Success(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	config := DefaultCircuitBreakerConfig
	cbClient, err := NewCircuitBreakerClient(ts.Address, config)
	if err != nil {
		t.Fatalf("NewCircuitBreakerClient() error = %v", err)
	}
	defer cbClient.Close()

	ctx := context.Background()
	features := []float64{2.0, 3.0, 5.0}

	resp, err := cbClient.Predict(ctx, features, "test-model")
	if err != nil {
		t.Fatalf("Predict() error = %v", err)
	}

	if resp == nil {
		t.Fatal("Expected non-nil response")
	}

	// sum * 0.1 = 10.0 * 0.1 = 1.0
	if resp.Prediction != 1.0 {
		t.Errorf("Prediction = %v, want 1.0", resp.Prediction)
	}

	// Circuit should remain closed
	if cbClient.GetState() != gobreaker.StateClosed {
		t.Errorf("State = %v, want StateClosed after success", cbClient.GetState())
	}
}

func TestCircuitBreaker_StateTransition_ClosedToOpen(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	// Configure circuit breaker with low threshold for faster testing
	config := CircuitBreakerConfig{
		Name:        "Test-CB",
		MaxRequests: 3,
		Interval:    1 * time.Second,
		Timeout:     2 * time.Second,
		Threshold:   0.5, // 50% error rate trips circuit
	}

	cbClient, err := NewCircuitBreakerClient(ts.Address, config)
	if err != nil {
		t.Fatalf("NewCircuitBreakerClient() error = %v", err)
	}
	defer cbClient.Close()

	ctx := context.Background()

	// Make 10 successful requests to establish baseline
	for i := 0; i < 5; i++ {
		_, err := cbClient.Predict(ctx, []float64{1.0}, "test")
		if err != nil {
			t.Fatalf("Initial request %d failed: %v", i, err)
		}
	}

	// Verify circuit is still closed
	if cbClient.GetState() != gobreaker.StateClosed {
		t.Error("Circuit should be closed after successful requests")
	}

	// Configure server to fail
	ts.MockServer.SetShouldFail(true)

	// Make 10 failing requests to trip circuit (need >10 requests at 50% failure rate)
	for i := 0; i < 12; i++ {
		_, _ = cbClient.Predict(ctx, []float64{1.0}, "test")
	}

	// Circuit should now be open
	if cbClient.GetState() != gobreaker.StateOpen {
		t.Errorf("Circuit state = %v, want StateOpen after failures", cbClient.GetState())
	}

	// Verify counts
	counts := cbClient.GetCounts()
	if counts.TotalFailures == 0 {
		t.Error("Expected non-zero failure count")
	}
}

func TestCircuitBreaker_OpenState_ReturnsError(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	config := CircuitBreakerConfig{
		Name:        "Test-CB",
		MaxRequests: 3,
		Interval:    1 * time.Second,
		Timeout:     2 * time.Second,
		Threshold:   0.5,
	}

	cbClient, err := NewCircuitBreakerClient(ts.Address, config)
	if err != nil {
		t.Fatalf("NewCircuitBreakerClient() error = %v", err)
	}
	defer cbClient.Close()

	ctx := context.Background()

	// Trip the circuit by making multiple failing requests
	ts.MockServer.SetShouldFail(true)
	for i := 0; i < 15; i++ {
		_, _ = cbClient.Predict(ctx, []float64{1.0}, "test")
	}

	// Verify circuit is open
	if cbClient.GetState() != gobreaker.StateOpen {
		t.Fatal("Circuit should be open")
	}

	// Next request should immediately fail with circuit breaker error
	_, err = cbClient.Predict(ctx, []float64{1.0}, "test")
	if err == nil {
		t.Fatal("Expected error when circuit is open")
	}

	// Verify it's a circuit breaker error
	if !IsCircuitBreakerOpen(err) {
		t.Errorf("Expected CircuitBreakerOpenError, got %v", err)
	}

	cbErr, ok := err.(*CircuitBreakerOpenError)
	if !ok {
		t.Fatal("Error should be CircuitBreakerOpenError type")
	}

	if cbErr.Service != "Test-CB" {
		t.Errorf("Service = %v, want Test-CB", cbErr.Service)
	}
}

func TestCircuitBreaker_HalfOpen_Recovery(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	config := CircuitBreakerConfig{
		Name:        "Test-CB",
		MaxRequests: 3,
		Interval:    1 * time.Second,
		Timeout:     500 * time.Millisecond, // Short timeout for testing
		Threshold:   0.5,
	}

	cbClient, err := NewCircuitBreakerClient(ts.Address, config)
	if err != nil {
		t.Fatalf("NewCircuitBreakerClient() error = %v", err)
	}
	defer cbClient.Close()

	ctx := context.Background()

	// Trip the circuit
	ts.MockServer.SetShouldFail(true)
	for i := 0; i < 15; i++ {
		_, _ = cbClient.Predict(ctx, []float64{1.0}, "test")
	}

	if cbClient.GetState() != gobreaker.StateOpen {
		t.Fatal("Circuit should be open")
	}

	// Wait for timeout to transition to half-open
	time.Sleep(600 * time.Millisecond)

	// Fix the server
	ts.MockServer.SetShouldFail(false)

	// Make a successful request - circuit should transition to half-open then closed
	_, err = cbClient.Predict(ctx, []float64{1.0}, "test")
	if err != nil {
		t.Logf("First request after timeout failed: %v (expected, may need more requests)", err)
	}

	// Make several more successful requests to close circuit
	successCount := 0
	for i := 0; i < 5; i++ {
		_, err := cbClient.Predict(ctx, []float64{1.0}, "test")
		if err == nil {
			successCount++
		}
		time.Sleep(100 * time.Millisecond)
	}

	if successCount == 0 {
		t.Error("Expected at least one successful request after recovery")
	}

	// Eventually circuit should close (may take a few requests)
	finalState := cbClient.GetState()
	if finalState != gobreaker.StateClosed && finalState != gobreaker.StateHalfOpen {
		t.Errorf("Expected circuit to be Closed or HalfOpen after recovery, got %v", finalState)
	}
}

func TestCircuitBreaker_HealthCheck_Success(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	config := DefaultCircuitBreakerConfig
	cbClient, err := NewCircuitBreakerClient(ts.Address, config)
	if err != nil {
		t.Fatalf("NewCircuitBreakerClient() error = %v", err)
	}
	defer cbClient.Close()

	ctx := context.Background()
	healthy, err := cbClient.HealthCheck(ctx)
	if err != nil {
		t.Fatalf("HealthCheck() error = %v", err)
	}

	if !healthy {
		t.Error("Expected healthy=true")
	}
}

func TestCircuitBreaker_HealthCheck_OpenCircuit(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	config := CircuitBreakerConfig{
		Name:        "Test-CB",
		MaxRequests: 3,
		Interval:    1 * time.Second,
		Timeout:     2 * time.Second,
		Threshold:   0.5,
	}

	cbClient, err := NewCircuitBreakerClient(ts.Address, config)
	if err != nil {
		t.Fatalf("NewCircuitBreakerClient() error = %v", err)
	}
	defer cbClient.Close()

	ctx := context.Background()

	// Trip circuit with health check failures
	ts.MockServer.SetShouldFail(true)
	for i := 0; i < 15; i++ {
		_, _ = cbClient.HealthCheck(ctx)
	}

	// Circuit should be open
	if cbClient.GetState() != gobreaker.StateOpen {
		t.Fatal("Circuit should be open")
	}

	// Next health check should fail with circuit breaker error
	_, err = cbClient.HealthCheck(ctx)
	if err == nil {
		t.Fatal("Expected error when circuit is open")
	}

	if !IsCircuitBreakerOpen(err) {
		t.Errorf("Expected CircuitBreakerOpenError, got %v", err)
	}
}

func TestCircuitBreaker_GetCounts(t *testing.T) {
	ts, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}
	defer ts.Stop()

	config := DefaultCircuitBreakerConfig
	cbClient, err := NewCircuitBreakerClient(ts.Address, config)
	if err != nil {
		t.Fatalf("NewCircuitBreakerClient() error = %v", err)
	}
	defer cbClient.Close()

	ctx := context.Background()

	// Make some successful requests
	for i := 0; i < 5; i++ {
		_, _ = cbClient.Predict(ctx, []float64{1.0}, "test")
	}

	counts := cbClient.GetCounts()
	if counts.Requests < 5 {
		t.Errorf("Requests = %d, want >= 5", counts.Requests)
	}

	if counts.TotalSuccesses != 5 {
		t.Errorf("TotalSuccesses = %d, want 5", counts.TotalSuccesses)
	}

	if counts.TotalFailures != 0 {
		t.Errorf("TotalFailures = %d, want 0", counts.TotalFailures)
	}
}

func TestCircuitBreakerOpenError_Error(t *testing.T) {
	err := &CircuitBreakerOpenError{
		Service: "TestService",
		State:   "open",
	}

	expected := "circuit breaker open for TestService (state: open)"
	if err.Error() != expected {
		t.Errorf("Error() = %v, want %v", err.Error(), expected)
	}
}

func TestIsCircuitBreakerOpen(t *testing.T) {
	// Test with CircuitBreakerOpenError
	cbErr := &CircuitBreakerOpenError{Service: "test", State: "open"}
	if !IsCircuitBreakerOpen(cbErr) {
		t.Error("Expected true for CircuitBreakerOpenError")
	}

	// Test with other error
	otherErr := status.Error(codes.Internal, "some error")
	if IsCircuitBreakerOpen(otherErr) {
		t.Error("Expected false for non-CircuitBreakerOpenError")
	}

	// Test with nil
	if IsCircuitBreakerOpen(nil) {
		t.Error("Expected false for nil error")
	}
}
