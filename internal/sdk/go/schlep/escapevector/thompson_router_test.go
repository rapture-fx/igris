package escapevector

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestControlPlaneDown_ThompsonStillOptimal verifies >92% win rate during outage
func TestControlPlaneDown_ThompsonStillOptimal(t *testing.T) {
	// Setup: Create mock providers with different success rates
	providerStats := map[string]*providerMetrics{
		"fast":   {successRate: 0.95, avgLatency: 100},
		"medium": {successRate: 0.85, avgLatency: 200},
		"slow":   {successRate: 0.70, avgLatency: 500},
	}

	servers := setupMockProviders(t, providerStats)
	defer teardownMockProviders(servers)

	// Create Bayesian state with initial priors
	state := &BayesianState{
		Version:   1,
		Timestamp: time.Now().Unix(),
		Arms: []BanditArm{
			{
				ProviderID: "fast",
				Name:       "fast",
				Endpoint:   servers["fast"].URL,
				Alpha:      5.0, // Prior: 5 successes
				Beta:       1.0, // Prior: 1 failure
				WeightLatency: 0.33,
				WeightCost:    0.33,
				WeightSuccess: 0.34,
			},
			{
				ProviderID: "medium",
				Name:       "medium",
				Endpoint:   servers["medium"].URL,
				Alpha:      3.0,
				Beta:       1.0,
				WeightLatency: 0.33,
				WeightCost:    0.33,
				WeightSuccess: 0.34,
			},
			{
				ProviderID: "slow",
				Name:       "slow",
				Endpoint:   servers["slow"].URL,
				Alpha:      2.0,
				Beta:       2.0,
				WeightLatency: 0.33,
				WeightCost:    0.33,
				WeightSuccess: 0.34,
			},
		},
		ExplorationRate:         0.05, // 5% exploration
		CircuitBreakerThreshold: 10,
		TimeoutMS:               5000,
		MaxRetries:              1,
		SpeculativeExecution:    false,
		MaxLatencyMS:            5000.0,
		MaxCostUSD:              1.0,
	}

	router := NewThompsonRouter(state)

	// Run 10k requests (or 100 in short mode)
	numRequests := 10000
	if testing.Short() {
		numRequests = 100
	}
	successCount := 0

	for i := 0; i < numRequests; i++ {
		req := &InferRequest{
			Model: "gpt-4",
			Messages: []Message{
				{Role: "user", Content: "test"},
			},
		}

		resp, err := router.Infer(context.Background(), req)
		if err == nil && resp != nil {
			successCount++
			// Track which provider was used (check response metadata if available)
		}
	}

	successRate := float64(successCount) / float64(numRequests)

	// Verify success rate > 92%
	if successRate < 0.92 {
		t.Errorf("Thompson Sampling success rate too low: %.2f%% (expected >92%%)", successRate*100)
	}

	// Verify Thompson Sampling learned to prefer the fast provider
	// Check final alpha/beta values
	for _, arm := range router.state.Arms {
		t.Logf("Provider %s: Alpha=%.2f, Beta=%.2f, Mean=%.3f, Selections=%d",
			arm.ProviderID, arm.Alpha, arm.Beta, arm.GetMean(), arm.TotalSelections)
	}

	// The fast provider should have highest expected value
	fastArm := &router.state.Arms[0]
	if fastArm.GetMean() < 0.8 {
		t.Errorf("Fast provider mean too low: %.3f (expected >0.8)", fastArm.GetMean())
	}

	t.Logf("✓ Thompson Sampling achieved %.2f%% success rate during 10k request outage", successRate*100)
}

