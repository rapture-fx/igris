package router

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// AdaptiveRouter implements intelligent routing based on performance metrics
type AdaptiveRouter struct {
	backends       map[string]*Backend
	mu             sync.RWMutex
	metricsWindow  time.Duration
	routingPolicy  RoutingPolicy
	learningRate   float64
	explorationRate float64

	// Metrics
	routingDecisions prometheus.Counter
	backendLatency   *prometheus.HistogramVec
	backendErrors    *prometheus.CounterVec
}

// Backend represents an inference backend with performance metrics
type Backend struct {
	ID              string
	URL             string
	Type            BackendType
	Capabilities    []string

	// Performance metrics (sliding window)
	AvgLatency      float64
	ErrorRate       float64
	CurrentLoad     int
	MaxCapacity     int
	SuccessCount    int64
	ErrorCount      int64
	TotalRequests   int64

	// Health status
	Healthy         bool
	LastHealthCheck time.Time

	mu sync.RWMutex
}

type BackendType string

const (
	BackendTypeMLPython  BackendType = "ml-python"
	BackendTypeMLGPU     BackendType = "ml-gpu"
	BackendTypeMLCPU     BackendType = "ml-cpu"
	BackendTypeONNX      BackendType = "onnx-runtime"
	BackendTypeRustFFI   BackendType = "rust-ffi"
)

type RoutingPolicy string

const (
	PolicyRoundRobin      RoutingPolicy = "round-robin"
	PolicyLeastLatency    RoutingPolicy = "least-latency"
	PolicyLeastLoad       RoutingPolicy = "least-load"
	PolicyWeightedRandom  RoutingPolicy = "weighted-random"
	PolicyThompsonSampling RoutingPolicy = "thompson-sampling" // Reinforcement learning
)

type RoutingRequest struct {
	ModelName      string
	RequestSize    int
	LatencyBudget  time.Duration
	UserTier       string
	Capabilities   []string
}

type RoutingDecision struct {
	Backend        *Backend
	Reason         string
	Confidence     float64
	AlternativeIDs []string
}

// NewAdaptiveRouter creates a new adaptive routing instance
func NewAdaptiveRouter(policy RoutingPolicy, metricsWindow time.Duration) *AdaptiveRouter {
	return &AdaptiveRouter{
		backends:        make(map[string]*Backend),
		metricsWindow:   metricsWindow,
		routingPolicy:   policy,
		learningRate:    0.1,
		explorationRate: 0.15, // 15% exploration for Thompson Sampling

		routingDecisions: promauto.NewCounter(prometheus.CounterOpts{
			Name: "adaptive_routing_decisions_total",
			Help: "Total number of adaptive routing decisions made",
		}),
		backendLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "adaptive_backend_latency_seconds",
			Help:    "Backend inference latency tracked by adaptive router",
			Buckets: prometheus.DefBuckets,
		}, []string{"backend_id", "backend_type"}),
		backendErrors: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "adaptive_backend_errors_total",
			Help: "Total errors per backend tracked by adaptive router",
		}, []string{"backend_id", "backend_type"}),
	}
}

// RegisterBackend adds a new inference backend to the router
func (ar *AdaptiveRouter) RegisterBackend(backend *Backend) error {
	ar.mu.Lock()
	defer ar.mu.Unlock()

	if _, exists := ar.backends[backend.ID]; exists {
		return fmt.Errorf("backend %s already registered", backend.ID)
	}

	backend.Healthy = true
	backend.LastHealthCheck = time.Now()
	ar.backends[backend.ID] = backend

	return nil
}

// Route selects the optimal backend for a given request
func (ar *AdaptiveRouter) Route(ctx context.Context, req *RoutingRequest) (*RoutingDecision, error) {
	ar.mu.RLock()
	defer ar.mu.RUnlock()

	// Filter backends by capability
	candidates := ar.filterByCapability(req.Capabilities)
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no backends available with required capabilities: %v", req.Capabilities)
	}

	// Filter by health status
	candidates = ar.filterHealthy(candidates)
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no healthy backends available")
	}

	// Apply routing policy
	var decision *RoutingDecision
	var err error

	switch ar.routingPolicy {
	case PolicyLeastLatency:
		decision = ar.routeLeastLatency(candidates, req)
	case PolicyLeastLoad:
		decision = ar.routeLeastLoad(candidates, req)
	case PolicyWeightedRandom:
		decision = ar.routeWeightedRandom(candidates, req)
	case PolicyThompsonSampling:
		decision = ar.routeThompsonSampling(candidates, req)
	case PolicyRoundRobin:
		decision = ar.routeRoundRobin(candidates, req)
	default:
		return nil, fmt.Errorf("unknown routing policy: %s", ar.routingPolicy)
	}

	if err != nil {
		return nil, err
	}

	ar.routingDecisions.Inc()
	return decision, nil
}

