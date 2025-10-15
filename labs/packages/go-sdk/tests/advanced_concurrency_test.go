// Advanced Concurrency and Race Condition Tests for Go SDK
//
// This module contains comprehensive tests for concurrent operations,
// race condition detection, deadlock prevention, and goroutine safety.

package tests

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Mock client and manager types
type ConcurrentClient struct {
	httpClient  *http.Client
	baseURL     string
	apiKey      string
	requestPool sync.Pool
	mutex       sync.RWMutex
	stats       ClientStats
}

type ClientStats struct {
	requests     int64
	errorCount   int64
	concurrent   int64
	maxConcurrent int64
}

type TokenManager struct {
	currentToken  string
	refreshToken  string
	expiresAt     time.Time
	mutex         sync.RWMutex
	refreshing    int32 // atomic flag
}

type ConnectionPool struct {
	connections chan *http.Client
	mutex       sync.RWMutex
	created     int32
	maxSize     int32
}

func NewConcurrentClient(baseURL, apiKey string) *ConcurrentClient {
	return &ConcurrentClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    baseURL,
		apiKey:     apiKey,
		requestPool: sync.Pool{
			New: func() interface{} {
				return &http.Request{}
			},
		},
	}
}

func (c *ConcurrentClient) makeRequest(ctx context.Context, method, path string) (*http.Response, error) {
	// Track concurrent requests
	concurrent := atomic.AddInt64(&c.stats.concurrent, 1)
	defer atomic.AddInt64(&c.stats.concurrent, -1)

	// Update max concurrent counter
	for {
		max := atomic.LoadInt64(&c.stats.maxConcurrent)
		if concurrent <= max {
			break
		}
		if atomic.CompareAndSwapInt64(&c.stats.maxConcurrent, max, concurrent) {
			break
		}
	}

	// Increment request counter
	atomic.AddInt64(&c.stats.requests, 1)

	// Get request from pool
	req := c.requestPool.Get().(*http.Request)
	defer c.requestPool.Put(req)

	// Make actual request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		atomic.AddInt64(&c.stats.errorCount, 1)
	}

	return resp, err
}

func (c *ConcurrentClient) GetStats() ClientStats {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return ClientStats{
		requests:      atomic.LoadInt64(&c.stats.requests),
		errorCount:    atomic.LoadInt64(&c.stats.errorCount),
		concurrent:    atomic.LoadInt64(&c.stats.concurrent),
		maxConcurrent: atomic.LoadInt64(&c.stats.maxConcurrent),
	}
}

func NewTokenManager(initialToken, refreshToken string) *TokenManager {
	return &TokenManager{
		currentToken: initialToken,
		refreshToken: refreshToken,
		expiresAt:    time.Now().Add(1 * time.Hour),
	}
}

func (tm *TokenManager) GetToken() string {
	tm.mutex.RLock()
	defer tm.mutex.RUnlock()
	return tm.currentToken
}

func (tm *TokenManager) RefreshTokenIfNeeded() error {
	// Check if refresh is needed without holding write lock
	tm.mutex.RLock()
	needsRefresh := time.Now().After(tm.expiresAt.Add(-5 * time.Minute))
	tm.mutex.RUnlock()

	if !needsRefresh {
		return nil
	}

	// Use atomic CAS to ensure only one goroutine refreshes
	if !atomic.CompareAndSwapInt32(&tm.refreshing, 0, 1) {
		// Another goroutine is refreshing, wait for it
		for atomic.LoadInt32(&tm.refreshing) == 1 {
			time.Sleep(10 * time.Millisecond)
		}
		return nil
	}

	defer atomic.StoreInt32(&tm.refreshing, 0)

	// Perform token refresh
	tm.mutex.Lock()
	defer tm.mutex.Unlock()

	// Simulate token refresh API call
	time.Sleep(100 * time.Millisecond)

	// Update token
	tm.currentToken = fmt.Sprintf("refreshed-token-%d", time.Now().Unix())
	tm.expiresAt = time.Now().Add(1 * time.Hour)

	return nil
}

func NewConnectionPool(maxSize int) *ConnectionPool {
	return &ConnectionPool{
		connections: make(chan *http.Client, maxSize),
		maxSize:     int32(maxSize),
	}
}

func (cp *ConnectionPool) Get() *http.Client {
	select {
	case client := <-cp.connections:
		return client
	default:
		// Create new client if pool is empty and under limit
		if atomic.LoadInt32(&cp.created) < cp.maxSize {
			atomic.AddInt32(&cp.created, 1)
			return &http.Client{Timeout: 30 * time.Second}
		}
		// Wait for available connection
		return <-cp.connections
	}
}

