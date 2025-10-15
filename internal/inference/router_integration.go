package inference

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/schlep-engine/schlep-engine/internal/providers"
)

// InferenceRouter handles intelligent routing of inference requests
// This is a temporary Go-based router that will be replaced with Rust optimizer
type InferenceRouter struct {
	registry *providers.ProviderRegistry

	// Routing state (will be migrated to Rust optimizer)
	providerStats map[string]*ProviderStats

	// Configuration
	enableOptimization bool
	fallbackEnabled    bool
	defaultProvider    string
}

// ProviderStats tracks provider performance for routing decisions
type ProviderStats struct {
	TotalRequests   int64
	SuccessfulReqs  int64
	FailedReqs      int64
	TotalLatencyMs  int64
	AverageLatency  float64
	LastLatencyMs   int64
	ReliabilityRate float64
	LastUpdated     time.Time
}

// NewInferenceRouter creates a new inference router
func NewInferenceRouter(registry *providers.ProviderRegistry) *InferenceRouter {
	return &InferenceRouter{
		registry:           registry,
		providerStats:      make(map[string]*ProviderStats),
		enableOptimization: true,
		fallbackEnabled:    true,
		defaultProvider:    "openai",
	}
}

// Route selects the best provider and performs the inference
func (r *InferenceRouter) Route(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	startTime := time.Now()

	// Step 1: Select provider
	providerName, err := r.selectProvider(req)
	if err != nil {
		return nil, fmt.Errorf("provider selection failed: %w", err)
	}

	provider, exists := r.registry.Get(providerName)
	if !exists {
		return nil, fmt.Errorf("provider %s not found in registry", providerName)
	}

	log.Printf("[Router] Selected provider: %s for model: %s", providerName, req.Model)

	// Step 2: Execute inference
	var resp *models.InferResponse
	resp, err = provider.Infer(ctx, req)

	// Step 3: Handle failures with fallback
	if err != nil {
		log.Printf("[Router] Provider %s failed: %v", providerName, err)
		r.recordFailure(providerName)

		if r.fallbackEnabled {
			resp, err = r.attemptFallback(ctx, req, providerName)
			if err != nil {
				return nil, fmt.Errorf("all providers failed: %w", err)
			}
			resp.Metadata.Fallback = true
		} else {
			return nil, err
		}
	}

	// Step 4: Record success metrics
	latency := time.Since(startTime).Milliseconds()
	r.recordSuccess(providerName, latency)

	// Step 5: Add routing metadata
	if resp.Metadata == nil {
		resp.Metadata = &models.ResponseMetadata{}
	}
	resp.Metadata.RouteDecision = fmt.Sprintf("Selected %s based on optimization policy", providerName)
	resp.Metadata.LatencyMs = latency

	// TODO: Send feedback to Rust optimizer once integrated
	// r.sendOptimizerFeedback(providerName, latency, resp)

	return resp, nil
}

// RouteStream selects provider and performs streaming inference
func (r *InferenceRouter) RouteStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	providerName, err := r.selectProvider(req)
	if err != nil {
		errChan := make(chan error, 1)
		errChan <- err
		close(errChan)
		return nil, errChan
	}

	provider, exists := r.registry.Get(providerName)
	if !exists {
		errChan := make(chan error, 1)
		errChan <- fmt.Errorf("provider %s not found", providerName)
		close(errChan)
		return nil, errChan
	}

	log.Printf("[Router] Streaming via provider: %s for model: %s", providerName, req.Model)

	return provider.InferStream(ctx, req)
}

// selectProvider chooses the best provider for a request
func (r *InferenceRouter) selectProvider(req *models.InferRequest) (string, error) {
	// Priority 1: Explicit provider override in policy
	if req.Policy != nil && req.Policy.Provider != "" {
		return req.Policy.Provider, nil
	}

	// Priority 2: Model-based provider detection
	providerName, _ := req.GetProvider()
	if providerName != "" {
		// Verify provider exists
		if _, exists := r.registry.Get(providerName); exists {
			return providerName, nil
		}
	}

	// Priority 3: Optimization-based selection
	if r.enableOptimization {
		return r.optimizeProviderSelection(req)
	}

	// Priority 4: Default provider
	return r.defaultProvider, nil
}

// optimizeProviderSelection uses Thompson Sampling-like logic (interim)
// TODO: Replace with Rust FFI call to optimizer
func (r *InferenceRouter) optimizeProviderSelection(req *models.InferRequest) (string, error) {
	// Get all available providers
	providerNames := r.registry.List()
	if len(providerNames) == 0 {
		return "", fmt.Errorf("no providers available")
	}

	// If optimization is based on request policy
	if req.Policy != nil && req.Policy.OptimizeFor != "" {
		return r.selectByOptimizationGoal(providerNames, req.Policy.OptimizeFor)
	}

	// TODO: Implement Thompson Sampling arm selection
	// For now, use simple weighted random based on reliability
	return r.weightedRandomSelection(providerNames)
}

