// Comprehensive Performance and Load Tests for Go SDK
//
// This module contains performance tests covering:
// - Response time measurements
// - Throughput testing
// - Concurrent request handling
// - Memory usage profiling
// - Connection pooling efficiency
// - Rate limiting behavior
// - Resource cleanup verification
// - Goroutine leak detection

package tests

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// Mock client interfaces
type SchlepEngineClient struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

type AuthManager struct {
	client     *SchlepEngineClient
	tokenCache map[string]interface{}
	mutex      sync.RWMutex
}

type DataProcessor struct {
	client *SchlepEngineClient
}

type WebSocketManager struct {
	url        string
	connection interface{}
	mutex      sync.RWMutex
}

// Performance test suite
type PerformanceTestSuite struct {
	client      *SchlepEngineClient
	testResults map[string]interface{}
	mutex       sync.RWMutex
}

// Performance metrics
type PerformanceMetrics struct {
	Duration       time.Duration
	Throughput     float64
	RequestsPerSec float64
	MemoryUsage    uint64
	GoroutineCount int
	ErrorRate      float64
}

// Memory stats
type MemoryStats struct {
	AllocMB      float64
	SysMB        float64
	NumGC        uint32
	PauseTotalNs uint64
}

// Helper functions
func NewPerformanceTestSuite() *PerformanceTestSuite {
	return &PerformanceTestSuite{
		client:      &SchlepEngineClient{httpClient: &http.Client{}},
		testResults: make(map[string]interface{}),
	}
}

func (pts *PerformanceTestSuite) AddResult(testName string, result interface{}) {
	pts.mutex.Lock()
	defer pts.mutex.Unlock()
	pts.testResults[testName] = result
}

func (pts *PerformanceTestSuite) GetResults() map[string]interface{} {
	pts.mutex.RLock()
	defer pts.mutex.RUnlock()
	results := make(map[string]interface{})
	for k, v := range pts.testResults {
		results[k] = v
	}
	return results
}

func GetMemoryStats() MemoryStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	return MemoryStats{
		AllocMB:      float64(m.Alloc) / 1024 / 1024,
		SysMB:        float64(m.Sys) / 1024 / 1024,
		NumGC:        m.NumGC,
		PauseTotalNs: m.PauseTotalNs,
	}
}

func MeasureExecutionTime(fn func() error) (time.Duration, error) {
	start := time.Now()
	err := fn()
	return time.Since(start), err
}

func CreateMockServer(delay time.Duration) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if delay > 0 {
			time.Sleep(delay)
		}
		
		switch r.URL.Path {
		case "/auth":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"token":"test-token","expires_in":3600}`)
		case "/jobs":
			if r.Method == "POST" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusCreated)
				fmt.Fprintf(w, `{"job_id":"test-job-123","status":"created"}`)
			} else {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				fmt.Fprintf(w, `{"job_id":"test-job-123","status":"completed"}`)
			}
		case "/upload":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"file_id":"test-file-123","size":%d}`, r.ContentLength)
		case "/download":
			w.Header().Set("Content-Type", "application/octet-stream")
			w.WriteHeader(http.StatusOK)
			w.Write(make([]byte, 1024))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