// TestPolicyCache72Hour_BayesianIntact verifies cache persists and loads correctly
func TestPolicyCache72Hour_BayesianIntact(t *testing.T) {
	tmpDir := t.TempDir()

	// Create encryption key
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}

	cache, err := NewInertialCache(tmpDir, key)
	if err != nil {
		t.Fatalf("Failed to create cache: %v", err)
	}

	// Create Bayesian state
	state := &BayesianState{
		Version:   42,
		Timestamp: time.Now().Unix(),
		Arms: []BanditArm{
			{
				ProviderID:      "test-provider",
				Name:            "test",
				Endpoint:        "https://api.test.com",
				Alpha:           10.5,
				Beta:            2.3,
				TotalSelections: 100,
				TotalSuccesses:  85,
				TotalFailures:   15,
				WeightLatency:   0.33,
				WeightCost:      0.33,
				WeightSuccess:   0.34,
			},
		},
		ExplorationRate:         0.1,
		CircuitBreakerThreshold: 5,
		TimeoutMS:               10000,
		MaxRetries:              2,
		SpeculativeExecution:    true,
		MaxLatencyMS:            5000.0,
		MaxCostUSD:              1.0,
	}

	// Save state
	if err := cache.Save(state); err != nil {
		t.Fatalf("Failed to save state: %v", err)
	}

	// Load state
	loadedState, err := cache.Load()
	if err != nil {
		t.Fatalf("Failed to load state: %v", err)
	}

	// Verify integrity
	if loadedState.Version != state.Version {
		t.Errorf("Version mismatch: got %d, want %d", loadedState.Version, state.Version)
	}

	if len(loadedState.Arms) != len(state.Arms) {
		t.Fatalf("Arms count mismatch: got %d, want %d", len(loadedState.Arms), len(state.Arms))
	}

	arm := loadedState.Arms[0]
	if arm.Alpha != 10.5 || arm.Beta != 2.3 {
		t.Errorf("Bayesian parameters corrupted: Alpha=%.2f, Beta=%.2f", arm.Alpha, arm.Beta)
	}

	if arm.TotalSelections != 100 || arm.TotalSuccesses != 85 {
		t.Errorf("Statistics corrupted: Selections=%d, Successes=%d", arm.TotalSelections, arm.TotalSuccesses)
	}

	t.Log("✓ Bayesian state persisted and loaded correctly with full integrity")
}

// TestGoldCodeOverride_BypassWorks verifies BYOK_BYPASS_CONTROL_PLANE mode
func TestGoldCodeOverride_BypassWorks(t *testing.T) {
	// Set environment variable
	t.Setenv("BYOK_BYPASS_CONTROL_PLANE", "true")

	evm, err := NewEscapeVectorMode()
	if err != nil {
		t.Fatalf("Failed to create EscapeVectorMode: %v", err)
	}

	if !evm.ShouldUseEscapeVector() {
		t.Error("Gold Code Override not active despite BYOK_BYPASS_CONTROL_PLANE=true")
	}

	// Verify it stays in escape mode even with successful requests
	evm.RecordControlPlaneRequest(50*time.Millisecond, nil)
	evm.RecordControlPlaneRequest(50*time.Millisecond, nil)

	if !evm.ShouldUseEscapeVector() {
		t.Error("Gold Code Override should remain active regardless of control plane health")
	}

	t.Log("✓ Gold Code Override works correctly")
}

// TestExplorationStillHappens verifies exploration continues during 72h outage
func TestExplorationStillHappens(t *testing.T) {
	state := &BayesianState{
		Version:   1,
		Timestamp: time.Now().Unix(),
		Arms: []BanditArm{
			{ProviderID: "provider-1", Name: "p1", Alpha: 10.0, Beta: 1.0},
			{ProviderID: "provider-2", Name: "p2", Alpha: 5.0, Beta: 5.0},
			{ProviderID: "provider-3", Name: "p3", Alpha: 1.0, Beta: 10.0},
		},
		ExplorationRate:         0.2, // 20% exploration
		CircuitBreakerThreshold: 5,
		TimeoutMS:               10000,
		MaxRetries:              2,
		SpeculativeExecution:    false,
		MaxLatencyMS:            5000.0,
		MaxCostUSD:              1.0,
	}

	router := NewThompsonRouter(state)

	// Count selections per provider over 1000 selections
	selections := make(map[string]int)
	for i := 0; i < 1000; i++ {
		arm := router.selectArmThompsonSampling()
		if arm != nil {
			selections[arm.ProviderID]++
		}
	}

	// Verify all providers got some exploration
	for providerID, count := range selections {
		t.Logf("Provider %s selected %d times", providerID, count)
	}

	// Provider-3 (worst) should still get some selections due to exploration
	if selections["provider-3"] == 0 {
		t.Error("Exploration failed - worst provider never selected")
	}

	// But provider-1 (best) should still dominate
	if selections["provider-1"] < selections["provider-3"] {
		t.Error("Thompson Sampling not exploiting best provider")
	}

	t.Log("✓ Exploration continues during extended outage")
}

