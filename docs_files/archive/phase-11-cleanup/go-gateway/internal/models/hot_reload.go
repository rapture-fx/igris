package models

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// ModelReloadEvent represents a model reload notification
type ModelReloadEvent struct {
	ModelID     string    `json:"model_id"`
	Version     string    `json:"version"`
	Action      string    `json:"action"` // load, unload, reload
	Timestamp   time.Time `json:"timestamp"`
	PreviousVer string    `json:"previous_version,omitempty"`
}

// ModelReloader handles hot model reloading with zero downtime
type ModelReloader struct {
	registry       *ModelRegistry
	subscribers    map[string]chan *ModelReloadEvent
	subscribersMu  sync.RWMutex
	activeModels   map[string]*LoadedModel
	activeModelsMu sync.RWMutex
	reloadTimeout  time.Duration
}

// LoadedModel represents a model currently loaded in memory
type LoadedModel struct {
	Metadata      *ModelMetadata
	LoadedAt      time.Time
	InFlightCount int32 // Number of active inference requests
	mu            sync.RWMutex
}

// NewModelReloader creates a new model reloader
func NewModelReloader(registry *ModelRegistry) *ModelReloader {
	return &ModelReloader{
		registry:      registry,
		subscribers:   make(map[string]chan *ModelReloadEvent),
		activeModels:  make(map[string]*LoadedModel),
		reloadTimeout: 5 * time.Minute,
	}
}

// Subscribe registers a channel to receive reload events
func (r *ModelReloader) Subscribe(subscriberID string) chan *ModelReloadEvent {
	r.subscribersMu.Lock()
	defer r.subscribersMu.Unlock()

	eventChan := make(chan *ModelReloadEvent, 100)
	r.subscribers[subscriberID] = eventChan

	return eventChan
}

// Unsubscribe removes a subscriber
func (r *ModelReloader) Unsubscribe(subscriberID string) {
	r.subscribersMu.Lock()
	defer r.subscribersMu.Unlock()

	if ch, exists := r.subscribers[subscriberID]; exists {
		close(ch)
		delete(r.subscribers, subscriberID)
	}
}

// publishEvent sends an event to all subscribers
func (r *ModelReloader) publishEvent(event *ModelReloadEvent) {
	r.subscribersMu.RLock()
	defer r.subscribersMu.RUnlock()

	for _, ch := range r.subscribers {
		select {
		case ch <- event:
		default:
			// Channel full, skip
			log.Printf("Warning: Event channel full, skipping event for model %s", event.ModelID)
		}
	}
}

// LoadModel loads a model into memory
func (r *ModelReloader) LoadModel(modelID string) error {
	// Get metadata from registry
	metadata, err := r.registry.Get(modelID)
	if err != nil {
		return fmt.Errorf("failed to get model metadata: %w", err)
	}

	// Validate checksum before loading
	valid, err := r.registry.ValidateChecksum(modelID)
	if err != nil {
		return fmt.Errorf("checksum validation failed: %w", err)
	}
	if !valid {
		return fmt.Errorf("model file checksum mismatch - file may be corrupted")
	}

	// Update status to loading
	if err := r.registry.UpdateStatus(modelID, StatusLoading); err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	// Simulate model loading (in production, call actual ML service)
	// This would be replaced with actual gRPC call to Python ML service
	time.Sleep(100 * time.Millisecond)

	// Create loaded model entry
	loadedModel := &LoadedModel{
		Metadata:      metadata,
		LoadedAt:      time.Now(),
		InFlightCount: 0,
	}

	r.activeModelsMu.Lock()
	r.activeModels[modelID] = loadedModel
	r.activeModelsMu.Unlock()

	// Update status to active
	if err := r.registry.UpdateStatus(modelID, StatusActive); err != nil {
		return fmt.Errorf("failed to update status to active: %w", err)
	}

	// Publish load event
	event := &ModelReloadEvent{
		ModelID:   modelID,
		Version:   metadata.Version,
		Action:    "load",
		Timestamp: time.Now(),
	}
	r.publishEvent(event)

	log.Printf("Model loaded successfully: %s (version %s)", modelID, metadata.Version)

	return nil
}

// UnloadModel unloads a model from memory
func (r *ModelReloader) UnloadModel(modelID string) error {
	r.activeModelsMu.Lock()
	loadedModel, exists := r.activeModels[modelID]
	if !exists {
		r.activeModelsMu.Unlock()
		return fmt.Errorf("model not loaded: %s", modelID)
	}

	// Wait for in-flight requests to complete (with timeout)
	timeout := time.After(r.reloadTimeout)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	r.activeModelsMu.Unlock() // Release lock while waiting

	for {
		select {
		case <-timeout:
			return fmt.Errorf("timeout waiting for in-flight requests to complete")
		case <-ticker.C:
			loadedModel.mu.RLock()
			inFlight := loadedModel.InFlightCount
			loadedModel.mu.RUnlock()

			if inFlight == 0 {
				// Safe to unload
				r.activeModelsMu.Lock()
				delete(r.activeModels, modelID)
				r.activeModelsMu.Unlock()

				// Update registry status
				r.registry.UpdateStatus(modelID, StatusDeprecated)

				// Publish unload event
				event := &ModelReloadEvent{
					ModelID:   modelID,
					Version:   loadedModel.Metadata.Version,
					Action:    "unload",
					Timestamp: time.Now(),
				}
				r.publishEvent(event)

				log.Printf("Model unloaded successfully: %s", modelID)
				return nil
			}

			// Still have in-flight requests, continue waiting
			log.Printf("Waiting for %d in-flight requests to complete for model %s", inFlight, modelID)
		}
	}
}

