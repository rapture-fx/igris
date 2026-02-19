package core

import (
	"context"
	"fmt"
	"log"
	"math"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// RuntimeType identifies the execution runtime backend.
// Defined independently in this package to avoid importing ml.
type RuntimeType string

const (
	RuntimePyTorch  RuntimeType = "pytorch"
	RuntimeONNX     RuntimeType = "onnx"
	RuntimeTensorRT RuntimeType = "tensorrt"
	RuntimeCPU      RuntimeType = "cpu"
)

// ModelMetadata contains information about a registered model
type ModelMetadata struct {
	ID              string
	Name            string
	Version         string
	Runtime         RuntimeType
	Priority        int
	Enabled         bool
	WarmupCompleted bool
	RegistrationTime time.Time
}

// ModelArm represents a model choice in Thompson Sampling
type ModelArm struct {
	ModelID     string
	Runtime     RuntimeType
	Alpha       float64 // Success count (Beta distribution)
	Beta        float64 // Failure count (Beta distribution)
	TotalPulls  int64   // Total times selected
	LastPulled  time.Time
	AvgLatency  float64
	mu          sync.RWMutex
}

// MultiModelRouter routes requests to optimal models using Thompson Sampling
type MultiModelRouter struct {
	models      map[string]*ModelMetadata
	arms        map[string]*ModelArm
	modelsMutex sync.RWMutex

	// Thompson Sampling parameters
	defaultAlpha float64
	defaultBeta  float64

	// Performance tracking
	routingDecisions int64
	explorationRate  float64

	// Context-aware routing
	enableContextRouting bool
	contextWeights       map[string]float64

	rng *rand.Rand
}

// NewMultiModelRouter creates a new multi-model router
func NewMultiModelRouter() *MultiModelRouter {
	return &MultiModelRouter{
		models:               make(map[string]*ModelMetadata),
		arms:                 make(map[string]*ModelArm),
		defaultAlpha:         1.0,
		defaultBeta:          1.0,
		explorationRate:      0.1,
		enableContextRouting: true,
		contextWeights:       make(map[string]float64),
		rng:                  rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// RegisterModel registers a new model with the router
func (r *MultiModelRouter) RegisterModel(metadata ModelMetadata) error {
	r.modelsMutex.Lock()
	defer r.modelsMutex.Unlock()

	if _, exists := r.models[metadata.ID]; exists {
		return fmt.Errorf("model %s already registered", metadata.ID)
	}

	// Set defaults
	if metadata.Runtime == "" {
		metadata.Runtime = RuntimePyTorch
	}
	metadata.RegistrationTime = time.Now()
	metadata.Enabled = true
	metadata.WarmupCompleted = false

	r.models[metadata.ID] = &metadata

	// Initialize Thompson Sampling arm
	r.arms[metadata.ID] = &ModelArm{
		ModelID:    metadata.ID,
		Runtime:    metadata.Runtime,
		Alpha:      r.defaultAlpha,
		Beta:       r.defaultBeta,
		TotalPulls: 0,
		LastPulled: time.Now(),
		AvgLatency: 0,
	}

	log.Printf("[MultiModelRouter] Registered model: %s (runtime: %s, version: %s)",
		metadata.ID, metadata.Runtime, metadata.Version)

	observability.RecordModelRegistration(metadata.ID, string(metadata.Runtime))

	return nil
}

// SelectModel selects the best model using Thompson Sampling
func (r *MultiModelRouter) SelectModel(requestedModelID string) (string, RuntimeType) {
	r.modelsMutex.RLock()
	defer r.modelsMutex.RUnlock()

	atomic.AddInt64(&r.routingDecisions, 1)

	// If specific model requested and exists, check if enabled
	if requestedModelID != "" {
		if model, exists := r.models[requestedModelID]; exists && model.Enabled {
			arm := r.arms[requestedModelID]
			arm.mu.Lock()
			arm.TotalPulls++
			arm.LastPulled = time.Now()
			arm.mu.Unlock()

			observability.RecordModelSelection(requestedModelID, string(model.Runtime), "direct")
			return requestedModelID, model.Runtime
		}
	}

	// Thompson Sampling: select model based on Beta distribution
	var selectedModel string
	var selectedRuntime RuntimeType
	maxSample := -1.0

	enabledModels := make([]*ModelArm, 0)
	for modelID, model := range r.models {
		if model.Enabled {
			enabledModels = append(enabledModels, r.arms[modelID])
		}
	}

	if len(enabledModels) == 0 {
		// Fallback to default model
		log.Printf("[MultiModelRouter] No enabled models, using default")
		return "default", RuntimeCPU
	}

	// Exploration vs Exploitation
	if r.rng.Float64() < r.explorationRate {
		// Exploration: choose randomly
		randomIdx := r.rng.Intn(len(enabledModels))
		arm := enabledModels[randomIdx]
		selectedModel = arm.ModelID
		selectedRuntime = arm.Runtime

		arm.mu.Lock()
		arm.TotalPulls++
		arm.LastPulled = time.Now()
		arm.mu.Unlock()

		observability.RecordModelSelection(selectedModel, string(selectedRuntime), "exploration")
	} else {
		// Exploitation: Thompson Sampling
		for _, arm := range enabledModels {
			arm.mu.RLock()
			alpha := arm.Alpha
			beta := arm.Beta
			arm.mu.RUnlock()

			// Sample from Beta distribution
			sample := r.betaSample(alpha, beta)

			if sample > maxSample {
				maxSample = sample
				selectedModel = arm.ModelID
				selectedRuntime = arm.Runtime
			}
		}

		if arm, exists := r.arms[selectedModel]; exists {
			arm.mu.Lock()
			arm.TotalPulls++
			arm.LastPulled = time.Now()
			arm.mu.Unlock()
		}

		observability.RecordModelSelection(selectedModel, string(selectedRuntime), "exploitation")
	}

	return selectedModel, selectedRuntime
}

// UpdateModelPerformance updates model performance based on inference result
func (r *MultiModelRouter) UpdateModelPerformance(modelID string, success bool, latency time.Duration) {
	r.modelsMutex.RLock()
	arm, exists := r.arms[modelID]
	r.modelsMutex.RUnlock()

	if !exists {
		log.Printf("[MultiModelRouter] Unknown model: %s", modelID)
		return
	}

	arm.mu.Lock()
	defer arm.mu.Unlock()

	// Update Thompson Sampling parameters
	if success {
		arm.Alpha += 1.0
	} else {
		arm.Beta += 1.0
	}

	// Update average latency (exponential moving average)
	latencyMs := float64(latency.Milliseconds())
	if arm.AvgLatency == 0 {
		arm.AvgLatency = latencyMs
	} else {
		arm.AvgLatency = 0.9*arm.AvgLatency + 0.1*latencyMs
	}

	// Record metrics
	observability.RecordModelPerformance(
		modelID,
		string(arm.Runtime),
		success,
		latency.Milliseconds(),
	)

	log.Printf("[MultiModelRouter] Model %s updated: α=%.2f, β=%.2f, avg_latency=%.2fms",
		modelID, arm.Alpha, arm.Beta, arm.AvgLatency)
}

// GetModelStats returns statistics for a specific model
func (r *MultiModelRouter) GetModelStats(modelID string) *ModelStats {
	r.modelsMutex.RLock()
	defer r.modelsMutex.RUnlock()

	model, modelExists := r.models[modelID]
	arm, armExists := r.arms[modelID]

	if !modelExists || !armExists {
		return nil
	}

	arm.mu.RLock()
	defer arm.mu.RUnlock()

	totalAttempts := arm.Alpha + arm.Beta - 2.0 // Subtract initial priors
	successRate := 0.0
	if totalAttempts > 0 {
		successRate = (arm.Alpha - 1.0) / totalAttempts
	}

	return &ModelStats{
		ModelID:         modelID,
		ModelName:       model.Name,
		Version:         model.Version,
		Runtime:         string(arm.Runtime),
		Enabled:         model.Enabled,
		TotalSelections: arm.TotalPulls,
		SuccessCount:    int64(arm.Alpha - 1.0),
		FailureCount:    int64(arm.Beta - 1.0),
		SuccessRate:     successRate,
		AvgLatencyMs:    arm.AvgLatency,
		LastUsed:        arm.LastPulled,
	}
}

// GetAllModelStats returns statistics for all registered models
func (r *MultiModelRouter) GetAllModelStats() []*ModelStats {
	r.modelsMutex.RLock()
	defer r.modelsMutex.RUnlock()

	stats := make([]*ModelStats, 0, len(r.models))
	for modelID := range r.models {
		if stat := r.GetModelStats(modelID); stat != nil {
			stats = append(stats, stat)
		}
	}

	return stats
}

// EnableModel enables a model for routing
func (r *MultiModelRouter) EnableModel(modelID string) error {
	r.modelsMutex.Lock()
	defer r.modelsMutex.Unlock()

	model, exists := r.models[modelID]
	if !exists {
		return fmt.Errorf("model %s not found", modelID)
	}

	model.Enabled = true
	log.Printf("[MultiModelRouter] Model %s enabled", modelID)
	return nil
}

// DisableModel disables a model from routing
func (r *MultiModelRouter) DisableModel(modelID string) error {
	r.modelsMutex.Lock()
	defer r.modelsMutex.Unlock()

	model, exists := r.models[modelID]
	if !exists {
		return fmt.Errorf("model %s not found", modelID)
	}

	model.Enabled = false
	log.Printf("[MultiModelRouter] Model %s disabled", modelID)
	return nil
}

// WarmupModel marks a model as warmed up and ready
func (r *MultiModelRouter) WarmupModel(modelID string) error {
	r.modelsMutex.Lock()
	defer r.modelsMutex.Unlock()

	model, exists := r.models[modelID]
	if !exists {
		return fmt.Errorf("model %s not found", modelID)
	}

	model.WarmupCompleted = true
	log.Printf("[MultiModelRouter] Model %s warmup completed", modelID)
	return nil
}

// ResetModelStats resets Thompson Sampling statistics for a model
func (r *MultiModelRouter) ResetModelStats(modelID string) error {
	r.modelsMutex.Lock()
	defer r.modelsMutex.Unlock()

	arm, exists := r.arms[modelID]
	if !exists {
		return fmt.Errorf("model %s not found", modelID)
	}

	arm.mu.Lock()
	defer arm.mu.Unlock()

	arm.Alpha = r.defaultAlpha
	arm.Beta = r.defaultBeta
	arm.TotalPulls = 0
	arm.AvgLatency = 0

	log.Printf("[MultiModelRouter] Model %s stats reset", modelID)
	return nil
}

// betaSample samples from a Beta distribution using rejection sampling
func (r *MultiModelRouter) betaSample(alpha, beta float64) float64 {
	// Simple approximation using gamma distribution
	// Beta(α, β) = Gamma(α) / (Gamma(α) + Gamma(β))

	if alpha <= 0 || beta <= 0 {
		return r.rng.Float64()
	}

	x := r.gammaSample(alpha)
	y := r.gammaSample(beta)

	if x+y == 0 {
		return 0.5
	}

	return x / (x + y)
}

// gammaSample samples from a Gamma distribution
func (r *MultiModelRouter) gammaSample(alpha float64) float64 {
	// Marsaglia and Tsang's method
	if alpha < 1 {
		return r.gammaSample(alpha+1) * math.Pow(r.rng.Float64(), 1.0/alpha)
	}

	d := alpha - 1.0/3.0
	c := 1.0 / math.Sqrt(9.0*d)

	for {
		x := r.rng.NormFloat64()
		v := 1.0 + c*x
		if v <= 0 {
			continue
		}

		v = v * v * v
		u := r.rng.Float64()

		if u < 1.0-0.0331*(x*x)*(x*x) {
			return d * v
		}

		if math.Log(u) < 0.5*x*x+d*(1.0-v+math.Log(v)) {
			return d * v
		}
	}
}

// GetRoutingStats returns overall routing statistics
func (r *MultiModelRouter) GetRoutingStats() map[string]interface{} {
	r.modelsMutex.RLock()
	defer r.modelsMutex.RUnlock()

	return map[string]interface{}{
		"total_routing_decisions": atomic.LoadInt64(&r.routingDecisions),
		"total_models":            len(r.models),
		"enabled_models":          r.countEnabledModels(),
		"exploration_rate":        r.explorationRate,
	}
}

// countEnabledModels counts the number of enabled models
func (r *MultiModelRouter) countEnabledModels() int {
	count := 0
	for _, model := range r.models {
		if model.Enabled {
			count++
		}
	}
	return count
}

// SetExplorationRate sets the exploration rate for Thompson Sampling
func (r *MultiModelRouter) SetExplorationRate(rate float64) {
	if rate < 0 {
		rate = 0
	}
	if rate > 1 {
		rate = 1
	}
	r.explorationRate = rate
	log.Printf("[MultiModelRouter] Exploration rate set to %.2f", rate)
}

// SelectModelWithContext selects a model based on request context
func (r *MultiModelRouter) SelectModelWithContext(
	ctx context.Context,
	requestedModelID string,
	metadata map[string]interface{},
) (string, RuntimeType) {
	// For now, delegate to standard selection
	// Future enhancement: use context metadata for smarter routing
	return r.SelectModel(requestedModelID)
}

// ModelStats contains statistics about a model
type ModelStats struct {
	ModelID         string
	ModelName       string
	Version         string
	Runtime         string
	Enabled         bool
	TotalSelections int64
	SuccessCount    int64
	FailureCount    int64
	SuccessRate     float64
	AvgLatencyMs    float64
	LastUsed        time.Time
}

// String returns a string representation of model stats
func (s *ModelStats) String() string {
	return fmt.Sprintf(
		"Model[%s]: Runtime=%s, Success=%.2f%%, AvgLatency=%.2fms, Selections=%d",
		s.ModelID,
		s.Runtime,
		s.SuccessRate*100,
		s.AvgLatencyMs,
		s.TotalSelections,
	)
}
