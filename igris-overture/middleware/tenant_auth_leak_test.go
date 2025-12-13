package middleware

import (
	"runtime"
	"testing"
	"time"
)

func TestTenantAuth_NoGoroutineLeaks(t *testing.T) {
	// Get initial goroutine count
	runtime.GC()
	time.Sleep(100 * time.Millisecond)
	initialGoroutines := runtime.NumGoroutine()

	// Create TenantAuth with worker pool
	ta := NewTenantAuth(nil, nil)

	// Wait for workers to start
	time.Sleep(100 * time.Millisecond)

	// Simulate many authentication requests
	for i := 0; i < 1000; i++ {
		// Simulate queuing login updates
		select {
		case ta.loginQueue <- "tenant-test-id":
		default:
		}
	}

	// Stop the worker pool
	ta.Stop()

	// Give time for cleanup
	runtime.GC()
	time.Sleep(200 * time.Millisecond)

	// Check final goroutine count
	finalGoroutines := runtime.NumGoroutine()

	// Allow some tolerance (up to 5 extra goroutines)
	if finalGoroutines > initialGoroutines+5 {
		t.Errorf("Goroutine leak detected: started with %d, ended with %d (difference: %d)",
			initialGoroutines, finalGoroutines, finalGoroutines-initialGoroutines)
	} else {
		t.Logf("No goroutine leak: started with %d, ended with %d (difference: %d)",
			initialGoroutines, finalGoroutines, finalGoroutines-initialGoroutines)
	}
}

func TestAPIKeyAuth_NoGoroutineLeaks(t *testing.T) {
	// Get initial goroutine count
	runtime.GC()
	time.Sleep(100 * time.Millisecond)
	initialGoroutines := runtime.NumGoroutine()

	// Create APIKeyAuth with worker pool
	aka := NewAPIKeyAuth(nil)

	// Wait for workers to start
	time.Sleep(100 * time.Millisecond)

	// Simulate many authentication requests
	for i := 0; i < 1000; i++ {
		// Simulate queuing login updates
		select {
		case aka.loginQueue <- "tenant-test-id":
		default:
		}
	}

	// Stop the worker pool
	aka.Stop()

	// Give time for cleanup
	runtime.GC()
	time.Sleep(200 * time.Millisecond)

	// Check final goroutine count
	finalGoroutines := runtime.NumGoroutine()

	// Allow some tolerance (up to 5 extra goroutines)
	if finalGoroutines > initialGoroutines+5 {
		t.Errorf("Goroutine leak detected: started with %d, ended with %d (difference: %d)",
			initialGoroutines, finalGoroutines, finalGoroutines-initialGoroutines)
	} else {
		t.Logf("No goroutine leak: started with %d, ended with %d (difference: %d)",
			initialGoroutines, finalGoroutines, finalGoroutines-initialGoroutines)
	}
}

func TestTenantAuth_WorkerPoolShutdown(t *testing.T) {
	ta := NewTenantAuth(nil, nil)

	// Queue some items
	for i := 0; i < 10; i++ {
		ta.loginQueue <- "tenant-test"
	}

	// Stop should complete within timeout
	done := make(chan bool)
	go func() {
		ta.Stop()
		done <- true
	}()

	select {
	case <-done:
		t.Log("Worker pool shut down successfully")
	case <-time.After(15 * time.Second):
		t.Fatal("Worker pool shutdown timed out")
	}
}

func TestAPIKeyAuth_WorkerPoolShutdown(t *testing.T) {
	aka := NewAPIKeyAuth(nil)

	// Queue some items
	for i := 0; i < 10; i++ {
		aka.loginQueue <- "tenant-test"
	}

	// Stop should complete within timeout
	done := make(chan bool)
	go func() {
		aka.Stop()
		done <- true
	}()

	select {
	case <-done:
		t.Log("Worker pool shut down successfully")
	case <-time.After(15 * time.Second):
		t.Fatal("Worker pool shutdown timed out")
	}
}

func TestTenantAuth_QueueFullBehavior(t *testing.T) {
	// Create TenantAuth with small buffer for testing
	ta := NewTenantAuth(nil, nil)

	// Fill the queue completely
	filled := 0
	for i := 0; i < 2000; i++ {
		select {
		case ta.loginQueue <- "tenant-test":
			filled++
		default:
			// Queue full
			break
		}
	}

	t.Logf("Filled %d items before queue was full", filled)

	// Verify queue is full (should be 1000 from buffer size)
	if filled < 900 {
		t.Errorf("Queue filled too early: expected ~1000, got %d", filled)
	}

	// Clean up
	ta.Stop()
}

// Benchmark goroutine creation overhead
func BenchmarkTenantAuth_OldApproach(b *testing.B) {
	// Simulate old approach with goroutine per request
	for i := 0; i < b.N; i++ {
		go func(tenantID string) {
			// Simulate work
			time.Sleep(time.Microsecond)
		}("tenant-id")
	}
}

func BenchmarkTenantAuth_WorkerPool(b *testing.B) {
	// New approach with worker pool
	ta := NewTenantAuth(nil, nil)
	defer ta.Stop()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		select {
		case ta.loginQueue <- "tenant-id":
		default:
		}
	}
}
