package router

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// setupTestRouter creates a router with isolated Prometheus registry for testing
func setupTestRouter(policy RoutingPolicy, window time.Duration) *AdaptiveRouter {
	router := &AdaptiveRouter{
		backends:        make(map[string]*Backend),
		metricsWindow:   window,
		routingPolicy:   policy,
		learningRate:    0.1,
		explorationRate: 0.15,
	}
	trustConfig := DefaultTrustConfig()
	trustConfig.BlockWithoutMinSamples = false
	router.trustTracker = NewProviderTrustTracker(trustConfig)
	router.thompsonEngine = NewThompsonSamplingEngine(DefaultThompsonSamplingConfig())

	// Use test-specific registry to avoid conflicts
	reg := prometheus.NewRegistry()
	router.routingDecisions = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "test_adaptive_routing_decisions_total",
		Help: "Test routing decisions",
	})
	router.backendLatency = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "test_adaptive_backend_latency_seconds",
		Help:    "Test backend latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"backend_id", "backend_type"})
	router.backendErrors = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "test_adaptive_backend_errors_total",
		Help: "Test backend errors",
	}, []string{"backend_id", "backend_type"})

	reg.MustRegister(router.routingDecisions)
	reg.MustRegister(router.backendLatency)
	reg.MustRegister(router.backendErrors)

	return router
}

func TestNewAdaptiveRouter(t *testing.T) {
	router := setupTestRouter(PolicyThompsonSampling, 5*time.Minute)

	if router == nil {
		t.Fatal("Expected non-nil router")
	}

	if router.routingPolicy != PolicyThompsonSampling {
		t.Errorf("routingPolicy = %v, want %v", router.routingPolicy, PolicyThompsonSampling)
	}

	if router.metricsWindow != 5*time.Minute {
		t.Errorf("metricsWindow = %v, want 5m", router.metricsWindow)
	}

	if router.learningRate != 0.1 {
		t.Errorf("learningRate = %v, want 0.1", router.learningRate)
	}

	if router.explorationRate != 0.15 {
		t.Errorf("explorationRate = %v, want 0.15", router.explorationRate)
	}
}

func TestRegisterBackend_Success(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:           "backend-1",
		URL:          "http://localhost:5000",
		Type:         BackendTypeMLPython,
		MaxCapacity:  100,
		Capabilities: []string{"inference", "batch"},
	}

	err := router.RegisterBackend(backend)
	if err != nil {
		t.Fatalf("RegisterBackend() error = %v", err)
	}

	if len(router.backends) != 1 {
		t.Errorf("backends count = %d, want 1", len(router.backends))
	}

	registered := router.backends["backend-1"]
	if !registered.Healthy {
		t.Error("Backend should be healthy after registration")
	}
}

func TestRegisterBackend_DuplicateError(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:   "backend-1",
		URL:  "http://localhost:5000",
		Type: BackendTypeMLPython,
	}

	_ = router.RegisterBackend(backend)
	err := router.RegisterBackend(backend)

	if err == nil {
		t.Error("Expected error for duplicate backend registration")
	}
}

func TestRoute_NoBackends(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference"},
	}

	_, err := router.Route(context.Background(), req)
	if err == nil {
		t.Error("Expected error when no backends available")
	}
}

