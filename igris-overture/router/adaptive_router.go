package router

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// AdaptiveRouter implements intelligent routing based on performance metrics
type AdaptiveRouter struct {
	backends        map[string]*Backend
	mu              sync.RWMutex
	metricsWindow   time.Duration
	routingPolicy   RoutingPolicy
	learningRate    float64
	explorationRate float64

	// OVERTURE-02: Provider trust verification
	trustTracker *ProviderTrustTracker

	// OVERTURE-03: Thompson Sampling with cold-start protection
	thompsonEngine *ThompsonSamplingEngine

	// Metrics
	routingDecisions prometheus.Counter
	backendLatency   *prometheus.HistogramVec
	backendErrors    *prometheus.CounterVec
}

// Backend represents an inference backend with performance metrics
type Backend struct {
	ID           string
	URL          string
	Type         BackendType
	Capabilities []string

	// Performance metrics (sliding window)
	AvgLatency    float64
	ErrorRate     float64
	CurrentLoad   int
	MaxCapacity   int
	SuccessCount  int64
	ErrorCount    int64
	TotalRequests int64

	// Health status
	Healthy         bool
	LastHealthCheck time.Time

	mu sync.RWMutex
}

type BackendType string

const (
	BackendTypeMLPython BackendType = "ml-python"
	BackendTypeMLGPU    BackendType = "ml-gpu"
	BackendTypeMLCPU    BackendType = "ml-cpu"
	BackendTypeONNX     BackendType = "onnx-runtime"
	BackendTypeRustFFI  BackendType = "rust-ffi"
)

type RoutingPolicy string

const (
	PolicyRoundRobin       RoutingPolicy = "round-robin"
	PolicyLeastLatency     RoutingPolicy = "least-latency"
	PolicyLeastLoad        RoutingPolicy = "least-load"
	PolicyWeightedRandom   RoutingPolicy = "weighted-random"
	PolicyThompsonSampling RoutingPolicy = "thompson-sampling" // Reinforcement learning
)

type RoutingRequest struct {
	ModelName     string
	RequestSize   int
	LatencyBudget time.Duration
	UserTier      string
	Capabilities  []string
}

type RoutingDecision struct {
	Backend        *Backend
	Reason         string
	Confidence     float64
	AlternativeIDs []string

	// OVERTURE-04: Explainable routing traces
	Metadata *RoutingMetadata
}

// NewAdaptiveRouter creates a new adaptive routing instance
func NewAdaptiveRouter(policy RoutingPolicy, metricsWindow time.Duration) *AdaptiveRouter {
	return &AdaptiveRouter{
		backends:        make(map[string]*Backend),
		metricsWindow:   metricsWindow,
		routingPolicy:   policy,
		learningRate:    0.1,
		explorationRate: 0.15, // 15% exploration for Thompson Sampling (legacy)

		// OVERTURE-02: Initialize trust tracker with default config
		trustTracker: NewProviderTrustTracker(DefaultTrustConfig()),

		// OVERTURE-03: Initialize Thompson Sampling engine with cold-start protection
		thompsonEngine: NewThompsonSamplingEngine(DefaultThompsonSamplingConfig()),

		routingDecisions: adaptiveCounter(prometheus.CounterOpts{
			Name: "adaptive_routing_decisions_total",
			Help: "Total number of adaptive routing decisions made",
		}),
		backendLatency: adaptiveHistogramVec(prometheus.HistogramOpts{
			Name:    "adaptive_backend_latency_seconds",
			Help:    "Backend inference latency tracked by adaptive router",
			Buckets: prometheus.DefBuckets,
		}, []string{"backend_id", "backend_type"}),
		backendErrors: adaptiveCounterVec(prometheus.CounterOpts{
			Name: "adaptive_backend_errors_total",
			Help: "Total errors per backend tracked by adaptive router",
		}, []string{"backend_id", "backend_type"}),
	}
}