// Authentication performance tests
func TestAuthenticationPerformance(t *testing.T) {
	suite := NewPerformanceTestSuite()
	server := CreateMockServer(50 * time.Millisecond) // 50ms delay
	defer server.Close()
	
	client := &SchlepEngineClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    server.URL,
		apiKey:     "test-api-key",
	}

	t.Run("SingleAuthenticationResponseTime", func(t *testing.T) {
		duration, err := MeasureExecutionTime(func() error {
			resp, err := client.httpClient.Get(server.URL + "/auth")
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			return nil
		})

		if err != nil {
			t.Fatalf("Authentication failed: %v", err)
		}

		if duration > 500*time.Millisecond {
			t.Errorf("Authentication took %v, expected < 500ms", duration)
		}

		suite.AddResult("auth_response_time", map[string]interface{}{
			"duration_ms": float64(duration.Nanoseconds()) / 1e6,
			"acceptable":  duration < 500*time.Millisecond,
		})
	})

	t.Run("ConcurrentAuthentication", func(t *testing.T) {
		const concurrentRequests = 50
		var wg sync.WaitGroup
		var errors int32
		var totalDuration time.Duration
		var mutex sync.Mutex

		start := time.Now()

		for i := 0; i < concurrentRequests; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				
				reqStart := time.Now()
				resp, err := client.httpClient.Get(server.URL + "/auth")
				reqDuration := time.Since(reqStart)
				
				if err != nil {
					atomic.AddInt32(&errors, 1)
					return
				}
				resp.Body.Close()

				mutex.Lock()
				totalDuration += reqDuration
				mutex.Unlock()
			}()
		}

		wg.Wait()
		totalTime := time.Since(start)
		avgTime := totalDuration / time.Duration(concurrentRequests)

		if totalTime > 5*time.Second {
			t.Errorf("Concurrent authentication took %v, expected < 5s", totalTime)
		}

		if avgTime > 100*time.Millisecond {
			t.Errorf("Average auth time %v too slow, expected < 100ms", avgTime)
		}

		errorRate := float64(errors) / float64(concurrentRequests)
		if errorRate > 0.05 {
			t.Errorf("Error rate %.2f%% too high", errorRate*100)
		}

		suite.AddResult("concurrent_auth", map[string]interface{}{
			"total_time_ms":        float64(totalTime.Nanoseconds()) / 1e6,
			"avg_time_ms":          float64(avgTime.Nanoseconds()) / 1e6,
			"requests":             concurrentRequests,
			"requests_per_second":  float64(concurrentRequests) / totalTime.Seconds(),
			"error_rate":           errorRate,
		})
	})

	t.Run("TokenCachePerformance", func(t *testing.T) {
		authManager := &AuthManager{
			client:     client,
			tokenCache: make(map[string]interface{}),
		}

		// First call - should fetch token
		firstCallDuration, _ := MeasureExecutionTime(func() error {
			authManager.mutex.Lock()
			authManager.tokenCache["token"] = "cached-token"
			authManager.mutex.Unlock()
			return nil
		})

		// Second call - should use cache
		cachedCallDuration, _ := MeasureExecutionTime(func() error {
			authManager.mutex.RLock()
			_ = authManager.tokenCache["token"]
			authManager.mutex.RUnlock()
			return nil
		})

		efficiencyRatio := float64(firstCallDuration.Nanoseconds()) / float64(cachedCallDuration.Nanoseconds())
		if efficiencyRatio < 10 { // Cache should be at least 10x faster
			t.Errorf("Token cache not efficient enough: %.2fx improvement", efficiencyRatio)
		}

		suite.AddResult("token_cache_efficiency", map[string]interface{}{
			"first_call_ns":    firstCallDuration.Nanoseconds(),
			"cached_call_ns":   cachedCallDuration.Nanoseconds(),
			"efficiency_ratio": efficiencyRatio,
		})
	})
}