func TestRoute_LeastLatency(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	// Register backends with different latencies
	backend1 := &Backend{
		ID:           "fast-backend",
		Type:         BackendTypeMLPython,
		AvgLatency:   50.0,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	backend2 := &Backend{
		ID:           "slow-backend",
		Type:         BackendTypeMLPython,
		AvgLatency:   200.0,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	_ = router.RegisterBackend(backend1)
	_ = router.RegisterBackend(backend2)

	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference"},
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Route() error = %v", err)
	}

	if decision.Backend.ID != "fast-backend" {
		t.Errorf("Selected backend = %s, want fast-backend", decision.Backend.ID)
	}
}

func TestRoute_LeastLoad(t *testing.T) {
	router := setupTestRouter(PolicyLeastLoad, 5*time.Minute)

	backend1 := &Backend{
		ID:           "busy-backend",
		Type:         BackendTypeMLPython,
		CurrentLoad:  80,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	backend2 := &Backend{
		ID:           "idle-backend",
		Type:         BackendTypeMLPython,
		CurrentLoad:  10,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	_ = router.RegisterBackend(backend1)
	_ = router.RegisterBackend(backend2)

	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference"},
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Route() error = %v", err)
	}

	if decision.Backend.ID != "idle-backend" {
		t.Errorf("Selected backend = %s, want idle-backend", decision.Backend.ID)
	}
}

func TestRoute_ThompsonSampling_Exploitation(t *testing.T) {
	router := setupTestRouter(PolicyThompsonSampling, 5*time.Minute)

	// Backend with high success rate
	backend1 := &Backend{
		ID:           "reliable-backend",
		Type:         BackendTypeMLPython,
		SuccessCount: 100,
		ErrorCount:   5,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	// Backend with low success rate
	backend2 := &Backend{
		ID:           "unreliable-backend",
		Type:         BackendTypeMLPython,
		SuccessCount: 30,
		ErrorCount:   70,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	_ = router.RegisterBackend(backend1)
	_ = router.RegisterBackend(backend2)

	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference"},
	}

	// Run multiple routing decisions and count selections
	selections := make(map[string]int)
	for i := 0; i < 50; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Route() error = %v", err)
		}
		selections[decision.Backend.ID]++
	}

	// Reliable backend should be selected more often
	reliableCount := selections["reliable-backend"]
	unreliableCount := selections["unreliable-backend"]

	if reliableCount < unreliableCount {
		t.Errorf("Thompson Sampling: reliable backend selected %d times, unreliable %d times (expected reliable > unreliable)", reliableCount, unreliableCount)
	}
}

func TestRoute_ThompsonSampling_Exploration(t *testing.T) {
	router := setupTestRouter(PolicyThompsonSampling, 5*time.Minute)
	router.explorationRate = 1.0 // Force exploration

	backend1 := &Backend{
		ID:           "backend-1",
		Type:         BackendTypeMLPython,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	backend2 := &Backend{
		ID:           "backend-2",
		Type:         BackendTypeMLPython,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	_ = router.RegisterBackend(backend1)
	_ = router.RegisterBackend(backend2)

	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference"},
	}

	// With 100% exploration, both backends should be selected
	selections := make(map[string]bool)
	for i := 0; i < 20; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Route() error = %v", err)
		}
		selections[decision.Backend.ID] = true
	}

	if len(selections) != 2 {
		t.Errorf("Expected both backends to be selected during exploration, got %d", len(selections))
	}
}

func TestRoute_WeightedRandom(t *testing.T) {
	router := setupTestRouter(PolicyWeightedRandom, 5*time.Minute)

	backend1 := &Backend{
		ID:           "fast-backend",
		Type:         BackendTypeMLPython,
		AvgLatency:   50.0,
		ErrorRate:    0.01,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	backend2 := &Backend{
		ID:           "slow-backend",
		Type:         BackendTypeMLPython,
		AvgLatency:   200.0,
		ErrorRate:    0.1,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	_ = router.RegisterBackend(backend1)
	_ = router.RegisterBackend(backend2)

	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference"},
	}

	// Run multiple routing decisions
	selections := make(map[string]int)
	for i := 0; i < 100; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Route() error = %v", err)
		}
		selections[decision.Backend.ID]++
	}

	// Fast backend should be selected more often due to lower latency
	fastCount := selections["fast-backend"]
	slowCount := selections["slow-backend"]

	if fastCount <= slowCount {
		t.Errorf("Weighted random: fast backend %d, slow backend %d (expected fast > slow)", fastCount, slowCount)
	}
}

