package models

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"
)

// ModelStatus represents the current state of a model
type ModelStatus string

const (
	StatusRegistered ModelStatus = "registered"
	StatusLoading    ModelStatus = "loading"
	StatusActive     ModelStatus = "active"
	StatusFailed     ModelStatus = "failed"
	StatusDeprecated ModelStatus = "deprecated"
)

// ModelMetadata contains comprehensive information about a registered model
type ModelMetadata struct {
	ModelID     string                 `json:"model_id"`
	Version     string                 `json:"version"`
	Checksum    string                 `json:"checksum"`
	Format      string                 `json:"format"` // pkl, onnx, tflite, torch
	LoadPath    string                 `json:"load_path"`
	Status      ModelStatus            `json:"status"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	LoadedAt    *time.Time             `json:"loaded_at,omitempty"`
	SizeBytes   int64                  `json:"size_bytes"`
	Framework   string                 `json:"framework"` // sklearn, pytorch, tensorflow
	Tags        map[string]string      `json:"tags,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	PreviousVer *string                `json:"previous_version,omitempty"`
}

// ModelRegistry manages model lifecycle and versioning
type ModelRegistry struct {
	models map[string]*ModelMetadata // key: model_id
	mu     sync.RWMutex
	store  PersistenceStore
}

// PersistenceStore defines interface for model metadata storage
type PersistenceStore interface {
	Save(modelID string, metadata *ModelMetadata) error
	Load(modelID string) (*ModelMetadata, error)
	Delete(modelID string) error
	ListAll() (map[string]*ModelMetadata, error)
}

// InMemoryStore provides in-memory persistence (for development/testing)
type InMemoryStore struct {
	data map[string]*ModelMetadata
	mu   sync.RWMutex
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		data: make(map[string]*ModelMetadata),
	}
}

func (s *InMemoryStore) Save(modelID string, metadata *ModelMetadata) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[modelID] = metadata
	return nil
}

func (s *InMemoryStore) Load(modelID string) (*ModelMetadata, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if metadata, ok := s.data[modelID]; ok {
		return metadata, nil
	}
	return nil, fmt.Errorf("model not found: %s", modelID)
}

func (s *InMemoryStore) Delete(modelID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, modelID)
	return nil
}

func (s *InMemoryStore) ListAll() (map[string]*ModelMetadata, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Deep copy to prevent external modification
	result := make(map[string]*ModelMetadata, len(s.data))
	for k, v := range s.data {
		result[k] = v
	}
	return result, nil
}

// NewModelRegistry creates a new model registry with specified persistence store
func NewModelRegistry(store PersistenceStore) *ModelRegistry {
	registry := &ModelRegistry{
		models: make(map[string]*ModelMetadata),
		store:  store,
	}

	// Load existing models from persistence
	if stored, err := store.ListAll(); err == nil {
		registry.models = stored
	}

	return registry
}

// Register adds a new model to the registry
func (r *ModelRegistry) Register(metadata *ModelMetadata) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Validate required fields
	if metadata.ModelID == "" {
		return fmt.Errorf("model_id is required")
	}
	if metadata.Version == "" {
		return fmt.Errorf("version is required")
	}
	if metadata.LoadPath == "" {
		return fmt.Errorf("load_path is required")
	}

	// Calculate checksum if not provided
	if metadata.Checksum == "" {
		checksum, err := calculateFileChecksum(metadata.LoadPath)
		if err != nil {
			return fmt.Errorf("failed to calculate checksum: %w", err)
		}
		metadata.Checksum = checksum
	}

	// Get file size
	if metadata.SizeBytes == 0 {
		info, err := os.Stat(metadata.LoadPath)
		if err != nil {
			return fmt.Errorf("failed to stat file: %w", err)
		}
		metadata.SizeBytes = info.Size()
	}

	// Set timestamps
	now := time.Now()
	metadata.CreatedAt = now
	metadata.UpdatedAt = now

	// Set default status
	if metadata.Status == "" {
		metadata.Status = StatusRegistered
	}

	// Check if model already exists (versioning)
	if existing, exists := r.models[metadata.ModelID]; exists {
		metadata.PreviousVer = &existing.Version
	}

	// Save to registry
	r.models[metadata.ModelID] = metadata

	// Persist to storage
	if err := r.store.Save(metadata.ModelID, metadata); err != nil {
		return fmt.Errorf("failed to persist metadata: %w", err)
	}

	return nil
}

// Get retrieves model metadata by ID
func (r *ModelRegistry) Get(modelID string) (*ModelMetadata, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	metadata, exists := r.models[modelID]
	if !exists {
		return nil, fmt.Errorf("model not found: %s", modelID)
	}

	return metadata, nil
}