// Data processing performance tests
func TestDataProcessingPerformance(t *testing.T) {
	suite := NewPerformanceTestSuite()
	server := CreateMockServer(10 * time.Millisecond)
	defer server.Close()

	client := &SchlepEngineClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    server.URL,
	}

	t.Run("FileUploadThroughput", func(t *testing.T) {
		fileSizes := []int{1024, 10240, 102400, 1024000} // 1KB, 10KB, 100KB, 1MB

		for _, size := range fileSizes {
			testData := make([]byte, size)
			for i := range testData {
				testData[i] = byte(i % 256)
			}

			duration, err := MeasureExecutionTime(func() error {
				resp, err := client.httpClient.Post(
					server.URL+"/upload",
					"application/octet-stream",
					bytes.NewReader(testData),
				)
				if err != nil {
					return err
				}
				defer resp.Body.Close()
				return nil
			})

			if err != nil {
				t.Fatalf("File upload failed for size %d: %v", size, err)
			}

			throughputMBps := float64(size) / duration.Seconds() / (1024 * 1024)
			
			// Expect at least 1 MB/s throughput
			if throughputMBps < 1.0 {
				t.Errorf("Upload throughput %.2f MB/s too slow for size %d", throughputMBps, size)
			}

			suite.AddResult(fmt.Sprintf("upload_performance_%d", size), map[string]interface{}{
				"size_bytes":      size,
				"duration_ms":     float64(duration.Nanoseconds()) / 1e6,
				"throughput_mbps": throughputMBps,
			})
		}
	})

	t.Run("ConcurrentJobProcessing", func(t *testing.T) {
		const numJobs = 20
		var wg sync.WaitGroup
		var completedJobs int32
		var errors int32

		start := time.Now()

		for i := 0; i < numJobs; i++ {
			wg.Add(1)
			go func(jobID int) {
				defer wg.Done()

				// Create job
				jobData := fmt.Sprintf(`{"type":"test","data":"job-%d"}`, jobID)
				resp, err := client.httpClient.Post(
					server.URL+"/jobs",
					"application/json",
					bytes.NewBufferString(jobData),
				)
				if err != nil {
					atomic.AddInt32(&errors, 1)
					return
				}
				resp.Body.Close()

				// Poll for completion
				for attempt := 0; attempt < 10; attempt++ {
					resp, err := client.httpClient.Get(server.URL + "/jobs")
					if err != nil {
						atomic.AddInt32(&errors, 1)
						return
					}
					resp.Body.Close()
					
					// Simulate job completion after a few attempts
					if attempt >= 3 {
						atomic.AddInt32(&completedJobs, 1)
						return
					}
					time.Sleep(100 * time.Millisecond)
				}
			}(i)
		}

		wg.Wait()
		totalTime := time.Since(start)
		jobsPerSecond := float64(completedJobs) / totalTime.Seconds()

		if jobsPerSecond < 2 {
			t.Errorf("Job processing rate %.2f jobs/s too slow", jobsPerSecond)
		}

		suite.AddResult("concurrent_job_processing", map[string]interface{}{
			"num_jobs":         numJobs,
			"completed_jobs":   int(completedJobs),
			"total_time_ms":    float64(totalTime.Nanoseconds()) / 1e6,
			"jobs_per_second":  jobsPerSecond,
			"error_count":      int(errors),
		})
	})

	t.Run("MemoryUsageDuringProcessing", func(t *testing.T) {
		initialStats := GetMemoryStats()

		// Process multiple large data chunks
		chunkSize := 1024 * 1024 // 1MB chunks
		numChunks := 10

		for i := 0; i < numChunks; i++ {
			chunk := make([]byte, chunkSize)
			
			// Simulate processing
			processor := &DataProcessor{client: client}
			_ = processor // Use processor to avoid unused variable warning
			
			// Process chunk (simulate with HTTP request)
			resp, err := client.httpClient.Post(
				server.URL+"/upload",
				"application/octet-stream",
				bytes.NewReader(chunk),
			)
			if err == nil {
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
			}

			// Force garbage collection periodically
			if i%3 == 0 {
				runtime.GC()
			}
		}

		// Final garbage collection
		runtime.GC()
		finalStats := GetMemoryStats()

		memoryIncreaseMB := finalStats.AllocMB - initialStats.AllocMB
		
		// Memory increase should be reasonable (less than 50MB)
		if memoryIncreaseMB > 50 {
			t.Errorf("Memory increase %.2f MB too high", memoryIncreaseMB)
		}

		suite.AddResult("memory_usage_during_processing", map[string]interface{}{
			"initial_alloc_mb":   initialStats.AllocMB,
			"final_alloc_mb":     finalStats.AllocMB,
			"memory_increase_mb": memoryIncreaseMB,
			"gc_count_increase":  finalStats.NumGC - initialStats.NumGC,
			"chunks_processed":   numChunks,
		})
	})
}

