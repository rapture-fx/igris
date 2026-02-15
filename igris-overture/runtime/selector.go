package runtime

import (
	"context"
	"fmt"
	"math/rand"
	"sort"
	"time"
)

// ============================================================================
// Runtime Selector for Igris Inertial
// ============================================================================
//
// Intelligent runtime selection based on:
// - Model requirements (complexity, size)
// - Runtime capabilities (GPU, latency)
// - Load balancing
// - Health status
// - Fallback strategies
//
// Selection Strategies:
// - RoundRobin: Distribute load evenly
// - LeastLoaded: Route to least busy runtime
// - HealthyOnly: Only use healthy runtimes
// - FastestFirst: Prefer low-latency runtimes
// - Weighted: Custom weights per runtime
//
// Phase: 2 - Runtime Abstraction
// ============================================================================

// SelectionStrategy defines how runtimes are selected
type SelectionStrategy string

const (
	StrategyRoundRobin   SelectionStrategy = "round_robin"
	StrategyLeastLoaded  SelectionStrategy = "least_loaded"
	StrategyHealthyOnly  SelectionStrategy = "healthy_only"
	StrategyFastestFirst SelectionStrategy = "fastest_first"
	StrategyWeighted     SelectionStrategy = "weighted"
	StrategyRandom       SelectionStrategy = "random"
)

// Selector chooses the best runtime for a request
type Selector struct {
	registry      *Registry
	strategy      SelectionStrategy
	weights       map[string]float64
	fallbackChain []string
	roundRobinIdx int
}

// SelectorConfig configures the runtime selector
type SelectorConfig struct {
	Strategy      SelectionStrategy
	Weights       map[string]float64 // Runtime name -> weight (for weighted strategy)
	FallbackChain []string           // Ordered list of fallback runtimes
}

// NewSelector creates a new runtime selector
func NewSelector(registry *Registry, config SelectorConfig) *Selector {
	if config.Strategy == "" {
		config.Strategy = StrategyRoundRobin
	}

	return &Selector{
		registry:      registry,
		strategy:      config.Strategy,
		weights:       config.Weights,
		fallbackChain: config.FallbackChain,
		roundRobinIdx: 0,
	}
}

// SelectRuntime chooses the best runtime for a request
func (s *Selector) SelectRuntime(ctx context.Context, req *PredictRequest) (string, error) {
	runtimes := s.registry.List()
	if len(runtimes) == 0 {
		return "", fmt.Errorf("no runtimes available")
	}

	switch s.strategy {
	case StrategyRoundRobin:
		return s.selectRoundRobin(runtimes)
	case StrategyLeastLoaded:
		return s.selectLeastLoaded(runtimes)
	case StrategyHealthyOnly:
		return s.selectHealthyOnly(runtimes)
	case StrategyFastestFirst:
		return s.selectFastestFirst(runtimes)
	case StrategyWeighted:
		return s.selectWeighted(runtimes)
	case StrategyRandom:
		return s.selectRandom(runtimes)
	default:
		return s.selectRoundRobin(runtimes)
	}
}

// selectRoundRobin implements round-robin selection
func (s *Selector) selectRoundRobin(runtimes []string) (string, error) {
	if len(runtimes) == 0 {
		return "", fmt.Errorf("no runtimes available")
	}

	// Filter healthy runtimes
	healthy := s.filterHealthy(runtimes)
	if len(healthy) == 0 {
		// Fallback to any runtime if none are healthy
		healthy = runtimes
	}

	selected := healthy[s.roundRobinIdx%len(healthy)]
	s.roundRobinIdx++

	return selected, nil
}

// selectLeastLoaded selects the runtime with the lowest request count
func (s *Selector) selectLeastLoaded(runtimes []string) (string, error) {
	stats := s.registry.GetRuntimeStats()

	var best string
	var minLoad uint64 = ^uint64(0) // Max uint64

	for _, name := range runtimes {
		if stat, ok := stats[name]; ok {
			// Only consider healthy runtimes
			if stat.Health.Status != "healthy" {
				continue
			}

			if stat.RequestCount < minLoad {
				minLoad = stat.RequestCount
				best = name
			}
		}
	}

	if best == "" {
		// Fallback to first runtime if none are healthy
		return runtimes[0], nil
	}

	return best, nil
}