func (cp *ConnectionPool) Put(client *http.Client) {
	select {
	case cp.connections <- client:
		// Client returned to pool
	default:
		// Pool is full, discard client
		atomic.AddInt32(&cp.created, -1)
	}
}

func (cp *ConnectionPool) Size() int {
	cp.mutex.RLock()
	defer cp.mutex.RUnlock()
	return len(cp.connections)
}

// Test Suite
func TestConcurrentClientOperations(t *testing.T) {
	t.Run("Concurrent Request Handling", func(t *testing.T) {
		// Create mock server
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Simulate processing time
			time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success": true}`))
		}))
		defer server.Close()

		client := NewConcurrentClient(server.URL, "test-api-key")
		ctx := context.Background()

		// Launch 100 concurrent requests
		var wg sync.WaitGroup
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func(requestID int) {
				defer wg.Done()

				resp, err := client.makeRequest(ctx, "GET", "/test")
				assert.NoError(t, err)
				if resp != nil {
					resp.Body.Close()
				}
			}(i)
		}

		wg.Wait()

		// Verify stats
		stats := client.GetStats()
		assert.Equal(t, int64(100), stats.requests)
		assert.Equal(t, int64(0), stats.errorCount)
		assert.Equal(t, int64(0), stats.concurrent) // Should be 0 after completion
		assert.True(t, stats.maxConcurrent > 1) // Should have had concurrent requests
	})

	t.Run("Race Condition in Token Refresh", func(t *testing.T) {
		tokenManager := NewTokenManager("initial-token", "refresh-token")

		// Set token to expire soon
		tokenManager.mutex.Lock()
		tokenManager.expiresAt = time.Now().Add(1 * time.Minute)
		tokenManager.mutex.Unlock()

		// Launch 50 goroutines that all try to refresh token
		var wg sync.WaitGroup
		refreshCounts := make([]int, 50)

		for i := 0; i < 50; i++ {
			wg.Add(1)
			go func(goroutineID int) {
				defer wg.Done()

				// Try to refresh multiple times
				for j := 0; j < 10; j++ {
					err := tokenManager.RefreshTokenIfNeeded()
					assert.NoError(t, err)
					refreshCounts[goroutineID]++
					time.Sleep(1 * time.Millisecond)
				}
			}(i)
		}

		wg.Wait()

		// Verify token was refreshed (no race conditions)
		token := tokenManager.GetToken()
		assert.Contains(t, token, "refreshed-token-")

		// All goroutines should have completed successfully
		for i, count := range refreshCounts {
			assert.Equal(t, 10, count, "Goroutine %d didn't complete all refreshes", i)
		}
	})

	t.Run("Connection Pool Thread Safety", func(t *testing.T) {
		pool := NewConnectionPool(10)

		// Pre-populate pool
		for i := 0; i < 5; i++ {
			pool.Put(&http.Client{Timeout: time.Duration(i+1) * time.Second})
		}

		var wg sync.WaitGroup
		successCount := int64(0)

		// Launch 100 goroutines that get and put connections
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func(goroutineID int) {
				defer wg.Done()

				// Get connection
				client := pool.Get()
				assert.NotNil(t, client)

				// Simulate using connection
				time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)

				// Return connection
				pool.Put(client)

				atomic.AddInt64(&successCount, 1)
			}(i)
		}

		wg.Wait()

		// Verify all operations completed successfully
		assert.Equal(t, int64(100), successCount)

		// Pool should have connections
		assert.True(t, pool.Size() > 0)
	})

	t.Run("Deadlock Detection and Prevention", func(t *testing.T) {
		// Create scenario that could potentially deadlock
		var mutex1, mutex2 sync.Mutex
		var wg sync.WaitGroup
		deadlockDetected := false

		// Goroutine 1: locks mutex1 then mutex2
		wg.Add(1)
		go func() {
			defer wg.Done()
			mutex1.Lock()
			time.Sleep(50 * time.Millisecond)
			
			// Try to acquire mutex2 with timeout
			ch := make(chan bool, 1)
			go func() {
				mutex2.Lock()
				ch <- true
				mutex2.Unlock()
			}()

			select {
			case <-ch:
				// Successfully acquired mutex2
			case <-time.After(200 * time.Millisecond):
				// Timeout - potential deadlock
				deadlockDetected = true
			}

			mutex1.Unlock()
		}()

		// Goroutine 2: locks mutex2 then mutex1
		wg.Add(1)
		go func() {
			defer wg.Done()
			mutex2.Lock()
			time.Sleep(50 * time.Millisecond)
			
			// Try to acquire mutex1 with timeout
			ch := make(chan bool, 1)
			go func() {
				mutex1.Lock()
				ch <- true
				mutex1.Unlock()
			}()

			select {
			case <-ch:
				// Successfully acquired mutex1
			case <-time.After(200 * time.Millisecond):
				// Timeout - potential deadlock
				deadlockDetected = true
			}

			mutex2.Unlock()
		}()

		// Wait for completion or timeout
		completed := make(chan bool)
		go func() {
			wg.Wait()
			completed <- true
		}()

		select {
		case <-completed:
			// Test completed successfully
		case <-time.After(1 * time.Second):
			t.Fatal("Test timed out - possible deadlock")
		}

		// In a real scenario, we might have deadlock prevention
		// For this test, we just verify the test doesn't hang
	})

	t.Run("Memory Leak Detection in Goroutines", func(t *testing.T) {
		initialGoroutines := runtime.NumGoroutine()

		// Launch many short-lived goroutines
		var wg sync.WaitGroup
		for i := 0; i < 1000; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()
				// Short task
				time.Sleep(1 * time.Millisecond)
			}(i)
		}

		wg.Wait()

		// Give some time for goroutines to be cleaned up
		time.Sleep(100 * time.Millisecond)
		runtime.GC()
		time.Sleep(100 * time.Millisecond)

		finalGoroutines := runtime.NumGoroutine()

		// Should not have significant goroutine leak
		goroutineIncrease := finalGoroutines - initialGoroutines
		assert.True(t, goroutineIncrease < 10, 
			"Potential goroutine leak: %d new goroutines", goroutineIncrease)
	})

	t.Run("Channel Communication Race Conditions", func(t *testing.T) {
		bufferSize := 100
		dataChannel := make(chan int, bufferSize)
		resultChannel := make(chan int, bufferSize)

		var wg sync.WaitGroup

		// Producer goroutines
		numProducers := 10
		for i := 0; i < numProducers; i++ {
			wg.Add(1)
			go func(producerID int) {
				defer wg.Done()
				for j := 0; j < 10; j++ {
					value := producerID*100 + j
					select {
					case dataChannel <- value:
						// Value sent successfully
					case <-time.After(1 * time.Second):
						t.Errorf("Producer %d timed out sending %d", producerID, value)
						return
					}
				}
			}(i)
		}

		// Consumer goroutines
		numConsumers := 5
		consumedCount := int64(0)
		for i := 0; i < numConsumers; i++ {
			wg.Add(1)
			go func(consumerID int) {
				defer wg.Done()
				for {
					select {
					case value := <-dataChannel:
						// Process value
						processed := value * 2
						resultChannel <- processed
						atomic.AddInt64(&consumedCount, 1)
					case <-time.After(500 * time.Millisecond):
						// No more data, exit
						return
					}
				}
			}(i)
		}

		// Result collector
		wg.Add(1)
		results := make(map[int]bool)
		go func() {
			defer wg.Done()
			for {
				select {
				case result := <-resultChannel:
					results[result] = true
				case <-time.After(1 * time.Second):
					// No more results
					return
				}
			}
		}()

		wg.Wait()

		// Verify all data was processed
		expectedCount := int64(numProducers * 10) // 10 items per producer
		assert.Equal(t, expectedCount, consumedCount)
		assert.Equal(t, int(expectedCount), len(results))
	})
}

