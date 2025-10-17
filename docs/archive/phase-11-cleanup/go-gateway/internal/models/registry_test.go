package models

import (
	"os"
	"testing"
	"time"
)

func TestModelRegistry_Register(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	metadata := &ModelMetadata{
		ModelID:   "test_model_v1",
		Version:   "1.0.0",
		Format:    "pkl",
		LoadPath:  "/tmp/test_model.pkl",
		Framework: "sklearn",
		Tags: map[string]string{
			"env": "test",
		},
	}

	// Create dummy file for testing
	tmpFile, err := os.CreateTemp("", "test_model_*.pkl")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test model data")
	tmpFile.Close()

	metadata.LoadPath = tmpFile.Name()

	err = registry.Register(metadata)
	if err != nil {
		t.Fatalf("Failed to register model: %v", err)
	}

	// Verify model was registered
	retrieved, err := registry.Get("test_model_v1")
	if err != nil {
		t.Fatalf("Failed to get registered model: %v", err)
	}

	if retrieved.ModelID != "test_model_v1" {
		t.Errorf("Expected model_id 'test_model_v1', got '%s'", retrieved.ModelID)
	}

	if retrieved.Version != "1.0.0" {
		t.Errorf("Expected version '1.0.0', got '%s'", retrieved.Version)
	}

	if retrieved.Status != StatusRegistered {
		t.Errorf("Expected status 'registered', got '%s'", retrieved.Status)
	}

	if retrieved.Checksum == "" {
		t.Error("Expected checksum to be calculated")
	}

	if retrieved.SizeBytes == 0 {
		t.Error("Expected size_bytes to be set")
	}
}

func TestModelRegistry_Update(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	// Create temp file
	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test")
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		Format:   "pkl",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)

	// Update model
	err := registry.Update("test_model", func(m *ModelMetadata) error {
		m.Tags = map[string]string{"env": "production"}
		return nil
	})

	if err != nil {
		t.Fatalf("Failed to update model: %v", err)
	}

	// Verify update
	updated, _ := registry.Get("test_model")
	if updated.Tags["env"] != "production" {
		t.Errorf("Expected tag 'env' to be 'production', got '%s'", updated.Tags["env"])
	}
}

func TestModelRegistry_UpdateStatus(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)

	// Update to loading
	err := registry.UpdateStatus("test_model", StatusLoading)
	if err != nil {
		t.Fatalf("Failed to update status: %v", err)
	}

	model, _ := registry.Get("test_model")
	if model.Status != StatusLoading {
		t.Errorf("Expected status 'loading', got '%s'", model.Status)
	}

	// Update to active
	err = registry.UpdateStatus("test_model", StatusActive)
	if err != nil {
		t.Fatalf("Failed to update status to active: %v", err)
	}

	model, _ = registry.Get("test_model")
	if model.Status != StatusActive {
		t.Errorf("Expected status 'active', got '%s'", model.Status)
	}

	if model.LoadedAt == nil {
		t.Error("Expected LoadedAt to be set when status becomes active")
	}
}

func TestModelRegistry_Delete(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)

	// Delete model
	err := registry.Delete("test_model")
	if err != nil {
		t.Fatalf("Failed to delete model: %v", err)
	}

	// Verify deletion
	_, err = registry.Get("test_model")
	if err == nil {
		t.Error("Expected error when getting deleted model")
	}
}

func TestModelRegistry_List(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Register multiple models
	for i := 1; i <= 3; i++ {
		metadata := &ModelMetadata{
			ModelID:  fmt.Sprintf("model_%d", i),
			Version:  "1.0.0",
			LoadPath: tmpFile.Name(),
		}
		registry.Register(metadata)
	}

	models := registry.List()
	if len(models) != 3 {
		t.Errorf("Expected 3 models, got %d", len(models))
	}
}

func TestModelRegistry_ListByStatus(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Register models with different statuses
	for i := 1; i <= 3; i++ {
		metadata := &ModelMetadata{
			ModelID:  fmt.Sprintf("model_%d", i),
			Version:  "1.0.0",
			LoadPath: tmpFile.Name(),
		}
		registry.Register(metadata)

		if i%2 == 0 {
			registry.UpdateStatus(metadata.ModelID, StatusActive)
		}
	}

	activeModels := registry.ListByStatus(StatusActive)
	if len(activeModels) != 1 {
		t.Errorf("Expected 1 active model, got %d", len(activeModels))
	}

	registeredModels := registry.ListByStatus(StatusRegistered)
	if len(registeredModels) != 2 {
		t.Errorf("Expected 2 registered models, got %d", len(registeredModels))
	}
}

func TestModelRegistry_ListByTag(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Register models with tags
	for i := 1; i <= 3; i++ {
		env := "dev"
		if i == 3 {
			env = "prod"
		}

		metadata := &ModelMetadata{
			ModelID:  fmt.Sprintf("model_%d", i),
			Version:  "1.0.0",
			LoadPath: tmpFile.Name(),
			Tags: map[string]string{
				"env": env,
			},
		}
		registry.Register(metadata)
	}

	devModels := registry.ListByTag("env", "dev")
	if len(devModels) != 2 {
		t.Errorf("Expected 2 dev models, got %d", len(devModels))
	}

	prodModels := registry.ListByTag("env", "prod")
	if len(prodModels) != 1 {
		t.Errorf("Expected 1 prod model, got %d", len(prodModels))
	}
}