func TestRoute_RoundRobin(t *testing.T) {
	router := setupTestRouter(PolicyRoundRobin, 5*time.Minute)

	backend1 := &Backend{
		ID:           "backend-1",
		Type:         BackendTypeMLPython,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	backend2 := &Backend{
		ID:           "backend-2",
		Type:         BackendTypeMLPython,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	_ = router.RegisterBackend(backend1)
	_ = router.RegisterBackend(backend2)

	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference"},
	}

	// With 2 backends and enough iterations, both should eventually be selected
	selections := make(map[string]int)
	for i := 0; i < 50; i++ {
		decision, err := router.Route(context.Background(), req)
		if err != nil {
			t.Fatalf("Route() error = %v", err)
		}
		selections[decision.Backend.ID]++
		time.Sleep(1 * time.Millisecond) // Vary timestamp for different modulo results
	}

	// Both backends should have been selected at least once
	if len(selections) < 2 {
		t.Errorf("Round-robin: expected both backends selected, got %d unique selections", len(selections))
	}

	// With 50 iterations, each should get roughly 20-30 selections (not exactly 25 due to timing)
	for id, count := range selections {
		if count < 10 || count > 40 {
			t.Logf("Backend %s selected %d times (expected ~25)", id, count)
		}
	}
}

func TestRoute_CapabilityFiltering(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend1 := &Backend{
		ID:           "cpu-backend",
		Type:         BackendTypeMLCPU,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	backend2 := &Backend{
		ID:           "gpu-backend",
		Type:         BackendTypeMLGPU,
		MaxCapacity:  100,
		Capabilities: []string{"inference", "batch", "gpu"},
	}

	_ = router.RegisterBackend(backend1)
	_ = router.RegisterBackend(backend2)

	// Request requiring GPU capability
	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference", "gpu"},
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Route() error = %v", err)
	}

	if decision.Backend.ID != "gpu-backend" {
		t.Errorf("Selected backend = %s, want gpu-backend", decision.Backend.ID)
	}
}

func TestRoute_HealthFiltering(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend1 := &Backend{
		ID:           "healthy-backend",
		Type:         BackendTypeMLPython,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	backend2 := &Backend{
		ID:           "unhealthy-backend",
		Type:         BackendTypeMLPython,
		MaxCapacity:  100,
		Capabilities: []string{"inference"},
	}

	_ = router.RegisterBackend(backend1)
	_ = router.RegisterBackend(backend2)

	// Mark backend2 as unhealthy
	router.MarkHealthStatus("unhealthy-backend", false)

	req := &RoutingRequest{
		ModelName:    "test-model",
		Capabilities: []string{"inference"},
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Route() error = %v", err)
	}

	if decision.Backend.ID != "healthy-backend" {
		t.Errorf("Selected backend = %s, want healthy-backend", decision.Backend.ID)
	}
}

func TestRecordResult_Success(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "test-backend",
		Type:        BackendTypeMLPython,
		MaxCapacity: 100,
	}

	_ = router.RegisterBackend(backend)

	// Record successful result
	router.RecordResult("test-backend", 100*time.Millisecond, nil)

	stats := router.GetBackendStats()
	backendStats := stats["test-backend"]

	if backendStats.SuccessCount != 1 {
		t.Errorf("SuccessCount = %d, want 1", backendStats.SuccessCount)
	}

	if backendStats.TotalRequests != 1 {
		t.Errorf("TotalRequests = %d, want 1", backendStats.TotalRequests)
	}

	if backendStats.AvgLatency == 0 {
		t.Error("AvgLatency should be updated")
	}
}

func TestRecordResult_Error(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "test-backend",
		Type:        BackendTypeMLPython,
		MaxCapacity: 100,
	}

	_ = router.RegisterBackend(backend)

	// Record failed result
	router.RecordResult("test-backend", 100*time.Millisecond, context.DeadlineExceeded)

	stats := router.GetBackendStats()
	backendStats := stats["test-backend"]

	if backendStats.ErrorCount != 1 {
		t.Errorf("ErrorCount = %d, want 1", backendStats.ErrorCount)
	}

	if backendStats.TotalRequests != 1 {
		t.Errorf("TotalRequests = %d, want 1", backendStats.TotalRequests)
	}

	if backendStats.ErrorRate == 0 {
		t.Error("ErrorRate should be updated")
	}
}