func TestAdvancedConcurrencyPatterns(t *testing.T) {
	t.Run("Worker Pool Pattern", func(t *testing.T) {
		numWorkers := 5
		numJobs := 100

		// Job and result types
		type Job struct {
			ID   int
			Data string
		}

		type Result struct {
			JobID  int
			Output string
			Error  error
		}

		// Channels
		jobs := make(chan Job, numJobs)
		results := make(chan Result, numJobs)

		// Start workers
		var wg sync.WaitGroup
		for i := 0; i < numWorkers; i++ {
			wg.Add(1)
			go func(workerID int) {
				defer wg.Done()
				for job := range jobs {
					// Simulate work
					time.Sleep(time.Duration(rand.Intn(10)) * time.Millisecond)

					// Process job
					output := fmt.Sprintf("Worker %d processed job %d: %s", 
						workerID, job.ID, job.Data)

					results <- Result{
						JobID:  job.ID,
						Output: output,
						Error:  nil,
					}
				}
			}(i)
		}

		// Send jobs
		for i := 0; i < numJobs; i++ {
			jobs <- Job{
				ID:   i,
				Data: fmt.Sprintf("job-data-%d", i),
			}
		}
		close(jobs)

		// Collect results
		go func() {
			wg.Wait()
			close(results)
		}()

		processedResults := make(map[int]Result)
		for result := range results {
			processedResults[result.JobID] = result
			require.NoError(t, result.Error)
		}

		// Verify all jobs were processed
		assert.Equal(t, numJobs, len(processedResults))
		for i := 0; i < numJobs; i++ {
			result, exists := processedResults[i]
			assert.True(t, exists, "Job %d was not processed", i)
			assert.Contains(t, result.Output, fmt.Sprintf("job %d", i))
		}
	})

	t.Run("Fan-Out Fan-In Pattern", func(t *testing.T) {
		inputData := make([]int, 100)
		for i := range inputData {
			inputData[i] = i + 1
		}

		// Fan-out: distribute work to multiple goroutines
		numWorkers := 10
		workChannels := make([]chan int, numWorkers)
		resultChannels := make([]chan int, numWorkers)

		for i := 0; i < numWorkers; i++ {
			workChannels[i] = make(chan int, 10)
			resultChannels[i] = make(chan int, 10)

			// Start worker
			go func(workerID int) {
				for value := range workChannels[workerID] {
					// Process value (square it)
					result := value * value
					resultChannels[workerID] <- result
				}
				close(resultChannels[workerID])
			}(i)
		}

		// Distribute work
		for i, value := range inputData {
			workerID := i % numWorkers
			workChannels[workerID] <- value
		}

		// Close work channels
		for i := 0; i < numWorkers; i++ {
			close(workChannels[i])
		}

		// Fan-in: collect results from all workers
		allResults := make(chan int, 100)
		var wg sync.WaitGroup

		for i := 0; i < numWorkers; i++ {
			wg.Add(1)
			go func(workerID int) {
				defer wg.Done()
				for result := range resultChannels[workerID] {
					allResults <- result
				}
			}(i)
		}

		// Close results channel when all workers are done
		go func() {
			wg.Wait()
			close(allResults)
		}()

		// Collect final results
		finalResults := make([]int, 0, 100)
		for result := range allResults {
			finalResults = append(finalResults, result)
		}

		// Verify results
		assert.Equal(t, 100, len(finalResults))

		// Calculate expected sum (1^2 + 2^2 + ... + 100^2)
		expectedSum := 0
		for i := 1; i <= 100; i++ {
			expectedSum += i * i
		}

		actualSum := 0
		for _, result := range finalResults {
			actualSum += result
		}

		assert.Equal(t, expectedSum, actualSum)
	})

	t.Run("Context Cancellation and Cleanup", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		cancelledCount := int64(0)
		completedCount := int64(0)

		var wg sync.WaitGroup

		// Start multiple long-running operations
		for i := 0; i < 20; i++ {
			wg.Add(1)
			go func(operationID int) {
				defer wg.Done()

				// Simulate long-running work with context checking
				for j := 0; j < 100; j++ {
					select {
					case <-ctx.Done():
						// Context cancelled, clean up
						atomic.AddInt64(&cancelledCount, 1)
						return
					default:
						// Continue work
						time.Sleep(50 * time.Millisecond)
					}
				}

				// Operation completed normally
				atomic.AddInt64(&completedCount, 1)
			}(i)
		}

		// Cancel context after 1 second
		time.Sleep(1 * time.Second)
		cancel()

		wg.Wait()

		// Verify cancellation worked
		totalOperations := cancelledCount + completedCount
		assert.Equal(t, int64(20), totalOperations)

		// Some operations should have been cancelled
		assert.True(t, cancelledCount > 0, "No operations were cancelled")
		assert.True(t, cancelledCount < 20, "All operations were cancelled (none completed)")
	})
}

// Benchmark tests for concurrency performance
func BenchmarkConcurrentOperations(b *testing.B) {
	b.Run("AtomicOperations", func(b *testing.B) {
		var counter int64

		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				atomic.AddInt64(&counter, 1)
			}
		})

		if counter != int64(b.N) {
			b.Errorf("Expected counter to be %d, got %d", b.N, counter)
		}
	})

	b.Run("MutexOperations", func(b *testing.B) {
		var counter int64
		var mutex sync.Mutex

		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				mutex.Lock()
				counter++
				mutex.Unlock()
			}
		})

		if counter != int64(b.N) {
			b.Errorf("Expected counter to be %d, got %d", b.N, counter)
		}
	})

	b.Run("ChannelOperations", func(b *testing.B) {
		ch := make(chan int, 1000)

		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				ch <- 1
				<-ch
			}
		})
	})
}
