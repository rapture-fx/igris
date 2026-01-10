package router

import (
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"
)

// ThompsonSamplingPhase represents the current exploration phase
type ThompsonSamplingPhase string

const (
	PhaseBootstrap ThompsonSamplingPhase = "bootstrap" // Initial data collection
	PhaseExplore   ThompsonSamplingPhase = "explore"   // Active exploration
	PhaseExploit   ThompsonSamplingPhase = "exploit"   // Optimal exploitation
)

// ThompsonSamplingConfig defines Thompson Sampling parameters
type ThompsonSamplingConfig struct {
	// Cold-start protection
	MinSamplesForExploit   int     // Default: 50 - minimum samples before exploitation
	BootstrapSamples       int     // Default: 10 - forced exploration per new backend
	PessimisticPriorAlpha  float64 // Default: 1.0 - prior successes for new backends
	PessimisticPriorBeta   float64 // Default: 3.0 - prior failures for new backends (assume 25% success rate)

	// Exploration control
	MaxExplorationBudget   int     // Default: 1000 - total exploration attempts before pure exploitation
	ExplorationDecayRate   float64 // Default: 0.995 - exponential decay of exploration rate
	MinExplorationRate     float64 // Default: 0.05 - minimum exploration rate (5%)
	InitialExplorationRate float64 // Default: 0.30 - initial exploration rate (30%)

	// Phase transitions
	ExploreToExploitSamples int // Default: 200 - samples needed to transition to exploit phase
}

// DefaultThompsonSamplingConfig returns safe default parameters
func DefaultThompsonSamplingConfig() ThompsonSamplingConfig {
	return ThompsonSamplingConfig{
		MinSamplesForExploit:    50,
		BootstrapSamples:        10,
		PessimisticPriorAlpha:   1.0,
		PessimisticPriorBeta:    3.0,
		MaxExplorationBudget:    1000,
		ExplorationDecayRate:    0.995,
		MinExplorationRate:      0.05,
		InitialExplorationRate:  0.30,
		ExploreToExploitSamples: 200,
	}
}

// ThompsonSamplingState tracks sampling state per backend
type ThompsonSamplingState struct {
	BackendID          string
	Phase              ThompsonSamplingPhase
	SamplesCollected   int
	BootstrapRemaining int
	Alpha              float64 // Beta distribution parameter (successes + prior)
	Beta               float64 // Beta distribution parameter (failures + prior)
	LastSampleValue    float64 // Last sampled value from Beta distribution
	ExplorationCount   int     // Number of exploration samples
	ExploitationCount  int     // Number of exploitation samples
	mu                 sync.RWMutex
}

// ThompsonSamplingEngine manages Thompson Sampling with cold-start protection
type ThompsonSamplingEngine struct {
	config              ThompsonSamplingConfig
	states              map[string]*ThompsonSamplingState
	globalExplorationCount int
	currentExplorationRate float64
	rng                 *rand.Rand
	mu                  sync.RWMutex
}

