package circuitbreaker

import (
	"testing"
	"time"
)

func TestCircuitBreaker_InitialState(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * time.Minute,
	})

	if cb.GetState() != StateClosed {
		t.Errorf("Expected initial state to be Closed, got %s", cb.GetState())
	}

	if !cb.Allow() {
		t.Error("Expected Allow() to return true in Closed state")
	}
}

func TestCircuitBreaker_OpenAfterThreshold(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * time.Minute,
	})

	// Record 2 failures - should stay closed
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.GetState() != StateClosed {
		t.Errorf("Expected state to be Closed after 2 failures, got %s", cb.GetState())
	}

	if cb.GetFailureCount() != 2 {
		t.Errorf("Expected failure count to be 2, got %d", cb.GetFailureCount())
	}

	// Record 3rd failure - should open
	cb.RecordFailure()

	if cb.GetState() != StateOpen {
		t.Errorf("Expected state to be Open after 3 failures, got %s", cb.GetState())
	}

	if cb.Allow() {
		t.Error("Expected Allow() to return false in Open state")
	}
}

func TestCircuitBreaker_SuccessResetsFailureCount(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * time.Minute,
	})

	// Record 2 failures
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.GetFailureCount() != 2 {
		t.Errorf("Expected failure count to be 2, got %d", cb.GetFailureCount())
	}

	// Record success - should reset count
	cb.RecordSuccess()

	if cb.GetFailureCount() != 0 {
		t.Errorf("Expected failure count to be 0 after success, got %d", cb.GetFailureCount())
	}

	if cb.GetState() != StateClosed {
		t.Errorf("Expected state to remain Closed, got %s", cb.GetState())
	}
}

func TestCircuitBreaker_HalfOpenAfterTimeout(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  100 * time.Millisecond, // Short timeout for testing
	})

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.GetState() != StateOpen {
		t.Errorf("Expected state to be Open, got %s", cb.GetState())
	}

	// Wait for recovery timeout
	time.Sleep(150 * time.Millisecond)

	// Should transition to half-open on next Allow() call
	if !cb.Allow() {
		t.Error("Expected Allow() to return true after recovery timeout")
	}

	if cb.GetState() != StateHalfOpen {
		t.Errorf("Expected state to be HalfOpen after timeout, got %s", cb.GetState())
	}
}

func TestCircuitBreaker_HalfOpenToClosedAfterSuccesses(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  100 * time.Millisecond,
	})

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()

	// Wait for recovery timeout
	time.Sleep(150 * time.Millisecond)
	cb.Allow() // Transition to half-open

	if cb.GetState() != StateHalfOpen {
		t.Errorf("Expected state to be HalfOpen, got %s", cb.GetState())
	}

	// Record 1 success - should stay half-open
	cb.RecordSuccess()
	if cb.GetState() != StateHalfOpen {
		t.Errorf("Expected state to remain HalfOpen after 1 success, got %s", cb.GetState())
	}

	// Record 2nd success - should close
	cb.RecordSuccess()
	if cb.GetState() != StateClosed {
		t.Errorf("Expected state to be Closed after 2 successes, got %s", cb.GetState())
	}

	if cb.GetFailureCount() != 0 {
		t.Errorf("Expected failure count to be 0 in Closed state, got %d", cb.GetFailureCount())
	}
}

func TestCircuitBreaker_HalfOpenToOpenOnFailure(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  100 * time.Millisecond,
	})

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()

	// Wait for recovery timeout
	time.Sleep(150 * time.Millisecond)
	cb.Allow() // Transition to half-open

	if cb.GetState() != StateHalfOpen {
		t.Errorf("Expected state to be HalfOpen, got %s", cb.GetState())
	}

	// Record failure - should immediately reopen
	cb.RecordFailure()

	if cb.GetState() != StateOpen {
		t.Errorf("Expected state to be Open after failure in HalfOpen, got %s", cb.GetState())
	}
}

func TestCircuitBreaker_Reset(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * time.Minute,
	})

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.GetState() != StateOpen {
		t.Errorf("Expected state to be Open, got %s", cb.GetState())
	}

	// Reset
	cb.Reset()

	if cb.GetState() != StateClosed {
		t.Errorf("Expected state to be Closed after reset, got %s", cb.GetState())
	}

	if cb.GetFailureCount() != 0 {
		t.Errorf("Expected failure count to be 0 after reset, got %d", cb.GetFailureCount())
	}

	if !cb.Allow() {
		t.Error("Expected Allow() to return true after reset")
	}
}

