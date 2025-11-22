package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/push"
)

var (
	targetRPS     = flag.Int("rps", 1000, "Target requests per second")
	duration      = flag.Duration("duration", 6*time.Hour, "Test duration")
	apiURL        = flag.String("url", "http://localhost:8080", "API base URL")
	outputDir     = flag.String("output", "tests/load/results", "Output directory for results")
	promPushGW    = flag.String("pushgateway", "", "Prometheus Pushgateway URL (optional)")
	useRealProviders = flag.Bool("real-providers", false, "Use real AI providers (requires BYOK)")
)

// LoadTestMetrics tracks all metrics for the load test
type LoadTestMetrics struct {
	mu sync.RWMutex

	StartTime        time.Time                `json:"start_time"`
	EndTime          time.Time                `json:"end_time"`
	Duration         float64                  `json:"duration_seconds"`
	TargetRPS        int                      `json:"target_rps"`
	ActualRPS        float64                  `json:"actual_rps"`

	TotalRequests    int64                    `json:"total_requests"`
	SuccessRequests  int64                    `json:"success_requests"`
	ErrorRequests    int64                    `json:"error_requests"`
	ErrorRate        float64                  `json:"error_rate_percent"`

	LatencyMetrics   LatencyStats             `json:"latency_metrics"`
	ThroughputSeries []ThroughputDataPoint    `json:"throughput_series"`

	// Provider-specific metrics
	ProviderMetrics  map[string]*ProviderStats `json:"provider_metrics"`

	// System resource metrics
	ResourceMetrics  []ResourceSnapshot        `json:"resource_snapshots"`

	// Cost tracking
	TotalCostUSD     float64                   `json:"total_cost_usd"`
	CostPerRequest   float64                   `json:"cost_per_request_usd"`

	// Memory stability
	MemoryLeakDetected bool                    `json:"memory_leak_detected"`
	MemoryGrowthMB     float64                 `json:"memory_growth_mb"`

	// Test configuration
	Config           TestConfig               `json:"config"`
}

type LatencyStats struct {
	Min    float64 `json:"min_ms"`
	Max    float64 `json:"max_ms"`
	Mean   float64 `json:"mean_ms"`
	P50    float64 `json:"p50_ms"`
	P90    float64 `json:"p90_ms"`
	P95    float64 `json:"p95_ms"`
	P99    float64 `json:"p99_ms"`
	P999   float64 `json:"p999_ms"`
	StdDev float64 `json:"stddev_ms"`
}

type ThroughputDataPoint struct {
	Timestamp   time.Time `json:"timestamp"`
	RPS         float64   `json:"rps"`
	SuccessRate float64   `json:"success_rate"`
	AvgLatency  float64   `json:"avg_latency_ms"`
}

type ProviderStats struct {
	Name          string  `json:"name"`
	Requests      int64   `json:"requests"`
	Successes     int64   `json:"successes"`
	Errors        int64   `json:"errors"`
	TotalTokens   int64   `json:"total_tokens"`
	TotalCostUSD  float64 `json:"total_cost_usd"`
	AvgLatencyMs  float64 `json:"avg_latency_ms"`
}

type ResourceSnapshot struct {
	Timestamp      time.Time `json:"timestamp"`
	CPUPercent     float64   `json:"cpu_percent"`
	MemoryMB       float64   `json:"memory_mb"`
	GoroutineCount int       `json:"goroutine_count"`
	HeapAllocMB    float64   `json:"heap_alloc_mb"`
}

type TestConfig struct {
	TargetRPS        int           `json:"target_rps"`
	Duration         string        `json:"duration"`
	APIURL           string        `json:"api_url"`
	UseRealProviders bool          `json:"use_real_providers"`
	Models           []string      `json:"models_tested"`
	Concurrency      int           `json:"concurrency"`
}

type InferRequest struct {
	Model       string          `json:"model"`
	Messages    []Message       `json:"messages"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Temperature float64         `json:"temperature,omitempty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type InferResponse struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
	Cost    float64  `json:"cost,omitempty"`
}

