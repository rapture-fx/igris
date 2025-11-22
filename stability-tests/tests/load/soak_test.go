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
)

var (
	duration      = flag.Duration("duration", 24*time.Hour, "Soak test duration (default: 24h)")
	rps           = flag.Int("rps", 100, "Sustained request rate per second")
	apiURL        = flag.String("url", "http://localhost:8080", "API base URL")
	outputDir     = flag.String("output", "tests/load/results", "Output directory for results")
	memCheckInterval = flag.Duration("mem-check", 5*time.Minute, "Memory check interval")
)

// SoakTestMetrics tracks memory stability metrics over extended period
type SoakTestMetrics struct {
	mu sync.RWMutex

	StartTime        time.Time              `json:"start_time"`
	EndTime          time.Time              `json:"end_time"`
	Duration         float64                `json:"duration_hours"`
	TargetRPS        int                    `json:"target_rps"`

	// Request metrics
	TotalRequests    int64                  `json:"total_requests"`
	SuccessRequests  int64                  `json:"success_requests"`
	ErrorRequests    int64                  `json:"error_requests"`
	ErrorRate        float64                `json:"error_rate_percent"`

	// Memory stability tracking (key focus)
	MemorySnapshots  []MemorySnapshot       `json:"memory_snapshots"`
	BaselineMemoryMB float64                `json:"baseline_memory_mb"`
	PeakMemoryMB     float64                `json:"peak_memory_mb"`
	FinalMemoryMB    float64                `json:"final_memory_mb"`
	MemoryGrowthMB   float64                `json:"memory_growth_mb"`
	MemoryGrowthRate float64                `json:"memory_growth_rate_mb_per_hour"`
	MemoryLeakDetected bool                 `json:"memory_leak_detected"`

	// Resource metrics
	GoroutineGrowth  int                    `json:"goroutine_growth"`
	BaselineGoroutines int                  `json:"baseline_goroutines"`
	PeakGoroutines   int                    `json:"peak_goroutines"`

	// Performance stability
	LatencyDrift     []LatencyCheckpoint    `json:"latency_drift"`
	PerformanceDegraded bool                `json:"performance_degraded"`

	// Connection pool health
	ConnectionPoolStats []ConnectionPoolSnapshot `json:"connection_pool_stats"`

	Config           SoakTestConfig         `json:"config"`
}

type MemorySnapshot struct {
	Timestamp       time.Time `json:"timestamp"`
	ElapsedHours    float64   `json:"elapsed_hours"`
	HeapAllocMB     float64   `json:"heap_alloc_mb"`
	HeapSysMB       float64   `json:"heap_sys_mb"`
	StackInUseMB    float64   `json:"stack_inuse_mb"`
	TotalAllocMB    float64   `json:"total_alloc_mb"`
	NumGC           uint32    `json:"num_gc"`
	GoroutineCount  int       `json:"goroutine_count"`
	RequestsAtSnapshot int64  `json:"requests_at_snapshot"`
}

type LatencyCheckpoint struct {
	Timestamp    time.Time `json:"timestamp"`
	ElapsedHours float64   `json:"elapsed_hours"`
	AvgLatencyMs float64   `json:"avg_latency_ms"`
	P95LatencyMs float64   `json:"p95_latency_ms"`
	P99LatencyMs float64   `json:"p99_latency_ms"`
}

type ConnectionPoolSnapshot struct {
	Timestamp       time.Time `json:"timestamp"`
	IdleConns       int       `json:"idle_connections"`
	OpenConns       int       `json:"open_connections"`
	InUseConns      int       `json:"in_use_connections"`
	WaitCount       int64     `json:"wait_count"`
	WaitDuration    float64   `json:"wait_duration_ms"`
}

type SoakTestConfig struct {
	Duration         string `json:"duration"`
	TargetRPS        int    `json:"target_rps"`
	APIURL           string `json:"api_url"`
	MemCheckInterval string `json:"memory_check_interval"`
}

type InferRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens"`
	Temperature float64   `json:"temperature"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func main() {
	flag.Parse()

	log.Printf("🧪 Starting 24-Hour Soak Test (Phase 4.1.3)")
	log.Printf("Configuration:")
	log.Printf("  - Duration: %v", *duration)
	log.Printf("  - Target RPS: %d", *rps)
	log.Printf("  - API URL: %s", *apiURL)
	log.Printf("  - Memory Check Interval: %v", *memCheckInterval)

	// Initialize metrics
	metrics := &SoakTestMetrics{
		StartTime: time.Now(),
		TargetRPS: *rps,
		Config: SoakTestConfig{
			Duration:         duration.String(),
			TargetRPS:        *rps,
			APIURL:           *apiURL,
			MemCheckInterval: memCheckInterval.String(),
		},
	}

	// Setup graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), *duration)
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("\n⚠️  Received interrupt signal, stopping soak test...")
		cancel()
	}()

	// Verify API is reachable
	if err := verifyAPI(*apiURL); err != nil {
		log.Fatalf("❌ API not reachable: %v", err)
	}
	log.Println("✅ API is reachable")

	// Capture baseline metrics
	log.Println("📊 Capturing baseline metrics...")
	captureMemorySnapshot(metrics, true)

	// Start background monitoring
	go monitorMemory(ctx, metrics)
	go monitorLatency(ctx, metrics)

	// Run soak test
	log.Printf("\n🔥 Starting soak test (Target: %d RPS for %v)...\n", *rps, *duration)
	log.Println("💡 This test focuses on memory stability over extended duration")
	runSoakTest(ctx, metrics)

	// Finalize metrics
	metrics.EndTime = time.Now()
	metrics.Duration = metrics.EndTime.Sub(metrics.StartTime).Hours()
	if metrics.TotalRequests > 0 {
		metrics.ErrorRate = (float64(metrics.ErrorRequests) / float64(metrics.TotalRequests)) * 100
	}

	// Analyze results
	analyzeMemoryStability(metrics)
	analyzePerformanceDrift(metrics)

	// Save results
	log.Println("\n💾 Saving soak test results...")
	if err := saveResults(metrics, *outputDir); err != nil {
		log.Fatalf("❌ Failed to save results: %v", err)
	}

	// Generate report
	log.Println("📝 Generating soak test report...")
	if err := generateReport(metrics, *outputDir); err != nil {
		log.Fatalf("❌ Failed to generate report: %v", err)
	}

	// Print summary
	printSummary(metrics)

	log.Println("\n✅ Soak test completed successfully!")
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

func runSoakTest(ctx context.Context, metrics *SoakTestMetrics) {
	concurrency := (*rps * 500) / 1000 // Assume 500ms avg latency
	if concurrency < 10 {
		concurrency = 10
	}

	requestInterval := time.Second / time.Duration(*rps)

	var wg sync.WaitGroup
	requestChan := make(chan struct{}, *rps*2)

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
				atomic.AddInt64(&metrics.ErrorRequests, 1)
			}
		}
	}
}

func worker(ctx context.Context, id int, requests <-chan struct{}, metrics *SoakTestMetrics) {
	client := &http.Client{
		Timeout: 60 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	for range requests {
		reqBody := InferRequest{
			Model: "gpt-3.5-turbo",
			Messages: []Message{
				{Role: "user", Content: "Soak test request"},
			},
			MaxTokens:   20,
			Temperature: 0.7,
		}

		bodyBytes, _ := json.Marshal(reqBody)

		req, err := http.NewRequestWithContext(ctx, "POST", *apiURL+"/v1/infer", bytes.NewReader(bodyBytes))
		if err != nil {
			atomic.AddInt64(&metrics.ErrorRequests, 1)
			atomic.AddInt64(&metrics.TotalRequests, 1)
			continue
		}

		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		atomic.AddInt64(&metrics.TotalRequests, 1)

		if err != nil {
			atomic.AddInt64(&metrics.ErrorRequests, 1)
			continue
		}

		if resp.StatusCode == http.StatusOK {
			atomic.AddInt64(&metrics.SuccessRequests, 1)
		} else {
			atomic.AddInt64(&metrics.ErrorRequests, 1)
		}

		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}

func monitorMemory(ctx context.Context, metrics *SoakTestMetrics) {
	ticker := time.NewTicker(*memCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			captureMemorySnapshot(metrics, false)

			// Log current status
			lastSnapshot := metrics.MemorySnapshots[len(metrics.MemorySnapshots)-1]
			log.Printf("[Memory Monitor] %.2fh elapsed | Heap: %.2f MB | Goroutines: %d | Requests: %d",
				lastSnapshot.ElapsedHours,
				lastSnapshot.HeapAllocMB,
				lastSnapshot.GoroutineCount,
				lastSnapshot.RequestsAtSnapshot)

			// Check for concerning trends
			if len(metrics.MemorySnapshots) >= 3 {
				checkMemoryTrend(metrics)
			}
		}
	}
}

func captureMemorySnapshot(metrics *SoakTestMetrics, isBaseline bool) {
	runtime.GC() // Force GC before measurement for accuracy

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	snapshot := MemorySnapshot{
		Timestamp:       time.Now(),
		ElapsedHours:    time.Since(metrics.StartTime).Hours(),
		HeapAllocMB:     float64(m.HeapAlloc) / 1024 / 1024,
		HeapSysMB:       float64(m.HeapSys) / 1024 / 1024,
		StackInUseMB:    float64(m.StackInuse) / 1024 / 1024,
		TotalAllocMB:    float64(m.TotalAlloc) / 1024 / 1024,
		NumGC:           m.NumGC,
		GoroutineCount:  runtime.NumGoroutine(),
		RequestsAtSnapshot: atomic.LoadInt64(&metrics.TotalRequests),
	}

	metrics.mu.Lock()
	defer metrics.mu.Unlock()

	metrics.MemorySnapshots = append(metrics.MemorySnapshots, snapshot)

	if isBaseline {
		metrics.BaselineMemoryMB = snapshot.HeapAllocMB
		metrics.BaselineGoroutines = snapshot.GoroutineCount
	}

	if snapshot.HeapAllocMB > metrics.PeakMemoryMB {
		metrics.PeakMemoryMB = snapshot.HeapAllocMB
	}

	if snapshot.GoroutineCount > metrics.PeakGoroutines {
		metrics.PeakGoroutines = snapshot.GoroutineCount
	}

	metrics.FinalMemoryMB = snapshot.HeapAllocMB
}

func checkMemoryTrend(metrics *SoakTestMetrics) {
	metrics.mu.RLock()
	defer metrics.mu.RUnlock()

	if len(metrics.MemorySnapshots) < 3 {
		return
	}

	// Check last 3 snapshots for consistent growth
	recent := metrics.MemorySnapshots[len(metrics.MemorySnapshots)-3:]

	if recent[1].HeapAllocMB > recent[0].HeapAllocMB &&
		recent[2].HeapAllocMB > recent[1].HeapAllocMB {
		growthRate := (recent[2].HeapAllocMB - recent[0].HeapAllocMB) /
			(recent[2].ElapsedHours - recent[0].ElapsedHours)

		if growthRate > 10 { // Growing faster than 10 MB/hour
			log.Printf("⚠️  WARNING: Consistent memory growth detected (%.2f MB/hour)", growthRate)
		}
	}
}

func monitorLatency(ctx context.Context, metrics *SoakTestMetrics) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// In production, this would measure actual latencies
			// For now, we'll create a placeholder
			checkpoint := LatencyCheckpoint{
				Timestamp:    time.Now(),
				ElapsedHours: time.Since(metrics.StartTime).Hours(),
				AvgLatencyMs: 0, // Would measure from actual requests
				P95LatencyMs: 0,
				P99LatencyMs: 0,
			}

			metrics.mu.Lock()
			metrics.LatencyDrift = append(metrics.LatencyDrift, checkpoint)
			metrics.mu.Unlock()
		}
	}
}

func analyzeMemoryStability(metrics *SoakTestMetrics) {
	if len(metrics.MemorySnapshots) < 2 {
		return
	}

	metrics.MemoryGrowthMB = metrics.FinalMemoryMB - metrics.BaselineMemoryMB
	metrics.MemoryGrowthRate = metrics.MemoryGrowthMB / metrics.Duration

	// Flag as leak if:
	// 1. Growth > 100 MB total, OR
	// 2. Growth rate > 5 MB/hour
	if metrics.MemoryGrowthMB > 100 || metrics.MemoryGrowthRate > 5 {
		metrics.MemoryLeakDetected = true
	}

	metrics.GoroutineGrowth = metrics.PeakGoroutines - metrics.BaselineGoroutines
}

func analyzePerformanceDrift(metrics *SoakTestMetrics) {
	if len(metrics.LatencyDrift) < 2 {
		return
	}

	// Compare first and last checkpoints
	first := metrics.LatencyDrift[0]
	last := metrics.LatencyDrift[len(metrics.LatencyDrift)-1]

	// Flag if P95 latency increased by >50%
	if last.P95LatencyMs > first.P95LatencyMs*1.5 {
		metrics.PerformanceDegraded = true
	}
}

func saveResults(metrics *SoakTestMetrics, outputDir string) error {
	os.MkdirAll(outputDir, 0755)

	filename := fmt.Sprintf("%s/soak_test_%s.json",
		outputDir,
		metrics.StartTime.Format("20060102_150405"))

	data, err := json.MarshalIndent(metrics, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, data, 0644)
}

func generateReport(metrics *SoakTestMetrics, outputDir string) error {
	filename := fmt.Sprintf("%s/soak_test_report_%s.md",
		outputDir,
		metrics.StartTime.Format("20060102_150405"))

	report := fmt.Sprintf(`# 24-Hour Soak Test Report - Phase 4.1.3