// routeLeastLatency selects backend with lowest average latency
func (ar *AdaptiveRouter) routeLeastLatency(candidates []*Backend, req *RoutingRequest) *RoutingDecision {
	var best *Backend
	minLatency := math.MaxFloat64

	for _, backend := range candidates {
		backend.mu.RLock()
		latency := backend.AvgLatency
		backend.mu.RUnlock()

		if latency < minLatency {
			minLatency = latency
			best = backend
		}
	}

	return &RoutingDecision{
		Backend:    best,
		Reason:     fmt.Sprintf("Lowest latency: %.2fms", best.AvgLatency),
		Confidence: ar.calculateConfidence(best),
	}
}

// routeLeastLoad selects backend with most available capacity
func (ar *AdaptiveRouter) routeLeastLoad(candidates []*Backend, req *RoutingRequest) *RoutingDecision {
	var best *Backend
	maxAvailable := 0

	for _, backend := range candidates {
		backend.mu.RLock()
		available := backend.MaxCapacity - backend.CurrentLoad
		backend.mu.RUnlock()

		if available > maxAvailable {
			maxAvailable = available
			best = backend
		}
	}

	return &RoutingDecision{
		Backend:    best,
		Reason:     fmt.Sprintf("Most available capacity: %d/%d", maxAvailable, best.MaxCapacity),
		Confidence: float64(maxAvailable) / float64(best.MaxCapacity),
	}
}

// routeWeightedRandom uses inverse latency as weight for probabilistic selection
func (ar *AdaptiveRouter) routeWeightedRandom(candidates []*Backend, req *RoutingRequest) *RoutingDecision {
	weights := make([]float64, len(candidates))
	totalWeight := 0.0

	// Calculate weights (inverse latency)
	for i, backend := range candidates {
		backend.mu.RLock()
		latency := backend.AvgLatency
		errorRate := backend.ErrorRate
		backend.mu.RUnlock()

		// Weight = 1 / (latency * (1 + errorRate))
		if latency > 0 {
			weights[i] = 1.0 / (latency * (1.0 + errorRate))
		} else {
			weights[i] = 1.0
		}
		totalWeight += weights[i]
	}

	// Normalize weights
	for i := range weights {
		weights[i] /= totalWeight
	}

	// Weighted random selection
	r := float64(time.Now().UnixNano()%1000) / 1000.0
	cumulative := 0.0

	for i, weight := range weights {
		cumulative += weight
		if r <= cumulative {
			return &RoutingDecision{
				Backend:    candidates[i],
				Reason:     fmt.Sprintf("Weighted random (weight: %.3f)", weight),
				Confidence: weight,
			}
		}
	}

	// Fallback to first candidate
	return &RoutingDecision{
		Backend:    candidates[0],
		Reason:     "Weighted random fallback",
		Confidence: weights[0],
	}
}

// routeThompsonSampling implements Thompson Sampling for multi-armed bandit
// This enables reinforcement learning for optimal backend selection
func (ar *AdaptiveRouter) routeThompsonSampling(candidates []*Backend, req *RoutingRequest) *RoutingDecision {
	// Exploration: randomly select with probability epsilon
	if float64(time.Now().UnixNano()%100)/100.0 < ar.explorationRate {
		idx := time.Now().UnixNano() % int64(len(candidates))
		return &RoutingDecision{
			Backend:    candidates[idx],
			Reason:     "Thompson Sampling: exploration",
			Confidence: ar.explorationRate,
		}
	}

	// Exploitation: select based on Beta distribution sampling
	var best *Backend
	maxSample := 0.0

	for _, backend := range candidates {
		backend.mu.RLock()
		successes := float64(backend.SuccessCount)
		failures := float64(backend.ErrorCount)
		backend.mu.RUnlock()

		// Beta distribution parameters (α, β)
		alpha := successes + 1.0
		beta := failures + 1.0

		// Simple approximation: sample ~ Beta(α, β) ≈ α / (α + β) with noise
		mean := alpha / (alpha + beta)
		noise := (float64(time.Now().UnixNano()%100) / 100.0) * 0.1 // 10% noise
		sample := mean + noise

		if sample > maxSample {
			maxSample = sample
			best = backend
		}
	}

	return &RoutingDecision{
		Backend:    best,
		Reason:     fmt.Sprintf("Thompson Sampling: exploitation (score: %.3f)", maxSample),
		Confidence: maxSample,
	}
}

// routeRoundRobin simple round-robin selection
func (ar *AdaptiveRouter) routeRoundRobin(candidates []*Backend, req *RoutingRequest) *RoutingDecision {
	idx := time.Now().UnixNano() % int64(len(candidates))
	return &RoutingDecision{
		Backend:    candidates[idx],
		Reason:     "Round-robin selection",
		Confidence: 1.0 / float64(len(candidates)),
	}
}

