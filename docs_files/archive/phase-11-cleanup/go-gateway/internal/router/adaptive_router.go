package router

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// RoutingPolicy defines the strategy for selecting models
type RoutingPolicy string

const (
	PolicyLatency  RoutingPolicy = "latency"  // Minimize latency
	PolicyAccuracy RoutingPolicy = "accuracy" // Maximize accuracy
	PolicyCost     RoutingPolicy = "cost"      // Minimize cost
	PolicyBalanced RoutingPolicy = "balanced"  // Balance all factors
)

// ModelCandidate represents a model available for routing
type ModelCandidate struct {
	ModelID      string
	Version      string
	Endpoint     string
	AvgLatencyMs float64
	P99LatencyMs float64
	Accuracy     float64
	CostPerReq   float64
	LoadFactor   float64 // Current load (0.0-1.0)
	Healthy      bool
}

// RoutingDecision contains the selected model and metadata
type RoutingDecision struct {
	SelectedModel ModelCandidate
	Policy        RoutingPolicy
	Score         float64
	Reason        string
	Timestamp     time.Time
}

// AdaptiveRouter implements intelligent model routing
type AdaptiveRouter struct {
	policy         RoutingPolicy
	modelMetrics   map[string]*ModelMetrics
	metricsLock    sync.RWMutex
	decisionCache  *DecisionCache

	// Prometheus metrics
	routingDecisions *prometheus.CounterVec
	routingLatency   *prometheus.HistogramVec
	policyScore      *prometheus.GaugeVec
}

// ModelMetrics tracks real-time model performance
type ModelMetrics struct {
	ModelID         string
	TotalRequests   int64
	SuccessRequests int64
	FailedRequests  int64
	AvgLatencyMs    float64
	P50LatencyMs    float64
	P95LatencyMs    float64
	P99LatencyMs    float64
	Accuracy        float64
	CostPerReq      float64
	LastUpdated     time.Time
	LatencyHistory  []float64 // Sliding window for P-percentiles
	mu              sync.RWMutex
}

// DecisionCache caches routing decisions for similar requests
type DecisionCache struct {
	cache map[string]*RoutingDecision
	ttl   time.Duration
	mu    sync.RWMutex
}

// NewAdaptiveRouter creates a new adaptive routing engine
func NewAdaptiveRouter(policy RoutingPolicy) *AdaptiveRouter {
	return &AdaptiveRouter{
		policy:       policy,
		modelMetrics: make(map[string]*ModelMetrics),
		decisionCache: &DecisionCache{
			cache: make(map[string]*RoutingDecision),
			ttl:   5 * time.Minute,
		},
		routingDecisions: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "adaptive_routing_decisions_total",
				Help: "Total routing decisions by policy and model",
			},
			[]string{"policy", "model_id", "reason"},
		),
		routingLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "adaptive_routing_decision_latency_ms",
				Help:    "Time to make routing decision",
				Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 20},
			},
			[]string{"policy"},
		),
		policyScore: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "adaptive_routing_policy_score",
				Help: "Computed score for routing decision",
			},
			[]string{"policy", "model_id"},
		),
	}
}

// Route selects the best model based on the configured policy
func (ar *AdaptiveRouter) Route(ctx context.Context, candidates []ModelCandidate) (*RoutingDecision, error) {
	start := time.Now()
	defer func() {
		ar.routingLatency.WithLabelValues(string(ar.policy)).Observe(float64(time.Since(start).Milliseconds()))
	}()

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no model candidates available")
	}

	// Filter out unhealthy models
	healthyCandidates := make([]ModelCandidate, 0)
	for _, c := range candidates {
		if c.Healthy && c.LoadFactor < 0.95 { // Don't route to overloaded models
			healthyCandidates = append(healthyCandidates, c)
		}
	}

	if len(healthyCandidates) == 0 {
		return nil, fmt.Errorf("no healthy model candidates available")
	}

	// Select model based on policy
	var selected ModelCandidate
	var score float64
	var reason string

	switch ar.policy {
	case PolicyLatency:
		selected, score, reason = ar.selectByLatency(healthyCandidates)
	case PolicyAccuracy:
		selected, score, reason = ar.selectByAccuracy(healthyCandidates)
	case PolicyCost:
		selected, score, reason = ar.selectByCost(healthyCandidates)
	case PolicyBalanced:
		selected, score, reason = ar.selectBalanced(healthyCandidates)
	default:
		selected, score, reason = ar.selectBalanced(healthyCandidates)
	}

	decision := &RoutingDecision{
		SelectedModel: selected,
		Policy:        ar.policy,
		Score:         score,
		Reason:        reason,
		Timestamp:     time.Now(),
	}

	// Record metrics
	ar.routingDecisions.WithLabelValues(string(ar.policy), selected.ModelID, reason).Inc()
	ar.policyScore.WithLabelValues(string(ar.policy), selected.ModelID).Set(score)

	return decision, nil
}