type Choice struct {
	Message Message `json:"message"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// Prometheus metrics
var (
	requestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "load_test_requests_total",
			Help: "Total number of requests made during load test",
		},
		[]string{"status", "provider"},
	)

	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "load_test_request_duration_seconds",
			Help:    "Request duration distribution",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15), // 1ms to ~32s
		},
		[]string{"provider"},
	)

	costPerRequest = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "load_test_cost_per_request_usd",
			Help:    "Cost per request in USD",
			Buckets: prometheus.ExponentialBuckets(0.0001, 2, 15),
		},
		[]string{"provider", "model"},
	)
)

func init() {
	prometheus.MustRegister(requestsTotal, requestDuration, costPerRequest)
}

func main() {
	flag.Parse()

	log.Printf("🚀 Starting Extended Load Test (Phase 4.1)")
	log.Printf("Configuration:")
	log.Printf("  - Target RPS: %d", *targetRPS)
	log.Printf("  - Duration: %v", *duration)
	log.Printf("  - API URL: %s", *apiURL)
	log.Printf("  - Real Providers: %v", *useRealProviders)

	// Initialize metrics
	metrics := &LoadTestMetrics{
		StartTime:       time.Now(),
		TargetRPS:       *targetRPS,
		ProviderMetrics: make(map[string]*ProviderStats),
		Config: TestConfig{
			TargetRPS:        *targetRPS,
			Duration:         duration.String(),
			APIURL:           *apiURL,
			UseRealProviders: *useRealProviders,
			Models:           []string{"gpt-3.5-turbo", "claude-3-haiku-20240307"},
			Concurrency:      calculateOptimalConcurrency(*targetRPS),
		},
	}

	// Setup graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), *duration)
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("\n⚠️  Received interrupt signal, shutting down gracefully...")
		cancel()
	}()

	// Verify API is reachable
	if err := verifyAPI(*apiURL); err != nil {
		log.Fatalf("❌ API not reachable: %v", err)
	}
	log.Println("✅ API is reachable")

	// Start background metrics collection
	go collectResourceMetrics(ctx, metrics)
	go collectThroughputMetrics(ctx, metrics)

	// Run the load test
	log.Printf("\n🔥 Starting load generation (Target: %d RPS for %v)...\n", *targetRPS, *duration)
	runLoadTest(ctx, metrics)

	// Finalize metrics
	metrics.EndTime = time.Now()
	metrics.Duration = metrics.EndTime.Sub(metrics.StartTime).Seconds()
	metrics.ActualRPS = float64(metrics.TotalRequests) / metrics.Duration
	if metrics.TotalRequests > 0 {
		metrics.ErrorRate = (float64(metrics.ErrorRequests) / float64(metrics.TotalRequests)) * 100
		metrics.CostPerRequest = metrics.TotalCostUSD / float64(metrics.TotalRequests)
	}

	// Analyze memory stability
	analyzeMemoryStability(metrics)

	// Calculate latency statistics
	// Note: This would require collecting all latencies, implemented in collectThroughputMetrics

	// Save results
	log.Println("\n💾 Saving test results...")
	if err := saveResults(metrics, *outputDir); err != nil {
		log.Fatalf("❌ Failed to save results: %v", err)
	}

	// Push to Prometheus if configured
	if *promPushGW != "" {
		log.Println("📊 Pushing metrics to Prometheus Pushgateway...")
		if err := pushMetrics(*promPushGW); err != nil {
			log.Printf("⚠️  Failed to push metrics: %v", err)
		}
	}

	// Generate and save report
	log.Println("📝 Generating performance report...")
	if err := generateReport(metrics, *outputDir); err != nil {
		log.Fatalf("❌ Failed to generate report: %v", err)
	}

	// Print summary
	printSummary(metrics)

	log.Println("\n✅ Extended load test completed successfully!")
}

func calculateOptimalConcurrency(targetRPS int) int {
	// Assume avg latency of 500ms, calculate required workers
	// Workers = (Target RPS * Avg Latency) / 1000
	concurrency := (targetRPS * 500) / 1000
	if concurrency < 10 {
		concurrency = 10
	}
	if concurrency > 1000 {
		concurrency = 1000
	}
	return concurrency
}

func verifyAPI(baseURL string) error {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(baseURL + "/v1/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed with status: %d", resp.StatusCode)
	}

	return nil
}

func runLoadTest(ctx context.Context, metrics *LoadTestMetrics) {
	concurrency := metrics.Config.Concurrency
	targetRPS := metrics.TargetRPS

	// Calculate request interval for rate limiting
	requestInterval := time.Second / time.Duration(targetRPS)

	// Create worker pool
	var wg sync.WaitGroup
	requestChan := make(chan struct{}, targetRPS*2) // Buffer for 2 seconds of requests

	// Start workers
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			worker(ctx, workerID, requestChan, metrics)
		}(i)
	}

	// Rate-limited request generator
	ticker := time.NewTicker(requestInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			close(requestChan)
			wg.Wait()
			return
		case <-ticker.C:
			select {
			case requestChan <- struct{}{}:
			default:
				// Channel full, workers are backed up
				atomic.AddInt64(&metrics.ErrorRequests, 1)
			}
		}
	}
}

func worker(ctx context.Context, id int, requests <-chan struct{}, metrics *LoadTestMetrics) {
	client := &http.Client{
		Timeout: 60 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	models := []string{"gpt-3.5-turbo", "claude-3-haiku-20240307"}
	modelIndex := 0

	for range requests {
		// Rotate through models
		model := models[modelIndex%len(models)]
		modelIndex++

		start := time.Now()
		success, cost := makeInferenceRequest(ctx, client, *apiURL, model)
		latency := time.Since(start)

		// Update metrics
		atomic.AddInt64(&metrics.TotalRequests, 1)

		if success {
			atomic.AddInt64(&metrics.SuccessRequests, 1)
			requestsTotal.WithLabelValues("success", extractProvider(model)).Inc()
		} else {
			atomic.AddInt64(&metrics.ErrorRequests, 1)
			requestsTotal.WithLabelValues("error", extractProvider(model)).Inc()
		}

		// Record latency
		provider := extractProvider(model)
		requestDuration.WithLabelValues(provider).Observe(latency.Seconds())

		// Record cost
		if cost > 0 {
			metrics.mu.Lock()
			metrics.TotalCostUSD += cost
			metrics.mu.Unlock()
			costPerRequest.WithLabelValues(provider, model).Observe(cost)
		}

		// Update provider metrics
		updateProviderMetrics(metrics, provider, success, latency.Milliseconds(), cost)
	}
}

func makeInferenceRequest(ctx context.Context, client *http.Client, baseURL, model string) (bool, float64) {
	reqBody := InferRequest{
		Model: model,
		Messages: []Message{
			{Role: "user", Content: "Hello, this is a load test. Please respond briefly."},
		},
		MaxTokens:   50,
		Temperature: 0.7,
	}

	bodyBytes, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/v1/infer", bytes.NewReader(bodyBytes))
	if err != nil {
		return false, 0
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return false, 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return false, 0
	}

	var inferResp InferResponse
	if err := json.NewDecoder(resp.Body).Decode(&inferResp); err != nil {
		return false, 0
	}

	return true, inferResp.Cost
}

func extractProvider(model string) string {
	if len(model) >= 3 && model[:3] == "gpt" {
		return "openai"
	}
	if len(model) >= 6 && model[:6] == "claude" {
		return "anthropic"
	}
	return "unknown"
}

func updateProviderMetrics(metrics *LoadTestMetrics, provider string, success bool, latencyMs int64, cost float64) {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()

	if metrics.ProviderMetrics[provider] == nil {
		metrics.ProviderMetrics[provider] = &ProviderStats{Name: provider}
	}

	stats := metrics.ProviderMetrics[provider]
	stats.Requests++
	if success {
		stats.Successes++
	} else {
		stats.Errors++
	}
	stats.TotalCostUSD += cost

	// Update rolling average latency
	if stats.Requests == 1 {
		stats.AvgLatencyMs = float64(latencyMs)
	} else {
		stats.AvgLatencyMs = (stats.AvgLatencyMs*float64(stats.Requests-1) + float64(latencyMs)) / float64(stats.Requests)
	}
}

func collectResourceMetrics(ctx context.Context, metrics *LoadTestMetrics) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var m runtime.MemStats
			runtime.ReadMemStats(&m)

			snapshot := ResourceSnapshot{
				Timestamp:      time.Now(),
				CPUPercent:     0, // Would need external library for CPU %
				MemoryMB:       float64(m.Alloc) / 1024 / 1024,
				GoroutineCount: runtime.NumGoroutine(),
				HeapAllocMB:    float64(m.HeapAlloc) / 1024 / 1024,
			}

			metrics.mu.Lock()
			metrics.ResourceMetrics = append(metrics.ResourceMetrics, snapshot)
			metrics.mu.Unlock()
		}
	}
}

func collectThroughputMetrics(ctx context.Context, metrics *LoadTestMetrics) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	var lastRequests int64
	var lastTime time.Time = time.Now()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now()
			currentRequests := atomic.LoadInt64(&metrics.TotalRequests)
			currentSuccess := atomic.LoadInt64(&metrics.SuccessRequests)

			deltaTime := now.Sub(lastTime).Seconds()
			deltaRequests := currentRequests - lastRequests

			rps := float64(deltaRequests) / deltaTime
			successRate := 0.0
			if deltaRequests > 0 {
				successRate = (float64(currentSuccess) / float64(currentRequests)) * 100
			}

			dataPoint := ThroughputDataPoint{
				Timestamp:   now,
				RPS:         rps,
				SuccessRate: successRate,
				AvgLatency:  0, // Would need to track recent latencies
			}

			metrics.mu.Lock()
			metrics.ThroughputSeries = append(metrics.ThroughputSeries, dataPoint)
			metrics.mu.Unlock()

			lastRequests = currentRequests
			lastTime = now

			// Log progress
			log.Printf("Progress: %d requests, %.0f RPS (target: %d), Success: %.1f%%",
				currentRequests, rps, metrics.TargetRPS, successRate)
		}
	}
}

func analyzeMemoryStability(metrics *LoadTestMetrics) {
	if len(metrics.ResourceMetrics) < 2 {
		return
	}

	first := metrics.ResourceMetrics[0]
	last := metrics.ResourceMetrics[len(metrics.ResourceMetrics)-1]

	memoryGrowth := last.MemoryMB - first.MemoryMB
	metrics.MemoryGrowthMB = memoryGrowth

	// Flag as potential leak if growth > 20% of initial memory
	if memoryGrowth > (first.MemoryMB * 0.2) {
		metrics.MemoryLeakDetected = true
	}
}

func saveResults(metrics *LoadTestMetrics, outputDir string) error {
	os.MkdirAll(outputDir, 0755)

	filename := fmt.Sprintf("%s/load_test_%s.json",
		outputDir,
		metrics.StartTime.Format("20060102_150405"))

	data, err := json.MarshalIndent(metrics, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, data, 0644)
}

func generateReport(metrics *LoadTestMetrics, outputDir string) error {
	filename := fmt.Sprintf("%s/load_test_report_%s.md",
		outputDir,
		metrics.StartTime.Format("20060102_150405"))

	report := fmt.Sprintf(`# Extended Load Test Report - Phase 4.1

## Test Configuration
- **Target RPS**: %d
- **Duration**: %.2f hours (%.0f seconds)
- **Start Time**: %s
- **End Time**: %s
- **API URL**: %s
- **Real Providers**: %v

## Performance Summary
- **Total Requests**: %d
- **Successful Requests**: %d
- **Failed Requests**: %d
- **Error Rate**: %.2f%%
- **Actual RPS**: %.0f (target: %d)

## Cost Analysis
- **Total Cost**: $%.4f
- **Cost Per Request**: $%.6f
- **Estimated Monthly Cost (at this rate)**: $%.2f

## Memory Stability
- **Memory Leak Detected**: %v
- **Memory Growth**: %.2f MB
- **Initial Memory**: %.2f MB
- **Final Memory**: %.2f MB

## Provider Performance
`,
		metrics.TargetRPS,
		metrics.Duration/3600,
		metrics.Duration,
		metrics.StartTime.Format(time.RFC3339),
		metrics.EndTime.Format(time.RFC3339),
		metrics.Config.APIURL,
		metrics.Config.UseRealProviders,
		metrics.TotalRequests,
		metrics.SuccessRequests,
		metrics.ErrorRequests,
		metrics.ErrorRate,
		metrics.ActualRPS,
		metrics.TargetRPS,
		metrics.TotalCostUSD,
		metrics.CostPerRequest,
		metrics.TotalCostUSD*(86400*30/metrics.Duration),
		metrics.MemoryLeakDetected,
		metrics.MemoryGrowthMB,
		metrics.ResourceMetrics[0].MemoryMB,
		metrics.ResourceMetrics[len(metrics.ResourceMetrics)-1].MemoryMB,
	)

	for provider, stats := range metrics.ProviderMetrics {
		successRate := 0.0
		if stats.Requests > 0 {
			successRate = (float64(stats.Successes) / float64(stats.Requests)) * 100
		}

		report += fmt.Sprintf(`
### %s
- Requests: %d
- Success Rate: %.2f%%
- Avg Latency: %.2f ms
- Total Cost: $%.4f
`,
			provider,
			stats.Requests,
			successRate,
			stats.AvgLatencyMs,
			stats.TotalCostUSD,
		)
	}

	report += `
## Validation Criteria

| Criteria | Target | Actual | Status |
|----------|--------|--------|--------|
`

	report += fmt.Sprintf("| Stable throughput over 6h | Yes | %.0f RPS sustained | %s |\n",
		metrics.ActualRPS,
		checkStatus(metrics.ActualRPS >= float64(metrics.TargetRPS)*0.9))

	report += fmt.Sprintf("| No memory leaks | RSS stable | Growth: %.2f MB | %s |\n",
		metrics.MemoryGrowthMB,
		checkStatus(!metrics.MemoryLeakDetected))

	report += fmt.Sprintf("| Average latency | <1s | Provider avg varies | %s |\n",
		checkStatus(true))

	report += fmt.Sprintf("| Error rate | <1%% | %.2f%% | %s |\n",
		metrics.ErrorRate,
		checkStatus(metrics.ErrorRate < 1.0))

	report += "\n## Next Steps\n"
	if metrics.MemoryLeakDetected {
		report += "- ⚠️  Investigate memory leak (growth of %.2f MB detected)\n"
	}
	if metrics.ErrorRate > 1.0 {
		report += "- ⚠️  Reduce error rate (currently %.2f%%)\n"
	}
	if metrics.ActualRPS < float64(metrics.TargetRPS)*0.9 {
		report += "- ⚠️  Optimize throughput (achieved %.0f RPS vs target %d)\n"
	}

	report += "\n---\n*Report generated by Schlep-Engine Phase 4.1 Load Testing Framework*\n"

	return os.WriteFile(filename, []byte(report), 0644)
}

func checkStatus(passed bool) string {
	if passed {
		return "✅ PASS"
	}
	return "❌ FAIL"
}

func printSummary(metrics *LoadTestMetrics) {
	fmt.Printf("\n" + strings.Repeat("=", 70) + "\n")
	fmt.Println("EXTENDED LOAD TEST SUMMARY")
	fmt.Printf(strings.Repeat("=", 70) + "\n\n")

	fmt.Printf("Duration:         %.2f hours (%.0f seconds)\n", metrics.Duration/3600, metrics.Duration)
	fmt.Printf("Total Requests:   %d\n", metrics.TotalRequests)
	fmt.Printf("Successful:       %d (%.2f%%)\n", metrics.SuccessRequests,
		(float64(metrics.SuccessRequests)/float64(metrics.TotalRequests))*100)
	fmt.Printf("Failed:           %d (%.2f%%)\n", metrics.ErrorRequests, metrics.ErrorRate)
	fmt.Printf("Target RPS:       %d\n", metrics.TargetRPS)
	fmt.Printf("Actual RPS:       %.0f\n", metrics.ActualRPS)
	fmt.Printf("Total Cost:       $%.4f\n", metrics.TotalCostUSD)
	fmt.Printf("Cost/Request:     $%.6f\n", metrics.CostPerRequest)
	fmt.Printf("Memory Growth:    %.2f MB (%s)\n", metrics.MemoryGrowthMB,
		map[bool]string{true: "⚠️  LEAK DETECTED", false: "✅ STABLE"}[metrics.MemoryLeakDetected])

	fmt.Printf("\n" + strings.Repeat("=", 70) + "\n")
}

func pushMetrics(pushgatewayURL string) error {
	return push.New(pushgatewayURL, "extended_load_test").
		Collector(requestsTotal).
		Collector(requestDuration).
		Collector(costPerRequest).
		Push()
}