func adaptiveCounter(opts prometheus.CounterOpts) prometheus.Counter {
	collector := prometheus.NewCounter(opts)
	if err := prometheus.Register(collector); err != nil {
		if alreadyRegistered, ok := err.(prometheus.AlreadyRegisteredError); ok {
			if counter, ok := alreadyRegistered.ExistingCollector.(prometheus.Counter); ok {
				return counter
			}
		}
	}
	return collector
}

func adaptiveHistogramVec(opts prometheus.HistogramOpts, labels []string) *prometheus.HistogramVec {
	collector := prometheus.NewHistogramVec(opts, labels)
	if err := prometheus.Register(collector); err != nil {
		if alreadyRegistered, ok := err.(prometheus.AlreadyRegisteredError); ok {
			if histogram, ok := alreadyRegistered.ExistingCollector.(*prometheus.HistogramVec); ok {
				return histogram
			}
		}
	}
	return collector
}

func adaptiveCounterVec(opts prometheus.CounterOpts, labels []string) *prometheus.CounterVec {
	collector := prometheus.NewCounterVec(opts, labels)
	if err := prometheus.Register(collector); err != nil {
		if alreadyRegistered, ok := err.(prometheus.AlreadyRegisteredError); ok {
			if counter, ok := alreadyRegistered.ExistingCollector.(*prometheus.CounterVec); ok {
				return counter
			}
		}
	}
	return collector
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
	if ar.trustTracker != nil {
		ar.trustTracker.mu.Lock()
		if _, exists := ar.trustTracker.providers[backend.ID]; !exists {
			ar.trustTracker.providers[backend.ID] = &ProviderTrust{
				ProviderID:      backend.ID,
				TrustScore:      1.0,
				ConfidenceLevel: 0.0,
				LastDecayTime:   time.Now(),
			}
		}
		ar.trustTracker.mu.Unlock()
	}

	return nil
}