func TestModelRegistry_GetActiveModel(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Register models
	model1 := &ModelMetadata{
		ModelID:  "model_1",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(model1)

	model2 := &ModelMetadata{
		ModelID:  "model_2",
		Version:  "2.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(model2)

	// Activate model 1
	registry.UpdateStatus("model_1", StatusActive)
	time.Sleep(10 * time.Millisecond) // Ensure different timestamps

	// Activate model 2 (should be latest)
	registry.UpdateStatus("model_2", StatusActive)

	active, err := registry.GetActiveModel()
	if err != nil {
		t.Fatalf("Failed to get active model: %v", err)
	}

	if active.ModelID != "model_2" {
		t.Errorf("Expected active model 'model_2', got '%s'", active.ModelID)
	}
}

func TestModelRegistry_Stats(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test data")
	tmpFile.Close()

	// Register multiple models
	for i := 1; i <= 5; i++ {
		metadata := &ModelMetadata{
			ModelID:   fmt.Sprintf("model_%d", i),
			Version:   "1.0.0",
			LoadPath:  tmpFile.Name(),
			Framework: "sklearn",
		}
		registry.Register(metadata)

		if i <= 2 {
			registry.UpdateStatus(metadata.ModelID, StatusActive)
		}
	}

	stats := registry.Stats()

	if stats.TotalModels != 5 {
		t.Errorf("Expected 5 total models, got %d", stats.TotalModels)
	}

	if stats.ActiveModels != 2 {
		t.Errorf("Expected 2 active models, got %d", stats.ActiveModels)
	}

	if stats.ByFramework["sklearn"] != 5 {
		t.Errorf("Expected 5 sklearn models, got %d", stats.ByFramework["sklearn"])
	}

	if stats.TotalSizeBytes == 0 {
		t.Error("Expected total_size_bytes > 0")
	}
}

func TestModelRegistry_ValidateChecksum(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test model content")
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)

	// Validate checksum
	valid, err := registry.ValidateChecksum("test_model")
	if err != nil {
		t.Fatalf("Failed to validate checksum: %v", err)
	}

	if !valid {
		t.Error("Expected checksum to be valid")
	}

	// Modify file
	tmpFile, _ = os.OpenFile(tmpFile.Name(), os.O_APPEND|os.O_WRONLY, 0644)
	tmpFile.WriteString(" modified")
	tmpFile.Close()

	// Checksum should now be invalid
	valid, err = registry.ValidateChecksum("test_model")
	if err != nil {
		t.Fatalf("Failed to validate checksum after modification: %v", err)
	}

	if valid {
		t.Error("Expected checksum to be invalid after file modification")
	}
}

func TestModelRegistry_ExportImport(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:   "test_model",
		Version:   "1.0.0",
		Format:    "pkl",
		LoadPath:  tmpFile.Name(),
		Framework: "sklearn",
		Tags: map[string]string{
			"env": "test",
		},
	}

	registry.Register(metadata)

	// Export
	exported, err := registry.Export("test_model")
	if err != nil {
		t.Fatalf("Failed to export: %v", err)
	}

	// Create new registry and import
	store2 := NewInMemoryStore()
	registry2 := NewModelRegistry(store2)

	err = registry2.Import(exported)
	if err != nil {
		t.Fatalf("Failed to import: %v", err)
	}

	// Verify imported model
	imported, err := registry2.Get("test_model")
	if err != nil {
		t.Fatalf("Failed to get imported model: %v", err)
	}

	if imported.Version != "1.0.0" {
		t.Errorf("Expected version '1.0.0', got '%s'", imported.Version)
	}

	if imported.Tags["env"] != "test" {
		t.Errorf("Expected tag 'env' to be 'test', got '%s'", imported.Tags["env"])
	}
}

func TestModelRegistry_ConcurrentAccess(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Concurrent registrations
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(id int) {
			metadata := &ModelMetadata{
				ModelID:  fmt.Sprintf("model_%d", id),
				Version:  "1.0.0",
				LoadPath: tmpFile.Name(),
			}
			registry.Register(metadata)
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify all models registered
	models := registry.List()
	if len(models) != 10 {
		t.Errorf("Expected 10 models after concurrent registration, got %d", len(models))
	}
}

func BenchmarkModelRegistry_Register(b *testing.B) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "bench_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		metadata := &ModelMetadata{
			ModelID:  fmt.Sprintf("model_%d", i),
			Version:  "1.0.0",
			LoadPath: tmpFile.Name(),
		}
		registry.Register(metadata)
	}
}

func BenchmarkModelRegistry_Get(b *testing.B) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)

	tmpFile, _ := os.CreateTemp("", "bench_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Pre-populate
	metadata := &ModelMetadata{
		ModelID:  "bench_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		registry.Get("bench_model")
	}
}