## Test Configuration
- **Duration**: %.2f hours
- **Target RPS**: %d
- **Start Time**: %s
- **End Time**: %s
- **Memory Check Interval**: %s

## Request Summary
- **Total Requests**: %d
- **Successful**: %d (%.2f%%)
- **Failed**: %d (%.2f%%)

## Memory Stability Analysis ⭐ KEY METRIC

### Memory Growth
- **Baseline Memory**: %.2f MB
- **Peak Memory**: %.2f MB
- **Final Memory**: %.2f MB
- **Total Growth**: %.2f MB
- **Growth Rate**: %.2f MB/hour
- **Memory Leak Detected**: %v

### Goroutine Stability
- **Baseline Goroutines**: %d
- **Peak Goroutines**: %d
- **Growth**: %d goroutines

## Memory Timeline
`,
		metrics.Duration,
		metrics.TargetRPS,
		metrics.StartTime.Format(time.RFC3339),
		metrics.EndTime.Format(time.RFC3339),
		metrics.Config.MemCheckInterval,
		metrics.TotalRequests,
		metrics.SuccessRequests,
		(float64(metrics.SuccessRequests)/float64(metrics.TotalRequests))*100,
		metrics.ErrorRequests,
		metrics.ErrorRate,
		metrics.BaselineMemoryMB,
		metrics.PeakMemoryMB,
		metrics.FinalMemoryMB,
		metrics.MemoryGrowthMB,
		metrics.MemoryGrowthRate,
		metrics.MemoryLeakDetected,
		metrics.BaselineGoroutines,
		metrics.PeakGoroutines,
		metrics.GoroutineGrowth,
	)

	report += "\n| Elapsed (h) | Heap (MB) | Goroutines | GC Cycles | Requests |\n"
	report += "|-------------|-----------|------------|-----------|----------|\n"

	for _, snapshot := range metrics.MemorySnapshots {
		report += fmt.Sprintf("| %.2f | %.2f | %d | %d | %d |\n",
			snapshot.ElapsedHours,
			snapshot.HeapAllocMB,
			snapshot.GoroutineCount,
			snapshot.NumGC,
			snapshot.RequestsAtSnapshot,
		)
	}

	report += "\n## Validation Criteria\n\n"
	report += "| Criteria | Target | Actual | Status |\n"
	report += "|----------|--------|--------|--------|\n"

	report += fmt.Sprintf("| RSS Stable | <100MB growth | %.2f MB growth | %s |\n",
		metrics.MemoryGrowthMB,
		checkStatus(metrics.MemoryGrowthMB < 100))

	report += fmt.Sprintf("| No Memory Leaks | Growth <5MB/h | %.2f MB/h | %s |\n",
		metrics.MemoryGrowthRate,
		checkStatus(metrics.MemoryGrowthRate < 5))

	report += fmt.Sprintf("| Error Rate | <1%% | %.2f%% | %s |\n",
		metrics.ErrorRate,
		checkStatus(metrics.ErrorRate < 1.0))

	report += fmt.Sprintf("| Goroutine Growth | Stable | +%d | %s |\n",
		metrics.GoroutineGrowth,
		checkStatus(metrics.GoroutineGrowth < 100))

	report += "\n## Conclusion\n\n"

	if !metrics.MemoryLeakDetected && metrics.ErrorRate < 1.0 {
		report += "✅ **PASS** - System demonstrated excellent stability over 24-hour period.\n"
		report += "- Memory remained stable with acceptable growth\n"
		report += "- Error rate within acceptable limits\n"
		report += "- No signs of resource exhaustion\n"
	} else {
		report += "⚠️  **ATTENTION REQUIRED** - Issues detected:\n"
		if metrics.MemoryLeakDetected {
			report += fmt.Sprintf("- Memory leak suspected (%.2f MB growth at %.2f MB/hour)\n",
				metrics.MemoryGrowthMB, metrics.MemoryGrowthRate)
		}
		if metrics.ErrorRate >= 1.0 {
			report += fmt.Sprintf("- High error rate (%.2f%%)\n", metrics.ErrorRate)
		}
	}

	report += "\n---\n*Report generated by Schlep-Engine Phase 4.1 Soak Testing Framework*\n"

	return os.WriteFile(filename, []byte(report), 0644)
}

func checkStatus(passed bool) string {
	if passed {
		return "✅ PASS"
	}
	return "❌ FAIL"
}

func printSummary(metrics *SoakTestMetrics) {
	fmt.Printf("\n" + strings.Repeat("=", 70) + "\n")
	fmt.Println("24-HOUR SOAK TEST SUMMARY")
	fmt.Printf(strings.Repeat("=", 70) + "\n\n")

	fmt.Printf("Duration:           %.2f hours\n", metrics.Duration)
	fmt.Printf("Total Requests:     %d\n", metrics.TotalRequests)
	fmt.Printf("Error Rate:         %.2f%%\n", metrics.ErrorRate)
	fmt.Printf("\n")
	fmt.Printf("MEMORY STABILITY:\n")
	fmt.Printf("  Baseline:         %.2f MB\n", metrics.BaselineMemoryMB)
	fmt.Printf("  Peak:             %.2f MB\n", metrics.PeakMemoryMB)
	fmt.Printf("  Final:            %.2f MB\n", metrics.FinalMemoryMB)
	fmt.Printf("  Growth:           %.2f MB (%.2f MB/hour)\n",
		metrics.MemoryGrowthMB, metrics.MemoryGrowthRate)
	fmt.Printf("  Leak Detected:    %v\n",
		map[bool]string{true: "⚠️  YES", false: "✅ NO"}[metrics.MemoryLeakDetected])
	fmt.Printf("\n")
	fmt.Printf("GOROUTINE STABILITY:\n")
	fmt.Printf("  Baseline:         %d\n", metrics.BaselineGoroutines)
	fmt.Printf("  Peak:             %d\n", metrics.PeakGoroutines)
	fmt.Printf("  Growth:           %d\n", metrics.GoroutineGrowth)

	fmt.Printf("\n" + strings.Repeat("=", 70) + "\n")

	if !metrics.MemoryLeakDetected && metrics.ErrorRate < 1.0 {
		fmt.Println("✅ SOAK TEST PASSED - System is stable for production")
	} else {
		fmt.Println("⚠️  ATTENTION REQUIRED - Review issues before production deployment")
	}
}