// selectByLatency prioritizes models with lowest P99 latency
func (ar *AdaptiveRouter) selectByLatency(candidates []ModelCandidate) (ModelCandidate, float64, string) {
	sort.Slice(candidates, func(i, j int) bool {
		// Factor in load - penalize high-load models
		scoreI := candidates[i].P99LatencyMs * (1 + candidates[i].LoadFactor)
		scoreJ := candidates[j].P99LatencyMs * (1 + candidates[j].LoadFactor)
		return scoreI < scoreJ
	})

	selected := candidates[0]
	score := 100.0 / (selected.P99LatencyMs + 1)
	reason := fmt.Sprintf("lowest_p99_latency_%.1fms", selected.P99LatencyMs)

	return selected, score, reason
}

// selectByAccuracy prioritizes models with highest accuracy
func (ar *AdaptiveRouter) selectByAccuracy(candidates []ModelCandidate) (ModelCandidate, float64, string) {
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Accuracy > candidates[j].Accuracy
	})

	selected := candidates[0]
	score := selected.Accuracy * 100
	reason := fmt.Sprintf("highest_accuracy_%.2f", selected.Accuracy)

	return selected, score, reason
}

// selectByCost prioritizes models with lowest cost per request
func (ar *AdaptiveRouter) selectByCost(candidates []ModelCandidate) (ModelCandidate, float64, string) {
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].CostPerReq < candidates[j].CostPerReq
	})

	selected := candidates[0]
	score := 100.0 / (selected.CostPerReq + 0.001)
	reason := fmt.Sprintf("lowest_cost_$%.4f", selected.CostPerReq)

	return selected, score, reason
}

// selectBalanced uses weighted scoring across all factors
func (ar *AdaptiveRouter) selectBalanced(candidates []ModelCandidate) (ModelCandidate, float64, string) {
	// Weights for balanced policy
	const (
		latencyWeight  = 0.40
		accuracyWeight = 0.35
		costWeight     = 0.15
		loadWeight     = 0.10
	)

	type ScoredCandidate struct {
		candidate ModelCandidate
		score     float64
	}

	scored := make([]ScoredCandidate, len(candidates))

	// Normalize metrics for scoring
	maxLatency := 0.0
	maxAccuracy := 0.0
	maxCost := 0.0

	for _, c := range candidates {
		if c.P99LatencyMs > maxLatency {
			maxLatency = c.P99LatencyMs
		}
		if c.Accuracy > maxAccuracy {
			maxAccuracy = c.Accuracy
		}
		if c.CostPerReq > maxCost {
			maxCost = c.CostPerReq
		}
	}

	// Prevent division by zero
	if maxLatency == 0 {
		maxLatency = 1
	}
	if maxAccuracy == 0 {
		maxAccuracy = 1
	}
	if maxCost == 0 {
		maxCost = 0.001
	}

	// Calculate weighted scores
	for i, c := range candidates {
		// Lower latency is better (inverted)
		latencyScore := (1 - (c.P99LatencyMs / maxLatency)) * latencyWeight

		// Higher accuracy is better
		accuracyScore := (c.Accuracy / maxAccuracy) * accuracyWeight

		// Lower cost is better (inverted)
		costScore := (1 - (c.CostPerReq / maxCost)) * costWeight

		// Lower load is better (inverted)
		loadScore := (1 - c.LoadFactor) * loadWeight

		totalScore := latencyScore + accuracyScore + costScore + loadScore

		scored[i] = ScoredCandidate{
			candidate: c,
			score:     totalScore,
		}
	}

	// Sort by score descending
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	selected := scored[0].candidate
	score := scored[0].score * 100
	reason := fmt.Sprintf("balanced_score_%.2f", score)

	return selected, score, reason
}

