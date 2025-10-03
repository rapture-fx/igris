package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"

	"github.com/montanaflynn/stats"
)

// LatencyMetrics contains latency statistics
type LatencyMetrics struct {
	P50        float64 `json:"p50_ms"`
	P95        float64 `json:"p95_ms"`
	P99        float64 `json:"p99_ms"`
	P999       float64 `json:"p999_ms"`
	Mean       float64 `json:"mean_ms"`
	Min        float64 `json:"min_ms"`
	Max        float64 `json:"max_ms"`
	StdDev     float64 `json:"std_dev_ms"`
	TotalCalls int     `json:"total_calls"`
}

// ThroughputMetrics contains throughput statistics
type ThroughputMetrics struct {
	RequestsPerSecond float64 `json:"requests_per_second"`
	TotalRequests     int     `json:"total_requests"`
	Duration          float64 `json:"duration_seconds"`
}

// ResourceMetrics contains system resource usage
type ResourceMetrics struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryMB      float64 `json:"memory_mb"`
	MemoryPercent float64 `json:"memory_percent"`
	Goroutines    int     `json:"goroutines"`
}

// EndpointBenchmark contains results for a single endpoint
type EndpointBenchmark struct {
	Endpoint   string            `json:"endpoint"`
	Method     string            `json:"method"`
	Latency    LatencyMetrics    `json:"latency"`
	Throughput ThroughputMetrics `json:"throughput"`
	Resources  ResourceMetrics   `json:"resources"`
	Errors     int               `json:"errors"`
	ErrorRate  float64           `json:"error_rate_percent"`
}

// BenchmarkResults contains all benchmark results
type BenchmarkResults struct {
	Timestamp     time.Time                    `json:"timestamp"`
	Architecture  string                       `json:"architecture"`
	TestDuration  float64                      `json:"test_duration_seconds"`
	Concurrency   int                          `json:"concurrency"`
	Endpoints     map[string]EndpointBenchmark `json:"endpoints"`
	StressTests   map[string]StressTestResult  `json:"stress_tests"`
	ValidationResults ValidationResults        `json:"validation_results"`
}

// StressTestResult contains results for stress tests
type StressTestResult struct {
	Type           string             `json:"type"`
	Duration       float64            `json:"duration_seconds"`
	TotalRequests  int                `json:"total_requests"`
	SuccessRate    float64            `json:"success_rate_percent"`
	LatencyMetrics LatencyMetrics     `json:"latency"`
	ResourcePeaks  ResourceMetrics    `json:"resource_peaks"`
	Notes          string             `json:"notes"`
}

// ValidationResults contains validation test results
type ValidationResults struct {
	MemoryLeakTest    MemoryLeakResult    `json:"memory_leak_test"`
	GRPCRecoveryTest  GRPCRecoveryResult  `json:"grpc_recovery_test"`
	HorizontalScaling ScalingTestResult   `json:"horizontal_scaling"`
}

// MemoryLeakResult contains memory leak test results
type MemoryLeakResult struct {
	Passed           bool    `json:"passed"`
	TotalCalls       int     `json:"total_calls"`
	InitialMemoryMB  float64 `json:"initial_memory_mb"`
	FinalMemoryMB    float64 `json:"final_memory_mb"`
	MemoryGrowthMB   float64 `json:"memory_growth_mb"`
	GrowthPercent    float64 `json:"growth_percent"`
	AcceptableGrowth bool    `json:"acceptable_growth"`
}

// GRPCRecoveryResult contains gRPC recovery test results
type GRPCRecoveryResult struct {
	Passed              bool    `json:"passed"`
	ReconnectAttempts   int     `json:"reconnect_attempts"`
	ReconnectTimeMs     float64 `json:"reconnect_time_ms"`
	SuccessfulRecovery  bool    `json:"successful_recovery"`
	PostRecoveryLatency float64 `json:"post_recovery_latency_ms"`
}

// ScalingTestResult contains horizontal scaling test results
type ScalingTestResult struct {
	Passed            bool    `json:"passed"`
	Replicas          int     `json:"replicas"`
	RequestsPerReplica int    `json:"requests_per_replica"`
	AvgLatencyMs      float64 `json:"avg_latency_ms"`
	LoadBalanced      bool    `json:"load_balanced"`
}

// CalculateLatencyMetrics calculates latency statistics from durations
func CalculateLatencyMetrics(durations []float64) LatencyMetrics {
	if len(durations) == 0 {
		return LatencyMetrics{}
	}

	sort.Float64s(durations)

	p50, _ := stats.Percentile(durations, 50)
	p95, _ := stats.Percentile(durations, 95)
	p99, _ := stats.Percentile(durations, 99)
	p999, _ := stats.Percentile(durations, 99.9)
	mean, _ := stats.Mean(durations)
	stddev, _ := stats.StandardDeviation(durations)

	return LatencyMetrics{
		P50:        p50,
		P95:        p95,
		P99:        p99,
		P999:       p999,
		Mean:       mean,
		Min:        durations[0],
		Max:        durations[len(durations)-1],
		StdDev:     stddev,
		TotalCalls: len(durations),
	}
}

// SaveResults saves benchmark results to JSON file
func SaveResults(results *BenchmarkResults, filename string) error {
	data, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal results: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write results file: %w", err)
	}

	return nil
}

// LoadResults loads benchmark results from JSON file
func LoadResults(filename string) (*BenchmarkResults, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read results file: %w", err)
	}

	var results BenchmarkResults
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, fmt.Errorf("failed to unmarshal results: %w", err)
	}

	return &results, nil
}

// FormatLatencyTable generates a formatted latency table
func FormatLatencyTable(latency LatencyMetrics) string {
	return fmt.Sprintf(`
| Metric     | Value      |
|------------|------------|
| **P50**    | %.2fms    |
| **P95**    | %.2fms    |
| **P99**    | %.2fms    |
| **P99.9**  | %.2fms    |
| **Mean**   | %.2fms    |
| **Min**    | %.2fms    |
| **Max**    | %.2fms    |
| **StdDev** | %.2fms    |
`,
		latency.P50,
		latency.P95,
		latency.P99,
		latency.P999,
		latency.Mean,
		latency.Min,
		latency.Max,
		latency.StdDev,
	)
}