// Route selects the optimal backend for a given request
// OVERTURE-04: Enhanced with comprehensive routing metadata generation
func (ar *AdaptiveRouter) Route(ctx context.Context, req *RoutingRequest) (*RoutingDecision, error) {
	routingStart := time.Now()

	ar.mu.RLock()
	defer ar.mu.RUnlock()

	// OVERTURE-04: Initialize metadata builder
	requestID := fmt.Sprintf("req_%d", time.Now().UnixNano())
	metadata := NewMetadataBuilder(requestID, req.ModelName).
		WithUserTier(req.UserTier)

	// Filter backends by capability
	allBackends := ar.filterByCapability(req.Capabilities)
	if len(allBackends) == 0 {
		return nil, fmt.Errorf("no backends available with required capabilities: %v", req.Capabilities)
	}

	// Filter by health status
	candidates := ar.filterHealthy(allBackends)
	healthyCount := len(candidates)
	if healthyCount == 0 {
		return nil, fmt.Errorf("no healthy backends available")
	}

	// OVERTURE-02: Filter by trust verification (FAIL-CLOSED)
	candidateIDs := make([]string, len(candidates))
	for i, backend := range candidates {
		candidateIDs[i] = backend.ID
	}
	trustedIDs, blockedIDs := ar.trustTracker.FilterTrustedProviders(candidateIDs)

	// Filter candidates to only trusted backends
	trustedCandidates := make([]*Backend, 0, len(trustedIDs))
	trustedSet := make(map[string]bool)
	for _, id := range trustedIDs {
		trustedSet[id] = true
	}
	for _, backend := range candidates {
		if trustedSet[backend.ID] {
			trustedCandidates = append(trustedCandidates, backend)
		}
	}

	// OVERTURE-04: Record trust filtering metadata
	metadata.WithTrustFiltering(len(candidateIDs), len(trustedIDs), len(blockedIDs), nil, blockedIDs)

	// FAIL-CLOSED: If all providers blocked by trust verification, reject request
	if len(trustedCandidates) == 0 {
		return nil, fmt.Errorf("no trusted backends available (trust verification blocked %d providers: %v)", len(blockedIDs), blockedIDs)
	}

	candidates = trustedCandidates
	metadata.WithCandidateCounts(len(allBackends), healthyCount, len(trustedCandidates))

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

	// OVERTURE-04: Build candidate scores for all backends
	for _, backend := range allBackends {
		backend.mu.RLock()
		score := CandidateScore{
			BackendID:    backend.ID,
			BackendType:  string(backend.Type),
			Healthy:      backend.Healthy,
			Trusted:      trustedSet[backend.ID],
			AvgLatencyMs: backend.AvgLatency,
			ErrorRate:    backend.ErrorRate,
			CurrentLoad:  backend.CurrentLoad,
			Selected:     (decision.Backend != nil && decision.Backend.ID == backend.ID),
		}
		backend.mu.RUnlock()

		// Add trust score if available
		if trustScore, trustConf, exists := ar.trustTracker.GetTrustScore(backend.ID); exists {
			score.TrustScore = trustScore
			score.TrustConfidence = trustConf
		}

		// Add rejection reason if not selected
		if !score.Selected {
			if !score.Healthy {
				score.RejectionReason = "unhealthy"
			} else if !score.Trusted {
				score.RejectionReason = "trust verification failed"
			} else {
				score.RejectionReason = "not selected by routing policy"
			}
		}

		metadata.AddCandidateScore(score)
	}

	// OVERTURE-04: Add selection metadata
	metadata.WithSelection(
		decision.Backend.ID,
		decision.Reason,
		string(ar.routingPolicy),
		decision.Confidence,
	)

	// OVERTURE-04: Add Thompson Sampling metadata if applicable
	if ar.routingPolicy == PolicyThompsonSampling {
		stats := ar.thompsonEngine.GetGlobalStats()
		state, stateExists := ar.thompsonEngine.GetState(decision.Backend.ID)

		decisionType := "unknown"
		if len(decision.Reason) > 20 {
			if decision.Reason[20:30] == "bootstrap " {
				decisionType = "bootstrap"
			} else if decision.Reason[20:27] == "explore" {
				decisionType = "explore"
			} else if decision.Reason[20:27] == "exploit" {
				decisionType = "exploit"
			}
		}

		alpha, beta := 0.0, 0.0
		backendPhase := ""
		backendSamples := 0

		if stateExists {
			alpha = state.Alpha
			beta = state.Beta
			backendPhase = string(state.Phase)
			backendSamples = state.SamplesCollected
		}

		metadata.WithThompsonSampling(
			stats.GlobalExplorationCount,
			stats.CurrentExplorationRate,
			stats.ExplorationBudgetRemaining,
			decisionType,
			backendPhase,
			backendSamples,
			alpha,
			beta,
		)
	}

	// OVERTURE-04: Add routing latency
	routingLatency := time.Since(routingStart)
	metadata.WithRoutingLatency(float64(routingLatency.Microseconds()) / 1000.0)

	// Attach metadata to decision
	decision.Metadata = metadata.Build()

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
// OVERTURE-03: Enhanced with cold-start protection, explicit priors, and phase management
func (ar *AdaptiveRouter) routeThompsonSampling(candidates []*Backend, req *RoutingRequest) *RoutingDecision {
	// Use enhanced Thompson Sampling engine with cold-start protection
	backend, reason, confidence := ar.thompsonEngine.SelectBackend(candidates)

	if backend == nil {
		// Fallback to first candidate if selection fails
		return &RoutingDecision{
			Backend:    candidates[0],
			Reason:     "Thompson Sampling: fallback (no valid selection)",
			Confidence: 0.0,
		}
	}

	return &RoutingDecision{
		Backend:    backend,
		Reason:     reason,
		Confidence: confidence,
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
	routingPolicy := ar.routingPolicy
	ar.mu.RUnlock()

	if !exists {
		return
	}

	backend.mu.Lock()
	backend.TotalRequests++

	latencyMs := float64(latency.Milliseconds())
	failed := (err != nil)
	success := !failed

	if err != nil {
		backend.ErrorCount++
		backend.ErrorRate = float64(backend.ErrorCount) / float64(backend.TotalRequests)
		ar.backendErrors.WithLabelValues(backendID, string(backend.Type)).Inc()
	} else {
		backend.SuccessCount++

		// Update average latency (exponential moving average)
		if backend.AvgLatency == 0 {
			backend.AvgLatency = latencyMs
		} else {
			backend.AvgLatency = (1-ar.learningRate)*backend.AvgLatency + ar.learningRate*latencyMs
		}

		ar.backendLatency.WithLabelValues(backendID, string(backend.Type)).Observe(latency.Seconds())
	}
	backend.mu.Unlock()

	// OVERTURE-02: Record observation in trust tracker
	// Note: costUSD is not tracked in this basic implementation, defaulting to 0.0
	// In production, cost should be calculated based on token usage and pricing
	ar.trustTracker.RecordObservation(backendID, latencyMs, failed, 0.0)

	// OVERTURE-03: Record outcome in Thompson Sampling engine (only for Thompson Sampling policy)
	if routingPolicy == PolicyThompsonSampling {
		// Determine if this was exploration or exploitation
		// This is a simplification - in production, the routing decision should include this metadata
		state, exists := ar.thompsonEngine.GetState(backendID)
		isExploration := exists && (state.Phase == PhaseBootstrap || state.Phase == PhaseExplore)

		ar.thompsonEngine.RecordOutcome(backendID, success, isExploration)
	}
}

// RecordResultWithMetadata updates backend metrics with routing metadata
// This version allows explicit specification of exploration/exploitation
func (ar *AdaptiveRouter) RecordResultWithMetadata(backendID string, latency time.Duration, err error, isExploration bool) {
	// First record with standard method
	ar.RecordResult(backendID, latency, err)

	// Override Thompson Sampling outcome if using Thompson Sampling policy
	ar.mu.RLock()
	routingPolicy := ar.routingPolicy
	ar.mu.RUnlock()

	if routingPolicy == PolicyThompsonSampling {
		success := (err == nil)
		ar.thompsonEngine.RecordOutcome(backendID, success, isExploration)
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

// OVERTURE-02: Trust Management Methods

// SetReportedMetrics sets the advertised/claimed metrics for a backend
// This allows trust verification by comparing observed vs reported performance
func (ar *AdaptiveRouter) SetReportedMetrics(backendID string, latencyMs, errorRate, costUSD float64) {
	ar.trustTracker.SetReportedMetrics(backendID, latencyMs, errorRate, costUSD)
}

// GetProviderTrustScore returns the trust score and confidence for a backend
func (ar *AdaptiveRouter) GetProviderTrustScore(backendID string) (trustScore, confidence float64, exists bool) {
	return ar.trustTracker.GetTrustScore(backendID)
}

// IsProviderTrusted checks if a backend passes trust verification
func (ar *AdaptiveRouter) IsProviderTrusted(backendID string) (bool, string) {
	return ar.trustTracker.IsProviderTrusted(backendID)
}

// GetProviderTrustDetails returns detailed trust information for a backend
func (ar *AdaptiveRouter) GetProviderTrustDetails(backendID string) (*ProviderTrust, error) {
	return ar.trustTracker.GetProviderTrustDetails(backendID)
}

// ResetProviderTrust manually resets trust for a backend (e.g., after verification)
func (ar *AdaptiveRouter) ResetProviderTrust(backendID string) {
	ar.trustTracker.ResetProviderTrust(backendID)
}

// OVERTURE-03: Thompson Sampling Management Methods

// GetThompsonSamplingState returns the current Thompson Sampling state for a backend
func (ar *AdaptiveRouter) GetThompsonSamplingState(backendID string) (*ThompsonSamplingState, bool) {
	return ar.thompsonEngine.GetState(backendID)
}

// GetThompsonSamplingStats returns global Thompson Sampling statistics
func (ar *AdaptiveRouter) GetThompsonSamplingStats() ThompsonSamplingStats {
	return ar.thompsonEngine.GetGlobalStats()
}

// ResetThompsonSamplingState resets Thompson Sampling state for a backend
func (ar *AdaptiveRouter) ResetThompsonSamplingState(backendID string) {
	ar.thompsonEngine.ResetBackendState(backendID)
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