// RecordResult updates backend metrics based on inference result
func (ar *AdaptiveRouter) RecordResult(backendID string, latency time.Duration, err error) {
	ar.mu.RLock()
	backend, exists := ar.backends[backendID]
	ar.mu.RUnlock()

	if !exists {
		return
	}

	backend.mu.Lock()
	defer backend.mu.Unlock()

	backend.TotalRequests++

	if err != nil {
		backend.ErrorCount++
		backend.ErrorRate = float64(backend.ErrorCount) / float64(backend.TotalRequests)
		ar.backendErrors.WithLabelValues(backendID, string(backend.Type)).Inc()
	} else {
		backend.SuccessCount++

		// Update average latency (exponential moving average)
		latencyMs := float64(latency.Milliseconds())
		if backend.AvgLatency == 0 {
			backend.AvgLatency = latencyMs
		} else {
			backend.AvgLatency = (1-ar.learningRate)*backend.AvgLatency + ar.learningRate*latencyMs
		}

		ar.backendLatency.WithLabelValues(backendID, string(backend.Type)).Observe(latency.Seconds())
	}
}

// UpdateLoad updates current load for a backend
func (ar *AdaptiveRouter) UpdateLoad(backendID string, delta int) {
	ar.mu.RLock()
	backend, exists := ar.backends[backendID]
	ar.mu.RUnlock()

	if !exists {
		return
	}

	backend.mu.Lock()
	backend.CurrentLoad += delta
	if backend.CurrentLoad < 0 {
		backend.CurrentLoad = 0
	}
	backend.mu.Unlock()
}

// MarkHealthStatus updates backend health status
func (ar *AdaptiveRouter) MarkHealthStatus(backendID string, healthy bool) {
	ar.mu.RLock()
	backend, exists := ar.backends[backendID]
	ar.mu.RUnlock()

	if !exists {
		return
	}

	backend.mu.Lock()
	backend.Healthy = healthy
	backend.LastHealthCheck = time.Now()
	backend.mu.Unlock()
}

// GetBackendStats returns current statistics for all backends
func (ar *AdaptiveRouter) GetBackendStats() map[string]BackendStats {
	ar.mu.RLock()
	defer ar.mu.RUnlock()

	stats := make(map[string]BackendStats)

	for id, backend := range ar.backends {
		backend.mu.RLock()
		stats[id] = BackendStats{
			ID:            id,
			Type:          string(backend.Type),
			AvgLatency:    backend.AvgLatency,
			ErrorRate:     backend.ErrorRate,
			CurrentLoad:   backend.CurrentLoad,
			MaxCapacity:   backend.MaxCapacity,
			SuccessCount:  backend.SuccessCount,
			ErrorCount:    backend.ErrorCount,
			TotalRequests: backend.TotalRequests,
			Healthy:       backend.Healthy,
		}
		backend.mu.RUnlock()
	}

	return stats
}

type BackendStats struct {
	ID            string  `json:"id"`
	Type          string  `json:"type"`
	AvgLatency    float64 `json:"avg_latency_ms"`
	ErrorRate     float64 `json:"error_rate"`
	CurrentLoad   int     `json:"current_load"`
	MaxCapacity   int     `json:"max_capacity"`
	SuccessCount  int64   `json:"success_count"`
	ErrorCount    int64   `json:"error_count"`
	TotalRequests int64   `json:"total_requests"`
	Healthy       bool    `json:"healthy"`
}

// Helper functions

func (ar *AdaptiveRouter) filterByCapability(required []string) []*Backend {
	if len(required) == 0 {
		// Return all backends if no specific capability required
		result := make([]*Backend, 0, len(ar.backends))
		for _, b := range ar.backends {
			result = append(result, b)
		}
		return result
	}

	var candidates []*Backend
	for _, backend := range ar.backends {
		if ar.hasCapabilities(backend, required) {
			candidates = append(candidates, backend)
		}
	}
	return candidates
}

func (ar *AdaptiveRouter) filterHealthy(backends []*Backend) []*Backend {
	var healthy []*Backend
	for _, backend := range backends {
		backend.mu.RLock()
		isHealthy := backend.Healthy
		backend.mu.RUnlock()

		if isHealthy {
			healthy = append(healthy, backend)
		}
	}
	return healthy
}

func (ar *AdaptiveRouter) hasCapabilities(backend *Backend, required []string) bool {
	capSet := make(map[string]bool)
	for _, cap := range backend.Capabilities {
		capSet[cap] = true
	}

	for _, req := range required {
		if !capSet[req] {
			return false
		}
	}
	return true
}

func (ar *AdaptiveRouter) calculateConfidence(backend *Backend) float64 {
	backend.mu.RLock()
	defer backend.mu.RUnlock()

	if backend.TotalRequests == 0 {
		return 0.5 // Neutral confidence for untested backends
	}

	successRate := float64(backend.SuccessCount) / float64(backend.TotalRequests)
	capacityUtil := 1.0 - (float64(backend.CurrentLoad) / float64(backend.MaxCapacity))

	// Confidence = success rate weighted by available capacity
	return successRate * capacityUtil
}