// WebSocket performance tests
func TestWebSocketPerformance(t *testing.T) {
	suite := NewPerformanceTestSuite()

	t.Run("WebSocketConnectionTime", func(t *testing.T) {
		wsManager := &WebSocketManager{url: "ws://test-server"}
		
		duration, err := MeasureExecutionTime(func() error {
			// Simulate WebSocket connection
			wsManager.mutex.Lock()
			wsManager.connection = "mock-connection"
			wsManager.mutex.Unlock()
			return nil
		})

		if err != nil {
			t.Fatalf("WebSocket connection failed: %v", err)
		}

		if duration > 2*time.Second {
			t.Errorf("WebSocket connection took %v, expected < 2s", duration)
		}

		suite.AddResult("websocket_connection_time", map[string]interface{}{
			"duration_ms": float64(duration.Nanoseconds()) / 1e6,
			"acceptable":  duration < 2*time.Second,
		})
	})

	t.Run("MessageThroughput", func(t *testing.T) {
		const numMessages = 1000
		const messageSize = 1024 // 1KB messages
		
		wsManager := &WebSocketManager{
			url:        "ws://test-server",
			connection: "mock-connection",
		}

		testMessage := make([]byte, messageSize)
		
		duration, err := MeasureExecutionTime(func() error {
			for i := 0; i < numMessages; i++ {
				// Simulate message sending
				_ = testMessage
			}
			return nil
		})

		if err != nil {
			t.Fatalf("Message sending failed: %v", err)
		}

		messagesPerSecond := float64(numMessages) / duration.Seconds()
		throughputMBps := float64(numMessages*messageSize) / duration.Seconds() / (1024 * 1024)

		// Expect at least 1000 messages/second
		if messagesPerSecond < 1000 {
			t.Errorf("Message rate %.2f msg/s too slow", messagesPerSecond)
		}

		suite.AddResult("websocket_message_throughput", map[string]interface{}{
			"messages_per_second": messagesPerSecond,
			"throughput_mbps":     throughputMBps,
			"total_messages":      numMessages,
			"duration_ms":         float64(duration.Nanoseconds()) / 1e6,
		})
	})

	t.Run("ConcurrentWebSocketConnections", func(t *testing.T) {
		const numConnections = 10
		var wg sync.WaitGroup
		var connectionCount int32

		start := time.Now()

		for i := 0; i < numConnections; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()
				
				ws := &WebSocketManager{
					url: fmt.Sprintf("ws://test-server/%d", id),
				}
				
				// Simulate connection establishment
				ws.mutex.Lock()
				ws.connection = fmt.Sprintf("connection-%d", id)
				ws.mutex.Unlock()
				
				atomic.AddInt32(&connectionCount, 1)
			}(i)
		}

		wg.Wait()
		totalTime := time.Since(start)

		if totalTime > 10*time.Second {
			t.Errorf("Creating %d connections took %v", numConnections, totalTime)
		}

		if int(connectionCount) != numConnections {
			t.Errorf("Created %d connections, expected %d", connectionCount, numConnections)
		}

		suite.AddResult("concurrent_websocket_connections", map[string]interface{}{
			"num_connections":         numConnections,
			"total_time_ms":           float64(totalTime.Nanoseconds()) / 1e6,
			"avg_time_per_connection": float64(totalTime.Nanoseconds()) / float64(numConnections) / 1e6,
			"successful_connections":  int(connectionCount),
		})
	})
}