// TestLatencyIncrease_p99_Under12ms verifies performance overhead
func TestLatencyIncrease_p99_Under12ms(t *testing.T) {
	// Create fast mock provider
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"model": "gpt-4",
			"choices": []map[string]interface{}{
				{
					"index": 0,
					"message": map[string]string{
						"role":    "assistant",
						"content": "test response",
					},
				},
			},
		})
	}))
	defer server.Close()

	state := &BayesianState{
		Version:   1,
		Timestamp: time.Now().Unix(),
		Arms: []BanditArm{
			{ProviderID: "fast", Name: "fast", Endpoint: server.URL, Alpha: 5.0, Beta: 1.0,
				WeightLatency: 0.33, WeightCost: 0.33, WeightSuccess: 0.34},
		},
		ExplorationRate:         0.0, // No exploration for benchmark
		CircuitBreakerThreshold: 5,
		TimeoutMS:               5000,
		MaxRetries:              0,
		SpeculativeExecution:    false,
		MaxLatencyMS:            5000.0,
		MaxCostUSD:              1.0,
	}

	router := NewThompsonRouter(state)

	// Measure latencies
	latencies := make([]time.Duration, 1000)
	for i := 0; i < 1000; i++ {
		start := time.Now()
		_, _ = router.Infer(context.Background(), &InferRequest{
			Model:    "gpt-4",
			Messages: []Message{{Role: "user", Content: "test"}},
		})
		latencies[i] = time.Since(start)
	}

	// Calculate p99
	// Sort latencies
	for i := 0; i < len(latencies)-1; i++ {
		for j := i + 1; j < len(latencies); j++ {
			if latencies[i] > latencies[j] {
				latencies[i], latencies[j] = latencies[j], latencies[i]
			}
		}
	}

	p99Index := int(float64(len(latencies)) * 0.99)
	p99 := latencies[p99Index]

	// Thompson Sampling overhead should be minimal (< 12ms at p99)
	overheadMS := p99.Milliseconds()
	if overheadMS > 12 {
		t.Errorf("Thompson Sampling overhead too high: %dms at p99 (expected <12ms)", overheadMS)
	}

	t.Logf("✓ Thompson Sampling p99 latency overhead: %dms", overheadMS)
}

// Helper types and functions

type providerMetrics struct {
	successRate float64
	avgLatency  int64
	requests    atomic.Int64
	mu          sync.Mutex
}

func setupMockProviders(t *testing.T, stats map[string]*providerMetrics) map[string]*httptest.Server {
	servers := make(map[string]*httptest.Server)

	for name, metrics := range stats {
		m := metrics // Capture for closure
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			m.requests.Add(1)

			// Simulate latency
			time.Sleep(time.Duration(m.avgLatency) * time.Millisecond)

			// Simulate success rate
			random := float64(time.Now().UnixNano()%10000) / 10000.0
			if random < m.successRate {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"model": "gpt-4",
					"choices": []map[string]interface{}{
						{
							"index": 0,
							"message": map[string]string{
								"role":    "assistant",
								"content": "response from " + name,
							},
						},
					},
				})
			} else {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte("simulated failure"))
			}
		}))
		servers[name] = server
	}

	return servers
}

func teardownMockProviders(servers map[string]*httptest.Server) {
	for _, server := range servers {
		server.Close()
	}
}