func TestProviderCircuitBreakers_GetOrCreate(t *testing.T) {
	pcb := NewProviderCircuitBreakers(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * time.Minute,
	})

	// Get breaker for provider1
	breaker1 := pcb.GetOrCreate("provider1")
	if breaker1 == nil {
		t.Fatal("Expected breaker1 to be created")
	}

	// Get breaker again - should return same instance
	breaker1Again := pcb.GetOrCreate("provider1")
	if breaker1 != breaker1Again {
		t.Error("Expected to get same breaker instance")
	}

	// Get breaker for provider2 - should be different
	breaker2 := pcb.GetOrCreate("provider2")
	if breaker2 == nil {
		t.Fatal("Expected breaker2 to be created")
	}
	if breaker1 == breaker2 {
		t.Error("Expected different breakers for different providers")
	}
}

func TestProviderCircuitBreakers_IsProviderAvailable(t *testing.T) {
	pcb := NewProviderCircuitBreakers(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * time.Minute,
	})

	providerID := "test-provider"

	// Initially available
	if !pcb.IsProviderAvailable(providerID) {
		t.Error("Expected provider to be available initially")
	}

	// Record failures to open circuit
	pcb.RecordFailure(providerID)
	pcb.RecordFailure(providerID)
	pcb.RecordFailure(providerID)

	// Should not be available
	if pcb.IsProviderAvailable(providerID) {
		t.Error("Expected provider to be unavailable after 3 failures")
	}

	if pcb.GetState(providerID) != StateOpen {
		t.Errorf("Expected state to be Open, got %s", pcb.GetState(providerID))
	}
}

func TestProviderCircuitBreakers_RecordSuccess(t *testing.T) {
	pcb := NewProviderCircuitBreakers(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  100 * time.Millisecond,
	})

	providerID := "test-provider"

	// Open the circuit
	pcb.RecordFailure(providerID)
	pcb.RecordFailure(providerID)
	pcb.RecordFailure(providerID)

	// Wait for recovery
	time.Sleep(150 * time.Millisecond)
	pcb.IsProviderAvailable(providerID) // Transition to half-open

	// Record successes to close
	pcb.RecordSuccess(providerID)
	pcb.RecordSuccess(providerID)

	if pcb.GetState(providerID) != StateClosed {
		t.Errorf("Expected state to be Closed after successes, got %s", pcb.GetState(providerID))
	}
}

func TestProviderCircuitBreakers_Reset(t *testing.T) {
	pcb := NewProviderCircuitBreakers(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * time.Minute,
	})

	providerID := "test-provider"

	// Open the circuit
	pcb.RecordFailure(providerID)
	pcb.RecordFailure(providerID)
	pcb.RecordFailure(providerID)

	if pcb.GetState(providerID) != StateOpen {
		t.Errorf("Expected state to be Open, got %s", pcb.GetState(providerID))
	}

	// Reset
	pcb.Reset(providerID)

	if pcb.GetState(providerID) != StateClosed {
		t.Errorf("Expected state to be Closed after reset, got %s", pcb.GetState(providerID))
	}

	if !pcb.IsProviderAvailable(providerID) {
		t.Error("Expected provider to be available after reset")
	}
}

func TestProviderCircuitBreakers_GetStats(t *testing.T) {
	pcb := NewProviderCircuitBreakers(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  2 * time.Minute,
	})

	// Create some breakers with different states
	pcb.RecordFailure("provider1")
	pcb.RecordFailure("provider1")

	pcb.RecordFailure("provider2")
	pcb.RecordFailure("provider2")
	pcb.RecordFailure("provider2") // Open

	stats := pcb.GetStats()

	if len(stats) != 2 {
		t.Errorf("Expected stats for 2 providers, got %d", len(stats))
	}

	if stats["provider1"]["state"] != "closed" {
		t.Errorf("Expected provider1 state to be closed, got %v", stats["provider1"]["state"])
	}

	if stats["provider2"]["state"] != "open" {
		t.Errorf("Expected provider2 state to be open, got %v", stats["provider2"]["state"])
	}
}

func TestCircuitBreaker_ConcurrentAccess(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 10,
		RecoveryTimeout:  100 * time.Millisecond,
	})

	// Test concurrent access doesn't cause race conditions
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				cb.Allow()
				cb.RecordFailure()
				cb.RecordSuccess()
				cb.GetState()
				cb.GetFailureCount()
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	t.Log("Concurrent access test completed without race conditions")
}