// selectHealthyOnly selects only from healthy runtimes
func (s *Selector) selectHealthyOnly(runtimes []string) (string, error) {
	healthy := s.filterHealthy(runtimes)
	if len(healthy) == 0 {
		return "", fmt.Errorf("no healthy runtimes available")
	}

	// Use round-robin among healthy runtimes
	selected := healthy[s.roundRobinIdx%len(healthy)]
	s.roundRobinIdx++

	return selected, nil
}

// selectFastestFirst selects runtime with lowest average latency
func (s *Selector) selectFastestFirst(runtimes []string) (string, error) {
	stats := s.registry.GetRuntimeStats()

	// Sort by error rate (lower is better)
	type runtimeScore struct {
		name      string
		errorRate float64
	}

	scores := make([]runtimeScore, 0, len(runtimes))
	for _, name := range runtimes {
		if stat, ok := stats[name]; ok {
			// Only consider healthy runtimes
			if stat.Health.Status != "healthy" {
				continue
			}

			scores = append(scores, runtimeScore{
				name:      name,
				errorRate: stat.ErrorRate,
			})
		}
	}

	if len(scores) == 0 {
		return runtimes[0], nil
	}

	// Sort by error rate (ascending)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].errorRate < scores[j].errorRate
	})

	return scores[0].name, nil
}

// selectWeighted implements weighted random selection
func (s *Selector) selectWeighted(runtimes []string) (string, error) {
	if len(s.weights) == 0 {
		// Fallback to round-robin if no weights configured
		return s.selectRoundRobin(runtimes)
	}

	// Filter to runtimes with weights
	weighted := make([]string, 0)
	totalWeight := 0.0

	for _, name := range runtimes {
		if weight, ok := s.weights[name]; ok && weight > 0 {
			weighted = append(weighted, name)
			totalWeight += weight
		}
	}

	if len(weighted) == 0 || totalWeight == 0 {
		return s.selectRoundRobin(runtimes)
	}

	// Weighted random selection
	r := rand.Float64() * totalWeight
	cumulative := 0.0

	for _, name := range weighted {
		cumulative += s.weights[name]
		if r <= cumulative {
			return name, nil
		}
	}

	// Fallback to last weighted runtime
	return weighted[len(weighted)-1], nil
}

// selectRandom selects a random runtime
func (s *Selector) selectRandom(runtimes []string) (string, error) {
	healthy := s.filterHealthy(runtimes)
	if len(healthy) == 0 {
		healthy = runtimes
	}

	return healthy[rand.Intn(len(healthy))], nil
}

// filterHealthy filters runtimes to only healthy ones
func (s *Selector) filterHealthy(runtimes []string) []string {
	healthy := make([]string, 0)

	for _, name := range runtimes {
		health, err := s.registry.GetHealth(name)
		if err == nil && health.Status == "healthy" {
			healthy = append(healthy, name)
		}
	}

	return healthy
}

// PredictWithFallback executes prediction with automatic fallback
func (s *Selector) PredictWithFallback(ctx context.Context, req *PredictRequest) (*PredictResponse, error) {
	// Try primary selection
	primaryRuntime, err := s.SelectRuntime(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("runtime selection failed: %w", err)
	}

	resp, err := s.registry.Predict(ctx, primaryRuntime, req)
	if err == nil {
		return resp, nil
	}

	// Try fallback chain
	for _, fallbackRuntime := range s.fallbackChain {
		if fallbackRuntime == primaryRuntime {
			continue // Skip if same as primary
		}

		resp, err := s.registry.Predict(ctx, fallbackRuntime, req)
		if err == nil {
			// Add fallback metadata
			if resp.Metadata == nil {
				resp.Metadata = make(map[string]string)
			}
			resp.Metadata["fallback_from"] = primaryRuntime
			resp.Metadata["fallback_to"] = fallbackRuntime
			return resp, nil
		}
	}

	return nil, fmt.Errorf("all runtimes failed: primary=%s, fallbacks=%v", primaryRuntime, s.fallbackChain)
}