// UpdateModelMetrics updates real-time metrics for a model
func (ar *AdaptiveRouter) UpdateModelMetrics(modelID string, latencyMs float64, success bool, accuracy float64) {
	ar.metricsLock.Lock()
	defer ar.metricsLock.Unlock()

	metrics, exists := ar.modelMetrics[modelID]
	if !exists {
		metrics = &ModelMetrics{
			ModelID:        modelID,
			LatencyHistory: make([]float64, 0, 1000),
		}
		ar.modelMetrics[modelID] = metrics
	}

	metrics.mu.Lock()
	defer metrics.mu.Unlock()

	metrics.TotalRequests++
	if success {
		metrics.SuccessRequests++
	} else {
		metrics.FailedRequests++
	}

	// Update latency history (sliding window)
	metrics.LatencyHistory = append(metrics.LatencyHistory, latencyMs)
	if len(metrics.LatencyHistory) > 1000 {
		metrics.LatencyHistory = metrics.LatencyHistory[1:]
	}

	// Calculate percentiles
	metrics.AvgLatencyMs = calculateAverage(metrics.LatencyHistory)
	metrics.P50LatencyMs = calculatePercentile(metrics.LatencyHistory, 0.50)
	metrics.P95LatencyMs = calculatePercentile(metrics.LatencyHistory, 0.95)
	metrics.P99LatencyMs = calculatePercentile(metrics.LatencyHistory, 0.99)

	// Update accuracy (exponential moving average)
	alpha := 0.1
	if metrics.Accuracy == 0 {
		metrics.Accuracy = accuracy
	} else {
		metrics.Accuracy = alpha*accuracy + (1-alpha)*metrics.Accuracy
	}

	metrics.LastUpdated = time.Now()
}

// GetModelMetrics retrieves current metrics for a model
func (ar *AdaptiveRouter) GetModelMetrics(modelID string) (*ModelMetrics, bool) {
	ar.metricsLock.RLock()
	defer ar.metricsLock.RUnlock()

	metrics, exists := ar.modelMetrics[modelID]
	return metrics, exists
}

// SetPolicy changes the routing policy
func (ar *AdaptiveRouter) SetPolicy(policy RoutingPolicy) {
	ar.policy = policy
}

// GetPolicy returns the current routing policy
func (ar *AdaptiveRouter) GetPolicy() RoutingPolicy {
	return ar.policy
}

// calculateAverage computes the mean of a slice
func calculateAverage(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

// calculatePercentile computes the p-th percentile
func calculatePercentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	index := int(math.Ceil(float64(len(sorted)) * p))
	if index >= len(sorted) {
		index = len(sorted) - 1
	}

	return sorted[index]
}

// AnalyzePerformance generates a performance report
func (ar *AdaptiveRouter) AnalyzePerformance() map[string]interface{} {
	ar.metricsLock.RLock()
	defer ar.metricsLock.RUnlock()

	report := make(map[string]interface{})
	report["policy"] = string(ar.policy)
	report["total_models"] = len(ar.modelMetrics)

	models := make([]map[string]interface{}, 0)
	for _, metrics := range ar.modelMetrics {
		metrics.mu.RLock()
		modelReport := map[string]interface{}{
			"model_id":        metrics.ModelID,
			"total_requests":  metrics.TotalRequests,
			"success_rate":    float64(metrics.SuccessRequests) / float64(metrics.TotalRequests),
			"avg_latency_ms":  metrics.AvgLatencyMs,
			"p50_latency_ms":  metrics.P50LatencyMs,
			"p95_latency_ms":  metrics.P95LatencyMs,
			"p99_latency_ms":  metrics.P99LatencyMs,
			"accuracy":        metrics.Accuracy,
			"cost_per_req":    metrics.CostPerReq,
			"last_updated":    metrics.LastUpdated,
		}
		metrics.mu.RUnlock()
		models = append(models, modelReport)
	}

	report["models"] = models
	return report
}