func TestRecordResult_AverageLatency(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "test-backend",
		Type:        BackendTypeMLPython,
		MaxCapacity: 100,
	}

	_ = router.RegisterBackend(backend)

	// Record multiple results
	router.RecordResult("test-backend", 100*time.Millisecond, nil)
	router.RecordResult("test-backend", 200*time.Millisecond, nil)
	router.RecordResult("test-backend", 150*time.Millisecond, nil)

	stats := router.GetBackendStats()
	backendStats := stats["test-backend"]

	if backendStats.SuccessCount != 3 {
		t.Errorf("SuccessCount = %d, want 3", backendStats.SuccessCount)
	}

	// Average should be computed via exponential moving average
	if backendStats.AvgLatency == 0 {
		t.Error("AvgLatency should be computed")
	}
}

func TestUpdateLoad(t *testing.T) {
	router := setupTestRouter(PolicyLeastLoad, 5*time.Minute)

	backend := &Backend{
		ID:          "test-backend",
		Type:        BackendTypeMLPython,
		CurrentLoad: 10,
		MaxCapacity: 100,
	}

	_ = router.RegisterBackend(backend)

	// Increase load
	router.UpdateLoad("test-backend", 5)

	stats := router.GetBackendStats()
	if stats["test-backend"].CurrentLoad != 15 {
		t.Errorf("CurrentLoad = %d, want 15", stats["test-backend"].CurrentLoad)
	}

	// Decrease load
	router.UpdateLoad("test-backend", -10)

	stats = router.GetBackendStats()
	if stats["test-backend"].CurrentLoad != 5 {
		t.Errorf("CurrentLoad = %d, want 5", stats["test-backend"].CurrentLoad)
	}

	// Should not go negative
	router.UpdateLoad("test-backend", -20)

	stats = router.GetBackendStats()
	if stats["test-backend"].CurrentLoad != 0 {
		t.Errorf("CurrentLoad = %d, want 0 (should not be negative)", stats["test-backend"].CurrentLoad)
	}
}

func TestMarkHealthStatus(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "test-backend",
		Type:        BackendTypeMLPython,
		MaxCapacity: 100,
	}

	_ = router.RegisterBackend(backend)

	// Mark unhealthy
	router.MarkHealthStatus("test-backend", false)

	stats := router.GetBackendStats()
	if stats["test-backend"].Healthy {
		t.Error("Backend should be marked unhealthy")
	}

	// Mark healthy again
	router.MarkHealthStatus("test-backend", true)

	stats = router.GetBackendStats()
	if !stats["test-backend"].Healthy {
		t.Error("Backend should be marked healthy")
	}
}

func TestGetBackendStats(t *testing.T) {
	router := setupTestRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "test-backend",
		Type:        BackendTypeMLPython,
		AvgLatency:  150.0,
		ErrorRate:   0.05,
		CurrentLoad: 25,
		MaxCapacity: 100,
	}

	_ = router.RegisterBackend(backend)

	stats := router.GetBackendStats()

	if len(stats) != 1 {
		t.Errorf("stats count = %d, want 1", len(stats))
	}

	backendStats, exists := stats["test-backend"]
	if !exists {
		t.Fatal("Expected test-backend in stats")
	}

	if backendStats.AvgLatency != 150.0 {
		t.Errorf("AvgLatency = %v, want 150.0", backendStats.AvgLatency)
	}

	if backendStats.ErrorRate != 0.05 {
		t.Errorf("ErrorRate = %v, want 0.05", backendStats.ErrorRate)
	}

	if backendStats.Type != "ml-python" {
		t.Errorf("Type = %s, want ml-python", backendStats.Type)
	}
}