// ReloadModel performs a hot reload with zero downtime
func (r *ModelReloader) ReloadModel(modelID, newVersion string) error {
	// Get old model metadata
	oldMetadata, err := r.registry.Get(modelID)
	if err != nil {
		return fmt.Errorf("failed to get current model: %w", err)
	}

	oldVersion := oldMetadata.Version

	log.Printf("Starting hot reload for model %s: %s -> %s", modelID, oldVersion, newVersion)

	// Register new version
	newMetadata := &ModelMetadata{
		ModelID:   modelID,
		Version:   newVersion,
		Format:    oldMetadata.Format,
		LoadPath:  oldMetadata.LoadPath, // In production, this would be new path
		Framework: oldMetadata.Framework,
		Tags:      oldMetadata.Tags,
	}

	if err := r.registry.Register(newMetadata); err != nil {
		return fmt.Errorf("failed to register new version: %w", err)
	}

	// Validate new model checksum
	valid, err := r.registry.ValidateChecksum(modelID)
	if err != nil || !valid {
		// Rollback: delete new version, keep old
		r.registry.Delete(modelID)
		return fmt.Errorf("new model failed checksum validation - rolling back")
	}

	// Load new model (atomic swap)
	if err := r.LoadModel(modelID); err != nil {
		// Rollback: delete new version
		r.registry.Delete(modelID)
		return fmt.Errorf("failed to load new model - rolling back: %w", err)
	}

	// Publish reload event
	event := &ModelReloadEvent{
		ModelID:     modelID,
		Version:     newVersion,
		Action:      "reload",
		Timestamp:   time.Now(),
		PreviousVer: oldVersion,
	}
	r.publishEvent(event)

	log.Printf("Hot reload completed successfully: %s (%s -> %s)", modelID, oldVersion, newVersion)

	return nil
}

// IncrementInFlight increments the in-flight request counter
func (r *ModelReloader) IncrementInFlight(modelID string) error {
	r.activeModelsMu.RLock()
	loadedModel, exists := r.activeModels[modelID]
	r.activeModelsMu.RUnlock()

	if !exists {
		return fmt.Errorf("model not loaded: %s", modelID)
	}

	loadedModel.mu.Lock()
	loadedModel.InFlightCount++
	loadedModel.mu.Unlock()

	return nil
}

// DecrementInFlight decrements the in-flight request counter
func (r *ModelReloader) DecrementInFlight(modelID string) {
	r.activeModelsMu.RLock()
	loadedModel, exists := r.activeModels[modelID]
	r.activeModelsMu.RUnlock()

	if !exists {
		return
	}

	loadedModel.mu.Lock()
	if loadedModel.InFlightCount > 0 {
		loadedModel.InFlightCount--
	}
	loadedModel.mu.Unlock()
}

// GetLoadedModel returns the currently loaded model
func (r *ModelReloader) GetLoadedModel(modelID string) (*LoadedModel, error) {
	r.activeModelsMu.RLock()
	defer r.activeModelsMu.RUnlock()

	loadedModel, exists := r.activeModels[modelID]
	if !exists {
		return nil, fmt.Errorf("model not loaded: %s", modelID)
	}

	return loadedModel, nil
}

// ListLoadedModels returns all currently loaded models
func (r *ModelReloader) ListLoadedModels() []*LoadedModel {
	r.activeModelsMu.RLock()
	defer r.activeModelsMu.RUnlock()

	models := make([]*LoadedModel, 0, len(r.activeModels))
	for _, model := range r.activeModels {
		models = append(models, model)
	}

	return models
}

// WatchModelUpdates provides a stream of model reload events (gRPC-compatible)
func (r *ModelReloader) WatchModelUpdates(ctx context.Context, subscriberID string) (<-chan *ModelReloadEvent, error) {
	eventChan := r.Subscribe(subscriberID)

	// Cleanup on context cancellation
	go func() {
		<-ctx.Done()
		r.Unsubscribe(subscriberID)
	}()

	return eventChan, nil
}

// ReloadStats provides statistics about reload operations
type ReloadStats struct {
	TotalReloads     int               `json:"total_reloads"`
	SuccessfulReloads int              `json:"successful_reloads"`
	FailedReloads    int               `json:"failed_reloads"`
	AverageReloadTime time.Duration    `json:"average_reload_time_ms"`
	LoadedModels     int               `json:"loaded_models"`
	ActiveSubscribers int              `json:"active_subscribers"`
}

// Stats returns reload statistics
func (r *ModelReloader) Stats() *ReloadStats {
	r.activeModelsMu.RLock()
	loadedCount := len(r.activeModels)
	r.activeModelsMu.RUnlock()

	r.subscribersMu.RLock()
	subscriberCount := len(r.subscribers)
	r.subscribersMu.RUnlock()

	return &ReloadStats{
		LoadedModels:     loadedCount,
		ActiveSubscribers: subscriberCount,
		// In production, track actual reload metrics
		TotalReloads:      0,
		SuccessfulReloads: 0,
		FailedReloads:     0,
		AverageReloadTime: 0,
	}
}