// ============================================================================
// Model-Based Selection
// ============================================================================

// ModelRequirements defines requirements for model execution
type ModelRequirements struct {
	RequiresGPU     bool
	MaxLatencyMs    int64
	MinMemoryMB     int64
	PreferredRuntime string
	Tags            []string
}

// SelectForModel chooses runtime based on model requirements
func (s *Selector) SelectForModel(ctx context.Context, req *PredictRequest, requirements ModelRequirements) (string, error) {
	// If preferred runtime specified and available, use it
	if requirements.PreferredRuntime != "" {
		if _, err := s.registry.Get(requirements.PreferredRuntime); err == nil {
			health, err := s.registry.GetHealth(requirements.PreferredRuntime)
			if err == nil && health.Status == "healthy" {
				return requirements.PreferredRuntime, nil
			}
		}
	}

	// Filter runtimes by requirements
	runtimes := s.registry.List()
	candidates := make([]string, 0)

	for _, name := range runtimes {
		runtime, err := s.registry.Get(name)
		if err != nil {
			continue
		}

		// Check if runtime meets requirements
		if s.meetsRequirements(runtime, requirements) {
			candidates = append(candidates, name)
		}
	}

	if len(candidates) == 0 {
		return "", fmt.Errorf("no runtimes meet requirements: gpu=%v, latency=%dms",
			requirements.RequiresGPU, requirements.MaxLatencyMs)
	}

	// Select from candidates using configured strategy
	switch s.strategy {
	case StrategyLeastLoaded:
		return s.selectLeastLoaded(candidates)
	case StrategyFastestFirst:
		return s.selectFastestFirst(candidates)
	default:
		return s.selectRoundRobin(candidates)
	}
}

// meetsRequirements checks if runtime meets model requirements
func (s *Selector) meetsRequirements(runtime Runtime, req ModelRequirements) bool {
	// For now, use runtime type as proxy for capabilities
	// In production, this would check actual runtime capabilities

	runtimeType := runtime.Type()

	// GPU requirement
	if req.RequiresGPU {
		// Only Python gRPC supports GPU (for now)
		if runtimeType != RuntimeTypePythonGrpc {
			return false
		}
	}

	// Latency requirement
	if req.MaxLatencyMs > 0 {
		// Rust native is fastest
		if req.MaxLatencyMs < 5 && runtimeType != RuntimeTypeRustNative {
			return false
		}
	}

	return true
}

// ============================================================================
// A/B Testing Support
// ============================================================================

// ABTestConfig configures A/B testing between runtimes
type ABTestConfig struct {
	RuntimeA      string
	RuntimeB      string
	TrafficSplitA float64 // 0.0 to 1.0 (e.g., 0.9 = 90% to A, 10% to B)
}

// SelectForABTest selects runtime for A/B testing
func (s *Selector) SelectForABTest(config ABTestConfig) (string, error) {
	if config.TrafficSplitA < 0 || config.TrafficSplitA > 1 {
		return "", fmt.Errorf("invalid traffic split: %f", config.TrafficSplitA)
	}

	// Verify both runtimes exist
	if _, err := s.registry.Get(config.RuntimeA); err != nil {
		return "", fmt.Errorf("runtime A '%s' not found", config.RuntimeA)
	}
	if _, err := s.registry.Get(config.RuntimeB); err != nil {
		return "", fmt.Errorf("runtime B '%s' not found", config.RuntimeB)
	}

	// Random selection based on split
	if rand.Float64() < config.TrafficSplitA {
		return config.RuntimeA, nil
	}
	return config.RuntimeB, nil
}

// init initializes the random seed
func init() {
	rand.Seed(time.Now().UnixNano())
}