// NewThompsonSamplingEngine creates a new Thompson Sampling engine
func NewThompsonSamplingEngine(config ThompsonSamplingConfig) *ThompsonSamplingEngine {
	return &ThompsonSamplingEngine{
		config:              config,
		states:              make(map[string]*ThompsonSamplingState),
		currentExplorationRate: config.InitialExplorationRate,
		rng:                 rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// GetOrInitializeState gets or creates state for a backend
func (tse *ThompsonSamplingEngine) GetOrInitializeState(backendID string) *ThompsonSamplingState {
	tse.mu.Lock()
	defer tse.mu.Unlock()

	state, exists := tse.states[backendID]
	if !exists {
		// COLD-START PROTECTION: Initialize with pessimistic priors
		state = &ThompsonSamplingState{
			BackendID:          backendID,
			Phase:              PhaseBootstrap,
			SamplesCollected:   0,
			BootstrapRemaining: tse.config.BootstrapSamples,
			Alpha:              tse.config.PessimisticPriorAlpha,
			Beta:               tse.config.PessimisticPriorBeta,
			ExplorationCount:   0,
			ExploitationCount:  0,
		}
		tse.states[backendID] = state
	}

	return state
}

// SelectBackend selects a backend using Thompson Sampling with cold-start protection
func (tse *ThompsonSamplingEngine) SelectBackend(candidates []*Backend) (*Backend, string, float64) {
	if len(candidates) == 0 {
		return nil, "no candidates available", 0.0
	}

	if len(candidates) == 1 {
		return candidates[0], "only one candidate", 1.0
	}

	// Check exploration budget
	tse.mu.RLock()
	budgetExhausted := tse.globalExplorationCount >= tse.config.MaxExplorationBudget
	tse.mu.RUnlock()

	// PHASE 1: Bootstrap - force exploration of backends needing bootstrap samples
	for _, backend := range candidates {
		state := tse.GetOrInitializeState(backend.ID)
		state.mu.RLock()
		needsBootstrap := state.Phase == PhaseBootstrap && state.BootstrapRemaining > 0
		state.mu.RUnlock()

		if needsBootstrap {
			return backend, fmt.Sprintf("Thompson Sampling: bootstrap (%d samples remaining)", state.BootstrapRemaining), 0.0
		}
	}

	// PHASE 2: Exploration - probabilistic exploration with decay
	shouldExplore := false
	if !budgetExhausted {
		tse.mu.RLock()
		explorationProb := tse.currentExplorationRate
		randomValue := tse.rng.Float64()
		tse.mu.RUnlock()

		shouldExplore = randomValue < explorationProb
	}

	if shouldExplore {
		// Explore: prioritize backends with fewest samples (cold-start protection)
		minSamples := math.MaxInt64
		var coldest *Backend

		for _, backend := range candidates {
			state := tse.GetOrInitializeState(backend.ID)
			state.mu.RLock()
			samples := state.SamplesCollected
			state.mu.RUnlock()

			if samples < minSamples {
				minSamples = samples
				coldest = backend
			}
		}

		if coldest != nil {
			state := tse.GetOrInitializeState(coldest.ID)
			state.mu.RLock()
			phase := state.Phase
			state.mu.RUnlock()

			return coldest, fmt.Sprintf("Thompson Sampling: explore (phase=%s, samples=%d)", phase, minSamples),
				tse.currentExplorationRate
		}
	}

	// PHASE 3: Exploitation - sample from Beta distributions
	var best *Backend
	maxSample := -1.0
	reason := "Thompson Sampling: exploit"

	for _, backend := range candidates {
		state := tse.GetOrInitializeState(backend.ID)
		state.mu.RLock()
		alpha := state.Alpha
		beta := state.Beta
		samples := state.SamplesCollected
		phase := state.Phase
		state.mu.RUnlock()

		// COLD-START PROTECTION: Skip backends without minimum samples
		if samples < tse.config.MinSamplesForExploit {
			continue
		}

		// Sample from Beta(alpha, beta) distribution
		sample := tse.sampleBeta(alpha, beta)

		state.mu.Lock()
		state.LastSampleValue = sample
		state.mu.Unlock()

		if sample > maxSample {
			maxSample = sample
			best = backend
			reason = fmt.Sprintf("Thompson Sampling: exploit (phase=%s, score=%.3f, α=%.1f, β=%.1f)",
				phase, sample, alpha, beta)
		}
	}

	// FAIL-SAFE: If no backend has minimum samples, fall back to exploration
	if best == nil {
		// Select backend with fewest samples for forced exploration
		minSamples := math.MaxInt64
		for _, backend := range candidates {
			state := tse.GetOrInitializeState(backend.ID)
			state.mu.RLock()
			samples := state.SamplesCollected
			state.mu.RUnlock()

			if samples < minSamples {
				minSamples = samples
				best = backend
			}
		}

		if best != nil {
			reason = fmt.Sprintf("Thompson Sampling: forced exploration (insufficient samples: %d < %d)",
				minSamples, tse.config.MinSamplesForExploit)
			maxSample = 0.0
		}
	}

	return best, reason, maxSample
}

// RecordOutcome updates Thompson Sampling state based on request outcome
func (tse *ThompsonSamplingEngine) RecordOutcome(backendID string, success bool, isExploration bool) {
	state := tse.GetOrInitializeState(backendID)

	state.mu.Lock()
	defer state.mu.Unlock()

	// Update sample count
	state.SamplesCollected++

	// Update Beta distribution parameters
	if success {
		state.Alpha += 1.0
	} else {
		state.Beta += 1.0
	}

	// Update exploration/exploitation counts
	if isExploration {
		state.ExplorationCount++

		// Decrement bootstrap counter
		if state.Phase == PhaseBootstrap && state.BootstrapRemaining > 0 {
			state.BootstrapRemaining--
			if state.BootstrapRemaining == 0 {
				state.Phase = PhaseExplore
			}
		}
	} else {
		state.ExploitationCount++
	}

	// Phase transition: Bootstrap → Explore
	if state.Phase == PhaseBootstrap && state.SamplesCollected >= tse.config.BootstrapSamples {
		state.Phase = PhaseExplore
	}

	// Phase transition: Explore → Exploit
	if state.Phase == PhaseExplore && state.SamplesCollected >= tse.config.ExploreToExploitSamples {
		state.Phase = PhaseExploit
	}

	// Update global exploration count and decay exploration rate
	if isExploration {
		tse.mu.Lock()
		tse.globalExplorationCount++

		// Exponential decay of exploration rate
		tse.currentExplorationRate *= tse.config.ExplorationDecayRate
		if tse.currentExplorationRate < tse.config.MinExplorationRate {
			tse.currentExplorationRate = tse.config.MinExplorationRate
		}
		tse.mu.Unlock()
	}
}

// sampleBeta samples from Beta(alpha, beta) distribution using rejection sampling
// This is a simplified implementation suitable for Thompson Sampling
func (tse *ThompsonSamplingEngine) sampleBeta(alpha, beta float64) float64 {
	tse.mu.Lock()
	defer tse.mu.Unlock()

	// Special cases
	if alpha <= 0 || beta <= 0 {
		return 0.5
	}

	// For large alpha and beta, use normal approximation
	if alpha > 100 && beta > 100 {
		mean := alpha / (alpha + beta)
		variance := (alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1))
		stddev := math.Sqrt(variance)

		// Sample from normal distribution (Box-Muller transform)
		u1 := tse.rng.Float64()
		u2 := tse.rng.Float64()
		z := math.Sqrt(-2*math.Log(u1)) * math.Cos(2*math.Pi*u2)

		sample := mean + z*stddev
		return math.Max(0.0, math.Min(1.0, sample))
	}

	// For small parameters, use simple mean-based approximation with noise
	mean := alpha / (alpha + beta)
	noise := (tse.rng.Float64() - 0.5) * 0.2 // +/- 10% noise
	sample := mean + noise

	return math.Max(0.0, math.Min(1.0, sample))
}

// GetState returns the current state for a backend
func (tse *ThompsonSamplingEngine) GetState(backendID string) (*ThompsonSamplingState, bool) {
	tse.mu.RLock()
	defer tse.mu.RUnlock()

	state, exists := tse.states[backendID]
	if !exists {
		return nil, false
	}

	// Return a copy to avoid race conditions
	state.mu.RLock()
	defer state.mu.RUnlock()

	stateCopy := &ThompsonSamplingState{
		BackendID:          state.BackendID,
		Phase:              state.Phase,
		SamplesCollected:   state.SamplesCollected,
		BootstrapRemaining: state.BootstrapRemaining,
		Alpha:              state.Alpha,
		Beta:               state.Beta,
		LastSampleValue:    state.LastSampleValue,
		ExplorationCount:   state.ExplorationCount,
		ExploitationCount:  state.ExploitationCount,
	}

	return stateCopy, true
}

// GetGlobalStats returns global Thompson Sampling statistics
func (tse *ThompsonSamplingEngine) GetGlobalStats() ThompsonSamplingStats {
	tse.mu.RLock()
	defer tse.mu.RUnlock()

	totalBootstrap := 0
	totalExplore := 0
	totalExploit := 0

	for _, state := range tse.states {
		state.mu.RLock()
		switch state.Phase {
		case PhaseBootstrap:
			totalBootstrap++
		case PhaseExplore:
			totalExplore++
		case PhaseExploit:
			totalExploit++
		}
		state.mu.RUnlock()
	}

	return ThompsonSamplingStats{
		TotalBackends:         len(tse.states),
		BootstrapPhaseCount:   totalBootstrap,
		ExplorePhaseCount:     totalExplore,
		ExploitPhaseCount:     totalExploit,
		GlobalExplorationCount: tse.globalExplorationCount,
		CurrentExplorationRate: tse.currentExplorationRate,
		ExplorationBudgetRemaining: tse.config.MaxExplorationBudget - tse.globalExplorationCount,
	}
}

// ThompsonSamplingStats holds global Thompson Sampling statistics
type ThompsonSamplingStats struct {
	TotalBackends         int     `json:"total_backends"`
	BootstrapPhaseCount   int     `json:"bootstrap_phase_count"`
	ExplorePhaseCount     int     `json:"explore_phase_count"`
	ExploitPhaseCount     int     `json:"exploit_phase_count"`
	GlobalExplorationCount int     `json:"global_exploration_count"`
	CurrentExplorationRate float64 `json:"current_exploration_rate"`
	ExplorationBudgetRemaining int `json:"exploration_budget_remaining"`
}

// ResetBackendState resets Thompson Sampling state for a backend
func (tse *ThompsonSamplingEngine) ResetBackendState(backendID string) {
	tse.mu.Lock()
	defer tse.mu.Unlock()

	delete(tse.states, backendID)
}