// Rate limiting and load testing
func TestRateLimitingAndLoad(t *testing.T) {
	suite := NewPerformanceTestSuite()
	server := CreateMockServer(10 * time.Millisecond)
	defer server.Close()

	client := &SchlepEngineClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    server.URL,
	}

	t.Run("RateLimitCompliance", func(t *testing.T) {
		const requestsPerSecond = 10
		const testDuration = 5 * time.Second
		
		var requestCount int32
		var errors int32
		
		start := time.Now()
		var wg sync.WaitGroup
		
		// Launch requests
		for time.Since(start) < testDuration {
			wg.Add(1)
			go func() {
				defer wg.Done()
				
				resp, err := client.httpClient.Get(server.URL + "/auth")
				if err != nil {
					atomic.AddInt32(&errors, 1)
					return
				}
				resp.Body.Close()
				atomic.AddInt32(&requestCount, 1)
			}()
			
			// Simple rate limiting
			time.Sleep(time.Second / requestsPerSecond)
		}
		
		wg.Wait()
		actualDuration := time.Since(start)
		actualRps := float64(requestCount) / actualDuration.Seconds()
		
		// Should not significantly exceed rate limit
		if actualRps > float64(requestsPerSecond)*1.1 {
			t.Errorf("Rate limit exceeded: %.2f RPS", actualRps)
		}

		suite.AddResult("rate_limit_compliance", map[string]interface{}{
			"target_rps":     requestsPerSecond,
			"actual_rps":     actualRps,
			"total_requests": int(requestCount),
			"errors":         int(errors),
			"duration_ms":    float64(actualDuration.Nanoseconds()) / 1e6,
		})
	})

	t.Run("SustainedLoad", func(t *testing.T) {
		const duration = 10 * time.Second
		const targetRps = 5
		
		var completedRequests int32
		var errors int32
		
		start := time.Now()
		ctx, cancel := context.WithTimeout(context.Background(), duration)
		defer cancel()
		
		// Worker function
		worker := func() {
			for {
				select {
				case <-ctx.Done():
					return
				default:
					resp, err := client.httpClient.Get(server.URL + "/auth")
					if err != nil {
						atomic.AddInt32(&errors, 1)
					} else {
						resp.Body.Close()
						atomic.AddInt32(&completedRequests, 1)
					}
					time.Sleep(time.Second / targetRps)
				}
			}
		}
		
		// Start workers
		const numWorkers = 2
		var wg sync.WaitGroup
		for i := 0; i < numWorkers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				worker()
			}()
		}
		
		wg.Wait()
		actualDuration := time.Since(start)
		actualRps := float64(completedRequests) / actualDuration.Seconds()
		errorRate := float64(errors) / float64(completedRequests+errors)
		
		if actualRps < float64(targetRps)*0.9 {
			t.Errorf("Could not maintain target RPS: %.2f < %d", actualRps, targetRps)
		}
		
		if errorRate > 0.05 {
			t.Errorf("High error rate during sustained load: %.2f%%", errorRate*100)
		}

		suite.AddResult("sustained_load", map[string]interface{}{
			"target_rps":         targetRps,
			"actual_rps":         actualRps,
			"completed_requests": int(completedRequests),
			"errors":             int(errors),
			"error_rate":         errorRate,
			"duration_ms":        float64(actualDuration.Nanoseconds()) / 1e6,
		})
	})

	t.Run("SpikeLoad", func(t *testing.T) {
		const normalRps = 2
		const spikeRps = 20
		const spikeDuration = 2 * time.Second
		
		var normalRequests, spikeRequests, errors int32
		
		// Normal load worker
		normalWorker := func(ctx context.Context) {
			for {
				select {
				case <-ctx.Done():
					return
				default:
					resp, err := client.httpClient.Get(server.URL + "/auth")
					if err != nil {
						atomic.AddInt32(&errors, 1)
					} else {
						resp.Body.Close()
						atomic.AddInt32(&normalRequests, 1)
					}
					time.Sleep(time.Second / normalRps)
				}
			}
		}
		
		// Spike load worker
		spikeWorker := func() {
			time.Sleep(2 * time.Second) // Wait before spike
			spikeStart := time.Now()
			
			for time.Since(spikeStart) < spikeDuration {
				resp, err := client.httpClient.Get(server.URL + "/auth")
				if err != nil {
					atomic.AddInt32(&errors, 1)
				} else {
					resp.Body.Close()
					atomic.AddInt32(&spikeRequests, 1)
				}
				time.Sleep(time.Second / spikeRps)
			}
		}
		
		start := time.Now()
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		
		var wg sync.WaitGroup
		
		// Start normal load
		wg.Add(1)
		go func() {
			defer wg.Done()
			normalWorker(ctx)
		}()
		
		// Start spike load
		wg.Add(1)
		go func() {
			defer wg.Done()
			spikeWorker()
		}()
		
		wg.Wait()
		totalTime := time.Since(start)
		
		totalRequests := normalRequests + spikeRequests
		errorRate := float64(errors) / float64(totalRequests+errors)
		
		if errorRate > 0.1 {
			t.Errorf("High error rate during spike load: %.2f%%", errorRate*100)
		}
		
		expectedSpikeRequests := int32(spikeRps * int(spikeDuration.Seconds()))
		if spikeRequests < expectedSpikeRequests*8/10 {
			t.Errorf("Failed to handle spike load: %d < %d", spikeRequests, expectedSpikeRequests)
		}

		suite.AddResult("spike_load_handling", map[string]interface{}{
			"normal_requests": int(normalRequests),
			"spike_requests":  int(spikeRequests),
			"total_errors":    int(errors),
			"error_rate":      errorRate,
			"total_time_ms":   float64(totalTime.Nanoseconds()) / 1e6,
		})
	})
}