// Update modifies existing model metadata
func (r *ModelRegistry) Update(modelID string, updateFn func(*ModelMetadata) error) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	metadata, exists := r.models[modelID]
	if !exists {
		return fmt.Errorf("model not found: %s", modelID)
	}

	// Apply update function
	if err := updateFn(metadata); err != nil {
		return err
	}

	metadata.UpdatedAt = time.Now()

	// Persist changes
	if err := r.store.Save(modelID, metadata); err != nil {
		return fmt.Errorf("failed to persist update: %w", err)
	}

	return nil
}

// UpdateStatus changes the status of a model
func (r *ModelRegistry) UpdateStatus(modelID string, status ModelStatus) error {
	return r.Update(modelID, func(m *ModelMetadata) error {
		m.Status = status

		// Set LoadedAt timestamp when status becomes active
		if status == StatusActive && m.LoadedAt == nil {
			now := time.Now()
			m.LoadedAt = &now
		}

		return nil
	})
}

// Delete removes a model from the registry
func (r *ModelRegistry) Delete(modelID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.models[modelID]; !exists {
		return fmt.Errorf("model not found: %s", modelID)
	}

	delete(r.models, modelID)

	// Remove from persistence
	if err := r.store.Delete(modelID); err != nil {
		return fmt.Errorf("failed to delete from storage: %w", err)
	}

	return nil
}

// List returns all registered models
func (r *ModelRegistry) List() []*ModelMetadata {
	r.mu.RLock()
	defer r.mu.RUnlock()

	models := make([]*ModelMetadata, 0, len(r.models))
	for _, metadata := range r.models {
		models = append(models, metadata)
	}

	return models
}

// ListByStatus returns models filtered by status
func (r *ModelRegistry) ListByStatus(status ModelStatus) []*ModelMetadata {
	r.mu.RLock()
	defer r.mu.RUnlock()

	models := make([]*ModelMetadata, 0)
	for _, metadata := range r.models {
		if metadata.Status == status {
			models = append(models, metadata)
		}
	}

	return models
}

// ListByTag returns models filtered by tag key-value pair
func (r *ModelRegistry) ListByTag(key, value string) []*ModelMetadata {
	r.mu.RLock()
	defer r.mu.RUnlock()

	models := make([]*ModelMetadata, 0)
	for _, metadata := range r.models {
		if metadata.Tags != nil {
			if tagValue, exists := metadata.Tags[key]; exists && tagValue == value {
				models = append(models, metadata)
			}
		}
	}

	return models
}

// GetActiveModel returns the currently active model (if any)
func (r *ModelRegistry) GetActiveModel() (*ModelMetadata, error) {
	activeModels := r.ListByStatus(StatusActive)

	if len(activeModels) == 0 {
		return nil, fmt.Errorf("no active model found")
	}

	// Return most recently loaded
	var latest *ModelMetadata
	for _, model := range activeModels {
		if latest == nil || (model.LoadedAt != nil && model.LoadedAt.After(*latest.LoadedAt)) {
			latest = model
		}
	}

	return latest, nil
}

// Export exports model metadata to JSON
func (r *ModelRegistry) Export(modelID string) ([]byte, error) {
	metadata, err := r.Get(modelID)
	if err != nil {
		return nil, err
	}

	return json.MarshalIndent(metadata, "", "  ")
}

// Import imports model metadata from JSON
func (r *ModelRegistry) Import(data []byte) error {
	var metadata ModelMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return r.Register(&metadata)
}

// RegistryStats provides statistics about the registry
type RegistryStats struct {
	TotalModels    int                    `json:"total_models"`
	ActiveModels   int                    `json:"active_models"`
	ByStatus       map[ModelStatus]int    `json:"by_status"`
	ByFramework    map[string]int         `json:"by_framework"`
	TotalSizeBytes int64                  `json:"total_size_bytes"`
	AverageSize    int64                  `json:"average_size_bytes"`
}

// Stats returns registry statistics
func (r *ModelRegistry) Stats() *RegistryStats {
	r.mu.RLock()
	defer r.mu.RUnlock()

	stats := &RegistryStats{
		TotalModels: len(r.models),
		ByStatus:    make(map[ModelStatus]int),
		ByFramework: make(map[string]int),
	}

	for _, model := range r.models {
		stats.ByStatus[model.Status]++
		stats.ByFramework[model.Framework]++
		stats.TotalSizeBytes += model.SizeBytes

		if model.Status == StatusActive {
			stats.ActiveModels++
		}
	}

	if stats.TotalModels > 0 {
		stats.AverageSize = stats.TotalSizeBytes / int64(stats.TotalModels)
	}

	return stats
}

// ValidateChecksum verifies model file integrity
func (r *ModelRegistry) ValidateChecksum(modelID string) (bool, error) {
	metadata, err := r.Get(modelID)
	if err != nil {
		return false, err
	}

	currentChecksum, err := calculateFileChecksum(metadata.LoadPath)
	if err != nil {
		return false, fmt.Errorf("failed to calculate checksum: %w", err)
	}

	return currentChecksum == metadata.Checksum, nil
}

// calculateFileChecksum computes SHA256 checksum of a file
func calculateFileChecksum(filepath string) (string, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}
