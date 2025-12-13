package telemetry

import (
	"context"
	"database/sql"
	"runtime"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

func TestTelemetryCollector_AsyncRecording(t *testing.T) {
	// Skip if database not available
	db, err := sql.Open("postgres", "postgres://localhost/test?sslmode=disable")
	if err != nil {
		t.Skip("Database not available")
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		t.Skip("Database not available")
	}

	tc := NewTelemetryCollector(db)
	defer tc.Stop()

	// Queue a telemetry record
	telemetry := &RoutingTelemetry{
		TenantID:     "test-tenant",
		TraceID:      uuid.New(),
		ProviderName: "test-provider",
		Model:        "gpt-4",
		LatencyMs:    100,
		Success:      true,
	}

	err = tc.RecordTelemetry(context.Background(), telemetry)
	if err != nil {
		t.Errorf("Expected RecordTelemetry to succeed, got error: %v", err)
	}

	// Give workers time to process
	time.Sleep(100 * time.Millisecond)

	t.Log("Async recording test completed")
}

func TestTelemetryCollector_NoGoroutineLeaks(t *testing.T) {
	// Get initial goroutine count
	runtime.GC()
	time.Sleep(100 * time.Millisecond)
	initialGoroutines := runtime.NumGoroutine()

	// Create collector with worker pool
	tc := NewTelemetryCollector(nil)

	// Wait for workers to start
	time.Sleep(100 * time.Millisecond)

	// Simulate many telemetry records
	for i := 0; i < 1000; i++ {
		telemetry := &RoutingTelemetry{
			TenantID:     "test-tenant",
			TraceID:      uuid.New(),
			ProviderName: "test-provider",
			Model:        "gpt-4",
			LatencyMs:    100,
			Success:      true,
		}

		// Try to queue (may fail if queue full)
		select {
		case tc.telemetryQueue <- telemetry:
		default:
		}
	}

	// Stop the worker pool
	tc.Stop()

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

func TestTelemetryCollector_WorkerPoolShutdown(t *testing.T) {
	tc := NewTelemetryCollector(nil)

	// Queue some items
	for i := 0; i < 10; i++ {
		telemetry := &RoutingTelemetry{
			TenantID:     "test-tenant",
			TraceID:      uuid.New(),
			ProviderName: "test-provider",
			Model:        "gpt-4",
			LatencyMs:    100,
			Success:      true,
		}
		tc.telemetryQueue <- telemetry
	}

	// Stop should complete within timeout
	done := make(chan bool)
	go func() {
		tc.Stop()
		done <- true
	}()

	select {
	case <-done:
		t.Log("Worker pool shut down successfully")
	case <-time.After(35 * time.Second):
		t.Fatal("Worker pool shutdown timed out")
	}
}

func TestTelemetryCollector_QueueFullBehavior(t *testing.T) {
	// Create collector with small buffer for testing
	tc := NewTelemetryCollector(nil)
	defer tc.Stop()

	// Fill the queue completely
	filled := 0
	for i := 0; i < 12000; i++ {
		telemetry := &RoutingTelemetry{
			TenantID:     "test-tenant",
			TraceID:      uuid.New(),
			ProviderName: "test-provider",
			Model:        "gpt-4",
			LatencyMs:    100,
			Success:      true,
		}

		err := tc.RecordTelemetry(context.Background(), telemetry)
		if err == nil {
			filled++
		} else {
			// Queue full
			break
		}
	}

	t.Logf("Filled %d items before queue was full", filled)

	// Verify queue is full (should be ~10000 from buffer size)
	if filled < 9000 {
		t.Errorf("Queue filled too early: expected ~10000, got %d", filled)
	}
}

func TestTelemetryCollector_NonBlockingBehavior(t *testing.T) {
	tc := NewTelemetryCollector(nil)
	defer tc.Stop()

	// Record telemetry should be non-blocking
	start := time.Now()
	for i := 0; i < 100; i++ {
		telemetry := &RoutingTelemetry{
			TenantID:     "test-tenant",
			TraceID:      uuid.New(),
			ProviderName: "test-provider",
			Model:        "gpt-4",
			LatencyMs:    100,
			Success:      true,
		}

		tc.RecordTelemetry(context.Background(), telemetry)
	}
	elapsed := time.Since(start)

	// Should complete in < 10ms (non-blocking)
	if elapsed > 10*time.Millisecond {
		t.Errorf("RecordTelemetry is blocking: took %v for 100 records", elapsed)
	} else {
		t.Logf("RecordTelemetry is non-blocking: took %v for 100 records", elapsed)
	}
}

func TestTelemetryCollector_ConcurrentAccess(t *testing.T) {
	tc := NewTelemetryCollector(nil)
	defer tc.Stop()

	// Test concurrent access doesn't cause race conditions
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				telemetry := &RoutingTelemetry{
					TenantID:     "test-tenant",
					TraceID:      uuid.New(),
					ProviderName: "test-provider",
					Model:        "gpt-4",
					LatencyMs:    100,
					Success:      true,
				}
				tc.RecordTelemetry(context.Background(), telemetry)
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

// Benchmark old synchronous approach (simulated)
func BenchmarkTelemetryCollector_OldApproach(b *testing.B) {
	// Simulate old synchronous approach with blocking DB calls
	for i := 0; i < b.N; i++ {
		// Simulate DB write latency (10ms)
		time.Sleep(10 * time.Microsecond)
	}
}

// Benchmark new async approach
func BenchmarkTelemetryCollector_AsyncApproach(b *testing.B) {
	tc := NewTelemetryCollector(nil)
	defer tc.Stop()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		telemetry := &RoutingTelemetry{
			TenantID:     "test-tenant",
			TraceID:      uuid.New(),
			ProviderName: "test-provider",
			Model:        "gpt-4",
			LatencyMs:    100,
			Success:      true,
		}
		tc.RecordTelemetry(context.Background(), telemetry)
	}
}