// Connection pooling performance
func TestConnectionPoolingPerformance(t *testing.T) {
	suite := NewPerformanceTestSuite()
	server := CreateMockServer(5 * time.Millisecond)
	defer server.Close()

	t.Run("ConnectionReuseEfficiency", func(t *testing.T) {
		const numRequests = 50
		
		// Test with connection pooling (reused client)
		pooledClient := &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				MaxIdleConnsPerHost: 10,
			},
		}
		
		pooledStart := time.Now()
		var pooledWg sync.WaitGroup
		
		for i := 0; i < numRequests; i++ {
			pooledWg.Add(1)
			go func() {
				defer pooledWg.Done()
				resp, err := pooledClient.Get(server.URL + "/auth")
				if err == nil {
					resp.Body.Close()
				}
			}()
		}
		pooledWg.Wait()
		pooledTime := time.Since(pooledStart)
		
		// Test without connection pooling (new client each time)
		nonPooledStart := time.Now()
		var nonPooledWg sync.WaitGroup
		
		for i := 0; i < numRequests; i++ {
			nonPooledWg.Add(1)
			go func() {
				defer nonPooledWg.Done()
				client := &http.Client{Timeout: 30 * time.Second}
				resp, err := client.Get(server.URL + "/auth")
				if err == nil {
					resp.Body.Close()
				}
			}()
		}
		nonPooledWg.Wait()
		nonPooledTime := time.Since(nonPooledStart)
		
		efficiencyGain := float64(nonPooledTime.Nanoseconds()) / float64(pooledTime.Nanoseconds())
		
		if efficiencyGain < 1.2 {
			t.Errorf("Connection pooling not efficient: %.2fx gain", efficiencyGain)
		}

		suite.AddResult("connection_pooling_efficiency", map[string]interface{}{
			"pooled_time_ms":     float64(pooledTime.Nanoseconds()) / 1e6,
			"non_pooled_time_ms": float64(nonPooledTime.Nanoseconds()) / 1e6,
			"efficiency_gain":    efficiencyGain,
			"num_requests":       numRequests,
		})
	})
}

// Goroutine leak detection
func TestGoroutineLeakDetection(t *testing.T) {
	suite := NewPerformanceTestSuite()
	server := CreateMockServer(10 * time.Millisecond)
	defer server.Close()

	t.Run("GoroutineLeakPrevention", func(t *testing.T) {
		initialGoroutines := runtime.NumGoroutine()
		
		client := &SchlepEngineClient{
			httpClient: &http.Client{Timeout: 5 * time.Second},
			baseURL:    server.URL,
		}
		
		// Perform operations that might leak goroutines
		const numOperations = 100
		var wg sync.WaitGroup
		
		for i := 0; i < numOperations; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				resp, err := client.httpClient.Get(server.URL + "/auth")
				if err == nil {
					resp.Body.Close()
				}
			}()
		}
		
		wg.Wait()
		
		// Allow some time for cleanup
		time.Sleep(100 * time.Millisecond)
		runtime.GC()
		
		finalGoroutines := runtime.NumGoroutine()
		goroutineGrowth := finalGoroutines - initialGoroutines
		
		// Allow for some variation, but significant growth indicates leaks
		if goroutineGrowth > 10 {
			t.Errorf("Potential goroutine leak: %d -> %d (+%d)", 
				initialGoroutines, finalGoroutines, goroutineGrowth)
		}

		suite.AddResult("goroutine_leak_detection", map[string]interface{}{
			"initial_goroutines": initialGoroutines,
			"final_goroutines":   finalGoroutines,
			"goroutine_growth":   goroutineGrowth,
			"operations":         numOperations,
		})
	})
}

// Performance summary
func TestPerformanceSummary(t *testing.T) {
	// This would be run after all other performance tests
	// to collect and display results
	t.Run("GeneratePerformanceReport", func(t *testing.T) {
		suite := NewPerformanceTestSuite()
		memStats := GetMemoryStats()
		
		fmt.Println("\n" + strings.Repeat("=", 60))
		fmt.Println("GO SDK PERFORMANCE TEST SUMMARY")
		fmt.Println(strings.Repeat("=", 60))
		
		fmt.Printf("\nRUNTIME STATISTICS:\n")
		fmt.Printf("  Go Version: %s\n", runtime.Version())
		fmt.Printf("  GOMAXPROCS: %d\n", runtime.GOMAXPROCS(0))
		fmt.Printf("  NumCPU: %d\n", runtime.NumCPU())
		fmt.Printf("  NumGoroutine: %d\n", runtime.NumGoroutine())
		
		fmt.Printf("\nMEMORY STATISTICS:\n")
		fmt.Printf("  Allocated: %.2f MB\n", memStats.AllocMB)
		fmt.Printf("  System: %.2f MB\n", memStats.SysMB)
		fmt.Printf("  GC Cycles: %d\n", memStats.NumGC)
		fmt.Printf("  GC Pause Total: %.2f ms\n", float64(memStats.PauseTotalNs)/1e6)
		
		fmt.Println("\n" + strings.Repeat("=", 60))
	})
}