// selectByOptimizationGoal selects provider based on optimization goal
func (r *InferenceRouter) selectByOptimizationGoal(providerNames []string, goal string) (string, error) {
	if len(providerNames) == 0 {
		return "", fmt.Errorf("no providers available")
	}

	switch goal {
	case "latency":
		// Select provider with lowest average latency
		return r.selectByLowestLatency(providerNames), nil

	case "cost":
		// Select provider with lowest cost
		return r.selectByLowestCost(providerNames), nil

	case "quality":
		// Select provider with highest quality score
		return r.selectByHighestQuality(providerNames), nil

	default:
		// Fallback to weighted random
		return r.weightedRandomSelection(providerNames)
	}
}

// selectByLowestLatency picks provider with best latency
func (r *InferenceRouter) selectByLowestLatency(providerNames []string) string {
	bestProvider := providerNames[0]
	bestLatency := float64(1000000) // High default

	for _, name := range providerNames {
		if stats, exists := r.providerStats[name]; exists && stats.AverageLatency > 0 {
			if stats.AverageLatency < bestLatency {
				bestLatency = stats.AverageLatency
				bestProvider = name
			}
		}
	}

	return bestProvider
}

// selectByLowestCost picks provider with lowest cost per token
func (r *InferenceRouter) selectByLowestCost(providerNames []string) string {
	// TODO: Implement cost-based selection using provider capabilities
	// For now, assume order: haiku < gpt-3.5 < sonnet < gpt-4 < opus
	costOrder := map[string]int{
		"anthropic": 2, // Assuming Sonnet
		"openai":    3, // Assuming GPT-4
	}

	bestProvider := providerNames[0]
	bestCost := 100

	for _, name := range providerNames {
		if cost, exists := costOrder[name]; exists && cost < bestCost {
			bestCost = cost
			bestProvider = name
		}
	}

	return bestProvider
}

// selectByHighestQuality picks provider with best quality
func (r *InferenceRouter) selectByHighestQuality(providerNames []string) string {
	// TODO: Implement quality-based selection
	// For now, prefer providers with higher reliability
	bestProvider := providerNames[0]
	bestReliability := 0.0

	for _, name := range providerNames {
		if stats, exists := r.providerStats[name]; exists {
			if stats.ReliabilityRate > bestReliability {
				bestReliability = stats.ReliabilityRate
				bestProvider = name
			}
		}
	}

	return bestProvider
}

// weightedRandomSelection performs weighted random selection
func (r *InferenceRouter) weightedRandomSelection(providerNames []string) (string, error) {
	// Simple uniform random for now
	// TODO: Weight by reliability and performance
	if len(providerNames) == 0 {
		return "", fmt.Errorf("no providers available")
	}
	return providerNames[rand.Intn(len(providerNames))], nil
}

// attemptFallback tries alternative providers on failure
func (r *InferenceRouter) attemptFallback(ctx context.Context, req *models.InferRequest, failedProvider string) (*models.InferResponse, error) {
	providerNames := r.registry.List()

	for _, name := range providerNames {
		if name == failedProvider {
			continue
		}

		provider, exists := r.registry.Get(name)
		if !exists {
			continue
		}

		log.Printf("[Router] Attempting fallback to %s", name)

		resp, err := provider.Infer(ctx, req)
		if err == nil {
			r.recordSuccess(name, 0)
			return resp, nil
		}

		log.Printf("[Router] Fallback to %s failed: %v", name, err)
		r.recordFailure(name)
	}

	return nil, fmt.Errorf("all fallback providers failed")
}

// recordSuccess updates provider statistics on success
func (r *InferenceRouter) recordSuccess(providerName string, latencyMs int64) {
	stats, exists := r.providerStats[providerName]
	if !exists {
		stats = &ProviderStats{}
		r.providerStats[providerName] = stats
	}

	stats.TotalRequests++
	stats.SuccessfulReqs++
	stats.TotalLatencyMs += latencyMs
	stats.LastLatencyMs = latencyMs
	stats.AverageLatency = float64(stats.TotalLatencyMs) / float64(stats.SuccessfulReqs)
	stats.ReliabilityRate = float64(stats.SuccessfulReqs) / float64(stats.TotalRequests)
	stats.LastUpdated = time.Now()
}

// recordFailure updates provider statistics on failure
func (r *InferenceRouter) recordFailure(providerName string) {
	stats, exists := r.providerStats[providerName]
	if !exists {
		stats = &ProviderStats{}
		r.providerStats[providerName] = stats
	}

	stats.TotalRequests++
	stats.FailedReqs++
	stats.ReliabilityRate = float64(stats.SuccessfulReqs) / float64(stats.TotalRequests)
	stats.LastUpdated = time.Now()
}

// GetStats returns current provider statistics
func (r *InferenceRouter) GetStats() map[string]*ProviderStats {
	return r.providerStats
}

// TODO: Future Rust optimizer integration
// This function will be called once Rust FFI is integrated per OPTIMIZER_RFC.md
func (r *InferenceRouter) sendOptimizerFeedback(providerName string, latencyMs int64, resp *models.InferResponse) {
	// Placeholder for Rust FFI call
	// Expected implementation:
	// 1. Calculate reward signal based on latency, success, cost
	// 2. Call rust.OptimizerUpdateReward(actionID, reward)
	// 3. Handle errors and fallback to Go-based routing

	log.Printf("[Router] TODO: Send optimizer feedback for %s (latency: %dms)", providerName, latencyMs)
}
