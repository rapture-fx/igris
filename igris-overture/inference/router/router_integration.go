package router

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/ffi"
	"github.com/Igris-inertial/system/igris-overture/inference/quality"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// InferenceRouter handles intelligent routing of inference requests
// Now integrated with Rust Thompson Sampling optimizer and quality-aware routing
type InferenceRouter struct {
	registry *providers.ProviderRegistry

	// Rust optimizer (primary routing engine)
	optimizer *ffi.OptimizerHandle

	// Quality routing components
	qualityScorer  *quality.QualityScorer
	rewardBuilder  *RewardPolicyBuilder
	db             *sql.DB

	// Routing state (Go fallback when optimizer unavailable)
	providerStats   map[string]*ProviderStats
	providerStatsMu sync.RWMutex // Protect concurrent access

	// Configuration
	enableOptimization bool
	useRustOptimizer   bool
	fallbackEnabled    bool
	defaultProvider    string
	enableQualityRouting bool
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
func NewInferenceRouter(registry *providers.ProviderRegistry, db *sql.DB) *InferenceRouter {
	return &InferenceRouter{
		registry:             registry,
		qualityScorer:        quality.NewQualityScorer(),
		rewardBuilder:        NewRewardPolicyBuilder(),
		db:                   db,
		providerStats:        make(map[string]*ProviderStats),
		enableOptimization:   true,
		useRustOptimizer:     false, // Will be enabled after InitializeOptimizer is called
		fallbackEnabled:      true,
		defaultProvider:      "openai",
		enableQualityRouting: true, // Enable quality routing by default
	}
}

// InitializeOptimizer initializes the Rust Thompson Sampling optimizer
func (r *InferenceRouter) InitializeOptimizer() error {
	// Get all registered provider names as arms
	providerNames := r.registry.List()
	if len(providerNames) == 0 {
		return fmt.Errorf("no providers registered - cannot initialize optimizer")
	}

	log.Printf("[Router] Initializing Rust optimizer with %d providers: %v", len(providerNames), providerNames)

	// Use default balanced preferences for initialization
	defaultPrefs := models.GetDefaultPreferences("default")
	rewardPolicy := r.rewardBuilder.BuildRewardPolicy(defaultPrefs, nil)

	// Create optimizer configuration with balanced weights
	config := ffi.OptimizerConfig{
		Arms:             providerNames,
		SuccessThreshold: 0.6,
		InitialAlpha:     1.0,
		InitialBeta:      1.0,
		RewardPolicy:     rewardPolicy,
	}

	// Initialize Rust optimizer via FFI
	optimizer, err := ffi.NewOptimizer(config)
	if err != nil {
		return fmt.Errorf("failed to initialize Rust optimizer: %w", err)
	}

	r.optimizer = optimizer
	r.useRustOptimizer = true

	log.Printf("[Router] ✅ Rust optimizer initialized with balanced quality routing (Q:%.2f, L:%.2f, C:%.2f)",
		rewardPolicy.QualityWeight, rewardPolicy.LatencyWeight, rewardPolicy.CostWeight)
	return nil
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
		latency := time.Since(startTime).Milliseconds()
		r.recordFailure(providerName)

		// Send failure feedback to optimizer to penalize this provider
		r.sendFailureFeedback(providerName, latency)

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

	// Step 6: Send feedback to Rust optimizer
	r.sendOptimizerFeedback(ctx, req, providerName, latency, resp)

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

// optimizeProviderSelection uses Rust Thompson Sampling optimizer (primary)
// Falls back to Go-based selection if Rust optimizer unavailable
func (r *InferenceRouter) optimizeProviderSelection(req *models.InferRequest) (string, error) {
	// Get all available providers
	providerNames := r.registry.List()
	if len(providerNames) == 0 {
		return "", fmt.Errorf("no providers available")
	}

	// Try Rust optimizer first if enabled
	if r.useRustOptimizer && r.optimizer != nil {
		action, err := r.optimizer.SelectAction()
		if err != nil {
			log.Printf("[Router] ⚠️  Rust optimizer selection failed: %v, falling back to Go", err)
			// Fall through to Go-based selection
		} else {
			// Verify the selected provider exists
			if _, exists := r.registry.Get(action.ActionID); exists {
				log.Printf("[Router] 🦀 Rust optimizer selected: %s", action.ActionID)
				return action.ActionID, nil
			}
			log.Printf("[Router] ⚠️  Rust optimizer returned invalid provider: %s, falling back", action.ActionID)
		}
	}

	// Go-based fallback selection
	// If optimization is based on request policy
	if req.Policy != nil && req.Policy.OptimizeFor != "" {
		return r.selectByOptimizationGoal(providerNames, req.Policy.OptimizeFor)
	}

	// Use simple weighted random based on reliability
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

		startTime := time.Now()
		resp, err := provider.Infer(ctx, req)
		latency := time.Since(startTime).Milliseconds()

		if err == nil {
			r.recordSuccess(name, latency)
			// Send success feedback for fallback provider
			r.sendOptimizerFeedback(ctx, req, name, latency, resp)
			return resp, nil
		}

		log.Printf("[Router] Fallback to %s failed: %v", name, err)
		r.recordFailure(name)
		// Send failure feedback for fallback provider
		r.sendFailureFeedback(name, latency)
	}

	return nil, fmt.Errorf("all fallback providers failed")
}

// recordSuccess updates provider statistics on success (with mutex protection)
func (r *InferenceRouter) recordSuccess(providerName string, latencyMs int64) {
	r.providerStatsMu.Lock()
	defer r.providerStatsMu.Unlock()

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

// recordFailure updates provider statistics on failure (with mutex protection)
func (r *InferenceRouter) recordFailure(providerName string) {
	r.providerStatsMu.Lock()
	defer r.providerStatsMu.Unlock()

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

// RouteToProvider routes to a specific provider (used by Rust optimizer)
func (r *InferenceRouter) RouteToProvider(ctx context.Context, req *models.InferRequest, providerName string) (*models.InferResponse, error) {
	startTime := time.Now()

	// Get provider from registry
	provider, exists := r.registry.Get(providerName)
	if !exists {
		return nil, fmt.Errorf("provider %s not found in registry", providerName)
	}

	log.Printf("[Router] Routing to specific provider: %s for model: %s", providerName, req.Model)

	// Execute inference
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		log.Printf("[Router] Provider %s failed: %v", providerName, err)
		r.recordFailure(providerName)
		return nil, err
	}

	// Record success metrics
	latency := time.Since(startTime).Milliseconds()
	r.recordSuccess(providerName, latency)

	// Add routing metadata
	if resp.Metadata == nil {
		resp.Metadata = &models.ResponseMetadata{}
	}
	resp.Metadata.RouteDecision = fmt.Sprintf("Direct routing to %s", providerName)
	resp.Metadata.LatencyMs = latency

	return resp, nil
}

// sendOptimizerFeedback sends reward feedback to the Rust optimizer
func (r *InferenceRouter) sendOptimizerFeedback(ctx context.Context, req *models.InferRequest, providerName string, latencyMs int64, resp *models.InferResponse) {
	// Only send feedback if Rust optimizer is enabled
	if !r.useRustOptimizer || r.optimizer == nil {
		return
	}

	// Calculate cost from response metadata
	costUsd := 0.0
	if resp.Metadata != nil && resp.Metadata.CostUSD > 0 {
		costUsd = resp.Metadata.CostUSD
	}

	// Calculate quality score if quality routing is enabled
	var qualityScore *float64
	if r.enableQualityRouting && req != nil && resp != nil {
		// Classify the request
		classification := quality.ClassifyRequest(req)

		// Calculate quality score with timeout (max 20ms)
		score, err := r.qualityScorer.ScoreWithTimeout(
			ctx,
			req,
			resp,
			classification,
			20*time.Millisecond,
		)
		if err == nil && score > 0 {
			qualityScore = &score
		}
	}

	// Create metrics for reward calculation
	metrics := ffi.RewardMetrics{
		LatencyMs:    float64(latencyMs),
		Success:      true, // If we got here, the request succeeded
		CacheHit:     false,
		CostUsd:      costUsd,
		QualityScore: qualityScore,
	}

	// Send metrics to Rust optimizer
	err := r.optimizer.UpdateMetrics(providerName, metrics)
	if err != nil {
		// Log error but don't fail the request
		log.Printf("[Router] ⚠️  Failed to send optimizer feedback for %s: %v", providerName, err)
		return
	}

	qualityLog := "nil"
	if qualityScore != nil {
		qualityLog = fmt.Sprintf("%.3f", *qualityScore)
	}
	log.Printf("[Router] 🦀 Sent optimizer feedback: provider=%s, latency=%dms, cost=$%.6f, quality=%s",
		providerName, latencyMs, costUsd, qualityLog)
}

// sendFailureFeedback sends negative feedback to the Rust optimizer for failed requests
// This strongly penalizes providers with high failure rates
func (r *InferenceRouter) sendFailureFeedback(providerName string, latencyMs int64) {
	// Only send feedback if Rust optimizer is enabled
	if !r.useRustOptimizer || r.optimizer == nil {
		return
	}

	// Create metrics with success=false to penalize the provider
	// Use max latency and high cost to make the penalty even stronger
	metrics := ffi.RewardMetrics{
		LatencyMs:    float64(latencyMs),
		Success:      false, // CRITICAL: Mark as failure
		CacheHit:     false,
		CostUsd:      0.1,  // Use max cost to penalize
		QualityScore: nil,
	}

	// Send failure metrics to Rust optimizer
	err := r.optimizer.UpdateMetrics(providerName, metrics)
	if err != nil {
		log.Printf("[Router] ⚠️  Failed to send failure feedback for %s: %v", providerName, err)
		return
	}

	log.Printf("[Router] 🦀 Sent failure feedback: provider=%s, latency=%dms (FAILURE PENALTY)",
		providerName, latencyMs)
}
