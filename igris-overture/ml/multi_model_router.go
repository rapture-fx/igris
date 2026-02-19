package ml

import (
	"sync"
	"time"
)

// ModelMetadata describes a model that can be registered with the router.
type ModelMetadata struct {
	ID      string
	Name    string
	Version string
	Runtime RuntimeType
}

// modelEntry holds a registered model and its performance counters.
type modelEntry struct {
	metadata  ModelMetadata
	successes int64
	failures  int64
}

// MultiModelRouter is an in-package implementation of ModelPerformanceUpdater.
// It provides a lightweight Thompson-Sampling-style selector suitable for
// benchmarks and tests inside the ml package, without importing inference/core.
//
// Production routing is handled by inference/core.MultiModelRouter, wired in
// via the ModelPerformanceUpdater interface to avoid a circular import.
type MultiModelRouter struct {
	mu     sync.RWMutex
	models map[string]*modelEntry
}

// NewMultiModelRouter creates a MultiModelRouter ready for use.
func NewMultiModelRouter() *MultiModelRouter {
	return &MultiModelRouter{
		models: make(map[string]*modelEntry),
	}
}

// RegisterModel adds a model to the router. Returns nil on success.
func (r *MultiModelRouter) RegisterModel(meta ModelMetadata) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.models[meta.ID] = &modelEntry{metadata: meta}
	return nil
}

// SelectModel picks the model with the best success rate (or first registered
// model if no data exists). Returns ("", nil) when the registry is empty.
func (r *MultiModelRouter) SelectModel(_ string) (string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var best string
	bestRate := -1.0
	for id, m := range r.models {
		total := m.successes + m.failures
		rate := 0.5 // Jeffreys prior for zero samples
		if total > 0 {
			rate = float64(m.successes) / float64(total)
		}
		if rate > bestRate {
			bestRate = rate
			best = id
		}
	}
	return best, nil
}

// UpdateModelPerformance satisfies the ModelPerformanceUpdater interface and
// records success/failure so SelectModel can make better choices.
func (r *MultiModelRouter) UpdateModelPerformance(modelID string, success bool, _ time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, ok := r.models[modelID]
	if !ok {
		return
	}
	if success {
		m.successes++
	} else {
		m.failures++
	}
}
